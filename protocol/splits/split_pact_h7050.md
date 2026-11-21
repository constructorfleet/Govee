# split_pact_h7050 — H7050/H70xx outdoor & string-light family

Sources: `decompiled/jadx-splits/split_pact_h7050/sources/com/govee/...`
plus shared lighting code in `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/...`.

Paths are relative to `decompiled/`.

## 1. Overview / family and SKUs

This is a **large multi-SKU lighting split** with two source packages:

- `com.govee.h7050` — H7050…H8067 outdoor/string/bulb SKUs (all BLE+IoT).
- `com.govee.h7020` — H7020/H7015/H7029/H7030/H7033/H7041/H7042/H30D01/H3010…/H3001/R7015
  (a mix of **BLE-only** `AbsBleSku` and **BLE+IoT** `AbsBleWifiSku`).

Every SKU is registered through `*/pact/SubMaker.java` and a
`pact/bleiot/BleIotMaker*.java` (BLE+IoT, extends `AbsBleWifiSku`) or a
`pact/ble/BleMaker*.java` (BLE-only, extends `AbsBleSku`).

Pact support is registered in `h7050/pact/Support.addSupportPact()` using
`GoodsType.beProtocol(type, code)`. `(1,1)` = BLE+IoT v1; `(2,1)` = v2;
`(1,2)/(1,3)` = later hardware revisions of the same SKU.

| SKU | goodsType | class / notes | pact protocols | transports |
|---|---|---|---|---|
| H7050 | 46 | permanent outdoor, 15 bulbs | (1,1) | ble, iot |
| H7051 | 105 | `MusicModeH351011.l == 105`; 24 bulbs | (1,1) | ble, iot |
| H7052 | 218 | 15 bulbs | (1,1),(2,1) | ble, iot, matter |
| H7053 | 219 | 30 bulbs, device lock | (1,1),(2,1) | ble, iot, matter |
| H7055 | 116 | 2 bulbs, 2200-6500K | (1,1) | ble, iot |
| H7057 | 274 | 4 bulbs | (1,1) | ble, iot, matter |
| H7058 | 275 | 6 bulbs | (1,1) | ble, iot, matter |
| H7060 | 76 | 2 bulbs, 2700-6500K | (1,1) | ble, iot |
| H7061 | 98 | 2200-6500K | (1,1) | ble, iot |
| H7062 | 107 | 6 bulbs | (1,1) | ble, iot |
| H7063 | 227 | 3 bulbs, lock, net reset | (1,1),(2,1) | ble, iot, matter |
| H7065 | 113 | 2 bulbs, 2200-6500K | (1,1) | ble, iot |
| H7066 | 171 | 1 bulb, 2200-6500K | (1,1) | ble, iot |
| H6087 | 77 | 2200-6500K | (1,1) | ble, iot |
| H6088 | 157 | RGBIC string | (1,1),(2,1) | ble, iot |
| H7045/H7046 | 338 | Hexa/Glide panels, music feast, Tuya variant | (1,1),(1,2),(1,3) | ble, iot, matter |
| H7037/H7038/H7039 | 221 | curtain/string; H7038/H7039 are aliases | (1,1),(2,1) | ble, iot |
| H7087 | 315 | 3 bulbs | (1,1) | ble, iot, matter |
| H7093 | 289 | 2 bulbs | (1,1) | ble, iot, matter |
| H7094 | 290 | 4 bulbs | (1,1) | ble, iot |
| H8066 | 305 | 3 bulbs (commercial) | (1,1) | ble, iot |
| H8067 | 393 | 6 bulbs (commercial) | (1,1) | ble, iot |
| H3500 | 345 | 8-bulb string | (1,1) | ble, iot, matter |
| H3501 | 339 | 8-bulb string, install calibration | (1,1) | ble, iot, matter |
| H3510/H3511 | 349 | string light | (1,1) | ble, iot, matter |
| H3200 | 353 | lamp | (1,1) | ble, iot |
| H1630 | 364 | cube/hexa lamp, graffiti | (1,1),(1,2),(1,3) | ble, iot, matter |

