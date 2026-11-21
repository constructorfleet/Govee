# split_pact_h7075 — downlights, floodlights, COB strips, wall washers, R3352 sensor lights

Source root: `decompiled/jadx-splits/split_pact_h7075/sources/com/govee/h7075/`.

One of the largest light splits. It contains **ten pact sub-families** that share the same BLE
builder set, colour sub-mode and IoT V2 envelope, but differ in segment count, colour-temp range,
DIY engine and extra features (motion, splicing, light sensor, auto-dimming, online music).

| goodsType | SKU(s) | product | colour-temp | transports / extras |
|---|---|---|---|---|
| 205 | H7075 | Smart LED downlight | 2700–6500 K | ble + iot + matter (commissioning) |
| 245 | H7078 | Smart floodlight / wall washer with motion | 2700–6500 K | ble + iot + motion + splicing |
| 294 | H7072 | COB strip / light bar with brightness sensor | 2700–6500 K | ble + iot + light sensor + auto-dim |
| 313 | H7076 | RGBIC wall-washer / graffiti light | 2700–6500 K | ble + iot |
| 326 | H707A, H707B, H707C, R707A/B/C | Matrix / segment light | 2700–6500 K (1000–10000 K on wide-Kelvin variant) | ble + iot |
| 354 | H3751 | Light bar / combine device | 1000–10000 K | ble + iot + multi-device combine |
| 371 | H3351 | Strip light with gear brightness | 1000–10000 K | ble + iot |
| 396 | H2800 | Wall light / online-music light | 2700–6500 K | ble + iot |
| 383 | H3700 | Dual-zone light (top/bottom) | 1000–10000 K | ble + iot + matter wifi batch |
| 413 | R3352 | Light-sense / auto-dimming light | 1000–10000 K | ble + iot + light sensor |

Registration: `pact/Support.addSupportPact()` registers 205 `(1,1),(2,1),(3,1)`; 245 `(1,1),(2,1)`;
294 `(1,1),(1,3)`; 383 `(1,1)`. Lazy registrations add 313 `(1,1)` and 326 `(1,1),(2,1),(3,1)`.
`SubMaker` emits all ten `ItemH*` makers. Colour sizes: 205→3, 245→4, 294→6, 313/383→4,
413→2, otherwise 1.

---

## 1. Transports & GATT UUIDs

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `mode/*` use the shared `AbsBle`/`AbsBleComm`; `ble/Ble.java` overrides the notify comm
and multi-comm. `pact/MatterSupport` installs a `MatterInterceptor` for goodsType 205 when
versions ≥ soft 1.00.11 / hard 3.05.01 / wifi soft 1.01.17 / wifi hard 1.04.01.
`pact/BatchMatterWifiConfig` allows batch Matter+WiFi provisioning for goodsType 383.

