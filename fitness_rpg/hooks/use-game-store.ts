import { useEffect, useState } from "react";
import { GameStore, type GameState } from "@/lib/game-store";

export function useGameStore(): GameState {
  const [state, setState] = useState<GameState>(() => GameStore.getState());

  useEffect(() => {
    // Load persisted state on mount
    GameStore.load().then((loaded) => {
      setState(loaded);
    });

    // Subscribe to future changes
    const unsubscribe = GameStore.subscribe(() => {
      setState(GameStore.getState());
    });

    return unsubscribe;
  }, []);

  return state;
}
