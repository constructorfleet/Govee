# split_pact_h6092 — H6092 / H6091 / H6093 / H6094 / H6095 / H609D / H7070 / H7071 / H7073 / R1810 / H1811 / H3860 / H1880

Source root: `decompiled/jadx-splits/split_pact_h6092/sources/com/govee/h6092/`

## Overview / family and SKUs

This split is a shared "new light" module with 13 goods-types and 13 `*Maker` SKU items
(`pact/SubMaker.java`). Every item extends `AbsBleWifiSku` → `ble+iot`.

| SKU | goodsType | maker | color pieces | notes |
|---|---|---|---|---|
| H6092 | 167 | `H6092Maker` | 14 | supportApplyOpSet {0,1,2,3,5,11} |
| H6093 | 271 | `H6093Maker` | 14 | `MultiPresetScenesH6093Controller`, music code scene |
| H7070 | 283 | `H7070Maker` | 14 | scene via `makeSceneCmd4IotCommH7070` |
| H6095 | 323 | `H6095Maker` | 7 | |
| H6094 | 322 | `H6094Maker` | 1 | |
| H609D | 331 | `H609DMaker` | 14 | operate mode 0x43 |
| H7073 | 333 | `H7073Maker` | 14 | `supportEffectChange` always true |
| H7071 | 334 | `H7071Maker` | 14 | no effect change |
| R1810 | 340 | `R1810Maker` | 3 | segment color mode / stack DIY |
| H6091 | 101 | `H6091Maker` | 14 | music sub-mode 0x0F |
| H1811 | 399 | `H1811Maker` | 14 | flow direction support |
| H3860 | 401 | `H3860Maker` | 14 | |
| H1880 | 402 | `H1880Maker` | 14 | on/off memory |

`Support.x` = keys list `{167,271,283,323,322,331,333,334,340,101,399,401,402}`;
`Support.y` (effect-op set) omits 101 and 334: `{167,271,283,323,322,333,331,340,401,402}`.
Pact registration (`Support.addSupportPact`) uses `GoodsType.beProtocol(1,1)` for most,
`(1,1)+(1,2)+(2,1)` for 167/271/283, `(1,1)+(2,1)` for 334, `(1,1)+(1,2)` for 399.

Transport: `ble` + `iot` (cloud topic). `pact/DeviceItem extends AbsBleIotItem`,
`pact/Model extends AbsDeviceModel4BleIot`.

## Transports & GATT UUIDs

- Service `00010203-0405-0607-0809-0a0b0c0d1910`
- Characteristic `00010203-0405-0607-0809-0a0b0c0d2b11`
- `ble/BleComm.java`, `ble/BleMultiComm.java`, `ble/BleNotifyComm.java`.
- Heart: `HeartControllerNoEvent` (`BleComm.l()`).
- Multi: `Ble.v()` → `BleMultiComm extends AbsMultipleBleComm`; `Ble.u()` → `BlePtRealMultiComm`.

## BLE frame + command table

Frame: `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`. Single write `0x33`, single read
`0xAA`; multi-controller V1/V2 `proType 0xA3` (`AbsMultipleControllerV1.getProType`).

`ble/BleProtocol.java`:

| const | dec | hex |
|---|---|---|
| sub_mode_scenes | 4 | 0x04 |
| MSG_TYPE_READ_GRADUAL | 5 | 0x05 |
| SINGLE_SET_AUTO_OFF_H6093 | 5 | 0x05 |
| SINGLE_SET_LIGHT_SWITCH_H6093 | 1 | 0x01 |
| SINGLE_SET_PAIR_STATUS_SWITCH_H6093 | 2 | 0x02 |
| SINGLE_SET_PAIR_VOICE_SWITCH_H6093 | 3 | 0x03 |
| SINGLE_SET_DISTURBANCE_SWITCH_H6093 | 4 | 0x04 |
| SINGLE_SET_FEAST_LASER_SWITCH_H6093 | 7 | 0x07 |
| sub_mode_new_diy | 10 | 0x0A |
| sub_mode_operate_V2 | 12 | 0x0C |
| sub_mode_music_h6091 | 15 | 0x0F |
| sub_mode_color / color_v2 | 21 | 0x15 |
| sub_mode_operate | 32 | 0x20 |
| notify_brightness | 32 | 0x20 |
| notify_auto_off | 36 | 0x24 |
| controller_type_preview_effect | 39 | 0x27 |
| SINGLE_SET_CHILDREN_SWITCH_H6093 | 48 | 0x30 |
| controller_type_play_pause_voice | 49 | 0x31 |
| music_info_notify / sleep_info_notify_h6092 | 49 | 0x31 |
| controller_type_voice_volume | 50 | 0x32 |
| sleep_info_notify | 50 | 0x32 |
| GET_NECESSARY_INFO / lamp_effect_change | 66 | 0x42 |
| GET_OPERATE_INFO | 67 | 0x43 |
| FEAST_PATTER_SWITCH | 69 | 0x45 |
| EXIT_REMOTE_CONTROL_PAIR | -90 | 0xA6 |
| MSG_TYPE_READ_BULB_COLOR | -91 | 0xA5 |
| REMOTE_CONTROL_PAIR | -92 | 0xA4 |
| SINGLE_GRADUAL_CHANGE_4_WIFI_BLE | -93 | 0xA3 |

