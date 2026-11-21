# DreamView / HDMI settings and modes — coverage audit

This is the consolidated reference for the settings that sit *around* the lighting
commands: camera DreamView, HDMI sync boxes, video-mode parameters, HDR/saturation/AI
filter, black-screen, calibration, sound effects, and Movie Feast.

It also records what the first pass missed and the corrections applied to the per-split
docs.

## Executive summary

**Already covered (but scattered):**

- Basic HDMI port select, audio source, USB/light-install checks, camera position/check,
  box light effect (`split_pact_h6099.md`).
- DreamView video-mode payloads for TV backlights (`split_pact_tvlightv4.md` §5.5) and
  HDMI/H660x (`split_pact_h6099.md` §7.5), but only the inner `0x05/0x00` form and with
  some per-SKU byte orders missing.
- Movie-feast on/off notify (`0xEE/0x60`) across many lighting splits.

**Missed in the first pass (now documented here):**

- The shared **`0xA9` extended-settings namespace**: sensitivity, whole-RL brightness,
  colour calibration, white balance variants, black-border remove, HDR calibration,
  HDR effect/contrast, saturation, AI filter, auto/check/exit white-balance calibration.
- **Black screen** has two distinct forms: device black screen (`0xA9/0x0A`, 8 bytes)
  and HDMI black screen (`0xA9/0x0C`, 5 bytes with a 15–300 s duration). The first pass
  collapsed them into `0C 01 flag`.
- **AI action** is `0xA9/0x04` (not `08`); **colour calibration** is `0xA9/0x05`
  (not `07`); **audio source** is `0xB7` (not `0xA9/0x0D`).
- **Sound-effect mic selection** (`0x33/0xAC`) and **relative/segment brightness**
  (`0x33/0xAE`) are separate settings.
- Per-generation **DreamView video-mode byte order** (H605B/H605C/H2A40/H605A/H6097/
  H604x/H6104 are all different).
- **Movie Feast settings**: saturation (`0x33/0x60/0x09`), sensitivity (`0xA9/0x01`),
  AI filter (`0xA9/0x10`), plus the Movie/Music/Scenes feast types and REST endpoints.
- **HDMI metadata**: supported-resolution list and port-icon list are REST, not BLE.
- The `tvlightv4` doc used `0xAB` for white balance/brightness/black-border; the actual
  command type is **`0xA9`** (`getCommandType() == -87`). Corrected.

## 1. Shared `0xA9` extended-settings namespace

Frames are normal 20-byte BLE packets:

```
write: 33 A9 <subOp> <len> <data...> <BCC>
read : AA A9 <subOp> [<len>]          <BCC>
```

`AbsControllerNoEvent4Single.getProType()` returns `0x33` for write, `0xAA` for read.
`Controller4ExtBytes` / `AbsController` put the payload after the command type. For IoT
devices these frames travel in `ptReal` / `pt`.

