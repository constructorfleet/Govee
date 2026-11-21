# split_pact_rgbiclight — RGBIC lighting protocol extract

Source root: `decompiled/jadx-splits/split_pact_rgbiclight/sources`
Base helpers: `decompiled/jadx-base-7.7.10/sources`

This split contains **15 sub-families / SKU groups** of Govee RGBIC products: light
strips, "dream color" strips, neon/bare-light strings, chassis/underglow lights and
the shared RGBIC scene/DIY/music engine. Many SKUs are only *registered* here while
their low-level controller lives in `base2light`; the per-family opcode sets, sub-mode
IDs and payload shapes are documented below.

---

## 1. Overview / families

| Sub-family (package) | SKUs | Goods types | Transports | Protocol shape |
|---|---|---|---|---|
| `com.govee.h6102` | H6102 | 17/18 style BLE | `ble` | mode 0x05; sub 0x02 color, 0x01 music, 0x04 scene, 0x0A DIY; limit 0x0E |
| `com.govee.h6105` | H6105 | 17/18 style BLE | `ble` | same as H6102 but music sub 0x03 |
| `com.govee.h6119` | H6119 | 17/18/70/73 (BLE profile) | `ble` | sub 0x02, 0x0B color V1, 0x15 color V2, 0x0C music, 0x04 scene, 0x0A DIY; gradual 0x14; bulb-string read 0xA5 |
| `com.govee.h612526` | H6125, H6126 | 19/71 style (BLE profile) | `ble` | sub 0x0B color (15-seg), 0x0C music, 0x04 scene, 0x0A DIY; gradual 0x14 |
| `com.govee.h6127` | H6127, H6116, H6107, H6161 | 17/18 style BLE | `ble` | sub 0x02, 0x01 music, 0x03 music V1, 0x04 scene, 0x07 old DIY, 0x0A new DIY |
| `com.govee.h6129` | H6129 | 17/18 style BLE | `ble` | sub 0x02, 0x03 music, 0x04 scene, 0x07 old DIY, 0x0A new DIY |
| `com.govee.h6185` | H6185 | 17/18 style BLE | `ble` | sub 0x02, 0x05 mic, 0x04 scene, 0x0A DIY |
| `com.govee.rgbiclight.h6160` | H6163, H6117 | 21 | `ble+iot` | sub 0x02, 0x0B color V1, 0x0D color4bk, 0x15 color V2, 0x01 music V1, 0x03 music, 0x0E music V1 RGB, 0x04 scene (LE16), 0x0A DIY; IoT incl. `ptReal` |
| `com.govee.barelightv1` | H6145, H6146, H6147, H6171 | 13 | `ble` | sub 0x0B color, 0x15 color V2, 0x0C music, 0x13 new music, 0x04 scene, 0x0A DIY; gradual 0x14 |
| `com.govee.chassislightv1` | H6184, H7092 | 11, 162 | `ble` | sub 0x02, 0x15 color V2 (7/8 seg), 0x05 mic, 0x13 mic V2, 0x04 scene, 0x0A DIY |
| `com.govee.h7090` | H7090, H7095 (+H7092/H6119 refs) | 44, 127, 162 | `ble` | sub 0x15 color V2 (6/8 seg), 0x13 music, 0x04 scene, 0x0A DIY; light-pos 0x31, LR switch 0x33, compose heart 0x33 |
| `com.govee.dreamcolorlightv1` | large H61xx/H70Ax set (see §2) | 17,18,70,73 (ble) + 19,71,74,75,83,262,123,175,176,193,187,178,136,204,207,234 (ble+iot) | `ble` / `ble+iot` | shared dream-color BLE opcodes; IoT `state`/`op` + `ptReal`/`pt`/`bulb` |
| `com.govee.dreamcolorlightv2` | H6143, H6144, H611A | 21 (+ble+iot) | `ble` / `ble+iot` | dream-color V2 BLE; IoT `ptReal` only |
| `com.govee.rgbiclight` (shared) | H6671, H6672, H61C2, H61C3, H61C5 | 332/352/141 | `ble+iot` | new-detail RGBIC engine; `IotMsgProType.V2`, `ptReal` |
| `com.govee.rgbiclight.h667172` | H6671, H6672 | 332 | `ble+iot` | UI/cut-calibration only (44/56 IC layout); uses shared engine |
| `com.govee.rgbiclight.neonlight` | neon shape SKUs (H61A9 family) | — | `ble+iot` | scene "install" effect through shared engine |

A `pact` type/code is not exposed as a single constant for these SKUs; protocol
selection is by **goodsType** plus `Protocol(type, code)` pairs registered in
`pact()` (e.g. `GoodsType.beProtocol(1,1)`, `(1,2)`, `(2,1)`, `(10,1)`, `(10,2)`).

---

## 2. SKU universe in this split

### 2.1 Locally registered SKUs

`h6102`: **H6102**
`h6105`: **H6105**
`h6119`: **H6119**
`h612526`: **H6125, H6126**
`h6127`: **H6127, H6116, H6107, H6161**
`h6129`: **H6129**
`h6185`: **H6185**
`rgbiclight.h6160`: **H6163, H6117**
`barelightv1` (goodsType 13): **H6145, H6146, H6147, H6171**
`chassislightv1` (goodsType 11, 162): **H6184, H7092**
`h7090` (goodsType 44, 127): **H7090, H7095**
`h667172`: **H6671, H6672**
`rgbiclight` SupportV2: **H6671, H6672** (332), **H61C2, H61C3, H61C5**

### 2.2 Dream-color SKU/constant table (`dreamcolorlightv1/pact/Support.java`)

The class exposes a long list of SKU string constants used by the shared RGBIC engine:

