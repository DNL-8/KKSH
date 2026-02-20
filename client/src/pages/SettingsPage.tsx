import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Badge, DetailedToggle, HoldButton, ThemeOption } from "../components/common";
import { Icon } from "../components/common/Icon";
import { useToast } from "../components/common/Toast";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences, type ClientPreferences } from "../contexts/PreferencesContext";
import { useTheme, type ThemeId } from "../contexts/ThemeContext";
import { ApiRequestError, resetMeState, updateProfile } from "../lib/api";
import { LOCAL_MEDIA_DB_NAME, clearVideos } from "../lib/localVideosStore";
import { clearFilesTelemetry, readFilesTelemetry, type FilesTelemetryEvent } from "../lib/filesTelemetry";

type FilesTelemetryFilter = "all" | "import" | "bridge" | "metadata" | "error";

const FILES_TELEMETRY_FILTERS: Array<{ id: FilesTelemetryFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "import", label: "Import" },
  { id: "bridge", label: "Bridge" },
  { id: "metadata", label: "Metadata" },
  { id: "error", label: "Erro" },
];

function matchesFilesTelemetryFilter(event: FilesTelemetryEvent, filter: FilesTelemetryFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "import") {
    return event.name.startsWith("files.import");
  }
  if (filter === "bridge") {
    return event.name.startsWith("files.bridge.play");
  }
  if (filter === "metadata") {
    return event.name.startsWith("files.metadata");
  }
  return event.name.endsWith(".error");
}

const THEME_PRESETS = [
  { id: "matrix", name: "Matrix", color: "bg-[#00ff41]" },
  { id: "naruto", name: "Naruto", color: "bg-[#ff6400]" },
  { id: "dragonball", name: "Dragon Ball", color: "bg-[#ffd700]" },
  { id: "sololeveling", name: "Solo Leveling", color: "bg-[#1a73e8]" },
  { id: "hxh", name: "Hunter x Hunter", color: "bg-[#dc143c]" },
  { id: "lotr", name: "Senhor dos Anéis", color: "bg-[#c0c0c0]" },
];

