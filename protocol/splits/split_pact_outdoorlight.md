# split_pact_outdoorlight — outdoor strips / pathway / garden / curtain (H7040, H7056, H7080, H7086)

Source root: `decompiled/jadx-splits/split_pact_outdoorlight/sources/com/govee/`.

The module contains four independent pact families, each with its own `pact/`, `ble/`, `scenes/`
and (for two of them) `iot/` packages:

| package | goodsType | product(s) | transports |
|---|---|---|---|
| `h7040` | 36 | H7040 camping lantern | **ble** |
| `h7056` | 304 | H7056 Pathway Lights 2 | **ble + iot** |
| `h7080` | 45 / 55 / 56 | B7080 / B7081 / B7082 (H7080/H7081/H7082), plus H7085 (276) detail config | **ble** |
| `h7086` | 293 | H7086 Garden Lights | **ble + iot** |

`h7080.pact.Support` also declares 276 (H7085) for detail/Diy only
(`isGoodsTypeH7085`), while `Pact` protocols are registered for 45/55/56.
`OutdoorLightModuleInitImpl` registers all four `ApplicationImp` classes.

No MQTT topics or Matter clusters are implemented in this split; `DeviceCommCapability.supportMqtt`
is only consulted by shared `AbsOpCommDialog4BleIot` code for LAN-capable devices, and
`supportMqtt` is a capability-list + non-empty-topic test in `com.govee.device.DeviceCommCapability`.

---

## 1. Transports & GATT UUIDs

All four families use the same vendor GATT pair:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `h7040/ble/BleComm.java`, `h7056/ble/BleComm.java` (via
`com.govee.common.params.BleCommUUID`), `h7080/ble/BleComm.java`, `h7086/ble/BleComm.java`.
H7040 also has `BleMultiComm` with the same UUIDs.

Frame: 20 bytes; `[0]=proType` (`0x33` write / `0xAA` read / `0xA3`,`0xA4`,`0xA5` multi),
`[1]=cmdType`, `[2..18]=payload`, `[19]=XOR BCC`.

---

## 2. H7040 (goodsType 36, camping lantern)

Pact: `GoodsType.beProtocol(1,1)`; `Support.getBulbStringMaxNum()=1`,
`getOneGroupColorSize()=4`; scene-op set `{0,1}`. BLE only (`AbsEffectOp4Ble`, no `iot/`).

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` / `0xAA/0x01` | `[0] 0/1` | base `SwitchController` via `pact/Comm.java` |
| brightness | `0x33/0x04` | `[0] 1..254` | `pact/Comm.makeBrightnessController4BleComm` |
| mode | `0x33/0x05` | sub-mode payload, see below | base `AbsModeController` |
| color | sub-mode `0x0D` | `0D R G B kelLo kelHi R2 G2 B2` (9 B) | `ble/SubModeColor.java` |
| music / mic set | sub-mode `0x05` | `05 01` (set mic mode) | `ble/SubModeMic.java` |
| mic realtime points | `0x33/0x05` | `05 00 R G B` (direct `MicController.q()`) | `ble/MicController.java` |
| scene | sub-mode `0x04` | `04 effectLo effectHi` | `ble/SubModeScenes.java` |
| DIY | sub-mode `0x0A` | `0A diyLo diyHi` | `ble/SubModeNewDiy.java` |
| SOS | `0x33/0x0B` | `[0] 0/1` | `ble/SOS4BleController.java` (`SINGLE_SOS_CHANGE_4_BLE=11`) |
| heart / battery | `0xAA/0x01` | valid bytes below | `ble/HeartController.java` |

Heart/battery parse (`h7040/detail/BatteryInfo.Companion.a(byte b)`):

```
bit7       = charging/full flag
bits6..4   = battery bars: 0/1 -> 1, 2 -> 2, 3 -> 3, 4 -> 4, 5 -> 5; bit7 set -> -1 (charging)
bit0       = flag A
bit3       = flag B
```

`NewDetailVm.notifyParseList` treats `[0]==1` as switch report and `[1]` bit7 as on/off, and
`p5()` reads `bArr[2]` for the battery byte. `HeartController` also decodes a 4-state work mode
from bits 0x10/0x20/0x30/0x40/0x50.

### Scenes / effects

`adjust/ui/ScenesV0.java` menus use effect ids
`0, 1, 10, 1018–1050` (14 + 9 + 6 + 7 entries), plus `Support.g = {1030,1033,10}` and
`Support.h = {0,1,1034,1035}` controlling whether the scene respects system brightness.
Hints exist for `0` (GM) and `1` (Sunset); `108` (alarm) has a hint.

### IoT

None in this split. `h7040/detail/NewDetailVm` still contains `parseIotMsg4Online` hooks because
the base VM is shared, but no `Iot*CmdBuilder` is registered for goodsType 36.

---

## 3. H7056 (goodsType 304, Pathway Lights 2)

Pact: `GoodsType.beProtocol(1,1)`; `H7056Support`:
- colour pieces 8 (`getColorPieceSize`), group size 4, kelvin 2700..6500
- scene-op set `{0,2,3,5,6}` (no dynamic/music op 1/4?)
- DIY sub-effect ids 1..10 (see below)

Transports: BLE + IoT (`Iot*CmdBuilderV1` registered in `H7056ApplicationImp`).

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] level` | `pact/Comm.makeBrightnessController4BleComm` |
| mode | `0x33/0x05` | sub-mode payload | `ble/Mode.java` |
| color | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask0..3` (17 B). Masks support up to 32 segments although device has 8; `Supports` uses `i` = piece count. | `ble/SubModeColor.java` |
| per-segment brightness | `0x15` | `15 02 level 00 mask0..3` | `ble/SubModeColor.java` |
| raw RGB array | `0x15` | `15 03 c0..c15` | `ble/SubModeColor.java` |
| colour-strip group | frame payload built by `Comm.a(i,colors)`: `15 04 index c0..cN` (4 colours per frame, last group shorter); brightness group `15 03 index b0..b13` (14 per frame) | `pact/Comm.java#a` / `#d` |
| music | `0x13` | `13 code sens` (code default 101, sens 0..99) | `ble/SubModeMusic.java` (`BleProtocol.b=19`) |
| scene | `0x04` | `04 effLo effHi musicCode0..3 level` (8 B) — 32-bit LE music code, 1-byte level; effect default `2002` | `ble/SubModeScenes.java` |
| DIY | `0x0A` | `0A diyLo diyHi groupLo groupHi` (5 B, group index for multi-group presets) | `ble/SubModeNewDiy.java` |