`H6102, H6127, H6161, H6116, H6125, H6126, H6163, H6117, H6145, H6146, H6147,
H6171, H6123, H614C, H611B, H611Z, H617A, H617B, H617C, H618A, H618B, H618C,
H619A, H619B, H619C, H619D, H619E, H61A5, H619Z, H6172, H6173, H618F, H617E,
H617F, H61A0, H61A1, H61A2, H61A3, H61B2, H61E1, H61E0, H616C, H61B1, H61BC,
H616D, H61BE, H61BA, H616E, H61B5, H80B5, H6168, H61A8, H61A9, H70A1, H70A2,
H70A3, H6176, H6175, H612A, H612B, H612C, H612D, H612E, H612F, H6086, H6089`

`dreamcolorlightv2/pact/Support.java` adds **H6143, H6144, H611A** (goodsType 21
profile). `h61050729/BleProtocol.java` is a dated H6105 protocol revision
(sub 0x15 color / 0x04 scene / 0x0A DIY / 0x03 music).

### 2.3 GoodsType → transport rule

`dreamcolorlightv1/pact/Support.java`:

- BLE list `Q0 = {17, 18, 70, 73}` (SubLib keys are these strings) → `ble`
- BLE+IoT list `f0 = {19, 71, 74, 75, 83, 262, 123, 175, 176, 193, 187, 178, 136, 204, 207, 234}` → `ble+iot`
- `SubMaker` registers 8 `AbsBleIotSkuItem` for goodsType 176, 193, 187, 178, 175, 204, 207, 234 plus V1–V7 items for 19/71/74/75/83/262/123.

`dreamcolorlightv2`: `g = {21}` → `ble`; H6143/H6144 additionally get BLE+IoT
(`Support4DreamColorLightV2.b/c` use `{Protocol(1,1),Protocol(1,2)}` and `{Protocol(2,1)}`).

`chassislightv1`: `g = {11, 162}`; 11 → `GoodsType.beProtocol(1,1)` and `(10,1)`,
162 (H7092) → `(1,1)`.

`h7090`: 44 (H7090) → `(10,1)`+`(10,2)`; 127 (H7095) → `(1,1)`.

`barelightv1`: 13 → `(1,1)` + `(1,2)`.

`rgbiclight` SupportV2: 332 (H6671/H6672) → `(1,1)`+`(2,1)`; 352 → `(1,1)`+`(1,2)`;
141 (H61C2/C3/C5) → `(1,1)`+`(2,1)`.

---

## 3. Transports & GATT UUIDs

Every family in this split uses the same vendor GATT pair:

