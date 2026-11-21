# split_pact_floorlamp — floor lamps (H6071/H6075, H60B0/H60B3/R60B3, H60B1)

Source root: `decompiled/jadx-splits/split_pact_floorlamp/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

---

## 1. Overview / family and SKUs

Three independently registered sub-families share one split (the prompt also called out
"straightfloorlamp", but that family's code lives in `split_pact_hollowlamp`):

| SKU | goodsType | family | light engine | transports | source package |
|---|---|---|---|---|---|
| H6071 | 57 | floor lamp, CCT only | brightness + color temp, no RGB | ble + iot | `com/govee/h6071` |
| H6075 | 67 | floor lamp, CCT only | brightness + color temp, no RGB | ble + iot | `com/govee/h6071` |
| H60B0 | 301 | floor lamp, 9-segment RGBIC + 2 zone lights | 0x0D color, scenes/music/DIY, operate mode | ble + iot (+ matter pairing) | `com/govee/h60b0` |
| H60B3 | 301 | floor lamp (same goods type, different DIY set) | 13 ceiling / 7 upper / 3 lower DIY effects | ble + iot (+ matter pairing) | `com/govee/h60b0` |
| R60B3 | 301 | floor lamp variant (same goods type) | as H60B0/H60B3 | ble + iot (+ matter pairing) | `com/govee/h60b0` |
| H60B1 | 300 | RGBICWW floor lamp, 3 color pieces | 0x15 color, 32-bit segment mask, scenes+music/DIY | ble + iot (+ matter pairing + local MQTT) | `com/govee/h60b1` |

Evidence:

- H6071/H6075: `h6071/pact/Support.java` (`c="H6071"`, `d="H6075"`, `e={57,67}`),
  `SubMaker` adds `BleIotSkuItemV1(57/67)` extending `AbsBleWifiSku`.
- H60B0 group: `h60b0/Support.java` (`c="H60B0"`, `d="H60B3"`, `e="R60B3"`, `v={301}`);
  devices are `AbsDeviceModel4BleIot`; Matter pairing via `ConfigH60B0` `MatterInterceptor`.
- H60B1: `h60b1/pact/H60B1Support.java` (`d={300}`), `H60B1Maker extends AbsBleWifiSku`;
  add flow uses `/base2light/common/NormalWifi` + `MatterInterceptor`.

All six are **ble+iot**: BLE GATT plus cloud/WiFi (`turn`/`brightness`/`colorwc`/`ptReal`).
H60B0/H60B3/R60B3 and H60B1 additionally expose Matter commissioning through the base
Matter module, and the DIY dialogs can use the device's **local MQTT** channel
(`DeviceCommCapability.supportMqtt`) for large `ptUrl` payloads.

Key ranges:

| item | H6071/H6075 | H60B0/H60B3/R60B3 | H60B1 |
|---|---|---|---|
| brightness | 1–100 | 1–100 | 1–100 |
| kelvin | 2200–6500 | 2700–6500 | 2700–6500 |
| color pieces | none (CCT) | 9 | 3 (declared) |
| scene groups | `{0}` | `{1,0,5,4,6}` | `{0,2,3,5}` |
| scene default | — | 22 (`0x16`) | 2002 |

---

## 2. Transports & GATT UUIDs

| family | service | characteristic |
|---|---|---|
| H6071/H6075 | `00010203-0405-0607-0809-0a0b0c0d1910` | `00010203-0405-0607-0809-0a0b0c0d2b11` |
| H60B0 group | `00010203-0405-0607-0809-0a0b0c0d1910` | `00010203-0405-0607-0809-0a0b0c0d2b11` |
| H60B1 | `00010203-0405-0607-0809-0a0b0c0d1910` | `00010203-0405-0607-0809-0a0b0c0d2b11` |

Write proType `0x33`, read `0xAA`, multi-packet write `0xA3`.
`H60B0.ble.Ble.r()` returns `com.govee.matter.pact.BleComm` (same UUIDs).
Frame: `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC`.
Read data available to parsers = frame bytes `[2..18]`; write results = `[3..18]`.
`AbsModeController.p()` = `{0x01}` (read current mode).

---

## 3. BLE frame + command table

### 3.1 Common (all three families)

| name | op | payload | layout | response | source |
|---|---|---|---|---|---|
| power | `0x33/0x01` | `01 <0/1>` | `[0]` state | `0xAA/0x01` → `[0]` | `base2light/ble/controller/SwitchController.java` |
| brightness | `0x33/0x04` | `04 <1..100>` | `[0]` 1–100 | `0xAA/0x04` → `[0]` | `base2light/ble/controller/BrightnessController.java` |
| heartbeat | `0xAA/0x01` | `01` | — | `[0]` alive | `base2light/ble/controller/HeartController.java` |
| read mode | `0xAA/0x05` | `05 01` | `p()`=`{1}` | mode + sub-mode | `AbsModeController` |
| read color group | `0xAA/0xA5` | `A5 <group>` | response `[0]=group`, then 4 × `brightness,R,G,B` | `0xAA/0xA5` | `base2light/kt/general_controller/Controller4ColorInfoByGroup.java` |

### 3.2 H6071 / H6075 (CCT-only floor lamp)

| name | op | payload | layout | source |
|---|---|---|---|---|
| color temp | `0x33/0x05` | `05 15 04 <kelvinLo> <kelvinHi>` | sub-mode 0x15, flag 0x04, kelvin 16-bit **little-endian**, clamped 2200–6500 | `h6071/ble/SubModeColor.java` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi> <speed>` | effect 16-bit **little-endian**; speed byte default `0xFF` | `h6071/ble/SubModeScenes.java` |
| read mode | `0xAA/0x05` | `05 01` | returns sub-mode 0x04 or 0x15 | `AbsModeController` |
| security key write | `0x33/0xB2` | `<raw secret bytes>` | base64 secret decoded to bytes, written verbatim | `base2light/ble/controller/SecretKeyController.java` |
| security key read | `0xAA/0xB1` | — | 8-byte result | same |

