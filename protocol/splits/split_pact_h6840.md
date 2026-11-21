# split_pact_h6840 — H6840/H6841/H6842/H6843 + H6609 library family

Sources: `decompiled/jadx-splits/split_pact_h6840/sources/com/govee/...`
plus shared lighting code in `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/...`.

Paths relative to `decompiled/`.

## 1. Overview / family and SKUs

The split contains **two generations**:

1. `com.govee.h6840` — the newer **Hexa/Glide wall-panel** line
   (H6840/H6841/H6842/H6843), goodsTypes 278/325/381/382. Colour sub-mode is
   `0x0D`, scenes add a 4th parameter byte, DIY is a 16-bit code with
   hexa-specific layer tools.
2. `com.govee.h6609` — a shared **panel/string/light-bar library** used by many
   SKUs (H6609, H70C1/C2/CB/C9, H70C4…H70C8, H6870/H6871/R6871, H6860/H6861,
   H6350/H6351, H6850, H6250, H6175), goodsTypes 173/181/260/362/374/378/392/398/187.
   Colour sub-mode is `0x15`, with a very flexible op-type byte.

### 1.1 H6840-series SKUs

| SKU | goodsType | pact protocols | transports | notes |
|---|---|---|---|---|
| H6840 | 278 | (1,1),(1,2),(2,1),(2,2) | ble, iot, matter | `ConfigH6840.addSupportPact()` |
| H6841 | 325 | (1,1),(1,2) | ble, iot, matter | same config, `MatterInterceptor` |
| H6842 | 381 | (1,1) | ble, iot | `ConfigH684243` |
| H6843 | 382 | (1,1) | ble, iot | `ConfigH684243` |

`Support.b = {278,325,381,382}` is the supported-goodsType list for effects.
H6842/H6843 DIY effect codes are `ConfigH684243.b..i = 927..934`.

### 1.2 H6609-library SKUs

| SKU | goodsType | pact protocols | transports | notes |
|---|---|---|---|---|
| H6609 | 173 | (1,1) | ble, iot, matter | Gaming Light Strip G1; MatterSupport |
| H70C1 | 181 | (1,1),(2,1) | ble, iot | RGBIC string light; `Support.k` |
| H70C2 / H70CB / H70C9 | 181 | (1,1),(2,1) | ble, iot | SKU aliases, same goodsType |
| H6175 | 187 | registered via `H6175Item` | ble, iot | legacy alias, no explicit pact registration (gap) |
| H70C4/H70C5/H70C6/H70C7/H70C8/H6870/H6871/R6871 | 260 | (1,1),(1,2),(2,1),(2,2) | ble, iot | `Support.isH687()` selects H6870/71/R6871 |
| H6860/H6861 | 362 | (1,1),(2,1) | ble, iot | `isGoodsTypeH6860_61` |
| H6350 | 374 | (1,1) | ble, iot | colour piece size 1 |
| H6850 | 378 | (1,1) | ble, iot | colour piece size 4 |
| H6351 | 392 | (1,1) | ble, iot | colour piece size 1 |
| H6250 | 398 | (1,1) | ble, iot | 11 segments; newer UI |

`h6609/pact/Support.addSupportPact()` registers 173/(1,1); 181/(1,1)+(2,1);
260/(1,1)+(1,2)+(2,1)+(2,2); 374/(1,1); 392/(1,1); 398/(1,1).
`Support.y` is the device-list goodsType array `{173,181,260,362,374,378,392,398}`.

## 2. Transports & GATT UUIDs

Both generations use:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

`h6840/ble/Ble.java` additionally requests MTU (`MtuConfig`) and exposes an
`AbsMultiple4PtRealBleComm` / `BlePtRealMultiComm` for `ptReal` streaming.
`h6609/ble/BleComm.java` uses the same UUIDs and chooses `HeartControllerNoEvent`
when `BleComm.g == 2`.

