# Command catalog (BLE and IoT)

Actual device commands, deduplicated per split: a command shared by many SKUs appears once and its scope is the split's SKU set. `op` is `proType/cmdType` for BLE and the IoT `cmd` name for IoT. Payloads are shown after the 20-byte BLE header; see `PROTOCOLS.md` for framing.

**Transport wrappers are not commands.** `pt`, `ptReal`, `ptIot`, `multiSync` and `ptUrl` are cloud envelopes that carry one or more 20-byte frames; `op`/`state` are read envelopes/keys. They are listed separately under each split's **Transport formats** table. The actual command is the semantic BLE/IoT command row below (e.g. `timer write` with its `iceSize` field).

## split_pact_bbqnew

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `BLeDataComm; Model` |
| `op` | read envelope | {"command":["<base64 20-byte frame>"]} | `Vm4BbqOpManager.parsePtResponse` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | device id / heart | BLE frame via ptReal | `0x33/0x01 or 0x24` | per SKU | H5055/H5610 heart opcode 0x24 (36), other SKUs 0x01 | 0xAA/0x01 or 0xAA/0x24 -> heart bytes | `Controller4DeviceId; Controller4BbqHeartV1` |
| 2 | temperature unit | BLE frame via ptReal | `0x33/0x02` | 00 Celsius \| 01 Fahrenheit | [0] enum ordinal | ack | `Controller4TemUnit; Controller4TempUnit` |
| 3 | heart / probe warning | BLE frame via ptReal | `0xAA/0x03` |  | read only; probe bitmasks + 6x int16 BE temperatures | [0..1]=connected mask, [2..3]=alarm mask, then temps | `Controller4BbqHeartV1; Controller4BbqHeart` |
| 4 | hardware version | BLE frame via ptReal | `0xAA/0x04` |  | read only | version bytes | `Controller4HardVersion` |
| 5 | software version | BLE frame via ptReal | `0xAA/0x05` |  | read only | version bytes | `Controller4SoftVersion` |
| 6 | buzzer switch | BLE frame via ptReal | `0x33/0x07` | 00\|01 | [0] on/off | ack | `Controller4SwitchBuzzer` |
| 7 | temperature calibration | BLE frame via ptReal | `0x33/0x08` | calLE16 | signed int16, x100 | ack | `Controller4TemCali` |
| 8 | preset food type | BLE frame via ptReal | `0x33/0x09` | foodType | [0] id | ack | `Controller4TempPresetFoodType` |
| 9 | time sync | BLE frame via ptReal | `0x33/0x0A` | tsLE32 | epoch seconds LE | ack | `Controller4SyncTime` |
| 10 | device id | BLE frame via ptReal | `0xAA/0x0C or 0x06` |  | read only; SKU-dependent | id bytes | `Controller4DeviceId` |
| 11 | BLE hardware | BLE frame via ptReal | `0xAA/0x0D` |  | read only | version | `Controller4HardVersion` |
| 12 | BLE software | BLE frame via ptReal | `0xAA/0x0E` |  | read only | version | `Controller4SoftVersion` |
| 13 | WiFi MAC | BLE frame via ptReal | `0xAA/0x0F` |  | read only | 6-byte MAC | `Controller4WifiMac` |
| 14 | probe id / long life | BLE frame via ptReal | `0x33/0x10` | probeId \| enable | [0] | ack | `Controller4ProbePair; Controller4SwitchLongLife` |
| 15 | preset environment temp (H5055/H5199) | BLE frame via ptReal | `0x33/0x11` | probeId highLE16 lowLE16 foodType subTypeLE16 | temps x100, 0xFFFF = unset | ack | `PresetEnvTempController` |
| 16 | preset probe target | BLE frame via ptReal | `0x33/0x12` | target | [0] temp code | ack | `Controller4PresetFtTem` |
| 17 | timer / data set | BLE frame via ptReal | `0x33/0x13` | see timer beans | group/enable/time/mode/... | ack | `pact_bbqnew timer UI` |
| 18 | pre-warn | BLE frame via ptReal | `0x33/0x0C or 0x27` | enable tempLE16 | [0] enable, [1..2] temp x100; 0x27 for H5055/H5610, 0x0C otherwise | ack | `Controller4PreWarn; Controller4TempBatteryProbeWarning` |
| 19 | WiFi hard version | BLE frame via ptReal | `0xAA/0x20` |  | read only | version | `Controller4WifiHardVersion` |
| 20 | WiFi soft version | BLE frame via ptReal | `0xAA/0x21` |  | read only | version | `Controller4WifiSoftVersion` |
| 21 | temp/humidity warning | BLE frame via ptReal | `0x33/0x22` | enable minLE16 maxLE16 | temps x100 | ack | `Controller4TempBatteryProbeWarning` |
| 22 | stop send | BLE frame via ptReal | `0x33/0x23` |  | stop streaming | ack | `Controller4StopSend` |
| 23 | IOT temperature (H5199) | BLE frame via ptReal | `0x33/0x24` | probeId tempLE16 humLE16 tsLE32 | temp/hum x100 | ack | `Controller4IotTemData` |
| 24 | buzzer gear / volume | BLE frame via ptReal | `0x33/0x25` | gear | [0] gear | ack | `Controller4BuzzerGear; Controller4VolumeGear` |
| 25 | auto reduce brightness | BLE frame via ptReal | `0x33/0x26` | enable brightness time | 3 bytes | ack | `Controller4AutoReduceBrightness` |
| 26 | auto shutdown | BLE frame via ptReal | `0x33/0x26` | enable | [0] | ack | `ControllerAutoShutdown` |
| 27 | clear data | BLE frame via ptReal | `0x33/0x28` | probeId | [0] | ack | `Controller4ClearData` |
| 28 | volume | BLE frame via ptReal | `0x33/0x30` | volume | [0] | ack | `base Controller4Volume` |
| 29 | remain time (H5199) | BLE frame via ptReal | `0xAA/0x32` |  | read only | [hour0,hour1,min0,min1] | `Controller4RemainTime` |
| 30 | close alarm | BLE frame via ptReal | `0x33/0x33` | 01 alarmId | [0]=1, [1] alarm id | ack | `Controller4CloseAlarm` |
| 31 | clear probe | BLE frame via ptReal | `0x33/0x40` | probeId | [0] | ack | `Controller4ClearProbe` |
| 32 | probe pairing | BLE frame via ptReal | `0x33/0x41` | probeId | [0] | ack | `Controller4ProbePair` |
| 33 | break probe pairing | BLE frame via ptReal | `0x33/0x42` |  | none | ack | `Controller4BreakProbePair` |
| 34 | upload interval | BLE frame via ptReal | `0x33/0x62` | 00 interval | [0]=0, [1] interval | ack | `Controller4UploadInterval` |
| 35 | probe id (temp data, H5199) | BLE frame via ptReal | `0x33/0x21` | probeId | [0] | ack | `pact_h5199 Controller4TdSetProbeId` |
| 36 | time range (temp data, H5199) | BLE frame via ptReal | `0x33/0x22` | startLE16 endLE16 | minutes | ack | `pact_h5199 Controller4TdTimeRange` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | heart | BLE notify via ptReal | `0xAA/0x03` |  | COMMON: [0..1] temp BE16, [2..3] hum BE16, [4..5] third temp BE16, [6] battery, [7] flags; WITH_THIRD: same + bitmask; DUAL_PROBE: [0..1] temp, [2..3] hum, [4] battery, [5] flags; H5220/BBQ: + [5] switch |  | `Controller4BbqHeartV1` |
| 2 | heart H5055 legacy | BLE notify via ptReal | `0xAA/0x01` |  | [0..1] probe1 temp BE16, [2..3] probe1 hum BE16 (JADX stub) |  | `Controller4BbqHeart.w` |
| 3 | heart H5199 | BLE notify via ptReal | `0xAA/0x03` |  | bitmask + 6x int16 BE temperatures, battery/unit byte (JADX stub) |  | `pact_h5199 Controller4Heart.l` |
| 4 | history data | BLE notify via ptReal | `0x2b12 chunks` |  | 16-byte records: relative time + per-probe temperature |  | `BLeDataComm` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | online | IoT JSON | `online` | {} | {} | subscription | `BbqnewModel` |
| 2 | status | IoT JSON | `status` | {} | {} | device status | `BbqnewModel` |

## split_pact_bulblightstringv1

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `pt` | transport wrapper | {"op":"mode\|sleep\|wakeup\|timer\|scenes","value":["<base64 20-byte BLE frame>"]} | `com/govee/bulblightstringv1/iot/CmdPt.java; com/govee/h7022/iot/CmdPt.java` |
| `ptReal` | transport wrapper | {"command":["<base64 20-byte BLE frame>"]} | `com/govee/bulblightstringv2/iot/CmdPtReal.java; com/govee/bulblightv3/iot/CmdPtReal.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|pt | `0x33/0x01` | 01 on \| 00 off | [0] on/off | 0xAA/0x01 -> [0]!=0 | `base:com/govee/base2light/ble/controller/SwitchController.java` |
| 2 | heartbeat | BLE frame via ptReal\|pt | `0xAA/0x01` | empty | no payload | 0xAA/0x01 -> [0] state | `base:com/govee/base2light/ble/controller/HeartController.java` |
| 3 | brightness | BLE frame via ptReal\|pt | `0x33/0x04` | 01..64 (percent) | [0] brightness | 0xAA/0x04 -> [0] brightness | `base:com/govee/base2light/ble/controller/BrightnessController.java` |
| 4 | brightness-legacy-scaled | BLE frame via ptReal\|pt | `0x33/0x04` | 20..254 | NumUtil.calculateProgress(254,20,b) | 0xAA/0x04 | `com/govee/bulblightstringv1/h6001/sku/Sku.java` |
| 5 | mode-container | BLE frame via ptReal\|pt | `0x33/0x05` | <sub-mode block> | [0]=subMode [1..]=sub-mode payload | 0xAA/0x05 payload {01} -> [0]=subMode | `base:com/govee/base2light/ble/controller/AbsModeController.java` |
| 6 | color-bulbstring-0x0B | BLE frame via ptReal\|pt | `0x33/0x05` | 0B RR GG BB m0..m9 | [0]=0x0B [1..3]=RGB [4..13]=80-bit bulb mask (bit0=first) |  | `com/govee/bulblightstringv1/ble/SubModeColor.java` |
| 7 | color-h7022-0x0B | BLE frame via ptReal\|pt | `0x33/0x05` | 0B RR GG BB m0 m1 m2 | [0]=0x0B [1..3]=RGB [4..6]=24-bit mask |  | `com/govee/h7022/adjust/mode/H7022SubModeColor.java` |
| 8 | color-h6001-old-0x02 | BLE frame via ptReal\|pt | `0x33/0x05` | 02 RR GG BB ct R2 G2 B2 | [0]=0x02 [1..3]=RGB [4]=ct flag [5..7]=temperature RGB |  | `com/govee/bulblightstringv1/h6001/ble/SubModeColor.java` |
| 9 | color-0x0D | BLE frame via ptReal\|pt | `0x33/0x05` | 0D RR GG BB ctLo ctHi R2 G2 B2 | [0]=0x0D [1..3]=RGB [4..5]=kelvin LE16 [6..8]=temp RGB |  | `com/govee/bulblightstringv1/bulblightv2/ble/SubModeColor.java; com/govee/bulblightv3/ble/SubModeColor.java` |
| 10 | color-0x15-generic | BLE frame via ptReal\|pt | `0x33/0x05` | 15 <variant> ... | variant 01=RGB+CT+mask, 02=RGB+mask, 03=brightness set, 04=segment RGB, 05=multi RGB+mask |  | `base:com/govee/base2light/pact/newdetail/config/fuc/color/Bytes.java` |
| 11 | scenes-2byte-0x04 | BLE frame via ptReal\|pt | `0x33/0x05` | 04 idLo idHi | [0]=0x04 [1..2]=effect id LE16 |  | `com/govee/bulblightv3/ble/SubModeScenes.java; com/govee/bulblightstringv2/ble/SubModeScenes.java` |
| 12 | scenes-stringv2-0x04-speed | BLE frame via ptReal\|pt | `0x33/0x05` | 04 idLo idHi speed | [3]=speed; 0xFF when speed unsupported |  | `com/govee/bulblightstringv2/ble/SubModeScenes.java` |
| 13 | scenes-1byte-0x04 | BLE frame via ptReal\|pt | `0x33/0x05` | 04 id | [0]=0x04 [1]=effect id |  | `com/govee/bulblightstringv1/h6001/ble/SubModeScenes.java` |
| 14 | scenes-bulbstring-0x09 | BLE frame via ptReal\|pt | `0x33/0x05` | 09 <effect+1> 00... | 17-byte block; [1]=effect index + 1 |  | `com/govee/bulblightstringv1/ble/SubModeScenes.java; com/govee/h7022/adjust/mode/SubModeScenes.java` |
| 15 | music-0x0E | BLE frame via ptReal\|pt | `0x33/0x05` | 0E auto sens flag [RR GG BB] | auto 0/1, sens 0..99, flag 1 when RGB present |  | `com/govee/bulblightstringv1/ble/SubModeMusic.java` |
| 16 | mic-mode-0x05 | BLE frame via ptReal\|pt | `0x33/0x05` | 05 01 | enter music/mic mode |  | `com/govee/bulblightstringv1/h6001/ble/SubModeMic.java; com/govee/bulblightv3/ble/SubModeMic.java` |
| 17 | mic-rhythm-point | BLE frame via ptReal\|pt | `0x33/0x05` | 05 00 RR GG BB | one beat colour point |  | `com/govee/bulblightstringv1/bulblightv2/ble/MicController.java; com/govee/bulblightv3/ble/MicController.java` |
| 18 | diy-select-0x0A | BLE frame via ptReal\|pt | `0x33/0x05` | 0A codeLo codeHi | select uploaded DIY code |  | `com/govee/bulblightstringv1/bulblightv2/ble/SubModeNewDiy.java; com/govee/bulblightv3/ble/SubModeNewDiy.java` |
| 19 | bulb-number | BLE frame via ptReal\|pt | `0x33/0x0F` | n | [0]=string count | 0xAA/0x0F -> [n] | `com/govee/bulblightstringv1/ble/BulbNumController.java; com/govee/h7022/ble/BulbNumController.java` |
| 20 | read-bulb-group-color | BLE frame via ptReal\|pt | `0xAA/0xA2` | groupIndex 1..6 | [0]=group index | 0xAA/0xA2 -> [0]=index [1..12]=4xRGB | `com/govee/bulblightstringv1/ble/BulbStringColorController.java; com/govee/h7022/ble/ReadBulbColorController.java` |
| 21 | multi-scene | BLE frame via ptReal\|pt | `0xA1/0x01` | start [00][count][00]; chunks [idx][16B]; end [FF] | effect+1, effect, 0, speed, colorLen, RGB triplets |  | `base:com/govee/base2light/ble/comm/MultipleControllerComm.java` |
| 22 | multi-diy | BLE frame via ptReal\|pt | `0xA1/0x02` | start [00][count][00]; chunks [idx][16B]; end [FF] | diyCode, effect, subEff, speed, colorLen, RGB..., subEffCount, pairs |  | `base:com/govee/base2light/ble/controller/AbsMultipleController4Diy.java` |
| 23 | multi-diy-v1 | BLE frame via ptReal\|pt | `0xA3/0x04` | start [A3 00 01 count 04 <first14>]; middle [A3 n <17B>]; end [A3 FF <last17>] | DiyProtocol.toBytes() |  | `base:com/govee/base2light/ble/comm/MultipleControllerCommV1.java` |
| 24 | h601ef-diy-blob | BLE frame via ptReal\|pt | `0xA3/0x58` | MultiController TLV | [totalLen LE16][mainLen LE16][01 04 speed count RGB...][subLen LE16][01 type body] |  | `com/govee/bulblightv3/newdetail/diy/H601EFDiyParse.java` |
| 25 | h601ef-segment-color | BLE frame via ptReal\|pt | `0xA3/0x6E` | MultiController of 0x15 blocks | 15 04 segmentIndex RGB (4/pkt) / 15 05 ... |  | `base:com/govee/base2light/pact/newdetail/config/fuc/color/ColorModeControllerConfig.java` |
| 26 | solar-battery-read | BLE frame via ptReal\|pt | `0xAC/0x0E` | empty | single-send multi-back | [0..1]=len LE16 [2]=interval min [3..4]=pointCount LE16 [5..]=battery pairs | `com/govee/bulblightv3/solar/controller/ReadBatteryInfoController.java` |
| 27 | solar-brightness-strategy | BLE frame via ptReal\|pt | `0x33/0x43` | brightness | [0]=brightness | 0xAA/0x43 -> validBytes | `com/govee/bulblightv3/solar/controller/Controller4BrightnessStrategy.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi-connect | BLE notify via ptReal\|pt | `0xEE/0x11` |  | [0]==0 means WiFi connected |  | `com/govee/bulblightstringv1/ble/WifiNotifyParse.java; com/govee/bulblightstringv2/ble/WifiNotifyParse.java; com/govee/bulblightv3/ble/WifiNotifyParse.java; com/govee/h7022/ble/WifiNotifyParse.java` |
| 2 | brightness | BLE notify via ptReal\|pt | `0xEE/0x20` |  | [0] brightness |  | `com/govee/bulblightstringv1/bulblightv2/ble/BrightnessNotifyParse.java; com/govee/bulblightstringv2/ble/BrightnessNotifyParse.java` |
| 3 | movie-feast | BLE notify via ptReal\|pt | `0xEE/0x60` |  | [0]==1 valid; [1]==1 on |  | `base:com/govee/base2light/ble/controller/MovieFeastOnOffNotifyParse.java` |
| 4 | mode-read-reply | BLE notify via ptReal\|pt | `0xAA/0x05` |  | validBytes[0]=sub-mode id; remaining -> Mode.parseSubMode |  | `base:com/govee/base2light/ble/controller/AbsMode.java` |
| 5 | bulb-group-color-reply | BLE notify via ptReal\|pt | `0xAA/0xA2` |  | [0]=groupIndex; [1..12]=4xRGB |  | `com/govee/bulblightstringv1/ble/BulbGroupColor.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | online | IoT JSON | `online` | {} | {} | status/online state | `com/govee/bulblightstringv1/pact/Model4BleIot.java; com/govee/bulblightv3/pact/Model.java` |
| 2 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `*/iot/CmdTurn.java` |
| 3 | brightness | IoT JSON | `brightness` | {"val":"0..100"} | {"val":"0..100"} | status | `*/iot/CmdBrightness.java` |
| 4 | status | IoT JSON | `status` | {} | {} | state/config status object | `*/iot/CmdStatus*.java` |
| 5 | color | IoT JSON | `color` | {"r":"0..255","g":"0..255","b":"0..255"} | {"r":"0..255","g":"0..255","b":"0..255"} | status | `com/govee/bulblightstringv1/bulblightv1/iot/CmdColor.java` |
| 6 | colorTem | IoT JSON | `colorTem` | {"colorTemInKelvin":"int","color":{"r":0,"g":0,"b":0}} | {"colorTemInKelvin":"int","color":{"r":0,"g":0,"b":0}} | status | `com/govee/bulblightstringv1/bulblightv1/iot/CmdColorTem.java` |
| 7 | colorwc | IoT JSON | `colorwc` | {"color":{"r":"0..255","g":"0..255","b":"0..255"},"colorTemInKelvin":"int"} | {"color":{"r":"0..255","g":"0..255","b":"0..255"},"colorTemInKelvin":"int"} | status | `com/govee/bulblightv3/iot/CmdColorWc.java` |
| 8 | mode | IoT JSON | `mode` | {"mode":"1=scene\|3=DIY","code":"int","color":"[{r,g,b}]","effect":"int","subEff":"int","speed":"int","effArr":"[{effect,subEff}]"} | {"mode":"1=scene\|3=DIY","code":"int","color":"[{r,g,b}]","effect":"int","subEff":"int","speed":"int","effArr":"[{effect,subEff}]"} | status | `com/govee/bulblightstringv1/bulblightv1/iot/CmdMode.java; CmdModeDiy.java` |
| 9 | bulb | IoT JSON | `bulb` | {"value":["<base64 20-byte BLE frame>"]} | {"value":["<base64 20-byte BLE frame>"]} | pt/bulb read of 20-byte frames | `com/govee/bulblightstringv1/iot/CmdBulb.java; com/govee/h7022/iot/CmdBulbColor.java` |
| 10 | string | IoT JSON | `string` | {"val":"int"} | {"val":"int"} | stringNum | `com/govee/bulblightstringv1/iot/CmdString.java` |
| 11 | timer | IoT JSON | `timer` | {"group":"int","enable":"0\|1","type":"int","hour":"int","minute":"int","repeat":"byte bitmask","timeOffset":"int","timeOffsetMinute":"int","timeStamp":"int"} | {"group":"int","enable":"0\|1","type":"int","hour":"int","minute":"int","repeat":"byte bitmask","timeOffset":"int","timeOffsetMinute":"int","timeStamp":"int"} | config.time[4] | `com/govee/bulblightstringv1/bulblightv1/iot/CmdTimer.java; com/govee/h7022/iot/CmdTimer.java` |
| 12 | sleep | IoT JSON | `sleep` | {"enable":"0\|1","startBri":"int","closeTime":"int","curTime":"int","timeOffset":"int","timeStamp":"int"} | {"enable":"0\|1","startBri":"int","closeTime":"int","curTime":"int","timeOffset":"int","timeStamp":"int"} | config.sleep | `com/govee/bulblightstringv1/bulblightv1/iot/CmdSleep.java` |
| 13 | wakeup | IoT JSON | `wakeup` | {"enable":"0\|1","endBri":"int","wakeHour":"int","wakeMin":"int","repeat":"byte","wakeTime":"int","timeOffset":"int","timeStamp":"int"} | {"enable":"0\|1","endBri":"int","wakeHour":"int","wakeMin":"int","repeat":"byte","wakeTime":"int","timeOffset":"int","timeStamp":"int"} | config.wakeup | `com/govee/bulblightstringv1/bulblightv1/iot/CmdWakeUp.java` |

## split_pact_fanlight

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `base2light/kt/iot/Cmd4PtReal; fanlight VM4Light.getCurCompleteCmd` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal | `0x33/0x01` | 01 <0/1> | [0] 0=off 1=on | 0xAA/0x01 -> [0] state | `base2light/ble/controller/SwitchController.java` |
| 2 | brightness | BLE frame via ptReal | `0x33/0x04` | 04 <1..100> | [0] brightness 1-100 | 0xAA/0x04 -> [0] brightness | `base2light/ble/controller/BrightnessController.java` |
| 3 | heartbeat | BLE frame via ptReal | `0xAA/0x01` | 01 | no payload | [0] non-zero = alive | `base2light/ble/controller/HeartController.java` |
| 4 | fan_switch | BLE frame via ptReal | `0x33/0x31` | 31 00 <0/1> | [0]=0x00 subtype, [1] on/off | 0xAA/0x31 fan info notify | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/ble/ControllerFan.java` |
| 5 | fan_gear | BLE frame via ptReal | `0x33/0x31` | 31 01 <gear> | [0]=0x01 subtype, [1] gear 1..6 (H1310) / 1..12 (H1370) | 0xAA/0x31 subtype 1 -> [1] gear | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/ble/ControllerFan.java` |
| 6 | fan_reverse | BLE frame via ptReal | `0x33/0x31` | 31 02 <0/1> | [0]=0x02 subtype, [1] reverse wind | 0xAA/0x31 subtype 2 | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/ble/ControllerFan.java` |
| 7 | fan_mode | BLE frame via ptReal | `0x33/0x31` | 31 03 01 00 <mode> [auto6] | [0]=0x03, [1]=0x01, [2]=0x00, [3] mode 0=direct 1=sleep 2=natural 3=auto; when 3, 6 auto-program bytes appended | 0xAA/0x31 subtype 3 -> [1..2] int16 LE shake/aux | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/ble/ControllerFan.java` |
| 8 | fan_shake | BLE frame via ptReal | `0x33/0x31` | 31 04 <0/1> | [0]=0x04 subtype, [1] shake/oscillate head (H1370) | 0xAA/0x31 subtype 4 | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/ble/ControllerFan.java` |
| 9 | sub_light_switch | BLE frame via ptReal | `0x33/0x36` | 36 <idx> <0/1> | [0] 0=main light, 1=back light; [1] on/off | 0xAA/0x36 | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/ble/ControllerSubSwitch.java` |
| 10 | remote_pair | BLE frame via ptReal | `0x33/0xA4` | A4 01 | [0]=1 start pairing | 0xAA/0xA4 -> [0] result | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/ble/RemoteController.java` |
| 11 | remote_exit_pair | BLE frame via ptReal | `0x33/0xA6` | A6 | no payload | 0xAA/0xA6 | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/ble/ExitRemoteController.java` |
| 12 | color_or_colortem | BLE frame via ptReal | `0x33/0x05` | 05 15 <subtype...> | shared 0x15 color instruction: subtype 1=RGB+CT+mask (01 R G B CT_H CT_L R2 G2 B2 M0 M1 M2 M3), subtype 2=brightness (02 val M0 00 00), subtype 3=brightness set, subtype 4=strip group (04 group R G B ...) | 0xAA/0x05 payload 01 | `capability/FanlightLightCapabilitySpecKt.java (ColorInstructionVersion.COLOR_MODE_0X15); format per base2light SubModeColor 0x15` |
| 13 | scene | BLE frame via ptReal | `0x33/0x05` | 05 04 <effLo> <effHi> | 16-bit little-endian effect code, no speed byte | 0xAA/0x05 subtype 4 | `base2light/ble/controller/AbsModeController.java + ScenesOp` |
| 14 | diy | BLE frame via ptReal | `0x33/0x05` | 05 0A <diyLo> <diyHi> | 16-bit little-endian DIY code | 0xAA/0x05 subtype 10 | `base2light/pact/newdetail/sub/SubMode4Diy.java` |
| 15 | music | BLE frame via ptReal | `0x33/0x05` | 05 13 <musicCode> <sensitivity> | musicCode (cloud/online music id), sensitivity 0..99 | 0xAA/0x05 subtype 19 | `base2light music sub-mode` |
| 16 | read_mode | BLE frame via ptReal | `0xAA/0x05` | 05 01 | AbsModeController.p() = {0x01} | 0xAA/0x05 -> [0] mode, [1..] sub-mode | `base2light/ble/controller/AbsModeController.java` |
| 17 | read_color_group | BLE frame via ptReal | `0xAA/0xA5` | A5 <group> | response [0]=group, then 4 x (brightness,R,G,B) | 0xAA/0xA5 | `base2light/kt/general_controller/Controller4ColorInfoByGroup.java` |
| 18 | read_auto_program | BLE frame via ptReal | `0xAA/0x32` | 32 01 | response: [1] onGear, [2..3] onTemp int16 LE degF*100, [4] keepGear, [5..6] keepTemp int16 LE degF*100 | 0xAA/0x32 | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/sensor/SensorBleReads.java + h1370/FanAutoProgram.java` |
| 19 | read_bound_sensor_mac | BLE frame via ptReal | `0xAA/0x08` | 08 | response 6-byte MAC, reversed order | 0xAA/0x08 | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/sensor/SensorBleReads.java` |
| 20 | read_sensor_data | BLE frame via ptReal | `0xAA/0x10` | 10 | response: [0] bit0 online bit7 built-in; [1..3] packed temp 24-bit LE unit 0.001 degC bit23=sign; [4] offset minutes; [5] unit 1=degF else degC; 0xFFFFFF=invalid | 0xAA/0x10 | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/sensor/SensorBleParser.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | light_switches | BLE notify via ptReal | `0xEE/0x30` |  | [1] overall switch, [2] main light, [3] back light |  | `base2light/kt/general_parser/DefParser.java makeFanlightSwitchNotifyParser` |
| 2 | fan_info | BLE notify via ptReal | `0xEE/0x31` |  | [0] sub-type 0=fan on [1]==1, 1=gear [1], 2=reverse [1]==1, 3=shake int16 LE [1..2], 4=auto/standby [1]==1 |  | `base2light/kt/general_parser/DefParser.java makeFanlightInfoNotifyParser` |
| 3 | brightness | BLE notify via ptReal | `0xEE/0x20` |  | [0] brightness 0-100 |  | `base2light/kt/general_parser/DefParser.java makeBrightnessNotifyParser` |
| 4 | device_status | BLE notify via ptReal | `0xEE/0x40` |  | first 10 payload bytes forwarded to EventDeviceStatus |  | `base2light/ble/DeviceStatusNotifyParse.java` |
| 5 | remote_control | BLE notify via ptReal | `0xEE/0xA4` |  | [0] remote pairing/status byte |  | `base2light/kt/general_parser/DefParser.java makeRemoteControlNotifyParser` |
| 6 | wifi | BLE notify via ptReal | `0xEE/0x11` |  | [0]==0 -> WiFi connected |  | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/ble/BleNotifyComm.java` |
| 7 | music | BLE notify via ptReal | `0xEE/0x70+` |  | OnlineSound MusicNotifyParse frames |  | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/ble/BleNotifyComm.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0/1"} | {"val":"0/1"} | status | `jadx-splits/split_pact_fanlight/sources/com/govee/fanlight/pact/IotSwitchCmdBuilder.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"1..100"} | {"val":"1..100"} | status | `base2light/iot/CmdBrightness + fanlight OpCommDialog4BleIotV1` |
| 3 | colorwc | IoT JSON | `colorwc` | {"colorTemInKelvin":"2700..6500","red":"0..255","green":"0..255","blue":"0..255"} | {"colorTemInKelvin":"2700..6500","red":"0..255","green":"0..255","blue":"0..255"} | status | `base2light/iot/CmdColorWc` |
| 4 | status | IoT JSON | `status` | {} | {} | state+op | `base2light AbsIotManagerV1` |
| 5 | online | IoT JSON | `online` | {} | {} | status | `base2light AbsIotManagerV1` |

## split_pact_floorlamp

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `h6071/iot/CmdPtReal.java; h60b0/pact/Comm.java; h60b1/pact/Comm.java` |
| `ptUrl` | transport wrapper | {"url":"string","command":"base64 workspace"} | `base2light/light/AbsOpCommDialog4BleIot CmdPtUrl` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|ptUrl | `0x33/0x01` | 01 <0/1> | [0] state | 0xAA/0x01 -> [0] | `base2light/ble/controller/SwitchController.java` |
| 2 | brightness | BLE frame via ptReal\|ptUrl | `0x33/0x04` | 04 <1..100> | [0] brightness | 0xAA/0x04 -> [0] | `base2light/ble/controller/BrightnessController.java` |
| 3 | heartbeat | BLE frame via ptReal\|ptUrl | `0xAA/0x01` | 01 | no payload | [0] non-zero alive | `base2light/ble/controller/HeartController.java` |
| 4 | read_mode | BLE frame via ptReal\|ptUrl | `0xAA/0x05` | 05 01 | AbsModeController.p() = {0x01} | mode + sub-mode | `base2light/ble/controller/AbsModeController.java` |
| 5 | read_color_group | BLE frame via ptReal\|ptUrl | `0xAA/0xA5` | A5 <group> | response [0]=group, then 4 x (brightness,R,G,B) | 0xAA/0xA5 | `base2light/kt/general_controller/Controller4ColorInfoByGroup.java` |
| 6 | color_tem | BLE frame via ptReal\|ptUrl | `0x33/0x05` | 05 15 04 <kelvinLo> <kelvinHi> | sub-mode 0x15, flag 0x04, kelvin int16 LE clamped 2200-6500 | 0xAA/0x05 sub-mode 0x15 | `jadx-splits/split_pact_floorlamp/sources/com/govee/h6071/ble/SubModeColor.java` |
| 7 | scene | BLE frame via ptReal\|ptUrl | `0x33/0x05` | 05 04 <effLo> <effHi> <speed> | effect int16 LE; speed byte default 0xFF | 0xAA/0x05 sub-mode 0x04 | `jadx-splits/split_pact_floorlamp/sources/com/govee/h6071/ble/SubModeScenes.java` |
| 8 | secret_key_write | BLE frame via ptReal\|ptUrl | `0x33/0xB2` | <raw secret bytes> | base64 secret decoded and written verbatim | write result | `base2light/ble/controller/SecretKeyController.java` |
| 9 | secret_key_read | BLE frame via ptReal\|ptUrl | `0xAA/0xB1` |  | 8-byte result | 8 bytes | `base2light/ble/controller/SecretKeyController.java` |
| 10 | color | BLE frame via ptReal\|ptUrl | `0x33/0x05` | 05 0D R G B CT_H CT_L R2 G2 B2 | sub-mode 0x0D; CT 16-bit big-endian (kelvin in white mode); R2G2B2 temperature RGB | 0xAA/0x05 sub-mode 0x0D | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b0/ble/SubModeColor.java` |
| 11 | scene | BLE frame via ptReal\|ptUrl | `0x33/0x05` | 05 04 <effLo> <effHi> <speed> | effect int16 LE, speed byte (default 0) | 0xAA/0x05 sub-mode 0x04 | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b0/ble/SubModeScenes.java` |
| 12 | music | BLE frame via ptReal\|ptUrl | `0x33/0x05` | 05 13 <musicCode> <sensitivity> | sensitivity 0-99 | 0xAA/0x05 sub-mode 0x13 | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b0/ble/SubModeMusic.java` |
| 13 | diy | BLE frame via ptReal\|ptUrl | `0x33/0x05` | 05 0A <diyLo> <diyHi> | 16-bit LE DIY code | 0xAA/0x05 sub-mode 0x0A | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b0/ble/SubModeNewDiy.java` |
| 14 | advanced_scene | BLE frame via ptReal\|ptUrl | `0xA3/0x5B` | first: A3 00 02 <total> 5B <groups> <index> <verify8> <data4>; middle: A3 <idx> <17 bytes>; final: A3 FF <tail> | makeSendBytesV3 packetisation; last group followed by 05 04 <sceneCode> | ptReal op.command | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b0/pact/Comm.java` |
| 15 | diy_upload | BLE frame via ptReal\|ptUrl | `0xA3/<diyCmd>` | multi-packet V1 + 05 0A <code> | blob starts 0x50, length LE16, effect data | ptReal op.command | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b0/pact/Comm.java makeDiyCmd4IotCommMulti` |
| 16 | read_switch_bits | BLE frame via ptReal\|ptUrl | `0xAA/0x42` | 42 | response [0] bits: bit8 overall, bit7 zone/left, bit6 zone/right | 0xAA/0x42 | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b0/adjust/h60b0/Info4Detail.java D()` |
| 17 | read_splicing | BLE frame via ptReal\|ptUrl | `0xAA/0x41` | 41 | response [1] on-off memory / splicing value | 0xAA/0x41 | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b0/adjust/h60b0/Info4Detail.java G()` |
| 18 | color_0x15 | BLE frame via ptReal\|ptUrl | `0x33/0x05` | 05 15 <subtype...> | subtype 1: 01 R G B CT_H CT_L R2 G2 B2 M0 M1 M2 M3; subtype 2: 02 brightness mask...; subtype 3: 03 brightness values; subtype 4: 04 group R G B ... | 0xAA/0x05 sub-mode 0x15 | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b1/ble/SubModeColor.java` |
| 19 | scene | BLE frame via ptReal\|ptUrl | `0x33/0x05` | 05 04 <effLo> <effHi> <music0> <music1> <music2> <music3> <speed> | effect int16 LE, music code int32 LE, direction/speed byte | 0xAA/0x05 sub-mode 0x04 | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b1/ble/SubModeScenes.java` |
| 20 | music | BLE frame via ptReal\|ptUrl | `0x33/0x05` | 05 13 <musicCode> <sensitivity> | sensitivity 0-99 | 0xAA/0x05 sub-mode 0x13 | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b1/ble/SubModeMusic.java` |
| 21 | diy | BLE frame via ptReal\|ptUrl | `0x33/0x05` | 05 0A <codeLo> <codeHi> <code2Lo> <code2Hi> | two 16-bit LE codes | 0xAA/0x05 sub-mode 0x0A | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b1/ble/SubModeNewDiy.java` |
| 22 | color_strip_group | BLE frame via ptReal\|ptUrl | `0x33/0x05` | 05 15 04 <group> R G B [R G B ...] | group index + up to 4 RGB triples per frame | 0xAA/0x05 sub-mode 0x15 type 4 | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b1/pact/Comm.java a()` |
| 23 | brightness_group | BLE frame via ptReal\|ptUrl | `0x33/0x05` | 05 15 03 <group> <b0..b13> | 14 brightness values per group | 0xAA/0x05 sub-mode 0x15 type 3 | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b1/pact/Comm.java d()` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | brightness | BLE notify via ptReal\|ptUrl | `0xEE/0x20` |  | [0] brightness |  | `jadx-splits/split_pact_floorlamp/sources/com/govee/h6071/ble/BrightnessNotifyParse.java` |
| 2 | color_tem | BLE notify via ptReal\|ptUrl | `0xEE/0x30` |  | [0..1] unsigned 16-bit big-endian kelvin |  | `jadx-splits/split_pact_floorlamp/sources/com/govee/h6071/ble/ColorTemNotifyParse.java` |
| 3 | wifi | BLE notify via ptReal\|ptUrl | `0xEE/0x11` |  | [0]==0 connected |  | `h6071/ble/WifiNotifyParse.java; h60b0/ble/Ble$generateNotify$1.java; h60b1/ble/WifiNotifyParse.java` |
| 4 | device_status | BLE notify via ptReal\|ptUrl | `0xEE/0x40` |  | first 10 bytes |  | `base2light/ble/DeviceStatusNotifyParse.java` |
| 5 | switch_status | BLE notify via ptReal\|ptUrl | `0xEE/0x30` |  | [0]==1, [1]==1 main switch, [2]==1 second switch |  | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b1/ble/DeviceSwitchStatusNotifyParse.java` |
| 6 | movie_feast | BLE notify via ptReal\|ptUrl | `0xEE/0x60` |  | [0]==1 then [1] on/off |  | `base2light/ble/controller/MovieFeastOnOffNotifyParse.java` |
| 7 | music | BLE notify via ptReal\|ptUrl | `0xEE/0x70+` |  | OnlineSound music frames |  | `jadx-splits/split_pact_floorlamp/sources/com/govee/h60b1/ble/BleNotifyComm.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0/1"} | {"val":"0/1"} | status | `h6071/iot/CmdTurn.java + base2light/iot/CmdTurn` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"1..100"} | {"val":"1..100"} | status | `h6071/iot/CmdBrightness.java + base2light/iot/CmdBrightness` |
| 3 | colorwc | IoT JSON | `colorwc` | {"colorTemInKelvin":"kelvin","red":"0..255","green":"0..255","blue":"0..255"} | {"colorTemInKelvin":"kelvin","red":"0..255","green":"0..255","blue":"0..255"} | status | `h6071/iot/CmdColorWc.java + base2light/iot/CmdColorWc` |
| 4 | status | IoT JSON | `status` | {} | {} | state+op | `base2light AbsIotManagerV1` |
| 5 | online | IoT JSON | `online` | {} | {} | status | `base2light AbsIotManagerV1` |

## split_pact_h1161

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | master on/off | BLE frame | `0x33/0x10` | on | [0]=0/1 | 0xAA/0x10 -> [0] | `pickupbox/ble/OpenController.java` |
| 2 | brightness | BLE frame | `0x33/0x11` | value | 0-100 | 0xEE/0x20 -> [0] | `pickupbox/ble/BrightnessController.java` |
| 3 | music mode | BLE frame | `0x33/0x05` | 0F effect sensitivity enable colorful? R G B | effect 4 rhythm; sensitivity 0-99; fixed RGB when colorful?==0 | 0xAA/0x05 [0]=0x0F | `pickupbox/ble/SubModeMusic.java; ModeController.java` |
| 4 | color mode | BLE frame | `0x33/0x05` | 14 ... | shared SubMode4Color per-segment payload (not in split) | 0xAA/0x05 [0]=0x14 | `pickupbox/ble/BleProtocol.java; shared SubMode4Color` |
| 5 | device count | BLE frame | `0xAA/0x40` |  | no payload | [0] count (negative = fail) | `pickupbox/ble/DeviceNumController.java` |
| 6 | device info | BLE frame | `0xAA/0x41` | pos | [0]=slot | flag0 address6+ver, or flag1 nameLen+name+ver | `pickupbox/ble/DeviceInfoController.java` |
| 7 | operate sub-device | BLE frame | `0x33/0x43` | pos onInverted | [0]=slot,[1]=(status==0)?1:0 | ack | `newdetails/H1161VM4Light.java r5` |
| 8 | set device list | BLE frame | `0xA3/0x30` | [count, entries...] | entry: mark,flag,cmdVersion,(addr6 reversed \| nameLen+name) | ack | `pickupbox/ble/MultiDeviceController.java` |
| 9 | clear devices | BLE frame | `0x33/0x42` | positions \| FF | positions to clear, or FF for all | ack | `pickupbox/ble/ClearDeviceController.java` |
| 10 | music multi | BLE frame | `0xA3/0x41` | sensitivity effect colors | MultipleController4Music V2 packetization | ack | `base MultipleController4Music; newdetails/music/H1161NewMusicMode.java` |
| 11 | heart | BLE frame | `0xAA/0x01` |  | base | 0xAA/0x01 | `SmartRoomOp4H1161.java` |
| 12 | room switch | BLE frame | `0x33/0x01` | on | base switch | 0xAA/0x01 | `SmartRoomOp4H1161.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | brightness | BLE notify | `0xEE/0x20` |  | [0] 0-100 |  | `pickupbox/ble/BrightnessNotifyParse.java` |
| 2 | device status | BLE notify | `0xEE/0x40` |  | 5 raw bytes -> EventDeviceStatus |  | `pickupbox/ble/DeviceStatusNotifyParse.java` |
| 3 | factory reset | BLE notify | `0xEE/0x41` |  | no payload |  | `pickupbox/ble/ResetDeviceNotifyParse.java` |
| 4 | mode | BLE notify | `0xEE/0x05` |  | [0] submode; 0x0F music fields |  | `pickupbox/ble/ModeController.java` |
| 5 | open state | BLE notify | `0xEE/0x10` |  | [0] on/off |  | `pickupbox/ble/OpenController.java` |

## split_pact_h3a5x

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame | `0x33/0x01` | [0]=0\|1 | [0] on/off | 0xAA/0x01 -> [0]!=0 | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/scenes/H3A5XSceneCmdBuilders$registerWith$3.java` |
| 2 | heartbeat | BLE frame | `0xAA/0x01` | none | read only | [0]!=0 | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/scenes/H3A5XSceneCmdBuilders$registerWith$2.java` |
| 3 | brightness | BLE frame | `0x33/0x04` | [0]=0..100 | [0] brightness | 0xAA/0x04; notify 0x20 [0] | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/pact/Comm.java` |
| 4 | mode | BLE frame | `0x33/0x05` | [0]=sub-mode block | 0x15 color, 0x13 music, 0x04 scenes, 0x0A DIY | 0xAA/0x05 | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/pact/Mode.java` |
| 5 | direction | BLE frame | `0x33/0x16` | [0]=!forward?1:0 | [0] direction | read -> [0]==0 forward | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/ble/controller/SettingDirectionController.java` |
| 6 | read_segment_info | BLE frame | `0xAA/0x40` | none | read only | SegmentStyleIcInfo{style,totalBranchCount,totalColorSegmentCount,branchColorSegmentCounts,totalIcCount,branchIcCounts} | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/ble/controller/ReadSegInfoController.java` |
| 7 | segment_ic_write | BLE frame | `0xA4/0x43` | [0]=enable [1..]=IC style bytes; p()=10 | multi V2 per-IC style | SetSegmentIcMultiController.t | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/ble/controller/SetSegmentIcMultiController.java` |
| 8 | enable_segment_ic | BLE frame | `0x33/0x44` | [0]=!enable?1:0 | [0] enable flag | write result | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/ble/controller/EnableSetSegmentIc4ModeController.java` |
| 9 | segment_calibration | BLE frame | `0x33/0x4A` | branch calibration bytes | SegCaliControllerV2 | event | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/ble/controller/SegCaliControllerV2.java` |
| 10 | updown_calibration | BLE frame | `0x33/0x4B` | CaliAction bytes | UpDownCaliController | event | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/ble/controller/UpDownCaliController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi_connect | BLE notify | `0xEE/0x11` |  | [0]==0 connected |  | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/ble/BleNotifyComm.java` |
| 2 | brightness | BLE notify | `0xEE/0x20` |  | [0] brightness |  | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/ble/notify/BrightnessNotifyParse.java` |
| 3 | movie_feast | BLE notify | `0xEE/0x60` |  | [0]==1 [1]==1 |  | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/ble/BleNotifyComm.java` |
| 4 | device_status | BLE notify | `0xEE/0x40` |  | first 10 bytes |  | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/ble/BleNotifyComm.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/pact/Comm.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"int 0-100"} | {"val":"int 0-100"} | status | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/pact/Comm.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int"} | {"color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int"} | status | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/pact/Comm.java` |
| 4 | status | IoT JSON | `status` | {"state":"on/off","op":"frame bytes"} | {"state":"on/off","op":"frame bytes"} | on/off | `jadx-splits/split_pact_h3a5x/sources/com/govee/h3a5x/scenes/H3A5XSceneCmdBuilders$registerWith$6.java` |

## split_pact_h512x

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `op` | read envelope | {"command":["<base64 20-byte frame>"]} | `h5127/pact/Model.java; H5127ParseUtils.e` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | distance level (H5121) | BLE frame | `0x33/0x01` | threshold pulse window level | level0=45,1,1,0; level1=20,1,1,1; other=20,1,1,level | 0xAA/0x01 4 bytes | `h5121/ble/commV1/CommandDistanceLevel.java` |
| 2 | distance level (H5129) | BLE frame | `0x33/0x01` | threshold pulse window level | level0=80,1,0,0; level1=40,1,0,1; level2=20,1,0,2; other=20,1,0,level | 0xAA/0x01 | `CommandDistanceLevel4H5129.java` |
| 3 | check interval | BLE frame | `0x33/0x02` | seconds | default 60 | 0xAA/0x02 -> [0] | `CommandIntervalTime.java` |
| 4 | Li-Sen switch (H5129) | BLE frame | `0x33/0x03` | on | 0/1 | 0xAA/0x03 -> [0] | `Command4H5129LiSenSwitch.java` |
| 5 | current pressure (H5130) | BLE frame | `0xAA/0x02` |  | raw level | [0] level; notify 0x05 | `h5121/ble/other/Controller4CurPressure.java` |
| 6 | pressure threshold (H5130) | BLE frame | `0x33/0x03` | level | 1-10 | 0xAA/0x03 -> [0] | `Controller4PressureThreshold.java` |
| 7 | has-pressure time (H5130) | BLE frame | `0x33/0x04` | secBE16 | seconds | 0xAA/0x04 -> BE16 | `Controller4HasPressureTime.java` |
| 8 | no-pressure time (H5130) | BLE frame | `0x33/0x05` | secBE16 | seconds | 0xAA/0x05 -> BE16 | `Controller4NoPressureTime.java` |
| 9 | light display (H5130) | BLE frame | `0x33/0x06` | on | 0/1 | 0xAA/0x06 -> [0] | `Controller4LightIsDisplay.java` |
| 10 | H5127 heartbeat read | BLE frame | `0xAA/0x01` |  | [0] status,[1..2] distance BE16,[6..9] duration BE32 | 0xAA/0x01 / notify 0x01 | `h5127/ble/controller/function/Controller4Header.java; H5127ParseUtils.d` |
| 11 | H5127 check mode read | BLE frame | `0xAA/0x05` | 00 | [0]=0 | 0xAA/0x05 | `Controller4CheckMode.java` |
| 12 | H5127 check mode write | BLE frame | `0x33/0x05` | 00 03 | enable | ack | `Controller4CheckMode.java` |
| 13 | H5127 config params read | BLE frame | `0xAA/0x05` | 01 | [0]=1 | 0xAA/0x05 | `Controller4ConfigParams.java` |
| 14 | H5127 config params write | BLE frame | `0x33/0x05` | 01 distBE16 nhBE16 hhBE16 | check distance + judge times | ack | `Controller4ConfigParams.java` |
| 15 | H5127 te range read | BLE frame | `0xAA/0x05` | 03 | [0]=3 | 0xAA/0x05 | `Controller4TeRange.java` |
| 16 | H5127 te range write | BLE frame | `0x33/0x05` | 03 00 valid startBE16 endBE16 | target-exclusion range | ack | `Controller4TeRange.java` |
| 17 | H5127 radar sensitivity read | BLE frame | `0xAA/0x1A` | 04 | [0]=4 | 0xAA/0x1A | `Controller4RadarSensitivity.java` |
| 18 | H5127 radar sensitivity write | BLE frame | `0x33/0x1A` | 04 level | level | ack | `Controller4RadarSensitivity.java` |
| 19 | H5127 only-idf-human read | BLE frame | `0xAA/0x1F` |  |  | [0] 0/1 | `Controller4OnlyIdfHuman.java` |
| 20 | H5127 only-idf-human write | BLE frame | `0x33/0x1F` | 01 on | 0/1 | ack | `Controller4OnlyIdfHuman.java` |
| 21 | H5127 sync time | BLE frame | `0x33/0xB5` | ts32BE 01 tzH tzM | Unix seconds | ack | `Controller4SyncTime.java` |
| 22 | H5127 ext block | BLE frame | `0xAA/0x07` | 02\|03\|0A\|0B | device id / ble hard / mcu soft / mcu hard | 16-byte block | `Controller4SomeExt.java` |
| 23 | H5127 wifi mac | BLE frame | `0xAA/0x10` |  | 6-byte MAC | 0xAA/0x10 | `Controller4WifiMac.java` |
| 24 | H5127 wifi soft/hard | BLE frame | `0xAA/0x21 \| 0xAA/0x20` |  | version block | 0xAA/0x21\|0x20 | `Controller4WifiSv.java; Controller4WifiHv.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | H5127 heartbeat | BLE notify | `0xEE/0x01` |  | [0] check status,[1..2] distance BE16,[6..9] duration BE32 |  | `h5127/ble/notify/NotifyParse4BleHeart.java; H5127ParseUtils.d` |
| 2 | H5127 te range | BLE notify | `0xEE/0x24` |  | [0]=1,[3..4] start BE16,[5..6] end BE16 |  | `h5127/ble/notify/NotifyParse4TeRange.java` |
| 3 | H5130 current pressure | BLE notify | `0xEE/0x05` |  | [0] pressure level |  | `h5121/ble/other/NotifyParse4CurPressure.java` |
| 4 | H5127 wifi set result | BLE notify | `0xEE/0x??` |  | onboarding result |  | `h5127/ble/notify/NotifyParse4WifiSetResult.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | status | IoT JSON | `status` | {} | {} | op frames | `h5127/pact/Model.java` |
| 2 | online | IoT JSON | `online` | {} | {} | presence | `h5127/pact/Model.java` |

## split_pact_h5901

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["base64(20-byte frame)"]} | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/iot/H5901GWIotManager.java` |
| `multiSync` | transport wrapper | {"command":["base64 frames"]} | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/iot/H5901GWIotManager.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | valve_on | BLE frame via ptReal\|multiSync | `0x33/0x01` | [0]=1 [1]=durationLo [2]=durationHi | duration minutes = hours*60+minutes LE16 | 0xAA/0x01 water status | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4ToggleValve.java` |
| 2 | valve_off | BLE frame via ptReal\|multiSync | `0x33/0x01` | {0,0,0} | close valve | - | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4ToggleValve.java` |
| 3 | read_water_status | BLE frame via ptReal\|multiSync | `0xAA/0x01` | none | read only | H5901DeviceInfo | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4ReadWaterStatus.java` |
| 4 | read_amount_water | BLE frame via ptReal\|multiSync | `0xAA/0x02` | none | read only | amount | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4ReadAmountWater.java` |
| 5 | read_water_flow | BLE frame via ptReal\|multiSync | `0xAA/0x03` | none | read only | flow | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4ReadWaterFlow.java` |
| 6 | read_battery | BLE frame via ptReal\|multiSync | `0xAA/0x08` | none | read only | battery percent | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4ReadBattery.java` |
| 7 | sync_time | BLE frame via ptReal\|multiSync | `0x33/0x10` | [0..3]=epochSec LE32 [4]=1 [5]=tzIndex [6]=tzOffset | time + timezone | - | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4SyncTime.java` |
| 8 | read_soft_version | BLE frame via ptReal\|multiSync | `0xAA/0x0E` | none | read only | x.y.z | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4SoftVersion.java` |
| 9 | read_hard_version | BLE frame via ptReal\|multiSync | `0xAA/0x0D` | none | read only | x.y.z | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4HardVersion.java` |
| 10 | read_mac | BLE frame via ptReal\|multiSync | `0xAA/0x0F` | none | read only | MAC | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4MacAddress.java` |
| 11 | read_device_id | BLE frame via ptReal\|multiSync | `0xAA/0x0C` | none | read only | device id | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4ReadDeviceId.java` |
| 12 | gw_status | BLE frame via ptReal\|multiSync | `0xAA/0x04` | [0]=sno | sub-device status request | status frame [1]=5, see readings | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/GwReadStatusController.java` |
| 13 | next_water_info | BLE frame via ptReal\|multiSync | `0xAA/0x04` | none | read only | LastDataDTO protobuf | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/NextWaterInfoController.java` |
| 14 | read_gw_sub_devices | BLE frame via ptReal\|multiSync | `0xAA/0x04` | [0]=sno | sub-device info | sub-device list | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/ReadGWSubDeviceInfo.java` |
| 15 | reset_device | BLE frame via ptReal\|multiSync | `0x33/0x20` | none | reset | - | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4ResetDevice.java` |
| 16 | net_check | BLE frame via ptReal\|multiSync | `0x33\|0xAA/0x35` | none | network state | net state | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4NetCheck.java` |
| 17 | sync_link | BLE frame via ptReal\|multiSync | `0x33/0x19` | link bytes | sub-device link | - | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4SyncLink.java` |
| 18 | smart_plan_enable | BLE frame via ptReal\|multiSync | `0x33/0x15` | [0]=0\|1 | enable smart irrigation | - | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/ControllerSetSmartPlanEnable.java` |
| 19 | pause_plan | BLE frame via ptReal\|multiSync | `0x33/0x14` | plan bytes | pause | - | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/PausePlanController.java` |
| 20 | sync_city | BLE frame via ptReal\|multiSync | `0x33/0x16` | city/location | location | - | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/ControllerSyncCityLocation.java` |
| 21 | delete_plan | BLE frame via ptReal\|multiSync | `0x33/0x16` | plan id | delete | - | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/ControllersDeletePlan.java` |
| 22 | open_sub_device | BLE frame via ptReal\|multiSync | `0x33/0x21` | sub-device bytes | open/join | - | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/OpenSubDeviceBle.java` |
| 23 | delete_sub_device | BLE frame via ptReal\|multiSync | `0x33/0x11` | sub-device bytes | remove | - | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/Controller4DeleteSub.java` |
| 24 | gateway_heartbeat | BLE frame via ptReal\|multiSync | `0xAA/0x01` | none | read only | heart event | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/H5901HeartController.java` |
| 25 | chart_step1 | BLE frame via ptReal\|multiSync | `0x33/0x02` | none | chart data trigger | chart | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/ReadChartStep1Controller.java` |
| 26 | chart_step2 | BLE frame via ptReal\|multiSync | `0x33/0x01` | [0..3]=start LE32 [4..7]=end LE32 | time range | chart | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/ReadChartStep2Controller.java` |
| 27 | chart_step3 | BLE frame via ptReal\|multiSync | `0x33/0x03` | none | chart data | chart | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/ReadChartStep3Controller.java` |
| 28 | sub_device_forward | BLE frame via ptReal\|multiSync | `0x33/0x70` | [0]=sno [1..16]=inner frame bytes 1..16 | gateway envelope for sub-device | inner reply | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/ble/controller/TransGwComposeController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | sub_device_status | BLE notify via ptReal\|multiSync | `0xAA/0x04 or 0xEE/0x32 or 0xEE/0x34` |  | [0]=sno [1]=5 [2]=status(0 online,2 offline) [3]=battery [6]=signal [7..10]=timestamp LE32 [11]=flags(bit0 longBattery,bit1 switchRemind,bit2 flowAlarm,bit3 lowPower,bit4 smartWater) [12]=errorState [13..14]=remaining LE16 (FFFF none) [15]=bit0 switchStatus,bits1..4 runModel,bit6 gwWarning,bits7 planPause [16]=pauseDuration |  | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/utils/H5901Utils.java` |
| 2 | last_data_protobuf | BLE notify via ptReal\|multiSync | `0x37` |  | LastDataDTO: 1 nextTime(int64), 2 nextDuration(int32), 3 percentage(int32), 4 duration(int32), 5 volume(int64), 6 lastTime(int64) |  | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/proto/H5901Proto.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | status | IoT JSON | `status` | {"op":["base64 frames"],"state":{"onOff":"int"}} | {"op":["base64 frames"],"state":{"onOff":"int"}} | sub-device status, LastDataDTO | `jadx-splits/split_pact_h5901/sources/com/govee/h5901/iot/H5901GWIotManager.java` |

## split_pact_h6047

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["base64(20-byte BLE frame)"]} | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/iot/CmdPtReal.java` |
| `ptIot` | transport wrapper | {"command":["base64"]} | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/iot/Cmd.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|ptIot | `0x33/0x01` | [0]=0\|1 | [0] on/off | 0xAA/0x01 -> [0]!=0 | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/SwitchController.java; jadx-splits/split_pact_h6047/sources/com/govee/h6047/scenes/BleSwitchCmdBuilderV1.java` |
| 2 | heartbeat | BLE frame via ptReal\|ptIot | `0xAA/0x01` | none | read only | [0]!=0 | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/HeartController.java` |
| 3 | brightness | BLE frame via ptReal\|ptIot | `0x33/0x04` | [0]=0..100 | [0] brightness | 0xAA/0x04 -> [0] | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/BrightnessController.java` |
| 4 | mode | BLE frame via ptReal\|ptIot | `0x33/0x05` | <sub-mode block> | [0]=sub-mode id, rest sub-mode payload | 0xAA/0x05 with p()={1} -> validBytes[0]=sub-mode | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/ModeController.java, ble/Mode.java` |
| 5 | compose_light_left_right | BLE frame via ptReal\|ptIot | `0x33/0x36` | [0]=left [1]=right | two bar switches | 0xAA/0x36 -> [0] left [1] right | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/controller/ComposeLightController.java` |
| 6 | compose_light_index | BLE frame via ptReal\|ptIot | `0x33/0x36` | [0]=index [1]=state | bar index 0/1 | write result event | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/controller/ComposeLightControllerV1.java` |
| 7 | compose_heart | BLE frame via ptReal\|ptIot | `0xAA/0x36` | none | read only | [0]=tvLeft [1]=tvRight [2]=feastOpen | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/controller/ComposeLightHeartController.java` |
| 8 | on_off_memory_read | BLE frame via ptReal\|ptIot | `0xAA/0x41` | {2} | [0]=2 | event | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/controller/Controller4OnOffMemory.java` |
| 9 | swap_light_position | BLE frame via ptReal\|ptIot | `0x33/0x34` | empty | - | write result | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/controller/SwapLightController.java` |
| 10 | calibration | BLE frame via ptReal\|ptIot | `0x33/0x44` | [0]=flag | [0] calibration flag | 0x24 notify / write result | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/controller/CalibrationController.java` |
| 11 | h6048_bar_on_off_read | BLE frame via ptReal\|ptIot | `0xAA/0x30` | none | read only | raw 20B notify [2]=barA [3]=barB | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/H6048OnOffNotifyParse.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi_connect | BLE notify via ptReal\|ptIot | `0xEE/0x11` |  | [0]==0 -> connected |  | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/WifiNotifyParse.java` |
| 2 | device_status | BLE notify via ptReal\|ptIot | `0xEE/0x40` |  | first 10 bytes forwarded as EventDeviceStatus |  | `jadx-base-7.7.10/sources/com/govee/base2light/ble/DeviceStatusNotifyParse.java` |
| 3 | movie_feast | BLE notify via ptReal\|ptIot | `0xEE/0x60` |  | [0]==1 [1]==1 -> on |  | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/MovieFeastOnOffNotifyParse.java` |
| 4 | h6048_bar_switch | BLE notify via ptReal\|ptIot | `0x30` |  | raw 20B [2],[3] booleans |  | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/ble/H6048OnOffNotifyParse.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/iot/CmdTurn.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"int 0-100"} | {"val":"int 0-100"} | status | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/iot/CmdBrightness.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int"} | {"color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int"} | status | `jadx-splits/split_pact_h6047/sources/com/govee/h6047/iot/CmdColorWc.java` |

## split_pact_h604a

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte>"]} | `jadx-splits/split_pact_h604a/sources/com/govee/h604a/iot/CmdPtReal.java` |
| `ptIot` | transport wrapper | {"raw":"passthrough"} | `iot/Cmd.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|ptIot | `0x33/0x01` | <0\|1> | [0] | 0xAA/0x01 | `base2light SwitchController` |
| 2 | brightness | BLE frame via ptReal\|ptIot | `0x33/0x04` | <1..100> | [0] | 0xAA/0x04 | `pact/Comm.makeBrightnessController4BleComm` |
| 3 | color-mode-1 | BLE frame via ptReal\|ptIot | `0x33/0x05 sub 0x15` | 15 01 R G B kelLo kelHi R2 G2 B2 m0 m1 m2 | 17 bytes; 24-bit segment mask | 0xAA/0x05 | `jadx-splits/split_pact_h604a/sources/com/govee/h604a/ble/SubModeColor.java` |
| 4 | color-mode-2 | BLE frame via ptReal\|ptIot | `0x33/0x05 sub 0x15` | 15 02 brightness m0 m1 m2 | brightness + 24-bit mask | 0xAA/0x05 | `same` |
| 5 | color-mode-3-raw | BLE frame via ptReal\|ptIot | `0x33/0x05 sub 0x15` | 15 03 b0..b11 | 12 raw bytes | 0xAA/0x05 | `same` |
| 6 | music | BLE frame via ptReal\|ptIot | `0x33/0x05 sub 0x13` | 13 <code> <sens> <auto> [R G B] | code 4 rhythm uses 8-byte form; sens 0..99 | 0xAA/0x05 | `jadx-splits/split_pact_h604a/sources/com/govee/h604a/ble/SubModeMusic.java` |
| 7 | scene | BLE frame via ptReal\|ptIot | `0x33/0x05 sub 0x04` | 04 effectLo effectHi | 16-bit LE | 0xAA/0x05 | `jadx-splits/split_pact_h604a/sources/com/govee/h604a/ble/SubModeScenes.java` |
| 8 | diy | BLE frame via ptReal\|ptIot | `0x33/0x05 sub 0x0A` | 0A diyLo diyHi | 16-bit LE | 0xAA/0x05 | `base SubModeNewDiy` |
| 9 | video | BLE frame via ptReal\|ptIot | `0x33/0x05 sub 0x00` | 00 <enable> <vividness> <mode> <dynamic> <saturation> <param> | 8 bytes; vividness 1..100, saturation 0..99 | 0xAA/0x05 | `jadx-splits/split_pact_h604a/sources/com/govee/h604a/ble/SubModeVideo.java` |
| 10 | compose-light-switch | BLE frame via ptReal\|ptIot | `0x33/0x36` | <f><g><h> | three booleans | 0xAA/0x36 | `jadx-splits/split_pact_h604a/sources/com/govee/h604a/ble/controller/ComposeLightController.java` |
| 11 | compose-heart | BLE frame via ptReal\|ptIot | `0xAA/0x36` |  | read | [0] TV [1] left [2] right [3] feast | `ComposeLightHeartController.java` |
| 12 | check-light | BLE frame via ptReal\|ptIot | `0x33/0xAA` |  | empty | notify 0x23 -> [0] light ok, [1] status | `ble/controller/CheckLightController.java; ble/CheckLightParse.java` |
| 13 | check-pods | BLE frame via ptReal\|ptIot | `0x33/0xA8` |  | empty | notify 0x24 -> [0] pods ok | `ble/BleProtocol.java; ble/CheckPodsParse.java` |
| 14 | calibrate-light-belt | BLE frame via ptReal\|ptIot | `0x33/0xA9` | <mode><params x5> | [0] mode, [1..5] UI params | notify 0x25 on timeout | `ble/controller/CaliLightBeltController.java; ble/CaliLightParse.java` |
| 15 | swap-light-position | BLE frame via ptReal\|ptIot | `0x33/0x34` |  | empty | write result | `ble/controller/SwapLightController.java` |
| 16 | start-time-read | BLE frame via ptReal\|ptIot | `0xAA/0x35` |  | empty | [0] minutes | `ble/controller/StartTimeController.java` |
| 17 | onoff-memory | BLE frame via ptReal\|ptIot | `0x33/0x41` | <0\|1> | [0] | 0xAA/0x41 | `ble/controller/Controller4OnOffMemory.java` |
| 18 | ic-number | BLE frame via ptReal\|ptIot | `0xAA/0x40` |  | empty | IC count | `ble/controller/ControllerIcNum.java` |
| 19 | multi-music | BLE frame via ptReal\|ptIot | `0x33/0x41` | <index><length><data> | per-bulb music data | 0xAA/0x41 | `ble/controller/MultiMusicController.java` |
| 20 | bulb-string-color-read | BLE frame via ptReal\|ptIot | `0xAA/0xA5` | <index> | p() = {index} | BulbGroupColorV2.parseBytes -> per-bulb RGB | `adjust/v1/BulbStringColorControllerV2.java; adjust/v1/BulbGroupColorV2.java` |
| 21 | gradual-change | BLE frame via ptReal\|ptIot | `0x33/0xA3` | <0\|1> | [0] | 0xAA/0xA3 | `base Gradual4BleWifiController` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | check-light | BLE notify via ptReal\|ptIot | `0x23` |  | [0]==1 light OK, [1]==1 status |  | `jadx-splits/split_pact_h604a/sources/com/govee/h604a/ble/CheckLightParse.java` |
| 2 | check-pods | BLE notify via ptReal\|ptIot | `0x24` |  | [0]==1 pods OK |  | `jadx-splits/split_pact_h604a/sources/com/govee/h604a/ble/CheckPodsParse.java` |
| 3 | calibration-timeout | BLE notify via ptReal\|ptIot | `0x25` |  | event only |  | `jadx-splits/split_pact_h604a/sources/com/govee/h604a/ble/CaliLightParse.java` |
| 4 | wifi | BLE notify via ptReal\|ptIot | `0x11` |  | [0]==0 connected |  | `ble/WifiNotifyParse.java` |
| 5 | device-status | BLE notify via ptReal\|ptIot | `0x30` |  | base DeviceStatusNotifyParse |  | `ble/BleNotifyComm.java` |
| 6 | bulb-string-colors | BLE notify via ptReal\|ptIot | `0xAA/0xA5` |  | index + 4-bulb RGB groups |  | `adjust/v1/BulbGroupColorV2.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | state | `jadx-splits/split_pact_h604a/sources/com/govee/h604a/iot/CmdTurn.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"1..100"} | {"val":"1..100"} | state | `iot/CmdBrightness.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"r":"int","g":"int","b":"int"},"colorTemInKelvin":"int"} | {"color":{"r":"int","g":"int","b":"int"},"colorTemInKelvin":"int"} | state | `iot/CmdColorWc.java` |
| 4 | snapshot | IoT JSON | `snapshot` | {} | {} | snapshotUrl | `iot/ResultSnapShot.java` |
| 5 | points | IoT JSON | `points` | {"points":[{"pointX":"int","pointY":"int"}]} | {"points":[{"pointX":"int","pointY":"int"}]} | calibration result | `iot/CmdCalibrationPoints.java` |
| 6 | camera | IoT JSON | `camera` | {} | {} | state | `newdetail/vm/H604xVM.java` |
| 7 | swap | IoT JSON | `swap` | {} | {} | state | `newdetail/vm/H604xVM.java` |

## split_pact_h6061

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `cubelight/iot/CmdPtReal.java, h6067/iot/CmdPtReal.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal | `0x33/0x01` | 01 on \| 00 off | [0] | 0xAA/0x01 valid[0] | `cubelight/scenes/BleSwitchCmdBuilderV1.java, h6067 equivalent -> Comm.makeSwitchControler4BleComm -> SwitchController` |
| 2 | brightness | BLE frame via ptReal | `0x33/0x04` | <1..100> | [0] | 0xAA/0x04 valid[0] | `…/cubelight/scenes/BleBrightnessBuilderV1.java, BrightnessController` |
| 3 | mode container | BLE frame via ptReal | `0x33/0x05` | sub-mode block | [0]=0x04/0x0A/0x13/0x15 | 0xAA/0x05 payload {01} | `cubelight/ble/ModeController.java, AbsModeController` |
| 4 | colour | BLE frame via ptReal | `0x33/0x05 sub 0x15` | v1: 15 01 R G B [kHi kLo] m0..m4 \| v2: 15 02 B m0..m4 \| v3: 15 03 group B0..B13 \| v4: 15 04 group RGB x4 | mask LSB=segment; 40 declared bits; 14 brightness or 4 colours per packet | parseColorStripByOnePacketBytes / parsePosColor | `cubelight/ble/SubModeColor.java` |
| 5 | colour (H6067) | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 01 R G B [k] m0 m1 m2 \| 15 02 B m0 m1 m2 | 3 mask bytes (24 bits) in write path | h6067 parsePosColor (2 masks/16 bits) | `h6067/ble/SubModeColor.java` |
| 6 | scene | BLE frame via ptReal | `0x33/0x05 sub 0x04` | 04 <effect LE16> <dir> <speed> \| point: 04 <eff> <dir> <x LE16> <y LE16> <speed> \| focus: 04 <eff> <dir> <focus4> <speed> | defaults 2229/2560, speed 10/45/71 | SubModeScenes.parse (byte0/1 effect, byte2 dir, 3..6 x/y, byte7 speed) | `cubelight/ble/SubModeScenes.java, h6067/ble/SubModeScenes.java` |
| 7 | new DIY | BLE frame via ptReal | `0x33/0x05 sub 0x0A` | 0A <diyCode LE16> | pixel blob via 0xA3 multi frames | SubModeNewDiy.parse | `cubelight/ble/SubModeNewDiy.java, h6067 equivalent` |
| 8 | music legacy | BLE frame via ptReal | `0x33/0x05 sub 0x13` | 13 <code> 00 | codes 51/53/56/57/58/59 | SubModeMusic.parse | `cubelight/ble/SubModeMusic.java` |
| 9 | music V3 | BLE frame via ptReal | `0x33/0x05 sub 0x13` | 13 <code> <sens> [<!autoColor> <!dynamic> 00 00 00 [RGB]] | codes 3/4/5/6/56, sens 0..99 | SubModeMusicV3.parse | `cubelight/ble/SubModeMusicV3.java` |
| 10 | music V4 (H606A) | BLE frame via ptReal | `0x33/0x05 sub 0x13` | 13 00 00 placeholder | effects 117..123; direction/traversal tables; real frames from MultipleController4Music | SubModeMusicV4.parse | `cubelight/ble/SubModeMusicV4.java` |
| 11 | shape/panel layout | BLE frame via ptReal | `0x33/0x31` | [count][type][x LE16][y LE16][angle LE16]... + ext \| H606A: [angle+rot LE16][count][x LE16][y LE16]... + mainPower/ext + in/out | panel topology | 0xAA/0x31 read | `cubelight/ble/MultiDeviceController.java, MultiDeviceControllerH606A.java` |
| 12 | device self/protocol | BLE frame via ptReal | `0xAA/0x02` | {00} | multi-reply read | raw bytes | `cubelight/ble/DeviceSelfController.java` |
| 13 | calibration panel | BLE frame via ptReal | `0x33/0x44` | [icIndex][rgbIndex] \| H6065 [g][f...] | per-panel | write result only | `cubelight/ble/CalibrationController.java, h6067/ble/CalibrationControllerH6065.java` |
| 14 | install / recognise | BLE frame via ptReal | `0x33/0x45` | 00 installed \| FF not | [0] | write result only | `cubelight/ble/InstallController.java` |
| 15 | calibrate all | BLE frame via ptReal | `0x33/0x52` | 04 <count> <icIndex+6*i>... | multi-packet | write result only | `cubelight/ble/CalibrationAllController.java` |
| 16 | H6069 recognition | BLE frame via ptReal | `0x33/0x50` | raw bytes | device recognition | — | `cubelight/ble/SetDeviceRecognitionController.java, newdetails/diy/h6069/H6069DiyParse.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi/ble state | BLE notify via ptReal | `notify cmdType 0x11` |  | [0]==0 connected |  | `cubelight/ble/WifiNotifyParse.java, h6067/ble/WifiNotifyParse.java` |
| 2 | brightness | BLE notify via ptReal | `notify cmdType 0x20` |  | [0] |  | `cubelight/ble/BrightnessNotifyParse.java, h6067 equivalent` |
| 3 | device status | BLE notify via ptReal | `notify cmdType 0x40` |  | 10-byte block |  | `base2light/ble/DeviceStatusNotifyParse.java` |
| 4 | movie feast | BLE notify via ptReal | `notify cmdType 0x60` |  | [0]==1 [1]==1 |  | `base2light/ble/controller/MovieFeastOnOffNotifyParse.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `cubelight/iot/CmdTurn.java, h6067/iot/CmdTurn.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"1..100"} | {"val":"1..100"} | state.brightness | `cubelight/iot/CmdBrightness.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"r":"0..255","g":"0..255","b":"0..255"},"colorTemInKelvin":"0\|K"} | {"color":{"r":"0..255","g":"0..255","b":"0..255"},"colorTemInKelvin":"0\|K"} | state.color | `cubelight/iot/CmdColorWc.java` |
| 4 | status (read) | IoT JSON | `status (read)` | {} | {} | State + ResultPt lists | `pact/Model.java V()` |

## split_pact_h6062

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte>"],"musicCode":"int","musicSensitivity":"int","opVersion":"int"} | `jadx-splits/split_pact_h6062/sources/com/govee/striplight/iot/CmdPtReal.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal | `0x33/0x01` | <0\|1> | [0] | 0xAA/0x01 | `base2light SwitchController` |
| 2 | brightness | BLE frame via ptReal | `0x33/0x04` | <1..100> | [0] | 0xAA/0x04 | `pact/Comm.makeBrightnessController4BleComm` |
| 3 | color-mode-1-rgb | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 01 R G B kelLo kelHi R2 G2 B2 m0..m4 | 17 bytes; 5-byte mask up to 33 segments | 0xAA/0x05 | `jadx-splits/split_pact_h6062/sources/com/govee/striplight/ble/SubModeColor.java` |
| 4 | color-mode-2-brightness | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 02 brightness m0..m4 | brightness + 5-byte mask | 0xAA/0x05 | `same` |
| 5 | color-mode-3-segment-brightness | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 03 idx b0..b13 | 14 brightness bytes | 0xAA/0x05 | `same` |
| 6 | color-mode-4-group-rgb | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 04 idx R G B R G B R G B R G B | 4 RGB triplets | 0xAA/0x05 | `same` |
| 7 | color-v2/v3 | BLE frame via ptReal | `0x33/0x05 sub 0x15` | <15> <01\|02> <zone/segment bytes> | H610A/H610B compact OpColor encoding; sub 2 gradual/segment, sub 1 all/temp | 0xAA/0x05 | `jadx-splits/split_pact_h6062/sources/com/govee/striplight/ble/SubModeColorV2.java; SubModeColorV3.java` |
| 8 | music | BLE frame via ptReal | `0x33/0x05 sub 0x13` | 13 <code> <sens> <dynamic> <auto> [R G B] | rhythm code 4 uses 8 bytes; sens 0..99 | 0xAA/0x05 | `jadx-splits/split_pact_h6062/sources/com/govee/striplight/ble/SubModeMusic.java; SubModeMusicV2.java; SubModeMusicV3.java` |
| 9 | scene | BLE frame via ptReal | `0x33/0x05 sub 0x04` | 04 effectLo effectHi | 16-bit LE | 0xAA/0x05 | `jadx-splits/split_pact_h6062/sources/com/govee/striplight/ble/SubModeScenes.java; SubModeScenesV1/V2` |
| 10 | diy | BLE frame via ptReal | `0x33/0x05 sub 0x0A` | 0A diyLo diyHi | 16-bit LE | 0xAA/0x05 | `ble/SubModeNewDiy.java` |
| 11 | ic-piece-num | BLE frame via ptReal | `0xAA/0x40` |  | empty read | IC/piece data | `jadx-splits/split_pact_h6062/sources/com/govee/striplight/ble/IcAndPieceController.java` |
| 12 | ic-segment-num | BLE frame via ptReal | `0xAA/0x41` |  | empty read | [0..1] IC LE16, [2] segment | `ble/IcSegmentNumController.java` |
| 13 | check-ic | BLE frame via ptReal | `0x33/0x42` |  | empty write | notify 0x21 | `BleProtocol.SINGLE_WRITE_CHECK_IC=66` |
| 14 | light-position | BLE frame via ptReal | `0xAA/0x31` | <pos> | read p()={pos}; write [0] 0/1 | [0] pos | `ble/LightPosController.java` |
| 15 | lr-switch | BLE frame via ptReal | `0x33/0x33` | <0\|1\|16\|17> | op type | 0xAA/0x33 | `ble/SwitchLRController.java` |
| 16 | special-calibration-position | BLE frame via ptReal | `0x33/0xA6` | 01 <0\|1> | p()={1} read; write {1, !flag} | 0xAA/0xA6 | `ble/Special4PositionCalibrationController.java` |
| 17 | gradual-change | BLE frame via ptReal | `0x33/0xA3` | <0\|1> | [0] | 0xAA/0xA3 | `ble/Gradual4BleWifiController.java` |
| 18 | bulb-string-color-read | BLE frame via ptReal | `0xAA/0xA5` | <index> | p() = {index} | BulbGroupColor.parseBytes -> 4-bulb RGB | `ble/BulbStringColorController.java` |
| 19 | color-strip-segment | BLE frame via ptReal | `0x33/0x05` | 15 01 ... or 15 02 brightness mask | per-segment/zone colour | 0xAA/0x05 | `ble/ColorStripController.java` |
| 20 | multi-music | BLE frame via ptReal | `0x41 multi` | <index><length><data> | per-piece music data | 0xAA/0x41 | `BleProtocol.value_multiple_set_music=65` |
| 21 | new-abstract-music | BLE frame via ptReal | `0x33/0x05 sub 0x16` | SubModeAbsMusic body | b==22 dispatch in Mode | 0xAA/0x05 | `ble/Mode.java; base SubModeAbsMusic` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | ic-count | BLE notify via ptReal | `0x21` |  | [0..1] IC LE16, [2] segment |  | `ble/CheckIcNumParse.java` |
| 2 | ic-and-piece | BLE notify via ptReal | `0x22` |  | [0] sub_ic_1, [2] sub_ic_2 |  | `ble/IcAndPieceNotifyParse.java` |
| 3 | brightness | BLE notify via ptReal | `0x20` |  | [0] |  | `ble/BrightnessNotifyParse.java` |
| 4 | device-status | BLE notify via ptReal | `0x30` |  | base DeviceStatusNotifyParse |  | `ble/BleNotifyComm.java` |
| 5 | movie-feast | BLE notify via ptReal | `0x54` |  | [0]==1, [1] on/off |  | `base MovieFeastOnOffNotifyParse` |
| 6 | wifi | BLE notify via ptReal | `0x11` |  | [0]==0 connected |  | `ble/WifiNotifyParse.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | state | `jadx-splits/split_pact_h6062/sources/com/govee/striplight/iot/CmdTurn.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"1..100"} | {"val":"1..100"} | state | `iot/CmdBrightness.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"r":"int","g":"int","b":"int"},"colorTemInKelvin":"int"} | {"color":{"r":"int","g":"int","b":"int"},"colorTemInKelvin":"int"} | state | `iot/CmdColorWc.java` |

## split_pact_h6079

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `…/h6079/iot/CmdPtReal.java, …/h6020/iot/CmdPtReal.java` |
| `pt` | transport wrapper | raw passthrough | `…/h6079/iot/Cmd.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|pt | `0x33/0x01` | 01 on \| 00 off | [0] on/off | 0xAA/0x01 -> valid[0] state | `jadx-splits/split_pact_h6079/sources/com/govee/h6079/scenes/BleSwitchCmdBuilderV1.java -> pact/Comm.makeSwitchController4BleComm -> base2light/ble/controller/SwitchController.java` |
| 2 | brightness | BLE frame via ptReal\|pt | `0x33/0x04` | <1..100> | [0] brightness | 0xAA/0x04 -> valid[0] | `…/h6079/scenes/BleBrightnessBuilderV1.java -> BrightnessController.java` |
| 3 | mode container | BLE frame via ptReal\|pt | `0x33/0x05` | <subMode block> | [0]=sub-mode 0x02/0x03/0x04/0x0A/0x0D/0x13/0x15 | 0xAA/0x05 payload {01} -> valid[0]=sub-mode, rest sub-mode bytes | `…/h6079/ble/ModeController.java, AbsModeController.java, AbsMode.java` |
| 4 | colour v2 | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x15` | variant1: 15 01 R G B kHi kLo R2 G2 B2 m0 m1 \| variant2: 15 02 B m0 m1 \| variant3: 15 03 B0..Bn | kelvin BE16; mask LSB=segment0; n<=15 | parsePosColor: 20-byte frame [3]=1, RGB 4..6, kelvin 7..8, RGB2 9..11, mask 12 | `…/h6079/ble/SubModeColorV2.java` |
| 5 | colour v1 (H6020) | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x0D` | 0D R G B kHi kLo R2 G2 B2 | 9 bytes, kelvin BE16 | SubModeColor.parse | `…/h6020/ble/SubModeColor.java` |
| 6 | colour v2 (H1741) | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x15` | 15 01 R G B kHi kLo R2 G2 B2 m0..m6 \| 15 02 B m0..m6 | 8-segment boolean mask; only m0 non-zero, bytes 11..16 written as 0 | — | `…/h6020/ble/SubModeColorV2.java` |
| 7 | scene | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x04` | 04 <effect LE16> <musicCode LE16> | musicCode=0 when music switch off | SubModeScenes.parse | `…/h6079/ble/SubModeScenes.java, …/h6020/ble/SubModeScenes.java` |
| 8 | new DIY select | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x0A` | 0A <diyCode LE16> <slot LE16> | slot 0..n for multi-DIY | SubModeNewDiy.parse | `…/h6079/ble/SubModeNewDiy.java, …/h6020/ble/SubModeNewDiy.java` |
| 9 | music v1 | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x13` | 13 code sens autoFlag [R G B]; rhythm: 13 72 sens soft autoFlag [R G B] | sens 0..99; autoFlag=1 manual fixed colour | SubModeMusic.parse | `…/h6079/ble/SubModeMusic.java` |
| 10 | music v2/v3 | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x13` | 13 <code> <sensitivity> | H607C version 2, H16B0 version 3 | SubModeMusicV2/V3.parse | `…/h6079/ble/SubModeMusicV2.java, SubModeMusicV3.java` |
| 11 | gradual / fade | BLE frame via ptReal\|pt | `0x33/0xA3` | 01 on \| 00 off | [0] enable | 0xAA/0x05 read gradual strip | `…/h6079/ble/Gradual4BleWifiController.java` |
| 12 | remote-control pair | BLE frame via ptReal\|pt | `0x33/0xA4` | 01 pair \| 00 exit | [0] | notify 0xA4 -> valid[0] | `…/h6079/ble/RemoteController.java, RemoteControlParse.java` |
| 13 | read segment colour groups | BLE frame via ptReal\|pt | `0xAA/0xA5` | <group index> | [0] start group | 17 valid bytes: [idx][brightness][R][G][B] x4 | `…/h6079/ble/BulbStringColorControllerV2.java, BulbGroupColorV2.java` |
| 14 | device info | BLE frame via ptReal\|pt | `0x33/0x08` | none | — | 0xAA/0x08 | `…/h6079/ble/BleProtocol.java (DEVICE_INFO=8)` |
| 15 | heart / presence | BLE frame via ptReal\|pt | `0xAA/0x01` | none | — | valid[0]!=0 | `base HeartController.java / BleComm.l()` |
| 16 | preset multi-scene (H6020) | BLE frame via ptReal\|pt | `0x33/0x04 or 0x33/0x58` | multi-packet AbsMultipleControllerV14Scenes; first byte of cloud scene param stripped | opcode 0x58 for H6020 and for params starting 0x40/0x41, else 0x04; 0x50 is a parameter marker | — | `…/h6020/adjust/controller/MultiPresetScenesController.java, pact/Support.g` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi/ble state | BLE notify via ptReal\|pt | `notify cmdType 0x11` |  | [0]==0 connected |  | `…/h6079/ble/WifiNotifyParse.java, …/h6020/ble/WifiNotifyParse.java` |
| 2 | brightness | BLE notify via ptReal\|pt | `notify cmdType 0x20` |  | h6079 [0]=brightness [1]=aux; h6020 [0]=brightness |  | `…/h6079/ble/BrightnessNotifyParse.java, …/h6020/ble/BrightnessNotifyParse.java` |
| 3 | remote pairing | BLE notify via ptReal\|pt | `notify cmdType 0xA4` |  | [0] state |  | `…/h6079/ble/RemoteControlParse.java` |
| 4 | switch status | BLE notify via ptReal\|pt | `notify cmdType 0x30` |  | h6079 [1]=switch id [2]==1 on; h6020 [0]==1 -> [1] on/[2]; [0]==0x30 -> [1] battery |  | `…/h6079/ble/DeviceSwitchStatusNotifyParse.java, …/h6020/ble/DeviceSwitchStatusNotifyParse.java` |
| 5 | device status | BLE notify via ptReal\|pt | `notify cmdType 0x40` |  | 10-byte block |  | `base2light/ble/DeviceStatusNotifyParse.java` |
| 6 | movie feast | BLE notify via ptReal\|pt | `notify cmdType 0x60` |  | [0]==1, [1]==1 on |  | `base2light/ble/controller/MovieFeastOnOffNotifyParse.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status / turn echo | `…/h6079/iot/CmdTurn.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"1..100"} | {"val":"1..100"} | state.brightness | `…/h6079/iot/CmdBrightness.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"r":"0..255","g":"0..255","b":"0..255"},"colorTemInKelvin":"0\|allowed K"} | {"color":{"r":"0..255","g":"0..255","b":"0..255"},"colorTemInKelvin":"0\|allowed K"} | state.color/colorTemInKelvin | `…/h6079/iot/CmdColorWc.java` |
| 4 | status (read) | IoT JSON | `status (read)` | {} | {} | state {onOff,brightness,mode,wifiHardVersion,wifiSoftVersion} + op lists | `…/h6079/pact/Model.java V()` |

## split_pact_h6092

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["base64(20-byte frame)"]} | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/iot/CmdPtReal.java` |
| `pt` | transport wrapper | {"command":"raw passthrough"} | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/iot/Cmd.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|pt | `0x33/0x01` | [0]=0\|1 | [0] on/off | 0xAA/0x01 -> [0]!=0 | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/scenes/BleSwitchCmdBuilderV1.java` |
| 2 | heartbeat | BLE frame via ptReal\|pt | `0xAA/0x01` | none | read only, no event | [0]!=0 | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/ble/BleComm.java` |
| 3 | brightness | BLE frame via ptReal\|pt | `0x33/0x04` | [0]=0..100 | [0] brightness | 0xAA/0x04 | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/pact/Comm.java` |
| 4 | mode | BLE frame via ptReal\|pt | `0x33/0x05` | <sub-mode block> | [0]=sub-mode id: 0x04 scenes, 0x0A DIY, 0x20/0x0C operate | 0xAA/0x05 | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/ble/Mode.java` |
| 5 | diy_multi | BLE frame via ptReal\|pt | `0xA3/0x56` | [0]=diyCode [1..]=DIY bytes; first byte 33 rewritten to 11 | multi-packet V1 | EventMultipleOperateDiy | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/controller/MultipleOperateController.java` |
| 6 | diy_multi_h6093 | BLE frame via ptReal\|pt | `0xA3/0x58` | multi-packet V1 | H6093 DIY | EventMultipleOperateDiy | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/controller/MultipleOperateControllerH6093.java` |
| 7 | h609d_operate | BLE frame via ptReal\|pt | `0x33\|0xAA/0x43` | H609DSubModeOperate bytes | binary operate blob | H609DSubModeOperate parse | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/controller/H609dOperateModeController.java` |
| 8 | auto_off_read | BLE frame via ptReal\|pt | `0xAA/0x24` | none | read only | AutoOffInfo | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/ble/AutoOffNotifyParse.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi_connect | BLE notify via ptReal\|pt | `0xEE/0x11` |  | [0]==0 connected |  | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/ble/WifiNotifyParse.java` |
| 2 | brightness | BLE notify via ptReal\|pt | `0xEE/0x20` |  | [0] brightness |  | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/ble/BrightnessNotifyParse.java` |
| 3 | auto_off | BLE notify via ptReal\|pt | `0xEE/0x24` |  | AutoOffInfo.parse |  | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/ble/AutoOffNotifyParse.java` |
| 4 | child_switch | BLE notify via ptReal\|pt | `0xEE/0x30` |  | [0] seq/type, [1]==1 switch |  | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/ble/DeviceStatusNotifyParse.java` |
| 5 | music_info | BLE notify via ptReal\|pt | `0xEE/0x31` |  | base MusicNotifyParse |  | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/ble/BleNotifyComm.java` |
| 6 | sleep_info | BLE notify via ptReal\|pt | `0xEE/0x32` |  | sleep state |  | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/ble/BleProtocol.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/iot/CmdTurn.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"int 0-100"} | {"val":"int 0-100"} | status | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/iot/CmdBrightness.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int"} | {"color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int"} | status | `jadx-splits/split_pact_h6092/sources/com/govee/h6092/iot/CmdColorWc.java` |

## split_pact_h6099

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `pact_h6099/iot/CmdPtReal.java, pact_h605b/iot/CmdPtReal.java` |
| `ptIot` | transport wrapper | {} | `*/iot/Cmd.java` |
| `IoTConnected` | connection | {} | `*/iot/Cmd.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|ptIot | `0x33/0x01` | 01\|00 | [0] state | 0xAA/0x01 | `base2light/ble/controller/SwitchController.java, */ble/controller/compose/ControllerSwitch.java` |
| 2 | brightness | BLE frame via ptReal\|ptIot | `0x33/0x04` | 0..100 | [0] | 0xAA/0x04 | `base2light/ble/controller/BrightnessController.java` |
| 3 | mode | BLE frame via ptReal\|ptIot | `0x33/0x05` | sub-mode | 0x15 colour, 0x04 scene, 0x0A DIY, 0x13 music, 0x00 video | 0xAA/0x05 | `pact_h605b/ble/Mode.java, pact_h6099/ble/Mode.java` |
| 4 | icNumber | BLE frame via ptReal\|ptIot | `0xAA/0x40` |  | read IC / segment count | 0xEE/0x40 | `*/ble/controller/compose/ControllerIcNum.java` |
| 5 | direction | BLE frame via ptReal\|ptIot | `0x33/0x30` | dir | [0] direction | 0xAA/0x30 | `*/ble/controller/compose/DirectionController.java, LightDirectionController.java` |
| 6 | calibration | BLE frame via ptReal\|ptIot | `0x33/0x44` | 02 01 into / 02 00 exit | [0]=2 [1]=1\|0 | 0xAA/0x44 | `InstallCaliController.java, compose/CalibrationController.java` |
| 7 | swapLight | BLE frame via ptReal\|ptIot | `0x33/0x34` |  | value_swap_light_pos=52 | 0xEE/0x34 | `SwapLightController.java` |
| 8 | startTime | BLE frame via ptReal\|ptIot | `0xAA/0x35` |  | MSG_TYPE_READ_START_TIME=53 | 0xEE/0x35 | `StartTimeController.java` |
| 9 | onOffMemory | BLE frame via ptReal\|ptIot | `0x33/0x41` | 02 mode | [0]=2 [1]=memory mode | 0xAA/0x41 | `Controller4OnOffMemory.java` |
| 10 | gradual | BLE frame via ptReal\|ptIot | `0x33/0xA3` | 01\|00 | fade on/off | 0xEE/0xA3 | `GradualController.java, Gradual4BleWifiController.java` |
| 11 | composeLightSwitch | BLE frame via ptReal\|ptIot | `0x33/0x36` | val | multi-light switch | 0xEE/0x36 | `ComposeLightSwitchController.java, ComposeLightController.java` |
| 12 | timer | BLE frame via ptReal\|ptIot | `0x33/0x23` | group enableType hour min repeat | read all = 23 FF | 0xEE/0x23 | `pact_h6099/ble/controller/compose/TimerController.java` |
| 13 | syncTime | BLE frame via ptReal\|ptIot | `0x33/0x09` | time bytes | — | none | `pact_h6099/ble/controller/compose/SyncTimeController.java` |
| 14 | softVersion | BLE frame via ptReal\|ptIot | `0x33/0x06` |  | read only | 0xEE/0x06 | `SoftVersionController.java` |
| 15 | hardVersion | BLE frame via ptReal\|ptIot | `0x33/0x07` |  | read only | 0xEE/0x07 | `HardVersionController.java, DspVersionController.java` |
| 16 | sleep | BLE frame via ptReal\|ptIot | `0x33/0x11` | enable startBri closeTime curTime [defaultLight rgbR rgbG rgbB kLo kHi voiceOpen voiceVolume voiceLo voiceHi] | 4 bytes V1; 14 bytes V2 | 0xAA/0x11 | `base2light/ble/controller/SleepController{,V2}.java, pact_h6099/pact/Comm.java` |
| 17 | whiteBalance | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 06 01 value | [0]=6 [1]=1 [2]=value | 0xAA/0xA9 | `Controller4WhiteBalance.java` |
| 18 | blackBorderRemove | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 0B 01 flag | [0]=0x0B [1]=1 [2]=flag | 0xAA/0xA9 | `BlackBorderRemoveController1.java` |
| 19 | blackScreen | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 0A 06 enable mode startLo startHi endLo endHi | [0]=0x0A [1]=6 [2]=enable [3]=mode 1\|2 [4..5]=start LE16 [6..7]=end LE16; read 0A | 0xAA/0xA9 0A | `pact_h6099/ble/controller/compose/BlackScreenController.java; base2light/balckscreen/controller/BlackScreenController.java` |
| 20 | hdmiPort | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 03 01 port | [0]=3 [1]=1 [2]=port | 0xAA/0xA9 03 | `pact_h605b/ble/controller/compose/Controller4Hdmi.java` |
| 21 | checkCamera | BLE frame via ptReal\|ptIot | `0xAA/0x32` |  | H605B only | 0xEE/0x32 | `CheckCameraController.java` |
| 22 | checkLightInstall | BLE frame via ptReal\|ptIot | `0xAA/0xAA` |  | H605B only | 0xEE/0xAA | `CheckLightController.java` |
| 23 | exitCheckLightInstall | BLE frame via ptReal\|ptIot | `0x33/0xAF` |  | H605B only | 0xEE/0xAF | `ExitCheckLightController.java` |
| 24 | cameraPosition | BLE frame via ptReal\|ptIot | `0x33/0x31` | opaque | H605B only | 0xAA/0x31 | `CameraPosController.java` |
| 25 | usbCheck | BLE frame via ptReal\|ptIot | `0x33/0x38` | val | H605B only | 0xEE/0x38 | `UsbCheckController.java` |
| 26 | usbCheckState | BLE frame via ptReal\|ptIot | `0x33/0x37` | val | H605B only | 0xEE/0x37 | `UsbCheckStateController.java` |
| 27 | boxEffect | BLE frame via ptReal\|ptIot | `0x33/0xB6` | on effectIdx dynamic speed | [0] on [1] effect [2] dynamic [3] speed | 0xEE/0xB6 | `ControllerBoxEffect.java` |
| 28 | audioFrom | BLE frame via ptReal\|ptIot | `0x33/0xB7` | src | audio source | 0xEE/0xB7 | `Controller4AudioFrom.java` |
| 29 | multiMusic | BLE frame via ptReal\|ptIot | `0x33/0x41` | layer block | H605B | 0xEE/0x41 | `MultiMusicController.java, MultiMusicControllerV3.java` |
| 30 | whiteBalanceClassic | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 00 03 auto R B | [0]=0 [1]=3 [2]=auto?0:1 [3]=R [4]=B; read 00 -> valid[2]=defaultAuto valid[3]=defaultR valid[4]=defaultB valid[5]=auto valid[6]=R valid[7]=B | 0xAA/0xA9 00 | `base2light/videomode/newdetail/funtion/WhiteBalanceVmInterface.java` |
| 31 | whiteBalanceAdvanced | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 0F 03 R G B | [0]=0x0F [1]=3 [2..4]=R,G,B; read 0F -> valid[2..5]=R,G,B,type | 0xAA/0xA9 0F | `base2light/videomode/newdetail/funtion/WhiteBalanceVmInterface.java` |
| 32 | autoWhiteBalance | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 12 | trigger auto white balance (old path) | ack | `base2light/videomode/newdetail/controller/VideoAutoWbController.java` |
| 33 | checkWhiteBalanceCali | BLE frame via ptReal\|ptIot | `0xAA/0xA9` | 13 | read; valid[2]==1 means calibrated | 0xAA/0xA9 13 | `base2light/videomode/newdetail/controller/VideoCheckWbCaliController.java` |
| 34 | exitWhiteBalanceCali | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 14 | exit calibration | ack | `base2light/videomode/newdetail/controller/VideoAutoWbController.java` |
| 35 | sensitivity | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 01 01 value | [0]=1 [1]=1 [2]=value; read 01 -> valid[2] | 0xAA/0xA9 01 | `base2light/videomode/newdetail/controller/VideoSensitivityController.java` |
| 36 | videoBrightness | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 02 01 value | [0]=2 [1]=1 [2]=whole-RL brightness; read 02 | 0xAA/0xA9 02 | `base2light/videomode/newdetail/funtion/WholeRLBrightnessVmInterface.java` |
| 37 | aiAction | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 04 01 value | [0]=4 [1]=1 [2]=AI action id; read 04 | 0xAA/0xA9 04 | `pact_h605b/ble/controller/compose/AiActionController.java` |
| 38 | colorCalibration | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 05 03 R G B \| 05 04 R G B extra | [0]=5 [1]=3\|4 [2..]=RGB[+extra]; read 05 -> valid[2..5] | 0xAA/0xA9 05 | `base2light/videomode/newdetail/controller/ColorCaliController.java; pact_h6099/ble/controller/compose/Controller4ColorCalibration.java` |
| 39 | hdmiBlackScreen | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 0C 03 enable durLo durHi | [0]=0x0C [1]=3 [2]=enable [3..4]=duration seconds LE16 (15..300, default 30); read 0C | 0xAA/0xA9 0C | `base2light/balckscreen/hdmi/controller/BlackScreenHdmiController.java` |
| 40 | hdrCalibration | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 0D | write triggers HDR calibration; read 0D polls result | 0xAA/0xA9 0D | `base2light/videomode/newdetail/controller/HDRCaliController.java` |
| 41 | saturation | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 0E 01 value | [0]=0x0E [1]=1 [2]=value; read 0E -> valid[2] | 0xAA/0xA9 0E | `base2light/videomode/newdetail/controller/VideoSaturationController.java` |
| 42 | aiFilter | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 10 0F enable R G B saturation codeLo codeHi autoCloseLo autoCloseHi timeLo timeHi tz0 tz1 tz2 tz3 | [2]=enable [3]=R [4]=G [5]=B [6]=saturation [7..8]=filter code LE16 [9..10]=auto-close minutes LE16 [11..12]=expiry time-of-day LE16 [13..16]=timezone; read 10 -> valid[2..16] | 0xAA/0xA9 10 | `base2light/videomode/newdetail/controller/AiFilterController.java` |
| 43 | hdrEffect | BLE frame via ptReal\|ptIot | `0x33/0xA9` | 11 02 enable level | [0]=0x11 [1]=2 [2]=enable [3]=level; read 11 -> valid[2]==1,valid[3] | 0xAA/0xA9 11 | `base2light/videomode/newdetail/controller/VideoHdrEffectController.java` |
| 44 | aiUpdateStatus | BLE frame via ptReal\|ptIot | `0xAA/0xA9` | 09 | read AI update status | 0xAA/0xA9 09 | `pact_h605b/ble/controller/compose/AiUpdateStatusController.java` |
| 45 | soundEffectMic | BLE frame via ptReal\|ptIot | `0x33/0xAC` | micIndex | [0]=selected mic index | ack | `base2light/videomode/newdetail/funtion/SoundEffectVmInterface.java` |
| 46 | relativeBrightness | BLE frame via ptReal\|ptIot | `0x33/0xAE` | 01 04\|06 v0 v1 v2 v3 [v4 v5] | [0]=1 [1]=segment count (4\|6) then segment levels; read AE 01 | 0xAA/0xAE 01 | `base2light/relativebrightness/controller/RelativeBrightnessController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi | BLE notify via ptReal\|ptIot | `0x11` |  | [0]==0 connected |  | `pact_h605b/ble/WifiNotifyParse.java, pact_h6099/ble/WifiNotifyParse.java` |
| 2 | usbOvertime | BLE notify via ptReal\|ptIot | `0x50` |  | USB check timeout |  | `pact_h605b/ble/UsbCheckOvertimeParse.java` |
| 3 | deviceStatus | BLE notify via ptReal\|ptIot | `0x40` |  | first 10 bytes |  | `base2light/ble/DeviceStatusNotifyParse.java` |
| 4 | lightInstall | BLE notify via ptReal\|ptIot | `0x23` |  | [0] installed, [1] variant |  | `pact_h605b/ble/LightInstallNotifyParse.java` |
| 5 | caliLightOvertime | BLE notify via ptReal\|ptIot | `0x25` |  | calibration light timeout |  | `pact_h605b/ble/CaliLightParse.java` |
| 6 | lightAndHdmi | BLE notify via ptReal\|ptIot | `0x30` |  | [0]=1 light-bar bits; [0]=3 HDMI port+bits; [0]=8 AI model LE16; [0]=9 other |  | `pact_h605b/ble/LightAndHdmiNotifyParse.java, pact_h6099/ble/LightAndHdmiNotifyParse.java` |
| 7 | soundSource | BLE notify via ptReal\|ptIot | `0x32` |  | [0]==1 HDMI else DEVICE |  | `pact_h605b/ble/SoundSourceNotifyParse.java` |
| 8 | movieFeast | BLE notify via ptReal\|ptIot | `0x60` |  | [0]==1, [1] on/off |  | `base2light/ble/controller/MovieFeastOnOffNotifyParse.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | state.onOff | `pact_h605b/iot/CmdTurn.java, pact_h6099/iot/CmdTurn.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"0..100"} | {"val":"0..100"} | state.brightness | `pact_h6099/iot/CmdBrightness.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"r":"0..255","g":"0..255","b":"0..255"},"colorTemInKelvin":"int"} | {"color":{"r":"0..255","g":"0..255","b":"0..255"},"colorTemInKelvin":"int"} | state | `pact_h6099/iot/CmdColorWc.java` |
| 4 | status | IoT JSON | `status` | {} | {} | state + op | `pact_h6099/iot/CmdStatus.java` |
| 5 | online | IoT JSON | `online` | {} | {} | online | `*/iot/Cmd.java` |
| 6 | color | IoT JSON | `color` | {"r":"int","g":"int","b":"int"} | {"r":"int","g":"int","b":"int"} | state | `pact_h605b/iot/Cmd.java` |
| 7 | colorTem | IoT JSON | `colorTem` | {"colorTemInKelvin":"int","color":{"r":"int","g":"int","b":"int"}} | {"colorTemInKelvin":"int","color":{"r":"int","g":"int","b":"int"}} | state | `pact_h605b/iot/Cmd.java` |
| 8 | snapshot | IoT JSON | `snapshot` | {} | {} | camera snapshot | `pact_h605b/iot/ResultSnapShot.java, pact_h6099/add/cameraCali3Img/ReadSnapShotCmd.java` |
| 9 | dewarpsnapshot | IoT JSON | `dewarpsnapshot` | {} | {} | de-warped snapshot | `pact_h6099/iot/Cmd.java` |
| 10 | points | IoT JSON | `points` | {"points":["..."]} | {"points":["..."]} | calibration points | `pact_h605b/iot/CmdCalibrationPoints.java` |
| 11 | camera | IoT JSON | `camera` | {} | {} | camera on/off | `*/iot/Cmd.java` |
| 12 | swap | IoT JSON | `swap` | {} | {} | swap light position | `*/iot/Cmd.java` |
| 13 | iniUrl | IoT JSON | `iniUrl` | {} | {} | H605C calibration URL | `pact_h605b/iot/Cmd.java` |
| 14 | iniRoi | IoT JSON | `iniRoi` | {} | {} | H605C calibration ROI | `pact_h605b/iot/Cmd.java` |

## split_pact_h60ax

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte>"]} | `jadx-splits/split_pact_h60ax/sources/com/govee/pact_h60a0/iot/CmdPtReal.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal | `0x33/0x01` | <0\|1> | [0] | 0xAA/0x01 | `ble/controller/compose/ControllerSwitch.java` |
| 2 | brightness | BLE frame via ptReal | `0x33/0x04` | <1..100> | [0] | 0xAA/0x04 | `ble/controller/compose/BrightnessControllerNoEvent.java` |
| 3 | color-op0-brightness | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 02 <brightness> <mask...> | mask 2 bytes <=16 segments, else BleUtils.X(checkSet,true) | 0xAA/0x05 | `ble/v1/SubModeColorV1.java (OP_TYPE_SET_BRIGHTNESS=0)` |
| 4 | color-op1-rgb | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 01 R G B <mask...> | RGB + segment mask | 0xAA/0x05 | `same (OP_TYPE_SET_COLOR=1)` |
| 5 | color-op2-kelvin | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 05 kelLo kelHi | Kelvin LE16 | 0xAA/0x05 | `same (OP_TYPE_SET_COLOR_TEMP=2)` |
| 6 | color-op3-mode | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 00 | mode only | 0xAA/0x05 | `same (OP_TYPE_SET_MODE=3)` |
| 7 | color-op6-brightness-group | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 03 <group> <14 brightness> | 14 bytes | 0xAA/0x05 | `same (OP_TYPE_SET_BRIGHTNESS_GROUP=6)` |
| 8 | color-op7-color-group | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 04 <group> R G B x4 | 4 RGB triplets | 0xAA/0x05 | `same (OP_TYPE_SET_COLOR_GROUP=7)` |
| 9 | color-op11-kelvin-H60A1 | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 01 R G B kelLo kelHi tempR G B <mask> | H60A1/4/60C1/1270 | 0xAA/0x05 | `same (OP_TYPE_SET_COLOR_TEMP_H60A1=11)` |
| 10 | color-op12-rgb-H60A1 | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 01 R G B 00 00 00 00 00 <mask> | H60A1/4/60C1/1270 | 0xAA/0x05 | `same (OP_TYPE_SET_COLOR_H60A1=12)` |
| 11 | color-H60A6 | BLE frame via ptReal | `0x33/0x05 sub 0x0D` | 0D ... | H60A6-specific 13-pixel colour payload (built by H60A6 colour UI/op writer) | 0xAA/0x05 | `ble/BleProtocol.sub_mode_color_h60a6=13; adjust/h60a6/ColorModeH60A6.java` |
| 12 | music | BLE frame via ptReal | `0x33/0x05 sub 0x13` | 13 <code> <sens> | default 13 05 64; new-code sets via base lists | 0xAA/0x05 | `ble/v1/SubModeMusicV1.java` |
| 13 | scene | BLE frame via ptReal | `0x33/0x05 sub 0x04` | 04 effectLo effectHi | 16-bit LE | 0xAA/0x05 | `ble/v1/SubModeScenesV1.java` |
| 14 | diy | BLE frame via ptReal | `0x33/0x05 sub 0x0A` | 0A diyLo diyHi | 16-bit LE + protocolCode metadata | 0xAA/0x05 | `ble/Sub4Diy.java` |
| 15 | graffiti-h12d0 | BLE frame via ptReal | `0x33/0xEF` | cell-graffiti multi frames | sub_graffiti_h12d0=-17 | write result | `ble/BleProtocol.java; adjust/h12d0/diy/*` |
| 16 | child-switch | BLE frame via ptReal | `0x33/0x36` | <0..2 bools> | secondary/child switch | 0xAA/0x36 | `ble/controller/ControllerChildSwitch.java; BleProtocol.value_sub_switch=54` |
| 17 | onoff-memory | BLE frame via ptReal | `0x33/0x41` | <0\|1> | [0] | 0xAA/0x41 | `ble/controller/Controller4OnOffMemory.java` |
| 18 | ic-number | BLE frame via ptReal | `0xAA/0x40` |  | empty read | IC count | `ble/controller/compose/ControllerIcNum.java` |
| 19 | other-info | BLE frame via ptReal | `0xAA/0x07` | p()={8} | read | Parser4OtherInfo | `ble/controller/compose/ControllerOtherInfo.java` |
| 20 | version-hard-dsp | BLE frame via ptReal | `0xAA/0x07` | sub | version read | ASCII | `compose/HardVersionController.java; DspVersionController.java` |
| 21 | version-soft | BLE frame via ptReal | `0xAA/0x06` |  | empty read | ASCII | `compose/SoftVersionController.java` |
| 22 | sync-time | BLE frame via ptReal | `0x33/0x09` | 7-byte time | time + tz | write result | `compose/SyncTimeController.java` |
| 23 | timer-read | BLE frame via ptReal | `0xAA/0x23` |  | timer all-info | ParserTimers/Result4TimerAllInfo | `compose/TimerController.java` |
| 24 | gradual | BLE frame via ptReal | `0x33/0xA3` | <0\|1> | [0] | 0xAA/0xA3 | `compose/GradualController.java` |
| 25 | colour-brightness-read | BLE frame via ptReal | `0xAA/0xA5` | <index> | p()={index} | ParserMultiColorStrip | `compose/ColorBrightnessController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | brightness | BLE notify via ptReal | `0x20` |  | [0] |  | `ble/BrightnessParse.java` |
| 2 | light-child-status | BLE notify via ptReal | `0x30` |  | [0]==1, [1..3] child bools |  | `ble/LightChildStatusNotifyParse.java` |
| 3 | wifi | BLE notify via ptReal | `0x11` |  | [0]==0 connected |  | `ble/WifiNotifyParse.java` |
| 4 | device-status | BLE notify via ptReal | `0x30` |  | base DeviceStatusNotifyParse |  | `ble/BleNotifyComm.java` |
| 5 | ic-segment | BLE notify via ptReal | `0x21` |  | base CheckIcNumParse |  | `base` |
| 6 | colour-brightness | BLE notify via ptReal | `0xAA/0xA5` |  | [3] type, [4..5] LE16 index/count + RGB/brightness |  | `compose/ParserMultiColorStrip.java` |
| 7 | timer-all-info | BLE notify via ptReal | `0xAA/0x23` |  | ParserTimers |  | `compose/ParserTimers.java` |
| 8 | gradual | BLE notify via ptReal | `0xAA/0xA3` |  | [0] |  | `compose/ParserGradual.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | state | `iot/CmdTurn.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"1..100"} | {"val":"1..100"} | state | `iot/CmdBrightness.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"r":"int","g":"int","b":"int"},"colorTemInKelvin":"int"} | {"color":{"r":"int","g":"int","b":"int"},"colorTemInKelvin":"int"} | state | `iot/CmdColorWc.java` |
| 4 | status | IoT JSON | `status` | {} | {} | state/op | `iot/CmdStatus.java` |

## split_pact_h61d3

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte>"]} | `jadx-splits/split_pact_h61d3/sources/com/govee/h61d3/iot/CmdPtReal.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal | `0x33/0x01` | <0\|1> | [0] | 0xAA/0x01 | `base2light SwitchController` |
| 2 | brightness | BLE frame via ptReal | `0x33/0x04` | <1..100> | [0] | 0xAA/0x04 | `base2light BrightnessController` |
| 3 | color-mode-1 | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 01 R G B kelLo kelHi R2 G2 B2 m0..m3 | 17 bytes; 32-bit segment mask | 0xAA/0x05 | `jadx-splits/split_pact_h61d3/sources/com/govee/h61d3/adjust/color/SubModeColor.java` |
| 4 | color-mode-2 | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 02 brightness m0..m3 | brightness + 32-bit mask | 0xAA/0x05 | `same` |
| 5 | music | BLE frame via ptReal | `0x33/0x05 sub 0x13` | 13 <code> <sens> [dynamic] [auto] [R G B] | code 3 uses 8-byte extended form; sens 0..99 | 0xAA/0x05 | `jadx-splits/split_pact_h61d3/sources/com/govee/h61d3/adjust/music/SubModeMusic.java` |
| 6 | scene | BLE frame via ptReal | `0x33/0x05 sub 0x04` | 04 <effect LE16> <dir1> <dir2> [count colors...] | direction pair from SubEffect4LiuDong | 0xAA/0x05 | `jadx-splits/split_pact_h61d3/sources/com/govee/h61d3/adjust/scene/SubModeScenes.java` |
| 7 | diy | BLE frame via ptReal | `0x33/0x05 sub 0x0A` | 0A diyLo diyHi | 16-bit LE | 0xAA/0x05 | `jadx-splits/split_pact_h61d3/sources/com/govee/h61d3/adjust/diy/SubModeNewDiy.java` |
| 8 | check-ic | BLE frame via ptReal | `0x33/0x46` | CheckIcController.q() | IC check request | 0xAA/0x46 | `ble/controller/CheckIcController.java` |
| 9 | read-ic | BLE frame via ptReal | `0xAA/0x40` | range/index | IC count read | IC value | `ble/controller/ReadIcController.java` |
| 10 | read-ic-point | BLE frame via ptReal | `0xAA/0x24` |  | point request | [0]==1 point present | `ble/controller/ReadIcPointController.java` |
| 11 | secret-read | BLE frame via ptReal | `0xAA/0xB1` |  | empty read | [0]==1 + 8-byte key | `ble/controller/SecretController.java` |
| 12 | secret-write | BLE frame via ptReal | `0x33/0xB2` | <8-byte key> | base64-decoded | write result | `ble/controller/SecretController.java` |
| 13 | sn-read | BLE frame via ptReal | `0xAA/0x07` | 02 | SN sub-command | [0]==2 + 8-byte MAC | `ble/controller/SnController.java` |
| 14 | soft-hard-version | BLE frame via ptReal | `0xAA/0x07` | sub | version read | ASCII/bytes | `ble/controller/SoftHardController.java` |
| 15 | take-photo-on | BLE frame via ptReal | `0x33/0x26` | 01 64 FF FF 00 | indicator on + white | notify 0x26 on button exit | `ble/controller/TakePhotoController.java` |
| 16 | take-photo-off | BLE frame via ptReal | `0x33/0x26` | 00 | stop photo | write result | `same` |
| 17 | video-recognition-stop | BLE frame via ptReal | `0x33/0xED` | 01 | stop | notify 0xED state | `ble/controller/VideoRecognitionController.java` |
| 18 | video-recognition-start | BLE frame via ptReal | `0x33/0xED` | 00 <duration LE16> | start with duration | notify 0xED state | `same` |
| 19 | light-recognition-multi | BLE frame via ptReal | `0xA3 multi` | [index][R G B][u16][b1][b2][b3][on][n][RGB x n] | MultipleControllerCommV1.makeSendBytesV1(0xA3, 0x5D, body): index, RGB, u16, b1,b2,b3, on, n, RGB*n | write result | `ble/controller/LightRecognitionMultiController.java` |
| 20 | wifi-mac | BLE frame via ptReal | `0xAA/0x14` |  | empty read | MAC string | `ble/controller/WifiMacController.java` |
| 21 | wifi-soft | BLE frame via ptReal | `0xAA/0x21` |  | empty read | version | `ble/controller/WifiSoftController.java` |
| 22 | wifi-hard | BLE frame via ptReal | `0xAA/0x20` |  | empty read | version | `ble/controller/WifiHardController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi | BLE notify via ptReal | `0x11` |  | [0]==0 connected |  | `ble/WifiNotifyParse.java` |
| 2 | light-status | BLE notify via ptReal | `0x30` |  | [0]==1, [1] bit1 = on |  | `ble/DeviceInfoNotifyParse.java` |
| 3 | take-photo-exit | BLE notify via ptReal | `0x26` |  | event |  | `ble/TakePhotoNotifyParse.java` |
| 4 | video-recognition-state | BLE notify via ptReal | `0xED` |  | [0] state code |  | `ble/VideoRecognitionNotifyParse.java` |
| 5 | check-ic | BLE notify via ptReal | `0x46` |  | IC result |  | `ble/controller/CheckIcController` |
| 6 | read-ic-point | BLE notify via ptReal | `0x24` |  | [0]==1 |  | `ble/controller/ReadIcPointController` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | state | `base2light CmdTurn` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"1..100"} | {"val":"1..100"} | state | `base2light CmdBrightness` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"r":"int","g":"int","b":"int"},"colorTemInKelvin":"int"} | {"color":{"r":"int","g":"int","b":"int"},"colorTemInKelvin":"int"} | state | `base2light CmdColorWc` |

## split_pact_h6630

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `state` | read envelope | {"onOff":"0\|1","brightness":"0-100"} | `h6630/iot/Cmd.java; Info4Detail.Y` |
| `op` | read envelope | {"command":["<base64 20-byte frame>"]} | `Info4Detail.Y` |
| `ptReal` | transport wrapper | {"command":["<base64>"]} | `h6630/iot/Cmd.java` |
| `pt` | transport wrapper | {"command":["<base64>"]} | `h6630/iot/Cmd.java` |
| `ptUrl` | transport wrapper | {"command":"<url>"} | `CmdPtUrl; GetIotCmdPtUrlLinkInfo; H6630GifParse` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x01` | on | [0]=0/1 | 0xAA/0x01 | `generic ControllerSwitch` |
| 2 | brightness | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x04` | level | 0-100 | 0xEE/0x20 -> [0] | `generic ControllerBrightness; h6630/ble/BrightnessNotifyParse.java` |
| 3 | mode music | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x05` | 13 musicCode sensitivity | musicCode default 101, sensitivity 0-99 | 0xAA/0x05 [0]=0x13 | `h6630/ble/SubModeMusic.java` |
| 4 | mode scene | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x05` | 04 effectLE16 musicCodeLE32 speed | 8 bytes | 0xAA/0x05 [0]=0x04 | `h6630/ble/SubModeScenes.java` |
| 5 | mode new DIY | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x05` | 0A codeLE16 speedLE16 | 5 bytes | 0xAA/0x05 [0]=0x0A | `h6630/ble/SubModeNewDiy.java` |
| 6 | sub switch | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x30` | 30 type val | type 1 light, 5 disturbance/DND, 6 tone | 0xEE/0x30 -> [1] index,[2] state | `H6630ViewModel.G5; DeviceSwitchStatusNotifyParse` |
| 7 | indicator light schedule | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x30` | 30 07 en !forever startH startM endH endM | sub 7 | 0xAA/0x30 | `h6630/detail/controller/IndicatorLightController.java` |
| 8 | tone settings | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x30` | 30 06 en powerTone screenOffTone keyTone countdownTone | sub 6 | 0xAA/0x30 | `h6630/detail/controller/ToneController.java` |
| 9 | read device status | BLE frame via ptReal\|pt\|ptUrl | `0xAA/0x40` |  | 10 bytes (partially decoded) | 0xEE/0x40 | `base DeviceStatusNotifyParse; Info4Detail` |
| 10 | read device info | BLE frame via ptReal\|pt\|ptUrl | `0xAA/0x41` |  | switch bits byte0/1, C,D,E, indicator forever/start/end | 0xAA/0x41 | `Info4Detail.d0` |
| 11 | auto-upgrade query | BLE frame via ptReal\|pt\|ptUrl | `0xAA/0x25` | 02 | sub 2 | 0xAA/0x25 | `h6630/detail/controller/AutoUpgradesController.java` |
| 12 | auto-upgrade info | BLE frame via ptReal\|pt\|ptUrl | `0xAA/0x25` | 04 | sub 4 | [1,1,type,ver...] | `AutoUpgradesController.java` |
| 13 | auto-upgrade enable | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x25` | 03 on | sub 3 | ack | `AutoUpgradesController.java` |
| 14 | volume | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x79` | val | 0-100 (UI slider) | 0xAA/0x79 -> [0] | `H6630ViewModel.K5; Info4Detail.h0` |
| 15 | shortcut | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x7C` | display effect bytes | server effect type + effect id | ack | `ShortcutSetController; ShortcutPlate.d` |
| 16 | 24-hour display | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x7D` | en | 1 = 24h | ack | `H6630ViewModel.J6` |
| 17 | temperature unit | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x7E` | en | byte is !z for the caller boolean; unit convention inferred (0/1) | ack | `H6630ViewModel.Z6` |
| 18 | DIY effect write | BLE frame via ptReal\|pt\|ptUrl | `0xA3/0x58` | subEffect secondSubEffect params... | MultiController V1 pages; then mode 0x0A code 0x00FE | ack | `H6630DiyParser.makeBleController; Pro4H6630Diy.bytes` |
| 19 | tone play state | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x75` | 01 songIdLE32 02 | online sound player | 0xEE/0x70 | `SetPlayerStateController; h6630/detail/controller/TonePlayController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi state | BLE notify via ptReal\|pt\|ptUrl | `0xEE/0x11` |  | [0]==0 connected |  | `h6630/ble/WifiNotifyParse.java` |
| 2 | brightness | BLE notify via ptReal\|pt\|ptUrl | `0xEE/0x20` |  | [0] 0-100 |  | `h6630/ble/BrightnessNotifyParse.java` |
| 3 | device switch status | BLE notify via ptReal\|pt\|ptUrl | `0xEE/0x30` |  | [1] sub-index, [2] state |  | `h6630/ble/DeviceSwitchStatusNotifyParse.java` |
| 4 | device status | BLE notify via ptReal\|pt\|ptUrl | `0xEE/0x40` |  | 10 bytes (alarm/display fields partially decoded) |  | `base DeviceStatusNotifyParse; Info4Detail.U` |
| 5 | device info/switch config | BLE notify via ptReal\|pt\|ptUrl | `0xEE/0x41` |  | total/light/indicator bits, white-noise/DND/tone bits, C,D,E, indicator forever/start/end |  | `Info4Detail.d0` |
| 6 | online music | BLE notify via ptReal\|pt\|ptUrl | `0xEE/0x70` |  | OnlineMusicPares.parse(sku, bytes) |  | `base onlinesound MusicNotifyParse` |
| 7 | movie feast | BLE notify via ptReal\|pt\|ptUrl | `0xEE/0x60` |  | [0]=1,[1]=on |  | `base MovieFeastOnOffNotifyParse` |
| 8 | alarm clock | BLE notify via ptReal\|pt\|ptUrl | `0xEE/0x85` |  | alarm enable/h/m/repeat fields |  | `Info4Detail.U` |
| 9 | custom GIF result | BLE notify via ptReal\|pt\|ptUrl | `0xEE/0x7A` |  | [0]=2 -> reload DIY data |  | `Info4Detail.W` |
| 10 | tone settings read | BLE notify via ptReal\|pt\|ptUrl | `0xEE/0x30` |  | [1]=toneSwitch, [2]=power, [3]=screenOff, [4]=key, [5]=countdown |  | `Info4Detail.g0` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `h6630/iot/Cmd.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"0-100"} | {"val":"0-100"} | state | `h6630/iot/Cmd.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"red":"0-255","green":"0-255","blue":"0-255"} | {"red":"0-255","green":"0-255","blue":"0-255"} | state | `h6630/iot/Cmd.java` |
| 4 | status | IoT JSON | `status` | {} | {} | snapshot | `h6630/iot/Cmd.java` |
| 5 | online | IoT JSON | `online` | {} | {} | presence | `h6630/iot/Cmd.java` |

## split_pact_h6660

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptUrl` | transport wrapper | {"header":"0x58 0x00 0x61","payload":"base64 laser effect/drawing"} | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/detail/diy/LaserDiyParser.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptUrl | `0x33/0x01` | [0]=0\|1 | [0] on/off | 0xAA/0x01, switch notify | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/scenes/BleSwitchCmdBuilder.java` |
| 2 | brightness | BLE frame via ptUrl | `0x33/0x04` | [0]=0..100 | [0] brightness | notify 0x20 | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/detail/LaserDetailViewModel.java` |
| 3 | music_mode | BLE frame via ptUrl | `0x33/0x05` | [0]=0x13 [1]=subMusicMode [2]=sensitivity | sub-mode 0x13; multi-packet MultipleController4Music for full effect | event | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/detail/MusicModeH3810.java` |
| 4 | indicator_light | BLE frame via ptUrl | `0x33/0x30` | [0]=enable [1]=!forever?1:0 [2]=startHour [3]=startMin [4]=endHour [5]=endMin | 6-byte schedule | write result / parser 0x30 | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/ble/controller/IndicatorLightController.java` |
| 5 | wifi_upgrade | BLE frame via ptUrl | `0x33/0x25` | {4} read \| {3,flag} \| {2} read \| {1} init | [0] sub-command | [0]==1,[1]==1,[2]=state,[3..5]=soft x.y.z,[6..8]=hard x.y.z | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/ble/controller/WIFIUpgradesController.java` |
| 6 | laser_param | BLE frame via ptUrl | `0x33/0x43` | [0]=param1 [1]=param2 | 2-byte slider value pair | write callback | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/detail/LaserDetailViewModel.java` |
| 7 | base_info_single_read | BLE frame via ptUrl | `0xAA/0x25` | {0x25,0x80,0x42,0x44,0x7F} or {0x25,0x30,0x80,0x42,0x43,0x44} | multi-read command list | multi callbacks | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/detail/LaserDetailViewModel.java` |
| 8 | diy_apply | BLE frame via ptUrl | `multi + 0x0A` | effect frames + 0A <diy LE16> | multi-packet | event | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/detail/diy/LaserDiyParser.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | device_status | BLE notify via ptUrl | `0xEE/0x80` |  | byte[0] bit1..7 flags: child lock, overheat, high temp, human, electric |  | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/entity/DeviceStatusInfo.java` |
| 2 | battery | BLE notify via ptUrl | `0xEE/0x42` |  | bit8 charging, bits5..3 battery level, bits4/3/2/1 flags |  | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/entity/BatteryInfo.java` |
| 3 | brightness | BLE notify via ptUrl | `0xEE/0x20` |  | [0] 0..100 |  | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/detail/LaserDetailViewModel.java` |
| 4 | wifi | BLE notify via ptUrl | `0xEE/0x11` |  | connected bool |  | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/detail/LaserDetailViewModel.java` |
| 5 | laser_def | BLE notify via ptUrl | `0xEE/0x7F` |  | raw bytes |  | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/detail/LaserDefParser.java` |
| 6 | laser_def_2 | BLE notify via ptUrl | `0xEE/0x81` |  | raw bytes |  | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/detail/LaserDefParser.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | status | IoT JSON | `status` | {"op":["base64 20-byte frame"]} | {"op":["base64 20-byte frame"]} | on/off, battery, device status | `jadx-splits/split_pact_h6660/sources/com/govee/h6660/pact/Model.java` |

## split_pact_h682021

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["base64(20-byte frame)"]} | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/pact/Comm.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal | `0x33/0x01` | [0]=0\|1 | [0] on/off | 0xAA/0x01 | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/pact/Comm.java` |
| 2 | brightness | BLE frame via ptReal | `0x33/0x04` | [0]=0..100 | [0] brightness | notify 0x20 | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/iot/OpColorCommDialog4BleIot.java` |
| 3 | mode | BLE frame via ptReal | `0x33/0x05` | <sub-mode block> | 0x15 color, 0x04 scenes, 0x0A DIY, 0x13 music | 0xAA/0x05 | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/ble/Mode.java` |
| 4 | diy_multi | BLE frame via ptReal | `0xA3/0x5B` | makeSendBytesV3(0xA3,0x5B,diyBytes,97) + final 0A <diy LE16> | multi-packet 97-byte chunks | multi result | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/pact/Comm.java` |
| 5 | scene_multi | BLE frame via ptReal | `0xA3/0x5B` | makeSendBytesV3(0xA3,0x5B,sceneBytes,97) + final 04 <effect LE16> | multi-packet 97-byte chunks | multi result | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/pact/Comm.java` |
| 6 | heartbeat | BLE frame via ptReal | `0xAA/0x01` | none | read only, no event | - | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/pact/Comm.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | brightness | BLE notify via ptReal | `0xEE/0x20` |  | [0] 0..100 |  | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/ble/BleProtocol.java` |
| 2 | device_status | BLE notify via ptReal | `0xEE/0x80 or 0xEE/0x81` |  | status frames |  | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/ble/GattCallbackImp.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/iot/OpColorCommDialog4BleIot.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"0..100"} | {"val":"0..100"} | status | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/iot/OpColorCommDialog4BleIot.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int"} | {"color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int"} | status | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/iot/OpColorCommDialog4BleIot.java` |
| 4 | online/status | IoT JSON | `online/status` | {"state":"on/off","op":"frames"} | {"state":"on/off","op":"frames"} | online state | `jadx-splits/split_pact_h682021/sources/com/govee/h682021/pact/Model.java` |

## split_pact_h6840

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `base2light/pact/iot/CmdPtReal.java, h6609/iot/CmdPtReal.java` |
| `state` | read envelope | {} | `h6840/pact/Cmd.java` |
| `op` | read envelope | {} | `h6840/pact/Cmd.java` |
| `IoTConnected` | connection | {} | `h6609/iot/Cmd.java` |
| `ptIot` | transport wrapper | {} | `h6609/iot/Cmd.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|ptIot | `0x33/0x01` | 01\|00 | [0] state | 0xAA/0x01 | `base2light/ble/controller/SwitchController.java, h6609/ble/controller/compose/ControllerSwitch.java` |
| 2 | brightness | BLE frame via ptReal\|ptIot | `0x33/0x04` | 0..100 | [0] | 0xAA/0x04 | `base2light/ble/controller/BrightnessController.java` |
| 3 | modeH6840 | BLE frame via ptReal\|ptIot | `0x33/0x05` | sub-mode | 0x0D colour, 0x04 scene, 0x0A DIY, 0x13 music | 0xAA/0x05 | `h6840/ble/Mode.java, h6840/ble/ModeController.java` |
| 4 | positionCalibrationH6840 | BLE frame via ptReal\|ptIot | `0x33/0x42` | opaque | BleProtocol.positionCalibration=0x42 | 0xAA/0x42 | `h6840/pact/BleProtocol.java, h6840/ble/controller/PositionCalibration.java` |
| 5 | installNumberH6840 | BLE frame via ptReal\|ptIot | `0x33/0x40` | 01 … | device install/IC count | 0xEE/0x40 | `h6840/pact/BleProtocol.device_install_num` |
| 6 | secretKeyH6840 | BLE frame via ptReal\|ptIot | `0x33/0xB2 / 0xAA/0xB1` | key | 16-byte secret | 0xAA/0xB1 | `h6840/pact/BleProtocol.SECRET_KEY_*` |
| 7 | gradualH6609 | BLE frame via ptReal\|ptIot | `0x33/0xA3` | 01\|00 | fade on/off | 0xEE/0xA3 | `h6609/ble/controller/compose/GradualController.java` |
| 8 | modeH6609 | BLE frame via ptReal\|ptIot | `0x33/0x05` | sub-mode | 0x15 colour, 0x04 scene, 0x0A DIY, 0x13 music, 0x14 interactive, 0x00 video, 0x05 mic | 0xAA/0x05 | `h6609/ble/Mode.java, h6609/ble/v1/ModeV1.java` |
| 9 | icNumberH6609 | BLE frame via ptReal\|ptIot | `0xAA/0x40` |  | read IC count | 0xEE/0x40 | `h6609/ble/controller/compose/ControllerIcNum.java` |
| 10 | directionH6609 | BLE frame via ptReal\|ptIot | `0x33/0x30` | dir | [0] direction | 0xAA/0x30 | `h6609/ble/controller/compose/DirectionController.java` |
| 11 | calibrationH6609 | BLE frame via ptReal\|ptIot | `0x33/0x44` | 02 01 into / 02 00 exit | [0]=2 [1]=1\|0 | 0xAA/0x44 | `h6609/ble/controller/compose/CalibrationController.java` |
| 12 | onOffMemoryH6609 | BLE frame via ptReal\|ptIot | `0x33/0x41` | opaque | on/off memory | 0xEE/0x41 | `h6609/ble/controller/Controller4OnOffMemory.java` |
| 13 | cameraPositionH6609 | BLE frame via ptReal\|ptIot | `0x33/0x31` | opaque | MSG_TYPE_CAMERA_POSITION=49 | 0xEE/0x31 | `h6609/ble/BleProtocol.java` |
| 14 | readInstallCameraH6609 | BLE frame via ptReal\|ptIot | `0xAA/0x32` |  | MSG_TYPE_READ_INSTALL_CAMERA=50 | 0xEE/0x32 | `h6609/ble/BleProtocol.java` |
| 15 | readInstallLightH6609 | BLE frame via ptReal\|ptIot | `0xAA/0xAA` |  | MSG_TYPE_READ_INSTALL_LIGHT=-86 | 0xEE/0xAA | `h6609/ble/BleProtocol.java` |
| 16 | startTimeH6609 | BLE frame via ptReal\|ptIot | `0xAA/0x35` |  | MSG_TYPE_READ_START_TIME=53 | 0xEE/0x35 | `h6609/ble/BleProtocol.java` |
| 17 | whiteBalanceH6609 | BLE frame via ptReal\|ptIot | `0x33/0xA9` | opaque | value_white_balance=-87 | 0xEE/0xA9 | `h6609/ble/BleProtocol.java` |
| 18 | usbCheckH6609 | BLE frame via ptReal\|ptIot | `0x33/0x38` | val | value_check_usb=56 | 0xEE/0x38 | `h6609/ble/BleProtocol.java` |
| 19 | usbCheckStateH6609 | BLE frame via ptReal\|ptIot | `0x33/0x37` | val | value_check_usb_state=55 | 0xEE/0x37 | `h6609/ble/BleProtocol.java` |
| 20 | composeLightSwitchH6609 | BLE frame via ptReal\|ptIot | `0x33/0x36` | val | value_compose_light_switch=54 | 0xEE/0x36 | `h6609/ble/BleProtocol.java` |
| 21 | swapLightH6609 | BLE frame via ptReal\|ptIot | `0x33/0x34` |  | value_swap_light_pos=52 | 0xEE/0x34 | `h6609/ble/BleProtocol.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifiH6840 | BLE notify via ptReal\|ptIot | `0x00` |  | DefParser.makeWifiNotifyParser(0) |  | `h6840/ble/Ble$generateNotify$1.java` |
| 2 | wifiH6609 | BLE notify via ptReal\|ptIot | `0x11` |  | [0]==0 connected |  | `h6609/ble/WifiNotifyParse.java` |
| 3 | deviceStatus | BLE notify via ptReal\|ptIot | `0x40` |  | first 10 bytes |  | `base2light/ble/DeviceStatusNotifyParse.java` |
| 4 | lightAndHdmiH6609 | BLE notify via ptReal\|ptIot | `0x30` |  | [0]==1: light-bar presence bits from [1] |  | `h6609/ble/LightAndHdmiNotifyParse.java` |
| 5 | movieFeast | BLE notify via ptReal\|ptIot | `0x60` |  | [0]==1, [1] on/off |  | `base2light/ble/controller/MovieFeastOnOffNotifyParse.java` |
| 6 | interactiveGame | BLE notify via ptReal\|ptIot | `0x35` |  | [0] status, if 2 signed24 at [1..3] |  | `base2light/ble/InteractiveGameNotifyParse.java` |
| 7 | videoRecognitionH6609 | BLE notify via ptReal\|ptIot | `0xED` |  | [0] recognition state |  | `h6609/ble/VideoRecognitionNotifyParse.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | state | `base2light/iot/CmdTurn.java, h6609/iot/Cmd.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"0..100"} | {"val":"0..100"} | state | `base2light/iot/CmdBrightness.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"r":"0..255","g":"0..255","b":"0..255"},"colorTemInKelvin":"int"} | {"color":{"r":"0..255","g":"0..255","b":"0..255"},"colorTemInKelvin":"int"} | state | `base2light/iot/CmdColorWc.java, h6609/iot/CmdColorWc.java` |
| 4 | status | IoT JSON | `status` | {} | {} | state + op | `h6840/pact/Cmd.java, h6609/iot/Cmd.java` |
| 5 | online | IoT JSON | `online` | {} | {} | online | `h6840/pact/Cmd.java, h6609/iot/Cmd.java` |
| 6 | color | IoT JSON | `color` | {"r":"int","g":"int","b":"int"} | {"r":"int","g":"int","b":"int"} | state | `h6609/iot/Cmd.java` |
| 7 | colorTem | IoT JSON | `colorTem` | {"colorTemInKelvin":"int","color":{"r":"int","g":"int","b":"int"}} | {"colorTemInKelvin":"int","color":{"r":"int","g":"int","b":"int"}} | state | `h6609/iot/Cmd.java` |
| 8 | snapshot | IoT JSON | `snapshot` | {} | {} | camera snapshot | `h6609/iot/Cmd.java` |
| 9 | dewarpsnapshot | IoT JSON | `dewarpsnapshot` | {} | {} | de-warped camera snapshot | `h6609/iot/Cmd.java (sibling pattern)` |
| 10 | points | IoT JSON | `points` | {"points":["..."]} | {"points":["..."]} | calibration point list | `h6609/iot/Cmd.java` |
| 11 | camera | IoT JSON | `camera` | {} | {} | camera on/off | `h6609/iot/Cmd.java` |
| 12 | swap | IoT JSON | `swap` | {} | {} | swap light position | `h6609/iot/Cmd.java` |

## split_pact_h7050

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"],"isSetDynamic":"bool"} | `h7050/iot/CmdPtReal.java` |
| `pt` | transport wrapper | {} | `h7050/iot/Cmd.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|pt | `0x33/0x01` | 01\|00 | [0] state | 0xAA/0x01 -> [0] | `base2light/ble/controller/SwitchController.java` |
| 2 | brightness | BLE frame via ptReal\|pt | `0x33/0x04` | 0..100 | [0] | 0xAA/0x04 -> [0] | `base2light/ble/controller/BrightnessController.java` |
| 3 | mode | BLE frame via ptReal\|pt | `0x33/0x05` | sub-mode | sub[0] = 0x15 color, 0x04 scenes, 0x0A DIY, 0x13 music, 0x05 mic | 0xAA/0x05 | `h7050/ble/Mode.java, h7050/ble/ModeController.java` |
| 4 | segmentSetting | BLE frame via ptReal\|pt | `0x33/0x40` | totalLo totalHi total | total = bulbNum*perBulb LE16 at [0..1], [2]=low byte | 0xEE/0x40 | `h7050/ble/SegmentSettingController.java` |
| 5 | powerOrder | BLE frame via ptReal\|pt | `0x33/0x30` | order | [0] order mode | 0xAA/0x30 | `h7050/ble/PowerOrderController.java` |
| 6 | cutCalibration | BLE frame via ptReal\|pt | `0x33/0x44` | 01 index | [0]=1 [1]=cut index | 0xAA/0x44 | `h7050/ble/CutCaliController.java` |
| 7 | bulbStringColorRead | BLE frame via ptReal\|pt | `0xAA/0xA5` | index | read BulbGroupColor.parseBytes | 0xEE/0xA5 | `h7050/ble/BulbStringColorController.java` |
| 8 | multiMusic | BLE frame via ptReal\|pt | `0x33/0x41` | len code sens ... | packed layer block then 0x13 trailer | 0xEE/0x41 | `h7050/ble/MultiMusicController.java` |
| 9 | micPoint | BLE frame via ptReal\|pt | `0x33/0x05` | 05 00 r g b | [0]=5 [1]=0 [2..4]=rhythm point RGB | 0xAA/0x05 | `h7050/ble/MicController.java` |
| 10 | secretKeyWrite | BLE frame via ptReal\|pt | `0x33/0xB2` | key bytes | 16-byte secret; base SecretKeyController defaults 0xB2 write / 0xB1 read | 0xAA/0xB1 read | `h7050/scenes/BleSecretBuilderV1.java, base2light/ble/controller/SecretKeyController.java` |
| 11 | installCalibrationH3501 | BLE frame via ptReal\|pt | `0x33/0x39` | index | H3501 only (value_install_calibration_h3501=57) | 0xEE/0x39 | `h7050/pact/BleProtocol.java, newdetail/h3501/H3501CalibrationAc.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi | BLE notify via ptReal\|pt | `0x11` |  | [0]==0 connected |  | `h7050/ble/WifiNotifyParse.java` |
| 2 | brightness | BLE notify via ptReal\|pt | `0x20` |  | [0] 0..100 |  | `h7050/ble/BrightnessNotifyParse.java` |
| 3 | deviceStatus | BLE notify via ptReal\|pt | `0x40` |  | first 10 bytes |  | `base2light/ble/DeviceStatusNotifyParse.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `h7050/iot/CmdTurn.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"0..100"} | {"val":"0..100"} | status | `h7050/iot/CmdBrightness.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"r":"0..255","g":"0..255","b":"0..255"},"colorTemInKelvin":"int"} | {"color":{"r":"0..255","g":"0..255","b":"0..255"},"colorTemInKelvin":"int"} | status | `h7050/iot/CmdColorWc.java, base2light/iot/Color.java` |
| 4 | status | IoT JSON | `status` | {} | {} | state + op | `h7050/iot/Cmd.java` |
| 5 | online | IoT JSON | `online` | {} | {} | online | `h7050/iot/Cmd.java` |

## split_pact_h705a

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte>"]} | `jadx-splits/split_pact_h705a/sources/com/govee/h705a/pact/Comm.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal | `0x33/0x01` | <0\|1> | [0] | 0xAA/0x01 | `base2light SwitchController` |
| 2 | brightness | BLE frame via ptReal | `0x33/0x04` | <1..100> | [0] | 0xAA/0x04 | `base2light BrightnessController` |
| 3 | color-mode-1 | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 01 R G B kelLo kelHi R2 G2 B2 mask0..4 | 17 bytes; 5-byte segment mask up to 40 segments | 0xAA/0x05 | `jadx-splits/split_pact_h705a/sources/com/govee/h705a/mode/color/SubModeColor.java` |
| 4 | color-mode-2 | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 02 brightness mask0..4 | brightness + 5-byte mask | 0xAA/0x05 | `same` |
| 5 | music | BLE frame via ptReal | `0x33/0x05 sub 0x13` | 13 code sens 01 auto [R G B] | sensitivity 0..99; new codes 49/74/72/81/113/50/51/52/53/55/48 | 0xAA/0x05 | `jadx-splits/split_pact_h705a/sources/com/govee/h705a/mode/music/SubModeMusic.java; MusicParams4H705A.java` |
| 6 | scene | BLE frame via ptReal | `0x33/0x05 sub 0x04` | 04 effectLo effectHi | 16-bit LE | 0xAA/0x05 | `jadx-splits/split_pact_h705a/sources/com/govee/h705a/mode/scenes/SubModeScenes.java` |
| 7 | diy | BLE frame via ptReal | `0x33/0x05 sub 0x0A` | 0A diyLo diyHi | 16-bit LE | 0xAA/0x05 | `jadx-splits/split_pact_h705a/sources/com/govee/h705a/mode/diy/SubModeNewDiy.java` |
| 8 | check-ic | BLE frame via ptReal | `0x33/0x43` | <mode><index><count> | mode 0/1/2 | 0xAA/0x43 -> [0..1] IC LE16, [2] segment | `jadx-splits/split_pact_h705a/sources/com/govee/h705a/ble/controller/CheckIcController.java` |
| 9 | cut-calibration | BLE frame via ptReal | `0x33/0x44` | <0\|1\|2>[<index><count>] | mode 2 adds index/count | 0xAA/0x44 | `jadx-splits/split_pact_h705a/sources/com/govee/h705a/ble/controller/CutCaliController.java` |
| 10 | ic-setting | BLE frame via ptReal | `0x33/0x40` | <value> | [0] segment/IC value | 0xAA/0x40 | `jadx-splits/split_pact_h705a/sources/com/govee/h705a/ble/controller/ICSettingController.java` |
| 11 | segment-setting | BLE frame via ptReal | `0x33/0x0F` | <value> | [0] | 0xAA/0x0F | `jadx-splits/split_pact_h705a/sources/com/govee/h705a/ble/controller/SegmentSettingController.java` |
| 12 | color-group | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 04 idx R G B R G B R G B R G B | 4 RGB triplets | 0xAA/0x05 | `jadx-splits/split_pact_h705a/sources/com/govee/h705a/ble/controller/ColorStripComposeController.java` |
| 13 | brightness-group | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 03 idx b0..b13 | 14 brightness bytes | 0xAA/0x05 | `same` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | ic-segment | BLE notify via ptReal | `0x21` |  | [0..1] IC LE16, [2] segment |  | `jadx-splits/split_pact_h705a/sources/com/govee/h705a/ble/CheckIcNumParse.java` |
| 2 | light-status | BLE notify via ptReal | `0x30` |  | [0]==1, [1] bit1 = on |  | `jadx-splits/split_pact_h705a/sources/com/govee/h705a/ble/notify/DeviceInfoNotifyParse.java` |
| 3 | wifi | BLE notify via ptReal | `0x11` |  | [0]==0 connected |  | `base WifiNotifyParse` |
| 4 | check-ic-result | BLE notify via ptReal | `0x43` |  | [0..1] IC, [2] segment |  | `CheckIcController` |
| 5 | cut-cali-result | BLE notify via ptReal | `0x44` |  | [0] result,[1] index,[2] count |  | `CutCaliController` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | state | `base2light CmdTurn` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"1..100"} | {"val":"1..100"} | state | `base2light CmdBrightness` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"r":"int","g":"int","b":"int"},"colorTemInKelvin":"int"} | {"color":{"r":"int","g":"int","b":"int"},"colorTemInKelvin":"int"} | state | `base2light CmdColorWc` |

## split_pact_h7075

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `base2light.pact.iot.CmdPtReal` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal | `0x33/0x01` | <0\|1> | [0] on/off | 0xAA/0x01 | `base2light SwitchController` |
| 2 | brightness | BLE frame via ptReal | `0x33/0x04` | <1..100> | [0] level | 0xAA/0x04 | `pact/Comm.java` |
| 3 | color-mode-1-rgb-temp | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 01 R G B kelLo kelHi R2 G2 B2 m0 m1 m2 m3 | 17 bytes; mask is 32 segments (colour size dependent) | 0xAA/0x05 | `jadx-splits/split_pact_h7075/sources/com/govee/h7075/mode/color/SubModeColor.java` |
| 4 | color-mode-2-brightness | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 02 level m0 m1 m2 m3 | single brightness + segment mask | 0xAA/0x05 | `same` |
| 5 | color-mode-3-segment-brightness | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 03 idx b0..b13 | 14 brightness bytes | 0xAA/0x05 | `same` |
| 6 | color-mode-4-group-rgb | BLE frame via ptReal | `0x33/0x05 sub 0x15` | 15 04 idx R G B R G B R G B R G B | 4 RGB triplets | 0xAA/0x05 | `same` |
| 7 | mic | BLE frame via ptReal | `0x33/0x05 sub 0x05` | 05 01 | enter mic/sound-reactive mode; sub_mode_music 0x13 declared but unused | 0xAA/0x05 | `jadx-splits/split_pact_h7075/sources/com/govee/h7075/mode/mic/SubModeMic.java` |
| 8 | scene | BLE frame via ptReal | `0x33/0x05 sub 0x04` | 04 effectLo effectHi | 16-bit LE effect code | 0xAA/0x05 | `jadx-splits/split_pact_h7075/sources/com/govee/h7075/mode/scenes/SubModeScenes.java` |
| 9 | diy | BLE frame via ptReal | `0x33/0x05 sub 0x0A` | 0A diyLo diyHi | 16-bit LE DIY code | 0xAA/0x05 | `jadx-splits/split_pact_h7075/sources/com/govee/h7075/mode/diy/SubModeNewDiy.java` |
| 10 | ic-check | BLE frame via ptReal | `0x33/0x43` | <mode><index><count> | CheckIcController q() | 0xAA/0x43 | `jadx-splits/split_pact_h7075/sources/com/govee/h7075/ble/BleProtocol.java (CHECK_IC=67)` |
| 11 | cut-calibration-v1 | BLE frame via ptReal | `0x33/0x44` | <0\|1\|2> | mode 2 adds index+count | 0xAA/0x44 | `BleProtocol.CUT_CALI=68` |
| 12 | cut-calibration-v2 | BLE frame via ptReal | `0x33/0x46` | <0\|1\|2> | as v1 | 0xAA/0x46 | `BleProtocol.CUT_CALI_V2=70` |
| 13 | splicing | BLE frame via ptReal | `0x33/0x40` | 02 00 \| 02 01 R G B | exit/query \| set group colour | 0xAA/0x40 | `jadx-splits/split_pact_h7075/sources/com/govee/h7075/h7078/controller/SplicingController.java; SplicingNewController.java` |
| 14 | change-splicing-multi | BLE frame via ptReal | `0x5F multi` | <index><direction><MAC x6>... | MultiController with MULTI_DEVICE_SPLICING=95 | splice state | `jadx-splits/split_pact_h7075/sources/com/govee/h7075/h7078/controller/ControllerChangeSplicing.java` |
| 15 | read-splicing-state | BLE frame via ptReal | `0xAA/0x4B` |  | empty read | [0]==1 spliced | `Controller4ReadSpliceState (cmd 75)` |
| 16 | read-sub-device-version | BLE frame via ptReal | `0xAA/0x4C` |  | empty read | version bytes | `ControllerReadSubDeviceVersion (cmd 76)` |
| 17 | motion-switch | BLE frame via ptReal | `0x33/0x47` | mode payload | toggle/enter motion mode | 0xAA/0x47 | `Controller4MotionSwitch (cmd 71)` |
| 18 | motion-delete | BLE frame via ptReal | `0x33/0x48` | <motionId LE32> | 4-byte id | write result | `Controller4DeleteMotion (cmd 72); MotionConstants.e(int)` |
| 19 | motion-exit-preview | BLE frame via ptReal | `0x33/0x49` |  | empty | write result | `Controller4ExitMotionPreview (cmd 73)` |
| 20 | stop-light-effect | BLE frame via ptReal | `0x33/0x25` | 01 | [0]=1 | write result | `Controller4StopLightEffect (cmd 37)` |
| 21 | install-direction | BLE frame via ptReal | `0x33/0x16` | <1\|2> | [0] install direction | 0xAA/0x16 | `BleProtocol.SET_INSTALLATION_DIRECTION=22` |
| 22 | motion-info-read | BLE frame via ptReal | `0xAA/0x05` |  | empty read | [0] groupCount, then groupCount*6: motionId LE32 + version LE16 | `jadx-splits/split_pact_h7075/sources/com/govee/h7075/h7078/controller/MotionReadInfoController.java; motion/MotionConstants.java` |
| 23 | brightness-sensor-read | BLE frame via ptReal | `0xAA/0x4B` |  | empty read | BrightnessInfo: envLow/envHigh/envCur, devLow/devHigh, switch 0/1/2, start/end, days, allTime | `jadx-splits/split_pact_h7075/sources/com/govee/h7075/h7072/sensor/BrightnessInfo.java` |
| 24 | light-sense-model | BLE frame via ptReal | `0x33/0x24` | 24 <enable> <minGear 0..3> <maxGear 0..3> <allDay> <timeLE16> | 7 bytes | 0xAA/0x24 -> enable,min,max,allDay,time | `jadx-splits/split_pact_h7075/sources/com/govee/h7075/r3352/protocol/R3352LightSenseInfo.java` |
| 25 | auto-dimming | BLE frame via ptReal | `0x33/0x25` | 25 <enable> <min 1..100> <max 1..100> <effectTime> | 5 bytes | 0xAA/0x25 | `jadx-splits/split_pact_h7075/sources/com/govee/h7075/r3352/protocol/R3352AutoDimmingInfo.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | brightness | BLE notify via ptReal | `0x20` |  | [0] brightness |  | `base BrightnessNotifyParse` |
| 2 | ic-segment | BLE notify via ptReal | `0x21` |  | [0..1] IC LE16, [2] segment count |  | `base CheckIcNumParse` |
| 3 | device-status | BLE notify via ptReal | `0x30` |  | [0]==1, [1] bit1 = on |  | `base DeviceStatusNotifyParse` |
| 4 | splice-state | BLE notify via ptReal | `0x4B` |  | [0]==1 |  | `Controller4ReadSpliceState` |
| 5 | motion-devices | BLE notify via ptReal | `0x05` |  | groupCount + 6-byte records |  | `MotionReadInfoController` |
| 6 | brightness-sensor | BLE notify via ptReal | `0x4B` |  | BrightnessInfo |  | `h7072/sensor/BrightnessInfo.java` |
| 7 | light-sense | BLE notify via ptReal | `0x24` |  | [0] enable,[1] min,[2] max,[3] allDay,[4..5] time LE16 |  | `R3352LightSenseInfo` |
| 8 | auto-dimming | BLE notify via ptReal | `0x25` |  | [0] enable,[1] min,[2] max,[3] effectTime |  | `R3352AutoDimmingInfo` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | state | `base2light CmdTurn` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"1..100"} | {"val":"1..100"} | state | `base2light CmdBrightness` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"r":"int","g":"int","b":"int"},"colorTemInKelvin":"int"} | {"color":{"r":"int","g":"int","b":"int"},"colorTemInKelvin":"int"} | state | `base2light CmdColorWc` |
| 4 | status | IoT JSON | `status` | {} | {} | state/op | `base AbsDeviceModel4BleIot` |

## split_pact_h70b1

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `pt` | transport wrapper | {"op":"mode\|gradual\|sleep\|timer\|wakeup","value":["<base64 frame>"]} | `h70b1/origin/iot/CmdPt.java (origin Cmd)` |
| `ptReal` | transport wrapper | {"command":["<base64 frame>"]} | `h70b1/origin/iot/CmdPtReal.java; h70b3/iot/CmdPtReal.java; h70dx/iot/CmdPtReal.java` |
| `ptUrl` | transport wrapper | {"url":"<blob url>","op":"..."} | `h70b2/origin/iot/GetIotCmdPtUrlLinkInfo.java; h70b3/iot/GetIotCmdPtUrlLinkInfo.java; h70dx/scenes/GetIotCmdPtUrlLinkInfo.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x01` | 00\|01 | [0] on/off | 0xAA/0x01 -> [0] | `base2light SwitchController via family Comm` |
| 2 | brightness | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x04` | <level> | [0] level | 0xAA/0x04 -> [0] | `h70b1/origin/pact/Comm.java; h70b3/pact/Comm.java; h70dx/pact/Comm.java` |
| 3 | mode | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x05` | <submode> | [0]=sub-mode | 0xAA/0x05 with p()={1} | `base AbsModeController + family ModeController` |
| 4 | color (all families) | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x05, submode 0x0D or 0x15` | 0D R G B kelLo kelHi R2 G2 B2 (H70B1/B2/BC/B3/B4/B5/H681x/H6800); 15 01 R G B kelLo kelHi R2 G2 B2 mask0..n (H70DX 10-seg) | Kelvin 1000..10000K; H70DX mask 10 bits | read-back | `h70b1/origin/ble/SubModeColor.java; h70b3/ble/SubModeColor.java; h70dx/ble/SubModeColor.java` |
| 5 | music | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x05, submode 0x13` | 13 musicCode sens | code default 101 (H70B1/H70B3/H70DX); sensitivity 0..99 | read-back | `h70b1/origin/ble/SubModeMusic.java; h70b3/ble/SubModeMusic.java; h70dx/ble/SubModeMusic.java` |
| 6 | scene | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x05, submode 0x04` | 04 effLo effHi musicByte (H70B1/B3/H70DX); 04 effLo effHi musicLo musicHi (H7086 sibling) | 16-bit LE effect; music byte is a music/scene flavour id | read-back | `family SubModeScenes.java` |
| 7 | DIY | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x05, submode 0x0A` | 0A diyLo diyHi | 16-bit LE DIY code | read-back | `family SubModeNewDiy.java` |
| 8 | interactive game (H6800) | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x05, submode 0x14` | 14 01 sens oneLevel [soundLevel timeLo timeHi \| twoLevel difficulty] | level time 14/28/42/56/70/98/126; 0x14 read [4..6]=startTime 24-bit (300000-ms) | 0xAA/0x05 submode 0x14 | `h70b3/mode/game/SubModeInteractive.java` |
| 9 | splicing / subgroup | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x40` | 02 00 \| 02 01 R G B | H70B1 origin SplicingController | write ack | `h70b1/origin/ble/SplicingController.java` |
| 10 | device / install number | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x40 (read no payload)` | [count] | read returns count; write sets count | read | `h70b3/adjust/controller/ControllerDeviceNum.java` |
| 11 | change splicing | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x40` | 01 index dirMask MAC[6]... | dirMask bits: 01100000/01101100 (dir 0), 10010000/10011100 (dir 1), 11011000 (dir!=0/1) | write ack | `h70bx/controller/ControllerChangeSplicing.java` |
| 12 | position calibration | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x42` | mode dir 01 | mode 0/1/2, direction byte; read p()={1} | 0xAA/0x42 | `h70b3/ble/controller/PositionCalibration.java` |
| 13 | read sub-device version | BLE frame via ptReal\|pt\|ptUrl | `0xAA/0x43` |  | read | version bytes | `h70bx/controller/ControllerReadSubDeviceVersion.java` |
| 14 | SN read | BLE frame via ptReal\|pt\|ptUrl | `0xAA/0x07` | 02 | response [0]=2 then 8-byte MAC | MAC string | `h70b3/adjust/controller/SnController.java` |
| 15 | secret key read | BLE frame via ptReal\|pt\|ptUrl | `0xAA/0xB1` |  | response [0]==1 + 8 bytes | base64 key | `h70b3/adjust/controller/SecretController.java` |
| 16 | secret key write | BLE frame via ptReal\|pt\|ptUrl | `0x33/0xB2` | 8 bytes | base64-decoded secret | ack | `h70b3/adjust/controller/SecretController.java` |
| 17 | display write (H70B3/B6) | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x7F` | subcmd + data | subcmd 6 = countdown request (notify 0x7F [1]==6) | 0x7F notify | `h70b3/pact/BleProtocol.java; h70b6/adjust/VM4H70B6.java` |
| 18 | 24-hour mode (H70B6) | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x7D` | 00\|01 | [0] 1=24h | ack | `h70b6/adjust/VM4H70B6.java#c6` |
| 19 | temperature unit (H70B6) | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x7E` | 00\|01 | [0] 1=Celsius (caller passes !z) | ack | `h70b6/adjust/VM4H70B6.java#g6` |
| 20 | wifi upgrade (H70B6) | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x7D` | 04\|01\|02 | 4=query, 1=start, 2=status; response [0]=1,[1]=1,[2]=state,[3..5]=wifi soft,[6..8]=wifi hard | read | `h70b6/controller/WIFIUpgradesController.java` |
| 21 | H70DX install info | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x39` | installType direction | H70D1 {1,1}/{1,2}; H70D2/D3 {2,1}/{2,2} | read [0] | `h70dx/ble/controller/ControllerInstallInfo.java` |
| 22 | H70DX init light effect | BLE frame via ptReal\|pt\|ptUrl | `0x33/0x38` | [effectIndex] | 0..N | read [0] | `h70dx/ble/controller/ControllerInitLightEffect.java` |
| 23 | multi-frame DIY/scene | BLE frame via ptReal\|pt\|ptUrl | `0xA3/0xA4 + idx; final 0x05` | MultipleControllerCommV1.makeSendBytesV3(0xA3, shareCode, body, 97) | shareCode 83/91 (H70B1), 83/91 (H70B3), DIY protocol code 0x58 | per chunk | `h70b1/origin/pact/Comm.java; h70b3/pact/Comm.java; h70dx/diy/*` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi connected | BLE notify via ptReal\|pt\|ptUrl | `0x11` |  | [0]==0 |  | `h70b1/origin/ble/WifiNotifyParse.java` |
| 2 | brightness | BLE notify via ptReal\|pt\|ptUrl | `0x20` |  | [0] level |  | `h70b1/origin/ble/BrightnessNotifyParse.java` |
| 3 | device info / light status | BLE notify via ptReal\|pt\|ptUrl | `0x30` |  | [0]==1, [1] bit1 = light status |  | `h70b1/origin/ble/notify/DeviceInfoNotifyParse.java` |
| 4 | display countdown | BLE notify via ptReal\|pt\|ptUrl | `0x7F` |  | [0]==0x81 (-127), [1]==6 -> countdown active |  | `h70b6/adjust/VM4H70B6.java#Y5` |
| 5 | feast switch | BLE notify via ptReal\|pt\|ptUrl | `0x01` |  | [0]==1, [1]==1 feast on; H70B6 Z5 |  | `h70b6/adjust/VM4H70B6.java#Z5` |
| 6 | feast switch (H70B3) | BLE notify via ptReal\|pt\|ptUrl | `0x60` |  | [0]==1, [1]==1 feast on |  | `h70b3/pact/BleProtocol.java#m; h70b3/adjust/vm/VM4H70B345.java#q6` |
| 7 | secret key / SN | BLE notify via ptReal\|pt\|ptUrl | `0xAA/0xB1, 0xAA/0x07` |  | as commands |  | `h70b3/adjust/controller/SecretController.java; SnController.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | state/status | `h70b1/origin/iot/CmdTurn.java; h70b3/iot/CmdTurn.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"int"} | {"val":"int"} | state.brightness | `h70b1/origin/iot/CmdBrightness.java; h70b3/iot/CmdBrightness.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"red":"0-255","green":"0-255","blue":"0-255"},"colorTemInKelvin":"int"} | {"color":{"red":"0-255","green":"0-255","blue":"0-255"},"colorTemInKelvin":"int"} | state | `h70b1/origin/iot/CmdColorWc.java` |
| 4 | status (read) | IoT JSON | `status (read)` | {} | {} | state.onOff/brightness/color; op ptReal bytes | `family Info4Detail` |

## split_pact_h7111

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `base_h71xx/sku_base/iot/CmdPtReal.java` |
| `multiSync` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `base_h71xx/sku_base/iot/CmdMultiSync.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|multiSync | `0x33/0x01` | [on][mode][params] | on 1/0 then mode record | 0xAA/0x01 valid[0] | `h7111/ble/controller/ModeController.java, h7100, h7105` |
| 2 | mode | BLE frame via ptReal\|multiSync | `0x33/0x05 sub 0x00` | GEAR [01][gear]; AUTO [03 or 02][startGear][startTemp*100 LE16][endGear][endTemp*100 LE16]; CUSTOM [02/05][nibbles][children]; SLEEP [05/03][level]; NATURAL [06/04][level]; STORM [07] | mode bytes differ for old/new protocol and by family | 0xAA/0x05 -> mode record | `h7111/adjust/ModeInfo.java, h7100/adjust/ModeInfo.java, h7105/adjust/ModeInfo.java` |
| 3 | gear | BLE frame via ptReal\|multiSync | `0x33/0x05 sub 0x08` | [08][gear] | gear level | read [08] -> [1] | `h7111/ble/controller/ModeGearController.java` |
| 4 | auto ramp | BLE frame via ptReal\|multiSync | `0x33/0x05 sub 0x03` | [autoMode][startGear][startTemp*100 LE16][endGear][endTemp*100 LE16] | 7 bytes | read [03] | `h7111/adjust/ModeAuto.java, h7112/bean/ModeAuto.java` |
| 5 | custom/DIY table | BLE frame via ptReal\|multiSync | `0x33/0x05 sub 0x02/0x05 (H7105: 0xA3 multi)` | [customMode][(cur<<4)\|set] + children | H7111/H7100 child [type][curTemp LE16][targetTemp LE16] (5B); H7105 child 7B + optional centerAngle*10 LE16 + symmetry | read [02]/[05] | `h7111/adjust/ModeCustom.java, h7105/adjust/ModeCustom.java, h7105/ble/controller/DiyModeMultipleControl.java` |
| 6 | read mode | BLE frame via ptReal\|multiSync | `0xAA/0x05` | [00] or [mode] | current mode record | mode + params | `h7111/ble/controller/ModeCurController.java, h7100 H7100ModeController, h7105 H7105ModeController` |
| 7 | shake/oscillation (H7105) | BLE frame via ptReal\|multiSync | `0x33/0x1D` | on [01][speed 1..3][angle 30..180][center*10 LE16][symmetry]; off [00][direction] | angle min 30; center 0..180; speed 1..3 | read | `h7105/ble/controller/H7105ShakeController.java, ShakeBean` |
| 8 | shake/oscillation (H7111) | BLE frame via ptReal\|multiSync | `0x33/0x1F sub 0x01` | on [01][speed][angle][center LE16][symmetry]; off [00][direction] | same ranges; sub-id 1 under setting command 0x1F | read 0x1F payload [01] | `h7111/ble/controller/ModeShakeController.java` |
| 9 | beep | BLE frame via ptReal\|multiSync | `0x33/0x1F` | [06][00/01] | sub-id 6 | read [06] | `h7111/ble/controller/BeepSwitchController.java, h7105` |
| 10 | light sub-command (H7105) | BLE frame via ptReal\|multiSync | `0x33/0x1B` | LightSubCmd brightness/mode payload | sub-command byte selects brightness or mode | notify 0x1B | `h7105/ble/DevCommReportParse.java, base_h71xx/light71xx` |
| 11 | abnormal info | BLE frame via ptReal\|multiSync | `0x33/0x17` | 01 request | [flag][code] response | 0xAA/0x17 | `h7111/ble/controller/AbnormalInfoController.java, h7100, h7105` |
| 12 | common switch read | BLE frame via ptReal\|multiSync | `0xAA/0x1F` | none | [0]/[1]/[7] flags | beep/display/child-lock flags | `h7100/ble/controller/CommonSwitchController.java, h7105 equivalent` |
| 13 | delay start | BLE frame via ptReal\|multiSync | `0x33/0x23` | [on][setMin LE16][timestamp LE32] | 7 payload bytes | read 0x23 | `h7105/ble/controller/DefiniteTimeController.java` |
| 14 | keep warm | BLE frame via ptReal\|multiSync | `0x33/0x22` | [on][min LE16][min LE16] | writer duplicates minutes | read 0x22 | `h7105/ble/controller/KeepWarmController.java` |
| 15 | real-time temp | BLE frame via ptReal\|multiSync | `0xAA/0x10` | none | [1..2] signed BE16 | temperature | `h7111/ble/controller/RealTimeTemController.java` |
| 16 | timer | BLE frame via ptReal\|multiSync | `0x33/0x13` | 8-byte timer record | group/enable/hour/min/repeat/mode/modeValue/comfort | read 0x13 | `h7112/vm/H7112SharedViewModel.java, base_h71xx NewTimerV1Controller` |
| 17 | thermometer read (H7112) | BLE frame via ptReal\|multiSync | `0xAA/0x10` | none | [flag][temp int24 BE][type] | connected + temp + type | `base_h71xx/sku_base/ble/controller/GetThermometerController.java` |
| 18 | bind thermometer (H7112) | BLE frame via ptReal\|multiSync | `0x33/0x08` | reversed MAC 6 bytes | MAC | same 6 bytes | `base_h71xx/sku_base/ble/controller/BindTemperatureController.java, h7112/vm/H7112SharedViewModel.java` |
| 19 | unbind thermometer (H7112) | BLE frame via ptReal\|multiSync | `0x33/0x09` | none | — | — | `h7112/vm/H7112SharedViewModel.java W0` |
| 20 | humidity cali (H7112) | BLE frame via ptReal\|multiSync | `0x33/0x1E` | [02][02 save\|01 read][value LE16] | sub 2 = humidity | read [02] | `h7112/vm/H7112SharedViewModel.java writeHumCaliCmd` |
| 21 | temp cali (H7112) | BLE frame via ptReal\|multiSync | `0x33/0x1E` | [01][02 save\|01 read][value LE16] | sub 1 = temperature | read [01] | `h7112/vm/H7112SharedViewModel.java writeTemCaliCmd` |
| 22 | temp/sensor unit | BLE frame via ptReal\|multiSync | `0x33/0x1F` | [08][00/01] | sub-id 8 | read [08] | `base_h71xx/sku_base/ble/controller/SensorTempUnitController.java, h7112 TempUnitSwitchController` |
| 23 | delay-off (H7112) | BLE frame via ptReal\|multiSync | `0x33/0x26` | [on][min LE16] | 3 bytes | read 0x26 | `base_h71xx/sku_base/ble/controller/DelayOffControllerV1.java` |
| 24 | not-disturb | BLE frame via ptReal\|multiSync | `0x33/0x16` | [enable][forever][startH][startM][endH][endM] or 2 bytes when forever | forever flag expands | read 0x16 | `base_h71xx/sku_base/ble/controller/NotDisturbController.java` |
| 25 | heart/state | BLE frame via ptReal\|multiSync | `0xAA/0x01` | none | h7111 [0] on [1] flag [2..4] int24 temp [5][6] ints [7] flag; h7100 [0] on [1] mode [8] autoOff [9] value; h7105 [5] autoOff [6] mode [8] value | state | `h7111/ble/HeartControllerV1.java, h7100, h7105` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi/ble state | BLE notify via ptReal\|multiSync | `notify 0x11` |  | [0]==0 connected |  | `all ble/WifiNotifyParse.java` |
| 2 | device report | BLE notify via ptReal\|multiSync | `header 0xEE, subcmd byte1` |  | 0x05 mode / 0x1F switches / 0x16 not-disturb / 0x26 delay-off / 0x17 abnormal / 0x1B light / 0x1D shake |  | `h7100/ble/BleNotifyComm.java, h7105/ble/DevCommReportParse.java` |
| 3 | heart | BLE notify via ptReal\|multiSync | `read 0x01` |  | see command table |  | `h7111/h7100/h7105/HeartController*.java` |
| 4 | beep/temp unit | BLE notify via ptReal\|multiSync | `0x1F notify` |  | [id][0/1] |  | `h7111/iot/CmdStatusParseV1.java, h7105/iot/CmdStatusParseV1.java` |
| 5 | light subcommand | BLE notify via ptReal\|multiSync | `0x1B` |  | brightness/mode |  | `h7105/ble/DevCommReportParse.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `base_h71xx/sku_base/iot/CmdTurn.java` |
| 2 | status (read) | IoT JSON | `status (read)` | {} | {} | state {onOff,result} + op.command[] | `base_h71xx/sku_base/iot/CmdStatus.java, h7111/iot/CmdStatusParseV2.java` |

## split_pact_h7120

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte BLE frame>"]} | `h7120/adjust/v1/IotOpV1.java` |
| `multiSync` | transport wrapper | {} | `base_h71xx/sku_base/iot/Cmd.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|multiSync | `0x33/0x01` | 01=on, 00=off | [0] state | 0xAA/0x01 -> [0] state | `base_h71xx/sku_base/ble/controller/SwitchController.java` |
| 2 | brightness | BLE frame via ptReal\|multiSync | `0x33/0x04` | val 0-100 | [0] brightness | 0xAA/0x04 -> [0] brightness | `base2light/ble/controller/BrightnessController.java` |
| 3 | mode | BLE frame via ptReal\|multiSync | `0x3A/0x05` | [modeId, value] | modeId: GEAR=0x08, SLEEP=0x05, AUTO=0x03; GEAR value=gear 1..n; AUTO value=0 | 0xAA/0x05 -> [0] modeId [1] gear | `h7120/ble/controller/ModeController.java, h7120/adjust/Mode.java, h7120/adjust/ModeInfo.java` |
| 4 | abnormalInfo | BLE frame via ptReal\|multiSync | `0x33/0x17` | 01 | read: [0] code [1] subCode | 0xAA/0x17 | `h7120/adjust/AbnormalInfo.java, h7120/ble/controller/AbnormalInfoController.java` |
| 5 | airQualityStateInfo | BLE frame via ptReal\|multiSync | `0x33/0x19` | pmLo pmHi level extra | read: [0..1] signed16 LE value, [2] level, [3] extra | 0xAA/0x19 | `base_h71xx/sku_base/adjust/component/bean/AirQualityInfo.java, h7120/ble/controller/StateInfoController.java` |
| 6 | delayOff | BLE frame via ptReal\|multiSync | `0x33/0x11` | on minLo minHi | read: [0] isOpen, [1..2] minutes LE16, [3..5] remaining seconds LE24 | 0xAA/0x11 | `base_h71xx/sku_base/ble/controller/DelayOffController.java` |
| 7 | notDisturb | BLE frame via ptReal\|multiSync | `0x33/0x16` | enable startH startM endH endM forever | enable 0x01; forever=1 means 00:00-23:59 | 0xAA/0x16 | `base_h71xx/sku_base/ble/controller/NotDisturbController.java` |
| 8 | timerGroupWrite | BLE frame via ptReal\|multiSync | `0x33/0x13` | group enableSwitch hour min repeat mode modeValue comfortable | V2 8 bytes; H7122 V3 appends area LE16 | 0xAA/0x13 | `base_h71xx/sku_base/ble/controller/TimerGroupControllerV2.java, h7122/ble/controller/TimerGroupControllerV3.java` |
| 9 | timerGroupDelete | BLE frame via ptReal\|multiSync | `0x33/0x15` | group | [0] group index | 0xAA/0x15 | `base_h71xx/sku_base/ble/controller/TimerGroupDeleteController.java` |
| 10 | timerCountRead | BLE frame via ptReal\|multiSync | `0xAA/0x12` |  | returns timer count | 0xEE/0x12 or 0xAA/0x12 | `base_h71xx/sku_base/ble/controller/TimerCountController.java` |
| 11 | syncTime | BLE frame via ptReal\|multiSync | `0x33/0xB5` | 7 bytes: timestamp LE32 + TZ offset + minute offset | see getSignedBytesFor4 timestamp | none | `base_h71xx/sku_base/ble/controller/SyncTimeController.java` |
| 12 | reportChart | BLE frame via ptReal\|multiSync | `0x33/0x30` | 01 | request device to report PM chart data | chart data channel | `base_h71xx/sku_base/ble/controller/ReportChartController.java, h7120/adjust/v1/CommandOpV1.java` |
| 13 | indicatorLightH7121 | BLE frame via ptReal\|multiSync | `0x33/0x1A` | 0x26=on, 0x11=off | [0] flag | 0xAA/0x1A | `h7121/ble/controller/IndicatorLightController.java` |
| 14 | childLockH7121 | BLE frame via ptReal\|multiSync | `0x33/0x09` | 0x02=lock, 0x08=unlock | [0] flag | 0xAA/0x09 | `h7121/ble/controller/ChildLockController.java` |
| 15 | gearH7121 | BLE frame via ptReal\|multiSync | `0x33/0x1C` | gear | [0] gear 1..n | 0xAA/0x1C | `h7121/ble/controller/GearController.java` |
| 16 | nightLightH7121 | BLE frame via ptReal\|multiSync | `0x33/0x17` | onFlag brightness | onFlag 0x10 or 0x1C, [1] brightness | 0xAA/0x17 | `h7121/ble/controller/NightLightController.java` |
| 17 | childLockH7122 | BLE frame via ptReal\|multiSync | `0x33/0x10` | 01=lock, 00=unlock | [0] state | 0xAA/0x10 | `h7122/ble/controller/ChildLockController.java` |
| 18 | airQualityReadH7122 | BLE frame via ptReal\|multiSync | `0xAA/0x1C` | val | read-only | 0xEE/0x1C | `h7122/ble/controller/AirQualityController.java` |
| 19 | filterStateReadH7122 | BLE frame via ptReal\|multiSync | `0xAA/0x19` | 01 | read-only | 0xEE/0x19 | `h7122/ble/controller/FilterStateController.java` |
| 20 | modeCustomH7126 | BLE frame via ptReal\|multiSync | `0x3A/0x05` | 02 (curIdx<<4\|setGear) {gearIdx setMinLE16 leaveMinLE16}* | repeat 5 bytes per gear; disabled gear = 0x00 | 0xAA/0x05 | `h7126/ble/controller/bean/ModeCustom.java` |
| 21 | modeGearH7126 | BLE frame via ptReal\|multiSync | `0x3A/0x05` | 08 gear | [0]=0x08 [1]=gear | 0xAA/0x05 | `h7126/ble/controller/ModeGearController.java` |
| 22 | modeAutoH7126 | BLE frame via ptReal\|multiSync | `0x3A/0x05` | 03 eco efficient useArea | eco/efficient 00/01, useArea int | 0xAA/0x05 | `h7126/ble/controller/bean/ModeAuto.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi | BLE notify via ptReal\|multiSync | `0x11` |  | [0]==0 means Wi-Fi connected |  | `h7120/ble/WifiNotifyParse.java` |
| 2 | heartbeat | BLE notify via ptReal\|multiSync | `0x01` |  | carries device state + error byte |  | `h7120/ble/HeartControllerV1.java` |
| 3 | mode | BLE notify via ptReal\|multiSync | `0x05` |  | [0] mode id, [1] gear/extra |  | `h7126/ble/ModeNotifyParse.java` |
| 4 | airQuality | BLE notify via ptReal\|multiSync | `0x19` |  | [0..1] value LE16, [2] level, [3] extra |  | `h7126/ble/StateInfoNotifyParse.java` |
| 5 | abnormal | BLE notify via ptReal\|multiSync | `0x17` |  | [0] code, [1] sub-code |  | `h7126/ble/AbnormalNotifyParse.java` |
| 6 | delayOff | BLE notify via ptReal\|multiSync | `0x11` |  | [0] on, [1..2] min LE16, [3..5] remaining sec LE24 |  | `h7126/ble/DelayOffNotifyParse.java` |
| 7 | notDisturb | BLE notify via ptReal\|multiSync | `0x16` |  | DND window |  | `h7126/ble/NotDisturbNotifyParse.java` |
| 8 | deviceStatus | BLE notify via ptReal\|multiSync | `0x40` |  | first 10 bytes of status frame |  | `base2light/ble/DeviceStatusNotifyParse.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | state.onOff | `h7121/iot/CmdTurn.java` |
| 2 | status | IoT JSON | `status` | {} | {} | state + op.pt[] | `base_h71xx/sku_base/iot/CmdStatus.java` |
| 3 | online | IoT JSON | `online` | {} | {} | online state | `h7120/adjust/v1/IotPactV1.java` |

## split_pact_h7130

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>","..."]} | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/iot/CmdPtReal.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal | `0x33/0x01` | <0\|1> | [0] on/off | 0xAA/0x01 -> [0] on, [1] product flag, [2] mode, [3] state-change | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/SwitchControllerV1.java` |
| 2 | gear | BLE frame via ptReal | `0x33/0x05` | <gear> | [0] gear index | 0xAA/0x05 -> [0] gear | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/GearController.java` |
| 3 | mode-gear-auto-fan | BLE frame via ptReal | `0x33/0x05` | 01\|03\|09 | h7132/3/5 mode: 0x01 gear, 0x03 auto, 0x09 fan (+mode params) | 0xAA/0x05 | `jadx-splits/split_pact_h7130/sources/com/govee/h7132/ble/controller/ModeController.java; h7132/adjust/Mode.java` |
| 4 | constant-temperature-v1 | BLE frame via ptReal | `0x33/0x1A` | <on><unit><tempLE16> | [0] enable [1] unit/flag [2..3] target centi-degree LE16 | 0xAA/0x1A -> [0] on [1] unit [2] bit7 F [2..3]&0x7FFF temp | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/ConstantTemperatureController.java` |
| 5 | constant-temperature-v3 | BLE frame via ptReal | `0x33/0x1A` | <on><mode><tempLE16 bit7=F> | [0] on [1] mode [2..3] temp LE16; bit7 of [2] = Fahrenheit | 0xAA/0x1A | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/ConstantTemperatureControllerV3.java; v3/bean/ConstantTempInfo.java` |
| 6 | child-lock | BLE frame via ptReal | `0x33/0x10` | <0\|1> | [0] 1 lock | 0xAA/0x10 -> [0] | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/ChildLockController.java` |
| 7 | oscillation | BLE frame via ptReal | `0x33/0x18` | <0\|1> | [0] 1 on | 0xAA/0x18 -> [0] | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/RotateController.java` |
| 8 | timer-write | BLE frame via ptReal | `0x33/0x13` | <group><enable\|on><hour><min><repeat><gear> | [0] group [1] enable<<7\|on [2] hour [3] min [4] repeat bitmask [5] gear | 0xAA/0x13 -> same 6 bytes | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/TimerGroupController.java; adjust/timer/TimerInfo.java` |
| 9 | timer-count-read | BLE frame via ptReal | `0xAA/0x13 or 0xAA/0xFF` |  | empty; 0xFF denotes end of timer list | [0] count | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/TimerCountController.java` |
| 10 | timer-delete | BLE frame via ptReal | `0x33/0x15` | <group> | [0] group | write result | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/TimerGroupDeleteController.java` |
| 11 | timer-protected | BLE frame via ptReal | `0xAA/0x19` |  | empty read | [0..1] int16 LE minutes | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/TimerProtectedController.java` |
| 12 | no-disturb | BLE frame via ptReal | `0x33/0x16` | <enable><startH><startM><endH><endM> | forever uses [1..4]=FF | 0xAA/0x16 -> 5 bytes | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/NotDisturbController.java` |
| 13 | delay-off-v2 | BLE frame via ptReal | `0x33/0x11` | <open><minLE16> | [0] open [1..2] minutes LE16 | 0xAA/0x11 -> [0] open [1..2] totalMin [3..5] leaveSec | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/DelayOffController.java` |
| 14 | delay-off-v1 | BLE frame via ptReal | `0x33/0x26` | <open><minLE16> | as delay-off-v2 | 0xAA/0x26 | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/DelayOffControllerV1.java` |
| 15 | sync-time | BLE frame via ptReal | `0x33/0xB5` | <epochLE32><01><tzHour><tzMin> | 7 bytes | write result | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/SyncTimeController.java` |
| 16 | bind-thermometer | BLE frame via ptReal | `0x33/0x08` | <6-byte MAC reversed> | MAC little-endian address bytes | 0xAA/0x08 -> MAC; all zero = unbound | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/BindTemperatureController.java` |
| 17 | unbind-thermometer | BLE frame via ptReal | `0x33/0x09` |  | empty | write result | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/UnbindTemperatureController.java` |
| 18 | mcu-version-read | BLE frame via ptReal | `0xAA/0x07` | 0A soft \| 0B hard | p() = {0x0A} or {0x0B} | ASCII version string | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/McuSoftVersionController.java; McuHardVersionController.java` |
| 19 | temp-calibration | BLE frame via ptReal | `0x33/0x1E` | <02\|01><signed centi-degree LE16> | [0] 0x02 write / 0x01 read [1..2] offset | 0xAA/0x1E -> [0] result [1..2] offset | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/controller/TemperatureCaliController.java` |
| 20 | abnormal-info | BLE frame via ptReal | `0xAA/0x17` |  | empty read | [0] code | `jadx-splits/split_pact_h7130/sources/com/govee/h7132/ble/controller/AbnormalInfoController.java` |
| 21 | common-switch | BLE frame via ptReal | `0x33/0x1F` | <0\|1> | [0] | 0xAA/0x1F -> [0] | `jadx-splits/split_pact_h7130/sources/com/govee/h7132/ble/controller/CommonSwitchController.java` |
| 22 | power-saving-read | BLE frame via ptReal | `0xAA/0x23` |  | empty read | PowerSavingControllerKt.parse4PowerSaving(validBytes) | `jadx-splits/split_pact_h7130/sources/com/govee/h7132/ble/controller/PowerSavingController.java` |
| 23 | swing-leaf | BLE frame via ptReal | `0x33/0x2A` | <on\|off>[<speed<<4\|angle>] | on=0x01 off=0x16; optional [1] speed high nibble, angle low nibble | 0xAA/0x2A | `jadx-splits/split_pact_h7130/sources/com/govee/h7133/ble/controller/SwingLeafController.java` |
| 24 | work-status | BLE frame via ptReal | `0x33/0x22` | 01 | [0]=1 | [0] status | `jadx-splits/split_pact_h7130/sources/com/govee/h7133/ble/controller/WorkStatusController.java` |
| 25 | temperature-unit | BLE frame via ptReal | `0x33/0x1F` | <0\|1> | [0] 1=C 0=F (call passes !z) | 0xAA/0x1F | `jadx-splits/split_pact_h7130/sources/com/govee/h7133/ble/controller/H7138TempUnitChangeController.java` |
| 26 | heart | BLE frame via ptReal | `0xAA/0x01` |  | empty; base HeartController | 0xEE/0x01 -> [0] power [1] 0=running [2] mode [3] gear | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/HeartControllerV1.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | gear-report | BLE notify via ptReal | `0xEE/0x05` |  | [0] gear |  | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/DevCommReportParse.java` |
| 2 | child-lock-report | BLE notify via ptReal | `0xEE/0x10` |  | [0] != 0 |  | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/DevCommReportParse.java` |
| 3 | rotate-report | BLE notify via ptReal | `0xEE/0x18` |  | [0] != 0 |  | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/DevCommReportParse.java` |
| 4 | not-disturb-report | BLE notify via ptReal | `0xEE/0x16` |  | [0] enable [1] forever/startH [2] startM [3] endH [4] endM |  | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/DevCommReportParse.java` |
| 5 | bind-temperature-report | BLE notify via ptReal | `0xEE/0x08` |  | 6-byte MAC; zero = unbound |  | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/DevCommReportParse.java` |
| 6 | delay-off-report | BLE notify via ptReal | `0xEE/0x03 or 0x11` |  | [0] open [1..2] totalMin [3..5] leaveSec |  | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/DevCommReportParse.java` |
| 7 | client-lock | BLE notify via ptReal | `0xEE/0x17` |  | [0]==0 lock [1] level |  | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/ClientLockEvent.java` |
| 8 | wifi-connect | BLE notify via ptReal | `0x11` |  | [0]==0 connected |  | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/ble/WifiNotifyParse.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | state.onOff | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/iot/CmdTurn.java` |
| 2 | status | IoT JSON | `status` | {} | {} | state/op/warn | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/iot/CmdStatus.java` |
| 3 | online | IoT JSON | `online` | {} | {} | state | `jadx-splits/split_pact_h7130/sources/com/govee/h7130/iot/Cmd.java` |

## split_pact_h7170

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `base_h71xx/sku_base/iot/CmdPtReal.java` |
| `multiSync` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `base_h71xx/sku_base/iot/CmdMultiSync.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|multiSync | `0x33/0x01` | [on][mode][params] | on 1/0; mode byte then mode-specific params | 0xAA/0x01 valid[0] | `h7170/ble/controller/SwitchController.java, h7173 equivalent` |
| 2 | mode/recipe | BLE frame via ptReal\|multiSync | `0x33/0x05 sub 0x00` | h7170/h7173: [00][mode][params]; h7171: [mode][modeTempSet][brewSwitch]; h7175: [mode][temp*100 LE16] | mode values per SKU | 0xAA/0x05 {00} -> valid[0]=0, valid[1]=mode | `h7170/ble/controller/ModeCurController.java, h7173/ble/controller/ModeCurWriteController.java, h7171, h7175` |
| 3 | gear | BLE frame via ptReal\|multiSync | `0x33/0x05 sub 0x08` | [08][gear] | gear level | 0xAA/0x05 [08] -> [1] | `h7111-style ModeGearController; h7105/h7115 shared` |
| 4 | auto table | BLE frame via ptReal\|multiSync | `0x33/0x05 sub 0x03` | [03][startGear][startTemp*100 LE16][endGear][endTemp*100 LE16] | start/end gear+temp | read [03] | `h7175/ble/controller/ModeController.java` |
| 5 | custom/DIY table | BLE frame via ptReal\|multiSync | `0x33/0x05 sub 0x02` | [02][slot][child1 4B][child2 4B] | child=[temp*100 LE16][diyId][brewOpen]; unused=FF | read [02][slot] | `h7170/ble/controller/DiyModeWriteController.java, h7173 CustomModeWriteController` |
| 6 | read current mode | BLE frame via ptReal\|multiSync | `0xAA/0x05` | [00] | — | mode + params | `h7170/ble/controller/ModeCurController.java` |
| 7 | delay start | BLE frame via ptReal\|multiSync | `0x33/0x23` | [on][setMin LE16][timestamp LE32] | 7 payload bytes; timestamp=unix seconds + setMin*60 | 0xAA/0x23 -> same 7 bytes | `h7170/adjust/DelayStartInfo.java, h7170/ble/controller/ModeStartController.java` |
| 8 | keep warm | BLE frame via ptReal\|multiSync | `0x33/0x22` | [on][setMin LE16][setMin LE16] | writer duplicates setMin; reader takes [on][setMin][leaveMin] | 0xAA/0x22 | `h7170/adjust/KeepWarm.java, h7170/ble/controller/KeepWarmController.java` |
| 9 | real-time temperature | BLE frame via ptReal\|multiSync | `0xAA/0x10` | none | valid[1..2] signed BE16 | signed 16-bit | `h7170/ble/controller/RealTimeTemController.java` |
| 10 | equipment status | BLE frame via ptReal\|multiSync | `0xAA/0x19` | none | valid[0]=WorkStatus | 0 idle,1 heating,2 keep-warm,3 boiling,4 finish,5 cooling,6 reservation | `h7170/ble/controller/EquipmentStatusController.java, h7170/adjust/WorkStatus.java` |
| 11 | abnormal info | BLE frame via ptReal\|multiSync | `0x33/0x17` | 01 request | [flag][code] response | 0xAA/0x17 | `h7170/ble/controller/AbnormalInfoController.java` |
| 12 | beep | BLE frame via ptReal\|multiSync | `0x33/0x1F` | [06][00/01] | sub-id 6 | read [06] | `h7170/ble/controller/BeepSwitchController.java, h7173 SettingSwitchController` |
| 13 | temp/sensor unit switch | BLE frame via ptReal\|multiSync | `0x33/0x1F` | [08][00/01] | sub-id 8 | read [08] | `h7171/ble/controller/SensorUnitController.java, h7175 TempUnitSwitchController` |
| 14 | water light (H7173) | BLE frame via ptReal\|multiSync | `0x33/0x1B` | single [01][mode][RGB]; all [05] + 5 RGB | modes DIY=1/BOIL=2/TEA=3/COFFEE=4/KEEP_TEMP=5; all order KEEP_TEMP,BOIL,TEA,COFFEE,DIY | read [01]/[05] | `h7173/ble/controller/WaterLightController.java, h7173/adjust/WaterLight*.java` |
| 15 | setting switch (H7173) | BLE frame via ptReal\|multiSync | `0x33/0x1F` | [id][00/01] | id 6 beep, 8 temp unit, 3 water light switch | read [id] | `h7173/ble/controller/SettingSwitchController.java` |
| 16 | timer (shared) | BLE frame via ptReal\|multiSync | `0x33/0x13` | NewTimerV1Controller record (8 bytes) | group/enable/hour/min/repeat/mode/modeValue/comfort | 0xAA/0x13 | `base_h71xx timer controller, h7112 SharedViewModel timer write` |
| 17 | DIY read/write | BLE frame via ptReal\|multiSync | `0xAA/0x05 / 0x33/0x05 sub 0x02` | [02][slot] | 10-byte record | record | `h7170/ble/controller/DiyModeReadController.java, DiyModeWriteController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi/ble state | BLE notify via ptReal\|multiSync | `notify 0x11` |  | [0]==0 connected |  | `all four ble/WifiNotifyParse.java` |
| 2 | equipment status | BLE notify via ptReal\|multiSync | `notify 0x19` |  | [0]=WorkStatus |  | `h7170/ble/EquipmentStatusParse.java, h7175 equivalent` |
| 3 | device report | BLE notify via ptReal\|multiSync | `header 0xEE, subcmd byte1` |  | 0x05 mode / 0x1F switches / 0x16 not-disturb / 0x26 delay-off / 0x17 abnormal / 0x1B water light |  | `h7173/ble/DevCommReportParse.java, h7175/ble/DevCommReportParse.java` |
| 4 | heart/state | BLE notify via ptReal\|multiSync | `read reply 0x01` |  | [0] on, [1] modeChange, [3..4] temp signed BE16, [5] keep flag, [6] WorkStatus |  | `h7170/ble/HeartControllerV1.java, h7173/h7175` |
| 5 | mode read events | BLE notify via ptReal\|multiSync | `0x05 reads` |  | temp x100 / custom 10-byte records |  | `h7173/ble/controller/ModeRead*.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `base_h71xx/sku_base/iot/CmdTurn.java` |
| 2 | status (read) | IoT JSON | `status (read)` | {} | {} | state {onOff,result} + op.command[] | `base_h71xx/sku_base/iot/CmdStatus.java, h7170/iot/CmdStatusParseV1.java` |

## split_pact_h7172

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["base64(20-byte frame)"]} | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/adjust/v1/IotOpV1.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal | `0x33/0x01` | [0]=0\|1, if on [1]=1 (ice) or 2 | [0] on/off | 0xAA/0x01 -> [0]!=0 | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/ble/controller/SwitchController.java` |
| 2 | base_switch | BLE frame via ptReal | `0x33/0x1F` | [0]=switchId (6\|7\|8\|9) [1]=state (1 on / 0 off) | four appliance switches | read [0]=switchId [1]!=0 | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/ble/controller/BaseSwitchController.java` |
| 3 | delay_start | BLE frame via ptReal | `0x33/0x23` | [0]=enable [1..2]=delayMinutes LE16 [3..6]=startEpochSec LE32 [7]=mode | delay start schedule | DelayStartInfo parse | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/ble/controller/DelayStartController.java` |
| 4 | equipment_status_read | BLE frame via ptReal | `0xAA/0x19` | none | read only | [0]=WorkStatus (0 idle,1 making,2 finish,3 washing,4 wash finish,5 reservation) | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/ble/controller/EquipmentStatusController.java` |
| 5 | abnormal_info | BLE frame via ptReal | `0xAA/0x17` | {1} read/write | clear72h + abnormalStatus | [0]=clear72h [1]=abnormalStatus | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/ble/controller/AbnormalInfoController.java` |
| 6 | ice_size | BLE frame via ptReal | `0x33/0x05` | [0]=1 big \| 2 middle \| 3 small | [0] ice size | read [0] | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/ble/controller/IceSizeController.java` |
| 7 | ice_full_switch | BLE frame via ptReal | `0x33/0x1F` | [0]=switchId [1]=state | shares 0x1F with base switches | parse | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/ble/controller/IceFullSwitchController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi | BLE notify via ptReal | `0xEE/0x11` |  | connected bool |  | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/ble/WifiNotifyParse.java` |
| 2 | heart | BLE notify via ptReal | `0xAA/0x01` |  | read only |  | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/ble/HeartControllerV1.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | status | IoT JSON | `status` | {} | {} | state.onOff + op frame list | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/adjust/v1/IotOpV1.java` |
| 2 | online | IoT JSON | `online` | {"val":"0\|1"} | {"val":"0\|1"} | online state | `jadx-splits/split_pact_h7172/sources/com/govee/h7172/pact/Model.java` |

## split_pact_h7180

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["base64(20-byte frame)"]} | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/adjust/v1/IotOpV1.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | mode_submit | BLE frame via ptReal | `0x3A/0x05 write, 0xAA/0x05 read` | [0]=modeByte; DIY adds [1]=diyIndex | mode 0 none,1 rice,2 saute,3 steam,4 slowcook,5 diy | [0]=modeByte + bean bytes | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/ModeController.java` |
| 2 | keep_temp | BLE frame via ptReal | `0x33\|0xAA/0x22` | [0]=type(1 inner/2 outside) [1]=start [2..3]=temp*100 LE16 [4..5]=keepWarmSumTime LE16 (type 1 inserts mode at [1]) | keep warm config | KeepTempBean | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/KeepTempController.java` |
| 3 | weigh | BLE frame via ptReal | `0x33\|0xAA/0x23` | [0]=start [1]=unit | [0] start, [1] unit | [0]=start [1..2]=weight LE16 (bit15 sign) [3]=unit | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/WeighController.java` |
| 4 | recipe_making | BLE frame via ptReal | `0x33\|0xAA/0x24` | [0]=start [1]=type (only [0] when start=1) | menu recipe start/stop | [0]=start [1]=flagFinish [2]=deviceState [3..4]=menuCode LE16 [5]=index [6]=mode [7]=gear [8..9]=workMinute [10..11]=leaveMinute | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/RecipeMakingController.java` |
| 5 | recipe_multi | BLE frame via ptReal | `0xA3/0x24` | MenuListMenuResponse.Data bytes | multi V1 | event | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/RecipeMakingModeMultipleControl.java` |
| 6 | collect_water_remind | BLE frame via ptReal | `0xAA/0x25` | none | read only | [0]==1 -> remind event | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/CollectWaterController.java` |
| 7 | not_disturb | BLE frame via ptReal | `0x33\|0xAA/0x16` | [0]=enable(1)/disable(0) [1]=startHour [2]=startMin [3]=endHour [4]=endMin [5]=0 scheduled/1 forever | DND schedule | [0]=enable [1..4]=times [5]=forever flag | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/H7180NotDisturbController.java` |
| 8 | abnormal_info | BLE frame via ptReal | `0xAA/0x17` | {1} | clear72h + abnormal | [0]=clear72h [1]=abnormalStatus | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/AbnormalInfoController.java` |
| 9 | diy_multi | BLE frame via ptReal | `0xA3/0x05` | CookingDiyModelBean bytes | multi V1: start, stepState, reservation LE16, up to 3 programs {code, workMinute, leaveMinute}, deviceState | event | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/controller/DiyModeMultipleControl.java` |
| 10 | equipment_status | BLE frame via ptReal | `0xAA/0x19` | none | read only | [0]=Mode [1]=DeviceState | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/adjust/v1/BleOpV1.java` |
| 11 | delay_off | BLE frame via ptReal | `0x33/0x??` | base DelayOffController(0,0,3) | delay off | - | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/adjust/v1/BleOpV1.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | mode | BLE notify via ptReal | `0xEE/0x05` |  | mode payload (0x3A write-ack ignored) |  | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/iot/CmdStatusParseV1.java` |
| 2 | not_disturb | BLE notify via ptReal | `0xEE/0x16` |  | enable + start/end + forever flag |  | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/iot/CmdStatusParseV1.java` |
| 3 | work_status | BLE notify via ptReal | `0xEE/0x17` |  | work status/abnormal byte |  | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/iot/CmdStatusParseV1.java` |
| 4 | keep_temp | BLE notify via ptReal | `0xEE/0x22` |  | KeepTempBean |  | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/iot/CmdStatusParseV1.java` |
| 5 | weigh | BLE notify via ptReal | `0xEE/0x23` |  | WeighBean |  | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/WeighNotifyParse.java` |
| 6 | recipe_making | BLE notify via ptReal | `0xEE/0x24` |  | RecipeMakingBean |  | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/ble/RecipeMakingNotifyParse.java` |
| 7 | collect_water_remind | BLE notify via ptReal | `0xEE/0x25` |  | [0]==1 |  | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/iot/CmdStatusParseV1.java` |
| 8 | mode_state | BLE notify via ptReal | `0xEE/0x19` |  | [0]=Mode [1]=DeviceState |  | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/iot/CmdStatusParseV1.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | status | IoT JSON | `status` | {} | {} | state.onOff + op bytes | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/adjust/v1/IotOpV1.java` |
| 2 | online | IoT JSON | `online` | {"val":"0\|1"} | {"val":"0\|1"} | online | `jadx-splits/split_pact_h7180/sources/com/govee/h7180/pact/Model.java` |

## split_pact_hollowlamp

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `hollowlamp/iot/CmdPtReal.java; h6057/origin/iot/CmdPtReal.java; straightfloorlamp/iot/CmdPtReal.java; tablelampv1/iot/CmdPtReal.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal | `0x33/0x01` | 01 <0/1> | [0] state | 0xAA/0x01 -> [0] | `base2light/ble/controller/SwitchController.java` |
| 2 | brightness | BLE frame via ptReal | `0x33/0x04` | 04 <1..100> | [0] brightness | 0xAA/0x04 -> [0] | `base2light/ble/controller/BrightnessController.java` |
| 3 | heartbeat | BLE frame via ptReal | `0xAA/0x01` | 01 | no payload; H6055 battery is in response byte [4] | [0] alive | `base2light/ble/controller/HeartController.java` |
| 4 | read_mode | BLE frame via ptReal | `0xAA/0x05` | 05 01 | AbsModeController.p() = {0x01} | mode + sub-mode | `base2light/ble/controller/AbsModeController.java` |
| 5 | read_color_group | BLE frame via ptReal | `0xAA/0xA5` | A5 <group> | response [0]=group, then 4 x (brightness,R,G,B) | 0xAA/0xA5 | `base2light/kt/general_controller/Controller4ColorInfoByGroup.java` |
| 6 | read_bulb_color | BLE frame via ptReal | `0xAA/0xA2` | A2 | colour-only read | 0xAA/0xA2 | `base2light/kt/general_controller/Controller4ColorInfoByGroup.generateReadController4OnlyColor` |
| 7 | color | BLE frame via ptReal | `0x33/0x05` | 05 0D R G B CT_H CT_L R2 G2 B2 | sub-mode 0x0D, CT big-endian, R2G2B2 temperature RGB | 0xAA/0x05 sub-mode 0x0D | `jadx-splits/split_pact_hollowlamp/sources/com/govee/hollowlamp/ble/SubModeColor.java` |
| 8 | scene | BLE frame via ptReal | `0x33/0x05` | 05 04 <effLo> <effHi> | 16-bit LE effect, default 0x22 (34) | 0xAA/0x05 sub-mode 0x04 | `hollowlamp/ble/SubModeScenes.java` |
| 9 | diy | BLE frame via ptReal | `0x33/0x05` | 05 0A <diyLo> <diyHi> | 16-bit LE DIY code | 0xAA/0x05 sub-mode 0x0A | `hollowlamp/ble/SubModeNewDiy.java` |
| 10 | music_v1 | BLE frame via ptReal | `0x33/0x05` | 05 0E <effect> <sens> <flag> [R G B] | flag 0=auto (4 bytes), 1=manual color (7 bytes); sens 0-99 | 0xAA/0x05 sub-mode 0x0E | `hollowlamp/ble/SubModeMusic.java` |
| 11 | music_v2 | BLE frame via ptReal | `0x33/0x05` | 05 0F 04 <sens> <effect> <flag> [R G B] | 8 bytes; effect mode id; flag 0 auto / 1 manual | 0xAA/0x05 sub-mode 0x0F | `hollowlamp/ble/SubModeMusicV2.java` |
| 12 | music_v3 | BLE frame via ptReal | `0x33/0x05` | 05 13 <effect> <manual> <sens> 00 | effect 75=Rhythm, 76=Magic; manual 0/1; sens 0-99 | 0xAA/0x05 sub-mode 0x13 | `hollowlamp/ble/SubModeMusicV3.java` |
| 13 | multi_music_color | BLE frame via ptReal | `0xA3/0x41` | 41 <musicEffect> <count> <R G B>x count | multi-packet V1; realtime per-segment music colors | write result | `hollowlamp/ble/MultiMusicController.java` |
| 14 | local_color_read | BLE frame via ptReal | `0xAA/0xA5` | A5 <page> | 24-slot table, 4 colors per response; response [0]=page [1]=total [2..]=12 RGB bytes | 0xAA/0xA5 | `hollowlamp/ble/LocalColorReadControllerV1.java` |
| 15 | local_color_write | BLE frame via ptReal | `0xA3/0xA5` | A5 <count> <R G B CT_H CT_L> x count | 24 local colors, 5 bytes each | write result | `hollowlamp/ble/LocalColorSettingMultiControllerV1.java` |
| 16 | auto_induction | BLE frame via ptReal | `0x33/0xA6` | A6 <0/1> | PIR auto on/off (H6059) | 0xAA/0xA6 | `hollowlamp/ble/OnOffAutoInductionController.java` |
| 17 | sensitivity | BLE frame via ptReal | `0x33/0xA7` | A7 <value> | PIR sensitivity (H6059, soft >= 1.00.12) | 0xAA/0xA7 | `hollowlamp/ble/SensitiveController.java` |
| 18 | mic_realtime_rgb | BLE frame via ptReal | `0x33/0x83` | 83 R G B | realtime mic/segment color | write result | `base2light/ble/mic/controller/MicSetRgbController.java` |
| 19 | color | BLE frame via ptReal | `0x33/0x05` | 05 0D R G B CT_H CT_L R2 G2 B2 | same 0x0D color layout | 0xAA/0x05 | `h6057/origin/ble/SubModeColor.java` |
| 20 | scene_with_music | BLE frame via ptReal | `0x33/0x05` | 05 04 <effLo> <effHi> <musicCode> | 16-bit LE effect + music code byte; default effect 2800 | 0xAA/0x05 | `h6057/origin/ble/SubModeScenes.java` |
| 21 | game | BLE frame via ptReal | `0x33/0x05` | 05 0B <gameCode> | game id | 0xAA/0x05 | `h6057/origin/ble/SubModeGame.java` |
| 22 | music | BLE frame via ptReal | `0x33/0x05` | 05 13 <musicCode> <sens> | sensitivity 0-99; default code 57 | 0xAA/0x05 | `h6057/origin/ble/SubModeMusic.java` |
| 23 | diy | BLE frame via ptReal | `0x33/0x05` | 05 0A <diyLo> <diyHi> | 16-bit LE DIY code | 0xAA/0x05 | `h6057/origin/ble/SubModeNewDiy.java` |
| 24 | light_switch | BLE frame via ptReal | `0x33/0x30` | 30 <0/1> | main light | 0xAA/0x30 | `h6057/origin/ble/BleProtocol.java` |
| 25 | energy_saving | BLE frame via ptReal | `0x33/0x16` | 16 <0/1> | low energy mode | 0xAA/0x16 | `h6057/origin/ble/EnergySavingController.java` |
| 26 | play_voice | BLE frame via ptReal | `0x33/0x31` | 31 <index> | voice prompt index | write result | `h6057/origin/ble/Controller4PlayVoice.java` |
| 27 | pause_voice | BLE frame via ptReal | `0x33/0x32` | 32 <index> | pause voice | write result | `h6057/origin/ble/Controller4PauseVoice.java` |
| 28 | preview_effect | BLE frame via ptReal | `0x33/0x27` | 27 <f> <h> <g> <i> <j> <kHi> <kMid> <kLo> | 8 bytes; last 3 bytes are a 24-bit color code | write result | `h6057/origin/ble/Controller4PreviewEffect.java` |
| 29 | preset_info | BLE frame via ptReal | `0xAA/0x24` | 24 | pre-set info | 0xAA/0x24 | `h6057/origin/ble/PreSetInfoController.java` |
| 30 | preset_color | BLE frame via ptReal | `0x33/0x25` | 25 <index> | read/write preset color slot | 0xAA/0x25 | `h6057/origin/ble/PreSetColorController.java` |
| 31 | preset_scene | BLE frame via ptReal | `0x33/0x26` | 26 <index> | read/write preset scene slot | 0xAA/0x26 | `h6057/origin/ble/PreSetSceneController.java` |
| 32 | delete_preset_scene | BLE frame via ptReal | `0x33/0x28` | 28 <bytes> | delete preset | 0xAA/0x28 | `h6057/origin/ble/DeletePreSetSceneController.java` |
| 33 | sort_preset_scene | BLE frame via ptReal | `0x33/0x29` | 29 <bytes> | reorder presets | 0xAA/0x29 | `h6057/origin/ble/SortPreSetSceneController.java` |
| 34 | multi_preset_color | BLE frame via ptReal | `0x33/0x0B` | 0B <bytes> | multi-slot preset color | write result | `h6057/origin/ble/MultiPreSetColorController.java` |
| 35 | volume | BLE frame via ptReal | `0x33/0x33` | 33 <0..N> | speaker volume | 0xAA/0x33 | `h6057/origin/ble/BleProtocol.java` |
| 36 | detail_info | BLE frame via ptReal | `0xAA/0x34` | 34 | detail data (battery/volume/music) | 0xAA/0x34 | `h6057/origin/ble/GetDetailInfoController.java` |
| 37 | no_disturb | BLE frame via ptReal | `0x33/0x35` | 35 <0/1> | do-not-disturb | 0xAA/0x35 | `h6057/origin/ble/BleProtocol.java` |
| 38 | night_mode | BLE frame via ptReal | `0x33/0x36` | 36 <0/1> | night mode | 0xAA/0x36 | `h6057/origin/ble/BleProtocol.java` |
| 39 | worry_free_night | BLE frame via ptReal | `0x33/0x36` | 36 01 <a> <b> <c> <d> <e> <f> | 7-byte night policy, distinguished from night mode by leading 01 | 0xAA/0x36 | `h6057/origin/ble/WorryFreeAtNightController.java` |
| 40 | prompt_tone | BLE frame via ptReal | `0x33/0x37` | 37 <0/1> | hint voice | 0xAA/0x37 | `h6057/origin/ble/PromptToneController.java` |
| 41 | indicator_light | BLE frame via ptReal | `0x33/0x38` | 38 <0/1> | indicator LED | 0xAA/0x38 | `h6057/origin/ble/GuideLightController.java` |
| 42 | color_legacy | BLE frame via ptReal | `0x33/0x05` | 05 14 R G B CT_H CT_L R2 G2 B2 00 <mask> | 11 bytes; mask bit per segment | 0xAA/0x05 sub-mode 0x14 | `straightfloorlamp/ble/SubModeColor.java` |
| 43 | color_v2 | BLE frame via ptReal | `0x33/0x05` | 05 15 <subtype...> | subtype 1 RGB+CT+mask, 2 brightness+mask, 3 brightness values, 4 strip group | 0xAA/0x05 sub-mode 0x15 | `straightfloorlamp/ble/SubModeColorV2.java` |
| 44 | scene | BLE frame via ptReal | `0x33/0x05` | 05 04 <effLo> <effHi> | 16-bit LE; default 2002 / 2099 (H6072,H8072) / 2143 (H6076) | 0xAA/0x05 sub-mode 0x04 | `straightfloorlamp/ble/SubModeScenes.java` |
| 45 | music | BLE frame via ptReal | `0x33/0x05` | 05 0F <effect> <sens> <flag> [R G B] | 7 bytes; effect 4 uses 8 bytes with extra mode byte | 0xAA/0x05 sub-mode 0x0F | `straightfloorlamp/ble/SubModeMusic.java` |
| 46 | music_v2 | BLE frame via ptReal | `0x33/0x05` | 05 0F <effect> <sens> <flag> [R G B] | new music codes; auto/manual | 0xAA/0x05 sub-mode 0x0F | `straightfloorlamp/ble/SubModeMusicV2.java` |
| 47 | abs_music | BLE frame via ptReal | `0x33/0x05` | 05 16 <...> | base SubModeAbsMusic (energy/impact/jet/joy/jump/rhythm) | 0xAA/0x05 sub-mode 0x16 | `base2light/ble/controller/SubModeAbsMusic.java` |
| 48 | diy | BLE frame via ptReal | `0x33/0x05` | 05 0A <diyLo> <diyHi> | 16-bit LE DIY code | 0xAA/0x05 sub-mode 0x0A | `straightfloorlamp/ble/SubModeNewDiy.java` |
| 49 | gradual_change | BLE frame via ptReal | `0x33/0xA3` | A3 <0/1> | gradual transition on/off; cmdType is literally 0xA3 | 0xAA/0x05 | `straightfloorlamp/ble/Gradual4BleWifiController.java` |
| 50 | remote_pair | BLE frame via ptReal | `0x33/0xA4` | A4 01 | start pairing | 0xAA/0xA4 | `straightfloorlamp/ble/RemoteController.java` |
| 51 | remote_exit_pair | BLE frame via ptReal | `0x33/0xA6` | A6 | stop pairing | 0xAA/0xA6 | `straightfloorlamp/ble/ExitRemoteController.java` |
| 52 | color | BLE frame via ptReal | `0x33/0x05` | 05 0D R G B CT_H CT_L R2 G2 B2 | 9 bytes, CT big-endian | 0xAA/0x05 | `tablelampv1/ble/SubModeColor.java` |
| 53 | scene | BLE frame via ptReal | `0x33/0x05` | 05 04 <effLo> <effHi> | 16-bit LE, default 13 | 0xAA/0x05 | `tablelampv1/ble/SubModeScenes.java` |
| 54 | music | BLE frame via ptReal | `0x33/0x05` | 05 0F <effect> <sens> <flag> [R G B] | 7 bytes; effect 4 -> 8 bytes | 0xAA/0x05 | `tablelampv1/ble/SubModeMusic.java` |
| 55 | music_v2 | BLE frame via ptReal | `0x33/0x05` | 05 13 <musicCode> <sens> | H6078 codes 105/72/85/50/84/98 | 0xAA/0x05 | `tablelampv1/ble/v2/SubModeMusicV2.java` |
| 56 | diy | BLE frame via ptReal | `0x33/0x05` | 05 0A <diyLo> <diyHi> | 16-bit LE | 0xAA/0x05 | `tablelampv1/ble/SubModeNewDiy.java` |
| 57 | indicator_light | BLE frame via ptReal | `0x33/0x16` | 16 <enable> <startH> <startM> <endH> <endM> | forever = 16 01 FF FF FF FF | 0xAA/0x16 | `tablelampv1/ble/NewLightIndicatorController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | brightness | BLE notify via ptReal | `0xEE/0x20` |  | [0] brightness 0-100 |  | `*/ble/BrightnessNotifyParse.java` |
| 2 | device_status | BLE notify via ptReal | `0xEE/0x40` |  | first 10 bytes forwarded |  | `base2light/ble/DeviceStatusNotifyParse.java` |
| 3 | wifi | BLE notify via ptReal | `0xEE/0x11` |  | [0]==0 connected |  | `*/ble/WifiNotifyParse.java` |
| 4 | device_info | BLE notify via ptReal | `0xEE/0x30` |  | sub-command [0]: 1 light status (bit1), 2 energy saving (bit1), 3 battery, 4 music info ([1],[2]), 5 volume, 6 no-disturb (bit1), 7 sleep |  | `h6057/origin/ble/notify/DeviceInfoNotifyParse.java` |
| 5 | remote_control | BLE notify via ptReal | `0xEE/0xA4` |  | [0] pairing/remote byte |  | `straightfloorlamp/ble/RemoteControlParse.java` |
| 6 | movie_feast | BLE notify via ptReal | `0xEE/0x60` |  | movie feast on/off |  | `base2light/ble/controller/MovieFeastOnOffNotifyParse.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0/1"} | {"val":"0/1"} | status | `hollowlamp/iot/CmdTurn.java; h6057/origin/iot/CmdTurn.java; straightfloorlamp/iot/CmdTurn.java; tablelampv1/iot/CmdTurn.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"1..100"} | {"val":"1..100"} | status | `*/iot/CmdBrightness.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"colorTemInKelvin":"kelvin","red":"0..255","green":"0..255","blue":"0..255"} | {"colorTemInKelvin":"kelvin","red":"0..255","green":"0..255","blue":"0..255"} | status | `*/iot/CmdColorWc.java` |
| 4 | status | IoT JSON | `status` | {} | {} | state+op | `hollowlamp/iot/CmdStatus.java; h6057/origin/iot/CmdStatus.java; base2light AbsIotManagerV1` |
| 5 | online | IoT JSON | `online` | {} | {} | status | `base2light AbsIotManagerV1` |

## split_pact_humidifier

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `h7141/iot/CmdPtReal.java` |
| `op` | read envelope | {"command":["<base64 20-byte frame>"]} | `h7141/iot/{Cmd,ResultPt}.java; h7140/iot/CmdStatusParseV1.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal | `0x33/0x01` | 01\|00 | [0] on/off | 0xAA/0x01 -> [0] state | `base2light SwitchController` |
| 2 | mode | BLE frame via ptReal | `0x3A/0x05 (H7140-class) or 0x33/0x05 (H7141/H7142)` | GEAR: 01 g; CUSTOM: 02 idx 3x5 bytes; AUTO: 03 hum[\|0x80] comfortable | see dynamic_effects/mode sections | 0xAA/0x05 -> [mode, params] | `h7140/ble/controller/H7140ModeController.java; h7141/ble/controller/Mode*Controller.java` |
| 3 | gear position | BLE frame via ptReal | `0x33/0x1C` | 02 gear (high) \| 01 gear (low) | [0] high/low selector, [1] gear index | 0xAA/0x1C -> [02,highGear] or [01,lowGear] | `h7140/ble/controller/GearPositionController.java` |
| 4 | clean reminder | BLE frame via ptReal | `0x33/0x27 (H7140 class) or 0x33/0x08 (H7141)` | open,setCleanHour | [0] open (1/2), [1] set hours | [open,setHour,remainHour] | `base_h71xx CleanReminderController; h7141/Clear72HController.java` |
| 5 | delay off | BLE frame via ptReal | `0x33/0x11` | open minLo minHi | [0] open, [1..2] minutes LE16 | [open,minLo,minHi,leaveLo,leaveMid,leaveHi] | `base_h71xx DelayOffController; DelayOffInfo` |
| 6 | do not disturb | BLE frame via ptReal | `0x33/0x16` | enable startH startM endH endM | forever = 01 01 01 01 01 | same | `base_h71xx NotDisturbController; NotDisturbInfo` |
| 7 | time sync | BLE frame via ptReal | `0x33/0x1B` | ts[4] 01 tzHour tzMin | 4-byte little-endian epoch seconds | ack | `base_h71xx SyncTimeController` |
| 8 | device status (H7151/H7152/H7153) | BLE frame via ptReal | `0xAA/0x19` |  | read only | [0..1] autoStopSec LE, [2] dry, [3..4] dryCountdownSec LE, [5] compressor, [6] fan, [7] pipe, [8] draining | `h7151/ble/controller/DeviceStatusController.java; h7151/DeviceState.java` |
| 9 | child lock (H7150/H7151/H7152/H7153) | BLE frame via ptReal | `0x33/0x1F` | 02 00\|01 | [0] subcmd 0x02, [1] state | [02,state] | `h7150/ble/controller/LockControllerV1.java` |
| 10 | power-on state (H7151) | BLE frame via ptReal | `0x33/0x1F` | 09 00\|01 | [0] subcmd 0x09 | [09,state] | `h7151/ble/controller/PowerOnController.java` |
| 11 | off-dry switch (H7151) | BLE frame via ptReal | `0x33/0x1F` | 0A 00\|01 | [0] subcmd 0x0A | [0A,state] | `h7151/ble/controller/OffDrySwitchController.java` |
| 12 | off water-pump switch (H7151) | BLE frame via ptReal | `0x33/0x1F` | 0B 00\|01 | [0] subcmd 0x0B | [0B,state] | `h7151/ble/controller/OffWaterPumpSwitchController.java` |
| 13 | start drainage (H7151) | BLE frame via ptReal | `0x33/0xAA` | 00 00 01 | drainage trigger | ack | `h7151/ble/controller/OffDrainageController.java` |
| 14 | start dry (H7151) | BLE frame via ptReal | `0x33/0xAA` | 00 01 | dry trigger | ack | `h7151/ble/controller/OffDryController.java` |
| 15 | read switch (H7145) | BLE frame via ptReal | `0xAA/0x1A` |  | read only | [0] on/off | `h7145/ble/controller/ReadSwitchController.java` |
| 16 | water tank level (H7145) | BLE frame via ptReal | `0xAA/0x22` |  | read only | [0] percent, [1..2] endurance minutes LE16 | `h7145/ble/controller/WaterVieldController.java; h7145/adjust/bean/WaterBean.java` |
| 17 | temperature/humidity calibration (H7145) | BLE frame via ptReal | `0x33/0x1C` | V1 01 deviceFlag tempFlag calLE16; V2 deviceFlag tempFlag calLE16; V3 tempFlag deviceFlag calLE16 | signed int16, 0.01C / 0.01%RH | deviceFlag + tempFlag + calLE16 | `h7145/ble/DevCommReportParse.java; base_h71xx TempHumCaliCtler` |
| 18 | timer add/update | BLE frame via ptReal | `0x33/0x01` | group enableSwitch hour min repeat mode modeValue [targetHum autoGear] | see TimerInfoV2 | 0xAA/0x01 -> timer record | `base_h71xx TimerGroupControllerV2; h7151/H7152TimerGroupController.java` |
| 19 | timer delete | BLE frame via ptReal | `0x33/0x1E` |  | read/delete | [group] | `base_h71xx TimerCountController` |
| 20 | abnormal info | BLE frame via ptReal | `0x33/0xAA` | 01 | [0] request | [fault,code,flag2,...,flag3] | `h7140/h7143/h7145/h7150/h7151/h7160/h7161 AbnormalInfoController` |
| 21 | atmosphere list (H7161/H7162) | BLE frame via ptReal | `0xAA/0x05` | 03 | read preset list | one-byte atmosphere codes after first byte | `h7161/ble/controller/AtmosphereListController.java` |
| 22 | atmosphere edit (H7161/H7162) | BLE frame via ptReal | `0xA3/0x05` | count, per-edit index,length,onOffFog,onOffVoice,voiceCode,voiceVolume,atmosphereCode,onOffLight,brightness,subMode,[color/scene/diy] | see AtmosphereEdit.getWriteBytes | ack | `h7161/ble/controller/AtmosphereEditMultipleControl.java; base_h71xx AtmosphereEdit` |
| 23 | uncovering remind (H7161) | BLE frame via ptReal | `0x33/0x1F` | 01 00\|01 | [0]=1, [1]=state | ack | `h7161/ble/controller/UncoveringRemindController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | device report | BLE notify via ptReal | `0xEE/<cmdType>` |  | [1]=cmdType, [2..] payload; 0x05=mode, 0xAA=abnormal, 0xB0=light, 0x1C=gear, 0x22=water, 0x19=status |  | `h71*/ble/DevCommReportParse.java; h71*/ble/BleNotifyComm.java` |
| 2 | IoT/WiFi status | BLE notify via ptReal | `0xEE` |  | handled by WifiNotifyParse |  | `h71*/ble/WifiNotifyParse.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | online | IoT JSON | `online` | {} | {} | subscription | `h7140/v1/IotPactV1.java` |
| 2 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `h7141/iot/CmdTurn.java` |
| 3 | status | IoT JSON | `status` | {} | {} | {onOff,result} + op frames | `h7141/iot/CmdStatus.java; CmdStatusParseV1$State` |

## split_pact_iceMachine

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `IceApplicationImp CmdBuilder; GMessageSingleReadWrite` |
| `op` | read envelope | {"command":["<base64 20-byte frame>"]} | `H81*Model.k0` |
| `multiSync` | transport wrapper | {"command":["<base64>"]} | `IceApplicationImp (CmdMultiSync)` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power / run control | BLE frame via ptReal\|multiSync | `0x3A/0x01` | 00 00 cancel \| 01 00 start ice \| 01 01 start clean \| 01 02 start melt \| 01 03 start demold/drain \| 00 cancel | [0]=action, [1]=subaction | ack (frame[2]==0) | `h8121/h8122/h8131/h8150 vm` |
| 2 | mode | BLE frame via ptReal\|multiSync | `0x3A/0x05` | H8121 01 mode \| H8122 mode \| H8131 mode degree | 1=Small/Thin, 2=Medium, 3=Max/Large/Thick; H8131 degree 0/1/2 | ack | `H8121Mode/H8122Mode/H8131Mode/H8131Degree` |
| 3 | timer write | BLE frame via ptReal\|multiSync | `0x3A/0x13` | group enableSwitch hour min repeat mode iceSize lightSwitch preCoolSwitch sceneLE16 | [0] group, [1] enable/switch, [2] hour, [3] min, [4] repeat, [5] mode, [6] iceSize, [7] light, [8] preCool, [9..10] scene LE16 | ack | `h8120/8121/8131 TimerInfo beans` |
| 4 | do not disturb | BLE frame via ptReal\|multiSync | `0x3A/0x16` | DoNotDisturbInfo bytes | [enable, startH, startM, endH, endM] (repeat/forever encoded in enable) | ack | `h8150/bean/DoNotDisturbInfo.java` |
| 5 | light switch | BLE frame via ptReal\|multiSync | `0x3A/0x1B` | 01 01 00\|01 | [0..1] light sub-command, [2] state | ack | `H8150/H8131/H8121 SharedViewModel` |
| 6 | brightness | BLE frame via ptReal\|multiSync | `0x3A/0x1B` | 01 02 gear | [0..1] sub-command, [2] gear | ack | `same` |
| 7 | light color | BLE frame via ptReal\|multiSync | `0x3A/0x1B` | 05 0D R G B | [0..1]=05 0D, [2..4]=RGB | ack | `same` |
| 8 | light scene | BLE frame via ptReal\|multiSync | `0x3A/0x1B` | 05 13 sceneCode | [0..1]=05 13, [2]=scene code | ack | `same` |
| 9 | settings | BLE frame via ptReal\|multiSync | `0x3A/0x1F` | 02 v \| 08 v \| 16 v \| 17 v \| 01 keepIceLong | [0] setting id, [1] value | ack | `H8121/H8122/H8150 SharedViewModel` |
| 10 | remind masks | BLE frame via ptReal\|multiSync | `0x3A/0x25` | N bitmask bytes | LE packed booleans; per-family order listed in md 3.1 | 0xAA/0x25 or op 0x25 | `H8150/H8131/H8120/H8121/H8122 Remind beans` |
| 11 | wash/clean reminder | BLE frame via ptReal\|multiSync | `0x3A/0x27` | 00 off \| 02 reset \| on hour | [0] mode, [1] hours | ack | `H8121/H8122 SharedViewModel` |
| 12 | buzzer mask | BLE frame via ptReal\|multiSync | `0x3A/0x28` | bitmask byte(s) [, gear] | per-family boolean list | ack | `H81*BuzzerSwitchBean` |
| 13 | buzzer gear | BLE frame via ptReal\|multiSync | `0x3A/0x29` | gear | [0] gear | 0xAA/0x29 or op 0x29 | `H8131/H8150 SharedViewModel` |
| 14 | chart switch | BLE frame via ptReal\|multiSync | `0x3A/0xC1` | 30 01 \| 01 b | [0] sub-command, [1] state | ack | `H81*ChartViewModel` |
| 15 | light group (H8150/H8131) | BLE frame via ptReal\|multiSync | `0x3A/0xB6` | FD close \| FB flags \| F4/FC runState [mode] [sceneLE16] \| F6 0A 0000 \| F6 04 sceneLE16 \| 15 FE/FC runState RGB | sub-command byte first | ack | `H8150/H8131 SharedViewModel` |
| 16 | reservation (H8150) | BLE frame via ptReal\|multiSync | `0x3A/0x23` | 01 hour min dayOrdinal \| 00 | [0] enable, [1] hour, [2] min, [3] day ordinal | ack | `H8150CommandTypeCons.c; H8150SharedViewModel` |
| 17 | read abnormal | BLE frame via ptReal\|multiSync | `0xAA/0x17` |  | read only | [2] state code/bitmask, [3] flags | `H81*Model.k0` |
| 18 | read run state | BLE frame via ptReal\|multiSync | `0xAA/0x19` |  | read only | [2] run state, [3] sub-state, [4..] countdowns | `H81*Model.k0` |
| 19 | read DND | BLE frame via ptReal\|multiSync | `0xAA/0x16` |  | read only | [2] enable, [3] active | `H81*Model.k0` |
| 20 | read reminder | BLE frame via ptReal\|multiSync | `0xAA/0x25` |  | read only | bitmask bytes | `H81*Model.k0` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | op frame batch | BLE notify via ptReal\|multiSync | `cloud op or GATT notify` |  | each 20-byte frame: [1]=0x17 abnormal, 0x19 state, 0x16 DND, 0x25 remind, 0x1B light, 0x29 buzzer gear |  | `H8120/H8121/H8122/H8131/H8150 Model.k0` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | online | IoT JSON | `online` | {} | {} | subscription | `H81*Model.V()` |
| 2 | status | IoT JSON | `status` | {} | {} | {"status":...} | `IceApplicationImp CmdBuilder parseMsg` |
| 3 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `base CmdTurn` |

## split_pact_leaknew

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `op` | read envelope | {"command":["<base64 20-byte frame>"]} | `pact/Model; SubDevice4OpResultParse` |
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `base2light CmdPtReal` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | find device | BLE frame via ptReal | `0x33/0x08` | sno 06 00 | [0]=sno, [1]=0x06, [2]=0 | ack | `controller/Controller4FindDevice.java` |
| 2 | gateway warning switch | BLE frame via ptReal | `0x33/0x08` | sno 0A 01 00\|01 | [1]=0x0A, [2]=1, [3]=state | ack | `controller/Controller4GwWarnSwitch.java` |
| 3 | low-battery switch | BLE frame via ptReal | `0x33/0x08` | sno 09 01 00\|01 | [1]=0x09, [2]=1, [3]=state | ack | `controller/Controller4LowBatSwitch.java` |
| 4 | set volume | BLE frame via ptReal | `0x33/0x08` | sno (0D\|04) 02 level 01 | [1]=0x0D for H5058 else 0x04, [2]=2, [3]=level, [4]=1 | ack | `controller/Controller4SetVolume.java` |
| 5 | check signal | BLE frame via ptReal | `0x33/0x08` | sno 07 00 | [1]=0x07 | ack | `controller/Controller4CheckSignal.java` |
| 6 | sync check-net result | BLE frame via ptReal | `0x33/0x08` | sno 0F 01 00\|01 | [1]=0x0F, [2]=1, [3]=result | ack | `controller/Controller4SyncCheckNetResult.java` |
| 7 | mode switch | BLE frame via ptReal | `0x33/0x08` | sno 0B 01 mode | [1]=0x0B, [2]=1, [3]=10 water-level / 11 leak | ack | `controller/ControllerModeSwitch.java` |
| 8 | delete sub-device | BLE frame via ptReal | `0x33/0x11` | sno | [0]=sno | ack | `controller/Controller4DeleteSubDevice.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | sub-device report (H5058 short) | BLE notify via ptReal | `gateway notify -> cmd 0x08` |  | [0..7]=name, [8]=sno, [9]=type(12/13/4), [10]=bit0 leak + bits1-7 battery/status, [11]=unused, [12]=signal; [3..5] raw leak bytes, [6..9] LE32 timestamp |  | `base2newth ParseUtils4H5058.e` |
| 2 | sub-device report (long) | BLE notify via ptReal | `gateway notify -> cmd 0x08` |  | [0]=sno, [1]=type, [2]=bitfield(bit0 leak), [3..5]=state, [6..9]=timestamp, [10]/[11]=versions, [12]=signal, [13..16]=time LE32 |  | `ParseUtils4H5058.c` |
| 3 | legacy leak report | BLE notify via ptReal | `gateway notify -> cmd 0x08` |  | [0]=sno, [1]=type, [2]=leakState, [3]=bitfield, [4]=softVer, [5]=hardVer, [6]=battery, [7..10]=time LE32, [11]=mute, [12]=signal, [13]=?, [14]=?, [15]=switch bits |  | `ParseUtils4H5044SubLeak.a` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | status | IoT JSON | `status` | {} | {} | gateway/leak snapshot | `pact/Model` |
| 2 | warn | IoT JSON | `warn` | {"recordData":"list"} | {"recordData":"list"} | warning history | `net/RespWarnMessage` |

## split_pact_outdoorlight

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `h7086/iot/CmdPtReal.java; h7056/pact/bleiot/OpDiyCommDialog4BleIot.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal | `0x33/0x01` | 00\|01 | [0] on/off | 0xAA/0x01 -> [0] | `base2light SwitchController used by all four pact Comm classes` |
| 2 | brightness | BLE frame via ptReal | `0x33/0x04` | <level> | [0] level (H7040 1..254; H7056/H7080 raw; H7086 remap only if Support.c()[2]==1) | 0xAA/0x04 -> [0] | `h7040/pact/Comm.java; h7056/pact/Comm.java; h7080/pact/Comm.java; h7086/pact/Comm.java` |
| 3 | mode | BLE frame via ptReal | `0x33/0x05` | <submode> | [0] sub-mode id | 0xAA/0x05 -> [0] submode | `base AbsModeController + family ModeController` |
| 4 | color | BLE frame via ptReal | `0x33/0x05, submode 0x15 (H7056/H7080/H7086) or 0x0D (H7040)` | 0D/15 R G B kelLo kelHi R2 G2 B2 [mask] | H7040 9B; H7056/H7080/H7086 mode 1/2/3 as documented | read-back | `h7040/ble/SubModeColor.java; h7056/ble/SubModeColor.java; h7080/ble/SubModeColor.java; h7086/ble/SubModeColor.java` |
| 5 | music | BLE frame via ptReal | `0x33/0x05, submode 0x13` | 13 code sens | H7056/H7086 code+sensitivity; H7040/H7080 use submode 0x05 mic {05 01} | read-back | `h7056/ble/SubModeMusic.java; h7086/ble/SubModeMusic.java; h7040/ble/SubModeMic.java; h7080/ble/SubModeMic.java` |
| 6 | scene | BLE frame via ptReal | `0x33/0x05, submode 0x04` | 04 effLo effHi [music] [level] | H7040/H7080 3B; H7056 8B with 32-bit music code + level; H7086 5B with 16-bit music code | read-back | `family SubModeScenes.java` |
| 7 | DIY | BLE frame via ptReal | `0x33/0x05, submode 0x0A` | 0A diyLo diyHi [group] | H7040/H7080 3B; H7056/H7086 add 16-bit group/second diy code | read-back | `family SubModeNewDiy.java` |
| 8 | multi-frame DIY/scene body | BLE frame via ptReal | `0xA3 or 0xA4 / idx` | <chunk> | family MultipleBleBytes / MultipleControllerCommV1; last frame carries 0x05 mode | per chunk | `h7056/pact/Comm.java; h7080/pact/Comm.java; h7086/pact/Comm.java` |
| 9 | H7040 SOS | BLE frame via ptReal | `0x33/0x0B` | 00\|01 | [0] SOS on/off | [0] | `h7040/ble/SOS4BleController.java` |
| 10 | H7040 mic point | BLE frame via ptReal | `0x33/0x05` | 05 00 R G B | submode 5, type 0, rgb point | none | `h7040/ble/MicController.java` |
| 11 | H7080 location write | BLE frame via ptReal | `0x33/0xA7` | N idx val idx val ... | [0]=count N, then pairs (index,value); read p()=[N] | pairs index/value | `h7080/ble/LocationController.java` |
| 12 | H7080 check location | BLE frame via ptReal | `0x33/0xA6` | count index | [0]=count, [1]=index | write ack only (parseValidBytes returns false) | `h7080/ble/CheckLocationController.java` |
| 13 | H7080 gradual | BLE frame via ptReal | `0xA3/0xA3` | 00\|01 | [0] gradual on/off | [0] | `h7080/ble/Gradual4BleController.java` |
| 14 | H7080 read bulb-string colour | BLE frame via ptReal | `0xAA/0xA5` | [index] | p()=[index]; response [0]=index then 3x(index,R,G,B) | BulbGroupColor | `h7080/ble/BulbStringColorController.java; h7080/ble/BulbGroupColor.java` |
| 15 | H7086 cap calibration mode | BLE frame via ptReal | `0x33/0x30` | 00\|01 | [0] enable/disable | notify 0x32 | `h7086/adjust/controller/CapCalibrationStatusController.java` |
| 16 | H7086 cap calibration order | BLE frame via ptReal | `0x33/0x31` | serial bytes | one byte per cap serial | notify 0x32 | `h7086/adjust/controller/CapCalibrationController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi connected | BLE notify via ptReal | `0x11` |  | [0]==0 |  | `h7056/ble/WifiNotifyParse.java; h7086/ble/WifiNotifyParse.java` |
| 2 | brightness | BLE notify via ptReal | `0x20` |  | [0] level |  | `h7056/ble/BrightnessNotifyParse.java; h7086/ble/BrightnessNotifyParse.java` |
| 3 | switch status | BLE notify via ptReal | `0x30` |  | [0]==1, [1] on/off, [2] secondary |  | `h7056/ble/DeviceSwitchStatusNotifyParse.java; h7086/ble/DeviceSwitchStatusNotifyParse.java` |
| 4 | cap calibration status | BLE notify via ptReal | `0x32` |  | any payload -> callback |  | `h7086/adjust/controller/CapCalibrationStatusParse.java` |
| 5 | H7040 heart/battery | BLE notify via ptReal | `0xAA/0x01` |  | [0] power, [1] work-mode flags, [2] battery byte (bit7 charging, bits6..4 bars 1..5, bit0/bit3 flags) |  | `h7040/ble/HeartController.java; h7040/detail/BatteryInfo.java` |
| 6 | H7040 WiFi | BLE notify via ptReal | `0x11` |  | [0]==0 |  | `h7040/ble (no WifiNotifyParse; shared base notify)` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | state/status | `h7056/iot/CmdTurn.java; h7086/pact/Comm.java (base CmdTurn)` |
| 2 | brightness | IoT JSON | `brightness` | {"brightness":"int"} | {"brightness":"int"} | state.brightness | `h7056/iot/CmdBrightness.java; h7086/pact/Comm.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"red":"0-255","green":"0-255","blue":"0-255"},"colorTemInKelvin":"int"} | {"color":{"red":"0-255","green":"0-255","blue":"0-255"},"colorTemInKelvin":"int"} | state | `base2light/iot/CmdColorWc via family Comm` |

## split_pact_plugnew

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `state` | read envelope | {"onOff":"int bitmask"} | `h5080/iot/Cmd.java; CmdStatusV0.State` |
| `op` | read envelope | {"command":["<base64 20-byte frame>"]} | `h5080/iot/Cmd.java; ResultPt` |
| `ptReal` | transport wrapper | {"command":["<base64>"]} | `h5080/iot/CmdPtReal.java` |
| `ptIot` | transport wrapper | {"command":["<base64>"]} | `h5080/iot/Cmd.java (H5089 OTA)` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | switch socket 0 | BLE frame via ptReal\|ptIot | `0x33/0x01` | 10\|01 | [0] = 0x10 \| (on?1:0) | 0xAA/0x01 -> [0] bit mask | `h5080/ble/controller/SwitchControllerV2.java` |
| 2 | switch socket 1 | BLE frame via ptReal\|ptIot | `0x33/0x01` | 20\|02 | [0] = 0x20 \| (on?2:0) | same | `SwitchControllerV2.java` |
| 3 | switch socket 2 | BLE frame via ptReal\|ptIot | `0x33/0x01` | 40\|04 | [0] = 0x40 \| (on?4:0) | same | `SwitchControllerV2.java` |
| 4 | switch all | BLE frame via ptReal\|ptIot | `0x33/0x01` | F0\|0F | [0] = 0xF0 \| (on?0x0F:0) | same | `SwitchControllerV2.java` |
| 5 | heartbeat | BLE frame via ptReal\|ptIot | `0xAA/0x00` |  | no payload | 0xAA/0x00 -> 8 socket bits | `HeartControllerV2.java` |
| 6 | total switch (H5089) | BLE frame via ptReal\|ptIot | `0x33/0x02` | on?01:00 | [0] state | none parsed | `h5080/ble/controller/h5089/Controller4TotalSwitch.java` |
| 7 | child lock (H5089/H5086) | BLE frame via ptReal\|ptIot | `0x33/0x1F` | 02 on | [0]=2, [1]=on | 0xAA/0x1F 02 -> [0]=2,[1]=state | `h5080/ble/controller/h5089/Controller4ChildLock.java; h5086/ble/controller/ChildLockController.java` |
| 8 | night light switch (H5089) | BLE frame via ptReal\|ptIot | `0x33/0x1B` | 01 01 on | [0]=1, [1]=1, [2]=state | 0xAA/0x1B -> [0]=1,[1]=state,[2]=brightness | `h5080/ble/controller/h5089/Controller4NlSwitch.java` |
| 9 | night light brightness (H5089) | BLE frame via ptReal\|ptIot | `0x33/0x1B` | 01 02 val | val 0-100 | same as switch | `Controller4NlSwitch.java` |
| 10 | night light mode (H5089) | BLE frame via ptReal\|ptIot | `0x33/0x1B` | 05 <submode> ... | see dynamic_effects | 0xEE/0x1B or 0xAA/0x1B -> LightModeInfo | `base_h71xx LightRgbController; Notify4NightLight` |
| 11 | night light sleep timer (H5089) | BLE frame via ptReal\|ptIot | `0x33/0x28` | en startBri closeMin curMin defaultLight R G B ctHi ctLo | [0]=en,[1]=startBri,[2]=closeMin,[3]=curMin,[4]=defaultLight,[5..7]=RGB,[8..9]=colorTemp BE16 | 0xAA/0x28 | `h5080/ble/controller/h5089/Controller4NlSleep.java` |
| 12 | night light wake timer (H5089) | BLE frame via ptReal\|ptIot | `0x33/0x29` | en endBri hour min repeat wakeMin defaultLight R G B ctHi ctLo | 12 bytes; [0]=en,[1]=endBri,[2]=hour,[3]=min,[4]=repeat,[5]=wakeMin,[6]=defaultLight,[7..9]=RGB,[10..11]=colorTemp | 0xAA/0x29 | `h5080/ble/controller/h5089/Controller4NlWakeUp.java` |
| 13 | new timer V1 | BLE frame via ptReal\|ptIot | `0x33/0xB4` | group en hour min repeat | [0]=group (+0x10 if page 1); [1]=enableAndType; [2]=hour; [3]=minute; [4]=repeat | 0xAA/0xB4 -> 4*(en,h,m,repeat) or group=FF -> 4 records | `h5080/ble/controller/NewTimerController.java` |
| 14 | new timer V2 | BLE frame via ptReal\|ptIot | `0x33/0x13` | index group en hour min repeat | 16-byte page, four 4-byte records | 0xAA/0x13 -> page | `NewTimerControllerV2.java` |
| 15 | timer count | BLE frame via ptReal\|ptIot | `0xAA/0x12` | group | [0]=group | [1]=count | `NewTimerCountController.java` |
| 16 | delete timer | BLE frame via ptReal\|ptIot | `0x33/0x15` | group index | [0]=group,[1]=index | ack | `TimerDeleteController.java` |
| 17 | on/off delay | BLE frame via ptReal\|ptIot | `0x33/0xB0` | index type hour minute | type 0=turn-on,1=turn-off; minutes split h/m | 0xAA/0xB0 -> [index,type,h,m,remainSec24] | `TurnOnOffDelayController.java` |
| 18 | sync time | BLE frame via ptReal\|ptIot | `0x33/0xB5` | ts32BE 00 00 00 00 01 tzH tzM | Unix seconds big-endian | ack | `h5080/ble/controller/SyncTimeController.java` |
| 19 | H5089 timer page read | BLE frame via ptReal\|ptIot | `0xAA/0x13` | (page<<4)\|group | 4 TimerInfo records per page | 0xAA/0x13 | `h5080/ble/controller/h5089/Controller4H5089TimerInfo.java` |
| 20 | H5086 switch | BLE frame via ptReal\|ptIot | `0x33/0x01` | on | [0]=0/1 | 0xAA/0x01 | `h5086/ble/controller/SwitchController.java` |
| 21 | H5086 brightness | BLE frame via ptReal\|ptIot | `0x33/0x04` | val | 0-100 | 0xAA/0x20 notify -> [0] | `base BrightnessController; h5086 BrightnessNotifyParse` |
| 22 | H5086 delay on | BLE frame via ptReal\|ptIot | `0x33/0xB0` | 00 hour minute | type 0 | 0xAA/0xB0 00 -> [?,h,m,remainSec24] | `h5086/ble/controller/DelayOnOffController.java` |
| 23 | H5086 delay off | BLE frame via ptReal\|ptIot | `0x33/0xB0` | 01 hour minute | type 1 | 0xAA/0xB0 01 | `DelayOnOffController.java` |
| 24 | H5086 timer write | BLE frame via ptReal\|ptIot | `0x33/0xB4` | group en hour min repeat | 5 bytes | ack | `h5086/ble/controller/TimerWriteController.java` |
| 25 | H5086 timer delete | BLE frame via ptReal\|ptIot | `0x33/0x15` | group | [0]=group | ack | `h5086/ble/TimerDeleteController.java` |
| 26 | H5086 sync time | BLE frame via ptReal\|ptIot | `0x33/0xB5` | ts32BE 01 tzH tzM | Unix seconds big-endian | ack | `h5086/ble/controller/SyncTimeController.java` |
| 27 | H5086 read device info | BLE frame via ptReal\|ptIot | `0xAA/0x07` | 10 | [0]=0x10 | addr8, soft3, hard3, byte | `h5086/ble/controller/DeviceBasicInfoController.java` |
| 28 | H5086 read wifi info | BLE frame via ptReal\|ptIot | `0xAA/0x07` | 11 | [0]=0x11 | mac6, wifiSoft3, wifiHard3 | `h5086/ble/controller/WifiInfoController.java` |
| 29 | H5086 electric data | BLE frame via ptReal\|ptIot | `0xAA/0x19` |  | runtime BE24/60, kWh BE24/10000, V BE16/100, A BE16/100, W BE24/100 | 0xAA/0x19 | `h5086/ble/controller/DeviceElectricController.java` |
| 30 | H5086 time monitor | BLE frame via ptReal\|ptIot | `0xAA/0x1A` |  | id BE32,state,h,m,remain BE24,electUse BE24 | 0xAA/0x1A | `h5086/ble/controller/TimeMonitorController.java` |
| 31 | H5086 power warning read | BLE frame via ptReal\|ptIot | `0xAA/0x27` |  | warningIsSet,open,val BE16,offIsSet,open,val BE16 | 0xAA/0x27 | `h5086/ble/controller/PowerWarningController.java` |
| 32 | H5086 power warning write | BLE frame via ptReal\|ptIot | `0x33/0x28` | 02\|01 en valHi valLo | sub 2=warning, 1=auto-off; value BE16 | 0xAA/0x28 | `h5086/ble/controller/PowerWarningControllerV2.java` |
| 33 | H5086 DND light | BLE frame via ptReal\|ptIot | `0x33/0x16` | en startH startM endH endM forever | forever=1/0 | 0xAA/0x16 | `h5086/ble/controller/LightController.java` |
| 34 | H5086 exception state | BLE frame via ptReal\|ptIot | `0xAA/0x17` | 01 | [0]=1 | [0]=exception | `h5086/ble/controller/ExceptionStateController.java` |
| 35 | H5086 chart prepare | BLE frame via ptReal\|ptIot | `0x33/0x02` |  | empty | ack | `h5086/ble/chartcontroller/ChartPrepareInfoController.java` |
| 36 | H5086 chart range | BLE frame via ptReal\|ptIot | `0x33/0x01` | start32BE end32BE | Unix seconds | ack | `h5086/ble/chartcontroller/ChartTimeRangeController.java` |
| 37 | H5086 read all | BLE frame via ptReal\|ptIot | `0xAA/0xAA` |  | empty | device full read | `h5086/ble/ReadAllNotifyParse.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi state | BLE notify via ptReal\|ptIot | `0xEE/0x11` |  | [0]==0 -> connected |  | `h5080/ble/WifiNotifyParse.java; h5086/ble/WifiNotifyParse.java` |
| 2 | switch/heart | BLE notify via ptReal\|ptIot | `0xEE/0x01 or 0xAA/0x01` |  | 8-bit socket mask |  | `HeartControllerV2; SwitchControllerV2` |
| 3 | brightness (H5086) | BLE notify via ptReal\|ptIot | `0xEE/0x20` |  | [0]=0-100 |  | `h5086/ble/BrightnessNotifyParse.java` |
| 4 | device electric (H5086) | BLE notify via ptReal\|ptIot | `0xEE/0x19` |  | runtime BE24/60, kWh BE24/10000, V BE16/100, A BE16/100, W BE24/100 |  | `h5086/ble/DeviceStateNotifyParse.java` |
| 5 | time monitor (H5086) | BLE notify via ptReal\|ptIot | `0xEE/0x1A` |  | id BE32,state,h,m,remain BE24,electUse BE24 |  | `h5086/ble/TimeMonitorNotifyParse.java` |
| 6 | read-all done (H5086) | BLE notify via ptReal\|ptIot | `0xEE/0xAA` |  | event only |  | `h5086/ble/ReadAllNotifyParse.java` |
| 7 | night light (H5089) | BLE notify via ptReal\|ptIot | `0xEE/0x1B` |  | [0]=1 -> [1]=on,[2]=brightness; [0]=5 -> LightModeInfo from [1..] |  | `h5080/ble/controller/h5089/Notify4NightLight.java` |
| 8 | chart state (H5086) | BLE notify via ptReal\|ptIot | `0xEE/0x01 on service ...4857` |  | [0]=1 done (total packets BE16 at [1..2]); [0]=2 querying |  | `h5086/ble/ChartStateNotifyParser.java` |
| 9 | chart data (H5086) | BLE notify via ptReal\|ptIot | `0xAC/0x03 on char ...2015` |  | startHour BE16, then 5*(runMin, kWh BE16/10000) |  | `h5086/ble/AbsBleWithChartDataComm.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"bit0 socket0, bit1 socket1, bit2 socket2/all (0x10\|on etc.)"} | {"val":"bit0 socket0, bit1 socket1, bit2 socket2/all (0x10\|on etc.)"} | status/ptReal | `h5080/iot/CmdTurn.java` |
| 2 | status | IoT JSON | `status` | {} | {} | state+op snapshot | `h5080/iot/CmdStatus.java` |
| 3 | online | IoT JSON | `online` | {} | {} | presence | `h5080/iot/Cmd.java` |
| 4 | brightness | IoT JSON | `brightness` | {"val":"0-100"} | {"val":"0-100"} | state | `h5080/iot/Cmd.java` |
| 5 | colorwc | IoT JSON | `colorwc` | {"red":"0-255","green":"0-255","blue":"0-255"} | {"red":"0-255","green":"0-255","blue":"0-255"} | state | `h5080/iot/Cmd.java` |
| 6 | status (H5086) | IoT JSON | `status (H5086)` | {} | {} | read info + op frames (electric/time monitor/power warning) | `h5086/iot/CmdStatus.java` |

## split_pact_plugv1

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `plugv1/iot/CmdTurn.java; h7014/iot/CmdTurn.java` |
| 2 | status | IoT JSON | `status` | {} | {} | state+config (V0/V1) or turn/delayClose/timer (H7014) | `plugv1/iot/CmdStatusV0.java; CmdStatusV1.java; h7014/iot/CmdStatusV0.java` |
| 3 | timer | IoT JSON | `timer` | {"group":"int","enable":"0\|1","type":"int","hour":"0-23","minute":"0-59","repeat":"byte","timeOffset":"int hours","timeOffsetMinute":"int","timeStamp":"epoch seconds"} | {"group":"int","enable":"0\|1","type":"int","hour":"0-23","minute":"0-59","repeat":"byte","timeOffset":"int hours","timeOffsetMinute":"int","timeStamp":"epoch seconds"} | status | `plugv1/iot/CmdTimer.java` |
| 4 | delay | IoT JSON | `delay` | {"enable":"0\|1","minutes":"int","leftMinutes":"int"} | {"enable":"0\|1","minutes":"int","leftMinutes":"int"} | config.delay | `plugv1/iot/CmdDelayClose.java` |
| 5 | delayClose | IoT JSON | `delayClose` | {"enable":"0\|1","minutes":"int","leftMinutes":"int"} | {"enable":"0\|1","minutes":"int","leftMinutes":"int"} | delayClose | `h7014/iot/CmdDelayClose.java` |
| 6 | nightMode | IoT JSON | `nightMode` | {"val":"0\|1"} | {"val":"0\|1"} | state.nightMode | `plugv1/iot/CmdNightMode.java` |
| 7 | timer (H7014) | IoT JSON | `timer (H7014)` | {"enable":"0\|1","time":[{"openHour":"0-23","openMin":"0-59","closeHour":"0-23","closeMin":"0-59"}],"timeOffset":"int","timeOffsetMinute":"int"} | {"enable":"0\|1","time":[{"openHour":"0-23","openMin":"0-59","closeHour":"0-23","closeMin":"0-59"}],"timeOffset":"int","timeOffsetMinute":"int"} | status | `h7014/iot/CmdTimer.java` |
| 8 | online | IoT JSON | `online` | {} | {} | presence | `plugv1/iot/Cmd.java` |

## split_pact_rgbiclight

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `pt` | transport wrapper | {"op":"mode\|gradual\|sleep\|wakeup\|timer","value":["base64 20-byte frame"]} | `rgbiclight/h6160/iot/CmdPt.java, dreamcolorlightv1/iot/CmdPt.java` |
| `ptReal` | transport wrapper | {"command":["base64 20-byte frame"]} | `rgbiclight/h6160/iot/CmdPtReal.java, dreamcolorlightv1/iot/CmdPtReal.java` |
| `state` | read-key | {"brightness":"int","mode":"int","onOff":"0\|1","wifiHardVersion":"str","wifiSoftVersion":"str"} | `dreamcolorlightv1/iot/CmdStatusV0.java, CmdStatusV1.java` |
| `op` | read-key | {"pt\|ptReal payloads":"base64"} | `dreamcolorlightv1/iot/Cmd.java#getCmdReadParseKey` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|pt | `0x33/0x01` | 01 | [0] on/off (0/1) | 0xAA/0x01 -> [0] state | `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/SwitchController.java` |
| 2 | heartbeat | BLE frame via ptReal\|pt | `0xAA/0x01` | (none) | read-only heartbeat | 0xAA/0x01 -> [0] state | `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/HeartController.java` |
| 3 | brightness | BLE frame via ptReal\|pt | `0x33/0x04` | 01 | [0] raw brightness 0..254; percent -> NumUtil.calculateProgress(max,min,pct) | 0xAA/0x04 -> [0] brightness | `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/BrightnessController.java` |
| 4 | mode (color/scene/DIY/music container) | BLE frame via ptReal\|pt | `0x33/0x05` | subMode.getWriteBytes() | [0]=subMode id, [1..]=sub payload; see dynamic_effects | 0xAA/0x05 -> [0]=subMode, [1..]=sub payload | `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/AbsModeController.java` |
| 5 | color static/temp (generic) | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x02` | 02 R G B tempFlag R2 G2 B2 | 8 bytes; tempFlag=1 => R2G2B2 is temperature RGB; tempFlag=0 => R2G2B2 background | 0xAA/0x05 -> [1..3] RGB, [4] flag, [5..7] temp/background | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h6102/ble/SubModeColor.java` |
| 6 | color V1 15-segment | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x0B` | 0B R G B maskLo maskHi | 8 bytes; bit0..7 of maskLo = segments 1..8; bit0..6 of maskHi = segments 9..15 | 0xAA/0x05 -> [0] color type | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h612526/ble/SubModeColor.java` |
| 7 | color V2 per-group | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x15 type 1` | 15 01 R G B KLo KHi R2 G2 B2 00 mask | 12 bytes; KLoKHi signed LE Kelvin; mask = segment bitmask (6/7/8/15 bits) | 0xAA/0x05 -> [0]=type | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h6119/ble/SubModeColorV2.java` |
| 8 | color V2 brightness-only | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x15 type 2` | 15 02 brightness 00 mask | 5 bytes; per-segment brightness with segment mask | 0xAA/0x05 -> [0]=type | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h7090/ble/SubModeColor.java` |
| 9 | color V2 per-segment array | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x15 type 3` | 15 03 R1 G1 B1 ... R15 G15 B15 | 17 bytes total; up to 15 triples, rest 00 | 0xAA/0x05 -> [0]=type | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h6119/ble/SubModeColorV2.java` |
| 10 | color V1 legacy (4-byte RGB + 15 segments) | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x0B` | 0B R G B maskLo maskHi | 8 bytes; used by H6163/H6117 and H6125/H6126 | 0xAA/0x05 | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/rgbiclight/h6160/adjust/v1/SubModeColorV1.java` |
| 11 | color 4bk (color + Kelvin + bg) | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x0D` | 0D R G B KLo KHi R2 G2 B2 | 9 bytes; KLoKHi signed LE Kelvin; used for back-light/car version | 0xAA/0x05 | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/rgbiclight/h6160/ble/SubModeColor4Bk.java` |
| 12 | music (legacy fixed sub) | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x01/0x03` | sub autoFlag sensitivity [R G B] | 3 or 6 bytes; autoFlag 0/1 (0=auto); sensitivity 0..99; RGB present for manual color | 0xAA/0x05 -> sub style, sensitivity, optional RGB | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h6105/ble/SubModeMusic.java` |
| 13 | music V1 (h6119/h612526) | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x0C` | 0C style sensitivity [sub\|autoFlag [R G B]] | style 0 energy: 3 bytes; style 1 rhythm: 4 bytes (sub 0/1); style 2 scroll: 4/7 bytes; sensitivity 0..99 | 0xAA/0x05 | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h6119/ble/SubModeMusic.java` |
| 14 | music V1 rgb (h6160) | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x0E` | 0E style sensitivity autoFlag [R G B] | 4 or 7 bytes; autoFlag 1=auto, 0 adds RGB | 0xAA/0x05 | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/rgbiclight/h6160/ble/SubModeMusicV1Rgb.java` |
| 15 | new music (h7090/barelight/chassis) | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x13` | 13 style sensitivity [dyn autoFlag [R G B]] | 3-8 bytes; style 3 rhythm has dyn+auto; styles 4/5/6 add autoFlag+RGB | 0xAA/0x05 | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h7090/ble/SubModeMusic.java` |
| 16 | mic mode | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x05` | 05 01 | [1]=1 select mic/music mode; mic level pushed by audio engine | 0xAA/0x05 | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h6185/ble/SubModeMic.java` |
| 17 | mic V2 | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x13` | 13 10 | select new mic mode | 0xAA/0x05 | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/chassislightv1/ble/SubModeMicV2.java` |
| 18 | scene (1-byte id) | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x04` | 04 effectId | 1-byte effect id (H6102/H6105/H6119/H6125/H6126/H6127/H6129/H6185) | 0xAA/0x05 -> [1]=effect id | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h6129/ble/SubModeScenes.java` |
| 19 | scene (16-bit id) | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x04` | 04 effectLo effectHi | 16-bit LE effect id (H6163/H6117) | 0xAA/0x05 -> signed short from [2],[1] | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/rgbiclight/h6160/ble/SubModeScenes.java` |
| 20 | new DIY | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x0A` | 0A diyLo diyHi | 16-bit LE DIY code that was previously uploaded | 0xAA/0x05 -> diy code | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h6102/ble/SubModeNewDiy.java` |
| 21 | old DIY | BLE frame via ptReal\|pt | `0x33/0x05 sub 0x07` | 07 [16-byte DIY protocol] | [0]=diyCode [1..3]=params [4..]=RGB triples (max 4 colors); H6127/H6129 | 0xAA/0x05 -> [1]=diy code | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h6129/ble/SubModeOldDiy.java` |
| 22 | limit/current | BLE frame via ptReal\|pt | `0x33/0x0E` | 0E | [0]=limit flag (0/1); H6102/H6105 only | 0xAA/0x0E -> [0]==1 | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h6102/ble/LimitController.java` |
| 23 | gradual (single-packet) | BLE frame via ptReal\|pt | `0x33/0x14` | 14 00\|01 | [0] gradient on/off; H6119/H6125/H6126 | 0xAA/0x14 -> [0] | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h6119/ble/Gradual4BleController.java` |
| 24 | gradual (wifi-ble) | BLE frame via ptReal\|pt | `0x33/0xA3` | A3 00\|01 | [0] gradient on/off; H6163/H6117, H7090/H7095, barelight, chassis | 0xAA/0xA3 -> [0] | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h6160/ble/v1/Gradual4BleWifiController.java` |
| 25 | light position | BLE frame via ptReal\|pt | `0x33/0x31` | 31 00\|01 | [0] position 0/1; H7090/H7095 | 0xAA/0x31 -> [0] | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h7090/ble/LightPosController.java` |
| 26 | left/right switch | BLE frame via ptReal\|pt | `0x33/0x33` | 33 <state> | state 0=off, 1=left, 16=right, 17=both; H7090/H7095 car light | 0xAA/0x33 -> [0] state, [1]==1 festive flag | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h7090/ble/SwitchLRController.java` |
| 27 | multi DIY upload | BLE frame via ptReal\|pt | `0xA5/0x02` | diyCode params rgbLen [RGB triples] brightLen [brightness] | multi-packet; [0]=diyCode [1]=style [2] [3] [4]=rgbLen [5..]=RGB [..]=brightnessLen [..]=brightness | write ack | `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/MultipleDiyController.java` |
| 28 | DIY V1 upload | BLE frame via ptReal\|pt | `0xA5/0x04` | DIY protocol bytes | multi-packet variant used by newer DIY templates | write ack | `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/MultipleDiyControllerV1.java` |
| 29 | graffiti DIY upload | BLE frame via ptReal\|pt | `0xA5/0x03` | graffiti blob | multi-packet; V3 variant uses cmd 0x57 | write ack | `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/MultiDiyGraffitiController.java` |
| 30 | multi music upload | BLE frame via ptReal\|pt | `0xA3/0x41` | music effect blob | multi-packet; [4]=sensitivity (controller.p()), blob from AbsNewMusicEffect | write ack | `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/MultipleController4Music.java` |
| 31 | multi color strip | BLE frame via ptReal\|pt | `0xA5/0x40` | per-segment color blob | multi-packet; one blob per segment group | write ack | `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/MultipleColorStripControllerV1.java` |
| 32 | scene multi-packet | BLE frame via ptReal\|pt | `0xA3/0x01..0x0A` | base64 scene effect blob | cmdType = scene protocol version (V1=0x01, V2=0x02, V5=0x0A...); blob from ScenesRgbIC/ScenesGraffiti/ScenesCube/ScenesCompose keyed by effect id; followed by 0x05/0x04 select | write ack | `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/ScenesOp.java` |
| 33 | sleep | BLE frame via ptReal\|pt | `0x33/0x11` | 11 [4 bytes] | sleep hour/min/brightness/color index | 0xAA/0x11 -> [0..3] | `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/SleepController.java` |
| 34 | wakeup | BLE frame via ptReal\|pt | `0x33/0x12` | 12 [4 bytes] | wake hour/min/brightness/color index | 0xAA/0x12 -> [0..3] | `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/WakeUpController.java` |
| 35 | check direction | BLE frame via ptReal\|pt | `0x33/0x39` | 39 | direction setup finish query | 0xAA/0x39 -> [0] | `decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/CheckDirectionFinishController.java` |
| 36 | OTA prepare | BLE frame via ptReal\|pt | `0xEE` | family specific | notify class / OTA prepare | 0xEE notify | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/barelightv1/ble/BleProtocol.java` |
| 37 | bulb string read | BLE frame via ptReal\|pt | `0xAA/0xA5` | A5 <index> | read-only: [0]=count, then count x (R,G,B); H6119 | 0xAA/0xA5 -> groups | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/h6119/ble/BulbStringColorController.java` |
| 38 | bulb string read v1 | BLE frame via ptReal\|pt | `0xAA/0xA2` | A2 <index> | read-only: [0]=count, then count x (R,G,B) for 4 bulbs; H6163/H6117 | 0xAA/0xA2 -> groups | `decompiled/jadx-splits/split_pact_rgbiclight/sources/com/govee/rgbiclight/h6160/ble/v1/BulbStringColorController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | heartbeat state | BLE notify via ptReal\|pt | `0xAA/0x01` |  | [0] state (0/1) |  | `base HeartController.parseValidBytes` |
| 2 | power state | BLE notify via ptReal\|pt | `0x33/0x01 reply` |  | [0] on/off |  | `base SwitchController.parseValidBytes` |
| 3 | brightness | BLE notify via ptReal\|pt | `0xAA/0x04` |  | [0] brightness 0..254 |  | `base BrightnessController.parseValidBytes` |
| 4 | mode sub-mode | BLE notify via ptReal\|pt | `0xAA/0x05` |  | [0]=subMode id, [1..]=sub payload; dispatched to SubMode*.parse |  | `base AbsModeController.parseValidBytes` |
| 5 | color (generic) | BLE notify via ptReal\|pt | `0xAA/0x05 sub 0x02` |  | [1..3]=RGB, [4]=tempFlag, [5..7]=temp/bg RGB |  | `h6102/ble/SubModeColor.java` |
| 6 | color V2 type | BLE notify via ptReal\|pt | `0xAA/0x05 sub 0x15` |  | [1]=type/segment count |  | `h6119/ble/SubModeColorV2.java` |
| 7 | limit flag | BLE notify via ptReal\|pt | `0xAA/0x0E` |  | [0]==1 means limited |  | `h6102/ble/LimitController.java` |
| 8 | bulb string groups | BLE notify via ptReal\|pt | `0xAA/0xA5 or 0xA2` |  | [0]=count, then count x (index? + R,G,B); H6119 uses 4-byte groups with index byte |  | `h6119/ble/BulbGroupColor.java, h6160/ble/v1/BulbGroupColor.java` |
| 9 | light position | BLE notify via ptReal\|pt | `0xAA/0x31` |  | [0] position 0/1 |  | `h7090/ble/LightPosController.java` |
| 10 | LR switch / compose | BLE notify via ptReal\|pt | `0xAA/0x33` |  | [0] LR state, [1]==1 festive/compose open |  | `h7090/ble/ComposeHeartController.java` |
| 11 | wifi-ble notify | BLE notify via ptReal\|pt | `0xEE / WifiNotifyParse` |  | IoT envelope over BLE notify characteristic for ble+iot SKUs |  | `rgbiclight/ble/BleNotifyComm.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | online | IoT JSON | `online` | {} | {} | device online event | `rgbiclight/h6160/iot/Cmd.java, dreamcolorlightv1/iot/Cmd.java` |
| 2 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status.turn | `rgbiclight/h6160/iot/CmdTurn.java, base2light/iot/CmdTurn.java` |
| 3 | brightness | IoT JSON | `brightness` | {"val":"0-100"} | {"val":"0-100"} | status.brightness | `rgbiclight/h6160/iot/CmdBrightness.java` |
| 4 | color | IoT JSON | `color` | {"red":"0-255","green":"0-255","blue":"0-255"} | {"red":"0-255","green":"0-255","blue":"0-255"} | status.color | `rgbiclight/h6160/iot/CmdColor.java` |
| 5 | colorTem | IoT JSON | `colorTem` | {"colorTemInKelvin":"int","color":{"red":"int","green":"int","blue":"int"}} | {"colorTemInKelvin":"int","color":{"red":"int","green":"int","blue":"int"}} | status.colorTemInKelvin | `rgbiclight/h6160/iot/CmdColorTem.java` |
| 6 | colorwc | IoT JSON | `colorwc` | {"color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int"} | {"color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int"} | status | `rgbiclight/h6160/iot/CmdColorWc.java, base2light/iot/CmdColorWc.java` |
| 7 | status | IoT JSON | `status` | {"softversion":"str","wifiSoftVersion":"str","turn":"0\|1","brightness":"int","mode":"int","color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int","timer":{"enable":"0\|1","time":[{"openHour":"int","openMin":"int","closeHour":"int","closeMin":"int"}]}} | {"softversion":"str","wifiSoftVersion":"str","turn":"0\|1","brightness":"int","mode":"int","color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int","timer":{"enable":"0\|1","time":[{"openHour":"int","openMin":"int","closeHour":"int","closeMin":"int"}]}} | CmdStatusV0 | `rgbiclight/h6160/iot/CmdStatusV0.java` |
| 8 | timer | IoT JSON | `timer` | {"enable":"0\|1","timeOffset":"int","timeOffsetMinute":"int","time":[{"enable":"0\|1","openHour":"int","openMin":"int","closeHour":"int","closeMin":"int","repeat":"byte"}],"isGroup":"0\|1","group":"int"} | {"enable":"0\|1","timeOffset":"int","timeOffsetMinute":"int","time":[{"enable":"0\|1","openHour":"int","openMin":"int","closeHour":"int","closeMin":"int","repeat":"byte"}],"isGroup":"0\|1","group":"int"} | timer info | `rgbiclight/h6160/iot/CmdTimer.java` |
| 9 | bulb | IoT JSON | `bulb` | {"value":["base64 frame"]} | {"value":["base64 frame"]} | per-bulb color + gradual | `dreamcolorlightv1/iot/CmdBulb.java` |
| 10 | gradual | IoT JSON | `gradual` | {"val":"0\|1"} | {"val":"0\|1"} | gradual state | `dreamcolorlightv1/iot/Cmd.java` |

## split_pact_rgblight

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `pt` | transport wrapper | {"op":"mode\|sleep\|wakeup\|timer","value":["base64(20-byte BLE frame)"]} | `.../h6159/iot/CmdPt.java` |
| `ptReal` | transport wrapper | {"command":["base64(20-byte BLE frame)"]} | `.../h6159/iot/CmdPtReal.java` |
| `IoTConnected` | connection | {} | `.../h6104/iot/Cmd.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|pt | `0x33/0x01` | 01 | [0]=0 off, 1 on | 0xAA/0x01 -> [0]=state | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/SwitchController.java` |
| 2 | heartbeat | BLE frame via ptReal\|pt | `0xAA/0x01` |  | read-only heartbeat, payload empty/zero | 0xAA/0x01 -> [0]=0/1 | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/HeartController.java` |
| 3 | brightness | BLE frame via ptReal\|pt | `0x33/0x04` | 04 <abs> | [0]=absolute brightness after NumUtil.calculateProgress(max,min,ui%) | 0xAA/0x04 -> [0]=absolute | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/BrightnessController.java` |
| 4 | brightness_read | BLE frame via ptReal\|pt | `0xAA/0x04` |  | empty | [0]=absolute | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/BrightnessController.java` |
| 5 | mode_write | BLE frame via ptReal\|pt | `0x33/0x05` | 05 <submode payload> | [0]=submode (0x02/0x03/0x04/0x0A/0x0B/0x0D/0x0E/0x0F/0x13/0x00/0x01/0x05) | 0xAA/0x05 -> [0]=submode, [1..]=body | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/AbsModeController.java` |
| 6 | mode_read | BLE frame via ptReal\|pt | `0xAA/0x05` | 01 | p()={1} (version selector) | [0]=submode, [1..] body; AbsMode.parse dispatches | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/AbsModeController.java` |
| 7 | soft_version | BLE frame via ptReal\|pt | `0xAA/0x06` |  | read ASCII | [0..]=ASCII version | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/SoftVersionController.java` |
| 8 | hard_version | BLE frame via ptReal\|pt | `0xAA/0x07` | 03 | [0]=3 requests MCU hard version | [0]==3, [1..]=ASCII | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/HardVersionController.java` |
| 9 | wifi_hard_version | BLE frame via ptReal\|pt | `0xAA/0x20` |  | read | ASCII | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/WifiHardVersionController.java` |
| 10 | wifi_soft_version | BLE frame via ptReal\|pt | `0xAA/0x21` |  | read | ASCII | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/WifiSoftVersionController.java` |
| 11 | auto_time_write | BLE frame via ptReal\|pt | `0x33/0x0A` | 0A <open/close h,m,repeat> | [0]=open flag, on/off hours+minutes, repeat mask | 0xAA/0x0A | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/AutoTimeController.java` |
| 12 | new_timer_v1 | BLE frame via ptReal\|pt | `0x33/0x23` | 23 <timer slots> | 4 independent slots, each enable/openHour/openMin/closeHour/closeMin/repeat | 0xAA/0x23 -> parsed by NewTimerV1.parseBytes | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/NewTimerV1Controller.java` |
| 13 | sleep | BLE frame via ptReal\|pt | `0x33/0x11` | 11 <sleep window> | sleep enable/start/end | 0xAA/0x11 -> SleepController.parseSleep | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/SleepController.java` |
| 14 | wakeup | BLE frame via ptReal\|pt | `0x33/0x12` | 12 <wake window> | wake enable/start/end | 0xAA/0x12 -> WakeUpController.parse2WakeUp | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/WakeUpController.java` |
| 15 | limit | BLE frame via ptReal\|pt | `0x33/0x0E` | 0E <0\|1> | [0]=max-current/brightness cap enable | 0xAA/0x0E -> [0]==1 | `jadx-splits/split_pact_rgblight/sources/com/govee/stringlightv2/ble/LimitController.java` |
| 16 | ota_prepare | BLE frame via ptReal\|pt | `0x33/0xEE` | EE | no payload | write result | `jadx-splits/split_pact_rgblight/sources/com/govee/stringlightv2/ble/OtaPrepareController.java` |
| 17 | calibration_start_h6101 | BLE frame via ptReal\|pt | `0x33/0x08` | 08 | [0]=8 starts calibration | read 0xAA/0x01 ack via CalibrationOkController | `jadx-splits/split_pact_rgblight/sources/com/govee/h6101/ble/CalibrationController.java` |
| 18 | direction_h6104 | BLE frame via ptReal\|pt | `0x33/0x13` | 13 <dir> | [0]=direction byte (2 up,1 down,4 left,3 right,5 in,6 out,8 max->min,7 min->max,10 CW,9 CCW,11..20 stretch/loop) | 0xAA/0x13 -> [0]=direction | `jadx-splits/split_pact_rgblight/sources/com/govee/h6104/ble/DirectionController.java` |
| 19 | ip_read_h6104 | BLE frame via ptReal\|pt | `0xAA/0x15` |  | empty | [0..3]=IPv4, [4..7]=port (int32) | `jadx-splits/split_pact_rgblight/sources/com/govee/h6104/ble/IPController.java` |
| 20 | red_blue_ratio_h7004 | BLE frame via ptReal\|pt | `0x33/0x0D` | 0D <ratio> <reserved> | [0]: 1=4:1, 2=6:1, 3=8:1; [1]=reserved (unset by callers) | 0xAA/0x0D -> [0]=ratio,[1]=reserved | `jadx-splits/split_pact_rgblight/sources/com/govee/h7004/ble/RedBlueController.java` |
| 21 | gradual_change_h6160 | BLE frame via ptReal\|pt | `0xA3/0x01` | A3 00 01 <count> 01 ... / data A3 <i> <17B> / end A3 FF | Gradual4BleWifiController value={0\|1}; wrapped by 0xA3 V1 packetiser | write result | `jadx-splits/split_pact_rgblight/sources/com/govee/h6160/ble/v1/Gradual4BleWifiController.java` |
| 22 | multi_diy_write | BLE frame via ptReal\|pt | `0xA5/0x02` | start A5 02 00 <packCount> 00 \| data A5 02 <i> <16B> \| end A5 02 FF | value=[0]diyCode [1]effect [2]subEffect [3]speed [4]=3N [5..]=RGB triples [5+3N]=2M [..]=(effect,subEffect) pairs; 16-byte chunks | write result | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/AbsMultipleController4Diy.java` |
| 23 | multi_diy_read | BLE frame via ptReal\|pt | `0xA4/0x02` |  | proType 0xA4 for read | device DIY body | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/AbsMultipleController.java` |
| 24 | multi_scenes_v1 | BLE frame via ptReal\|pt | `0xA3/0x01` | start A3 00 01 <packCount> 01 <bigNum> <cur+1> <8B verify> <4B> \| data A3 <i> <17B> \| end A3 FF <last> | value = base64-decoded effect blob from ScenesRgb; attributes direction/x/y/speed in controller | write result | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/MultiNewScenesControllerV1.java` |
| 25 | multi_scenes_v2 | BLE frame via ptReal\|pt | `0xA3/0x02` | same as multi_scenes_v1 with cmdType 02 | value = ScenesRgbIC blob | write result | `.../MultiNewScenesControllerV2.java` |
| 26 | multi_scenes_v3 | BLE frame via ptReal\|pt | `0xA3/0x07` | same framing, cmdType 07 | value = ScenesGraffiti blob | write result | `.../MultiNewScenesControllerV3.java` |
| 27 | multi_scenes_v4 | BLE frame via ptReal\|pt | `0xA3/0x04` | same framing, cmdType 04 | value = ScenesCube blob; attributes x,y,speed,direction,focusParams | write result | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/AbsMultipleControllerV14Scenes.java` |
| 28 | multi_scenes_v5 | BLE frame via ptReal\|pt | `0xA3/0x0A` | same framing, cmdType 0A | value = ScenesCompose blob | write result | `.../MultiNewScenesControllerV5.java` |
| 29 | multi_new_music | BLE frame via ptReal\|pt | `0xA3/0x41` | start A3 00 01 <count> 41 <p> ... \| data \| end A3 FF | value=[effect][sensitivity][param][manualFlag][R G B] | write result | `jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/MultipleController4Music.java` |
| 30 | submode_color_8b | BLE frame via ptReal\|pt | `0x33/0x05 + 0x02` | 02 R G B flag R2 G2 B2 | RGB+tempFlag+background RGB (8 bytes) | [0]=submode 02 | `jadx-splits/split_pact_rgblight/sources/com/govee/h6159/ble/SubModeColor.java` |
| 31 | submode_color_9b | BLE frame via ptReal\|pt | `0x33/0x05 + 0x0D` | 0D R G B kHi kLo R2 G2 B2 | RGB + kelvin big-endian + background RGB (9 bytes) | [0]=submode 0D | `jadx-splits/split_pact_rgblight/sources/com/govee/h6159/ble/SubModeColor4Bk.java` |
| 32 | submode_color_v1_segments | BLE frame via ptReal\|pt | `0x33/0x05 + 0x0B` | 0B R G B maskLo maskHi 00 00 | 15-bit segment enable mask (bits 0-7 byte4, 8-14 byte5) | [0]=submode 0B | `jadx-splits/split_pact_rgblight/sources/com/govee/h6160/adjust/v1/SubModeColorV1.java` |
| 33 | submode_music_03 | BLE frame via ptReal\|pt | `0x33/0x05 + 0x03` | 03 auto sens [R G B] | auto 0=manual/colour (3B) 1=auto (6B); sens 0-99 | [0]=submode 03 | `jadx-splits/split_pact_rgblight/sources/com/govee/h6159/ble/SubModeMusic.java` |
| 34 | submode_music_01 | BLE frame via ptReal\|pt | `0x33/0x05 + 0x01` | 01 effect sens [R G B] | effect h6101/h6104 0=energic 1=spectrum 2=rolling 3=rhythm; h7318 4=soft 5=power | [0]=submode 01 | `jadx-splits/split_pact_rgblight/sources/com/govee/h6104/ble/SubModeMusic.java` |
| 35 | submode_music_0e | BLE frame via ptReal\|pt | `0x33/0x05 + 0x0E` | 0E effect sens auto [R G B] | V1 music; auto inverted (0 when auto); V2 new-code form 0E code sens | [0]=submode 0E | `jadx-splits/split_pact_rgblight/sources/com/govee/h6159/ble/SubModeMusicV1.java` |
| 36 | submode_music_0f | BLE frame via ptReal\|pt | `0x33/0x05 + 0x0F` | 0F effect sens param auto [R G B] | home-light music | [0]=submode 0F | `jadx-splits/split_pact_rgblight/sources/com/govee/homelightv1/ble/SubModeMusic.java` |
| 37 | submode_music_13 | BLE frame via ptReal\|pt | `0x33/0x05 + 0x13` | 13 effect sens param auto [R G B] | new music (8 bytes) | [0]=submode 13 | `jadx-splits/split_pact_rgblight/sources/com/govee/carlightv1/ble/SubModeMusicV2.java` |
| 38 | submode_mic | BLE frame via ptReal\|pt | `0x33/0x05 + 0x05` | 05 00 flag \| 05 01 \| 05 | h6165 05 00 flag; h7310/17 05 01; stringlightv2 H6192 05 | - | `jadx-splits/split_pact_rgblight/sources/com/govee/h6165/ble/MicController.java` |
| 39 | submode_scenes_2b | BLE frame via ptReal\|pt | `0x33/0x05 + 0x04` | 04 lo hi | 16-bit little-endian effect id | [0]=submode 04, [1..2]=effect | `jadx-splits/split_pact_rgblight/sources/com/govee/h6159/ble/SubModeScenes.java` |
| 40 | submode_scenes_1b | BLE frame via ptReal\|pt | `0x33/0x05 + 0x04` | 04 effect | single-byte effect id (h6104,h6114,h6181,h6182,h7318,h7310/17,homelightv1) | [0]=submode 04, [1]=effect | `jadx-splits/split_pact_rgblight/sources/com/govee/h6104/ble/SubModeScenes.java` |
| 41 | submode_scenes_h7308 | BLE frame via ptReal\|pt | `0x33/0x05 + 0xA1` | A1 effect | H7308 group scene submode (-95); effects 20-27 | [0]=submode A1 | `jadx-splits/split_pact_rgblight/sources/com/govee/rgblight/h7308/H7308BleProtocol.java` |
| 42 | submode_video_00 | BLE frame via ptReal\|pt | `0x33/0x05 + 0x00` | 00 videoType syncFlag \| 00 00 syncFlag videoBrightness | h6101 videoType 0=part,1=all,2=dynamic; h6104 adds brightness byte | [0]=submode 00 | `jadx-splits/split_pact_rgblight/sources/com/govee/h6101/ble/SubModeVideo.java` |
| 43 | submode_diy | BLE frame via ptReal\|pt | `0x33/0x05 + 0x0A` | 0A diyLo diyHi | 16-bit LE DIY code | [0]=submode 0A, [1..2]=code | `jadx-splits/split_pact_rgblight/sources/com/govee/h6159/ble/SubModeNewDiy.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi_connect | BLE notify via ptReal\|pt | `0xEE/0x11` |  | [0]==0 -> connected; 0x11 is notify type after proType 0xEE |  | `jadx-splits/split_pact_rgblight/sources/com/govee/h6159/ble/WifiNotifyParse.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | online | IoT JSON | `online` | {} | {} | device status/state | `jadx-splits/split_pact_rgblight/sources/com/govee/h6159/iot/IOnline.java` |
| 2 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | status | `.../h6159/iot/CmdTurn.java` |
| 3 | brightness | IoT JSON | `brightness` | {"val":"int (family absolute 0-254)"} | {"val":"int (family absolute 0-254)"} | status | `.../h6159/iot/CmdBrightness.java` |
| 4 | color | IoT JSON | `color` | {"red":"0-255","green":"0-255","blue":"0-255"} | {"red":"0-255","green":"0-255","blue":"0-255"} | status | `.../h6159/iot/CmdColor.java` |
| 5 | colorTem | IoT JSON | `colorTem` | {"colorTemInKelvin":"int","color":{"red":"int","green":"int","blue":"int"}} | {"colorTemInKelvin":"int","color":{"red":"int","green":"int","blue":"int"}} | status | `.../h6159/iot/CmdColorTem.java` |
| 6 | colorwc | IoT JSON | `colorwc` | {"color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int (0 when colour)"} | {"color":{"red":"int","green":"int","blue":"int"},"colorTemInKelvin":"int (0 when colour)"} | status | `.../h6159/iot/CmdColorWc.java` |
| 7 | status | IoT JSON | `status` | {} | {} | see iot.status | `.../h6159/iot/CmdStatusV0.java` |
| 8 | timer | IoT JSON | `timer` | {"enable":"0\|1","timeOffset":"int","timeOffsetMinute":"int","isGroup":"0\|1","group":"int","time":[{"enable":"int","openHour":"int","openMin":"int","closeHour":"int","closeMin":"int","repeat":"byte"}]} | {"enable":"0\|1","timeOffset":"int","timeOffsetMinute":"int","isGroup":"0\|1","group":"int","time":[{"enable":"int","openHour":"int","openMin":"int","closeHour":"int","closeMin":"int","repeat":"byte"}]} | timer | `.../h6159/iot/CmdTimerV1.java` |
| 9 | calibrationPoints | IoT JSON | `calibrationPoints` | {"points":[{"pointX":"int","pointY":"int"}]} | {"points":[{"pointX":"int","pointY":"int"}]} | - | `.../h6104/iot/CmdCalibrationPoints.java` |
| 10 | calibrationSnapshot | IoT JSON | `calibrationSnapshot` | {"snapshotUrl":"string"} | {"snapshotUrl":"string"} | - | `.../h6104/iot/CmdCalibrationSnapshot.java` |
| 11 | IP | IoT JSON | `IP` | {"ip":"string","port":"int"} | {"ip":"string","port":"int"} | - | `.../h6104/iot/CmdIP.java` |
| 12 | direction | IoT JSON | `direction` | {"change":"int"} | {"change":"int"} | - | `.../h6104/iot/CmdDirection.java` |
| 13 | mode (H6085/86/89 DIY) | IoT JSON | `mode (H6085/86/89 DIY)` | {"mode":"10","code":"int","color":[{"red":"int","green":"int","blue":"int"}],"effect":"int","subEff":"int","speed":"int","effArr":[{"effect":"int","subEff":"int"}]} | {"mode":"10","code":"int","color":[{"red":"int","green":"int","blue":"int"}],"effect":"int","subEff":"int","speed":"int","effArr":[{"effect":"int","subEff":"int"}]} | status | `.../rgblight/h60858689/iot/CmdDiy.java` |
| 14 | mode (H6085/86/89 scene) | IoT JSON | `mode (H6085/86/89 scene)` | {"mode":"4","code":"int"} | {"mode":"4","code":"int"} | status | `.../rgblight/h60858689/iot/CmdScenes.java` |
| 15 | colorTem (H6085/86/89) | IoT JSON | `colorTem (H6085/86/89)` | {"colorTemInKelvin":"int","color":{"red":"int","green":"int","blue":"int"}} | {"colorTemInKelvin":"int","color":{"red":"int","green":"int","blue":"int"}} | status | `.../rgblight/h60858689/iot/CmdColorTem.java` |

## split_pact_security_health

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | H5026 pair notify | BLE frame | `WifiNotifyParse` | none | pairing only | wifi notify | `h5026/add/{Ble,BleComm,BleNotifyComm}.java` |
| 2 | H5020 scan | BLE frame | `native` | ScanEventV1.SkipDevice | {name,type,subType,communicationType,macAddr,services,rssi}; name H5020_<mac10..12><mac[-2:]> | scan event | `skipv1/sku/H5020BleProcessor.java; SkipBleDeviceModel.java` |
| 3 | H5020 session | BLE frame | `native` | unknown | app model Skip/SkipData: skipNum, spendTime, skipType, tripRope, averageFrequency, fastestFrequency, maxJumps, ripRopes[], calories, time | history records | `skipv1/db/Skip.java; adjust/history/SkipData.java` |
| 4 | H5010 weight | BLE frame | `QN SDK` | unknown | QNScaleData / QNScaleStoreData | weight + body composition | `scalev1/manager/ScaleApi.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | H5026 wifi notify | BLE notify | `pairing` |  | WifiNotifyParse |  | `h5026/add/BleNotifyComm.java` |
| 2 | H5010 scale data | BLE notify | `QN callback` |  | QNScaleDataListener |  | `scalev1/manager/ScaleApi.java` |
| 3 | H5020 jump data | BLE notify | `native callback` |  | SkipData fields |  | `skipv1/adjust/DetailAc.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | armingState | IoT JSON | `armingState` | {"sku":"string","device":"string","armingState":"0\|1"} | {"sku":"string","device":"string","armingState":"0\|1"} | {armingState, defendingRemainTime} | `h5026/detail/RequestDefend.java` |
| 2 | turn | IoT JSON | `turn` | {"val":"0\|1"} | {"val":"0\|1"} | ResultStatus | `doorbell/h721214/communication/Cmd.java` |
| 3 | brightness | IoT JSON | `brightness` | {"val":"1-100"} | {"val":"1-100"} | ResultNightLight | `CmdCommon(Cmd.brightness, v)` |
| 4 | nightLight | IoT JSON | `nightLight` | {"val":"0\|1"} | {"val":"0\|1"} | ResultNightLight | `CmdCommon` |
| 5 | volume | IoT JSON | `volume` | {"val":"1-100"} | {"val":"1-100"} | ResultStatus.spvol | `CmdCommon` |
| 6 | speakVol | IoT JSON | `speakVol` | {"val":"int"} | {"val":"int"} | ResultListen.spvol | `CmdCommon(Cmd.speakVol,v)` |
| 7 | delayClose | IoT JSON | `delayClose` | {"val":"minutes"} | {"val":"minutes"} | ResultLullaby.dly | `CmdCommon` |
| 8 | loop | IoT JSON | `loop` | {"val":"0-2"} | {"val":"0-2"} | ResultLullaby.loop | `CmdCommon` |
| 9 | play | IoT JSON | `play` | {"val":"0\|1","songId":"int"} | {"val":"0\|1","songId":"int"} | ResultLullaby | `CmdPlay` |
| 10 | lullaby | IoT JSON | `lullaby` | {} | {} | ResultLullaby | `CmdRead(Cmd.lullaby)` |
| 11 | listen | IoT JSON | `listen` | {"sku":"string","device":"string","cmd":"listen","clientID":"string","status":"0\|1","time":"epoch"} | {"sku":"string","device":"string","cmd":"listen","clientID":"string","status":"0\|1","time":"epoch"} | ResultListen | `CmdListenSpeak` |
| 12 | speak | IoT JSON | `speak` | {"sku":"string","device":"string","cmd":"speak","clientID":"string","time":"epoch"} | {"sku":"string","device":"string","cmd":"speak","clientID":"string","time":"epoch"} | ResultListen | `CmdListenSpeak` |
| 13 | socket | IoT JSON | `socket` | {"callId":"string","ip":"string","port":"int"} | {"callId":"string","ip":"string","port":"int"} | call endpoint | `CmdWebsocket` |
| 14 | sensitivity | IoT JSON | `sensitivity` | {"val":"0-2"} | {"val":"0-2"} | ResultSetting.stv | `CmdCommon` |
| 15 | moveStv | IoT JSON | `moveStv` | {"val":"0-2"} | {"val":"0-2"} | ResultSetting.mstv | `CmdCommon` |
| 16 | tmpAlert | IoT JSON | `tmpAlert` | {"minT":"int","maxT":"int"} | {"minT":"int","maxT":"int"} | ResultSetting | `CmdTemAlert` |
| 17 | humAlert | IoT JSON | `humAlert` | {"minH":"int","maxH":"int"} | {"minH":"int","maxH":"int"} | ResultSetting | `CmdHumAlert` |
| 18 | status | IoT JSON | `status` | {} | {} | ResultStatus | `CmdRead(Cmd.status)` |
| 19 | wifiMac | IoT JSON | `wifiMac` | {} | {} | ResultWifiMac | `CmdRead(Cmd.wifiMac)` |
| 20 | online | IoT JSON | `online` | {} | {} | ResultOnline | `IotManager` |

## split_pact_tcsocket

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `H5770Repository; GxMessageBuilderKt` |
| `ptIot` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `H5770SharedViewModel.writeOtaInfo` |
| `op` | read envelope | {"command":["<base64 20-byte frame>"]} | `H5770Repository` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | master on/off | BLE frame via ptReal\|ptIot | `0x33/0x01` | 10\|01 | [0]=0x10\|(on?1:0) | 0xAA/0x01 -> bit0 master | `h5770/ble/cmd/H5770SwitchCmd.java` |
| 2 | socket 1 on/off | BLE frame via ptReal\|ptIot | `0x33/0x01` | 20\|02 | [0]=0x20\|(on?2:0) | 0xAA/0x01 -> bit1 | `H5770SwitchCmd.java` |
| 3 | socket 2 on/off | BLE frame via ptReal\|ptIot | `0x33/0x01` | 40\|04 | [0]=0x40\|(on?4:0) | 0xAA/0x01 -> bit2 | `H5770SwitchCmd.java` |
| 4 | socket setting (thermo) | BLE frame via ptReal\|ptIot | `0x33/0x02` | 01 t1 t2 | type 1 heat / 2 cool | 0xAA/0x02 -> [0..1] thermo types, [2..3] DIY types | `H5770SocketSettingCmd.java` |
| 5 | socket setting (DIY) | BLE frame via ptReal\|ptIot | `0x33/0x02` | 02 t1 t2 | type 1 humidify / 2 dehumidify | same | `H5770SocketSettingCmd.java` |
| 6 | mode manual | BLE frame via ptReal\|ptIot | `0x3A/0x05` | 01 | subcmd 1 | 0xAA/0x05 | `H5770ModeCmd.java` |
| 7 | mode thermo | BLE frame via ptReal\|ptIot | `0x3A/0x05` | 02 gear tempBE16 | gear 0 STOP 1 AUTO 2 HEAT 3 COOL; temp BE16 *10 (F) | 0xAA/0x05 | `H5770ModeCmd.java` |
| 8 | mode DIY | BLE frame via ptReal\|ptIot | `0x3A/0x05` | 03 humidityBE16 | humidity BE16 *10 % | 0xAA/0x05 | `H5770ModeCmd.java` |
| 9 | delay close | BLE frame via ptReal\|ptIot | `0x33/0x26` | en minHi minLo | en 0/1; minutes 0-1439 | 0xAA/0x26 -> en,setMin,remainSec | `H5770DelayCloseCmd.java` |
| 10 | device state read | BLE frame via ptReal\|ptIot | `0xAA/0x19` |  | status, todayRuntime BE24, todayKwh BE24/10000, currentRuntimeMin BE16, lastStartTs BE32 | 0xAA/0x19 | `H5770DeviceStateCmd.java` |
| 11 | common switch | BLE frame via ptReal\|ptIot | `0x33/0x1F` | 01\|02 on | sub1 child lock, sub2 Fahrenheit | 0xAA/0x1F -> [0] Fahrenheit,[1] child lock | `H5770CommonSwitchCmd.java` |
| 12 | screen setting | BLE frame via ptReal\|ptIot | `0x33/0x16` | en minutes flag | minutes 1-10 | 0xAA/0x16 | `H5770ScreenSettingCmd.java` |
| 13 | auto cooling delay | BLE frame via ptReal\|ptIot | `0x33/0x25` | en minutes | minutes 1-10 | 0xAA/0x25 | `H5770AutoCoolingDelayCmd.java` |
| 14 | fluctuation range | BLE frame via ptReal\|ptIot | `0x33/0x29` | category indep idx lowBE16 highBE16 | category 1 temp (F), 2 humidity | 0xAA/0x29 | `H5770FluctuationRangeCmd.java` |
| 15 | temp calibration write | BLE frame via ptReal\|ptIot | `0x33/0x1E` | kind target signMagBE16 | kind 1 temp,2 hum; target 1 bound,2 device; value*10 | 0xAA/0x1E | `H5770TempCalibrationCodec.java` |
| 16 | temp calibration read | BLE frame via ptReal\|ptIot | `0xAA/0x1E` | kind target | returns 4 bytes | kind,target,value | `H5770TempCalibrationCmd.java` |
| 17 | thermo bind | BLE frame via ptReal\|ptIot | `0x33/0x08` | macRev6 supportsHum | 6-byte reversed MAC + flag | 0xAA/0x08 -> MAC + flag | `H5770ThermoBindCmd.java` |
| 18 | thermo realtime | BLE frame via ptReal\|ptIot | `0xAA/0x10` |  | temp24, offsetMin, selfTempBE16/10, humidityBE16/10 | 0xAA/0x10 | `H5770ThermoRealtimeCmd.java` |
| 19 | abnormal state | BLE frame via ptReal\|ptIot | `0xAA/0x17` |  | bit0 overload, bit1 relay1, bit2 relay2 | 0xAA/0x17 | `H5770AbnormalStateCmd.java` |
| 20 | clear abnormal | BLE frame via ptReal\|ptIot | `0x33/0x17` | 01 | clear | ack | `H5770AbnormalStateCmd.java` |
| 21 | alarm settings read | BLE frame via ptReal\|ptIot | `0xAA/0x27` |  | volume, temp en/type/4xBE16 (F*10), power en/watts/min | 0xAA/0x27 | `H5770AlarmSettingsCmd.java` |
| 22 | alarm temp write | BLE frame via ptReal\|ptIot | `0x33/0x27` | 01 en type temps... | sub 1 | 0xAA/0x27 | `H5770AlarmSettingsCmd.java` |
| 23 | alarm power write | BLE frame via ptReal\|ptIot | `0x33/0x27` | 02 en wattsBE16 minutes | watts 100-1800, minutes 1-10 | 0xAA/0x27 | `H5770AlarmSettingsCmd.java` |
| 24 | alarm volume write | BLE frame via ptReal\|ptIot | `0x33/0x27` | 03 level | level 0-3 | 0xAA/0x27 | `H5770AlarmSettingsCmd.java` |
| 25 | schedule write | BLE frame via ptReal\|ptIot | `0xA3/0x14` | multi-packet schedule items | nameLen,name,index,enabled,startH,startM,endH,endM,repeat,mode4 | ack | `H5770ScheduleCmd.java` |
| 26 | schedule read | BLE frame via ptReal\|ptIot | `0xAC/0x01` | 0F | multi-read 17-byte chunks | schedule list | `H5770ScheduleCmd.java` |
| 27 | schedule delete | BLE frame via ptReal\|ptIot | `0x33/0x15` | index | 0-254 | ack | `H5770ScheduleDeleteCmd.java` |
| 28 | schedule running read | BLE frame via ptReal\|ptIot | `0xAA/0x24` |  | [0] index,[1] status | 0xAA/0x24 | `H5770ScheduleRunningCmd.java` |
| 29 | schedule running end | BLE frame via ptReal\|ptIot | `0x33/0x24` | 01 | stop running schedule | ack | `H5770ScheduleRunningCmd.java` |
| 30 | full info read | BLE frame via ptReal\|ptIot | `0xAC/0x01` | 03 | reply [count,(cmd,len,payload)...] | re-dispatched as 0xAA/cmd frames | `H5770FullInfoCmd.java` |
| 31 | heartbeat read | BLE frame via ptReal\|ptIot | `0xAA/0x00` |  | switch,status,target24,offset,targetBE16,ambientBE16,status,humBE16 | 0xAA/0x00 | `H5770HeartbeatCmd.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | device state | BLE notify via ptReal\|ptIot | `0xEE/0x19` |  | status, todayRuntime BE24, todayKwh BE24/10000, currentRuntimeMin BE16, lastStartTs BE32 |  | `H5770DeviceStateCmd.java` |
| 2 | heartbeat | BLE notify via ptReal\|ptIot | `0xEE/0x00` |  | see commands; 0x7FFF invalid |  | `H5770HeartbeatCmd.java` |
| 3 | mode | BLE notify via ptReal\|ptIot | `0xEE/0x05` |  | [0] subcmd; 1 manual, 2 thermo [gear,target], 3 DIY [humidity] |  | `H5770ModeCmd.java` |
| 4 | switch | BLE notify via ptReal\|ptIot | `0xEE/0x01` |  | bit0 master, bit1 socket1, bit2 socket2 |  | `H5770SwitchCmd.java` |
| 5 | socket setting | BLE notify via ptReal\|ptIot | `0xEE/0x02` |  | thermo1,thermo2,diy1,diy2 |  | `H5770SocketSettingCmd.java` |
| 6 | common switch | BLE notify via ptReal\|ptIot | `0xEE/0x1F` |  | [0] Fahrenheit, [1] child lock |  | `H5770CommonSwitchCmd.java` |
| 7 | screen setting | BLE notify via ptReal\|ptIot | `0xEE/0x16` |  | [0] en,[1] minutes,[2] flag |  | `H5770ScreenSettingCmd.java` |
| 8 | auto cooling | BLE notify via ptReal\|ptIot | `0xEE/0x25` |  | [0] en,[1] minutes |  | `H5770AutoCoolingDelayCmd.java` |
| 9 | delay close | BLE notify via ptReal\|ptIot | `0xEE/0x26` |  | [0] en,[1..2] setMin,[3..4] remainSec |  | `H5770DelayCloseCmd.java` |
| 10 | abnormal state | BLE notify via ptReal\|ptIot | `0xEE/0x17` |  | bit0 overload, bit1 relay1, bit2 relay2 |  | `H5770AbnormalStateCmd.java` |
| 11 | thermo bind | BLE notify via ptReal\|ptIot | `0xEE/0x08` |  | MAC6 + supportsHumidity |  | `H5770ThermoBindCmd.java` |
| 12 | thermo realtime | BLE notify via ptReal\|ptIot | `0xEE/0x10` |  | temp24, offsetMin, selfTempBE16/10, humidityBE16/10 |  | `H5770ThermoRealtimeCmd.java` |
| 13 | alarm settings | BLE notify via ptReal\|ptIot | `0xEE/0x27` |  | 15 bytes (see commands) |  | `H5770AlarmSettingsCmd.java` |
| 14 | fluctuation range | BLE notify via ptReal\|ptIot | `0xEE/0x29` |  | category,indep,idx,lowBE16,highBE16 |  | `H5770FluctuationRangeCmd.java` |
| 15 | schedule running | BLE notify via ptReal\|ptIot | `0xEE/0x24` |  | [0] index,[1] running |  | `H5770ScheduleRunningCmd.java` |
| 16 | chart data | BLE notify via ptReal\|ptIot | `char ...2015` |  | segmented chart records; 3-byte (runMin, kWh BE16/10000) |  | `h5770/chart/ble/H5770ChartReadSkuSubVM.java; H5770ChartCons.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | status | IoT JSON | `status` | {} | {} | status frames | `shared GX status` |
| 2 | online | IoT JSON | `online` | {} | {} | presence | `shared GX status` |

## split_pact_thnew

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `IotOpManager; SettingOpManager` |
| `multiSync` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `IotOpManager; Controller4MultiTrigger` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | heart V0/V1 | BLE frame via ptReal\|multiSync | `0x33/0x01 or 0xAA/0x01` | none / probe mask | COMMON: temp BE16, hum BE16, third BE16, battery, flags; WITH_THIRD/DUAL_PROBE/H5220 variants | 0xAA/0x01 -> heart | `Controller4HeartV0; Controller4HeartV1` |
| 2 | heart prepare / temp unit | BLE frame via ptReal\|multiSync | `0x33/0x02` | unit ordinal | [0] 0=C 1=F | ack | `Controller4HeartPrepare; Controller4TemUnit` |
| 3 | humidity warning | BLE frame via ptReal\|multiSync | `0x33/0x03` | enable minLE16 maxLE16 | humidity x100, 0-100% | same | `Controller4HumWarning` |
| 4 | temperature warning | BLE frame via ptReal\|multiSync | `0x33/0x04` | enable minLE16 maxLE16 delayMin | temp x100, -20..60C (-200..200 high range) | same | `Controller4TemWarning` |
| 5 | upload frequency | BLE frame via ptReal\|multiSync | `0x33/0x05` | freq [extra] | [0] interval | ack | `Controller4UploadFreq` |
| 6 | humidity calibration | BLE frame via ptReal\|multiSync | `0x33/0x06` | calLE16 | signed x100, -2000..2000 | same | `Controller4HumCali` |
| 7 | temperature calibration | BLE frame via ptReal\|multiSync | `0x33/0x07` | calLE16 | signed x100, -300..300 | same | `Controller4TemCali` |
| 8 | battery / low-batt / long-life | BLE frame via ptReal\|multiSync | `0x33/0x08` | [0] on/off | enable | 0xAA/0x08 -> [0] battery | `Controller4Battery; Controller4SwitchLongLife*` |
| 9 | heart V0 legacy | BLE frame via ptReal\|multiSync | `0xAA/0x0A` |  | read only | [0..1] temp BE16, [2..3] hum BE16 | `Controller4HeartV0` |
| 10 | device id | BLE frame via ptReal\|multiSync | `0xAA/0x0C` |  | read only | id bytes | `Controller4DeviceId` |
| 11 | BLE hardware version | BLE frame via ptReal\|multiSync | `0xAA/0x0D` |  | read only | version | `Controller4BleHv` |
| 12 | BLE software version | BLE frame via ptReal\|multiSync | `0xAA/0x0E` |  | read only | version | `Controller4BleSv` |
| 13 | time sync | BLE frame via ptReal\|multiSync | `0x33/0x10` | tsLE32 tz | epoch seconds + timezone | ack | `Controller4SyncTime` |
| 14 | clear data | BLE frame via ptReal\|multiSync | `0x33/0x11` |  | none | ack | `Controller4ClearData` |
| 15 | check network | BLE frame via ptReal\|multiSync | `0x33/0x12` | FF | [0]=0xFF | ack | `Controller4CheckNetwork` |
| 16 | clear sub-device data | BLE frame via ptReal\|multiSync | `0x33/0x14` |  | none | ack | `Controller4ClearSubDevData` |
| 17 | do not disturb / close warn | BLE frame via ptReal\|multiSync | `0x33/0x16` | enable startH startM endH endM | DND | same | `Controller4CloseWarn` |
| 18 | time format | BLE frame via ptReal\|multiSync | `0x33/0x17` | [format] | 12/24h | same | `Controller4TimeFormat` |
| 19 | display mode | BLE frame via ptReal\|multiSync | `0x33/0x12` | [mode] | display config | same | `Controller4Display` |
| 20 | lightness | BLE frame via ptReal\|multiSync | `0x33/0x13` | [level] | 0-100 | same | `Controller4Lightness` |
| 21 | lightness V2 | BLE frame via ptReal\|multiSync | `0x33/0x19` | [level] | 0-100 | same | `Controller4LightnessV2` |
| 22 | multi trigger | BLE frame via ptReal\|multiSync | `0x33/0x1A or 0x13` | raw frame | goods 124/319/330/366/369 use 0x1A, else 0x13 | ack | `Controller4MultiTrigger` |
| 23 | PM2.5 warning | BLE frame via ptReal\|multiSync | `0x33/0x16` | enable minLE16 maxLE16 | 0-999 ug/m3 | same | `Controller4Pm25Warning` |
| 24 | CO2 warning | BLE frame via ptReal\|multiSync | `0x33/0x16` | enable minLE16 maxLE16 | 0-5000 ppm | same | `Controller4Co2Warning` |
| 25 | CO2 grade | BLE frame via ptReal\|multiSync | `0x33/0x1D` | minLE16 maxLE16 | ppm thresholds (default 1100/1800) | same | `Controller4Co2SetGrade` |
| 26 | air quality switch | BLE frame via ptReal\|multiSync | `0x33/0x1F` | [0] on/off | enable | same | `Controller4AirQualitySwitch` |
| 27 | WiFi hardware version | BLE frame via ptReal\|multiSync | `0xAA/0x20` |  | read only | version | `Controller4WifiHv` |
| 28 | WiFi software version | BLE frame via ptReal\|multiSync | `0xAA/0x21` |  | read only | version | `Controller4WifiSv` |
| 29 | temp/hum warning V1 | BLE frame via ptReal\|multiSync | `0x33/0x22` | enable minLE16 maxLE16 | x100 | same | `Controller4TemWarning4H5112; Controller4HumWarning4H5112` |
| 30 | gateway warn / close warn | BLE frame via ptReal\|multiSync | `0x33/0x23` | [0] on/off | enable | same | `Controller4GateWayWarn` |
| 31 | upload last data | BLE frame via ptReal\|multiSync | `0x33/0x24` | [seconds] | seconds | ack | `Controller4UploadLastData` |
| 32 | lightness V2 | BLE frame via ptReal\|multiSync | `0x33/0x25` | [level] | 0-100 | same | `Controller4LightnessV2` |
| 33 | CO2 manual calibration | BLE frame via ptReal\|multiSync | `0x33/0x1C` | valueLE16 | ppm | ack | `ControllerCo2ManualCalibration` |
| 34 | volume | BLE frame via ptReal\|multiSync | `0x33/0x30` | [volume] | 0-100 | same | `Controller4Volume` |
| 35 | probe icon / BLE type | BLE frame via ptReal\|multiSync | `0x33/0x32 or 0xBD` | [icon/type] | enum | same | `Controller4ProbeIcon; Controller4BdType` |
| 36 | check net (H5112) | BLE frame via ptReal\|multiSync | `0x33/0x35` | FF | 0xFF | ack | `Controller4CheckNet` |
| 37 | comfort TH (H5171) | BLE frame via ptReal\|multiSync | `0x33/0x34` | minTemLE16 maxTemLE16 minHumLE16 maxHumLE16 | x100 | same | `h5171/Controller4ComfortTemHum` |
| 38 | weather (H5220) | BLE frame via ptReal\|multiSync | `0x33/0x37` | weather frame | forecast block | same | `h5220/Controller4Weather` |
| 39 | specification (H5220) | BLE frame via ptReal\|multiSync | `0x33/0x39` | [spec] | enum | same | `h5220/Controller4Specification` |
| 40 | time format (H5220) | BLE frame via ptReal\|multiSync | `0x33/0x41` | [format] | 12/24h | same | `Controller4TimeFormat4H5220` |
| 41 | ptReal op (H5112) | BLE frame via ptReal\|multiSync | `0x33/0x70` | command | tunneled op | ack | `h5112/Controller4PtRealOp` |
| 42 | secret key | BLE frame via ptReal\|multiSync | `0x33/0xFE or g` | key bytes | GID-safe key | ack | `Controller4SecretKeyV0/V1` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | heart | BLE notify via ptReal\|multiSync | `0xEE/0x01` |  | format-selected: COMMON [0..1] temp BE16, [2..3] hum BE16, [4..5] third BE16, [6] battery, [7] flags; WITH_THIRD adds probe mask; DUAL_PROBE [0..1] temp, [2..3] hum, [4] battery, [5] flags; H5220 [0..1] temp, [2..3] hum, [4] battery, [5] switch |  | `Controller4HeartV1; ThHeartDispatcher` |
| 2 | battery | BLE notify via ptReal\|multiSync | `0xAA/0x08` |  | [0] 0-100% |  | `Controller4Battery` |
| 3 | remain / chart | BLE notify via ptReal\|multiSync | `char 494e...2013` |  | 16-byte records, 2-byte relative minute stamp + temp/hum x100 |  | `ThChartDataManager` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | online | IoT JSON | `online` | {} | {} | subscription | `IotOpManager` |
| 2 | status | IoT JSON | `status` | {} | {} | state JSON | `IotOpManager` |
| 3 | devStatus | IoT JSON | `devStatus` | {} | {} | per-probe state | `IotOpManager` |
| 4 | tem | IoT JSON | `tem` | {"tem":"int x100"} | {"tem":"int x100"} | reading | `IotInfo4H51*` |
| 5 | hum | IoT JSON | `hum` | {"hum":"int x100"} | {"hum":"int x100"} | reading | `IotInfo4H51*` |
| 6 | pm25 | IoT JSON | `pm25` | {"pm25":"int 0-999"} | {"pm25":"int 0-999"} | reading | `IotInfo4H5106` |
| 7 | co2 | IoT JSON | `co2` | {"co2":"int 0-5000"} | {"co2":"int 0-5000"} | reading | `IotInfo4H5140` |

## split_pact_tvlightv4

### Transport formats (not commands)

| Format | Role | Payload / data | Source |
|---|---|---|---|
| `pt` | transport wrapper | {"op":"mode\|gradual\|sleep\|timer\|wakeup","value":["<base64 20-byte frame>"]} | `pact_tvlightv4/iot/CmdPt.java` |
| `ptReal` | transport wrapper | {"command":["<base64 20-byte frame>"]} | `pact_tvlightv4/iot/v2/CmdPtReal.java` |
| `IoTConnected` | connection | {"value":["<base64>"]} | `pact_tvlightv2/iot/CmdBulb.java` |

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power | BLE frame via ptReal\|pt | `0x33/0x01` | 00\|01 | [0] 0=off 1=on | 0xAA/0x01 -> [0] state | `base2light/ble/controller/SwitchController via pact_tvlightv*/pact/Comm.java` |
| 2 | brightness | BLE frame via ptReal\|pt | `0x33/0x04` | <level> | [0] level; v4 range 20..254 raw; v2 may remap via NumUtil.calculateProgress when pact V1 | 0xAA/0x04 -> [0] | `pact_tvlightv4/pact/Comm.java#makeBrightness4BleComm; pact_tvlightv2/pact/Support.java#getBrightnessRange` |
| 3 | heart/status | BLE frame via ptReal\|pt | `0x33/0x01 (write); 0xAA/0x01 (read)` | 00\|01 | write on/off; read valid bytes [0] state (0x11 both,0x01 main,0x10 background,0x00 none), [1] feast flag (v3/v4) | 0xAA/0x01 | `pact_tvlightv4/ble/TvHeartController.java; pact_tvlightv3/ble/TvHeartController.java` |
| 4 | mode container | BLE frame via ptReal\|pt | `0x33/0x05` | <submode payload> | [0]=sub-mode id, [1..] payload; see dynamic_effects | 0xAA/0x05 with p()={1} -> [0]=submode, [1..] payload | `base2light/ble/controller/AbsModeController + pact_tvlightv*/ble/ModeController.java` |
| 5 | all-light switch | BLE frame via ptReal\|pt | `0x33/0x33` | 00\|01\|10\|11 | [0] 0=both off,1=main on,0x10=background on,0x11=both on | read same | `pact_tvlightv4/ble/SingleLightController.java` |
| 6 | swap light position | BLE frame via ptReal\|pt | `0x33/0x34` |  | no payload | write ack | `pact_tvlightv4/ble/SwapLightController.java` |
| 7 | light direction | BLE frame via ptReal\|pt | `0x33/0x30` | <dir> | [0] 0/1 direction | 0xAA/0x30 -> [0] | `pact_tvlightv4/ble/LightDirectionController.java` |
| 8 | camera position | BLE frame via ptReal\|pt | `0x33/0x31` | <pos> | [0] cameraPos | 0xAA/0x31 -> [0] | `pact_tvlightv4/ble/CameraPosController.java` |
| 9 | check camera | BLE frame via ptReal\|pt | `0x33/0x32` |  | no payload | [0] 0/1 | `pact_tvlightv4/ble/CheckCameraController.java` |
| 10 | start time (v4) | BLE frame via ptReal\|pt | `0xAA/0x35` |  | read | [0] 0..255 | `pact_tvlightv4/ble/StartTimeController.java` |
| 11 | start time (v2) | BLE frame via ptReal\|pt | `0xAA/0x34` |  | read (StartTimeControllerV1 uses 0x35) | [0] | `pact_tvlightv2/ble/StartTimeController.java` |
| 12 | gradual switch (v2) | BLE frame via ptReal\|pt | `0xA3/0xA3` | 00\|01 | [0] gradual on/off | [0] | `pact_tvlightv2/ble/GradualController.java` |
| 13 | multi-frame DIY/scene chunk | BLE frame via ptReal\|pt | `0xA3 or 0xA4 or 0xA5 / <idx>` | <chunk> | MultipleBleBytes / MultipleControllerCommV1: [2]=index, [3..18]=chunk, last frame carries 0x05 mode cmd | per-chunk ack | `base2light/ble/comm/MultipleBleBytes; pact_tvlightv4/iot/CmdPt.java` |
| 14 | white balance (base parser) | BLE frame via ptReal\|pt | `0x33/0xA9` | 00 03 auto R B / 06 01 progress / 0F 03 R G B | valid bytes [2]=enabled, [3..5]=first RGB, [6..7]=second RGB | 0xAA/0xA9 | `pact_tvlightv4/detail/Info4Detail.java#n0` |
| 15 | whole-RL brightness (base parser) | BLE frame via ptReal\|pt | `0x33/0xA9` | 02 01 value | valid byte [2] level | 0xAA/0xA9 02 | `pact_tvlightv4/detail/Info4Detail.java#o0` |
| 16 | black-border remove (base parser) | BLE frame via ptReal\|pt | `0x33/0xA9` | 0B 01 flag | valid byte [3] 1=on | 0xAA/0xA9 0B | `pact_tvlightv4/detail/Info4Detail.java#c0` |
| 17 | DSP version read | BLE frame via ptReal\|pt | `0xAA/0x07` |  | [1]=7 [2]=7, bytes 3..4 low/high count | 0xAA/0x07 | `pact_tvlightv4/pact/Comm.java#parseDspVersion` |
| 18 | whiteBalanceClassic | BLE frame via ptReal\|pt | `0x33/0xA9` | 00 03 auto R B | [0]=0 [1]=3 [2]=auto?0:1 [3]=R [4]=B; read 00 -> valid[2]=defaultAuto valid[3]=defaultR valid[4]=defaultB valid[5]=auto valid[6]=R valid[7]=B | 0xAA/0xA9 00 | `base2light/videomode/newdetail/funtion/WhiteBalanceVmInterface.java` |
| 19 | whiteBalanceAdvanced | BLE frame via ptReal\|pt | `0x33/0xA9` | 0F 03 R G B | [0]=0x0F [1]=3 [2..4]=R,G,B; read 0F -> valid[2..5]=R,G,B,type | 0xAA/0xA9 0F | `base2light/videomode/newdetail/funtion/WhiteBalanceVmInterface.java` |
| 20 | autoWhiteBalance | BLE frame via ptReal\|pt | `0x33/0xA9` | 12 | trigger auto white balance (old path) | ack | `base2light/videomode/newdetail/controller/VideoAutoWbController.java` |
| 21 | checkWhiteBalanceCali | BLE frame via ptReal\|pt | `0xAA/0xA9` | 13 | read; valid[2]==1 means calibrated | 0xAA/0xA9 13 | `base2light/videomode/newdetail/controller/VideoCheckWbCaliController.java` |
| 22 | exitWhiteBalanceCali | BLE frame via ptReal\|pt | `0x33/0xA9` | 14 | exit calibration | ack | `base2light/videomode/newdetail/controller/VideoAutoWbController.java` |
| 23 | sensitivity | BLE frame via ptReal\|pt | `0x33/0xA9` | 01 01 value | [0]=1 [1]=1 [2]=value; read 01 -> valid[2] | 0xAA/0xA9 01 | `base2light/videomode/newdetail/controller/VideoSensitivityController.java` |
| 24 | videoBrightness | BLE frame via ptReal\|pt | `0x33/0xA9` | 02 01 value | [0]=2 [1]=1 [2]=whole-RL brightness; read 02 | 0xAA/0xA9 02 | `base2light/videomode/newdetail/funtion/WholeRLBrightnessVmInterface.java` |
| 25 | colorCalibration | BLE frame via ptReal\|pt | `0x33/0xA9` | 05 03 R G B \| 05 04 R G B extra | [0]=5 [1]=3\|4 [2..]=RGB[+extra]; read 05 -> valid[2..5] | 0xAA/0xA9 05 | `base2light/videomode/newdetail/controller/ColorCaliController.java; pact_h6099/ble/controller/compose/Controller4ColorCalibration.java` |
| 26 | blackScreen | BLE frame via ptReal\|pt | `0x33/0xA9` | 0A 06 enable mode startLo startHi endLo endHi | [0]=0x0A [1]=6 [2]=enable [3]=mode 1\|2 [4..5]=start LE16 [6..7]=end LE16; read 0A | 0xAA/0xA9 0A | `pact_h6099/ble/controller/compose/BlackScreenController.java; base2light/balckscreen/controller/BlackScreenController.java` |
| 27 | hdrCalibration | BLE frame via ptReal\|pt | `0x33/0xA9` | 0D | write triggers HDR calibration; read 0D polls result | 0xAA/0xA9 0D | `base2light/videomode/newdetail/controller/HDRCaliController.java` |
| 28 | saturation | BLE frame via ptReal\|pt | `0x33/0xA9` | 0E 01 value | [0]=0x0E [1]=1 [2]=value; read 0E -> valid[2] | 0xAA/0xA9 0E | `base2light/videomode/newdetail/controller/VideoSaturationController.java` |
| 29 | aiFilter | BLE frame via ptReal\|pt | `0x33/0xA9` | 10 0F enable R G B saturation codeLo codeHi autoCloseLo autoCloseHi timeLo timeHi tz0 tz1 tz2 tz3 | [2]=enable [3]=R [4]=G [5]=B [6]=saturation [7..8]=filter code LE16 [9..10]=auto-close minutes LE16 [11..12]=expiry time-of-day LE16 [13..16]=timezone; read 10 -> valid[2..16] | 0xAA/0xA9 10 | `base2light/videomode/newdetail/controller/AiFilterController.java` |
| 30 | hdrEffect | BLE frame via ptReal\|pt | `0x33/0xA9` | 11 02 enable level | [0]=0x11 [1]=2 [2]=enable [3]=level; read 11 -> valid[2]==1,valid[3] | 0xAA/0xA9 11 | `base2light/videomode/newdetail/controller/VideoHdrEffectController.java` |
| 31 | soundEffectMic | BLE frame via ptReal\|pt | `0x33/0xAC` | micIndex | [0]=selected mic index | ack | `base2light/videomode/newdetail/funtion/SoundEffectVmInterface.java` |
| 32 | relativeBrightness | BLE frame via ptReal\|pt | `0x33/0xAE` | 01 04\|06 v0 v1 v2 v3 [v4 v5] | [0]=1 [1]=segment count (4\|6) then segment levels; read AE 01 | 0xAA/0xAE 01 | `base2light/relativebrightness/controller/RelativeBrightnessController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi connected | BLE notify via ptReal\|pt | `0xEE/0x11 (notify)` |  | [0]==0 -> connected |  | `pact_tvlightv4/ble/WifiNotifyParse.java` |
| 2 | brightness | BLE notify via ptReal\|pt | `notify 0x20` |  | [0] level |  | `pact_tvlightv3/ble/BrightnessNotifyParse.java` |
| 3 | device/switch status | BLE notify via ptReal\|pt | `notify 0x30` |  | [0]==1, [1] bitfield |  | `base2light/ble/DeviceStatusNotifyParse (registered in v3/v4 BleNotifyComm)` |
| 4 | check camera response | BLE notify via ptReal\|pt | `0xAA/0x32` |  | [0] 0/1 |  | `pact_tvlightv4/ble/CheckCameraController.java` |
| 5 | heart/power | BLE notify via ptReal\|pt | `0xAA/0x01` |  | [0] state, [1] feast flag |  | `pact_tvlightv4/ble/TvHeartController.java` |
| 6 | mode read-back | BLE notify via ptReal\|pt | `0xAA/0x05` |  | [0]=submode then payload |  | `pact_tvlightv4/ble/Mode.java` |
| 7 | white balance / whole brightness / border | BLE notify via ptReal\|pt | `0xAA/0xA9 (0x00/0x02/0x0B)` |  | read replies for white balance (0), whole-RL brightness (2), black-border (11) |  | `pact_tvlightv4/detail/Info4Detail.java` |

### IoT commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | turn | IoT JSON | `turn` | {"val":"0\|1","subVal":"[v1,v2] (v4)"} | {"val":"0\|1","subVal":"[v1,v2] (v4)"} | status/state | `pact_tvlightv4/iot/CmdTurn.java` |
| 2 | brightness | IoT JSON | `brightness` | {"val":"int"} | {"val":"int"} | state.brightness | `pact_tvlightv4/iot/CmdBrightness.java` |
| 3 | colorwc | IoT JSON | `colorwc` | {"color":{"red":"0-255","green":"0-255","blue":"0-255"},"colorTemInKelvin":"int (0 for RGB)"} | {"color":{"red":"0-255","green":"0-255","blue":"0-255"},"colorTemInKelvin":"int (0 for RGB)"} | state | `pact_tvlightv4/iot/v2/CmdColorWc.java` |
| 4 | camera | IoT JSON | `camera` | {"cameraPos":"int","cameraDirection":"int (v2)"} | {"cameraPos":"int","cameraDirection":"int (v2)"} | state | `pact_tvlightv4/iot/CmdCameraPos.java; pact_tvlightv2/iot/CmdDirection.java` |
| 5 | points | IoT JSON | `points` | {"points":[{"pointX":"int","pointY":"int"}]} | {"points":[{"pointX":"int","pointY":"int"}]} | status | `pact_tvlightv4/iot/CmdCalibrationPoints.java` |
| 6 | snapshot (read) | IoT JSON | `snapshot (read)` | {} | {} | snapshotUrl | `pact_tvlightv4/iot/ResultSnapShot.java` |

## split_pfdv1

### BLE commands

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | power (H7001/H7023) | BLE frame | `0x33/0x01` | on | [0]=0/1 | 0xAA/0x01 | `h700123/sku/Comm.java` |
| 2 | brightness (H7001/H7023) | BLE frame | `0x33/0x04` | level | 1 + (percent-1)*(42/100) => 1..40 | 0xAA/0x04 -> [0] | `h700123/sku/Comm.java; base NumUtil.calculateProgress(40,1,percent)` |
| 3 | color (H7001/H7023) | BLE frame | `0x33/0x05` | 08 m0 m1 m2 R G B 00 | [0]=8, [1..3]=24-bit segment mask, [4..6]=RGB, [7]=0 | 0xAA/0x05 [0]=8 -> RGB | `h700123/adjust/SubModeColor.java` |
| 4 | music select (H7001/H7023) | BLE frame | `0x33/0x05` | 05 01 | [0]=5,[1]=1 | 0xAA/0x05 [0]=5 | `h700123/adjust/SubModeMic.java` |
| 5 | mic dynamic/mild (H7001/H7023) | BLE frame | `0x33/0x05` | 05 03 flag | [2]=1 dynamic, 0 mild | ack | `h700123/ble/MicController.java` |
| 6 | scene mode (H7001/H7023) | BLE frame | `0x33/0x05` | 09 00 x15 | 16 bytes; [0]=9 | 0xAA/0x05 [0]=9 -> type | `h700123/adjust/SubModeScenes.java` |
| 7 | read bulb colors (H7001/H7023) | BLE frame | `0xAA/0xA2` | group | group 1..ceil(bulbs/4) | [group, 4xRGB] | `h700123/ble/ReadBulbColorController.java` |
| 8 | multi-scene (H7001/H7023) | BLE frame | `0xA5/0x01` | 00 effect subEffect speed colorCount colors... | start [0xA5,0x01,0,count,0], chunks [0xA5,0x01,index,16B], end [0xA5,0x01,0xFF] | ack | `h700123/ble/ScenesModeController.java; MultipleControllerComm` |
| 9 | power (H7024) | BLE frame | `0x33/0x01` | on | [0]=0/1 | 0xAA/0x01 | `h7024/scenes/BleSwitchCmdBuilder.java` |
| 10 | brightness (H7024) | BLE frame | `0x33/0x04` | level | raw 0..100 (no 1..40 scaling) | 0xAA/0x04 | `h7024/scenes/BleBrightnessBuilder.java` |
| 11 | color (H7024) | BLE frame | `0x33/0x05` | 0B R G B m0 m1 m2 00 | [0]=11, [1..3]=RGB, [4..6]=24-bit segment mask, [7]=0 | 0xAA/0x05 [0]=11 -> RGB | `h7024/adjust/mode/H7024SubModeColor.java` |
| 12 | music (H7024) | BLE frame | `0x33/0x05` | 01 effect sens | effect 4 mild, 5 dynamic; sensitivity 0..99 | 0xAA/0x05 [0]=1 | `h7024/adjust/mode/SubModeMusic.java` |
| 13 | scene (H7024) | BLE frame | `0x33/0x05` | 09 type+1 00 x15 | 16 bytes; [0]=9,[1]=type+1 | 0xAA/0x05 [0]=9 -> type | `h7024/adjust/mode/SubModeScenes.java` |
| 14 | bulb count read (H7024) | BLE frame | `0xAA/0x0F` |  | no payload | [count] | `h7024/ble/BulbNumController.java` |
| 15 | bulb count write (H7024) | BLE frame | `0x33/0x0F` | count | [0]=count | ack | `h7024/ble/BulbNumController.java` |
| 16 | read bulb colors (H7024) | BLE frame | `0xAA/0xA2` | group | group 1..ceil(bulbs/4) | [group, 4xRGB] | `h7024/ble/ReadBulbColorController.java` |
| 17 | multi-scene (H7024) | BLE frame | `0xA5/0x01` | code effect subEffect speed colorCount colors... | code = type+1; effect = type; default 4 colors | ack | `h7024/scenes/Common.java; ScenesModeController.java` |

### BLE notifications / readings

| # | Command | Format / cloud | Op / cmd | Payload / data | Layout / schema | Response | Source |
|---:|---|---|---|---|---|---|---|
| 1 | wifi state (H7024) | BLE notify | `0xEE/0x11` |  | [0]==0 connected |  | `h7024/ble/WifiNotifyParse.java` |
| 2 | mode | BLE notify | `0xEE/0x05` |  | [0] sub-mode (8 color -> RGB at [1..3]; 9 scene -> type at [1]; 5 mic) |  | `Mode.parseSubMode` |
| 3 | read bulb colors | BLE notify | `0xEE/0xA2` |  | [0] group, [1..12] 4xRGB |  | `ReadBulbColorController` |
| 4 | brightness | BLE notify | `0xEE/0x04` |  | [0] level |  | `base BrightnessController` |
| 5 | switch/heart | BLE notify | `0xEE/0x01` |  | base |  | `base controllers` |
