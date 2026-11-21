# split_pact_h6047 — H6047 / H6043 / H6042 / H6039 / H6038 / H6048 TV light bars & strip

Source root: `decompiled/jadx-splits/split_pact_h6047/sources/com/govee/h6047/`
Base helpers: `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/...`

## Overview / family and SKUs

`pact/Support.java` and `pact/SubMaker.java` define one ble+iot product family with six
goods-types / SKUs. All register `AbsBleIotSkuItem` (extends `AbsBleWifiSku`), i.e. every SKU
supports BLE GATT and the WiFi/cloud IoT path. `pact/EffectOp4BleIot.e()` returns
`{119, 196, 197, 277, 298, 288}`.

| SKU | goodsType | product | lights/segments | color-temp range |
|---|---|---|---|---|
| H6047 | 119 | RGBIC TV light bars (2 bars) | 10 color pieces | 2200–6500 K |
| H6043 | 196 | RGBIC TV Light Bars | 10 / 5 pieces | 2000–9000 K |
| H6042 | 197 | RGBIC TV Washer Light Bar | 5 pieces | 2000–9000 K |
| H6039 | 277 | RGBIC light string / bulb string | 12 pieces | 2700–6500 K |
| H6038 | 288 | RGBIC light string (new DIY) | 24 pieces | 2700–6500 K |
| H6048 / H8048 | 298 | RGBIC TV light bar (compose light) | 22 pieces | 2000–9000 K |

- `Support.getBulbStringMaxNum`: 119/196→10, 197→5, 277→12, 288→24, 298→22.
- `Support.getColorPieceSize`: H6038(288)→24, H6048(298)→22, else 12.
- `Support.getGoodsType4ColorSegment(String)`: "H6039"→277, "H6038"→288, "H6048"/"H8048"→298, else 196.
- `Support.isNoColorMode(sku)` (ConsV1.F="H6039", ConsV1.G="H6038") skips the trailing
  full-color `Mode` frame in multi-color-strip sends.
- H6042/H6043 support on/off memory (`Support.supportOffMemory`).
- H6048 (298) additionally supports color+brightness multi
  (`Support.checkSupportColorBrightnessMulti`).

Transports: `ble`, `iot` (WiFi cloud topic; `pact/BleIotExt` holds
`address`, `bleName`, `secretCode`, `topic`, `wifiMac`, `wifiHardVersion`, `wifiSoftVersion`).
`Model extends AbsDeviceModel4BleIot`, `pact/DeviceItem extends AbsBleIotItem`.

Pact registration (`Support.addSupportPact`): `GoodsType.beProtocol(1,1)` for 119/288/298,
`(1,1)+(2,1)` for 196/197, `(1,1)+(2,1)` for 277 (see `pact/Support.h..n`).

## Transports & GATT UUIDs

