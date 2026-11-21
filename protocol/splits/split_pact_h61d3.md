# split_pact_h61d3 — neon rope / wall-lining / light-recognition family

Source root: `decompiled/jadx-splits/split_pact_h61d3/sources/com/govee/h61d3/`.

This split is the **neon rope / wall-lining / addressable light-recognition** family. Its defining
features are camera/video recognition to infer the physical shape of the rope, point-list import,
IC/segment mapping, and per-segment animations. It shares the standard 20-byte BLE frame and
`0x15` colour sub-mode with the other RGBIC light splits.

| goodsType | SKU(s) | product | colour size | scenes |
|---|---|---|---|---|
| 202 | H61D3, H61D2, H61D4, H61D5, H61D6 | Neon rope light | dynamic / `H1AB1AbsDiyPro` | `{0,1,2,3,5}` |
| 239 | H61E5 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 246 | H61E6 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 242 | H6640 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 247 | H6641 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 264 | H61B0, H61B3, H61B6 | Neon rope / wall lining | dynamic | `{0,1,2,3}` |
| 261 | H61F6, H61F2, H61F5 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 367 | H1A43, H1A44 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 375 | H1A45 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 384 | H1B6A | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 387 | H1AB1 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 388 | H1AB2 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 389 | H1AB3 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 400 | H1A42 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 403 | H1AA2 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 404 | H1AA5 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |
| 263 | H703A, H703B | Neon rope / wall lining | dynamic | `{0,1,2,3}` |
| 299 | H61B8, H61B9 | Neon rope / wall lining | dynamic | `{0,1,2,3,5}` |

Registration (`H61D3Support.a()`): each goodsType gets `(1,1)` plus `(2,1)` for most; 261 also
`(2,2),(3,1),(4,1)`; 299 `(2,2)`; 367 `(1,2),(1,3)`; 375/387/388/389/400/403/404 `(1,2)` where
noted. `pact/SubMaker` emits all 19 item makers (H61D3 appears twice). `H61D3Constants` holds the
SKU constants (`H61D2..D6`, `H61E5/E6`, `H6640/41`, `H61B0/B3/B6`, `H61F6/F2/F5`, `H61B8/B9`,
`H1B6A`, `H1A42..45`, `H1AB1..3`, `H1AA2/5`, `H703A/B`).

---

## 1. Transports & GATT UUIDs

- service `00010203-0405-0607-0809-0A0B0C0D1910` (uppercase in source, same UUID)
- characteristic `00010203-0405-0607-0809-0A0B0C0D2B11`

Sources: `ble/BleComm.java` (`Q`/`V`, `Controller4Heart` for heart), `ble/BleMultiComm.java`
(re-creates UUIDs per call). `Ble` is a standard `AbsBle` with `CommEventGattCallback`.
Notify list: `WifiNotifyParse` (0x11), `TakePhotoNotifyParse` (0x26), `DeviceStatusNotifyParse`
(0x30), `DeviceInfoNotifyParse` (0x30), `VideoRecognitionNotifyParse` (0xED).

