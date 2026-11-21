# split_pact_hollowlamp — hollow lamps, straight floor lamps, table lamps, H6057 speaker lamp

Source root: `decompiled/jadx-splits/split_pact_hollowlamp/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

This split bundles four product programs plus one stray H6078 effect class:

1. `com/govee/hollowlamp` — "hollow lamp" family (candle/ambient lamps), 7 SKUs
2. `com/govee/h6057` + `h6057/origin` — H6057 lamp with speaker/voice/battery/preset scenes
3. `com/govee/straightfloorlamp` — straight floor lamp family, 6 SKUs
4. `com/govee/tablelampv1` — H6052/H6078 table lamps
5. `com/govee/h6630/detail/diy/advance/H6078ProGraffitiEffect.java` — AI/graffiti DIY effect for H6078

---

## 1. Overview / family and SKUs

| SKU | goodsType | family | transports | registration |
|---|---|---|---|---|
| H6050 | 27 | hollow/candle lamp | ble + iot | `hollowlamp/pact/bleiot/H6050Maker` `AbsBleWifiSku` |
| H6051 | 37 | hollow lamp | ble + iot | `H6051Maker` `AbsBleWifiSku` |
| H6055 | 42 | portable hollow lamp (battery) | **ble** | `hollowlamp/pact/ble/H6055Maker` `AbsBleSku` |
| H6058 | 59 | hollow lamp (energy saving) | ble + iot | `H6058Maker` `AbsBleWifiSku` |
| H6059 | 84 | hollow lamp (PIR/auto induction + sensitivity) | ble + iot | `H6059Maker` `AbsBleWifiSku` |
| H6073 | 58 | hollow lamp | ble + iot | `H6073Maker` `AbsBleWifiSku` |
| H1771 | 395 | hollow lamp, 4-color / new scenes | ble + iot | `H1771Maker` `AbsBleWifiSku` |
| H6057 | 104 | lamp with speaker, voice, battery, presets | ble + iot | `h6057/present/SkuItemClickH6057`; add flow WiFi |
| H6072 | 30 | straight floor lamp | ble + iot | `straightfloorlamp/pact/H6072Maker` `AbsBleWifiSku` |
| H8072 | 30 | straight floor lamp (same goods type) | ble + iot | same |
| H6076 | 69 | straight floor lamp | ble + iot | `H6076Maker` |
| H60B2 | 312 | straight floor lamp | ble + iot | `H60B2Maker` |
| H3270 | 409 | straight floor lamp, AI effects | ble + iot | `H3270Maker` |
| H16C0 | 377 | straight floor lamp | ble + iot | `H16c0Maker` |
| H6052 | 22 | table lamp | ble + iot | `tablelampv1/pact/V1BleIotSkuItem` `AbsBleIotSkuItem` |
| H6078 | 128 | table/floor lamp (RGBICWW) | ble + iot | `V2BleIotSkuItem` |

Notes:

- `Hollowlamp Support` exposes `a="H6050"`, `b="H6055"`, `c="H6058"`.
  `Support.d()` (= `j`) is `{42}` and is used by the **BLE-only** `SubLib`;
  `Support.e()` (= `k`) is `{27,37,59,58,84,395}` and is used by `SubLib4BleIot`;
  `Support.g()` (= `l`) is the full `{27,37,42,59,58,84,395}` list.
  `Register4Item` registers both `SubLib4BleIot` and `SubLib`.
- Only **H6055 is BLE-only** (`AbsBleSku`, battery-powered). All other SKUs are
  `AbsBleWifiSku`/`AbsBleIotSkuItem` → **ble + iot** (`turn`/`brightness`/`colorwc`/`ptReal`).
- No Matter, IR/RF or Thread support is declared in this split.
- H6050/H6051/H6055/H6058 additionally support **group factor** V1/V2/V3 (`GroupBle`,
  `GroupBleV2`, `GroupBleV3`, `GroupOp*`) for multi-device sync.

Kelvin ranges (`hollowlamp/pact/Support.getColorTemRange`):

| goodsType | range |
|---|---|
| 27 (H6050) | 1800–3000 |
| 37, 84 (H6051, H6059) | 2200–6500 |
| 58, 59 (H6073, H6058) | 2200–6500 |
| 395 (H1771) | 1000–10000 |
| 42 (H6055) | 1000–10000 (default branch) |
| H6057 (104) | 1000–10000 |
| straightfloorlamp | 1000–10000 |
| tablelampv1 | 2200–6500 |

Brightness is 1–100 everywhere (default `BrightnessController`); no range inversion.

---

## 2. Transports & GATT UUIDs

All families use the same vendor GATT pair:

```
service        00010203-0405-0607-0809-0a0b0c0d1910
characteristic 00010203-0405-0607-0809-0a0b0c0d2b11
```

Declared in `hollowlamp/ble/BleComm.java`, `BleMultiComm.java`, `h6057/origin/ble/BleComm.java`,
`straightfloorlamp/ble/BleComm.java`, `tablelampv1/ble/BleComm.java`.

- write proType `0x33`, read proType `0xAA`, multi-packet write `0xA3`
- frame: `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC`
- parser data = frame `[2..18]` (17 bytes)
- `AbsModeController.p()` = `{0x01}` (read mode)
- multi-packet V1 (`MultipleControllerCommV1.makeSendBytesV1`):
  `[0]=0xA3, [1]=0 first / index / 0xFF last, [2]=1 or chunk, [3]=total packets, [4]=cmdType (first packet)`.

`straightfloorlamp` writes gradual-change via `0x33/0xA3` (cmdType equals 0xA3) — see gaps.

---

## 3. BLE frame + command table

### 3.1 Common to all families

| name | op | payload | layout | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `01 <0/1>` | `[0]` | base `SwitchController` |
| brightness | `0x33/0x04` | `04 <1..100>` | `[0]` | base `BrightnessController` |
| heartbeat | `0xAA/0x01` | `01` | `[0]` alive | base `HeartController` |
| read mode | `0xAA/0x05` | `05 01` | — | base `AbsModeController` |
| read color group | `0xAA/0xA5` | `A5 <group>` | response `[0]=group`, then 4 × `brightness,R,G,B` | base `Controller4ColorInfoByGroup` |
| read bulb color | `0xAA/0xA2` | `A2` | colour-only read (straightfloorlamp) | base `Controller4ColorInfoByGroup.generateReadController4OnlyColor` |

### 3.2 hollowlamp (H6050/H6051/H6055/H6058/H6059/H6073/H1771)

| name | op | payload | layout | source |
|---|---|---|---|---|
| color | `0x33/0x05` | `05 0D R G B CT_H CT_L R2 G2 B2` | sub-mode 0x0D, CT 16-bit **big-endian**, R2G2B2 = temperature RGB | `hollowlamp/ble/SubModeColor.java` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi>` | effect 16-bit **little-endian**, default 0x22 (34) | `hollowlamp/ble/SubModeScenes.java` |
| DIY | `0x33/0x05` | `05 0A <diyLo> <diyHi>` | 16-bit LE | `hollowlamp/ble/SubModeNewDiy.java` |
| music V1 | `0x33/0x05` | `05 0E <effect> <sens> <flag> [R G B]` | flag 0 = auto (4 bytes), 1 = manual color (7 bytes); sens 0–99 | `hollowlamp/ble/SubModeMusic.java` |
| music V2 | `0x33/0x05` | `05 0F 04 <sens> <effect> <flag> [R G B]` | 8 bytes; effect mode id, flag 0 auto / 1 manual | `hollowlamp/ble/SubModeMusicV2.java` |
| music V3 | `0x33/0x05` | `05 13 <effect> <manual> <sens> 00` | effect **75 = Rhythm**, **76 = Magic**; manual 0/1; sens 0–99 | `hollowlamp/ble/SubModeMusicV3.java` |
| multi music color | `0xA3/0x41` | `41 <musicEffect> <count> <R G B>×count` | multi-packet; realtime per-segment music colors; musicEffect = 75/76 | `hollowlamp/ble/MultiMusicController.java` |
| local color read | `0xAA/0xA5` | `A5 <page>` | 24-slot table, 4 colors per response | `hollowlamp/ble/LocalColorReadControllerV1.java` |
| local color write | `0xA3/0xA5` | `A5 <count> <R G B CT_H CT_L>×count` | 24 local colors, 5 bytes each | `hollowlamp/ble/LocalColorSettingMultiControllerV1.java` |
| auto induction | `0x33/0xA6` | `A6 <0/1>` | PIR/auto on-off (H6059) | `hollowlamp/ble/OnOffAutoInductionController.java` |
| sensitivity | `0x33/0xA7` | `A7 <value>` | PIR sensitivity (H6059, soft ≥ 1.00.12) | `hollowlamp/ble/SensitiveController.java` |
| mic realtime RGB | `0x33/0x83` | `83 R G B` | group/mic realtime segment color | base `MicSetRgbController` |

