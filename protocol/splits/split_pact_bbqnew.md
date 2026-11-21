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
