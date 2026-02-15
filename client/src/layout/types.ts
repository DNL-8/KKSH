export interface AuthUser {
  id: string;
  email: string;
  username?: string | null;
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
  openAuthPanel: () => void;
  navigateTo: (path: string) => void;
}
