# split_pfdv1 — bulb strings (H7001 / H7023 / H7024)

> Note: the assignment described this split as “shared recognition/vision helpers”.
> That is **not** what the tree contains. `split_pfdv1` (the directory is
> `split_pfdv1`, not `split_pact_pfdv1`) holds two real product families:
> the **H7001/H7023 multi-bulb string** and the **H7024 multi-bulb string**.
> Both are BLE light devices with their own commands and effects, documented here.

Source root: `decompiled/jadx-splits/split_pfdv1/sources/`

---

## 1. Overview / family and SKUs

| SKU | goodsType | bulbs | protocol | transport | notes |
|---|---|---|---|---|---|
| H7001 | not declared in split (uses `AbsBleSku`) | 12 | H7001/H7023 (`Sku.java`) | ble | 12-bulb string; 6 scene types + snow on soft ≥ 10100 |
| H7023 | same | 6 | H7001/H7023 | ble | 6-bulb string; same protocol, snow only on V1 soft |
| H7024 | not declared (uses `AbsBleSku`) | 6 (4×6 layout per `h7024/detail/Support`) | H7024 (`BleProtocol`) | ble | 6-bulb string with per-bulb color, brightness, color-temp, two music effects |

Registries:
- `h700123/sku/Sku.java`: `a="H7001"`, `b="H7023"`, `e/g={H7001,H7023}`;
  `getBulbNum()` = 12 / 6; `isSupportSnow(version) = version >= 10100`.
  `SubMaker` registers `SkuH7001`, `SkuH7023`.
- `h700123/sku/NewDetailsConfig.java` also claims **H7024** in scene interceptors
  (`support()` checks `Sku.a`, `Sku.b`, `H7024Constant.a`), so the base new-detail
  scene UI is shared.
- `h7024/H7024Constant.java`: `a="H7024"`, `d={H7024}`; `getBulbNum()` = 6;
  `detail/Support.b()` returns `{4,6}` (4 columns × 6 rows).
- Both `Model`s extend `AbsDeviceMode4BleOldLib`; `DeviceItem`s extend `AbsBleItem`.
  `needBle` is implicit — **BLE only**, no IoT/cloud control path in this split.

---

## 2. Transports & GATT UUIDs

