# split_pact_tvlightv4 — TV backlights / camera DreamView (v2, v3, v4)

Source root: `decompiled/jadx-splits/split_pact_tvlightv4/sources/com/govee/`.
This split bundles **three generations** of the TV-backlight pact:

| class package | goodsType | products | generation |
|---|---|---|---|
| `pact_tvlightv2` | 24 | H6199 (DreamView T1), H6198 (DreamView T1S) | v2 |
| `pact_tvlightv3` | 23 / 52 / 112 | H6053 (RGBIC TV Light Bars), H6056 (RGBIC TV Light Bars), H6046 (RGBIC TV Light Bars) | v3 |
| `pact_tvlightv4` | 25 | H6054 (DreamView P1), H6049 (DreamView P1S) | v4 |

Confirmed by `Support.addSupportPact()` of each sub-package, `sku/…` constants and
`decompiled/apktool-base-7.7.10/assets/categories.json` (goodsType per SKU).

Transport per generation:

- **v2 (24)** — `ble + iot`: `pact_tvlightv2/pact/EffectOp4BleIot.b()=24`, `supportBle()` and
  `getRoomOp4Iot()` both implemented, and the app registers both `Ble*CmdBuilderV1` and
  `Iot*CmdBuilderV1` (`TvV4ApplicationImp.java`).
- **v3 (23)** — `ble` only: `pact_tvlightv3/pact/EffectOp4Ble.b()=23`, no `*IotCmdBuilder` for
  goodsType 23. `getSupportScenesOpSet` only.
- **v3 (52, 112)** — `ble + iot`: `EffectOp4BleIot.b()={52,112}`; `Pact` registers 2/1 and 3/1
  protocols for 52.
- **v4 (25)** — `ble + iot`: `pact_tvlightv4/pact/EffectOp4BleIot.b()=25`;
  `AbsEffectOp4BleIot.supportWifi()=true`, `supportBle()=true`.

No WiFi/MQTT/matter code in this split. "WiFi" appears only as the `WifiNotifyParse` BLE
notification (0x11) and the device's WiFi version fields.

---

## 1. Transports & GATT UUIDs

All three generations use the vendor GATT pair:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `pact_tvlightv2/ble/BleComm.java`, `pact_tvlightv3/ble/BleComm.java`,
`pact_tvlightv4/ble/BleComm.java`, `pact_tvlightv4/ble/BleMultiComm.java`.
Notify uses the same characteristic (`BleNotifyComm.getServiceUuid()`); v4's notify list is
`WifiNotifyParse` + base `DeviceStatusNotifyParse`
(`pact_tvlightv4/ble/BleNotifyComm.java`).

BLE frame is the shared 20-byte frame: `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC`.
Writes use proType `0x33`; reads use `0xAA` (`AbsSingleController.getValue()` /
`pact_tvlightv4/ble/Parser.java` copies bytes 2..18 into 17 valid bytes).
Multi-frame writes use proType `0xA3`/`0xA4`/`0xA5` (`MultipleBleBytes`,
`MultipleControllerCommV1`), still 20 bytes each.

---

## 2. BLE command table

