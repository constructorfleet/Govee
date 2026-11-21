# split_pact_bulblightstringv1 — bulb-string / bulb-light families

Source root: `decompiled/jadx-splits/split_pact_bulblightstringv1/sources`
Base helpers: `decompiled/jadx-base-7.7.10/sources`

This split is a *bundle* of eight product families that all speak the
`base2light` RGB bulb/BLE dialect:

| sub-family | Java package(s) | goodsType(s) | transports |
|---|---|---|---|
| bulblightstringv1 (H7002/H7005) | `com.govee.bulblightstringv1` | 3, 5 | ble / ble+iot |
| bulblightstringv2 (H7010…H7032, H7019) | `com.govee.bulblightstringv2` | 35, 49, 91, 148 | ble, ble+iot |
| bulblightv1 (H6003/H6004, legacy IoT) | `…bulblightstringv1.bulblightv1` | 9, 10 | iot only |
| bulblightv2 (H6005 / updated H6001) | `…bulblightstringv1.bulblightv2` | 20 | ble |
| bulblightv3 (H6002…H14B1) | `com.govee.bulblightv3` | 31, 64, 111, 311, 328, 342, 348, 408 | ble+iot |
| bulblightv3 solar (H3210/H3520) | `com.govee.bulblightv3.solar` | 420, 419 | ble |
| h6001 (classic H6001) | `…bulblightstringv1.h6001` | (SKU-keyed) | ble |
| h7022 | `com.govee.h7022` | (SKU-keyed) | ble+iot |

All the SKU lists come from `pact/SubLib*.keys()` (`Support.f/g`, `Support.q/r`,
`Support.F/K`, `H7022Constant.f`, `Sku.b`, …).

---

## 1. Transports & GATT UUIDs

Every family in this split that uses GATT overrides the same pair:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

Declared in each `ble/BleComm.java` and each `ble/BleMultiComm.java`
(`P/Q`, `L/M`), plus group variants in the v2 family
(`BleCommGroup`, `BleMultiCommGroup`). No family in this split overrides the
UUIDs with anything else. See source map for the per-family files.

Transports by goodsType / SKU:

- **ble only**: H7002(3), H6005/H6001(20), H7019(148), H3210(420), H3520(419),
  the whole `h6001` package.
- **ble + iot**: H7005(5), H7022, H7010…H7032 under goodsType 49/91, and
  H6002/H601A…/H601EF/H8015/H14xx (31/64/111/311/328/342/348/408).
- **iot only**: H6003(9), H6004(10) — pure `AbsIotItem` / `AbsDeviceModel4Iot`.
- The same SKU can appear as ble or ble+iot depending on `pactType/pactCode`
  (`Support.isWifiPact`, `BulbLightApplication` Matter interceptor).
- **matter**: H6011 (goodsType 64) and H8015 (goodsType 328) are registered with
  `MatterInterceptor` in `bulblight/BulbLightApplication.create()`; H6011/H8015
  can be commissioned via Matter and then fall into the same BLE/goodsType path.

---

## 2. BLE frame + command table

### 2.1 Frame

20-byte `BleUtils.generate20Bytes(proType, cmdType, payload)`:

| off | len | meaning |
|---|---|---|
| 0 | 1 | proType |
| 1 | 1 | cmdType |
| 2..18 | 17 | payload (zero padded) |
| 19 | 1 | BCC = XOR of 0..18 |

Reads (`proType 0xAA`) and writes (`0x33`) are built by
`AbsSingleController.f()/g()`; `AbsBleComm.parse()` strips the header before
`parseValidBytes()` (read: bytes 2..18 → 17 bytes, write: bytes 3..18 → 16).
`AbsModeController` (cmdType **0x05**) is the "mode" container; `q()` returns
`subMode.getWriteBytes()` and `p()` returns `{01}` for the read variant.

Multi-packet encodings used here (all 20 bytes/packet):

- **`MultipleControllerComm`** (`AbsMultipleController`, proType **0xA1**):
  start `[0xA1][cmd][0][packCount][p()]`, then `[0xA1][cmd][index 1..N][16 data]`,
  final `[0xA1][cmd][0xFF]`. Used for `MultipleScenesController` (cmd 0x01)
  and H6005 `MultipleDiyController` (cmd 0x02).
- **`MultipleControllerCommV1.makeSendBytesV1`** (proType **0xA3**):
  start `[0xA3][00][01][pktCount][cmdType][first 14 payload bytes]`,
  middle `[0xA3][n][17 bytes]`, final `[0xA3][FF][last ≤17 bytes]`.
  Used for `AbsMultipleControllerV1` (scenes v1, DIY v1) and by
  `MultiController` (`0xA3/0x58` H601EF DIY, `0xA3/0x6E` segment color).
- `H7022ScenesConfig.getBase64List()` builds a bare `0xA1/0x01` multi packet
  (`[0xA1][01][00][count]` + 16-byte chunks + BCC) from
  `ScenesModeController`.

### 2.2 Command table (deduplicated)

Payload is `payload[0..]` inserted at frame offset 2.