`Support.I/J` (arrays of goodsTypes) are the device-list and scene-support lists.
`Support.getBulbStringMaxNum()` and `getColorPieceSize()` give per-SKU segment counts
(15/24/30/2/6/3/4/8/11/20… see table above).

### 1.3 `com.govee.h7020` SKUs (same split)

| SKU | goodsType | maker / transport | pact protocols |
|---|---|---|---|
| H7020 | 53 | `bleiot/BleIotMaker` — ble+iot | (1,1),(2,1) |
| H7021 | 54 | `bleiot/BleIotMakerV2` — ble+iot | (1,1) |
| H7015 | 62 | `ble/BleMaker` — **ble only** | (1,1) |
| H7016 | 63 | `ble/BleMakerV2` — **ble only** | (1,1) |
| H7041 | 100 | `bleiot/BleIotMakerH7041` — ble+iot | (1,2) |
| H7042 | 102 | `bleiot/BleIotMakerH7042` — ble+iot | (1,2) |
| H7029 | 149 | `ble/BleMakerH7029` — **ble only** | (1,1) |
| H7033 | 161 | `bleiot/BleIotMakerH7033` — ble+iot | (1,1),(1,2) |
| H7030 | 295 | `bleiot/BleIotMakerH7030` — ble+iot | (1,1) |
| H7025 | 296 | `bleiot/BleIotMakerH7025` — ble+iot | (1,1) |
| H702A/H702B/H702C | 316 | `bleiot/BleIotMakerH702ABC` — ble+iot | (1,1) |
| H7026 | 318 | `bleiot/BleIotMakerH7026` — ble+iot | (1,1) |
| H7027 | 337 | `bleiot/BleIotMakerH7027` — ble+iot | (1,1) |
| H3001 | 361 | `ble/BleMakerH3001` — **ble only** | (1,1),(1,2),(1,3),(1,4) |
| H30D01 | 391 | `bleiot/BleIotMakerH30D0` — ble+iot | (1,1) |
| H3010/H3011/H3012/H3013 | 411 | `bleiot/BleIotMakerH3010123` — ble+iot | (1,1) |
| R7015 | 416 | `ble/BleMakerR7015` — **ble only** | (1,1) |

`h7020/pact/Support` registers these in `addSupportPact()`; `Support.M` is the
device-list subset `{62,63,149,361,416}` (the BLE-only ones) and the `keys()`
arrays `Q/R` enumerate the rest. The `h7020` BLE protocol is identical in
sub-mode numbering (`0x15` colour, `0x04` scenes, `0x0A` DIY, `0x13` music,
`0x05` mic) and uses the same GATT UUIDs (`h7020/ble/BleComm.java`).

## 2. Transports & GATT UUIDs

`h7050/ble/BleComm.java`:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

`BleMultiComm` uses the same pair. `h7050/ble/Ble.java` is the `AbsBle` singleton.

IoT uses `ptReal` for all effect writes; simple state uses native `turn`/`brightness`/
`colorwc`. Matter is available on the SKUs marked above (helpers listed in
`adjust/h7063/H7063MatterHelper.java`, `newdetail/h7045/H7045MatterHelper.java`,
`H7057/H7087/H7093/H3501` and `H1630/H351011` configs).

## 3. BLE frame + command table

20-byte frame `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR`.
Single commands write with `0x33`, read with `0xAA`. Multi-controller writes use
`proType=0xA3` (`MultipleControllerCommV1`).

| Command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `01/00` | [0] state | base `SwitchController` |
| brightness | `0x33/0x04` | `0..100` | [0] | base `BrightnessController` |
| mode container | `0x33/0x05` | sub-mode bytes | see §7 | `h7050/ble/ModeController.java` |
| segment setting | `0x33/0x40` | `totalLo totalHi total` | total = bulbNum × perBulb | `h7050/ble/SegmentSettingController.java` |
| power-on order | `0x33/0x30` | `order` | [0] order mode | `h7050/ble/PowerOrderController.java` |
| cut calibration | `0x33/0x44` | `01 f` | [1] cut index | `h7050/ble/CutCaliController.java` |
| bulb-string colour read | `0xAA/0xA5` | `index` | read: `BulbGroupColor.parseBytes` | `h7050/ble/BulbStringColorController.java` |
| multi-music block | `0x33/0x41` | `len code sens …` | multi-colour music layers | `h7050/ble/MultiMusicController.java` |
| secret key write/read | `0x33/0xB2`, `0xAA/0xB1` | key bytes | 16-byte secret; base `SecretKeyController` defaults 0xB2 write / 0xB1 read | `h7050/scenes/BleSecretBuilderV1.java`, `base2light/ble/controller/SecretKeyController.java` |
| install calibration | `0x33/0x39` | `index` | H3501 only (`value_install_calibration_h3501=57`) | `h7050/pact/BleProtocol.java`, `newdetail/h3501/H3501CalibrationAc.java` |
| mic / rhythm | `0x33/0x05` | `05 00 r g b` | `[0]=5,[1]=0,[2..4]=point` | `h7050/ble/MicController.java` |

