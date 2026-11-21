# split_pact_h6062 — H6062/H606A strip, H610A, H610B light-wall strings

Source root: `decompiled/jadx-splits/split_pact_h6062/sources/com/govee/striplight/`.

Three product generations sharing the `striplight` package:

| goodsType | SKU(s) | product | colour engine | scenes op set | transports |
|---|---|---|---|---|---|
| 41 | H6062, H606A | RGBIC strip light | V1 `SubModeColor` (33 segments) | `{0,1,2,3}` | **ble + iot** |
| 80 | H610A | RGBIC strip / "Glide Music Wall Light" | V2 `SubModeColorV2` + `ModeV2` | `{0,1,6}` | **ble + iot** |
| 114 | H610B | Light-wall / matrix strip | V3 `SubModeColorV3` + `ModeV2` | `{0,5}` (local scene speed save) | **ble + iot** |

Pact registration (`pact/Support.addSupportPact`): 41 gets `(1,1),(1,2),(2,1),(2,2),(3,1),(4,1)`;
80 `(1,1)`; 114 `(1,1)`. `Pact V1/V2/V3` checks are per goodsType. Colour size:
H6062 `ic/3`, H610A `ConsV1.colorsNum`, H610B `14`. `getBulbStringMaxNum`: 19 default,
28 for pact `(3,1)`, 33 for `(4,1)`.

---

## 1. Transports & GATT UUIDs

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `ble/BleComm.java` (`V`/`W`), `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`.
`Ble` is a standard `AbsBle` with `BlePtRealMultiComm` (`u()`). The GATT comm selects
`HeartControllerV2` for pact 0/1 and `ComposeHeartController` for newer pact types.

Notify list: `WifiNotifyParse` (0x11), `BrightnessNotifyParse` (0x20), `CheckIcNumParse` (0x21),
`IcAndPieceNotifyParse` (0x22), `DeviceStatusNotifyParse` (0x30),
`MovieFeastOnOffNotifyParse` (0x54).

---

## 2. BLE frame + command table

`BleProtocol` (`ble/BleProtocol.java`):

