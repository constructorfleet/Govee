#!/usr/bin/env python3
"""Generate the consolidated human-readable protocol catalogs."""
import glob
import json
import os
from collections import Counter, OrderedDict

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
SPLITS = os.path.join(ROOT, "splits")

with open(os.path.join(DATA, "ALL.json"), encoding="utf-8") as fh:
    ALL = json.load(fh)


def esc(v):
    if v is None:
        return ""
    if not isinstance(v, str):
        v = json.dumps(v, ensure_ascii=False, separators=(",", ":"))
    return v.replace("|", "\\|").replace("\n", " ").strip()


def split_docs():
    docs = []
    for path in sorted(glob.glob(os.path.join(SPLITS, "split_*.md"))):
        with open(path, encoding="utf-8") as fh:
            docs.append((os.path.basename(path)[:-3], fh.read()))
    return docs


def family_table():
    rows = ["| Split module | Product family | SKUs | Transports present | BLE cmds | Notify | IoT cmds | Effects |",
            "|---|---|---:|---|---:|---:|---:|---:|"]
    for s in ALL["splits"]:
        devs = [d for d in ALL["devices"] if d["split"] == s["split"]]
        ts = Counter(t for d in devs for t in d["transports"].split("|") if t)
        tstr = ", ".join(f"{k} ({v})" for k, v in sorted(ts.items())) or "—"
        title = s.get("title", "")
        fam = title.split("—", 1)[-1].strip() if "—" in title else (", ".join(s.get("families") or []))
        rows.append("| `{}` | {} | {} | {} | {} | {} | {} | {} |".format(
            s["split"], esc(fam), s["sku_count"], esc(tstr),
            s["ble_commands"], s["ble_notifications"], s["iot_commands"], s["dynamic_effects"]))
    return "\n".join(rows)


def devices_md():
    out = ["# Device / SKU master table", "",
           "One row per SKU, extracted from each split module's `Sku`/`SubLib`/`Support` "
           "registration. `transports` is the union of transports the split declares for that "
           "SKU (`ble`, `iot`, `matter`, `wifi/mqtt`, `ble-broadcast`). `pact_type`/`pact_code` "
           "identify the device protocol tuple where the code declares it; blank means the "
           "mapping is runtime (server product DB).", ""]
    for s in ALL["splits"]:
        rows = [d for d in ALL["devices"] if d["split"] == s["split"]]
        if not rows:
            continue
        out += [f"## {s['split']}", "", "| SKU | Product / family | Transports | pact type/code | goodsType | Notes |",
                "|---|---|---|---|---|---|"]
        for d in rows:
            pact = ""
            if d["pact_type"] not in (None, "") or d["pact_code"] not in (None, ""):
                pact = f"{d['pact_type']}/{d['pact_code']}"
            out.append("| **{}** | {} | {} | {} | {} | {} |".format(
                esc(d["sku"]), esc(d["family"]), esc(d["transports"].replace("|", ", ")),
                esc(pact), esc(d["goods_type"]), esc(d["notes"])))
        out.append("")
    return "\n".join(out)


def commands_md():
    out = ["# Command catalog (BLE and IoT)", "",
           "Actual device commands, deduplicated per split: a command shared by many SKUs appears "
           "once and its scope is the split's SKU set. `op` is `proType/cmdType` for BLE and the "
           "IoT `cmd` name for IoT. Payloads are shown after the 20-byte BLE header; see "
           "`PROTOCOLS.md` for framing.", "",
           "**Transport wrappers are not commands.** `pt`, `ptReal`, `ptIot`, `multiSync` and "
           "`ptUrl` are cloud envelopes that carry one or more 20-byte frames; `op`/`state` are "
           "read envelopes/keys. They are listed separately under each split's "
           "**Transport formats** table. The actual command is the semantic BLE/IoT command row "
           "below (e.g. `timer write` with its `iceSize` field).", ""]
    for s in ALL["splits"]:
        rows = [c for c in ALL["commands"] if c["split"] == s["split"]]
        fmt = [f for f in ALL.get("formats", []) if f["split"] == s["split"]]
        if not rows and not fmt:
            continue
        out += [f"## {s['split']}", ""]
        if fmt:
            out += ["### Transport formats (not commands)", "",
                    "| Format | Role | Payload / data | Source |",
                    "|---|---|---|---|"]
            for f in fmt:
                out.append("| `{}` | {} | {} | `{}` |".format(
                    esc(f["format"]), esc(f["role"]), esc(f["payload"]), esc(f["source"])))
            out.append("")
        for transport, heading in (("ble", "BLE commands"), ("ble-notify", "BLE notifications / readings"), ("iot", "IoT commands")):
            tr = [c for c in rows if c["transport"] == transport]
            if not tr:
                continue
            out += [f"### {heading}", "",
                    "| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |",
                    "|---:|---|---|---|---|---|---|---|"]
            for i, c in enumerate(tr, 1):
                cloud = f"{c.get('format','')}" + (f" via {c['cloud']}" if c.get("cloud") else "")
                out.append("| {} | {} | {} | `{}` | {} | {} | {} | `{}` |".format(
                    i, esc(c["name"]), esc(cloud), esc(c["op"]), esc(c["payload"]), esc(c["layout"]),
                    esc(c["response"]), esc(c["source"])))
            out.append("")
    return "\n".join(out)


