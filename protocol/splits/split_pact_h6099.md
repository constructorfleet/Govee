# split_pact_h6099 — H605B/H605C/H660x (HDMI sync) + H6098/H6099/H66Ax (TV backlight)

Sources: `decompiled/jadx-splits/split_pact_h6099/sources/com/govee/...`
plus shared lighting code in `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/...`.

Paths relative to `decompiled/`.

## 1. Overview / family and SKUs

The split ships **two pact families**:

1. `com.govee.pact_h605b` — **HDMI sync box / DreamView / AI Gaming** family
   (H605B, H605D, H605C, H6601…H6604, H6608, H8604, H2A40). Adds camera/light
   calibration, HDMI port switching, USB checks, sound-source notify.
2. `com.govee.pact_h6099` — **TV backlight / light-bar** family
   (H6099/H6690, H6098/H8098, H605A, H6097, H66A0, H66A1). Adds a very flexible
   colour op-type model, sleep/wake, timers and white balance.

All SKUs are `AbsBleWifiSku`/`AbsBleIotItem` → **ble + iot**; several also **matter**.

### 1.1 pact_h605b SKUs

| SKU | goodsType | pact protocols | transports | notes |
|---|---|---|---|---|
| H605B | 82 | (1,1) | ble, iot | DreamView T1 Pro; camera calibration |
| H605D | 82 | (1,1) | ble, iot | DreamView T1S Pro; same goodsType |
| H605C | 120 | (1,1),(1,2) | ble, iot | 14 segments; V2 colour; HTTP H605C calibration |
| H6601 | 138 | (1,1) | ble, iot | AI Gaming Sync Box, 3 HDMI ports |
| H6602 | 142 | (1,1),(2,1) | ble, iot | AI Gaming Sync Box, 14 segments |
| H6603 | 192 | (1,1),(2,1),(3,1) | ble, iot, matter | HDMI Sync Box Kit, 4 ports |
| H6604 | 243 | (1,1),(2,1),(3,1) | ble, iot, matter | HDMI Sync Box strip, 4 ports |
| H8604 | 243 | (1,1),(2,1),(3,1) | ble, iot, matter | alias of H6604 |
| H6608 | 172 | (1,1) | ble, iot | 30 segments, vertical TV strip |
| H2A40 | 360 | (1,1) | ble, iot | HDMI 2.1 / newer box |

### 1.2 pact_h6099 SKUs

| SKU | goodsType | pact protocols | transports | notes |
|---|---|---|---|---|
| H6099 | 191 | (1,1),(2,1) | ble, iot, matter | 24 segments at IC 24; TV backlight |
| H6690 | 191 | (1,1),(2,1) | ble, iot, matter | alias of H6099 |
| H6098 | 336 | (1,1) | ble, iot, matter | H8098 alias |
| H8098 | 336 | (1,1) | ble, iot, matter | alias |
| H605A | 203 | (1,1),(2,1),(3,1) | ble, iot, matter | 14 segments |
| H6097 | 253 | (1,1),(2,1) | ble, iot, matter | 24 segments; new 3-image calibration |
| H66A0 | 273 | (1,1),(2,1) | ble, iot, matter | 14 segments |
| H66A1 | 327 | (1,1),(2,1) | ble, iot | 14 segments |

Protocol registration: `pact_h605b/pact/Support.addSupportPact()` and
`pact_h6099/pact/Support.addSupportPact()`.

## 2. Transports & GATT UUIDs

Both families:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

`pact_h605b/ble/BleComm.java` (`V`/`W`) and `pact_h6099/ble/BleComm.java`
(`P`/`Q`). Both use the common notify characteristic for reads.

Matter: H6603/H6604 via `pact_h605b/pact/MatterSupport` (goodsTypes 192, 243);
H6099/H6690/H6098/H605A/H6097/H66A0 via `pact_h6099/pact/MatterSupport`
(goodsTypes 336,191,253,273, plus H6098 aliases).

## 3. BLE frame + command table

20-byte frame `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR`.
Single write `0x33`, read `0xAA`; multi-packet `0xA3`.

