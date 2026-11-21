# split_pact_h682021 — H6820 / H6821 curtain lights (square/planar DIY)

Source root: `decompiled/jadx-splits/split_pact_h682021/sources/com/govee/h682021/`

## Overview / family and SKUs

| SKU | goodsType | notes |
|---|---|---|
| H6820 | 279 | `Support.e(279)` = "H6820" |
| H6821 | 280 | `Support.e(280)` = "H6821"; `Support.b` = `[280]` |

- `Support.c` = `{280, 279}`; `pact/EffectOp.b()` returns `Support.a.c()`; DIY registered via
  `DiyM.t.a(...)`.
- `Support.b(i)` = 20 (colour pieces / columns), `Support.g(i)` = 4 (rows per page?),
  `Support.d("Curtain Lights")`.
- Geometry: curtain with **linear** (columns) and **planar/face** (2-D page) DIY modes;
  `DirectionType {NONE, UP_DOWN, UP_DOWN_JL_KS}`.
- Transport: `ble + iot`. `pact/DeviceItem extends AbsBleIotItem`, `pact/Model extends
  AbsDeviceModel4BleIot`, `Model.V()` = `"online"`.
- `Support.l()` saves mic support for 279/280.

## Transports & GATT UUIDs

- Service `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/BleComm.java` (also `com.govee.matter.pact.BleComm` is used as the generic comm in
  `Ble.r()`), `BleMultiComm` anonymous with the standard UUIDs.
- `Ble.u()` → `BlePtRealMultiComm`; `Ble.v()` → anonymous multiple comm.
- Notify: `Ble$generateNotify$1`; `ble/GattCallbackImp` for GATT events.
- Matter: `Ble.r()` returns `com.govee.matter.pact.BleComm` — this family reuses the Matter
  module's BLE comm wrapper (same UUIDs), not necessarily Matter pairing.

## BLE frame + command table

Frame `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`; write 0x33, read 0xAA;
effectPlay `CmdPtReal`/`ModeController` come from base `base2light/effectPlay/effect/mode`.

`ble/BleProtocol.java`:

| const | dec | hex | use |
|---|---|---|---|
| music | 19 | 0x13 | music sub-mode |
| color | 21 | 0x15 | colour sub-mode |
| scenes | 4 | 0x04 | scenes |
| DIY | 10 | 0x0A | new DIY |
| brightness notify | 32 | 0x20 | brightness |
| read/segment | 64 | 0x40 | segment info |
| laser/format | -79 / -78 | 0xB1 / 0xB2 | (shared effect ids) |
| auto-off | 36 | 0x24 | auto-off |
| music library | 75 | 0x4B | music library read |
| music library 2 | 113 | 0x71 | read |
| volume-base | 50 / 51 / 52 | 0x32/0x33/0x34 | volume/base light |
| movie feast | 84 | 0x54 | movie feast |
| device info | 7 | 0x07 | info |
| prompt | 101 | 0x65 | prompt |
| laser frame | -128 / -127 | 0x80/0x81 | status frames |
| -112 | -112 | 0x90 | (reserved) |
| operate | 12 | 0x0C | effect operate |

Derived commands:

| command | op | payload | response | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `[0]=0|1` | `0xAA/0x01` | base `SwitchController`; `pact/Comm.makeSwitchController4BleComm` |
| brightness | `0x33/0x04` | `[0]=0..100` | notify 0x20 | base `BrightnessController`; `iot/OpColorCommDialog4BleIot` |
| mode | `0x33/0x05` | sub-mode block | `0xAA/0x05` | base `effectPlay.ModeController`; `ble/Mode.java` |
| DIY multi | `0xA3/0x5B` | `makeSendBytesV3(0xA3, 0x5B, diyBytes, 97)` + final `0A <diy>` frame | multi result | `pact/Comm.makeDiyCmd4IotCommMulti` |
| scene multi | `0xA3/0x5B` | `makeSendBytesV3(0xA3, 0x5B, sceneBytes, 97)` + final `04 <effect>` | multi result | `pact/Comm.a()` |
| heart | `0xAA/0x01` | none | no-event | base `HeartControllerNoEvent` |