def effects_md():
    out = ["# Dynamic effect catalog", "",
           "LED/motion/dynamic-effect writes. These are the sub-mode payloads carried inside "
           "the generic `0x05` mode command (BLE) or the equivalent IoT mode/DIY/scene commands. "
           "Effect IDs and scene/music catalogues are often server-supplied at runtime; where "
           "that is the case the row gives the exact selector layout and says so.", ""]
    for s in ALL["splits"]:
        rows = [e for e in ALL["effects"] if e["split"] == s["split"]]
        if not rows:
            continue
        out += [f"## {s['split']}", "", "| Effect / mode | Sub-mode | Payload | Attributes | Source |",
                "|---|---|---|---|---|"]
        for e in rows:
            out.append("| {} | `{}` | `{}` | {} | `{}` |".format(
                esc(e["name"]), esc(e["submode"]), esc(e["payload"]),
                esc(e["attributes"]), esc(e["source"])))
        out.append("")
    return "\n".join(out)


def readings_md():
    out = ["# Readings and notifications catalog", "",
           "Device-to-app data: BLE notify/read parsers and IoT status/telemetry schemas. "
           "Sensor-specific scaling (×100, 0.01 units, invalid sentinels) is recorded in the "
           "layout column where the code declares it.", "",
           "**Status properties are not commands.** Flags such as `waterLack`, `iceFull` and "
           "`doorNotClosed` are parsed from status frames or cloud device-list beans; "
           "`waterShortageOnOff` is a user setting. See `STATUS-PROPERTIES.md` for the full "
           "classification. The collected status properties are listed below; they are also "
           "in `status-properties.csv` and `data/ALL.json` (`status_properties`).", ""]
    sp = ALL.get("status_properties") or []
    if sp:
        out += ["## Status properties (not opcodes)", "",
                "| Split | Property | Kind | Meaning | Carrier | Source |",
                "|---|---|---|---|---|---|"]
        for p in sp:
            out.append("| `{}` | {} | {} | {} | {} | `{}` |".format(
                esc(p["split"]), esc(p["property"]), esc(p["kind"]),
                esc(p["meaning"]), esc(p["carrier"]), esc(p["source"])))
        out.append("")
    for s in ALL["splits"]:
        rows = [r for r in ALL["readings"] if r["split"] == s["split"]]
        if not rows:
            continue
        out += [f"## {s['split']}", "", "| Transport | Name | Op / cmd | Layout / fields | Source |",
                "|---|---|---|---|---|"]
        for r in rows:
            out.append("| {} | {} | `{}` | {} | `{}` |".format(
                esc(r["transport"]), esc(r["name"]), esc(r["op"]), esc(r["layout"]), esc(r["source"])))
        out.append("")
    return "\n".join(out)


