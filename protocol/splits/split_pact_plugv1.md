# split_pact_plugv1 — legacy WiFi plugs / switches (H5001, H5081, H7014)

Source root: `decompiled/jadx-splits/split_pact_plugv1/sources/`

---

## 1. Overview / family and SKUs

Two independent IoT-only sub-families live in this module. There is **no BLE GATT
control path**; both use the cloud (`iot`) as their command transport, and both use
the legacy AP (hotspot) provisioning flow for Wi-Fi onboarding.

### 1.1 `plugv1` generic — H5001 / H5081

Registry: `plugv1/pact/Support.java`
- goodsType **4** → **H5081** (Smart Plug), pact `beProtocol(4,1)`
- goodsType **26** → **H5001** (Smart Switch), pact `beProtocol(1,1)`

SKU variants (regional suffixes on the add screen):
`Support.a="101"` (US), `b="201"` (UK), `c="301"` (EU/ER). `Support.d="H5081"`,
`e="H5001"`.
- AP SSID: `Govee_plug_<sku>` for H5081, `Govee_Switch_<sku>` for H5001
  (`Support.getHotAp`), AP IP `192.168.1.1`, config timeout `7200`.
- `SubMaker` registers `IotSkuItemV1` (goodsType 4) and `IotSkuItemV2` (goodsType 26).
- Model `plugv1/pact/Model.java` extends `AbsDeviceModel4Iot`; item is
  `AbsItem30IotItem`. `needBle()` returns false (`pact/AbsIotSkuItem.java`).

### 1.2 H7014 — single-socket WiFi plug

`h7014/` is a self-contained old IoT plug:
- `Sku.a="H7014"`, `Sku.b/c = {H7014}`, AP SSID `Govee_plug`, AP IP `192.168.1.1`,
  config timeout `7200`, WiFi input limit 31/31.
- `h7014/sku/DeviceItem.java` extends `AbsItem30IotItem`;
  `h7014/iot/IotManager.java` extends `AbsIotManagerV0` (V0 envelope).
- `SkuH7014` is an `AbsSkuItem`; no BLE service/characteristic anywhere in the split.

Transports: **`iot` (cloud/WiFi)** for both. Provisioning is Wi-Fi AP / HTTP, not BLE.
No `ble+iot`, no local LAN/MQTT or Matter code in this split.

---

## 2. Transports & GATT UUIDs

None. There is no `BleComm`/`BleProtocol` in `split_pact_plugv1`.

| transport | detail |
|---|---|
| provisioning | device hotspot `Govee_plug_<sku>` / `Govee_Switch_<sku>` (`Govee_plug` for H7014), AP `192.168.1.1`, HTTP config (`add/ApComm`, `ApDeviceInfo`, `ApWifiInfo`) |
| control | Govee IoT cloud JSON (V0 for H7014 / V2 for H5001/H5081 scenes) |
| local LAN | none found |

`plugv1/add/PairAc.java` (goodsType 4) and `PairAcV1.java` (goodsType 26) implement
the AP hand-off.

---

## 3. BLE frame + command table

Not applicable — no BLE frames. The equivalent “command table” is the IoT JSON set
in §5.

---

## 4. BLE notifications / readings

Not applicable. Device state arrives only as IoT `status` / `online` replies.

---

## 5. IoT commands + status/readings schema

### 5.1 `plugv1` (H5001 / H5081)

`plugv1/iot/Cmd.java` command names:
`state`, `config`, `turn`, `delay`, `status`, `online`, `timer`, `nightMode`.
`getCmdReadParseKey` maps `timer`/`delay` → `config`, otherwise `state`.

| cmd | data fields | meaning | source |
|---|---|---|---|
| `turn` | `{"val":0|1}` | socket on/off | `CmdTurn.java` |
| `status` | `{}` | request snapshot (`state` + `config`) | `CmdStatusV0/V1` |
| `timer` | `{group,enable,type,hour,minute,repeat,timeOffset,timeOffsetMinute,timeStamp}` | write one weekly timer (V1 4-byte record semantics) | `CmdTimer.java` |
| `delay` / `delayClose` | `{enable,minutes,leftMinutes}` | delayed off | `CmdDelayClose.java` |
| `nightMode` | `{"val":0|1}` | night-mode switch (V2/H5001 only) | `CmdNightMode.java` |
| `state` | `{onOff, nightMode}` | read-back | `CmdStatusV0.State`, `CmdStatusV1.State` |
| `config` | `{delay:{enable,minutes,leftMinutes}, timer:[NewTimerV1…]}` | timers + delay | `CmdStatusV0.Config` |