| Command | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `01/00` | [0] | base `SwitchController`; `ControllerSwitch` |
| brightness | `0x33/0x04` | `0..100` | [0] | base `BrightnessController` |
| mode container | `0x33/0x05` | sub-mode | `0x15` colour, `0x04` scene, `0x0A` DIY, `0x13` music, `0x00` video | `pact_h605b/ble/Mode*.java`, `pact_h6099/ble/Mode.java`, `ModeController*` |
| IC number read | `0xAA/0x40` | — | returns IC count / segment count | `ControllerIcNum` |
| direction | `0x33/0x30` | `dir` | write; read `0xAA/0x30` | `DirectionController` / `LightDirectionController` |
| calibration in/out | `0x33/0x44` | `02 01` into / `02 00` exit | — | `InstallCaliController`, `CalibrationController` |
| swap light position | `0x33/0x34` | — | — | `SwapLightController` |
| start time | `0xAA/0x35` | — | — | `StartTimeController` |
| on/off memory | `0x33/0x41` | `02 <mode>` read `02` | [0]=2, [1]=memory mode | `Controller4OnOffMemory` |
| gradual (fade) | `0x33/0xA3` | `01|00` | fade on/off | `GradualController`, `Gradual4BleWifiController` |
| compose light switch | `0x33/0x36` | `val` | multi-light switch | `ComposeLightSwitchController`, `ComposeLightController` |
| timer | `0x33/0x23` | `group enableType hour min repeat` | read all `23 FF` | `pact_h6099/ble/controller/compose/TimerController.java` |
| sync time | `0x33/0x09` | time bytes | — | `SyncTimeController` |
| soft version | `0x33/0x06` | — | read | `SoftVersionController` |
| DSP/hard version | `0x33/0x07` | — | read | `DspVersionController`, `HardVersionController` |
| sleep/wake | `0x33/0x11` | `enable startBri closeTime curTime` | V2 appends `defaultLight rgbR rgbG rgbB kLo kHi voiceOpen voiceVolume voiceLo voiceHi` | `base2light/ble/controller/SleepController{,V2}.java`, `pact_h6099/pact/Comm.makeSleepController` |
| extension op | `0x33/0xA9` | `subOp …` | generic 0xA9 sub-command namespace (see below) | many controllers |

### 3.1 `0xA9` extended-settings namespace

Corrected and expanded from the shared DreamView/settings controllers. Full detail and
read/parse layouts: `DREAMVIEW-HDMI.md` §1.

| subOp | write payload after `33 A9` | read | meaning | source |
|---|---|---|---|---|
| `00` | `00 03 <auto?0:1> <R> <B>` | `00` | classic white balance | `WhiteBalanceVmInterface` / `VideoModeParamsController` |
| `01` | `01 01 <value>` | `01` | sensitivity | `VideoSensitivityController` |
| `02` | `02 01 <value>` | `02` | whole-RL / video brightness | `WholeRLBrightnessVmInterface` |
| `03` | `03 01 <port>` | `03` | HDMI port select | `Controller4Hdmi` |
| `04` | `04 01 <value>` | `04` | AI action / AI gaming | `AiActionController` |
| `05` | `05 03 <R> <G> <B>` or `05 04 <R> <G> <B> <extra>` | `05` | colour calibration | `ColorCaliController` / `Controller4ColorCalibration` |
| `06` | `06 01 <progress>` | `06` | white balance, infinite progress | `Controller4WhiteBalance` / `VideoModeParamsController` |
| `07` | — | `07` | DSP version (not a setting) | `DspVersionController` |
| `09` | — | `09` | AI update status (read-only) | `AiUpdateStatusController` |
| `0A` | `0A 06 <enable> <mode> <startLo> <startHi> <endLo> <endHi>` | `0A` | device black screen | `compose/BlackScreenController` |
| `0B` | `0B 01 <flag>` | `0B` | black-border removal | `compose/BlackBorderRemoveController1` |
| `0C` | `0C 03 <enable> <durLo> <durHi>` | `0C` | HDMI black screen (15–300 s, default 30) | `balckscreen/hdmi/BlackScreenHdmiController` |
| `0D` | `0D` | `0D` | HDR calibration trigger | `HDRCaliController` |
| `0E` | `0E 01 <value>` | `0E` | saturation | `VideoSaturationController` |
| `0F` | `0F 03 <R> <G> <B>` | `0F` | advanced white balance | `WhiteBalanceVmInterface` |
| `10` | `10 0F <enable> <R> <G> <B> <saturation> <codeLo> <codeHi> <autoCloseLo> <autoCloseHi> <timeLo> <timeHi> <tz0..3>` | `10` | AI filter (fields decoded from `AiFilterStatusBean`) | `AiFilterController` |
| `11` | `11 02 <enable> <level>` | `11` | HDR effect / contrast | `VideoHdrEffectController` |
| `12` | `12` | — | auto white balance (old) | `VideoAutoWbController` |
| `13` | — | `13` | check white-balance calibration | `VideoCheckWbCaliController` |
| `14` | `14` | — | exit white-balance calibration | `VideoAutoWbController` |

