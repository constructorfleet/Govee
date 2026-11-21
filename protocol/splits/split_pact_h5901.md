# split_pact_h5901 — H5901 water timer / irrigation gateway

Source root: `decompiled/jadx-splits/split_pact_h5901/sources/com/govee/h5901/`

## Overview / family and SKUs

Single SKU **H5901** ("Water Timer"), goodsType **363** (`Support.b`, `Support.d`).
It is a **BLE gateway** for sub-device water timers plus an IoT/MQTT path
(`ble + iot`). `pact/H5901Maker extends AbsBleSku`, `pact/H5901SubLib` keys from
`Support.c()` = `[363]`, `pact/Register4Item` registers `H5901SubLib`.

- `pact/H5901Maker` pairs via `H5901PairGuideActivity`, BLE name filter `"5901"`.
- `pact/AbsH5901Item` → `Item32` UI, `pact/GwSubH5901ItemImpl`, `pact/H5901Holder`.
- `pact/H5901DeviceItem`, `pact/H5901Model`, `pact/H5901BleItem`.
- Sub-device model: `bean/Device.java`, `bean/H5901DeviceInfo.java`,
  `bean/PairReadDeviceInfo.java`, `bean/GatewayInfo` (base2newth).
- Plans: `bean/IrrigationPlanInfo.java`, `IrrigationPlanModel.java`, `StageRule.java`,
  `TaskTimeRange.java`, `SyncPlanReq.java`, `PlanListRsp.java`, `PlanIdListRsp.java`,
  `ChartTaskReq/Resp`, `H5901LastData.java`, `H5901Settings.java`, `Settings.java`.
- Support protocols: `GoodsType.beProtocol(1,1)` and `(1,2)` for 363.

## Transports & GATT UUIDs

Gateway (H5901) uses **Telink-style custom UUIDs** (`ble/H5901BleComm.java`):

- Service: `494e5445-4c4c-495f-524f-434b535f4857`
- Characteristic (write/notify): `494e5445-4c4c-495f-524f-434b535f2011`
- Additional characteristics: `...2012`, `...2013` (`W`, `X`)
- `H5901BleComm.getCharacteristicUuid()` = `V` (…2011), `getServiceUuid()` = `Q` (…4857).
- Multi-packet comm: `MultiControllerComm(address, handler, service, char)`.
- `H5901GattCallbackImp` wraps `CommEventGattCallback` and diverts to `OtaManager4TeLinkV2`
  while OTA is active.

Legacy sub-device/direct path (`ble/H5044GWBleComm.java`):

- Service `00010203-0405-0607-0809-0A0B0C0D1910`
- Characteristic `00010203-0405-0607-0809-0A0B0C0D2B11`
- Alternate `00010203-0405-0607-0809-0A0B0C0D2B10`

Also present: `ble/H5901Ble.java`, `ble/H5901BleDataComm.java`, `ble/H5901GWBleManager.java`,
`ble/H5901PairBle.java`/`H5901PairBleCommon.java`, `ble/H5044GWBle.java`.

## BLE frame + command table

Frame `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`; write 0x33, read 0xAA.
`constant/H5901BleProtocol.java` (byte constants):

| const | dec | hex | use |
|---|---|---|---|
| b | 16 | 0x10 | sync time + timezone |
| c | 14 | 0x0E | soft version read |
| d | 13 | 0x0D | hard version read |
| e | 15 | 0x0F | MAC address read |
| f | 12 | 0x0C | device id read |
| g | 8 | 0x08 | (reserved/gateway info) |
| h | 1 | 0x01 | valve toggle / water status read |
| i | 2 | 0x02 | amount water read |
| j | 3 | 0x03 | water flow read |
| k | 19 | 0x13 | (reserved) |
| m | 21 | 0x15 | set smart plan enable |
| n | 22 | 0x16 | sync city / delete plan |
| o | 20 | 0x14 | pause plan |
| q | 4 | 0x04 | gateway status read |
| r | 32 | 0x20 | reset device |
| s | 6 | 0x06 | (reserved) |
| t | 9 | 0x09 | (reserved) |
| u | 23 | 0x17 | (reserved) |
| v | 24 | 0x18 | (reserved) |
| w | 53 | 0x35 | net check |
| x | 25 | 0x19 | sync link |
| y | 4 | 0x04 | (alias read) |
| z | 85 | 0x55 | (reserved) |

Derived commands (`ble/controller/*`):