| Setting | Write payload after `33 A9` | Read | Notes / source |
|---|---|---|---|
| White balance (classic) | `00 03 <auto?0:1> <R> <B>` | `00` | `WhiteBalanceVmInterface.getWhiteBalanceControllerNormal` |
| White balance (infinite progress) | `06 01 <progress>` | `06` | same; used when `supportWhiteBalanceInfiniteProgress()` |
| White balance (advanced) | `0F 03 <R> <G> <B>` | `0F` | `getWhiteBalanceControllerAdvanced` → `[2..5]` on read |
| Auto white balance (old) | `12` | — | `getWhiteBalanceControllerAutoOld` |
| Check white-balance calibration | — | `13` | `VideoCheckWbCaliController`; read `[2]==1` |
| Exit white-balance calibration | `14` | — | `VideoAutoWbController.makeExitCaliController()` |
| Sensitivity | `01 01 <value>` | `01` | `VideoSensitivityController`; parse `[2]` |
| Whole-RL / video brightness | `02 01 <value>` | `02` | `WholeRLBrightnessVmInterface` |
| HDMI port select | `03 01 <port>` | `03` | `Controller4Hdmi`; H605B/H660x |
| AI action | `04 01 <value>` | `04` | `AiActionController`; H605B |
| Colour calibration | `05 03 <R> <G> <B>` or `05 04 <R> <G> <B> <extra>` | `05` | `ColorCaliController` / `Controller4ColorCalibration`; read `[2..5]` |
| DSP version (not a setting) | — | `07` | `DspVersionController` |
| AI update status (read-only) | — | `09` | `AiUpdateStatusController` |
| Device black screen | `0A 06 <enable> <mode 1/2> <startLo> <startHi> <endLo> <endHi>` | `0A` | `balckscreen/controller/BlackScreenController`; H6099 |
| Black-border remove | `0B 01 <flag>` | `0B` | `BlackBorderRemoveController`; read `[2]==1` |
| HDMI black screen | `0C 03 <enable> <durationLo> <durationHi>` | `0C` | `balckscreen/hdmi/controller/BlackScreenHdmiController`; duration 15–300 s, default 30 |
| HDR calibration | `0D` | `0D` | `HDRCaliController` (write triggers calibration) |
| Saturation | `0E 01 <value>` | `0E` | `VideoSaturationController`; parse `[2]` |
| AI filter | `10 0F <enable> <R> <G> <B> <saturation> <codeLo> <codeHi> <autoCloseLo> <autoCloseHi> <timeLo> <timeHi> <tz0> <tz1> <tz2> <tz3>` | `10` | `AiFilterController`; 17-byte payload. Fields decoded from `AiFilterStatusBean`/`AiFilterViewModel`: enable, R/G/B, saturation, filter code LE16, auto-close minutes LE16, expiration time-of-day LE16, 4-byte timezone. |
| HDR effect / contrast | `11 02 <enable> <level>` | `11` | `VideoHdrEffectController`; read `[2]==1`, `[3]` |
| Black screen (HDMI old path) | see `0C` | `0C` | `BlackScreenHdmiController` |
| Sound-effect mic selection | `AC <micIndex>` (cmdType `0xAC`, not `A9`) | — | `SoundEffectVmInterface.updatePickMic` |
| Relative / segment brightness | `AE 01 <4|6> <v0> <v1> <v2> <v3> [<v4> <v5>]` | `AE 01` | `RelativeBrightnessController`; 4- or 6-segment form |
| Audio source (HDMI/device) | `B7 <0|1>` (cmdType `0xB7`) | — | `Controller4AudioFrom`; notify `0x32` reports source |

### `0x0A` vs `0x0C` black screen

- **`0x0A` device black screen** (H6099 and camera devices): 8 bytes.
  `0A 06 enable mode startLo startHi endLo endHi`. `mode` is 1 or 2; start/end are
  16-bit little-endian values from `BlackScreenBean`.
- **`0x0C` HDMI black screen** (HDMI boxes): 5 bytes.
  `0C 03 enable durationLo durationHi`; duration clamped to 15..300 seconds, default 30
  (`BlackScreenHdmiDefaultParams`). Read `0C` returns the same pair.

## 2. DreamView video mode (camera path)

The mode container is still `0x33/0x05`, sub-mode `0x00`:

```
33 05 00 <video-mode payload> <BCC>
```

Every family builds the payload through a `VideoVm` subclass and
`Controller4ExtBytes({5, 0, ...})`. The byte order is **not** the same across SKUs:

| Family / VM | Payload after `05` | Field order |
|---|---|---|
| tvlightv2 / tvlightv4 | `00 <screenState> <drama> <vivid> <voiceOn> <voice> <rlBrightness>` | `VideoVm.N` (7 bytes) |
| h604a H604x | `00 <voiceOn> <vivid> <screenState> <drama> <voice> <softness>` | `VideoVmH604x.N` (7 bytes) |
| h6104 | `00 00 <screenState> <vivid>` | `VideoVm.B` (4 bytes, minimal) |
| h6099 H6099 | `00 <drama> <part 8/9> <vivid> <voiceOn> 02 <voice>` | `VideoVm.N` |
| h6099 H66A0 | `00 <drama> <part> <vivid> <voiceOn> 02 <voice>` | `VideoVm.O` |
| h6099 H6097 / H605A | `00 <drama> <part> <vivid> <voiceOn> 02 <voice>` (H605A order differs: `... <softness> <voice>`) | `VideoVmH6097.N`, `VideoVmH605A.N` |
| h605b H2A40 | `00 <drama> <part> <vivid> <voiceOn> 02 <voice>` | `VideoVm.N` |
| h605b H605B/H605D | `00 <voiceOn> <vivid> <part> <drama> <voice> <softness>` | `VideoVm.O` |
| h605b H605C / default | `00 <screenState> <drama> <vivid> <voiceOn> <voice> 00 <seg1> <seg2> <seg3> <seg4> 00` | `VideoVm.P` (12 bytes; segment relative brightness) |

