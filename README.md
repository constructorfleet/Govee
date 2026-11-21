# Govee Home — APK download & decompilation

Package: `com.govee.home` (Govee Home, by Govee / Shenzhen Ihoment)
Source: APKMirror (https://www.apkmirror.com/apk/govee/govee-home/)
Date downloaded: 2026-11-21

## TL;DR

| What | Version | Status |
|---|---|---|
| Latest APK bundle | **7.7.21** (versionCode 1149, 2026-11-12) | Downloaded & extracted; **base DEX is packed** (Virbox Protector) |
| Newest *unpacked* build | **7.7.10** (versionCode 1142, 2026-10-28) | Downloaded & fully decompiled to Java |

The base `classes.dex` of Govee Home 7.7.11 and newer is protected with **Virbox
Protector**, so static decompilation of the main app code only yields the 4-class
loader stub. The **7.7.10** build is the newest release published *before* the
protector was enabled, and its full ~36k-class code base decompiles cleanly. Both
versions are provided because the 7.7.21 bundle carries 56 split APKs, including 44
`pact_*` device-protocol modules with plain, fully decompilable DEX, while 7.7.10
ships only 4 `pact_*` modules.

## Interactive protocol atlas

The `protocol/` collection has a static search/filter site in `site/`.

Planned live URL: **https://constructorfleet.github.io/Govee/** (after Pages is enabled).

Features:

- global command palette (`⌘K` / `Ctrl+K` / `/`)
- Devices, Commands, Effects, Readings, Status and Docs tabs
- filters by transport, split module, sub-mode and free text
- detail drawer with payload, layout, response, source and copy buttons
- **Try it out** builder for BLE frames and IoT MQTT envelopes, with generated controls
- transport wrappers (`ptReal`, `multiSync`, …) separated from actual commands
- Markdown deep-dive viewer

```bash
cd site
npm install
npm run dev      # local
npm run build    # dist/
```

The GitHub Actions workflow at `.github/workflows/pages.yml` builds and deploys `dist/`
to GitHub Pages on every push to `main`. Enable **Settings → Pages → Source: GitHub
Actions** once in the repository.

The large APKs, extracted APKs and decompiled trees are intentionally `.gitignore`d; the
repository carries the `protocol/` data/docs, scripts, site and workflow. The H7184/H8102
dynamic modules are documented as missing in `protocol/MISSING-DEVICES.md`.

## Files

```
govee_7.7.21.apkm                 172,768,413 B  sha256 8b32a5bc1480…23c76   (APK bundle: base + 56 splits)
govee_7.7.10.apkm                 110,430,991 B  sha256 25b1319010fc…e2d73   (APK bundle: base + 14 splits)
apkm/                             extracted contents of 7.7.21 (base.apk, 56 split APKs, info.json, icon)
apkm700/                          extracted contents of 7.7.10
decompiled/
├── jadx-base-7.7.10/             Java source of the full 7.7.10 base app (48,989 .java files)
├── apktool-base-7.7.10/          decoded manifest, res/, assets/, smali, original/ for 7.7.10
├── jadx-splits-7.7.10/           Java source of the 5 code-bearing split modules shipped in 7.7.10
├── jadx-splits/                  Java source of the 46 code-bearing split modules in 7.7.21
│                                 (44 pact_* + lib_recognition + pfdv1, 24,425 .java files)
├── jadx-base-7.7.21-stub/        only the Virbox loader stub (4 classes) + generated R.java
└── apktool-base-7.7.21/          decoded manifest/res/assets of 7.7.21 (base only)
scripts/
├── probe_version.py              re-fetch a specific version from APKMirror (bundles + packing check)
└── decompile_splits.sh           batch jadx the split modules
```

Tooling used: `jadx 1.5.5`, `apktool 3.0.3`, `Temurin JDK 17/27`.

## Where to look in the decompiled code

- `decompiled/jadx-base-7.7.10/sources/com/govee/…` — 22,254 files, the app itself
  (activities, BLE/Wi-Fi cloud protocol, scene engine, account, firmware OTA, etc.).
  Entry point: `com/govee/home/HomeActivity.java`, `com/ihoment/base2app/BaseApplication.java`.
- `decompiled/jadx-splits/split_pact_<name>/sources/com/govee/…` — per-product-family
  code: BLE command builders, scene/DIY handling, device-specific UI. Examples:
  - `split_pact_rgblight`, `split_pact_rgbiclight`, `split_pact_bulblightstringv1`,
    `split_pact_outdoorlight`, `split_pact_tvlightv4`, `split_pact_floorlamp`,
    `split_pact_hollowlamp`, `split_pact_fanlight` — lighting families
  - `split_pact_humidifier`, `split_pact_iceMachine`, `split_pact_bbqnew` — appliances
  - `split_pact_security_health` — sensors/health
  - `split_pact_plugnew`, `split_pact_plugv1`, `split_pact_tcsocket` — plugs
  - `split_pact_h60ax`, `h6079`, `h6099`, `h6840`, `h7050`, `h70b1`, `h7130`, `h7170`, … — per-SKU
  - `split_pfdv1`, `split_lib_recognition` — shared recognition/vision helpers
- Handy searches:

```bash
# all BLE command builders
grep -rl "CmdBuilder" decompiled/jadx-splits --include='*.java' | head

# cloud API endpoints / hosts
grep -rhoE 'https://[a-z0-9.-]+' decompiled/jadx-base-7.7.10/sources/com/govee | sort -u | head -30

# manifest of the current APK
less decompiled/apktool-base-7.7.21/AndroidManifest.xml
```

## Collated device protocols

The `pact_*` modules' BLE/IoT commands and readings have been extracted and collated in
[`protocol/`](protocol/README.md):

- `protocol/PROTOCOLS.md` — framing, transport taxonomy, family map, gaps
- `protocol/COMMANDS.md` — every BLE/IoT command with opcode, payload and layout
- `protocol/EFFECTS.md` — dynamic colour/scene/DIY/music/motion payloads
- `protocol/SEGMENT-CONTROL.md` — segment colours, masks and per-segment brightness
- `protocol/DREAMVIEW-HDMI.md` — DreamView/HDMI modes and camera/HDMI settings
- `protocol/ONBOARDING-NETWORK-MATTER.md` — adoption, WiFi provisioning, Matter setup
- `protocol/MISSING-DEVICES.md` — known missing modules, including the H7184 composter
- `protocol/READINGS.md` — notifications, telemetry schemas, status properties
- `protocol/STATUS-PROPERTIES.md` — status flags vs. settings vs. UI-derived properties
- `protocol/DEVICES.md` — all 617 SKUs with transports and pact tuples
- `protocol/data/ALL.json` + CSVs — machine-readable index

## Notes on the packer (7.7.11+)

In 7.7.11, 7.7.20 and 7.7.21 the base APK contains a single `classes.dex` with only
4 classes (233 strings) — `v68ae1757.l68ae1757` (the `Application` class) — plus
`lib/arm64-v8a/libl68ae1757.so`, a **Virbox Protector** runtime. The file header of
the DEX is valid but the class/string tables are bogus; ~33 MB of high-entropy
encrypted payload follows the stub, and the native library decrypts/loads the real
DEX at runtime. The library also contains anti-analysis checks (`/data/adb/modules`,
`/data/adb/zygisk`, `/data/local/tmp/frida-server`, "roteVirbox Protector", etc.).

Consequences:
- `android:name="v68ae1757.l68ae1757"` in the 7.7.21 manifest; the real class names are
  still visible in the manifest (activities/services), which is why the 7.7.10 code
  remains a good guide to 7.7.21 structure.
- Unpacking 7.7.21 statically requires reversing the Virbox VM/native decryptor;
  dynamically it would require a rooted emulator/device (no AVD exists on this machine)
  and would have to defeat the anti-frida checks.
- The split modules (`split_pact_*`, `split_pfdv1`, `split_lib_recognition`) are **not**
  protected — plain DEX, decompiled successfully from the 7.7.21 bundle.

## Caveats

- Both downloads are `.apkm` **bundles** (base + config/feature splits), not single
  installable APKs — Google Play serves them the same way. Installing needs an
  APKM installer (or `adb install-multiple`).
- jadx finished with non-fatal errors on some methods (321 of 36,423 classes in the
  7.7.10 base, a handful in some splits); those methods decompile partially/incorrectly.
- Split-APK *resources* (device icons/layouts) were not run through apktool; only the
  base APK resources were decoded.