BLE frame: 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` (base
`AbsController`). Segment writes that exceed 17 bytes use `AbsMultipleController` /
`MultipleBleBytes` (20-byte chunks, `0xA3`/`0xA4` proType).

---

## 2. BLE frame + command table

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] level 1..100` | base `BrightnessController` |
| mode | `0x33/0x05` | sub-mode payload below | `mode/Mode.java`, `mode/ModeController.java` |
| colour | sub `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask[4]` (17 B, mode 1); `15 02 level mask[4]` (mode 2); `15 03 brightness[14]` (mode 3); `15 04 groupRGB(4×3)` (mode 4) | `mode/color/SubModeColor.java` |
| mic / music-reactive | sub `0x05` | `05 01` | `mode/mic/SubModeMic.java` (no `0x13` music sub-mode in this family) |
| scene | sub `0x04` | `04 effectLo effectHi` | `mode/scenes/SubModeScenes.java` |
| new DIY | sub `0x0A` | `0A diyLo diyHi` | `mode/diy/SubModeNewDiy.java` |
| IC check | `0x33/0x43` | `[0] start? ,[1] count?, [2] segment?` (CheckIcController q) | `h61d3`-style; this split `ble/BleProtocol.CHECK_IC=67` |
| cut calibration | `0x33/0x44` (V1) / `0x46` (V2) | `[0] 0/1/2`, `[1] index`, `[2] count` | `BleProtocol.CUT_CALI/CUT_CALI_V2`; `h7075/h7078/controller/*`, `h705a`-shared |
| connector / splicing | `0x33/0x40` | `{2,0}` exit/query; `{2,1,R,G,B}` set group colour; `{count}` device count | `h7078/controller/SplicingController.java`, `SplicingNewController.java` |
| change splicing (multi) | `0x5F` | multi-packet: `[idx][direction mask][MAC×6]...` | `h7078/controller/ControllerChangeSplicing.java`, `BleProtocol.MULTI_DEVICE_SPLICING=95` |
| read splicing state | `0xAA/0x4B` | empty | `Controller4ReadSpliceState` (cmd 75) |
| read sub-device version | `0xAA/0x4C` | empty | `ControllerReadSubDeviceVersion` (cmd 76) |
| motion switch | `0x33/0x47` | payload per `MotionMode*` (toggle/enter) | `Controller4MotionSwitch` (cmd 71), `BleProtocol.SINGLE_MOTION_SWITCH` |
| motion delete | `0x33/0x48` | `MotionConstants.a.e(id)` (4-byte id LE) | `Controller4DeleteMotion` (cmd 72) |
| exit motion preview | `0x33/0x49` | empty | `Controller4ExitMotionPreview` (cmd 73) |
| stop light effect | `0x33/0x25` | `01` | `Controller4StopLightEffect` (cmd 37) |
| install direction | `0x33/0x16` | `[0] 1/2` | `BleProtocol.SET_INSTALLATION_DIRECTION=22` |
| read segment light | `0xAA/0xA1` | index payload | `BleProtocol.READ_SEGMENT_LIGHT=-95` |
| read/notify IC | notify `0x21` | `[0..1] IC LE16`, `[2] segment count` | base `CheckIcNumParse` |
| brightness notify | notify `0x20` | `[0] brightness` | base `BrightnessNotifyParse` |
| motion info read | `0xAA/0x05` | empty; response `[0] groupCount`, then `groupCount × 6` bytes: `motionId` LE32 + `versionCode` LE16 | `h7078/controller/MotionReadInfoController.java`, `motion/MotionConstants.java` |
| light sensor (H7072) | `0xAA/0x4B` | empty read; response `BrightnessInfo` (env low/high/cur, device low/high, switch, schedule) | `h7072/sensor/BrightnessController.java`, `BrightnessInfo.java` |
| light-sense model (R3352) | `0x33/0x24` | `[0] 0x24 [1] enable [2] min gear 0..3 [3] max gear 0..3 [4] all-day [5..6] time LE16` | `r3352/protocol/R3352LightSenseInfo.java`, `R3352SensorProtocol.b=36` |
| auto-dimming (R3352) | `0x33/0x25` | `[0] 0x25 [1] enable [2] min brightness 1..100 [3] max [4] effect-time index` | `r3352/protocol/R3352AutoDimmingInfo.java` |
| H3351 gear brightness | `0x33/0x04` | brightness level only (gear slider remaps) | `h3351/sensor/GearBrightnessSliderView` |
| H2800 online music | `0xA3` multi | scene controller with commandType 0x58 + studio scene bytes | `h2800/H2800OnlineMusicConfig.java` |

### Motion payload encoding (H7078)

`MotionConstants.d(sceneDeviceBean)` builds the motion effect body:

```
sceneCode LE16 | musicCode LE16 | commandType | bodyLen LE16 | body
```

If the scene controller's commandType is 12 (`0x0C`) the first byte of `getValue()` is used as the
command type and the rest as body. Motion IDs are 4-byte little-endian; version codes are 2-byte
little-endian (`MotionDeviceInfo`).

### Splicing

- `SplicingController`/`SplicingNewController` (0x40): payload `02 00` (exit/query) or
  `02 01 R G B` (set spliced group colour).
- `ControllerChangeSplicing` builds a `MultiController` with commandType
  `MULTI_DEVICE_SPLICING=0x5F`: `[index][direction][MAC...]`.
- `Controller4ReadSpliceState` (0x4B) returns `[0]==1` spliced.

---

## 3. BLE notifications / readings

`AbsController.m()` strips the 20-byte header. Notifications are dispatched by `cmdType`:

| reading | op | layout | source |
|---|---|---|---|
| brightness | `0x20` | `[0]` | base `BrightnessNotifyParse` |
| IC / segment count | `0x21` | `[0..1]` LE16 IC count, `[2]` segment count | base `CheckIcNumParse` |
| device status | `0x30` | `[0]==1`, `[1]` bit1 = light on | `DeviceStatusNotifyParse` |
| splice state | `0x4B` | `[0]==1` | `Controller4ReadSpliceState` |
| motion devices | `0x05` | groupCount + 6-byte records | `MotionReadInfoController` |
| brightness sensor | `0x4B` | `BrightnessInfo` (see below) | `h7072/sensor/BrightnessInfo` |
| light sense | `0x24` | `[0] enable,[1] minGear,[2] maxGear,[3] allDay,[4..5] time` | `R3352LightSenseInfo` |
| auto dimming | `0x25` | `[0] enable,[1] min,[2] max,[3] effectTime` | `R3352AutoDimmingInfo` |
| sub-device version | `0x4C` | ASCII/version bytes | `ControllerReadSubDeviceVersion` |
| heart | `0x01` | base `HeartController` | `mode/*` |

