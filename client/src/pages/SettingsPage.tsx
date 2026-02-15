import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Badge, DetailedToggle, HoldButton, ThemeOption } from "../components/common";
import { Icon } from "../components/common/Icon";
import { useToast } from "../components/common/Toast";
import { useAuth } from "../contexts/AuthContext";
import { useTheme, type ThemeId } from "../contexts/ThemeContext";

// Definição local de preferências (client-side only por enquanto)
interface ClientPreferences {
  theme: string;
  notifications: boolean;
  soundEffects: boolean;
  glitchEffects: boolean;
  stealthMode: boolean;
}

const DEFAULT_PREFERENCES: ClientPreferences = {
  theme: "matrix",
  notifications: true,
  soundEffects: true,
  glitchEffects: true,
  stealthMode: false,
};

const THEME_PRESETS = [
  { id: "matrix", name: "Matrix", color: "bg-[#00ff41]" },
  { id: "naruto", name: "Naruto", color: "bg-[#ff6400]" },
  { id: "dragonball", name: "Dragon Ball", color: "bg-[#ffd700]" },
  { id: "sololeveling", name: "Solo Leveling", color: "bg-[#1a73e8]" },
  { id: "hxh", name: "Hunter x Hunter", color: "bg-[#dc143c]" },
  { id: "lotr", name: "Senhor dos Anéis", color: "bg-[#c0c0c0]" },
];