| name | op (proType/cmd) | payload | notes / applies to |
|---|---|---|---|
| power | `0x33/0x01` | `01` on / `00` off | all BLE families; read `0xAA/0x01` → `[0]!=0` |
| heartbeat | `0xAA/0x01` | empty | `HeartController`; response `[0]!=0` |
| brightness | `0x33/0x04` | `01..64` | 0..100 %; H6001 old maps `NumUtil.calculateProgress(254,20,b)` → 20..254; `0xAA/0x04` → `[0]` |
| mode container | `0x33/0x05` | sub-mode block | see §5; read variant payload `{01}` |
| color sub-mode 0x0B | `0x33/0x05` | `0B R G B m0…m9` | bulb-string v1 (14 B, 80-light mask bit0=first bulb); H7022 `0B R G B m0 m1 m2` (8 B, 24-light mask) |
| color sub-mode 0x02 | `0x33/0x05` | `02 R G B ct R2 G2 B2` | H6001 non-H6005 firmware; `ct=1` means colour-temp mode, `R2G2B2` is temp RGB |
| color sub-mode 0x0D | `0x33/0x05` | `0D R G B ctLo ctHi R2 G2 B2` | H6005 / updated H6001 / v3 `SubModeColor`; `ct` little-endian `getSignedBytesFor2(kelvin,true)` |
| color sub-mode 0x15 | `0x33/0x05` | variants below | newer families generated by base `ColorModeControllerConfig`/`Bytes` |
| scenes 0x04 (2-byte id) | `0x33/0x05` | `04 idLo idHi` | bulblightstringv2 (`+ speed` byte), bulblightv3 |
| scenes 0x04 (1-byte) | `0x33/0x05` | `04 id` | H6001, H6005 |
| scenes 0x09 (bulb-string) | `0x33/0x05` | `09 id+1` (17 B) | bulblightstringv1; H7022 uses `09 type+1` |
| music 0x0E | `0x33/0x05` | `0E auto sens flag [R G B]` | bulblightstringv1; `auto` 0/1, `sens` 0..99 |
| mic/music 0x05 | `0x33/0x05` | `05 01` | H6001/H6005/v3 "enter mic mode"; read/parse is no-op |
| mic rhythm point | `0x33/0x05` | `05 00 R G B` | `MicController` (H6005, v3) — one RGB beat point |
| DIY select 0x0A | `0x33/0x05` | `0A codeLo codeHi` | all DIY families after uploading the DIY blob |
| bulb number | `0x33/0x0F` | `n` | bulblightstringv1 / H7022; response `0xAA/0x0F` `[n]` |
| read bulb group colour | `0xAA/0xA2` | `groupIndex (1..6)` | `BulbStringColorController` / H7022 `ReadBulbColorController` |
| multi-scene | `0xA1/0x01` | see §5.1 | bulblightstringv1, H7022 |
| multi-DIY | `0xA1/0x02` | see §5.4 | H6005 / old H6001 |
| multi-DIY V1 | `0xA3/0x04` | `DiyProtocol.toBytes()` | updated H6001, H601EF, H14xx |
| H601EF DIY blob | `0xA3/0x58` | TLV, see §5.6 | goodsType 311 |
| H601EF segment colour | `0xA3/0x6E` | `[15..]` blocks via MultiController | goodsType 311 |
| solar battery history read | `0xAC/0x0E` | empty (read) | H3210/H3520; `AbsController4BleSingleSendMultiBack` |
| solar brightness strategy write | `0x33/0x43` | `brightness` | H3210/H3520 |
| solar brightness strategy read | `0xAA/0x43` | empty | H3210/H3520 |

`0x15` sub-mode variants (from
`base2light/pact/newdetail/config/fuc/color/Bytes.java`; used by
bulblightstringv2, bulblightv3, H601EF):

| variant | payload |
|---|---|
| colour + CT | `15 01 R G B ctLo ctHi R2 G2 B2 <mask…>` |
| colour only | `15 02 colourIndex <mask…>` |
| brightness set | `15 03 b0 b1 … (≤15)` |
| per-segment colour | `15 04 segmentIndex R G B (×4 per packet)` |
| multi colour + mask | `15 05 colorCount R G B … <mask…>` |
| colour temp only | `15 04/05` CT paths via `BleUtils.D(kelvin,true)` |
| switch/direction | `15 03/05` derived (`H()` writes `15 05 01/02/03 val`) |

Segment/multi-colour writes additionally wrap the `0x15` blocks in
`MultiController(..., 0x6E)` → `0xA3/0x6E`, and `ColorModeControllerConfig`
appends a bare `ControllerMode({0x15})` (or `{0x0C}` for IC==10) as the
"apply" frame.

### 2.3 Raw one-shot builders (no controller chain)

H7022 scene builders construct the 20-byte frame directly in
`h7022/scenes/ble/*`:
`[0]=0x33,[1]=0x04/0x01/0x05,[2]=payload…,[19]=BCC`, heart is
`[0]=0xAA,[1]=0x01,…`.

---

## 3. BLE notifications / readings

`AbsNotify` filters on frame byte 0 = `0xEE`, copies bytes 1..18, dispatches on
byte 0 of that slice.

| notify op | parser | layout | families |
|---|---|---|---|
| `0xEE/0x11` | `WifiNotifyParse` | `[0]==0` → WiFi connected | stringv1, stringv2, v3, h7022 |
| `0xEE/0x20` | `BrightnessNotifyParse` | `[0]` = brightness (0..100/254) | bulblightv2, stringv2 |
| `0xEE/0x60` | `MovieFeastOnOffNotifyParse` (base) | `[0]==1` valid, `[1]==1` on | bulblightv3 |
| `0xAA/*` | controller `parseValidBytes` | read replies; 17 valid bytes | all |
| `0x33/*` | controller write-ack | 16 valid bytes; `[0]` of original frame = 0 ⇒ success | all |

