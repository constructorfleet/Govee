# split_pact_h7120 — H7120…H7129 air purifiers

Sources: `decompiled/jadx-splits/split_pact_h7120/sources/com/govee/...`
plus the shared air-purifier library `decompiled/jadx-base-7.7.10/sources/com/govee/base_h71xx/...`.

All paths below are relative to `decompiled/`.

## 1. Overview / family and SKUs

This split is the **H71xx air-purifier / air-quality family**. It is not a lighting
family: there are no colour/scene/DIY effect commands. The product surface is
power, fan gear, auto/sleep modes, night light, child lock, delay-off, DND
(indicator off), timer groups, filter life, abnormal/sensor info and PM charts.

| SKU | goodsType | UI / notes | transports |
|---|---|---|---|
| H7120 | 118 | base purifier; `h7120/pact/Support.java` | ble, iot |
| H7121 | 72 | adds gear/child-lock/night-light/indicator/filter parsers | ble, iot |
| H7122 | 79 | adds custom mode, air-quality, timer V3 | ble, iot |
| H7123 | 110 | abnormal info + state info variant | ble, iot |
| H7126 | 160 | custom/auto mode, bind-temperature, matter settings | ble, iot, matter |
| H7127 | 254 | alias of H7126 (`h7126/pact/Support.java` keys `{160,254}`) | ble, iot, matter |
| H7129 | 224/225/223/226 | PM chart / segmented sensor model (`h7129/pact/Support.java`) | ble, iot, matter |

`pact/SubLib.keys()` returns the **goodsType numbers as strings**
(`Support.h()` / `Support.i()`), so cloud SKU identity is by goodsType.

Protocol support is declared with `GoodsType.beProtocol(pactType, pactCode)`:

- H7120: `(1,1)`, `(1,2)`, `(2,1)` — `h7120/pact/Support.java`
- H7121: `(1,1)`, `(1,2)` — `h7121/pact/Support.java`
- H7122/H7123/H7126/H7129: one `(1,1)` protocol (see each `pact/Support.java`)

`(1,1)` is the BLE+IoT pact; `(2,1)` is the newer cloud/BLE variant; the exact
transport chosen at runtime is in `base2light.pact.Protocol`.

## 2. Transports & GATT UUIDs

All variants use the standard Govee vendor GATT pair:

- service `00010203-0405-0607-0809-0a0b0c0d1910`
- characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`

`h7120/ble/BleComm.java` (and copied `BleMultiComm.java`). `isSelfComm()` also
recognises the alternate self-comm service `494e5445-4c4c-495f-524f-434b535f4857`,
and `isChartData()` recognises `494e5445-4c4c-495f-524f-434b535f2015` (chart data
channel).

BLE object: `h7120/ble/Ble.java` (singleton `Ble.s`, `CommEventGattCallback`).
Multi-packet writer `BleMultiComm` uses the same UUID pair.

## 3. BLE frame + command table

Frame: 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC`
(`com.govee.base2kt.utils.BleUtils.generate20Bytes`).

Write `proType = 0x33`; read/query `proType = 0xAA`; mode writes override
`getProType()` to `0x3A` (58) and read with `0xAA`
(`h7120/ble/controller/ModeController.java`). Timer/time commands are multi-byte
but still one 20-byte frame.

Opcodes below are resolved from `BleProtocolConstants` accessors in
`base_h71xx/sku_base/BleProtocolConstants.java` (the decompiled accessor names are
stable; values shown are the literal field values).

