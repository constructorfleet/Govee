# split_pact_fanlight — ceiling fan + light (H1310 / H1370)

Source root: `decompiled/jadx-splits/split_pact_fanlight/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

---

## 1. Overview / family and SKUs

The module implements Govee **ceiling fans with an integrated RGBIC light ring**
("fanlight"). Two goods types, two SKU families, one shared command model:

| SKU | goodsType | fan gears | light segments | remote | notes |
|---|---|---|---|---|---|
| H1310 | 359 | 1–6 | 9 | yes | fan + main light + back light; optional TH sensor binding |
| H1370 | 368 | 1–12 | 14 | yes | fan + main/back light; sleep/natural/direct/**auto** wind modes; shake (oscillate) head; TH sensor binding |

Both SKUs are registered as `AbsBleIotSkuItem` (`pact/SubMaker.java`), i.e. **ble + iot**
(GATT plus cloud/WiFi with `ptReal`). No WiFi-only, IR or Thread variant is declared here.
Matter is **not** used by this module (the `Ble.r()` comm is `com.govee.matter.pact.BleComm`,
but only for its UUIDs/heart handler; there is no Matter pairing config).

Support facts (`Support.java`):

- `d(goodsType)` → max gear: **6** for 359, **12** otherwise.
- `l(goodsType)` → scene categories: `{0,1,2,3,5}` (359), `{0,1,2,3,6,5}` (368).
- 359 declares `DeviceGoodsType 359` with capability pairs `{1,1},{1,2},{1,3},{1,4}`;
  368 declares `DeviceGoodsType 368` with `{1,1},{1,2},{1,3}`.
- `m(info)` / `j(info)` → H1370-only features (shake head, auto program).
- `SensorSupport.a(info)`: 359 needs soft>1 or (soft==1 && sub>=4); 368 needs soft>1 or
  (soft==1 && sub>=3). This gates TH thermometer binding.

---

## 2. Transports & GATT UUIDs

| item | value |
|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` |
| write proType | `0x33` |
| read proType | `0xAA` |
| multi write | `0xA3` (V1 packetisation) |

Declared identically in `ble/BleComm.java`, `ble/BleMultiComm.java`, and the anonymous
`AbsMultipleBleComm`/`AbsNotify` implementations. `BleNotifyComm.getServiceUuid()`
returns the **service** UUID (see gaps).

Frame (all commands):

```
[0]=proType [1]=cmdType [2..18]=payload (zero padded) [19]=XOR BCC of bytes 0..18
```

`AbsController.getValue()` builds write `33 cmd payload`; read `AA cmd payload`
(`AbsControllerNoEvent4Single`). `AbsModeController.p()` overrides the read payload to `{0x01}`.
Notify/read data delivered to parsers is `frame[2..18]` (17 bytes).

---

## 3. BLE frame + command table

### 3.1 Core light / fan

| name | op | payload | layout | response | source |
|---|---|---|---|---|---|
| power | `0x33/0x01` | `01 <0/1>` | `[0]` on/off | `0xAA/0x01` → `[0]` state | `base2light/ble/controller/SwitchController.java` |
| brightness | `0x33/0x04` | `04 <1..100>` | `[0]` 1–100 | `0xAA/0x04` → `[0]` | `base2light/ble/controller/BrightnessController.java` |
| heartbeat | `0xAA/0x01` | `01` | — | `[0]` non-zero = alive | `base2light/ble/controller/HeartController.java` |
| fan control | `0x33/0x31` | see below | subtype byte at `[2]` | `0xAA/0x31` (info parser) | `ble/ControllerFan.java` |
| sub light switch | `0x33/0x36` | `36 <idx> <0/1>` | `[0]` 0=main / 1=back, `[1]` on | `0xAA/0x36` | `ble/ControllerSubSwitch.java` |
| remote pair | `0x33/0xA4` | `A4 01` | `[0]=1` | `0xAA/0xA4` → `[0]` result | `ble/RemoteController.java` |
| exit remote pair | `0x33/0xA6` | `A6` (no payload) | — | `0xAA/0xA6` | `ble/ExitRemoteController.java` |

