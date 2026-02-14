import { Brain, Flame, Lock, MapPin, Shield, Star, Swords, Trophy, Zap } from "lucide-react";

import { Badge } from "../components/common";

const ATTRIBUTES = [
  { label: "INT", value: 92, desc: "Lógica e Algoritmos", color: "text-blue-400" },
  { label: "AGI", value: 85, desc: "Velocidade de Código", color: "text-yellow-400" },
  { label: "STR", value: 70, desc: "Produção Bruta", color: "text-red-400" },
  { label: "VIT", value: 60, desc: "Gestão de Burnout", color: "text-green-400" },
] as const;

const ACHIEVEMENTS = [
  { icon: Shield, label: "Blindagem 1", unlocked: true },
  { icon: Swords, label: "Bug Slayer", unlocked: true },
  { icon: Zap, label: "Foco Total", unlocked: true },
  { icon: Brain, label: "Arquiteto", unlocked: false },
  { icon: Star, label: "Monarca", unlocked: false },
  { icon: MapPin, label: "Viajante", unlocked: true },
  { icon: Flame, label: "On Fire", unlocked: true },
  { icon: Lock, label: "Invisível", unlocked: false },
] as const;

const CONSISTENCY_HEATMAP = Array.from({ length: 119 }, () => Math.random());

export function EvolutionPage() {
  return (
    <div className="animate-in zoom-in grid grid-cols-1 gap-10 duration-700 lg:grid-cols-12">
      <div className="relative flex flex-col items-center overflow-hidden rounded-[48px] border border-slate-800 bg-[#0a0a0b]/80 p-12 shadow-2xl lg:col-span-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.05),transparent)]" />
        <h3 className="relative z-10 mb-16 text-xs font-black uppercase tracking-[0.4em] text-slate-500">
          Análise Hexagonal de Atributos
        </h3>
        <div className="relative z-10 h-80 w-80 drop-shadow-[0_0_30px_rgba(6,182,212,0.15)]">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" fill="none" stroke="#1e293b" strokeWidth="0.5" />
            <polygon points="50,20 85,35 85,65 50,80 15,65 15,35" fill="none" stroke="#1e293b" strokeWidth="0.5" />
            <polygon
              points="50,15 85,35 80,70 50,85 20,65 30,30"
              fill="rgba(6,182,212,0.1)"
              stroke="#06b6d4"
              strokeWidth="1.5"
              className="animate-pulse"
            />
          </svg>
          <div className="absolute -translate-y-8 left-1/2 -translate-x-1/2 text-[11px] font-black uppercase italic tracking-[0.2em] text-white">
            Inteligência
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-8 text-[11px] font-black uppercase italic tracking-[0.2em] text-white">
            Sorte
          </div>
          <div className="absolute left-0 top-1/4 -translate-x-16 text-[11px] font-black uppercase italic tracking-[0.2em] text-white">
            Força
          </div>
          <div className="absolute right-0 top-1/4 translate-x-16 text-[11px] font-black uppercase italic tracking-[0.2em] text-white">
            Agilidade
          </div>
        </div>
        <div className="relative z-10 mt-16 grid w-full grid-cols-2 gap-4">
          {ATTRIBUTES.map((attribute) => (
            <div
              key={attribute.label}
              className="group rounded-[24px] border border-slate-800 bg-slate-950 p-5 transition-all duration-300 hover:border-cyan-500/50"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={`text-xs font-black uppercase tracking-widest ${attribute.color}`}>
                  {attribute.label}
                </span>
                <span className="text-lg font-black text-white">{attribute.value}</span>
              </div>
              <div className="text-[8px] font-bold uppercase text-slate-600">{attribute.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-10 lg:col-span-6">
        <div className="group relative h-fit overflow-hidden rounded-[48px] border border-slate-800 bg-[#0a0a0b]/80 p-10 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.05),transparent)]" />
          <div className="relative z-10 mb-10 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Heatmap de Consistência Anual</h3>
            <Badge color="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">Status: Lendário</Badge>
          </div>
          <div className="relative z-10 flex flex-wrap gap-2.5">
            {CONSISTENCY_HEATMAP.map((randomValue, index) => {
              return (
                <div
                  key={index}
                  className={`h-5 w-5 cursor-pointer rounded-[4px] border border-transparent transition-all hover:scale-150 hover:border-white ${
                    randomValue > 0.85
                      ? "bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.6)]"
                      : randomValue > 0.4
                        ? "border border-emerald-700/20 bg-emerald-800/40"
                        : "border border-slate-800 bg-slate-900"
                  }`}
                />
              );
            })}
          </div>
          <div className="relative z-10 mt-12 flex items-center justify-between border-t border-slate-800/50 pt-8 font-mono text-[10px] font-black uppercase tracking-widest text-slate-600">
            <span>Início da Época 2024</span>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm border border-slate-800 bg-slate-900 shadow-inner" /> Off
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-emerald-400 shadow-[0_0_8px_#10b981]" /> Épico
              </div>
            </div>
            <span>Hoje</span>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-[48px] border border-slate-800 bg-[#0a0a0b]/80 p-10 shadow-2xl">
          <div className="absolute right-0 top-0 p-8 opacity-5 transition-transform duration-1000 group-hover:scale-110">
            <Trophy size={150} />
          </div>
          <h3 className="mb-8 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Conquistas de Classe</h3>
          <div className="grid grid-cols-4 gap-6">
            {ACHIEVEMENTS.map((achievement) => (
              <div
                key={achievement.label}
                className={`flex flex-col items-center gap-3 transition-all ${achievement.unlocked ? "" : "grayscale opacity-20"}`}
              >
                <div
                  className={`rounded-2xl border p-4 ${
                    achievement.unlocked
                      ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500 shadow-lg"
                      : "border-slate-800 bg-slate-900 text-slate-700"
                  }`}
                >
                  <achievement.icon size={20} />
                </div>
                <span className="text-center text-[8px] font-black uppercase leading-none tracking-tighter">
                  {achievement.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