Music ids (`value_sub_mode_music_*`): energy 0x00, impact 0x06, jet 0x07, jump 0x08,
joy 0x33 (51), rhythm 0x72 (114); rhythm dynamic 0, rhythm soft 1.

Derived commands:

| command | op | payload | response | source |
|---|---|---|---|---|
| power | `0x33/0x01` | `[0]=0|1` | read `0xAA/0x01` | base `SwitchController`; `scenes/BleSwitchCmdBuilderV1.java` |
| heartbeat | `0xAA/0x01` | none | `[0]!=0` (no event) | base `HeartControllerNoEvent`; `BleComm.l()` |
| brightness | `0x33/0x04` | `[0]=0..100` (scaled by `Support.getBrightnessRange()` {1,100,0}) | read `0xAA/0x04` | base `BrightnessController`; `pact/Comm.makeBrightnessController4BleComm` |
| mode | `0x33/0x05` | sub-mode block | read `0xAA/0x05` | `ble/ModeController.java`, `ble/Mode.java` |
| DIY multi | `0xA3/0x56` | multi-packet V1; payload `[0]=diyCode, [1..]=bytes`; first byte 33→11 rewritten | event | `controller/MultipleOperateController.java` |
| DIY multi H6093 | `0xA3/0x58` | multi-packet V1 | event | `controller/MultipleOperateControllerH6093.java` |
| H609D operate | `0x33|0xAA/0x43` | `H609DSubModeOperate` bytes | parse `H609DSubModeOperate` | `controller/H609dOperateModeController.java` |
| auto-off read | `0xAA/0x24` | none | `AutoOffInfo.parse` | `ble/AutoOffNotifyParse.java` |
| child switch notify | `0xEE/0x30` | raw `[0]`=?, `[1]`=switch | event | `ble/DeviceStatusNotifyParse.java` |

Note: `pact/Comm.makeColorController4BleComm(...)` returns **null**; this family does not send a
standalone colour frame over BLE. Colour is applied through scenes/presets/DIY ptReal frames.

### Sub-mode payloads

Scenes (`ble/SubModeScenes.java`, id 0x04):

```
[0]=04 [1]=effectLo [2]=effectHi [3]=musicCodeLo [4]=musicCodeHi
```

`[3..4]` are zero when music is disabled (`c=false`); parse reads effect LE16 and music code LE16.

New DIY (`ble/SubModeNewDiy.java`, id 0x0A): `[0]=0A [1]=diyLo [2]=diyHi [3]=secondLo [4]=secondHi`
(second code is an extra DIY/high-colour code; `IHighColorDiy`).

Operate (`Mode.parseSubMode` id 0x20 → base `SubModeOperate`, id 0x0C → `sub_mode_operate_V2`;
operate types 1/2).

## BLE notifications / readings

| notify cmdType | parser | layout |
|---|---|---|
| 0x11 (17) | `ble/WifiNotifyParse` | `[0]==0` connected |
| 0x20 (32) | `ble/BrightnessNotifyParse` | `[0]` brightness |
| 0x24 (36) | `ble/AutoOffNotifyParse` | `AutoOffInfo.parse(bArr)` |
| 0x30 (48) | `ble/DeviceStatusNotifyParse` | `[0]` seq/type, `[1]==1` child switch |
| 0x31 (49) | base `MusicNotifyParse` (`Support.a` sku H6092) | music info |
| 0x32 (50) | sleep info notify (H6093) | sleep state |
| 0x27 (39) | preview effect | event |

## IoT commands + status/readings schema

`iot/Cmd.java`: `state`, `op`, `online`, `turn`, `brightness`, `status`, `colorwc`, `ptReal`,
`pt`. `Cmd.getCmdReadParseKey(cmd)` = `"op"` when cmd is `ptReal`, otherwise `"state"`.

| cmd | data | source |
|---|---|---|
| `turn` | `{"val":0|1}` | `iot/CmdTurn.java` |
| `brightness` | `{"val":0..100}` (scaled via `NumUtil.calculateProgress` when range[2]==1) | `iot/CmdBrightness.java`; `pact/Comm` |
| `colorwc` | `{"color":{red,green,blue},"colorTemInKelvin":int}` | `iot/CmdColorWc.java` |
| `ptReal` | `{"command":["<base64 20-byte frame>"]}` | `iot/CmdPtReal.java` |
| `pt` | raw passthrough | `iot/Cmd.java` |
| `status` | event status; `op` carries device frames | `iot/OpScene*`, `OpDiy*` |