BLE frame: 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC`. Multi-frame writes
(`0xA3`, `0x5C`-style) via `MultipleControllerCommV1`/`Compose4DefWrite` for recognition/DIY.

---

## 2. BLE frame + command table

`ble/BleProtocol.java`:

| constant | value | meaning |
|---|---|---|
| `b` / `c` | -79 / -78 (`0xB1`/`0xB2`) | secret key read/write |
| `d` | 5 / `0x05` | mode container |
| `e` | 21 / `0x15` | colour |
| `f` | 19 / `0x13` | music |
| `g` | 4 / `0x04` | scenes |
| `h` | 10 / `0x0A` | new DIY |
| `i` | -93 / `0xA3` | gradual / multi write |
| `j` | -91 / `0xA5` | colour/brightness read |
| `k` | 36 / `0x24` | take photo / read IC point |
| `l` | 38 / `0x26` | take photo / exit |
| `m` | -19 / `0xED` | video/photo recognition |
| `n` | 32 / `0x20` | WiFi hard version request? |
| `o` | -94 / `0xA2` | (reserved) |
| mutable `p` | `H1AB1AbsDiyPro.i` = 34 | DIY protocol code |
| mutable `q` | 66 / `0x42` | check IC? |
| mutable `r` | 64 / `0x40` | read IC |
| mutable `s` | 70 / `0x46` | check IC (notify) |
| mutable `t` | 67 / `0x43` | check IC (write) |

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] 1..100` | base `BrightnessController` |
| colour / mode | `0x33/0x05` | sub `0x15` 17-byte layout below | `adjust/color/SubModeColor.java`, `ble/ModeController` |
| music | `0x33/0x05` | sub `0x13` | `adjust/music/SubModeMusic.java` |
| scenes | `0x33/0x05` | sub `0x04` + direction/segment extras | `adjust/scene/SubModeScenes.java` |
| DIY | `0x33/0x05` | sub `0x0A` code LE16 | `adjust/diy/SubModeNewDiy.java` |
| check IC | `0x33/0x46` | payload per `CheckIcController.q()` | `ble/controller/CheckIcController.java` |
| read IC | `0xAA/0x40` | range/index | `ble/controller/ReadIcController.java` |
| read IC point | `0xAA/0x24` | point request | `ble/controller/ReadIcPointController.java` |
| secret key read | `0xAA/0xB1` | empty | `ble/controller/SecretController.java` |
| secret key write | `0x33/0xB2` | 8-byte base64-decoded key | same |
| SN read | `0xAA/0x07` | `{2}` | `ble/controller/SnController.java` |
| soft/hard version | `0xAA/0x07` | sub-command | `ble/controller/SoftHardController.java` |
| take photo | `0x33/0x26` | `01 64 FF FF 00` (on) / `00` (off) | `ble/controller/TakePhotoController.java` |
| video recognition | `0x33/0xED` | `{1}` stop / `{0, lo, hi}` start with duration LE16 | `ble/controller/VideoRecognitionController.java` |
| light recognition multi | `0xA3` multi | `[index][RGB][countLE16][r][g][b][on][n][RGB x n]` | `ble/controller/LightRecognitionMultiController.java` |
| WiFi MAC | `0xAA/0x14` | empty | `ble/controller/WifiMacController.java` |
| WiFi soft | `0xAA/0x21` | empty | `ble/controller/WifiSoftController.java` |
| WiFi hard | `0xAA/0x20` | empty | `ble/controller/WifiHardController.java` |
| multi / compose | multi | `MultiController` with caller command type | `ble/controller/MultiController.java` |

### Colour payload (`adjust/color/SubModeColor.getWriteBytes`, 17 bytes)

```
[0]=0x15
mode 1 (RGB): [1]=1 [2..4]=R G B [5..6]=Kelvin LE16 [7..9]=temp RGB [10..13]=32-bit segment mask
mode 2 (brightness): [1]=2 [2]=brightness [3..6]=32-bit segment mask
```
Parse: `[0]` type, `[1..2]` Kelvin LE16.

### Scenes payload (`adjust/scene/SubModeScenes.getWriteBytes`)

```
04 <effectLo> <effectHi> <dir1> <dir2> [<colorCount> <r0><g0><b0> ...]
```
`dir1/dir2` come from `SubEffect4LiuDong.Companion.b((byte) direction)`; optional per-segment
colours follow. Parse: effect LE16 from `[1][0]`, direction from `[2],[3]`.

### Music payload (`adjust/music/SubModeMusic.getWriteBytes`)

