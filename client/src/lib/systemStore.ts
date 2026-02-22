import { useState, useEffect } from "react";

const STORAGE_KEY = "cmd8_system_page_rpg_state";

export interface SystemRPGState {
    name: string;
    xp: number;
    level: number;
    hp: number;
    mana: number;
    streak: number;
    activeMinutes: number;
    completedRaids: number;
    attributes: {
        vigor: number;
        forca: number;
        agilidade: number;
        inteligencia: number;
    };
}

const DEFAULT_STATE: SystemRPGState = {
    name: "SUNG JIN-WOO",
    xp: 0,
    level: 1,
    hp: 100,
    mana: 100,
    streak: 0,
    activeMinutes: 0,
    completedRaids: 0,
    attributes: { vigor: 10, forca: 15, agilidade: 8, inteligencia: 5 }
};

let currentState: SystemRPGState = { ...DEFAULT_STATE };

// Load from localStorage if available
if (typeof window !== "undefined") {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            currentState = { ...DEFAULT_STATE, ...JSON.parse(stored) };
        }
    } catch {
        // ignore
    }
}

const listeners = new Set<() => void>();

export const systemRPGStore = {
    getState: () => currentState,
    setState: (newState: Partial<SystemRPGState> | ((prev: SystemRPGState) => Partial<SystemRPGState>)) => {
        const updates = typeof newState === "function" ? newState(currentState) : newState;
        currentState = { ...currentState, ...updates };

        if (typeof window !== "undefined") {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
            } catch {
                // ignore
            }
        }

        listeners.forEach(listener => listener());
    },
    subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }
};

export const RANKS = [
    { name: 'F', minXp: 0, color: 'text-zinc-400', glow: 'shadow-[0_0_15px_rgba(161,161,170,0.4)]', border: 'border-zinc-600', bg: 'from-zinc-800 to-zinc-950' },
    { name: 'E', minXp: 50, color: 'text-slate-200', glow: 'shadow-[0_0_20px_rgba(226,232,240,0.5)]', border: 'border-slate-500', bg: 'from-slate-700 to-slate-950' },
    { name: 'D', minXp: 150, color: 'text-emerald-400', glow: 'shadow-[0_0_20px_rgba(52,211,153,0.5)]', border: 'border-emerald-500', bg: 'from-emerald-900 to-zinc-950' },
    { name: 'C', minXp: 400, color: 'text-cyan-400', glow: 'shadow-[0_0_25px_rgba(34,211,238,0.6)]', border: 'border-cyan-500', bg: 'from-cyan-900 to-zinc-950' },
    { name: 'B', minXp: 800, color: 'text-purple-400', glow: 'shadow-[0_0_30px_rgba(168,85,247,0.6)]', border: 'border-purple-500', bg: 'from-purple-900 to-zinc-950' },
    { name: 'A', minXp: 1500, color: 'text-red-500', glow: 'shadow-[0_0_35px_rgba(239,68,68,0.7)]', border: 'border-red-500', bg: 'from-red-900 to-zinc-950' },
    { name: 'S', minXp: 3000, color: 'text-yellow-400', glow: 'shadow-[0_0_40px_rgba(250,204,21,0.8)]', border: 'border-yellow-400', bg: 'from-yellow-900 to-zinc-950' },
];

export const getRank = (xp: number) => [...RANKS].reverse().find(r => xp >= r.minXp) || RANKS[0];

export const getNextRank = (xp: number) => {
    const currentIdx = RANKS.findIndex(r => r.name === getRank(xp).name);
    return currentIdx < RANKS.length - 1 ? RANKS[currentIdx + 1] : RANKS[RANKS.length - 1];
};

export function useSystemRPG() {
    const [state, setState] = useState(currentState);

    useEffect(() => {
        return systemRPGStore.subscribe(() => {
            setState(systemRPGStore.getState());
        });
    }, []);

    return [state, systemRPGStore.setState] as const;
}
