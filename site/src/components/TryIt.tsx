import { useMemo, useState } from "react";
import { Check, Copy, Play, RefreshCw } from "lucide-react";
import type { Command } from "../types";

const HEX = (n: number) => (n & 0xff).toString(16).padStart(2, "0").toUpperCase();

function parseOp(op: string) {
  const m = op.match(/0x([0-9a-fA-F]{2})\s*\/\s*0x([0-9a-fA-F]{2})/);
  if (m) return { pro: m[1].toUpperCase(), cmd: m[2].toUpperCase(), read: m[1].toLowerCase() === "aa" };
  const m2 = op.match(/0x([0-9a-fA-F]{2})/);
  return { pro: "33", cmd: m2 ? m2[1].toUpperCase() : "05", read: false };
}

function extractHex(payload: string) {
  const first = payload.split("|")[0].trim();
  const pairs = first.match(/\b[0-9A-Fa-f]{2}\b/g) || [];
  return pairs.map((p) => p.toUpperCase()).join(" ");
}

function rgb(hex: string) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

function parseHex(s: string) {
  return (s.match(/[0-9A-Fa-f]{2}/g) || []).map((x) => parseInt(x, 16));
}

function b64(bytes: number[]) {
  return btoa(String.fromCharCode(...bytes));
}

function xorBcc(bytes: number[]) {
  return bytes.slice(0, 19).reduce((a, b) => a ^ b, 0);
}

function envelope(cmd: string, data: unknown, cmdVersion = 0) {
  return JSON.stringify(
    {
      msg: {
        transaction: `atlas-${Math.random().toString(16).slice(2, 10)}`,
        accountTopic: "<account-topic>",
        type: 1,
        origin: 32,
        cmdVersion,
        cmd,
        data,
      },
    },
    null,
    2,
  );
}

type Guided = {
  kind: "color15" | "color0d" | "color0b" | "brightness" | "power" | "scene" | "diy" | "music" | "none";
  color: string;
  bg: string;
  kelvin: number;
  mask: boolean[];
  brightness: number;
  sensitivity: number;
  effect: number;
  diy: number;
  on: boolean;
};

function detectGuided(c: Command): Guided["kind"] {
  const p = `${c.payload} ${c.layout}`.toLowerCase();
  const n = c.name.toLowerCase();
  if (p.includes("15 01") || p.includes("15 02") || p.includes("15 03") || (p.includes("0x15") && p.includes("rgb"))) return "color15";
  if (p.includes("0d r g b") || p.includes("0d rgb")) return "color0d";
  if (p.includes("0b r g b") || p.includes("0b rgb")) return "color0b";
  if (n.includes("brightness") || n === "brightness") return "brightness";
  if (n.includes("power") || n.includes("switch") || p.includes("01|00") || p.includes("00|01") || p.includes("01 on") || p.includes("00 off")) return "power";
  if (n.includes("scene")) return "scene";
  if (n.includes("diy")) return "diy";
  if (n.includes("music")) return "music";
  return "none";
}

function composeBle(c: Command, g: Guided, segments: number, mode: string) {
  const p = c.payload.toLowerCase();
  const maskBytes = Math.max(1, Math.ceil(segments / 8));
  const mask = Array.from({ length: maskBytes }, (_, byte) =>
    g.mask.slice(byte * 8, byte * 8 + 8).reduce((acc, on, bit) => (on ? acc | (1 << bit) : acc), 0),
  );
  const [r, gr, b] = rgb(g.color);
  const [r2, g2, b2] = rgb(g.bg);
  const kel = [Math.floor(g.kelvin / 256), g.kelvin % 256];
  const be = p.includes("khi klo") || p.includes("khi klo");
  const kelBytes = be ? kel : [kel[1], kel[0]];

  if (g.kind === "color15") {
    if (mode === "brightness") return ["15", "02", HEX(g.brightness), ...mask.map(HEX)].join(" ");
    if (mode === "array") return ["15", "03", ...Array(segments).fill(HEX(g.brightness))].join(" ");
    return ["15", "01", HEX(r), HEX(gr), HEX(b), ...kelBytes.map(HEX), HEX(r2), HEX(g2), HEX(b2), ...mask.map(HEX)].join(" ");
  }
  if (g.kind === "color0d") return ["0D", HEX(r), HEX(gr), HEX(b), ...kelBytes.map(HEX), HEX(r2), HEX(g2), HEX(b2)].join(" ");
  if (g.kind === "color0b") return ["0B", HEX(r), HEX(gr), HEX(b), ...mask.map(HEX)].join(" ");
  if (g.kind === "brightness") return HEX(g.brightness);
  if (g.kind === "power") return g.on ? "01" : "00";
  if (g.kind === "scene") return ["04", HEX(g.effect & 255), HEX(g.effect >> 8)].join(" ");
  if (g.kind === "diy") return ["0A", HEX(g.diy & 255), HEX(g.diy >> 8)].join(" ");
  if (g.kind === "music") return ["13", HEX(g.effect), HEX(g.sensitivity)].join(" ");
  return "";
}