Multi-controller (`0xA3`) framing, from `base2light/ble/comm/MultipleControllerCommV1`:

- single-controller V1 (`makeSendBytesV1`): `[0]=0xA3 [1]=0 [2]=2 [3]=totalPkts [4]=cmdType [5]=? [6]=? [7..]=verify [15..18]=first 4 payload bytes`, then `[1]=seq` chunks with 17 payload bytes, final packet `[1]=0xFF`.
- V0 (`makeSendBytesV0`): `[0]=0xA3 [1]=0 [2]=0 [3]=pktCount+2 [4]=cmdType`, chunks 17 bytes, final `[1]=0xFF`.
- V2/V3 (`makeSendBytesV2`) prepend `[4]=cmdType [5]=param`; end packet `[1]=0xFF`.

The same `0xA3` frames are what `ptReal` carries.

## 4. BLE notifications / readings

`h7050/ble/BleNotifyComm.java` registers:

| proType | parser | reading |
|---|---|---|
| `0x11` | `WifiNotifyParse` | Wi-Fi connected = `[0]==0` |
| `0x20` | `BrightnessNotifyParse` | brightness = `[0]` (0–100) |
| `0x40` | base `DeviceStatusNotifyParse` | first 10 bytes of status frame |

Controller read-backs (`EventBrightnessNotify`, `EventSegmentSetResult`,
`EventBulbStringColor`, `EventCutCali`) operate on `validBytes` after header strip.

## 5. IoT commands + status / readings schema

Envelope: `Write/AbsCmdWrite`, `IotMsgProType.V0` for simple commands and `V2` for
the switch builder check (`IotSwitchCmdBuilderV1.parseMsg` uses `IotMsgV2` and tests
`cmd=="status"`).

| cmd | data | notes | source |
|---|---|---|---|
| `turn` | `{"val":0|1}` | power | `h7050/iot/CmdTurn.java` |
| `brightness` | `{"val":0..100}` | — | `h7050/iot/CmdBrightness.java` |
| `colorwc` | `{"color":{"r":R,"g":G,"b":B},"colorTemInKelvin":K}` | `color` XOR `colorTemInKelvin` | `h7050/iot/CmdColorWc.java` |
| `ptReal` | `{"command":["<base64 20-byte frame>",…],"isSetDynamic":bool}` | all mode/effect writes | `h7050/iot/CmdPtReal.java` |
| `status` | `{}` | read | `h7050/iot/Cmd.java` |
| `online` | — | event | `h7050/iot/Cmd.java` |
| `state` | — | read reply key | `h7050/iot/Cmd.java` |
| `op` | — | pt/op reply key | `h7050/iot/Cmd.java` |
| `pt` | raw command list | legacy passthrough | `h7050/iot/Cmd.java` |

`Cmd.getCmdReadParseKey(cmd)` returns `"op"` for `ptReal`, else `"state"`.

Status schema is not a typed class in this split; `NewDetailVM` reads `state`
(`onOff`, `brightness`) and `op` (`pt[]` BLE frames) and re-dispatches them into the
BLE controllers above.

## 6. Other protocols

- **Matter**: H7052/H7053 (`H705253MatterHelper`), H7063, H7057, H7087, H7093,
  H7045/H7046, H3500/H3501, H3510/H3511, H1630 (`MatterInterceptor` in their configs).
