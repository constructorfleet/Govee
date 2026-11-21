# split_pact_h705a — ceiling lights, downlights, H706x/H805x bulb strings, H3401

Source root: `decompiled/jadx-splits/split_pact_h705a/sources/com/govee/h705a/`.

This split covers the "H705/H706/H805/H806/H608/H808/H3401" light family: ceiling lights,
downlights, bulb strings and a segmented H3401 lamp. All SKUs use the same 20-byte BLE frame and
the standard Govee GATT pair; per-SKU differences are segment count, colour-temp range and the
DIY/music engine.

| goodsType | SKU(s) | product | colour-temp | segments | transports |
|---|---|---|---|---|---|
| 125 | H705A, H705B | Ceiling light | 2000–9000 K | 4 colours/group | ble + iot |
| 180 | H706A, H706B, H706C | Ceiling light | 2200–6500 K | from `SegmentIcDataConfig` | ble + iot |
| 184 | H806A, H806C, H801B | Ceiling light | 2000–9000 K | 5 colours/group | ble + iot + matter (H608/H808 family) |
| 240 | H705D, H705E, H705F, H805A, H805B, H805C, H805D, H608A, H808A | Ceiling / downlight | 2700–6500 K | 4 colours/group | ble + iot + matter (H608A/H808A) |
| 250 | H7067, H7068, H7069 | Bulb string / light string | 2700–6500 K | `ic` driven | ble + iot |
| 394 | H3401 | Segmented lamp | 1000–10000 K | `ic` driven | ble + iot |

Registration (`pact/Support.a()`): 125 `(1,1),(1,2)`; 180 `(1,1),(1,2),(2,1)`;
184 `(1,1),(2,1)`; 240 `(1,1),(1,2),(2,1)`; 250 `(1,1)`; 394 `(1,1)`.
`SubMaker` emits H705aItem, H706ABCItem, H608aItem, H705DEFH805ABCItem, H70676869Item,
H3401Item. `h705a/Cons` and `H705aApplication` register the module.

---

## 1. Transports & GATT UUIDs

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `ble/BleComm.java` static `P`/`Q`, `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`.
`Ble` is a standard `AbsBle` with `CommEventGattCallback`, a `BlePtRealMultiComm`
(`u()`), and multi-comm. H608A/H808A additionally support Matter commissioning via
`matterconfig/H808aMatterHelper` (goodsType 184; H608A soft ≥1.00.10, H608B/C ≥1.00.11,
H608D ≥1.00.18, H808A ≥1.00.19, hard 3.05.00, wifi soft 1.01.17, wifi hard 1.04.01).

---

## 2. BLE frame + command table