Per-family read parsers:

- **Bulb colour group** (`0xAA/0xA2 index`): valid bytes =
  `[0]=groupIndex(1..N)`, then 4 × RGB → `BulbGroupColor{index, int[4]}`.
  bulblightstringv1 `ble/BulbGroupColor.parseBytes`; H7022
  `ble/ReadBulbColorController.parseValidBytes` (identical, 24 bulbs in 6
  groups of 4, chained 50 ms apart).
- **Mode read** (`0xAA/0x05`, payload `{01}`): validBytes[0] = sub-mode id,
  remaining bytes go to `Mode.parseSubMode`:
  - stringv1: `0x0E` music, `0x09` scenes, else colour.
  - H7022: `0x0B` colour, `0x09` scenes, else music.
  - bulblightv2/v3/H6001: `0x05` mic, `0x04` scenes, `0x0A` DIY, else colour.
- **Bulb number** (`0xAA/0x0F`): `[n]` (string count); Info4BleIot then
  multiplies by `getBulbStringSetting(...)[1]` (2×15 defaults, i.e. max 30).
- **IoT passthrough reads** (`pt`/`bulb`/`ptReal`): list of base64-encoded
  20-byte frames decoded server-side, see §4.

---

## 4. IoT commands + status/readings schema

Envelope: standard `Write/AbsCmdWrite` (V0) and `Read/AbsCmdRead`;
incoming envelope variants:
- bulblightstringv1 / h7022: **V0** (`IotMsg`, `IotMsgEvent`, `cmdVersion==0`)
- bulblightv1: **V1** (`AbsIotManagerV1.getJsonObjectStr(json,"state"/"config")`)
- bulblightstringv2 / bulblightv3: **V2** (`IotMsgProType.V2`, `IotMsgV2` in
  scene builders); `Cmd.getCmdReadParseKey()` maps `ptReal`→`op`, else `state`.

### 4.1 Common command names

`online`, `turn`, `brightness`, `status`, `color`, `colorTem`, `colorwc`,
`mode`, `bulb`, `string`, `pt`, `ptReal`, `timer`, `sleep`, `wakeup`.

### 4.2 Per-family commands

**bulblightstringv1 (H7005, goodsType 5)**
- `turn` `{val:0|1}`
- `brightness` `{val:0..100}`
- `bulb` `{value:["<base64 20-byte BLE frame>", …]}` — full colour / group
  colour / scene frames from `CmdBulb`.
- `pt` `{op:"mode"|"timer"|"sleep"|"wakeup", value:["<base64>", …]}` —
  `CmdPt`; used for scene (mode), timer, sleep, wakeup.
- `string` `{val:int}` — string count set (`CmdString`).
- `status` query (`CmdStatus`), no data.
- Read keys: `Cmd.getCmdReadParseKey` → `pt`→`op`, else `state`.

**bulblightv1 (H6003/H6004, goodsType 9/10)**
- `turn` `{val}`; `brightness` `{val}`
- `color` `{r,g,b}`
- `colorTem` `{colorTemInKelvin, color:{r,g,b}}` (white)
- `mode` `{mode, code}` — mode 1 = scene, 3 = DIY (per `CmdStatusV1`
  constants m=1,o=3)
- DIY: `mode` `{mode:3, code, color:[{r,g,b}…], effect, subEff, speed,
  effArr:[{effect,subEff}…]}` (`CmdModeDiy(DiyProtocol)`; `effect==255`
  means a composite effect and `effArr` is filled).
- `timer` `{group, enable, type, hour, minute, repeat, timeOffset,
  timeOffsetMinute, timeStamp}`
- `sleep` `{enable, startBri, closeTime, curTime, timeOffset, timeStamp}`
- `wakeup` `{enable, endBri, wakeHour, wakeMin, repeat, wakeTime,
  timeOffset, timeStamp}`
- `status` query. Read keys: `timer|sleep|wakeup|mode`→`config`, else `state`.

**bulblightstringv2 (goodsType 35/49/91/148)**
- `turn` `{val}`; `brightness` `{val}`; `status` query
- `ptReal` `{command:["<base64>"]…}` — `CmdPtReal`; scene = multi-scene
  frames + a final `0x33/0x05` `{04, idLo, idHi}` mode frame.

**bulblightv3 (goodsType 31/64/111/311/328/342/348/408)**
- `turn` `{val}`; `brightness` `{val}`; `status`/`online`
- `colorwc` `{color:{r,g,b}, colorTemInKelvin}` — `CmdColorWc`;
  colour-temp commands put `color=white`, kelvin in `colorTemInKelvin`.
- `ptReal` `{command:["<base64>"]…}` — scenes, DIY (`getDiyCmdPt`), scene
  share (`getNewScenesCmdPtReal`), DIY studio (`getDiyCmdPt4DiyStudio`).
- `ptReal` is also the carrier for multi-segment colour on H601EF
  (`Cmd4PtReal` built from `ColorModeControllerConfig`).

