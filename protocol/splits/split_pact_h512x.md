# split_pact_h512x — sensors (motion, door/window, button, vibration, pressure, presence)

Source root: `decompiled/jadx-splits/split_pact_h512x/sources/`

> The assignment guessed “heater/thermostat”. It is **not** a heater family: this is
> the H512x **sensor** family (PIR motion, door/window, button, vibration, pressure
> mat, and the H5127 mmWave presence sensor).

---

## 1. Overview / family and SKUs

Two registries:

### 1.1 H5121–H5130 broadcast/trigger sensors (`h512x`, `h5121`)

Each SKU has its own `config/hXXXX/HXXXXConfig.java` and registers a
`SupportConfig` pact and `SensorPush` push handler. They are **battery sensors**:

| SKU | goodsType | sensor | battery | special |
|---|---|---|---|---|
| H5121 | 130 | Motion Sensor | 1×CR2450 | 3 distance levels (near/mid/far), interval, gasket guide |
| H5122 | 131 | Button Sensor | 1×CR2032 | single/double/long press semantics |
| H5123 | 132 | Door and Window Sensor | 1×CR1632 | open/close |
| H5124 | 139 | Vibration Sensor | 1×CR2032 | vibration/tilt |
| H5125 | 144 | Button Remote | 1×CR2032 | multi-button remote |
| H5126 | 145 | Button Switch | 1×CR2032 | button events |
| H5129 | 206 | Outdoor Motion Sensor | 2×CR123A | 3 distance levels (80/40/20), Li-Sen switch |
| H5130 | 238 | Pressure Sensor (mat) | 1×CR2450 | pressure threshold/sensitivity, has/no-pressure times, light display |

`SupportConfig` maps goodsType→protocol:
130/206/238 all `beProtocol(2,1)`; `h512x/H512xAppImp` registers each SKU with
`ModelMaker`, `Register4Item`, `BleProcessorManager` (`SkuItemClickEvent`),
`SensorPush`, and a theme icon.
Transports: **BLE broadcast + BLE setup connection + cloud push**. The puck is not a
Wi-Fi device; events are delivered as push (`h512x/push/SensorPush`) and the last
state is cached in `DeviceExtMode` (`Item/LastData`). BLE is used for pairing and
for the H5121/H5129/H5130 settings (`needBle() == true`).
`H5127` is a separate cloud+BROADCAST device (see below).

### 1.2 H5127 presence sensor (`h5127`)

| SKU | goodsType | sensor | transport | notes |
|---|---|---|---|---|
| H5127 (dynamic `H5127_<suffix>`) | 183 | mmWave presence sensor | ble + iot + ble-broadcast | pairing advert `GVH5127…`; config over BLE; status over IoT `op` frames |

`Support.b="H5127"`, `Support.d={183}`, `Pact.beProtocol(1,1),(2,1)`.
`BleBroadcast4H5127` parses adverts whose manufacturer data starts `0201050c09`
with `BleBroadCastInfo.version()==1 && protocol()==3`, name `GVH5127…`; the SKU is
`"H5127_"+suffix`, goodsType from `Pact.d.e(skuPart)`, protocol from the advert.
`Model` implements `IIotOnline` and polls `status`/`online` on the device topic.

---

## 2. Transports & GATT UUIDs

| item | H5121–H5130 | H5127 |
|---|---|---|
| service | `00010203-0405-0607-0809-0a0b0c0d1910` | same |
| characteristic | `00010203-0405-0607-0809-0a0b0c0d2b11` | same |
| alt char (BLE V1) | `00010203-0405-0607-0809-0a0b0c0d2b10` (`BleComm.v`) | – |
| frame | 20 bytes `[0]=proType [1]=cmdType [2..18]=payload [19]=XOR BCC` | same |
| write/read | `0x33` / `0xAA` | same |
| extra | BLE broadcast adverts for pairing | BLE broadcast + IoT `op` |

`h5121/ble/commV1/BleComm` uses the `base2newth` `AbsThGattCallback`; isSelfComm
accepts `…1910` + `…2b10` with proType `0xAA`/`0x33`. `h5121/ble/other/CommonBleComm`
uses `…1910`/`…2b11` for H5130. H5127 `BleComm` reuses the H5121 V1 UUID strings.

