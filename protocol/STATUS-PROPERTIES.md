# Status properties vs. commands vs. settings

Not every app-visible flag is a BLE opcode or a command payload. Several names that look
like protocol fields are actually **status properties** received from the cloud/device-list,
parsed out of a status frame, derived by the UI, or **user settings** that merely happen to
be named after a condition.

This note pins down the ones that are easy to mis-file (`waterShortage`, `tankEmpty`,
`waterLack`, `iceFull`, …), with the exact carriers and source paths.

## Classification rule

| Suffix / shape | Kind | Example | Where it belongs |
|---|---|---|---|
| `...OnOff`, `...Enable`, `...Switch` | **Setting** (user preference / push toggle) | `waterShortageOnOff` | `pact/Ext`, REST setting request, IoT config — **not** a reading |
| State noun (`waterLack`, `iceFull`, `doorNotClosed`) | **Status flag** | `waterLack` | status frame parser, status bean, cloud device-list/status — **not** a BLE opcode |
| Numeric measurement (`waterVield`, `enduranceMinute`) | **Reading** | water tank level | BLE read opcode / IoT `status` field |
| `..._remind`, `tv_...` | **UI string / derived presentation** | `tv_water_tank_empty_remind` | UI layer, derived from a reading/status — not transmitted |

## Where status actually comes from

The app resolves status through one of four layers, in roughly this order:

1. **Cloud device list / detail / deviceExt / thing-model status.** The device-list response
   is deserialized straight into a `*DeviceListStatus` / `*Status` bean. No command builder
   is involved.
2. **Per-family status bean fed by an IoT `status`/`devStatus`/`op` message.** The generic
   `LastData` DTO (`com/govee/base2newth/deviceitem/LastData.java`) is the TH example
   (`tem`, `hum`, `pm`, `co2`, `signal`, `online`, `gwonline`, `lastTime`).
3. **BLE status/notify frame.** E.g. `DeviceStatusNotifyParse` (cmdType `0x40`, 10-byte
   payload) or a family parser (`CmdStatusParseV1`, `H8150Repository`).
4. **Capability metadata / SKU support tables.** Fields may be *declared* for a SKU even
   when the split has no dedicated parser; presence in `pact/Ext` or a support table is not
   proof of a wire field.

## Specific properties

### `waterShortageOnOff` — setting, not status

`waterShortageOnOff` is the **push-notification enable switch** for the water-shortage
condition. It is a user preference stored in the pact `Ext` object and updated through a
REST request. It is not a status reading and not a BLE opcode.

| Evidence | Path |
|---|---|
| REST request body `{sku, device, waterShortageOnOff}` | `jadx-splits/split_pact_humidifier/sources/com/govee/h7142/net/DeviceWaterShortageSwitchRequest.java` (also h7140/h7141/h7143/h7145) |
| Pact ext field | `jadx-splits/split_pact_humidifier/sources/com/govee/h7142/pact/Ext.java` (`private int waterShortageOnOff`) |
| Generic base bean | `jadx-base-7.7.10/sources/com/govee/base_h71xx/network/bean/WaterStorageOnOffInfo.java` |
| Ice-machine bind ext | `.../split_pact_iceMachine/sources/com/govee/ice/h8121/pact/H8121BindExt.java` and h8120/h8131/h8150 equivalents |
| H5901 settings ext | `.../split_pact_h5901/sources/com/govee/h5901/pact/Ext.java` |
| H7172 settings ext | `.../split_pact_h7172/sources/com/govee/h7172/pact/Ext.java` |

Reading it as "the device currently has no water" is wrong: value `1` means "notify me when
water is short", not "water is short".

### `waterLack` / `WATER_LACK` — status flag

`waterLack` is a **status bit/state code**, produced by firmware and delivered either in a
status frame or in the cloud device-list status. It has no dedicated command.

| Device | Carrier | Exact location |
|---|---|---|
| H8131 | `H8131DeviceListStatus` (device-list status bean) | `waterLack` = `bytes[2] & 0x01`; see `Companion.a(int[])` |
| H8150 | `H8150RunStateInfo` (run-state bean) | `isWaterLack` = flag byte bit 4 of the run-state frame (`0x19`), `[5] & 0x10` |
| H8120 | `H8120DeviceState` enum | `WATER_LACK` = code `3` in status frame `0x17` |
| H8121 | `H8121DeviceState` enum | `WATER_LACK` = code `6` in status frame `0x17` |
| Generic | `BleUtil.parseBleBroadTankState(scanRecord)` | BLE broadcast advert, returns `[valid, tankState]` |

Sources:

- `jadx-splits/split_pact_iceMachine/sources/com/govee/ice/h8131/bean/H8131DeviceListStatus.java`
- `.../h8150/bean/H8150RunStateInfo.java`, `.../h8150/bean/H8150State.java`
- `.../h8120/bean/H8120DeviceState.java`, `.../h8121/bean/H8121DeviceState.java`
- `jadx-base-7.7.10/sources/com/govee/base2home/pact/BleUtil.java` (`parseBleBroadTankState`)