**h7022**
- `turn` `{val}`; `brightness` `{val}`
- `bulb` `{value:["<base64 20-byte frame>", …]}` — one frame per colour group
  (`H7022SubModeColor.makeSetAllColors`: single colour = one frame with all 24
  mask bits; 24 colours = one frame per distinct colour).
- `pt` `{op:"mode"|"scenes"|"sleep"|"wakeup", value:["<base64>"]}`
- `timer` `{enable, group, isGroup, timeOffset, timeOffsetMinute,
  time:[{enable, repeat, openHour, openMin, closeHour, closeMin}…]}`
- `status` query + V0 status object (below).

### 4.3 Status / state schemas

**bulblightstringv1** (`iot/CmdStatusV0`):
`state` object with
`{onOff:0|1, brightness:int, mode:int, stringNum:int}`.
`CmdStatusV0` also keeps `modeValue`, `sleepValue`, `wakeupValue`,
`timerValue` (base64 BLE frames) and parses `mode` frames with
`parseBulbColorRgbSet(list)`:
- frame 0 may be `33 05 0B R G B` (single colour, sets `rgb`),
- each following 20-byte frame is a group colour block
  `[groupIndex][4×(R,G,B)]`, decoded with `BulbUtil.parseValidBleBytes`.
`parseColorModeRgbSet` skips frame 0 and decodes only group frames.

**bulblightv1** (`iot/CmdStatusV1`):
`state {onOff, brightness, color:{r,g,b}, colorTemInKelvin, mode}`
`config {modeValue:{mode,code}, sleep:{enable,startBri,closeTime,curTime},
wakeup:{…}, time:[NewTimerV1×4]}`.
Mode mapping: `mode==1` scene, `mode==3 && goodsType==9` DIY.

**bulblightv3 / bulblightstringv2**: no `CmdStatus` model in the split; the
new-detail delegates read `Info4BleIot` via base `Compose4InfoBleIot` (the
base controller strategy table is the source of truth). IoT `status` is used
only as an online/refresh trigger (`Model.V()` returns `"status"`).

**h7022** (`iot/CmdStatusV0 extends AbsCmd`, cmd `"status"`):
`{turn:0|1, brightness:int, mode:int, lightColorBunch:int,
softversion:String, wifiSoftVersion:String,
modeValue:[base64…], sleepValue:[base64…], wakeupValue:[base64…],
timer:{enable,group,isGroup,timeOffset,timeOffsetMinute,time:[…]}}`.
`getModeModel()` decodes `modeValue[0]` as a `0x05` mode frame;
`getColor7022Model()` concatenates all `modeValue` frames and parses them as
group-colour blocks.

**bulblightv2 (H6005/H6001)**: BLE only, no IoT status model.

---

## 5. Dynamic effects / motion / music / scenes / DIY (exact payloads)

### 5.1 bulb-string scene (bulblightstringv1 / H7022)

Simple selection (`SubModeScenes.getWriteBytes`):
```
33 05 09 <effect+1> 00 00 … 00
```
- bulblightstringv1 effect set `{0..7}` from
  `pact/Scenes4BleRhythm.e` and `ble/ScenesConfig`:
  0 illumination, 1 fade, 2 raindrops, 3 colorful, 4 marquee,
  5 blinking, 6 snow, 7 sky.
- H7022 `BleProtocol` same ids, `getWriteBytes` = `09 <type+1>`.

Multi-segment scene (`Comm.makeScene4BleComm` / `makeScene4IotComm`):
`SubModeScenes.a` = user effect index. `ScenesConfig.getLocalExt(index)`:
`index==0` → `null` (no multi-frame, illum only), otherwise
`{speed, color[]}` (default speed 50; default colours red, blue, yellow,
green, or white for index 6).
`MultiSceneModel{a=effect+1, b=effect, c=speed, d=RGB bytes}` →
`MultipleScenesController` payload:
```
[0]=effect+1
[1]=effect
[2]=0
[3]=speed 0..100
[4]=colourByteLen (3×N)
[5..]=R G B … (one triplet per colour)
```
wrapped in `MultipleControllerComm` (0xA1/0x01):
```
A1 01 00 <packCount> 00
A1 01 <idx 1..N> <16 bytes>
A1 01 FF
```
BLE-comm `makeScene4BleComm` returns each 20-byte frame base64'd; IoT uses
`CmdPt("mode", [modeFrame, …multiFrames])`.

`CmdStatusV0.parseBulbColorRgbSet`/`ResultPt.getOpMode4SubModeColorEffectRgbSet`
reverse this: first `33 05 0B R G B` = single colour, remaining frames =
`[groupIndex][4×RGB]`.

### 5.2 bulb-string music (bulblightstringv1)

`SubModeMusic.getWriteBytes()` (sub-mode `0x0E`):
```
0E <autoFlag 0|1> <sensitivity 0..99> <flag> [R G B]
```
- auto/manual: internal `d=true` ⇒ 4 bytes `0E a b a(d)=0`;
  `d=false` ⇒ 7 bytes `0E a b a(d)=1 R G B`.
- `a` = 0 (power/energy) or 1 (soft), `b` = sensitivity 0..99, colour default
  red `0xFFFF0000`.
- `parse` reads `[auto, sensitivity, flag, R,G,B]`.

