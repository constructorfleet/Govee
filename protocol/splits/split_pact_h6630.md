# split_pact_h6630 — gaming pixel light / sound-light bars (H6630, H8630, H6631)

Source root: `decompiled/jadx-splits/split_pact_h6630/sources/`

---

## 1. Overview / family and SKUs

H6630/H8630/H6631 are **“Gaming Pixel Light”** bars: RGB pixel display + speaker
(tone/white-noise/online music) + mic/music effects + DIY pixel effects (including
custom watch-faces and GIFs). The module also drives **Matter** commissioning.

| SKU | goodsType | variants | transport | notes |
|---|---|---|---|---|
| H6630 | 285 | `H6630Maker` | ble+iot+matter | main device; 285 supports protocols (1,1),(1,2),(2,1),(2,2),(2,3) |
| H8630 | 285 | same maker (`H6630Support.c = "H8630"`) | ble+iot+matter | co-brand / regional variant of 285 |
| H6631 | 286 | `H6631Maker` | ble+iot+matter | 286 adds protocol (2,4) |

Registry: `pact/H6630Support.java` (`b=H6630`, `c=H8630`, `d=H6631`,
`i={285,286}`, `j={"285","286"}`), `pact/SubMaker.java` (H6630Maker + H6631Maker),
`pact/SubLib.java`, `pact/RegisterItem.java`.
`pact/Model extends AbsDeviceModel4BleIot`; `pact/DeviceItem extends AbsBleIotItem`.
`h6630/add/AddDeviceM` registers both goods types with `MatterInterceptor`, and
`detail/H6630SettingActivity` uses `MatterManager`/`MtGuide`.

The “H6078 effect hooks” mentioned in the assignment are **not present**: a
repository-wide search of this split finds no `H6078` symbol. The effect hooks here
are H6630/H6631-specific (`H663xEffectCodeManager`).

---

## 2. Transports & GATT UUIDs

