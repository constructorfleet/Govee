import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bluetooth,
  BookOpen,
  Boxes,
  Braces,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Cloud,
  Cpu,
  Database,
  ExternalLink,
  Filter,
  GitBranch,
  Hash,
  Layers,
  Menu,
  Radio,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Waves,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import type { Command, Detail, Doc, Effect, Reading, SiteData, StatusProperty, Tab } from "./types";
import { CommandPalette } from "./components/CommandPalette";
import { Drawer } from "./components/Drawer";
import { Markdown } from "./components/Markdown";

const PAGE = 80;

function transportLabel(t: string) {
  if (t === "ble") return "BLE";
  if (t === "ble-notify") return "Notify";
  if (t === "iot") return "IoT";
  return t;
}

function TransportBadge({ t }: { t: string }) {
  const cls = t === "ble" ? "ble" : t === "ble-notify" ? "notify" : t === "iot" ? "iot" : "other";
  return <span className={`badge badge-${cls}`}>{transportLabel(t)}</span>;
}

function Hi({ text, q }: { text: string; q: string }) {
  const needle = q.trim();
  if (!needle) return <>{text}</>;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === needle.toLowerCase() ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function Pager({
  page,
  setPage,
  total,
  pageSize = PAGE,
}: {
  page: number;
  setPage: (n: number) => void;
  total: number;
  pageSize?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button className="icon-btn" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
        <ChevronLeft size={16} />
      </button>
      <span>
        Page <b>{page}</b> / {pages} <span className="muted">· {total} rows</span>
      </span>
      <button className="icon-btn" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-box">
      <Search size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button className="clear" onClick={() => onChange("")} aria-label="Clear">
          <X size={14} />
        </button>
      )}
    </label>
  );
}

function StatCard({ label, value, hint, tone }: { label: string; value: number | string; hint: string; tone: string }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-hint">{hint}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <CircleDot size={18} />
      {text}
    </div>
  );
}

function SplitButton({ split, onClick }: { split: string; onClick: () => void }) {
  return (
    <button
      className="split-link"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Open split deep dive"
    >
      {split.replace(/^split_pact_/, "").replace(/^split_/, "")}
    </button>
  );
}