| command | op (write / read) | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` (`0xAA/0x01` read) | `[0] 00=off 01=on` | base `ble/controller/SwitchController` via each `Comm` |
| brightness | `0x33/0x04` (`0xAA/0x04`) | `[0] level`. v4 `Support.getBrightnessRange()` = 20..254, value is sent raw (no remap for pactV1). v2: if pact V1 (`1,1`) `NumUtil.calculateProgress(max,min,v)`; otherwise 20..254 / progress range `{0,1,100}` depending on pact. v3 same 20..254. | `pact_tvlightv4/pact/Comm.java`, `pact_tvlightv2/pact/Comm.java`, `pact_tvlightv3/pact/Support.java` |
| heart / status | write `0x33/0x01` payload on/off; read `0xAA/0x01` | v4 `TvHeartController` cmdType 51 (`0x33`), parse `[0]` state (`0x11`/`0x01`/`0x10`/`0x00` -> both/on/off/none) and `[1]` feast flag; v3 same; v2 base `HeartControllerV2` | `pact_tvlightv4/ble/TvHeartController.java`, `pact_tvlightv3/ble/TvHeartController.java`, `pact_tvlightv2/ble/BleComm.java` |
| mode container (color/music/scene/DIY/video) | `0x33/0x05` (`0xAA/0x05` read; read `p()` = `{1}`) | `[2..]` = sub-mode payload (see §5). Read returns `[0]=subMode` + payload. | base `AbsModeController` + each `ModeController` |
| all-light switch (v3/v4) | `0x33/0x33` | `[0] 00 both off / 01 main on / 10 background on / 11 both on` | `pact_tvlightv3/ble/SingleLightController.java`, `pact_tvlightv4/ble/SingleLightController.java` |
| swap light position (v3/v4) | `0x33/0x34` | empty payload | `SwapLightController` |
| light direction (v3/v4) | `0x33/0x30` | `[0] direction (0/1)`; response `[0]` | `LightDirectionController` (v4; v2 family has same class) |
| camera position (v2/v4) | `0x33/0x31` | `[0] cameraPos`; response `[0]` | `pact_tvlightv4/ble/CameraPosController.java`, `pact_tvlightv2/ble/CameraPosController.java` |
| check camera (v2/v4) | `0x33/0x32` (empty) | response `[0]` 0/1 | `CheckCameraController` |
| start time / calibration time (v4) | read `0xAA/0x35` | response `[0]` seconds/percent 0..255 | `pact_tvlightv4/ble/StartTimeController.java` |
| start time (v2) | read `0xAA/0x34` | response `[0]` | `pact_tvlightv2/ble/StartTimeController.java`; `StartTimeControllerV1` is `0xAA/0x35` |
| gradual switch (v2) | write `0xA3/0xA3` (`SINGLE_GRADUAL_CHANGE = -93`) | `[0] 0/1` | `pact_tvlightv2/ble/GradualController.java` |
| white balance (v4, via base) | `0x33/0xA9` | `00 03 <auto?0:1> <R> <B>` (classic), `06 01 <progress>` (infinite), `0F 03 <R> <G> <B>` (advanced) | base `WhiteBalanceVmInterface`, `Info4Detail.parseWhiteBalance` |
| whole-RL brightness (v4) | `0x33/0xA9` | `02 01 <level>` / read `02` | `WholeRLBrightnessVmInterface` |
| black-border remove (v4) | `0x33/0xA9` | `0B 01 <flag>` / read `0B` | base `BlackBorderRemoveController` |
| sensitivity | `0x33/0xA9` | `01 01 <value>` / read `01` | `VideoSensitivityController` |
| colour calibration | `0x33/0xA9` | `05 03 <R> <G> <B>` / read `05` | `ColorCaliController` |
| device black screen | `0x33/0xA9` | `0A 06 <enable> <mode> <startLo> <startHi> <endLo> <endHi>` / read `0A` | `balckscreen/BlackScreenController` |
| HDR calibration | `0x33/0xA9` | `0D` read/write | `HDRCaliController` |
| saturation | `0x33/0xA9` | `0E 01 <value>` / read `0E` | `VideoSaturationController` |
| AI filter | `0x33/0xA9` | `10 0F <enable> <R> <G> <B> <saturation> <code LE16> <autoClose LE16> <time LE16> <tz0..3>` / read `10` | `AiFilterController` |
| HDR effect / contrast | `0x33/0xA9` | `11 02 <enable> <level>` / read `11` | `VideoHdrEffectController` |
| sound-effect mic | `0x33/0xAC` | `<micIndex>` | `SoundEffectVmInterface` |
| relative/segment brightness | `0x33/0xAE` | `01 <4|6> <v0..v3> [<v4> <v5>]` | `RelativeBrightnessController` |
| timer | `0x33/0x23` (read `0xAA/0x23`) | see base `NewTimerV1Controller`, `TimerConfig` | `Info4Detail` (`l0`) |
| sleep / wakeup | `0x33/0x11`, `0x33/0x12` | see `SleepController{,V2}` | `Info4Detail` (`j0`,`m0`) |

The full `0xA9` sub-op table and per-SKU video-mode byte orders are in
`DREAMVIEW-HDMI.md`; this split uses the camera/DreamView subset (no HDMI port select).

Multi-packet DIY / scene writes use `MultipleBleBytes.getMultipleWriteBytesV1(...)`; the final
frame of the sequence carries the mode command (0x05 with 0x04/0x0A sub-mode).
`CmdPt` uses `MultipleControllerCommV1.makeSendBytesV3((byte)-93,(byte)91,body,97)`.

### BLE notifications/readings

| notify op | layout | meaning | source |
|---|---|---|---|
| `0x11` | `[0]==0` | WiFi connected | `WifiNotifyParse` in all 3 generations |
| `0x20` | `[0]` brightness | brightness report | v3 `BrightnessNotifyParse` |
| `0x30` | `[0]==1`, `[1]` bits | device/switch status | v4 base `DeviceStatusNotifyParse`; v3 same |
| `0x32` | `[0]` | check-camera status | `CheckCameraController` |
| `0x33` | `[0]` state nibble, `[1]` feast | tv heart / power | `TvHeartController.parseValidBytes` |
| `0xAA/0x05` | `[0]` sub-mode, then sub-mode payload | mode read-back | `AbsModeController.parseValidBytes` |
| `0xAB/0x07` | `[0]=7 [1]=7 [2..]` | DSP version (low/high count) | `pact_tvlightv4/pact/Comm.java#parseDspVersion` |
| `0xAA/0xA9 0B` | `[2]==1` | black-border state | `Info4Detail.c0` |

