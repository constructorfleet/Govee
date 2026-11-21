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
