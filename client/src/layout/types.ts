export type GlobalActionType = "attack";

export interface AuthUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export interface GlobalStats {
  hp: number;
  mana: number;
  xp: number;
  maxXp: number;
  level: number;
  rank: string;
  gold: number;
  streak: number;
}

export interface AppShellContextValue {
  globalStats: GlobalStats;
  authUser: AuthUser | null;
  handleGlobalAction: (type: GlobalActionType) => void;
  syncProgressionFromApi: () => Promise<void>;
  openAuthPanel: () => void;
  navigateTo: (path: string) => void;
}
