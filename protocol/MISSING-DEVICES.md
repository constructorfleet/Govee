# Known missing devices / dynamic modules

These devices are referenced by the Govee Home app but are **not present** in the
downloaded 7.7.10 / 7.7.21 bundles, so their command tables could not be extracted.

## H7184 — Kitchen Composter (GoveeLife)

| Item | Value |
|---|---|
| SKU | **H7184** |
| Product | Smart Kitchen Composter (electric, 3.0 L / 3.2 qt, 550 W) |
| goodsType | **208** (`KmpGoodsType.GOODS_TYPE_VALUE_H7184`) |
| Module | **`pact_h7184`** |
| Module entry point | `com.govee.h7184.H7184ModuleInitImp` |
| Delivery | Play Feature Delivery (PFD) dynamic module — downloaded on demand |
| Routes | `/h7184/detail`, `/h7184/guide` |
| Notification channel | `govee.nc.v1.composter` (`notification_channel_composter`) |
| Transports | BLE + Wi-Fi/Bluetooth per the product manual; app module would define both |

### Why it's missing

`base2home/pfd/Config.java` registers goodsType **208** → `pact_h7184` with
`makePfd4GoodsType(..., "pact_h7184", "com.govee.h7184.H7184ModuleInitImp", true, false, ...)`.
The module is a **dynamic feature**, and neither the APKMirror 7.7.10 nor 7.7.21 bundle
contains `split_pact_h7184.apk` (the 7.7.21 bundle has 45 device modules, but not this
one). Govee Home **5.6.20** (2023-05) predates the product and has no `h7184` classes.
The 7.7.10 base still contains the scaffold: routes, DB tables, notification channel,
timer/mode labels, and automation actions, but not the BLE/cloud command builders.

### What the base app tells us

Modes (timer support, `base_h71xx/sku_base/adjust/component/TimerSupport.java`):

| Mode id | Meaning |
|---|---|
| `1000` | Kitchen waste / Composting |
| `2000` | Storage |

Documented modes in the product manual: **Composting**, **Storage**, **Clean**.
A composting cycle takes about **7 hours**; the device has a weight sensor, an activated
carbon filter, RGB light, voice announcements, and protections for jam, overheat, NTC
failure, heating failure and lid-open.

Automation triggers (`eco/executeAction/data/EcologyKitchenCons.java`):

| Trigger id | Meaning |
|---|---|
| `145` | Composting finished |
| `146` | Clean finished |
| `148` | Caton / jam |
| `149` | Low temperature |
| `152` | Carbon filter low |

UI/DB scaffold:

- `H7184ChartTable` / `H7184ChartDao` — waste processed / compost produced history.
- `h7184_chart_average` “Average waste processed/Average compost produced”.
- `h7184_carbon_life_sum_illustrate` — cumulative hours in Composting + Storage modes.
- `h7184_weight_few_content` — minimum waste weight warning.
- `h7184_timer_mode_hint` — ~7 h composting cycle.

The actual command opcodes/payloads live in the missing `pact_h7184` module. They are
likely built on the shared `base_h71xx` appliance protocol used by the heater/humidifier/
kettle families (write proType `0x3A`, read `0xAA`, 20-byte frames), but that is **not
confirmed** without the module.

### How to obtain it

- Capture the on-demand PFD split from a device/account where H7184 has been added
  (`split_pact_h7184.apk`), or
- Find a Govee Home build/region whose bundle includes `split_pact_h7184`, or
- Extract the command definitions from an H7184 firmware OTA.

Until then it should be treated as **known and intentionally uncatalogued**, not as a
generic appliance covered by another split.

## H8102 — Smart Frozen Dessert Maker (ice cream / frozen treats)

| Item | Value |
|---|---|
| SKU | **H8102** |
| Product | Smart frozen dessert maker — ice cream, bars, cubes, sorbet, yogurt bark, rolls |
| goodsType | **335** |
| Module | **`pact_iceFood`** |
| Module entry point | `com.govee.icefood.IceFoodModuleInitImp` |
| Delivery | Play Feature Delivery (PFD) dynamic module |
| Route | `/iceFood/H8102Detail` |

This is **not** the H812x nugget-ice family; it is a frozen-dessert/ice-cream maker.
`Config.java` maps goodsType 335 → `pact_iceFood`, and the bundle does not contain
`split_pact_iceFood.apk`, so the command table is unavailable.

Base-app evidence:

- Modes: Ice Cream, Ice Cream Bars, Cream Cubes, Flavored Ice, Fruit Bars, Slush/Sorbet,
  Yogurt Bark, Ice Cream Roll, Defrost, Freezing.
- AI recipe generation (`h8102_mode_ai_cook_book`), ingredient/allergen/sweetness
  configuration, pre-cooling durations, anti-mistouch mode, buzzer volume.
- `ModeActionParserH8102` sends a mode frame via `CmdPtReal`/`CmdMultiSync` using
  `BleProtocolConstants.d0()`; the rest of the protocol lives in `pact_iceFood`.
- DB: `H8102ChartTable` / `H8102ChartDao` / `H8102Database`.
- Automation config keyed by goodsType 335 (`EcologyKitchenCons.b()`).

## H5054 — legacy gateway leak sensor (folded into base gateway)

| Item | Value |
|---|---|
| SKU | **H5054** |
| Product | Legacy leak/water sensor behind the H5040 gateway |
| Location | `com/govee/gateway` in the base app (not a `pact_*` split) |
| BLE | Not direct — `SkuH5054.needBle() == false`; gateway sub-device |
| Pairing | `AddInfo.makeAddInfo4Pair(..., 32, 64, ..., 8200)` via `PairAc` |
| Warning transport | REST `GateWayLeakWarnRequest` / `GateWayLeakWarnLiftedRequest`; push `H5054Msg` |
| Data | `H5054Data{message,read,time}`, `H5054Msg{sku,device,type,message,warnTime,...}` |

It predates the `pact_leaknew` split (H5058/H5059/H5830). It is covered by the base gateway
UI and cloud warning APIs rather than a dedicated device-protocol module, so it has no
separate BLE command table here.

## Folded / aliased families (present, but not separate family entries)

| Type | Where it lives | Notes |
|---|---|---|
| **H5054** legacy leak sensor | base `com/govee/gateway` | see above; no split |
| **H5106** air-quality monitor | `split_pact_thnew` (goodsType 124) | PM2.5 + TH; `H5106ThBroadParseImp`, `parseThpValue` |
| **H5140** CO2 sensor | `split_pact_thnew` (goodsType 319) | CO2 + TH; `H5140ThBroadParseImp`, CO2 0–5000 ppm |
| **H7150–H7153** dehumidifiers | `split_pact_humidifier` (goodsType 94/147/308/309) | source strings call them Smart Dehumidifier / Max |
| **H7161/H7162** aroma diffusers | `split_pact_humidifier` (goodsType 146/189) | Aroma Diffuser Pro / Smart Aroma Diffuser |
| **H7184** composter | missing `pact_h7184` | see above |
| **H8102** frozen-dessert maker | missing `pact_iceFood` | see above |

## Coverage note

The 45 extracted modules cover 607 unique SKUs. H7184 and H8102 are the two devices
explicitly registered in `Config.java` whose split modules are absent from the bundles.
Other base-only families (H5054, gateways/sub-devices) are covered through the base app
or their parent split.
