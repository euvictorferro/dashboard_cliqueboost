// src/components/ContentCardVideoField.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "./ContentCardModal";
import { AttachmentIcon, TrashIcon } from "./icons";
import type { ContentVideo } from "@/lib/googleDrive";

const MAX_VIDEOS_PER_POST = 20;

function formatSize(bytes: number): string {
  if (bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)}GB` : `${mb.toFixed(1)}MB`;
}

function uploadWithProgress(url: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload_failed_${xhr.status}`)));
    xhr.onerror = () => reject(new Error("upload_network_error"));
    xhr.send(file);
  });
}

export function VideoUploadField({
  clientId,
  cardId,
  cardName,
}: {
  clientId: string;
  cardId: string;
  cardName: string;
}) {
  const [videos, setVideos] = useState<ContentVideo[] | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [identifyingTakes, setIdentifyingTakes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function videosUrl(): string {
    return `/api/content/${clientId}/card/${cardId}/videos?cardName=${encodeURIComponent(cardName)}`;
  }

  async function refreshVideos() {
    try {
      const res = await fetch(videosUrl());
      if (!res.ok) {
        setError("Não foi possível carregar os vídeos.");
        return;
      }
      const data: { videos: ContentVideo[] } = await res.json();
      setVideos(data.videos);
    } catch {
      setError("Não foi possível carregar os vídeos.");
    }
  }

  useEffect(() => {
    refreshVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  async function handleFilesSelected(fileList: FileList) {
    const files = Array.from(fileList);
    setError(null);

    if (files.some((f) => !f.type.startsWith("video/"))) {
      setError("Só é possível enviar arquivos de vídeo.");
      return;
    }
    if ((videos?.length ?? 0) + files.length > MAX_VIDEOS_PER_POST) {
      setError(`Máximo de ${MAX_VIDEOS_PER_POST} vídeos por post.`);
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        setProgress((prev) => ({ ...prev, [file.name]: 0 }));
        const initRes = await fetch(`/api/content/${clientId}/card/${cardId}/videos/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size, cardName }),
        });
        if (!initRes.ok) {
          const body = await initRes.json().catch(() => null);
          if (body?.error === "unauthorized") {
            throw new Error("unauthorized");
          } else if (body?.error === "max_videos_reached") {
            throw new Error("max_videos_reached");
          }
          throw new Error("init_failed");
        }
        const { uploadUrl } = await initRes.json();
        await uploadWithProgress(uploadUrl, file, (percent) => setProgress((prev) => ({ ...prev, [file.name]: percent })));
      }
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setError("Sua sessão expirou, recarregue a página.");
      } else if (err instanceof Error && err.message === "max_videos_reached") {
        setError("Limite de 20 vídeos atingido.");
      } else {
        setError("Não foi possível enviar um dos vídeos. Tenta de novo.");
      }
    } finally {
      try {
        await refreshVideos();
      } catch {
        // ponytail: cleanup below must still run even if refresh fails
      }
      setUploading(false);
      setProgress({});
      if (fileInputRef.current) fileInputRef.current.value = "";

      setIdentifyingTakes(true);
      fetch(`/api/content/${clientId}/card/${cardId}/videos/match-takes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardName }),
      })
        .then(() => refreshVideos())
        .catch(() => {
          // ponytail: falha silenciosa — vídeos ficam com nome original, sem travar a UI de upload.
        })
        .finally(() => setIdentifyingTakes(false));
    }
  }

  async function handleDelete(video: ContentVideo) {
    setVideos((prev) => (prev ? prev.filter((v) => v.id !== video.id) : prev));
    try {
      const res = await fetch(
        `/api/content/${clientId}/card/${cardId}/videos/${video.id}?cardName=${encodeURIComponent(cardName)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
    } catch {
      await refreshVideos();
    }
  }

  const atLimit = (videos?.length ?? 0) >= MAX_VIDEOS_PER_POST;

  return (
    <Field
      label="Vídeos"
      icon={<AttachmentIcon size={14} />}
      action={
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || atLimit}
          className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {uploading ? "Enviando..." : "Adicionar"}
        </button>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
      />
      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
      {identifyingTakes && <p className="mb-2 text-xs text-muted-foreground">Identificando takes...</p>}
      {Object.entries(progress).map(([name, percent]) => (
        <div key={name} className="mb-1 text-xs text-muted-foreground">
          {name}: {percent}%
        </div>
      ))}
      {videos === null ? (
        <span className="text-muted-foreground">Carregando...</span>
      ) : videos.length === 0 ? (
        <span className="text-muted-foreground">Nenhum vídeo enviado ainda</span>
      ) : (
        <ul className="space-y-2">
          {videos.map((video) => (
            <li key={video.id} className="flex items-center justify-between gap-2 text-xs">
              <a href={video.webViewLink} target="_blank" rel="noopener noreferrer" className="truncate text-blue-600 underline">
                {video.name}
              </a>
              <span className="shrink-0 text-muted-foreground">{formatSize(video.size)}</span>
              <button
                type="button"
                onClick={() => handleDelete(video)}
                aria-label="Remover"
                className="shrink-0 text-muted-foreground hover:text-red-500"
              >
                <TrashIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
