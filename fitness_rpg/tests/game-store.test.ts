import { describe, it, expect } from "vitest";
import {
  getLevelForXP,
  getXPForNextLevel,
  getXPProgress,
  getLevelName,
  getLevelColor,
  isToday,
  isYesterday,
  XP_PER_LEVEL,
  LEVEL_NAMES,
  LEVEL_COLORS,
} from "../lib/game-store";

describe("getLevelForXP", () => {
  it("returns level 1 for 0 XP", () => {
    expect(getLevelForXP(0)).toBe(1);
  });

  it("returns level 1 for 199 XP", () => {
    expect(getLevelForXP(199)).toBe(1);
  });

  it("returns level 2 for exactly 200 XP", () => {
    expect(getLevelForXP(200)).toBe(2);
  });

  it("returns level 3 for 500 XP", () => {
    expect(getLevelForXP(500)).toBe(3);
  });

  it("returns level 5 max for very high XP", () => {
    expect(getLevelForXP(99999)).toBe(5);
  });
});

describe("getXPForNextLevel", () => {
  it("returns 200 for level 1", () => {
    expect(getXPForNextLevel(1)).toBe(200);
  });

  it("returns 500 for level 2", () => {
    expect(getXPForNextLevel(2)).toBe(500);
  });
});

describe("getXPProgress", () => {
  it("returns 0 at start of level 1", () => {
    expect(getXPProgress(0, 1)).toBe(0);
  });

  it("returns 0.5 at midpoint of level 1", () => {
    expect(getXPProgress(100, 1)).toBe(0.5);
  });

  it("returns 1 at end of level 1", () => {
    expect(getXPProgress(200, 1)).toBe(1);
  });
});

describe("getLevelName", () => {
  it("returns Recruta for level 1", () => {
    expect(getLevelName(1)).toBe("Recruta");
  });

  it("returns Lendário for level 5", () => {
    expect(getLevelName(5)).toBe("Lendário");
  });
});

describe("getLevelColor", () => {
  it("returns a valid hex color for level 1", () => {
    const color = getLevelColor(1);
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe("isToday", () => {
  it("returns true for current date", () => {
    expect(isToday(new Date().toISOString())).toBe(true);
  });

  it("returns false for yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday.toISOString())).toBe(false);
  });
});

describe("isYesterday", () => {
  it("returns true for yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isYesterday(yesterday.toISOString())).toBe(true);
  });

  it("returns false for today", () => {
    expect(isYesterday(new Date().toISOString())).toBe(false);
  });
});

describe("constants", () => {
  it("XP_PER_LEVEL has 6 entries", () => {
    expect(XP_PER_LEVEL.length).toBe(6);
  });

  it("LEVEL_NAMES has 6 entries", () => {
    expect(LEVEL_NAMES.length).toBe(6);
  });

  it("LEVEL_COLORS has 6 entries", () => {
    expect(LEVEL_COLORS.length).toBe(6);
  });
});
