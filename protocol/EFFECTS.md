# Dynamic effect catalog

LED/motion/dynamic-effect writes. These are the sub-mode payloads carried inside the generic `0x05` mode command (BLE) or the equivalent IoT mode/DIY/scene commands. Effect IDs and scene/music catalogues are often server-supplied at runtime; where that is the case the row gives the exact selector layout and says so.

## split_pact_bbqnew

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| preset environment temperature | `0x11` | `probeId highLE16 lowLE16 foodType subTypeLE16` | ["probe 1-6","ambient high/low -10..100 C x100","food type","sub type"] | `PresetEnvTempController` |
| preset probe target | `0x12` | `target` | ["probe target code"] | `Controller4PresetFtTem` |
| cook timer | `0x13` | `timer bean` | ["group","duration","target temp","scene"] | `TimerTaskInfo; TimerTaskSetActivity` |

## split_pact_bulblightstringv1

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| bulbstring-scene-simple | `0x09` | `09 <effect+1>` | ["effect 0..7"] | `com/govee/bulblightstringv1/ble/SubModeScenes.java; com/govee/bulblightstringv1/ble/Scenes4BleRhythm.java` |
| bulbstring-scene-multisegment | `0x09 + 0xA1/0x01` | `A1 01 00 <count> 00 \| A1 01 <idx> <16B> \| A1 01 FF; block = [effect+1][effect][00][speed][colorLen][R G B ...]` | ["speed 0..100","colors 1..N","default 4 colors red/blue/yellow/green, white for effect 6"] | `com/govee/bulblightstringv1/pact/Comm.java; MultipleScenesController.java; ScenesConfig.java` |
| h7022-scene-multisegment | `0xA1/0x01` | `[code][effectType=code-1][subEffectType][speed][colorLen][R G B ...]` | ["code 1-based","speed 0..100","colors 1..N"] | `com/govee/h7022/adjust/mode/H7022ScenesConfig.java; com/govee/h7022/ble/ScenesModeController.java` |
| bulbstring-music | `0x0E` | `0E <auto> <sens> <flag> [R G B]` | ["auto 0\|1","sensitivity 0..99","RGB when manual"] | `com/govee/bulblightstringv1/ble/SubModeMusic.java` |
| h7022-music | `0x01` | `01 <effect> <sensitivity>` | ["effect 5=Dynamic, 4=Mild","sensitivity 0..99"] | `com/govee/h7022/adjust/mode/SubModeMusic.java` |
| mic-mode | `0x05` | `05 01` | ["enter mic mode"] | `com/govee/bulblightstringv1/bulblightv2/ble/SubModeMic.java` |
| mic-rhythm-point | `0x05` | `05 00 R G B` | ["one beat color"] | `com/govee/bulblightstringv1/bulblightv2/ble/MicController.java` |
| classic-diy | `0xA1/0x02` | `[diyCode][effect][subEff][speed][colorLen][R G B ...][subEffCount][pairs]` | ["speed 0..100","colors 1..N","composite when effect=255"] | `base:com/govee/base2light/ble/controller/AbsMultipleController4Diy.java` |
| diy-v1 | `0xA3/0x04` | `DiyProtocol.toBytes() in 0xA3 V1 frames` | ["diy code","effect/sub-effect","speed","colors"] | `base:com/govee/base2light/ble/controller/AbsMultipleControllerV14Diy.java; MultipleControllerCommV1.java` |
| h601ef-advanced-diy | `0xA3/0x58` | `[totalLen LE16][mainLen LE16][01 04 speed count RGB...][subLen LE16][01 type body]` | ["speed 0..100","sub types 1 colour-tem, 2/3/4 speed-colour, 7 streamer, 8 bg-colour, 10 duiji, 11 breathe, 14 speed-colour","kelvin 2700..6500"] | `com/govee/bulblightv3/newdetail/diy/H601EFDiyParse.java; subEffect/*` |
| h601ef-segment-color | `0x15 / 0xA3/0x6E` | `15 04 <segmentIndex> R G B (x4); 15 05 <count> RGB... <mask>` | ["color piece size 7","4 colors per group"] | `base:com/govee/base2light/pact/newdetail/config/fuc/color/Bytes.java; ColorModeControllerConfig.java` |
| bulblightv3-scene-h6008 | `0x04` | `04 <idLo> <idHi>` | ["effect ids 123,124,106,100,121,122,109,1136,153,154,155,156,52,68,13,1137,130,2,107,142,143,163,139,146,1131,1171,1132,1133,1134,1172"] | `com/govee/bulblightv3/adjust/v3/ScenesV3.java` |
| bulblightv3-scene-h601a | `0x04` | `04 <idLo> <idHi>` | ["effect ids 2657..2720 (gaps 2665,2716,2717)"] | `com/govee/bulblightv3/adjust/v3/ScenesV3H601A.java` |
| h6001-scene | `0x04` | `04 <id>` | ["old: 0 gm,1 sunset,7 romantic,10 breath,11 dazzling,12 lively,13 reading,14 relax","updated: {13,17,10,7,9,20,16,25}"] | `com/govee/bulblightstringv1/h6001/ble/BleProtocol.java; ScenesV0.java; com/govee/bulblightstringv1/bulblightv2/ble/BleProtocol.java` |
| solar-diy-h3210 | `diy-code 984` | `<effect> <speed 1..100> <colorLen> R G B ... <bg RGB>` | ["effect code 984","share code 0x50"] | `com/govee/bulblightv3/solar/diy/H3210DiyParse.java` |
| solar-diy-h3520 | `diy-code 985` | `<effect> <speed 0..100> <flag> <count 1..8> R G B ...` | ["effect code 985","share code 0x50"] | `com/govee/bulblightv3/solar/diy/H3520DiyParse.java` |

## split_pact_fanlight

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| fan_wind_mode | `0x31/0x03` | `31 03 01 00 <mode> [auto6]` | ["mode 0 direct","1 sleep","2 natural","3 auto","auto program on/keep gear + degF*100"] | `ble/ControllerFan.java + h1370/FanAutoProgram.java` |
| fan_gear | `0x31/0x01` | `31 01 <gear>` | ["1..6 H1310","1..12 H1370"] | `ble/ControllerFan.java + Support.d` |
| fan_reverse | `0x31/0x02` | `31 02 <0/1>` | ["direction"] | `ble/ControllerFan.java` |
| fan_shake | `0x31/0x04` | `31 04 <0/1>` | ["oscillation","H1370 only"] | `ble/ControllerFan.java` |
| scene | `0x05/0x04` | `05 04 <effLo> <effHi>` | ["16-bit LE effect id","groups 0,1,2,3,5 H1310 / 0,1,2,3,6,5 H1370"] | `ScenesOp + Support.l` |
| diy | `0x05/0x0A` | `05 0A <diyLo> <diyHi>` | ["16-bit LE DIY code","H1310 main effects 1-4 / sub effects 1-9","H1370 effect types 1-7,8,9,10,11"] | `h1310/diy/Pro4H1310Diy.java, h1370/diy/H1370DiyNewConfig.java` |
| music | `0x05/0x13` | `05 13 <musicCode> <sensitivity>` | ["sensitivity 0..99","mic/online music"] | `base2light music sub-mode` |
| color_ring | `0x05/0x15` | `15 <subtype ...>` | ["9 segments H1310","14 segments H1370","segment bitmask 32-bit","CT big-endian","per-segment color groups"] | `capability/FanlightLightCapabilitySpecKt.java` |
| auto_program | `0x32 read / 0x31 write` | `AA 32 01 / 31 03 01 00 03 <onGear,onTempHi,onTempLo,keepGear,keepTempHi,keepTempLo>` | ["temperature degF*100","gear clamp to SKU max"] | `h1370/FanAutoProgram.java` |

## split_pact_floorlamp

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| color_0x0D | `0x05/0x0D` | `0D R G B CT_H CT_L R2 G2 B2` | ["RGB","CT big-endian","temperature RGB"] | `h60b0/ble/SubModeColor.java` |
| color_0x15 | `0x05/0x15` | `15 <subtype>` | ["subtype 1 RGB+CT+32-bit mask","subtype 2 brightness+mask","subtype 3 brightness values","subtype 4 strip groups"] | `h60b1/ble/SubModeColor.java` |
| scene | `0x05/0x04` | `04 <effLo> <effHi> [music 4B] [speed]` | ["16-bit LE effect","H60B1 32-bit music code + direction/speed"] | `h60b0/ble/SubModeScenes.java; h60b1/ble/SubModeScenes.java` |
| advanced_scene | `0xA3/0x5B` | `A3 pkt 01 total 5B <param> + 05 04 <code>` | ["multi-packet V1","97-byte chunks","scene param blob"] | `h60b0/pact/Comm.java` |
| music | `0x05/0x13` | `13 <musicCode> <sensitivity>` | ["sensitivity 0-99","mic/online music"] | `h60b0/ble/SubModeMusic.java; h60b1/ble/SubModeMusic.java` |
| diy | `0x05/0x0A` | `0A <codeLo> <codeHi> [code2]` | ["16-bit LE codes","0x50 blob upload","H60B3 upper 1-7 / lower 1-3 / ceiling 1-13"] | `h60b0/adjust/h60b0/diy/*; h60b1/diy/*` |
| operate_zone | `0x05/0x2C` | `read: ctTop int16 LE, brightTop, ctBottom int16 LE, brightBottom` | ["8 top + 1 bottom piece","independent zone CT/brightness"] | `h60b0/adjust/h60b0/operate/SubMode4Operate.java` |
| interaction | `0x05/0x14` | `base SubMode4HuDong` | ["gesture/clap interaction"] | `base2light/pact/newdetail/sub/SubMode4HuDong.java` |

## split_pact_h1161

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| music mode | `0x0F` | `0F effect sensitivity enable colorful? R G B` | ["effect 4 rhythm (also 48 rhythm,49 bloom,50 bright-drill,51 wave,52 beat,53 spectrum,54 rolling)","sensitivity 0-99","fixed RGB when colorful?==0"] | `pickupbox/ble/SubModeMusic.java` |
| color mode | `0x14` | `14 <shared SubMode4Color bytes>` | ["per-segment RGB + brightness","shared framework"] | `pickupbox/ble/BleProtocol.java; base SubMode4Color` |
| per-device color | `0x14` | `shared multi-color frame per mark` | ["slot/mark 0..4","color list from DeviceInfoWithColor"] | `H1161NewInfo4Detail.java; H1161DelegateColorV2Part.java` |
| music multi | `0x41` | `MultipleController4Music blocks` | ["sensitivity","effect","color bytes"] | `H1161NewMusicMode.java` |

