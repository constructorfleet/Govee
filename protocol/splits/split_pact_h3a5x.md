# split_pact_h3a5x — H3A51 / R3A51 / H3A52 / H3A53 branch light strings

Source root: `decompiled/jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/`

## Overview / family and SKUs

`pact/Support.java` defines one goods-type (386) shared by four SKUs. All extend
`AbsBleWifiSku` → `ble + iot`; `pact/Model extends AbsDeviceModel4BleIot`.

| SKU | default light count | notes |
|---|---|---|
| H3A51 | 32 | `Support.b` |
| R3A51 | 32 | `Support.c` |
| H3A52 | 63 | `Support.d` (32 if unknown) |
| H3A53 | 84 | `Support.e` (32 otherwise) |

- `Support.g`/`h`/`i` = `{386}`.
- `Support.d()`/`g()` protocols: `GoodsType.beProtocol(1,1)`, `(1,2)`, `(1,3)`.
- `Support.getColorSize()` = **1** (one addressable colour per frame; per-IC colours are done
  with bitmasks/segment-IC writes).
- `Support.supportSceneOp(386)` = `{0,1,2,3,5,6}`.
- `Support.isH3A5xPactV3OrAbove(pactType,pactCode)`: pactType≥1 && pactCode≥3.
- Branch topology model: `bean/BranchTopologyOrder`, `BranchBean`, `BranchCaliBean`,
  `SegmentBean`; capabilities in `capability/H3A5XLightCapabilityProvider`.

## Transports & GATT UUIDs

- Service `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/BleComm.java`, `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`
- `Ble.u()` → `BlePtRealMultiComm`; `Ble.v()` → `BleMultiComm`.
- Notify: `WifiNotifyParse` (base2light connect), `BrightnessNotifyParse`,
  `MovieFeastOnOffNotifyParse`, `DeviceStatusNotifyParse`.

## BLE frame + command table

Frame `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`; write 0x33, read 0xAA;
multi V2 uses `AbsMultipleControllerV2` (proType 0xA4, 20-byte packets with a 2-byte
`{cmdType,p()}` header).

`ble/BleProtocol.java`:

| const | dec | hex | use |
|---|---|---|---|
| music sub-mode | 19 | 0x13 | music |
| color sub-mode | 21 | 0x15 | colour |
| scenes sub-mode | 4 | 0x04 | scenes |
| new-DIY sub-mode | 10 | 0x0A | DIY |
| brightness notify | 32 | 0x20 | brightness |
| direction | 22 | 0x16 | direction write/read |
| segment IC multi | 67 | 0x43 | per-segment IC write (multi V2, p=10) |
| enable segment IC | 68 | 0x44 | enable/disable segment write |
| read segment info | 64 | 0x40 | segment topology read |
| segment calibration | 74 | 0x4A | calibration V2 |
| up/down calibration | 75 | 0x4B | branch calibration |

| command | op | payload | response | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `[0]=0|1` | read `0xAA/0x01` | base `SwitchController`; `scenes/H3A5XSceneCmdBuilders$registerWith$3` |
| heartbeat | `0xAA/0x01` | none | `[0]!=0` | base `HeartController` |
| brightness | `0x33/0x04` | `[0]=0..100` | read `0xAA/0x04`; notify `0x20` | base `BrightnessController`; `pact/Comm` |
| mode | `0x33/0x05` | sub-mode block | `0xAA/0x05` | `pact/ModeController`, `pact/Mode` |
| direction | `0x33/0x16` | `[0]=!forward?1:0` | read callback → `[0]==0` = forward | `ble/controller/SettingDirectionController.java` |
| read segment info | `0xAA/0x40` | none | `ble/controller/ReadSegInfoController` | `ReadSegInfoController.java` |
| segment IC write | `0xA4/0x43` | `[0]=enable, [1..]=IC style bytes` (`p()=10`) | `SetSegmentIcMultiController.t` | `SetSegmentIcMultiController.java`, `SetSegmentIc4ModeController.java` |
| enable segment IC | `0x33/0x44` | `[0]=!enable?1:0` | `EnableSetSegmentIc4ModeController` | `EnableSetSegmentIc4ModeController.java` |
| segment calibration | `0x33/0x4A` | branch calibration bytes | `SegCaliControllerV2` | `SegCaliControllerV2.java` |
| up/down calibration | `0x33/0x4B` | calibration action bytes | `UpDownCaliController` | `UpDownCaliController.java` |