- Service: `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic: `00010203-0405-0607-0809-0a0b0c0d2b11`

Confirmed in:
`h6102/ble/BleComm.java` + `MultipleBleComm.java`, `h6105`, `h6119`, `h612526`,
`h6127`, `h6129`, `h6185`, `barelightv1/ble/BleComm.java`,
`chassislightv1/ble/BleComm.java`, `h7090/ble/BleComm.java` (`Q`/`V`),
`rgbiclight/ble/BleComm.java` + `BleMultiComm.java`,
`rgbiclight/h6160/ble/BleComm.java`.

Notify characteristics are the same characteristic. `rgbiclight/ble/BleNotifyComm`
parses notifications with `WifiNotifyParse` (IoT-style packets over BLE for
ble+iot devices).

**IoT transport** is the cloud/MQTT path implemented in base `Iot`/`Write`
(transaction + account topic). `ptReal` tunnels 20-byte BLE frames as base64, so the
BLE tables in §4 apply verbatim to `ble+iot` SKUs.

---

## 4. BLE frame + command table

### 4.1 Frame

`com.govee.base2kt.utils.BleUtils.generate20Bytes(proType, cmdType, payload)`
(`BleUtils.Companion.p()`):

| offset | meaning |
|---|---|
| 0 | proType: `0x33` write, `0xAA` read, `0xA3` multi write V1, `0xA5` multi write, `0xEE` notify/OTA-prepare |
| 1 | cmdType / opcode |
| 2..18 | payload (17 bytes max, zero padded) |
| 19 | BCC = XOR of bytes 0..18 |

Read response stripping (`AbsSingleController.m()`): read (`0xAA`) → `value[2..18]`
(17 bytes); write (`0x33`) → `value[3..18]` (16 bytes).

Multi-packet (`AbsMultipleController`, proType `0xA3`/`0xA5`,
`MultipleControllerComm.makeWriteMultipleBytes`, `MultipleControllerCommV1`):

- start packet: `[0]=proType [1]=cmdType [2]=0 [3]=packCount [4]=controller.p() ... [19]=BCC`
- data packets: `[0]=proType [1]=cmdType [2]=index(1..N) [3..18]=16-byte chunk [19]=BCC`
- end packet: `[0]=proType [1]=cmdType [2]=0xFF [19]=BCC`
- V1 (`makeSendBytesV0`): start `[2]=0 [3]=packCount+2 [4]=cmdType`, data `[1]=index`,
  17-byte chunks, end `[1]=0xFF`.
- `makeSendBytesV2`: start `[2]=1 [3]=packCount [4..]=commBytes`, chunks of 17, end `[1]=0xFF`.

Responses to multi-read use `[2]=0` (start, `[3]`=packLen), `[2]=index`, `[2]=0xFF` (end).

### 4.2 Universal controllers (base `base2light.ble.controller`)

| Opcode | Controller | Write payload | Read/notify layout |
|---|---|---|---|
| `0x33/0x01` | `SwitchController` | `[0]=on/off` | `0xAA/0x01` → `[0]` state |
| `0xAA/0x01` | `HeartController` (read only) | — | `[0]` heartbeat state |
| `0x33/0x04` | `BrightnessController` | `[0]=brightness 0..254` | `0xAA/0x04` → `[0]` brightness |
| `0x33/0x05` | family `ModeController` (`AbsModeController`) | `subMode.getWriteBytes()` | `0xAA/0x05` → `[0]=subMode`, `[1..]=sub payload` |
| `0x33/0x02` | `MultipleDiyController` (multi) | DIY protocol bytes (cmd 0x02) | — |
| `0x33/0x03` | `MultipleDiyControllerV1` / graffiti | DIY bytes | — |
| `0x33/0x57` | `MultiDiyGraffitiControllerV3` | graffiti DIY blob | — |
| `0xA3/0x41` | `MultipleController4Music` | music/effect blob, `p()`=sensitivity | — |
| `0x33/0x40` | `MultipleColorStripControllerV1` | per-segment color blob | — |
| `0x33/0x11` | `SleepController(V2)` | `[0..3]` sleep params | `[0..3]` |
| `0x33/0x12` | `WakeUpController(V2)` | `[0..3]` wake params | `[0..3]` |
| `0x33/0x19` | timer/pre-set | timer struct | timer struct |
| `0x33/0x39` | `CheckDirectionFinishController` | direction check | `[0]` |
| `0x33/0x14` | family `GradualController` / `Gradual4BleWifiController` | `[0]=0/1` (gradient on/off) | `[0]` |
| `0xEE` | OTA prepare | family specific | — |

Brightness percent → raw conversion: `NumUtil.calculateProgress(max,min,pct)` =
`min + (pct-1)*((max-min+3)/100)`. BLE ranges are `{20,254}` by default, `{6,254}` for
"old dream color min brightness" devices (`dreamcolorlightv1/Support.getBrightnessRange`).

### 4.3 Family opcode/sub-mode constants

#### h6102 / h6105 (`h6102/ble/BleProtocol.java`, `h6105/...`)

```
sub_mode_music     0x01 (h6102) / 0x03 (h6105)
sub_mode_color     0x02
sub_mode_scenes    0x04
sub_mode_new_diy   0x0A
SINGLE_LIMIT       0x0E   (LimitController)
```
Scene IDs (`value_sub_mode_scenes_*`): gm 0, sunset 1, film 4, dating 5, romantic 7,
blinking 8, cl(candle) 9, snow 15.
Music sub-modes h6102: energic 0, spectrum 1, rolling 2, rhythm 3.
`LimitController`: cmd `0x0E`, payload `[0]=limitFlag`, read result `[0]==1`.

#### h6119 (`h6119/ble/BleProtocol.java`)

```
sub_mode_color      0x02
sub_mode_color_v2   0x15
sub_mode_music      0x0C
sub_mode_scenes     0x04
sub_mode_new_diy    0x0A
SINGLE_GRADUAL_CHANGE_4_BLE 0x14
```
Scene IDs: blinking 8, breath 10, chase 21, cl 9, date 5, dynamic 16, romantic 7,
stream 22. Music styles: energy 0, rhythm 1 (sub power 0 / soft 1), scroll 2.

#### h612526 (`h612526/ble/BleProtocol.java`)

```
sub_mode_color      0x0B  (15 segments)
sub_mode_music      0x0C
sub_mode_scenes     0x04
sub_mode_new_diy    0x0A
SINGLE_GRADUAL_CHANGE 0x14
SINGLE_LIGHT_NUM    15
MSG_TYPE_READ_BULB_COLOR 0xA2
```
Scene IDs: movie 4, date 5, romantic 7, blinking 8, cl 9, breath 10, snow 15,
dynamic 16, chase 21, stream 22. Music: energy 0, scroll 2, spectrum 3, rhythm 4.

#### h6127 (`h6127/ble/BleProtocol.java`)

```
sub_mode_music         0x01
sub_mode_color         0x02
sub_mode_music_no_ic   0x03
sub_mode_scenes        0x04
sub_mode_old_diy       0x07
sub_mode_new_diy       0x0A
```
Scene IDs: gm 0, sunset 1, film 4, dating 5, romantic 7, blinking 8, cl 9, snow 15.
Music: energic 0, spectrum 1, rolling 2, rhythm 3.

#### h6129 (`h6129/ble/BleProtocol.java`)

```
sub_mode_color      0x02
sub_mode_music      0x03
sub_mode_scenes     0x04
sub_mode_old_diy    0x07
sub_mode_new_diy    0x0A
```
Scene IDs: gm 0, sunset 1, film 4, dating 5, romantic 7, blinking 8, cl 9, snow 15.

#### h6185 (`h6185/ble/BleProtocol.java`)

```
sub_mode_color      0x02
sub_mode_scenes     0x04
sub_mode_mic        0x05
sub_mode_new_diy    0x0A
```
Mic sub-ops: set mode 1, send rhythm point 3.
Scene IDs: film 4, date 5, romantic 7, blinking 8, cl 9, breath 10, dynamic 16.

#### h6160 — H6163/H6117 (`rgbiclight/h6160/ble/BleProtocol.java`)

```
MSG_TYPE_READ_BULB_COLOR            0xA2
SINGLE_GRADUAL_CHANGE_4_WIFI_BLE    0xA3
sub_mode_music_v1       0x01
sub_mode_color          0x02
sub_mode_music          0x03
sub_mode_scenes         0x04
sub_mode_new_diy        0x0A
sub_mode_color_v1       0x0B
sub_mode_color_4_bk     0x0D
sub_mode_music_v1_rgb   0x0E
```
Music styles: energic 0, spectrum 1, rolling 2, rhythm 3; V1 power 0 / soft 1.
Scene IDs as h6102 (gm 0, sunset 1, film 4, dating 5, romantic 7, blinking 8, cl 9, snow 15).

#### barelightv1 — H6145/H6146/H6147/H6171 (`barelightv1/ble/BleProtocol.java`)

```
sub_mode_scenes      0x04
sub_mode_new_diy     0x0A
sub_mode_color       0x0B
sub_mode_music       0x0C
sub_mode_new_music   0x13  (19)
sub_mode_color_v2    0x15
SINGLE_GRADUAL_CHANGE           0x14
SINGLE_GRADUAL_CHANGE_4_WIFI_BLE 0xA3
SINGLE_OTA_PREPARE              0xEE
MSG_TYPE_READ_BULB_COLOR        0xA2
SINGLE_LIGHT_NUM                15
```
Scene IDs: gm 0, sunset 1, movie 4, date 5, romantic 7, blinking 8, cl 9, breath 10,
dynamic 16, chase 21, stream 22, snow 15.
Music: energy 0, rhythm 5, scroll 2, spectrum 3. New music: energy 5, rhythm 3
(sub power 0 / soft 1), scroll 6, spectrum 4.

#### chassislightv1 — H6184/H7092 (`chassislightv1/ble/BleProtocol.java`)

```
sub_mode_color      0x02
sub_mode_mic        0x05
sub_mode_scenes     0x04
sub_mode_new_diy    0x0A
sub_mode_mic_new    0x13  (19)
sub_mode_color_v2   0x15
SINGLE_GRADUAL_CHANGE_4_BLE     0x14
SINGLE_GRADUAL_CHANGE_4_WIFI_BLE 0xA3
```
Mic sub-ops: set mode 1, send rhythm point 3.
Scene IDs: movie 4, date 5, romantic 7, blinking 8, cl 9, breath 10, snow 15,
dynamic 16, chase 21, stream 22.

#### h7090 — H7090/H7095 (`h7090/ble/BleProtocol.java`)

```
SINGLE_LIGHT_POS                 0x31
SINGLE_LR_SWITCH                 0x33
SINGLE_GRADUAL_CHANGE_4_BLE      0xA3
SINGLE_OTA_PREPARE               0xEE
sub_mode_scenes                  0x04
sub_mode_new_diy                 0x0A
sub_mode_music                   0x13  (19)
sub_mode_color                   0x15  (V2 profile)
value_compose_light_switch       0x36
```
Music styles: rhythm 3, spectrum 4, energy 5, scroll 6.

---

## 5. BLE notifications / readings

| Family | Opcode | Layout / meaning | Source |
|---|---|---|---|
| all | `0xAA/0x01` | `[0]` heartbeat state | `HeartController.parseValidBytes` |
| all | `0xAA/0x04` | `[0]` brightness 0..254 | `BrightnessController` |
| all | `0xAA/0x01` write-reply | `[0]` on/off | `SwitchController` |
| all mode | `0xAA/0x05` | `[0]` sub-mode, rest parsed by `SubMode*` | `AbsModeController.parseValidBytes` |
| h6102/h6105 | `0xAA/0x0E` | `[0]==1` limit flag | `LimitController` |
| h6119 | `0xAA/0x0B`(read) | `[0]=count`, then `count` × `R,G,B` (bulb-string groups, 3 bytes each) | `BulbStringColorController` / `BulbGroupColor` |
| h6119 | `0xAA/0x02` | `R G B tempFlag R2 G2 B2` | `SubModeColor.parse` |
| h6119 | `0xAA/0x15` | `[0]` colorV2 type | `SubModeColorV2.parse` |
| h6160 v1 | `0xAA/0xA2` read | `[0]=count`, then `count` × `R,G,B` for 4 bulbs | `h6160/ble/v1/BulbStringColorController` |
| h6160 | `0xAA/0x04` | brightness | `BrightnessController` |
| h6160 | `0xAA/0x05` | sub-mode dispatch (0x01/0x03/0x04/0x0A/0x0B/0x0E) | `h6160/ble/Mode` |
| h612526 | `0xAA/0x0B` | `[0]` color code (read-only echo) | `SubModeColor.parse` |
| h7090 | `0xAA/0x31` | `[0]` light position 0/1 | `LightPosController` |
| h7090 | `0xAA/0x33` | `[0]` LR switch state, `[1]==1` festive/heart flag | `SwitchLRController`, `ComposeHeartController` |
| h7090 | `0xAA/0x03` | compose heart multi-reply | `ComposeHeartController` |

`BleNotifyComm` for RGBIC ble+iot devices additionally routes `WifiNotifyParse`
packets (IoT envelopes over the BLE notify characteristic).

---

## 6. IoT commands + status/readings schema

### 6.1 Envelope

Writes (`com.govee.base2home.iot.Write` / `AbsCmdWrite`):

```json
{"msg":{"transaction":"<generated>","accountTopic":"<topic>","type":1,"origin":32,
        "cmdVersion":<int>,"cmd":"<name>","data":{...}}}