H6071/H6075 have **no RGB** (`SmartRoomOp.onlySupportBrightness() == true`,
`makeSetColorOpBytes` returns null). Pairing/secret key is the only "extra" command.

### 3.3 H60B0 / H60B3 / R60B3 (goods 301)

| name | op | payload | layout | source |
|---|---|---|---|---|
| color | `0x33/0x05` | `05 0D R G B CT_H CT_L R2 G2 B2` | sub-mode 0x0D; CT is a 16-bit **big-endian** value (kelvin when white mode); R2G2B2 = temperature RGB; 9 bytes | `h60b0/ble/SubModeColor.java` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi> <speed>` | effect 16-bit **LE**, speed byte (default 0) | `h60b0/ble/SubModeScenes.java` |
| music | `0x33/0x05` | `05 13 <musicCode> <sensitivity>` | sensitivity 0–99 | `h60b0/ble/SubModeMusic.java` |
| DIY | `0x33/0x05` | `05 0A <diyLo> <diyHi>` | 16-bit LE DIY code | `h60b0/ble/SubModeNewDiy.java` |
| advanced scene | `0xA3/0x5B` | V3 packetisation (see below) | multi-packet, last group followed by `05 04 <eff>` | `h60b0/pact/Comm.java` `a()` / `makeSceneCmd4MulIotComm` |
| DIY upload | `0xA3/<diy.cmd>` | multi-packet V1, then `05 0A <code>` | `CmdPtReal` list; payload from `DiySendData` | `h60b0/pact/Comm.java` `makeDiyCmd4IotCommMulti` |
| scene read/status | `0xAA/0x42` | `42 <bits>` | switch bits: bit8 overall, bit7 left/zone, bit6 right/zone (as parsed) | `h60b0/adjust/h60b0/Info4Detail.java D()` |
| detail/other read | `0xAA/0x41` | `41` | `[1]` value (on-off memory/splicing) | `Info4Detail.G()` |
| timer read | `0xAA/0x23` | `23` | 4 timers (NewTimerV1) | `NewTimerV1Controller` |
| sleep/wake reads | `0xAA/0x11` / `0xAA/0x12` | `11` / `12` | Sleep/WakeUp info | `SleepController` / `WakeUpController` |

Advanced-scene packetisation: `MultipleControllerCommV1.makeSendBytesV3(0xA3, 0x5B, paramBytes, 97)`
produces groups of 20-byte frames. The `K()` / `makeSendBytesV3` layout is:

```
first/only packet: [0]=0xA3 [1]=0 [2]=2 [3]=totalPackets [4]=0x5B
                   [5]=groupCount [6]=groupIndex [7..14]=verify/random
                   [15..18]=first 4 data bytes