`ControllerFan` (cmdType **0x31**) factory payloads — 17-byte payload starts at `[2]` of the frame:

| subtype (payload[0]) | factory | payload | meaning |
|---|---|---|---|
| `0x00` | `f(on)` | `00 <0/1>` | fan power |
| `0x01` | `a(gear)` | `01 <gear>` | gear, 1..6 (H1310) / 1..12 (H1370) |
| `0x02` | `d(reverse)` | `02 <0/1>` | reverse wind (winter mode) |
| `0x03` | `c(mode[,extra])` | `03 01 00 <mode> [extra…]` | wind mode: **0=direct 直吹, 1=sleep 睡眠, 2=natural 自然, 3=auto 自动**; mode 3 appends the 6-byte auto program (below) |
| `0x04` | `e(shake)` | `04 <0/1>` | shake/oscillate head (H1370) |

`getCurCompleteCmd()` shows the canonical "apply whole fan state" sequence used for scenes /
eco / cloud sync (`VM4Light.java`):

1. `36 00 <mainLightOn>`
2. `36 01 <backLightOn>`
3. `31 00 <fanOn>`
4. if fan on: `31 02 <reverse>`
5. if auto-capable (sensor bound or H1370) and mode==3: `31 03 01 00 03 <6 auto bytes>`
   else if auto-capable: `31 03 01 00 <mode>`
6. `31 01 <gear>`
7. if H1370: `31 04 <shake 0/1>`

All frames are base64-encoded (`Encode.encryptByBase64`) for `ptReal`.

### 3.2 Color / scene / DIY / music

| name | op | payload | layout | source |
|---|---|---|---|---|
| color / color-temp | `0x33/0x05` | `05 15 …` | shared 0x15 color format (subtypes 1–4, below) | capability spec + `base2light/.../ColorModeControllerConfig` |
| scene | `0x33/0x05` | `05 04 <effLo> <effHi>` | 16-bit **little-endian** effect code (generic newdetail scene frame; fanlight defines no speed byte) | `base2light/ble/controller/AbsModeController` + `ScenesOp` |
| DIY effect | `0x33/0x05` | `05 0A <diyLo> <diyHi>` | 16-bit LE DIY code (inferred: newdetail DIY container) | `SubMode4Diy` (base) |
| music | `0x33/0x05` | `05 13 <musicCode> <sensitivity>` | sensitivity 0..99 (inferred: newdetail music container) | base music sub-mode |
| read_mode | `0xAA/0x05` | `05 01` | `p()` = `{1}` | `AbsModeController.p()` |
| read color group | `0xAA/0xA5` | `A5 <group>` | response `[0]=group`, then 4 × `brightness,R,G,B` | `base2light/kt/general_controller/Controller4ColorInfoByGroup.java` |

Fanlight declares `ColorInstructionVersion.COLOR_MODE_0X15` and
`RelativeBrightnessVersion.RELATIVE_BRIGHTNESS_0X15`
(`capability/FanlightLightCapabilitySpecKt.java`), with **9** color pieces (H1310) and
**14** (H1370). The concrete 0x15 layout (identical instruction version, see the
floorlamp H60B1 implementation `SubModeColor.getWriteBytes()`):

```
payload[0] = 0x15
subtype 1 (RGB + temp, 14 bytes):
  01 R G B CT_H CT_L R2 G2 B2 M0 M1 M2 M3
  CT = 16-bit big-endian color-temperature value (0 when pure RGB)
  R2G2B2 = temperature RGB
  M0..M3 = 32-bit segment mask, bit n = segment n included (LSB first)
subtype 2 (brightness apply, 5 bytes): 02 <brightness 0-100> M0 00 00
subtype 3 (brightness set, 17 bytes): 03 <b0..b13>  pad
subtype 4 (strip group, 3+3n bytes): 04 <groupIndex> R G B [R G B …]
```

For fanlight the segment counts are 9/14, so only the first 9/14 mask bits are meaningful.
Exact per-SKU clamping of subtype 3/4 is applied by `ColorPieceConfig` / `ColorModeControllerConfig`.

### 3.3 Auto program (H1370 / sensor-bound H1310)

