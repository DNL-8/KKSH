import { ArrowUpRight, type LucideIcon } from "lucide-react";

interface BentoMiniProps {
  icon: LucideIcon;
  title: string;
  val: string;
  sub: string;
  color: string;
  onClick: () => void;
  children?: React.ReactNode;
}

export function BentoMini({ icon: Icon, title, val, sub, color, onClick, children }: BentoMiniProps) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-[32px] border border-slate-800 bg-[#0a0a0b]/60 p-6 text-left shadow-lg backdrop-blur-md transition-all duration-500 hover:border-slate-600 hover:bg-[#0e0e10]"
      type="button"
    >
      <div className="mb-6 flex items-start justify-between">
        <div
          className={`rounded-2xl border border-slate-800 bg-slate-950 p-3 shadow-xl transition-transform group-hover:scale-110 ${color}`}
        >
          <Icon size={20} />
        </div>
        <div className="opacity-0 transition-opacity group-hover:opacity-100">
          <ArrowUpRight size={14} className="text-slate-600" />
        </div>
      </div>
      <div className="space-y-1">
        <h4 className="mb-1 text-[9px] font-black uppercase leading-none tracking-[0.2em] text-slate-600 group-hover:text-slate-500">
          {title}
        </h4>
        <div className="truncate text-xl font-black tracking-tight text-white">{val}</div>
        <div className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">{sub}</div>
      </div>
      {children}
    </button>
  );
}