`MultipleControllerCommV1.makeSendBytesV3(proType=0xA3, commByte=0x5B, payload, chunkSize=97)`
is the family-specific multi-packet builder (note 97-byte chunk split, not the default 17).

### Sub-mode payloads

Colour (`ble/SubModeColor.java`, id 0x15) — **different from h6047** (no segment mask):

```
[0]=0x15 [1..3]=R G B [4..5]=kelvin LE16 [6..8]=background/second R G B
```

`parse()` reads `[1..3]` RGB, `[4..5]` kelvin, `[6..8]` second RGB.
Default kelvin range 1000–10000 K (`Constant.getTemColorByKelvin(i,{1000,10000})`).

Scenes (`ble/SubModeScenes.java`, id 0x04): `[0]=04 [1..2]=effect LE16 [3]=musicCode`.
(Note the extra music byte, unlike h6047.)

New DIY (`ble/SubModeNewDiy.java`, id 0x0A): `[0]=0A [1..2]=diyCode LE16`.

Music (`ble/SubModeMusic.java`, id 0x13): `[0]=13 [1]=musicCode [2]=sensitivity (0..99)`.
Default effect code 101.

## BLE notifications / readings

Parsers are assembled by the base effectPlay detail; the family exposes brightness notify
0x20 and generic device status. `Ble$generateNotify$1` plus `LaserDefParser`-style parsers in
base effectPlay. Colour parse callback:

```
parse: [1..3]=R G B, [4..5]=kelvin LE16, [6..8]=second R G B
```

## IoT commands + status/readings schema