---

## 3. IoT commands + status schema

Envelope: `CmdBuilder.makeCmdStr(AbsCmd)` → `Write.getWriteMsg4Transaction` (V0-style outbound
`{msg:{transaction,accountTopic,type,origin=32,cmdVersion,cmd,data}}`). Responses are parsed as
**`IotMsgProType.V2`** (`IotMsgV2`) by every `IotSwitchCmdBuilderV1` in this split.
Read key mapping (`iot/Cmd.getCmdReadParseKey`): `pt`/`ptReal` use `op`, everything else `state`.

| cmd | data fields | notes | source |
|---|---|---|---|
| `turn` | `val` 0/1; v4 adds `subVal:[v1,v2]` | per-light-bar on/off | `pact_tvlightv4/iot/CmdTurn.java`, v2/v3 `CmdTurn` |
| `brightness` | `val` int | range 20..254 (pactV1) / 0..100 progress | `CmdBrightness` |
| `colorwc` | `color:{red,green,blue}`, `colorTemInKelvin` (0 for RGB; Kelvin only if in device set) | used when pactV1 is false (v4 v2 package) | `pact_tvlightv4/iot/v2/CmdColorWc.java` |
| `pt` | `op`:`mode|gradual|sleep|timer|wakeup`, `value:[base64(frame),…]` | BLE frames tunneled through cloud for pactV1 devices | `pact_tvlightv4/iot/CmdPt.java` |
| `ptReal` | `command:[base64(20-byte frame),…]` | used for pactV2/V3 devices; newest successor of `pt` | `pact_tvlightv4/iot/v2/CmdPtReal.java`, v3 `iot/CmdPtReal.java` |
| `camera` | `cameraPos` int (v4) / `cameraDirection` int (v2) | camera mount position/direction | `iot/CmdCameraPos.java`, v2 `iot/CmdDirection.java` |
| `points` | `points:[{pointX,pointY}]` | calibration point upload | `iot/CmdCalibrationPoints.java` |
| `snapshot` | read-only: `snapshotUrl` | camera snapshot URL | `iot/ResultSnapShot.java` |
| `IoTConnected` | `value:[base64]` | v2 `CmdBulb` (legacy bulb passthrough) | `pact_tvlightv2/iot/CmdBulb.java` |

