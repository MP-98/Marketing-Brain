"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, List, CalendarDays } from "lucide-react";
import { Chip, Eyebrow } from "./ui";

interface Entry {
  date: string;
  created_at: string;
  tags: string[];
  title: string;
  theme: string;
  quick_takeaway: string;
}

export function ArchivePopover({
  open,
  onClose,
  onSelectDate,
}: {
  open: boolean;
  onClose: () => void;
  onSelectDate: (date: string) => void;
}) {
  const [tab, setTab] = useState<"list" | "calendar">("list");
  const [q, setQ] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [topTags, setTopTags] = useState<{ tag: string; count: number }[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/briefing/tags")
      .then((r) => r.json())
      .then((j) => setTopTags(j.tags ?? []))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const url = q ? `/api/briefing/archive?q=${encodeURIComponent(q)}` : "/api/briefing/archive";
    const t = setTimeout(() => {
      fetch(url)
        .then((r) => r.json())
        .then((j) => setEntries(j.entries ?? []))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-12 z-40 w-[min(92vw,30rem)] rounded-[var(--radius)] border border-border-strong bg-surface shadow-2xl shadow-black/50 fade-up"
    >
      {/* tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-border">
        <TabBtn active={tab === "list"} onClick={() => setTab("list")}>
          <List className="w-3.5 h-3.5" /> List
        </TabBtn>
        <TabBtn active={tab === "calendar"} onClick={() => setTab("calendar")}>
          <CalendarDays className="w-3.5 h-3.5" /> Calendar
        </TabBtn>
      </div>

      {/* search */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-2.5 h-9">
          <Search className="w-4 h-4 text-fg-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search or tag:d2c"
            className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-fg-subtle"
          />
        </div>
        {topTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {topTags.slice(0, 10).map((t) => (
              <Chip
                key={t.tag}
                active={q === `tag:${t.tag}`}
                onClick={() => setQ(q === `tag:${t.tag}` ? "" : `tag:${t.tag}`)}
              >
                {t.tag} <span className="text-fg-subtle">{t.count}</span>
              </Chip>
            ))}
          </div>
        )}
      </div>

      {tab === "list" ? (
        <ListView entries={entries} onSelect={(d) => { onSelectDate(d); onClose(); }} />
      ) : (
        <CalendarView entries={entries} onSelect={(d) => { onSelectDate(d); onClose(); }} />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-[13px] font-medium cursor-pointer transition-colors ${
        active ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function ListView({ entries, onSelect }: { entries: Entry[]; onSelect: (d: string) => void }) {
  return (
    <div className="max-h-[60vh] overflow-y-auto p-2">
      {entries.length === 0 && (
        <p className="text-[13px] text-fg-subtle text-center py-8">No briefings yet.</p>
      )}
      {entries.map((e) => (
        <button
          key={e.date}
          onClick={() => onSelect(e.date)}
          className="w-full text-left rounded-lg p-3 hover:bg-surface-2 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-accent-strong/80 tabular-nums">{e.date}</span>
            {e.theme && <span className="text-[10px] text-fg-subtle font-mono">{e.theme}</span>}
          </div>
          <p className="font-display font-semibold text-fg text-sm mt-1 leading-snug">{e.title}</p>
          {e.quick_takeaway && (
            <p className="text-[12px] text-fg-muted line-clamp-2 mt-0.5">{e.quick_takeaway}</p>
          )}
          {e.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {e.tags.slice(0, 6).map((t) => (
                <span key={t} className="font-mono text-[10px] text-fg-subtle bg-surface-2 rounded px-1.5 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function CalendarView({ entries, onSelect }: { entries: Entry[]; onSelect: (d: string) => void }) {
  const set = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);
  const byDate = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);

  // last 16 weeks (112 days), oldest → newest, week columns
  const days = useMemo(() => {
    const out: string[] = [];
    const today = new Date();
    for (let i = 111; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, []);

  return (
    <div className="p-4 max-h-[60vh] overflow-y-auto">
      <Eyebrow>Last 16 weeks</Eyebrow>
      <div className="grid grid-flow-col grid-rows-7 gap-1 mt-3">
        {days.map((d) => {
          const has = set.has(d);
          const e = byDate.get(d);
          return (
            <button
              key={d}
              disabled={!has}
              onClick={() => has && onSelect(d)}
              title={has && e ? `${d} — ${e.title}` : d}
              className={`h-4 w-4 rounded-[3px] transition-colors ${
                has
                  ? "bg-accent-strong/80 hover:bg-accent-strong cursor-pointer"
                  : "bg-surface-2 cursor-default"
              }`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-4 text-[11px] text-fg-subtle font-mono">
        <span className="h-3 w-3 rounded-[3px] bg-surface-2 inline-block" /> none
        <span className="h-3 w-3 rounded-[3px] bg-accent-strong/80 inline-block ml-2" /> briefing
      </div>
    </div>
  );
}