Field meanings (from `VideoModeControllerParams` and the split UI docs):

- `screenState` / `part`: 0 = part, 1 = all, 2 = full-screen; some HDMI paths use 8/9 as
  the part marker.
- `drama`: 0 = movie/drama, 1 = game.
- `vivid`: vividness, 1..100 (parsers clamp).
- `voiceOn`: 0/1.
- `voice`: voice/volume, 0..100.
- `softness`: 0..100.
- `rlBrightness`: whole relative-light brightness, 0..100.
- segment values: 4- or 6-segment relative brightness (`RelativeBrightnessBean`).

Read-back uses `Info4Detail.g0()`/`[0]=0x00` and `VideoModeControllerParams` from the
sub-mode bytes; older `SubModeVideo*` classes parse the same layouts.

> Note: the `SubModeVideo*` names in `split_pact_h6099.md` §7.5 are the legacy parsers;
> the live write path is the `VideoVm` table above. Both are included in the collection.

## 3. HDMI-specific settings and metadata

### 3.1 BLE settings

| Feature | Op / payload | Source |
|---|---|---|
| HDMI port select | `0xA9/03` read; write `03 01 <port>` | `pact_h605b/ble/controller/compose/Controller4Hdmi.java` |
| Audio source (HDMI vs device) | `0xB7 <0|1>`; notify `0x32` `[0]==1` → HDMI else DEVICE | `Controller4AudioFrom`, `SoundSourceNotifyParse` |
| AI action / AI gaming | `0xA9/04` read; write `04 01 <value>` | `AiActionController` |
| AI update status | read `0xA9/09` | `AiUpdateStatusController` |
| HDMI box light effect | `0xB6 <on> <effectIdx> <!dynamic?1:0> <speed>` | `ControllerBoxEffect` |
| HDMI black screen | `0xA9/0C 03 <enable> <durationLo> <durationHi>`; read `0C` | `BlackScreenHdmiController` |
| Device black screen | `0xA9/0A 06 ...` (see above) | `pact_h6099/.../BlackScreenController` |
| HDMI port + presence notify | notify `0x30`: `[0]=3` port + bitfield; `[0]=1` light-bar bits; `[0]=8` AI model id LE16 | `LightAndHdmiNotifyParse` |
| Sound source notify | notify `0x32`: `[0]==1` HDMI | `SoundSourceNotifyParse` |
| USB check / state | `0x33/0x38`, `0x33/0x37` | `UsbCheckController`, `UsbCheckStateController` |
| Check light install / exit | `0xAA/0xAA`, `0x33/0xAF` | `CheckLightController`, `ExitCheckLightController` |
| Camera position / check | `0x33/0x31`, `0x33/0x32` | `CameraPosController`, `CheckCameraController` |

### 3.2 REST metadata (not BLE)

| Item | Endpoint / model | Notes |
|---|---|---|
| Supported HDMI resolutions | `GET /bff-app/v1/device-guide/configs?sku=` → `HdmiResolutionResponse{resolutions:[{resolution,rate}]}` | Server-provided list; no device command. |
| HDMI port icons | `GET /bff-app/v1/hdmi-port/icons?sku=&device=`, `POST /bff-app/v1/hdmi-port/icons` | `Response4HdmiIconList{hdmiPortIconId, portIcons:[{port,iconId}]}`; `Request4UpdateHdmiIconList{hdmiPortIconId,sku,device,portIcons}`. |
| Camera calibration | `GET/POST appco/v1/calibration/point`, `POST bi/rest/v1/calibrationPoints`, `POST /bff-app/v1/axin/user-cali` | Points/ROI; see h6099 split doc. |
| Snapshot command (Movie Feast) | `POST /bff-app/v1/feast/snapshot/cmd-refactor` | `SnapshotCmdService`. |

