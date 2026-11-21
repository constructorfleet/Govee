# split_pact_h6660 — H6660 / H3810 laser engraver (LaserPecker-style)

Source root: `decompiled/jadx-splits/split_pact_h6660/sources/com/govee/h6660/`

## Overview / family and SKUs

Two SKUs, one goods-type (380):

| SKU | notes |
|---|---|
| H6660 | main laser engraver SKU (`LaserSupport.b`) |
| H3810 | sibling SKU (`LaserSupport.c`), same goods type in `H3810Maker` / `H3810DetailConfig` |

- `pact/LaserSupport.h` = `{380}`; `LaserSupport.g(380)` true, `LaserSupport.h(347)` exists as a
  legacy/secondary goods-type check.
- Pact registration: `GoodsType.beProtocol(1,1)` and `(1,2)` for goods-type 380;
  `LaserSupport.f` (support protocols) and `g` (pact protocols).
- Transport: `ble + iot`. `pact/DeviceItem extends AbsBleIotItem`, `pact/Model extends
  AbsDeviceModel4BleIot`. `Model.V()` = `"status"`. `Model.k0(IotMsgV2)` handles `status` and
  takes `op` → `ResultPt.bytes()` (base64 20-byte frames).
- Device gating: `Model.blockOpenIfAbnormal()` checks electric shock (`k1`), overheat (`M1`),
  high temperature/battery (`V0`), human presence (`V1`).

## Transports & GATT UUIDs

- Service `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/Ble.java` caches these as `Ble.t`/`Ble.u`; `Ble.v0()`=char, `Ble.w0()`=service.
- GATT callback requests MTU and persists it per SKU (`MtuConfig`), enabling larger picture
  uploads.
- Multi: `Ble.u()` → `BlePtRealMultiComm`; `Ble.v()` → anonymous `AbsMultipleBleComm` with the
  same UUIDs.
- Notify: `Ble$generateNotify$1` (dynamic parser list assembled by
  `LaserDetailViewModel.c4()`).

## BLE frame + command table

Frame `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`; write 0x33 / read 0xAA; multi
V1/V2 0xA3/0xA4.

`ble/BleProtocol.java`:

| const | dec | hex | use |
|---|---|---|---|
| b | 19 | 0x13 | music sub-mode |
| c | 13 | 0x0D | (laser/effect single) |
| d | 4 | 0x04 | brightness |
| e | 10 | 0x0A | DIY sub-mode |
| f | -126 | 0x82 | graffiti/DIY payload prefix |
| g | 32 | 0x20 | brightness notify |
| h | -79 | 0xB1 | laser format 0/1 |
| i | -78 | 0xB2 | laser frame |
| w | -128 | 0x80 | device status notify |
| x | 66 | 0x42 | battery info notify |
| y | 67 | 0x43 | single write (2-byte param) |
| z | 68 | 0x44 | single write/read param |
| A | 127 | 0x7F | laser def parser notify |
| B | 37 | 0x25 | WiFi upgrade / base info read |
| C | 48 | 0x30 | indicator light |
| j..v | 160..178 | 0xA0..0xB2 | laser music effect ids |

Derived commands:

| command | op | payload | response | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `[0]=0|1` | read `0xAA/0x01`; switch notify | base `SwitchController`; `scenes/BleSwitchCmdBuilder.java` |
| brightness | `0x33/0x04` | `[0]=0..100` | notify 0x20 | `DefParser.makeBrightnessNotifyParser` |
| music mode | `0x33/0x05` | `[0]=0x13 [1]=subMusicMode [2]=sensitivity` (+ multi-packet `MultipleController4Music` for effect) | event | `detail/MusicModeH3810.d()` |
| indicator light | `0x33/0x30` | `[0]=enable, [1]=!forever?1:0, [2]=startHour, [3]=startMin, [4]=endHour, [5]=endMin` | write result | `ble/controller/IndicatorLightController.java` |
| WiFi upgrade | `0x33/0x25` | `[0]=1 init?` / `{4}` read version / `{3, flag}` / `{2}` read | `[0]==1,[1]==1, [2]=state, [3..5]=soft x.y.z, [6..8]=hard x.y.z` | `ble/controller/WIFIUpgradesController.java` |
| laser param | `0x33/0x43` | `[0], [1]` (speed/power pair) | write callback | `detail/LaserDetailViewModel.u5()` |
| base info single read | `0xAA/0x25` | `{0x25,0x80,0x42,0x44,0x7F}` (380) or `{0x25,0x30,0x80,0x42,0x43,0x44}` | multi-read callbacks | `detail/LaserDetailViewModel.k5()` |
| laser DIY/effect | multi frames + `0x0A <diy LE16>` | as `ControlModeCompose` | event | `detail/diy/LaserDiyParser.java` |

`LaserDefParser` registers notify parsers for cmdTypes **0x42 (66)**, **0x7F (127)**,
**0x80 (-128)**, **0x81 (-127)**, **0x30 (48)**.

## BLE notifications / readings

| notify | parser | layout |
|---|---|---|
| 0x80 (128) | `DeviceStatusInfo.Companion.a(byte)` | bit1 child lock?, bit2..7: flags; `DeviceStatusInfo.i = -128`; `isChecking` false when bits 4..7 set |
| 0x42 (66) | `BatteryInfo.Companion.a(byte)` | bit8 charging, bits5..3 battery level, bit4?, bit3?, bit2?, bit1? |
| 0x20 (32) | brightness notify | `[0]` 0..100 |
| 0x01 (1) | switch notify | on/off |
| 0x11 (17) | wifi notify | connected |
| 0x7F (127) | `LaserDefParser` | raw bytes → laser def |
| 0x81 (-127) | `LaserDefParser` | raw bytes |
| 0x30 (48) | indicator light reply | parsed by `LaserDefParser` |
| via IoT `status.op` | `Model.k0` | for each 20-byte frame: `[1]==0x80` → `DeviceStatusInfo.a([2])`; `[1]==0x42` → `BatteryInfo.a([2])` |

