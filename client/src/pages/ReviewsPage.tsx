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
import { useTheme } from "../contexts/ThemeContext";

export function ReviewsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { isIosTheme } = useTheme();

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
        <div className={`flex h-[60vh] flex-col items-center justify-center space-y-4 ${isIosTheme ? "ios26-text-secondary" : ""}`}>
          <Icon name="spinner" className="animate-spin text-4xl text-blue-500" />
          <p className={`text-sm font-black uppercase tracking-widest ${isIosTheme ? "text-slate-200/75" : "text-slate-500"}`}>
            Forjando cartas estelares...
          </p>
        </div>
      );
    }

    if (!activeDrill) {
      return (
        <div className={`mx-auto flex h-[60vh] w-full max-w-3xl flex-col items-center justify-center space-y-4 rounded-[36px] px-8 ${isIosTheme ? "ios26-glass-intense-soft" : ""}`}>
          <Icon name="check-circle" className="text-6xl text-emerald-500 mb-4" />
          <p className={`text-xl font-black uppercase tracking-widest ${isIosTheme ? "text-white" : "text-slate-800"}`}>
            Não há cartões pendentes!
          </p>
          <button
            onClick={() => setIsSessionActive(false)}
            className={`mt-8 rounded-full px-8 py-3 text-sm font-bold uppercase tracking-widest transition-all ${isIosTheme ? "ios26-control ios26-focusable text-slate-100 hover:text-white" : "liquid-glass-inner text-slate-900 hover:bg-white/20"}`}
          >
            Voltar ao Dashboard
          </button>
        </div>
      );
    }

    return (
      <div className={`animate-in fade-in zoom-in-95 duration-500 flex flex-col pt-10 pb-20 max-w-5xl mx-auto w-full ${isIosTheme ? "ios26-text-secondary" : ""}`}>
        <div className={`mb-8 flex items-center justify-between rounded-3xl px-4 py-3 ${isIosTheme ? "ios26-glass-intense-soft" : ""}`}>
          <button
            onClick={() => setIsSessionActive(false)}
            className={`${isIosTheme ? "ios26-control ios26-focusable text-slate-100 hover:text-white" : "text-slate-500 hover:text-slate-900"} rounded-full p-2 transition-colors`}
          >
            <Icon name="arrow-left" className="text-2xl" />
          </button>

          <div className="flex items-center gap-6">
            <div className="flex flex-col text-right">
              <span className={`text-[10px] font-black uppercase tracking-widest ${isIosTheme ? "text-slate-200/75" : "text-slate-500"}`}>
                Progresso
              </span>
              <span className={`text-sm font-bold ${isIosTheme ? "text-white" : "text-slate-800"}`}>
                {currentIndex + 1} / {currentQueue.length}
              </span>
            </div>

            {/* Progress Bar */}
            <div className={`h-2 w-32 overflow-hidden rounded-full ${isIosTheme ? "border border-white/25 bg-white/15" : "liquid-glass-inner"}`}>
              <div
                className={`h-full transition-all duration-500 ${isIosTheme ? "bg-gradient-to-r from-cyan-300 via-blue-300 to-indigo-200" : "bg-blue-500"}`}
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
    <div className={`animate-in fade-in space-y-10 duration-700 pb-20 ${isIosTheme ? "ios26-text-secondary" : ""}`}>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">

        {/* Main Hero Overview */}
        <div className="space-y-8 lg:col-span-8">
          <div
            className={`group relative overflow-hidden rounded-[40px] p-10 transition-all duration-700 ${isIosTheme
              ? "ios26-glass-intense ios26-sheen hover:shadow-[0_0_45px_rgba(156,199,255,0.28)]"
              : "border border-slate-300/50 bg-gradient-to-br from-[#0a0f1d]/90 to-[#050813]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] hover:shadow-[0_0_40px_rgba(255,255,255,0.05)] hover:border-slate-300/50"
              }`}
          >
            <div className={`absolute inset-0 ${isIosTheme ? "bg-gradient-to-br from-blue-100/10 via-white/5 to-cyan-100/10 opacity-60 mix-blend-screen" : "bg-gradient-to-br from-black/20 via-black/40 to-blue-900/20 opacity-80 mix-blend-overlay"}`} />
            <div className="pointer-events-none absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-blue-600/10 blur-[100px] transition-opacity duration-1000 group-hover:opacity-100 opacity-60" />

            <div className="relative z-10 flex flex-col justify-between gap-10 md:flex-row">
              <div className="flex-1 space-y-6">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${isIosTheme ? "ios26-pill text-cyan-100" : "border-blue-500/30 bg-blue-500/10 text-blue-400"}`}>
                    <Icon name="layer-group" className="mr-2" /> Inteligência Cristalizada
                  </span>
                </div>

                <h2 className={`text-4xl font-black uppercase italic leading-none tracking-tighter text-transparent bg-clip-text md:text-5xl ${isIosTheme ? "bg-gradient-to-r from-white via-slate-100 to-blue-100" : "bg-gradient-to-r from-white to-slate-400"}`}>
                  Revisões Diárias
                </h2>

                <p className={`max-w-md text-sm font-medium leading-relaxed ${isIosTheme ? "text-slate-100/85" : "text-slate-600"}`}>
                  O algoritmo de repetição espaçada analisa automaticamente sua curva de esquecimento. Cartões maduros exigem menos revisões.
                </p>

                <div className={`mt-6 flex gap-8 border-t pt-6 ${isIosTheme ? "border-white/30" : "border-slate-300/50"}`}>
                  <div className="flex flex-col">
                    <span className={`mb-1 text-[10px] font-bold uppercase tracking-widest ${isIosTheme ? "text-slate-200/75" : "text-slate-500"}`}>Total Respondidos</span>
                    <span className={`text-2xl font-black ${isIosTheme ? "text-white" : "text-slate-900"}`}>
                      {isPending ? "..." : stats?.totalAnswered || 0}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={`mb-1 text-[10px] font-bold uppercase tracking-widest ${isIosTheme ? "text-slate-200/75" : "text-slate-500"}`}>Precisão Global</span>
                    <span className="text-2xl font-black uppercase italic text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]">
                      {isPending ? "..." : `${Math.round((stats?.goodRate || 0) * 100)}%`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex min-w-[220px] flex-col justify-end gap-4">
                <div className={`rounded-3xl p-6 text-center ${isIosTheme ? "ios26-glass-intense-soft" : "border border-slate-300/50 liquid-glass-inner"}`}>
                  <div className={`mb-2 text-[10px] font-black uppercase tracking-widest ${isIosTheme ? "text-slate-200/80" : "text-slate-500"}`}>
                    Vencidos Hoje
                  </div>
                  <div className="text-6xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                    {isPending ? "..." : stats?.dueCount || 0}
                  </div>
                  <div className={`mt-2 text-xs font-bold ${isIosTheme ? "text-slate-200/70" : "text-slate-500"}`}>Cartões</div>
                </div>

                <button
                  onClick={handleStartSession}
                  disabled={!stats?.dueCount || stats.dueCount === 0 || isPending}
                  className={`flex w-full items-center justify-center gap-3 rounded-[32px] px-6 py-5 text-[12px] font-black uppercase tracking-[0.2em] transition-all hover:scale-105 hover:brightness-110 active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${isIosTheme
                    ? "ios26-focusable border border-white/45 bg-gradient-to-r from-emerald-400 to-emerald-300 text-slate-950 shadow-[0_0_34px_rgba(52,211,153,0.28)] hover:shadow-[0_0_44px_rgba(52,211,153,0.42)]"
                    : "bg-gradient-to-r from-emerald-500 to-emerald-400 text-black shadow-[0_0_30px_rgba(52,211,153,0.15)] hover:shadow-[0_0_40px_rgba(52,211,153,0.4)]"
                    }`}
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
                accentBg: "bg-slate-500/10",
                accentBgHover: "group-hover:bg-slate-500/20",
                accentText: "text-slate-300",
                desc: "1 a 2 repetições",
                icon: "sparkles",
              },
              {
                id: "learning",
                title: "Aprendendo",
                value: stats?.maturity.learning || 0,
                accentBg: "bg-amber-500/10",
                accentBgHover: "group-hover:bg-amber-500/20",
                accentText: "text-amber-300",
                desc: "Intervalos curtos (< 7d)",
                icon: "fire",
              },
              {
                id: "mature",
                title: "Maduros",
                value: stats?.maturity.mature || 0,
                accentBg: "bg-emerald-500/10",
                accentBgHover: "group-hover:bg-emerald-500/20",
                accentText: "text-emerald-300",
                desc: "Intervalos longos (7+ d)",
                icon: "gem",
              },
            ].map((mat) => (
              <div
                key={mat.id}
                className={`group flex flex-col gap-4 rounded-3xl p-6 text-left transition-all duration-300 hover:-translate-y-1 ${isIosTheme
                  ? "ios26-glass-intense-soft"
                  : "border border-slate-300/50 bg-white/[0.02] backdrop-blur-md hover:border-slate-300/50 hover:bg-white/[0.04]"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2 transition-colors ${mat.accentBg} ${mat.accentBgHover} ${mat.accentText}`}>
                    <Icon name={mat.icon} className="text-[20px]" />
                  </div>
                  <div>
                    <div className={`text-[10px] font-black uppercase tracking-widest ${isIosTheme ? "text-slate-200/75" : "text-slate-500/80"}`}>Estágio</div>
                    <div className={`font-black uppercase italic tracking-wide ${isIosTheme ? "text-slate-100" : "text-slate-800"}`}>{mat.title}</div>
                  </div>
                </div>
                <div className={`mt-2 origin-left text-4xl font-black transition-transform group-hover:scale-105 ${isIosTheme ? "text-white" : "text-slate-900"}`}>
                  {isPending ? "..." : mat.value}
                </div>
                <div className={`text-xs font-medium ${isIosTheme ? "text-slate-200/75" : "text-slate-500"}`}>{mat.desc}</div>
              </div>
            ))}
          </div>

        </div>

        {/* Action History / Insights Column */}
        <div className="space-y-8 lg:col-span-4">
          <div className={`flex h-full flex-col rounded-[40px] p-8 ${isIosTheme ? "ios26-glass-intense ios26-sheen" : "border border-slate-300/50 bg-gradient-to-b from-[#0a0f1d]/80 to-[#050813]/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)]"}`}>
            <h3 className={`mb-6 border-b pb-4 text-xs font-black uppercase tracking-[0.2em] ${isIosTheme ? "border-white/30 text-white" : "border-slate-300/50 text-slate-800"}`}>
              Métricas de Retenção
            </h3>

            <div className="space-y-6 flex-1">
              <div className="flex flex-col gap-2">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isIosTheme ? "text-slate-200/75" : "text-slate-500"}`}>Balanço Acertos/Erros (Absoluto)</span>
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

              <div className={`flex flex-col gap-2 border-t pt-4 ${isIosTheme ? "border-white/25" : "border-slate-300/50"}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isIosTheme ? "text-slate-200/75" : "text-slate-500"}`}>Tempo Médio de Resposta</span>
                <div className={`flex items-baseline gap-2 text-3xl font-light ${isIosTheme ? "text-white" : "text-slate-900"}`}>
                  {stats?.avgTimeMs ? (stats.avgTimeMs / 1000).toFixed(1) : "0.0"} <span className={`text-sm font-bold uppercase ${isIosTheme ? "text-slate-200/70" : "text-slate-500"}`}>segundos</span>
                </div>
              </div>

            </div>

            <div className={`mt-8 rounded-2xl p-5 ${isIosTheme ? "ios26-glass-intense-soft" : "border border-blue-500/20 bg-blue-900/10"}`}>
              <h4 className={`mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${isIosTheme ? "text-sky-200" : "text-blue-400"}`}>
                <Icon name="info-circle" /> Espaçamento Ativo
              </h4>
              <p className={`text-xs font-medium leading-relaxed ${isIosTheme ? "text-slate-100/75" : "text-blue-200/60"}`}>
                Os cálculos de maturidade e repetição espaçada seguem os princípios SuperMemo. Para editar o catálogo primário de cartões, os Admins devem acessar a interface de criação via Backend.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
