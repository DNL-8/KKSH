import { ArrowRight, Brain, Shield, Skull, Swords, Trophy, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";

import { Badge, StatPill } from "../components/common";
import { useToast } from "../components/common/Toast";
import type { AppShellContextValue } from "../layout/types";
import {
  ApiRequestError,
  answerCombatQuestion,
  drawCombatQuestion,
  startCombatBattle,
} from "../lib/api";
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
  const { syncProgressionFromApi, openAuthPanel } = useOutletContext<AppShellContextValue>();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const moduleId = (location.state as CombatLocationState | null)?.moduleId;
  const currentModule = EXCEL_MODULES.find((moduleItem) => moduleItem.id === moduleId) ?? EXCEL_MODULES[0];
  const boss = currentModule.boss;

  const [battleId, setBattleId] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [enemyHp, setEnemyHp] = useState(boss.hp);
  const [enemyMaxHp, setEnemyMaxHp] = useState(boss.hp);
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [playerMaxHp, setPlayerMaxHp] = useState(PLAYER_MAX_HP);
  const [damagePopup, setDamagePopup] = useState<DamagePopup | null>(null);
  const [shake, setShake] = useState(false);
  const [combatLogs, setCombatLogs] = useState<string[]>([
    `Batalha iniciada: ${boss.name} [Rank ${boss.rank}]`,
  ]);
  const [turnState, setTurnState] = useState<TurnState>("PLAYER_IDLE");
  const [currentQuestion, setCurrentQuestion] = useState<ActiveQuestion | null>(null);
  const [loadingBattle, setLoadingBattle] = useState(true);
  const [answering, setAnswering] = useState(false);

  const battleIdRef = useRef<string | null>(null);

  useEffect(() => {
    battleIdRef.current = battleId;
  }, [battleId]);

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
        const result = await startCombatBattle({ moduleId: currentModule.id, reset });
        setLoginRequired(false);
        applyBattleState(result.battleState);
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
    [applyBattleState, currentModule.id, pushCombatLog, showToast],
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
          pushCombatLog(`${boss.name} atacou: -${result.enemyDamage} HP`);
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
          showToast(`${boss.name} derrotado!`, "success");
          void syncProgressionFromApi();
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
      boss.name,
      currentQuestion,
      pushCombatLog,
      showToast,
      syncProgressionFromApi,
      turnState,
    ],
  );

  const resetBattle = useCallback(() => {
    void initBattle(true);
  }, [initBattle]);

  const handleNextChallenge = useCallback(() => {
    const currentIndex = EXCEL_MODULES.findIndex((moduleItem) => moduleItem.id === currentModule.id);
    const nextModule = EXCEL_MODULES[currentIndex + 1];
    if (!nextModule) {
      showToast("Voce derrotou todos os modulos. Parabens!", "success");
      navigate("/revisoes");
      return;
    }
    navigate("/combate", { state: { moduleId: nextModule.id } });
  }, [currentModule.id, navigate, showToast]);

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
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
          data-testid="quiz-modal"
        >
          <div className="w-full max-w-2xl rounded-[32px] border border-[hsl(var(--accent)/0.3)] bg-[#0a0a0b] p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="flex items-center gap-3 text-lg font-black uppercase tracking-widest text-white">
                <Brain className="text-[hsl(var(--accent))]" />
                Desafio de conhecimento
              </h3>
              <Badge color="border-red-500/20 bg-red-500/10 text-red-500" icon={Swords}>
                Dano relativo
              </Badge>
            </div>

            <p className="mb-8 text-xl font-bold leading-relaxed text-white" data-testid="quiz-question-text">
              {currentQuestion.text}
            </p>

            <div className="grid gap-4">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={`${currentQuestion.id}-${index}`}
                  onClick={() => void handleAnswer(index)}
                  className="group flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-left transition-all hover:border-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.1)] disabled:opacity-60"
                  type="button"
                  disabled={answering}
                  data-testid={`quiz-option-${index}`}
                >
                  <span className="text-sm font-bold text-slate-300 group-hover:text-white">{option}</span>
                  <ArrowRight size={16} className="text-[hsl(var(--accent))] opacity-0 transition-opacity group-hover:opacity-100" />
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
            <Badge color="bg-red-600 text-white" icon={Skull}>
              Rank {boss.rank}
            </Badge>
            <Badge color={`${currentModule.color} border-white/10 bg-white/5`} icon={Zap}>
              {currentModule.difficulty}
            </Badge>
          </div>
          <div className="flex flex-col items-end">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Shield size={12} />
              HP jogador
            </div>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${playerHpPercent}%` }} />
            </div>
          </div>
        </div>

        <div className="group relative z-10 my-auto cursor-crosshair">
          {damagePopup && (
            <div
              className={`animate-float-up absolute -top-24 left-1/2 z-30 -translate-x-1/2 text-5xl font-black italic drop-shadow-[0_0_25px_rgba(220,38,38,0.8)] ${
                damagePopup.type === "miss" ? "text-slate-400" : "text-red-500"
              }`}
              data-testid="damage-popup"
            >
              {damagePopup.type === "miss" ? "MISS" : `-${damagePopup.val}`}
            </div>
          )}
          <div className="absolute inset-0 animate-pulse-slow rounded-full bg-red-600/20 opacity-40 blur-[100px] transition-all duration-700 group-hover:bg-red-600/40" />

          <div className="relative z-10 flex h-48 w-48 items-center justify-center rounded-full bg-slate-900/50 text-6xl transition-transform duration-300 hover:scale-105 md:h-96 md:w-96">
            <Skull size={120} className={`${currentModule.color} ${enemyHp <= 0 ? "opacity-20" : "animate-pulse"}`} />
          </div>
        </div>

        {turnState === "VICTORY" && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700"
            data-testid="combat-victory-overlay"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/80 via-black/90 to-black/95" />
            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
              <div className="rounded-full bg-emerald-500/20 p-6 shadow-[0_0_80px_rgba(16,185,129,0.4)]">
                <Trophy size={48} className="text-emerald-400" />
              </div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white md:text-6xl">Vitoria!</h2>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">{boss.name} derrotado</p>
              <div className="flex gap-3">
                <StatPill label="XP ganho" value="Backend" color="text-yellow-400" />
                <StatPill label="Loot" value="Sincronizado" color="text-purple-400" />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={resetBattle}
                  className="mt-4 flex items-center gap-3 rounded-[32px] border border-emerald-600/30 bg-emerald-600/10 px-6 py-4 text-xs font-black uppercase tracking-[0.3em] text-emerald-400 transition-all hover:bg-emerald-600/20"
                  type="button"
                  data-testid="combat-victory-retry"
                >
                  <Swords size={16} />
                  Batalhar novamente
                </button>
                <button
                  onClick={handleNextChallenge}
                  className="mt-4 flex items-center gap-3 rounded-[32px] bg-emerald-600 px-10 py-5 text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_20px_50px_rgba(16,185,129,0.4)] transition-all hover:scale-105 hover:bg-emerald-500 active:scale-95"
                  type="button"
                  data-testid="combat-victory-next-module"
                >
                  <Zap size={20} />
                  Proximo modulo
                </button>
              </div>
            </div>
          </div>
        )}

        {turnState === "DEFEAT" && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700"
            data-testid="combat-defeat-overlay"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-red-950/80 via-black/90 to-black/95" />
            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
              <div className="rounded-full bg-red-500/20 p-6 shadow-[0_0_80px_rgba(239,68,68,0.35)]">
                <Skull size={48} className="text-red-400" />
              </div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white md:text-6xl">Derrota</h2>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-red-300">Voce foi derrubado pelo boss</p>
              <div className="flex gap-4">
                <button
                  onClick={resetBattle}
                  className="mt-4 flex items-center gap-3 rounded-[32px] border border-red-600/30 bg-red-600/10 px-6 py-4 text-xs font-black uppercase tracking-[0.3em] text-red-300 transition-all hover:bg-red-600/20"
                  type="button"
                  data-testid="combat-defeat-retry"
                >
                  <Swords size={16} />
                  Tentar novamente
                </button>
                <button
                  onClick={() => navigate("/revisoes")}
                  className="mt-4 flex items-center gap-3 rounded-[32px] bg-slate-800 px-10 py-5 text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_20px_50px_rgba(15,23,42,0.4)] transition-all hover:scale-105 hover:bg-slate-700 active:scale-95"
                  type="button"
                  data-testid="combat-defeat-back"
                >
                  <Zap size={18} />
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
              data-text={boss.name.toUpperCase()}
            >
              {boss.name.toUpperCase()}
            </h2>
            <div className="flex justify-center gap-2">
              <StatPill label="ATK" value={boss.stats.atk} color="text-red-400" />
              <StatPill label="DEF" value={boss.stats.def} color="text-blue-400" />
              <StatPill label="SPD" value={boss.stats.spd} color="text-yellow-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-end justify-between px-4">
                <span className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-red-500">
                  <Skull size={18} />
                  HP boss
                </span>
                <span className="font-mono text-2xl font-black tracking-tighter text-white">
                  <span data-testid="enemy-hp-value">{enemyHp}</span>/<span data-testid="enemy-hp-max">{enemyMaxHp}</span>
                </span>
              </div>
              <div className="h-8 w-full overflow-hidden rounded-3xl border-2 border-slate-800 bg-slate-900 p-1 shadow-2xl ring-4 ring-red-900/10">
                <div
                  className="relative h-full rounded-2xl bg-gradient-to-r from-red-800 via-red-500 to-orange-500 shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all duration-300"
                  style={{ width: `${hpPercent}%` }}
                  data-testid="enemy-hp-bar"
                >
                  <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-end justify-between px-4">
                <span className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-blue-500">
                  <Shield size={18} />
                  HP jogador
                </span>
                <span className="font-mono text-2xl font-black tracking-tighter text-white">
                  <span data-testid="player-hp-value">{playerHp}</span>/<span data-testid="player-hp-max">{playerMaxHp}</span>
                </span>
              </div>
              <div className="h-8 w-full overflow-hidden rounded-3xl border-2 border-slate-800 bg-slate-900 p-1 shadow-2xl ring-4 ring-blue-900/10">
                <div
                  className="relative h-full rounded-2xl bg-gradient-to-r from-blue-800 via-blue-500 to-cyan-400 shadow-[0_0_25px_rgba(59,130,246,0.45)] transition-all duration-300"
                  style={{ width: `${playerHpPercent}%` }}
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
              className={`flex items-center gap-4 rounded-[32px] px-10 py-5 text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_20px_50px_rgba(220,38,38,0.4)] ring-2 ring-red-400/20 transition-all active:scale-95 md:gap-5 md:px-16 md:py-7 md:text-sm ${
                canAttack ? "bg-red-600 hover:scale-105 hover:bg-red-500" : "cursor-not-allowed bg-slate-800 opacity-50"
              }`}
              type="button"
              data-testid="combat-attack-button"
            >
              <Swords size={20} />
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
              <Zap size={24} className="transition-colors group-hover:text-yellow-500" />
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
