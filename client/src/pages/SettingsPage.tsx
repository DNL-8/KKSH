import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Icon } from "../components/common/Icon";
import { useToast } from "../components/common/Toast";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences, type ClientPreferences } from "../contexts/PreferencesContext";
import { useTheme } from "../contexts/ThemeContext";

import { ApiRequestError, resetMeState } from "../lib/api";
import { LOCAL_MEDIA_DB_NAME, clearVideos } from "../lib/localVideosStore";

import { SettingsProfile } from "../components/settings/SettingsProfile";
import { SettingsGeneral } from "../components/settings/SettingsGeneral";
import { SettingsTelemetry } from "../components/settings/SettingsTelemetry";
import { SettingsDangerZone } from "../components/settings/SettingsDangerZone";
import { SettingsSidebar } from "../components/settings/SettingsSidebar";

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
  const { handleLogout: logout } = useAuth();
  const { preferences, setPreference, resetPreferences } = usePreferences();
  const { isIosTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [dangerBusy, setDangerBusy] = useState<"logout" | "reset" | null>(null);

  const updatePreference = useCallback(
    <K extends keyof ClientPreferences>(key: K, value: ClientPreferences[K]) => {
      setPreference(key, value);
    },
    [setPreference],
  );

  const handleSave = useCallback(() => {
    showToast("Preferencias aplicadas automaticamente.", "info");
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
        // Ignore
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
    <div
      className={`animate-in fade-in slide-in-from-bottom-8 duration-700 ${isIosTheme ? "ios26-text-secondary" : ""}`}
      data-testid="settings-page"
    >
      <div data-testid="settings-main-panel" className={`mx-auto max-w-4xl space-y-8 pb-20 ${isIosTheme ? "ios26-section" : ""}`}>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="glitch-text text-4xl font-black uppercase italic tracking-tighter text-slate-900 md:text-6xl" data-text="SISTEMA">
              SISTEMA
            </h1>
            <p className="flex items-center gap-2 font-mono text-sm text-slate-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              CONFIGURACAO DO TERMINAL DO USUARIO
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className={`flex items-center gap-3 rounded-[20px] px-8 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-95 ${isIosTheme
                ? "ios26-control ios26-focusable text-slate-800"
                : "liquid-glass-inner/80 text-slate-900 shadow-[0_0_20px_rgba(0,0,0,0.5),inset_0_2px_5px_rgba(255,255,255,0.1)] hover:bg-slate-700 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:-translate-y-1 backdrop-blur-md border border-slate-300/50"
                }`}
              type="button"
            >
              <Icon name="disk" className="text-[16px]" />
              Aplicar Agora
            </button>
          </div>
        </div>

        <SettingsProfile />

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            <SettingsGeneral preferences={preferences} updatePreference={updatePreference} />
            <SettingsTelemetry />
            <SettingsDangerZone dangerBusy={dangerBusy} executeHardReset={() => void executeHardReset()} handleLogout={() => void handleLogout()} />
          </div>

          <div className="lg:col-span-4">
            <SettingsSidebar preferences={preferences} updatePreference={updatePreference} />
          </div>
        </div>

      </div>
    </div>
  );
}
