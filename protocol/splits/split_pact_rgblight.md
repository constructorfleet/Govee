# split_pact_rgblight — BLE / IoT protocol extraction

Split: `split_pact_rgblight` (module `pact_rgblight`, 7.7.10)
Source root: `decompiled/jadx-splits/split_pact_rgblight/sources`
Base helpers: `decompiled/jadx-base-7.7.10/sources`

All paths below are relative to `decompiled/`.

---

## 1. Overview — families and SKUs

This is the large "RGB / RGBIC strip, bulb, TV-light, car-light, home-light" split.
It is not one protocol: it is ~20 independent BLE dialects that share the
`base2light` controller framework (`AbsSingleController`, `AbsModeController`,
`AbsMultipleController*`). They differ in:

* which GATT service/characteristic they use (vendor `…1910/…2b11` vs Nordic `FFE0/FFE1`),
* which `sub_mode` byte inside `0x05` (mode) selects colour / music / scene / DIY,
* the colour payload width (8-byte RGB+flag vs 9-byte RGB+kelvin),
* scene effect-id width (1 byte vs 2 bytes LE),
* whether they have an IoT (`pt` / `ptReal`) path.

### 1.1 Sub-family / SKU matrix (deduplicated)

| Sub-family (package) | SKUs (`SubLib.keys()` / `Sku.*`) | Transport | Notes |
|---|---|---|---|
| `h6159` | H6159, H6110, H6109, H614A, H614B, H614E | ble+iot | canonical RGB dialect (8-byte colour, 2-byte scene id, music 0x03 + 0x0E) |
| `h613839` | H6138, H6139, H613A, H613B, H613C, H613D, H613E, H613F | ble+iot | almost identical to h6159; adds `SubModeColor4Bk` (9-byte) and music V1/V2 |
| `h6160` | H6160 | ble+iot | `AbsBle4Old`; adds `sub_mode_color_v1 = 0x0B` (15-segment mask) and gradual-change `0xA3` |
| `h6165` | H6165, H6166 | ble | 8-byte colour, mic `0x05 0x00 flag`, no scenes |
| `h6181` | H6181 | ble | 1-byte scene id, no music (mic marker `0xFF` only) |
| `h6182` | H6182 | ble+iot | 1-byte scene id, music `0x03` |
| `h6113` | H6113 | ble | music `0x03`, no scenes |
| `h6114` | H6114 | ble | music `0x03`, 1-byte scene id |
| `h6101` | H6101 | ble | video mode `0x00`, music `0x01` with effect 0..3, calibration `0x08` |
| `h6104` | H6104 | ble+iot | video `0x00`, music `0x01`, 1-byte scene id, multi-DIY, direction `0x13`, IP `0x15` |
| `h7004` | H7004 | ble | red/blue ratio `0x0D` only |
| `h7017` | H7017 | ble | red/blue ratio `0x0D` only (config skeleton) |
| `h73101217` | H7310, H7312, H7317 | ble | mic `0x05`, 8-byte colour, 1-byte scene id; H7317 has separate `ModeH7317` |
| `h7318` | H7318 | ble | music `0x01 [effect,sens]`, 1-byte scene id |
| `tvlightv1` | H6179 | ble | **TV light**: colour 9-byte (`0x0D`), no scenes; goodsType 12 |
| `carlightv1` | H6118, H6194 | ble | **car light**: colour `0x0D`, music `0x0E`/`0x13`, scenes `0x04` 2-byte; goodsType 6 |
| `homelightv1` | H6148 | ble+iot | **home light**: colour `0x0D`, music `0x0F`, scenes `0x04` 1-byte; goodsType 16 |
| `rgblight/h6188` | H6188 | ble+iot | new-detail; colour `0x0D`, music `0x03`, scenes `0x04` 2-byte |
| `rgblight/h7308` | H7308, H7309, H7311, H7313, H7315, H7316 | ble | scenes sub-mode is `0xA1` (not `0x04`), effect ids 20..27 |
| `rgblight/h60858689` | H6085, H6086, H6089 | **iot only** | WiFi bulb; AP provisioning (`192.168.1.1:7200`, SSID `Govee_bulb`) + cloud MQTT; no BLE |
| `stringlightv2` | H6141, H6142, H6195, H6196, H6197, H6170, H6154, H6121, H615A, H615B, H615C, H615D, H616B, H6178, H615E, H6192 **plus** H6159/H6110/H6109/H614A/H614B/H614E/H6138/H6139/H613A…H613F/H6160 | ble, or ble+iot by goodsType | richest dialect: colour `0x0D`, music `0x0E`, new music `0x13`, mic `0x05`, scenes `0x04`; goodsType 1/40/108 = BLE+IoT, 2/39/68/78/143 = BLE |

Total distinct SKUs in this split: **59** (see JSON `skus`).

SKU source of truth:

* `…/com/govee/*/sku/SubLib.java` (`keys()`), `…/sku/Sku.java` arrays.
* `…/com/govee/carlightv1/pact/Support.java` (`e = {6}`, names `H6118`/`H6194`).
* `…/com/govee/homelightv1/pact/Support.java` (`e = {16}`, name `H6148`).
* `…/com/govee/stringlightv2/pact/Support.java` (all SKU string constants; `I={2,39,68,78,143}`, `J={40,108,1}`).
* `…/com/govee/rgblight/Support.java` (`f`, `g`, `h`, `B`, `C` sets).
* `…/com/govee/rgblight/h7308/H7308Config.java` (`{H7308,H7309,H7311,H7313,H7315,H7316}`).
* `…/com/govee/rgblight/add/SubLib.java` (`H6188,H6160,H6182`), `OldBleSubLib` (`H6113,H6114,H6181` + H7308 group), `OldIotSubLib` (`H6085,H6086,H6089`), `SubLibBle` (goodsType 12 = H6179).
* `…/com/govee/tvlightv1/SupportH6179.java` (`H6179`, goodsType 12).
* `…/com/govee/rgblight/RgbLightRegistry.java` (`f` = 39-SKU registry set).

---

## 2. Transports and GATT UUIDs

Two UUID pairs are used.

| Pair | Service | Characteristic | Families |
|---|---|---|---|
| **Vendor ("Govee")** | `00010203-0405-0607-0809-0a0b0c0d1910` | `00010203-0405-0607-0809-0a0b0c0d2b11` | h6159, h613839, h6160, h6165, h6182, h6113, h6114, h6181, h7004, h7017, h73101217, h7318, h6179 (via rgblight), carlightv1, homelightv1, rgblight, stringlightv2 |
| **Nordic UART** | `0000ffe0-0000-1000-8000-00805f9b34fb` | `0000ffe1-0000-1000-8000-00805f9b34fb` | **h6101**, **h6104** (single + multi-packet comm) |

Evidence:

