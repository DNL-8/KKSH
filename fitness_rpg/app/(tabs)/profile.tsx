import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Modal,
} from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useGameStore } from "@/hooks/use-game-store";
import { GameStore, getLevelName, getLevelColor, getXPProgress, getXPForNextLevel, XP_PER_LEVEL } from "@/lib/game-store";

const GOAL_LABELS: Record<string, string> = {
  emagrecer: "Emagrecer",
  condicionamento: "Condicionamento",
  ambos: "Emagrecer + Condicionamento",
};

const LEVEL_LABELS: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

const ATTRIBUTE_LABELS = [
  { key: "força",       emoji: "💪", label: "Força",       color: "#FF6B35" },
  { key: "resistência", emoji: "❤️", label: "Resistência", color: "#F87171" },
  { key: "agilidade",   emoji: "⚡", label: "Agilidade",   color: "#FBBF24" },
  { key: "disciplina",  emoji: "🛡️", label: "Disciplina",  color: "#A855F7" },
];

export default function ProfileScreen() {
  const colors = useColors();
  const state = useGameStore();
  const { hero, stats, achievements } = state;
  const [showResetModal, setShowResetModal] = useState(false);

  const levelName = getLevelName(stats.level);
  const levelColor = getLevelColor(stats.level);
  const xpProgress = getXPProgress(stats.xp, stats.level);
  const xpForNext = getXPForNextLevel(stats.level);
  const currentLevelXP = XP_PER_LEVEL[stats.level - 1] ?? 0;

  // Derived attributes from stats
  const totalWorkouts = stats.totalWorkouts;
  const attrForce = Math.min(100, Math.round((totalWorkouts * 5) + (stats.level * 10)));
  const attrEndurance = Math.min(100, Math.round((stats.totalMinutes / 2) + (stats.streak * 3)));
  const attrAgility = Math.min(100, Math.round((stats.totalWorkouts * 3) + (stats.maxStreak * 5)));
  const attrDiscipline = Math.min(100, Math.round((stats.streak * 8) + (stats.maxStreak * 4)));
  const attributes = [attrForce, attrEndurance, attrAgility, attrDiscipline];

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

  async function handleReset() {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await GameStore.resetProgress();
    setShowResetModal(false);
  }

  async function handleFullReset() {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    await GameStore.clearAll();
    setShowResetModal(false);
    router.replace("/onboarding");
  }

  if (!hero) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.foreground }}>Carregando perfil...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.avatarLarge, { backgroundColor: levelColor + "33", borderColor: levelColor }]}>
            <Text style={styles.avatarEmoji}>
              {hero.heroClass === "Guerreiro" ? "🛡️" : hero.heroClass === "Arqueiro" ? "🏹" : "🔮"}
            </Text>
          </View>
          <Text style={[styles.heroName, { color: colors.foreground }]}>{hero.name}</Text>
          <View style={[styles.levelBadge, { backgroundColor: levelColor + "33" }]}>
            <Text style={[styles.levelBadgeText, { color: levelColor }]}>
              Nível {stats.level} · {levelName}
            </Text>
          </View>
          <Text style={[styles.heroClass, { color: colors.muted }]}>
            {hero.heroClass} · {GOAL_LABELS[hero.goal]} · {LEVEL_LABELS[hero.experienceLevel]}
          </Text>

          {/* XP Bar */}
          <View style={styles.xpSection}>
            <View style={styles.xpRow}>
              <Text style={[styles.xpLabel, { color: colors.muted }]}>XP</Text>
              <Text style={[styles.xpValue, { color: colors.xp }]}>
                {stats.xp - currentLevelXP} / {xpForNext - currentLevelXP}
              </Text>
            </View>
            <View style={[styles.xpBarBg, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.xpBarFill,
                  { width: `${Math.min(xpProgress * 100, 100)}%`, backgroundColor: colors.xp },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Attributes */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Atributos do Herói</Text>
          {ATTRIBUTE_LABELS.map((attr, i) => (
            <View key={attr.key} style={styles.attrRow}>
              <Text style={styles.attrEmoji}>{attr.emoji}</Text>
              <Text style={[styles.attrLabel, { color: colors.foreground }]}>{attr.label}</Text>
              <View style={[styles.attrBarBg, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.attrBarFill,
                    { width: `${attributes[i]}%`, backgroundColor: attr.color },
                  ]}
                />
              </View>
              <Text style={[styles.attrValue, { color: attr.color }]}>{attributes[i]}</Text>
            </View>
          ))}
        </View>

        {/* Stats */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Ficha do Herói</Text>
          <View style={styles.statsGrid}>
            {[
              { label: "Treinos", value: stats.totalWorkouts, emoji: "⚔️", color: colors.secondary },
              { label: "Streak", value: stats.streak, emoji: "🔥", color: colors.primary },
              { label: "Recorde", value: stats.maxStreak, emoji: "👑", color: colors.warning },
              { label: "Minutos", value: stats.totalMinutes, emoji: "⏱️", color: colors.success },
              { label: "XP Total", value: stats.xp, emoji: "✨", color: colors.xp },
              { label: "Conquistas", value: `${unlockedCount}/${achievements.length}`, emoji: "🏆", color: colors.warning },
            ].map((item) => (
              <View key={item.label} style={[styles.statItem, { backgroundColor: colors.surface2 }]}>
                <Text style={styles.statEmoji}>{item.emoji}</Text>
                <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Achievements Preview */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.achievHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Conquistas</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/progress")}
              activeOpacity={0.7}
            >
              <Text style={[styles.seeAll, { color: colors.primary }]}>Ver todas →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.achievRow}>
            {achievements.slice(0, 4).map((a) => (
              <View
                key={a.id}
                style={[
                  styles.achievBadge,
                  {
                    backgroundColor: a.unlockedAt ? colors.success + "15" : colors.surface2,
                    borderColor: a.unlockedAt ? colors.success + "44" : colors.border,
                    opacity: a.unlockedAt ? 1 : 0.4,
                  },
                ]}
              >
                <Text style={[styles.achievEmoji, { opacity: a.unlockedAt ? 1 : 0.3 }]}>{a.icon}</Text>
                <Text style={[styles.achievTitle, { color: a.unlockedAt ? colors.foreground : colors.muted }]} numberOfLines={2}>
                  {a.title}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Settings */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Configurações</Text>

          <TouchableOpacity
            onPress={() => setShowResetModal(true)}
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Text style={styles.settingEmoji}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.warning }]}>Resetar Progresso</Text>
              <Text style={[styles.settingDesc, { color: colors.muted }]}>Zera XP, nível e histórico</Text>
            </View>
            <Text style={{ color: colors.muted }}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/progress");
            }}
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            activeOpacity={0.7}
          >
            <Text style={styles.settingEmoji}>📊</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>Ver Progresso Completo</Text>
              <Text style={[styles.settingDesc, { color: colors.muted }]}>Histórico e conquistas</Text>
            </View>
            <Text style={{ color: colors.muted }}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Reset Modal */}
      <Modal visible={showResetModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={styles.modalEmoji}>⚠️</Text>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Resetar Progresso?</Text>
            <Text style={[styles.modalDesc, { color: colors.muted }]}>
              Isso irá zerar seu XP, nível, streak e histórico de treinos. Seu perfil de herói será mantido.
            </Text>
            <TouchableOpacity
              onPress={handleReset}
              style={[styles.modalBtn, { backgroundColor: colors.warning }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.modalBtnText, { color: "#000" }]}>Resetar Progresso</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleFullReset}
              style={[styles.modalBtn, { backgroundColor: colors.error }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.modalBtnText, { color: "#fff" }]}>Recomeçar do Zero</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowResetModal(false)}
              style={[styles.modalCancelBtn]}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCancelText, { color: colors.muted }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    margin: 16,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarEmoji: {
    fontSize: 36,
  },
  heroName: {
    fontSize: 24,
    fontWeight: "800",
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  levelBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  heroClass: {
    fontSize: 12,
    textAlign: "center",
  },
  xpSection: {
    width: "100%",
    gap: 6,
    marginTop: 4,
  },
  xpRow: {
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
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  attrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attrEmoji: {
    fontSize: 16,
    width: 24,
  },
  attrLabel: {
    fontSize: 13,
    fontWeight: "600",
    width: 90,
  },
  attrBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  attrBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  attrValue: {
    fontSize: 12,
    fontWeight: "700",
    width: 28,
    textAlign: "right",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statItem: {
    width: "30%",
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    gap: 2,
  },
  statEmoji: {
    fontSize: 20,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  achievHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "600",
  },
  achievRow: {
    flexDirection: "row",
    gap: 8,
  },
  achievBadge: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    alignItems: "center",
    gap: 4,
  },
  achievEmoji: {
    fontSize: 24,
  },
  achievTitle: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  settingEmoji: {
    fontSize: 20,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  settingDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    width: "100%",
    gap: 12,
  },
  modalEmoji: {
    fontSize: 48,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  modalDesc: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  modalBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalCancelBtn: {
    paddingVertical: 8,
  },
  modalCancelText: {
    fontSize: 14,
  },
});
