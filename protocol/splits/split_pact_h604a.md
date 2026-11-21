# split_pact_h604a — H604A/B/C/D bulb strings & camera-calibrated strip lights

Source root: `decompiled/jadx-splits/split_pact_h604a/sources/com/govee/h604a/`.

A four-SKU light family split into two protocol generations:

| goodsType | SKU | product | scenes | bulbs | transports |
|---|---|---|---|---|---|
| 95 | H604A | RGBIC bulb string (camera-calibrated) | op set `{1,6}` (V1) | 24 bulbs | **ble + iot** |
| 122 | H604C | RGBIC bulb string | `{1,6}` (V1) | 24 bulbs | **ble + iot** |
| 109 | H604B | RGBIC bulb string (layout import / 14 bulbs) | op set `{0,1,2,3}` (V2) | 14 bulbs | **ble + iot** |
| 133 | H604D | RGBIC bulb string | `{0,1,2,3}` (V2) | 14 bulbs | **ble + iot** |

`Support.addSupportPact()` registers all four with `beProtocol(1,1)`;
`isH604aType = 95|122`, `isH604bType = 109|133`. `isPactV2` selects V2 for 109/133.
`getBulbStringMaxNum`: 24 for H604A/C, 14 for H604B/D. Colour temp 2200–6500 K.
Camera calibration / layout points are a defining feature (add flow and `newdetail/vm`).

---

## 1. Transports & GATT UUIDs

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Sources: `ble/BleComm.java` (`Q`/`V`), `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`.
`Ble` is a standard `AbsBle` exposing `BleComm`, `BleMultiComm` and a
`BlePtRealMultiComm` (`u()`). Notify list: `WifiNotifyParse`, `CheckLightParse`,
`CheckPodsParse`, `CaliLightParse`, `DeviceStatusNotifyParse`.

---

## 2. BLE frame + command table

`BleProtocol` (`ble/BleProtocol.java`):

| constant | value | meaning |
|---|---|---|
| `sub_mode_color` | 21 / `0x15` | colour mode container |
| `sub_mode_music` | 19 / `0x13` | music |
| `sub_mode_scenes` | 4 / `0x04` | scenes |
| `sub_mode_new_diy` | 10 / `0x0A` | DIY |
| `sub_mode_video` | 0 / `0x00` | video/movie mode (screen colour) |
| `value_cali_light` | -89 / `0xA9` | calibration-light start |
| `value_check_light` | -86 / `0xAA` | check light (write proType 0x33) |
| `value_check_pods` | -88 / `0xA8` | check pods |
| `value_compose_light_switch` | 54 / `0x36` | compose/child light switch |
| `value_swap_light_pos` | 52 / `0x34` | swap light position |
| `value_camera_effect` | -83 / `0xAD` | camera/snapshot effect |
| `value_white_balance` | -87 / `0xA9` | white balance |
| `value_logo` | -90 / `0xA6` | logo |
| `value_multiple_ble_diy` | 2 | multi-packet DIY |
| `value_multiple_set_music` | 65 / `0x41` | multi music |
| `MSG_TYPE_READ_LIGHT_DIRECTION` | 48 / `0x30` | read install direction |
| `MSG_TYPE_CAMERA_POSITION` | 49 / `0x31` | camera position |
| `MSG_TYPE_READ_INSTALL_CAMERA` | 50 / `0x32` | read install camera |
| `MSG_TYPE_READ_START_TIME` | 53 / `0x35` | read effect start time |
| `SINGLE_GRADUAL_CHANGE_4_WIFI_BLE` | -93 / `0xA3` | gradual change |

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | base `SwitchController` |
| brightness | `0x33/0x04` | `[0] 1..100` | `pact/Comm.makeBrightnessController4BleComm` |
| colour / mode | `0x33/0x05` | sub `0x15` 17-byte layout below | `ble/SubModeColor.java`, `ble/Mode.java`, `ble/ModeController.java` |
| music | `0x33/0x05` | sub `0x13` 6/8-byte layout | `ble/SubModeMusic.java` |
| scenes | `0x33/0x05` | sub `0x04` 3-byte effect LE16 | `ble/SubModeScenes.java` |
| new DIY | `0x33/0x05` | sub `0x0A` code LE16 | base `SubModeNewDiy` |
| video / movie | `0x33/0x05` | sub `0x00` 8-byte layout | `ble/SubModeVideo.java` |
| compose / child switch | `0x33/0x36` | `[0] f,[1] g,[2] h` bools | `ble/controller/ComposeLightController.java` |
| compose heart | `0xAA/0x36` | `[0..3]` bools (TV/left/right/feast) | `ble/controller/ComposeLightHeartController.java` |
| check light | `0x33/0xAA` | empty; response notify `0x23` | `ble/controller/CheckLightController.java` |
| check pods | `0x33/0xA8` | empty; response notify `0x24` | `BleProtocol.value_check_pods` |
| calibrate light belt | `0x33/0xA9` | `[0] mode, [1..5] params (bArr from UI)` | `ble/controller/CaliLightBeltController.java` |
| swap light position | `0x33/0x34` | empty | `ble/controller/SwapLightController.java` |
| start time read | `0xAA/0x35` | empty | `ble/controller/StartTimeController.java` |
| on/off memory | `0x33/0x41` | `[0] 0/1` | `ble/controller/Controller4OnOffMemory.java` |
| IC number | `0xAA/0x40` | empty | `ble/controller/ControllerIcNum.java` |
| multi music | `0x33/0x41` | header + per-bulb data | `ble/controller/MultiMusicController.java` |
| bulb-string colour read | `0xAA/0xA5` | `p()={index}` | `adjust/v1/BulbStringColorControllerV2.java` |
| bulb-string colour group | `0x33/0x?` multi | `BulbStringColorControllerV2` writes per 4-bulb group | same + `CmdPtReal` |
| gradual change | `0x33/0xA3` | `[0] 0/1` | base `Gradual4BleWifiController` |
| white balance / logo / camera | `0x33/0xA9/0xA6/0xAD` | payload from UI | `newdetail/vm/H604xVM.java` |