* `…/com/govee/h6159/ble/BleComm.java`, `h6160/ble/BleComm.java`, `h6113`, `h6114`, `h6181`, `h6182`, `h6165`, `h7004`, `h7017`, `h73101217`, `h7318`, `carlightv1`, `homelightv1`, `stringlightv2`, `rgblight/ble/BleComm.java`.
* `…/com/govee/h6101/ble/BleComm.java`, `…/h6104/ble/BleComm.java` (FFE0/FFE1); `…/h6104/ble/MultipleBleComm.java` also FFE0/FFE1.

Group/multi variants (`BleCommGroup`, `BleMultiComm`, `BleMultiCommGroup`) use the same pair.

### Transport classification evidence

* **ble+iot**: package has `iot/` with `Cmd*` + `Op*CommDialog4BleIot*`, and `Ble.u()` returns `AbsMultiple4PtRealBleComm` (ptReal tunnel): h6159, h613839, h6160, h6182, h6104, homelightv1, stringlightv2, rgblight/ble.
* **ble only**: `Ble` exposes only `r()` (+ optional `v()`/`w()`), no ptReal/u(): h6113, h6114, h6181, h6165, h6101, h7004, h7017, h73101217, h7318, carlightv1 (`EffectOp4Ble.supportWifi()` → false), tvlightv1.
* **iot only**: `H60858689Config`/`SubMaker.SkuItem.needBle()` returns **false** for H6085/H6086/H6089 → no GATT; `EffectOp4Iot.supportBle()` false, `supportWifi()` true.
* H6104 `AbsEffectOp4Ble` returns both `getRoomOp()` (BLE) and non-null `getRoomOp4Iot()`, `isWifiLight()=true` → ble+iot.
* H6182 has an `iot/` package but no `CmdPtReal`; IoT uses direct `color`/`colorTem`/`turn`/`brightness` JSON.
* H6188/stringlightv2/h6159/h6160 use `CmdPtReal` (`{ "command": ["<base64(20B frame)>"] }`).

---

## 3. BLE frame

Every packet is fixed 20 bytes:

```
[0]     proType
[1]     cmdType
[2..18] payload (zero padded)
[19]    BCC = XOR of bytes 0..18
```

`proType`:

| proType | Meaning |
|---|---|
| `0x33` | single write / set |
| `0xAA` | single read / query (also `0xAB` = single read multi-reply in some families) |
| `0xA5` | multi-packet write (multi-DIY `cmdType 0x02`) |
| `0xA4` | multi-packet read |
| `0xA3` | multi-packet V1 write (new scenes / music / DIY template / gradual) |
| `0xEE` | notification |

Read replies are stripped by `AbsSingleController.m()`: for reads bytes `2..18` → 17-byte
`validBytes`; for writes bytes `3..18` → 16 bytes. `AbsMode.parse()` then takes
`validBytes[0]` as the sub-mode and passes `validBytes[1..]` to the sub-mode parser.
(`decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/AbsSingleController.java`,
`AbsMode.java`, `AbsModeController.java`.)

### 3.1 Shared single-packet commands

These are the framework controllers used by every family in this split unless noted.

| Name | Write op | Payload | Read op | Reply |
|---|---|---|---|---|
| heartbeat | — | — | `0xAA/0x01` | `[0]` 0/1 (`HeartController`) |
| power | `0x33/0x01` | `[0]` 0=off, 1=on | `0xAA/0x01` | `[0]` state |
| brightness | `0x33/0x04` | `[0]` absolute 0..254 (scaled from UI 0..100 between family min/max) | `0xAA/0x04` | `[0]` absolute |
| mode / colour / scene / DIY / music | `0x33/0x05` | sub-mode payload (§8) | `0xAA/0x05` | payload `{0x01}`; reply `[0]`=sub-mode, `[1..]`=sub-mode body (`AbsModeController.p()` = `{1}`) |
| soft version | — | — | `0xAA/0x06` | ASCII string |
| hard version | — | — | `0xAA/0x07` | `p()` = `{0x03}`, reply `[0]==3`, `[1..]` ASCII |
| wifi soft version | — | — | `0xAA/0x21` | ASCII |
| wifi hard version | — | — | `0xAA/0x20` | ASCII |
| auto time / timer V0 | `0x33/0x0A` | `[0..]` open/close h/m/repeat | `0xAA/0x0A` | `AutoTimeController` |
| new timer V1 | `0x33/0x23` | timer slots | `0xAA/0x23` | `NewTimerV1Controller`, 4 slots parsed by `NewTimerV1.parseBytes` |
| sleep | `0x33/0x11` | sleep window | `0xAA/0x11` | `SleepController` |
| wakeup | `0x33/0x12` | wake window | `0xAA/0x12` | `WakeUpController` |
| limit (max current/brightness cap) | `0x33/0x0E` | `[0]` 0/1 | `0xAA/0x0E` | `[0]==1`; stringlightv2/h6160 `LimitController` |
| OTA prepare | `0x33/0xEE` | none | — | `OtaPrepareController` (stringlightv2, h6160) |
| multi-DIY | `0xA5/0x02` | §8.4 | `0xA4/0x02` | — |
| multi scenes | `0xA3/0x01` (V1), `0xA3/0x02` (V2), `0xA3/0x07` (V3), `0xA3/0x0A` (V4/V5) | §8.5 | — | — |
| multi new music | `0xA3/0x41` | §8.6 | — | `MultipleController4Music.getCommandType() = 65` |

Base app refs: `com/govee/base2light/ble/controller/{SwitchController,BrightnessController,AbsModeController,HeartController,SoftVersionController,HardVersionController,WifiSoftVersionController,WifiHardVersionController,AutoTimeController,NewTimerV1Controller,SleepController,WakeUpController}.java`.

---

## 4. BLE commands per family (unique opcodes / payloads)

### 4.1 h6159 (H6159/H6110/H6109/H614A/H614B/H614E)

`…/com/govee/h6159/ble/BleProtocol.java`

| sub-mode | id | Payload (`0x33/0x05` + this) | Parse |
|---|---|---|---|
| colour | `0x02` | `02 R G B tempFlag R2 G2 B2` (8 B) — `tempFlag=1` ⇒ colour-temp, `R2G2B2` = temperature RGB | `[0..2]`=RGB, `[3]`=flag, `[4..6]`=bg RGB |
| music | `0x03` | `03 autoFlag sensitivity [R G B]` 3 or 6 B; sensitivity 0..99; `autoFlag` 0 = manual/colour | `[0]`auto, `[1]`sens, `[2..4]`RGB |
| scenes | `0x04` | `04 lo hi` (16-bit LE effect id) | `[0..1]` LE16 |
| new DIY | `0x0A` | `0A lo hi` (16-bit LE DIY code) | `[0..1]` LE16 |
| music V1/V2 | `0x0E` | `0E effect sens auto [R G B]`; V2 new-code form `0E musicCode sens` | `ParamsSubMode4Music.a(version)` |
| colour + kelvin | `0x0D` | `0D R G B kHi kLo R2 G2 B2` (9 B, kelvin big-endian) | `[3..4]` signed short kelvin |