`CmdPtReal` entry points:
- `getDiyOperateCmdPtReal(AbsMultipleControllerV14Diy, int)` – multi DIY frames.
- `getH6093DiyCmdPt(DiySendData)` – H6093 DIY.
- `getNewScenesCmdPtReal(AbsMultipleControllerV14Scenes)` – scene frames.
- `getNewScenesH6093CmdPtReal(scenes, Mode)` – H6093 scene + music-code frame.
- `getDiyCmdPt4DiyGraffiti*`, `getDiyCmdPt4DiyStudio`, `addCommand` (prepend frame).

`IotSwitchCmdBuilderV1` parses `IotMsgV2`, matches transaction and returns true when
`cmd=="status"`.

## Other protocols

- WiFi/cloud: topic from device ext, MQTT through base `Iot` manager. No LAN/Matter code.
- BLE frames reused as `ptReal` base64.

## Dynamic effects / motion / music / scenes / DIY

- **Scene dispatch** (`pact/Comm.makeSceneCmd4IotComm(str, goodsType, device, effectId)`):
  - goodsType 271 → `makeSceneCmd4IotCommH6093` (`SubModeScenes` + `LocalSoundM` music code;
    final frame from `MultiPresetScenesH6093Controller`).
  - goodsType 283/333 → `makeSceneCmd4IotCommH7070` (`MultiPresetScenesH6093Controller`).
  - else → `SubModeScenes` with `ScenesM.p.p(sku, effectId)` music switch/code; then
    `Support.is2NewScenesMode` → `ScenesOp.parseSceneV1(str, scene, {1,2,5,11})` +
    `setMusicCode`/`setMusicSwitch`.
- **Preset scenes** (`pact/MultiPresetScenesController`): takes the scene's `scenesParam`
  base64; strips 3 bytes; `getCommandType()` = 5 normally, 6 when `param[1]==123 (0x7B)`;
  `r()` timeout 100 ms.
- **H6093 preset** (`MultiPresetScenesH6093Controller`): same, command type selected from
  scene param; uses `CommonDiyParseConfig.getSceneControl`.
- **Scene channels** (`Support.supportScenesOpSet`): 271→{5,10}; 283/333/323/322/340/399→{5,0};
  402→{0,5}; default {0,1,2,3,5}.
- **DIY modes**: `DiyModeComposeController(DiySendData, byte)` =
  `DiyControllerNoEventV7(diySendData, protocolCode)` + `ModeControllerNoEvent(SubModeNewDiy(diyCode))`;
  emits `DiyModeControllerEvent(diyCode, success, version)`.
- **Music** (H6091 sub-mode 0x0F; general music notify 0x31): effect ids above; music info
  notifications via base `MusicNotifyParse`. H6092 music scene code is sent inside the scene
  frame bytes [3..4].
- **H609D operate/DIY**: `H609dOperateModeController` (cmdType 0x43) reads/writes
  `H609DSubModeOperate`; used by `newDetail/h609d/diy`.
- **H7071 layered DIY** (`newDetail/h7071/diy/*`): layers (`Layer.java`), effects
  `GuDing4TuAnPian` (fixed image), `XunHuan4TuAnPian` (loop), `SuiJi4TuAnPian` (random),
  `ShuiBoWen` (water ripple); `Pro4H7071Diy` serialises to `H7071DiyParse` bytes.
- **R1810** segment colour (`ColorModeSegmentR1810`), stack/advanced DIY
  (`R1810StackEffectUI`, `R1810AdvanceActionEffectUI`), 3 segments.
- **H1811** flow direction support when pactType==1 and version≥2.
- **H1880** on/off memory (`Support.supportMemory`).

## Source map

- `pact/Support.java`, `SubLib.java`, `SubMaker.java`, `*Maker.java`, `Comm.java`, `DeviceItem.java`,
  `Model.java`, `BleIotExt.java`, `OnlineMusicConfig*.java`, `bleiot/AbsEffectOp4BleIot.java`,
  `bleiot/EffectOp4BleIot.java`
- `ble/Ble*.java`, `BleProtocol.java`, `Mode.java`, `SubModeScenes.java`, `SubModeNewDiy.java`,
  `DiyModeComposeController.java`, notify parsers
- `controller/MultiPresetScenesController.java`, `MultiPresetScenesH6093Controller.java`,
  `MultipleOperateController.java`, `MultipleOperateControllerH6093.java`,
  `H609dOperateModeController.java`, `AutoOffInfo.java`
- `iot/*.java`
- `scenes/*.java`
- `newDetail/h3860`, `h6091`, `h7071`, `r1810`, `h609d` DIY/scene UIs

## Gaps / unknowns

- `Comm.makeColorController4BleComm` / `makeColorStrip*` return null: no standalone BLE colour
  path; colour only via scene/preset/DIY ptReal blobs.
- Preset scene payloads (`scenesParam`) are server blobs; only the 3-byte strip and the
  `0x7B` command-type switch are static.
- `H609DSubModeOperate` field semantics are not decoded (binary sub-mode blob).
- Music code for scenes comes from `LocalSoundM` (server/local sound library) — runtime.
- `Support.getBrightnessRange()` {1,100,0} means no linear rescale for this family.
- `Cmd.getCmdReadParseKey` only special-cases `ptReal`; other reads expect `state`.