`ble/BleProtocol.java` constants: `14/0x0E`, `15/0x0F`, `19/0x13`, `65/0x41`, `75/0x4B`,
`76/0x4C`, `4`, `1`, `0`, `13/0x0D`, `34/0x22`, `32/0x20`, `-91/0xA5`, `-90/0xA6`, `-89/0xA7`, `54/0x36`.

### 3.3 H6057 (speaker lamp)

Sub-modes (`h6057/origin/ble/Mode.java`): color `0x0D`, scenes `0x04`, DIY `0x0A`,
game `0x0B`, music `0x13`.

| name | op | payload | layout | source |
|---|---|---|---|---|
| scene w/ music | `0x33/0x05` | `05 04 <effLo> <effHi> <musicCode>` | 16-bit LE effect + music code | `h6057/.../SubModeScenes.java` |
| game | `0x33/0x05` | `05 0B <gameCode>` | game id | `h6057/.../SubModeGame.java` |
| music | `0x33/0x05` | `05 13 <musicCode> <sens>` | 0–99 | `SubModeMusic.java` |
| light switch | `0x33/0x30` | `30 <0/1>` | main light | `BleProtocol.command_light_switch` |
| energy saving | `0x33/0x16` | `16 <0/1>` | low-energy mode | `EnergySavingController.java` |
| play voice | `0x33/0x31` | `31 <index>` | play voice prompt | `Controller4PlayVoice.java` |
| pause voice | `0x33/0x32` | `32 <index>` | pause voice | `Controller4PauseVoice.java` |
| preview effect | `0x33/0x27` | `27 <f> <h> <g> <i> <j> <kHi> <kMid> <kLo>` | 8-byte preview (3-byte colour code `k`) | `Controller4PreviewEffect.java` |
| preset info | `0xAA/0x24` | `24` | pre-set info (count/ids) | `PreSetInfoController.java` |
| preset color | `0x33/0x25` | `25 <index>` | read/write preset color slot | `PreSetColorController.java` |
| preset scene | `0x33/0x26` | `26 <index>` | read/write preset scene slot | `PreSetSceneController.java` |
| delete preset scene | `0x33/0x28` | `28 <bytes>` | delete | `DeletePreSetSceneController.java` |
| sort preset scenes | `0x33/0x29` | `29 <bytes>` | reorder | `SortPreSetSceneController.java` |
| multi preset color | `0x33/0x0B` | `0B <bytes>` | multi-slot preset colour | `MultiPreSetColorController.java` |
| volume | `0x33/0x33` | `33 <0..N>` | speaker volume | `BleProtocol.command_volume` |
| detail info | `0xAA/0x34` | `34` | detail data (JSON bean) | `GetDetailInfoController.java` |
| no disturb | `0x33/0x35` | `35 <0/1>` | do-not-disturb | `BleProtocol.command_no_disturb` |
| night mode | `0x33/0x36` | `36 <0/1>` | night mode | `BleProtocol.command_night_mode` |
| prompt tone | `0x33/0x37` | `37 <0/1>` | hint voice | `PromptToneController.java` |
| indicator light | `0x33/0x38` | `38 <0/1>` | indicator LED | `GuideLightController.java` |
| worry-free night | `0x33/0x36` | `36 01 <a> <b> <c> <d> <e> <f>` | 7-byte night policy (shares cmdType 0x36) | `WorryFreeAtNightController.java` |

