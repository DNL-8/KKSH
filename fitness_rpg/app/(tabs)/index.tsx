import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useGameStore } from "@/hooks/use-game-store";
import {
  getLevelName,
  getLevelColor,
  getXPProgress,
  getXPForNextLevel,
  XP_PER_LEVEL,
} from "@/lib/game-store";
import { getDailyWorkout, getTypeLabel, getTypeColor, getDifficultyLabel, getDifficultyColor } from "@/lib/workout-data";
import { useColors } from "@/hooks/use-colors";

export default function HomeScreen() {
  const colors = useColors();
  const state = useGameStore();
  const { hero, stats, onboardingComplete } = state;

  useFocusEffect(
    useCallback(() => {
      if (!onboardingComplete) {
        const timer = setTimeout(() => {
          router.replace("/onboarding");
        }, 50);
        return () => clearTimeout(timer);
      }
    }, [onboardingComplete])
  );

  if (!hero || !onboardingComplete) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.foreground, fontSize: 24 }}>⚔️</Text>
        </View>
      </ScreenContainer>
    );
  }

  const levelName = getLevelName(stats.level);
  const levelColor = getLevelColor(stats.level);
  const xpProgress = getXPProgress(stats.xp, stats.level);
  const xpForNext = getXPForNextLevel(stats.level);
  const currentLevelXP = XP_PER_LEVEL[stats.level - 1] ?? 0;
  const dailyWorkout = getDailyWorkout(stats.level, stats.totalWorkouts, hero.goal);
  const workoutTypeColor = getTypeColor(dailyWorkout.type);
  const difficultyColor = getDifficultyColor(dailyWorkout.difficulty);

  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];
  const today = new Date().getDay();
  const weekDaysOrdered = weekDays.slice(today + 1).concat(weekDays.slice(0, today + 1));

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.heroInfo}>
            <View style={[styles.avatarCircle, { backgroundColor: levelColor + "33", borderColor: levelColor }]}>
              <Text style={styles.avatarEmoji}>
                {hero.heroClass === "Guerreiro" ? "🛡️" : hero.heroClass === "Arqueiro" ? "🏹" : "🔮"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroName, { color: colors.foreground }]} numberOfLines={1}>
                {hero.name}
              </Text>
              <View style={styles.levelRow}>
                <View style={[styles.levelBadge, { backgroundColor: levelColor + "33" }]}>
                  <Text style={[styles.levelText, { color: levelColor }]}>
                    Nv. {stats.level} · {levelName}
                  </Text>
                </View>
                <Text style={[styles.classText, { color: colors.muted }]}>{hero.heroClass}</Text>
              </View>
            </View>
          </View>

          {/* XP Bar */}
          <View style={styles.xpSection}>
            <View style={styles.xpLabelRow}>
              <Text style={[styles.xpLabel, { color: colors.muted }]}>XP</Text>
              <Text style={[styles.xpValue, { color: colors.xp }]}>
                {stats.xp - currentLevelXP} / {xpForNext - currentLevelXP}
              </Text>
            </View>
            <View style={[styles.xpBarBg, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.xpBarFill,
                  {
                    width: `${Math.min(xpProgress * 100, 100)}%`,
                    backgroundColor: colors.xp,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.streak}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Streak</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={styles.statEmoji}>⚔️</Text>
            <Text style={[styles.statValue, { color: colors.secondary }]}>{stats.totalWorkouts}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Treinos</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={styles.statEmoji}>⏱️</Text>
            <Text style={[styles.statValue, { color: colors.success }]}>{stats.totalMinutes}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Minutos</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={styles.statEmoji}>🏆</Text>
            <Text style={[styles.statValue, { color: colors.warning }]}>{stats.maxStreak}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Recorde</Text>
          </View>
        </View>

        {/* ── Weekly Activity ── */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Semana Atual</Text>
          <View style={styles.weekRow}>
            {stats.weeklyWorkouts.map((done, i) => (
              <View key={i} style={styles.dayItem}>
                <View
                  style={[
                    styles.dayDot,
                    {
                      backgroundColor: done ? colors.success : colors.border,
                      borderColor: i === 6 ? colors.primary : "transparent",
                      borderWidth: i === 6 ? 2 : 0,
                    },
                  ]}
                />
                <Text style={[styles.dayLabel, { color: i === 6 ? colors.primary : colors.muted }]}>
                  {weekDaysOrdered[i]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Daily Mission Card ── */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
          <View style={styles.missionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Missão do Dia</Text>
            <View style={[styles.xpBadge, { backgroundColor: colors.xp + "33" }]}>
              <Text style={[styles.xpBadgeText, { color: colors.xp }]}>+{dailyWorkout.xpReward} XP</Text>
            </View>
          </View>

          <View style={[styles.missionCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <View style={styles.missionTop}>
              <Text style={styles.missionEmoji}>{dailyWorkout.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.missionName, { color: colors.foreground }]}>{dailyWorkout.name}</Text>
                <Text style={[styles.missionSubtitle, { color: colors.muted }]}>{dailyWorkout.subtitle}</Text>
              </View>
            </View>

            <View style={styles.missionTags}>
              <View style={[styles.tag, { backgroundColor: workoutTypeColor + "22" }]}>
                <Text style={[styles.tagText, { color: workoutTypeColor }]}>
                  {getTypeLabel(dailyWorkout.type)}
                </Text>
              </View>
              <View style={[styles.tag, { backgroundColor: difficultyColor + "22" }]}>
                <Text style={[styles.tagText, { color: difficultyColor }]}>
                  {getDifficultyLabel(dailyWorkout.difficulty)}
                </Text>
              </View>
              <View style={[styles.tag, { backgroundColor: colors.border }]}>
                <Text style={[styles.tagText, { color: colors.muted }]}>
                  ⏱ {dailyWorkout.durationMinutes} min
                </Text>
              </View>
              <View style={[styles.tag, { backgroundColor: colors.border }]}>
                <Text style={[styles.tagText, { color: colors.muted }]}>
                  {dailyWorkout.exercises.length} exercícios
                </Text>
              </View>
            </View>

            <Text style={[styles.missionDesc, { color: colors.muted }]}>
              {dailyWorkout.description}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: "/workout-session", params: { workoutId: dailyWorkout.id } });
            }}
            style={[styles.ctaButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaButtonText}>⚔️  Iniciar Missão</Text>
          </TouchableOpacity>
        </View>

        {/* ── Other Missions ── */}
        <View style={styles.otherMissionsHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Outras Missões</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(tabs)/workout");
          }}
          style={[styles.otherMissionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 28 }}>🗺️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[{ fontSize: 15, fontWeight: "700", color: colors.foreground }]}>
              Ver Todas as Missões
            </Text>
            <Text style={[{ fontSize: 12, color: colors.muted, marginTop: 2 }]}>
              Escolha seu próximo desafio
            </Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 20 }}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    margin: 16,
    borderRadius: 20,
    padding: 16,
  },
  heroInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 28,
  },
  heroName: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 12,
    fontWeight: "700",
  },
  classText: {
    fontSize: 12,
  },
  xpSection: {
    gap: 6,
  },
  xpLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  xpLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  xpValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  xpBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    gap: 4,
  },
  statEmoji: {
    fontSize: 18,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  sectionCard: {
    margin: 16,
    marginTop: 8,
    borderRadius: 20,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayItem: {
    alignItems: "center",
    gap: 4,
  },
  dayDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  missionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  xpBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  xpBadgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  missionCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
    gap: 10,
  },
  missionTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  missionEmoji: {
    fontSize: 36,
  },
  missionName: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  missionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  missionTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  missionDesc: {
    fontSize: 13,
    lineHeight: 20,
  },
  ctaButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  ctaButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
  otherMissionsHeader: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  otherMissionCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
});
