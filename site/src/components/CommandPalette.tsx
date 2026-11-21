import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Boxes,
  Cpu,
  Hash,
  Search,
  Sparkles,
  Terminal,
  Waves,
} from "lucide-react";
import type { Detail, SiteData } from "../types";

type Result =
  | { kind: "device"; label: string; sub: string; detail: Detail }
  | { kind: "command"; label: string; sub: string; detail: Detail }
  | { kind: "effect"; label: string; sub: string; detail: Detail }
  | { kind: "reading"; label: string; sub: string; detail: Detail }
  | { kind: "status"; label: string; sub: string; detail: Detail }
  | { kind: "doc"; label: string; sub: string; docId: string };

const iconFor = (kind: Result["kind"]) => {
  if (kind === "device") return Boxes;
  if (kind === "command") return Terminal;
  if (kind === "effect") return Sparkles;
  if (kind === "reading") return Waves;
  if (kind === "status") return Cpu;
  return BookOpen;
};

export function CommandPalette({
  data,
  open,
  onClose,
  onSelect,
  onOpenDoc,
}: {
  data: SiteData | null;
  open: boolean;
  onClose: () => void;
  onSelect: (d: Detail) => void;
  onOpenDoc: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const index = useMemo<Result[]>(() => {
    if (!data) return [];
    const out: Result[] = [];
    for (const d of data.devices) {
      out.push({
        kind: "device",
        label: d.sku,
        sub: `${d.family} · ${d.transports.replaceAll("|", " + ")}`,
        detail: { kind: "device", item: d },
      });
    }
    for (const c of data.commands) {
      out.push({
        kind: "command",
        label: `${c.name} — ${c.op}`,
        sub: `${c.split} · ${c.transport}`,
        detail: { kind: "command", item: c },
      });
    }
    for (const e of data.effects) {
      out.push({
        kind: "effect",
        label: e.name,
        sub: `${e.split} · sub-mode ${e.submode}`,
        detail: { kind: "effect", item: e },
      });
    }
    for (const r of data.readings) {
      out.push({
        kind: "reading",
        label: r.name,
        sub: `${r.split} · ${r.transport}`,
        detail: { kind: "reading", item: r },
      });
    }
    for (const s of data.status_properties) {
      out.push({
        kind: "status",
        label: s.property,
        sub: `${s.kind} · ${s.split}`,
        detail: { kind: "status", item: s },
      });
    }
    for (const d of data.docs) {
      out.push({ kind: "doc", label: d.title, sub: d.group, docId: d.id });
    }
    return out;
  }, [data]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) {
      return index.filter((r) => ["doc", "device"].includes(r.kind)).slice(0, 14);
    }
    const terms = needle.split(/\s+/);
    return index
      .map((r) => {
        const hay = `${r.label} ${r.sub}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return null;
        let score = 0;
        if (r.label.toLowerCase().startsWith(needle)) score += 6;
        if (r.label.toLowerCase().includes(needle)) score += 3;
        if (r.sub.toLowerCase().includes(needle)) score += 1;
        return { r, score };
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 30)
      .map((x) => x!.r);
  }, [index, q]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        const r = results[active];
        if (!r) return;
        e.preventDefault();
        if (r.kind === "doc") onOpenDoc(r.docId);
        else onSelect(r.detail);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, active, onClose, onSelect, onOpenDoc]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="palette-search">
          <Search size={20} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search devices, commands, effects, docs…"
            aria-label="Search"
          />
          <kbd>esc</kbd>
        </div>
        <div className="palette-results" ref={listRef}>
          {results.length === 0 && <div className="palette-empty">No matches. Try a SKU, opcode, effect name or split.</div>}
          {results.map((r, i) => {
            const Icon = iconFor(r.kind);
            return (
              <button
                key={`${r.kind}-${r.label}-${i}`}
                data-idx={i}
                className={`palette-row ${i === active ? "is-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  if (r.kind === "doc") onOpenDoc(r.docId);
                  else onSelect(r.detail);
                }}
              >
                <span className={`palette-icon kind-${r.kind}`}>
                  <Icon size={16} />
                </span>
                <span className="palette-text">
                  <span className="palette-label">{r.label}</span>
                  <span className="palette-sub">{r.sub}</span>
                </span>
                <span className="palette-kind">{r.kind}</span>
              </button>
            );
          })}
        </div>
        <div className="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>↵</kbd> open</span>
          <span><Hash size={12} /> {index.length} indexed</span>
        </div>
      </div>
    </div>
  );
}
