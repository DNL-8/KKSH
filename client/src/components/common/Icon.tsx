
interface IconProps {
    name: string;
    type?: "rr" | "rs" | "sr" | "ss" | "br" | "bs"; // rr = regular rounded (default), rs = regular straight, etc.
    className?: string;
    onClick?: () => void;
}

export function Icon({ name, type = "rr", className = "", onClick }: IconProps) {
    // Mapping some common Lucide names to Flaticon equivalents if needed,
    // or just passing through. ideally we strictly use flaticon names.
    return <i onClick={onClick} className={`fi fi-${type}-${name} ${className} flex items-center justify-center`} />;
}