Notify:

| op | layout | meaning | source |
|---|---|---|---|
| `0x11` | `[0]==0` | WiFi connected | `ble/WifiNotifyParse.java` |
| `0x20` | `[0]` | brightness report | `ble/BrightnessNotifyParse.java` |
| `0x30` | `[0]==1`, `[1]` on/off, `[2]` secondary | device switch status | `ble/DeviceSwitchStatusNotifyParse.java` |

### DIY / effects (H7056)

`Pro4H7056Diy` sub-effect ids (`diy/Pro4H7056Diy.java`):

| id | class | effect | extra params |
|---|---|---|---|
| 1 | `Gradual` | gradual | 1..n colours + speed |
| 2 | `HuXi` | breath | colours + speed |
| 3 | `CaiHong` | rainbow | colours + speed + direction |
| 4 | `FuGai` | cover | colours + speed |
| 5 | `WeiGuang` | glimmer | colour + brightness |
| 6 | `ShengKai` | blooming | colours + speed |
| 7 | `LiuGuang` | flowing light | colours + RGB + speed + direction |
| 8 | `ShanGuang` | flash | colours + speed |
| 9 | `CaiQiang` | colour wall | colours + speed |
| 10 | `XuanZhuan` | rotate | colours |

Wire body: `[lenLo lenHi][subEffect][colourCount][R G B]×n[…]`. Multi-frame write uses protocol
code `0x58` (`H7056DiyParser.getProtocolCode()`), with `MultiController` frames.

### IoT (H7056)

`iot/Cmd` constants: `turn`, `brightness`; `CmdColorWc` is the shared base `colorwc`.
`IotSwitchCmdBuilderV1` parses `IotMsgProType.V2`.

| cmd | data | source |
|---|---|---|
| `turn` | `val` 0/1 | `h7056/iot/CmdTurn.java` |
| `brightness` | `brightness` int | `h7056/iot/CmdBrightness.java` |
| `colorwc` | `color{red,green,blue}`, `colorTemInKelvin` | base `base2light/iot/CmdColorWc` via `pact/Comm` |
| `ptReal` | `command:[base64(frame)]` | `pact/bleiot/*` (`OpDiyCommDialog4BleIot`, `Cmd4PtReal`) |

