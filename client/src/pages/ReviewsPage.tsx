import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge, DetailedQuest } from "../components/common";
import { Icon } from "../components/common/Icon";
import { EXCEL_MODULES, type ExcelModule } from "../lib/excel_modules";

const RAID_HISTORY = Array.from({ length: 60 }, (_, index) => ({
  day: index,
  active: ((index * 37 + 11) % 10) > 3,
  intensity: (index * 13 + 7) % 4,
}));

export function ReviewsPage() {
  const navigate = useNavigate();
  const [selectedModule, setSelectedModule] = useState<ExcelModule>(EXCEL_MODULES[0]);

  const handleStartRaid = () => {
    navigate("/combate", { state: { moduleId: selectedModule.id } });
  };

  const selectedColorBase = selectedModule.color.split('-')[1] || "slate";

  return (
    <div className="animate-in fade-in space-y-10 duration-700 pb-20">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">

          {/* Module Selector / Featured Raid */}
          <div className={`group relative overflow-hidden rounded-[40px] border border-white/5 bg-gradient-to-br from-[#0a0f1d]/90 to-[#050813]/95 backdrop-blur-2xl p-10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] transition-all duration-700 hover:shadow-[0_0_40px_rgba(255,255,255,0.05)] hover:border-white/10`}>
            <div className={`absolute inset-0 bg-gradient-to-br from-black/20 via-black/40 to-${selectedColorBase}-900/20 opacity-80 mix-blend-overlay`} />
            <div className={`pointer-events-none absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-${selectedColorBase}-600/10 blur-[100px] transition-opacity duration-1000 group-hover:opacity-100 opacity-60`} />

            <div className="relative z-10 flex flex-col justify-between gap-10 md:flex-row">
              <div className="flex-1 space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Badge color={`border-${selectedColorBase}-500/30 bg-${selectedColorBase}-500/10 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] ${selectedModule.color}`} icon={selectedModule.icon}>
                    Módulo {selectedModule.difficulty}
                  </Badge>
                </div>

                <h2 className="text-4xl font-black uppercase italic leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300 drop-shadow-sm md:text-5xl">
                  {selectedModule.title}
                </h2>

                <p className="max-w-md text-sm font-medium leading-relaxed text-slate-400">
                  {selectedModule.description}
                </p>

                <div className="flex gap-8 border-t border-white/5 pt-6 mt-6">
                  <div className="flex flex-col">
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Boss</span>
                    <span className="text-lg font-black text-white">{selectedModule.boss.name}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Rank</span>
                    <span className="text-lg font-black uppercase italic text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]">{selectedModule.boss.rank}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">HP</span>
                    <span className="text-lg font-black text-white">{selectedModule.boss.hp}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-end gap-4">
                <button
                  onClick={handleStartRaid}
                  className="flex w-full items-center justify-center gap-3 rounded-[32px] bg-gradient-to-r from-white to-slate-200 px-10 py-5 text-[13px] font-black uppercase tracking-[0.3em] text-black shadow-[0_0_30px_rgba(255,255,255,0.15)] transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] active:scale-95 whitespace-nowrap"
                  type="button"
                >
                  <Icon name="target" className="text-[18px]" /> Enfrentar Boss
                </button>
              </div>
            </div>
          </div>

          {/* Modules List */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {EXCEL_MODULES.map((mod) => {
              const modColorBase = mod.color.split('-')[1] || "slate";
              const isSelected = selectedModule.id === mod.id;

              return (
                <button
                  key={mod.id}
                  onClick={() => setSelectedModule(mod)}
                  className={`group flex items-center gap-4 rounded-3xl border p-6 text-left transition-all duration-300 backdrop-blur-md ${isSelected
                    ? `border-${modColorBase}-500/40 bg-${modColorBase}-500/10 shadow-[0_0_30px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(255,255,255,0.02)] translate-y-[-2px]`
                    : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04] hover:shadow-[0_10px_20px_rgba(0,0,0,0.4)] hover:-translate-y-1"
                    }`}
                >
                  <div className={`rounded-2xl p-3 transition-colors ${isSelected ? `bg-${modColorBase}-500/20 ${mod.color} shadow-[0_0_15px_rgba(0,0,0,0.5)]` : "bg-black/40 text-slate-500 group-hover:text-slate-400"}`}>
                    <Icon name={mod.icon} className="text-[24px]" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500/80">{mod.difficulty}</div>
                    <div className={`font-black uppercase italic tracking-wide ${isSelected ? "text-white" : "text-slate-400 group-hover:text-slate-300"}`}>{mod.title}</div>
                  </div>
                  {isSelected && <Icon name="angle-right" className={`ml-auto text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]`} />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-8 lg:col-span-4">
          {/* Missions for Selected Module */}
          <div className="relative flex h-full flex-col overflow-hidden rounded-[40px] border border-white/5 bg-gradient-to-b from-[#0a0f1d]/80 to-[#050813]/90 backdrop-blur-xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <div className={`absolute right-0 top-0 p-8 opacity-5 text-white transition-colors duration-1000`}>
              <Icon name="trophy" className="text-[120px]" />
            </div>

            <h3 className="mb-6 border-b border-white/5 pb-4 text-xs font-black uppercase tracking-[0.2em] text-slate-300">
              Missões: <span className="text-white">{selectedModule.title}</span>
            </h3>

            <div className="relative z-10 flex-1 space-y-4">
              {selectedModule.missions.map((mission) => (
                <DetailedQuest
                  key={mission.id}
                  title={mission.title}
                  xp={String(mission.xp)}
                  type={mission.type}
                  progress={mission.completed ? 1 : 0}
                  total={1}
                  color={selectedModule.color.replace('text-', 'bg-')}
                  completed={mission.completed}
                />
              ))}
            </div>

            <button
              onClick={() => navigate("/evolucao")}
              className="mt-8 flex w-full justify-center items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all hover:border-white/10 hover:bg-white/[0.06] hover:text-white active:scale-95"
              data-testid="reviews-open-all-missions"
              type="button"
            >
              <Icon name="list" className="text-sm" /> Ver Todas as Missões
            </button>
          </div>

          {/* History / Consistency */}
          <div className="rounded-[40px] border border-white/5 bg-[#03060c]/80 backdrop-blur-md p-10 shadow-[inset_0_0_30px_rgba(0,0,0,0.8),0_10px_40px_rgba(0,0,0,0.4)]">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                <Icon name="clock" className="text-amber-500/80 text-[16px] drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" /> Sincronia
              </h3>
            </div>
            <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
              {RAID_HISTORY.map((day) => (
                <div
                  key={day.day}
                  className={`h-[14px] w-[14px] rounded-[3px] border border-white/5 transition-all ${!day.active
                    ? "bg-white/[0.02]"
                    : day.intensity === 1
                      ? "bg-emerald-900/60 border-emerald-900/40"
                      : day.intensity === 2
                        ? "bg-emerald-600/80 border-emerald-500/50"
                        : "bg-emerald-400 border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                    } hover:scale-125 cursor-help`}
                  title={`Dia ${day.day}: Nível ${day.intensity}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