### Colour payload (`SubModeColor.getWriteBytes`, 17 bytes)

```
[0]=0x15
mode 1: [1]=1 [2..4]=R G B [5..6]=Kelvin LE16 [7..9]=temp RGB [10..12]=24-bit segment mask
mode 2: [1]=2 [2]=brightness [3..5]=24-bit segment mask
mode 3 (raw): [1]=3 [2..13]=12 raw bytes
```
Default segment array is `boolean[24]` (H604A/C) and 14 bulbs are addressed via groups.

### Music payload (`SubModeMusic.getWriteBytes`)

```
non-rhythm: 13 <code> <sens> <autoFlag 0/1> [R G B]  (6/7 bytes)
rhythm(4):  13 04 <sens> <dynamic> <autoFlag> [R G B] (8 bytes)
```
Music codes: `64 Rhythm (dynamic flag)`, `65 Wind Sound`, `66 Hooray`, `67 Sprouting`,
`72 Hopping`, `80 Torch`, `82 Expansion`, `83 Flowing Light`. Sensitivity 0..99.
Default code 64, default sensitivity 99.

### Video payload (`SubModeVideo.getWriteBytes`, 8 bytes)

```
00 <enable> <vividness 1..100> <mode 4/1..3> <dynamicFlag> <saturation 0..99> <param> 
```
Parse: `[0] enable, [1] vividness, [2] mode, [3] dynamic, [4] saturation, [5] param`.

---

## 3. BLE notifications / readings

| reading | op | layout | source |
|---|---|---|---|
| check light | notify `0x23` | `[0]==1` light OK, `[1]==1` status | `ble/CheckLightParse.java` |
| check pods | notify `0x24` | `[0]==1` pods OK | `ble/CheckPodsParse.java` |
| calibration timeout | notify `0x25` | event only | `ble/CaliLightParse.java` |
| wifi | `0x11` | `[0]==0` connected | `ble/WifiNotifyParse.java` |
| compose heart | `0xAA/0x36` | `[0] TV, [1] left, [2] right, [3] feast` | `ComposeLightHeartController` |
| status | `0x30` | base `DeviceStatusNotifyParse` | `ble/BleNotifyComm` |
| bulb-string colours | `0xAA/0xA5` | `BulbGroupColorV2.parseBytes` → per-bulb RGB | `BulbStringColorControllerV2`, `adjust/v1/BulbGroupColorV2` |
| device info | `0x07` | base `DefInfo` | `pact/Model` |

