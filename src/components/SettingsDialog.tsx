"use client";

import { useEffect, useRef, useState } from "react";
import { X, Upload, Database, Trash2, Loader2 } from "lucide-react";
import { Button, Eyebrow } from "./ui";

interface Counts {
  notes_loaded: number;
  chunks_indexed: number;
  vault_notes: number;
  capture_notes: number;
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const j = await fetch("/api/notes/count").then((r) => r.json());
    setCounts(j);
  }
  useEffect(() => {
    if (open) refresh();
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/notes/upload", { method: "POST", body: form });
      const j = await res.json();
      if (j.error) setMsg(j.error);
      else setMsg(`Indexed ${j.notes_loaded} notes (${j.chunks_indexed} chunks).`);
      await refresh();
    } catch {
      setMsg("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function clearVault() {
    if (!confirm("Wipe uploaded vault notes? Captures and Ask answers are kept.")) return;
    setBusy(true);
    await fetch("/api/notes", { method: "DELETE" });
    setMsg("Vault cleared.");
    await refresh();
    setBusy(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius)] border border-border-strong bg-surface p-6 fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-semibold text-fg">Knowledge base</h2>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <Stat label="Vault notes" value={counts?.vault_notes ?? "—"} />
          <Stat label="Captures" value={counts?.capture_notes ?? "—"} />
          <Stat label="Total notes" value={counts?.notes_loaded ?? "—"} />
          <Stat label="Chunks indexed" value={counts?.chunks_indexed ?? "—"} />
        </div>

        <Eyebrow>Upload Obsidian vault</Eyebrow>
        <p className="text-[13px] text-fg-muted mt-1 mb-3">
          A <code className="font-mono text-[12px]">.zip</code> of your <code className="font-mono text-[12px]">.md</code> notes.
          Re-uploading replaces vault notes only — captures and Ask answers survive.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />

        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {busy ? "Working…" : "Upload .zip"}
          </Button>
          <Button variant="danger" onClick={clearVault} disabled={busy}>
            <Trash2 className="w-4 h-4" />
            Clear vault
          </Button>
        </div>

        {msg && (
          <p className="text-[13px] text-fg-muted mt-4 flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-accent-dim" />
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/50 p-3">
      <p className="font-display text-2xl font-semibold text-fg tabular-nums">{value}</p>
      <p className="text-[11px] text-fg-subtle font-mono uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
