import { useTheme } from "../../contexts/ThemeContext";

interface ThemeOptionProps {
  color: string;
  active: boolean;
  onClick: () => void;
  label: string;
  testId?: string;
}

export function ThemeOption({ color, active, onClick, label, testId }: ThemeOptionProps) {
  const { isIosTheme } = useTheme();

  return (
    <button onClick={onClick} data-testid={testId} className="group flex flex-col items-center gap-3" type="button">
      <div
        className={`h-14 w-14 rounded-[20px] border-4 transition-all duration-500 ${color} ${
          active
            ? "scale-110 border-white shadow-[0_0_30px_currentColor]"
            : "border-transparent opacity-40 group-hover:scale-105 group-hover:opacity-100"
        }`}
      />
      <span className={`text-[10px] font-black uppercase tracking-widest ${active ? isIosTheme ? "text-slate-900" : "text-slate-100" : isIosTheme ? "text-slate-600" : "text-slate-300"}`}>
        {label}
      </span>
    </button>
  );
}