Separate command types: sound-effect mic selection `0x33/0xAC <micIndex>`, relative/
segment brightness `0x33/0xAE 01 <4|6> ...`, audio source `0x33/0xB7 <0|1>`.

### 3.2 H605B extra commands

| Command | op | payload | source |
|---|---|---|---|
| check camera | `0xAA/0x32` | — | `CheckCameraController` |
| check light install | `0xAA/0xAA` | — | `CheckLightController` |
| exit checking light install | `0x33/0xAF` | — | `ExitCheckLightController` |
| camera position | `0x33/0x31` | op | `CameraPosController` |
| USB check | `0x33/0x38` | `val` | `UsbCheckController` |
| USB check state | `0x33/0x37` | `val` | `UsbCheckStateController` |
| HDMI box light effect | `0x33/0xB6` | `on effectIdx !dynamic?1:0 speed` | `ControllerBoxEffect` |
| sound-effect mic select | `0x33/0xAC` | `micIndex` | `SoundEffectVmInterface.updatePickMic` |
| relative/segment brightness | `0x33/0xAE` | `01 <4|6> <v0> <v1> <v2> <v3> [<v4> <v5>]` | `RelativeBrightnessController` |
| HDR calibration | `0x33/0xA9` | `0D` read/write | `HDRCaliController` |
| saturation | `0x33/0xA9` | `0E 01 <value>` / read `0E` | `VideoSaturationController` |
| AI filter | `0x33/0xA9` | `10 0F ...` / read `10` | `AiFilterController` |
| audio from | `0x33/0xB7` | `src` | `Controller4AudioFrom` |
| light on/off (compose) | `0x33/0x36` | `val` | `LightOnOffController` |
| multi-music block | `0x33/0x41` | layer block | `MultiMusicController{,V3}` |

## 4. BLE notifications / readings

`pact_h605b/ble/BleNotifyComm.java`:

| proType | parser | reading |
|---|---|---|
| `0x11` | `WifiNotifyParse` | Wi-Fi connected = `[0]==0` |
| `0x50` | `UsbCheckOvertimeParse` | USB check timeout |
| `0x40` | base `DeviceStatusNotifyParse` | first 10 bytes |
| `0x23` | `LightInstallNotifyParse` | `[0]` installed, `[1]` variant |
| `0x25` | `CaliLightParse` | calibration-light overtime |
| `0x30` | `LightAndHdmiNotifyParse` | `[0]=1` light-bar presence bits; `[0]=3` HDMI port + bitfield; `[0]=8` AI model id LE16; `[0]=9` … |
| `0x32` | `SoundSourceNotifyParse` | `[0]==1` → HDMI else DEVICE |
| `0x60` | base `MovieFeastOnOffNotifyParse` | `[0]==1`, `[1]` on/off |

`pact_h6099/ble/BleNotifyComm.java`: `0x11` Wi-Fi, `0x40` device status,
`0x30` light/HDMI, `0x60` movie feast.

## 5. IoT commands + status / readings schema

Both families share the base2light envelope (`Write/AbsCmdWrite`) with variant
`IotMsgProType.V1/V2`; read replies are keyed `state` and `op`.