| item | value |
|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` (`BleCommUUID.b()`) |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` (`BleCommUUID.a()`) |
| frame | 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` |
| write | `0x33` |
| read | `0xAA` |
| multi-write | `0xA3` (V1 packetizer; `MultiController`) |
| notify | `0xEE` |

`ble/BleComm.java` extends `AbsBleComm` and uses `BleCommUUID`; `BleNotifyComm`
registers `WifiNotifyParse`, `BrightnessNotifyParse`,
`DeviceSwitchStatusNotifyParse`, `DeviceStatusNotifyParse`,
`MusicNotifyParse(H6630Support.b)`, `MovieFeastOnOffNotifyParse`.

Cloud: all commands are built as `Compose4DefWrite`/`Compose4DefWrite4Multi` and can
run locally or be tunneled as `ptReal` (or `ptIot` for OTA) — `Route.PreferBle(true)`.
Large effects (GIF/custom watch-face) use `CmdPtUrl` (`ptUrl`), i.e. the cloud hosts
the command blob.

Matter: commissioning through `com.govee.matter.MatterManager` / `MtGuide`
(`h6630/add/AddDeviceM`, `detail/H6630SettingActivity`). No Matter cluster mapping is
in this split; runtime control still uses the BLE/IoT frames below.

---

## 3. BLE frame + command table

`ble/BleProtocol.java` constants:
`b=19 (music submode)`, `q=13`, `r=19`, `s=4 (scenes)`, `t=10 (new DIY)`,
`u=4`, `v=127 (display/shortcut)`, `w=126 (custom GIF?)`, `x=32 (brightness notify)`,
`y=37 (auto upgrade)`, `z=125 (24 h)`, `A=126 (temp unit)`, `B=1`, `C=5`, `D=6`, `E=7`.

| command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `on` | `[0]=0/1` | generic `ControllerSwitch` |
| brightness | `0x33/0x04` | `level` | 0–100 | generic `ControllerBrightness` |
| mode | `0x33/0x05` | see §7 | sub 0x13 music, 0x04 scenes, 0x0A new DIY | `ble/Mode.java`; `ble/SubMode*` |
| read mode | `0xAA/0x05` | `[1]` | `AbsModeController.p()` | `ble/ModeController` |
| mute / light switch sub | `0x33/0x30` | `30 type val` | type 1 = light, 5 = disturbance/DND, 6 = tone | `H6630ViewModel.G5` |
| indicator light schedule | `0x33/0x30` | `30 07 en !forever startH startM endH endM` | `[1]=7` | `detail/controller/IndicatorLightController` |
| tone settings | `0x33/0x30` | `30 06 en powerTone screenOffTone keyTone countdownTone` | `[1]=6` | `detail/controller/ToneController` |
| read switch/indicator | `0xAA/0x30` | `[1]` | response `[1]=?` + state | `DeviceSwitchStatusNotifyParse` |
| device status | `0xAA/0x40` | – | 10 bytes (see §4) | base `DeviceStatusNotifyParse` |
| device info / switch config | `0xAA/0x41` | – | see §4.2 | `Info4Detail.d0` |
| auto-upgrade info | `0xAA/0x25` | `04` | sub 4 | `AutoUpgradesController.b` |
| auto-upgrade query | `0xAA/0x25` | `02` | sub 2 | `AutoUpgradesController.d` |
| auto-upgrade enable | `0x33/0x25` | `03 on` | sub 3 | `AutoUpgradesController.c` |
| volume | `0x33/0x79` (121) | `val` | 0–? (UI slider) | `H6630ViewModel.K5`; `Info4Detail.h0` |
| 24-hour display | `0x33/0x7D` (125) | `en` | 1 = 24 h | `H6630ViewModel.J6` |
| temperature unit | `0x33/0x7E` (126) | `en` | byte is `!z` for the caller’s boolean; unit convention inferred (0/1) | `H6630ViewModel.Z6` |
| shortcut | `0x33/0x7C` (124) | `DisplayEffectManager` bytes | effect-type + effect code | `ShortcutSetController` |
| DIY effect write | `0xA3/0x58` (88) | `[subEffect, secondSubEffect, params…]` | MultiController V1 | `H6630DiyParser.makeBleController` |
| DIY mode select | `0x33/0x05` | `0A codeLE16 speedLE16` | sub 0x0A | `SubModeNewDiy` |
| tone play state | `0x33/0x75` (117) | `01 songIdLE32 02` | online sound player | `SetPlayerStateController` |
| custom GIF result | `0xEE/0x7A`? | `[2]` reload | `Info4Detail.W` | `parseCreateGifResult` |
| alarm clock notify | `0xEE/0x85` | see §4.3 | `Info4Detail.U` | `parseDisplayAlarmClock` |

`0x30` sub-functions are the device’s “common switch” block: sub 1 light, sub 5
disturbance (DND), sub 6 tone, sub 7 indicator-light schedule.

Multi-write packetization: proType `0xA3`, start `[0, pageCount, 0]`, data chunks
`[pageIndex, 17 bytes]`, terminator `[0xFF]` (`MultipleControllerCommV1`).

---

## 4. BLE notifications / readings

### 4.1 Brightness / switch

| notify | layout | source |
|---|---|---|
| `0x20` | `[0]` brightness 0–100 | `ble/BrightnessNotifyParse` |
| `0x30` | `[1]` sub-index, `[2]` state; `EventSwitchSub` gets `(index, state, raw)` | `ble/DeviceSwitchStatusNotifyParse` |
| `0x11` | `[0]==0` → WiFi connected | `ble/WifiNotifyParse` |
| `0x70` | online music state; `OnlineMusicPares.parse(sku, bArr)` | base `onlinesound/cmd/MusicNotifyParse` |
| `0x60` | `[0]=1`, `[1]=on` → movie-feast on/off | base `MovieFeastOnOffNotifyParse` |

### 4.2 Device info / switch config (`0x41`, 17 payload bytes)

`Info4Detail.d0`:
```
[0]      switch bits byte 0:
         bit7 totalSwitch, bit6 lightSwitch, bit5 indicatorLightSwitch
[1]      switch bits byte 1 (inverted in parser):
         bit7 whiteNoiseSwitch, bit6 disturbanceSwitch, bit5 toneSwitch