| command | op | payload | response | source |
|---|---|---|---|---|
| valve on | `0x33/0x01` | `[0]=1, [1]=durationLo, [2]=durationHi` (minutes = i hours + i2 minutes, LE16) | read `0xAA/0x01` status | `Controller4ToggleValve.java` |
| valve off | `0x33/0x01` | `{0,0,0}` | — | `Controller4ToggleValve.java` |
| read water status | `0xAA/0x01` | none | `H5901DeviceInfo` parse | `Controller4ReadWaterStatus.java` |
| read amount water | `0xAA/0x02` | none | protobuf/status | `Controller4ReadAmountWater.java` |
| read water flow | `0xAA/0x03` | none | flow | `Controller4ReadWaterFlow.java` |
| read battery | `0xAA/0x08` | none | battery % | `Controller4ReadBattery.java` |
| sync time | `0x33/0x10` | `[0..3]=epochSec LE32, [4]=1, [5]=tzIndex, [6]=tzOffset` | — | `Controller4SyncTime.java` |
| read soft version | `0xAA/0x0E` | none | version x.y.z | `Controller4SoftVersion.java` |
| read hard version | `0xAA/0x0D` | none | version x.y.z | `Controller4HardVersion.java` |
| read MAC | `0xAA/0x0F` | none | MAC string | `Controller4MacAddress.java` |
| read device id | `0xAA/0x0C` | none | id | `Controller4ReadDeviceId.java` |
| gateway status | `0xAA/0x04` with `[0]=sno` | `{sno}` | `H5901Utils.I()` sub-device status | `GwReadStatusController.java` |
| next water info | `0xAA/0x04` | none | LastDataDTO (protobuf 0x37) | `NextWaterInfoController.java` |
| read GW sub-device info | `0xAA/0x04` | `{sno}` | sub-device list | `ReadGWSubDeviceInfo.java` |
| reset device | `0x33/0x20` | — | — | `Controller4ResetDevice.java` |
| net check | `0x33|0xAA/0x35` | — | network state | `Controller4NetCheck.java` |
| sync link | `0x33/0x19` | — | — | `Controller4SyncLink.java` |
| smart plan enable | `0x33/0x15` | `[0]=0|1` | — | `ControllerSetSmartPlanEnable.java` |
| pause plan | `0x33/0x14` | — | — | `PausePlanController.java` |
| sync city location | `0x33/0x16` | city/location bytes | — | `ControllerSyncCityLocation.java` |
| delete plan | `0x33/0x16` | plan id bytes | — | `ControllersDeletePlan.java` |
| open sub device | `0x33/0x21` | sub-device bytes | — | `OpenSubDeviceBle.java` |
| delete sub device | `0x33/0x11` | sub-device bytes | — | `Controller4DeleteSub.java` |
| gateway heartbeat | `0xAA/0x01` | none | `H5901HeartController` | `H5901HeartController.java` |
| chart step 1 | `0x33/0x02` | none (write trigger) | chart data | `ReadChartStep1Controller.java` |
| chart step 2 | `0x33/0x01` | `[0..3]=start LE32, [4..7]=end LE32` | chart data | `ReadChartStep2Controller.java` |
| chart step 3 | `0x33/0x03` | none | chart data | `ReadChartStep3Controller.java` |
| sub-device forwarding | `0x33/0x70` | `[0]=sno, [1..16]=inner frame bytes 1..16` | inner reply | `TransGwComposeController.java` |

**Gateway envelope**: `TransGwComposeController`/`iot/Convert2GWController` take an inner
controller's 20-byte frame, copy bytes `1..16` into a 16-byte buffer, prepend a sub-device
serial number `sno`, and send cmdType `0x70` (112). The gateway then replays the inner
controller's reply. `H5901GWIotManager.s()` detects a pending 0x33/0x35 (net check).

## BLE notifications / readings

Gateway/sub-device status frame (`utils/H5901Utils.I`, `bArr[1]==5`, `bArr[2]==0` online):

```
[0]  sno
[1]  05 (type)
[2]  status (0 online, 2 sub-device disconnected/offline)
[3]  battery (%) 
[6]  signal
[7..10]  timestamp LE32 (seconds)
[11] flags: bit0 longBatteryLife, bit1 deviceSwitchRemind, bit2 flowExceptionAlarm,
           bit3 lowPowerRemind, bit4 smartWaterEnable
[12] errorState
[13..14] remaining watering time LE16 (0xFFFF = none)
[15] bit0 switchStatus, bits1..4 runModel, bit6 gwWarningEnable, bit7 planPauseEnable
[16] pauseDuration
```

`H5901DeviceInfo` fields: `gwTimestamp`, `semaphore(signal)`, `battery`, `longBatteryLife`,
`smartWaterEnable`, `switchStatus`, `gwSubDeviceOnline`, `errorState`, `runModel`,
`planPauseEnable`, `gwWarningEnable`, `pauseDuration`.

IoT `status` frame prefixes accepted by `H5901GWIotManager.w()`:
`0xAA/0x04`, `0xEE/0x32`, `0xEE/0x34` — payload after the 2-byte header is parsed by
`H5901Utils.I(...)`.

Plan/chart protobuf: `proto/H5901Proto.java` `LastDataDTO` field numbers:
1 `nextTime` (int64), 2 `nextDuration` (int32), 3 `percentage` (int32), 4 `duration` (int32),
5 `volume` (int64), 6 `lastTime` (int64). Logged as "0x37 LastDataDTO".

