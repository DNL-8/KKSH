import { Clock, Layers, Target } from "lucide-react";

import { Badge, DetailedQuest } from "../components/common";
import { assetPaths } from "../lib/assets";

const RAID_HISTORY = Array.from({ length: 60 }, (_, index) => ({
  day: index,
  active: Math.random() > 0.4,
  intensity: Math.floor(Math.random() * 4),
}));

export function ReviewsPage() {
  return (
    <div className="animate-in fade-in space-y-10 duration-700">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <div className="group relative overflow-hidden rounded-[40px] border border-slate-800 bg-[#0a0a0b] p-10 shadow-2xl transition-all duration-700 hover:border-orange-500/40">
            <div className="absolute right-0 top-0 h-full w-1/2 opacity-10 transition-opacity group-hover:opacity-40">
              <img src={assetPaths.dungeonSqlCastle} alt="dungeon" className="h-full w-full object-cover grayscale" />
            </div>
            <div className="relative z-10 flex flex-col items-center justify-between gap-10 md:flex-row">
              <div className="flex-1 space-y-6">
                <Badge color="border-orange-500/20 bg-orange-500/10 text-orange-500" icon={Layers}>
                  Portal de Classe D
                </Badge>
                <h2 className="text-5xl font-black uppercase italic leading-none tracking-tighter text-white">
                  Castelo SQL
                </h2>
                <p className="max-w-md text-sm font-medium leading-relaxed text-slate-400">
                  Domine os segredos das queries relacionais e otimização de índices. Limpe a masmorra para ganhar XP
                  de inteligência pura.
                </p>
                <div className="flex gap-10 border-t border-slate-800/50 pt-4">
                  <div className="flex flex-col">
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Mulas/Cards</span>
                    <span className="text-2xl font-black text-white">42</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Dificuldade</span>
                    <span className="text-2xl font-black uppercase italic text-orange-500">Baixa</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Loot</span>
                    <span className="text-2xl font-black text-yellow-500">350 XP</span>
                  </div>
                </div>
              </div>
              <button
                className="flex w-full items-center gap-3 rounded-3xl bg-orange-600 px-12 py-6 text-xs font-black uppercase tracking-[0.3em] text-white shadow-2xl shadow-orange-900/40 transition-all hover:bg-orange-500 active:scale-95 md:w-auto"
                type="button"
              >
                <Target size={18} /> Iniciar Incursão
              </button>
            </div>
          </div>

          <div className="rounded-[40px] border border-slate-800 bg-[#0a0a0b]/60 p-10 shadow-xl">
            <div className="mb-10 flex items-center justify-between">
              <h3 className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
                <Clock size={16} className="text-orange-500" /> Histórico de Sincronia Neural
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((value) => (
                    <div key={value} className="h-3 w-3 rounded-sm bg-orange-500" style={{ opacity: value * 0.25 }} />
                  ))}
                </div>
                <span className="text-[9px] font-black uppercase text-slate-600">Intensidade</span>
              </div>
            </div>
            <div className="grid grid-flow-col grid-rows-7 gap-2">
              {RAID_HISTORY.map((day) => (
                <div
                  key={day.day}
                  className={`h-4 w-4 cursor-help rounded-[4px] border border-transparent transition-all hover:scale-150 hover:border-orange-400 ${
                    !day.active
                      ? "bg-slate-900"
                      : day.intensity === 1
                        ? "bg-orange-900/40"
                        : day.intensity === 2
                          ? "bg-orange-700/70"
                          : "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"
                  }`}
                  title={`Dia ${day.day}: Nível ${day.intensity}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8 lg:col-span-4">
          <div className="relative flex h-full flex-col overflow-hidden rounded-[40px] border border-slate-800 bg-[#0a0a0b] p-8 shadow-2xl">
            <div className="absolute right-0 top-0 p-8 opacity-5">
              <Target size={120} />
            </div>
            <h3 className="mb-8 border-b border-slate-800 pb-4 text-sm font-black uppercase tracking-[0.2em] text-white">
              Quests do Dia
            </h3>
            <div className="relative z-10 flex-1 space-y-5">
              <DetailedQuest title="Responder 10 Revisões" xp="25" type="Mental" progress={6} total={10} color="bg-orange-500" />
              <DetailedQuest title="Limpar Fila Crítica" xp="100" type="Sincronia" progress={1} total={1} completed />
              <DetailedQuest title="Estudo de Caso Oracle" xp="50" type="Tática" progress={0} total={1} color="bg-cyan-500" />
              <DetailedQuest title="Combo 20 Acertos" xp="40" type="Combate" progress={12} total={20} color="bg-red-500" />
            </div>
            <button
              className="mt-10 w-full rounded-2xl border border-slate-800 bg-slate-900 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:border-slate-700 hover:text-white"
              type="button"
            >
              Ver Todas as Missões
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
