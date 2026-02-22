// ─── Types ───────────────────────────────────────────────────────────────────

export type WorkoutType = "cardio" | "forca" | "hiit" | "mobilidade";
export type Difficulty = "iniciante" | "intermediario" | "avancado";

export interface Exercise {
  id: string;
  name: string;
  description: string;
  sets: number;
  reps?: number;
  durationSeconds?: number;
  restSeconds: number;
  muscleGroups: string[];
  icon: string;
  tips: string[];
}

export interface Workout {
  id: string;
  name: string;
  subtitle: string;
  type: WorkoutType;
  difficulty: Difficulty;
  durationMinutes: number;
  xpReward: number;
  exercises: Exercise[];
  description: string;
  icon: string;
}

// ─── Exercises ────────────────────────────────────────────────────────────────

const EXERCISES: Record<string, Exercise> = {
  agachamento: {
    id: "agachamento",
    name: "Agachamento",
    description: "Posição de pé, pés na largura dos ombros. Desça como se fosse sentar.",
    sets: 3, reps: 15, restSeconds: 45,
    muscleGroups: ["Quadríceps", "Glúteos", "Panturrilha"],
    icon: "🦵",
    tips: ["Mantenha o joelho alinhado com o pé", "Desça até a coxa ficar paralela ao chão", "Não deixe o joelho passar da ponta do pé"],
  },
  flexao: {
    id: "flexao",
    name: "Flexão de Braço",
    description: "Apoio nas mãos e pés. Desça o peito até quase tocar o chão.",
    sets: 3, reps: 10, restSeconds: 60,
    muscleGroups: ["Peitoral", "Tríceps", "Ombro"],
    icon: "💪",
    tips: ["Corpo reto como uma prancha", "Cotovelos a 45° do corpo", "Respire ao descer, expire ao subir"],
  },
  abdominal: {
    id: "abdominal",
    name: "Abdominal Crunch",
    description: "Deitado de costas, joelhos dobrados. Suba o tronco contraindo o abdômen.",
    sets: 3, reps: 20, restSeconds: 30,
    muscleGroups: ["Abdômen"],
    icon: "🔥",
    tips: ["Não force o pescoço", "Contraia o abdômen no topo", "Movimento controlado"],
  },
  prancha: {
    id: "prancha",
    name: "Prancha Isométrica",
    description: "Apoio nos antebraços e pontas dos pés. Mantenha o corpo reto.",
    sets: 3, durationSeconds: 30, restSeconds: 30,
    muscleGroups: ["Core", "Ombros", "Glúteos"],
    icon: "🛡️",
    tips: ["Quadril alinhado com o corpo", "Respire normalmente", "Olhar para o chão"],
  },
  burpee: {
    id: "burpee",
    name: "Burpee",
    description: "Agache, apoie as mãos, salte para prancha, faça flexão, volte e salte.",
    sets: 3, reps: 8, restSeconds: 60,
    muscleGroups: ["Corpo inteiro"],
    icon: "⚡",
    tips: ["Movimento fluido e contínuo", "Pule com os braços acima da cabeça", "Modifique sem o salto se necessário"],
  },
  mountain_climber: {
    id: "mountain_climber",
    name: "Mountain Climber",
    description: "Em posição de prancha, alterne puxando os joelhos ao peito rapidamente.",
    sets: 3, durationSeconds: 30, restSeconds: 30,
    muscleGroups: ["Core", "Cardio", "Ombros"],
    icon: "🏔️",
    tips: ["Quadril baixo e estável", "Movimento rápido e alternado", "Respire de forma rítmica"],
  },
  jumping_jack: {
    id: "jumping_jack",
    name: "Jumping Jack",
    description: "Salte abrindo pernas e braços simultaneamente, depois feche.",
    sets: 3, durationSeconds: 45, restSeconds: 20,
    muscleGroups: ["Cardio", "Panturrilha", "Ombros"],
    icon: "⭐",
    tips: ["Aterrisse suavemente", "Braços acima da cabeça no topo", "Mantenha o ritmo constante"],
  },
  afundo: {
    id: "afundo",
    name: "Avanço (Afundo)",
    description: "Um pé à frente, desça o joelho traseiro em direção ao chão.",
    sets: 3, reps: 12, restSeconds: 45,
    muscleGroups: ["Quadríceps", "Glúteos", "Isquiotibiais"],
    icon: "🦶",
    tips: ["Joelho dianteiro não ultrapassa o pé", "Tronco ereto", "Alterne as pernas"],
  },
  glute_bridge: {
    id: "glute_bridge",
    name: "Ponte de Glúteos",
    description: "Deitado de costas, joelhos dobrados. Eleve o quadril contraindo os glúteos.",
    sets: 3, reps: 15, restSeconds: 30,
    muscleGroups: ["Glúteos", "Isquiotibiais", "Core"],
    icon: "🍑",
    tips: ["Aperte os glúteos no topo", "Mantenha 2 segundos no topo", "Costas retas"],
  },
  triceps_dip: {
    id: "triceps_dip",
    name: "Tríceps no Banco",
    description: "Apoiado em cadeira ou sofá, desça o corpo dobrando os cotovelos.",
    sets: 3, reps: 12, restSeconds: 45,
    muscleGroups: ["Tríceps", "Ombro"],
    icon: "💺",
    tips: ["Cotovelos apontam para trás", "Desça até 90°", "Não deixe os ombros subir"],
  },
  high_knees: {
    id: "high_knees",
    name: "Corrida no Lugar",
    description: "Corra no lugar elevando os joelhos até a altura do quadril.",
    sets: 3, durationSeconds: 40, restSeconds: 20,
    muscleGroups: ["Cardio", "Quadríceps", "Core"],
    icon: "🏃",
    tips: ["Joelhos acima do quadril", "Braços em movimento", "Mantenha o ritmo"],
  },
  superman: {
    id: "superman",
    name: "Superman",
    description: "Deitado de bruços, eleve braços e pernas simultaneamente.",
    sets: 3, reps: 12, restSeconds: 30,
    muscleGroups: ["Lombar", "Glúteos", "Ombros"],
    icon: "🦸",
    tips: ["Movimento controlado", "Mantenha 2 segundos no topo", "Respire normalmente"],
  },
};