IoT is via the base2light IoT commands (`h6840/pact/Comm.java`) or the `h6609`
native command set (`h6609/iot/Cmd.java`). Matter only on H6609 (173) and
H6840/H6841 (278/325) per the interceptors.

## 3. BLE frame + command table

20-byte frame `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR`.
Single write `0x33`, read `0xAA`; multi-packet `0xA3`.

### 3.1 H6840 / H6841 / H6842 / H6843

| Command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `01/00` | [0] | base `SwitchController` |
| brightness | `0x33/0x04` | `0..100` | [0] | base `BrightnessController` |
| mode container | `0x33/0x05` | sub-mode | `0x0D` colour, `0x04` scene, `0x0A` DIY, `0x13` music | `h6840/ble/Mode.java`, `ModeController.java` |
| position calibration | `0x33/0x42` | `…` | `BleProtocol.positionCalibration=66` | `h6840/ble/controller/PositionCalibration*.java` |
| install number / IC | `0x33/0x40` | `01 …` | device install count | `h6840/pact/BleProtocol.device_install_num` |
| secret key write/read | `0x33/0xB2`, `0xAA/0xB1` | key | 16-byte | `h6840/pact/BleProtocol.SECRET_KEY_*` |

### 3.2 H6609 library

| Command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `01/00` | `ControllerSwitch` | `h6609/ble/controller/compose/ControllerSwitch.java` |
| brightness | `0x33/0x04` | `0..100` | — | base |
| gradual | `0x33/0xA3` | `01/00` | fade on/off | `compose/GradualController.java` |
| mode container | `0x33/0x05` | sub-mode | `0x15` colour, `0x04` scene, `0x0A` DIY, `0x13` music, `0x14` interactive, `0x00` video, `0x05` mic | `h6609/ble/Mode.java`, `v1/ModeV1.java` |
| IC number read | `0xAA/0x40` | — | returns IC count | `compose/ControllerIcNum.java` |
| direction | `0x33/0x30` | `dir` | write; read `0xAA/0x30` | `compose/DirectionController.java` |
| calibration in/out | `0x33/0x44` | `02 01` into / `02 00` exit | — | `compose/CalibrationController.java` |
| on/off memory | `0x33/0x41` | `…` | `Controller4OnOffMemory` | `ble/controller/Controller4OnOffMemory.java` |
| interactive game | `0x33/0x05` | `14 …` | see §7.5 | `compose/InteractiveGamesController.java` |
| camera position | `0x33/0x31` | `…` | `MSG_TYPE_CAMERA_POSITION=49` | `BleProtocol` |
| read install camera | `0xAA/0x32` | — | `MSG_TYPE_READ_INSTALL_CAMERA=50` | `BleProtocol` |
| read install light | `0xAA/0xAA` | — | `MSG_TYPE_READ_INSTALL_LIGHT=-86` | `BleProtocol` |
| start time | `0xAA/0x35` | — | `MSG_TYPE_READ_START_TIME=53` | `BleProtocol` |
| white balance | `0x33/0xA9` | `…` | `value_white_balance=-87` | `BleProtocol` |
| USB check | `0x33/0x38` | `val` | `value_check_usb=56` | `BleProtocol` |
| USB check state | `0x33/0x37` | `val` | `value_check_usb_state=55` | `BleProtocol` |
| compose light switch | `0x33/0x36` | `val` | `value_compose_light_switch=54` | `BleProtocol` |
| swap light position | `0x33/0x34` | — | `value_swap_light_pos=52` | `BleProtocol` |

Multi-packet (`0xA3`) framing is shared with all lighting splits
(`base2light/ble/comm/MultipleControllerCommV1`):

- V1: `[0]=0xA3 [1]=0 [2]=2 [3]=total [4]=cmd [5]=? [6]=? [7..14]=verify [15..18]=first 4 bytes`, then `[1]=seq` 17-byte chunks, final `[1]=0xFF`.
- `Comm.a()` uses `makeSendBytesV3(0xA3, 0x5B, blob, 97)` for scene blobs
  (`h6840/pact/Comm.java`), then appends `04 <code LE16>`.