`SegmentStyleIcInfo` (read from 0x40): `style`, `totalBranchCount`,
`totalColorSegmentCount`, `branchColorSegmentCounts[]`, `totalIcCount`, `branchIcCounts[]`.

### Colour sub-mode (0x15)

`newdetail/color/SubModeColor.getWriteBytes()` (17-byte payload):

```
[0]=0x15
if per-segment brightness mode (a==true):
  [1]=03 [2..16]=brightness per segment (up to 15 values)
else if per-piece brightness (e!=0):
  [1]=02 [2]=brightness [3..6]=32-bit segment bitmask for segments 0..31 (4 bytes)
else:
  [1]=01 [2..4]=R G B
  if kelvin!=0: [5..6]=kelvin LE16, [7..9]=temp R G B
  [10]=bits0-7 [11]=bits8-15 [12]=bits16-23 [13]=bits24-31 (segment mask)
```

`parse()` reads kelvin from `validBytes[1..2]` (LE16) and derives the temp RGB from
`Support.getColorTemRange(goodsType,pactType,pactCode)`.

## BLE notifications / readings

| notify | parser | layout |
|---|---|---|
| 0x11 | base `WifiNotifyParse` | `[0]==0` connected |
| 0x20 | `ble/notify/BrightnessNotifyParse` | `[0]` brightness |
| 0x40 | base `DeviceStatusNotifyParse` | first 10 bytes → EventDeviceStatus |
| 0x60 | base `MovieFeastOnOffNotifyParse` | `[0]==1 [1]==1` on |
| 0x01 | base switch/heart | `[0]!=0` |

## IoT commands + status/readings schema