middle packets:    [0]=0xA3 [1]=packetIndex [2..18]=17 data bytes
final packet:      [0]=0xA3 [1]=0xFF [2..]=tail data
```

Each group is sent as a `CmdPtReal`; the mode frame `05 04 <scene code>` is appended to the
last group.


### 3.4 H60B1 (goods 300)

| name | op | payload | layout | source |
|---|---|---|---|---|
| color 0x15 | `0x33/0x05` | `05 15 <subtype…>` | see below | `h60b1/ble/SubModeColor.java` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi> <music0..3 LE> <speed/dir>` | 8 bytes: effect 16-bit LE, 32-bit LE music code (0 if none), direction/speed byte | `h60b1/ble/SubModeScenes.java` |
| music | `0x33/0x05` | `05 13 <musicCode> <sensitivity>` | 0–99 | `h60b1/ble/SubModeMusic.java` |
| DIY | `0x33/0x05` | `05 0A <codeLo> <codeHi> <code2Lo> <code2Hi>` | 2× 16-bit LE codes | `h60b1/ble/SubModeNewDiy.java` |
| color strip group | `0x33/0x05` | `05 15 04 <group> R G B [R G B …]` | group index + up to 4 RGB triples | `h60b1/pact/Comm.java` `a()` |
| brightness group | `0x33/0x05` | `05 15 03 <group> b0..b13` | 14 brightness values per group | `h60b1/pact/Comm.java` `d()` |

H60B1 0x15 payload detail (`SubModeColor.getWriteBytes()`, 17-byte buffer):

```
[0] = 0x15
subtype 1 (RGB + CT + segment mask):
  [1]=01 [2..4]=R,G,B
  [5..6]=CT big-endian (0 = pure RGB)
  [7..9]=temperature RGB
  [10..13]=32-bit segment mask (bit n = piece n, LSB first)
subtype 2 (brightness):
  [1]=02 [2]=brightness 0..100 [3..6]=32-bit piece mask
subtype 3 (brightness set):
  [1]=03 [2..16]=brightness values
subtype 4 (strip group): [1]=04 [2]=group index [3..]=RGB groups (4 per 0x15 frame)
```

Piece count declared **3** for goods 300 (`H60B1Support.b()`), color-temp range 2700–6500.

### 3.5 Color-temp normalization

- H6071/H6075: `Support.getColorTemKelvinRange()` = `{2200,6500}`;
  `getInvalidKelvin()` clamps.
- H60B0: `Support.d()` = `{2700,6500}`; `Constant.getTemColorByKelvin` gives
  `{flag, kelvin, rgb}`.
- H60B1: `H60B1Support.c()` = `{2700,6500}`, `NumberUtil.getValidRangeValue`.

---

## 4. BLE notifications / readings

### H6071/H6075 (`h6071/ble/BleNotifyComm.java`)

| op | parser | layout |
|---|---|---|
| `0x20` | `BrightnessNotifyParse` | `[0]` brightness |
| `0x30` | `ColorTemNotifyParse` | `[0..1]` unsigned 16-bit big-endian kelvin |
| `0x11` | `WifiNotifyParse` | `[0]==0` → WiFi connected |

### H60B0 group (`Ble$generateNotify$1`)

| op | parser | layout |
|---|---|---|
| `0x11` | `DefParser.makeWifiNotifyParser` | `[0]==0` → WiFi connected |
| `0x40` | `DeviceStatusNotifyParse` | first 10 bytes forwarded (`EventDeviceStatus`) |

Mode/status is otherwise read back from `ptReal` frames:
`0x05` mode (sub-mode 0x04/0x0A/0x13/0x14/0x2C), `0x41`, `0x42`, `0x11`, `0x12`, `0x23`
(`h60b0/adjust/h60b0/Info4Detail.java`). H60B0 mode byte map:

| mode byte | meaning | UI mode |
|---|---|---|
| `0x04` | scene | 10 (or 11 when DIY-studio scene) |
| `0x0A` | DIY | 11 (12 for code 800) |
| `0x13` | music | 8 |
| `0x14` (20) | interaction / hu dong | 18 |
| `0x2C` (44) | operate (zone) | 19 |

Operate (0x2C) read layout (`operate/SubMode4Operate.java`):
`[0..1]` int16 LE CT(top), `[2]` brightness(top), `[3..4]` int16 LE CT(bottom),
`[5]` brightness(bottom); color data carries 9 pieces (8 top + 1 bottom).

### H60B1 (`h60b1/ble/BleNotifyComm.java`)

| op | parser | layout |
|---|---|---|
| `0x11` | `WifiNotifyParse` | `[0]==0` WiFi |
| `0x20` | `BrightnessNotifyParse` | `[0]` brightness |
| `0x30` | `DeviceSwitchStatusNotifyParse` | `[0]==1`, `[1]==1` main switch, `[2]==1` second switch |
| `0x40` | `DeviceStatusNotifyParse` | 10 bytes |
| music | `MusicNotifyParse` (onlinesound) | music frames |
| `0x60` | `MovieFeastOnOffNotifyParse` | movie-feast on/off (`[0]==1`, `[1]`) |

