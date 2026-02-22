import { Icon } from "./Icon";

interface DetailedToggleProps {
  label: string;
  desc: string;
  active: boolean;
  onClick?: () => void;
  icon?: string;
}

export function DetailedToggle({ label, desc, active, onClick, icon }: DetailedToggleProps) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full cursor-pointer items-center justify-between rounded-[32px] border border-slate-800 bg-[#050506]/80 p-8 text-left shadow-xl transition-all hover:border-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
    >
      <div className="flex-1 space-y-2 pr-6">
        <div className="flex items-center gap-3">
          {icon && <Icon name={icon} className={`text-[18px] ${active ? "text-cyan-400" : "text-slate-600"}`} aria-hidden="true" />}
          <h4
            className={`text-base font-black uppercase tracking-widest transition-colors ${active ? "text-slate-900" : "text-slate-500 group-hover:text-slate-600"
              }`}
          >
            {label}
          </h4>
        </div>
        <p className="text-[11px] font-medium uppercase leading-relaxed tracking-tighter text-slate-500">{desc}</p>
      </div>
      <div
        className={`relative h-7 w-14 rounded-full p-1 shadow-inner transition-all duration-500 ${active ? "bg-cyan-600 shadow-[0_0_20px_#0891b2]" : "liquid-glass"
          }`}
        aria-hidden="true"
      >
        <div
          className={`h-full aspect-square rounded-full bg-white shadow-md transition-transform duration-500 ${active ? "translate-x-7" : "translate-x-0"
            }`}
        />
      </div>
    </button>
  );
}