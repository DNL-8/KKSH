import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSystemRpgStats, patchSystemRpgStats, SystemRPGStatsOut, SystemRPGStatsUpdate } from "./api";
import { useAuth } from "../contexts/AuthContext";

const SYSTEM_RPG_QUERY_KEY = ["system_rpg_stats"];

export const RANKS = [
    { name: 'F', minXp: 0, color: 'text-slate-600', glow: 'shadow-[0_0_15px_rgba(161,161,170,0.4)]', border: 'border-zinc-600', bg: 'from-zinc-800 to-zinc-950' },
    { name: 'E', minXp: 800, color: 'text-slate-200', glow: 'shadow-[0_0_20px_rgba(226,232,240,0.5)]', border: 'border-slate-500', bg: 'from-slate-700 to-slate-950' }, // ~ 5 dias perfeitos
    { name: 'D', minXp: 2500, color: 'text-emerald-400', glow: 'shadow-[0_0_20px_rgba(52,211,153,0.5)]', border: 'border-emerald-500', bg: 'from-emerald-900 to-zinc-950' }, // ~ 15 dias
    { name: 'C', minXp: 5000, color: 'text-cyan-400', glow: 'shadow-[0_0_25px_rgba(34,211,238,0.6)]', border: 'border-cyan-500', bg: 'from-cyan-900 to-zinc-950' }, // ~ 30 dias
    { name: 'B', minXp: 8000, color: 'text-purple-400', glow: 'shadow-[0_0_30px_rgba(168,85,247,0.6)]', border: 'border-purple-500', bg: 'from-purple-900 to-zinc-950' }, // ~ 48 dias
    { name: 'A', minXp: 11500, color: 'text-red-500', glow: 'shadow-[0_0_35px_rgba(239,68,68,0.7)]', border: 'border-red-500', bg: 'from-red-900 to-zinc-950' }, // ~ 71 dias
    { name: 'S', minXp: 15000, color: 'text-yellow-400', glow: 'shadow-[0_0_40px_rgba(250,204,21,0.8)]', border: 'border-yellow-400', bg: 'from-yellow-900 to-zinc-950' }, // ~ 90 dias perfeitos
];

export const getRank = (xp: number) => [...RANKS].reverse().find(r => xp >= r.minXp) || RANKS[0];

export const getNextRank = (xp: number) => {
    const currentIdx = RANKS.findIndex(r => r.name === getRank(xp).name);
    return currentIdx < RANKS.length - 1 ? RANKS[currentIdx + 1] : RANKS[RANKS.length - 1];
};

const DEFAULT_STATE: SystemRPGStatsOut = {
    name: "SUNG JIN-WOO",
    xp: 0,
    level: 1,
    hp: 100,
    mana: 100,
    streak: 0,
    active_minutes: 0,
    completed_raids: 0,
    vigor: 10,
    forca: 15,
    agilidade: 8,
    inteligencia: 5
};

export function useSystemRPG() {
    const { authUser } = useAuth();
    const queryClient = useQueryClient();

    const { data: state = DEFAULT_STATE, isLoading } = useQuery({
        queryKey: SYSTEM_RPG_QUERY_KEY,
        queryFn: getSystemRpgStats,
        enabled: Boolean(authUser),
        staleTime: 5 * 60 * 1000, // Keep fresh for 5 mins
    });

    const mutation = useMutation({
        mutationFn: (updates: SystemRPGStatsUpdate) => patchSystemRpgStats(updates),
        onMutate: async (newUpdates) => {
            // Optimistic update
            await queryClient.cancelQueries({ queryKey: SYSTEM_RPG_QUERY_KEY });
            const previousState = queryClient.getQueryData<SystemRPGStatsOut>(SYSTEM_RPG_QUERY_KEY);

            queryClient.setQueryData<SystemRPGStatsOut>(SYSTEM_RPG_QUERY_KEY, (old) => {
                if (!old) return { ...DEFAULT_STATE, ...newUpdates } as SystemRPGStatsOut;
                return { ...old, ...newUpdates } as SystemRPGStatsOut;
            });

            return { previousState };
        },
        onError: (_err, _newUpdates, context) => {
            // Revert changes if error occurs
            if (context?.previousState) {
                queryClient.setQueryData(SYSTEM_RPG_QUERY_KEY, context.previousState);
            }
        },
        onSettled: () => {
            // Ensure consistency in the background
            queryClient.invalidateQueries({ queryKey: SYSTEM_RPG_QUERY_KEY });
        },
    });

    // Provide setter fallback that mirrors useState interface for legacy support in UI temporarily 
    // whilst doing optimistic patching out of the box!
    const setState = (newState: Partial<SystemRPGStatsOut> | ((prev: SystemRPGStatsOut) => Partial<SystemRPGStatsOut>)) => {
        const resolvingState = typeof newState === "function" ? newState(state) : newState;
        mutation.mutate(resolvingState);
    };

    return [state, setState, isLoading] as const;
}
