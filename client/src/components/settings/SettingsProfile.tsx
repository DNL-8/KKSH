import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "../common/Icon";
import { Badge } from "../common/Badge";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../common/Toast";
import { updateProfile } from "../../lib/api";

export function SettingsProfile() {
    const { authUser: user } = useAuth();
    const { showToast } = useToast();
    const queryClient = useQueryClient();

    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState("");
    const [isSavingName, setIsSavingName] = useState(false);

    const handleSaveName = async () => {
        setIsSavingName(true);
        try {
            await updateProfile({ username: tempName });
            await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
            window.location.reload();
        } catch (err) {
            showToast("Erro ao atualizar nome. Pode estar em uso.", "error");
        } finally {
            setIsSavingName(false);
            setIsEditingName(false);
        }
    };

    return (
        <div className="overflow-hidden rounded-[40px] border border-slate-800 bg-[#0a0a0b]/60 p-1 shadow-2xl backdrop-blur-xl">
            <div className="relative overflow-hidden rounded-[36px] bg-slate-900/50 p-8 md:p-12">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent opacity-50" />

                <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-start">
                    <div className="relative group perspective-1000">
                        <div className="absolute inset-0 -inset-4 rounded-full bg-[radial-gradient(circle,rgba(var(--glow),0.4),transparent_70%)] blur-xl opacity-60 group-hover:opacity-100 group-hover:scale-110 transition duration-700" />
                        <div className="relative h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-black/60 p-1 md:h-32 md:w-32 shadow-[inset_0_0_20px_rgba(var(--glow),0.3)] transform-style-3d transition-transform duration-500 group-hover:rotate-y-12">
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#0c1020] to-[#04060a] text-[hsl(var(--accent))] shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
                                <Icon name="robot" className="h-10 w-10 md:h-12 md:w-12 text-[48px] drop-shadow-[0_0_10px_rgba(var(--glow),0.8)]" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={tempName}
                                        onChange={(e) => setTempName(e.target.value)}
                                        className="bg-black/40 border border-[hsl(var(--accent)/0.3)] shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),0_0_15px_rgba(var(--glow),0.1)] rounded-xl px-4 py-2 text-white text-xl font-bold uppercase tracking-widest focus:outline-none focus:border-[hsl(var(--accent))] focus:ring-1 focus:ring-[hsl(var(--accent)/0.3)] min-w-[200px]"
                                        placeholder="Novo nome"
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => void handleSaveName()}
                                        disabled={isSavingName}
                                        className="p-2 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 disabled:opacity-50"
                                    >
                                        <Icon name="check" className="text-[18px]" />
                                    </button>
                                    <button
                                        onClick={() => setIsEditingName(false)}
                                        disabled={isSavingName}
                                        className="p-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 disabled:opacity-50"
                                    >
                                        <Icon name="cross" className="text-[18px]" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
                                        {user?.username || user?.email?.split('@')[0] || "Caçador"}
                                    </h2>
                                    <button
                                        onClick={() => {
                                            setTempName(user?.username || "");
                                            setIsEditingName(true);
                                        }}
                                        className="p-3 rounded-full hover:bg-white/[0.05] text-slate-500 hover:text-[hsl(var(--accent))] transition-all active:scale-95"
                                    >
                                        <Icon name="pencil" className="text-[16px]" />
                                    </button>
                                </>
                            )}

                            <Badge color="bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))] border-[hsl(var(--accent)/0.2)] shadow-[0_0_10px_rgba(var(--glow),0.1)]" icon="check-circle">
                                Verificado
                            </Badge>
                            <Badge color="bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]" icon="crown">
                                Premium
                            </Badge>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/5 bg-black/40 p-5 shadow-[inset_0_2px_15px_rgba(0,0,0,0.6)] transition-all hover:bg-black/60">
                                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-[hsl(var(--accent)/0.6)] drop-shadow-[0_0_5px_rgba(var(--glow),0.3)]">ID do Usuario</span>
                                <code className="font-mono text-[11px] text-slate-300 bg-white/[0.03] px-2 py-1 rounded">{user?.id}</code>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-black/40 p-5 shadow-[inset_0_2px_15px_rgba(0,0,0,0.6)] transition-all hover:bg-black/60">
                                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-[hsl(var(--accent)/0.6)] drop-shadow-[0_0_5px_rgba(var(--glow),0.3)]">Email</span>
                                <div className="flex items-center justify-between">
                                    <code className="font-mono text-[11px] text-slate-300 bg-white/[0.03] px-2 py-1 rounded">{user?.email}</code>
                                    <Icon name="key" className="text-[hsl(var(--accent)/0.5)] text-[16px]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
