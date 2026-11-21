# split_pact_h70b1 — curtain / icicle / spliceable matrix lights (H70B1/B2/BC, H70B3-5, H6800/681x, H70B6/B8, H70D1-3)

Source root: `decompiled/jadx-splits/split_pact_h70b1/sources/com/govee/`.

This is the largest split: **five pact sub-families** sharing a handful of BLE builders and a
common `MultiController` DIY/scene transport.

| package | goodsType | SKU(s) | product | transports |
|---|---|---|---|---|
| `h70b1/origin` | 134 / 185 / 216 | H70B1, H70B2, H70BC | Smart Curtain Lights / 400LED Curtain | **ble + iot** |
| `h70b3` | 229 / 230 / 231 | H70B3, H70B4, H70B5 | Curtain Lights | **ble + iot + matter pairing** |
| `h70b3` | 255 / 256 | H6810, H6811 | Curtain/matrix (spliceable) | **ble + iot + matter** |
| `h70b3` | 272 | H6800 | Matrix/curtain (interactive game mode) | **ble + iot + matter** |
| `h70b6` | 329 | H70B6 | Curtain Lights Pro | **ble + iot + wifi/mqtt + matter** |
| `h70b8` | 341 | H70B8 | Lightwall | **ble + iot + wifi/mqtt + matter** |
| `h70dx` | 267 / 268 / 269 | H70D1, H70D2, H70D3 | Icicle Lights | **ble + iot + matter** |

Matter pairing additionally names `H70C4..H70C9` and `H80C4` in the H70B3 matter `MatterConfig`
(`h70b3/add/AddDeviceM.java`). `H70B2` (185) is in `Support.f` but has no dedicated detail config;
it uses the H70B1 origin protocol plus Mtu/ptUrl helpers (`h70b2/origin/*`).

---

## 1. Transports & GATT UUIDs

Common vendor GATT pair in all sub-families:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `h70b1/origin/ble/BleComm.java`, `h70b3/ble/BleComm.java`, `h70b3/ble/Ble.java`
(also has static `t`/`u` UUIDs and MTU callback), `h70dx/ble/Ble.html` (uuid via
`BleCommUUID`), `h70b6` uses `h70b3.ble.Ble`.

**Important:** `h70b3/ble/Ble.r()` returns `com.govee.matter.pact.BleComm`, so H70B3/H70B6/H70B8
share the matter-aware BLE comm. Matter pairing frames are proType `0xAB`, cmdType `0x01..0x06`
(see §7).

BLE frame: 20 bytes, `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`.
Larger DIY/scene payloads are split by `MultipleControllerCommV1.makeSendBytesV3(...)` /
`MultipleBleBytes` and sent as `0xA3`/`0xA4` chunks (20 bytes each), with the final mode frame
appended.

---

## 2. H70B1 origin (134 / 185 / 216)

Pact registration (`h70b1/origin/pact/Support.addSupportPact`):
- 134: `beProtocol(1,1)` and `(2,1)`
- 185: `beProtocol(1,1)`
- 216: `beProtocol(1,1)` and `(2,1)`