Status uses the shared V2 message (`status`, `state`, `op`) with the same fields as the base
light family (on/off, brightness, colour, mode).

---

## 4. H7080 / B7080 / B7081 / B7082 / H7085 (goodsType 45, 55, 56, 276)

Pact: `GoodsType.beProtocol(2,1)` for 45/55/56. BLE only. Segment counts:
- 45 (B7080) and 276 (H7085): 4 segments
- 55 (B7081): 8 segments
- 56 (B7082): 6 segments
- `getOneGroupColorSize`: 3 for 45/55/56, 4 for 276.

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] level` | `pact/Comm` |
| mode | `0x33/0x05` | sub-mode payload | `ble/Mode.java` |
| color | `0x15` | mode 1: `15 01 R G B kelLo kelHi R2 G2 B2 mask0` (mask bits 0..k-1) — 12-byte buffer; mode 2: `15 02 level 00 mask0`; mode 3: `15 03 c0..c15` | `ble/SubModeColor.java` |
| mic set | `0x05` | `05 01` | `ble/SubModeMic.java` |
| mic points | `0x33/0x05` | `05 00 R G B` | `ble/MicController.java` |
| scene | `0x04` | `04 effLo effHi` | `ble/SubModeScenes.java` |
| DIY | `0x0A` | `0A diyLo diyHi` | `ble/SubModeNewDiy.java` |
| location write | `0x33/0xA7` (`value_sub_mode_location = -89`) | `[0]=N`, then pairs `[index][value]`; read `p()` = `[N]`; response pairs index/value | `ble/LocationController.java` |
| check location | `0x33/0xA6` (`value_sub_mode_check_location = -90`) | `[0] count`, `[1] index`; response not parsed (write-ack only) | `ble/CheckLocationController.java` |
| gradual | `0xA3/0xA3` (`SINGLE_GRADUAL_CHANGE_4_BLE=-93`) | `[0] 0/1` | `ble/Gradual4BleController.java` |
| read bulb-string colour | `0xAA/0xA5` | `p()` = `[index]`; response `[0]=index`, then 3 × `[index,R,G,B]` | `ble/BulbStringColorController.java`, `ble/BulbGroupColor.java` |

Scene ids: `Support.m` hints 0 (GM), 1 (Sunset), 108 (alarm); `adjust/ui/ScenesV0` /
`RgbScenesV1` provide the local scene menus. H7085 (276) has its own DIaY/config under
`h7080/adjust/h7085/*`.

### IoT

None (`H7080ApplicationImp` registers only `AbsBleCmdBuilderV1`).

---

## 5. H7086 (goodsType 293, Garden Lights)

Pact: `Support.c() = {1,100,0}` (brightness range/progress descriptor), kelvin 2700..6500,
4 colour pieces and 4 segments. BLE + IoT (`H7086ApplicationImp` registers both builder sets).

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] level`; remapped with `NumUtil.calculateProgress(100,1,v)` when `Support.c()[2]==1` (currently 0, so raw) | `pact/Comm.java` |
| mode | `0x33/0x05` | sub-mode payload | `ble/Mode.java` |
| color | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask0..3` (17 B, 4 segments) | `ble/SubModeColor.java` |
| per-segment brightness | `0x15` | `15 02 level 00 mask0..3` | `ble/SubModeColor.java` |
| raw array | `0x15` | `15 03 c0..c15` | `ble/SubModeColor.java` |
| music | `0x13` | `13 code sens` (code default 5) | `ble/SubModeMusic.java` |
| scene | `0x04` | `04 effLo effHi musicLo musicHi` | `ble/SubModeScenes.java` |
| DIY | `0x0A` | `0A diyLo diyHi groupLo groupHi` | `ble/SubModeNewDiy.java` |
| cap-calibration mode | `0x33/0x30` | `[0] 0/1` enable/disable | `adjust/controller/CapCalibrationStatusController.java` |
| cap-calibration order | `0x33/0x31` | `[serial...]` (one byte per cap) | `adjust/controller/CapCalibrationController.java` |
| cap-calibration status | notify `0x32` | any payload -> callback | `adjust/controller/CapCalibrationStatusParse.java` |

Notify: `0x20` brightness, `0x30` switch status, `0x32` cap-calibration status, `0x11` WiFi.

### Effects / DIY (H7086)

`H7086DiyParse.getProtocolCode()=0x58`, effect code `761` (0x2F9). Seven primitive DIY
sub-effects (`SubEffectConfig`):

| id | effect | parameters |
|---|---|---|
| 1 | Breath (`SubEffectBreath`) | speed, colours, direction |
| 2 | Meteor shower (`SubEffectMeteorShower`) | speed, direction, density, length, background |
| 3 | Loop (`SubEffectLoop`) | speed, direction, loop mode |
| 4 | Glimmer (`SubEffectGlimmer`) | speed, brightness, background |
| 5 | Pile-up (`SubEffectPileUp`) | speed, direction, fill mode |
| 6 | Sunrise (`SubEffectSunrise`) | speed, direction, rise mode |
| 7 | Firework (`SubEffectFirework`) | speed, direction |

UI presets (`H7086DiyConfig.c`) map to codes `1..23`; 21/22/23 are H7086-specific templates
(`H7086DiyTemp4Colorful` base64 `CgIf…`, `H7086DiyTemp4DazzlingMeteor` base64 `CgEu…`).
Direction options use codes `9/10/2/19/15/20` (up/down/left/right/…).
Cell-graffiti tags `76..80` (`H70DXCellGraffitiParse`, shared H70DX code) are not used here.

### IoT (H7086)

| cmd | data | source |
|---|---|---|
| `turn` | `val` 0/1 (+ optional sub) | `h7086/pact/Comm.makeSwitchCmd4IotComm` (base `CmdTurn`) |
| `brightness` | `brightness` int | `h7086/pact/Comm.makeBrightnessCmd4IotComm` |
| `colorwc` | `color`, `colorTemInKelvin` | `h7086/pact/Comm.makeColorCmd4IotComm` |
| `ptReal` | `command:[base64(frame)]` | `h7086/iot/CmdPtReal.java` (DIY/scene/cell graffiti) |

`CmdPtReal` methods: `a(diyProtocol)`, `b/c(diyGraffiti)`, `d(diySendData)`,
`e(diyTemplate)`, `g(newScenes)`, `h(list)`. DIY graffiti limits `commands.size() <= 19`.

---

## 6. Source map (traced)

- H7040: `h7040/pact/{Support,Comm}.java`, `h7040/ble/{BleProtocol,BleComm,Mode,SubModeColor,SubModeMic,SubModeScenes,SubModeNewDiy,MicController,SOS4BleController,HeartController}.java`,
  `h7040/adjust/ui/ScenesV0.java`, `h7040/detail/{BatteryInfo,Info4Detail,NewDetailVm}.java`,
  `h7040/H7040ApplicationImp.java`
- H7056: `h7056/pact/{H7056Support,Comm}.java`, `h7056/ble/*.java`, `h7056/iot/*.java`,
  `h7056/diy/*` (10 sub-effects), `h7056/pact/bleiot/*`, `h7056/H7056ApplicationImp.java`
- H7080: `h7080/pact/{Support,Comm}.java`, `h7080/ble/*.java` (incl. `LocationController`,
  `CheckLocationController`, `Gradual4BleController`, `BulbStringColorController`),
  `h7080/adjust/ui/*`, `h7080/adjust/h7085/*`, `h7080/H7080ApplicationImp.java`
- H7086: `h7086/pact/{Support,Comm}.java`, `h7086/ble/*.java`, `h7086/iot/CmdPtReal.java`,
  `h7086/adjust/controller/*`, `h7086/adjust/mode/diy/*`, `h7086/pact/bleiot/*`,
  `h7086/H7086ApplicationImp.java`
- module init: `outdoorlight/OutdoorLightModuleInitImpl.java`

## 7. Gaps / unknowns

- H7040 `HeartController.parseValidBytes` is partly decompiled control flow; the battery nibble
  mapping is confirmed from `BatteryInfo`, the work-mode nibble mapping (0x10→1, 0x20→-1,
  0x30→3, 0x40→4, 0x50→5) is inferred from the bytecode.
- H7056 scene `musicCode` is a 32-bit LE value whose meaning (online music id) is runtime/cloud
  supplied; only the default `2002` and the layout are static.
- H7080 276/H7085 packs are configured for detail/DIY but not registered in `Pact` for 45/55/56;
  its colour/segment behaviour is read through the same `SubModeColor.k` static set by `Comm`.
- H7086 cap-calibration response payloads are not parsed beyond "notify received" (status only).
- No MQTT topic/serialization or Matter cluster implementation is present in this split.