### pact_h605b `iot/Cmd.java`

`state`, `op`, `online`, `turn`, `color`, `colorTem`, `brightness`, `status`, `pt`,
`snapshot`, `points`, `IoTConnected`, `camera`, `swap`, `ptReal`, `ptIot`,
`colorwc`, `iniUrl`, `iniRoi`.

### pact_h6099 `iot/Cmd.java`

`state`, `op`, `online`, `turn`, `color`, `colorTem`, `brightness`, `status`, `pt`,
`snapshot`, `dewarpsnapshot`, `points`, `IoTConnected`, `camera`, `swap`, `ptReal`,
`ptIot`, `colorwc`.

| cmd | data | notes | source |
|---|---|---|---|
| `turn` | `{"val":0|1}` | power | `CmdTurn.java` |
| `brightness` | `{"val":0..100}` | — | `CmdBrightness.java` |
| `colorwc` | `{"color":{"r","g","b"},"colorTemInKelvin"}` | colour or temp | `CmdColorWc.java` |
| `ptReal` | `{"command":["<base64 20-byte frame>",…]}` | all effects | `CmdPtReal.java` |
| `status` | `{}` | read | `CmdStatus.java` |
| `snapshot` | `{}` | camera calibration image | `ResultSnapShot.java`, `SnapShotIotResult.java` |
| `dewarpsnapshot` | `{}` | de-warped image (H6099 3-image) | `cameraCali3Img/*` |
| `points` | `{"points":[…]}` | calibration points | `CmdCalibrationPoints.java`, `GetViewPointsH66A0.java` |
| `camera` | `{}` | camera on/off | `Cmd.java` |
| `swap` | `{}` | swap light position | `pact_h605b/iot/Cmd.java`, `pact_h6099/iot/Cmd.java`, `SwapLightAc` |
| `iniUrl` / `iniRoi` | string | H605C calibration URL/ROI | `pact_h605b/iot/Cmd.java` |
| `IoTConnected` | `{}` | link state | `Cmd.java` |
| `ptIot` | raw | IoT-channel passthrough | `Cmd.java` |

Status schema:

- `h6099/iot/State.java`: `onOff` (int), `brightness` (int), `wifiSoftVersion`,
  `wifiHardVersion`.
- `h605b` uses `ResultPt`/`ResultSnapShot`/`ResultLeftSnapShot`/`ResultRightSnapShot`
  for `op` payloads.

## 6. Other protocols

- **HTTP calibration** (H605C/H6099 3-image):
  - `POST /bff-app/v1/axin/user-cali` (`pact_h605b/add/net/NetApi.java`)
  - `GET /bff-app/v1/device-guide/configs?sku=` (`add/net/hdmi/HdmiApi.java`)
  - `GET/POST appco/v1/calibration/point` and `POST device/rest/devices/v1/appDeviceTopic`
    (`pact_h6099/add/net/NetApi.java`)
- **Camera pipeline**: `add/ActivityPrepareCamera`, `CheckCameraAc`,
  `CalibrationReadM`, `UpLoadIC`, `UploadPoints*` (not BLE).
- **HDMI resolution list** — `GET /bff-app/v1/device-guide/configs?sku=` →
  `BaseStatusResponse<HdmiResolutionResponse{resolutions:[{resolution,rate}]}>`
  (`add/net/hdmi/HdmiApi.java`, `HdmiResolutionBean/Response`). Server-provided list, no
  BLE command.
- **HDMI port icons** — `GET /bff-app/v1/hdmi-port/icons?sku=&device=` and
  `POST /bff-app/v1/hdmi-port/icons`
  (`com/govee/kt/HdmiIconVM.java`, `com/govee/kt/net/INet.java`):
  `Response4HdmiIconList{hdmiPortIconId, portIcons:[{port,iconId}]}`;
  `Request4UpdateHdmiIconList{hdmiPortIconId, sku, device, portIcons}`.
