import { Cpu } from "lucide-react";

export function BootSplash() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#020204] p-4 font-mono text-cyan-500">
            <div className="relative mb-16">
                <div className="h-32 w-32 animate-ping rounded-full border-[8px] border-cyan-500/5" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-20 w-20 animate-spin items-center justify-center rounded-[40px] border-2 border-cyan-500/30 bg-cyan-500/10">
                        <Cpu size={40} className="text-cyan-500" />
                    </div>
                </div>
            </div>
            <div className="max-w-xs space-y-6 text-center">
                <div className="animate-pulse text-3xl font-black uppercase italic tracking-[0.5em]">Iniciando Link</div>
                <div className="space-y-1.5">
                    <div className="h-1 w-full overflow-hidden rounded-full border border-cyan-900/30 bg-slate-900">
                        <div className="animate-shimmer h-full w-[70%] bg-cyan-500" />
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-cyan-900">
                        <span>Neural Sinc</span>
                        <span>70%</span>
                    </div>
                </div>
                <div className="mt-8 text-[9px] font-black uppercase leading-relaxed tracking-[0.3em] text-cyan-900">
                    Estabelecendo conexao tatica com hospedeiro #9284-AX...
                </div>
            </div>
        </div>
    );
}