[2]      C  (1/0)
[3]      D  (1/0)
[4]      E  (0 -> true)
[5]      indicator forever (0 -> true)
[6]      indicator startHour
[7]      indicator startMin
[8]      indicator endHour
[9]      indicator endMin
```
`DeviceSwitchInfo.Companion.a` reads bits 8/7/6 of bytes 0 and 1 (MSB-first helper).

### 4.3 Device status (`0x40`)

Base `DeviceStatusNotifyParse` forwards 10 bytes as `EventDeviceStatus`. The split’s
`Info4Detail` consumes the same payload for alarm-clock/display state:
```
[0..2]  alarm/display fields (BleUtils.L each)
[3]     alarm enable
[4]     alarm repeat?
[5]     alarm hour
[6]     alarm minute / 0 flag
```
The exact bit semantics of the 10-byte block are only partially exposed; see the
`DisplayAlarmClockBean` constructor in `Info4Detail.U`.

### 4.4 Tone settings (`0x30/06`)

`Info4Detail.g0(valid17)`:
`toneSwitch = byte[1]`, `powerOnTone = byte[2]`, `screenOffOnTone = byte[3]`,
`keyChangeTone = byte[4]`, `countdownTone = byte[5]` (each 0/1 or tone id).
Writes use `ToneController` with the same order.

### 4.5 Volume

`Info4Detail.h0`: `0xAA/0x79` → `valid[0]` = volume.

---

## 5. IoT commands + status/readings schema

`h6630/iot/Cmd.java`: `state`, `op`, `online`, `turn`, `brightness`, `status`,
`colorwc`, `ptReal`, `pt`.
`getCmdReadParseKey`: `ptReal` → `op`, else `state`.

| cmd | data | meaning |
|---|---|---|
| `turn` | `{"val":0|1}` | power |
| `brightness` | `{"val":0-100}` | brightness |
| `colorwc` | `{"red","green","blue"}` | RGB color |
| `state` | `{onOff,brightness}` | read-back |
| `op` | `{"command":["<base64 20-byte frame>"]}` | device frames (0x19/0x27/…, same as BLE) |
| `ptReal` | `{"command":["<base64>"]}` | tunnel any BLE frame |
| `pt` | raw device command | legacy passthrough |
| `status` | `{}` | snapshot request |
| `online` | `{}` | presence |

`Info4Detail.Y` parses `state.onOff`/`state.brightness` and then decodes every
`op.command[]` 20-byte frame through the same BLE parsers (`k0/j0/h0/d0/b0/f0/i0/e0`).
So the BLE tables above apply verbatim to cloud devices.

Status schema:
```json
{
  "state": {"onOff": 1, "brightness": 80},
  "op": {"command": ["<base64>"]},
  "online": true
}
```
Additional cloud state (cloud music/playlist, custom effects, Matter) is handled
outside this split.

---

## 6. Other protocols

- **Matter**: `MatterInterceptor` in `add/AddDeviceM` for goods types 285/286;
  `MatterManager`/`MtGuide` in `H6630SettingActivity` for pairing and info.
  No cluster/attribute mapping in this split.
- **ptUrl**: GIF / custom watch-face / large DIY effects are uploaded to cloud and
  executed via `CmdPtUrl` (`H6630ViewModel.notifyDeviceCreateGif`, `H6630GifParse`,
  `EditCustomMusicEffectDialog`). `GetIotCmdPtUrlLinkInfo` builds `ptUrl` v4 data.
- **Custom music effects REST** (`CustomMusicEffectService`):
  `GET/PUT/DELETE /bff-app/v1/music-mode/animation/custom` (list/save/delete).
- **Online music**: base `onlinesound` stack (`OnlineMusicM`, `OnlineMusicPares`,
  `MusicNotifyParse` cmd `0x70`, player-state cmd `0x75`, white-noise control).
- **OTA**: `ReportOtaPactController` via `ptIot` (`H6630ViewModel.G6`) and the
  `AutoUpgradesController` (0x25) feature.

---

## 7. Dynamic effects / music / scenes / DIY

### 7.1 Scene (`0x05/0x04`)

`SubModeScenes.getWriteBytes`:
```
04 effectLo effectHi musicCode0 musicCode1 musicCode2 musicCode3 speed
```
- `effect` 16-bit **little-endian** (LE16); default 2002.
- `musicCode` 32-bit LE (only if a music code is attached; else 0).
- `speed` byte (0–?).
Read parse: `effect = signedShort(valid[1],valid[0])` (LE16), `musicCode =
getSignedInt(valid[2..5], false)` (LE32), `speed = valid[6]`.

### 7.2 Music (`0x05/0x13`)

`SubModeMusic.getWriteBytes` = `13 musicCode sensitivity`; default code 101,
sensitivity 0–99.

### 7.3 New DIY (`0x05/0x0A`)

`SubModeNewDiy.getWriteBytes` = `0A codeLE16 speedLE16`.
Effect code range: advanced DIY codes 751/752/753/799/800/853/854/855/856/862/863
(`H663xEffectCodeManager`).

### 7.4 DIY effect payload (`0xA3/0x58`)

`Pro4H6630Diy.bytes`:
```
[subEffect][secondSubEffect][effect-specific params…]
```
Sub-effect IDs (from `H6630DiyParser` / `Pro4H6630Diy`):
1 云染/YunRan (cloud dye) — second 1 彩墙/color wall, 2 覆盖/cover
2 旋转/XuanZhuan — 1 拨板糖, 2 大风车
3 波动/BoDong — 1 波风, 2 双螺旋
4 流动/LiuDong — 1 伸缩, 2 叠加
5..9 大风车 speed variants
10..12 流动/叠加 variants
13 随机/Random — 跳跳球
14 随机 — 贪吃蛇
15 随机 — 笑笑乐
16 随机 — 烟花
17..18 双螺旋 variants
19 线性/XianXing — 像素
20..23 线性 — 喷射 (10/66), (12/20), (12/50), (15/50)
24..25 线性 — 填充 (f=15/14)
26..30 additional linear/penetration variants
```
Params are per-effect (colors, speed 1–100, direction enum, density, etc.) encoded by
each `*4*` class; the exact byte order is class-specific. The packet is wrapped by
`MultiController(bytes, 0x58)`; then a mode `0x0A` frame with DIY code `0x00FE` is
appended (`makeBleController`).