export default function App() {
  const [data, setData] = useState<SiteData | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    const h = window.location.hash.replace("#", "") as Tab;
    return ["overview", "devices", "commands", "effects", "readings", "docs", "status"].includes(h) ? h : "overview";
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [toast, setToast] = useState("");

  // devices
  const [devQ, setDevQ] = useState("");
  const [devTransport, setDevTransport] = useState("all");
  const [devSplit, setDevSplit] = useState("all");
  const [devPage, setDevPage] = useState(1);

  // commands
  const [cmdQ, setCmdQ] = useState("");
  const [cmdTransport, setCmdTransport] = useState("all");
  const [cmdSplit, setCmdSplit] = useState("all");
  const [cmdPage, setCmdPage] = useState(1);

  // effects
  const [fxQ, setFxQ] = useState("");
  const [fxSplit, setFxSplit] = useState("all");
  const [fxSub, setFxSub] = useState("all");
  const [fxPage, setFxPage] = useState(1);

  // readings
  const [rdQ, setRdQ] = useState("");
  const [rdSplit, setRdSplit] = useState("all");
  const [rdPage, setRdPage] = useState(1);

  // status
  const [stQ, setStQ] = useState("");

  // docs
  const [docQ, setDocQ] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<string>("doc:PROTOCOLS");

  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    fetch(new URL("data/site.json", document.baseURI))
      .then((r) => r.json())
      .then((d: SiteData) => setData(d))
      .catch(() => setToast("Failed to load site data"));
  }, []);

  useEffect(() => {
    history.replaceState(null, "", `#${tab}`);
  }, [tab]);

  const openDoc = useCallback((idOrSplit: string) => {
    const id = idOrSplit.startsWith("doc:") || idOrSplit.startsWith("split:") ? idOrSplit : `split:${idOrSplit}`;
    setSelectedDoc(id);
    setTab("docs");
    setDetail(null);
    setPaletteOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const copy = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1600);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "/" && !typing && !paletteOpen && !detail) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, detail]);

  useEffect(() => setDevPage(1), [devQ, devTransport, devSplit]);
  useEffect(() => setCmdPage(1), [cmdQ, cmdTransport, cmdSplit]);
  useEffect(() => setFxPage(1), [fxQ, fxSplit, fxSub]);
  useEffect(() => setRdPage(1), [rdQ, rdSplit]);

  const devices = useMemo(() => {
    if (!data) return [];
    const q = devQ.toLowerCase().trim();
    return data.devices.filter((d) => {
      if (devTransport !== "all" && !d.transports.split("|").includes(devTransport)) return false;
      if (devSplit !== "all" && d.split !== devSplit) return false;
      if (!q) return true;
      return `${d.sku} ${d.family} ${d.notes} ${d.transports} ${d.goods_type}`.toLowerCase().includes(q);
    });
  }, [data, devQ, devTransport, devSplit]);

  const commands = useMemo(() => {
    if (!data) return [];
    const q = cmdQ.toLowerCase().trim();
    return data.commands.filter((c) => {
      if (cmdTransport !== "all" && c.transport !== cmdTransport) return false;
      if (cmdSplit !== "all" && c.split !== cmdSplit) return false;
      if (!q) return true;
      return `${c.name} ${c.op} ${c.payload} ${c.layout} ${c.source} ${c.families} ${c.split}`
        .toLowerCase()
        .includes(q);
    });
  }, [data, cmdQ, cmdTransport, cmdSplit]);

  const effects = useMemo(() => {
    if (!data) return [];
    const q = fxQ.toLowerCase().trim();
    return data.effects.filter((e) => {
      if (fxSplit !== "all" && e.split !== fxSplit) return false;
      if (fxSub !== "all" && e.submode !== fxSub) return false;
      if (!q) return true;
      return `${e.name} ${e.payload} ${e.attributes} ${e.source} ${e.split}`.toLowerCase().includes(q);
    });
  }, [data, fxQ, fxSplit, fxSub]);

  const readings = useMemo(() => {
    if (!data) return [];
    const q = rdQ.toLowerCase().trim();
    return data.readings.filter((r) => {
      if (rdSplit !== "all" && r.split !== rdSplit) return false;
      if (!q) return true;
      return `${r.name} ${r.op} ${r.layout} ${r.source} ${r.split} ${r.transport}`.toLowerCase().includes(q);
    });
  }, [data, rdQ, rdSplit]);

  const statusProps = useMemo(() => {
    if (!data) return [];
    const q = stQ.toLowerCase().trim();
    if (!q) return data.status_properties;
    return data.status_properties.filter((s) =>
      `${s.property} ${s.kind} ${s.meaning} ${s.carrier} ${s.source} ${s.split}`.toLowerCase().includes(q),
    );
  }, [data, stQ]);

  const docs = useMemo(() => {
    if (!data) return [];
    const q = docQ.toLowerCase().trim();
    return data.docs.filter((d) => !q || `${d.title} ${d.group} ${d.file}`.toLowerCase().includes(q));
  }, [data, docQ]);

  const activeDoc = data?.docs.find((d) => d.id === selectedDoc) ?? data?.docs[0];

  if (!data) {
    return (
      <div className="boot">
        <div className="boot-mark">
          <Zap size={30} />
        </div>
        <div className="boot-bar">
          <span />
        </div>
        <p>Loading protocol atlas…</p>
      </div>
    );
  }

  const splitOptions = data.splits.map((s) => s.split).sort();
  const submodeOptions = [...new Set(data.effects.map((e) => e.submode).filter(Boolean))].sort();
  const totalCmdPages = Math.max(1, Math.ceil(commands.length / PAGE));
  const pagedCommands = commands.slice((cmdPage - 1) * PAGE, cmdPage * PAGE);
  const pagedDevices = devices.slice((devPage - 1) * PAGE, devPage * PAGE);
  const pagedEffects = effects.slice((fxPage - 1) * PAGE, fxPage * PAGE);
  const pagedReadings = readings.slice((rdPage - 1) * PAGE, rdPage * PAGE);

  const tabs: Array<{ id: Tab; label: string; icon: typeof Boxes; count?: number }> = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "devices", label: "Devices", icon: Boxes, count: data.devices.length },
    { id: "commands", label: "Commands", icon: Terminal, count: data.commands.length },
    { id: "effects", label: "Effects", icon: Sparkles, count: data.effects.length },
    { id: "readings", label: "Readings", icon: Waves, count: data.readings.length },
    { id: "docs", label: "Docs", icon: BookOpen, count: data.docs.length },
    { id: "status", label: "Status", icon: Cpu, count: data.status_properties.length },
  ];

  const repoUrl = (() => {
    const host = window.location.hostname;
    if (host.endsWith("github.io")) {
      const owner = host.split(".")[0];
      const project = window.location.pathname.split("/").filter(Boolean)[0];
      if (owner && project) return `https://github.com/${owner}/${project}`;
    }
    return "https://github.com/constructorfleet/Govee";
  })();

  return (
    <div className="app">
      <div className="aurora" aria-hidden="true" />
      <header className="topbar">
        <button className="brand" onClick={() => setTab("overview")}>
          <span className="brand-mark">
            <Zap size={17} />
          </span>
          <span className="brand-text">
            <b>Govee</b> Protocol Atlas
          </span>
        </button>
        <nav className={`tabs ${navOpen ? "is-open" : ""}`}>
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={tab === t.id ? "tab is-active" : "tab"}
                onClick={() => {
                  setTab(t.id);
                  setNavOpen(false);
                }}
              >
                <Icon size={15} />
                {t.label}
                {t.count !== undefined && <span className="tab-count">{t.count}</span>}
              </button>
            );
          })}
        </nav>
        <div className="top-actions">
          <button className="search-trigger" onClick={() => setPaletteOpen(true)}>
            <Search size={15} />
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
          <a className="icon-btn" href={repoUrl} target="_blank" rel="noreferrer" aria-label="GitHub">
            <GitBranch size={18} />
          </a>
          <button className="icon-btn menu-btn" onClick={() => setNavOpen((v) => !v)} aria-label="Menu">
            <Menu size={18} />
          </button>
        </div>
      </header>

      <main>
        {tab === "overview" && (
          <Overview data={data} setTab={setTab} openDoc={openDoc} openDetail={setDetail} />
        )}

        {tab === "devices" && (
          <section className="section">
            <SectionHead
              kicker="Inventory"
              title="Devices & SKUs"
              desc="Every SKU, its family, transports and pact/goods-type tuple. Click a row for detail."
            />
            <div className="filterbar">
              <SearchBox value={devQ} onChange={setDevQ} placeholder="Filter by SKU, family, notes…" />
              <Select value={devTransport} onChange={setDevTransport} label="Transport">
                <option value="all">All transports</option>
                <option value="ble">BLE</option>
                <option value="iot">IoT</option>
                <option value="matter">Matter</option>
                <option value="wifi">WiFi</option>
                <option value="ble-broadcast">BLE broadcast</option>
              </Select>
              <Select value={devSplit} onChange={setDevSplit} label="Split">
                <option value="all">All split modules</option>
                {splitOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <button className="ghost-btn" onClick={() => { setDevQ(""); setDevTransport("all"); setDevSplit("all"); }}>
                <RotateCcw size={14} /> Reset
              </button>
            </div>
            <div className="result-line">
              <b>{devices.length}</b> SKUs <span className="muted">· {splitOptions.length} split modules</span>
            </div>
            {devices.length === 0 ? (
              <Empty text="No devices match those filters." />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Family</th>
                      <th>Transports</th>
                      <th>goodsType</th>
                      <th>pact</th>
                      <th>Split</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDevices.map((d) => (
                      <tr key={d.id} onClick={() => setDetail({ kind: "device", item: d })}>
                        <td><span className="sku"><Hi text={d.sku} q={devQ} /></span></td>
                        <td className="wide">{d.family}</td>
                        <td>
                          <div className="badge-row">
                            {d.transports.split("|").map((t) => <TransportBadge key={t} t={t} />)}
                          </div>
                        </td>
                        <td className="mono">{d.goods_type || "—"}</td>
                        <td className="mono">
                          {d.pact_type || d.pact_code ? `${d.pact_type ?? "?"}/${d.pact_code ?? "?"}` : "—"}
                        </td>
                        <td><SplitButton split={d.split} onClick={() => openDoc(d.split)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager page={devPage} setPage={setDevPage} total={devices.length} />
          </section>
        )}

        {tab === "commands" && (
          <section className="section">
            <SectionHead
              kicker="Wire level"
              title="Commands"
              desc="BLE frames, IoT JSON commands and notifications. Search opcodes, payloads, sources and SKUs."
            />
            <div className="filterbar">
              <SearchBox value={cmdQ} onChange={setCmdQ} placeholder="Search opcode, name, payload, source…" />
              <div className="segmented">
                {["all", "ble", "ble-notify", "iot"].map((t) => (
                  <button key={t} className={cmdTransport === t ? "is-active" : ""} onClick={() => setCmdTransport(t)}>
                    {t === "all" ? "All" : transportLabel(t)}
                  </button>
                ))}
              </div>
              <Select value={cmdSplit} onChange={setCmdSplit} label="Split">
                <option value="all">All split modules</option>
                {splitOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <button className="ghost-btn" onClick={() => { setCmdQ(""); setCmdTransport("all"); setCmdSplit("all"); }}>
                <RotateCcw size={14} /> Reset
              </button>
            </div>
            <div className="result-line">
              <b>{commands.length}</b> commands
              <span className="muted"> · showing {pagedCommands.length}</span>
            </div>
            {commands.length === 0 ? (
              <Empty text="No commands match those filters." />
            ) : (
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Name</th>
                      <th>Op / cmd</th>
                      <th>Payload</th>
                      <th>Split</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCommands.map((c) => (
                      <tr key={c.id} onClick={() => setDetail({ kind: "command", item: c })}>
                        <td><TransportBadge t={c.transport} /></td>
                        <td className="name-cell"><Hi text={c.name} q={cmdQ} /></td>
                        <td className="mono op-cell"><Hi text={c.op} q={cmdQ} /></td>
                        <td className="payload-cell mono" title={c.payload}><Hi text={c.payload || "—"} q={cmdQ} /></td>
                        <td><SplitButton split={c.split} onClick={() => openDoc(c.split)} /></td>
                        <td className="source-cell mono" title={c.source}><Hi text={c.source} q={cmdQ} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager page={cmdPage} setPage={setCmdPage} total={commands.length} />
          </section>
        )}

        {tab === "effects" && (
          <section className="section">
            <SectionHead
              kicker="Light engine"
              title="Effects & segment control"
              desc="Colour, scene, DIY, music, motion and per-segment payloads. Click a card for the full layout."
            />
            <div className="filterbar">
              <SearchBox value={fxQ} onChange={setFxQ} placeholder="Search effect, payload, attribute…" />
              <Select value={fxSplit} onChange={setFxSplit} label="Split">
                <option value="all">All split modules</option>
                {splitOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select value={fxSub} onChange={setFxSub} label="Sub-mode">
                <option value="all">All sub-modes</option>
                {submodeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <button className="ghost-btn" onClick={() => { setFxQ(""); setFxSplit("all"); setFxSub("all"); }}>
                <RotateCcw size={14} /> Reset
              </button>
            </div>
            <div className="result-line"><b>{effects.length}</b> effect rows</div>
            {effects.length === 0 ? (
              <Empty text="No effects match those filters." />
            ) : (
              <div className="effect-grid">
                {pagedEffects.map((e) => (
                  <article
                    className="effect-card"
                    key={e.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetail({ kind: "effect", item: e })}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") setDetail({ kind: "effect", item: e });
                    }}
                  >
                    <div className="effect-top">
                      <span className="effect-name"><Hi text={e.name} q={fxQ} /></span>
                      {e.submode && <span className="badge badge-mode">{e.submode}</span>}
                    </div>
                    <code className="effect-payload"><Hi text={e.payload || "—"} q={fxQ} /></code>
                    <div className="effect-attrs">{e.attributes}</div>
                    <div className="effect-foot">
                      <SplitButton split={e.split} onClick={() => openDoc(e.split)} />
                      <ArrowRight size={14} />
                    </div>
                  </article>
                ))}
              </div>
            )}
            <Pager page={fxPage} setPage={setFxPage} total={effects.length} />
          </section>
        )}

        {tab === "readings" && (
          <section className="section">
            <SectionHead
              kicker="Device → app"
              title="Readings & notifications"
              desc="BLE notify parsers, sensor broadcasts and IoT status/telemetry schemas."
            />
            <div className="filterbar">
              <SearchBox value={rdQ} onChange={setRdQ} placeholder="Search reading, opcode, field…" />
              <Select value={rdSplit} onChange={setRdSplit} label="Split">
                <option value="all">All split modules</option>
                {splitOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <button className="ghost-btn" onClick={() => { setRdQ(""); setRdSplit("all"); }}>
                <RotateCcw size={14} /> Reset
              </button>
            </div>
            <div className="result-line"><b>{readings.length}</b> reading rows</div>
            {readings.length === 0 ? (
              <Empty text="No readings match those filters." />
            ) : (
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr><th>Transport</th><th>Name</th><th>Op / cmd</th><th>Layout / fields</th><th>Split</th><th>Source</th></tr>
                  </thead>
                  <tbody>
                    {pagedReadings.map((r) => (
                      <tr key={r.id} onClick={() => setDetail({ kind: "reading", item: r })}>
                        <td><span className="badge badge-other">{r.transport.replace("ble-notify", "notify")}</span></td>
                        <td className="name-cell"><Hi text={r.name} q={rdQ} /></td>
                        <td className="mono op-cell"><Hi text={r.op} q={rdQ} /></td>
                        <td className="payload-cell"><Hi text={r.layout} q={rdQ} /></td>
                        <td><SplitButton split={r.split} onClick={() => openDoc(r.split)} /></td>
                        <td className="source-cell mono" title={r.source}><Hi text={r.source} q={rdQ} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager page={rdPage} setPage={setRdPage} total={readings.length} />
          </section>
        )}

        {tab === "docs" && (
          <section className="section docs-section">
            <SectionHead
              kicker="Deep dives"
              title="Documentation"
              desc="The full protocol notes, per-split evidence and cross-cutting audits — rendered in place."
            />
            <div className="docs-layout">
              <aside className="docs-nav">
                <SearchBox value={docQ} onChange={setDocQ} placeholder="Filter docs…" />
                <div className="docs-list">
                  {["Guide", "Split deep dive"].map((group) => {
                    const groupDocs = docs.filter((d) => d.group === group);
                    if (!groupDocs.length) return null;
                    return (
                      <div key={group} className="docs-group">
                        <div className="docs-group-title">{group}</div>
                        {groupDocs.map((d) => (
                          <button
                            key={d.id}
                            className={activeDoc?.id === d.id ? "docs-item is-active" : "docs-item"}
                            onClick={() => setSelectedDoc(d.id)}
                          >
                            <span>{d.title}</span>
                            <span className="docs-file">{d.file}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </aside>
              <article className="docs-body">
                {activeDoc ? (
                  <>
                    <div className="docs-head">
                      <div>
                        <div className="kicker">{activeDoc.group}</div>
                        <h1>{activeDoc.title}</h1>
                        <div className="mono muted">{activeDoc.file}</div>
                      </div>
                      <a className="ghost-btn" href={`${repoUrl}/blob/main/protocol/${activeDoc.file}`} target="_blank" rel="noreferrer">
                        <GitBranch size={14} /> GitHub
                      </a>
                    </div>
                    <Markdown md={activeDoc.md.replace(/^#\s+.+\n+/, "")} />
                  </>
                ) : (
                  <Empty text="No doc selected." />
                )}
              </article>
            </div>
          </section>
        )}

        {tab === "status" && (
          <section className="section">
            <SectionHead
              kicker="Not every flag is an opcode"
              title="Status properties"
              desc="Cloud/device status flags, settings and UI-derived values, separate from commands and readings."
            />
            <div className="filterbar">
              <SearchBox value={stQ} onChange={setStQ} placeholder="Search property, carrier, meaning…" />
              <button className="ghost-btn" onClick={() => setStQ("")}><RotateCcw size={14} /> Reset</button>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Property</th><th>Kind</th><th>Meaning</th><th>Carrier</th><th>Split</th></tr></thead>
                <tbody>
                  {statusProps.map((s) => (
                    <tr key={s.id} onClick={() => setDetail({ kind: "status", item: s })}>
                      <td><span className="sku"><Hi text={s.property} q={stQ} /></span></td>
                      <td><span className="badge badge-mode">{s.kind}</span></td>
                      <td className="wide"><Hi text={s.meaning} q={stQ} /></td>
                      <td className="payload-cell mono"><Hi text={s.carrier} q={stQ} /></td>
                      <td><SplitButton split={s.split} onClick={() => openDoc(s.split)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <footer className="foot">
        <span><Zap size={13} /> Govee Protocol Atlas</span>
        <span className="muted">Extracted from Govee Home 7.7.21 split modules + 7.7.10 base</span>
        <span className="muted">Not affiliated with Govee. Research use.</span>
      </footer>

      <Drawer detail={detail} onClose={() => setDetail(null)} onOpenDoc={openDoc} onCopied={copy} />
      <CommandPalette
        data={data}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(d) => {
          setDetail(d);
          setPaletteOpen(false);
        }}
        onOpenDoc={openDoc}
      />
      {toast && <div className="toast"><Check size={14} /> {toast}</div>}
    </div>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="select">
      <Filter size={14} />
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {children}
      </select>
    </label>
  );
}

function SectionHead({ kicker, title, desc }: { kicker: string; title: string; desc: string }) {
  return (
    <div className="section-head">
      <div className="kicker">{kicker}</div>
      <h1>{title}</h1>
      <p>{desc}</p>
    </div>
  );
}

function Overview({
  data,
  setTab,
  openDoc,
  openDetail,
}: {
  data: SiteData;
  setTab: (t: Tab) => void;
  openDoc: (id: string) => void;
  openDetail: (d: Detail) => void;
}) {
  const transportRows = Object.entries(data.transports).sort((a, b) => b[1] - a[1]);
  const maxTransport = Math.max(...transportRows.map(([, v]) => v), 1);
  const topSplits = [...data.splits]
    .sort((a, b) => b.ble_commands + b.iot_commands + b.dynamic_effects - (a.ble_commands + a.iot_commands + a.dynamic_effects))
    .slice(0, 8);
  const random = () => {
    const c = data.commands[Math.floor(Math.random() * data.commands.length)];
    if (c) openDetail({ kind: "command", item: c });
  };
  const uniqueSkus = new Set(data.devices.map((d) => d.sku)).size;

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-badge"><span className="dot" /> Govee Home 7.7.21 · protocol research</div>
          <h1>
            Every Govee byte,
            <br />
            <span className="grad">finally searchable.</span>
          </h1>
          <p>
            BLE frames, IoT JSON, segment effects, readings and device families from 45 decompiled
            <code> pact_* </code> modules — in one fast, filterable atlas.
          </p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => setTab("commands")}>
              <Terminal size={16} /> Explore commands <ArrowRight size={15} />
            </button>
            <button className="ghost-btn" onClick={random}><Sparkles size={15} /> Random command</button>
            <button className="ghost-btn" onClick={() => setTab("docs")}><BookOpen size={15} /> Read the docs</button>
          </div>
          <div className="hero-chips">
            <span><Bluetooth size={13} /> BLE</span>
            <span><Cloud size={13} /> IoT</span>
            <span><Wifi size={13} /> WiFi / MQTT</span>
            <span><Radio size={13} /> Matter</span>
            <span><Layers size={13} /> Segment effects</span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="frame-card">
            <div className="frame-head">
              <span>BLE frame · 20 bytes</span>
              <span className="mono">0x33 0x05</span>
            </div>
            <div className="frame-bytes">
              {["33", "05", "15", "01", "R", "G", "B", "kH", "kL", "R2", "G2", "B2", "m0", "m1", "00", "00", "00", "00", "00", "BCC"].map((b, i) => (
                <span key={i} className={`frame-byte ${i === 0 ? "pro" : i === 1 ? "cmd" : i === 19 ? "bcc" : "payload"}`}>
                  {b}
                </span>
              ))}
            </div>
            <div className="frame-legend">
              <span><i className="sw-pro" /> proType</span>
              <span><i className="sw-cmd" /> cmdType</span>
              <span><i className="sw-payload" /> payload</span>
              <span><i className="sw-bcc" /> XOR BCC</span>
            </div>
            <pre className="frame-code"><span className="c-pro">33</span> <span className="c-cmd">05</span> <span className="c-pay">15 01 R G B kHi kLo R2 G2 B2 m0 m1</span> <span className="c-dim">00 …</span> <span className="c-bcc">BCC</span></pre>
            <p className="frame-note">Mode container + 0x15 segmented colour. Masks are LSB-first; kelvin endianness is family-specific.</p>
          </div>
        </div>
      </section>

      <section className="stats">
        <StatCard label="Split modules" value={data.meta.split_modules_with_devices} hint="device-protocol modules" tone="cyan" />
        <StatCard label="SKU rows" value={data.meta.sku_rows} hint={`${uniqueSkus} unique SKUs`} tone="violet" />
        <StatCard label="BLE commands" value={data.meta.ble_command_rows} hint={`${data.meta.ble_notification_rows} notifications`} tone="lime" />
        <StatCard label="IoT commands" value={data.meta.iot_command_rows} hint="cloud JSON" tone="pink" />
        <StatCard label="Effects" value={data.meta.dynamic_effect_rows} hint="colour · scene · DIY · music" tone="amber" />
        <StatCard label="Matter SKUs" value={data.transports.matter ?? 0} hint="commissioning-capable" tone="cyan" />
      </section>

      <section className="overview-grid">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="kicker">Transport mix</div>
              <h2>How devices connect</h2>
            </div>
            <Radio size={18} />
          </div>
          <div className="bars">
            {transportRows.map(([name, value]) => (
              <div className="bar-row" key={name}>
                <span className="bar-name">{name}</span>
                <div className="bar-track"><span style={{ width: `${(value / maxTransport) * 100}%` }} /></div>
                <span className="bar-value">{value}</span>
              </div>
            ))}
          </div>
          <p className="panel-note">SKUs can expose several transports. Matter is commissioning; control stays on Govee frames.</p>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="kicker">Busiest families</div>
              <h2>Where the bytes live</h2>
            </div>
            <Database size={18} />
          </div>
          <div className="split-list">
            {topSplits.map((s) => (
              <button key={s.split} className="split-row" onClick={() => openDoc(s.split)}>
                <span className="split-row-name">{s.split.replace(/^split_/, "")}</span>
                <span className="split-row-stats">
                  <b>{s.ble_commands + s.iot_commands}</b> cmds
                  <span>·</span>
                  <b>{s.dynamic_effects}</b> fx
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="feature-grid">
        <button className="feature-card" onClick={() => setTab("commands")}>
          <span className="feature-icon tone-cyan"><Terminal size={19} /></span>
          <b>Command explorer</b>
          <span>Search opcodes, payloads, responses and source files. Filter by BLE, notify or IoT.</span>
          <em>Open commands <ArrowRight size={13} /></em>
        </button>
        <button className="feature-card" onClick={() => setTab("effects")}>
          <span className="feature-icon tone-pink"><Sparkles size={19} /></span>
          <b>Effects & segments</b>
          <span>Colour, scene, DIY, music, motion and per-segment colour/brightness masks.</span>
          <em>Open effects <ArrowRight size={13} /></em>
        </button>
        <button className="feature-card" onClick={() => setTab("devices")}>
          <span className="feature-icon tone-violet"><Boxes size={19} /></span>
          <b>Device atlas</b>
          <span>Every SKU with transports, pact tuple, goodsType and family notes.</span>
          <em>Open devices <ArrowRight size={13} /></em>
        </button>
        <button className="feature-card" onClick={() => setTab("docs")}>
          <span className="feature-icon tone-lime"><BookOpen size={19} /></span>
          <b>Deep dives</b>
          <span>Per-split evidence, DreamView/HDMI, Matter, onboarding and known gaps.</span>
          <em>Open docs <ArrowRight size={13} /></em>
        </button>
      </section>

      <section className="recent">
        <div className="section-head small">
          <div className="kicker">Recently added</div>
          <h2>The parts people miss</h2>
        </div>
        <div className="recent-list">
          {["doc:SEGMENT-CONTROL", "doc:DREAMVIEW-HDMI", "doc:ONBOARDING-NETWORK-MATTER", "doc:MISSING-DEVICES", "doc:STATUS-PROPERTIES"].map((id) => {
            const doc = data.docs.find((d) => d.id === id);
            if (!doc) return null;
            return (
              <button key={id} className="recent-item" onClick={() => openDoc(id)}>
                <span className="recent-kicker">{doc.group}</span>
                <b>{doc.title}</b>
                <span className="recent-file mono">{doc.file}</span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
