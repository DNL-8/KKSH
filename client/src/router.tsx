import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { ErrorBoundary } from "./components/common/ErrorBoundary";

const AppShell = lazy(async () => {
  const mod = await import("./layout/AppShell");
  return { default: mod.AppShell };
});
const HubPage = lazy(async () => {
  const mod = await import("./pages/HubPage");
  return { default: mod.HubPage };
});
const CombatPage = lazy(async () => {
  const mod = await import("./pages/CombatPage");
  return { default: mod.CombatPage };
});
const ReviewsPage = lazy(async () => {
  const mod = await import("./pages/ReviewsPage");
  return { default: mod.ReviewsPage };
});
const FilesPage = lazy(async () => {
  const mod = await import("./pages/FilesPage");
  return { default: mod.FilesPage };
});
const EvolutionPage = lazy(async () => {
  const mod = await import("./pages/EvolutionPage");
  return { default: mod.EvolutionPage };
});
const AiPage = lazy(async () => {
  const mod = await import("./pages/AiPage");
  return { default: mod.AiPage };
});
const SettingsPage = lazy(async () => {
  const mod = await import("./pages/SettingsPage");
  return { default: mod.SettingsPage };
});
const NotFoundPage = lazy(async () => {
  const mod = await import("./pages/NotFoundPage");
  return { default: mod.NotFoundPage };
});
const SystemPage = lazy(async () => {
  const mod = await import("./pages/SystemPage");
  return { default: mod.SystemPage };
});

export function AppRouter() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div
            className="flex min-h-screen items-center justify-center bg-[#020203] p-4 text-xs font-bold uppercase tracking-[0.3em] text-[hsl(var(--accent))]"
            role="status"
            aria-live="polite"
          >
            Carregando modulo...
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Navigate to="/hub" replace />} />
          <Route element={<AppShell />}>
            <Route path="/hub" element={<HubPage />} />
            <Route path="/combate" element={<CombatPage />} />
            <Route path="/revisoes" element={<ReviewsPage />} />
            <Route path="/arquivos" element={<FilesPage />} />
            <Route path="/evolucao" element={<EvolutionPage />} />
            <Route path="/ia" element={<AiPage />} />
            <Route path="/sistema" element={<SystemPage />} />
            <Route path="/config" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
