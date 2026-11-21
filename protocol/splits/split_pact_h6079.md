# split_pact_h6079 — H6079 / H607C / H16B0 + H6020 sub-family

## Overview / family and SKUs

Two goods-type families share this split module:

| goodsType | SKUs | product | family class | notes |
|---|---|---|---|---|
| 156 | **H6079** | RGBICWW Floor Lamp ("Glow") | `h6079` | 14 addressable bulbs, 2200–6500 K |
| 209 | **H607C**, **H807C** | Floor Lamp | `h6079` | 13 bulbs, 2200–6500 K, custom music |
| 376 | **H16B0** | Floor Lamp (RGBICWW) | `h6079` | 17 bulbs, 1000–10000 K, music V3 |
| 210 | **H6020** | Table Lamp | `h6020` | 0x0D/0x15 colour sub-modes, battery |
| 249 | **H6022**, **H8022** | Table Lamp | `h6020` | 12-colour scene set |
| 365 | **H1741**, **R1741** | Table Lamp (battery) | `h6020` | 0x15 colour sub-mode, battery/energy-save |

Sub-libraries: `h6079/pact/SubLib.java` (`Support.j` = 156/209/376) and
`h6020/pact/SubLib.java` (`Support.o()` = 210/249/365). Makers:
`H6079Maker`, `H607CMaker`, `H16B0Maker`, `H6020Maker`, `H6022Maker`, `H1741Maker`
(all extend `AbsBleWifiSku`, i.e. BLE + WiFi/IoT).

Transports: **ble + iot** for every SKU. Matter pairing is additionally advertised for
156/209/376 (`Support.supportMatterFunc`, `H607CMatterHelper`). No LAN/UDP endpoint is
implemented in the split; cloud traffic is the account MQTT topic carried by the IoT layer
(`IotExt.topic`).

## Transports & GATT UUIDs

Both families (`h6079/ble/BleComm.java`, `h6020/ble/BleComm.java` → `BleCommUUID`):

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- heart controller: `HeartControllerNoEvent` (h6079), `HeartControllerNoEvent` (h6020)
- notifications arrive on the same characteristic; notify parsers are registered on the
  service UUID (`BleNotifyComm.getServiceUuid()`).

## BLE frame + command table

Frame = 20 bytes `[proType][cmdType][payload 17][BCC]`, BCC = XOR of bytes 0..18
(`BleUtils.generate20Bytes`, `AbsSingleController.f()/g()`). Write proType `0x33`,
read proType `0xAA`. `AbsModeController.p()` overrides the read payload to `{01}`.

### H6079 / H607C / H16B0 (goodsType 156/209/376)

| # | command | op (proType/cmdType) | write payload (after 33/xx) | response / notes |
|---|---|---|---|---|
| 1 | power | `0x33/0x01` | `01` on, `00` off | `0xAA/0x01` → `[0]` state (`SwitchController`) |
| 2 | brightness | `0x33/0x04` | `[0]` 1..100 | read `0xAA/0x04` → `[0]` value |
| 3 | mode / colour / scene / DIY / music container | `0x33/0x05` | sub-mode block (below) | read `0xAA/0x05` payload `01`; response `[0]`=sub-mode, rest sub-mode bytes |
| 4 | segmented colour write | `0x33/0x05` sub `0x15` | variants 1/2/3 (below) | no direct response |
| 5 | new-DIY select | `0x33/0x05` sub `0x0A` | `0A <diyCode LE16> <slot LE16>` | — |
| 6 | scene select | `0x33/0x05` sub `0x04` | `04 <effect LE16> <musicCode LE16>` | musicCode=0 when music switch off |
| 7 | music | `0x33/0x05` sub `0x13` | V1/V2/V3 forms (below) | new-music (V2/V3) = `13 <code> <sensitivity>` |
| 8 | gradual / fade | `0x33/0xA3` | `[0]` 1 = on, 0 = off | `0xAA/0x05` read (19-byte strip); start/end colour packets flank it |
| 9 | remote-control pair | `0x33/0xA4` | `[0]` 1 = pair, 0 = exit | `0xAA/0xA4`/notify |
| 10 | read bulb/string colour groups | `0xAA/0xA5` | `[0]` start group index | 17 valid bytes: `[idx][brightness][R][G][B] ×4` (`BulbGroupColorV2`) |
| 11 | device info | `0x33/0x08` | empty | `0xAA/0x08` |
| 12 | heart / presence | `0xAA/0x01` | empty | `[0]` != 0 |
| 13 | WiFi/BLE state notify | `0xEE/0x11`? (parser cmdType 17) | — | `[0]==0` = connected (`WifiNotifyParse`) |
| 14 | brightness notify | notify cmdType `0x20` | — | `[0]` brightness, `[1]` extra (h6079) / `[0]` only (h6020) |
| 15 | switch-status notify | notify cmdType `0x30` | — | h6079: `[1]` switch id, `[2]==1` on |
| 16 | device-status notify | notify cmdType `0x40` | — | 10-byte status block (`DeviceStatusNotifyParse`) |
| 17 | movie-feast notify | notify cmdType `0x60` | — | `[0]==1`, `[1]==1` on |