H6057 is the only SKU with a **battery** and **speaker** in this split.

### 3.4 straightfloorlamp (H6072/H8072/H6076/H60B2/H3270/H16C0)

Sub-modes (`straightfloorlamp/ble/BleProtocol.java`): color `0x14`, colorV2 `0x15`,
scenes `0x04`, music `0x0F`, abs music `0x16`, DIY `0x0A`.

| name | op | payload | layout | source |
|---|---|---|---|---|
| color (legacy) | `0x33/0x05` | `05 14 R G B CT_H CT_L R2 G2 B2 00 <mask>` | 11 bytes; mask bit per segment | `straightfloorlamp/ble/SubModeColor.java` |
| color V2 | `0x33/0x05` | `05 15 <subtype…>` | subtype 1 RGB+CT+mask (14B), 2 brightness+mask, 3 brightness set, 4 strip group | `straightfloorlamp/ble/SubModeColorV2.java` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi>` | 16-bit LE; default 2002, H6072/H8072 → 2099, H6076 → 2143 | `SubModeScenes.java` |
| music | `0x33/0x05` | `05 0F <effect> <sens> <flag> [R G B]` | 7 bytes, or 8 bytes when effect 4 (extra mode byte) | `straightfloorlamp/ble/SubModeMusic.java` |
| music V2 | `0x33/0x05` | `05 0F <effect> <sens> <flag> [R G B]` | new music codes; auto/manual | `SubModeMusicV2.java` |
| abs music | `0x33/0x05` | `05 16 <…>` | base `SubModeAbsMusic` (energy/impact/jet/joy/jump/rhythm) | base `SubModeAbsMusic` |
| DIY | `0x33/0x05` | `05 0A <diyLo> <diyHi>` | 16-bit LE | `SubModeNewDiy.java` |
| gradual change | `0x33/0xA3` | `A3 <0/1>` | on/off gradual transition (cmdType literally 0xA3) | `Gradual4BleWifiController.java` |
| remote pair | `0x33/0xA4` | `A4 01` | start pairing | `RemoteController.java` |
| exit remote pair | `0x33/0xA6` | `A6` | stop pairing | `ExitRemoteController.java` |

Segment counts (`Support.getBulbStringMaxNum`): **8** (30/H6072/H8072, default), **7**
(69/H6076, 377/H16C0), **3** (H60B2-like goods 312). AI effects enabled for some
versions (`Support.supportAiEffect`, `DiyM.EffectCode` categories 29/30).

### 3.5 tablelampv1 (H6052/H6078)

Sub-modes: color `0x0D`, scenes `0x04`, music `0x0F`, music new `0x13`, DIY `0x0A`.

| name | op | payload | layout | source |
|---|---|---|---|---|
| color | `0x33/0x05` | `05 0D R G B CT_H CT_L R2 G2 B2` | 9 bytes | `tablelampv1/ble/SubModeColor.java` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi>` | 16-bit LE, default 13 | `SubModeScenes.java` |
| music | `0x33/0x05` | `05 0F <effect> <sens> <flag> [R G B]` | 7 bytes, effect 4 → 8 bytes | `SubModeMusic.java` |
| music V2 | `0x33/0x05` | `05 13 <musicCode> <sens>` | H6078 music codes 105/72/85/50/84/98 | `ble/v2/SubModeMusicV2.java`, `newAdjust/H6078MusicMode.java` |
| DIY | `0x33/0x05` | `05 0A <diyLo> <diyHi>` | 16-bit LE | `SubModeNewDiy.java` |
| indicator light | `0x33/0x16` | `16 <enable> <startH> <startM> <endH> <endM>` | forever → `16 01 FF FF FF FF` | `NewLightIndicatorController.java` |

