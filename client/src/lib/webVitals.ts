/**
 * Web Vitals reporter — sends CLS, INP, LCP metrics to the backend.
 *
 * Uses the `web-vitals` library (loaded dynamically to avoid adding to
 * the critical path) and POSTs each metric to `/api/v1/reports/web-vitals`.
 */

type WebVitalMetric = {
    name: string;
    value: number;
    rating: "good" | "needs-improvement" | "poor";
    id: string;
};

function sendMetric(metric: WebVitalMetric): void {
    const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        path: window.location.pathname,
    });

    // Use `sendBeacon` when available (survives page unloads), else fall back to fetch.
    if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/v1/reports/web-vitals", blob);
    } else {
        fetch("/api/v1/reports/web-vitals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
        }).catch(() => {
            // Silently ignore — metrics reporting is best-effort.
        });
    }
}

export function initWebVitals(): void {
    // Dynamic import so the library is tree-shaken if not used.
    import("web-vitals")
        .then(({ onCLS, onINP, onLCP }) => {
            onCLS(sendMetric);
            onINP(sendMetric);
            onLCP(sendMetric);
        })
        .catch(() => {
            // web-vitals not installed — silently skip.
        });
}
