import type { LucideIcon } from "lucide-react";

interface DetailedToggleProps {
  label: string;
  desc: string;
  active: boolean;
  onClick?: () => void;
  icon?: LucideIcon;
}

export function DetailedToggle({ label, desc, active, onClick, icon: Icon }: DetailedToggleProps) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full cursor-pointer items-center justify-between rounded-[32px] border border-slate-800 bg-[#050506]/80 p-8 text-left shadow-xl transition-all hover:border-cyan-500/30"
      type="button"
    >
      <div className="flex-1 space-y-2 pr-6">
        <div className="flex items-center gap-3">
          {Icon && <Icon size={18} className={active ? "text-cyan-400" : "text-slate-600"} />}
          <h4
            className={`text-base font-black uppercase tracking-widest transition-colors ${
              active ? "text-white" : "text-slate-500 group-hover:text-slate-400"
            }`}
          >
            {label}
          </h4>
        </div>
        <p className="text-[10px] font-medium uppercase leading-relaxed tracking-tighter text-slate-600">{desc}</p>
      </div>
      <div
        className={`relative h-7 w-14 rounded-full p-1 shadow-inner transition-all duration-500 ${
          active ? "bg-cyan-600 shadow-[0_0_20px_#0891b2]" : "bg-slate-900"
        }`}
      >
        <div
          className={`h-full aspect-square rounded-full bg-white shadow-md transition-transform duration-500 ${
            active ? "translate-x-7" : "translate-x-0"
          }`}
        />
      </div>
    </button>
  );
}