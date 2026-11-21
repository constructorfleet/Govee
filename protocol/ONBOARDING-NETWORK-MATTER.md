# Device adoption, network setup and Matter

This is the consolidated reference for how a Govee device gets from "advertisement in the
BLE scan" to "bound to an account and controllable", including the BLE pairing commands,
WiFi credential provisioning (BLE and SoftAP), cloud bind/topic acquisition, and Matter
commissioning.

It complements the command/reading catalogs: adoption commands are mostly ordinary BLE
frames, but they are *stateful* and order-sensitive, so they are collected here rather
than mixed into the effect tables.

## 1. End-to-end flow

```
scan -> parse advert -> connect (GATT) -> heart/power -> secret key -> device info/IC
     -> WiFi link start -> send SSID/password -> device joins WiFi
     -> cloud bind -> device topic -> normal BLE/IoT control
     -> optional: Matter commissioning (QR/manual code -> Matter SDK -> GID/Matter ID/SSID)
```

There are two provisioning families:

- **BLE provisioning** (most WiFi-capable devices): credentials are written over GATT in a
  multi-packet `0x11` command.
- **SoftAP provisioning** (legacy bulbs H6003/H6004 and some H6085/H6086/H6089):
  the phone joins the device's AP and posts JSON over HTTP.

Matter is an *additional* commissioning path. After commissioning, control usually still
travels over the normal Govee BLE/IoT frames; the split modules contain no Matter
cluster/attribute tables.

## 2. BLE discovery and advertisement parsing

The base scanner hands a **62-byte scan record** to
`com.govee.base2home.pact.BleUtil.parseBleBroadcastPact(...)` (and variants). It walks AD
structures and looks for a manufacturer-specific (`0xFF`) block with the Govee company ID.

Result model — `BleBroadCastInfo(result, goodsType, pactType, protoType, flag)`:

| Field | Meaning |
|---|---|
| `result` / `a()` | 1 = valid Govee advert, 0 = not matched |
| `goodsType` / `b()` | product goods type (server product DB key) |
| `pactType` / `c()` | protocol family |
| `protoType` / `d()` | packet/protocol revision from the low nibble |
| `flag` / `e()` | bit 6 of the protocol byte (distribution/pairing flag) |

`parseBleBroadcastPact` layout (base `BleUtil`):

```
[AD len][0xFF][protoByte][companyLo][companyHi][goodsTypeLo][goodsTypeHi][pactType]
                 |            company id      |            |
                 | bit6 = flag               | goodsType LE16
                 | low nibble = protoType
```

Important variants:

| Parser | Use |
|---|---|
| `parseBleBroadcastPact` | generic lighting/appliance pairing advert |
| `parseBleBroadcastPact4Th` | TH sensors (temperature/humidity) |
| `parseBleBroadcastPact4MultiTh` | multi-probe TH |
| `parseBleBroadcastPactBbqV1` | BBQ probes |
| `parseBleBroadTankState` | leak/tank sensors (`[valid, state]`) |
| `parseBleBroadVersion` | advert protocol version |

Per-split adoption code lives in `add/BleBroadcastProcessor*.java`,
`pact/DeviceItem` (`Y(scanRecord)`), `pact/Support`, and `GoodsType.parseBleBroadcastPactInfo`.
Examples of exact advert prefixes are recorded in the per-split docs (e.g. BBQ
`020106030351xx17ff…`, `0201060303505517ff…`, `0201060303561017ff…`).

## 3. BLE adoption / pairing commands

These are sent after connecting, before the device is bound. Exact opcodes vary by family;
the table gives the base forms and the family-specific aliases seen in the splits.

| Purpose | Op / payload | Notes |
|---|---|---|
| Heart / power on | `0x33/0x01` payload `01` | some families use `0x01` as heart only |
| Heart read | `0xAA/0x01` | `[0] != 0` = alive |
| Device info | `0xAA/0x07` | base `BasicInfoController` |
| Soft version | `0xAA/0x06` | `SoftVersionController` |
| Hard / DSP version | `0xAA/0x0B` / `0xAA/0x07` (family) | e.g. `HardVersionController`, `DspVersionController` |
| WiFi MAC | `0xAA/0x14` (family aliases `0x10`, `0x0F`, `0x20`) | 6-byte MAC, reversed |
| Secret key read | `0xAA/0xB1` (default read cmdType -79) | response `[0]==1` + 8-byte key → base64 |
| Secret key write | `0x33/0xB2` (default write cmdType -78) | payload = base64-decoded key |
| WiFi link start | `0x33/0x17` payload `01` start / `00` stop | `WifiLinkStarController` |
| WiFi function list | `0xAA/0x03` | multi-packet reply; TLV, see below |
| IC number / segment count | `0xAA/0x40` | `IcNumController` |
| Check IC / segment | `0x33/0x42`, `0x33/0x43` | `CheckICAmountController` |
| Check light install | `0xAA/0xAA` | H605B/H660x |
| Check camera | `0xAA/0x32` | TV/DreamView |
| Sync time | `0x33/0x09` | `SyncTimeController` |
| WiFi connected notify | notify `0x11`, `[0]==0` | `WifiNotifyParse` |
| Remote/accessory pair | `0x33/0xA4`, exit `0xA6` | not device adoption; accessory pairing |

