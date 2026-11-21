import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import type { Detail } from "../types";

const repoBase = (() => {
  const host = window.location.hostname;
  if (host.endsWith("github.io")) {
    const owner = host.split(".")[0];
    const project = window.location.pathname.split("/").filter(Boolean)[0];
    if (owner && project) return `https://github.com/${owner}/${project}`;
  }
  return "https://github.com/Teagan42/govee";
})();
const repo = `${repoBase}/blob/main/`;

function Field({ label, value, mono = false }: { label: string; value?: string | number | null; mono?: boolean }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="detail-field">
      <div className="detail-label">{label}</div>
      <div className={mono ? "detail-value mono" : "detail-value"}>{value}</div>
    </div>
  );
}

function CopyButton({ text, onCopied }: { text: string; onCopied: (t: string) => void }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="copy-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          onCopied("Copied to clipboard");
          setDone(true);
          window.setTimeout(() => setDone(false), 1200);
        } catch {
          onCopied("Clipboard unavailable");
        }
      }}
      aria-label="Copy"
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export function Drawer({
  detail,
  onClose,
  onOpenDoc,
  onCopied,
}: {
  detail: Detail | null;
  onClose: () => void;
  onOpenDoc: (split: string) => void;
  onCopied: (msg: string) => void;
}) {
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, onClose]);

  if (!detail) return null;
  const item = detail.item as Record<string, unknown>;
  const split = String(item.split ?? "");
  const title =
    detail.kind === "command"
      ? String(item.name)
      : detail.kind === "device"
        ? String(item.sku)
        : detail.kind === "effect"
          ? String(item.name)
          : detail.kind === "reading"
            ? String(item.name)
            : String(item.property);
  const subtitle =
    detail.kind === "command"
      ? `${String(item.transport)} command · ${split}`
      : detail.kind === "device"
        ? String(item.family)
        : detail.kind === "effect"
          ? `Effect · ${split}`
          : detail.kind === "reading"
            ? `Reading · ${split}`
            : `Status property · ${split}`;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="drawer-top">
          <span className={`badge badge-${detail.kind}`}>{detail.kind}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <h2>{title}</h2>
        <p className="drawer-sub">{subtitle}</p>

        {detail.kind === "command" && (
          <>
            <div className="code-panel">
              <div className="code-head">
                <span>Payload</span>
                <CopyButton text={String(item.payload ?? "")} onCopied={onCopied} />
              </div>
              <pre>{String(item.payload || "—")}</pre>
            </div>
            <Field label="Op / command" value={String(item.op ?? "")} mono />
            <Field label="Field layout" value={String(item.layout ?? "")} />
            <Field label="Response" value={String(item.response ?? "")} />
            <Field label="Families / SKUs" value={String(item.families ?? "")} />
            <Field label="Source" value={String(item.source ?? "")} mono />
            <Field label="Notes" value={String(item.notes ?? "")} />
          </>
        )}

        {detail.kind === "device" && (
          <>
            <div className="facts">
              <div><span>SKU</span><b>{String(item.sku)}</b></div>
              <div><span>Transport</span><b>{String(item.transports).replaceAll("|", " + ")}</b></div>
              <div><span>goodsType</span><b>{String(item.goods_type || "—")}</b></div>
              <div><span>pact type/code</span><b>{item.pact_type || item.pact_code ? `${item.pact_type ?? "?"}/${item.pact_code ?? "?"}` : "—"}</b></div>
            </div>
            <Field label="Family" value={String(item.family)} />
            <Field label="Notes" value={String(item.notes)} />
          </>
        )}

        {detail.kind === "effect" && (
          <>
            <div className="code-panel">
              <div className="code-head">
                <span>Payload</span>
                <CopyButton text={String(item.payload ?? "")} onCopied={onCopied} />
              </div>
              <pre>{String(item.payload || "—")}</pre>
            </div>
            <Field label="Sub-mode" value={String(item.submode ?? "")} mono />
            <Field label="Attributes" value={String(item.attributes ?? "")} />
            <Field label="Source" value={String(item.source ?? "")} mono />
          </>
        )}

        {detail.kind === "reading" && (
          <>
            <Field label="Transport" value={String(item.transport ?? "")} />
            <Field label="Op / cmd" value={String(item.op ?? "")} mono />
            <Field label="Layout / fields" value={String(item.layout ?? "")} />
            <Field label="Source" value={String(item.source ?? "")} mono />
          </>
        )}

        {detail.kind === "status" && (
          <>
            <Field label="Kind" value={String(item.kind ?? "")} />
            <Field label="Meaning" value={String(item.meaning ?? "")} />
            <Field label="Carrier" value={String(item.carrier ?? "")} />
            <Field label="Source" value={String(item.source ?? "")} mono />
          </>
        )}

        <div className="drawer-actions">
          <button className="ghost-btn" onClick={() => onOpenDoc(split)}>
            <ExternalLink size={14} /> Open split deep dive
          </button>
          <a className="ghost-btn" href={repo + "protocol/splits/" + split + ".md"} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> View source on GitHub
          </a>
        </div>
      </aside>
    </div>
  );
}
