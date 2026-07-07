"use client";

import { useState } from "react";
import {
  BookOpen,
  Flame,
  Library,
  Users,
  Package,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Link2,
  AlertTriangle,
} from "lucide-react";
import { Card, SectionHeading, Eyebrow, Skeleton, Button, Chip } from "./ui";
import type {
  BriefingPayload,
  Concept,
  TrendingItem,
  ResourceItem,
  AuthorityItem,
  ContentPackageItem,
  JobSections,
} from "@/lib/types";

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
    <div className="space-y-16">
      {data.intro && (
        <p className="text-lg sm:text-xl leading-relaxed text-fg-muted font-light max-w-3xl">
          {data.intro}
        </p>
      )}

      <ConceptBlock concept={data.concept} status={sections.concept} />
      <TrendingBlock items={data.trending} status={sections.trending} />
      <ResourcesBlock items={data.resources} status={sections.phase2} />
      <AuthoritiesBlock items={data.authorities} status={sections.authorities} date={date} />
      <ContentPackageBlock items={data.content_package} status={sections.phase2} />

      {data.vault_connections && data.vault_connections.length > 0 && (
        <VaultConnections items={data.vault_connections} />
      )}

      <QuickTakeaway text={data.quick_takeaway} status={sections.phase2} />
    </div>
  );
}