Read parsers:

- `ResultPtV1.command` → base64-decoded 20-byte BLE frames (`iot/ResultPtV1.java`).
- `Result4PtReal` (base) `op` → `ptBytes()` list (v4 `Info4Detail.d0`).
- `StateWithSubOnOff` (base) `state` → `onOff`, `brightness`, `subOnOff[2]`.
- `ResultCamera.cameraPos`, `ResultSnapShot.snapshotUrl`.

Status fields used by the UI: `onOff` (bool), `brightness` (int), `subOnOff[0/1]` (main/background
bars), `modeByte` + sub-mode, `videoMode` params, `timer/sleep/wakeup`, `whiteBalance`.

---

## 4. Other protocols

- **BLE broadcast add flow** — `pact_tvlightv2/add/BleBroadcastProcessor.java`,
  `pact_tvlightv3/add/BleBroadcastProcessorV1.java`, `pact_tvlightv4/add/BleBroadcastProcessor.java`
  parse the advertisement into `AddInfo` (sku, goodsType, protocol, bleName, MAC).
- **Calibration HTTP** (`pact_tvlightv4/add/net/INet.java`):
  - `GET appco/v1/calibration/point?device=&sku=` → `GetPointsResponse`
  - `POST appco/v1/calibration/point` (`UploadPointsRequest{device,sku,imgUrl,points}`)
  - `POST bi/rest/v1/calibrationPoints` (`{device,sku,deviceVersion,appVersion,url,points}`)
  - `POST device/rest/devices/v1/settings` (`LightCalibrationRequest`)
- **Movie Feast / DreamView group REST** — same shared endpoints as h6099: create/delete
  `/appsku/v1/moment/feasts`, detail/main/sub, region, music/scene feast, snapshot
  `/bff-app/v1/feast/snapshot/cmd-refactor`; bodies in `DREAMVIEW-HDMI.md` §4.1.
- No MQTT, no matter, no IR/RF in this split. (The TV split is camera DreamView, not HDMI
  sync; it does not use the HDMI port/icon endpoints.)

---

## 5. Dynamic effects / motion / music / scenes / DIY (exact payloads)

All mode payloads start at frame byte 2; the table below shows the sub-mode payload only.

### 5.1 Color

| variant | sub-mode | payload layout | notes |
|---|---|---|---|
| legacy v2 `sub_mode_color` | `0x0B` | `0B R G B kelLo kelHi mask0 mask8` (8 B) | 15 segments; mask0 = segments 0..7, mask8 = 8..14. `SubModeColor.getWriteBytes()` |
| v3/v4 `sub_mode_color` | `0x0D` | `0D sel R G B kelLo kelHi R2 G2 B2` (9 B) | `sel`: 0=none, 1=main, 16=background, 17=both. Kelvin is signed 16-bit LE; `R2G2B2` is the colour-temp colour. |
| v2 15-seg modern | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask0 mask8` (12 B) | `SubModeColorV2.e()` (v2 file) |
| v3/v4 12-seg modern | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask0 mask1` (17 B, rest 0) | masks: byte10 bits 0..7, byte11 bits 8..11. `SubModeColorV2.getWriteBytes()` |
| brightness mask | `0x15` | `15 02 level 00 mask0 mask8…` | per-segment brightness (byte2=level, masks follow). v4/v3 `SubModeColorV2`; v2 uses 12-byte form. |
| explicit RGB array | `0x15` | `15 03 c0 c1 … c11` (bytes 2..13) | 12 raw colour indices; used by DIY/scene compose. |

### 5.2 Music

`sub_mode_music = 0x0C` (old) / `sub_mode_music_new = 0x13` (new).