## 4. Movie Feast (DreamView group modes)

`FeastType` defines three DreamView group types:

| Type | id | icon | Notes |
|---|---:|---|---|
| Movie | 0 | `new_dreamview_icon_movie` | movie sync |
| Music | 1 | `new_dreamview_icon_music` | music sync |
| Scenes | 2 | `new_dreamview_icon_scenic` | scene sync |

Settings/commands:

| Feature | Op / payload | Source |
|---|---|---|
| Movie Feast on/off notify | notify `0xEE/0x60`: `[0]==1`, `[1]` on/off | base `MovieFeastOnOffNotifyParse` |
| Saturation | `0x33/0x60/0x09 <value>` (module frame: proType `0x33`, module `0x60`, command `0x09`) | `MovieSaturationController` |
| Sensitivity | `0xA9/01 01 <value>` / read `01` | `MovieSensitivityController` / `VideoSensitivityController` |
| AI filter | `0xA9/10 0F ...` / read `10` | `MovieAiFilterController` / `AiFilterController` |

### 4.1 Movie Feast REST endpoints

| Operation | Method + path | Request / response |
|---|---|---|
| Create feast | `POST /appsku/v1/moment/feasts` | `FeastAddRequest{device,name,sku,needAddCard=1,nameCount,musicFeast}` |
| Delete feast | `DELETE /appsku/v1/moment/feasts` | `FeastDeleteRequest{gId,name}` |
| Rename feast | `PUT /appsku/v1/moment/feasts/names` | `FeastEditNameRequest{name,gId}` |
| Detail | `GET /bff-app/v1/moment/feasts/details` | feast detail response |
| Main device | `GET /bff-app/v1/moment/feasts/main-devices` | main-device response |
| Sub-devices | `GET /bff-app/v1/moment/feasts/sub-devices` | `FeastSubDeviceRequest{gId,mark}` / device list |
| Region / areas | `POST /appsku/v1/moment/feasts/region` | `FeastRegionRequest{gId,deviceAreaConfigs:[{sku,device,areaConfigs[],switchConfigs[],extStr}]}` |
| Music feast categories | `GET /bff-app/v1/scene/music-feast` | category list |
| Music feast effect | `POST /bff-app/v1/scene/music-feast/effect` | effect detail |
| Music feast voice | `PUT /bff-app/v1/music-feast/voice`, `PUT /bff-app/v1/music-feast/voice/btn` | voice edit / toggle |
| Scene feast create | `POST /bff-app/v1/scene-feast` | scene-feast body |
| Scene feast control | `POST /bff-app/v1/scene-feast/iot-control` | control body |
| Scene feast devices | `GET /bff-app/v1/scene-feast/devices` | device list |
| Scene feast edit device/name/voice | `PUT /bff-app/v1/scene-feast/device`, `/name`, `/voice`, `/voice/btn` | edit bodies |
| Mute | `POST /bff-app/v1/feast/mute` | mute request |
| Snapshot command | `POST /bff-app/v1/feast/snapshot/cmd-refactor` | `SnapshotCmdRequest{feastId,feastType,mainSku,mainDevice,mainVersionHard,mainGoodsType,mainPactType,mainPactCode,newSubDevices[],oldSubDevices[]}` |

Sources: `com/govee/home/main/device/moment/net/IMomentNet.java`,
`.../net/request/Feast*Request.java`, `com/govee/home/compose/feast/SnapshotCmdService.java`. The
recent-app screenshot/streaming pipeline itself is not a protocol module.

## 5. Corrections applied to earlier split docs

- `split_pact_tvlightv4.md`:
  - `0xAB/0x00` white balance → **`0xA9/0x00`** (classic) or `0xA9/0x06/0x0F` variants.
  - `0xAB/0x02` whole-RL brightness → **`0xA9/0x02`**.
  - `0xAB/0x0B` black-border remove → **`0xA9/0x0B`**.
  - Timer line `0xAB/0x23`, `0xAA/0x11`, `0xAA/0x12` → correct write/read forms:
    timer `0x33/0x23` (read `0xAA/0x23`), sleep/wake `0x33/0x11`/`0x33/0x12`.