### 7.5 Custom watch-faces / GIF

- `H6630GifParse` builds a `ptUrl` command (cloud-hosted GIF blob) or a local BLE
  multi-frame with `CustomizeWatchFace2GifParse`.
- Effect codes: custom watch face 1/2 = 853/854 (H6630) or 855/856 (H6631).
- Cell graffiti: 752/753, 799/800, 862/863 depending on goods type/version.

### 7.6 Display/shortcut (`0x7C`, mode `0x81`)

`ShortcutPlate.d()` → `DisplayEffectManager` bytes (server effect type + effect id)
are written with cmd `0x7C`. `SubMode4Display` parses mode sub-byte **0x81 (signed -127)**
(`Info4Detail.a0`); the sibling mode **0x82 (signed -126)** is the custom watch-face
mode. `0x7D`/`0x7E` are separate command opcodes for 24-hour display and temperature unit.

### 7.7 Tone / alarm clock

Tone settings `0x30/06`; display alarm clock notify `0xEE/0x85`
(`Info4Detail.U` → `DisplayAlarmClockBean`).

---

## 8. Source map

| area | paths |
|---|---|
| registry | `pact/{H6630Support,H6630Maker,H6631Maker,SubLib,SubMaker,RegisterItem,Model,DeviceItem}.java`, `H6630Constant.java` |
| BLE comm | `ble/{Ble,BleComm,BleNotifyComm,BleProtocol,Mode,ModeController}.java`, `BleMultiComm` |
| BLE sub-modes | `ble/{SubModeMusic,SubModeScenes,SubModeNewDiy,DiyLocal}.java` |
| BLE parsers | `ble/{BrightnessNotifyParse,DeviceSwitchStatusNotifyParse,WifiNotifyParse}.java` + base `DeviceStatusNotifyParse`, `MusicNotifyParse`, `MovieFeastOnOffNotifyParse` |
| controllers | `detail/controller/{AutoUpgrades,IndicatorLight,Tone,TonePlay,ShortcutSet}Controller.java` |
| detail/VM | `detail/H6630ViewModel.java`, `detail/Info4Detail.java`, `detail/header/*`, `detail/delegate/*` |
| DIY | `detail/diy/**` (`H663xDiyParser`, `Pro4H6630Diy`, effect classes, GIF, watch-face) |
| net | `detail/delegate/CustomMusicEffectService.java`, base `onlinesound` |
| Matter | `add/AddDeviceM.java`, `detail/H6630SettingActivity.java` |
| IoT | `iot/Cmd.java` |

---

## 9. Gaps / unknowns

- No **H6078** hooks exist in this split. If H6078 support is expected, it is in a
  different split.
- `0x40` device-status payload and `0x41` device-info payload are only partially
  decoded in `Info4Detail`; several bits (`[2]..[4]`) are stored raw.
- The DIY `subEffect/secondSubEffect` table is partially named (Chinese effect names);
  per-effect byte layouts are in 30+ small classes and are not reproduced byte-for-byte
  here. The outer envelope (`0x58` + `[subEffect,secondSubEffect,…]` + mode `0x0A`
  `0x00FE`) is exact.
- Matter pairing is delegated to the base module; no cluster/attribute mapping.
- `0x7C/0x7D/0x7E` and mode `0x81/0x82` semantics are inferred from the calling methods
  (`setShortcut`, `set24HoursToDevice`, `setTemUnitToDevice`, display mode); the
  device-side byte layout for shortcut depends on `DisplayEffectManager`.
- Cloud music/playlist and white-noise playback live in the shared `onlinesound`
  module, not in this split.