// ─── Workouts ─────────────────────────────────────────────────────────────────

export const WORKOUTS: Workout[] = [
  {
    id: "missao_despertar",
    name: "Missão: Despertar do Guerreiro",
    subtitle: "Treino de ativação para iniciantes",
    type: "cardio",
    difficulty: "iniciante",
    durationMinutes: 20,
    xpReward: 80,
    icon: "⚔️",
    description: "Perfeito para começar sua jornada. Exercícios básicos que ativam o corpo inteiro sem equipamento.",
    exercises: [
      EXERCISES.jumping_jack,
      EXERCISES.agachamento,
      EXERCISES.flexao,
      EXERCISES.abdominal,
      EXERCISES.prancha,
    ],
  },
  {
    id: "missao_fogo",
    name: "Missão: Fogo Interior",
    subtitle: "HIIT queima-gordura",
    type: "hiit",
    difficulty: "intermediario",
    durationMinutes: 25,
    xpReward: 120,
    icon: "🔥",
    description: "Treino de alta intensidade para acelerar o metabolismo e queimar gordura. Prepare-se para suar!",
    exercises: [
      EXERCISES.burpee,
      EXERCISES.mountain_climber,
      EXERCISES.high_knees,
      EXERCISES.jumping_jack,
      EXERCISES.burpee,
    ],
  },
  {
    id: "missao_forca",
    name: "Missão: Força das Pedras",
    subtitle: "Treino de força corporal",
    type: "forca",
    difficulty: "intermediario",
    durationMinutes: 30,
    xpReward: 130,
    icon: "🛡️",
    description: "Construa força muscular usando apenas o peso do corpo. Foco em membros superiores e inferiores.",
    exercises: [
      EXERCISES.flexao,
      EXERCISES.agachamento,
      EXERCISES.afundo,
      EXERCISES.triceps_dip,
      EXERCISES.glute_bridge,
      EXERCISES.superman,
    ],
  },
  {
    id: "missao_lendario",
    name: "Missão: Desafio Lendário",
    subtitle: "Treino completo avançado",
    type: "hiit",
    difficulty: "avancado",
    durationMinutes: 40,
    xpReward: 200,
    icon: "👑",
    description: "Apenas para os mais corajosos. Combinação de força e cardio que testará seus limites.",
    exercises: [
      EXERCISES.burpee,
      EXERCISES.flexao,
      EXERCISES.agachamento,
      EXERCISES.mountain_climber,
      EXERCISES.afundo,
      EXERCISES.prancha,
      EXERCISES.high_knees,
      EXERCISES.abdominal,
    ],
  },
  {
    id: "missao_mobilidade",
    name: "Missão: Corpo Livre",
    subtitle: "Mobilidade e recuperação",
    type: "mobilidade",
    difficulty: "iniciante",
    durationMinutes: 15,
    xpReward: 50,
    icon: "🌊",
    description: "Treino suave de mobilidade para dias de recuperação. Ideal após treinos intensos.",
    exercises: [
      EXERCISES.prancha,
      EXERCISES.glute_bridge,
      EXERCISES.superman,
      EXERCISES.abdominal,
    ],
  },
];