- Service: `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic: `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/BleComm.java`, `ble/BleMultiComm.java`, `ble/BleNotifyComm.java` all use these.
- Multi-packet: `Ble.v()` → `BleMultiComm extends AbsMultipleBleComm`; notify on the same
  characteristic. `Ble.u()` → `AbsBle.BlePtRealMultiComm` (BLE frames tunnelled via ptReal).
- Notify parsers (`ble/BleNotifyComm.c()`): `WifiNotifyParse`, base `DeviceStatusNotifyParse`,
  base `MovieFeastOnOffNotifyParse`, `H6048OnOffNotifyParse`.
- Heart: `ble/BleComm.l()` returns `ComposeLightHeartController` (cmdType 54, read-only).

## BLE frame + command table

Frame (`com.govee.base2kt.utils.BleUtils.generate20Bytes`):
`[0]=proType`, `[1]=cmdType`, `[2..18]=payload`, `[19]=XOR BCC(0..18)`.
Write proType `0x33`, read proType `0xAA` (`AbsSingleController.getProType`).

`ble/BleProtocol.java` constants are used as **cmdType or sub-mode values**:

| const | dec | hex | use |
|---|---|---|---|
| MSG_TYPE_READ_LIGHT_DIRECTION | 48 | 0x30 | H6048 bar on/off read |
| MSG_TYPE_CAMERA_POSITION | 49 | 0x31 | camera position (TV cam) |
| MSG_TYPE_READ_INSTALL_CAMERA | 50 | 0x32 | read camera install |
| MSG_TYPE_READ_START_TIME | 53 | 0x35 | read start time |
| sub_mode_video | 0 | 0x00 | video/music-visual sub-mode |
| sub_mode_scenes | 4 | 0x04 | scenes sub-mode |
| sub_mode_new_diy | 10 | 0x0A | new DIY sub-mode |
| sub_mode_music | 19 | 0x13 | music sub-mode |
| sub_mode_color | 21 | 0x15 | color sub-mode |
| sub_switch / value_compose_light_switch | 54 | 0x36 | compose-light left/right switch + heart |
| value_multiple_ble_diy | 2 | 0x02 | multi DIY |
| value_multiple_set_music | 65 | 0x41 | on/off-memory read, music multi |
| value_swap_light_pos | 52 | 0x34 | swap left/right light position (write only) |
| value_calibration | 68 | 0x44 | calibration write |
| value_white_balance | -87 | 0xA9 | white balance |
| value_calibration_status | 36 | 0x24 | calibration status notify |
| value_check_light / value_logo | -86 / -90 | 0xAA / 0xA6 | check light / logo |
| value_check_light_notify | 35 | 0x23 | check-light notify |
| value_check_pods / notify | -88 / 36 | 0xA8 / 0x24 | pods check |
| value_check_usb / state | 56 / 55 | 0x38 / 0x37 | USB check |
| value_sub_mode_music_rhythm | 75 | 0x4B | music effect "Rhythm" |
| value_sub_mode_music_liuying | 81 | 0x51 | "Luminous" |
| value_sub_mode_music_huoju | 80 | 0x50 | "Torch" |
| value_sub_mode_music_cuican | 49 | 0x31 | "Shiny" |
| value_sub_mode_music_shengdong | 101 | 0x65 | "Energic" |
| value_sub_mode_music_jump_ball | 102 | 0x66 | "Jump Ball" |
| value_sub_mode_music_jiepai | 103 | 0x67 | "Beat" |
| value_sub_mode_music_caihongquan | 104 | 0x68 | "Rainbow Circle" |
| SINGLE_GRADUAL_CHANGE_4_WIFI_BLE | -93 | 0xA3 | multi-packet V1 proType |

Derived commands (controller → `getCommandType()`):

| command | op | payload | response / parse | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `[0]=0|1` | read `0xAA/0x01` → `[0]!=0` | base `SwitchController.java`; `scenes/BleSwitchCmdBuilderV1.java` |
| heartbeat | read `0xAA/0x01` | none | `[0]!=0` | base `HeartController`; `scenes/BleHeartCmdBuilderV1.java` |
| brightness | `0x33/0x04` | `[0]=0..100` | read `0xAA/0x04` → `[0]` | base `BrightnessController`; `scenes/BleBrightnessBuilderV1.java` |
| mode container | `0x33/0x05` | sub-mode block (below) | read `0xAA/0x05`, `p()={1}`, parse `validBytes[0]`=sub-mode | `ble/ModeController.java`, base `AbsModeController` |
| compose-light L/R | `0x33/0x36` | `[0]=left, [1]=right` | notify/read `0xAA/0x36` → `[0]` left, `[1]` right | `ble/controller/ComposeLightController.java` |
| compose-light index | `0x33/0x36` | `[0]=index(0|1), [1]=state` | parse event | `ble/controller/ComposeLightControllerV1.java` |
| compose heart | read `0xAA/0x36` | none | `[0]`=tvLeft, `[1]`=tvRight, `[2]`=feastOpen | `ble/controller/ComposeLightHeartController.java` |
| on/off memory read | `0xAA/0x41` | `{2}` | event | `ble/controller/Controller4OnOffMemory.java` |
| swap light position | `0x33/0x34` | empty | write only | `ble/controller/SwapLightController.java` |
| calibration | `0x33/0x44` | `[0]=flag` | write-result / `0x24` notify | `ble/controller/CalibrationController.java` |
| H6048 bar on/off | read `0x30` | — | raw 20B notify `[2]=barA, [3]=barB` | `ble/H6048OnOffNotifyParse.java` |

`ble/H6048OnOffNotifyParse` is the only parser that indexes the **raw 20-byte** notification
(not the 17-byte stripped buffer): `bArr[2]==1`, `bArr[3]==1`.

### Sub-mode payloads (cmdType 0x05)

Color (`ble/SubModeColor.java`, `subModeCommandType()=0x15`):

```
[0]=0x15
if per-group brightness mode (f!=0 || bg set):
  [1]=02 [2]=brightnessGroup [3..] selected-segment bitmask