H7022 music (`ble/BleProtocol.sub_mode_music=1`,
`adjust/mode/SubModeMusic`):
```
01 <effect> <sensitivity>
```
effect 5 = "Dynamic", 4 = "Mild"; sensitivity 0..99.

### 5.3 mic / rhythm (H6001, H6005, bulblightv3)

- enter mic mode: `33 05 05 01`
- one rhythm point: `33 05 05 00 R G B` (`MicController`)
- `supportMic`: H6005 = 3 (mic only), H601EF = 2, v3 = 3, H6001/v1/v2 = 0 or
  "no music" per detail config.

### 5.4 classic DIY (H6005 / old H6001)

`MultipleDiyController` (`AbsMultipleController4Diy`, proType 0xA1, cmd 0x02):
```
[0]=diyCode
[1]=effect
[2]=subEff
[3]=speed 0..100
[4]=colourByteLen = 3×N
[5..]=R G B … (N colours)
[5+len]=subEffectCount (only if composite)
[6+len..]=<effect, subEff> pairs
```
then `A1 02 00 <packCount> 00` + chunks + `FF` (see §5.1 wrapper), followed by
mode frame `33 05 0A <codeLo> <codeHi>`.

Updated H6001 (`Support.isH6001Update`) uses
`MultipleDiyControllerV1` → `AbsMultipleControllerV14Diy` with
`DiyProtocol.toBytes()` over `0xA3/0x04`, then the same `0x0A` mode frame.

### 5.5 bulblightv3 scene / DIY

Scene (`SubModeScenes`, 2-byte id):
```
33 05 04 <idLo> <idHi>
```
- H6008 (goodsType 64) effect ids:
  `123,124,106,100,121,122,109,1136,153,154,155,156,52,68,13,1137,130,2,
  107,142,143,163,139,146,1131,1171,1132,1133,1134,1172`
  (`adjust/v3/ScenesV3.l`).
- H601A succession (goodsType 111) effect ids **2657..2720**
  (`adjust/v3/ScenesV3H601A.k`, includes gaps 2665/2716/2717).
- Single-byte ids also used for H6001/H6005 (see §5.7).

New scene (`ScenesOp.parseScene/ parseEffect`) produces
`AbsMultipleControllerV14Scenes` over `0xA3/0x04` with the scene's effect
bytes, then `CmdPtReal`/BLE list appends the `0x04 idLo idHi` mode frame.

DIY (`CmdPtReal.getDiyCmdPt`):
`MultipleBleBytes.getMultipleWriteBytesV1(new MultipleDiyControllerV1(diy))`
→ `0xA3/0x04` frames, then `33 05 0A <codeLo> <codeHi>`.

DIY Studio / template (`getDiyCmdPt4DiyStudio`, `getDiyTemplateCmdPt`):
`0xA3` template frames + `33 05 04 <templateCodeLo> <templateCodeHi>`.

### 5.6 H601EF (goodsType 311) advanced DIY — exact TLV

`newdetail/diy/H601EFDiyParse.toBytes()`:
```
[totalLen  LE16]
  [mainLen LE16][main block]
  [subLen  LE16][sub block]
```
main block `k()`:
```
01 04 <speed 0..100> <colorCount> R G B (×colorCount)
```
sub block `q()`:
```
01 <subType> <sub-effect body>  (see table)
```
sub-effect bodies (`AbsSubH60ax.a()` / each subclass `e()`):
```
type 1  ColourTem   : <ct> <brightness> <kelvin LE16>
type 2/3/4/6/14 SpeedColor: <speed> <colourCount> R G B …
type 7  Streamer    : <speed> <group> <colourCount> R G B …
type 8  BgColor     : <speed> <colourCount> R G B … <brightness>
type 10 DuiJi       : <speed> <direction> <colourCount> R G B …
type 11 Breathe     : <speed> <group> <colourCount> R G B …
types 1..5 common   : <speed> <colourCount> R G B …
type 0  None        : (empty)
```
`H601EFDiyParse.k()` also fixes `[01,04,…]` (main always colour-temp-style
header). Sent as `MultiController(bytes, 0x58)` → `0xA3/0x58`, then mode
`33 05 0A <codeLo> <codeHi>` (or scene apply when driven by DIY Studio).

H601EF per-piece colour: `ColorModeControllerConfig` builds `0x15` blocks
(`15 04 segmentIndex …`, `15 05 …`) wrapped in `MultiController(...,0x6E)` →
`0xA3/0x6E`, colour piece size = **7** (`Support.getColorPieceSize`), 4
colours per group (`getOneGroupColorSize`).

H601EF New-DIY config (`H601EFNewDiyConfig`) exposes 20+ effect definitions
(IDs 1..25, 9998 = "none"/advanced, 10001/10002) with effect groups:
1..5 common (sub-effect ids 1..3), 6 speed-colour, 7 streamer, 8 bg colour,
10 duiji (direction 1..2), 11 breathe, 14 speed-colour, 25 extra; DIY share
code `0x50` and effect code `{787}`.

### 5.7 classic H6001 / H6005 scene ids

- H6001 old (`BleProtocol4OldH6001` / `ScenesV0`):
  `0=gm, 1=sunset, 7=romantic, 10=breath, 11=dazzling, 12=lively,
  13=reading, 14=relax`.
  Payload `33 05 04 <id>`.