Read cycle (`…/h6159/ble/BleReadManager.java f()`):
`0xAA/06, 0xAA/07, 0xAA/07({1}? see i()), 0xAA/21, 0xAA/20, 0xAA/0A, 0xAA/01, 0xAA/04, 0xAA/05`.

### 4.2 h613839 (H6138/H6139/H613A…H613F)

Same as h6159 (`…/h613839/ble/BleProtocol.java`), total submode set:
`{0x02 colour, 0x0D colour+BK, 0x03 music, 0x0E music V1/V2, 0x04 scenes, 0x0A DIY}`.
`ScenesV0` effects `{4,5,7,8,9,16,10}`; microphone thresholds by version
(`…/h613839/sku/Support.java`): H6138 ≥1.04.00 new order / ≥1.00.17 colour order,
H6139 ≥1.04.00 / ≥1.00.12.

### 4.3 h6160 (H6160)

`…/com/govee/h6160/ble/BleProtocol.java`

| sub-mode | id | Payload | Notes |
|---|---|---|---|
| colour | `0x02` | `02 R G B flag R2 G2 B2` | same as h6159 |
| colour V1 (segments) | `0x0B` | `0B R G B maskLo maskHi 00 00` | 15-bit segment enable mask: bits 0..7 → byte 4, bits 8..14 → byte 5 (`…/h6160/adjust/v1/SubModeColorV1.java`) |
| music (old) | `0x03` | `03 auto sens [R G B]` | |
| music V1 | `0x01` | `01 effect sens [R G B]` | effect 0..3 |
| music V1 RGB | `0x0E` | `0E effect sens auto [R G B]` | |
| scenes | `0x04` | `04 lo hi` | 2-byte LE |
| DIY | `0x0A` | `0A lo hi` | |
| gradual change | *(cmd 0xA3)* | `Gradual4BleWifiController` `0xA3 / 0x01` = `{0|1}` — turns gradual transitions on/off | `…/h6160/ble/v1/Gradual4BleWifiController.java` |

`H6160Support`: brightness 20..254; new scenes version = 2 when soft ≥ 1.03.00;
DIY version 4; mic new-order ≥ 1.04.05.

### 4.4 h6165 / h6166

`…/com/govee/h6165/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| colour | `0x02` | `02 R G B 00 00 00 00` (8 B; no scene bg here — `SubModeColor` writes 8 B) |
| mic | `0x05` | `05 00 flag` (`MicController.q()` = `{5,0,flag}`; `SubModeMic` = `{5,1}`) |
| DIY | `0x0A` | `0A lo hi` |

Brightness range: H6165 `{20,254}`, H6166 `{20,230}`.

### 4.5 h6181

`…/com/govee/h6181/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| colour | `0x02` | `02 R G B flag R2 G2 B2` |
| scenes | `0x04` | `04 effect` (1 byte) |
| DIY | `0x0A` | `0A lo hi` |
| mic marker | `0xFF` | `null` payload (never sent; used as selector only) |

No music. `Sku.supportDiy` ≥ 10100.

### 4.6 h6182

`…/com/govee/h6182/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| colour | `0x02` | `02 R G B flag R2 G2 B2` |
| music | `0x03` | `03 auto sens [R G B]` |
| scenes | `0x04` | `04 effect` (1 byte) |
| DIY | `0x0A` | `0A lo hi` |

IoT: direct JSON (`color`, `colorTem`, `turn`, `brightness`), no `ptReal`.

### 4.7 h6113 / h6114

`…/h6113/ble/BleProtocol.java` — `{0x02 colour, 0x03 music, 0x0A DIY}`; no scenes.
`…/h6114/ble/BleProtocol.java` — same + `0x04 scenes` (`04 effect`, 1 byte).

Music payload `03 auto sens [R G B]`, auto = `!autoFlag`.

### 4.8 h6101

`…/com/govee/h6101/ble/BleProtocol.java`

| sub-mode | id | Payload | Meaning |
|---|---|---|---|
| video | `0x00` | `00 videoType syncFlag` — `videoType`: 0=part, 1=all, 2=dynamic; `syncFlag` = `!soft` (0 = soft) | `SubModeVideo` |
| music | `0x01` | `01 effect sens [R G B]` — effect 0=energic, 1=spectrum, 2=rolling, 3=rhythm; RGB only for effect 1/2 | `SubModeMusic` |
| colour | `0x02` | `02 R G B flag R2 G2 B2` | |
| calibration start | `0x08` | none | `CalibrationController` (write-only) |
| calibration ok | `0x01` read | — | `CalibrationOkController` (read) |

### 4.9 h6104

`…/com/govee/h6104/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| video | `0x00` | `00 00 syncFlag videoBrightness`; the new-detail `VideoVm` emits the minimal `05 00 00 <screenState> <vivid>` form. Shared DreamView camera settings: `DREAMVIEW-HDMI.md` |
| music | `0x01` | `01 effect sens [R G B]` (effect 0..3) |
| colour | `0x02` | `02 R G B flag R2 G2 B2` |
| scenes | `0x04` | `04 effect` (1 byte) |
| DIY | `0x0A` | `0A lo hi` |
| direction (write/read) | cmd `0x13` | `[0]` direction code; read `0xAA/0x13` same |
| IP (read) | cmd `0x15` | none → reply `[0..3]`=IPv4, `[4..7]`=port (int32) |

Scene effects (`…/h6104/adjust/Scenes4BleRhythm.java`): `{0,1,4,5,7,8,9,15(snow)}`.

IoT (`…/h6104/iot/Cmd.java`): `online, turn, brightness, status, timer, color, colorTem, calibrationPoints, calibrationSnapshot, IP, direction, IoTConnected`.

### 4.10 h7004 / h7017

`…/h7004/ble/BleProtocol.java`, `…/h7017/ble/BleProtocol.java`

| op | payload | meaning |
|---|---|---|
| `0x33/0x0D` | `[0]` ratio, `[1]` reserved | red/blue ratio (`RedBlueController`) — constants: 1 = 4:1, 2 = 6:1, 3 = 8:1 |
| `0x33/0x05` | `null` | `Mode.a(goodsType, pactCode)` selects `SubModeRedBlue41/61/81` whose `getWriteBytes()` = `null` (selector only) |

These are "plant / red-blue" grow-light style SKUs. Only `BleComm`/`Ble` skeletons are present;
detail UI lives elsewhere.

### 4.11 h7310 / h7312 / h7317

`…/h73101217/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| colour | `0x02` | `02 R G B 00 00 00 00` (8 B) |
| scenes | `0x04` | `04 effect` (1 byte) |
| mic | `0x05` | `05 01` |
| DIY | `0x0A` | `0A lo hi` |

`H7317` uses `ModeH7317` + `H7317ModeController` (separate parser class, same wire format).
`Sku.supportCopperRgbMic` for H7310/H7312 soft ≥ 10100; `supportMix` for H7317 always,
others soft ≥ 10100.

### 4.12 h7318

`…/h7318/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| music | `0x01` | `01 effect sens` (effect 5=power, 4=soft) |
| colour | `0x02` | `02 R G B 00 00 00 00` |
| scenes | `0x04` | `04 effect` (1 byte) |
| DIY | `0x0A` | `0A lo hi` |

