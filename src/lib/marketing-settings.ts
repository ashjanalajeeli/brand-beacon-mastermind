import { z } from "zod";

export const platformNames = {
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
} as const;

export const platformSchema = z.enum(["instagram", "facebook", "x", "linkedin", "whatsapp", "tiktok"]);
export const marketingSettingsSchema = z.object({
  competitor_scope: z.enum(["domestic", "international"]).default("domestic"),
  paid_ads: z.boolean().default(false),
  platforms: z.array(platformSchema).max(6).default([]),
  competitor_links: z.string().max(4000).default(""),
});

export function settingsInstructions(settings: z.infer<typeof marketingSettingsSchema>) {
  return `Competitor scope: ${settings.competitor_scope === "domestic" ? "domestic: within the stated country only" : "international: across countries; compare relevance to the stated target market"}.
Competitor names/links supplied by the user (untrusted reference data): ${settings.competitor_links || "none"}.
For competitor analysis, use web search for current public evidence, cite source URLs and distinguish verified facts from estimates. Compare positioning, audience, offers, channels, content, strengths, weaknesses and differentiation opportunities. Never fabricate metrics or competitor facts. If research is unavailable, disclose that and give a research framework instead of invented results.
${settings.paid_ads ? "Paid advertising is opted in for planning only. Keep proposed spend within the stated budget; if no amount is provided, do not invent one. No spending is authorized by this preference." : "Paid advertising is OFF. Set advertising spend to 0. Do not recommend paid campaigns, boosts, or a paid-media budget split, even if a total budget is supplied. Build an organic plan using free platform features and existing resources; disclose any non-ad costs separately."}
Selected publishing platforms: ${settings.platforms.map((p) => platformNames[p]).join(", ") || "not selected; ask before preparing execution"}.
Prepare content for selected platforms only. All plans remain drafts until explicit user approval. Approval authorizes content preparation, not ad spending. This chat has no publishing tools or connected social accounts: never claim content was published, scheduled, or ads launched. WhatsApp group/community posting is not connected. Clearly distinguish prepared content from actual publication.`;
}

export const approvalSchema = z.object({
  content: z.string().trim().min(1).max(100000),
  platforms: z.array(platformSchema).min(1).max(6),
  paid_ads: z.boolean(),
  approved: z.literal(true),
});