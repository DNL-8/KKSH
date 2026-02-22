import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useGameStore } from "@/hooks/use-game-store";
import { WORKOUTS, getTypeLabel, getTypeColor, getDifficultyLabel, getDifficultyColor } from "@/lib/workout-data";

export default function WorkoutScreen() {
  const colors = useColors();
  const state = useGameStore();
  const { stats } = state;

  return (
    <ScreenContainer>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>Missões</Text>
        <View style={[styles.xpBadge, { backgroundColor: colors.xp + "33" }]}>
          <Text style={[styles.xpText, { color: colors.xp }]}>Nv. {stats.level}</Text>
        </View>
      </View>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Escolha sua próxima missão épica
      </Text>

      <FlatList
        data={WORKOUTS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const typeColor = getTypeColor(item.type);
          const diffColor = getDifficultyColor(item.difficulty);
          return (
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({ pathname: "/workout-session", params: { workoutId: item.id } });
              }}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardEmoji}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.cardSubtitle, { color: colors.muted }]}>{item.subtitle}</Text>
                </View>
                <View style={[styles.xpReward, { backgroundColor: colors.xp + "22" }]}>
                  <Text style={[styles.xpRewardText, { color: colors.xp }]}>+{item.xpReward} XP</Text>
                </View>
              </View>

              <View style={styles.cardTags}>
                <View style={[styles.tag, { backgroundColor: typeColor + "22" }]}>
                  <Text style={[styles.tagText, { color: typeColor }]}>{getTypeLabel(item.type)}</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: diffColor + "22" }]}>
                  <Text style={[styles.tagText, { color: diffColor }]}>{getDifficultyLabel(item.difficulty)}</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: colors.border }]}>
                  <Text style={[styles.tagText, { color: colors.muted }]}>⏱ {item.durationMinutes} min</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: colors.border }]}>
                  <Text style={[styles.tagText, { color: colors.muted }]}>{item.exercises.length} exercícios</Text>
                </View>
              </View>

              <Text style={[styles.cardDesc, { color: colors.muted }]} numberOfLines={2}>
                {item.description}
              </Text>

              <View style={[styles.startBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
                <Text style={[styles.startBtnText, { color: colors.primary }]}>⚔️  Iniciar Missão</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
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
  xpBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  xpText: {
    fontSize: 13,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardEmoji: {
    fontSize: 36,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  xpReward: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  xpRewardText: {
    fontSize: 12,
    fontWeight: "800",
  },
  cardTags: {
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
  cardDesc: {
    fontSize: 13,
    lineHeight: 20,
  },
  startBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  startBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