### 4.13 tvlightv1 (H6179, TV light)

`…/com/govee/tvlightv1/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| colour | `0x0D` | `0D R G B kHi kLo R2 G2 B2` (9 B) |
| DIY | `0x0A` | `0A lo hi` |

No scenes, no music (only colour + DIY + switch + brightness + heartbeat).
Brightness `NumUtil.calculateProgress(254, 20, i)`; goodsType 12.

### 4.14 carlightv1 (H6118 / H6194, car light)

`…/com/govee/carlightv1/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| scenes | `0x04` | `04 lo hi` (2-byte LE) |
| DIY | `0x0A` | `0A lo hi` |
| colour + kelvin | `0x0D` | `0D R G B kHi kLo R2 G2 B2` |
| music V1 | `0x0E` | `0E effect sens auto [R G B]` |
| new music | `0x13` | `13 effect sens param auto [R G B]` (8 B) |

`ScenesV0` effects `{4,5,7,8,9,10,16}`; goodsType 6, protocols `(1,1),(1,2)`.

### 4.15 homelightv1 (H6148, home light)

`…/com/govee/homelightv1/ble/BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| scenes | `0x04` | `04 effect` (1 byte) |
| DIY | `0x0A` | `0A lo hi` |
| colour + kelvin | `0x0D` | `0D R G B kHi kLo R2 G2 B2` |
| music | `0x0F` | `0F effect sens param auto [R G B]` |

Scenes `{4,5,13,23,24,9,16,7,17,26}` (read/brightness/aurora/sleep…); goodsType 16.
BLE room-op method `makeMicBytesByRgb` → `ModeController(SubModeColor.beRgb(rgb))`.

### 4.16 rgblight/h7308 group (H7308/H7309/H7311/H7313/H7315/H7316)

`…/com/govee/rgblight/h7308/H7308BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| scenes | **`0xA1` (signed -95)** | `A1 effect` — single-byte effect id, *not* `0x04` |
| effects | 20..27 | 20 combination, 21 in-waves, 22 sequential, 23 slow-glow, 24 chasing, 25 slow-fade, 26 twinkle, 27 steady-on |

Scene command construction: `…/rgblight/mode/scene/DelegateSceneV1.java` chooses
`H7308BleProtocol.sub_mode_scenes` for the H7308 set, otherwise `0x04`.

### 4.17 rgblight/h6188 (H6188)

`…/com/govee/rgblight/h6188/H6188BleProtocol.java`

| sub-mode | id | Payload |
|---|---|---|
| colour + kelvin | `0x0D` | `0D R G B kHi kLo R2 G2 B2` |
| music | `0x03` | `03 auto sens [R G B]` |
| scenes | `0x04` | `04 effect` (2-byte LE per `SubModeScenes`) |
| DIY | `0x0A` | `0A lo hi` |

Scene effects `{4,5,13,23,24,9,16,7,17}`; has `H6188DevicePickSound` (music-file picker).

---

## 5. BLE notifications / readings

All families register `BleNotifyComm extends AbsNotify` with `b() = 0xEE` (proType notify).
Notification frame: `[0]=0xEE`, `[1]=notifyType`, `[2..18]=body`; `AbsNotify` copies
`bytes[1..18]` and dispatches on `bytes[1]`; each `AbsNotifyParse` then copies
`[1..17]` into a 17-byte body (i.e. original bytes 2..18).

| notifyType | Parser | Layout | Meaning |
|---|---|---|---|
| `0x11` (17) | `WifiNotifyParse` (`h6159/ble/WifiNotifyParse.java`, `h6104`, `h6160`, `h6182`, `homelightv1`, `stringlightv2`, `rgblight/ble/BleNotifyComm`) | `[0]==0` ⇒ connected | WiFi/BLE pairing status → `EventNotifyWifiConnect` |

Offline/read state is otherwise obtained by the `0xAA` read cycle (§3.1), which returns
the current switch/brightness/mode and the version strings.

`rgblight/ble/BleNotifyComm` also registers `com.govee.base2light.connect.present.WifiNotifyParse`.

---

## 6. IoT (cloud / WiFi) commands

### 6.1 Command envelope

`CmdBuilder.makeCmdStr(cmd)` → `com.govee.base2home.iot.Write.getWriteMsg4Transaction(null, cmd)`
(V0):

```json
{"msg":{"transaction":"<gen>","accountTopic":"<topic>","type":1,"origin":32,
        "cmdVersion":<int>,"cmd":"<name>","data":{...}}}
```

Reads use `type:0` with the same `cmd`/`data` shape.

Envelope variant by family:

| Family | Incoming variant | Parser |
|---|---|---|
| h6104 | V0 flat `status` object | `…/h6104/iot/IotManager.java` extends `AbsIotManagerV0`, `CmdStatusV0.parseJson` |
| h6159 | V0 with `status.modeValue` base64 BLE frames | `…/h6159/iot/IotManager.java`, `CmdStatusV0` |
| h6160 | V0 + `pt`/`ptReal` | `…/h6160/iot/Cmd*` |
| h6182 | V0 direct JSON | `…/h6182/iot/CmdStatusV0` |
| homelightv1 | V1 `{ "state": {...}, "op": {...} }` | `…/homelightv1/iot/CmdStatusV0.parseJson` via `AbsIotManagerV1.getJsonObjectStr` |
| stringlightv2 | V1 `{ "state": {...}, "op": {"command":[...] } }` | `…/stringlightv2/iot/CmdStatusV1.parseJson`, `ResultPtV1` |
| H6085/H6086/H6089 | V1 (`OldIotResp` with `state`, `config`, `modeValue`) | `…/rgblight/h60858689/H60858689IotV1ParseHelper.java` |

### 6.2 `cmd` names

