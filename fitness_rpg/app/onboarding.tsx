import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  StyleSheet,
  Platform,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { GameStore, type FitnessGoal, type ExperienceLevel, type HeroClass } from "@/lib/game-store";
import { useColors } from "@/hooks/use-colors";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    emoji: "⚔️",
    title: "Bem-vindo ao\nFitness RPG",
    subtitle: "Transforme seus treinos em missões épicas. Ganhe XP, suba de nível e torne-se uma lenda.",
  },
  {
    emoji: "🔥",
    title: "Missões Diárias",
    subtitle: "Cada treino é uma missão. Complete-as, mantenha seu streak e desbloqueie conquistas incríveis.",
  },
  {
    emoji: "👑",
    title: "Crie Seu Herói",
    subtitle: "Escolha seu objetivo, defina seu nível e comece sua jornada rumo à lenda.",
  },
];

const GOALS: { id: FitnessGoal; label: string; emoji: string; desc: string }[] = [
  { id: "emagrecer",       label: "Emagrecer",       emoji: "🔥", desc: "Queimar gordura e definir o corpo" },
  { id: "condicionamento", label: "Condicionamento", emoji: "💨", desc: "Melhorar fôlego e resistência" },
  { id: "ambos",           label: "Ambos",           emoji: "⚡", desc: "Emagrecer e melhorar o condicionamento" },
];

const LEVELS: { id: ExperienceLevel; label: string; emoji: string; desc: string }[] = [
  { id: "iniciante",      label: "Iniciante",     emoji: "🌱", desc: "Pouca ou nenhuma experiência" },
  { id: "intermediario",  label: "Intermediário", emoji: "⚔️", desc: "Treino há alguns meses" },
  { id: "avancado",       label: "Avançado",      emoji: "🏆", desc: "Treino regular há mais de 1 ano" },
];

const CLASSES: { id: HeroClass; label: string; emoji: string; desc: string }[] = [
  { id: "Guerreiro", label: "Guerreiro", emoji: "🛡️", desc: "Focado em força e resistência" },
  { id: "Arqueiro",  label: "Arqueiro",  emoji: "🏹", desc: "Ágil e veloz, mestre do cardio" },
  { id: "Mago",      label: "Mago",      emoji: "🔮", desc: "Equilíbrio entre força e cardio" },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showHeroCreation, setShowHeroCreation] = useState(false);
  const [heroName, setHeroName] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<FitnessGoal>("ambos");
  const [selectedLevel, setSelectedLevel] = useState<ExperienceLevel>("iniciante");
  const [selectedClass, setSelectedClass] = useState<HeroClass>("Guerreiro");

  function goToSlide(index: number) {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setCurrentSlide(index);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function handleNext() {
    if (currentSlide < SLIDES.length - 1) {
      goToSlide(currentSlide + 1);
    } else {
      setShowHeroCreation(true);
    }
  }

  async function handleStart() {
    const name = heroName.trim() || "Herói";
    await GameStore.setHero({
      name,
      heroClass: selectedClass,
      goal: selectedGoal,
      experienceLevel: selectedLevel,
      createdAt: new Date().toISOString(),
    });
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.replace("/(tabs)");
  }

  if (showHeroCreation) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            Crie Seu Herói
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.muted }]}>
            Personalize sua jornada épica
          </Text>

          {/* Name Input */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Nome do Herói
            </Text>
            <TextInput
              value={heroName}
              onChangeText={setHeroName}
              placeholder="Digite seu nome..."
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              style={[
                styles.nameInput,
                { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            />
          </View>

          {/* Class Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Classe do Herói
            </Text>
            {CLASSES.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                onPress={() => {
                  setSelectedClass(cls.id);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: selectedClass === cls.id ? colors.primary + "33" : colors.surface,
                    borderColor: selectedClass === cls.id ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={styles.optionEmoji}>{cls.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: colors.foreground }]}>{cls.label}</Text>
                  <Text style={[styles.optionDesc, { color: colors.muted }]}>{cls.desc}</Text>
                </View>
                {selectedClass === cls.id && (
                  <Text style={{ color: colors.primary, fontSize: 20 }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Goal Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Objetivo Principal
            </Text>
            {GOALS.map((goal) => (
              <TouchableOpacity
                key={goal.id}
                onPress={() => {
                  setSelectedGoal(goal.id);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: selectedGoal === goal.id ? colors.secondary + "22" : colors.surface,
                    borderColor: selectedGoal === goal.id ? colors.secondary : colors.border,
                  },
                ]}
              >
                <Text style={styles.optionEmoji}>{goal.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: colors.foreground }]}>{goal.label}</Text>
                  <Text style={[styles.optionDesc, { color: colors.muted }]}>{goal.desc}</Text>
                </View>
                {selectedGoal === goal.id && (
                  <Text style={{ color: colors.secondary, fontSize: 20 }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Level Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Nível de Experiência
            </Text>
            {LEVELS.map((lvl) => (
              <TouchableOpacity
                key={lvl.id}
                onPress={() => {
                  setSelectedLevel(lvl.id);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: selectedLevel === lvl.id ? colors.success + "22" : colors.surface,
                    borderColor: selectedLevel === lvl.id ? colors.success : colors.border,
                  },
                ]}
              >
                <Text style={styles.optionEmoji}>{lvl.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: colors.foreground }]}>{lvl.label}</Text>
                  <Text style={[styles.optionDesc, { color: colors.muted }]}>{lvl.desc}</Text>
                </View>
                {selectedLevel === lvl.id && (
                  <Text style={{ color: colors.success, fontSize: 20 }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Start Button */}
          <TouchableOpacity
            onPress={handleStart}
            style={[styles.startButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.startButtonText, { color: "#fff" }]}>
              ⚔️  Iniciar Jornada
            </Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, index) => (
          <View key={index} style={[styles.slide, { width }]}>
            <Text style={styles.slideEmoji}>{slide.emoji}</Text>
            <Text style={[styles.slideTitle, { color: "#FFFFFF" }]}>{slide.title}</Text>
            <Text style={[styles.slideSubtitle, { color: "#8892A4" }]}>{slide.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dotsContainer}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === currentSlide ? "#FF6B35" : "#2A2A4A" },
            ]}
          />
        ))}
      </View>

      {/* Next Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={handleNext}
          style={[styles.nextButton, { backgroundColor: "#FF6B35" }]}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>
            {currentSlide === SLIDES.length - 1 ? "Criar Herói  →" : "Próximo  →"}
          </Text>
        </TouchableOpacity>
        {currentSlide > 0 && (
          <TouchableOpacity onPress={() => goToSlide(currentSlide - 1)} style={styles.backButton}>
            <Text style={{ color: "#8892A4", fontSize: 14 }}>← Voltar</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  slideEmoji: {
    fontSize: 80,
    marginBottom: 32,
  },
  slideTitle: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 40,
  },
  slideSubtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 12,
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  backButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  optionEmoji: {
    fontSize: 28,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  optionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  startButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: "800",
  },
});
