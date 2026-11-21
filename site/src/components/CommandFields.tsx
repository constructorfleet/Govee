import { useMemo } from "react";
import type { Command } from "../types";

type Row = { offset: string; bytes: string; field: string; meaning: string };

const TOKENS: Record<string, { bytes: number; field: string; meaning: string }> = {
  group: { bytes: 1, field: "Group", meaning: "Timer/group index" },
  enableSwitch: { bytes: 1, field: "Enable", meaning: "0/1 switch" },
  enable: { bytes: 1, field: "Enable", meaning: "0/1 switch" },
  on: { bytes: 1, field: "On/off", meaning: "0/1 state" },
  hour: { bytes: 1, field: "Hour", meaning: "0–23" },
  min: { bytes: 1, field: "Minute", meaning: "0–59" },
  minute: { bytes: 1, field: "Minute", meaning: "0–59" },
  repeat: { bytes: 1, field: "Repeat", meaning: "Day bitmask" },
  mode: { bytes: 1, field: "Mode", meaning: "Family-specific mode id" },
  iceSize: { bytes: 1, field: "Ice size", meaning: "Small / medium / large" },
  lightSwitch: { bytes: 1, field: "Light switch", meaning: "0/1" },
  preCoolSwitch: { bytes: 1, field: "Pre-cool", meaning: "0/1" },
  sceneLE16: { bytes: 2, field: "Scene", meaning: "Scene code, little-endian" },
  sensitivity: { bytes: 1, field: "Sensitivity", meaning: "0–99" },
  sens: { bytes: 1, field: "Sensitivity", meaning: "0–99" },
  speed: { bytes: 1, field: "Speed", meaning: "0–100" },
  direction: { bytes: 1, field: "Direction", meaning: "Family-specific" },
  brightness: { bytes: 1, field: "Brightness", meaning: "0–100 / raw range" },
  bri: { bytes: 1, field: "Brightness", meaning: "Brightness level" },
  level: { bytes: 1, field: "Level", meaning: "Brightness level" },
  val: { bytes: 1, field: "Value", meaning: "Command value" },
  effect: { bytes: 2, field: "Effect / scene", meaning: "Effect code, LE16" },
  diyCode: { bytes: 2, field: "DIY code", meaning: "DIY code, LE16" },
  slot: { bytes: 2, field: "Slot", meaning: "Slot/index, LE16" },
  subMode: { bytes: 1, field: "Sub-mode", meaning: "Mode subtype" },
  flag: { bytes: 1, field: "Flag", meaning: "0/1" },
};

const isHex = (t: string) => /^[0-9A-Fa-f]{2}$/.test(t);
const isMask = (t: string) => /^m\d+$/i.test(t) || /^mask/i.test(t);