Battery/status bit meaning is partly UI-derived; see `entity/DeviceStatusInfo.java`,
`entity/BatteryInfo.java`.

## IoT commands + status/readings schema

- `Model.V()` = `"status"`.
- IoT responses are `IotMsgV2`; `status.op` is a `ResultPt` whose `bytes()` are base64-decoded
  20-byte BLE frames (handled in `Model.k0`).
- Commands: mostly `ptUrl` via `GetIotCmdPtUrlLinkInfo`; `status` for reads. No `turn`/
  `brightness` IoT class in this split — those go through BLE or `ptUrl`.
- `ptUrl` payload (`detail/diy/LaserDiyParser.java`, `detail/LaserDetailViewModel`):
  `createPtUrlV4(EffectOtherInfo, new byte[]{88,0,97}, base64(payload))` — the 3-byte header is
  `0x58,0x00,0x61` (laser effect command marker). Snapshot path uses
  `LaserCmdOptionManager.h()` as the header and `cmdType=18`.
- Long-time upload: `GetIotCmdPtUrlLinkInfo.getLongTimePtUrlLink(PtUrlData(...))`.

## Other protocols

- `ptUrl` blob upload/fetch for large laser drawings/effects (main IoT path).
- No LAN/UDP/Matter code in this split.
- BLE MTU negotiation for image transfer (`Ble$getGattCallbackImp$1`).

## Dynamic effects / motion / music / scenes / DIY

- **Laser drawing model**: `entity/IldaFormat{0,1,2,4,5}.java`, `IldaFrame`, `IldaFrameHeader`,
  `LaserShape`, `LaserShapeType`, `LaserPathInfo`, `LaserText`, `ColorPoint`, `PathPoint`,
  `SingleLayer`, `ShapeLayers`. ILDA files (standard laser show format) are parsed/exported;
  frame formats 0/1/4/5, palette/true-colour.
- **Effect order** (`entity/DiyEffectInfo.java` constants):
  bright 25, color 24, move 26, scale 27, rotate 28, track 29, mirror 30, distort 31,
  carousel 36. Effect classes: `CarouselEffect`, `ColorEffect`, `DistortEffect`, `EraseEffect`,
  `MirrorEffect`, `MoveEffect`, `RotateEffect`, `ScaleEffect`.
- **Transforms** (`util/trans/`): scale, color, mirror, erase, distort, move, rotate.
  `LaserEffectTransManager` applies them per frame; `LaserPointLimitHelper` clamps point count
  (LaserPointLimitHelper).
- **Music**: `detail/MusicModeH3810.getDefaultMusicEffect()` — 13 effects with ids
  `BleProtocol.j..v` = 160 (Mist), 161 (PengZhuang/collision), 162, 163 (KuoSan), 164, 165
  (YongDong), 166 (LvDongTanQiu), 167 (CurveLine), 168 (JiHeQiPao), 169 (JiaoNang),
  176 (LaserWanHuaTong), 177 (JiaoTi), 178 (YanHua). Payload `[0]=0x13 [1]=subMode [2]=sensitivity`.
- **Scenes**: `detail/scene/H6660SceneViewModel`, `absEffect` layers; scene upload uses the same
  `ptUrl` + multi-BLE completion frames.
- **Graffiti/DIY**: `detail/diy/LaserDiyParser`, `detail/graffiti/*`, SVG import
  (`svg/SvgParseManager`, `SvgAnimationParser`), Hershey text (`util/HersheyFont`),
  ILDA import/export.
- **Preview trace**: `util/PreviewTraceUtil`, `LaserShapeUtils` render frames for preview.

## Source map

- `pact/LaserSupport.java`, `SubLib.java`, `SubMaker.java`, `RegisterItem.java`, `DeviceItem.java`,
  `Model.java`, `H3810Maker.java`, `H6660DetailConfig.java`, `H3810DetailConfig.java`,
  `LaserAddConfig.java`
- `ble/Ble.java`, `BleProtocol.java`, `controller/{IndicatorLightController,WIFIUpgradesController}.java`
- `scenes/AbsBleCmdBuilder.java`, `scenes/BleSwitchCmdBuilder.java`
- `detail/LaserDetailViewModel.java`, `detail/MusicModeH3810.java`, `detail/LaserDefParser.java`,
  `detail/diy/LaserDiyParser.java`, `detail/scene/*`, `detail/graffiti/*`
- `entity/*` (Ilda, LaserShape, DeviceStatusInfo, BatteryInfo, DiyEffectInfo, ScanSpeedInfo)
- `util/*` (IldaUtil, LaserShapeUtils, PreviewTraceUtil, trans/*)
- `notification/LaserNotification.java`, `net/LaserApiService.java`

## Gaps / unknowns

- `BleProtocol.z`/`y` write semantics (0x43/0x44 two-byte params) are not named; `u5(i,i2)`
  feeds them from UI sliders (likely speed/power).
- `DeviceStatusInfo`/`BatteryInfo` bit semantics are partly inferred from UI strings only.
- WiFi upgrade state machine values (`[0]` init/read codes) are not documented in source.
- Laser effect binary format is ILDA + proprietary `ptUrl` header `{0x58,0x00,0x61}`; the
  content encoding (frames/points) lives in `LaserEffectTransManager` and is only partially
  decoded by jadx.
- `LaserSupport` has a legacy goods-type 347 check with no SKU maker in this split.
