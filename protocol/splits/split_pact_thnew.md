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
