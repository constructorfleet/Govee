# split_pact_h60ax — H60A0/H60A1/H60A4/H60A6/H60C1, H12xx, H1141 ceiling/wall lights

Source root: `decompiled/jadx-splits/split_pact_h60ax/sources/com/govee/pact_h60a0/` (the package
keeps the historical name `pact_h60a0` even though module `pact_h60ax`).

FSixteen goodsTypes share the H60AX BLE profile: a 20-byte frame, a `0x15` colour sub-mode for
most SKUs (H60A6 uses `0x0D`), the same music/scene/DIY sub-modes, and an extensive segment /
graffiti / DIY-new engine. Some SKUs are ceiling lights, some are segmented wall lights and some
are bulb strings.

| goodsType | SKU(s) | product | colour sub | colour size | colour-temp | scenes |
|---|---|---|---|---|---|---|
| 188 | H60A0 | Ceiling light | `0x15` | 13/14 | 2200–6500 K | `{0,1,2,3}` |
| 235 | H60A1, H80A1 | Ceiling light | `0x15` | 14 | 2200–6500 K | `{0,1,2,3}` |
| 302 | H60A4, H80A4 | Ceiling light | `0x15` | 11 | 2700–6500 K | `{0,1,2,3}` |
| 303 | H60A6 | Ceiling light / matrix | `0x0D` | 13 | 2700–6500 K | `{0,1,2,3,5}` |
| 324 | H60C1 | Ceiling light | `0x15` | 3 | 2700–6500 K | `{0,1,2,3,5}` |
| 346 | H1270 | Ceiling light / matrix | `0x15` | 13 | 2700–6500 K | `{0,5}` |
| 356 | H1232 | Ceiling light | `0x15` | 4 | 2700–6500 K | `{0,1,2,3,5}` |
| 370 | H1250 | Ceiling light | `0x15` | runtime | 2200–6500 K | `{0,1,2,3,5}` |
| 373 | H1252 | Ceiling light | `0x15` | 17 | 2200–6500 K | `{0,1,5}` |
| 390 | H12D0 | Ceiling light | `0x15` | runtime | 2200–6500 K | `{0,5}` |
| 410 | H1141 | Ceiling light | `0x15` | 8 | 1000–10000 K | `{0,1,2,3,5,6}` |

Registration (`pact/Support.addSupportPact`): 188 `(1,1)`; 235 `(1,1),(2,1),(2,2)`;
302 `(1,1),(1,2)`; 303 `(1,1)..(1,4)`; 324 `(1,1),(2,1),(2,2)`; 346 `(1,1),(1,2),(1,3)`;
356 `(1,1),(1,2)`; 370 `(1,1),(1,2)`; 373 `(1,1),(1,2)`; 390 `(1,1),(1,2)`; 410 `(1,1)`.
`SubMaker` emits all eleven Item makers.

---

## 1. Transports & GATT UUIDs

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

`ble/Ble.java` is a standard `AbsBle` exposing `BleComm`, `BleMultiComm`, `BleMtu` and a
`BleNotifyComm`. The split also has a "compose" controller set (`ble/controller/compose/*`) that
builds multi-frame colour/timer payloads, and an `IControllerNoEventToAbsSingleController`
adapter so compose controllers can be sent as normal 20-byte frames or `ptReal`.