else:
  [1]=01 [2..4]=R G B
  if colorTemp!=0: [5..6]=kelvin LE16, [7..9]=temp R G B
  [10..] selected-segment bitmask (1 bit/segment, up to 24 segments; >16 uses makeSelectedBytes)
```

- Segment bitmask helpers: `BleUtils.makeSelectedTwoBytes` (≤16) / `makeSelectedBytes` (>16).
- Segment length = `Support.getGoodsType4ColorSegment(...)` (10/12/22/24).
- Multi-group send: `SubModeColor.makeSubModeColor(Colors, goodsType)` groups segments by color
  and by brightness into one `Mode4ColorStrip`+`ModeController` per group; last frame sets
  `Mode4ColorStrip.a=true`, brightness-group frames set `b=true`.
- Parse (`SubModeColor.parse`): `[0]`=group no., `[1..2]`=kelvin LE16, `[3..4]`=second kelvin LE16.

Scenes (`ble/SubModeScenes.java`): `[0]=0x04 [1]=effectLo [2]=effectHi` (16-bit LE, default 22).
Parse is `getSignedShort(bArr[1], bArr[0])` (LE).

New DIY (`ble/SubModeNewDiy.java`): `[0]=0x0A [1]=diyLo [2]=diyHi` (16-bit LE).
Local code cached in `ble/DiyLocal{diyCode,diyValueKey}`.

Video (`ble/SubModeVideo.java`, `subModeCommandType()=0x00`); the shared new-detail
video-mode/settings path is catalogued in `DREAMVIEW-HDMI.md`:

```
[0]=00 [1]=musicVisualOn [2]=speed(1..100) [3]=effectMode(all/part)
[4]=allPartFlag [5]=sensitivity(0..99) [6]=extra
```

Music (`ble/SubModeMusic.java`, `subModeCommandType()=0x13`):

```
[0]=0x13 [1]=sensitivity(0..99) [2]=effectId
[3]=rhythmDynamicFlag (only when effectId==75)
[4]=musicColorFlag [5]=inverseFlag
```

Effect ids: 75 Rhythm, 80 Torch, 81 Luminous, 101 Energic, 102 Jump Ball, 103 Beat,
104 Rainbow Circle, 49 Shiny (default). `getAnalyticModeName()` maps these names.

## BLE notifications / readings

| notify cmdType | parser | layout |
|---|---|---|
| 0x11 (17) | `ble/WifiNotifyParse` | `[0]==0` → WiFi connected |
| 0x40 (64) | base `DeviceStatusNotifyParse` | first 10 bytes → `EventDeviceStatus` |
| 0x60 (96) | base `MovieFeastOnOffNotifyParse` | `[0]==1`, `[1]==1` → movie-feast on |
| 0x30 (48) | `ble/H6048OnOffNotifyParse` | raw `[2]`, `[3]` bar on/off booleans |
| 0x01 (1) | base switch/heart | `[0]!=0` |
| 0x04 (4) | base brightness | `[0]` 0..100 |

`ble/Parser.validBytes17()` = copy bytes 2..18 of a raw 20-byte packet (read header strip).

## IoT commands + status/readings schema

`iot/Cmd.java`: `state`, `op`, `online`, `turn`, `color`, `brightness`, `status`, `points`,
`ptReal`, `ptIot`, `colorwc`.

Envelope: `CmdBuilder.makeCmdStr(AbsCmd)` → `Write.getWriteMsg4Transaction(null, cmd)`
(`msg.transaction`, `msg.accountTopic`, `msg.type=1`, `msg.origin=32`, `msg.cmdVersion`,
`msg.cmd`, `msg.data`). Reads use type 0.

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0|1}` | `iot/CmdTurn.java` |
| `brightness` | `{"val":0..100}` | `iot/CmdBrightness.java` |
| `colorwc` | `{"color":{"red","green","blue"},"colorTemInKelvin":int}` | `iot/CmdColorWc.java` (colour → `colorTemInKelvin=0`; kelvin → white RGB) |
| `ptReal` | `{"command":["<base64 20-byte BLE frame>", ...]}` | `iot/CmdPtReal.java` (single controller, `AbsController[]`, `List<byte[]>`, scenes/DIY/multi-colour) |
| `status` | device status event; `op` carries device frames | `iot/OpColorCommDialog4BleIot` etc. |