type IotField = {
  key: string;
  type: "toggle" | "slider" | "number" | "text" | "color" | "json";
  value: string | number | boolean;
  min?: number;
  max?: number;
};

function range(s: string): [number, number] | null {
  const m = s.match(/(-?\d+)\s*(?:-|\.\.|to|~)\s*(-?\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  return null;
}

function inferIotFields(payload: string): IotField[] {
  let obj: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) obj = parsed as Record<string, unknown>;
  } catch {
    const re = /([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*("?[^",}]+"?)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(payload))) {
      let v: unknown = m[2].replace(/^"|"$/g, "");
      if (/^-?\d+$/.test(String(v))) v = Number(v);
      else if (v === "true" || v === "false") v = v === "true";
      obj[m[1]] = v;
    }
  }
  return Object.entries(obj).map(([key, raw]) => {
    if (typeof raw === "boolean") return { key, type: "toggle", value: raw };
    if (typeof raw === "number") return { key, type: "number", value: raw };
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      if (["red", "r"].every((k) => k in o) || ["red", "green", "blue"].every((k) => k in o)) {
        const r = Number(o.red ?? o.r ?? 0);
        const g = Number(o.green ?? o.g ?? 0);
        const b = Number(o.blue ?? o.b ?? 0);
        return { key, type: "color", value: `#${HEX(r)}${HEX(g)}${HEX(b)}` };
      }
      return { key, type: "json", value: JSON.stringify(raw) };
    }
    const str = String(raw);
    if (["0|1", "1|0", "0/1", "true|false"].includes(str.toLowerCase())) return { key, type: "toggle", value: str !== "0|1" };
    const r = range(str);
    if (r) return { key, type: "slider", value: r[0], min: r[0], max: r[1] };
    if (/^-?\d+(\.\d+)?$/.test(str)) return { key, type: "number", value: Number(str) };
    return { key, type: "text", value: str };
  });
}

function buildIotData(fields: IotField[], values: Record<string, string | number | boolean>) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.key];
    if (f.type === "color") {
      const [r, g, b] = rgb(String(v));
      out[f.key] = { red: r, green: g, blue: b };
    } else if (f.type === "json") {
      try {
        out[f.key] = JSON.parse(String(v));
      } catch {
        out[f.key] = String(v);
      }
    } else out[f.key] = v;
  }
  return out;
}

function CopyLine({ label, text, onCopied }: { label: string; text: string; onCopied: (s: string) => void }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="try-copy"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        onCopied(`${label} copied`);
        setDone(true);
        window.setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? "Copied" : label}
    </button>
  );
}