// ── §1 Concept ──────────────────────────────────────────────────────────────
function ConceptBlock({ concept, status }: { concept?: Concept; status: string }) {
  return (
    <section className="fade-up">
      <SectionHeading n="01" title="The Concept" hint="One idea, deep enough to teach" />
      {!concept ? (
        status === "error" ? (
          <ErrorNote label="concept" />
        ) : (
          <ConceptSkeleton />
        )
      ) : (
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-accent-strong" />
            <Chip active>{concept.theme}</Chip>
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mb-4 text-fg">
            {concept.title}
          </h3>
          <p className="text-fg-muted leading-relaxed mb-6">{concept.intro_problem}</p>

          <div className="grid sm:grid-cols-2 gap-6">
            <Field label="What it is" body={concept.what_it_is} />
            <Field label="Why it matters" body={concept.why_it_matters} />
          </div>

          <div className="mt-6">
            <Field label="How it works" body={concept.mechanism} />
          </div>

          <TwoColList title="Failure modes" items={concept.failure_modes} tone="danger" />
          <TwoColList title="Common misuse" items={concept.common_misuse} tone="muted" />

          <div className="mt-8">
            <Eyebrow>Case studies</Eyebrow>
            <div className="grid sm:grid-cols-3 gap-4 mt-3">
              {concept.case_studies.map((cs, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-surface-2/60 p-4"
                >
                  <p className="font-display font-semibold text-fg mb-1.5">{cs.brand}</p>
                  <p className="text-[13px] text-fg-muted leading-relaxed mb-3">{cs.story}</p>
                  <p className="text-[13px] text-accent leading-relaxed border-t border-border pt-2">
                    {cs.takeaway}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </section>
  );
}

function Field({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <p className="text-[15px] text-fg leading-relaxed mt-1.5">{body}</p>
    </div>
  );
}

function TwoColList({
  title,
  items,
  tone,
}: {
  title: string;
  items: { title: string; body: string }[];
  tone: "danger" | "muted";
}) {
  return (
    <div className="mt-6">
      <Eyebrow>{title}</Eyebrow>
      <div className="grid sm:grid-cols-3 gap-4 mt-3">
        {items.map((it, i) => (
          <div key={i} className="border-l-2 pl-3" style={{ borderColor: tone === "danger" ? "var(--color-danger)" : "var(--color-accent-dim)" }}>
            <p className="text-[13px] font-semibold text-fg mb-0.5">{it.title}</p>
            <p className="text-[13px] text-fg-muted leading-relaxed">{it.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── §2 Trending ─────────────────────────────────────────────────────────────
function TrendingBlock({ items, status }: { items?: TrendingItem[]; status: string }) {
  return (
    <section className="fade-up">
      <SectionHeading
        n="02"
        title="Reactive Moments"
        hint="Real events, with the marketing angle on top"
      />
      {!items ? (
        status === "error" ? <ErrorNote label="trending" /> : <ListSkeleton rows={3} />
      ) : (
        <div className="space-y-3">
          {items.map((t, i) => (
            <Card key={i} className="p-5 sm:p-6 hover:border-border-strong transition-colors">
              <div className="flex items-start gap-3">
                <Flame className="w-4 h-4 text-accent-strong shrink-0 mt-1" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-semibold text-fg">{t.title}</h3>
                  <p className="text-[14px] text-fg-muted leading-relaxed mt-1.5">
                    {t.what_happened}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <MiniField label="Why it's live" body={t.why_interesting} />
                    <MiniField label="The angle" body={t.what_to_do} accent />
                  </div>
                  {t.source?.url && (
                    <a
                      href={t.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[12px] text-fg-subtle hover:text-accent-strong mt-3 font-mono"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {t.source.publication}
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function MiniField({ label, body, accent }: { label: string; body: string; accent?: boolean }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <p className={`text-[13px] leading-relaxed mt-1 ${accent ? "text-accent" : "text-fg-muted"}`}>
        {body}
      </p>
    </div>
  );
}

// ── §3 Resources ────────────────────────────────────────────────────────────
function ResourcesBlock({ items, status }: { items?: ResourceItem[]; status: string }) {
  return (
    <section className="fade-up">
      <SectionHeading n="03" title="Worth Your Time" hint="High-signal reading, watching, listening" />
      {!items ? (
        status === "error" ? <ErrorNote label="resources" /> : <GridSkeleton />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((r, i) => {
            const inner = (
              <>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-accent-dim">
                    {r.format}
                  </span>
                  {r.url && <ExternalLink className="w-3.5 h-3.5 text-fg-subtle" />}
                </div>
                <p className="font-display font-semibold text-fg leading-snug">{r.title}</p>
                <p className="text-[12px] text-fg-subtle mt-0.5">{r.author}</p>
                <p className="text-[13px] text-fg-muted leading-relaxed mt-2">{r.description}</p>
              </>
            );
            return r.url ? (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-border bg-surface/60 p-4 hover:border-accent-dim hover:bg-surface-2/60 transition-colors flex items-center gap-1"
              >
                <div className="flex-1">
                  <Library className="w-4 h-4 text-accent-strong mb-2" />
                  {inner}
                </div>
              </a>
            ) : (
              <div key={i} className="rounded-xl border border-border bg-surface/60 p-4">
                <Library className="w-4 h-4 text-accent-strong mb-2" />
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
  return (
    <section className="fade-up">
      <SectionHeading n="04" title="People to Know" hint="Tied to today's topics" />
      {!items ? (
        status === "error" ? <ErrorNote label="authorities" /> : <ListSkeleton rows={2} />
      ) : (
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
      <div className="flex items-start gap-3">
        <Users className="w-4 h-4 text-accent-strong shrink-0 mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg font-semibold text-fg">{a.name}</h3>
            <Chip>{a.origin}</Chip>
          </div>
          <p className="text-[13px] text-fg-muted mt-0.5">{a.current_role}</p>

          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <MiniField label="Known for" body={a.known_for} />
            <MiniField label="Track because" body={a.what_to_track} />
          </div>
          {a.recent_piece && (
            <p className="text-[13px] text-fg-muted leading-relaxed mt-3">
              <span className="text-fg-subtle">Recent: </span>
              {a.recent_piece}
            </p>
          )}

          {/* LinkedIn draft — always a manual, human-reviewed step (§3.3) */}
          <div className="mt-4 rounded-xl border border-border bg-surface-2/60 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <Eyebrow>Connect draft — review before sending</Eyebrow>
              <span className="font-mono text-[10px] text-fg-subtle tabular-nums">
                {message.length}/280
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
                <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
                Redraft
              </Button>
              {a.where_to_follow?.[0]?.handle_or_url && (
                <span className="text-[11px] text-fg-subtle font-mono ml-auto truncate">
                  {a.where_to_follow[0].platform}: {a.where_to_follow[0].handle_or_url}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── §5 Content Package ──────────────────────────────────────────────────────
function ContentPackageBlock({ items, status }: { items?: ContentPackageItem[]; status: string }) {
  return (
    <section className="fade-up">
      <SectionHeading
        n="05"
        title="Content Package"
        hint="Raw material for your own drafts — not finished copy"
      />
      {!items ? (
        status === "error" ? <ErrorNote label="content package" /> : <GridSkeleton />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((c, i) => (
            <Card key={i} className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-accent-strong" />
                <Chip active>{c.angle_type}</Chip>
                <span className="text-[11px] text-fg-subtle font-mono ml-auto">{c.platform_fit}</span>
              </div>
              <p className="text-[15px] font-medium text-fg leading-snug">{c.core_point}</p>
              <p className="text-[13px] text-accent leading-relaxed mt-2">{c.why_postable}</p>
              {c.facts_to_preserve?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <Eyebrow>Keep these facts</Eyebrow>
                  <ul className="mt-1.5 space-y-1">
                    {c.facts_to_preserve.map((f, j) => (
                      <li key={j} className="text-[12px] text-fg-muted flex gap-2">
                        <span className="text-accent-dim">—</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
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
        <Eyebrow>From your vault</Eyebrow>
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
  if (!text) {
    return status === "error" ? null : <Skeleton className="h-24 w-full" />;
  }
  return (
    <section className="fade-up">
      <div className="rounded-[var(--radius)] border border-accent-strong/25 bg-accent-strong/[0.06] p-6 sm:p-8">
        <Eyebrow>Today, in one line</Eyebrow>
        <p className="font-display text-xl sm:text-2xl font-medium text-fg leading-snug mt-2">
          {text}
        </p>
      </div>
    </section>
  );
}

// ── skeletons + error ───────────────────────────────────────────────────────
function ConceptSkeleton() {
  return (
    <Card className="p-8 space-y-4">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="grid sm:grid-cols-2 gap-4 pt-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </Card>
  );
}
function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
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
    <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/[0.06] px-4 py-3 text-[13px] text-danger">
      <AlertTriangle className="w-4 h-4" />
      Couldn&apos;t generate {label}. Try Refresh to regenerate.
    </div>
  );
}
