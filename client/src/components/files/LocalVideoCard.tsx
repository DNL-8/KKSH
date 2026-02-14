import { FileVideo, FolderTree, Trash2 } from "lucide-react";

import { DEFAULT_RELATIVE_PATH, type StoredVideo } from "../../lib/localVideosStore";

interface LocalVideoCardProps {
  video: StoredVideo;
  src: string;
  onDelete: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatCreatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function LocalVideoCard({ video, src, onDelete }: LocalVideoCardProps) {
  const relativePath = video.relativePath || DEFAULT_RELATIVE_PATH;

  return (
    <article
      className="group overflow-hidden rounded-[32px] border border-slate-800 bg-[#0a0a0b]/80 shadow-2xl transition-all duration-300 hover:border-cyan-500/40"
      data-testid={`local-video-card-${video.id}`}
    >
      <div className="aspect-video overflow-hidden bg-slate-950">
        <video className="h-full w-full object-cover" controls playsInline preload="metadata" src={src} />
      </div>

      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h3 className="truncate text-sm font-black tracking-tight text-white">{video.name}</h3>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{video.type || "video/*"}</p>
            <p className="inline-flex max-w-full items-center gap-1 truncate text-[10px] font-bold tracking-wider text-slate-400" title={relativePath}>
              <FolderTree size={11} className="shrink-0" />
              {relativePath}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-400">
            <FileVideo size={12} />
            local
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[10px] uppercase tracking-wider text-slate-500">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <p className="font-black text-slate-600">Tamanho</p>
            <p className="mt-1 font-mono text-slate-300">{formatBytes(video.size)}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <p className="font-black text-slate-600">Adicionado</p>
            <p className="mt-1 font-mono text-slate-300">{formatCreatedAt(video.createdAt)}</p>
          </div>
        </div>

        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 transition-all hover:border-red-500/60 hover:bg-red-500/20 hover:text-red-300 active:scale-95"
          onClick={() => onDelete(video.id)}
          type="button"
          aria-label={`Remover video ${video.name}`}
        >
          <Trash2 size={14} />
          Remover
        </button>
      </div>
    </article>
  );
}
