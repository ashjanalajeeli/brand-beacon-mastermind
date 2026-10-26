import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  approvalSchema,
  marketingSettingsSchema,
  settingsInstructions,
} from "./marketing-settings";

describe("marketing preferences", () => {
  it("supports domestic competitors within the user's country", () => {
    assert.match(
      settingsInstructions(marketingSettingsSchema.parse({ competitor_scope: "domestic" })),
      /within the stated country only/,
    );
  });

  it("supports international competitor analysis across countries", () => {
    assert.match(
      settingsInstructions(marketingSettingsSchema.parse({ competitor_scope: "international" })),
      /international: across countries/,
    );
  });

  it("defaults paid advertising to false and advertising spend to zero", () => {
    const settings = marketingSettingsSchema.parse({});
    assert.equal(settings.paid_ads, false);
    assert.match(settingsInstructions(settings), /Set advertising spend to 0/);
  });

  it("keeps opting into ads separate from authorization to spend", () => {
    assert.match(
      settingsInstructions(marketingSettingsSchema.parse({ paid_ads: true })),
      /No spending is authorized/,
    );
  });

  it("requires explicit approval before execution", () => {
    assert.equal(
      approvalSchema.safeParse({
        content: "Plan",
        platforms: ["instagram"],
        paid_ads: false,
        approved: false,
      }).success,
      false,
    );
    assert.equal(
      approvalSchema.safeParse({
        content: "Plan",
        platforms: ["instagram"],
        paid_ads: false,
        approved: true,
      }).success,
      true,
    );
  });

  it("requires a selected platform for execution", () => {
    assert.equal(
      approvalSchema.safeParse({ content: "Plan", platforms: [], paid_ads: false, approved: true })
        .success,
      false,
    );
  });

  it("supports all six requested platforms", () => {
    const platforms = ["instagram", "facebook", "x", "linkedin", "whatsapp", "tiktok"];
    assert.deepEqual(marketingSettingsSchema.parse({ platforms }).platforms, platforms);
  });
});