Read `0xAA/0x32` payload `{0x01}` (`sensor/SensorBleReads.d()` →
`Controller4ExtBytes.b({50,1})`). Response payload after the status byte:

```
[1]=onGear [2..3]=onTemp (int16 LE, °F×100) [4]=keepGear [5..6]=keepTemp (int16 LE, °F×100)
```

Write is embedded in fan mode 3 (`31 03 01 00 03 <6 bytes>`), generated by
`FanAutoProgram.j()`: `[onGear, onTempHi, onTempLo, keepGear, keepTempHi, keepTempLo]`.
Defaults: H1310 → `onGear=3, keepGear=6`; H1370 → `0/15`; invalid/0 temp falls back to
26.0 °C / 30.0 °C (`FanAutoProgram.f=260`, `h=300`). Gear is clamped to the SKU max.
`Support.d()` is the gear clamp; `FanAutoProgram.e()` converts °F×100 → °C tenths.

---

## 4. BLE notifications / readings

| op | parser | layout |
|---|---|---|
| `0x30` | `DefParser.makeFanlightSwitchNotifyParser` | `[1]` overall switch, `[2]` main light, `[3]` back light (each `==1`) |
| `0x31` | `DefParser.makeFanlightInfoNotifyParser` | `[0]` sub-type: 0 → fan on (`[1]==1`); 1 → gear `[1]`; 2 → reverse (`[1]==1`); 3 → shake signed int16 **LE** `[1..2]`; 4 → auto/standby (`[1]==1`) |
| `0x20` | `DefParser.makeBrightnessNotifyParser` | `[0]` brightness 0–100 |
| `0x40` | `DeviceStatusNotifyParse` | first 10 payload bytes forwarded as `EventDeviceStatus` |
| `0xA4` | `makeRemoteControlNotifyParser` | `[0]` remote pairing/status byte |
| `0x11` | `WifiNotifyParse` | `[0]==0` → WiFi connected |
| music | `MusicNotifyParse` (onlinesound) | music spectrum/status frames |

Heartbeat is `0xAA/0x01`; a read result with non-zero `[0]` means online.

Additional base reads used by the detail page (`Compose4BaseInfoSingleRead`): timers
`0xAA/0x23` (4 timers), sleep `0xAA/0x11`, wakeup `0xAA/0x12`, brightness `0xAA/0x04`,
mode `0xAA/0x05 {01}`, color group `0xAA/0xA5 <group>` (4 × `brightness,R,G,B`).
Soft/hard version reads are also issued but their cmdType is runtime-configured by
`ControllerSoftVersion` / `ControllerHardVersion`.

---

## 5. IoT commands + status/readings schema

`pact/IotSwitchCmdBuilder.java` implements commands as `IotMsgProType.V2`
(`IotMsgV2`); settings/detail use the generic V1-style `state` + `op` JSON.

### Commands

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0/1}` | `base2light/kt/iot/CmdTurn` via `IotSwitchCmdBuilder` |
| `brightness` | `{"val":1..100}` | `CmdBrightness` (`Opacity` builder uses `Comm`/dialog, base) |
| `colorwc` | `{"colorTemInKelvin":2700..6500}` or `{"red","green","blue"}` | `CmdColorWc` (`AbsEffectOp4BleIot.getRoomOp4Iot`) |
| `ptReal` | `{"command":["<base64 20-byte frame>", …]}` | `Cmd4PtReal` / `CmdPtReal` (scene, DIY, color strips, fan sequence) |
| `status` / `online` | read (`type=0`) | `AbsIotManagerV1` status flow |

Outgoing envelope (V0/V1 `Write`): `msg.{transaction,accountTopic,type=1,origin=32,
cmdVersion,cmd,data}`. V2 incoming parsed as `IotMsgV2` (`cmd`, `cmdVersion`, `type`,
`proType`, `device`, `sku`, `softVersion`, `transaction`).

### Status

```
state: { onOff:int, brightness:int, colorTemInKelvin:int, mode:int }
op.command: [ base64(20-byte BLE frame), … ]   // 0x31 fan frames, 0x05 mode frames,
                                               // 0x41 color-strip frames, 0x11/0x12/0x23
