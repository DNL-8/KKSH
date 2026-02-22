import { Icon } from "../common/Icon";
import { Badge } from "../common";

interface ActiveQuestion {
  id: string;
  text: string;
  options: string[];
}

interface CombatQuizModalProps {
  question: ActiveQuestion;
  answering: boolean;
  onAnswer: (optionIndex: number) => void;
}

export function CombatQuizModal({ question, answering, onAnswer }: CombatQuizModalProps) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-[#02050a]/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-300"
      data-testid="quiz-modal"
    >
      <div className="w-full max-w-2xl rounded-[40px] border border-cyan-500/30 bg-[#050813]/90 p-10 shadow-[0_0_60px_rgba(34,211,238,0.15),inset_0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="mb-8 flex items-center justify-between border-b border-cyan-500/20 pb-6">
          <h3 className="flex items-center gap-3 text-lg font-black uppercase tracking-widest text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
            <Icon name="brain" />
            Desafio Incursão
          </h3>
          <Badge color="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" icon="crossed-swords">
            Dano Crítico
          </Badge>
        </div>

        <p className="mb-10 text-xl font-bold leading-relaxed text-slate-900 drop-shadow-md" data-testid="quiz-question-text">
          {question.text}
        </p>

        <div className="grid gap-4">
          {question.options.map((option, index) => (
            <button
              key={`${question.id}-${index}`}
              onClick={() => void onAnswer(index)}
              className="group flex w-full items-center justify-between rounded-2xl border border-slate-300/50 bg-white/[0.02] p-6 text-left transition-all duration-300 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:shadow-[0_0_20px_rgba(34,211,238,0.2),inset_0_0_10px_rgba(34,211,238,0.1)] hover:-translate-y-1 disabled:opacity-60"
              type="button"
              disabled={answering}
              data-testid={`quiz-option-${index}`}
            >
              <span className="text-sm font-bold text-slate-800 transition-colors group-hover:text-slate-900 group-hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.7)]">{option}</span>
              <Icon name="arrow-right" className="text-cyan-400 opacity-0 transition-opacity group-hover:opacity-100 text-[18px]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
