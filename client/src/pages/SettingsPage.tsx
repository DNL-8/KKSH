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

  const visibleFilesTelemetryEvents = useMemo(
    () => filesTelemetryEvents.slice(0, 40),
    [filesTelemetryEvents],
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
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-white text-xl font-bold uppercase tracking-tight focus:outline-none focus:border-cyan-500 min-w-[200px]"
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
                      className="p-2 rounded-full hover:bg-slate-800 text-slate-500 hover:text-cyan-400 transition-colors"
                    >
                      <Icon name="pencil" className="text-[14px]" />
                    </button>
                  </>
                )}

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

          {/* Files Telemetry */}
          <section>
            <div className="mb-6 flex items-center gap-4">
              <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-500"><Icon name="database" className="text-[24px]" /></div>
              <h2 className="text-lg font-bold uppercase tracking-widest text-white">Telemetria de Arquivos</h2>
            </div>

            <div className="rounded-[32px] border border-slate-800 bg-[#0a0a0b]/80 p-6 backdrop-blur-xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-slate-400">
                  Eventos locais de importacao, backup e reproducao da bridge para diagnostico rapido.
                </p>
                                <div className="flex gap-2">
                  <button
                    onClick={refreshFilesTelemetry}
                    className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 transition-colors hover:bg-slate-800"
                    type="button"
                  >
                    Atualizar
                  </button>
                  <button
                    onClick={handleExportFilesTelemetry}
                    disabled={filesTelemetryEvents.length === 0}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                  >
                    Exportar JSON
                  </button>
                  <button
                    onClick={handleClearFilesTelemetry}
                    disabled={filesTelemetryEvents.length === 0}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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

              {filesTelemetryEvents.length === 0 ? (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">
                  Sem eventos de telemetria no momento.
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
                    <p className="text-sm text-red-200/60">Limpa dados locais e zera progresso da conta. Nao apaga o usuario.</p>
                  </div>
                  <HoldButton
                    label="SEGURE PARA DELETAR TUDO"
                    onComplete={() => void executeHardReset()}
                    loading={dangerBusy === "reset"}
                    holdDuration={1000}
                    progressLabel="CONFIRMANDO"
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
                <button
                  onClick={() => updatePreference("difficulty", "casual")}
                  className={`rounded-2xl p-4 border transition-all text-left group ${preferences.difficulty === "casual"
                    ? "bg-slate-900 border-emerald-500/50 opacity-100"
                    : "bg-slate-900/50 border-slate-800 opacity-50 grayscale hover:grayscale-0 hover:opacity-100"
                    }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className={`font-black uppercase tracking-wider ${preferences.difficulty === "casual" ? "text-emerald-400" : "text-white"
                      }`}>Casual</span>
                    {preferences.difficulty === "casual" && (
                      <Icon name="check-circle" className="text-emerald-500 text-[18px]" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Modo historia sem desafios.</p>
                </button>

                <button
                  onClick={() => updatePreference("difficulty", "hardcore")}
                  className={`rounded-2xl p-4 border transition-all text-left relative overflow-hidden group ${preferences.difficulty === "hardcore"
                    ? "bg-red-900/20 border-red-500/50"
                    : "bg-red-900/5 border-red-500/10 hover:bg-red-900/10 hover:border-red-500/30"
                    }`}
                >
                  {preferences.difficulty === "hardcore" && (
                    <div className="absolute top-0 right-0 p-2 text-red-500"><Icon name="skull" className="text-[14px]" /></div>
                  )}
                  <div className="flex justify-between items-center mb-2">
                    <span className={`font-black uppercase tracking-wider ${preferences.difficulty === "hardcore" ? "text-red-500" : "text-red-400"
                      }`}>Hardcore</span>
                    {preferences.difficulty === "hardcore" && (
                      <Icon name="check-circle" className="text-red-500 text-[18px]" />
                    )}
                  </div>
                  <p className="text-xs text-red-200/60">Dano permanente. Boot loops reais.</p>
                </button>
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
                    testId={`theme-option-${preset.id}`}
                    label={preset.name}
                    color={preset.color}
                    active={themeId === preset.id}
                    onClick={() => setTheme(preset.id as ThemeId)}
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
  );
}
