import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Animated,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { GameStore } from "@/lib/game-store";
import { getWorkoutById, type Exercise } from "@/lib/workout-data";
import { getTypeLabel, getTypeColor, getDifficultyLabel, getDifficultyColor } from "@/lib/workout-data";

export default function WorkoutSessionScreen() {
  useKeepAwake();
  const colors = useColors();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const workout = getWorkoutById(workoutId ?? "");

  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [leveledUp, setLeveledUp] = useState(false);
  const [newLevel, setNewLevel] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const xpAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (started) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [started]);

  if (!workout) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.foreground, fontSize: 18 }}>Missão não encontrada</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.primary }}>← Voltar</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const typeColor = getTypeColor(workout.type);
  const diffColor = getDifficultyColor(workout.difficulty);
  const completedCount = completed.size;
  const totalExercises = workout.exercises.length;
  const progress = totalExercises > 0 ? completedCount / totalExercises : 0;

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function toggleExercise(id: string) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleFinish() {
    if (timerRef.current) clearInterval(timerRef.current);
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const xp = Math.round(workout!.xpReward * (completedCount / totalExercises));

    const result = await GameStore.completeWorkout({
      workoutId: workout!.id,
      workoutName: workout!.name,
      durationMinutes,
      xpEarned: xp,
      exercisesCompleted: completedCount,
      totalExercises,
    });

    setXpGained(xp);
    setLeveledUp(result.leveledUp);
    setNewLevel(result.newLevel);
    setShowComplete(true);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Animate XP
    Animated.sequence([
      Animated.timing(xpAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.delay(2000),
    ]).start();
  }

  function handleDone() {
    setShowComplete(false);
    router.replace("/(tabs)");
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={{ color: colors.muted, fontSize: 16 }}>← Voltar</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {workout.icon} {workout.name.replace("Missão: ", "")}
          </Text>
          <View style={styles.headerTags}>
            <View style={[styles.tag, { backgroundColor: typeColor + "22" }]}>
              <Text style={[styles.tagText, { color: typeColor }]}>{getTypeLabel(workout.type)}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: diffColor + "22" }]}>
              <Text style={[styles.tagText, { color: diffColor }]}>{getDifficultyLabel(workout.difficulty)}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.xpBadge, { backgroundColor: colors.xp + "33" }]}>
          <Text style={[styles.xpBadgeText, { color: colors.xp }]}>+{workout.xpReward}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress * 100}%`, backgroundColor: colors.success },
          ]}
        />
      </View>

      {/* Timer + Progress */}
      <View style={styles.timerRow}>
        <View style={[styles.timerCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.timerLabel, { color: colors.muted }]}>Tempo</Text>
          <Text style={[styles.timerValue, { color: colors.primary }]}>{formatTime(elapsedSeconds)}</Text>
        </View>
        <View style={[styles.timerCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.timerLabel, { color: colors.muted }]}>Progresso</Text>
          <Text style={[styles.timerValue, { color: colors.success }]}>
            {completedCount}/{totalExercises}
          </Text>
        </View>
        <View style={[styles.timerCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.timerLabel, { color: colors.muted }]}>XP</Text>
          <Text style={[styles.timerValue, { color: colors.xp }]}>+{workout.xpReward}</Text>
        </View>
      </View>

      {/* Start Banner */}
      {!started && (
        <TouchableOpacity
          onPress={() => {
            setStarted(true);
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          style={[styles.startBanner, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
        >
          <Text style={styles.startBannerText}>▶  Iniciar Cronômetro</Text>
        </TouchableOpacity>
      )}

      {/* Exercise List */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.exercisesTitle, { color: colors.muted }]}>EXERCÍCIOS</Text>
        {workout.exercises.map((exercise: Exercise, index: number) => {
          const isDone = completed.has(exercise.id + index);
          return (
            <TouchableOpacity
              key={exercise.id + index}
              onPress={() => toggleExercise(exercise.id + index)}
              style={[
                styles.exerciseCard,
                {
                  backgroundColor: isDone ? colors.success + "15" : colors.surface,
                  borderColor: isDone ? colors.success : colors.border,
                },
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.exerciseLeft}>
                <View
                  style={[
                    styles.checkCircle,
                    {
                      backgroundColor: isDone ? colors.success : "transparent",
                      borderColor: isDone ? colors.success : colors.border,
                    },
                  ]}
                >
                  {isDone && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>✓</Text>}
                </View>
                <Text style={styles.exerciseEmoji}>{exercise.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.exerciseName,
                      {
                        color: isDone ? colors.success : colors.foreground,
                        textDecorationLine: isDone ? "line-through" : "none",
                      },
                    ]}
                  >
                    {exercise.name}
                  </Text>
                  <Text style={[styles.exerciseDetail, { color: colors.muted }]}>
                    {exercise.sets}x{" "}
                    {exercise.reps
                      ? `${exercise.reps} reps`
                      : `${exercise.durationSeconds}s`}
                    {" · "}Descanso: {exercise.restSeconds}s
                  </Text>
                  <Text style={[styles.exerciseMuscles, { color: colors.muted }]}>
                    {exercise.muscleGroups.join(", ")}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Tips */}
        {workout.exercises.length > 0 && (
          <View style={[styles.tipsCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Text style={[styles.tipsTitle, { color: colors.secondary }]}>💡 Dicas do Exercício</Text>
            {workout.exercises[0].tips.map((tip, i) => (
              <Text key={i} style={[styles.tipText, { color: colors.muted }]}>
                • {tip}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Finish Button */}
      <View style={[styles.finishContainer, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          onPress={handleFinish}
          style={[
            styles.finishBtn,
            {
              backgroundColor: completedCount > 0 ? colors.primary : colors.border,
            },
          ]}
          activeOpacity={0.85}
          disabled={completedCount === 0}
        >
          <Text style={[styles.finishBtnText, { color: completedCount > 0 ? "#fff" : colors.muted }]}>
            {completedCount === totalExercises
              ? "🏆  Missão Completa!"
              : `✓  Concluir (${completedCount}/${totalExercises})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Completion Modal */}
      <Modal visible={showComplete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={styles.modalEmoji}>{leveledUp ? "🎉" : "⚔️"}</Text>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {leveledUp ? "SUBIU DE NÍVEL!" : "Missão Completa!"}
            </Text>
            {leveledUp && (
              <Text style={[styles.modalLevel, { color: colors.secondary }]}>
                Nível {newLevel} alcançado!
              </Text>
            )}
            <View style={[styles.xpGainRow, { backgroundColor: colors.xp + "22" }]}>
              <Text style={[styles.xpGainText, { color: colors.xp }]}>+{xpGained} XP</Text>
            </View>
            <Text style={[styles.modalSub, { color: colors.muted }]}>
              {completedCount}/{totalExercises} exercícios · {formatTime(elapsedSeconds)}
            </Text>
            <TouchableOpacity
              onPress={handleDone}
              style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
            >
              <Text style={styles.modalBtnText}>Continuar →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  headerTags: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "700",
  },
  xpBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  xpBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  progressBg: {
    height: 4,
    width: "100%",
  },
  progressFill: {
    height: "100%",
  },
  timerRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  timerCard: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 2,
  },
  timerValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  startBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  startBannerText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  exercisesTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 4,
  },
  exerciseCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
  },
  exerciseLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseEmoji: {
    fontSize: 24,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  exerciseDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  exerciseMuscles: {
    fontSize: 11,
    marginTop: 2,
  },
  tipsCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 6,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  tipText: {
    fontSize: 12,
    lineHeight: 18,
  },
  finishContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
  },
  finishBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  finishBtnText: {
    fontSize: 16,
    fontWeight: "800",
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
    padding: 32,
    alignItems: "center",
    width: "100%",
    gap: 12,
  },
  modalEmoji: {
    fontSize: 64,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  modalLevel: {
    fontSize: 18,
    fontWeight: "700",
  },
  xpGainRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
  },
  xpGainText: {
    fontSize: 24,
    fontWeight: "800",
  },
  modalSub: {
    fontSize: 14,
    textAlign: "center",
  },
  modalBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  modalBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