| cmd | data fields | Families |
|---|---|---|
| `online` | — (query) | all |
| `turn` | `val`: 0/1 | all |
| `brightness` | `val`: int (family absolute range, see `getBrightnessRange`) | all |
| `color` | `red`,`green`,`blue` (0..255) | h6104, h6159, h6160, h6182, homelightv1 (V1 state only), stringlightv2 |
| `colorTem` | `colorTemInKelvin`, `color{red,green,blue}` | h6104, h6159, h6160, h6182, stringlightv2 |
| `colorwc` | `color{red,green,blue}`, `colorTemInKelvin` | h6159, h6160, homelightv1, stringlightv2 |
| `status` | see §6.3 (query/response) | all |
| `timer` | `enable`, `timeOffset`, `timeOffsetMinute`, `isGroup`, `group`, `time[]{enable,openHour,openMin,closeHour,closeMin,repeat}` (`cmdVersion:1` in `CmdTimerV1`) | h6104, h6159 |
| `pt` | `op`,`value:[base64]` | h6159, h6160, homelightv1, stringlightv2 |
| `ptReal` | `command:[base64 20-byte frame]` | h6159, h6160, stringlightv2 |
| `calibrationPoints` | `points[]{pointX,pointY}` | h6104 |
| `calibrationSnapshot` | `snapshotUrl` | h6104 |
| `IP` | `ip`,`port` | h6104 |
| `direction` | `change` | h6104 |
| `IoTConnected` | — | h6104 |
| `state` / `op` | read-parse keys (not cmd names): homelightv1 `Cmd.getCmdReadParseKey("pt")="op"`, else `"state"`; stringlightv2 for `pt`/`ptReal` → `"op"` | homelightv1, stringlightv2 |
| `mode` (H6085/86/89) | `mode:10`, `code`, `color[]` (RGB list), `effect`, `subEff`, `speed`, `effArr[]{effect,subEff}` — `CmdDiy` | H6085/86/89 |
| `mode` (H6085/86/89 scene) | `mode:4`, `code` — `CmdScenes` | H6085/86/89 |
| `colorTem` (H6085/86/89) | `colorTemInKelvin`, `color` | H6085/86/89 |

`pt` value list is a sequence of base64-encoded **20-byte BLE frames**. The last frame is the
`0x05` mode frame (`CmdPt.getModeBytes()`), so `pt` = "BLE frames over cloud".

`ptReal` is the same but with the key `command` and is preferred for new firmware
(`CmdPtReal.getNewScenesCmdPtReal` → base64 of each A3 packet + final mode frame).

### 6.3 `status` / reading schema

h6104 / h6159 `CmdStatusV0`:

```json
{"cmd":"status","data":{
  "turn":0|1, "brightness":0..254,
  "mode":2|4|10,                  // 2=colour/colourTem, 4=scene, 10=DIY
  "color":{"red":0-255,"green":0-255,"blue":0-255},
  "colorTemInKelvin":2000..9000,
  "softversion":"1.02.03", "wifiSoftVersion":"1.03.01",
  "modeValue":["<base64 20B mode frame>"],
  "timer":{"enable":0|1,"time":[{"openHour":..,"openMin":..,"closeHour":..,"closeMin":..}]}
}}
```

* `modeValue` (h6159) is decoded with `BleUtil.parseValidBleBytes` and fed to `Mode.parse`;
  `CmdStatusV0` requires `frame[1]==0x05` and length 20.
* h6104 `status` has no `modeValue`; colour is `mode==2` + `color`/`colorTemInKelvin`.

homelightv1 (V1 `state`):

```json
{"state":{"onOff":0|1,"brightness":0..100,"mode":13,
          "color":{"red":..,"green":..,"blue":..},"colorTemInKelvin":..},
 "op":{"opcode":"mode|sleep|wakeup|timer",
       "modeValue":["<b64>"],"sleepValue":["<b64>"],"wakeupValue":["<b64>"],"timerValue":["<b64>"]}}
```

stringlightv2 (V1):

```json
{"state":{"onOff":0|1,"brightness":0..100,"mode":..},
 "op":{"command":["<b64 20B frame>", ...]}}
```

`CmdStatusV1.parseJson` scans `command` frames by `frame[1]`:
`0x05` → mode (`Mode.parseMode`), `0x23` → timers (`NewTimerV1Controller.parseAllTimer`),
`0x12` → wakeup, `0x11` → sleep.

H6085/H6086/H6089 (V1 `OldIotResp`): `cmd=="status"`, `state.color`, `state.mode`,
`config.time[]`, `config.sleep`, `config.wakeup`, `config.modeValue`. Mode decoding:
`mode 2` → colour, `mode 4` → `code` (scene), `mode 10` → `code` (DIY).

### 6.4 IoT readings units

| Field | Unit / range |
|---|---|
| `brightness.val` | device-absolute 0..254 (families expose `getBrightnessRange`; e.g. H6159 6..254, H6166 20..230, h6104 20..254) |
| `colorTemInKelvin` | Kelvin, `Constant.getColorTemKelvinSet()` (typical 2000..9000, 100 K steps) |
| `color.red/green/blue` | 0..255 |
| `timer.*` | local time, `timeOffset` in minutes offset |
| `direction.change` | raw direction byte (see BLE direction table) |

---

## 7. Other protocols

### 7.1 H6085/H6086/H6089 WiFi provisioning (AP mode, softAP + socket)

`…/com/govee/rgblight/h60858689/H60858689Config.java`, `…/add/ApComm.java`,
`WifiApInfo.java`, `PairAc.java`, `AddInfo.java`.

* SoftAP SSID `Govee_bulb_<SKU>`, device IP `192.168.1.1`, port **7200**,
  default SSID prefix `Govee_bulb`.
* JSON `BaseRequest` / `BaseResponse` over a socket:
  * `type 1` → read device info (`AbsDeviceInfo`: device, sku, mac, …)
  * `type 2` → send WiFi credentials (`WifiApInfo` fields incl. `ssid`, `timeStamp`)
  * response `result 0` = success, followed by `CheckDeviceWifiRequest` and
    `DeviceBindRequest`/`DeviceTopicRequest` bootstrap.
* After provisioning the bulb is cloud-only: `DeviceSetting{ mac, topic }`, topic used for
  MQTT (`AbsOpCommDialog4Iot`), online cmd `online`.
* BLE capability flags: `SubMaker.SkuItem.needBle()` → false; `EffectOp4Iot.supportBle()` false,
  `supportWifi()`/`isWifiLight()` true. `AddInfo.makeAddInfo4Pair(sku,32,64,"Govee_bulb_"+sku,"192.168.1.1",7200)`.

### 7.2 BLE advertisement / broadcast

`rgblight/add/BleBroadcastProcessorV1.java` (and `carlightv1/add/BleBroadcastProcessorV1`,
`homelightv1/add/BleBroadcastProcessor`) are registered via `BleProcessorManager`; they
match advertisements to SKU and trigger the BLE/AP connect dialogs. No
sensor telemetry payload is parsed in this split.

### 7.3 Group / multi-device

`BleCommGroup`, `BleMultiCommGroup`, `GroupBle`, `GroupOp` (carlightv1, stringlightv2)
implement group writes: group `g()=3`, secret-key check `SecretKeyController`,
response matching `frame[0]==0xAA && frame[1]==0x01 → frame[2]!=0`.
`stringlightv2/pact/GroupFactor*.java` register the group factor.

### 7.4 Matter / IR / RF / Thread

None in this split.

---

## 8. Dynamic effects — exact payload layouts

### 8.1 Colour (`sub_mode 0x02` / `0x0D`)

```
02 R G B flag R2 G2 B2          (8 bytes; h6159, h613839, h6160, h6165, h6181, h6182,
                                 h6113, h6114, h6104, h6101)
0D R G B kHi kLo R2 G2 B2       (9 bytes; h6159/h613839 BK, carlightv1, homelightv1,
                                 tvlightv1, rgblight h6188, stringlightv2)
02 R G B 00 00 00 00            (8 bytes; h7310/h7317, h7318)
```