function deleteLocalMediaDatabase(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.deleteDatabase(LOCAL_MEDIA_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function SettingsPage() {
  const { authUser: user, handleLogout: logout } = useAuth();
  const { preferences, setPreference, resetPreferences } = usePreferences();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { themeId, setTheme } = useTheme();

  const [dangerBusy, setDangerBusy] = useState<"logout" | "reset" | null>(null);

  // Username editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [filesTelemetryEvents, setFilesTelemetryEvents] = useState<FilesTelemetryEvent[]>([]);
  const [filesTelemetryFilter, setFilesTelemetryFilter] = useState<FilesTelemetryFilter>("all");

  const refreshFilesTelemetry = useCallback(() => {
    const events = readFilesTelemetry();
    setFilesTelemetryEvents([...events].reverse());
  }, []);

  useEffect(() => {
    refreshFilesTelemetry();
  }, [refreshFilesTelemetry]);

  const filesTelemetryStats = useMemo(() => {
    let errors = 0;
    let importEvents = 0;
    let bridgeEvents = 0;

    for (const event of filesTelemetryEvents) {
      if (event.name.endsWith(".error")) {
        errors += 1;
      }
      if (event.name.startsWith("files.import")) {
        importEvents += 1;
      }
      if (event.name.startsWith("files.bridge.play")) {
        bridgeEvents += 1;
      }
    }

    return {
      total: filesTelemetryEvents.length,
      errors,
      importEvents,
      bridgeEvents,
    };
  }, [filesTelemetryEvents]);

  const filesTelemetryFilterCounts = useMemo(() => {
    const counts: Record<FilesTelemetryFilter, number> = {
      all: filesTelemetryEvents.length,
      import: 0,
      bridge: 0,
      metadata: 0,
      error: 0,
    };

    for (const event of filesTelemetryEvents) {
      if (event.name.startsWith("files.import")) {
        counts.import += 1;
      }
      if (event.name.startsWith("files.bridge.play")) {
        counts.bridge += 1;
      }
      if (event.name.startsWith("files.metadata")) {
        counts.metadata += 1;
      }
      if (event.name.endsWith(".error")) {
        counts.error += 1;
      }
    }

    return counts;
  }, [filesTelemetryEvents]);

  const filteredFilesTelemetryEvents = useMemo(
    () => filesTelemetryEvents.filter((event) => matchesFilesTelemetryFilter(event, filesTelemetryFilter)),
    [filesTelemetryEvents, filesTelemetryFilter],
  );

  const visibleFilesTelemetryEvents = useMemo(
    () => filteredFilesTelemetryEvents.slice(0, 40),
    [filteredFilesTelemetryEvents],
  );

  const handleClearFilesTelemetry = useCallback(() => {
    if (filesTelemetryEvents.length === 0) {
      showToast("Nao ha eventos para limpar.", "info");
      return;
    }

    const confirmed = window.confirm("Limpar todos os eventos de telemetria de arquivos?");
    if (!confirmed) {
      return;
    }

    clearFilesTelemetry();
    refreshFilesTelemetry();
    showToast("Telemetria de arquivos limpa.", "success");
  }, [filesTelemetryEvents.length, refreshFilesTelemetry, showToast]);

  const handleExportFilesTelemetry = useCallback(() => {
    if (filesTelemetryEvents.length === 0) {
      showToast("Nao ha eventos para exportar.", "info");
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      eventCount: filesTelemetryEvents.length,
      events: [...filesTelemetryEvents].reverse(),
    };

    const fileName = `cmd8-files-telemetry-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    showToast("Telemetria exportada com sucesso.", "success");
  }, [filesTelemetryEvents, showToast]);

  const updatePreference = useCallback(
    <K extends keyof ClientPreferences>(key: K, value: ClientPreferences[K]) => {
      setPreference(key, value);
    },
    [setPreference],
  );

  const handleSave = useCallback(async () => {
    // Simular salvamento (já é salvo no effect)
    await new Promise(resolve => setTimeout(resolve, 500));
    showToast("Configuracoes salvas com sucesso!", "success");
  }, [showToast]);

  const executeHardReset = useCallback(async () => {
    setDangerBusy("reset");
    try {
      let remoteResetError: string | null = null;

      try {
        await resetMeState(["all"]);
      } catch (error) {
        if (error instanceof ApiRequestError) {
          if (error.status === 401) {
            remoteResetError = "Sessao expirada. Entre novamente para resetar a conta.";
          } else {
            remoteResetError = error.message;
          }
        } else {
          remoteResetError = "Falha ao resetar dados da conta no servidor.";
        }
      }

      try {
        await clearVideos();
      } catch {
        // Ignore local media clear failures and continue.
      }
      await deleteLocalMediaDatabase();

      localStorage.clear();
      sessionStorage.clear();
      resetPreferences();
      queryClient.clear();

      if (remoteResetError) {
        showToast(`Reset local concluido, mas houve falha no servidor: ${remoteResetError}`, "error");
        setDangerBusy(null);
        return;
      }

      showToast("Reset concluido. Recarregando terminal...", "success");
      window.setTimeout(() => {
        window.location.assign("/hub");
      }, 180);
    } catch {
      showToast("Nao foi possivel resetar os dados locais.", "error");
      setDangerBusy(null);
    }
  }, [queryClient, resetPreferences, showToast]);

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
              className="flex items-center gap-3 rounded-[20px] bg-slate-800/80 px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-[0_0_20px_rgba(0,0,0,0.5),inset_0_2px_5px_rgba(255,255,255,0.1)] transition-all hover:bg-slate-700 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:-translate-y-1 active:scale-95 backdrop-blur-md border border-white/5"
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
              <div className="relative group perspective-1000">
                <div className="absolute inset-0 -inset-4 rounded-full bg-[radial-gradient(circle,rgba(var(--glow),0.4),transparent_70%)] blur-xl opacity-60 group-hover:opacity-100 group-hover:scale-110 transition duration-700" />
                <div className="relative h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-black/60 p-1 md:h-32 md:w-32 shadow-[inset_0_0_20px_rgba(var(--glow),0.3)] transform-style-3d transition-transform duration-500 group-hover:rotate-y-12">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#0c1020] to-[#04060a] text-[hsl(var(--accent))] shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
                    <Icon name="robot" className="h-10 w-10 md:h-12 md:w-12 text-[48px] drop-shadow-[0_0_10px_rgba(var(--glow),0.8)]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="bg-black/40 border border-[hsl(var(--accent)/0.3)] shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),0_0_15px_rgba(var(--glow),0.1)] rounded-xl px-4 py-2 text-white text-xl font-bold uppercase tracking-widest focus:outline-none focus:border-[hsl(var(--accent))] focus:ring-1 focus:ring-[hsl(var(--accent)/0.3)] min-w-[200px]"
                      placeholder="Novo nome"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        void (async () => {
                          setIsSavingName(true);
                          try {
                            await updateProfile({ username: tempName });
                            await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
                            // Force reload or re-sync? 
                            // Accessing handleSave logic basically
                            window.location.reload(); // Simple/Safe for now to update all context
                          } catch (err) {
                            showToast("Erro ao atualizar nome. Pode estar em uso.", "error");
                          } finally {
                            setIsSavingName(false);
                            setIsEditingName(false);
                          }
                        })();
                      }}
                      disabled={isSavingName}
                      className="p-2 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      <Icon name="check" className="text-[18px]" />
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      disabled={isSavingName}
                      className="p-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 disabled:opacity-50"
                    >
                      <Icon name="cross" className="text-[18px]" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
                      {user?.username || user?.email?.split('@')[0] || "Caçador"}
                    </h2>
                    <button
                      onClick={() => {
                        setTempName(user?.username || "");
                        setIsEditingName(true);
                      }}
                      className="p-3 rounded-full hover:bg-white/[0.05] text-slate-500 hover:text-[hsl(var(--accent))] transition-all active:scale-95"
                    >
                      <Icon name="pencil" className="text-[16px]" />
                    </button>
                  </>
                )}

                <Badge color="bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))] border-[hsl(var(--accent)/0.2)] shadow-[0_0_10px_rgba(var(--glow),0.1)]" icon="check-circle">
                  Verificado
                </Badge>
                <Badge color="bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]" icon="crown">
                  Premium
                </Badge>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-black/40 p-5 shadow-[inset_0_2px_15px_rgba(0,0,0,0.6)] transition-all hover:bg-black/60">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-[hsl(var(--accent)/0.6)] drop-shadow-[0_0_5px_rgba(var(--glow),0.3)]">ID do Usuario</span>
                  <code className="font-mono text-[11px] text-slate-300 bg-white/[0.03] px-2 py-1 rounded">{user?.id}</code>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/40 p-5 shadow-[inset_0_2px_15px_rgba(0,0,0,0.6)] transition-all hover:bg-black/60">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-[hsl(var(--accent)/0.6)] drop-shadow-[0_0_5px_rgba(var(--glow),0.3)]">Email</span>
                  <div className="flex items-center justify-between">
                    <code className="font-mono text-[11px] text-slate-300 bg-white/[0.03] px-2 py-1 rounded">{user?.email}</code>
                    <Icon name="key" className="text-[hsl(var(--accent)/0.5)] text-[16px]" />
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
              <div className="rounded-xl border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.1)] p-3 text-[hsl(var(--accent))] shadow-[0_0_15px_rgba(var(--glow),0.2)]"><Icon name="palette" className="text-[24px]" /></div>
              <h2 className="text-lg font-black uppercase tracking-widest text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">Interface Visual</h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
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
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]"><Icon name="microchip" className="text-[24px]" /></div>
              <h2 className="text-lg font-black uppercase tracking-widest text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">Sistema</h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
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

          {/* Files Telemetry */}
          <section>
            <div className="mb-6 flex items-center gap-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"><Icon name="database" className="text-[24px]" /></div>
              <h2 className="text-lg font-black uppercase tracking-widest text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">Telemetria de Arquivos</h2>
            </div>

            <div className="rounded-[40px] border border-white/5 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/90 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <p className="text-[13px] text-slate-400 max-w-lg leading-relaxed font-medium">
                  Eventos locais de importacao, backup e reproducao da bridge para diagnostico rapido.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={refreshFilesTelemetry}
                    className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white"
                    type="button"
                  >
                    Atualizar
                  </button>
                  <button
                    onClick={handleExportFilesTelemetry}
                    disabled={filesTelemetryEvents.length === 0}
                    className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)] transition-all hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                  >
                    Exportar JSON
                  </button>
                  <button
                    onClick={handleClearFilesTelemetry}
                    disabled={filesTelemetryEvents.length === 0}
                    className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-400 shadow-[0_0_10px_rgba(220,38,38,0.1)] transition-all hover:bg-red-500/20 hover:shadow-[0_0_15px_rgba(220,38,38,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</p>
                  <p className="mt-1 text-xl font-black text-white">{filesTelemetryStats.total}</p>
                </div>
                <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-300/70">Erros</p>
                  <p className="mt-1 text-xl font-black text-red-300">{filesTelemetryStats.errors}</p>
                </div>
                <div className="rounded-xl border border-cyan-900/40 bg-cyan-950/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/70">Imports</p>
                  <p className="mt-1 text-xl font-black text-cyan-300">{filesTelemetryStats.importEvents}</p>
                </div>
                <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">Bridge Play</p>
                  <p className="mt-1 text-xl font-black text-emerald-300">{filesTelemetryStats.bridgeEvents}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2" data-testid="settings-files-telemetry-filters">
                {FILES_TELEMETRY_FILTERS.map((filterOption) => {
                  const isActive = filesTelemetryFilter === filterOption.id;
                  const count = filesTelemetryFilterCounts[filterOption.id];
                  return (
                    <button
                      key={filterOption.id}
                      onClick={() => setFilesTelemetryFilter(filterOption.id)}
                      type="button"
                      aria-pressed={isActive}
                      className={`rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${isActive
                        ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-200"
                        : "border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800"
                        }`}
                    >
                      {filterOption.label} ({count})
                    </button>
                  );
                })}
              </div>
              {filesTelemetryEvents.length === 0 ? (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">
                  Sem eventos de telemetria no momento.
                </div>
              ) : filteredFilesTelemetryEvents.length === 0 ? (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">
                  Sem eventos para o filtro selecionado.
                </div>
              ) : (
                <div className="custom-scrollbar mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1" data-testid="settings-files-telemetry-list">
                  {visibleFilesTelemetryEvents.map((event, index) => (
                    <div key={`${event.at}-${event.name}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <code className="text-[10px] font-black uppercase tracking-wider text-cyan-300">{event.name}</code>
                        <span className="text-[10px] font-mono text-slate-500">{new Date(event.at).toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                        <span className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5">source: {String(event.payload.source ?? "-")}</span>
                        {typeof event.payload.durationMs === "number" && (
                          <span className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5">duracao: {Math.max(0, Math.round(event.payload.durationMs))} ms</span>
                        )}
                        {event.payload.error && (
                          <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-300">erro: {String(event.payload.error)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          {/* Danger Zone */}
          <section className="relative overflow-hidden rounded-[40px] border border-red-500/30 bg-[#0a0f1d]/90 p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_80px_rgba(220,38,38,0.15)] backdrop-blur-xl">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_15px,rgba(220,38,38,0.03)_15px,rgba(220,38,38,0.03)_30px)] pointer-events-none mix-blend-overlay opacity-80" />
            <div className="absolute -left-32 -top-32 h-64 w-64 rounded-full bg-red-600/20 blur-[100px] pointer-events-none" />

            <div className="relative z-10">
              <div className="mb-8 flex items-center gap-4 text-red-500">
                <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                  <Icon name="exclamation" className="animate-pulse text-[24px]" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">Zona de Perigo</h2>
              </div>

              <div className="space-y-5">
                <div className="flex flex-col gap-5 rounded-[24px] border border-red-900/40 bg-red-950/20 p-8 md:flex-row md:items-center md:justify-between shadow-[inset_0_2px_15px_rgba(220,38,38,0.05)] transition-all hover:bg-red-950/30">
                  <div>
                    <h3 className="font-bold text-white text-[15px] mb-1 drop-shadow-sm">Resetar Progresso Local</h3>
                    <p className="text-[13px] text-red-200/60 font-medium">Limpa dados locais e zera progresso da conta. Nao apaga o usuario.</p>
                  </div>
                  <HoldButton
                    label="SEGURE PARA DELETAR TUDO"
                    onComplete={() => void executeHardReset()}
                    loading={dangerBusy === "reset"}
                    holdDuration={1000}
                    progressLabel="CONFIRMANDO"
                    className="w-full rounded-[16px] border border-red-400/50 bg-red-600 px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all active:scale-95 disabled:opacity-50 disabled:grayscale md:w-auto hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.8)]"
                  />
                </div>

                <div className="flex flex-col gap-5 rounded-[24px] border border-red-900/40 bg-red-950/20 p-8 md:flex-row md:items-center md:justify-between shadow-[inset_0_2px_15px_rgba(220,38,38,0.05)] transition-all hover:bg-red-950/30">
                  <div>
                    <h3 className="font-bold text-white text-[15px] mb-1 drop-shadow-sm">Encerrar Sessao</h3>
                    <p className="text-[13px] text-red-200/60 font-medium">Desconecta do terminal com seguranca.</p>
                  </div>
                  <button
                    onClick={() => void handleLogout()}
                    disabled={dangerBusy === "logout"}
                    className="flex items-center justify-center gap-3 w-full rounded-[16px] border border-red-500/30 bg-black/40 px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-red-400 transition-all hover:bg-red-950/50 hover:border-red-500/60 hover:text-red-300 hover:shadow-[0_0_20px_rgba(220,38,38,0.2)] active:scale-95 md:w-auto shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                    type="button"
                  >
                    <Icon name="trash" className="text-[18px]" />
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
            <div className="rounded-[40px] border border-white/5 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/90 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <div className="mb-8 flex items-center gap-4">
                <div className="rounded-xl border border-orange-500/30 bg-orange-950/40 p-3 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]"><Icon name="bolt" className="text-[24px]" /></div>
                <h2 className="text-lg font-black uppercase tracking-widest text-white drop-shadow-sm">Dificuldade</h2>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => updatePreference("difficulty", "casual")}
                  className={`rounded-[20px] p-5 border transition-all text-left group ${preferences.difficulty === "casual"
                    ? "bg-[#142618] border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)] opacity-100"
                    : "bg-white/[0.02] border-white/5  opacity-60 grayscale hover:grayscale-0 hover:opacity-100 hover:bg-white/[0.05]"
                    }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-[13px] font-black uppercase tracking-[0.2em] ${preferences.difficulty === "casual" ? "text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "text-white"
                      }`}>Casual</span>
                    {preferences.difficulty === "casual" && (
                      <Icon name="check-circle" className="text-emerald-500 text-[20px] drop-shadow-sm" />
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-slate-500">Modo historia sem desafios punitivos.</p>
                </button>

                <button
                  onClick={() => updatePreference("difficulty", "hardcore")}
                  className={`rounded-[20px] p-5 border transition-all text-left relative overflow-hidden group ${preferences.difficulty === "hardcore"
                    ? "bg-[#251010] border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                    : "bg-white/[0.02] border-white/5 hover:bg-red-950/20 hover:border-red-500/30 opacity-80 hover:opacity-100"
                    }`}
                >
                  {preferences.difficulty === "hardcore" && (
                    <div className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-red-600/10 blur-[20px]" />
                  )}
                  {preferences.difficulty === "hardcore" && (
                    <div className="absolute top-0 right-0 p-4 text-red-500"><Icon name="skull" className="text-[16px] animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" /></div>
                  )}
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-[13px] font-black uppercase tracking-[0.2em] ${preferences.difficulty === "hardcore" ? "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "text-red-400"
                      }`}>Hardcore</span>
                  </div>
                  <p className="text-[11px] font-medium text-red-200/60 relative z-10">Dano permanente. Boot loops reais.</p>
                </button>
              </div>
            </div>

            <div className="rounded-[40px] border border-white/5 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/90 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-lg font-black uppercase tracking-widest text-white drop-shadow-sm">Tema</h2>
                <Icon name="refresh" className="text-[hsl(var(--accent)/0.6)] animate-spin-slow text-[20px]" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {THEME_PRESETS.map(preset => (
                  <ThemeOption
                    key={preset.id}
                    testId={`theme-option-${preset.id}`}
                    label={preset.name}
                    color={preset.color}
                    active={themeId === preset.id}
                    onClick={() => setTheme(preset.id as ThemeId)}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[40px] bg-gradient-to-b from-[#0a0f1d]/90 to-[#03050a]/95 p-10 text-center border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl group">
              <div className="mb-6 rounded-full border border-red-500/20 bg-red-950/40 p-6 text-red-500 shadow-[inset_0_2px_10px_rgba(220,38,38,0.2),0_0_30px_rgba(220,38,38,0.1)] inline-block transition-transform duration-700 group-hover:scale-110">
                <Icon name="skull" className="text-[48px] drop-shadow-[0_0_15px_rgba(220,38,38,0.6)]" />
              </div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2 drop-shadow-sm">Build v0.9.4</h3>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-slate-500">COMPILADO: 2024-05-20</p>
              <div className="mt-8 flex justify-center gap-3">
                <span className="h-2 w-2 rounded-full bg-slate-700 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]" />
                <span className="h-2 w-2 rounded-full bg-slate-700 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]" />
                <span className="h-2 w-2 rounded-full bg-slate-700 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