```

Reads (`Read`/`AbsCmdRead`) use `"type":0`. Incoming variants:
- h6160 / rgbiclight-new: `IotMsgProType.V2` (`IotMsgV2` with `cmd`, `transaction`, `status`).
- dreamcolorlightv1: V1/V0 — reads by `state` (status) and `op` (passthrough pt/ptReal).
  `Cmd.getCmdReadParseKey()` returns `"op"` for `pt`/`ptReal`, otherwise `"state"`.
- dreamcolorlightv2: `state`/`op`.

### 6.2 h6160 (H6163/H6117) `iot/Cmd.java`

| cmd | data fields | meaning |
|---|---|---|
| `online` | — | device online event |
| `turn` | `val` 0/1 | power |
| `brightness` | `val` 0..100 (mapped 6..254) | brightness |
| `color` | `red`,`green`,`blue` | RGB |
| `colorTem` | `colorTemInKelvin`, `color{red,green,blue}` | temperature |
| `colorwc` | `color{r,g,b}`, `colorTemInKelvin` | combined color/temp |
| `timer` | `enable`, `timeOffset`, `timeOffsetMinute`, `time[{enable,openHour,openMin,closeHour,closeMin,repeat}]`, `isGroup`, `group` | timer |
| `pt` | `op` (`mode`/`ptReal`), `value[]` base64 20-byte frames | passthrough |
| `ptReal` | `command[]` base64 20-byte frames | BLE-over-cloud |
| `status` | see below | state read |

Status (`CmdStatusV0`):
```
{ softversion, wifiSoftVersion, turn, brightness, mode,
  color{red,green,blue}, colorTemInKelvin,
  timer{enable,time[{openHour,openMin,closeHour,closeMin}]} }
