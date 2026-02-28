import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type DueDrillOut,
  getReviewStats,
  listDueReviews,
  submitDrillReview,
} from "../lib/api";
import { Icon } from "../components/common/Icon";
import { Flashcard } from "../components/reviews/Flashcard";
import { useToast } from "../components/common/Toast";

export function ReviewsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentQueue, setCurrentQueue] = useState<DueDrillOut[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Queries
  const statsQuery = useQuery({
    queryKey: ["reviews", "stats"],
    queryFn: getReviewStats,
  });

  const dueQuery = useQuery({
    queryKey: ["reviews", "due"],
    queryFn: () => listDueReviews(100),
    enabled: isSessionActive && currentQueue.length === 0,
  });

  // Mutations
  const reviewMutation = useMutation({
    mutationFn: ({
      drillId,
      result,
      elapsedMs,
    }: {
      drillId: string;
      result: "good" | "again";
      elapsedMs: number;
    }) => submitDrillReview({ drillId, result, elapsedMs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", "stats"] });
      // We don't necessarily invalidate 'due' immediately to avoid jumping, 
      // but we will advance the local queue index.
    },
    onError: () => {
      showToast("Falha ao sincronizar resposta.", "error");
    },
  });

  // Start Session handler
  const handleStartSession = async () => {
    setIsSessionActive(true);
    setCurrentIndex(0);
    // If we already have data fetched from the dueQuery, populate the queue
    if (dueQuery.data && dueQuery.data.length > 0) {
      setCurrentQueue(dueQuery.data);
    }
  };

  // If dueQuery finishes fetching AFTER we click Start
  useEffect(() => {
    if (isSessionActive && dueQuery.data && currentQueue.length === 0) {
      setCurrentQueue(dueQuery.data);
    }
  }, [dueQuery.data, isSessionActive, currentQueue.length]);

  const handleAnswer = (result: "good" | "again", elapsedMs: number) => {
    const drill = currentQueue[currentIndex];
    if (!drill) return;

    // Fire & Forget mutation (optimistic local progression)
    reviewMutation.mutate({ drillId: drill.drillId, result, elapsedMs });

    // Advance queue
    if (currentIndex + 1 < currentQueue.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Session finished
      setIsSessionActive(false);
      setCurrentQueue([]);
      setCurrentIndex(0);
      showToast("Sessão finalizada! Bom trabalho.", "success");
      queryClient.invalidateQueries({ queryKey: ["reviews", "due"] });
    }
  };

  const handleSkip = () => {
    if (currentIndex + 1 < currentQueue.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsSessionActive(false);
      setCurrentQueue([]);
      showToast("Sessão ignorada parcialmente.", "info");
    }
  };

  const activeDrill = currentQueue[currentIndex];

  // ---------------------------------------------------------------------------
  // RENDER: SESSION ACTIVE
  // ---------------------------------------------------------------------------
  if (isSessionActive) {
    if (dueQuery.isLoading) {
      return (
        <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
          <Icon name="spinner" className="animate-spin text-4xl text-blue-500" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-500">
            Forjando cartas estelares...
          </p>
        </div>
      );
    }

    if (!activeDrill) {
      return (
        <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
          <Icon name="check-circle" className="text-6xl text-emerald-500 mb-4" />
          <p className="text-xl font-black uppercase tracking-widest text-slate-800">
            Não há cartões pendentes!
          </p>
          <button
            onClick={() => setIsSessionActive(false)}
            className="mt-8 rounded-full liquid-glass-inner px-8 py-3 text-sm font-bold uppercase tracking-widest text-slate-900 hover:bg-white/20 transition-all"
          >
            Voltar ao Dashboard
          </button>
        </div>
      );
    }

    return (
      <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col pt-10 pb-20 max-w-5xl mx-auto w-full">
        <div className="mb-8 flex items-center justify-between px-4">
          <button
            onClick={() => setIsSessionActive(false)}
            className="text-slate-500 hover:text-slate-900 transition-colors"
          >
            <Icon name="arrow-left" className="text-2xl" />
          </button>

          <div className="flex items-center gap-6">
            <div className="flex flex-col text-right">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Progresso
              </span>
              <span className="text-sm font-bold text-slate-800">
                {currentIndex + 1} / {currentQueue.length}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 w-32 overflow-hidden rounded-full liquid-glass-inner">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${((currentIndex + 1) / currentQueue.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <Flashcard
          key={activeDrill.drillId} // Force remount if ID changes significantly
          drill={activeDrill}
          onAnswer={handleAnswer}
          onSkip={handleSkip}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: DASHBOARD VIEW
  // ---------------------------------------------------------------------------
  const stats = statsQuery.data;
  const isPending = statsQuery.isPending;

  return (
    <div className="animate-in fade-in space-y-10 duration-700 pb-20">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">

        {/* Main Hero Overview */}
        <div className="space-y-8 lg:col-span-8">
          <div className="group relative overflow-hidden rounded-[40px] border border-slate-300/50 bg-gradient-to-br from-[#0a0f1d]/90 to-[#050813]/95 backdrop-blur-2xl p-10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] transition-all duration-700 hover:shadow-[0_0_40px_rgba(255,255,255,0.05)] hover:border-slate-300/50">
            <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-black/40 to-blue-900/20 opacity-80 mix-blend-overlay" />
            <div className="pointer-events-none absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-blue-600/10 blur-[100px] transition-opacity duration-1000 group-hover:opacity-100 opacity-60" />

            <div className="relative z-10 flex flex-col justify-between gap-10 md:flex-row">
              <div className="flex-1 space-y-6">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-400">
                    <Icon name="layer-group" className="mr-2" /> Inteligência Cristalizada
                  </span>
                </div>

                <h2 className="text-4xl font-black uppercase italic leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 md:text-5xl">
                  Revisões Diárias
                </h2>

                <p className="max-w-md text-sm font-medium leading-relaxed text-slate-600">
                  O algoritmo de repetição espaçada analisa automaticamente sua curva de esquecimento. Cartões maduros exigem menos revisões.
                </p>

                <div className="flex gap-8 border-t border-slate-300/50 pt-6 mt-6">
                  <div className="flex flex-col">
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Respondidos</span>
                    <span className="text-2xl font-black text-slate-900">
                      {isPending ? "..." : stats?.totalAnswered || 0}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Precisão Global</span>
                    <span className="text-2xl font-black uppercase italic text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]">
                      {isPending ? "..." : `${Math.round((stats?.goodRate || 0) * 100)}%`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-end gap-4 min-w-[220px]">
                <div className="rounded-3xl border border-slate-300/50 liquid-glass-inner p-6 text-center">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Vencidos Hoje
                  </div>
                  <div className="text-6xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                    {isPending ? "..." : stats?.dueCount || 0}
                  </div>
                  <div className="mt-2 text-xs font-bold text-slate-500">Cartões</div>
                </div>

                <button
                  onClick={handleStartSession}
                  disabled={!stats?.dueCount || stats.dueCount === 0 || isPending}
                  className="flex w-full items-center justify-center gap-3 rounded-[32px] bg-gradient-to-r from-emerald-500 to-emerald-400 px-6 py-5 text-[12px] font-black uppercase tracking-[0.2em] text-black shadow-[0_0_30px_rgba(52,211,153,0.15)] transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(52,211,153,0.4)] hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  type="button"
                >
                  <Icon name="play" className="text-[16px]" /> Iniciar Sessão
                </button>
              </div>
            </div>
          </div>

          {/* Maturity Heatmap / Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                id: "new",
                title: "Novos",
                value: stats?.maturity.new || 0,
                color: "slate",
                desc: "1 a 2 repetições",
                icon: "sparkles",
              },
              {
                id: "learning",
                title: "Aprendendo",
                value: stats?.maturity.learning || 0,
                color: "amber",
                desc: "Intervalos curtos (< 7d)",
                icon: "fire",
              },
              {
                id: "mature",
                title: "Maduros",
                value: stats?.maturity.mature || 0,
                color: "emerald",
                desc: "Intervalos longos (7+ d)",
                icon: "gem",
              },
            ].map((mat) => (
              <div
                key={mat.id}
                className="group flex flex-col gap-4 rounded-3xl border border-slate-300/50 bg-white/[0.02] p-6 text-left transition-all duration-300 backdrop-blur-md hover:border-slate-300/50 hover:bg-white/[0.04] hover:-translate-y-1"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl bg-${mat.color}-500/10 p-2 text-${mat.color}-400 group-hover:bg-${mat.color}-500/20 transition-colors`}>
                    <Icon name={mat.icon} className="text-[20px]" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500/80">Estágio</div>
                    <div className="font-black uppercase italic tracking-wide text-slate-800">{mat.title}</div>
                  </div>
                </div>
                <div className="mt-2 text-4xl font-black text-slate-900 group-hover:scale-105 transition-transform origin-left">
                  {isPending ? "..." : mat.value}
                </div>
                <div className="text-xs font-medium text-slate-500">{mat.desc}</div>
              </div>
            ))}
          </div>

        </div>

        {/* Action History / Insights Column */}
        <div className="space-y-8 lg:col-span-4">
          <div className="rounded-[40px] border border-slate-300/50 bg-gradient-to-b from-[#0a0f1d]/80 to-[#050813]/90 backdrop-blur-xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col h-full">
            <h3 className="mb-6 border-b border-slate-300/50 pb-4 text-xs font-black uppercase tracking-[0.2em] text-slate-800">
              Métricas de Retenção
            </h3>

            <div className="space-y-6 flex-1">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Balanço Acertos/Erros (Absoluto)</span>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-red-500/20">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-1000"
                    style={{ width: `${(stats?.totalAnswered || 0) > 0 ? ((stats?.goodCount || 0) / (stats?.totalAnswered || 1)) * 100 : 50}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-bold mt-1">
                  <span className="text-emerald-500">{stats?.goodCount || 0} Good</span>
                  <span className="text-red-500">{stats?.againCount || 0} Again</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-4 border-t border-slate-300/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tempo Médio de Resposta</span>
                <div className="text-3xl font-light text-slate-900 flex items-baseline gap-2">
                  {stats?.avgTimeMs ? (stats.avgTimeMs / 1000).toFixed(1) : "0.0"} <span className="text-sm text-slate-500 font-bold uppercase">segundos</span>
                </div>
              </div>

            </div>

            <div className="mt-8 rounded-2xl bg-blue-900/10 border border-blue-500/20 p-5">
              <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">
                <Icon name="info-circle" /> Espaçamento Ativo
              </h4>
              <p className="text-xs text-blue-200/60 leading-relaxed font-medium">
                Os cálculos de maturidade e repetição espaçada seguem os princípios SuperMemo. Para editar o catálogo primário de cartões, os Admins devem acessar a interface de criação via Backend.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
