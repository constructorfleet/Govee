import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import type { Command, Device, SiteData } from "../types";

const GROUPS = [
  { key: "ble", label: "BLE commands" },
  { key: "ble-notify", label: "Notifications / readings" },
  { key: "iot", label: "IoT commands" },
] as const;

export function DeviceCommands({
  device,
  data,
  onOpenCommand,
}: {
  device: Device;
  data: SiteData;
  onOpenCommand: (command: Command) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({ ble: true, "ble-notify": false, iot: true });
  const [formatsOpen, setFormatsOpen] = useState(true);

  const commands = useMemo(
    () => data.commands.filter((c) => c.split === device.split),
    [data.commands, device.split],
  );
  const formats = useMemo(
    () => (data.formats || []).filter((f) => f.split === device.split),
    [data.formats, device.split],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter((c) =>
      `${c.name} ${c.op} ${c.payload} ${c.layout} ${c.cloud} ${c.format}`.toLowerCase().includes(s),
    );
  }, [commands, q]);

  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="dev-panel">
      <div className="fields-title">Commands for this device</div>
      <p className="dev-note">
        Scoped to <code>{device.split}</code> — the module that owns every SKU in this family. Click a row to open
        the command.
      </p>

      <div className="dev-search">
        <Search size={13} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Filter ${commands.length} commands…`}
          aria-label="Filter commands for this device"
        />
        {q && (
          <button className="dev-clear" onClick={() => setQ("")} aria-label="Clear filter">
            ×
          </button>
        )}
      </div>

      {GROUPS.map((group) => {
        const rows = filtered.filter((c) => c.transport === group.key);
        const isOpen = q.trim() ? true : open[group.key];
        return (
          <div className="dev-group" key={group.key}>
            <button className="dev-group-head" onClick={() => toggle(group.key)} aria-expanded={isOpen}>
              {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span className="dev-group-label">{group.label}</span>
              <span className="dev-count">{rows.length}</span>
            </button>
            {isOpen && (
              <div className="dev-group-body">
                {rows.length === 0 ? (
                  <p className="dev-empty">None documented for this split.</p>
                ) : (
                  rows.map((c) => (
                    <button className="dev-cmd" key={c.id} onClick={() => onOpenCommand(c)}>
                      <span className="dev-cmd-name">{c.name}</span>
                      <span className="dev-cmd-meta">
                        <span className="mono dev-cmd-op">{c.op || "—"}</span>
                        <span className="dev-cmd-format">
                          {c.cloud ? `via ${c.cloud.replaceAll("|", " / ")}` : c.format}
                        </span>
                      </span>
                      <ChevronRight size={12} className="dev-cmd-go" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {formats.length > 0 && (
        <div className="dev-group">
          <button className="dev-group-head" onClick={() => setFormatsOpen((v) => !v)} aria-expanded={formatsOpen}>
            {formatsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span className="dev-group-label">Transport formats</span>
            <span className="dev-count">{formats.length}</span>
          </button>
          {formatsOpen && (
            <div className="dev-group-body">
              <p className="dev-empty">
                Envelopes — not commands. Each one carries the BLE frames listed above.
              </p>
              {formats.map((f) => (
                <div className="dev-format" key={f.id}>
                  <span className="dev-format-name">{f.format}</span>
                  <span className="dev-format-role">{f.role}</span>
                  <code className="dev-format-payload" title={f.payload}>
                    {f.payload || "—"}
                  </code>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
