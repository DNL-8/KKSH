import { useEffect, useState } from "react";
import { Icon } from "../components/common/Icon";
import { useSfx } from "../hooks/useSfx";

export function BootSplash() {
    const sfx = useSfx();
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("Estabelecendo conexao tatica com hospedeiro #9284-AX...");

    useEffect(() => {
        // Play boot sound on mount
        sfx("boot");

        // Simulate boot sequence text
        const sequence = [
            { time: 300, text: "Carregando modulos core..." },
            { time: 800, text: "Sincronizando telemetria neural..." },
            { time: 1300, text: "Iniciando protocolos de defesa..." },
            { time: 1800, text: "Uplink estabelecido. Bem-vindo." }
        ];

        const timers = sequence.map(step =>
            setTimeout(() => setStatusText(step.text), step.time)
        );

        // Progress counter simulation
        let current = 0;
        const interval = setInterval(() => {
            current += Math.random() * 15;
            if (current > 100) current = 100;
            setProgress(Math.floor(current));
            if (current === 100) clearInterval(interval);
        }, 100);

        return () => {
            timers.forEach(clearTimeout);
            clearInterval(interval);
        };
    }, [sfx]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#020204] p-4 font-mono text-[hsl(var(--accent))]">
            <div className="relative mb-16">
                <div className="h-32 w-32 animate-ping-slow rounded-full border-[8px] border-[hsl(var(--accent)/0.05)]" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-20 w-20 animate-spin-slow items-center justify-center rounded-[40px] border-2 border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.1)] shadow-[0_0_30px_rgba(var(--glow),0.2)]">
                        <Icon name="cpu" className="text-[hsl(var(--accent))] text-[40px] drop-shadow-[0_0_8px_rgba(var(--glow),0.8)]" />
                    </div>
                </div>
            </div>

            <div className="max-w-xs space-y-6 text-center w-full">
                <div className="animate-pulse text-3xl font-black uppercase italic tracking-[0.5em] drop-shadow-[0_0_10px_rgba(var(--glow),0.5)]">
                    Iniciando Link
                </div>

                <div className="space-y-1.5 pt-4">
                    <div className="h-1 w-full overflow-hidden rounded-full border border-[hsl(var(--accent)/0.3)] liquid-glass shadow-[0_0_15px_rgba(var(--glow),0.2)]">
                        {/* CSS animated progress bar matching the boot time */}
                        <div className="boot-progress-bar h-full bg-[hsl(var(--accent))] shadow-[0_0_10px_rgba(var(--glow),0.8)]" />
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[hsl(var(--accent-light))] opacity-80">
                        <span>Neural Sinc</span>
                        <span>{progress}%</span>
                    </div>
                </div>

                <div className="mt-8 h-8 text-[9px] font-black uppercase leading-relaxed tracking-[0.3em] text-[hsl(var(--accent)/0.6)]">
                    <span className="animate-pulse">{statusText}</span>
                </div>
            </div>

            {/* Subtle background glow */}
            <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
                <div className="h-[40vh] w-[40vh] rounded-full bg-[hsl(var(--accent)/0.03)] blur-[100px]" />
            </div>
        </div>
    );
}
