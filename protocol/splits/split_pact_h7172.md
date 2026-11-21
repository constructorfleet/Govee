# split_pact_h7172 — H7172 / H7178 / H717D ice maker & water dispenser

Source root: `decompiled/jadx-splits/split_pact_h7172/sources/com/govee/h7172/`

## Overview / family and SKUs

| SKU | goodsType | notes |
|---|---|---|
| H7172 | 117 (`Support.j`) | ice maker |
| H7178 | 211 (`Support.l`) | ice maker variant (`SettingExtH7178`) |
| H717D | 212 (`Support.k`) | ice maker/water dispenser (`H717DMaker`, `PairGuideActivity`, `H717DChartViewInfo`) |

- `Support.t`/`u`/`v` keys `{117, 211}`; `Support.c()` adds 212 via `H717D`.
- `Support.o` / `p` / `q` / `r` are mode-id groups: {1,2,3,7,8}, {4,5,6,9,10},
  {1,2,3,4,7,8,9}, {5,6}.
- `Support.m`/`n` are the mode-name maps (10 ice/water modes).
- `Support.w` = soft versions `4.01.00 .. 4.01.04` (feature gating).
- Transport: `ble + iot`. `pact/SubLib` keys from `Support.c.m()`, `pact/SubMaker` adds
  `H7172Maker` and `H717DMaker`. `AbsBleWifiSku` items.
- UI: `adjust/AdjustAc`, `adjust/header`, `adjust/component/ModeUI`, dialogs for wash/ice/delay.
- Settings ext: `pact/Ext{devicePushNotiOnOff, waterShortageOnOff=1, fullReminderOnOff=1,
  chartStorageTime=30}`. These are user preferences / push toggles, not status readings
  (see `STATUS-PROPERTIES.md`).
- Water leak push: `push/WaterLeakPush`.

## Transports & GATT UUIDs

- Service `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/BleComm.java`, `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`
- Heart: `ble/HeartControllerV1` (cmdType 0x01, read)
- Notify: `BleNotifyComm`, `ble/WifiNotifyParse`.

## BLE frame + command table

Frame `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`; write 0x33, read 0xAA.

`ble/controller/*` derive command types from base `com.govee.base_h71xx.sku_base.BleProtocolConstants`:

| controller | field/method | value |
|---|---|---|
| `SwitchController` | literal | 0x01 |
| `BaseSwitchController` | `D()` | 0x1F (31) |
| `DelayStartController` | `I()` | 0x23 (35) |
| `EquipmentStatusController` | `O()` | 0x19 (25) |
| `AbnormalInfoController` | `w()` | 0x17 (23) |
| `IceSizeController` | `d0()` | 0x05 |
| `IceFullSwitchController` | `D()` | 0x1F |

Derived commands:

| command | op | payload | response | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `[0]=0|1`, if on `[1]=1` (with ice) or `2` | `[0]!=0` | `ble/controller/SwitchController.java` |
| base switch (4 funcs) | `0x33/0x1F` | `[0]=switchId, [1]=state` where switchId 6/7/8/9 = `z()/X()/n1()/N0()`, state `N()`=1 on / `M()`=0 off | `[0]=switchId, [1]!=0` | `ble/controller/BaseSwitchController.java`, `BaseSwitchControllerKt.java` |
| delay start | `0x33/0x23` | `[0]=enable, [1..2]=delayMinutes LE16, [3..6]=startEpochSec LE32, [7]=Mode.value` | parse `DelayStartInfo` | `ble/controller/DelayStartController.java` |
| equipment status read | `0xAA/0x19` | none | `[0]`=WorkStatus value | `ble/controller/EquipmentStatusController.java` |
| abnormal info | `0xAA/0x17` | `{1}` read / write `{1}` | `[0]=clear72h, [1]=abnormalStatus` | `ble/controller/AbnormalInfoController.java`, `AbnormalInfoControllerKt.java` |
| ice size | `0x33/0x05` | `[0]=Mode.value` (BIG=1, MIDDLE=2, SMALL=3) | `[0]` mode | `ble/controller/IceSizeController.java` |
| ice full switch | `0x33/0x1F` | `[0]=switchId, [1]=state` | parse | `ble/controller/IceFullSwitchController.java` |

`DelayStartInfo` byte layout (`adjust/DelayStartInfo.Companion.b`): `[0]=enable`,
`[1..2]=delay minutes LE16`, `[3..6]=start epoch seconds LE32`, `[7]=mode`.

`BaseSwitchController.q()` payload is `{switchId, on?1:0}`; `p()` read payload
`{switchId}`; read reply `[0]=switchId, [1]!=0`.

## BLE notifications / readings

`ble/WifiNotifyParse`, `BleNotifyComm`; plus read controllers above.

`WorkStatus` (`adjust/WorkStatus.java`) values:
IDLE 0, ICE_MAKING 1, ICE_MAKE_FINISH 2, WASHING 3, WASH_FINISH 4, RESERVATION 5.