BLE frame: 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC`.
Large DIY/segment bodies use `Compose4DefWrite` / `Compose4DefWrite4Multi` (multi 20-byte
frames) and `MultipleControllerCommV1`.

---

## 2. BLE frame + command table

`BleProtocol` (`ble/BleProtocol.java`): sub colour `0x15`, H60A6 colour `0x0D`, music `0x13`,
scenes `0x04`, DIY `0x0A`, graffiti `0xEF` (`sub_graffiti_h12d0=-17`), child switch `0x36`.

| command | op | payload / layout | source |
|---|---|---|---|
| power | `0x33/0x01` | `[0] 0/1` | `compose/ControllerSwitch` |
| brightness | `0x33/0x04` | `[0] 1..100` | `compose/BrightnessControllerNoEvent` |
| colour / mode | `0x33/0x05` | sub `0x15` (or `0x0D` H60A6), 17-byte op layout below | `ble/v1/SubModeColorV1.java`, `ble/ModeV1.java` |
| music | `0x33/0x05` | sub `0x13` | `ble/v1/SubModeMusicV1.java` |
| scenes | `0x33/0x05` | sub `0x04` effect LE16 | `ble/v1/SubModeScenesV1.java` |
| DIY | `0x33/0x05` | sub `0x0A` code LE16 | `ble/Sub4Diy.java` |
| graffiti | `0x33/0xEF` | H12D0 cell-graffiti multi frames | `BleProtocol.sub_graffiti_h12d0`; `adjust/h12d0/diy/*` |
| child / secondary switch | `0x33/0x36` | `[0..2]` bools | `ble/controller/ControllerChildSwitch.java`; `BleProtocol.value_sub_switch=54` |
| on/off memory | `0x33/0x41` | `[0] 0/1` | `ble/controller/Controller4OnOffMemory.java` |
| IC number | `0xAA/0x40` | empty | `compose/ControllerIcNum` |
| other info | `0xAA/0x07` | `p()={8}` | `compose/ControllerOtherInfo` |
| hard / DSP version | `0xAA/0x07` | sub-command | `compose/HardVersionController`, `DspVersionController` |
| soft version | `0xAA/0x06` | empty | `compose/SoftVersionController` |
| sync time | `0x33/0x09` | 7-byte time | `compose/SyncTimeController` |
| timer | `0xAA/0x23` | timer-all-info read | `compose/TimerController` |
| gradual change | `0x33/0xA3` | `[0] 0/1` | `compose/GradualController` |
| colour/brightness read | `0xAA/0xA5` | `p()={index}` | `compose/ColorBrightnessController` |

### Colour op layout (`SubModeColorV1.getWriteBytes`)

`SubModeColorV1` uses an `opType` (constants `OP_TYPE_*`):

| opType | payload |
|---|---|
| 0 set brightness | `15 02 <brightness> <mask...>` |
| 1 set colour | `15 01 R G B <mask...>` |
| 2 set colour temp | `15 05 <kelvinLo> <kelvinHi>` |
| 3 set mode | `15 00` |
| 6 brightness group | `15 03 <group> <14 brightness bytes>` |
| 7 colour group | `15 04 <group> <4×RGB>` |
| 11 colour-temp H60A1 | `15 01 R G B kelLo kelHi tempR G B <mask...>` |
| 12 colour H60A1 | `15 01 R G B 00 00 00 00 00 <mask...>` |
| 8 all colour / 9 wc RGB / 10 wc kelvin | encoded by the base mode writer (same 0x15 family) |

Mask length depends on segment count: `≤16` → 2 bytes, `>16` → `BleUtils.X(checkSet, true)`
(4+ bytes; 40 segments max in the V1 builder). H60A6 uses `0x0D` and the H60A6 colour UI;
the concrete body is built by the base colour op writer (see gaps).

### Music (`SubModeMusicV1`)

```
default: 13 05 64  (musicCode 5, sensitivity 100)
```
`parse`: `[0] code`, `[1] sensitivity`; new-code sets are detected with
`Support.isNewMusicCode` (base RGBIC/RGB lists). H60A6/H1270 custom music uses
`H1270MusicProxy`/`CustomMusicApi` and writes composed multi frames.

### Scenes (`SubModeScenesV1`)

`04 epLo epHi` (16-bit LE). Scene op sets per goodsType as in the table.

### DIY (`Sub4Diy`)

`0A diyLo diyHi` plus `protocolCode`/`diyValueKey` metadata. A DIY body is sent as multi-frame
`Compose4DefWrite4Multi` then the final `0A <code>` mode frame.

---

## 3. BLE notifications / readings

`ble/BleNotifyComm` registers:

| reading | op | layout | source |
|---|---|---|---|
| brightness | `0x20` | `[0]` | `ble/BrightnessParse.java` |
| light child status | `0x30` | `[0]==1`, `[1] child1`, `[2] child2`, `[3] child3` | `ble/LightChildStatusNotifyParse.java` |
| wifi | `0x11` | `[0]==0` connected | `ble/WifiNotifyParse.java` |
| device status | `0x30` | base `DeviceStatusNotifyParse` | `ble/BleNotifyComm` |
| heart | `0x01` | base `HeartController` | `ble/BleComm` |
| IC/segment | `0x21` | base `CheckIcNumParse` | base |
| colour/brightness | `0xAA/0xA5` | index + per-segment RGB/brightness | `compose/ColorBrightnessController`, `compose/ParserMultiColorStrip` |
| timer all-info | `0xAA/0x23` | `ParserTimers`/`Result4TimerAllInfo` | `compose/TimerController` |
| gradual | `0xAA/0xA3` | `[0]` mode | `compose/ParserGradual` |
| versions | `0xAA/0x07`/`0x06` | `ParserVersion` | `compose/ParserVersion` |

`ParserMultiColorStrip` reads `[3]` group type and `[4..5]` LE16 index/count; `ParserIntBy2Bytes`
decodes little-endian pairs. Timer records are parsed by `ParserTimers` into `Result4TimerAllInfo`.

---

## 4. IoT commands + status/readings schema

Envelope **`IotMsgV2`**.

`iot/Cmd.java`: `state`, `op`, `online`, `turn`, `color`, `brightness`, `status`, `ptReal`,
`colorwc`.

| cmd | data | response | source |
|---|---|---|---|
| `turn` | `{"val":0\|1}` | `state` | `iot/CmdTurn.java` |
| `brightness` | `{"val":1..100}` | `state` | `iot/CmdBrightness.java` |
| `colorwc` | `{"color":{r,g,b},"colorTemInKelvin":int}` | `state` | `iot/CmdColorWc.java` |
| `ptReal` | `{"command":["<base64 20-byte>",...]}` | `op.pt[]` | `iot/CmdPtReal.java` |

`CmdPtReal` helpers: `getDiyCmdPt(DiyProtocol)`, `getDiyCmdPt4DiyGraffiti1(DiySendData)`,
`getDiyCmdPt4DiyGraffitiV2(DiyGraffitiV2)` (capped at 19), `getDiyTemplateCmdPt`,
`getNewScenesCmdPtReal`, `makeCmdPt`, `makeCmdPtReal`, `makeCmdPtReal4Op`,
`makeCmdPtReal4Op4Multi`. `getOpCommandByte`/`getOpCommandBytes` expose the last frame for
status reconciliation.

`Op*CommDialog4BleIot` / `Square` variants choose BLE+MQTT when available, else `ptReal`.
Status uses the base `state/op` schema; `op.pt[]` frames are decoded by the family mode/colour
parsers.

---

## 5. Other protocols

- **WiFi/LAN** — `Support.setDynamicApi()` registers H60A0/H60A1/H60A4/H60A6/H60C1/H1270/H1232/
  H1250/H1252/H12D0/H1141 dynamic domains. MQTT capability is base `DeviceCommCapability`.
- **HTTP / custom music** — `adjust/h1270/music/CustomMusicApi` (music effect get/save,
  `saveDefaultMusicEffect`), `CustomMusicRoomApi`, `MusicHelper`.
- **Cell graffiti / image import** — H1270/H1250/H12D0/H1141 cell-graffiti layers
  (`H1270CellGraffitiParse`, `H12D0GraffitiParse`, `H1141GraffitiParse`), with layer thumbnails
  and AI material import.
- **OTA** — base OTA; `Support.supportAiOta` enables AI OTA for all except H60A0.
- **No Matter/MQTT-specific code** in this split.

---

## 6. Dynamic effects / music / scenes / DIY

### Colour (sub `0x15`, H60A6 `0x0D`)

`SubModeColorV1` op types 0/1/2/3/6/7/8/9/10/11/12 as in §2. `makeColorStripControllers` splits
a colour layout into 4-colour groups (13/14/17/24/40 segments) plus 14-bulb brightness groups and
an optional gradual frame. H60A6 uses a 13-pixel matrix; H1270 13; H1250 dynamic from
`ColorPieceConfig`; H12D0 dynamic; H1141 8.

### Music (`0x13`)

Default `13 05 64`. New multi-music codes are base RGBIC/RGB lists; H1270 adds custom music
profiles via `H1270MusicProxy`, `NewAcCustomMusicEffect`, `EditMusicBean`/`EffectName`.
H60C1/H60A6 have their own `MusicMode` UIs but the wire form is the standard 0x13 code/sens.

### Scenes (`0x04`)

`04 epLo epHi`. Op sets: H60A0/H60A1/H60A4 `{0,1,2,3}`, H60A6/H60C1/H1232/H1250
`{0,1,2,3,5}`, H1270/H12D0 `{0,5}`, H1252 `{0,1,5}`, H1141 `{0,1,2,3,5,6}`.

### DIY / graffiti effect codes

| SKU group | basic effect | graffiti/advanced | protocol | source |
|---|---|---|---|---|
| H60A0/H60A1 | DIY-new (base) | graffiti | base | `adjust/h60a0/DiyConfigH60A0` |
| H60A4 | `784` (H60A4DiyParse.e), `851`, share code `80` | base graffiti | `0x58` | `adjust/h60a4/diy/H60A4DiyParse.java`, `H60A4DiyEffect` |
| H60A6 | `797`, `798` (+ base `[28,29,30]`) | cell graffiti | `0x58` | `adjust/h60a6/diy/H60A6DiyConfig.java`, `H60A6DiyParse` |
| H60C1 | `878`, `789` | — | base | `adjust/h60c1/diy/DiyNewConfigH60C1.java` |
| H1270 | `897`, `898`, `983` | cell graffiti `82` | `0x58` | `adjust/h1270/diy/H1270DiyConfig.java` |
| H1250 | `915`, `916`, `982` | cell graffiti | `0x58` | `adjust/h1250/diy/H1250DiyConfig.java` |
| H1252 | `902`, `981`, `941` | graffiti `902` basic | `0x58` | `adjust/h1252/H1252DiyConfig.java` |
| H12D0 | `944`, `961` | graffiti `0xEF` | `0x58` | `adjust/h12d0/diy/H12D0DiyConfig.java` |
| H1141 | `976`, `977` | graffiti protocol `0x03` | `0x58` | `adjust/h1141/diy/H1141DiyProtocol.java` |

H1250 sub-effects: `CaiHong4Sub`, `DanRuDanChu4Sub`, `HuXi4Sub`, `LiuShui4Sub`,
`PaoMaDeng4Sub`, `MianZhuangLiuDong`, `SeWen`, `ShanShuo4Sub`, `ShouSuoKuoSan`,
`SuiJiHuXi`, `SuiJiJianBian`, `SuiJiLiuDong`, `XianXingLiuDong`, `XuanZhuan`.
H1252: `H1252DiyBasicEffect` code `902`, graffiti `H1252DiyConfig.d=941`, `b=902`, `c=981`.
H1270 sub-effects: `HuXi`, `HuoYan`, `JianBian`, `LianYi`, `LiuDong`, `SeWen`,
`ShuangLuoXuan`, `TanChiShe`, `TanTiaoQiu`, `XiangSu1/2`, `YanHua`, `YueDong`, `YunRan`.
H12D0: `CaiQiang4ZhuLight`, `CeLightPro`, `ZhuLightPro`, `HuXi4CeLight/HuXi4ZhuLight`,
`JianBianFenDuan/QuanDuan4ZhuLight`, `LiuDong4CeLight`, `LiuDongMianZhuang4ZhuLight`,
`LiuDongXianXing4ZhuLight`, `SeWen4CeLight/4ZhuLight`, `ShenSuo4ZhuLight`, `YunRan4ZhuLight`.
H1141: `H1141DiyEffect/ZoneEffect/AdvancedEffect`, graffiti `H1141GraffitiEffect`.

### H12D0 graffiti

Sub-mode `0xEF`; `H12D0GraffitiParse`/`H12D0GraffitiEffect` send layered cell-graffiti frames,
with `CloseOp` and per-layer picture thumbnails. H60A6/H1270/H1250/H1141 use the analogous
cell-graffiti UI (`ColorGraffitiFragment`, `EditCellGraffitiAcH1270`).

---

## 7. Source map (traced)

- Registration/SKUs: `pact/{Support,SubLib,SubMaker,Register4Item,Model,H*Item}.java`
- Transport: `ble/{Ble,BleComm,BleMtu,BleMultiComm,BleNotifyComm,BleProtocol}.java`
- Mode/sub-modes: `ble/{Mode,ModeController}.java`, `ble/Sub4Diy.java`,
  `ble/v1/{ModeV1,SubModeColorV1,SubModeMusicV1,SubModeScenesV1}.java`
- Compose controllers: `ble/controller/compose/*` (switch, brightness, colour, IC, version,
  timer, gradual, multi-colour parser)
- Notifications: `ble/{BrightnessParse,LightChildStatusNotifyParse,WifiNotifyParse}.java`
- IoT: `iot/{Cmd,CmdTurn,CmdBrightness,CmdColorWc,CmdStatus,CmdPtReal}.java`
- Per-SKU UI/DIY: `adjust/h60a0/*`, `h60a1/*`, `h60a4/*`, `h60a6/*`, `h60c1/*`, `h1250/*`,
  `h1252/*`, `h1270/*` (incl. `music/*`, `graffiti/*`), `h12d0/*`, `h1141/*`
- Shared UI: `adjust/ui/*`, `adjust/v1/*`

## 8. Gaps / unknowns

- H60A6 colour sub-mode `0x0D` is declared but not built by `SubModeColorV1`; its concrete body
  is produced by the H60A6 colour UI/op writer. The sub-mode byte is certain, the byte layout is
  not fully recoverable statically.
- H1250/H12D0 colour piece counts are runtime (`ColorPieceConfig` via `DefInfo`), not constants.
- DIY effect lists for H60A0/H60A1/H60C1/H1232/H1252/H1270/H1250/H12D0/H1141 are largely
  DIY-new config / server driven; the explicit integers above are the ones present as constants.
- H1141 graffiti protocol is `0x03` while its normal DIY protocol is `0x58`.
- Custom music (H1270) is cloud-backed (`CustomMusicApi`), so effect codes/room presets are
  runtime.
- `Compose4DefWrite` multi-frame sequencing is in the base library; this split passes controller
  lists.