## 4. BLE notifications / readings

### H6840
`h6840/ble/Ble$generateNotify$1.java` registers a Wi-Fi parser (proType from
`DefParser.makeWifiNotifyParser(0, …)` → `0x00` for this family) and
`DeviceStatusNotifyParse` (`0x40`).

### H6609
`h6609/ble/BleNotifyComm.java` registers:

| proType | parser | reading |
|---|---|---|
| `0x11` | `WifiNotifyParse` | Wi-Fi connected = `[0]==0` |
| `0x40` | `DeviceStatusNotifyParse` | first 10 bytes |
| `0x30` | `LightAndHdmiNotifyParse` | `[0]==1`: 4 light-bar presence bits from `parseBytes4Bit([1])` |
| `0x60` | base `MovieFeastOnOffNotifyParse` | `[0]==1`, `[1]` on/off |
| `0x35` | base `InteractiveGameNotifyParse` | `[0]` status; if 2 → signed24 at `[1..3]` |
| `0xED` (`-19`) | `VideoRecognitionNotifyParse` | `[0]` recognition state |

## 5. IoT commands + status / readings schema

### H6840-series

`h6840/pact/Cmd.java`: `state`, `op`, `online`, `turn`, `brightness`, `status`,
`colorwc`, `ptReal`, `pt`. `getCmdReadParseKey` maps `ptReal`→`op`, else `state`.

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0|1}` | base2light `CmdTurn` |
| `brightness` | `{"val":0..100}` | base2light `CmdBrightness` |
| `colorwc` | `{"color":{"r","g","b"},"colorTemInKelvin"}` | base2light `CmdColorWc` |
| `ptReal` | `{"command":["<base64 frame>",…]}` | base2light `CmdPtReal` |
| `status` | `{}` | `h6840/pact/Cmd.java` |
| `online` | — | `h6840/pact/Cmd.java` |

H6840 `Comm.a(scenesParam, sceneCode)` splits a base64 scene blob into
`makeSendBytesV3(0xA3,0x5B,…,97)` chunks, wraps each chunk as a `ptReal`, and
appends `04 <sceneCode LE16>` on the last one.

### H6609-library

`h6609/iot/Cmd.java` commands: `state`, `op`, `online`, `turn`, `color`,
`colorTem`, `brightness`, `status`, `pt`, `snapshot`, `points`, `IoTConnected`,
`camera`, `swap`, `ptReal`, `ptIot`, `colorwc`.

Notable extra payloads:

- `snapshot` / `dewarpsnapshot` (H6099 sibling) — camera calibration image.
- `points` — `{"points":[...]}` calibration point list (3-image calibration).
- `camera` — camera on/off.
- `swap` — swap light position.
- `IoTConnected` — link state.
- `colorTem` — `{colorTemInKelvin, color}`.
- `ptIot` — passthrough on the IoT channel (different from BLE `ptReal`).

`h6609/iot/State.java` status: `onOff` (int), `brightness` (int),
`wifiSoftVersion`, `wifiHardVersion` (strings).

## 6. Other protocols

- **Matter**: H6609 (`h6609/newdetail/config/MatterSupport.java`, goodsType 173);
  H6840/H6841 (`ConfigH6840$addDevice$addDeviceParams$2` MatterInterceptor).
- **H6609 3-image / 2-image camera calibration** uses HTTP:
  `h6609/adjust/new_detail/network/ApiService` and `.../PointListInfo.java`
  (upload/get calibration points, snapshots).
- **H6840 graffiti/GIF**: local asset pipeline (`diy/gif/GifTransformVM`,
  `diy/cell_graffiti/*`), not a network protocol.
- **BLE broadcast** discovery: `h6609/add/BleBroadcastProcessor.java`.

## 7. Dynamic effects / motion / music / scenes / DIY

### 7.1 H6840 colour — sub-mode `0x0D`

`h6840/ble/SubModeColor.getWriteBytes()`:

```
0D R G B kLo kHi R2 G2 B2
```

9 bytes. `kLo/kHi` = colour temperature LE16 (0 when not temp mode); `R2G2B2`
is the temperature-mode RGB. No per-segment mask in this sub-mode — segment
colour is done with the H6840 multi-layer colour-strip controllers
(`MultipleColorStripControllerV1`) + `ptReal`.

### 7.2 H6840 scenes — sub-mode `0x04`

`h6840/ble/SubModeScenes.getWriteBytes()` = `04 effectLo effectHi param`.
`param` (3rd byte) comes from the scene definition; H6840 scene layers are
`0xA3` blobs with cmd `0x5B` (91).

### 7.3 H6840 DIY — sub-mode `0x0A`

`0A codeLo codeHi` (16-bit LE). H6840 DIY groups from
`ConfigH6840` / `DIY4H6840Main(byte group, SubEffect*)`:

| group | sub-effects (classes) |
|---|---|
| 1 | HuoHua (fireworks-ish), ShuangLuoXuan |
| 2 | CaiHong, LiuXing, CaiDai |
| 4 | Line |
| 6 | BoBanTang, DaFengChe |
| 7 | SuiJi, FuGai |
| 9 | TanTiaoQiu, TanChiShe, XiaoXiaoLe, PenShe |
| 10 | YinHe |
| 11 | HuanRaoYunLuo |
| 12 | LiuShui |
| 13 | HuanRaoYunLuo variant |
| 14 | HuiTan |

Additional sub-effect classes exist for DangYang, DuiDie, ShenSuo, SiDai,
TanTiao, CanLan. H6842/H6843 use effect codes `927..934`
(`ConfigH684243.b..i`).

### 7.4 H6840 music — sub-mode `0x13`

`h6840/ble/SubModeMusic`: `13 code sens`, sensitivity 0–99.
Music codes 160–167 (`h6840/pact/BleProtocol`):
160 LiuXingYu, 161 ShiZiXing, 162 HuanCai, 163 PiaoWu, 164 PinPu, 165 FenLi,
166 LvDong, 167 XianPu. New-music codes 48–55 are also accepted
(`Support.isNewMusicCode`).

### 7.5 H6609 colour — sub-mode `0x15` (op-type byte)

`h6609/ble/v1/SubModeColorV1.getWriteBytes()` selects on `opType`:

| opType | bytes | meaning |
|---|---|---|
| 0 SET_BRIGHTNESS | `15 02 bri maskLo maskHi` | set brightness on masked segments |
| 1 SET_COLOR | `15 01 R G B kLo kHi 0 0 0 mask*` | set RGB on masked segments |
| 2 SET_COLOR_TEMP | `15 01 FF FF FF kLo kHi R G B mask*` | white + kelvin on masked segments |
| 3 SET_MODE | `15 00` | enter colour mode |
| 6 BRIGHTNESS_GROUP | `15 03 groupIdx briSet…` | per-group brightness (14 per packet) |
| 7 COLOR_GROUP | `15 04 groupIdx rgbSet…` | per-group RGB (4 colours per packet) |

`opType` values 4/5/8/9/10/11 are app-side selectors only and return `null` from
`getWriteBytes()`; they are never put on the wire.

Mask encoding: `BleUtil.makeSelectedTwoBytes(checkSet,true)` for ≤16 segments;
`BleUtils.X(checkSet,true)` for >16. Segment count for H6609 = 18 at IC 36, H70C1=10,
H70C4-8/H6860/61=10, H6250=11, H6350/6351=1, H6850=4, default 14
(`h6609/pact/Support.getColorPieceSize`).

### 7.6 H6609 scenes / DIY / music / video / interactive

- Scenes `0x04`: `04 effectLo effectHi` (2 bytes).
- DIY `0x0A`: `0A codeLo codeHi`; `Sub4Diy`; H70C1/H70C4 use graffiti parsers.
- Music `0x13`:
  - simple: `13 code sens`
  - full (8 bytes): `13 code sens dynFlag autoFlag 00 00 R G B`
  - `SubModeMusicV1` for H6609/H70Cx, music codes 64 rhythm, 65 wind, 66 hooray,
    67 sprout, 72 hopping, 80 torch, 82 burst, 83 streaming,
    plus new codes 3,4,5,6 (rhythm/pinpu/energy/gundong V2).
- Video `0x00` (`SubModeVideoV1`): `00 dramaFlag partFlag(8/9) vividness voiceOpen 02 voice`.
  The H6609/H6250 new-detail VM uses the shared `VideoModeControllerParams` path
  (`0x05/0x00`); shared DreamView settings (white balance, sensitivity, HDR, saturation,
  AI filter, black screen) are catalogued in `DREAMVIEW-HDMI.md`.
- Interactive game `0x14` (`SubModeInteractive`):
  - level 0: `14 01 sens1 level(0) soundLevel timeLo timeHi` (time = 14/28/42/56/70/98/126)
  - level 1: `14 01 sens2 level(1) twoLevel [difficulty if twoLevel==1]`
- Mic `0x05`.

### 7.7 H6609 colour-temperature ranges

`h6609/pact/Support.getColorTemRange` is per goodsType in the caller; H6840 panels
use `Support.a(278) = {2000,9000}` (`h6840/Support.java`).

## 8. Source map (traced)

- H6840 SKUs/pact: `h6840/Support.java`, `ConfigH6840.java`, `ConfigH684243.java`,
  `h6840/present/{SubLib,Register4Item,DeviceItem}.java`, `h6840/pact/{BleProtocol,Cmd,Comm}.java`.
- H6840 BLE: `h6840/ble/{Ble,Mode,ModeController,SubModeColor,SubModeMusic,SubModeScenes,SubModeNewDiy}.java`,
  `h6840/ble/controller/{PositionCalibration,PositionCalibrationOld}.java`.
- H6840 DIY: `h6840/diy/**` (DIY4H6840Main, SubEffect*, H6840DiyParser),
  `h6840/diy/advance/*`, `h6840/diy/cell_graffiti/*`, `h6840/diy/gif/*`.
- H6840 IoT: `h6840/pact/Comm.java`, `h6840/iot/Op*Dialog*.java`.
- H6609 SKUs/pact: `h6609/pact/{Support,SubLib,SubMaker,*Item}.java`.
- H6609 BLE: `h6609/ble/{Ble,BleComm,BleNotifyComm,BleProtocol,Mode,ModeController}.java`,
  `h6609/ble/v1/*`, `h6609/ble/controller/**`.
- H6609 IoT: `h6609/iot/{Cmd,State,CmdPtReal,CmdColorWc}.java`.
- H6609 effects: `h6609/newdetail/h70c1c2cb/**`, `h6609/h6250/**`, `h6609/h6350/**`,
  `h6609/h6850/**`, `h6609/h6860/**`, `h6609/h70cx_v2/**`.

## 9. Gaps / unknowns

- Scene layer blobs and DIY templates are cloud assets; only the `04 <LE16>` and
  `0A <LE16>` trailers plus the `0xA3/0x5B` chunk framing are static.
- H6175 (goodsType 187) has a `H6175Item` but no `pact.a(187,…)` registration in
  `h6609/pact/Support`; its protocol pair could not be resolved.
- H6840 `positionCalibration` payload bytes are built in native/Compose code
  (`PositionCalibration`), not fully readable in Java.
- H6609 video/interactive parameter meanings (vividness, voice, sound level) come
  from UI sliders; ranges are 0–100 / 1–7 as shown, but no protocol doc.
- The H6840 Wi-Fi notify parser is registered with proType `0` (H6840) while the
  H6609 family uses `0x11`; both are present in the code path.