- **HTTP**: `net/H7020Api.java` (add/device metadata), no LAN/MQTT socket in this split.
- **BLE broadcast discovery**: `add/BleBroadcastProcessor.java`,
  `BleBroadcastProcessorV2.java` (pairing only).

## 7. Dynamic effects / motion / music / scenes / DIY

All effect traffic goes through `ModeController` (cmd `0x05`) and the sub-mode
dispatch in `h7050/ble/Mode.java`.

### 7.1 Colour / segment colour — sub-mode `0x15`

`h7050/ble/SubModeColor.getWriteBytes()`:

| flag | bytes | meaning |
|---|---|---|
| 1 | `15 01 R G B [kLo kHi R2 G2 B2] M0..M3/M5` | whole-strip colour. If temperature `b!=0`: 2-byte kelvin at [5..6] and temp RGB at [7..9]. Mask bytes start at 10; 4 bytes normally, 6 for H7037. |
| 2 | `15 02 colourIndex M0..M3/M5` | apply one colour to masked segments |
| 3 | `15 03 bri0 bri1 …` | per-segment brightness array (max 15) |

Mask bytes are bitfields LSB-first (`ctlLight2byte`). With more than 15 controllers
the app switches to `MultipleColorStripControllerV1` and sends a multi-packet colour
strip instead (`Support.f0 = 15`).

### 7.2 Scenes — sub-mode `0x04`

`SubModeScenes.getWriteBytes()` = `04 effectLo effectHi` (16-bit LE effect code).
Layered/new scenes are sent as an `0xA3` multi-packet blob whose final packet appends
`04 <code LE16>`; the layer blob comes from the cloud scene (`ScenesOp.parseScene`
→ `MultiNewScenesControllerV1..V10`, command byte 1/4/12 depending on version).
`Support.is2NewScenesMode()` / `isMultiScenes()` choose that path.

### 7.3 DIY — sub-mode `0x0A`

`SubModeNewDiy.getWriteBytes()` = `0A codeLo codeHi` (16-bit LE DIY code).
Multi-layer DIY is `0xA3` blob + `0A code` trailer, produced by
`CmdPtReal.getDiyCmdPt*` and `MultipleDiyInScenesController`,
`MultiDiyGraffitiController`, `AbsMultipleControllerV14DiyTemplate`.
H7037 uses `MultipleDiyInScenesController`, H7045/H1630 use graffiti parsers.

### 7.4 Music — sub-mode `0x13`

`h7050/adjust/ParamsSubMode4Music.java` selects the layout per goodsType:

| SKUs | layout |
|---|---|
| default / 227 new-music | `13 code sens` |
| H7065 (113) | `13 code sens [flag if 56/48]` |
| H7055 (116) | `13 code sens [dynFlag if 49]` |
| H6088 (157) | `13 code sens` |
| H7066 (171) | `13 code sens dynamic` |
| H7052/H7053 (218/219) | `13 code sens dynFlag autoFlag 00 00 [R G B]` |
| H7037 (221) | `13 code sens dynFlag autoFlag [R G B]` |

Sensitivity 0–99. Music codes in `h7050/ble/BleProtocol.java`:
`0`/`1` (power/soft), `48` sprout, `49` shiny, `52` piano keys, `56` rhythm,
`72` hopping, `73` rolling, `74` heart-beating, `81` luminous, `99` colorful,
`100` waves. New-music codes 48–55 are flagged by
`base2light/ble/music/AbsNewMusicEffect` (`newMusicCode4RgbList={48,49}`,
`newMusicCode4RgbicList={50..55}`).

Mic mode: `05 00 pointR pointG pointB` (`MicController`), plus `05 01` to enter
(`SubModeMic.getWriteBytes()`).

### 7.5 H7037 / H7045 / H1630 / H7020-group specific

- H7037: scene/DIY use `MultipleDiyInScenesController` with `DiySendData{a,b,c}`
  and `SubModeNewDiy`; scene layers use `H7037DiyParse` sub-effects
  Breath/Chase/Fade/Move/Rainbow/Retrace/Spray/Xiaoxiole.