`iot/CmdPtReal` builders:
- `new CmdPtReal(AbsSingleController)` / `new CmdPtReal(byte[])` / `new CmdPtReal(AbsController[])`.
- `getNewScenesCmdPtReal(AbsMultipleControllerV14Scenes)` – multi-packet scene frames + final
  `SubModeScenes` frame with effect id.
- `getColorStripCmdPtReal4Square(...)` – colour-strip multi frames + (unless no-colour-mode)
  final `SubModeColor` frame.
- `getColorStripCmdPtRealNoColorMode4Square(...)` – without the trailing color frame.
- `getDiyCmdPt(DiyProtocol)` – multiple DIY bytes + `SubModeNewDiy(code)` frame.
- `getDiyTemplateCmdPt(...)` – DIY-template frames + `SubModeScenes` frame.

Read side: `ResultPodsInstall` decodes `op.command[0]` base64 and checks `[2]==1` (pods
installed) or `[0]==0xEE && [1]==0x24` (check-install reply).
`IotSwitchCmdBuilderV1` parses `IotMsgProType.V2` (`IotMsgV2`), matches `transaction`, and
reports success when `cmd=="status"`.

## Other protocols

- WiFi/cloud topic per device in `BleIotExt.topic`; MQTT transport handled by base IoT manager
  (`Iot.r`). No LAN/UDP or Matter code in this split.
- BLE frames are reused verbatim over IoT through `ptReal` (base64 of each 20-byte frame).

## Dynamic effects / motion / music / scenes / DIY

- **Scene application**: `pact/Comm.makeSceneCmd4IotComm` → `Support.isMultiScenes(...)` →
  `ScenesOp.parseSceneV1(str, scene, {0,1,2,3,10,6})` or `ScenesOp.parseScene(...)` /
  `parseEffect(...)` depending on goodsType; falls back to `SubModeScenes` single frame.
  `Support.supportScenesOpSet`: 277→{0,1,2,3,5,10}; 288/298→{0,1,2,3,5,6}; else {0,1,2,3}.
- **Scene channels** for 6038 scenes: `createNewScenesMode6038` uses `{0,1,2,3,10,6}`;
  H6039 (`createNewScenesMode`) uses `{0,2,3,10}`.
- **DIY V1 effect codes** (`adjust/Diy.java`): registers `DiySupportV1` from
  `DiyM.EffectCode.{h,t,m,B,A,v,z,y,Q0,t0,M,P0,g}` (base app). `g` is a plain two-value
  effect (`makeEffect(effect[0], effect[1])`). Codes are the base `DiyM.EffectCode` values
  (0/1/2/3 gathered-dispersed, 4/5 music, 6/7 clockwise/anticlockwise, 8..34 scene codes,
  120 etc.).