| Command | op (write/read) | payload | layout / notes | source |
|---|---|---|---|---|
| power | `0x33/0x01`, read `0xAA/0x01` | `01`=on `00`=off | read → valid[0] state | base `SwitchController`; `h7120/adjust/v1/CommandOpV1.java` |
| brightness | `0x33/0x04`, read `0xAA/0x04` | `val` 0–100 | read → valid[0] | base `BrightnessController` |
| mode | write `0x3A/0x05`, read `0xAA/0x05` | `[id, value]` | id: GEAR `0x08`, SLEEP `0x05`, AUTO `0x03`; GEAR carries gear in [1]; AUTO carries 0 | `h7120/adjust/Mode.java`, `ModeInfo.java`, `ble/controller/ModeController.java` |
| abnormal / sensor info | `0x33/0x17`, read `0xAA/0x17` | `01` | read: [0] code, [1] sub-code (`AbnormalInfo`) | `h7120/adjust/AbnormalInfo.java`, `ble/controller/AbnormalInfoController.java` |
| air quality / state info | `0x33/0x19`, read `0xAA/0x19` | `pmLo pmHi level x` | read: [0..1] signed16 value LE, [2] level, [3] extra | base `AirQualityInfo`, `ble/controller/StateInfoController.java` |
| delay-off | `0x33/0x11`, read `0xAA/0x11` | `on minLo minHi` | read: [0] isOpen, [1..2] minutes LE16, [3..5] leave seconds LE24 | base `DelayOffController` / `DelayOffInfo` |
| DND / indicator off | `0x33/0x16`, read `0xAA/0x16` | `enable startH startM endH endM forever` | enable `0x01`; forever=1 → 0/0/23/59 | base `NotDisturbController`, `NotDisturbInfo` |
| timer group write | `0x33/0x13`, read `0xAA/0x13` | `group enableSwitch hour min repeat mode modeValue comfortable` (V2) | V1 has 5 bytes | base `TimerGroupControllerV2`; `h7122/.../TimerGroupControllerV3.java` adds area LE16 |
| timer group delete | `0x33/0x15` | `group` | — | base `TimerGroupDeleteController` |
| timer count read | `0xAA/0x12` | — | number of timers | base `TimerCountController` |
| sync time | `0x33/0xB5` | 7 bytes (timestamp LE32 + TZ offset) | — | base `SyncTimeController` |
| indicator light (H7121) | `0x33/0x1A` | `0x26`=on `0x11`=off | — | `h7121/ble/controller/IndicatorLightController.java` |
| child lock (H7121) | `0x33/0x09` | `0x02`=lock `0x08`=unlock | — | `h7121/ble/controller/ChildLockController.java` |
| gear (H7121) | `0x33/0x1C` | `gear` | — | `h7121/ble/controller/GearController.java` |
| night light (H7121) | `0x33/0x17` | `onFlag(0x10/0x1C) brightness` | 0x17 collides with abnormal on other SKUs | `h7121/ble/controller/NightLightController.java` |
| child lock (H7122) | `0x33/0x10` | `01/00` | — | `h7122/ble/controller/ChildLockController.java` |
| air quality (H7122) | `0xAA/0x1C` | `val` | read-only polling | `h7122/ble/controller/AirQualityController.java` |
| filter state (H7122) | `0xAA/0x19` | `01` | read-only | `h7122/ble/controller/FilterStateController.java` |
| mode custom (H7126) | `0x3A/0x05` | `02 (curIdx<<4|setGear) {gearIdx setMinLE16 leaveMinLE16}*` | variable length; disabled gear = `0x00` | `h7126/.../bean/ModeCustom.java` |
| mode gear (H7126) | `0x3A/0x05` | `08 gear` | — | `h7126/ble/controller/ModeGearController.java` |
| mode auto (H7126) | `0x3A/0x05` | `03 eco efficient useArea` | — | `h7126/.../bean/ModeAuto.java` |
| report chart | `0x33/0x30` | `01` | asks device to push PM chart data | base `ReportChartController`; `h7120/.../CommandOpV1.java` |
| filter reset | `0x33/0x17` | `01` | sent by “send rest filter” event | `h7120/adjust/v1/CommandOpV1.java` |

GEAR/SLEEP/AUTO constants resolved in `base_h71xx/sku_base/BleProtocolConstants.java`
(`o0()=8`, `B0()=5`, `f0()=3`).

Multi-byte fields are little-endian (`BleUtil.getSignedBytesFor2(..., true)`).

## 4. BLE notifications / readings

Notifications are matched on packet byte 0 (proType) and parsed from bytes 1..17
(`base2light/ble/comm/AbsNotifyParse.java`).

| proType | parser | reading |
|---|---|---|
| `0x11` | `h7120/ble/WifiNotifyParse.java` | Wi-Fi connected = `value[0]==0` |
| `0x01` | `HeartControllerV1` (`h7120/ble/HeartControllerV1.java`) | heartbeat; carries device state byte and error byte |
| `0x05` | `ModeNotifyParse` (H7126) | mode: [0] mode id, [1] gear/extra |
| `0x19` | `StateInfoNotifyParse` (H7126) / `StateInfoController` | air quality: `[0..1]` value LE16, `[2]` level, `[3]` extra |
| `0x17` | `AbnormalNotifyParse` (H7126) | abnormal: `[0]` code, `[1]` sub-code |
| `0x11` | `DelayOffNotifyParse` (H7126) | delay-off: `[0]` on, `[1..2]` min LE16, `[3..5]` left sec LE24 |
| `0x16` | `NotDisturbNotifyParse` (H7126) | DND window |
| `0x18`? | `ReadStateNotifyParse` (H7126) | composite read-state |
| `0x40` | base `DeviceStatusNotifyParse` | first 10 bytes of status frame |

(Because the accessor values overlap between SKUs, the opcode is always interpreted
per SKU by the controller that issued the read.)

## 5. IoT commands + status / readings schema

Transport: `IotMsgProType` **V1** (`h7120/adjust/v1/IotOpV1.java` extends
`AbsIotOpV1`; `CmdStatusParseV1` uses `AbsIotManagerV1.getJsonObjectStr`). Incoming
JSON is parsed for top-level keys `state` and `op`.

Write envelope (`base2home/iot/Write`, `AbsCmdWrite`):

```json
{"msg":{"transaction":"<gen>","accountTopic":"<topic>","type":1,"origin":32,
        "cmdVersion":1,"cmd":"<cmd>","data":{...}}}
```

Read envelope: same with `"type":0`.

