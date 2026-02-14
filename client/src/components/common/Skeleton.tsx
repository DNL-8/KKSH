/**
 * Lightweight skeleton loader with shimmer animation.
 * Use to show placeholders while data is loading.
 *
 * @example
 * <Skeleton className="h-8 w-32" />
 * <Skeleton className="h-4 w-full rounded-lg" />
 */

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = "h-4 w-full" }: SkeletonProps) {
    return (
        <div
            aria-hidden="true"
            className={`animate-pulse rounded-xl bg-slate-800/60 ${className}`}
        />
    );
}