## split_pact_h3a5x

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| color | `0x15` | `15 01 R G B [kelvinLE16 R2 G2 B2] <32-bit segment mask> \| 15 02 brightness <mask> \| 15 03 <per-segment brightness>` | ["RGB","kelvin","per-segment bitmask 0-31","per-segment brightness"] | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/newdetail/color/SubModeColor.java` |
| scenes | `0x04` | `04 <effect LE16>` | ["effect id","channels 0/1/2/3/5/6"] | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/pact/Comm.java` |
| new_diy | `0x0A` | `0A <diy LE16>` | ["diy code 950/953/954/955/973","prefix 0x62 or 0x82"] | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/newdetail/diy/*` |
| music | `0x13` | `music effect params` | ["music feast registration"] | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/pact/MusicFeastOp.java` |
| graffiti_page | `0x0A` | `displayMode totalPages {pageIndex lenLE16 layerPriority secondaryEffect speed brightness colorGroupCount {icCount RGB icIndices} baseColorGroupCount {...}}` | ["layers","per-IC colours","branch base colours","0x82 prefix"] | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/bean/GraffitiDataH3A5X.java, GraffitiDataH3A5XKt.java` |
| effect_types | `0x0A` | `effect byte id in DIY payload` | ["Fade 1","Breathing 2","Flickering 3","Rainbow 4","Water 5","RunningLantern 6","Diffusion 7","Flow 8","Fireworks 9","Collision 10","Yuedong 11","AdvancedBreathing 34","JiaoCuo 35"] | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/newdetail/diy/effect/EffectTypeH3A5X.java` |

## split_pact_h5901

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| irrigation_plan | `` | `sync plan request / plan id list; BLE cmdType 0x14 pause, 0x15 enable, 0x16 delete, 0x19 sync link, 0x70 forward` | ["stages","durations","time ranges","smart enable"] | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/bean/IrrigationPlanInfo.java, StageRule.java, TaskTimeRange.java` |
| water_chart | `` | `chart step1 0x02, step2 0x01 with start/end LE32, step3 0x03` | ["chart range","upload data"] | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/ReadChartStep2Controller.java` |
| next_irrigation | `` | `LastDataDTO protobuf` | ["next time","next duration","percentage","duration","volume","last time"] | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/proto/H5901Proto.java` |

## split_pact_h6047

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| color | `0x15` | `15 01 R G B [kelvinLo kelvinHi R2 G2 B2] <selected-segment bitmask> or 15 02 group <bitmask>` | ["rgb","color temperature LE16","background color","per-segment bitmask (10/12/22/24)"] | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/SubModeColor.java` |
| scenes | `0x04` | `04 <effect LE16>` | ["effect id (default 22)","multi-packet scene from ScenesOp.parseSceneV1"] | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/SubModeScenes.java` |
| new_diy | `0x0A` | `0A <diyCode LE16>` | ["diy code"] | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/SubModeNewDiy.java` |
| music | `0x13` | `13 <sensitivity> <effectId> [rhythmFlag] <colorFlag> <inverseFlag>` | ["sensitivity 0-99","effect ids 49/75/80/81/101/102/103/104"] | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/SubModeMusic.java` |
| video_music_visual | `0x00` | `00 <on> <speed 1-100> <effectMode> <allPart> <sensitivity 0-99> <extra>` | ["speed","sensitivity","all/part"] | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/SubModeVideo.java` |
| color_strip_multi | `0x05 + 0x15` | `multiple 0xA3 V1 frames, one 0x15 color frame per color/brightness group, optional final full-color frame` | ["segment grouping by color","segment grouping by brightness","no-color-mode skips final color frame"] | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/pact/Comm.java, iot/CmdPtReal.java` |
| scene_share | `0x04` | `multi-packet scene frames + final 04 <effect LE16>` | ["parseVersion 0/1/2/3/6","channels 199/401/402"] | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/pact/OpSceneCommDialog4BleIotV1.java` |

## split_pact_h604a

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| color | `0x15` | `15 <01\|02\|03> ...` | ["RGB","Kelvin 2200-6500","24-bit segment mask (24 bulbs) / 14-bulb groups"] | `ble/SubModeColor.java` |
| music | `0x13` | `13 <code> <sens> <auto> [R G B]` | ["64 Rhythm","65 Wind Sound","66 Hooray","67 Sprouting","72 Hopping","80 Torch","82 Expansion","83 Flowing Light","sens 0..99"] | `ble/SubModeMusic.java` |
| video | `0x00` | `00 <enable> <vividness> <mode> <dynamic> <saturation> <param>` | ["vividness 1..100","saturation 0..99","screen colour extraction"] | `ble/SubModeVideo.java` |
| scene | `0x04` | `04 <effect LE16>` | ["V1 {1,6}","V2 {0,1,2,3}"] | `ble/SubModeScenes.java` |
| diy | `0x0A` | `0A <diy LE16>` | ["H604B/D codes 345-349","H604A/C RGBIC-v2 share-code 0x00 effects and templates 3/4/5/6/7/8/9/10/11/15/16"] | `newdiy/DiyConfigH604A.java; newdiy/DiyConfigH604BD.java; newdiy/h604b/*` |

## split_pact_h6061

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| solid/segmented colour | `0x15` | `15 01 R G B [k] m0..m4 \| 15 02 B m0..m4` | ["segments 23/25/21/20/140/40","mask per 8 segments","kelvin"] | `cubelight/ble/SubModeColor.java` |
| all brightness | `0x15/03` | `15 03 group B0..B13` | ["max 14 values per packet"] | `cubelight/ble/SubModeColor.java` |
| all colour | `0x15/04` | `15 04 group R0G0B0..R3G3B3` | ["max 4 colours per packet"] | `cubelight/ble/SubModeColor.java` |
| scene | `0x04` | `04 <eff LE16> <dir> [x/y or focus4] <speed>` | ["effect id cloud catalog","defaults 2229/2560","direction codes","speed 0..100"] | `cubelight/ble/SubModeScenes.java, h6067/ble/SubModeScenes.java, cubelight/adjust/ui/ScenesV0/V1` |
| new DIY | `0x0A` | `0A <diyCode LE16> + multi-pixel 0xA3` | ["grid 23/25/21/20/140/40"] | `cubelight/ble/SubModeNewDiy.java, iot/CmdPtReal.java` |
| music legacy | `0x13` | `13 code 00` | ["codes 51/53/56/57/58/59"] | `cubelight/ble/SubModeMusic.java` |
| music V3 | `0x13` | `13 code sens [flags RGB]` | ["codes 3/4/5/6/56","sens 0..99"] | `cubelight/ble/SubModeMusicV3.java` |
| music V4 (H606A) | `0x13` | `placeholder 13 00 00; multi frames carry effect` | ["effects 117..123","direction -16..13","traversal 0..5"] | `cubelight/ble/SubModeMusicV4.java, newdetails/music/H606ACubeMusicMode` |
| shape/panel map | `0x31` | `[count][type][x LE16][y LE16][angle LE16]...` | ["panel type","position","angle","ext/mainPower/io for H606A"] | `cubelight/ble/MultiDeviceController.java, MultiDeviceControllerH606A.java` |
| calibration | `0x44/0x52` | `[ic][rgb] / [04][count][ic+6i]` | ["per-panel or all"] | `cubelight/ble/CalibrationController.java, CalibrationAllController.java` |

## split_pact_h6062

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| color | `0x15` | `15 01/02/03/04 ... or V2/V3 compact` | ["RGB","Kelvin 2700-6500","33-segment mask","14 brightness","4x group RGB"] | `ble/SubModeColor.java; SubModeColorV2.java; SubModeColorV3.java` |
| music | `0x13` | `13 <code> <sens> <dynamic> <auto> [R G B]` | ["codes 0/1/2/4/6/7/8 plus H6062 new codes","sens 0..99"] | `ble/SubModeMusic.java; SubModeMusicV2.java; SubModeMusicV3.java` |
| scene | `0x04` | `04 <effect LE16>` | ["41 {0,1,2,3}","80 {0,1,6}","114 {0,5}"] | `ble/SubModeScenes.java; SubModeScenesV1/V2` |
| diy | `0x0A` | `0A <diy LE16>` | ["H610B protocol 4 / share code 41","H610A NewConfigManager4H610A","H6062 base DIY"] | `newdetail/newdiy/DiyParse4H610B.java; newdetail/newdiy/NewConfigManager4H610A.java` |

## split_pact_h6079

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| solid/segmented colour | `0x15` | `15 01 R G B kHi kLo R2 G2 B2 m0 m1 \| 15 02 B m0 m1 \| 15 03 B0..Bn` | ["kelvin 2200-6500 (H16B0 1000-10000)","segment mask 14/13/17 bits","per-segment brightness"] | `…/h6079/ble/SubModeColorV2.java` |
| colour v1 (H6020) | `0x0D` | `0D R G B kHi kLo R2 G2 B2` | ["kelvin 2200-6500"] | `…/h6020/ble/SubModeColor.java` |
| scene | `0x04` | `04 <effect LE16> <musicCode LE16>` | ["effect id cloud catalog","default 2002","H6079 default 2099","op sets {0,1,2,3,6}/{1,2,6}"] | `…/h6079/ble/SubModeScenes.java, /h6020/ble/SubModeScenes.java, pact/Support.java` |
| new DIY | `0x0A` | `0A <diyCode LE16> <slot LE16>` | ["IC grid 54x10 (H6079), 144x30 (H607C), 48x19 (H16B0)","multi-packet 0xA3 pixel data before select frame"] | `…/h6079/ble/SubModeNewDiy.java, pact/Comm.java, iot/CmdPtReal.java` |
| music v1 | `0x13` | `13 code sens autoFlag [R G B]; rhythm 13 72 sens soft autoFlag [RGB]` | ["sensitivity 0..99","legacy codes 0/6/7/8/51/114"] | `…/h6079/ble/SubModeMusic.java` |
| music v2/v3 | `0x13` | `13 <code> <sensitivity>` | ["codes 115/114/51/79/81/116/80/131/132/133/8/130/134/135/137","sensitivity 0..99"] | `…/h6079/ble/SubModeMusicV2.java, SubModeMusicV3.java, newdetail/h6079/music/H6079NewMusicMode.java` |
| custom music/light code | `0x13 + multi` | `base64 custom light code multi frames` | ["cloud effect per music"] | `…/h6079/h607c/music/H607CMusicCustomEffect.java, newdetail/music/*MusicProxy.java` |
| gradual / part colour | `0xA3` | `A3 00\|01` | ["one flag","sequence: 05/15 colour packets + AA/A5 read + A3 end"] | `…/h6079/ble/Gradual4BleWifiController.java, iot/CmdPtReal.isOtherMode2ColorModePtWithBrightness` |
| preset multi-scene (H6020) | `0x04/0x58` | `cloud scene param minus first byte, multi-packet` | ["scene id","H6020 and 0x40/0x41 params use 0x58, else 0x04"] | `…/h6020/adjust/controller/MultiPresetScenesController.java` |
| white noise (H6020) | `0x71/0x7A` | `online-sound player commands` | ["volume 0x79","player state","available across H6020 family per online-sound config"] | `…/h6020/iot/CmdStatusV0.java, …/h6020/adjust/v1/BleIotInfoH6020.java` |

## split_pact_h6092

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| scenes | `0x04` | `04 <effect LE16> <musicCode LE16>` | ["effect id","music code (0 when off)","preset scene via MultiPresetScenesController cmdType 5/6"] | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/ble/SubModeScenes.java, pact/Comm.java` |
| new_diy | `0x0A` | `0A <diy LE16> <secondCode LE16>` | ["diy code","high-color/second code"] | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/ble/SubModeNewDiy.java` |
| operate | `0x20 / 0x0C` | `operate type 1/2 + params` | ["SubModeOperate"] | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/ble/Mode.java` |
| music | `0x0F` | `music sub-mode payload` | ["effect ids energy 0, impact 6, jet 7, jump 8, joy 51, rhythm 114; rhythm dynamic 0 / soft 1"] | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/ble/BleProtocol.java` |
| preset_scene | `0x05/0x06 command type` | `sceneParam base64 minus 3 bytes` | ["cmdType 6 when param[1]==0x7B","timeout 100ms"] | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/controller/MultiPresetScenesController.java` |
| layered_diy_h7071 | `0x0A` | `layer/effect serialised by Pro4H7071Diy` | ["layers","fixed/loop/random image","water ripple"] | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/newDetail/h7071/diy/*` |
| r1810_segment | `0x15` | `per-segment colour` | ["3 segments","stack/advanced effects"] | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/newDetail/r1810/*` |

## split_pact_h6099

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| colorH605B | `0x15` | `15 01 R G B kLo kHi R2 G2 B2 mask* \| 15 02 idx mask*` | ["24-segment mask 3 bytes","kelvin","temperature RGB"] | `pact_h605b/ble/SubModeColor.java` |
| colorH605C | `0x15` | `15 01 R G B kLo kHi R2 G2 B2 mask2 \| 15 02 idx mask2` | ["14 segments","2-byte mask"] | `pact_h605b/ble/v2/SubModeColorV2.java` |
| colorH6601H6603 | `0x15` | `15 01 R G B kLo kHi R2 G2 B2 mask3 \| 15 02 idx mask3` | ["24 segments","3-byte mask"] | `pact_h605b/ble/v3/SubModeColorV3.java` |
| colorH6602H6604 | `0x15` | `15 02 bri mask2 \| 15 01 R G B kLo kHi 0 0 0 mask2 \| 15 00 \| 15 03 group bri… \| 15 04 group rgb…` | ["opType 0..7","14 segments"] | `pact_h605b/ble/v4/Sub4Color.java` |
| colorH6608 | `0x15` | `15 01 R G B kLo kHi R2 G2 B2 mask3` | ["30 segments","3-byte mask"] | `pact_h605b/ble/h6608/SubModeColor4H6608.java` |
| colorH6099 | `0x15` | `15 01 R G B kLo kHi 0 0 0 mask* \| 15 02 bri mask* \| 15 03 group bri… \| 15 04 group rgb…` | ["opType 0..7","14 segments default, 24 for H6097","2/3-byte mask"] | `pact_h6099/ble/v1/SubModeColorV1.java` |
| scene | `0x04` | `04 effectLo effectHi` | ["16-bit LE effect id","0xA3 multi-layer blob"] | `pact_h605b/ble/SubModeScenes.java, pact_h605b/ble/v2\|v3/SubModeScenesV2\|V3.java, pact_h605b/ble/v4/Sub4Scenes.java, pact_h6099/ble/v1/SubModeScenesV1.java` |
| diy | `0x0A` | `0A codeLo codeHi` | ["16-bit LE DIY code","templates via CmdPtReal.getDiyCmdPt*"] | `pact_h605b/ble/SubModeNewDiy.java, pact_h6099/ble/Sub4Diy.java` |
| musicH605B | `0x13` | `13 code sens [flags]` | ["codes 64,65,66,67,72,80,82,83","sensitivity 0..99"] | `pact_h605b/ble/SubModeMusic.java` |
| musicH605C | `0x13` | `13 code sens dyn auto R G B` | ["8 bytes","auto/dynamic flags"] | `pact_h605b/ble/v2/SubModeMusicV2.java` |
| musicH6601H6603 | `0x13` | `13 code sens [flags]` | ["5 bytes"] | `pact_h605b/ble/v3/SubModeMusicV3.java` |
| musicH6602H6604 | `0x13` | `13 code sens dyn 00 auto R G B` | ["9 bytes"] | `pact_h605b/ble/v4/Sub4Music.java` |
| musicH6099 | `0x13` | `13 code sens \| 13 code sens dyn auto 00 00 R G B` | ["codes 64..83 + new 48..55"] | `pact_h6099/ble/v1/SubModeMusicV1.java` |
| video | `0x00` | `00 drama part vividness voiceOpen 02 voice` | ["drama flag","part","vividness 0..100","voice code"] | `pact_h605b/ble/SubModeVideo.java, v2/v3/v4/SubModeVideo*, pact_h6099/ble/v1/SubModeVideoV1.java` |
| micH6099 | `0x05` | `05 01` | ["enter mic mode"] | `pact_h6099/ble/BleProtocol.java` |
| video (H6099) | `0x00` | `00 drama part(8/9) vivid voiceOn 02 voice` | ["part 8/9","drama 0 movie/1 game","vivid 1..100","voiceOn 0/1","voice"] | `pact_h6099/detail/mode/VideoVm.java` |
| video (H66A0) | `0x00` | `00 drama part vivid voiceOn 02 voice` | ["H66A0 order"] | `pact_h6099/detail/mode/VideoVm.java (O)` |
| video (H605B/H605D) | `0x00` | `00 voiceOn vivid part drama voice softness` | ["different byte order"] | `pact_h605b/newdetail/viewmodel/VideoVm.java (O)` |
| video (H605C/default) | `0x00` | `00 screenState drama vivid voiceOn voice 00 seg1 seg2 seg3 seg4 00` | ["12 bytes","4-segment relative brightness"] | `pact_h605b/newdetail/viewmodel/VideoVm.java (P)` |
| video (H2A40) | `0x00` | `00 drama part vivid voiceOn 02 voice` | ["H2A40 order"] | `pact_h605b/newdetail/viewmodel/VideoVm.java (N)` |
| video (H605A) | `0x00` | `00 drama part vivid voiceOn softness voice` | ["H605A order"] | `pact_h6099/adjust/newdetail/viewmodel/VideoVmH605A.java` |

## split_pact_h60ax

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| color | `0x15` | `15 <op> ...` | ["op 0 brightness","op 1 RGB","op 2 Kelvin","op 3 mode","op 6 14-byte brightness group","op 7 4x RGB group","op 11 H60A1 kelvin","op 12 H60A1 RGB"] | `ble/v1/SubModeColorV1.java` |
| color-h60a6 | `0x0D` | `0D ...` | ["13-pixel H60A6 colour"] | `ble/BleProtocol.java; adjust/h60a6/ColorModeH60A6.java` |
| music | `0x13` | `13 <code> <sens>` | ["default code 5 sens 100","base new-music code sets"] | `ble/v1/SubModeMusicV1.java` |
| scene | `0x04` | `04 <effect LE16>` | ["per-SKU op sets"] | `ble/v1/SubModeScenesV1.java` |
| diy | `0x0A` | `0A <diy LE16>` | ["H60A4 784/851","H60A6 797/798","H60C1 878/789","H1270 897/898/983","H1250 915/916/982","H1252 902/981/941","H12D0 944/961","H1141 976/977"] | `per-family DiyConfig/DiyParse` |
| graffiti | `0xEF` | `cell-graffiti layers` | ["H12D0 0xEF","H1141 graffiti protocol 0x03","H1270 graffiti 82"] | `ble/BleProtocol.java; adjust/h12d0/diy/*; adjust/h1141/diy/H1141GraffitiParse.java` |
| child-switch | `` | `36 <0..2 bools>` | ["secondary light switch"] | `ble/controller/ControllerChildSwitch.java` |

## split_pact_h61d3

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| color | `0x15` | `15 01/02 ...` | ["RGB","Kelvin","32-bit segment mask","per-segment brightness"] | `adjust/color/SubModeColor.java` |
| music | `0x13` | `13 <code> <sens> [dynamic] [auto] [R G B]` | ["code 3 extended form","sens 0..99"] | `adjust/music/SubModeMusic.java` |
| scene | `0x04` | `04 <effect LE16> <dir1> <dir2> [count colors...]` | ["scene code","flow direction","per-segment colours"] | `adjust/scene/SubModeScenes.java` |
| diy-h61dx | `0x0A` | `0A <691\|625> + protocol 0x58/0x03 body` | ["basic 691","graffiti 625","sub-effects Duiji/Jihe/Liudong/Suiji/Xianxing","direction up/down/left/right"] | `adjustNew/diy/H61DXDiyConfig.java; adjustNew/diy/h61dx/*` |
| diy-h1ab1 | `0x0A` | `0A <share-code effect> protocol 0x22` | ["share code 0x00 effect triples","graffiti share 0x08","speed 1..100","colour [1,8]"] | `adjustNew/diy/H1AB1DiyConfig.java; adjustNew/diy/h1ab1/*` |
| recognition-multi | `0xA3` | `[index][RGB][effect LE16][count][?][?][on][n][RGB x n]` | ["detected point colours","effect code"] | `ble/controller/LightRecognitionMultiController.java` |

## split_pact_h6630

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| scene | `0x04` | `04 effectLE16 musicCodeLE32 speed` | ["effect default 2002","musicCode 32-bit LE","speed"] | `h6630/ble/SubModeScenes.java` |
| music | `0x13` | `13 musicCode sensitivity` | ["musicCode default 101","sensitivity 0-99"] | `h6630/ble/SubModeMusic.java` |
| new DIY | `0x0A` | `0A codeLE16 speedLE16` | ["advanced codes 751/752/753/799/800/853/854/855/856/862/863"] | `h6630/ble/SubModeNewDiy.java; H663xEffectCodeManager` |
| DIY effect payload | `0xA3/0x58` | `subEffect secondSubEffect params...` | ["30+ effects: yunRan, xuanZhuan, boDong, liuDong, random, xianXing","per-effect colors/speed/direction/density","followed by mode 0x0A code 0x00FE"] | `h6630/detail/diy/parser/Pro4H6630Diy.java; H6630DiyParser.java` |
| custom watch-face | `0x81` | `display effect bytes` | ["effect codes 853/854 (H6630) or 855/856 (H6631)"] | `H663xEffectCodeManager; CustomizeWatchFaceAC` |
| GIF effect | `ptUrl` | `cloud-hosted GIF blob` | ["effect code 2 GIF UI"] | `H6630GifParse; GifEffectFragment` |

## split_pact_h6660

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| laser_ilda | `` | `ILDA frame formats 0/1/2/4/5: header(32B) + points/colour palette` | ["frame/colour-palette name","company","point count","frame number","total frames"] | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/entity/Ilda*.java` |
| diy_effect_order | `0x0A` | `ordered effect list` | ["bright 25","color 24","move 26","scale 27","rotate 28","track 29","mirror 30","distort 31","carousel 36"] | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/entity/DiyEffectInfo.java` |
| music | `0x13` | `13 <subMusicMode> <sensitivity>` | ["ids 160..178: mist, collision, ... yanhua"] | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/detail/MusicModeH3810.java` |
| transforms | `` | `per-frame transform application` | ["scale","color","mirror","erase","distort","move","rotate","point limit"] | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/util/trans/*` |

## split_pact_h682021

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| color | `0x15` | `15 R G B <kelvin LE16> R2 G2 B2` | ["RGB","kelvin 1000-10000K","second/background RGB"] | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/ble/SubModeColor.java` |
| scenes | `0x04` | `04 <effect LE16> <musicCode>` | ["effect id","music code","channels 0/1/5"] | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/ble/SubModeScenes.java` |
| new_diy | `0x0A` | `0A <diy LE16>` | ["diy code"] | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/ble/SubModeNewDiy.java` |
| music | `0x13` | `13 <musicCode> <sensitivity 0-99>` | ["music code","sensitivity"] | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/ble/SubModeMusic.java` |
| diy_page | `0x0A` | `type(1 linear,2 face) lenLE16 pageCount rule {page lenLE16 ...}; BLE blob prefixed 0x4B` | ["linear/planar pages","rule 0..4","per-page effects"] | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/diy/Pro4H682xDiy.java` |
| linear_effect | `0x0A` | `lenLE16 type [subtype] colorType [d] e f g h i j k colorCount {RGB} m n[2] o p [q [r] s]` | ["solid vs multi colour","direction/mirror","sub-effect bytes"] | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/diy/H682xPageDiyLinearEffect.java` |
| planar_direction | `0x0A` | `13 direction codes 0..13` | ["UP_DOWN","UP_DOWN_JL_KS","14 direction mappings"] | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/diy/H682xPlanarDirectionConfig.java` |

## split_pact_h6840

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| colorH6840 | `0x0D` | `0D R G B kLo kHi R2 G2 B2` | ["RGB","colour temperature LE16","temperature RGB"] | `h6840/ble/SubModeColor.java` |
| sceneH6840 | `0x04` | `04 effectLo effectHi param` | ["16-bit effect id","extra param byte","0xA3/0x5B layer blob"] | `h6840/ble/SubModeScenes.java, h6840/pact/Comm.java` |
| diyH6840 | `0x0A` | `0A codeLo codeHi` | ["16-bit DIY code","DIY groups 1..14","H6842/43 codes 927..934"] | `h6840/ble/SubModeNewDiy.java, h6840/diy/*` |
| musicH6840 | `0x13` | `13 code sens` | ["music codes 160..167","sensitivity 0..99"] | `h6840/ble/SubModeMusic.java, h6840/pact/BleProtocol.java` |
| colorH6609 | `0x15` | `15 opType … mask*` | ["wire opTypes 0,1,2,3,6,7 only","mask 2 or 3 bytes","kelvin","per-group brightness/RGB"] | `h6609/ble/v1/SubModeColorV1.java` |
| sceneH6609 | `0x04` | `04 effectLo effectHi` | ["16-bit effect id"] | `h6609/ble/v1/SubModeScenesV1.java` |
| diyH6609 | `0x0A` | `0A codeLo codeHi` | ["16-bit DIY code","graffiti layer parsers"] | `h6609/ble/Sub4Diy.java, h6609/ble/SubModeNewDiy.java` |
| musicH6609 | `0x13` | `13 code sens \| 13 code sens dyn auto 00 00 R G B` | ["codes 64,65,66,67,72,80,82,83 + new 3,4,5,6","sensitivity 0..99","dynamic/auto flags, RGB"] | `h6609/ble/v1/SubModeMusicV1.java` |
| videoH6609 | `0x00` | `00 drama part vividness voiceOpen 02 voice` | ["drama flag","part 8/9","vividness 0..100","voice code"] | `h6609/ble/v1/SubModeVideoV1.java` |
| interactiveH6609 | `0x14` | `14 01 sens level soundLevel timeLo timeHi \| 14 01 sens 01 twoLevel difficulty` | ["level 0/1","sound level 1..7","difficulty","timer 14..126"] | `h6609/ble/v1/SubModeInteractive.java` |
| micH6609 | `0x05` | `05 01` | ["enter mic mode"] | `h6609/ble/BleProtocol.java` |

## split_pact_h7050

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| color | `0x15` | `15 01 R G B [kLo kHi R2 G2 B2] mask*` | ["rgb","colorTem 2000-10000K per SKU","segment mask 4 or 6 bytes","per-segment brightness"] | `h7050/ble/SubModeColor.java` |
| colorSegment | `0x15` | `15 02 colourIndex mask*` | ["color index","segment mask"] | `h7050/ble/SubModeColor.java` |
| segmentBrightness | `0x15` | `15 03 bri0..briN` | ["per-segment brightness 0..100"] | `h7050/ble/SubModeColor.java` |
| scene | `0x04` | `04 effectLo effectHi` | ["16-bit LE cloud effect id","multi-layer 0xA3 blob + 04 code trailer"] | `h7050/ble/SubModeScenes.java, h7050/pact/Comm.java` |
| diy | `0x0A` | `0A codeLo codeHi` | ["16-bit LE DIY code","multi-layer 0xA3 blob + 0A code trailer"] | `h7050/ble/SubModeNewDiy.java, h7050/iot/CmdPtReal.java` |
| music | `0x13` | `13 code sens [dyn] [auto] [R G B]` | ["music code 0..100","sensitivity 0..99","per-SKU optional dynamic/auto flags and RGB"] | `h7050/adjust/ParamsSubMode4Music.java, h7050/adjust/v3\|v7\|v8\|v9\|h7037\|h7053\|h7066/*` |
| mic | `0x05` | `05 00 r g b` | ["rhythm point RGB"] | `h7050/ble/SubModeMic.java, h7050/ble/MicController.java` |
| multiMusic | `0x41` | `len code sens ...` | ["per-layer colour music block"] | `h7050/ble/MultiMusicController.java, h7050/iot/CmdPtReal.getMusicCmdPtReal` |
| scenesMulti | `0xA3/0x04` | `0xA3 multi-packet layer blob; final 04 code` | ["scene version cmd byte 1/4/12","direction/speed/x/y for V4","MTU variants"] | `base2light/ble/comm/MultipleControllerCommV1.java, base2light/ble/ScenesOp.java` |
| musicH7020 | `0x13` | `13 code sens [flags]` | ["new-music codes rhythm=3, spectrum=4, energy=5, scroll=6","H7033/H7041 own new-music lists"] | `h7020/ble/SubModeMusic.java, h7020/ble/SubModeMusicV2.java` |

## split_pact_h705a

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| color | `0x15` | `15 01/02/03/04 ...` | ["RGB","Kelvin 2000-9000/2200-6500/2700-6500/1000-10000","segment mask up to 40","14 brightness","4x RGB group"] | `mode/color/SubModeColor.java` |
| music | `0x13` | `13 <code> <sens> [01] [auto] [R G B]` | ["codes 48-55,72,74,81,113","sensitivity 0..99"] | `mode/music/SubModeMusic.java` |
| scene | `0x04` | `04 <effect LE16>` | ["scene code","op set {0,1,2,3}"] | `mode/scenes/SubModeScenes.java` |
| diy | `0x0A` | `0A <diy LE16>` | ["DIY code"] | `mode/diy/SubModeNewDiy.java` |
| h7067-sub-effects | `` | `DIY-new effect body` | ["BianHuan","BinFen","Breath","CaiQiang","Fade","Glimmer1/2","MengHuan","Mirror","Rainbow1/2","Ripple","Sawing1/2"] | `h706789/diy/subEffect/*` |
| h608a-gif | `` | `GIF sub-effect id` | ["ids 1..18"] | `adjust/h608a/SubEffectGifConfig.java` |
| part-scene | `` | `PartScenesViewModel scene writes + SubModePartScenes(segId, 5-byte selector)` | ["sceneCode groups","16-bit segment mask"] | `pact/Comm.k()` |

## split_pact_h7075

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| color | `0x15` | `15 <01\|02\|03\|04> ...` | ["RGB","Kelvin 2700-6500 or 1000-10000","segment mask up to 32","per-segment brightness 14 B","group RGB 4x3 B"] | `jadx-splits/split_pact_h7075/sources/com/govee/h7075/mode/color/SubModeColor.java` |
| mic | `0x05` | `05 01` | ["sound-reactive mic mode; 0x13 music declared but unused"] | `mode/mic/SubModeMic.java` |
| scene | `0x04` | `04 <effect LE16>` | ["scene effect code","scene op sets"] | `mode/scenes/SubModeScenes.java` |
| diy | `0x0A` | `0A <diy LE16>` | ["DIY code","protocol 0x56 for H7075; 765 H7072; 999/9998/10001 H3700; 960/963 H2800"] | `mode/diy/SubModeNewDiy.java; per-family DiyConfig` |
| motion-effect | `` | `sceneCode LE16 \| musicCode LE16 \| cmdType \| len LE16 \| body` | ["motionId LE32","version LE16","motion switch 0x47/delete 0x48/exit 0x49"] | `h7078/motion/MotionConstants.java; MotionDeviceInfo.java` |
| light-sense | `` | `24 <enable><minGear 0..3><maxGear 0..3><allDay><time LE16>` | ["enable","gear 0..3","all day","time"] | `r3352/protocol/R3352LightSenseInfo.java` |
| auto-dimming | `` | `25 <enable><min 1..100><max 1..100><effectTime>` | ["enable","brightness 1..100","effect-time index"] | `r3352/protocol/R3352AutoDimmingInfo.java` |

## split_pact_h70b1

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| H70B1 color | `0x0D` | `0D R G B kelLo kelHi R2 G2 B2` | ["Kelvin 1000..10000"] | `h70b1/origin/ble/SubModeColor.java` |
| H70B1 music | `0x13` | `13 code sens` | ["default code 101","sensitivity 0..99","multi-value named effects from IMusicEffectStatic"] | `h70b1/origin/ble/SubModeMusic.java; base2light/ble/IMusicEffectStatic.java` |
| H70B1 scene | `0x04` | `04 effLo effHi musicByte` | ["effect codes 467,531-540,544-556","default 22 Stream"] | `h70b1/origin/ble/SubModeScenes.java; h70bx/diy/protocol/EffectCodeManager.java` |
| H70BC scene/DIY | `0x04/0x0A` | `16-bit code` | ["effect codes 645,648-651,654-661,539,540,544,549-552"] | `h70bx/diy/protocol/EffectCodeManager.java#c` |
| H70B1 DIY | `0x0A` | `0A diyLo diyHi` | ["share codes 24/36/83","multi-frame body protocol 83/91"] | `h70b1/origin/pact/Comm.java` |
| H70B3 color | `0x0D` | `0D R G B kelLo kelHi R2 G2 B2` | ["Kelvin 1000..10000"] | `h70b3/ble/SubModeColor.java` |
| H70B3 music | `0x13` | `13 code sens` | ["default 101","multi-value effect names"] | `h70b3/ble/SubModeMusic.java` |
| H70B3 scene | `0x04` | `04 effLo effHi musicByte` | ["effect codes 666-690,756-759,771-773,890","server scene ids","default 22"] | `h70b3/ble/SubModeScenes.java; h70b3/diy/protocol/EffectCodeManager.java` |
| H70B3/H6800 interactive | `0x14` | `14 01 sens oneLevel [soundLevel timeLo timeHi \| twoLevel difficulty]` | ["soundLevel 1..6/other -> 14/28/42/56/70/98/126","start time 300000-countdown"] | `h70b3/mode/game/SubModeInteractive.java` |
| H70B3 DIY | `0x0A + proto 0x58` | `0A diyLo diyHi + multi-frame body` | ["simple effects: YunRan, BoBanTang, DaFengChe, SiDai, ShanFeng, HuoGuang, JiaoTi, ShenSuo, DangYang, DuiJi, TanTiao, TanTiaoQiu, TanChiShe, XiaoXiaoLe, YanHua, PenShe","advanced cell graffiti"] | `h70b3/diy/simple/effect/*; h70b3/diy/advance/*; h70b3/diy/parse/DiyParse4H70B3.java` |
| H70B6 display | `0x7F` | `subcmd + data` | ["groups: 11/12/13/15 clock, 21/22/23/24/27, 51/52"] | `h70b6/adjust/H70B6DisplayConfig.java` |
| H70B6 music | `0x13` | `13 code sens` | ["music UI codes 255,0,1,2,3,4","multi-value list via MusicMode4H70B6"] | `h70b6/adjust/delegate/MusicMode4H70B6.java` |
| H70B6 DIY | `0x0A + proto 0x58` | `[len][sub][second][RGB]...` | ["6 groups x sub-effects: YunRan(CaiQiang/FuGai), XuanZhuan(BoBanTang/DaFengChe), BoDong(BoFeng/ShuangLuoXuan), LiuDong(ShenSuo/DieJia), SuiJi(TanTiaoQiu/TanChiShe/XiaoXiaoLe/YanHua), XianXing(XiangSu/TianChong/PenShe)","effect codes 750/751/862/863/864/865/886/887/900/901/905"] | `h70b6/diy/parser/Pro4H70B6Diy.java; h70b6/diy/advance/H70B6EffectCodeManager.java` |
| H70B8 DIY/GIF | `0x0A/0x15 + proto 0x58` | `same as H70B6` | ["H70B8 GIF 865, cell 863, LED size 32x48"] | `h70b8/Config4H70B8Manager.java; h70b6/H70b8ApplicationImp.java` |
| H70DX color | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 maskLo maskHi` | ["10 segments","mode 02 = brightness, 03 = raw array"] | `h70dx/ble/SubModeColor.java` |
| H70DX music | `0x13` | `13 code sens` | ["default 101"] | `h70dx/ble/SubModeMusic.java` |
| H70DX scene | `0x04` | `04 effLo effHi musicByte` | ["scene parse versions 1/2/10","effect codes 715/716/718/719/774/775/777/778"] | `h70dx/ble/SubModeScenes.java; h70dx/ConfigH70DX.java` |
| H70DX DIY | `0x0A + proto 0x58` | `0A diyLo diyHi + multi-frame body` | ["sub-effects 1 MaSaiKe, 2 XingGuang, 3 GeShan, 4 XueHua, 5 YunRan, 6 HuoGuang, 7 JiHe, 8 TanTiaoQiu, 9 QinJian, 10 ZuHe","cell graffiti tags 76..80"] | `h70dx/diy/H70DXDiyParse.java; H70DXCellGraffitiParse.java` |
| H70DX install/direction | `0x39` | `installType direction` | ["H70D1 {1,1} right {1,2} left; H70D2/D3 {2,1}/{2,2}"] | `h70dx/Support.java; h70dx/ble/controller/ControllerInstallInfo.java` |

## split_pact_h7111

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| mode | `0x00` | `mode byte + params` | ["H7111/H7100: GEAR/CUSTOM/AUTO/SLEEP/NATURAL/STORM","H7105: GEAR/CUSTOM/AUTO/SLEEP/NATURAL","H7112: GEAR/AUTO/SLEEP/NATURAL"] | `h7111/adjust/Mode.java, h7100/adjust/Mode.java, h7105/adjust/Mode.java, h7112/bean/Mode.java` |
| auto ramp | `0x03/0x02` | `[autoMode][startGear][startTemp*100 LE16][endGear][endTemp*100 LE16]` | ["start/end gear","start/end temp x100"] | `h7111/adjust/ModeAuto.java, h7105/adjust/ModeAuto.java, h7112/bean/ModeAuto.java` |
| custom recipe | `0x02/0x05` | `[mode][nibbles][child x3]` | ["child 5B (H7111/H7100) or 7B+ (H7105)","temps x100","type/current/target/angle/symmetry"] | `h7111/adjust/ModeCustom.java, h7105/adjust/ModeCustom.java` |
| shake/oscillation (H7105) | `0x1D` | `on [01][speed][angle][center*10 LE16][symmetry]; off [00][direction]` | ["speed 1..3","angle 30..180","center 0..180","direction"] | `h7105/ble/controller/H7105ShakeController.java, ShakeBean` |
| shake/oscillation (H7111) | `0x1F/01` | `on [01][speed][angle][center LE16][symmetry]; off [00][direction]` | ["same ranges","sub-id 1"] | `h7111/ble/controller/ModeShakeController.java` |
| light sub-command (H7105) | `0x1B` | `LightSubCmd brightness/mode` | ["brightness","light mode"] | `h7105/ble/DevCommReportParse.java` |
| timer / delay | `0x13/0x23/0x26` | `timer record / on+minutes / on+minutes` | ["one-shot or weekly"] | `base_h71xx timer and delay controllers, H7112SharedViewModel` |
| thermometer sensor | `0x10/0x08/0x09/0x1E` | `read / MAC / none / calibration` | ["int24 temperature","type","calibration offset"] | `base_h71xx GetThermometerController, BindTemperatureController, TemperatureCaliController` |

## split_pact_h7130

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| gear | `` | `05 <gear>` | ["gear index"] | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/GearController.java` |
| mode | `` | `05 <01 gear\|03 auto\|09 fan>` | ["gear","auto","fan"] | `jadx-splits/split_pact_h7130/sources/com/govee/h7132/adjust/Mode.java` |
| constant-temperature | `` | `1A <on><mode><tempLE16>` | ["target 1..100","C/F flag"] | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/ConstantTemperatureControllerV3.java` |
| swing-leaf | `` | `2A <on\|off>[<speed<<4\|angle>]` | ["on/off","speed 0..15","angle 0..15 (runtime UI bounds)"] | `jadx-splits/split_pact_h7130/sources/com/govee/h7133/ble/controller/SwingLeafController.java` |
| power-saving | `` | `23 (read)` | ["power-saving state"] | `jadx-splits/split_pact_h7130/sources/com/govee/h7132/ble/controller/PowerSavingController.java` |
| sleep-schedule | `` | `timer/time frames built from per-hour curve` | ["hourly temperature curve","runtime points"] | `jadx-splits/split_pact_h7130/sources/com/govee/baseh7130/sleep/*` |

## split_pact_h7170

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| mode/recipe | `0x00` | `[00][mode][params]` | ["H7170: 2/3/4/5/1/6","H7171: 1/2/3/4/5","H7173: 1/2/3/4/5","H7175: 2/3/4/5/1/6"] | `h7170/adjust/Mode.java, h7171/adjust/Mode.java, h7173/adjust/Mode.java, h7175/adjust/Mode.java` |
| auto ramp | `0x03` | `[03][startGear][startTemp*100 LE16][endGear][endTemp*100 LE16]` | ["start/end gear and temperature"] | `h7175/ble/controller/ModeController.java` |
| custom/DIY recipe | `0x02` | `[02][slot][child 4B][child 2x]` | ["child temp*100 LE16 + diyId + brewOpen","slots 1..4"] | `h7173/adjust/ModeCustom.java, h7173/adjust/ModeCustomChild.java, h7170 DiyModeWriteController` |
| water light (H7173) | `0x1B` | `[01][mode][RGB] or [05]+5xRGB` | ["modes DIY/BOIL/TEA/COFFEE/KEEP_TEMP","colours blue/orange/green/yellow/purple/indigo","3-byte RGB"] | `h7173/ble/controller/WaterLightController.java, h7173/adjust/WaterLight*.java` |
| delay start | `0x23` | `[on][setMin LE16][timestamp LE32]` | ["one-shot start","timestamp unix seconds"] | `h7170/adjust/DelayStartInfo.java` |
| keep warm | `0x22` | `[on][setMin LE16][setMin LE16]` | ["minutes, default 120"] | `h7170/adjust/KeepWarm.java` |

## split_pact_h7172

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| modes | `` | `mode id 1..10` | ["ice making","washing","dispensing","reservation","mode groups {1,2,3,7,8} {4,5,6,9,10}"] | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/Support.java, adjust/Mode.java` |
| delay_start | `` | `23 <enable> <minutes LE16> <epoch LE32> <mode>` | ["delay minutes","absolute start","target mode"] | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/ble/controller/DelayStartController.java` |
| ice_size | `` | `05 <size>` | ["big 1","middle 2","small 3"] | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/ble/controller/IceSizeController.java` |

## split_pact_h7180

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| rice | `0x05` | `01 flavor resLE16 keepWarm temp*100LE16 sumTimeLE16 start` | ["flavor","reservation minutes","keep warm","temperature*100","start"] | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/model/RiceModelBean.java` |
| saute | `0x05` | `02 gear start` | ["gear","start"] | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/model/SatuteModelBean.java` |
| steam | `0x05` | `03 workTimeLE16 resLE16 keepWarm temp*100LE16 sumTimeLE16 start` | ["work time","reservation","keep warm","start"] | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/model/SteamModelBean.java` |
| slow_cook | `0x05` | `04 gear workTimeLE16 resLE16 keepWarm temp*100LE16 sumTimeLE16 slowCookType start` | ["gear","work time","reservation","keep warm","type"] | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/model/SlowCookModelBean.java` |
| diy | `0x05` | `05 diyIndex + multi: start, stepState, resLE16, up to 3 {code, workMinuteLE16, leaveMinuteLE16}, deviceState` | ["3 cooking programs","reservation","device state"] | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/DiyModeMultipleControl.java` |
| keep_temp | `0x22` | `type start temp*100LE16 sumTimeLE16 [mode]` | ["inner/outside","target temp","duration"] | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/adjust/component/widget/KeepTempBean.java` |
| recipe_making | `0x24` | `start [type] / menu multi bytes` | ["menu code","gear","work/leave minutes"] | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/RecipeMakingModeMultipleControl.java` |

## split_pact_hollowlamp

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| color_0x0D | `0x05/0x0D` | `0D R G B CT_H CT_L R2 G2 B2` | ["RGB","CT big-endian","temperature RGB"] | `*/ble/SubModeColor.java` |
| scene | `0x05/0x04` | `04 <effLo> <effHi> [musicCode]` | ["16-bit LE effect","default 0x22 hollowlamp / 13 tablelamp / 2002 straightfloorlamp"] | `*/ble/SubModeScenes.java` |
| diy | `0x05/0x0A` | `0A <diyLo> <diyHi>` | ["16-bit LE code","DiyM.EffectCode l=0 m=1 n=2 s=4 t=5 g=255; AI categories 28/29/30"] | `*/ble/SubModeNewDiy.java; base2light/ac/diy/DiyM.java` |
| music_v1 | `0x05/0x0E` | `0E <effect> <sens> <flag> [RGB]` | ["auto flag 0","manual color","sens 0-99"] | `hollowlamp/ble/SubModeMusic.java` |
| music_v2 | `0x05/0x0F` | `0F 04 <sens> <effect> <flag> [RGB]` | ["effect mode id","auto/manual"] | `hollowlamp/ble/SubModeMusicV2.java; straightfloorlamp/ble/SubModeMusic*.java; tablelampv1/ble/SubModeMusic.java` |
| music_v3 | `0x05/0x13` | `13 <effect> <manual> <sens> 00` | ["75 Rhythm","76 Magic","sens 0-99"] | `hollowlamp/ble/SubModeMusicV3.java; tablelampv1/ble/v2/SubModeMusicV2.java` |
| multi_music_color | `0xA3/0x41` | `41 <musicEffect> <count> <RGB> x count` | ["realtime segment colors","multi-packet"] | `hollowlamp/ble/MultiMusicController.java` |
| local_color | `0xAA/0xA5 read, 0xA3/0xA5 write` | `read A5 <page>; write A5 <count> <R G B CT_H CT_L> x count` | ["24 slots","4 colors per read page"] | `hollowlamp/ble/LocalColor*.java` |
| auto_induction | `0x33/0xA6` | `A6 <0/1>` | ["PIR auto on/off"] | `hollowlamp/ble/OnOffAutoInductionController.java` |
| sensitivity | `0x33/0xA7` | `A7 <value>` | ["PIR sensitivity","soft >= 1.00.12"] | `hollowlamp/ble/SensitiveController.java` |
| straight_floor_color | `0x05/0x14 and 0x05/0x15` | `14 R G B CT_H CT_L R2 G2 B2 00 mask / 15 <subtype>` | ["8/7/3 segments","mask bits","part brightness"] | `straightfloorlamp/ble/SubModeColor.java; SubModeColorV2.java` |
| gradual_change | `0x33/0xA3` | `A3 <0/1>` | ["smooth transition"] | `straightfloorlamp/ble/Gradual4BleWifiController.java` |
| indicator_schedule | `0x33/0x16` | `16 <enable> <startH> <startM> <endH> <endM>` | ["forever = 01 FF FF FF FF"] | `tablelampv1/ble/NewLightIndicatorController.java` |
| h6057_voice_presets | `0x30-0x38` | `30 light, 31 play, 32 pause, 33 volume, 34 detail, 35 no-disturb, 36 night, 37 prompt, 38 indicator, 27 preview, 24-29 presets` | ["speaker lamp","preset slots","battery"] | `h6057/origin/ble/*Controller.java` |

## split_pact_humidifier

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| mode gear | `0x01` | `01 <gear>` | ["gear index"] | `h7140/model/ModeInfo.java` |
| mode custom | `0x02` | `02 <(cur<<4)\|set> <5B child0> <5B child1> <5B child2>` | ["setIndex 0-2","curIndex 0-2","gearIndex","set/leave minutes 0-65535"] | `h7140/model/ModeCustom.java; ModeCustomChild.java` |
| mode auto | `0x03` | `03 <target 0-100 \| 0x80 autoClose> <comfortable 0\|1>` | ["target humidity","auto close","comfortable"] | `h7140/model/ModeAuto.java` |
| dry clothes | `0x04` | `04` | [] | `h7150/adjust/Mode.java` |
| atmosphere preset read | `0x05` | `03` | ["preset code list"] | `h7161/ble/controller/AtmosphereListController.java` |
| atmosphere edit | `0x05 (0xA3)` | `count index len onOffFog onOffVoice voiceCode voiceVol atmosphereCode onOffLight brightness lightSubMode [...mode bytes]` | ["fog on/off","voice code 0-255","voice volume 0-100","atmosphere code","light on/off","brightness 0-100","light submode 1=color/2=scene/3=diy","diy speed 0-100"] | `base_h71xx/network/bean/AtmosphereEdit.java; h7161 AtmosphereEditMultipleControl` |
| custom fog | `0x01 0x01` | `01 01 <onOff> <min LE16>` | ["on/off","minutes"] | `h7161/ble/controller/model/CustomFog.java` |
| custom lighting | `0x01 0x02` | `01 02 <onOff> <min LE16>` | ["on/off","minutes"] | `h7161/ble/controller/model/CustomLighting.java` |
| custom voice | `0x01 0x03` | `01 03 <onOff> <voiceCode> <voiceVolume> <min LE16>` | ["on/off","voice code","volume","minutes"] | `h7161/ble/controller/model/CustomVoice.java` |

## split_pact_iceMachine

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| light switch | `0x1B/0x01/0x01` | `<0\|1>` | ["on/off"] | `H8150SharedViewModel` |
| brightness | `0x1B/0x01/0x02` | `<gear>` | ["brightness 1-100"] | `same` |
| light color | `0x1B/0x05/0x0D` | `<R><G><B>` | ["RGB"] | `same` |
| light scene | `0x1B/0x05/0x13` | `<sceneCode>` | ["catalog scene id"] | `same` |
| light group preview | `0xB6` | `F4/FC <runState> <mode> <sceneLE16> \| 15 FE/FC <runState> RGB \| F6 04 <sceneLE16>` | ["run state","scene id","RGB"] | `H8150/H8131 SharedViewModel` |

## split_pact_leaknew

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| leak mode | `0x0B` | `sno 0B 01 mode` | ["10 water level","11 leak"] | `ControllerModeSwitch` |
| volume | `0x0D/0x04` | `sno (0D\|04) 02 level 01` | ["level 1-3"] | `Controller4SetVolume` |

## split_pact_outdoorlight

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| H7040 color | `0x0D` | `0D R G B kelLo kelHi R2 G2 B2` | ["single group; 1 segment"] | `h7040/ble/SubModeColor.java` |
| H7040 mic | `0x05` | `05 01 (mode) / 05 00 R G B (point)` | ["mic enable/disable + per-point colour"] | `h7040/ble/SubModeMic.java; h7040/ble/MicController.java` |
| H7040 scene | `0x04` | `04 effLo effHi` | ["ids 0,1,10,1018-1050"] | `h7040/adjust/ui/ScenesV0.java` |
| H7056 color | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask0..3` | ["8 segments","mode 02 per-segment brightness","mode 03 raw array"] | `h7056/ble/SubModeColor.java` |
| H7056 colour strip group | `0x15` | `15 04 index c0..cN (4 per frame)` | ["grouped identical colours","13-colour brightness group uses 15 03 index b0..b13"] | `h7056/pact/Comm.java` |
| H7056 music | `0x13` | `13 code sens` | ["default code 101","sensitivity 0..99"] | `h7056/ble/SubModeMusic.java` |
| H7056 scene | `0x04` | `04 effLo effHi music0..3 level` | ["default 2002","32-bit LE music code","level byte"] | `h7056/ble/SubModeScenes.java` |
| H7056 DIY | `0x0A + proto 0x58` | `0A diyLo diyHi groupLo groupHi; body [len][subEffect][n][RGB]…` | ["10 sub-effects: gradual, breath, rainbow, cover, glimmer, bloom, flow, flash, colour-wall, rotate"] | `h7056/diy/Pro4H7056Diy.java; h7056/diy/parser/H7056DiyParser.java` |
| H7080 color | `0x15` | `mode1 15 01 R G B kelLo kelHi R2 G2 B2 mask0; mode2 15 02 level 00 mask0; mode3 15 03 raw` | ["4/8/6 segments by goodsType"] | `h7080/ble/SubModeColor.java` |
| H7080 location | `0xA7/0xA6` | `pairs index/value; check (count,index)` | ["physical placement calibration"] | `h7080/ble/LocationController.java; h7080/ble/CheckLocationController.java` |
| H7086 color | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask0..3` | ["4 segments"] | `h7086/ble/SubModeColor.java` |
| H7086 music | `0x13` | `13 code sens` | ["codes 1,2,7,8,9,16,17,18,19,20,52 (BleProtocol constants), default 5"] | `h7086/ble/SubModeMusic.java; h7086/ble/BleProtocol.java` |
| H7086 scene | `0x04` | `04 effLo effHi musicLo musicHi` | ["16-bit effect + 16-bit music code"] | `h7086/ble/SubModeScenes.java` |
| H7086 DIY | `0x0A + proto 0x58` | `0A diyLo diyHi groupLo groupHi` | ["7 primitive sub-effects: breath, meteor, loop, glimmer, pile-up, sunrise, firework","23 UI presets incl. codes 21/22/23 templates"] | `h7086/adjust/mode/diy/H7086DiyParse.java; H7086DiyConfig.java` |
| H7086 cap calibration | `0x30/0x31` | `mode enable; serial list` | ["status notify 0x32"] | `h7086/adjust/controller/*` |

## split_pact_plugnew

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| night light color | `0x0D` | `05 0D R G B brHi brLo` | ["RGB 24-bit big-endian","brightness/color temperature 16-bit BE"] | `base_h71xx LightRgbController; LightModeInfo` |
| night light scene | `0x13` | `05 13 00 sceneId` | ["scene id"] | `base_h71xx LightModeInfo/ModeScene` |
| night light DIY | `0x0A` | `05 0A 00 00` | ["DIY stored on device"] | `base_h71xx ModeDiy` |
| night light default | `0xFC` | `05 FC` | ["default/white"] | `base_h71xx LightSubMode.DEFAULT` |
| night light sleep | `0x28` | `en startBri closeMin curMin defaultLight R G B ctHi ctLo` | ["closeMin/curMin max 240","brightness 0-100","RGB + color temp"] | `Controller4NlSleep` |
| night light wake | `0x29` | `en endBri hour min repeat wakeMin defaultLight R G B ctHi ctLo` | ["repeat bitmask","brightness 0-100","RGB + color temp"] | `Controller4NlWakeUp` |

## split_pact_rgbiclight

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| static color | `0x02` | `02 R G B tempFlag R2 G2 B2` | ["RGB 0-255","tempFlag 0/1","temperature/background RGB"] | `h6102/ble/SubModeColor.java` |
| color V1 (15 segments) | `0x0B` | `0B R G B maskLo maskHi` | ["segment bitmask 15 bits","per-group RGB"] | `h612526/ble/SubModeColor.java, h6160/adjust/v1/SubModeColorV1.java` |
| color V2 group | `0x15 type 1` | `15 01 R G B KLo KHi R2 G2 B2 00 mask` | ["6/7/8/15 segments","signed LE Kelvin","background RGB","segment mask"] | `h6119/ble/SubModeColorV2.java, chassislightv1/ble/SubModeColorV2.java` |
| color V2 brightness | `0x15 type 2` | `15 02 brightness 00 mask` | ["per-segment brightness","segment mask"] | `h7090/ble/SubModeColor.java` |
| color V2 array | `0x15 type 3` | `15 03 R1 G1 B1 ... R15 G15 B15` | ["per-segment RGB","up to 15 segments"] | `h6119/ble/SubModeColorV2.java` |
| legacy music | `0x01/0x03` | `sub autoFlag sensitivity [R G B]` | ["sensitivity 0..99","auto color flag","manual RGB","styles energic/spectrum/rolling/rhythm 0-3"] | `h6102/ble/SubModeMusic.java, h6105, h6127` |
| music V1 rhythm | `0x0C` | `0C 01 sensitivity sub` | ["sub 0 Dynamic / 1 Mild","sensitivity 0..99"] | `h6119/ble/SubModeMusic.java` |
| music V1 rolling | `0x0C` | `0C 02 sensitivity autoFlag [R G B]` | ["autoFlag 0/1","RGB 0-255"] | `h6119/ble/SubModeMusic.java, h612526` |
| music V1 RGB | `0x0E` | `0E style sensitivity autoFlag [R G B]` | ["style 0-3","sensitivity 0..99","autoFlag"] | `rgbiclight/h6160/ble/SubModeMusicV1Rgb.java` |
| new music | `0x13` | `13 style sensitivity [dyn autoFlag [R G B]]` | ["styles rhythm 3 / spectrum 4 / energy 5 / scroll 6","dynamic+mild for rhythm","sensitivity 0..99","auto/manual RGB"] | `h7090/ble/SubModeMusic.java, barelightv1/ble/SubModeMusicV2.java` |
| mic | `0x05` | `05 01` | ["mode select","rhythm points pushed separately"] | `h6185/ble/SubModeMic.java, chassislightv1/ble/SubModeMic.java` |
| mic V2 | `0x13` | `13 10` | ["new mic mode"] | `chassislightv1/ble/SubModeMicV2.java` |
| scene (byte) | `0x04` | `04 effectId` | ["effect id 0-255","IDs: 0 gm,1 sunset,4 film,5 date,7 romantic,8 blinking,9 candle,10 breath,15 snow,16 dynamic,21 chase,22 stream"] | `h6129/ble/SubModeScenes.java` |
| scene (LE16) | `0x04` | `04 effectLo effectHi` | ["16-bit LE effect id","H6163/H6117"] | `rgbiclight/h6160/ble/SubModeScenes.java` |
| extended RGBIC scenes | `0x04 / multi 0x01-0x0A` | `base64 scene blob then 04 <id>` | ["IDs: forest 212, universe 200, meteor 205, aurora 215, lightning 214, star-sky 217, fire 216, ripple 204, deep-sea 203, christmas 221, halloween 110, fireworks 208, party 226, sleep 234, work 249 ...","direction/x/y/speed/music fields inside blob"] | `base2light/ble/scenes/RgbIcScenesV1.java, RgbIcScenesV2/V3, ScenesOp.java` |
| new DIY | `0x0A` | `0A diyLo diyHi` | ["16-bit LE DIY code","mix code 255"] | `h6102/ble/SubModeNewDiy.java` |
| old DIY | `0x07` | `07 [16-byte DIY protocol]` | ["max 4 colors","diy code + params + RGB triples"] | `h6129/ble/SubModeOldDiy.java` |
| DIY upload | `0xA5/0x02` | `diyCode style rgbLen [RGB...] brightLen [brightness...]` | ["multi-packet","up to 4/8 colors per effect","per-color speed max 100"] | `base2light/ble/controller/MultipleDiyController.java, h6102/adjust/Diy.java` |
| graffiti DIY | `0xA5/0x03 or 0x57` | `graffiti IC/point blob` | ["multi-packet","IC-count dependent"] | `base2light/ble/controller/MultiDiyGraffitiController(V3).java` |
| gradient | `0x14 / 0xA3` | `14 00\|01 / A3 00\|01` | ["on/off","per-segment gradual variant"] | `h6119/ble/Gradual4BleController.java, h6160/ble/v1/Gradual4BleWifiController.java` |
| light direction / motion | `scene blob + 0x39` | `direction byte in scene blob; check 0x39` | ["direction","x6/y6 coordinates","speed","music code","focus params"] | `base2light/ble/controller/AbsMultipleControllerV14Scenes.java, ScenesOp.java` |
| car left/right switch | `0x33` | `33 00\|01\|10\|11` | ["0 off, 1 left, 16 right, 17 both"] | `h7090/ble/SwitchLRController.java` |
| car light position | `0x31` | `31 00\|01` | ["0/1 position"] | `h7090/ble/LightPosController.java` |
| sleep | `0x11` | `11 hour min brightness color` | ["4 params"] | `base2light/ble/controller/SleepController.java` |
| wakeup | `0x12` | `12 hour min brightness color` | ["4 params"] | `base2light/ble/controller/WakeUpController.java` |

## split_pact_rgblight

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| colour (8-byte) | `0x02` | `02 R G B flag R2 G2 B2` | ["rgb","tempFlag","background rgb"] | `.../h6159/ble/SubModeColor.java` |
| colour + kelvin (9-byte) | `0x0D` | `0D R G B kHi kLo R2 G2 B2` | ["rgb","kelvin (big-endian)","background rgb"] | `.../h6159/ble/SubModeColor4Bk.java` |
| colour segments (15) | `0x0B` | `0B R G B maskLo maskHi 00 00` | ["rgb","15-bit segment mask"] | `.../h6160/adjust/v1/SubModeColorV1.java` |
| music (legacy) | `0x03` | `03 auto sens [R G B]` | ["auto flag","sensitivity 0-99","rgb (manual)"] | `.../h6159/ble/SubModeMusic.java` |
| music (effect id) | `0x01` | `01 effect sens [R G B]` | ["effect 0-3 / 4-5","sensitivity 0-99","rgb"] | `.../h6104/ble/SubModeMusic.java` |
| music V1 | `0x0E` | `0E effect sens auto [R G B]` | ["effect","sensitivity","auto","rgb"] | `.../h6159/ble/SubModeMusicV1.java` |
| music V2 (new codes) | `0x0E` | `0E musicCode sens \| 0E auto sens manualFlag R G B` | ["musicCode (runtime new-code list)","sensitivity","auto","rgb"] | `.../h6159/ble/SubModeMusicV2.java` |
| music (home light) | `0x0F` | `0F effect sens param auto [R G B]` | ["effect","sensitivity","param","auto","rgb"] | `.../homelightv1/ble/SubModeMusic.java` |
| music (new, 0x13) | `0x13` | `13 effect sens param auto [R G B]` | ["effect","sensitivity","param","auto","rgb"] | `.../carlightv1/ble/SubModeMusicV2.java` |
| mic on/off | `0x05` | `05 00 flag \| 05 01 \| 05` | ["on/off","family-specific length"] | `.../h6165/ble/MicController.java` |
| scene (2-byte id) | `0x04` | `04 lo hi` | ["16-bit LE effect id"] | `.../h6159/ble/SubModeScenes.java` |
| scene (1-byte id) | `0x04` | `04 effect` | ["8-bit effect id"] | `.../h6104/ble/SubModeScenes.java` |
| scene (H7308) | `0xA1` | `A1 effect` | ["effect 20-27: combination,in-waves,sequential,slow-glow,chasing,slow-fade,twinkle,steady-on"] | `.../rgblight/h7308/H7308BleProtocol.java` |
| video sync | `0x00` | `00 videoType syncFlag \| 00 00 syncFlag videoBrightness` | ["part/all/dynamic","soft/hard sync","video brightness (h6104)"] | `.../h6101/ble/SubModeVideo.java` |
| DIY activate | `0x0A` | `0A diyLo diyHi` | ["16-bit LE DIY code"] | `.../h6159/ble/SubModeNewDiy.java` |
| multi-DIY body | `0xA5/0x02` | `[diyCode][effect][subEffect][speed][3N][RGB triples][2M][(effect,subEffect) pairs]` | ["N colour points","M effect steps","speed"] | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/AbsMultipleController4Diy.java` |
| multi-layer scene blob | `0xA3/0x01\|0x02\|0x07\|0x04\|0x0A` | `<raw effect blob from ScenesRgb/ScenesRgbIC/ScenesGraffiti/ScenesCube/ScenesCompose>` | ["effectCode","direction","x","y","speed","musicCode (default 255)","musicSwitch","focusParams(4B for cube)"] | `jadx-base-7.7.10/sources/com/govee/base2light/ble/ScenesOp.java` |
| gradient / gradual | `0xA3/0x01 (h6160)` | `{0\|1}` | ["gradual transition enable"] | `.../h6160/ble/v1/Gradual4BleWifiController.java` |
| carousel / combination (constants only) | `0x5F/0x60/0x61/0x62` | `not emitted by this split` | ["multi carousel","multi combination"] | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/BleProtocolConstants.java` |

## split_pact_security_health

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| lullaby play | `play` | `{val, songId}` | ["song id","play/pause"] | `CmdPlay` |
| lullaby loop/delay/volume | `loop/delayClose/volume` | `{val}` | ["loop 0-2","delay min","volume 1-100"] | `CmdCommon` |
| night light | `nightLight/brightness` | `{val}` | ["on/off","1-100"] | `CmdCommon` |
| arm/disarm | `REST armingState` | `{sku,device,0\|1}` | ["armed state"] | `h5026 RequestDefend` |

## split_pact_tcsocket

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| manual mode | `0x01` | `01` | ["relay/manual","gear STOP"] | `H5770ModeCmd.java` |
| thermo mode | `0x02` | `02 gear tempBE16` | ["gear STOP/AUTO/HEAT/COOL","target temp BE16 *10 (F)"] | `H5770ModeCmd.java` |
| DIY humidity mode | `0x03` | `03 humidityBE16` | ["humidity BE16 *10 %"] | `H5770ModeCmd.java` |
| schedule item | `0x14` | `nameLen,name,index,enabled,startH,startM,endH,endM,repeat,mode4` | ["repeat bit7 enabled, bits0-6 Mon-Sun","max 5 schedules","mode 1 manual / 2 thermo / 3 humidity"] | `H5770ScheduleItemCodec.java` |

## split_pact_thnew

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| temperature warning | `0x04` | `enable minLE16 maxLE16 delayMin` | ["enable","min/max -20..60C x100","delay minutes"] | `Controller4TemWarning` |
| humidity warning | `0x03` | `enable minLE16 maxLE16` | ["0-100% x100"] | `Controller4HumWarning` |
| PM2.5 warning | `0x1B` | `enable minLE16 maxLE16` | ["0-999 ug/m3"] | `Controller4Pm25Warning` |
| CO2 warning/grades | `0x1C/0x1E` | `enable minLE16 maxLE16 \| minLE16 maxLE16` | ["0-5000 ppm","grade default 1100/1800"] | `Controller4Co2Warning; Controller4Co2SetGrade` |
| comfort temperature/humidity | `0x34` | `minTemLE16 maxTemLE16 minHumLE16 maxHumLE16` | ["x100"] | `h5171/Controller4ComfortTemHum` |

## split_pact_tvlightv4

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| legacy color v2 | `0x0B` | `0B R G B kelLo kelHi mask0 mask8` | ["15 segments","mask0 bits 0-7","mask8 bits 8-14"] | `pact_tvlightv2/ble/SubModeColor.java` |
| color v3/v4 | `0x0D` | `0D sel R G B kelLo kelHi R2 G2 B2` | ["sel 0/1/16/17","kelvin signed LE16","R2G2B2 temperature colour"] | `pact_tvlightv3/ble/SubModeColor.java; pact_tvlightv4/ble/SubModeColor.java` |
| color V2 15-seg | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask0 mask8` | ["15 segments","12 bytes"] | `pact_tvlightv2/ble/SubModeColorV2.java` |
| color V2 12-seg | `0x15` | `15 01 R G B kelLo kelHi R2 G2 B2 mask0 mask1 (17B)` | ["12 segments","mask0 bits0-7","mask1 bits8-11","mode 02 = per-segment brightness","mode 03 = raw RGB list"] | `pact_tvlightv4/ble/SubModeColorV2.java; pact_tvlightv3/ble/SubModeColorV2.java` |
| music old | `0x0C` | `0C effect sens [dynFlag [R G B]]` | ["sensitivity 0..99","effect 0 Energic/2 Rolling/3 Spectrum/5 Rhythm (v2)","v3/v4 0/5/6/7 + 73 Beat + 80 Torch + 81 Rainbow Circle + 82 Shiny"] | `pact_tvlightv2/ble/SubModeMusic.java; pact_tvlightv3/ble/SubModeMusic.java; pact_tvlightv4/ble/SubModeMusic.java` |
| music new | `0x13` | `13 effect sens [10] [dyn] [sel R G B]` | ["3 Rhythm/5 Energic/8 Rolling/9 Spectrum","9B for effect 3, 8B for 5/8/9, 3B otherwise","sel 0/1/16/17"] | `pact_tvlightv4/ble/SubModeMusicV2.java` |
| music new v2 | `0x13` | `13 effect sens 10 dyn R G B` | ["default effect 5","fixed 0x10"] | `pact_tvlightv2/ble/SubModeMusicV2.java` |
| music new v3 | `0x13` | `same as v4 new` | ["ParamsSubMode4Music selects V2 vs V3 parser by version"] | `pact_tvlightv3/adjust/ParamsSubMode4Music.java; pact_tvlightv3/ble/SubModeMusicV3.java` |
| scene | `0x04` | `04 effectLo effectHi` | ["16-bit LE scene code","static TV set 13,4,9,7,24,10,16,15,29,30,21,22","may expand to multi-frame A3/A4 chunks"] | `pact_tvlightv4/ble/SubModeScenes.java; pact_tvlightv4/adjust/ui/ScenesV0.java` |
| DIY | `0x0A` | `0A diyLo diyHi` | ["16-bit LE DIY code","multi-frame body first"] | `pact_tvlightv4/ble/SubModeNewDiy.java; pact_tvlightv4/iot/v2/CmdPtReal.java` |
| video (new) | `0x00` | `00 screenState drama vivid voiceOn voice rlBrightness` | ["screenState 0 part/1 all/2 full","drama 0 movie/1 game","vivid 1..100","voiceOn 0/1","voice 0..100","rlBrightness 0..100"] | `pact_tvlightv4/ble/SubModeVideoV2.java` |
| video (old v4) | `0x00` | `00 00 drama vivid 00 00 rlBrightness` | ["legacy 7-byte form"] | `pact_tvlightv4/ble/SubModeVideo.java` |
| video (v2) | `0x00` | `00 allBars drama vivid voiceOn voice rlBrightness` | ["allBars 0/1"] | `pact_tvlightv2/ble/SubModeVideo.java` |
| gradient / multi-layer | `0x15/0x04` | `per-segment colour via 0x15 + multi-frame scene chunks` | ["12 segment masks (v3/v4), 15 (v2)"] | `pact_tvlightv4/ble/SubModeColorV2.java` |

## split_pfdv1

| Effect / mode | Sub-mode | Payload | Attributes | Source |
|---|---|---|---|---|
| color (H7001/H7023) | `0x08` | `08 m0 m1 m2 R G B 00` | ["24-bit segment mask","RGB 0-255"] | `SubModeColor.java` |
| mic select (H7001/H7023) | `0x05` | `05 01` | ["music/mic mode"] | `SubModeMic.java` |
| mic dynamic/mild (H7001/H7023) | `0x05/0x03` | `05 03 01\|00` | ["dynamic","mild"] | `MicController.java` |
| scene (H7001/H7023) | `0x09` | `09 00 x15` | ["scene index sent via multi-scene"] | `SubModeScenes.java` |
| multi-scene (H7001/H7023) | `0xA5/0x01` | `00 effect subEffect speed colorCount colors...` | ["effect 0 illumination,1 fade,2 raindrops,3 colorful,4 marquee,5 blinking,6 snow","speed 0-100","RGB colors"] | `ScenesModeController.java` |
| color (H7024) | `0x0B` | `0B R G B m0 m1 m2 00` | ["RGB first","24-bit segment mask","trailing 0"] | `H7024SubModeColor.java` |
| music (H7024) | `0x01` | `01 effect sens` | ["effect 4 mild / 5 dynamic","sensitivity 0-99"] | `SubModeMusic.java` |
| scene (H7024) | `0x09` | `09 type+1 00 x15` | ["type 0..7"] | `SubModeScenes.java` |
| multi-scene (H7024) | `0xA5/0x01` | `code effect subEffect speed colorCount colors...` | ["code=type+1","effect=type","default colors"] | `Common.makeScene4BleComm` |
