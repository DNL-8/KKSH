export type HunterRank = "F" | "E" | "D" | "C" | "B" | "A" | "S";

interface RankRule {
  minLevel: number;
  maxLevel: number;
  rank: HunterRank;
}

const RANK_RULES: RankRule[] = [
  { minLevel: 1, maxLevel: 4, rank: "F" },
  { minLevel: 5, maxLevel: 9, rank: "E" },
  { minLevel: 10, maxLevel: 19, rank: "D" },
  { minLevel: 20, maxLevel: 34, rank: "C" },
  { minLevel: 35, maxLevel: 49, rank: "B" },
  { minLevel: 50, maxLevel: 74, rank: "A" },
  { minLevel: 75, maxLevel: Number.POSITIVE_INFINITY, rank: "S" },
];

export function rankFromLevel(level: number): HunterRank {
  const safeLevel = Math.max(1, Math.floor(level));
  const found = RANK_RULES.find((rule) => safeLevel >= rule.minLevel && safeLevel <= rule.maxLevel);
  return found?.rank ?? "F";
}
