import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";

import { Badge, StatPill } from "../components/common";
import { Icon } from "../components/common/Icon";
import { useToast } from "../components/common/Toast";
import type { AppShellContextValue } from "../layout/types";
import {
  ApiRequestError,
  answerCombatQuestion,
  drawCombatQuestion,
  startCombatBattle,
} from "../lib/api";
import { widthPercentClass } from "../lib/percentClasses";
import { EXCEL_MODULES } from "../lib/excel_modules";

interface DamagePopup {
  val: number;
  type: "damage" | "miss";
}

interface CombatLocationState {
  moduleId?: string;
}

type TurnState = "PLAYER_IDLE" | "PLAYER_QUIZ" | "PLAYER_ATTACKING" | "ENEMY_TURN" | "VICTORY" | "DEFEAT";
type ActiveQuestion = {
  id: string;
  text: string;
  options: string[];
};

const PLAYER_MAX_HP = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function CombatPage() {
  const { openAuthPanel } = useOutletContext<AppShellContextValue>();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const invalidateProgressCaches = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["auth", "progress"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-state"] }),
      queryClient.invalidateQueries({ queryKey: ["evolution-state"] }),
    ]);
  }, [queryClient]);

  const fallbackModule = EXCEL_MODULES[0];
  const requestedModuleId = (location.state as CombatLocationState | null)?.moduleId;
  const activeModuleId = requestedModuleId ?? fallbackModule.id;
  const currentModule = EXCEL_MODULES.find((moduleItem) => moduleItem.id === activeModuleId) ?? fallbackModule;
  const activeModuleIdRef = useRef<string>(activeModuleId);

  const [bossName, setBossName] = useState(currentModule.boss.name);
  const [bossRank, setBossRank] = useState(currentModule.boss.rank);

  const [battleId, setBattleId] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [enemyHp, setEnemyHp] = useState(currentModule.boss.hp);
  const [enemyMaxHp, setEnemyMaxHp] = useState(currentModule.boss.hp);
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [playerMaxHp, setPlayerMaxHp] = useState(PLAYER_MAX_HP);
  const [damagePopup, setDamagePopup] = useState<DamagePopup | null>(null);
  const [shake, setShake] = useState(false);
  const [combatLogs, setCombatLogs] = useState<string[]>([
    "Sincronizando batalha com o servidor...",
  ]);
  const [turnState, setTurnState] = useState<TurnState>("PLAYER_IDLE");
  const [currentQuestion, setCurrentQuestion] = useState<ActiveQuestion | null>(null);
  const [loadingBattle, setLoadingBattle] = useState(true);
  const [answering, setAnswering] = useState(false);

  const battleIdRef = useRef<string | null>(null);

  useEffect(() => {
    battleIdRef.current = battleId;
  }, [battleId]);

  useEffect(() => {
    activeModuleIdRef.current = activeModuleId;
  }, [activeModuleId]);

  const pushCombatLog = useCallback((entry: string, maxEntries = 6) => {
    setCombatLogs((previous) => [entry, ...previous].slice(0, maxEntries));
  }, []);

  const applyBattleState = useCallback(
    (state: {
      battleId: string;
      playerHp: number;
      playerMaxHp: number;
      enemyHp: number;
      enemyMaxHp: number;
      turn: TurnState | "PLAYER_ATTACKING" | "ENEMY_TURN";
      status: "ongoing" | "victory" | "defeat";
    }) => {
      setBattleId(state.battleId);
      setPlayerHp(state.playerHp);
      setPlayerMaxHp(state.playerMaxHp);
      setEnemyHp(state.enemyHp);
      setEnemyMaxHp(state.enemyMaxHp);
      if (state.status === "victory") {
        setTurnState("VICTORY");
        return;
      }
      if (state.status === "defeat") {
        setTurnState("DEFEAT");
        return;
      }
      setTurnState(state.turn === "PLAYER_QUIZ" ? "PLAYER_QUIZ" : "PLAYER_IDLE");
    },
    [],
  );

  const initBattle = useCallback(
    async (reset = false) => {
      setLoadingBattle(true);
      setCurrentQuestion(null);
      setDamagePopup(null);
      setShake(false);
      try {
        const result = await startCombatBattle({
          moduleId: requestedModuleId ?? activeModuleIdRef.current,
          reset,
        });
        setLoginRequired(false);
        applyBattleState(result.battleState);
        setBossName(result.boss.name);
        setBossRank(result.boss.rank);
        setEnemyMaxHp(result.boss.hp);
        setCombatLogs([`Batalha iniciada: ${result.boss.name} [Rank ${result.boss.rank}]`]);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) {
          setLoginRequired(true);
          setBattleId(null);
          setTurnState("PLAYER_IDLE");
          setCombatLogs(["Login necessario para iniciar o combate backend."]);
        } else {
          const message =
            error instanceof ApiRequestError ? error.message : "Nao foi possivel iniciar a batalha.";
          pushCombatLog(message);
          showToast(message, "error");
        }
      } finally {
        setLoadingBattle(false);
      }
    },
    [applyBattleState, pushCombatLog, requestedModuleId, showToast],
  );

  useEffect(() => {
    void initBattle(false);
  }, [initBattle]);

  const startPlayerAttack = useCallback(async () => {
    if (turnState !== "PLAYER_IDLE" || loadingBattle || answering) {
      return;
    }
    if (!battleIdRef.current) {
      showToast("Batalha nao inicializada.", "error");
      return;
    }
    try {
      const result = await drawCombatQuestion(battleIdRef.current);
      applyBattleState(result.battleState);
      setCurrentQuestion(result.question);
    } catch (error) {
      const message =
        error instanceof ApiRequestError ? error.message : "Nao foi possivel carregar a pergunta.";
      pushCombatLog(message);
      showToast(message, "error");
    }
  }, [answering, applyBattleState, loadingBattle, pushCombatLog, showToast, turnState]);

  const handleAnswer = useCallback(
    async (optionIndex: number) => {
      if (turnState !== "PLAYER_QUIZ" || !currentQuestion || answering) {
        return;
      }

      const activeQuestion = currentQuestion;
      const activeBattleId = battleIdRef.current;
      if (!activeBattleId) {
        showToast("Batalha nao inicializada.", "error");
        return;
      }

      setAnswering(true);
      setCurrentQuestion(null);
      setTurnState("PLAYER_ATTACKING");

      try {
        const result = await answerCombatQuestion({
          battleId: activeBattleId,
          questionId: activeQuestion.id,
          optionIndex,
        });

        const correct = result.result === "correct";
        setDamagePopup(correct ? { val: result.playerDamage, type: "damage" } : { val: 0, type: "miss" });
        if (correct) {
          pushCombatLog(`Acertou! Causou ${result.playerDamage} de dano.`);
        } else {
          pushCombatLog("Errou! Ataque sem dano.");
        }

        if (result.enemyDamage > 0) {
          pushCombatLog(`${bossName} atacou: -${result.enemyDamage} HP`);
        }

        if (result.playerDamage > 0 || result.enemyDamage > 0) {
          setShake(true);
          window.setTimeout(() => setShake(false), 450);
        }

        window.setTimeout(() => {
          setDamagePopup(null);
        }, 900);

        applyBattleState(result.battleState);

        if (result.battleState.status === "victory") {
          pushCombatLog(">>> BOSS DERROTADO! VITORIA! <<<");
          showToast(`${bossName} derrotado!`, "success");
          void invalidateProgressCaches();
        } else if (result.battleState.status === "defeat") {
          pushCombatLog(">>> VOCE FOI DERROTADO <<<");
          showToast("Voce foi derrotado.", "error");
        }
      } catch (error) {
        const message =
          error instanceof ApiRequestError ? error.message : "Falha ao enviar resposta.";
        pushCombatLog(message);
        showToast(message, "error");
        setTurnState("PLAYER_IDLE");
      } finally {
        setAnswering(false);
      }
    },
    [
      answering,
      applyBattleState,
      bossName,
      currentQuestion,
      pushCombatLog,
      showToast,
      invalidateProgressCaches,
      turnState,
    ],
  );

  const resetBattle = useCallback(() => {
    void initBattle(true);
  }, [initBattle]);

  const handleNextChallenge = useCallback(() => {
    const currentIndex = EXCEL_MODULES.findIndex((moduleItem) => moduleItem.id === activeModuleId);
    const nextModule = EXCEL_MODULES[currentIndex + 1];
    if (!nextModule) {
      showToast("Voce derrotou todos os modulos. Parabens!", "success");
      navigate("/revisoes");
      return;
    }
    navigate("/combate", { state: { moduleId: nextModule.id } });
  }, [activeModuleId, navigate, showToast]);

  const hpPercent = useMemo(() => clamp((enemyHp / Math.max(1, enemyMaxHp)) * 100, 0, 100), [enemyHp, enemyMaxHp]);
  const playerHpPercent = useMemo(
    () => clamp((playerHp / Math.max(1, playerMaxHp)) * 100, 0, 100),
    [playerHp, playerMaxHp],
  );
  const canAttack =
    turnState === "PLAYER_IDLE" &&
    !loadingBattle &&
    !answering &&
    Boolean(battleId) &&
    !loginRequired;

  return (
    <div className={`animate-in slide-in-from-bottom-8 duration-1000 ${shake ? "animate-shake" : ""}`} data-testid="combat-page">
      {turnState === "PLAYER_QUIZ" && currentQuestion && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-[#02050a]/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-300"
          data-testid="quiz-modal"
        >
          <div className="w-full max-w-2xl rounded-[40px] border border-cyan-500/30 bg-[#050813]/90 p-10 shadow-[0_0_60px_rgba(34,211,238,0.15),inset_0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <div className="mb-8 flex items-center justify-between border-b border-cyan-500/20 pb-6">
              <h3 className="flex items-center gap-3 text-lg font-black uppercase tracking-widest text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
                <Icon name="brain" />
                Desafio Incursão
              </h3>
              <Badge color="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" icon="crossed-swords">
                Dano Crítico
              </Badge>
            </div>

            <p className="mb-10 text-xl font-bold leading-relaxed text-white drop-shadow-md" data-testid="quiz-question-text">
              {currentQuestion.text}
            </p>

            <div className="grid gap-4">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={`${currentQuestion.id}-${index}`}
                  onClick={() => void handleAnswer(index)}
                  className="group flex w-full items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-left transition-all duration-300 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:shadow-[0_0_20px_rgba(34,211,238,0.2),inset_0_0_10px_rgba(34,211,238,0.1)] hover:-translate-y-1 disabled:opacity-60"
                  type="button"
                  disabled={answering}
                  data-testid={`quiz-option-${index}`}
                >
                  <span className="text-sm font-bold text-slate-300 transition-colors group-hover:text-white group-hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.7)]">{option}</span>
                  <Icon name="arrow-right" className="text-cyan-400 opacity-0 transition-opacity group-hover:opacity-100 text-[18px]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="relative flex min-h-[60vh] flex-col items-center overflow-hidden rounded-[56px] border border-red-900/30 bg-[#050506] p-6 shadow-[inset_0_0_100px_rgba(220,38,38,0.1)] md:min-h-[750px] md:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.15),transparent_70%)] opacity-60" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1f1212_1px,transparent_1px),linear-gradient(to_bottom,#1f1212_1px,transparent_1px)] bg-[size:80px_80px] opacity-10" />

        <div className="relative z-20 mb-10 flex w-full items-start justify-between">
          <div className="flex gap-2">
            <Badge color="bg-red-600 text-white" icon="skull">
              Rank {bossRank}
            </Badge>
            <Badge color={`${currentModule.color} border-white/10 bg-white/5`} icon="bolt">
              {currentModule.difficulty}
            </Badge>
          </div>
          <div className="flex flex-col items-end">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Icon name="shield" className="text-[12px]" />
              HP jogador
            </div>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-800">
              <div className={`h-full bg-blue-500 transition-all duration-300 ${widthPercentClass(playerHpPercent)}`} />
            </div>
          </div>
        </div>

        <div className="group relative z-10 my-auto cursor-crosshair">
          {damagePopup && (
            <div
              className={`animate-float-up absolute -top-24 left-1/2 z-30 -translate-x-1/2 text-5xl font-black italic drop-shadow-[0_0_25px_rgba(220,38,38,0.8)] ${damagePopup.type === "miss" ? "text-slate-400" : "text-red-500"
                }`}
              data-testid="damage-popup"
            >
              {damagePopup.type === "miss" ? "MISS" : `-${damagePopup.val}`}
            </div>
          )}
          <div className="absolute inset-0 animate-pulse-slow rounded-full bg-red-600/20 opacity-40 blur-[100px] transition-all duration-700 group-hover:bg-red-600/40" />

          <div className="relative z-10 flex h-48 w-48 items-center justify-center rounded-full bg-slate-900/50 text-6xl transition-transform duration-300 hover:scale-105 md:h-96 md:w-96">
            <Icon name="skull" className={`${currentModule.color} ${enemyHp <= 0 ? "opacity-20" : "animate-pulse"} text-[120px]`} />
          </div>
        </div>

        {turnState === "VICTORY" && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-1000"
            data-testid="combat-victory-overlay"
          >
            <div className="absolute inset-0 bg-emerald-950/20 backdrop-blur-xl mix-blend-overlay" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050813]/80 to-[#050813]" />

            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
              <div className="rounded-full bg-emerald-500/20 p-8 shadow-[0_0_100px_rgba(16,185,129,0.5),inset_0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30">
                <Icon name="trophy" className="text-emerald-400 text-[56px] drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
              </div>
              <h2 className="text-5xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-emerald-200 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] md:text-7xl">Vitoria!</h2>
              <p className="text-sm font-black uppercase tracking-[0.4em] text-emerald-300 drop-shadow-md">{bossName} derrotado</p>
              <div className="flex gap-4 mt-2">
                <StatPill label="XP ganho" value="Backend" color="text-yellow-400" />
                <StatPill label="Loot" value="Sincronizado" color="text-purple-400" />
              </div>
              <div className="flex gap-5 mt-4">
                <button
                  onClick={resetBattle}
                  className="mt-4 flex items-center gap-3 rounded-[32px] border border-emerald-500/40 bg-emerald-900/40 px-8 py-5 text-[11px] font-black uppercase tracking-[0.3em] text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all hover:bg-emerald-800/60 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:-translate-y-1"
                  type="button"
                  data-testid="combat-victory-retry"
                >
                  <Icon name="crossed-swords" className="text-[18px]" />
                  Batalhar novamente
                </button>
                <button
                  onClick={handleNextChallenge}
                  className="mt-4 flex items-center gap-3 rounded-[32px] bg-gradient-to-r from-emerald-600 to-emerald-400 px-12 py-5 text-xs font-black uppercase tracking-[0.3em] text-black shadow-[0_20px_60px_rgba(16,185,129,0.5)] transition-all hover:scale-105 hover:shadow-[0_20px_80px_rgba(16,185,129,0.7)] active:scale-95"
                  type="button"
                  data-testid="combat-victory-next-module"
                >
                  <Icon name="bolt" className="text-[20px]" />
                  Proximo modulo
                </button>
              </div>
            </div>
          </div>
        )}

        {turnState === "DEFEAT" && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-1000"
            data-testid="combat-defeat-overlay"
          >
            <div className="absolute inset-0 bg-red-950/20 backdrop-blur-xl mix-blend-overlay" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0505]/80 to-[#0a0505]" />

            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
              <div className="rounded-full bg-red-500/20 p-8 shadow-[0_0_100px_rgba(239,68,68,0.5),inset_0_0_30px_rgba(239,68,68,0.3)] border border-red-500/30">
                <Icon name="skull" className="text-red-400 text-[56px] drop-shadow-[0_0_15px_rgba(248,113,113,0.8)]" />
              </div>
              <h2 className="text-5xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-red-200 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] md:text-7xl">Derrota</h2>
              <p className="text-sm font-black uppercase tracking-[0.4em] text-red-300 drop-shadow-md">Sincronia Interrompida</p>
              <div className="flex gap-5 mt-6">
                <button
                  onClick={resetBattle}
                  className="mt-4 flex items-center gap-3 rounded-[32px] border border-red-500/40 bg-red-900/40 px-8 py-5 text-[11px] font-black uppercase tracking-[0.3em] text-red-200 shadow-[0_0_30px_rgba(239,68,68,0.15)] transition-all hover:bg-red-800/60 hover:shadow-[0_0_40px_rgba(239,68,68,0.3)] hover:-translate-y-1"
                  type="button"
                  data-testid="combat-defeat-retry"
                >
                  <Icon name="crossed-swords" className="text-[18px]" />
                  Tentar novamente
                </button>
                <button
                  onClick={() => navigate("/revisoes")}
                  className="mt-4 flex items-center gap-3 rounded-[32px] border border-white/5 bg-white/[0.05] backdrop-blur-md px-12 py-5 text-xs font-black uppercase tracking-[0.3em] text-white shadow-xl transition-all hover:bg-white/[0.1] hover:scale-105 active:scale-95"
                  type="button"
                  data-testid="combat-defeat-back"
                >
                  <Icon name="bolt" className="text-[20px]" />
                  Voltar revisoes
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="relative z-20 mt-12 w-full max-w-3xl space-y-10 text-center">
          <div className="space-y-4">
            <h2
              className="glitch-text text-4xl font-black uppercase italic leading-none tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] md:text-8xl"
              data-text={bossName.toUpperCase()}
            >
              {bossName.toUpperCase()}
            </h2>
            <div className="flex justify-center gap-2">
              <StatPill label="ATK" value={currentModule.boss.stats.atk} color="text-red-400" />
              <StatPill label="DEF" value={currentModule.boss.stats.def} color="text-blue-400" />
              <StatPill label="SPD" value={currentModule.boss.stats.spd} color="text-yellow-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-end justify-between px-4">
                <span className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-red-500 drop-shadow-sm">
                  <Icon name="skull" className="text-[18px]" />
                  HP boss
                </span>
                <span className="font-mono text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-red-100 drop-shadow-sm">
                  <span data-testid="enemy-hp-value">{enemyHp}</span>/<span data-testid="enemy-hp-max">{enemyMaxHp}</span>
                </span>
              </div>
              <div className="h-8 w-full overflow-hidden rounded-3xl border border-red-950/50 bg-black/80 shadow-[inset_0_5px_15px_rgba(0,0,0,0.8)] ring-2 ring-red-950/30 backdrop-blur-sm p-1">
                <div
                  className={`relative h-full rounded-2xl bg-gradient-to-r from-red-900 via-red-600 to-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6),inset_0_2px_4px_rgba(255,255,255,0.4)] transition-all duration-700 ease-out ${widthPercentClass(hpPercent)}`}
                  data-testid="enemy-hp-bar"
                >
                  <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-end justify-between px-4">
                <span className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-400 drop-shadow-sm">
                  <Icon name="shield" className="text-[18px]" />
                  HP Operador
                </span>
                <span className="font-mono text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-100 drop-shadow-sm">
                  <span data-testid="player-hp-value">{playerHp}</span>/<span data-testid="player-hp-max">{playerMaxHp}</span>
                </span>
              </div>
              <div className="h-8 w-full overflow-hidden rounded-3xl border border-cyan-950/50 bg-black/80 shadow-[inset_0_5px_15px_rgba(0,0,0,0.8)] ring-2 ring-cyan-950/30 backdrop-blur-sm p-1">
                <div
                  className={`relative h-full rounded-2xl bg-gradient-to-r from-blue-900 via-blue-500 to-cyan-400 shadow-[0_0_20px_rgba(59,130,246,0.6),inset_0_2px_4px_rgba(255,255,255,0.4)] transition-all duration-700 ease-out ${widthPercentClass(playerHpPercent)}`}
                  data-testid="player-hp-bar"
                >
                  <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
                </div>
              </div>
            </div>
          </div>

          <div className="mask-linear-fade flex h-24 flex-col items-center justify-end space-y-1 overflow-hidden font-mono text-[10px] text-slate-500" data-testid="combat-log-list">
            {combatLogs.map((log, index) => (
              <div key={`${log}-${index}`} className={`${index === 0 ? "font-bold text-white" : "opacity-60"} uppercase tracking-wider`}>
                {log}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 pt-2">
            <button
              onClick={() => void startPlayerAttack()}
              disabled={!canAttack}
              className={`flex items-center gap-4 rounded-[32px] px-10 py-5 text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_20px_50px_rgba(220,38,38,0.4)] transition-all active:scale-95 md:gap-5 md:px-16 md:py-7 md:text-sm ${canAttack ? "bg-gradient-to-r from-red-600 to-red-500 hover:scale-105 hover:shadow-[0_0_40px_rgba(220,38,38,0.7)] animate-pulse hover:animate-none" : "cursor-not-allowed bg-slate-800 opacity-50"
                }`}
              type="button"
              data-testid="combat-attack-button"
            >
              <Icon name="crossed-swords" className="text-[20px]" />
              {loadingBattle
                ? "Iniciando..."
                : turnState === "PLAYER_IDLE"
                  ? "Iniciar ataque"
                  : turnState === "PLAYER_QUIZ"
                    ? "Responda a pergunta"
                    : "Combatendo..."}
            </button>
            <button
              className="group flex items-center gap-4 rounded-[32px] border border-slate-800 bg-[#0a0a0b] px-10 py-5 text-xs font-black uppercase tracking-[0.3em] text-slate-400 shadow-xl transition-all hover:border-[hsl(var(--accent)/0.5)] hover:text-[hsl(var(--accent))] active:scale-95 md:gap-5 md:px-16 md:py-7 md:text-sm"
              type="button"
              disabled
            >
              <Icon name="bolt" className="transition-colors group-hover:text-yellow-500 text-[24px]" />
              Skill ultimate
            </button>
          </div>
          {loginRequired && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-300" data-testid="combat-login-required">
              Login necessario para iniciar o combate no servidor.
              <button
                type="button"
                onClick={openAuthPanel}
                className="ml-3 rounded-lg border border-red-400/40 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-red-200 transition-colors hover:bg-red-500/20"
              >
                Conectar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