`BulbGroupColorV2.parseBytes` decodes 4-bulb groups (index + RGB), used by `CmdPtReal`
responses and the colour UI.

---

## 4. IoT commands + status/readings schema

Envelope **`IotMsgV2`** (`Iot*CmdBuilder` return `IotMsgProType.V2`).

`iot/Cmd.java` keys: `state`, `op`, `online`, `turn`, `color`, `colorTem`, `brightness`,
`status`, `pt`, `snapshot`, `points`, `IoTConnected`, `camera`, `swap`, `ptReal`, `ptIot`,
`colorwc`.

| cmd | data | response | source |
|---|---|---|---|
| `turn` | `{"val":0\|1}` | `state` | `CmdTurn` |
| `brightness` | `{"val":1..100}` | `state` | `CmdBrightness` |
| `colorwc` | `{"color":{r,g,b},"colorTemInKelvin":int}` | `state` | `CmdColorWc` |
| `ptReal` | `{"command":["<base64 20-byte>",...]}` | `op.pt[]` | `CmdPtReal` |
| `ptIot` | raw IoT passthrough | `op` | `Cmd.p` |
| `snapshot` | camera snapshot request | `ResultSnapShot.snapshotUrl` | `ResultSnapShot` |
| `points` | `{"points":[{"pointX":int,"pointY":int},...]}` | calibration result | `CmdCalibrationPoints` |
| `camera` | camera effect switch | `state` | `newdetail/vm/H604xVM` |
| `swap` | swap light position | `state` | `newdetail/vm/H604xVM` |
| `IoTConnected` | cloud connection state | — | `Cmd.l` |

`CmdPtReal` builders:
- `getCmdPtReal4SetColorMode(mode, bulbMax)` → mode frame + read frame + N `BulbStringColorControllerV2`
  read frames (`N = ceil(bulbMax/4)`, 24 or 14).
- `getColorStripCmdPtReal(controller, withBulbs, goodsType)` → multi colour-strip bytes, optionally
  followed by per-4-bulb colour reads.
- `getColorStripCmdPtReal4Square` → multi bytes + a colour-mode frame.
- `getDiyCmdPt(DiyProtocol)` → `MultipleDiyControllerV1` bytes + `0A <code>` mode frame.
- `getDiyTemplateCmdPt(DiyTemplate)` → multi template bytes + `04 <effect>` frame.
- `getNewScenesCmdPtReal(controller)` → multi scene bytes + `04 <effect>`.
- `getMusicCmdPtReal(MultiMusicController)` → multi music bytes + music mode frame.
- `isOtherMode2ColorMode` detects `15 02` colour mode + bulb-string read to rebuild state.

Status: `state`/`op`; `op.pt[]` frames are decoded by `CmdStatus`-less base parser and the
family parsers. `ResultSnapShot` exposes `snapshotUrl`. `ResultPt` exposes `ptBytes`.

---

## 5. Other protocols

- **Camera calibration / layout import** — `add/net/*` (upload points, get points, light
  calibration), `add/Calibration*`, `add/net/INet`. The phone camera captures the physical bulb
  layout; points are stored cloud-side and sent as `points`/`ptReal`.
- **Snapshot** — `snapshot` command returns a `snapshotUrl` used by the camera/colour UI.
- **BLE broadcast add flow** — `add/BleBroadcastProcessor` (advertisement-based discovery).
- **WiFi OTA / bind** — base HTTP APIs; `newdetail/Info4Detail` carries WiFi soft/hard versions.
- **No Matter/MQTT/LAN** in this split.

---

## 6. Dynamic effects / music / scenes / DIY

### Colour / segment (`0x15`)

- 24-segment mask for H604A/C (3 bytes), 14-bulb groups for H604B/D.
- Per-bulb colour reads (`0xAA/0xA5`) rebuild the layout after connect.
- `SubModeColor.makeSubModeColor(Colors)` groups equal colours into one frame per colour and
  splits brightness into 14-bulb frames.

### Music (`0x13`)

Effects: `64 Rhythm` (dynamic flag), `65 Wind Sound` (2=wind,3=?), `66 Hooray`, `67 Sprouting`,
`72 Hopping`, `80 Torch`, `82 Expansion`, `83 Flowing Light`. Sensitivity 0..99, auto-colour
flag + manual RGB. `getWriteBytes` for code 64 adds the dynamic byte.