```
`mode==2` is color-temp; the app reconstructs `SubModeColor` from `color` /
`colorTemInKelvin`.

`CmdPt.getDiyPtotocol` / `getDiyStudio` / `getNewScenesCmdPt` build `pt` with
`op="mode"` and base64 multi-packet DIY/scene; `CmdPtReal` builds `ptReal`
`command[]`.

### 6.3 dreamcolorlightv1 `iot/Cmd.java`

`state, op, online, turn, brightness, status, gradual, pt, bulb, colorwc, ptReal`.

| cmd | data |
|---|---|
| `turn` | `val` 0/1 |
| `brightness` | `val` (cmdVersion 1) |
| `gradual` | gradient on/off command |
| `colorwc` | `color{r,g,b}`, `colorTemInKelvin` |
| `bulb` | `value[]` base64 frames (per-bulb / per-segment color + gradual) |
| `pt` | `op` ∈ {`mode`,`gradual`,`sleep`,`wakeup`,`timer`}, `value[]` |
| `ptReal` | `command[]`, `opVersion` |
| `status` | `state{brightness,mode,onOff,wifiHardVersion,wifiSoftVersion}` + `op` payloads |

`CmdStatusV0` parses `state` plus `op` lists:
`modeValue`, `timerValue`, `sleepValue`, `wakeupValue`, segment color sets.
`CmdStatusV1` adds segment/IC parsing (`parseIc`), 4 timers, wake/sleep, brightness.

### 6.4 dreamcolorlightv2

`online, turn, brightness, status, colorwc, ptReal` (`state`/`op` read keys).
No `pt`/`bulb`; scenes/DIY/music go through `ptReal`.

### 6.5 rgbiclight shared engine

`IotSwitchCmdBuilder` / `IotBrightnessCmdBuilder` / `IotColorCmdBuilder` /
`IotColorTemCmdBuilder` use base `CmdTurn`, `CmdBrightness`, `CmdColorWc`,
`CmdStatus` and `IotMsgProType.V2`. `makeCmdStr` wraps the `Cmd` in the Write
envelope. Scene/DIY/music are sent as `ptReal` (base64 BLE frames).

---

## 7. Other protocols

**Matter** — `rgbiclight/MatterRegister.java`. Registered interceptors and gates:

| GoodsType | SKU(s) | Version gate |
|---|---|---|
| 193 | H70A1/H70A2/H70A3 | soft ≥1.00.11 / wifi 3.05.00 / 1.01.17 / 1.04.01; H70A3 needs soft ≥1.00.18 |
| 204 | (204 group) | soft ≥1.00.08 & wifi ≥3.04.01, or wifi ≥3.08.01 |
| 71 | H619D | soft ≥3.04.39, wifi 3.01.10, ≥1.03.01 / 1.04.01 |
| 19 | H61A8 | soft ≥3.08.01 |

Matter uses the standard lighting clusters; no custom cluster IDs are defined in this
split (pairing/attributes handled by base `MatterInterceptor`).

**No MQTT/UDP/LAN protocol** is implemented in this split; cloud transport is the
shared `Iot` MQTT path. `h667172` cut-calibration uses goodsType 332 and 44/56 IC
layouts (H6671=44, H6672=56).

**OTA** — `OtaType` gates: h6119/H6102/H6184 require Telink OTA for new UI
(`rgbiclight/Protocols.java`, `SupportH6119`, `Support4H6184`).

---

## 8. Dynamic effects — explicit payload layouts

All dynamic effects ride `0x33/0x05` (`mode`) as one `subMode` block, except
multi-packet scene/DIY/music blobs (`0xA3`/`0xA5`) followed by a final `0x05` mode
packet that selects the effect.

### 8.1 Color (static / color-temp) — `sub 0x02`

`02 R G B tempFlag R2 G2 B2` (8 bytes)

- `tempFlag=0`: `R G B` is the color, `R2G2B2` background (0,0,0 if unused).
- `tempFlag=1`: color is a temperature; `R2G2B2` is the temperature RGB.
`parse`: `[0..2]` color, `[3]` flag, `[4..6]` temp/background color.
Source: `h6102|h6105|h6119|h6129|h6127|h6185|h6160/ble/SubModeColor.java`.

### 8.2 Color V1 (15-segment strip) — `sub 0x0B`

`0B R G B maskLo maskHi` (8 bytes)

- 15 segment bits: `maskLo` bits 0..7 → segments 1..8, `maskHi` bits 0..6 → 9..15.
- Per-group write: each unique RGB is sent as one packet with its segment mask set,
  then the last packet (or a separate packet) carries per-segment brightness.
Source: `h612526/ble/SubModeColor.java`, `h6160/adjust/v1/SubModeColorV1.java`,
`h6160/ble/SubModeColor.java#h()`.

### 8.3 Color V2 (multi-segment with brightness) — `sub 0x15`

`SubModeColorV2.getWriteBytes()` has three shapes:

1. **Per-group color (type 1)**, 12 bytes:
   `15 01 R G B KLo KHi R2 G2 B2 00 mask`
   - `KLoKHi` = signed 16-bit Kelvin (little-endian, `getSignedBytesFor2(kelvin, true)`).
   - `R2G2B2` = background/temperature color.
   - `mask` = segment bitmask (6 bits h6119/h7090 color, 7 bits chassis, 8 bits h7090 V2).
2. **Brightness-only (type 2)**, 5 bytes: `15 02 brightness 00 mask`
   (`brightness` is the per-segment level, mask selects segments).
3. **Per-segment RGB array (type 3)**, 17 bytes: `15 03 R1 G1 B1 R2 G2 B2 ...`
   (up to 15 segment triples, rest zero).

Grouping helper `makeSubModeColor(Colors)` builds one controller per distinct RGB plus
an optional brightness packet, then `Mode4ColorStrip` sends them in order; the final
packet is flagged `a=true` (multi-controller batch terminator).
Segment counts: h6119 = 6, h612526 = 15, chassis H6184 = 7 / H7092 = 8, h7090 = 6/8,
h6160 v1 = 15.
Source: `h6119/ble/SubModeColorV2.java`, `chassislightv1/ble/SubModeColorV2.java`,
`chassislightv1/adjust/h7092/color/SubModeColorH7092.java`,
`h7090/ble/SubModeColorV2.java`, `h6160/adjust/v1/SubModeColorV1.java`.

