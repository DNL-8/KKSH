import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useGameStore } from "@/hooks/use-game-store";
import {
  getLevelName,
  getLevelColor,
  getXPProgress,
  getXPForNextLevel,
  XP_PER_LEVEL,
  LEVEL_NAMES,
} from "@/lib/game-store";

export default function ProgressScreen() {
  const colors = useColors();
  const state = useGameStore();
  const { stats, achievements, workoutHistory, hero } = state;

  const levelName = getLevelName(stats.level);
  const levelColor = getLevelColor(stats.level);
  const xpProgress = getXPProgress(stats.xp, stats.level);
  const xpForNext = getXPForNextLevel(stats.level);
  const currentLevelXP = XP_PER_LEVEL[stats.level - 1] ?? 0;

  // Build last 28 days heatmap
  const heatmap = useMemo(() => {
    const days: { date: string; count: number }[] = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const count = workoutHistory.filter(
        (w) => new Date(w.completedAt).toDateString() === dateStr
      ).length;
      days.push({ date: dateStr, count });
    }
    return days;
  }, [workoutHistory]);

  const unlockedAchievements = achievements.filter((a) => a.unlockedAt);
  const lockedAchievements = achievements.filter((a) => !a.unlockedAt);

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Progresso</Text>
          <View style={[styles.levelBadge, { backgroundColor: levelColor + "33" }]}>
            <Text style={[styles.levelBadgeText, { color: levelColor }]}>
              Nv. {stats.level} · {levelName}
            </Text>
          </View>
        </View>

        {/* XP Progress */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.xpHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Jornada de XP</Text>
            <Text style={[styles.xpTotal, { color: colors.xp }]}>{stats.xp} XP total</Text>
          </View>
          <View style={styles.xpBarRow}>
            <Text style={[styles.xpMin, { color: colors.muted }]}>{currentLevelXP}</Text>
            <View style={[styles.xpBarBg, { backgroundColor: colors.border, flex: 1 }]}>
              <View
                style={[
                  styles.xpBarFill,
                  { width: `${Math.min(xpProgress * 100, 100)}%`, backgroundColor: colors.xp },
                ]}
              />
            </View>
            <Text style={[styles.xpMin, { color: colors.muted }]}>{xpForNext}</Text>
          </View>
          <Text style={[styles.xpHint, { color: colors.muted }]}>
            {xpForNext - stats.xp > 0
              ? `Faltam ${xpForNext - stats.xp} XP para ${LEVEL_NAMES[stats.level] ?? "o máximo"}`
              : "Nível máximo atingido!"}
          </Text>

          {/* Level Timeline */}
          <View style={styles.levelTimeline}>
            {LEVEL_NAMES.map((name, i) => {
              const lvl = i + 1;
              const reached = stats.level >= lvl;
              const lColor = getLevelColor(lvl);
              return (
                <View key={lvl} style={styles.levelStep}>
                  <View
                    style={[
                      styles.levelDot,
                      {
                        backgroundColor: reached ? lColor : colors.border,
                        borderColor: reached ? lColor : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 10, color: reached ? "#fff" : colors.muted, fontWeight: "700" }}>
                      {lvl}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.levelStepLabel,
                      { color: reached ? lColor : colors.muted, fontWeight: reached ? "700" : "400" },
                    ]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Stats Grid */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Estatísticas</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statItem, { backgroundColor: colors.surface2 }]}>
              <Text style={styles.statEmoji}>⚔️</Text>
              <Text style={[styles.statValue, { color: colors.secondary }]}>{stats.totalWorkouts}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Treinos</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.surface2 }]}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>{stats.streak}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Streak atual</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.surface2 }]}>
              <Text style={styles.statEmoji}>👑</Text>
              <Text style={[styles.statValue, { color: colors.warning }]}>{stats.maxStreak}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Recorde</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.surface2 }]}>
              <Text style={styles.statEmoji}>⏱️</Text>
              <Text style={[styles.statValue, { color: colors.success }]}>{stats.totalMinutes}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Minutos</Text>
            </View>
          </View>
        </View>

        {/* Heatmap */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Últimos 28 Dias</Text>
          <View style={styles.heatmap}>
            {heatmap.map((day, i) => (
              <View
                key={i}
                style={[
                  styles.heatCell,
                  {
                    backgroundColor:
                      day.count === 0
                        ? colors.border
                        : day.count === 1
                        ? colors.success + "66"
                        : colors.success,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.heatLegend}>
            <Text style={[styles.heatLegendText, { color: colors.muted }]}>Sem treino</Text>
            <View style={styles.heatLegendDots}>
              <View style={[styles.heatCell, { backgroundColor: colors.border }]} />
              <View style={[styles.heatCell, { backgroundColor: colors.success + "66" }]} />
              <View style={[styles.heatCell, { backgroundColor: colors.success }]} />
            </View>
            <Text style={[styles.heatLegendText, { color: colors.muted }]}>Treinou</Text>
          </View>
        </View>

        {/* Recent History */}
        {workoutHistory.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Histórico Recente</Text>
            {workoutHistory.slice(0, 5).map((log) => (
              <View
                key={log.id}
                style={[styles.historyItem, { borderBottomColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyName, { color: colors.foreground }]} numberOfLines={1}>
                    {log.workoutName}
                  </Text>
                  <Text style={[styles.historyDate, { color: colors.muted }]}>
                    {new Date(log.completedAt).toLocaleDateString("pt-BR")} · {log.durationMinutes} min
                  </Text>
                </View>
                <View style={[styles.historyXP, { backgroundColor: colors.xp + "22" }]}>
                  <Text style={[styles.historyXPText, { color: colors.xp }]}>+{log.xpEarned} XP</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Achievements */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.achievHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Conquistas</Text>
            <Text style={[styles.achievCount, { color: colors.muted }]}>
              {unlockedAchievements.length}/{achievements.length}
            </Text>
          </View>

          {unlockedAchievements.length > 0 && (
            <>
              <Text style={[styles.achievSection, { color: colors.success }]}>Desbloqueadas</Text>
              <View style={styles.achievGrid}>
                {unlockedAchievements.map((a) => (
                  <View key={a.id} style={[styles.achievCard, { backgroundColor: colors.success + "15", borderColor: colors.success + "44" }]}>
                    <Text style={styles.achievEmoji}>{a.icon}</Text>
                    <Text style={[styles.achievTitle, { color: colors.foreground }]} numberOfLines={2}>
                      {a.title}
                    </Text>
                    <Text style={[styles.achievDesc, { color: colors.muted }]} numberOfLines={2}>
                      {a.description}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {lockedAchievements.length > 0 && (
            <>
              <Text style={[styles.achievSection, { color: colors.muted }]}>Bloqueadas</Text>
              <View style={styles.achievGrid}>
                {lockedAchievements.map((a) => (
                  <View key={a.id} style={[styles.achievCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                    <Text style={[styles.achievEmoji, { opacity: 0.3 }]}>{a.icon}</Text>
                    <Text style={[styles.achievTitle, { color: colors.muted }]} numberOfLines={2}>
                      {a.title}
                    </Text>
                    <Text style={[styles.achievDesc, { color: colors.muted, opacity: 0.6 }]} numberOfLines={2}>
                      {a.description}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    margin: 16,
    marginTop: 8,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  xpHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  xpTotal: {
    fontSize: 14,
    fontWeight: "700",
  },
  xpBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  xpMin: {
    fontSize: 10,
    fontWeight: "600",
    width: 36,
  },
  xpBarBg: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  xpHint: {
    fontSize: 12,
    textAlign: "center",
  },
  levelTimeline: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  levelStep: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  levelDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  levelStepLabel: {
    fontSize: 9,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statItem: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statEmoji: {
    fontSize: 24,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  heatmap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  heatCell: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  heatLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  heatLegendText: {
    fontSize: 11,
  },
  heatLegendDots: {
    flexDirection: "row",
    gap: 4,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  historyName: {
    fontSize: 14,
    fontWeight: "700",
  },
  historyDate: {
    fontSize: 11,
    marginTop: 2,
  },
  historyXP: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyXPText: {
    fontSize: 12,
    fontWeight: "800",
  },
  achievHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  achievCount: {
    fontSize: 13,
    fontWeight: "600",
  },
  achievSection: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  achievGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  achievCard: {
    width: "47%",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    gap: 4,
    alignItems: "center",
  },
  achievEmoji: {
    fontSize: 28,
  },
  achievTitle: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  achievDesc: {
    fontSize: 10,
    textAlign: "center",
    lineHeight: 14,
  },
});