`H6052` exposes 2 color pieces, `H6078` 1 (`Support.getColorSize`). H6078 adds
`H6078MusicMode` (codes above) and the AI/graffiti effect
`h6630/detail/diy/advance/H6078ProGraffitiEffect.java`.

---

## 4. BLE notifications / readings

| family | op | parser | layout |
|---|---|---|---|
| hollowlamp | `0x20` | `BrightnessNotifyParse` | `[0]` brightness |
| hollowlamp | `0x40` | `DeviceStatusNotifyParse` | first 10 bytes |
| hollowlamp | `0x11` | `WifiNotifyParse` | `[0]==0` connected |
| H6057 | `0x20` | `BrightnessNotifyParse` | `[0]` brightness |
| H6057 | `0x30` | `DeviceInfoNotifyParse` | sub-command `[0]`: 1 light status (`bit1`), 2 energy saving (`bit1`), 3 battery, 4 music info (`[1]`,`[2]`), 5 volume, 6 no-disturb (`bit1`), 7 sleep (`SleepControllerV1`) |
| straightfloorlamp | `0x20` | `BrightnessNotifyParse` | `[0]` brightness |
| straightfloorlamp | `0x11` | `WifiNotifyParse` | `[0]==0` |
| straightfloorlamp | `0xA4` | `RemoteControlParse` | `[0]` pairing/remote byte |
| straightfloorlamp | `0x40` | `DeviceStatusNotifyParse` | 10 bytes |
| straightfloorlamp | `0x60` | `MovieFeastOnOffNotifyParse` | movie feast |
| tablelampv1 | `0x20` | `BrightnessNotifyParse` | `[0]` brightness |
| tablelampv1 | `0x11` | `WifiNotifyParse` | `[0]==0` |

