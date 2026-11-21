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