* `flag` (byte 4) = 1 when the request is a colour-temperature request; then `R2G2B2`
  carries the temperature RGB and `R G B` may be `FF FF FF` (h6159 sets `setRgb(-1)`).
* `kHi kLo` = kelvin, **big-endian** (`BleUtil.getSignedBytesFor2(k, true)`).
* `R2G2B2` is the background/second zone colour (or temperature colour).
* Segment variant (h6160 only): `0B R G B maskLo maskHi 00 00`, 15 segments,
  bit *n* = segment *n* enabled.

Parse mirrors write: `[0..2]=RGB`, `[3]=flag` (or `[3..4]=kelvin` for 9-byte), rest = bg RGB.
`SubModeColor.parse` clamps nothing; `SubModeColor4Bk.parse` treats `a=-1` as "temp mode".

### 8.2 Music

| Family | submode | Payload | Fields |
|---|---|---|---|
| h6159/h613839/h6113/h6114/h6160/h6182 | `0x03` | `03 auto sens [R G B]` | `auto` 0=manual/colour(3 B) 1=auto(6 B); `sens` 0..99 |
| h6101/h6104/h6160(V1)/h7318 | `0x01` | `01 effect sens [R G B]` | effect ids: h6101/h6104 0=energic,1=spectrum,2=rolling,3=rhythm; h7318 4=soft,5=power |
| h6159/h613839/h6160(RGB)/carlightv1 | `0x0E` | `0E effect sens auto [R G B]` | V1 music, `auto` inverted (`0` when auto) |
| homelightv1 | `0x0F` | `0F effect sens param auto [R G B]` | |
| stringlightv2 old | `0x0E` | `0E effect sens auto [R G B]` | |
| stringlightv2 new / carlightv1 new | `0x13` | `13 effect sens param auto [R G B]` | 8-byte new music |
| h6165 | `0x05` | `05 00 flag` (mic on/off) | |
| h7310/h7317 | `0x05` | `05 01` | |
| stringlightv2 H6192 mic | `0x05` | `05` (single byte) | `SubModeMicH6192` |

`SubModeMusicV2` (h6159/h613839) has two encodings under `0x0E`:
`{0E musicCode sens}` when `musicCode ∈ AbsNewMusicEffect.newMusicCode4RgbList`, else the
legacy `{0E auto sens manualFlag R G B}` form.

### 8.3 Scenes (`sub_mode 0x04`)

```
04 <effect lo> <effect hi>     ; 2-byte little-endian (h6159, h613839, h6160, carlightv1,
                               ; stringlightv2, h6188, rgblight)
04 <effect>                    ; 1-byte (h6104, h6114, h6181, h6182, h7318, h7310/h7317,
                               ; homelightv1)
A1 <effect>                    ; h7308 group (sub_mode_scenes = -95 / 0xA1)
```

Effect ID tables found in the split (id = wire value):

| Table | IDs → meaning |
|---|---|
| h6159 / h6160 v0 (`ScenesV0`) | 0 gradual(gm), 1 sunset, 4 film, 5 dating, 7 romantic, 8 blinking, 9 colour-loop(cl), 10 breath |
| h6160 v1 (`Scenes4H6160v1`) | above + 15 snow |
| h6104 (`Scenes4BleRhythm`) | 0,1,4,5,7,8,9,15(snow) |
| h613839 (`ScenesV0`) | 4,5,7,8,9,16(dynamic),10 |
| carlightv1 (`ScenesV0`) | 4,5,7,8,9,10,16 |
| h6182/h7318/h6114 (`Scenes4H6182`/`Scenes4H7318`) | 4,5,9,7,10,8,16 |
| homelightv1 (`ScenesV0`) | 4,5,13(reading),23(brightness),24(aurora),9,16,7,17(fade),26(sleep) |
| H6188 (`Scenes4H6188`) | 4,5,13,23,24,9,16,7,17 |
| H6085/86/89 (`Scenes4H60858669`) | 13,17,10,7,20,16,18,19 |
| H7308 (`Scenes4H7308`) | 20 combination, 21 in-waves, 22 sequential, 23 slow-glow, 24 chasing, 25 slow-fade, 26 twinkle, 27 steady-on |

Sub-mode constants in the family `BleProtocol.java` also give names for
0=gm, 1=sunset, 4=film, 5=date/dating, 7=romantic, 8=blinking, 9=cl, 10=breath,
13=read, 15=snow, 16=dynamic, 17=fade, 18=forest, 19=fantasy, 20=heartbeat,
23=brightness, 24=aurora, 26=sleep.

### 8.4 DIY

**Single-packet DIY activation** (`sub_mode 0x0A`):

```
0A <diyCode lo> <diyCode hi>      ; 2-byte LE for all families
```
Parse: `diyCode = LE16(bytes[0..1])`.

**Multi-packet DIY body** (`proType 0xA5`, `cmdType 0x02`; `AbsMultipleController4Diy` /
`MultipleDiyController`):

```
value = [0] diyCode
        [1] effect            (DiyProtocol.c())
        [2] subEffect         (DiyProtocol.f())
        [3] speed             (DiyProtocol.e())
        [4] colorBytesLen = 3*N
        [5 .. 5+3N)  R,G,B triples (N colour points)
        [5+3N] groupBytesLen = 2*M
        [6+3N .. 6+3N+2M) (effect, subEffect) pairs   (only when effect == 255)
```

Packetisation (`MultipleControllerComm.makeWriteMultipleBytes`, `AbsMultipleController`
`getProType()=0xA5` write / `0xA4` read, `p()=0`):

```
start  : A5 02 00 <packCount> 00 ...            (payload [0]=0,[1]=packs,[2]=p())
data i : A5 02 <i> <16 bytes> ...               (i = 1..packCount)
end    : A5 02 FF ...
```

**DIY on scenes/`pt`/`ptReal`**: multiple `0xA5`/`0xA3` packets followed by
`0x05/0A <code>` mode frame, all sent as one `pt.value` / `ptReal.command` list
(`CmdPt.getDiyPtotocol`, `CmdPt.getDiyStudioCmdPt`, `const` in `…/h6159/iot/CmdPt.java`,
`…/stringlightv2/iot/CmdPt.java`).

**H6085/86/89 DIY over IoT** (`CmdDiy`): `cmd:"mode"`, `data{mode:10, code, color:[{red,green,blue}], effect, subEff, speed, effArr:[{effect,subEff}]}`.

### 8.5 Multi-packet scenes / effect blobs (`0xA3`)

New scenes are sent as a raw base64 effect blob from the effect library
(`ScenesRgb`, `ScenesRgbIC`, `ScenesGraffiti`, `ScenesCube`, `ScenesCompose`,
`ScenesH610B`, `ScenesH6057Graffiti`, `ScenesH60B0` in
`decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/`), decoded by
`ScenesOp.parseScene`/`parseEffect` into an `AbsMultipleControllerV14Scenes` whose
`getValue()` is the blob.