`pact/Comm` uses base2light IoT classes (`CmdTurn`, `CmdBrightness(brightness,0,2)`,
`CmdColorWc`), envelope `CmdBuilder.makeCmdStr`, `IotMsgProType.V2` for responses.

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0|1}` | `com/govee/base2light/kt/iot/CmdTurn` |
| `brightness` | `{"val":0..100}` | `com/govee/base2light/kt/iot/CmdBrightness` |
| `colorwc` | `{"color":{r,g,b},"colorTemInKelvin":int}` | `com/govee/base2light/iot/CmdColorWc` |
| `status` | `state` on/off, `op` frame bytes | `H3A5XSceneCmdBuilders$registerWith$6` |

Switch builder (`H3A5XSceneCmdBuilders$registerWith$6`) parses `IotMsgV2`, matches
`transaction`, success when `cmd=="status"`.

## Other protocols

- WiFi/cloud IoT via device topic (MQTT, base IoT manager). No LAN/UDP/Matter.
- `ptUrl` path used by graffiti: `H3A5XDiyAdvancedGraffitiParse` builds
  `PtUrlDataInfo(sku, device, base64({88,0}+payload), pactType, pactCode, softVersion, hardVersion)`.

## Dynamic effects / motion / music / scenes / DIY

- **DIY/graffiti codes** (`newdetail/diy`):
  - base DIY `H3A5XDiyParse.getProtocolCode()=88 (0x58)`, code **950**.
  - advanced graffiti `H3A5XDiyAdvancedGraffitiParse`: code **953/954/955** (`e`,`f`,`g`),
    selected by region/branch count (`H3A5XGraffitiDiyEffectCode.a(i)`), protocol prefix 0x58.
  - advanced overlay `H3A5XDiyAdvancedOverlayParse`: code **973**, prefix 0x58.
  - `DiyControllerNoEventV7(DiySendData(254, toBytes(), protocolCode))`; final mode frame
    `0A <diy LE16>` with diy code 254 (0xFE) marker.
- **Effect types** (`newdetail/diy/effect/EffectTypeH3A5X.java`) — exact byte ids:
  Fade 1, Breathing 2, Flickering 3, Rainbow 4, Water 5, RunningLantern 6, Diffusion 7,
  Flow 8, Fireworks 9, Collision 10, Yuedong 11, AdvancedBreathing 34, JiaoCuo 35.
- `SubEffectType`: None 0, First 1, Second 2, Third 3, Fourth 4.
- `Region`: Up 1, Down 2. `ColorType`: UNIFY 0, PARTITION 1.
  `ApplicationType`: Same/Diff/None. `Direction`: Clockwise/Counterclockwise/Left/Right/
  CONGREGATE/DISPERSE/None. `InterlaceDirection`: Left; `InterlacePositionToggle`: Off/On.
- **Graffiti page byte layout** (`bean/GraffitiDataH3A5XKt.d`):
  `layerPriority, secondaryEffectCode, layerSpeed(0..max), layerBrightness(0..max),
   colorGroupCount, {icCount, R,G,B, icIndex*}, baseColorGroupCount, {branchCount,R,G,B, branchIndex*}`.
  `GraffitiDataH3A5X.toPayloadBytes()` = `displayMode, totalPages, {pageIndex, len LE16, pageBytes}*`.
  Full payload prefixed `0x82` (`BleProtocol.f`) then sent as multi-packet; overlay uses
  `MultiController` code 98 (0x62).
- **Scenes**: `Support.supportSceneOp(386)` = `{0,1,2,3,5,6}`; scene frames via
  `ScenesOp.parseSceneV1` / `parseEffect`, then `0x04 <effect LE16>` final mode frame.
- **Music**: `pact/MusicFeastOp` registers DIY music support; music sub-mode 0x13.
- **Branch/IC model**: `H3A5XGraffitiBranchColorMaps`, `BranchCaliBean`, `SegmentBean`;
  segment-IC write enables per-IC colour on branch topology.

## Source map

- `pact/Support.java`, `SubLib.java`, `SubMaker.java`, `Comm.java`, `Mode.java`,
  `ModeController.java`, `Model.java`, `MusicFeastOp.java`
- `ble/Ble*.java`, `BleProtocol.java`, `notify/BrightnessNotifyParse.java`,
  `controller/{ReadSegInfoController,SetSegmentIcMultiController,SetSegmentIc4ModeController,EnableSetSegmentIc4ModeController,SegCaliControllerV2,UpDownCaliController,SettingDirectionController,SegmentStyleIcInfo}.java`
- `scenes/H3A5XSceneCmdBuilders*.java`, `scenes/AbsBleV1.java`, `scenes/AbsIotV1.java`
- `newdetail/color/SubModeColor.java`, `newdetail/diy/*`, `newdetail/diy/effect/*`
- `bean/Graffiti*.java`, `bean/ColorGroup*.java`, `bean/Branch*.java`, `bean/SegmentBean.java`
- base: `com/govee/base2light/ble/controller/AbsMultipleControllerV2`,
  `com/govee/base2light/kt/general_controller/MultiController`

## Gaps / unknowns

- Graffiti effect payload bodies are serialised from UI state (`GraffitiDataH3A5X`) — resolved
  only at apply time; the per-effect parameter objects (`EffectFlow`, `EffectFireworks`, ...)
  encode their own byte strings, not fully decoded here.
- `ReadSegInfoController` reply layout is parsed by `SegmentStyleIcInfo` construction but the
  exact per-byte offsets are inside the controller's `parseValidBytes` (topology is
  device-reported).
- `UpDownCaliController` / `SegCaliControllerV2` enum `CaliAction` / `SubsequentBranchType`
  are only partially restored by jadx.
- `H3A5XScrawlGraffitiConfig` / overlay combination mapper (`H3A5XOverlayCombExtMapper`) has
  server/cache-driven layer limits (`H3A5XOverlayEffectBytesFactory.c`).
- Brightness scaling for h3a5x is not overridden → raw 0..100.