#### Multi-packet framing (DIY / scenes / colour strips)

Long payloads (DIY pixel blobs, scene effect blobs, per-segment colour groups) are wrapped
by `MultipleBleBytes` → `MultipleControllerCommV1`. All packets stay 20 bytes, BCC in byte
19, proType `0xA3`:

- `makeSendBytesV0` (controller `p()==0`): start packet
  `A3 00 00 (packCount+2) <cmdType> 00…`; data packet `A3 <index 1..n> <17-byte chunk>`;
  end packet `A3 FF 00…`.
- `makeSendBytesV1/V2` (controller `p()==1`, e.g. scenes): start packet
  `A3 00 01 <totalPacks> <cmdType>` + first chunk at byte 5..; middle packets
  `A3 <index> <17-byte chunk>`; final packet `A3 FF <last chunk>`.
- `MultipleControllerComm` (legacy) uses `generate20Bytes(proType, cmdType, {0,packCount,p})`
  as start, `[proType][cmdType][index][16-byte chunk]` data packets, and
  `generate20Bytes(proType, cmdType, {FF})` end; 300 ms between packets.

`CmdPtReal` sends each packet as one base64 string in order, so the cloud path reproduces
the same sequence.

#### Colour sub-mode `0x15` (h6079) exact layouts

All are payloads after `33 05` (so first byte is the sub-mode):

- variant 1 (single colour / colour-temp):
  `15 01 R G B kHi kLo R2 G2 B2 m0 m1`
  - `kHi kLo` = colour temperature, signed big-endian 16-bit (°K); 0 means RGB mode.
  - when k != 0 the lamp uses `R2 G2 B2` (temperature RGB) instead of `R G B`.
  - `m0 m1` = 16-bit segment mask, LSB = segment 0 (max 14/13/17 segments).
  - source: `h6079/ble/SubModeColorV2.getWriteBytes()`.
- variant 2 (group brightness):
  `15 02 B m0 m1` — brightness + mask for that group.
- variant 3 (all segment brightness values):
  `15 03 B0 B1 ... Bn` — up to 15 values, one packet.
- `makeSubModeColor(Colors, goodsType)` emits one variant-1 packet per distinct colour plus an
  optional variant-3 packet for `brightnessSet`; only the final packet is flagged "last"
  (`Mode4ColorStrip.a`). `parsePosColor` reads a 20-byte `ptReal` frame as
  `[3]=variant 1`, RGB at 4..6, kelvin at 7..8, RGB2 at 9..11, mask at 12.

#### Music exact layouts

`SubModeMusic` (legacy V1, `subModeCommandType()=0x13`):

`13 <effectCode> <sensitivity 0..99> <autoFlag> [R G B]` — 7 bytes normally `autoFlag=1`
(manual fixed colour, RGB appended), 8 bytes for rhythm code 114 where byte 3 is
dynamic/soft flag: `13 72 sens soft autoFlag R G B`.