---

## 5. IoT commands + status/readings schema

### Commands

| cmd | data | families | source |
|---|---|---|---|
| `turn` | `{"val":0/1}` | all | `h6071/iot/CmdTurn`, `base2light/iot/CmdTurn` |
| `brightness` | `{"val":1..100}` | all | `h6071/iot/CmdBrightness`, `base2light/iot/CmdBrightness` |
| `colorwc` | `{"colorTemInKelvin":…}` and/or `{"red","green","blue"}` | all | `h6071/iot/CmdColorWc`, base `CmdColorWc` |
| `ptReal` | `{"command":["<base64 20-byte frame>",…]}` | all | `h6071/iot/CmdPtReal`, `base2light/pact/iot/CmdPtReal` |
| `status` | read (`type=0`) | all | `AbsIotManagerV1` |
| `online` | read | all | `AbsIotManagerV1` |
| `ptUrl` | `{"url":…}` + `{"command":base64}` | H60B0/H60B1 DIY/MQTT | `CmdPtUrl` (base `light.AbsOpCommDialog4BleIot`) |

Outgoing envelope: `msg.{transaction,accountTopic,type=1,origin=32,cmdVersion,cmd,data}`;
switch builder parses `IotMsgProType.V2` / `IotMsgV2`.

### Status schemas

H6071/H6075 (`h6071/iot/CmdStatusV0.java`):

```
state: { onOff:int, brightness:int, mode:int, colorTemInKelvin:int }
op.command: [base64 frame, …]
  frame[1]==0x05  -> mode (color-temp sub-mode 0x15)
  frame[1]==0x23  -> timers (4)
  frame[1]==0x11  -> sleep
  frame[1]==0x12  -> wakeup
```

H60B0 (`Info4Detail.E()`):

```
state: { onOff:int, brightness:int }
op.command frames:
  0x41 -> on-off memory / splicing value
  0x42 -> switch bits (bit8 overall, bit7, bit6)
  0x05 -> mode + sub-mode (0x04/0x0A/0x13/0x14/0x2C)
  0x11 -> timer, 0x12 -> wakeup, 0x23 -> new timers
  0x42/0x41 etc. trigger change-flags 1..6 for UI refresh
```

H60B1: same `state`/`op` envelope; scene `0x04` frames also carry a 32-bit music code,
color read-back is via `0x15` frames from `ptReal`.

H60B1 advanced scenes: `Comm.makeSceneCmd4MulIotComm` builds `CmdPtReal` frames
`0xA3/0x5B` + `05 04` effect. H60B0 same with 97-byte chunks.

---

## 6. Other protocols

| name | details | source |
|---|---|---|
| Matter | H60B0/H60B3/R60B3 and H60B1 are Matter-commissionable: `MatterInterceptor` in the add config, `MatterManager`/`MtGuide` in settings, `AddDeviceConfig.isSupportMatter(...)`, `com.govee.matter.pact.BleComm` for GATT. No Matter cluster/attribute table is defined in the split — commands still travel as Govee BLE/IoT frames. | `h60b0/ConfigH60B0.java`, `h60b1/add/AddDeviceM.java`, `h60b1/detail/H60B1SettingActivity.java` |
| local MQTT | Large DIY payloads use `CmdPtUrl` over local MQTT when `DeviceCommCapability.supportMqtt(...)` is true and a topic exists (`Iot.r.v()`), otherwise cloud IoT. MQTT is not used for normal control. | `h60b1/pact/bleiot/OpDiyCommDialog4BleIot.java`, base `device/DeviceCommCapability.java` |
| WiFi provisioning | `/base2light/common/pair`, `/base2light/common/name`, `/base2light/common/NormalWifi`; 32/64-char SSID/password limits (`Support.getWifiInputLimit`). | `h60b1/add/AddDeviceM.java`, `h60b0/ConfigH60B0.java` |
| BLE remote | H60B1/H60B0 pairing events only (no dedicated 0xA4 controller in these sub-families). | — |

---

## 7. Dynamic effects / motion / music / scenes / DIY

### H60B0 / H60B3 / R60B3

- **9-segment color**: 8 top pieces + 1 bottom piece; `Support.assembleNineSegmentColor()`
  expands shorter color sets to 9 by repeating the last value.