### WiFi function list (`0xAA/0x03`)

The device reports a TLV list parsed by `com.govee.util.WifiFuncListParse`:

```
[count]
  [type=1][len][funcId ...]          # common WiFi functions
  [type=2][len=3][pactTypeLo][pactTypeHi][pactCode]
```

Mapped to `WifiFuncBean{commonFuncList, specialSkuWifiPact}` and to JSON:

```json
{"wifiFuncList":[
  {"type":1,"subType":[1,2,3]},
  {"type":2,"subType":{"wifiPactType":1,"wifiPactCode":1}}
]}
```

`MtPairProtocol.supportMatter4WifiFuncBean(...)` uses this same list to decide whether the
device exposes a Matter WiFi function.

## 4. WiFi credential provisioning

### 4.1 BLE path

The credentials are sent with `MultipleWifiController` (multi-packet):

| Item | Value |
|---|---|
| proType | write `0xA1` (`-95`), read `0xA2` (`-94`) — `AbsMultipleController` |
| cmdType | `0x11` (17) |
| framing | multi-packet, `[2]` package index, 20 bytes/packet, XOR BCC |
| payload | `ssidLen ssid pwdLen pwd runModeV tzOffset iotVersion tzMinute [apiLenHi apiLenLo api...] [ext...]` |

- SSID/password are UTF-8 with a one-byte length prefix.
- `runModeV` selects run-mode V0/V1; `tzOffset`/`tzMinute` are timezone; `iotVersion` is
  the IoT protocol version.
- Optional API string block: 2-byte big-endian length + bytes.
- Optional extension for Matter/security:
  - `noDynamicApi`: `[00 00 <matterPairWifi && useMatterWifi ? 1 : 0> <securityType>]`
  - otherwise: `[<matterPairWifi && useMatterWifi ? 1 : 0> <securityType>]`
  (`MultipleWifiController.x()` / `y()`).

Flow/UI: `AbsBleWifiChooseActivity` (`com.govee.base2light.ac`) selects WiFi, writes the
secret key, starts WiFi link, sends the credentials, and waits for `EventMultipleWifi` /
`0x11` notify. Device name is set via `BleDeviceNameAc` / `BleDeviceNameAcV1`.
WiFi input limits are per-SKU (`Support.getWifiInputLimit`, usually 32 or 64 bytes).

### 4.2 SoftAP path (legacy bulbs)

Used by H6003/H6004 and the H6085/H6086/H6089 bulb AP flow:

- Device AP SSID prefix `Govee_bulb_<SKU>`.
- Phone joins it; device HTTP server is `192.168.1.1:7200`.
- JSON `BaseRequest`/`BaseResponse`:
  - type 1 = read device info
  - type 2 = send `WifiApInfo`
- Then `CheckDeviceWifiRequest` → `DeviceBindRequest` → `DeviceTopicRequest` to bootstrap
  the cloud binding/topic.

### 4.3 Cloud bind / topic

After the device joins WiFi, the app binds it and obtains the IoT topic:

| Purpose | Path / model |
|---|---|
| Bind device | `device/rest/devices/v1/bind` |
| Get account/device topic | `device/rest/devices/v1/appDeviceTopic` |
| Common pair/name/normal-WiFi pages | `/base2light/common/pair`, `/name`, `/NormalWifi` |
| Bind metadata | `BindExt{address,bleName,deviceName,dspVersionSoft,pactType,pactCode,secretCode}` (families add `topic`, `wifiMac`, WiFi versions) |

The IoT topic is then used by `Iot`/`IotManager` for normal cloud control. Local MQTT/LAN
is only used when `DeviceCommCapability.supportMqtt(sku,device,topic)` is true.

### 4.4 UDP multicast LAN (integration-observed)

The integration uses a **UDP multicast LAN transport to `239.255.255.250:4001–4003`**.
This is **not present in the decompiled Govee Home app** (no `239.255.255.250`/`4001`/
`4003`/multicast send code was found in the base or split modules); the app uses cloud MQTT
and, for some devices, local MQTT/WiFi. It is recorded here as an external/integration
path for completeness.

What is known from the integration: multicast group `239.255.255.250`, ports `4001–4003`.
The packet layout, discovery/control split and device responses are **not derivable from
this APK**; capture them from the integration or the device's LAN traffic before treating
them as authoritative.

