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