- H6001 updated / H6005 (`BleProtocol` / `ScenesV0`, `Scenes4H6005`):
  effect set `{13,17,10,7,9,20,16,25}` (reading, fade, breath, romantic,
  cl, heartbeat, energetic, blinking). Payload `33 05 04 <id>`.
- H6003 (IoT): `Scenes4H6003.q = {0,4,3,2,1,5,6,7}` for its local scene UI.

### 5.8 bulblightstringv2 scenes

`pact/Comm.makeSceneCmd4IotComm`:
- `SubModeScenes.setEffect(i)` → mode frame
  `33 05 04 <iLo> <iHi> <speed>` (`speed` defaults to `0xFF` =
  `SCENES_WITHOUT_SPEED`).
- If `ScenesOp.parseScene/parseEffect` finds a multi-scene definition, it is
  emitted first as `0xA3/0x04` frames (V1 multi layout), then the mode frame.
- Capability set `Support.supportScenesOpSet()` = `{1}`.

### 5.9 H7022 multi-scene

`H7022ScenesConfig.getBase64List(sku, code)`:
```
[0]=code (1-based)
[1]=effectType (code-1)
[2]=subEffectType
[3]=speed 0..100
[4]=colourByteLen = 3×N
[5..]=R G B … (skip 0,0,0)
```
Wrapped as `0xA1/0x01` start `[00,count]` + 16-byte chunks + BCC.
Default colours: code 6 → white; else red, blue, yellow, green; speed 50.

### 5.10 solar H3210 / H3520 DIY

- H3210 `toBytes()` (`solar/diy/H3210DiyParse`, effect `984`, share `0x50`):
```
<effectCode> <speed 1..100> <colourByteLen=3×N> R G B … <R G B bg>
```
- H3520 `toBytes()` (effect `985`, share `0x50`):
```
<effectCode> <speed 0..100> <flag = (effectCode==18 || composite) ? 1 : 0>
<count 1..8> R G B … (≤8)
```
Both solar DIY classes are `IDiyParse` implementations; the base
`IDiyParse.DefaultImpls.makeBleController` wraps `toBytes()` in the generic
`0xA3` multi-controller frames and appends a mode frame. Effect codes
984/985 are the DIY identifiers; sharing uses code `0x50`.

### 5.11 colour grouping on bulb strings

- bulblightstringv1: up to **80** logical bulbs (`ctlLight[80]`), mask 10
  bytes, 4 colours per read group (`getOneGroupColorSize=4`), max 30 bulbs
  (`getBulbStringSetting = {2,15}` → 2 groups × 15).
- H7022: **24** bulbs (`ctlLight[24]`), mask 3 bytes, 6 groups × 4 colours
  (`H7022Constant.getBulbNum = 6`).
- Group write with all lights: mask bits all 1. Per-colour write:
  `makeSetAllColors(int[24])` builds one frame per distinct colour, setting
  only that colour's mask bits.

---

## 6. Other protocols

- **Matter**: H6011 (goodsType 64) and H8015 (328) registered in
  `bulblight/BulbLightApplication.create()`; `newdetail/config/MatterSupport`
  registers Matter detail config. No cluster-level mapping is in this split
  (delegated to the base Matter stack).
- **WiFi / LAN**: no LAN/UDP/TCP/MQTT code in this split. IoT is cloud MQTT
  through the base `Iot`/`IotManager` only. `Support.getWifiInputLimit()`
  = `{32,64}` and `bulblightv1 Support.i = "192.168.1.1"`, port `7200`,
  SSID prefix `Govee_bulb_` for the legacy SoftAP pairing of H6003/H6004.
- **BLE advertisement**: no custom advertising parser in this split; the
  base `BaseBleProcessor`/`AbsBaseBleModel` handles scan records. Solar fw
  reads battery bits from the scan record:
  `BleModel.x(scanRecord)` → `ByteUtils.parseValidByte(record)[4]` →
  `BatteryInfo` (bit7=charging? see schema); `SolarModel.x` reads
  `validByte[3] & 0xFF == 2` → light-sense mode enabled.
- **OTA**: H7019 (bulblightstringv2) uses base `OtaOpV3`; all other families
  use the base OTA path.
- **ptUrl / multiSync**: not present in this split.

### 6.1 Solar battery / light-sense readings

- `ReadBatteryInfoController` (`0xAC/0x0E`, single-send multi-back):
```
[0..1] validDataLen LE16
[2]    interval minutes (timestamp base = now − interval*60 000, floored to hour)
[3..4] totalPointNum LE16
[5..]  pairs: b0 bit7 = charging/valid flag, bits0..6 = battery %;
              b1 bit7 = sign, bits0..6 = value
```
- Scan-record battery byte `BatteryInfo`:
  bit8 → `charging` (`a`), bits5..3 → `level` (`b`, 0..7; 7 ⇒ "99"),
  bit4 → `c`, bit3 → `d`, bit2 → `e`, bit1 → `f` (full/plugged flags).
- Light sense (`LightSenseInfo` from validBytes):
```
[0] bit1 = enabled, bits2..3 = mode, bits5..7 = sensitivity
[2] bit? = light-sense switch result
[3..4] LE16 = brightness threshold
[5] bit? = auto-brightness enable
[6..8] header time: state, hour, minute
```
- `HeaderTimeInfo` state `0=off,1=on,2=auto`; time = `hour*60+minute`.