| form | sub-mode | payload | effect codes |
|---|---|---|---|
| v2 old | `0x0C` | `0C effect sens [dynFlag [R G B]]`; 3 B for `effect 0`, 8 B for `effect 5`, 7 B for others (`0C eff sens dyn R G B`) | `0 Energic, 2 Rolling, 3 Spectrum, 5 Rhythm` |
| v3/v4 old | `0x0C` | same 8/9-B shape; `effect 5` gets dynamic flag at `[3]`, RGB at `[6..8]` | v3/v4: `0/5/6/7` plus `73 Beat, 80 Torch, 81 Rainbow Circle, 82 Shiny` |
| v4 new | `0x13` | `13 effect sens [dyn] [sel R G B]`; 9 B when `effect==3`, 8 B for `5/8/9`, else 3 B | `3 Rhythm, 5 Energic, 8 Rolling, 9 Spectrum`, plus `73/80/81/82`; `sel` = 0/1/16/17 (same bar mask semantics) |
| v2 new | `0x13` | `13 effect sens 10 dyn R G B` (8 B) | `3/5/6`, default `effect=5`, `c=0x10` fixed |
| v3 music-v3 | `0x13` | same as v4 new | `SubModeMusicV3`; `ParamsSubMode4Music.a(version)` selects V2 vs V3 parser by `version==2` |

Sensitivity is `0..99` (`Math.max(0,Math.min(x,99))`). `dynamic`/`autoFlag` = 0 means manual
colour, non-zero means device-driven colour.

### 5.3 Scenes

`sub_mode_scenes = 0x04`, payload `04 effectLo effectHi [musicCode]`.

- v2/v3/v4 plain: 3 bytes (`SubModeScenes.getWriteBytes()`).
- H70B1/H70B3 origin family adds a music byte (not this split).
- Effect id is a 16-bit LE scene/DIY-template code. The static TV scene menu is
  `ScenesV0.scenesEffectSet = {13,4,9,7,24,10,16,15,29,30,21,22}` →
  Reading(13), Film(4), Colorful(9), Romantic(7), Meteor(24), Breath(10), Energetic(16), Snow(15),
  Seasons(29), Stream/Bloom(30), Chase(21), Stream(22) (names from base
  `base2light/ble/scenes/ScenesStr.java`).
- A scene may expand into a multi-frame effect (`ScenesOp.parseSceneV1(...,{1,2})`); first frames
  are `0xA3/0xA4` chunks, last frame is the 0x05 mode frame carrying `04 <code>`.

### 5.4 DIY

`sub_mode_new_diy = 0x0A`, payload `0A diyLo diyHi` (16-bit LE DIY code).
DIY bodies are written before the mode frame with `MultipleBleBytes.getMultipleWriteBytesV1`
(`CmdPtReal.getDiyCmdPt`, `getDiyTemplateCmdPt`). DIY template effects reuse `0x04`.

### 5.5 Video / camera mode (DreamView)

Container: `0x33/0x05` + sub-mode `0x00`. The payload is built by
`VideoVm.B()` → `Controller4ExtBytes({5, 0, ...})`.

| generation | payload after `05` | fields |
|---|---|---|
| v4 (`VideoVm.N`) | `00 <screenState> <drama> <vivid> <voiceOn> <voice> <rlBrightness>` | `screenState`: 0=part,1=all,2=full-screen; `drama`: 0=movie,1=game; `vivid` 1..100; `voiceOn` 0/1; `voice` 0..100; `rlBrightness` 0..100 |
| v2 (`VideoVm.N`) | `00 <screenState> <drama> <vivid> <voiceOn> <voice> <rlBrightness>` | same order; older `SubModeVideo` uses `00 gameOrAll drama vivid voiceOn voice rlBrightness` |
| v4/V2 legacy (`SubModeVideoV2`) | `00 <screenState> <drama> <vivid> <voiceOn> <voice> <rlBrightness>` | parser-only class; same byte order |

Parsers validate vividness to `1..100`. Read-back path:
`Info4Detail.g0()` → `[0]=0x00` → `VideoModeControllerParams` from `bArrS[0..5]`.

