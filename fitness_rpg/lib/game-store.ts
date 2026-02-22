import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ───────────────────────────────────────────────────────────────────

export type HeroClass = "Guerreiro" | "Arqueiro" | "Mago";
export type FitnessGoal = "emagrecer" | "condicionamento" | "ambos";
export type ExperienceLevel = "iniciante" | "intermediario" | "avancado";

export interface HeroProfile {
  name: string;
  heroClass: HeroClass;
  goal: FitnessGoal;
  experienceLevel: ExperienceLevel;
  createdAt: string;
}

export interface GameStats {
  xp: number;
  level: number;
  streak: number;
  maxStreak: number;
  totalWorkouts: number;
  totalMinutes: number;
  lastWorkoutDate: string | null;
  streakProtectionUsed: boolean;
  weeklyWorkouts: number[];   // last 7 days — 0 or 1
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  workoutName: string;
  completedAt: string;
  durationMinutes: number;
  xpEarned: number;
  exercisesCompleted: number;
  totalExercises: number;
}

export interface GameState {
  hero: HeroProfile | null;
  stats: GameStats;
  achievements: Achievement[];
  workoutHistory: WorkoutLog[];
  onboardingComplete: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "fitness_rpg_state";

export const XP_PER_LEVEL = [0, 200, 500, 1000, 2000, 4000];
export const LEVEL_NAMES = ["Recruta", "Guerreiro", "Cavaleiro", "Campeão", "Lendário", "Mestre"];
export const LEVEL_COLORS = ["#8892A4", "#4ADE80", "#60A5FA", "#A855F7", "#FFD700", "#FF6B35"];

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_blood",    title: "Primeiro Sangue",       description: "Complete seu 1º treino",           icon: "⚔️",  unlockedAt: null },
  { id: "week_warrior",   title: "Guerreiro da Semana",   description: "7 dias seguidos de treino",        icon: "🔥",  unlockedAt: null },
  { id: "month_master",   title: "Mestre do Mês",         description: "30 dias seguidos de treino",       icon: "👑",  unlockedAt: null },
  { id: "fat_burner",     title: "Queimador de Gordura",  description: "Complete 10 treinos cardio",       icon: "💪",  unlockedAt: null },
  { id: "iron_will",      title: "Vontade de Ferro",      description: "Complete 10 treinos de força",     icon: "🛡️",  unlockedAt: null },
  { id: "level_5",        title: "Lendário",              description: "Alcance o nível 5",                icon: "⭐",  unlockedAt: null },
  { id: "workouts_10",    title: "Veterano",              description: "Complete 10 treinos no total",     icon: "🏅",  unlockedAt: null },
  { id: "workouts_50",    title: "Elite",                 description: "Complete 50 treinos no total",     icon: "🏆",  unlockedAt: null },
];