```
default: 13 <code> <sens>
code 3:  13 03 <sens> <dynamicFlag> <autoFlag> [R G B]  (8 bytes)
```
Sensitivity 0..99. Music codes default to code 3 (the UI's "3" effect) with auto colour.

### DIY / recognition

- `0A <diyLo> <diyHi>` for DIY.
- H61DX advanced protocol `0x58`, graffiti protocol `0x03`.
- H1AB1 protocol `0x22` (`H1AB1AbsDiyPro.i = 34`), share code `0x00` effects.
- `LightRecognitionMultiController` uses `MultipleControllerCommV1.makeSendBytesV1(0xA3, 0x5D, data)`
  (default sub-type `93`; override available) and body
  `[index][R G B][u16][b1][b2][b3][on][n][RGB×n]`.

---

## 3. BLE notifications / readings

| reading | op | layout | source |
|---|---|---|---|
| WiFi connect | `0x11` | `[0]==0` connected | `ble/WifiNotifyParse.java` |
| light status | `0x30` | `[0]==1`, `[1]` bit1 = on | `ble/DeviceInfoNotifyParse.java` |
| device status | `0x30` | base `DeviceStatusNotifyParse` | `ble/BleNotifyComm` |
| take-photo exit | `0x26` | event (button pressed) | `ble/TakePhotoNotifyParse.java` |
| video recognition state | `0xED` | `[0]` state code; second arg = mode (1) | `ble/VideoRecognitionNotifyParse.java` |
| IC / segment | `0x46` | `CheckIcController` result | `ble/controller/CheckIcController` |
| read IC | `0x40` | IC count from bytes | `ble/controller/ReadIcController` |
| read IC point | `0x24` | `[0]==1` point present | `ble/controller/ReadIcPointController` |
| secret key | `0xB1` | `[0]==1` + 8-byte key (base64 in app) | `SecretController` |
| SN | `0x07` | `[0]==2` + 8-byte address | `SnController` |
| soft/hard | `0x07` | ASCII / bytes | `SoftHardController` |
| WiFi MAC/soft/hard | `0x14`/`0x21`/`0x20` | ASCII/bytes | `Wifi*Controller` |

Recognition points are `[x LE16][y LE16]` pairs; `H61D3Support.f(pointList)` serialises
`count LE16` + `x,y` pairs for upload. Point lists are stored/imported through
`network/ApiService` (`/device/.../points`, `RecognitionPointInfo{sku,device,points}`).
`VideoRecognitionResult`/`VideoRecognitionStateEvent` carry recognition status.

---

## 4. IoT commands + status/readings schema

Envelope **`IotMsgV2`**. `iot/CmdPtReal` is the only per-family IoT class (base turn/brightness/
colorwc are used by the `Op*CommDialog` classes). `CmdPtReal`:

```json
{"cmd":"ptReal","data":{"command":["<base64 20-byte>", ...]}}
```
Constructors accept a single `AbsController`, a list of byte arrays, or an array of controllers.
`makeCmdPtReals(List<byte[]>)` adds all. Status uses base `state/op`; `op.pt[]` frames are decoded
by the colour/scene/music parsers. Recognition/point state is cloud-side (`network/entity/*`).

---

## 5. Other protocols

- **Camera / image recognition** — `adjust/recognition/CameraActivity`,
  `ImageRecognitionActivity`, `VideoRecognitionActivity/V2`, `adjust/viewmodel/VideoRecognitionViewModel`,
  `adjust/recognition/native/H61DXNativeLib` (shape recognition).
- **Point list import/export** — `network/ApiService` (+ `ApiServiceKt`), `PointListInfo`,
  `RecognitionPointInfo`; points serialised as `count LE16 + (x,y) LE16 pairs`.
- **Neon install / shape recommendation** — `adjust/install/*` (NeonShapeInstallActivity,
  RecommendShapeDetailActivity, NeonSceneShapeDetailActivity), `H703ACutCaliActivity`.
- **HTTP** — bind/install-guide video (`InstallGuideVideo`), device ext/bind info, version check.
- **BLE add flow** — `add/BleBroadcastProcessor`, `PairActivity`/`PairViewModel`.
- **No Matter/MQTT/LAN/IR/RF** in this split.

---

## 6. Dynamic effects / motion / music / scenes / DIY

### Colour (`0x15`)

17-byte `15 01/02 ...` with a up-to-32-segment mask; colour size is runtime IC-derived
(`H61D3Support.getBulbStringMaxNum` always returns 14 for the bulb-string helper, but the device
reports its real IC/segment count over `0x46`/`0x40`). Supports per-segment brightness and
per-segment colour via the same mask.

### Music (`0x13`)

`13 <code> <sens>`; code 3 uses the extended 8-byte form with dynamic/auto flags + RGB.
Sensitivity 0..99. Codes are base `IMusicEffectStatic` IDs; H61D3 adds nothing family-specific.

### Scenes (`0x04`)

`04 <effect LE16> <dir1> <dir2> [count colors...]`. Direction pair comes from
`SubEffect4LiuDong` (flow direction). Scene op set `{0,1,2,3,5}` (or `{0,1,2,3}` for some goods
types); scene capabilities are version-gated (`checkShareEffectVersion`).

### DIY (`0x0A`)

- H61DX: basic effect codes `691` (basic) and `625` (graffiti); protocol `0x58` advanced,
  `0x03` graffiti. Advanced sub-effects: `Duiji`, `Jihe`, `Liudong`, `Suiji`, `Xianxing`
  (`AbsNewDiySubEffect`), with direction (`up/down/left/right`), speed, colour and layer params.
- H1AB1: protocol `0x22`, share code `0x00`, RGBIC graffiti share `0x08`; basic effect triples
  `[0,0,1]`, `[0,1,2]`, `[0,2,3]`, `[1,0,4]`, `[1,2,6]`, `[2,0,7]`, `[2,2,9]`, `[3,3,10]`,
  `[3,4,11]`, `[3,5,12]`, `[8,9,19]`, `[8,10,20]` … with speed range 1..100 (default 50) and
  colour indices `[1,8]`.
- H1A42/H1AB1/H1B6A/H61F6/H6640/H703A configs (`adjustNew/diy/*DiyConfig`) register the DIY-new
  managers for their goods types; H61DX is the only one with explicit 691/625 constants.
- Graffiti: H61DX `H61DXGraffitiParse` (protocol `0x03`) layers; H1AB1 `RgbIcGraffitiShare0x08`.

### Recognition

`LightRecognitionMultiController` writes the inferred point/colour list as a multi-frame `0xA3`
body; the camera/photo/video controllers start/stop recognition (`0x26`, `0xED`), and the
recognition result arrives as notify `0xED`. Point lists are also uploaded to the cloud and
replayed as normal colour/DIY frames.

---

## 7. Source map (traced)

- Registration/SKUs: `pact/{H61D3Support,SubLib,SubMaker,RegisterItem,Model,H*BleIotSkuItem}.java`,
  `H61D3Constants.java`
- Transport: `ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol}.java`
- Mode/sub-modes: `ble/{Mode,ModeController,Mode4ColorStrip}.java`,
  `adjust/color/SubModeColor.java`, `adjust/music/SubModeMusic.java`,
  `adjust/scene/SubModeScenes.java`, `adjust/diy/SubModeNewDiy.java`
- Controllers: `ble/controller/{CheckIcController,ReadIcController,ReadIcPointController,
  SecretController,SnController,SoftHardController,TakePhotoController,
  VideoRecognitionController,LightRecognitionMultiController,MultiController,
  WifiMacController,WifiSoftController,WifiHardController}.java`
- IoT: `iot/CmdPtReal.java`
- Recognition/points: `adjust/recognition/*`, `adjust/viewmodel/*`, `network/*`,
  `network/entity/*`
- DIY: `adjustNew/diy/*`, `adjustNew/diy/h1ab1/*`, `adjustNew/diy/h61dx/*`
- UI/install: `adjust/install/*`, `adjust/newdetail/*`, `adjustNew/*`

## 8. Gaps / unknowns

- Per-device colour/segment count is runtime (IC/segment read 0x46/0x40); the static
  `getBulbStringMaxNum` returns 14 for the bulb-string helper only.
- H61D3Support has two partially decompiled methods (`createNewScenesMode(String,String,SceneV1)`
  and `e(int,int,List)`) that throw `UnsupportedOperationException`; their exact branch logic is
  not recoverable here.
- H61DX basic effect 691/625 and H1AB1 share-code effects are explicit, but the full per-goodsType
  effect lists are DIY-new config/server driven.
- Recognition point payload is `count + x,y` pairs; the native shape-recognition algorithm is in
  `libh61dx` (not decompiled).
- Video recognition state codes (`0xED [0]`) are not named in this split; only the event is
  forwarded.
- Scene direction pair mapping is `SubEffect4LiuDong.Companion.b(byte)`; the byte↔direction table
  lives in the base library.