`BrightnessInfo` fields: environment low/high/current brightness, device low/high brightness,
switch state (0 off, 1 on, 2 outside threshold), start/end hour/minute, day bitmask, all-time
flag, auto-close-light flag, effect-time bean, timestamp. Sensor read is `0x4B`.

---

## 4. IoT commands + status/readings schema

Envelope **`IotMsgV2`** (all `Iot*CmdBuilder` return `IotMsgProType.V2`). Commands:
`turn {val}`, `brightness {val}`, `colorwc {color,colorTemInKelvin}`, `ptReal {command:[base64]}`,
`status`, `online`. No family-specific `iot/Cmd*.java`; `pact/Comm` uses base
`CmdTurn/CmdBrightness/CmdColorWc` and base `CmdPtReal`.

| cmd | data | response | source |
|---|---|---|---|
| `turn` | `{"val":0\|1}` | `state` | base `CmdTurn` |
| `brightness` | `{"val":1..100}` | `state` | base `CmdBrightness` |
| `colorwc` | `{"color":{"r","g","b"},"colorTemInKelvin":int}` | `state` | base `CmdColorWc` |
| `ptReal` | `{"command":["<base64 20-byte>",...]}` | `op.pt[]` | base `base2light.pact.iot.CmdPtReal` |
| `status` | `{}` | `state/op` | base `AbsDeviceModel4BleIot` |

`ptReal` builders: DIY protocol (`getDiyCmdPt`), graffiti (`getDiyCmdPt4DiyGraffiti`), DIY
studio/template (`getDiyTemplateCmdPt`), new scenes (`getNewScenesCmdPtReal`), DIY send-data.
Large graffiti is capped at 19 commands; larger effects fall back to `ptUrl` in the base library.
Status parsing is base `state/op` + per-frame parsers; motion/sensor sub-records are exposed by
the respective controllers.

---

## 5. Other protocols

- **Matter** — `pact/MatterSupport` (goodsType 205, version-gated) and
  `pact/BatchMatterWifiConfig` (goodsType 383). Commissioning only; runtime control is BLE/IoT.
- **WiFi/LAN** — `Support.setDynamicApi()` registers dynamic-domain names H7075/H7078/H7072/H3700
  for LAN routing; MQTT capability comes from base `DeviceCommCapability`.
- **HTTP** — `h7078/network/DeviceApi` (device list, splice info, sub-device soft version check),
  OTA check endpoints in base.
- **Multi-device combine** — `h3751/combine/CombineDeviceController` (H3751), splicing 0x40/0x5F.
- **Camera/vision** — H7078 motion mode uses motion device records; no camera stream in this split.
- **Online music** — H2800 `H2800OnlineMusicConfig` sends a scene controller with an embedded
  studio scene (`commandType 0x58`).

---

## 6. Dynamic effects / motion / music / scenes / DIY

### Colour sub-mode `0x15` (all SKUs)

17-byte `getWriteBytes()`:

| mode | bytes |
|---|---|
| 1 RGB+temp | `15 01 R G B kelLo kelHi R2 G2 B2 m0 m1 m2 m3` (mask = 32 segments across 4 bytes; 24/32 used depending on colour size) |
| 2 brightness | `15 02 level m0 m1 m2 m3` |
| 3 per-segment brightness | `15 03 idx b0..b13` (14 brightness bytes) |
| 4 per-group RGB | `15 04 group idx R G B ×4` (12 bytes) |

Parse (`parse`): `[0]` type, `[1..2]` Kelvin LE16 if type 1.

### Mic / music-reactive sub-mode `0x05`

`05 01` (enter mic/sound-reactive mode). This family declares `BleProtocol.sub_mode_music=0x13`
but has no `mode/music` sub-mode class and `Mode.parseSubMode` never dispatches `0x13`; music UI
is implemented as the mic mode. There is no per-effect music code/sensitivity payload here.

### Scenes `0x04` / DIY `0x0A`

`04 epLo epHi`, `0A diyLo diyHi` — 16-bit LE effect/Diy codes. Scene op sets:
H7076/H2800 `{0,1,2,3,5,6}`, H3700 `{0,1,2,3,6}`, others `{0,1,2,3,5}`.

### DIY / effect code universes