`iot/OpColorCommDialog4BleIot`, `OpColorCommDialog4SquareBleIot`, `OpColorCommDialog4BleIot`,
`OpDiy*`, `OpScene*`, `OpColorCommDialog4SquareBleIot` use base classes
`AbsOpCommDialog4BleIot`/`V2`. BLE frames are sent through `CmdPtReal` (`effectPlay`).

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0|1}` (base `CmdTurn`) | `iot/OpColorCommDialog4BleIot` (switch constructor) |
| `brightness` | `{"val":0..100}` (base `CmdBrightness`) | `iot/OpColorCommDialog4BleIot` constructor |
| `colorwc` | `{"color":{r,g,b},"colorTemInKelvin":int}` (base `CmdColorWc`) | `iot/OpColorCommDialog4BleIot` |
| `ptReal` | `{"command":["<base64 frame>"]}` | `effectPlay.effect.mode.CmdPtReal` |
| `online`/`status` | `state` on/off, `op` frames | `pact/Model.V()` = "online" |

`OpColorCommDialog4BleIot` builds a `BrightnessController` + `CmdBrightness(i,0,2)`, a
`SwitchController` + `CmdTurn`, or a colour mode controller + `CmdColorWc`.

## Other protocols

- **Image recognition / mapping** (curtain layout): `network/ApiService.java`,
  `ApiServiceKt.java`, `LightPointInfo`, `PointListInfo`, `RecognitionPointInfo`,
  `vm/VM4H682X.sendImageRecognition(...)` — uploads a photo to identify light points and
  build the planar mapping.
- Matter: `Ble.r()` returns `com.govee.matter.pact.BleComm` (shared comm class).
- WiFi/cloud IoT through base `Iot` manager.

## Dynamic effects / motion / music / scenes / DIY

- **Scenes**: `Support.k(str, mode)` → `ScenesM.p.p(str, effect)` →
  `ScenesOp.parseSceneV1(str, scene, {1,10})`; channels `Support.m()` = `{0,1,5}`.
  Morning scene uses `{1,10}` and falls back to a `SubModeScenes` frame.
- **DIY payload** (`diy/Pro4H682xDiy.java`):
  ```
  [0]=effect type (1 linear page, 2 face/planar page)
  [1..2]=payload length LE16
  [3]=page count
  [4]=rule (Pro4H682xDiy.b; 0..4)
  then pages, each with their own LP16 length:
  ```
  Inner blob from BLE is expected to start with `0x4B (75)` then type 1/2
  (`Pro4H682xDiy.Companion.c`).
- **Linear page** (`diy/H682xPageDiyLinearEffect.c()`), in order:
  ```
  length LE16,
  effectType (a), [subtype (b) if a==1], colorType (c) (=2 means solid → 0 else d),
  e, f, g (pre-serialised sub-effect bytes), h, i, j, k,
  colorCount, {R,G,B}*colorCount, m, n[0..1] (direction/mirror),
  o, p, if p!=1: {q, [r if q==7], s}
  ```
  Direction map (`H682xPageDiyLinearEffect.Companion.a`) and
  `H682xPlanarDirectionConfig.directionMap` provide 14 planar direction codes.
- **Planar direction codes** (`diy/H682xPlanarDirectionConfig.java`):
  `b(upDownFlag, dirType)` maps to bytes 0..13:
  (1,1)→2, (1,0)→3, (0,1)→0, (0,0)→1, (1,3)→4, (0,3)→5, (1,2)→6, (0,2)→7, (0,4)→12,
  (0,5)→13, (0,7)→8, (0,6)→9, (0,9)→10, (0,8)→11. Default 2.
- **Sub-effects** (`diy/SubXianxing`, `SubLiudong`, `SubJihe`, `SubDuiji`, `SubSuiji`):
  linear (Xianxing), flow (Liudong), geometry (Jihe), stacking (Duiji), random (Suiji).
- **Music**: sub-mode 0x13 with musicCode + sensitivity; `MusicMode4H682x` UI.
- **Segment colour mode**: `adjust/delegate/H682XSegmentColorMode` / `H682XSegmentColorModeKt`
  (per-segment colour preview).
- **GIF/scrawl**: `GifId.java`, `diy/H682xCircleGraffitiParse`, `H682xPageDiyFaceEffect`.
- **Speed configs**: `SpeedInfoLinearH682x`, `SpeedInfoPlanarH682x`,
  `SpeedInfoConfigH682x`.

## Source map

- `Support.java`, `pact/SubLib.java`, `Comm.java`, `Model.java`, `DeviceItem.java`,
  `Register4Item.java`, `EffectOp.java`, `AbsEffectOp4BleIot.java`, `BleIotExt.java`,
  `BleWifiBindExt.java`
- `ble/Ble.java`, `BleComm.java`, `BleProtocol.java`, `Mode.java`, `SubModeColor.java`,
  `SubModeScenes.java`, `SubModeNewDiy.java`, `SubModeMusic.java`, `GattCallbackImp.java`,
  `controller/ModeController.java`, `DiyModeComposeController.java`
- `pact/Comm.java`, `pact/SubLib.java`
- `diy/Pro4H682xDiy.java`, `H682xPageDiyLinearEffect.java`, `H682xPageDiyFaceEffect.java`,
  `H682xPlanarDirectionConfig.java`, `H682xDiyParse.java`, `Sub*.java`
- `iot/Op*CommDialog4BleIot*.java`, `network/*`, `vm/VM4H682X.java`, `adjust/*`

## Gaps / unknowns

- `makeSendBytesV3(..., 97)` chunk size 97 is unusual; the exact reassembly rule across
  packets is in `MultipleControllerCommV1` (base) and depends on MTU.
- Linear/planar page field names are obfuscated single letters; order is exact but semantic
  names (speed/brightness/direction/mirror) are inferred from UI mapping.
- `Ble.r()` using `com.govee.matter.pact.BleComm` implies a shared Matter comm class, but no
  Matter cluster/attribute mapping was found in this split.
- Image-recognition API request/response schema lives in `network/ApiService` annotations;
  server-driven point mapping is runtime.
- `Support.b(i)`/`g(i)` constants (20, 4) are layout hints, not verified against every SKU.