- **Scenes**: 16-bit LE effect code, groups `{1,0,5,4,6}`; advanced scenes use
  `MultiNewScenesControllerH60B0.getController(sceneCode, decryptedParam)` and
  `ScenesOp` categories; `0xA3/0x5B` multi-packet then `05 04`.
- **Music**: `05 13 <code> <sens>`; mode byte `0x13`; music codes from `H60B0MusicMode`
  (e.g. 130, 131, 51, 81, 83, 80, 48, 49), player state from onlinesound.
- **DIY**: `05 0A <code>`; upload blob starts with byte `0x50`, length LE16, then effect
  data; effects `DiyM.EffectCode.h/t/m/g` (= 0, 5, 1, 255) with AI categories 28/29/30;
  H60B0 DIY support adds extra code `H60B0DiyNewConfig.t`.
- **H60B3 DIY**: three independent blobs in one 0x50 container —
  `[0]=0x50 [1..2]=len LE16 [3]=upperLen [4..]=upper [..]=lowerLen [..]=lower [..]=ceilingLen [..]=ceiling`.
  Effect type IDs: upper **1..7** (`ShangLightPro`), lower **1..3** (`XiaLightPro`),
  ceiling **1..13** (`CeLightPro`). Hairdryer-style effect families:
  渐变/呼吸/闪烁/彩虹/流光/流星/扩散/交错/微光/分层/… (see the `*Light.java` classes).
- **Operate (zone) mode 0x2C**: two independent zone lights (top 8 segments, bottom 1),
  each with CT + brightness + color list; read layout in section 4.
- **Interaction mode 0x14**: gesture/clap interaction container (`SubMode4HuDong`).

### H60B1

- **Scenes**: default code **2002**; groups `{0,2,3,5}`; 0x04 payload
  `04 <effLo> <effHi> <musicCode 4B LE> <dir/speed>`.
- **Music**: 0x13, sensitivity 0–99; mic mode; `OnlineMusicM`.
- **DIY**: 0x0A with two 16-bit codes; upload via `0x50` blob (`H60B1` DIY support uses
  `DiyM.EffectCode.C0/t/l/D/y/C/R0/S0`, i.e. codes 67, 5, 0, 15, 9, 14, 82, 83; AI
  categories 28 + `D0`=68).
- **Color**: 0x15 with up to 32 segment bits and color-strip groups of 4 RGB; brightness
  groups of 14 values.
- **Movie feast**: notified on `0x60`.

### H6071/H6075

Only CCT + brightness + scene effect (16-bit LE, speed byte). No RGB/music/DIY.

---

## 8. Source map

- H6071/H6075: `h6071/pact/Support.java`, `SubMaker.java`, `SubLib.java`, `ble/*`, `iot/*`, `scenes/*`
- H60B0 group: `h60b0/Support.java`, `ConfigH60B0.java`, `ble/*`, `pact/Comm.java`, `pact/bleiot/*`, `adjust/h60b0/*`, `adjust/h60b0/diy/*`, `adjust/h60b0/diy/h60B3/*`, `adjust/h60b0/music/*`, `adjust/h60b0/operate/*`, `vm/VM4H60B0.java`
- H60B1: `h60b1/pact/H60B1Support.java`, `pact/Comm.java`, `ble/*`, `pact/bleiot/*`, `detail/*`, `diy/*`, `add/*`
- base: `base2light/ble/controller/{Switch,Brightness,Heart,SecretKey,AbsMode,AbsModeController}.java`, `base2light/iot/*`, `base2light/pact/newdetail/*`, `device/DeviceCommCapability.java`, `matter/*`

---

## 9. Gaps / unknowns

1. **H60B0 operate (0x2C) write payload** is produced by the generic newdetail color
   framework (`SubMode4Color` + `ColorModeControllerConfig`); only the read layout is
   statically explicit in the split.
2. **H60B0 interaction (0x14)** layout comes from base `SubMode4HuDong`; not decoded here.
3. **Scene catalogues** (effect IDs/names, advanced scene params) are cloud-served
   (`ScenesM`/`ScenesOp`/`MultiNewScenesControllerH60B0`); only the wire format is static.
4. **H60B1 "3 color pieces"** is what `H60B1Support.b()` returns; the 0x15 format supports
   up to 32 segment bits, so the real hardware piece count could be larger at runtime.
5. H60B0/H60B3/R60B3 share goodsType 301; which DIY/effect set is active is decided by
   `DiyNewConfig` registration + SKU, not by a separate goods type.
6. **Matter** cluster mapping is not in this split; it is delegated to the base Matter
   module, and Govee BLE/IoT frames remain the control path.
7. MQTT is used only for large `ptUrl` DIY payloads, not for routine control.