### 4.5 Gateways and sub-devices

Gateways (`base2newth`, H5044/H5901) use the same GATT pair and a gateway-specific bind
flow (`GwsCanBind`, `GatewayInfo`, `H5901PairBle`). Sub-devices are then bound through the
gateway (`0x08` sub-device frames; see the leak/TH/gateway split docs), not with their own
WiFi credentials.

## 5. Matter setup

### 5.1 Support gating

Matter availability is decided by:

```java
AddDeviceConfig.isSupportMatter(goodsType, sku, softVersion, hardVersion,
                                wifiSoftVersion, wifiHardVersion)
```

which checks hard-coded SKU/version gates and then iterates registered
`MatterInterceptor`s (`isSupportMatterNullable`). Examples:

| SKU / goodsType | Gate |
|---|---|
| H61E0/H61E1 (123) | soft ≥ `3.00.33`, hard `3.01.01`, WiFi soft ≥ `1.01.06`, WiFi hard `1.04.01` |
| H61B5 (123) | soft ≥ `1.01.04`, hard `3.05.00`, WiFi soft ≥ `1.06.12`, WiFi hard `1.04.01` |
| H80B5 (123) | always true |
| H60B0/H60B1 (301/300) | `MatterInterceptor` in `ConfigH60B0` / `AddDeviceM` |
| H6079/H607C/H16B0 | `Support.supportMatterFunc` + `H607CMatterHelper` version gates |
| H6063/H606A/H6069 | `Support.supportMatterFunc` + `H6063MatterHelper` |

`MtPairProtocol.supportMatter(...)` wraps this; `supportMatter4WifiFuncBean(...)` checks the
device's WiFi function list (`WifiFuncListGlobalAPI.isSupportMatter`). 77 SKUs advertise
Matter in the collection.

### 5.2 Matter BLE protocol

Matter provisioning uses the standard Govee GATT pair (`…1910` service, `…2b11`
characteristic), proType **`0xAB`** (`-85`), read-only controllers
(`com.govee.matter.pact.AbsMtReadController`).

Frames are 20 bytes; multi-packet responses:

```
start:  AB 00 <totalLenLo> <totalLenHi> <chunkLen> 00 <data...>
data :  AB <index> <data...>
final:  AB FF <last data...>
```

`AbsMtReadController.v() = 17`, `w() = 6` (17 data bytes from offset 6).

| subOp (payload byte 0) | Controller | Returns |
|---|---|---|
| `01` | `Controller4QrCode` | Matter QR code string |
| `02` | `Controller4BaseInfo` | `isSupportMatter`, `hasPairNet`, `hasAddedEcology` (3 bytes) |
| `03` | `Controller4WifiSsid` | provisioned WiFi SSID string |
| `04` | `Controller4Gid` | GID string (or safe-bind result) |
| `05` | `Controller4MatterId` | Matter ID string |
| `06` | `Controller4PairCode` | manual pairing code string |
| cmdType `0x03` | `Controller4WifiFunc` | WiFi function list (multi-packet, 13/6 framing) |

`MatterManager` / `MatterManagerNew` orchestrate: read base info; if already paired read
GID/Matter ID/SSID; otherwise obtain QR+manual code from the device or cloud; hand off to
the Matter SDK/system commissioning; after commissioning read back GID/Matter ID/SSID and
upload.

### 5.3 Matter REST

| Purpose | Endpoint | Request / response |
|---|---|---|
| Get QR/manual code | `POST bff-app/v1/matter/qrCode` | `Request4GetMtQrInfo{sku,device,wifiMac}` → `Response4GetMtQrInfo{data.codeInfo{qrCode,manualCode}}` |
| Upload QR result | `POST bff-app/v1/matter/upload-qrcode` | `Request4SetMtQrInfo{sku,device,wifiMac,qrCode,manualCode}` → `Response4MtQrInfo{data.qrCodeId}` |
| Check upload | `POST bff-app/v1/matter/check-upload-qrcode` | `Request4CheckMtQrInfo{sku,device,wifiMac}` |
| Reset Matter IDs | `PUT bff-app/v1/devices/matter-ids` | `Request4ResetMtInfo{sku,device,gId,matterId}` |

Data model `MatterInfo{wifiSsid,gid,matterId,isSupportMatter,hasPairNet,hasAddedEcology}`
(`com/govee/matter/pair/MatterInfo.java`). `hasMatterInfo()` requires support + non-empty
GID + Matter ID; `hasMatterWifi()` requires support + non-empty SSID.

### 5.4 Matter commissioning flow

1. Check `MtPairProtocol.supportMatter` / `AddDeviceConfig.isSupportMatter`.
2. Read base info `0xAB/02` → support, already-paired, already-in-ecology flags.
3. If not paired: get QR + manual code from the device (`0xAB/01`, `0xAB/06`) or cloud
   (`POST /matter/qrCode`).
