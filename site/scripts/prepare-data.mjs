import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const protocolDir = path.join(repoRoot, "protocol");
const outDir = path.join(__dirname, "../public/data");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const all = readJson(path.join(protocolDir, "data/ALL.json"));

const topLevelDocs = [
  "PROTOCOLS.md",
  "COMMANDS.md",
  "EFFECTS.md",
  "MODE-CONTAINER.md",
  "READINGS.md",
  "DEVICES.md",
  "SEGMENT-CONTROL.md",
  "DREAMVIEW-HDMI.md",
  "ONBOARDING-NETWORK-MATTER.md",
  "MISSING-DEVICES.md",
  "STATUS-PROPERTIES.md",
  "_REFERENCE.md",
];

const docs = [];
for (const name of topLevelDocs) {
  const p = path.join(protocolDir, name);
  if (!fs.existsSync(p)) continue;
  const md = fs.readFileSync(p, "utf8");
  const title = (md.match(/^#\s+(.+)$/m)?.[1] || name.replace(/\.md$/, "")).trim();
  docs.push({ id: `doc:${name.replace(/\.md$/, "")}`, group: "Guide", title, file: name, md });
}

const splitDir = path.join(protocolDir, "splits");
for (const name of fs.readdirSync(splitDir).filter((f) => f.endsWith(".md")).sort()) {
  const md = fs.readFileSync(path.join(splitDir, name), "utf8");
  const title = (md.match(/^#\s+(.+)$/m)?.[1] || name.replace(/\.md$/, "")).trim();
  docs.push({ id: `split:${name.replace(/\.md$/, "")}`, group: "Split deep dive", title, file: `splits/${name}`, md });
}

const commands = all.commands.map((c, i) => ({ ...c, id: `cmd-${i}` }));
const devices = all.devices.map((d, i) => ({ ...d, id: `dev-${i}` }));
const formats = (all.formats || []).map((f, i) => ({ ...f, id: `fmt-${i}` }));
const effects = all.effects.map((e, i) => ({ ...e, id: `fx-${i}` }));
const readings = all.readings.map((r, i) => ({ ...r, id: `read-${i}` }));
const status = all.status_properties.map((s, i) => ({ ...s, id: `status-${i}` }));

const site = {
  generatedAt: new Date().toISOString(),
  meta: all.meta,
  transports: all.transports,
  splits: all.splits,
  devices,
  commands,
  formats,
  effects,
  readings,
  status_properties: status,
  docs,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "site.json"), JSON.stringify(site));
console.log(
  `site data: ${devices.length} devices, ${commands.length} commands, ${effects.length} effects, ` +
    `${readings.length} readings, ${docs.length} docs -> ${path.relative(repoRoot, path.join(outDir, "site.json"))}`,
);