`SubModeMusicV2` / `V3` (new music, h6079: version 1; H607C: version 2; H16B0 version 3):
new code path returns `13 <code> <sensitivity>`; old path is identical to V1. H16B0 with
music version ≥3 selects `SubModeMusicV3` (`Support.supportH16B0MusicEffectV3`).

Music codes declared in `newdetail/h6079/music/H6079NewMusicMode`:
`115` (default "impulse"), `114` rhythm, `51` joy/move, `79`, `81`, `116`, `80`,
`131`, `132`, `133`, `8`, `130`, `134`, `135`, `137`. Sub-effect codes 131–137 and
134/135 are the newer H16B0 effects; names live in resources (runtime).
`Sensitivity` is clamped 0..99. `SubModeScenes.musicCode` is 16-bit LE.

#### H16B0/H607C special ranges

- colour-temp: H16B0 1000–10000 K; others 2200–6500 K (`Support.getColorTemRange`).
- bulb count: H6079 14, H607C 13, H16B0 17 (`Support.getBulbStringMaxNum`).
- DIY IC grid: H6079 54×10, H607C 144×30, H16B0 48×19 (`Support.getDiyIcNum`).
- H16B0 music effects split into 117–123 style custom effects (`newdetail/music/H16b0MusicProxy`).

### H6020 / H6022 / H1741 (goodsType 210/249/365)

Same switch/brightness/mode/scene/DIY/music opcodes. Differences:

| command | op | payload |
|---|---|---|
| colour (old, all SKUs except 365 chooses 0x0D) | `0x33/0x05` sub `0x0D` | `0D R G B kHi kLo R2 G2 B2` (9 bytes) |
| colour V2 (goodsType 365) | `0x33/0x05` sub `0x15` | `15 01 R G B kHi kLo R2 G2 B2 m0..m6` or `15 02 B m0..m6`; only an 8-bit segment array exists, so only `m0` is non-zero (bytes 11..16 written as 0) |
| scene | `0x33/0x05` sub `0x04` | `04 <effect LE16> <musicCode LE16>` |
| new DIY | `0x33/0x05` sub `0x0A` | `0A <diyCode LE16> <slot LE16>` |
| music | `0x33/0x05` sub `0x13` | `13 <code> <sensitivity 0..99>` |
| gradual | `0x33/0xA3` | `00/01` |
| remote pair | `0x33/0xA4` | `00/01` |
| read colour groups | `0xAA/0xA5` | `[idx]` |
| preset multi-scene | `0x40/0x41/0x50/0x58` or `0x04` | see dynamic effects |

`Comm.e/g` choose `SubModeColorV2` only for goodsType 365, otherwise `SubModeColor`
(0x0D). Brightness/temperature controllers are the shared base classes.

Preset multi-scene: `h6020/adjust/controller/MultiPresetScenesController` extends
`AbsMultipleControllerV14Scenes`; its constructor takes an opcode. `Support.g()` passes
**88 (0x58)** for H6020 and for parameters whose first byte is 0x40/0x41, otherwise
**4**. The constructor strips the first byte of the cloud scene parameter and uses the
rest as the multi-packet payload. (`0x40`/`0x41`/`0x50` are scene-parameter markers, not
opcodes.)

## BLE notifications / readings

Registered in `h6079/ble/BleNotifyComm` / `h6020/ble/BleNotifyComm`:

| parser | cmdType | layout / meaning | source |
|---|---|---|---|
| `WifiNotifyParse` | 17 (0x11) | `[0]==0` → WiFi/BLE connected | h6079/h6020 `ble/WifiNotifyParse` |
| `BrightnessNotifyParse` | 32 (0x20) | h6079: `[0]` brightness, `[1]` unknown/aux; h6020: `[0]` brightness | both `ble/BrightnessNotifyParse` |
| `RemoteControlParse` | 0xA4 (-92) | `[0]` pairing state | `h6079/ble/RemoteControlParse` |
| `DeviceSwitchStatusNotifyParse` | 48 (0x30) | h6079: `[1]` switch id, `[2]==1` on. h6020: `[0]==1` → `[1]` on, `[2]`?; `[0]==0x30` → `[1]` battery byte | both |
| `DeviceStatusNotifyParse` | 64 (0x40) | 10-byte device status block | base |
| `MusicNotifyParse` | onlinesound lib | music/white-noise state | base `onlinesound.cmd` |
| `MovieFeastOnOffNotifyParse` | 96 (0x60) | `[0]==1`, `[1]==1` on | base |

`AbsController.m()` strips headers: read (0xAA) → 17 valid bytes from index 2; write
(0x33) → 16 bytes from index 3.

### H6020 IoT / ptReal reading parser

`h6020/iot/CmdStatusV0` parses frames returned in `op.command` (base64 20-byte frames) and
extracts:

| frame cmdType | field | layout |
|---|---|---|
| `0x07` + sub `0x07` | DSP version | `[3][4]` 16-bit BE |
| `0x42` (66) | battery / device info | `BatteryInfo`, `DeviceInfo` from 17 valid bytes |
| `0x41` (65) | other info (pair/voice/disturbance/energy-save/battery/light) | `[0]` bit7 pair status, bit6 pair voice, bit5 disturbance, bit4 energy-save, bit3 light; `[1]` battery byte |
| `0x05` (5) | mode | `[2]` sub-mode + sub-mode block |
| `0x11` (17) | sleep | `SleepInfo` |
| `0x12` (18) | wake-up | `WakeUpInfo` |
| `0x23` (35) | timers | `NewTimerV1Controller.parseAllTimer` |
| `0x36` (54) | worry-free-at-night | `WorryFreeAtNightBean` |
| `0x71` (113) | white-noise player | `PlayerState` |
| `0x79` (121) | volume | valid byte 0 |
| `0x7A` (122) | white-noise switch | valid byte 0 |
| `0xF1` (-15) | day-sync state | `[2]==1` |

Battery byte (`h6020/adjust/bean/BatteryInfo`): bit7 = charging/full flag; bits 6..4 =
level 0..7 (`getValue(b,5,3)`); bit3/bit2/bit1/bit0 = pair-status/pair-voice/disturbance/
energy flags (order per `BatteryInfo.Companion.a`). `d()` returns 98/99 when the full flag
is set, else the 3-bit level.

## IoT commands + status/readings schema

Envelope (`com.govee.base2home.iot.Write` + `AbsCmdWrite`): type 1, origin 32,
cmdVersion 0 (unless overridden), `cmd` from `AbsCmd.getCmd()`, `data` = serialized fields of
the `AbsCmd` subclass. Reads are `Read`/type 0. Incoming variant parsed by the scene
builders is `IotMsgProType.V2` (`IotSwitchCmdBuilderV1`), normal status handling uses the
account-topic JSON with `state` / `op` objects.

| cmd | data fields | source |
|---|---|---|
| `turn` | `{"val":0|1}` | `h6079/iot/CmdTurn` |
| `brightness` | `{"val":1..100}` (brightness range 1..100, no remap) | `CmdBrightness` |
| `colorwc` | `{"color":{"r":..,"g":..,"b":..},"colorTemInKelvin":0|K}`; kelvin only if in allowed set | `CmdColorWc` |
| `ptReal` | `{"command":["<base64 20-byte frame>", …]}` | `CmdPtReal` |
| `pt` | passthrough (declared in `h6079/iot/Cmd`; no Cmd class) | `Cmd` |
| `status` (read) | type 0 | `Model.V()` returns `"status"` |
| `online` | read/keepalive, `getWifiOnlineCmd()` | `AbsEffectOp4BleIot` |

