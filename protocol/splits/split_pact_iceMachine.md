# split_pact_iceMachine — ice makers / nugget ice (H8120, H8121, H8122, H8131, H8150)

Source root: `decompiled/jadx-splits/split_pact_iceMachine/sources/`
Base reference: `decompiled/jadx-base-7.7.10/sources/`

---

## 1. Overview / family and SKUs

The module is a single app module for five ice-machine goods types. There is **no
`ble/` package and no `CmdBuilder`**; commands are built inline in the shared view-models
as 20-byte Govee frames and sent through `GMessageSingleReadWrite` /
`GMessageSingleRead`, i.e. over GATT locally and `ptReal` over cloud.

| SKU | goodsType | package | ice form | special UI | transports |
|---|---|---|---|---|---|
| H8121 | 306 | `h8121` | bullet / "small-medium-max" | ice basket, clean, pre-cool | ble + iot (+ Matter pairing) |
| H8120 | 317 | `h8120` | bullet ice maker | light, clean/descaling | ble + iot (+ Matter pairing) |
| H8131 | 321 | `h8131` | thin/medium/thick/extra-thick | water tank, door, drainage, pre-cool | ble + iot (+ Matter pairing) |
| H8122 | 372 | `h8122` | small/medium/large | light, clean | ble + iot |
| H8150 | 397 | `h8150` | keep-ice / demold / melt / reservation | lid, reservation, keep-ice timers | ble + iot |

Registry: `IceApplicationImp.java` (`ModelMaker` + `support.j(goodsType)` deadlines),
`Support.java` (`Pact.d.a(306,…)` etc., `PairResource` for each goods type),
`h81*/pact/H81*Maker.java`. Protocols are `GoodsType.beProtocol(1,1)`, `(1,2)`,
`(2,1)`, `(2,2)` depending on SKU — all **ble + iot**. Goods 306/317/321 are also
declared in a `MatterInterceptor` (`checkGoodsType`), so Matter commissioning is
supported for those three.

---

## 2. Transports & GATT UUIDs

Runtime BLE uses `com.govee.base2light.feast.cmd.Ble` whose `AbsBleComm` is
`com.govee.matter.pact.BleComm`:

| item | value |
|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` |
| write proType | `0x3A` (58) — `GMessageSingleReadWrite.getSendBytes()` |
| read proType | `0xAA` — `GMessageSingleRead.getSendBytes()` |
| light/group cmdType | `0xB6` (signed `-74`) |
| extra cmdTypes | `0xC1` (signed `-63`), `0xF0` (signed `-16`) used by the VMs |
| packet | 20 bytes, `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` |

The VMs build raw payloads and let `GMessageSingleReadWrite` frame them
(`buildParser(O(), BleProtocolConstants.a.u1(), cmd, …)`; `u1()` = `0x3A`, the
"write-read" proType used by H71xx-class devices). Write result success is `frame[2]==0`;
read data is stripped by 2 bytes before the parser.

`H8150SharedViewModel` chooses `ptReal` vs `ptIot` at runtime:
`otaPactConfig.d(goodsType, pactType, pactCode) ? "ptIot" : "ptReal"`.

---

## 3. BLE command table

All commands below are written by `h81*/vm/H81*SharedViewModel.java`; hex is cmdType.

| function | cmdType | payload | applies to | source |
|---|---|---|---|---|
| run control | `0x01` | `00 00` cancel; `01 00` start ice; `01 01` start clean; `01 02` start melt; `01 03` start demold/drain; `00` cancel (H8121) | all | `H8121/H8122/H8131/H8150 SharedViewModel` |
| mode | `0x05` | H8121 `[01, mode]`; H8122 `[mode]`; H8131 `[mode, degree]` | H8121/H8122/H8131 | same |
| timer write | `0x13` (19) | H8120/H8121 `[group, enableSwitch, hour, min, repeat, mode, iceSize, lightSwitch, preCoolSwitch, sceneLE16]`; H8131 `h8131TimerInfo.getBytes()` | H8120/H8121/H8131 | `h8120/bean/H8120TimerInfo.java`, `h8121/bean/H8121TimerInfo.java`, `h8131/bean/H8131TimerInfo.java` |
| do-not-disturb | `0x16` (22) | `DoNotDisturbInfo.Companion.b(info)` → `[enable, startH, startM, endH, endM]` (forever flag included) | all | `h8150/bean/DoNotDisturbInfo.java` |
| abnormal / remind read | `0x17` (23) | none | all | `H81*Model.k0()` |
| run state read | `0x19` (25) | none | all | `H81*Model.k0()` |
| light | `0x1B` (27) | `[01,01,on/off]` light switch; `[01,02,gear]` brightness; `[05,0D,R,G,B]` color; `[05,13,scene]` scene | H8121/H8122/H8131/H8150 | `H8150/H8131/H8121 SharedViewModel` |
| settings | `0x1F` (31) | `[02,v]`, `[08,v]`, `[16,v]`, `[17,v]`, `[01,keepIceLong]` | H8121/H8122/H8150 | same |
| remind mask | `0x25` (37) | N little-endian bitmask bytes (see 3.1) | all | `H8150RemindBean`, `H8131RemindInfo`, `H8120RemindBean`, `H8121RemindBean`, `H8122RemindBean` |
| wash/clean reminder | `0x27` (39) | `[00]` off; `[02]` reset; `[on, hour]` set; `[02]` reset | H8121/H8122/H8131 | `H8121/H8122 SharedViewModel` |
| buzzer mask | `0x28` (40) | bitmask byte(s) + optional gear | H8120/H8121/H8122/H8131/H8150 | `H81*BuzzerSwitchBean` |
| buzzer gear | `0x29` (41) | `[gear]` | H8131/H8150 (read 41 on H8150) | same |
| chart switch | `0xC1` (-63) | `[30,01]`; `[01,b]` chart/log enable | all | `H81*ChartViewModel` |
| light group (H8150/H8131) | `0xB6` (-74) | `FD` close preview; `FB <flagBytes>`; `F4/FC <runState> …`; `F6 0A 0000`; `F6 04 <sceneLE16>`; `15 FE R G B`; `15 FC <runState> R G B`; `04 <sceneLE16>` | H8150/H8131 | `H8150SharedViewModel` |
| reservation (H8150) | `0x23` (35) | `[01, hour, min, dayOrdinal]` set; `[00]` cancel | H8150 | `H8150CommandTypeCons.c` |

### 3.1 Remind bit masks

Each family orders its own reminder bits and sends them as little-endian packed bytes
(`BleUtils.f(boolean[], false)` packs bit0 first). Order per family:

- H8120: `cleanTimeRemind, cleanRemind, notIceBasketRemind, descalingTimeRemind,
  descalingRemind, cleanLackWater, descalingLackWater, highTemp` then
  `lowTemp, iceLackWater, defrostLackWater, cleanAndDescalingRemind, iceAbnormal`.
- H8121: `cleanTimeRemind, cleanRemind, notIceBasketRemind, stopPreCoolForHighTempRemind,
  stopIceMakingForHighTempRemind, waterBoxErrorRemind, stopPreCoolForCleanRemind`.
- H8122: `cleanRemind, cleanCompleteRemind, highTemRemind, kazuRemind`.
- H8131: 8+8+2 bits: env/water/compressor temp high/low, NTC faults, cleanTimeRemind;
  then noExecute, filterLow, first/second clean complete, cleanUnfinished, drainageComplete,
  defrostComplete, cleanComplete; then drainageStop, iceBreak.
- H8150: `makeIceCompleted, keepIceRemainOneHour, keepIceRemainTenMinute, keepIceEnd,
  keepIceOvertime, demoldCompleted, meltIceCompleted, meltIceEnd`.

### 3.2 Modes / degrees

| enum | values | source |
|---|---|---|
| H8121Mode | 1=Small, 2=Medium, 3=Max | `h8121/bean/H8121Mode.java` |
| H8122Mode | 1=Small, 2=Medium, 3=Large | `h8122/bean/H8122Mode.java` |
| H8131Mode | 1=Thin, 2=Medium, 3=Thick, 4=ExtraThick | `h8131/bean/H8131Mode.java` |
| H8131Degree | 0=Slightly, 1=Moderately, 2=Strongly | `h8131/bean/H8131Degree.java` |
| H8150RunMode | 0=None, 1=MakeIce, 2=KeepIce, 3=Demold, 4=MeltIce, 5=Reservation | `h8150/bean/H8150RunMode.java` |

---

## 4. BLE notifications / readings

All notifications arrive as 20-byte frames; `H81*Model.k0()` reads `ResultPt` from the
IoT `op` object, but the same parsers are used locally. `[1]` selects the record:

| opcode | layout | fields |
|---|---|---|
| `0x17` (23) | `[2]=deviceStateCode`, `[3]=bitfield` | H8120: code 0..8 (NORMAL, ENV_TEMP_NTC, ICE_FULL, WATER_LACK, ENV_TEMP_HIGH, ENV_TEMP_LOW, ELECTRICAL_NTC, ICE_NTC, ICE_FULL_RECOVERY). H8131: `[2]` bitmask of device states; `[3]` = toClean. Reminder byte `[3]` also carries low-battery/water flags. |
| `0x19` (25) | `[2]=runState`, `[3]=subState`, `[4..]=countdowns` | H8120: run state 1=ice making, 2=cleaning, 3=descaling, 4=defrost. H8131: run state + sub-state (1 compressor protect, 2 water lack, 3 outer tank low, 4 door open, 5 ice full). H8150: `[2]=runState`, `[5]=flag byte` (bit7 lid open, bit4 water lack), `[2..4]` remaining seconds. |
| `0x16` (22) | `[2]=enable?`, `[3]=state` | DND: enable when `[2]==2`, active when `[3]==1`. |
| `0x25` (37) | `[2..]` bitmask | reminder bits as in 3.1. |
| `0x1B` (27) | light state | light on/off, brightness, color/scene (H8131/H8150 light engine). |
| `0x29` (41) | `[0]=gear` | buzzer gear (H8150). |

### 4.1 Ice-machine readings

| reading | unit / range | source |
|---|---|---|
| environment NTC | °C / °F, chart data (0.01 °C) | `h8131/bean/H8131RemindInfo`, chart VMs |
| electrical / compressor NTC | °C, 0.01 °C | H8120DeviceState.ELECTRICAL_NTC, H8131 compressorTempHigh |
| ice NTC | °C, 0.01 °C | H8120DeviceState.ICE_NTC |
| water temperature | °C / °F (`WaterTempInfo`) | `bean/WaterTempInfo.java` |
| ice count / weight | count, grams (today ice info) | `bean/TodayIceInfo.java` |
| battery / signal | int, dBm | `H81*SharedKey`, `LeakSubInfo` style |
| water tank / outer tank | enum/low flag | H8131 status |
| remaining time | seconds | H8150 run state, `H8150RunStateInfo` |

Exact byte offsets for the chart/temperature records are in `H81*ChartViewModel` and the
chart database (`H8120/8131/8150ChartTable`); the temperature stream uses the shared
chart GATT service (see `_REFERENCE.md` §8 and `split_pact_thnew.md`).

### 4.2 Status properties (not opcodes)

`waterLack`, `outerTankLow`, `iceFull`, `doorNotClosed`, `doNotDisturb`, `toClean`, etc.
are **status flags**, not commands. They are carried in the status frames above and/or in
the cloud device-list bean `H8131DeviceListStatus`; they do not get their own BLE opcode.

- **H8131** — `H8131DeviceListStatus.Companion.a(int[] bytes)` maps three bytes:
  - `bytes[0]` bits 1–4 = `runState`; bit 5 `e2`; bit 6 `iceMakingInterrupted`;
    bit 7 `compressorTempHigh`
  - `bytes[1]` bit 0 `envTempHigh`, 1 `envTempLow`, 2 `waterTempHigh`, 3 `pumpAbort`,
    4 `e1`, 5 `compressorStopProtection`, 6 `outerTankLow`, 7 `iceFull`
  - `bytes[2]` bit 0 `waterLack`, 1 `doorNotClosed`, 2 `doNotDisturb`, 3 `toClean`,
    4 `cleanCompleteReminder`, 5 `lastCleanIncomplete`, 6 `midTankSensorStuck`,
    7 `lowerTankWaterHigh`
- **H8150** — `H8150RunStateInfo.isWaterLack` / `isLidOpen` come from the run-state frame
  (`0x19`): `[5]` bit 4 = water lack, bit 7 = lid open.
- **H8120 / H8121** — `DeviceState.WATER_LACK` is a state code (3 and 6 respectively) in
  the `0x17` status frame, not a write command.

`waterShortageOnOff` is the *push-notification setting*, not the status flag. See
`STATUS-PROPERTIES.md` for the full table and the cloud/device-list carriers.

---

## 5. IoT commands + status schema

Envelope: `IotMsgProType.V2` (H8120/H8121/H8122/H8131/H8150 `k0(IotMsgV2, json)`).

| cmd | data | meaning | source |
|---|---|---|---|
| `online` | — | topic probe (`V()` returns `"online"`) | `H81*Model.V()` |
| `ptReal` | `{"command":["<base64 20-byte frame>"]}` | BLE frames tunneled over cloud | `IceApplicationImp` CmdBuilder uses `CmdMultiSync` + `ptReal` |
| `op` | `{"command":["<base64>"]}` | device→app frame batch | `H81*Model.k0()` via `AbsIotManagerV1.getJsonObjectStr(str,"op")` |
| `status` | — | scene/switch response marker | `IceApplicationImp` CmdBuilder parseMsg checks `"status"` |
| `turn` | `{"val":0|1}` | power switch (scene builder) | base `CmdTurn` |
| `multiSync` | `{"command":[...]}` | multi-device sync | `CmdMultiSync` in `IceApplicationImp` |

Status JSON for scene switch: `{ "status": … }`; all real state is in `op` frames.

REST/other: device detail, firmware versions, chart history and reservations use the
base2home cloud APIs; no separate LAN/MQTT code in this split.

---

## 6. Other protocols

- **Matter**: `MatterInterceptor` for goods 306/317/321 in `IceApplicationImp`; BLE
  comm object is `com.govee.matter.pact.BleComm` (standard Govee UUIDs). No cluster map
  is defined in this split; Matter pairing is delegated to the base app.
- **BLE broadcast**: `Support.parseBleBroadcastProtocol` uses
  `GoodsType.parseBleBroadcastPactInfo` for pairing; no ice telemetry in the advert.
- **ptIot**: when `OtaPactConfig.d(...)` is true, the same frames are sent under `ptIot`
  instead of `ptReal` (firmware-version dependent).
- **OTA**: base `ble/ota` + `OtaPactConfig`.

---

## 7. Dynamic effects / scenes / DIY (ice light)

Ice makers expose a light ring/panel driven by the shared Govee light engine, not by a
per-SKU scene table. Command families:

| function | opcode / payload | source |
|---|---|---|
| light switch | `0x1B 01 01 <0/1>` | `H8150SharedViewModel` |
| brightness | `0x1B 01 02 <gear>` | same |
| color | `0x1B 05 0D R G B` | same |
| scene | `0x1B 05 13 <sceneCode>` (H8150: `05 13 <sceneCode>`) | same |
| preview / set-state light (H8150/H8131) | `0xB6` group: `F4/FC <runState> <mode> <sceneLE16>` or `15 FE/FC <runState> R G B` | `H8150SharedViewModel`, `H8131SharedViewModel` |
| close preview | `0xB6 FD` | same |
| scene preset | `0xB6 04 <sceneLE16>` | same |

Scene codes come from the base light-scene catalog (`CategoryV1.SceneV1`,
`getSceneCode(0, sku)`), so IDs are catalog-dependent, not constant in this split.

---

## 8. Source map

| area | paths |
|---|---|
| registry / SKUs | `com/govee/ice/IceApplicationImp.java`, `Support.java`, `SubMaker.java`, `h81*/pact/H81*Maker.java` |
| commands | `h8120/vm/H8120SharedViewModel.java`, `h8121/vm/…`, `h8122/vm/…`, `h8131/vm/…`, `h8150/vm/H8150SharedViewModel.java` |
| command constants | `h8120/bean/H8120CommandTypeCons.java`, `h8121/…`, `h8122/…`, `h8131/…`, `h8150/bean/H8150CommandTypeCons.java` |
| state models | `h81*/bean/H81*DeviceState.java`, `H81*RunState.java`, `H8150RunStateInfo.java`, `H8131DeviceListStatus.java` |
| IoT parse | `h8120/H8120Model.java` (`k0`), `h8121/H8121Model.java`, `h8122/H8122Model.java`, `h8131/H8131Model.java`, `h8150/H8150Model.java` |
| pairing BLE | `IceApplicationImp` (`MatterInterceptor`), `h5026`-style `add` not present for ice |
| chart | `h81*/vm/H81*ChartViewModel.java`, `com/govee/ice/common/chart/*`, base `R.mipmap`/DB tables |

---

## 9. Gaps / unknowns

- No `BleComm`/`INotify` class exists in the ice split: notifications are parsed from
  `op` frames inside the models, so the local notify characteristic and the exact
  `AbsBle` subclass are only known through the base `com.govee.matter.pact.BleComm`
  (standard UUIDs).
- Chart/temperature record layout (`0x2d00/0x2d20`) is not implemented in this split;
  the VMs delegate to base chart repositories. Byte offsets for NTC values therefore
  come from the base `AbsChartDataComm`/`BaseThDataComm`, not from ice sources.
- The `H8150SharedKey`/`H8121SharedKey` bit layouts (reminder/status packing) are
  obfuscated; only the bean field names and the opcode are certain.
- `ptIot` vs `ptReal` selection depends on `OtaPactConfig.d(...)` and runtime firmware,
  so a given SKU can use either cloud path.
- No Matter cluster/attribute map is present; only the interceptor gate is visible.
