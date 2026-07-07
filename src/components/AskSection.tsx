"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Send, Bookmark, BookmarkCheck, Trash2, FileText } from "lucide-react";
import { Card, SectionHeading, Button, Eyebrow } from "./ui";

interface QaSource {
  filename: string;
  chunk_index: number;
  text: string;
  score: number;
}
interface QaItem {
  id: string;
  question: string;
  answer: string;
  sources: QaSource[];
  saved_to_vault: boolean;
  note_filename?: string | null;
  created_at?: string;
}

export function AskSection({ briefingDate }: { briefingDate: string }) {
  const [question, setQuestion] = useState("");
  const [items, setItems] = useState<QaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/qa/list")
      .then((r) => r.json())
      .then((j) => setItems(j.items ?? []))
      .catch(() => {});
  }, []);

  async function ask() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setQuestion("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, briefing_date: briefingDate, use_vault: true }),
      });
      const j = await res.json();
      if (j.id) setItems((prev) => [{ ...j, saved_to_vault: false }, ...prev]);
    } finally {
      setLoading(false);
    }
  }

  async function save(id: string) {
    const res = await fetch(`/api/qa/${id}/save-to-vault`, { method: "POST" });
    const j = await res.json();
    if (j.ok) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, saved_to_vault: true, note_filename: j.note_filename } : it,
        ),
      );
    }
  }

  async function remove(id: string) {
    await fetch(`/api/qa/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  return (
    <section className="fade-up">
      <SectionHeading n="06" title="Ask" hint="Grounded in today's brief and your vault" />

      <Card className="p-2 flex items-center gap-2 focus-within:border-accent-dim transition-colors">
        <Sparkles className="w-4 h-4 text-accent-strong ml-2 shrink-0" />
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Ask anything — building on today's concept…"
          className="flex-1 bg-transparent outline-none text-[15px] py-2 placeholder:text-fg-subtle"
        />
        <Button variant="primary" onClick={ask} disabled={loading || !question.trim()}>
          <Send className="w-4 h-4" />
          {loading ? "Thinking…" : "Ask"}
        </Button>
      </Card>

      <div className="space-y-4 mt-5">
        {items.map((it) => (
          <Card key={it.id} className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-lg font-semibold text-fg leading-snug">
                {it.question}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => save(it.id)}
                  disabled={it.saved_to_vault}
                  title="Save to vault"
                >
                  {it.saved_to_vault ? (
                    <BookmarkCheck className="w-4 h-4 text-ok" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(it.id)} title="Delete">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="prose-mb mt-3">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{it.answer}</ReactMarkdown>
            </div>

            {it.sources?.length > 0 && (
              <details className="mt-4 group">
                <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-[12px] text-fg-subtle hover:text-fg-muted font-mono">
                  <FileText className="w-3.5 h-3.5" />
                  {it.sources.length} vault source{it.sources.length > 1 ? "s" : ""}
                </summary>
                <div className="mt-2 space-y-2">
                  {it.sources.map((s, i) => (
                    <div key={i} className="rounded-lg border border-border bg-surface-2/50 p-3">
                      <div className="flex items-center justify-between">
                        <Eyebrow>{s.filename}</Eyebrow>
                        <span className="font-mono text-[10px] text-fg-subtle tabular-nums">
                          {(s.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[12px] text-fg-muted leading-relaxed mt-1.5 line-clamp-3">
                        {s.text}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {it.saved_to_vault && it.note_filename && (
              <p className="text-[11px] text-ok/80 font-mono mt-3">saved → {it.note_filename}</p>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}
