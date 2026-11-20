import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { marketingSettingsSchema, settingsInstructions } from "@/lib/marketing-settings";
import { BriefSchema } from "@/lib/marketing.functions";

const MAX_BODY_BYTES = 512_000;
const MAX_MESSAGES = 60;
const rateLimitPerHour = () => Number(process.env["CHAT_RATE_LIMIT_PER_HOUR"] ?? 40);

type Brief = {
  project_name?: string | null;
  idea?: string | null;
  audience?: string | null;
  duration?: string | null;
  budget?: string | null;
  country?: string | null;
  language?: string | null;
  notes?: string | null;
  competitor_scope?: string;
  competitor_links?: string;
  paid_ads?: boolean;
  platforms?: string[];
};

type ChatRequestBody = { messages?: unknown; brief?: Brief; language?: string };

function systemPrompt(brief: Brief | undefined, language: string) {
  const lang = language === "en" ? "English" : "Arabic";
  const b = brief ?? {};
  return `You are an integrated senior digital marketing team acting as one agent: strategist, media planner, content planner, copywriter, scriptwriter, brand strategist, and performance analyst.

Always answer in ${lang}. Be concrete, practical and ready to execute — no vague filler.

Project brief:
- Project/brand: ${b.project_name || "not provided"}
- Idea/plan: ${b.idea || "not provided"}
- Target audience: ${b.audience || "not provided"}
- Duration: ${b.duration || "not provided"}
- Budget: ${b.budget || "not provided"}
- Country/market: ${b.country || "not provided"}
- Notes: ${b.notes || "none"}

${settingsInstructions(marketingSettingsSchema.parse(b))}

Rules:
- Adapt every recommendation to the country's culture, language, platforms, seasons and price levels, and keep spend inside the stated budget.
- Use clear markdown: headings, tables for plans/calendars/budgets, checklists for execution steps.
- Marketing plans include: objectives, KPIs, channels, budget split, timeline, owners, and expected results.
- Content plans include a posting calendar (date, platform, format, hook, caption, hashtags, CTA).
- When asked for copy or scripts, deliver finished publishable text, not instructions about it.
- If key brief fields are missing, make reasonable assumptions, state them briefly, and continue — ask at most one clarifying question.
- Never invent facts about the business (prices, locations, awards); mark such placeholders clearly.`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !userData?.user) return new Response("Unauthorized", { status: 401 });

        const declaredLength = Number(request.headers.get("content-length") ?? 0);
        if (declaredLength > MAX_BODY_BYTES)
          return new Response("Request is too large", { status: 413 });
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES)
          return new Response("Request is too large", { status: 413 });

        let body: ChatRequestBody;
        try {
          body = JSON.parse(raw) as ChatRequestBody;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!Array.isArray(body.messages) || body.messages.length === 0) {
          return new Response("Messages are required", { status: 400 });
        }
        // Keep only the most recent turns so one request cannot carry a huge history.
        const messages = body.messages.slice(-MAX_MESSAGES) as UIMessage[];
        const brief = BriefSchema.safeParse(body.brief ?? {});
        if (!brief.success) return new Response("Invalid brief", { status: 400 });
        const language = body.language === "en" ? "en" : "ar";

        const userId = userData.user.id;
        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count, error: countError } = await supabaseAdmin
          .from("chat_rate_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", since);
        if (countError) return new Response("Rate limit check failed", { status: 503 });
        if ((count ?? 0) >= rateLimitPerHour()) {
          return new Response("Too many requests, please try again later", {
            status: 429,
            headers: { "Retry-After": "600" },
          });
        }
        await supabaseAdmin.from("chat_rate_events").insert({ user_id: userId });
        await supabaseAdmin
          .from("chat_rate_events")
          .delete()
          .eq("user_id", userId)
          .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("AI service is not configured", { status: 500 });

        const lovable = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: key,
          headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });

        const result = streamText({
          model: lovable.responses("openai/gpt-6-astra"),
          instructions: systemPrompt(brief.data, language),
          messages: await convertToModelMessages(messages),
          tools: { web_search: lovable.tools.webSearch({}) },
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "medium",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
        });
      },
    },
  },
});