---

## 7. Source map (paths traced)

Relative to `decompiled/jadx-splits/split_pact_bulblightstringv1/sources/` unless
prefixed `base:` (= `decompiled/jadx-base-7.7.10/sources`).

Core / frame:
- `com/govee/bulblightstringv1/pact/{SubLib,SubLib4BleIot,Comm,Support,DeviceItem,DeviceItem4BleIot,Model,Model4BleIot,Register4Item,SubMaker}.java`
- `com/govee/bulblightstringv1/pact/ble/{AbsBleSkuItem,V1BleSkuItem,AbsEffectOp4Ble,EffectOp4Ble,BleExt}.java`
- `com/govee/bulblightstringv1/pact/bleiot/{AbsBleIotSkuItem,V1BleIotSkuItem,AbsEffectOp4BleIot,EffectOp4BleIot,BleIotExt}.java`
- `com/govee/bulblightstringv1/pact/Scenes4BleRhythm.java`
- `com/govee/bulblightstringv1/ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol,Mode,ModeController,SubModeColor,SubModeMusic,SubModeScenes,ScenesConfig,BulbGroupColor,BulbNumController,BulbStringColorController,MultipleScenesController,MultiSceneModel,OpColorCommDialog4Ble,OpColorCommDialog4SquareBle,WifiNotifyParse}.java`
- `com/govee/bulblightstringv1/iot/{Cmd,CmdTurn,CmdBrightness,CmdBulb,CmdPt,CmdString,CmdStatus,CmdStatusV0,ResultPt,ResultBulb,ResultString,OpColorCommDialog4BleIot,OpColorCommDialog4SquareBleIot}.java`
- `com/govee/bulblightstringv1/scenes/{AbsBleCmdBuilderV1,AbsIotCmdBuilderV1,Ble*,Iot*}.java`
- `com/govee/bulblightstringv1/detail/{NewDetailAc,NewDetailVm,Info4Detail,DetailConfig}.java`, `detail/mode/*`
- `com/govee/bulblightstringv1/add/v1/*`, `add/v2/*`

bulblightv1 (H6003/H6004):
- `com/govee/bulblightstringv1/bulblightv1/pact/{Comm,Support,SubLib,SubMaker,DeviceItem,Model,IotSkuItemV1,IotSkuItemV2,IotExt,AbsEffectOp4Iot,EffectOp4Iot}.java`
- `.../bulblightv1/iot/{Cmd,CmdTurn,CmdBrightness,CmdColor,CmdColorTem,CmdMode,CmdModeDiy,CmdSleep,CmdWakeUp,CmdTimer,CmdStatus,CmdStatusV1,DiyLocal,OpColorCommDialog4Iot,OpDiyCommDialog4Iot}.java`
- `.../bulblightv1/adjust/ui/v1/{SubModeColor,SubModeDiy,SubModeScenesV1}.java`, `ui/v2/{SubModeScenesV2,...}.java`, `adjust/{Mode,SubModeType,Diy}.java`

bulblightv2 (H6005 / H6001):
- `com/govee/bulblightstringv1/bulblightv2/pact/{Comm,Support,SubLib,SubMaker,BleSkuItem,Model,DeviceItem,GroupFactor,GroupFactorV2,ScenesV0,AbsEffectOp4Ble,EffectOp4Ble,BleExt}.java`
- `.../bulblightv2/ble/{Ble,BleComm,BleCommGroup,BleMultiComm,BleMultiCommGroup,BleNotifyComm,BleProtocol,Mode,ModeController,SubModeColor,SubModeScenes,SubModeNewDiy,SubModeMic,MicController,BrightnessNotifyParse,GroupBle,GroupOp}.java`
- `.../bulblightv2/scenes/*`

h6001:
- `com/govee/bulblightstringv1/h6001/sku/{Sku,SkuH6001,SubLib,SubMaker,Register4Item,Model,DeviceItem,BleExt,ScenesV0,EffectOp4Ble,AbsEffectOp4Ble,DeviceItem,ScenesV0}.java`
- `.../h6001/ble/{Ble,BleComm,BleMultiComm,BleProtocol,Mode,ModeController,SubModeColor,SubModeColorV2,SubModeScenes,SubModeMic,SubModeNewDiy,MicController,Diy,DiyLocal}.java`
- `.../h6001/scenes/*`

bulblightstringv2:
- `com/govee/bulblightstringv2/pact/{Support,Comm,SubLib,SubLib4BleIot,SubMaker,AbsBleSkuItem,V1BleSkuItem,Model,Model4BleIot}.java`
- `.../pact/bleiot/{BleIotMaker,BleIotMakerV2,BleMakerH7019,BleWifiBindExt}.java`
- `.../ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol,Mode,ModeController,SubModeScenes,BrightnessNotifyParse,WifiNotifyParse}.java`
- `.../iot/{Cmd,CmdTurn,CmdBrightness,CmdStatus,CmdPtReal}.java`
- `.../scenes/{AbsBleCmdBuilderV1,AbsIotCmdBuilderV1,Ble*,Iot*,SmartRoomOp,SmartRoomOp4Ble}.java`

