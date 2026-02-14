```typescript
import { ArrowRight, Brain, Shield, Skull, Swords, Trophy, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";

import { Badge, StatPill } from "../components/common";
import { useToast } from "../components/common/Toast";
import type { AppShellContextValue } from "../layout/types";
import { EXCEL_MODULES, type ExcelModule, type ExcelQuestion } from "../lib/excel_modules";

interface DamagePopup {
  val: number;
  critical: boolean;
  type: "damage" | "miss" | "heal"; // Add miss type
}

type TurnState = "PLAYER_IDLE" | "PLAYER_QUIZ" | "PLAYER_ATTACKING" | "ENEMY_TURN" | "VICTORY" | "DEFEAT";

export function CombatPage() {
  const { handleGlobalAction } = useOutletContext<AppShellContextValue>();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get module from state or default to the first one
  const moduleId = location.state?.moduleId;
  const currentModule = EXCEL_MODULES.find(m => m.id === moduleId) || EXCEL_MODULES[0];
  const boss = currentModule.boss;
  const questions = currentModule.questions || [];

  const [enemyHp, setEnemyHp] = useState(boss.hp); 
  const [playerHp, setPlayerHp] = useState(100); // Mock player HP
  const [damagePopup, setDamagePopup] = useState<DamagePopup | null>(null);
  const [shake, setShake] = useState(false);
  const [combatLogs, setCombatLogs] = useState<string[]>([
    `Batalha iniciada: ${ boss.name } [Rank ${ boss.rank }]`,
  ]);
  
  // Combat State
  const [turnState, setTurnState] = useState<TurnState>("PLAYER_IDLE");
  const [currentQuestion, setCurrentQuestion] = useState<ExcelQuestion | null>(null);

  // Reset HP when module changes
  useEffect(() => {
      setEnemyHp(boss.hp);
      setPlayerHp(100);
      setTurnState("PLAYER_IDLE");
      setCombatLogs([`Batalha iniciada: ${ boss.name } [Rank ${ boss.rank }]`]);
  }, [boss]);

  const defeated = enemyHp <= 0;

  // 1. Player clicks Attack -> Show Quiz
  const startPlayerAttack = () => {
    if (turnState !== "PLAYER_IDLE") return;
    
    // Pick random question
    const randomQ = questions[Math.floor(Math.random() * questions.length)];
    setCurrentQuestion(randomQ);
    setTurnState("PLAYER_QUIZ");
  };

  // 2. Player answers Quiz
  const handleAnswer = (optionIndex: number) => {
      if (!currentQuestion) return;

      const isCorrect = optionIndex === currentQuestion.correctAnswer;
      setTurnState("PLAYER_ATTACKING");
      setCurrentQuestion(null);

      if (isCorrect) {
          // Execute Attack
          performPlayerAttack(currentQuestion.damage);
      } else {
          // Miss / Penalty
          setCombatLogs((prev) => [`ERROU! A resposta era: ${ currentQuestion.options[currentQuestion.correctAnswer] } `, ...prev].slice(0, 5));
          setDamagePopup({ val: 0, critical: false, type: "miss" });
          
          // Slight delay before enemy turn
          setTimeout(() => {
              setTurnState("ENEMY_TURN");
          }, 1000);
      }
  };

  const performPlayerAttack = (baseDamage: number) => {
      const isCritical = Math.random() > 0.8; 
      const damage = isCritical ? Math.floor(baseDamage * 1.5) : baseDamage;
      
      const newHp = Math.max(0, enemyHp - damage);
      setEnemyHp(newHp);
      
      setDamagePopup({ val: damage, critical: isCritical, type: "damage" });
      setShake(true);
      setCombatLogs((prev) => [`Acertou! Causou ${ damage } dano ${ isCritical ? "(CRÍTICO!)" : "" } `.trim(), ...prev].slice(0, 5));
      handleGlobalAction("attack");

      if (newHp <= 0) {
        setTurnState("VICTORY");
        showToast(`${ boss.name } derrotado! + 250 XP`, "success");
        setCombatLogs((prev) => [">>> BOSS DERROTADO! VITORIA! <<<", ...prev].slice(0, 6));
      } else {
         setTimeout(() => {
             setDamagePopup(null);
             setShake(false);
             setTurnState("ENEMY_TURN");
         }, 1000);
      }
  };

  // 3. Enemy Turn
  useEffect(() => {
      if (turnState === "ENEMY_TURN" && !defeated) {
          const timer = setTimeout(() => {
              // Boss attacks
              const bossDamage = Math.floor(Math.random() * 10) + 5;
              setPlayerHp(prev => Math.max(0, prev - bossDamage));
              setCombatLogs((prev) => [`${ boss.name } contra - atacou: -${ bossDamage } HP`, ...prev].slice(0, 5));
              setShake(true); // Shake screen on taking damage too

              setTimeout(() => {
                setShake(false);
                setTurnState("PLAYER_IDLE");
              }, 500);
          }, 1500); // Enemy thinking time

          return () => clearTimeout(timer);
      }
  }, [turnState, defeated, boss.name]);


  const resetBattle = () => {
    setEnemyHp(boss.hp);
    setPlayerHp(100);
    setDamagePopup(null);
    setShake(false);
    setTurnState("PLAYER_IDLE");
    setCombatLogs([`Nova batalha iniciada: ${ boss.name } [Rank ${ boss.rank }]`]);
  };

  const handleNextChallenge = () => {
      const currentIndex = EXCEL_MODULES.findIndex(m => m.id === currentModule.id);
      const nextModule = EXCEL_MODULES[currentIndex + 1];
      if (nextModule) {
          navigate("/combate", { state: { moduleId: nextModule.id } });
      } else {
          showToast("Você derrotou todos os módulos! Parabéns!", "success");
          navigate("/revisoes");
      }
  };

  const hpPercent = (enemyHp / boss.hp) * 100;
  const playerHpPercent = playerHp; // Assuming 100 max for now

  return (
    <div className={`animate -in slide -in -from - bottom - 8 duration - 1000 ${ shake ? "animate-shake" : "" } `}>
      {/* QUIZ MODAL */}
      {turnState === "PLAYER_QUIZ" && currentQuestion && (
           <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
               <div className="w-full max-w-2xl rounded-[32px] border border-[hsl(var(--accent)/0.3)] bg-[#0a0a0b] p-8 shadow-2xl">
                   <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
                       <h3 className="flex items-center gap-3 text-lg font-black uppercase tracking-widest text-white">
                           <Brain className="text-[hsl(var(--accent))]" /> Desafio de Conhecimento
                       </h3>
                       <Badge color="bg-red-500/10 text-red-500 border-red-500/20" icon={Swords}>
                           Dano: {currentQuestion.damage}
                       </Badge>
                   </div>
                   
                   <p className="mb-8 text-xl font-bold leading-relaxed text-white">
                       {currentQuestion.text}
                   </p>

                   <div className="grid gap-4">
                       {currentQuestion.options.map((option, idx) => (
                           <button
                               key={idx}
                               onClick={() => handleAnswer(idx)}
                               className="group flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-left transition-all hover:border-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.1)]"
                           >
                               <span className="text-sm font-bold text-slate-300 group-hover:text-white">{option}</span>
                               <ArrowRight size={16} className="opacity-0 transition-opacity group-hover:opacity-100 text-[hsl(var(--accent))]" />
                           </button>
                       ))}
                   </div>
               </div>
           </div>
      )}

      <div className="relative flex min-h-[60vh] flex-col items-center overflow-hidden rounded-[56px] border border-red-900/30 bg-[#050506] p-6 shadow-[inset_0_0_100px_rgba(220,38,38,0.1)] md:min-h-[750px] md:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.15),transparent_70%)] opacity-60" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1f1212_1px,transparent_1px),linear-gradient(to_bottom,#1f1212_1px,transparent_1px)] bg-[size:80px_80px] opacity-10" />

        {/* Top Bar (Boss Info) */}
        <div className="relative z-20 mb-10 flex w-full items-start justify-between">
          <div className="flex gap-2">
            <Badge color="bg-red-600 text-white" icon={Skull}>
              Rank {boss.rank}
            </Badge>
            <Badge color={`border - ${ currentModule.color.split('-')[1] } -500 / 30 bg - ${ currentModule.color.split('-')[1] } -600 / 20 ${ currentModule.color } `} icon={Zap}>
              {currentModule.difficulty}
            </Badge>
          </div>
          <div className="flex flex-col items-end">
             <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                 <Shield size={12} /> HP Jogador
             </div>
             <div className="w-32 h-2 rounded-full bg-slate-800 overflow-hidden">
                 <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${ playerHpPercent }% ` }} />
             </div>
          </div>
        </div>

        {/* Boss Visuals */}
        <div className="group relative z-10 my-auto cursor-crosshair">
          {damagePopup && (
            <div
              className={`animate - float - up absolute - top - 24 left - 1 / 2 z - 30 - translate - x - 1 / 2 text - 5xl font - black italic drop - shadow - [0_0_25px_rgba(220, 38, 38, 0.8)] ${
  damagePopup.type === "miss" ? "text-slate-500" : damagePopup.critical ? "scale-125 text-yellow-400" : "text-red-500"
} `}
            >
              {damagePopup.type === "miss" ? "MISS" : `- ${ damagePopup.val } `}
              {damagePopup.critical && "!"}
            </div>
          )}
          <div className="absolute inset-0 animate-pulse-slow rounded-full bg-red-600/20 opacity-40 blur-[100px] transition-all duration-700 group-hover:bg-red-600/40" />
          
          {boss.image.startsWith('/') ? (
             <div className="relative z-10 flex h-48 w-48 items-center justify-center rounded-full bg-slate-900/50 text-6xl md:h-96 md:w-96 transition-transform duration-300 hover:scale-105">
                <Skull size={120} className={`${ currentModule.color } animate - pulse`} />
             </div>
          ) : (
             <img
                src={boss.image}
                alt="Boss"
                className={`relative z - 10 h - 48 w - 48 animate - float object - contain drop - shadow - [0_0_60px_rgba(220, 38, 38, 0.6)] transition - all duration - 300 md: h - 96 md: w - 96 ${ defeated ? "scale-75 opacity-20 grayscale" : "" } `}
                onClick={startPlayerAttack}
             />
          )}
        </div>

        {/* Victory/Defeat Overlay */}
        {turnState === "VICTORY" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/80 via-black/90 to-black/95" />
            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
              <div className="rounded-full bg-emerald-500/20 p-6 shadow-[0_0_80px_rgba(16,185,129,0.4)]">
                <Trophy size={48} className="text-emerald-400" />
              </div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white md:text-6xl">
                Vitória!
              </h2>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
                {boss.name} Derrotado
              </p>
              <div className="flex gap-3">
                <StatPill label="XP Ganho" value="+250" color="text-yellow-400" />
                <StatPill label="Loot" value="Epico" color="text-purple-400" />
              </div>
              <div className="flex gap-4">
                  <button
                    onClick={resetBattle}
                    className="mt-4 flex items-center gap-3 rounded-[32px] border border-emerald-600/30 bg-emerald-600/10 px-6 py-4 text-xs font-black uppercase tracking-[0.3em] text-emerald-400 transition-all hover:bg-emerald-600/20"
                    type="button"
                  >
                    <Swords size={16} /> Batalhar Novamente
                  </button>
                  <button
                    onClick={handleNextChallenge}
                    className="mt-4 flex items-center gap-3 rounded-[32px] bg-emerald-600 px-10 py-5 text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_20px_50px_rgba(16,185,129,0.4)] transition-all hover:scale-105 hover:bg-emerald-500 active:scale-95"
                    type="button"
                  >
                    <Zap size={20} /> Proximo Módulo
                  </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats & Controls */}
        <div className="relative z-20 mt-12 w-full max-w-3xl space-y-10 text-center">
          <div className="space-y-4">
            <h2 className="glitch-text text-4xl font-black uppercase italic leading-none tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] md:text-8xl" data-text={boss.name.toUpperCase()}>
              {boss.name.toUpperCase()}
            </h2>
            <div className="flex justify-center gap-2">
              <StatPill label="ATK" value={boss.stats.atk} color="text-red-400" />
              <StatPill label="DEF" value={boss.stats.def} color="text-blue-400" />
              <StatPill label="SPD" value={boss.stats.spd} color="text-yellow-400" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-end justify-between px-4">
              <span className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-red-500">
                <Skull size={18} /> Vitalidade
              </span>
              <span className="font-mono text-3xl font-black tracking-tighter text-white">{Math.ceil(hpPercent)}%</span>
            </div>
            <div className="h-8 w-full overflow-hidden rounded-3xl border-2 border-slate-800 bg-slate-900 p-1 shadow-2xl ring-4 ring-red-900/10">
              <div
                className="relative h-full rounded-2xl bg-gradient-to-r from-red-800 via-red-500 to-orange-500 shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all duration-300"
                style={{ width: `${ hpPercent }% ` }}
              >
                <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
              </div>
            </div>
          </div>

          <div className="mask-linear-fade flex h-20 flex-col items-center justify-end space-y-1 overflow-hidden font-mono text-[10px] text-slate-500">
            {combatLogs.map((log, index) => (
              <div key={log + index} className={`${ index === 0 ? "font-bold text-white" : "opacity-60" } uppercase tracking - wider`}>
                {log}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 pt-2">
            <button
              onClick={startPlayerAttack}
              disabled={turnState !== "PLAYER_IDLE"}
              className={`flex items - center gap - 4 rounded - [32px] px - 10 py - 5 text - xs font - black uppercase tracking - [0.3em] text - white shadow - [0_20px_50px_rgba(220, 38, 38, 0.4)] ring - 2 ring - red - 400 / 20 transition - all active: scale - 95 md: gap - 5 md: px - 16 md: py - 7 md: text - sm ${ turnState === "PLAYER_IDLE" ? "bg-red-600 hover:scale-105 hover:bg-red-500" : "bg-slate-800 opacity-50 cursor-not-allowed" } `}
              type="button"
            >
              <Swords size={20} /> {turnState === "PLAYER_IDLE" ? "Iniciar Ataque" : turnState === "ENEMY_TURN" ? "Turno Inimigo" : "Combatendo..."}
            </button>
            <button
              className="group flex items-center gap-4 rounded-[32px] border border-slate-800 bg-[#0a0a0b] px-10 py-5 text-xs font-black uppercase tracking-[0.3em] text-slate-400 shadow-xl transition-all hover:border-[hsl(var(--accent)/0.5)] hover:text-[hsl(var(--accent))] active:scale-95 md:gap-5 md:px-16 md:py-7 md:text-sm"
              type="button"
            >
              <Zap size={24} className="transition-colors group-hover:text-yellow-500" /> Skill Ultimate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
