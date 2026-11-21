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
