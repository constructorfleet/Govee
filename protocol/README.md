# Govee device protocol collection

Collated BLE / IoT / other-transport commands and readings for every device family in the
Govee Home 7.7.21 `pact_*` split modules, traced against the fully decompiled 7.7.10 base app.

## Start here

- **[PROTOCOLS.md](PROTOCOLS.md)** — the master document: transport taxonomy, BLE 20-byte
  framing, IoT JSON envelopes, family map, cross-cutting command semantics, gaps.
- **[PROTOCOLS-ALL.md](PROTOCOLS-ALL.md)** — the same overview followed by every per-split
  deep dive in one file (~700 KB).
- **[DEVICES.md](DEVICES.md)** — all 617 SKU rows: family, transports, pact tuple, goodsType.
- **[COMMANDS.md](COMMANDS.md)** — all 968 BLE command rows + 249 notification rows +
  300 IoT command rows, with opcodes, payloads, layouts and source files.
- **[EFFECTS.md](EFFECTS.md)** — all 358 dynamic effect / colour / scene / DIY / music /
  motion payload layouts.
- **[SEGMENT-CONTROL.md](SEGMENT-CONTROL.md)** — segment color masks, group vs per-segment
  brightness, group/zonal reads and realtime segment pushes.
- **[DREAMVIEW-HDMI.md](DREAMVIEW-HDMI.md)** — DreamView camera/video modes, HDMI port/
  black-screen/HDR/saturation/AI-filter settings, Movie Feast.
- **[ONBOARDING-NETWORK-MATTER.md](ONBOARDING-NETWORK-MATTER.md)** — BLE advert/adoption,
  secret-key/WiFi-link pairing, WiFi provisioning (BLE + SoftAP), bind/topic, Matter setup.
- **[MISSING-DEVICES.md](MISSING-DEVICES.md)** — devices present in the app but absent from
  the bundles, including the **H7184 Kitchen Composter** (`pact_h7184`).
- **[READINGS.md](READINGS.md)** — notifications and telemetry/status schemas.
- **[STATUS-PROPERTIES.md](STATUS-PROPERTIES.md)** — status flags vs. settings vs. UI-derived
  properties (`waterShortage`, `tankEmpty`, `waterLack`, `iceFull`, …), with exact carriers.

Machine-readable:

- `data/ALL.json` — merged index (devices, commands, effects, readings)
- `data/split_pact_*.json`, `data/split_pfdv1.json` — per-split extracts
- `devices.csv`, `commands.csv`, `effects.csv`, `readings.csv`,
  `status-properties.csv`

Per-family detail: `splits/<split>.md`.

## Coverage

| | |
|---|---:|
| Device-protocol split modules | 45 |
| SKU rows | 617 |
| BLE command rows | 968 |
| BLE notifications / readings | 249 |
| IoT command rows | 300 |
| Dynamic effect rows | 358 |
| Status properties catalogued | 10 |
| SKUs advertising Matter | 77 |

`split_lib_recognition` is shared vision code, not a device protocol, and is excluded.

## Quick queries

```bash
# every command for one split
grep -A400 '^## split_pact_h70b1' COMMANDS.md | less

# every SKU supporting Matter
awk -F, 'NR==1 || $4 ~ /matter/' devices.csv | column -s, -t | less

# all effects using the segmented colour sub-mode 0x15
grep '0x15' EFFECTS.md | less

# IoT commands whose data mentions humidity
grep -i 'humidity' COMMANDS.md | less

# one SKU
grep -i 'H6079' devices.csv
```

## Method / regeneration

`_REFERENCE.md` is the framing and extraction cheat-sheet. `build_index.py` merges the
per-split JSON into `data/ALL.json` and the CSVs; `build_docs.py` regenerates the
consolidated Markdown catalogs from that index.

```bash
cd protocol
python3 build_index.py
python3 build_docs.py
```

Every row cites the Java file(s) it was derived from, relative to
`decompiled/`. Where a value is runtime/server-supplied (scene catalogues, pixel blobs,
product-DB pact tuples), the doc records the selector/framing and marks the content as
runtime rather than guessing.