- H7045/H7046: music feast + `H7045AdvancedParse` / `H7045GraffitiParse`,
  effect types in `newdetail/h7045/mode/diy/effect/EffectTypeH7045.java`
  (Normal, DriftFog, Dyeing, Fantasy, Flowing, Separate, StarLight) with
  `Direction` and `LineWidth` parameters.
- H1630: graffiti `H1630DiyProGraffitiParse`, layers
  CaiHong/DuiJi/FengChe/HuXi/HuanCai/JianBian/LiuGuang/LiuShui/LuoXuan/PaoMaDeng/
  ShanShuo/ShenShuo/TiaoYue/XingKong/YaoBai.
- H7020 group: `h7020/ble/SubModeMusic{,V2}` adds new-music codes
  `value_sub_mode_new_music_rhythm=3`, `spectrum=4`, `energy=5`, `scroll=6`;
  H7033/H7041 have their own new-music lists (`isH7033NewMusicCode`,
  `isH7041NewMusicCode`); H7025/H7027/H30D01/H3010123/H702ABC have dedicated
  DIY configs in `h7020/newDetail/**`.

### 7.6 Colour-temperature ranges

`Support.getColorTemRange()`:

- 2700–6500 K: 76, 157, 227, 274, 275, 289, 305, 290, 315, 338, 393, H3200
- 2200–6500 K: 77, 116, 171, 98, 107, 113
- 1000–10000 K: H3510/H3511 (349), H1630 (364)
- 2000–9000 K: H7050 (46), H7051 (105), H7037 (221)

## 8. Source map (traced)

- SKU registry: `h7050/pact/{Support,SubMaker,Comm}.java`,
  `h7050/pact/bleiot/BleIotMaker*.java` (27 makers), `pact/deviceitem/SubLib.java`;
  `h7020/pact/{Support,SubMaker,SubLib}.java`,
  `h7020/pact/bleiot/BleIotMaker*.java` (BLE+IoT), `h7020/pact/ble/BleMaker*.java`
  (BLE-only: H7015/H7016/H7029/H3001/R7015).
- BLE: `h7050/ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol}.java`,
  `h7050/ble/{Mode,ModeController,SubMode*}.java`,
  `h7050/ble/{SegmentSettingController,PowerOrderController,CutCaliController,
  BulbStringColorController,MicController,MultiMusicController}.java`;
  parallel `h7020/ble/*` with the same sub-mode numbering.
- Music variants: `h7050/adjust/{ParamsSubMode4Music,v3,v7,v8,v9,h7037,h7053,h7066}`.
- Scenes/DIY: `h7050/pact/Comm.java`, `h7050/iot/CmdPtReal.java`,
  `h7050/pact/bleiot/AbsEffectOp4BleIot.java`.
- IoT: `h7050/iot/{Cmd,CmdTurn,CmdBrightness,CmdColorWc,CmdPtReal}.java`,
  `h7050/scenes/Iot*CmdBuilderV1.java`.
- Effects: `h7050/newdetail/**/diy/*` (H7037, H7045, H1630, H7025, H30D01, H702abc).
- Notifications: `h7050/ble/{WifiNotifyParse,BrightnessNotifyParse}.java`.

## 9. Gaps / unknowns

- Scene effect IDs and layer blobs are cloud-supplied (`ScenesM`/`ScenesOp`), not
  statically enumerable in the split. Only the container (`04 <LE16>` + `0xA3`
  layer blob) is fixed.
- DIY code values are likewise cloud/local templates; the 16-bit trailer is fixed.
- `MultipleControllerCommV1` has several framing versions (V0/V1/V2/V3/MTU); the
  family chooses one per controller (`AbsMultipleControllerV1.p()`); byte-level
  framing for V1 is documented above, V0/V2/V3 differ in header fields.
- H7038/H7039 are aliases of H7037 (only theme icons differ).
- `getColorPieceSize` for H3510/H3511 is derived from IC count at runtime.
- The `h7020` group's five BLE-only SKUs (H7015/H7016/H7029/H3001/R7015) still
  register `GoodsType.beProtocol` pairs in `pact.a(...)`, but their maker extends
  `AbsBleSku`, so no cloud path is created in-app.
- H3001 also declares (1,2)/(1,3)/(1,4); the maker is still BLE-only.
