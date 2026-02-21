import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

import { Badge, StatPill } from "../components/common";
import { Icon } from "../components/common/Icon";
import { useToast } from "../components/common/Toast";
import { CombatQuizModal } from "../components/combat/CombatQuizModal";

import type { AppShellContextValue } from "../layout/types";
import {
  ApiRequestError,
  answerCombatQuestion,
  consumeCombatItem,
  drawCombatQuestion,
  fleeCombatBattle,
  getMeState,
  startCombatBattle,
} from "../lib/api";
import { widthPercentClass } from "../lib/percentClasses";
import { EXCEL_MODULES } from "../lib/excel_modules";

interface DamagePopup {
  val: number;
  type: "damage" | "miss" | "heal";
}



type TurnState = "PLAYER_IDLE" | "PLAYER_QUIZ" | "PLAYER_ATTACKING" | "ENEMY_TURN" | "VICTORY" | "DEFEAT";
type ActiveQuestion = {
  id: string;
  text: string;
  options: string[];
};

const PLAYER_MAX_HP = 100;
const WORLD_BOSS_HP = 9999999;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function CombatPage() {
  const { openAuthPanel } = useOutletContext<AppShellContextValue>();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Mode state
  const [isLobby, setIsLobby] = useState(true);
  const [selectedModuleId, setSelectedModuleId] = useState<string>(EXCEL_MODULES[0].id);

  const activeModule = useMemo(() => EXCEL_MODULES.find((m) => m.id === selectedModuleId) || EXCEL_MODULES[0], [selectedModuleId]);

  // Player Inventory State
  const { data: appState } = useQuery({
    queryKey: ["app-state"],
    queryFn: getMeState,
  });

  const potionQty = useMemo(() => {
    return appState?.inventory?.find((i) => i.id === "coffee")?.qty || 0;
  }, [appState]);

  const invalidateProgressCaches = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["auth", "progress"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-state"] }),
      queryClient.invalidateQueries({ queryKey: ["app-state"] }),
    ]);
  }, [queryClient]);

  // Battle State
  const [bossName, setBossName] = useState("World Boss");
  const [bossRank, setBossRank] = useState("S");
  const [battleId, setBattleId] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [enemyHp, setEnemyHp] = useState(WORLD_BOSS_HP);
  const [enemyMaxHp, setEnemyMaxHp] = useState(WORLD_BOSS_HP);
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [playerMaxHp, setPlayerMaxHp] = useState(PLAYER_MAX_HP);
  const [damagePopup, setDamagePopup] = useState<DamagePopup | null>(null);
  const [shake, setShake] = useState(false);
  const [healPulse, setHealPulse] = useState(false);
  const [combatLogs, setCombatLogs] = useState<string[]>([]);
  const [turnState, setTurnState] = useState<TurnState>("PLAYER_IDLE");
  const [currentQuestion, setCurrentQuestion] = useState<ActiveQuestion | null>(null);
  const [loadingBattle, setLoadingBattle] = useState(false);
  const [actionLocked, setActionLocked] = useState(false);
  const [extractedData, setExtractedData] = useState<{ xp: number; gold: number; damage: number } | null>(null);

  const battleIdRef = useRef<string | null>(null);
  useEffect(() => {
    battleIdRef.current = battleId;
  }, [battleId]);

  const pushCombatLog = useCallback((entry: string, maxEntries = 8) => {
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
    async () => {
      setLoadingBattle(true);
      setCurrentQuestion(null);
      setDamagePopup(null);
      setShake(false);
      setHealPulse(false);
      setExtractedData(null);
      setCombatLogs([]);

      try {
        const result = await startCombatBattle({
          moduleId: selectedModuleId,
          reset: false,
        });
        setLoginRequired(false);
        applyBattleState(result.battleState);
        setBossName(result.boss.name);
        setBossRank(result.boss.rank);
        setEnemyMaxHp(result.boss.hp);
        setEnemyHp(result.boss.hp);
        pushCombatLog(`Link neural estabelecido. Incursão ao Setor Iniciada.`);
        setIsLobby(false);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) {
          setLoginRequired(true);
          showToast("Autenticação necessária para o Raid.", "error");
        } else {
          showToast("Não foi possível iniciar a incursão.", "error");
        }
      } finally {
        setLoadingBattle(false);
      }
    },
    [applyBattleState, pushCombatLog, selectedModuleId, showToast],
  );

  const startPlayerAttack = useCallback(async () => {
    if (turnState !== "PLAYER_IDLE" || loadingBattle || actionLocked) return;
    if (!battleIdRef.current) return;

    setActionLocked(true);
    try {
      const result = await drawCombatQuestion(battleIdRef.current);
      applyBattleState(result.battleState);
      setCurrentQuestion(result.question);
    } catch (error) {
      showToast("Sinal perdido ao carregar padrão de ataque.", "error");
    } finally {
      setActionLocked(false);
    }
  }, [actionLocked, applyBattleState, loadingBattle, showToast, turnState]);

  const handleAnswer = useCallback(
    async (optionIndex: number) => {
      if (turnState !== "PLAYER_QUIZ" || !currentQuestion || actionLocked) return;
      const activeQuestion = currentQuestion;
      const activeBattleId = battleIdRef.current;
      if (!activeBattleId) return;

      setActionLocked(true);
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
          pushCombatLog(`Ataque Crítico! ${result.playerDamage} Dano no Core.`);
        } else {
          pushCombatLog("Ataque falhou. O World Boss resistiu.");
        }

        if (result.enemyDamage > 0) {
          pushCombatLog(`Dano recebido: -${result.enemyDamage} HP`);
        }

        if (result.playerDamage > 0 || result.enemyDamage > 0) {
          setShake(true);
          window.setTimeout(() => setShake(false), 500);
        }

        window.setTimeout(() => setDamagePopup(null), 1000);

        applyBattleState(result.battleState);

        if (result.battleState.status === "defeat") {
          pushCombatLog(">>> VITAIS ZERADOS. INJEÇÃO DE EMERGÊNCIA FALHOU <<<");
          showToast("Você foi abatido na incursão!", "error");
          void invalidateProgressCaches();
        }
      } catch (error) {
        pushCombatLog("Falha na execução da rotina de combate.");
        setTurnState("PLAYER_IDLE");
      } finally {
        setActionLocked(false);
      }
    },
    [actionLocked, applyBattleState, currentQuestion, pushCombatLog, showToast, turnState, invalidateProgressCaches],
  );

  const handleFlee = useCallback(async () => {
    if (turnState !== "PLAYER_IDLE" || actionLocked || !battleIdRef.current) return;
    setActionLocked(true);
    try {
      const result = await fleeCombatBattle({ battleId: battleIdRef.current });
      setExtractedData({
        xp: result.xpReward,
        gold: result.goldReward,
        damage: result.totalDamageDealt
      });
      applyBattleState(result.battleState);
      pushCombatLog("Extração tática concluída. XP Assegurado.");
      showToast("Você fugiu com sucesso!", "success");
      void invalidateProgressCaches();
    } catch (e) {
      showToast("O World Boss anulou sua rota de fuga!", "error");
    } finally {
      setActionLocked(false);
    }
  }, [actionLocked, applyBattleState, pushCombatLog, showToast, invalidateProgressCaches]);

  const handleHeal = useCallback(async () => {
    if (turnState !== "PLAYER_IDLE" || actionLocked || !battleIdRef.current) return;
    if (potionQty <= 0) {
      showToast("Você não tem Café infinito no inventário!", "error");
      return;
    }
    setActionLocked(true);
    try {
      const result = await consumeCombatItem({ battleId: battleIdRef.current, itemId: "coffee" });
      applyBattleState(result.battleState);

      setHealPulse(true);
      window.setTimeout(() => setHealPulse(false), 800);

      setDamagePopup({ val: result.healAmount, type: "heal" });
      window.setTimeout(() => setDamagePopup(null), 1000);

      pushCombatLog(`Injeção Caffeinica aplicada. +${result.healAmount} HP Módulos restaurados.`);
      void invalidateProgressCaches();
    } catch (e) {
      showToast("Falha ao consumir item.", "error");
    } finally {
      setActionLocked(false);
    }
  }, [actionLocked, applyBattleState, potionQty, pushCombatLog, showToast, invalidateProgressCaches]);

  const returnToLobby = () => {
    setIsLobby(true);
    setBattleId(null);
  };

  const hpPercent = useMemo(() => clamp((enemyHp / Math.max(1, enemyMaxHp)) * 100, 0, 100), [enemyHp, enemyMaxHp]);
  const playerHpPercent = useMemo(() => clamp((playerHp / Math.max(1, playerMaxHp)) * 100, 0, 100), [playerHp, playerMaxHp]);

  // RENDER: LOBBY
  if (isLobby) {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-1000 flex min-h-[60vh] flex-col overflow-hidden pb-20 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.15),transparent_60%)] pointer-events-none" />

        {/* World Boss Header */}
        <div className="flex flex-col items-center mt-10 mb-16 relative z-10 text-center">
          <Badge color="bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.6)] text-white mb-6 uppercase tracking-widest text-[10px] animate-pulse" icon="skull">
            World Raid Ativa
          </Badge>
          <h1 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 drop-shadow-[0_10px_30px_rgba(255,255,255,0.1)]">
            Dano Absoluto
          </h1>
          <p className="max-w-xl text-slate-400 font-medium text-sm mt-6">
            O algoritmo mestre está corrompendo as fundações. Insira-se na interface, cause o máximo de dano possível e extraia antes que seus vitais zerem.
          </p>
        </div>

        {/* Global Boss HUD (Mock visualizer) */}
        <div className="max-w-4xl mx-auto w-full px-6 mb-16 relative z-10">
          <div className="p-8 rounded-[40px] border border-red-500/20 bg-gradient-to-b from-[#110505] to-[#050000] shadow-[0_20px_60px_rgba(220,38,38,0.15)] flex flex-col md:flex-row items-center gap-10">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-red-600/20 blur-[60px] rounded-full animate-pulse-slow"></div>
              <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border border-red-500/30 flex items-center justify-center bg-black/50 relative z-10">
                <Icon name="skull" className="text-red-500 text-6xl md:text-8xl opacity-80" />
              </div>
            </div>
            <div className="flex-1 w-full space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-3xl font-black uppercase italic text-white tracking-tighter">O Devorador de Arrays</h3>
                  <div className="text-[10px] font-bold text-red-400 tracking-widest uppercase">Endless Protocol</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-white decoration-red-500 underline decoration-4 underline-offset-4">9,999,999</div>
                  <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mt-1">Global HP</div>
                </div>
              </div>

              <div className="h-4 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)] w-[50%] animate-[scan_2s_ease-in-out_infinite]" />
                <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 w-[100%] rounded-full shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <StatPill label="ATK" value="???" color="text-red-500" />
                <StatPill label="ARMOR" value="MAX" color="text-slate-400" />
                <StatPill label="PHASE" value="OMEGA" color="text-fuchsia-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Sectors Selection */}
        <div className="max-w-6xl mx-auto w-full px-6 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
            <div>
              <h4 className="text-2xl font-black uppercase italic tracking-tighter text-white">Selecione um Setor</h4>
              <p className="text-xs text-slate-500 font-medium">Temas teóricos definirão os padrões de ataque.</p>
            </div>
            {loginRequired && (
              <button onClick={openAuthPanel} className="bg-red-500 hover:bg-red-400 text-white px-6 py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                Conectar para Lutar
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {EXCEL_MODULES.map((mod) => (
              <button
                key={mod.id}
                onClick={() => setSelectedModuleId(mod.id)}
                className={`text-left group relative overflow-hidden rounded-[32px] p-6 transition-all duration-300 ${selectedModuleId === mod.id
                  ? "bg-white/10 border-white/20 shadow-[0_10px_40px_rgba(255,255,255,0.05)] ring-2 ring-white/30"
                  : "bg-black/40 border-white/5 hover:bg-white/5 hover:border-white/10"
                  } border backdrop-blur-md`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-30 ${mod.color} group-hover:opacity-60 transition-opacity`} />
                <div className="relative z-10 flex flex-col h-full">
                  <div className="mb-4">
                    <Icon name="bolt" className={`${mod.color} text-2xl mb-4`} />
                    <h5 className="text-lg font-black uppercase tracking-tight text-white mb-1">{mod.title}</h5>
                    <p className="text-xs text-slate-400 line-clamp-2">{mod.description}</p>
                  </div>
                  <div className="mt-auto flex justify-between items-center pt-4 border-t border-white/10">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${mod.color}`}>
                      {mod.difficulty}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {mod.totalQuestions} Nodes
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-16 flex justify-center pb-20">
            <button
              onClick={initBattle}
              disabled={loadingBattle}
              className="group relative overflow-hidden bg-red-600 text-white rounded-[40px] px-16 py-6 font-black tracking-[0.3em] uppercase transition-all hover:scale-105 active:scale-95 shadow-[0_20px_50px_rgba(220,38,38,0.5)] hover:shadow-[0_30px_60px_rgba(220,38,38,0.8)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]" />
              <span className="relative flex items-center gap-3">
                <Icon name="crossed-swords" className="text-xl" />
                {loadingBattle ? "Conectando..." : "Drop na Zona de Risco"}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: ACTIVE COMBAT HUD
  return (
    <div className={`animate-in fade-in zoom-in-95 duration-700 min-h-screen fixed inset-0 z-50 bg-[#030305] flex flex-col font-sans ${shake ? "animate-shake" : ""} ${healPulse ? "shadow-[inset_0_0_150px_rgba(59,130,246,0.3)] bg-[#050B14]" : ""}`} data-testid="combat-page">

      {/* Background FX */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.08),transparent_80%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:60px_60px] blur-[1px]" />

      {turnState === "PLAYER_QUIZ" && currentQuestion && (
        <CombatQuizModal
          question={currentQuestion}
          answering={actionLocked}
          onAnswer={handleAnswer}
        />
      )}

      {/* TOP BAR: World Boss Status */}
      <header className="relative z-10 w-full px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-950/50 border border-red-500/30 text-red-500">
            <Icon name="skull" className="text-3xl animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">
              O Devorador de Arrays
            </h2>
            <div className="text-[10px] font-bold tracking-widest text-red-400 mt-1">SETOR: {activeModule.title}</div>
          </div>
        </div>

        <div className="flex-1 w-full max-w-2xl px-4 md:px-0">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">HP do World Boss</span>
            <span className="text-sm font-black text-white">{enemyHp.toLocaleString()} / {enemyMaxHp.toLocaleString()}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5 relative">
            <div className={`h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-1000 ${widthPercentClass(hpPercent)}`} />
          </div>
        </div>
      </header>

      {/* MID ARENA: Visuals & Avatars */}
      <main className="flex-1 relative flex items-center justify-center translate-y-[-5%] overflow-hidden">
        <div className="group relative z-10 cursor-crosshair">
          {damagePopup && (
            <div
              className={`animate-out slide-out-to-top-12 fade-out absolute -top-32 left-1/2 z-30 -translate-x-1/2 text-7xl font-black italic duration-1000 ${damagePopup.type === "miss" ? "text-slate-400 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]" :
                damagePopup.type === "heal" ? "text-emerald-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.8)]" :
                  "text-red-500 drop-shadow-[0_0_40px_rgba(220,38,38,0.9)]"
                }`}
            >
              {damagePopup.type === "miss" ? "MISS" : damagePopup.type === "heal" ? `+${damagePopup.val}` : `-${damagePopup.val}`}
            </div>
          )}
          <div className="absolute inset-0 animate-pulse-slow rounded-full bg-red-600/10 blur-[120px] transition-all duration-700 group-hover:bg-red-600/30 w-[400px] h-[400px] -left-[100px] -top-[100px]" />

          <div className="relative z-10 text-9xl md:text-[200px] transition-transform duration-500 group-hover:scale-105">
            <span className="opacity-80 mix-blend-screen inline-block animate-[float_4s_ease-in-out_infinite]">👾</span>
          </div>
        </div>

        {/* Floating Combat Logs */}
        <div className="absolute right-8 top-1/4 w-64 space-y-2 pointer-events-none fade-in mask-linear-fade h-64 overflow-hidden flex flex-col justify-end">
          {combatLogs.map((log, i) => (
            <div key={i} className={`text-right text-[10px] font-mono leading-tight ${i === 0 ? "text-white font-bold text-xs" : "text-slate-500"} transition-all duration-500 ease-out translate-y-4 animate-[slideUpFade_0.5s_ease-out_forwards]`}>
              {log}
            </div>
          ))}
        </div>
      </main>

      {/* BOTTOM HUD: Player Stats & Actions JRPG Style */}
      <footer className="relative z-20 w-full border-t border-white/10 bg-black/60 backdrop-blur-xl p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center justify-between">
        {/* Vitals Panel */}
        <div className="w-full md:w-1/3 flex flex-col gap-4">
          <h3 className="text-xl font-black italic text-white tracking-tighter uppercase mb-2">Suas métricas</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HP Vital</span>
                <span className="text-sm font-black text-white">{playerHp} <span className="text-slate-500">/ {playerMaxHp}</span></span>
              </div>
              <div className="h-4 w-full bg-slate-900 rounded-sm overflow-hidden box-border border-b-2 border-white/5">
                <div className={`h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 ${widthPercentClass(playerHpPercent)}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Action Menu */}
        <div className="w-full md:w-auto flex flex-wrap md:flex-nowrap gap-4 justify-end">
          <button
            disabled={actionLocked || turnState !== "PLAYER_IDLE"}
            onClick={startPlayerAttack}
            className="flex-1 md:flex-none relative overflow-hidden bg-white/10 border border-white/10 hover:bg-white/20 hover:border-white/30 text-white rounded-2xl px-12 py-6 font-black tracking-widest uppercase transition-all shadow-lg hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            <span className="flex items-center justify-center gap-3">
              <Icon name="crossed-swords" className="text-xl" />
              Atacar
            </span>
          </button>

          <button
            disabled={actionLocked || turnState !== "PLAYER_IDLE" || potionQty <= 0}
            onClick={handleHeal}
            className="flex-1 md:flex-none relative bg-[#1A1100] border border-yellow-600/30 hover:bg-[#2A1D00] hover:border-yellow-500/50 text-yellow-500 rounded-2xl px-8 py-6 font-black tracking-widest uppercase transition-all shadow-lg hover:shadow-[0_0_30px_rgba(234,179,8,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center gap-2">
              <Icon name="coffee" className="text-lg" />
              Mochila <span className="bg-yellow-600 text-black px-2 py-0.5 rounded-full text-[10px] ml-1">{potionQty}</span>
            </span>
          </button>

          <button
            disabled={actionLocked || turnState !== "PLAYER_IDLE"}
            onClick={handleFlee}
            className="w-full md:w-auto mt-4 md:mt-0 bg-transparent border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-400 rounded-2xl px-8 py-6 font-black tracking-widest uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Icon name="bolt" className="text-lg" /> Fuga
          </button>
        </div>
      </footer>

      {/* Result Overlay */}
      {(turnState === "VICTORY" || turnState === "DEFEAT") && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="max-w-xl w-full text-center space-y-8">
            <h2 className={`text-6xl md:text-8xl font-black italic uppercase tracking-tighter ${turnState === "VICTORY" ? "text-emerald-500" : "text-red-600"}`}>
              {turnState === "VICTORY" ? "BOSSKILL" : "M.I.A."}
            </h2>

            {extractedData && (
              <div className="bg-white/5 rounded-3xl p-8 border border-white/10 space-y-6">
                <p className="text-slate-400 text-sm font-medium">Balanço da Extração</p>

                <div className="flex justify-center gap-8">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-black mb-1">Dano Causado</span>
                    <span className="text-3xl font-black text-rose-500">{extractedData.damage}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-black mb-1">XP Assegurado</span>
                    <span className="text-3xl font-black text-blue-400">{extractedData.xp}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-black mb-1">Créditos</span>
                    <span className="text-3xl font-black text-yellow-500">{extractedData.gold}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4 pt-10">
              <button onClick={returnToLobby} className="bg-white text-black hover:bg-slate-200 px-10 py-4 rounded-full font-black uppercase tracking-widest text-sm transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                Retornar ao Hub
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
