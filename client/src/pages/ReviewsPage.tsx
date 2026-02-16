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
    // Navigate to combat with selected module boss
    // For now we just go to combat, but we'll need to pass state or use context
    // Ideally we pass the boss ID or module ID via URL state or query param
    navigate("/combate", { state: { moduleId: selectedModule.id } });
  };

  return (
    <div className="animate-in fade-in space-y-10 duration-700">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">

          {/* Module Selector / Featured Raid */}
          <div className="group relative overflow-hidden rounded-[40px] border border-slate-800 bg-[#0a0a0b] p-10 shadow-2xl transition-all duration-700 hover:border-slate-700">
            <div className={`absolute inset-0 bg-gradient-to-br from-black via-black to-${selectedModule.color.split('-')[1]}-900/20 opacity-50`} />

            <div className="relative z-10 flex flex-col justify-between gap-10 md:flex-row">
              <div className="flex-1 space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Badge color={`border-${selectedModule.color.split('-')[1]}-500/20 bg-${selectedModule.color.split('-')[1]}-500/10 ${selectedModule.color}`} icon={selectedModule.icon}>
                    Módulo {selectedModule.difficulty}
                  </Badge>
                </div>

                <h2 className="text-4xl font-black uppercase italic leading-none tracking-tighter text-white md:text-5xl">
                  {selectedModule.title}
                </h2>

                <p className="max-w-md text-sm font-medium leading-relaxed text-slate-400">
                  {selectedModule.description}
                </p>

                <div className="flex gap-8 border-t border-slate-800/50 pt-6">
                  <div className="flex flex-col">
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Boss</span>
                    <span className="text-lg font-black text-white">{selectedModule.boss.name}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Rank</span>
                    <span className="text-lg font-black uppercase italic text-red-500">{selectedModule.boss.rank}</span>
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
                  className="flex w-full items-center justify-center gap-3 rounded-3xl bg-white px-10 py-5 text-xs font-black uppercase tracking-[0.3em] text-black shadow-2xl transition-all hover:bg-slate-200 active:scale-95 whitespace-nowrap"
                  type="button"
                >
                  <Icon name="target" className="text-[18px]" /> Enfrentar Boss
                </button>
              </div>
            </div>
          </div>

          {/* Modules List */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {EXCEL_MODULES.map((mod) => (
              <button
                key={mod.id}
                onClick={() => setSelectedModule(mod)}
                className={`flex items-center gap-4 rounded-3xl border p-6 text-left transition-all ${selectedModule.id === mod.id
                  ? `border-${mod.color.split('-')[1]}-500/50 bg-${mod.color.split('-')[1]}-500/5 shadow-2xl`
                  : "border-slate-800 bg-[#0a0a0b]/60 hover:border-slate-700 hover:bg-[#0a0a0b]"
                  }`}
              >
                <div className={`rounded-xl p-3 ${selectedModule.id === mod.id ? `bg-${mod.color.split('-')[1]}-500/20 ${mod.color}` : "bg-slate-900 text-slate-600"}`}>
                  <Icon name={mod.icon} className="text-[24px]" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{mod.difficulty}</div>
                  <div className={`font-black uppercase italic ${selectedModule.id === mod.id ? "text-white" : "text-slate-400"}`}>{mod.title}</div>
                </div>
                {selectedModule.id === mod.id && <Icon name="angle-right" className="ml-auto text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8 lg:col-span-4">
          {/* Missions for Selected Module */}
          <div className="relative flex h-full flex-col overflow-hidden rounded-[40px] border border-slate-800 bg-[#0a0a0b] p-8 shadow-2xl">
            <div className="absolute right-0 top-0 p-8 opacity-5">
              <Icon name="trophy" className="text-[120px]" />
            </div>
            <h3 className="mb-8 border-b border-slate-800 pb-4 text-sm font-black uppercase tracking-[0.2em] text-white">
              Missões: {selectedModule.title}
            </h3>
            <div className="relative z-10 flex-1 space-y-5">
              {selectedModule.missions.map((mission) => (
                <DetailedQuest
                  key={mission.id}
                  title={mission.title}
                  xp={String(mission.xp)}
                  type={mission.type}
                  progress={mission.completed ? 1 : 0}
                  total={1}
                  color={selectedModule.color.replace('text-', 'bg-')} // Approximation for bg color
                  completed={mission.completed}
                />
              ))}
            </div>
            <button
              onClick={() => navigate("/evolucao")}
              className="mt-10 w-full rounded-2xl border border-slate-800 bg-slate-900 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:border-slate-700 hover:text-white"
              data-testid="reviews-open-all-missions"
              type="button"
            >
              Ver Todas as Missões
            </button>
          </div>

          <div className="rounded-[40px] border border-slate-800 bg-[#0a0a0b]/60 p-10 shadow-xl">
            <div className="mb-10 flex items-center justify-between">
              <h3 className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
                <Icon name="clock" className="text-orange-500 text-[16px]" /> Histórico
              </h3>
            </div>
            <div className="grid grid-flow-col grid-rows-7 gap-2">
              {RAID_HISTORY.map((day) => (
                <div
                  key={day.day}
                  className={`h-4 w-4 cursor-help rounded-[4px] border border-transparent transition-all ${!day.active
                    ? "bg-slate-900"
                    : day.intensity === 1
                      ? "bg-green-900/40"
                      : day.intensity === 2
                        ? "bg-green-700/70"
                        : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                    }`}
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
