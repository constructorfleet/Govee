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