| item | H7001/H7023 | H7024 |
|---|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` | same |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` | same |
| multi-write | `AbsMultipleBleComm`, service/char same | same |
| frame | 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` | same |
| write | `0x33` | `0x33` |
| read | `0xAA` | `0xAA` |
| multi | `0xA5` (`AbsMultipleController`) | same |

`h700123/ble/BleComm.java`, `BleMultiComm.java`; `h7024/ble/BleComm.java`,
`BleMultiComm.java`, `BleNotifyComm.java`.
H7024 registers only `WifiNotifyParse` (cmd `0x11`, WiFi state) on the standard
service; H7001 has no `BleNotifyComm` (uses base notify handling).

---

## 3. BLE frame + command table

### 3.1 H7001 / H7023

`ble/BleProtocol.java`:
`sub_mode_color=8`, `sub_mode_mic=5`, `sub_mode_scenes=9`, `MSG_TYPE_READ_BULB_COLOR=-94 (0xA2)`,
`MULTI_SCENE=1`, `NEW_MODE_SCENE=9`.
Scene IDs: illumination 0, fade 1, raindrops 2, colorful 3, marquee 4, blinking 5,
snow 6 (V1 only).

| command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `on` | `[0]=0/1` | base `SwitchController`; `Comm.makeSwitchController4BleComm` |
| brightness | `0x33/0x04` | `level` | `level = 1 + (percent-1)*(42/100)` → **1..40** | `Comm.makeBrightnessController4BleComm`; `NumUtil.calculateProgress(40,1,pct)` |
| color (all segments) | `0x33/0x05` | `08 m0 m1 m2 R G B 00` | `[0]=8`; `[1..3]` 24-bit segment mask; `[4..6]` RGB; `[7]=0` | `adjust/SubModeColor.getWriteBytes` |
| music/mic select | `0x33/0x05` | `05 01` | `[0]=5,[1]=1` | `adjust/SubModeMic.getWriteBytes` |
| mic dynamic/mild | `0x33/0x05` | `05 03 flag` | `[0]=5,[1]=3,[2]=1 dynamic / 0 mild` | `ble/MicController.q` |
| scene mode on | `0x33/0x05` | `09 00×15` | 16 bytes; only `[0]=9` is used | `adjust/SubModeScenes.getWriteBytes` |
| read bulb colors | `0xAA/0xA2` | `group` | group 1..ceil(bulbs/4); response `[group, 4×RGB]` | `ble/ReadBulbColorController` |
| multi-scene write | `0xA5/0x01` | start `00 count 00`, then `index 16B`, end `FF` | payload `[code,effect,subEffect,speed,colorCount,colors…]` | `ble/ScenesModeController.g`; `MultipleControllerComm` |
| heart/read | `0xAA/0x01` | `[1]` | `[1]` per `AbsModeController.p()` | base |

Multi-scene model (`adjust/MultiSceneModel`): `code` (0), `effectType` (0..6),
`subEffectType` (0), `speed` (0..100, default 50), `colors` (RGB triples, default
red/blue/yellow/green or white for snow, up to 4). The frame is sent through the
generic `MultipleControllerComm.makeWriteMultipleBytes`:
start `[0xA5,0x01,0x00,count,0x00]`, chunks `[0xA5,0x01,index,16B]`, end
`[0xA5,0x01,0xFF]` with 300 ms between packets.

### 3.2 H7024

`h7024/ble/BleProtocol.java`:
`sub_mode_color=11`, `sub_mode_music=1`, `sub_mode_scenes=9`,
`SINGLE_BULB_NUM=15`, `MSG_TYPE_READ_BULB_COLOR=-94`,
`value_sub_mode_music_power=5` (dynamic), `value_sub_mode_music_soft=4` (mild).

| command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `on` | `[0]=0/1` (raw, not scaled) | `scenes/BleSwitchCmdBuilder` |
| brightness | `0x33/0x04` | `level` | `[0]=level` (no 1..40 scaling) | `scenes/BleBrightnessCmdBuilder` |
| color (all segments) | `0x33/0x05` | `0B R G B m0 m1 m2 00` | `[0]=11`; RGB at `[1..3]`; 24-bit segment mask at `[4..6]`; `[7]=0` | `adjust/mode/H7024SubModeColor.getWriteBytes` |
| music | `0x33/0x05` | `01 effect sensitivity` | effect 4 = soft/mild, 5 = dynamic; sensitivity 0..99 | `adjust/mode/SubModeMusic` |
| scene mode on | `0x33/0x05` | `09 (type+1) 00×15` | `[0]=9`, `[1]=sceneType+1` | `adjust/mode/SubModeScenes` |
| bulb count read | `0xAA/0x0F` | – | response `[count]` | `ble/BulbNumController` |
| bulb count write | `0x33/0x0F` | `count` | `[0]=count` | `ble/BulbNumController` |
| read bulb colors | `0xAA/0xA2` | `group` | response `[group, 4×RGB]` | `ble/ReadBulbColorController` |
| multi-scene | `0xA5/0x01` | same as H7001 | code = sceneType+1, effectType = sceneType | `scenes/Common.makeScene4BleComm`; `ble/ScenesModeController` |

H7024 color layout differs from H7001: **RGB first, then the mask** (H7001 is mask
first, RGB last).

---

## 4. BLE notifications / readings

| notify | parser | layout | source |
|---|---|---|---|
| `0x11` | `h7024/ble/WifiNotifyParse` | `[0]==0` → WiFi connected | H7024 only |
| `0x05` | mode read/notify | `[0]` sub-mode: 8 color → `[1..3]` RGB; 9 scene → `[1]` type; 5 mic | `Mode.parseSubMode` (both) |
| `0xA2` | `ReadBulbColorController` | `[0]` group, `[1..12]` 4×RGB | both |
| `0x01` | heart/switch | base read | both |
| `0x04` | brightness | base `BrightnessController` → `[0]` level | both |

H7001/H7023 `BleReadManager` re-reads bulb colors after a color/scene change when
the sub-mode transitions (color→color, scene→scene) so the UI shows per-bulb colors.

---

## 5. IoT commands + status/readings schema

**None.** Both families are pure BLE. There is no `iot/` package, no `Cmd`, no
`ptReal`, no status JSON in this split. `Info4BleIotDevice` is used only as a
generic detail-info container by the shared new-detail framework.

---

## 6. Other protocols

- **BLE broadcast / pairing**: `h700123` has no advert parser in this split;
  `h7024/add/H7024ConnectDialog` only connects to a scanned device. The shared
  `BaseBleProcessor` filters by SKU/protocol.
- **No Wi-Fi / MQTT / LAN / Matter** in this split.
- **REST**: none.

---

## 7. Dynamic effects / scenes / DIY

### H7001 / H7023

| mode | bytes | notes |
|---|---|---|
| color | `05 08 m0 m1 m2 R G B 00` | 24-bit segment mask (24 segments; 12/6 bulbs), RGB |
| scene select | `05 09 00×15` | scene index is sent via the multi-scene packet, not in this frame |
| music select | `05 05 01` | mic/music mode |
| mic dynamic/mild | `05 05 03 flag` | flag 1 = dynamic, 0 = mild |
| multi-scene | `A5/01` payload `00 effect subEffect speed colorCount R G B …` | `effect` 0 illumination,1 fade,2 raindrops,3 colorful,4 marquee,5 blinking,6 snow; `subEffect` 0; `speed` 0..100; colors are RGB triples |
| read colors | `AA/A2 group` | group 1..ceil(bulbs/4) |

Snow is only offered when `Sku.isSupportSnow(versionSoft)` (≥ 10100) →
`Scene4BleRhythmV1` (7 entries) instead of V0 (6 entries).

### H7024

| mode | bytes | notes |
|---|---|---|
| color | `05 0B R G B m0 m1 m2 00` | RGB first + 24-bit segment mask; `[7]=0` |
| music | `05 01 effect sens` | effect 4 mild / 5 dynamic; sensitivity 0..99 |
| scene | `05 09 type+1 00×15` | scene type 0..7 |
| multi-scene | `A5/01` payload `code effect subEffect speed colorCount colors…` | `code = type+1`, `effect = type`, default colors red/blue/yellow/green (or white for snow) |
| DIY / custom | built by shared `IDiyFuc` | not defined in this split |

Scene names (`SubModeScenes.ScenesType` / `BleProtocol` values):
illumination 0, fade 1, raindrop 2, colorful 3, marquee 4, blinking 5, snow 6,
sky 7 (H7024 constant only).

---

## 8. Source map

| area | paths |
|---|---|
| H7001 registry | `h700123/sku/{Sku,SkuH7001,SkuH7023,SubLib,SubMaker,Register4Item,DeviceItem,Model,NewDetailsConfig,Comm}.java` |
| H7001 BLE | `h700123/ble/{Ble,BleComm,BleMultiComm,BleProtocol,Mode,ModeController,MicController,ScenesModeController,ReadBulbColorController,BleReadManager}.java` |
| H7001 sub-modes | `h700123/adjust/{SubModeColor,SubModeMic,SubModeScenes,MultiSceneModel,ScenesConfig}.java` |
| H7001 scenes/builders | `h700123/scenes/*.java`, `h700123/sku/{AbsEffectOp4Ble,EffectOp4Ble}.java` |
| H7024 registry | `h7024/{H7024Constant,sku/*}.java` |
| H7024 BLE | `h7024/ble/*.java` |
| H7024 sub-modes | `h7024/adjust/mode/*.java` |
| H7024 scenes/builders | `h7024/scenes/*.java`, `h7024/detail/*` |

---

## 9. Gaps / unknowns

- **No shared “recognition/vision” code exists in this split.** If such helpers were
  expected, they are in `split_lib_recognition` (present in the repo), not here.
- H7001/H7023 goodsType is not declared in the split (`AbsBleSku` reads it from the
  cloud product), so `pactType/pactCode` cannot be stated statically.
- Brightness scaling differs: H7001 maps 1–100 % to 1–40, H7024 writes the raw
  value. The H7024 UI may pre-scale, but the builder does not.
- The 24-bit segment mask is sized for 24 segments even though H7001 has 12 bulbs and
  H7024 6; the extra bits are likely “per half-bulb” or ignored by firmware. Not
  verified.
- H7001 `ScenesModeController` does not set `MultiSceneModel.code` (stays 0), while
  H7024 sets `code = type+1`. This is an observable protocol difference between the
  two families.
- Snow/sky availability is capability/version-gated; the exact SKU→capability table
  is in the cloud product, not the split.
- H7024 `NewDetailVm` references IoT-style classes (`SubMode4Color`, `IotMsg`), but
  the model is `AbsDeviceMode4BleOldLib`; this is inherited framework code, not an
  IoT transport.