- **Movie Feast / DreamView group REST** — create/delete
  `/appsku/v1/moment/feasts`; rename `/appsku/v1/moment/feasts/names`; detail/main/sub
  `/bff-app/v1/moment/feasts/{details,main-devices,sub-devices}`; region
  `/appsku/v1/moment/feasts/region`; music/scene feast endpoints; snapshot
  `/bff-app/v1/feast/snapshot/cmd-refactor`. Field-level bodies in `DREAMVIEW-HDMI.md` §4.1.
- **Matter**: see §2.

## 7. Dynamic effects / motion / music / scenes / DIY

### 7.1 pact_h605b colour — sub-mode `0x15` per SKU

`Comm.makeColorController4BleComm(goodsType, rgb)` dispatches:

| goodsType | class | payload |
|---|---|---|
| H605C (120) | `ble/v2/SubModeColorV2` | `15 01 R G B kLo kHi R2 G2 B2 mask2` or `15 02 idx mask2` |
| H6601/H6603 (138/192) | `ble/v3/SubModeColorV3` | `15 01 R G B kLo kHi R2 G2 B2 mask3` or `15 02 idx mask3` |
| H6602/H6604 (142/243) | `ble/v4/Sub4Color` | op-type model: `15 02 bri mask2`, `15 01 R G B kLo kHi 0 0 0 mask2`, `15 00`, `15 03 group bri…`, `15 04 group rgb…` |
| H6608 (172) | `ble/h6608/SubModeColor4H6608` | 24-segment mask (3 bytes), same 17-byte buffer |
| H605B/H2A40 (82/360) | `ble/SubModeColor` | 24-segment mask at [10..12]; `15 01 …` / `15 02 idx …` |

`SubModeColor` flag 1 = colour (optionally temp), flag 2 = colour-index on masked
segments. Mask bytes are LSB-first bitfields. `Sub4Color` op-types:
0=SET_BRIGHTNESS, 1=SET_COLOR, 2=SET_COLOR_TEMP, 3=SET_MODE, 6=BRIGHTNESS_GROUP,
7=COLOR_GROUP.

### 7.2 pact_h6099 colour — sub-mode `0x15` (V1 op-type)

`pact_h6099/ble/v1/SubModeColorV1` mirrors the H6609 model:

| opType | bytes |
|---|---|
| 0 | `15 02 bri mask*` |
| 1 | `15 01 R G B kLo kHi 0 0 0 mask*` |
| 2 | `15 01 FF FF FF kLo kHi R G B mask*` |
| 3 | `15 00` |
| 6 | `15 03 group briSet…` |
| 7 | `15 04 group rgbSet…` |

Other op-type values are app-side selectors and return `null` from `getWriteBytes()`.

Segment count: 24 for H6097 (253), else 14 (`Support.getColorPieceSize`).
Mask uses 2 bytes ≤16 segments, 3 bytes above.

### 7.3 Scenes / DIY

- Scenes: `04 effectLo effectHi` (16-bit LE). Multi-layer scenes are `0xA3`
  blobs (`ScenesOp.parseSceneV1`) with final `04 code`.
- DIY: `0A codeLo codeHi`; `Sub4Diy` (pact_h6099), `SubModeNewDiy` (pact_h605b).
  H605B/H605C/H660x DIY templates and H6099 3-image calibration both feed
  `CmdPtReal.getDiyCmdPt*`.

### 7.4 Music — sub-mode `0x13`

| SKU group | layout |
|---|---|
| pact_h605b base (H605B/H2A40) | 5 bytes `13 code sens ? ?` with per-code flags |
| H605C (`v2/SubModeMusicV2`) | `13 code sens dyn auto R G B` (8 bytes) |
| H6601/H6603 (`v3/SubModeMusicV3`) | 5 bytes with flags for code 64/65 |
| H6602/H6604 (`v4/Sub4Music`) | `13 code sens dyn 00 auto R G B` (9 bytes) |
| H6099 (`v1/SubModeMusicV1`) | `13 code sens` or `13 code sens dyn auto 00 00 R G B` |

Music codes: 64 rhythm, 65 wind/fengche, 66 hooray, 67 sprout, 72 hopping,
80 torch, 82 burst, 83 streaming (`pact_h605b/ble/BleProtocol.java`).
New-music codes 48–55 via `AbsNewMusicEffect`.

