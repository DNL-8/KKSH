import { useCallback, useRef } from "react";
import { Icon } from "./Icon";

interface BentoMiniProps {
  icon: string;
  title: string;
  val: string;
  sub: string;
  color: string;
  onClick: () => void;
  children?: React.ReactNode;
}

export function BentoMini({ icon, title, val, sub, color, onClick, children }: BentoMiniProps) {
  const glowRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!glowRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    glowRef.current.style.background = `radial-gradient(300px circle at ${x}px ${y}px, rgba(var(--glow), 0.12), transparent 60%)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (glowRef.current) {
      glowRef.current.style.background = "transparent";
    }
  }, []);

  return (
    <button
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="animated-border group relative overflow-hidden rounded-[32px] border border-slate-800 bg-[#0a0a0b]/60 p-6 text-left shadow-lg backdrop-blur-md transition-all duration-500 hover:border-slate-600 hover:bg-[#0e0e10]"
      type="button"
    >
      {/* Mouse-tracking glow */}
      <div ref={glowRef} className="pointer-events-none absolute inset-0 z-0 rounded-[32px] transition-[background] duration-300" />
      <div className="relative z-10">
        <div className="mb-6 flex items-start justify-between">
          <div
            className={`rounded-2xl border border-slate-800 bg-slate-950 p-3 shadow-xl transition-transform group-hover:scale-110 ${color}`}
          >
            <Icon name={icon} className="text-[20px]" />
          </div>
          <div className="opacity-0 transition-opacity group-hover:opacity-100">
            <Icon name="arrow-up-right" className="text-slate-600 text-[14px]" />
          </div>
        </div>
        <div className="space-y-1">
          <h4 className="mb-1 text-[10px] font-black uppercase leading-none tracking-[0.2em] text-slate-600 group-hover:text-slate-800">
            {title}
          </h4>
          <div className="truncate text-xl font-black tracking-tight text-slate-900">{val}</div>
          <div className="text-[10px] font-bold uppercase tracking-tighter text-slate-600">{sub}</div>
        </div>
        {children}
      </div>
    </button>
  );
}