Every non-uniform colour/scene/DIY operation is sent as `ptReal`, one base64 entry per
20-byte BLE frame, in the exact order produced by the multi-controller. `CmdPtReal`
constructors/makers: single controller, `List<byte[]>`, DIY protocol/graffiti/studio/AI,
new-scene controller, colour-strip `Colors`, and raw op list. `getOpCommandByte()` returns
frame byte 1 of the last command; `isSetColorStrip()` requires every frame's byte 2
(sub-mode) to equal 0x15 (h6079) / 0x0D (h6020).

Status schema: the base light status is `State`/`StateV0`
(`com.govee.base2light.pact.newdetail.iot.State{,V0}`): `brightness` int, `onOff` int
(0/1); V0 additionally `color` object, `colorTemInKelvin`, `mode`, `modeValue[]`,
`sleepValue[]`, `wakeupValue[]`, `timer`, `softVersion`, `wifiSoftVersion`.
`ResultPt` (`com.govee.base2light.iot.common.ResultPt`) carries `opcode` +
`modeValue/sleepValue/wakeupValue/timerValue/gradualValue` base64 frame lists, plus a
nested `State {onOff, brightness, mode, wifiHardVersion, wifiSoftVersion}`.

## Other protocols

- **Matter**: 156/209/376 only. `Support.supportMatterFunc` and
  `h607c/H607CMatterHelper` add the Matter interceptor; the version gates are:
  H607C: soft ≥1.00.01, WiFi 3.04.01, hard ≥1.01.17, DSP 1.04.01;
  H6079: soft ≥1.00.21, WiFi 3.04.01, hard ≥1.01.01, DSP 1.05.02; H16B0 unconditional.
  Pairing goes through `MatterManager`/`MtGuide` from `SettingAc`.
- **BLE broadcast / WiFi**: not present; connect state is reported through `0x11`.
- **OTA**: not defined in the split; uses the shared base OTA channel.

## Dynamic effects / motion / music / scenes / DIY

| effect class | sub-mode/op | payload / parameters | notes |
|---|---|---|---|
| solid / segmented colour | `05/15` | variant 1/2/3 above | up to 14/13/17 segments; per-segment mask; optional per-segment brightness (`Support.supportSubModeColor4PartBrightness()` = true) |
| colour temperature | `05/15` or `05/0D` | kelvin 2200–6500 (H16B0 1000–10000), RGB2 fallback | flag = kelvin != 0 |
| scenes | `05/04` | `04 <effect LE16> <music LE16>` | effect IDs are cloud catalog values; default 2002, H6079 default 2099. Supported scene op sets `{0,1,2,3,6}`, apply set `{1,2,6}` (`Support.supportScenesOpSet/supportApplySceneOp`). Scene object also carries direction/speed/music switch which is expanded by `ScenesOp.parseSceneV1` into a multi-packet effect (0xA3) before the final `05/04`. |
| new DIY | `05/0A` | `0A <code LE16> <slot LE16>` | slot for H16B0/H607C multi-DIY; DIY grid sizes above. Multi-packet DIY data (0xA3) precedes this frame; `CmdPtReal.getDiyCmdPt*` appends the select frame. |
| music V1 | `05/13` | `13 code sens autoFlag [RGB]` | codes legacy 0/6/7/8/51/114; sensitivity 0..99 |
| music V2/V3 | `05/13` | `13 code sens` | H607C version 2, H16B0 version 3; code table 115/114/51/79/81/116/80/131–137 |
| custom music / light code | `05/13` + multi | custom effect is a base64 `CustomLightCode` sent as multi frames; `H607CMusicCustomEffect` supplies `musicCode`/`lightEffectCode` | cloud-defined per effect |
| gradient / gradual | `0xA3` | `00/01` enable | part-colour sequence = `05/15` frames + `AA/A5` read + `A3` end frame (`CmdPtReal.isOtherMode2ColorModePtWithBrightness`) |
| preset multi-scene (H6020) | `04/40/41/50/58` | cloud scene param, first byte stripped; `AbsMultipleControllerV14Scenes` multi-packet | H6020 chooses 0x58 for params starting 0x40/0x41 |
| white noise (H6020) | `0x71` / `0x7A` over online-sound channel | media player state (`PlayerState`) | available across the H6020 family per online-sound config; `BleIotInfoH6020` maps 0x71/0x7A |
| hardware effects (direction/preview/segment) | `0x16/0x27/0x0F` shared base controllers | direction byte/effect id/segment mask | not overridden in this split |

