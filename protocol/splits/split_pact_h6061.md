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