function payloadRows(payload: string): Row[] {
  const branch = payload.split("|")[0].trim();
  if (!branch || branch.length > 180) return [];
  let toks = branch.split(/[\s,]+/).filter(Boolean);
  if (toks.length < 2) return [];
  const rows: Row[] = [];
  let offset = 0;
  const push = (bytes: number, field: string, meaning: string) => {
    rows.push({
      offset: bytes > 1 ? `${offset}–${offset + bytes - 1}` : String(offset),
      bytes: String(bytes),
      field,
      meaning,
    });
    offset += bytes;
  };

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const upper = t.toUpperCase();
    const lower = t.toLowerCase();

    // R G B and R2 G2 B2 colour triples
    if (upper === "R" && toks[i + 1]?.toUpperCase() === "G" && toks[i + 2]?.toUpperCase() === "B") {
      push(3, "Colour", "R, G, B (0–255)");
      i += 2;
      continue;
    }
    if (upper === "R2" && toks[i + 1]?.toUpperCase() === "G2" && toks[i + 2]?.toUpperCase() === "B2") {
      push(3, "Colour-temperature RGB", "R2, G2, B2 (0–255)");
      i += 2;
      continue;
    }
    // Kelvin pair
    if (["KHI", "KLO", "KELLO", "KELHI", "KELVINLO", "KELVINHI"].includes(upper)) {
      if (["KLO", "KELHI", "KELVINHI"].includes(upper) && i > 0) {
        const prev = toks[i - 1].toUpperCase();
        if (["KHI", "KELO", "KELLO", "KELVINLO"].includes(prev)) continue;
      }
      const next = toks[i + 1]?.toUpperCase() ?? "";
      const pair = ["KHI", "KLO"].includes(upper) || ["KLO", "KHI"].includes(next);
      push(2, "Colour temperature", "Kelvin, 16-bit (byte order is family-specific)");
      if (pair) i += 1;
      continue;
    }
    // Segment mask run
    if (isMask(t)) {
      let n = 0;
      let j = i;
      while (j < toks.length && isMask(toks[j])) {
        n++;
        j++;
      }
      if (/^mask/i.test(t) && n === 1) n = 2;
      push(Math.max(1, n), "Segment mask", "Bit 0 = first segment; LSB-first");
      i = j - 1;
      continue;
    }
    // Fixed hex run
    if (isHex(t)) {
      let j = i;
      let bytes = 0;
      while (j < toks.length && isHex(toks[j])) {
        bytes++;
        j++;
      }
      const hex = toks.slice(i, j).join(" ");
      push(bytes, "Fixed / header", hex);
      i = j - 1;
      continue;
    }
    // Known semantic token
    if (TOKENS[t] || TOKENS[lower]) {
      const meta = TOKENS[t] || TOKENS[lower];
      push(meta.bytes, meta.field, meta.meaning);
      continue;
    }
    // Placeholder-like tokens
    if (/^[A-Za-z][A-Za-z0-9_]{1,20}$/.test(t)) {
      push(1, t, "Family-specific field");
      continue;
    }
    // Ignore punctuation / prose fragments after a sensible start
    if (rows.length > 0) break;
  }
  return rows.length >= 2 ? rows : [];
}

function iotRows(c: Command): Row[] {
  let obj: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(c.payload);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) obj = parsed as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  if (!obj) return [];
  const rows: Row[] = [];
  const walk = (prefix: string, val: unknown) => {
    if (val && typeof val === "object" && !Array.isArray(val) && !("red" in (val as object))) {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) walk(prefix ? `${prefix}.${k}` : k, v);
      return;
    }
    let type: string = typeof val;
    let example = JSON.stringify(val);
    if (typeof val === "string") {
      if (/^\d+\s*[-.~]\s*\d+$/.test(val)) type = "range";
      else if (val === "0|1") type = "boolean";
      example = val;
    }
    if (val && typeof val === "object") {
      type = "object";
      example = "{red, green, blue}";
    }
    rows.push({ offset: "—", bytes: "—", field: prefix, meaning: `${type}${example ? ` · ${example}` : ""}` });
  };
  for (const [k, v] of Object.entries(obj)) walk(k, v);
  return rows;
}

function Notes({ text }: { text: string }) {
  const parts = text
    .split(/;\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <div className="layout-notes">
      <div className="fields-title">Layout notes</div>
      <ul>
        {parts.slice(0, 12).map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

export function CommandFields({ command }: { command: Command }) {
  const rows = useMemo(
    () => (command.transport === "iot" ? iotRows(command) : payloadRows(command.payload)),
    [command],
  );
  const raw = command.layout || command.payload;

  if (rows.length === 0) {
    return (
      <div className="fields-block">
        <div className="fields-title">Field layout</div>
        <pre className="layout-pre">{raw || "No documented layout."}</pre>
      </div>
    );
  }

  return (
    <div className="fields-block">
      <div className="fields-title">{command.transport === "iot" ? "JSON data fields" : "Payload fields"}</div>
      <div className="field-table-wrap">
        <table className="field-table">
          <thead>
            <tr>
              {command.transport !== "iot" && <th>Offset</th>}
              {command.transport !== "iot" && <th>Bytes</th>}
              <th>Field</th>
              <th>Meaning / example</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {command.transport !== "iot" && <td className="mono">{r.offset}</td>}
                {command.transport !== "iot" && <td className="mono">{r.bytes}</td>}
                <td className="field-name">{r.field}</td>
                <td>{r.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {command.layout && <Notes text={command.layout} />}
    </div>
  );
}