Motion: no motion motor in these SKUs. "Gradual" is the only time-based transition.

## Source map (paths traced)

Relative to `decompiled/`:

- `jadx-splits/split_pact_h6079/sources/com/govee/h6079/pact/{Support,Comm,SubLib,SubMaker,Register4Item,Model,DeviceItem,H6079Maker,H607CMaker,H16B0Maker}.java`
- `…/h6079/ble/{BleComm,BleProtocol,BleNotifyComm,Mode,ModeController,Mode4ColorStrip,SubModeColorV2,SubModeScenes,SubModeMusic,SubModeMusicV2,SubModeMusicV3,SubModeMusicVersion,SubModeNewDiy,DiyLocal,Gradual4BleWifiController,BulbStringColorControllerV2,BulbGroupColorV2,RemoteController,RemoteControlParse,WifiNotifyParse,BrightnessNotifyParse,DeviceSwitchStatusNotifyParse}.java`
- `…/h6079/scenes/*.java`, `…/h6079/iot/*.java`, `…/h6079/pact/bleiot/*.java`
- `…/h6079/newdetail/h6079/music/H6079NewMusicMode.java`, `…/h6079/newdetail/music/{H6079,H607c,H16b0}MusicProxy.java`, `…/h6079/h607c/music/*.java`
- `…/h6020/pact/{Support,Comm,SubLib,SubMaker,Register4Item,H6020Maker,H6022Maker,H1741Maker}.java`
- `…/h6020/ble/{BleComm,BleProtocol,Mode,ModeController,SubModeColor,SubModeColorV2,SubModeScenes,SubModeNewDiy,BleNotifyComm,WifiNotifyParse,BrightnessNotifyParse,DeviceSwitchStatusNotifyParse}.java`
- `…/h6020/iot/{CmdStatusV0,State,CmdPtReal}.java`, `…/h6020/adjust/controller/{MultiPresetScenesController,DeviceOtherInfo,CommonReadDeviceInfo}.java`, `…/h6020/adjust/bean/BatteryInfo.java`
- `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/{AbsSingleController,AbsModeController,AbsMode,BrightnessController,SwitchController,HeartController}.java`
- `…/base2light/ble/comm/{AbsBleComm,AbsNotify,AbsNotifyParse,MultipleBleBytes,MultipleControllerComm,MultipleControllerCommV1}.java`
- `…/base2light/iot/common/ResultPt.java`, `…/base2light/pact/newdetail/iot/{State,StateV0}.java`
- `…/base2home/iot/{Write,AbsCmd,AbsCmdWrite}.java`, `…/base2kt/utils/BleUtils.java`
- `jadx-splits/split_pact_h6079/sources/com/govee/common/params/BleCommUUID.java`

## Gaps / unknowns

- Effect catalog (scene IDs, names, per-scene direction/speed, custom music light codes) is
  cloud-supplied at runtime; only defaults 2002/2099 and the op-set masks are static.
- `SubModeMusicV3` is a near-copy of V2 (TAG still `"SubModeMusicV2"`); H16B0 version
  gating is runtime (`supportH16B0MusicEffectV3`).
- H6020 `SubModeColorV2` declares an 8-bit segment array but loops 7 mask bytes; bytes
  11..16 are always zero. Segment count is therefore effectively 8.
- `h6079/scenes` and `h6020/scenes` expose only the basic builders (brightness, colour,
  colour-temp, switch, heart); scene/DIY creative builders are in `base2home.scenes` and
  are data-driven.
- Matter cluster/attribute mapping is in the closed `com.govee.matter` library; the split
  only registers the interceptor and version gates.