```

`VM4Light.F1()` rebuilds all switches (`open`, main, back, fan, reverse), gear
(`s3`), reverse (`t3`), shake (`u3`) from `Info4Detail` + `ptReal` frames, then refreshes
color strips (`Controller4ColorInfoByGroup`, 4 pieces per read group).

### TH sensor binding (optional accessory)

- bind MAC read: `0xAA/0x08`, payload `{08}`; response 6-byte MAC (reversed order).
- sensor data read: `0xAA/0x10`, payload `{10}`; `SensorBleParser.f()`:
  `[0]` bit0 online, bit7 built-in; `[1..3]` packed temperature **24-bit little-endian**
  (unit 0.001 °C, bit23 = sign: 0 positive, 1 negative); `[4]` offset minutes;
  `[5]` unit (`1` = °F, else °C). `0xFFFFFF` = no reading.
- heartbeat `0xAA/0x01` variant: `SensorBleParser.d()` expects `[0]=0xAA,[1]=0x00`,
  then `[0]` online, `[1..3]` packed temp, `[4]` offset, `[5]` auto-standby,
  `[7]` unit.
- auto program read `0xAA/0x32` (section 3.3).

No humidity field is parsed by fanlight (`SensorReading` humidity slots are null).

---

## 6. Other protocols

| name | details | source |
|---|---|---|
| Matter | not enabled for these SKUs. `Ble.r()` returns `com.govee.matter.pact.BleComm`, but only UUID/heart plumbing; no Matter add/pair config. | `ble/Ble.java` |
| WiFi / LAN | no dedicated MQTT/LAN class in the split; device is BLE+cloud IoT. Large payloads use `ptReal` / `ptUrl` generically. | — |
| BLE remote | 2.4 GHz remote pairing via `0xA4` / `0xA6`; `EventPair`, `EventPairNotify`, `EventRemoteControlInfo` expose the result. | `ble/RemoteController.java`, `ble/ExitRemoteController.java` |
| TH broadcast | sensor binding only (section 5, `0x08`/`0x10`/`0x32`). | `sensor/*` |

---

## 7. Dynamic effects / motion / music / scenes / DIY

### Fan behaviours (H1370)

| mode id | name | payload |
|---|---|---|
| 0 | direct 直吹 | `31 03 01 00 00` |
| 1 | sleep 睡眠 | `31 03 01 00 01` |
| 2 | natural 自然 | `31 03 01 00 02` |
| 3 | auto 自动 | `31 03 01 00 03 <6 auto bytes>` |

Additional attributes: gear 1..12, reverse 0/1, shake 0/1; gear max 6 on H1310.
Auto program maps temperature → gear (on/keep) and is sensor-driven.

### Scene effects

16-bit LE effect codes (`05 04 lo hi`). Scene catalogue/categories come from cloud
(`ScenesM`/`ScenesOp`); local UI groups are `Support.l()`: `{0,1,2,3,5}` (H1310) and
`{0,1,2,3,6,5}` (H1370). Advanced/scene-v1 effects are multi-packet
`AbsMultipleControllerV14Scenes` sent via `ptReal` (`CmdPtReal.getNewScenesCmdPtReal`),
optionally followed by a mode frame. `ScenesConfigBean(2, 0, groups, …)` is the detail UI config.

### DIY

Two independent DIY builders:

**H1310** (`h1310/diy/Pro4H1310Diy.java`) — a two-part effect blob:

```
[0..1] = total length, big-endian 16-bit
[2]    = mainProLen
[3..]  = mainPro bytes
[..]   = subProLen
[..]   = subPro bytes
```

- mainPro: `[0]=effectType` (0 none, **1 渐变 TiaoBian, 2 单入单出 DanRuDanChu, 3 呼吸 HuXi,
  4 色温 SeWen**), `[1]=len`, then type-specific bytes (`h1310/diy/*MainLight.java`).
- subPro: `[0]=on (1)`, `[1]=len`, `[2]=effectType` (**1 渐变, 2 单入单出, 3 呼吸, 4 色温,
  5 跑马灯 PaoMaDeng, 6 绽放 ZhanFang, 7 堆叠 DuiJi, 8 萤火 YingHuo, 9 反复 FanFu**),
  then type-specific bytes (`h1310/diy/*SubLight.java`).
- Upload: `MultiController.a(bytes, (byte) 0x58)` → proType `0xA3`, cmdType `0x58`,
  payload `[lenHi,lenLo,blob]`, multi-packet V1; then mode `0x05/0x0A` with DIY code **254**
  (`0x0A FE 00`).
- DIY capability codes: `DiyM.EffectCode` groups 0/1/4/5 + mix `255`; max 8 colors/effect,
  speed 1..100 (default 50); `H1310DiyConfig` adds effect codes **795** and **812**.

**H1370** (`h1370/diy/*`) — `H1370DiyEffect` / `H1370EffectBean`, upload code **0x58**
(`H1370DiyParse.getEffectCode()`), 11 basic effect types (IDs **1..7, 10, 8, 9, 11**),
optional advanced DIY (`H1370AdvanceDiyEffect`). Color/speed/direction parameter objects
are `DiyColorParams` / `DiySpeedParams` / `DiyDirectionParams`.

### Music

`05 13 <musicCode> <sensitivity 0..99>`; microphone/online music UI (`h1310/OnlineMusicConfig`,
`h1370/OnlineMusicConfig`), realtime mic mode (`DelegateOnlyMic`), music notify parser.
Color-music effects are animated by the phone microphone; no segment payload over BLE
except the music sub-mode.

### Light ring

9 segments (H1310) / 14 (H1370) addressed by the 0x15 segment mask; per-segment color
groups are produced by `ColorModeControllerConfig` and, for IoT, converted to `ptReal`
frame lists (`makeSetColorOpBytes` → `ColorModeControllerConfig.k()`).

---

## 8. Source map

- SKUs/registration: `pact/SubMaker.java`, `pact/SubLib.java`, `Support.java`
- UUIDs/comm: `ble/BleComm.java`, `ble/BleMultiComm.java`, `ble/Ble.java`
- fan/switch controllers: `ble/ControllerFan.java`, `ble/ControllerSubSwitch.java`
- remote: `ble/RemoteController.java`, `ble/ExitRemoteController.java`, `ble/BleProtocol.java`
- notifications: `ble/BleNotifyComm.java`; base `base2light/kt/general_parser/DefParser.java`
- sensor: `sensor/SensorBleParser.java`, `sensor/SensorBleReads.java`, `sensor/SensorBleProtocol.java`, `sensor/HeartbeatSensorParse.java`
- auto program: `h1370/FanAutoProgram.java`, `adjust/VM4Light.java`
- capability/color: `capability/H1310LightCapabilityProvider.java`, `capability/H1370LightCapabilityProvider.java`, `capability/FanlightLightCapabilitySpecKt.java`
- scenes/DIY/music: `pact/AbsEffectOp4BleIot.java`, `pact/OpSceneCommDialog4BleIot.java`, `h1310/diy/*`, `h1370/diy/*`
- IoT: `pact/IotSwitchCmdBuilder.java`, `pact/OpCommDialog4BleIotV1.java`, `adjust/VM4Light.java`, base `base2light/iot/*`
- UI/state: `adjust/VM4Light.java`, `h1310/DelegateHeaderH1310.java`, `h1370/DelegateHeaderH1370*.java`

---

## 9. Gaps / unknowns

1. **0x15 color payload per SKU** is inferred from the shared `COLOR_MODE_0X15`
   instruction version (the fanlight split has no `SubMode*` class of its own). Subtype 3/4
   byte counts are clamped by `ColorPieceConfig`; exact padding beyond 9/14 pieces is runtime.
2. **Scene effect catalogue** is cloud-driven; only category IDs and the 16-bit LE wire
   format are static.
3. **Music codes** are cloud/`OnlineMusicM` supplied; the split only fixes the 0x13 payload shape.
4. **Fan gear semantics** (H1370 has 12 UI gears) are not mapped to RPM; gear is passed
   verbatim (1..12).
5. No dedicated LAN/MQTT code; WiFi devices use IoT cloud `ptReal`.