| SKU group | effect codes | protocol code | source |
|---|---|---|---|
| H7075 | DIY rainbow/basic pages; `EffectOp4BleIot` | `0x56` (86) | `adjust/h7075/diy/H7075DiyParse.java` |
| H7072 | `765` + `0` placeholder | base DIY | `h7072/diy/H7072DIyConfig.java` |
| H7076 | base DIY config (`0` placeholder) + graffiti | base / server | `h7076/mode/diy/H7076DiyConfig.java` |
| H7078 | base DIY config (`0`), block/rainbow sub-effects | base / server | `h7078/diy/H7078DiyConfig.java`, `H7078DiyParseRainbow.java` |
| H707A/B/C | base DIY config (`0`), advanced effects (breath/flow/fireworks/yuedong) | `0x58` for advanced/graffiti | `h707A/mode/diy/*` |
| H3751 | base DIY new config (`0`), layered graffiti | base / server | `h3751/diy/H3751DiyNewConfig.java` |
| H3351 | base DIY new config (`0`) | base / server | `h3351/H3351DiyNewConfig.java` |
| H2800 | `960` basic, `963` graffiti, `0` none | `0x58` for studio scene | `h2800/diy/H2800DiyNewConfig.java`, `H2800OnlineMusicConfig.java` |
| H3700 | `999` simple, `9998` sub-effect, `10001` advanced | `0x58` (simple/advanced), `0x00` sub | `h3700/H3700DiyConfig.java`, `h3700/diy/*` |
| R3352 | base DIY new config (`1..N` sub effects) | base / server | `r3352/R3352DiyNewConfig.java` |

H7076/H707A/H7078 sub-effect classes: `SubEffectGifConfig` (1..18), `SubEffectConfig`,
`EffectTypeH707A` / `SubEffectType` (collision, diffusion, fireworks, flow, yuedong), block
colour + rainbow for H7078. H3700 has a tuple codec (`H3700DiyCodec`, `BottomEffectData`,
`BottomMotionData`, `BottomPartitionData`, `TopOrSameEffectData`, `ColorPairData`) for its
top/bottom zones.

### Motion (H7078)

Motion IDs 4-byte LE; version 2-byte LE. Motion effects carry `sceneCode LE16 | musicCode LE16 |
commandType | length LE16 | body`. Motion switch `0x47`, delete `0x48`, exit preview `0x49`,
read info `0x05`; motion preview exit notify `0x49`. Timer and brightness thresholds are local
`MotionTimer`/`MotionLightThresholdSliderView` values.

---

## 7. Source map (traced)

- Registration/SKUs: `pact/{Support,SubLib,SubMaker,Register4Item,Model,MatterSupport,BatchMatterWifiConfig}.java`,
  `pact/ItemH*.java`, `pact/R3352{DeviceItem,Model}.java`
- Transport/mode: `ble/Ble.java` (base `AbsBle`), `mode/{Mode,ModeController}.java`,
  `mode/color/SubModeColor.java`, `mode/mic/SubModeMic.java`, `mode/scenes/SubModeScenes.java`,
  `mode/diy/SubModeNewDiy.java`
- H7078 motion/splicing: `h7078/controller/*`, `h7078/motion/*`, `h7078/diy/*`
- H7072 sensor: `h7072/sensor/{BrightnessController,BrightnessInfo,EffectTime}.java`
- H7076/H707A: `h7076/mode/diy/*`, `h707A/mode/diy/*`, `h707A/setting/*`
- H3700: `h3700/*`, `h3700/diy/codec/*`
- H3751/H3351/H2800: `h3751/*`, `h3351/*`, `h2800/*`
- R3352: `r3352/*`, `r3352/protocol/*`

## 8. Gaps / unknowns

- Scene effect IDs are cloud (`ScenesM`) values; only op sets/defaults are static.
- `BleProtocol.sub_mode_music=0x13` is declared but unused; H7075 has only the mic sub-mode `0x05`.
- `Support.getColorSize` is goodsType-based; H707X per-device segment counts come from
  `SegmentIcDataCache` (runtime).
- H7075/H7076/H7078/H707A/H3751/H3351/R3352 DIY effect-code lists are largely server/base-config
  driven; only H7072/H2800/H3700 expose explicit integers here.
- The exact `CheckIcController`/`CutCaliController` payload semantics for this split are shared
  with the H705A code base; only the opcodes (0x43/0x44/0x46) and the general `[mode,index,count]`
  shape are certain.
- H3351 gear-brightness mapping is UI-side (`GearBrightnessSliderView`); device payload is plain
  brightness.
- Matter clusters/attributes are not in this split (commissioning only).
- H7078 motion timer/threshold payloads are runtime structures (`MotionTimer`, `MotionMode*`),
  not fully expanded to fixed bytes.
