"use client";

import { useState } from "react";
import {
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Link2,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { Card, Button } from "./ui";
import { cn } from "@/lib/utils";
import type {
  BriefingPayload,
  Concept,
  ConceptCaseStudy,
  TrendingItem,
  ResourceItem,
  AuthorityItem,
  ContentAngleItem,
  JobSections,
} from "@/lib/types";

// ── shared briefing primitives ──────────────────────────────────────────────
function SectionEyebrow({ n, label, theme }: { n: string; label: string; theme?: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent/85">
      §{n} · {label}
      {theme ? ` · ${theme.toUpperCase()}` : ""}
    </p>
  );
}
function SectionH1({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl sm:text-3xl font-light tracking-tight text-fg-muted mt-1.5 mb-6">
      {children}
    </h2>
  );
}
function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent/75">
      {children}
    </span>
  );
}
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <MicroLabel>{label}</MicroLabel>
      <div className="mt-1.5 text-[15px] text-fg leading-[1.72]">{children}</div>
    </div>
  );
}

// State machine so old/archived rows (missing a section) don't spin forever.
type Present = "ready" | "loading" | "error" | "empty";
function present<T>(items: T | undefined | null, status: string): Present {
  if (items && (!Array.isArray(items) || items.length > 0)) return "ready";
  if (status === "error") return "error";
  if (status === "done") return "empty";
  return "loading";
}

export function BriefingView({
  data,
  sections,
  date,
}: {
  data: Partial<BriefingPayload>;
  sections: JobSections;
  date: string;
}) {
  return (
    <div className="space-y-20">
      {data.intro && <PullQuote>{data.intro}</PullQuote>}

      <ConceptBlock concept={data.concept} status={sections.concept} />
      <TrendingBlock items={data.trending} status={sections.trending} />
      <ResourcesBlock items={data.resources} status={sections.resources} />
      <AuthoritiesBlock items={data.authorities} status={sections.authorities} date={date} />
      <ContentAnglesBlock items={data.content_angles} status={sections.angles} />

      {data.vault_connections && data.vault_connections.length > 0 && (
        <VaultConnections items={data.vault_connections} />
      )}

      <QuickTakeaway text={data.quick_takeaway} status={sections.closing} />
    </div>
  );
}

// ── intro / takeaway pull-quotes ────────────────────────────────────────────
function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <div className="fade-up border-l-2 border-accent/50 pl-5 sm:pl-6">
      <p className="text-lg sm:text-xl leading-relaxed text-fg-muted font-light">{children}</p>
    </div>
  );
}

