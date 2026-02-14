import { Skull, Swords, Trophy, Zap } from "lucide-react";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";

import { Badge, StatPill } from "../components/common";
import { useToast } from "../components/common/Toast";
import { assetPaths } from "../lib/assets";
import type { AppShellContextValue } from "../layout/types";

interface DamagePopup {
  val: number;
  critical: boolean;
}

export function CombatPage() {
  const { handleGlobalAction } = useOutletContext<AppShellContextValue>();
  const { showToast } = useToast();
  const [enemyHp, setEnemyHp] = useState(45);
  const [damagePopup, setDamagePopup] = useState<DamagePopup | null>(null);
  const [shake, setShake] = useState(false);
  const [combatLogs, setCombatLogs] = useState<string[]>([
    "Batalha iniciada: Bug de Autenticacao [Rank S]",
  ]);

  const defeated = enemyHp <= 0;

  const attack = () => {
    if (defeated) return;
    const isCritical = Math.random() > 0.7;
    const damage = isCritical ? Math.floor(Math.random() * 10) + 10 : Math.floor(Math.random() * 5) + 3;
    const newHp = Math.max(0, enemyHp - damage);
    setEnemyHp(newHp);
    setDamagePopup({ val: damage, critical: isCritical });
    setShake(true);
    setCombatLogs((prev) => [`Causou ${damage} dano ${isCritical ? "(CRITICO!)" : ""}`.trim(), ...prev].slice(0, 5));
    handleGlobalAction("attack");

    if (newHp <= 0) {
      showToast("Boss derrotado! +250 XP conquista desbloqueada", "success");
      setCombatLogs((prev) => [">>> BOSS DERROTADO! VITORIA! <<<", ...prev].slice(0, 6));
    }

    window.setTimeout(() => {
      setDamagePopup(null);
      setShake(false);
    }, 800);
  };

  const resetBattle = () => {
    setEnemyHp(45);
    setDamagePopup(null);
    setShake(false);
    setCombatLogs(["Nova batalha iniciada: Bug de Autenticacao [Rank S]"]);
  };

  return (
    <div className={`animate-in slide-in-from-bottom-8 duration-1000 ${shake ? "animate-shake" : ""}`}>
      <div className="relative flex min-h-[60vh] flex-col items-center overflow-hidden rounded-[56px] border border-red-900/30 bg-[#050506] p-6 shadow-[inset_0_0_100px_rgba(220,38,38,0.1)] md:min-h-[750px] md:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.15),transparent_70%)] opacity-60" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1f1212_1px,transparent_1px),linear-gradient(to_bottom,#1f1212_1px,transparent_1px)] bg-[size:80px_80px] opacity-10" />

        <div className="relative z-20 mb-10 flex w-full items-start justify-between">
          <div className="flex gap-2">
            <Badge color="bg-red-600 text-white" icon={Skull}>
              Rank S
            </Badge>
            <Badge color="border-orange-500/30 bg-orange-600/20 text-orange-500" icon={Zap}>
              Elite
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tempo Decorrido</div>
            <div className="font-mono text-red-500">04:22:15</div>
          </div>
        </div>

        <div className="group relative z-10 my-auto cursor-crosshair">
          {damagePopup && (
            <div
              className={`animate-float-up absolute -top-24 left-1/2 z-30 -translate-x-1/2 text-6xl font-black italic drop-shadow-[0_0_25px_rgba(220,38,38,0.8)] ${damagePopup.critical ? "scale-125 text-yellow-400" : "text-red-500"
                }`}
            >
              -{damagePopup.val}
              {damagePopup.critical && "!"}
            </div>
          )}
          <div className="absolute inset-0 animate-pulse-slow rounded-full bg-red-600/20 opacity-40 blur-[100px] transition-all duration-700 group-hover:bg-red-600/40" />
          <img
            src={assetPaths.bossAuthBug}
            alt="Boss"
            className={`relative z-10 h-48 w-48 animate-float object-contain drop-shadow-[0_0_60px_rgba(220,38,38,0.6)] transition-all duration-300 md:h-96 md:w-96 ${defeated ? "scale-75 opacity-20 grayscale" : "hover:scale-105 active:scale-95"}`}
            onClick={attack}
          />
        </div>

        {/* Victory overlay */}
        {defeated && (
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
                Boss Derrotado
              </p>
              <div className="flex gap-3">
                <StatPill label="XP Ganho" value="+250" color="text-yellow-400" />
                <StatPill label="Loot" value="Epico" color="text-purple-400" />
                <StatPill label="Rank" value="S" color="text-red-400" />
              </div>
              <button
                onClick={resetBattle}
                className="mt-4 flex items-center gap-3 rounded-[32px] bg-emerald-600 px-10 py-5 text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_20px_50px_rgba(16,185,129,0.4)] transition-all hover:scale-105 hover:bg-emerald-500 active:scale-95"
                type="button"
              >
                <Swords size={20} /> Proximo Desafio
              </button>
            </div>
          </div>
        )}

        <div className="relative z-20 mt-12 w-full max-w-3xl space-y-10 text-center">
          <div className="space-y-4">
            <h2 className="glitch-text text-4xl font-black uppercase italic leading-none tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] md:text-8xl" data-text="BUG DE AUTENTICACAO">
              BUG DE <br />
              <span className="text-red-600">AUTENTICACAO</span>
            </h2>
            <div className="flex justify-center gap-2">
              <StatPill label="ATK" value="2.4k" color="text-red-400" />
              <StatPill label="DEF" value="850" color="text-blue-400" />
              <StatPill label="SPD" value="Fast" color="text-yellow-400" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-end justify-between px-4">
              <span className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-red-500">
                <Skull size={18} /> Vitalidade
              </span>
              <span className="font-mono text-3xl font-black tracking-tighter text-white">{enemyHp}%</span>
            </div>
            <div className="h-8 w-full overflow-hidden rounded-3xl border-2 border-slate-800 bg-slate-900 p-1 shadow-2xl ring-4 ring-red-900/10">
              <div
                className="relative h-full rounded-2xl bg-gradient-to-r from-red-800 via-red-500 to-orange-500 shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all duration-300"
                style={{ width: `${enemyHp}%` }}
              >
                <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
              </div>
            </div>
          </div>

          <div className="mask-linear-fade flex h-20 flex-col items-center justify-end space-y-1 overflow-hidden font-mono text-[10px] text-slate-500">
            {combatLogs.map((log, index) => (
              <div key={log + index} className={`${index === 0 ? "font-bold text-white" : "opacity-60"} uppercase tracking-wider`}>
                {log}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 pt-2">
            <button
              onClick={attack}
              disabled={defeated}
              className="flex items-center gap-4 rounded-[32px] bg-red-600 px-10 py-5 text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_20px_50px_rgba(220,38,38,0.4)] ring-2 ring-red-400/20 transition-all hover:scale-105 hover:bg-red-500 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 md:gap-5 md:px-16 md:py-7 md:text-sm"
              type="button"
            >
              <Swords size={20} /> Desferir Ataque
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