`Support.getColorTemRange() = {1000,10000}` K. Scene op set `{0,1,5}`. Splicing share-code set
(`Support.b`) = `{36, 37, 42, 43, 53, 54}`; per-UI DIY share codes are
`{24, 36, 83}` for H70B1 and `{52, 53, 54}` for H70BC (`getShareCode`).

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] level` | `pact/Comm.makeBrightnessController4BleComm` |
| mode | `0x33/0x05` | sub-mode payload | `ble/Mode.java` |
| color | submode `0x0D` | `0D R G B kelLo kelHi R2 G2 B2` (9 B) | `ble/SubModeColor.java` |
| music | submode `0x13` | `13 musicCode sens` (default code 101=`BleProtocol.f`, sens 0..99) | `ble/SubModeMusic.java` |
| scene | submode `0x04` | `04 effLo effHi musicByte` (4 B) | `ble/SubModeScenes.java` |
| DIY | submode `0x0A` | `0A diyLo diyHi` | `ble/SubModeNewDiy.java` |
| splicing / subgroup | `0x33/0x40` | payload `{2,0}` = exit/query; `{2,1,R,G,B}` = set subgroup colour | `ble/SplicingController.java` |
| SN read | `0xAA/0x07` sub `{2}` | response `[0]=2` + 8-byte MAC (little-endian address string) | `h70b3/adjust/controller/SnController.java` (shared) |
| secret key read | `0xAA/0xB1` | response `[0]==1` + 8 bytes (base64) | `h70b3/adjust/controller/SecretController.java` |
| secret key write | `0x33/0xB2` | 8-byte base64-decoded secret | same |
| multi-frame body | `0xA3/0xA4, idx` | `MultipleControllerCommV1.makeSendBytesV3((byte)-93, shareCode, body, 97)` | `h70b1/origin/pact/Comm.java` |

Notify: `0x11` wifi, `0x20` brightness, `0x30` `[0]==1` then `[1]` bit1 = light status
(`h70b1/origin/ble/notify/DeviceInfoNotifyParse.java`). Heart is base `HeartControllerNoEvent`.

### Effects

`h70bx/diy/protocol/EffectCodeManager` supplies the H70B1/H70B2 effect-code list:

```
467, 553, 554, 531, 532, 535, 536, 537, 538, 539, 540,
544, 545, 546, 547, 548, 549, 550, 551, 552
```

H70BC (216) uses a different list:

```
645, 648, 649, 650, 651, 654, 655, 656, 657,
539, 540, 544, 658, 659, 660, 661, 549, 550, 551, 552
```

These are the 16-bit LE scene/DIY-template codes carried in `0x04` and `0x0A`.
`Support.getEffectCode(goodsType,1|2|3)` and `getShareCode` map DIY UI sub-tabs:
- H70B1: share codes `24, 36, 83`; protocol `83` (single) / `91` (multi)
- H70BC: share codes `52, 53, 54`; protocol `83` / `91`

### IoT

Envelope V2 (`IotMsgV2`). Commands: `turn` (`val`), `brightness` (`val`), `colorwc`
(`color`,`colorTemInKelvin`), `pt` (`op`, `value[]`), `ptReal` (`command[]`), plus read `status`.
`CmdPtReal` builds DIY (`getDiyCmdPt`), DIY template (`getDiyStudioCmdPt`), DIY graffiti
(`getDiyCmdPt4DiyGraffiti1`) and scenes (`getNewScenesCmdPtReal`) as base64 BLE frames.
`Support.supportIotV1GoodsType` returns true for all three goodsTypes (V1-compatible payloads).

---

## 3. H70B3 / H70B4 / H70B5 / H6810 / H6811 / H6800 (229/230/231/255/256/272)

Pact registration is protocol-list based per goodsType: 229 gets `(1,1),(1,2),(2,1),(2,2),(2,3)`;
230 the same; 231 gets `(1,1),(1,2),(2,1)`; 255/256 `(1,1),(2,1),(2,2),(2,3)`; 272
`(1,1),(1,2),(2,1),(2,2)`.

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0]` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] level` | `pact/Comm` |
| mode | `0x33/0x05` | sub-mode payload | `ble/Mode.java` |
| color | `0x0D` | `0D R G B kelLo kelHi R2 G2 B2` | `ble/SubModeColor.java` |
| music | `0x13` | `13 code sens` (default 101) | `ble/SubModeMusic.java` |
| scene | `0x04` | `04 effLo effHi musicByte` | `ble/SubModeScenes.java` |
| DIY | `0x0A` | `0A diyLo diyHi` | `ble/SubModeNewDiy.java` |
| interactive game (H6800) | `0x14` | 2-level mode/level/time layout (below) | `mode/game/SubModeInteractive.java` |
| device/splicing num | `0x33/0x40` | read: no payload; write: `[0] count` | `adjust/controller/ControllerDeviceNum.java` |
| change splicing | `0x33/0x40` | `[1] index, [2] direction mask, MAC[6]…`; direction masks from bits `01100000/01101100/10010000/10011100/11011000` | `h70bx/controller/ControllerChangeSplicing.java` |
| position calibration | `0x33/0x42` | `[0] mode (0/1/2), [1] direction, [2]=1`; read `p()` = `{1}` | `ble/controller/PositionCalibration.java` |
| read sub-device version | `0xAA/0x43` | no payload | `h70bx/controller/ControllerReadSubDeviceVersion.java` |
| secret key | `0xAA/0xB1` / `0x33/0xB2` | 8-byte key | `adjust/controller/SecretController.java` |
| display data | `0x33/0x7F` | subcommand + payload; notify `0x7F[1]==6` = countdown report | `h70b3/pact/BleProtocol.MODE_DISPLAY=-127`; `h70b6/adjust/VM4H70B6.java` |
| wifi upgrade | `0x33/0x7D` | `[0] 4|1|2` query/start/status | `h70b6/controller/WIFIUpgradesController.java` |
| 24-hour display | `0x33/0x7D` | `[0] 0/1` (H70B6 `c6`) | `h70b6/adjust/VM4H70B6.java` |
| temperature unit | `0x33/0x7E` | `[0] 1=C 0=F` (H70B6 `g6`, inverted) | `h70b6/adjust/VM4H70B6.java` |
| DIY multi-frame | `0xA3/0x5A?` -> actually `makeSendBytesV3(0xA3,0x5B/0x5C, …)` + `0x05/0x0A` | `Comm.makeDiyCmd4IotCommMulti`; protocol code `0x58` for new DIY | `pact/Comm.java`, `diy/*` |

`BleProtocol` constants (`h70b3/pact/BleProtocol.java`): 19 music, 13 color, 4 scenes, 10 DIY,
-127 display, 32 brightness, 64 device/install num, 20 interactive, -79/-78 secret read/write,
66 position calibration, 96 (`Companion.a()`) feast-switch **notify** (`[0]==1`, `[1]` on/off).

### Interactive / game submode (H6800, 0x14)

`SubModeInteractive.getWriteBytes()`:

```
oneLevelMode == 0: 14 01 sensitivity1 00 soundLevel timeLo timeHi
oneLevelMode != 0: 14 01 sensitivity2 oneLevelMode twoLevelMode [difficultLevel]
```

- `soundLevel` 1..6+ maps to level time `14,28,42,56,70,98,126` (seconds-ish), 16-bit LE.
- `twoLevelMode==1` adds `difficultLevel` byte.
- Read (`parse`): `[0]=sensitivity`, `[1]=oneLevelMode`; if 1 then `[2]=twoLevelMode`,
  `[3]=difficulty`, `[4..6]=startTime` (24-bit) where `300000 - value` = remaining ms, `-1`/0/>300000
  => 0. `status`/`gamesStatus` are local UI state.

### Effects

`h70b3/diy/protocol/EffectCodeManager` gives the B3/B4/B5 effect-code universe:

```
base:   684 685 686   757 758 759   679 680   666 667   670 671 672 673 674 678
         687 688 689   668 669   683   681 682   675
extra:  707 708 709 710 711   771 772 773   890
```

H6810 (255): `707` (single) plus `709/771/890` when splicing; H6811 (256): `707`, `708`, `709`,
`771`, `772`; H6800 (272): `679/680/666/667/670/671/672/673/674/678` (and `707/708/709` for
splicing).
UI basic-effect names map to these codes in `Support.k()`: YunRan (1→683/707, 2→681/707, 3→682),
GIF (4), BoBanTang, DaFengChe, SiDai 1/2 (7/8), ShanFeng, HuoGuang, JiaoTi, ShenSuo,
DangYang 1/2 (13/14), DuiJi 1/2 (15/16), TanTiao, TanTiaoQiu, TanChiShe, XiaoXiaoLe, YanHua,
PenShe. The `h70b3/diy/simple/effect/*` classes each carry their `getEffectCode()` and byte
layout; `h70b3/diy/advance/*` are the multi-layer (cell graffiti) variants.

### IoT

`h70b3/iot/Cmd` = `state/op/online/turn/brightness/status/colorwc/ptReal/pt`. Same V2 envelope.
`GetIotCmdPtUrlLinkInfo` in `h70b3/iot` fetches a long-lived `ptUrl` blob for large DIY effects;
`Op*CommDialog4BleIot` prefer BLE+MQTT when `DeviceCommCapability.supportMqtt(...)` and the
device has a topic, otherwise IoT `ptReal`.

---

## 4. H70B6 / H70B8 (329 / 341)

H70B6/H70B8 reuse the H70B3 BLE builders (`h70b3/scenes/*`) and `h70b3.ble.Ble` (matter-aware
BleComm). H70B8 differs only in display/segments (`Support.a(341) = (32,48)` vs `(32,30)`).

### Extra BLE commands (beyond the H70B3 set)

| command | op | payload / layout | source |
|---|---|---|---|
| 24-hour mode | `0x33/0x7D` | `[0] 1=24h,0=12h` | `h70b6/adjust/VM4H70B6.java#c6` |
| temperature unit | `0x33/0x7E` | `[0] 1=Celsius, 0=Fahrenheit` (call passes `!z`) | `h70b6/adjust/VM4H70B6.java#g6` |
| display config / countdown | `0x33/0x7F` (write); notify `0x7F` | subcommand 6 = countdown report | `h70b6/adjust/VM4H70B6.java`; `BleProtocol.k=127` |
| wifi upgrade query | `0x33/0x7D` | `[0] 4` query; response `[0]=1,[1]=1,[2]=state,[3..5]=wifi soft,[6..8]=wifi hard` | `h70b6/controller/WIFIUpgradesController.java` |
| DIY effect protocol | `0xA3`/multi + `0x05/0x0A` | protocol code `0x58`, effect code 751/750/864/865/862/863/886/887/900/901/905 | `h70b6/diy/advance/H70B6EffectCodeManager.java` |

`h70b6/pact/BleProtocol` also defines: 19 music, 10 DIY, 57 device install num, 37 (?), 125
(`q`) 24-hour, 126 (`r`) temp unit, 13 color, 68 brightness?, 96 (`a()`), 84/103/127 name/version
lengths.

### Display effects

`H70B6DisplayConfig.getSupportEffect`:
- group 1: `11,12,13,15` (clock faces)
- group 2: `21,22,23,24,27`
- group 5: `51,52`

### DIY / dynamic effects (H70B6)

`Pro4H70B6Diy` main groups and sub-effects (effect body `[lenLo lenHi][sub][second][RGB…]`):

| main | name | second ids |
|---|---|---|
| 1 | YunRan (gradient) | 1 CaiQiang (colour wall), 2 FuGai (cover) |
| 2 | XuanZhuan (rotate) | 1 BoBanTang, 2 DaFengChe |
| 3 | BoDong (wave) | 1 BoFeng, 2 ShuangLuoXuan |
| 4 | LiuDong (flow) | 1 ShenSuo, 2 DieJia |
| 5 | SuiJi (random) | 1 TanTiaoQiu, 2 TanChiShe, 3 XiaoXiaoLe, 4 YanHua |
| 6 | XianXing (linear) | 1 XiangSu, 2 TianChong, 3 PenShe |

`H70B6CellGraffitiParse` tags 76..80; `H70B6DiyParser.getProtocolCode()=0x58`.
H70B8 uses the same classes with `EASY_EFFECT_H70B8_GIF=865`, `EFFECT_CODE_CELL_H70B8_30=863`.

### IoT / wifi

H70B6/H70B8 use the shared base `CmdTurn/CmdBrightness/CmdColorWc/Cmd4PtReal`; no per-family
`iot/Cmd*.java`. WiFi software version check is HTTP
`GET /bff-app/v1/devices/upgrade/wifi/check?sku&device&bleSoftVersion&bleHardVersion&wifiSoftVersion&wifiHardVersion`
(`h70b6/INetService4H70B6.java`). Dynamic-domain names `H70B6`, `H70B8` are registered for LAN
routing.

---

## 5. H70D1 / H70D2 / H70D3 (267/268/269)

Pact is per-goodsType via `ConfigH70DX`: `(1,1)` and `(2,1)` for each of 267/268/269, and
MatterInterceptor enabled for all three. Device shape: 10 segments (`SubModeColor` default mask
`boolean[10]`), kelvin 1000..10000.

### BLE commands

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0]` | `pact/Comm` |
| brightness | `0x33/0x04` | `[0]` | `pact/Comm` |
| color | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 maskLo maskHi` (17 B); brightness mode `15 02 level maskLo maskHi`; raw `15 03 c0..` | `ble/SubModeColor.java` |
| music | `0x13` | `13 code sens` (default 101) | `ble/SubModeMusic.java` |
| scene | `0x04` | `04 effLo effHi musicByte` | `ble/SubModeScenes.java` |
| DIY | `0x0A` | `0A diyLo diyHi` | `ble/SubModeNewDiy.java` |
| install/direction info | `0x33/0x39` | `[0] installType (1/2), [1] direction (1/2)` | `ble/controller/ControllerInstallInfo.java`, `ControllerInstallInfoOld.java` |
| init light effect | `0x33/0x38` | `[0] effect index` | `ble/controller/ControllerInitLightEffect.java`, `ControllerInitEffectOld.java` |
| device num / splicing | `0x33/0x40` | `[0] count` / splicing MAC list | shared H70B3 controllers |
| secret key | `0xB1/0xB2` | 8-byte key | shared |

Install-direction encodings (`h70dx/Support.e`):
- H70D1: `{1,1}` right, `{1,2}` left
- H70D2/H70D3: `{2,1}` middle A, `{2,2}` middle B

### DIY / effects (H70DX)

`H70DXDiyParse` (protocol code 88 / `0x58`) sub-effect ids 1..10:

| id | effect |
|---|---|
| 1 | MaSaiKe (mosaic) |
| 2 | XingGuang (starlight) |
| 3 | GeShan (partition) |
| 4 | XueHua (snowflake) |
| 5 | YunRan (gradient) |
| 6 | HuoGuang (firelight) |
| 7 | JiHe (geometry) |
| 8 | TanTiaoQiu (bouncing ball) |
| 9 | QinJian (piano keys) |
| 10 | ZuHe (combo) |

Each has action config (1..6), brightness config (1..4), direction options `9/10/2/19/15/20`,
speed range 0..100. Cell-graffiti parse uses tags `76..80`. `ConfigH70DX` also defines effect
codes 719, 715, 716, 718, 778, 774, 775, 777 (base64 DIY presets).

### IoT

Same `Iot*CmdBuilder` set (turn/brightness/colorwc), `CmdPtReal` for DIY/scene, and
`scenes/GetIotCmdPtUrlLinkInfo` for long `ptUrl` blobs.

---

## 6. Shared music / scene naming

Music sub-mode `0x13` codes are named by base `IMusicEffectStatic`:

- single-value: `0 Dynamic/Energic, 1 Soft, 2 Party, 3 Rhythm, 4 Spectrum, 5 Energic, 6 Rolling,
  7 Jump, 8 Hit, 9 Jet, 16 Mic, 17 Colorful, 18 Sunlight, 19 Joy, 20 Accumulation`
- multi-value (H70B1/H70B3/H70B6/H70DX): `48 Zhanfang, 49 Cuican, 50 Fenli, 51 Joy, 52 Piano Keys,
  53 Fountain, 54 Sea Wave, 55 Day/Night, 56/68/114 Rhythm, 69 Hit, 70 Jet, 71 Jump, 72 Joy,
  73 Beat(legacy), 74 JumpBall, 75 Rhythm, 77 Rainbow Candy, 78 XiaoXiaoLe, 79 Blend, 80 Torch,
  81 Flowing Shadow, 83 Flowing Light, 84 Spectrum, 85 Colorful, 86 PiaoWu, 87 CrossStar,
  88 Heart, 89 Rainbow Ring, 90 Rolling, 91 Bounce, 92 JianShan, 93 Split, 94 Windmill,
  96 Record, 97 Ripple, 98 Alternate, 99 Broadcast, 100 Dandelion, 101 Meteor Shower,
  102 Illusory Colors, 103 Quicksand, 104 Rainbow Circle, 105 Meteor, 113 Rolling,
  114 Rhythm, 115 ChuDong, 116 MoHuan, 122 Separate, 123 Impact, 124 Manyan, 125 Color Wall,
  126 Christmas Eve, 127 FanKuai, -128 Waves, -127 Sound Waves, -126 Custom 606A,
  -125 Point, -124 Water Flower, -123 Spring, -118 Zhanfang, -114 Shuttle, -113 Flash`
  (from `base2light/ble/IMusicEffectStatic.java`; `parseSubStr4New`).

Scenes are server-driven; only the op-sets and defaults are static:
`Support.supportScenesOpSet() = {0,1,5}` (H70B1/H70B3/H70B6),
`{0,2,3,5}` (H70DX), H6800 `{0,5}`, and `SubModeScenes.a` default `22 (Stream)`.

---

## 7. Matter pairing (H70B3/H70B6/H70B8/H70DX)

`h70b3/ble/Ble.r()` returns `com.govee.matter.pact.BleComm`; `AbsMtReadController` sets
**proType 0xAB**, payload `[0]=subcommand`. Controllers:

| subcommand | controller | request | response |
|---|---|---|---|
| 1 | `Controller4QrCode` | `{1}` | QR payload string |
| 2 | `Controller4BaseInfo` | `{2}` | 3 flags (`MatterBaseInfo`) |
| 3 | `Controller4WifiSsid` | `{3}` | SSID string |
| 4 | `Controller4Gid` | `{4}` | GID string |
| 5 | `Controller4MatterId` | `{5}` | Matter ID string |
| 6 | `Controller4PairCode` | `{6}` | pairing code string |
| 3 write | `Controller4WifiFunc` | SSID/credentials | same cmd 3 |
| 5 write | `Controller4GidWrite` | proType 63 (`0x3F`) | multiple GID |

`MtPairProtocol`: proType `0xAB`, sub-commands 1..6, protocol version 5. Matter is used for
**commissioning/add flow only**; runtime control stays BLE/IoT.

---

## 8. Other protocols

- **ptUrl** — `h70b2/origin/iot/GetIotCmdPtUrlLinkInfo`, `h70b3/iot/GetIotCmdPtUrlLinkInfo`,
  `h70dx/scenes/GetIotCmdPtUrlLinkInfo`, and base `base2light/kt/comm/CmdPtUrl`/`PtUrlService`:
  fetch a long-lived command blob (`PtUrlDataInfo`) and execute it; used for very large DIY
  (cell-graffiti/GIF) effects that do not fit in `ptReal`.
- **LAN/MQTT** — only capability detection (`DeviceCommCapability.supportMqtt` + non-empty topic)
  inside `OpDiyCommDialog4BleIot`; no topic schema in this split.
- **HTTP** — WiFi OTA check (`/bff-app/v1/devices/upgrade/wifi/check`), pairing/bind APIs in
  `h70b3/add/ApiService.java`, `h70b3/adjust/vm/INetService.java`.
- **Multi-device sync** — splicing controllers (`0x40`) and `ControllerChangeSplicing`; not
  `multiSync` cloud command.

---

## 9. Source map (traced)

- H70B1 origin: `h70b1/origin/pact/{Support,Comm}.java`, `h70b1/origin/ble/*.java`,
  `h70b1/origin/iot/*.java`, `h70b1/origin/scenes/*`, `h70bx/diy/protocol/EffectCodeManager.java`,
  `h70bx/ConfigDetail.java`, `h70bx/H70b1Application.java`
- H70B3: `h70b3/Support.java`, `h70b3/pact/{BleProtocol,Cmd,Comm}.java`, `h70b3/ble/*.java`,
  `h70b3/iot/*.java`, `h70b3/diy/{advance,simple,parse,protocol}/*`,
  `h70b3/mode/game/SubModeInteractive.java`, `h70b3/adjust/controller/*`,
  `h70b3/add/AddDeviceM.java`
- H70B6/B8: `h70b6/Config4H70B6Manager.java`, `h70b6/Support.java`, `h70b6/pact/BleProtocol.java`,
  `h70b6/diy/parser/*`, `h70b6/diy/advance/*`, `h70b6/adjust/VM4H70B6.java`,
  `h70b8/Config4H70B8Manager.java`
- H70DX: `h70dx/{Support,ConfigH70DX}.java`, `h70dx/pact/{BleProtocol,Comm}.java`,
  `h70dx/ble/*`, `h70dx/diy/*`, `h70dx/vm/VM4H70DX.java`
- Matter: `base.../com/govee/matter/pact/*` (`MtPairProtocol`, `AbsMtReadController`, controllers)
- shared transport/MTU: `h70b2/origin/ble/{MtuConfig,MTURequestManager}.java`, `h70b3/ble/Ble.java`

## 10. Gaps / unknowns

- Scene effect IDs are cloud (`ScenesM`) values; only the local DIY/effect-code universes and
  defaults are statically known.
- Multi-frame chunk header details come from base `MultipleControllerCommV1`; the split only
  passes `(0xA3, shareCode, body, 97)`.
- H70B3 display write payload beyond subcommand byte is parsed by base `Display*` controllers and
  was not fully recoverable here; only `0x7F[1]==6` countdown notify and the display effect
  groups are clear.
- `h70b3/pact/BleProtocol.m=96` (`Companion.a()`) is the feast-switch notify type; layout
  `[0]==1`, `[1]==1` feast on (`VM4H70B345.q6`).
- `h70b6/pact/BleProtocol` constants 84/103/127 are used as fixed name/version lengths; their
  exact consumers were not traced.
- H70B2 (185) has no detail config in this split; it likely shares H70B1 origin + Mtu + ptUrl, but
  its UI/feature set is not present here.
- Matter cluster/attribute mapping is not in this split (commissioning only).