### 8.4 Music — `sub 0x01 / 0x03 / 0x0C / 0x0E / 0x13`

Legacy forms (h6102/h6105/h6129/h6127):

- `03 01 sensitivity` (auto/color mode) or
- `03 01 sensitivity R G B` (manual color)
  where `autoFlag` is encoded as `1`=auto (`a()` returns `1` when `c==false`).
- h6102 `sub 0x01`: `01 mode sensitivity [R G B]`, mode ∈ {0 energic, 1 spectrum,
  2 rolling, 3 rhythm}; color included only for modes 1/2.
- h6127 `sub 0x03` same layout (no-IC music path).
- h6105/h6129 `sub 0x03`: `03 autoFlag sensitivity [R G B]`.

h6119/h612526 `sub 0x0C`:

- `0C style sensitivity` for `style==0` (energetic)
- `0C 01 sensitivity sub` for `style==1` (rhythm; sub 0=Dynamic,1=Mild)
- `0C 02 sensitivity autoFlag [R G B]` for scroll/rolling
- h612526 styles: 0 energy, 2 rolling, 3 spectrum, 4 rhythm; for 2/3/4 add
  `autoFlag [R G B]`.

h6160 `sub 0x01` (music V1): `01 style sensitivity [R G B]`; style 1/2 include RGB.
h6160 `sub 0x0E` (music V1 RGB):
`0E style sensitivity autoFlag [R G B]` (4 or 7 bytes), autoFlag `1`=auto.
h7090/barelight/chassis `sub 0x13` (new music):
`13 style sensitivity dyn autoFlag [R G B]` (8 bytes), with `dyn` for rhythm;
`13 style sensitivity` only for energy.
New music codes (RGB list): `{50,51,52,53,54,55}`; RGBIC list `{50..55}`;
`newMusicCode4RgbicList` per `AbsNewMusicEffect`.
Multi-packet high-fidelity music: `MultipleController4Music` → proType `0xA3`,
cmdType `0x41`, `p()` = sensitivity, `g()` = effect blob.
Source: `h6102/ble/SubModeMusic.java`, `h6105`, `h6127/ble/SubModeMusic(V1).java`,
`h6119/ble/SubModeMusic.java`, `h612526/ble/SubModeMusic.java`,
`h6160/ble/SubModeMusic(V1|V1Rgb).java`, `barelightv1/ble/SubModeMusic(V2).java`,
`chassislightv1/ble/SubModeMic(V2).java`, `h7090/ble/SubModeMusic.java`.

### 8.5 Mic (H6185, H6184/H7092) — `sub 0x05 / 0x13`

- `05 01` = select mic/music mode (h6185, chassis `SubModeMic`).
- `13 10` = mic V2 select (chassis `SubModeMicV2`).
- Mic level/rhythm points are pushed by the audio engine through the same sub-mode
  (op 1 = set mode, op 3 = send rhythm point).
Source: `h6185/ble/SubModeMic.java`, `chassislightv1/ble/SubModeMic(V2).java`.

### 8.6 Scenes — `sub 0x04`

- h6102/h6105/h6127/h6129/h6185/h6119/h612526: `04 <effectId>` (1 byte).
  h6160: `04 <effectLo> <effectHi>` (16-bit LE, `getSignedBytesFor2`).
- Scene effect IDs (from `ScenesHint`/`RgbIcScenesV1..V3`):
  gm 0, sunset 1, film/movie 4, date/dating 5, romantic 7, blinking 8,
  candle (`cl`) 9, breath 10, snow 15, dynamic 16, chase 21, stream 22.
  Extended RGBIC scene IDs: forest 212, green-shade 218, universe 200, meteor 205,
  meteor-shower 228, aurora 215, lightning 214, star-sky 217, star-flash 213,
  spring 210, summer 223, fall 202, winter 201, fire 216, ripple 204, waves 227,
  deep-sea 203, new-year 222, christmas 221, halloween 110, valentine 211,
  birthday 209, fireworks 208, ghost 220, party 226, prom 225, disco 206,
  carnival 230, mother-day 231, father-day 232, sweet 107, sport 224, alarm 219,
  game 229, night 233, sleep 234, morning 235, afternoon 236, study 237,
  business 238, reading 239, work 249, dream 207, energetic 16, excited 240,
  happy 241, enthusiasm 242, profound 243, mysterious 244, quite 245, miss 246,
  warm 247, accumulation 248.
- New multi-packet scenes: base64 effect blob from `ScenesRgbIC`/`ScenesGraffiti`/
  `ScenesCube`/`ScenesCompose`/`ScenesH610B` keyed by effect code, sent with
  `MultiNewScenesControllerV1..V10` (proType `0xA3`, cmdType = scene protocol
  version 1..10; e.g. V1=0x01, V2=0x02, V5=0x0A), then `04 <effect>` selects it.
  Effect blob includes direction (byte 9 or user-set), x/y, speed, music code and
  focus params for cube/compose effects (`ScenesOp.g()`).
- `Support.is2NewScenesMode()` / `getSupportScenesOpSet()` decide between static
  `04 <id>` and multi-packet blob per goodsType/version.
Source: `h6102/ble/Mode.java`, `h6160/ble/SubModeScenes.java`,
`barelightv1/ble/Mode.java`, `base2light/ble/ScenesOp.java`,
`base2light/ble/ScenesRgbIC.java`, `base2light/ble/scenes/RgbIcScenesV1..V3.java`.

### 8.7 DIY — `sub 0x0A` (new) and `sub 0x07` (old)

- New DIY: `0A <diyCodeLo> <diyCodeHi>` (16-bit LE). Selects a DIY effect that was
  previously uploaded.
- Old DIY (h6127/h6129): `07` + 16-byte DIY protocol:
  `[0]=code [1]=? [2]=? [3]=? [4..]` RGB triples (max 4 colors / 10 bytes).
