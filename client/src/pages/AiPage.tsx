import { useEffect, useRef, useState } from "react";

import { Icon } from "../components/common/Icon";
import { ApiRequestError, postHunterMessage } from "../lib/api";

interface TerminalMessage {
  id: number;
  text: string;
  type: "user" | "system" | "error";
}

export function AiPage() {
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<TerminalMessage[]>([
    {
      id: 1,
      text: "SISTEMA: Ligação estabelecida. O que pretendes processar, Caçador?",
      type: "system",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const sendCommand = async () => {
    if (!input.trim() || loading) {
      return;
    }

    const message = input.trim();
    setInput("");
    setLogs((prev) => [...prev, { id: Date.now(), text: `CAÇADOR: ${message}`, type: "user" }]);
    setLoading(true);

    try {
      const response = await postHunterMessage(message);
      const systemText = [response.resposta_texto, `[STATUS] ${response.status_mensagem}`].join("\n");
      setLogs((prev) => [...prev, { id: Date.now() + 1, text: `SISTEMA: ${systemText}`, type: "system" }]);
    } catch (error) {
      let messageText = "ERRO: Falha de uplink com o núcleo IA.";
      if (error instanceof ApiRequestError) {
        const retryAfter = String(error.details.retryAfterSec ?? "").trim();
        if (error.code === "ai_quota_exceeded" && retryAfter) {
          messageText = `ERRO: Quota do provedor atingida. Tente novamente em ~${retryAfter}s.`;
        } else {
          messageText = `ERRO: ${error.message}`;
        }
      }
      setLogs((prev) => [...prev, { id: Date.now() + 1, text: messageText, type: "error" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in zoom-in relative flex h-[calc(100vh-10rem)] min-h-[500px] flex-col overflow-hidden rounded-[48px] border border-[hsl(var(--accent)/0.15)] bg-[#020204] shadow-2xl duration-700">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20" />

      <div className="z-10 flex items-center justify-between border-b border-[hsl(var(--accent)/0.15)] bg-[#0c0e12]/90 p-8 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-5">
          <div className="rounded-2xl border border-[hsl(var(--accent)/0.2)] bg-[hsl(var(--accent)/0.1)] p-3 shadow-[0_0_15px_rgba(var(--glow),0.1)]">
            <Icon name="microchip" className="animate-pulse text-[hsl(var(--accent))] text-[28px]" />
          </div>
          <div>
            <h2 className="mb-2 text-xl font-black uppercase italic leading-none tracking-[0.4em] text-[hsl(var(--accent))]">
              Neural IQ Core
            </h2>
            <div className="flex gap-4 text-[10px] font-mono font-black uppercase text-[hsl(var(--accent)/0.6)]">
              <span className="flex items-center gap-2 drop-shadow-[0_0_5px_rgba(var(--glow),0.5)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--accent))]" /> Sincronizado
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent)/0.3)]" /> CPU Load: 12%
              </span>
            </div>
          </div>
        </div>
        <div className="hidden gap-2 md:flex">
          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[hsl(var(--accent)/0.15)]">
            <div className="animate-shimmer h-full w-[60%] bg-[hsl(var(--accent))]" />
          </div>
          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[hsl(var(--accent)/0.15)]">
            <div className="animate-shimmer h-full w-[85%] bg-[hsl(var(--accent-light))]" />
          </div>
        </div>
      </div>

      <div className="custom-scrollbar z-10 flex-1 space-y-8 overflow-y-auto p-10 font-mono text-[13px] scroll-smooth">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`animate-in fade-in slide-in-from-bottom-2 flex flex-col duration-500 ${log.type === "user" ? "items-end" : "items-start"
              }`}
          >
            <div
              className={`relative max-w-[85%] rounded-3xl border px-6 py-4 shadow-2xl ${log.type === "user"
                ? "rounded-br-none border-slate-700 bg-[#12141c] text-slate-900"
                : log.type === "error"
                  ? "rounded-bl-none border-red-900/40 bg-red-950/20 text-red-200"
                  : "rounded-bl-none border-[hsl(var(--accent)/0.15)] bg-[hsl(var(--accent)/0.05)] text-[hsl(var(--accent-light))]"
                }`}
            >
              <div
                className={`mb-3 text-[10px] font-black uppercase tracking-[0.3em] ${log.type === "user"
                  ? "text-slate-500"
                  : log.type === "error"
                    ? "text-red-400 drop-shadow-sm"
                    : "text-[hsl(var(--accent)/0.8)] drop-shadow-[0_0_5px_rgba(var(--glow),0.3)]"
                  }`}
              >
                {log.type === "user" ? ">> Hunter #9284-AX" : log.type === "error" ? "> System Error" : "> System Output"}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{log.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="ml-2 flex items-center gap-4 animate-pulse text-[hsl(var(--accent)/0.3)]">
            <Icon name="spinner" className="animate-spin text-[18px]" />
            <span className="text-xs font-black uppercase tracking-[0.5em]">Processando diretrizes táticas...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="z-10 border-t border-[hsl(var(--accent)/0.15)] bg-[#0a0c10]/95 p-8 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="relative mx-auto flex max-w-4xl items-center">
          <div className="pointer-events-none absolute left-6 font-mono text-lg font-bold tracking-widest text-[hsl(var(--accent)/0.5)] opacity-80 drop-shadow-[0_0_5px_rgba(var(--glow),0.4)]">
            {">"}
          </div>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void sendCommand();
              }
            }}
            placeholder="Introduza diretriz para o Sistema..."
            className="w-full rounded-[32px] border border-[hsl(var(--accent)/0.4)] bg-[#050508]/80 py-5 pl-14 pr-20 font-mono text-sm text-slate-900 shadow-[inset_0_5px_15px_rgba(0,0,0,0.8),0_0_15px_rgba(var(--glow),0.15)] transition-all placeholder:text-[hsl(var(--accent)/0.3)] focus:border-[hsl(var(--accent))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent)/0.3)] backdrop-blur-md"
          />
          <button
            onClick={() => {
              void sendCommand();
            }}
            disabled={loading || !input.trim()}
            className="absolute right-3 flex items-center justify-center rounded-[20px] bg-[hsl(var(--accent))] p-4 text-black shadow-[0_0_20px_rgba(var(--glow),0.6)] transition-all hover:brightness-125 hover:shadow-[0_0_30px_rgba(var(--glow),0.8)] hover:scale-105 active:scale-95 disabled:opacity-20"
            type="button"
          >
            <Icon name="paper-plane" className="text-[20px]" />
          </button>
        </div>
      </div>
    </div>
  );
}