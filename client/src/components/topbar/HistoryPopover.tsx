import { useQuery } from "@tanstack/react-query";
import { Bell, Clock3, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  getXpHistory,
  listSessions,
  type SessionOut,
  type XpHistoryEventOut,
} from "../../lib/api";
import { CHANGELOG_RELEASES } from "../../lib/changelog";
import type { AuthUser } from "../../layout/types";

interface HistoryPopoverProps {
  open: boolean;
  onClose: () => void;
  authUser: AuthUser | null;
  onOpenAuth: () => void;
  onMarkSeen: () => void;
}

type HistoryTab = "changes" | "activity";

interface HistoryActivityItem {
  id: string;
  kind: "session" | "xp";
  title: string;
  meta: string;
  createdAt: string;
  sortTime: number;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeEventLabel(eventType: string): string {
  return eventType.replace(/[._]+/g, " ").trim();
}

function toSessionItem(session: SessionOut): HistoryActivityItem {
  const subject = session.subject || "Sessao";
  return {
    id: `session-${session.id}`,
    kind: "session",
    title: `${subject} (${session.minutes} min)`,
    meta: `XP ${session.xpEarned} | Gold ${session.goldEarned}`,
    createdAt: session.createdAt,
    sortTime: Number.isNaN(new Date(session.createdAt).getTime())
      ? 0
      : new Date(session.createdAt).getTime(),
  };
}

function toXpItem(event: XpHistoryEventOut): HistoryActivityItem {
  return {
    id: `xp-${event.id}`,
    kind: "xp",
    title: normalizeEventLabel(event.eventType),
    meta: `XP +${event.xpDelta} | Gold +${event.goldDelta}`,
    createdAt: event.createdAt,
    sortTime: Number.isNaN(new Date(event.createdAt).getTime())
      ? 0
      : new Date(event.createdAt).getTime(),
  };
}

export function HistoryPopover({
  open,
  onClose,
  authUser,
  onOpenAuth,
  onMarkSeen,
}: HistoryPopoverProps) {
  const [activeTab, setActiveTab] = useState<HistoryTab>("changes");

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveTab("changes");
    onMarkSeen();
  }, [open, onMarkSeen]);

  const activityQuery = useQuery({
    queryKey: ["top-history-activity", authUser?.id ?? "guest"],
    enabled: open && activeTab === "activity" && Boolean(authUser),
    staleTime: 30_000,
    retry: 1,
    queryFn: async (): Promise<HistoryActivityItem[]> => {
      const [sessionsOut, xpOut] = await Promise.all([
        listSessions({ limit: 12 }),
        getXpHistory({ limit: 12 }),
      ]);

      const merged = [
        ...sessionsOut.sessions.map(toSessionItem),
        ...xpOut.events.map(toXpItem),
      ];

      return merged
        .sort((left, right) => right.sortTime - left.sortTime)
        .slice(0, 20);
    },
  });

  const activityItems = useMemo(
    () => activityQuery.data ?? [],
    [activityQuery.data],
  );

  if (!open) {
    return null;
  }

  return (
    <div
      id="history-popover"
      aria-modal="false"
      className="absolute right-0 top-full z-[160] mt-2 w-[min(92vw,460px)] overflow-hidden rounded-2xl border border-[hsl(var(--accent)/0.25)] bg-[#081225]/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      data-testid="history-popover"
      role="dialog"
    >
      <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-white">
            Historico
          </h3>
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-slate-500">
            Alteracoes e atividade recente
          </p>
        </div>
        <button
          className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-300 transition-colors hover:bg-slate-800"
          onClick={onClose}
          type="button"
        >
          Fechar
        </button>
      </div>

      <div className="border-b border-slate-800/60 px-3 py-2" role="tablist">
        <div className="flex items-center gap-2">
          <button
            aria-selected={activeTab === "changes"}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
              activeTab === "changes"
                ? "bg-[hsl(var(--accent)/0.2)] text-[hsl(var(--accent-light))]"
                : "bg-slate-900/70 text-slate-400 hover:text-slate-200"
            }`}
            data-testid="history-tab-changes"
            onClick={() => setActiveTab("changes")}
            role="tab"
            type="button"
          >
            Novidades
          </button>
          <button
            aria-selected={activeTab === "activity"}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
              activeTab === "activity"
                ? "bg-[hsl(var(--accent)/0.2)] text-[hsl(var(--accent-light))]"
                : "bg-slate-900/70 text-slate-400 hover:text-slate-200"
            }`}
            data-testid="history-tab-activity"
            onClick={() => setActiveTab("activity")}
            role="tab"
            type="button"
          >
            Minha atividade
          </button>
        </div>
      </div>

      {activeTab === "changes" ? (
        <div className="max-h-[420px] space-y-3 overflow-auto p-4" data-testid="history-changes-list">
          {CHANGELOG_RELEASES.map((release) => (
            <section
              key={release.id}
              className="rounded-xl border border-slate-800/80 bg-[#050b18]/80 p-3"
            >
              <h4 className="text-xs font-black uppercase tracking-wider text-cyan-300">
                {release.title}
              </h4>
              {release.items.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {release.items.map((item, index) => (
                    <li
                      key={`${release.id}-item-${index + 1}`}
                      className="text-[11px] text-slate-300"
                    >
                      - {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] text-slate-500">
                  Sem itens para esta versao.
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="max-h-[420px] overflow-auto p-4">
          {!authUser ? (
            <div className="space-y-3" data-testid="history-login-cta">
              <p className="text-xs text-slate-400">
                Faca login para ver sua atividade recente no sistema.
              </p>
              <button
                className="rounded-xl border border-[hsl(var(--accent)/0.35)] bg-[hsl(var(--accent))] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition-all hover:brightness-110"
                onClick={onOpenAuth}
                type="button"
              >
                Abrir login
              </button>
            </div>
          ) : activityQuery.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="animate-spin" size={14} />
              Carregando atividade...
            </div>
          ) : activityQuery.isError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              Nao foi possivel carregar a atividade agora.
            </div>
          ) : activityItems.length === 0 ? (
            <div className="text-xs text-slate-500" data-testid="history-empty-state">
              Sem atividade recente para mostrar.
            </div>
          ) : (
            <ol className="space-y-2" data-testid="history-activity-list">
              {activityItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-slate-800/70 bg-[#050b18]/80 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {item.meta}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500">
                      {item.kind === "session" ? (
                        <Clock3 size={12} />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="border-t border-slate-800/70 px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Bell size={12} />
          Painel de historico ativo
        </span>
      </div>
    </div>
  );
}
