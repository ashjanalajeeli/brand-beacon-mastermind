import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type Brief = {
  project_name?: string | null;
  idea?: string | null;
  audience?: string | null;
  duration?: string | null;
  budget?: string | null;
  country?: string | null;
  language?: string | null;
  notes?: string | null;
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

        const body = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const lovable = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: key,
          headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });

        const result = streamText({
          model: lovable.responses("openai/gpt-6-astra"),
          system: systemPrompt(body.brief, body.language ?? "ar"),
          messages: await convertToModelMessages(body.messages as UIMessage[]),
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "medium",
              store: false,
            },
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages as UIMessage[],
        });
      },
    },
  },
});