- `split_pact_h6099.md`:
  - `0xA9` table rebuilt (see §1). `07` is DSP version read, `09` AI update status,
    `0A` device black screen, `0C` HDMI black screen, `0D` HDR calibration, `0E`
    saturation, `0F` advanced white balance, `10` AI filter, `11` HDR effect, `12`
    auto WB, `13` check WB, `14` exit calibration.
  - `08` colour calibration/AI action corrected: colour calibration is `05`, AI action
    is `04`.
  - Audio source is `0xB7`, not `0xA9/0x0D`.
- `split_pact_h6099.md` §7.5 and `split_pact_tvlightv4.md` §5.5 now point at the
  per-SKU `VideoVm` byte-order table in §2.

## 6. Source map

- Shared video settings: `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/videomode/newdetail/`
  - `controller/` — `VideoSensitivityController`, `VideoSaturationController`,
    `VideoHdrEffectController`, `VideoAutoWbController`, `VideoCheckWbCaliController`,
    `HDRCaliController`, `AiFilterController`, `ColorCaliController`
  - `funtion/` — `WhiteBalanceVmInterface`, `WholeRLBrightnessVmInterface`,
    `RLBrightnessVmInterface`, `BlackBorderVmInterface`, `SaturationVmInterface`,
    `HDRVmInterface`, `HDRContrastVmInterface`, `AiFilterVmInterface`,
    `ColorCaliVmInterface`, `SoundEffectVmInterface`
  - `data/VideoModeControllerParams.java`, `data/VideoModeParams.java`
- Black screen: `base2light/balckscreen/` (`BlackScreenController`, `BlackScreenHdmiController`,
  `BlackScreenBean`, `BlackScreenHdmiBean`, `BlackScreenHdmiDefaultParams`)
- Relative brightness: `base2light/relativebrightness/controller/RelativeBrightnessController.java`
- HDMI metadata: `pact_h605b/add/net/hdmi/HdmiApi.java`, `HdmiResolutionBean/Response`,
  `com/govee/kt/HdmiIconVM.java`, `com/govee/kt/net/INet.java`
- Movie Feast: `com/govee/home/main/device/moment/moviefeast/`,
  `com/govee/home/main/device/moment/feastcreate/bean/FeastType.java`,
  `com/govee/home/compose/feast/SnapshotCmdService.java`
- Per-SKU video VMs: `pact_tvlightv4/detail/mode/VideoVm.java`,
  `pact_h6099/{detail,pact_h605b,adjust}/.../VideoVm*.java`,
  `split_pact_h604a/.../VideoVmH604x.java`,
  `split_pact_rgblight/.../h6104/newdetail/viewmodel/VideoVm.java`

## 7. Per-SKU / firmware support gates

These are the `Support.*` checks that decide whether a setting is exposed. Version
arguments are `(soft, wifiSoft, dsp, hard)` unless noted; `pactV*` means the runtime
protocol tuple enables it regardless of version.

### 7.1 HDMI / H605B / H660x / H6099 family

| SKU / goodsType | Black screen + border | White balance | Segment rel. brightness | HDR / HDR contrast | Notes |
|---|---|---|---|---|---|
| H605B / H605D (82) | `supportBlackScreenH605BCD`: WiFi `3.02.01`, soft ≥ `1.03.01`, hard == `1.03.10`, DSP ≥ `1.00.13` | soft ≥ `1.01.08`, WiFi ≥ `3.02.01`, DSP ≥ `1.00.08`, hard ≥ `1.03.10` | same gate as black screen | no | HDMI 3-port |
| H605C (120) | H605BCD gate, hard ≥ `1.00.08` | yes | soft ≥ `1.00.12`, hard ≥ `1.00.08` | no | HDMI 4-port |
| H2A40 (360) | yes | yes | yes | no | HDMI 2.1 |
| H6601 (138) | soft ≥ `1.00.38`, WiFi == `2.01.01` | yes | WiFi == `3.04.01`, soft ≥ `1.00.23` | no | color cali soft ≥ `1.00.16` |
| H6602 (142) | soft ≥ `1.00.38`, WiFi == `2.01.01` | yes | WiFi ∈ {`3.04.12`,`3.04.13`,`3.04.14`}, soft ≥ `1.00.24` | no | color cali yes |
| H6603 (192) | soft ≥ `1.00.04`, WiFi == `2.01.11` | yes | yes | WiFi ≥ `2.02.11`, DSP == `2.01.11` | color cali yes |
| H6604 (243) | yes | yes | yes | WiFi ≥ `2.02.11`, DSP == `2.01.11` | color cali yes |
| H6608 (172) | no | yes | no | no | TV strip |
| H6099 (191/253) | yes; border only if soft ≥ `1.00.11` | yes | yes | no | H6099/H605A share 253 |
| H6098 (203) / H6097 (273) / H6690 (336) | yes | yes | yes | no | border yes |
| H66A0 (327) | yes | yes | yes | `supportHdrContrast` true | auto WB; check WB if soft ≥ `1.01.16` |