Command type by effect family (`MultiNewScenesControllerV1..V10`):

| controller | cmdType | Effect family |
|---|---|---|
| `MultiNewScenesControllerV1` | `0x01` | RGB multi-layer (ScenesRgb) |
| `MultiNewScenesControllerV2` | `0x02` | RGBIC (ScenesRgbIC) |
| `MultiNewScenesControllerV3` | `0x07` | graffiti (ScenesGraffiti) |
| `MultiNewScenesControllerV4` | `0x04` | cube / motion (ScenesCube; x,y,speed,direction) |
| `MultiNewScenesControllerV5` | `0x0A` | composition (ScenesCompose) |
| `MultiNewScenesControllerV6` | `0x06` | H610B |
| `MultiNewScenesControllerV7` | `0x07` | H6078 graffiti (with offset 3 or 9) |
| `MultiNewScenesControllerV8` | `0x08` | H6092 (offset 11) |
| `MultiNewScenesControllerV9` | `0x09` | dynamic API |
| `MultiNewScenesControllerV10` | `0x0A` | H6022/H1630 graffiti |

Packetisation (`MultipleControllerCommV1.makeWriteMultipleBytes(controller)` when
`p()==1` → `makeSendBytesV1(0xA3, cmdType, value)`):

```
start : A3 00 01 <packCount> <cmdType> <bigNum> <curBigNum+1> <8B verify> <first 4 bytes of value>
data i: A3 <i> <17 bytes>
end   : A3 FF <last ≤17 bytes>
```

`verify` = 8 bytes derived from `System.currentTimeMillis()` (`BleUtils.getSignedBytesFor6`)
with two randomised bytes. `bigNum`/`curBigNum` are 1-based multi-block indices
(`MultipleControllerCommV1.N()`); `packCount` at `[3]` is the small-packet count +1.

After the blob the device is switched to the scene via
`0x05/04 <effect LE16>` (or `A1` for H7308).

**Effect attributes** carried by `AbsMultipleControllerV14Scenes`:
`scenesCode`, `effectBytes`, `direction`, `x`, `y`, `speed`, `musicCode` (default 255),
`musicSwitch`, optional `focusParams` (4 bytes for cube "focus" directions).
Direction byte values (`BleProtocolConstants.directionBytes`):
2 up, 1 down, 4 left, 3 right, 5 in, 6 out, 8 max→min, 7 min→max, 10 CW, 9 CCW,
11 diagonal up/down stretch, 12 diagonal left/right stretch, 13 diagonal spread-stretch,
14 up/down stretch, 15 left/right stretch, 16 spread-stretch, 17 physical stretch,
18 all, 19 loop-in, 20 loop-out. Focus: 5/6/13/16; H6063 focus 10/9; loop flow 19/20.

### 8.6 Multi new music (`0xA3/0x41`)

`MultipleController4Music` (`getProType 0xA3`, `getCommandType 0x41`, `p()` = sub-code):

```
value = [effect] [sensitivity] [param] [manualFlag] [R G B]
```
`SubModeMusicMultiV1` (`0x0E`) → `{0E effect sens auto [R G B]}`,
`SubModeMusicMultiV2` (`0x13`) → `{13 effect sens 00 auto [R G B]}`.
Packetised with `makeSendBytesV2` (start `A3 00 01 <count> 41 <p>…`, data, end `A3 FF …`).

### 8.7 Carousel / motion / gradient / layer counts

* **Gradient / layer multi-colour**: h6160 `SubModeColorV1` (15 segments) is the only
  segment-mask gradient in this split; other "layer" effects (gradient, multi-layer,
  motion, carousel) are delivered as pre-baked effect blobs under `0xA3` (§8.5) or
  `0x0A` mode ids, not as explicit per-layer byte arrays.
* **Motion/cube** attributes are exactly `x`, `y`, `speed`, `direction`, `focusParams`
  inside `MultiNewScenesControllerV4` (§8.5).
* **Carousel** (`0x5F/0x60/0x61`, `0x62`) and `0x54 movie feast` exist only as constants
  in `BleProtocolConstants`; no builder in this split emits them.

---

## 9. Source map (paths traced)

Family BLE cores:

```
jadx-splits/split_pact_rgblight/sources/com/govee/h6159/ble/{BleProtocol,BleComm,Ble,Mode,ModeController,SubModeColor,SubModeColor4Bk,SubModeMusic,SubModeMusicV1,SubModeMusicV2,SubModeNewDiy,SubModeScenes,ParamsSubMode4Music,MultipleBleComm,BleReadManager,BleNotifyComm,WifiNotifyParse}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h613839/ble/{BleProtocol,BleComm,Ble,Mode,ModeController,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6160/ble/{BleProtocol,BleComm,Ble,Mode,ModeController,SubMode*,v1/*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6165/ble/{BleProtocol,Ble,MicController,Mode,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6181/ble/{BleProtocol,Ble,Mode,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6182/ble/{BleProtocol,Ble,Mode,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6113/ble/{BleProtocol,Ble,Mode,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6114/ble/{BleProtocol,Ble,Mode,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6101/ble/{BleProtocol,BleComm,Mode,SubModeVideo,SubModeMusic,SubModeColor,CalibrationController,CalibrationOkController}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h6104/ble/{BleProtocol,BleComm,MultipleBleComm,Mode,SubMode*,DirectionController,IPController,BleReadManager,BleNotifyComm}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h7004/ble/{BleProtocol,BleComm,Mode,RedBlueController,SubModeRedBlue*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h7017/ble/{BleProtocol,BleComm,H7017Ble}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h73101217/{ble/*,adjust/SubMode*,adjust/H731*SubModeScenes}.java
jadx-splits/split_pact_rgblight/sources/com/govee/h7318/{ble/*,adjust/SubMode*,adjust/H7318SubModeScenes}.java
jadx-splits/split_pact_rgblight/sources/com/govee/tvlightv1/ble/{BleProtocol,Mode,ModeController,SubModeColor,SubModeNewDiy}.java
jadx-splits/split_pact_rgblight/sources/com/govee/carlightv1/ble/{BleProtocol,BleComm,Ble,Mode,ModeController,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/homelightv1/ble/{BleProtocol,BleComm,Ble,Mode,ModeController,SubMode*}.java
jadx-splits/split_pact_rgblight/sources/com/govee/rgblight/ble/{Ble,BleComm,BleMultiComm,BleNotifyComm}.java
jadx-splits/split_pact_rgblight/sources/com/govee/rgblight/h7308/H7308BleProtocol.java
jadx-splits/split_pact_rgblight/sources/com/govee/rgblight/h6188/H6188BleProtocol.java
jadx-splits/split_pact_rgblight/sources/com/govee/rgblight/h7310/BleProtocol.java
jadx-splits/split_pact_rgblight/sources/com/govee/rgblight/h60858689/H60858689Protocol.java
jadx-splits/split_pact_rgblight/sources/com/govee/stringlightv2/ble/{BleProtocol,BleComm,Ble,Mode,ModeController,SubMode*,ParamsSubMode*,LimitController,OtaPrepareController,GroupOp}.java
```