Advertisement:
- H5121–H5130: `SkuItemClickEvent.o` decodes the advert by hex offsets:
  name = bytes[10..30], `bdType` = [38..40], device id = [42..58], hard = [58..60],
  soft = [60..62]. No event payload is parsed here; events come from push.
- H5127: `BleBroadcast4H5127.parse` requires `0201050c09…`, `version==1`,
  `protocol==3`; name `GVH5127<suffix>`; SKU `H5127_<suffix>`; device id from advert.

---

## 3. BLE frame + command table

### 3.1 H5121 / H5129 motion sensors

`h5121/ble/BleProtocol.java`: level constants 1/2/3/4/5/6 and 5 (event types).
Controllers use `base2newth.AbsSingleController` with `i()` payloads.

| command | op | payload | layout | source |
|---|---|---|---|---|
| distance level (H5121) | `0x33/0x01` | `threshold pulse window level` | level 0 → `45,1,1,0`; level 1 → `20,1,1,1`; other → `20,1,1,level` | `h5121/ble/commV1/CommandDistanceLevel.java` |
| read distance level | `0xAA/0x01` | – | same 4 bytes; `45/1/1` = level 0, `20/1/1` = level 1, else raw level at [3] | same |
| distance level (H5129) | `0x33/0x01` | `threshold pulse window level` | level 0 → `80,1,0,0`; 1 → `40,1,0,1`; 2 → `20,1,0,2`; other → `20,1,0,level` | `CommandDistanceLevel4H5129.java` |
| read distance level (H5129) | `0xAA/0x01` | – | `80/1/0`, `40/1/0`, `20/1/0` recognised | same |
| check interval | `0x33/0x02` | `seconds` | default 60 | `CommandIntervalTime.java` |
| read interval | `0xAA/0x02` | – | `[0]` seconds | same |
| Li-Sen switch (H5129) | `0x33/0x03` | `on` | leave-sensing enable | `Command4H5129LiSenSwitch.java` |
| read Li-Sen | `0xAA/0x03` | – | `[0]` 0/1 | same |

Distance levels are interpreted as near/mid/far (H5121: 45/20/other; H5129: 80/40/20).
The units are the firmware’s threshold value, not a published distance.

### 3.2 H5130 pressure sensor

`h5121/ble/other/*` controllers, `CommonBleComm` (`…1910`/`…2b11`):

| command | op | payload | layout | source |
|---|---|---|---|---|
| current pressure | `0xAA/0x02` | – | `[0]` raw pressure level | `Controller4CurPressure` |
| pressure threshold | `0x33/0x03` | `level` | slider 1–10 | `Controller4PressureThreshold` |
| read threshold | `0xAA/0x03` | – | `[0]` level | same |
| has-pressure time | `0x33/0x04` | `secBE16` | seconds | `Controller4HasPressureTime` |
| read has-pressure time | `0xAA/0x04` | – | BE16 | same |
| no-pressure time | `0x33/0x05` | `secBE16` | seconds | `Controller4NoPressureTime` |
| read no-pressure time | `0xAA/0x05` | – | BE16 | same |
| light display | `0x33/0x06` | `on` | LED display enable | `Controller4LightIsDisplay` |
| read light display | `0xAA/0x06` | – | `[0]` 0/1 | same |

Notify `0x05` = current pressure (`NotifyParse4CurPressure` → `Event4CurPressure`).
The write ACK uses `[0]==0` as success (`Compose4WriteH5130`).

### 3.3 H5127 presence sensor

`ControllerProtocol`: `5 = config params`, `7 = some ext`, `0x1A (26) = radar sensitivity`,
`0xB5 = sync time`, `1 = header/heartbeat`, `0x20/0x21 = wifi hard/soft`,
`0x10 = wifi mac`, `0x1F = only-idf-human`, `0x24 = te range`.

