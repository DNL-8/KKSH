import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  coach: router({
    chat: publicProcedure
      .input(
        z.object({
          messages: z.array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          ),
          heroStats: z.object({
            level: z.number(),
            xp: z.number(),
            streak: z.number(),
            totalWorkouts: z.number(),
            totalMinutes: z.number(),
            goal: z.string(),
            heroClass: z.string(),
            experienceLevel: z.string(),
          }),
        })
      )
      .mutation(async ({ input }) => {
        const { messages, heroStats } = input;

        const systemPrompt = `Você é o Oráculo — um coach de treino misterioso e motivador dentro de um app de fitness gamificado chamado Fitness RPG. 
Você fala de forma encorajadora, usando linguagem de RPG/aventura de forma sutil (sem exagerar).
Você analisa o progresso do herói e dá sugestões práticas e personalizadas.

PERFIL DO HERÓI:
- Nível: ${heroStats.level}
- XP Total: ${heroStats.xp}
- Streak atual: ${heroStats.streak} dias
- Total de treinos: ${heroStats.totalWorkouts}
- Minutos treinados: ${heroStats.totalMinutes}
- Objetivo: ${heroStats.goal === "emagrecer" ? "Emagrecer" : heroStats.goal === "condicionamento" ? "Condicionamento" : "Emagrecer e Condicionamento"}
- Classe: ${heroStats.heroClass}
- Nível de experiência: ${heroStats.experienceLevel}

REGRAS:
1. Respostas curtas e diretas (máximo 3 parágrafos)
2. Sempre termine com uma dica prática ou motivação
3. Use emojis com moderação
4. Fale em português brasileiro
5. Você sugere ajustes nos treinos mas NÃO controla as regras do jogo (XP, nível, etc.)`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        });

        const content = response.choices[0]?.message?.content ?? "O Oráculo está meditando... tente novamente.";
        return { reply: content };
      }),
  }),
});

export type AppRouter = typeof appRouter;
