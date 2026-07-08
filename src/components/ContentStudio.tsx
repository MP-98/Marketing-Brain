"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PenSquare,
  Brain,
  Wand2,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ListChecks,
} from "lucide-react";
import { Card, Button, Eyebrow, SectionHeading, Chip, Skeleton } from "./ui";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  "LinkedIn personal",
  "LinkedIn company",
  "X personal",
  "X company",
  "Instagram",
] as const;

interface Flag {
  category: string;
  excerpt: string;
  problem: string;
}
interface VoiceIssue {
  category: string;
  term: string;
  context: string;
}
interface PublishCheck {
  clean: boolean;
  counts: Record<string, number>;
  issues: VoiceIssue[];
}
interface AuditResult {
  flags: Flag[];
  rewrite: string;
  changes: string[];
  platform_note: string;
  scan: VoiceIssue[];
  verify: PublishCheck;
  original_len: number;
  rewrite_len: number;
}

const CATEGORY_COLOR: Record<string, string> = {
  "em-dash": "text-danger border-danger/40",
  "banned-word": "text-danger border-danger/40",
  "banned-phrase": "text-danger border-danger/40",
  semicolon: "text-danger border-danger/40",
  transition: "text-accent-strong border-accent-strong/40",
  "transition-opener": "text-accent-strong border-accent-strong/40",
  rhythm: "text-accent border-accent-dim/50",
  hedge: "text-accent border-accent-dim/50",
  triad: "text-accent border-accent-dim/50",
  generic: "text-fg-muted border-border-strong",
  structure: "text-fg-muted border-border-strong",
  platform: "text-accent-strong border-accent-strong/40",
};
function catColor(c: string) {
  return CATEGORY_COLOR[c] ?? "text-fg-muted border-border-strong";
}