export function TryIt({ command, onCopied }: { command: Command; onCopied: (s: string) => void }) {
  const detected = detectGuided(command);
  const parsed = parseOp(command.op);
  const [proType, setProType] = useState(parsed.pro);
  const [cmdType, setCmdType] = useState(parsed.cmd);
  const [rawPayload, setRawPayload] = useState(extractHex(command.payload));
  const [guidedMode, setGuidedMode] = useState(detected !== "none");
  const [segments, setSegments] = useState(16);
  const [subtype, setSubtype] = useState<"color" | "brightness" | "array">("color");
  const [g, setG] = useState<Guided>({
    kind: detected,
    color: "#ff9d2e",
    bg: "#ffffff",
    kelvin: 2700,
    mask: Array(40).fill(true),
    brightness: 50,
    sensitivity: 50,
    effect: 1,
    diy: 1,
    on: true,
  });

  const isIot = command.transport === "iot";
  const payload = guidedMode && !isIot ? composeBle(command, g, segments, subtype) || rawPayload : rawPayload;
  const iotFields = useMemo(() => inferIotFields(command.payload), [command.payload]);
  const [iotValues, setIotValues] = useState<Record<string, string | number | boolean>>(() =>
    Object.fromEntries(iotFields.map((f) => [f.key, f.value])),
  );
  const [frameText, setFrameText] = useState("");
  const [mqttText, setMqttText] = useState("");

  const frameBytes = useMemo(() => {
    const body = parseHex(payload).slice(0, 17);
    const arr = [parseInt(proType, 16) || 0, parseInt(cmdType, 16) || 0, ...body];
    while (arr.length < 19) arr.push(0);
    arr[19] = 0;
    arr[19] = xorBcc(arr);
    return arr;
  }, [payload, proType, cmdType]);

  const frameHex = frameBytes.map(HEX).join(" ");
  const frameB64 = b64(frameBytes);
  const wrapper = (command.cloud || "").split("|")[0];
  const mqtt = wrapper
    ? envelope(wrapper, wrapper === "multiSync" ? { command: [frameB64, frameB64] } : { command: [frameB64] })
    : "";
  const iot = isIot ? envelope(command.op || command.name, buildIotData(iotFields, iotValues), 0) : "";

  const apply = () => {
    if (!isIot) setRawPayload(composeBle(command, g, segments, subtype) || rawPayload);
  };

  return (
    <div className="try-it">
      <div className="try-head">
        <div>
          <div className="kicker">Try it out</div>
          <h3>Build the wire payload</h3>
          <p>
            Generated from this command's layout. {isIot ? "Edit the JSON fields and copy the MQTT envelope." : "Adjust the fields, then copy the frame or cloud payload."}
          </p>
        </div>
        <button className="try-refresh" onClick={apply} title="Recompose payload">
          <RefreshCw size={13} /> Compose
        </button>
      </div>

      {isIot ? (
        <div className="try-form">
          <div className="try-row">
            <label>cmd</label>
            <input value={command.op || command.name} readOnly />
          </div>
          {iotFields.length === 0 && (
            <p className="try-note">No structured data fields for this command. Edit the JSON output below.</p>
          )}
          {iotFields.map((f) => {
            const val = iotValues[f.key];
            const set = (v: string | number | boolean) => setIotValues({ ...iotValues, [f.key]: v });
            return (
              <div className="try-row" key={f.key}>
                <label>{f.key}</label>
                {f.type === "toggle" ? (
                  <button className={val ? "seg on" : "seg"} onClick={() => set(!val)}>
                    {val ? "ON (1)" : "OFF (0)"}
                  </button>
                ) : f.type === "slider" ? (
                  <>
                    <input
                      type="range"
                      min={f.min ?? 0}
                      max={f.max ?? 100}
                      value={Number(val)}
                      onChange={(e) => set(Number(e.target.value))}
                    />
                    <span className="mono">{String(val)}</span>
                  </>
                ) : f.type === "color" ? (
                  <>
                    <input type="color" value={String(val)} onChange={(e) => set(e.target.value)} />
                    <span className="mono">{String(val).replace("#", "").toUpperCase()}</span>
                  </>
                ) : f.type === "number" ? (
                  <input type="number" value={Number(val)} onChange={(e) => set(Number(e.target.value))} />
                ) : (
                  <input value={String(val)} onChange={(e) => set(e.target.value)} />
                )}
              </div>
            );
          })}
          <div className="try-actions">
            <CopyLine label="Copy MQTT JSON" text={iot} onCopied={onCopied} />
          </div>
          <pre className="try-output">{iot}</pre>
        </div>
      ) : (
        <>
          <div className="try-toolbar">
            <label className="try-toggle">
              <input type="checkbox" checked={guidedMode} onChange={(e) => setGuidedMode(e.target.checked)} />
              Guided fields
            </label>
            <div className="try-op">
              <label>proType</label>
              <input value={proType} onChange={(e) => setProType(e.target.value.toUpperCase().slice(0, 2))} />
              <label>cmdType</label>
              <input value={cmdType} onChange={(e) => setCmdType(e.target.value.toUpperCase().slice(0, 2))} />
            </div>
          </div>

          {guidedMode && detected !== "none" && (
            <div className="try-form">
              {detected === "color15" || detected === "color0d" || detected === "color0b" ? (
                <>
                  <div className="try-row">
                    <label>Colour</label>
                    <input type="color" value={g.color} onChange={(e) => setG({ ...g, color: e.target.value })} />
                    <span className="mono">{rgb(g.color).map(HEX).join(" ")}</span>
                  </div>
                  {detected !== "color0b" && (
                    <div className="try-row">
                      <label>Kelvin</label>
                      <input
                        type="range"
                        min={1000}
                        max={10000}
                        step={100}
                        value={g.kelvin}
                        onChange={(e) => setG({ ...g, kelvin: Number(e.target.value) })}
                      />
                      <input
                        type="number"
                        value={g.kelvin}
                        onChange={(e) => setG({ ...g, kelvin: Number(e.target.value) })}
                      />
                    </div>
                  )}
                  {detected === "color15" && (
                    <div className="try-row">
                      <label>Subtype</label>
                      <select value={subtype} onChange={(e) => setSubtype(e.target.value as typeof subtype)}>
                        <option value="color">01 colour + mask</option>
                        <option value="brightness">02 group brightness</option>
                        <option value="array">03 per-segment brightness</option>
                      </select>
                    </div>
                  )}
                  <div className="try-row">
                    <label>Segments</label>
                    <input
                      type="range"
                      min={1}
                      max={40}
                      value={segments}
                      onChange={(e) => setSegments(Number(e.target.value))}
                    />
                    <span className="mono">{segments}</span>
                  </div>
                  <div className="try-row">
                    <label>Mask</label>
                    <div className="seg-grid">
                      {Array.from({ length: segments }, (_, i) => (
                        <button
                          key={i}
                          className={g.mask[i] ? "seg on" : "seg"}
                          onClick={() => {
                            const mask = [...g.mask];
                            mask[i] = !mask[i];
                            setG({ ...g, mask });
                          }}
                          title={`Segment ${i}`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                  {subtype !== "color" && (
                    <div className="try-row">
                      <label>Brightness</label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={g.brightness}
                        onChange={(e) => setG({ ...g, brightness: Number(e.target.value) })}
                      />
                      <span className="mono">{g.brightness}</span>
                    </div>
                  )}
                </>
              ) : detected === "brightness" ? (
                <div className="try-row">
                  <label>Brightness</label>
                  <input type="range" min={0} max={100} value={g.brightness} onChange={(e) => setG({ ...g, brightness: Number(e.target.value) })} />
                  <span className="mono">{g.brightness}</span>
                </div>
              ) : detected === "power" ? (
                <div className="try-row">
                  <label>State</label>
                  <button className={g.on ? "seg on" : "seg"} onClick={() => setG({ ...g, on: !g.on })}>
                    {g.on ? "ON (01)" : "OFF (00)"}
                  </button>
                </div>
              ) : detected === "scene" || detected === "diy" ? (
                <div className="try-row">
                  <label>{detected === "scene" ? "Effect / scene" : "DIY code"}</label>
                  <input
                    type="number"
                    value={detected === "scene" ? g.effect : g.diy}
                    onChange={(e) => setG(detected === "scene" ? { ...g, effect: Number(e.target.value) } : { ...g, diy: Number(e.target.value) })}
                  />
                </div>
              ) : detected === "music" ? (
                <>
                  <div className="try-row">
                    <label>Effect code</label>
                    <input type="number" value={g.effect} onChange={(e) => setG({ ...g, effect: Number(e.target.value) })} />
                  </div>
                  <div className="try-row">
                    <label>Sensitivity</label>
                    <input type="range" min={0} max={99} value={g.sensitivity} onChange={(e) => setG({ ...g, sensitivity: Number(e.target.value) })} />
                    <span className="mono">{g.sensitivity}</span>
                  </div>
                </>
              ) : null}
              <p className="try-note">Guided output is a best-effort composer. Switch to raw hex for family-specific alternatives.</p>
            </div>
          )}

          <div className="try-row try-raw">
            <label>Payload hex</label>
            <input value={payload} onChange={(e) => setRawPayload(e.target.value)} />
          </div>

          <div className="try-output-head">
            <span>20-byte frame</span>
            <CopyLine label="Copy hex" text={frameHex} onCopied={onCopied} />
          </div>
          <div className="frame-preview">
            {frameBytes.map((b, i) => (
              <span key={i} className={i === 0 ? "fp-pro" : i === 1 ? "fp-cmd" : i === 19 ? "fp-bcc" : "fp-pay"}>{HEX(b)}</span>
            ))}
          </div>
          <pre className="try-output">{frameHex}</pre>

          <div className="try-output-head">
            <span>Base64</span>
            <CopyLine label="Copy base64" text={frameB64} onCopied={onCopied} />
          </div>
          <pre className="try-output">{frameB64}</pre>

          {wrapper && (
            <>
              <div className="try-output-head">
                <span>MQTT · {wrapper}</span>
                <CopyLine label="Copy MQTT" text={mqtt} onCopied={onCopied} />
              </div>
              <pre className="try-output">{mqtt}</pre>
            </>
          )}
          {command.cloud && <p className="try-note">Cloud format(s) for this split: <b>{command.cloud}</b>. The actual command is still the BLE frame above.</p>}
        </>
      )}
    </div>
  );
}