// ── §1 Concept ──────────────────────────────────────────────────────────────
function ConceptBlock({ concept, status }: { concept?: Concept; status: string }) {
  const p = present(concept, status);
  return (
    <section className="fade-up">
      <SectionEyebrow n="1" label="Concept of the Day" theme={concept?.theme} />
      {p === "loading" && <ConceptSkeleton />}
      {p === "error" && <ErrorNote label="concept" />}
      {p === "ready" && concept && (
        <>
          <h1 className="font-display text-3xl sm:text-[2.5rem] font-semibold tracking-tight text-fg leading-[1.1] mt-2 mb-7">
            {concept.title}
          </h1>

          <div className="space-y-6">
            <p className="text-[15px] text-fg leading-[1.72]">{concept.intro_problem}</p>
            <Block label="What it is">{concept.what_it_is}</Block>
            <Block label="Why it matters">{concept.why_it_matters}</Block>

            <div>
              <MicroLabel>Failure modes</MicroLabel>
              <div className="grid sm:grid-cols-3 gap-4 mt-3">
                {concept.failure_modes.map((f, i) => (
                  <div key={i} className="border-l-2 border-danger/50 pl-3">
                    <p className="text-[13px] font-semibold text-fg mb-1">{f.title}</p>
                    <p className="text-[13px] text-fg-muted leading-relaxed">{f.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <Block label="Mechanism — how to apply">{concept.mechanism}</Block>

            <div>
              <MicroLabel>Common misuse</MicroLabel>
              <div className="grid sm:grid-cols-3 gap-4 mt-3">
                {concept.common_misuse.map((f, i) => (
                  <div key={i} className="border-l-2 border-accent-dim/60 pl-3">
                    <p className="text-[13px] font-semibold text-fg mb-1">{f.title}</p>
                    <p className="text-[13px] text-fg-muted leading-relaxed">{f.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <MicroLabel>Case studies</MicroLabel>
              <div className="grid gap-3 mt-3">
                {concept.case_studies.map((cs, i) => (
                  <CaseStudyCard key={i} cs={cs} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function CaseStudyCard({ cs }: { cs: ConceptCaseStudy }) {
  // backward-compat: older rows carry `takeaway` instead of `steal_this`
  const steal = cs.steal_this ?? (cs as unknown as { takeaway?: string }).takeaway ?? "";
  return (
    <div className="rounded-xl border border-border bg-surface/50 p-4 sm:p-5">
      <p className="font-display font-semibold text-fg mb-1.5">{cs.brand}</p>
      <p className="text-[14px] text-fg-muted leading-relaxed">{cs.story}</p>
      {steal && (
        <div className="mt-3 pt-3 border-t border-border">
          <MicroLabel>Steal this</MicroLabel>
          <p className="text-[13px] text-accent leading-relaxed mt-1">{steal}</p>
        </div>
      )}
    </div>
  );
}

// ── §2 Trending (accordion) ─────────────────────────────────────────────────
function TrendingBlock({ items, status }: { items?: TrendingItem[]; status: string }) {
  const p = present(items, status);
  return (
    <section className="fade-up">
      <SectionEyebrow n="2" label="What's Trending · Pop Culture × Marketing" />
      <SectionH1>This week&apos;s signal</SectionH1>
      {p === "loading" && <ListSkeleton rows={3} />}
      {p === "error" && <ErrorNote label="trending" />}
      {p === "empty" && <EmptyNote />}
      {p === "ready" && items && (
        <div className="space-y-2.5">
          {items.map((t, i) => (
            <Accordion key={i} defaultOpen={i === 0} title={t.title}>
              <div className="space-y-4 pt-1">
                <Block label="What happened">{t.what_happened}</Block>
                <Block label="Why it's interesting">{t.why_interesting}</Block>
                <Block label="What to do with it">
                  <span className="whitespace-pre-line">{t.what_to_do}</span>
                </Block>
                <div className="flex items-center justify-between">
                  {t.event_date ? (
                    <span className="font-mono text-[11px] text-fg-subtle tabular-nums">
                      {t.event_date}
                    </span>
                  ) : (
                    <span />
                  )}
                  {t.source?.url && (
                    <a
                      href={t.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-fg-subtle hover:text-accent-strong font-mono"
                    >
                      {t.source.publication} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </Accordion>
          ))}
        </div>
      )}
    </section>
  );
}

// ── §3 Resources ────────────────────────────────────────────────────────────
function ResourcesBlock({ items, status }: { items?: ResourceItem[]; status: string }) {
  const p = present(items, status);
  return (
    <section className="fade-up">
      <SectionEyebrow n="3" label="Underrated Resources" />
      <SectionH1>Worth your time today</SectionH1>
      {p === "loading" && <GridSkeleton />}
      {p === "error" && <ErrorNote label="resources" />}
      {p === "empty" && <EmptyNote />}
      {p === "ready" && items && (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((r, i) => {
            const inner = (
              <>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <MicroLabel>{r.format}</MicroLabel>
                  <span className="font-mono text-[10px] text-fg-subtle truncate max-w-[45%]">
                    {r.author}
                  </span>
                </div>
                <p className="font-display font-semibold text-fg leading-snug">{r.title}</p>
                <p className="text-[13px] text-fg-muted leading-relaxed mt-2">{r.description}</p>
                {r.url && (
                  <span className="inline-flex items-center gap-1 text-[12px] text-accent-strong font-mono mt-3">
                    open <ExternalLink className="w-3 h-3" />
                  </span>
                )}
              </>
            );
            return r.url ? (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-border bg-surface/50 p-4 hover:border-accent-dim transition-colors"
              >
                {inner}
              </a>
            ) : (
              <div key={i} className="rounded-xl border border-border bg-surface/50 p-4">
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── §4 Authorities ──────────────────────────────────────────────────────────
function AuthoritiesBlock({
  items,
  status,
  date,
}: {
  items?: AuthorityItem[];
  status: string;
  date: string;
}) {
  const p = present(items, status);
  return (
    <section className="fade-up">
      <SectionEyebrow n="4" label={`Authorities to Know · ${items?.length ?? 3} Fresh Voices`} />
      <SectionH1>Worth tracking</SectionH1>
      {p === "loading" && <ListSkeleton rows={2} />}
      {p === "error" && <ErrorNote label="authorities" />}
      {p === "empty" && <EmptyNote />}
      {p === "ready" && items && (
        <div className="space-y-3">
          {items.map((a, i) => (
            <AuthorityCard key={i} a={a} index={i} date={date} />
          ))}
        </div>
      )}
    </section>
  );
}

function AuthorityCard({ a, index, date }: { a: AuthorityItem; index: number; date: string }) {
  const [message, setMessage] = useState(a.linkedin_message);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  async function regen() {
    setBusy(true);
    try {
      const res = await fetch("/api/authority/connect-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: a.name,
          current_role: a.current_role,
          known_for: a.known_for,
          recent_piece: a.recent_piece,
          briefing_date: date,
          authority_index: index,
        }),
      });
      const j = await res.json();
      if (j.message) setMessage(j.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-semibold text-fg leading-tight">{a.name}</h3>
        <span className="font-mono text-[11px] text-accent/80 shrink-0 mt-1">{a.origin}</span>
      </div>
      <p className="font-mono text-[12px] text-fg-subtle mt-1">{a.current_role}</p>

      <div className="mt-4 space-y-3.5">
        <Block label="Career">{a.career}</Block>
        <Block label="Known for">{a.known_for}</Block>
        <Block label="A specific recent piece">{a.recent_piece}</Block>
        <Block label="What to track">{a.what_to_track}</Block>
        {a.why_reachable && <Block label="Why reachable">{a.why_reachable}</Block>}
      </div>

      {/* connect draft — manual, human-reviewed step (§3.3) */}
      <div className="mt-4 rounded-xl border border-border bg-surface-2/60 p-3.5">
        <div className="flex items-center justify-between mb-2">
          <MicroLabel>LinkedIn connect message — review before sending</MicroLabel>
          <span className="font-mono text-[10px] text-fg-subtle tabular-nums">
            {message.length} chars
          </span>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full bg-transparent text-[13px] text-fg leading-relaxed resize-none outline-none"
        />
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button size="sm" variant="ghost" onClick={regen} disabled={busy}>
            <RefreshCw className={cn("w-3.5 h-3.5", busy && "animate-spin")} />
            Redraft
          </Button>
        </div>
      </div>

      {a.where_to_follow?.length > 0 && (
        <div className="mt-3">
          <MicroLabel>Where to follow</MicroLabel>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
            {a.where_to_follow.map((w, i) => (
              <span key={i} className="text-[12px] text-fg-muted font-mono">
                {w.platform}: {w.handle_or_url}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── §5 Content Angles (accordion) ───────────────────────────────────────────
function ContentAnglesBlock({ items, status }: { items?: ContentAngleItem[]; status: string }) {
  const p = present(items, status);
  return (
    <section className="fade-up">
      <SectionEyebrow n="5" label="Content Angles" />
      <SectionH1>Ship today on your feed</SectionH1>
      {p === "loading" && <ListSkeleton rows={2} />}
      {p === "error" && <ErrorNote label="content angles" />}
      {p === "empty" && <EmptyNote />}
      {p === "ready" && items && (
        <div className="space-y-2.5">
          {items.map((c, i) => (
            <Accordion
              key={i}
              defaultOpen={i === 0}
              title={c.title}
              badge={c.platform}
            >
              <div className="space-y-4 pt-1">
                {c.topic_source && (
                  <p className="font-mono text-[11px] text-fg-subtle">↳ {c.topic_source}</p>
                )}
                <Block label="Hook">
                  <span className="italic text-accent">{c.hook}</span>
                </Block>
                <Block label="Angle">
                  <span className="whitespace-pre-line">{c.angle}</span>
                </Block>
                <Block label="Payoff">{c.payoff}</Block>
                <Block label="Why now">{c.why_now}</Block>
              </div>
            </Accordion>
          ))}
        </div>
      )}
    </section>
  );
}

function VaultConnections({ items }: { items: string[] }) {
  return (
    <section className="fade-up">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-accent-dim" />
        <MicroLabel>From your vault</MicroLabel>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((v, i) => (
          <span
            key={i}
            className="rounded-lg border border-border bg-surface-2/50 px-3 py-1.5 text-[13px] text-fg-muted"
          >
            {v}
          </span>
        ))}
      </div>
    </section>
  );
}

// ── Quick takeaway ──────────────────────────────────────────────────────────
function QuickTakeaway({ text, status }: { text?: string; status: string }) {
  const p = present(text, status);
  if (p === "loading") return <Skeleton className="h-28 w-full" />;
  if (p !== "ready" || !text) return null;
  return (
    <section className="fade-up border-l-2 border-accent-strong/50 pl-5 sm:pl-6">
      <MicroLabel>Quick takeaway</MicroLabel>
      <p className="font-display text-xl sm:text-2xl font-light text-fg leading-snug mt-2">{text}</p>
    </section>
  );
}

// ── Accordion ────────────────────────────────────────────────────────────────
function Accordion({
  title,
  badge,
  defaultOpen,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left cursor-pointer hover:bg-surface-2/40 transition-colors"
      >
        {badge && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-accent-strong border border-accent-strong/40 rounded px-1.5 py-0.5 shrink-0">
            {badge}
          </span>
        )}
        <span className="font-display text-lg font-semibold text-fg leading-snug flex-1 min-w-0">
          {title}
        </span>
        <ChevronDown
          className={cn("w-4 h-4 text-fg-subtle shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="px-4 sm:px-5 pb-5">{children}</div>}
    </Card>
  );
}

// ── skeletons + notes ───────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg", className)} />;
}
function ConceptSkeleton() {
  return (
    <div className="space-y-4 mt-4">
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="grid sm:grid-cols-3 gap-4 pt-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}
function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}
function GridSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>
  );
}
function ErrorNote({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/[0.06] px-4 py-3 text-[13px] text-danger mt-2">
      <AlertTriangle className="w-4 h-4" />
      Couldn&apos;t generate {label}. Try Refresh to regenerate.
    </div>
  );
}
function EmptyNote() {
  return <p className="text-[13px] text-fg-subtle mt-2">Not available for this briefing.</p>;
}
