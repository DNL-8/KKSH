import { useTheme } from "../../contexts/ThemeContext";

interface IconProps {
    name: string;
    type?: "rr" | "rs" | "sr" | "ss" | "br" | "bs"; // rr = regular rounded (default), rs = regular straight, etc.
    className?: string;
    onClick?: () => void;
}

export function Icon({ name, type = "rr", className = "", onClick }: IconProps) {
    const { isLightTheme } = useTheme();

    if (name === "gymnastics") {
        return (
            <img
                src="/gymnastics-icon.png"
                alt="Gymnastics icon"
                onClick={onClick}
                className={`object-contain transition-all ${className} ${isLightTheme
                        ? "brightness-0 opacity-80"
                        : "brightness-0 invert drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]"
                    }`}
                style={{ width: '1em', height: '1em' }}
            />
        );
    }

    return <i onClick={onClick} className={`fi fi-${type}-${name} ${className} flex items-center justify-center`} />;
}
