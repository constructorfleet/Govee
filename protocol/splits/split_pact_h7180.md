# split_pact_h7180 — H7180 smart rice cooker / multi-mode cooker

Source root: `decompiled/jadx-splits/split_pact_h7180/sources/com/govee/h7180/`

## Overview / family and SKUs

Single SKU **H7180** (goodsType **152**, `Support.o`). `Support.q` = `{152}`, `Support.r/s` =
`{"152"}`. Maker: `pact/H7180Maker extends AbsBleWifiSku`; `pact/SubMaker` has only
`H7180Maker`. Pact registration: `GoodsType.beProtocol(1,1)` and `(2,1)` for 152.

Modes (`Support.e`..`Support.j`, `adjust/Mode.java`): RICE(1), SATUTE/sauté(2), STEAM(3),
SLOWCOOK(4), DIY(5), plus NONE(0). Separate features: KEEP TEMP, WEIGH, RECIPE MAKING,
COLLECT WATER REMIND, DO-NOT-DISTURB.

- `pact/Model extends AbsModel4Cooker`; `Model.V()` = `"online"`;
  `Model.Y()` = run mode, `Model.A0()` = weigh, both via `HumidifierStatusConfig`.
- `pact/Ext{completionNotiOnOff, mcuHardVersion}`.
- Settings UI: `adjust/v1/H7180BaseWifiBleSettingAcV3`, `SettingAc`, `SharedSettingVM`.
- Transport: `ble + iot`.

## Transports & GATT UUIDs

- Service `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/BleComm.java`, `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`
- Notify parsers: `ble/WifiNotifyParse`, `ble/WeighNotifyParse`, `ble/RecipeMakingNotifyParse`,
  `ble/DevCommReportParse`.

## BLE frame + command table

Frame `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`.
Most controllers extend `AbsSingleController` (write 0x33 / read 0xAA). **Exception:**
`ModeController` overrides `getProType()` to `BleProtocolConstants.a.v1()` = **0x3A (58)** for
writes and `O0()` = **0xAA (-86)** for reads; cmdType = `d0()` = **0x05**.

| command | op | payload | response | source |
|---|---|---|---|---|
| mode/submit | `0x3A/0x05` write, `0xAA/0x05` read | `[0]=modeByte`; for DIY also `[1]=diyIndex` | `[0]=modeByte, rest bean` | `ble/controller/ModeController.java` |
| keep temp | `0x33|0xAA/0x22` | `[0]=type(1 inner/2 outside), [1]=start, [2..3]=temp*100 LE16, [4..5]=keepWarmSumTime LE16` (type 1 adds mode byte at [1]) | `KeepTempBean` | `ble/controller/KeepTempController.java`, `adjust/component/widget/KeepTempBean.java` |
| weigh | `0x33|0xAA/0x23` | `[0]=start, [1]=unit` | `[0]=start, [1..2]=weight LE16 (bit15 = negative), [3]=unit` | `ble/controller/WeighController.java`, `model/WeighBean.java` |
| recipe making | `0x33|0xAA/0x24` | `[0]=start, [1]=type` (start=1 only start byte) | `[0]=start,[1]=flagFinish,[2]=deviceState,[3..4]=menuCode LE16,[5]=index,[6]=mode,[7]=gear,[8..9]=workMinute,[10..11]=leaveMinute` | `ble/controller/RecipeMakingController.java` |
| recipe multi | `0xA3/0x24` | `MenuListMenuResponse.Data` bytes (multi V1) | event | `ble/controller/RecipeMakingModeMultipleControl.java` |
| collect water remind | `0xAA/0x25` | none | `[0]==1` → remind event | `ble/controller/CollectWaterController.java` |
| not disturb | `0x33|0xAA/0x16` | `[0]=enable(1)/disable(0), [1]=startHour, [2]=startMin, [3]=endHour, [4]=endMin, [5]=0 scheduled / 1 forever` | `H7180NotDisturbInfo` | `ble/controller/H7180NotDisturbController.java` |
| abnormal info | `0xAA/0x17` | `{1}` | `[0]=clear72h,[1]=abnormalStatus` | `ble/controller/AbnormalInfoController.java` |
| DIY multi | `0xA3/0x05` | `CookingDiyModelBean` bytes (`DiyModeMultipleControl`) | event | `ble/controller/DiyModeMultipleControl.java` |
| equipment status | `0xAA/0x19` | none | `[0]=Mode, [1]=DeviceState` | base `BleOpV1` array |
| delay off | `0x33/0x?` | base `DelayOffController(0,0,3)` | — | base `base_h71xx` |

