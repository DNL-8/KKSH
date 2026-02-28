import { useEffect, useState } from "react";
import { Icon } from "../common/Icon";
import type { DueDrillOut } from "../../lib/api";
import { useTheme } from "../../contexts/ThemeContext";

interface FlashcardProps {
    drill: DueDrillOut;
    onAnswer: (result: "good" | "again", elapsedMs: number) => void;
    onSkip?: () => void;
}

export function Flashcard({ drill, onAnswer, onSkip }: FlashcardProps) {
    const { isIosTheme } = useTheme();
    const [flipped, setFlipped] = useState(false);
    const [swipingOut, setSwipingOut] = useState<"left" | "right" | null>(null);
    const [startTime, setStartTime] = useState<number>(Date.now());

    // Reset internal states when the active drill props change
    useEffect(() => {
        setFlipped(false);
        setSwipingOut(null);
        setStartTime(Date.now());
    }, [drill.drillId]);

    // Keyboard accessibility
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input elsewhere
            if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
            if (swipingOut) return;

            if (!flipped && (e.code === "Space" || e.code === "Enter")) {
                e.preventDefault();
                setFlipped(true);
            } else if (flipped) {
                if (e.code === "Digit1" || e.code === "Numpad1") {
                    submitResult("again");
                } else if (e.code === "Digit2" || e.code === "Numpad2" || e.code === "Space" || e.code === "Enter") {
                    submitResult("good");
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [flipped, swipingOut]); // eslint-disable-line react-hooks/exhaustive-deps

    const submitResult = (res: "good" | "again") => {
        if (swipingOut) return;
        const elapsed = Date.now() - startTime;
        setSwipingOut(res === "good" ? "right" : "left");
        // Trigger callback after quick exit animation translates the card away
        setTimeout(() => {
            onAnswer(res, elapsed);
        }, 300);
    };

    const getExitTransform = () => {
        if (!swipingOut) return "translate-x-0 opacity-100 scale-100";
        if (swipingOut === "left") return "-translate-x-32 opacity-0 rotate-[-10deg] scale-95";
        if (swipingOut === "right") return "translate-x-32 opacity-0 rotate-[10deg] scale-95";
        return "";
    };

    return (
        <div className={`mx-auto flex h-[500px] w-full max-w-3xl flex-col items-center justify-center drop-shadow-2xl ${isIosTheme ? "ios26-text-secondary" : ""}`}>
            {/* 3D Scene Wrapper */}
            <div
                className={`w-full h-full [perspective:2000px] transition-all duration-300 ease-in-out ${getExitTransform()}`}
            >
                {/* Flippable Container */}
                <div
                    onClick={() => !flipped && setFlipped(true)}
                    className={`relative w-full h-full transition-all duration-700 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : "cursor-pointer hover:scale-[1.02] hover:-translate-y-2"
                        }`}
                >
                    {/* FRONTAL FACE (Question) */}
                    <div className="absolute inset-0 w-full h-full [backface-visibility:hidden]">
                        <div className={`flex h-full w-full flex-col rounded-[40px] p-10 ${isIosTheme ? "ios26-glass-intense ios26-sheen" : "border border-slate-300/50 bg-gradient-to-br from-[#0a0f1d] to-[#050813] shadow-[inset_0_0_80px_rgba(255,255,255,0.02)]"}`}>

                            <div className={`mb-6 flex items-center justify-between border-b pb-4 ${isIosTheme ? "border-white/25" : "border-slate-300/50"}`}>
                                <span className={`text-xs font-black uppercase tracking-widest ${isIosTheme ? "text-cyan-100" : "text-[#3b82f6]"}`}>
                                    {drill.subject}
                                </span>
                                <span title="Dificuldade / Facilidade Atual" className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold ${isIosTheme ? "ios26-glass-intense-soft text-slate-100" : "border-slate-300/50 bg-white/[0.03] text-slate-600"}`}>
                                    <Icon name="brain" className="text-purple-400" /> Nível {Math.round(drill.ease * 10)}
                                </span>
                            </div>

                            <div className="flex-1 flex items-center justify-center text-center">
                                <h3 className={`max-w-xl break-words text-3xl font-medium leading-relaxed ${isIosTheme ? "text-white" : "text-slate-100"}`}>
                                    {drill.question}
                                </h3>
                            </div>

                            <div className="mt-8 text-center animate-pulse">
                                <span className={`text-[10px] font-bold uppercase tracking-[0.3em] ${isIosTheme ? "text-slate-200/75" : "text-slate-600"}`}>
                                    Toque para revelar
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* TRASEIRA FACE (Answer) */}
                    <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)]">
                        <div className={`flex h-full w-full flex-col rounded-[40px] p-10 ${isIosTheme ? "ios26-glass-intense ios26-sheen" : "border border-slate-300/50 bg-gradient-to-br from-[#12182c] to-[#050813] shadow-[inset_0_0_80px_rgba(255,255,255,0.02)]"}`}>

                            <div className={`mb-6 flex items-center justify-between border-b pb-4 ${isIosTheme ? "border-white/25" : "border-slate-300/50"}`}>
                                <span className={`text-xs font-black uppercase tracking-widest ${isIosTheme ? "text-emerald-200" : "text-emerald-400"}`}>
                                    Resposta
                                </span>
                                <button type="button" onClick={onSkip} className={`rounded-full p-2 transition-colors ${isIosTheme ? "ios26-control ios26-focusable text-slate-100 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}>
                                    <Icon name="ellipsis-h" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar flex items-center justify-center text-center pb-8">
                                {/* Simulated Markdown / Long Text rendering block */}
                                <div className={`break-words whitespace-pre-wrap text-2xl font-light leading-relaxed ${isIosTheme ? "text-slate-100" : "text-slate-200"}`}>
                                    {drill.answer}
                                </div>
                            </div>

                            {/* Feedback Actions (Good/Again) */}
                            <div className={`mt-4 grid grid-cols-2 gap-4 border-t pt-6 ${isIosTheme ? "border-white/25" : "border-slate-300/50"}`}>
                                <button
                                    onClick={() => submitResult("again")}
                                    className={`group relative flex flex-col items-center justify-center gap-1 rounded-2xl border p-4 transition-all hover:-translate-y-1 active:scale-95 ${isIosTheme
                                        ? "ios26-focusable border-red-300/40 bg-red-500/20 hover:border-red-300/60 hover:bg-red-500/30 hover:shadow-[0_0_30px_rgba(239,68,68,0.22)]"
                                        : "border-red-900/40 bg-red-900/10 hover:border-red-500/50 hover:bg-red-500/20 hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]"
                                        }`}
                                >
                                    <Icon name="cross-circle" className="text-2xl text-red-500 mb-1" />
                                    <span className={`text-[13px] font-black uppercase tracking-widest ${isIosTheme ? "text-red-100" : "text-red-200"}`}>Errado</span>
                                    <span className={`text-[9px] font-bold uppercase ${isIosTheme ? "text-red-100/70" : "text-red-500/60"}`}>Teclado: 1</span>
                                </button>

                                <button
                                    onClick={() => submitResult("good")}
                                    className={`group relative flex flex-col items-center justify-center gap-1 rounded-2xl border p-4 transition-all hover:-translate-y-1 active:scale-95 ${isIosTheme
                                        ? "ios26-focusable border-emerald-300/40 bg-emerald-500/20 hover:border-emerald-300/60 hover:bg-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.24)]"
                                        : "border-emerald-900/40 bg-emerald-900/10 hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                                        }`}
                                >
                                    <Icon name="check-circle" className="text-2xl text-emerald-500 mb-1" />
                                    <span className={`text-[13px] font-black uppercase tracking-widest ${isIosTheme ? "text-emerald-100" : "text-emerald-200"}`}>Acertei</span>
                                    <span className={`text-[9px] font-bold uppercase ${isIosTheme ? "text-emerald-100/70" : "text-emerald-500/60"}`}>Teclado: 2 / Space</span>
                                </button>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
