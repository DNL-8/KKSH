import {
  Activity,
  ArrowUpRight,
  Brain,
  Cpu,
  Hexagon,
  Layers,
  Swords,
  Target,
  Terminal,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useOutletContext } from "react-router-dom";

import { Badge, BentoMini, ProgressBar, StatPill } from "../components/common";
import { assetPaths } from "../lib/assets";
import type { AppShellContextValue } from "../layout/types";

export function HubPage() {
  const { globalStats, handleGlobalAction, navigateTo } = useOutletContext<AppShellContextValue>();

  return (
    <div className="animate-in fade-in zoom-in space-y-6 pb-20 duration-500">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
        <section className="group relative overflow-hidden rounded-[32px] border border-slate-800 bg-[#0a0a0b]/80 p-6 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-cyan-500/30 lg:col-span-4">
          <div className="absolute -right-10 -top-10 rotate-12 opacity-5 transition-opacity group-hover:opacity-10">
            <Hexagon size={220} className="text-cyan-500" />
          </div>
          <div className="mb-6 flex items-start justify-between">
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              <Activity size={14} className="text-cyan-500" /> Biometria Hunter
            </h3>
            <Badge icon={Activity} color="border-green-500/20 bg-green-500/10 text-green-500">
              Estável
            </Badge>
          </div>

          <div className="mb-8 flex items-center gap-5">
            <div className="relative shrink-0">
              <div className="w-24 rotate-2 rounded-[28px] bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 p-0.5 shadow-2xl transition-transform duration-700 group-hover:rotate-0">
                <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-[26px] border border-black/40 bg-[#050506]">
                  <img
                    src={assetPaths.hunterAvatar}
                    alt="Avatar"
                    className="z-10 h-16 w-16 object-contain"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-cyan-500/10 mix-blend-overlay" />
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 rounded-xl border-2 border-[#0a0a0b] bg-cyan-500 px-3 py-1 text-[11px] font-black text-black shadow-lg">
                RANK {globalStats.rank}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-black uppercase italic leading-none tracking-tighter text-white">
                Shadow Hunter
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]" />
                Nível {globalStats.level} Operacional
              </div>
              <div className="flex gap-1.5 pt-1">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded border border-slate-700 bg-slate-900 text-yellow-500"
                  title="Buff: Cafeína (+10% INT)"
                >
                  <Zap size={12} fill="currentColor" />
                </div>
                <div
                  className="flex h-6 w-6 items-center justify-center rounded border border-slate-700 bg-slate-900 text-blue-500"
                  title="Buff: Foco (+5% MP Regen)"
                >
                  <Brain size={12} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <ProgressBar
              label="Integridade (HP)"
              value={globalStats.hp}
              color="bg-red-600"
              glow="shadow-[0_0_20px_rgba(220,38,38,0.4)]"
              subLabel="Regen: 1.2/s"
            />
            <ProgressBar
              label="Foco Mental (MP)"
              value={globalStats.mana}
              color="bg-blue-600"
              glow="shadow-[0_0_20px_rgba(37,99,235,0.4)]"
              subLabel="Regen: 4.5/s"
            />
            <ProgressBar
              label="Sincronia (XP)"
              value={Math.floor((globalStats.xp / globalStats.maxXp) * 100)}
              color="bg-yellow-500"
              glow="shadow-[0_0_20px_rgba(234,179,8,0.4)]"
              subLabel={`${globalStats.xp}/${globalStats.maxXp}`}
            />
          </div>
        </section>

        <section className="group relative overflow-hidden rounded-[32px] border border-red-900/20 bg-gradient-to-br from-[#150a0a] to-[#0a0a0b] p-8 shadow-xl transition-all hover:border-red-500/40 lg:col-span-8">
          <div className="absolute right-0 top-0 p-8 opacity-5 transition-all duration-1000 group-hover:opacity-15">
            <Swords size={200} className="translate-x-12 -translate-y-12 -rotate-12 text-red-600" />
          </div>
          <div className="relative z-10 flex h-full flex-col">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge color="border-red-500/20 bg-red-500/10 text-red-500" icon={Swords}>
                  Incursão Ativa
                </Badge>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  Protocolo: Bug_Exterm_#04
                </span>
              </div>
              <button
                onClick={() => navigateTo("/combate")}
                className="rounded-full bg-white/5 p-2 text-slate-500 transition-colors hover:text-red-500"
                type="button"
              >
                <ArrowUpRight size={20} />
              </button>
            </div>

            <div className="mb-8">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Rank S</span>
                <span className="h-1 w-1 rounded-full bg-slate-700" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-900">Ameaça Crítica</span>
              </div>
              <h2 className="text-4xl font-black uppercase italic leading-tight tracking-tighter text-white drop-shadow-2xl md:text-6xl">
                BUG DE <span className="animate-shimmer text-red-500">AUTENTICAÇÃO</span>
              </h2>
              <div className="mt-4 flex gap-4">
                <StatPill label="Fraqueza" value="Lógica" color="text-blue-400" />
                <StatPill label="Resistência" value="Brute Force" color="text-red-400" />
                <StatPill label="Loot" value="Épico" color="text-purple-400" />
              </div>
            </div>

            <div className="mt-auto grid grid-cols-1 items-end gap-6 md:grid-cols-3">
              <div className="col-span-2 space-y-2">
                <div className="mb-1 flex items-end justify-between text-[11px] font-black uppercase text-red-500/80">
                  <span className="flex items-center gap-2">
                    <Target size={14} /> Energia do Boss
                  </span>
                  <span className="font-mono text-xl tracking-tighter">45.0%</span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full border border-red-900/30 bg-black/50 p-1">
                  <div className="relative h-full w-[45%] rounded-full bg-gradient-to-r from-red-800 via-red-500 to-orange-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                    <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleGlobalAction("attack")}
                className="group flex w-full items-center justify-center gap-4 rounded-2xl bg-red-600 px-12 py-5 text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_0_40px_rgba(220,38,38,0.3)] transition-all active:scale-95 hover:bg-red-500 md:w-auto"
                type="button"
              >
                <Swords size={20} className="transition-transform group-hover:rotate-45" /> Executar
              </button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-12 lg:grid-cols-4">
          <BentoMini
            icon={Layers}
            title="Masmorra Ativa"
            val="Castelo SQL"
            sub="42 Cartas Pendentes"
            color="text-orange-500"
            onClick={() => navigateTo("/revisoes")}
          >
            <div className="mt-4 flex h-4 items-end gap-1">
              {[3, 5, 2, 4, 1, 0, 0, 0, 0, 0].map((value, index) => (
                <div
                  key={`${value}-${index}`}
                  className={`flex-1 rounded-sm ${
                    value > 0 ? "bg-orange-500 shadow-[0_0_5px_#f97316]" : "bg-slate-800"
                  }`}
                  style={{ height: `${value * 20}%` }}
                />
              ))}
            </div>
          </BentoMini>

          <BentoMini
            icon={Terminal}
            title="Protocolo Treino"
            val="P-SQL-01"
            sub="65% Sincronizado"
            color="text-cyan-400"
            onClick={() => navigateTo("/arquivos")}
          >
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-[8px] font-bold uppercase text-slate-500">
                <span>Progresso</span>
                <span>65%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full border border-slate-800 bg-slate-900">
                <div className="h-full w-[65%] bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />
              </div>
            </div>
          </BentoMini>

          <BentoMini
            icon={Cpu}
            title="Núcleo Central"
            val="IA Sistema"
            sub="Latência: 8ms"
            color="text-blue-500"
            onClick={() => navigateTo("/ia")}
          >
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-2">
              <div className="flex gap-0.5">
                {[0, 1, 2].map((value) => (
                  <div
                    key={value}
                    className="h-2 w-0.5 animate-pulse rounded-full bg-blue-500"
                    style={{ animationDelay: `${value * 0.2}s` }}
                  />
                ))}
              </div>
              <span className="text-[9px] font-mono uppercase text-blue-400">Aguardando Input</span>
            </div>
          </BentoMini>

          <BentoMini
            icon={TrendingUp}
            title="Status Evolução"
            val="Classe: Elite"
            sub="Atributo Foco: INT"
            color="text-purple-500"
            onClick={() => navigateTo("/evolucao")}
          >
            <div className="mt-4 flex items-center gap-2">
              <div className="flex -space-x-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-yellow-500">
                  ?
                </div>
                <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-yellow-500">
                  ?
                </div>
                <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-500">
                  ?
                </div>
              </div>
              <span className="ml-auto text-[9px] font-black uppercase text-purple-400">Maestria II</span>
            </div>
          </BentoMini>
        </div>
      </div>
    </div>
  );
}