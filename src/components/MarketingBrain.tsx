"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Brain, RefreshCw, Archive, Settings, Sparkles, CalendarClock, PenSquare } from "lucide-react";
import { BriefingView } from "./BriefingView";
import { AskSection } from "./AskSection";
import { SettingsDialog } from "./SettingsDialog";
import { ArchivePopover } from "./ArchivePopover";
import { CaptureBar } from "./CaptureBar";
import { Button } from "./ui";
import { todayISO } from "@/lib/utils";
import type { BriefingPayload, JobSections } from "@/lib/types";

const EMPTY_SECTIONS: JobSections = {
  concept: "pending",
  trending: "pending",
  authorities: "pending",
  resources: "pending",
  angles: "pending",
  closing: "pending",
};
const ALL_DONE: JobSections = {
  concept: "done",
  trending: "done",
  authorities: "done",
  resources: "done",
  angles: "done",
  closing: "done",
};

type Phase = "idle" | "loading" | "generating" | "ready" | "empty";

export function MarketingBrain() {
  const today = todayISO();
  const [phase, setPhase] = useState<Phase>("loading");
  const [payload, setPayload] = useState<Partial<BriefingPayload>>({});
  const [sections, setSections] = useState<JobSections>(EMPTY_SECTIONS);
  const [viewingDate, setViewingDate] = useState(today);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recoveredRef = useRef(false);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  // ── Load today's briefing on mount ──────────────────────────────────────
  useEffect(() => {
    fetch("/api/briefing/today")
      .then((r) => r.json())
      .then((j) => {
        if (j.exists) {
          setPayload(j.payload);
          setSections(ALL_DONE);
          setPhase("ready");
        } else {
          setPhase("empty");
        }
      })
      .catch(() => setPhase("empty"));
    return stopPolling;
  }, []);

  // ── Poll a running job ──────────────────────────────────────────────────
  const poll = useCallback((jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const j = await fetch(`/api/briefing/job/${jobId}`).then((r) => r.json());
        if (j.result) setPayload(j.result);
        if (j.sections) setSections(j.sections);

        if (j.status === "done") {
          stopPolling();
          setPayload(j.result);
          setSections(ALL_DONE);
          setPhase("ready");
        } else if (j.status === "error") {
          stopPolling();
          setPhase(Object.keys(j.result ?? {}).length ? "ready" : "empty");
        } else if (j.status === "abandoned" && !recoveredRef.current) {
          // backend likely died — silently restart once
          recoveredRef.current = true;
          stopPolling();
          startGenerate(false);
        }
      } catch {
        /* transient — keep polling */
      }
    }, 2500);
  }, []);

  // ── Kick off generation ─────────────────────────────────────────────────
  const startGenerate = useCallback(
    async (force: boolean) => {
      setPhase("generating");
      setPayload({});
      setSections(EMPTY_SECTIONS);
      recoveredRef.current = false;
      try {
        const j = await fetch(`/api/briefing/generate?force=${force}`, { method: "POST" }).then(
          (r) => r.json(),
        );
        if (j.from_cache && j.job_id) {
          const job = await fetch(`/api/briefing/job/${j.job_id}`).then((r) => r.json());
          setPayload(job.result);
          setSections(ALL_DONE);
          setPhase("ready");
          return;
        }
        if (j.job_id) poll(j.job_id);
        else setPhase("empty");
      } catch {
        setPhase("empty");
      }
    },
    [poll],
  );

  // ── View a historical briefing ──────────────────────────────────────────
  async function viewDate(date: string) {
    stopPolling();
    if (date === today) return backToToday();
    const j = await fetch(`/api/briefing/by-date/${date}`).then((r) => r.json());
    if (j.exists) {
      setPayload(j.payload);
      setSections(ALL_DONE);
      setViewingDate(date);
      setPhase("ready");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function backToToday() {
    setViewingDate(today);
    fetch("/api/briefing/today")
      .then((r) => r.json())
      .then((j) => {
        if (j.exists) {
          setPayload(j.payload);
          setSections(ALL_DONE);
          setPhase("ready");
        } else setPhase("empty");
      });
  }

  const isHistorical = viewingDate !== today;
  const prettyDate = new Date(viewingDate + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen pb-24">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid place-items-center w-9 h-9 rounded-xl border border-accent-strong/30 bg-accent-strong/10 shrink-0">
              <Brain className="w-5 h-5 text-accent-strong" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-[17px] font-semibold tracking-tight leading-none text-fg">
                Marketing Brain
              </h1>
              <p className="text-[11px] text-fg-subtle font-mono mt-0.5 truncate">{prettyDate}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 relative">
            <Link
              href="/studio"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-[13px] text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors mr-1"
              title="Content Studio — audit & rewrite drafts"
            >
              <PenSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Studio</span>
            </Link>
            {phase !== "generating" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => startGenerate(true)}
                title="Regenerate today"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setArchiveOpen((v) => !v)} title="Archive">
              <Archive className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)} title="Knowledge base">
              <Settings className="w-4 h-4" />
            </Button>
            <ArchivePopover
              open={archiveOpen}
              onClose={() => setArchiveOpen(false)}
              onSelectDate={viewDate}
            />
          </div>
        </div>
      </header>

      {/* ── Historical banner ────────────────────────────────────────────── */}
      {isHistorical && phase === "ready" && (
        <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-accent-strong/25 bg-accent-strong/[0.06] px-4 py-2.5">
            <span className="inline-flex items-center gap-2 text-[13px] text-accent">
              <CalendarClock className="w-4 h-4" />
              Viewing the archive — {prettyDate}
            </span>
            <Button size="sm" variant="outline" onClick={backToToday}>
              Back to today
            </Button>
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-12">
        {phase === "loading" && <BootLoading />}

        {phase === "empty" && <EmptyState onGenerate={() => startGenerate(false)} />}

        {(phase === "generating" || phase === "ready") && (
          <>
            <BriefingView data={payload} sections={sections} date={viewingDate} />
            {phase === "ready" && !isHistorical && (
              <div className="mt-16">
                <AskSection briefingDate={viewingDate} />
              </div>
            )}
          </>
        )}
      </main>

      {!isHistorical && <CaptureBar />}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

// ── states ────────────────────────────────────────────────────────────────
function BootLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-10 h-10 rounded-full border-2 border-border border-t-accent-strong animate-spin" />
      <p className="text-fg-subtle text-sm mt-4 font-mono">Loading today&apos;s brief…</p>
    </div>
  );
}

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-center fade-up">
      <div className="grid place-items-center w-16 h-16 rounded-2xl border border-accent-strong/25 bg-accent-strong/10 mb-6">
        <Sparkles className="w-7 h-7 text-accent-strong" />
      </div>
      <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-fg">
        No brief for today yet
      </h2>
      <p className="text-fg-muted max-w-md mt-3 leading-relaxed">
        Generate today&apos;s intelligence: one concept worth learning, the reactive moments worth
        knowing, the people worth meeting, and raw material for your own posts.
      </p>
      <Button variant="primary" className="mt-7 h-11 px-6" onClick={onGenerate}>
        <Sparkles className="w-4 h-4" />
        Generate today&apos;s brief
      </Button>
      <p className="text-[12px] text-fg-subtle font-mono mt-4">≈ 30–60s · streams in as it&apos;s ready</p>
    </div>
  );
}