`AbsModeController` uses cmdType `0x05` for all mode payloads; colour/music/scene/DIY are
sub-modes carried inside the mode payload.

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] 1..100` | base `BrightnessController` |
| mode / colour | `0x33/0x05` | sub `0x15`, 17-byte layout below | `mode/color/SubModeColor.java` |
| music | `0x33/0x05` | sub `0x13` | `mode/music/SubModeMusic.java` |
| scene | `0x33/0x05` | sub `0x04` | `mode/scenes/SubModeScenes.java` |
| DIY | `0x33/0x05` | sub `0x0A` | `mode/diy/SubModeNewDiy.java` |
| IC count / segment check | `0x33/0x43` | `[0] mode, [1] index, [2] count` | `ble/controller/CheckIcController.java`, `BleProtocol.i=67` |
| cut calibration | `0x33/0x44` | `[0] 0/1/2`; mode 2 adds `[1] index,[2] count` | `ble/controller/CutCaliController.java`, `BleProtocol.j=68` |
| IC setting / segment num | `0x33/0x40` | `[0] value` | `ble/controller/ICSettingController.java`, `IcSegmentNumController.java`, `BleProtocol.f=64` |
| segment setting | `0x33/0x0F` | `[0] value` | `ble/controller/SegmentSettingController.java`, `BleProtocol.h=15` |
| multi segment IC write | multi | bytes from `SetSegmentIcMultiController.p()` with cmdType variable | `ble/controller/SetSegmentIcMultiController.java` |
| colour strip compose | `0x33/0x05` | `ColorPosSetController` / `BrightnessPosSetController` payload: `[0]=0x15, [1]=4/3, [2]=index, mask/RGB` | `ble/controller/ColorStripComposeController.java` |
| notify IC | notify `0x21` | `[0..1] IC LE16, [2] segment` | `ble/CheckIcNumParse.java`, `BleProtocol.g=33` |
| device info notify | notify `0x30` | `[0]==1`, `[1]` bit1 = on | `ble/notify/DeviceInfoNotifyParse.java` |

`BleProtocol` (`h705a/ble/BleProtocol.java`): sub music `0x13`, sub colour `0x15`, sub scene
`0x04`, sub DIY `0x0A`, IC setting `0x40`, notify IC `0x21`, segment setting `0x0F`, check IC
`0x43`, cut cali `0x44`, cut cali V2 `0x46`. (`0x43` is the check-IC write/response; `0x44` is cut-calibration; `0x46` (`k`) is the V2 cut-calibration variant.)

### Colour payload (`SubModeColor.getWriteBytes`, 17 bytes)

```
[0] = 0x15
mode 1: [1]=1 [2..4]=R G B [5..6]=Kelvin LE16 [7..9]=temp RGB [10..14]=5-byte segment mask (up to 40 segments)
mode 2: [1]=2 [2]=brightness [3..7]=5-byte segment mask
```
`parse()`: `[0]` mode; `[1..2]` Kelvin LE16.

### Music payload (`SubModeMusic.getWriteBytes`)

```
sub 0x13: [1]=music code [2]=sensitivity 0..99 [3]=mode (0x01) [4]=auto flag [5..7]=RGB
new multi-music short form: 13 <code> <sens>
```
New multi-music codes (`mode/music/MusicParams4H705A.b()`):
`49 (Cuican), 74 (Tiaodong), 72 (Yuedong), 81 (Liuying), 113 (Gundong), 50, 51, 52, 53, 55, 48`.
H706A/B/C use `CuiCanMusic4H706a` for code 49.

### Scenes / DIY

`04 epLo epHi`, `0A diyLo diyHi` — 16-bit LE. Scene op set is `{0,1,2,3}` for all SKUs.

---

## 3. BLE notifications / readings

| reading | op | layout | source |
|---|---|---|---|
| IC / segment | `0x21` | `[0..1]` LE16 IC count, `[2]` segment count | `ble/CheckIcNumParse.java` |
| light status | `0x30` | `[0]==1`, `[1]` bit1 = on | `ble/notify/DeviceInfoNotifyParse.java` |
| WiFi connect | `0x11` | `[0]==0` connected | base `WifiNotifyParse` |
| heart | `0x01` | base `HeartController` | `ble/BleComm` |
| check-IC result | `0x43` | `[0..1]` IC count, `[2]` segment | `CheckIcController.parseValidBytes` |
| cut-cali result | `0x44` | `[0] result, [1] index, [2] count` | `CutCaliController` |
| segment num | `0x40` | `[0..1]` LE16 IC count, `[2]` segment count | `IcSegmentNumController` |
| segment setting | `0x0F` | `[0] value` | `SegmentSettingController` |

No temperature/humidity sensors in this split.

---

## 4. IoT commands + status/readings schema

Envelope **`IotMsgV2`**. This split has **no per-family `iot/Cmd*.java`**; `pact/Comm` uses the
base `com.govee.base2light.iot` commands:

| cmd | data | response | source |
|---|---|---|---|
| `turn` | `{"val":0\|1}` | `state` | base `CmdTurn` |
| `brightness` | `{"val":1..100}` | `state` | base `CmdBrightness` |
| `colorwc` | `{"color":{"r","g","b"},"colorTemInKelvin":int}` | `state` | base `CmdColorWc` |
| `ptReal` | `{"command":["<base64 20-byte>",...]}` | `op.pt[]` | base `base2light.pact.iot.CmdPtReal` |

`pact/Comm.i()` builds DIY `ptReal` from a `DiyProtocol`/`DiyGraffitiV2`/`DiyTemplate`/
`DiyStudio`/`DiyAi`/`DiySendData`, always appending the final mode frame. `Comm.k()` builds a
**part-scene** `ptReal`: it groups `SegScenes` by `sceneCode`, builds a 16-bit segment mask
(`boolean[16]`), emits `PartScenesViewModel` scene writes, then appends `SubModePartScenes`
(`segId` + 5-byte per-segment selector). Max 19 commands for graffiti.

`Op*CommDialog4BleIot` / `Square` variants choose BLE+MQTT when the device has a topic,
otherwise IoT `ptReal`.

Status: base `state`/`op` schema; `op.pt[]` frames are decoded and parsed by the same BLE
parsers (IC count, colour, music, scenes). No additional sensor fields.

---

## 5. Other protocols

- **Matter** — H608A/B/C/D + H808A (goodsType 184) commissioning via
  `matterconfig/H808aMatterHelper`; version-gated. Runtime control stays BLE/IoT.
- **WiFi/LAN** — `Support.t()` registers dynamic-domain names H706A/H806A/H706B/H706C/H7067/
  H7068/H7069/H608A/H3401. MQTT capability is base `DeviceCommCapability`.
- **HTTP** — add/bind and OTA APIs in base; no family-specific net service here.
- **Multi-segment IC** — `SetSegmentIcMultiController` / `SegmentIcDataConfig` write the per-IC
  segment map; `h706abc/GraffitiSegmentSetAc` provides the UI.
- **No IR/RF/Thread** in this split.

---

## 6. Dynamic effects / music / scenes / DIY

- **Colour**: sub `0x15`, mode 1 RGB+kelvin+temp RGB+segment mask (up to 40 segments); mode 2
  brightness+mask.
- **Music**: sub `0x13`; new multi-music codes listed above; H706A/B/C special-case code 49.
- **Scenes**: sub `0x04`, 16-bit LE effect. Scene op set `{0,1,2,3}`.
- **DIY**: sub `0x0A`, 16-bit LE code, built by the DIY-new engine (`Sub4Diy`/`SubModeNewDiy`).
  H7067/8/9 sub-effects (`h706789/diy/subEffect/*`):
  BianHuan, BinFen, Breath, CaiQiang, Fade, Glimmer1/2, MengHuan, Mirror, Rainbow1/2, Ripple,
  Sawing1/2. H608A GIF sub-effect ids **1..18** (`adjust/h608a/SubEffectGifConfig`).
  H3401 uses the generic `DiyNewConfig` manager and segment/zone effects.
- **Segment colour**: `ColorStripComposeController` sends `15 04 idx RGB×4` (group) or
  `15 03 idx brightness[14]`; the `ColorPosSetController`/`BrightnessPosSetController` wrap
  these with a segment mask.
- **No motion/gradient direction attributes** exposed in this split; H3401 zones are static
  segment maps.

---

## 7. Source map (traced)

- Registration/SKUs: `pact/{Support,SubLib,SubMaker,Register4Item,Model,H*Item}.java`
- Transport: `ble/{Ble,BleComm,BleMultiComm,BleNotifyComm}.java`, `ble/notify/*`
- Mode/sub-modes: `mode/{Mode,ModeController}.java`, `mode/color/SubModeColor.java`,
  `mode/music/{SubModeMusic,MusicParams4H705A}.java`, `mode/scenes/SubModeScenes.java`,
  `mode/diy/SubModeNewDiy.java`
- Controllers: `ble/controller/{CheckIcController,CutCaliController,ICSettingController,
  IcSegmentNumController,SegmentSettingController,SetSegmentIcMultiController,
  ColorStripComposeController}.java`
- IoT: `iot/Op*CommDialog4BleIot*.java`, `pact/Comm.java`
- Per-SKU UI: `h3401/*`, `h706789/*`, `h608a/*`, `newDetail/*`, `adjust/v1/*`
- Matter: `matterconfig/H808aMatterHelper.java`

## 8. Gaps / unknowns

- `Support.b()` returns segment group size by goodsType/IC count; for 180 it reads
  `SegmentIcDataConfig` at runtime, so exact per-device segment counts are not static.
- H705A/H7067/H3401 DIY effect-code universes are managed by the base DIY-new engine; only the
  sub-effect class set and H608A GIF ids 1..18 are explicit here.
- `BleProtocol` exposes `0x43` (check-IC), `0x44` (cut-calibration) and `0x46` (cut-calibration V2); the
  write payload shape is `[mode,index,count]` but per-mode semantics vary by UI flow.
- Part-scene `SubModePartScenes` payload is built from `segId` + a 5-byte selector; the exact
  scene-body bytes come from `PartScenesViewModel` and are runtime/scene-server driven.
- Matter clusters/attributes are not in this split (commissioning only).