`supportAiFilter` is **not** goodsType-coded: it comes from
`Config4DeiceFuc.supportAiFilter()` (per-device capability config). Same for some HDR/
saturation gates in other families.

### 7.2 TV backlights (tvlightv2/v3/v4)

| Feature | Gate |
|---|---|
| White balance | `supportWhiteBalance`: hard starts `1.08.11`, WiFi ≥ `3.02.01`, DSP ≥ `1.00.23`, and `d(hard)` true |
| Whole-RL brightness (FRK) | soft ≥ `1.09.11`, WiFi ≥ `3.02.01`, DSP ≥ `1.00.29`; hard ≥ `1.00.01` if hard starts `1.00`, else ≥ `1.03.00` |
| Whole-RL brightness (TL) | soft ≥ `H`, WiFi ≥ `1.00.00`, DSP ≥ `1.00.28`, hard ≥ `1.00.01` |
| Whole-RL brightness (H6049) | soft ≥ `1.09.11`, WiFi ≥ `3.02.01`, DSP ≥ `1.00.29`, hard ≥ `1.03.00` |
| Segmented colour H6054 / H6049 | soft/WiFi/DSP gates (`supportFenduanse4H6054`, `supportFenduanse4H6049`) |
| AI effect | `supportAiEffect`: pactV3, or soft ≥ `1.06.01` (Telink) / `1.07.01` (FRK) |
| Video sound scenes | `supportVideoSoundAndServiceScenes`: pactV3, or soft ≥ `1.06.01` (Telink) / `1.07.01` (FRK) |

### 7.3 Other DreamView families

| Family | Gate |
|---|---|
| H604A/H604C (95/122, `isH604aType`) | black screen + border yes; segment relative brightness yes; video brightness soft ≥ `1.00.05`, hard ≥ `1.03.20` |
| H604B/H604D (109/133, `isH604bType`) | black screen + border yes; segment relative brightness yes; video brightness same gate |
| H6104 | only the minimal `05 00 00 <screenState> <vivid>` video form; no shared video settings UI |
| H6609/H6250 (h6840) | uses the shared `VideoModeParams`/`0xA9` path; HDR/saturation/AI-filter gates are UI/`Support`-driven and not fully enumerated here |

## 8. Gaps / runtime data

- Support gates (`Support.supportHDR`, `supportSaturation`, `supportBlackScreen`,
  `supportBorderRemove`, `supportVideoBrightness`, `supportAdvancedWhiteBalance`, …) decide
  which SKUs expose each setting. They are version/SKU-dependent; not every family has all
  of them.
- HDMI resolution and icon lists are server-provided; only the models/endpoints are static.
- AI filter fields are decoded from `AiFilterStatusBean`/`AiFilterViewModel` (enable,
  R/G/B, saturation, filter code, auto-close minutes, expiration time-of-day, timezone);
  the timezone encoding is still a raw 4-byte blob.
- Movie Feast group CRUD/snapshot endpoints and core request fields are now catalogued in
  §4.1; nested response schemas (device/area lists) are still server-owned.
- `0xA9` sub-op semantics can collide by design (`05` video mode vs `05` colour
  calibration vs `05 04` extra), distinguished by the sub-type byte.
