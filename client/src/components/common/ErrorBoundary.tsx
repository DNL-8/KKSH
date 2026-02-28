import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex min-h-screen flex-col items-center justify-center bg-[#020203] p-8 text-center">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
                        <span className="text-4xl">⚠</span>
                    </div>
                    <h2 className="mb-2 text-xl font-black uppercase tracking-widest text-slate-900">
                        Algo deu errado
                    </h2>
                    <p className="mb-6 max-w-md text-sm text-slate-600">
                        Ocorreu um erro inesperado. Tente recarregar o modulo.
                    </p>
                    {this.state.error && (
                        <pre className="mb-6 max-w-lg overflow-auto rounded-xl border border-slate-800 liquid-glass/60 p-4 text-left text-xs text-red-300">
                            {this.state.error.message}
                        </pre>
                    )}
                    <button
                        className="rounded-xl border border-cyan-500/30 bg-cyan-600 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-900 transition-all hover:bg-cyan-500"
                        onClick={this.handleRetry}
                        type="button"
                    >
                        Tentar novamente
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