// ─── Daily Mission Logic ──────────────────────────────────────────────────────

export function getDailyWorkout(
  level: number,
  totalWorkouts: number,
  goal: string
): Workout {
  // Rotate through workouts based on day of year + total workouts for variety
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const seed = (dayOfYear + totalWorkouts) % WORKOUTS.length;

  // Filter by difficulty based on level
  let eligible = WORKOUTS;
  if (level <= 1) {
    eligible = WORKOUTS.filter((w) => w.difficulty !== "avancado");
  } else if (level >= 4) {
    eligible = WORKOUTS;
  }

  // Prefer goal-matching workouts
  if (goal === "emagrecer") {
    const cardioFirst = eligible.filter((w) => w.type === "cardio" || w.type === "hiit");
    if (cardioFirst.length > 0) eligible = cardioFirst;
  } else if (goal === "condicionamento") {
    const strengthFirst = eligible.filter((w) => w.type === "forca" || w.type === "hiit");
    if (strengthFirst.length > 0) eligible = strengthFirst;
  }

  return eligible[seed % eligible.length] ?? WORKOUTS[0];
}

export function getWorkoutById(id: string): Workout | undefined {
  return WORKOUTS.find((w) => w.id === id);
}

export function getTypeLabel(type: WorkoutType): string {
  const labels: Record<WorkoutType, string> = {
    cardio: "Cardio",
    forca: "Força",
    hiit: "HIIT",
    mobilidade: "Mobilidade",
  };
  return labels[type];
}

export function getTypeColor(type: WorkoutType): string {
  const colors: Record<WorkoutType, string> = {
    cardio: "#60A5FA",
    forca: "#FF6B35",
    hiit: "#F87171",
    mobilidade: "#4ADE80",
  };
  return colors[type];
}

export function getDifficultyLabel(d: Difficulty): string {
  const labels: Record<Difficulty, string> = {
    iniciante: "Iniciante",
    intermediario: "Intermediário",
    avancado: "Avançado",
  };
  return labels[d];
}

export function getDifficultyColor(d: Difficulty): string {
  const colors: Record<Difficulty, string> = {
    iniciante: "#4ADE80",
    intermediario: "#FBBF24",
    avancado: "#F87171",
  };
  return colors[d];
}