`Mode` (`adjust/Mode.java`): BIG_ICE 1, MIDDLE_ICE 2, SMALL_ICE 3; mode ids 1..10 are the
UI modes (`Support.m/n`), separate from ice size.

`DeviceSettingInfo` is populated from:
- `BaseSwitchControllerKt.parseCommSwitchInfo` → four boolean switches,
- `AbnormalInfoControllerKt.parseAbnormalInfo` → `clear72h` (bArr[0]==1) and
  `abnormalStatus` (bArr[1]),
- `DelayStartInfo` → delay config,
- `IceSizeController` → current mode.

## IoT commands + status/readings schema

`adjust/v1/IotOpV1.java`:
- read/status command name `n()` = `"status"`, cmd object `CmdStatus`.
- write command name `q()` = **`"ptReal"`** — all writes tunnel BLE frames.
- `r(cmd)` maps via `Cmd.a.a(cmd)` (base `base_h71xx.sku_base.iot.Cmd`).

`iot/CmdStatusParseV1.java`:
- `State` (`state` object) has `onOff:int` and `result:int`; `onOff==1` → on.
- `op` → `ResultPt.getPtBytes()` list of 20-byte frames; for each:
  - `[0]==O0()` and `[1]==d0()` → ice size mode `[2]`,
  - `[1]==O()` (0x19) → `WorkStatus` from `validBytes[0]`,
  - `[1]==w()` (0x17) → abnormal info,
  - `[1]==I()` (0x23) → delay-start info,
  - `[1]==D()` (0x1F) → base switch info,
  - `[0]==O0()` and `[1]==d0()` variant for mode.
- `parsePtReal4Read(json, ext)` parses `op` frames for read replies.

## Other protocols

- WiFi/cloud IoT: `ptReal` writes, `status` reads via base h71xx IoT framework.
- OTA: `OtaPactConfig` in `Support`.
- Push: `push/WaterLeakPush` (water leak notification).
- Chart history: `H717DChartViewInfo` (DB) + `chartStorageTime` ext (30 days default).
- No Matter/LAN code.

## Dynamic effects / motion / music / scenes / DIY

Not a lighting family. Dynamic behaviour is the appliance **mode/state machine**:

- Modes 1..10 (`Support.m/n`): ice making, wash, water dispensing, reservation, etc.;
  mode id sets `Support.o/p/q/r` select which modes support which settings.
- `adjust/notify_event/*` events: ModeSelected, ModeChange, ModeStarted, ParseMode,
  DelayStart, SwitchTemperature, BuzzerRemind, Clear72h, SettingInfoUpdate.
- Delay start: 0x23 with delay minutes + absolute start epoch + mode.
- Ice size: 0x05 with 1/2/3 (big/middle/small).
- Wash / finish dialogs drive the 0x1F switch ids 6..9 (wash, child lock, ice-full, etc.).
- Water shortage / full reminder / chart storage configured via `pact/Ext`.

## Source map

- `Support.java`, `pact/SubLib.java`, `SubMaker.java`, `H7172Maker.java`, `H7178Maker.java`,
  `H717DMaker.java`, `DeviceItem.java`, `Model.java`, `BleIotInfoV1.java`, `Ext.java`,
  `WorkStatus.java`
- `ble/Ble.java`, `BleComm.java`, `BleMultiComm.java`, `BleNotifyComm.java`, `WifiNotifyParse.java`,
  `HeartControllerV1.java`, `ble/controller/*.java`
- `iot/CmdStatusParseV1.java`
- `adjust/v1/{BleOpV1,IotOpV1,BlePactV1,IotPactV1,FrameV1,CommandOpV1,SettingAc}.java`,
  `adjust/{Mode,WorkStatus,DelayStartInfo,AdjustAc}.java`, `adjust/notify_event/*`
- `add/{PairAcV1,BleBroadcastProcessor,ConnectDialog,SettingExt,SettingExtH7178}.java`
- `push/WaterLeakPush.java`, `config/WorkStatusConfig.java`
- base: `com/govee/base_h71xx/sku_base/BleProtocolConstants.java`,
  `com/govee/base_h71xx/sku_base/iot/*`

## Gaps / unknowns

- Only 4 base-switch ids (6/7/8/9) are mapped; the actual function names come from UI strings
  and `SettingAc`, not the protocol.
- `Support.m`/`n` mode names are resource ids (not literals) — mode names are not statically
  resolvable to English text.
- `H717D` uses shared settings (`CommSharedSettingsAc`) and an extra device-state class
  `H717DDeviceState`; its goods-type 212 command set is assumed identical to 117/211.
- `CmdStatusParseV1` does not parse `state.result` semantics.
- Ice-full controller shares cmdType 0x1F with base switches; differentiated by switchId byte.
