# split_pact_h1161 — Govee Sync / pickup-box light controller (H1161)

Source root: `decompiled/jadx-splits/split_pact_h1161/sources/`

> The assignment guessed “appliance”. It is a **light-sync controller** (“Govee Sync”):
> one H1161 box drives up to 5 sub-devices (light bars / bulbs) with per-device colors,
> brightness, music and on/off.

---

## 1. Overview / family and SKUs

| SKU | goodsType | role | transport | notes |
|---|---|---|---|---|
| H1161 | 32 | Govee Sync controller / pickup box | ble | controls up to 5 sub-devices (marks 0..4); per-device color + music |

Registry: `pact/Support.java` (`a="H1161"`, `d={32}`,
`getDefDeviceName` → “Govee Sync”, `getMaxSupportDevice()=5`),
`pact/SubMaker.java` (`BleSkuItem`), `pact/SubLib.java` (`Item.b()`),
`pact/Register4Item.java`.
Pact: goodsType 32 supports `beProtocol(1,1)`, `(1,2)`, `(2,2)`.
`pact/Model extends AbsDeviceMode4Ble`; `pact/DeviceItem extends AbsBleItem`;
`SmartRoomOp4H1161.supportBle()==true`, `supportWifi()==false`,
`getRoomOp4Iot()==null` → **BLE-only**.

Sub-device model: `adjust/v1/ExtV1` stores `DeviceInfo` entries
(`sku`, `device`, `goodsType`, `bleName`, `bleAddress`, `mark`, `currentCmdV`, `status`)
and `DeviceColor{sku,color,goodsType,spec,bleAddress}` plus `SubModeMusic` and a
`DeviceInfoWithColor` list. `newdetails/bean/H1161Device*` mirror the cloud payloads.

---

## 2. Transports & GATT UUIDs

| item | value |
|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` |
| frame | 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` |
| write | `0x33` |
| read | `0xAA` |
| multi | `0xA3` (V1/V2 `MultipleControllerComm*`) |
| notify | `0xEE` |

`ble/BleComm.java`, `BleMultiComm.java`, `BleNotifyComm.java`.
No IoT/Wi-Fi transport; `SmartRoomOp4H1161` explicitly returns `supportWifi=false`.
Cloud interaction is limited to bind / device-list persistence
(`newdetails/net/IPickUpApi`, `SaveDeviceRequest`, `SortData`, `SupportDeviceListData`).

---

## 3. BLE frame + command table

`ble/BleProtocol.java`:

| const | value | meaning |
|---|---|---|
| `single_open` | 16 (`0x10`) | master on/off |
| `single_brightness` | 17 (`0x11`) | brightness |
| `sub_mode_color` | 20 (`0x14`) | color mode |
| `sub_mode_music` | 15 (`0x0F`) | music mode |
| `sub_mode_music_new` | 19 (`0x13`) | new music mode |
| `value_sub_mode_music_soft` | 0 | mild |
| `value_sub_mode_music_power` | 1 | dynamic |
| `value_music_mode_rhythm` | 4 | rhythm |
| `single_value_sub_rhythm` | 48 | rhythm |
| `single_value_sub_zhanfang` | 49 | bloom |
| `single_value_sub_cuican` | 50 | bright drill |
| `single_value_sub_bolang` | 51 | wave |
| `single_value_sub_jiepai` | 52 | beat |
| `single_value_sub_pinpu` | 53 | spectrum |
| `single_value_sub_gundong` | 54 | rolling |
| `value_device_num` | 64 (`0x40`) | device count |
| `value_device_info` | 65 (`0x41`) | device info |
| `value_clear_device` | 66 (`0x42`) | clear device list |
| `value_op_device` | 67 (`0x43`) | operate sub-device |
| `value_setting_device` | 48 (`0x30`) | set device list |
| `notify_brightness` | 32 (`0x20`) | brightness notify |
| `value_connect_status_notify` | 64 (`0x40`) | status notify |
| `value_device_flag_4_ble_address` | 0 | address flag |
| `value_device_flag_4_ble_name` | 1 | name flag |

