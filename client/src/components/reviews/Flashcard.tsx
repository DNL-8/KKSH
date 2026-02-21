import { useEffect, useState } from "react";
import { Icon } from "../common/Icon";
import type { DueDrillOut } from "../../lib/api";

interface FlashcardProps {
    drill: DueDrillOut;
    onAnswer: (result: "good" | "again", elapsedMs: number) => void;
    onSkip?: () => void;
}

export function Flashcard({ drill, onAnswer, onSkip }: FlashcardProps) {
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
        <div className="flex w-full flex-col items-center justify-center max-w-3xl mx-auto drop-shadow-2xl h-[500px]">
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
                        <div className="flex flex-col h-full w-full rounded-[40px] border border-white/10 bg-gradient-to-br from-[#0a0f1d] to-[#050813] p-10 shadow-[inset_0_0_80px_rgba(255,255,255,0.02)]">

                            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                                <span className="text-xs font-black uppercase tracking-widest text-[#3b82f6]">
                                    {drill.subject}
                                </span>
                                <span title="Dificuldade / Facilidade Atual" className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-bold text-slate-400">
                                    <Icon name="brain" className="text-purple-400" /> Nível {Math.round(drill.ease * 10)}
                                </span>
                            </div>

                            <div className="flex-1 flex items-center justify-center text-center">
                                <h3 className="text-3xl font-medium leading-relaxed text-slate-100 max-w-xl break-words">
                                    {drill.question}
                                </h3>
                            </div>

                            <div className="mt-8 text-center animate-pulse">
                                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600">
                                    Toque para revelar
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* TRASEIRA FACE (Answer) */}
                    <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)]">
                        <div className="flex flex-col h-full w-full rounded-[40px] border border-white/10 bg-gradient-to-br from-[#12182c] to-[#050813] p-10 shadow-[inset_0_0_80px_rgba(255,255,255,0.02)]">

                            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                                    Resposta
                                </span>
                                <button type="button" onClick={onSkip} className="p-2 text-slate-500 hover:text-white transition-colors">
                                    <Icon name="ellipsis-h" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar flex items-center justify-center text-center pb-8">
                                {/* Simulated Markdown / Long Text rendering block */}
                                <div className="text-2xl font-light leading-relaxed text-slate-200 break-words whitespace-pre-wrap">
                                    {drill.answer}
                                </div>
                            </div>

                            {/* Feedback Actions (Good/Again) */}
                            <div className="grid grid-cols-2 gap-4 mt-4 pt-6 border-t border-white/5">
                                <button
                                    onClick={() => submitResult("again")}
                                    className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl border border-red-900/40 bg-red-900/10 p-4 transition-all hover:-translate-y-1 hover:border-red-500/50 hover:bg-red-500/20 hover:shadow-[0_0_30px_rgba(239,68,68,0.2)] active:scale-95"
                                >
                                    <Icon name="cross-circle" className="text-2xl text-red-500 mb-1" />
                                    <span className="text-[13px] font-black uppercase tracking-widest text-red-200">Errado</span>
                                    <span className="text-[9px] font-bold text-red-500/60 uppercase">Teclado: 1</span>
                                </button>

                                <button
                                    onClick={() => submitResult("good")}
                                    className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl border border-emerald-900/40 bg-emerald-900/10 p-4 transition-all hover:-translate-y-1 hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] active:scale-95"
                                >
                                    <Icon name="check-circle" className="text-2xl text-emerald-500 mb-1" />
                                    <span className="text-[13px] font-black uppercase tracking-widest text-emerald-200">Acertei</span>
                                    <span className="text-[9px] font-bold text-emerald-500/60 uppercase">Teclado: 2 / Space</span>
                                </button>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