### Video / movie (`0x00`)

`00 enable vividness mode dynamic saturation param`. The live new-detail VM
(`VideoVmH604x`) emits `05 00 <voiceOn> <vivid> <screenState> <drama> <voice> <softness>`
— byte order differs from tvlight/h6099; see `DREAMVIEW-HDMI.md` §2. Shared camera
settings (white balance `0xA9/00|06|0F`, sensitivity `0xA9/01`, colour calibration
`0xA9/05`, black screen `0xA9/0A`, HDR/saturation/AI filter) are in the same doc. Modes:
screen/video colour extraction with
vividness 1..100 and saturation 0..99.

### Scenes (`0x04`) and DIY (`0x0A`)

`04 epLo epHi` / `0A diyLo diyHi` (16-bit LE). V1 SKUs (95/122) use `ScenesOp.parseScene` with
allowed ops `{6}` (and `{1}` for scene-mode), V2 SKUs (109/133) use `parseSceneV1` with
`{1,2}`. Scene op sets: H604A/C `{1,6}`, H604B/D `{0,1,2,3}`.

### DIY effect codes (H604B/D `newdiy/h604b/*`)

| class | effect code | extra codes (template) |
|---|---|---|
| `DiyTemp4Chase` | `347` | 3/4 |
| `DiyTemp4Colorful` | `346` | 25 |
| `DiyTemp4Paomadeng` | `345` | 2/3 |
| `DiyTemp4PileUp` | `349` | 8/9 |
| `DiyTemp4Swing` | `348` | 7 |

H604A/C (`DiyConfigH604A`) uses the RGBIC-v2 DIY engine: share-code-0x00 effects with sub-effect
triples `[59,9,127]`, `[59,10,128]`, `[58,9,125]`, `[58,10,126]`, `[0,0,1]`, and template effects
`DiyTemp4Chase` (3/4), `DiyTemp4Ladder` (5/6, code 129), `DiyTemp4Penshe` (7, code 130),
`DiyTemp4BloomV2` (8/9), `DiyTemp4Swing` (10, code 9), `DiyTemp4Duikang` (11, code 9),
`DiyTemp4PileUp` (15/16). Speed range 0..100 (default 50); colour indices `[2,8]`/`[1,8]`/`[3,8]`.

---

## 7. Source map (traced)

- Registration/SKUs: `pact/{Support,SubLib,SubMaker,Register4Item,Model,H604*Item}.java`
- Transport: `ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol}.java`
- Mode/sub-modes: `ble/{Mode,ModeController,Mode4ColorStrip}.java`, `ble/SubModeColor.java`,
  `ble/SubModeScenes.java`, `ble/SubModeMusic.java`, `ble/SubModeVideo.java`
- Controllers: `ble/controller/*.java`; `adjust/v1/BulbStringColorControllerV2.java`,
  `adjust/v1/BulbGroupColorV2.java`
- IoT: `iot/{Cmd,CmdTurn,CmdBrightness,CmdColorWc,CmdPtReal,CmdCalibrationPoints,
  ResultPt,ResultSnapShot}.java`
- Add/calibration: `add/*`, `add/net/*`
- New detail/UI: `newdetail/*`, `newdetail/mode/*`, `newdetail/vm/*`, `newdetail/mode/VideoModeH604x`
- DIY: `newdiy/DiyConfigH604A.java`, `newdiy/DiyConfigH604BD.java`, `newdiy/h604b/*`

## 8. Gaps / unknowns

- V1 scene op semantics (`{1,6}`) and V2 (`{0,1,2,3}`) are op-set constants; actual scene IDs
  are cloud (`ScenesM`) values.
- Camera calibration point payload is `pointX/pointY` pairs; the exact cloud response schema
  (`CalibrationPointsResponse`, `LightCalibrationResponse`) was not fully expanded.
- `SubModeVideo` modes are UI enums; the mapping of 1..4 to named video effects is runtime.
- `MultiMusicController` per-bulb payload (`bArr[0]=index, bArr[1]=length`) is multi-packet;
  exact chunk sequencing is base `MultipleControllerCommV1`.
- H604A/C vs H604B/D DIY engine differences are captured by effect codes, but the base
  RGBIC-v2 template parser supplies the final body bytes.