| command | op | payload | layout | source |
|---|---|---|---|---|
| master on/off | `0x33/0x10` | `on` | `[0]=0/1` | `ble/OpenController.q` |
| read on/off | `0xAA/0x10` | – | `[0]` state | `OpenController.parseValidBytes` |
| brightness | `0x33/0x11` | `value` | 0–100 | `ble/BrightnessController.q` |
| read brightness | `0xAA/0x11` | – | `[0]` value | `BrightnessController` |
| color/music mode | `0x33/0x05` | see §7 | `[0]=submode` | `ble/ModeController`; `SubModeMusic` |
| read mode | `0xAA/0x05` | `[1]` | base `AbsModeController.p()` | `ModeController` |
| device count | `0xAA/0x40` | – | `[0]` count (negative = fail) | `ble/DeviceNumController` |
| device info | `0xAA/0x41` | `pos` | `[0]=pos`; response address (flag 0) or name (flag 1 + length) | `ble/DeviceInfoController` |
| operate sub-device | `0x33/0x43` | `pos, on` | `[0]=pos,[1]=on?0:1` (note inverted in code) | `H1161VM4Light.r5` |
| set device list | `0xA3/0x30` | multi-packet | `[count, entry…]` | `ble/MultiDeviceController` |
| clear devices | `0x33/0x42` | `pos…` or `FF` | clear listed or all | `ble/ClearDeviceController` |
| music multi | `0xA3/0x41` | `MusicController` blocks | base `MultipleController4Music` | `newdetails/music/H1161NewMusicMode` |
| heart | `0xAA/0x01` | – | base | `SmartRoomOp4H1161.heartBytes()` |
| switch (room op) | `0x33/0x01` | `on` | base | `SmartRoomOp4H1161.makeSwitchOpBytes` |

### 3.1 Device-list packet (`0xA3/0x30`)

`MultiDeviceController` builds one logical payload:

```
[count]
per device:
  [mark][flag][cmdVersion]
  if flag==0 (BLE address): 6 bytes address, reversed (AA:BB:CC:DD:EE:FF → FF EE DD CC BB AA)
  if flag==1 (BLE name):    [nameLen][name UTF-8…]
```
`flag` 0 = address (`value_device_flag_4_ble_address`), 1 = name
(`value_device_flag_4_ble_name`). `mark` is the 0-based slot index assigned by the
app; `cmdVersion` is the sub-device’s protocol version. Sent through
`AbsMultipleControllerV1` (proType `0xA3`, cmdType `0x30`).

### 3.2 Device-info reply (`0x41`)

- flag 0: `[pos,0,addr6,?,version]` → address string + version at `[8]`.
- flag 1: `[pos,1,nameLen,name…,version]` → name string + version at `[nameLen+3]`.
Version is the sub-device protocol version used for `mark/cmdVersion`.

### 3.3 Operate sub-device (`0x43`)

`{0x43, pos, (status==0)?1:0}` — the code inverts the desired state because
`status` is the *reported* state. Success turns the slot on/off.

---

## 4. BLE notifications / readings

| notify | parser | layout | source |
|---|---|---|---|
| `0x20` | `BrightnessNotifyParse` | `[0]` brightness 0–100 | `ble/BrightnessNotifyParse` |
| `0x40` | `DeviceStatusNotifyParse` | 5 bytes copied to `EventH1161.EventDeviceStatus` | `ble/DeviceStatusNotifyParse` |
| `0x41` | `ResetDeviceNotifyParse` | factory-reset event (no payload) | `ble/ResetDeviceNotifyParse` |
| `0x05` | mode read | see §7 | `ModeController` |
| `0x10` | open read | `[0]` on/off | `OpenController` |

The 5-byte `0x40` status block is exposed raw to the UI
(`EventH1161.EventDeviceStatus`); `H1161NewInfo4Detail` maps it into
`DeviceInfo.status` for the sub-device list.

---

## 5. IoT commands + status/readings schema

No IoT transport in this split. The only cloud-facing pieces are:
- bind (`pact/BindExt`, shared `device/rest/devices/v1/bind`),
- sub-device list persistence (`newdetails/net/IPickUpApi`):
  `SaveDeviceRequest`, `SortData`, `SupportDeviceListData`, `DeviceGroupData`,
  `DeviceBean`.
- `CmdTurn` is imported (`newdetails/H1161VM4Light.switchTrigger`) only to build a
  cloud “sync command” snapshot; the actual control is the BLE `0x01` frame.

Scene/room control: `SmartRoomOp4H1161` implements `IRoomOp4Ble` with the H1161
service/characteristic and returns empty color/brightness byte arrays (those are
handled by the detail page, not the room shortcut).

---

## 6. Other protocols