The video UI also exposes the shared camera settings: sensitivity `0xA9/01`, whole-RL
brightness `0xA9/02`, colour calibration `0xA9/05`, white balance `0xA9/00|06|0F`,
black-border remove `0xA9/0B`, black screen `0xA9/0A`, HDR calibration `0xA9/0D`,
saturation `0xA9/0E`, AI filter `0xA9/10`, HDR effect `0xA9/11`, sound-effect mic
`0xAC`, and relative brightness `0xAE`. See `DREAMVIEW-HDMI.md` §1–§2 for exact payloads.

### 5.6 Camera / direction / calibration

- camera position: `0x31`, 1 byte 0/1 (main/background camera), also `camera` IoT field.
- light direction: `0x30`, 1 byte.
- check camera: `0x32`, no payload, response 1 byte.
- start time: read `0x35` (v4) / `0x34` (v2); used to seed video sync.
- calibration point upload is HTTP, not BLE.

---

## 6. Source map (traced)

- SKU/pact support: `pact_tvlightv2/pact/Support.java`, `pact_tvlightv2/pact/deviceitem/SubLib.java`,
  `pact_tvlightv3/pact/Support.java`, `pact_tvlightv3/pact/deviceitem/SubLib.java`,
  `pact_tvlightv4/pact/Support.java`, `pact_tvlightv4/pact/SubLib.java`
- BLE builders → Comm: `pact_tvlightv*/scenes/*.java` → `pact_tvlightv*/pact/Comm.java`
- BLE protocol constants: `pact_tvlightv2/ble/BleProtocol.java`, `pact_tvlightv3/ble/BleProtocol.java`,
  `pact_tvlightv4/ble/BleProtocol.java`
- controllers: `pact_tvlightv*/ble/{CameraPos,CheckCamera,LightDirection,StartTime,Gradual,SingleLight,SwapLight,TvHeart}Controller.java`
- sub-modes: `pact_tvlightv*/ble/{Mode,Mode4ColorStrip,SubModeColor,SubModeColorV2,SubModeMusic,SubModeMusicV2,SubModeMusicV3,SubModeScenes,SubModeNewDiy,SubModeVideo,SubModeVideoV2}.java`
- effects/DIY: `pact_tvlightv*/pact/{EffectOp4Ble,EffectOp4BleIot,AbsEffectOp4Ble,AbsEffectOp4BleIot}.java`,
  `pact_tvlightv*/adjust/{Diy,ui/ScenesV0}.java`, `detail/diy/H6054DiyConfig.java`,
  `pact_tvlightv2/newdetail/diy/H6199DiyConfig.java`
- IoT: `pact_tvlightv*/iot/*.java`, `iot/v2/*.java`; result parsers `ResultPtV1`, `ResultSnapShot`, `ResultCamera`
- notifications: `pact_tvlightv*/ble/WifiNotifyParse.java`, v3/v4 `BleNotifyComm.java`, v3 `BrightnessNotifyParse.java`
- detail/video: `pact_tvlightv4/detail/mode/VideoMode.java`, `VideoVm.java`,
  `pact_tvlightv4/detail/Info4Detail.java`, `pact_tvlightv2/newdetail/videomode/*`
- calibration HTTP: `pact_tvlightv4/add/net/INet.java`

## 7. Gaps / unknowns

- No static scene-name table for server scenes beyond `ScenesV0`'s 12 IDs; other effect ids come
  from `ScenesM` (cloud `categories`/scene JSON).
- `Support.getBrightnessRange`/v2 `getBrightnessRange` branch on runtime pact protocol; both
  20..254 and 0..100 progress forms exist. Which one is used depends on the device pact
  (`pactType/pactCode`) reported at runtime.
- `TvHeartController.parseValidBytes` is partly decompiler-reconstructed; byte1 is a feast flag,
  byte0 state is confirmed from v3 source.
- `0xAB` white-balance/whole-brightness/black-border controllers live in the base app; only their
  notify parsers are in this split. Their write `q()` builders were not present here.
- `CmdBulb.getCmd()` returns `Cmd.k` = `"IoTConnected"` (legacy constant, likely dead code).