### 7.5 Video — sub-mode `0x00` (DreamView)

Container: `0x33/0x05` + sub-mode `0x00`; the payload is built by the family `VideoVm`
via `Controller4ExtBytes({5, 0, ...})`. **Byte order differs by SKU generation** — use
this table rather than the legacy class names alone:

| Family / VM | payload after `05` | bytes |
|---|---|---|
| H6099 (`VideoVm.N`) | `00 <drama> <part 8/9> <vivid> <voiceOn> 02 <voice>` | 7 |
| H66A0 (`VideoVm.O`) | `00 <drama> <part> <vivid> <voiceOn> 02 <voice>` | 7 |
| H6097 / H605A | `00 <drama> <part> <vivid> <voiceOn> 02 <voice>` (H605A: `... <softness> <voice>`) | 7 |
| H2A40 (`VideoVm.N`) | `00 <drama> <part> <vivid> <voiceOn> 02 <voice>` | 7 |
| H605B / H605D (`VideoVm.O`) | `00 <voiceOn> <vivid> <part> <drama> <voice> <softness>` | 7 |
| H605C / default (`VideoVm.P`) | `00 <screenState> <drama> <vivid> <voiceOn> <voice> 00 <seg1> <seg2> <seg3> <seg4> 00` | 12 |

Legacy parsers still present: `SubModeVideo` (`00 dramaFlag vividness effect voiceOpen
voice`), `SubModeVideoV1` (H6099), `SubModeVideoV2`, `SubModeVideoV3`,
`SubModeVideoH605CV1`; they parse the same bytes in family-specific order.
`screenState/part`: 0=part, 1=all, 2=full-screen; `drama`: 0=movie, 1=game; `vivid`
1..100; `voiceOn` 0/1; `voice`/`softness`/`rlBrightness` 0..100. Full field table:
`DREAMVIEW-HDMI.md` §2.

### 7.6 Calibration / direction

`0x44` enters/exits light calibration; `0x30` sets light direction; `0x42`/`0x31`
set camera/light points; `0x40` reads IC/segment count. These drive the
camera-based screen-zone mapping, not colour effects.

## 8. Source map (traced)

- pact_h605b: `pact/{Support,SubLib,SubMaker,Comm}.java`, `ble/{BleProtocol,Mode,ModeController,Mode4ColorStrip,SubMode*}.java`,
  `ble/{v2,v3,v4,h6608}/*`, `ble/controller/**`, `ble/controller/compose/**`,
  `iot/{Cmd,CmdPtReal,CmdColorWc,CmdTurn,CmdBrightness}.java`,
  `add/net/NetApi.java`, `add/net/hdmi/HdmiApi.java`.
- pact_h6099: `pact/{Support,SubLib,SubMaker,Comm}.java`,
  `ble/{BleProtocol,Mode,ModeController}.java`, `ble/v1/*`,
  `ble/controller/**`, `ble/controller/compose/**`,
  `iot/{Cmd,CmdStatus,CmdPtReal,CmdColorWc,State}.java`,
  `add/net/NetApi.java`, `add/cameraCali3Img/**`.
- Shared framing: `base2light/ble/comm/MultipleControllerCommV1.java`,
  `base2light/ble/controller/{SleepController,SleepControllerV2}.java`.

## 9. Gaps / unknowns

- HDMI port semantics and H2A40 black-screen/border bytes are in UI/Compose code;
  `0xA9` sub-op values were read from constructors.
- `SubModeVideo*` parameter meanings (vividness/voice/softness) are UI sliders.
- `CameraPosController` / `InstallCaliController` payloads depend on the
  camera/point coordinate model (not a fixed byte layout in Java).
- Scene/DIY ids and layer blobs are cloud assets; only `04/0A <LE16>` containers
  and `0xA3` framing are static.
- H8604 shares goodsType 243 with H6604; H8098 shares 336 with H6098.
- The two families have separate `Cmd.java` files but identical envelope and
  read-key mapping.