Builder → Comm → controller chains:

```
…/h6159/scenes/Common.java, …/h613839/sku/Comm.java, …/h6160/scenes/Common.java,
…/h6104/scenes/Common.java, …/h6113|h6114|h6181|h6182|h6165|h7318/scenes/Common.java,
…/carlightv1/pact/Comm.java, …/homelightv1/pact/Comm.java,
…/stringlightv2/pact/Comm.java, …/tvlightv1/pact/Comm.java,
…/h73101217/sku/Comm.java, …/tvlightv1/pact/AbsEffectOp4Ble.java,
…/carlightv1/pact/ble/AbsEffectOp4Ble.java, …/homelightv1/pact/AbsEffectOp4BleIot.java,
…/stringlightv2/pact/bleiot/AbsEffectOp4BleIot.java,
…/rgblight/ble/Ble.java, …/stringlightv2/ble/Ble.java
```

IoT:

```
…/h6104/iot/{Cmd,CmdBrightness,CmdColor,CmdColorTem,CmdTurn,CmdTimer,CmdDirection,CmdIP,CmdCalibrationPoints,CmdCalibrationSnapshot,CmdStatusV0,IotManager}.java
…/h6159/iot/{Cmd,CmdBrightness,CmdColor,CmdColorTem,CmdColorWc,CmdTurn,CmdTimer,CmdTimerV1,CmdPt,CmdPtReal,CmdStatusV0,IotManager,Op*Dialog4BleIot*}.java
…/h6160/iot/{Cmd*,Op*}.java      …/h6182/iot/{Cmd*,Op*}.java
…/homelightv1/iot/{Cmd,CmdStatus,CmdStatusV0,CmdPt,ResultPt,Op*}.java
…/stringlightv2/iot/{Cmd,CmdStatus,CmdStatusV1,CmdPt,CmdPtReal,ResultPtV1,Op*}.java
…/rgblight/h60858689/iot/{CmdColorTem,CmdDiy,CmdScenes,Op*}.java
…/rgblight/h60858689/H60858689IotV1ParseHelper.java, …/pact/{AbsEffectOp4Iot,EffectOp4Iot,DeviceSetting}.java
jadx-base: com/govee/base2light/ble/controller/{AbsSingleController,AbsModeController,AbsMode,AbsMultipleController,AbsMultipleControllerV1,V2,V3,AbsMultipleController4Diy,AbsMultipleControllerV14Scenes,MultipleDiyController,MultipleController4Music,BleProtocolConstants}.java
jadx-base: com/govee/base2light/ble/comm/{MultipleControllerComm,MultipleControllerCommV1,MultipleBleBytes,AbsNotify,AbsNotifyParse}.java
jadx-base: com/govee/base2light/ble/{ScenesOp,ScenesRgb,ScenesRgbIC,ScenesGraffiti,ScenesCube,ScenesCompose,ScenesH610B}.java
jadx-base: com/govee/base2kt/utils/BleUtils.java (generate20Bytes, BCC, LE/BE helpers)
```

SKU/support map:

```
…/*/sku/{Sku,SubLib,SubMaker,Register4Item,Support}.java
…/carlightv1/pact/{Support,SubLib,SubMaker}.java
…/homelightv1/pact/{Support,SubLib,SubMaker}.java
…/stringlightv2/pact/{Support,SubLib,SubLib4BleIot,SubMaker,Register4Item}.java
…/stringlightv2/Support4StringLightV2.java
…/h6159/Support4H6159.java, …/h613839/Support4H613839.java, …/h6160/H6160Support.java,
…/h6113/H6113Support.java, …/h6181/H6181Support.java, …/carlightv1/Support4CarLight.java,
…/tvlightv1/SupportH6179.java
…/rgblight/Support.java, …/rgblight/RgbLightRegistry.java,
…/rgblight/h7308/H7308Config.java, …/rgblight/h7310/H7310Config.java,
…/rgblight/h7318/H7318Config.java, …/rgblight/h6165/H6165Config.java,
…/rgblight/h60858689/H60858689Config.java, …/rgblight/add/{SubLib,SubLibBle,OldBleSubLib,OldIotSubLib,SubMaker}.java
```

---

## 10. Gaps / unknowns

1. **Effect blob contents (`0xA3` multi-scene) are not enumerable statically.**
   `ScenesOp` decodes base64 strings supplied by the effect library
   (`ScenesRgb` / `ScenesRgbIC` / `ScenesGraffiti` / `ScenesCube` / `ScenesCompose` /
   `ScenesH610B`), which are populated from assets/config at runtime. The packet framing
   and per-effect attributes (x, y, speed, direction, focus) are known; the raw blob bytes
   are not in the split.
2. **H7004 / H7017** only have the `0x0D` red/blue-ratio controller in this split.
   `Mode.a(goodsType,pactCode)` selects `SubModeRedBlue41/61/81` but `getWriteBytes()`
   returns `null`; the actual value write is `RedBlueController(ratio, reserved)` whose
   second byte is unset by all callers here. Detail UI/builder lives outside this split.
3. **Direction byte semantics** come from `BleProtocolConstants` (base app) and are shared;
   `h6104` writes one raw byte (`0x13`) and no per-family remap was found. Mapping of
   UI names to bytes for the car/TV lights is therefore generic.
4. **Transport is pact/goodsType dependent for `stringlightv2`.** The SKU list is known,
   but goodsType (1/40/108 = ble+iot vs 2/39/68/78/143 = ble) is a device property read at
   runtime; per-SKU goodsType is not encoded in this split.
5. **H6138/H6139 and other `NewRgb2TL4BleIot` SKUs** are classified ble+iot by the shared
   `h6159` IoT builders and `Ble.u()` ptReal override, but their own modules only ship BLE
   `EffectOp4Ble` (`supportWifi()==false`, `getRoomOp4Iot()==null`). The cloud path is
   exercised through the shared `ptReal`/`pt` commands.
6. **H6182** has an `iot/` package and `OpColorCommDialog4BleIot` but no `CmdPtReal`; only
   direct JSON commands were observed.
7. **`SubModeMusicV2` new music codes** (`AbsNewMusicEffect.newMusicCode4RgbList`) are a
   runtime list; encoding differs per code (`0E code sens` vs legacy form). Exact code
   set is not in the split.
8. **Notify parsing beyond `0x11`**: only WiFi-connect status is registered by
   `BleNotifyComm` in every family; other notify types in `BleProtocolConstants` are not
   handled in this split.
9. **Calibration for H6104** is IoT-only (`calibrationPoints`, `calibrationSnapshot`);
   no BLE calibration opcode other than H6101's `0x08`.
10. **`ptUrl` / `multiSync` / OTA** are not implemented in this split (only
    `0xEE` OTA-prepare handshake for h6160/stringlightv2).