export function ContentStudio() {
  const [draft, setDraft] = useState("");
  const [platform, setPlatform] = useState<string>(PLATFORMS[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  async function audit() {
    if (!draft.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, platform }),
      });
      const j = await res.json();
      if (j.error) setError(j.error);
      else setResult(j);
    } catch {
      setError("Something broke. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyRewrite() {
    if (!result) return;
    await navigator.clipboard.writeText(result.rewrite);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const delta = result ? result.rewrite_len - result.original_len : 0;
  const deltaPct = result && result.original_len ? Math.round((delta / result.original_len) * 100) : 0;
  const withinBudget = Math.abs(deltaPct) <= 12;

  return (
    <div className="min-h-screen pb-20">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center w-9 h-9 rounded-xl border border-accent-strong/30 bg-accent-strong/10">
              <PenSquare className="w-5 h-5 text-accent-strong" />
            </div>
            <div>
              <h1 className="font-display text-[17px] font-semibold tracking-tight leading-none text-fg">
                Content Studio
              </h1>
              <p className="text-[11px] text-fg-subtle font-mono mt-0.5">Audit · Critique · Rewrite</p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 h-9 text-[13px] text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
          >
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Marketing Brain</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
        {/* intro */}
        <div className="mb-6 max-w-2xl">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-fg">
            Paste your draft. Get it audited and rewritten.
          </h2>
          <p className="text-fg-muted mt-2 leading-relaxed">
            You write it, this fixes it against the voice guide. It flags every violation, tells you
            why, and rewrites within ~10% of length keeping every fact. It never writes from a topic.
          </p>
        </div>

        {/* input */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Eyebrow>Target</Eyebrow>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="bg-surface-2 border border-border rounded-lg text-[13px] text-fg px-2.5 h-8 outline-none focus:border-accent-dim cursor-pointer"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {platform.includes("company") && (
                <span className="text-[11px] text-fg-subtle font-mono">measured tone</span>
              )}
            </div>
            <span className="font-mono text-[11px] text-fg-subtle tabular-nums">
              {draft.trim().length} chars
            </span>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            placeholder="Paste your LinkedIn / X draft here…"
            className="w-full bg-transparent outline-none text-[15px] leading-relaxed resize-y placeholder:text-fg-subtle min-h-[180px]"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[12px] text-fg-subtle">
              A System A topic package works too — it&apos;s treated as a draft, audited, not generated from.
            </p>
            <Button variant="primary" onClick={audit} disabled={loading || !draft.trim()} className="h-10 px-5">
              <Wand2 className={cn("w-4 h-4", loading && "animate-pulse")} />
              {loading ? "Running 3 passes…" : "Audit & Rewrite"}
            </Button>
          </div>
        </Card>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/[0.06] px-4 py-3 text-[13px] text-danger">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading && <LoadingState />}

        {result && (
          <div className="mt-10 space-y-12">
            {/* Pass 3 — Rewrite */}
            <section className="fade-up">
              <SectionHeading
                n="P3"
                title="Rewrite"
                hint={`Within ~10% of length · keeps every fact`}
                right={
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-mono text-[11px] tabular-nums rounded-full border px-2.5 py-1",
                        withinBudget
                          ? "text-ok border-ok/40"
                          : "text-accent-strong border-accent-strong/40",
                      )}
                    >
                      {deltaPct >= 0 ? "+" : ""}
                      {deltaPct}% · {result.rewrite_len} chars
                    </span>
                  </div>
                }
              />

              {/* publish verdict */}
              <PublishVerdict verify={result.verify} />

              <Card className="p-5 sm:p-6 mt-3">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-fg">
                  {result.rewrite}
                </p>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                  <Button variant="primary" size="sm" onClick={copyRewrite}>
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy rewrite"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowOriginal((v) => !v)}>
                    {showOriginal ? "Hide original" : "Show original"}
                  </Button>
                </div>
                {showOriginal && (
                  <div className="mt-4 rounded-xl border border-border bg-surface-2/50 p-4">
                    <Eyebrow>Your original</Eyebrow>
                    <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-fg-muted mt-2">
                      {draft}
                    </p>
                  </div>
                )}
              </Card>

              {result.platform_note && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-accent-strong/25 bg-accent-strong/[0.06] px-4 py-3 text-[13px] text-accent">
                  <ArrowRight className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{result.platform_note}</span>
                </div>
              )}
            </section>

            {/* Pass 1+2 — Flags */}
            <section className="fade-up">
              <SectionHeading
                n="P1·2"
                title="Audit & Critique"
                hint={`${result.flags.length} flag${result.flags.length === 1 ? "" : "s"} — what's wrong and what it needs`}
              />
              {result.flags.length === 0 ? (
                <p className="text-[14px] text-fg-muted">No violations found. Clean draft.</p>
              ) : (
                <div className="space-y-2.5">
                  {result.flags.map((f, i) => (
                    <Card key={i} className="p-4">
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "font-mono text-[10px] uppercase tracking-wider rounded border px-1.5 py-0.5 shrink-0 mt-0.5",
                            catColor(f.category),
                          )}
                        >
                          {f.category}
                        </span>
                        <div className="min-w-0">
                          {f.excerpt && (
                            <p className="text-[13px] text-fg-muted italic">“{f.excerpt}”</p>
                          )}
                          <p className="text-[14px] text-fg leading-relaxed mt-1">{f.problem}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Changes made */}
            {result.changes.length > 0 && (
              <section className="fade-up">
                <SectionHeading n="Δ" title="What changed" hint="And why" />
                <ul className="space-y-2">
                  {result.changes.map((c, i) => (
                    <li key={i} className="flex gap-2.5 text-[14px] text-fg-muted leading-relaxed">
                      <ListChecks className="w-4 h-4 text-accent-dim shrink-0 mt-0.5" />
                      {c}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function PublishVerdict({ verify }: { verify: PublishCheck }) {
  if (verify.clean) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/[0.07] px-4 py-2.5 text-[13px] text-ok">
        <ShieldCheck className="w-4 h-4" />
        Publish check passed — no em dashes, banned words, semicolons, or formal transitions.
      </div>
    );
  }
  const parts = Object.entries(verify.counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}`);
  return (
    <div className="rounded-xl border border-accent-strong/30 bg-accent-strong/[0.07] px-4 py-2.5">
      <div className="flex items-center gap-2 text-[13px] text-accent-strong">
        <ShieldAlert className="w-4 h-4" />
        Rewrite still trips the scanner: {parts.join(", ")}.
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {verify.issues.slice(0, 8).map((i, k) => (
          <span key={k} className="font-mono text-[10px] text-fg-subtle bg-surface-2 rounded px-1.5 py-0.5">
            {i.category}: {i.term}
          </span>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-10 space-y-4 fade-up">
      <div className="flex items-center gap-2 text-fg-subtle text-sm font-mono">
        <Wand2 className="w-4 h-4 animate-pulse text-accent-strong" />
        Auditing, critiquing, rewriting…
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