| command | op | payload | layout | source |
|---|---|---|---|---|
| read header/heartbeat | `0xAA/0x01` | – | `[0] status,[1..2] distance BE16,[6..9] duration BE32` | `Controller4Header`; `H5127ParseUtils.d` |
| check mode read | `0xAA/0x05` | `[0]` | `[0]=0` | `Controller4CheckMode.a` |
| check mode write | `0x33/0x05` | `00 03` | enables check mode | `Controller4CheckMode.b` |
| config params read | `0xAA/0x05` | `[1]` | `[0]=1` | `Controller4ConfigParams.a` |
| config params write | `0x33/0x05` | `01 distBE16 nhBE16 hhBE16` | check distance + no-human/has-human judge times | `Controller4ConfigParams.b` |
| te range read | `0xAA/0x05` | `[3]` | `[0]=3` | `Controller4TeRange.a` |
| te range write | `0x33/0x05` | `03 00 valid startBE16 endBE16` | target-exclusion range | `Controller4TeRange.b` |
| radar sensitivity read | `0xAA/0x1A` | `[4]` | `[0]=4` | `Controller4RadarSensitivity.a` |
| radar sensitivity write | `0x33/0x1A` | `04 level` | level | `Controller4RadarSensitivity.b` |
| only-idf-human read | `0xAA/0x1F` | – | `[0]` 0/1 | `Controller4OnlyIdfHuman.a` |
| only-idf-human write | `0x33/0x1F` | `01 on` | | `Controller4OnlyIdfHuman.b` |
| sync time | `0x33/0xB5` | `ts32BE 01 tzH tzM` | | `Controller4SyncTime` |
| read ext block | `0xAA/0x07` | `02/03/0A/0B` | device id / ble hard / mcu soft / mcu hard | `Controller4SomeExt` |
| wifi mac | `0xAA/0x10` | – | 6-byte MAC | `Controller4WifiMac` |
| wifi soft/hard | `0xAA/0x21` / `0xAA/0x20` | – | version blocks | `Controller4WifiSv/Hv` |

H5127 heartbeat event (`notify 0x01`) → `Event4NotifyBleHeartInfo` with
`[status, distanceBE16, durationBE32]`. `0x24` notify → target-exclusion range.

---

## 4. BLE notifications / readings

| notify | parser | layout | source |
|---|---|---|---|
| `0x01` | `NotifyParse4BleHeart` / `Controller4Header` | `[0]` check status, `[1..2]` distance BE16, `[6..9]` status duration BE32 | `h5127/ble/notify/NotifyParse4BleHeart.java`; `H5127ParseUtils.d` |
| `0x24` | `NotifyParse4TeRange` | `[0]=1`, `[3..4]` start BE16, `[5..6]` end BE16 | `NotifyParse4TeRange.java` |
| `0x05` (H5130) | `NotifyParse4CurPressure` | `[0]` current pressure level | `h5121/ble/other/NotifyParse4CurPressure.java` |
| wifi set result | `NotifyParse4WifiSetResult` | onboarding result | `h5127/ble/notify/NotifyParse4WifiSetResult.java` |

H5121–H5130 do not parse sensor events over a GATT notify; they receive push events
and cache `LastData{logType, logTime, online, bind}`. `logType` enumerates the event
kind (motion/button/door/vibration/pressure etc.); the SKU config maps icons/text.

H5127 `H5127LastDeviceData` caches `checkStatus`, `distance`, `statusDuration`,
`installWay`, `isBleBroadcast`, `isIotConnected`, `refreshStatusTime`.

---

## 5. IoT commands + status/readings schema

### 5.1 H5127 (`op` frames over IoT)

`Model.t` (IIotOnline) subscribes to the device topic and parses `status` + `op`:

```json
{"cmd":"status","op":{"command":["<base64 20-byte frame>"]}}
```
`H5127ParseUtils.e` walks each frame:
- cmd `0x01` header → `[status, distance, duration]`
- cmd `0x1F` only-idf-human → `[0]==1`
- cmd `0x05` sub `1` → `{checkDistance, nhJudgeTime, hhJudgeTime}`
- cmd `0x05` sub `3` → `{teStart, teEnd}`
- cmd `0x1A` sub `4` → radar sensitivity
Then `Model` sets `checkStatus` from `H5127ParseUtils.a(bArr)` (`[24]` of the
20-byte frame) and updates `H5127LastDeviceData`.