- DIY upload (`MultipleDiyController`, proType `0xA5`, cmdType `0x02`):
  `[0]=diyCode [1]=style/params [2]=? [3]=? [4]=rgbByteLen [5..]=RGB triples
   [..]=brightnessLen [..]=brightness bytes`.
- Graffiti DIY: `MultiDiyGraffitiController` (proType `0xA5`, cmd 0x03) and
  `MultiDiyGraffitiControllerV3` (cmd 0x57).
- DIY codes are carried in `DiySupportV1`/`DiyM`; mix/diy base code is 255
  (`DiyM.EffectCode.g = {255, b2light_diy_mix}`), studio/area codes in the
  808..813 range (`DiyM.EffectCode.a = 808 … f = 813`), with per-effect sub-code
  sets from `DiyM.EffectSubCode`.
Source: `h6127/ble/SubModeOldDiy.java`, `h6129/ble/SubModeOldDiy.java`,
`*_/ble/SubModeNewDiy.java`, `base2light/ble/controller/MultipleDiyController*.java`,
`base2light/ac/diy/DiyM.java`.

### 8.8 Gradient / gradual — `0x14`, `0x0E`, `0xA3`

- h6102/h6105 `LimitController` (0x0E) is a current limit, not gradient.
- h6119/h612526 `GradualController` (0x14): `[0]=0/1` gradient on/off.
- h6160/h7090/barelight/chassis `Gradual4BleWifiController` (0xA3):
  `[0]=0/1` gradient on/off; some variants carry per-segment brightness.
  `Gradual4BleWifiControllerV1` same opcode with a V1 event.
Source: `h6119/ble/Gradual4BleController.java`,
`h612526/ble/GradualController.java`, `h6160/ble/v1/Gradual4BleWifiController*.java`,
`h7090/ble/Gradual4BleController.java`, `chassislightv1/ble/Gradual4BleWifiController`.

### 8.9 Motion / direction / carousel / compose (RGBIC)

- Effect direction is carried in the scene blob and by the multi-scene controller
  `AbsMultipleControllerV14Scenes.direction/x6/y6/speed` fields
  (`MultiNewScenesControllerV4/V5...`).
- `CheckDirectionFinishController` (`0x39`) returns whether direction setup finished.
- Compose/carousel effects: `MultiNewScenesControllerV5` (cmd 0x0A) with compose
  blob + `SubModeScenes`; cube effects V4 (x/y/speed/direction).
- Left/right strip switch (car light): `h7090/SwitchLRController` cmd `0x33`,
  `[0]` = state ∈ {0 off, 1 left, 16 right, 17 both}; `ComposeHeartController`
  (cmd 0x33 read) parses `[0]` compose state and `[1]==1` festive flag.
- Light position: `h7090/LightPosController` cmd `0x31`, `[0]` 0/1.
- Segment/IC calibration: `0x40` segment count, `0x41` device info/splicing,
  `0x42/0x43` IC check, `0x46` reset (base constants; used by `VM4Light.changeIcNum`
  and cut calibration in `h667172`).

### 8.10 Sleep / wake / timer

- Sleep `0x11`, wake `0x12`, payload `[0..3]` (hour/min/brightness/color index),
  parsed back with the same offsets (`SleepControllerV2`, `WakeUpControllerV2`).
- Timer packets use base `ControllerNewTimer`; IoT uses `timer` JSON with
  `time[{enable,openHour,openMin,closeHour,closeMin,repeat}]`.

---

## 9. Source map (paths traced)

All paths relative to `decompiled/jadx-splits/split_pact_rgbiclight/sources/` unless
stated otherwise. Base paths are relative to `decompiled/jadx-base-7.7.10/sources/`.