### Battery (H6055, H6057)

- H6055: heartbeat/status byte `[4]`:
  - `bit7` = charging
  - `bits6..4` = grade 1..5 (clamped, 0 or >5 → 5)
  - `bit3` = full
  (`hollowlamp/newdetails/h6055/H6055NewDetailVm.parseBatteryInfo`)
- H6057: `DeviceInfoNotifyParse.parseBatteryInfo` byte:
  - `bit8` charging, `bits7..5` grade (3 bits), `bit4`, `bit3` full, `bit1` present
  (bit numbering is `ParseUtils.getBit2Boolean` MSB=8).

---

## 5. IoT commands + status/readings schema

All IoT-capable SKUs use the same command set:

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0/1}` | `hollowlamp/iot/CmdTurn`, `h6057/.../CmdTurn`, `straightfloorlamp/iot/CmdTurn`, `tablelampv1/iot/CmdTurn` |
| `brightness` | `{"val":1..100}` | `CmdBrightness` in each package |
| `colorwc` | `{"colorTemInKelvin":…}` or `{"red","green","blue"}` | `CmdColorWc` (kelvin range per family) |
| `ptReal` | `{"command":["<base64 20-byte frame>",…]}` | `CmdPtReal` in each package |
| `status` | read (`type=0`) | `CmdStatus` / `AbsIotManagerV1` |
| `online` | read | `AbsIotManagerV1` |

### Status parsing

**hollowlamp** (`hollowlamp/iot/CmdStatusV0.java`, `CmdStatusV1.java`):

```
state: { onOff:int, brightness:int, mode:int }
op.command: [base64 frames]
  0x05 -> mode + sub-mode
  0x23 -> timers (4)
  0x11 -> sleep
  0x12 -> wakeup
  0xA5 -> local color table size (frame[3])
  0xA6 -> auto induction (frame[2])
  0xA7 -> sensitivity (frame[2])
  0x16 -> energy saving (frame[2])   // V1
  0x01 -> energy saving (frame[5])   // V1 fallback