4. Hand the code to the OS/Matter SDK; the SDK commissions the device onto the thread/
   WiFi network.
5. Read back `0xAB/03` SSID, `0xAB/04` GID, `0xAB/05` Matter ID.
6. Upload the QR result (`/matter/upload-qrcode`) and bind the device to the account.
7. `MatterManager`/`MtGuide` exposes the result to the add/settings UI.

The split modules only implement the Govee side (BLE/REST handoff). Matter clusters,
attributes and the actual commissioning stack live in the closed `com.govee.matter`
library / native SDK.

## 6. Where this is implemented

- Base advert/pair helpers: `com/govee/base2home/pact/BleUtil.java`,
  `BleBroadCastInfo.java`, `GoodsType.java`, `Pact.java`.
- Base WiFi provisioning: `com/govee/base2light/ble/controller/{WifiLinkStarController,
  WifiMacController, SecretKeyController, MultipleWifiController,
  Controller4ReadWifiFuncList}.java`; `base2light/wifi/*`; `base2light/ac/AbsBleWifiChooseActivity.java`.
- Base Matter: `com/govee/matter/{MatterManager,MatterManagerNew,MtGuide}.java`,
  `matter/pact/{BleComm,MtPairProtocol,AbsMtReadController}.java`,
  `matter/pact/controller/*`, `matter/net/*`, `matter/pair/MatterInfo.java`.
- Per-split adoption: `add/BleBroadcastProcessor*.java`, `add/PairAc*.java`,
  `add/AddDevice*.java`, `pact/{Support,SubLib,SubMaker}.java`, `*MatterHelper.java`,
  `*MatterSupport.java`.

## 7. Version audit: Govee Home 5.6.20 (Matter release) has no cluster definitions

Govee Home **5.6.20** (versionCode 562, 2023-05-24) was downloaded from APKMirror and
inspected specifically for Matter cluster/attribute definitions. Result: **none are
present in the APK.**

What the APK contains (130 dex files, ~197 MB):

- `com.govee.matter.MatterManager` — QR/manual-code, GID, Matter ID, SSID, timeouts.
- `com.govee.matter.pact.{AbsMtReadController, BleComm, MtPairProtocol}` and controllers
  `Controller4{BaseInfo, Gid, MatterId, PairCode, QrCode, WifiSsid}` — the same
  commissioning protocol documented above (`0xAB/01..06`).
- `com.govee.matter.net.{IMatterNet, Request4GetQrCode, Request4ResetMtInfo, ...}` —
  QR/ID cloud endpoints.
- `com.govee.matter.guide.Activity4MatterGuide` — renders the QR, displays the manual
  code, reads the BLE IDs; it does **not** send cluster commands.
- `com.govee.matter.pair.{MatterInfo, Dialog4ChangeWifiRemind}`.

Evidence of absence:

- No class descriptors containing `Cluster` (all 129 dex scanned; only unrelated
  `ColorClusterer`, `trackViewClusterPoint*`, and AndroidX/Material “chip” classes).
- No `chip`, `connectedhomeip`, `MatterCluster`, `ClusterId`, `AttributeId` controller
  classes; no `libmatter` / `libchip` native library.
- No Matter/Google-Home GMS controller package in the dex.
- `Activity4MatterGuide` only stores/display `qrCode` and `pairCode`; the actual
  commissioning is delegated to the system/Matter ecosystem.
- The same is true in the fully decompiled **7.7.10** base and the **7.7.21** split
  modules: only `MatterSupport` / `MatterHelper` / `MatterInterceptor` and the
  `0xAB` commissioning controllers exist.

Conclusion: the Govee Home app is a **commissioning client**, not a Matter controller for
custom clusters. After commissioning, control still travels through Govee BLE/IoT frames.
Custom cluster definitions, if they exist, live in the **device firmware** (or in the
CSA/DCL certification data and Matter test reports), not in this APK. That also explains
why the app only needs the QR/manual code and the GID/Matter-ID/SSID readback.

## 8. Gaps / caveats

- Matter cluster/attribute mapping and the commissioning engine are not in the app; only
  the Govee QR/ID/SSID/REST handoff is visible. The 5.6.20 audit in §7 confirms no
  cluster definitions in the APK.
- The precise Matter QR payload string is generated by firmware/cloud; the app transports
  it, it does not construct it.
- SoftAP provisioning is legacy; most current devices use BLE provisioning.
- Advertisement parsers exist in several variants and a few JADX methods are stubs; exact
  company-ID constants/prefixes are documented per split where readable.
- Pairing command opcodes are family-specific (especially WiFi MAC/secret key/IC); the
  table gives the base forms and per-split docs carry the aliases.
- Thread is not used by these modules (Matter runs over WiFi/BLE).