| cmd | data | meaning | source |
|---|---|---|---|
| `turn` | `{"val":0|1}` | power | `h7121/iot/CmdTurn.java`, base `CmdTurn` |
| `status` | `{}` | full status read; response keys `state` + `op` | `base_h71xx/sku_base/iot/CmdStatus.java` |
| `ptReal` | `{"command":["<base64 20-byte frame>",…]}` | tunnel a BLE frame (all BLE commands above) | `h7120/adjust/v1/IotOpV1.java` (`q()`=`"ptReal"`) |
| `online` | — | online/offline event key | `h7120/adjust/v1/IotPactV1.java` |
| `multiSync` | — | multi-device sync (air-quality sensors) | base `Cmd` |

Read parse key: `ptReal` → `"op"`, everything else → `"state"`
(`-h71xx/sku_base/iot/Cmd.a(String)`).

Status schema (`h7120/iot/CmdStatusParseV1$State`):

```json
{"onOff": 0|1, "result": <int>}
```

`state.onOff` drives the on/off UI. `op.pt[]` is a list of base64 20-byte BLE
frames; the parser re-enters the BLE table above, special-casing timer op `0x13`
(`CmdStatusParseV1.Companion.a/d/e`). That is how cloud reads expose mode, DND,
air quality, delay-off, timers and abnormal info.

Air-quality object (`base_h71xx/.../AirQualityInfo`) field mapping:
`[0..1]` value (signed LE16), `[2]` level/grade, `[3]` auxiliary. Exact physical
unit (PM2.5 µg/m³ vs PM index) is not named in the decompiled class — gap.

Filter metadata is **HTTP**, not BLE:
`DeviceFilterRequest{ "", sku, device, filterExpireOnOff }` →
`IKtDeviceNet.updateDeviceFilter` (`h7120/adjust/v1/SettingAc$toSaveFilterSwitch$1.java`).

## 6. Other protocols

- **Matter**: H7126/H7127 and H7129 expose Matter settings — `h7126/adjust/AdjustAc$readMatterInfo$2.java`,
  `h7129/vm/SettingViewModel$getMatterInfo$1.java`, `H7129ApplicationImp`. Pairing is
  handled by base `MatterInterceptor`; no custom cluster map in the split.
- **Cloud chart**: H7129 uploads PM history with `H7129ChartViewModel`, `ChartController4PmMode`,
  `H7129ChartRepository` and segmented file parse; separate from the live BLE stream.
- **Wi-Fi provisioning**: `h7120/add/WifiChooseAc.java` (same file in h7121/h7122/h7123/h7126/h7129), `AirBindConfig*`.
- **BLE broadcast** pairing: `add/BleBroadcastProcessor.java` (advertisement-based discovery only).

## 7. Dynamic effects / motion / music / scenes / DIY

None. This family has no colour, scene, DIY, music or gradient effect protocol.
The mode container (`0x3A/0x05`) only carries gear/sleep/auto/custom fan profiles.
`h7120/ble/controller/ModeController.java` uses `ModeInfo` (mode + value), not the
lighting `AbsMode` sub-mode dispatch used by other splits.

## 8. Source map (traced)

- SKU/pact: `h7120/pact/{Support,SubLib,SubMaker,H7120Maker,DeviceItem,Model}.java`,
  same under `h7121`, `h7122`, `h7123`, `h7126`, `h7129`.
- BLE transport: `h7120/ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,WifiNotifyParse,HeartControllerV1}.java`.
- BLE commands: `h7120/ble/controller/*`, `h7121/ble/controller/*`, `h7122/ble/controller/*`,
  `h7123/ble/controller/*`, `h7126/ble/controller/*`; shared base
  `base_h71xx/sku_base/ble/controller/*` and `BleProtocolConstants.java`.
- UI/pact glue: `h7120|h7121|h7122|h7123|h7126/adjust/v1/{CommandOpV1,BleOpV1,IotOpV1,BlePactV1,IotPactV1,FrameV1}.java` (h7129 uses activity/vm instead).
- IoT: `h7120/iot/CmdStatusParseV1.java` (same class copied per family), `h7121/iot/{CmdStatus,CmdTurn}.java`,
  `base_h71xx/sku_base/iot/{Cmd,CmdStatus}.java`.
- Readings: `base_h71xx/sku_base/adjust/component/bean/{AirQualityInfo,DelayOffInfo,NotDisturbInfo,TimerInfoV2}.java`,
  `h7120/adjust/{Mode,ModeInfo,AbnormalInfo}.java`, `h7126/.../bean/{ModeAuto,ModeCustom}.java`.
- Notifications: `h7126/ble/*NotifyParse.java`.

## 9. Gaps / unknowns

- `AirQualityInfo` field [3] and the unit/scale of [0..1] are not named.
- The exact semantic of `pactType/pactCode` pairs `(1,2)` and `(2,1)` (BLE-only vs
  cloud transport preference) is decided in base `base2light.pact.Protocol`, not here.
- `IndicatorLightController`/`NightLightController` opcodes are resolved from
  obfuscated constants (`0x1A`/`0x17`); confirm against captured traffic.
- H7129 goodsTypes 223–226 map to the four regional/segment SKUs; the SKU strings are
  only present in theme resources (`ThemeM.i.b("H7129", ...)`).
- No colour/effect commands, so effect-ID tables are intentionally absent.
