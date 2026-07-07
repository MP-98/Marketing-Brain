"use client";

import { useState } from "react";
import { PenLine, Check, Download } from "lucide-react";
import { Button } from "./ui";

export function CaptureBar() {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      setText("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3 flex items-center gap-2">
        <PenLine className="w-4 h-4 text-accent-dim shrink-0" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Quick capture — a thought, a line, something to keep…"
          className="flex-1 bg-transparent outline-none text-[14px] py-1.5 placeholder:text-fg-subtle"
        />
        <a
          href="/api/capture/export"
          className="text-fg-subtle hover:text-fg cursor-pointer p-2"
          title="Export captures (.md)"
        >
          <Download className="w-4 h-4" />
        </a>
        <Button variant="primary" size="sm" onClick={save} disabled={busy || !text.trim()}>
          {saved ? <Check className="w-3.5 h-3.5" /> : null}
          {saved ? "Saved" : "Save to vault"}
        </Button>
      </div>
    </div>
  );
}
