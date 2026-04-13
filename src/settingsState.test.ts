import { describe, expect, it, vi } from "vitest";
import {
  getGeneratorModeOptions,
  parseNonNegativeInteger,
  parsePositiveInteger,
  parsePositiveIntegerList,
  parseStringList,
  updateSetting
} from "./settingsState";
import { DEFAULT_SETTINGS } from "./settings";

describe("settingsState", () => {
  it("parses positive integers and rejects invalid values", () => {
    expect(parsePositiveInteger("12")).toBe(12);
    expect(parsePositiveInteger("0")).toBeNull();
    expect(parsePositiveInteger("abc")).toBeNull();
  });

  it("parses non-negative integers", () => {
    expect(parseNonNegativeInteger("0")).toBe(0);
    expect(parseNonNegativeInteger("8")).toBe(8);
    expect(parseNonNegativeInteger("-1")).toBeNull();
  });

  it("parses integer lists and string lists", () => {
    expect(parsePositiveIntegerList("1, 10, x, 0")).toEqual([1, 10]);
    expect(parseStringList("Templates/, Archive/ ,")).toEqual(["Templates/", "Archive/"]);
  });

  it("updates a setting and calls save", async () => {
    const settings = { ...DEFAULT_SETTINGS };
    const save = vi.fn(async () => undefined);

    await updateSetting(settings, "newCardsPerDay", 20, save);

    expect(settings.newCardsPerDay).toBe(20);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("returns generator mode options", () => {
    expect(getGeneratorModeOptions().map((option) => option.value)).toEqual(["rule", "ai", "hybrid"]);
  });
});
