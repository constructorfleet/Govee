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