Mode payloads (`ble/controller/model/*`):

```
RICE (mode 1):
[0]=1 [1]=flavor [2..3]=reservationMinutes LE16 (0 if off) [4]=keepWarm
[5..6]=keepTemp*100 LE16 [7..8]=keepWarmSumTime LE16 [9]=start
read: [0]=flavor [1..2]=reservation LE16 [3]=keepWarm [4..5]=temp*100 [6..7]=keepWarmSumTime
      [8]=start [9..10]=leaveTime [11..12]=keepWarmMinute [13]=sumTime [14]=deviceState
SATUTE (mode 2):
[0]=2 [1]=gear [2]=start
read: [0]=gear [1]=start [2..3]=runTime [4]=deviceState
STEAM (mode 3):
[0]=3 [1..2]=workTime LE16 [3..4]=reservation LE16 [5]=keepWarm
[6..7]=keepTemp*100 [8..9]=keepWarmSumTime [10]=start
read: +[10..11]=leaveTime [12..13]=keepWarmMinute [14]=deviceState
SLOWCOOK (mode 4):
[0]=4 [1]=gear [2..3]=workTime [4..5]=reservation [6]=keepWarm
[7..8]=keepTemp*100 [9..10]=keepWarmSumTime [11]=slowCookType [12]=start
read: +[11..12]=leaveTime [13..14]=keepWarmMinute [15]=deviceState
DIY (mode 5):
[0]=5 [1]=diyIndex; multi frames carry CookingDiyModelBean:
  start, stepState, reservation LE16, {programCode, workMinute LE16, leaveMinute LE16} up to 3
  programs, deviceState
```

`DeviceState` / `WorkStatus` / `WeigtUnit` enums live in `ble/controller/model/`.

## BLE notifications / readings

`iot/CmdStatusParseV1.Companion.b(byte[])` maps 20-byte BLE frames by `bArr[1]`:

| cmdType | parse |
|---|---|
| 0x05 (d0) | `ParseModeEvent` ← mode payload (`[0]==0x3A && [2]==1` = ack/ignore) |
| 0x16 (J0) | `H7180NotDisturbInfo` → ParseNotDisturb/UpdateNotDisturb events |
| 0x17 (w) | work status / abnormal byte |
| 0x22 (34) | `KeepTempBean` (`[0]!=0x3A` guard) |
| 0x23 (35) | `WeighBean` (`[0]!=0x3A`) |
| 0x24 (36) | `RecipeMakingBean` (ignore echoes 0x3A/0x3B? guarded) |
| 0x25 (37) | `[0]==1` → `UpdateCollectWaterRemindEvent` |
| 0x19 (25) | mode + `DeviceState` update |

`WeighBean` weight decode: `(b1>>7)&1 == 1` → negative, using low-7 bits + second byte LE16.
Unit from `WeigtUnit` (CAN default unless `Support.a.l()`).

## IoT commands + status/readings schema

`adjust/v1/IotOpV1` (base `AbsIotOpV1`): status cmd `"status"` (`CmdStatus`), write cmd
**`"ptReal"`**. `Cmd.a.a(cmd)` maps command name.