```

**h6057** (`h6057/origin/iot/CmdStatusV1.java`): same `state`, plus
`0x34` detail info (battery/volume/music), sleep v1 (`0x11`), wakeup v1 (`0x12`),
timers (`0x23`).

**straightfloorlamp** and **tablelampv1**: no family `CmdStatus*` parser; they use the
generic base IoT manager `state` + `op.command` (`0x05` mode / `0x04` scene frames).

`ptReal` is used for scenes, advanced scenes, DIY blobs, color strips and multi-zone
frames. `CmdPtReal.getCommand()` is just a list of base64 frames; some families append a
mode frame (`0x05/0x04 <code>`) to the final group.

---

## 6. Other protocols

| name | details | source |
|---|---|---|
| battery / BLE-only | H6055 is battery powered and BLE-only; heartbeat byte supplies charge/grade/full. | `hollowlamp/newdetails/h6055/H6055NewDetailVm.java` |
| speaker / voice | H6057 plays voice prompts, has volume, night/no-disturb, preset scenes, game mode, and detail-info query. | `h6057/origin/ble/*Controller.java` |
| group factor / sync | H6050/H6051/H6055 support group control V1/V2/V3. `GroupBle*.C(byte[])` reinterprets stored colour/brightness/music frames; mic realtime uses `MicSetRgbController` (`0x83`). | `hollowlamp/ble/GroupBle*.java`, `GroupOp*.java` |
| Matter / MQTT / LAN | none in this split. | — |
| BLE remote | straightfloorlamp only: `0xA4` pair / `0xA6` exit, notify `0xA4`. | `straightfloorlamp/ble/RemoteController.java` |

---

## 7. Dynamic effects / motion / music / scenes / DIY

### hollowlamp

- **Color**: 0x0D payload `[R,G,B,CT_H,CT_L,R2,G2,B2]`; CT is kelvin for white mode,
  R2G2B2 is the temperature RGB.
- **Scenes**: 0x04 with 16-bit LE effect; default 0x22 (34). Groups from
  `Support.supportScenesOpSet`: `{0,1}` for all, **H1771** `{0,1,2,3,6,5,4}`
  (new scenes). Hints: 108, 1114, 0 (GM), 1 (sunset).
- **DIY**: effect codes from `DiyM.EffectCode` (`l`=0, `m`=1, `n`=2, `s`=4, `t`=5, `g`=255 mix;
  AI categories 28/29/30; H6059 adds 82/83). Max 8 colours/effect,
  speed 1–100 (default 50); `3D`/advanced DIY via `diyNew`.
- **Music**:
  - 0x0E: effect id (0/1), sensitivity, auto flag, optional manual RGB.
  - 0x0F: effect mode 4, sensitivity, effect id, auto flag, optional RGB.
  - 0x13: effect 75/76 (Rhythm/Magic), manual flag, sensitivity.
  - 0x41 multi-packet: `41 <musicEffect> <count> <RGB>×count` realtime segment colour.
- **Local colour**: 24 stored colours, 5 bytes each; read page by page via 0xA5.
- **Sensitivity / auto induction** (H6059): 0xA7 / 0xA6.
- **Energy saving** (H6058, soft ≥ 1.01.05): 0x16.
- **Battery** (H6055): heartbeat byte 4.

### H6057

- Scenes carry a music code byte; game mode 0x0B; preset slots 0x24–0x29; preview 0x27;
  voice/volume/night/no-disturb; battery and detail info. It is a "lamp + speaker"
  product, not a pure light.

### straightfloorlamp

- **8/7/3 segments** (per SKU) with per-segment mask in the colour payload.
- **Scenes**: 16-bit LE, defaults 2002 / 2099 (H6072/H8072) / 2143 (H6076);
  groups `{0,1,2,3}` (H3270 adds 5, and `{0,1}` for old H6072 versions).
- **Music**: effect ids `0` energy, `1` rhythm dynamic, `0` rhythm soft, `2` joy,
  `4` rhythm, `6` impact, `7` jet, `8` jump (+ `0x16` abs-music container).
- **DIY**: full 8-effect set (colour/speed/sensitivity); AI effect categories 29/30;
  DIY version 0/1 depending on SKU/version.
- **Gradual change**: `0xA3` on/off for smooth transitions.
- **Remote**: pair/exit 0xA4/0xA6.

### tablelampv1

- Color 0x0D; scenes 0x04; music 0x0F (legacy) / 0x13 (H6078); DIY 0x0A.
- Indicator schedule 0x16 (`enable,startH,startM,endH,endM`; forever = `01 FF FF FF FF`).
- H6078 music codes 105, 72, 85, 50, 84, 98; AI/graffiti effect from
  `h6630/detail/diy/advance/H6078ProGraffitiEffect.java`.

---

## 8. Source map

- hollowlamp: `hollowlamp/pact/{Support,SubLib,SubMaker,Register4Item}.java`, `ble/{BleProtocol,Mode,SubModeColor,SubModeColorV2,SubModeScenes,SubModeMusic,SubModeMusicV2,SubModeMusicV3,SubModeNewDiy,MultiMusicController,LocalColor*,SensitiveController,OnOffAutoInductionController,GroupBle*,GroupOp*}.java`, `iot/*`, `newdetails/*`, `adjust/Diy.java`
- h6057: `h6057/origin/ble/*`, `h6057/origin/iot/*`, `h6057/origin/newDetail/Diy.java`, `h6057/bean/*`
- straightfloorlamp: `straightfloorlamp/pact/*`, `ble/*`, `iot/*`, `adjust/Diy.java`, `adjust/Info4Detail.java`
- tablelampv1: `tablelampv1/pact/*`, `ble/*`, `ble/v2/*`, `iot/*`, `adjust/Diy.java`, `newAdjust/H6078MusicMode.java`
- base: `base2light/ble/controller/*`, `base2light/iot/*`, `base2light/pact/newdetail/*`, `base2light/ac/diy/DiyM.java`, `base2light/ble/controller/SubModeAbsMusic.java`

---

## 9. Gaps / unknowns

1. **H6073 (58) vs H6058 (59)** differ only by capabilities (energy saving on 59) in
   `Support`; no separate command class exists, so behaviour is version-gated.
2. **H6057 cmdType 0x36** is used by both night-mode (`36 <0/1>`) and worry-free-night
   (`36 01 …`); the multi-byte form is identified by the leading `01` payload byte.
3. **straightfloorlamp gradual change** uses cmdType `0xA3` even though `0xA3` is also the
   multi-packet proType; frames are `33 A3 <0/1>` and must be distinguished by proType.
4. **Scene/DIY catalogues** (effect IDs, names, AI categories) are cloud-driven
   (`ScenesOp`, `DiyNewConfig`, `DiyM`); only IDs/formats are static. DIY blob internals
   are effect-specific (see `DiyM.EffectCode`, `Pro4H60B1Diy`/`DiyProtocol`).
5. **H6055 battery grade** is quantized to 5 levels by the parser; raw charge percentage
   is not transmitted.
6. **H6630/H6078 ProGraffitiEffect** lives under `h6630` even though the SKU is H6078;
   the class is referenced by the H6078 DIY/AI path, not by an H6630 device.
7. No Matter/MQTT/LAN protocol exists for any SKU in this split; cloud control uses
   `turn`/`brightness`/`colorwc`/`ptReal`.
