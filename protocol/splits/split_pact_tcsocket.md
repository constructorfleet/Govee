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