const DEFAULT_STATS: GameStats = {
  xp: 0,
  level: 1,
  streak: 0,
  maxStreak: 0,
  totalWorkouts: 0,
  totalMinutes: 0,
  lastWorkoutDate: null,
  streakProtectionUsed: false,
  weeklyWorkouts: [0, 0, 0, 0, 0, 0, 0],
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function getLevelForXP(xp: number): number {
  let level = 1;
  for (let i = XP_PER_LEVEL.length - 1; i >= 0; i--) {
    if (xp >= XP_PER_LEVEL[i]) {
      level = i + 1;
      break;
    }
  }
  return Math.min(level, 5);
}

export function getXPForNextLevel(level: number): number {
  return XP_PER_LEVEL[Math.min(level, XP_PER_LEVEL.length - 1)] ?? 9999;
}

export function getXPProgress(xp: number, level: number): number {
  const currentLevelXP = XP_PER_LEVEL[level - 1] ?? 0;
  const nextLevelXP = XP_PER_LEVEL[level] ?? XP_PER_LEVEL[XP_PER_LEVEL.length - 1];
  if (nextLevelXP === currentLevelXP) return 1;
  return (xp - currentLevelXP) / (nextLevelXP - currentLevelXP);
}

export function getLevelName(level: number): string {
  return LEVEL_NAMES[level - 1] ?? "Recruta";
}

export function getLevelColor(level: number): string {
  return LEVEL_COLORS[level - 1] ?? "#8892A4";
}

export function isToday(dateStr: string): boolean {
  const today = new Date().toDateString();
  return new Date(dateStr).toDateString() === today;
}

export function isYesterday(dateStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return new Date(dateStr).toDateString() === yesterday.toDateString();
}

export function getTodayString(): string {
  return new Date().toISOString();
}

// ─── Store ────────────────────────────────────────────────────────────────────

let _state: GameState | null = null;
let _listeners: Array<() => void> = [];

function notify() {
  _listeners.forEach((fn) => fn());
}

export const GameStore = {
  subscribe(fn: () => void) {
    _listeners.push(fn);
    return () => {
      _listeners = _listeners.filter((l) => l !== fn);
    };
  },

  getState(): GameState {
    return _state ?? {
      hero: null,
      stats: { ...DEFAULT_STATS },
      achievements: ACHIEVEMENTS.map((a) => ({ ...a })),
      workoutHistory: [],
      onboardingComplete: false,
    };
  },

  async load(): Promise<GameState> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GameState;
        // Merge achievements to include new ones added later
        const mergedAchievements = ACHIEVEMENTS.map((a) => {
          const existing = parsed.achievements?.find((e) => e.id === a.id);
          return existing ?? a;
        });
        _state = { ...parsed, achievements: mergedAchievements };
      } else {
        _state = {
          hero: null,
          stats: { ...DEFAULT_STATS },
          achievements: ACHIEVEMENTS.map((a) => ({ ...a })),
          workoutHistory: [],
          onboardingComplete: false,
        };
      }
    } catch {
      _state = {
        hero: null,
        stats: { ...DEFAULT_STATS },
        achievements: ACHIEVEMENTS.map((a) => ({ ...a })),
        workoutHistory: [],
        onboardingComplete: false,
      };
    }
    return _state;
  },

  async save(): Promise<void> {
    if (_state) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    }
  },

  async setHero(hero: HeroProfile): Promise<void> {
    const state = GameStore.getState();
    _state = { ...state, hero, onboardingComplete: true };
    await GameStore.save();
    notify();
  },

  async completeWorkout(params: {
    workoutId: string;
    workoutName: string;
    durationMinutes: number;
    xpEarned: number;
    exercisesCompleted: number;
    totalExercises: number;
  }): Promise<{ leveledUp: boolean; newLevel: number; newAchievements: Achievement[] }> {
    const state = GameStore.getState();
    const stats = { ...state.stats };
    const today = getTodayString();

    // Update XP and level
    const oldLevel = stats.level;
    stats.xp += params.xpEarned;
    stats.level = getLevelForXP(stats.xp);
    const leveledUp = stats.level > oldLevel;

    // Update streak
    if (stats.lastWorkoutDate) {
      if (isToday(stats.lastWorkoutDate)) {
        // Already worked out today — no streak change
      } else if (isYesterday(stats.lastWorkoutDate)) {
        stats.streak += 1;
      } else {
        stats.streak = 1;
      }
    } else {
      stats.streak = 1;
    }
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
    stats.lastWorkoutDate = today;
    stats.totalWorkouts += 1;
    stats.totalMinutes += params.durationMinutes;

    // Update weekly workouts (shift array and mark today)
    const weekly = [...stats.weeklyWorkouts];
    weekly.shift();
    weekly.push(1);
    stats.weeklyWorkouts = weekly;

    // Add XP bonus for streaks
    if (stats.streak === 3) stats.xp += 50;
    if (stats.streak === 7) stats.xp += 100;

    // Log workout
    const log: WorkoutLog = {
      id: `${Date.now()}`,
      workoutId: params.workoutId,
      workoutName: params.workoutName,
      completedAt: today,
      durationMinutes: params.durationMinutes,
      xpEarned: params.xpEarned,
      exercisesCompleted: params.exercisesCompleted,
      totalExercises: params.totalExercises,
    };

    // Check achievements
    const achievements = state.achievements.map((a) => ({ ...a }));
    const newAchievements: Achievement[] = [];

    const checkAndUnlock = (id: string) => {
      const a = achievements.find((x) => x.id === id);
      if (a && !a.unlockedAt) {
        a.unlockedAt = today;
        newAchievements.push(a);
      }
    };

    if (stats.totalWorkouts >= 1)  checkAndUnlock("first_blood");
    if (stats.streak >= 7)         checkAndUnlock("week_warrior");
    if (stats.streak >= 30)        checkAndUnlock("month_master");
    if (stats.totalWorkouts >= 10) checkAndUnlock("workouts_10");
    if (stats.totalWorkouts >= 50) checkAndUnlock("workouts_50");
    if (stats.level >= 5)          checkAndUnlock("level_5");

    _state = {
      ...state,
      stats,
      achievements,
      workoutHistory: [log, ...state.workoutHistory].slice(0, 100),
    };
    await GameStore.save();
    notify();

    return { leveledUp, newLevel: stats.level, newAchievements };
  },

  async resetProgress(): Promise<void> {
    const state = GameStore.getState();
    _state = {
      ...state,
      stats: { ...DEFAULT_STATS },
      achievements: ACHIEVEMENTS.map((a) => ({ ...a })),
      workoutHistory: [],
    };
    await GameStore.save();
    notify();
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
    _state = null;
    notify();
  },
};