bulblightv3:
- `com/govee/bulblightv3/pact/{Support,Comm,SubLib,SubLib4Ble,SubMaker,Register4Item,DeviceItem,Model,BleModel,SolarModel,AbsBleIotSkuItem,BleIotExt,SmartRoomOp4H6002}.java`
- `.../pact/v1/{V1BleIotSkuItem}.java`; `pact/v3/{V3BleIotSkuItem,BleIotSkuItem111,BleIotSkuItemH601EF,SkuItemH1401,SkuItemH14B1,SkuItemH14C0,H8015Item,AbsEffectOp4BleIot,EffectOp4H6008,Op*CommDialog4BleIot,Op*CommDialog4SquareBleIot,BleColor*CmdBuilderV1}.java`; `pact/ble/{BleMakerH3210,BleMakerH3520}.java`
- `.../ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol,Mode,ModeController,SubModeColor,SubModeScenes,SubModeNewDiy,SubModeMic,MicController,WifiNotifyParse,DiyLocal}.java`
- `.../iot/{Cmd,CmdTurn,CmdBrightness,CmdColorWc,CmdPtReal}.java`
- `.../adjust/v3/{ScenesV3,ScenesV3H601A,DiyV3}.java`, `adjust/v2/Diy.java`
- `.../newdetail/diy/{H601EFDiyParse,H601EFDiyEffect,H601EFNewDiyConfig,H601EFDiyAdvanced*,...}.java`, `newdetail/diy/subEffect/*`
- `.../solar/{SolarProtocol,controller/ReadBatteryInfoController,controller/Controller4BrightnessStrategy,bean/BatteryInfo,bean/LightSenseInfo,bean/HeaderTimeInfo,diy/H3210Diy*,diy/H3520Diy*}.java`
- `.../add/{BleBroadcastProcessor,AddDeviceSolar}.java`

h7022:
- `com/govee/h7022/{H7022Constant.java,sku/*,ble/*,iot/*,adjust/mode/*,scenes/*,detail/*,add/*}.java`

Base:
- `base:com/govee/base2light/ble/controller/{AbsSingleController,AbsOnlyReadSingleController,AbsOnlyWriteSingleController,AbsController,AbsMode,AbsModeController,AbsMultipleController,AbsMultipleControllerV1,AbsMultipleControllerV14Scenes,AbsMultipleController4Diy,AbsMultipleControllerV14Diy,BrightnessController,SwitchController,HeartController,BleProtocolConstants,MovieFeastOnOffNotifyParse,AbsControllerNoEvent4Single,AbsController4BleSingleSendMultiBack}.java`
- `base:com/govee/base2light/ble/comm/{AbsBleComm,AbsMultipleBleComm,AbsNotify,AbsNotifyParse,MultipleControllerComm,MultipleControllerCommV1,MultipleBleBytes}.java`
- `base:com/govee/base2light/pact/newdetail/config/fuc/color/{ColorModeControllerConfig,Bytes}.java`
- `base:com/govee/base2light/kt/general_controller/{ControllerMode,MultiController}.java`
- `base:com/govee/base2light/ble/BleUtil.java`

---

## 8. Gaps / unknowns

1. `bulblightstringv1/iot/CmdStatusV0.parseJson` is a JADX
   `UnsupportedOperationException` stub ("Method dump skipped"). The `State`
   inner class fields are known (`brightness, mode, onOff, stringNum`), but
   the exact key mapping between the outer status object and `state`/`pt`
   is inferred from the parser helpers and the V0 manager flow.
2. `bulblight/Support.d(...)` (the legacy SKU-version gate: H6010 / H600A /
   H6006 / H6009 / H600D / H600B / H600C / H8015 / H6011 / H6013 / H800B …)
   is a JADX "failed to restore switch" block. It only gates *which* old
   detail UI handles a SKU; it does not define new opcodes. Treat legacy SKU
   assignments as approximate.
3. `bulblightstringv2`/`bulblightv3` colour and segment payloads are produced
   by the shared base `ColorModeControllerConfig` + `Bytes` tables, not by
   the split. The `0x15` variant table in §2.2 is derived from that base
   file; per-SKU capability (piece count, IC count, per-piece support) is
   runtime (`Info4BleIotDevice`, `LightColorCapabilityCenter`) and not
   statically enumerable here.
4. `H7022 Mode.parse` treats anything that is not `0x0B`/`0x09` as music; the
   firmware may emit other ids not modelled by the app.
5. `SubModeMusic` (bulblightstringv1) writes `flag = d ? 0 : 1` but parses
   `d = (bArr[2] == 0)`. That round-trip is asymmetric in the decompiled
   code; preserve the byte order above and treat the meaning of the 4th
   payload byte as "manual-colour flag, 1 = includes RGB" (as the parser
   implies).
6. `0xA3` multi-packet first-packet payload is split around byte 4
   (`commType`), so any parser must read `cmdType` from byte 5 of a
   *continuation* packet and byte 1/4 of the start packet. The exact `p()`
   value (`AbsMultipleControllerV1.f55492h = 1`) is a constant; some
   controllers override it.
7. No custom BLE advertising layout is defined in this split (base scan
   record parser only); solar battery/light-sense bits are the only
   advertisement-derived readings.
8. IoT `status` schemas for bulblightstringv2/bulblightv3 are handled by base
   `Compose4InfoBleIot`/`AbsIotManagerV2` and are not defined in the split.