NARRATIVE = """# Govee BLE / IoT device protocol collection

This directory is the single collated reference for the device protocols implemented in the
Govee Home **7.7.21** `pact_*` split modules (plus the shared machinery from the fully
decompiled **7.7.10** base app).

The source material is decompiled Java under
`decompiled/jadx-splits/<split>/sources/com/govee/...`. Each `pact_*` module is a
per-product-family protocol pack: SKU registry, BLE GATT command builders, mode/effect
encoders, cloud (IoT) command classes, notify parsers and device UI. This collection
extracts the wire-level parts and leaves the UI behind.

## What was collected

| Metric | Count |
|---|---:|
| Device-protocol split modules | 45 |
| SKU rows (SKU -> family -> transports) | {skus} |
| BLE command rows (deduplicated per split) | {ble} |
| BLE notification / reading rows | {notify} |
| IoT command rows | {iot} |
| Transport format rows (ptReal/multiSync/etc.) | {formats} |
| Dynamic effect / mode-payload rows | {fx} |
| Status properties catalogued | {status} |
| SKUs advertising Matter | {matter} |

`split_lib_recognition` is shared on-device vision/recognition code with no device model or
wire protocol of its own, so it is intentionally not catalogued as a device family.

**Known missing device:** the **H7184 Kitchen Composter** (goodsType 208, module
`pact_h7184`) is referenced by the base app but shipped as an on-demand PFD module that is
absent from the 7.7.10/7.7.21 bundles. Its scaffold and capabilities are documented in
`MISSING-DEVICES.md`; its command builders could not be extracted.

## Files

| File | Contents |
|---|---|
| `PROTOCOLS.md` | This document: stack, framing, family map, cross-cutting semantics, gaps |
| `PROTOCOLS-ALL.md` | Everything in one file: this overview + every per-split deep dive |
| `DEVICES.md` | Every SKU with family, transports, pact tuple, goodsType, notes |
| `COMMANDS.md` | Every BLE/IoT command with opcode, payload, layout, response, source |
| `EFFECTS.md` | Every dynamic effect/mode payload (colour, scene, DIY, music, motion, segments) |
| `SEGMENT-CONTROL.md` | Focused index of segment color masks, group/per-segment brightness and readback |
| `DREAMVIEW-HDMI.md` | DreamView camera/video modes, HDMI settings, HDR/saturation/AI filter, black screen, Movie Feast |
| `ONBOARDING-NETWORK-MATTER.md` | BLE adoption, WiFi provisioning (BLE/SoftAP), bind/topic, Matter commissioning |
| `MISSING-DEVICES.md` | Devices referenced by the app but absent from the bundles (H7184 composter) |
| `READINGS.md` | Every notification and telemetry/status schema |
| `STATUS-PROPERTIES.md` | Status flags vs. settings vs. UI-derived properties (`waterShortage`, `tankEmpty`, `waterLack`, …) |
| `devices.csv` / `commands.csv` / `formats.csv` / `effects.csv` / `readings.csv` / `status-properties.csv` | The same data as CSV |
| `data/ALL.json` | Merged machine-readable index (devices + commands + effects + readings) |
| `data/split_*.json` | Per-split machine-readable extract |
| `splits/split_*.md` | Per-split deep dive with source trails |
| `_REFERENCE.md` | Framing/method cheat-sheet used by the extraction agents |
| `build_index.py`, `build_docs.py` | Regenerate the consolidated files |

## 1. Transport taxonomy

Govee devices in this codebase use several distinct paths, often simultaneously:

| Transport | What it is | Where it appears |
|---|---|---|
| **BLE GATT** | 20-byte vendor packets to a service/characteristic, notify responses | Nearly every family; `ble/BleComm.java`, `BleProtocol.java`, `Mode*`, `SubMode*`, `*CmdBuilder*` |
| **IoT / cloud** | JSON messages over the account MQTT/topic channel (write/read envelopes) | Families with `iot/Cmd*.java` and `Iot*CmdBuilder*`; `Write`/`Read`/`AbsCmd` in base |
| **`ptReal`** | BLE frames base64-tunnelled through the IoT JSON `ptReal` command | BLE+IoT families; `CmdPtReal` |
| **`pt`** | Raw passthrough command through the cloud | Many IoT families; `CmdPt` |
| **`ptUrl`** | Cloud command blob fetched from a URL then executed | h3a5x, h60ax, h6630, h6660, h682021, h6840, h7050, h7075, h70b1 |
| **`multiSync`** | Multi-device synchronised command | h5901, leaknew, thnew |
| **Matter** | Commissioning/pairing bridge; device control often stays on BLE/cloud | 77 SKUs across many lighting/appliance splits |
| **WiFi / MQTT / LAN** | Local network or broker path (endpoints/topics per family) | floorlamp, h60ax, h6630, h682021, h6840, h70b1, outdoorlight, plugnew |
| **BLE broadcast** | Advertisement-only sensors (TH, leak, BBQ probes) | bbqnew, thnew, leaknew, sensors |
| **UDP multicast LAN** (integration-observed) | UDP to `239.255.255.250:4001–4003` | Not found in the decompiled app; an external integration path. The app itself uses cloud MQTT and some local MQTT/WiFi paths. |
| **SoftAP / HTTP / REST** | Provisioning or cloud REST (e.g. H6085/H6086/H6089 bulb AP at 192.168.1.1:7200) | security/health, ice machine, h5901, h6099 calibration |
| **IR / RF / laser** | Appliance/IR code sets, laser engraver job protocol | security/health (IR), h6660 (laser) |

Per-SKU transport assignments are in `DEVICES.md` / `devices.csv`. A SKU listed as `ble`
only has no cloud path in its split; `ble` + `iot` means both paths exist, usually with
`ptReal` mapping the BLE byte stream into the cloud command.

## 2. BLE wire format

All normal commands are **20-byte packets**:

```
byte 0      proType     0x33 write | 0xAA read | 0xA3/0xA4/0xA5/0x3F multi-packet
byte 1      cmdType     command/opcode
bytes 2..18 payload     17 bytes, command-specific
byte 19     BCC         XOR of bytes 0..18
```

`BleUtils.generate20Bytes(proType, cmdType, payload)` builds it; `AbsController` supplies
`getCommandType()` and `getWriteBytes()`/`q()`. Read responses are stripped to the "valid
bytes" buffer before parsing (17 bytes for `0xAA`, 16 for `0x33`).

Key opcodes (family `BleProtocol.java` files add more):

| cmdType | Meaning |
|---|---|
| `0x00` | heartbeat |
| `0x01` | power / switch / heart |
| `0x02` | multi-DIY |
| `0x03` | music (legacy) |
| `0x04` | brightness |
| `0x05` | mode container: colour, scene, DIY, music, gradient, motion |
| `0x07` | device info |
| `0x08` | device info / calibration (family-specific) |
| `0x09` | sync time |
| `0x0A` | auto time |
| `0x0B` | delay close |
| `0x11` / `0x12` | sleep / wake |
| `0x13` | night mode |
| `0x15` / `0x16` | colour sub-mode (family-specific) / effect direction |
| `0x20`–`0x22` | WiFi MAC / versions |
| `0x23` | new time V1 |
| `0x27` | preview effect |
| `0x30` | light switch / calibration / direction (family-specific) |
| `0x33` | volume (when used as cmdType) |
| `0x39` | check direction |
| `0x40` | IC/segment/splicing |
| `0x41` | device info / on-off memory / splicing state |
| `0x42`/`0x43` | check IC / IC amount |
| `0x46` | IC check / reset net |
| `0x54` | movie feast |
| `0x5A`–`0x62` | graffiti / carousel / combination effects |
| `0x70` | music library / gateway envelope |
| `0x7B`/`0x7C` | GIF create / custom shortcut |
| `0xEE` | notify / OTA prepare |

Multi-packet writes keep the 20-byte frame but use `[2]` as a package index/position and
`0xA3`/`0xA4`/`0xA5` proTypes; exact start/data/end sequencing is documented per split
(notably `MultipleControllerComm`/`V1`).

GATT UUIDs are family-specific; the common Govee pair is service
`00010203-0405-0607-0809-0a0b0c0d1910` / characteristic
`00010203-0405-0607-0809-0a0b0c0d2b11`. Exceptions (Nordic FFE0/FFE1, In-Store
`494E5445-…4857`/`…2011`, chart characteristics) are called out in the split docs.

## 3. IoT wire format

Commands are JSON strings built by `makeCmdStr(AbsCmd)`:

```json
{
  "msg": {
    "transaction": "<generated>",
    "accountTopic": "<iot account topic>",
    "type": 1,
    "origin": 32,
    "cmdVersion": 0,
    "cmd": "turn",
    "data": { "val": 1 }
  }
}
```

`type` = 1 for write, 0 for read/query. Incoming protocol variants `V0`/`V1`/`V2`
(`IotMsgProType`) wrap device state differently; splits declare which they parse.

Common actual commands: `online`, `turn`, `brightness`, `status`, `color`, `colorTem`,
`colorwc`, `mode`, `timer`, plus appliance commands (`workMode`, `oscillate`, `humidity`,
`temperature`, `iceSize`, `cook`, …).

`pt`, `ptReal`, `ptIot`, `multiSync` and `ptUrl` are **transport envelopes**, not command
names. `ptReal` payload is `{"command": ["<base64(20-byte BLE frame)>", ...]}`; the wrapped
BLE frame's semantic command (e.g. `timer write` with `iceSize`) is the real command. `op`
and `state` are read envelopes/keys. The catalogs keep envelope rows under **Transport
formats** so the command tables only show actual commands.

## 4. Family map

{family_table}

## 5. Cross-cutting command semantics

These patterns repeat across families; the per-split tables give the family-specific
variants and exceptions.

- **Power / switch**: `0x33/0x01`, payload `01` on / `00` off; read `0xAA/0x01` returns
  state in `[0]`. IoT: `turn` with `data.val` 0/1.
- **Brightness**: `0x33/0x04`, one byte, usually scaled into a per-SKU range
  (e.g. 20–254, 6–254, 1–100). IoT: `brightness` with `data.val`.
- **Colour**: `0x33/0x05` with sub-mode `0x02` (classic `02 R G B flag R2 G2 B2`),
  `0x0D` (newer RGB + colour-temp), or `0x15` (segmented colour with bitmask and
  per-segment brightness). Layout differs by family; see `EFFECTS.md`.
- **Colour temperature**: either the `flag`/`R2G2B2` fields of the colour sub-mode or a
  dedicated `0x15`/`0x0D` variant with a 16-bit Kelvin value.
- **Scenes**: `0x05` sub-mode `0x04`, usually `<effect LE16>` optionally followed by a
  music code; long scene blobs go through the multi-packet path.
- **DIY**: `0x05` sub-mode `0x0A` (select DIY code) or multi-DIY `0xA5/0x02`, `0xA3/0x04`
  for pixel uploads.
- **Music**: `0x05` sub-mode `0x03` (legacy: auto flag + sensitivity + optional RGB),
  `0x0E/0x0F/0x13` (newer multi-parameter music). Sensitivity is normally 0–99.
- **Direction / motion**: effect direction `0x16`, check direction `0x39`, calibration and
  installation direction vary by family (`0x13`, `0x15`, `0x30`, `0x42`, `0x44`).
- **Readings**: heart `0xAA/0x01`; sensor telemetry often arrives as unsolicited notify
  packets or BLE advertisements; IoT `status`/`devStatus` carries the cloud schema.
- **OTA**: `0xEE` prepare plus family-specific multi-packet transfer; details are partly in
  the base OTA library and are noted where the split exposes them.

## 6. Dynamic effects / motion

`EFFECTS.md` contains 352 effect/mode rows. The main families are:

- classic 8-byte colour (`0x02`) and 7/8/9-byte segmented colour (`0x0D`/`0x15`);
- scene selectors (`0x04`) with 8/16-bit effect IDs and optional music code;
- DIY selectors (`0x0A`) and multi-packet pixel/layer blobs (`0xA3`, `0xA5`);
- music/rhythm/mic (`0x03`, `0x0E`, `0x0F`, `0x13`) with sensitivity/style/auto flags;
- multi-layer, carousel, gradient, motion, splicing and segment-mask effect frames;
- named per-SKU effects (H70B1 music/motion set, H16B0/H607C music V2/V3, H601EF TLV
  sub-effects, laser/H6660 ILDA effect orders, etc.).

Where the actual effect catalogue is a server asset, the extraction records the selector
opcode and payload layout and explicitly marks the catalogue as runtime.

For addressable strips, the segment model is separated out in `SEGMENT-CONTROL.md`:
`15 01` sets a color on the masked segments, `15 02` sets one brightness on the masked
segments, `15 03` carries per-segment brightness (or a raw RGB list on some TV/outdoor
families), and `15 04` sets group/zone colors. Mask widths run from 1 byte (8 segments)
to 10 bytes (80-bit legacy bulb strings).

## 7. DreamView / HDMI settings and modes

The camera/HDMI side has its own command cluster that is easy to miss because it lives in
the shared `base2light.videomode` / `balckscreen` / `moviefeast` code rather than the
lighting `Comm` classes:

- **Video mode** — `0x33/0x05` sub-mode `0x00`; payload byte order differs by generation
  (tvlight v2/v4, H604x, H6104, H6099/H66A0/H6097/H2A40, H605B/H605D, H605C, H605A).
- **Shared `0xA9` settings** — sensitivity `01`, whole-RL brightness `02`, HDMI port `03`,
  AI action `04`, colour calibration `05`, white balance `00/06/0F`, black screen `0A`,
  black border `0B`, HDMI black screen `0C`, HDR calibration `0D`, saturation `0E`,
  AI filter `10`, HDR effect `11`, auto/check/exit WB `12/13/14`.
- **Other setting opcodes** — sound-effect mic `0xAC`, relative/segment brightness `0xAE`,
  audio source `0xB7`.
- **Metadata** — HDMI resolution and port-icon lists are REST (`/bff-app/v1/device-guide/configs`,
  `/bff-app/v1/hdmi-port/icons`), not BLE.
- **Movie Feast** — movie/music/scenes group types; on/off notify `0xEE/0x60`; saturation
  `0x33/0x60/0x09`, sensitivity `0xA9/01`, AI filter `0xA9/10`; group CRUD/snapshot REST.

Full payloads, per-SKU video-mode byte orders and the corrections applied: see
`DREAMVIEW-HDMI.md`.

## 8. Onboarding, WiFi provisioning and Matter

Adoption is a stateful flow layered on the normal BLE frame format:

- **Discovery** — 62-byte advert parsed into `BleBroadCastInfo{goodsType, pactType,
  protoType, flag}`; per-split `add/BleBroadcastProcessor*` and `GoodsType.parseBleBroadcastPactInfo`.
- **BLE pairing** — heart, secret key (`0xB1` read / `0xB2` write), WiFi MAC, versions,
  WiFi link start (`0x33/0x17`), WiFi function list (`0xAA/0x03`), IC/check IC, sync time.
- **WiFi credentials** — `MultipleWifiController` (`0xA1/0x11`, multi-packet) with
  length-prefixed SSID/password, run-mode/timezone/IoT version, optional API string and
  Matter/security extension. Legacy bulbs use SoftAP `Govee_bulb_<SKU>` + `192.168.1.1:7200`.
- **Bind/topic** — `device/rest/devices/v1/bind`, `.../appDeviceTopic`, `BindExt` metadata.
- **Matter** — gated by `AddDeviceConfig.isSupportMatter` + `MatterInterceptor`; BLE
  `0xAB/01..06` returns QR, base info, SSID, GID, Matter ID and pair code; REST
  `/matter/qrCode`, `/matter/upload-qrcode`, `/matter/check-upload-qrcode`,
  `/devices/matter-ids`. Control still uses the normal Govee frames.

Full details and exact framing: `ONBOARDING-NETWORK-MATTER.md`.

## 9. Status properties vs. commands vs. settings

Not every app-visible flag is an opcode. Three distinct kinds appear in the code and are
kept separate here:

- **Commands** — bytes/JSON the app sends (`COMMANDS.md`).
- **Readings** — numeric measurements the app parses from a status frame, notify packet or
  IoT `status`/`op` payload (`READINGS.md`).
- **Status properties** — booleans/enums the firmware or cloud computes and the app merely
  deserializes, often from the device-list/detail response or a per-family status bean.
  They have no dedicated opcode. `waterLack`, `iceFull`, `doorNotClosed`, `outerTankLow`
  are examples.
- **Settings** — user preferences that may be named after a condition but are not state.
  `waterShortageOnOff` means "notify me when water is short", not "water is short".
- **UI-derived** — presentation flags with no wire field. The humidifier's `tankEmpty` is
  only the string id `tv_water_tank_empty_remind`, derived from the water-level reading.

The carriers are, in order: cloud device list/detail (`*DeviceListStatus`, `LastData`,
deviceExt/thing-model status), per-family IoT status parsers (`CmdStatusParseV1`,
`ResultPt`), BLE status frames (`DeviceStatusNotifyParse` cmdType `0x40`, family `0x17`/
`0x19` parsers), and capability metadata (`pact/Ext`, support tables). See
`STATUS-PROPERTIES.md` for the per-property evidence, including the exact bit layout of
`H8131DeviceListStatus`.

## 10. Readings / sensors

`READINGS.md` covers 249 BLE notifications and 300 IoT command/status rows. Sensor
families worth noting:

- **TH / environment**: `thnew` — temperature/humidity at 0.01 units, PM2.5 0–999,
  CO2 0–5000, battery, comfort range, BLE broadcast formats.
- **BBQ probes**: `bbqnew` — 1–6 probe temperatures ×100, `0xFFFF` invalid, battery,
  alarm/connect masks, multiple heart dialects.
- **Leak**: `leaknew` — 3-probe leak bits, water-level mode, battery, mute, timestamp.
- **Motion/door/vibration/pressure**: `h512x` — presence, distance, duration, pressure.
- **Appliances**: humidifier (target humidity, tank %, clean timer), ice machine (ice
  count, NTC/water temp, remaining time), heaters (gear, target temp, over-temp flags),
  air purifiers (air quality, filter, timers), cookers/kettles (mode, progress, keep-warm).
- **Plugs**: switch masks, timers, kWh/V/A/W, power warnings, charts (`plugnew`, `tcsocket`).

## 11. Reliability and known gaps

- Decompilation is JADX output; a small number of methods are stubs/partially reconstructed.
  Those are flagged per split rather than guessed.
- Scene/DIY/music catalogues, pixel blobs and some calibration data are server assets or
  runtime capability data. Their **selector/framing** is captured; their **contents** are
  marked runtime.
- `pactType`/`pactCode` and `goodsType` are frequently assigned by the server product DB,
  not hard-coded; blanks mean "not statically declared in this module".
- Some families have version gates (firmware/WiFi/DSP) that enable extra commands or
  Matter; these are recorded in the split notes.
- `split_lib_recognition` is shared vision code and is not a device protocol module.

For source trails, every row in the split docs cites the Java file(s) it came from, relative
to `decompiled/`.
"""


