# Govee BLE / IoT device protocol collection

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
| SKU rows (SKU -> family -> transports) | 617 |
| BLE command rows (deduplicated per split) | 968 |
| BLE notification / reading rows | 249 |
| IoT command rows | 219 |
| Transport format rows (ptReal/multiSync/etc.) | 81 |
| Dynamic effect / mode-payload rows | 358 |
| Status properties catalogued | 10 |
| SKUs advertising Matter | 77 |

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

| Split module | Product family | SKUs | Transports present | BLE cmds | Notify | IoT cmds | Effects |
|---|---|---:|---|---:|---:|---:|---:|
| `split_pact_bbqnew` | BBQ thermometers / probes (H5055, H5181–H5199, H5610) | 14 | ble (14), iot (14) | 36 | 4 | 2 | 3 |
| `split_pact_bulblightstringv1` | bulb-string / bulb-light families | 42 | ble (40), iot (36), matter (1) | 27 | 5 | 13 | 16 |
| `split_pact_fanlight` | ceiling fan + light (H1310 / H1370) | 2 | ble (2), iot (2) | 20 | 7 | 5 | 9 |
| `split_pact_floorlamp` | floor lamps (H6071/H6075, H60B0/H60B3/R60B3, H60B1) | 6 | ble (6), iot (6), matter (4), wifi/mqtt (1) | 23 | 7 | 5 | 8 |
| `split_pact_h1161` | Govee Sync / pickup-box light controller (H1161) | 1 | ble (1) | 12 | 5 | 0 | 4 |
| `split_pact_h3a5x` | H3A51 / R3A51 / H3A52 / H3A53 branch light strings | 4 | ble (4), iot (4) | 10 | 4 | 4 | 6 |
| `split_pact_h512x` | sensors (motion, door/window, button, vibration, pressure, presence) | 9 | ble (9), ble-broadcast (9), iot (1) | 24 | 4 | 2 | 0 |
| `split_pact_h5901` | H5901 water timer / irrigation gateway | 1 | ble (1), iot (1) | 28 | 2 | 1 | 3 |
| `split_pact_h6047` | H6047 / H6043 / H6042 / H6039 / H6038 / H6048 TV light bars & strip | 7 | ble (7), iot (7) | 11 | 4 | 3 | 7 |
| `split_pact_h604a` | H604A/B/C/D bulb strings & camera-calibrated strip lights | 4 | ble (4), iot (4) | 21 | 6 | 7 | 5 |
| `split_pact_h6061` | H6061 cube / Glide family + H6067 Glide Tri/Y | 7 | ble (7), iot (7), matter (3) | 16 | 4 | 4 | 10 |
| `split_pact_h6062` | H6062/H606A strip, H610A, H610B light-wall strings | 4 | ble (4), iot (4) | 21 | 6 | 3 | 4 |
| `split_pact_h6079` | H6079 / H607C / H16B0 + H6020 sub-family | 9 | ble (9), iot (9), matter (4) | 16 | 6 | 4 | 10 |
| `split_pact_h6092` | H6092 / H6091 / H6093 / H6094 / H6095 / H609D / H7070 / H7071 / H7073 / R1810 / H1811 / H3860 / H1880 | 13 | ble (13), iot (13) | 8 | 6 | 3 | 7 |
| `split_pact_h6099` | H605B/H605C/H660x (HDMI sync) + H6098/H6099/H66Ax (TV backlight) | 18 | ble (18), iot (18), matter (10) | 46 | 8 | 14 | 21 |
| `split_pact_h60ax` | H60A0/H60A1/H60A4/H60A6/H60C1, H12xx, H1141 ceiling/wall lights | 13 | ble (13), iot (13) | 25 | 8 | 4 | 7 |
| `split_pact_h61d3` | neon rope / wall-lining / light-recognition family | 29 | ble (29), iot (29) | 22 | 6 | 3 | 6 |
| `split_pact_h6630` | gaming pixel light / sound-light bars (H6630, H8630, H6631) | 3 | ble (3), iot (3), matter (3) | 19 | 10 | 5 | 6 |
| `split_pact_h6660` | H6660 / H3810 laser engraver (LaserPecker-style) | 2 | ble (2), iot (2) | 8 | 6 | 1 | 4 |
| `split_pact_h682021` | H6820 / H6821 curtain lights (square/planar DIY) | 2 | ble (2), iot (2) | 6 | 2 | 4 | 7 |
| `split_pact_h6840` | H6840/H6841/H6842/H6843 + H6609 library family | 24 | ble (24), iot (24), matter (3) | 21 | 7 | 12 | 11 |
| `split_pact_h7050` | H7050/H70xx outdoor & string-light family | 53 | ble (53), iot (48), matter (13) | 11 | 3 | 5 | 10 |
| `split_pact_h705a` | ceiling lights, downlights, H706x/H805x bulb strings, H3401 | 24 | ble (24), iot (24), matter (5) | 13 | 5 | 3 | 7 |
| `split_pact_h7075` | downlights, floodlights, COB strips, wall washers, R3352 sensor lights | 15 | ble (15), iot (15), matter (2) | 25 | 8 | 4 | 7 |
| `split_pact_h70b1` | curtain / icicle / spliceable matrix lights (H70B1/B2/BC, H70B3-5, H6800/681x, H70B6/B8, H70D1-3) | 21 | ble (21), iot (21), matter (18), wifi/mqtt (2) | 23 | 7 | 4 | 19 |
| `split_pact_h7111` | H7111 / H7100 / H7105 / H7112 heaters, fans & thermometers | 9 | ble (9), iot (9) | 25 | 5 | 2 | 8 |
| `split_pact_h7120` | H7120…H7129 air purifiers | 7 | ble (7), iot (7), matter (3) | 22 | 8 | 3 | 0 |
| `split_pact_h7130` | GoveeLife heaters (H7130/H713A/H7131-H7139) | 15 | ble (15), iot (15) | 26 | 8 | 3 | 6 |
| `split_pact_h7170` | H7170 / H7171 / H717A / H7173 / H7175 kettles & coffee brewers | 5 | ble (5), iot (5) | 17 | 5 | 2 | 6 |
| `split_pact_h7172` | H7172 / H7178 / H717D ice maker & water dispenser | 3 | ble (3), iot (3) | 7 | 2 | 2 | 3 |
| `split_pact_h7180` | H7180 smart rice cooker / multi-mode cooker | 1 | ble (1), iot (1) | 11 | 8 | 2 | 7 |
| `split_pact_hollowlamp` | hollow lamps, straight floor lamps, table lamps, H6057 speaker lamp | 16 | ble (16), iot (15) | 57 | 6 | 5 | 14 |
| `split_pact_humidifier` | humidifiers, dehumidifiers and aroma diffusers (H7140…H7162) | 16 | ble (16), iot (16) | 23 | 2 | 3 | 9 |
| `split_pact_iceMachine` | ice makers / nugget ice (H8120, H8121, H8122, H8131, H8150) | 5 | ble (5), iot (5), matter (3) | 20 | 1 | 3 | 5 |
| `split_pact_leaknew` | leak / water sensors (H5058, H5059, H5830) | 3 | iot (3) | 8 | 3 | 2 | 2 |
| `split_pact_outdoorlight` | outdoor strips / pathway / garden / curtain (H7040, H7056, H7080, H7086) | 7 | ble (7), iot (2) | 16 | 6 | 3 | 15 |
| `split_pact_plugnew` | smart plugs (H5080 / H5082 / H5083 / H5085 / H5086 / H5089 / H5160 / H5161) | 8 | ble (8), iot (8), matter (2) | 37 | 9 | 6 | 6 |
| `split_pact_plugv1` | legacy WiFi plugs / switches (H5001, H5081, H7014) | 3 | iot (3) | 0 | 0 | 8 | 0 |
| `split_pact_rgbiclight` | RGBIC lighting protocol extract | 83 | ble (83), iot (15), matter (3) | 38 | 11 | 10 | 25 |
| `split_pact_rgblight` | BLE / IoT protocol extraction | 59 | ble (56), iot (38) | 43 | 1 | 15 | 19 |
| `split_pact_security_health` | security, baby monitor, scale, jump rope, health | 5 | ble (2), iot (3) | 4 | 3 | 20 | 4 |
| `split_pact_tcsocket` | H5770 temperature-control socket | 1 | ble (1), iot (1) | 31 | 16 | 2 | 4 |
| `split_pact_thnew` | temperature / humidity sensors (H5042 … H5310) | 34 | ble (30), iot (25), wifi (3) | 42 | 3 | 7 | 5 |
| `split_pact_tvlightv4` | TV backlights / camera DreamView (v2, v3, v4) | 7 | ble (7), iot (6) | 32 | 7 | 6 | 14 |
| `split_pfdv1` | bulb strings (H7001 / H7023 / H7024) | 3 | ble (3) | 17 | 5 | 0 | 9 |

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


---

# LED strip segment colors and per-segment brightness

This is the focused index for addressable-strip control: which byte selects which
segments, how per-segment color differs from per-segment brightness, and which families
use which layout.

All payloads are after the 20-byte BLE header and after the `0x05` mode command type
unless noted. The read form is `0xAA/0x05` with the same sub-mode as byte 0.

## 1. The three different "segment" operations

| Operation | What it does | Typical payload |
|---|---|---|
| **Segment color** | set one RGB/CT color on the segments selected by a bitmask | `15 01 R G B [kelvin] [R2 G2 B2] mask...` |
| **Group brightness** | set one brightness level on the segments selected by a bitmask | `15 02 brightness mask...` |
| **Per-segment brightness** | a list of brightness values, one per segment | `15 03 b0 b1 ... bN` |
| **Group color** | a color per group/zone (not per individual LED) | `15 04 group R G B ...` |
| **Realtime segment color** | music/mic pushes color per segment in a multi-frame stream | `A3 41 ...` / `33 83 R G B` |

Do not confuse a **mask** (which segments) with a **brightness list** (a value per
segment). Many families support both; some only support the mask form.

## 2. Standard `0x15` subtypes

`33 05 15 <subtype> ...`

| Subtype | Layout | Meaning |
|---|---|---|
| `01` | `01 R G B [kHi kLo R2 G2 B2] m0..mN` | one color (and optional color temperature + temp RGB) on the masked segments |
| `02` | `02 brightness m0..mN` | same brightness for all masked segments |
| `03` | `03 B0 B1 ... BN` | per-segment brightness list (some families use this for a raw RGB list) |
| `04` | `04 group R G B ...` | group/zone colors, typically 4 colors per packet |
| `05` | `05 R G B ... mask...` | multi-color block (H601EF advanced sub-effects) |
| `00` | `00 ...` | clear/op-type form on newer H6602/H6604 |

Mask bits are **LSB-first**: bit 0 = first segment, bit 7 = segment 7, then the next mask
byte. Unused high bits are written as zero. The mask width depends on the family: 1 byte
(up to 8 segments), 2 bytes (16), 3 bytes (24), 4 bytes (32), 5 bytes (40), up to 10
bytes (80) for legacy bulb strings.

Kelvin endianness is **not universal**: H6079/H6020 and some H60B1 variants use big-endian
`kHi kLo`; most other `0x15` families use little-endian `kLo kHi`. The exact source
class is cited in the per-family table below.

## 3. Legacy `0x0B` / `0x0D`

- `0B R G B maskLo maskHi ...` — older RGB + bitmask color, used by H6104, tvlightv2,
  rgbiclight V1, bulb strings (up to 80 bits = 10 mask bytes).
- `0D R G B kLo kHi R2 G2 B2` — single-group color/CT with no per-segment mask, used by
  H7040 and some car/home lights.
- `14 R G B CT_H CT_L R2 G2 B2 00 mask` — older straight-floor-lamp color with a mask.

## 4. Group/zonal reads and realtime pushes

| Command | Layout | Meaning |
|---|---|---|
| `0xAA/0xA5` | request `[groupIndex]`; reply `[idx][brightness][R][G][B] ×4` | read bulb/string color groups (17 valid bytes) |
| `0xA3/0x41` | `41 <musicEffect> <count> <R G B> ×count` | realtime segment colors, multi-packet |
| `0x33/0x83` | `83 R G B` | mic/realtime segment color |
| `0x33/0xAE` | `01 <4|6> v0 v1 v2 v3 [v4 v5]` | relative/segment brightness (4- or 6-segment model) |

## 5. Per-family segment capabilities

| Split / family | Segments | Color / mask | Per-segment brightness | Notes |
|---|---:|---|---|---|
| `h6079` H6079/H607C/H16B0 | 13/14/17 | `15 01` RGB + BE kelvin + temp RGB + 16-bit mask | `15 03 B0..Bn` (≤15) | group read `AA A5` |
| `h6079` H6020/H1741 | 8 | `15 01` RGB + BE kelvin + mask (7 bytes written, only m0 effective) | `15 03` | see h6079 split §4 |
| `rgbiclight` V1 / H6104 | 15 | `0B R G B m0 m1` | — | legacy 15-bit mask |
| `rgbiclight` V2/V3 | 6/7/8/15 | `15 01` RGB + LE kelvin + temp RGB + mask | `15 02` group, `15 03` raw RGB list | V2 brightness mask |
| `tvlightv2` | 15 | `0B` mask2; `15 01` mask0+mask8 | `15 02` / `15 03` | 12-byte form |
| `tvlightv3/v4` | 12 | `15 01` mask0/1 | `15 02` brightness, `15 03` raw RGB | 17-byte buffer |
| `h604a` | 24 | `15 01` mask2/3 | `15 02` | 24 bulbs, 14-bulb groups |
| `h6047` | 10/12/22/24 | `15 01` selected-segment mask; `15 02` group mask | group brightness | multi-frame `A3 V1` |
| `h6061` | 20/21/23/25/40/140 | `15 01` RGB + mask | `15 03` max 14 values/packet | 40-bit declared |
| `h6062` | 33 | `15 01` 5-byte mask | `15 03` 14 brightness bytes | H610A/B compact V2/V3 |
| `h6099` H605B/H605C | 24/14 | `15 01` mask2/3 | `15 02` | op-type 0..7 |
| `h6099` H6601/H6603 | 24 | `15 01` mask3 | `15 02` | 24-segment |
| `h6099` H6602/H6604 | 14 | `15 01` mask2, `15 00` clear | `15 02 bri mask2`, `15 03 group bri`, `15 04 group RGB` | op-type 0..7 |
| `h6099` H6608 | 30 | `15 01` mask3 | `15 02` | 30 segments |
| `h6099` H6099/H6097 | 14/24 | `15 01` mask2/3 | `15 02`, `15 03`, `15 04` | H6097 24 |
| `h61d3` | 32 | `15 01` mask4 | `15 02` brightness + mask | lighting-recognition family |
| `h6840` H6609 | 2/3-byte mask | `15 <opType>` | per-group brightness/RGB | opTypes 0,1,2,3,6,7 |
| `h7050` | 4/6-byte mask | `15 01` RGB + CT + mask | `15 03 bri0..briN` (0–100) | `15 02` color index |
| `h705a` | up to 40 | `15 01` 5-byte mask | `15 02` + group brightness | |
| `h7075` | up to 32 | `15 01` mask4 | `15 03` 14 brightness bytes | group RGB `15 04` |
| `h70b1` H70DX | 10 | `15 01` mask2 | `15 02` / `15 03` | H70B1/B2 use `0D` |
| `fanlight` H1310/H1370 | 9/14 | `15 01` 32-bit mask | group/per-segment RGB | color ring |
| `hollowlamp` | 3/7/8 | `0B`/`14`/`15` | `15 02` / `15 03` | straight floor lamp |
| `outdoorlight` H7040 | 1 group | `0D R G B CT R2 G2 B2` | — | no mask |
| `outdoorlight` H7056 | 8 | `15 01` mask0..3 | `15 02`, `15 03` | |
| `outdoorlight` H7080 | 4/8/6 | `15 01` mask0 | `15 02`, `15 03` raw | by goodsType |
| `outdoorlight` H7086 | 4 | `15 01` mask0..3 | `15 02` | |
| `pfdv1` H7001/H7023 | 24 | `08 m0 m1 m2 R G B 00` | — | 24-bit mask |
| `pfdv1` H7024 | 24 | `0B R G B m0 m1 m2 00` | — | RGB first |
| `h3a5x` | 32 | `15 01` 32-bit mask | `15 02`, `15 03` | graffiti pages/layers |
| `h60ax` | 14 groups | `15 <op>` | op 0 brightness, op 6 14-byte brightness group | op 7 4×RGB |
| `h601ef` | groups | `15 04 segIdx R G B ×4`, `15 05 count RGB...` | per-color piece | multi `A3/6E` |

## 6. Readback and segment metadata

- `0xAA/0x40` — IC / segment count and style (`ReadSegInfoController`, h3a5x) or IC count.
- `0xAA/0x41` — IC segment number (`IcSegmentNumController`).
- `0xAA/0xA5` — bulb/string color groups: `[idx][brightness][R][G][B] ×4`.
- `0xAA/0x05` — mode readback; `[0]` = sub-mode (`15` for extended color).
- `0xEE/0x40` — notify after segment/IC setting on some families.

## 7. Encoding rules and caveats

- Mask bits are **little-endian bit order** (bit 0 = segment 0); mask bytes are written
  low-to-high.
- A `15 02` packet sets **one brightness** for all segments in the mask. A `15 03` packet
  carries a **value per segment** (usually 14 values per packet, clamped to the physical
  count).
- `15 03` is overloaded: on tvlight/outdoor H7056/H7080 it is a **raw RGB list**, not
  brightness. Check the family table above.
- Long per-segment arrays are split across multiple `0xA3` V1 frames; the final frame
  carries the `0x05/0x15` mode frame. Chunk sizes differ per family.
- Masks wider than the physical segment count are zero-padded; some older firmware only
  honors the first mask byte (e.g. H6020/H1741).
- Kelvin byte order varies (BE for h6079/h6020; LE for most others). Always use the
  family's `SubModeColor*` class.
- `15 04` sets group/zone colors (4 RGB per packet), not per-LED colors. `15 01` with a
  mask is the per-segment color form.

## 8. Where the raw rows are

- Every layout above is in `EFFECTS.md` under the family name.
- The write/read commands and source paths are in `COMMANDS.md` and the per-split
  `splits/split_pact_*.md`.
- The canonical source classes are the family `ble/SubModeColor*.java`,
  `ble/Mode*.java`, `ble/ColorStrip*.java`, and base `SubMode4Color` / `Bytes` /
  `ColorModeControllerConfig`.

---

# Status properties vs. commands vs. settings

Not every app-visible flag is a BLE opcode or a command payload. Several names that look
like protocol fields are actually **status properties** received from the cloud/device-list,
parsed out of a status frame, derived by the UI, or **user settings** that merely happen to
be named after a condition.

This note pins down the ones that are easy to mis-file (`waterShortage`, `tankEmpty`,
`waterLack`, `iceFull`, …), with the exact carriers and source paths.

## Classification rule

| Suffix / shape | Kind | Example | Where it belongs |
|---|---|---|---|
| `...OnOff`, `...Enable`, `...Switch` | **Setting** (user preference / push toggle) | `waterShortageOnOff` | `pact/Ext`, REST setting request, IoT config — **not** a reading |
| State noun (`waterLack`, `iceFull`, `doorNotClosed`) | **Status flag** | `waterLack` | status frame parser, status bean, cloud device-list/status — **not** a BLE opcode |
| Numeric measurement (`waterVield`, `enduranceMinute`) | **Reading** | water tank level | BLE read opcode / IoT `status` field |
| `..._remind`, `tv_...` | **UI string / derived presentation** | `tv_water_tank_empty_remind` | UI layer, derived from a reading/status — not transmitted |

## Where status actually comes from

The app resolves status through one of four layers, in roughly this order:

1. **Cloud device list / detail / deviceExt / thing-model status.** The device-list response
   is deserialized straight into a `*DeviceListStatus` / `*Status` bean. No command builder
   is involved.
2. **Per-family status bean fed by an IoT `status`/`devStatus`/`op` message.** The generic
   `LastData` DTO (`com/govee/base2newth/deviceitem/LastData.java`) is the TH example
   (`tem`, `hum`, `pm`, `co2`, `signal`, `online`, `gwonline`, `lastTime`).
3. **BLE status/notify frame.** E.g. `DeviceStatusNotifyParse` (cmdType `0x40`, 10-byte
   payload) or a family parser (`CmdStatusParseV1`, `H8150Repository`).
4. **Capability metadata / SKU support tables.** Fields may be *declared* for a SKU even
   when the split has no dedicated parser; presence in `pact/Ext` or a support table is not
   proof of a wire field.

## Specific properties

### `waterShortageOnOff` — setting, not status

`waterShortageOnOff` is the **push-notification enable switch** for the water-shortage
condition. It is a user preference stored in the pact `Ext` object and updated through a
REST request. It is not a status reading and not a BLE opcode.

| Evidence | Path |
|---|---|
| REST request body `{sku, device, waterShortageOnOff}` | `jadx-splits/split_pact_humidifier/sources/com/govee/h7142/net/DeviceWaterShortageSwitchRequest.java` (also h7140/h7141/h7143/h7145) |
| Pact ext field | `jadx-splits/split_pact_humidifier/sources/com/govee/h7142/pact/Ext.java` (`private int waterShortageOnOff`) |
| Generic base bean | `jadx-base-7.7.10/sources/com/govee/base_h71xx/network/bean/WaterStorageOnOffInfo.java` |
| Ice-machine bind ext | `.../split_pact_iceMachine/sources/com/govee/ice/h8121/pact/H8121BindExt.java` and h8120/h8131/h8150 equivalents |
| H5901 settings ext | `.../split_pact_h5901/sources/com/govee/h5901/pact/Ext.java` |
| H7172 settings ext | `.../split_pact_h7172/sources/com/govee/h7172/pact/Ext.java` |

Reading it as "the device currently has no water" is wrong: value `1` means "notify me when
water is short", not "water is short".

### `waterLack` / `WATER_LACK` — status flag

`waterLack` is a **status bit/state code**, produced by firmware and delivered either in a
status frame or in the cloud device-list status. It has no dedicated command.

| Device | Carrier | Exact location |
|---|---|---|
| H8131 | `H8131DeviceListStatus` (device-list status bean) | `waterLack` = `bytes[2] & 0x01`; see `Companion.a(int[])` |
| H8150 | `H8150RunStateInfo` (run-state bean) | `isWaterLack` = flag byte bit 4 of the run-state frame (`0x19`), `[5] & 0x10` |
| H8120 | `H8120DeviceState` enum | `WATER_LACK` = code `3` in status frame `0x17` |
| H8121 | `H8121DeviceState` enum | `WATER_LACK` = code `6` in status frame `0x17` |
| Generic | `BleUtil.parseBleBroadTankState(scanRecord)` | BLE broadcast advert, returns `[valid, tankState]` |

Sources:

- `jadx-splits/split_pact_iceMachine/sources/com/govee/ice/h8131/bean/H8131DeviceListStatus.java`
- `.../h8150/bean/H8150RunStateInfo.java`, `.../h8150/bean/H8150State.java`
- `.../h8120/bean/H8120DeviceState.java`, `.../h8121/bean/H8121DeviceState.java`
- `jadx-base-7.7.10/sources/com/govee/base2home/pact/BleUtil.java` (`parseBleBroadTankState`)

The H8131 status bean is worth spelling out because it multiplexes a lot of flags into
three bytes (see `Companion.a(int[] bytes)`):

| Byte | Bits | Field |
|---|---|---|
| `bytes[0]` | bits 1–4 | `runState` (`((b0 & 0xFF) >> 1) & 0x0F`) |
| `bytes[0]` | bit 5 | `e2` |
| `bytes[0]` | bit 6 | `iceMakingInterrupted` |
| `bytes[0]` | bit 7 | `compressorTempHigh` |
| `bytes[1]` | bit 0 | `envTempHigh` |
| `bytes[1]` | bit 1 | `envTempLow` |
| `bytes[1]` | bit 2 | `waterTempHigh` |
| `bytes[1]` | bit 3 | `pumpAbort` |
| `bytes[1]` | bit 4 | `e1` |
| `bytes[1]` | bit 5 | `compressorStopProtection` |
| `bytes[1]` | bit 6 | `outerTankLow` |
| `bytes[1]` | bit 7 | `iceFull` |
| `bytes[2]` | bit 0 | `waterLack` |
| `bytes[2]` | bit 1 | `doorNotClosed` |
| `bytes[2]` | bit 2 | `doNotDisturb` |
| `bytes[2]` | bit 3 | `toClean` |
| `bytes[2]` | bit 4 | `cleanCompleteReminder` |
| `bytes[2]` | bit 5 | `lastCleanIncomplete` |
| `bytes[2]` | bit 6 | `midTankSensorStuck` |
| `bytes[2]` | bit 7 | `lowerTankWaterHigh` |

### `tankEmpty` — UI-derived, not a code property

There is **no `tankEmpty` field** in the decompiled code. The only match is the layout/string
id `tv_water_tank_empty_remind`, used by the humidifier header:

- `.../split_pact_humidifier/sources/com/govee/h7141/adjust/header/CurHeaderUI.java`
- `.../split_pact_humidifier/sources/com/govee/h7142/adjust/header/CurHeaderUI.java`
- `.../split_pact_humidifier/sources/com/govee/humidifier/R.java`
  (`tv_water_tank_empty_remind`)

The humidifier's actual water reading is `WaterBean`:

```java
// h7145/adjust/bean/WaterBean.java
private int waterVield;        // tank level, percent (LITTER_WATER = 10 -> 10% = 1 L on 10 L)
private int enduranceMinute;   // estimated remaining minutes
```

It is read by `WaterVieldController` (BLE cmdType `0x22` = 34) and by the IoT status parser
(`h7145/iot/CmdStatusParseV1`, frame cmd `34`). "Tank empty" is a UI condition derived from
that level/endurance (or a warning state), not a boolean sent by the device.

### Other flags in the same family

| Property | Kind | Carrier |
|---|---|---|
| `iceFull` | status | H8131 `bytes[1] & 0x80`; H8120 state code 2; H8121 state code 4 |
| `outerTankLow` | status | H8131 `bytes[1] & 0x40` |
| `lowerTankWaterHigh` | status | H8131 `bytes[2] & 0x80` |
| `midTankSensorStuck` | status | H8131 `bytes[2] & 0x40` |
| `doorNotClosed` / `isLidOpen` | status | H8131 `bytes[2] & 0x02`; H8150 run-state flag bit 7 |
| `doNotDisturb` | status | H8131 `bytes[2] & 0x04`; plus the shared `0x16` DND command |
| `toClean` | status | H8131 `bytes[2] & 0x08` |
| `waterTempHigh` | status | H8131 `bytes[1] & 0x04` |

## Grep recipes used to verify

```bash
base=/Users/tglenn/src/govee/decompiled/jadx-base-7.7.10/sources
splits=/Users/tglenn/src/govee/decompiled/jadx-splits

# status DTO / device-list models
grep -rn -i 'DeviceListStatus\|LastData\|DeviceExt\|devStatus' "$base" "$splits" --include='*.java' | head

# per-family status parsers
grep -rn -i 'CmdStatusParse\|StatusBean\|Abnormal\|Remind' "$splits" --include='*.java' | head

# the property itself
grep -rn -i 'waterShortage\|waterLack\|tankEmpty\|outerTankLow' "$base" "$splits" --include='*.java'

# capability / settings metadata
grep -rn -i 'waterShortageOnOff' "$splits" --include='*.java'
```

## What was changed in this collection

- `waterShortageOnOff` remains documented as a **setting** under each family's
  "other protocols / settings ext", with an explicit "not status" note.
- `waterLack` / `WATER_LACK` and the other ice-machine flags are documented under
  **readings/status** (`READINGS.md`, `splits/split_pact_iceMachine.md`), not in the BLE
  command tables.
- `tankEmpty` is documented here as a **UI-derived** condition; the real humidifier reading
  is `WaterBean.waterVield` / `enduranceMinute`.
- No `waterShortage` (bare) property exists in the app; only `waterShortageOnOff`.

---

# DreamView / HDMI settings and modes — coverage audit

This is the consolidated reference for the settings that sit *around* the lighting
commands: camera DreamView, HDMI sync boxes, video-mode parameters, HDR/saturation/AI
filter, black-screen, calibration, sound effects, and Movie Feast.

It also records what the first pass missed and the corrections applied to the per-split
docs.

## Executive summary

**Already covered (but scattered):**

- Basic HDMI port select, audio source, USB/light-install checks, camera position/check,
  box light effect (`split_pact_h6099.md`).
- DreamView video-mode payloads for TV backlights (`split_pact_tvlightv4.md` §5.5) and
  HDMI/H660x (`split_pact_h6099.md` §7.5), but only the inner `0x05/0x00` form and with
  some per-SKU byte orders missing.
- Movie-feast on/off notify (`0xEE/0x60`) across many lighting splits.

**Missed in the first pass (now documented here):**

- The shared **`0xA9` extended-settings namespace**: sensitivity, whole-RL brightness,
  colour calibration, white balance variants, black-border remove, HDR calibration,
  HDR effect/contrast, saturation, AI filter, auto/check/exit white-balance calibration.
- **Black screen** has two distinct forms: device black screen (`0xA9/0x0A`, 8 bytes)
  and HDMI black screen (`0xA9/0x0C`, 5 bytes with a 15–300 s duration). The first pass
  collapsed them into `0C 01 flag`.
- **AI action** is `0xA9/0x04` (not `08`); **colour calibration** is `0xA9/0x05`
  (not `07`); **audio source** is `0xB7` (not `0xA9/0x0D`).
- **Sound-effect mic selection** (`0x33/0xAC`) and **relative/segment brightness**
  (`0x33/0xAE`) are separate settings.
- Per-generation **DreamView video-mode byte order** (H605B/H605C/H2A40/H605A/H6097/
  H604x/H6104 are all different).
- **Movie Feast settings**: saturation (`0x33/0x60/0x09`), sensitivity (`0xA9/0x01`),
  AI filter (`0xA9/0x10`), plus the Movie/Music/Scenes feast types and REST endpoints.
- **HDMI metadata**: supported-resolution list and port-icon list are REST, not BLE.
- The `tvlightv4` doc used `0xAB` for white balance/brightness/black-border; the actual
  command type is **`0xA9`** (`getCommandType() == -87`). Corrected.

## 1. Shared `0xA9` extended-settings namespace

Frames are normal 20-byte BLE packets:

```
write: 33 A9 <subOp> <len> <data...> <BCC>
read : AA A9 <subOp> [<len>]          <BCC>
```

`AbsControllerNoEvent4Single.getProType()` returns `0x33` for write, `0xAA` for read.
`Controller4ExtBytes` / `AbsController` put the payload after the command type. For IoT
devices these frames travel in `ptReal` / `pt`.

| Setting | Write payload after `33 A9` | Read | Notes / source |
|---|---|---|---|
| White balance (classic) | `00 03 <auto?0:1> <R> <B>` | `00` | `WhiteBalanceVmInterface.getWhiteBalanceControllerNormal` |
| White balance (infinite progress) | `06 01 <progress>` | `06` | same; used when `supportWhiteBalanceInfiniteProgress()` |
| White balance (advanced) | `0F 03 <R> <G> <B>` | `0F` | `getWhiteBalanceControllerAdvanced` → `[2..5]` on read |
| Auto white balance (old) | `12` | — | `getWhiteBalanceControllerAutoOld` |
| Check white-balance calibration | — | `13` | `VideoCheckWbCaliController`; read `[2]==1` |
| Exit white-balance calibration | `14` | — | `VideoAutoWbController.makeExitCaliController()` |
| Sensitivity | `01 01 <value>` | `01` | `VideoSensitivityController`; parse `[2]` |
| Whole-RL / video brightness | `02 01 <value>` | `02` | `WholeRLBrightnessVmInterface` |
| HDMI port select | `03 01 <port>` | `03` | `Controller4Hdmi`; H605B/H660x |
| AI action | `04 01 <value>` | `04` | `AiActionController`; H605B |
| Colour calibration | `05 03 <R> <G> <B>` or `05 04 <R> <G> <B> <extra>` | `05` | `ColorCaliController` / `Controller4ColorCalibration`; read `[2..5]` |
| DSP version (not a setting) | — | `07` | `DspVersionController` |
| AI update status (read-only) | — | `09` | `AiUpdateStatusController` |
| Device black screen | `0A 06 <enable> <mode 1/2> <startLo> <startHi> <endLo> <endHi>` | `0A` | `balckscreen/controller/BlackScreenController`; H6099 |
| Black-border remove | `0B 01 <flag>` | `0B` | `BlackBorderRemoveController`; read `[2]==1` |
| HDMI black screen | `0C 03 <enable> <durationLo> <durationHi>` | `0C` | `balckscreen/hdmi/controller/BlackScreenHdmiController`; duration 15–300 s, default 30 |
| HDR calibration | `0D` | `0D` | `HDRCaliController` (write triggers calibration) |
| Saturation | `0E 01 <value>` | `0E` | `VideoSaturationController`; parse `[2]` |
| AI filter | `10 0F <enable> <R> <G> <B> <saturation> <codeLo> <codeHi> <autoCloseLo> <autoCloseHi> <timeLo> <timeHi> <tz0> <tz1> <tz2> <tz3>` | `10` | `AiFilterController`; 17-byte payload. Fields decoded from `AiFilterStatusBean`/`AiFilterViewModel`: enable, R/G/B, saturation, filter code LE16, auto-close minutes LE16, expiration time-of-day LE16, 4-byte timezone. |
| HDR effect / contrast | `11 02 <enable> <level>` | `11` | `VideoHdrEffectController`; read `[2]==1`, `[3]` |
| Black screen (HDMI old path) | see `0C` | `0C` | `BlackScreenHdmiController` |
| Sound-effect mic selection | `AC <micIndex>` (cmdType `0xAC`, not `A9`) | — | `SoundEffectVmInterface.updatePickMic` |
| Relative / segment brightness | `AE 01 <4|6> <v0> <v1> <v2> <v3> [<v4> <v5>]` | `AE 01` | `RelativeBrightnessController`; 4- or 6-segment form |
| Audio source (HDMI/device) | `B7 <0|1>` (cmdType `0xB7`) | — | `Controller4AudioFrom`; notify `0x32` reports source |

### `0x0A` vs `0x0C` black screen

- **`0x0A` device black screen** (H6099 and camera devices): 8 bytes.
  `0A 06 enable mode startLo startHi endLo endHi`. `mode` is 1 or 2; start/end are
  16-bit little-endian values from `BlackScreenBean`.
- **`0x0C` HDMI black screen** (HDMI boxes): 5 bytes.
  `0C 03 enable durationLo durationHi`; duration clamped to 15..300 seconds, default 30
  (`BlackScreenHdmiDefaultParams`). Read `0C` returns the same pair.

## 2. DreamView video mode (camera path)

The mode container is still `0x33/0x05`, sub-mode `0x00`:

```
33 05 00 <video-mode payload> <BCC>
```

Every family builds the payload through a `VideoVm` subclass and
`Controller4ExtBytes({5, 0, ...})`. The byte order is **not** the same across SKUs:

| Family / VM | Payload after `05` | Field order |
|---|---|---|
| tvlightv2 / tvlightv4 | `00 <screenState> <drama> <vivid> <voiceOn> <voice> <rlBrightness>` | `VideoVm.N` (7 bytes) |
| h604a H604x | `00 <voiceOn> <vivid> <screenState> <drama> <voice> <softness>` | `VideoVmH604x.N` (7 bytes) |
| h6104 | `00 00 <screenState> <vivid>` | `VideoVm.B` (4 bytes, minimal) |
| h6099 H6099 | `00 <drama> <part 8/9> <vivid> <voiceOn> 02 <voice>` | `VideoVm.N` |
| h6099 H66A0 | `00 <drama> <part> <vivid> <voiceOn> 02 <voice>` | `VideoVm.O` |
| h6099 H6097 / H605A | `00 <drama> <part> <vivid> <voiceOn> 02 <voice>` (H605A order differs: `... <softness> <voice>`) | `VideoVmH6097.N`, `VideoVmH605A.N` |
| h605b H2A40 | `00 <drama> <part> <vivid> <voiceOn> 02 <voice>` | `VideoVm.N` |
| h605b H605B/H605D | `00 <voiceOn> <vivid> <part> <drama> <voice> <softness>` | `VideoVm.O` |
| h605b H605C / default | `00 <screenState> <drama> <vivid> <voiceOn> <voice> 00 <seg1> <seg2> <seg3> <seg4> 00` | `VideoVm.P` (12 bytes; segment relative brightness) |

Field meanings (from `VideoModeControllerParams` and the split UI docs):

- `screenState` / `part`: 0 = part, 1 = all, 2 = full-screen; some HDMI paths use 8/9 as
  the part marker.
- `drama`: 0 = movie/drama, 1 = game.
- `vivid`: vividness, 1..100 (parsers clamp).
- `voiceOn`: 0/1.
- `voice`: voice/volume, 0..100.
- `softness`: 0..100.
- `rlBrightness`: whole relative-light brightness, 0..100.
- segment values: 4- or 6-segment relative brightness (`RelativeBrightnessBean`).

Read-back uses `Info4Detail.g0()`/`[0]=0x00` and `VideoModeControllerParams` from the
sub-mode bytes; older `SubModeVideo*` classes parse the same layouts.

> Note: the `SubModeVideo*` names in `split_pact_h6099.md` §7.5 are the legacy parsers;
> the live write path is the `VideoVm` table above. Both are included in the collection.

## 3. HDMI-specific settings and metadata

### 3.1 BLE settings

| Feature | Op / payload | Source |
|---|---|---|
| HDMI port select | `0xA9/03` read; write `03 01 <port>` | `pact_h605b/ble/controller/compose/Controller4Hdmi.java` |
| Audio source (HDMI vs device) | `0xB7 <0|1>`; notify `0x32` `[0]==1` → HDMI else DEVICE | `Controller4AudioFrom`, `SoundSourceNotifyParse` |
| AI action / AI gaming | `0xA9/04` read; write `04 01 <value>` | `AiActionController` |
| AI update status | read `0xA9/09` | `AiUpdateStatusController` |
| HDMI box light effect | `0xB6 <on> <effectIdx> <!dynamic?1:0> <speed>` | `ControllerBoxEffect` |
| HDMI black screen | `0xA9/0C 03 <enable> <durationLo> <durationHi>`; read `0C` | `BlackScreenHdmiController` |
| Device black screen | `0xA9/0A 06 ...` (see above) | `pact_h6099/.../BlackScreenController` |
| HDMI port + presence notify | notify `0x30`: `[0]=3` port + bitfield; `[0]=1` light-bar bits; `[0]=8` AI model id LE16 | `LightAndHdmiNotifyParse` |
| Sound source notify | notify `0x32`: `[0]==1` HDMI | `SoundSourceNotifyParse` |
| USB check / state | `0x33/0x38`, `0x33/0x37` | `UsbCheckController`, `UsbCheckStateController` |
| Check light install / exit | `0xAA/0xAA`, `0x33/0xAF` | `CheckLightController`, `ExitCheckLightController` |
| Camera position / check | `0x33/0x31`, `0x33/0x32` | `CameraPosController`, `CheckCameraController` |

### 3.2 REST metadata (not BLE)

| Item | Endpoint / model | Notes |
|---|---|---|
| Supported HDMI resolutions | `GET /bff-app/v1/device-guide/configs?sku=` → `HdmiResolutionResponse{resolutions:[{resolution,rate}]}` | Server-provided list; no device command. |
| HDMI port icons | `GET /bff-app/v1/hdmi-port/icons?sku=&device=`, `POST /bff-app/v1/hdmi-port/icons` | `Response4HdmiIconList{hdmiPortIconId, portIcons:[{port,iconId}]}`; `Request4UpdateHdmiIconList{hdmiPortIconId,sku,device,portIcons}`. |
| Camera calibration | `GET/POST appco/v1/calibration/point`, `POST bi/rest/v1/calibrationPoints`, `POST /bff-app/v1/axin/user-cali` | Points/ROI; see h6099 split doc. |
| Snapshot command (Movie Feast) | `POST /bff-app/v1/feast/snapshot/cmd-refactor` | `SnapshotCmdService`. |

## 4. Movie Feast (DreamView group modes)

`FeastType` defines three DreamView group types:

| Type | id | icon | Notes |
|---|---:|---|---|
| Movie | 0 | `new_dreamview_icon_movie` | movie sync |
| Music | 1 | `new_dreamview_icon_music` | music sync |
| Scenes | 2 | `new_dreamview_icon_scenic` | scene sync |

Settings/commands:

| Feature | Op / payload | Source |
|---|---|---|
| Movie Feast on/off notify | notify `0xEE/0x60`: `[0]==1`, `[1]` on/off | base `MovieFeastOnOffNotifyParse` |
| Saturation | `0x33/0x60/0x09 <value>` (module frame: proType `0x33`, module `0x60`, command `0x09`) | `MovieSaturationController` |
| Sensitivity | `0xA9/01 01 <value>` / read `01` | `MovieSensitivityController` / `VideoSensitivityController` |
| AI filter | `0xA9/10 0F ...` / read `10` | `MovieAiFilterController` / `AiFilterController` |

### 4.1 Movie Feast REST endpoints

| Operation | Method + path | Request / response |
|---|---|---|
| Create feast | `POST /appsku/v1/moment/feasts` | `FeastAddRequest{device,name,sku,needAddCard=1,nameCount,musicFeast}` |
| Delete feast | `DELETE /appsku/v1/moment/feasts` | `FeastDeleteRequest{gId,name}` |
| Rename feast | `PUT /appsku/v1/moment/feasts/names` | `FeastEditNameRequest{name,gId}` |
| Detail | `GET /bff-app/v1/moment/feasts/details` | feast detail response |
| Main device | `GET /bff-app/v1/moment/feasts/main-devices` | main-device response |
| Sub-devices | `GET /bff-app/v1/moment/feasts/sub-devices` | `FeastSubDeviceRequest{gId,mark}` / device list |
| Region / areas | `POST /appsku/v1/moment/feasts/region` | `FeastRegionRequest{gId,deviceAreaConfigs:[{sku,device,areaConfigs[],switchConfigs[],extStr}]}` |
| Music feast categories | `GET /bff-app/v1/scene/music-feast` | category list |
| Music feast effect | `POST /bff-app/v1/scene/music-feast/effect` | effect detail |
| Music feast voice | `PUT /bff-app/v1/music-feast/voice`, `PUT /bff-app/v1/music-feast/voice/btn` | voice edit / toggle |
| Scene feast create | `POST /bff-app/v1/scene-feast` | scene-feast body |
| Scene feast control | `POST /bff-app/v1/scene-feast/iot-control` | control body |
| Scene feast devices | `GET /bff-app/v1/scene-feast/devices` | device list |
| Scene feast edit device/name/voice | `PUT /bff-app/v1/scene-feast/device`, `/name`, `/voice`, `/voice/btn` | edit bodies |
| Mute | `POST /bff-app/v1/feast/mute` | mute request |
| Snapshot command | `POST /bff-app/v1/feast/snapshot/cmd-refactor` | `SnapshotCmdRequest{feastId,feastType,mainSku,mainDevice,mainVersionHard,mainGoodsType,mainPactType,mainPactCode,newSubDevices[],oldSubDevices[]}` |

Sources: `com/govee/home/main/device/moment/net/IMomentNet.java`,
`.../net/request/Feast*Request.java`, `com/govee/home/compose/feast/SnapshotCmdService.java`. The
recent-app screenshot/streaming pipeline itself is not a protocol module.

## 5. Corrections applied to earlier split docs

- `split_pact_tvlightv4.md`:
  - `0xAB/0x00` white balance → **`0xA9/0x00`** (classic) or `0xA9/0x06/0x0F` variants.
  - `0xAB/0x02` whole-RL brightness → **`0xA9/0x02`**.
  - `0xAB/0x0B` black-border remove → **`0xA9/0x0B`**.
  - Timer line `0xAB/0x23`, `0xAA/0x11`, `0xAA/0x12` → correct write/read forms:
    timer `0x33/0x23` (read `0xAA/0x23`), sleep/wake `0x33/0x11`/`0x33/0x12`.
- `split_pact_h6099.md`:
  - `0xA9` table rebuilt (see §1). `07` is DSP version read, `09` AI update status,
    `0A` device black screen, `0C` HDMI black screen, `0D` HDR calibration, `0E`
    saturation, `0F` advanced white balance, `10` AI filter, `11` HDR effect, `12`
    auto WB, `13` check WB, `14` exit calibration.
  - `08` colour calibration/AI action corrected: colour calibration is `05`, AI action
    is `04`.
  - Audio source is `0xB7`, not `0xA9/0x0D`.
- `split_pact_h6099.md` §7.5 and `split_pact_tvlightv4.md` §5.5 now point at the
  per-SKU `VideoVm` byte-order table in §2.

## 6. Source map

- Shared video settings: `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/videomode/newdetail/`
  - `controller/` — `VideoSensitivityController`, `VideoSaturationController`,
    `VideoHdrEffectController`, `VideoAutoWbController`, `VideoCheckWbCaliController`,
    `HDRCaliController`, `AiFilterController`, `ColorCaliController`
  - `funtion/` — `WhiteBalanceVmInterface`, `WholeRLBrightnessVmInterface`,
    `RLBrightnessVmInterface`, `BlackBorderVmInterface`, `SaturationVmInterface`,
    `HDRVmInterface`, `HDRContrastVmInterface`, `AiFilterVmInterface`,
    `ColorCaliVmInterface`, `SoundEffectVmInterface`
  - `data/VideoModeControllerParams.java`, `data/VideoModeParams.java`
- Black screen: `base2light/balckscreen/` (`BlackScreenController`, `BlackScreenHdmiController`,
  `BlackScreenBean`, `BlackScreenHdmiBean`, `BlackScreenHdmiDefaultParams`)
- Relative brightness: `base2light/relativebrightness/controller/RelativeBrightnessController.java`
- HDMI metadata: `pact_h605b/add/net/hdmi/HdmiApi.java`, `HdmiResolutionBean/Response`,
  `com/govee/kt/HdmiIconVM.java`, `com/govee/kt/net/INet.java`
- Movie Feast: `com/govee/home/main/device/moment/moviefeast/`,
  `com/govee/home/main/device/moment/feastcreate/bean/FeastType.java`,
  `com/govee/home/compose/feast/SnapshotCmdService.java`
- Per-SKU video VMs: `pact_tvlightv4/detail/mode/VideoVm.java`,
  `pact_h6099/{detail,pact_h605b,adjust}/.../VideoVm*.java`,
  `split_pact_h604a/.../VideoVmH604x.java`,
  `split_pact_rgblight/.../h6104/newdetail/viewmodel/VideoVm.java`

## 7. Per-SKU / firmware support gates

These are the `Support.*` checks that decide whether a setting is exposed. Version
arguments are `(soft, wifiSoft, dsp, hard)` unless noted; `pactV*` means the runtime
protocol tuple enables it regardless of version.

### 7.1 HDMI / H605B / H660x / H6099 family

| SKU / goodsType | Black screen + border | White balance | Segment rel. brightness | HDR / HDR contrast | Notes |
|---|---|---|---|---|---|
| H605B / H605D (82) | `supportBlackScreenH605BCD`: WiFi `3.02.01`, soft ≥ `1.03.01`, hard == `1.03.10`, DSP ≥ `1.00.13` | soft ≥ `1.01.08`, WiFi ≥ `3.02.01`, DSP ≥ `1.00.08`, hard ≥ `1.03.10` | same gate as black screen | no | HDMI 3-port |
| H605C (120) | H605BCD gate, hard ≥ `1.00.08` | yes | soft ≥ `1.00.12`, hard ≥ `1.00.08` | no | HDMI 4-port |
| H2A40 (360) | yes | yes | yes | no | HDMI 2.1 |
| H6601 (138) | soft ≥ `1.00.38`, WiFi == `2.01.01` | yes | WiFi == `3.04.01`, soft ≥ `1.00.23` | no | color cali soft ≥ `1.00.16` |
| H6602 (142) | soft ≥ `1.00.38`, WiFi == `2.01.01` | yes | WiFi ∈ {`3.04.12`,`3.04.13`,`3.04.14`}, soft ≥ `1.00.24` | no | color cali yes |
| H6603 (192) | soft ≥ `1.00.04`, WiFi == `2.01.11` | yes | yes | WiFi ≥ `2.02.11`, DSP == `2.01.11` | color cali yes |
| H6604 (243) | yes | yes | yes | WiFi ≥ `2.02.11`, DSP == `2.01.11` | color cali yes |
| H6608 (172) | no | yes | no | no | TV strip |
| H6099 (191/253) | yes; border only if soft ≥ `1.00.11` | yes | yes | no | H6099/H605A share 253 |
| H6098 (203) / H6097 (273) / H6690 (336) | yes | yes | yes | no | border yes |
| H66A0 (327) | yes | yes | yes | `supportHdrContrast` true | auto WB; check WB if soft ≥ `1.01.16` |

`supportAiFilter` is **not** goodsType-coded: it comes from
`Config4DeiceFuc.supportAiFilter()` (per-device capability config). Same for some HDR/
saturation gates in other families.

### 7.2 TV backlights (tvlightv2/v3/v4)

| Feature | Gate |
|---|---|
| White balance | `supportWhiteBalance`: hard starts `1.08.11`, WiFi ≥ `3.02.01`, DSP ≥ `1.00.23`, and `d(hard)` true |
| Whole-RL brightness (FRK) | soft ≥ `1.09.11`, WiFi ≥ `3.02.01`, DSP ≥ `1.00.29`; hard ≥ `1.00.01` if hard starts `1.00`, else ≥ `1.03.00` |
| Whole-RL brightness (TL) | soft ≥ `H`, WiFi ≥ `1.00.00`, DSP ≥ `1.00.28`, hard ≥ `1.00.01` |
| Whole-RL brightness (H6049) | soft ≥ `1.09.11`, WiFi ≥ `3.02.01`, DSP ≥ `1.00.29`, hard ≥ `1.03.00` |
| Segmented colour H6054 / H6049 | soft/WiFi/DSP gates (`supportFenduanse4H6054`, `supportFenduanse4H6049`) |
| AI effect | `supportAiEffect`: pactV3, or soft ≥ `1.06.01` (Telink) / `1.07.01` (FRK) |
| Video sound scenes | `supportVideoSoundAndServiceScenes`: pactV3, or soft ≥ `1.06.01` (Telink) / `1.07.01` (FRK) |

### 7.3 Other DreamView families

| Family | Gate |
|---|---|
| H604A/H604C (95/122, `isH604aType`) | black screen + border yes; segment relative brightness yes; video brightness soft ≥ `1.00.05`, hard ≥ `1.03.20` |
| H604B/H604D (109/133, `isH604bType`) | black screen + border yes; segment relative brightness yes; video brightness same gate |
| H6104 | only the minimal `05 00 00 <screenState> <vivid>` video form; no shared video settings UI |
| H6609/H6250 (h6840) | uses the shared `VideoModeParams`/`0xA9` path; HDR/saturation/AI-filter gates are UI/`Support`-driven and not fully enumerated here |

## 8. Gaps / runtime data

- Support gates (`Support.supportHDR`, `supportSaturation`, `supportBlackScreen`,
  `supportBorderRemove`, `supportVideoBrightness`, `supportAdvancedWhiteBalance`, …) decide
  which SKUs expose each setting. They are version/SKU-dependent; not every family has all
  of them.
- HDMI resolution and icon lists are server-provided; only the models/endpoints are static.
- AI filter fields are decoded from `AiFilterStatusBean`/`AiFilterViewModel` (enable,
  R/G/B, saturation, filter code, auto-close minutes, expiration time-of-day, timezone);
  the timezone encoding is still a raw 4-byte blob.
- Movie Feast group CRUD/snapshot endpoints and core request fields are now catalogued in
  §4.1; nested response schemas (device/area lists) are still server-owned.
- `0xA9` sub-op semantics can collide by design (`05` video mode vs `05` colour
  calibration vs `05 04` extra), distinguished by the sub-type byte.

---

# Device adoption, network setup and Matter

This is the consolidated reference for how a Govee device gets from "advertisement in the
BLE scan" to "bound to an account and controllable", including the BLE pairing commands,
WiFi credential provisioning (BLE and SoftAP), cloud bind/topic acquisition, and Matter
commissioning.

It complements the command/reading catalogs: adoption commands are mostly ordinary BLE
frames, but they are *stateful* and order-sensitive, so they are collected here rather
than mixed into the effect tables.

## 1. End-to-end flow

```
scan -> parse advert -> connect (GATT) -> heart/power -> secret key -> device info/IC
     -> WiFi link start -> send SSID/password -> device joins WiFi
     -> cloud bind -> device topic -> normal BLE/IoT control
     -> optional: Matter commissioning (QR/manual code -> Matter SDK -> GID/Matter ID/SSID)
```

There are two provisioning families:

- **BLE provisioning** (most WiFi-capable devices): credentials are written over GATT in a
  multi-packet `0x11` command.
- **SoftAP provisioning** (legacy bulbs H6003/H6004 and some H6085/H6086/H6089):
  the phone joins the device's AP and posts JSON over HTTP.

Matter is an *additional* commissioning path. After commissioning, control usually still
travels over the normal Govee BLE/IoT frames; the split modules contain no Matter
cluster/attribute tables.

## 2. BLE discovery and advertisement parsing

The base scanner hands a **62-byte scan record** to
`com.govee.base2home.pact.BleUtil.parseBleBroadcastPact(...)` (and variants). It walks AD
structures and looks for a manufacturer-specific (`0xFF`) block with the Govee company ID.

Result model — `BleBroadCastInfo(result, goodsType, pactType, protoType, flag)`:

| Field | Meaning |
|---|---|
| `result` / `a()` | 1 = valid Govee advert, 0 = not matched |
| `goodsType` / `b()` | product goods type (server product DB key) |
| `pactType` / `c()` | protocol family |
| `protoType` / `d()` | packet/protocol revision from the low nibble |
| `flag` / `e()` | bit 6 of the protocol byte (distribution/pairing flag) |

`parseBleBroadcastPact` layout (base `BleUtil`):

```
[AD len][0xFF][protoByte][companyLo][companyHi][goodsTypeLo][goodsTypeHi][pactType]
                 |            company id      |            |
                 | bit6 = flag               | goodsType LE16
                 | low nibble = protoType
```

Important variants:

| Parser | Use |
|---|---|
| `parseBleBroadcastPact` | generic lighting/appliance pairing advert |
| `parseBleBroadcastPact4Th` | TH sensors (temperature/humidity) |
| `parseBleBroadcastPact4MultiTh` | multi-probe TH |
| `parseBleBroadcastPactBbqV1` | BBQ probes |
| `parseBleBroadTankState` | leak/tank sensors (`[valid, state]`) |
| `parseBleBroadVersion` | advert protocol version |

Per-split adoption code lives in `add/BleBroadcastProcessor*.java`,
`pact/DeviceItem` (`Y(scanRecord)`), `pact/Support`, and `GoodsType.parseBleBroadcastPactInfo`.
Examples of exact advert prefixes are recorded in the per-split docs (e.g. BBQ
`020106030351xx17ff…`, `0201060303505517ff…`, `0201060303561017ff…`).

## 3. BLE adoption / pairing commands

These are sent after connecting, before the device is bound. Exact opcodes vary by family;
the table gives the base forms and the family-specific aliases seen in the splits.

| Purpose | Op / payload | Notes |
|---|---|---|
| Heart / power on | `0x33/0x01` payload `01` | some families use `0x01` as heart only |
| Heart read | `0xAA/0x01` | `[0] != 0` = alive |
| Device info | `0xAA/0x07` | base `BasicInfoController` |
| Soft version | `0xAA/0x06` | `SoftVersionController` |
| Hard / DSP version | `0xAA/0x0B` / `0xAA/0x07` (family) | e.g. `HardVersionController`, `DspVersionController` |
| WiFi MAC | `0xAA/0x14` (family aliases `0x10`, `0x0F`, `0x20`) | 6-byte MAC, reversed |
| Secret key read | `0xAA/0xB1` (default read cmdType -79) | response `[0]==1` + 8-byte key → base64 |
| Secret key write | `0x33/0xB2` (default write cmdType -78) | payload = base64-decoded key |
| WiFi link start | `0x33/0x17` payload `01` start / `00` stop | `WifiLinkStarController` |
| WiFi function list | `0xAA/0x03` | multi-packet reply; TLV, see below |
| IC number / segment count | `0xAA/0x40` | `IcNumController` |
| Check IC / segment | `0x33/0x42`, `0x33/0x43` | `CheckICAmountController` |
| Check light install | `0xAA/0xAA` | H605B/H660x |
| Check camera | `0xAA/0x32` | TV/DreamView |
| Sync time | `0x33/0x09` | `SyncTimeController` |
| WiFi connected notify | notify `0x11`, `[0]==0` | `WifiNotifyParse` |
| Remote/accessory pair | `0x33/0xA4`, exit `0xA6` | not device adoption; accessory pairing |

### WiFi function list (`0xAA/0x03`)

The device reports a TLV list parsed by `com.govee.util.WifiFuncListParse`:

```
[count]
  [type=1][len][funcId ...]          # common WiFi functions
  [type=2][len=3][pactTypeLo][pactTypeHi][pactCode]
```

Mapped to `WifiFuncBean{commonFuncList, specialSkuWifiPact}` and to JSON:

```json
{"wifiFuncList":[
  {"type":1,"subType":[1,2,3]},
  {"type":2,"subType":{"wifiPactType":1,"wifiPactCode":1}}
]}
```

`MtPairProtocol.supportMatter4WifiFuncBean(...)` uses this same list to decide whether the
device exposes a Matter WiFi function.

## 4. WiFi credential provisioning

### 4.1 BLE path

The credentials are sent with `MultipleWifiController` (multi-packet):

| Item | Value |
|---|---|
| proType | write `0xA1` (`-95`), read `0xA2` (`-94`) — `AbsMultipleController` |
| cmdType | `0x11` (17) |
| framing | multi-packet, `[2]` package index, 20 bytes/packet, XOR BCC |
| payload | `ssidLen ssid pwdLen pwd runModeV tzOffset iotVersion tzMinute [apiLenHi apiLenLo api...] [ext...]` |

- SSID/password are UTF-8 with a one-byte length prefix.
- `runModeV` selects run-mode V0/V1; `tzOffset`/`tzMinute` are timezone; `iotVersion` is
  the IoT protocol version.
- Optional API string block: 2-byte big-endian length + bytes.
- Optional extension for Matter/security:
  - `noDynamicApi`: `[00 00 <matterPairWifi && useMatterWifi ? 1 : 0> <securityType>]`
  - otherwise: `[<matterPairWifi && useMatterWifi ? 1 : 0> <securityType>]`
  (`MultipleWifiController.x()` / `y()`).

Flow/UI: `AbsBleWifiChooseActivity` (`com.govee.base2light.ac`) selects WiFi, writes the
secret key, starts WiFi link, sends the credentials, and waits for `EventMultipleWifi` /
`0x11` notify. Device name is set via `BleDeviceNameAc` / `BleDeviceNameAcV1`.
WiFi input limits are per-SKU (`Support.getWifiInputLimit`, usually 32 or 64 bytes).

### 4.2 SoftAP path (legacy bulbs)

Used by H6003/H6004 and the H6085/H6086/H6089 bulb AP flow:

- Device AP SSID prefix `Govee_bulb_<SKU>`.
- Phone joins it; device HTTP server is `192.168.1.1:7200`.
- JSON `BaseRequest`/`BaseResponse`:
  - type 1 = read device info
  - type 2 = send `WifiApInfo`
- Then `CheckDeviceWifiRequest` → `DeviceBindRequest` → `DeviceTopicRequest` to bootstrap
  the cloud binding/topic.

### 4.3 Cloud bind / topic

After the device joins WiFi, the app binds it and obtains the IoT topic:

| Purpose | Path / model |
|---|---|
| Bind device | `device/rest/devices/v1/bind` |
| Get account/device topic | `device/rest/devices/v1/appDeviceTopic` |
| Common pair/name/normal-WiFi pages | `/base2light/common/pair`, `/name`, `/NormalWifi` |
| Bind metadata | `BindExt{address,bleName,deviceName,dspVersionSoft,pactType,pactCode,secretCode}` (families add `topic`, `wifiMac`, WiFi versions) |

The IoT topic is then used by `Iot`/`IotManager` for normal cloud control. Local MQTT/LAN
is only used when `DeviceCommCapability.supportMqtt(sku,device,topic)` is true.

### 4.4 UDP multicast LAN (integration-observed)

The integration uses a **UDP multicast LAN transport to `239.255.255.250:4001–4003`**.
This is **not present in the decompiled Govee Home app** (no `239.255.255.250`/`4001`/
`4003`/multicast send code was found in the base or split modules); the app uses cloud MQTT
and, for some devices, local MQTT/WiFi. It is recorded here as an external/integration
path for completeness.

What is known from the integration: multicast group `239.255.255.250`, ports `4001–4003`.
The packet layout, discovery/control split and device responses are **not derivable from
this APK**; capture them from the integration or the device's LAN traffic before treating
them as authoritative.

### 4.5 Gateways and sub-devices

Gateways (`base2newth`, H5044/H5901) use the same GATT pair and a gateway-specific bind
flow (`GwsCanBind`, `GatewayInfo`, `H5901PairBle`). Sub-devices are then bound through the
gateway (`0x08` sub-device frames; see the leak/TH/gateway split docs), not with their own
WiFi credentials.

## 5. Matter setup

### 5.1 Support gating

Matter availability is decided by:

```java
AddDeviceConfig.isSupportMatter(goodsType, sku, softVersion, hardVersion,
                                wifiSoftVersion, wifiHardVersion)
```

which checks hard-coded SKU/version gates and then iterates registered
`MatterInterceptor`s (`isSupportMatterNullable`). Examples:

| SKU / goodsType | Gate |
|---|---|
| H61E0/H61E1 (123) | soft ≥ `3.00.33`, hard `3.01.01`, WiFi soft ≥ `1.01.06`, WiFi hard `1.04.01` |
| H61B5 (123) | soft ≥ `1.01.04`, hard `3.05.00`, WiFi soft ≥ `1.06.12`, WiFi hard `1.04.01` |
| H80B5 (123) | always true |
| H60B0/H60B1 (301/300) | `MatterInterceptor` in `ConfigH60B0` / `AddDeviceM` |
| H6079/H607C/H16B0 | `Support.supportMatterFunc` + `H607CMatterHelper` version gates |
| H6063/H606A/H6069 | `Support.supportMatterFunc` + `H6063MatterHelper` |

`MtPairProtocol.supportMatter(...)` wraps this; `supportMatter4WifiFuncBean(...)` checks the
device's WiFi function list (`WifiFuncListGlobalAPI.isSupportMatter`). 77 SKUs advertise
Matter in the collection.

### 5.2 Matter BLE protocol

Matter provisioning uses the standard Govee GATT pair (`…1910` service, `…2b11`
characteristic), proType **`0xAB`** (`-85`), read-only controllers
(`com.govee.matter.pact.AbsMtReadController`).

Frames are 20 bytes; multi-packet responses:

```
start:  AB 00 <totalLenLo> <totalLenHi> <chunkLen> 00 <data...>
data :  AB <index> <data...>
final:  AB FF <last data...>
```

`AbsMtReadController.v() = 17`, `w() = 6` (17 data bytes from offset 6).

| subOp (payload byte 0) | Controller | Returns |
|---|---|---|
| `01` | `Controller4QrCode` | Matter QR code string |
| `02` | `Controller4BaseInfo` | `isSupportMatter`, `hasPairNet`, `hasAddedEcology` (3 bytes) |
| `03` | `Controller4WifiSsid` | provisioned WiFi SSID string |
| `04` | `Controller4Gid` | GID string (or safe-bind result) |
| `05` | `Controller4MatterId` | Matter ID string |
| `06` | `Controller4PairCode` | manual pairing code string |
| cmdType `0x03` | `Controller4WifiFunc` | WiFi function list (multi-packet, 13/6 framing) |

`MatterManager` / `MatterManagerNew` orchestrate: read base info; if already paired read
GID/Matter ID/SSID; otherwise obtain QR+manual code from the device or cloud; hand off to
the Matter SDK/system commissioning; after commissioning read back GID/Matter ID/SSID and
upload.

### 5.3 Matter REST

| Purpose | Endpoint | Request / response |
|---|---|---|
| Get QR/manual code | `POST bff-app/v1/matter/qrCode` | `Request4GetMtQrInfo{sku,device,wifiMac}` → `Response4GetMtQrInfo{data.codeInfo{qrCode,manualCode}}` |
| Upload QR result | `POST bff-app/v1/matter/upload-qrcode` | `Request4SetMtQrInfo{sku,device,wifiMac,qrCode,manualCode}` → `Response4MtQrInfo{data.qrCodeId}` |
| Check upload | `POST bff-app/v1/matter/check-upload-qrcode` | `Request4CheckMtQrInfo{sku,device,wifiMac}` |
| Reset Matter IDs | `PUT bff-app/v1/devices/matter-ids` | `Request4ResetMtInfo{sku,device,gId,matterId}` |

Data model `MatterInfo{wifiSsid,gid,matterId,isSupportMatter,hasPairNet,hasAddedEcology}`
(`com/govee/matter/pair/MatterInfo.java`). `hasMatterInfo()` requires support + non-empty
GID + Matter ID; `hasMatterWifi()` requires support + non-empty SSID.

### 5.4 Matter commissioning flow

1. Check `MtPairProtocol.supportMatter` / `AddDeviceConfig.isSupportMatter`.
2. Read base info `0xAB/02` → support, already-paired, already-in-ecology flags.
3. If not paired: get QR + manual code from the device (`0xAB/01`, `0xAB/06`) or cloud
   (`POST /matter/qrCode`).
4. Hand the code to the OS/Matter SDK; the SDK commissions the device onto the thread/
   WiFi network.
5. Read back `0xAB/03` SSID, `0xAB/04` GID, `0xAB/05` Matter ID.
6. Upload the QR result (`/matter/upload-qrcode`) and bind the device to the account.
7. `MatterManager`/`MtGuide` exposes the result to the add/settings UI.

The split modules only implement the Govee side (BLE/REST handoff). Matter clusters,
attributes and the actual commissioning stack live in the closed `com.govee.matter`
library / native SDK.

## 6. Where this is implemented

- Base advert/pair helpers: `com/govee/base2home/pact/BleUtil.java`,
  `BleBroadCastInfo.java`, `GoodsType.java`, `Pact.java`.
- Base WiFi provisioning: `com/govee/base2light/ble/controller/{WifiLinkStarController,
  WifiMacController, SecretKeyController, MultipleWifiController,
  Controller4ReadWifiFuncList}.java`; `base2light/wifi/*`; `base2light/ac/AbsBleWifiChooseActivity.java`.
- Base Matter: `com/govee/matter/{MatterManager,MatterManagerNew,MtGuide}.java`,
  `matter/pact/{BleComm,MtPairProtocol,AbsMtReadController}.java`,
  `matter/pact/controller/*`, `matter/net/*`, `matter/pair/MatterInfo.java`.
- Per-split adoption: `add/BleBroadcastProcessor*.java`, `add/PairAc*.java`,
  `add/AddDevice*.java`, `pact/{Support,SubLib,SubMaker}.java`, `*MatterHelper.java`,
  `*MatterSupport.java`.

## 7. Version audit: Govee Home 5.6.20 (Matter release) has no cluster definitions

Govee Home **5.6.20** (versionCode 562, 2023-05-24) was downloaded from APKMirror and
inspected specifically for Matter cluster/attribute definitions. Result: **none are
present in the APK.**

What the APK contains (130 dex files, ~197 MB):

- `com.govee.matter.MatterManager` — QR/manual-code, GID, Matter ID, SSID, timeouts.
- `com.govee.matter.pact.{AbsMtReadController, BleComm, MtPairProtocol}` and controllers
  `Controller4{BaseInfo, Gid, MatterId, PairCode, QrCode, WifiSsid}` — the same
  commissioning protocol documented above (`0xAB/01..06`).
- `com.govee.matter.net.{IMatterNet, Request4GetQrCode, Request4ResetMtInfo, ...}` —
  QR/ID cloud endpoints.
- `com.govee.matter.guide.Activity4MatterGuide` — renders the QR, displays the manual
  code, reads the BLE IDs; it does **not** send cluster commands.
- `com.govee.matter.pair.{MatterInfo, Dialog4ChangeWifiRemind}`.

Evidence of absence:

- No class descriptors containing `Cluster` (all 129 dex scanned; only unrelated
  `ColorClusterer`, `trackViewClusterPoint*`, and AndroidX/Material “chip” classes).
- No `chip`, `connectedhomeip`, `MatterCluster`, `ClusterId`, `AttributeId` controller
  classes; no `libmatter` / `libchip` native library.
- No Matter/Google-Home GMS controller package in the dex.
- `Activity4MatterGuide` only stores/display `qrCode` and `pairCode`; the actual
  commissioning is delegated to the system/Matter ecosystem.
- The same is true in the fully decompiled **7.7.10** base and the **7.7.21** split
  modules: only `MatterSupport` / `MatterHelper` / `MatterInterceptor` and the
  `0xAB` commissioning controllers exist.

Conclusion: the Govee Home app is a **commissioning client**, not a Matter controller for
custom clusters. After commissioning, control still travels through Govee BLE/IoT frames.
Custom cluster definitions, if they exist, live in the **device firmware** (or in the
CSA/DCL certification data and Matter test reports), not in this APK. That also explains
why the app only needs the QR/manual code and the GID/Matter-ID/SSID readback.

## 8. Gaps / caveats

- Matter cluster/attribute mapping and the commissioning engine are not in the app; only
  the Govee QR/ID/SSID/REST handoff is visible. The 5.6.20 audit in §7 confirms no
  cluster definitions in the APK.
- The precise Matter QR payload string is generated by firmware/cloud; the app transports
  it, it does not construct it.
- SoftAP provisioning is legacy; most current devices use BLE provisioning.
- Advertisement parsers exist in several variants and a few JADX methods are stubs; exact
  company-ID constants/prefixes are documented per split where readable.
- Pairing command opcodes are family-specific (especially WiFi MAC/secret key/IC); the
  table gives the base forms and per-split docs carry the aliases.
- Thread is not used by these modules (Matter runs over WiFi/BLE).

---

# Known missing devices / dynamic modules

These devices are referenced by the Govee Home app but are **not present** in the
downloaded 7.7.10 / 7.7.21 bundles, so their command tables could not be extracted.

## H7184 — Kitchen Composter (GoveeLife)

| Item | Value |
|---|---|
| SKU | **H7184** |
| Product | Smart Kitchen Composter (electric, 3.0 L / 3.2 qt, 550 W) |
| goodsType | **208** (`KmpGoodsType.GOODS_TYPE_VALUE_H7184`) |
| Module | **`pact_h7184`** |
| Module entry point | `com.govee.h7184.H7184ModuleInitImp` |
| Delivery | Play Feature Delivery (PFD) dynamic module — downloaded on demand |
| Routes | `/h7184/detail`, `/h7184/guide` |
| Notification channel | `govee.nc.v1.composter` (`notification_channel_composter`) |
| Transports | BLE + Wi-Fi/Bluetooth per the product manual; app module would define both |

### Why it's missing

`base2home/pfd/Config.java` registers goodsType **208** → `pact_h7184` with
`makePfd4GoodsType(..., "pact_h7184", "com.govee.h7184.H7184ModuleInitImp", true, false, ...)`.
The module is a **dynamic feature**, and neither the APKMirror 7.7.10 nor 7.7.21 bundle
contains `split_pact_h7184.apk` (the 7.7.21 bundle has 45 device modules, but not this
one). Govee Home **5.6.20** (2023-05) predates the product and has no `h7184` classes.
The 7.7.10 base still contains the scaffold: routes, DB tables, notification channel,
timer/mode labels, and automation actions, but not the BLE/cloud command builders.

### What the base app tells us

Modes (timer support, `base_h71xx/sku_base/adjust/component/TimerSupport.java`):

| Mode id | Meaning |
|---|---|
| `1000` | Kitchen waste / Composting |
| `2000` | Storage |

Documented modes in the product manual: **Composting**, **Storage**, **Clean**.
A composting cycle takes about **7 hours**; the device has a weight sensor, an activated
carbon filter, RGB light, voice announcements, and protections for jam, overheat, NTC
failure, heating failure and lid-open.

Automation triggers (`eco/executeAction/data/EcologyKitchenCons.java`):

| Trigger id | Meaning |
|---|---|
| `145` | Composting finished |
| `146` | Clean finished |
| `148` | Caton / jam |
| `149` | Low temperature |
| `152` | Carbon filter low |

UI/DB scaffold:

- `H7184ChartTable` / `H7184ChartDao` — waste processed / compost produced history.
- `h7184_chart_average` “Average waste processed/Average compost produced”.
- `h7184_carbon_life_sum_illustrate` — cumulative hours in Composting + Storage modes.
- `h7184_weight_few_content` — minimum waste weight warning.
- `h7184_timer_mode_hint` — ~7 h composting cycle.

The actual command opcodes/payloads live in the missing `pact_h7184` module. They are
likely built on the shared `base_h71xx` appliance protocol used by the heater/humidifier/
kettle families (write proType `0x3A`, read `0xAA`, 20-byte frames), but that is **not
confirmed** without the module.

### How to obtain it

- Capture the on-demand PFD split from a device/account where H7184 has been added
  (`split_pact_h7184.apk`), or
- Find a Govee Home build/region whose bundle includes `split_pact_h7184`, or
- Extract the command definitions from an H7184 firmware OTA.

Until then it should be treated as **known and intentionally uncatalogued**, not as a
generic appliance covered by another split.

## H8102 — Smart Frozen Dessert Maker (ice cream / frozen treats)

| Item | Value |
|---|---|
| SKU | **H8102** |
| Product | Smart frozen dessert maker — ice cream, bars, cubes, sorbet, yogurt bark, rolls |
| goodsType | **335** |
| Module | **`pact_iceFood`** |
| Module entry point | `com.govee.icefood.IceFoodModuleInitImp` |
| Delivery | Play Feature Delivery (PFD) dynamic module |
| Route | `/iceFood/H8102Detail` |

This is **not** the H812x nugget-ice family; it is a frozen-dessert/ice-cream maker.
`Config.java` maps goodsType 335 → `pact_iceFood`, and the bundle does not contain
`split_pact_iceFood.apk`, so the command table is unavailable.

Base-app evidence:

- Modes: Ice Cream, Ice Cream Bars, Cream Cubes, Flavored Ice, Fruit Bars, Slush/Sorbet,
  Yogurt Bark, Ice Cream Roll, Defrost, Freezing.
- AI recipe generation (`h8102_mode_ai_cook_book`), ingredient/allergen/sweetness
  configuration, pre-cooling durations, anti-mistouch mode, buzzer volume.
- `ModeActionParserH8102` sends a mode frame via `CmdPtReal`/`CmdMultiSync` using
  `BleProtocolConstants.d0()`; the rest of the protocol lives in `pact_iceFood`.
- DB: `H8102ChartTable` / `H8102ChartDao` / `H8102Database`.
- Automation config keyed by goodsType 335 (`EcologyKitchenCons.b()`).

## H5054 — legacy gateway leak sensor (folded into base gateway)

| Item | Value |
|---|---|
| SKU | **H5054** |
| Product | Legacy leak/water sensor behind the H5040 gateway |
| Location | `com/govee/gateway` in the base app (not a `pact_*` split) |
| BLE | Not direct — `SkuH5054.needBle() == false`; gateway sub-device |
| Pairing | `AddInfo.makeAddInfo4Pair(..., 32, 64, ..., 8200)` via `PairAc` |
| Warning transport | REST `GateWayLeakWarnRequest` / `GateWayLeakWarnLiftedRequest`; push `H5054Msg` |
| Data | `H5054Data{message,read,time}`, `H5054Msg{sku,device,type,message,warnTime,...}` |

It predates the `pact_leaknew` split (H5058/H5059/H5830). It is covered by the base gateway
UI and cloud warning APIs rather than a dedicated device-protocol module, so it has no
separate BLE command table here.

## Folded / aliased families (present, but not separate family entries)

| Type | Where it lives | Notes |
|---|---|---|
| **H5054** legacy leak sensor | base `com/govee/gateway` | see above; no split |
| **H5106** air-quality monitor | `split_pact_thnew` (goodsType 124) | PM2.5 + TH; `H5106ThBroadParseImp`, `parseThpValue` |
| **H5140** CO2 sensor | `split_pact_thnew` (goodsType 319) | CO2 + TH; `H5140ThBroadParseImp`, CO2 0–5000 ppm |
| **H7150–H7153** dehumidifiers | `split_pact_humidifier` (goodsType 94/147/308/309) | source strings call them Smart Dehumidifier / Max |
| **H7161/H7162** aroma diffusers | `split_pact_humidifier` (goodsType 146/189) | Aroma Diffuser Pro / Smart Aroma Diffuser |
| **H7184** composter | missing `pact_h7184` | see above |
| **H8102** frozen-dessert maker | missing `pact_iceFood` | see above |

## Coverage note

The 45 extracted modules cover 607 unique SKUs. H7184 and H8102 are the two devices
explicitly registered in `Config.java` whose split modules are absent from the bundles.
Other base-only families (H5054, gateways/sub-devices) are covered through the base app
or their parent split.

---

# Part II — Per-split deep dives


---

<!-- split_pact_bbqnew -->

# split_pact_bbqnew — BBQ thermometers / probes (H5055, H5181–H5199, H5610)

Source root: `decompiled/jadx-splits/split_pact_bbqnew/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

---

## 1. Overview / family and SKUs

This module contains **four BLE protocol generations** plus shared UI. The newest
(`pact_bbqnew`, H5191/H5192/H5194/H5196/H5198/H5199/H5610) uses `AbsController`-style
20-byte frames with 6 probe slots and per-SKU heart formats; the older generations
(`pact_bbqv1`, `h5185`, `bbqmulti`) use 1–4 probes and simpler hearts.

| goodsType | SKU | package | probes | advert service | notes |
|---|---|---|---|---|---|
| 28 | H5181 | `pact_bbqv1` | 2 | generic GV broadcast | 2×AAA, screen |
| 29 | H5183 | `pact_bbqv1` | 1 | generic GV broadcast | 1×AAA, no screen |
| 33 | H5182 | `bbqmulti` | 2 | generic GV broadcast | 4-point UI, H5184 twin |
| 34 | H5184 | `bbqmulti` | 4 | generic GV broadcast | 4-point UI |
| 47 | H5186 | `h5185` | 4 | generic GV broadcast | 4 probes |
| 48 | H5185 | `h5185` | 4 | generic GV broadcast | 4 probes |
| 85 | H5198 | `pact_bbqnew` | 2 | `…51 98 17 ff` | "2-point" |
| 155 | H5199 | `pact_h5199` + `pact_bbqnew` | 6 | `…51 99 17 ff` | 6 probes, own BLE stack |
| 169 | H5196 | `pact_h5199` + `pact_bbqnew` | 6 | `…51 96 17 ff` | 6 probes |
| 281 | H5192 | `pact_bbqnew` | 6 | `…51 92 17 ff` | 6 probes |
| 282 | H5194 | `pact_bbqnew` | 6 | `…51 94 17 ff` | 6 probes |
| 314 | H5191 | `pact_bbqnew` | 6 | `…51 91 17 ff` | 6 probes |
| 344 | H5610 | `pact_bbqnew` | 2 | `…56 10 17 ff` | dual-probe "meat" thermometer |
| — | H5055 | `pact_bbqnew` (legacy path) | 2 | `…50 55 17 ff` | legacy `ihoment_H5055_*` name; goods type not in `Support.c` |

Registry: `pact_bbqnew/pact/Support.java` (goods `{314,281,282,85,344}` plus 155/169),
`pact_bbqv1/pact/Support.java` (`{28,29}`), `h5185/pact/Support.java` (`{48,47}`),
`bbqmulti/pact/Support.java` (`{33,34}`), `pact_h5199/pact/Support.java` (`{155,169}`).
Transports are **ble + iot** (`GoodsType.beProtocol(1,1)` + `(2,1)`; some `(2,2)`),
with BLE broadcast pairing.

---

## 2. Transports & GATT UUIDs

| item | value |
|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` |
| main characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` |
| H5199 secondary/self-comm char | `00010203-0405-0607-0809-0a0b0c0d2b10` |
| history/data char | `00010203-0405-0607-0809-0a0b0c0d2b12` |
| chart characteristic | `494e5445-4c4c-495f-524f-434b535f2013` |
| legacy name service | `494e5445-4c4c-495f-524f-434b535f4857` / char `…2011` |
| write proType | `0x33` |
| read proType | `0xAA` |
| packet | 20 bytes, `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` |

`pact_bbqnew/ble/BleComm.java` picks UUIDs by SKU: H5055/H5198/H5199 use
`494e…4857`/`…2011`, the H519x family uses the standard `00010203…1910/2b11`
(or `2b10` on the self-comm side). `H5199BleComm` additionally accepts `2b10` frames
and excludes `bArr[1]==3` heart frames from the generic path.

Write responses: success = `frame[2]==0`. Read responses: `AbsSingleController`
(`base2newth`) handles `0xAB` full frames or copies `frame[2..]` into 17 valid bytes.

---

## 3. BLE command table

`BbqBleProtocol` constants (`pact_bbqnew/ble/BbqBleProtocol.java`):

| cmdType | hex | function | payload |
|---|---|---|---|
| 1 / 36 | `0x01` / `0x24` | device id / heart (V0/V1) | per SKU; H5055/H5610 heart uses `0x24`, others `0x01` |
| 2 | `0x02` | temperature unit | `[0]=0 Celsius / 1 Fahrenheit` |
| 3 | `0x03` | heart / probe-warning | see 4.1 |
| 4 | `0x04` | hardware version | none |
| 5 | `0x05` | software version | none |
| 7 | `0x07` | buzzer switch / real info (H5055) | `[0]=0/1` |
| 8 | `0x08` | temperature calibration | signed int16 ×100 |
| 9 | `0x09` | preset food type | `[foodType]` |
| 10 | `0x0A` | time sync | 4-byte LE epoch seconds |
| 12 | `0x0C` | device id (H5196/H5199 vs H5055) | none |
| 13 | `0x0D` | BLE hardware / WiFi hardware | none |
| 14 | `0x0E` | BLE software / WiFi software | none |
| 15 | `0x0F` | WiFi MAC | none |
| 16 | `0x10` | probe id / long-life | `[probeId]` / `[enable]` |
| 17 | `0x11` | preset environment temp | 8-byte food block |
| 18 | `0x12` | preset probe target temp | `[target]` |
| 19 | `0x13` | timer/data set | see 3.2 |
| 12 | `0x0C` | pre-warn (H519x) | `[enable, tempLE16]` |
| 32 | `0x20` | WiFi hard version | none |
| 33 | `0x21` | WiFi soft version | none |
| 34 | `0x22` | temperature / humidity warning | `[enable, minLE16, maxLE16]` |
| 35 | `0x23` | stop send | none |
| 36 | `0x24` | IOT temperature data | 9-byte probe block |
| 37 | `0x25` | buzzer gear / volume | `[gear]` |
| 38 | `0x26` | auto reduce brightness / auto shutdown | `[enable, brightness, time]` / `[enable]` |
| 39 | `0x27` | pre-warn (H5055/H5610) | `[enable, tempLE16]` |
| 40 | `0x28` | clear data | `[probeId]` |
| 48 | `0x30` | volume (base) | `[volume]` |
| 50 | `0x32` | remain time | `[hour×2, min×2]` |
| 51 | `0x33` | close alarm | `[01, alarmId]` |
| 64 | `0x40` | clear probe | `[probeId]` |
| 65 | `0x41` | probe pairing | `[probeId]` |
| 66 | `0x42` | break probe pairing | none |
| 98 | `0x62` | upload interval | `[00, interval]` |
| — | `0xA3` | multi write | `[2]=index`, `[3..18]=chunk` |
| — | `0xAA` | read | per controller |

`BbqConstant` advertisement prefixes (exact scan-record starts):

| SKU | prefix |
|---|---|
| H5199 | `0201060303519917ff` |
| H5192 | `0201060303519217ff` |
| H5196 | `0201060303519617ff` |
| H5191 | `0201060303519117ff` |
| H5194 | `0201060303519417ff` |
| H5198 | `0201060303519817ff` |
| H5610 | `0201050303561017ff` |
| H5055 | `0201050303505517ff` |

### 3.1 Payloads (newest platform)

| command | payload | source |
|---|---|---|
| sync time | 4-byte LE epoch seconds | `Controller4SyncTime` |
| temp unit | `[0]` enum ordinal (Celsius 0 / Fahrenheit 1) | `Controller4TemUnit`, `Controller4TempUnit` |
| buzzer on/off | `[0]` | `Controller4SwitchBuzzer` |
| buzzer gear | `[0]` | `Controller4BuzzerGear`, `Controller4VolumeGear` |
| probe pair | `[probeId]` | `Controller4ProbePair` |
| break pair | empty | `Controller4BreakProbePair` |
| clear probe | `[probeId]` | `Controller4ClearProbe` |
| close alarm | `[01, alarmId]` | `Controller4CloseAlarm` |
| pre-warn | `[enable, tempLo, tempHi]` (temp ×100 signed LE16) | `Controller4PreWarn`, `Controller4TempBatteryProbeWarning` |
| preset food type | `[foodType]` | `Controller4TempPresetFoodType` |
| preset probe target | `[target]` | `Controller4PresetFtTem` |
| preset environment temp (H5055/H5199) | `[probeId, highLE16, lowLE16, foodType, subTypeLE16]` (×100) | `PresetEnvTempController` |
| auto reduce brightness | `[enable, brightness, time]` | `Controller4AutoReduceBrightness` |
| auto shutdown | `[enable]` | `ControllerAutoShutdown` |
| upload interval | `[00, interval]` | `Controller4UploadInterval` |
| IOT temperature (H5199) | `[probeId, tempLE16, humLE16, timestampLE32]` | `Controller4IotTemData` |
| temp-data probe id (H5199) | `[probeId]` | `pact_h5199/.../Controller4TdSetProbeId` |
| temp-data range (H5199) | `[startLE16, endLE16]` | `Controller4TdTimeRange` |
| remain time (H5199) | `[hour0,hour1, min0,min1]` | `Controller4RemainTime` |
| WiFi MAC | none (read) | `Controller4WifiMac` (`cmd 0x0F`) |

### 3.2 History / data read (`0x2b12`, chart `…2013`)

`BLeDataComm` (`pact_bbqnew/ble/BLeDataComm.java`) walks the on-device history in
16-byte records:

```
record = timeOffset (2 bytes) + temperature probe records
```

The read sequence is `Controller4TdSetProbeId` (`0x21`), `Controller4TdTimeRange`
(`0x22`), then chunked reads on `0x2b12`; each chunk is a 20-byte frame and is
acknowledged before the next. The chart characteristic (`494e…2013`) carries the
aggregated history/compare data. `DataOverNotifyParse`/`DataQueryingNotifyParse`
in the older generations expose the same flow with `EventDataOver` /
`EventDataQuerying`.

---

## 4. BLE notifications / readings

### 4.1 Heart layouts

The newest platform has four heart dialects, chosen by
`ThDeviceProfiles.s(goodsType, sku)` / `ThHeartDataFormat`
(`Controller4BbqHeartV1.java`):

| format | bytes | meaning |
|---|---|---|
| COMMON | `[0..1]` temp int16 BE, `[2..3]` humidity int16 BE, `[4..5]` third-probe temp int16 BE, `[6]` battery, `[7]` flags | `x()` |
| WITH_THIRD | `[0..1]` temp, `[2..3]` hum, `[4..5]` third probe temp, `[6]` battery, `[7]` bit0..5 probe-connected, bit6..7 alarm | `v()` |
| DUAL_PROBE | `[0..1]` temp, `[2..3]` hum, `[4]` battery, `[5]` flags (bit0 connected, bit1 alarm) | `w()` |
| H5220 (BBQ) | `[0..1]` temp, `[2..3]` hum, `[4]` battery, `[5]` switch | `u()` |
| H5055 (V0) | `[0..1]` temp, `[2..3]` hum (probe 1 only) | `Controller4BbqHeart` |
| H5610 / H5198 / H519x (V1) | bitmask bytes then 6 × int16 BE probe temperatures; battery/unit in a separate byte | `Controller4BbqHeartV1` |

Probe temperature conversion (`BcDeviceInfoParseUtil.b`):
`int16 BE / 100.0` °C; `0xFFFF` → `-10000` = invalid/open probe.
Battery is `b & 0x7F`, unit is `b & 0x80` (H5199/H5610 format).

### 4.2 Heart parsing results

`IotDeviceInfo` / `BleNotifyProbeInfo` fields:

| field | unit |
|---|---|
| probeId | 1..6 (`ProbeId.One`…`Four`, new gen up to 6) |
| probeConnected | bool (bitmask bit) |
| probeInnerAlarm | bool (bitmask bit) |
| probeInnerCurrTemp | °C, 0.01 |
| probeAmbientCurrTemp | °C, 0.01 (H5055/H5199 ambient probe) |
| probeError | bool (open circuit) |
| battery | 0–100 or 0–127 raw |
| tempUnit | Celsius / Fahrenheit |
| ambientAlarm | bool |

### 4.3 Broadcast layout (H5055/legacy)

`BcDeviceInfoParseUtil.e()` / `BleUtil.parseBbqBleValidBytePosV2()`:

```
scan record (62 bytes), AD structure loop:
  [i]   length
  [i+1] 0x03 (16-bit service UUID list) / 0xFF (manufacturer)
  [i+2..3] service UUID 0x5055 / 0x519x / 0x5610
  after the 0xFF marker:
    [i+5] flags: bit6 broadcast-present, low nibble pact code
    [i+6..7] version / mac suffix (LE16)
    [i+8] broadcast type / pact type
    ... probe temperatures
```

`BleBcDeviceInfo` fields: `macSuffix`, `broadcastType`, `pactType`, `pactCode`,
`tempUnit`, `pedestalBattery`, `bcProbeInfo`, `bcProbe2Info`,
`isPedestalCharge/FullBat/BatHighAlarm/ChargeAlarm`.

---

## 5. IoT commands + status schema

Envelope: `IotMsgProType.V2` for the new platform, V1 for H5055/older. Commands are
`ptReal` frames (same 20-byte tables) and `op` batches.

| cmd | data | meaning | source |
|---|---|---|---|
| `online` | — | subscription | `Model.k0` |
| `ptReal` | `{"command":["<base64 20-byte frame>"]}` | BLE tunnel | `BLeDataComm`, `Model` |
| `op` | `{"command":["<base64>"]}` | result frames | `Model.parseIotV2`, `Vm4BbqOpManager.parsePtResponse` |
| `status` | — | status snapshot | `BbqnewModel` |

Cloud chart/temperature upload and cook sessions are **REST**, not IoT `cmd` names
(`IotLoadTcdManager`, `HttpReadChartHelper`, `entity/*`, `probe/*`).

Status/heart JSON (cloud) fields mirror `IotDeviceInfo`: `probeInfoMap` keyed by probe
id with `probeInnerCurrTemp`/`probeAmbientCurrTemp`/`battery`/`probeConnected`.
Chart uploads use `BbqTemModel` records (probeId, timestamp, temperature).

---

## 6. Other protocols

- **BLE broadcast**: pairing and passive temperature display. Prefix table in 3.1;
  parser `BcDeviceInfoParseUtil.f()` switches on the exact prefix.
- **History GATT**: `2b12` (`00010203-…2b12`) and `494e…2013`.
- **OTA**: Telink (`update/telink`), Silicon Labs (`update/silicon`), FRK
  (`update/frk`) — packet formats `OtaPacketParser`, `OtaOp4Si`.
- **REST**: cook sessions, notes, images, preset menus, chart upload
  (`other/ProbeApiService`, `entity/*`, `probe/*`).
- **WiFi setup**: `add/WifiPairUtils`, `Activity4WifiChoose` (H519x with WiFi).

---

## 7. Dynamic effects / scenes / DIY

BBQ devices have **no light effects**. The only "scenes" are cooking presets:

- preset food/environment temp block (`PresetEnvTempController`):
  `[probeId, highLE16, lowLE16, foodType, foodSubTypeLE16]`, temperatures ×100;
  `< -10 °C` is encoded as `0xFFFF` (unset).
- timer/target temp (`Controller4PresetFtTem`, `TimerTaskInfo`,
  `ProbeScheduleTaskActivity`): per-probe target temperature and duration.
- cooking records/journeys are cloud-side (`entity/CookRecordInfo`,
  `CookJourneyInfo`) and not a BLE effect payload.

---

## 8. Source map

| area | paths |
|---|---|
| registry / SKUs | `pact_bbqnew/pact/Support.java`, `BbqConstant.java`, `pact_bbqv1/pact/Support.java`, `h5185/pact/Support.java`, `bbqmulti/pact/Support.java`, `pact_h5199/pact/Support.java` |
| BLE transport | `pact_bbqnew/ble/{BbqBle,BleComm,BleMultiComm,BleNotifyComm,BLeDataComm}.java`, `pact_h5199/ble/{H5199Ble,H5199BleComm,H5199DataComm,H5199Heart}.java` |
| commands | `pact_bbqnew/ble/controller/*.java`, `pact_h5199/ble/controller/*.java`, `pact_bbqv1/ble/controller/*.java`, `h5185/ble/controller/*.java`, `bbqmulti/ble/controller/*.java` |
| hearts | `pact_bbqnew/ble/controller/{Controller4BbqHeart,Controller4BbqHeartV1}.java`, `pact_h5199/ble/controller/Controller4Heart.java`, `pact_bbqv1/ble/controller/ControllerHeart.java` |
| broadcast | `pact_bbqnew/pact/BcDeviceInfoParseUtil.java`, `BleUtil.parseBbqBleValidBytePos*`, `bbqmulti/pact/ThBroadcastUtil.java` |
| IoT | `pact_bbqnew/{pact/BbqnewModel,Vm4BbqOpManager,iot/*}.java`, `pact_h5199/other/IotJsonInfo.java` |
| history | `pact_bbqnew/ble/BLeDataComm.java`, `BLeDataComm*`, `iot/IotLoadTcdManager.java`, `other/HttpReadChartHelper.java` |
| OTA | `update/telink`, `update/silicon`, `update/frk` |

---

## 9. Gaps / unknowns

- `Controller4BbqHeart.w()` (H5055 heart) and `Controller4Heart.l()` (H5199 heart) are
  decompiled as **method stubs** by JADX (`Method dump skipped`). Their exact byte
  offsets are inferred from `Controller4BbqHeartV1` and the `IotTemData` command; the
  probe bit masks and 6×int16 temp layout are certain, the battery/unit byte position
  in the H5199 heart is not.
- `BcDeviceInfoParseUtil.g()/h()/i()` (H5199/H5192/H5196/H5194/H5191 broadcast detail)
  are also decompiled as stubs; only the prefix, `macSuffix`, `pactType/pactCode`,
  `broadcastType`, `tempUnit`, `pedestalBattery` and two probe slots are certain.
- H5055 has no goodsType in `Support.c`; it is identified by BLE name
  (`ihoment_H5055_*`) and uses legacy frames. Its cloud goodsType is not visible.
- Temperature scaling in every format is ×100 (`/100.0`), but the ambient probe and
  the H5055 `Controller4RealInfoH5055` real-info reply may use a different divisor;
  no constant is present.
- Probe count per SKU (2 vs 4 vs 6) is enforced by UI/support code, not by the packet
  header; the heart always carries up to 6 slots.


---

<!-- split_pact_bulblightstringv1 -->

# split_pact_bulblightstringv1 — bulb-string / bulb-light families

Source root: `decompiled/jadx-splits/split_pact_bulblightstringv1/sources`
Base helpers: `decompiled/jadx-base-7.7.10/sources`

This split is a *bundle* of eight product families that all speak the
`base2light` RGB bulb/BLE dialect:

| sub-family | Java package(s) | goodsType(s) | transports |
|---|---|---|---|
| bulblightstringv1 (H7002/H7005) | `com.govee.bulblightstringv1` | 3, 5 | ble / ble+iot |
| bulblightstringv2 (H7010…H7032, H7019) | `com.govee.bulblightstringv2` | 35, 49, 91, 148 | ble, ble+iot |
| bulblightv1 (H6003/H6004, legacy IoT) | `…bulblightstringv1.bulblightv1` | 9, 10 | iot only |
| bulblightv2 (H6005 / updated H6001) | `…bulblightstringv1.bulblightv2` | 20 | ble |
| bulblightv3 (H6002…H14B1) | `com.govee.bulblightv3` | 31, 64, 111, 311, 328, 342, 348, 408 | ble+iot |
| bulblightv3 solar (H3210/H3520) | `com.govee.bulblightv3.solar` | 420, 419 | ble |
| h6001 (classic H6001) | `…bulblightstringv1.h6001` | (SKU-keyed) | ble |
| h7022 | `com.govee.h7022` | (SKU-keyed) | ble+iot |

All the SKU lists come from `pact/SubLib*.keys()` (`Support.f/g`, `Support.q/r`,
`Support.F/K`, `H7022Constant.f`, `Sku.b`, …).

---

## 1. Transports & GATT UUIDs

Every family in this split that uses GATT overrides the same pair:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Declared in each `ble/BleComm.java` and each `ble/BleMultiComm.java`
(`P/Q`, `L/M`), plus group variants in the v2 family
(`BleCommGroup`, `BleMultiCommGroup`). No family in this split overrides the
UUIDs with anything else. See source map for the per-family files.

Transports by goodsType / SKU:

- **ble only**: H7002(3), H6005/H6001(20), H7019(148), H3210(420), H3520(419),
  the whole `h6001` package.
- **ble + iot**: H7005(5), H7022, H7010…H7032 under goodsType 49/91, and
  H6002/H601A…/H601EF/H8015/H14xx (31/64/111/311/328/342/348/408).
- **iot only**: H6003(9), H6004(10) — pure `AbsIotItem` / `AbsDeviceModel4Iot`.
- The same SKU can appear as ble or ble+iot depending on `pactType/pactCode`
  (`Support.isWifiPact`, `BulbLightApplication` Matter interceptor).
- **matter**: H6011 (goodsType 64) and H8015 (goodsType 328) are registered with
  `MatterInterceptor` in `bulblight/BulbLightApplication.create()`; H6011/H8015
  can be commissioned via Matter and then fall into the same BLE/goodsType path.

---

## 2. BLE frame + command table

### 2.1 Frame

20-byte `BleUtils.generate20Bytes(proType, cmdType, payload)`:

| off | len | meaning |
|---|---|---|
| 0 | 1 | proType |
| 1 | 1 | cmdType |
| 2..18 | 17 | payload (zero padded) |
| 19 | 1 | BCC = XOR of 0..18 |

Reads (`proType 0xAA`) and writes (`0x33`) are built by
`AbsSingleController.f()/g()`; `AbsBleComm.parse()` strips the header before
`parseValidBytes()` (read: bytes 2..18 → 17 bytes, write: bytes 3..18 → 16).
`AbsModeController` (cmdType **0x05**) is the "mode" container; `q()` returns
`subMode.getWriteBytes()` and `p()` returns `{01}` for the read variant.

Multi-packet encodings used here (all 20 bytes/packet):

- **`MultipleControllerComm`** (`AbsMultipleController`, proType **0xA1**):
  start `[0xA1][cmd][0][packCount][p()]`, then `[0xA1][cmd][index 1..N][16 data]`,
  final `[0xA1][cmd][0xFF]`. Used for `MultipleScenesController` (cmd 0x01)
  and H6005 `MultipleDiyController` (cmd 0x02).
- **`MultipleControllerCommV1.makeSendBytesV1`** (proType **0xA3**):
  start `[0xA3][00][01][pktCount][cmdType][first 14 payload bytes]`,
  middle `[0xA3][n][17 bytes]`, final `[0xA3][FF][last ≤17 bytes]`.
  Used for `AbsMultipleControllerV1` (scenes v1, DIY v1) and by
  `MultiController` (`0xA3/0x58` H601EF DIY, `0xA3/0x6E` segment color).
- `H7022ScenesConfig.getBase64List()` builds a bare `0xA1/0x01` multi packet
  (`[0xA1][01][00][count]` + 16-byte chunks + BCC) from
  `ScenesModeController`.

### 2.2 Command table (deduplicated)

Payload is `payload[0..]` inserted at frame offset 2.

| name | op (proType/cmd) | payload | notes / applies to |
|---|---|---|---|
| power | `0x33/0x01` | `01` on / `00` off | all BLE families; read `0xAA/0x01` → `[0]!=0` |
| heartbeat | `0xAA/0x01` | empty | `HeartController`; response `[0]!=0` |
| brightness | `0x33/0x04` | `01..64` | 0..100 %; H6001 old maps `NumUtil.calculateProgress(254,20,b)` → 20..254; `0xAA/0x04` → `[0]` |
| mode container | `0x33/0x05` | sub-mode block | see §5; read variant payload `{01}` |
| color sub-mode 0x0B | `0x33/0x05` | `0B R G B m0…m9` | bulb-string v1 (14 B, 80-light mask bit0=first bulb); H7022 `0B R G B m0 m1 m2` (8 B, 24-light mask) |
| color sub-mode 0x02 | `0x33/0x05` | `02 R G B ct R2 G2 B2` | H6001 non-H6005 firmware; `ct=1` means colour-temp mode, `R2G2B2` is temp RGB |
| color sub-mode 0x0D | `0x33/0x05` | `0D R G B ctLo ctHi R2 G2 B2` | H6005 / updated H6001 / v3 `SubModeColor`; `ct` little-endian `getSignedBytesFor2(kelvin,true)` |
| color sub-mode 0x15 | `0x33/0x05` | variants below | newer families generated by base `ColorModeControllerConfig`/`Bytes` |
| scenes 0x04 (2-byte id) | `0x33/0x05` | `04 idLo idHi` | bulblightstringv2 (`+ speed` byte), bulblightv3 |
| scenes 0x04 (1-byte) | `0x33/0x05` | `04 id` | H6001, H6005 |
| scenes 0x09 (bulb-string) | `0x33/0x05` | `09 id+1` (17 B) | bulblightstringv1; H7022 uses `09 type+1` |
| music 0x0E | `0x33/0x05` | `0E auto sens flag [R G B]` | bulblightstringv1; `auto` 0/1, `sens` 0..99 |
| mic/music 0x05 | `0x33/0x05` | `05 01` | H6001/H6005/v3 "enter mic mode"; read/parse is no-op |
| mic rhythm point | `0x33/0x05` | `05 00 R G B` | `MicController` (H6005, v3) — one RGB beat point |
| DIY select 0x0A | `0x33/0x05` | `0A codeLo codeHi` | all DIY families after uploading the DIY blob |
| bulb number | `0x33/0x0F` | `n` | bulblightstringv1 / H7022; response `0xAA/0x0F` `[n]` |
| read bulb group colour | `0xAA/0xA2` | `groupIndex (1..6)` | `BulbStringColorController` / H7022 `ReadBulbColorController` |
| multi-scene | `0xA1/0x01` | see §5.1 | bulblightstringv1, H7022 |
| multi-DIY | `0xA1/0x02` | see §5.4 | H6005 / old H6001 |
| multi-DIY V1 | `0xA3/0x04` | `DiyProtocol.toBytes()` | updated H6001, H601EF, H14xx |
| H601EF DIY blob | `0xA3/0x58` | TLV, see §5.6 | goodsType 311 |
| H601EF segment colour | `0xA3/0x6E` | `[15..]` blocks via MultiController | goodsType 311 |
| solar battery history read | `0xAC/0x0E` | empty (read) | H3210/H3520; `AbsController4BleSingleSendMultiBack` |
| solar brightness strategy write | `0x33/0x43` | `brightness` | H3210/H3520 |
| solar brightness strategy read | `0xAA/0x43` | empty | H3210/H3520 |

`0x15` sub-mode variants (from
`base2light/pact/newdetail/config/fuc/color/Bytes.java`; used by
bulblightstringv2, bulblightv3, H601EF):

| variant | payload |
|---|---|
| colour + CT | `15 01 R G B ctLo ctHi R2 G2 B2 <mask…>` |
| colour only | `15 02 colourIndex <mask…>` |
| brightness set | `15 03 b0 b1 … (≤15)` |
| per-segment colour | `15 04 segmentIndex R G B (×4 per packet)` |
| multi colour + mask | `15 05 colorCount R G B … <mask…>` |
| colour temp only | `15 04/05` CT paths via `BleUtils.D(kelvin,true)` |
| switch/direction | `15 03/05` derived (`H()` writes `15 05 01/02/03 val`) |

Segment/multi-colour writes additionally wrap the `0x15` blocks in
`MultiController(..., 0x6E)` → `0xA3/0x6E`, and `ColorModeControllerConfig`
appends a bare `ControllerMode({0x15})` (or `{0x0C}` for IC==10) as the
"apply" frame.

### 2.3 Raw one-shot builders (no controller chain)

H7022 scene builders construct the 20-byte frame directly in
`h7022/scenes/ble/*`:
`[0]=0x33,[1]=0x04/0x01/0x05,[2]=payload…,[19]=BCC`, heart is
`[0]=0xAA,[1]=0x01,…`.

---

## 3. BLE notifications / readings

`AbsNotify` filters on frame byte 0 = `0xEE`, copies bytes 1..18, dispatches on
byte 0 of that slice.

| notify op | parser | layout | families |
|---|---|---|---|
| `0xEE/0x11` | `WifiNotifyParse` | `[0]==0` → WiFi connected | stringv1, stringv2, v3, h7022 |
| `0xEE/0x20` | `BrightnessNotifyParse` | `[0]` = brightness (0..100/254) | bulblightv2, stringv2 |
| `0xEE/0x60` | `MovieFeastOnOffNotifyParse` (base) | `[0]==1` valid, `[1]==1` on | bulblightv3 |
| `0xAA/*` | controller `parseValidBytes` | read replies; 17 valid bytes | all |
| `0x33/*` | controller write-ack | 16 valid bytes; `[0]` of original frame = 0 ⇒ success | all |

Per-family read parsers:

- **Bulb colour group** (`0xAA/0xA2 index`): valid bytes =
  `[0]=groupIndex(1..N)`, then 4 × RGB → `BulbGroupColor{index, int[4]}`.
  bulblightstringv1 `ble/BulbGroupColor.parseBytes`; H7022
  `ble/ReadBulbColorController.parseValidBytes` (identical, 24 bulbs in 6
  groups of 4, chained 50 ms apart).
- **Mode read** (`0xAA/0x05`, payload `{01}`): validBytes[0] = sub-mode id,
  remaining bytes go to `Mode.parseSubMode`:
  - stringv1: `0x0E` music, `0x09` scenes, else colour.
  - H7022: `0x0B` colour, `0x09` scenes, else music.
  - bulblightv2/v3/H6001: `0x05` mic, `0x04` scenes, `0x0A` DIY, else colour.
- **Bulb number** (`0xAA/0x0F`): `[n]` (string count); Info4BleIot then
  multiplies by `getBulbStringSetting(...)[1]` (2×15 defaults, i.e. max 30).
- **IoT passthrough reads** (`pt`/`bulb`/`ptReal`): list of base64-encoded
  20-byte frames decoded server-side, see §4.

---

## 4. IoT commands + status/readings schema

Envelope: standard `Write/AbsCmdWrite` (V0) and `Read/AbsCmdRead`;
incoming envelope variants:
- bulblightstringv1 / h7022: **V0** (`IotMsg`, `IotMsgEvent`, `cmdVersion==0`)
- bulblightv1: **V1** (`AbsIotManagerV1.getJsonObjectStr(json,"state"/"config")`)
- bulblightstringv2 / bulblightv3: **V2** (`IotMsgProType.V2`, `IotMsgV2` in
  scene builders); `Cmd.getCmdReadParseKey()` maps `ptReal`→`op`, else `state`.

### 4.1 Common command names

`online`, `turn`, `brightness`, `status`, `color`, `colorTem`, `colorwc`,
`mode`, `bulb`, `string`, `pt`, `ptReal`, `timer`, `sleep`, `wakeup`.

### 4.2 Per-family commands

**bulblightstringv1 (H7005, goodsType 5)**
- `turn` `{val:0|1}`
- `brightness` `{val:0..100}`
- `bulb` `{value:["<base64 20-byte BLE frame>", …]}` — full colour / group
  colour / scene frames from `CmdBulb`.
- `pt` `{op:"mode"|"timer"|"sleep"|"wakeup", value:["<base64>", …]}` —
  `CmdPt`; used for scene (mode), timer, sleep, wakeup.
- `string` `{val:int}` — string count set (`CmdString`).
- `status` query (`CmdStatus`), no data.
- Read keys: `Cmd.getCmdReadParseKey` → `pt`→`op`, else `state`.

**bulblightv1 (H6003/H6004, goodsType 9/10)**
- `turn` `{val}`; `brightness` `{val}`
- `color` `{r,g,b}`
- `colorTem` `{colorTemInKelvin, color:{r,g,b}}` (white)
- `mode` `{mode, code}` — mode 1 = scene, 3 = DIY (per `CmdStatusV1`
  constants m=1,o=3)
- DIY: `mode` `{mode:3, code, color:[{r,g,b}…], effect, subEff, speed,
  effArr:[{effect,subEff}…]}` (`CmdModeDiy(DiyProtocol)`; `effect==255`
  means a composite effect and `effArr` is filled).
- `timer` `{group, enable, type, hour, minute, repeat, timeOffset,
  timeOffsetMinute, timeStamp}`
- `sleep` `{enable, startBri, closeTime, curTime, timeOffset, timeStamp}`
- `wakeup` `{enable, endBri, wakeHour, wakeMin, repeat, wakeTime,
  timeOffset, timeStamp}`
- `status` query. Read keys: `timer|sleep|wakeup|mode`→`config`, else `state`.

**bulblightstringv2 (goodsType 35/49/91/148)**
- `turn` `{val}`; `brightness` `{val}`; `status` query
- `ptReal` `{command:["<base64>"]…}` — `CmdPtReal`; scene = multi-scene
  frames + a final `0x33/0x05` `{04, idLo, idHi}` mode frame.

**bulblightv3 (goodsType 31/64/111/311/328/342/348/408)**
- `turn` `{val}`; `brightness` `{val}`; `status`/`online`
- `colorwc` `{color:{r,g,b}, colorTemInKelvin}` — `CmdColorWc`;
  colour-temp commands put `color=white`, kelvin in `colorTemInKelvin`.
- `ptReal` `{command:["<base64>"]…}` — scenes, DIY (`getDiyCmdPt`), scene
  share (`getNewScenesCmdPtReal`), DIY studio (`getDiyCmdPt4DiyStudio`).
- `ptReal` is also the carrier for multi-segment colour on H601EF
  (`Cmd4PtReal` built from `ColorModeControllerConfig`).

**h7022**
- `turn` `{val}`; `brightness` `{val}`
- `bulb` `{value:["<base64 20-byte frame>", …]}` — one frame per colour group
  (`H7022SubModeColor.makeSetAllColors`: single colour = one frame with all 24
  mask bits; 24 colours = one frame per distinct colour).
- `pt` `{op:"mode"|"scenes"|"sleep"|"wakeup", value:["<base64>"]}`
- `timer` `{enable, group, isGroup, timeOffset, timeOffsetMinute,
  time:[{enable, repeat, openHour, openMin, closeHour, closeMin}…]}`
- `status` query + V0 status object (below).

### 4.3 Status / state schemas

**bulblightstringv1** (`iot/CmdStatusV0`):
`state` object with
`{onOff:0|1, brightness:int, mode:int, stringNum:int}`.
`CmdStatusV0` also keeps `modeValue`, `sleepValue`, `wakeupValue`,
`timerValue` (base64 BLE frames) and parses `mode` frames with
`parseBulbColorRgbSet(list)`:
- frame 0 may be `33 05 0B R G B` (single colour, sets `rgb`),
- each following 20-byte frame is a group colour block
  `[groupIndex][4×(R,G,B)]`, decoded with `BulbUtil.parseValidBleBytes`.
`parseColorModeRgbSet` skips frame 0 and decodes only group frames.

**bulblightv1** (`iot/CmdStatusV1`):
`state {onOff, brightness, color:{r,g,b}, colorTemInKelvin, mode}`
`config {modeValue:{mode,code}, sleep:{enable,startBri,closeTime,curTime},
wakeup:{…}, time:[NewTimerV1×4]}`.
Mode mapping: `mode==1` scene, `mode==3 && goodsType==9` DIY.

**bulblightv3 / bulblightstringv2**: no `CmdStatus` model in the split; the
new-detail delegates read `Info4BleIot` via base `Compose4InfoBleIot` (the
base controller strategy table is the source of truth). IoT `status` is used
only as an online/refresh trigger (`Model.V()` returns `"status"`).

**h7022** (`iot/CmdStatusV0 extends AbsCmd`, cmd `"status"`):
`{turn:0|1, brightness:int, mode:int, lightColorBunch:int,
softversion:String, wifiSoftVersion:String,
modeValue:[base64…], sleepValue:[base64…], wakeupValue:[base64…],
timer:{enable,group,isGroup,timeOffset,timeOffsetMinute,time:[…]}}`.
`getModeModel()` decodes `modeValue[0]` as a `0x05` mode frame;
`getColor7022Model()` concatenates all `modeValue` frames and parses them as
group-colour blocks.

**bulblightv2 (H6005/H6001)**: BLE only, no IoT status model.

---

## 5. Dynamic effects / motion / music / scenes / DIY (exact payloads)

### 5.1 bulb-string scene (bulblightstringv1 / H7022)

Simple selection (`SubModeScenes.getWriteBytes`):
```
33 05 09 <effect+1> 00 00 … 00
```
- bulblightstringv1 effect set `{0..7}` from
  `pact/Scenes4BleRhythm.e` and `ble/ScenesConfig`:
  0 illumination, 1 fade, 2 raindrops, 3 colorful, 4 marquee,
  5 blinking, 6 snow, 7 sky.
- H7022 `BleProtocol` same ids, `getWriteBytes` = `09 <type+1>`.

Multi-segment scene (`Comm.makeScene4BleComm` / `makeScene4IotComm`):
`SubModeScenes.a` = user effect index. `ScenesConfig.getLocalExt(index)`:
`index==0` → `null` (no multi-frame, illum only), otherwise
`{speed, color[]}` (default speed 50; default colours red, blue, yellow,
green, or white for index 6).
`MultiSceneModel{a=effect+1, b=effect, c=speed, d=RGB bytes}` →
`MultipleScenesController` payload:
```
[0]=effect+1
[1]=effect
[2]=0
[3]=speed 0..100
[4]=colourByteLen (3×N)
[5..]=R G B … (one triplet per colour)
```
wrapped in `MultipleControllerComm` (0xA1/0x01):
```
A1 01 00 <packCount> 00
A1 01 <idx 1..N> <16 bytes>
A1 01 FF
```
BLE-comm `makeScene4BleComm` returns each 20-byte frame base64'd; IoT uses
`CmdPt("mode", [modeFrame, …multiFrames])`.

`CmdStatusV0.parseBulbColorRgbSet`/`ResultPt.getOpMode4SubModeColorEffectRgbSet`
reverse this: first `33 05 0B R G B` = single colour, remaining frames =
`[groupIndex][4×RGB]`.

### 5.2 bulb-string music (bulblightstringv1)

`SubModeMusic.getWriteBytes()` (sub-mode `0x0E`):
```
0E <autoFlag 0|1> <sensitivity 0..99> <flag> [R G B]
```
- auto/manual: internal `d=true` ⇒ 4 bytes `0E a b a(d)=0`;
  `d=false` ⇒ 7 bytes `0E a b a(d)=1 R G B`.
- `a` = 0 (power/energy) or 1 (soft), `b` = sensitivity 0..99, colour default
  red `0xFFFF0000`.
- `parse` reads `[auto, sensitivity, flag, R,G,B]`.

H7022 music (`ble/BleProtocol.sub_mode_music=1`,
`adjust/mode/SubModeMusic`):
```
01 <effect> <sensitivity>
```
effect 5 = "Dynamic", 4 = "Mild"; sensitivity 0..99.

### 5.3 mic / rhythm (H6001, H6005, bulblightv3)

- enter mic mode: `33 05 05 01`
- one rhythm point: `33 05 05 00 R G B` (`MicController`)
- `supportMic`: H6005 = 3 (mic only), H601EF = 2, v3 = 3, H6001/v1/v2 = 0 or
  "no music" per detail config.

### 5.4 classic DIY (H6005 / old H6001)

`MultipleDiyController` (`AbsMultipleController4Diy`, proType 0xA1, cmd 0x02):
```
[0]=diyCode
[1]=effect
[2]=subEff
[3]=speed 0..100
[4]=colourByteLen = 3×N
[5..]=R G B … (N colours)
[5+len]=subEffectCount (only if composite)
[6+len..]=<effect, subEff> pairs
```
then `A1 02 00 <packCount> 00` + chunks + `FF` (see §5.1 wrapper), followed by
mode frame `33 05 0A <codeLo> <codeHi>`.

Updated H6001 (`Support.isH6001Update`) uses
`MultipleDiyControllerV1` → `AbsMultipleControllerV14Diy` with
`DiyProtocol.toBytes()` over `0xA3/0x04`, then the same `0x0A` mode frame.

### 5.5 bulblightv3 scene / DIY

Scene (`SubModeScenes`, 2-byte id):
```
33 05 04 <idLo> <idHi>
```
- H6008 (goodsType 64) effect ids:
  `123,124,106,100,121,122,109,1136,153,154,155,156,52,68,13,1137,130,2,
  107,142,143,163,139,146,1131,1171,1132,1133,1134,1172`
  (`adjust/v3/ScenesV3.l`).
- H601A succession (goodsType 111) effect ids **2657..2720**
  (`adjust/v3/ScenesV3H601A.k`, includes gaps 2665/2716/2717).
- Single-byte ids also used for H6001/H6005 (see §5.7).

New scene (`ScenesOp.parseScene/ parseEffect`) produces
`AbsMultipleControllerV14Scenes` over `0xA3/0x04` with the scene's effect
bytes, then `CmdPtReal`/BLE list appends the `0x04 idLo idHi` mode frame.

DIY (`CmdPtReal.getDiyCmdPt`):
`MultipleBleBytes.getMultipleWriteBytesV1(new MultipleDiyControllerV1(diy))`
→ `0xA3/0x04` frames, then `33 05 0A <codeLo> <codeHi>`.

DIY Studio / template (`getDiyCmdPt4DiyStudio`, `getDiyTemplateCmdPt`):
`0xA3` template frames + `33 05 04 <templateCodeLo> <templateCodeHi>`.

### 5.6 H601EF (goodsType 311) advanced DIY — exact TLV

`newdetail/diy/H601EFDiyParse.toBytes()`:
```
[totalLen  LE16]
  [mainLen LE16][main block]
  [subLen  LE16][sub block]
```
main block `k()`:
```
01 04 <speed 0..100> <colorCount> R G B (×colorCount)
```
sub block `q()`:
```
01 <subType> <sub-effect body>  (see table)
```
sub-effect bodies (`AbsSubH60ax.a()` / each subclass `e()`):
```
type 1  ColourTem   : <ct> <brightness> <kelvin LE16>
type 2/3/4/6/14 SpeedColor: <speed> <colourCount> R G B …
type 7  Streamer    : <speed> <group> <colourCount> R G B …
type 8  BgColor     : <speed> <colourCount> R G B … <brightness>
type 10 DuiJi       : <speed> <direction> <colourCount> R G B …
type 11 Breathe     : <speed> <group> <colourCount> R G B …
types 1..5 common   : <speed> <colourCount> R G B …
type 0  None        : (empty)
```
`H601EFDiyParse.k()` also fixes `[01,04,…]` (main always colour-temp-style
header). Sent as `MultiController(bytes, 0x58)` → `0xA3/0x58`, then mode
`33 05 0A <codeLo> <codeHi>` (or scene apply when driven by DIY Studio).

H601EF per-piece colour: `ColorModeControllerConfig` builds `0x15` blocks
(`15 04 segmentIndex …`, `15 05 …`) wrapped in `MultiController(...,0x6E)` →
`0xA3/0x6E`, colour piece size = **7** (`Support.getColorPieceSize`), 4
colours per group (`getOneGroupColorSize`).

H601EF New-DIY config (`H601EFNewDiyConfig`) exposes 20+ effect definitions
(IDs 1..25, 9998 = "none"/advanced, 10001/10002) with effect groups:
1..5 common (sub-effect ids 1..3), 6 speed-colour, 7 streamer, 8 bg colour,
10 duiji (direction 1..2), 11 breathe, 14 speed-colour, 25 extra; DIY share
code `0x50` and effect code `{787}`.

### 5.7 classic H6001 / H6005 scene ids

- H6001 old (`BleProtocol4OldH6001` / `ScenesV0`):
  `0=gm, 1=sunset, 7=romantic, 10=breath, 11=dazzling, 12=lively,
  13=reading, 14=relax`.
  Payload `33 05 04 <id>`.
- H6001 updated / H6005 (`BleProtocol` / `ScenesV0`, `Scenes4H6005`):
  effect set `{13,17,10,7,9,20,16,25}` (reading, fade, breath, romantic,
  cl, heartbeat, energetic, blinking). Payload `33 05 04 <id>`.
- H6003 (IoT): `Scenes4H6003.q = {0,4,3,2,1,5,6,7}` for its local scene UI.

### 5.8 bulblightstringv2 scenes

`pact/Comm.makeSceneCmd4IotComm`:
- `SubModeScenes.setEffect(i)` → mode frame
  `33 05 04 <iLo> <iHi> <speed>` (`speed` defaults to `0xFF` =
  `SCENES_WITHOUT_SPEED`).
- If `ScenesOp.parseScene/parseEffect` finds a multi-scene definition, it is
  emitted first as `0xA3/0x04` frames (V1 multi layout), then the mode frame.
- Capability set `Support.supportScenesOpSet()` = `{1}`.

### 5.9 H7022 multi-scene

`H7022ScenesConfig.getBase64List(sku, code)`:
```
[0]=code (1-based)
[1]=effectType (code-1)
[2]=subEffectType
[3]=speed 0..100
[4]=colourByteLen = 3×N
[5..]=R G B … (skip 0,0,0)
```
Wrapped as `0xA1/0x01` start `[00,count]` + 16-byte chunks + BCC.
Default colours: code 6 → white; else red, blue, yellow, green; speed 50.

### 5.10 solar H3210 / H3520 DIY

- H3210 `toBytes()` (`solar/diy/H3210DiyParse`, effect `984`, share `0x50`):
```
<effectCode> <speed 1..100> <colourByteLen=3×N> R G B … <R G B bg>
```
- H3520 `toBytes()` (effect `985`, share `0x50`):
```
<effectCode> <speed 0..100> <flag = (effectCode==18 || composite) ? 1 : 0>
<count 1..8> R G B … (≤8)
```
Both solar DIY classes are `IDiyParse` implementations; the base
`IDiyParse.DefaultImpls.makeBleController` wraps `toBytes()` in the generic
`0xA3` multi-controller frames and appends a mode frame. Effect codes
984/985 are the DIY identifiers; sharing uses code `0x50`.

### 5.11 colour grouping on bulb strings

- bulblightstringv1: up to **80** logical bulbs (`ctlLight[80]`), mask 10
  bytes, 4 colours per read group (`getOneGroupColorSize=4`), max 30 bulbs
  (`getBulbStringSetting = {2,15}` → 2 groups × 15).
- H7022: **24** bulbs (`ctlLight[24]`), mask 3 bytes, 6 groups × 4 colours
  (`H7022Constant.getBulbNum = 6`).
- Group write with all lights: mask bits all 1. Per-colour write:
  `makeSetAllColors(int[24])` builds one frame per distinct colour, setting
  only that colour's mask bits.

---

## 6. Other protocols

- **Matter**: H6011 (goodsType 64) and H8015 (328) registered in
  `bulblight/BulbLightApplication.create()`; `newdetail/config/MatterSupport`
  registers Matter detail config. No cluster-level mapping is in this split
  (delegated to the base Matter stack).
- **WiFi / LAN**: no LAN/UDP/TCP/MQTT code in this split. IoT is cloud MQTT
  through the base `Iot`/`IotManager` only. `Support.getWifiInputLimit()`
  = `{32,64}` and `bulblightv1 Support.i = "192.168.1.1"`, port `7200`,
  SSID prefix `Govee_bulb_` for the legacy SoftAP pairing of H6003/H6004.
- **BLE advertisement**: no custom advertising parser in this split; the
  base `BaseBleProcessor`/`AbsBaseBleModel` handles scan records. Solar fw
  reads battery bits from the scan record:
  `BleModel.x(scanRecord)` → `ByteUtils.parseValidByte(record)[4]` →
  `BatteryInfo` (bit7=charging? see schema); `SolarModel.x` reads
  `validByte[3] & 0xFF == 2` → light-sense mode enabled.
- **OTA**: H7019 (bulblightstringv2) uses base `OtaOpV3`; all other families
  use the base OTA path.
- **ptUrl / multiSync**: not present in this split.

### 6.1 Solar battery / light-sense readings

- `ReadBatteryInfoController` (`0xAC/0x0E`, single-send multi-back):
```
[0..1] validDataLen LE16
[2]    interval minutes (timestamp base = now − interval*60 000, floored to hour)
[3..4] totalPointNum LE16
[5..]  pairs: b0 bit7 = charging/valid flag, bits0..6 = battery %;
              b1 bit7 = sign, bits0..6 = value
```
- Scan-record battery byte `BatteryInfo`:
  bit8 → `charging` (`a`), bits5..3 → `level` (`b`, 0..7; 7 ⇒ "99"),
  bit4 → `c`, bit3 → `d`, bit2 → `e`, bit1 → `f` (full/plugged flags).
- Light sense (`LightSenseInfo` from validBytes):
```
[0] bit1 = enabled, bits2..3 = mode, bits5..7 = sensitivity
[2] bit? = light-sense switch result
[3..4] LE16 = brightness threshold
[5] bit? = auto-brightness enable
[6..8] header time: state, hour, minute
```
- `HeaderTimeInfo` state `0=off,1=on,2=auto`; time = `hour*60+minute`.

---

## 7. Source map (paths traced)

Relative to `decompiled/jadx-splits/split_pact_bulblightstringv1/sources/` unless
prefixed `base:` (= `decompiled/jadx-base-7.7.10/sources`).

Core / frame:
- `com/govee/bulblightstringv1/pact/{SubLib,SubLib4BleIot,Comm,Support,DeviceItem,DeviceItem4BleIot,Model,Model4BleIot,Register4Item,SubMaker}.java`
- `com/govee/bulblightstringv1/pact/ble/{AbsBleSkuItem,V1BleSkuItem,AbsEffectOp4Ble,EffectOp4Ble,BleExt}.java`
- `com/govee/bulblightstringv1/pact/bleiot/{AbsBleIotSkuItem,V1BleIotSkuItem,AbsEffectOp4BleIot,EffectOp4BleIot,BleIotExt}.java`
- `com/govee/bulblightstringv1/pact/Scenes4BleRhythm.java`
- `com/govee/bulblightstringv1/ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol,Mode,ModeController,SubModeColor,SubModeMusic,SubModeScenes,ScenesConfig,BulbGroupColor,BulbNumController,BulbStringColorController,MultipleScenesController,MultiSceneModel,OpColorCommDialog4Ble,OpColorCommDialog4SquareBle,WifiNotifyParse}.java`
- `com/govee/bulblightstringv1/iot/{Cmd,CmdTurn,CmdBrightness,CmdBulb,CmdPt,CmdString,CmdStatus,CmdStatusV0,ResultPt,ResultBulb,ResultString,OpColorCommDialog4BleIot,OpColorCommDialog4SquareBleIot}.java`
- `com/govee/bulblightstringv1/scenes/{AbsBleCmdBuilderV1,AbsIotCmdBuilderV1,Ble*,Iot*}.java`
- `com/govee/bulblightstringv1/detail/{NewDetailAc,NewDetailVm,Info4Detail,DetailConfig}.java`, `detail/mode/*`
- `com/govee/bulblightstringv1/add/v1/*`, `add/v2/*`

bulblightv1 (H6003/H6004):
- `com/govee/bulblightstringv1/bulblightv1/pact/{Comm,Support,SubLib,SubMaker,DeviceItem,Model,IotSkuItemV1,IotSkuItemV2,IotExt,AbsEffectOp4Iot,EffectOp4Iot}.java`
- `.../bulblightv1/iot/{Cmd,CmdTurn,CmdBrightness,CmdColor,CmdColorTem,CmdMode,CmdModeDiy,CmdSleep,CmdWakeUp,CmdTimer,CmdStatus,CmdStatusV1,DiyLocal,OpColorCommDialog4Iot,OpDiyCommDialog4Iot}.java`
- `.../bulblightv1/adjust/ui/v1/{SubModeColor,SubModeDiy,SubModeScenesV1}.java`, `ui/v2/{SubModeScenesV2,...}.java`, `adjust/{Mode,SubModeType,Diy}.java`

bulblightv2 (H6005 / H6001):
- `com/govee/bulblightstringv1/bulblightv2/pact/{Comm,Support,SubLib,SubMaker,BleSkuItem,Model,DeviceItem,GroupFactor,GroupFactorV2,ScenesV0,AbsEffectOp4Ble,EffectOp4Ble,BleExt}.java`
- `.../bulblightv2/ble/{Ble,BleComm,BleCommGroup,BleMultiComm,BleMultiCommGroup,BleNotifyComm,BleProtocol,Mode,ModeController,SubModeColor,SubModeScenes,SubModeNewDiy,SubModeMic,MicController,BrightnessNotifyParse,GroupBle,GroupOp}.java`
- `.../bulblightv2/scenes/*`

h6001:
- `com/govee/bulblightstringv1/h6001/sku/{Sku,SkuH6001,SubLib,SubMaker,Register4Item,Model,DeviceItem,BleExt,ScenesV0,EffectOp4Ble,AbsEffectOp4Ble,DeviceItem,ScenesV0}.java`
- `.../h6001/ble/{Ble,BleComm,BleMultiComm,BleProtocol,Mode,ModeController,SubModeColor,SubModeColorV2,SubModeScenes,SubModeMic,SubModeNewDiy,MicController,Diy,DiyLocal}.java`
- `.../h6001/scenes/*`

bulblightstringv2:
- `com/govee/bulblightstringv2/pact/{Support,Comm,SubLib,SubLib4BleIot,SubMaker,AbsBleSkuItem,V1BleSkuItem,Model,Model4BleIot}.java`
- `.../pact/bleiot/{BleIotMaker,BleIotMakerV2,BleMakerH7019,BleWifiBindExt}.java`
- `.../ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol,Mode,ModeController,SubModeScenes,BrightnessNotifyParse,WifiNotifyParse}.java`
- `.../iot/{Cmd,CmdTurn,CmdBrightness,CmdStatus,CmdPtReal}.java`
- `.../scenes/{AbsBleCmdBuilderV1,AbsIotCmdBuilderV1,Ble*,Iot*,SmartRoomOp,SmartRoomOp4Ble}.java`

bulblightv3:
- `com/govee/bulblightv3/pact/{Support,Comm,SubLib,SubLib4Ble,SubMaker,Register4Item,DeviceItem,Model,BleModel,SolarModel,AbsBleIotSkuItem,BleIotExt,SmartRoomOp4H6002}.java`
- `.../pact/v1/{V1BleIotSkuItem}.java`; `pact/v3/{V3BleIotSkuItem,BleIotSkuItem111,BleIotSkuItemH601EF,SkuItemH1401,SkuItemH14B1,SkuItemH14C0,H8015Item,AbsEffectOp4BleIot,EffectOp4H6008,Op*CommDialog4BleIot,Op*CommDialog4SquareBleIot,BleColor*CmdBuilderV1}.java`; `pact/ble/{BleMakerH3210,BleMakerH3520}.java`
- `.../ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol,Mode,ModeController,SubModeColor,SubModeScenes,SubModeNewDiy,SubModeMic,MicController,WifiNotifyParse,DiyLocal}.java`
- `.../iot/{Cmd,CmdTurn,CmdBrightness,CmdColorWc,CmdPtReal}.java`
- `.../adjust/v3/{ScenesV3,ScenesV3H601A,DiyV3}.java`, `adjust/v2/Diy.java`
- `.../newdetail/diy/{H601EFDiyParse,H601EFDiyEffect,H601EFNewDiyConfig,H601EFDiyAdvanced*,...}.java`, `newdetail/diy/subEffect/*`
- `.../solar/{SolarProtocol,controller/ReadBatteryInfoController,controller/Controller4BrightnessStrategy,bean/BatteryInfo,bean/LightSenseInfo,bean/HeaderTimeInfo,diy/H3210Diy*,diy/H3520Diy*}.java`
- `.../add/{BleBroadcastProcessor,AddDeviceSolar}.java`

h7022:
- `com/govee/h7022/{H7022Constant.java,sku/*,ble/*,iot/*,adjust/mode/*,scenes/*,detail/*,add/*}.java`

Base:
- `base:com/govee/base2light/ble/controller/{AbsSingleController,AbsOnlyReadSingleController,AbsOnlyWriteSingleController,AbsController,AbsMode,AbsModeController,AbsMultipleController,AbsMultipleControllerV1,AbsMultipleControllerV14Scenes,AbsMultipleController4Diy,AbsMultipleControllerV14Diy,BrightnessController,SwitchController,HeartController,BleProtocolConstants,MovieFeastOnOffNotifyParse,AbsControllerNoEvent4Single,AbsController4BleSingleSendMultiBack}.java`
- `base:com/govee/base2light/ble/comm/{AbsBleComm,AbsMultipleBleComm,AbsNotify,AbsNotifyParse,MultipleControllerComm,MultipleControllerCommV1,MultipleBleBytes}.java`
- `base:com/govee/base2light/pact/newdetail/config/fuc/color/{ColorModeControllerConfig,Bytes}.java`
- `base:com/govee/base2light/kt/general_controller/{ControllerMode,MultiController}.java`
- `base:com/govee/base2light/ble/BleUtil.java`

---

## 8. Gaps / unknowns

1. `bulblightstringv1/iot/CmdStatusV0.parseJson` is a JADX
   `UnsupportedOperationException` stub ("Method dump skipped"). The `State`
   inner class fields are known (`brightness, mode, onOff, stringNum`), but
   the exact key mapping between the outer status object and `state`/`pt`
   is inferred from the parser helpers and the V0 manager flow.
2. `bulblight/Support.d(...)` (the legacy SKU-version gate: H6010 / H600A /
   H6006 / H6009 / H600D / H600B / H600C / H8015 / H6011 / H6013 / H800B …)
   is a JADX "failed to restore switch" block. It only gates *which* old
   detail UI handles a SKU; it does not define new opcodes. Treat legacy SKU
   assignments as approximate.
3. `bulblightstringv2`/`bulblightv3` colour and segment payloads are produced
   by the shared base `ColorModeControllerConfig` + `Bytes` tables, not by
   the split. The `0x15` variant table in §2.2 is derived from that base
   file; per-SKU capability (piece count, IC count, per-piece support) is
   runtime (`Info4BleIotDevice`, `LightColorCapabilityCenter`) and not
   statically enumerable here.
4. `H7022 Mode.parse` treats anything that is not `0x0B`/`0x09` as music; the
   firmware may emit other ids not modelled by the app.
5. `SubModeMusic` (bulblightstringv1) writes `flag = d ? 0 : 1` but parses
   `d = (bArr[2] == 0)`. That round-trip is asymmetric in the decompiled
   code; preserve the byte order above and treat the meaning of the 4th
   payload byte as "manual-colour flag, 1 = includes RGB" (as the parser
   implies).
6. `0xA3` multi-packet first-packet payload is split around byte 4
   (`commType`), so any parser must read `cmdType` from byte 5 of a
   *continuation* packet and byte 1/4 of the start packet. The exact `p()`
   value (`AbsMultipleControllerV1.f55492h = 1`) is a constant; some
   controllers override it.
7. No custom BLE advertising layout is defined in this split (base scan
   record parser only); solar battery/light-sense bits are the only
   advertisement-derived readings.
8. IoT `status` schemas for bulblightstringv2/bulblightv3 are handled by base
   `Compose4InfoBleIot`/`AbsIotManagerV2` and are not defined in the split.


---

<!-- split_pact_fanlight -->

# split_pact_fanlight — ceiling fan + light (H1310 / H1370)

Source root: `decompiled/jadx-splits/split_pact_fanlight/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

---

## 1. Overview / family and SKUs

The module implements Govee **ceiling fans with an integrated RGBIC light ring**
("fanlight"). Two goods types, two SKU families, one shared command model:

| SKU | goodsType | fan gears | light segments | remote | notes |
|---|---|---|---|---|---|
| H1310 | 359 | 1–6 | 9 | yes | fan + main light + back light; optional TH sensor binding |
| H1370 | 368 | 1–12 | 14 | yes | fan + main/back light; sleep/natural/direct/**auto** wind modes; shake (oscillate) head; TH sensor binding |

Both SKUs are registered as `AbsBleIotSkuItem` (`pact/SubMaker.java`), i.e. **ble + iot**
(GATT plus cloud/WiFi with `ptReal`). No WiFi-only, IR or Thread variant is declared here.
Matter is **not** used by this module (the `Ble.r()` comm is `com.govee.matter.pact.BleComm`,
but only for its UUIDs/heart handler; there is no Matter pairing config).

Support facts (`Support.java`):

- `d(goodsType)` → max gear: **6** for 359, **12** otherwise.
- `l(goodsType)` → scene categories: `{0,1,2,3,5}` (359), `{0,1,2,3,6,5}` (368).
- 359 declares `DeviceGoodsType 359` with capability pairs `{1,1},{1,2},{1,3},{1,4}`;
  368 declares `DeviceGoodsType 368` with `{1,1},{1,2},{1,3}`.
- `m(info)` / `j(info)` → H1370-only features (shake head, auto program).
- `SensorSupport.a(info)`: 359 needs soft>1 or (soft==1 && sub>=4); 368 needs soft>1 or
  (soft==1 && sub>=3). This gates TH thermometer binding.

---

## 2. Transports & GATT UUIDs

| item | value |
|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` |
| write proType | `0x33` |
| read proType | `0xAA` |
| multi write | `0xA3` (V1 packetisation) |

Declared identically in `ble/BleComm.java`, `ble/BleMultiComm.java`, and the anonymous
`AbsMultipleBleComm`/`AbsNotify` implementations. `BleNotifyComm.getServiceUuid()`
returns the **service** UUID (see gaps).

Frame (all commands):

```
[0]=proType [1]=cmdType [2..18]=payload (zero padded) [19]=XOR BCC of bytes 0..18
```

`AbsController.getValue()` builds write `33 cmd payload`; read `AA cmd payload`
(`AbsControllerNoEvent4Single`). `AbsModeController.p()` overrides the read payload to `{0x01}`.
Notify/read data delivered to parsers is `frame[2..18]` (17 bytes).

---

## 3. BLE frame + command table

### 3.1 Core light / fan

| name | op | payload | layout | response | source |
|---|---|---|---|---|---|
| power | `0x33/0x01` | `01 <0/1>` | `[0]` on/off | `0xAA/0x01` → `[0]` state | `base2light/ble/controller/SwitchController.java` |
| brightness | `0x33/0x04` | `04 <1..100>` | `[0]` 1–100 | `0xAA/0x04` → `[0]` | `base2light/ble/controller/BrightnessController.java` |
| heartbeat | `0xAA/0x01` | `01` | — | `[0]` non-zero = alive | `base2light/ble/controller/HeartController.java` |
| fan control | `0x33/0x31` | see below | subtype byte at `[2]` | `0xAA/0x31` (info parser) | `ble/ControllerFan.java` |
| sub light switch | `0x33/0x36` | `36 <idx> <0/1>` | `[0]` 0=main / 1=back, `[1]` on | `0xAA/0x36` | `ble/ControllerSubSwitch.java` |
| remote pair | `0x33/0xA4` | `A4 01` | `[0]=1` | `0xAA/0xA4` → `[0]` result | `ble/RemoteController.java` |
| exit remote pair | `0x33/0xA6` | `A6` (no payload) | — | `0xAA/0xA6` | `ble/ExitRemoteController.java` |

`ControllerFan` (cmdType **0x31**) factory payloads — 17-byte payload starts at `[2]` of the frame:

| subtype (payload[0]) | factory | payload | meaning |
|---|---|---|---|
| `0x00` | `f(on)` | `00 <0/1>` | fan power |
| `0x01` | `a(gear)` | `01 <gear>` | gear, 1..6 (H1310) / 1..12 (H1370) |
| `0x02` | `d(reverse)` | `02 <0/1>` | reverse wind (winter mode) |
| `0x03` | `c(mode[,extra])` | `03 01 00 <mode> [extra…]` | wind mode: **0=direct 直吹, 1=sleep 睡眠, 2=natural 自然, 3=auto 自动**; mode 3 appends the 6-byte auto program (below) |
| `0x04` | `e(shake)` | `04 <0/1>` | shake/oscillate head (H1370) |

`getCurCompleteCmd()` shows the canonical "apply whole fan state" sequence used for scenes /
eco / cloud sync (`VM4Light.java`):

1. `36 00 <mainLightOn>`
2. `36 01 <backLightOn>`
3. `31 00 <fanOn>`
4. if fan on: `31 02 <reverse>`
5. if auto-capable (sensor bound or H1370) and mode==3: `31 03 01 00 03 <6 auto bytes>`
   else if auto-capable: `31 03 01 00 <mode>`
6. `31 01 <gear>`
7. if H1370: `31 04 <shake 0/1>`

All frames are base64-encoded (`Encode.encryptByBase64`) for `ptReal`.

### 3.2 Color / scene / DIY / music

| name | op | payload | layout | source |
|---|---|---|---|---|
| color / color-temp | `0x33/0x05` | `05 15 …` | shared 0x15 color format (subtypes 1–4, below) | capability spec + `base2light/.../ColorModeControllerConfig` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi>` | 16-bit **little-endian** effect code (generic newdetail scene frame; fanlight defines no speed byte) | `base2light/ble/controller/AbsModeController` + `ScenesOp` |
| DIY effect | `0x33/0x05` | `05 0A <diyLo> <diyHi>` | 16-bit LE DIY code (inferred: newdetail DIY container) | `SubMode4Diy` (base) |
| music | `0x33/0x05` | `05 13 <musicCode> <sensitivity>` | sensitivity 0..99 (inferred: newdetail music container) | base music sub-mode |
| read_mode | `0xAA/0x05` | `05 01` | `p()` = `{1}` | `AbsModeController.p()` |
| read color group | `0xAA/0xA5` | `A5 <group>` | response `[0]=group`, then 4 × `brightness,R,G,B` | `base2light/kt/general_controller/Controller4ColorInfoByGroup.java` |

Fanlight declares `ColorInstructionVersion.COLOR_MODE_0X15` and
`RelativeBrightnessVersion.RELATIVE_BRIGHTNESS_0X15`
(`capability/FanlightLightCapabilitySpecKt.java`), with **9** color pieces (H1310) and
**14** (H1370). The concrete 0x15 layout (identical instruction version, see the
floorlamp H60B1 implementation `SubModeColor.getWriteBytes()`):

```
payload[0] = 0x15
subtype 1 (RGB + temp, 14 bytes):
  01 R G B CT_H CT_L R2 G2 B2 M0 M1 M2 M3
  CT = 16-bit big-endian color-temperature value (0 when pure RGB)
  R2G2B2 = temperature RGB
  M0..M3 = 32-bit segment mask, bit n = segment n included (LSB first)
subtype 2 (brightness apply, 5 bytes): 02 <brightness 0-100> M0 00 00
subtype 3 (brightness set, 17 bytes): 03 <b0..b13>  pad
subtype 4 (strip group, 3+3n bytes): 04 <groupIndex> R G B [R G B …]
```

For fanlight the segment counts are 9/14, so only the first 9/14 mask bits are meaningful.
Exact per-SKU clamping of subtype 3/4 is applied by `ColorPieceConfig` / `ColorModeControllerConfig`.

### 3.3 Auto program (H1370 / sensor-bound H1310)

Read `0xAA/0x32` payload `{0x01}` (`sensor/SensorBleReads.d()` →
`Controller4ExtBytes.b({50,1})`). Response payload after the status byte:

```
[1]=onGear [2..3]=onTemp (int16 LE, °F×100) [4]=keepGear [5..6]=keepTemp (int16 LE, °F×100)
```

Write is embedded in fan mode 3 (`31 03 01 00 03 <6 bytes>`), generated by
`FanAutoProgram.j()`: `[onGear, onTempHi, onTempLo, keepGear, keepTempHi, keepTempLo]`.
Defaults: H1310 → `onGear=3, keepGear=6`; H1370 → `0/15`; invalid/0 temp falls back to
26.0 °C / 30.0 °C (`FanAutoProgram.f=260`, `h=300`). Gear is clamped to the SKU max.
`Support.d()` is the gear clamp; `FanAutoProgram.e()` converts °F×100 → °C tenths.

---

## 4. BLE notifications / readings

| op | parser | layout |
|---|---|---|
| `0x30` | `DefParser.makeFanlightSwitchNotifyParser` | `[1]` overall switch, `[2]` main light, `[3]` back light (each `==1`) |
| `0x31` | `DefParser.makeFanlightInfoNotifyParser` | `[0]` sub-type: 0 → fan on (`[1]==1`); 1 → gear `[1]`; 2 → reverse (`[1]==1`); 3 → shake signed int16 **LE** `[1..2]`; 4 → auto/standby (`[1]==1`) |
| `0x20` | `DefParser.makeBrightnessNotifyParser` | `[0]` brightness 0–100 |
| `0x40` | `DeviceStatusNotifyParse` | first 10 payload bytes forwarded as `EventDeviceStatus` |
| `0xA4` | `makeRemoteControlNotifyParser` | `[0]` remote pairing/status byte |
| `0x11` | `WifiNotifyParse` | `[0]==0` → WiFi connected |
| music | `MusicNotifyParse` (onlinesound) | music spectrum/status frames |

Heartbeat is `0xAA/0x01`; a read result with non-zero `[0]` means online.

Additional base reads used by the detail page (`Compose4BaseInfoSingleRead`): timers
`0xAA/0x23` (4 timers), sleep `0xAA/0x11`, wakeup `0xAA/0x12`, brightness `0xAA/0x04`,
mode `0xAA/0x05 {01}`, color group `0xAA/0xA5 <group>` (4 × `brightness,R,G,B`).
Soft/hard version reads are also issued but their cmdType is runtime-configured by
`ControllerSoftVersion` / `ControllerHardVersion`.

---

## 5. IoT commands + status/readings schema

`pact/IotSwitchCmdBuilder.java` implements commands as `IotMsgProType.V2`
(`IotMsgV2`); settings/detail use the generic V1-style `state` + `op` JSON.

### Commands

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0/1}` | `base2light/kt/iot/CmdTurn` via `IotSwitchCmdBuilder` |
| `brightness` | `{"val":1..100}` | `CmdBrightness` (`Opacity` builder uses `Comm`/dialog, base) |
| `colorwc` | `{"colorTemInKelvin":2700..6500}` or `{"red","green","blue"}` | `CmdColorWc` (`AbsEffectOp4BleIot.getRoomOp4Iot`) |
| `ptReal` | `{"command":["<base64 20-byte frame>", …]}` | `Cmd4PtReal` / `CmdPtReal` (scene, DIY, color strips, fan sequence) |
| `status` / `online` | read (`type=0`) | `AbsIotManagerV1` status flow |

Outgoing envelope (V0/V1 `Write`): `msg.{transaction,accountTopic,type=1,origin=32,
cmdVersion,cmd,data}`. V2 incoming parsed as `IotMsgV2` (`cmd`, `cmdVersion`, `type`,
`proType`, `device`, `sku`, `softVersion`, `transaction`).

### Status

```
state: { onOff:int, brightness:int, colorTemInKelvin:int, mode:int }
op.command: [ base64(20-byte BLE frame), … ]   // 0x31 fan frames, 0x05 mode frames,
                                               // 0x41 color-strip frames, 0x11/0x12/0x23
```

`VM4Light.F1()` rebuilds all switches (`open`, main, back, fan, reverse), gear
(`s3`), reverse (`t3`), shake (`u3`) from `Info4Detail` + `ptReal` frames, then refreshes
color strips (`Controller4ColorInfoByGroup`, 4 pieces per read group).

### TH sensor binding (optional accessory)

- bind MAC read: `0xAA/0x08`, payload `{08}`; response 6-byte MAC (reversed order).
- sensor data read: `0xAA/0x10`, payload `{10}`; `SensorBleParser.f()`:
  `[0]` bit0 online, bit7 built-in; `[1..3]` packed temperature **24-bit little-endian**
  (unit 0.001 °C, bit23 = sign: 0 positive, 1 negative); `[4]` offset minutes;
  `[5]` unit (`1` = °F, else °C). `0xFFFFFF` = no reading.
- heartbeat `0xAA/0x01` variant: `SensorBleParser.d()` expects `[0]=0xAA,[1]=0x00`,
  then `[0]` online, `[1..3]` packed temp, `[4]` offset, `[5]` auto-standby,
  `[7]` unit.
- auto program read `0xAA/0x32` (section 3.3).

No humidity field is parsed by fanlight (`SensorReading` humidity slots are null).

---

## 6. Other protocols

| name | details | source |
|---|---|---|
| Matter | not enabled for these SKUs. `Ble.r()` returns `com.govee.matter.pact.BleComm`, but only UUID/heart plumbing; no Matter add/pair config. | `ble/Ble.java` |
| WiFi / LAN | no dedicated MQTT/LAN class in the split; device is BLE+cloud IoT. Large payloads use `ptReal` / `ptUrl` generically. | — |
| BLE remote | 2.4 GHz remote pairing via `0xA4` / `0xA6`; `EventPair`, `EventPairNotify`, `EventRemoteControlInfo` expose the result. | `ble/RemoteController.java`, `ble/ExitRemoteController.java` |
| TH broadcast | sensor binding only (section 5, `0x08`/`0x10`/`0x32`). | `sensor/*` |

---

## 7. Dynamic effects / motion / music / scenes / DIY

### Fan behaviours (H1370)

| mode id | name | payload |
|---|---|---|
| 0 | direct 直吹 | `31 03 01 00 00` |
| 1 | sleep 睡眠 | `31 03 01 00 01` |
| 2 | natural 自然 | `31 03 01 00 02` |
| 3 | auto 自动 | `31 03 01 00 03 <6 auto bytes>` |

Additional attributes: gear 1..12, reverse 0/1, shake 0/1; gear max 6 on H1310.
Auto program maps temperature → gear (on/keep) and is sensor-driven.

### Scene effects

16-bit LE effect codes (`05 04 lo hi`). Scene catalogue/categories come from cloud
(`ScenesM`/`ScenesOp`); local UI groups are `Support.l()`: `{0,1,2,3,5}` (H1310) and
`{0,1,2,3,6,5}` (H1370). Advanced/scene-v1 effects are multi-packet
`AbsMultipleControllerV14Scenes` sent via `ptReal` (`CmdPtReal.getNewScenesCmdPtReal`),
optionally followed by a mode frame. `ScenesConfigBean(2, 0, groups, …)` is the detail UI config.

### DIY

Two independent DIY builders:

**H1310** (`h1310/diy/Pro4H1310Diy.java`) — a two-part effect blob:

```
[0..1] = total length, big-endian 16-bit
[2]    = mainProLen
[3..]  = mainPro bytes
[..]   = subProLen
[..]   = subPro bytes
```

- mainPro: `[0]=effectType` (0 none, **1 渐变 TiaoBian, 2 单入单出 DanRuDanChu, 3 呼吸 HuXi,
  4 色温 SeWen**), `[1]=len`, then type-specific bytes (`h1310/diy/*MainLight.java`).
- subPro: `[0]=on (1)`, `[1]=len`, `[2]=effectType` (**1 渐变, 2 单入单出, 3 呼吸, 4 色温,
  5 跑马灯 PaoMaDeng, 6 绽放 ZhanFang, 7 堆叠 DuiJi, 8 萤火 YingHuo, 9 反复 FanFu**),
  then type-specific bytes (`h1310/diy/*SubLight.java`).
- Upload: `MultiController.a(bytes, (byte) 0x58)` → proType `0xA3`, cmdType `0x58`,
  payload `[lenHi,lenLo,blob]`, multi-packet V1; then mode `0x05/0x0A` with DIY code **254**
  (`0x0A FE 00`).
- DIY capability codes: `DiyM.EffectCode` groups 0/1/4/5 + mix `255`; max 8 colors/effect,
  speed 1..100 (default 50); `H1310DiyConfig` adds effect codes **795** and **812**.

**H1370** (`h1370/diy/*`) — `H1370DiyEffect` / `H1370EffectBean`, upload code **0x58**
(`H1370DiyParse.getEffectCode()`), 11 basic effect types (IDs **1..7, 10, 8, 9, 11**),
optional advanced DIY (`H1370AdvanceDiyEffect`). Color/speed/direction parameter objects
are `DiyColorParams` / `DiySpeedParams` / `DiyDirectionParams`.

### Music

`05 13 <musicCode> <sensitivity 0..99>`; microphone/online music UI (`h1310/OnlineMusicConfig`,
`h1370/OnlineMusicConfig`), realtime mic mode (`DelegateOnlyMic`), music notify parser.
Color-music effects are animated by the phone microphone; no segment payload over BLE
except the music sub-mode.

### Light ring

9 segments (H1310) / 14 (H1370) addressed by the 0x15 segment mask; per-segment color
groups are produced by `ColorModeControllerConfig` and, for IoT, converted to `ptReal`
frame lists (`makeSetColorOpBytes` → `ColorModeControllerConfig.k()`).

---

## 8. Source map

- SKUs/registration: `pact/SubMaker.java`, `pact/SubLib.java`, `Support.java`
- UUIDs/comm: `ble/BleComm.java`, `ble/BleMultiComm.java`, `ble/Ble.java`
- fan/switch controllers: `ble/ControllerFan.java`, `ble/ControllerSubSwitch.java`
- remote: `ble/RemoteController.java`, `ble/ExitRemoteController.java`, `ble/BleProtocol.java`
- notifications: `ble/BleNotifyComm.java`; base `base2light/kt/general_parser/DefParser.java`
- sensor: `sensor/SensorBleParser.java`, `sensor/SensorBleReads.java`, `sensor/SensorBleProtocol.java`, `sensor/HeartbeatSensorParse.java`
- auto program: `h1370/FanAutoProgram.java`, `adjust/VM4Light.java`
- capability/color: `capability/H1310LightCapabilityProvider.java`, `capability/H1370LightCapabilityProvider.java`, `capability/FanlightLightCapabilitySpecKt.java`
- scenes/DIY/music: `pact/AbsEffectOp4BleIot.java`, `pact/OpSceneCommDialog4BleIot.java`, `h1310/diy/*`, `h1370/diy/*`
- IoT: `pact/IotSwitchCmdBuilder.java`, `pact/OpCommDialog4BleIotV1.java`, `adjust/VM4Light.java`, base `base2light/iot/*`
- UI/state: `adjust/VM4Light.java`, `h1310/DelegateHeaderH1310.java`, `h1370/DelegateHeaderH1370*.java`

---

## 9. Gaps / unknowns

1. **0x15 color payload per SKU** is inferred from the shared `COLOR_MODE_0X15`
   instruction version (the fanlight split has no `SubMode*` class of its own). Subtype 3/4
   byte counts are clamped by `ColorPieceConfig`; exact padding beyond 9/14 pieces is runtime.
2. **Scene effect catalogue** is cloud-driven; only category IDs and the 16-bit LE wire
   format are static.
3. **Music codes** are cloud/`OnlineMusicM` supplied; the split only fixes the 0x13 payload shape.
4. **Fan gear semantics** (H1370 has 12 UI gears) are not mapped to RPM; gear is passed
   verbatim (1..12).
5. No dedicated LAN/MQTT code; WiFi devices use IoT cloud `ptReal`.


---

<!-- split_pact_floorlamp -->

# split_pact_floorlamp — floor lamps (H6071/H6075, H60B0/H60B3/R60B3, H60B1)

Source root: `decompiled/jadx-splits/split_pact_floorlamp/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

---

## 1. Overview / family and SKUs

Three independently registered sub-families share one split (the prompt also called out
"straightfloorlamp", but that family's code lives in `split_pact_hollowlamp`):

| SKU | goodsType | family | light engine | transports | source package |
|---|---|---|---|---|---|
| H6071 | 57 | floor lamp, CCT only | brightness + color temp, no RGB | ble + iot | `com/govee/h6071` |
| H6075 | 67 | floor lamp, CCT only | brightness + color temp, no RGB | ble + iot | `com/govee/h6071` |
| H60B0 | 301 | floor lamp, 9-segment RGBIC + 2 zone lights | 0x0D color, scenes/music/DIY, operate mode | ble + iot (+ matter pairing) | `com/govee/h60b0` |
| H60B3 | 301 | floor lamp (same goods type, different DIY set) | 13 ceiling / 7 upper / 3 lower DIY effects | ble + iot (+ matter pairing) | `com/govee/h60b0` |
| R60B3 | 301 | floor lamp variant (same goods type) | as H60B0/H60B3 | ble + iot (+ matter pairing) | `com/govee/h60b0` |
| H60B1 | 300 | RGBICWW floor lamp, 3 color pieces | 0x15 color, 32-bit segment mask, scenes+music/DIY | ble + iot (+ matter pairing + local MQTT) | `com/govee/h60b1` |

Evidence:

- H6071/H6075: `h6071/pact/Support.java` (`c="H6071"`, `d="H6075"`, `e={57,67}`),
  `SubMaker` adds `BleIotSkuItemV1(57/67)` extending `AbsBleWifiSku`.
- H60B0 group: `h60b0/Support.java` (`c="H60B0"`, `d="H60B3"`, `e="R60B3"`, `v={301}`);
  devices are `AbsDeviceModel4BleIot`; Matter pairing via `ConfigH60B0` `MatterInterceptor`.
- H60B1: `h60b1/pact/H60B1Support.java` (`d={300}`), `H60B1Maker extends AbsBleWifiSku`;
  add flow uses `/base2light/common/NormalWifi` + `MatterInterceptor`.

All six are **ble+iot**: BLE GATT plus cloud/WiFi (`turn`/`brightness`/`colorwc`/`ptReal`).
H60B0/H60B3/R60B3 and H60B1 additionally expose Matter commissioning through the base
Matter module, and the DIY dialogs can use the device's **local MQTT** channel
(`DeviceCommCapability.supportMqtt`) for large `ptUrl` payloads.

Key ranges:

| item | H6071/H6075 | H60B0/H60B3/R60B3 | H60B1 |
|---|---|---|---|
| brightness | 1–100 | 1–100 | 1–100 |
| kelvin | 2200–6500 | 2700–6500 | 2700–6500 |
| color pieces | none (CCT) | 9 | 3 (declared) |
| scene groups | `{0}` | `{1,0,5,4,6}` | `{0,2,3,5}` |
| scene default | — | 22 (`0x16`) | 2002 |

---

## 2. Transports & GATT UUIDs

| family | service | characteristic |
|---|---|---|
| H6071/H6075 | `00010203-0405-0607-0809-0a0b0c0d1910` | `00010203-0405-0607-0809-0a0b0c0d2b11` |
| H60B0 group | `00010203-0405-0607-0809-0a0b0c0d1910` | `00010203-0405-0607-0809-0a0b0c0d2b11` |
| H60B1 | `00010203-0405-0607-0809-0a0b0c0d1910` | `00010203-0405-0607-0809-0a0b0c0d2b11` |

Write proType `0x33`, read `0xAA`, multi-packet write `0xA3`.
`H60B0.ble.Ble.r()` returns `com.govee.matter.pact.BleComm` (same UUIDs).
Frame: `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC`.
Read data available to parsers = frame bytes `[2..18]`; write results = `[3..18]`.
`AbsModeController.p()` = `{0x01}` (read current mode).

---

## 3. BLE frame + command table

### 3.1 Common (all three families)

| name | op | payload | layout | response | source |
|---|---|---|---|---|---|
| power | `0x33/0x01` | `01 <0/1>` | `[0]` state | `0xAA/0x01` → `[0]` | `base2light/ble/controller/SwitchController.java` |
| brightness | `0x33/0x04` | `04 <1..100>` | `[0]` 1–100 | `0xAA/0x04` → `[0]` | `base2light/ble/controller/BrightnessController.java` |
| heartbeat | `0xAA/0x01` | `01` | — | `[0]` alive | `base2light/ble/controller/HeartController.java` |
| read mode | `0xAA/0x05` | `05 01` | `p()`=`{1}` | mode + sub-mode | `AbsModeController` |
| read color group | `0xAA/0xA5` | `A5 <group>` | response `[0]=group`, then 4 × `brightness,R,G,B` | `0xAA/0xA5` | `base2light/kt/general_controller/Controller4ColorInfoByGroup.java` |

### 3.2 H6071 / H6075 (CCT-only floor lamp)

| name | op | payload | layout | source |
|---|---|---|---|---|
| color temp | `0x33/0x05` | `05 15 04 <kelvinLo> <kelvinHi>` | sub-mode 0x15, flag 0x04, kelvin 16-bit **little-endian**, clamped 2200–6500 | `h6071/ble/SubModeColor.java` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi> <speed>` | effect 16-bit **little-endian**; speed byte default `0xFF` | `h6071/ble/SubModeScenes.java` |
| read mode | `0xAA/0x05` | `05 01` | returns sub-mode 0x04 or 0x15 | `AbsModeController` |
| security key write | `0x33/0xB2` | `<raw secret bytes>` | base64 secret decoded to bytes, written verbatim | `base2light/ble/controller/SecretKeyController.java` |
| security key read | `0xAA/0xB1` | — | 8-byte result | same |

H6071/H6075 have **no RGB** (`SmartRoomOp.onlySupportBrightness() == true`,
`makeSetColorOpBytes` returns null). Pairing/secret key is the only "extra" command.

### 3.3 H60B0 / H60B3 / R60B3 (goods 301)

| name | op | payload | layout | source |
|---|---|---|---|---|
| color | `0x33/0x05` | `05 0D R G B CT_H CT_L R2 G2 B2` | sub-mode 0x0D; CT is a 16-bit **big-endian** value (kelvin when white mode); R2G2B2 = temperature RGB; 9 bytes | `h60b0/ble/SubModeColor.java` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi> <speed>` | effect 16-bit **LE**, speed byte (default 0) | `h60b0/ble/SubModeScenes.java` |
| music | `0x33/0x05` | `05 13 <musicCode> <sensitivity>` | sensitivity 0–99 | `h60b0/ble/SubModeMusic.java` |
| DIY | `0x33/0x05` | `05 0A <diyLo> <diyHi>` | 16-bit LE DIY code | `h60b0/ble/SubModeNewDiy.java` |
| advanced scene | `0xA3/0x5B` | V3 packetisation (see below) | multi-packet, last group followed by `05 04 <eff>` | `h60b0/pact/Comm.java` `a()` / `makeSceneCmd4MulIotComm` |
| DIY upload | `0xA3/<diy.cmd>` | multi-packet V1, then `05 0A <code>` | `CmdPtReal` list; payload from `DiySendData` | `h60b0/pact/Comm.java` `makeDiyCmd4IotCommMulti` |
| scene read/status | `0xAA/0x42` | `42 <bits>` | switch bits: bit8 overall, bit7 left/zone, bit6 right/zone (as parsed) | `h60b0/adjust/h60b0/Info4Detail.java D()` |
| detail/other read | `0xAA/0x41` | `41` | `[1]` value (on-off memory/splicing) | `Info4Detail.G()` |
| timer read | `0xAA/0x23` | `23` | 4 timers (NewTimerV1) | `NewTimerV1Controller` |
| sleep/wake reads | `0xAA/0x11` / `0xAA/0x12` | `11` / `12` | Sleep/WakeUp info | `SleepController` / `WakeUpController` |

Advanced-scene packetisation: `MultipleControllerCommV1.makeSendBytesV3(0xA3, 0x5B, paramBytes, 97)`
produces groups of 20-byte frames. The `K()` / `makeSendBytesV3` layout is:

```
first/only packet: [0]=0xA3 [1]=0 [2]=2 [3]=totalPackets [4]=0x5B
                   [5]=groupCount [6]=groupIndex [7..14]=verify/random
                   [15..18]=first 4 data bytes
middle packets:    [0]=0xA3 [1]=packetIndex [2..18]=17 data bytes
final packet:      [0]=0xA3 [1]=0xFF [2..]=tail data
```

Each group is sent as a `CmdPtReal`; the mode frame `05 04 <scene code>` is appended to the
last group.


### 3.4 H60B1 (goods 300)

| name | op | payload | layout | source |
|---|---|---|---|---|
| color 0x15 | `0x33/0x05` | `05 15 <subtype…>` | see below | `h60b1/ble/SubModeColor.java` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi> <music0..3 LE> <speed/dir>` | 8 bytes: effect 16-bit LE, 32-bit LE music code (0 if none), direction/speed byte | `h60b1/ble/SubModeScenes.java` |
| music | `0x33/0x05` | `05 13 <musicCode> <sensitivity>` | 0–99 | `h60b1/ble/SubModeMusic.java` |
| DIY | `0x33/0x05` | `05 0A <codeLo> <codeHi> <code2Lo> <code2Hi>` | 2× 16-bit LE codes | `h60b1/ble/SubModeNewDiy.java` |
| color strip group | `0x33/0x05` | `05 15 04 <group> R G B [R G B …]` | group index + up to 4 RGB triples | `h60b1/pact/Comm.java` `a()` |
| brightness group | `0x33/0x05` | `05 15 03 <group> b0..b13` | 14 brightness values per group | `h60b1/pact/Comm.java` `d()` |

H60B1 0x15 payload detail (`SubModeColor.getWriteBytes()`, 17-byte buffer):

```
[0] = 0x15
subtype 1 (RGB + CT + segment mask):
  [1]=01 [2..4]=R,G,B
  [5..6]=CT big-endian (0 = pure RGB)
  [7..9]=temperature RGB
  [10..13]=32-bit segment mask (bit n = piece n, LSB first)
subtype 2 (brightness):
  [1]=02 [2]=brightness 0..100 [3..6]=32-bit piece mask
subtype 3 (brightness set):
  [1]=03 [2..16]=brightness values
subtype 4 (strip group): [1]=04 [2]=group index [3..]=RGB groups (4 per 0x15 frame)
```

Piece count declared **3** for goods 300 (`H60B1Support.b()`), color-temp range 2700–6500.

### 3.5 Color-temp normalization

- H6071/H6075: `Support.getColorTemKelvinRange()` = `{2200,6500}`;
  `getInvalidKelvin()` clamps.
- H60B0: `Support.d()` = `{2700,6500}`; `Constant.getTemColorByKelvin` gives
  `{flag, kelvin, rgb}`.
- H60B1: `H60B1Support.c()` = `{2700,6500}`, `NumberUtil.getValidRangeValue`.

---

## 4. BLE notifications / readings

### H6071/H6075 (`h6071/ble/BleNotifyComm.java`)

| op | parser | layout |
|---|---|---|
| `0x20` | `BrightnessNotifyParse` | `[0]` brightness |
| `0x30` | `ColorTemNotifyParse` | `[0..1]` unsigned 16-bit big-endian kelvin |
| `0x11` | `WifiNotifyParse` | `[0]==0` → WiFi connected |

### H60B0 group (`Ble$generateNotify$1`)

| op | parser | layout |
|---|---|---|
| `0x11` | `DefParser.makeWifiNotifyParser` | `[0]==0` → WiFi connected |
| `0x40` | `DeviceStatusNotifyParse` | first 10 bytes forwarded (`EventDeviceStatus`) |

Mode/status is otherwise read back from `ptReal` frames:
`0x05` mode (sub-mode 0x04/0x0A/0x13/0x14/0x2C), `0x41`, `0x42`, `0x11`, `0x12`, `0x23`
(`h60b0/adjust/h60b0/Info4Detail.java`). H60B0 mode byte map:

| mode byte | meaning | UI mode |
|---|---|---|
| `0x04` | scene | 10 (or 11 when DIY-studio scene) |
| `0x0A` | DIY | 11 (12 for code 800) |
| `0x13` | music | 8 |
| `0x14` (20) | interaction / hu dong | 18 |
| `0x2C` (44) | operate (zone) | 19 |

Operate (0x2C) read layout (`operate/SubMode4Operate.java`):
`[0..1]` int16 LE CT(top), `[2]` brightness(top), `[3..4]` int16 LE CT(bottom),
`[5]` brightness(bottom); color data carries 9 pieces (8 top + 1 bottom).

### H60B1 (`h60b1/ble/BleNotifyComm.java`)

| op | parser | layout |
|---|---|---|
| `0x11` | `WifiNotifyParse` | `[0]==0` WiFi |
| `0x20` | `BrightnessNotifyParse` | `[0]` brightness |
| `0x30` | `DeviceSwitchStatusNotifyParse` | `[0]==1`, `[1]==1` main switch, `[2]==1` second switch |
| `0x40` | `DeviceStatusNotifyParse` | 10 bytes |
| music | `MusicNotifyParse` (onlinesound) | music frames |
| `0x60` | `MovieFeastOnOffNotifyParse` | movie-feast on/off (`[0]==1`, `[1]`) |

---

## 5. IoT commands + status/readings schema

### Commands

| cmd | data | families | source |
|---|---|---|---|
| `turn` | `{"val":0/1}` | all | `h6071/iot/CmdTurn`, `base2light/iot/CmdTurn` |
| `brightness` | `{"val":1..100}` | all | `h6071/iot/CmdBrightness`, `base2light/iot/CmdBrightness` |
| `colorwc` | `{"colorTemInKelvin":…}` and/or `{"red","green","blue"}` | all | `h6071/iot/CmdColorWc`, base `CmdColorWc` |
| `ptReal` | `{"command":["<base64 20-byte frame>",…]}` | all | `h6071/iot/CmdPtReal`, `base2light/pact/iot/CmdPtReal` |
| `status` | read (`type=0`) | all | `AbsIotManagerV1` |
| `online` | read | all | `AbsIotManagerV1` |
| `ptUrl` | `{"url":…}` + `{"command":base64}` | H60B0/H60B1 DIY/MQTT | `CmdPtUrl` (base `light.AbsOpCommDialog4BleIot`) |

Outgoing envelope: `msg.{transaction,accountTopic,type=1,origin=32,cmdVersion,cmd,data}`;
switch builder parses `IotMsgProType.V2` / `IotMsgV2`.

### Status schemas

H6071/H6075 (`h6071/iot/CmdStatusV0.java`):

```
state: { onOff:int, brightness:int, mode:int, colorTemInKelvin:int }
op.command: [base64 frame, …]
  frame[1]==0x05  -> mode (color-temp sub-mode 0x15)
  frame[1]==0x23  -> timers (4)
  frame[1]==0x11  -> sleep
  frame[1]==0x12  -> wakeup
```

H60B0 (`Info4Detail.E()`):

```
state: { onOff:int, brightness:int }
op.command frames:
  0x41 -> on-off memory / splicing value
  0x42 -> switch bits (bit8 overall, bit7, bit6)
  0x05 -> mode + sub-mode (0x04/0x0A/0x13/0x14/0x2C)
  0x11 -> timer, 0x12 -> wakeup, 0x23 -> new timers
  0x42/0x41 etc. trigger change-flags 1..6 for UI refresh
```

H60B1: same `state`/`op` envelope; scene `0x04` frames also carry a 32-bit music code,
color read-back is via `0x15` frames from `ptReal`.

H60B1 advanced scenes: `Comm.makeSceneCmd4MulIotComm` builds `CmdPtReal` frames
`0xA3/0x5B` + `05 04` effect. H60B0 same with 97-byte chunks.

---

## 6. Other protocols

| name | details | source |
|---|---|---|
| Matter | H60B0/H60B3/R60B3 and H60B1 are Matter-commissionable: `MatterInterceptor` in the add config, `MatterManager`/`MtGuide` in settings, `AddDeviceConfig.isSupportMatter(...)`, `com.govee.matter.pact.BleComm` for GATT. No Matter cluster/attribute table is defined in the split — commands still travel as Govee BLE/IoT frames. | `h60b0/ConfigH60B0.java`, `h60b1/add/AddDeviceM.java`, `h60b1/detail/H60B1SettingActivity.java` |
| local MQTT | Large DIY payloads use `CmdPtUrl` over local MQTT when `DeviceCommCapability.supportMqtt(...)` is true and a topic exists (`Iot.r.v()`), otherwise cloud IoT. MQTT is not used for normal control. | `h60b1/pact/bleiot/OpDiyCommDialog4BleIot.java`, base `device/DeviceCommCapability.java` |
| WiFi provisioning | `/base2light/common/pair`, `/base2light/common/name`, `/base2light/common/NormalWifi`; 32/64-char SSID/password limits (`Support.getWifiInputLimit`). | `h60b1/add/AddDeviceM.java`, `h60b0/ConfigH60B0.java` |
| BLE remote | H60B1/H60B0 pairing events only (no dedicated 0xA4 controller in these sub-families). | — |

---

## 7. Dynamic effects / motion / music / scenes / DIY

### H60B0 / H60B3 / R60B3

- **9-segment color**: 8 top pieces + 1 bottom piece; `Support.assembleNineSegmentColor()`
  expands shorter color sets to 9 by repeating the last value.
- **Scenes**: 16-bit LE effect code, groups `{1,0,5,4,6}`; advanced scenes use
  `MultiNewScenesControllerH60B0.getController(sceneCode, decryptedParam)` and
  `ScenesOp` categories; `0xA3/0x5B` multi-packet then `05 04`.
- **Music**: `05 13 <code> <sens>`; mode byte `0x13`; music codes from `H60B0MusicMode`
  (e.g. 130, 131, 51, 81, 83, 80, 48, 49), player state from onlinesound.
- **DIY**: `05 0A <code>`; upload blob starts with byte `0x50`, length LE16, then effect
  data; effects `DiyM.EffectCode.h/t/m/g` (= 0, 5, 1, 255) with AI categories 28/29/30;
  H60B0 DIY support adds extra code `H60B0DiyNewConfig.t`.
- **H60B3 DIY**: three independent blobs in one 0x50 container —
  `[0]=0x50 [1..2]=len LE16 [3]=upperLen [4..]=upper [..]=lowerLen [..]=lower [..]=ceilingLen [..]=ceiling`.
  Effect type IDs: upper **1..7** (`ShangLightPro`), lower **1..3** (`XiaLightPro`),
  ceiling **1..13** (`CeLightPro`). Hairdryer-style effect families:
  渐变/呼吸/闪烁/彩虹/流光/流星/扩散/交错/微光/分层/… (see the `*Light.java` classes).
- **Operate (zone) mode 0x2C**: two independent zone lights (top 8 segments, bottom 1),
  each with CT + brightness + color list; read layout in section 4.
- **Interaction mode 0x14**: gesture/clap interaction container (`SubMode4HuDong`).

### H60B1

- **Scenes**: default code **2002**; groups `{0,2,3,5}`; 0x04 payload
  `04 <effLo> <effHi> <musicCode 4B LE> <dir/speed>`.
- **Music**: 0x13, sensitivity 0–99; mic mode; `OnlineMusicM`.
- **DIY**: 0x0A with two 16-bit codes; upload via `0x50` blob (`H60B1` DIY support uses
  `DiyM.EffectCode.C0/t/l/D/y/C/R0/S0`, i.e. codes 67, 5, 0, 15, 9, 14, 82, 83; AI
  categories 28 + `D0`=68).
- **Color**: 0x15 with up to 32 segment bits and color-strip groups of 4 RGB; brightness
  groups of 14 values.
- **Movie feast**: notified on `0x60`.

### H6071/H6075

Only CCT + brightness + scene effect (16-bit LE, speed byte). No RGB/music/DIY.

---

## 8. Source map

- H6071/H6075: `h6071/pact/Support.java`, `SubMaker.java`, `SubLib.java`, `ble/*`, `iot/*`, `scenes/*`
- H60B0 group: `h60b0/Support.java`, `ConfigH60B0.java`, `ble/*`, `pact/Comm.java`, `pact/bleiot/*`, `adjust/h60b0/*`, `adjust/h60b0/diy/*`, `adjust/h60b0/diy/h60B3/*`, `adjust/h60b0/music/*`, `adjust/h60b0/operate/*`, `vm/VM4H60B0.java`
- H60B1: `h60b1/pact/H60B1Support.java`, `pact/Comm.java`, `ble/*`, `pact/bleiot/*`, `detail/*`, `diy/*`, `add/*`
- base: `base2light/ble/controller/{Switch,Brightness,Heart,SecretKey,AbsMode,AbsModeController}.java`, `base2light/iot/*`, `base2light/pact/newdetail/*`, `device/DeviceCommCapability.java`, `matter/*`

---

## 9. Gaps / unknowns

1. **H60B0 operate (0x2C) write payload** is produced by the generic newdetail color
   framework (`SubMode4Color` + `ColorModeControllerConfig`); only the read layout is
   statically explicit in the split.
2. **H60B0 interaction (0x14)** layout comes from base `SubMode4HuDong`; not decoded here.
3. **Scene catalogues** (effect IDs/names, advanced scene params) are cloud-served
   (`ScenesM`/`ScenesOp`/`MultiNewScenesControllerH60B0`); only the wire format is static.
4. **H60B1 "3 color pieces"** is what `H60B1Support.b()` returns; the 0x15 format supports
   up to 32 segment bits, so the real hardware piece count could be larger at runtime.
5. H60B0/H60B3/R60B3 share goodsType 301; which DIY/effect set is active is decided by
   `DiyNewConfig` registration + SKU, not by a separate goods type.
6. **Matter** cluster mapping is not in this split; it is delegated to the base Matter
   module, and Govee BLE/IoT frames remain the control path.
7. MQTT is used only for large `ptUrl` DIY payloads, not for routine control.


---

<!-- split_pact_h1161 -->

# split_pact_h1161 — Govee Sync / pickup-box light controller (H1161)

Source root: `decompiled/jadx-splits/split_pact_h1161/sources/`

> The assignment guessed “appliance”. It is a **light-sync controller** (“Govee Sync”):
> one H1161 box drives up to 5 sub-devices (light bars / bulbs) with per-device colors,
> brightness, music and on/off.

---

## 1. Overview / family and SKUs

| SKU | goodsType | role | transport | notes |
|---|---|---|---|---|
| H1161 | 32 | Govee Sync controller / pickup box | ble | controls up to 5 sub-devices (marks 0..4); per-device color + music |

Registry: `pact/Support.java` (`a="H1161"`, `d={32}`,
`getDefDeviceName` → “Govee Sync”, `getMaxSupportDevice()=5`),
`pact/SubMaker.java` (`BleSkuItem`), `pact/SubLib.java` (`Item.b()`),
`pact/Register4Item.java`.
Pact: goodsType 32 supports `beProtocol(1,1)`, `(1,2)`, `(2,2)`.
`pact/Model extends AbsDeviceMode4Ble`; `pact/DeviceItem extends AbsBleItem`;
`SmartRoomOp4H1161.supportBle()==true`, `supportWifi()==false`,
`getRoomOp4Iot()==null` → **BLE-only**.

Sub-device model: `adjust/v1/ExtV1` stores `DeviceInfo` entries
(`sku`, `device`, `goodsType`, `bleName`, `bleAddress`, `mark`, `currentCmdV`, `status`)
and `DeviceColor{sku,color,goodsType,spec,bleAddress}` plus `SubModeMusic` and a
`DeviceInfoWithColor` list. `newdetails/bean/H1161Device*` mirror the cloud payloads.

---

## 2. Transports & GATT UUIDs

| item | value |
|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` |
| frame | 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` |
| write | `0x33` |
| read | `0xAA` |
| multi | `0xA3` (V1/V2 `MultipleControllerComm*`) |
| notify | `0xEE` |

`ble/BleComm.java`, `BleMultiComm.java`, `BleNotifyComm.java`.
No IoT/Wi-Fi transport; `SmartRoomOp4H1161` explicitly returns `supportWifi=false`.
Cloud interaction is limited to bind / device-list persistence
(`newdetails/net/IPickUpApi`, `SaveDeviceRequest`, `SortData`, `SupportDeviceListData`).

---

## 3. BLE frame + command table

`ble/BleProtocol.java`:

| const | value | meaning |
|---|---|---|
| `single_open` | 16 (`0x10`) | master on/off |
| `single_brightness` | 17 (`0x11`) | brightness |
| `sub_mode_color` | 20 (`0x14`) | color mode |
| `sub_mode_music` | 15 (`0x0F`) | music mode |
| `sub_mode_music_new` | 19 (`0x13`) | new music mode |
| `value_sub_mode_music_soft` | 0 | mild |
| `value_sub_mode_music_power` | 1 | dynamic |
| `value_music_mode_rhythm` | 4 | rhythm |
| `single_value_sub_rhythm` | 48 | rhythm |
| `single_value_sub_zhanfang` | 49 | bloom |
| `single_value_sub_cuican` | 50 | bright drill |
| `single_value_sub_bolang` | 51 | wave |
| `single_value_sub_jiepai` | 52 | beat |
| `single_value_sub_pinpu` | 53 | spectrum |
| `single_value_sub_gundong` | 54 | rolling |
| `value_device_num` | 64 (`0x40`) | device count |
| `value_device_info` | 65 (`0x41`) | device info |
| `value_clear_device` | 66 (`0x42`) | clear device list |
| `value_op_device` | 67 (`0x43`) | operate sub-device |
| `value_setting_device` | 48 (`0x30`) | set device list |
| `notify_brightness` | 32 (`0x20`) | brightness notify |
| `value_connect_status_notify` | 64 (`0x40`) | status notify |
| `value_device_flag_4_ble_address` | 0 | address flag |
| `value_device_flag_4_ble_name` | 1 | name flag |

| command | op | payload | layout | source |
|---|---|---|---|---|
| master on/off | `0x33/0x10` | `on` | `[0]=0/1` | `ble/OpenController.q` |
| read on/off | `0xAA/0x10` | – | `[0]` state | `OpenController.parseValidBytes` |
| brightness | `0x33/0x11` | `value` | 0–100 | `ble/BrightnessController.q` |
| read brightness | `0xAA/0x11` | – | `[0]` value | `BrightnessController` |
| color/music mode | `0x33/0x05` | see §7 | `[0]=submode` | `ble/ModeController`; `SubModeMusic` |
| read mode | `0xAA/0x05` | `[1]` | base `AbsModeController.p()` | `ModeController` |
| device count | `0xAA/0x40` | – | `[0]` count (negative = fail) | `ble/DeviceNumController` |
| device info | `0xAA/0x41` | `pos` | `[0]=pos`; response address (flag 0) or name (flag 1 + length) | `ble/DeviceInfoController` |
| operate sub-device | `0x33/0x43` | `pos, on` | `[0]=pos,[1]=on?0:1` (note inverted in code) | `H1161VM4Light.r5` |
| set device list | `0xA3/0x30` | multi-packet | `[count, entry…]` | `ble/MultiDeviceController` |
| clear devices | `0x33/0x42` | `pos…` or `FF` | clear listed or all | `ble/ClearDeviceController` |
| music multi | `0xA3/0x41` | `MusicController` blocks | base `MultipleController4Music` | `newdetails/music/H1161NewMusicMode` |
| heart | `0xAA/0x01` | – | base | `SmartRoomOp4H1161.heartBytes()` |
| switch (room op) | `0x33/0x01` | `on` | base | `SmartRoomOp4H1161.makeSwitchOpBytes` |

### 3.1 Device-list packet (`0xA3/0x30`)

`MultiDeviceController` builds one logical payload:

```
[count]
per device:
  [mark][flag][cmdVersion]
  if flag==0 (BLE address): 6 bytes address, reversed (AA:BB:CC:DD:EE:FF → FF EE DD CC BB AA)
  if flag==1 (BLE name):    [nameLen][name UTF-8…]
```
`flag` 0 = address (`value_device_flag_4_ble_address`), 1 = name
(`value_device_flag_4_ble_name`). `mark` is the 0-based slot index assigned by the
app; `cmdVersion` is the sub-device’s protocol version. Sent through
`AbsMultipleControllerV1` (proType `0xA3`, cmdType `0x30`).

### 3.2 Device-info reply (`0x41`)

- flag 0: `[pos,0,addr6,?,version]` → address string + version at `[8]`.
- flag 1: `[pos,1,nameLen,name…,version]` → name string + version at `[nameLen+3]`.
Version is the sub-device protocol version used for `mark/cmdVersion`.

### 3.3 Operate sub-device (`0x43`)

`{0x43, pos, (status==0)?1:0}` — the code inverts the desired state because
`status` is the *reported* state. Success turns the slot on/off.

---

## 4. BLE notifications / readings

| notify | parser | layout | source |
|---|---|---|---|
| `0x20` | `BrightnessNotifyParse` | `[0]` brightness 0–100 | `ble/BrightnessNotifyParse` |
| `0x40` | `DeviceStatusNotifyParse` | 5 bytes copied to `EventH1161.EventDeviceStatus` | `ble/DeviceStatusNotifyParse` |
| `0x41` | `ResetDeviceNotifyParse` | factory-reset event (no payload) | `ble/ResetDeviceNotifyParse` |
| `0x05` | mode read | see §7 | `ModeController` |
| `0x10` | open read | `[0]` on/off | `OpenController` |

The 5-byte `0x40` status block is exposed raw to the UI
(`EventH1161.EventDeviceStatus`); `H1161NewInfo4Detail` maps it into
`DeviceInfo.status` for the sub-device list.

---

## 5. IoT commands + status/readings schema

No IoT transport in this split. The only cloud-facing pieces are:
- bind (`pact/BindExt`, shared `device/rest/devices/v1/bind`),
- sub-device list persistence (`newdetails/net/IPickUpApi`):
  `SaveDeviceRequest`, `SortData`, `SupportDeviceListData`, `DeviceGroupData`,
  `DeviceBean`.
- `CmdTurn` is imported (`newdetails/H1161VM4Light.switchTrigger`) only to build a
  cloud “sync command” snapshot; the actual control is the BLE `0x01` frame.

Scene/room control: `SmartRoomOp4H1161` implements `IRoomOp4Ble` with the H1161
service/characteristic and returns empty color/brightness byte arrays (those are
handled by the detail page, not the room shortcut).

---

## 6. Other protocols

- **BLE pairing**: `add/BleBroadcastProcessor`, `ConnectDialog*`, `PairAcV1`
  (secret key + switch), `add/AddInfo`.
- **Cloud persistence**: `IPickUpApi` for the sub-device list, sort order, and
  supported-device catalogue.
- **No Wi-Fi / MQTT / LAN / Matter** (`supportWifi=false`, `getRoomOp4Iot=null`).

---

## 7. Dynamic effects / music / scenes / DIY

### 7.1 Music mode (`0x05/0x0F`)

`ble/SubModeMusic.d()` (8 bytes):

```
0F effect sensitivity enable colorful? R G B
```
- `effect`: 4 = rhythm (default); other sub-values defined:
  48 rhythm, 49 bloom, 50 bright-drill, 51 wave, 52 beat, 53 spectrum, 54 rolling.
- `sensitivity`: 0–99.
- `enable`: 1/0 (music effect enabled).
- `colorful?`: byte 4 is `1` when not fixed-color, `0` when fixed color.
- `R G B`: fixed background color when `colorful? == 0`.

Parse mirrors it: `[1]=effect`, `[2]=sensitivity`, `[3]=enable`, `[4]==0` → fixed
color from `[5..7]`; effect 4 is the only one with color fields.

### 7.2 Color mode (`0x05/0x14`)

The split imports the shared new-detail `SubMode4Color` (`H1161VM4Light` implements
`IColorModeFuc`), but the actual byte writer is **not in this split**. The H1161
constant `sub_mode_color=20 (0x14)` indicates the submode byte; the shared
`SubMode4Color` supplies per-segment RGB + brightness. Treat the exact color payload
as shared-framework behavior (see `base2light/pact/newdetail/sub/SubMode4Color`).

### 7.3 Per-device color list

`H1161NewInfo4Detail` keeps `DeviceInfoWithColor` entries (one color per sub-device
slot, from `ExtV1.d[]` / `SubMode4Color.d[]`), and `H1161DelegateColorV2Part`
updates them. The wire format is the shared multi-segment color packet; slots are
identified by `mark`/order.

### 7.4 Music multi-packet

`H1161NewMusicMode` builds a `MultipleController4Music` (base cmd `0x41`) with
sensitivity, effect and color bytes, plus a `ControllerMode` frame. Use
`MultipleBleBytes.getMultipleWriteBytesV2` packetization (proType `0xA3`).

### 7.5 Scene / sync

`H1161VM4Light` applies scene snapshots through the shared `ISceneFuc`
(`H1161NewDetailsConfig`), which ultimately writes the same `0x05/0x14` and
multi-color frames. The box then forwards color to each marked sub-device.

---

## 8. Source map

| area | paths |
|---|---|
| registry | `pact/{Support,BleSkuItem,SubLib,SubMaker,Register4Item,Model,DeviceItem}.java` |
| BLE | `ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol,OpenController,BrightnessController,ModeController,SubModeMusic,MultiDeviceController,DeviceInfoController,DeviceNumController,ClearDeviceController}.java` |
| notify | `ble/{DeviceStatusNotifyParse,BrightnessNotifyParse,ResetDeviceNotifyParse}.java` |
| state/model | `adjust/v1/ExtV1.java`, `newdetails/bean/*`, `newdetails/net/*` |
| detail | `newdetails/H1161VM4Light.java`, `H1161NewInfo4Detail.java`, `H1161NewDetailsConfig.java`, `detail/color/*`, `detail/music/*`, `detail/header/*` |
| scenes | `SmartRoomOp4H1161.java` |
| pairing | `add/*` |

---

## 9. Gaps / unknowns

- The **per-device color payload** is produced by the shared `SubMode4Color`
  framework, not by a class in this split; only the submode byte (`0x14`) is defined
  here. Exact segment/mark layout must be read from the base module.
- The `0x40` 5-byte status block is passed through raw; its field meanings
  (per-slot on/off vs. connection state) are only partially inferred.
- `MultiDeviceController` supports both address and name entries, but the app always
  populates address when available; name mode is a fallback.
- H1161 is BLE-only; the `CmdTurn` import is for cloud scene snapshots, not a
  transport.
- `getMaxSupportDevice()=5`, but `mark` values and colors are cloud-assigned; the
  device list must match the cloud list or slots desync.


---

<!-- split_pact_h3a5x -->

# split_pact_h3a5x — H3A51 / R3A51 / H3A52 / H3A53 branch light strings

Source root: `decompiled/jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/`

## Overview / family and SKUs

`pact/Support.java` defines one goods-type (386) shared by four SKUs. All extend
`AbsBleWifiSku` → `ble + iot`; `pact/Model extends AbsDeviceModel4BleIot`.

| SKU | default light count | notes |
|---|---|---|
| H3A51 | 32 | `Support.b` |
| R3A51 | 32 | `Support.c` |
| H3A52 | 63 | `Support.d` (32 if unknown) |
| H3A53 | 84 | `Support.e` (32 otherwise) |

- `Support.g`/`h`/`i` = `{386}`.
- `Support.d()`/`g()` protocols: `GoodsType.beProtocol(1,1)`, `(1,2)`, `(1,3)`.
- `Support.getColorSize()` = **1** (one addressable colour per frame; per-IC colours are done
  with bitmasks/segment-IC writes).
- `Support.supportSceneOp(386)` = `{0,1,2,3,5,6}`.
- `Support.isH3A5xPactV3OrAbove(pactType,pactCode)`: pactType≥1 && pactCode≥3.
- Branch topology model: `bean/BranchTopologyOrder`, `BranchBean`, `BranchCaliBean`,
  `SegmentBean`; capabilities in `capability/H3A5XLightCapabilityProvider`.

## Transports & GATT UUIDs

- Service `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/BleComm.java`, `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`
- `Ble.u()` → `BlePtRealMultiComm`; `Ble.v()` → `BleMultiComm`.
- Notify: `WifiNotifyParse` (base2light connect), `BrightnessNotifyParse`,
  `MovieFeastOnOffNotifyParse`, `DeviceStatusNotifyParse`.

## BLE frame + command table

Frame `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`; write 0x33, read 0xAA;
multi V2 uses `AbsMultipleControllerV2` (proType 0xA4, 20-byte packets with a 2-byte
`{cmdType,p()}` header).

`ble/BleProtocol.java`:

| const | dec | hex | use |
|---|---|---|---|
| music sub-mode | 19 | 0x13 | music |
| color sub-mode | 21 | 0x15 | colour |
| scenes sub-mode | 4 | 0x04 | scenes |
| new-DIY sub-mode | 10 | 0x0A | DIY |
| brightness notify | 32 | 0x20 | brightness |
| direction | 22 | 0x16 | direction write/read |
| segment IC multi | 67 | 0x43 | per-segment IC write (multi V2, p=10) |
| enable segment IC | 68 | 0x44 | enable/disable segment write |
| read segment info | 64 | 0x40 | segment topology read |
| segment calibration | 74 | 0x4A | calibration V2 |
| up/down calibration | 75 | 0x4B | branch calibration |

| command | op | payload | response | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `[0]=0|1` | read `0xAA/0x01` | base `SwitchController`; `scenes/H3A5XSceneCmdBuilders$registerWith$3` |
| heartbeat | `0xAA/0x01` | none | `[0]!=0` | base `HeartController` |
| brightness | `0x33/0x04` | `[0]=0..100` | read `0xAA/0x04`; notify `0x20` | base `BrightnessController`; `pact/Comm` |
| mode | `0x33/0x05` | sub-mode block | `0xAA/0x05` | `pact/ModeController`, `pact/Mode` |
| direction | `0x33/0x16` | `[0]=!forward?1:0` | read callback → `[0]==0` = forward | `ble/controller/SettingDirectionController.java` |
| read segment info | `0xAA/0x40` | none | `ble/controller/ReadSegInfoController` | `ReadSegInfoController.java` |
| segment IC write | `0xA4/0x43` | `[0]=enable, [1..]=IC style bytes` (`p()=10`) | `SetSegmentIcMultiController.t` | `SetSegmentIcMultiController.java`, `SetSegmentIc4ModeController.java` |
| enable segment IC | `0x33/0x44` | `[0]=!enable?1:0` | `EnableSetSegmentIc4ModeController` | `EnableSetSegmentIc4ModeController.java` |
| segment calibration | `0x33/0x4A` | branch calibration bytes | `SegCaliControllerV2` | `SegCaliControllerV2.java` |
| up/down calibration | `0x33/0x4B` | calibration action bytes | `UpDownCaliController` | `UpDownCaliController.java` |

`SegmentStyleIcInfo` (read from 0x40): `style`, `totalBranchCount`,
`totalColorSegmentCount`, `branchColorSegmentCounts[]`, `totalIcCount`, `branchIcCounts[]`.

### Colour sub-mode (0x15)

`newdetail/color/SubModeColor.getWriteBytes()` (17-byte payload):

```
[0]=0x15
if per-segment brightness mode (a==true):
  [1]=03 [2..16]=brightness per segment (up to 15 values)
else if per-piece brightness (e!=0):
  [1]=02 [2]=brightness [3..6]=32-bit segment bitmask for segments 0..31 (4 bytes)
else:
  [1]=01 [2..4]=R G B
  if kelvin!=0: [5..6]=kelvin LE16, [7..9]=temp R G B
  [10]=bits0-7 [11]=bits8-15 [12]=bits16-23 [13]=bits24-31 (segment mask)
```

`parse()` reads kelvin from `validBytes[1..2]` (LE16) and derives the temp RGB from
`Support.getColorTemRange(goodsType,pactType,pactCode)`.

## BLE notifications / readings

| notify | parser | layout |
|---|---|---|
| 0x11 | base `WifiNotifyParse` | `[0]==0` connected |
| 0x20 | `ble/notify/BrightnessNotifyParse` | `[0]` brightness |
| 0x40 | base `DeviceStatusNotifyParse` | first 10 bytes → EventDeviceStatus |
| 0x60 | base `MovieFeastOnOffNotifyParse` | `[0]==1 [1]==1` on |
| 0x01 | base switch/heart | `[0]!=0` |

## IoT commands + status/readings schema

`pact/Comm` uses base2light IoT classes (`CmdTurn`, `CmdBrightness(brightness,0,2)`,
`CmdColorWc`), envelope `CmdBuilder.makeCmdStr`, `IotMsgProType.V2` for responses.

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0|1}` | `com/govee/base2light/kt/iot/CmdTurn` |
| `brightness` | `{"val":0..100}` | `com/govee/base2light/kt/iot/CmdBrightness` |
| `colorwc` | `{"color":{r,g,b},"colorTemInKelvin":int}` | `com/govee/base2light/iot/CmdColorWc` |
| `status` | `state` on/off, `op` frame bytes | `H3A5XSceneCmdBuilders$registerWith$6` |

Switch builder (`H3A5XSceneCmdBuilders$registerWith$6`) parses `IotMsgV2`, matches
`transaction`, success when `cmd=="status"`.

## Other protocols

- WiFi/cloud IoT via device topic (MQTT, base IoT manager). No LAN/UDP/Matter.
- `ptUrl` path used by graffiti: `H3A5XDiyAdvancedGraffitiParse` builds
  `PtUrlDataInfo(sku, device, base64({88,0}+payload), pactType, pactCode, softVersion, hardVersion)`.

## Dynamic effects / motion / music / scenes / DIY

- **DIY/graffiti codes** (`newdetail/diy`):
  - base DIY `H3A5XDiyParse.getProtocolCode()=88 (0x58)`, code **950**.
  - advanced graffiti `H3A5XDiyAdvancedGraffitiParse`: code **953/954/955** (`e`,`f`,`g`),
    selected by region/branch count (`H3A5XGraffitiDiyEffectCode.a(i)`), protocol prefix 0x58.
  - advanced overlay `H3A5XDiyAdvancedOverlayParse`: code **973**, prefix 0x58.
  - `DiyControllerNoEventV7(DiySendData(254, toBytes(), protocolCode))`; final mode frame
    `0A <diy LE16>` with diy code 254 (0xFE) marker.
- **Effect types** (`newdetail/diy/effect/EffectTypeH3A5X.java`) — exact byte ids:
  Fade 1, Breathing 2, Flickering 3, Rainbow 4, Water 5, RunningLantern 6, Diffusion 7,
  Flow 8, Fireworks 9, Collision 10, Yuedong 11, AdvancedBreathing 34, JiaoCuo 35.
- `SubEffectType`: None 0, First 1, Second 2, Third 3, Fourth 4.
- `Region`: Up 1, Down 2. `ColorType`: UNIFY 0, PARTITION 1.
  `ApplicationType`: Same/Diff/None. `Direction`: Clockwise/Counterclockwise/Left/Right/
  CONGREGATE/DISPERSE/None. `InterlaceDirection`: Left; `InterlacePositionToggle`: Off/On.
- **Graffiti page byte layout** (`bean/GraffitiDataH3A5XKt.d`):
  `layerPriority, secondaryEffectCode, layerSpeed(0..max), layerBrightness(0..max),
   colorGroupCount, {icCount, R,G,B, icIndex*}, baseColorGroupCount, {branchCount,R,G,B, branchIndex*}`.
  `GraffitiDataH3A5X.toPayloadBytes()` = `displayMode, totalPages, {pageIndex, len LE16, pageBytes}*`.
  Full payload prefixed `0x82` (`BleProtocol.f`) then sent as multi-packet; overlay uses
  `MultiController` code 98 (0x62).
- **Scenes**: `Support.supportSceneOp(386)` = `{0,1,2,3,5,6}`; scene frames via
  `ScenesOp.parseSceneV1` / `parseEffect`, then `0x04 <effect LE16>` final mode frame.
- **Music**: `pact/MusicFeastOp` registers DIY music support; music sub-mode 0x13.
- **Branch/IC model**: `H3A5XGraffitiBranchColorMaps`, `BranchCaliBean`, `SegmentBean`;
  segment-IC write enables per-IC colour on branch topology.

## Source map

- `pact/Support.java`, `SubLib.java`, `SubMaker.java`, `Comm.java`, `Mode.java`,
  `ModeController.java`, `Model.java`, `MusicFeastOp.java`
- `ble/Ble*.java`, `BleProtocol.java`, `notify/BrightnessNotifyParse.java`,
  `controller/{ReadSegInfoController,SetSegmentIcMultiController,SetSegmentIc4ModeController,EnableSetSegmentIc4ModeController,SegCaliControllerV2,UpDownCaliController,SettingDirectionController,SegmentStyleIcInfo}.java`
- `scenes/H3A5XSceneCmdBuilders*.java`, `scenes/AbsBleV1.java`, `scenes/AbsIotV1.java`
- `newdetail/color/SubModeColor.java`, `newdetail/diy/*`, `newdetail/diy/effect/*`
- `bean/Graffiti*.java`, `bean/ColorGroup*.java`, `bean/Branch*.java`, `bean/SegmentBean.java`
- base: `com/govee/base2light/ble/controller/AbsMultipleControllerV2`,
  `com/govee/base2light/kt/general_controller/MultiController`

## Gaps / unknowns

- Graffiti effect payload bodies are serialised from UI state (`GraffitiDataH3A5X`) — resolved
  only at apply time; the per-effect parameter objects (`EffectFlow`, `EffectFireworks`, ...)
  encode their own byte strings, not fully decoded here.
- `ReadSegInfoController` reply layout is parsed by `SegmentStyleIcInfo` construction but the
  exact per-byte offsets are inside the controller's `parseValidBytes` (topology is
  device-reported).
- `UpDownCaliController` / `SegCaliControllerV2` enum `CaliAction` / `SubsequentBranchType`
  are only partially restored by jadx.
- `H3A5XScrawlGraffitiConfig` / overlay combination mapper (`H3A5XOverlayCombExtMapper`) has
  server/cache-driven layer limits (`H3A5XOverlayEffectBytesFactory.c`).
- Brightness scaling for h3a5x is not overridden → raw 0..100.


---

<!-- split_pact_h512x -->

# split_pact_h512x — sensors (motion, door/window, button, vibration, pressure, presence)

Source root: `decompiled/jadx-splits/split_pact_h512x/sources/`

> The assignment guessed “heater/thermostat”. It is **not** a heater family: this is
> the H512x **sensor** family (PIR motion, door/window, button, vibration, pressure
> mat, and the H5127 mmWave presence sensor).

---

## 1. Overview / family and SKUs

Two registries:

### 1.1 H5121–H5130 broadcast/trigger sensors (`h512x`, `h5121`)

Each SKU has its own `config/hXXXX/HXXXXConfig.java` and registers a
`SupportConfig` pact and `SensorPush` push handler. They are **battery sensors**:

| SKU | goodsType | sensor | battery | special |
|---|---|---|---|---|
| H5121 | 130 | Motion Sensor | 1×CR2450 | 3 distance levels (near/mid/far), interval, gasket guide |
| H5122 | 131 | Button Sensor | 1×CR2032 | single/double/long press semantics |
| H5123 | 132 | Door and Window Sensor | 1×CR1632 | open/close |
| H5124 | 139 | Vibration Sensor | 1×CR2032 | vibration/tilt |
| H5125 | 144 | Button Remote | 1×CR2032 | multi-button remote |
| H5126 | 145 | Button Switch | 1×CR2032 | button events |
| H5129 | 206 | Outdoor Motion Sensor | 2×CR123A | 3 distance levels (80/40/20), Li-Sen switch |
| H5130 | 238 | Pressure Sensor (mat) | 1×CR2450 | pressure threshold/sensitivity, has/no-pressure times, light display |

`SupportConfig` maps goodsType→protocol:
130/206/238 all `beProtocol(2,1)`; `h512x/H512xAppImp` registers each SKU with
`ModelMaker`, `Register4Item`, `BleProcessorManager` (`SkuItemClickEvent`),
`SensorPush`, and a theme icon.
Transports: **BLE broadcast + BLE setup connection + cloud push**. The puck is not a
Wi-Fi device; events are delivered as push (`h512x/push/SensorPush`) and the last
state is cached in `DeviceExtMode` (`Item/LastData`). BLE is used for pairing and
for the H5121/H5129/H5130 settings (`needBle() == true`).
`H5127` is a separate cloud+BROADCAST device (see below).

### 1.2 H5127 presence sensor (`h5127`)

| SKU | goodsType | sensor | transport | notes |
|---|---|---|---|---|
| H5127 (dynamic `H5127_<suffix>`) | 183 | mmWave presence sensor | ble + iot + ble-broadcast | pairing advert `GVH5127…`; config over BLE; status over IoT `op` frames |

`Support.b="H5127"`, `Support.d={183}`, `Pact.beProtocol(1,1),(2,1)`.
`BleBroadcast4H5127` parses adverts whose manufacturer data starts `0201050c09`
with `BleBroadCastInfo.version()==1 && protocol()==3`, name `GVH5127…`; the SKU is
`"H5127_"+suffix`, goodsType from `Pact.d.e(skuPart)`, protocol from the advert.
`Model` implements `IIotOnline` and polls `status`/`online` on the device topic.

---

## 2. Transports & GATT UUIDs

| item | H5121–H5130 | H5127 |
|---|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` | same |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` | same |
| alt char (BLE V1) | `00010203-0405-0607-0809-0a0b0c0d2b10` (`BleComm.v`) | – |
| frame | 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` | same |
| write/read | `0x33` / `0xAA` | same |
| extra | BLE broadcast adverts for pairing | BLE broadcast + IoT `op` |

`h5121/ble/commV1/BleComm` uses the `base2newth` `AbsThGattCallback`; isSelfComm
accepts `…1910` + `…2b10` with proType `0xAA`/`0x33`. `h5121/ble/other/CommonBleComm`
uses `…1910`/`…2b11` for H5130. H5127 `BleComm` reuses the H5121 V1 UUID strings.

Advertisement:
- H5121–H5130: `SkuItemClickEvent.o` decodes the advert by hex offsets:
  name = bytes[10..30], `bdType` = [38..40], device id = [42..58], hard = [58..60],
  soft = [60..62]. No event payload is parsed here; events come from push.
- H5127: `BleBroadcast4H5127.parse` requires `0201050c09…`, `version==1`,
  `protocol==3`; name `GVH5127<suffix>`; SKU `H5127_<suffix>`; device id from advert.

---

## 3. BLE frame + command table

### 3.1 H5121 / H5129 motion sensors

`h5121/ble/BleProtocol.java`: level constants 1/2/3/4/5/6 and 5 (event types).
Controllers use `base2newth.AbsSingleController` with `i()` payloads.

| command | op | payload | layout | source |
|---|---|---|---|---|
| distance level (H5121) | `0x33/0x01` | `threshold pulse window level` | level 0 → `45,1,1,0`; level 1 → `20,1,1,1`; other → `20,1,1,level` | `h5121/ble/commV1/CommandDistanceLevel.java` |
| read distance level | `0xAA/0x01` | – | same 4 bytes; `45/1/1` = level 0, `20/1/1` = level 1, else raw level at [3] | same |
| distance level (H5129) | `0x33/0x01` | `threshold pulse window level` | level 0 → `80,1,0,0`; 1 → `40,1,0,1`; 2 → `20,1,0,2`; other → `20,1,0,level` | `CommandDistanceLevel4H5129.java` |
| read distance level (H5129) | `0xAA/0x01` | – | `80/1/0`, `40/1/0`, `20/1/0` recognised | same |
| check interval | `0x33/0x02` | `seconds` | default 60 | `CommandIntervalTime.java` |
| read interval | `0xAA/0x02` | – | `[0]` seconds | same |
| Li-Sen switch (H5129) | `0x33/0x03` | `on` | leave-sensing enable | `Command4H5129LiSenSwitch.java` |
| read Li-Sen | `0xAA/0x03` | – | `[0]` 0/1 | same |

Distance levels are interpreted as near/mid/far (H5121: 45/20/other; H5129: 80/40/20).
The units are the firmware’s threshold value, not a published distance.

### 3.2 H5130 pressure sensor

`h5121/ble/other/*` controllers, `CommonBleComm` (`…1910`/`…2b11`):

| command | op | payload | layout | source |
|---|---|---|---|---|
| current pressure | `0xAA/0x02` | – | `[0]` raw pressure level | `Controller4CurPressure` |
| pressure threshold | `0x33/0x03` | `level` | slider 1–10 | `Controller4PressureThreshold` |
| read threshold | `0xAA/0x03` | – | `[0]` level | same |
| has-pressure time | `0x33/0x04` | `secBE16` | seconds | `Controller4HasPressureTime` |
| read has-pressure time | `0xAA/0x04` | – | BE16 | same |
| no-pressure time | `0x33/0x05` | `secBE16` | seconds | `Controller4NoPressureTime` |
| read no-pressure time | `0xAA/0x05` | – | BE16 | same |
| light display | `0x33/0x06` | `on` | LED display enable | `Controller4LightIsDisplay` |
| read light display | `0xAA/0x06` | – | `[0]` 0/1 | same |

Notify `0x05` = current pressure (`NotifyParse4CurPressure` → `Event4CurPressure`).
The write ACK uses `[0]==0` as success (`Compose4WriteH5130`).

### 3.3 H5127 presence sensor

`ControllerProtocol`: `5 = config params`, `7 = some ext`, `0x1A (26) = radar sensitivity`,
`0xB5 = sync time`, `1 = header/heartbeat`, `0x20/0x21 = wifi hard/soft`,
`0x10 = wifi mac`, `0x1F = only-idf-human`, `0x24 = te range`.

| command | op | payload | layout | source |
|---|---|---|---|---|
| read header/heartbeat | `0xAA/0x01` | – | `[0] status,[1..2] distance BE16,[6..9] duration BE32` | `Controller4Header`; `H5127ParseUtils.d` |
| check mode read | `0xAA/0x05` | `[0]` | `[0]=0` | `Controller4CheckMode.a` |
| check mode write | `0x33/0x05` | `00 03` | enables check mode | `Controller4CheckMode.b` |
| config params read | `0xAA/0x05` | `[1]` | `[0]=1` | `Controller4ConfigParams.a` |
| config params write | `0x33/0x05` | `01 distBE16 nhBE16 hhBE16` | check distance + no-human/has-human judge times | `Controller4ConfigParams.b` |
| te range read | `0xAA/0x05` | `[3]` | `[0]=3` | `Controller4TeRange.a` |
| te range write | `0x33/0x05` | `03 00 valid startBE16 endBE16` | target-exclusion range | `Controller4TeRange.b` |
| radar sensitivity read | `0xAA/0x1A` | `[4]` | `[0]=4` | `Controller4RadarSensitivity.a` |
| radar sensitivity write | `0x33/0x1A` | `04 level` | level | `Controller4RadarSensitivity.b` |
| only-idf-human read | `0xAA/0x1F` | – | `[0]` 0/1 | `Controller4OnlyIdfHuman.a` |
| only-idf-human write | `0x33/0x1F` | `01 on` | | `Controller4OnlyIdfHuman.b` |
| sync time | `0x33/0xB5` | `ts32BE 01 tzH tzM` | | `Controller4SyncTime` |
| read ext block | `0xAA/0x07` | `02/03/0A/0B` | device id / ble hard / mcu soft / mcu hard | `Controller4SomeExt` |
| wifi mac | `0xAA/0x10` | – | 6-byte MAC | `Controller4WifiMac` |
| wifi soft/hard | `0xAA/0x21` / `0xAA/0x20` | – | version blocks | `Controller4WifiSv/Hv` |

H5127 heartbeat event (`notify 0x01`) → `Event4NotifyBleHeartInfo` with
`[status, distanceBE16, durationBE32]`. `0x24` notify → target-exclusion range.

---

## 4. BLE notifications / readings

| notify | parser | layout | source |
|---|---|---|---|
| `0x01` | `NotifyParse4BleHeart` / `Controller4Header` | `[0]` check status, `[1..2]` distance BE16, `[6..9]` status duration BE32 | `h5127/ble/notify/NotifyParse4BleHeart.java`; `H5127ParseUtils.d` |
| `0x24` | `NotifyParse4TeRange` | `[0]=1`, `[3..4]` start BE16, `[5..6]` end BE16 | `NotifyParse4TeRange.java` |
| `0x05` (H5130) | `NotifyParse4CurPressure` | `[0]` current pressure level | `h5121/ble/other/NotifyParse4CurPressure.java` |
| wifi set result | `NotifyParse4WifiSetResult` | onboarding result | `h5127/ble/notify/NotifyParse4WifiSetResult.java` |

H5121–H5130 do not parse sensor events over a GATT notify; they receive push events
and cache `LastData{logType, logTime, online, bind}`. `logType` enumerates the event
kind (motion/button/door/vibration/pressure etc.); the SKU config maps icons/text.

H5127 `H5127LastDeviceData` caches `checkStatus`, `distance`, `statusDuration`,
`installWay`, `isBleBroadcast`, `isIotConnected`, `refreshStatusTime`.

---

## 5. IoT commands + status/readings schema

### 5.1 H5127 (`op` frames over IoT)

`Model.t` (IIotOnline) subscribes to the device topic and parses `status` + `op`:

```json
{"cmd":"status","op":{"command":["<base64 20-byte frame>"]}}
```
`H5127ParseUtils.e` walks each frame:
- cmd `0x01` header → `[status, distance, duration]`
- cmd `0x1F` only-idf-human → `[0]==1`
- cmd `0x05` sub `1` → `{checkDistance, nhJudgeTime, hhJudgeTime}`
- cmd `0x05` sub `3` → `{teStart, teEnd}`
- cmd `0x1A` sub `4` → radar sensitivity
Then `Model` sets `checkStatus` from `H5127ParseUtils.a(bArr)` (`[24]` of the
20-byte frame) and updates `H5127LastDeviceData`.

Status fields:
| field | unit |
|---|---|
| checkStatus | enum/int (presence state) |
| distance | cm/level (BE16) |
| statusDuration | seconds (BE32) |
| installWay | 0/1/2/3 |
| checkDistance | config |
| nhJudgeTime / hhJudgeTime | seconds (BE16) |
| teStart / teEnd | target-exclusion range |
| radarSensitivity | level |
| onlyIdfHuman | bool |
| bleSv/bleHv/wifiSv/wifiHv/wifiMac | version strings |

`H5127IotPush` shows push notifications with the same `H5127LastDeviceData`.

### 5.2 H5121–H5130

No IoT control commands. Events arrive as **push** (`SensorPush`), and the cached
`LastData` is stored in device ext. REST is limited to bind (`device/rest/devices/v1/bind`)
and (H5127) the install-way/notification settings (`h5127/net/INet4H5127`).

---

## 6. Other protocols

- **BLE broadcast**: pairing only. H5121–H5130 name/ID/version offsets in
  `h512x/add/SkuItemClickEvent`; H5127 `0201050c09…`, version 1, protocol 3.
- **Push**: `h512x/push/SensorPush`, `h5127/push/H5127IotPush`.
- **REST**: bind + H5127 `INet4H5127` (`Request4SelectedInstallWay`).
- **LAN/MQTT/Matter**: none in this split.

---

## 7. Dynamic effects / scenes / DIY

Not applicable (sensors). “Modes” are detection settings:

| family | settings |
|---|---|
| H5121 | distance level 0/1/2, interval seconds |
| H5129 | distance level 0/1/2, interval, Li-Sen switch |
| H5130 | pressure threshold 1–10, has-pressure time, no-pressure time, LED display |
| H5127 | check mode, check distance, nh/hh judge times, te range, radar sensitivity, only-idf-human |

---

## 8. Source map

| area | paths |
|---|---|
| H512x registry | `h512x/H512xAppImp.java`, `h512x/Constant512x.java`, `h512x/AbsH512xConfig.java`, `h5121/SupportConfig.java` |
| per-SKU config | `h5121/config/h5121..h5130/*.java` |
| H5121 BLE | `h5121/ble/commV1/*`, `h5121/ble/other/*`, `h5121/ble/BleProtocol.java` |
| H5130 | `h5121/ble/other/{Controller4CurPressure,Controller4PressureThreshold,Controller4HasPressureTime,Controller4NoPressureTime,Controller4LightIsDisplay,Compose4ReadH5130,Compose4WriteH5130}.java` |
| H5127 | `h5127/ble/controller/*`, `h5127/ble/notify/*`, `h5127/utils/H5127ParseUtils.java`, `h5127/pact/*`, `h5127/push/*` |
| common | `h512x/item/*`, `h512x/detail/*`, `h512x/add/*` |

---

## 9. Gaps / unknowns

- The assignment’s “heater/thermostat” guess is wrong; these are sensors.
- Distance levels are firmware thresholds, not documented centimetres. H5121 uses
  45/20, H5129 uses 80/40/20.
- H5121–H5130 event payloads are not in the split (they arrive via push and are
  reduced to `LastData.logType`); the `logType`→event-name mapping is in resources.
- `SupportConfig` only registers pact protocols for goods types **130/206/238**
  (H5121/H5129/H5130). H5122/H5123/H5124/H5125/H5126 have their own goods types in
  their configs but no `Pact.d.a(...)` call in this split, so their pact registration
  happens elsewhere (shared sensor registry). Treat their pactType/pactCode as unknown.
- H5127 heartbeat `checkStatus` semantics and the meaning of frame byte `[24]` are
  not fully named; `H5127LastDeviceData` treats it as an enum.
- H5127 uses a dynamic SKU `H5127_<suffix>` derived from the advert name; the cloud
  product must know that SKU.
- H5129 “Li-Sen” (leave-sensing) is a single boolean; its exact detection semantics
  are firmware-side.


---

<!-- split_pact_h5901 -->

# split_pact_h5901 — H5901 water timer / irrigation gateway

Source root: `decompiled/jadx-splits/split_pact_h5901/sources/com/govee/h5901/`

## Overview / family and SKUs

Single SKU **H5901** ("Water Timer"), goodsType **363** (`Support.b`, `Support.d`).
It is a **BLE gateway** for sub-device water timers plus an IoT/MQTT path
(`ble + iot`). `pact/H5901Maker extends AbsBleSku`, `pact/H5901SubLib` keys from
`Support.c()` = `[363]`, `pact/Register4Item` registers `H5901SubLib`.

- `pact/H5901Maker` pairs via `H5901PairGuideActivity`, BLE name filter `"5901"`.
- `pact/AbsH5901Item` → `Item32` UI, `pact/GwSubH5901ItemImpl`, `pact/H5901Holder`.
- `pact/H5901DeviceItem`, `pact/H5901Model`, `pact/H5901BleItem`.
- Sub-device model: `bean/Device.java`, `bean/H5901DeviceInfo.java`,
  `bean/PairReadDeviceInfo.java`, `bean/GatewayInfo` (base2newth).
- Plans: `bean/IrrigationPlanInfo.java`, `IrrigationPlanModel.java`, `StageRule.java`,
  `TaskTimeRange.java`, `SyncPlanReq.java`, `PlanListRsp.java`, `PlanIdListRsp.java`,
  `ChartTaskReq/Resp`, `H5901LastData.java`, `H5901Settings.java`, `Settings.java`.
- Support protocols: `GoodsType.beProtocol(1,1)` and `(1,2)` for 363.

## Transports & GATT UUIDs

Gateway (H5901) uses **Telink-style custom UUIDs** (`ble/H5901BleComm.java`):

- Service: `494e5445-4c4c-495f-524f-434b535f4857`
- Characteristic (write/notify): `494e5445-4c4c-495f-524f-434b535f2011`
- Additional characteristics: `...2012`, `...2013` (`W`, `X`)
- `H5901BleComm.getCharacteristicUuid()` = `V` (…2011), `getServiceUuid()` = `Q` (…4857).
- Multi-packet comm: `MultiControllerComm(address, handler, service, char)`.
- `H5901GattCallbackImp` wraps `CommEventGattCallback` and diverts to `OtaManager4TeLinkV2`
  while OTA is active.

Legacy sub-device/direct path (`ble/H5044GWBleComm.java`):

- Service `00010203-0405-0607-0809-0A0B0C0D1910`
- Characteristic `00010203-0405-0607-0809-0A0B0C0D2B11`
- Alternate `00010203-0405-0607-0809-0A0B0C0D2B10`

Also present: `ble/H5901Ble.java`, `ble/H5901BleDataComm.java`, `ble/H5901GWBleManager.java`,
`ble/H5901PairBle.java`/`H5901PairBleCommon.java`, `ble/H5044GWBle.java`.

## BLE frame + command table

Frame `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`; write 0x33, read 0xAA.
`constant/H5901BleProtocol.java` (byte constants):

| const | dec | hex | use |
|---|---|---|---|
| b | 16 | 0x10 | sync time + timezone |
| c | 14 | 0x0E | soft version read |
| d | 13 | 0x0D | hard version read |
| e | 15 | 0x0F | MAC address read |
| f | 12 | 0x0C | device id read |
| g | 8 | 0x08 | (reserved/gateway info) |
| h | 1 | 0x01 | valve toggle / water status read |
| i | 2 | 0x02 | amount water read |
| j | 3 | 0x03 | water flow read |
| k | 19 | 0x13 | (reserved) |
| m | 21 | 0x15 | set smart plan enable |
| n | 22 | 0x16 | sync city / delete plan |
| o | 20 | 0x14 | pause plan |
| q | 4 | 0x04 | gateway status read |
| r | 32 | 0x20 | reset device |
| s | 6 | 0x06 | (reserved) |
| t | 9 | 0x09 | (reserved) |
| u | 23 | 0x17 | (reserved) |
| v | 24 | 0x18 | (reserved) |
| w | 53 | 0x35 | net check |
| x | 25 | 0x19 | sync link |
| y | 4 | 0x04 | (alias read) |
| z | 85 | 0x55 | (reserved) |

Derived commands (`ble/controller/*`):

| command | op | payload | response | source |
|---|---|---|---|---|
| valve on | `0x33/0x01` | `[0]=1, [1]=durationLo, [2]=durationHi` (minutes = i hours + i2 minutes, LE16) | read `0xAA/0x01` status | `Controller4ToggleValve.java` |
| valve off | `0x33/0x01` | `{0,0,0}` | — | `Controller4ToggleValve.java` |
| read water status | `0xAA/0x01` | none | `H5901DeviceInfo` parse | `Controller4ReadWaterStatus.java` |
| read amount water | `0xAA/0x02` | none | protobuf/status | `Controller4ReadAmountWater.java` |
| read water flow | `0xAA/0x03` | none | flow | `Controller4ReadWaterFlow.java` |
| read battery | `0xAA/0x08` | none | battery % | `Controller4ReadBattery.java` |
| sync time | `0x33/0x10` | `[0..3]=epochSec LE32, [4]=1, [5]=tzIndex, [6]=tzOffset` | — | `Controller4SyncTime.java` |
| read soft version | `0xAA/0x0E` | none | version x.y.z | `Controller4SoftVersion.java` |
| read hard version | `0xAA/0x0D` | none | version x.y.z | `Controller4HardVersion.java` |
| read MAC | `0xAA/0x0F` | none | MAC string | `Controller4MacAddress.java` |
| read device id | `0xAA/0x0C` | none | id | `Controller4ReadDeviceId.java` |
| gateway status | `0xAA/0x04` with `[0]=sno` | `{sno}` | `H5901Utils.I()` sub-device status | `GwReadStatusController.java` |
| next water info | `0xAA/0x04` | none | LastDataDTO (protobuf 0x37) | `NextWaterInfoController.java` |
| read GW sub-device info | `0xAA/0x04` | `{sno}` | sub-device list | `ReadGWSubDeviceInfo.java` |
| reset device | `0x33/0x20` | — | — | `Controller4ResetDevice.java` |
| net check | `0x33|0xAA/0x35` | — | network state | `Controller4NetCheck.java` |
| sync link | `0x33/0x19` | — | — | `Controller4SyncLink.java` |
| smart plan enable | `0x33/0x15` | `[0]=0|1` | — | `ControllerSetSmartPlanEnable.java` |
| pause plan | `0x33/0x14` | — | — | `PausePlanController.java` |
| sync city location | `0x33/0x16` | city/location bytes | — | `ControllerSyncCityLocation.java` |
| delete plan | `0x33/0x16` | plan id bytes | — | `ControllersDeletePlan.java` |
| open sub device | `0x33/0x21` | sub-device bytes | — | `OpenSubDeviceBle.java` |
| delete sub device | `0x33/0x11` | sub-device bytes | — | `Controller4DeleteSub.java` |
| gateway heartbeat | `0xAA/0x01` | none | `H5901HeartController` | `H5901HeartController.java` |
| chart step 1 | `0x33/0x02` | none (write trigger) | chart data | `ReadChartStep1Controller.java` |
| chart step 2 | `0x33/0x01` | `[0..3]=start LE32, [4..7]=end LE32` | chart data | `ReadChartStep2Controller.java` |
| chart step 3 | `0x33/0x03` | none | chart data | `ReadChartStep3Controller.java` |
| sub-device forwarding | `0x33/0x70` | `[0]=sno, [1..16]=inner frame bytes 1..16` | inner reply | `TransGwComposeController.java` |

**Gateway envelope**: `TransGwComposeController`/`iot/Convert2GWController` take an inner
controller's 20-byte frame, copy bytes `1..16` into a 16-byte buffer, prepend a sub-device
serial number `sno`, and send cmdType `0x70` (112). The gateway then replays the inner
controller's reply. `H5901GWIotManager.s()` detects a pending 0x33/0x35 (net check).

## BLE notifications / readings

Gateway/sub-device status frame (`utils/H5901Utils.I`, `bArr[1]==5`, `bArr[2]==0` online):

```
[0]  sno
[1]  05 (type)
[2]  status (0 online, 2 sub-device disconnected/offline)
[3]  battery (%) 
[6]  signal
[7..10]  timestamp LE32 (seconds)
[11] flags: bit0 longBatteryLife, bit1 deviceSwitchRemind, bit2 flowExceptionAlarm,
           bit3 lowPowerRemind, bit4 smartWaterEnable
[12] errorState
[13..14] remaining watering time LE16 (0xFFFF = none)
[15] bit0 switchStatus, bits1..4 runModel, bit6 gwWarningEnable, bit7 planPauseEnable
[16] pauseDuration
```

`H5901DeviceInfo` fields: `gwTimestamp`, `semaphore(signal)`, `battery`, `longBatteryLife`,
`smartWaterEnable`, `switchStatus`, `gwSubDeviceOnline`, `errorState`, `runModel`,
`planPauseEnable`, `gwWarningEnable`, `pauseDuration`.

IoT `status` frame prefixes accepted by `H5901GWIotManager.w()`:
`0xAA/0x04`, `0xEE/0x32`, `0xEE/0x34` — payload after the 2-byte header is parsed by
`H5901Utils.I(...)`.

Plan/chart protobuf: `proto/H5901Proto.java` `LastDataDTO` field numbers:
1 `nextTime` (int64), 2 `nextDuration` (int32), 3 `percentage` (int32), 4 `duration` (int32),
5 `volume` (int64), 6 `lastTime` (int64). Logged as "0x37 LastDataDTO".

## IoT commands + status/readings schema

`iot/H5901GWIotManager.java` connects to the device topic, sends every BLE command as
**`ptReal`** over IoT, and listens for `IotMsgV2`:

| cmd | data | notes |
|---|---|---|
| `ptReal` | `{"command":["<base64 frame>"]}` | single frame (`Convert2GWController.t()`), or multi frames (`makeSendBytesV1`) |
| `multiSync` | multi-frame list | treated like ptReal for aggregated sends |
| `status` | `op` = base64 frames; `state` = on/off | `CmdStatusParseV1`-style parse |

- Send: `Iot.r.L(topic, ..., new CmdPtReal(frame))` for every command (line ~234),
  or `CmdPtReal(list)` for multi-packet.
- Receive: `onIotMsgEventV2` → `ResultPt.bytes()` → `w(list)`; each 20-byte frame is checked
  for prefix `0xAA 0x04`, `0xEE 0x32`, `0xEE 0x34`; sub-device status parsed; `0x37` →
  protobuf `LastDataDTO`.
- Settings ext `pact/Ext.java` (H5901): `devicePushNotiOnOff`, `waterShortageOnOff` (default 1),
  `fullReminderOnOff` (default 1), `chartStorageTime` (default 30 days). These are **user
  preferences / push toggles**, not status flags; `waterShortageOnOff` is not the
  water-shortage state (see `STATUS-PROPERTIES.md`).

## Other protocols

- WiFi/cloud MQTT via `H5901GWIotManager` (`Iot` manager, `topicEvent`, reconnect on
  `NetChangeEvent`).
- OTA: `OtaManager4TeLinkV2` (Telink OTA over the same GATT).
- HTTP: `network/IH5901Network.java`, `GwsCanBind.java`, `IH5901NetworkKt.java` (plan bind,
  plan sync, P-value weather data).
- Weather/plan logic: `bean/WeatherPValueData.java`, `utils/WateringPlan.java`,
  `H5901SmartIrrigationDisclaimerCache.java`.

## Dynamic effects / motion / music / scenes / DIY

Not applicable (no lighting effects). Dynamic behaviour is **irrigation plans**:
- Plan model: `IrrigationPlanInfo` (id/name/enable/stages), `StageRule` (duration, interval),
  `TaskTimeRange` (start/end), `IrrigationRule`, `Settings`/`SettingData`/`H5901Settings`.
- `SyncPlanReq`, `PlanListRsp`, `ModelPlanListRsp`, `PlanIdListRsp`, `PlanIdNameItem`.
- Plan sync over BLE: `ReadPlanController` (cmdType 0x01, matches `bArr[1]==0 && bArr[5]==cmd`),
  `ReadPlanCompose`, `PausePlanController`, `ControllersDeletePlan`,
  `ControllerSetSmartPlanEnable`, `ControllerSyncCityLocation`.
- Water chart: `ReadChartStep1/2/3Controller` + `ChartTaskReq/Resp`, `ChartUploadData`.
- Next irrigation: `NextWaterInfoController` + `H5901NextIrrigationCache` + `LastDataDTO`.
- Weather-driven smart irrigation uses `H5901DataManager`, `WaterStatusView`,
  `WeatherContainerView`.

## Source map

- `Support.java`, `pact/H5901SubLib.java`, `H5901Maker.java`, `AbsH5901Item.java`,
  `H5901BleItem.java`, `H5901DeviceItem.java`, `H5901Model.java`, `GwSubH5901ItemImpl.java`,
  `H5901Holder.java`, `SubMaker.java`, `Register4Item.java`
- `ble/H5901Ble.java`, `H5901BleComm.java`, `H5901BleDataComm.java`, `H5901GattCallbackImp.java`,
  `H5901GWBleManager.java`, `H5901PairBle*.java`, `H5044GWBle*.java`, `BleNotifyComm.java`
- `ble/controller/*.java` (all listed above), `constant/H5901BleProtocol.java`
- `proto/H5901Proto.java`, `utils/H5901Utils.java`, `H5901DataManager.java`
- `iot/H5901GWIotManager.java`, `Convert2GWController.java`, `GwCommandOutTimeRunnable.java`
- `bean/*` (plans, device info, chart), `network/*`, `widget/*`

## Gaps / unknowns

- Sub-device list format (multiple `[3..16]` entries) is parsed by `H5901Utils.I` beyond the
  snippet traced; per-entry offsets after byte 16 are not fully enumerated.
- `H5901BleProtocol` has reserved constants (0x06/0x09/0x13/0x17/0x18/0x55) with no controller.
- cmdType collisions (0x01 valve/status, 0x02 amount/chart-step1, 0x04 gateway status /
  next water / sub-device info) are disambiguated by proType and payload length at runtime.
- Plan protobuf schemas beyond `LastDataDTO` are generated Java without a `.proto` in the split.
- The IoT path always tunnels BLE frames (`ptReal`); there appears to be no native JSON
  control for valve/timer other than status.


---

<!-- split_pact_h6047 -->

# split_pact_h6047 — H6047 / H6043 / H6042 / H6039 / H6038 / H6048 TV light bars & strip

Source root: `decompiled/jadx-splits/split_pact_h6047/sources/com/govee/h6047/`
Base helpers: `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/...`

## Overview / family and SKUs

`pact/Support.java` and `pact/SubMaker.java` define one ble+iot product family with six
goods-types / SKUs. All register `AbsBleIotSkuItem` (extends `AbsBleWifiSku`), i.e. every SKU
supports BLE GATT and the WiFi/cloud IoT path. `pact/EffectOp4BleIot.e()` returns
`{119, 196, 197, 277, 298, 288}`.

| SKU | goodsType | product | lights/segments | color-temp range |
|---|---|---|---|---|
| H6047 | 119 | RGBIC TV light bars (2 bars) | 10 color pieces | 2200–6500 K |
| H6043 | 196 | RGBIC TV Light Bars | 10 / 5 pieces | 2000–9000 K |
| H6042 | 197 | RGBIC TV Washer Light Bar | 5 pieces | 2000–9000 K |
| H6039 | 277 | RGBIC light string / bulb string | 12 pieces | 2700–6500 K |
| H6038 | 288 | RGBIC light string (new DIY) | 24 pieces | 2700–6500 K |
| H6048 / H8048 | 298 | RGBIC TV light bar (compose light) | 22 pieces | 2000–9000 K |

- `Support.getBulbStringMaxNum`: 119/196→10, 197→5, 277→12, 288→24, 298→22.
- `Support.getColorPieceSize`: H6038(288)→24, H6048(298)→22, else 12.
- `Support.getGoodsType4ColorSegment(String)`: "H6039"→277, "H6038"→288, "H6048"/"H8048"→298, else 196.
- `Support.isNoColorMode(sku)` (ConsV1.F="H6039", ConsV1.G="H6038") skips the trailing
  full-color `Mode` frame in multi-color-strip sends.
- H6042/H6043 support on/off memory (`Support.supportOffMemory`).
- H6048 (298) additionally supports color+brightness multi
  (`Support.checkSupportColorBrightnessMulti`).

Transports: `ble`, `iot` (WiFi cloud topic; `pact/BleIotExt` holds
`address`, `bleName`, `secretCode`, `topic`, `wifiMac`, `wifiHardVersion`, `wifiSoftVersion`).
`Model extends AbsDeviceModel4BleIot`, `pact/DeviceItem extends AbsBleIotItem`.

Pact registration (`Support.addSupportPact`): `GoodsType.beProtocol(1,1)` for 119/288/298,
`(1,1)+(2,1)` for 196/197, `(1,1)+(2,1)` for 277 (see `pact/Support.h..n`).

## Transports & GATT UUIDs

- Service: `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic: `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/BleComm.java`, `ble/BleMultiComm.java`, `ble/BleNotifyComm.java` all use these.
- Multi-packet: `Ble.v()` → `BleMultiComm extends AbsMultipleBleComm`; notify on the same
  characteristic. `Ble.u()` → `AbsBle.BlePtRealMultiComm` (BLE frames tunnelled via ptReal).
- Notify parsers (`ble/BleNotifyComm.c()`): `WifiNotifyParse`, base `DeviceStatusNotifyParse`,
  base `MovieFeastOnOffNotifyParse`, `H6048OnOffNotifyParse`.
- Heart: `ble/BleComm.l()` returns `ComposeLightHeartController` (cmdType 54, read-only).

## BLE frame + command table

Frame (`com.govee.base2kt.utils.BleUtils.generate20Bytes`):
`[0]=proType`, `[1]=cmdType`, `[2..18]=payload`, `[19]=XOR BCC(0..18)`.
Write proType `0x33`, read proType `0xAA` (`AbsSingleController.getProType`).

`ble/BleProtocol.java` constants are used as **cmdType or sub-mode values**:

| const | dec | hex | use |
|---|---|---|---|
| MSG_TYPE_READ_LIGHT_DIRECTION | 48 | 0x30 | H6048 bar on/off read |
| MSG_TYPE_CAMERA_POSITION | 49 | 0x31 | camera position (TV cam) |
| MSG_TYPE_READ_INSTALL_CAMERA | 50 | 0x32 | read camera install |
| MSG_TYPE_READ_START_TIME | 53 | 0x35 | read start time |
| sub_mode_video | 0 | 0x00 | video/music-visual sub-mode |
| sub_mode_scenes | 4 | 0x04 | scenes sub-mode |
| sub_mode_new_diy | 10 | 0x0A | new DIY sub-mode |
| sub_mode_music | 19 | 0x13 | music sub-mode |
| sub_mode_color | 21 | 0x15 | color sub-mode |
| sub_switch / value_compose_light_switch | 54 | 0x36 | compose-light left/right switch + heart |
| value_multiple_ble_diy | 2 | 0x02 | multi DIY |
| value_multiple_set_music | 65 | 0x41 | on/off-memory read, music multi |
| value_swap_light_pos | 52 | 0x34 | swap left/right light position (write only) |
| value_calibration | 68 | 0x44 | calibration write |
| value_white_balance | -87 | 0xA9 | white balance |
| value_calibration_status | 36 | 0x24 | calibration status notify |
| value_check_light / value_logo | -86 / -90 | 0xAA / 0xA6 | check light / logo |
| value_check_light_notify | 35 | 0x23 | check-light notify |
| value_check_pods / notify | -88 / 36 | 0xA8 / 0x24 | pods check |
| value_check_usb / state | 56 / 55 | 0x38 / 0x37 | USB check |
| value_sub_mode_music_rhythm | 75 | 0x4B | music effect "Rhythm" |
| value_sub_mode_music_liuying | 81 | 0x51 | "Luminous" |
| value_sub_mode_music_huoju | 80 | 0x50 | "Torch" |
| value_sub_mode_music_cuican | 49 | 0x31 | "Shiny" |
| value_sub_mode_music_shengdong | 101 | 0x65 | "Energic" |
| value_sub_mode_music_jump_ball | 102 | 0x66 | "Jump Ball" |
| value_sub_mode_music_jiepai | 103 | 0x67 | "Beat" |
| value_sub_mode_music_caihongquan | 104 | 0x68 | "Rainbow Circle" |
| SINGLE_GRADUAL_CHANGE_4_WIFI_BLE | -93 | 0xA3 | multi-packet V1 proType |

Derived commands (controller → `getCommandType()`):

| command | op | payload | response / parse | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `[0]=0|1` | read `0xAA/0x01` → `[0]!=0` | base `SwitchController.java`; `scenes/BleSwitchCmdBuilderV1.java` |
| heartbeat | read `0xAA/0x01` | none | `[0]!=0` | base `HeartController`; `scenes/BleHeartCmdBuilderV1.java` |
| brightness | `0x33/0x04` | `[0]=0..100` | read `0xAA/0x04` → `[0]` | base `BrightnessController`; `scenes/BleBrightnessBuilderV1.java` |
| mode container | `0x33/0x05` | sub-mode block (below) | read `0xAA/0x05`, `p()={1}`, parse `validBytes[0]`=sub-mode | `ble/ModeController.java`, base `AbsModeController` |
| compose-light L/R | `0x33/0x36` | `[0]=left, [1]=right` | notify/read `0xAA/0x36` → `[0]` left, `[1]` right | `ble/controller/ComposeLightController.java` |
| compose-light index | `0x33/0x36` | `[0]=index(0|1), [1]=state` | parse event | `ble/controller/ComposeLightControllerV1.java` |
| compose heart | read `0xAA/0x36` | none | `[0]`=tvLeft, `[1]`=tvRight, `[2]`=feastOpen | `ble/controller/ComposeLightHeartController.java` |
| on/off memory read | `0xAA/0x41` | `{2}` | event | `ble/controller/Controller4OnOffMemory.java` |
| swap light position | `0x33/0x34` | empty | write only | `ble/controller/SwapLightController.java` |
| calibration | `0x33/0x44` | `[0]=flag` | write-result / `0x24` notify | `ble/controller/CalibrationController.java` |
| H6048 bar on/off | read `0x30` | — | raw 20B notify `[2]=barA, [3]=barB` | `ble/H6048OnOffNotifyParse.java` |

`ble/H6048OnOffNotifyParse` is the only parser that indexes the **raw 20-byte** notification
(not the 17-byte stripped buffer): `bArr[2]==1`, `bArr[3]==1`.

### Sub-mode payloads (cmdType 0x05)

Color (`ble/SubModeColor.java`, `subModeCommandType()=0x15`):

```
[0]=0x15
if per-group brightness mode (f!=0 || bg set):
  [1]=02 [2]=brightnessGroup [3..] selected-segment bitmask
else:
  [1]=01 [2..4]=R G B
  if colorTemp!=0: [5..6]=kelvin LE16, [7..9]=temp R G B
  [10..] selected-segment bitmask (1 bit/segment, up to 24 segments; >16 uses makeSelectedBytes)
```

- Segment bitmask helpers: `BleUtils.makeSelectedTwoBytes` (≤16) / `makeSelectedBytes` (>16).
- Segment length = `Support.getGoodsType4ColorSegment(...)` (10/12/22/24).
- Multi-group send: `SubModeColor.makeSubModeColor(Colors, goodsType)` groups segments by color
  and by brightness into one `Mode4ColorStrip`+`ModeController` per group; last frame sets
  `Mode4ColorStrip.a=true`, brightness-group frames set `b=true`.
- Parse (`SubModeColor.parse`): `[0]`=group no., `[1..2]`=kelvin LE16, `[3..4]`=second kelvin LE16.

Scenes (`ble/SubModeScenes.java`): `[0]=0x04 [1]=effectLo [2]=effectHi` (16-bit LE, default 22).
Parse is `getSignedShort(bArr[1], bArr[0])` (LE).

New DIY (`ble/SubModeNewDiy.java`): `[0]=0x0A [1]=diyLo [2]=diyHi` (16-bit LE).
Local code cached in `ble/DiyLocal{diyCode,diyValueKey}`.

Video (`ble/SubModeVideo.java`, `subModeCommandType()=0x00`); the shared new-detail
video-mode/settings path is catalogued in `DREAMVIEW-HDMI.md`:

```
[0]=00 [1]=musicVisualOn [2]=speed(1..100) [3]=effectMode(all/part)
[4]=allPartFlag [5]=sensitivity(0..99) [6]=extra
```

Music (`ble/SubModeMusic.java`, `subModeCommandType()=0x13`):

```
[0]=0x13 [1]=sensitivity(0..99) [2]=effectId
[3]=rhythmDynamicFlag (only when effectId==75)
[4]=musicColorFlag [5]=inverseFlag
```

Effect ids: 75 Rhythm, 80 Torch, 81 Luminous, 101 Energic, 102 Jump Ball, 103 Beat,
104 Rainbow Circle, 49 Shiny (default). `getAnalyticModeName()` maps these names.

## BLE notifications / readings

| notify cmdType | parser | layout |
|---|---|---|
| 0x11 (17) | `ble/WifiNotifyParse` | `[0]==0` → WiFi connected |
| 0x40 (64) | base `DeviceStatusNotifyParse` | first 10 bytes → `EventDeviceStatus` |
| 0x60 (96) | base `MovieFeastOnOffNotifyParse` | `[0]==1`, `[1]==1` → movie-feast on |
| 0x30 (48) | `ble/H6048OnOffNotifyParse` | raw `[2]`, `[3]` bar on/off booleans |
| 0x01 (1) | base switch/heart | `[0]!=0` |
| 0x04 (4) | base brightness | `[0]` 0..100 |

`ble/Parser.validBytes17()` = copy bytes 2..18 of a raw 20-byte packet (read header strip).

## IoT commands + status/readings schema

`iot/Cmd.java`: `state`, `op`, `online`, `turn`, `color`, `brightness`, `status`, `points`,
`ptReal`, `ptIot`, `colorwc`.

Envelope: `CmdBuilder.makeCmdStr(AbsCmd)` → `Write.getWriteMsg4Transaction(null, cmd)`
(`msg.transaction`, `msg.accountTopic`, `msg.type=1`, `msg.origin=32`, `msg.cmdVersion`,
`msg.cmd`, `msg.data`). Reads use type 0.

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0|1}` | `iot/CmdTurn.java` |
| `brightness` | `{"val":0..100}` | `iot/CmdBrightness.java` |
| `colorwc` | `{"color":{"red","green","blue"},"colorTemInKelvin":int}` | `iot/CmdColorWc.java` (colour → `colorTemInKelvin=0`; kelvin → white RGB) |
| `ptReal` | `{"command":["<base64 20-byte BLE frame>", ...]}` | `iot/CmdPtReal.java` (single controller, `AbsController[]`, `List<byte[]>`, scenes/DIY/multi-colour) |
| `status` | device status event; `op` carries device frames | `iot/OpColorCommDialog4BleIot` etc. |

`iot/CmdPtReal` builders:
- `new CmdPtReal(AbsSingleController)` / `new CmdPtReal(byte[])` / `new CmdPtReal(AbsController[])`.
- `getNewScenesCmdPtReal(AbsMultipleControllerV14Scenes)` – multi-packet scene frames + final
  `SubModeScenes` frame with effect id.
- `getColorStripCmdPtReal4Square(...)` – colour-strip multi frames + (unless no-colour-mode)
  final `SubModeColor` frame.
- `getColorStripCmdPtRealNoColorMode4Square(...)` – without the trailing color frame.
- `getDiyCmdPt(DiyProtocol)` – multiple DIY bytes + `SubModeNewDiy(code)` frame.
- `getDiyTemplateCmdPt(...)` – DIY-template frames + `SubModeScenes` frame.

Read side: `ResultPodsInstall` decodes `op.command[0]` base64 and checks `[2]==1` (pods
installed) or `[0]==0xEE && [1]==0x24` (check-install reply).
`IotSwitchCmdBuilderV1` parses `IotMsgProType.V2` (`IotMsgV2`), matches `transaction`, and
reports success when `cmd=="status"`.

## Other protocols

- WiFi/cloud topic per device in `BleIotExt.topic`; MQTT transport handled by base IoT manager
  (`Iot.r`). No LAN/UDP or Matter code in this split.
- BLE frames are reused verbatim over IoT through `ptReal` (base64 of each 20-byte frame).

## Dynamic effects / motion / music / scenes / DIY

- **Scene application**: `pact/Comm.makeSceneCmd4IotComm` → `Support.isMultiScenes(...)` →
  `ScenesOp.parseSceneV1(str, scene, {0,1,2,3,10,6})` or `ScenesOp.parseScene(...)` /
  `parseEffect(...)` depending on goodsType; falls back to `SubModeScenes` single frame.
  `Support.supportScenesOpSet`: 277→{0,1,2,3,5,10}; 288/298→{0,1,2,3,5,6}; else {0,1,2,3}.
- **Scene channels** for 6038 scenes: `createNewScenesMode6038` uses `{0,1,2,3,10,6}`;
  H6039 (`createNewScenesMode`) uses `{0,2,3,10}`.
- **DIY V1 effect codes** (`adjust/Diy.java`): registers `DiySupportV1` from
  `DiyM.EffectCode.{h,t,m,B,A,v,z,y,Q0,t0,M,P0,g}` (base app). `g` is a plain two-value
  effect (`makeEffect(effect[0], effect[1])`). Codes are the base `DiyM.EffectCode` values
  (0/1/2/3 gathered-dispersed, 4/5 music, 6/7 clockwise/anticlockwise, 8..34 scene codes,
  120 etc.).
- **H6038 new DIY** (`newdetail/h6038/diy/H6038DiyNewConfig.java`): separate
  `DiyNewConfig.addNewEffectConfig(288, ...)`; effect list built from `H6038SimpleEffect`
  plus `Diy4RgbIcGraffiti`; registers an extra `diySupport.effectCodes.codeList.add(812)`.
  `H6038SimpleEffect` layout parsed in `H6038SimpleEffect.m(byte[])` (effect type byte,
  sub-effects, colours, direction) — see `newdetail/h6038/diy/H6038SimpleEffect.java`.
- **Online music** (`pact/OnlineMusicConfig.java`): configGoodsType=277 (H6039), sku H6039,
  colour pieces 12, colour-temp 2700–6500 K, `supportScenesOpSet` true for 277;
  mix-preset version 2, desc strings 6.
- **Video/music-visual** effect ids live in `SubModeVideo`/`SubModeMusic` (above); the video
  mode uses colour-strip groups and `Mode4ColorStrip.a/b` flags to sequence multi-bar sends.
- **Compose-light (H6048)** supports independent left/right bars (`ComposeLightControllerV1`
  index 0/1) and swapping positions (`SwapLightController`, 0x34), plus per-bar on/off memory
  read (0x41 payload {2}).
- **Calibration** 0x44 + status notify 0x24; H6048 install/pods/USB checks use 0xA8/0x38/0x37
  with notify 0x24/0x23/0x37.

## Source map

- `pact/Support.java`, `pact/SubLib.java`, `pact/SubMaker.java`, `pact/*Item.java`,
  `pact/AbsBleIotSkuItem.java`, `pact/DeviceItem.java`, `pact/Model.java`, `pact/Comm.java`,
  `pact/AbsEffectOp4BleIot.java`, `pact/EffectOp4BleIot.java`, `pact/OnlineMusicConfig.java`,
  `pact/BleIotExt.java`
- `ble/Ble.java`, `BleComm.java`, `BleMultiComm.java`, `BleNotifyComm.java`, `BleProtocol.java`,
  `Mode.java`, `Mode4ColorStrip.java`, `ModeController.java`, `SubMode*.java`, `DiyLocal.java`,
  `Parser.java`, `H6048OnOffNotify*.java`, `WifiNotifyParse.java`
- `ble/controller/*.java`, `ble/event/*.java`
- `scenes/*.java`
- `iot/*.java`
- `adjust/Diy.java`, `newdetail/h6038/diy/*`, `newdetail/music/H6039MusicMode.java`
- base: `com/govee/base2light/ble/controller/{AbsSingleController,AbsModeController,AbsMode,SwitchController,BrightnessController,HeartController}.java`,
  `com/govee/base2light/ble/{DeviceStatusNotifyParse}.java`, `com/govee/base2kt/utils/BleUtils.java`,
  `com/govee/base2light/ac/diy/DiyM.java`

## Gaps / unknowns

- `ble/H6048OnOffNotifyParse` is the only parser indexing raw 20-byte notifies; the rest use
  the 17-byte stripped buffer. Confirm actual device notify framing for H6048 bar state.
- `Support.createNewScenesMode*` effect channel ids are static sets; per-scene channel bytes are
  server-driven (`ScenesM`, `CategoryV1.SceneV1`) and not statically enumerable.
- `DiyM.EffectCode` field names are obfuscated (h/t/m/...) — the numeric code list is only
  partially recoverable; H6038 uses a separate new-DIY config with codeList additions (e.g. 812).
- `value_check_light = -86` collides numerically with the 0xAA read proType; not used by any
  traced controller.
- H6043 (196) uses `AbstractEffectOp4BleIot.d()` to duplicate 5 colours into 10; exact device
  interpretation of duplicated segment colours is runtime-dependent.
- `Comm.makeColorController4BleComm` and the scene/DIY paths are the only traced BLE payload
  producers; camera-position/start-time opcodes (0x31/0x32/0x35) have no writer in this split.


---

<!-- split_pact_h604a -->

# split_pact_h604a — H604A/B/C/D bulb strings & camera-calibrated strip lights

Source root: `decompiled/jadx-splits/split_pact_h604a/sources/com/govee/h604a/`.

A four-SKU light family split into two protocol generations:

| goodsType | SKU | product | scenes | bulbs | transports |
|---|---|---|---|---|---|
| 95 | H604A | RGBIC bulb string (camera-calibrated) | op set `{1,6}` (V1) | 24 bulbs | **ble + iot** |
| 122 | H604C | RGBIC bulb string | `{1,6}` (V1) | 24 bulbs | **ble + iot** |
| 109 | H604B | RGBIC bulb string (layout import / 14 bulbs) | op set `{0,1,2,3}` (V2) | 14 bulbs | **ble + iot** |
| 133 | H604D | RGBIC bulb string | `{0,1,2,3}` (V2) | 14 bulbs | **ble + iot** |

`Support.addSupportPact()` registers all four with `beProtocol(1,1)`;
`isH604aType = 95|122`, `isH604bType = 109|133`. `isPactV2` selects V2 for 109/133.
`getBulbStringMaxNum`: 24 for H604A/C, 14 for H604B/D. Colour temp 2200–6500 K.
Camera calibration / layout points are a defining feature (add flow and `newdetail/vm`).

---

## 1. Transports & GATT UUIDs

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `ble/BleComm.java` (`Q`/`V`), `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`.
`Ble` is a standard `AbsBle` exposing `BleComm`, `BleMultiComm` and a
`BlePtRealMultiComm` (`u()`). Notify list: `WifiNotifyParse`, `CheckLightParse`,
`CheckPodsParse`, `CaliLightParse`, `DeviceStatusNotifyParse`.

---

## 2. BLE frame + command table

`BleProtocol` (`ble/BleProtocol.java`):

| constant | value | meaning |
|---|---|---|
| `sub_mode_color` | 21 / `0x15` | colour mode container |
| `sub_mode_music` | 19 / `0x13` | music |
| `sub_mode_scenes` | 4 / `0x04` | scenes |
| `sub_mode_new_diy` | 10 / `0x0A` | DIY |
| `sub_mode_video` | 0 / `0x00` | video/movie mode (screen colour) |
| `value_cali_light` | -89 / `0xA9` | calibration-light start |
| `value_check_light` | -86 / `0xAA` | check light (write proType 0x33) |
| `value_check_pods` | -88 / `0xA8` | check pods |
| `value_compose_light_switch` | 54 / `0x36` | compose/child light switch |
| `value_swap_light_pos` | 52 / `0x34` | swap light position |
| `value_camera_effect` | -83 / `0xAD` | camera/snapshot effect |
| `value_white_balance` | -87 / `0xA9` | white balance |
| `value_logo` | -90 / `0xA6` | logo |
| `value_multiple_ble_diy` | 2 | multi-packet DIY |
| `value_multiple_set_music` | 65 / `0x41` | multi music |
| `MSG_TYPE_READ_LIGHT_DIRECTION` | 48 / `0x30` | read install direction |
| `MSG_TYPE_CAMERA_POSITION` | 49 / `0x31` | camera position |
| `MSG_TYPE_READ_INSTALL_CAMERA` | 50 / `0x32` | read install camera |
| `MSG_TYPE_READ_START_TIME` | 53 / `0x35` | read effect start time |
| `SINGLE_GRADUAL_CHANGE_4_WIFI_BLE` | -93 / `0xA3` | gradual change |

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] 1..100` | `pact/Comm.makeBrightnessController4BleComm` |
| colour / mode | `0x33/0x05` | sub `0x15` 17-byte layout below | `ble/SubModeColor.java`, `ble/Mode.java`, `ble/ModeController.java` |
| music | `0x33/0x05` | sub `0x13` 6/8-byte layout | `ble/SubModeMusic.java` |
| scenes | `0x33/0x05` | sub `0x04` 3-byte effect LE16 | `ble/SubModeScenes.java` |
| new DIY | `0x33/0x05` | sub `0x0A` code LE16 | base `SubModeNewDiy` |
| video / movie | `0x33/0x05` | sub `0x00` 8-byte layout | `ble/SubModeVideo.java` |
| compose / child switch | `0x33/0x36` | `[0] f,[1] g,[2] h` bools | `ble/controller/ComposeLightController.java` |
| compose heart | `0xAA/0x36` | `[0..3]` bools (TV/left/right/feast) | `ble/controller/ComposeLightHeartController.java` |
| check light | `0x33/0xAA` | empty; response notify `0x23` | `ble/controller/CheckLightController.java` |
| check pods | `0x33/0xA8` | empty; response notify `0x24` | `BleProtocol.value_check_pods` |
| calibrate light belt | `0x33/0xA9` | `[0] mode, [1..5] params (bArr from UI)` | `ble/controller/CaliLightBeltController.java` |
| swap light position | `0x33/0x34` | empty | `ble/controller/SwapLightController.java` |
| start time read | `0xAA/0x35` | empty | `ble/controller/StartTimeController.java` |
| on/off memory | `0x33/0x41` | `[0] 0/1` | `ble/controller/Controller4OnOffMemory.java` |
| IC number | `0xAA/0x40` | empty | `ble/controller/ControllerIcNum.java` |
| multi music | `0x33/0x41` | header + per-bulb data | `ble/controller/MultiMusicController.java` |
| bulb-string colour read | `0xAA/0xA5` | `p()={index}` | `adjust/v1/BulbStringColorControllerV2.java` |
| bulb-string colour group | `0x33/0x?` multi | `BulbStringColorControllerV2` writes per 4-bulb group | same + `CmdPtReal` |
| gradual change | `0x33/0xA3` | `[0] 0/1` | base `Gradual4BleWifiController` |
| white balance / logo / camera | `0x33/0xA9/0xA6/0xAD` | payload from UI | `newdetail/vm/H604xVM.java` |

### Colour payload (`SubModeColor.getWriteBytes`, 17 bytes)

```
[0]=0x15
mode 1: [1]=1 [2..4]=R G B [5..6]=Kelvin LE16 [7..9]=temp RGB [10..12]=24-bit segment mask
mode 2: [1]=2 [2]=brightness [3..5]=24-bit segment mask
mode 3 (raw): [1]=3 [2..13]=12 raw bytes
```
Default segment array is `boolean[24]` (H604A/C) and 14 bulbs are addressed via groups.

### Music payload (`SubModeMusic.getWriteBytes`)

```
non-rhythm: 13 <code> <sens> <autoFlag 0/1> [R G B]  (6/7 bytes)
rhythm(4):  13 04 <sens> <dynamic> <autoFlag> [R G B] (8 bytes)
```
Music codes: `64 Rhythm (dynamic flag)`, `65 Wind Sound`, `66 Hooray`, `67 Sprouting`,
`72 Hopping`, `80 Torch`, `82 Expansion`, `83 Flowing Light`. Sensitivity 0..99.
Default code 64, default sensitivity 99.

### Video payload (`SubModeVideo.getWriteBytes`, 8 bytes)

```
00 <enable> <vividness 1..100> <mode 4/1..3> <dynamicFlag> <saturation 0..99> <param> 
```
Parse: `[0] enable, [1] vividness, [2] mode, [3] dynamic, [4] saturation, [5] param`.

---

## 3. BLE notifications / readings

| reading | op | layout | source |
|---|---|---|---|
| check light | notify `0x23` | `[0]==1` light OK, `[1]==1` status | `ble/CheckLightParse.java` |
| check pods | notify `0x24` | `[0]==1` pods OK | `ble/CheckPodsParse.java` |
| calibration timeout | notify `0x25` | event only | `ble/CaliLightParse.java` |
| wifi | `0x11` | `[0]==0` connected | `ble/WifiNotifyParse.java` |
| compose heart | `0xAA/0x36` | `[0] TV, [1] left, [2] right, [3] feast` | `ComposeLightHeartController` |
| status | `0x30` | base `DeviceStatusNotifyParse` | `ble/BleNotifyComm` |
| bulb-string colours | `0xAA/0xA5` | `BulbGroupColorV2.parseBytes` → per-bulb RGB | `BulbStringColorControllerV2`, `adjust/v1/BulbGroupColorV2` |
| device info | `0x07` | base `DefInfo` | `pact/Model` |

`BulbGroupColorV2.parseBytes` decodes 4-bulb groups (index + RGB), used by `CmdPtReal`
responses and the colour UI.

---

## 4. IoT commands + status/readings schema

Envelope **`IotMsgV2`** (`Iot*CmdBuilder` return `IotMsgProType.V2`).

`iot/Cmd.java` keys: `state`, `op`, `online`, `turn`, `color`, `colorTem`, `brightness`,
`status`, `pt`, `snapshot`, `points`, `IoTConnected`, `camera`, `swap`, `ptReal`, `ptIot`,
`colorwc`.

| cmd | data | response | source |
|---|---|---|---|
| `turn` | `{"val":0\|1}` | `state` | `CmdTurn` |
| `brightness` | `{"val":1..100}` | `state` | `CmdBrightness` |
| `colorwc` | `{"color":{r,g,b},"colorTemInKelvin":int}` | `state` | `CmdColorWc` |
| `ptReal` | `{"command":["<base64 20-byte>",...]}` | `op.pt[]` | `CmdPtReal` |
| `ptIot` | raw IoT passthrough | `op` | `Cmd.p` |
| `snapshot` | camera snapshot request | `ResultSnapShot.snapshotUrl` | `ResultSnapShot` |
| `points` | `{"points":[{"pointX":int,"pointY":int},...]}` | calibration result | `CmdCalibrationPoints` |
| `camera` | camera effect switch | `state` | `newdetail/vm/H604xVM` |
| `swap` | swap light position | `state` | `newdetail/vm/H604xVM` |
| `IoTConnected` | cloud connection state | — | `Cmd.l` |

`CmdPtReal` builders:
- `getCmdPtReal4SetColorMode(mode, bulbMax)` → mode frame + read frame + N `BulbStringColorControllerV2`
  read frames (`N = ceil(bulbMax/4)`, 24 or 14).
- `getColorStripCmdPtReal(controller, withBulbs, goodsType)` → multi colour-strip bytes, optionally
  followed by per-4-bulb colour reads.
- `getColorStripCmdPtReal4Square` → multi bytes + a colour-mode frame.
- `getDiyCmdPt(DiyProtocol)` → `MultipleDiyControllerV1` bytes + `0A <code>` mode frame.
- `getDiyTemplateCmdPt(DiyTemplate)` → multi template bytes + `04 <effect>` frame.
- `getNewScenesCmdPtReal(controller)` → multi scene bytes + `04 <effect>`.
- `getMusicCmdPtReal(MultiMusicController)` → multi music bytes + music mode frame.
- `isOtherMode2ColorMode` detects `15 02` colour mode + bulb-string read to rebuild state.

Status: `state`/`op`; `op.pt[]` frames are decoded by `CmdStatus`-less base parser and the
family parsers. `ResultSnapShot` exposes `snapshotUrl`. `ResultPt` exposes `ptBytes`.

---

## 5. Other protocols

- **Camera calibration / layout import** — `add/net/*` (upload points, get points, light
  calibration), `add/Calibration*`, `add/net/INet`. The phone camera captures the physical bulb
  layout; points are stored cloud-side and sent as `points`/`ptReal`.
- **Snapshot** — `snapshot` command returns a `snapshotUrl` used by the camera/colour UI.
- **BLE broadcast add flow** — `add/BleBroadcastProcessor` (advertisement-based discovery).
- **WiFi OTA / bind** — base HTTP APIs; `newdetail/Info4Detail` carries WiFi soft/hard versions.
- **No Matter/MQTT/LAN** in this split.

---

## 6. Dynamic effects / music / scenes / DIY

### Colour / segment (`0x15`)

- 24-segment mask for H604A/C (3 bytes), 14-bulb groups for H604B/D.
- Per-bulb colour reads (`0xAA/0xA5`) rebuild the layout after connect.
- `SubModeColor.makeSubModeColor(Colors)` groups equal colours into one frame per colour and
  splits brightness into 14-bulb frames.

### Music (`0x13`)

Effects: `64 Rhythm` (dynamic flag), `65 Wind Sound` (2=wind,3=?), `66 Hooray`, `67 Sprouting`,
`72 Hopping`, `80 Torch`, `82 Expansion`, `83 Flowing Light`. Sensitivity 0..99, auto-colour
flag + manual RGB. `getWriteBytes` for code 64 adds the dynamic byte.

### Video / movie (`0x00`)

`00 enable vividness mode dynamic saturation param`. The live new-detail VM
(`VideoVmH604x`) emits `05 00 <voiceOn> <vivid> <screenState> <drama> <voice> <softness>`
— byte order differs from tvlight/h6099; see `DREAMVIEW-HDMI.md` §2. Shared camera
settings (white balance `0xA9/00|06|0F`, sensitivity `0xA9/01`, colour calibration
`0xA9/05`, black screen `0xA9/0A`, HDR/saturation/AI filter) are in the same doc. Modes:
screen/video colour extraction with
vividness 1..100 and saturation 0..99.

### Scenes (`0x04`) and DIY (`0x0A`)

`04 epLo epHi` / `0A diyLo diyHi` (16-bit LE). V1 SKUs (95/122) use `ScenesOp.parseScene` with
allowed ops `{6}` (and `{1}` for scene-mode), V2 SKUs (109/133) use `parseSceneV1` with
`{1,2}`. Scene op sets: H604A/C `{1,6}`, H604B/D `{0,1,2,3}`.

### DIY effect codes (H604B/D `newdiy/h604b/*`)

| class | effect code | extra codes (template) |
|---|---|---|
| `DiyTemp4Chase` | `347` | 3/4 |
| `DiyTemp4Colorful` | `346` | 25 |
| `DiyTemp4Paomadeng` | `345` | 2/3 |
| `DiyTemp4PileUp` | `349` | 8/9 |
| `DiyTemp4Swing` | `348` | 7 |

H604A/C (`DiyConfigH604A`) uses the RGBIC-v2 DIY engine: share-code-0x00 effects with sub-effect
triples `[59,9,127]`, `[59,10,128]`, `[58,9,125]`, `[58,10,126]`, `[0,0,1]`, and template effects
`DiyTemp4Chase` (3/4), `DiyTemp4Ladder` (5/6, code 129), `DiyTemp4Penshe` (7, code 130),
`DiyTemp4BloomV2` (8/9), `DiyTemp4Swing` (10, code 9), `DiyTemp4Duikang` (11, code 9),
`DiyTemp4PileUp` (15/16). Speed range 0..100 (default 50); colour indices `[2,8]`/`[1,8]`/`[3,8]`.

---

## 7. Source map (traced)

- Registration/SKUs: `pact/{Support,SubLib,SubMaker,Register4Item,Model,H604*Item}.java`
- Transport: `ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol}.java`
- Mode/sub-modes: `ble/{Mode,ModeController,Mode4ColorStrip}.java`, `ble/SubModeColor.java`,
  `ble/SubModeScenes.java`, `ble/SubModeMusic.java`, `ble/SubModeVideo.java`
- Controllers: `ble/controller/*.java`; `adjust/v1/BulbStringColorControllerV2.java`,
  `adjust/v1/BulbGroupColorV2.java`
- IoT: `iot/{Cmd,CmdTurn,CmdBrightness,CmdColorWc,CmdPtReal,CmdCalibrationPoints,
  ResultPt,ResultSnapShot}.java`
- Add/calibration: `add/*`, `add/net/*`
- New detail/UI: `newdetail/*`, `newdetail/mode/*`, `newdetail/vm/*`, `newdetail/mode/VideoModeH604x`
- DIY: `newdiy/DiyConfigH604A.java`, `newdiy/DiyConfigH604BD.java`, `newdiy/h604b/*`

## 8. Gaps / unknowns

- V1 scene op semantics (`{1,6}`) and V2 (`{0,1,2,3}`) are op-set constants; actual scene IDs
  are cloud (`ScenesM`) values.
- Camera calibration point payload is `pointX/pointY` pairs; the exact cloud response schema
  (`CalibrationPointsResponse`, `LightCalibrationResponse`) was not fully expanded.
- `SubModeVideo` modes are UI enums; the mapping of 1..4 to named video effects is runtime.
- `MultiMusicController` per-bulb payload (`bArr[0]=index, bArr[1]=length`) is multi-packet;
  exact chunk sequencing is base `MultipleControllerCommV1`.
- H604A/C vs H604B/D DIY engine differences are captured by effect codes, but the base
  RGBIC-v2 template parser supplies the final body bytes.


---

<!-- split_pact_h6061 -->

# split_pact_h6061 — H6061 cube / Glide family + H6067 Glide Tri/Y

## Overview / family and SKUs

The split contains two packages that share the same 20-byte BLE protocol and IoT envelope:

| goodsType | SKU | product | package | segments | notes |
|---|---|---|---|---|---|
| 51 | **H6061** | Glide Hexa | `cubelight` | 23 | 6-panel hexa, DIY/graffiti |
| 96 | **H6066** | Glide Hexa Pro | `cubelight` | 25 | scene speed, DIY |
| 163 | **H606A** | Glide Hexa Ultra | `cubelight` | 21 | music V4 (117–123), Matter |
| 228 | **H6063** | Govee Gaming Wall Light (hex) | `cubelight` | 20 | shape/focus DIY, Matter |
| 284 | **H6069** | Govee Gaming Wall Light (panel) | `cubelight` | 140 | shape/panel DIY, Matter |
| 97 | **H6067** | Glide Tri | `h6067` | 40 (24 mask) | triangular panels, scene direction/speed |
| 121 | **H6065** | Govee Glide Y Lights | `h6067` | 40 (24 mask) | Y-shape, focus point DIY |

Sub-libraries: `cubelight/pact/SubLib` (`Support.p` = 51, 96, 163, 228, 284, 97, 121)
and `h6067/pact` (`Support.j` = 97, 121). Makers `H6061Maker`, `H6066Maker`,
`H606AMaker`, `H6063Maker`, `H6069Maker`, `H6067Maker`, `H6065Maker` — all extend
`AbsBleWifiSku`.

Transports: **ble + iot** for all seven SKUs. **matter** additionally for 163/228/284
(`Support.supportMatterFunc`, `cubelight/adjust/h6063/H6063MatterHelper`).

## Transports & GATT UUIDs

`cubelight/ble/BleComm.java`, `h6067/ble/BleComm.java`:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- heart `HeartControllerV2`
- notify parsers registered against the service UUID; `AbsNotify.parse` may receive a
  `0xEE`-prefixed report on the multi characteristic (h6067/h6061 both use the same
  `BleNotifyComm` with Wifi/Brightness/DeviceStatus/Movie parsers).

## BLE frame + command table

Frame = `[proType][cmdType][17-byte payload][XOR BCC 0..18]`; write `0x33`, read `0xAA`.

| # | command | op | payload | response / notes |
|---|---|---|---|---|
| 1 | power | `0x33/0x01` | `01` on / `00` off | `0xAA/0x01` → valid[0] |
| 2 | brightness | `0x33/0x04` | `[0]` 1..100 | `0xAA/0x04` → valid[0] |
| 3 | mode container | `0x33/0x05` | sub-mode block | read `0xAA/0x05` payload `{01}` |
| 4 | colour / segment | `0x33/0x05 sub 0x15` | variants 1/2/3/4 (below) | parse via `SubModeColor.parseSubModeColor4Write`, `parsePosColor` |
| 5 | old colour (read only) | `0xAA/0x0D` | legacy sub-mode 0x0D | `SubModeColor` 0x0D is not written by this split |
| 6 | scene | `0x33/0x05 sub 0x04` | `04 <effect LE16> <dir> <speed>` and point/focus variants | parses direction/x/y/speed |
| 7 | new DIY | `0x33/0x05 sub 0x0A` | `0A <diyCode LE16>` (cubelight & h6067) | — |
| 8 | music (cubelight) | `0x33/0x05 sub 0x13` | V1 `13 code 00`, V3/V4 forms | h6067 music parser is a stub |
| 9 | set device / panel layout | `0x33/0x31` | `MultiDeviceController` / `MultiDeviceControllerH606A` | `0xAA/0x31` read |
| 10 | read device self / protocol | `0xAA/0x02` | `{00}` | multi-reply; `DeviceSelfController` |
| 11 | calibration (panel) | `0x33/0x44` | `[icIndex][rgbIndex]` (`CalibrationController`); H6065: `[g][f...]` | write only |
| 12 | install/recognise | `0x33/0x45` | `00` installed / `FF` not installed | write only |
| 13 | calibrate all | `0x33/0x52` | `[04][count][icIndex+6*i ...]` | multi-packet |
| 14 | device recognition (H6069) | `0x33/0x50` | raw bytes (`SetDeviceRecognitionController`) | — |
| 15 | protocol version | read `0xAA/0xEF` (`value_protocol_version`) | — | constant only, used by base handshake |

### Multi-packet framing (DIY / scenes / colour groups)

DIY pixel blobs, scene effect blobs and multi-colour groups use
`MultipleBleBytes` → `MultipleControllerCommV1`, proType `0xA3`, 20 bytes per packet, BCC
in byte 19. `makeSendBytesV0` (`p()==0`) uses start `A3 00 00 (packCount+2) <cmdType>`,
data packets `A3 <index> <17-byte chunk>` and end `A3 FF`; `makeSendBytesV1/V2`
(`p()==1`, scenes) uses start `A3 00 01 <total> <cmdType>` + first chunk, middle packets
`A3 <index> <17-byte chunk>`, final `A3 FF <last chunk>`. Legacy
`MultipleControllerComm` uses `[proType][cmdType][index][16-byte chunk]` with
`{0,count,p}` start and `{FF}` end. `CmdPtReal` preserves packet order as base64 strings.

### Colour sub-mode `0x15` exact layouts

`cubelight/ble/SubModeColor` (40-bit state, 5 mask bytes; `p=40`):

- variant 1 (single colour):
  `15 01 R G B [kHi kLo] m0 m1 m2 m3 m4`
  mask bytes start at payload[7]; bit0 of each mask byte = lowest segment in that group.
- variant 2 (group brightness):
  `15 02 B m0 m1 m2 m3 m4`
- variant 3 (all brightness, max 14 values/packet):
  `15 03 group B0 .. Bn`
- variant 4 (all colour, max 4 RGB triplets/packet):
  `15 04 group R0 G0 B0 R1 G1 B1 R2 G2 B2 R3 G3 B3`
- `SubModeColor.checkSpecialBytes()` emits variant 3/4 packets per 14/4 entries; a separate
  variant 1/2 packet carries the mask. `makeSubModeColor(Colors)` groups equal colours into
  one packet per unique colour and adds a brightness packet when `brightnessSet` is present.
- H6067 (`h6067/ble/SubModeColor`, `p=40`) is the same protocol but writes only three mask
  bytes `bArr[7..9]` (24 bits) in both variants; bits 24..39 are never transmitted — see Gaps.

Read parse (`parseColorStripByOnePacketBytes` / `parsePosColor`): incoming frames are
`20 bytes`; byte[3] is the variant:
`1` → RGB at 4..6, `3` → `[4]=group` and 14 brightness values at 5..18,
`4` → `[4]=group` and four RGB triplets at 5..16,
position parse (`parsePosColor`) uses `[3..5]=RGB` and 2 mask bytes at 6..7.

### Scene `0x04` exact layouts

`cubelight/ble/SubModeScenes.getWriteBytes()` (opcode from `subModeCommandType()` = 0x04):

| condition (goodsType) | payload |
|---|---|
| base, no point | `04 <effect LE16> <dirCode> <speed>` |
| direction code has point (5/6/13) | `04 <effect LE16> <dirCode> <x LE16> <y LE16> <speed>` |
| H606A point table (`ProConfig4H6069`/`0x67`) | same 9-byte point form |
| H6063 focus point | `04 <effect LE16> <dirCode> <focus[4]> <speed>` |
| H6065 focus point | `04 <effect LE16> <dirCode> <focus[4]> <speed>` |
| H6069 point | `04 <effect LE16> <dirCode> <x LE16> <y LE16> <speed>` |

- `<effect LE16>` from the cloud scene (`SceneV1.getSceneCode`), `dirCode` from the
  scene/direction table, `speed` from `ScenesSpeedManager` (default 45 for H6061, 10 for
  96/163/228/284, 71 for 97/121).
- `SubModeScenes.parse` reverses it: byte0/1 effect, byte2 direction, bytes3..6 x/y,
  byte7 speed; focus form stores 4 bytes in `p`.

### H6067 scene (`h6067/ble/SubModeScenes`)

Same op 0x04, but class fields are `a=effect`, `b=direction`, `c=x`, `d=y`, `f=speed`,
`g=focus[4]`:

- point direction → `04 <eff LE16> <dir> <x LE16> <y LE16> <speed>`
- H6065 with focus → `04 <eff LE16> <dir> <focus[4]> <speed>`
- otherwise → `04 <eff LE16> <dir> <speed>`
- default effect 2229, default speed 71.

### Shape / panel protocols

- `cubelight/ble/MultiDeviceController` (opcode 0x31):
  `[count][type][x LE16][y LE16][angle LE16]` per panel, then optional ext bytes
  (`ShapePosition.ext`). Gives the spatial map used by multi-device sync and DIY.
- `MultiDeviceControllerH606A` (opcode 0x31, two layouts):
  - `g()` = `[angle+rotation LE16][count][x LE16][y LE16] × count` (compact position map)
  - `x()` = same panel list plus `mainPower` bytes, `ext` bytes and an `inputNum/outputNum`
    pair per panel (expanded topology).
- `H6069` recognition writes the raw `H6069DiyParse.d` opcode `0x50`.
- `CalibrationAllController` opcode 0x52: `[04][count][icIndex0][icIndex1+6]...`.
- `CalibrationControllerH6065` (H6065) opcode 0x44: `[g][f0 f1 ...]`.
- `InstallController` opcode 0x45: `00` = installed, `FF` = not installed.

### Music

- `cubelight/ble/SubModeMusic` (legacy, code default 56, codes 53/57/58/59/51):
  write payload is `13 <code> 00`. Parse records effect code at [0], version at [1]
  (0/1), flags at [2..].
- `SubModeMusicV3`: new path `13 <code> <sens>`; old path
  `13 <code> <sens> <!autoColor> <!dynamic> 00 00 00 [R G B at 5..7]`.
  Effect codes 3,4,5,6,56; sensitivity 0..99.
- `SubModeMusicV4` (H606A): declared effect codes 117–123 with direction/traversal tables
  (`getDirectionsByEffect`, `getTraversesByEffect`). Its `getWriteBytes()` returns the
  placeholder `13 00 00`; the real multi-frame music effect is produced by the H606A
  compose controller (`MultipleController4Music` / `H606ACubeMusicMode`).
- H6067 `ModeMusicGoodsType` is an empty stub (`getWriteBytes()` = `byte[0]`), i.e. music
  sub-mode is not implemented for H6067/H6065 in this split.

### H6067 colour

Same 0x15 protocol as cubelight but with 3 mask bytes: variant 1
`15 01 R G B [kHi kLo] m0 m1 m2` at payload[7..9]; variant 2
`15 02 B m0 m1 m2` at payload[3..5]. `parsePosColor` expects RGB at [3..5] and masks at
[6..7] (legacy parse only covers 16 segments).

## BLE notifications / readings

| parser | cmdType | layout | source |
|---|---|---|---|
| `WifiNotifyParse` | 17 (0x11) | `[0]==0` connected | both |
| `BrightnessNotifyParse` | 32 (0x20) | `[0]` brightness | both |
| `DeviceStatusNotifyParse` | 64 (0x40) | 10-byte status block | base |
| `MovieFeastOnOffNotifyParse` | 96 (0x60) | `[0]==1`, `[1]==1` on | base |
| multi-report `parse()` | header `0xEE` | second byte selects parser; for `DevCommReportParse` (only h7100/h7105 families) the whole frame is passed; cubelight/h6067 do **not** register it | `cubelight/ble/BleNotifyComm`, `h6067/ble/BleNotifyComm` |

Reads: `0xAA/0x02` (device self, multi reply), `0xAA/0x31` (shape map), `0xAA/0xA5`
(segment colour groups, h6061 base reader; H6067 legacy parse covers 16 bits), `0xAA/0x05`
(mode state). `AbsController.m()` gives parsers 17 valid bytes for reads.

`SubModeColor.parseColorStripByOnePacketBytes` decodes group variants; H6067
`parsePosColor` decodes one position packet with two mask bytes.

## IoT commands + status/readings schema

Envelope: `Write` + `AbsCmdWrite`, `type=1`, `origin=32`, `cmdVersion=0`, `cmd/data`.
Scene builders use `IotMsgProType.V2` and match `status` (cubelight) / `status`
(h6067) to the transaction.

| cmd | data | source |
|---|---|---|
| `turn` | `{val:0|1}` | `cubelight/iot/CmdTurn`, `h6067/iot/CmdTurn` |
| `brightness` | `{val:1..100}` | `CmdBrightness` (h6067 string literal `"brightness"`) |
| `colorwc` | `{color:{r,g,b}, colorTemInKelvin}` | `CmdColorWc` |
| `ptReal` | `{command:["<base64 20-byte frame>", …]}` | `CmdPtReal` (cubelight/h6067) |
| `status` (read) | type 0, no data | model `V()`/`IotOp` |
| `online` | read/keepalive | `IotOpV1`-style base |

`CmdPtReal` covers DIY protocol, DIY graffiti, AI DIY, `DiySendData`, H606A DIY and
new-scene controllers. It base64-encodes each 20-byte frame and preserves order.

Status: `State {onOff, brightness, mode, wifiHardVersion, wifiSoftVersion}` from
`com.govee.base2light.pact.newdetail.iot.State`; cloud frame results come back as
`ResultPt` (`opcode` + `modeValue/sleepValue/wakeupValue/timerValue/gradualValue` base64
lists) and are decoded into 20-byte frames. `Model.V()` reads `"status"` for both packages.

## Other protocols

- **Matter**: 228 (H6063), 163 (H606A), 284 (H6069). `Support.supportMatterFunc` and
  `H6063MatterHelper`; version gates:
  H6069 soft ≥1.00.03, WiFi 3.06.01, hard ≥1.03.01, DSP 1.04.02;
  H6063 soft ≥1.00.01, WiFi `Support.z`=3.04.01, hard ≥1.01.17, DSP 1.04.01;
  H606A soft ≥1.00.15, WiFi 3.04.01, hard ≥1.01.17, DSP 1.04.01.
- **WiFi/MQTT**: no LAN/UDP implementation in the split; cloud is the shared account-topic
  IoT transport. `Support.getWifiInputLimit()` = 32..64 bytes for the provisioning payload.
- **OTA**: shared base OTA only.

## Dynamic effects / motion / music / scenes / DIY

| effect | sub-mode | payload | attributes |
|---|---|---|---|
| solid / per-segment colour | `05/15` | `15 01 R G B [k] m0..m4` | up to 23/25/21/20/140/40 segments; per-segment mask; per-segment brightness (variants 3/4) |
| group all-brightness | `05/15` variant 3 | `15 03 group B0..B13` | max 14 values per packet |
| group all-colour | `05/15` variant 4 | `15 04 group R0G0B0..R3G3B3` | max 4 colours per packet |
| scene | `05/04` | `04 <eff LE16> <dir> [x/y or focus] <speed>` | effect id cloud catalog; direction code (1..13, 19/20 in some maps); speed 0..100; defaults 2229/2560; scene op set `{4}` |
| new DIY | `05/0A` | `0A <diyCode LE16>` | pixel data is multi-packet 0xA3 before this; grids: H6061 23, H6066 25, H606A 21, H6063 20, H6069 140, H6067/H6065 40 |
| music legacy | `05/13` | `13 <code> 00` | codes 51/53/56/57/58/59 |
| music V3 | `05/13` | `13 <code> <sens> [flags/RGB]` | codes 3/4/5/6/56; sens 0..99; auto-colour/dynamic flags |
| music V4 (H606A) | `05/13` + multi | declared 117..123 with direction/traversal lists; write placeholder `13 00 00` | direction codes -16..-6, 1..6, 12/13; traversal 0..5 |
| shape/panel layout | `0x31` | see shape protocols | panel type, x/y, angle, ext/mainPower, input/output numbers |
| calibration | `0x44/0x52` | see calibration | per-panel / all-panel |
| movie feast | notify `0x60` | on/off | shared base |

Effects are cloud-catalog driven; `ScenesV0/ScenesV1` only carry the direction maps and
the local scene name/id rows (H6067/H6065 tables contain ids 2229–2257).

## Source map (paths traced)

- `jadx-splits/split_pact_h6061/sources/com/govee/cubelight/pact/{Support,Comm,SubLib,SubMaker,DeviceItem,Model,H6061Maker,H6066Maker,H606AMaker,H6063Maker,H6069Maker}.java`
- `…/cubelight/ble/{BleComm,BleProtocol,BleNotifyComm,Mode,ModeController,Mode4ColorStrip,SubModeColor,SubModeScenes,SubModeMusic,SubModeMusicV3,SubModeMusicV4,SubModeMusicVersion,SubModeNewDiy,MultiDeviceController,MultiDeviceControllerH606A,CalibrationController,CalibrationAllController,InstallController,SetDeviceRecognitionController,DeviceSelfController}.java`
- `…/cubelight/scenes/*.java`, `…/cubelight/iot/*.java`, `…/cubelight/pact/bleiot/*.java`
- `…/cubelight/newdetails/scene/{CubeSceneM,CubeSceneViewMode,CubeSceneViewModeV2,CubeDelegateScene}.java`, `…/cubelight/adjust/h6063/H6063MatterHelper.java`
- `…/h6067/pact/{Support,Comm,SubMaker,H6067Maker,H6065Maker}.java`
- `…/h6067/ble/{BleComm,BleProtocol,Mode,ModeController,Mode4ColorStrip,SubModeColor,SubModeScenes,SubModeNewDiy,BleNotifyComm,CalibrationControllerH6065}.java`
- `…/h6067/adjust/ui/{ScenesV0,ScenesV1,ModeMusicGoodsType}.java`, `…/h6067/iot/*.java`
- `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/{AbsModeController,AbsMode,AbsMultipleControllerV1,AbsMultipleControllerV14Scenes}.java`
- `…/base2light/ble/comm/{MultipleBleBytes,MultipleControllerComm,MultipleControllerCommV1}.java`
- `…/base2light/widget/diy/bean/{h6063/PageEffect4H6063,h6069/ProConfig4H6069}.java`
- `…/base2home/iot/{Write,AbsCmd,AbsCmdWrite}.java`, `…/base2kt/utils/BleUtils.java`

## Gaps / unknowns

- H6067/H6065 colour writes only 3 mask bytes, so only 24 of the 40 declared segments are
  addressable by the write path; `parsePosColor` only decodes 16. This looks like a device
  protocol limit or an app defect — confirm on hardware.
- H6067 music sub-mode (`ModeMusicGoodsType`) is an empty stub; no music writer exists in
  the split.
- H606A music V4's `getWriteBytes()` returns `13 00 00`; the actual effect is composed from
  `MultipleController4Music`/`H606ACubeMusicMode` (multi frames). Direction/traversal are
  decoded but the exact cloud blob layout is data-dependent.
- Scene catalogs, names, direction tables and speed ranges beyond the defaults are cloud
  data. `ScenesV0/ScenesV1` hard-code only some ids (2229–2257).
- H6069 panel geometry / 140-segment DIY and the 0x50 recognition blob are data-driven.
  `SubModeColor` is a fixed 40-bit mask state, so the 140-pixel H6069 must use the
  panel/multi controllers for full per-pixel colour; the single colour packet only covers
  40 segments.
- Matter cluster/attribute mapping lives in the closed `com.govee.matter` library.


---

<!-- split_pact_h6062 -->

# split_pact_h6062 — H6062/H606A strip, H610A, H610B light-wall strings

Source root: `decompiled/jadx-splits/split_pact_h6062/sources/com/govee/striplight/`.

Three product generations sharing the `striplight` package:

| goodsType | SKU(s) | product | colour engine | scenes op set | transports |
|---|---|---|---|---|---|
| 41 | H6062, H606A | RGBIC strip light | V1 `SubModeColor` (33 segments) | `{0,1,2,3}` | **ble + iot** |
| 80 | H610A | RGBIC strip / "Glide Music Wall Light" | V2 `SubModeColorV2` + `ModeV2` | `{0,1,6}` | **ble + iot** |
| 114 | H610B | Light-wall / matrix strip | V3 `SubModeColorV3` + `ModeV2` | `{0,5}` (local scene speed save) | **ble + iot** |

Pact registration (`pact/Support.addSupportPact`): 41 gets `(1,1),(1,2),(2,1),(2,2),(3,1),(4,1)`;
80 `(1,1)`; 114 `(1,1)`. `Pact V1/V2/V3` checks are per goodsType. Colour size:
H6062 `ic/3`, H610A `ConsV1.colorsNum`, H610B `14`. `getBulbStringMaxNum`: 19 default,
28 for pact `(3,1)`, 33 for `(4,1)`.

---

## 1. Transports & GATT UUIDs

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `ble/BleComm.java` (`V`/`W`), `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`.
`Ble` is a standard `AbsBle` with `BlePtRealMultiComm` (`u()`). The GATT comm selects
`HeartControllerV2` for pact 0/1 and `ComposeHeartController` for newer pact types.

Notify list: `WifiNotifyParse` (0x11), `BrightnessNotifyParse` (0x20), `CheckIcNumParse` (0x21),
`IcAndPieceNotifyParse` (0x22), `DeviceStatusNotifyParse` (0x30),
`MovieFeastOnOffNotifyParse` (0x54).

---

## 2. BLE frame + command table

`BleProtocol` (`ble/BleProtocol.java`):

| constant | value |
|---|---|
| `sub_mode_color` | 21 / `0x15` |
| `sub_mode_music` | 19 / `0x13` |
| `sub_mode_scenes` | 4 / `0x04` |
| `sub_mode_new_diy` | 10 / `0x0A` |
| `SINGLE_IC_NUM_AND_PIECE_NUM` | 64 / `0x40` |
| `SINGLE_IC_SEGMENT_NUM` | 65 / `0x41` |
| `SINGLE_WRITE_CHECK_IC` | 66 / `0x42` |
| `SINGLE_NOTIFY_IC` | 33 / `0x21` |
| `SINGLE_NOTIFY_IC_AND_PIECE` | 34 / `0x22` |
| `SINGLE_LIGHT_POS` | 49 / `0x31` |
| `SINGLE_LR_SWITCH` | 51 / `0x33` |
| `SINGLE_GRADUAL_CHANGE_4_WIFI_BLE` | -93 / `0xA3` |
| `SINGLE_SPECIAL_FUC` | -90 / `0xA6` |
| `MSG_TYPE_READ_BULB_COLOR` | -92 / `0xA4` |
| `BRIGHTNESS_NOTIFY_IC` | 32 / `0x20` |
| `SINGLE_BRIGHTNESS_4_PIECE` | 67 / `0x43` |

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] 1..100` | `pact/Comm.makeBrightnessController4BleComm` |
| colour / mode | `0x33/0x05` | sub `0x15`, 17-byte layout below | `ble/SubModeColor.java`, `SubModeColorV2/V3` |
| music | `0x33/0x05` | sub `0x13` | `ble/SubModeMusic.java`, V2/V3 |
| scenes | `0x33/0x05` | sub `0x04` effect LE16 | `ble/SubModeScenes.java`, V1/V2 |
| new DIY | `0x33/0x05` | sub `0x0A` code LE16 | `ble/SubModeNewDiy.java` |
| IC + piece num | `0xAA/0x40` | empty read | `ble/IcAndPieceController.java` |
| IC segment num | `0xAA/0x41` | empty read | `ble/IcSegmentNumController.java` |
| check IC | `0x33/0x42` | empty write; notify 0x21 | `BleProtocol.SINGLE_WRITE_CHECK_IC` |
| light position | `0xAA/0x31` | `p()={pos}` / write `[0] 0/1` | `ble/LightPosController.java` |
| L/R switch | `0x33/0x33` | `[0] 0/1/16/17` | `ble/SwitchLRController.java` |
| special / calibration position | `0x33/0xA6` | `p()={1}` read; write `{1, 0/1}` | `ble/Special4PositionCalibrationController.java` |
| gradual change | `0x33/0xA3` | `[0] 0/1` | `ble/Gradual4BleWifiController.java` |
| bulb-string colour read | `0xAA/0xA5` | `p()={index}` | `ble/BulbStringColorController.java` |
| colour-strip segment | `0x33/0x05` | `15 02 brightness mask` or `15 01 RGB kelvin tempRGB mask` | `ble/ColorStripController.java` |
| multi music | `0x41` multi | header + per-piece data | `BleProtocol.value_multiple_set_music=65` |
| new/abstract music | `0x33/0x05` sub `0x16` | `SubModeAbsMusic` body | `ble/Mode.java` (`b == 22`), base `SubModeAbsMusic` |

### V1 colour payload (`SubModeColor.getWriteBytes`, 33 segments)

```
15 01 R G B kelLo kelHi R2 G2 B2 m0..m4   (RGB+temp, 5-byte mask, 33 segments)
15 02 brightness m0..m4                  (brightness + mask)
15 03 idx b0..b13                        (14 brightness bytes)
15 04 idx R G B ×4                       (group RGB)
```

### V2/V3 colour

`SubModeColorV2`/`V3` wrap the compact `OpColor` encodings. `getWriteBytes()`:
- mode 2 (`r==2`): one-byte sub-type + selected-segment bytes (`i()`/`j()` helpers).
- mode 1 (`r==1`): per-zone colour/temperature write.
- V3 additionally calls `OpColor.makeBytes(...)` for the 0x0D extended colour form and chooses
  sub-type 2 for gradual/segment modes, 1 for all/temperature modes.

`ModeV2` maps sub-type `0x15` to `SubModeColorV2`, `0x13` to `SubModeMusicV3`, `0x04` to
`SubModeScenesV1`, `0x0A` to `SubModeNewDiy`. The V1 `Mode` additionally dispatches sub-type
`0x16` to `SubModeAbsMusic` (new/abstract multi-music), distinct from the simple `0x13` form.

### Music

V1 (`SubModeMusic.getWriteBytes`):
```
13 <code> <sens> <dynamicFlag> <autoFlag> [R G B]     (7 bytes)
13 04 <sens> <mode> <dynamic> <auto> [R G B]          (8 bytes for rhythm)
```
Codes: `0 Energy, 1 Rhythm dynamic, 2 Joy, 4 Rhythm, 6 Impact, 7 Jet, 8 Jump` plus H6062 new
codes (`isH6062NewMusicCode`), rendered by `SubModeMusicV2`. H610A uses
`SubModeMusicV3` (new RGBIC/RGB code list). Sensitivity 0..99.

### Scenes / DIY

`04 epLo epHi`, `0A diyLo diyHi` — 16-bit LE. H610B scene speed/direction are stored locally
(`SubModeScenesV2` has transient `b`/`c` for speed/direction) and applied via the V1 local-scene
builder `Support.isH610BLocalScenesMode`.

---

## 3. BLE notifications / readings

| reading | op | layout | source |
|---|---|---|---|
| IC / segment count | `0x21` | `[0..1]` LE16 IC count, `[2]` segment count | `ble/CheckIcNumParse.java` |
| IC and piece count | `0x22` | `[0]` sub_ic_1, `[2]` sub_ic_2 (17-byte valid buffer) | `ble/IcAndPieceNotifyParse.java` |
| brightness | `0x20` | `[0]` brightness | `ble/BrightnessNotifyParse.java` |
| device status | `0x30` | base `DeviceStatusNotifyParse` | `ble/BleNotifyComm.java` |
| movie feast on/off | `0x54` | `[0]==1`, `[1]` on/off | base `MovieFeastOnOffNotifyParse` |
| wifi | `0x11` | `[0]==0` connected | `ble/WifiNotifyParse.java` |
| bulb-string colour | `0xAA/0xA5` | `BulbGroupColor.parseBytes` → 4-bulb RGB groups | `ble/BulbStringColorController.java` |

`BleParser` decodes per-colour-mode reads:
- `BrightnessParse`: `[0]` group index, then 4 brightness values at stride 4.
- `ColorParse2`: `[0]` group index, then 4 RGB triplets at stride 4.
- `parseSpeed(sceneV1, effect)`: reads speed from effect byte 3 (default 100).

---

## 4. IoT commands + status/readings schema

Envelope **`IotMsgV2`**.

`iot/Cmd.java`: `state`, `op`, `online`, `turn`, `brightness`, `status`, `colorwc`, `ptReal`,
`pt`.

| cmd | data | response | source |
|---|---|---|---|
| `turn` | `{"val":0\|1}` | `state` | `iot/CmdTurn.java` |
| `brightness` | `{"val":1..100}` | `state` | `iot/CmdBrightness.java` |
| `colorwc` | `{"color":{r,g,b},"colorTemInKelvin":int}` | `state` | `iot/CmdColorWc.java` |
| `ptReal` | `{"command":["<base64 20-byte>",...]}` | `op.pt[]` | `iot/CmdPtReal.java` |
| `status` | `{}` | `state/op` | base |

`CmdPtReal` builders:
- `getDiyCmdPt(DiyProtocol)` → `MultipleDiyControllerV1` bytes + `0A <code>`.
- `getDiyCmdPt4Diy(AbsMultipleControllerV14Diy)` → multi bytes + `0A <code>`.
- `getDiyCmdPt4DiyGraffiti(DiyGraffitiV2)` → `MultiDiyGraffitiController` bytes + `0A <code>`;
  capped at 19 commands.
- `getDiyCmdPt4DiyStudio(...)` → multi template + `04 <effect>`.
- `getDiyTemplateCmdPt(...)` → multi template + `04 <effect>`.
- `getNewScenesCmdPtReal(...)` → multi scene + `04 <effect>`.
- `getMultiNewMusicMode4H6062/4H610A(...)` → `MultipleBleBytes.getMultipleWriteBytesV2` + music
  mode frame; `musicCode`/`musicSensitivity`/`opVersion` fields accompany `ptReal`.

Status: `state`/`op`; `op.pt[]` base64 frames are decoded by the family parsers. Colour-mode
reads (`0xAA/0x05`) return the current sub-mode and are parsed by `Mode.parseSubMode`.

---

## 5. Other protocols

- **BLE broadcast add** — `add/BleBroadcastProcessor`, V2/V3 connect dialogs, WiFi choose.
- **HTTP** — add/bind and OTA APIs in base; no family-specific net service.
- **Local scene speed save** — `Support.supportScenesSpeedSave(114)` and
  `ScenesSpeedManager` store speed per scene locally.
- **No Matter/MQTT/LAN/IR/RF** in this split.

---

## 6. Dynamic effects / music / scenes / DIY

### Colour (`0x15`)

- V1: 33-segment mask, `15 01/02/03/04` layouts (see §2).
- V2 (H610A): per-colour/zone compact `SubModeColorV2` with symmetry (`makeSubModeColor4Symmetry`)
  and gradient (`Gradual4BleWifiController`).
- V3 (H610B): `SubModeColorV3` uses `OpColor` bytes; supports per-segment relative brightness
  (`Support.supportSegmentRelativeBrightness`) and 14-bulb/segment groups.

### Music (`0x13`)

`SubModeMusic` (V1), `SubModeMusicV2` (H6062 new codes), `SubModeMusicV3` (H610A RGBIC/RGB).
Fields: code, sensitivity 0..99, dynamic flag, auto-colour flag, manual RGB. `SubModeMusicV2`
short form is `13 <code> <sens>`, extended `13 04 <sens> <dynamic>`. Sub-type `0x16` is the
new/abstract multi-music form (`SubModeAbsMusic`).

### Scenes (`0x04`)

V1 `SubModeScenes` (`04 epLo epHi`), V1/V2 subclasses persist effect locally. H610B builds local
scene controllers from `ScenesM` + stored speed/direction
(`ScenesOp.parseSceneV1H610BDetailAc`). Scene op sets: 41 `{0,1,2,3}`, 80 `{0,1,6}`,
114 `{0,5}`.

### DIY (`0x0A`)

H610B uses the DIY-new engine: `DiyParse4H610B` protocol code **4**, share code **41 (0x29)**.
Classes: `DiyEffect4H610B` (single effect), `H610BSingleEffect`, `H610BAdvancedEffect`
(per-layer effect codes), `H610BAdvance`/`H610BAdvancedUI`. H610A uses
`NewConfigManager4H610A` (base RGBIC/RGB config). No explicit fixed effect integers are exposed
in this split beyond the protocol/share codes.

---

## 7. Source map (traced)

- Registration/SKUs: `pact/{Support,SubLib,SubMaker,H6062Maker,H610AMaker,H610BMaker,Model}.java`
- Transport: `ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol,BleParser}.java`
- Mode/sub-modes: `ble/{Mode,ModeController,ModeV2,ModeControllerV2}.java`,
  `ble/SubModeColor{,V2,V3}.java`, `ble/SubModeMusic{,V2,V3}.java`,
  `ble/SubModeScenes{,V1,V2}.java`, `ble/SubModeNewDiy.java`
- Controllers: `ble/{BulbStringColorController,ColorStripController,IcAndPieceController,
  IcSegmentNumController,LightPosController,SwitchLRController,
  Special4PositionCalibrationController,Gradual4BleWifiController,MultiMusicController}.java`
- IoT: `iot/{Cmd,CmdTurn,CmdBrightness,CmdColorWc,CmdPtReal}.java`
- New detail/DIY: `newdetail/*`, `newdetail/newdiy/*`, `newdetail/scene/*`
- Add flow: `add/*`, `add/v2/*`, `add/v3/*`

## 8. Gaps / unknowns

- H6062/H610A/H610B per-device segment counts come from IC reports at runtime
  (`ConsV1.colorsNum`, `Support.colorSize`); only the group frame size is static.
- H610A/H610B DIY effect-code lists are managed by the base DIY-new config (`NewConfigManager4H610A/B`);
  only H610B protocol 4 / share code 41 are explicit.
- `SubModeColorV2`/`V3` `OpColor` byte encoding is in the base library; this split only selects
  the op type and passes colour/segment data.
- Local scene speed/direction (H610B) are transient values persisted via `ScenesSpeedManager`,
  not a fixed wire layout.
- Music code names come from `IMusicEffectStatic`/`AbsNewMusicEffect` in base, not from this split.


---

<!-- split_pact_h6079 -->

# split_pact_h6079 — H6079 / H607C / H16B0 + H6020 sub-family

## Overview / family and SKUs

Two goods-type families share this split module:

| goodsType | SKUs | product | family class | notes |
|---|---|---|---|---|
| 156 | **H6079** | RGBICWW Floor Lamp ("Glow") | `h6079` | 14 addressable bulbs, 2200–6500 K |
| 209 | **H607C**, **H807C** | Floor Lamp | `h6079` | 13 bulbs, 2200–6500 K, custom music |
| 376 | **H16B0** | Floor Lamp (RGBICWW) | `h6079` | 17 bulbs, 1000–10000 K, music V3 |
| 210 | **H6020** | Table Lamp | `h6020` | 0x0D/0x15 colour sub-modes, battery |
| 249 | **H6022**, **H8022** | Table Lamp | `h6020` | 12-colour scene set |
| 365 | **H1741**, **R1741** | Table Lamp (battery) | `h6020` | 0x15 colour sub-mode, battery/energy-save |

Sub-libraries: `h6079/pact/SubLib.java` (`Support.j` = 156/209/376) and
`h6020/pact/SubLib.java` (`Support.o()` = 210/249/365). Makers:
`H6079Maker`, `H607CMaker`, `H16B0Maker`, `H6020Maker`, `H6022Maker`, `H1741Maker`
(all extend `AbsBleWifiSku`, i.e. BLE + WiFi/IoT).

Transports: **ble + iot** for every SKU. Matter pairing is additionally advertised for
156/209/376 (`Support.supportMatterFunc`, `H607CMatterHelper`). No LAN/UDP endpoint is
implemented in the split; cloud traffic is the account MQTT topic carried by the IoT layer
(`IotExt.topic`).

## Transports & GATT UUIDs

Both families (`h6079/ble/BleComm.java`, `h6020/ble/BleComm.java` → `BleCommUUID`):

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- heart controller: `HeartControllerNoEvent` (h6079), `HeartControllerNoEvent` (h6020)
- notifications arrive on the same characteristic; notify parsers are registered on the
  service UUID (`BleNotifyComm.getServiceUuid()`).

## BLE frame + command table

Frame = 20 bytes `[proType][cmdType][payload 17][BCC]`, BCC = XOR of bytes 0..18
(`BleUtils.generate20Bytes`, `AbsSingleController.f()/g()`). Write proType `0x33`,
read proType `0xAA`. `AbsModeController.p()` overrides the read payload to `{01}`.

### H6079 / H607C / H16B0 (goodsType 156/209/376)

| # | command | op (proType/cmdType) | write payload (after 33/xx) | response / notes |
|---|---|---|---|---|
| 1 | power | `0x33/0x01` | `01` on, `00` off | `0xAA/0x01` → `[0]` state (`SwitchController`) |
| 2 | brightness | `0x33/0x04` | `[0]` 1..100 | read `0xAA/0x04` → `[0]` value |
| 3 | mode / colour / scene / DIY / music container | `0x33/0x05` | sub-mode block (below) | read `0xAA/0x05` payload `01`; response `[0]`=sub-mode, rest sub-mode bytes |
| 4 | segmented colour write | `0x33/0x05` sub `0x15` | variants 1/2/3 (below) | no direct response |
| 5 | new-DIY select | `0x33/0x05` sub `0x0A` | `0A <diyCode LE16> <slot LE16>` | — |
| 6 | scene select | `0x33/0x05` sub `0x04` | `04 <effect LE16> <musicCode LE16>` | musicCode=0 when music switch off |
| 7 | music | `0x33/0x05` sub `0x13` | V1/V2/V3 forms (below) | new-music (V2/V3) = `13 <code> <sensitivity>` |
| 8 | gradual / fade | `0x33/0xA3` | `[0]` 1 = on, 0 = off | `0xAA/0x05` read (19-byte strip); start/end colour packets flank it |
| 9 | remote-control pair | `0x33/0xA4` | `[0]` 1 = pair, 0 = exit | `0xAA/0xA4`/notify |
| 10 | read bulb/string colour groups | `0xAA/0xA5` | `[0]` start group index | 17 valid bytes: `[idx][brightness][R][G][B] ×4` (`BulbGroupColorV2`) |
| 11 | device info | `0x33/0x08` | empty | `0xAA/0x08` |
| 12 | heart / presence | `0xAA/0x01` | empty | `[0]` != 0 |
| 13 | WiFi/BLE state notify | `0xEE/0x11`? (parser cmdType 17) | — | `[0]==0` = connected (`WifiNotifyParse`) |
| 14 | brightness notify | notify cmdType `0x20` | — | `[0]` brightness, `[1]` extra (h6079) / `[0]` only (h6020) |
| 15 | switch-status notify | notify cmdType `0x30` | — | h6079: `[1]` switch id, `[2]==1` on |
| 16 | device-status notify | notify cmdType `0x40` | — | 10-byte status block (`DeviceStatusNotifyParse`) |
| 17 | movie-feast notify | notify cmdType `0x60` | — | `[0]==1`, `[1]==1` on |

#### Multi-packet framing (DIY / scenes / colour strips)

Long payloads (DIY pixel blobs, scene effect blobs, per-segment colour groups) are wrapped
by `MultipleBleBytes` → `MultipleControllerCommV1`. All packets stay 20 bytes, BCC in byte
19, proType `0xA3`:

- `makeSendBytesV0` (controller `p()==0`): start packet
  `A3 00 00 (packCount+2) <cmdType> 00…`; data packet `A3 <index 1..n> <17-byte chunk>`;
  end packet `A3 FF 00…`.
- `makeSendBytesV1/V2` (controller `p()==1`, e.g. scenes): start packet
  `A3 00 01 <totalPacks> <cmdType>` + first chunk at byte 5..; middle packets
  `A3 <index> <17-byte chunk>`; final packet `A3 FF <last chunk>`.
- `MultipleControllerComm` (legacy) uses `generate20Bytes(proType, cmdType, {0,packCount,p})`
  as start, `[proType][cmdType][index][16-byte chunk]` data packets, and
  `generate20Bytes(proType, cmdType, {FF})` end; 300 ms between packets.

`CmdPtReal` sends each packet as one base64 string in order, so the cloud path reproduces
the same sequence.

#### Colour sub-mode `0x15` (h6079) exact layouts

All are payloads after `33 05` (so first byte is the sub-mode):

- variant 1 (single colour / colour-temp):
  `15 01 R G B kHi kLo R2 G2 B2 m0 m1`
  - `kHi kLo` = colour temperature, signed big-endian 16-bit (°K); 0 means RGB mode.
  - when k != 0 the lamp uses `R2 G2 B2` (temperature RGB) instead of `R G B`.
  - `m0 m1` = 16-bit segment mask, LSB = segment 0 (max 14/13/17 segments).
  - source: `h6079/ble/SubModeColorV2.getWriteBytes()`.
- variant 2 (group brightness):
  `15 02 B m0 m1` — brightness + mask for that group.
- variant 3 (all segment brightness values):
  `15 03 B0 B1 ... Bn` — up to 15 values, one packet.
- `makeSubModeColor(Colors, goodsType)` emits one variant-1 packet per distinct colour plus an
  optional variant-3 packet for `brightnessSet`; only the final packet is flagged "last"
  (`Mode4ColorStrip.a`). `parsePosColor` reads a 20-byte `ptReal` frame as
  `[3]=variant 1`, RGB at 4..6, kelvin at 7..8, RGB2 at 9..11, mask at 12.

#### Music exact layouts

`SubModeMusic` (legacy V1, `subModeCommandType()=0x13`):

`13 <effectCode> <sensitivity 0..99> <autoFlag> [R G B]` — 7 bytes normally `autoFlag=1`
(manual fixed colour, RGB appended), 8 bytes for rhythm code 114 where byte 3 is
dynamic/soft flag: `13 72 sens soft autoFlag R G B`.

`SubModeMusicV2` / `V3` (new music, h6079: version 1; H607C: version 2; H16B0 version 3):
new code path returns `13 <code> <sensitivity>`; old path is identical to V1. H16B0 with
music version ≥3 selects `SubModeMusicV3` (`Support.supportH16B0MusicEffectV3`).

Music codes declared in `newdetail/h6079/music/H6079NewMusicMode`:
`115` (default "impulse"), `114` rhythm, `51` joy/move, `79`, `81`, `116`, `80`,
`131`, `132`, `133`, `8`, `130`, `134`, `135`, `137`. Sub-effect codes 131–137 and
134/135 are the newer H16B0 effects; names live in resources (runtime).
`Sensitivity` is clamped 0..99. `SubModeScenes.musicCode` is 16-bit LE.

#### H16B0/H607C special ranges

- colour-temp: H16B0 1000–10000 K; others 2200–6500 K (`Support.getColorTemRange`).
- bulb count: H6079 14, H607C 13, H16B0 17 (`Support.getBulbStringMaxNum`).
- DIY IC grid: H6079 54×10, H607C 144×30, H16B0 48×19 (`Support.getDiyIcNum`).
- H16B0 music effects split into 117–123 style custom effects (`newdetail/music/H16b0MusicProxy`).

### H6020 / H6022 / H1741 (goodsType 210/249/365)

Same switch/brightness/mode/scene/DIY/music opcodes. Differences:

| command | op | payload |
|---|---|---|
| colour (old, all SKUs except 365 chooses 0x0D) | `0x33/0x05` sub `0x0D` | `0D R G B kHi kLo R2 G2 B2` (9 bytes) |
| colour V2 (goodsType 365) | `0x33/0x05` sub `0x15` | `15 01 R G B kHi kLo R2 G2 B2 m0..m6` or `15 02 B m0..m6`; only an 8-bit segment array exists, so only `m0` is non-zero (bytes 11..16 written as 0) |
| scene | `0x33/0x05` sub `0x04` | `04 <effect LE16> <musicCode LE16>` |
| new DIY | `0x33/0x05` sub `0x0A` | `0A <diyCode LE16> <slot LE16>` |
| music | `0x33/0x05` sub `0x13` | `13 <code> <sensitivity 0..99>` |
| gradual | `0x33/0xA3` | `00/01` |
| remote pair | `0x33/0xA4` | `00/01` |
| read colour groups | `0xAA/0xA5` | `[idx]` |
| preset multi-scene | `0x40/0x41/0x50/0x58` or `0x04` | see dynamic effects |

`Comm.e/g` choose `SubModeColorV2` only for goodsType 365, otherwise `SubModeColor`
(0x0D). Brightness/temperature controllers are the shared base classes.

Preset multi-scene: `h6020/adjust/controller/MultiPresetScenesController` extends
`AbsMultipleControllerV14Scenes`; its constructor takes an opcode. `Support.g()` passes
**88 (0x58)** for H6020 and for parameters whose first byte is 0x40/0x41, otherwise
**4**. The constructor strips the first byte of the cloud scene parameter and uses the
rest as the multi-packet payload. (`0x40`/`0x41`/`0x50` are scene-parameter markers, not
opcodes.)

## BLE notifications / readings

Registered in `h6079/ble/BleNotifyComm` / `h6020/ble/BleNotifyComm`:

| parser | cmdType | layout / meaning | source |
|---|---|---|---|
| `WifiNotifyParse` | 17 (0x11) | `[0]==0` → WiFi/BLE connected | h6079/h6020 `ble/WifiNotifyParse` |
| `BrightnessNotifyParse` | 32 (0x20) | h6079: `[0]` brightness, `[1]` unknown/aux; h6020: `[0]` brightness | both `ble/BrightnessNotifyParse` |
| `RemoteControlParse` | 0xA4 (-92) | `[0]` pairing state | `h6079/ble/RemoteControlParse` |
| `DeviceSwitchStatusNotifyParse` | 48 (0x30) | h6079: `[1]` switch id, `[2]==1` on. h6020: `[0]==1` → `[1]` on, `[2]`?; `[0]==0x30` → `[1]` battery byte | both |
| `DeviceStatusNotifyParse` | 64 (0x40) | 10-byte device status block | base |
| `MusicNotifyParse` | onlinesound lib | music/white-noise state | base `onlinesound.cmd` |
| `MovieFeastOnOffNotifyParse` | 96 (0x60) | `[0]==1`, `[1]==1` on | base |

`AbsController.m()` strips headers: read (0xAA) → 17 valid bytes from index 2; write
(0x33) → 16 bytes from index 3.

### H6020 IoT / ptReal reading parser

`h6020/iot/CmdStatusV0` parses frames returned in `op.command` (base64 20-byte frames) and
extracts:

| frame cmdType | field | layout |
|---|---|---|
| `0x07` + sub `0x07` | DSP version | `[3][4]` 16-bit BE |
| `0x42` (66) | battery / device info | `BatteryInfo`, `DeviceInfo` from 17 valid bytes |
| `0x41` (65) | other info (pair/voice/disturbance/energy-save/battery/light) | `[0]` bit7 pair status, bit6 pair voice, bit5 disturbance, bit4 energy-save, bit3 light; `[1]` battery byte |
| `0x05` (5) | mode | `[2]` sub-mode + sub-mode block |
| `0x11` (17) | sleep | `SleepInfo` |
| `0x12` (18) | wake-up | `WakeUpInfo` |
| `0x23` (35) | timers | `NewTimerV1Controller.parseAllTimer` |
| `0x36` (54) | worry-free-at-night | `WorryFreeAtNightBean` |
| `0x71` (113) | white-noise player | `PlayerState` |
| `0x79` (121) | volume | valid byte 0 |
| `0x7A` (122) | white-noise switch | valid byte 0 |
| `0xF1` (-15) | day-sync state | `[2]==1` |

Battery byte (`h6020/adjust/bean/BatteryInfo`): bit7 = charging/full flag; bits 6..4 =
level 0..7 (`getValue(b,5,3)`); bit3/bit2/bit1/bit0 = pair-status/pair-voice/disturbance/
energy flags (order per `BatteryInfo.Companion.a`). `d()` returns 98/99 when the full flag
is set, else the 3-bit level.

## IoT commands + status/readings schema

Envelope (`com.govee.base2home.iot.Write` + `AbsCmdWrite`): type 1, origin 32,
cmdVersion 0 (unless overridden), `cmd` from `AbsCmd.getCmd()`, `data` = serialized fields of
the `AbsCmd` subclass. Reads are `Read`/type 0. Incoming variant parsed by the scene
builders is `IotMsgProType.V2` (`IotSwitchCmdBuilderV1`), normal status handling uses the
account-topic JSON with `state` / `op` objects.

| cmd | data fields | source |
|---|---|---|
| `turn` | `{"val":0|1}` | `h6079/iot/CmdTurn` |
| `brightness` | `{"val":1..100}` (brightness range 1..100, no remap) | `CmdBrightness` |
| `colorwc` | `{"color":{"r":..,"g":..,"b":..},"colorTemInKelvin":0|K}`; kelvin only if in allowed set | `CmdColorWc` |
| `ptReal` | `{"command":["<base64 20-byte frame>", …]}` | `CmdPtReal` |
| `pt` | passthrough (declared in `h6079/iot/Cmd`; no Cmd class) | `Cmd` |
| `status` (read) | type 0 | `Model.V()` returns `"status"` |
| `online` | read/keepalive, `getWifiOnlineCmd()` | `AbsEffectOp4BleIot` |

Every non-uniform colour/scene/DIY operation is sent as `ptReal`, one base64 entry per
20-byte BLE frame, in the exact order produced by the multi-controller. `CmdPtReal`
constructors/makers: single controller, `List<byte[]>`, DIY protocol/graffiti/studio/AI,
new-scene controller, colour-strip `Colors`, and raw op list. `getOpCommandByte()` returns
frame byte 1 of the last command; `isSetColorStrip()` requires every frame's byte 2
(sub-mode) to equal 0x15 (h6079) / 0x0D (h6020).

Status schema: the base light status is `State`/`StateV0`
(`com.govee.base2light.pact.newdetail.iot.State{,V0}`): `brightness` int, `onOff` int
(0/1); V0 additionally `color` object, `colorTemInKelvin`, `mode`, `modeValue[]`,
`sleepValue[]`, `wakeupValue[]`, `timer`, `softVersion`, `wifiSoftVersion`.
`ResultPt` (`com.govee.base2light.iot.common.ResultPt`) carries `opcode` +
`modeValue/sleepValue/wakeupValue/timerValue/gradualValue` base64 frame lists, plus a
nested `State {onOff, brightness, mode, wifiHardVersion, wifiSoftVersion}`.

## Other protocols

- **Matter**: 156/209/376 only. `Support.supportMatterFunc` and
  `h607c/H607CMatterHelper` add the Matter interceptor; the version gates are:
  H607C: soft ≥1.00.01, WiFi 3.04.01, hard ≥1.01.17, DSP 1.04.01;
  H6079: soft ≥1.00.21, WiFi 3.04.01, hard ≥1.01.01, DSP 1.05.02; H16B0 unconditional.
  Pairing goes through `MatterManager`/`MtGuide` from `SettingAc`.
- **BLE broadcast / WiFi**: not present; connect state is reported through `0x11`.
- **OTA**: not defined in the split; uses the shared base OTA channel.

## Dynamic effects / motion / music / scenes / DIY

| effect class | sub-mode/op | payload / parameters | notes |
|---|---|---|---|
| solid / segmented colour | `05/15` | variant 1/2/3 above | up to 14/13/17 segments; per-segment mask; optional per-segment brightness (`Support.supportSubModeColor4PartBrightness()` = true) |
| colour temperature | `05/15` or `05/0D` | kelvin 2200–6500 (H16B0 1000–10000), RGB2 fallback | flag = kelvin != 0 |
| scenes | `05/04` | `04 <effect LE16> <music LE16>` | effect IDs are cloud catalog values; default 2002, H6079 default 2099. Supported scene op sets `{0,1,2,3,6}`, apply set `{1,2,6}` (`Support.supportScenesOpSet/supportApplySceneOp`). Scene object also carries direction/speed/music switch which is expanded by `ScenesOp.parseSceneV1` into a multi-packet effect (0xA3) before the final `05/04`. |
| new DIY | `05/0A` | `0A <code LE16> <slot LE16>` | slot for H16B0/H607C multi-DIY; DIY grid sizes above. Multi-packet DIY data (0xA3) precedes this frame; `CmdPtReal.getDiyCmdPt*` appends the select frame. |
| music V1 | `05/13` | `13 code sens autoFlag [RGB]` | codes legacy 0/6/7/8/51/114; sensitivity 0..99 |
| music V2/V3 | `05/13` | `13 code sens` | H607C version 2, H16B0 version 3; code table 115/114/51/79/81/116/80/131–137 |
| custom music / light code | `05/13` + multi | custom effect is a base64 `CustomLightCode` sent as multi frames; `H607CMusicCustomEffect` supplies `musicCode`/`lightEffectCode` | cloud-defined per effect |
| gradient / gradual | `0xA3` | `00/01` enable | part-colour sequence = `05/15` frames + `AA/A5` read + `A3` end frame (`CmdPtReal.isOtherMode2ColorModePtWithBrightness`) |
| preset multi-scene (H6020) | `04/40/41/50/58` | cloud scene param, first byte stripped; `AbsMultipleControllerV14Scenes` multi-packet | H6020 chooses 0x58 for params starting 0x40/0x41 |
| white noise (H6020) | `0x71` / `0x7A` over online-sound channel | media player state (`PlayerState`) | available across the H6020 family per online-sound config; `BleIotInfoH6020` maps 0x71/0x7A |
| hardware effects (direction/preview/segment) | `0x16/0x27/0x0F` shared base controllers | direction byte/effect id/segment mask | not overridden in this split |

Motion: no motion motor in these SKUs. "Gradual" is the only time-based transition.

## Source map (paths traced)

Relative to `decompiled/`:

- `jadx-splits/split_pact_h6079/sources/com/govee/h6079/pact/{Support,Comm,SubLib,SubMaker,Register4Item,Model,DeviceItem,H6079Maker,H607CMaker,H16B0Maker}.java`
- `…/h6079/ble/{BleComm,BleProtocol,BleNotifyComm,Mode,ModeController,Mode4ColorStrip,SubModeColorV2,SubModeScenes,SubModeMusic,SubModeMusicV2,SubModeMusicV3,SubModeMusicVersion,SubModeNewDiy,DiyLocal,Gradual4BleWifiController,BulbStringColorControllerV2,BulbGroupColorV2,RemoteController,RemoteControlParse,WifiNotifyParse,BrightnessNotifyParse,DeviceSwitchStatusNotifyParse}.java`
- `…/h6079/scenes/*.java`, `…/h6079/iot/*.java`, `…/h6079/pact/bleiot/*.java`
- `…/h6079/newdetail/h6079/music/H6079NewMusicMode.java`, `…/h6079/newdetail/music/{H6079,H607c,H16b0}MusicProxy.java`, `…/h6079/h607c/music/*.java`
- `…/h6020/pact/{Support,Comm,SubLib,SubMaker,Register4Item,H6020Maker,H6022Maker,H1741Maker}.java`
- `…/h6020/ble/{BleComm,BleProtocol,Mode,ModeController,SubModeColor,SubModeColorV2,SubModeScenes,SubModeNewDiy,BleNotifyComm,WifiNotifyParse,BrightnessNotifyParse,DeviceSwitchStatusNotifyParse}.java`
- `…/h6020/iot/{CmdStatusV0,State,CmdPtReal}.java`, `…/h6020/adjust/controller/{MultiPresetScenesController,DeviceOtherInfo,CommonReadDeviceInfo}.java`, `…/h6020/adjust/bean/BatteryInfo.java`
- `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/{AbsSingleController,AbsModeController,AbsMode,BrightnessController,SwitchController,HeartController}.java`
- `…/base2light/ble/comm/{AbsBleComm,AbsNotify,AbsNotifyParse,MultipleBleBytes,MultipleControllerComm,MultipleControllerCommV1}.java`
- `…/base2light/iot/common/ResultPt.java`, `…/base2light/pact/newdetail/iot/{State,StateV0}.java`
- `…/base2home/iot/{Write,AbsCmd,AbsCmdWrite}.java`, `…/base2kt/utils/BleUtils.java`
- `jadx-splits/split_pact_h6079/sources/com/govee/common/params/BleCommUUID.java`

## Gaps / unknowns

- Effect catalog (scene IDs, names, per-scene direction/speed, custom music light codes) is
  cloud-supplied at runtime; only defaults 2002/2099 and the op-set masks are static.
- `SubModeMusicV3` is a near-copy of V2 (TAG still `"SubModeMusicV2"`); H16B0 version
  gating is runtime (`supportH16B0MusicEffectV3`).
- H6020 `SubModeColorV2` declares an 8-bit segment array but loops 7 mask bytes; bytes
  11..16 are always zero. Segment count is therefore effectively 8.
- `h6079/scenes` and `h6020/scenes` expose only the basic builders (brightness, colour,
  colour-temp, switch, heart); scene/DIY creative builders are in `base2home.scenes` and
  are data-driven.
- Matter cluster/attribute mapping is in the closed `com.govee.matter` library; the split
  only registers the interceptor and version gates.


---

<!-- split_pact_h6092 -->

# split_pact_h6092 — H6092 / H6091 / H6093 / H6094 / H6095 / H609D / H7070 / H7071 / H7073 / R1810 / H1811 / H3860 / H1880

Source root: `decompiled/jadx-splits/split_pact_h6092/sources/com/govee/h6092/`

## Overview / family and SKUs

This split is a shared "new light" module with 13 goods-types and 13 `*Maker` SKU items
(`pact/SubMaker.java`). Every item extends `AbsBleWifiSku` → `ble+iot`.

| SKU | goodsType | maker | color pieces | notes |
|---|---|---|---|---|
| H6092 | 167 | `H6092Maker` | 14 | supportApplyOpSet {0,1,2,3,5,11} |
| H6093 | 271 | `H6093Maker` | 14 | `MultiPresetScenesH6093Controller`, music code scene |
| H7070 | 283 | `H7070Maker` | 14 | scene via `makeSceneCmd4IotCommH7070` |
| H6095 | 323 | `H6095Maker` | 7 | |
| H6094 | 322 | `H6094Maker` | 1 | |
| H609D | 331 | `H609DMaker` | 14 | operate mode 0x43 |
| H7073 | 333 | `H7073Maker` | 14 | `supportEffectChange` always true |
| H7071 | 334 | `H7071Maker` | 14 | no effect change |
| R1810 | 340 | `R1810Maker` | 3 | segment color mode / stack DIY |
| H6091 | 101 | `H6091Maker` | 14 | music sub-mode 0x0F |
| H1811 | 399 | `H1811Maker` | 14 | flow direction support |
| H3860 | 401 | `H3860Maker` | 14 | |
| H1880 | 402 | `H1880Maker` | 14 | on/off memory |

`Support.x` = keys list `{167,271,283,323,322,331,333,334,340,101,399,401,402}`;
`Support.y` (effect-op set) omits 101 and 334: `{167,271,283,323,322,333,331,340,401,402}`.
Pact registration (`Support.addSupportPact`) uses `GoodsType.beProtocol(1,1)` for most,
`(1,1)+(1,2)+(2,1)` for 167/271/283, `(1,1)+(2,1)` for 334, `(1,1)+(1,2)` for 399.

Transport: `ble` + `iot` (cloud topic). `pact/DeviceItem extends AbsBleIotItem`,
`pact/Model extends AbsDeviceModel4BleIot`.

## Transports & GATT UUIDs

- Service `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/BleComm.java`, `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`.
- Heart: `HeartControllerNoEvent` (`BleComm.l()`).
- Multi: `Ble.v()` → `BleMultiComm extends AbsMultipleBleComm`; `Ble.u()` → `BlePtRealMultiComm`.

## BLE frame + command table

Frame: `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`. Single write `0x33`, single read
`0xAA`; multi-controller V1/V2 `proType 0xA3` (`AbsMultipleControllerV1.getProType`).

`ble/BleProtocol.java`:

| const | dec | hex |
|---|---|---|
| sub_mode_scenes | 4 | 0x04 |
| MSG_TYPE_READ_GRADUAL | 5 | 0x05 |
| SINGLE_SET_AUTO_OFF_H6093 | 5 | 0x05 |
| SINGLE_SET_LIGHT_SWITCH_H6093 | 1 | 0x01 |
| SINGLE_SET_PAIR_STATUS_SWITCH_H6093 | 2 | 0x02 |
| SINGLE_SET_PAIR_VOICE_SWITCH_H6093 | 3 | 0x03 |
| SINGLE_SET_DISTURBANCE_SWITCH_H6093 | 4 | 0x04 |
| SINGLE_SET_FEAST_LASER_SWITCH_H6093 | 7 | 0x07 |
| sub_mode_new_diy | 10 | 0x0A |
| sub_mode_operate_V2 | 12 | 0x0C |
| sub_mode_music_h6091 | 15 | 0x0F |
| sub_mode_color / color_v2 | 21 | 0x15 |
| sub_mode_operate | 32 | 0x20 |
| notify_brightness | 32 | 0x20 |
| notify_auto_off | 36 | 0x24 |
| controller_type_preview_effect | 39 | 0x27 |
| SINGLE_SET_CHILDREN_SWITCH_H6093 | 48 | 0x30 |
| controller_type_play_pause_voice | 49 | 0x31 |
| music_info_notify / sleep_info_notify_h6092 | 49 | 0x31 |
| controller_type_voice_volume | 50 | 0x32 |
| sleep_info_notify | 50 | 0x32 |
| GET_NECESSARY_INFO / lamp_effect_change | 66 | 0x42 |
| GET_OPERATE_INFO | 67 | 0x43 |
| FEAST_PATTER_SWITCH | 69 | 0x45 |
| EXIT_REMOTE_CONTROL_PAIR | -90 | 0xA6 |
| MSG_TYPE_READ_BULB_COLOR | -91 | 0xA5 |
| REMOTE_CONTROL_PAIR | -92 | 0xA4 |
| SINGLE_GRADUAL_CHANGE_4_WIFI_BLE | -93 | 0xA3 |

Music ids (`value_sub_mode_music_*`): energy 0x00, impact 0x06, jet 0x07, jump 0x08,
joy 0x33 (51), rhythm 0x72 (114); rhythm dynamic 0, rhythm soft 1.

Derived commands:

| command | op | payload | response | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `[0]=0|1` | read `0xAA/0x01` | base `SwitchController`; `scenes/BleSwitchCmdBuilderV1.java` |
| heartbeat | `0xAA/0x01` | none | `[0]!=0` (no event) | base `HeartControllerNoEvent`; `BleComm.l()` |
| brightness | `0x33/0x04` | `[0]=0..100` (scaled by `Support.getBrightnessRange()` {1,100,0}) | read `0xAA/0x04` | base `BrightnessController`; `pact/Comm.makeBrightnessController4BleComm` |
| mode | `0x33/0x05` | sub-mode block | read `0xAA/0x05` | `ble/ModeController.java`, `ble/Mode.java` |
| DIY multi | `0xA3/0x56` | multi-packet V1; payload `[0]=diyCode, [1..]=bytes`; first byte 33→11 rewritten | event | `controller/MultipleOperateController.java` |
| DIY multi H6093 | `0xA3/0x58` | multi-packet V1 | event | `controller/MultipleOperateControllerH6093.java` |
| H609D operate | `0x33|0xAA/0x43` | `H609DSubModeOperate` bytes | parse `H609DSubModeOperate` | `controller/H609dOperateModeController.java` |
| auto-off read | `0xAA/0x24` | none | `AutoOffInfo.parse` | `ble/AutoOffNotifyParse.java` |
| child switch notify | `0xEE/0x30` | raw `[0]`=?, `[1]`=switch | event | `ble/DeviceStatusNotifyParse.java` |

Note: `pact/Comm.makeColorController4BleComm(...)` returns **null**; this family does not send a
standalone colour frame over BLE. Colour is applied through scenes/presets/DIY ptReal frames.

### Sub-mode payloads

Scenes (`ble/SubModeScenes.java`, id 0x04):

```
[0]=04 [1]=effectLo [2]=effectHi [3]=musicCodeLo [4]=musicCodeHi
```

`[3..4]` are zero when music is disabled (`c=false`); parse reads effect LE16 and music code LE16.

New DIY (`ble/SubModeNewDiy.java`, id 0x0A): `[0]=0A [1]=diyLo [2]=diyHi [3]=secondLo [4]=secondHi`
(second code is an extra DIY/high-colour code; `IHighColorDiy`).

Operate (`Mode.parseSubMode` id 0x20 → base `SubModeOperate`, id 0x0C → `sub_mode_operate_V2`;
operate types 1/2).

## BLE notifications / readings

| notify cmdType | parser | layout |
|---|---|---|
| 0x11 (17) | `ble/WifiNotifyParse` | `[0]==0` connected |
| 0x20 (32) | `ble/BrightnessNotifyParse` | `[0]` brightness |
| 0x24 (36) | `ble/AutoOffNotifyParse` | `AutoOffInfo.parse(bArr)` |
| 0x30 (48) | `ble/DeviceStatusNotifyParse` | `[0]` seq/type, `[1]==1` child switch |
| 0x31 (49) | base `MusicNotifyParse` (`Support.a` sku H6092) | music info |
| 0x32 (50) | sleep info notify (H6093) | sleep state |
| 0x27 (39) | preview effect | event |

## IoT commands + status/readings schema

`iot/Cmd.java`: `state`, `op`, `online`, `turn`, `brightness`, `status`, `colorwc`, `ptReal`,
`pt`. `Cmd.getCmdReadParseKey(cmd)` = `"op"` when cmd is `ptReal`, otherwise `"state"`.

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0|1}` | `iot/CmdTurn.java` |
| `brightness` | `{"val":0..100}` (scaled via `NumUtil.calculateProgress` when range[2]==1) | `iot/CmdBrightness.java`; `pact/Comm` |
| `colorwc` | `{"color":{red,green,blue},"colorTemInKelvin":int}` | `iot/CmdColorWc.java` |
| `ptReal` | `{"command":["<base64 20-byte frame>"]}` | `iot/CmdPtReal.java` |
| `pt` | raw passthrough | `iot/Cmd.java` |
| `status` | event status; `op` carries device frames | `iot/OpScene*`, `OpDiy*` |

`CmdPtReal` entry points:
- `getDiyOperateCmdPtReal(AbsMultipleControllerV14Diy, int)` – multi DIY frames.
- `getH6093DiyCmdPt(DiySendData)` – H6093 DIY.
- `getNewScenesCmdPtReal(AbsMultipleControllerV14Scenes)` – scene frames.
- `getNewScenesH6093CmdPtReal(scenes, Mode)` – H6093 scene + music-code frame.
- `getDiyCmdPt4DiyGraffiti*`, `getDiyCmdPt4DiyStudio`, `addCommand` (prepend frame).

`IotSwitchCmdBuilderV1` parses `IotMsgV2`, matches transaction and returns true when
`cmd=="status"`.

## Other protocols

- WiFi/cloud: topic from device ext, MQTT through base `Iot` manager. No LAN/Matter code.
- BLE frames reused as `ptReal` base64.

## Dynamic effects / motion / music / scenes / DIY

- **Scene dispatch** (`pact/Comm.makeSceneCmd4IotComm(str, goodsType, device, effectId)`):
  - goodsType 271 → `makeSceneCmd4IotCommH6093` (`SubModeScenes` + `LocalSoundM` music code;
    final frame from `MultiPresetScenesH6093Controller`).
  - goodsType 283/333 → `makeSceneCmd4IotCommH7070` (`MultiPresetScenesH6093Controller`).
  - else → `SubModeScenes` with `ScenesM.p.p(sku, effectId)` music switch/code; then
    `Support.is2NewScenesMode` → `ScenesOp.parseSceneV1(str, scene, {1,2,5,11})` +
    `setMusicCode`/`setMusicSwitch`.
- **Preset scenes** (`pact/MultiPresetScenesController`): takes the scene's `scenesParam`
  base64; strips 3 bytes; `getCommandType()` = 5 normally, 6 when `param[1]==123 (0x7B)`;
  `r()` timeout 100 ms.
- **H6093 preset** (`MultiPresetScenesH6093Controller`): same, command type selected from
  scene param; uses `CommonDiyParseConfig.getSceneControl`.
- **Scene channels** (`Support.supportScenesOpSet`): 271→{5,10}; 283/333/323/322/340/399→{5,0};
  402→{0,5}; default {0,1,2,3,5}.
- **DIY modes**: `DiyModeComposeController(DiySendData, byte)` =
  `DiyControllerNoEventV7(diySendData, protocolCode)` + `ModeControllerNoEvent(SubModeNewDiy(diyCode))`;
  emits `DiyModeControllerEvent(diyCode, success, version)`.
- **Music** (H6091 sub-mode 0x0F; general music notify 0x31): effect ids above; music info
  notifications via base `MusicNotifyParse`. H6092 music scene code is sent inside the scene
  frame bytes [3..4].
- **H609D operate/DIY**: `H609dOperateModeController` (cmdType 0x43) reads/writes
  `H609DSubModeOperate`; used by `newDetail/h609d/diy`.
- **H7071 layered DIY** (`newDetail/h7071/diy/*`): layers (`Layer.java`), effects
  `GuDing4TuAnPian` (fixed image), `XunHuan4TuAnPian` (loop), `SuiJi4TuAnPian` (random),
  `ShuiBoWen` (water ripple); `Pro4H7071Diy` serialises to `H7071DiyParse` bytes.
- **R1810** segment colour (`ColorModeSegmentR1810`), stack/advanced DIY
  (`R1810StackEffectUI`, `R1810AdvanceActionEffectUI`), 3 segments.
- **H1811** flow direction support when pactType==1 and version≥2.
- **H1880** on/off memory (`Support.supportMemory`).

## Source map

- `pact/Support.java`, `SubLib.java`, `SubMaker.java`, `*Maker.java`, `Comm.java`, `DeviceItem.java`,
  `Model.java`, `BleIotExt.java`, `OnlineMusicConfig*.java`, `bleiot/AbsEffectOp4BleIot.java`,
  `bleiot/EffectOp4BleIot.java`
- `ble/Ble*.java`, `BleProtocol.java`, `Mode.java`, `SubModeScenes.java`, `SubModeNewDiy.java`,
  `DiyModeComposeController.java`, notify parsers
- `controller/MultiPresetScenesController.java`, `MultiPresetScenesH6093Controller.java`,
  `MultipleOperateController.java`, `MultipleOperateControllerH6093.java`,
  `H609dOperateModeController.java`, `AutoOffInfo.java`
- `iot/*.java`
- `scenes/*.java`
- `newDetail/h3860`, `h6091`, `h7071`, `r1810`, `h609d` DIY/scene UIs

## Gaps / unknowns

- `Comm.makeColorController4BleComm` / `makeColorStrip*` return null: no standalone BLE colour
  path; colour only via scene/preset/DIY ptReal blobs.
- Preset scene payloads (`scenesParam`) are server blobs; only the 3-byte strip and the
  `0x7B` command-type switch are static.
- `H609DSubModeOperate` field semantics are not decoded (binary sub-mode blob).
- Music code for scenes comes from `LocalSoundM` (server/local sound library) — runtime.
- `Support.getBrightnessRange()` {1,100,0} means no linear rescale for this family.
- `Cmd.getCmdReadParseKey` only special-cases `ptReal`; other reads expect `state`.


---

<!-- split_pact_h6099 -->

# split_pact_h6099 — H605B/H605C/H660x (HDMI sync) + H6098/H6099/H66Ax (TV backlight)

Sources: `decompiled/jadx-splits/split_pact_h6099/sources/com/govee/...`
plus shared lighting code in `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/...`.

Paths relative to `decompiled/`.

## 1. Overview / family and SKUs

The split ships **two pact families**:

1. `com.govee.pact_h605b` — **HDMI sync box / DreamView / AI Gaming** family
   (H605B, H605D, H605C, H6601…H6604, H6608, H8604, H2A40). Adds camera/light
   calibration, HDMI port switching, USB checks, sound-source notify.
2. `com.govee.pact_h6099` — **TV backlight / light-bar** family
   (H6099/H6690, H6098/H8098, H605A, H6097, H66A0, H66A1). Adds a very flexible
   colour op-type model, sleep/wake, timers and white balance.

All SKUs are `AbsBleWifiSku`/`AbsBleIotItem` → **ble + iot**; several also **matter**.

### 1.1 pact_h605b SKUs

| SKU | goodsType | pact protocols | transports | notes |
|---|---|---|---|---|
| H605B | 82 | (1,1) | ble, iot | DreamView T1 Pro; camera calibration |
| H605D | 82 | (1,1) | ble, iot | DreamView T1S Pro; same goodsType |
| H605C | 120 | (1,1),(1,2) | ble, iot | 14 segments; V2 colour; HTTP H605C calibration |
| H6601 | 138 | (1,1) | ble, iot | AI Gaming Sync Box, 3 HDMI ports |
| H6602 | 142 | (1,1),(2,1) | ble, iot | AI Gaming Sync Box, 14 segments |
| H6603 | 192 | (1,1),(2,1),(3,1) | ble, iot, matter | HDMI Sync Box Kit, 4 ports |
| H6604 | 243 | (1,1),(2,1),(3,1) | ble, iot, matter | HDMI Sync Box strip, 4 ports |
| H8604 | 243 | (1,1),(2,1),(3,1) | ble, iot, matter | alias of H6604 |
| H6608 | 172 | (1,1) | ble, iot | 30 segments, vertical TV strip |
| H2A40 | 360 | (1,1) | ble, iot | HDMI 2.1 / newer box |

### 1.2 pact_h6099 SKUs

| SKU | goodsType | pact protocols | transports | notes |
|---|---|---|---|---|
| H6099 | 191 | (1,1),(2,1) | ble, iot, matter | 24 segments at IC 24; TV backlight |
| H6690 | 191 | (1,1),(2,1) | ble, iot, matter | alias of H6099 |
| H6098 | 336 | (1,1) | ble, iot, matter | H8098 alias |
| H8098 | 336 | (1,1) | ble, iot, matter | alias |
| H605A | 203 | (1,1),(2,1),(3,1) | ble, iot, matter | 14 segments |
| H6097 | 253 | (1,1),(2,1) | ble, iot, matter | 24 segments; new 3-image calibration |
| H66A0 | 273 | (1,1),(2,1) | ble, iot, matter | 14 segments |
| H66A1 | 327 | (1,1),(2,1) | ble, iot | 14 segments |

Protocol registration: `pact_h605b/pact/Support.addSupportPact()` and
`pact_h6099/pact/Support.addSupportPact()`.

## 2. Transports & GATT UUIDs

Both families:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

`pact_h605b/ble/BleComm.java` (`V`/`W`) and `pact_h6099/ble/BleComm.java`
(`P`/`Q`). Both use the common notify characteristic for reads.

Matter: H6603/H6604 via `pact_h605b/pact/MatterSupport` (goodsTypes 192, 243);
H6099/H6690/H6098/H605A/H6097/H66A0 via `pact_h6099/pact/MatterSupport`
(goodsTypes 336,191,253,273, plus H6098 aliases).

## 3. BLE frame + command table

20-byte frame `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR`.
Single write `0x33`, read `0xAA`; multi-packet `0xA3`.

| Command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `01/00` | [0] | base `SwitchController`; `ControllerSwitch` |
| brightness | `0x33/0x04` | `0..100` | [0] | base `BrightnessController` |
| mode container | `0x33/0x05` | sub-mode | `0x15` colour, `0x04` scene, `0x0A` DIY, `0x13` music, `0x00` video | `pact_h605b/ble/Mode*.java`, `pact_h6099/ble/Mode.java`, `ModeController*` |
| IC number read | `0xAA/0x40` | — | returns IC count / segment count | `ControllerIcNum` |
| direction | `0x33/0x30` | `dir` | write; read `0xAA/0x30` | `DirectionController` / `LightDirectionController` |
| calibration in/out | `0x33/0x44` | `02 01` into / `02 00` exit | — | `InstallCaliController`, `CalibrationController` |
| swap light position | `0x33/0x34` | — | — | `SwapLightController` |
| start time | `0xAA/0x35` | — | — | `StartTimeController` |
| on/off memory | `0x33/0x41` | `02 <mode>` read `02` | [0]=2, [1]=memory mode | `Controller4OnOffMemory` |
| gradual (fade) | `0x33/0xA3` | `01|00` | fade on/off | `GradualController`, `Gradual4BleWifiController` |
| compose light switch | `0x33/0x36` | `val` | multi-light switch | `ComposeLightSwitchController`, `ComposeLightController` |
| timer | `0x33/0x23` | `group enableType hour min repeat` | read all `23 FF` | `pact_h6099/ble/controller/compose/TimerController.java` |
| sync time | `0x33/0x09` | time bytes | — | `SyncTimeController` |
| soft version | `0x33/0x06` | — | read | `SoftVersionController` |
| DSP/hard version | `0x33/0x07` | — | read | `DspVersionController`, `HardVersionController` |
| sleep/wake | `0x33/0x11` | `enable startBri closeTime curTime` | V2 appends `defaultLight rgbR rgbG rgbB kLo kHi voiceOpen voiceVolume voiceLo voiceHi` | `base2light/ble/controller/SleepController{,V2}.java`, `pact_h6099/pact/Comm.makeSleepController` |
| extension op | `0x33/0xA9` | `subOp …` | generic 0xA9 sub-command namespace (see below) | many controllers |

### 3.1 `0xA9` extended-settings namespace

Corrected and expanded from the shared DreamView/settings controllers. Full detail and
read/parse layouts: `DREAMVIEW-HDMI.md` §1.

| subOp | write payload after `33 A9` | read | meaning | source |
|---|---|---|---|---|
| `00` | `00 03 <auto?0:1> <R> <B>` | `00` | classic white balance | `WhiteBalanceVmInterface` / `VideoModeParamsController` |
| `01` | `01 01 <value>` | `01` | sensitivity | `VideoSensitivityController` |
| `02` | `02 01 <value>` | `02` | whole-RL / video brightness | `WholeRLBrightnessVmInterface` |
| `03` | `03 01 <port>` | `03` | HDMI port select | `Controller4Hdmi` |
| `04` | `04 01 <value>` | `04` | AI action / AI gaming | `AiActionController` |
| `05` | `05 03 <R> <G> <B>` or `05 04 <R> <G> <B> <extra>` | `05` | colour calibration | `ColorCaliController` / `Controller4ColorCalibration` |
| `06` | `06 01 <progress>` | `06` | white balance, infinite progress | `Controller4WhiteBalance` / `VideoModeParamsController` |
| `07` | — | `07` | DSP version (not a setting) | `DspVersionController` |
| `09` | — | `09` | AI update status (read-only) | `AiUpdateStatusController` |
| `0A` | `0A 06 <enable> <mode> <startLo> <startHi> <endLo> <endHi>` | `0A` | device black screen | `compose/BlackScreenController` |
| `0B` | `0B 01 <flag>` | `0B` | black-border removal | `compose/BlackBorderRemoveController1` |
| `0C` | `0C 03 <enable> <durLo> <durHi>` | `0C` | HDMI black screen (15–300 s, default 30) | `balckscreen/hdmi/BlackScreenHdmiController` |
| `0D` | `0D` | `0D` | HDR calibration trigger | `HDRCaliController` |
| `0E` | `0E 01 <value>` | `0E` | saturation | `VideoSaturationController` |
| `0F` | `0F 03 <R> <G> <B>` | `0F` | advanced white balance | `WhiteBalanceVmInterface` |
| `10` | `10 0F <enable> <R> <G> <B> <saturation> <codeLo> <codeHi> <autoCloseLo> <autoCloseHi> <timeLo> <timeHi> <tz0..3>` | `10` | AI filter (fields decoded from `AiFilterStatusBean`) | `AiFilterController` |
| `11` | `11 02 <enable> <level>` | `11` | HDR effect / contrast | `VideoHdrEffectController` |
| `12` | `12` | — | auto white balance (old) | `VideoAutoWbController` |
| `13` | — | `13` | check white-balance calibration | `VideoCheckWbCaliController` |
| `14` | `14` | — | exit white-balance calibration | `VideoAutoWbController` |

Separate command types: sound-effect mic selection `0x33/0xAC <micIndex>`, relative/
segment brightness `0x33/0xAE 01 <4|6> ...`, audio source `0x33/0xB7 <0|1>`.

### 3.2 H605B extra commands

| Command | op | payload | source |
|---|---|---|---|
| check camera | `0xAA/0x32` | — | `CheckCameraController` |
| check light install | `0xAA/0xAA` | — | `CheckLightController` |
| exit checking light install | `0x33/0xAF` | — | `ExitCheckLightController` |
| camera position | `0x33/0x31` | op | `CameraPosController` |
| USB check | `0x33/0x38` | `val` | `UsbCheckController` |
| USB check state | `0x33/0x37` | `val` | `UsbCheckStateController` |
| HDMI box light effect | `0x33/0xB6` | `on effectIdx !dynamic?1:0 speed` | `ControllerBoxEffect` |
| sound-effect mic select | `0x33/0xAC` | `micIndex` | `SoundEffectVmInterface.updatePickMic` |
| relative/segment brightness | `0x33/0xAE` | `01 <4|6> <v0> <v1> <v2> <v3> [<v4> <v5>]` | `RelativeBrightnessController` |
| HDR calibration | `0x33/0xA9` | `0D` read/write | `HDRCaliController` |
| saturation | `0x33/0xA9` | `0E 01 <value>` / read `0E` | `VideoSaturationController` |
| AI filter | `0x33/0xA9` | `10 0F ...` / read `10` | `AiFilterController` |
| audio from | `0x33/0xB7` | `src` | `Controller4AudioFrom` |
| light on/off (compose) | `0x33/0x36` | `val` | `LightOnOffController` |
| multi-music block | `0x33/0x41` | layer block | `MultiMusicController{,V3}` |

## 4. BLE notifications / readings

`pact_h605b/ble/BleNotifyComm.java`:

| proType | parser | reading |
|---|---|---|
| `0x11` | `WifiNotifyParse` | Wi-Fi connected = `[0]==0` |
| `0x50` | `UsbCheckOvertimeParse` | USB check timeout |
| `0x40` | base `DeviceStatusNotifyParse` | first 10 bytes |
| `0x23` | `LightInstallNotifyParse` | `[0]` installed, `[1]` variant |
| `0x25` | `CaliLightParse` | calibration-light overtime |
| `0x30` | `LightAndHdmiNotifyParse` | `[0]=1` light-bar presence bits; `[0]=3` HDMI port + bitfield; `[0]=8` AI model id LE16; `[0]=9` … |
| `0x32` | `SoundSourceNotifyParse` | `[0]==1` → HDMI else DEVICE |
| `0x60` | base `MovieFeastOnOffNotifyParse` | `[0]==1`, `[1]` on/off |

`pact_h6099/ble/BleNotifyComm.java`: `0x11` Wi-Fi, `0x40` device status,
`0x30` light/HDMI, `0x60` movie feast.

## 5. IoT commands + status / readings schema

Both families share the base2light envelope (`Write/AbsCmdWrite`) with variant
`IotMsgProType.V1/V2`; read replies are keyed `state` and `op`.

### pact_h605b `iot/Cmd.java`

`state`, `op`, `online`, `turn`, `color`, `colorTem`, `brightness`, `status`, `pt`,
`snapshot`, `points`, `IoTConnected`, `camera`, `swap`, `ptReal`, `ptIot`,
`colorwc`, `iniUrl`, `iniRoi`.

### pact_h6099 `iot/Cmd.java`

`state`, `op`, `online`, `turn`, `color`, `colorTem`, `brightness`, `status`, `pt`,
`snapshot`, `dewarpsnapshot`, `points`, `IoTConnected`, `camera`, `swap`, `ptReal`,
`ptIot`, `colorwc`.

| cmd | data | notes | source |
|---|---|---|---|
| `turn` | `{"val":0|1}` | power | `CmdTurn.java` |
| `brightness` | `{"val":0..100}` | — | `CmdBrightness.java` |
| `colorwc` | `{"color":{"r","g","b"},"colorTemInKelvin"}` | colour or temp | `CmdColorWc.java` |
| `ptReal` | `{"command":["<base64 20-byte frame>",…]}` | all effects | `CmdPtReal.java` |
| `status` | `{}` | read | `CmdStatus.java` |
| `snapshot` | `{}` | camera calibration image | `ResultSnapShot.java`, `SnapShotIotResult.java` |
| `dewarpsnapshot` | `{}` | de-warped image (H6099 3-image) | `cameraCali3Img/*` |
| `points` | `{"points":[…]}` | calibration points | `CmdCalibrationPoints.java`, `GetViewPointsH66A0.java` |
| `camera` | `{}` | camera on/off | `Cmd.java` |
| `swap` | `{}` | swap light position | `pact_h605b/iot/Cmd.java`, `pact_h6099/iot/Cmd.java`, `SwapLightAc` |
| `iniUrl` / `iniRoi` | string | H605C calibration URL/ROI | `pact_h605b/iot/Cmd.java` |
| `IoTConnected` | `{}` | link state | `Cmd.java` |
| `ptIot` | raw | IoT-channel passthrough | `Cmd.java` |

Status schema:

- `h6099/iot/State.java`: `onOff` (int), `brightness` (int), `wifiSoftVersion`,
  `wifiHardVersion`.
- `h605b` uses `ResultPt`/`ResultSnapShot`/`ResultLeftSnapShot`/`ResultRightSnapShot`
  for `op` payloads.

## 6. Other protocols

- **HTTP calibration** (H605C/H6099 3-image):
  - `POST /bff-app/v1/axin/user-cali` (`pact_h605b/add/net/NetApi.java`)
  - `GET /bff-app/v1/device-guide/configs?sku=` (`add/net/hdmi/HdmiApi.java`)
  - `GET/POST appco/v1/calibration/point` and `POST device/rest/devices/v1/appDeviceTopic`
    (`pact_h6099/add/net/NetApi.java`)
- **Camera pipeline**: `add/ActivityPrepareCamera`, `CheckCameraAc`,
  `CalibrationReadM`, `UpLoadIC`, `UploadPoints*` (not BLE).
- **HDMI resolution list** — `GET /bff-app/v1/device-guide/configs?sku=` →
  `BaseStatusResponse<HdmiResolutionResponse{resolutions:[{resolution,rate}]}>`
  (`add/net/hdmi/HdmiApi.java`, `HdmiResolutionBean/Response`). Server-provided list, no
  BLE command.
- **HDMI port icons** — `GET /bff-app/v1/hdmi-port/icons?sku=&device=` and
  `POST /bff-app/v1/hdmi-port/icons`
  (`com/govee/kt/HdmiIconVM.java`, `com/govee/kt/net/INet.java`):
  `Response4HdmiIconList{hdmiPortIconId, portIcons:[{port,iconId}]}`;
  `Request4UpdateHdmiIconList{hdmiPortIconId, sku, device, portIcons}`.
- **Movie Feast / DreamView group REST** — create/delete
  `/appsku/v1/moment/feasts`; rename `/appsku/v1/moment/feasts/names`; detail/main/sub
  `/bff-app/v1/moment/feasts/{details,main-devices,sub-devices}`; region
  `/appsku/v1/moment/feasts/region`; music/scene feast endpoints; snapshot
  `/bff-app/v1/feast/snapshot/cmd-refactor`. Field-level bodies in `DREAMVIEW-HDMI.md` §4.1.
- **Matter**: see §2.

## 7. Dynamic effects / motion / music / scenes / DIY

### 7.1 pact_h605b colour — sub-mode `0x15` per SKU

`Comm.makeColorController4BleComm(goodsType, rgb)` dispatches:

| goodsType | class | payload |
|---|---|---|
| H605C (120) | `ble/v2/SubModeColorV2` | `15 01 R G B kLo kHi R2 G2 B2 mask2` or `15 02 idx mask2` |
| H6601/H6603 (138/192) | `ble/v3/SubModeColorV3` | `15 01 R G B kLo kHi R2 G2 B2 mask3` or `15 02 idx mask3` |
| H6602/H6604 (142/243) | `ble/v4/Sub4Color` | op-type model: `15 02 bri mask2`, `15 01 R G B kLo kHi 0 0 0 mask2`, `15 00`, `15 03 group bri…`, `15 04 group rgb…` |
| H6608 (172) | `ble/h6608/SubModeColor4H6608` | 24-segment mask (3 bytes), same 17-byte buffer |
| H605B/H2A40 (82/360) | `ble/SubModeColor` | 24-segment mask at [10..12]; `15 01 …` / `15 02 idx …` |

`SubModeColor` flag 1 = colour (optionally temp), flag 2 = colour-index on masked
segments. Mask bytes are LSB-first bitfields. `Sub4Color` op-types:
0=SET_BRIGHTNESS, 1=SET_COLOR, 2=SET_COLOR_TEMP, 3=SET_MODE, 6=BRIGHTNESS_GROUP,
7=COLOR_GROUP.

### 7.2 pact_h6099 colour — sub-mode `0x15` (V1 op-type)

`pact_h6099/ble/v1/SubModeColorV1` mirrors the H6609 model:

| opType | bytes |
|---|---|
| 0 | `15 02 bri mask*` |
| 1 | `15 01 R G B kLo kHi 0 0 0 mask*` |
| 2 | `15 01 FF FF FF kLo kHi R G B mask*` |
| 3 | `15 00` |
| 6 | `15 03 group briSet…` |
| 7 | `15 04 group rgbSet…` |

Other op-type values are app-side selectors and return `null` from `getWriteBytes()`.

Segment count: 24 for H6097 (253), else 14 (`Support.getColorPieceSize`).
Mask uses 2 bytes ≤16 segments, 3 bytes above.

### 7.3 Scenes / DIY

- Scenes: `04 effectLo effectHi` (16-bit LE). Multi-layer scenes are `0xA3`
  blobs (`ScenesOp.parseSceneV1`) with final `04 code`.
- DIY: `0A codeLo codeHi`; `Sub4Diy` (pact_h6099), `SubModeNewDiy` (pact_h605b).
  H605B/H605C/H660x DIY templates and H6099 3-image calibration both feed
  `CmdPtReal.getDiyCmdPt*`.

### 7.4 Music — sub-mode `0x13`

| SKU group | layout |
|---|---|
| pact_h605b base (H605B/H2A40) | 5 bytes `13 code sens ? ?` with per-code flags |
| H605C (`v2/SubModeMusicV2`) | `13 code sens dyn auto R G B` (8 bytes) |
| H6601/H6603 (`v3/SubModeMusicV3`) | 5 bytes with flags for code 64/65 |
| H6602/H6604 (`v4/Sub4Music`) | `13 code sens dyn 00 auto R G B` (9 bytes) |
| H6099 (`v1/SubModeMusicV1`) | `13 code sens` or `13 code sens dyn auto 00 00 R G B` |

Music codes: 64 rhythm, 65 wind/fengche, 66 hooray, 67 sprout, 72 hopping,
80 torch, 82 burst, 83 streaming (`pact_h605b/ble/BleProtocol.java`).
New-music codes 48–55 via `AbsNewMusicEffect`.

### 7.5 Video — sub-mode `0x00` (DreamView)

Container: `0x33/0x05` + sub-mode `0x00`; the payload is built by the family `VideoVm`
via `Controller4ExtBytes({5, 0, ...})`. **Byte order differs by SKU generation** — use
this table rather than the legacy class names alone:

| Family / VM | payload after `05` | bytes |
|---|---|---|
| H6099 (`VideoVm.N`) | `00 <drama> <part 8/9> <vivid> <voiceOn> 02 <voice>` | 7 |
| H66A0 (`VideoVm.O`) | `00 <drama> <part> <vivid> <voiceOn> 02 <voice>` | 7 |
| H6097 / H605A | `00 <drama> <part> <vivid> <voiceOn> 02 <voice>` (H605A: `... <softness> <voice>`) | 7 |
| H2A40 (`VideoVm.N`) | `00 <drama> <part> <vivid> <voiceOn> 02 <voice>` | 7 |
| H605B / H605D (`VideoVm.O`) | `00 <voiceOn> <vivid> <part> <drama> <voice> <softness>` | 7 |
| H605C / default (`VideoVm.P`) | `00 <screenState> <drama> <vivid> <voiceOn> <voice> 00 <seg1> <seg2> <seg3> <seg4> 00` | 12 |

Legacy parsers still present: `SubModeVideo` (`00 dramaFlag vividness effect voiceOpen
voice`), `SubModeVideoV1` (H6099), `SubModeVideoV2`, `SubModeVideoV3`,
`SubModeVideoH605CV1`; they parse the same bytes in family-specific order.
`screenState/part`: 0=part, 1=all, 2=full-screen; `drama`: 0=movie, 1=game; `vivid`
1..100; `voiceOn` 0/1; `voice`/`softness`/`rlBrightness` 0..100. Full field table:
`DREAMVIEW-HDMI.md` §2.

### 7.6 Calibration / direction

`0x44` enters/exits light calibration; `0x30` sets light direction; `0x42`/`0x31`
set camera/light points; `0x40` reads IC/segment count. These drive the
camera-based screen-zone mapping, not colour effects.

## 8. Source map (traced)

- pact_h605b: `pact/{Support,SubLib,SubMaker,Comm}.java`, `ble/{BleProtocol,Mode,ModeController,Mode4ColorStrip,SubMode*}.java`,
  `ble/{v2,v3,v4,h6608}/*`, `ble/controller/**`, `ble/controller/compose/**`,
  `iot/{Cmd,CmdPtReal,CmdColorWc,CmdTurn,CmdBrightness}.java`,
  `add/net/NetApi.java`, `add/net/hdmi/HdmiApi.java`.
- pact_h6099: `pact/{Support,SubLib,SubMaker,Comm}.java`,
  `ble/{BleProtocol,Mode,ModeController}.java`, `ble/v1/*`,
  `ble/controller/**`, `ble/controller/compose/**`,
  `iot/{Cmd,CmdStatus,CmdPtReal,CmdColorWc,State}.java`,
  `add/net/NetApi.java`, `add/cameraCali3Img/**`.
- Shared framing: `base2light/ble/comm/MultipleControllerCommV1.java`,
  `base2light/ble/controller/{SleepController,SleepControllerV2}.java`.

## 9. Gaps / unknowns

- HDMI port semantics and H2A40 black-screen/border bytes are in UI/Compose code;
  `0xA9` sub-op values were read from constructors.
- `SubModeVideo*` parameter meanings (vividness/voice/softness) are UI sliders.
- `CameraPosController` / `InstallCaliController` payloads depend on the
  camera/point coordinate model (not a fixed byte layout in Java).
- Scene/DIY ids and layer blobs are cloud assets; only `04/0A <LE16>` containers
  and `0xA3` framing are static.
- H8604 shares goodsType 243 with H6604; H8098 shares 336 with H6098.
- The two families have separate `Cmd.java` files but identical envelope and
  read-key mapping.


---

<!-- split_pact_h60ax -->

# split_pact_h60ax — H60A0/H60A1/H60A4/H60A6/H60C1, H12xx, H1141 ceiling/wall lights

Source root: `decompiled/jadx-splits/split_pact_h60ax/sources/com/govee/pact_h60a0/` (the package
keeps the historical name `pact_h60a0` even though module `pact_h60ax`).

FSixteen goodsTypes share the H60AX BLE profile: a 20-byte frame, a `0x15` colour sub-mode for
most SKUs (H60A6 uses `0x0D`), the same music/scene/DIY sub-modes, and an extensive segment /
graffiti / DIY-new engine. Some SKUs are ceiling lights, some are segmented wall lights and some
are bulb strings.

| goodsType | SKU(s) | product | colour sub | colour size | colour-temp | scenes |
|---|---|---|---|---|---|---|
| 188 | H60A0 | Ceiling light | `0x15` | 13/14 | 2200–6500 K | `{0,1,2,3}` |
| 235 | H60A1, H80A1 | Ceiling light | `0x15` | 14 | 2200–6500 K | `{0,1,2,3}` |
| 302 | H60A4, H80A4 | Ceiling light | `0x15` | 11 | 2700–6500 K | `{0,1,2,3}` |
| 303 | H60A6 | Ceiling light / matrix | `0x0D` | 13 | 2700–6500 K | `{0,1,2,3,5}` |
| 324 | H60C1 | Ceiling light | `0x15` | 3 | 2700–6500 K | `{0,1,2,3,5}` |
| 346 | H1270 | Ceiling light / matrix | `0x15` | 13 | 2700–6500 K | `{0,5}` |
| 356 | H1232 | Ceiling light | `0x15` | 4 | 2700–6500 K | `{0,1,2,3,5}` |
| 370 | H1250 | Ceiling light | `0x15` | runtime | 2200–6500 K | `{0,1,2,3,5}` |
| 373 | H1252 | Ceiling light | `0x15` | 17 | 2200–6500 K | `{0,1,5}` |
| 390 | H12D0 | Ceiling light | `0x15` | runtime | 2200–6500 K | `{0,5}` |
| 410 | H1141 | Ceiling light | `0x15` | 8 | 1000–10000 K | `{0,1,2,3,5,6}` |

Registration (`pact/Support.addSupportPact`): 188 `(1,1)`; 235 `(1,1),(2,1),(2,2)`;
302 `(1,1),(1,2)`; 303 `(1,1)..(1,4)`; 324 `(1,1),(2,1),(2,2)`; 346 `(1,1),(1,2),(1,3)`;
356 `(1,1),(1,2)`; 370 `(1,1),(1,2)`; 373 `(1,1),(1,2)`; 390 `(1,1),(1,2)`; 410 `(1,1)`.
`SubMaker` emits all eleven Item makers.

---

## 1. Transports & GATT UUIDs

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

`ble/Ble.java` is a standard `AbsBle` exposing `BleComm`, `BleMultiComm`, `BleMtu` and a
`BleNotifyComm`. The split also has a "compose" controller set (`ble/controller/compose/*`) that
builds multi-frame colour/timer payloads, and an `IControllerNoEventToAbsSingleController`
adapter so compose controllers can be sent as normal 20-byte frames or `ptReal`.

BLE frame: 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC`.
Large DIY/segment bodies use `Compose4DefWrite` / `Compose4DefWrite4Multi` (multi 20-byte
frames) and `MultipleControllerCommV1`.

---

## 2. BLE frame + command table

`BleProtocol` (`ble/BleProtocol.java`): sub colour `0x15`, H60A6 colour `0x0D`, music `0x13`,
scenes `0x04`, DIY `0x0A`, graffiti `0xEF` (`sub_graffiti_h12d0=-17`), child switch `0x36`.

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | `compose/ControllerSwitch` |
| brightness | `0x33/0x04` | `[0] 1..100` | `compose/BrightnessControllerNoEvent` |
| colour / mode | `0x33/0x05` | sub `0x15` (or `0x0D` H60A6), 17-byte op layout below | `ble/v1/SubModeColorV1.java`, `ble/ModeV1.java` |
| music | `0x33/0x05` | sub `0x13` | `ble/v1/SubModeMusicV1.java` |
| scenes | `0x33/0x05` | sub `0x04` effect LE16 | `ble/v1/SubModeScenesV1.java` |
| DIY | `0x33/0x05` | sub `0x0A` code LE16 | `ble/Sub4Diy.java` |
| graffiti | `0x33/0xEF` | H12D0 cell-graffiti multi frames | `BleProtocol.sub_graffiti_h12d0`; `adjust/h12d0/diy/*` |
| child / secondary switch | `0x33/0x36` | `[0..2]` bools | `ble/controller/ControllerChildSwitch.java`; `BleProtocol.value_sub_switch=54` |
| on/off memory | `0x33/0x41` | `[0] 0/1` | `ble/controller/Controller4OnOffMemory.java` |
| IC number | `0xAA/0x40` | empty | `compose/ControllerIcNum` |
| other info | `0xAA/0x07` | `p()={8}` | `compose/ControllerOtherInfo` |
| hard / DSP version | `0xAA/0x07` | sub-command | `compose/HardVersionController`, `DspVersionController` |
| soft version | `0xAA/0x06` | empty | `compose/SoftVersionController` |
| sync time | `0x33/0x09` | 7-byte time | `compose/SyncTimeController` |
| timer | `0xAA/0x23` | timer-all-info read | `compose/TimerController` |
| gradual change | `0x33/0xA3` | `[0] 0/1` | `compose/GradualController` |
| colour/brightness read | `0xAA/0xA5` | `p()={index}` | `compose/ColorBrightnessController` |

### Colour op layout (`SubModeColorV1.getWriteBytes`)

`SubModeColorV1` uses an `opType` (constants `OP_TYPE_*`):

| opType | payload |
|---|---|
| 0 set brightness | `15 02 <brightness> <mask...>` |
| 1 set colour | `15 01 R G B <mask...>` |
| 2 set colour temp | `15 05 <kelvinLo> <kelvinHi>` |
| 3 set mode | `15 00` |
| 6 brightness group | `15 03 <group> <14 brightness bytes>` |
| 7 colour group | `15 04 <group> <4×RGB>` |
| 11 colour-temp H60A1 | `15 01 R G B kelLo kelHi tempR G B <mask...>` |
| 12 colour H60A1 | `15 01 R G B 00 00 00 00 00 <mask...>` |
| 8 all colour / 9 wc RGB / 10 wc kelvin | encoded by the base mode writer (same 0x15 family) |

Mask length depends on segment count: `≤16` → 2 bytes, `>16` → `BleUtils.X(checkSet, true)`
(4+ bytes; 40 segments max in the V1 builder). H60A6 uses `0x0D` and the H60A6 colour UI;
the concrete body is built by the base colour op writer (see gaps).

### Music (`SubModeMusicV1`)

```
default: 13 05 64  (musicCode 5, sensitivity 100)
```
`parse`: `[0] code`, `[1] sensitivity`; new-code sets are detected with
`Support.isNewMusicCode` (base RGBIC/RGB lists). H60A6/H1270 custom music uses
`H1270MusicProxy`/`CustomMusicApi` and writes composed multi frames.

### Scenes (`SubModeScenesV1`)

`04 epLo epHi` (16-bit LE). Scene op sets per goodsType as in the table.

### DIY (`Sub4Diy`)

`0A diyLo diyHi` plus `protocolCode`/`diyValueKey` metadata. A DIY body is sent as multi-frame
`Compose4DefWrite4Multi` then the final `0A <code>` mode frame.

---

## 3. BLE notifications / readings

`ble/BleNotifyComm` registers:

| reading | op | layout | source |
|---|---|---|---|
| brightness | `0x20` | `[0]` | `ble/BrightnessParse.java` |
| light child status | `0x30` | `[0]==1`, `[1] child1`, `[2] child2`, `[3] child3` | `ble/LightChildStatusNotifyParse.java` |
| wifi | `0x11` | `[0]==0` connected | `ble/WifiNotifyParse.java` |
| device status | `0x30` | base `DeviceStatusNotifyParse` | `ble/BleNotifyComm` |
| heart | `0x01` | base `HeartController` | `ble/BleComm` |
| IC/segment | `0x21` | base `CheckIcNumParse` | base |
| colour/brightness | `0xAA/0xA5` | index + per-segment RGB/brightness | `compose/ColorBrightnessController`, `compose/ParserMultiColorStrip` |
| timer all-info | `0xAA/0x23` | `ParserTimers`/`Result4TimerAllInfo` | `compose/TimerController` |
| gradual | `0xAA/0xA3` | `[0]` mode | `compose/ParserGradual` |
| versions | `0xAA/0x07`/`0x06` | `ParserVersion` | `compose/ParserVersion` |

`ParserMultiColorStrip` reads `[3]` group type and `[4..5]` LE16 index/count; `ParserIntBy2Bytes`
decodes little-endian pairs. Timer records are parsed by `ParserTimers` into `Result4TimerAllInfo`.

---

## 4. IoT commands + status/readings schema

Envelope **`IotMsgV2`**.

`iot/Cmd.java`: `state`, `op`, `online`, `turn`, `color`, `brightness`, `status`, `ptReal`,
`colorwc`.

| cmd | data | response | source |
|---|---|---|---|
| `turn` | `{"val":0\|1}` | `state` | `iot/CmdTurn.java` |
| `brightness` | `{"val":1..100}` | `state` | `iot/CmdBrightness.java` |
| `colorwc` | `{"color":{r,g,b},"colorTemInKelvin":int}` | `state` | `iot/CmdColorWc.java` |
| `ptReal` | `{"command":["<base64 20-byte>",...]}` | `op.pt[]` | `iot/CmdPtReal.java` |

`CmdPtReal` helpers: `getDiyCmdPt(DiyProtocol)`, `getDiyCmdPt4DiyGraffiti1(DiySendData)`,
`getDiyCmdPt4DiyGraffitiV2(DiyGraffitiV2)` (capped at 19), `getDiyTemplateCmdPt`,
`getNewScenesCmdPtReal`, `makeCmdPt`, `makeCmdPtReal`, `makeCmdPtReal4Op`,
`makeCmdPtReal4Op4Multi`. `getOpCommandByte`/`getOpCommandBytes` expose the last frame for
status reconciliation.

`Op*CommDialog4BleIot` / `Square` variants choose BLE+MQTT when available, else `ptReal`.
Status uses the base `state/op` schema; `op.pt[]` frames are decoded by the family mode/colour
parsers.

---

## 5. Other protocols

- **WiFi/LAN** — `Support.setDynamicApi()` registers H60A0/H60A1/H60A4/H60A6/H60C1/H1270/H1232/
  H1250/H1252/H12D0/H1141 dynamic domains. MQTT capability is base `DeviceCommCapability`.
- **HTTP / custom music** — `adjust/h1270/music/CustomMusicApi` (music effect get/save,
  `saveDefaultMusicEffect`), `CustomMusicRoomApi`, `MusicHelper`.
- **Cell graffiti / image import** — H1270/H1250/H12D0/H1141 cell-graffiti layers
  (`H1270CellGraffitiParse`, `H12D0GraffitiParse`, `H1141GraffitiParse`), with layer thumbnails
  and AI material import.
- **OTA** — base OTA; `Support.supportAiOta` enables AI OTA for all except H60A0.
- **No Matter/MQTT-specific code** in this split.

---

## 6. Dynamic effects / music / scenes / DIY

### Colour (sub `0x15`, H60A6 `0x0D`)

`SubModeColorV1` op types 0/1/2/3/6/7/8/9/10/11/12 as in §2. `makeColorStripControllers` splits
a colour layout into 4-colour groups (13/14/17/24/40 segments) plus 14-bulb brightness groups and
an optional gradual frame. H60A6 uses a 13-pixel matrix; H1270 13; H1250 dynamic from
`ColorPieceConfig`; H12D0 dynamic; H1141 8.

### Music (`0x13`)

Default `13 05 64`. New multi-music codes are base RGBIC/RGB lists; H1270 adds custom music
profiles via `H1270MusicProxy`, `NewAcCustomMusicEffect`, `EditMusicBean`/`EffectName`.
H60C1/H60A6 have their own `MusicMode` UIs but the wire form is the standard 0x13 code/sens.

### Scenes (`0x04`)

`04 epLo epHi`. Op sets: H60A0/H60A1/H60A4 `{0,1,2,3}`, H60A6/H60C1/H1232/H1250
`{0,1,2,3,5}`, H1270/H12D0 `{0,5}`, H1252 `{0,1,5}`, H1141 `{0,1,2,3,5,6}`.

### DIY / graffiti effect codes

| SKU group | basic effect | graffiti/advanced | protocol | source |
|---|---|---|---|---|
| H60A0/H60A1 | DIY-new (base) | graffiti | base | `adjust/h60a0/DiyConfigH60A0` |
| H60A4 | `784` (H60A4DiyParse.e), `851`, share code `80` | base graffiti | `0x58` | `adjust/h60a4/diy/H60A4DiyParse.java`, `H60A4DiyEffect` |
| H60A6 | `797`, `798` (+ base `[28,29,30]`) | cell graffiti | `0x58` | `adjust/h60a6/diy/H60A6DiyConfig.java`, `H60A6DiyParse` |
| H60C1 | `878`, `789` | — | base | `adjust/h60c1/diy/DiyNewConfigH60C1.java` |
| H1270 | `897`, `898`, `983` | cell graffiti `82` | `0x58` | `adjust/h1270/diy/H1270DiyConfig.java` |
| H1250 | `915`, `916`, `982` | cell graffiti | `0x58` | `adjust/h1250/diy/H1250DiyConfig.java` |
| H1252 | `902`, `981`, `941` | graffiti `902` basic | `0x58` | `adjust/h1252/H1252DiyConfig.java` |
| H12D0 | `944`, `961` | graffiti `0xEF` | `0x58` | `adjust/h12d0/diy/H12D0DiyConfig.java` |
| H1141 | `976`, `977` | graffiti protocol `0x03` | `0x58` | `adjust/h1141/diy/H1141DiyProtocol.java` |

H1250 sub-effects: `CaiHong4Sub`, `DanRuDanChu4Sub`, `HuXi4Sub`, `LiuShui4Sub`,
`PaoMaDeng4Sub`, `MianZhuangLiuDong`, `SeWen`, `ShanShuo4Sub`, `ShouSuoKuoSan`,
`SuiJiHuXi`, `SuiJiJianBian`, `SuiJiLiuDong`, `XianXingLiuDong`, `XuanZhuan`.
H1252: `H1252DiyBasicEffect` code `902`, graffiti `H1252DiyConfig.d=941`, `b=902`, `c=981`.
H1270 sub-effects: `HuXi`, `HuoYan`, `JianBian`, `LianYi`, `LiuDong`, `SeWen`,
`ShuangLuoXuan`, `TanChiShe`, `TanTiaoQiu`, `XiangSu1/2`, `YanHua`, `YueDong`, `YunRan`.
H12D0: `CaiQiang4ZhuLight`, `CeLightPro`, `ZhuLightPro`, `HuXi4CeLight/HuXi4ZhuLight`,
`JianBianFenDuan/QuanDuan4ZhuLight`, `LiuDong4CeLight`, `LiuDongMianZhuang4ZhuLight`,
`LiuDongXianXing4ZhuLight`, `SeWen4CeLight/4ZhuLight`, `ShenSuo4ZhuLight`, `YunRan4ZhuLight`.
H1141: `H1141DiyEffect/ZoneEffect/AdvancedEffect`, graffiti `H1141GraffitiEffect`.

### H12D0 graffiti

Sub-mode `0xEF`; `H12D0GraffitiParse`/`H12D0GraffitiEffect` send layered cell-graffiti frames,
with `CloseOp` and per-layer picture thumbnails. H60A6/H1270/H1250/H1141 use the analogous
cell-graffiti UI (`ColorGraffitiFragment`, `EditCellGraffitiAcH1270`).

---

## 7. Source map (traced)

- Registration/SKUs: `pact/{Support,SubLib,SubMaker,Register4Item,Model,H*Item}.java`
- Transport: `ble/{Ble,BleComm,BleMtu,BleMultiComm,BleNotifyComm,BleProtocol}.java`
- Mode/sub-modes: `ble/{Mode,ModeController}.java`, `ble/Sub4Diy.java`,
  `ble/v1/{ModeV1,SubModeColorV1,SubModeMusicV1,SubModeScenesV1}.java`
- Compose controllers: `ble/controller/compose/*` (switch, brightness, colour, IC, version,
  timer, gradual, multi-colour parser)
- Notifications: `ble/{BrightnessParse,LightChildStatusNotifyParse,WifiNotifyParse}.java`
- IoT: `iot/{Cmd,CmdTurn,CmdBrightness,CmdColorWc,CmdStatus,CmdPtReal}.java`
- Per-SKU UI/DIY: `adjust/h60a0/*`, `h60a1/*`, `h60a4/*`, `h60a6/*`, `h60c1/*`, `h1250/*`,
  `h1252/*`, `h1270/*` (incl. `music/*`, `graffiti/*`), `h12d0/*`, `h1141/*`
- Shared UI: `adjust/ui/*`, `adjust/v1/*`

## 8. Gaps / unknowns

- H60A6 colour sub-mode `0x0D` is declared but not built by `SubModeColorV1`; its concrete body
  is produced by the H60A6 colour UI/op writer. The sub-mode byte is certain, the byte layout is
  not fully recoverable statically.
- H1250/H12D0 colour piece counts are runtime (`ColorPieceConfig` via `DefInfo`), not constants.
- DIY effect lists for H60A0/H60A1/H60C1/H1232/H1252/H1270/H1250/H12D0/H1141 are largely
  DIY-new config / server driven; the explicit integers above are the ones present as constants.
- H1141 graffiti protocol is `0x03` while its normal DIY protocol is `0x58`.
- Custom music (H1270) is cloud-backed (`CustomMusicApi`), so effect codes/room presets are
  runtime.
- `Compose4DefWrite` multi-frame sequencing is in the base library; this split passes controller
  lists.


---

<!-- split_pact_h61d3 -->

# split_pact_h61d3 — neon rope / wall-lining / light-recognition family

Source root: `decompiled/jadx-splits/split_pact_h61d3/sources/com/govee/h61d3/`.

This split is the **neon rope / wall-lining / addressable light-recognition** family. Its defining
features are camera/video recognition to infer the physical shape of the rope, point-list import,
IC/segment mapping, and per-segment animations. It shares the standard 20-byte BLE frame and
`0x15` colour sub-mode with the other RGBIC light splits.

| goodsType | SKU(s) | product | colour size | scenes |
|---|---|---|---|---|
| 202 | H61D3, H61D2, H61D4, H61D5, H61D6 | Neon rope light | dynamic / `H1AB1AbsDiyPro` | `{0,1,2,3,5}` |
| 239 | H61E5 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 246 | H61E6 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 242 | H6640 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 247 | H6641 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 264 | H61B0, H61B3, H61B6 | Neon rope / wall lining | dynamic | `{0,1,2,3}` |
| 261 | H61F6, H61F2, H61F5 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 367 | H1A43, H1A44 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 375 | H1A45 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 384 | H1B6A | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 387 | H1AB1 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 388 | H1AB2 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 389 | H1AB3 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 400 | H1A42 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 403 | H1AA2 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 404 | H1AA5 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 263 | H703A, H703B | Neon rope / wall lining | dynamic | `{0,1,2,3}` |
| 299 | H61B8, H61B9 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |

Registration (`H61D3Support.a()`): each goodsType gets `(1,1)` plus `(2,1)` for most; 261 also
`(2,2),(3,1),(4,1)`; 299 `(2,2)`; 367 `(1,2),(1,3)`; 375/387/388/389/400/403/404 `(1,2)` where
noted. `pact/SubMaker` emits all 19 item makers (H61D3 appears twice). `H61D3Constants` holds the
SKU constants (`H61D2..D6`, `H61E5/E6`, `H6640/41`, `H61B0/B3/B6`, `H61F6/F2/F5`, `H61B8/B9`,
`H1B6A`, `H1A42..45`, `H1AB1..3`, `H1AA2/5`, `H703A/B`).

---

## 1. Transports & GATT UUIDs

- service `00010203-0405-0607-0809-0A0B0C0D1910` (uppercase in source, same UUID)
- characteristic `00010203-0405-0607-0809-0A0B0C0D2B11`

Sources: `ble/BleComm.java` (`Q`/`V`, `Controller4Heart` for heart), `ble/BleMultiComm.java`
(re-creates UUIDs per call). `Ble` is a standard `AbsBle` with `CommEventGattCallback`.
Notify list: `WifiNotifyParse` (0x11), `TakePhotoNotifyParse` (0x26), `DeviceStatusNotifyParse`
(0x30), `DeviceInfoNotifyParse` (0x30), `VideoRecognitionNotifyParse` (0xED).

BLE frame: 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC`. Multi-frame writes
(`0xA3`, `0x5C`-style) via `MultipleControllerCommV1`/`Compose4DefWrite` for recognition/DIY.

---

## 2. BLE frame + command table

`ble/BleProtocol.java`:

| constant | value | meaning |
|---|---|---|
| `b` / `c` | -79 / -78 (`0xB1`/`0xB2`) | secret key read/write |
| `d` | 5 / `0x05` | mode container |
| `e` | 21 / `0x15` | colour |
| `f` | 19 / `0x13` | music |
| `g` | 4 / `0x04` | scenes |
| `h` | 10 / `0x0A` | new DIY |
| `i` | -93 / `0xA3` | gradual / multi write |
| `j` | -91 / `0xA5` | colour/brightness read |
| `k` | 36 / `0x24` | take photo / read IC point |
| `l` | 38 / `0x26` | take photo / exit |
| `m` | -19 / `0xED` | video/photo recognition |
| `n` | 32 / `0x20` | WiFi hard version request? |
| `o` | -94 / `0xA2` | (reserved) |
| mutable `p` | `H1AB1AbsDiyPro.i` = 34 | DIY protocol code |
| mutable `q` | 66 / `0x42` | check IC? |
| mutable `r` | 64 / `0x40` | read IC |
| mutable `s` | 70 / `0x46` | check IC (notify) |
| mutable `t` | 67 / `0x43` | check IC (write) |

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] 1..100` | base `BrightnessController` |
| colour / mode | `0x33/0x05` | sub `0x15` 17-byte layout below | `adjust/color/SubModeColor.java`, `ble/ModeController` |
| music | `0x33/0x05` | sub `0x13` | `adjust/music/SubModeMusic.java` |
| scenes | `0x33/0x05` | sub `0x04` + direction/segment extras | `adjust/scene/SubModeScenes.java` |
| DIY | `0x33/0x05` | sub `0x0A` code LE16 | `adjust/diy/SubModeNewDiy.java` |
| check IC | `0x33/0x46` | payload per `CheckIcController.q()` | `ble/controller/CheckIcController.java` |
| read IC | `0xAA/0x40` | range/index | `ble/controller/ReadIcController.java` |
| read IC point | `0xAA/0x24` | point request | `ble/controller/ReadIcPointController.java` |
| secret key read | `0xAA/0xB1` | empty | `ble/controller/SecretController.java` |
| secret key write | `0x33/0xB2` | 8-byte base64-decoded key | same |
| SN read | `0xAA/0x07` | `{2}` | `ble/controller/SnController.java` |
| soft/hard version | `0xAA/0x07` | sub-command | `ble/controller/SoftHardController.java` |
| take photo | `0x33/0x26` | `01 64 FF FF 00` (on) / `00` (off) | `ble/controller/TakePhotoController.java` |
| video recognition | `0x33/0xED` | `{1}` stop / `{0, lo, hi}` start with duration LE16 | `ble/controller/VideoRecognitionController.java` |
| light recognition multi | `0xA3` multi | `[index][RGB][countLE16][r][g][b][on][n][RGB x n]` | `ble/controller/LightRecognitionMultiController.java` |
| WiFi MAC | `0xAA/0x14` | empty | `ble/controller/WifiMacController.java` |
| WiFi soft | `0xAA/0x21` | empty | `ble/controller/WifiSoftController.java` |
| WiFi hard | `0xAA/0x20` | empty | `ble/controller/WifiHardController.java` |
| multi / compose | multi | `MultiController` with caller command type | `ble/controller/MultiController.java` |

### Colour payload (`adjust/color/SubModeColor.getWriteBytes`, 17 bytes)

```
[0]=0x15
mode 1 (RGB): [1]=1 [2..4]=R G B [5..6]=Kelvin LE16 [7..9]=temp RGB [10..13]=32-bit segment mask
mode 2 (brightness): [1]=2 [2]=brightness [3..6]=32-bit segment mask
```
Parse: `[0]` type, `[1..2]` Kelvin LE16.

### Scenes payload (`adjust/scene/SubModeScenes.getWriteBytes`)

```
04 <effectLo> <effectHi> <dir1> <dir2> [<colorCount> <r0><g0><b0> ...]
```
`dir1/dir2` come from `SubEffect4LiuDong.Companion.b((byte) direction)`; optional per-segment
colours follow. Parse: effect LE16 from `[1][0]`, direction from `[2],[3]`.

### Music payload (`adjust/music/SubModeMusic.getWriteBytes`)

```
default: 13 <code> <sens>
code 3:  13 03 <sens> <dynamicFlag> <autoFlag> [R G B]  (8 bytes)
```
Sensitivity 0..99. Music codes default to code 3 (the UI's "3" effect) with auto colour.

### DIY / recognition

- `0A <diyLo> <diyHi>` for DIY.
- H61DX advanced protocol `0x58`, graffiti protocol `0x03`.
- H1AB1 protocol `0x22` (`H1AB1AbsDiyPro.i = 34`), share code `0x00` effects.
- `LightRecognitionMultiController` uses `MultipleControllerCommV1.makeSendBytesV1(0xA3, 0x5D, data)`
  (default sub-type `93`; override available) and body
  `[index][R G B][u16][b1][b2][b3][on][n][RGB×n]`.

---

## 3. BLE notifications / readings

| reading | op | layout | source |
|---|---|---|---|
| WiFi connect | `0x11` | `[0]==0` connected | `ble/WifiNotifyParse.java` |
| light status | `0x30` | `[0]==1`, `[1]` bit1 = on | `ble/DeviceInfoNotifyParse.java` |
| device status | `0x30` | base `DeviceStatusNotifyParse` | `ble/BleNotifyComm` |
| take-photo exit | `0x26` | event (button pressed) | `ble/TakePhotoNotifyParse.java` |
| video recognition state | `0xED` | `[0]` state code; second arg = mode (1) | `ble/VideoRecognitionNotifyParse.java` |
| IC / segment | `0x46` | `CheckIcController` result | `ble/controller/CheckIcController` |
| read IC | `0x40` | IC count from bytes | `ble/controller/ReadIcController` |
| read IC point | `0x24` | `[0]==1` point present | `ble/controller/ReadIcPointController` |
| secret key | `0xB1` | `[0]==1` + 8-byte key (base64 in app) | `SecretController` |
| SN | `0x07` | `[0]==2` + 8-byte address | `SnController` |
| soft/hard | `0x07` | ASCII / bytes | `SoftHardController` |
| WiFi MAC/soft/hard | `0x14`/`0x21`/`0x20` | ASCII/bytes | `Wifi*Controller` |

Recognition points are `[x LE16][y LE16]` pairs; `H61D3Support.f(pointList)` serialises
`count LE16` + `x,y` pairs for upload. Point lists are stored/imported through
`network/ApiService` (`/device/.../points`, `RecognitionPointInfo{sku,device,points}`).
`VideoRecognitionResult`/`VideoRecognitionStateEvent` carry recognition status.

---

## 4. IoT commands + status/readings schema

Envelope **`IotMsgV2`**. `iot/CmdPtReal` is the only per-family IoT class (base turn/brightness/
colorwc are used by the `Op*CommDialog` classes). `CmdPtReal`:

```json
{"cmd":"ptReal","data":{"command":["<base64 20-byte>", ...]}}
```
Constructors accept a single `AbsController`, a list of byte arrays, or an array of controllers.
`makeCmdPtReals(List<byte[]>)` adds all. Status uses base `state/op`; `op.pt[]` frames are decoded
by the colour/scene/music parsers. Recognition/point state is cloud-side (`network/entity/*`).

---

## 5. Other protocols

- **Camera / image recognition** — `adjust/recognition/CameraActivity`,
  `ImageRecognitionActivity`, `VideoRecognitionActivity/V2`, `adjust/viewmodel/VideoRecognitionViewModel`,
  `adjust/recognition/native/H61DXNativeLib` (shape recognition).
- **Point list import/export** — `network/ApiService` (+ `ApiServiceKt`), `PointListInfo`,
  `RecognitionPointInfo`; points serialised as `count LE16 + (x,y) LE16 pairs`.
- **Neon install / shape recommendation** — `adjust/install/*` (NeonShapeInstallActivity,
  RecommendShapeDetailActivity, NeonSceneShapeDetailActivity), `H703ACutCaliActivity`.
- **HTTP** — bind/install-guide video (`InstallGuideVideo`), device ext/bind info, version check.
- **BLE add flow** — `add/BleBroadcastProcessor`, `PairActivity`/`PairViewModel`.
- **No Matter/MQTT/LAN/IR/RF** in this split.

---

## 6. Dynamic effects / motion / music / scenes / DIY

### Colour (`0x15`)

17-byte `15 01/02 ...` with a up-to-32-segment mask; colour size is runtime IC-derived
(`H61D3Support.getBulbStringMaxNum` always returns 14 for the bulb-string helper, but the device
reports its real IC/segment count over `0x46`/`0x40`). Supports per-segment brightness and
per-segment colour via the same mask.

### Music (`0x13`)

`13 <code> <sens>`; code 3 uses the extended 8-byte form with dynamic/auto flags + RGB.
Sensitivity 0..99. Codes are base `IMusicEffectStatic` IDs; H61D3 adds nothing family-specific.

### Scenes (`0x04`)

`04 <effect LE16> <dir1> <dir2> [count colors...]`. Direction pair comes from
`SubEffect4LiuDong` (flow direction). Scene op set `{0,1,2,3,5}` (or `{0,1,2,3}` for some goods
types); scene capabilities are version-gated (`checkShareEffectVersion`).

### DIY (`0x0A`)

- H61DX: basic effect codes `691` (basic) and `625` (graffiti); protocol `0x58` advanced,
  `0x03` graffiti. Advanced sub-effects: `Duiji`, `Jihe`, `Liudong`, `Suiji`, `Xianxing`
  (`AbsNewDiySubEffect`), with direction (`up/down/left/right`), speed, colour and layer params.
- H1AB1: protocol `0x22`, share code `0x00`, RGBIC graffiti share `0x08`; basic effect triples
  `[0,0,1]`, `[0,1,2]`, `[0,2,3]`, `[1,0,4]`, `[1,2,6]`, `[2,0,7]`, `[2,2,9]`, `[3,3,10]`,
  `[3,4,11]`, `[3,5,12]`, `[8,9,19]`, `[8,10,20]` … with speed range 1..100 (default 50) and
  colour indices `[1,8]`.
- H1A42/H1AB1/H1B6A/H61F6/H6640/H703A configs (`adjustNew/diy/*DiyConfig`) register the DIY-new
  managers for their goods types; H61DX is the only one with explicit 691/625 constants.
- Graffiti: H61DX `H61DXGraffitiParse` (protocol `0x03`) layers; H1AB1 `RgbIcGraffitiShare0x08`.

### Recognition

`LightRecognitionMultiController` writes the inferred point/colour list as a multi-frame `0xA3`
body; the camera/photo/video controllers start/stop recognition (`0x26`, `0xED`), and the
recognition result arrives as notify `0xED`. Point lists are also uploaded to the cloud and
replayed as normal colour/DIY frames.

---

## 7. Source map (traced)

- Registration/SKUs: `pact/{H61D3Support,SubLib,SubMaker,RegisterItem,Model,H*BleIotSkuItem}.java`,
  `H61D3Constants.java`
- Transport: `ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol}.java`
- Mode/sub-modes: `ble/{Mode,ModeController,Mode4ColorStrip}.java`,
  `adjust/color/SubModeColor.java`, `adjust/music/SubModeMusic.java`,
  `adjust/scene/SubModeScenes.java`, `adjust/diy/SubModeNewDiy.java`
- Controllers: `ble/controller/{CheckIcController,ReadIcController,ReadIcPointController,
  SecretController,SnController,SoftHardController,TakePhotoController,
  VideoRecognitionController,LightRecognitionMultiController,MultiController,
  WifiMacController,WifiSoftController,WifiHardController}.java`
- IoT: `iot/CmdPtReal.java`
- Recognition/points: `adjust/recognition/*`, `adjust/viewmodel/*`, `network/*`,
  `network/entity/*`
- DIY: `adjustNew/diy/*`, `adjustNew/diy/h1ab1/*`, `adjustNew/diy/h61dx/*`
- UI/install: `adjust/install/*`, `adjust/newdetail/*`, `adjustNew/*`

## 8. Gaps / unknowns

- Per-device colour/segment count is runtime (IC/segment read 0x46/0x40); the static
  `getBulbStringMaxNum` returns 14 for the bulb-string helper only.
- H61D3Support has two partially decompiled methods (`createNewScenesMode(String,String,SceneV1)`
  and `e(int,int,List)`) that throw `UnsupportedOperationException`; their exact branch logic is
  not recoverable here.
- H61DX basic effect 691/625 and H1AB1 share-code effects are explicit, but the full per-goodsType
  effect lists are DIY-new config/server driven.
- Recognition point payload is `count + x,y` pairs; the native shape-recognition algorithm is in
  `libh61dx` (not decompiled).
- Video recognition state codes (`0xED [0]`) are not named in this split; only the event is
  forwarded.
- Scene direction pair mapping is `SubEffect4LiuDong.Companion.b(byte)`; the byte↔direction table
  lives in the base library.


---

<!-- split_pact_h6630 -->

# split_pact_h6630 — gaming pixel light / sound-light bars (H6630, H8630, H6631)

Source root: `decompiled/jadx-splits/split_pact_h6630/sources/`

---

## 1. Overview / family and SKUs

H6630/H8630/H6631 are **“Gaming Pixel Light”** bars: RGB pixel display + speaker
(tone/white-noise/online music) + mic/music effects + DIY pixel effects (including
custom watch-faces and GIFs). The module also drives **Matter** commissioning.

| SKU | goodsType | variants | transport | notes |
|---|---|---|---|---|
| H6630 | 285 | `H6630Maker` | ble+iot+matter | main device; 285 supports protocols (1,1),(1,2),(2,1),(2,2),(2,3) |
| H8630 | 285 | same maker (`H6630Support.c = "H8630"`) | ble+iot+matter | co-brand / regional variant of 285 |
| H6631 | 286 | `H6631Maker` | ble+iot+matter | 286 adds protocol (2,4) |

Registry: `pact/H6630Support.java` (`b=H6630`, `c=H8630`, `d=H6631`,
`i={285,286}`, `j={"285","286"}`), `pact/SubMaker.java` (H6630Maker + H6631Maker),
`pact/SubLib.java`, `pact/RegisterItem.java`.
`pact/Model extends AbsDeviceModel4BleIot`; `pact/DeviceItem extends AbsBleIotItem`.
`h6630/add/AddDeviceM` registers both goods types with `MatterInterceptor`, and
`detail/H6630SettingActivity` uses `MatterManager`/`MtGuide`.

The “H6078 effect hooks” mentioned in the assignment are **not present**: a
repository-wide search of this split finds no `H6078` symbol. The effect hooks here
are H6630/H6631-specific (`H663xEffectCodeManager`).

---

## 2. Transports & GATT UUIDs

| item | value |
|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` (`BleCommUUID.b()`) |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` (`BleCommUUID.a()`) |
| frame | 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` |
| write | `0x33` |
| read | `0xAA` |
| multi-write | `0xA3` (V1 packetizer; `MultiController`) |
| notify | `0xEE` |

`ble/BleComm.java` extends `AbsBleComm` and uses `BleCommUUID`; `BleNotifyComm`
registers `WifiNotifyParse`, `BrightnessNotifyParse`,
`DeviceSwitchStatusNotifyParse`, `DeviceStatusNotifyParse`,
`MusicNotifyParse(H6630Support.b)`, `MovieFeastOnOffNotifyParse`.

Cloud: all commands are built as `Compose4DefWrite`/`Compose4DefWrite4Multi` and can
run locally or be tunneled as `ptReal` (or `ptIot` for OTA) — `Route.PreferBle(true)`.
Large effects (GIF/custom watch-face) use `CmdPtUrl` (`ptUrl`), i.e. the cloud hosts
the command blob.

Matter: commissioning through `com.govee.matter.MatterManager` / `MtGuide`
(`h6630/add/AddDeviceM`, `detail/H6630SettingActivity`). No Matter cluster mapping is
in this split; runtime control still uses the BLE/IoT frames below.

---

## 3. BLE frame + command table

`ble/BleProtocol.java` constants:
`b=19 (music submode)`, `q=13`, `r=19`, `s=4 (scenes)`, `t=10 (new DIY)`,
`u=4`, `v=127 (display/shortcut)`, `w=126 (custom GIF?)`, `x=32 (brightness notify)`,
`y=37 (auto upgrade)`, `z=125 (24 h)`, `A=126 (temp unit)`, `B=1`, `C=5`, `D=6`, `E=7`.

| command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `on` | `[0]=0/1` | generic `ControllerSwitch` |
| brightness | `0x33/0x04` | `level` | 0–100 | generic `ControllerBrightness` |
| mode | `0x33/0x05` | see §7 | sub 0x13 music, 0x04 scenes, 0x0A new DIY | `ble/Mode.java`; `ble/SubMode*` |
| read mode | `0xAA/0x05` | `[1]` | `AbsModeController.p()` | `ble/ModeController` |
| mute / light switch sub | `0x33/0x30` | `30 type val` | type 1 = light, 5 = disturbance/DND, 6 = tone | `H6630ViewModel.G5` |
| indicator light schedule | `0x33/0x30` | `30 07 en !forever startH startM endH endM` | `[1]=7` | `detail/controller/IndicatorLightController` |
| tone settings | `0x33/0x30` | `30 06 en powerTone screenOffTone keyTone countdownTone` | `[1]=6` | `detail/controller/ToneController` |
| read switch/indicator | `0xAA/0x30` | `[1]` | response `[1]=?` + state | `DeviceSwitchStatusNotifyParse` |
| device status | `0xAA/0x40` | – | 10 bytes (see §4) | base `DeviceStatusNotifyParse` |
| device info / switch config | `0xAA/0x41` | – | see §4.2 | `Info4Detail.d0` |
| auto-upgrade info | `0xAA/0x25` | `04` | sub 4 | `AutoUpgradesController.b` |
| auto-upgrade query | `0xAA/0x25` | `02` | sub 2 | `AutoUpgradesController.d` |
| auto-upgrade enable | `0x33/0x25` | `03 on` | sub 3 | `AutoUpgradesController.c` |
| volume | `0x33/0x79` (121) | `val` | 0–? (UI slider) | `H6630ViewModel.K5`; `Info4Detail.h0` |
| 24-hour display | `0x33/0x7D` (125) | `en` | 1 = 24 h | `H6630ViewModel.J6` |
| temperature unit | `0x33/0x7E` (126) | `en` | byte is `!z` for the caller’s boolean; unit convention inferred (0/1) | `H6630ViewModel.Z6` |
| shortcut | `0x33/0x7C` (124) | `DisplayEffectManager` bytes | effect-type + effect code | `ShortcutSetController` |
| DIY effect write | `0xA3/0x58` (88) | `[subEffect, secondSubEffect, params…]` | MultiController V1 | `H6630DiyParser.makeBleController` |
| DIY mode select | `0x33/0x05` | `0A codeLE16 speedLE16` | sub 0x0A | `SubModeNewDiy` |
| tone play state | `0x33/0x75` (117) | `01 songIdLE32 02` | online sound player | `SetPlayerStateController` |
| custom GIF result | `0xEE/0x7A`? | `[2]` reload | `Info4Detail.W` | `parseCreateGifResult` |
| alarm clock notify | `0xEE/0x85` | see §4.3 | `Info4Detail.U` | `parseDisplayAlarmClock` |

`0x30` sub-functions are the device’s “common switch” block: sub 1 light, sub 5
disturbance (DND), sub 6 tone, sub 7 indicator-light schedule.

Multi-write packetization: proType `0xA3`, start `[0, pageCount, 0]`, data chunks
`[pageIndex, 17 bytes]`, terminator `[0xFF]` (`MultipleControllerCommV1`).

---

## 4. BLE notifications / readings

### 4.1 Brightness / switch

| notify | layout | source |
|---|---|---|
| `0x20` | `[0]` brightness 0–100 | `ble/BrightnessNotifyParse` |
| `0x30` | `[1]` sub-index, `[2]` state; `EventSwitchSub` gets `(index, state, raw)` | `ble/DeviceSwitchStatusNotifyParse` |
| `0x11` | `[0]==0` → WiFi connected | `ble/WifiNotifyParse` |
| `0x70` | online music state; `OnlineMusicPares.parse(sku, bArr)` | base `onlinesound/cmd/MusicNotifyParse` |
| `0x60` | `[0]=1`, `[1]=on` → movie-feast on/off | base `MovieFeastOnOffNotifyParse` |

### 4.2 Device info / switch config (`0x41`, 17 payload bytes)

`Info4Detail.d0`:
```
[0]      switch bits byte 0:
         bit7 totalSwitch, bit6 lightSwitch, bit5 indicatorLightSwitch
[1]      switch bits byte 1 (inverted in parser):
         bit7 whiteNoiseSwitch, bit6 disturbanceSwitch, bit5 toneSwitch
[2]      C  (1/0)
[3]      D  (1/0)
[4]      E  (0 -> true)
[5]      indicator forever (0 -> true)
[6]      indicator startHour
[7]      indicator startMin
[8]      indicator endHour
[9]      indicator endMin
```
`DeviceSwitchInfo.Companion.a` reads bits 8/7/6 of bytes 0 and 1 (MSB-first helper).

### 4.3 Device status (`0x40`)

Base `DeviceStatusNotifyParse` forwards 10 bytes as `EventDeviceStatus`. The split’s
`Info4Detail` consumes the same payload for alarm-clock/display state:
```
[0..2]  alarm/display fields (BleUtils.L each)
[3]     alarm enable
[4]     alarm repeat?
[5]     alarm hour
[6]     alarm minute / 0 flag
```
The exact bit semantics of the 10-byte block are only partially exposed; see the
`DisplayAlarmClockBean` constructor in `Info4Detail.U`.

### 4.4 Tone settings (`0x30/06`)

`Info4Detail.g0(valid17)`:
`toneSwitch = byte[1]`, `powerOnTone = byte[2]`, `screenOffOnTone = byte[3]`,
`keyChangeTone = byte[4]`, `countdownTone = byte[5]` (each 0/1 or tone id).
Writes use `ToneController` with the same order.

### 4.5 Volume

`Info4Detail.h0`: `0xAA/0x79` → `valid[0]` = volume.

---

## 5. IoT commands + status/readings schema

`h6630/iot/Cmd.java`: `state`, `op`, `online`, `turn`, `brightness`, `status`,
`colorwc`, `ptReal`, `pt`.
`getCmdReadParseKey`: `ptReal` → `op`, else `state`.

| cmd | data | meaning |
|---|---|---|
| `turn` | `{"val":0|1}` | power |
| `brightness` | `{"val":0-100}` | brightness |
| `colorwc` | `{"red","green","blue"}` | RGB color |
| `state` | `{onOff,brightness}` | read-back |
| `op` | `{"command":["<base64 20-byte frame>"]}` | device frames (0x19/0x27/…, same as BLE) |
| `ptReal` | `{"command":["<base64>"]}` | tunnel any BLE frame |
| `pt` | raw device command | legacy passthrough |
| `status` | `{}` | snapshot request |
| `online` | `{}` | presence |

`Info4Detail.Y` parses `state.onOff`/`state.brightness` and then decodes every
`op.command[]` 20-byte frame through the same BLE parsers (`k0/j0/h0/d0/b0/f0/i0/e0`).
So the BLE tables above apply verbatim to cloud devices.

Status schema:
```json
{
  "state": {"onOff": 1, "brightness": 80},
  "op": {"command": ["<base64>"]},
  "online": true
}
```
Additional cloud state (cloud music/playlist, custom effects, Matter) is handled
outside this split.

---

## 6. Other protocols

- **Matter**: `MatterInterceptor` in `add/AddDeviceM` for goods types 285/286;
  `MatterManager`/`MtGuide` in `H6630SettingActivity` for pairing and info.
  No cluster/attribute mapping in this split.
- **ptUrl**: GIF / custom watch-face / large DIY effects are uploaded to cloud and
  executed via `CmdPtUrl` (`H6630ViewModel.notifyDeviceCreateGif`, `H6630GifParse`,
  `EditCustomMusicEffectDialog`). `GetIotCmdPtUrlLinkInfo` builds `ptUrl` v4 data.
- **Custom music effects REST** (`CustomMusicEffectService`):
  `GET/PUT/DELETE /bff-app/v1/music-mode/animation/custom` (list/save/delete).
- **Online music**: base `onlinesound` stack (`OnlineMusicM`, `OnlineMusicPares`,
  `MusicNotifyParse` cmd `0x70`, player-state cmd `0x75`, white-noise control).
- **OTA**: `ReportOtaPactController` via `ptIot` (`H6630ViewModel.G6`) and the
  `AutoUpgradesController` (0x25) feature.

---

## 7. Dynamic effects / music / scenes / DIY

### 7.1 Scene (`0x05/0x04`)

`SubModeScenes.getWriteBytes`:
```
04 effectLo effectHi musicCode0 musicCode1 musicCode2 musicCode3 speed
```
- `effect` 16-bit **little-endian** (LE16); default 2002.
- `musicCode` 32-bit LE (only if a music code is attached; else 0).
- `speed` byte (0–?).
Read parse: `effect = signedShort(valid[1],valid[0])` (LE16), `musicCode =
getSignedInt(valid[2..5], false)` (LE32), `speed = valid[6]`.

### 7.2 Music (`0x05/0x13`)

`SubModeMusic.getWriteBytes` = `13 musicCode sensitivity`; default code 101,
sensitivity 0–99.

### 7.3 New DIY (`0x05/0x0A`)

`SubModeNewDiy.getWriteBytes` = `0A codeLE16 speedLE16`.
Effect code range: advanced DIY codes 751/752/753/799/800/853/854/855/856/862/863
(`H663xEffectCodeManager`).

### 7.4 DIY effect payload (`0xA3/0x58`)

`Pro4H6630Diy.bytes`:
```
[subEffect][secondSubEffect][effect-specific params…]
```
Sub-effect IDs (from `H6630DiyParser` / `Pro4H6630Diy`):
1 云染/YunRan (cloud dye) — second 1 彩墙/color wall, 2 覆盖/cover
2 旋转/XuanZhuan — 1 拨板糖, 2 大风车
3 波动/BoDong — 1 波风, 2 双螺旋
4 流动/LiuDong — 1 伸缩, 2 叠加
5..9 大风车 speed variants
10..12 流动/叠加 variants
13 随机/Random — 跳跳球
14 随机 — 贪吃蛇
15 随机 — 笑笑乐
16 随机 — 烟花
17..18 双螺旋 variants
19 线性/XianXing — 像素
20..23 线性 — 喷射 (10/66), (12/20), (12/50), (15/50)
24..25 线性 — 填充 (f=15/14)
26..30 additional linear/penetration variants
```
Params are per-effect (colors, speed 1–100, direction enum, density, etc.) encoded by
each `*4*` class; the exact byte order is class-specific. The packet is wrapped by
`MultiController(bytes, 0x58)`; then a mode `0x0A` frame with DIY code `0x00FE` is
appended (`makeBleController`).

### 7.5 Custom watch-faces / GIF

- `H6630GifParse` builds a `ptUrl` command (cloud-hosted GIF blob) or a local BLE
  multi-frame with `CustomizeWatchFace2GifParse`.
- Effect codes: custom watch face 1/2 = 853/854 (H6630) or 855/856 (H6631).
- Cell graffiti: 752/753, 799/800, 862/863 depending on goods type/version.

### 7.6 Display/shortcut (`0x7C`, mode `0x81`)

`ShortcutPlate.d()` → `DisplayEffectManager` bytes (server effect type + effect id)
are written with cmd `0x7C`. `SubMode4Display` parses mode sub-byte **0x81 (signed -127)**
(`Info4Detail.a0`); the sibling mode **0x82 (signed -126)** is the custom watch-face
mode. `0x7D`/`0x7E` are separate command opcodes for 24-hour display and temperature unit.

### 7.7 Tone / alarm clock

Tone settings `0x30/06`; display alarm clock notify `0xEE/0x85`
(`Info4Detail.U` → `DisplayAlarmClockBean`).

---

## 8. Source map

| area | paths |
|---|---|
| registry | `pact/{H6630Support,H6630Maker,H6631Maker,SubLib,SubMaker,RegisterItem,Model,DeviceItem}.java`, `H6630Constant.java` |
| BLE comm | `ble/{Ble,BleComm,BleNotifyComm,BleProtocol,Mode,ModeController}.java`, `BleMultiComm` |
| BLE sub-modes | `ble/{SubModeMusic,SubModeScenes,SubModeNewDiy,DiyLocal}.java` |
| BLE parsers | `ble/{BrightnessNotifyParse,DeviceSwitchStatusNotifyParse,WifiNotifyParse}.java` + base `DeviceStatusNotifyParse`, `MusicNotifyParse`, `MovieFeastOnOffNotifyParse` |
| controllers | `detail/controller/{AutoUpgrades,IndicatorLight,Tone,TonePlay,ShortcutSet}Controller.java` |
| detail/VM | `detail/H6630ViewModel.java`, `detail/Info4Detail.java`, `detail/header/*`, `detail/delegate/*` |
| DIY | `detail/diy/**` (`H663xDiyParser`, `Pro4H6630Diy`, effect classes, GIF, watch-face) |
| net | `detail/delegate/CustomMusicEffectService.java`, base `onlinesound` |
| Matter | `add/AddDeviceM.java`, `detail/H6630SettingActivity.java` |
| IoT | `iot/Cmd.java` |

---

## 9. Gaps / unknowns

- No **H6078** hooks exist in this split. If H6078 support is expected, it is in a
  different split.
- `0x40` device-status payload and `0x41` device-info payload are only partially
  decoded in `Info4Detail`; several bits (`[2]..[4]`) are stored raw.
- The DIY `subEffect/secondSubEffect` table is partially named (Chinese effect names);
  per-effect byte layouts are in 30+ small classes and are not reproduced byte-for-byte
  here. The outer envelope (`0x58` + `[subEffect,secondSubEffect,…]` + mode `0x0A`
  `0x00FE`) is exact.
- Matter pairing is delegated to the base module; no cluster/attribute mapping.
- `0x7C/0x7D/0x7E` and mode `0x81/0x82` semantics are inferred from the calling methods
  (`setShortcut`, `set24HoursToDevice`, `setTemUnitToDevice`, display mode); the
  device-side byte layout for shortcut depends on `DisplayEffectManager`.
- Cloud music/playlist and white-noise playback live in the shared `onlinesound`
  module, not in this split.


---

<!-- split_pact_h6660 -->

# split_pact_h6660 — H6660 / H3810 laser engraver (LaserPecker-style)

Source root: `decompiled/jadx-splits/split_pact_h6660/sources/com/govee/h6660/`

## Overview / family and SKUs

Two SKUs, one goods-type (380):

| SKU | notes |
|---|---|
| H6660 | main laser engraver SKU (`LaserSupport.b`) |
| H3810 | sibling SKU (`LaserSupport.c`), same goods type in `H3810Maker` / `H3810DetailConfig` |

- `pact/LaserSupport.h` = `{380}`; `LaserSupport.g(380)` true, `LaserSupport.h(347)` exists as a
  legacy/secondary goods-type check.
- Pact registration: `GoodsType.beProtocol(1,1)` and `(1,2)` for goods-type 380;
  `LaserSupport.f` (support protocols) and `g` (pact protocols).
- Transport: `ble + iot`. `pact/DeviceItem extends AbsBleIotItem`, `pact/Model extends
  AbsDeviceModel4BleIot`. `Model.V()` = `"status"`. `Model.k0(IotMsgV2)` handles `status` and
  takes `op` → `ResultPt.bytes()` (base64 20-byte frames).
- Device gating: `Model.blockOpenIfAbnormal()` checks electric shock (`k1`), overheat (`M1`),
  high temperature/battery (`V0`), human presence (`V1`).

## Transports & GATT UUIDs

- Service `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/Ble.java` caches these as `Ble.t`/`Ble.u`; `Ble.v0()`=char, `Ble.w0()`=service.
- GATT callback requests MTU and persists it per SKU (`MtuConfig`), enabling larger picture
  uploads.
- Multi: `Ble.u()` → `BlePtRealMultiComm`; `Ble.v()` → anonymous `AbsMultipleBleComm` with the
  same UUIDs.
- Notify: `Ble$generateNotify$1` (dynamic parser list assembled by
  `LaserDetailViewModel.c4()`).

## BLE frame + command table

Frame `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`; write 0x33 / read 0xAA; multi
V1/V2 0xA3/0xA4.

`ble/BleProtocol.java`:

| const | dec | hex | use |
|---|---|---|---|
| b | 19 | 0x13 | music sub-mode |
| c | 13 | 0x0D | (laser/effect single) |
| d | 4 | 0x04 | brightness |
| e | 10 | 0x0A | DIY sub-mode |
| f | -126 | 0x82 | graffiti/DIY payload prefix |
| g | 32 | 0x20 | brightness notify |
| h | -79 | 0xB1 | laser format 0/1 |
| i | -78 | 0xB2 | laser frame |
| w | -128 | 0x80 | device status notify |
| x | 66 | 0x42 | battery info notify |
| y | 67 | 0x43 | single write (2-byte param) |
| z | 68 | 0x44 | single write/read param |
| A | 127 | 0x7F | laser def parser notify |
| B | 37 | 0x25 | WiFi upgrade / base info read |
| C | 48 | 0x30 | indicator light |
| j..v | 160..178 | 0xA0..0xB2 | laser music effect ids |

Derived commands:

| command | op | payload | response | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `[0]=0|1` | read `0xAA/0x01`; switch notify | base `SwitchController`; `scenes/BleSwitchCmdBuilder.java` |
| brightness | `0x33/0x04` | `[0]=0..100` | notify 0x20 | `DefParser.makeBrightnessNotifyParser` |
| music mode | `0x33/0x05` | `[0]=0x13 [1]=subMusicMode [2]=sensitivity` (+ multi-packet `MultipleController4Music` for effect) | event | `detail/MusicModeH3810.d()` |
| indicator light | `0x33/0x30` | `[0]=enable, [1]=!forever?1:0, [2]=startHour, [3]=startMin, [4]=endHour, [5]=endMin` | write result | `ble/controller/IndicatorLightController.java` |
| WiFi upgrade | `0x33/0x25` | `[0]=1 init?` / `{4}` read version / `{3, flag}` / `{2}` read | `[0]==1,[1]==1, [2]=state, [3..5]=soft x.y.z, [6..8]=hard x.y.z` | `ble/controller/WIFIUpgradesController.java` |
| laser param | `0x33/0x43` | `[0], [1]` (speed/power pair) | write callback | `detail/LaserDetailViewModel.u5()` |
| base info single read | `0xAA/0x25` | `{0x25,0x80,0x42,0x44,0x7F}` (380) or `{0x25,0x30,0x80,0x42,0x43,0x44}` | multi-read callbacks | `detail/LaserDetailViewModel.k5()` |
| laser DIY/effect | multi frames + `0x0A <diy LE16>` | as `ControlModeCompose` | event | `detail/diy/LaserDiyParser.java` |

`LaserDefParser` registers notify parsers for cmdTypes **0x42 (66)**, **0x7F (127)**,
**0x80 (-128)**, **0x81 (-127)**, **0x30 (48)**.

## BLE notifications / readings

| notify | parser | layout |
|---|---|---|
| 0x80 (128) | `DeviceStatusInfo.Companion.a(byte)` | bit1 child lock?, bit2..7: flags; `DeviceStatusInfo.i = -128`; `isChecking` false when bits 4..7 set |
| 0x42 (66) | `BatteryInfo.Companion.a(byte)` | bit8 charging, bits5..3 battery level, bit4?, bit3?, bit2?, bit1? |
| 0x20 (32) | brightness notify | `[0]` 0..100 |
| 0x01 (1) | switch notify | on/off |
| 0x11 (17) | wifi notify | connected |
| 0x7F (127) | `LaserDefParser` | raw bytes → laser def |
| 0x81 (-127) | `LaserDefParser` | raw bytes |
| 0x30 (48) | indicator light reply | parsed by `LaserDefParser` |
| via IoT `status.op` | `Model.k0` | for each 20-byte frame: `[1]==0x80` → `DeviceStatusInfo.a([2])`; `[1]==0x42` → `BatteryInfo.a([2])` |

Battery/status bit meaning is partly UI-derived; see `entity/DeviceStatusInfo.java`,
`entity/BatteryInfo.java`.

## IoT commands + status/readings schema

- `Model.V()` = `"status"`.
- IoT responses are `IotMsgV2`; `status.op` is a `ResultPt` whose `bytes()` are base64-decoded
  20-byte BLE frames (handled in `Model.k0`).
- Commands: mostly `ptUrl` via `GetIotCmdPtUrlLinkInfo`; `status` for reads. No `turn`/
  `brightness` IoT class in this split — those go through BLE or `ptUrl`.
- `ptUrl` payload (`detail/diy/LaserDiyParser.java`, `detail/LaserDetailViewModel`):
  `createPtUrlV4(EffectOtherInfo, new byte[]{88,0,97}, base64(payload))` — the 3-byte header is
  `0x58,0x00,0x61` (laser effect command marker). Snapshot path uses
  `LaserCmdOptionManager.h()` as the header and `cmdType=18`.
- Long-time upload: `GetIotCmdPtUrlLinkInfo.getLongTimePtUrlLink(PtUrlData(...))`.

## Other protocols

- `ptUrl` blob upload/fetch for large laser drawings/effects (main IoT path).
- No LAN/UDP/Matter code in this split.
- BLE MTU negotiation for image transfer (`Ble$getGattCallbackImp$1`).

## Dynamic effects / motion / music / scenes / DIY

- **Laser drawing model**: `entity/IldaFormat{0,1,2,4,5}.java`, `IldaFrame`, `IldaFrameHeader`,
  `LaserShape`, `LaserShapeType`, `LaserPathInfo`, `LaserText`, `ColorPoint`, `PathPoint`,
  `SingleLayer`, `ShapeLayers`. ILDA files (standard laser show format) are parsed/exported;
  frame formats 0/1/4/5, palette/true-colour.
- **Effect order** (`entity/DiyEffectInfo.java` constants):
  bright 25, color 24, move 26, scale 27, rotate 28, track 29, mirror 30, distort 31,
  carousel 36. Effect classes: `CarouselEffect`, `ColorEffect`, `DistortEffect`, `EraseEffect`,
  `MirrorEffect`, `MoveEffect`, `RotateEffect`, `ScaleEffect`.
- **Transforms** (`util/trans/`): scale, color, mirror, erase, distort, move, rotate.
  `LaserEffectTransManager` applies them per frame; `LaserPointLimitHelper` clamps point count
  (LaserPointLimitHelper).
- **Music**: `detail/MusicModeH3810.getDefaultMusicEffect()` — 13 effects with ids
  `BleProtocol.j..v` = 160 (Mist), 161 (PengZhuang/collision), 162, 163 (KuoSan), 164, 165
  (YongDong), 166 (LvDongTanQiu), 167 (CurveLine), 168 (JiHeQiPao), 169 (JiaoNang),
  176 (LaserWanHuaTong), 177 (JiaoTi), 178 (YanHua). Payload `[0]=0x13 [1]=subMode [2]=sensitivity`.
- **Scenes**: `detail/scene/H6660SceneViewModel`, `absEffect` layers; scene upload uses the same
  `ptUrl` + multi-BLE completion frames.
- **Graffiti/DIY**: `detail/diy/LaserDiyParser`, `detail/graffiti/*`, SVG import
  (`svg/SvgParseManager`, `SvgAnimationParser`), Hershey text (`util/HersheyFont`),
  ILDA import/export.
- **Preview trace**: `util/PreviewTraceUtil`, `LaserShapeUtils` render frames for preview.

## Source map

- `pact/LaserSupport.java`, `SubLib.java`, `SubMaker.java`, `RegisterItem.java`, `DeviceItem.java`,
  `Model.java`, `H3810Maker.java`, `H6660DetailConfig.java`, `H3810DetailConfig.java`,
  `LaserAddConfig.java`
- `ble/Ble.java`, `BleProtocol.java`, `controller/{IndicatorLightController,WIFIUpgradesController}.java`
- `scenes/AbsBleCmdBuilder.java`, `scenes/BleSwitchCmdBuilder.java`
- `detail/LaserDetailViewModel.java`, `detail/MusicModeH3810.java`, `detail/LaserDefParser.java`,
  `detail/diy/LaserDiyParser.java`, `detail/scene/*`, `detail/graffiti/*`
- `entity/*` (Ilda, LaserShape, DeviceStatusInfo, BatteryInfo, DiyEffectInfo, ScanSpeedInfo)
- `util/*` (IldaUtil, LaserShapeUtils, PreviewTraceUtil, trans/*)
- `notification/LaserNotification.java`, `net/LaserApiService.java`

## Gaps / unknowns

- `BleProtocol.z`/`y` write semantics (0x43/0x44 two-byte params) are not named; `u5(i,i2)`
  feeds them from UI sliders (likely speed/power).
- `DeviceStatusInfo`/`BatteryInfo` bit semantics are partly inferred from UI strings only.
- WiFi upgrade state machine values (`[0]` init/read codes) are not documented in source.
- Laser effect binary format is ILDA + proprietary `ptUrl` header `{0x58,0x00,0x61}`; the
  content encoding (frames/points) lives in `LaserEffectTransManager` and is only partially
  decoded by jadx.
- `LaserSupport` has a legacy goods-type 347 check with no SKU maker in this split.


---

<!-- split_pact_h682021 -->

# split_pact_h682021 — H6820 / H6821 curtain lights (square/planar DIY)

Source root: `decompiled/jadx-splits/split_pact_h682021/sources/com/govee/h682021/`

## Overview / family and SKUs

| SKU | goodsType | notes |
|---|---|---|
| H6820 | 279 | `Support.e(279)` = "H6820" |
| H6821 | 280 | `Support.e(280)` = "H6821"; `Support.b` = `[280]` |

- `Support.c` = `{280, 279}`; `pact/EffectOp.b()` returns `Support.a.c()`; DIY registered via
  `DiyM.t.a(...)`.
- `Support.b(i)` = 20 (colour pieces / columns), `Support.g(i)` = 4 (rows per page?),
  `Support.d("Curtain Lights")`.
- Geometry: curtain with **linear** (columns) and **planar/face** (2-D page) DIY modes;
  `DirectionType {NONE, UP_DOWN, UP_DOWN_JL_KS}`.
- Transport: `ble + iot`. `pact/DeviceItem extends AbsBleIotItem`, `pact/Model extends
  AbsDeviceModel4BleIot`, `Model.V()` = `"online"`.
- `Support.l()` saves mic support for 279/280.

## Transports & GATT UUIDs

- Service `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/BleComm.java` (also `com.govee.matter.pact.BleComm` is used as the generic comm in
  `Ble.r()`), `BleMultiComm` anonymous with the standard UUIDs.
- `Ble.u()` → `BlePtRealMultiComm`; `Ble.v()` → anonymous multiple comm.
- Notify: `Ble$generateNotify$1`; `ble/GattCallbackImp` for GATT events.
- Matter: `Ble.r()` returns `com.govee.matter.pact.BleComm` — this family reuses the Matter
  module's BLE comm wrapper (same UUIDs), not necessarily Matter pairing.

## BLE frame + command table

Frame `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`; write 0x33, read 0xAA;
effectPlay `CmdPtReal`/`ModeController` come from base `base2light/effectPlay/effect/mode`.

`ble/BleProtocol.java`:

| const | dec | hex | use |
|---|---|---|---|
| music | 19 | 0x13 | music sub-mode |
| color | 21 | 0x15 | colour sub-mode |
| scenes | 4 | 0x04 | scenes |
| DIY | 10 | 0x0A | new DIY |
| brightness notify | 32 | 0x20 | brightness |
| read/segment | 64 | 0x40 | segment info |
| laser/format | -79 / -78 | 0xB1 / 0xB2 | (shared effect ids) |
| auto-off | 36 | 0x24 | auto-off |
| music library | 75 | 0x4B | music library read |
| music library 2 | 113 | 0x71 | read |
| volume-base | 50 / 51 / 52 | 0x32/0x33/0x34 | volume/base light |
| movie feast | 84 | 0x54 | movie feast |
| device info | 7 | 0x07 | info |
| prompt | 101 | 0x65 | prompt |
| laser frame | -128 / -127 | 0x80/0x81 | status frames |
| -112 | -112 | 0x90 | (reserved) |
| operate | 12 | 0x0C | effect operate |

Derived commands:

| command | op | payload | response | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `[0]=0|1` | `0xAA/0x01` | base `SwitchController`; `pact/Comm.makeSwitchController4BleComm` |
| brightness | `0x33/0x04` | `[0]=0..100` | notify 0x20 | base `BrightnessController`; `iot/OpColorCommDialog4BleIot` |
| mode | `0x33/0x05` | sub-mode block | `0xAA/0x05` | base `effectPlay.ModeController`; `ble/Mode.java` |
| DIY multi | `0xA3/0x5B` | `makeSendBytesV3(0xA3, 0x5B, diyBytes, 97)` + final `0A <diy>` frame | multi result | `pact/Comm.makeDiyCmd4IotCommMulti` |
| scene multi | `0xA3/0x5B` | `makeSendBytesV3(0xA3, 0x5B, sceneBytes, 97)` + final `04 <effect>` | multi result | `pact/Comm.a()` |
| heart | `0xAA/0x01` | none | no-event | base `HeartControllerNoEvent` |

`MultipleControllerCommV1.makeSendBytesV3(proType=0xA3, commByte=0x5B, payload, chunkSize=97)`
is the family-specific multi-packet builder (note 97-byte chunk split, not the default 17).

### Sub-mode payloads

Colour (`ble/SubModeColor.java`, id 0x15) — **different from h6047** (no segment mask):

```
[0]=0x15 [1..3]=R G B [4..5]=kelvin LE16 [6..8]=background/second R G B
```

`parse()` reads `[1..3]` RGB, `[4..5]` kelvin, `[6..8]` second RGB.
Default kelvin range 1000–10000 K (`Constant.getTemColorByKelvin(i,{1000,10000})`).

Scenes (`ble/SubModeScenes.java`, id 0x04): `[0]=04 [1..2]=effect LE16 [3]=musicCode`.
(Note the extra music byte, unlike h6047.)

New DIY (`ble/SubModeNewDiy.java`, id 0x0A): `[0]=0A [1..2]=diyCode LE16`.

Music (`ble/SubModeMusic.java`, id 0x13): `[0]=13 [1]=musicCode [2]=sensitivity (0..99)`.
Default effect code 101.

## BLE notifications / readings

Parsers are assembled by the base effectPlay detail; the family exposes brightness notify
0x20 and generic device status. `Ble$generateNotify$1` plus `LaserDefParser`-style parsers in
base effectPlay. Colour parse callback:

```
parse: [1..3]=R G B, [4..5]=kelvin LE16, [6..8]=second R G B
```

## IoT commands + status/readings schema

`iot/OpColorCommDialog4BleIot`, `OpColorCommDialog4SquareBleIot`, `OpColorCommDialog4BleIot`,
`OpDiy*`, `OpScene*`, `OpColorCommDialog4SquareBleIot` use base classes
`AbsOpCommDialog4BleIot`/`V2`. BLE frames are sent through `CmdPtReal` (`effectPlay`).

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0|1}` (base `CmdTurn`) | `iot/OpColorCommDialog4BleIot` (switch constructor) |
| `brightness` | `{"val":0..100}` (base `CmdBrightness`) | `iot/OpColorCommDialog4BleIot` constructor |
| `colorwc` | `{"color":{r,g,b},"colorTemInKelvin":int}` (base `CmdColorWc`) | `iot/OpColorCommDialog4BleIot` |
| `ptReal` | `{"command":["<base64 frame>"]}` | `effectPlay.effect.mode.CmdPtReal` |
| `online`/`status` | `state` on/off, `op` frames | `pact/Model.V()` = "online" |

`OpColorCommDialog4BleIot` builds a `BrightnessController` + `CmdBrightness(i,0,2)`, a
`SwitchController` + `CmdTurn`, or a colour mode controller + `CmdColorWc`.

## Other protocols

- **Image recognition / mapping** (curtain layout): `network/ApiService.java`,
  `ApiServiceKt.java`, `LightPointInfo`, `PointListInfo`, `RecognitionPointInfo`,
  `vm/VM4H682X.sendImageRecognition(...)` — uploads a photo to identify light points and
  build the planar mapping.
- Matter: `Ble.r()` returns `com.govee.matter.pact.BleComm` (shared comm class).
- WiFi/cloud IoT through base `Iot` manager.

## Dynamic effects / motion / music / scenes / DIY

- **Scenes**: `Support.k(str, mode)` → `ScenesM.p.p(str, effect)` →
  `ScenesOp.parseSceneV1(str, scene, {1,10})`; channels `Support.m()` = `{0,1,5}`.
  Morning scene uses `{1,10}` and falls back to a `SubModeScenes` frame.
- **DIY payload** (`diy/Pro4H682xDiy.java`):
  ```
  [0]=effect type (1 linear page, 2 face/planar page)
  [1..2]=payload length LE16
  [3]=page count
  [4]=rule (Pro4H682xDiy.b; 0..4)
  then pages, each with their own LP16 length:
  ```
  Inner blob from BLE is expected to start with `0x4B (75)` then type 1/2
  (`Pro4H682xDiy.Companion.c`).
- **Linear page** (`diy/H682xPageDiyLinearEffect.c()`), in order:
  ```
  length LE16,
  effectType (a), [subtype (b) if a==1], colorType (c) (=2 means solid → 0 else d),
  e, f, g (pre-serialised sub-effect bytes), h, i, j, k,
  colorCount, {R,G,B}*colorCount, m, n[0..1] (direction/mirror),
  o, p, if p!=1: {q, [r if q==7], s}
  ```
  Direction map (`H682xPageDiyLinearEffect.Companion.a`) and
  `H682xPlanarDirectionConfig.directionMap` provide 14 planar direction codes.
- **Planar direction codes** (`diy/H682xPlanarDirectionConfig.java`):
  `b(upDownFlag, dirType)` maps to bytes 0..13:
  (1,1)→2, (1,0)→3, (0,1)→0, (0,0)→1, (1,3)→4, (0,3)→5, (1,2)→6, (0,2)→7, (0,4)→12,
  (0,5)→13, (0,7)→8, (0,6)→9, (0,9)→10, (0,8)→11. Default 2.
- **Sub-effects** (`diy/SubXianxing`, `SubLiudong`, `SubJihe`, `SubDuiji`, `SubSuiji`):
  linear (Xianxing), flow (Liudong), geometry (Jihe), stacking (Duiji), random (Suiji).
- **Music**: sub-mode 0x13 with musicCode + sensitivity; `MusicMode4H682x` UI.
- **Segment colour mode**: `adjust/delegate/H682XSegmentColorMode` / `H682XSegmentColorModeKt`
  (per-segment colour preview).
- **GIF/scrawl**: `GifId.java`, `diy/H682xCircleGraffitiParse`, `H682xPageDiyFaceEffect`.
- **Speed configs**: `SpeedInfoLinearH682x`, `SpeedInfoPlanarH682x`,
  `SpeedInfoConfigH682x`.

## Source map

- `Support.java`, `pact/SubLib.java`, `Comm.java`, `Model.java`, `DeviceItem.java`,
  `Register4Item.java`, `EffectOp.java`, `AbsEffectOp4BleIot.java`, `BleIotExt.java`,
  `BleWifiBindExt.java`
- `ble/Ble.java`, `BleComm.java`, `BleProtocol.java`, `Mode.java`, `SubModeColor.java`,
  `SubModeScenes.java`, `SubModeNewDiy.java`, `SubModeMusic.java`, `GattCallbackImp.java`,
  `controller/ModeController.java`, `DiyModeComposeController.java`
- `pact/Comm.java`, `pact/SubLib.java`
- `diy/Pro4H682xDiy.java`, `H682xPageDiyLinearEffect.java`, `H682xPageDiyFaceEffect.java`,
  `H682xPlanarDirectionConfig.java`, `H682xDiyParse.java`, `Sub*.java`
- `iot/Op*CommDialog4BleIot*.java`, `network/*`, `vm/VM4H682X.java`, `adjust/*`

## Gaps / unknowns

- `makeSendBytesV3(..., 97)` chunk size 97 is unusual; the exact reassembly rule across
  packets is in `MultipleControllerCommV1` (base) and depends on MTU.
- Linear/planar page field names are obfuscated single letters; order is exact but semantic
  names (speed/brightness/direction/mirror) are inferred from UI mapping.
- `Ble.r()` using `com.govee.matter.pact.BleComm` implies a shared Matter comm class, but no
  Matter cluster/attribute mapping was found in this split.
- Image-recognition API request/response schema lives in `network/ApiService` annotations;
  server-driven point mapping is runtime.
- `Support.b(i)`/`g(i)` constants (20, 4) are layout hints, not verified against every SKU.


---

<!-- split_pact_h6840 -->

# split_pact_h6840 — H6840/H6841/H6842/H6843 + H6609 library family

Sources: `decompiled/jadx-splits/split_pact_h6840/sources/com/govee/...`
plus shared lighting code in `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/...`.

Paths relative to `decompiled/`.

## 1. Overview / family and SKUs

The split contains **two generations**:

1. `com.govee.h6840` — the newer **Hexa/Glide wall-panel** line
   (H6840/H6841/H6842/H6843), goodsTypes 278/325/381/382. Colour sub-mode is
   `0x0D`, scenes add a 4th parameter byte, DIY is a 16-bit code with
   hexa-specific layer tools.
2. `com.govee.h6609` — a shared **panel/string/light-bar library** used by many
   SKUs (H6609, H70C1/C2/CB/C9, H70C4…H70C8, H6870/H6871/R6871, H6860/H6861,
   H6350/H6351, H6850, H6250, H6175), goodsTypes 173/181/260/362/374/378/392/398/187.
   Colour sub-mode is `0x15`, with a very flexible op-type byte.

### 1.1 H6840-series SKUs

| SKU | goodsType | pact protocols | transports | notes |
|---|---|---|---|---|
| H6840 | 278 | (1,1),(1,2),(2,1),(2,2) | ble, iot, matter | `ConfigH6840.addSupportPact()` |
| H6841 | 325 | (1,1),(1,2) | ble, iot, matter | same config, `MatterInterceptor` |
| H6842 | 381 | (1,1) | ble, iot | `ConfigH684243` |
| H6843 | 382 | (1,1) | ble, iot | `ConfigH684243` |

`Support.b = {278,325,381,382}` is the supported-goodsType list for effects.
H6842/H6843 DIY effect codes are `ConfigH684243.b..i = 927..934`.

### 1.2 H6609-library SKUs

| SKU | goodsType | pact protocols | transports | notes |
|---|---|---|---|---|
| H6609 | 173 | (1,1) | ble, iot, matter | Gaming Light Strip G1; MatterSupport |
| H70C1 | 181 | (1,1),(2,1) | ble, iot | RGBIC string light; `Support.k` |
| H70C2 / H70CB / H70C9 | 181 | (1,1),(2,1) | ble, iot | SKU aliases, same goodsType |
| H6175 | 187 | registered via `H6175Item` | ble, iot | legacy alias, no explicit pact registration (gap) |
| H70C4/H70C5/H70C6/H70C7/H70C8/H6870/H6871/R6871 | 260 | (1,1),(1,2),(2,1),(2,2) | ble, iot | `Support.isH687()` selects H6870/71/R6871 |
| H6860/H6861 | 362 | (1,1),(2,1) | ble, iot | `isGoodsTypeH6860_61` |
| H6350 | 374 | (1,1) | ble, iot | colour piece size 1 |
| H6850 | 378 | (1,1) | ble, iot | colour piece size 4 |
| H6351 | 392 | (1,1) | ble, iot | colour piece size 1 |
| H6250 | 398 | (1,1) | ble, iot | 11 segments; newer UI |

`h6609/pact/Support.addSupportPact()` registers 173/(1,1); 181/(1,1)+(2,1);
260/(1,1)+(1,2)+(2,1)+(2,2); 374/(1,1); 392/(1,1); 398/(1,1).
`Support.y` is the device-list goodsType array `{173,181,260,362,374,378,392,398}`.

## 2. Transports & GATT UUIDs

Both generations use:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

`h6840/ble/Ble.java` additionally requests MTU (`MtuConfig`) and exposes an
`AbsMultiple4PtRealBleComm` / `BlePtRealMultiComm` for `ptReal` streaming.
`h6609/ble/BleComm.java` uses the same UUIDs and chooses `HeartControllerNoEvent`
when `BleComm.g == 2`.

IoT is via the base2light IoT commands (`h6840/pact/Comm.java`) or the `h6609`
native command set (`h6609/iot/Cmd.java`). Matter only on H6609 (173) and
H6840/H6841 (278/325) per the interceptors.

## 3. BLE frame + command table

20-byte frame `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR`.
Single write `0x33`, read `0xAA`; multi-packet `0xA3`.

### 3.1 H6840 / H6841 / H6842 / H6843

| Command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `01/00` | [0] | base `SwitchController` |
| brightness | `0x33/0x04` | `0..100` | [0] | base `BrightnessController` |
| mode container | `0x33/0x05` | sub-mode | `0x0D` colour, `0x04` scene, `0x0A` DIY, `0x13` music | `h6840/ble/Mode.java`, `ModeController.java` |
| position calibration | `0x33/0x42` | `…` | `BleProtocol.positionCalibration=66` | `h6840/ble/controller/PositionCalibration*.java` |
| install number / IC | `0x33/0x40` | `01 …` | device install count | `h6840/pact/BleProtocol.device_install_num` |
| secret key write/read | `0x33/0xB2`, `0xAA/0xB1` | key | 16-byte | `h6840/pact/BleProtocol.SECRET_KEY_*` |

### 3.2 H6609 library

| Command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `01/00` | `ControllerSwitch` | `h6609/ble/controller/compose/ControllerSwitch.java` |
| brightness | `0x33/0x04` | `0..100` | — | base |
| gradual | `0x33/0xA3` | `01/00` | fade on/off | `compose/GradualController.java` |
| mode container | `0x33/0x05` | sub-mode | `0x15` colour, `0x04` scene, `0x0A` DIY, `0x13` music, `0x14` interactive, `0x00` video, `0x05` mic | `h6609/ble/Mode.java`, `v1/ModeV1.java` |
| IC number read | `0xAA/0x40` | — | returns IC count | `compose/ControllerIcNum.java` |
| direction | `0x33/0x30` | `dir` | write; read `0xAA/0x30` | `compose/DirectionController.java` |
| calibration in/out | `0x33/0x44` | `02 01` into / `02 00` exit | — | `compose/CalibrationController.java` |
| on/off memory | `0x33/0x41` | `…` | `Controller4OnOffMemory` | `ble/controller/Controller4OnOffMemory.java` |
| interactive game | `0x33/0x05` | `14 …` | see §7.5 | `compose/InteractiveGamesController.java` |
| camera position | `0x33/0x31` | `…` | `MSG_TYPE_CAMERA_POSITION=49` | `BleProtocol` |
| read install camera | `0xAA/0x32` | — | `MSG_TYPE_READ_INSTALL_CAMERA=50` | `BleProtocol` |
| read install light | `0xAA/0xAA` | — | `MSG_TYPE_READ_INSTALL_LIGHT=-86` | `BleProtocol` |
| start time | `0xAA/0x35` | — | `MSG_TYPE_READ_START_TIME=53` | `BleProtocol` |
| white balance | `0x33/0xA9` | `…` | `value_white_balance=-87` | `BleProtocol` |
| USB check | `0x33/0x38` | `val` | `value_check_usb=56` | `BleProtocol` |
| USB check state | `0x33/0x37` | `val` | `value_check_usb_state=55` | `BleProtocol` |
| compose light switch | `0x33/0x36` | `val` | `value_compose_light_switch=54` | `BleProtocol` |
| swap light position | `0x33/0x34` | — | `value_swap_light_pos=52` | `BleProtocol` |

Multi-packet (`0xA3`) framing is shared with all lighting splits
(`base2light/ble/comm/MultipleControllerCommV1`):

- V1: `[0]=0xA3 [1]=0 [2]=2 [3]=total [4]=cmd [5]=? [6]=? [7..14]=verify [15..18]=first 4 bytes`, then `[1]=seq` 17-byte chunks, final `[1]=0xFF`.
- `Comm.a()` uses `makeSendBytesV3(0xA3, 0x5B, blob, 97)` for scene blobs
  (`h6840/pact/Comm.java`), then appends `04 <code LE16>`.

## 4. BLE notifications / readings

### H6840
`h6840/ble/Ble$generateNotify$1.java` registers a Wi-Fi parser (proType from
`DefParser.makeWifiNotifyParser(0, …)` → `0x00` for this family) and
`DeviceStatusNotifyParse` (`0x40`).

### H6609
`h6609/ble/BleNotifyComm.java` registers:

| proType | parser | reading |
|---|---|---|
| `0x11` | `WifiNotifyParse` | Wi-Fi connected = `[0]==0` |
| `0x40` | `DeviceStatusNotifyParse` | first 10 bytes |
| `0x30` | `LightAndHdmiNotifyParse` | `[0]==1`: 4 light-bar presence bits from `parseBytes4Bit([1])` |
| `0x60` | base `MovieFeastOnOffNotifyParse` | `[0]==1`, `[1]` on/off |
| `0x35` | base `InteractiveGameNotifyParse` | `[0]` status; if 2 → signed24 at `[1..3]` |
| `0xED` (`-19`) | `VideoRecognitionNotifyParse` | `[0]` recognition state |

## 5. IoT commands + status / readings schema

### H6840-series

`h6840/pact/Cmd.java`: `state`, `op`, `online`, `turn`, `brightness`, `status`,
`colorwc`, `ptReal`, `pt`. `getCmdReadParseKey` maps `ptReal`→`op`, else `state`.

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0|1}` | base2light `CmdTurn` |
| `brightness` | `{"val":0..100}` | base2light `CmdBrightness` |
| `colorwc` | `{"color":{"r","g","b"},"colorTemInKelvin"}` | base2light `CmdColorWc` |
| `ptReal` | `{"command":["<base64 frame>",…]}` | base2light `CmdPtReal` |
| `status` | `{}` | `h6840/pact/Cmd.java` |
| `online` | — | `h6840/pact/Cmd.java` |

H6840 `Comm.a(scenesParam, sceneCode)` splits a base64 scene blob into
`makeSendBytesV3(0xA3,0x5B,…,97)` chunks, wraps each chunk as a `ptReal`, and
appends `04 <sceneCode LE16>` on the last one.

### H6609-library

`h6609/iot/Cmd.java` commands: `state`, `op`, `online`, `turn`, `color`,
`colorTem`, `brightness`, `status`, `pt`, `snapshot`, `points`, `IoTConnected`,
`camera`, `swap`, `ptReal`, `ptIot`, `colorwc`.

Notable extra payloads:

- `snapshot` / `dewarpsnapshot` (H6099 sibling) — camera calibration image.
- `points` — `{"points":[...]}` calibration point list (3-image calibration).
- `camera` — camera on/off.
- `swap` — swap light position.
- `IoTConnected` — link state.
- `colorTem` — `{colorTemInKelvin, color}`.
- `ptIot` — passthrough on the IoT channel (different from BLE `ptReal`).

`h6609/iot/State.java` status: `onOff` (int), `brightness` (int),
`wifiSoftVersion`, `wifiHardVersion` (strings).

## 6. Other protocols

- **Matter**: H6609 (`h6609/newdetail/config/MatterSupport.java`, goodsType 173);
  H6840/H6841 (`ConfigH6840$addDevice$addDeviceParams$2` MatterInterceptor).
- **H6609 3-image / 2-image camera calibration** uses HTTP:
  `h6609/adjust/new_detail/network/ApiService` and `.../PointListInfo.java`
  (upload/get calibration points, snapshots).
- **H6840 graffiti/GIF**: local asset pipeline (`diy/gif/GifTransformVM`,
  `diy/cell_graffiti/*`), not a network protocol.
- **BLE broadcast** discovery: `h6609/add/BleBroadcastProcessor.java`.

## 7. Dynamic effects / motion / music / scenes / DIY

### 7.1 H6840 colour — sub-mode `0x0D`

`h6840/ble/SubModeColor.getWriteBytes()`:

```
0D R G B kLo kHi R2 G2 B2
```

9 bytes. `kLo/kHi` = colour temperature LE16 (0 when not temp mode); `R2G2B2`
is the temperature-mode RGB. No per-segment mask in this sub-mode — segment
colour is done with the H6840 multi-layer colour-strip controllers
(`MultipleColorStripControllerV1`) + `ptReal`.

### 7.2 H6840 scenes — sub-mode `0x04`

`h6840/ble/SubModeScenes.getWriteBytes()` = `04 effectLo effectHi param`.
`param` (3rd byte) comes from the scene definition; H6840 scene layers are
`0xA3` blobs with cmd `0x5B` (91).

### 7.3 H6840 DIY — sub-mode `0x0A`

`0A codeLo codeHi` (16-bit LE). H6840 DIY groups from
`ConfigH6840` / `DIY4H6840Main(byte group, SubEffect*)`:

| group | sub-effects (classes) |
|---|---|
| 1 | HuoHua (fireworks-ish), ShuangLuoXuan |
| 2 | CaiHong, LiuXing, CaiDai |
| 4 | Line |
| 6 | BoBanTang, DaFengChe |
| 7 | SuiJi, FuGai |
| 9 | TanTiaoQiu, TanChiShe, XiaoXiaoLe, PenShe |
| 10 | YinHe |
| 11 | HuanRaoYunLuo |
| 12 | LiuShui |
| 13 | HuanRaoYunLuo variant |
| 14 | HuiTan |

Additional sub-effect classes exist for DangYang, DuiDie, ShenSuo, SiDai,
TanTiao, CanLan. H6842/H6843 use effect codes `927..934`
(`ConfigH684243.b..i`).

### 7.4 H6840 music — sub-mode `0x13`

`h6840/ble/SubModeMusic`: `13 code sens`, sensitivity 0–99.
Music codes 160–167 (`h6840/pact/BleProtocol`):
160 LiuXingYu, 161 ShiZiXing, 162 HuanCai, 163 PiaoWu, 164 PinPu, 165 FenLi,
166 LvDong, 167 XianPu. New-music codes 48–55 are also accepted
(`Support.isNewMusicCode`).

### 7.5 H6609 colour — sub-mode `0x15` (op-type byte)

`h6609/ble/v1/SubModeColorV1.getWriteBytes()` selects on `opType`:

| opType | bytes | meaning |
|---|---|---|
| 0 SET_BRIGHTNESS | `15 02 bri maskLo maskHi` | set brightness on masked segments |
| 1 SET_COLOR | `15 01 R G B kLo kHi 0 0 0 mask*` | set RGB on masked segments |
| 2 SET_COLOR_TEMP | `15 01 FF FF FF kLo kHi R G B mask*` | white + kelvin on masked segments |
| 3 SET_MODE | `15 00` | enter colour mode |
| 6 BRIGHTNESS_GROUP | `15 03 groupIdx briSet…` | per-group brightness (14 per packet) |
| 7 COLOR_GROUP | `15 04 groupIdx rgbSet…` | per-group RGB (4 colours per packet) |

`opType` values 4/5/8/9/10/11 are app-side selectors only and return `null` from
`getWriteBytes()`; they are never put on the wire.

Mask encoding: `BleUtil.makeSelectedTwoBytes(checkSet,true)` for ≤16 segments;
`BleUtils.X(checkSet,true)` for >16. Segment count for H6609 = 18 at IC 36, H70C1=10,
H70C4-8/H6860/61=10, H6250=11, H6350/6351=1, H6850=4, default 14
(`h6609/pact/Support.getColorPieceSize`).

### 7.6 H6609 scenes / DIY / music / video / interactive

- Scenes `0x04`: `04 effectLo effectHi` (2 bytes).
- DIY `0x0A`: `0A codeLo codeHi`; `Sub4Diy`; H70C1/H70C4 use graffiti parsers.
- Music `0x13`:
  - simple: `13 code sens`
  - full (8 bytes): `13 code sens dynFlag autoFlag 00 00 R G B`
  - `SubModeMusicV1` for H6609/H70Cx, music codes 64 rhythm, 65 wind, 66 hooray,
    67 sprout, 72 hopping, 80 torch, 82 burst, 83 streaming,
    plus new codes 3,4,5,6 (rhythm/pinpu/energy/gundong V2).
- Video `0x00` (`SubModeVideoV1`): `00 dramaFlag partFlag(8/9) vividness voiceOpen 02 voice`.
  The H6609/H6250 new-detail VM uses the shared `VideoModeControllerParams` path
  (`0x05/0x00`); shared DreamView settings (white balance, sensitivity, HDR, saturation,
  AI filter, black screen) are catalogued in `DREAMVIEW-HDMI.md`.
- Interactive game `0x14` (`SubModeInteractive`):
  - level 0: `14 01 sens1 level(0) soundLevel timeLo timeHi` (time = 14/28/42/56/70/98/126)
  - level 1: `14 01 sens2 level(1) twoLevel [difficulty if twoLevel==1]`
- Mic `0x05`.

### 7.7 H6609 colour-temperature ranges

`h6609/pact/Support.getColorTemRange` is per goodsType in the caller; H6840 panels
use `Support.a(278) = {2000,9000}` (`h6840/Support.java`).

## 8. Source map (traced)

- H6840 SKUs/pact: `h6840/Support.java`, `ConfigH6840.java`, `ConfigH684243.java`,
  `h6840/present/{SubLib,Register4Item,DeviceItem}.java`, `h6840/pact/{BleProtocol,Cmd,Comm}.java`.
- H6840 BLE: `h6840/ble/{Ble,Mode,ModeController,SubModeColor,SubModeMusic,SubModeScenes,SubModeNewDiy}.java`,
  `h6840/ble/controller/{PositionCalibration,PositionCalibrationOld}.java`.
- H6840 DIY: `h6840/diy/**` (DIY4H6840Main, SubEffect*, H6840DiyParser),
  `h6840/diy/advance/*`, `h6840/diy/cell_graffiti/*`, `h6840/diy/gif/*`.
- H6840 IoT: `h6840/pact/Comm.java`, `h6840/iot/Op*Dialog*.java`.
- H6609 SKUs/pact: `h6609/pact/{Support,SubLib,SubMaker,*Item}.java`.
- H6609 BLE: `h6609/ble/{Ble,BleComm,BleNotifyComm,BleProtocol,Mode,ModeController}.java`,
  `h6609/ble/v1/*`, `h6609/ble/controller/**`.
- H6609 IoT: `h6609/iot/{Cmd,State,CmdPtReal,CmdColorWc}.java`.
- H6609 effects: `h6609/newdetail/h70c1c2cb/**`, `h6609/h6250/**`, `h6609/h6350/**`,
  `h6609/h6850/**`, `h6609/h6860/**`, `h6609/h70cx_v2/**`.

## 9. Gaps / unknowns

- Scene layer blobs and DIY templates are cloud assets; only the `04 <LE16>` and
  `0A <LE16>` trailers plus the `0xA3/0x5B` chunk framing are static.
- H6175 (goodsType 187) has a `H6175Item` but no `pact.a(187,…)` registration in
  `h6609/pact/Support`; its protocol pair could not be resolved.
- H6840 `positionCalibration` payload bytes are built in native/Compose code
  (`PositionCalibration`), not fully readable in Java.
- H6609 video/interactive parameter meanings (vividness, voice, sound level) come
  from UI sliders; ranges are 0–100 / 1–7 as shown, but no protocol doc.
- The H6840 Wi-Fi notify parser is registered with proType `0` (H6840) while the
  H6609 family uses `0x11`; both are present in the code path.


---

<!-- split_pact_h7050 -->

# split_pact_h7050 — H7050/H70xx outdoor & string-light family

Sources: `decompiled/jadx-splits/split_pact_h7050/sources/com/govee/...`
plus shared lighting code in `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/...`.

Paths are relative to `decompiled/`.

## 1. Overview / family and SKUs

This is a **large multi-SKU lighting split** with two source packages:

- `com.govee.h7050` — H7050…H8067 outdoor/string/bulb SKUs (all BLE+IoT).
- `com.govee.h7020` — H7020/H7015/H7029/H7030/H7033/H7041/H7042/H30D01/H3010…/H3001/R7015
  (a mix of **BLE-only** `AbsBleSku` and **BLE+IoT** `AbsBleWifiSku`).

Every SKU is registered through `*/pact/SubMaker.java` and a
`pact/bleiot/BleIotMaker*.java` (BLE+IoT, extends `AbsBleWifiSku`) or a
`pact/ble/BleMaker*.java` (BLE-only, extends `AbsBleSku`).

Pact support is registered in `h7050/pact/Support.addSupportPact()` using
`GoodsType.beProtocol(type, code)`. `(1,1)` = BLE+IoT v1; `(2,1)` = v2;
`(1,2)/(1,3)` = later hardware revisions of the same SKU.

| SKU | goodsType | class / notes | pact protocols | transports |
|---|---|---|---|---|
| H7050 | 46 | permanent outdoor, 15 bulbs | (1,1) | ble, iot |
| H7051 | 105 | `MusicModeH351011.l == 105`; 24 bulbs | (1,1) | ble, iot |
| H7052 | 218 | 15 bulbs | (1,1),(2,1) | ble, iot, matter |
| H7053 | 219 | 30 bulbs, device lock | (1,1),(2,1) | ble, iot, matter |
| H7055 | 116 | 2 bulbs, 2200-6500K | (1,1) | ble, iot |
| H7057 | 274 | 4 bulbs | (1,1) | ble, iot, matter |
| H7058 | 275 | 6 bulbs | (1,1) | ble, iot, matter |
| H7060 | 76 | 2 bulbs, 2700-6500K | (1,1) | ble, iot |
| H7061 | 98 | 2200-6500K | (1,1) | ble, iot |
| H7062 | 107 | 6 bulbs | (1,1) | ble, iot |
| H7063 | 227 | 3 bulbs, lock, net reset | (1,1),(2,1) | ble, iot, matter |
| H7065 | 113 | 2 bulbs, 2200-6500K | (1,1) | ble, iot |
| H7066 | 171 | 1 bulb, 2200-6500K | (1,1) | ble, iot |
| H6087 | 77 | 2200-6500K | (1,1) | ble, iot |
| H6088 | 157 | RGBIC string | (1,1),(2,1) | ble, iot |
| H7045/H7046 | 338 | Hexa/Glide panels, music feast, Tuya variant | (1,1),(1,2),(1,3) | ble, iot, matter |
| H7037/H7038/H7039 | 221 | curtain/string; H7038/H7039 are aliases | (1,1),(2,1) | ble, iot |
| H7087 | 315 | 3 bulbs | (1,1) | ble, iot, matter |
| H7093 | 289 | 2 bulbs | (1,1) | ble, iot, matter |
| H7094 | 290 | 4 bulbs | (1,1) | ble, iot |
| H8066 | 305 | 3 bulbs (commercial) | (1,1) | ble, iot |
| H8067 | 393 | 6 bulbs (commercial) | (1,1) | ble, iot |
| H3500 | 345 | 8-bulb string | (1,1) | ble, iot, matter |
| H3501 | 339 | 8-bulb string, install calibration | (1,1) | ble, iot, matter |
| H3510/H3511 | 349 | string light | (1,1) | ble, iot, matter |
| H3200 | 353 | lamp | (1,1) | ble, iot |
| H1630 | 364 | cube/hexa lamp, graffiti | (1,1),(1,2),(1,3) | ble, iot, matter |

`Support.I/J` (arrays of goodsTypes) are the device-list and scene-support lists.
`Support.getBulbStringMaxNum()` and `getColorPieceSize()` give per-SKU segment counts
(15/24/30/2/6/3/4/8/11/20… see table above).

### 1.3 `com.govee.h7020` SKUs (same split)

| SKU | goodsType | maker / transport | pact protocols |
|---|---|---|---|
| H7020 | 53 | `bleiot/BleIotMaker` — ble+iot | (1,1),(2,1) |
| H7021 | 54 | `bleiot/BleIotMakerV2` — ble+iot | (1,1) |
| H7015 | 62 | `ble/BleMaker` — **ble only** | (1,1) |
| H7016 | 63 | `ble/BleMakerV2` — **ble only** | (1,1) |
| H7041 | 100 | `bleiot/BleIotMakerH7041` — ble+iot | (1,2) |
| H7042 | 102 | `bleiot/BleIotMakerH7042` — ble+iot | (1,2) |
| H7029 | 149 | `ble/BleMakerH7029` — **ble only** | (1,1) |
| H7033 | 161 | `bleiot/BleIotMakerH7033` — ble+iot | (1,1),(1,2) |
| H7030 | 295 | `bleiot/BleIotMakerH7030` — ble+iot | (1,1) |
| H7025 | 296 | `bleiot/BleIotMakerH7025` — ble+iot | (1,1) |
| H702A/H702B/H702C | 316 | `bleiot/BleIotMakerH702ABC` — ble+iot | (1,1) |
| H7026 | 318 | `bleiot/BleIotMakerH7026` — ble+iot | (1,1) |
| H7027 | 337 | `bleiot/BleIotMakerH7027` — ble+iot | (1,1) |
| H3001 | 361 | `ble/BleMakerH3001` — **ble only** | (1,1),(1,2),(1,3),(1,4) |
| H30D01 | 391 | `bleiot/BleIotMakerH30D0` — ble+iot | (1,1) |
| H3010/H3011/H3012/H3013 | 411 | `bleiot/BleIotMakerH3010123` — ble+iot | (1,1) |
| R7015 | 416 | `ble/BleMakerR7015` — **ble only** | (1,1) |

`h7020/pact/Support` registers these in `addSupportPact()`; `Support.M` is the
device-list subset `{62,63,149,361,416}` (the BLE-only ones) and the `keys()`
arrays `Q/R` enumerate the rest. The `h7020` BLE protocol is identical in
sub-mode numbering (`0x15` colour, `0x04` scenes, `0x0A` DIY, `0x13` music,
`0x05` mic) and uses the same GATT UUIDs (`h7020/ble/BleComm.java`).

## 2. Transports & GATT UUIDs

`h7050/ble/BleComm.java`:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

`BleMultiComm` uses the same pair. `h7050/ble/Ble.java` is the `AbsBle` singleton.

IoT uses `ptReal` for all effect writes; simple state uses native `turn`/`brightness`/
`colorwc`. Matter is available on the SKUs marked above (helpers listed in
`adjust/h7063/H7063MatterHelper.java`, `newdetail/h7045/H7045MatterHelper.java`,
`H7057/H7087/H7093/H3501` and `H1630/H351011` configs).

## 3. BLE frame + command table

20-byte frame `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR`.
Single commands write with `0x33`, read with `0xAA`. Multi-controller writes use
`proType=0xA3` (`MultipleControllerCommV1`).

| Command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `01/00` | [0] state | base `SwitchController` |
| brightness | `0x33/0x04` | `0..100` | [0] | base `BrightnessController` |
| mode container | `0x33/0x05` | sub-mode bytes | see §7 | `h7050/ble/ModeController.java` |
| segment setting | `0x33/0x40` | `totalLo totalHi total` | total = bulbNum × perBulb | `h7050/ble/SegmentSettingController.java` |
| power-on order | `0x33/0x30` | `order` | [0] order mode | `h7050/ble/PowerOrderController.java` |
| cut calibration | `0x33/0x44` | `01 f` | [1] cut index | `h7050/ble/CutCaliController.java` |
| bulb-string colour read | `0xAA/0xA5` | `index` | read: `BulbGroupColor.parseBytes` | `h7050/ble/BulbStringColorController.java` |
| multi-music block | `0x33/0x41` | `len code sens …` | multi-colour music layers | `h7050/ble/MultiMusicController.java` |
| secret key write/read | `0x33/0xB2`, `0xAA/0xB1` | key bytes | 16-byte secret; base `SecretKeyController` defaults 0xB2 write / 0xB1 read | `h7050/scenes/BleSecretBuilderV1.java`, `base2light/ble/controller/SecretKeyController.java` |
| install calibration | `0x33/0x39` | `index` | H3501 only (`value_install_calibration_h3501=57`) | `h7050/pact/BleProtocol.java`, `newdetail/h3501/H3501CalibrationAc.java` |
| mic / rhythm | `0x33/0x05` | `05 00 r g b` | `[0]=5,[1]=0,[2..4]=point` | `h7050/ble/MicController.java` |

Multi-controller (`0xA3`) framing, from `base2light/ble/comm/MultipleControllerCommV1`:

- single-controller V1 (`makeSendBytesV1`): `[0]=0xA3 [1]=0 [2]=2 [3]=totalPkts [4]=cmdType [5]=? [6]=? [7..]=verify [15..18]=first 4 payload bytes`, then `[1]=seq` chunks with 17 payload bytes, final packet `[1]=0xFF`.
- V0 (`makeSendBytesV0`): `[0]=0xA3 [1]=0 [2]=0 [3]=pktCount+2 [4]=cmdType`, chunks 17 bytes, final `[1]=0xFF`.
- V2/V3 (`makeSendBytesV2`) prepend `[4]=cmdType [5]=param`; end packet `[1]=0xFF`.

The same `0xA3` frames are what `ptReal` carries.

## 4. BLE notifications / readings

`h7050/ble/BleNotifyComm.java` registers:

| proType | parser | reading |
|---|---|---|
| `0x11` | `WifiNotifyParse` | Wi-Fi connected = `[0]==0` |
| `0x20` | `BrightnessNotifyParse` | brightness = `[0]` (0–100) |
| `0x40` | base `DeviceStatusNotifyParse` | first 10 bytes of status frame |

Controller read-backs (`EventBrightnessNotify`, `EventSegmentSetResult`,
`EventBulbStringColor`, `EventCutCali`) operate on `validBytes` after header strip.

## 5. IoT commands + status / readings schema

Envelope: `Write/AbsCmdWrite`, `IotMsgProType.V0` for simple commands and `V2` for
the switch builder check (`IotSwitchCmdBuilderV1.parseMsg` uses `IotMsgV2` and tests
`cmd=="status"`).

| cmd | data | notes | source |
|---|---|---|---|
| `turn` | `{"val":0|1}` | power | `h7050/iot/CmdTurn.java` |
| `brightness` | `{"val":0..100}` | — | `h7050/iot/CmdBrightness.java` |
| `colorwc` | `{"color":{"r":R,"g":G,"b":B},"colorTemInKelvin":K}` | `color` XOR `colorTemInKelvin` | `h7050/iot/CmdColorWc.java` |
| `ptReal` | `{"command":["<base64 20-byte frame>",…],"isSetDynamic":bool}` | all mode/effect writes | `h7050/iot/CmdPtReal.java` |
| `status` | `{}` | read | `h7050/iot/Cmd.java` |
| `online` | — | event | `h7050/iot/Cmd.java` |
| `state` | — | read reply key | `h7050/iot/Cmd.java` |
| `op` | — | pt/op reply key | `h7050/iot/Cmd.java` |
| `pt` | raw command list | legacy passthrough | `h7050/iot/Cmd.java` |

`Cmd.getCmdReadParseKey(cmd)` returns `"op"` for `ptReal`, else `"state"`.

Status schema is not a typed class in this split; `NewDetailVM` reads `state`
(`onOff`, `brightness`) and `op` (`pt[]` BLE frames) and re-dispatches them into the
BLE controllers above.

## 6. Other protocols

- **Matter**: H7052/H7053 (`H705253MatterHelper`), H7063, H7057, H7087, H7093,
  H7045/H7046, H3500/H3501, H3510/H3511, H1630 (`MatterInterceptor` in their configs).
- **HTTP**: `net/H7020Api.java` (add/device metadata), no LAN/MQTT socket in this split.
- **BLE broadcast discovery**: `add/BleBroadcastProcessor.java`,
  `BleBroadcastProcessorV2.java` (pairing only).

## 7. Dynamic effects / motion / music / scenes / DIY

All effect traffic goes through `ModeController` (cmd `0x05`) and the sub-mode
dispatch in `h7050/ble/Mode.java`.

### 7.1 Colour / segment colour — sub-mode `0x15`

`h7050/ble/SubModeColor.getWriteBytes()`:

| flag | bytes | meaning |
|---|---|---|
| 1 | `15 01 R G B [kLo kHi R2 G2 B2] M0..M3/M5` | whole-strip colour. If temperature `b!=0`: 2-byte kelvin at [5..6] and temp RGB at [7..9]. Mask bytes start at 10; 4 bytes normally, 6 for H7037. |
| 2 | `15 02 colourIndex M0..M3/M5` | apply one colour to masked segments |
| 3 | `15 03 bri0 bri1 …` | per-segment brightness array (max 15) |

Mask bytes are bitfields LSB-first (`ctlLight2byte`). With more than 15 controllers
the app switches to `MultipleColorStripControllerV1` and sends a multi-packet colour
strip instead (`Support.f0 = 15`).

### 7.2 Scenes — sub-mode `0x04`

`SubModeScenes.getWriteBytes()` = `04 effectLo effectHi` (16-bit LE effect code).
Layered/new scenes are sent as an `0xA3` multi-packet blob whose final packet appends
`04 <code LE16>`; the layer blob comes from the cloud scene (`ScenesOp.parseScene`
→ `MultiNewScenesControllerV1..V10`, command byte 1/4/12 depending on version).
`Support.is2NewScenesMode()` / `isMultiScenes()` choose that path.

### 7.3 DIY — sub-mode `0x0A`

`SubModeNewDiy.getWriteBytes()` = `0A codeLo codeHi` (16-bit LE DIY code).
Multi-layer DIY is `0xA3` blob + `0A code` trailer, produced by
`CmdPtReal.getDiyCmdPt*` and `MultipleDiyInScenesController`,
`MultiDiyGraffitiController`, `AbsMultipleControllerV14DiyTemplate`.
H7037 uses `MultipleDiyInScenesController`, H7045/H1630 use graffiti parsers.

### 7.4 Music — sub-mode `0x13`

`h7050/adjust/ParamsSubMode4Music.java` selects the layout per goodsType:

| SKUs | layout |
|---|---|
| default / 227 new-music | `13 code sens` |
| H7065 (113) | `13 code sens [flag if 56/48]` |
| H7055 (116) | `13 code sens [dynFlag if 49]` |
| H6088 (157) | `13 code sens` |
| H7066 (171) | `13 code sens dynamic` |
| H7052/H7053 (218/219) | `13 code sens dynFlag autoFlag 00 00 [R G B]` |
| H7037 (221) | `13 code sens dynFlag autoFlag [R G B]` |

Sensitivity 0–99. Music codes in `h7050/ble/BleProtocol.java`:
`0`/`1` (power/soft), `48` sprout, `49` shiny, `52` piano keys, `56` rhythm,
`72` hopping, `73` rolling, `74` heart-beating, `81` luminous, `99` colorful,
`100` waves. New-music codes 48–55 are flagged by
`base2light/ble/music/AbsNewMusicEffect` (`newMusicCode4RgbList={48,49}`,
`newMusicCode4RgbicList={50..55}`).

Mic mode: `05 00 pointR pointG pointB` (`MicController`), plus `05 01` to enter
(`SubModeMic.getWriteBytes()`).

### 7.5 H7037 / H7045 / H1630 / H7020-group specific

- H7037: scene/DIY use `MultipleDiyInScenesController` with `DiySendData{a,b,c}`
  and `SubModeNewDiy`; scene layers use `H7037DiyParse` sub-effects
  Breath/Chase/Fade/Move/Rainbow/Retrace/Spray/Xiaoxiole.
- H7045/H7046: music feast + `H7045AdvancedParse` / `H7045GraffitiParse`,
  effect types in `newdetail/h7045/mode/diy/effect/EffectTypeH7045.java`
  (Normal, DriftFog, Dyeing, Fantasy, Flowing, Separate, StarLight) with
  `Direction` and `LineWidth` parameters.
- H1630: graffiti `H1630DiyProGraffitiParse`, layers
  CaiHong/DuiJi/FengChe/HuXi/HuanCai/JianBian/LiuGuang/LiuShui/LuoXuan/PaoMaDeng/
  ShanShuo/ShenShuo/TiaoYue/XingKong/YaoBai.
- H7020 group: `h7020/ble/SubModeMusic{,V2}` adds new-music codes
  `value_sub_mode_new_music_rhythm=3`, `spectrum=4`, `energy=5`, `scroll=6`;
  H7033/H7041 have their own new-music lists (`isH7033NewMusicCode`,
  `isH7041NewMusicCode`); H7025/H7027/H30D01/H3010123/H702ABC have dedicated
  DIY configs in `h7020/newDetail/**`.

### 7.6 Colour-temperature ranges

`Support.getColorTemRange()`:

- 2700–6500 K: 76, 157, 227, 274, 275, 289, 305, 290, 315, 338, 393, H3200
- 2200–6500 K: 77, 116, 171, 98, 107, 113
- 1000–10000 K: H3510/H3511 (349), H1630 (364)
- 2000–9000 K: H7050 (46), H7051 (105), H7037 (221)

## 8. Source map (traced)

- SKU registry: `h7050/pact/{Support,SubMaker,Comm}.java`,
  `h7050/pact/bleiot/BleIotMaker*.java` (27 makers), `pact/deviceitem/SubLib.java`;
  `h7020/pact/{Support,SubMaker,SubLib}.java`,
  `h7020/pact/bleiot/BleIotMaker*.java` (BLE+IoT), `h7020/pact/ble/BleMaker*.java`
  (BLE-only: H7015/H7016/H7029/H3001/R7015).
- BLE: `h7050/ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol}.java`,
  `h7050/ble/{Mode,ModeController,SubMode*}.java`,
  `h7050/ble/{SegmentSettingController,PowerOrderController,CutCaliController,
  BulbStringColorController,MicController,MultiMusicController}.java`;
  parallel `h7020/ble/*` with the same sub-mode numbering.
- Music variants: `h7050/adjust/{ParamsSubMode4Music,v3,v7,v8,v9,h7037,h7053,h7066}`.
- Scenes/DIY: `h7050/pact/Comm.java`, `h7050/iot/CmdPtReal.java`,
  `h7050/pact/bleiot/AbsEffectOp4BleIot.java`.
- IoT: `h7050/iot/{Cmd,CmdTurn,CmdBrightness,CmdColorWc,CmdPtReal}.java`,
  `h7050/scenes/Iot*CmdBuilderV1.java`.
- Effects: `h7050/newdetail/**/diy/*` (H7037, H7045, H1630, H7025, H30D01, H702abc).
- Notifications: `h7050/ble/{WifiNotifyParse,BrightnessNotifyParse}.java`.

## 9. Gaps / unknowns

- Scene effect IDs and layer blobs are cloud-supplied (`ScenesM`/`ScenesOp`), not
  statically enumerable in the split. Only the container (`04 <LE16>` + `0xA3`
  layer blob) is fixed.
- DIY code values are likewise cloud/local templates; the 16-bit trailer is fixed.
- `MultipleControllerCommV1` has several framing versions (V0/V1/V2/V3/MTU); the
  family chooses one per controller (`AbsMultipleControllerV1.p()`); byte-level
  framing for V1 is documented above, V0/V2/V3 differ in header fields.
- H7038/H7039 are aliases of H7037 (only theme icons differ).
- `getColorPieceSize` for H3510/H3511 is derived from IC count at runtime.
- The `h7020` group's five BLE-only SKUs (H7015/H7016/H7029/H3001/R7015) still
  register `GoodsType.beProtocol` pairs in `pact.a(...)`, but their maker extends
  `AbsBleSku`, so no cloud path is created in-app.
- H3001 also declares (1,2)/(1,3)/(1,4); the maker is still BLE-only.


---

<!-- split_pact_h705a -->

# split_pact_h705a — ceiling lights, downlights, H706x/H805x bulb strings, H3401

Source root: `decompiled/jadx-splits/split_pact_h705a/sources/com/govee/h705a/`.

This split covers the "H705/H706/H805/H806/H608/H808/H3401" light family: ceiling lights,
downlights, bulb strings and a segmented H3401 lamp. All SKUs use the same 20-byte BLE frame and
the standard Govee GATT pair; per-SKU differences are segment count, colour-temp range and the
DIY/music engine.

| goodsType | SKU(s) | product | colour-temp | segments | transports |
|---|---|---|---|---|---|
| 125 | H705A, H705B | Ceiling light | 2000–9000 K | 4 colours/group | ble + iot |
| 180 | H706A, H706B, H706C | Ceiling light | 2200–6500 K | from `SegmentIcDataConfig` | ble + iot |
| 184 | H806A, H806C, H801B | Ceiling light | 2000–9000 K | 5 colours/group | ble + iot + matter (H608/H808 family) |
| 240 | H705D, H705E, H705F, H805A, H805B, H805C, H805D, H608A, H808A | Ceiling / downlight | 2700–6500 K | 4 colours/group | ble + iot + matter (H608A/H808A) |
| 250 | H7067, H7068, H7069 | Bulb string / light string | 2700–6500 K | `ic` driven | ble + iot |
| 394 | H3401 | Segmented lamp | 1000–10000 K | `ic` driven | ble + iot |

Registration (`pact/Support.a()`): 125 `(1,1),(1,2)`; 180 `(1,1),(1,2),(2,1)`;
184 `(1,1),(2,1)`; 240 `(1,1),(1,2),(2,1)`; 250 `(1,1)`; 394 `(1,1)`.
`SubMaker` emits H705aItem, H706ABCItem, H608aItem, H705DEFH805ABCItem, H70676869Item,
H3401Item. `h705a/Cons` and `H705aApplication` register the module.

---

## 1. Transports & GATT UUIDs

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `ble/BleComm.java` static `P`/`Q`, `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`.
`Ble` is a standard `AbsBle` with `CommEventGattCallback`, a `BlePtRealMultiComm`
(`u()`), and multi-comm. H608A/H808A additionally support Matter commissioning via
`matterconfig/H808aMatterHelper` (goodsType 184; H608A soft ≥1.00.10, H608B/C ≥1.00.11,
H608D ≥1.00.18, H808A ≥1.00.19, hard 3.05.00, wifi soft 1.01.17, wifi hard 1.04.01).

---

## 2. BLE frame + command table

`AbsModeController` uses cmdType `0x05` for all mode payloads; colour/music/scene/DIY are
sub-modes carried inside the mode payload.

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] 1..100` | base `BrightnessController` |
| mode / colour | `0x33/0x05` | sub `0x15`, 17-byte layout below | `mode/color/SubModeColor.java` |
| music | `0x33/0x05` | sub `0x13` | `mode/music/SubModeMusic.java` |
| scene | `0x33/0x05` | sub `0x04` | `mode/scenes/SubModeScenes.java` |
| DIY | `0x33/0x05` | sub `0x0A` | `mode/diy/SubModeNewDiy.java` |
| IC count / segment check | `0x33/0x43` | `[0] mode, [1] index, [2] count` | `ble/controller/CheckIcController.java`, `BleProtocol.i=67` |
| cut calibration | `0x33/0x44` | `[0] 0/1/2`; mode 2 adds `[1] index,[2] count` | `ble/controller/CutCaliController.java`, `BleProtocol.j=68` |
| IC setting / segment num | `0x33/0x40` | `[0] value` | `ble/controller/ICSettingController.java`, `IcSegmentNumController.java`, `BleProtocol.f=64` |
| segment setting | `0x33/0x0F` | `[0] value` | `ble/controller/SegmentSettingController.java`, `BleProtocol.h=15` |
| multi segment IC write | multi | bytes from `SetSegmentIcMultiController.p()` with cmdType variable | `ble/controller/SetSegmentIcMultiController.java` |
| colour strip compose | `0x33/0x05` | `ColorPosSetController` / `BrightnessPosSetController` payload: `[0]=0x15, [1]=4/3, [2]=index, mask/RGB` | `ble/controller/ColorStripComposeController.java` |
| notify IC | notify `0x21` | `[0..1] IC LE16, [2] segment` | `ble/CheckIcNumParse.java`, `BleProtocol.g=33` |
| device info notify | notify `0x30` | `[0]==1`, `[1]` bit1 = on | `ble/notify/DeviceInfoNotifyParse.java` |

`BleProtocol` (`h705a/ble/BleProtocol.java`): sub music `0x13`, sub colour `0x15`, sub scene
`0x04`, sub DIY `0x0A`, IC setting `0x40`, notify IC `0x21`, segment setting `0x0F`, check IC
`0x43`, cut cali `0x44`, cut cali V2 `0x46`. (`0x43` is the check-IC write/response; `0x44` is cut-calibration; `0x46` (`k`) is the V2 cut-calibration variant.)

### Colour payload (`SubModeColor.getWriteBytes`, 17 bytes)

```
[0] = 0x15
mode 1: [1]=1 [2..4]=R G B [5..6]=Kelvin LE16 [7..9]=temp RGB [10..14]=5-byte segment mask (up to 40 segments)
mode 2: [1]=2 [2]=brightness [3..7]=5-byte segment mask
```
`parse()`: `[0]` mode; `[1..2]` Kelvin LE16.

### Music payload (`SubModeMusic.getWriteBytes`)

```
sub 0x13: [1]=music code [2]=sensitivity 0..99 [3]=mode (0x01) [4]=auto flag [5..7]=RGB
new multi-music short form: 13 <code> <sens>
```
New multi-music codes (`mode/music/MusicParams4H705A.b()`):
`49 (Cuican), 74 (Tiaodong), 72 (Yuedong), 81 (Liuying), 113 (Gundong), 50, 51, 52, 53, 55, 48`.
H706A/B/C use `CuiCanMusic4H706a` for code 49.

### Scenes / DIY

`04 epLo epHi`, `0A diyLo diyHi` — 16-bit LE. Scene op set is `{0,1,2,3}` for all SKUs.

---

## 3. BLE notifications / readings

| reading | op | layout | source |
|---|---|---|---|
| IC / segment | `0x21` | `[0..1]` LE16 IC count, `[2]` segment count | `ble/CheckIcNumParse.java` |
| light status | `0x30` | `[0]==1`, `[1]` bit1 = on | `ble/notify/DeviceInfoNotifyParse.java` |
| WiFi connect | `0x11` | `[0]==0` connected | base `WifiNotifyParse` |
| heart | `0x01` | base `HeartController` | `ble/BleComm` |
| check-IC result | `0x43` | `[0..1]` IC count, `[2]` segment | `CheckIcController.parseValidBytes` |
| cut-cali result | `0x44` | `[0] result, [1] index, [2] count` | `CutCaliController` |
| segment num | `0x40` | `[0..1]` LE16 IC count, `[2]` segment count | `IcSegmentNumController` |
| segment setting | `0x0F` | `[0] value` | `SegmentSettingController` |

No temperature/humidity sensors in this split.

---

## 4. IoT commands + status/readings schema

Envelope **`IotMsgV2`**. This split has **no per-family `iot/Cmd*.java`**; `pact/Comm` uses the
base `com.govee.base2light.iot` commands:

| cmd | data | response | source |
|---|---|---|---|
| `turn` | `{"val":0\|1}` | `state` | base `CmdTurn` |
| `brightness` | `{"val":1..100}` | `state` | base `CmdBrightness` |
| `colorwc` | `{"color":{"r","g","b"},"colorTemInKelvin":int}` | `state` | base `CmdColorWc` |
| `ptReal` | `{"command":["<base64 20-byte>",...]}` | `op.pt[]` | base `base2light.pact.iot.CmdPtReal` |

`pact/Comm.i()` builds DIY `ptReal` from a `DiyProtocol`/`DiyGraffitiV2`/`DiyTemplate`/
`DiyStudio`/`DiyAi`/`DiySendData`, always appending the final mode frame. `Comm.k()` builds a
**part-scene** `ptReal`: it groups `SegScenes` by `sceneCode`, builds a 16-bit segment mask
(`boolean[16]`), emits `PartScenesViewModel` scene writes, then appends `SubModePartScenes`
(`segId` + 5-byte per-segment selector). Max 19 commands for graffiti.

`Op*CommDialog4BleIot` / `Square` variants choose BLE+MQTT when the device has a topic,
otherwise IoT `ptReal`.

Status: base `state`/`op` schema; `op.pt[]` frames are decoded and parsed by the same BLE
parsers (IC count, colour, music, scenes). No additional sensor fields.

---

## 5. Other protocols

- **Matter** — H608A/B/C/D + H808A (goodsType 184) commissioning via
  `matterconfig/H808aMatterHelper`; version-gated. Runtime control stays BLE/IoT.
- **WiFi/LAN** — `Support.t()` registers dynamic-domain names H706A/H806A/H706B/H706C/H7067/
  H7068/H7069/H608A/H3401. MQTT capability is base `DeviceCommCapability`.
- **HTTP** — add/bind and OTA APIs in base; no family-specific net service here.
- **Multi-segment IC** — `SetSegmentIcMultiController` / `SegmentIcDataConfig` write the per-IC
  segment map; `h706abc/GraffitiSegmentSetAc` provides the UI.
- **No IR/RF/Thread** in this split.

---

## 6. Dynamic effects / music / scenes / DIY

- **Colour**: sub `0x15`, mode 1 RGB+kelvin+temp RGB+segment mask (up to 40 segments); mode 2
  brightness+mask.
- **Music**: sub `0x13`; new multi-music codes listed above; H706A/B/C special-case code 49.
- **Scenes**: sub `0x04`, 16-bit LE effect. Scene op set `{0,1,2,3}`.
- **DIY**: sub `0x0A`, 16-bit LE code, built by the DIY-new engine (`Sub4Diy`/`SubModeNewDiy`).
  H7067/8/9 sub-effects (`h706789/diy/subEffect/*`):
  BianHuan, BinFen, Breath, CaiQiang, Fade, Glimmer1/2, MengHuan, Mirror, Rainbow1/2, Ripple,
  Sawing1/2. H608A GIF sub-effect ids **1..18** (`adjust/h608a/SubEffectGifConfig`).
  H3401 uses the generic `DiyNewConfig` manager and segment/zone effects.
- **Segment colour**: `ColorStripComposeController` sends `15 04 idx RGB×4` (group) or
  `15 03 idx brightness[14]`; the `ColorPosSetController`/`BrightnessPosSetController` wrap
  these with a segment mask.
- **No motion/gradient direction attributes** exposed in this split; H3401 zones are static
  segment maps.

---

## 7. Source map (traced)

- Registration/SKUs: `pact/{Support,SubLib,SubMaker,Register4Item,Model,H*Item}.java`
- Transport: `ble/{Ble,BleComm,BleMultiComm,BleNotifyComm}.java`, `ble/notify/*`
- Mode/sub-modes: `mode/{Mode,ModeController}.java`, `mode/color/SubModeColor.java`,
  `mode/music/{SubModeMusic,MusicParams4H705A}.java`, `mode/scenes/SubModeScenes.java`,
  `mode/diy/SubModeNewDiy.java`
- Controllers: `ble/controller/{CheckIcController,CutCaliController,ICSettingController,
  IcSegmentNumController,SegmentSettingController,SetSegmentIcMultiController,
  ColorStripComposeController}.java`
- IoT: `iot/Op*CommDialog4BleIot*.java`, `pact/Comm.java`
- Per-SKU UI: `h3401/*`, `h706789/*`, `h608a/*`, `newDetail/*`, `adjust/v1/*`
- Matter: `matterconfig/H808aMatterHelper.java`

## 8. Gaps / unknowns

- `Support.b()` returns segment group size by goodsType/IC count; for 180 it reads
  `SegmentIcDataConfig` at runtime, so exact per-device segment counts are not static.
- H705A/H7067/H3401 DIY effect-code universes are managed by the base DIY-new engine; only the
  sub-effect class set and H608A GIF ids 1..18 are explicit here.
- `BleProtocol` exposes `0x43` (check-IC), `0x44` (cut-calibration) and `0x46` (cut-calibration V2); the
  write payload shape is `[mode,index,count]` but per-mode semantics vary by UI flow.
- Part-scene `SubModePartScenes` payload is built from `segId` + a 5-byte selector; the exact
  scene-body bytes come from `PartScenesViewModel` and are runtime/scene-server driven.
- Matter clusters/attributes are not in this split (commissioning only).


---

<!-- split_pact_h7075 -->

# split_pact_h7075 — downlights, floodlights, COB strips, wall washers, R3352 sensor lights

Source root: `decompiled/jadx-splits/split_pact_h7075/sources/com/govee/h7075/`.

One of the largest light splits. It contains **ten pact sub-families** that share the same BLE
builder set, colour sub-mode and IoT V2 envelope, but differ in segment count, colour-temp range,
DIY engine and extra features (motion, splicing, light sensor, auto-dimming, online music).

| goodsType | SKU(s) | product | colour-temp | transports / extras |
|---|---|---|---|---|
| 205 | H7075 | Smart LED downlight | 2700–6500 K | ble + iot + matter (commissioning) |
| 245 | H7078 | Smart floodlight / wall washer with motion | 2700–6500 K | ble + iot + motion + splicing |
| 294 | H7072 | COB strip / light bar with brightness sensor | 2700–6500 K | ble + iot + light sensor + auto-dim |
| 313 | H7076 | RGBIC wall-washer / graffiti light | 2700–6500 K | ble + iot |
| 326 | H707A, H707B, H707C, R707A/B/C | Matrix / segment light | 2700–6500 K (1000–10000 K on wide-Kelvin variant) | ble + iot |
| 354 | H3751 | Light bar / combine device | 1000–10000 K | ble + iot + multi-device combine |
| 371 | H3351 | Strip light with gear brightness | 1000–10000 K | ble + iot |
| 396 | H2800 | Wall light / online-music light | 2700–6500 K | ble + iot |
| 383 | H3700 | Dual-zone light (top/bottom) | 1000–10000 K | ble + iot + matter wifi batch |
| 413 | R3352 | Light-sense / auto-dimming light | 1000–10000 K | ble + iot + light sensor |

Registration: `pact/Support.addSupportPact()` registers 205 `(1,1),(2,1),(3,1)`; 245 `(1,1),(2,1)`;
294 `(1,1),(1,3)`; 383 `(1,1)`. Lazy registrations add 313 `(1,1)` and 326 `(1,1),(2,1),(3,1)`.
`SubMaker` emits all ten `ItemH*` makers. Colour sizes: 205→3, 245→4, 294→6, 313/383→4,
413→2, otherwise 1.

---

## 1. Transports & GATT UUIDs

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `mode/*` use the shared `AbsBle`/`AbsBleComm`; `ble/Ble.java` overrides the notify comm
and multi-comm. `pact/MatterSupport` installs a `MatterInterceptor` for goodsType 205 when
versions ≥ soft 1.00.11 / hard 3.05.01 / wifi soft 1.01.17 / wifi hard 1.04.01.
`pact/BatchMatterWifiConfig` allows batch Matter+WiFi provisioning for goodsType 383.

BLE frame: 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` (base
`AbsController`). Segment writes that exceed 17 bytes use `AbsMultipleController` /
`MultipleBleBytes` (20-byte chunks, `0xA3`/`0xA4` proType).

---

## 2. BLE frame + command table

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] level 1..100` | base `BrightnessController` |
| mode | `0x33/0x05` | sub-mode payload below | `mode/Mode.java`, `mode/ModeController.java` |
| colour | sub `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask[4]` (17 B, mode 1); `15 02 level mask[4]` (mode 2); `15 03 brightness[14]` (mode 3); `15 04 groupRGB(4×3)` (mode 4) | `mode/color/SubModeColor.java` |
| mic / music-reactive | sub `0x05` | `05 01` | `mode/mic/SubModeMic.java` (no `0x13` music sub-mode in this family) |
| scene | sub `0x04` | `04 effectLo effectHi` | `mode/scenes/SubModeScenes.java` |
| new DIY | sub `0x0A` | `0A diyLo diyHi` | `mode/diy/SubModeNewDiy.java` |
| IC check | `0x33/0x43` | `[0] start? ,[1] count?, [2] segment?` (CheckIcController q) | `h61d3`-style; this split `ble/BleProtocol.CHECK_IC=67` |
| cut calibration | `0x33/0x44` (V1) / `0x46` (V2) | `[0] 0/1/2`, `[1] index`, `[2] count` | `BleProtocol.CUT_CALI/CUT_CALI_V2`; `h7075/h7078/controller/*`, `h705a`-shared |
| connector / splicing | `0x33/0x40` | `{2,0}` exit/query; `{2,1,R,G,B}` set group colour; `{count}` device count | `h7078/controller/SplicingController.java`, `SplicingNewController.java` |
| change splicing (multi) | `0x5F` | multi-packet: `[idx][direction mask][MAC×6]...` | `h7078/controller/ControllerChangeSplicing.java`, `BleProtocol.MULTI_DEVICE_SPLICING=95` |
| read splicing state | `0xAA/0x4B` | empty | `Controller4ReadSpliceState` (cmd 75) |
| read sub-device version | `0xAA/0x4C` | empty | `ControllerReadSubDeviceVersion` (cmd 76) |
| motion switch | `0x33/0x47` | payload per `MotionMode*` (toggle/enter) | `Controller4MotionSwitch` (cmd 71), `BleProtocol.SINGLE_MOTION_SWITCH` |
| motion delete | `0x33/0x48` | `MotionConstants.a.e(id)` (4-byte id LE) | `Controller4DeleteMotion` (cmd 72) |
| exit motion preview | `0x33/0x49` | empty | `Controller4ExitMotionPreview` (cmd 73) |
| stop light effect | `0x33/0x25` | `01` | `Controller4StopLightEffect` (cmd 37) |
| install direction | `0x33/0x16` | `[0] 1/2` | `BleProtocol.SET_INSTALLATION_DIRECTION=22` |
| read segment light | `0xAA/0xA1` | index payload | `BleProtocol.READ_SEGMENT_LIGHT=-95` |
| read/notify IC | notify `0x21` | `[0..1] IC LE16`, `[2] segment count` | base `CheckIcNumParse` |
| brightness notify | notify `0x20` | `[0] brightness` | base `BrightnessNotifyParse` |
| motion info read | `0xAA/0x05` | empty; response `[0] groupCount`, then `groupCount × 6` bytes: `motionId` LE32 + `versionCode` LE16 | `h7078/controller/MotionReadInfoController.java`, `motion/MotionConstants.java` |
| light sensor (H7072) | `0xAA/0x4B` | empty read; response `BrightnessInfo` (env low/high/cur, device low/high, switch, schedule) | `h7072/sensor/BrightnessController.java`, `BrightnessInfo.java` |
| light-sense model (R3352) | `0x33/0x24` | `[0] 0x24 [1] enable [2] min gear 0..3 [3] max gear 0..3 [4] all-day [5..6] time LE16` | `r3352/protocol/R3352LightSenseInfo.java`, `R3352SensorProtocol.b=36` |
| auto-dimming (R3352) | `0x33/0x25` | `[0] 0x25 [1] enable [2] min brightness 1..100 [3] max [4] effect-time index` | `r3352/protocol/R3352AutoDimmingInfo.java` |
| H3351 gear brightness | `0x33/0x04` | brightness level only (gear slider remaps) | `h3351/sensor/GearBrightnessSliderView` |
| H2800 online music | `0xA3` multi | scene controller with commandType 0x58 + studio scene bytes | `h2800/H2800OnlineMusicConfig.java` |

### Motion payload encoding (H7078)

`MotionConstants.d(sceneDeviceBean)` builds the motion effect body:

```
sceneCode LE16 | musicCode LE16 | commandType | bodyLen LE16 | body
```

If the scene controller's commandType is 12 (`0x0C`) the first byte of `getValue()` is used as the
command type and the rest as body. Motion IDs are 4-byte little-endian; version codes are 2-byte
little-endian (`MotionDeviceInfo`).

### Splicing

- `SplicingController`/`SplicingNewController` (0x40): payload `02 00` (exit/query) or
  `02 01 R G B` (set spliced group colour).
- `ControllerChangeSplicing` builds a `MultiController` with commandType
  `MULTI_DEVICE_SPLICING=0x5F`: `[index][direction][MAC...]`.
- `Controller4ReadSpliceState` (0x4B) returns `[0]==1` spliced.

---

## 3. BLE notifications / readings

`AbsController.m()` strips the 20-byte header. Notifications are dispatched by `cmdType`:

| reading | op | layout | source |
|---|---|---|---|
| brightness | `0x20` | `[0]` | base `BrightnessNotifyParse` |
| IC / segment count | `0x21` | `[0..1]` LE16 IC count, `[2]` segment count | base `CheckIcNumParse` |
| device status | `0x30` | `[0]==1`, `[1]` bit1 = light on | `DeviceStatusNotifyParse` |
| splice state | `0x4B` | `[0]==1` | `Controller4ReadSpliceState` |
| motion devices | `0x05` | groupCount + 6-byte records | `MotionReadInfoController` |
| brightness sensor | `0x4B` | `BrightnessInfo` (see below) | `h7072/sensor/BrightnessInfo` |
| light sense | `0x24` | `[0] enable,[1] minGear,[2] maxGear,[3] allDay,[4..5] time` | `R3352LightSenseInfo` |
| auto dimming | `0x25` | `[0] enable,[1] min,[2] max,[3] effectTime` | `R3352AutoDimmingInfo` |
| sub-device version | `0x4C` | ASCII/version bytes | `ControllerReadSubDeviceVersion` |
| heart | `0x01` | base `HeartController` | `mode/*` |

`BrightnessInfo` fields: environment low/high/current brightness, device low/high brightness,
switch state (0 off, 1 on, 2 outside threshold), start/end hour/minute, day bitmask, all-time
flag, auto-close-light flag, effect-time bean, timestamp. Sensor read is `0x4B`.

---

## 4. IoT commands + status/readings schema

Envelope **`IotMsgV2`** (all `Iot*CmdBuilder` return `IotMsgProType.V2`). Commands:
`turn {val}`, `brightness {val}`, `colorwc {color,colorTemInKelvin}`, `ptReal {command:[base64]}`,
`status`, `online`. No family-specific `iot/Cmd*.java`; `pact/Comm` uses base
`CmdTurn/CmdBrightness/CmdColorWc` and base `CmdPtReal`.

| cmd | data | response | source |
|---|---|---|---|
| `turn` | `{"val":0\|1}` | `state` | base `CmdTurn` |
| `brightness` | `{"val":1..100}` | `state` | base `CmdBrightness` |
| `colorwc` | `{"color":{"r","g","b"},"colorTemInKelvin":int}` | `state` | base `CmdColorWc` |
| `ptReal` | `{"command":["<base64 20-byte>",...]}` | `op.pt[]` | base `base2light.pact.iot.CmdPtReal` |
| `status` | `{}` | `state/op` | base `AbsDeviceModel4BleIot` |

`ptReal` builders: DIY protocol (`getDiyCmdPt`), graffiti (`getDiyCmdPt4DiyGraffiti`), DIY
studio/template (`getDiyTemplateCmdPt`), new scenes (`getNewScenesCmdPtReal`), DIY send-data.
Large graffiti is capped at 19 commands; larger effects fall back to `ptUrl` in the base library.
Status parsing is base `state/op` + per-frame parsers; motion/sensor sub-records are exposed by
the respective controllers.

---

## 5. Other protocols

- **Matter** — `pact/MatterSupport` (goodsType 205, version-gated) and
  `pact/BatchMatterWifiConfig` (goodsType 383). Commissioning only; runtime control is BLE/IoT.
- **WiFi/LAN** — `Support.setDynamicApi()` registers dynamic-domain names H7075/H7078/H7072/H3700
  for LAN routing; MQTT capability comes from base `DeviceCommCapability`.
- **HTTP** — `h7078/network/DeviceApi` (device list, splice info, sub-device soft version check),
  OTA check endpoints in base.
- **Multi-device combine** — `h3751/combine/CombineDeviceController` (H3751), splicing 0x40/0x5F.
- **Camera/vision** — H7078 motion mode uses motion device records; no camera stream in this split.
- **Online music** — H2800 `H2800OnlineMusicConfig` sends a scene controller with an embedded
  studio scene (`commandType 0x58`).

---

## 6. Dynamic effects / motion / music / scenes / DIY

### Colour sub-mode `0x15` (all SKUs)

17-byte `getWriteBytes()`:

| mode | bytes |
|---|---|
| 1 RGB+temp | `15 01 R G B kelLo kelHi R2 G2 B2 m0 m1 m2 m3` (mask = 32 segments across 4 bytes; 24/32 used depending on colour size) |
| 2 brightness | `15 02 level m0 m1 m2 m3` |
| 3 per-segment brightness | `15 03 idx b0..b13` (14 brightness bytes) |
| 4 per-group RGB | `15 04 group idx R G B ×4` (12 bytes) |

Parse (`parse`): `[0]` type, `[1..2]` Kelvin LE16 if type 1.

### Mic / music-reactive sub-mode `0x05`

`05 01` (enter mic/sound-reactive mode). This family declares `BleProtocol.sub_mode_music=0x13`
but has no `mode/music` sub-mode class and `Mode.parseSubMode` never dispatches `0x13`; music UI
is implemented as the mic mode. There is no per-effect music code/sensitivity payload here.

### Scenes `0x04` / DIY `0x0A`

`04 epLo epHi`, `0A diyLo diyHi` — 16-bit LE effect/Diy codes. Scene op sets:
H7076/H2800 `{0,1,2,3,5,6}`, H3700 `{0,1,2,3,6}`, others `{0,1,2,3,5}`.

### DIY / effect code universes

| SKU group | effect codes | protocol code | source |
|---|---|---|---|
| H7075 | DIY rainbow/basic pages; `EffectOp4BleIot` | `0x56` (86) | `adjust/h7075/diy/H7075DiyParse.java` |
| H7072 | `765` + `0` placeholder | base DIY | `h7072/diy/H7072DIyConfig.java` |
| H7076 | base DIY config (`0` placeholder) + graffiti | base / server | `h7076/mode/diy/H7076DiyConfig.java` |
| H7078 | base DIY config (`0`), block/rainbow sub-effects | base / server | `h7078/diy/H7078DiyConfig.java`, `H7078DiyParseRainbow.java` |
| H707A/B/C | base DIY config (`0`), advanced effects (breath/flow/fireworks/yuedong) | `0x58` for advanced/graffiti | `h707A/mode/diy/*` |
| H3751 | base DIY new config (`0`), layered graffiti | base / server | `h3751/diy/H3751DiyNewConfig.java` |
| H3351 | base DIY new config (`0`) | base / server | `h3351/H3351DiyNewConfig.java` |
| H2800 | `960` basic, `963` graffiti, `0` none | `0x58` for studio scene | `h2800/diy/H2800DiyNewConfig.java`, `H2800OnlineMusicConfig.java` |
| H3700 | `999` simple, `9998` sub-effect, `10001` advanced | `0x58` (simple/advanced), `0x00` sub | `h3700/H3700DiyConfig.java`, `h3700/diy/*` |
| R3352 | base DIY new config (`1..N` sub effects) | base / server | `r3352/R3352DiyNewConfig.java` |

H7076/H707A/H7078 sub-effect classes: `SubEffectGifConfig` (1..18), `SubEffectConfig`,
`EffectTypeH707A` / `SubEffectType` (collision, diffusion, fireworks, flow, yuedong), block
colour + rainbow for H7078. H3700 has a tuple codec (`H3700DiyCodec`, `BottomEffectData`,
`BottomMotionData`, `BottomPartitionData`, `TopOrSameEffectData`, `ColorPairData`) for its
top/bottom zones.

### Motion (H7078)

Motion IDs 4-byte LE; version 2-byte LE. Motion effects carry `sceneCode LE16 | musicCode LE16 |
commandType | length LE16 | body`. Motion switch `0x47`, delete `0x48`, exit preview `0x49`,
read info `0x05`; motion preview exit notify `0x49`. Timer and brightness thresholds are local
`MotionTimer`/`MotionLightThresholdSliderView` values.

---

## 7. Source map (traced)

- Registration/SKUs: `pact/{Support,SubLib,SubMaker,Register4Item,Model,MatterSupport,BatchMatterWifiConfig}.java`,
  `pact/ItemH*.java`, `pact/R3352{DeviceItem,Model}.java`
- Transport/mode: `ble/Ble.java` (base `AbsBle`), `mode/{Mode,ModeController}.java`,
  `mode/color/SubModeColor.java`, `mode/mic/SubModeMic.java`, `mode/scenes/SubModeScenes.java`,
  `mode/diy/SubModeNewDiy.java`
- H7078 motion/splicing: `h7078/controller/*`, `h7078/motion/*`, `h7078/diy/*`
- H7072 sensor: `h7072/sensor/{BrightnessController,BrightnessInfo,EffectTime}.java`
- H7076/H707A: `h7076/mode/diy/*`, `h707A/mode/diy/*`, `h707A/setting/*`
- H3700: `h3700/*`, `h3700/diy/codec/*`
- H3751/H3351/H2800: `h3751/*`, `h3351/*`, `h2800/*`
- R3352: `r3352/*`, `r3352/protocol/*`

## 8. Gaps / unknowns

- Scene effect IDs are cloud (`ScenesM`) values; only op sets/defaults are static.
- `BleProtocol.sub_mode_music=0x13` is declared but unused; H7075 has only the mic sub-mode `0x05`.
- `Support.getColorSize` is goodsType-based; H707X per-device segment counts come from
  `SegmentIcDataCache` (runtime).
- H7075/H7076/H7078/H707A/H3751/H3351/R3352 DIY effect-code lists are largely server/base-config
  driven; only H7072/H2800/H3700 expose explicit integers here.
- The exact `CheckIcController`/`CutCaliController` payload semantics for this split are shared
  with the H705A code base; only the opcodes (0x43/0x44/0x46) and the general `[mode,index,count]`
  shape are certain.
- H3351 gear-brightness mapping is UI-side (`GearBrightnessSliderView`); device payload is plain
  brightness.
- Matter clusters/attributes are not in this split (commissioning only).
- H7078 motion timer/threshold payloads are runtime structures (`MotionTimer`, `MotionMode*`),
  not fully expanded to fixed bytes.


---

<!-- split_pact_h70b1 -->

# split_pact_h70b1 — curtain / icicle / spliceable matrix lights (H70B1/B2/BC, H70B3-5, H6800/681x, H70B6/B8, H70D1-3)

Source root: `decompiled/jadx-splits/split_pact_h70b1/sources/com/govee/`.

This is the largest split: **five pact sub-families** sharing a handful of BLE builders and a
common `MultiController` DIY/scene transport.

| package | goodsType | SKU(s) | product | transports |
|---|---|---|---|---|
| `h70b1/origin` | 134 / 185 / 216 | H70B1, H70B2, H70BC | Smart Curtain Lights / 400LED Curtain | **ble + iot** |
| `h70b3` | 229 / 230 / 231 | H70B3, H70B4, H70B5 | Curtain Lights | **ble + iot + matter pairing** |
| `h70b3` | 255 / 256 | H6810, H6811 | Curtain/matrix (spliceable) | **ble + iot + matter** |
| `h70b3` | 272 | H6800 | Matrix/curtain (interactive game mode) | **ble + iot + matter** |
| `h70b6` | 329 | H70B6 | Curtain Lights Pro | **ble + iot + wifi/mqtt + matter** |
| `h70b8` | 341 | H70B8 | Lightwall | **ble + iot + wifi/mqtt + matter** |
| `h70dx` | 267 / 268 / 269 | H70D1, H70D2, H70D3 | Icicle Lights | **ble + iot + matter** |

Matter pairing additionally names `H70C4..H70C9` and `H80C4` in the H70B3 matter `MatterConfig`
(`h70b3/add/AddDeviceM.java`). `H70B2` (185) is in `Support.f` but has no dedicated detail config;
it uses the H70B1 origin protocol plus Mtu/ptUrl helpers (`h70b2/origin/*`).

---

## 1. Transports & GATT UUIDs

Common vendor GATT pair in all sub-families:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `h70b1/origin/ble/BleComm.java`, `h70b3/ble/BleComm.java`, `h70b3/ble/Ble.java`
(also has static `t`/`u` UUIDs and MTU callback), `h70dx/ble/Ble.html` (uuid via
`BleCommUUID`), `h70b6` uses `h70b3.ble.Ble`.

**Important:** `h70b3/ble/Ble.r()` returns `com.govee.matter.pact.BleComm`, so H70B3/H70B6/H70B8
share the matter-aware BLE comm. Matter pairing frames are proType `0xAB`, cmdType `0x01..0x06`
(see §7).

BLE frame: 20 bytes, `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`.
Larger DIY/scene payloads are split by `MultipleControllerCommV1.makeSendBytesV3(...)` /
`MultipleBleBytes` and sent as `0xA3`/`0xA4` chunks (20 bytes each), with the final mode frame
appended.

---

## 2. H70B1 origin (134 / 185 / 216)

Pact registration (`h70b1/origin/pact/Support.addSupportPact`):
- 134: `beProtocol(1,1)` and `(2,1)`
- 185: `beProtocol(1,1)`
- 216: `beProtocol(1,1)` and `(2,1)`

`Support.getColorTemRange() = {1000,10000}` K. Scene op set `{0,1,5}`. Splicing share-code set
(`Support.b`) = `{36, 37, 42, 43, 53, 54}`; per-UI DIY share codes are
`{24, 36, 83}` for H70B1 and `{52, 53, 54}` for H70BC (`getShareCode`).

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] level` | `pact/Comm.makeBrightnessController4BleComm` |
| mode | `0x33/0x05` | sub-mode payload | `ble/Mode.java` |
| color | submode `0x0D` | `0D R G B kelLo kelHi R2 G2 B2` (9 B) | `ble/SubModeColor.java` |
| music | submode `0x13` | `13 musicCode sens` (default code 101=`BleProtocol.f`, sens 0..99) | `ble/SubModeMusic.java` |
| scene | submode `0x04` | `04 effLo effHi musicByte` (4 B) | `ble/SubModeScenes.java` |
| DIY | submode `0x0A` | `0A diyLo diyHi` | `ble/SubModeNewDiy.java` |
| splicing / subgroup | `0x33/0x40` | payload `{2,0}` = exit/query; `{2,1,R,G,B}` = set subgroup colour | `ble/SplicingController.java` |
| SN read | `0xAA/0x07` sub `{2}` | response `[0]=2` + 8-byte MAC (little-endian address string) | `h70b3/adjust/controller/SnController.java` (shared) |
| secret key read | `0xAA/0xB1` | response `[0]==1` + 8 bytes (base64) | `h70b3/adjust/controller/SecretController.java` |
| secret key write | `0x33/0xB2` | 8-byte base64-decoded secret | same |
| multi-frame body | `0xA3/0xA4, idx` | `MultipleControllerCommV1.makeSendBytesV3((byte)-93, shareCode, body, 97)` | `h70b1/origin/pact/Comm.java` |

Notify: `0x11` wifi, `0x20` brightness, `0x30` `[0]==1` then `[1]` bit1 = light status
(`h70b1/origin/ble/notify/DeviceInfoNotifyParse.java`). Heart is base `HeartControllerNoEvent`.

### Effects

`h70bx/diy/protocol/EffectCodeManager` supplies the H70B1/H70B2 effect-code list:

```
467, 553, 554, 531, 532, 535, 536, 537, 538, 539, 540,
544, 545, 546, 547, 548, 549, 550, 551, 552
```

H70BC (216) uses a different list:

```
645, 648, 649, 650, 651, 654, 655, 656, 657,
539, 540, 544, 658, 659, 660, 661, 549, 550, 551, 552
```

These are the 16-bit LE scene/DIY-template codes carried in `0x04` and `0x0A`.
`Support.getEffectCode(goodsType,1|2|3)` and `getShareCode` map DIY UI sub-tabs:
- H70B1: share codes `24, 36, 83`; protocol `83` (single) / `91` (multi)
- H70BC: share codes `52, 53, 54`; protocol `83` / `91`

### IoT

Envelope V2 (`IotMsgV2`). Commands: `turn` (`val`), `brightness` (`val`), `colorwc`
(`color`,`colorTemInKelvin`), `pt` (`op`, `value[]`), `ptReal` (`command[]`), plus read `status`.
`CmdPtReal` builds DIY (`getDiyCmdPt`), DIY template (`getDiyStudioCmdPt`), DIY graffiti
(`getDiyCmdPt4DiyGraffiti1`) and scenes (`getNewScenesCmdPtReal`) as base64 BLE frames.
`Support.supportIotV1GoodsType` returns true for all three goodsTypes (V1-compatible payloads).

---

## 3. H70B3 / H70B4 / H70B5 / H6810 / H6811 / H6800 (229/230/231/255/256/272)

Pact registration is protocol-list based per goodsType: 229 gets `(1,1),(1,2),(2,1),(2,2),(2,3)`;
230 the same; 231 gets `(1,1),(1,2),(2,1)`; 255/256 `(1,1),(2,1),(2,2),(2,3)`; 272
`(1,1),(1,2),(2,1),(2,2)`.

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0]` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] level` | `pact/Comm` |
| mode | `0x33/0x05` | sub-mode payload | `ble/Mode.java` |
| color | `0x0D` | `0D R G B kelLo kelHi R2 G2 B2` | `ble/SubModeColor.java` |
| music | `0x13` | `13 code sens` (default 101) | `ble/SubModeMusic.java` |
| scene | `0x04` | `04 effLo effHi musicByte` | `ble/SubModeScenes.java` |
| DIY | `0x0A` | `0A diyLo diyHi` | `ble/SubModeNewDiy.java` |
| interactive game (H6800) | `0x14` | 2-level mode/level/time layout (below) | `mode/game/SubModeInteractive.java` |
| device/splicing num | `0x33/0x40` | read: no payload; write: `[0] count` | `adjust/controller/ControllerDeviceNum.java` |
| change splicing | `0x33/0x40` | `[1] index, [2] direction mask, MAC[6]…`; direction masks from bits `01100000/01101100/10010000/10011100/11011000` | `h70bx/controller/ControllerChangeSplicing.java` |
| position calibration | `0x33/0x42` | `[0] mode (0/1/2), [1] direction, [2]=1`; read `p()` = `{1}` | `ble/controller/PositionCalibration.java` |
| read sub-device version | `0xAA/0x43` | no payload | `h70bx/controller/ControllerReadSubDeviceVersion.java` |
| secret key | `0xAA/0xB1` / `0x33/0xB2` | 8-byte key | `adjust/controller/SecretController.java` |
| display data | `0x33/0x7F` | subcommand + payload; notify `0x7F[1]==6` = countdown report | `h70b3/pact/BleProtocol.MODE_DISPLAY=-127`; `h70b6/adjust/VM4H70B6.java` |
| wifi upgrade | `0x33/0x7D` | `[0] 4|1|2` query/start/status | `h70b6/controller/WIFIUpgradesController.java` |
| 24-hour display | `0x33/0x7D` | `[0] 0/1` (H70B6 `c6`) | `h70b6/adjust/VM4H70B6.java` |
| temperature unit | `0x33/0x7E` | `[0] 1=C 0=F` (H70B6 `g6`, inverted) | `h70b6/adjust/VM4H70B6.java` |
| DIY multi-frame | `0xA3/0x5A?` -> actually `makeSendBytesV3(0xA3,0x5B/0x5C, …)` + `0x05/0x0A` | `Comm.makeDiyCmd4IotCommMulti`; protocol code `0x58` for new DIY | `pact/Comm.java`, `diy/*` |

`BleProtocol` constants (`h70b3/pact/BleProtocol.java`): 19 music, 13 color, 4 scenes, 10 DIY,
-127 display, 32 brightness, 64 device/install num, 20 interactive, -79/-78 secret read/write,
66 position calibration, 96 (`Companion.a()`) feast-switch **notify** (`[0]==1`, `[1]` on/off).

### Interactive / game submode (H6800, 0x14)

`SubModeInteractive.getWriteBytes()`:

```
oneLevelMode == 0: 14 01 sensitivity1 00 soundLevel timeLo timeHi
oneLevelMode != 0: 14 01 sensitivity2 oneLevelMode twoLevelMode [difficultLevel]
```

- `soundLevel` 1..6+ maps to level time `14,28,42,56,70,98,126` (seconds-ish), 16-bit LE.
- `twoLevelMode==1` adds `difficultLevel` byte.
- Read (`parse`): `[0]=sensitivity`, `[1]=oneLevelMode`; if 1 then `[2]=twoLevelMode`,
  `[3]=difficulty`, `[4..6]=startTime` (24-bit) where `300000 - value` = remaining ms, `-1`/0/>300000
  => 0. `status`/`gamesStatus` are local UI state.

### Effects

`h70b3/diy/protocol/EffectCodeManager` gives the B3/B4/B5 effect-code universe:

```
base:   684 685 686   757 758 759   679 680   666 667   670 671 672 673 674 678
         687 688 689   668 669   683   681 682   675
extra:  707 708 709 710 711   771 772 773   890
```

H6810 (255): `707` (single) plus `709/771/890` when splicing; H6811 (256): `707`, `708`, `709`,
`771`, `772`; H6800 (272): `679/680/666/667/670/671/672/673/674/678` (and `707/708/709` for
splicing).
UI basic-effect names map to these codes in `Support.k()`: YunRan (1→683/707, 2→681/707, 3→682),
GIF (4), BoBanTang, DaFengChe, SiDai 1/2 (7/8), ShanFeng, HuoGuang, JiaoTi, ShenSuo,
DangYang 1/2 (13/14), DuiJi 1/2 (15/16), TanTiao, TanTiaoQiu, TanChiShe, XiaoXiaoLe, YanHua,
PenShe. The `h70b3/diy/simple/effect/*` classes each carry their `getEffectCode()` and byte
layout; `h70b3/diy/advance/*` are the multi-layer (cell graffiti) variants.

### IoT

`h70b3/iot/Cmd` = `state/op/online/turn/brightness/status/colorwc/ptReal/pt`. Same V2 envelope.
`GetIotCmdPtUrlLinkInfo` in `h70b3/iot` fetches a long-lived `ptUrl` blob for large DIY effects;
`Op*CommDialog4BleIot` prefer BLE+MQTT when `DeviceCommCapability.supportMqtt(...)` and the
device has a topic, otherwise IoT `ptReal`.

---

## 4. H70B6 / H70B8 (329 / 341)

H70B6/H70B8 reuse the H70B3 BLE builders (`h70b3/scenes/*`) and `h70b3.ble.Ble` (matter-aware
BleComm). H70B8 differs only in display/segments (`Support.a(341) = (32,48)` vs `(32,30)`).

### Extra BLE commands (beyond the H70B3 set)

| command | op | payload / layout | source |
|---|---|---|---|
| 24-hour mode | `0x33/0x7D` | `[0] 1=24h,0=12h` | `h70b6/adjust/VM4H70B6.java#c6` |
| temperature unit | `0x33/0x7E` | `[0] 1=Celsius, 0=Fahrenheit` (call passes `!z`) | `h70b6/adjust/VM4H70B6.java#g6` |
| display config / countdown | `0x33/0x7F` (write); notify `0x7F` | subcommand 6 = countdown report | `h70b6/adjust/VM4H70B6.java`; `BleProtocol.k=127` |
| wifi upgrade query | `0x33/0x7D` | `[0] 4` query; response `[0]=1,[1]=1,[2]=state,[3..5]=wifi soft,[6..8]=wifi hard` | `h70b6/controller/WIFIUpgradesController.java` |
| DIY effect protocol | `0xA3`/multi + `0x05/0x0A` | protocol code `0x58`, effect code 751/750/864/865/862/863/886/887/900/901/905 | `h70b6/diy/advance/H70B6EffectCodeManager.java` |

`h70b6/pact/BleProtocol` also defines: 19 music, 10 DIY, 57 device install num, 37 (?), 125
(`q`) 24-hour, 126 (`r`) temp unit, 13 color, 68 brightness?, 96 (`a()`), 84/103/127 name/version
lengths.

### Display effects

`H70B6DisplayConfig.getSupportEffect`:
- group 1: `11,12,13,15` (clock faces)
- group 2: `21,22,23,24,27`
- group 5: `51,52`

### DIY / dynamic effects (H70B6)

`Pro4H70B6Diy` main groups and sub-effects (effect body `[lenLo lenHi][sub][second][RGB…]`):

| main | name | second ids |
|---|---|---|
| 1 | YunRan (gradient) | 1 CaiQiang (colour wall), 2 FuGai (cover) |
| 2 | XuanZhuan (rotate) | 1 BoBanTang, 2 DaFengChe |
| 3 | BoDong (wave) | 1 BoFeng, 2 ShuangLuoXuan |
| 4 | LiuDong (flow) | 1 ShenSuo, 2 DieJia |
| 5 | SuiJi (random) | 1 TanTiaoQiu, 2 TanChiShe, 3 XiaoXiaoLe, 4 YanHua |
| 6 | XianXing (linear) | 1 XiangSu, 2 TianChong, 3 PenShe |

`H70B6CellGraffitiParse` tags 76..80; `H70B6DiyParser.getProtocolCode()=0x58`.
H70B8 uses the same classes with `EASY_EFFECT_H70B8_GIF=865`, `EFFECT_CODE_CELL_H70B8_30=863`.

### IoT / wifi

H70B6/H70B8 use the shared base `CmdTurn/CmdBrightness/CmdColorWc/Cmd4PtReal`; no per-family
`iot/Cmd*.java`. WiFi software version check is HTTP
`GET /bff-app/v1/devices/upgrade/wifi/check?sku&device&bleSoftVersion&bleHardVersion&wifiSoftVersion&wifiHardVersion`
(`h70b6/INetService4H70B6.java`). Dynamic-domain names `H70B6`, `H70B8` are registered for LAN
routing.

---

## 5. H70D1 / H70D2 / H70D3 (267/268/269)

Pact is per-goodsType via `ConfigH70DX`: `(1,1)` and `(2,1)` for each of 267/268/269, and
MatterInterceptor enabled for all three. Device shape: 10 segments (`SubModeColor` default mask
`boolean[10]`), kelvin 1000..10000.

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0]` | `pact/Comm` |
| brightness | `0x33/0x04` | `[0]` | `pact/Comm` |
| color | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 maskLo maskHi` (17 B); brightness mode `15 02 level maskLo maskHi`; raw `15 03 c0..` | `ble/SubModeColor.java` |
| music | `0x13` | `13 code sens` (default 101) | `ble/SubModeMusic.java` |
| scene | `0x04` | `04 effLo effHi musicByte` | `ble/SubModeScenes.java` |
| DIY | `0x0A` | `0A diyLo diyHi` | `ble/SubModeNewDiy.java` |
| install/direction info | `0x33/0x39` | `[0] installType (1/2), [1] direction (1/2)` | `ble/controller/ControllerInstallInfo.java`, `ControllerInstallInfoOld.java` |
| init light effect | `0x33/0x38` | `[0] effect index` | `ble/controller/ControllerInitLightEffect.java`, `ControllerInitEffectOld.java` |
| device num / splicing | `0x33/0x40` | `[0] count` / splicing MAC list | shared H70B3 controllers |
| secret key | `0xB1/0xB2` | 8-byte key | shared |

Install-direction encodings (`h70dx/Support.e`):
- H70D1: `{1,1}` right, `{1,2}` left
- H70D2/H70D3: `{2,1}` middle A, `{2,2}` middle B

### DIY / effects (H70DX)

`H70DXDiyParse` (protocol code 88 / `0x58`) sub-effect ids 1..10:

| id | effect |
|---|---|
| 1 | MaSaiKe (mosaic) |
| 2 | XingGuang (starlight) |
| 3 | GeShan (partition) |
| 4 | XueHua (snowflake) |
| 5 | YunRan (gradient) |
| 6 | HuoGuang (firelight) |
| 7 | JiHe (geometry) |
| 8 | TanTiaoQiu (bouncing ball) |
| 9 | QinJian (piano keys) |
| 10 | ZuHe (combo) |

Each has action config (1..6), brightness config (1..4), direction options `9/10/2/19/15/20`,
speed range 0..100. Cell-graffiti parse uses tags `76..80`. `ConfigH70DX` also defines effect
codes 719, 715, 716, 718, 778, 774, 775, 777 (base64 DIY presets).

### IoT

Same `Iot*CmdBuilder` set (turn/brightness/colorwc), `CmdPtReal` for DIY/scene, and
`scenes/GetIotCmdPtUrlLinkInfo` for long `ptUrl` blobs.

---

## 6. Shared music / scene naming

Music sub-mode `0x13` codes are named by base `IMusicEffectStatic`:

- single-value: `0 Dynamic/Energic, 1 Soft, 2 Party, 3 Rhythm, 4 Spectrum, 5 Energic, 6 Rolling,
  7 Jump, 8 Hit, 9 Jet, 16 Mic, 17 Colorful, 18 Sunlight, 19 Joy, 20 Accumulation`
- multi-value (H70B1/H70B3/H70B6/H70DX): `48 Zhanfang, 49 Cuican, 50 Fenli, 51 Joy, 52 Piano Keys,
  53 Fountain, 54 Sea Wave, 55 Day/Night, 56/68/114 Rhythm, 69 Hit, 70 Jet, 71 Jump, 72 Joy,
  73 Beat(legacy), 74 JumpBall, 75 Rhythm, 77 Rainbow Candy, 78 XiaoXiaoLe, 79 Blend, 80 Torch,
  81 Flowing Shadow, 83 Flowing Light, 84 Spectrum, 85 Colorful, 86 PiaoWu, 87 CrossStar,
  88 Heart, 89 Rainbow Ring, 90 Rolling, 91 Bounce, 92 JianShan, 93 Split, 94 Windmill,
  96 Record, 97 Ripple, 98 Alternate, 99 Broadcast, 100 Dandelion, 101 Meteor Shower,
  102 Illusory Colors, 103 Quicksand, 104 Rainbow Circle, 105 Meteor, 113 Rolling,
  114 Rhythm, 115 ChuDong, 116 MoHuan, 122 Separate, 123 Impact, 124 Manyan, 125 Color Wall,
  126 Christmas Eve, 127 FanKuai, -128 Waves, -127 Sound Waves, -126 Custom 606A,
  -125 Point, -124 Water Flower, -123 Spring, -118 Zhanfang, -114 Shuttle, -113 Flash`
  (from `base2light/ble/IMusicEffectStatic.java`; `parseSubStr4New`).

Scenes are server-driven; only the op-sets and defaults are static:
`Support.supportScenesOpSet() = {0,1,5}` (H70B1/H70B3/H70B6),
`{0,2,3,5}` (H70DX), H6800 `{0,5}`, and `SubModeScenes.a` default `22 (Stream)`.

---

## 7. Matter pairing (H70B3/H70B6/H70B8/H70DX)

`h70b3/ble/Ble.r()` returns `com.govee.matter.pact.BleComm`; `AbsMtReadController` sets
**proType 0xAB**, payload `[0]=subcommand`. Controllers:

| subcommand | controller | request | response |
|---|---|---|---|
| 1 | `Controller4QrCode` | `{1}` | QR payload string |
| 2 | `Controller4BaseInfo` | `{2}` | 3 flags (`MatterBaseInfo`) |
| 3 | `Controller4WifiSsid` | `{3}` | SSID string |
| 4 | `Controller4Gid` | `{4}` | GID string |
| 5 | `Controller4MatterId` | `{5}` | Matter ID string |
| 6 | `Controller4PairCode` | `{6}` | pairing code string |
| 3 write | `Controller4WifiFunc` | SSID/credentials | same cmd 3 |
| 5 write | `Controller4GidWrite` | proType 63 (`0x3F`) | multiple GID |

`MtPairProtocol`: proType `0xAB`, sub-commands 1..6, protocol version 5. Matter is used for
**commissioning/add flow only**; runtime control stays BLE/IoT.

---

## 8. Other protocols

- **ptUrl** — `h70b2/origin/iot/GetIotCmdPtUrlLinkInfo`, `h70b3/iot/GetIotCmdPtUrlLinkInfo`,
  `h70dx/scenes/GetIotCmdPtUrlLinkInfo`, and base `base2light/kt/comm/CmdPtUrl`/`PtUrlService`:
  fetch a long-lived command blob (`PtUrlDataInfo`) and execute it; used for very large DIY
  (cell-graffiti/GIF) effects that do not fit in `ptReal`.
- **LAN/MQTT** — only capability detection (`DeviceCommCapability.supportMqtt` + non-empty topic)
  inside `OpDiyCommDialog4BleIot`; no topic schema in this split.
- **HTTP** — WiFi OTA check (`/bff-app/v1/devices/upgrade/wifi/check`), pairing/bind APIs in
  `h70b3/add/ApiService.java`, `h70b3/adjust/vm/INetService.java`.
- **Multi-device sync** — splicing controllers (`0x40`) and `ControllerChangeSplicing`; not
  `multiSync` cloud command.

---

## 9. Source map (traced)

- H70B1 origin: `h70b1/origin/pact/{Support,Comm}.java`, `h70b1/origin/ble/*.java`,
  `h70b1/origin/iot/*.java`, `h70b1/origin/scenes/*`, `h70bx/diy/protocol/EffectCodeManager.java`,
  `h70bx/ConfigDetail.java`, `h70bx/H70b1Application.java`
- H70B3: `h70b3/Support.java`, `h70b3/pact/{BleProtocol,Cmd,Comm}.java`, `h70b3/ble/*.java`,
  `h70b3/iot/*.java`, `h70b3/diy/{advance,simple,parse,protocol}/*`,
  `h70b3/mode/game/SubModeInteractive.java`, `h70b3/adjust/controller/*`,
  `h70b3/add/AddDeviceM.java`
- H70B6/B8: `h70b6/Config4H70B6Manager.java`, `h70b6/Support.java`, `h70b6/pact/BleProtocol.java`,
  `h70b6/diy/parser/*`, `h70b6/diy/advance/*`, `h70b6/adjust/VM4H70B6.java`,
  `h70b8/Config4H70B8Manager.java`
- H70DX: `h70dx/{Support,ConfigH70DX}.java`, `h70dx/pact/{BleProtocol,Comm}.java`,
  `h70dx/ble/*`, `h70dx/diy/*`, `h70dx/vm/VM4H70DX.java`
- Matter: `base.../com/govee/matter/pact/*` (`MtPairProtocol`, `AbsMtReadController`, controllers)
- shared transport/MTU: `h70b2/origin/ble/{MtuConfig,MTURequestManager}.java`, `h70b3/ble/Ble.java`

## 10. Gaps / unknowns

- Scene effect IDs are cloud (`ScenesM`) values; only the local DIY/effect-code universes and
  defaults are statically known.
- Multi-frame chunk header details come from base `MultipleControllerCommV1`; the split only
  passes `(0xA3, shareCode, body, 97)`.
- H70B3 display write payload beyond subcommand byte is parsed by base `Display*` controllers and
  was not fully recoverable here; only `0x7F[1]==6` countdown notify and the display effect
  groups are clear.
- `h70b3/pact/BleProtocol.m=96` (`Companion.a()`) is the feast-switch notify type; layout
  `[0]==1`, `[1]==1` feast on (`VM4H70B345.q6`).
- `h70b6/pact/BleProtocol` constants 84/103/127 are used as fixed name/version lengths; their
  exact consumers were not traced.
- H70B2 (185) has no detail config in this split; it likely shares H70B1 origin + Mtu + ptUrl, but
  its UI/feature set is not present here.
- Matter cluster/attribute mapping is not in this split (commissioning only).


---

<!-- split_pact_h7111 -->

# split_pact_h7111 — H7111 / H7100 / H7105 / H7112 heaters, fans & thermometers

## Overview / family and SKUs

Four packages implement the H71xx appliance protocol (space heaters, fans, a thermometer
hub and a fan/heater with oscillation). They share the same 20-byte frame, the same mode
enums and the same IoT `ptReal`/`multiSync` transport.

| goodsType | SKU | product | package | mode set | notes |
|---|---|---|---|---|---|
| 86 | **H7111** | space heater | `h7111` | GEAR/CUSTOM/AUTO/SLEEP/NATURAL/STORM | shake/oscillation, 3-zone custom, timer |
| 93 | **H7101**, **H7102** | space heater | `h7111` | same | H7101 lock controller only in split |
| 129 | **H7100** | space heater | `h7100` | GEAR/CUSTOM/AUTO/SLEEP/NATURAL/STORM | old/new protocol mode bytes, common switch read |
| 200 | **H7106** | space heater | `h7100` (H7106 heart) | same | only `H7106Maker`, `H7106HeartControllerV1`, `DevCommReportParse` in split |
| 201 | **H7105** | heater with oscillation | `h7105` | GEAR/CUSTOM/AUTO/SLEEP/NATURAL | shake 0x1D, custom 7/8-byte children, light71xx subcommands |
| 297 | **H7107** | heater | `h7105`/`h7107` | same | `H7107Maker`, `H7107HeartController`, temp config |
| 251 | **H7103** | heater | `h7105`/`h7103` | same | `H7103Maker`, `H7103HeartController`, lock dialog |
| 236 | **H7112** | smart fan / air circulator | `h7112` | GEAR/AUTO/SLEEP/NATURAL | thermometer binding, sensor read, humidity/temp calibration, timer, delay-off |

Makers: `H7111Maker`, `H7101Maker`, `H7100Maker`, `H7106Maker`, `H7105Maker`,
`H7107Maker`, `H7103Maker`, `H7112Maker` — all `AbsBleWifiSku` (H7112 via the shared
`AbsDeviceModel4BleIotH71xx`). Sub-libraries: `h7111` (`Support.g` = 86/93), `h7100`
(`Support.m` = 129/200), `h7105` (`Support.f` = 201/297/251), `h7112` (`Support.h` = 236).

Transports: **ble + iot** for every SKU. H7112 has no local `ble/` package: it uses the
shared `com.govee.base_h71xx` GMessage controllers (`GMessageSingleWrite/Read`,
`GMessageSingleReadWrite`, `GMessageMultiRead`) over the same GATT service, and the same
shared IoT `CmdPtReal`/`CmdStatus` classes.

## Transports & GATT UUIDs

All packages:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- h7111: heart `HeartControllerV1`; notify only `WifiNotifyParse`
- h7100: heart `HeartControllerV1` (or `H7106HeartControllerV1` for goodsType 200,
  selected by `BleComm.l()`), notify `WifiNotifyParse` + `DevCommReportParse`
- h7105: heart selected by SKU (`H7105HeartController`, `H7107HeartController`,
  `H7103HeartController`), notify `WifiNotifyParse` + `DevCommReportParse`
- h7112: shared H71xx GATT manager, no local UUID override (same standard UUIDs)

Frame: `[proType][cmdType][17-byte payload][XOR BCC]`; write `0x33`, read `0xAA`.
H71xx mode/delay/keep-warm controllers often override the write proType to `0x3A` (58,
`BleProtocolConstants.v1()`) and the read proType to `0xAA`.

## BLE frame + command table

Opcodes resolved from `base_h71xx/sku_base/BleProtocolConstants`.

| # | command | op | payload | response / notes |
|---|---|---|---|---|
| 1 | power | `0x33/0x01` | `[on][mode][params]` | `0xAA/0x01` → valid[0] |
| 2 | mode | `0x33/0x05` sub `0x00` | see exact mode payloads | read `0xAA/0x05` payload `[00]`/`[mode]` |
| 3 | gear | `0x33/0x05` sub `0x08` | `[08][gear]` | read `[08]` → `[1]` |
| 4 | auto ramp | `0x33/0x05` sub `0x03` (or auto mode byte) | `[autoMode][startGear][startTemp*100 LE16][endGear][endTemp*100 LE16]` | read `[03]` |
| 5 | custom/DIY table | `0x33/0x05` sub `0x02` / `0x05` | `[customMode][nibbles][children...]` | multi-packet for H7105 |
| 6 | read mode | `0xAA/0x05` | `[mode]` or `[00]` | mode record |
| 7 | shake/oscillation (H7105) | `0x33/0x1D` (29) | on: `[01][speed 1..3][angle 30..180][center*10 LE16][symmetry]`; off: `[00][direction]` | read; parse `ShakeBean` |
| 7b | shake/oscillation (H7111) | `0x33/0x1F` sub `0x01` | on: `[01][speed 1..3][angle 30..180][center*10 LE16][symmetry]`; off: `[00][direction]` | read `0xAA/0x1F` payload `[01]` |
| 8 | beep | `0x33/0x1F` (31) | `[06][00/01]` | read `[06]` |
| 9 | light sub-command (H7105) | `0x33/0x1B` (27) | `[subCmd]...` — `LightSubCmd.b()` brightness, `.a()` mode | notify 0x1B |
| 10 | abnormal info | `0x33/0x17` (23) | `01` request | read `[flag][code]` |
| 11 | common switch read | `0xAA/0x1F` | none | `[0]`/`[1]`/`[7]` flags (beep, display, child lock etc.) |
| 12 | delay start | `0x33/0x23` (35) | `[on][setMin LE16][timestamp LE32]` | read `0xAA/0x23` |
| 13 | keep warm | `0x33/0x22` (34) | `[on][min LE16][min LE16]` | read `0xAA/0x22` |
| 14 | real-time temp | `0xAA/0x10` (16) | none | `[1..2]` signed BE16 |
| 15 | timer | `0x33/0x13`/multi-read | `NewTimerV1Controller` record | read 0x13 |
| 16 | thermometer read (H7112) | `0xAA/0x10` | none | `[flag][temp int24][type]` |
| 17 | bind thermometer (H7112) | `0x33/0x08` | reversed MAC (6 bytes) | response same 6 bytes |
| 18 | unbind thermometer (H7112) | `0x33/0x09` | none | — |
| 19 | humidity cali (H7112) | `0x33/0x1E` | `[02][02 save|01 read][value LE16]` | read `[02][01/02]` |
| 20 | temp cali (H7112) | `0x33/0x1E` | `[01][02 save|01 read][value LE16]` | read `[01][01/02]` |
| 21 | temp unit / sensor unit | `0x33/0x1F` | `[08][00/01]` | read `[08]` |
| 22 | delay-off (H7112) | `0x33/0x26` (38) | `[on][min LE16]` | read `0x26` |
| 23 | not-disturb | `0x33/0x16` (22) | `[enable][forever][startH][startM][endH][endM]` | read `0x16` |
| 24 | heart / state | `0xAA/0x01` | none | h7111: `[0] on`, `[1] mode-change/flag`, `[2..4]` int24 temp, `[5] int`, `[6] int`, `[7]` flag; h7100: `[0] on`, `[1]` mode, `[8]` autoOff, `[9]` value; h7105: `[5]` autoOff, `[6]` mode, `[8]` value |
| 25 | report notify | header `0xEE`, subcmd byte1 | h7100/h7105 report parser | see notifications |

### Exact mode payloads

H7111 (`adjust/Mode`, `ModeInfo`, `ModeCustom`, `ModeAuto`):

- Mode bytes (new protocol): GEAR `01`, CUSTOM `02`, AUTO `03`, SLEEP `05`, NATURAL `06`,
  STORM `07`. Old protocol values used by H7100: CUSTOM `05`, AUTO `02`, SLEEP `03`,
  NATURAL `04` (`Mode.getByteValue(boolean legacy)`).
- GEAR: `[01][gear]`
- AUTO: `[03][startGear][startTemp*100 LE16][endGear][endTemp*100 LE16]` (7 bytes)
- CUSTOM: `[02][(curIndex<<4)|setIndex]` + 3 children, each
  `[type][currentTemp LE16][targetTemp LE16]` (5 bytes); unused = `FF`
- SLEEP: `[05][level]`; NATURAL: `[06][level]`; STORM: `[07]`
- read current: `0xAA/0x05` payload `[00]`; read gear `[08]`; read auto `[03]`;
  read custom `[02]`; child write `0x05` payload `[index]`.

H7100/H7106:

- Same enum, but `getByteValue(legacy)` chooses old/new bytes; `H7100ModeController.p()`
  sends the current mode byte as the read selector.
- AUTO custom payloads are the same shape; `ModeCustom.b(legacy, ...)` uses the selected
  mode byte as the first byte.
- STORM has no extra bytes; SLEEP/NATURAL carry one level byte; GEAR one gear byte.

H7105/H7103/H7107:

- Modes: GEAR `01`, AUTO `02`, SLEEP `03`, NATURAL `04`, CUSTOM `05`.
- GEAR `[01][gear]`, SLEEP `[03][level]`, NATURAL `[04][level]`,
  AUTO `[02][startGear][startTemp*100 LE16][endGear][endTemp*100 LE16]`.
- CUSTOM mode frame carries no table; the table is sent as a multi-packet
  `0x05` DIY command (`DiyModeMultipleControl`, outer proType `0xA3`),
  payload `[(cur<<4)|set]` + per child
  `[type][curTemp LE16][targetTemp LE16][(nibbles)][flag]` and, for the extended form,
  `[centerAngle*10 LE16][symmetry]` (7 or 9 bytes per child). H7111/H7100 custom tables
  fit in one `0x33/0x05` frame; only H7105 uses the `0xA3` multi wrap.
  Multi framing: `MultipleControllerCommV1.makeSendBytesV0/V1` — start
  `A3 00 00 (packCount+2) 05` or `A3 00 01 <total> 05`, data `A3 <index> <17-byte chunk>`,
  end `A3 FF`; BCC in byte 19. `CmdPtReal`/`CmdMultiSync` preserve order.

H7112 (fan):

- Modes: GEAR `01`, AUTO `02`, SLEEP `03`, NATURAL `04`.
- `ModeAuto.f()` payload: `[02][startGear][startTemp*100 LE16][endGear][endTemp*100 LE16]`
  (the leading `02` doubles as AUTO mode).
- GEAR `[01][gear]`, SLEEP `[03][level]`, NATURAL `[04][level]`.
- Current-mode read is `0xAA/0x05` with no payload; parser `H7112Repository.g0` reads
  `[0]=mode`, `[1]=gear/level` and auto fields at 1..6.
- Mode writes go through `GMessageSingleReadWrite(0x05, payload)`.

### Advertised / report-only commands

`h7100/ble/BleNotifyComm.parse` and `h7105` require `bArr[0] == 0xEE`; byte 1 selects the
report parser (mode/switch/abnormal/delay-off/not-disturb/light). `h7111` only registers
the WiFi notify and uses the heart notification for state.

## BLE notifications / readings

| parser | cmdType / header | layout | source |
|---|---|---|---|
| `WifiNotifyParse` | 17 (0x11) | `[0]==0` connected | all |
| `DevCommReportParse` | 0xEE report, subcmd byte1 | subcmd `0x05` mode, `0x1F` switches, `0x16` not-disturb, `0x26` delay-off, `0x17` abnormal, `0x1B` H7105 light, `0x1D` shake | h7100/h7105 |
| heart | read `0x01` | h7111: `[0] on`, `[1] mode-change/flag`, `[2..4]` int24 temp, `[5] int`, `[6] int`, `[7]` flag; h7100: `[0] on`, `[1]` mode, `[8]` autoOff, `[9]` value; h7105: `[5]` autoOff, `[6]` mode, `[8]` value | `h7111/ble/HeartControllerV1`, `h7100/ble/HeartControllerV1`, `h7105/ble/H7105HeartController` |
| `EquipmentStatus` | only on shared H71xx families | status byte | base |
| temp unit/beep notify | `0x1F` | `[id][0/1]` | h7111/h7100/h7105 status parsers |
| light subcommand (H7105) | `0x1B` | `LightSubCmd.b()` brightness / `.a()` mode | h7105 DevCommReportParse |

Sensor readings on H7112: `GetThermometerController` (`0x10`) returns
`[connected][temp int24 big-endian][type]`; the app scales with
`TherCalcuUtils.parseValue` and applies the per-device calibration offset. Battery /
sensor bind state comes from `0x08` (MAC) and `0x1E` calibration reads.

## IoT commands + status/readings schema

Envelope: `Write` + `AbsCmdWrite`, `type=1`, `origin=32`, `cmdVersion=0`.
Cmd names: `state`, `op`, `online`, `turn`, `status`, `ptReal`, `multiSync`.

| cmd | data | source |
|---|---|---|
| `turn` | `{val:0|1}` | `base_h71xx/sku_base/iot/CmdTurn` (also used by `h7111`/`h7100`/`h7105` scene switch builders) |
| `ptReal` | `{command:["<base64 20-byte frame>", …]}` | `CmdPtReal`; used for every mode/gear/shake/DIY/timer/sensor command |
| `multiSync` | `{command:[…]}` | `CmdMultiSync` (multi-device/group) |
| `status` (read) | type 0, no data | `CmdStatus`, `IotOpH71xx.n()="status"` |
| `online` | keepalive | `AbsIotOpV1` |

`CmdStatusParseV1`/`V2` read `state {onOff,result}` and the `op.command[]` base64 frames,
then apply the BLE parsers: `0x05` mode, `0x19` equipment, `0x10` temperature, `0x1F`
switches, `0x22` keep-warm, `0x23` delay, `0x17` abnormal, `0x13` timer, `0x1D` shake
(H7105), `0x1B` H7105 light, `0x08/0x09/0x10/0x1E/0x26` H7112 thermometer binding,
sensor read, calibration and delay-off.

H7111 uses `CmdStatusParseV2` (newer response envelope) and H7100/H7105 use
`CmdStatusParseV1`; both carry the same `State` fields. H7112 uses the shared H71xx
`CmdStatusParse` with `state {onOff}` and `op.command[]`.

## Other protocols

- **WiFi/MQTT**: no LAN/UDP implementation in the split; cloud traffic uses the shared
  account-topic IoT channel. H7112 also has a REST API for firmware/support
  (`h7112/net/H7112ApiService`, `DevicePushNoticeRequest`) but no direct LAN control.
- **Matter / IR / RF / Thread**: absent.
- **BLE advertising**: not used for state; all readings come from GATT notify/read.
- **OTA**: shared base OTA.

## Dynamic effects / motion / music / scenes / DIY

Appliances only — no colour/music engine. Relevant "dynamic" behaviours:

| effect | op | payload | parameters |
|---|---|---|---|
| mode | `05/00` | mode byte + params | H7111/H7100: GEAR/CUSTOM/AUTO/SLEEP/NATURAL/STORM; H7105: GEAR/CUSTOM/AUTO/SLEEP/NATURAL; H7112: GEAR/AUTO/SLEEP/NATURAL |
| auto ramp | `05/03` / `05/02` | `[autoMode][startGear][startTemp*100][endGear][endTemp*100]` | start/end gear + temperature |
| custom recipe | `05/02` or `05/05` + multi | 3 children `[type][curTemp][targetTemp]`; H7105 adds angle/symmetry | children 1..3, temperatures ×100 |
| shake / oscillation (H7105) | `1D` | on `[01][speed 1..3][angle 30..180][center*10 LE16][symmetry]`; off `[00][direction]` | angle ≥30, center 0..180°, speed 1..3, direction |
| shake / oscillation (H7111) | `1F` sub `01` | on `[01][speed][angle][center LE16][symmetry]`; off `[00][direction]` | same ranges, sub-id 1 under the 0x1F setting command |
| H7105 light sub-command | `1B` | brightness or light-mode payload (`LightSubCmd`) | brightness 0..100 / mode |
| delay start / delay-off | `23` / `26` | on + minutes (+ timestamp) | one-shot |
| keep warm | `22` | on + minutes | 0..? |
| timer | `13` | 8-byte record | group/enable/hour/min/repeat/mode/modeValue/comfort |
| sensor / thermometer | `10`, `08`, `09`, `1E`, `1F` | see command table | temperature int24, calibration offset |

## Source map (paths traced)

- `jadx-splits/split_pact_h7111/sources/com/govee/h7111/pact/{Support,SubLib,SubMaker,H7111Maker}.java`, `…/h7111/ble/{BleComm,BleNotifyComm,HeartControllerV1}.java`, `…/h7111/ble/controller/*`, `…/h7111/adjust/{Mode,ModeInfo,ModeAuto,ModeCustom,ModeCustomInfo}.java`, `…/h7111/iot/*`, `…/h7111/scens/*`
- `…/h7100/pact/{Support,SubLib,SubMaker,H7100Maker}.java`, `…/h7100/ble/{BleComm,BleNotifyComm,HeartControllerV1}.java`, `…/h7100/ble/controller/*`, `…/h7100/adjust/{Mode,ModeInfo,ModeAuto,ModeCustom,ModeCustomInfo}.java`, `…/h7100/iot/CmdStatusParseV1.java`
- `…/h7105/pact/{Support,SubMaker,H7105Maker}.java`, `…/h7105/ble/{BleComm,BleNotifyComm,H7105HeartController,DevCommReportParse}.java`, `…/h7105/ble/controller/*`, `…/h7105/adjust/{Mode,ModeInfo,ModeAuto,ModeCustom,ModeCustomInfo,ShakeBean}.java`, `…/h7105/iot/CmdStatusParseV1.java`
- `…/h7101/pact/H7101Maker.java`, `…/h7101/adjust/ble/controller/LockController.java`, `…/h7103/{H7103Maker,H7103HeartController,H7103TempConfigObject}.java`, `…/h7106/pact/H7106Maker.java`, `…/h7106/ble/{H7106HeartControllerV1,DevCommReportParse}.java`, `…/h7107/{H7107Maker,H7107HeartController,H7107TempConfigObject}.java`
- `…/h7112/pact/{Support,SubLib,SubMaker,H7112Maker,H7112BleIotInfo,Model,DeviceItem}.java`, `…/h7112/bean/{Mode,ModeAuto,ModeInfo}.java`, `…/h7112/vm/{H7112SharedViewModel,H7112Repository,AutoModeComponent,ModeComponent}.java`, `…/h7112/scens/*`
- `jadx-base-7.7.10/sources/com/govee/base_h71xx/sku_base/BleProtocolConstants.java`
- `…/base_h71xx/sku_base/iot/{Cmd,CmdTurn,CmdPtReal,CmdMultiSync,CmdStatus,ResultPt,IotOpH71xx}.java`
- `…/base_h71xx/sku_base/ble/controller/{GetThermometerController,BindTemperatureController,TemperatureCaliController,ThermometerCaliController,DelayOffControllerV1,NotDisturbController,SensorTempUnitController}.java`
- `…/ctlchannel/message/{GMessageSingleWrite,GMessageSingleRead,GMessageSingleReadWrite,GMessageMultiRead}.java`
- `jadx-base-7.7.10/sources/com/govee/base2home/iot/{Write,AbsCmd,AbsCmdWrite}.java`

## Gaps / unknowns

- H7106 is only partially present in this split (`H7106Maker`, heart controller and report
  parser); the rest of its UI/controllers are in other modules. Treat it as H7100 with the
  H7106 heart parser.
- H7101/H7102 and H7103/H7107 are thin sub-SKUs: only lock/heart/temp-config classes are
  in this split; their mode/command behavior is inherited from H7111/H7105.
- H7111 heart fields 1/6/7 and H7100 field 9 are not named in the decompiled source
  (mode-change/flag placeholders); only the temperature int24 and mode byte are certain.
- H7105 custom child encoding is partly inferred from getter names (`ModeCustomInfo` has
  fields for type/current temp/target temp/speed/angle/symmetry but obfuscated names).
- H7112 has no local BLE transport/frame generator in this split; it delegates to the
  shared H71xx GMessage layer. Opcode mapping is from `H7112SharedViewModel` calls
  (`m1=0x09`, `i1=0x1E`, `P=0x10`, `d0=0x05`, `A=0x08`, `l1=0x13`, `P0=0x02`,
  `Q0=0x02`, `S0=0x01`, `R0=0x01`).
- H7112 fan mode value `02` is overloaded as both AUTO and the auto-ramp selector; the
  parser accepts it in either role.
- H7111 `ModeShakeController` uses `0x1F` with sub-id `01` (`[01]…` write / `[01]` read);
  H7105 `H7105ShakeController` uses `0x1D` with the on/off flag as payload byte 0.
  Write-off direction semantics are device-specific and not documented in source.


---

<!-- split_pact_h7120 -->

# split_pact_h7120 — H7120…H7129 air purifiers

Sources: `decompiled/jadx-splits/split_pact_h7120/sources/com/govee/...`
plus the shared air-purifier library `decompiled/jadx-base-7.7.10/sources/com/govee/base_h71xx/...`.

All paths below are relative to `decompiled/`.

## 1. Overview / family and SKUs

This split is the **H71xx air-purifier / air-quality family**. It is not a lighting
family: there are no colour/scene/DIY effect commands. The product surface is
power, fan gear, auto/sleep modes, night light, child lock, delay-off, DND
(indicator off), timer groups, filter life, abnormal/sensor info and PM charts.

| SKU | goodsType | UI / notes | transports |
|---|---|---|---|
| H7120 | 118 | base purifier; `h7120/pact/Support.java` | ble, iot |
| H7121 | 72 | adds gear/child-lock/night-light/indicator/filter parsers | ble, iot |
| H7122 | 79 | adds custom mode, air-quality, timer V3 | ble, iot |
| H7123 | 110 | abnormal info + state info variant | ble, iot |
| H7126 | 160 | custom/auto mode, bind-temperature, matter settings | ble, iot, matter |
| H7127 | 254 | alias of H7126 (`h7126/pact/Support.java` keys `{160,254}`) | ble, iot, matter |
| H7129 | 224/225/223/226 | PM chart / segmented sensor model (`h7129/pact/Support.java`) | ble, iot, matter |

`pact/SubLib.keys()` returns the **goodsType numbers as strings**
(`Support.h()` / `Support.i()`), so cloud SKU identity is by goodsType.

Protocol support is declared with `GoodsType.beProtocol(pactType, pactCode)`:

- H7120: `(1,1)`, `(1,2)`, `(2,1)` — `h7120/pact/Support.java`
- H7121: `(1,1)`, `(1,2)` — `h7121/pact/Support.java`
- H7122/H7123/H7126/H7129: one `(1,1)` protocol (see each `pact/Support.java`)

`(1,1)` is the BLE+IoT pact; `(2,1)` is the newer cloud/BLE variant; the exact
transport chosen at runtime is in `base2light.pact.Protocol`.

## 2. Transports & GATT UUIDs

All variants use the standard Govee vendor GATT pair:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

`h7120/ble/BleComm.java` (and copied `BleMultiComm.java`). `isSelfComm()` also
recognises the alternate self-comm service `494e5445-4c4c-495f-524f-434b535f4857`,
and `isChartData()` recognises `494e5445-4c4c-495f-524f-434b535f2015` (chart data
channel).

BLE object: `h7120/ble/Ble.java` (singleton `Ble.s`, `CommEventGattCallback`).
Multi-packet writer `BleMultiComm` uses the same UUID pair.

## 3. BLE frame + command table

Frame: 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC`
(`com.govee.base2kt.utils.BleUtils.generate20Bytes`).

Write `proType = 0x33`; read/query `proType = 0xAA`; mode writes override
`getProType()` to `0x3A` (58) and read with `0xAA`
(`h7120/ble/controller/ModeController.java`). Timer/time commands are multi-byte
but still one 20-byte frame.

Opcodes below are resolved from `BleProtocolConstants` accessors in
`base_h71xx/sku_base/BleProtocolConstants.java` (the decompiled accessor names are
stable; values shown are the literal field values).

| Command | op (write/read) | payload | layout / notes | source |
|---|---|---|---|---|
| power | `0x33/0x01`, read `0xAA/0x01` | `01`=on `00`=off | read → valid[0] state | base `SwitchController`; `h7120/adjust/v1/CommandOpV1.java` |
| brightness | `0x33/0x04`, read `0xAA/0x04` | `val` 0–100 | read → valid[0] | base `BrightnessController` |
| mode | write `0x3A/0x05`, read `0xAA/0x05` | `[id, value]` | id: GEAR `0x08`, SLEEP `0x05`, AUTO `0x03`; GEAR carries gear in [1]; AUTO carries 0 | `h7120/adjust/Mode.java`, `ModeInfo.java`, `ble/controller/ModeController.java` |
| abnormal / sensor info | `0x33/0x17`, read `0xAA/0x17` | `01` | read: [0] code, [1] sub-code (`AbnormalInfo`) | `h7120/adjust/AbnormalInfo.java`, `ble/controller/AbnormalInfoController.java` |
| air quality / state info | `0x33/0x19`, read `0xAA/0x19` | `pmLo pmHi level x` | read: [0..1] signed16 value LE, [2] level, [3] extra | base `AirQualityInfo`, `ble/controller/StateInfoController.java` |
| delay-off | `0x33/0x11`, read `0xAA/0x11` | `on minLo minHi` | read: [0] isOpen, [1..2] minutes LE16, [3..5] leave seconds LE24 | base `DelayOffController` / `DelayOffInfo` |
| DND / indicator off | `0x33/0x16`, read `0xAA/0x16` | `enable startH startM endH endM forever` | enable `0x01`; forever=1 → 0/0/23/59 | base `NotDisturbController`, `NotDisturbInfo` |
| timer group write | `0x33/0x13`, read `0xAA/0x13` | `group enableSwitch hour min repeat mode modeValue comfortable` (V2) | V1 has 5 bytes | base `TimerGroupControllerV2`; `h7122/.../TimerGroupControllerV3.java` adds area LE16 |
| timer group delete | `0x33/0x15` | `group` | — | base `TimerGroupDeleteController` |
| timer count read | `0xAA/0x12` | — | number of timers | base `TimerCountController` |
| sync time | `0x33/0xB5` | 7 bytes (timestamp LE32 + TZ offset) | — | base `SyncTimeController` |
| indicator light (H7121) | `0x33/0x1A` | `0x26`=on `0x11`=off | — | `h7121/ble/controller/IndicatorLightController.java` |
| child lock (H7121) | `0x33/0x09` | `0x02`=lock `0x08`=unlock | — | `h7121/ble/controller/ChildLockController.java` |
| gear (H7121) | `0x33/0x1C` | `gear` | — | `h7121/ble/controller/GearController.java` |
| night light (H7121) | `0x33/0x17` | `onFlag(0x10/0x1C) brightness` | 0x17 collides with abnormal on other SKUs | `h7121/ble/controller/NightLightController.java` |
| child lock (H7122) | `0x33/0x10` | `01/00` | — | `h7122/ble/controller/ChildLockController.java` |
| air quality (H7122) | `0xAA/0x1C` | `val` | read-only polling | `h7122/ble/controller/AirQualityController.java` |
| filter state (H7122) | `0xAA/0x19` | `01` | read-only | `h7122/ble/controller/FilterStateController.java` |
| mode custom (H7126) | `0x3A/0x05` | `02 (curIdx<<4|setGear) {gearIdx setMinLE16 leaveMinLE16}*` | variable length; disabled gear = `0x00` | `h7126/.../bean/ModeCustom.java` |
| mode gear (H7126) | `0x3A/0x05` | `08 gear` | — | `h7126/ble/controller/ModeGearController.java` |
| mode auto (H7126) | `0x3A/0x05` | `03 eco efficient useArea` | — | `h7126/.../bean/ModeAuto.java` |
| report chart | `0x33/0x30` | `01` | asks device to push PM chart data | base `ReportChartController`; `h7120/.../CommandOpV1.java` |
| filter reset | `0x33/0x17` | `01` | sent by “send rest filter” event | `h7120/adjust/v1/CommandOpV1.java` |

GEAR/SLEEP/AUTO constants resolved in `base_h71xx/sku_base/BleProtocolConstants.java`
(`o0()=8`, `B0()=5`, `f0()=3`).

Multi-byte fields are little-endian (`BleUtil.getSignedBytesFor2(..., true)`).

## 4. BLE notifications / readings

Notifications are matched on packet byte 0 (proType) and parsed from bytes 1..17
(`base2light/ble/comm/AbsNotifyParse.java`).

| proType | parser | reading |
|---|---|---|
| `0x11` | `h7120/ble/WifiNotifyParse.java` | Wi-Fi connected = `value[0]==0` |
| `0x01` | `HeartControllerV1` (`h7120/ble/HeartControllerV1.java`) | heartbeat; carries device state byte and error byte |
| `0x05` | `ModeNotifyParse` (H7126) | mode: [0] mode id, [1] gear/extra |
| `0x19` | `StateInfoNotifyParse` (H7126) / `StateInfoController` | air quality: `[0..1]` value LE16, `[2]` level, `[3]` extra |
| `0x17` | `AbnormalNotifyParse` (H7126) | abnormal: `[0]` code, `[1]` sub-code |
| `0x11` | `DelayOffNotifyParse` (H7126) | delay-off: `[0]` on, `[1..2]` min LE16, `[3..5]` left sec LE24 |
| `0x16` | `NotDisturbNotifyParse` (H7126) | DND window |
| `0x18`? | `ReadStateNotifyParse` (H7126) | composite read-state |
| `0x40` | base `DeviceStatusNotifyParse` | first 10 bytes of status frame |

(Because the accessor values overlap between SKUs, the opcode is always interpreted
per SKU by the controller that issued the read.)

## 5. IoT commands + status / readings schema

Transport: `IotMsgProType` **V1** (`h7120/adjust/v1/IotOpV1.java` extends
`AbsIotOpV1`; `CmdStatusParseV1` uses `AbsIotManagerV1.getJsonObjectStr`). Incoming
JSON is parsed for top-level keys `state` and `op`.

Write envelope (`base2home/iot/Write`, `AbsCmdWrite`):

```json
{"msg":{"transaction":"<gen>","accountTopic":"<topic>","type":1,"origin":32,
        "cmdVersion":1,"cmd":"<cmd>","data":{...}}}
```

Read envelope: same with `"type":0`.

| cmd | data | meaning | source |
|---|---|---|---|
| `turn` | `{"val":0|1}` | power | `h7121/iot/CmdTurn.java`, base `CmdTurn` |
| `status` | `{}` | full status read; response keys `state` + `op` | `base_h71xx/sku_base/iot/CmdStatus.java` |
| `ptReal` | `{"command":["<base64 20-byte frame>",…]}` | tunnel a BLE frame (all BLE commands above) | `h7120/adjust/v1/IotOpV1.java` (`q()`=`"ptReal"`) |
| `online` | — | online/offline event key | `h7120/adjust/v1/IotPactV1.java` |
| `multiSync` | — | multi-device sync (air-quality sensors) | base `Cmd` |

Read parse key: `ptReal` → `"op"`, everything else → `"state"`
(`-h71xx/sku_base/iot/Cmd.a(String)`).

Status schema (`h7120/iot/CmdStatusParseV1$State`):

```json
{"onOff": 0|1, "result": <int>}
```

`state.onOff` drives the on/off UI. `op.pt[]` is a list of base64 20-byte BLE
frames; the parser re-enters the BLE table above, special-casing timer op `0x13`
(`CmdStatusParseV1.Companion.a/d/e`). That is how cloud reads expose mode, DND,
air quality, delay-off, timers and abnormal info.

Air-quality object (`base_h71xx/.../AirQualityInfo`) field mapping:
`[0..1]` value (signed LE16), `[2]` level/grade, `[3]` auxiliary. Exact physical
unit (PM2.5 µg/m³ vs PM index) is not named in the decompiled class — gap.

Filter metadata is **HTTP**, not BLE:
`DeviceFilterRequest{ "", sku, device, filterExpireOnOff }` →
`IKtDeviceNet.updateDeviceFilter` (`h7120/adjust/v1/SettingAc$toSaveFilterSwitch$1.java`).

## 6. Other protocols

- **Matter**: H7126/H7127 and H7129 expose Matter settings — `h7126/adjust/AdjustAc$readMatterInfo$2.java`,
  `h7129/vm/SettingViewModel$getMatterInfo$1.java`, `H7129ApplicationImp`. Pairing is
  handled by base `MatterInterceptor`; no custom cluster map in the split.
- **Cloud chart**: H7129 uploads PM history with `H7129ChartViewModel`, `ChartController4PmMode`,
  `H7129ChartRepository` and segmented file parse; separate from the live BLE stream.
- **Wi-Fi provisioning**: `h7120/add/WifiChooseAc.java` (same file in h7121/h7122/h7123/h7126/h7129), `AirBindConfig*`.
- **BLE broadcast** pairing: `add/BleBroadcastProcessor.java` (advertisement-based discovery only).

## 7. Dynamic effects / motion / music / scenes / DIY

None. This family has no colour, scene, DIY, music or gradient effect protocol.
The mode container (`0x3A/0x05`) only carries gear/sleep/auto/custom fan profiles.
`h7120/ble/controller/ModeController.java` uses `ModeInfo` (mode + value), not the
lighting `AbsMode` sub-mode dispatch used by other splits.

## 8. Source map (traced)

- SKU/pact: `h7120/pact/{Support,SubLib,SubMaker,H7120Maker,DeviceItem,Model}.java`,
  same under `h7121`, `h7122`, `h7123`, `h7126`, `h7129`.
- BLE transport: `h7120/ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,WifiNotifyParse,HeartControllerV1}.java`.
- BLE commands: `h7120/ble/controller/*`, `h7121/ble/controller/*`, `h7122/ble/controller/*`,
  `h7123/ble/controller/*`, `h7126/ble/controller/*`; shared base
  `base_h71xx/sku_base/ble/controller/*` and `BleProtocolConstants.java`.
- UI/pact glue: `h7120|h7121|h7122|h7123|h7126/adjust/v1/{CommandOpV1,BleOpV1,IotOpV1,BlePactV1,IotPactV1,FrameV1}.java` (h7129 uses activity/vm instead).
- IoT: `h7120/iot/CmdStatusParseV1.java` (same class copied per family), `h7121/iot/{CmdStatus,CmdTurn}.java`,
  `base_h71xx/sku_base/iot/{Cmd,CmdStatus}.java`.
- Readings: `base_h71xx/sku_base/adjust/component/bean/{AirQualityInfo,DelayOffInfo,NotDisturbInfo,TimerInfoV2}.java`,
  `h7120/adjust/{Mode,ModeInfo,AbnormalInfo}.java`, `h7126/.../bean/{ModeAuto,ModeCustom}.java`.
- Notifications: `h7126/ble/*NotifyParse.java`.

## 9. Gaps / unknowns

- `AirQualityInfo` field [3] and the unit/scale of [0..1] are not named.
- The exact semantic of `pactType/pactCode` pairs `(1,2)` and `(2,1)` (BLE-only vs
  cloud transport preference) is decided in base `base2light.pact.Protocol`, not here.
- `IndicatorLightController`/`NightLightController` opcodes are resolved from
  obfuscated constants (`0x1A`/`0x17`); confirm against captured traffic.
- H7129 goodsTypes 223–226 map to the four regional/segment SKUs; the SKU strings are
  only present in theme resources (`ThemeM.i.b("H7129", ...)`).
- No colour/effect commands, so effect-ID tables are intentionally absent.


---

<!-- split_pact_h7130 -->

# split_pact_h7130 — GoveeLife heaters (H7130/H713A/H7131-H7139)

Source root: `decompiled/jadx-splits/split_pact_h7130/sources/com/govee/`.

This split is **not a light family**. It is the smart space-heater / stove / heater-humidifier
protocol: a 20-byte BLE frame with a heater-specific opcode map, plus an IoT V2 JSON tunnelling
the same BLE frames through `ptReal`. There are no colour/scene/DIY effect payloads; the
"dynamic" controls are gear, auto/fan mode, constant temperature, oscillation, child lock,
timers, sleep schedule and power saving.

| package | goodsType | SKU(s) | product | transports |
|---|---|---|---|---|
| `h7130` | 60 | H7130 | Smart heater (base, V1 UI) | **ble + iot** |
| `h713a` | 164 | H713A | Heater (H713A UI/timer variant) | **ble + iot** |
| `h7132` | 115 | H7131, H7132 | Heater (mode/auto UI) | **ble + iot** |
| `h713b` | 165 | H713B | Heater (H713B timers) | **ble + iot** |
| `h7135` | 153 | H7135 | Heater (mode/auto, V3 settings) | **ble + iot** |
| `h7135` | 174 | H7133, H7134 | Heater with swing-leaf / stove mode | **ble + iot** |
| `h7135` | 166 | H713C | Heater | **ble + iot** |
| `h7135` | 214 | H7136 | Heater | **ble + iot** |
| `h7135` | 215 | H713D | Heater | **ble + iot** |
| `h7135` | 222 | H7137 | Heater | **ble + iot** |
| `h7135` | 237 | H713E | Heater | **ble + iot** |
| `h7135` | 252 | H7138 | Heater (temperature-unit change) | **ble + iot** |
| `h7135` | 179 | H7134 | BLE/WiFi heater variant | **ble + iot** |

Registration: `h7130/pact/Support.a()` registers goodsTypes 60 and 164 with `beProtocol(1,1)` and
`(2,1)`; `h7132/pact/Support.a()` registers 115/165; `h7135/pact/Support.a()` registers
153/166/174/179/214/215/222/237/252. `SubMaker`s: `h7130/pact/SubMaker` (H7130, H713A),
`h7132/pact/SubMaker` (H7132, H713B), `h7135/pact/SubMaker` (nine `H713xMaker` goods types).
GoodsType names confirmed in base `com/govee/shared/checker/KmpGoodsType.java`.

---

## 1. Transports & GATT UUIDs

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- `isChartData` characteristic `494e5445-4c4c-495f-524f-434b535f2015`
- self-comm service `494e5445-4c4c-495f-524f-434b535f4857`

Sources: `h7130/ble/BleComm.java` (static `J2`/`K2`, `q(String)` accepts both service UUIDs),
`h7130/ble/Ble.java` (`AbsBle` subclass, `CommEventGattCallback`, `BleComm`/`BleMultiComm`/
`BleNotifyComm`). The transport is the standard Govee vendor GATT; IoT devices use the same
frames tunneled in `ptReal`.

BLE frame (20 bytes, generated by `AbsSingleController.f()/g()`):

```
[0]=proType (0x33 write / 0xAA read) [1]=cmdType [2..18]=payload [19]=XOR BCC
```

Reads use `p()` (some controllers return a sub-command byte, e.g. MCU version), writes use `q()`.

---

## 2. BLE frame + command table

Opcode values are resolved from `h7130/BleProtocolConstants.java` and, for the 7132/7133/7135
variants, `com/govee/base_h71xx/sku_base/BleProtocolConstants.java` (the split's controllers
import the base class). `proType` is always `0x33` for write and `0xAA` for read unless noted.

| command | op (cmdType) | payload / layout | response | source |
|---|---|---|---|---|
| power / switch | `0x01` | `[0] 1=on 0=off` | `0xAA/0x01` → `[0] on`, `[1] product-version flag`, `[2] mode`, `[3] state-change` | `h7130/ble/controller/SwitchControllerV1.java`; base `SwitchController` |
| gear / heat level | `0x05` | `[0] gear index` | `0xAA/0x05` → `[0] gear` | `h7130/ble/controller/GearController.java` |
| mode (7132/7133/7135) | `0x05` | `[0] mode byte`: gear=`0x01`, auto=`0x03`, fan=`0x09`; auto/fan add mode params | `0xAA/0x05` | `h7132/ble/controller/ModeController.java`, `h7132/adjust/Mode.java` |
| constant temperature (V1) | `0x1A` | `[0] enable, [1] unit/flag, [2..3] target temp LE16 (centi-degree)` | `0xAA/0x1A` → `[0] on, [1] unit, [2] bit7 = °F? , [2..3]&0x7FFF temp` | `h7130/ble/controller/ConstantTemperatureController.java` |
| constant temperature (V3) | `0x1A` | `[0] on, [1] mode, [2..3] temp LE16, bit7 of [2] = °F flag` | same | `h7130/ble/controller/ConstantTemperatureControllerV3.java`, `v3/bean/ConstantTempInfo.java` |
| child lock | `0x10` | `[0] 1=lock 0=unlock` | `0xAA/0x10` → `[0]` | `h7130/ble/controller/ChildLockController.java` |
| oscillation / rotate | `0x18` | `[0] 1=on 0=off` | `0xAA/0x18` → `[0]` | `h7130/ble/controller/RotateController.java` |
| timer group write | `0x13` | `[0] group, [1] enable<<7 \| on, [2] hour, [3] min, [4] repeat, [5] gear` | `0xAA/0x13` → same 6 bytes | `h7130/ble/controller/TimerGroupController.java`, `adjust/timer/TimerInfo.java` |
| timer count / read | `0x13` (present) / `0xFF` (end) | empty read | `[0] count` | `h7130/ble/controller/TimerCountController.java` |
| timer delete | `0x15` | `[0] group` | write result | `h7130/ble/controller/TimerGroupDeleteController.java` |
| timer protected remaining | `0x19` | empty read | `[0..1] int16 LE minutes` | `h7130/ble/controller/TimerProtectedController.java` |
| no-disturb | `0x16` | `[0] enable, [1] startH, [2] startM, [3] endH, [4] endM`; forever = `FF FF FF FF` | `0xAA/0x16` → same 5 bytes | `h7130/ble/controller/NotDisturbController.java`, `adjust/timer/NotDisturbInfo.java` |
| delay-off (V2) | `0x11` | `[0] open, [1..2] minutes LE16` | `0xAA/0x11` → `[0] open,[1..2] totalMin,[3..5] leaveSec` | `h7130/ble/controller/DelayOffController.java` |
| delay-off (V1) | `0x26` | same as above | same | `h7130/ble/controller/DelayOffControllerV1.java` |
| sync time | `0xB5` | `[0..3] epoch seconds LE32, [4]=1, [5] tz hour offset, [6] tz minute offset` | write result | `h7130/ble/controller/SyncTimeController.java` |
| bind thermometer | `0x08` | 6-byte MAC reversed | `0xAA/0x08` → `[0..5] MAC`, all-zero = unbound | `h7130/ble/controller/BindTemperatureController.java` |
| unbind thermometer | `0x09` | empty | write result | `h7130/ble/controller/UnbindTemperatureController.java` |
| MCU version read | `0x07`, sub `0x0A` soft / `0x0B` hard | `p()={0x0A}` or `{0x0B}` | ASCII version string (17-byte valid buffer) | `h7130/ble/controller/McuSoftVersionController.java`, `McuHardVersionController.java` |
| temperature calibration (V1) | `0x1E` | `[0] flag (0x02 write / 0x01 read), [1..2] signed centi-degree calibration LE16` | `0xAA/0x1E` → `[0] result,[1..2] value` | `h7130/ble/controller/TemperatureCaliController.java` (uses base constants `i1()=0x1E`, `Q0()=2`, `S0()=1`) |
| abnormal info (h7132/3/5) | `0x17` | empty read | `[0] code` | `h7132/ble/controller/AbnormalInfoController.java` |
| common switch (h7132/3/5) | `0x1F` | `[0] 1/0` | `0xAA/0x1F` → `[0]` | `h7132/ble/controller/CommonSwitchController.java` |
| power saving | `0x23` | empty read | parsed by `PowerSavingControllerKt.parse4PowerSaving` | `h7132/ble/controller/PowerSavingController.java` |
| swing leaf (h7133/h7135/6/8) | `0x2A` | `[0] 0x01 on / 0x16 off`, optional `[1] speed<<4 \| angle` | `0xAA/0x2A` | `h7133/ble/controller/SwingLeafController.java` |
| work status (h7133) | `0x22` | `[0]=1` | `[0] status` | `h7133/ble/controller/WorkStatusController.java` |
| temperature unit change (H7138) | `0x1F` | `[0] 1=C 0=F` (call passes `!z`) | `0xAA/0x1F` | `h7133/ble/controller/H7138TempUnitChangeController.java` |
| heart / status poll | `0x01` | empty (base `HeartController`) | see §3 | `h7130/ble/HeartControllerV1.java` |

Heater-specific `BleProtocolConstants` (local, `h7130/BleProtocolConstants.java`): `0xEE` is the
notify/long-report proType used in controller events; the write/read proType still comes from
`AbsSingleController` (`0x33`/`0xAA`). Variant controllers import the base constants:
`0x1A` constant temp, `0x05` mode, `0x17` abnormal, `0x1F` common switch/temp unit,
`0x19` timer protected, `0x2A` swing leaf, `0x13` timer group, `0x23` power saving,
`0x22` work status.

### Multi-packet

Not used by the heater control frames (all commands fit in 20 bytes). The only long data is
`ptReal` command lists / sleep-schedule curves, which are separate BLE `MultipleController`
writes from the base library.

---

## 3. BLE notifications / readings

`h7130/ble/BleNotifyComm` registers `WifiNotifyParse` (`0x11`), `DevCommReportParse` (`0xFF`
catch-all), and the plug-in controllers' own notify parsers (each controller's
`parseValidBytes` is invoked for its `cmdType`). `AbsController.m()` strips the header:
read (`0xAA`) → bytes 2..18 into 17 bytes; write (`0x33`) → bytes 3..18 into 16 bytes.

| reading | notify/read op | layout | source |
|---|---|---|---|
| heart / running state | `0xEE/0x01` (heart) | `[0] power, [1] 0=running, [2] mode, [3] gear` → `HeartInfo` | `h7130/ble/HeartControllerV1.java`, `v3/bean/HeartInfo.java` |
| gear | `0xEE/0x05` | `[0] gear` | `h7130/ble/DevCommReportParse.java` |
| child lock | `0xEE/0x10` | `[0] != 0` | same |
| rotate | `0xEE/0x18` | `[0] != 0` | same |
| delay off | `0xEE/0x03` (DevCommReport) or `0x11` | `[0] open, [1..2] totalMin, [3..5] leaveSec` | `DevCommReportParse`, `DelayOffController` |
| not-disturb | `0xEE/0x16` | `[0] enable, [1] forever flag else startH, [2] startM, [3] endH, [4] endM` | `DevCommReportParse`, `NotDisturbInfo` |
| bind thermometer | `0xEE/0x08` | 6-byte MAC, zero = none | `DevCommReportParse` |
| client lock / dump | `0xEE/0x17` | `[0]==0` lock, `[1]` level | `ClientLockEvent` |
| mode change report | `0xEE/0x?` | `bArr[2]` mode | `ReportModeChangeEvent` |
| temperature / constant temp | `0xAA/0x1A` | `[0] on, [1] unit, [2] bit7 °F, [2..3]&0x7F temp LE16` | `ConstantTempInfo` |
| thermometer sensor | read `0x?` (bound sensor) | `ThermometerInfo`: `[0] connected, [1] ?, [2..3] temp LE16, [4] ?, [5..7] 24-bit serial, [8] battery, [9] ?` | `h7130/pact/Model.K0`, `adjust/header/ThermometerInfo` |
| timer groups | `0xAA/0x13` | 6-byte group record (see §2) | `TimerInfo.Companion.c` |
| timer protected | `0xAA/0x19` | int16 LE minutes | `TimerProtectedController` |
| temp calibration | `0xAA/0x1E` | `[0] result, [1..2] signed centi-degree` | `TemperatureCaliController` |
| MCU versions | `0xAA/0x07` | ASCII | `Mcu*VersionController` |
| WiFi connect | `0x11` | `[0]==0` connected | `WifiNotifyParse` |

### Temperature scaling

- `ConstantTempInfo`: `[2..3]` little-endian; bit 7 of `[2]` selects Fahrenheit; the remaining
  15 bits are target temperature in **0.01 °C** (or 0.01 °F when the flag is set).
- `ThermometerInfo`: `[2..3]` signed LE16 = sensor temperature ×100; `[5..7]` 24-bit serial;
  `[8]` battery; `0xFFFFFF` means "--".
- `TemperatureCaliController`: signed LE16 centi-degree offset; response echoes.
- High-temperature / dump state derives from the `warn` bitfield in IoT status (see §4).

---

## 4. IoT commands + status/readings schema

Envelope: **`IotMsgV2`** (`iot/CmdStatusParseV1`, `v3/CmdStatusParseV3`, `scens/IotSwitchCmdBuilderV1`
return `IotMsgProType.V2`). Read/query uses `type=0`, write `type=1`, `origin=32`, `cmdVersion`
runtime, `transaction` generated by `CmdBuilder`.

Commands (`h7130/iot/Cmd.java`):

| cmd | data | meaning | source |
|---|---|---|---|
| `online` | — | online report | `Cmd.d` |
| `turn` | `{"val":0\|1}` | power | `CmdTurn` |
| `status` | — | read full status (query) | `CmdStatus` |
| `ptReal` | `{"command":["<base64 20-byte frame>", ...]}` | tunnel BLE frames | `CmdPtReal` |

`state` key: `{"onOff":0|1,"result":...}`; `op` key: `{"pt":["<base64>", ...]}` (decoded and
fed back through `CmdStatusParseV1.Companion.a`). `CmdStatusParseV1` also handles `warn` in the
raw status JSON: bit 6 (`0x40`) = dump mode, bit 7 (`0x80`) = high-temperature state
(`Model.Y0` → `ItemStatusConfig`).

Status fields observed:
- `state.onOff` (int 0/1), `state.result`
- `op.pt[]` base64 20-byte frames, each dispatched to the same BLE parser by `bArr[1]`
- `warn` (int bitfield; 0x40 dump, 0x80 over-temperature)
- sleep schedule curves (`baseh7130/sleep/network/SleepCurveResponse`) are cloud-side; the
  device side is written as timer/time frames.
- `CmdStatusParseV3` additionally parses the V3 constant-temp and thermometer-sensor records.

`ptReal` is the only way to change heater settings over WiFi: there is no dedicated IoT command
for gear/temp/timer. The app builds the same `AbsSingleController` used for BLE and base64-encodes
its 20-byte `getValue()` (see `CmdPtReal(AbsSingleController)`).

---

## 5. Other protocols

- **BLE advertisement**: `pact/Model.z(scanRecord)` uses
  `BleUtil.parseBleBroadOnOff` and `warn` bits to update on/off and dump/high-temp state without
  connecting. `h7130/add/BleBroadcastProcessor` handles add-flow advertising.
- **HTTP**: `h7130/net/IHumidifyNet` (support-device/SKU queries, thermometer bind), base
  `ResponseSupportDevice` includes per-SKU capability and `PactType/PactCode`.
- **Thermometer sensor**: separate BLE sensor binding (`config/SecretKeyConfig`, MAC bind at
  `0x08`, temperature calibration at `0x1E`); the heater consumes `ThermometerInfo` from the
  bound sensor's advertisements/notifications.
- **OTA**: base OTA only; no heater-specific OTA opcode in this split.
- **No Matter / MQTT / LAN** in this split.

---

## 6. Dynamic effects / motion / music / scenes / DIY

None. Heaters have no colour, music, scene, DIY, gradient, motion or segment engine. The
equivalent "dynamic" features are:

- **Gear/rhythm**: `GearController` (0x05) plus `AbsRhythmGearUI`; gear count from
  `Support.k() = {32,64}` (UI groups), gear index in `[0]`.
- **Auto/fan mode**: `h7132/adjust/Mode` enum GEAR/AUTO/FAN → bytes `0x01/0x03/0x09` carried in
  mode opcode `0x05`.
- **Swing leaf**: `h7133/adjust/component/SwingLeaf` → `0x2A` payload with on/off and
  `speed<<4 | angle` (speed/angle ranges are UI-bounded, values runtime).
- **Power saving**: read `0x23`, parsed by `PowerSavingControllerKt`.
- **Sleep schedule**: `baseh7130/sleep/*` builds per-hour temperature curves and writes them
  through timer/time frames; curve points are runtime data.
- **Constant temperature**: `0x1A`, target range from `Support.d() = {1,100,0}` (1..100 °C or
  °F-scaled), stored as centi-degree.
- **No-disturb**: `0x16` with forever or explicit window.

---

## 7. Source map (traced)

- Registration / SKUs: `h7130/pact/{Support,H7130Maker,SubMaker,Model,Register4Item}.java`,
  `h713a/pact/H713AMaker.java`, `h7132/pact/{Support,H7132Maker,SubMaker}.java`,
  `h7135/pact/{Support,H713xMaker,SubMaker}.java`, `h713b/pact/H713BMaker.java`
- Transport: `h7130/ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,DevCommReportParse,WifiNotifyParse}.java`
- Opcode map: `h7130/BleProtocolConstants.java`, base
  `base_h71xx/sku_base/BleProtocolConstants.java`
- Controllers: `h7130/ble/controller/*.java`, `h7132/ble/controller/*.java`,
  `h7133/ble/controller/*.java`, `h7135/ble/controller/*.java`
- Readings / beans: `h7130/adjust/header/ThermometerInfo.java`,
  `h7130/adjust/timer/{TimerInfo,NotDisturbInfo}.java`, `h7130/v3/bean/{HeartInfo,ConstantTempInfo,ThermometerSensorInfo}.java`
- IoT: `h7130/iot/{Cmd,CmdTurn,CmdStatus,CmdStatusParseV1,CmdPtReal}.java`,
  `h7130/v3/CmdStatusParseV3.java`
- Settings/UI: `h7130/adjust/v1/*`, `h7130/v3/*`, `h7132/adjust/v1/*`,
  `h7133/adjust/v1/*`, `h7135/adjust/v1/*`
- Sleep/thermometer: `baseh7130/sleep/*`, `h7130/adjust/thermometer/*`

## 8. Gaps / unknowns

- `h7130/BleProtocolConstants` is a mutable, sparsely-initialised duplicate; several fields
  (e.g. `A`, `C`, `N`, `Q`, `T`, `W`, `a0`) default to 0 and are never assigned in this split.
  Only the constants actually referenced by controllers are reported above. The authoritative
  opcode values for 7132/7133/7135 come from base `base_h71xx.sku_base.BleProtocolConstants`.
- Gear count / temperature min-max are UI/runtime values (`Support.d() = {1,100,0}`); the exact
  per-SKU °C/°F range is device-reported, not static.
- `PowerSavingController` parse layout (`parse4PowerSaving`) was not fully expanded; the opcode
  (0x23) and read-only direction are certain.
- `TimerInfo.getRepeat()` is a bitmask (7-day); bit order follows `BleUtil.parseBytes4Bit` and is
  not re-derived here.
- `CmdStatusParseV3` was only skimmed; V3 adds constant-temp/thermometer fields but the V1
  `state/op/warn` schema is shared.
- Sleep-curve payloads are cloud-driven; no fixed static layout.
- No Matter/MQTT/LAN protocol exists in this split; all cloud control rides `ptReal`.


---

<!-- split_pact_h7170 -->

# split_pact_h7170 — H7170 / H7171 / H717A / H7173 / H7175 kettles & coffee brewers

## Overview / family and SKUs

Four sibling packages implement the same 20-byte BLE appliance protocol and the same IoT
`ptReal` envelope. They differ only in the mode/recipe tables and the extra features
(delay start, keep warm, water light, DIY recipes, temperature unit).

| goodsType | SKU | product | package | extra |
|---|---|---|---|---|
| 103 | **H7170** | Smart Kettle | `h7170` | 6 modes (green tea/oolong/coffee/red tea/DIY/slider), 4 DIY slots, beep |
| 135 | **H7171**, **H717A** | Smart Kettle | `h7171` | 5 modes (M1–M4/slider), delay start, sensor unit switch |
| 177 | **H7173** | Smart Tea/Coffee Brewer | `h7173` | 5 modes (DIY/boil/tea/coffee/seek), custom tea/coffee/DIY tables, water light 0x1B, 3 setting switches, timer |
| 168 | **H7175** | Smart Kettle | `h7175` | 6 modes (same as H7170), beep, temperature unit switch, DIY |

Sub-libraries: `h7170/pact/SubLib` (`Support.g` = 103), `h7171` (`Support.h` = 135),
`h7173` (`Support.f` = 177), `h7175` (`Support.g` = 168). Makers
`H7170Maker`, `Maker` (H7171), `H7173Maker`, `H7175Maker` all extend `AbsBleWifiSku`.

Transports: **ble + iot** for all five SKUs. There is no Matter, LAN or RF implementation
in the split. `Model`/`DeviceItem` bind BLE address + IoT topic (`BleIotExt`), so the app
can use either path with identical command frames.

## Transports & GATT UUIDs

`h7170/ble/BleComm`, `h7171/ble/BleComm`, `h7173/ble/BleComm`, `h7175/ble/BleComm`:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- heart controllers: `HeartControllerV1` (h7170/h7171/h7173/h7175)
- `BleMultiComm` uses the same UUIDs for multi-packet writes
- `h7170`, `h7173` and `h7175` add an `EquipmentStatusParse` notification parser;
  `h7173`/`h7175` also register a `DevCommReportParse`-style report for state changes
  (h7171 registers only the WiFi parser and relies on the heart notification).

Frame: **20 bytes** `[proType][cmdType][17-byte payload][XOR BCC]`; write proType `0x33`
(51), read proType `0xAA` (170). Some h7171/h7173/h7175 controllers override the write
proType to `0x3A` (58, `BleProtocolConstants.v1()`) for mode/delay/keep-warm frames and
use `0xAA` for reads.

## BLE frame + command table

All opcodes below come from `base_h71xx/sku_base/BleProtocolConstants`
(`BleProtocolConstants.a.*`), resolved to decimal/hex.

| # | command | op | payload | response / notes |
|---|---|---|---|---|
| 1 | power | `0x33/0x01` | `[on][mode][params]` — see `ModeInfo.getModeCmd()`; `[0]=1/0` | `0xAA/0x01` → valid[0] != 0 |
| 2 | mode / recipe | `0x33/0x05` sub `0x00` | `[00][mode][params]` (`h7170`/`h7173`); `h7171`: `[mode][modeTempSet][brewSwitch]`; `h7175`: `[mode][temp*100 LE16]` | `0xAA/0x05` payload `{00}`; valid[0]=0, valid[1]=mode, rest params |
| 3 | gear / level | `0x33/0x05` sub `0x08` | `[08][gear]` | `0xAA/0x05` `[08]` → `[1]=gear` |
| 4 | auto mode table | `0x33/0x05` sub `0x03` | `[03][startGear][startTemp*100 LE16][endGear][endTemp*100 LE16]` | read `0xAA/0x05` `[03]` |
| 5 | custom mode table / DIY | `0x33/0x05` sub `0x02` | `[02][slot][child1 4B][child2 4B]` (10 bytes, unused=FF) | sub-index/custom payload |
| 6 | read current mode | `0xAA/0x05` | `[00]` | mode + params |
| 7 | delay start | `0x33/0x23` (35) | `[on][setMin LE16][timestamp LE32]` (7 bytes) | read `0xAA/0x23`; response same 7 bytes |
| 8 | keep warm | `0x33/0x22` (34) | `[on][setMin LE16][setMin LE16]` (5 bytes; duplicated field) | read `0xAA/0x22`; response `[on][setMin LE16][leaveMin]` |
| 9 | real-time temperature | `0xAA/0x10` (16) | none | valid[1..2] signed BE16 (0.1 °C? — see notes) |
| 10 | equipment status | `0xAA/0x19` (25) | none | valid[0] = `WorkStatus` (0 idle,1 heating,2 keep-warm,3 boiling,4 finish,5 cooling,6 reservation) |
| 11 | abnormal info | `0x33/0x17` (23) | `01` request | read `0xAA/0x17` → `[flag][code]` |
| 12 | beep | `0x33/0x1F` (31) | `[06][00/01]` | read `0xAA/0x1F` `[06]` |
| 13 | temp unit switch | `0x33/0x1F` | `[08][00/01]` (H7171 sensor unit, H7175 temp unit) | read `[08]` |
| 14 | water light (H7173) | `0x33/0x1B` (27) | single: `[01][mode][R G B]`; all: `[05][keepTemp RGB][boil RGB][tea RGB][coffee RGB][diy RGB]` | read `[01]`/`[05]` |
| 15 | setting switch (H7173) | `0x33/0x1F` | `[id][00/01]`; ids: 6=beep, 8=temp unit, 3=water-light switch | read `[id]` |
| 16 | timer (shared) | `0x33/0x13` (19) | `NewTimerV1Controller` 8-byte timer record | read `0xAA/0x13` |
| 17 | DIY read (H7170/H7175) | `0xAA/0x05` | `[02][slot]` | 10-byte DIY record |
| 18 | DIY write (H7170/H7175) | `0x33/0x05` | `[02][slot][child1 4B][child2 4B]` | write result |
| 19 | WiFi/BLE state notify | `0xEE/0x11`? parser cmdType 17 | — | `[0]==0` connected |

`h7173` also exposes `ModeReadController` (read a specific mode):
- `[mode]` for plain modes, `[mode][id]` for DIY/tea/coffee
- responses:
  - `0x05` payload `[00]` → current mode record
  - first byte 1/3/4 (DIY/TEA/COFFEE) → 10-byte custom table
  - first byte 2 (BOIL) or 5 (SEEK) → temperature value ×100

### Exact mode payloads

`h7170` (`adjust/Mode`, `ModeInfo.getModeCmd`, `ModeCurController`):
- GREEN_TEA = `02`, OO_LONG_TEA = `03`, COFFEE = `04`, RED_TEA = `05`, DIY = `01`,
  SLIDER = `06`
- mode frame payload `[00][mode]`; SLIDER adds `<temp*100 LE16>`;
  DIY adds `<diyId 1..4>`; the `switch` mode byte uses `[on/off][mode]` (no `00` prefix).
- `ModeInfo.parseModeInfo` decodes `[1]=mode`, `[2]=gear` (GEAR), `[2]=diyId` (DIY),
  `[2..3]=temp*100 LE16` (SLIDER), `[2]=teaId` (TEA/COFFEE on H7173-style tables).

`h7173` (`adjust/Mode`):
- DIY = `01`, BOIL = `02`, TEA = `03`, COFFEE = `04`, SEEK = `05`
- write: `[00][mode]`, with `[id]` for tea/coffee/DIY, `[temp*100 LE16]` for seek;
  direct temperature write is `[mode][temp*100 LE16]` (`ModeWriteTempController`).
- custom table write is `[mode][index][childA 4B][childB 4B]` where child =
  `[temp*100 LE16][diyId][brewOpen]` (unused bytes `FF`).
- custom-table read selects `[mode][index]`; response child pairs are parsed with
  `ModeCustomChild.Companion.c`.

`h7175` (`adjust/Mode`): same values as H7170 (`02/03/04/05/01/06`);
mode write is `[mode][temp*100 LE16]`, current-mode read `[00]`.

`h7171` (`adjust/Mode`): SLIDER = `1`, MODE_M1..M4 = `2..5`.
Current-mode write is `[modeByte][modeTempSet][brewSwitch]`; read `[00]`.

Mode tables (defaults): GREEN_TEA 180 °C, OO_LONG_TEA 195 °C, COFFEE 205 °C,
RED_TEA 212 °C (BOIL_TEMP), DIY 1..4, SLIDER temperature from UI. Temperature is always
stored/sent as `value*100` little-endian; `h7173` uses `212` as `BOIL_TEMP`.

### Delay start / keep warm / temperature exact layouts

- Delay start (`DelayStartInfo`): `[isOn][setMin LE16][timestamp LE32]` — 7 payload bytes.
  `timestamp` = unix seconds (`System.currentTimeMillis()/1000 + setMin*60`); response is
  parsed back into hour/minute with `TimeUtil.getTime`.
- Keep warm (`KeepWarm`): writer builds `[on][setMin LE16][setMin LE16]` (the two 16-bit
  fields are duplicated in `KeepWarm.parseModeStartToBytes`); reader uses
  `[on][setMin LE16][leaveMin]`. `setMin` default 120.
- Real time temp: read `0x10`, response `valid[1..2]` as signed BE16; H7173/H7175 use
  `ModeReadTempEvent` with `value/100` for mode temperature, and display uses 0.1 °C
  scaling for the live probe (see Gaps).
- Equipment status: read `0x19`, response `valid[0]`; mapping `WorkStatus.Companion.a`
  (0 IDLE, 1 HEATING, 2 KEEPING_WARM, 3 BOILING, 4 FINISH_BOILING_WATER, 5 COOLING,
  6 RESERVATION).
- Abnormal info: write `0x17` payload `01`, response `[flag][code]`; the read path also
  carries a 72-hour-clear flag.
- Beep / temp unit / sensor unit: `0x1F` with a sub-id and 0/1. Defaults: beep on, unit
  Celsius unless the per-device SkuSp value says Fahrenheit.

### Water light (H7173)

`h7173/ble/controller/WaterLightController` (cmdType `0x1B`):

- single-mode payload: `[01][modeByte][R][G][B]`
  - mode bytes: DIY=1, BOIL=2, TEA=3, COFFEE=4, KEEP_TEMP=5.
  - colour values (24-bit, sent big-endian via `getSignedBytesFor3`): BLUE `#000055`,
    ORANGE `#550A01`, GREEN `#005500`, YELLOW `#553200`, PURPLE `#550055`,
    INDIGO `#005050`.
- all-modes payload: `[05]` + five RGB triples in order
  `KEEP_TEMP, BOIL, TEA, COFFEE, DIY` (16 payload bytes).
- read: `p()` sends the sub-type, response `[subtype][mode][RGB]` (single) or
  `[05]` + five RGB triples; `WaterLightColor.parseBytes2Int` reads 3 bytes at an offset.

### Heart / state notification

`HeartControllerV1.parseValidBytes` (h7170/h7173/h7175):

`[0]` on/off (==1), `[1]` mode-change value (mode byte), `[3..4]` signed BE16 temperature,
`[5]` keep-warm/active flag (h7173/h7175), `[6]` `WorkStatus` (h7173/h7175).
H7170 uses `[5]` for work status. H7171's heart parser is the shared
`HeartControllerComm` and adds mode/auto-off fields.

## BLE notifications / readings

| parser | cmdType / header | layout | source |
|---|---|---|---|
| `WifiNotifyParse` | 17 (0x11) | `[0]==0` connected | all four packages |
| `EquipmentStatusParse` | 25 (0x19) | `[0]` = WorkStatus | h7170/h7175 |
| `DevCommReportParse` | report header `0xEE` (byte0), sub-command in byte1 | switch on `bArr[1]`: `0x05` mode, `0x1F` switches, `0x16` not-disturb, `0x26` delay-off, `0x17` abnormal, `0x1D`? etc.; payload is re-based by 2 bytes for h7173 | h7173/h7175 |
| `HeartController` | read reply to `0xAA/0x01` | 17 valid bytes, layout above | all |
| `EquipmentStatusNotify` (h7170 `BleComm.parse`) | `0xEE` + status byte | `[0]=0x19`, `[1]=0x19`? → WorkStatus from valid[0] | h7170 |
| `ModeReadTempEvent` / `ModeReadCurEvent` / `ModeReadCustomEvent` | h7173 mode reads | temp/×100, custom 10-byte records | h7173 |

IoT status frames arrive as `op.command[]` base64 and are parsed with the same layouts
(`CmdStatusParseV1.doParseJson`), so a cloud-only device uses the identical parser.

## IoT commands + status/readings schema

Envelope: `Write` + `AbsCmdWrite`, `type=1`, `origin=32`, `cmdVersion=0`.
`Cmd` names: `state`, `op`, `online`, `turn`, `status`, `ptReal`, `multiSync`.

| cmd | data | source |
|---|---|---|
| `turn` | `{val:0|1}` | `base_h71xx/sku_base/iot/CmdTurn` |
| `ptReal` | `{command:["<base64 20-byte frame>", …]}` | `CmdPtReal`, used for every mode/keep-warm/delay/DIY/water-light frame |
| `multiSync` | `{command:[…]}` | `CmdMultiSync`, used for multi-device sync |
| `status` (read) | type 0, no data | `CmdStatus`, `IotOpV1.n()="status"` |
| `online` | read/keepalive | `IotOpH71xx`/`IotOpV1` |

`CmdStatusParseV1` reads `state` (`{onOff, result}`) and `op.command[]`, then applies the
same BLE parsers:
- `0x05` mode, `0x10` temperature (signed 16-bit / later ×100), `0x19` equipment status,
  `0x22` keep-warm, `0x23` delay start, `0x17` abnormal, `0x1B` water light (H7173),
  `0x1F` switches, `0x13` timers.
- `op` reads with `0x05`/`0x23` may carry a second payload byte selecting read vs write.
- Cloud response `state` fields observed: `onOff` (int), `result` (int); `op` result is
  `{command:[base64…]}` (`ResultPt`).

## Other protocols

- **BLE broadcast / advertising**: not used; all state is GATT notify/read.
- **WiFi/MQTT**: no LAN/UDP implementation in the split. `BleIotExt.topic` is the cloud
  account topic; `Model` exposes it via `DefInfo.F0(topic)`.
- **Matter/IR/RF/Thread**: absent.
- **OTA**: shared base OTA transport (no kettle-specific opcodes).

## Dynamic effects / motion / music / scenes / DIY

These are appliances — no colour/scene engine. The "dynamic" behaviours are mode/recipe
tables:

| effect | op | payload | parameters |
|---|---|---|---|
| mode / recipe | `05/00` | `[00][mode]` + params | H7170: green tea 2, oolong 3, coffee 4, red tea 5, DIY 1, slider 6; H7171: slider 1, M1–M4 2–5; H7173: DIY 1, boil 2, tea 3, coffee 4, seek 5; H7175: same as H7170 |
| gear | `05/08` | `[08][gear]` | gear range from device config (typically 1..5/9/12; H7105-style table) |
| auto ramp | `05/03` | `[03][startGear][startTemp*100 LE16][endGear][endTemp*100 LE16]` | start/end gear and temperature, ×100 |
| custom/DIY table | `05/02` | `[02][slot][child 4B][child 4B]` | child = `[temp*100 LE16][diyId][brewOpen]`; slots 1..4 (H7170), 1..4/8 (H7173) |
| water light (H7173) | `1B` | single `[01][mode][RGB]`; all `[05]` + 5 RGB | modes DIY/BOIL/TEA/COFFEE/KEEP_TEMP; 6 colours |
| delay start | `23` | `[on][setMin LE16][timestamp LE32]` | one-shot delayed start |
| keep warm | `22` | `[on][setMin LE16][setMin LE16]` | minutes 0..? (default 120) |
| coffee/tea brew steps | `05/02` + `23` | custom table + delayed start | H7170 `coffeeTimer` UI builds step tables; H7173 `CustomModeWriteController` |

No motion motor, no microphone/music, no addressable LEDs.

## Source map (paths traced)

- `jadx-splits/split_pact_h7170/sources/com/govee/h7170/{pact/Support,pact/SubLib,pact/SubMaker,pact/H7170Maker}.java`
- `…/h7170/ble/{BleComm,BleMultiComm,BleNotifyComm,HeartControllerV1,EquipmentStatusParse,WifiNotifyParse}.java`
- `…/h7170/ble/controller/{SwitchController,ModeController,ModeCurController,ModeStartController,KeepWarmController,RealTimeTemController,EquipmentStatusController,BeepSwitchController,AbnormalInfoController,DiyModeReadController,DiyModeWriteController}.java`
- `…/h7170/adjust/{Mode,ModeInfo,ModeDiyChild,KeepWarm,DelayStartInfo,WorkStatus}.java`
- `…/h7170/iot/CmdStatusParseV1.java`, `…/h7170/scens/SquareOp4BleIot.java`
- `…/h7171/{pact/Support,pact/Maker}.java`, `…/h7171/ble/controller/*`, `…/h7171/iot/CmdStatusParseV1.java`
- `…/h7173/{pact/Support,pact/H7173Maker,pact/H7173Model}.java`, `…/h7173/ble/controller/{ModeReadController,ModeCurWriteController,ModeWriteTempController,CustomModeWriteController,WaterLightController,SettingSwitchController,DefiniteTimeController,KeepWarmController}.java`, `…/h7173/adjust/{Mode,ModeInfo,ModeCustom,ModeCustomChild,WaterLight,WaterLightColor,WaterLightMode}.java`
- `…/h7175/{pact/Support,pact/H7175Maker}.java`, `…/h7175/ble/controller/{ModeController,ModeCurController,TempUnitSwitchController,BeepSwitchController,DiyModeReadController,DiyModeWriteController,DefiniteTimeController,KeepWarmController}.java`, `…/h7175/ble/{EquipmentStatusParse,DevCommReportParse}.java`
- `jadx-base-7.7.10/sources/com/govee/base_h71xx/sku_base/BleProtocolConstants.java`
- `…/base_h71xx/sku_base/iot/{Cmd,CmdTurn,CmdPtReal,CmdMultiSync,CmdStatus,ResultPt,IotOpH71xx}.java`
- `…/base_h71xx/sku_base/ble/controller/{DelayOffControllerV1,NotDisturbController,GetThermometerController}.java`
- `…/base2light/ble/controller/{AbsSingleController,AbsModeController,AbsMode,AbsNotify}.java`
- `jadx-base-7.7.10/sources/com/govee/base2home/iot/{Write,AbsCmd,AbsCmdWrite}.java`

## Gaps / unknowns

- `KeepWarm.parseModeStartToBytes` duplicates `setMin` into both 16-bit fields; the parser
  reads the second field as `leaveMin`. Confirm whether the device expects one or two
  distinct values.
- Temperature scaling differs by path: live probe reads a signed 16-bit raw value, while
  mode temperature is `value*100`; display conversion uses `0.1 °C` in some views. Exact
  scale/offset is runtime/UI dependent.
- `h7111`-style gear range helpers are not present here; gear limits come from per-SKU
  config (`H7105`-style `getModeMaxGear`, `SkuSp`).
- H7173's `ModeWriteCurController` has an odd branch (`DIY` → `ModeInfo.d()` which builds
  `[00][05][temp]`); it likely relies on a UI pre-selection. Treat the generic
  `[00][mode]`/`[00][mode][id]`/`[00][mode][temp*100]` forms as authoritative.
- Coffee/tea timer step tables are cloud/UI data; only the wire records are static.
- H7175 `ModeController.parseValidBytes` is partially decompiled (JADX unsupported);
  mode parsing was inferred from the sibling H7970-style record and the IoT parser.
- Notification header handling differs per package: h7170/h7100/h7105 use the `0xEE`
  report header, while h7171 only registers the WiFi parser and relies on the heart
  notification for state.


---

<!-- split_pact_h7172 -->

# split_pact_h7172 — H7172 / H7178 / H717D ice maker & water dispenser

Source root: `decompiled/jadx-splits/split_pact_h7172/sources/com/govee/h7172/`

## Overview / family and SKUs

| SKU | goodsType | notes |
|---|---|---|
| H7172 | 117 (`Support.j`) | ice maker |
| H7178 | 211 (`Support.l`) | ice maker variant (`SettingExtH7178`) |
| H717D | 212 (`Support.k`) | ice maker/water dispenser (`H717DMaker`, `PairGuideActivity`, `H717DChartViewInfo`) |

- `Support.t`/`u`/`v` keys `{117, 211}`; `Support.c()` adds 212 via `H717D`.
- `Support.o` / `p` / `q` / `r` are mode-id groups: {1,2,3,7,8}, {4,5,6,9,10},
  {1,2,3,4,7,8,9}, {5,6}.
- `Support.m`/`n` are the mode-name maps (10 ice/water modes).
- `Support.w` = soft versions `4.01.00 .. 4.01.04` (feature gating).
- Transport: `ble + iot`. `pact/SubLib` keys from `Support.c.m()`, `pact/SubMaker` adds
  `H7172Maker` and `H717DMaker`. `AbsBleWifiSku` items.
- UI: `adjust/AdjustAc`, `adjust/header`, `adjust/component/ModeUI`, dialogs for wash/ice/delay.
- Settings ext: `pact/Ext{devicePushNotiOnOff, waterShortageOnOff=1, fullReminderOnOff=1,
  chartStorageTime=30}`. These are user preferences / push toggles, not status readings
  (see `STATUS-PROPERTIES.md`).
- Water leak push: `push/WaterLeakPush`.

## Transports & GATT UUIDs

- Service `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/BleComm.java`, `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`
- Heart: `ble/HeartControllerV1` (cmdType 0x01, read)
- Notify: `BleNotifyComm`, `ble/WifiNotifyParse`.

## BLE frame + command table

Frame `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`; write 0x33, read 0xAA.

`ble/controller/*` derive command types from base `com.govee.base_h71xx.sku_base.BleProtocolConstants`:

| controller | field/method | value |
|---|---|---|
| `SwitchController` | literal | 0x01 |
| `BaseSwitchController` | `D()` | 0x1F (31) |
| `DelayStartController` | `I()` | 0x23 (35) |
| `EquipmentStatusController` | `O()` | 0x19 (25) |
| `AbnormalInfoController` | `w()` | 0x17 (23) |
| `IceSizeController` | `d0()` | 0x05 |
| `IceFullSwitchController` | `D()` | 0x1F |

Derived commands:

| command | op | payload | response | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `[0]=0|1`, if on `[1]=1` (with ice) or `2` | `[0]!=0` | `ble/controller/SwitchController.java` |
| base switch (4 funcs) | `0x33/0x1F` | `[0]=switchId, [1]=state` where switchId 6/7/8/9 = `z()/X()/n1()/N0()`, state `N()`=1 on / `M()`=0 off | `[0]=switchId, [1]!=0` | `ble/controller/BaseSwitchController.java`, `BaseSwitchControllerKt.java` |
| delay start | `0x33/0x23` | `[0]=enable, [1..2]=delayMinutes LE16, [3..6]=startEpochSec LE32, [7]=Mode.value` | parse `DelayStartInfo` | `ble/controller/DelayStartController.java` |
| equipment status read | `0xAA/0x19` | none | `[0]`=WorkStatus value | `ble/controller/EquipmentStatusController.java` |
| abnormal info | `0xAA/0x17` | `{1}` read / write `{1}` | `[0]=clear72h, [1]=abnormalStatus` | `ble/controller/AbnormalInfoController.java`, `AbnormalInfoControllerKt.java` |
| ice size | `0x33/0x05` | `[0]=Mode.value` (BIG=1, MIDDLE=2, SMALL=3) | `[0]` mode | `ble/controller/IceSizeController.java` |
| ice full switch | `0x33/0x1F` | `[0]=switchId, [1]=state` | parse | `ble/controller/IceFullSwitchController.java` |

`DelayStartInfo` byte layout (`adjust/DelayStartInfo.Companion.b`): `[0]=enable`,
`[1..2]=delay minutes LE16`, `[3..6]=start epoch seconds LE32`, `[7]=mode`.

`BaseSwitchController.q()` payload is `{switchId, on?1:0}`; `p()` read payload
`{switchId}`; read reply `[0]=switchId, [1]!=0`.

## BLE notifications / readings

`ble/WifiNotifyParse`, `BleNotifyComm`; plus read controllers above.

`WorkStatus` (`adjust/WorkStatus.java`) values:
IDLE 0, ICE_MAKING 1, ICE_MAKE_FINISH 2, WASHING 3, WASH_FINISH 4, RESERVATION 5.

`Mode` (`adjust/Mode.java`): BIG_ICE 1, MIDDLE_ICE 2, SMALL_ICE 3; mode ids 1..10 are the
UI modes (`Support.m/n`), separate from ice size.

`DeviceSettingInfo` is populated from:
- `BaseSwitchControllerKt.parseCommSwitchInfo` → four boolean switches,
- `AbnormalInfoControllerKt.parseAbnormalInfo` → `clear72h` (bArr[0]==1) and
  `abnormalStatus` (bArr[1]),
- `DelayStartInfo` → delay config,
- `IceSizeController` → current mode.

## IoT commands + status/readings schema

`adjust/v1/IotOpV1.java`:
- read/status command name `n()` = `"status"`, cmd object `CmdStatus`.
- write command name `q()` = **`"ptReal"`** — all writes tunnel BLE frames.
- `r(cmd)` maps via `Cmd.a.a(cmd)` (base `base_h71xx.sku_base.iot.Cmd`).

`iot/CmdStatusParseV1.java`:
- `State` (`state` object) has `onOff:int` and `result:int`; `onOff==1` → on.
- `op` → `ResultPt.getPtBytes()` list of 20-byte frames; for each:
  - `[0]==O0()` and `[1]==d0()` → ice size mode `[2]`,
  - `[1]==O()` (0x19) → `WorkStatus` from `validBytes[0]`,
  - `[1]==w()` (0x17) → abnormal info,
  - `[1]==I()` (0x23) → delay-start info,
  - `[1]==D()` (0x1F) → base switch info,
  - `[0]==O0()` and `[1]==d0()` variant for mode.
- `parsePtReal4Read(json, ext)` parses `op` frames for read replies.

## Other protocols

- WiFi/cloud IoT: `ptReal` writes, `status` reads via base h71xx IoT framework.
- OTA: `OtaPactConfig` in `Support`.
- Push: `push/WaterLeakPush` (water leak notification).
- Chart history: `H717DChartViewInfo` (DB) + `chartStorageTime` ext (30 days default).
- No Matter/LAN code.

## Dynamic effects / motion / music / scenes / DIY

Not a lighting family. Dynamic behaviour is the appliance **mode/state machine**:

- Modes 1..10 (`Support.m/n`): ice making, wash, water dispensing, reservation, etc.;
  mode id sets `Support.o/p/q/r` select which modes support which settings.
- `adjust/notify_event/*` events: ModeSelected, ModeChange, ModeStarted, ParseMode,
  DelayStart, SwitchTemperature, BuzzerRemind, Clear72h, SettingInfoUpdate.
- Delay start: 0x23 with delay minutes + absolute start epoch + mode.
- Ice size: 0x05 with 1/2/3 (big/middle/small).
- Wash / finish dialogs drive the 0x1F switch ids 6..9 (wash, child lock, ice-full, etc.).
- Water shortage / full reminder / chart storage configured via `pact/Ext`.

## Source map

- `Support.java`, `pact/SubLib.java`, `SubMaker.java`, `H7172Maker.java`, `H7178Maker.java`,
  `H717DMaker.java`, `DeviceItem.java`, `Model.java`, `BleIotInfoV1.java`, `Ext.java`,
  `WorkStatus.java`
- `ble/Ble.java`, `BleComm.java`, `BleMultiComm.java`, `BleNotifyComm.java`, `WifiNotifyParse.java`,
  `HeartControllerV1.java`, `ble/controller/*.java`
- `iot/CmdStatusParseV1.java`
- `adjust/v1/{BleOpV1,IotOpV1,BlePactV1,IotPactV1,FrameV1,CommandOpV1,SettingAc}.java`,
  `adjust/{Mode,WorkStatus,DelayStartInfo,AdjustAc}.java`, `adjust/notify_event/*`
- `add/{PairAcV1,BleBroadcastProcessor,ConnectDialog,SettingExt,SettingExtH7178}.java`
- `push/WaterLeakPush.java`, `config/WorkStatusConfig.java`
- base: `com/govee/base_h71xx/sku_base/BleProtocolConstants.java`,
  `com/govee/base_h71xx/sku_base/iot/*`

## Gaps / unknowns

- Only 4 base-switch ids (6/7/8/9) are mapped; the actual function names come from UI strings
  and `SettingAc`, not the protocol.
- `Support.m`/`n` mode names are resource ids (not literals) — mode names are not statically
  resolvable to English text.
- `H717D` uses shared settings (`CommSharedSettingsAc`) and an extra device-state class
  `H717DDeviceState`; its goods-type 212 command set is assumed identical to 117/211.
- `CmdStatusParseV1` does not parse `state.result` semantics.
- Ice-full controller shares cmdType 0x1F with base switches; differentiated by switchId byte.


---

<!-- split_pact_h7180 -->

# split_pact_h7180 — H7180 smart rice cooker / multi-mode cooker

Source root: `decompiled/jadx-splits/split_pact_h7180/sources/com/govee/h7180/`

## Overview / family and SKUs

Single SKU **H7180** (goodsType **152**, `Support.o`). `Support.q` = `{152}`, `Support.r/s` =
`{"152"}`. Maker: `pact/H7180Maker extends AbsBleWifiSku`; `pact/SubMaker` has only
`H7180Maker`. Pact registration: `GoodsType.beProtocol(1,1)` and `(2,1)` for 152.

Modes (`Support.e`..`Support.j`, `adjust/Mode.java`): RICE(1), SATUTE/sauté(2), STEAM(3),
SLOWCOOK(4), DIY(5), plus NONE(0). Separate features: KEEP TEMP, WEIGH, RECIPE MAKING,
COLLECT WATER REMIND, DO-NOT-DISTURB.

- `pact/Model extends AbsModel4Cooker`; `Model.V()` = `"online"`;
  `Model.Y()` = run mode, `Model.A0()` = weigh, both via `HumidifierStatusConfig`.
- `pact/Ext{completionNotiOnOff, mcuHardVersion}`.
- Settings UI: `adjust/v1/H7180BaseWifiBleSettingAcV3`, `SettingAc`, `SharedSettingVM`.
- Transport: `ble + iot`.

## Transports & GATT UUIDs

- Service `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/BleComm.java`, `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`
- Notify parsers: `ble/WifiNotifyParse`, `ble/WeighNotifyParse`, `ble/RecipeMakingNotifyParse`,
  `ble/DevCommReportParse`.

## BLE frame + command table

Frame `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`.
Most controllers extend `AbsSingleController` (write 0x33 / read 0xAA). **Exception:**
`ModeController` overrides `getProType()` to `BleProtocolConstants.a.v1()` = **0x3A (58)** for
writes and `O0()` = **0xAA (-86)** for reads; cmdType = `d0()` = **0x05**.

| command | op | payload | response | source |
|---|---|---|---|---|
| mode/submit | `0x3A/0x05` write, `0xAA/0x05` read | `[0]=modeByte`; for DIY also `[1]=diyIndex` | `[0]=modeByte, rest bean` | `ble/controller/ModeController.java` |
| keep temp | `0x33|0xAA/0x22` | `[0]=type(1 inner/2 outside), [1]=start, [2..3]=temp*100 LE16, [4..5]=keepWarmSumTime LE16` (type 1 adds mode byte at [1]) | `KeepTempBean` | `ble/controller/KeepTempController.java`, `adjust/component/widget/KeepTempBean.java` |
| weigh | `0x33|0xAA/0x23` | `[0]=start, [1]=unit` | `[0]=start, [1..2]=weight LE16 (bit15 = negative), [3]=unit` | `ble/controller/WeighController.java`, `model/WeighBean.java` |
| recipe making | `0x33|0xAA/0x24` | `[0]=start, [1]=type` (start=1 only start byte) | `[0]=start,[1]=flagFinish,[2]=deviceState,[3..4]=menuCode LE16,[5]=index,[6]=mode,[7]=gear,[8..9]=workMinute,[10..11]=leaveMinute` | `ble/controller/RecipeMakingController.java` |
| recipe multi | `0xA3/0x24` | `MenuListMenuResponse.Data` bytes (multi V1) | event | `ble/controller/RecipeMakingModeMultipleControl.java` |
| collect water remind | `0xAA/0x25` | none | `[0]==1` → remind event | `ble/controller/CollectWaterController.java` |
| not disturb | `0x33|0xAA/0x16` | `[0]=enable(1)/disable(0), [1]=startHour, [2]=startMin, [3]=endHour, [4]=endMin, [5]=0 scheduled / 1 forever` | `H7180NotDisturbInfo` | `ble/controller/H7180NotDisturbController.java` |
| abnormal info | `0xAA/0x17` | `{1}` | `[0]=clear72h,[1]=abnormalStatus` | `ble/controller/AbnormalInfoController.java` |
| DIY multi | `0xA3/0x05` | `CookingDiyModelBean` bytes (`DiyModeMultipleControl`) | event | `ble/controller/DiyModeMultipleControl.java` |
| equipment status | `0xAA/0x19` | none | `[0]=Mode, [1]=DeviceState` | base `BleOpV1` array |
| delay off | `0x33/0x?` | base `DelayOffController(0,0,3)` | — | base `base_h71xx` |

Mode payloads (`ble/controller/model/*`):

```
RICE (mode 1):
[0]=1 [1]=flavor [2..3]=reservationMinutes LE16 (0 if off) [4]=keepWarm
[5..6]=keepTemp*100 LE16 [7..8]=keepWarmSumTime LE16 [9]=start
read: [0]=flavor [1..2]=reservation LE16 [3]=keepWarm [4..5]=temp*100 [6..7]=keepWarmSumTime
      [8]=start [9..10]=leaveTime [11..12]=keepWarmMinute [13]=sumTime [14]=deviceState
SATUTE (mode 2):
[0]=2 [1]=gear [2]=start
read: [0]=gear [1]=start [2..3]=runTime [4]=deviceState
STEAM (mode 3):
[0]=3 [1..2]=workTime LE16 [3..4]=reservation LE16 [5]=keepWarm
[6..7]=keepTemp*100 [8..9]=keepWarmSumTime [10]=start
read: +[10..11]=leaveTime [12..13]=keepWarmMinute [14]=deviceState
SLOWCOOK (mode 4):
[0]=4 [1]=gear [2..3]=workTime [4..5]=reservation [6]=keepWarm
[7..8]=keepTemp*100 [9..10]=keepWarmSumTime [11]=slowCookType [12]=start
read: +[11..12]=leaveTime [13..14]=keepWarmMinute [15]=deviceState
DIY (mode 5):
[0]=5 [1]=diyIndex; multi frames carry CookingDiyModelBean:
  start, stepState, reservation LE16, {programCode, workMinute LE16, leaveMinute LE16} up to 3
  programs, deviceState
```

`DeviceState` / `WorkStatus` / `WeigtUnit` enums live in `ble/controller/model/`.

## BLE notifications / readings

`iot/CmdStatusParseV1.Companion.b(byte[])` maps 20-byte BLE frames by `bArr[1]`:

| cmdType | parse |
|---|---|
| 0x05 (d0) | `ParseModeEvent` ← mode payload (`[0]==0x3A && [2]==1` = ack/ignore) |
| 0x16 (J0) | `H7180NotDisturbInfo` → ParseNotDisturb/UpdateNotDisturb events |
| 0x17 (w) | work status / abnormal byte |
| 0x22 (34) | `KeepTempBean` (`[0]!=0x3A` guard) |
| 0x23 (35) | `WeighBean` (`[0]!=0x3A`) |
| 0x24 (36) | `RecipeMakingBean` (ignore echoes 0x3A/0x3B? guarded) |
| 0x25 (37) | `[0]==1` → `UpdateCollectWaterRemindEvent` |
| 0x19 (25) | mode + `DeviceState` update |

`WeighBean` weight decode: `(b1>>7)&1 == 1` → negative, using low-7 bits + second byte LE16.
Unit from `WeigtUnit` (CAN default unless `Support.a.l()`).

## IoT commands + status/readings schema

`adjust/v1/IotOpV1` (base `AbsIotOpV1`): status cmd `"status"` (`CmdStatus`), write cmd
**`"ptReal"`**. `Cmd.a.a(cmd)` maps command name.

`iot/CmdStatusParseV1.Companion.c(json, ...)`:
- `state` JSON key = `HumidifierStatusConfig.RUN_STATE`; `State.getOnOff()==1` → on.
- `op` = `ResultPt.getPtBytes()` — every 20-byte frame is dispatched to the table above.
- `parseAtmosphereJson(str)` and `parseModeJson(str)` parse `op` alone for atmosphere/mode.

## Other protocols

- WiFi/cloud IoT (status + ptReal).
- OTA/report: base `ReportOtaPactController` in `BleOpV1`.
- Recipe menu service: `net/*`, `MenuListMenuResponse` (recipe making multi payload).
- `HumidifierStatusConfig` is reused to store run mode / weigh per SKU+device.
- No Matter/LAN in this split.

## Dynamic effects / motion / music / scenes / DIY

Appliance cooking programs, not lighting:

- **DIY cooking program** (`CookingDiyModelBean`, `DiyProgram`, `DiyStateView`,
  `DiyStateCookingAdapter`): up to 3 programs, each `{programCode, workMinute, leaveMinute}`,
  plus reservation + device state. Serialised by `DiyModeMultipleControl` (cmdType 0x05,
  multi V1 0xA3).
- **Recipe making** (`RecipeMakingBean`, `MenuListMenuResponse`, `RecipeMakingViewModel`,
  `RecipeMakingStepAc`): menu code + gear + work/leave minutes; multi frame
  `RecipeMakingModeMultipleControl` (0xA3/0x24).
- **Keep temp** (`KeepTempBean`, `KeepTempView`, `KeepTempFgDialog`,
  `KeepTempDetailFragment`): inner/outside type, target temp ×100, keep-warm duration.
- **Weigh** (`WeighBean`, `WeighFgDialog`, `WeighDetailFragment`): scale reading + unit.
- **Modes**: rice/sauté/steam/slow-cook/diy state views under
  `adjust/component/state/*`; reservations in `ReservationBean`/`ReservationView`.
- **Do not disturb**: `DisturbModeAc`, `H7180NotDisturbInfo`.
- **Collect water remind**: `CollectWaterController`, `UpdateCollectWaterRemindEvent`.

## Source map

- `Support.java`, `pact/SubLib.java`, `SubMaker.java`, `H7180Maker.java`, `DeviceItem.java`,
  `Model.java`, `Ext.java`, `AbnormalInfoUtil.java`, `BleIotInfoV1.java`
- `ble/Ble.java`, `BleComm.java`, `BleMultiComm.java`, `BleNotifyComm.java`, `WifiNotifyParse.java`,
  `WeighNotifyParse.java`, `RecipeMakingNotifyParse.java`, `DevCommReportParse.java`,
  `ble/controller/*`, `ble/controller/model/*`
- `iot/CmdStatusParseV1.java`
- `adjust/v1/*` (BleOpV1, IotOpV1, BlePactV1, IotPactV1, FrameV1, SettingAc, ExtV1),
  `adjust/Mode.java`, `adjust/ModeInfo.java`, `adjust/component/*`, `adjust/viewmodel/*`,
  `adjust/notify_event/*`, `adjust/thermometer/HumidifierStatusConfig.java`
- base: `com/govee/base_h71xx/sku_base/BleProtocolConstants.java`,
  `com/govee/base_h71xx/sku_base/adjust/AbsModel4Cooker`,
  `com/govee/base_h71xx/sku_base/iot/*`

## Gaps / unknowns

- Not-disturb "forever" byte is asymmetric: writer emits `[5]=0` for scheduled and `1` for
  forever, while parser treats `[5]==0` as forever — likely a bug or inverted semantic.
- `DeviceState` / `WorkStatus` / `WeigtUnit` enum numeric values are not all literal in this
  split (some come from base `BleProtocolConstants`).
- Recipe menu `MenuListMenuResponse.Data` byte layout is in `net/` and not fully decoded.
- `ModeController` read proType 0xAA but write proType 0x3A is unusual; other controllers use
  standard 0x33.
- `Support.c()` = 1 (chart/version flag) is not documented.


---

<!-- split_pact_hollowlamp -->

# split_pact_hollowlamp — hollow lamps, straight floor lamps, table lamps, H6057 speaker lamp

Source root: `decompiled/jadx-splits/split_pact_hollowlamp/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

This split bundles four product programs plus one stray H6078 effect class:

1. `com/govee/hollowlamp` — "hollow lamp" family (candle/ambient lamps), 7 SKUs
2. `com/govee/h6057` + `h6057/origin` — H6057 lamp with speaker/voice/battery/preset scenes
3. `com/govee/straightfloorlamp` — straight floor lamp family, 6 SKUs
4. `com/govee/tablelampv1` — H6052/H6078 table lamps
5. `com/govee/h6630/detail/diy/advance/H6078ProGraffitiEffect.java` — AI/graffiti DIY effect for H6078

---

## 1. Overview / family and SKUs

| SKU | goodsType | family | transports | registration |
|---|---|---|---|---|
| H6050 | 27 | hollow/candle lamp | ble + iot | `hollowlamp/pact/bleiot/H6050Maker` `AbsBleWifiSku` |
| H6051 | 37 | hollow lamp | ble + iot | `H6051Maker` `AbsBleWifiSku` |
| H6055 | 42 | portable hollow lamp (battery) | **ble** | `hollowlamp/pact/ble/H6055Maker` `AbsBleSku` |
| H6058 | 59 | hollow lamp (energy saving) | ble + iot | `H6058Maker` `AbsBleWifiSku` |
| H6059 | 84 | hollow lamp (PIR/auto induction + sensitivity) | ble + iot | `H6059Maker` `AbsBleWifiSku` |
| H6073 | 58 | hollow lamp | ble + iot | `H6073Maker` `AbsBleWifiSku` |
| H1771 | 395 | hollow lamp, 4-color / new scenes | ble + iot | `H1771Maker` `AbsBleWifiSku` |
| H6057 | 104 | lamp with speaker, voice, battery, presets | ble + iot | `h6057/present/SkuItemClickH6057`; add flow WiFi |
| H6072 | 30 | straight floor lamp | ble + iot | `straightfloorlamp/pact/H6072Maker` `AbsBleWifiSku` |
| H8072 | 30 | straight floor lamp (same goods type) | ble + iot | same |
| H6076 | 69 | straight floor lamp | ble + iot | `H6076Maker` |
| H60B2 | 312 | straight floor lamp | ble + iot | `H60B2Maker` |
| H3270 | 409 | straight floor lamp, AI effects | ble + iot | `H3270Maker` |
| H16C0 | 377 | straight floor lamp | ble + iot | `H16c0Maker` |
| H6052 | 22 | table lamp | ble + iot | `tablelampv1/pact/V1BleIotSkuItem` `AbsBleIotSkuItem` |
| H6078 | 128 | table/floor lamp (RGBICWW) | ble + iot | `V2BleIotSkuItem` |

Notes:

- `Hollowlamp Support` exposes `a="H6050"`, `b="H6055"`, `c="H6058"`.
  `Support.d()` (= `j`) is `{42}` and is used by the **BLE-only** `SubLib`;
  `Support.e()` (= `k`) is `{27,37,59,58,84,395}` and is used by `SubLib4BleIot`;
  `Support.g()` (= `l`) is the full `{27,37,42,59,58,84,395}` list.
  `Register4Item` registers both `SubLib4BleIot` and `SubLib`.
- Only **H6055 is BLE-only** (`AbsBleSku`, battery-powered). All other SKUs are
  `AbsBleWifiSku`/`AbsBleIotSkuItem` → **ble + iot** (`turn`/`brightness`/`colorwc`/`ptReal`).
- No Matter, IR/RF or Thread support is declared in this split.
- H6050/H6051/H6055/H6058 additionally support **group factor** V1/V2/V3 (`GroupBle`,
  `GroupBleV2`, `GroupBleV3`, `GroupOp*`) for multi-device sync.

Kelvin ranges (`hollowlamp/pact/Support.getColorTemRange`):

| goodsType | range |
|---|---|
| 27 (H6050) | 1800–3000 |
| 37, 84 (H6051, H6059) | 2200–6500 |
| 58, 59 (H6073, H6058) | 2200–6500 |
| 395 (H1771) | 1000–10000 |
| 42 (H6055) | 1000–10000 (default branch) |
| H6057 (104) | 1000–10000 |
| straightfloorlamp | 1000–10000 |
| tablelampv1 | 2200–6500 |

Brightness is 1–100 everywhere (default `BrightnessController`); no range inversion.

---

## 2. Transports & GATT UUIDs

All families use the same vendor GATT pair:

```
service        00010203-0405-0607-0809-0a0b0c0d1910
characteristic 00010203-0405-0607-0809-0a0b0c0d2b11
```

Declared in `hollowlamp/ble/BleComm.java`, `BleMultiComm.java`, `h6057/origin/ble/BleComm.java`,
`straightfloorlamp/ble/BleComm.java`, `tablelampv1/ble/BleComm.java`.

- write proType `0x33`, read proType `0xAA`, multi-packet write `0xA3`
- frame: `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC`
- parser data = frame `[2..18]` (17 bytes)
- `AbsModeController.p()` = `{0x01}` (read mode)
- multi-packet V1 (`MultipleControllerCommV1.makeSendBytesV1`):
  `[0]=0xA3, [1]=0 first / index / 0xFF last, [2]=1 or chunk, [3]=total packets, [4]=cmdType (first packet)`.

`straightfloorlamp` writes gradual-change via `0x33/0xA3` (cmdType equals 0xA3) — see gaps.

---

## 3. BLE frame + command table

### 3.1 Common to all families

| name | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `01 <0/1>` | `[0]` | base `SwitchController` |
| brightness | `0x33/0x04` | `04 <1..100>` | `[0]` | base `BrightnessController` |
| heartbeat | `0xAA/0x01` | `01` | `[0]` alive | base `HeartController` |
| read mode | `0xAA/0x05` | `05 01` | — | base `AbsModeController` |
| read color group | `0xAA/0xA5` | `A5 <group>` | response `[0]=group`, then 4 × `brightness,R,G,B` | base `Controller4ColorInfoByGroup` |
| read bulb color | `0xAA/0xA2` | `A2` | colour-only read (straightfloorlamp) | base `Controller4ColorInfoByGroup.generateReadController4OnlyColor` |

### 3.2 hollowlamp (H6050/H6051/H6055/H6058/H6059/H6073/H1771)

| name | op | payload | layout | source |
|---|---|---|---|---|
| color | `0x33/0x05` | `05 0D R G B CT_H CT_L R2 G2 B2` | sub-mode 0x0D, CT 16-bit **big-endian**, R2G2B2 = temperature RGB | `hollowlamp/ble/SubModeColor.java` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi>` | effect 16-bit **little-endian**, default 0x22 (34) | `hollowlamp/ble/SubModeScenes.java` |
| DIY | `0x33/0x05` | `05 0A <diyLo> <diyHi>` | 16-bit LE | `hollowlamp/ble/SubModeNewDiy.java` |
| music V1 | `0x33/0x05` | `05 0E <effect> <sens> <flag> [R G B]` | flag 0 = auto (4 bytes), 1 = manual color (7 bytes); sens 0–99 | `hollowlamp/ble/SubModeMusic.java` |
| music V2 | `0x33/0x05` | `05 0F 04 <sens> <effect> <flag> [R G B]` | 8 bytes; effect mode id, flag 0 auto / 1 manual | `hollowlamp/ble/SubModeMusicV2.java` |
| music V3 | `0x33/0x05` | `05 13 <effect> <manual> <sens> 00` | effect **75 = Rhythm**, **76 = Magic**; manual 0/1; sens 0–99 | `hollowlamp/ble/SubModeMusicV3.java` |
| multi music color | `0xA3/0x41` | `41 <musicEffect> <count> <R G B>×count` | multi-packet; realtime per-segment music colors; musicEffect = 75/76 | `hollowlamp/ble/MultiMusicController.java` |
| local color read | `0xAA/0xA5` | `A5 <page>` | 24-slot table, 4 colors per response | `hollowlamp/ble/LocalColorReadControllerV1.java` |
| local color write | `0xA3/0xA5` | `A5 <count> <R G B CT_H CT_L>×count` | 24 local colors, 5 bytes each | `hollowlamp/ble/LocalColorSettingMultiControllerV1.java` |
| auto induction | `0x33/0xA6` | `A6 <0/1>` | PIR/auto on-off (H6059) | `hollowlamp/ble/OnOffAutoInductionController.java` |
| sensitivity | `0x33/0xA7` | `A7 <value>` | PIR sensitivity (H6059, soft ≥ 1.00.12) | `hollowlamp/ble/SensitiveController.java` |
| mic realtime RGB | `0x33/0x83` | `83 R G B` | group/mic realtime segment color | base `MicSetRgbController` |

`ble/BleProtocol.java` constants: `14/0x0E`, `15/0x0F`, `19/0x13`, `65/0x41`, `75/0x4B`,
`76/0x4C`, `4`, `1`, `0`, `13/0x0D`, `34/0x22`, `32/0x20`, `-91/0xA5`, `-90/0xA6`, `-89/0xA7`, `54/0x36`.

### 3.3 H6057 (speaker lamp)

Sub-modes (`h6057/origin/ble/Mode.java`): color `0x0D`, scenes `0x04`, DIY `0x0A`,
game `0x0B`, music `0x13`.

| name | op | payload | layout | source |
|---|---|---|---|---|
| scene w/ music | `0x33/0x05` | `05 04 <effLo> <effHi> <musicCode>` | 16-bit LE effect + music code | `h6057/.../SubModeScenes.java` |
| game | `0x33/0x05` | `05 0B <gameCode>` | game id | `h6057/.../SubModeGame.java` |
| music | `0x33/0x05` | `05 13 <musicCode> <sens>` | 0–99 | `SubModeMusic.java` |
| light switch | `0x33/0x30` | `30 <0/1>` | main light | `BleProtocol.command_light_switch` |
| energy saving | `0x33/0x16` | `16 <0/1>` | low-energy mode | `EnergySavingController.java` |
| play voice | `0x33/0x31` | `31 <index>` | play voice prompt | `Controller4PlayVoice.java` |
| pause voice | `0x33/0x32` | `32 <index>` | pause voice | `Controller4PauseVoice.java` |
| preview effect | `0x33/0x27` | `27 <f> <h> <g> <i> <j> <kHi> <kMid> <kLo>` | 8-byte preview (3-byte colour code `k`) | `Controller4PreviewEffect.java` |
| preset info | `0xAA/0x24` | `24` | pre-set info (count/ids) | `PreSetInfoController.java` |
| preset color | `0x33/0x25` | `25 <index>` | read/write preset color slot | `PreSetColorController.java` |
| preset scene | `0x33/0x26` | `26 <index>` | read/write preset scene slot | `PreSetSceneController.java` |
| delete preset scene | `0x33/0x28` | `28 <bytes>` | delete | `DeletePreSetSceneController.java` |
| sort preset scenes | `0x33/0x29` | `29 <bytes>` | reorder | `SortPreSetSceneController.java` |
| multi preset color | `0x33/0x0B` | `0B <bytes>` | multi-slot preset colour | `MultiPreSetColorController.java` |
| volume | `0x33/0x33` | `33 <0..N>` | speaker volume | `BleProtocol.command_volume` |
| detail info | `0xAA/0x34` | `34` | detail data (JSON bean) | `GetDetailInfoController.java` |
| no disturb | `0x33/0x35` | `35 <0/1>` | do-not-disturb | `BleProtocol.command_no_disturb` |
| night mode | `0x33/0x36` | `36 <0/1>` | night mode | `BleProtocol.command_night_mode` |
| prompt tone | `0x33/0x37` | `37 <0/1>` | hint voice | `PromptToneController.java` |
| indicator light | `0x33/0x38` | `38 <0/1>` | indicator LED | `GuideLightController.java` |
| worry-free night | `0x33/0x36` | `36 01 <a> <b> <c> <d> <e> <f>` | 7-byte night policy (shares cmdType 0x36) | `WorryFreeAtNightController.java` |

H6057 is the only SKU with a **battery** and **speaker** in this split.

### 3.4 straightfloorlamp (H6072/H8072/H6076/H60B2/H3270/H16C0)

Sub-modes (`straightfloorlamp/ble/BleProtocol.java`): color `0x14`, colorV2 `0x15`,
scenes `0x04`, music `0x0F`, abs music `0x16`, DIY `0x0A`.

| name | op | payload | layout | source |
|---|---|---|---|---|
| color (legacy) | `0x33/0x05` | `05 14 R G B CT_H CT_L R2 G2 B2 00 <mask>` | 11 bytes; mask bit per segment | `straightfloorlamp/ble/SubModeColor.java` |
| color V2 | `0x33/0x05` | `05 15 <subtype…>` | subtype 1 RGB+CT+mask (14B), 2 brightness+mask, 3 brightness set, 4 strip group | `straightfloorlamp/ble/SubModeColorV2.java` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi>` | 16-bit LE; default 2002, H6072/H8072 → 2099, H6076 → 2143 | `SubModeScenes.java` |
| music | `0x33/0x05` | `05 0F <effect> <sens> <flag> [R G B]` | 7 bytes, or 8 bytes when effect 4 (extra mode byte) | `straightfloorlamp/ble/SubModeMusic.java` |
| music V2 | `0x33/0x05` | `05 0F <effect> <sens> <flag> [R G B]` | new music codes; auto/manual | `SubModeMusicV2.java` |
| abs music | `0x33/0x05` | `05 16 <…>` | base `SubModeAbsMusic` (energy/impact/jet/joy/jump/rhythm) | base `SubModeAbsMusic` |
| DIY | `0x33/0x05` | `05 0A <diyLo> <diyHi>` | 16-bit LE | `SubModeNewDiy.java` |
| gradual change | `0x33/0xA3` | `A3 <0/1>` | on/off gradual transition (cmdType literally 0xA3) | `Gradual4BleWifiController.java` |
| remote pair | `0x33/0xA4` | `A4 01` | start pairing | `RemoteController.java` |
| exit remote pair | `0x33/0xA6` | `A6` | stop pairing | `ExitRemoteController.java` |

Segment counts (`Support.getBulbStringMaxNum`): **8** (30/H6072/H8072, default), **7**
(69/H6076, 377/H16C0), **3** (H60B2-like goods 312). AI effects enabled for some
versions (`Support.supportAiEffect`, `DiyM.EffectCode` categories 29/30).

### 3.5 tablelampv1 (H6052/H6078)

Sub-modes: color `0x0D`, scenes `0x04`, music `0x0F`, music new `0x13`, DIY `0x0A`.

| name | op | payload | layout | source |
|---|---|---|---|---|
| color | `0x33/0x05` | `05 0D R G B CT_H CT_L R2 G2 B2` | 9 bytes | `tablelampv1/ble/SubModeColor.java` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi>` | 16-bit LE, default 13 | `SubModeScenes.java` |
| music | `0x33/0x05` | `05 0F <effect> <sens> <flag> [R G B]` | 7 bytes, effect 4 → 8 bytes | `SubModeMusic.java` |
| music V2 | `0x33/0x05` | `05 13 <musicCode> <sens>` | H6078 music codes 105/72/85/50/84/98 | `ble/v2/SubModeMusicV2.java`, `newAdjust/H6078MusicMode.java` |
| DIY | `0x33/0x05` | `05 0A <diyLo> <diyHi>` | 16-bit LE | `SubModeNewDiy.java` |
| indicator light | `0x33/0x16` | `16 <enable> <startH> <startM> <endH> <endM>` | forever → `16 01 FF FF FF FF` | `NewLightIndicatorController.java` |

`H6052` exposes 2 color pieces, `H6078` 1 (`Support.getColorSize`). H6078 adds
`H6078MusicMode` (codes above) and the AI/graffiti effect
`h6630/detail/diy/advance/H6078ProGraffitiEffect.java`.

---

## 4. BLE notifications / readings

| family | op | parser | layout |
|---|---|---|---|
| hollowlamp | `0x20` | `BrightnessNotifyParse` | `[0]` brightness |
| hollowlamp | `0x40` | `DeviceStatusNotifyParse` | first 10 bytes |
| hollowlamp | `0x11` | `WifiNotifyParse` | `[0]==0` connected |
| H6057 | `0x20` | `BrightnessNotifyParse` | `[0]` brightness |
| H6057 | `0x30` | `DeviceInfoNotifyParse` | sub-command `[0]`: 1 light status (`bit1`), 2 energy saving (`bit1`), 3 battery, 4 music info (`[1]`,`[2]`), 5 volume, 6 no-disturb (`bit1`), 7 sleep (`SleepControllerV1`) |
| straightfloorlamp | `0x20` | `BrightnessNotifyParse` | `[0]` brightness |
| straightfloorlamp | `0x11` | `WifiNotifyParse` | `[0]==0` |
| straightfloorlamp | `0xA4` | `RemoteControlParse` | `[0]` pairing/remote byte |
| straightfloorlamp | `0x40` | `DeviceStatusNotifyParse` | 10 bytes |
| straightfloorlamp | `0x60` | `MovieFeastOnOffNotifyParse` | movie feast |
| tablelampv1 | `0x20` | `BrightnessNotifyParse` | `[0]` brightness |
| tablelampv1 | `0x11` | `WifiNotifyParse` | `[0]==0` |

### Battery (H6055, H6057)

- H6055: heartbeat/status byte `[4]`:
  - `bit7` = charging
  - `bits6..4` = grade 1..5 (clamped, 0 or >5 → 5)
  - `bit3` = full
  (`hollowlamp/newdetails/h6055/H6055NewDetailVm.parseBatteryInfo`)
- H6057: `DeviceInfoNotifyParse.parseBatteryInfo` byte:
  - `bit8` charging, `bits7..5` grade (3 bits), `bit4`, `bit3` full, `bit1` present
  (bit numbering is `ParseUtils.getBit2Boolean` MSB=8).

---

## 5. IoT commands + status/readings schema

All IoT-capable SKUs use the same command set:

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0/1}` | `hollowlamp/iot/CmdTurn`, `h6057/.../CmdTurn`, `straightfloorlamp/iot/CmdTurn`, `tablelampv1/iot/CmdTurn` |
| `brightness` | `{"val":1..100}` | `CmdBrightness` in each package |
| `colorwc` | `{"colorTemInKelvin":…}` or `{"red","green","blue"}` | `CmdColorWc` (kelvin range per family) |
| `ptReal` | `{"command":["<base64 20-byte frame>",…]}` | `CmdPtReal` in each package |
| `status` | read (`type=0`) | `CmdStatus` / `AbsIotManagerV1` |
| `online` | read | `AbsIotManagerV1` |

### Status parsing

**hollowlamp** (`hollowlamp/iot/CmdStatusV0.java`, `CmdStatusV1.java`):

```
state: { onOff:int, brightness:int, mode:int }
op.command: [base64 frames]
  0x05 -> mode + sub-mode
  0x23 -> timers (4)
  0x11 -> sleep
  0x12 -> wakeup
  0xA5 -> local color table size (frame[3])
  0xA6 -> auto induction (frame[2])
  0xA7 -> sensitivity (frame[2])
  0x16 -> energy saving (frame[2])   // V1
  0x01 -> energy saving (frame[5])   // V1 fallback
```

**h6057** (`h6057/origin/iot/CmdStatusV1.java`): same `state`, plus
`0x34` detail info (battery/volume/music), sleep v1 (`0x11`), wakeup v1 (`0x12`),
timers (`0x23`).

**straightfloorlamp** and **tablelampv1**: no family `CmdStatus*` parser; they use the
generic base IoT manager `state` + `op.command` (`0x05` mode / `0x04` scene frames).

`ptReal` is used for scenes, advanced scenes, DIY blobs, color strips and multi-zone
frames. `CmdPtReal.getCommand()` is just a list of base64 frames; some families append a
mode frame (`0x05/0x04 <code>`) to the final group.

---

## 6. Other protocols

| name | details | source |
|---|---|---|
| battery / BLE-only | H6055 is battery powered and BLE-only; heartbeat byte supplies charge/grade/full. | `hollowlamp/newdetails/h6055/H6055NewDetailVm.java` |
| speaker / voice | H6057 plays voice prompts, has volume, night/no-disturb, preset scenes, game mode, and detail-info query. | `h6057/origin/ble/*Controller.java` |
| group factor / sync | H6050/H6051/H6055 support group control V1/V2/V3. `GroupBle*.C(byte[])` reinterprets stored colour/brightness/music frames; mic realtime uses `MicSetRgbController` (`0x83`). | `hollowlamp/ble/GroupBle*.java`, `GroupOp*.java` |
| Matter / MQTT / LAN | none in this split. | — |
| BLE remote | straightfloorlamp only: `0xA4` pair / `0xA6` exit, notify `0xA4`. | `straightfloorlamp/ble/RemoteController.java` |

---

## 7. Dynamic effects / motion / music / scenes / DIY

### hollowlamp

- **Color**: 0x0D payload `[R,G,B,CT_H,CT_L,R2,G2,B2]`; CT is kelvin for white mode,
  R2G2B2 is the temperature RGB.
- **Scenes**: 0x04 with 16-bit LE effect; default 0x22 (34). Groups from
  `Support.supportScenesOpSet`: `{0,1}` for all, **H1771** `{0,1,2,3,6,5,4}`
  (new scenes). Hints: 108, 1114, 0 (GM), 1 (sunset).
- **DIY**: effect codes from `DiyM.EffectCode` (`l`=0, `m`=1, `n`=2, `s`=4, `t`=5, `g`=255 mix;
  AI categories 28/29/30; H6059 adds 82/83). Max 8 colours/effect,
  speed 1–100 (default 50); `3D`/advanced DIY via `diyNew`.
- **Music**:
  - 0x0E: effect id (0/1), sensitivity, auto flag, optional manual RGB.
  - 0x0F: effect mode 4, sensitivity, effect id, auto flag, optional RGB.
  - 0x13: effect 75/76 (Rhythm/Magic), manual flag, sensitivity.
  - 0x41 multi-packet: `41 <musicEffect> <count> <RGB>×count` realtime segment colour.
- **Local colour**: 24 stored colours, 5 bytes each; read page by page via 0xA5.
- **Sensitivity / auto induction** (H6059): 0xA7 / 0xA6.
- **Energy saving** (H6058, soft ≥ 1.01.05): 0x16.
- **Battery** (H6055): heartbeat byte 4.

### H6057

- Scenes carry a music code byte; game mode 0x0B; preset slots 0x24–0x29; preview 0x27;
  voice/volume/night/no-disturb; battery and detail info. It is a "lamp + speaker"
  product, not a pure light.

### straightfloorlamp

- **8/7/3 segments** (per SKU) with per-segment mask in the colour payload.
- **Scenes**: 16-bit LE, defaults 2002 / 2099 (H6072/H8072) / 2143 (H6076);
  groups `{0,1,2,3}` (H3270 adds 5, and `{0,1}` for old H6072 versions).
- **Music**: effect ids `0` energy, `1` rhythm dynamic, `0` rhythm soft, `2` joy,
  `4` rhythm, `6` impact, `7` jet, `8` jump (+ `0x16` abs-music container).
- **DIY**: full 8-effect set (colour/speed/sensitivity); AI effect categories 29/30;
  DIY version 0/1 depending on SKU/version.
- **Gradual change**: `0xA3` on/off for smooth transitions.
- **Remote**: pair/exit 0xA4/0xA6.

### tablelampv1

- Color 0x0D; scenes 0x04; music 0x0F (legacy) / 0x13 (H6078); DIY 0x0A.
- Indicator schedule 0x16 (`enable,startH,startM,endH,endM`; forever = `01 FF FF FF FF`).
- H6078 music codes 105, 72, 85, 50, 84, 98; AI/graffiti effect from
  `h6630/detail/diy/advance/H6078ProGraffitiEffect.java`.

---

## 8. Source map

- hollowlamp: `hollowlamp/pact/{Support,SubLib,SubMaker,Register4Item}.java`, `ble/{BleProtocol,Mode,SubModeColor,SubModeColorV2,SubModeScenes,SubModeMusic,SubModeMusicV2,SubModeMusicV3,SubModeNewDiy,MultiMusicController,LocalColor*,SensitiveController,OnOffAutoInductionController,GroupBle*,GroupOp*}.java`, `iot/*`, `newdetails/*`, `adjust/Diy.java`
- h6057: `h6057/origin/ble/*`, `h6057/origin/iot/*`, `h6057/origin/newDetail/Diy.java`, `h6057/bean/*`
- straightfloorlamp: `straightfloorlamp/pact/*`, `ble/*`, `iot/*`, `adjust/Diy.java`, `adjust/Info4Detail.java`
- tablelampv1: `tablelampv1/pact/*`, `ble/*`, `ble/v2/*`, `iot/*`, `adjust/Diy.java`, `newAdjust/H6078MusicMode.java`
- base: `base2light/ble/controller/*`, `base2light/iot/*`, `base2light/pact/newdetail/*`, `base2light/ac/diy/DiyM.java`, `base2light/ble/controller/SubModeAbsMusic.java`

---

## 9. Gaps / unknowns

1. **H6073 (58) vs H6058 (59)** differ only by capabilities (energy saving on 59) in
   `Support`; no separate command class exists, so behaviour is version-gated.
2. **H6057 cmdType 0x36** is used by both night-mode (`36 <0/1>`) and worry-free-night
   (`36 01 …`); the multi-byte form is identified by the leading `01` payload byte.
3. **straightfloorlamp gradual change** uses cmdType `0xA3` even though `0xA3` is also the
   multi-packet proType; frames are `33 A3 <0/1>` and must be distinguished by proType.
4. **Scene/DIY catalogues** (effect IDs, names, AI categories) are cloud-driven
   (`ScenesOp`, `DiyNewConfig`, `DiyM`); only IDs/formats are static. DIY blob internals
   are effect-specific (see `DiyM.EffectCode`, `Pro4H60B1Diy`/`DiyProtocol`).
5. **H6055 battery grade** is quantized to 5 levels by the parser; raw charge percentage
   is not transmitted.
6. **H6630/H6078 ProGraffitiEffect** lives under `h6630` even though the SKU is H6078;
   the class is referenced by the H6078 DIY/AI path, not by an H6630 device.
7. No Matter/MQTT/LAN protocol exists for any SKU in this split; cloud control uses
   `turn`/`brightness`/`colorwc`/`ptReal`.


---

<!-- split_pact_humidifier -->

# split_pact_humidifier — humidifiers, dehumidifiers and aroma diffusers (H7140…H7162)

Source root: `decompiled/jadx-splits/split_pact_humidifier/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

---

## 1. Overview / family and SKUs

The module contains **13 goods-type groups / 17 SKU names** of Govee humidifiers
(cool-mist, warm-mist, evaporative, "atmosphere" models with fog/light/sound).
Eight groups have their own `ble/controller` package; H7149/H7152/H7153 share a
generic package and only override the UI/pact glue.

| goodsType | SKU(s) | package | kind | packets |
|---|---|---|---|---|
| 151 | H7140 (+ alias H7146) | `h7140` | humidifier, gear/auto/custom | BLE + IoT |
| 259 | H714E | `h7140` | humidifier (same protocol, newer MCU) | BLE + IoT |
| 61 | H7141 | `h7141` | humidifier (older 3-mode protocol) | BLE + IoT |
| 81 | H7142 | `h7142` | humidifier (3-mode protocol) | BLE + IoT |
| 126 | H7143 | `h7143` | humidifier, gear/auto, abnormal info | BLE + IoT |
| 170 | H7145 | `h7145` | humidifier, water tank level + dry mode | BLE + IoT |
| 232 | H7147 | `h7145` | same protocol as H7145 | BLE + IoT |
| 233 | H7148 | `h7145` | same protocol as H7145 | BLE + IoT |
| 258 | H7149 | `h7149` | humidifier, gear/auto, lighting scenes | BLE + IoT |
| 94 | H7150 | `h7150` | **dehumidifier** (Smart Dehumidifier) + child lock + dry-clothes | BLE + IoT |
| 147 | H7151 | `h7151` | **dehumidifier** (Smart Dehumidifier Max) + drain/pump/off-dry/device status | BLE + IoT |
| 308 | H7152 | `h7151` | **dehumidifier** (H7151 hardware, 2-probe timer) | BLE + IoT |
| 309 | H7153 | `h7151` | **dehumidifier** (H7151 hardware) | BLE + IoT |
| 99 | H7160 | `h7160` | humidifier, gear/auto/custom + timer | BLE + IoT |
| 146 | H7161 | `h7161` | **aroma diffuser** (Aroma Diffuser Pro; fog + light + voice) | BLE + IoT |
| 189 | H7162 | `h7161` | **aroma diffuser** (Smart Aroma Diffuser) | BLE + IoT |

This module is not only humidifiers: **H7150–H7153 are dehumidifiers** (bucket-full,
auto-defrost, compressor/overtime/high-temperature protections; source strings
`h7150_smart_dehumidifier`, `h7151_Smart_dehumidifier_max`), and **H7161/H7162 are aroma
diffusers** (`h7161_device_name` = "Aroma Diffuser Pro", `h7162_device_name` = "Smart Aroma
Diffuser"), despite sharing the module/protocol family.

All are `AbsBleWifiSku` / `AbsBleSku` and declare `GoodsType.beProtocol(1,1)`,
`(1,2)` and/or `(2,1)` — i.e. **ble + iot** (`protocolsWithSecret` is not used here;
pairing is ordinary Govee BLE broadcast + GATT). No WiFi-only, Matter, IR or Thread SKU.

The only scene `CmdBuilder`s in the split are the per-family `scens/BleSwitchCmdBuilderV1`
and `scens/IotSwitchCmdBuilderV1` (+ `SquareOp4BleIot` for the 4-way button); all other
commands are built directly from `ble/controller/*` by the view-models.

`Support` / `SubMaker` evidence: `h714*/Support.java`, `h714*/pact/SubMaker.java`,
`h7145/pact/{H7145Maker,H7147Maker,H7148Maker}.java`, `h7149/pact/Support.java`
(goodsType 258), `h7151/pact/SubMaker.java` (registers H7152/H7153 from sibling packages),
`h7161/pact/SubMaker.java` (H7162).

---

## 2. Transports & GATT UUIDs

| item | value |
|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` |
| write proType | `0x33` |
| read proType | `0xAA` |
| mode write proType | `0x3A` (58) — `H7140ModeController.getProType()`; mode reads use `0xAA` |
| multi write proType | `0xA3` (163), packet index in `[2]`, chunk in `[3..18]` |
| chart-data service | `00010203-0405-0607-0809-0a0b0c0d2d00` |
| chart-data characteristic | `00010203-0405-0607-0809-0a0b0c0d2d20` |
| notify/self-comm service | `494e5445-4c4c-495f-524f-434b535f4857` |
| chart notify char | `494e5445-4c4c-495f-524f-434b535f2015` |

`ble/BleComm.java` (identical in every family) holds the first four values;
`AbsChartDataComm` (base class) holds the chart UUIDs; `BleComm.isSelfComm()` accepts
the `494E…4857` service; `isChartData()` matches the `…2015` characteristic.

Frame: `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC`. A write response is
successful when the first valid byte (or `value[2]` for `AbsController`) is `0`.
Read responses: `AbsController.m()` strips `0xAA`-class frames by 2 bytes (17-byte
payload) and write echoes by 3 bytes (16-byte payload).

---

## 3. BLE command table

Constants come from `com.govee.base_h71xx.sku_base.BleProtocolConstants` unless a
family has its own `BleProtocolConstants` (H7141). Hex is the **cmdType** in `[1]`.

### 3.1 Shared / H7140-class opcodes

| function | cmdType | write payload | response / fields | source |
|---|---|---|---|---|
| power / switch | `0x01` | `[0]=0/1` (`SwitchController`) | `0xAA/0x01 → [0] state` | base `SwitchController` |
| mode | `0x3A/0x05` (write) | see 3.2 | `[0]=mode` + params | `h7140/ble/controller/H7140ModeController.java` |
| clean reminder | `0x08` / `0x27` | `[open, setCleanHour]` | `[open, setHour, remainHour]` | base `CleanReminderController`; `h7141` uses `0x08`, `h7140` uses `0x27` (`C()=39`) |
| delay-off | `0x11` | `[open, minLo, minHi]` (`min` at `[1..2]` LE) | `[open, minLo, minHi, leaveLo, leaveMid, leaveHi]` | base `DelayOffController` |
| not-disturb | `0x16` | `[enable, startH, startM, endH, endM]`; forever = `[01,01,01,01,01]` | same | base `NotDisturbController` |
| device status (H7151/H7152/H7153) | `0x19` | none | see 4.3 | `h7151/ble/controller/DeviceStatusController.java` |
| read switch (H7145) | `0x1A` | none | `[0]=0/1` | `h7145/ble/controller/ReadSwitchController.java` |
| time sync | `0x1B` | 4-byte timestamp LE + `[4]=1` + tz hour + tz minute | — | base `SyncTimeController` |
| gear position | `0x1C` | `[02, gearIndex]` (high gear) or `[01, gearIndex]` (low gear) | `[02, gear]` high / `[01, gear]` low | `h7140/ble/controller/GearPositionController.java` |
| timer add/echo | `0x01` | see 3.4 | `[group, enableSwitch, hour, min, repeat, mode, modeValue, …]` | base `TimerGroupControllerV2` |
| timer delete | `0x1E` | none | `[group]` | base `TimerCountController` |
| common switch / lock / power-on / off-dry (H7151) | `0x1F` | `[subCmd, 0/1]` | `[subCmd, 0/1]` | `h7150/LockControllerV1`, `h7151/{PowerOnController,OffDrySwitchController,OffWaterPumpSwitchController}` |
| abnormal info | `0xAA` | `[01]` | `[fault, ?, flag2, code, …]` (family-specific) | `h7140/AbnormalInfoController`, `h7143`, `h7145`, `h7150`, `h7151`, `h7160`, `h7161` |
| clean reminder H7140-class | `0x27` | `[open, setHour]` | `[open, setHour, remainHour]` | base `CleanReminderController` |
| write-read (query) | `0x3A` proType | payload depends on controller | 17-byte response | H7140 class `getProType()=0x3A` for mode reads |

### 3.2 Mode payloads

H7140 / H714E / H7143 / H7145 submit mode writes with **proType `0x3A`** (read `0xAA`);
H7141/H7142/H7150/H7151/H7152/H7153/H7160 use the default `0x33` write proType.
They share the payload layout:

| mode | byte | write payload |
|---|---|---|
| GEAR | `0x01` | `01 <gear>` |
| CUSTOM | `0x02` | `02 <(curIndex<<4)|setIndex> <5 bytes child0> <5 bytes child1> <5 bytes child2>` |
| AUTO | `0x03` | `03 <targetHum|0x80 if autoClose> <switchComfortable 0/1>` |
| DRY_CLOTHES (H7150/H7151/H7152/H7153) | `0x04` | `04` |

- H7140/H714E: `Mode.GEAR=1, CUSTOM=2, AUTO=3` (`h7140/model/Mode.java`).
- H7141: same numeric values but its own constants (`h7141/BleProtocolConstants.java`,
  `ModeGearController.q()` = `[1, gear]`, auto = `[3, val]`).
- H7143/H7145: GEAR=1, AUTO=3 only (`h7143/adjust/Mode.java`, `h7145`).
- H7150/H7151/H7152/H7153: GEAR=1, AUTO=3, DRY_CLOTHES=4 (`adjust/Mode.java`).
- H7160: GEAR=1, CUSTOM=2, AUTO=3.
- H7161: current mode is a single byte (`ModeController.q() = [mode]`), plus custom
  fog/light/voice sub-modes.

Custom-mode child (5 bytes, `h7140/model/ModeCustomChild.java`):
`[0]=gearIndex`, `[1..2]=setMin LE16`, `[3..4]=leaveMin LE16`; `0xFF` in
`[0]` means "unset" and expands to defaults (9/60/60, 5/60/60, 1/65535/65535 for
slots 0/1/2). `ModeCustom` byte 1 = `setIndex | (curIndex<<4)`.

### 3.3 H7141 / H7142 (older 3-mode protocol)

| function | cmdType | payload | source |
|---|---|---|---|
| mode gear | `0x05` | `[1, gear]` | `h7141/ble/controller/ModeGearController.java` |
| mode auto | `0x05` | `[3, target|0x80 if autoClose]` | `ModeAutoController.java` |
| mode custom | `0x05` | `[2, (cur<<4)|set, 3×5 bytes]` | `ModeCustomController.java` |
| current mode read | `0x05` | `p()`/`q()` per controller | `ModeCurController.java` |
| clean 72 h | `0x08` (H7141) / `0xAA`-class (H7142) | none / `[1]` | `Clear72HController.java` |
| abnormal | `0xAA` | `[1]` | shared |

H7142's controllers all return `BleProtocolConstants.a.d0()` (=`0x05`) and use the same
payload builders; H7141's own constants are numerically the same for mode sub-types.

### 3.4 Timer layout (shared, H7140/H7145/H7151/H7152/H7153/H7160)

`TimerInfoV2` (`base_h71xx/.../bean/TimerInfoV2.java`):

```
[0] group
[1] bitfield: bit7 enable, low nibble = open/switch, bits 4-6 nightLight/rewu/shake
[2] hour [3] minute [4] repeat mask [5] mode [6] modeValue
[7] targetHum   (mode == AUTO)
[8] autoGear    (mode == AUTO)
```

H7152 variant sends `[group, enableSwitch, hour, min, repeat, mode, targetHum, autoGear]`
when mode is AUTO, otherwise `[group, enableSwitch, hour, min, repeat, mode, modeValue]`
(`h7151/ble/controller/H7152TimerGroupController.java`).

### 3.5 H7143 / H7145 extra commands

| function | cmdType | payload | source |
|---|---|---|---|
| common switch | `0x1F` | none / switch state | `h7143`, `h7145` `CommonSwitchController` |
| water tank level (read) | `0x22` (34) | none | `h7145/ble/controller/WaterVieldController.java` |
| read all info | composite | runs version/sync/switch/mode/auto/abnormal/delay/not-disturb/clean/timer/switch reads | `h7145/ble/controller/ReadAllInfoController.java` |
| temperature/humidity calibration | `0x1C` (28) | V1 `[01, deviceFlag, tempFlag, calLE16]`; V2 `[deviceFlag, tempFlag, calLE16]`; V3 `[tempFlag, deviceFlag, calLE16]` | `h7145/ble/DevCommReportParse.java` (`TempHumCaliCtler`, base) |

`WaterVieldController` parses `[waterVieldPercent, enduranceLo, enduranceHi]`:
`waterVield = unsigned b[0]`, `enduranceMinute = LE16(b[1],b[2])` (`WaterBean`,
`LITTER_WATER = 10` → 10 % = 1 litre scale).

### 3.6 H7151 / H7152 / H7153 function block (`0x1F`)

| subCmd | meaning | payload | source |
|---|---|---|---|
| `0x02` | child lock | `[02, 0/1]` | `h7150/LockControllerV1` |
| `0x09` | power-on state | `[09, 0/1]` | `h7151/PowerOnController` |
| `0x0A` | off-dry switch | `[0A, 0/1]` | `h7151/OffDrySwitchController` |
| `0x0B` | off water-pump switch | `[0B, 0/1]` | `h7151/OffWaterPumpSwitchController` |
| (read) | device status | none | `h7151/DeviceStatusController` |
| (write) | start drainage | `0xAA` + `[00,00,01]` | `h7151/OffDrainageController` |
| (write) | start dry | `0xAA` + `[00,01]` | `h7151/OffDryController` |

### 3.7 H7161 / H7162 atmosphere block

`AtmosphereListController`: cmdType `0x05`, read payload `[03]`; response is a list of
one-byte preset atmosphere codes (first byte ignored; `Support.f()` entries accepted,
`0x00`/`0xFF` skipped).

`AtmosphereEditMultipleControl`:
cmdType `0x05`, proType `0xA3` (multi-packet), payload from
`AtmosphereEdit.Companion.a(list)`:

```
[0] = number of edits
per edit:
  [0] index
  [1] (modeLength + 10)
  [2] onOffFog  [3] onOffVoice  [4] voiceCode  [5] voiceVolume
  [6] atmosphereCode  [7] onOffLight  [8] brightness  [9] subMode
  color:  [10..12] R G B
  scene:  [10..11] scene code LE16
  DIY:    [10] diyCode [11] subDiyMode [12] speed [13] byteCount
          then byteCount/3 × RGB triples
```

`CustomFog` (`h7161/ble/controller/model/CustomFog.java`): `[01,01,onOff,minLo,minHi]`.
`CustomLighting`: `[01,02,onOff,minLo,minHi]`.
`CustomVoice`: `[01,03,onOff,voiceCode,voiceVolume,minLo,minHi]`.

`UncoveringRemindController`: cmdType `0x1F`, payload `[01, 0/1]`.

---

## 4. BLE notifications / readings

### 4.1 Notification dispatch

`BleNotifyComm` accepts proType `0xEE` (238). `bArr[1]` selects:
`WifiNotifyParse` (IoT/WiFi status) or `DevCommReportParse` (device report). The parser
is handed `frame[1..18]` (18 bytes); `DevCommReportParse` handles the raw frame and uses
`[1]` as the cmdType, `[2..]` as data.

### 4.2 Status / read events

| cmdType | fields | source |
|---|---|---|
| `0x05` | `[0]=mode`; GEAR → `[1]=gear`; AUTO → `[1]` target + bit7 autoClose + `[2]` comfortable; CUSTOM → `[1]` indices + 3×5 child blocks | `H7140ModeController.parseValidBytes`, `DevCommReportParse` |
| `0xAA` | `[0]=fault/water flag`, `[2]=flag2`, `[1]=code`, `[6]=flag3` | `h7140/AbnormalInfoController` |
| `0x27` (H7140) | `[0]=open`, `[1]=setHour`, `[2]=remainHour` (open==2 → `[1]` is remain) | `CleanReminder.Companion.a/b` |
| `0x08` (H7141) | same clean-reminder triple | `h7141/Clear72HController` |
| `0x22` | water tank: `[0]=percent`, `[1..2]=endurance minutes LE` | `h7145/WaterVieldController` |
| `0x1A` | switch state `[0]` | `h7145/ReadSwitchController` |
| `0x19` | device status `[0..1]=autoStopSec LE`, `[2]=dry`, `[3..4]=dryCountdownSec LE`, `[5]=compressor`, `[6]=fan`, `[7]=waterPipeConnected`, `[8]=draining` | `h7151/DeviceState.java` |
| `0x1C` | gear read: `[0]=lowGear`, `[1]=highGear` for `GearPositionController(f=false)`; write echo `[0]=0x02 high / 0x01 low`, `[1]=gear` | `GearPositionController.java`, `CmdStatusParseV1.e()` |
| `0x11` | delay-off `[open, minLo, minHi, leaveLo, leaveMid, leaveHi]` | `DelayOffInfo` |
| `0x16` | not-disturb enable/forever/start/end | `NotDisturbInfo` |
| `0x1E`/`0x01` | timer group list / delete | `TimerInfoV2` |
| `0x3A` | write-read result: same payload as command, `[0]` success/mode | family controllers |

### 4.3 Environment readings

Humidifiers **do not measure** room temperature/humidity themselves. The app binds an
external Govee TH sensor (`h7141/adjust/thermometer/BindThAc`, `h7150`…`h7161` thermometer
packages) and reads it via the chart characteristic `2d00/2d20` and the TH broadcast
format described in `split_pact_thnew.md`. Values on the humidifier side are only:
target humidity (AUTO `humidifyValue`, 0–100 %), gear, water tank level, clean/dry
countdowns. Water-shortage push switch is a **REST setting** (`waterShortageOnOff`), not
BLE and not a status reading (`h7140/net/DeviceWaterShortageSwitchRequest`). The UI's
"tank empty" reminder (`tv_water_tank_empty_remind`) is a presentation of the water-level
reading (`WaterBean.waterVield` / `enduranceMinute`), not a transmitted boolean. See
`STATUS-PROPERTIES.md` for the status/setting distinction.

Chart data (`AbsChartDataComm`, service `2d00`, char `2d20`):
16-byte time-series records, parsed by `com.govee.base2newth.chart.BleUtil.parseThValue`:
3-byte packed value → `tem = (int/1000)*10`, `hum = (int%1000)*10` (see TH split).

---

## 5. IoT commands + status schema

Envelope: `AbsCmdWrite` / `CmdBuilder.makeCmdStr` → `IotMsgProType.V2` for family
`IotPactV1` (`h7140/v1/IotPactV1.java`; `m()` = `"online"`). The incoming message is
`IotMsgV2`.

IoT `cmd` names (`h7141/iot/Cmd.java`, reused by all families):

| cmd | data | meaning | source |
|---|---|---|---|
| `online` | — | subscription/topic probe | `IotPactV1.m()` |
| `turn` | `{ "val": 0|1 }` | power | `CmdTurn` |
| `status` | — | read request | `CmdStatus` |
| `op` | `{ "command": ["<base64 20-byte frame>", …] }` | **ptReal result/command**; called `op` when the request is `ptReal` | `Cmd.a("ptReal") → "op"`, `CmdPtReal`, `ResultPt` |
| `ptReal` | `{ "command": ["<base64>"] }` | BLE frame tunneled over cloud | `CmdPtReal.java` |

`CmdPtReal` base64-encodes `AbsSingleController.getValue()` or a list of frames. Incoming
`op` is decoded by `ResultPt.getPtBytes()` and replayed through the **same BLE parsers**
(`CmdStatusParseV1.e()` / `m()`); frames are 20 bytes.

Status fields parsed from the `state` object (`CmdStatusParseV1$State`):
`onOff` (int 0/1), `result` (int). From `op` frames the app rebuilds:

| opcode | IoT-driven state |
|---|---|
| `0x05` | mode/gear/target humidity/comfortable flag |
| `0x1C` | low/high gear indices |
| `0x11` | delay-off |
| `0x01`/`0x1E` | timer list |
| `0x16` | not-disturb |
| `0xAA` | abnormal/warning code (`parseWarnRead` returns `frame[3]`) |
| `0x08`/`0x27` | clean reminder |
| `0x19` | H7151 device status |
| `0x22` | water tank level |

REST-only humidifier settings (not protocol frames): water-shortage **push switch**
(`DeviceWaterShortageSwitchRequest {sku, device, waterShortageOnOff}`) via
`h7140/net/IHumidifyNet.updateDeviceFilter`. `waterShortageOnOff=1` means "notify me when
water is short", not "water is short".

### Status properties vs. commands

- **Water tank level** is a reading: `WaterBean.waterVield` (0–100 %) + `enduranceMinute`,
  from BLE `0xAA/0x22` (34) or IoT status/op frame 34.
- **"Tank empty"** is not a code property. The only occurrence is the string/layout id
  `tv_water_tank_empty_remind` in `h7141`/`h7142` `CurHeaderUI`; the UI derives visibility
  from the level/endurance and warning state.
- **`waterShortageOnOff`** is a user setting (REST push toggle), not a status flag.
- **Warning/abnormal codes** arrive inside the `0xAA`/`0x17`-style status frames (see the
  table above); they are parsed readings, not separate opcodes.

Full classification and source paths: `STATUS-PROPERTIES.md`.

---

## 6. Other protocols

- **Govee BLE broadcast**: every family has `add/BleBroadcastProcessor` and
  `H71xxApplicationImp` registering `GoodsType.parseBleBroadcastPactInfo` for pairing.
  Broadcast layout is the generic Govee 62-byte advert (see `_REFERENCE.md`);
  no sensor payload is decoded from the humidifier advert.
- **Chart / history**: GATT service `2d00`, char `2d20`; 16-byte records with a 2-byte
  relative minute stamp at the head (see `BaseThDataComm`, `AbsChartDataComm`).
- **OTA**: Govee OTA characteristics in the same service (base `ble/ota`); not split-specific.
- **REST**: water-shortage switch, device detail, firmware, clean-72 h analytics.

---

## 7. Dynamic effects / scenes / DIY

Humidifier lighting (H7140/H7143/H7145/H7149/H7150/H7151/H7160/H7161) reuses the
`base_h71xx/light71xx` light blocks:

- `DevCommReportParse` dispatches `0xB0` frames to `LightSubCmd`:
  `LightSubCmd.a()` = light mode, `LightSubCmd.b()` = brightness/on-off
  (`h7140/ble/DevCommReportParse.java`, `h7145/ble/DevCommReportParse.java`).
- Light brightness/on-off commands come from `BrightnessOnOffEvent` and the
  `base2light` `BrightnessController` / `SwitchController` (cmdType `0x01`, `0x04`).
- H7161/H7162 atmosphere edits are the only per-SKU "scene" payloads (see 3.7);
  atmosphere codes are device presets, not app scene IDs.
- H7149 palette/scene support is UI-only (`h7149/bean/RecommendHumidify`,
  `h7149/component/ModeComponent`) and uses the shared light mode commands.

No music/mic effects are implemented in this split.

---

## 8. Source map

| area | paths |
|---|---|
| SKUs / registry | `h7140/pact/{SubMaker,H7140Maker,H714EMaker}.java`, `h7141/pact/H7141Maker.java`, …, `h7145/pact/{H7145Maker,H7147Maker,H7148Maker}.java`, `h7149/pact/Support.java`, `h7151/pact/SubMaker.java`, `h7161/pact/SubMaker.java` |
| BLE transport | `h71*/ble/Ble.java`, `h71*/ble/BleComm.java`, `h71*/ble/BleNotifyComm.java`, `h71*/ble/BleMultiComm.java` |
| mode/read controllers | `h7140/ble/controller/*.java`, `h7141/ble/controller/*.java`, `h7143/ble/controller/*.java`, `h7145/ble/controller/*.java`, `h7150/ble/controller/*.java`, `h7151/ble/controller/*.java`, `h7160/ble/controller/*.java`, `h7161/ble/controller/*.java` |
| models / payloads | `h7140/model/{Mode,ModeInfo,ModeAuto,ModeCustom,ModeCustomChild}.java`, `h7141/adjust/*.java`, `h7145/adjust/bean/WaterBean.java`, `h7151/DeviceState.java`, `h7161/ble/controller/model/*.java`, base `AtmosphereEdit` |
| notify parsers | `h7140/ble/DevCommReportParse.java`, `h7145/ble/DevCommReportParse.java`, `h71*/ble/WifiNotifyParse.java`, `h71*/iot/CmdStatusParseV1.java` |
| IoT | `h7141/iot/{Cmd,CmdTurn,CmdStatus,CmdPtReal,ResultPt}.java`, `h7140/v1/IotPactV1.java`, `h7140/scens/IotSwitchCmdBuilderV1.java` |
| BLE scenes | `h71*/scens/{AbsBleCmdBuilderV1,BleSwitchCmdBuilderV1}.java`, `h7140/scens/SquareOp4BleIot.java` |
| base constants | `jadx-base-7.7.10/sources/com/govee/base_h71xx/sku_base/BleProtocolConstants.java`, `.../ble/controller/{CleanReminder,DelayOff,NotDisturb,TimerGroup,SyncTime}*`, `.../adjust/component/bean/{TimerInfoV2,DelayOffInfo,NotDisturbInfo}.java` |

---

## 9. Gaps / unknowns

- H7143 supplies `Support.e = 126` but no own `BleProtocolConstants`; its abnormal-info
  field semantics differ from H7140's (`AbnormalInfoUtil` exists only in H7161) and are
  partly UI-only. Exact `0xAA` fault-code map is not enumerated anywhere in the split.
- H7141's `Clear72HController` writes an **empty** payload with cmdType `0x08`; the
  response path (`parseValidBytes`) is inherited and not visible in the decompiled file,
  so the exact 72 h clean-reminder payload cannot be confirmed for H7141.
- H7149/H7152/H7153 only provide UI/pact glue; their BLE commands are inherited from
  `base_h71xx` `Abs*Controller`s. The UI labels "dry", "sleep" etc. were not mapped to
  distinct opcodes because no family controller exists.
- H7161 `CustomFog/CustomLighting/CustomVoice` write and parse offsets differ by one
  byte (`getBytes` emits `[1, sub, onOff, …]`, `parse(bArr, i)` reads `onOff` at `i`);
  the caller's start index is not visible, so absolute wire offsets are inferred.
- Water tank "percent" scale: `WaterBean.LITTER_WATER = 10` suggests 0–100 % (10 % = 1 L
  on a 10 L tank), but the tank capacity is a per-SKU setting not present in code.
- Some `parseValidBytes` bodies are decompiled only as stubs (e.g. H7161 multi-edit
  completion), so error/ACK semantics are inferred from the shared `AbsController`.


---

<!-- split_pact_iceMachine -->

# split_pact_iceMachine — ice makers / nugget ice (H8120, H8121, H8122, H8131, H8150)

Source root: `decompiled/jadx-splits/split_pact_iceMachine/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

---

## 1. Overview / family and SKUs

The module is a single app module for five ice-machine goods types. There is **no
`ble/` package and no `CmdBuilder`**; commands are built inline in the shared view-models
as 20-byte Govee frames and sent through `GMessageSingleReadWrite` /
`GMessageSingleRead`, i.e. over GATT locally and `ptReal` over cloud.

| SKU | goodsType | package | ice form | special UI | transports |
|---|---|---|---|---|---|
| H8121 | 306 | `h8121` | bullet / "small-medium-max" | ice basket, clean, pre-cool | ble + iot (+ Matter pairing) |
| H8120 | 317 | `h8120` | bullet ice maker | light, clean/descaling | ble + iot (+ Matter pairing) |
| H8131 | 321 | `h8131` | thin/medium/thick/extra-thick | water tank, door, drainage, pre-cool | ble + iot (+ Matter pairing) |
| H8122 | 372 | `h8122` | small/medium/large | light, clean | ble + iot |
| H8150 | 397 | `h8150` | keep-ice / demold / melt / reservation | lid, reservation, keep-ice timers | ble + iot |

Registry: `IceApplicationImp.java` (`ModelMaker` + `support.j(goodsType)` deadlines),
`Support.java` (`Pact.d.a(306,…)` etc., `PairResource` for each goods type),
`h81*/pact/H81*Maker.java`. Protocols are `GoodsType.beProtocol(1,1)`, `(1,2)`,
`(2,1)`, `(2,2)` depending on SKU — all **ble + iot**. Goods 306/317/321 are also
declared in a `MatterInterceptor` (`checkGoodsType`), so Matter commissioning is
supported for those three.

---

## 2. Transports & GATT UUIDs

Runtime BLE uses `com.govee.base2light.feast.cmd.Ble` whose `AbsBleComm` is
`com.govee.matter.pact.BleComm`:

| item | value |
|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` |
| write proType | `0x3A` (58) — `GMessageSingleReadWrite.getSendBytes()` |
| read proType | `0xAA` — `GMessageSingleRead.getSendBytes()` |
| light/group cmdType | `0xB6` (signed `-74`) |
| extra cmdTypes | `0xC1` (signed `-63`), `0xF0` (signed `-16`) used by the VMs |
| packet | 20 bytes, `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` |

The VMs build raw payloads and let `GMessageSingleReadWrite` frame them
(`buildParser(O(), BleProtocolConstants.a.u1(), cmd, …)`; `u1()` = `0x3A`, the
"write-read" proType used by H71xx-class devices). Write result success is `frame[2]==0`;
read data is stripped by 2 bytes before the parser.

`H8150SharedViewModel` chooses `ptReal` vs `ptIot` at runtime:
`otaPactConfig.d(goodsType, pactType, pactCode) ? "ptIot" : "ptReal"`.

---

## 3. BLE command table

All commands below are written by `h81*/vm/H81*SharedViewModel.java`; hex is cmdType.

| function | cmdType | payload | applies to | source |
|---|---|---|---|---|
| run control | `0x01` | `00 00` cancel; `01 00` start ice; `01 01` start clean; `01 02` start melt; `01 03` start demold/drain; `00` cancel (H8121) | all | `H8121/H8122/H8131/H8150 SharedViewModel` |
| mode | `0x05` | H8121 `[01, mode]`; H8122 `[mode]`; H8131 `[mode, degree]` | H8121/H8122/H8131 | same |
| timer write | `0x13` (19) | H8120/H8121 `[group, enableSwitch, hour, min, repeat, mode, iceSize, lightSwitch, preCoolSwitch, sceneLE16]`; H8131 `h8131TimerInfo.getBytes()` | H8120/H8121/H8131 | `h8120/bean/H8120TimerInfo.java`, `h8121/bean/H8121TimerInfo.java`, `h8131/bean/H8131TimerInfo.java` |
| do-not-disturb | `0x16` (22) | `DoNotDisturbInfo.Companion.b(info)` → `[enable, startH, startM, endH, endM]` (forever flag included) | all | `h8150/bean/DoNotDisturbInfo.java` |
| abnormal / remind read | `0x17` (23) | none | all | `H81*Model.k0()` |
| run state read | `0x19` (25) | none | all | `H81*Model.k0()` |
| light | `0x1B` (27) | `[01,01,on/off]` light switch; `[01,02,gear]` brightness; `[05,0D,R,G,B]` color; `[05,13,scene]` scene | H8121/H8122/H8131/H8150 | `H8150/H8131/H8121 SharedViewModel` |
| settings | `0x1F` (31) | `[02,v]`, `[08,v]`, `[16,v]`, `[17,v]`, `[01,keepIceLong]` | H8121/H8122/H8150 | same |
| remind mask | `0x25` (37) | N little-endian bitmask bytes (see 3.1) | all | `H8150RemindBean`, `H8131RemindInfo`, `H8120RemindBean`, `H8121RemindBean`, `H8122RemindBean` |
| wash/clean reminder | `0x27` (39) | `[00]` off; `[02]` reset; `[on, hour]` set; `[02]` reset | H8121/H8122/H8131 | `H8121/H8122 SharedViewModel` |
| buzzer mask | `0x28` (40) | bitmask byte(s) + optional gear | H8120/H8121/H8122/H8131/H8150 | `H81*BuzzerSwitchBean` |
| buzzer gear | `0x29` (41) | `[gear]` | H8131/H8150 (read 41 on H8150) | same |
| chart switch | `0xC1` (-63) | `[30,01]`; `[01,b]` chart/log enable | all | `H81*ChartViewModel` |
| light group (H8150/H8131) | `0xB6` (-74) | `FD` close preview; `FB <flagBytes>`; `F4/FC <runState> …`; `F6 0A 0000`; `F6 04 <sceneLE16>`; `15 FE R G B`; `15 FC <runState> R G B`; `04 <sceneLE16>` | H8150/H8131 | `H8150SharedViewModel` |
| reservation (H8150) | `0x23` (35) | `[01, hour, min, dayOrdinal]` set; `[00]` cancel | H8150 | `H8150CommandTypeCons.c` |

### 3.1 Remind bit masks

Each family orders its own reminder bits and sends them as little-endian packed bytes
(`BleUtils.f(boolean[], false)` packs bit0 first). Order per family:

- H8120: `cleanTimeRemind, cleanRemind, notIceBasketRemind, descalingTimeRemind,
  descalingRemind, cleanLackWater, descalingLackWater, highTemp` then
  `lowTemp, iceLackWater, defrostLackWater, cleanAndDescalingRemind, iceAbnormal`.
- H8121: `cleanTimeRemind, cleanRemind, notIceBasketRemind, stopPreCoolForHighTempRemind,
  stopIceMakingForHighTempRemind, waterBoxErrorRemind, stopPreCoolForCleanRemind`.
- H8122: `cleanRemind, cleanCompleteRemind, highTemRemind, kazuRemind`.
- H8131: 8+8+2 bits: env/water/compressor temp high/low, NTC faults, cleanTimeRemind;
  then noExecute, filterLow, first/second clean complete, cleanUnfinished, drainageComplete,
  defrostComplete, cleanComplete; then drainageStop, iceBreak.
- H8150: `makeIceCompleted, keepIceRemainOneHour, keepIceRemainTenMinute, keepIceEnd,
  keepIceOvertime, demoldCompleted, meltIceCompleted, meltIceEnd`.

### 3.2 Modes / degrees

| enum | values | source |
|---|---|---|
| H8121Mode | 1=Small, 2=Medium, 3=Max | `h8121/bean/H8121Mode.java` |
| H8122Mode | 1=Small, 2=Medium, 3=Large | `h8122/bean/H8122Mode.java` |
| H8131Mode | 1=Thin, 2=Medium, 3=Thick, 4=ExtraThick | `h8131/bean/H8131Mode.java` |
| H8131Degree | 0=Slightly, 1=Moderately, 2=Strongly | `h8131/bean/H8131Degree.java` |
| H8150RunMode | 0=None, 1=MakeIce, 2=KeepIce, 3=Demold, 4=MeltIce, 5=Reservation | `h8150/bean/H8150RunMode.java` |

---

## 4. BLE notifications / readings

All notifications arrive as 20-byte frames; `H81*Model.k0()` reads `ResultPt` from the
IoT `op` object, but the same parsers are used locally. `[1]` selects the record:

| opcode | layout | fields |
|---|---|---|
| `0x17` (23) | `[2]=deviceStateCode`, `[3]=bitfield` | H8120: code 0..8 (NORMAL, ENV_TEMP_NTC, ICE_FULL, WATER_LACK, ENV_TEMP_HIGH, ENV_TEMP_LOW, ELECTRICAL_NTC, ICE_NTC, ICE_FULL_RECOVERY). H8131: `[2]` bitmask of device states; `[3]` = toClean. Reminder byte `[3]` also carries low-battery/water flags. |
| `0x19` (25) | `[2]=runState`, `[3]=subState`, `[4..]=countdowns` | H8120: run state 1=ice making, 2=cleaning, 3=descaling, 4=defrost. H8131: run state + sub-state (1 compressor protect, 2 water lack, 3 outer tank low, 4 door open, 5 ice full). H8150: `[2]=runState`, `[5]=flag byte` (bit7 lid open, bit4 water lack), `[2..4]` remaining seconds. |
| `0x16` (22) | `[2]=enable?`, `[3]=state` | DND: enable when `[2]==2`, active when `[3]==1`. |
| `0x25` (37) | `[2..]` bitmask | reminder bits as in 3.1. |
| `0x1B` (27) | light state | light on/off, brightness, color/scene (H8131/H8150 light engine). |
| `0x29` (41) | `[0]=gear` | buzzer gear (H8150). |

### 4.1 Ice-machine readings

| reading | unit / range | source |
|---|---|---|
| environment NTC | °C / °F, chart data (0.01 °C) | `h8131/bean/H8131RemindInfo`, chart VMs |
| electrical / compressor NTC | °C, 0.01 °C | H8120DeviceState.ELECTRICAL_NTC, H8131 compressorTempHigh |
| ice NTC | °C, 0.01 °C | H8120DeviceState.ICE_NTC |
| water temperature | °C / °F (`WaterTempInfo`) | `bean/WaterTempInfo.java` |
| ice count / weight | count, grams (today ice info) | `bean/TodayIceInfo.java` |
| battery / signal | int, dBm | `H81*SharedKey`, `LeakSubInfo` style |
| water tank / outer tank | enum/low flag | H8131 status |
| remaining time | seconds | H8150 run state, `H8150RunStateInfo` |

Exact byte offsets for the chart/temperature records are in `H81*ChartViewModel` and the
chart database (`H8120/8131/8150ChartTable`); the temperature stream uses the shared
chart GATT service (see `_REFERENCE.md` §8 and `split_pact_thnew.md`).

### 4.2 Status properties (not opcodes)

`waterLack`, `outerTankLow`, `iceFull`, `doorNotClosed`, `doNotDisturb`, `toClean`, etc.
are **status flags**, not commands. They are carried in the status frames above and/or in
the cloud device-list bean `H8131DeviceListStatus`; they do not get their own BLE opcode.

- **H8131** — `H8131DeviceListStatus.Companion.a(int[] bytes)` maps three bytes:
  - `bytes[0]` bits 1–4 = `runState`; bit 5 `e2`; bit 6 `iceMakingInterrupted`;
    bit 7 `compressorTempHigh`
  - `bytes[1]` bit 0 `envTempHigh`, 1 `envTempLow`, 2 `waterTempHigh`, 3 `pumpAbort`,
    4 `e1`, 5 `compressorStopProtection`, 6 `outerTankLow`, 7 `iceFull`
  - `bytes[2]` bit 0 `waterLack`, 1 `doorNotClosed`, 2 `doNotDisturb`, 3 `toClean`,
    4 `cleanCompleteReminder`, 5 `lastCleanIncomplete`, 6 `midTankSensorStuck`,
    7 `lowerTankWaterHigh`
- **H8150** — `H8150RunStateInfo.isWaterLack` / `isLidOpen` come from the run-state frame
  (`0x19`): `[5]` bit 4 = water lack, bit 7 = lid open.
- **H8120 / H8121** — `DeviceState.WATER_LACK` is a state code (3 and 6 respectively) in
  the `0x17` status frame, not a write command.

`waterShortageOnOff` is the *push-notification setting*, not the status flag. See
`STATUS-PROPERTIES.md` for the full table and the cloud/device-list carriers.

---

## 5. IoT commands + status schema

Envelope: `IotMsgProType.V2` (H8120/H8121/H8122/H8131/H8150 `k0(IotMsgV2, json)`).

| cmd | data | meaning | source |
|---|---|---|---|
| `online` | — | topic probe (`V()` returns `"online"`) | `H81*Model.V()` |
| `ptReal` | `{"command":["<base64 20-byte frame>"]}` | BLE frames tunneled over cloud | `IceApplicationImp` CmdBuilder uses `CmdMultiSync` + `ptReal` |
| `op` | `{"command":["<base64>"]}` | device→app frame batch | `H81*Model.k0()` via `AbsIotManagerV1.getJsonObjectStr(str,"op")` |
| `status` | — | scene/switch response marker | `IceApplicationImp` CmdBuilder parseMsg checks `"status"` |
| `turn` | `{"val":0|1}` | power switch (scene builder) | base `CmdTurn` |
| `multiSync` | `{"command":[...]}` | multi-device sync | `CmdMultiSync` in `IceApplicationImp` |

Status JSON for scene switch: `{ "status": … }`; all real state is in `op` frames.

REST/other: device detail, firmware versions, chart history and reservations use the
base2home cloud APIs; no separate LAN/MQTT code in this split.

---

## 6. Other protocols

- **Matter**: `MatterInterceptor` for goods 306/317/321 in `IceApplicationImp`; BLE
  comm object is `com.govee.matter.pact.BleComm` (standard Govee UUIDs). No cluster map
  is defined in this split; Matter pairing is delegated to the base app.
- **BLE broadcast**: `Support.parseBleBroadcastProtocol` uses
  `GoodsType.parseBleBroadcastPactInfo` for pairing; no ice telemetry in the advert.
- **ptIot**: when `OtaPactConfig.d(...)` is true, the same frames are sent under `ptIot`
  instead of `ptReal` (firmware-version dependent).
- **OTA**: base `ble/ota` + `OtaPactConfig`.

---

## 7. Dynamic effects / scenes / DIY (ice light)

Ice makers expose a light ring/panel driven by the shared Govee light engine, not by a
per-SKU scene table. Command families:

| function | opcode / payload | source |
|---|---|---|
| light switch | `0x1B 01 01 <0/1>` | `H8150SharedViewModel` |
| brightness | `0x1B 01 02 <gear>` | same |
| color | `0x1B 05 0D R G B` | same |
| scene | `0x1B 05 13 <sceneCode>` (H8150: `05 13 <sceneCode>`) | same |
| preview / set-state light (H8150/H8131) | `0xB6` group: `F4/FC <runState> <mode> <sceneLE16>` or `15 FE/FC <runState> R G B` | `H8150SharedViewModel`, `H8131SharedViewModel` |
| close preview | `0xB6 FD` | same |
| scene preset | `0xB6 04 <sceneLE16>` | same |

Scene codes come from the base light-scene catalog (`CategoryV1.SceneV1`,
`getSceneCode(0, sku)`), so IDs are catalog-dependent, not constant in this split.

---

## 8. Source map

| area | paths |
|---|---|
| registry / SKUs | `com/govee/ice/IceApplicationImp.java`, `Support.java`, `SubMaker.java`, `h81*/pact/H81*Maker.java` |
| commands | `h8120/vm/H8120SharedViewModel.java`, `h8121/vm/…`, `h8122/vm/…`, `h8131/vm/…`, `h8150/vm/H8150SharedViewModel.java` |
| command constants | `h8120/bean/H8120CommandTypeCons.java`, `h8121/…`, `h8122/…`, `h8131/…`, `h8150/bean/H8150CommandTypeCons.java` |
| state models | `h81*/bean/H81*DeviceState.java`, `H81*RunState.java`, `H8150RunStateInfo.java`, `H8131DeviceListStatus.java` |
| IoT parse | `h8120/H8120Model.java` (`k0`), `h8121/H8121Model.java`, `h8122/H8122Model.java`, `h8131/H8131Model.java`, `h8150/H8150Model.java` |
| pairing BLE | `IceApplicationImp` (`MatterInterceptor`), `h5026`-style `add` not present for ice |
| chart | `h81*/vm/H81*ChartViewModel.java`, `com/govee/ice/common/chart/*`, base `R.mipmap`/DB tables |

---

## 9. Gaps / unknowns

- No `BleComm`/`INotify` class exists in the ice split: notifications are parsed from
  `op` frames inside the models, so the local notify characteristic and the exact
  `AbsBle` subclass are only known through the base `com.govee.matter.pact.BleComm`
  (standard UUIDs).
- Chart/temperature record layout (`0x2d00/0x2d20`) is not implemented in this split;
  the VMs delegate to base chart repositories. Byte offsets for NTC values therefore
  come from the base `AbsChartDataComm`/`BaseThDataComm`, not from ice sources.
- The `H8150SharedKey`/`H8121SharedKey` bit layouts (reminder/status packing) are
  obfuscated; only the bean field names and the opcode are certain.
- `ptIot` vs `ptReal` selection depends on `OtaPactConfig.d(...)` and runtime firmware,
  so a given SKU can use either cloud path.
- No Matter cluster/attribute map is present; only the interceptor gate is visible.


---

<!-- split_pact_leaknew -->

# split_pact_leaknew — leak / water sensors (H5058, H5059, H5830)

Source root: `decompiled/jadx-splits/split_pact_leaknew/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

---

## 1. Overview / family and SKUs

The module handles Govee **leak / water-level sensors that live behind a Govee
gateway**. There is no direct GATT connection to the leak puck; all traffic is
gateway ↔ sub-device frames (opcode `0x08` family) plus REST warning history.

| SKU | goodsType | battery | probes | special |
|---|---|---|---|---|
| H5058 | 159 | 2×AAA | 3 (up / mid / down) | water-level mode, mute, SMS, dedicated warn channel |
| H5059 | 292 | 2×AAA | 1 | leak-only, no volume rule |
| H5830 | 357 | 2×AAA | 1 | leak-only, gateway weak support, SMS |

Registry: `pact/Maker4Leak.java` + `config/LeakSkuTable.java`
(`LeakSkuRow("H5058",159,…)`, `("H5059",292,…)`, `("H5830",357,…)`).
Transports: **gateway/cloud only** (the gateway itself is BLE+IoT; the leak sensor is a
sub-device). The model extends `AbsGwSubDeviceModel`; `DeviceItem.Y(scanRecord)` is a
no-op, confirming no direct advert parsing.

Sub-device types (`SubCons`):
`12` = H5058-style extended sensor, `13` = H5059-style, `4` = legacy leak,
`1/2/3/5/6/7/8` = other Govee sub-sensors (TH, door, etc.).

---

## 2. Transports & GATT UUIDs

The leak sub-device has no UUID of its own. Gateway frames use the Govee 20-byte frame
over the gateway's service:

| item | value |
|---|---|
| gateway service | `494e5445-4c4c-495f-524f-434b535f4857` (as used by `base2newth` gateways) |
| gateway characteristic | `494e5445-4c4c-495f-524f-434b535f2011` |
| frame | 20 bytes, `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` |
| write proType | `0x33` |
| read proType | `0xAA` |

`leaknew/controller/*` extends `com.govee.base2light.kt.ble.AbsController` and therefore
uses the standard `0x33`/`0xAA` proTypes. Sub-device reports are delivered as
gateway notifications and parsed by `SubDevice4OpResultParse`.

---

## 3. BLE command table (gateway → sub-device)

Command type is **`0x08`** for every leak controller. Payload starts with the
sub-device `sno` then a function id (`Controller` constants).

| function | payload | meaning | source |
|---|---|---|---|
| find device | `[sno, 06, 00]` | buzz/flash the sensor | `Controller4FindDevice.java` (`Controller.d=6`) |
| gateway warning switch | `[sno, 0A, 01, 0/1]` | enable gateway-weak warning | `Controller4GwWarnSwitch.java` (`Controller.f=10`) |
| low-battery switch | `[sno, 09, 01, 0/1]` | enable low-battery warning | `Controller4LowBatSwitch.java` (`Controller.e=9`) |
| set volume | `[sno, deviceType==H5058?0x0D:0x04, 02, level, 01]` | sensor speaker volume | `Controller4SetVolume.java` (`Controller.c=13`, `Controller.b=4`) |
| check signal | `[sno, 07, 00]` | start RSSI check | `Controller4CheckSignal.java` (`Controller.g=7`) |
| sync check-net result | `[sno, 0F, 01, 0/1]` | report gateway check result | `Controller4SyncCheckNetResult.java` (`Controller.h=15`) |
| mode switch | `[sno, 0B, 01, mode]` | leak / water-level mode (10=level, 11=leak) | `ControllerModeSwitch.java` (`Controller.i=11`) |
| delete sub-device | `[sno]` | remove from gateway | `Controller4DeleteSubDevice.java` (`cmd 0x11`) |

`Controller` constants: `b=4`, `c=13`, `d=6`, `e=9`, `f=10`, `g=7`, `h=15`, `i=11`.

---

## 4. BLE notifications / readings

### 4.1 Sub-device report parse

`SubDevice4OpResultParse` receives `(proType, cmdType, validBytes)` after the gateway
strips the frame; `Event4SubOpResult` is posted with the 17-byte payload. The payload is
then parsed by `base2newth/gwsub/ParseUtils4H5058` or `ParseUtils4H5044SubLeak`.

**H5058 short report** (`ParseUtils4H5058.e`, 17 bytes):

```
[0..7]  device name (8 ASCII bytes)
[8]     sno
[9]     device type (12 = H5058, 13 = H5059, 4 = legacy leak)
[10]    bit0 leak; bits1-7 battery/status value
[11]    unused
[12]    signal (RSSI)
[6..9]  leak timestamp (LE32, when present in the 17-byte buffer)
[3..5]  raw leak/status bytes (leakStatus, up/down)
```

**H5058 long report** (`ParseUtils4H5058.c`): `[0]=sno`, `[1]=type`,
`[2]=bitfield (bit0 leak, bits1-7 status)`, `[3..5]=raw state`,
`[6..9]=timestamp`, `[10]/[11]=soft/hard versions (nibbles)`, `[12]=signal`,
`[13..16]=LE time`.

**H5058 status bitfield** (`ParseUtils4H5058.a`, `applyH5058V1ContactBits`, long form
byte `[2]`):

| bit | field |
|---|---|
| 0 | up leak |
| 1 | mid leak |
| 2 | down leak |
| 3 | low-battery switch enabled |
| 4 | gateway warning (inverted) |
| 5 | low battery |
| 6 | set-battery-low validity (inverted) |
| 7 | set-mute validity (inverted) |

**Legacy leak** (`ParseUtils4H5044SubLeak.a`):

```
[0] sno [1] type [2] leakState [3] bitfield (bit0 leak?) [4] soft ver nibbles
[5] hard ver nibbles [6] battery [7..10] 32-bit LE time [11] mute level
[12] signal [13] ? [14] ? [15] switch bits
```

### 4.2 Warning history (REST)

`RespWarnMessageData`:

| field | meaning |
|---|---|
| `id` | record id |
| `probe` | probe index (0 top, 1 short-bottom, 2 bottom) |
| `probesState` | JSON `ProbesState {top, shortBot, bot}` |
| `status` | 1 normal, 2 gateway error, 3 sub-device error |
| `typeCode` | 31101 leak alarm, 31102 leak clear, 31124 water level alarm, 31125 water level clear |
| `createTime` | epoch ms |
| `read` | consumed flag |

Mode constants: `LEAK_MODE = 11`, `WATER_LEVEL_MODE = 10`, `NETWORK_CHECK = 12`,
`NORMAL = 1`, `GATEWAY_ERROR = 2`, `SUBDEVICE_ERROR = 3`.

`Message {message, time, read, probe}` is the local push/notification record.
`LastData4Leak {lastTime, read}` keeps the newest leak timestamp.

### 4.3 Readings

| reading | values | source |
|---|---|---|
| leak state | up/mid/down (bool) per probe | `LeakSubInfo.isUpLeakWaterStatus` etc. |
| water level mode | 3-probe level vs single leak | `LeakSubInfo.leakMode` |
| battery | 0–100 % (raw byte) | `LeakSubInfo.battery` |
| low battery | bool | `LeakSubInfo.lowBattery` |
| signal | RSSI dBm | `LeakSubInfo.signal` |
| mute level | enum/level | `LeakSubInfo.muteLevel` |
| version soft/hard | `x.y` nibbles | `LeakSubInfo.versionSoft/Hard` |
| sno / device type | int | `LeakSubInfo.sno/deviceType` |
| last leak time | epoch seconds | `LeakSubInfo.leakTimeSeconds` |
| online | bool | `LeakSubInfo.online` |

---

## 5. IoT commands + status schema

The leak sensor itself is not an IoT device; the gateway publishes sub-device state.
`Model.k0/parseIot` consumes `IotMsgV2` and `op` frames (same base64 20-byte frames),
then feeds `ParseUtils4H5058`.

| cmd | data | meaning | source |
|---|---|---|---|
| `op` | `{"command":["<base64 20-byte frame>"]}` | gateway sub-device report | `Model`, `SubDevice4OpResultParse` |
| `ptReal` | `{"command":["<base64>"]}` | gateway command tunnel (find, mode, volume) | `base2light CmdPtReal` |
| `status` | JSON | gateway/leak snapshot | `Model` |
| `warn`/`warning` | REST record list | leak history | `net/RespWarnMessage` |

REST endpoints (`net/ILeakNet`): delete data, sub-device detail, warning records,
probe state, SMS/notification settings.

---

## 6. Other protocols

- **Gateway sub-device**: the only transport. The gateway may be BLE+IoT or WiFi-only;
  `ExtLeak4Gw` stores `sku, device, topic, address, bleName, versionHard, versionSoft,
  secretCode`.
- **BLE broadcast**: not parsed for leak (`DeviceItem.Y()` is empty).
- **REST**: warning history, SMS, device detail/delete.
- **Push**: `push/WarningPush`, `H5058FirstLeakGuideHint`.

---

## 7. Dynamic effects / scenes / DIY

No light/music effects. "Modes" are leak vs water-level (`ControllerModeSwitch`,
`LeakSubInfo.leakMode`); warning rules and volume are per-SKU policy
(`config/LeakSkuTable`, `GwWarnSupportRule`, `VolumeSupportRule`).

---

## 8. Source map

| area | paths |
|---|---|
| registry / SKUs | `pact/{Maker4Leak,SubLib,Support}.java`, `config/{LeakSkuTable,LeakSkuResolver,LeakSkuRow}.java` |
| controllers | `controller/{Controller,Controller4FindDevice,Controller4GwWarnSwitch,Controller4LowBatSwitch,Controller4SetVolume,Controller4CheckSignal,Controller4SyncCheckNetResult,ControllerModeSwitch,Controller4DeleteSubDevice,SubDevice4OpResultParse}.java` |
| sub-device parsers | base `com/govee/base2newth/gwsub/{ParseUtils4H5058,ParseUtils4H5044SubLeak,LeakSubInfo,SubCons}.java` |
| model | `pact/Model.java`, `model/{LastData4Leak,ExtLeak4Gw,ExtContainerGw}.java` |
| REST | `net/*.java` |
| push / warn | `warn/*`, `push/*` |

---

## 9. Gaps / unknowns

- The gateway's own BLE UUID/characteristic is not declared in this split; the module
  relies on `base2newth` gateway classes (`GwDevice`, `Controller4SubPtRealOp`), which
  use the `494e…4857`/`…2011` gateway service.
- `ParseUtils4H5058` has two report shapes (short and long); the selection depends on a
  runtime `SubCons` version check (`SubCons.a(version1, version2)`), and the exact
  firmware threshold is not visible.
- The H5058 `probesState` JSON is a string produced by the cloud
  (`{"top":…,"shortBot":…,"bot":…}`); no local binary layout is defined for it.
- H5059/H5830 share the same parser as H5058 but expose only one probe; the
  "mid/down" bits are simply ignored.


---

<!-- split_pact_outdoorlight -->

# split_pact_outdoorlight — outdoor strips / pathway / garden / curtain (H7040, H7056, H7080, H7086)

Source root: `decompiled/jadx-splits/split_pact_outdoorlight/sources/com/govee/`.

The module contains four independent pact families, each with its own `pact/`, `ble/`, `scenes/`
and (for two of them) `iot/` packages:

| package | goodsType | product(s) | transports |
|---|---|---|---|
| `h7040` | 36 | H7040 camping lantern | **ble** |
| `h7056` | 304 | H7056 Pathway Lights 2 | **ble + iot** |
| `h7080` | 45 / 55 / 56 | B7080 / B7081 / B7082 (H7080/H7081/H7082), plus H7085 (276) detail config | **ble** |
| `h7086` | 293 | H7086 Garden Lights | **ble + iot** |

`h7080.pact.Support` also declares 276 (H7085) for detail/Diy only
(`isGoodsTypeH7085`), while `Pact` protocols are registered for 45/55/56.
`OutdoorLightModuleInitImpl` registers all four `ApplicationImp` classes.

No MQTT topics or Matter clusters are implemented in this split; `DeviceCommCapability.supportMqtt`
is only consulted by shared `AbsOpCommDialog4BleIot` code for LAN-capable devices, and
`supportMqtt` is a capability-list + non-empty-topic test in `com.govee.device.DeviceCommCapability`.

---

## 1. Transports & GATT UUIDs

All four families use the same vendor GATT pair:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `h7040/ble/BleComm.java`, `h7056/ble/BleComm.java` (via
`com.govee.common.params.BleCommUUID`), `h7080/ble/BleComm.java`, `h7086/ble/BleComm.java`.
H7040 also has `BleMultiComm` with the same UUIDs.

Frame: 20 bytes; `[0]=proType` (`0x33` write / `0xAA` read / `0xA3`,`0xA4`,`0xA5` multi),
`[1]=cmdType`, `[2..18]=payload`, `[19]=XOR BCC`.

---

## 2. H7040 (goodsType 36, camping lantern)

Pact: `GoodsType.beProtocol(1,1)`; `Support.getBulbStringMaxNum()=1`,
`getOneGroupColorSize()=4`; scene-op set `{0,1}`. BLE only (`AbsEffectOp4Ble`, no `iot/`).

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` / `0xAA/0x01` | `[0] 0/1` | base `SwitchController` via `pact/Comm.java` |
| brightness | `0x33/0x04` | `[0] 1..254` | `pact/Comm.makeBrightnessController4BleComm` |
| mode | `0x33/0x05` | sub-mode payload, see below | base `AbsModeController` |
| color | sub-mode `0x0D` | `0D R G B kelLo kelHi R2 G2 B2` (9 B) | `ble/SubModeColor.java` |
| music / mic set | sub-mode `0x05` | `05 01` (set mic mode) | `ble/SubModeMic.java` |
| mic realtime points | `0x33/0x05` | `05 00 R G B` (direct `MicController.q()`) | `ble/MicController.java` |
| scene | sub-mode `0x04` | `04 effectLo effectHi` | `ble/SubModeScenes.java` |
| DIY | sub-mode `0x0A` | `0A diyLo diyHi` | `ble/SubModeNewDiy.java` |
| SOS | `0x33/0x0B` | `[0] 0/1` | `ble/SOS4BleController.java` (`SINGLE_SOS_CHANGE_4_BLE=11`) |
| heart / battery | `0xAA/0x01` | valid bytes below | `ble/HeartController.java` |

Heart/battery parse (`h7040/detail/BatteryInfo.Companion.a(byte b)`):

```
bit7       = charging/full flag
bits6..4   = battery bars: 0/1 -> 1, 2 -> 2, 3 -> 3, 4 -> 4, 5 -> 5; bit7 set -> -1 (charging)
bit0       = flag A
bit3       = flag B
```

`NewDetailVm.notifyParseList` treats `[0]==1` as switch report and `[1]` bit7 as on/off, and
`p5()` reads `bArr[2]` for the battery byte. `HeartController` also decodes a 4-state work mode
from bits 0x10/0x20/0x30/0x40/0x50.

### Scenes / effects

`adjust/ui/ScenesV0.java` menus use effect ids
`0, 1, 10, 1018–1050` (14 + 9 + 6 + 7 entries), plus `Support.g = {1030,1033,10}` and
`Support.h = {0,1,1034,1035}` controlling whether the scene respects system brightness.
Hints exist for `0` (GM) and `1` (Sunset); `108` (alarm) has a hint.

### IoT

None in this split. `h7040/detail/NewDetailVm` still contains `parseIotMsg4Online` hooks because
the base VM is shared, but no `Iot*CmdBuilder` is registered for goodsType 36.

---

## 3. H7056 (goodsType 304, Pathway Lights 2)

Pact: `GoodsType.beProtocol(1,1)`; `H7056Support`:
- colour pieces 8 (`getColorPieceSize`), group size 4, kelvin 2700..6500
- scene-op set `{0,2,3,5,6}` (no dynamic/music op 1/4?)
- DIY sub-effect ids 1..10 (see below)

Transports: BLE + IoT (`Iot*CmdBuilderV1` registered in `H7056ApplicationImp`).

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] level` | `pact/Comm.makeBrightnessController4BleComm` |
| mode | `0x33/0x05` | sub-mode payload | `ble/Mode.java` |
| color | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask0..3` (17 B). Masks support up to 32 segments although device has 8; `Supports` uses `i` = piece count. | `ble/SubModeColor.java` |
| per-segment brightness | `0x15` | `15 02 level 00 mask0..3` | `ble/SubModeColor.java` |
| raw RGB array | `0x15` | `15 03 c0..c15` | `ble/SubModeColor.java` |
| colour-strip group | frame payload built by `Comm.a(i,colors)`: `15 04 index c0..cN` (4 colours per frame, last group shorter); brightness group `15 03 index b0..b13` (14 per frame) | `pact/Comm.java#a` / `#d` |
| music | `0x13` | `13 code sens` (code default 101, sens 0..99) | `ble/SubModeMusic.java` (`BleProtocol.b=19`) |
| scene | `0x04` | `04 effLo effHi musicCode0..3 level` (8 B) — 32-bit LE music code, 1-byte level; effect default `2002` | `ble/SubModeScenes.java` |
| DIY | `0x0A` | `0A diyLo diyHi groupLo groupHi` (5 B, group index for multi-group presets) | `ble/SubModeNewDiy.java` |

Notify:

| op | layout | meaning | source |
|---|---|---|---|
| `0x11` | `[0]==0` | WiFi connected | `ble/WifiNotifyParse.java` |
| `0x20` | `[0]` | brightness report | `ble/BrightnessNotifyParse.java` |
| `0x30` | `[0]==1`, `[1]` on/off, `[2]` secondary | device switch status | `ble/DeviceSwitchStatusNotifyParse.java` |

### DIY / effects (H7056)

`Pro4H7056Diy` sub-effect ids (`diy/Pro4H7056Diy.java`):

| id | class | effect | extra params |
|---|---|---|---|
| 1 | `Gradual` | gradual | 1..n colours + speed |
| 2 | `HuXi` | breath | colours + speed |
| 3 | `CaiHong` | rainbow | colours + speed + direction |
| 4 | `FuGai` | cover | colours + speed |
| 5 | `WeiGuang` | glimmer | colour + brightness |
| 6 | `ShengKai` | blooming | colours + speed |
| 7 | `LiuGuang` | flowing light | colours + RGB + speed + direction |
| 8 | `ShanGuang` | flash | colours + speed |
| 9 | `CaiQiang` | colour wall | colours + speed |
| 10 | `XuanZhuan` | rotate | colours |

Wire body: `[lenLo lenHi][subEffect][colourCount][R G B]×n[…]`. Multi-frame write uses protocol
code `0x58` (`H7056DiyParser.getProtocolCode()`), with `MultiController` frames.

### IoT (H7056)

`iot/Cmd` constants: `turn`, `brightness`; `CmdColorWc` is the shared base `colorwc`.
`IotSwitchCmdBuilderV1` parses `IotMsgProType.V2`.

| cmd | data | source |
|---|---|---|
| `turn` | `val` 0/1 | `h7056/iot/CmdTurn.java` |
| `brightness` | `brightness` int | `h7056/iot/CmdBrightness.java` |
| `colorwc` | `color{red,green,blue}`, `colorTemInKelvin` | base `base2light/iot/CmdColorWc` via `pact/Comm` |
| `ptReal` | `command:[base64(frame)]` | `pact/bleiot/*` (`OpDiyCommDialog4BleIot`, `Cmd4PtReal`) |

Status uses the shared V2 message (`status`, `state`, `op`) with the same fields as the base
light family (on/off, brightness, colour, mode).

---

## 4. H7080 / B7080 / B7081 / B7082 / H7085 (goodsType 45, 55, 56, 276)

Pact: `GoodsType.beProtocol(2,1)` for 45/55/56. BLE only. Segment counts:
- 45 (B7080) and 276 (H7085): 4 segments
- 55 (B7081): 8 segments
- 56 (B7082): 6 segments
- `getOneGroupColorSize`: 3 for 45/55/56, 4 for 276.

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] level` | `pact/Comm` |
| mode | `0x33/0x05` | sub-mode payload | `ble/Mode.java` |
| color | `0x15` | mode 1: `15 01 R G B kelLo kelHi R2 G2 B2 mask0` (mask bits 0..k-1) — 12-byte buffer; mode 2: `15 02 level 00 mask0`; mode 3: `15 03 c0..c15` | `ble/SubModeColor.java` |
| mic set | `0x05` | `05 01` | `ble/SubModeMic.java` |
| mic points | `0x33/0x05` | `05 00 R G B` | `ble/MicController.java` |
| scene | `0x04` | `04 effLo effHi` | `ble/SubModeScenes.java` |
| DIY | `0x0A` | `0A diyLo diyHi` | `ble/SubModeNewDiy.java` |
| location write | `0x33/0xA7` (`value_sub_mode_location = -89`) | `[0]=N`, then pairs `[index][value]`; read `p()` = `[N]`; response pairs index/value | `ble/LocationController.java` |
| check location | `0x33/0xA6` (`value_sub_mode_check_location = -90`) | `[0] count`, `[1] index`; response not parsed (write-ack only) | `ble/CheckLocationController.java` |
| gradual | `0xA3/0xA3` (`SINGLE_GRADUAL_CHANGE_4_BLE=-93`) | `[0] 0/1` | `ble/Gradual4BleController.java` |
| read bulb-string colour | `0xAA/0xA5` | `p()` = `[index]`; response `[0]=index`, then 3 × `[index,R,G,B]` | `ble/BulbStringColorController.java`, `ble/BulbGroupColor.java` |

Scene ids: `Support.m` hints 0 (GM), 1 (Sunset), 108 (alarm); `adjust/ui/ScenesV0` /
`RgbScenesV1` provide the local scene menus. H7085 (276) has its own DIaY/config under
`h7080/adjust/h7085/*`.

### IoT

None (`H7080ApplicationImp` registers only `AbsBleCmdBuilderV1`).

---

## 5. H7086 (goodsType 293, Garden Lights)

Pact: `Support.c() = {1,100,0}` (brightness range/progress descriptor), kelvin 2700..6500,
4 colour pieces and 4 segments. BLE + IoT (`H7086ApplicationImp` registers both builder sets).

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] level`; remapped with `NumUtil.calculateProgress(100,1,v)` when `Support.c()[2]==1` (currently 0, so raw) | `pact/Comm.java` |
| mode | `0x33/0x05` | sub-mode payload | `ble/Mode.java` |
| color | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask0..3` (17 B, 4 segments) | `ble/SubModeColor.java` |
| per-segment brightness | `0x15` | `15 02 level 00 mask0..3` | `ble/SubModeColor.java` |
| raw array | `0x15` | `15 03 c0..c15` | `ble/SubModeColor.java` |
| music | `0x13` | `13 code sens` (code default 5) | `ble/SubModeMusic.java` |
| scene | `0x04` | `04 effLo effHi musicLo musicHi` | `ble/SubModeScenes.java` |
| DIY | `0x0A` | `0A diyLo diyHi groupLo groupHi` | `ble/SubModeNewDiy.java` |
| cap-calibration mode | `0x33/0x30` | `[0] 0/1` enable/disable | `adjust/controller/CapCalibrationStatusController.java` |
| cap-calibration order | `0x33/0x31` | `[serial...]` (one byte per cap) | `adjust/controller/CapCalibrationController.java` |
| cap-calibration status | notify `0x32` | any payload -> callback | `adjust/controller/CapCalibrationStatusParse.java` |

Notify: `0x20` brightness, `0x30` switch status, `0x32` cap-calibration status, `0x11` WiFi.

### Effects / DIY (H7086)

`H7086DiyParse.getProtocolCode()=0x58`, effect code `761` (0x2F9). Seven primitive DIY
sub-effects (`SubEffectConfig`):

| id | effect | parameters |
|---|---|---|
| 1 | Breath (`SubEffectBreath`) | speed, colours, direction |
| 2 | Meteor shower (`SubEffectMeteorShower`) | speed, direction, density, length, background |
| 3 | Loop (`SubEffectLoop`) | speed, direction, loop mode |
| 4 | Glimmer (`SubEffectGlimmer`) | speed, brightness, background |
| 5 | Pile-up (`SubEffectPileUp`) | speed, direction, fill mode |
| 6 | Sunrise (`SubEffectSunrise`) | speed, direction, rise mode |
| 7 | Firework (`SubEffectFirework`) | speed, direction |

UI presets (`H7086DiyConfig.c`) map to codes `1..23`; 21/22/23 are H7086-specific templates
(`H7086DiyTemp4Colorful` base64 `CgIf…`, `H7086DiyTemp4DazzlingMeteor` base64 `CgEu…`).
Direction options use codes `9/10/2/19/15/20` (up/down/left/right/…).
Cell-graffiti tags `76..80` (`H70DXCellGraffitiParse`, shared H70DX code) are not used here.

### IoT (H7086)

| cmd | data | source |
|---|---|---|
| `turn` | `val` 0/1 (+ optional sub) | `h7086/pact/Comm.makeSwitchCmd4IotComm` (base `CmdTurn`) |
| `brightness` | `brightness` int | `h7086/pact/Comm.makeBrightnessCmd4IotComm` |
| `colorwc` | `color`, `colorTemInKelvin` | `h7086/pact/Comm.makeColorCmd4IotComm` |
| `ptReal` | `command:[base64(frame)]` | `h7086/iot/CmdPtReal.java` (DIY/scene/cell graffiti) |

`CmdPtReal` methods: `a(diyProtocol)`, `b/c(diyGraffiti)`, `d(diySendData)`,
`e(diyTemplate)`, `g(newScenes)`, `h(list)`. DIY graffiti limits `commands.size() <= 19`.

---

## 6. Source map (traced)

- H7040: `h7040/pact/{Support,Comm}.java`, `h7040/ble/{BleProtocol,BleComm,Mode,SubModeColor,SubModeMic,SubModeScenes,SubModeNewDiy,MicController,SOS4BleController,HeartController}.java`,
  `h7040/adjust/ui/ScenesV0.java`, `h7040/detail/{BatteryInfo,Info4Detail,NewDetailVm}.java`,
  `h7040/H7040ApplicationImp.java`
- H7056: `h7056/pact/{H7056Support,Comm}.java`, `h7056/ble/*.java`, `h7056/iot/*.java`,
  `h7056/diy/*` (10 sub-effects), `h7056/pact/bleiot/*`, `h7056/H7056ApplicationImp.java`
- H7080: `h7080/pact/{Support,Comm}.java`, `h7080/ble/*.java` (incl. `LocationController`,
  `CheckLocationController`, `Gradual4BleController`, `BulbStringColorController`),
  `h7080/adjust/ui/*`, `h7080/adjust/h7085/*`, `h7080/H7080ApplicationImp.java`
- H7086: `h7086/pact/{Support,Comm}.java`, `h7086/ble/*.java`, `h7086/iot/CmdPtReal.java`,
  `h7086/adjust/controller/*`, `h7086/adjust/mode/diy/*`, `h7086/pact/bleiot/*`,
  `h7086/H7086ApplicationImp.java`
- module init: `outdoorlight/OutdoorLightModuleInitImpl.java`

## 7. Gaps / unknowns

- H7040 `HeartController.parseValidBytes` is partly decompiled control flow; the battery nibble
  mapping is confirmed from `BatteryInfo`, the work-mode nibble mapping (0x10→1, 0x20→-1,
  0x30→3, 0x40→4, 0x50→5) is inferred from the bytecode.
- H7056 scene `musicCode` is a 32-bit LE value whose meaning (online music id) is runtime/cloud
  supplied; only the default `2002` and the layout are static.
- H7080 276/H7085 packs are configured for detail/DIY but not registered in `Pact` for 45/55/56;
  its colour/segment behaviour is read through the same `SubModeColor.k` static set by `Comm`.
- H7086 cap-calibration response payloads are not parsed beyond "notify received" (status only).
- No MQTT topic/serialization or Matter cluster implementation is present in this split.


---

<!-- split_pact_plugnew -->

# split_pact_plugnew — smart plugs (H5080 / H5082 / H5083 / H5085 / H5086 / H5089 / H5160 / H5161)

Source root: `decompiled/jadx-splits/split_pact_plugnew/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

---

## 1. Overview / family and SKUs

This module contains **four plug sub-families** that share one BLE transport but have
different detail UIs, timer layouts and (for H5086) energy metering:

| SKU | goodsType | plugs | protocol group | transport | notes |
|---|---|---|---|---|---|
| H5080 | 43 | 1 | V1 | ble+iot | original Smart Plug; `isOldH5080()` if soft ≤ 10008 |
| H5083 | 43 | 1 | V1 | ble+iot | same goodsType as H5080, 1 socket; H5083-specific detail; lock/indicator only if soft ≥ 10003 and hard ≥ 40100 |
| H5085 | 43 | 1 | V1 | ble+iot | Matter-capable variant (MatterInterceptor checks H5085 version `1.00.20`/`3.01.00`) |
| H5082 | 50 | 2 | V2 | ble+iot | dual plug (`getPlugNum(50)=2`) |
| H5160 | 90 | 3 | V3/V4 | ble+iot | triple plug (`getPlugNum(90)=3`, `getDefHeaderRes` 5160) |
| H5161 | 90 | 3 | V3/V4 | ble+iot | triple plug, “trip plug V2” (`isTripPlugV2(H5161)`); goodsType 90 |
| H5089 | 307 | 2 + night light | V4/H5089 | ble+iot, matter | 2 AC sockets + RGB night light; 3 timer groups (0,1 = sockets, 2 = night light) |
| H5086 | 195 | 1 | H5086 | ble+iot | **Smart Plug Pro** with energy metering, runtime, time monitor, power alarms, chart logging |

Registry: `h5080/pact/Support.java` (`b..h` = H5080/H5083/H5085/H5082/H5160/H5161/H5089),
`h5080/pact/SubLib.java` (`Support.m = {43,90}` → Item30), `h5080/pact/SubLib4Plug2.java`
(`Support.n = {50,307}` → Plug2 item), `h5080/pact/SubMaker.java` (V1=43, V2=50, V3=90,
V4=307), `h5086/pact/H5086Support.java` (195 only), `h5086/pact/SubLib.java`.

Pact support ints (`Support.addSupportPact`):
- 43: beProtocol(1,1),(1,2),(2,1),(2,2)
- 50: (1,1),(1,2),(2,1)
- 90: (1,1),(2,1)
- 307: (1,2),(2,2)
- 195 (H5086): (1,1),(2,1)

The `20-byte` frame goes through `h5080/ble/BleComm.java`:
service `00010203-0405-0607-0809-0a0b0c0d1910`,
characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`.
H5086 additionally exposes the chart service `494e5445-4c4c-495f-524f-434b535f4857`
with write characteristic `…2014` and notify/chart characteristic `…2015`
(`h5086/ble/BleComm.java`, `AbsBleWithChartDataComm.java`).

All families are `AbsBleWifiSku` / `AbsDeviceModel4BleIot` → **BLE + IoT (cloud)**.
BLE is the primary local path; IoT is used when BLE is unavailable, via `ptReal`
for the same 20-byte frames (and `ptIot` on H5089 OTA).

---

## 2. Transports & GATT UUIDs

| item | value |
|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` |
| frame | 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` |
| write proType | `0x33` |
| read proType | `0xAA` |
| multi-write (H5086 chart, H5083 DIY) | `0xA3` / `0xA5` per `MultipleControllerComm*` |
| notify proType | `0xEE` |

H5086 chart path:
- service `494e5445-4c4c-495f-524f-434b535f4857`
- write/self characteristic `494e5445-4c4c-495f-524f-434b535f2014`
- chart notify characteristic `494e5445-4c4c-495f-524f-434b535f2015`
- `isSelfComm` also accepts the standard `0001…1910` service.

H5089 night light uses the standard `0001…1910` / `…2b11` characteristic, but the
light sub-protocol is supplied by `base_h71xx` (`LightRgbController`, cmd `0x1B`).

Pairing uses the standard `SecretKeyController` (`0xB1` read secret / `0xB2` write
secret) followed by `SwitchControllerV2` (`0x33/0x01`) in `pact/Model.java`,
`pact/Model4Plug2.java`, `h5080/add/AbsPairAc4SecretV1.java`.

---

## 3. BLE frame + command table

### 3.1 Common plug commands (H5080/H5082/H5083/H5085/H5160/H5161)

`proType 0x33` for writes, `0xAA` for reads. All payloads below are the 17-byte
payload region (before BCC).

| command | cmdType | payload | layout / meaning | source |
|---|---|---|---|---|
| switch | `0x01` | `M` | bit mask. Socket 0: `0x10 \| on`; socket 1: `0x20 \| (on?2:0)`; socket 2: `0x40 \| (on?4:0)`; all/order=15: `0xF0 \| (on?0x0F:0)` | `ble/controller/SwitchControllerV2.java#q` |
| read switch/heart | `0xAA/0x01` | – | returns 8 bits, bit i = socket i on | `SwitchControllerV2#parseValidBytes` |
| heartbeat | `0xAA/0x00` | – | 8-bit socket mask | `HeartControllerV2` |
| heart (H5080 extra) | `0x33/0x01` | `q()` | same mask | `HeartControllerV2.i()` |
| brightness (H5086 only) | `0x04` | `val` | 0–100 | base `BrightnessController` |
| new timer V1 | `0x33/0xB4` (-76) | `group, enableAndType, hour, minute, repeat` | `group` low nibble; `0x10` in group byte means `h==1` (see `q()`); 4 timers per group | `NewTimerController.java#q` |
| read timer V1 | `0xAA/0xB4` | `group` (or `0xFF`) | returns 4×4-byte Timer records `[enableAndType,hour,min,repeat]` | `NewTimerController#parseValidBytes` |
| new timer V2 | `0x33/0x13` (19) | `index, group, enableAndSwitch, hour, min, repeat` | index = packet/group page | `NewTimerControllerV2#q` |
| read timer V2 | `0xAA/0x13` | `index, group` | 16 bytes = 4 records, group from nibble | `NewTimerControllerV2` |
| timer count | `0xAA/0x12` (18) | `group` | response `[group,count]` | `NewTimerCountController` |
| delete timer | `0x33/0x15` (21) | `group, index` | | `TimerDeleteController#q` |
| on/off delay | `0x33/0xB0` (-80) | `index, type, hour, minute` | type 0 = turn-on delay, 1 = turn-off delay; payload uses minutes split h/m | `TurnOnOffDelayController#q` |
| read delay | `0xAA/0xB0` | `index, type` | response `[index,type,h,m,remainSec24]` | `TurnOnOffDelayController#parseValidBytes` |
| sync time | `0x33/0xB5` (-75) | `ts32 BE, 0,0,0,0,1, tzHour, tzMin` | Unix epoch seconds (BE32) | `SyncTimeController#q` |
| spec/feature | `0xAA/0xB3` (-77) | – | `[0]` spec byte | `SpecController` |
| battery (H5080) | `0xAA/0x08` | – | standard battery | base `BatteryController` |
| device info | `0xAA/0x07` | `[16]` | returns id/version block | `DeviceBasicInfoController` (H5086) |

`SwitchControllerV2` write masks (H5080/H5082/H5162 style):
```
i2==0 -> 0x10 | on
i2==1 -> 0x20 | (on?0x02:0)
i2==2 -> 0x40 | (on?0x04:0)
else  -> 0xF0 | (on?0x0F:0)
```
`EventSwitchV2.h()` maps reply bit `(i+4)` back to socket state; `i()` ORs all booleans.

### 3.2 H5089 (2 sockets + night light) extra commands

| command | proType/cmdType | payload | layout | source |
|---|---|---|---|---|
| total switch | `0x33/0x02` | `on?1:0` | all sockets | `h5089/Controller4TotalSwitch.java` |
| read total switch | `0xAA/0x02` | – | not parsed | same |
| child lock | `0x33/0x1F` (31) | `02, on?1:0` | sub-function 2 | `h5089/Controller4ChildLock.java` |
| read child lock | `0xAA/0x1F` | `02` | response `[02,state]` | same |
| night-light switch | `0x33/0x1B` (27) | `01, 01, on?1:0` | first byte 1 = switch block; third byte state | `h5089/Controller4NlSwitch.java` |
| night-light brightness | `0x33/0x1B` | `01, 02, value` | value 0–100 | same (`g` branch) |
| read night-light | `0xAA/0x1B` | `01` | response `[1,state,brightness]` | same |
| night-light mode | `0x33/0x1B` | `05, submode, …` | see §7 | `Notify4NightLight`, base `LightRgbController` |
| night-light sleep | `0x33/0x28` (40) | `enable, startBri, closeMin, curMin, defaultLight, R,G,B, ctLo, ctHi` | 40 = sleep timer | `h5089/Controller4NlSleep.java` |
| night-light wake | `0x33/0x29` (41) | `enable, endBri, hour, min, repeat, wakeMin, defaultLight, R,G,B, ctLo, ctHi` | 41 = wake timer | `h5089/Controller4NlWakeUp.java` |
| read timers (H5089) | `0xAA/0x13` | `(group<<4)|page` | 4 TimerInfo records | `h5089/Controller4H5089TimerInfo.java` |
| DND/indicator light | `0x33/0x16` (22) | `enable, startH,startM,endH,endM` or `enable,0xFF` for forever | base `NotDisturbController` | `base_h71xx/sku_base/ble/controller/NotDisturbController.java` |
| read DND | `0xAA/0x16` | – | same layout | same |
| OTA pact report | `0x33/0xA9?` | `-85,2,pactTypeLo,pactTypeHi,pactCode` | H5089 `BleOp4H5089` uses `0xAB`-style OTA controller, via `ptReal`/`ptIot` | `H5089OpManager`, `ReportOtaPactController` |

H5089 timer pages: `Controller4H5089TimerInfo.p()` = `((page<<4)|group)`; `count`
comes from `0x12` and the code reads `ceil(count/4)` pages, then (group 2) a
`SwitchControllerV2()` read.

### 3.3 H5086 Smart Plug Pro commands

`ControllerProtocol` constants (`h5086/ble/controller/ControllerProtocol.java`):
`7 device info`, `1 switch`, `2/3/6` internal, `0x10` pair info, `0x11` wifi info,
`0x14` read info, `0x19` device electric, `0x1A` time monitor, `0x1B`? , `0x1F` child lock,
`0x16` light/DND, `0x17` exception state, `0x20` wifi hard, `0x21` wifi soft,
`0x25` power warning V1, `0x26` timer delete, `0x27` power warning V2, `0x28` V2 write,
`0x13` timer read, `0xB5` sync time, `0xB0` delay, `0xB4` timer write, `0xAA` read-all,
`0x23`? , `0x1A` time monitor.

| command | cmdType | payload | layout | source |
|---|---|---|---|---|
| switch | `0x33/0x01` | `on?1:0` | | `SwitchController` |
| brightness notify/read | `0xAA/0x20` | – | `[brightness]` | `BrightnessNotifyParse` |
| child lock | `0x33/0x1F` | `02, on?1:0` | | `ChildLockController` |
| delay on | `0x33/0xB0` | `00, hour, minute` | type 0 | `DelayOnOffController.g` |
| delay off | `0x33/0xB0` | `01, hour, minute` | type 1 | `DelayOnOffController.h` |
| read delay | `0xAA/0xB0` | `00` / `01` | `[?, hour, minute, remainSec24]` | `DelayOnOffController` |
| timer write | `0x33/0xB4` | `group, enableAndSwitch, hour, min, repeat` | | `TimerWriteController` |
| timer delete | `0x33/0x15` | `group` | | `TimerDeleteController` |
| read timers | `0xAA/0x01` + `0x13` | multi-read | 4-byte TimerInfo records | `TimerReadController` |
| sync time | `0x33/0xB5` | `ts32 BE, 1, tzHour, tzMin` | | `SyncTimeController` |
| device info | `0xAA/0x07` | `[16]` | response: addr(8), soft(3), hard(3), ??? | `DeviceBasicInfoController` |
| wifi info | `0xAA/0x07` | `[17]` | response: mac(6), wifi soft(3), wifi hard(3) | `WifiInfoController` |
| secret read | `0xAA/0xB1` | – | 8-byte key, base64 | `SecretController` |
| secret write | `0x33/0xB2` | base64 key bytes | | `SecretController` |
| device electric | `0xAA/0x19` | – | see §3.4 | `DeviceElectricController` |
| time monitor | `0xAA/0x1A` | – | see §3.4 | `TimeMonitorController` |
| power warning V1 | `0xAA/0x27` | – | see §3.4 | `PowerWarningController` |
| power warning V2 write | `0x33/0x28` | `02/01, on?1:0, valueBE16` | sub 2 = warning, sub 1 = auto-off | `PowerWarningControllerV2` |
| DND/light | `0x33/0x16` | `enable,startH,startM,endH,endM,forever` | | `LightController` |
| exception state | `0xAA/0x17` | `01` | response `[1]` = exception | `ExceptionStateController` |
| chart prepare | `0x33/0x02` | – | chart transfer start | `ChartPrepareInfoController` |
| chart range | `0x33/0x01` | `startSec32 BE, endSec32 BE` | chart transfer window | `ChartTimeRangeController` |
| read all | `0xAA/0xAA` | – | triggers device full read | `ReadAllNotifyParse` |

### 3.4 H5086 readings / field layouts

**Device state (cmd `0x19`, 17 payload bytes)**

```
[0..2]  runtime            BE24 / 60        -> minutes
[3..5]  electricUse        BE24 / 10000     -> kWh
[6..7]  volts              BE16 / 100       -> V
[8..9]  amps               BE16 / 100       -> A
[10..12] activePower       BE24 / 100       -> W
```
(`DeviceElectricController.d`; also `DeviceStateNotifyParse`.)

**Time monitor (cmd `0x1A`, 17 bytes)**

```
[0..3]  id                BE32
[4]     state             int
[5]     hour              int
[6]     minute            int
[7..9]  remainSeconds     BE24
[10..12] electUse         BE24 (no scaling in code)
```
(`TimeMonitorController.e`.)

**Power warning (cmd `0x27`, ≥8 bytes)**

```
[0] warningIsSet   1/0
[1] warningOpen    1/0
[2..3] warningValue BE16 (W)
[4] offIsSet       1/0
[5] offOpen        1/0
[6..7] offValue    BE16 (W)
```
(`PowerWarningController.c`.)
V2 writes `0x28` with sub `1` = auto-off and `2` = warning; value is BE16,
`-1/-1` means “unchanged/disabled”.

**Timer** (`TimerReadController`): 4 bytes `[flags,hour,min,repeat]`;
`flags & 0xF0 == 0x80` → enabled; `flags & 0x01 == 1` → on (else off).

**On/off delay** (`DelayOnOffController`): `[?,type,h,m,remainSec24]`.

**Chart packet** (`AbsBleWithChartDataComm.parse/ReceiveRunnable`):
- `0xAC` multi-read frames; first two payload bytes = start hour index BE16.
- 5 slots × 3 bytes: `[runMinutes, energyBE16/10000]` (kWh).
- timestamp = chartRangeStart + (index + slot) * 3600 s.
- chart control: `0x03` prepare, `0x0F` schedule list, `0x01` time range.

---

## 4. BLE notifications / readings

| notify cmdType | parser | layout / meaning | source |
|---|---|---|---|
| `0x11` | `WifiNotifyParse` | `[0]==0` → WiFi connected | h5080 & h5086 |
| `0x01` | `HeartControllerV2` / `SwitchControllerV2` | bit mask of 8 sockets | `h5080/ble/controller/HeartControllerV2.java` |
| `0x20` | `BrightnessNotifyParse` | `[0]` brightness 0–100 | `h5086/ble/BrightnessNotifyParse.java` |
| `0x19` | `DeviceStateNotifyParse` | electric data (see §3.4) | `h5086/ble/DeviceStateNotifyParse.java` |
| `0x1A` | `TimeMonitorNotifyParse` | time monitor snapshot | `h5086/ble/TimeMonitorNotifyParse.java` |
| `0xAA` | `ReadAllNotifyParse` | “all data ready” event | `h5086/ble/ReadAllNotifyParse.java` |
| `0x1B` | `Notify4NightLight` | if `[0]==1` → switch `[1]=state,[2]=brightness`; if `[0]==5` → light mode (`LightModeInfo`) | `h5080/ble/controller/h5089/Notify4NightLight.java` |
| `0xEE/0x01` | chart state (`ChartStateNotifyParser`) | `[0]=1` done with total packets BE16, `[0]=2` querying | `h5086/ble/ChartStateNotifyParser.java` |
| `0xEE/0x??` | `Notify4NightLight` | same night-light report via EE notify | same |

H5086 `BleNotifyComm` registers `WifiNotifyParse`, `DeviceStateNotifyParse`,
`ReadAllNotifyParse`, `TimeMonitorNotifyParse`; the chart path uses
`BleNotifyChartComm` (proType `0xEE`, service `…4857`) with `ChartStateNotifyParser`.
H5080 `BleNotifyComm` registers `WifiNotifyParse` and `Notify4NightLight`.

---

## 5. IoT commands + status/readings schema

### 5.1 Envelope

`h5080/iot/*` and `h5086/iot/*` use `AbsCmd` + `CmdBuilder.makeCmdStr`:

```json
{"msg":{"transaction":"...","accountTopic":"...","type":1,"origin":32,
        "cmdVersion":<int>,"cmd":"<name>","data":{...}}}
```

`IotSwitchCmdBuilderV1` parses replies as **IotMsgProType.V2** (`IotMsgV2`) and
checks `transaction` then `cmd` ∈ {`status`, `ptReal`}.

### 5.2 Command names (`h5080/iot/Cmd.java`)

| cmd | data | meaning |
|---|---|---|
| `state` | `{"onOff": <bitmask>}` | switch state read-back |
| `op` | `{"command":["<base64 20-byte frame>",…]}` | raw frame result (timers/delays) |
| `online` | `{}` | presence |
| `turn` | `{"val": <mask>}` | switch write; see below |
| `brightness` | `{"val": 0..100}` | H5086 / night light |
| `status` | `{}` | request snapshot |
| `colorwc` | `{"red","green","blue"}` | night light color (H5089) |
| `ptReal` | `{"command":["<base64>"]}` | tunnel a 20-byte BLE frame |
| `ptIot` | `{"command":["<base64>"]}` | OTA pact report path (H5089) |

`CmdTurn` bit encoding (per socket `order`):
```
order 0 -> 0x10 | (on?1:0)
order 1 -> 0x20 | (on?2:0)
order 2 -> 0x40 | (on?4:0)
else    -> 0xF0 | (on?0x0F:0)
```
`CmdTurn` serializes `val`.

`CmdPtReal` base64-encodes a controller’s 20-byte `getValue()` (or a list of frames)
and exposes `getOpCommandBytes()` / `getOpCommandByte()` (cmdType = `bytes[1]`).
`ResultPt` base64-decodes incoming `op.command[]` into 20-byte frames.

`CmdStatusV0/V3/V4` parse:
- `state.onOff` bit 0 = socket 0, bit 1 = socket 1, bit 2 = night light (H5089 V4).
- `op.command[]` frames: cmdType `0xB0` → delay, `0xB4` → V1 timers, `0x12` →
  timer count, `0x13` → V2 timer pages.
- H5089 `CmdStatus4H5089` additionally parses `0x1F` child lock, `0x1B` night-light
  switch/mode, `0x16` DND, `0x28/0x29` night-light sleep/wake, `0x13` timers.

`h5086/iot/CmdStatus` additionally parses `op` frames for `0x19` electric,
`0x1A` time monitor, `0x27` power warning, `0x13` timers, chart frames (`0xAC`).

### 5.3 Status schema

H5080-family:
```json
{"state":{"onOff":3,"brightness":0,"mode":0}}
```
`onOff` bitmask is the authoritative socket state (H5089 uses 3 bits).
Timers are delivered inside `op` frames, not in `state`.

H5086 (`ReadInfo` / `TimeMonitorInfo` / `PowerWarningInfo` / `ElectricData`):
```json
"state": {"onOff": 1},
"op": {"command": ["<base64 20-byte frames>"]}
```
`op` frames decode to:
- `ReadInfo`: `switch`, `childLock`, `hourOn/minOn/remainSecOn`,
  `hourOff/minOff/remainSecOff`, `softVersion`, `hardVersion`,
  `electricData{runtime, electricUse, volts, amps, activePower}`, `lightInfo`.
- `TimeMonitorInfo`: `{id,state,hour,minute,remainSeconds,electUse}`.
- `PowerWarningInfo`: `{warningOpen,warningValue,warningIsSet,offOpen,offValue,offIsSet}`.
- Timers/chart as in §3.4.

### 5.4 REST (H5086)

`h5086/network/ApiService.java`:
- `POST /bff-app/electric-detect/v1/start` (`MonitorStartRequestInfo{sku,device,duration,operateName}`)
- `POST /bff-app/electric-detect/v1/end`
- `POST /bff-app/electric-detect/v1/list`
- `POST /bff-app/v1/device/series-datas` (chart upload)
- `GET /bff-app/v1/device/data-links`, `POST /bff-app/v1/device/data-tasks`
- `POST /bff-app/v1/device/data-export`, `DELETE /bff-app/v1/device/data-clear`
- `POST device/rest/devices/v1/bind`

H5080: `h5080/net/IH5080Net`, `IH5080NetKt`, `RequestSetting/ResponseSetting`
(device settings query/save, used by H5083/H5089 setting pages).

---

## 6. Other protocols

- **Matter**: H5085 and H5089 support Matter commissioning through
  `h5080/H5085MatterHelper.java` (MatterInterceptor, goodsType 43 / 307,
  version gates for H5085 `1.00.20` + `3.01.00`; H5083 and H5089 accepted).
  No Matter cluster/attribute mapping is in this split; commands still use BLE/IoT.
- **BLE broadcast / pairing**: `h5080/add/BleBroadcastProcessor.java`,
  `h5086/add/BleBroadcastProcessor.java` only select the SKU/protocol and open
  `ConnectDialog`; no advertisement payload is parsed here.
- **OTA**: `ReportOtaPactController` sent via `CmdPtReal` (H5080/H5089) or
  `CmdPtIot` (H5089); the frame is
  `0x33/0xAB?` style `{-85, 2, pactTypeLo, pactTypeHi, pactCode}` (see
  `H5089OpManager.writeOtaInfo`).
- **Widgets**: `pact/WidgetBleIotOpSubV2.java` registers goods types 43/50/90/307
  for quick switch ops.

---

## 7. Dynamic effects / night light (H5089)

Only H5089 has an RGB night light. It uses `base_h71xx` light protocol:

- controller `LightRgbController` → cmdType `BleProtocolConstants.b0()` = **27 (0x1B)**.
- payload begins with `LightSubCmd` = `5`, then a sub-mode byte.
- sub-mode constants (`LightSubMode`, defaults in `BleProtocolConstants`):
  `COLOR=13 (0x0D)`, `SCENE=19 (0x13)`, `DIY=10 (0x0A)`, `DEFAULT=252 (0xFC)`.
  These are mutable static fields (`W1/X1/Y1/a2` setters); the plugnew module does
  not change them, so the defaults above apply.

| mode | payload | layout |
|---|---|---|
| color | `05 0D R G B brHi brLo` | RGB = 24-bit big-endian color, `br` = 16-bit BE brightness/Kelvin |
| scene | `05 13 00 sceneId` | scene id byte |
| DIY | `05 0A 00 00` | DIY mode (effect is stored on device) |
| default | `05 FC` | default/white |

Notifications mirror the same layout, parsed by `LightModeInfo.parseBytes(valid,1)`
(sub-mode at `valid[1]`, color at `[2..4]` + `[5..6]`, scene id at `[3]`).
`H5089OpManager` writes colors through `LightRgbController` locally or through
`CmdPtReal(LightRgbController)` over IoT; DIY multi-packet uses
`CmdMultiSync(MultipleBleBytes.getMultipleWriteBytesV1(DiyMultipleControl))`.

H5089 night-light timers (`0x28` sleep / `0x29` wake) carry
`startBri/endBri`, `closeTime/curTime` (minutes, capped 240), `defaultLight`,
RGB and 16-bit color temperature.

---

## 8. Source map

| area | paths |
|---|---|
| registry / SKUs | `h5080/pact/{Support,SubLib,SubLib4Plug2,SubMaker,V1BleIotSkuItem,V2BleIotSkuItem,V3BleIotSkuItem,V4BleIotSkuItem,Register4Item}.java`, `h5086/pact/{H5086Support,SubLib,SubMaker,H5086BleIotSkuItem,RegisterItem}.java` |
| BLE comm | `h5080/ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleConstants}.java`, `h5086/ble/{BleComm,BleMultiComm,BleNotifyComm,BleNotifyChartComm,AbsBleWithChartDataComm}.java` |
| controllers | `h5080/ble/controller/*.java`, `h5080/ble/controller/h5089/*.java`, `h5086/ble/controller/*.java`, `h5086/ble/chartcontroller/*.java` |
| scene builders | `h5080/scenes/{AbsBleCmdBuilder,AbsIotCmdBuilderV1,BleSwitchCmdBuilder,IotSwitchCmdBuilderV1}.java` |
| IoT | `h5080/iot/{Cmd,CmdTurn,CmdPtReal,CmdStatus,CmdStatusV0,CmdStatusV3,CmdStatusV4,ResultPt}.java`, `h5086/iot/{CmdStatus,State}.java` |
| detail ops | `h5080/adjust/v1/*`, `v2/*`, `v3/*`, `v4_h5160/*`, `h5089/*`, `h5086/adjust/*` |
| REST | `h5080/net/*`, `h5086/network/*` |
| Matter | `h5080/H5085MatterHelper.java` |

---

## 9. Gaps / unknowns

- H5080/H5083/H5085/H5082/H5160/H5161 `CmdStatusV0/V3` parse `state.onOff` as a
  bitmask but the socket→bit mapping is only explicit for H5089 (`CmdStatusV4`).
  For 1/2/3-gang SKUs the same convention (bit n = socket n) is used by
  `Model`/`Model4Plug2` (`onOff & 1`, `onOff & 2`), but H5161 may use a different
  order in the cloud; not verified.
- `CmdStatus` for H5086 has a JADX-failed body; the exact JSON keys beyond
  `state.onOff` and `op.command` are inferred from `ReadInfo`, `TimeMonitorInfo`,
  `PowerWarningInfo` and `ElectricData`. Treat unknown keys as runtime.
- `BleProtocolConstants` light sub-mode values are mutable statics. The module does
  not mutate them, but another split loaded in the same process could, so the
  `13/19/10/252` values are “observed defaults”, not immutable spec.
- H5089 `getPlugNum(307)` returns 2 while the timer/status structures carry 3
  groups; group 2 is the night light (confirmed by `SubBleIotInfo.getNightLightName`
  and `CmdStatus4H5089`), but the naming is misleading.
- The H5086 chart frame layout is derived from `AbsBleWithChartDataComm.K()`
  (5 slots of 3 bytes, first 2 bytes = hour index). The meaning of the per-slot
  first byte (runtime minutes) is inferred from `H5086ChartTable` usage; verify
  against a device capture.
- H5086 `TimeMonitorInfo.electUse` is not scaled in the parser; the UI applies its
  own divisor. The raw unit is therefore runtime/data-dependent.
- No Matter cluster/attribute mapping is present; Matter commissioning is delegated
  to the base `com.govee.matter` module.


---

<!-- split_pact_plugv1 -->

# split_pact_plugv1 — legacy WiFi plugs / switches (H5001, H5081, H7014)

Source root: `decompiled/jadx-splits/split_pact_plugv1/sources/`

---

## 1. Overview / family and SKUs

Two independent IoT-only sub-families live in this module. There is **no BLE GATT
control path**; both use the cloud (`iot`) as their command transport, and both use
the legacy AP (hotspot) provisioning flow for Wi-Fi onboarding.

### 1.1 `plugv1` generic — H5001 / H5081

Registry: `plugv1/pact/Support.java`
- goodsType **4** → **H5081** (Smart Plug), pact `beProtocol(4,1)`
- goodsType **26** → **H5001** (Smart Switch), pact `beProtocol(1,1)`

SKU variants (regional suffixes on the add screen):
`Support.a="101"` (US), `b="201"` (UK), `c="301"` (EU/ER). `Support.d="H5081"`,
`e="H5001"`.
- AP SSID: `Govee_plug_<sku>` for H5081, `Govee_Switch_<sku>` for H5001
  (`Support.getHotAp`), AP IP `192.168.1.1`, config timeout `7200`.
- `SubMaker` registers `IotSkuItemV1` (goodsType 4) and `IotSkuItemV2` (goodsType 26).
- Model `plugv1/pact/Model.java` extends `AbsDeviceModel4Iot`; item is
  `AbsItem30IotItem`. `needBle()` returns false (`pact/AbsIotSkuItem.java`).

### 1.2 H7014 — single-socket WiFi plug

`h7014/` is a self-contained old IoT plug:
- `Sku.a="H7014"`, `Sku.b/c = {H7014}`, AP SSID `Govee_plug`, AP IP `192.168.1.1`,
  config timeout `7200`, WiFi input limit 31/31.
- `h7014/sku/DeviceItem.java` extends `AbsItem30IotItem`;
  `h7014/iot/IotManager.java` extends `AbsIotManagerV0` (V0 envelope).
- `SkuH7014` is an `AbsSkuItem`; no BLE service/characteristic anywhere in the split.

Transports: **`iot` (cloud/WiFi)** for both. Provisioning is Wi-Fi AP / HTTP, not BLE.
No `ble+iot`, no local LAN/MQTT or Matter code in this split.

---

## 2. Transports & GATT UUIDs

None. There is no `BleComm`/`BleProtocol` in `split_pact_plugv1`.

| transport | detail |
|---|---|
| provisioning | device hotspot `Govee_plug_<sku>` / `Govee_Switch_<sku>` (`Govee_plug` for H7014), AP `192.168.1.1`, HTTP config (`add/ApComm`, `ApDeviceInfo`, `ApWifiInfo`) |
| control | Govee IoT cloud JSON (V0 for H7014 / V2 for H5001/H5081 scenes) |
| local LAN | none found |

`plugv1/add/PairAc.java` (goodsType 4) and `PairAcV1.java` (goodsType 26) implement
the AP hand-off.

---

## 3. BLE frame + command table

Not applicable — no BLE frames. The equivalent “command table” is the IoT JSON set
in §5.

---

## 4. BLE notifications / readings

Not applicable. Device state arrives only as IoT `status` / `online` replies.

---

## 5. IoT commands + status/readings schema

### 5.1 `plugv1` (H5001 / H5081)

`plugv1/iot/Cmd.java` command names:
`state`, `config`, `turn`, `delay`, `status`, `online`, `timer`, `nightMode`.
`getCmdReadParseKey` maps `timer`/`delay` → `config`, otherwise `state`.

| cmd | data fields | meaning | source |
|---|---|---|---|
| `turn` | `{"val":0|1}` | socket on/off | `CmdTurn.java` |
| `status` | `{}` | request snapshot (`state` + `config`) | `CmdStatusV0/V1` |
| `timer` | `{group,enable,type,hour,minute,repeat,timeOffset,timeOffsetMinute,timeStamp}` | write one weekly timer (V1 4-byte record semantics) | `CmdTimer.java` |
| `delay` / `delayClose` | `{enable,minutes,leftMinutes}` | delayed off | `CmdDelayClose.java` |
| `nightMode` | `{"val":0|1}` | night-mode switch (V2/H5001 only) | `CmdNightMode.java` |
| `state` | `{onOff, nightMode}` | read-back | `CmdStatusV0.State`, `CmdStatusV1.State` |
| `config` | `{delay:{enable,minutes,leftMinutes}, timer:[NewTimerV1…]}` | timers + delay | `CmdStatusV0.Config` |

`CmdStatusV0` is used for goodsType 4 (H5081); `CmdStatusV1` adds `nightMode` for
goodsType 26 (H5001) — `plugv1/adjust/v2/IotOpV2.java`.
`CmdTimer` fields: `group`, `enable`, `type`, `hour`, `minute`, `repeat` (byte),
`timeOffset` (hours), `timeOffsetMinute`, `timeStamp` (epoch seconds), all sent as
JSON ints.

### 5.2 H7014

`h7014/iot/Cmd.java`: `turn`, `status`, `timer`, `delayClose`.
`IotManager extends AbsIotManagerV0` → **V0 incoming envelope**; it parses the whole
`data` object through `CmdStatusV0.parseJson`.

| cmd | data | meaning | source |
|---|---|---|---|
| `turn` | `{"val":0|1}` | on/off | `CmdTurn.java` |
| `status` | `{}` | snapshot | `CmdStatusV0.java` |
| `timer` | `{enable, time:[{openHour,openMin,closeHour,closeMin}], timeOffset, timeOffsetMinute}` | one on/off window (single `time[0]` used) | `CmdTimer.java` |
| `delayClose` | `{enable,minutes,leftMinutes}` | delayed off | `CmdDelayClose.java` |

`CmdStatusV0.Status`: `{turn, softversion, delayClose:{enable,minutes,leftMinutes},
timer:{enable,time:[{openHour,openMin,closeHour,closeMin}]}}`.
`open` is `turn==1`; `timerInfo` takes only `time[0]`.
Events: `EventSetNightMode`, `ResultEventNightMode` (night-mode UI sync).

### 5.3 Status schema (unified)

```json
{
  "state": {"onOff": 0, "nightMode": 0},
  "config": {
    "delay": {"enable": 0, "minutes": 30, "leftMinutes": 12},
    "timer": [{"enable":1,"type":0,"hour":7,"minute":30,"repeat":127}]
  }
}
```
H7014 instead:
```json
{"turn":1,"softversion":"1.00.00",
 "delayClose":{"enable":0,"minutes":0,"leftMinutes":0},
 "timer":{"enable":1,"time":[{"openHour":7,"openMin":0,"closeHour":23,"closeMin":0}]}}
```

### 5.4 Scenes

Both families expose an IoT scene builder:
- `plugv1/scenes/IotSwitchCmdBuilderV1.java` — `CmdTurn`, goodsTypes `{4,26}`,
  replies parsed as `IotMsgV2`, success when `cmd=="status"`.
- `h7014/scenes/SwitchCmdBuilder.java` — `CmdTurn`, SKU `{H7014}`, replies parsed as
  `IotMsg` (V0), success when `cmd=="status"`.
- `SmartRoomOp` returns `supportBle()==false`, `supportWifi()==true`.

---

## 6. Other protocols

- **AP provisioning**: `plugv1/add/ApComm*.java`, `ApDeviceInfo`, `ApWifiInfo`,
  `h7014/add/ApComm.java`; hotspot/IP/timeout constants in `Support`/`Sku`.
- **REST**: no dedicated service in this split; bind is done by the shared
  `device/rest/devices/v1/bind` path (`AddInfo`/`BindExt`).
- **No BLE, no Matter, no MQTT/LAN** in this split.

---

## 7. Dynamic effects / scenes / DIY

No light effects. “Scenes” are simply switch actions
(`IotSwitchCmdBuilderV1`, `h7014/scenes/SwitchCmdBuilder`). Night mode is a boolean
H5001-only feature (`CmdNightMode`, `ResultNightMode`).

---

## 8. Source map

| area | paths |
|---|---|
| registry/SKU | `plugv1/pact/{Support,SubLib,SubMaker,IotSkuItemV1,IotSkuItemV2,AbsIotSkuItem,Model,DeviceItem}.java`, `h7014/sku/{Sku,SkuH7014,SubLib,SubMaker,DeviceItem}.java` |
| IoT | `plugv1/iot/*.java`, `h7014/iot/*.java` |
| adjust | `plugv1/adjust/{AdjustAc,AdjustAcV2}.java`, `plugv1/adjust/v1/*`, `v2/*` |
| scenes | `plugv1/scenes/*`, `h7014/scenes/*` |
| provisioning | `plugv1/add/*`, `h7014/add/*` |

---

## 9. Gaps / unknowns

- The exact AP HTTP endpoints/paths used during provisioning are not visible in the
  decompiled `ApComm` classes (they delegate to a base HTTP helper); only the AP SSID,
  IP `192.168.1.1` and timeout are in this split.
- H5001 and H5081 share one `CmdStatus` parser family, but the cloud may add keys
  (`nightMode`, regional variants) not present in the model; unknown keys are ignored.
- `CmdTimer.repeat` is a raw byte in the model; the bit→weekday mapping lives in the
  shared `NewTimerV1`/`TimerInfo` base and is not redefined here.
- H7014 only uses `time[0]` of the timer array; additional windows are ignored by
  design (single-window device).


---

<!-- split_pact_rgbiclight -->

# split_pact_rgbiclight — RGBIC lighting protocol extract

Source root: `decompiled/jadx-splits/split_pact_rgbiclight/sources`
Base helpers: `decompiled/jadx-base-7.7.10/sources`

This split contains **15 sub-families / SKU groups** of Govee RGBIC products: light
strips, "dream color" strips, neon/bare-light strings, chassis/underglow lights and
the shared RGBIC scene/DIY/music engine. Many SKUs are only *registered* here while
their low-level controller lives in `base2light`; the per-family opcode sets, sub-mode
IDs and payload shapes are documented below.

---

## 1. Overview / families

| Sub-family (package) | SKUs | Goods types | Transports | Protocol shape |
|---|---|---|---|---|
| `com.govee.h6102` | H6102 | 17/18 style BLE | `ble` | mode 0x05; sub 0x02 color, 0x01 music, 0x04 scene, 0x0A DIY; limit 0x0E |
| `com.govee.h6105` | H6105 | 17/18 style BLE | `ble` | same as H6102 but music sub 0x03 |
| `com.govee.h6119` | H6119 | 17/18/70/73 (BLE profile) | `ble` | sub 0x02, 0x0B color V1, 0x15 color V2, 0x0C music, 0x04 scene, 0x0A DIY; gradual 0x14; bulb-string read 0xA5 |
| `com.govee.h612526` | H6125, H6126 | 19/71 style (BLE profile) | `ble` | sub 0x0B color (15-seg), 0x0C music, 0x04 scene, 0x0A DIY; gradual 0x14 |
| `com.govee.h6127` | H6127, H6116, H6107, H6161 | 17/18 style BLE | `ble` | sub 0x02, 0x01 music, 0x03 music V1, 0x04 scene, 0x07 old DIY, 0x0A new DIY |
| `com.govee.h6129` | H6129 | 17/18 style BLE | `ble` | sub 0x02, 0x03 music, 0x04 scene, 0x07 old DIY, 0x0A new DIY |
| `com.govee.h6185` | H6185 | 17/18 style BLE | `ble` | sub 0x02, 0x05 mic, 0x04 scene, 0x0A DIY |
| `com.govee.rgbiclight.h6160` | H6163, H6117 | 21 | `ble+iot` | sub 0x02, 0x0B color V1, 0x0D color4bk, 0x15 color V2, 0x01 music V1, 0x03 music, 0x0E music V1 RGB, 0x04 scene (LE16), 0x0A DIY; IoT incl. `ptReal` |
| `com.govee.barelightv1` | H6145, H6146, H6147, H6171 | 13 | `ble` | sub 0x0B color, 0x15 color V2, 0x0C music, 0x13 new music, 0x04 scene, 0x0A DIY; gradual 0x14 |
| `com.govee.chassislightv1` | H6184, H7092 | 11, 162 | `ble` | sub 0x02, 0x15 color V2 (7/8 seg), 0x05 mic, 0x13 mic V2, 0x04 scene, 0x0A DIY |
| `com.govee.h7090` | H7090, H7095 (+H7092/H6119 refs) | 44, 127, 162 | `ble` | sub 0x15 color V2 (6/8 seg), 0x13 music, 0x04 scene, 0x0A DIY; light-pos 0x31, LR switch 0x33, compose heart 0x33 |
| `com.govee.dreamcolorlightv1` | large H61xx/H70Ax set (see §2) | 17,18,70,73 (ble) + 19,71,74,75,83,262,123,175,176,193,187,178,136,204,207,234 (ble+iot) | `ble` / `ble+iot` | shared dream-color BLE opcodes; IoT `state`/`op` + `ptReal`/`pt`/`bulb` |
| `com.govee.dreamcolorlightv2` | H6143, H6144, H611A | 21 (+ble+iot) | `ble` / `ble+iot` | dream-color V2 BLE; IoT `ptReal` only |
| `com.govee.rgbiclight` (shared) | H6671, H6672, H61C2, H61C3, H61C5 | 332/352/141 | `ble+iot` | new-detail RGBIC engine; `IotMsgProType.V2`, `ptReal` |
| `com.govee.rgbiclight.h667172` | H6671, H6672 | 332 | `ble+iot` | UI/cut-calibration only (44/56 IC layout); uses shared engine |
| `com.govee.rgbiclight.neonlight` | neon shape SKUs (H61A9 family) | — | `ble+iot` | scene "install" effect through shared engine |

A `pact` type/code is not exposed as a single constant for these SKUs; protocol
selection is by **goodsType** plus `Protocol(type, code)` pairs registered in
`pact()` (e.g. `GoodsType.beProtocol(1,1)`, `(1,2)`, `(2,1)`, `(10,1)`, `(10,2)`).

---

## 2. SKU universe in this split

### 2.1 Locally registered SKUs

`h6102`: **H6102**
`h6105`: **H6105**
`h6119`: **H6119**
`h612526`: **H6125, H6126**
`h6127`: **H6127, H6116, H6107, H6161**
`h6129`: **H6129**
`h6185`: **H6185**
`rgbiclight.h6160`: **H6163, H6117**
`barelightv1` (goodsType 13): **H6145, H6146, H6147, H6171**
`chassislightv1` (goodsType 11, 162): **H6184, H7092**
`h7090` (goodsType 44, 127): **H7090, H7095**
`h667172`: **H6671, H6672**
`rgbiclight` SupportV2: **H6671, H6672** (332), **H61C2, H61C3, H61C5**

### 2.2 Dream-color SKU/constant table (`dreamcolorlightv1/pact/Support.java`)

The class exposes a long list of SKU string constants used by the shared RGBIC engine:

`H6102, H6127, H6161, H6116, H6125, H6126, H6163, H6117, H6145, H6146, H6147,
H6171, H6123, H614C, H611B, H611Z, H617A, H617B, H617C, H618A, H618B, H618C,
H619A, H619B, H619C, H619D, H619E, H61A5, H619Z, H6172, H6173, H618F, H617E,
H617F, H61A0, H61A1, H61A2, H61A3, H61B2, H61E1, H61E0, H616C, H61B1, H61BC,
H616D, H61BE, H61BA, H616E, H61B5, H80B5, H6168, H61A8, H61A9, H70A1, H70A2,
H70A3, H6176, H6175, H612A, H612B, H612C, H612D, H612E, H612F, H6086, H6089`

`dreamcolorlightv2/pact/Support.java` adds **H6143, H6144, H611A** (goodsType 21
profile). `h61050729/BleProtocol.java` is a dated H6105 protocol revision
(sub 0x15 color / 0x04 scene / 0x0A DIY / 0x03 music).

### 2.3 GoodsType → transport rule

`dreamcolorlightv1/pact/Support.java`:

- BLE list `Q0 = {17, 18, 70, 73}` (SubLib keys are these strings) → `ble`
- BLE+IoT list `f0 = {19, 71, 74, 75, 83, 262, 123, 175, 176, 193, 187, 178, 136, 204, 207, 234}` → `ble+iot`
- `SubMaker` registers 8 `AbsBleIotSkuItem` for goodsType 176, 193, 187, 178, 175, 204, 207, 234 plus V1–V7 items for 19/71/74/75/83/262/123.

`dreamcolorlightv2`: `g = {21}` → `ble`; H6143/H6144 additionally get BLE+IoT
(`Support4DreamColorLightV2.b/c` use `{Protocol(1,1),Protocol(1,2)}` and `{Protocol(2,1)}`).

`chassislightv1`: `g = {11, 162}`; 11 → `GoodsType.beProtocol(1,1)` and `(10,1)`,
162 (H7092) → `(1,1)`.

`h7090`: 44 (H7090) → `(10,1)`+`(10,2)`; 127 (H7095) → `(1,1)`.

`barelightv1`: 13 → `(1,1)` + `(1,2)`.

`rgbiclight` SupportV2: 332 (H6671/H6672) → `(1,1)`+`(2,1)`; 352 → `(1,1)`+`(1,2)`;
141 (H61C2/C3/C5) → `(1,1)`+`(2,1)`.

---

## 3. Transports & GATT UUIDs

Every family in this split uses the same vendor GATT pair:

- Service: `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic: `00010203-0405-0607-0809-0a0b0c0d2b11`

Confirmed in:
`h6102/ble/BleComm.java` + `MultipleBleComm.java`, `h6105`, `h6119`, `h612526`,
`h6127`, `h6129`, `h6185`, `barelightv1/ble/BleComm.java`,
`chassislightv1/ble/BleComm.java`, `h7090/ble/BleComm.java` (`Q`/`V`),
`rgbiclight/ble/BleComm.java` + `BleMultiComm.java`,
`rgbiclight/h6160/ble/BleComm.java`.

Notify characteristics are the same characteristic. `rgbiclight/ble/BleNotifyComm`
parses notifications with `WifiNotifyParse` (IoT-style packets over BLE for
ble+iot devices).

**IoT transport** is the cloud/MQTT path implemented in base `Iot`/`Write`
(transaction + account topic). `ptReal` tunnels 20-byte BLE frames as base64, so the
BLE tables in §4 apply verbatim to `ble+iot` SKUs.

---

## 4. BLE frame + command table

### 4.1 Frame

`com.govee.base2kt.utils.BleUtils.generate20Bytes(proType, cmdType, payload)`
(`BleUtils.Companion.p()`):

| offset | meaning |
|---|---|
| 0 | proType: `0x33` write, `0xAA` read, `0xA3` multi write V1, `0xA5` multi write, `0xEE` notify/OTA-prepare |
| 1 | cmdType / opcode |
| 2..18 | payload (17 bytes max, zero padded) |
| 19 | BCC = XOR of bytes 0..18 |

Read response stripping (`AbsSingleController.m()`): read (`0xAA`) → `value[2..18]`
(17 bytes); write (`0x33`) → `value[3..18]` (16 bytes).

Multi-packet (`AbsMultipleController`, proType `0xA3`/`0xA5`,
`MultipleControllerComm.makeWriteMultipleBytes`, `MultipleControllerCommV1`):

- start packet: `[0]=proType [1]=cmdType [2]=0 [3]=packCount [4]=controller.p() ... [19]=BCC`
- data packets: `[0]=proType [1]=cmdType [2]=index(1..N) [3..18]=16-byte chunk [19]=BCC`
- end packet: `[0]=proType [1]=cmdType [2]=0xFF [19]=BCC`
- V1 (`makeSendBytesV0`): start `[2]=0 [3]=packCount+2 [4]=cmdType`, data `[1]=index`,
  17-byte chunks, end `[1]=0xFF`.
- `makeSendBytesV2`: start `[2]=1 [3]=packCount [4..]=commBytes`, chunks of 17, end `[1]=0xFF`.

Responses to multi-read use `[2]=0` (start, `[3]`=packLen), `[2]=index`, `[2]=0xFF` (end).

### 4.2 Universal controllers (base `base2light.ble.controller`)

| Opcode | Controller | Write payload | Read/notify layout |
|---|---|---|---|
| `0x33/0x01` | `SwitchController` | `[0]=on/off` | `0xAA/0x01` → `[0]` state |
| `0xAA/0x01` | `HeartController` (read only) | — | `[0]` heartbeat state |
| `0x33/0x04` | `BrightnessController` | `[0]=brightness 0..254` | `0xAA/0x04` → `[0]` brightness |
| `0x33/0x05` | family `ModeController` (`AbsModeController`) | `subMode.getWriteBytes()` | `0xAA/0x05` → `[0]=subMode`, `[1..]=sub payload` |
| `0x33/0x02` | `MultipleDiyController` (multi) | DIY protocol bytes (cmd 0x02) | — |
| `0x33/0x03` | `MultipleDiyControllerV1` / graffiti | DIY bytes | — |
| `0x33/0x57` | `MultiDiyGraffitiControllerV3` | graffiti DIY blob | — |
| `0xA3/0x41` | `MultipleController4Music` | music/effect blob, `p()`=sensitivity | — |
| `0x33/0x40` | `MultipleColorStripControllerV1` | per-segment color blob | — |
| `0x33/0x11` | `SleepController(V2)` | `[0..3]` sleep params | `[0..3]` |
| `0x33/0x12` | `WakeUpController(V2)` | `[0..3]` wake params | `[0..3]` |
| `0x33/0x19` | timer/pre-set | timer struct | timer struct |
| `0x33/0x39` | `CheckDirectionFinishController` | direction check | `[0]` |
| `0x33/0x14` | family `GradualController` / `Gradual4BleWifiController` | `[0]=0/1` (gradient on/off) | `[0]` |
| `0xEE` | OTA prepare | family specific | — |

Brightness percent → raw conversion: `NumUtil.calculateProgress(max,min,pct)` =
`min + (pct-1)*((max-min+3)/100)`. BLE ranges are `{20,254}` by default, `{6,254}` for
"old dream color min brightness" devices (`dreamcolorlightv1/Support.getBrightnessRange`).

### 4.3 Family opcode/sub-mode constants

#### h6102 / h6105 (`h6102/ble/BleProtocol.java`, `h6105/...`)

```
sub_mode_music     0x01 (h6102) / 0x03 (h6105)
sub_mode_color     0x02
sub_mode_scenes    0x04
sub_mode_new_diy   0x0A
SINGLE_LIMIT       0x0E   (LimitController)
```
Scene IDs (`value_sub_mode_scenes_*`): gm 0, sunset 1, film 4, dating 5, romantic 7,
blinking 8, cl(candle) 9, snow 15.
Music sub-modes h6102: energic 0, spectrum 1, rolling 2, rhythm 3.
`LimitController`: cmd `0x0E`, payload `[0]=limitFlag`, read result `[0]==1`.

#### h6119 (`h6119/ble/BleProtocol.java`)

```
sub_mode_color      0x02
sub_mode_color_v2   0x15
sub_mode_music      0x0C
sub_mode_scenes     0x04
sub_mode_new_diy    0x0A
SINGLE_GRADUAL_CHANGE_4_BLE 0x14
```
Scene IDs: blinking 8, breath 10, chase 21, cl 9, date 5, dynamic 16, romantic 7,
stream 22. Music styles: energy 0, rhythm 1 (sub power 0 / soft 1), scroll 2.

#### h612526 (`h612526/ble/BleProtocol.java`)

```
sub_mode_color      0x0B  (15 segments)
sub_mode_music      0x0C
sub_mode_scenes     0x04
sub_mode_new_diy    0x0A
SINGLE_GRADUAL_CHANGE 0x14
SINGLE_LIGHT_NUM    15
MSG_TYPE_READ_BULB_COLOR 0xA2
```
Scene IDs: movie 4, date 5, romantic 7, blinking 8, cl 9, breath 10, snow 15,
dynamic 16, chase 21, stream 22. Music: energy 0, scroll 2, spectrum 3, rhythm 4.

#### h6127 (`h6127/ble/BleProtocol.java`)

```
sub_mode_music         0x01
sub_mode_color         0x02
sub_mode_music_no_ic   0x03
sub_mode_scenes        0x04
sub_mode_old_diy       0x07
sub_mode_new_diy       0x0A
```
Scene IDs: gm 0, sunset 1, film 4, dating 5, romantic 7, blinking 8, cl 9, snow 15.
Music: energic 0, spectrum 1, rolling 2, rhythm 3.

#### h6129 (`h6129/ble/BleProtocol.java`)

```
sub_mode_color      0x02
sub_mode_music      0x03
sub_mode_scenes     0x04
sub_mode_old_diy    0x07
sub_mode_new_diy    0x0A
```
Scene IDs: gm 0, sunset 1, film 4, dating 5, romantic 7, blinking 8, cl 9, snow 15.

#### h6185 (`h6185/ble/BleProtocol.java`)

```
sub_mode_color      0x02
sub_mode_scenes     0x04
sub_mode_mic        0x05
sub_mode_new_diy    0x0A
```
Mic sub-ops: set mode 1, send rhythm point 3.
Scene IDs: film 4, date 5, romantic 7, blinking 8, cl 9, breath 10, dynamic 16.

#### h6160 — H6163/H6117 (`rgbiclight/h6160/ble/BleProtocol.java`)

```
MSG_TYPE_READ_BULB_COLOR            0xA2
SINGLE_GRADUAL_CHANGE_4_WIFI_BLE    0xA3
sub_mode_music_v1       0x01
sub_mode_color          0x02
sub_mode_music          0x03
sub_mode_scenes         0x04
sub_mode_new_diy        0x0A
sub_mode_color_v1       0x0B
sub_mode_color_4_bk     0x0D
sub_mode_music_v1_rgb   0x0E
```
Music styles: energic 0, spectrum 1, rolling 2, rhythm 3; V1 power 0 / soft 1.
Scene IDs as h6102 (gm 0, sunset 1, film 4, dating 5, romantic 7, blinking 8, cl 9, snow 15).

#### barelightv1 — H6145/H6146/H6147/H6171 (`barelightv1/ble/BleProtocol.java`)

```
sub_mode_scenes      0x04
sub_mode_new_diy     0x0A
sub_mode_color       0x0B
sub_mode_music       0x0C
sub_mode_new_music   0x13  (19)
sub_mode_color_v2    0x15
SINGLE_GRADUAL_CHANGE           0x14
SINGLE_GRADUAL_CHANGE_4_WIFI_BLE 0xA3
SINGLE_OTA_PREPARE              0xEE
MSG_TYPE_READ_BULB_COLOR        0xA2
SINGLE_LIGHT_NUM                15
```
Scene IDs: gm 0, sunset 1, movie 4, date 5, romantic 7, blinking 8, cl 9, breath 10,
dynamic 16, chase 21, stream 22, snow 15.
Music: energy 0, rhythm 5, scroll 2, spectrum 3. New music: energy 5, rhythm 3
(sub power 0 / soft 1), scroll 6, spectrum 4.

#### chassislightv1 — H6184/H7092 (`chassislightv1/ble/BleProtocol.java`)

```
sub_mode_color      0x02
sub_mode_mic        0x05
sub_mode_scenes     0x04
sub_mode_new_diy    0x0A
sub_mode_mic_new    0x13  (19)
sub_mode_color_v2   0x15
SINGLE_GRADUAL_CHANGE_4_BLE     0x14
SINGLE_GRADUAL_CHANGE_4_WIFI_BLE 0xA3
```
Mic sub-ops: set mode 1, send rhythm point 3.
Scene IDs: movie 4, date 5, romantic 7, blinking 8, cl 9, breath 10, snow 15,
dynamic 16, chase 21, stream 22.

#### h7090 — H7090/H7095 (`h7090/ble/BleProtocol.java`)

```
SINGLE_LIGHT_POS                 0x31
SINGLE_LR_SWITCH                 0x33
SINGLE_GRADUAL_CHANGE_4_BLE      0xA3
SINGLE_OTA_PREPARE               0xEE
sub_mode_scenes                  0x04
sub_mode_new_diy                 0x0A
sub_mode_music                   0x13  (19)
sub_mode_color                   0x15  (V2 profile)
value_compose_light_switch       0x36
```
Music styles: rhythm 3, spectrum 4, energy 5, scroll 6.

---

## 5. BLE notifications / readings

| Family | Opcode | Layout / meaning | Source |
|---|---|---|---|
| all | `0xAA/0x01` | `[0]` heartbeat state | `HeartController.parseValidBytes` |
| all | `0xAA/0x04` | `[0]` brightness 0..254 | `BrightnessController` |
| all | `0xAA/0x01` write-reply | `[0]` on/off | `SwitchController` |
| all mode | `0xAA/0x05` | `[0]` sub-mode, rest parsed by `SubMode*` | `AbsModeController.parseValidBytes` |
| h6102/h6105 | `0xAA/0x0E` | `[0]==1` limit flag | `LimitController` |
| h6119 | `0xAA/0x0B`(read) | `[0]=count`, then `count` × `R,G,B` (bulb-string groups, 3 bytes each) | `BulbStringColorController` / `BulbGroupColor` |
| h6119 | `0xAA/0x02` | `R G B tempFlag R2 G2 B2` | `SubModeColor.parse` |
| h6119 | `0xAA/0x15` | `[0]` colorV2 type | `SubModeColorV2.parse` |
| h6160 v1 | `0xAA/0xA2` read | `[0]=count`, then `count` × `R,G,B` for 4 bulbs | `h6160/ble/v1/BulbStringColorController` |
| h6160 | `0xAA/0x04` | brightness | `BrightnessController` |
| h6160 | `0xAA/0x05` | sub-mode dispatch (0x01/0x03/0x04/0x0A/0x0B/0x0E) | `h6160/ble/Mode` |
| h612526 | `0xAA/0x0B` | `[0]` color code (read-only echo) | `SubModeColor.parse` |
| h7090 | `0xAA/0x31` | `[0]` light position 0/1 | `LightPosController` |
| h7090 | `0xAA/0x33` | `[0]` LR switch state, `[1]==1` festive/heart flag | `SwitchLRController`, `ComposeHeartController` |
| h7090 | `0xAA/0x03` | compose heart multi-reply | `ComposeHeartController` |

`BleNotifyComm` for RGBIC ble+iot devices additionally routes `WifiNotifyParse`
packets (IoT envelopes over the BLE notify characteristic).

---

## 6. IoT commands + status/readings schema

### 6.1 Envelope

Writes (`com.govee.base2home.iot.Write` / `AbsCmdWrite`):

```json
{"msg":{"transaction":"<generated>","accountTopic":"<topic>","type":1,"origin":32,
        "cmdVersion":<int>,"cmd":"<name>","data":{...}}}
```

Reads (`Read`/`AbsCmdRead`) use `"type":0`. Incoming variants:
- h6160 / rgbiclight-new: `IotMsgProType.V2` (`IotMsgV2` with `cmd`, `transaction`, `status`).
- dreamcolorlightv1: V1/V0 — reads by `state` (status) and `op` (passthrough pt/ptReal).
  `Cmd.getCmdReadParseKey()` returns `"op"` for `pt`/`ptReal`, otherwise `"state"`.
- dreamcolorlightv2: `state`/`op`.

### 6.2 h6160 (H6163/H6117) `iot/Cmd.java`

| cmd | data fields | meaning |
|---|---|---|
| `online` | — | device online event |
| `turn` | `val` 0/1 | power |
| `brightness` | `val` 0..100 (mapped 6..254) | brightness |
| `color` | `red`,`green`,`blue` | RGB |
| `colorTem` | `colorTemInKelvin`, `color{red,green,blue}` | temperature |
| `colorwc` | `color{r,g,b}`, `colorTemInKelvin` | combined color/temp |
| `timer` | `enable`, `timeOffset`, `timeOffsetMinute`, `time[{enable,openHour,openMin,closeHour,closeMin,repeat}]`, `isGroup`, `group` | timer |
| `pt` | `op` (`mode`/`ptReal`), `value[]` base64 20-byte frames | passthrough |
| `ptReal` | `command[]` base64 20-byte frames | BLE-over-cloud |
| `status` | see below | state read |

Status (`CmdStatusV0`):
```
{ softversion, wifiSoftVersion, turn, brightness, mode,
  color{red,green,blue}, colorTemInKelvin,
  timer{enable,time[{openHour,openMin,closeHour,closeMin}]} }
```
`mode==2` is color-temp; the app reconstructs `SubModeColor` from `color` /
`colorTemInKelvin`.

`CmdPt.getDiyPtotocol` / `getDiyStudio` / `getNewScenesCmdPt` build `pt` with
`op="mode"` and base64 multi-packet DIY/scene; `CmdPtReal` builds `ptReal`
`command[]`.

### 6.3 dreamcolorlightv1 `iot/Cmd.java`

`state, op, online, turn, brightness, status, gradual, pt, bulb, colorwc, ptReal`.

| cmd | data |
|---|---|
| `turn` | `val` 0/1 |
| `brightness` | `val` (cmdVersion 1) |
| `gradual` | gradient on/off command |
| `colorwc` | `color{r,g,b}`, `colorTemInKelvin` |
| `bulb` | `value[]` base64 frames (per-bulb / per-segment color + gradual) |
| `pt` | `op` ∈ {`mode`,`gradual`,`sleep`,`wakeup`,`timer`}, `value[]` |
| `ptReal` | `command[]`, `opVersion` |
| `status` | `state{brightness,mode,onOff,wifiHardVersion,wifiSoftVersion}` + `op` payloads |

`CmdStatusV0` parses `state` plus `op` lists:
`modeValue`, `timerValue`, `sleepValue`, `wakeupValue`, segment color sets.
`CmdStatusV1` adds segment/IC parsing (`parseIc`), 4 timers, wake/sleep, brightness.

### 6.4 dreamcolorlightv2

`online, turn, brightness, status, colorwc, ptReal` (`state`/`op` read keys).
No `pt`/`bulb`; scenes/DIY/music go through `ptReal`.

### 6.5 rgbiclight shared engine

`IotSwitchCmdBuilder` / `IotBrightnessCmdBuilder` / `IotColorCmdBuilder` /
`IotColorTemCmdBuilder` use base `CmdTurn`, `CmdBrightness`, `CmdColorWc`,
`CmdStatus` and `IotMsgProType.V2`. `makeCmdStr` wraps the `Cmd` in the Write
envelope. Scene/DIY/music are sent as `ptReal` (base64 BLE frames).

---

## 7. Other protocols

**Matter** — `rgbiclight/MatterRegister.java`. Registered interceptors and gates:

| GoodsType | SKU(s) | Version gate |
|---|---|---|
| 193 | H70A1/H70A2/H70A3 | soft ≥1.00.11 / wifi 3.05.00 / 1.01.17 / 1.04.01; H70A3 needs soft ≥1.00.18 |
| 204 | (204 group) | soft ≥1.00.08 & wifi ≥3.04.01, or wifi ≥3.08.01 |
| 71 | H619D | soft ≥3.04.39, wifi 3.01.10, ≥1.03.01 / 1.04.01 |
| 19 | H61A8 | soft ≥3.08.01 |

Matter uses the standard lighting clusters; no custom cluster IDs are defined in this
split (pairing/attributes handled by base `MatterInterceptor`).

**No MQTT/UDP/LAN protocol** is implemented in this split; cloud transport is the
shared `Iot` MQTT path. `h667172` cut-calibration uses goodsType 332 and 44/56 IC
layouts (H6671=44, H6672=56).

**OTA** — `OtaType` gates: h6119/H6102/H6184 require Telink OTA for new UI
(`rgbiclight/Protocols.java`, `SupportH6119`, `Support4H6184`).

---

## 8. Dynamic effects — explicit payload layouts

All dynamic effects ride `0x33/0x05` (`mode`) as one `subMode` block, except
multi-packet scene/DIY/music blobs (`0xA3`/`0xA5`) followed by a final `0x05` mode
packet that selects the effect.

### 8.1 Color (static / color-temp) — `sub 0x02`

`02 R G B tempFlag R2 G2 B2` (8 bytes)

- `tempFlag=0`: `R G B` is the color, `R2G2B2` background (0,0,0 if unused).
- `tempFlag=1`: color is a temperature; `R2G2B2` is the temperature RGB.
`parse`: `[0..2]` color, `[3]` flag, `[4..6]` temp/background color.
Source: `h6102|h6105|h6119|h6129|h6127|h6185|h6160/ble/SubModeColor.java`.

### 8.2 Color V1 (15-segment strip) — `sub 0x0B`

`0B R G B maskLo maskHi` (8 bytes)

- 15 segment bits: `maskLo` bits 0..7 → segments 1..8, `maskHi` bits 0..6 → 9..15.
- Per-group write: each unique RGB is sent as one packet with its segment mask set,
  then the last packet (or a separate packet) carries per-segment brightness.
Source: `h612526/ble/SubModeColor.java`, `h6160/adjust/v1/SubModeColorV1.java`,
`h6160/ble/SubModeColor.java#h()`.

### 8.3 Color V2 (multi-segment with brightness) — `sub 0x15`

`SubModeColorV2.getWriteBytes()` has three shapes:

1. **Per-group color (type 1)**, 12 bytes:
   `15 01 R G B KLo KHi R2 G2 B2 00 mask`
   - `KLoKHi` = signed 16-bit Kelvin (little-endian, `getSignedBytesFor2(kelvin, true)`).
   - `R2G2B2` = background/temperature color.
   - `mask` = segment bitmask (6 bits h6119/h7090 color, 7 bits chassis, 8 bits h7090 V2).
2. **Brightness-only (type 2)**, 5 bytes: `15 02 brightness 00 mask`
   (`brightness` is the per-segment level, mask selects segments).
3. **Per-segment RGB array (type 3)**, 17 bytes: `15 03 R1 G1 B1 R2 G2 B2 ...`
   (up to 15 segment triples, rest zero).

Grouping helper `makeSubModeColor(Colors)` builds one controller per distinct RGB plus
an optional brightness packet, then `Mode4ColorStrip` sends them in order; the final
packet is flagged `a=true` (multi-controller batch terminator).
Segment counts: h6119 = 6, h612526 = 15, chassis H6184 = 7 / H7092 = 8, h7090 = 6/8,
h6160 v1 = 15.
Source: `h6119/ble/SubModeColorV2.java`, `chassislightv1/ble/SubModeColorV2.java`,
`chassislightv1/adjust/h7092/color/SubModeColorH7092.java`,
`h7090/ble/SubModeColorV2.java`, `h6160/adjust/v1/SubModeColorV1.java`.

### 8.4 Music — `sub 0x01 / 0x03 / 0x0C / 0x0E / 0x13`

Legacy forms (h6102/h6105/h6129/h6127):

- `03 01 sensitivity` (auto/color mode) or
- `03 01 sensitivity R G B` (manual color)
  where `autoFlag` is encoded as `1`=auto (`a()` returns `1` when `c==false`).
- h6102 `sub 0x01`: `01 mode sensitivity [R G B]`, mode ∈ {0 energic, 1 spectrum,
  2 rolling, 3 rhythm}; color included only for modes 1/2.
- h6127 `sub 0x03` same layout (no-IC music path).
- h6105/h6129 `sub 0x03`: `03 autoFlag sensitivity [R G B]`.

h6119/h612526 `sub 0x0C`:

- `0C style sensitivity` for `style==0` (energetic)
- `0C 01 sensitivity sub` for `style==1` (rhythm; sub 0=Dynamic,1=Mild)
- `0C 02 sensitivity autoFlag [R G B]` for scroll/rolling
- h612526 styles: 0 energy, 2 rolling, 3 spectrum, 4 rhythm; for 2/3/4 add
  `autoFlag [R G B]`.

h6160 `sub 0x01` (music V1): `01 style sensitivity [R G B]`; style 1/2 include RGB.
h6160 `sub 0x0E` (music V1 RGB):
`0E style sensitivity autoFlag [R G B]` (4 or 7 bytes), autoFlag `1`=auto.
h7090/barelight/chassis `sub 0x13` (new music):
`13 style sensitivity dyn autoFlag [R G B]` (8 bytes), with `dyn` for rhythm;
`13 style sensitivity` only for energy.
New music codes (RGB list): `{50,51,52,53,54,55}`; RGBIC list `{50..55}`;
`newMusicCode4RgbicList` per `AbsNewMusicEffect`.
Multi-packet high-fidelity music: `MultipleController4Music` → proType `0xA3`,
cmdType `0x41`, `p()` = sensitivity, `g()` = effect blob.
Source: `h6102/ble/SubModeMusic.java`, `h6105`, `h6127/ble/SubModeMusic(V1).java`,
`h6119/ble/SubModeMusic.java`, `h612526/ble/SubModeMusic.java`,
`h6160/ble/SubModeMusic(V1|V1Rgb).java`, `barelightv1/ble/SubModeMusic(V2).java`,
`chassislightv1/ble/SubModeMic(V2).java`, `h7090/ble/SubModeMusic.java`.

### 8.5 Mic (H6185, H6184/H7092) — `sub 0x05 / 0x13`

- `05 01` = select mic/music mode (h6185, chassis `SubModeMic`).
- `13 10` = mic V2 select (chassis `SubModeMicV2`).
- Mic level/rhythm points are pushed by the audio engine through the same sub-mode
  (op 1 = set mode, op 3 = send rhythm point).
Source: `h6185/ble/SubModeMic.java`, `chassislightv1/ble/SubModeMic(V2).java`.

### 8.6 Scenes — `sub 0x04`

- h6102/h6105/h6127/h6129/h6185/h6119/h612526: `04 <effectId>` (1 byte).
  h6160: `04 <effectLo> <effectHi>` (16-bit LE, `getSignedBytesFor2`).
- Scene effect IDs (from `ScenesHint`/`RgbIcScenesV1..V3`):
  gm 0, sunset 1, film/movie 4, date/dating 5, romantic 7, blinking 8,
  candle (`cl`) 9, breath 10, snow 15, dynamic 16, chase 21, stream 22.
  Extended RGBIC scene IDs: forest 212, green-shade 218, universe 200, meteor 205,
  meteor-shower 228, aurora 215, lightning 214, star-sky 217, star-flash 213,
  spring 210, summer 223, fall 202, winter 201, fire 216, ripple 204, waves 227,
  deep-sea 203, new-year 222, christmas 221, halloween 110, valentine 211,
  birthday 209, fireworks 208, ghost 220, party 226, prom 225, disco 206,
  carnival 230, mother-day 231, father-day 232, sweet 107, sport 224, alarm 219,
  game 229, night 233, sleep 234, morning 235, afternoon 236, study 237,
  business 238, reading 239, work 249, dream 207, energetic 16, excited 240,
  happy 241, enthusiasm 242, profound 243, mysterious 244, quite 245, miss 246,
  warm 247, accumulation 248.
- New multi-packet scenes: base64 effect blob from `ScenesRgbIC`/`ScenesGraffiti`/
  `ScenesCube`/`ScenesCompose`/`ScenesH610B` keyed by effect code, sent with
  `MultiNewScenesControllerV1..V10` (proType `0xA3`, cmdType = scene protocol
  version 1..10; e.g. V1=0x01, V2=0x02, V5=0x0A), then `04 <effect>` selects it.
  Effect blob includes direction (byte 9 or user-set), x/y, speed, music code and
  focus params for cube/compose effects (`ScenesOp.g()`).
- `Support.is2NewScenesMode()` / `getSupportScenesOpSet()` decide between static
  `04 <id>` and multi-packet blob per goodsType/version.
Source: `h6102/ble/Mode.java`, `h6160/ble/SubModeScenes.java`,
`barelightv1/ble/Mode.java`, `base2light/ble/ScenesOp.java`,
`base2light/ble/ScenesRgbIC.java`, `base2light/ble/scenes/RgbIcScenesV1..V3.java`.

### 8.7 DIY — `sub 0x0A` (new) and `sub 0x07` (old)

- New DIY: `0A <diyCodeLo> <diyCodeHi>` (16-bit LE). Selects a DIY effect that was
  previously uploaded.
- Old DIY (h6127/h6129): `07` + 16-byte DIY protocol:
  `[0]=code [1]=? [2]=? [3]=? [4..]` RGB triples (max 4 colors / 10 bytes).
- DIY upload (`MultipleDiyController`, proType `0xA5`, cmdType `0x02`):
  `[0]=diyCode [1]=style/params [2]=? [3]=? [4]=rgbByteLen [5..]=RGB triples
   [..]=brightnessLen [..]=brightness bytes`.
- Graffiti DIY: `MultiDiyGraffitiController` (proType `0xA5`, cmd 0x03) and
  `MultiDiyGraffitiControllerV3` (cmd 0x57).
- DIY codes are carried in `DiySupportV1`/`DiyM`; mix/diy base code is 255
  (`DiyM.EffectCode.g = {255, b2light_diy_mix}`), studio/area codes in the
  808..813 range (`DiyM.EffectCode.a = 808 … f = 813`), with per-effect sub-code
  sets from `DiyM.EffectSubCode`.
Source: `h6127/ble/SubModeOldDiy.java`, `h6129/ble/SubModeOldDiy.java`,
`*_/ble/SubModeNewDiy.java`, `base2light/ble/controller/MultipleDiyController*.java`,
`base2light/ac/diy/DiyM.java`.

### 8.8 Gradient / gradual — `0x14`, `0x0E`, `0xA3`

- h6102/h6105 `LimitController` (0x0E) is a current limit, not gradient.
- h6119/h612526 `GradualController` (0x14): `[0]=0/1` gradient on/off.
- h6160/h7090/barelight/chassis `Gradual4BleWifiController` (0xA3):
  `[0]=0/1` gradient on/off; some variants carry per-segment brightness.
  `Gradual4BleWifiControllerV1` same opcode with a V1 event.
Source: `h6119/ble/Gradual4BleController.java`,
`h612526/ble/GradualController.java`, `h6160/ble/v1/Gradual4BleWifiController*.java`,
`h7090/ble/Gradual4BleController.java`, `chassislightv1/ble/Gradual4BleWifiController`.

### 8.9 Motion / direction / carousel / compose (RGBIC)

- Effect direction is carried in the scene blob and by the multi-scene controller
  `AbsMultipleControllerV14Scenes.direction/x6/y6/speed` fields
  (`MultiNewScenesControllerV4/V5...`).
- `CheckDirectionFinishController` (`0x39`) returns whether direction setup finished.
- Compose/carousel effects: `MultiNewScenesControllerV5` (cmd 0x0A) with compose
  blob + `SubModeScenes`; cube effects V4 (x/y/speed/direction).
- Left/right strip switch (car light): `h7090/SwitchLRController` cmd `0x33`,
  `[0]` = state ∈ {0 off, 1 left, 16 right, 17 both}; `ComposeHeartController`
  (cmd 0x33 read) parses `[0]` compose state and `[1]==1` festive flag.
- Light position: `h7090/LightPosController` cmd `0x31`, `[0]` 0/1.
- Segment/IC calibration: `0x40` segment count, `0x41` device info/splicing,
  `0x42/0x43` IC check, `0x46` reset (base constants; used by `VM4Light.changeIcNum`
  and cut calibration in `h667172`).

### 8.10 Sleep / wake / timer

- Sleep `0x11`, wake `0x12`, payload `[0..3]` (hour/min/brightness/color index),
  parsed back with the same offsets (`SleepControllerV2`, `WakeUpControllerV2`).
- Timer packets use base `ControllerNewTimer`; IoT uses `timer` JSON with
  `time[{enable,openHour,openMin,closeHour,closeMin,repeat}]`.

---

## 9. Source map (paths traced)

All paths relative to `decompiled/jadx-splits/split_pact_rgbiclight/sources/` unless
stated otherwise. Base paths are relative to `decompiled/jadx-base-7.7.10/sources/`.

```
h6102/ble/{BleComm,BleProtocol,Mode,ModeController,SubModeColor,SubModeMusic,SubModeNewDiy,SubModeScenes,LimitController,MultipleBleComm}.java
h6102/scenes/{Common,BleColorCmdBuilder,BleSwitchCmdBuilder,BleBrightnessBuilder,BleColorTempBuilder,BleHeartBuilder}.java
h6102/sku/{Sku,SubLib,Support,AbsEffectOp4Ble}.java
h6105/ble/*  (same layout, music sub 0x03)
h6119/ble/{BleProtocol,Mode,Mode4ColorStrip,SubModeColor,SubModeColorV2,SubModeMusic,SubModeScenes,SubModeNewDiy,Gradual4BleController,MultipleDiyController,BulbStringColorController,BulbGroupColor}.java
h6119/scenes/Common.java
h612526/ble/{BleProtocol,Mode,Mode4ColorStrip,SubModeColor,SubModeMusic,SubModeScenes,GradualController}.java
h6127/ble/{BleProtocol,Mode,SubModeMusic,SubModeMusicV1,SubModeOldDiy,SubModeNewDiy}.java
h6129/ble/{BleProtocol,Mode,SubModeMusic,SubModeOldDiy,SubModeNewDiy}.java
h6185/ble/{BleProtocol,Mode,SubModeMic}.java
barelightv1/ble/{BleProtocol,Mode,Mode4ColorStrip,SubModeMusic,SubModeMusicV2,ParamsSubMode4Music}.java
barelightv1/pact/{Support,SubLib,Comm}.java
chassislightv1/ble/{BleProtocol,Mode,Mode4ColorStripV2,SubModeColorV2,SubModeMic,SubModeMicV2}.java
chassislightv1/adjust/h7092/color/SubModeColorH7092.java
chassislightv1/pact/{Support,SubLib,BleSkuItem,BleSkuItemH7092}.java
h7090/ble/{BleProtocol,Mode,BleComm,SwitchLRController,LightPosController,ComposeHeartController,SubModeMusic,SubModeColor,SubModeColorV2}.java
h7090/pact/{Support,SubLib,SubMaker,Comm}.java
rgbiclight/h6160/ble/{BleProtocol,Mode,ModeController,SubModeColor,SubModeColor4Bk,SubModeMusic,SubModeMusicV1,SubModeMusicV1Rgb,SubModeScenes,SubModeNewDiy}.java
rgbiclight/h6160/ble/v1/{BulbStringColorController,BulbGroupColor,Gradual4BleWifiController,Gradual4BleWifiControllerV1,Mode4ColorStrip}.java
rgbiclight/h6160/iot/{Cmd,CmdTurn,CmdBrightness,CmdColor,CmdColorTem,CmdColorWc,CmdPt,CmdPtReal,CmdStatusV0,CmdTimer,CmdOnline?}.java
rgbiclight/h6160/scenes/{Common,AbsIotCmdBuilder,Iot*CmdBuilder,Ble*CmdBuilder}.java
rgbiclight/h6160/sku/{Sku,SubLib}.java
rgbiclight/ble/{BleComm,BleMultiComm,BleNotifyComm}.java
rgbiclight/pact/{AbsEffectOp4BleIot,EffectOp4BleIot,OpCommDialog4BleIot*,OpDiyCommDialog4BleIot*,OpSceneCommDialog4BleIot*}.java
rgbiclight/scenes/{IotSwitchCmdBuilder}.java
rgbiclight/{Support,SupportV2,Support4H6105,Support4H6129,Support4H6127,Support4DreamColorLightV2,Support4H6184,SupportH6119,SupportH6185,MatterRegister,Protocols,ControllerStrategyConfig}.java
rgbiclight/mode/scene/config/ScenesSupport.java
rgbiclight/h667172/*  (UI/cut calibration; no private opcodes)
rgbiclight/h61050729/BleProtocol.java
dreamcolorlightv1/iot/{Cmd,CmdBrightness,CmdBulb,CmdColorWc,CmdPt,CmdPtReal,CmdStatusV0,CmdStatusV1,CmdTurn}.java
dreamcolorlightv1/pact/{Support,SubLib,SubLib4BleIot,SubMaker,bleiot/*}.java
dreamcolorlightv2/iot/{Cmd}.java
dreamcolorlightv2/pact/Support.java
base: com/govee/base2kt/utils/BleUtils.java
base: com/govee/base2light/ble/controller/{AbsSingleController,AbsController,AbsModeController,AbsMode,BrightnessController,SwitchController,HeartController,AbsMultipleController,AbsMultipleControllerV1,AbsMultipleControllerV2,AbsMultipleControllerV14Scenes,MultipleDiyController,MultipleDiyControllerV1,MultiDiyGraffitiController,MultiDiyGraffitiControllerV3,MultipleColorStripControllerV1,MultipleController4Music,SleepController,SleepControllerV2,WakeUpController,WakeUpControllerV2,CheckDirectionFinishController}.java
base: com/govee/base2light/ble/comm/{AbsBleComm,AbsMultipleBleComm,MultipleControllerComm,MultipleControllerCommV1}.java
base: com/govee/base2light/ble/{ScenesOp,ScenesRgbIC}.java
base: com/govee/base2light/ble/scenes/{RgbIcScenesV1,RgbIcScenesV2,RgbIcScenesV3}.java
base: com/govee/base2light/light/ModeStr.java
base: com/govee/base2light/ac/diy/{DiyM}.java, ac/diy/v1/EffectCodes.java
base: com/govee/base2light/ble/music/AbsNewMusicEffect.java
base: com/govee/base2home/iot/{Write,AbsCmdWrite}.java
base: com/govee/base2light/iot/{CmdTurn,CmdStatus,Color}.java
base: com/govee/base2light/util/NumUtil.java
```

---

## 10. Gaps / unknowns

1. **Exact per-SKU goodsType mapping is data-driven.** The app determines goodsType
   from the product database, not from a constant in these sources. The goodsType
   sets above are exhaustive for what the module registers, but which physical SKU
   maps to which goodsType (e.g. H619D→71, H70A1→193, H61A8→19) comes from the
   version-gate code; a few remain ambiguous.
2. **DiyM effect-code constants are obfuscated.** `DiyM.EffectCode.*` and
   `EffectSubCode.*` are large static arrays with obfuscated field names; only the
   mix code 255 and studio range 808..813 are clearly resolvable. Individual
   DIY sub-effect numeric IDs need a runtime dump.
3. **Scene effect blobs are base64 assets** (`ScenesRgbIC`, `ScenesGraffiti`,
   `ScenesCube`, `ScenesCompose`, `ScenesH610B`). The *selection* code (`04 <id>`) and
   scene IDs are exact; the blob byte layouts are shipped per-effect and are not
   fully enumerated here. Direction/speed/x/y are at fixed offsets (direction often
   byte 9 or byte 5/6) but vary per scene family.
4. **Multi-packet framing has many variants** (`makeSendBytesV0/V1/V2/V3/V4`,
   MTU `0xA6`, `makeSendBytesMtu*`). The shared 20-byte chunking (start/data/end) is
   documented; the MTU-based variants only apply to OTA/graffiti and are not fully
   transcribed.
5. **Music** has legacy, V1, V2 and "new music" code spaces; the code→effect-name
   table lives in `AbsNewMusicEffect` subclasses and resource strings. Documented code
   sets are the RGBIC/RGB lists (50..55, 48..49).
6. **Matter** clusters/attributes are handled by the base `MatterInterceptor`; this
   split only registers interceptors/version gates, so no cluster IDs are available
   here.
7. **h667172** is UI/cut-calibration only; it defines no private GATT opcodes. Its
   effect traffic goes through `rgbiclight` SupportV2 (goodsType 332) and `ptReal`.
8. **`h61050729`** is a dated H6105 revision that only declares sub-mode IDs
   (0x15/0x04/0x0A/0x03); payload builders are the shared dream-color ones.
9. Some event/listener classes (`Event*`) were not individually enumerated; they are
   response plumbing, not new opcodes.
10. `EffectCodes`/`DiySupportV1` support matrices are per-SKU capability data
    (max colors/speed), not wire format; values are in the base `DiyM` tables.


---

<!-- split_pact_rgblight -->

# split_pact_rgblight — BLE / IoT protocol extraction

Split: `split_pact_rgblight` (module `pact_rgblight`, 7.7.10)
Source root: `decompiled/jadx-splits/split_pact_rgblight/sources`
Base helpers: `decompiled/jadx-base-7.7.10/sources`

All paths below are relative to `decompiled/`.

---

## 1. Overview — families and SKUs

This is the large "RGB / RGBIC strip, bulb, TV-light, car-light, home-light" split.
It is not one protocol: it is ~20 independent BLE dialects that share the
`base2light` controller framework (`AbsSingleController`, `AbsModeController`,
`AbsMultipleController*`). They differ in:

* which GATT service/characteristic they use (vendor `…1910/…2b11` vs Nordic `FFE0/FFE1`),
* which `sub_mode` byte inside `0x05` (mode) selects colour / music / scene / DIY,
* the colour payload width (8-byte RGB+flag vs 9-byte RGB+kelvin),
* scene effect-id width (1 byte vs 2 bytes LE),
* whether they have an IoT (`pt` / `ptReal`) path.

### 1.1 Sub-family / SKU matrix (deduplicated)

| Sub-family (package) | SKUs (`SubLib.keys()` / `Sku.*`) | Transport | Notes |
|---|---|---|---|
| `h6159` | H6159, H6110, H6109, H614A, H614B, H614E | ble+iot | canonical RGB dialect (8-byte colour, 2-byte scene id, music 0x03 + 0x0E) |
| `h613839` | H6138, H6139, H613A, H613B, H613C, H613D, H613E, H613F | ble+iot | almost identical to h6159; adds `SubModeColor4Bk` (9-byte) and music V1/V2 |
| `h6160` | H6160 | ble+iot | `AbsBle4Old`; adds `sub_mode_color_v1 = 0x0B` (15-segment mask) and gradual-change `0xA3` |
| `h6165` | H6165, H6166 | ble | 8-byte colour, mic `0x05 0x00 flag`, no scenes |
| `h6181` | H6181 | ble | 1-byte scene id, no music (mic marker `0xFF` only) |
| `h6182` | H6182 | ble+iot | 1-byte scene id, music `0x03` |
| `h6113` | H6113 | ble | music `0x03`, no scenes |
| `h6114` | H6114 | ble | music `0x03`, 1-byte scene id |
| `h6101` | H6101 | ble | video mode `0x00`, music `0x01` with effect 0..3, calibration `0x08` |
| `h6104` | H6104 | ble+iot | video `0x00`, music `0x01`, 1-byte scene id, multi-DIY, direction `0x13`, IP `0x15` |
| `h7004` | H7004 | ble | red/blue ratio `0x0D` only |
| `h7017` | H7017 | ble | red/blue ratio `0x0D` only (config skeleton) |
| `h73101217` | H7310, H7312, H7317 | ble | mic `0x05`, 8-byte colour, 1-byte scene id; H7317 has separate `ModeH7317` |
| `h7318` | H7318 | ble | music `0x01 [effect,sens]`, 1-byte scene id |
| `tvlightv1` | H6179 | ble | **TV light**: colour 9-byte (`0x0D`), no scenes; goodsType 12 |
| `carlightv1` | H6118, H6194 | ble | **car light**: colour `0x0D`, music `0x0E`/`0x13`, scenes `0x04` 2-byte; goodsType 6 |
| `homelightv1` | H6148 | ble+iot | **home light**: colour `0x0D`, music `0x0F`, scenes `0x04` 1-byte; goodsType 16 |
| `rgblight/h6188` | H6188 | ble+iot | new-detail; colour `0x0D`, music `0x03`, scenes `0x04` 2-byte |
| `rgblight/h7308` | H7308, H7309, H7311, H7313, H7315, H7316 | ble | scenes sub-mode is `0xA1` (not `0x04`), effect ids 20..27 |
| `rgblight/h60858689` | H6085, H6086, H6089 | **iot only** | WiFi bulb; AP provisioning (`192.168.1.1:7200`, SSID `Govee_bulb`) + cloud MQTT; no BLE |
| `stringlightv2` | H6141, H6142, H6195, H6196, H6197, H6170, H6154, H6121, H615A, H615B, H615C, H615D, H616B, H6178, H615E, H6192 **plus** H6159/H6110/H6109/H614A/H614B/H614E/H6138/H6139/H613A…H613F/H6160 | ble, or ble+iot by goodsType | richest dialect: colour `0x0D`, music `0x0E`, new music `0x13`, mic `0x05`, scenes `0x04`; goodsType 1/40/108 = BLE+IoT, 2/39/68/78/143 = BLE |

Total distinct SKUs in this split: **59** (see JSON `skus`).

SKU source of truth:

* `…/com/govee/*/sku/SubLib.java` (`keys()`), `…/sku/Sku.java` arrays.
* `…/com/govee/carlightv1/pact/Support.java` (`e = {6}`, names `H6118`/`H6194`).
* `…/com/govee/homelightv1/pact/Support.java` (`e = {16}`, name `H6148`).
* `…/com/govee/stringlightv2/pact/Support.java` (all SKU string constants; `I={2,39,68,78,143}`, `J={40,108,1}`).
* `…/com/govee/rgblight/Support.java` (`f`, `g`, `h`, `B`, `C` sets).
* `…/com/govee/rgblight/h7308/H7308Config.java` (`{H7308,H7309,H7311,H7313,H7315,H7316}`).
* `…/com/govee/rgblight/add/SubLib.java` (`H6188,H6160,H6182`), `OldBleSubLib` (`H6113,H6114,H6181` + H7308 group), `OldIotSubLib` (`H6085,H6086,H6089`), `SubLibBle` (goodsType 12 = H6179).
* `…/com/govee/tvlightv1/SupportH6179.java` (`H6179`, goodsType 12).
* `…/com/govee/rgblight/RgbLightRegistry.java` (`f` = 39-SKU registry set).

---

## 2. Transports and GATT UUIDs

Two UUID pairs are used.

| Pair | Service | Characteristic | Families |
|---|---|---|---|
| **Vendor ("Govee")** | `00010203-0405-0607-0809-0a0b0c0d1910` | `00010203-0405-0607-0809-0a0b0c0d2b11` | h6159, h613839, h6160, h6165, h6182, h6113, h6114, h6181, h7004, h7017, h73101217, h7318, h6179 (via rgblight), carlightv1, homelightv1, rgblight, stringlightv2 |
| **Nordic UART** | `0000ffe0-0000-1000-8000-00805f9b34fb` | `0000ffe1-0000-1000-8000-00805f9b34fb` | **h6101**, **h6104** (single + multi-packet comm) |

Evidence:

* `…/com/govee/h6159/ble/BleComm.java`, `h6160/ble/BleComm.java`, `h6113`, `h6114`, `h6181`, `h6182`, `h6165`, `h7004`, `h7017`, `h73101217`, `h7318`, `carlightv1`, `homelightv1`, `stringlightv2`, `rgblight/ble/BleComm.java`.
* `…/com/govee/h6101/ble/BleComm.java`, `…/h6104/ble/BleComm.java` (FFE0/FFE1); `…/h6104/ble/MultipleBleComm.java` also FFE0/FFE1.

Group/multi variants (`BleCommGroup`, `BleMultiComm`, `BleMultiCommGroup`) use the same pair.

### Transport classification evidence

* **ble+iot**: package has `iot/` with `Cmd*` + `Op*CommDialog4BleIot*`, and `Ble.u()` returns `AbsMultiple4PtRealBleComm` (ptReal tunnel): h6159, h613839, h6160, h6182, h6104, homelightv1, stringlightv2, rgblight/ble.
* **ble only**: `Ble` exposes only `r()` (+ optional `v()`/`w()`), no ptReal/u(): h6113, h6114, h6181, h6165, h6101, h7004, h7017, h73101217, h7318, carlightv1 (`EffectOp4Ble.supportWifi()` → false), tvlightv1.
* **iot only**: `H60858689Config`/`SubMaker.SkuItem.needBle()` returns **false** for H6085/H6086/H6089 → no GATT; `EffectOp4Iot.supportBle()` false, `supportWifi()` true.
* H6104 `AbsEffectOp4Ble` returns both `getRoomOp()` (BLE) and non-null `getRoomOp4Iot()`, `isWifiLight()=true` → ble+iot.
* H6182 has an `iot/` package but no `CmdPtReal`; IoT uses direct `color`/`colorTem`/`turn`/`brightness` JSON.
* H6188/stringlightv2/h6159/h6160 use `CmdPtReal` (`{ "command": ["<base64(20B frame)>"] }`).

---

## 3. BLE frame

Every packet is fixed 20 bytes:

```
[0]     proType
[1]     cmdType
[2..18] payload (zero padded)
[19]    BCC = XOR of bytes 0..18
```

`proType`:

| proType | Meaning |
|---|---|
| `0x33` | single write / set |
| `0xAA` | single read / query (also `0xAB` = single read multi-reply in some families) |
| `0xA5` | multi-packet write (multi-DIY `cmdType 0x02`) |
| `0xA4` | multi-packet read |
| `0xA3` | multi-packet V1 write (new scenes / music / DIY template / gradual) |
| `0xEE` | notification |

Read replies are stripped by `AbsSingleController.m()`: for reads bytes `2..18` → 17-byte
`validBytes`; for writes bytes `3..18` → 16 bytes. `AbsMode.parse()` then takes
`validBytes[0]` as the sub-mode and passes `validBytes[1..]` to the sub-mode parser.
(`decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/AbsSingleController.java`,
`AbsMode.java`, `AbsModeController.java`.)

### 3.1 Shared single-packet commands

These are the framework controllers used by every family in this split unless noted.

| Name | Write op | Payload | Read op | Reply |
|---|---|---|---|---|
| heartbeat | — | — | `0xAA/0x01` | `[0]` 0/1 (`HeartController`) |
| power | `0x33/0x01` | `[0]` 0=off, 1=on | `0xAA/0x01` | `[0]` state |
| brightness | `0x33/0x04` | `[0]` absolute 0..254 (scaled from UI 0..100 between family min/max) | `0xAA/0x04` | `[0]` absolute |
| mode / colour / scene / DIY / music | `0x33/0x05` | sub-mode payload (§8) | `0xAA/0x05` | payload `{0x01}`; reply `[0]`=sub-mode, `[1..]`=sub-mode body (`AbsModeController.p()` = `{1}`) |
| soft version | — | — | `0xAA/0x06` | ASCII string |
| hard version | — | — | `0xAA/0x07` | `p()` = `{0x03}`, reply `[0]==3`, `[1..]` ASCII |
| wifi soft version | — | — | `0xAA/0x21` | ASCII |
| wifi hard version | — | — | `0xAA/0x20` | ASCII |
| auto time / timer V0 | `0x33/0x0A` | `[0..]` open/close h/m/repeat | `0xAA/0x0A` | `AutoTimeController` |
| new timer V1 | `0x33/0x23` | timer slots | `0xAA/0x23` | `NewTimerV1Controller`, 4 slots parsed by `NewTimerV1.parseBytes` |
| sleep | `0x33/0x11` | sleep window | `0xAA/0x11` | `SleepController` |
| wakeup | `0x33/0x12` | wake window | `0xAA/0x12` | `WakeUpController` |
| limit (max current/brightness cap) | `0x33/0x0E` | `[0]` 0/1 | `0xAA/0x0E` | `[0]==1`; stringlightv2/h6160 `LimitController` |
| OTA prepare | `0x33/0xEE` | none | — | `OtaPrepareController` (stringlightv2, h6160) |
| multi-DIY | `0xA5/0x02` | §8.4 | `0xA4/0x02` | — |
| multi scenes | `0xA3/0x01` (V1), `0xA3/0x02` (V2), `0xA3/0x07` (V3), `0xA3/0x0A` (V4/V5) | §8.5 | — | — |
| multi new music | `0xA3/0x41` | §8.6 | — | `MultipleController4Music.getCommandType() = 65` |

Base app refs: `com/govee/base2light/ble/controller/{SwitchController,BrightnessController,AbsModeController,HeartController,SoftVersionController,HardVersionController,WifiSoftVersionController,WifiHardVersionController,AutoTimeController,NewTimerV1Controller,SleepController,WakeUpController}.java`.

---

## 4. BLE commands per family (unique opcodes / payloads)

### 4.1 h6159 (H6159/H6110/H6109/H614A/H614B/H614E)

`…/com/govee/h6159/ble/BleProtocol.java`

| sub-mode | id | Payload (`0x33/0x05` + this) | Parse |
|---|---|---|---|
| colour | `0x02` | `02 R G B tempFlag R2 G2 B2` (8 B) — `tempFlag=1` ⇒ colour-temp, `R2G2B2` = temperature RGB | `[0..2]`=RGB, `[3]`=flag, `[4..6]`=bg RGB |
| music | `0x03` | `03 autoFlag sensitivity [R G B]` 3 or 6 B; sensitivity 0..99; `autoFlag` 0 = manual/colour | `[0]`auto, `[1]`sens, `[2..4]`RGB |
| scenes | `0x04` | `04 lo hi` (16-bit LE effect id) | `[0..1]` LE16 |
| new DIY | `0x0A` | `0A lo hi` (16-bit LE DIY code) | `[0..1]` LE16 |
| music V1/V2 | `0x0E` | `0E effect sens auto [R G B]`; V2 new-code form `0E musicCode sens` | `ParamsSubMode4Music.a(version)` |
| colour + kelvin | `0x0D` | `0D R G B kHi kLo R2 G2 B2` (9 B, kelvin big-endian) | `[3..4]` signed short kelvin |

Read cycle (`…/h6159/ble/BleReadManager.java f()`):
`0xAA/06, 0xAA/07, 0xAA/07({1}? see i()), 0xAA/21, 0xAA/20, 0xAA/0A, 0xAA/01, 0xAA/04, 0xAA/05`.

### 4.2 h613839 (H6138/H6139/H613A…H613F)

Same as h6159 (`…/h613839/ble/BleProtocol.java`), total submode set:
`{0x02 colour, 0x0D colour+BK, 0x03 music, 0x0E music V1/V2, 0x04 scenes, 0x0A DIY}`.
`ScenesV0` effects `{4,5,7,8,9,16,10}`; microphone thresholds by version
(`…/h613839/sku/Support.java`): H6138 ≥1.04.00 new order / ≥1.00.17 colour order,
H6139 ≥1.04.00 / ≥1.00.12.

### 4.3 h6160 (H6160)

`…/com/govee/h6160/ble/BleProtocol.java`

| sub-mode | id | Payload | Notes |
|---|---|---|---|
| colour | `0x02` | `02 R G B flag R2 G2 B2` | same as h6159 |
| colour V1 (segments) | `0x0B` | `0B R G B maskLo maskHi 00 00` | 15-bit segment enable mask: bits 0..7 → byte 4, bits 8..14 → byte 5 (`…/h6160/adjust/v1/SubModeColorV1.java`) |
| music (old) | `0x03` | `03 auto sens [R G B]` | |
| music V1 | `0x01` | `01 effect sens [R G B]` | effect 0..3 |
| music V1 RGB | `0x0E` | `0E effect sens auto [R G B]` | |
| scenes | `0x04` | `04 lo hi` | 2-byte LE |
| DIY | `0x0A` | `0A lo hi` | |
| gradual change | *(cmd 0xA3)* | `Gradual4BleWifiController` `0xA3 / 0x01` = `{0|1}` — turns gradual transitions on/off | `…/h6160/ble/v1/Gradual4BleWifiController.java` |

`H6160Support`: brightness 20..254; new scenes version = 2 when soft ≥ 1.03.00;
DIY version 4; mic new-order ≥ 1.04.05.

### 4.4 h6165 / h6166

`…/com/govee/h6165/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| colour | `0x02` | `02 R G B 00 00 00 00` (8 B; no scene bg here — `SubModeColor` writes 8 B) |
| mic | `0x05` | `05 00 flag` (`MicController.q()` = `{5,0,flag}`; `SubModeMic` = `{5,1}`) |
| DIY | `0x0A` | `0A lo hi` |

Brightness range: H6165 `{20,254}`, H6166 `{20,230}`.

### 4.5 h6181

`…/com/govee/h6181/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| colour | `0x02` | `02 R G B flag R2 G2 B2` |
| scenes | `0x04` | `04 effect` (1 byte) |
| DIY | `0x0A` | `0A lo hi` |
| mic marker | `0xFF` | `null` payload (never sent; used as selector only) |

No music. `Sku.supportDiy` ≥ 10100.

### 4.6 h6182

`…/com/govee/h6182/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| colour | `0x02` | `02 R G B flag R2 G2 B2` |
| music | `0x03` | `03 auto sens [R G B]` |
| scenes | `0x04` | `04 effect` (1 byte) |
| DIY | `0x0A` | `0A lo hi` |

IoT: direct JSON (`color`, `colorTem`, `turn`, `brightness`), no `ptReal`.

### 4.7 h6113 / h6114

`…/h6113/ble/BleProtocol.java` — `{0x02 colour, 0x03 music, 0x0A DIY}`; no scenes.
`…/h6114/ble/BleProtocol.java` — same + `0x04 scenes` (`04 effect`, 1 byte).

Music payload `03 auto sens [R G B]`, auto = `!autoFlag`.

### 4.8 h6101

`…/com/govee/h6101/ble/BleProtocol.java`

| sub-mode | id | Payload | Meaning |
|---|---|---|---|
| video | `0x00` | `00 videoType syncFlag` — `videoType`: 0=part, 1=all, 2=dynamic; `syncFlag` = `!soft` (0 = soft) | `SubModeVideo` |
| music | `0x01` | `01 effect sens [R G B]` — effect 0=energic, 1=spectrum, 2=rolling, 3=rhythm; RGB only for effect 1/2 | `SubModeMusic` |
| colour | `0x02` | `02 R G B flag R2 G2 B2` | |
| calibration start | `0x08` | none | `CalibrationController` (write-only) |
| calibration ok | `0x01` read | — | `CalibrationOkController` (read) |

### 4.9 h6104

`…/com/govee/h6104/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| video | `0x00` | `00 00 syncFlag videoBrightness`; the new-detail `VideoVm` emits the minimal `05 00 00 <screenState> <vivid>` form. Shared DreamView camera settings: `DREAMVIEW-HDMI.md` |
| music | `0x01` | `01 effect sens [R G B]` (effect 0..3) |
| colour | `0x02` | `02 R G B flag R2 G2 B2` |
| scenes | `0x04` | `04 effect` (1 byte) |
| DIY | `0x0A` | `0A lo hi` |
| direction (write/read) | cmd `0x13` | `[0]` direction code; read `0xAA/0x13` same |
| IP (read) | cmd `0x15` | none → reply `[0..3]`=IPv4, `[4..7]`=port (int32) |

Scene effects (`…/h6104/adjust/Scenes4BleRhythm.java`): `{0,1,4,5,7,8,9,15(snow)}`.

IoT (`…/h6104/iot/Cmd.java`): `online, turn, brightness, status, timer, color, colorTem, calibrationPoints, calibrationSnapshot, IP, direction, IoTConnected`.

### 4.10 h7004 / h7017

`…/h7004/ble/BleProtocol.java`, `…/h7017/ble/BleProtocol.java`

| op | payload | meaning |
|---|---|---|
| `0x33/0x0D` | `[0]` ratio, `[1]` reserved | red/blue ratio (`RedBlueController`) — constants: 1 = 4:1, 2 = 6:1, 3 = 8:1 |
| `0x33/0x05` | `null` | `Mode.a(goodsType, pactCode)` selects `SubModeRedBlue41/61/81` whose `getWriteBytes()` = `null` (selector only) |

These are "plant / red-blue" grow-light style SKUs. Only `BleComm`/`Ble` skeletons are present;
detail UI lives elsewhere.

### 4.11 h7310 / h7312 / h7317

`…/h73101217/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| colour | `0x02` | `02 R G B 00 00 00 00` (8 B) |
| scenes | `0x04` | `04 effect` (1 byte) |
| mic | `0x05` | `05 01` |
| DIY | `0x0A` | `0A lo hi` |

`H7317` uses `ModeH7317` + `H7317ModeController` (separate parser class, same wire format).
`Sku.supportCopperRgbMic` for H7310/H7312 soft ≥ 10100; `supportMix` for H7317 always,
others soft ≥ 10100.

### 4.12 h7318

`…/h7318/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| music | `0x01` | `01 effect sens` (effect 5=power, 4=soft) |
| colour | `0x02` | `02 R G B 00 00 00 00` |
| scenes | `0x04` | `04 effect` (1 byte) |
| DIY | `0x0A` | `0A lo hi` |

### 4.13 tvlightv1 (H6179, TV light)

`…/com/govee/tvlightv1/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| colour | `0x0D` | `0D R G B kHi kLo R2 G2 B2` (9 B) |
| DIY | `0x0A` | `0A lo hi` |

No scenes, no music (only colour + DIY + switch + brightness + heartbeat).
Brightness `NumUtil.calculateProgress(254, 20, i)`; goodsType 12.

### 4.14 carlightv1 (H6118 / H6194, car light)

`…/com/govee/carlightv1/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| scenes | `0x04` | `04 lo hi` (2-byte LE) |
| DIY | `0x0A` | `0A lo hi` |
| colour + kelvin | `0x0D` | `0D R G B kHi kLo R2 G2 B2` |
| music V1 | `0x0E` | `0E effect sens auto [R G B]` |
| new music | `0x13` | `13 effect sens param auto [R G B]` (8 B) |

`ScenesV0` effects `{4,5,7,8,9,10,16}`; goodsType 6, protocols `(1,1),(1,2)`.

### 4.15 homelightv1 (H6148, home light)

`…/com/govee/homelightv1/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| scenes | `0x04` | `04 effect` (1 byte) |
| DIY | `0x0A` | `0A lo hi` |
| colour + kelvin | `0x0D` | `0D R G B kHi kLo R2 G2 B2` |
| music | `0x0F` | `0F effect sens param auto [R G B]` |

Scenes `{4,5,13,23,24,9,16,7,17,26}` (read/brightness/aurora/sleep…); goodsType 16.
BLE room-op method `makeMicBytesByRgb` → `ModeController(SubModeColor.beRgb(rgb))`.

### 4.16 rgblight/h7308 group (H7308/H7309/H7311/H7313/H7315/H7316)

`…/com/govee/rgblight/h7308/H7308BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| scenes | **`0xA1` (signed -95)** | `A1 effect` — single-byte effect id, *not* `0x04` |
| effects | 20..27 | 20 combination, 21 in-waves, 22 sequential, 23 slow-glow, 24 chasing, 25 slow-fade, 26 twinkle, 27 steady-on |

Scene command construction: `…/rgblight/mode/scene/DelegateSceneV1.java` chooses
`H7308BleProtocol.sub_mode_scenes` for the H7308 set, otherwise `0x04`.

### 4.17 rgblight/h6188 (H6188)

`…/com/govee/rgblight/h6188/H6188BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| colour + kelvin | `0x0D` | `0D R G B kHi kLo R2 G2 B2` |
| music | `0x03` | `03 auto sens [R G B]` |
| scenes | `0x04` | `04 effect` (2-byte LE per `SubModeScenes`) |
| DIY | `0x0A` | `0A lo hi` |

Scene effects `{4,5,13,23,24,9,16,7,17}`; has `H6188DevicePickSound` (music-file picker).

---

## 5. BLE notifications / readings

All families register `BleNotifyComm extends AbsNotify` with `b() = 0xEE` (proType notify).
Notification frame: `[0]=0xEE`, `[1]=notifyType`, `[2..18]=body`; `AbsNotify` copies
`bytes[1..18]` and dispatches on `bytes[1]`; each `AbsNotifyParse` then copies
`[1..17]` into a 17-byte body (i.e. original bytes 2..18).

| notifyType | Parser | Layout | Meaning |
|---|---|---|---|
| `0x11` (17) | `WifiNotifyParse` (`h6159/ble/WifiNotifyParse.java`, `h6104`, `h6160`, `h6182`, `homelightv1`, `stringlightv2`, `rgblight/ble/BleNotifyComm`) | `[0]==0` ⇒ connected | WiFi/BLE pairing status → `EventNotifyWifiConnect` |

Offline/read state is otherwise obtained by the `0xAA` read cycle (§3.1), which returns
the current switch/brightness/mode and the version strings.

`rgblight/ble/BleNotifyComm` also registers `com.govee.base2light.connect.present.WifiNotifyParse`.

---

## 6. IoT (cloud / WiFi) commands

### 6.1 Command envelope

`CmdBuilder.makeCmdStr(cmd)` → `com.govee.base2home.iot.Write.getWriteMsg4Transaction(null, cmd)`
(V0):

```json
{"msg":{"transaction":"<gen>","accountTopic":"<topic>","type":1,"origin":32,
        "cmdVersion":<int>,"cmd":"<name>","data":{...}}}
```

Reads use `type:0` with the same `cmd`/`data` shape.

Envelope variant by family:

| Family | Incoming variant | Parser |
|---|---|---|
| h6104 | V0 flat `status` object | `…/h6104/iot/IotManager.java` extends `AbsIotManagerV0`, `CmdStatusV0.parseJson` |
| h6159 | V0 with `status.modeValue` base64 BLE frames | `…/h6159/iot/IotManager.java`, `CmdStatusV0` |
| h6160 | V0 + `pt`/`ptReal` | `…/h6160/iot/Cmd*` |
| h6182 | V0 direct JSON | `…/h6182/iot/CmdStatusV0` |
| homelightv1 | V1 `{ "state": {...}, "op": {...} }` | `…/homelightv1/iot/CmdStatusV0.parseJson` via `AbsIotManagerV1.getJsonObjectStr` |
| stringlightv2 | V1 `{ "state": {...}, "op": {"command":[...] } }` | `…/stringlightv2/iot/CmdStatusV1.parseJson`, `ResultPtV1` |
| H6085/H6086/H6089 | V1 (`OldIotResp` with `state`, `config`, `modeValue`) | `…/rgblight/h60858689/H60858689IotV1ParseHelper.java` |

### 6.2 `cmd` names

| cmd | data fields | Families |
|---|---|---|
| `online` | — (query) | all |
| `turn` | `val`: 0/1 | all |
| `brightness` | `val`: int (family absolute range, see `getBrightnessRange`) | all |
| `color` | `red`,`green`,`blue` (0..255) | h6104, h6159, h6160, h6182, homelightv1 (V1 state only), stringlightv2 |
| `colorTem` | `colorTemInKelvin`, `color{red,green,blue}` | h6104, h6159, h6160, h6182, stringlightv2 |
| `colorwc` | `color{red,green,blue}`, `colorTemInKelvin` | h6159, h6160, homelightv1, stringlightv2 |
| `status` | see §6.3 (query/response) | all |
| `timer` | `enable`, `timeOffset`, `timeOffsetMinute`, `isGroup`, `group`, `time[]{enable,openHour,openMin,closeHour,closeMin,repeat}` (`cmdVersion:1` in `CmdTimerV1`) | h6104, h6159 |
| `pt` | `op`,`value:[base64]` | h6159, h6160, homelightv1, stringlightv2 |
| `ptReal` | `command:[base64 20-byte frame]` | h6159, h6160, stringlightv2 |
| `calibrationPoints` | `points[]{pointX,pointY}` | h6104 |
| `calibrationSnapshot` | `snapshotUrl` | h6104 |
| `IP` | `ip`,`port` | h6104 |
| `direction` | `change` | h6104 |
| `IoTConnected` | — | h6104 |
| `state` / `op` | read-parse keys (not cmd names): homelightv1 `Cmd.getCmdReadParseKey("pt")="op"`, else `"state"`; stringlightv2 for `pt`/`ptReal` → `"op"` | homelightv1, stringlightv2 |
| `mode` (H6085/86/89) | `mode:10`, `code`, `color[]` (RGB list), `effect`, `subEff`, `speed`, `effArr[]{effect,subEff}` — `CmdDiy` | H6085/86/89 |
| `mode` (H6085/86/89 scene) | `mode:4`, `code` — `CmdScenes` | H6085/86/89 |
| `colorTem` (H6085/86/89) | `colorTemInKelvin`, `color` | H6085/86/89 |

`pt` value list is a sequence of base64-encoded **20-byte BLE frames**. The last frame is the
`0x05` mode frame (`CmdPt.getModeBytes()`), so `pt` = "BLE frames over cloud".

`ptReal` is the same but with the key `command` and is preferred for new firmware
(`CmdPtReal.getNewScenesCmdPtReal` → base64 of each A3 packet + final mode frame).

### 6.3 `status` / reading schema

h6104 / h6159 `CmdStatusV0`:

```json
{"cmd":"status","data":{
  "turn":0|1, "brightness":0..254,
  "mode":2|4|10,                  // 2=colour/colourTem, 4=scene, 10=DIY
  "color":{"red":0-255,"green":0-255,"blue":0-255},
  "colorTemInKelvin":2000..9000,
  "softversion":"1.02.03", "wifiSoftVersion":"1.03.01",
  "modeValue":["<base64 20B mode frame>"],
  "timer":{"enable":0|1,"time":[{"openHour":..,"openMin":..,"closeHour":..,"closeMin":..}]}
}}
```

* `modeValue` (h6159) is decoded with `BleUtil.parseValidBleBytes` and fed to `Mode.parse`;
  `CmdStatusV0` requires `frame[1]==0x05` and length 20.
* h6104 `status` has no `modeValue`; colour is `mode==2` + `color`/`colorTemInKelvin`.

homelightv1 (V1 `state`):

```json
{"state":{"onOff":0|1,"brightness":0..100,"mode":13,
          "color":{"red":..,"green":..,"blue":..},"colorTemInKelvin":..},
 "op":{"opcode":"mode|sleep|wakeup|timer",
       "modeValue":["<b64>"],"sleepValue":["<b64>"],"wakeupValue":["<b64>"],"timerValue":["<b64>"]}}
```

stringlightv2 (V1):

```json
{"state":{"onOff":0|1,"brightness":0..100,"mode":..},
 "op":{"command":["<b64 20B frame>", ...]}}
```

`CmdStatusV1.parseJson` scans `command` frames by `frame[1]`:
`0x05` → mode (`Mode.parseMode`), `0x23` → timers (`NewTimerV1Controller.parseAllTimer`),
`0x12` → wakeup, `0x11` → sleep.

H6085/H6086/H6089 (V1 `OldIotResp`): `cmd=="status"`, `state.color`, `state.mode`,
`config.time[]`, `config.sleep`, `config.wakeup`, `config.modeValue`. Mode decoding:
`mode 2` → colour, `mode 4` → `code` (scene), `mode 10` → `code` (DIY).

### 6.4 IoT readings units

| Field | Unit / range |
|---|---|
| `brightness.val` | device-absolute 0..254 (families expose `getBrightnessRange`; e.g. H6159 6..254, H6166 20..230, h6104 20..254) |
| `colorTemInKelvin` | Kelvin, `Constant.getColorTemKelvinSet()` (typical 2000..9000, 100 K steps) |
| `color.red/green/blue` | 0..255 |
| `timer.*` | local time, `timeOffset` in minutes offset |
| `direction.change` | raw direction byte (see BLE direction table) |

---

## 7. Other protocols

### 7.1 H6085/H6086/H6089 WiFi provisioning (AP mode, softAP + socket)

`…/com/govee/rgblight/h60858689/H60858689Config.java`, `…/add/ApComm.java`,
`WifiApInfo.java`, `PairAc.java`, `AddInfo.java`.

* SoftAP SSID `Govee_bulb_<SKU>`, device IP `192.168.1.1`, port **7200**,
  default SSID prefix `Govee_bulb`.
* JSON `BaseRequest` / `BaseResponse` over a socket:
  * `type 1` → read device info (`AbsDeviceInfo`: device, sku, mac, …)
  * `type 2` → send WiFi credentials (`WifiApInfo` fields incl. `ssid`, `timeStamp`)
  * response `result 0` = success, followed by `CheckDeviceWifiRequest` and
    `DeviceBindRequest`/`DeviceTopicRequest` bootstrap.
* After provisioning the bulb is cloud-only: `DeviceSetting{ mac, topic }`, topic used for
  MQTT (`AbsOpCommDialog4Iot`), online cmd `online`.
* BLE capability flags: `SubMaker.SkuItem.needBle()` → false; `EffectOp4Iot.supportBle()` false,
  `supportWifi()`/`isWifiLight()` true. `AddInfo.makeAddInfo4Pair(sku,32,64,"Govee_bulb_"+sku,"192.168.1.1",7200)`.

### 7.2 BLE advertisement / broadcast

`rgblight/add/BleBroadcastProcessorV1.java` (and `carlightv1/add/BleBroadcastProcessorV1`,
`homelightv1/add/BleBroadcastProcessor`) are registered via `BleProcessorManager`; they
match advertisements to SKU and trigger the BLE/AP connect dialogs. No
sensor telemetry payload is parsed in this split.

### 7.3 Group / multi-device

`BleCommGroup`, `BleMultiCommGroup`, `GroupBle`, `GroupOp` (carlightv1, stringlightv2)
implement group writes: group `g()=3`, secret-key check `SecretKeyController`,
response matching `frame[0]==0xAA && frame[1]==0x01 → frame[2]!=0`.
`stringlightv2/pact/GroupFactor*.java` register the group factor.

### 7.4 Matter / IR / RF / Thread

None in this split.

---

## 8. Dynamic effects — exact payload layouts

### 8.1 Colour (`sub_mode 0x02` / `0x0D`)

```
02 R G B flag R2 G2 B2          (8 bytes; h6159, h613839, h6160, h6165, h6181, h6182,
                                 h6113, h6114, h6104, h6101)
0D R G B kHi kLo R2 G2 B2       (9 bytes; h6159/h613839 BK, carlightv1, homelightv1,
                                 tvlightv1, rgblight h6188, stringlightv2)
02 R G B 00 00 00 00            (8 bytes; h7310/h7317, h7318)
```

* `flag` (byte 4) = 1 when the request is a colour-temperature request; then `R2G2B2`
  carries the temperature RGB and `R G B` may be `FF FF FF` (h6159 sets `setRgb(-1)`).
* `kHi kLo` = kelvin, **big-endian** (`BleUtil.getSignedBytesFor2(k, true)`).
* `R2G2B2` is the background/second zone colour (or temperature colour).
* Segment variant (h6160 only): `0B R G B maskLo maskHi 00 00`, 15 segments,
  bit *n* = segment *n* enabled.

Parse mirrors write: `[0..2]=RGB`, `[3]=flag` (or `[3..4]=kelvin` for 9-byte), rest = bg RGB.
`SubModeColor.parse` clamps nothing; `SubModeColor4Bk.parse` treats `a=-1` as "temp mode".

### 8.2 Music

| Family | submode | Payload | Fields |
|---|---|---|---|
| h6159/h613839/h6113/h6114/h6160/h6182 | `0x03` | `03 auto sens [R G B]` | `auto` 0=manual/colour(3 B) 1=auto(6 B); `sens` 0..99 |
| h6101/h6104/h6160(V1)/h7318 | `0x01` | `01 effect sens [R G B]` | effect ids: h6101/h6104 0=energic,1=spectrum,2=rolling,3=rhythm; h7318 4=soft,5=power |
| h6159/h613839/h6160(RGB)/carlightv1 | `0x0E` | `0E effect sens auto [R G B]` | V1 music, `auto` inverted (`0` when auto) |
| homelightv1 | `0x0F` | `0F effect sens param auto [R G B]` | |
| stringlightv2 old | `0x0E` | `0E effect sens auto [R G B]` | |
| stringlightv2 new / carlightv1 new | `0x13` | `13 effect sens param auto [R G B]` | 8-byte new music |
| h6165 | `0x05` | `05 00 flag` (mic on/off) | |
| h7310/h7317 | `0x05` | `05 01` | |
| stringlightv2 H6192 mic | `0x05` | `05` (single byte) | `SubModeMicH6192` |

`SubModeMusicV2` (h6159/h613839) has two encodings under `0x0E`:
`{0E musicCode sens}` when `musicCode ∈ AbsNewMusicEffect.newMusicCode4RgbList`, else the
legacy `{0E auto sens manualFlag R G B}` form.

### 8.3 Scenes (`sub_mode 0x04`)

```
04 <effect lo> <effect hi>     ; 2-byte little-endian (h6159, h613839, h6160, carlightv1,
                               ; stringlightv2, h6188, rgblight)
04 <effect>                    ; 1-byte (h6104, h6114, h6181, h6182, h7318, h7310/h7317,
                               ; homelightv1)
A1 <effect>                    ; h7308 group (sub_mode_scenes = -95 / 0xA1)
```

Effect ID tables found in the split (id = wire value):

| Table | IDs → meaning |
|---|---|
| h6159 / h6160 v0 (`ScenesV0`) | 0 gradual(gm), 1 sunset, 4 film, 5 dating, 7 romantic, 8 blinking, 9 colour-loop(cl), 10 breath |
| h6160 v1 (`Scenes4H6160v1`) | above + 15 snow |
| h6104 (`Scenes4BleRhythm`) | 0,1,4,5,7,8,9,15(snow) |
| h613839 (`ScenesV0`) | 4,5,7,8,9,16(dynamic),10 |
| carlightv1 (`ScenesV0`) | 4,5,7,8,9,10,16 |
| h6182/h7318/h6114 (`Scenes4H6182`/`Scenes4H7318`) | 4,5,9,7,10,8,16 |
| homelightv1 (`ScenesV0`) | 4,5,13(reading),23(brightness),24(aurora),9,16,7,17(fade),26(sleep) |
| H6188 (`Scenes4H6188`) | 4,5,13,23,24,9,16,7,17 |
| H6085/86/89 (`Scenes4H60858669`) | 13,17,10,7,20,16,18,19 |
| H7308 (`Scenes4H7308`) | 20 combination, 21 in-waves, 22 sequential, 23 slow-glow, 24 chasing, 25 slow-fade, 26 twinkle, 27 steady-on |

Sub-mode constants in the family `BleProtocol.java` also give names for
0=gm, 1=sunset, 4=film, 5=date/dating, 7=romantic, 8=blinking, 9=cl, 10=breath,
13=read, 15=snow, 16=dynamic, 17=fade, 18=forest, 19=fantasy, 20=heartbeat,
23=brightness, 24=aurora, 26=sleep.

### 8.4 DIY

**Single-packet DIY activation** (`sub_mode 0x0A`):

```
0A <diyCode lo> <diyCode hi>      ; 2-byte LE for all families
```
Parse: `diyCode = LE16(bytes[0..1])`.

**Multi-packet DIY body** (`proType 0xA5`, `cmdType 0x02`; `AbsMultipleController4Diy` /
`MultipleDiyController`):

```
value = [0] diyCode
        [1] effect            (DiyProtocol.c())
        [2] subEffect         (DiyProtocol.f())
        [3] speed             (DiyProtocol.e())
        [4] colorBytesLen = 3*N
        [5 .. 5+3N)  R,G,B triples (N colour points)
        [5+3N] groupBytesLen = 2*M
        [6+3N .. 6+3N+2M) (effect, subEffect) pairs   (only when effect == 255)
```

Packetisation (`MultipleControllerComm.makeWriteMultipleBytes`, `AbsMultipleController`
`getProType()=0xA5` write / `0xA4` read, `p()=0`):

```
start  : A5 02 00 <packCount> 00 ...            (payload [0]=0,[1]=packs,[2]=p())
data i : A5 02 <i> <16 bytes> ...               (i = 1..packCount)
end    : A5 02 FF ...
```

**DIY on scenes/`pt`/`ptReal`**: multiple `0xA5`/`0xA3` packets followed by
`0x05/0A <code>` mode frame, all sent as one `pt.value` / `ptReal.command` list
(`CmdPt.getDiyPtotocol`, `CmdPt.getDiyStudioCmdPt`, `const` in `…/h6159/iot/CmdPt.java`,
`…/stringlightv2/iot/CmdPt.java`).

**H6085/86/89 DIY over IoT** (`CmdDiy`): `cmd:"mode"`, `data{mode:10, code, color:[{red,green,blue}], effect, subEff, speed, effArr:[{effect,subEff}]}`.

### 8.5 Multi-packet scenes / effect blobs (`0xA3`)

New scenes are sent as a raw base64 effect blob from the effect library
(`ScenesRgb`, `ScenesRgbIC`, `ScenesGraffiti`, `ScenesCube`, `ScenesCompose`,
`ScenesH610B`, `ScenesH6057Graffiti`, `ScenesH60B0` in
`decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/`), decoded by
`ScenesOp.parseScene`/`parseEffect` into an `AbsMultipleControllerV14Scenes` whose
`getValue()` is the blob.

Command type by effect family (`MultiNewScenesControllerV1..V10`):

| controller | cmdType | Effect family |
|---|---|---|
| `MultiNewScenesControllerV1` | `0x01` | RGB multi-layer (ScenesRgb) |
| `MultiNewScenesControllerV2` | `0x02` | RGBIC (ScenesRgbIC) |
| `MultiNewScenesControllerV3` | `0x07` | graffiti (ScenesGraffiti) |
| `MultiNewScenesControllerV4` | `0x04` | cube / motion (ScenesCube; x,y,speed,direction) |
| `MultiNewScenesControllerV5` | `0x0A` | composition (ScenesCompose) |
| `MultiNewScenesControllerV6` | `0x06` | H610B |
| `MultiNewScenesControllerV7` | `0x07` | H6078 graffiti (with offset 3 or 9) |
| `MultiNewScenesControllerV8` | `0x08` | H6092 (offset 11) |
| `MultiNewScenesControllerV9` | `0x09` | dynamic API |
| `MultiNewScenesControllerV10` | `0x0A` | H6022/H1630 graffiti |

Packetisation (`MultipleControllerCommV1.makeWriteMultipleBytes(controller)` when
`p()==1` → `makeSendBytesV1(0xA3, cmdType, value)`):

```
start : A3 00 01 <packCount> <cmdType> <bigNum> <curBigNum+1> <8B verify> <first 4 bytes of value>
data i: A3 <i> <17 bytes>
end   : A3 FF <last ≤17 bytes>
```

`verify` = 8 bytes derived from `System.currentTimeMillis()` (`BleUtils.getSignedBytesFor6`)
with two randomised bytes. `bigNum`/`curBigNum` are 1-based multi-block indices
(`MultipleControllerCommV1.N()`); `packCount` at `[3]` is the small-packet count +1.

After the blob the device is switched to the scene via
`0x05/04 <effect LE16>` (or `A1` for H7308).

**Effect attributes** carried by `AbsMultipleControllerV14Scenes`:
`scenesCode`, `effectBytes`, `direction`, `x`, `y`, `speed`, `musicCode` (default 255),
`musicSwitch`, optional `focusParams` (4 bytes for cube "focus" directions).
Direction byte values (`BleProtocolConstants.directionBytes`):
2 up, 1 down, 4 left, 3 right, 5 in, 6 out, 8 max→min, 7 min→max, 10 CW, 9 CCW,
11 diagonal up/down stretch, 12 diagonal left/right stretch, 13 diagonal spread-stretch,
14 up/down stretch, 15 left/right stretch, 16 spread-stretch, 17 physical stretch,
18 all, 19 loop-in, 20 loop-out. Focus: 5/6/13/16; H6063 focus 10/9; loop flow 19/20.

### 8.6 Multi new music (`0xA3/0x41`)

`MultipleController4Music` (`getProType 0xA3`, `getCommandType 0x41`, `p()` = sub-code):

```
value = [effect] [sensitivity] [param] [manualFlag] [R G B]
```
`SubModeMusicMultiV1` (`0x0E`) → `{0E effect sens auto [R G B]}`,
`SubModeMusicMultiV2` (`0x13`) → `{13 effect sens 00 auto [R G B]}`.
Packetised with `makeSendBytesV2` (start `A3 00 01 <count> 41 <p>…`, data, end `A3 FF …`).

### 8.7 Carousel / motion / gradient / layer counts

* **Gradient / layer multi-colour**: h6160 `SubModeColorV1` (15 segments) is the only
  segment-mask gradient in this split; other "layer" effects (gradient, multi-layer,
  motion, carousel) are delivered as pre-baked effect blobs under `0xA3` (§8.5) or
  `0x0A` mode ids, not as explicit per-layer byte arrays.
* **Motion/cube** attributes are exactly `x`, `y`, `speed`, `direction`, `focusParams`
  inside `MultiNewScenesControllerV4` (§8.5).
* **Carousel** (`0x5F/0x60/0x61`, `0x62`) and `0x54 movie feast` exist only as constants
  in `BleProtocolConstants`; no builder in this split emits them.

---

## 9. Source map (paths traced)

Family BLE cores:

```
jadx-splits/split_pact_rgblight/sources/com/govee/h6159/ble/{BleProtocol,BleComm,Ble,Mode,ModeController,SubModeColor,SubModeColor4Bk,SubModeMusic,SubModeMusicV1,SubModeMusicV2,SubModeNewDiy,SubModeScenes,ParamsSubMode4Music,MultipleBleComm,BleReadManager,BleNotifyComm,WifiNotifyParse}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h613839/ble/{BleProtocol,BleComm,Ble,Mode,ModeController,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6160/ble/{BleProtocol,BleComm,Ble,Mode,ModeController,SubMode*,v1/*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6165/ble/{BleProtocol,Ble,MicController,Mode,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6181/ble/{BleProtocol,Ble,Mode,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6182/ble/{BleProtocol,Ble,Mode,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6113/ble/{BleProtocol,Ble,Mode,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6114/ble/{BleProtocol,Ble,Mode,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6101/ble/{BleProtocol,BleComm,Mode,SubModeVideo,SubModeMusic,SubModeColor,CalibrationController,CalibrationOkController}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6104/ble/{BleProtocol,BleComm,MultipleBleComm,Mode,SubMode*,DirectionController,IPController,BleReadManager,BleNotifyComm}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h7004/ble/{BleProtocol,BleComm,Mode,RedBlueController,SubModeRedBlue*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h7017/ble/{BleProtocol,BleComm,H7017Ble}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h73101217/{ble/*,adjust/SubMode*,adjust/H731*SubModeScenes}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h7318/{ble/*,adjust/SubMode*,adjust/H7318SubModeScenes}.java
jadx-splits/split_pact_rgblight/sources/com/govee/tvlightv1/ble/{BleProtocol,Mode,ModeController,SubModeColor,SubModeNewDiy}.java
jadx-splits/split_pact_rgblight/sources/com/govee/carlightv1/ble/{BleProtocol,BleComm,Ble,Mode,ModeController,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/homelightv1/ble/{BleProtocol,BleComm,Ble,Mode,ModeController,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/rgblight/ble/{Ble,BleComm,BleMultiComm,BleNotifyComm}.java
jadx-splits/split_pact_rgblight/sources/com/govee/rgblight/h7308/H7308BleProtocol.java
jadx-splits/split_pact_rgblight/sources/com/govee/rgblight/h6188/H6188BleProtocol.java
jadx-splits/split_pact_rgblight/sources/com/govee/rgblight/h7310/BleProtocol.java
jadx-splits/split_pact_rgblight/sources/com/govee/rgblight/h60858689/H60858689Protocol.java
jadx-splits/split_pact_rgblight/sources/com/govee/stringlightv2/ble/{BleProtocol,BleComm,Ble,Mode,ModeController,SubMode*,ParamsSubMode*,LimitController,OtaPrepareController,GroupOp}.java
```

Builder → Comm → controller chains:

```
…/h6159/scenes/Common.java, …/h613839/sku/Comm.java, …/h6160/scenes/Common.java,
…/h6104/scenes/Common.java, …/h6113|h6114|h6181|h6182|h6165|h7318/scenes/Common.java,
…/carlightv1/pact/Comm.java, …/homelightv1/pact/Comm.java,
…/stringlightv2/pact/Comm.java, …/tvlightv1/pact/Comm.java,
…/h73101217/sku/Comm.java, …/tvlightv1/pact/AbsEffectOp4Ble.java,
…/carlightv1/pact/ble/AbsEffectOp4Ble.java, …/homelightv1/pact/AbsEffectOp4BleIot.java,
…/stringlightv2/pact/bleiot/AbsEffectOp4BleIot.java,
…/rgblight/ble/Ble.java, …/stringlightv2/ble/Ble.java
```

IoT:

```
…/h6104/iot/{Cmd,CmdBrightness,CmdColor,CmdColorTem,CmdTurn,CmdTimer,CmdDirection,CmdIP,CmdCalibrationPoints,CmdCalibrationSnapshot,CmdStatusV0,IotManager}.java
…/h6159/iot/{Cmd,CmdBrightness,CmdColor,CmdColorTem,CmdColorWc,CmdTurn,CmdTimer,CmdTimerV1,CmdPt,CmdPtReal,CmdStatusV0,IotManager,Op*Dialog4BleIot*}.java
…/h6160/iot/{Cmd*,Op*}.java      …/h6182/iot/{Cmd*,Op*}.java
…/homelightv1/iot/{Cmd,CmdStatus,CmdStatusV0,CmdPt,ResultPt,Op*}.java
…/stringlightv2/iot/{Cmd,CmdStatus,CmdStatusV1,CmdPt,CmdPtReal,ResultPtV1,Op*}.java
…/rgblight/h60858689/iot/{CmdColorTem,CmdDiy,CmdScenes,Op*}.java
…/rgblight/h60858689/H60858689IotV1ParseHelper.java, …/pact/{AbsEffectOp4Iot,EffectOp4Iot,DeviceSetting}.java
jadx-base: com/govee/base2light/ble/controller/{AbsSingleController,AbsModeController,AbsMode,AbsMultipleController,AbsMultipleControllerV1,V2,V3,AbsMultipleController4Diy,AbsMultipleControllerV14Scenes,MultipleDiyController,MultipleController4Music,BleProtocolConstants}.java
jadx-base: com/govee/base2light/ble/comm/{MultipleControllerComm,MultipleControllerCommV1,MultipleBleBytes,AbsNotify,AbsNotifyParse}.java
jadx-base: com/govee/base2light/ble/{ScenesOp,ScenesRgb,ScenesRgbIC,ScenesGraffiti,ScenesCube,ScenesCompose,ScenesH610B}.java
jadx-base: com/govee/base2kt/utils/BleUtils.java (generate20Bytes, BCC, LE/BE helpers)
```

SKU/support map:

```
…/*/sku/{Sku,SubLib,SubMaker,Register4Item,Support}.java
…/carlightv1/pact/{Support,SubLib,SubMaker}.java
…/homelightv1/pact/{Support,SubLib,SubMaker}.java
…/stringlightv2/pact/{Support,SubLib,SubLib4BleIot,SubMaker,Register4Item}.java
…/stringlightv2/Support4StringLightV2.java
…/h6159/Support4H6159.java, …/h613839/Support4H613839.java, …/h6160/H6160Support.java,
…/h6113/H6113Support.java, …/h6181/H6181Support.java, …/carlightv1/Support4CarLight.java,
…/tvlightv1/SupportH6179.java
…/rgblight/Support.java, …/rgblight/RgbLightRegistry.java,
…/rgblight/h7308/H7308Config.java, …/rgblight/h7310/H7310Config.java,
…/rgblight/h7318/H7318Config.java, …/rgblight/h6165/H6165Config.java,
…/rgblight/h60858689/H60858689Config.java, …/rgblight/add/{SubLib,SubLibBle,OldBleSubLib,OldIotSubLib,SubMaker}.java
```

---

## 10. Gaps / unknowns

1. **Effect blob contents (`0xA3` multi-scene) are not enumerable statically.**
   `ScenesOp` decodes base64 strings supplied by the effect library
   (`ScenesRgb` / `ScenesRgbIC` / `ScenesGraffiti` / `ScenesCube` / `ScenesCompose` /
   `ScenesH610B`), which are populated from assets/config at runtime. The packet framing
   and per-effect attributes (x, y, speed, direction, focus) are known; the raw blob bytes
   are not in the split.
2. **H7004 / H7017** only have the `0x0D` red/blue-ratio controller in this split.
   `Mode.a(goodsType,pactCode)` selects `SubModeRedBlue41/61/81` but `getWriteBytes()`
   returns `null`; the actual value write is `RedBlueController(ratio, reserved)` whose
   second byte is unset by all callers here. Detail UI/builder lives outside this split.
3. **Direction byte semantics** come from `BleProtocolConstants` (base app) and are shared;
   `h6104` writes one raw byte (`0x13`) and no per-family remap was found. Mapping of
   UI names to bytes for the car/TV lights is therefore generic.
4. **Transport is pact/goodsType dependent for `stringlightv2`.** The SKU list is known,
   but goodsType (1/40/108 = ble+iot vs 2/39/68/78/143 = ble) is a device property read at
   runtime; per-SKU goodsType is not encoded in this split.
5. **H6138/H6139 and other `NewRgb2TL4BleIot` SKUs** are classified ble+iot by the shared
   `h6159` IoT builders and `Ble.u()` ptReal override, but their own modules only ship BLE
   `EffectOp4Ble` (`supportWifi()==false`, `getRoomOp4Iot()==null`). The cloud path is
   exercised through the shared `ptReal`/`pt` commands.
6. **H6182** has an `iot/` package and `OpColorCommDialog4BleIot` but no `CmdPtReal`; only
   direct JSON commands were observed.
7. **`SubModeMusicV2` new music codes** (`AbsNewMusicEffect.newMusicCode4RgbList`) are a
   runtime list; encoding differs per code (`0E code sens` vs legacy form). Exact code
   set is not in the split.
8. **Notify parsing beyond `0x11`**: only WiFi-connect status is registered by
   `BleNotifyComm` in every family; other notify types in `BleProtocolConstants` are not
   handled in this split.
9. **Calibration for H6104** is IoT-only (`calibrationPoints`, `calibrationSnapshot`);
   no BLE calibration opcode other than H6101's `0x08`.
10. **`ptUrl` / `multiSync` / OTA** are not implemented in this split (only
    `0xEE` OTA-prepare handshake for h6160/stringlightv2).


---

<!-- split_pact_security_health -->

# split_pact_security_health — security, baby monitor, scale, jump rope, health

Source root: `decompiled/jadx-splits/split_pact_security_health/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

---

## 1. Overview / family and SKUs

The module is a **bundle of unrelated product families** sharing only the app shell.
Only one sub-family uses the Govee 20-byte frame (H5026 pairing); the others use a
third-party BLE SDK, a native jump-rope stack, or cloud JSON/REST.

| sub-module | SKU(s) | goodsType | kind | transport |
|---|---|---|---|---|
| `h5026` | H5026 | not in split (Sku only) | AI motion/security sensor + alarm | REST + cloud push; BLE pairing only |
| `doorbell` / `h721214` | H7212, H7214 | not in split | baby monitor / doorbell camera | **IoT JSON** (V1) over MQTT-style topic |
| `scalev1` | H5010 | not in split | body-fat scale | **Qingniu (QN) BLE SDK** |
| `skipv1` | H5020 | not in split | smart jump rope | **native Govee BLE** (`com.govee.ble`) + REST history |
| `h721214/sku` `Model4WithTH` | H7212/H7214 + TH child | — | baby monitor with temp/hum sensor | cloud status |
| `security_health` | module R/UI only | — | aggregator | — |

`SkuH5026.needBle()` returns `false`; `SkuH7212/SkuH7214.needBle()` return `false`;
`ScaleSkuItem` extends `AbsBleSku`; `SkuH5020` is registered through the legacy
`ScanEventV1.SkipDevice` path.

---

## 2. Transports & GATT UUIDs

### 2.1 H5026 (pairing only)

`h5026/add/BleComm.java`:

| item | value |
|---|---|
| service | `494E5445-4C4C-495F-524F-434B535F4857` |
| characteristic | `494E5445-4C4C-495F-524F-434B535F2011` |

`BleNotifyComm` only registers `WifiNotifyParse`; there is no command builder. Runtime
control is REST (see 5.1).

### 2.2 H7212 / H7214

No BLE at runtime (`needBle() == false`). The device connects to the cloud and the app
talks to an IoT topic through `com.govee.base2home.iot.Iot`.

### 2.3 H5010 scale

Third-party **Qingniu** SDK (`com.qn.device.out.QNBleApi`). UUIDs, advertisement and
weight/body-composition frames are inside the closed SDK, not in the decompiled app
(`scalev1/manager/QNBleApiCreator`, `ScaleApi`). The app receives `QNScaleData`,
`QNScaleStoreData`, `QNBleDevice`, `QNBleBroadcastDevice`.

### 2.4 H5020 jump rope

Native Govee BLE: `com.govee.ble.BleController` plus `ScanEventV1.SkipDevice`
`{name, type, subType, communicationType, macAddr, services, rssi}`. The scan callback
synthesises `H5020_<mac[10..12]><mac[-2:]>` as the device name. No UUID or frame layout
is exposed in Java.

---

## 3. BLE command table

### 3.1 H5020 jump rope

No Java-level frame builder. The device is discovered by name prefix `H5020_`, then
`ConnectDialog` binds it and the native stack streams session records. The app-side
record model is:

| field | meaning |
|---|---|
| `skipNum` | total jumps |
| `spendTime` | seconds |
| `skipType` | free / countdown / 321 / reciprocal |
| `tripRope` | trip count |
| `averageFrequency` | jumps/min |
| `fastestFrequency` | max jumps/min |
| `maxJumps` | longest unbroken set |
| `ripRopeList` / `ripRopes` | per-interval `{num, spendTime}` |
| `calories`, `caloriesRate` | kcal |
| `time`, `createTime` | epoch ms |

Sources: `skipv1/db/Skip.java`, `adjust/history/SkipData.java`, `adjust/DetailAc.java`.

### 3.2 H5010 scale

The QN SDK emits weight and body composition; the app’s `ScaleApi.WeithingModel`
holds `{ScaleDevice, QNScaleData, ScaleStatus, weight -1.0, connected}`. Mode/units are
set through `QNConfig`, `QNUser`, `QNScaleDataListener`. No raw Govee opcodes.

### 3.3 H5026

No runtime frame; `scenes/DefenseCmdBuilder` issues a REST `RequestDefend` instead.

---

## 4. BLE notifications / readings

### 4.1 H7212 / H7214 (cloud status)

`ResultStatus` (`@SerializedName` names are the wire keys):

| key | field | unit/range |
|---|---|---|
| `bat` | battery | 1–100 |
| `bri` | brightness | 1–100 |
| `hum` | humidity | %RH |
| `lig` | night light on | 0/1 |
| `lulVer` | lullaby song version | string |
| `lul` | lullaby state | `ResultLullaby` |
| `cnt` | sensor connected | 0/1 |
| `set` | settings | `ResultSetting` |
| `spvol` | speaker volume | 1–100 |
| `sta` | power state | 0/1 |
| `tmp` | temperature | °C |
| `ip`, `port` | WebSocket call endpoint | string/int |

`ResultSetting`: `minT`/`maxT` (°C), `minH`/`maxH` (%RH), `stv` (sound sensitivity
0–2), `mstv` (motion sensitivity 0–2).
`ResultLullaby`: `sId` song, `vol` 1–100, `dly` current delay, `sdly` setting delay,
`loop` 0–2, `pl` playing.
`ResultOnline`: `cnt`, `tmp`, `hum`, `minT/maxT`, `minH/maxH`.
`ResultNightLight`: `lig`, `bri`.
`ResultListen`: `spvol`. `ResultWifiMac`: `wifiMac`.

Sub-device `SensorInfo`: `{sku, device, tem (×100), hum (×100), maxTem=6000,
minTem=-2000, maxHum=10000, minHum=0, isOpen, isOffline}`.

### 4.2 H5026 (REST)

`ResponseDetail.Data`:
`{address, bleName, armingState, defendingRemainTime, clearTime, online,
heartIntervalTime, wifiMac, versionSoft, versionHard, schedules[], alarmRecords[]}`.
`Warning`: `{messageId, alarmTime, time, warnMessage, imgUrl[] (Img{imgId,url})}`.
`Setting`: `{address, aiHint, angle, bleName, device, deviceName, enableAI,
heartIntervalTime, versionHard, versionSoft, wifiMac}`.

### 4.3 H5010 / H5020

QN SDK provides weight, body-fat %, BMI, muscle, water, bone, BMR, visceral fat,
body age, etc. (`scalev1/adjust/analysis`, `adjust/chart`, `adjust/fitbit`).
Jump rope readings are listed in 3.1.

---

## 5. IoT commands + status schema

### 5.1 H5026 security sensor (REST + push)

| action | request | response | source |
|---|---|---|---|
| arm/disarm | `RequestDefend {sku, device, armingState 0|1}` | `ResponseDefend.Data {armingState, defendingRemainTime ms}` | `detail/RequestDefend.java`, `ResponseDefend.java`, `sku/DefendCommDialog.java` |
| detail | `RequestDetail {sku, device}` | `ResponseDetail.Data` (above) | `detail/RequestDetail.java` |
| warning list | `RequestWarning {sku, device, time, limit, type}` (type 0 latest / 1 list) | `ResponseWarning {data:[Warning]}` | `detail/RequestWarning.java` |
| settings get/set | `RequestSetting {sku, device, type}` | `ResponseSetting` (`Setting`) | `setting/RequestSetting.java` |
| image status | `RequestImgStatus` | `ResponseImgStatus` | `detail/RequestImgStatus.java` |
| AI / angle / name | `RequestAi`, `RequestAngle`, `RequestDeviceName` | setting response | `setting/*` |

Constant strings `armingState` and `online` exist in `h5026/sku/Cmd.java` but the
implementation uses REST. Push: `H5026Push`, `EventWarningPush`, types
`warning`, `online`, `SensorOffline`.

### 5.2 H7212 / H7214 baby monitor (IoT V1)

`communication/Cmd` lists the wire command names:

| cmd | data | meaning |
|---|---|---|
| `turn` | `{val:0|1}` | power |
| `brightness` | `{val:1..100}` | night-light brightness |
| `nightLight` | `{val:0|1}` | night light |
| `volume` | `{val:1..100}` | speaker volume (1-based) |
| `speakVol` | `{val}` | talk-back volume |
| `delayClose` | `{val}` | lullaby sleep timer |
| `loop` | `{val:0..2}` | lullaby loop mode |
| `play` | `{val:0|1, songId}` | lullaby play/pause |
| `lullaby` | read | lullaby state |
| `listen` | `{sku, device, cmd, clientID, status, time}` | start/stop listen |
| `speak` | `{sku, device, cmd, clientID, time}` | start/stop talk |
| `socket` | `{callId, ip, port}` | WebSocket call endpoint |
| `sensitivity` | `{val:0..2}` | sound sensitivity |
| `moveStv` | `{val:0..2}` | motion sensitivity |
| `tmpAlert` | `{minT, maxT}` | temperature alert |
| `humAlert` | `{minH, maxH}` | humidity alert |
| `setting` | `ResultSetting` | thresholds/sensitivity |
| `status` | — | full `ResultStatus` |
| `online` / `IoTConnected` | — | connectivity |
| `wifiMac` | — | WiFi MAC |

Requests are sent via `EventSendCmd.sendIotCmd(sku, device, AbsCmd, isRead)` and
`IotManager`; responses are `CmdResult {cmd, sku, device, transaction, state}` parsed
by `CmdResult.parseResult()` (JADX stub).

---

## 6. Other protocols

- **REST**: H5026 (`/device/...` via `UrlConstants`), H5020 history upload
  (`ISkipNet.uploadSkipData`), H5010 weight history (`scalev1/net`), H7212/4 detail and
  lullaby list.
- **Push**: `H5026Push`, `EventWarningPush`; `H721214Push` (`SensorOffline`, alarm).
- **WebSocket/RTC**: H7212/H7214 two-way audio (`CmdWebsocket`, `listen/`).
- **Matter/Thread**: none.
- **BLE broadcast**: H5010 via QN SDK; H5020 native; H5026/H7212/4 none.

---

## 7. Dynamic effects / scenes / DIY

No light effects. Scene support is limited to:
- H5026 arm/disarm (`DefenseCmdBuilder`) as an automation action.
- H7212/H7214 lullaby playback (song id 0–N, volume, loop, delay) and night light
  brightness; songs are a cloud list (`net/LullabySongRequest`).
- H5010/H5020 no scenes.

---

## 8. Source map

| area | paths |
|---|---|
| H5026 | `h5026/sku/*`, `h5026/detail/*`, `h5026/setting/*`, `h5026/scenes/DefenseCmdBuilder.java`, `h5026/add/{Ble,BleComm,BleNotifyComm}.java`, `h5026/push/*` |
| H7212/H7214 | `doorbell/h721214/communication/*`, `doorbell/h721214/sku/*`, `doorbell/h721214/net/*`, `doorbell/h721214/listen/*`, `doorbell/h721214/lullaby/*` |
| H5010 | `scalev1/sku/*`, `scalev1/manager/ScaleApi.java`, `scalev1/adjust/*`, `scalev1/net/*` |
| H5020 | `skipv1/sku/*`, `skipv1/adjust/*`, `skipv1/db/*`, `skipv1/net/*` |
| module | `SecurityHealthModuleInitImpl.java`, `SkipV1ApplicationImp.java`, `H721214ApplicationImp.java`, `home/pact_security_health/R.java` |

---

## 9. Gaps / unknowns

- H5026 goodsType is not declared in the split (`SkuH5026` only has SKU and
  `needBle=false`); it comes from the product/cloud registry.
- H7212/H7214 goodsType is likewise absent; `H721214Constant` only lists SKU strings.
- H5010 and H5020 fully delegate BLE to closed SDKs (`com.qn.*` and
  `com.govee.ble.BleController`); no UUID, advertisement layout or frame opcode is
  recoverable from this split.
- `CmdResult.parseResult()` and `H5026` response beans are JADX-stubbed/partial, so the
  exact `state` JSON member names for a few commands are inferred from the
  `Result*` classes.
- H5020 session record byte layout is native; only the app-side `Skip`/`SkipData`
  fields are known.


---

<!-- split_pact_tcsocket -->

# split_pact_tcsocket — H5770 temperature-control socket

Source root: `decompiled/jadx-splits/split_pact_tcsocket/sources/`

---

## 1. Overview / family and SKUs

The module implements the **H5770 “temperature control socket / thermo socket”**: a
dual-outlet smart socket with a thermostatic controller, a bindable temperature /
humidity probe, schedules, alarms, a display and energy metering.

| SKU | goodsType | variants | transport | notes |
|---|---|---|---|---|
| H5770 | 405 | protocol beProtocol(1,1) | ble+iot | `Support.e = {405}`, `H5770Maker`; dual socket + thermo + probe |

`Support.c()` registers goodsType 405 with `GoodsType.beProtocol(1,1)`.
`H5770SubLib` uses item types `Item.D()` and keys from `Support.d()` = `{"405"}`.
`H5770Maker extends AbsBleWifiSku` and jumps to `H5770PairGuideActivity`.
No second SKU is registered in this split; all UI variants are feature/version gates
inside H5770 (`H5770Support` in the same package name is not present here — feature
gates are in `H5770SharedViewModel`/`H5770SocketUiPolicy`).

---

## 2. Transports & GATT UUIDs

The device uses the TX/GX message stack (`com.govee.ble`, `com.govee.mgr.gxmessage`),
not `AbsBleComm`:

| item | value |
|---|---|
| service | `494e5445-4c4c-495f-524f-434b535f4857` |
| write/self characteristic | `494e5445-4c4c-495f-524f-434b535f2014` |
| notify/chart characteristic | `494e5445-4c4c-495f-524f-434b535f2015` |
| frame | 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` |
| normal write | `0x33` |
| normal read | `0xAA` |
| multi write V1 | `0xA3` |
| multi read | `0xAC` |
| notify | `0xEE` |

`H5770ChartReadSkuSubVM` and `H5770ChartViewModel` also use service `…4857`,
characteristic `…2014` for writes and `…2015` for chart data notifications.

GX routing: every message is `Route.PreferBle(true)` — BLE is preferred, cloud is
the fallback. BLE frames are tunneled over IoT as `ptReal` (or `ptIot` when the
device’s OTA pacts say so, `H5770SharedViewModel.writeOtaInfo`).

---

## 3. BLE frame + command table

`H5770CommandTypeCons` (decimal → hex):

| const | dec | hex | role |
|---|---|---|---|
| b | -93 | `0xA3` | multi-write proType |
| c | 1 | `0x01` | switch |
| d | -84 | `0xAC` | multi-read proType |
| e | 1 | `0x01` | (multi-read inner cmd) |
| f | 15 | `0x0F` | schedule list read selector |
| g | 3 | `0x03` | full-info read selector |
| h | 20 | `0x14` | schedule write |
| i | -18 | `0xEE` | notify |
| j | 0 | `0x00` | heartbeat |
| k | 1 | `0x01` | switch |
| l | 2 | `0x02` | socket setting |
| m | 5 | `0x05` | mode |
| n | 8 | `0x08` | thermo bind |
| o | 9 | `0x09` | (reserved) |
| p | 21 | `0x15` | schedule delete |
| q | 16 | `0x10` | thermo realtime |
| r | 23 | `0x17` | abnormal state |
| s | 25 | `0x19` | device state |
| t | 36 | `0x24` | schedule running |
| u | 41 | `0x29` | fluctuation range |
| v | 38 | `0x26` | delay close |
| w | 30 | `0x1E` | temperature calibration |
| x | 31 | `0x1F` | common switch |
| y | 37 | `0x25` | auto-cooling delay |
| z | 22 | `0x16` | screen setting |
| A | 39 | `0x27` | alarm settings |

### 3.1 Command table

| command | op | payload | layout | source |
|---|---|---|---|---|
| master on/off | `0x33/0x01` | `10\|01` | bit0 = on, `0x10` = master op | `H5770SwitchCmd.d` |
| socket on/off | `0x33/0x01` | `(idx==0?0x20:0x40) \| (on?(idx==0?2:4):0)` | socket index 0/1 | `H5770SwitchCmd.e` |
| read switch | `0xAA/0x01` | – | `[0]` bit0 master, bit1 socket1, bit2 socket2 | `H5770SwitchCmd.l` |
| heartbeat read | `0xAA/0x00` | – | see §4.2 | `H5770HeartbeatCmd` |
| socket setting (thermo) | `0x33/0x02` | `01 type1 type2` | type 1=heat,2=cool (scene THERMO) | `H5770SocketSettingCmd.d` |
| socket setting (DIY humid) | `0x33/0x02` | `02 type1 type2` | type 1=humidify,2=dehumidify | same |
| read socket setting | `0xAA/0x02` | – | `[0..1]` thermo types, `[2..3]` DIY types | `H5770SocketSettingCmd.i` |
| mode write | `0x3A/0x05` | `01` / `02 gear temp` / `03 hum` | subcmd 1 manual/stop, 2 thermo, 3 DIY | `H5770ModeCmd.g/i/l` |
| read mode | `0xAA/0x05` | – | `[0]` subcmd | `H5770ModeCmd.t` |
| switch scene | `0x3A/0x05` | `01` / `02 FF FF FF` / `03 FF FF` | manual / thermo / DIY | `H5770ModeCmd.i` |
| delay close | `0x33/0x26` | `en minHi minLo` | en 0/1; minutes 0–1439 | `H5770DelayCloseCmd.l` |
| read delay close | `0xAA/0x26` | – | `[0]` en, `[1..2]` setMinutes, `[3..4]` remainSec | `H5770DelayCloseCmd.h` |
| device state | `0xAA/0x19` | – | see §4.1 | `H5770DeviceStateCmd` |
| common switch | `0x33/0x1F` | `01 on` / `02 on` | sub 1 = child lock, sub 2 = Fahrenheit | `H5770CommonSwitchCmd.m/n` |
| read common switch | `0xAA/0x1F` | – | `[0]` Fahrenheit, `[1]` child lock | `H5770CommonSwitchCmd.g` |
| screen setting | `0x33/0x16` | `en minutes flag` | minutes 1–10 | `H5770ScreenSettingCmd.j` |
| read screen | `0xAA/0x16` | – | `[0]` en, `[1]` minutes, `[2]` flag | `H5770ScreenSettingCmd.g` |
| auto-cooling delay | `0x33/0x25` | `en minutes` | minutes 1–10 | `H5770AutoCoolingDelayCmd.j` |
| read auto cooling | `0xAA/0x25` | – | `[0]` en, `[1]` minutes | `H5770AutoCoolingDelayCmd.g` |
| fluctuation range | `0x33/0x29` | `category indep idx lowBE16 highBE16` | category 1=temp, 2=humidity | `H5770FluctuationRangeCmd.d` |
| read fluctuation | `0xAA/0x29` | – | category `0xFF` = disabled | `H5770FluctuationRangeCmd.i` |
| temp calibration write | `0x33/0x1E` | `kind target signMagBE16` | kind 1=temp,2=hum; target 1=bound,2=device; value*10 | `H5770TempCalibrationCodec.a` |
| temp calibration read | `0xAA/0x1E` | `kind target` | reply same 4 bytes | `H5770TempCalibrationCmd.h` |
| thermo bind | `0x33/0x08` | `macRev6 supportsHum` | 6-byte MAC reversed + flag | `H5770ThermoBindCmd.u` |
| read thermo bind | `0xAA/0x08` | – | `[0..5]` MAC, `[6]` supportsHum | `H5770ThermoBindCmd.m` |
| thermo realtime | `0xAA/0x10` | – | see §4.4 | `H5770ThermoRealtimeCmd` |
| abnormal state | `0xAA/0x17` | – | bit0 overload, bit1 relay1, bit2 relay2 | `H5770AbnormalStateCmd.i` |
| clear abnormal | `0x33/0x17` | `01` | | `H5770AbnormalStateCmd.d` |
| alarm settings read | `0xAA/0x27` | – | see §4.5 | `H5770AlarmSettingsCmd.j` |
| alarm: temp | `0x33/0x27` | `01 en type temps…` | sub 1 | `H5770AlarmSettingsCmd.e` |
| alarm: power | `0x33/0x27` | `02 en wattsBE16 minutes` | sub 2; watts 100–1800, min 1–10 | `H5770AlarmSettingsCmd.d` |
| alarm: volume | `0x33/0x27` | `03 level` | sub 3; level 0–3 | `H5770AlarmSettingsCmd.f` |
| schedule write | `0xA3/0x14` | multi-packet | see §7 | `H5770ScheduleCmd.c` |
| schedule read | `0xAC/0x01` | `0F` | multi-read, 17-byte chunks | `H5770ScheduleCmd.f` |
| schedule delete | `0x33/0x15` | `index` | index 0–254 | `H5770ScheduleDeleteCmd.c` |
| schedule running read | `0xAA/0x24` | – | `[0]` index, `[1]` status | `H5770ScheduleRunningCmd.d` |
| schedule running end | `0x33/0x24` | `01` | | `H5770ScheduleRunningCmd.g` |
| full info read | `0xAC/0x01` | `03` | reply = [count, (cmd,len,payload)…] | `H5770FullInfoCmd.c/b` |

Chart transfers use the shared `base_h71xx` chart stack; this split pins only the
UUIDs (`…4857` / `…2014` write / `…2015` notify) and the record parsing. The exact
chart request opcodes are not redefined in the split.

### 3.2 Multi-packet rules

- Schedule write: `MultiController`/`MultipleControllerCommV1` with proType `0xA3`,
  cmdType `0x14`. Item bytes:
  `[nameLen][name UTF-8][index][enabled?0x80:0][startH][startM][endH][endM][repeat][mode 4 bytes]`.
  The first packet carries `[1, pageCount+1, 0x14]` plus the first ≤14 item bytes;
  subsequent packets are `[0xA3, pageIndex, 17 bytes]`; the last page goes out as
  `[0xA3, 0xFF, …]` / terminator.
- Schedule read / full-info read: `0xAC/0x01` with `BleMultipleReadHelper` and
  selectors `0x0F` (schedules) / `0x03` (full info), 17-byte chunks, 10 s timeout.

---

## 4. BLE notifications / readings

### 4.1 Device state (`0x19`)

```
[0]      status byte: bits0-1 scene (0 THERMO,1 DIY,2 MANUAL),
                     bits2-4 gear/run (0 idle,1 heating,2 cooling,3 heating,4 cooling,
                                      5 humidifying,6 dehumidifying)
[1..3]   todayRuntimeSec        BE24
[4..6]   todayKwh               BE24 / 10000
[7..8]   currentWorkingRuntimeMin BE16
[9..12]  lastStartTimestampSec  BE32
```
(`H5770DeviceStateCmd.e`; `H5770StatusMapping`.)

### 4.2 Heartbeat (`0x00`, 13+ bytes)

```
[0]      switch mask (master/socket1/socket2)
[1]      status byte (scene + gear/run bits)
[2..4]   target temperature/humidity: 24-bit fixed point
         temp: (value/10000)/10 °C ; humidity/DIY: (value%10000)/10 %
[5]      sensor offset minutes
[6..7]   target temperature BE16 / 10
[8..9]   ambient/current temperature BE16 / 10
[10]     running/status byte
[11..12] humidity BE16 / 10
```
(`H5770HeartbeatCmd.e`, `H5770AaPayload.l`.)

`0x7FFF` in a 16-bit field means “invalid/unavailable”. 24-bit `0x7FFFFF`/`0xFFFFFF`
mean invalid. A 24-bit field with the top bit set is negative (temperature offset).

### 4.3 Schedule running (`0x24`)

`[0]` schedule index, `[1]` raw status (1 = running). (`H5770ScheduleRunningCmd.d`.)

### 4.4 Thermo realtime (`0x10`)

```
[0..2]  bound sensor temperature: 24-bit, sign bit 23, (value/10000)/10 °C
[3]     sensor offset minutes (0xFF = none)
[4..5]  self temperature BE16 / 10 (0x7FFF = invalid)
[6..]   reserved
```
(`H5770ThermoRealtimeCmd.c/f/g`.) The same 24-bit decoder is used for humidity,
where `(value % 10000)/10` is the percentage.

### 4.5 Alarm settings (`0x27`, ≥15 bytes)

```
[0]      alarm volume 0..3
[1]      temp alarm enabled
[2]      temp alarm type 0=below,1=above,2=range
[3..4]   temp below      BE16 / 10 °F
[5..6]   temp above      BE16 / 10 °F
[7..8]   range low       BE16 / 10 °F
[9..10]  range high      BE16 / 10 °F
[11]     power alarm enabled
[12..13] power alarm watts BE16 (100..1800)
[14]     duration minutes (1..10)
```
(`H5770AlarmSettingsCmd.j`.) Internally the app stores Fahrenheit; the UI converts to
Celsius (`H5770AlarmSettingsMapper`).

### 4.6 Fluctuation range (`0x29`)

`[0]` category (0xFF disabled, 1 temp, 2 humidity), `[1]` independent control,
`[2]` independent socket index, `[3..4]` low BE16, `[5..6]` high BE16.
For category 1 the wire value is Fahrenheit (`*9/5` on write); category 2 is a raw
humidity percentage.

### 4.7 Full info (`0xAC/0x01` selector `03`)

Reply payload:

```
[0] itemCount
repeated: [cmd][payloadLen][payload…]
```
Each item is then re-dispatched as a synthetic `0xAA/<cmd>` frame
(`H5770Repository.dispatchFullInfoReply`). The count vs parsed mismatch is surfaced
as `truncated`.

---

## 5. IoT commands + status/readings schema

All BLE messages are GX messages with `Route.PreferBle(true)` and
`Payload.Companion.b(bytes)`; when routed to cloud they become:

| cmd | data | meaning |
|---|---|---|
| `ptReal` | `{"command":["<base64 20-byte frame>"]}` | tunnel the same BLE frame |
| `ptIot` | `{"command":["<base64 20-byte frame>"]}` | OTA/pact report path |
| `op` | `{"command":["<base64 20-byte frame>"]}` | device report frames |
| `status` | `{}` | status query (RTF via shared stack) |
| `online` | `{}` | presence |

Reading:
`H5770Repository.dispatchStatusCoreFrame` accepts a 20-byte frame and switches on
`frame[1]` (cmdType) for `0x01` switch, `0x02` socket setting, `0x05` mode,
`0x08` thermo bind, `0x10` thermo realtime, `0x16` screen, `0x17` abnormal,
`0x19` device state, `0x1E` calibration, `0x1F` common switch, `0x24` schedule
running, `0x25` auto cooling, `0x26` delay close, `0x27` alarms, `0x29` fluctuation.

Status schema (decoded):
```json
{
  "switch": {"master": true, "socket1": true, "socket2": false},
  "mode": {"scene": "THERMO|DIY|MANUAL", "gear": "STOP|AUTO|HEAT|COOL"},
  "targetTemp": 22.5,
  "targetHumidity": 45.0,
  "ambientTemp": 21.8,
  "humidity": 48.2,
  "todayRuntimeSec": 3600,
  "todayKwh": 0.4123,
  "currentWorkingRuntimeMin": 12,
  "lastStartTimestampSec": 1700000000,
  "thermo": {"bound": true, "mac": "AA:BB:CC:DD:EE:FF", "supportsHumidity": true},
  "alarms": {"volume":2,"temp":{"enabled":true,"type":"range","lowF":32,"highF":86},
             "power":{"enabled":true,"watts":1800,"minutes":4}},
  "scheduleRunning": {"index":1,"running":true}
}
```

Cloud-only features:
- **Work-mode cloud sync**: `H5770WorkModeCloudSync` posts
  `{"device": "...", "sku": "H5770", "workMode": 1|2|3}` through a generic settings
  endpoint to keep cloud/Alexa state aligned; `workMode` is the scene code
  (THERMO=2, DIY=3, MANUAL=1).
- **Email alarms**: `IH5770Net` (`/bff-app/v2/account/notification-emails`,
  `/bi/rest/v1/notification-emails`, `bff-app/v1/device/email-alert/bind-rel`,
  `/bff-app/v1/device/email-alert/list-rel`).

---

## 6. Other protocols

- **Cloud tunneling**: GX `Route.PreferBle(true)` + `IotForm.PtReal` / `PtIot`.
  No dedicated MQTT/LAN code in this split; cloud transport is the shared IoT stack.
- **Chart**: BLE chart transfer on service `…4857` char `…2015`, then upload via
  `/bff-app/v1/device/series-datas` and download links
  (`/bff-app/v1/device/data-tasks`, `/bff-app/v1/device/data-links`).
- **Thermo sensor binding**: BLE `0x08` with reversed MAC; the sensor itself is a
  separate Govee TH device, not controlled directly here.
- **OTA**: `0xAB/0x02`-style pact report through `ptReal`/`ptIot`
  (`H5770SharedViewModel.writeOtaInfo`).

---

## 7. Dynamic effects / schedules / scenes

H5770 has no light effects; its “modes” are HVAC scenes.

| scene | mode byte | write payload | attributes |
|---|---|---|---|
| MANUAL | 1 | `01` | manual relay, gear STOP |
| THERMO | 2 | `02 gear tempBE16` | gear 0 STOP,1 AUTO,2 HEAT,3 COOL; `temp` is 16-bit BE ×10 (F on wire) |
| DIY | 3 | `03 humidityBE16` | humidity ×10, percent |

Schedule item encoding (`H5770ScheduleItemCodec`):

```
[nameLen][name UTF-8 ≤20][index][enabled?0x80:0]
[startHour][startMinute][endHour][endMinute][repeatByte]
[mode 4 bytes]
mode: 01 switchMask 00 00  (manual)
      02 gear tempBE16     (thermo; AUTO requires target)
      03 humidityBE16 00   (DIY)
repeat: bit7 = enabled; bit0..6 = Mon..Sun (0x7F = every day, 0 = once)
```
Up to 5 schedules (`decodeScheduleList` truncates at 5).

Schedule runtime status: `0x24` reply `[index, running?1:0]`.

---

## 8. Source map

| area | paths |
|---|---|
| registry | `Support.java`, `SubMaker.java`, `h5770/pact/{H5770Maker,H5770BleIotInfo}.java`, `H5770SubLib`, `H5770RegisterItem` |
| command codecs | `h5770/ble/cmd/*.java` (Switch, SocketSetting, Mode, DelayClose, DeviceState, CommonSwitch, Screen, AutoCooling, Fluctuation, TempCalibration, ThermoBind, ThermoRealtime, Abnormal, AlarmSettings, Schedule, ScheduleDelete, ScheduleRunning, FullInfo, Heartbeat) |
| payload helpers | `h5770/utils/H5770AaPayload.java`, `h5770/ble/H5770TempCalibrationCodec.java`, `h5770/ble/H5770ScheduleItemCodec.java` |
| mapping | `h5770/utils/mapper/{H5770StatusMapping,H5770SocketTypeMapping,H5770HeartbeatProjection,H5770ModeProjection}.java` |
| repo/VM | `h5770/vm/H5770Repository.java`, `h5770/vm/H5770SharedViewModel.java`, `h5770/vm/read/*` |
| chart | `h5770/chart/*`, `h5770/chart/ble/H5770ChartReadSkuSubVM.java` |
| UI | `h5770/component/*`, `h5770/setting/*`, `h5770/schedule/*`, `h5770/widget/*` |
| net | `h5770/net/*` |

---

## 9. Gaps / unknowns

- `H5770Support` (feature/version gates) referenced by the H6630 split is **not**
  present in this split; H5770’s gates are inline in `H5770SharedViewModel` and
  policy classes.
- Chart BLE opcodes are inherited from `base_h71xx/chart_v2`; the split only fixes
  the UUIDs and the record parsing (`H5770ChartCons`). Exact chart request frames
  (`0xAC/0x03` etc.) are not redefined here.
- `H5770AaPayload` uses mixed endianness: 16/24-bit fields are big-endian, 32-bit
  timestamps/energy are read big-endian in some places and little-endian in others
  (`getSignedInt(..., true)` vs `false`). Treat ambiguous fields as runtime.
- The temperature unit on the wire for `THERMO` mode/schedules/alarms is Fahrenheit
  (`*9/5` conversions), while `DeviceState`/`Heartbeat` report Celsius. This is
  deliberate but easy to misread.
- No Matter or direct MQTT in this split.
- `H5770FullInfoCmd` re-dispatches synthetic `0xAA/<cmd>` frames; the exact set of
  items a given firmware includes is runtime-dependent.


---

<!-- split_pact_thnew -->

# split_pact_thnew — temperature / humidity sensors (H5042 … H5310)

Source root: `decompiled/jadx-splits/split_pact_thnew/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

---

## 1. Overview / family and SKUs

`thnew` is the consolidated app module for Govee thermo-hygrometers (including
gateway-attached sub-sensors and air-quality variants). SKUs are driven by
`ThDeviceProfiles` (goodsType → profile); legacy SKUs use `ThLegacySkuProfiles`.

| goodsType | SKU(s) | template / format | kind | transports |
|---|---|---|---|---|
| 66 | H5100 | COMMON_BLE_TH / COMMON | LCD TH | ble + iot |
| 106 | H5103 | WIFI_TH | WiFi TH | ble + iot (WiFi) |
| 154 | H5104 | COMMON_BLE_TH | TH | ble + iot |
| 190 | H5105 | COMMON_BLE_TH | TH | ble + iot |
| 194 | H5108 | COMMON_BLE_TH | fridge TH (humidity) | ble + iot |
| 8 | H5101, H5102, H5174, H5177 | COMMON_BLE_TH | TH | ble + iot |
| 287 | H5110 | COMMON_BLE_TH / WITH_THIRD | TH + 3rd probe | ble + iot |
| 310 | H5111 | COMMON_BLE_TH / DUAL_PROBE | dual probe | ble + iot |
| 7 | H5179 | WIFI_TH | WiFi TH | ble + iot (WiFi) |
| 14 | B5178 | COMMON_BLE_TH | TH | ble + iot |
| 320 | H5171 | COMMON_BLE_TH / DUAL_PROBE | TH + comfort | ble + iot |
| 407 | H5210 | COMMON_BLE_TH / H5220 | TH | ble + iot |
| 124 | H5053 | legacy + H5106 entry | TH | ble + iot |
| 319 | H5140 | CO2_TH | CO2 + TH | ble + iot (secret protocol) |
| 220 | H5107 | GW_NO_BLE_TH | gateway (no BLE) | iot / gateway |
| 199 | H5109 | GW_NO_BLE_TH | gateway (no BLE) | iot / gateway |
| 366 | H5310 | GW_NO_BLE_TH | gateway (no BLE) | iot / gateway |
| 330 | H5112, R5112 | DUAL_PROBE_TH | dual probe | ble + iot |
| 369 | H5220 | GW_SELF_BLE_TH | gateway + BLE TH | ble + iot / gateway |
| — | H5042, H5043, H5044, H5051, H5052, H5053, H5071, H5072, H5074, H5075 | legacy profiles | TH | ble (+iot if bound) |
| — | H5106 | THP_PM25 | PM2.5 + TH | ble + iot (WiFi) |
| — | H5112/R5112, H5220 | DUAL_PROBE / GW_SELF | weather / dual probe | ble + iot |
| — | H5151 | gateway host | gateway parent for H5112/H5220 sub-sensor binding | gateway |

`ThSkuMaker` also registers `ThSkuBindItem(124)`, `(330)`, `(369)` and every
`ThDeviceProfiles` / `ThSubDeviceProfiles` pair. `ThDeviceProfile` validates unique
goodsType, sku sets, resources and feature flags at startup.

---

## 2. Transports & GATT UUIDs

`ThCommConfig` (`comm/common/ThCommConfig.java`):

| item | value |
|---|---|
| main service | `494e5445-4c4c-495f-524f-434b535f4857` |
| main characteristic (`bleCharacteristicUuid`) | `494e5445-4c4c-495f-524f-434b535f2011` |
| chart data characteristic (`ThChartDataComm`) | `494e5445-4c4c-495f-524f-434b535f2012` (or `…2014` when `ThDeviceProfiles.d()==2`) |
| chart manager characteristic (`ThChartDataManager`) | `494e5445-4c4c-495f-524f-434b535f2013` (or `…2015`) |
| write proType | `0x33` |
| read proType | `0xAA` |
| packet | 20 bytes, `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` |

`ThCommConfig.b(goodsType,sku)` selects chart-data characteristic `…2012` (default) or
`…2014` when `ThDeviceProfiles.d(goodsType,sku) == 2`; `c()` selects `…2013` or `…2015`.
The main control characteristic is always `…2011`.

`AbsSingleController` (base2newth):
- write → `[0x33, cmd, payload]`; success when `value[2]==0`;
- read → `[0xAA, cmd, payload]`; if `value[0]==0xAB` the whole frame is passed to the
  parser, otherwise `frame[2..]` (17 bytes valid).

---

## 3. BLE command table

From `ble/controller/*.java` (`getCommandType`), all with proType `0x33`/`0xAA`.

| cmdType | function | write payload | read / parse | source |
|---|---|---|---|---|
| `0x01` | heart (V0/V1) / long-life | V0 heart multi; V1 `n()` | `Controller4HeartV0/V1`: temp/hum/battery, per-format | `Controller4HeartV0.java`, `Controller4HeartV1.java` |
| `0x02` | heart prepare / temp unit | none / `[unit]` | ack / read | `Controller4HeartPrepare.java`, `Controller4TemUnit.java` |
| `0x03` | humidity warning / stop send | `[enable, minLE16, maxLE16]` | same | `Controller4HumWarning.java` |
| `0x04` | temperature warning | `[enable, minLE16, maxLE16, delayMin]` | same | `Controller4TemWarning.java` |
| `0x05` | upload frequency / long-life | `[freq, ?]` | ack | `Controller4UploadFreq.java` |
| `0x06` | humidity calibration | signed LE16 (×100) | signed LE16 | `Controller4HumCali.java` |
| `0x07` | temperature calibration | signed LE16 (×100) | signed LE16 | `Controller4TemCali.java` |
| `0x08` | battery / low-batt / long-life / gateway warn | `[enable]` | `[0]=battery` | `Controller4Battery.java`, `Controller4SwitchLongLife*` |
| `0x0A` | heart V0 (legacy) | none | `[0..1] temp BE16, [2..3] hum BE16` | `Controller4HeartV0.java` |
| `0x0C` | device id | none | id bytes | `Controller4DeviceId.java` |
| `0x0D` | BLE hardware version | none | version bytes | `Controller4BleHv.java` |
| `0x0E` | BLE software version | none | version bytes | `Controller4BleSv.java` |
| `0x10` | time sync | 4-byte LE epoch + tz | ack | `Controller4SyncTime.java` |
| `0x11` | clear data / delete sub-device | none | ack | `Controller4ClearData.java`, `Controller4DeleteDevice.java` |
| `0x12` | display mode / check network | `[mode]` / `FF` | same | `Controller4Display.java` (18), `Controller4CheckNetwork.java` (`hex2Int("12")`) |
| `0x13` | lightness | `[level]` | same | `Controller4Lightness.java` (19) |
| `0x14` | clear sub-device data | none | ack | `Controller4ClearSubDevData.java` (20) |
| `0x16` | do-not-disturb / PM2.5 warning | `[enable, startH, startM, endH, endM]` / `[enable, minLE16, maxLE16]` | same | `Controller4CloseWarn.java` (22), `Controller4Pm25Warning.java` (22) |
| `0x17` | time format | `[format]` | same | `Controller4TimeFormat.java` (23) |
| `0x18` | upload last data | `[seconds]` | ack | `Controller4UploadLastData.java` (24) |
| `0x19` | lightness V2 | `[level]` | same | `Controller4LightnessV2.java` (25) |
| `0x1A` | multi trigger (goods 124/319/330/366/369) | raw frame | ack | `Controller4MultiTrigger.java` (26 for those goods, else 19) |
| `0x1B` | sound level | `[level]` | same | `Controller4SoundLevel.java` (27) |
| `0x1C` | CO2 manual calibration | `[valueLE16]` | ack | `ControllerCo2ManualCalibration.java` (28) |
| `0x1D` | CO2 grade thresholds | `[minLE16, maxLE16]` | same | `Controller4Co2SetGrade.java` (29) |
| `0x1E` | wurao / do-not-disturb mode | `[enable, …]` | same | `Controller4WuRaoMode.java` (30) |
| `0x1F` | air-quality notify / switch | `[enable]` | same | `ControllerAirNotify.java` (31), `Controller4AirQualitySwitch.java` (31) |
| `0x20` | WiFi hardware version | none | version | `Controller4WifiHv.java` |
| `0x21` | WiFi software version | none | version | `Controller4WifiSv.java` |
| `0x22` | temperature/humidity warning V1 / PM2.5 | `[enable, minLE16, maxLE16]` | same | `Controller4TemWarning4H5112`, `Controller4HumWarning4H5112` |
| `0x23` | close warn / gateway warn | `[enable]` | same | `Controller4GateWayWarn.java` |
| `0x24` | upload last data | `[seconds]` | ack | `Controller4UploadLastData.java` |
| `0x25` | lightness V2 | `[level]` | same | `Controller4LightnessV2.java` |
| `0x28` | CO2 manual calibration | `[valueLE16]` | ack | `ControllerCo2ManualCalibration.java` |
| `0x30` | volume | `[volume]` | same | `Controller4Volume.java` |
| `0x32` | probe icon / BLE type | `[icon]` | same | `Controller4ProbeIcon.java`, `Controller4BdType.java` |
| `0x35` | check net (H5112) | `FF` | ack | `Controller4CheckNet.java` |
| `0x34` | comfortable TH (H5171) | `[minTemLE16, maxTemLE16, minHumLE16, maxHumLE16]` | same | `h5171/Controller4ComfortTemHum.java` |
| `0x39` | specification (H5220) | `[spec]` | same | `h5220/Controller4Specification.java` |
| `0x36` | TH multi / sub-device trigger | empty | ack | `Controller4ThMulti.java` (54) |
| `0x37` | weather (H5220) | weather frame | same | `h5220/Controller4Weather.java` |
| `0x38` | update gateway weather | `[..]` | ack | `h5220/Controller4UpdateGwWeather.java` |
| `0x3A` | write-read | controller payload | 17-byte result | H71xx-class |
| `0x41` | time format (H5220) | `[format]` | same | `Controller4TimeFormat4H5220.java` |
| `0x70` | ptReal op (H5112) | `[command]` | ack | `Controller4PtRealOp.java` |
| `0xBD` | BLE device type | `[type]` | same | `Controller4BdType.java` |
| `0xFE` | secret key V0 | key bytes | ack | `Controller4SecretKeyV0.java` |
| `0x??` (g) | secret key V1 / WiFi MAC | key / none | ack / MAC | `Controller4SecretKeyV1.java`, `Controller4WifiMac.java` |
| `0x01`/`0x02` etc | heart timing | `[range]` | same | `Controller4HeartTimeRange.java` |

`Controller4MultiTrigger` returns `0x1A` for goodsType
`124/319/330/366/369` and `0x13` otherwise; used for `multiSync` payloads.

### 3.1 Warning payloads

`Controller4TemWarning` (`0x04`):
`[enable, minLE16, maxLE16, delayMinutes]`; ranges clamp to `-20…60 °C`
(or `-200…200 °C` when the probe supports high range).
`Controller4HumWarning` (`0x03`): `[enable, minLE16, maxLE16]`, 0…100 %RH
(stored ×100).
`Controller4Pm25Warning` (`0x1B`): `[enable, minLE16, maxLE16]`, 0…999 µg/m³.
`Controller4Co2Warning` (`0x1C`): `[enable, minLE16, maxLE16]`, 0…5000 ppm.
`DelayOff`/`DND` payloads follow the shared H71xx `NotDisturbInfo` layout.

### 3.2 Timer / multi-sync

`multiSync` and `ptReal` carry raw 20-byte frames built by the same controllers; for
goods 124/319/330/366/369 the trigger cmdType is `0x1A`, otherwise `0x13`
(`Controller4MultiTrigger`). `SettingOpManager`/`IotOpManager` wrap them in
`CmdPtReal` (`base2light/pact/iot/CmdPtReal`).

---

## 4. BLE notifications / readings

### 4.1 Heart formats

`Controller4HeartV1` dispatches by `ThDeviceProfiles.s(goodsType,sku)` →
`ThHeartDataFormat` (`COMMON`, `WITH_THIRD`, `DUAL_PROBE`, `H5220`):

| format | bytes | fields |
|---|---|---|
| COMMON | `[0..1]` temp int16 **big-endian**, `[2..3]` humidity int16 BE, `[4..5]` third probe temp int16 BE, `[6]` battery, `[7]` flags | `x()` |
| WITH_THIRD | `[0..1]` temp, `[2..3]` hum, `[4..5]` third temp, `[6]` battery, `[7]` bit0–5 probe connected / bit6–7 alarm | `v()` |
| DUAL_PROBE | `[0..1]` temp, `[2..3]` hum, `[4]` battery, `[5]` bit0 connected / bit1 alarm | `w()` |
| H5220 | `[0..1]` temp, `[2..3]` hum, `[4]` battery, `[5]` switch | `u()` |
| H5053 / legacy | `[0..1]` temp, `[2..3]` hum (V0) | `Controller4HeartV0` |

Units: temperature and humidity are signed 16-bit in **0.01 °C / 0.01 %RH**
(`ThProfessionGrade` divides by 100). `0xFFFF` = invalid/open probe (`-10000`).

### 4.2 Broadcast advertisement

Generic TH advert (62 bytes, Govee AD structure):

```
length, 0xFF, 0x01, 0x??, 0x??, then 7-byte TH block
```

`BleUtil.parseThBleValidBytePos()` locates `len>=6, AD=0xFF, 0x01, 0x??, 0x??`.
The 7-byte block (`ThBroadcastUtil.c/e/f/i`):

```
[0] flags / seq
[1..2] temperature + humidity packed  (parseThValue)
[3..5] packed temp/hum (3 bytes)
[6] battery
[7..] optional probe-2 / flags
```

`parseThValue(3 bytes)`:
`v = signed 24-bit BE`; `tem = (v/1000)*10`, `hum = (v%1000)*10`
(if the top bit is set the value is offset by +1000 before scaling).
Consumers store the values directly as 0.01 units (`ThProfessionGrade` divides by 100).

Per-product parsers:

| SKU group | parser | layout |
|---|---|---|
| H5051/H5052/H5053/H5071/H5072/H5074/H5075 | `H5072_75ThBroadParseImp`, `H51ThBroadParseImp` | 7-byte TH block |
| H5106 | `H5106ThBroadParseImp` | `parseThpValue(4 bytes)` → temp, hum, PM2.5 (expects 5 bytes, see gaps) |
| H5112/R5112 | `H5112ThBroadParseImp` | 9 bytes: temp/hum block + `[8]` packed probe2/battery |
| H5140 | `H5140ThBroadParseImp` | AD type `0x0B` length 11: `[0]=FF`, `[5..7]` TH, `[8..9]` CO2 BE16 |
| H5179 | `H5179ThBroadParseImp` | 9-byte TH block (len>=62) |
| multi-sensor H5112/H5220 | `MultiThBroadParseImp`, `ThBroadcastUtil.h` | 10 bytes: seq, order, TH block, packed battery/flags, 16-bit suffix |
| H5220 cloud | `Ext4H5220` | 30-bit packed: `(v/10)-40` temp, `(v/10)` hum, 10-bit fields |

### 4.3 Other readings / state

| reading | range / unit | source |
|---|---|---|
| temperature | −40…70 °C (device profile min/max) | `ThDeviceOverride.temMin/temMax` |
| humidity | 0…100 %RH | `Controller4HumWarning` |
| battery | 0…100 %, raw byte | `Controller4Battery` |
| PM2.5 | 0…999 µg/m³ | `IotInfo4H5106` |
| CO2 | 0…5000 ppm, grade 1100/1800 | `IotInfo4H5140`, `Controller4Co2SetGrade` |
| comfort range | min/max temp/hum ×100 | `h5171/Controller4ComfortTemHum` |
| signal | dBm | `Ext4H5220.signal` |
| online | bool | `Ext4H5220.online` |

---

## 5. IoT commands + status schema

Envelope: `ptReal` / `multiSync` for frames; cloud status is parsed by
`ui/op/IotOpManager.java` and `pact/h51*/IotParse*`.

| cmd | data | meaning | source |
|---|---|---|---|
| `ptReal` | `{"command":["<base64 20-byte frame>"]}` | BLE frame tunnel | `IotOpManager`, `SettingOpManager` |
| `multiSync` | `{"command":[...]}` | multi-device sync / trigger | `IotOpManager`, `Controller4MultiTrigger` |
| `online` | — | subscription | `IotOpManager` |
| `status` | JSON object | full state snapshot | `IotOpManager` |
| `devStatus` | JSON object | per-probe status | `IotOpManager` |
| `tem`/`hum` | values ×100 | live readings | `IotInfo4H51*`, `Ext4H51*` |
| `pm25` | 0…999 | PM2.5 | `IotInfo4H5106` |
| `co2` | 0…5000 ppm | CO2 | `IotInfo4H5140` |
| `warn`/`alarm` | warning bitmask | temperature/humidity alarms | `IotOpManager` |

Cloud status fields (JSON names from `@SerializedName` / bean fields):
`tem`, `hum`, `pm25`, `co2`, `bat`, `online`, `signal`, `tuType` (unit),
`temCali`, `humCali`, `temMin/temMax`, `humMin/humMax`, `co2GradeMin/co2GradeMax`,
`dndIsOpen`, `dndStartHour/dndEndHour`, `soundLevel`, `soundSwitch`.

---

## 6. Other protocols

- **BLE broadcast**: primary passive read path (see 4.2); `BleBroadcastController`
  and `ThBroadcastUtil` feed the widget/list without a connection.
- **Gateway / sub-device**: H5107/H5109/H5310 have no BLE (`GW_NO_BLE_TH`); their
  sub-sensors are read through the gateway (`pact/h5112`, `pact/h5220`,
  `GwSubDeviceItemImp`). Sub-device records use the same TH packing.
- **WiFi**: H5103/H5179 are `WIFI_TH` (WiFi provisioning + cloud, BLE for setup).
- **Chart GATT**: characteristic `…2013` (and `…2015`), 16-byte records with a 2-byte
  relative minute stamp; `ThChartDataManager`/`ThChartDataComm`.
- **OTA**: `update/ota4om`, `ota4tl`, `ota4v1`, `ota4frk`, `ota4common`, `ota4v2`.
- **gidsafe**: `gidsafe/` reads/writes the device GID and WiFi MAC over BLE.

---

## 7. Dynamic effects / scenes / DIY

TH sensors have no light/music effects. `thscene/` implements the **automation scene
model** (capability, mode, state, advice, sync) used by the ecosystem engine; it is
metadata, not a BLE payload. Modes are defined in `thscene/mode` and mapped to
`Controller4MultiTrigger` writes only when the scene changes device settings
(temperature/humidity warning, unit, display, DND).

---

## 8. Source map

| area | paths |
|---|---|
| profiles / SKUs | `config/ThDeviceProfiles.java`, `config/device/ThDeviceProfile*.java`, `ThLegacySkuProfiles.java`, `pact/ThSkuMaker.java` |
| transports | `comm/common/ThCommConfig.java`, `ble/ThChartDataComm.java`, `ble/ThChartDataManager.java` |
| controllers | `ble/controller/*.java`, `ble/controller/h51*/…`, `ble/controller/h5140/…`, `ble/controller/h5171/…`, `ble/controller/h5220/…` |
| broadcast | `pact/ThBroadcastUtil.java`, base `BleUtil.parseThBleValidBytePos*`, `parseThValue`, `parseThpValue`, base `widget/view/temHumDevice/ble/*ThBroadParseImp.java` |
| IoT | `ui/op/IotOpManager.java`, `ui/op/SettingOpManager.java`, `pact/h51*/Iot*`, `pact/h5220/Ext4H5220.java` |
| heart | `ble/ThHeartInfo.java`, `ble/ThHeartDispatcher.java`, `ble/controller/Controller4HeartV0.java`, `Controller4HeartV1.java` |
| OTA / gidsafe | `update/ota4*`, `gidsafe/*` |

---

## 9. Gaps / unknowns

- `parseThValue` returns deci-units (`(v/1000)*10`) but every consumer displays
  `value/100`; the broadcast path therefore relies on an implicit ×10 elsewhere
  (`ThHeartDispatcher`/DB). The exact intended unit for broadcast records is
  ambiguous; treat as 0.01 °C / 0.01 %RH after the app pipeline.
- `H5106ThBroadParseImp` copies 4 bytes yet calls `parseThpValue` which requires 5;
  PM2.5 may be truncated/always invalid in that path.
- Several `ThDeviceOverride`/`ThGidSafeSpec` fields are constructed with JADX
  `defaultConstructorMarker` masks; the per-SKU feature matrix is only partly readable
  from the decompiled default arguments.
- H5106 is registered both under goodsType 124 (THP_PM25) and via the legacy H5053
  entry; the routing depends on cloud-provided goodsType.
- Legacy H5071/H5072/H5074/H5075 profiles have goodsType 0 and are resolved from the
  server; their SKU strings are not stored in `ThDeviceProfiles`.


---

<!-- split_pact_tvlightv4 -->

# split_pact_tvlightv4 — TV backlights / camera DreamView (v2, v3, v4)

Source root: `decompiled/jadx-splits/split_pact_tvlightv4/sources/com/govee/`.
This split bundles **three generations** of the TV-backlight pact:

| class package | goodsType | products | generation |
|---|---|---|---|
| `pact_tvlightv2` | 24 | H6199 (DreamView T1), H6198 (DreamView T1S) | v2 |
| `pact_tvlightv3` | 23 / 52 / 112 | H6053 (RGBIC TV Light Bars), H6056 (RGBIC TV Light Bars), H6046 (RGBIC TV Light Bars) | v3 |
| `pact_tvlightv4` | 25 | H6054 (DreamView P1), H6049 (DreamView P1S) | v4 |

Confirmed by `Support.addSupportPact()` of each sub-package, `sku/…` constants and
`decompiled/apktool-base-7.7.10/assets/categories.json` (goodsType per SKU).

Transport per generation:

- **v2 (24)** — `ble + iot`: `pact_tvlightv2/pact/EffectOp4BleIot.b()=24`, `supportBle()` and
  `getRoomOp4Iot()` both implemented, and the app registers both `Ble*CmdBuilderV1` and
  `Iot*CmdBuilderV1` (`TvV4ApplicationImp.java`).
- **v3 (23)** — `ble` only: `pact_tvlightv3/pact/EffectOp4Ble.b()=23`, no `*IotCmdBuilder` for
  goodsType 23. `getSupportScenesOpSet` only.
- **v3 (52, 112)** — `ble + iot`: `EffectOp4BleIot.b()={52,112}`; `Pact` registers 2/1 and 3/1
  protocols for 52.
- **v4 (25)** — `ble + iot`: `pact_tvlightv4/pact/EffectOp4BleIot.b()=25`;
  `AbsEffectOp4BleIot.supportWifi()=true`, `supportBle()=true`.

No WiFi/MQTT/matter code in this split. "WiFi" appears only as the `WifiNotifyParse` BLE
notification (0x11) and the device's WiFi version fields.

---

## 1. Transports & GATT UUIDs

All three generations use the vendor GATT pair:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `pact_tvlightv2/ble/BleComm.java`, `pact_tvlightv3/ble/BleComm.java`,
`pact_tvlightv4/ble/BleComm.java`, `pact_tvlightv4/ble/BleMultiComm.java`.
Notify uses the same characteristic (`BleNotifyComm.getServiceUuid()`); v4's notify list is
`WifiNotifyParse` + base `DeviceStatusNotifyParse`
(`pact_tvlightv4/ble/BleNotifyComm.java`).

BLE frame is the shared 20-byte frame: `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC`.
Writes use proType `0x33`; reads use `0xAA` (`AbsSingleController.getValue()` /
`pact_tvlightv4/ble/Parser.java` copies bytes 2..18 into 17 valid bytes).
Multi-frame writes use proType `0xA3`/`0xA4`/`0xA5` (`MultipleBleBytes`,
`MultipleControllerCommV1`), still 20 bytes each.

---

## 2. BLE command table

| command | op (write / read) | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` (`0xAA/0x01` read) | `[0] 00=off 01=on` | base `ble/controller/SwitchController` via each `Comm` |
| brightness | `0x33/0x04` (`0xAA/0x04`) | `[0] level`. v4 `Support.getBrightnessRange()` = 20..254, value is sent raw (no remap for pactV1). v2: if pact V1 (`1,1`) `NumUtil.calculateProgress(max,min,v)`; otherwise 20..254 / progress range `{0,1,100}` depending on pact. v3 same 20..254. | `pact_tvlightv4/pact/Comm.java`, `pact_tvlightv2/pact/Comm.java`, `pact_tvlightv3/pact/Support.java` |
| heart / status | write `0x33/0x01` payload on/off; read `0xAA/0x01` | v4 `TvHeartController` cmdType 51 (`0x33`), parse `[0]` state (`0x11`/`0x01`/`0x10`/`0x00` -> both/on/off/none) and `[1]` feast flag; v3 same; v2 base `HeartControllerV2` | `pact_tvlightv4/ble/TvHeartController.java`, `pact_tvlightv3/ble/TvHeartController.java`, `pact_tvlightv2/ble/BleComm.java` |
| mode container (color/music/scene/DIY/video) | `0x33/0x05` (`0xAA/0x05` read; read `p()` = `{1}`) | `[2..]` = sub-mode payload (see §5). Read returns `[0]=subMode` + payload. | base `AbsModeController` + each `ModeController` |
| all-light switch (v3/v4) | `0x33/0x33` | `[0] 00 both off / 01 main on / 10 background on / 11 both on` | `pact_tvlightv3/ble/SingleLightController.java`, `pact_tvlightv4/ble/SingleLightController.java` |
| swap light position (v3/v4) | `0x33/0x34` | empty payload | `SwapLightController` |
| light direction (v3/v4) | `0x33/0x30` | `[0] direction (0/1)`; response `[0]` | `LightDirectionController` (v4; v2 family has same class) |
| camera position (v2/v4) | `0x33/0x31` | `[0] cameraPos`; response `[0]` | `pact_tvlightv4/ble/CameraPosController.java`, `pact_tvlightv2/ble/CameraPosController.java` |
| check camera (v2/v4) | `0x33/0x32` (empty) | response `[0]` 0/1 | `CheckCameraController` |
| start time / calibration time (v4) | read `0xAA/0x35` | response `[0]` seconds/percent 0..255 | `pact_tvlightv4/ble/StartTimeController.java` |
| start time (v2) | read `0xAA/0x34` | response `[0]` | `pact_tvlightv2/ble/StartTimeController.java`; `StartTimeControllerV1` is `0xAA/0x35` |
| gradual switch (v2) | write `0xA3/0xA3` (`SINGLE_GRADUAL_CHANGE = -93`) | `[0] 0/1` | `pact_tvlightv2/ble/GradualController.java` |
| white balance (v4, via base) | `0x33/0xA9` | `00 03 <auto?0:1> <R> <B>` (classic), `06 01 <progress>` (infinite), `0F 03 <R> <G> <B>` (advanced) | base `WhiteBalanceVmInterface`, `Info4Detail.parseWhiteBalance` |
| whole-RL brightness (v4) | `0x33/0xA9` | `02 01 <level>` / read `02` | `WholeRLBrightnessVmInterface` |
| black-border remove (v4) | `0x33/0xA9` | `0B 01 <flag>` / read `0B` | base `BlackBorderRemoveController` |
| sensitivity | `0x33/0xA9` | `01 01 <value>` / read `01` | `VideoSensitivityController` |
| colour calibration | `0x33/0xA9` | `05 03 <R> <G> <B>` / read `05` | `ColorCaliController` |
| device black screen | `0x33/0xA9` | `0A 06 <enable> <mode> <startLo> <startHi> <endLo> <endHi>` / read `0A` | `balckscreen/BlackScreenController` |
| HDR calibration | `0x33/0xA9` | `0D` read/write | `HDRCaliController` |
| saturation | `0x33/0xA9` | `0E 01 <value>` / read `0E` | `VideoSaturationController` |
| AI filter | `0x33/0xA9` | `10 0F <enable> <R> <G> <B> <saturation> <code LE16> <autoClose LE16> <time LE16> <tz0..3>` / read `10` | `AiFilterController` |
| HDR effect / contrast | `0x33/0xA9` | `11 02 <enable> <level>` / read `11` | `VideoHdrEffectController` |
| sound-effect mic | `0x33/0xAC` | `<micIndex>` | `SoundEffectVmInterface` |
| relative/segment brightness | `0x33/0xAE` | `01 <4|6> <v0..v3> [<v4> <v5>]` | `RelativeBrightnessController` |
| timer | `0x33/0x23` (read `0xAA/0x23`) | see base `NewTimerV1Controller`, `TimerConfig` | `Info4Detail` (`l0`) |
| sleep / wakeup | `0x33/0x11`, `0x33/0x12` | see `SleepController{,V2}` | `Info4Detail` (`j0`,`m0`) |

The full `0xA9` sub-op table and per-SKU video-mode byte orders are in
`DREAMVIEW-HDMI.md`; this split uses the camera/DreamView subset (no HDMI port select).

Multi-packet DIY / scene writes use `MultipleBleBytes.getMultipleWriteBytesV1(...)`; the final
frame of the sequence carries the mode command (0x05 with 0x04/0x0A sub-mode).
`CmdPt` uses `MultipleControllerCommV1.makeSendBytesV3((byte)-93,(byte)91,body,97)`.

### BLE notifications/readings

| notify op | layout | meaning | source |
|---|---|---|---|
| `0x11` | `[0]==0` | WiFi connected | `WifiNotifyParse` in all 3 generations |
| `0x20` | `[0]` brightness | brightness report | v3 `BrightnessNotifyParse` |
| `0x30` | `[0]==1`, `[1]` bits | device/switch status | v4 base `DeviceStatusNotifyParse`; v3 same |
| `0x32` | `[0]` | check-camera status | `CheckCameraController` |
| `0x33` | `[0]` state nibble, `[1]` feast | tv heart / power | `TvHeartController.parseValidBytes` |
| `0xAA/0x05` | `[0]` sub-mode, then sub-mode payload | mode read-back | `AbsModeController.parseValidBytes` |
| `0xAB/0x07` | `[0]=7 [1]=7 [2..]` | DSP version (low/high count) | `pact_tvlightv4/pact/Comm.java#parseDspVersion` |
| `0xAA/0xA9 0B` | `[2]==1` | black-border state | `Info4Detail.c0` |

---

## 3. IoT commands + status schema

Envelope: `CmdBuilder.makeCmdStr(AbsCmd)` → `Write.getWriteMsg4Transaction` (V0-style outbound
`{msg:{transaction,accountTopic,type,origin=32,cmdVersion,cmd,data}}`). Responses are parsed as
**`IotMsgProType.V2`** (`IotMsgV2`) by every `IotSwitchCmdBuilderV1` in this split.
Read key mapping (`iot/Cmd.getCmdReadParseKey`): `pt`/`ptReal` use `op`, everything else `state`.

| cmd | data fields | notes | source |
|---|---|---|---|
| `turn` | `val` 0/1; v4 adds `subVal:[v1,v2]` | per-light-bar on/off | `pact_tvlightv4/iot/CmdTurn.java`, v2/v3 `CmdTurn` |
| `brightness` | `val` int | range 20..254 (pactV1) / 0..100 progress | `CmdBrightness` |
| `colorwc` | `color:{red,green,blue}`, `colorTemInKelvin` (0 for RGB; Kelvin only if in device set) | used when pactV1 is false (v4 v2 package) | `pact_tvlightv4/iot/v2/CmdColorWc.java` |
| `pt` | `op`:`mode|gradual|sleep|timer|wakeup`, `value:[base64(frame),…]` | BLE frames tunneled through cloud for pactV1 devices | `pact_tvlightv4/iot/CmdPt.java` |
| `ptReal` | `command:[base64(20-byte frame),…]` | used for pactV2/V3 devices; newest successor of `pt` | `pact_tvlightv4/iot/v2/CmdPtReal.java`, v3 `iot/CmdPtReal.java` |
| `camera` | `cameraPos` int (v4) / `cameraDirection` int (v2) | camera mount position/direction | `iot/CmdCameraPos.java`, v2 `iot/CmdDirection.java` |
| `points` | `points:[{pointX,pointY}]` | calibration point upload | `iot/CmdCalibrationPoints.java` |
| `snapshot` | read-only: `snapshotUrl` | camera snapshot URL | `iot/ResultSnapShot.java` |
| `IoTConnected` | `value:[base64]` | v2 `CmdBulb` (legacy bulb passthrough) | `pact_tvlightv2/iot/CmdBulb.java` |

Read parsers:

- `ResultPtV1.command` → base64-decoded 20-byte BLE frames (`iot/ResultPtV1.java`).
- `Result4PtReal` (base) `op` → `ptBytes()` list (v4 `Info4Detail.d0`).
- `StateWithSubOnOff` (base) `state` → `onOff`, `brightness`, `subOnOff[2]`.
- `ResultCamera.cameraPos`, `ResultSnapShot.snapshotUrl`.

Status fields used by the UI: `onOff` (bool), `brightness` (int), `subOnOff[0/1]` (main/background
bars), `modeByte` + sub-mode, `videoMode` params, `timer/sleep/wakeup`, `whiteBalance`.

---

## 4. Other protocols

- **BLE broadcast add flow** — `pact_tvlightv2/add/BleBroadcastProcessor.java`,
  `pact_tvlightv3/add/BleBroadcastProcessorV1.java`, `pact_tvlightv4/add/BleBroadcastProcessor.java`
  parse the advertisement into `AddInfo` (sku, goodsType, protocol, bleName, MAC).
- **Calibration HTTP** (`pact_tvlightv4/add/net/INet.java`):
  - `GET appco/v1/calibration/point?device=&sku=` → `GetPointsResponse`
  - `POST appco/v1/calibration/point` (`UploadPointsRequest{device,sku,imgUrl,points}`)
  - `POST bi/rest/v1/calibrationPoints` (`{device,sku,deviceVersion,appVersion,url,points}`)
  - `POST device/rest/devices/v1/settings` (`LightCalibrationRequest`)
- **Movie Feast / DreamView group REST** — same shared endpoints as h6099: create/delete
  `/appsku/v1/moment/feasts`, detail/main/sub, region, music/scene feast, snapshot
  `/bff-app/v1/feast/snapshot/cmd-refactor`; bodies in `DREAMVIEW-HDMI.md` §4.1.
- No MQTT, no matter, no IR/RF in this split. (The TV split is camera DreamView, not HDMI
  sync; it does not use the HDMI port/icon endpoints.)

---

## 5. Dynamic effects / motion / music / scenes / DIY (exact payloads)

All mode payloads start at frame byte 2; the table below shows the sub-mode payload only.

### 5.1 Color

| variant | sub-mode | payload layout | notes |
|---|---|---|---|
| legacy v2 `sub_mode_color` | `0x0B` | `0B R G B kelLo kelHi mask0 mask8` (8 B) | 15 segments; mask0 = segments 0..7, mask8 = 8..14. `SubModeColor.getWriteBytes()` |
| v3/v4 `sub_mode_color` | `0x0D` | `0D sel R G B kelLo kelHi R2 G2 B2` (9 B) | `sel`: 0=none, 1=main, 16=background, 17=both. Kelvin is signed 16-bit LE; `R2G2B2` is the colour-temp colour. |
| v2 15-seg modern | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask0 mask8` (12 B) | `SubModeColorV2.e()` (v2 file) |
| v3/v4 12-seg modern | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask0 mask1` (17 B, rest 0) | masks: byte10 bits 0..7, byte11 bits 8..11. `SubModeColorV2.getWriteBytes()` |
| brightness mask | `0x15` | `15 02 level 00 mask0 mask8…` | per-segment brightness (byte2=level, masks follow). v4/v3 `SubModeColorV2`; v2 uses 12-byte form. |
| explicit RGB array | `0x15` | `15 03 c0 c1 … c11` (bytes 2..13) | 12 raw colour indices; used by DIY/scene compose. |

### 5.2 Music

`sub_mode_music = 0x0C` (old) / `sub_mode_music_new = 0x13` (new).

| form | sub-mode | payload | effect codes |
|---|---|---|---|
| v2 old | `0x0C` | `0C effect sens [dynFlag [R G B]]`; 3 B for `effect 0`, 8 B for `effect 5`, 7 B for others (`0C eff sens dyn R G B`) | `0 Energic, 2 Rolling, 3 Spectrum, 5 Rhythm` |
| v3/v4 old | `0x0C` | same 8/9-B shape; `effect 5` gets dynamic flag at `[3]`, RGB at `[6..8]` | v3/v4: `0/5/6/7` plus `73 Beat, 80 Torch, 81 Rainbow Circle, 82 Shiny` |
| v4 new | `0x13` | `13 effect sens [dyn] [sel R G B]`; 9 B when `effect==3`, 8 B for `5/8/9`, else 3 B | `3 Rhythm, 5 Energic, 8 Rolling, 9 Spectrum`, plus `73/80/81/82`; `sel` = 0/1/16/17 (same bar mask semantics) |
| v2 new | `0x13` | `13 effect sens 10 dyn R G B` (8 B) | `3/5/6`, default `effect=5`, `c=0x10` fixed |
| v3 music-v3 | `0x13` | same as v4 new | `SubModeMusicV3`; `ParamsSubMode4Music.a(version)` selects V2 vs V3 parser by `version==2` |

Sensitivity is `0..99` (`Math.max(0,Math.min(x,99))`). `dynamic`/`autoFlag` = 0 means manual
colour, non-zero means device-driven colour.

### 5.3 Scenes

`sub_mode_scenes = 0x04`, payload `04 effectLo effectHi [musicCode]`.

- v2/v3/v4 plain: 3 bytes (`SubModeScenes.getWriteBytes()`).
- H70B1/H70B3 origin family adds a music byte (not this split).
- Effect id is a 16-bit LE scene/DIY-template code. The static TV scene menu is
  `ScenesV0.scenesEffectSet = {13,4,9,7,24,10,16,15,29,30,21,22}` →
  Reading(13), Film(4), Colorful(9), Romantic(7), Meteor(24), Breath(10), Energetic(16), Snow(15),
  Seasons(29), Stream/Bloom(30), Chase(21), Stream(22) (names from base
  `base2light/ble/scenes/ScenesStr.java`).
- A scene may expand into a multi-frame effect (`ScenesOp.parseSceneV1(...,{1,2})`); first frames
  are `0xA3/0xA4` chunks, last frame is the 0x05 mode frame carrying `04 <code>`.

### 5.4 DIY

`sub_mode_new_diy = 0x0A`, payload `0A diyLo diyHi` (16-bit LE DIY code).
DIY bodies are written before the mode frame with `MultipleBleBytes.getMultipleWriteBytesV1`
(`CmdPtReal.getDiyCmdPt`, `getDiyTemplateCmdPt`). DIY template effects reuse `0x04`.

### 5.5 Video / camera mode (DreamView)

Container: `0x33/0x05` + sub-mode `0x00`. The payload is built by
`VideoVm.B()` → `Controller4ExtBytes({5, 0, ...})`.

| generation | payload after `05` | fields |
|---|---|---|
| v4 (`VideoVm.N`) | `00 <screenState> <drama> <vivid> <voiceOn> <voice> <rlBrightness>` | `screenState`: 0=part,1=all,2=full-screen; `drama`: 0=movie,1=game; `vivid` 1..100; `voiceOn` 0/1; `voice` 0..100; `rlBrightness` 0..100 |
| v2 (`VideoVm.N`) | `00 <screenState> <drama> <vivid> <voiceOn> <voice> <rlBrightness>` | same order; older `SubModeVideo` uses `00 gameOrAll drama vivid voiceOn voice rlBrightness` |
| v4/V2 legacy (`SubModeVideoV2`) | `00 <screenState> <drama> <vivid> <voiceOn> <voice> <rlBrightness>` | parser-only class; same byte order |

Parsers validate vividness to `1..100`. Read-back path:
`Info4Detail.g0()` → `[0]=0x00` → `VideoModeControllerParams` from `bArrS[0..5]`.

The video UI also exposes the shared camera settings: sensitivity `0xA9/01`, whole-RL
brightness `0xA9/02`, colour calibration `0xA9/05`, white balance `0xA9/00|06|0F`,
black-border remove `0xA9/0B`, black screen `0xA9/0A`, HDR calibration `0xA9/0D`,
saturation `0xA9/0E`, AI filter `0xA9/10`, HDR effect `0xA9/11`, sound-effect mic
`0xAC`, and relative brightness `0xAE`. See `DREAMVIEW-HDMI.md` §1–§2 for exact payloads.

### 5.6 Camera / direction / calibration

- camera position: `0x31`, 1 byte 0/1 (main/background camera), also `camera` IoT field.
- light direction: `0x30`, 1 byte.
- check camera: `0x32`, no payload, response 1 byte.
- start time: read `0x35` (v4) / `0x34` (v2); used to seed video sync.
- calibration point upload is HTTP, not BLE.

---

## 6. Source map (traced)

- SKU/pact support: `pact_tvlightv2/pact/Support.java`, `pact_tvlightv2/pact/deviceitem/SubLib.java`,
  `pact_tvlightv3/pact/Support.java`, `pact_tvlightv3/pact/deviceitem/SubLib.java`,
  `pact_tvlightv4/pact/Support.java`, `pact_tvlightv4/pact/SubLib.java`
- BLE builders → Comm: `pact_tvlightv*/scenes/*.java` → `pact_tvlightv*/pact/Comm.java`
- BLE protocol constants: `pact_tvlightv2/ble/BleProtocol.java`, `pact_tvlightv3/ble/BleProtocol.java`,
  `pact_tvlightv4/ble/BleProtocol.java`
- controllers: `pact_tvlightv*/ble/{CameraPos,CheckCamera,LightDirection,StartTime,Gradual,SingleLight,SwapLight,TvHeart}Controller.java`
- sub-modes: `pact_tvlightv*/ble/{Mode,Mode4ColorStrip,SubModeColor,SubModeColorV2,SubModeMusic,SubModeMusicV2,SubModeMusicV3,SubModeScenes,SubModeNewDiy,SubModeVideo,SubModeVideoV2}.java`
- effects/DIY: `pact_tvlightv*/pact/{EffectOp4Ble,EffectOp4BleIot,AbsEffectOp4Ble,AbsEffectOp4BleIot}.java`,
  `pact_tvlightv*/adjust/{Diy,ui/ScenesV0}.java`, `detail/diy/H6054DiyConfig.java`,
  `pact_tvlightv2/newdetail/diy/H6199DiyConfig.java`
- IoT: `pact_tvlightv*/iot/*.java`, `iot/v2/*.java`; result parsers `ResultPtV1`, `ResultSnapShot`, `ResultCamera`
- notifications: `pact_tvlightv*/ble/WifiNotifyParse.java`, v3/v4 `BleNotifyComm.java`, v3 `BrightnessNotifyParse.java`
- detail/video: `pact_tvlightv4/detail/mode/VideoMode.java`, `VideoVm.java`,
  `pact_tvlightv4/detail/Info4Detail.java`, `pact_tvlightv2/newdetail/videomode/*`
- calibration HTTP: `pact_tvlightv4/add/net/INet.java`

## 7. Gaps / unknowns

- No static scene-name table for server scenes beyond `ScenesV0`'s 12 IDs; other effect ids come
  from `ScenesM` (cloud `categories`/scene JSON).
- `Support.getBrightnessRange`/v2 `getBrightnessRange` branch on runtime pact protocol; both
  20..254 and 0..100 progress forms exist. Which one is used depends on the device pact
  (`pactType/pactCode`) reported at runtime.
- `TvHeartController.parseValidBytes` is partly decompiler-reconstructed; byte1 is a feast flag,
  byte0 state is confirmed from v3 source.
- `0xAB` white-balance/whole-brightness/black-border controllers live in the base app; only their
  notify parsers are in this split. Their write `q()` builders were not present here.
- `CmdBulb.getCmd()` returns `Cmd.k` = `"IoTConnected"` (legacy constant, likely dead code).


---

<!-- split_pfdv1 -->

# split_pfdv1 — bulb strings (H7001 / H7023 / H7024)

> Note: the assignment described this split as “shared recognition/vision helpers”.
> That is **not** what the tree contains. `split_pfdv1` (the directory is
> `split_pfdv1`, not `split_pact_pfdv1`) holds two real product families:
> the **H7001/H7023 multi-bulb string** and the **H7024 multi-bulb string**.
> Both are BLE light devices with their own commands and effects, documented here.

Source root: `decompiled/jadx-splits/split_pfdv1/sources/`

---

## 1. Overview / family and SKUs

| SKU | goodsType | bulbs | protocol | transport | notes |
|---|---|---|---|---|---|
| H7001 | not declared in split (uses `AbsBleSku`) | 12 | H7001/H7023 (`Sku.java`) | ble | 12-bulb string; 6 scene types + snow on soft ≥ 10100 |
| H7023 | same | 6 | H7001/H7023 | ble | 6-bulb string; same protocol, snow only on V1 soft |
| H7024 | not declared (uses `AbsBleSku`) | 6 (4×6 layout per `h7024/detail/Support`) | H7024 (`BleProtocol`) | ble | 6-bulb string with per-bulb color, brightness, color-temp, two music effects |

Registries:
- `h700123/sku/Sku.java`: `a="H7001"`, `b="H7023"`, `e/g={H7001,H7023}`;
  `getBulbNum()` = 12 / 6; `isSupportSnow(version) = version >= 10100`.
  `SubMaker` registers `SkuH7001`, `SkuH7023`.
- `h700123/sku/NewDetailsConfig.java` also claims **H7024** in scene interceptors
  (`support()` checks `Sku.a`, `Sku.b`, `H7024Constant.a`), so the base new-detail
  scene UI is shared.
- `h7024/H7024Constant.java`: `a="H7024"`, `d={H7024}`; `getBulbNum()` = 6;
  `detail/Support.b()` returns `{4,6}` (4 columns × 6 rows).
- Both `Model`s extend `AbsDeviceMode4BleOldLib`; `DeviceItem`s extend `AbsBleItem`.
  `needBle` is implicit — **BLE only**, no IoT/cloud control path in this split.

---

## 2. Transports & GATT UUIDs

| item | H7001/H7023 | H7024 |
|---|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` | same |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` | same |
| multi-write | `AbsMultipleBleComm`, service/char same | same |
| frame | 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` | same |
| write | `0x33` | `0x33` |
| read | `0xAA` | `0xAA` |
| multi | `0xA5` (`AbsMultipleController`) | same |

`h700123/ble/BleComm.java`, `BleMultiComm.java`; `h7024/ble/BleComm.java`,
`BleMultiComm.java`, `BleNotifyComm.java`.
H7024 registers only `WifiNotifyParse` (cmd `0x11`, WiFi state) on the standard
service; H7001 has no `BleNotifyComm` (uses base notify handling).

---

## 3. BLE frame + command table

### 3.1 H7001 / H7023

`ble/BleProtocol.java`:
`sub_mode_color=8`, `sub_mode_mic=5`, `sub_mode_scenes=9`, `MSG_TYPE_READ_BULB_COLOR=-94 (0xA2)`,
`MULTI_SCENE=1`, `NEW_MODE_SCENE=9`.
Scene IDs: illumination 0, fade 1, raindrops 2, colorful 3, marquee 4, blinking 5,
snow 6 (V1 only).

| command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `on` | `[0]=0/1` | base `SwitchController`; `Comm.makeSwitchController4BleComm` |
| brightness | `0x33/0x04` | `level` | `level = 1 + (percent-1)*(42/100)` → **1..40** | `Comm.makeBrightnessController4BleComm`; `NumUtil.calculateProgress(40,1,pct)` |
| color (all segments) | `0x33/0x05` | `08 m0 m1 m2 R G B 00` | `[0]=8`; `[1..3]` 24-bit segment mask; `[4..6]` RGB; `[7]=0` | `adjust/SubModeColor.getWriteBytes` |
| music/mic select | `0x33/0x05` | `05 01` | `[0]=5,[1]=1` | `adjust/SubModeMic.getWriteBytes` |
| mic dynamic/mild | `0x33/0x05` | `05 03 flag` | `[0]=5,[1]=3,[2]=1 dynamic / 0 mild` | `ble/MicController.q` |
| scene mode on | `0x33/0x05` | `09 00×15` | 16 bytes; only `[0]=9` is used | `adjust/SubModeScenes.getWriteBytes` |
| read bulb colors | `0xAA/0xA2` | `group` | group 1..ceil(bulbs/4); response `[group, 4×RGB]` | `ble/ReadBulbColorController` |
| multi-scene write | `0xA5/0x01` | start `00 count 00`, then `index 16B`, end `FF` | payload `[code,effect,subEffect,speed,colorCount,colors…]` | `ble/ScenesModeController.g`; `MultipleControllerComm` |
| heart/read | `0xAA/0x01` | `[1]` | `[1]` per `AbsModeController.p()` | base |

Multi-scene model (`adjust/MultiSceneModel`): `code` (0), `effectType` (0..6),
`subEffectType` (0), `speed` (0..100, default 50), `colors` (RGB triples, default
red/blue/yellow/green or white for snow, up to 4). The frame is sent through the
generic `MultipleControllerComm.makeWriteMultipleBytes`:
start `[0xA5,0x01,0x00,count,0x00]`, chunks `[0xA5,0x01,index,16B]`, end
`[0xA5,0x01,0xFF]` with 300 ms between packets.

### 3.2 H7024

`h7024/ble/BleProtocol.java`:
`sub_mode_color=11`, `sub_mode_music=1`, `sub_mode_scenes=9`,
`SINGLE_BULB_NUM=15`, `MSG_TYPE_READ_BULB_COLOR=-94`,
`value_sub_mode_music_power=5` (dynamic), `value_sub_mode_music_soft=4` (mild).

| command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `on` | `[0]=0/1` (raw, not scaled) | `scenes/BleSwitchCmdBuilder` |
| brightness | `0x33/0x04` | `level` | `[0]=level` (no 1..40 scaling) | `scenes/BleBrightnessCmdBuilder` |
| color (all segments) | `0x33/0x05` | `0B R G B m0 m1 m2 00` | `[0]=11`; RGB at `[1..3]`; 24-bit segment mask at `[4..6]`; `[7]=0` | `adjust/mode/H7024SubModeColor.getWriteBytes` |
| music | `0x33/0x05` | `01 effect sensitivity` | effect 4 = soft/mild, 5 = dynamic; sensitivity 0..99 | `adjust/mode/SubModeMusic` |
| scene mode on | `0x33/0x05` | `09 (type+1) 00×15` | `[0]=9`, `[1]=sceneType+1` | `adjust/mode/SubModeScenes` |
| bulb count read | `0xAA/0x0F` | – | response `[count]` | `ble/BulbNumController` |
| bulb count write | `0x33/0x0F` | `count` | `[0]=count` | `ble/BulbNumController` |
| read bulb colors | `0xAA/0xA2` | `group` | response `[group, 4×RGB]` | `ble/ReadBulbColorController` |
| multi-scene | `0xA5/0x01` | same as H7001 | code = sceneType+1, effectType = sceneType | `scenes/Common.makeScene4BleComm`; `ble/ScenesModeController` |

H7024 color layout differs from H7001: **RGB first, then the mask** (H7001 is mask
first, RGB last).

---

## 4. BLE notifications / readings

| notify | parser | layout | source |
|---|---|---|---|
| `0x11` | `h7024/ble/WifiNotifyParse` | `[0]==0` → WiFi connected | H7024 only |
| `0x05` | mode read/notify | `[0]` sub-mode: 8 color → `[1..3]` RGB; 9 scene → `[1]` type; 5 mic | `Mode.parseSubMode` (both) |
| `0xA2` | `ReadBulbColorController` | `[0]` group, `[1..12]` 4×RGB | both |
| `0x01` | heart/switch | base read | both |
| `0x04` | brightness | base `BrightnessController` → `[0]` level | both |

H7001/H7023 `BleReadManager` re-reads bulb colors after a color/scene change when
the sub-mode transitions (color→color, scene→scene) so the UI shows per-bulb colors.

---

## 5. IoT commands + status/readings schema

**None.** Both families are pure BLE. There is no `iot/` package, no `Cmd`, no
`ptReal`, no status JSON in this split. `Info4BleIotDevice` is used only as a
generic detail-info container by the shared new-detail framework.

---

## 6. Other protocols

- **BLE broadcast / pairing**: `h700123` has no advert parser in this split;
  `h7024/add/H7024ConnectDialog` only connects to a scanned device. The shared
  `BaseBleProcessor` filters by SKU/protocol.
- **No Wi-Fi / MQTT / LAN / Matter** in this split.
- **REST**: none.

---

## 7. Dynamic effects / scenes / DIY

### H7001 / H7023

| mode | bytes | notes |
|---|---|---|
| color | `05 08 m0 m1 m2 R G B 00` | 24-bit segment mask (24 segments; 12/6 bulbs), RGB |
| scene select | `05 09 00×15` | scene index is sent via the multi-scene packet, not in this frame |
| music select | `05 05 01` | mic/music mode |
| mic dynamic/mild | `05 05 03 flag` | flag 1 = dynamic, 0 = mild |
| multi-scene | `A5/01` payload `00 effect subEffect speed colorCount R G B …` | `effect` 0 illumination,1 fade,2 raindrops,3 colorful,4 marquee,5 blinking,6 snow; `subEffect` 0; `speed` 0..100; colors are RGB triples |
| read colors | `AA/A2 group` | group 1..ceil(bulbs/4) |

Snow is only offered when `Sku.isSupportSnow(versionSoft)` (≥ 10100) →
`Scene4BleRhythmV1` (7 entries) instead of V0 (6 entries).

### H7024

| mode | bytes | notes |
|---|---|---|
| color | `05 0B R G B m0 m1 m2 00` | RGB first + 24-bit segment mask; `[7]=0` |
| music | `05 01 effect sens` | effect 4 mild / 5 dynamic; sensitivity 0..99 |
| scene | `05 09 type+1 00×15` | scene type 0..7 |
| multi-scene | `A5/01` payload `code effect subEffect speed colorCount colors…` | `code = type+1`, `effect = type`, default colors red/blue/yellow/green (or white for snow) |
| DIY / custom | built by shared `IDiyFuc` | not defined in this split |

Scene names (`SubModeScenes.ScenesType` / `BleProtocol` values):
illumination 0, fade 1, raindrop 2, colorful 3, marquee 4, blinking 5, snow 6,
sky 7 (H7024 constant only).

---

## 8. Source map

| area | paths |
|---|---|
| H7001 registry | `h700123/sku/{Sku,SkuH7001,SkuH7023,SubLib,SubMaker,Register4Item,DeviceItem,Model,NewDetailsConfig,Comm}.java` |
| H7001 BLE | `h700123/ble/{Ble,BleComm,BleMultiComm,BleProtocol,Mode,ModeController,MicController,ScenesModeController,ReadBulbColorController,BleReadManager}.java` |
| H7001 sub-modes | `h700123/adjust/{SubModeColor,SubModeMic,SubModeScenes,MultiSceneModel,ScenesConfig}.java` |
| H7001 scenes/builders | `h700123/scenes/*.java`, `h700123/sku/{AbsEffectOp4Ble,EffectOp4Ble}.java` |
| H7024 registry | `h7024/{H7024Constant,sku/*}.java` |
| H7024 BLE | `h7024/ble/*.java` |
| H7024 sub-modes | `h7024/adjust/mode/*.java` |
| H7024 scenes/builders | `h7024/scenes/*.java`, `h7024/detail/*` |

---

## 9. Gaps / unknowns

- **No shared “recognition/vision” code exists in this split.** If such helpers were
  expected, they are in `split_lib_recognition` (present in the repo), not here.
- H7001/H7023 goodsType is not declared in the split (`AbsBleSku` reads it from the
  cloud product), so `pactType/pactCode` cannot be stated statically.
- Brightness scaling differs: H7001 maps 1–100 % to 1–40, H7024 writes the raw
  value. The H7024 UI may pre-scale, but the builder does not.
- The 24-bit segment mask is sized for 24 segments even though H7001 has 12 bulbs and
  H7024 6; the extra bits are likely “per half-bulb” or ignored by firmware. Not
  verified.
- H7001 `ScenesModeController` does not set `MultiSceneModel.code` (stays 0), while
  H7024 sets `code = type+1`. This is an observable protocol difference between the
  two families.
- Snow/sky availability is capability/version-gated; the exact SKU→capability table
  is in the cloud product, not the split.
- H7024 `NewDetailVm` references IoT-style classes (`SubMode4Color`, `IotMsg`), but
  the model is `AbsDeviceMode4BleOldLib`; this is inherited framework code, not an
  IoT transport.