`iot/CmdStatusParseV1.Companion.c(json, ...)`:
- `state` JSON key = `HumidifierStatusConfig.RUN_STATE`; `State.getOnOff()==1` → on.
- `op` = `ResultPt.getPtBytes()` — every 20-byte frame is dispatched to the table above.
- `parseAtmosphereJson(str)` and `parseModeJson(str)` parse `op` alone for atmosphere/mode.

## Other protocols

- WiFi/cloud IoT (status + ptReal).
- OTA/report: base `ReportOtaPactController` in `BleOpV1`.
- Recipe menu service: `net/*`, `MenuListMenuResponse` (recipe making multi payload).
- `HumidifierStatusConfig` is reused to store run mode / weigh per SKU+device.
- No Matter/LAN in this split.

## Dynamic effects / motion / music / scenes / DIY

Appliance cooking programs, not lighting:

- **DIY cooking program** (`CookingDiyModelBean`, `DiyProgram`, `DiyStateView`,
  `DiyStateCookingAdapter`): up to 3 programs, each `{programCode, workMinute, leaveMinute}`,
  plus reservation + device state. Serialised by `DiyModeMultipleControl` (cmdType 0x05,
  multi V1 0xA3).
- **Recipe making** (`RecipeMakingBean`, `MenuListMenuResponse`, `RecipeMakingViewModel`,
  `RecipeMakingStepAc`): menu code + gear + work/leave minutes; multi frame
  `RecipeMakingModeMultipleControl` (0xA3/0x24).
- **Keep temp** (`KeepTempBean`, `KeepTempView`, `KeepTempFgDialog`,
  `KeepTempDetailFragment`): inner/outside type, target temp ×100, keep-warm duration.
- **Weigh** (`WeighBean`, `WeighFgDialog`, `WeighDetailFragment`): scale reading + unit.
- **Modes**: rice/sauté/steam/slow-cook/diy state views under
  `adjust/component/state/*`; reservations in `ReservationBean`/`ReservationView`.
- **Do not disturb**: `DisturbModeAc`, `H7180NotDisturbInfo`.
- **Collect water remind**: `CollectWaterController`, `UpdateCollectWaterRemindEvent`.

## Source map

- `Support.java`, `pact/SubLib.java`, `SubMaker.java`, `H7180Maker.java`, `DeviceItem.java`,
  `Model.java`, `Ext.java`, `AbnormalInfoUtil.java`, `BleIotInfoV1.java`
- `ble/Ble.java`, `BleComm.java`, `BleMultiComm.java`, `BleNotifyComm.java`, `WifiNotifyParse.java`,
  `WeighNotifyParse.java`, `RecipeMakingNotifyParse.java`, `DevCommReportParse.java`,
  `ble/controller/*`, `ble/controller/model/*`
- `iot/CmdStatusParseV1.java`
- `adjust/v1/*` (BleOpV1, IotOpV1, BlePactV1, IotPactV1, FrameV1, SettingAc, ExtV1),
  `adjust/Mode.java`, `adjust/ModeInfo.java`, `adjust/component/*`, `adjust/viewmodel/*`,
  `adjust/notify_event/*`, `adjust/thermometer/HumidifierStatusConfig.java`
- base: `com/govee/base_h71xx/sku_base/BleProtocolConstants.java`,
  `com/govee/base_h71xx/sku_base/adjust/AbsModel4Cooker`,
  `com/govee/base_h71xx/sku_base/iot/*`

## Gaps / unknowns

- Not-disturb "forever" byte is asymmetric: writer emits `[5]=0` for scheduled and `1` for
  forever, while parser treats `[5]==0` as forever — likely a bug or inverted semantic.
- `DeviceState` / `WorkStatus` / `WeigtUnit` enum numeric values are not all literal in this
  split (some come from base `BleProtocolConstants`).
- Recipe menu `MenuListMenuResponse.Data` byte layout is in `net/` and not fully decoded.
- `ModeController` read proType 0xAA but write proType 0x3A is unusual; other controllers use
  standard 0x33.
- `Support.c()` = 1 (chart/version flag) is not documented.