def main():
    meta = ALL["meta"]
    mt = sum(1 for d in ALL["devices"] if "matter" in d["transports"].split("|"))
    narrative = NARRATIVE
    for token, value in (
        ("{skus}", meta["sku_rows"]),
        ("{ble}", meta["ble_command_rows"]),
        ("{notify}", meta["ble_notification_rows"]),
        ("{iot}", meta["iot_command_rows"]),
        ("{formats}", meta.get("format_rows", 0)),
        ("{fx}", meta["dynamic_effect_rows"]),
        ("{status}", meta.get("status_property_rows", 0)),
        ("{matter}", mt),
        ("{family_table}", family_table()),
    ):
        narrative = narrative.replace(token, str(value))

    with open(os.path.join(ROOT, "PROTOCOLS.md"), "w", encoding="utf-8") as fh:
        fh.write(narrative)

    with open(os.path.join(ROOT, "DEVICES.md"), "w", encoding="utf-8") as fh:
        fh.write(devices_md())
    with open(os.path.join(ROOT, "COMMANDS.md"), "w", encoding="utf-8") as fh:
        fh.write(commands_md())
    with open(os.path.join(ROOT, "EFFECTS.md"), "w", encoding="utf-8") as fh:
        fh.write(effects_md())
    with open(os.path.join(ROOT, "READINGS.md"), "w", encoding="utf-8") as fh:
        fh.write(readings_md())

    docs = split_docs()
    with open(os.path.join(ROOT, "STATUS-PROPERTIES.md"), encoding="utf-8") as fh:
        status_note = fh.read().strip()
    with open(os.path.join(ROOT, "DREAMVIEW-HDMI.md"), encoding="utf-8") as fh:
        dreamview_note = fh.read().strip()
    with open(os.path.join(ROOT, "ONBOARDING-NETWORK-MATTER.md"), encoding="utf-8") as fh:
        onboarding_note = fh.read().strip()
    with open(os.path.join(ROOT, "MISSING-DEVICES.md"), encoding="utf-8") as fh:
        missing_note = fh.read().strip()
    with open(os.path.join(ROOT, "SEGMENT-CONTROL.md"), encoding="utf-8") as fh:
        segment_note = fh.read().strip()
    parts = [narrative, "\n\n---\n\n", segment_note, "\n\n---\n\n", status_note,
             "\n\n---\n\n", dreamview_note, "\n\n---\n\n", onboarding_note,
             "\n\n---\n\n", missing_note,
             "\n\n---\n\n# Part II — Per-split deep dives\n"]
    for name, text in docs:
        parts.append(f"\n\n---\n\n<!-- {name} -->\n\n{text.strip()}\n")
    with open(os.path.join(ROOT, "PROTOCOLS-ALL.md"), "w", encoding="utf-8") as fh:
        fh.write("".join(parts))

    print("wrote PROTOCOLS.md, DEVICES.md, COMMANDS.md, EFFECTS.md, READINGS.md, PROTOCOLS-ALL.md")


if __name__ == "__main__":
    main()