| constant | value |
|---|---|
| `sub_mode_color` | 21 / `0x15` |
| `sub_mode_music` | 19 / `0x13` |
| `sub_mode_scenes` | 4 / `0x04` |
| `sub_mode_new_diy` | 10 / `0x0A` |
| `SINGLE_IC_NUM_AND_PIECE_NUM` | 64 / `0x40` |
| `SINGLE_IC_SEGMENT_NUM` | 65 / `0x41` |
| `SINGLE_WRITE_CHECK_IC` | 66 / `0x42` |
| `SINGLE_NOTIFY_IC` | 33 / `0x21` |
| `SINGLE_NOTIFY_IC_AND_PIECE` | 34 / `0x22` |
| `SINGLE_LIGHT_POS` | 49 / `0x31` |
| `SINGLE_LR_SWITCH` | 51 / `0x33` |
| `SINGLE_GRADUAL_CHANGE_4_WIFI_BLE` | -93 / `0xA3` |
| `SINGLE_SPECIAL_FUC` | -90 / `0xA6` |
| `MSG_TYPE_READ_BULB_COLOR` | -92 / `0xA4` |
| `BRIGHTNESS_NOTIFY_IC` | 32 / `0x20` |
| `SINGLE_BRIGHTNESS_4_PIECE` | 67 / `0x43` |

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] 1..100` | `pact/Comm.makeBrightnessController4BleComm` |
| colour / mode | `0x33/0x05` | sub `0x15`, 17-byte layout below | `ble/SubModeColor.java`, `SubModeColorV2/V3` |
| music | `0x33/0x05` | sub `0x13` | `ble/SubModeMusic.java`, V2/V3 |
| scenes | `0x33/0x05` | sub `0x04` effect LE16 | `ble/SubModeScenes.java`, V1/V2 |
| new DIY | `0x33/0x05` | sub `0x0A` code LE16 | `ble/SubModeNewDiy.java` |
| IC + piece num | `0xAA/0x40` | empty read | `ble/IcAndPieceController.java` |
| IC segment num | `0xAA/0x41` | empty read | `ble/IcSegmentNumController.java` |
| check IC | `0x33/0x42` | empty write; notify 0x21 | `BleProtocol.SINGLE_WRITE_CHECK_IC` |
| light position | `0xAA/0x31` | `p()={pos}` / write `[0] 0/1` | `ble/LightPosController.java` |
| L/R switch | `0x33/0x33` | `[0] 0/1/16/17` | `ble/SwitchLRController.java` |
| special / calibration position | `0x33/0xA6` | `p()={1}` read; write `{1, 0/1}` | `ble/Special4PositionCalibrationController.java` |
| gradual change | `0x33/0xA3` | `[0] 0/1` | `ble/Gradual4BleWifiController.java` |
| bulb-string colour read | `0xAA/0xA5` | `p()={index}` | `ble/BulbStringColorController.java` |
| colour-strip segment | `0x33/0x05` | `15 02 brightness mask` or `15 01 RGB kelvin tempRGB mask` | `ble/ColorStripController.java` |
| multi music | `0x41` multi | header + per-piece data | `BleProtocol.value_multiple_set_music=65` |
| new/abstract music | `0x33/0x05` sub `0x16` | `SubModeAbsMusic` body | `ble/Mode.java` (`b == 22`), base `SubModeAbsMusic` |

### V1 colour payload (`SubModeColor.getWriteBytes`, 33 segments)

```
15 01 R G B kelLo kelHi R2 G2 B2 m0..m4   (RGB+temp, 5-byte mask, 33 segments)
15 02 brightness m0..m4                  (brightness + mask)
15 03 idx b0..b13                        (14 brightness bytes)
15 04 idx R G B ×4                       (group RGB)
```

### V2/V3 colour

`SubModeColorV2`/`V3` wrap the compact `OpColor` encodings. `getWriteBytes()`:
- mode 2 (`r==2`): one-byte sub-type + selected-segment bytes (`i()`/`j()` helpers).
- mode 1 (`r==1`): per-zone colour/temperature write.
- V3 additionally calls `OpColor.makeBytes(...)` for the 0x0D extended colour form and chooses
  sub-type 2 for gradual/segment modes, 1 for all/temperature modes.

`ModeV2` maps sub-type `0x15` to `SubModeColorV2`, `0x13` to `SubModeMusicV3`, `0x04` to
`SubModeScenesV1`, `0x0A` to `SubModeNewDiy`. The V1 `Mode` additionally dispatches sub-type
`0x16` to `SubModeAbsMusic` (new/abstract multi-music), distinct from the simple `0x13` form.

### Music

V1 (`SubModeMusic.getWriteBytes`):
```
13 <code> <sens> <dynamicFlag> <autoFlag> [R G B]     (7 bytes)
13 04 <sens> <mode> <dynamic> <auto> [R G B]          (8 bytes for rhythm)
```
Codes: `0 Energy, 1 Rhythm dynamic, 2 Joy, 4 Rhythm, 6 Impact, 7 Jet, 8 Jump` plus H6062 new
codes (`isH6062NewMusicCode`), rendered by `SubModeMusicV2`. H610A uses
`SubModeMusicV3` (new RGBIC/RGB code list). Sensitivity 0..99.

### Scenes / DIY

`04 epLo epHi`, `0A diyLo diyHi` — 16-bit LE. H610B scene speed/direction are stored locally
(`SubModeScenesV2` has transient `b`/`c` for speed/direction) and applied via the V1 local-scene
builder `Support.isH610BLocalScenesMode`.

---

## 3. BLE notifications / readings

| reading | op | layout | source |
|---|---|---|---|
| IC / segment count | `0x21` | `[0..1]` LE16 IC count, `[2]` segment count | `ble/CheckIcNumParse.java` |
| IC and piece count | `0x22` | `[0]` sub_ic_1, `[2]` sub_ic_2 (17-byte valid buffer) | `ble/IcAndPieceNotifyParse.java` |
| brightness | `0x20` | `[0]` brightness | `ble/BrightnessNotifyParse.java` |
| device status | `0x30` | base `DeviceStatusNotifyParse` | `ble/BleNotifyComm.java` |
| movie feast on/off | `0x54` | `[0]==1`, `[1]` on/off | base `MovieFeastOnOffNotifyParse` |
| wifi | `0x11` | `[0]==0` connected | `ble/WifiNotifyParse.java` |
| bulb-string colour | `0xAA/0xA5` | `BulbGroupColor.parseBytes` → 4-bulb RGB groups | `ble/BulbStringColorController.java` |

`BleParser` decodes per-colour-mode reads:
- `BrightnessParse`: `[0]` group index, then 4 brightness values at stride 4.
- `ColorParse2`: `[0]` group index, then 4 RGB triplets at stride 4.
- `parseSpeed(sceneV1, effect)`: reads speed from effect byte 3 (default 100).

---

## 4. IoT commands + status/readings schema

Envelope **`IotMsgV2`**.

`iot/Cmd.java`: `state`, `op`, `online`, `turn`, `brightness`, `status`, `colorwc`, `ptReal`,
`pt`.

| cmd | data | response | source |
|---|---|---|---|
| `turn` | `{"val":0\|1}` | `state` | `iot/CmdTurn.java` |
| `brightness` | `{"val":1..100}` | `state` | `iot/CmdBrightness.java` |
| `colorwc` | `{"color":{r,g,b},"colorTemInKelvin":int}` | `state` | `iot/CmdColorWc.java` |
| `ptReal` | `{"command":["<base64 20-byte>",...]}` | `op.pt[]` | `iot/CmdPtReal.java` |
| `status` | `{}` | `state/op` | base |

`CmdPtReal` builders:
- `getDiyCmdPt(DiyProtocol)` → `MultipleDiyControllerV1` bytes + `0A <code>`.
- `getDiyCmdPt4Diy(AbsMultipleControllerV14Diy)` → multi bytes + `0A <code>`.
- `getDiyCmdPt4DiyGraffiti(DiyGraffitiV2)` → `MultiDiyGraffitiController` bytes + `0A <code>`;
  capped at 19 commands.
- `getDiyCmdPt4DiyStudio(...)` → multi template + `04 <effect>`.
- `getDiyTemplateCmdPt(...)` → multi template + `04 <effect>`.
- `getNewScenesCmdPtReal(...)` → multi scene + `04 <effect>`.
- `getMultiNewMusicMode4H6062/4H610A(...)` → `MultipleBleBytes.getMultipleWriteBytesV2` + music
  mode frame; `musicCode`/`musicSensitivity`/`opVersion` fields accompany `ptReal`.

Status: `state`/`op`; `op.pt[]` base64 frames are decoded by the family parsers. Colour-mode
reads (`0xAA/0x05`) return the current sub-mode and are parsed by `Mode.parseSubMode`.

---

## 5. Other protocols

- **BLE broadcast add** — `add/BleBroadcastProcessor`, V2/V3 connect dialogs, WiFi choose.
- **HTTP** — add/bind and OTA APIs in base; no family-specific net service.
- **Local scene speed save** — `Support.supportScenesSpeedSave(114)` and
  `ScenesSpeedManager` store speed per scene locally.
- **No Matter/MQTT/LAN/IR/RF** in this split.

---

## 6. Dynamic effects / music / scenes / DIY

### Colour (`0x15`)

- V1: 33-segment mask, `15 01/02/03/04` layouts (see §2).
- V2 (H610A): per-colour/zone compact `SubModeColorV2` with symmetry (`makeSubModeColor4Symmetry`)
  and gradient (`Gradual4BleWifiController`).
- V3 (H610B): `SubModeColorV3` uses `OpColor` bytes; supports per-segment relative brightness
  (`Support.supportSegmentRelativeBrightness`) and 14-bulb/segment groups.

### Music (`0x13`)

`SubModeMusic` (V1), `SubModeMusicV2` (H6062 new codes), `SubModeMusicV3` (H610A RGBIC/RGB).
Fields: code, sensitivity 0..99, dynamic flag, auto-colour flag, manual RGB. `SubModeMusicV2`
short form is `13 <code> <sens>`, extended `13 04 <sens> <dynamic>`. Sub-type `0x16` is the
new/abstract multi-music form (`SubModeAbsMusic`).

### Scenes (`0x04`)

V1 `SubModeScenes` (`04 epLo epHi`), V1/V2 subclasses persist effect locally. H610B builds local
scene controllers from `ScenesM` + stored speed/direction
(`ScenesOp.parseSceneV1H610BDetailAc`). Scene op sets: 41 `{0,1,2,3}`, 80 `{0,1,6}`,
114 `{0,5}`.

### DIY (`0x0A`)

H610B uses the DIY-new engine: `DiyParse4H610B` protocol code **4**, share code **41 (0x29)**.
Classes: `DiyEffect4H610B` (single effect), `H610BSingleEffect`, `H610BAdvancedEffect`
(per-layer effect codes), `H610BAdvance`/`H610BAdvancedUI`. H610A uses
`NewConfigManager4H610A` (base RGBIC/RGB config). No explicit fixed effect integers are exposed
in this split beyond the protocol/share codes.

---

## 7. Source map (traced)

- Registration/SKUs: `pact/{Support,SubLib,SubMaker,H6062Maker,H610AMaker,H610BMaker,Model}.java`
- Transport: `ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol,BleParser}.java`
- Mode/sub-modes: `ble/{Mode,ModeController,ModeV2,ModeControllerV2}.java`,
  `ble/SubModeColor{,V2,V3}.java`, `ble/SubModeMusic{,V2,V3}.java`,
  `ble/SubModeScenes{,V1,V2}.java`, `ble/SubModeNewDiy.java`
- Controllers: `ble/{BulbStringColorController,ColorStripController,IcAndPieceController,
  IcSegmentNumController,LightPosController,SwitchLRController,
  Special4PositionCalibrationController,Gradual4BleWifiController,MultiMusicController}.java`
- IoT: `iot/{Cmd,CmdTurn,CmdBrightness,CmdColorWc,CmdPtReal}.java`
- New detail/DIY: `newdetail/*`, `newdetail/newdiy/*`, `newdetail/scene/*`
- Add flow: `add/*`, `add/v2/*`, `add/v3/*`

## 8. Gaps / unknowns

- H6062/H610A/H610B per-device segment counts come from IC reports at runtime
  (`ConsV1.colorsNum`, `Support.colorSize`); only the group frame size is static.
- H610A/H610B DIY effect-code lists are managed by the base DIY-new config (`NewConfigManager4H610A/B`);
  only H610B protocol 4 / share code 41 are explicit.
- `SubModeColorV2`/`V3` `OpColor` byte encoding is in the base library; this split only selects
  the op type and passes colour/segment data.
- Local scene speed/direction (H610B) are transient values persisted via `ScenesSpeedManager`,
  not a fixed wire layout.
- Music code names come from `IMusicEffectStatic`/`AbsNewMusicEffect` in base, not from this split.