## IoT commands + status/readings schema

`iot/H5901GWIotManager.java` connects to the device topic, sends every BLE command as
**`ptReal`** over IoT, and listens for `IotMsgV2`:

| cmd | data | notes |
|---|---|---|
| `ptReal` | `{"command":["<base64 frame>"]}` | single frame (`Convert2GWController.t()`), or multi frames (`makeSendBytesV1`) |
| `multiSync` | multi-frame list | treated like ptReal for aggregated sends |
| `status` | `op` = base64 frames; `state` = on/off | `CmdStatusParseV1`-style parse |

- Send: `Iot.r.L(topic, ..., new CmdPtReal(frame))` for every command (line ~234),
  or `CmdPtReal(list)` for multi-packet.
- Receive: `onIotMsgEventV2` → `ResultPt.bytes()` → `w(list)`; each 20-byte frame is checked
  for prefix `0xAA 0x04`, `0xEE 0x32`, `0xEE 0x34`; sub-device status parsed; `0x37` →
  protobuf `LastDataDTO`.
- Settings ext `pact/Ext.java` (H5901): `devicePushNotiOnOff`, `waterShortageOnOff` (default 1),
  `fullReminderOnOff` (default 1), `chartStorageTime` (default 30 days). These are **user
  preferences / push toggles**, not status flags; `waterShortageOnOff` is not the
  water-shortage state (see `STATUS-PROPERTIES.md`).

## Other protocols

- WiFi/cloud MQTT via `H5901GWIotManager` (`Iot` manager, `topicEvent`, reconnect on
  `NetChangeEvent`).
- OTA: `OtaManager4TeLinkV2` (Telink OTA over the same GATT).
- HTTP: `network/IH5901Network.java`, `GwsCanBind.java`, `IH5901NetworkKt.java` (plan bind,
  plan sync, P-value weather data).
- Weather/plan logic: `bean/WeatherPValueData.java`, `utils/WateringPlan.java`,
  `H5901SmartIrrigationDisclaimerCache.java`.

## Dynamic effects / motion / music / scenes / DIY

Not applicable (no lighting effects). Dynamic behaviour is **irrigation plans**:
- Plan model: `IrrigationPlanInfo` (id/name/enable/stages), `StageRule` (duration, interval),
  `TaskTimeRange` (start/end), `IrrigationRule`, `Settings`/`SettingData`/`H5901Settings`.
- `SyncPlanReq`, `PlanListRsp`, `ModelPlanListRsp`, `PlanIdListRsp`, `PlanIdNameItem`.
- Plan sync over BLE: `ReadPlanController` (cmdType 0x01, matches `bArr[1]==0 && bArr[5]==cmd`),
  `ReadPlanCompose`, `PausePlanController`, `ControllersDeletePlan`,
  `ControllerSetSmartPlanEnable`, `ControllerSyncCityLocation`.
- Water chart: `ReadChartStep1/2/3Controller` + `ChartTaskReq/Resp`, `ChartUploadData`.
- Next irrigation: `NextWaterInfoController` + `H5901NextIrrigationCache` + `LastDataDTO`.
- Weather-driven smart irrigation uses `H5901DataManager`, `WaterStatusView`,
  `WeatherContainerView`.

## Source map

- `Support.java`, `pact/H5901SubLib.java`, `H5901Maker.java`, `AbsH5901Item.java`,
  `H5901BleItem.java`, `H5901DeviceItem.java`, `H5901Model.java`, `GwSubH5901ItemImpl.java`,
  `H5901Holder.java`, `SubMaker.java`, `Register4Item.java`
- `ble/H5901Ble.java`, `H5901BleComm.java`, `H5901BleDataComm.java`, `H5901GattCallbackImp.java`,
  `H5901GWBleManager.java`, `H5901PairBle*.java`, `H5044GWBle*.java`, `BleNotifyComm.java`
- `ble/controller/*.java` (all listed above), `constant/H5901BleProtocol.java`
- `proto/H5901Proto.java`, `utils/H5901Utils.java`, `H5901DataManager.java`
- `iot/H5901GWIotManager.java`, `Convert2GWController.java`, `GwCommandOutTimeRunnable.java`
- `bean/*` (plans, device info, chart), `network/*`, `widget/*`

## Gaps / unknowns

- Sub-device list format (multiple `[3..16]` entries) is parsed by `H5901Utils.I` beyond the
  snippet traced; per-entry offsets after byte 16 are not fully enumerated.
- `H5901BleProtocol` has reserved constants (0x06/0x09/0x13/0x17/0x18/0x55) with no controller.
- cmdType collisions (0x01 valve/status, 0x02 amount/chart-step1, 0x04 gateway status /
  next water / sub-device info) are disambiguated by proType and payload length at runtime.
- Plan protobuf schemas beyond `LastDataDTO` are generated Java without a `.proto` in the split.
- The IoT path always tunnels BLE frames (`ptReal`); there appears to be no native JSON
  control for valve/timer other than status.