Status fields:
| field | unit |
|---|---|
| checkStatus | enum/int (presence state) |
| distance | cm/level (BE16) |
| statusDuration | seconds (BE32) |
| installWay | 0/1/2/3 |
| checkDistance | config |
| nhJudgeTime / hhJudgeTime | seconds (BE16) |
| teStart / teEnd | target-exclusion range |
| radarSensitivity | level |
| onlyIdfHuman | bool |
| bleSv/bleHv/wifiSv/wifiHv/wifiMac | version strings |

`H5127IotPush` shows push notifications with the same `H5127LastDeviceData`.

### 5.2 H5121–H5130

No IoT control commands. Events arrive as **push** (`SensorPush`), and the cached
`LastData` is stored in device ext. REST is limited to bind (`device/rest/devices/v1/bind`)
and (H5127) the install-way/notification settings (`h5127/net/INet4H5127`).

---

## 6. Other protocols

- **BLE broadcast**: pairing only. H5121–H5130 name/ID/version offsets in
  `h512x/add/SkuItemClickEvent`; H5127 `0201050c09…`, version 1, protocol 3.
- **Push**: `h512x/push/SensorPush`, `h5127/push/H5127IotPush`.
- **REST**: bind + H5127 `INet4H5127` (`Request4SelectedInstallWay`).
- **LAN/MQTT/Matter**: none in this split.

---

## 7. Dynamic effects / scenes / DIY

Not applicable (sensors). “Modes” are detection settings:

| family | settings |
|---|---|
| H5121 | distance level 0/1/2, interval seconds |
| H5129 | distance level 0/1/2, interval, Li-Sen switch |
| H5130 | pressure threshold 1–10, has-pressure time, no-pressure time, LED display |
| H5127 | check mode, check distance, nh/hh judge times, te range, radar sensitivity, only-idf-human |

---

## 8. Source map

| area | paths |
|---|---|
| H512x registry | `h512x/H512xAppImp.java`, `h512x/Constant512x.java`, `h512x/AbsH512xConfig.java`, `h5121/SupportConfig.java` |
| per-SKU config | `h5121/config/h5121..h5130/*.java` |
| H5121 BLE | `h5121/ble/commV1/*`, `h5121/ble/other/*`, `h5121/ble/BleProtocol.java` |
| H5130 | `h5121/ble/other/{Controller4CurPressure,Controller4PressureThreshold,Controller4HasPressureTime,Controller4NoPressureTime,Controller4LightIsDisplay,Compose4ReadH5130,Compose4WriteH5130}.java` |
| H5127 | `h5127/ble/controller/*`, `h5127/ble/notify/*`, `h5127/utils/H5127ParseUtils.java`, `h5127/pact/*`, `h5127/push/*` |
| common | `h512x/item/*`, `h512x/detail/*`, `h512x/add/*` |

---

## 9. Gaps / unknowns

- The assignment’s “heater/thermostat” guess is wrong; these are sensors.
- Distance levels are firmware thresholds, not documented centimetres. H5121 uses
  45/20, H5129 uses 80/40/20.
- H5121–H5130 event payloads are not in the split (they arrive via push and are
  reduced to `LastData.logType`); the `logType`→event-name mapping is in resources.
- `SupportConfig` only registers pact protocols for goods types **130/206/238**
  (H5121/H5129/H5130). H5122/H5123/H5124/H5125/H5126 have their own goods types in
  their configs but no `Pact.d.a(...)` call in this split, so their pact registration
  happens elsewhere (shared sensor registry). Treat their pactType/pactCode as unknown.
- H5127 heartbeat `checkStatus` semantics and the meaning of frame byte `[24]` are
  not fully named; `H5127LastDeviceData` treats it as an enum.
- H5127 uses a dynamic SKU `H5127_<suffix>` derived from the advert name; the cloud
  product must know that SKU.
- H5129 “Li-Sen” (leave-sensing) is a single boolean; its exact detection semantics
  are firmware-side.