```
h6102/ble/{BleComm,BleProtocol,Mode,ModeController,SubModeColor,SubModeMusic,SubModeNewDiy,SubModeScenes,LimitController,MultipleBleComm}.java
h6102/scenes/{Common,BleColorCmdBuilder,BleSwitchCmdBuilder,BleBrightnessBuilder,BleColorTempBuilder,BleHeartBuilder}.java
h6102/sku/{Sku,SubLib,Support,AbsEffectOp4Ble}.java
h6105/ble/*  (same layout, music sub 0x03)
h6119/ble/{BleProtocol,Mode,Mode4ColorStrip,SubModeColor,SubModeColorV2,SubModeMusic,SubModeScenes,SubModeNewDiy,Gradual4BleController,MultipleDiyController,BulbStringColorController,BulbGroupColor}.java
h6119/scenes/Common.java
h612526/ble/{BleProtocol,Mode,Mode4ColorStrip,SubModeColor,SubModeMusic,SubModeScenes,GradualController}.java
h6127/ble/{BleProtocol,Mode,SubModeMusic,SubModeMusicV1,SubModeOldDiy,SubModeNewDiy}.java
h6129/ble/{BleProtocol,Mode,SubModeMusic,SubModeOldDiy,SubModeNewDiy}.java
h6185/ble/{BleProtocol,Mode,SubModeMic}.java
barelightv1/ble/{BleProtocol,Mode,Mode4ColorStrip,SubModeMusic,SubModeMusicV2,ParamsSubMode4Music}.java
barelightv1/pact/{Support,SubLib,Comm}.java
chassislightv1/ble/{BleProtocol,Mode,Mode4ColorStripV2,SubModeColorV2,SubModeMic,SubModeMicV2}.java
chassislightv1/adjust/h7092/color/SubModeColorH7092.java
chassislightv1/pact/{Support,SubLib,BleSkuItem,BleSkuItemH7092}.java
h7090/ble/{BleProtocol,Mode,BleComm,SwitchLRController,LightPosController,ComposeHeartController,SubModeMusic,SubModeColor,SubModeColorV2}.java
h7090/pact/{Support,SubLib,SubMaker,Comm}.java
rgbiclight/h6160/ble/{BleProtocol,Mode,ModeController,SubModeColor,SubModeColor4Bk,SubModeMusic,SubModeMusicV1,SubModeMusicV1Rgb,SubModeScenes,SubModeNewDiy}.java
rgbiclight/h6160/ble/v1/{BulbStringColorController,BulbGroupColor,Gradual4BleWifiController,Gradual4BleWifiControllerV1,Mode4ColorStrip}.java
rgbiclight/h6160/iot/{Cmd,CmdTurn,CmdBrightness,CmdColor,CmdColorTem,CmdColorWc,CmdPt,CmdPtReal,CmdStatusV0,CmdTimer,CmdOnline?}.java
rgbiclight/h6160/scenes/{Common,AbsIotCmdBuilder,Iot*CmdBuilder,Ble*CmdBuilder}.java
rgbiclight/h6160/sku/{Sku,SubLib}.java
rgbiclight/ble/{BleComm,BleMultiComm,BleNotifyComm}.java
rgbiclight/pact/{AbsEffectOp4BleIot,EffectOp4BleIot,OpCommDialog4BleIot*,OpDiyCommDialog4BleIot*,OpSceneCommDialog4BleIot*}.java
rgbiclight/scenes/{IotSwitchCmdBuilder}.java
rgbiclight/{Support,SupportV2,Support4H6105,Support4H6129,Support4H6127,Support4DreamColorLightV2,Support4H6184,SupportH6119,SupportH6185,MatterRegister,Protocols,ControllerStrategyConfig}.java
rgbiclight/mode/scene/config/ScenesSupport.java
rgbiclight/h667172/*  (UI/cut calibration; no private opcodes)
rgbiclight/h61050729/BleProtocol.java
dreamcolorlightv1/iot/{Cmd,CmdBrightness,CmdBulb,CmdColorWc,CmdPt,CmdPtReal,CmdStatusV0,CmdStatusV1,CmdTurn}.java
dreamcolorlightv1/pact/{Support,SubLib,SubLib4BleIot,SubMaker,bleiot/*}.java
dreamcolorlightv2/iot/{Cmd}.java
dreamcolorlightv2/pact/Support.java
base: com/govee/base2kt/utils/BleUtils.java
base: com/govee/base2light/ble/controller/{AbsSingleController,AbsController,AbsModeController,AbsMode,BrightnessController,SwitchController,HeartController,AbsMultipleController,AbsMultipleControllerV1,AbsMultipleControllerV2,AbsMultipleControllerV14Scenes,MultipleDiyController,MultipleDiyControllerV1,MultiDiyGraffitiController,MultiDiyGraffitiControllerV3,MultipleColorStripControllerV1,MultipleController4Music,SleepController,SleepControllerV2,WakeUpController,WakeUpControllerV2,CheckDirectionFinishController}.java
base: com/govee/base2light/ble/comm/{AbsBleComm,AbsMultipleBleComm,MultipleControllerComm,MultipleControllerCommV1}.java
base: com/govee/base2light/ble/{ScenesOp,ScenesRgbIC}.java
base: com/govee/base2light/ble/scenes/{RgbIcScenesV1,RgbIcScenesV2,RgbIcScenesV3}.java
base: com/govee/base2light/light/ModeStr.java
base: com/govee/base2light/ac/diy/{DiyM}.java, ac/diy/v1/EffectCodes.java
base: com/govee/base2light/ble/music/AbsNewMusicEffect.java
base: com/govee/base2home/iot/{Write,AbsCmdWrite}.java
base: com/govee/base2light/iot/{CmdTurn,CmdStatus,Color}.java
base: com/govee/base2light/util/NumUtil.java
```

---

## 10. Gaps / unknowns

1. **Exact per-SKU goodsType mapping is data-driven.** The app determines goodsType
   from the product database, not from a constant in these sources. The goodsType
   sets above are exhaustive for what the module registers, but which physical SKU
   maps to which goodsType (e.g. H619D→71, H70A1→193, H61A8→19) comes from the
   version-gate code; a few remain ambiguous.
2. **DiyM effect-code constants are obfuscated.** `DiyM.EffectCode.*` and
   `EffectSubCode.*` are large static arrays with obfuscated field names; only the
   mix code 255 and studio range 808..813 are clearly resolvable. Individual
   DIY sub-effect numeric IDs need a runtime dump.
3. **Scene effect blobs are base64 assets** (`ScenesRgbIC`, `ScenesGraffiti`,
   `ScenesCube`, `ScenesCompose`, `ScenesH610B`). The *selection* code (`04 <id>`) and
   scene IDs are exact; the blob byte layouts are shipped per-effect and are not
   fully enumerated here. Direction/speed/x/y are at fixed offsets (direction often
   byte 9 or byte 5/6) but vary per scene family.
4. **Multi-packet framing has many variants** (`makeSendBytesV0/V1/V2/V3/V4`,
   MTU `0xA6`, `makeSendBytesMtu*`). The shared 20-byte chunking (start/data/end) is
   documented; the MTU-based variants only apply to OTA/graffiti and are not fully
   transcribed.
5. **Music** has legacy, V1, V2 and "new music" code spaces; the code→effect-name
   table lives in `AbsNewMusicEffect` subclasses and resource strings. Documented code
   sets are the RGBIC/RGB lists (50..55, 48..49).
6. **Matter** clusters/attributes are handled by the base `MatterInterceptor`; this
   split only registers interceptors/version gates, so no cluster IDs are available
   here.
7. **h667172** is UI/cut-calibration only; it defines no private GATT opcodes. Its
   effect traffic goes through `rgbiclight` SupportV2 (goodsType 332) and `ptReal`.
8. **`h61050729`** is a dated H6105 revision that only declares sub-mode IDs
   (0x15/0x04/0x0A/0x03); payload builders are the shared dream-color ones.
9. Some event/listener classes (`Event*`) were not individually enumerated; they are
   response plumbing, not new opcodes.
10. `EffectCodes`/`DiySupportV1` support matrices are per-SKU capability data
    (max colors/speed), not wire format; values are in the base `DiyM` tables.