- **H6038 new DIY** (`newdetail/h6038/diy/H6038DiyNewConfig.java`): separate
  `DiyNewConfig.addNewEffectConfig(288, ...)`; effect list built from `H6038SimpleEffect`
  plus `Diy4RgbIcGraffiti`; registers an extra `diySupport.effectCodes.codeList.add(812)`.
  `H6038SimpleEffect` layout parsed in `H6038SimpleEffect.m(byte[])` (effect type byte,
  sub-effects, colours, direction) — see `newdetail/h6038/diy/H6038SimpleEffect.java`.
- **Online music** (`pact/OnlineMusicConfig.java`): configGoodsType=277 (H6039), sku H6039,
  colour pieces 12, colour-temp 2700–6500 K, `supportScenesOpSet` true for 277;
  mix-preset version 2, desc strings 6.
- **Video/music-visual** effect ids live in `SubModeVideo`/`SubModeMusic` (above); the video
  mode uses colour-strip groups and `Mode4ColorStrip.a/b` flags to sequence multi-bar sends.
- **Compose-light (H6048)** supports independent left/right bars (`ComposeLightControllerV1`
  index 0/1) and swapping positions (`SwapLightController`, 0x34), plus per-bar on/off memory
  read (0x41 payload {2}).
- **Calibration** 0x44 + status notify 0x24; H6048 install/pods/USB checks use 0xA8/0x38/0x37
  with notify 0x24/0x23/0x37.

## Source map

- `pact/Support.java`, `pact/SubLib.java`, `pact/SubMaker.java`, `pact/*Item.java`,
  `pact/AbsBleIotSkuItem.java`, `pact/DeviceItem.java`, `pact/Model.java`, `pact/Comm.java`,
  `pact/AbsEffectOp4BleIot.java`, `pact/EffectOp4BleIot.java`, `pact/OnlineMusicConfig.java`,
  `pact/BleIotExt.java`
- `ble/Ble.java`, `BleComm.java`, `BleMultiComm.java`, `BleNotifyComm.java`, `BleProtocol.java`,
  `Mode.java`, `Mode4ColorStrip.java`, `ModeController.java`, `SubMode*.java`, `DiyLocal.java`,
  `Parser.java`, `H6048OnOffNotify*.java`, `WifiNotifyParse.java`
- `ble/controller/*.java`, `ble/event/*.java`
- `scenes/*.java`
- `iot/*.java`
- `adjust/Diy.java`, `newdetail/h6038/diy/*`, `newdetail/music/H6039MusicMode.java`
- base: `com/govee/base2light/ble/controller/{AbsSingleController,AbsModeController,AbsMode,SwitchController,BrightnessController,HeartController}.java`,
  `com/govee/base2light/ble/{DeviceStatusNotifyParse}.java`, `com/govee/base2kt/utils/BleUtils.java`,
  `com/govee/base2light/ac/diy/DiyM.java`

## Gaps / unknowns

- `ble/H6048OnOffNotifyParse` is the only parser indexing raw 20-byte notifies; the rest use
  the 17-byte stripped buffer. Confirm actual device notify framing for H6048 bar state.
- `Support.createNewScenesMode*` effect channel ids are static sets; per-scene channel bytes are
  server-driven (`ScenesM`, `CategoryV1.SceneV1`) and not statically enumerable.
- `DiyM.EffectCode` field names are obfuscated (h/t/m/...) — the numeric code list is only
  partially recoverable; H6038 uses a separate new-DIY config with codeList additions (e.g. 812).
- `value_check_light = -86` collides numerically with the 0xAA read proType; not used by any
  traced controller.
- H6043 (196) uses `AbstractEffectOp4BleIot.d()` to duplicate 5 colours into 10; exact device
  interpretation of duplicated segment colours is runtime-dependent.
- `Comm.makeColorController4BleComm` and the scene/DIY paths are the only traced BLE payload
  producers; camera-position/start-time opcodes (0x31/0x32/0x35) have no writer in this split.