`CmdStatusV0` is used for goodsType 4 (H5081); `CmdStatusV1` adds `nightMode` for
goodsType 26 (H5001) — `plugv1/adjust/v2/IotOpV2.java`.
`CmdTimer` fields: `group`, `enable`, `type`, `hour`, `minute`, `repeat` (byte),
`timeOffset` (hours), `timeOffsetMinute`, `timeStamp` (epoch seconds), all sent as
JSON ints.

### 5.2 H7014

`h7014/iot/Cmd.java`: `turn`, `status`, `timer`, `delayClose`.
`IotManager extends AbsIotManagerV0` → **V0 incoming envelope**; it parses the whole
`data` object through `CmdStatusV0.parseJson`.

| cmd | data | meaning | source |
|---|---|---|---|
| `turn` | `{"val":0|1}` | on/off | `CmdTurn.java` |
| `status` | `{}` | snapshot | `CmdStatusV0.java` |
| `timer` | `{enable, time:[{openHour,openMin,closeHour,closeMin}], timeOffset, timeOffsetMinute}` | one on/off window (single `time[0]` used) | `CmdTimer.java` |
| `delayClose` | `{enable,minutes,leftMinutes}` | delayed off | `CmdDelayClose.java` |

`CmdStatusV0.Status`: `{turn, softversion, delayClose:{enable,minutes,leftMinutes},
timer:{enable,time:[{openHour,openMin,closeHour,closeMin}]}}`.
`open` is `turn==1`; `timerInfo` takes only `time[0]`.
Events: `EventSetNightMode`, `ResultEventNightMode` (night-mode UI sync).

### 5.3 Status schema (unified)

```json
{
  "state": {"onOff": 0, "nightMode": 0},
  "config": {
    "delay": {"enable": 0, "minutes": 30, "leftMinutes": 12},
    "timer": [{"enable":1,"type":0,"hour":7,"minute":30,"repeat":127}]
  }
}
```
H7014 instead:
```json
{"turn":1,"softversion":"1.00.00",
 "delayClose":{"enable":0,"minutes":0,"leftMinutes":0},
 "timer":{"enable":1,"time":[{"openHour":7,"openMin":0,"closeHour":23,"closeMin":0}]}}
```

### 5.4 Scenes

Both families expose an IoT scene builder:
- `plugv1/scenes/IotSwitchCmdBuilderV1.java` — `CmdTurn`, goodsTypes `{4,26}`,
  replies parsed as `IotMsgV2`, success when `cmd=="status"`.
- `h7014/scenes/SwitchCmdBuilder.java` — `CmdTurn`, SKU `{H7014}`, replies parsed as
  `IotMsg` (V0), success when `cmd=="status"`.
- `SmartRoomOp` returns `supportBle()==false`, `supportWifi()==true`.

---

## 6. Other protocols

- **AP provisioning**: `plugv1/add/ApComm*.java`, `ApDeviceInfo`, `ApWifiInfo`,
  `h7014/add/ApComm.java`; hotspot/IP/timeout constants in `Support`/`Sku`.
- **REST**: no dedicated service in this split; bind is done by the shared
  `device/rest/devices/v1/bind` path (`AddInfo`/`BindExt`).
- **No BLE, no Matter, no MQTT/LAN** in this split.

---

## 7. Dynamic effects / scenes / DIY

No light effects. “Scenes” are simply switch actions
(`IotSwitchCmdBuilderV1`, `h7014/scenes/SwitchCmdBuilder`). Night mode is a boolean
H5001-only feature (`CmdNightMode`, `ResultNightMode`).

---

## 8. Source map

| area | paths |
|---|---|
| registry/SKU | `plugv1/pact/{Support,SubLib,SubMaker,IotSkuItemV1,IotSkuItemV2,AbsIotSkuItem,Model,DeviceItem}.java`, `h7014/sku/{Sku,SkuH7014,SubLib,SubMaker,DeviceItem}.java` |
| IoT | `plugv1/iot/*.java`, `h7014/iot/*.java` |
| adjust | `plugv1/adjust/{AdjustAc,AdjustAcV2}.java`, `plugv1/adjust/v1/*`, `v2/*` |
| scenes | `plugv1/scenes/*`, `h7014/scenes/*` |
| provisioning | `plugv1/add/*`, `h7014/add/*` |

---

## 9. Gaps / unknowns

- The exact AP HTTP endpoints/paths used during provisioning are not visible in the
  decompiled `ApComm` classes (they delegate to a base HTTP helper); only the AP SSID,
  IP `192.168.1.1` and timeout are in this split.
- H5001 and H5081 share one `CmdStatus` parser family, but the cloud may add keys
  (`nightMode`, regional variants) not present in the model; unknown keys are ignored.
- `CmdTimer.repeat` is a raw byte in the model; the bit→weekday mapping lives in the
  shared `NewTimerV1`/`TimerInfo` base and is not redefined here.
- H7014 only uses `time[0]` of the timer array; additional windows are ignored by
  design (single-window device).