export function SettingsPage() {
  const { authUser: user, handleLogout: logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { themeId, setTheme } = useTheme();

  // Load preferences from localStorage or defaults
  const [preferences, setPreferences] = useState<ClientPreferences>(() => {
    const stored = localStorage.getItem("cmd8_preferences");
    const parsed = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
    // Ensure theme matches global context on mount
    return { ...parsed, theme: themeId || parsed.theme };
  });

  const [dangerBusy, setDangerBusy] = useState<"logout" | "reset" | null>(null);

  // Sync state with global themeId if it changes externallly
  useEffect(() => {
    setPreferences(prev => ({ ...prev, theme: themeId }));
  }, [themeId]);

  // Update localStorage when preferences change
  useEffect(() => {
    localStorage.setItem("cmd8_preferences", JSON.stringify(preferences));
    // Apply theme globally (example implementation)
    document.documentElement.setAttribute("data-theme", preferences.theme);
  }, [preferences]);

  const updatePreference = <K extends keyof ClientPreferences>(key: K, value: ClientPreferences[K]) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    if (key === "theme") {
      setTheme(value as ThemeId);
    }
  };

  const handleSave = useCallback(async () => {
    // Simular salvamento (já é salvo no effect)
    await new Promise(resolve => setTimeout(resolve, 500));
    showToast("Configuracoes salvas com sucesso!", "success");
  }, [showToast]);

  const executeHardReset = useCallback(async () => {
    setDangerBusy("reset");
    try {
      // Simulate heavy operation
      await new Promise((resolve) => setTimeout(resolve, 2000));
      localStorage.clear();
      sessionStorage.clear();
      await queryClient.resetQueries();
      showToast("Sistema reiniciado. Todos os dados locais foram limpos.", "success");
      window.location.reload();
    } catch {
      setDangerBusy(null);
    }
  }, [queryClient, showToast]);

  const handleLogout = useCallback(async () => {
    setDangerBusy("logout");
    try {
      await logout();
      navigate("/");
    } catch {
      setDangerBusy(null);
    }
  }, [logout, navigate]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700" data-testid="settings-page">
      <div className="mx-auto max-w-4xl space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="glitch-text text-4xl font-black uppercase italic tracking-tighter text-white md:text-6xl" data-text="SISTEMA">
              SISTEMA
            </h1>
            <p className="flex items-center gap-2 font-mono text-sm text-slate-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              CONFIGURACAO DO TERMINAL DO USUARIO
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex items-center gap-3 rounded-2xl bg-slate-800 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-slate-700 active:scale-95"
              type="button"
            >
              <Icon name="disk" className="text-[16px]" />
              Salvar Alteracoes
            </button>
          </div>
        </div>

        {/* Profile Section */}
        <div className="overflow-hidden rounded-[40px] border border-slate-800 bg-[#0a0a0b]/60 p-1 shadow-2xl backdrop-blur-xl">
          <div className="relative overflow-hidden rounded-[36px] bg-slate-900/50 p-8 md:p-12">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent opacity-50" />

            <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-start">
              <div className="relative group">
                <div className="absolute inset-0 -inset-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 blur opacity-25 group-hover:opacity-75 transition duration-500" />
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-slate-700 bg-slate-800 p-1 md:h-32 md:w-32">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900 text-slate-600">
                    <Icon name="robot" className="h-10 w-10 md:h-12 md:w-12 text-[48px]" />
                  </div>
                </div>
                <button
                  type="button"
                  className="absolute bottom-0 right-0 rounded-full bg-slate-800 p-2 text-white shadow-lg transition-transform hover:scale-110 hover:bg-cyan-600"
                >
                  <Icon name="pencil" className="text-[14px]" />
                </button>
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
                    {user?.email?.split('@')[0] ?? "Caçador"}
                  </h2>
                  <Badge color="bg-cyan-500/10 text-cyan-400 border-cyan-500/20" icon="check-circle">
                    Verificado
                  </Badge>
                  <Badge color="bg-purple-500/10 text-purple-400 border-purple-500/20" icon="crown">
                    Premium
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-950/50 p-4">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">ID do Usuario</span>
                    <code className="font-mono text-xs text-slate-300">{user?.id}</code>
                  </div>
                  <div className="rounded-2xl bg-slate-950/50 p-4">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Email</span>
                    <div className="flex items-center justify-between">
                      <code className="font-mono text-xs text-slate-300">{user?.email}</code>
                      <Icon name="key" className="text-slate-600 text-[14px]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Main Settings */}
          <div className="space-y-8 lg:col-span-8">
            {/* Visual Preferences */}
            <section>
              <div className="mb-6 flex items-center gap-4">
                <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-500"><Icon name="palette" className="text-[24px]" /></div>
                <h2 className="text-lg font-bold uppercase tracking-widest text-white">Interface Visual</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <DetailedToggle
                  label="Efeitos Glitch"
                  desc="Artefatos visuais de instabilidade do sistema."
                  active={preferences.glitchEffects}
                  onClick={() => updatePreference("glitchEffects", !preferences.glitchEffects)}
                  icon="activity"
                />
                <DetailedToggle
                  label="Modo Furtivo"
                  desc="Oculta status online de outros caçadores."
                  active={preferences.stealthMode}
                  onClick={() => updatePreference("stealthMode", !preferences.stealthMode)}
                  icon="eye-crossed"
                />
              </div>
            </section>

            {/* System Preferences */}
            <section>
              <div className="mb-6 flex items-center gap-4">
                <div className="rounded-xl bg-purple-500/10 p-3 text-purple-500"><Icon name="microchip" className="text-[24px]" /></div>
                <h2 className="text-lg font-bold uppercase tracking-widest text-white">Sistema</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <DetailedToggle
                  label="Notificacoes"
                  desc="Alertas de missoes e atualizacoes do sistema."
                  active={preferences.notifications}
                  onClick={() => updatePreference("notifications", !preferences.notifications)}
                />
                <DetailedToggle
                  label="Efeitos Sonoros"
                  desc="Feedback auditivo de interacoes e combate."
                  active={preferences.soundEffects}
                  onClick={() => updatePreference("soundEffects", !preferences.soundEffects)}
                />
              </div>
            </section>

            {/* Danger Zone */}
            <section className="relative overflow-hidden rounded-[32px] border border-red-900/30 bg-red-950/5 p-8">
              <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(220,38,38,0.05)_10px,rgba(220,38,38,0.05)_20px)]" />

              <div className="relative z-10">
                <div className="mb-6 flex items-center gap-4 text-red-500">
                  <Icon name="exclamation" className="animate-pulse text-[24px]" />
                  <h2 className="text-lg font-black uppercase tracking-widest">Zona de Perigo</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-4 rounded-2xl bg-red-500/5 p-6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-bold text-white">Resetar Progresso Local</h3>
                      <p className="text-sm text-red-200/60">Limpa cache e dados temporarios. Nao apaga conta.</p>
                    </div>
                    <HoldButton
                      label="SEGURE PARA DELETAR TUDO"
                      onComplete={() => void executeHardReset()}
                      loading={dangerBusy === "reset"}
                      className="w-full rounded-xl bg-red-600 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:grayscale md:w-auto md:px-8"
                    />
                  </div>

                  <div className="flex flex-col gap-4 rounded-2xl bg-red-500/5 p-6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-bold text-white">Encerrar Sessao</h3>
                      <p className="text-sm text-red-200/60">Desconecta do terminal com segurança.</p>
                    </div>
                    <button
                      onClick={() => void handleLogout()}
                      disabled={dangerBusy === "logout"}
                      className="flex items-center justify-center gap-2 w-full rounded-xl border border-red-500/30 bg-transparent py-4 text-xs font-black uppercase tracking-[0.2em] text-red-400 transition-all hover:bg-red-500/10 active:scale-95 md:w-auto md:px-8"
                      type="button"
                    >
                      <Icon name="trash" className="text-[16px]" />
                      Desconectar
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar Settings (Theme) */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 space-y-6">
              <div className="rounded-[32px] border border-slate-800 bg-[#0a0a0b]/80 p-6 backdrop-blur-xl">
                <div className="mb-6 flex items-center gap-4">
                  <div className="rounded-xl bg-orange-500/10 p-3 text-orange-500"><Icon name="bolt" className="text-[24px]" /></div>
                  <h2 className="text-lg font-bold uppercase tracking-widest text-white">Dificuldade</h2>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="rounded-2xl bg-slate-900 p-4 border border-slate-800 opacity-50 grayscale cursor-not-allowed">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-black text-white uppercase tracking-wider">Casual</span>
                      <Icon name="cross-circle" className="text-slate-600 text-[18px]" />
                    </div>
                    <p className="text-xs text-slate-500">Modo historia sem desafios.</p>
                  </div>
                  <div className="rounded-2xl bg-red-900/20 p-4 border border-red-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 text-red-500"><Icon name="skull" className="text-[14px]" /></div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-black text-white uppercase tracking-wider">Hardcore</span>
                      <Icon name="check-circle" className="text-red-500 text-[18px]" />
                    </div>
                    <p className="text-xs text-red-200/60">Dano permanente. Boot loops reais.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-800 bg-[#0a0a0b]/80 p-6 backdrop-blur-xl">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-lg font-bold uppercase tracking-widest text-white">Tema</h2>
                  <Icon name="refresh" className="text-slate-600 animate-spin-slow text-[16px]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {THEME_PRESETS.map(preset => (
                    <ThemeOption
                      key={preset.id}
                      label={preset.name}
                      color={preset.color}
                      active={preferences.theme === preset.id}
                      onClick={() => updatePreference("theme", preset.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-[32px] bg-gradient-to-br from-[#0a0a0b] to-slate-950 p-8 text-center border border-slate-800 shadow-xl">
                <div className="mb-6 rounded-full bg-red-500/10 p-6 text-red-500 shadow-[0_0_50px_rgba(220,38,38,0.2)] inline-block">
                  <Icon name="skull" className="text-[48px]" />
                </div>
                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">Build v0.9.4</h3>
                <p className="text-xs font-mono text-slate-500">COMPILADO: 2024-05-20</p>
                <div className="mt-6 flex justify-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
