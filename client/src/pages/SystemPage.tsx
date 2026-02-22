import { useEffect, useState } from "react";
import { Icon } from "../components/common/Icon";

export function SystemPage() {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        setIsLoaded(true);
    }, []);

    return (
        <div className={`space-y-6 pb-20 ${isLoaded ? "animate-in fade-in duration-500" : "opacity-0"}`}>
            <div className="flex items-center gap-4 mb-8">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[hsl(var(--accent)/0.2)] bg-[hsl(var(--accent)/0.1)] shadow-[0_0_15px_rgba(var(--glow),0.1)]">
                    <Icon name="gymnastics" className="w-9 h-9" />
                </div>
                <div>
                    <h1 className="text-3xl font-black uppercase italic tracking-tight text-white drop-shadow-sm md:text-4xl">Sistema</h1>
                    <p className="text-sm font-medium text-slate-400">Gerenciamento central e configuracoes do nucleo.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section className="rounded-3xl border border-white/5 bg-gradient-to-br from-[#02050a]/95 to-[#050101]/95 p-8 shadow-xl backdrop-blur-md">
                    <h2 className="mb-6 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[hsl(var(--accent))]">
                        <Icon name="cogs" /> Configuracoes Basicas
                    </h2>
                    <div className="text-slate-400 text-sm">Em desenvolvimento...</div>
                </section>

                <section className="rounded-3xl border border-white/5 bg-gradient-to-br from-[#02050a]/95 to-[#050101]/95 p-8 shadow-xl backdrop-blur-md">
                    <h2 className="mb-6 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[hsl(var(--accent))]">
                        <Icon name="info-circle" /> Informacoes
                    </h2>
                    <div className="text-slate-400 text-sm">Em desenvolvimento...</div>
                </section>
            </div>
        </div>
    );
}