The H8131 status bean is worth spelling out because it multiplexes a lot of flags into
three bytes (see `Companion.a(int[] bytes)`):

| Byte | Bits | Field |
|---|---|---|
| `bytes[0]` | bits 1–4 | `runState` (`((b0 & 0xFF) >> 1) & 0x0F`) |
| `bytes[0]` | bit 5 | `e2` |
| `bytes[0]` | bit 6 | `iceMakingInterrupted` |
| `bytes[0]` | bit 7 | `compressorTempHigh` |
| `bytes[1]` | bit 0 | `envTempHigh` |
| `bytes[1]` | bit 1 | `envTempLow` |
| `bytes[1]` | bit 2 | `waterTempHigh` |
| `bytes[1]` | bit 3 | `pumpAbort` |
| `bytes[1]` | bit 4 | `e1` |
| `bytes[1]` | bit 5 | `compressorStopProtection` |
| `bytes[1]` | bit 6 | `outerTankLow` |
| `bytes[1]` | bit 7 | `iceFull` |
| `bytes[2]` | bit 0 | `waterLack` |
| `bytes[2]` | bit 1 | `doorNotClosed` |
| `bytes[2]` | bit 2 | `doNotDisturb` |
| `bytes[2]` | bit 3 | `toClean` |
| `bytes[2]` | bit 4 | `cleanCompleteReminder` |
| `bytes[2]` | bit 5 | `lastCleanIncomplete` |
| `bytes[2]` | bit 6 | `midTankSensorStuck` |
| `bytes[2]` | bit 7 | `lowerTankWaterHigh` |

### `tankEmpty` — UI-derived, not a code property

There is **no `tankEmpty` field** in the decompiled code. The only match is the layout/string
id `tv_water_tank_empty_remind`, used by the humidifier header:

- `.../split_pact_humidifier/sources/com/govee/h7141/adjust/header/CurHeaderUI.java`
- `.../split_pact_humidifier/sources/com/govee/h7142/adjust/header/CurHeaderUI.java`
- `.../split_pact_humidifier/sources/com/govee/humidifier/R.java`
  (`tv_water_tank_empty_remind`)

The humidifier's actual water reading is `WaterBean`:

```java
// h7145/adjust/bean/WaterBean.java
private int waterVield;        // tank level, percent (LITTER_WATER = 10 -> 10% = 1 L on 10 L)
private int enduranceMinute;   // estimated remaining minutes
```

It is read by `WaterVieldController` (BLE cmdType `0x22` = 34) and by the IoT status parser
(`h7145/iot/CmdStatusParseV1`, frame cmd `34`). "Tank empty" is a UI condition derived from
that level/endurance (or a warning state), not a boolean sent by the device.

### Other flags in the same family

| Property | Kind | Carrier |
|---|---|---|
| `iceFull` | status | H8131 `bytes[1] & 0x80`; H8120 state code 2; H8121 state code 4 |
| `outerTankLow` | status | H8131 `bytes[1] & 0x40` |
| `lowerTankWaterHigh` | status | H8131 `bytes[2] & 0x80` |
| `midTankSensorStuck` | status | H8131 `bytes[2] & 0x40` |
| `doorNotClosed` / `isLidOpen` | status | H8131 `bytes[2] & 0x02`; H8150 run-state flag bit 7 |
| `doNotDisturb` | status | H8131 `bytes[2] & 0x04`; plus the shared `0x16` DND command |
| `toClean` | status | H8131 `bytes[2] & 0x08` |
| `waterTempHigh` | status | H8131 `bytes[1] & 0x04` |

## Grep recipes used to verify

```bash
base=/Users/tglenn/src/govee/decompiled/jadx-base-7.7.10/sources
splits=/Users/tglenn/src/govee/decompiled/jadx-splits

# status DTO / device-list models
grep -rn -i 'DeviceListStatus\|LastData\|DeviceExt\|devStatus' "$base" "$splits" --include='*.java' | head

# per-family status parsers
grep -rn -i 'CmdStatusParse\|StatusBean\|Abnormal\|Remind' "$splits" --include='*.java' | head

# the property itself
grep -rn -i 'waterShortage\|waterLack\|tankEmpty\|outerTankLow' "$base" "$splits" --include='*.java'

# capability / settings metadata
grep -rn -i 'waterShortageOnOff' "$splits" --include='*.java'
```

## What was changed in this collection

- `waterShortageOnOff` remains documented as a **setting** under each family's
  "other protocols / settings ext", with an explicit "not status" note.
- `waterLack` / `WATER_LACK` and the other ice-machine flags are documented under
  **readings/status** (`READINGS.md`, `splits/split_pact_iceMachine.md`), not in the BLE
  command tables.
- `tankEmpty` is documented here as a **UI-derived** condition; the real humidifier reading
  is `WaterBean.waterVield` / `enduranceMinute`.
- No `waterShortage` (bare) property exists in the app; only `waterShortageOnOff`.