- **BLE pairing**: `add/BleBroadcastProcessor`, `ConnectDialog*`, `PairAcV1`
  (secret key + switch), `add/AddInfo`.
- **Cloud persistence**: `IPickUpApi` for the sub-device list, sort order, and
  supported-device catalogue.
- **No Wi-Fi / MQTT / LAN / Matter** (`supportWifi=false`, `getRoomOp4Iot=null`).

---

## 7. Dynamic effects / music / scenes / DIY

### 7.1 Music mode (`0x05/0x0F`)

`ble/SubModeMusic.d()` (8 bytes):

```
0F effect sensitivity enable colorful? R G B
```
- `effect`: 4 = rhythm (default); other sub-values defined:
  48 rhythm, 49 bloom, 50 bright-drill, 51 wave, 52 beat, 53 spectrum, 54 rolling.
- `sensitivity`: 0–99.
- `enable`: 1/0 (music effect enabled).
- `colorful?`: byte 4 is `1` when not fixed-color, `0` when fixed color.
- `R G B`: fixed background color when `colorful? == 0`.

Parse mirrors it: `[1]=effect`, `[2]=sensitivity`, `[3]=enable`, `[4]==0` → fixed
color from `[5..7]`; effect 4 is the only one with color fields.

### 7.2 Color mode (`0x05/0x14`)

The split imports the shared new-detail `SubMode4Color` (`H1161VM4Light` implements
`IColorModeFuc`), but the actual byte writer is **not in this split**. The H1161
constant `sub_mode_color=20 (0x14)` indicates the submode byte; the shared
`SubMode4Color` supplies per-segment RGB + brightness. Treat the exact color payload
as shared-framework behavior (see `base2light/pact/newdetail/sub/SubMode4Color`).

### 7.3 Per-device color list

`H1161NewInfo4Detail` keeps `DeviceInfoWithColor` entries (one color per sub-device
slot, from `ExtV1.d[]` / `SubMode4Color.d[]`), and `H1161DelegateColorV2Part`
updates them. The wire format is the shared multi-segment color packet; slots are
identified by `mark`/order.

### 7.4 Music multi-packet

`H1161NewMusicMode` builds a `MultipleController4Music` (base cmd `0x41`) with
sensitivity, effect and color bytes, plus a `ControllerMode` frame. Use
`MultipleBleBytes.getMultipleWriteBytesV2` packetization (proType `0xA3`).

### 7.5 Scene / sync

`H1161VM4Light` applies scene snapshots through the shared `ISceneFuc`
(`H1161NewDetailsConfig`), which ultimately writes the same `0x05/0x14` and
multi-color frames. The box then forwards color to each marked sub-device.

---

## 8. Source map

| area | paths |
|---|---|
| registry | `pact/{Support,BleSkuItem,SubLib,SubMaker,Register4Item,Model,DeviceItem}.java` |
| BLE | `ble/{Ble,BleComm,BleMultiComm,BleNotifyComm,BleProtocol,OpenController,BrightnessController,ModeController,SubModeMusic,MultiDeviceController,DeviceInfoController,DeviceNumController,ClearDeviceController}.java` |
| notify | `ble/{DeviceStatusNotifyParse,BrightnessNotifyParse,ResetDeviceNotifyParse}.java` |
| state/model | `adjust/v1/ExtV1.java`, `newdetails/bean/*`, `newdetails/net/*` |
| detail | `newdetails/H1161VM4Light.java`, `H1161NewInfo4Detail.java`, `H1161NewDetailsConfig.java`, `detail/color/*`, `detail/music/*`, `detail/header/*` |
| scenes | `SmartRoomOp4H1161.java` |
| pairing | `add/*` |

---

## 9. Gaps / unknowns

- The **per-device color payload** is produced by the shared `SubMode4Color`
  framework, not by a class in this split; only the submode byte (`0x14`) is defined
  here. Exact segment/mark layout must be read from the base module.
- The `0x40` 5-byte status block is passed through raw; its field meanings
  (per-slot on/off vs. connection state) are only partially inferred.
- `MultiDeviceController` supports both address and name entries, but the app always
  populates address when available; name mode is a fallback.
- H1161 is BLE-only; the `CmdTurn` import is for cloud scene snapshots, not a
  transport.
- `getMaxSupportDevice()=5`, but `mark` values and colors are cloud-assigned; the
  device list must match the cloud list or slots desync.
