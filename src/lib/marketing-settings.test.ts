import { describe, expect, it } from "bun:test";
import { approvalSchema, marketingSettingsSchema, settingsInstructions } from "./marketing-settings";

describe("marketing preferences", () => {
  it("supports domestic competitors within the user's country", () => {
    expect(settingsInstructions(marketingSettingsSchema.parse({ competitor_scope: "domestic" }))).toContain("within the stated country only");
  });
  it("supports international competitor analysis across countries", () => {
    expect(settingsInstructions(marketingSettingsSchema.parse({ competitor_scope: "international" }))).toContain("international: across countries");
  });
  it("defaults paid advertising to false and advertising spend to zero", () => {
    const settings = marketingSettingsSchema.parse({});
    expect(settings.paid_ads).toBe(false);
    expect(settingsInstructions(settings)).toContain("Set advertising spend to 0");
  });
  it("keeps opting into ads separate from authorization to spend", () => {
    expect(settingsInstructions(marketingSettingsSchema.parse({ paid_ads: true }))).toContain("No spending is authorized");
  });
  it("requires explicit approval before execution", () => {
    expect(approvalSchema.safeParse({ content: "Plan", platforms: ["instagram"], paid_ads: false, approved: false }).success).toBe(false);
    expect(approvalSchema.safeParse({ content: "Plan", platforms: ["instagram"], paid_ads: false, approved: true }).success).toBe(true);
  });
  it("requires a selected platform for execution", () => {
    expect(approvalSchema.safeParse({ content: "Plan", platforms: [], paid_ads: false, approved: true }).success).toBe(false);
  });
  it("supports all six requested platforms", () => {
    const platforms = ["instagram", "facebook", "x", "linkedin", "whatsapp", "tiktok"];
    expect(marketingSettingsSchema.parse({ platforms }).platforms).toEqual(platforms);
  });
});