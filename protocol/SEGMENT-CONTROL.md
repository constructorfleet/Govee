# LED strip segment colors and per-segment brightness

This is the focused index for addressable-strip control: which byte selects which
segments, how per-segment color differs from per-segment brightness, and which families
use which layout.

All payloads are after the 20-byte BLE header and after the `0x05` mode command type
unless noted. The read form is `0xAA/0x05` with the same sub-mode as byte 0.

## 1. The three different "segment" operations

| Operation | What it does | Typical payload |
|---|---|---|
| **Segment color** | set one RGB/CT color on the segments selected by a bitmask | `15 01 R G B [kelvin] [R2 G2 B2] mask...` |
| **Group brightness** | set one brightness level on the segments selected by a bitmask | `15 02 brightness mask...` |
| **Per-segment brightness** | a list of brightness values, one per segment | `15 03 b0 b1 ... bN` |
| **Group color** | a color per group/zone (not per individual LED) | `15 04 group R G B ...` |
| **Realtime segment color** | music/mic pushes color per segment in a multi-frame stream | `A3 41 ...` / `33 83 R G B` |

Do not confuse a **mask** (which segments) with a **brightness list** (a value per
segment). Many families support both; some only support the mask form.

## 2. Standard `0x15` subtypes

`33 05 15 <subtype> ...`

| Subtype | Layout | Meaning |
|---|---|---|
| `01` | `01 R G B [kHi kLo R2 G2 B2] m0..mN` | one color (and optional color temperature + temp RGB) on the masked segments |
| `02` | `02 brightness m0..mN` | same brightness for all masked segments |
| `03` | `03 B0 B1 ... BN` | per-segment brightness list (some families use this for a raw RGB list) |
| `04` | `04 group R G B ...` | group/zone colors, typically 4 colors per packet |
| `05` | `05 R G B ... mask...` | multi-color block (H601EF advanced sub-effects) |
| `00` | `00 ...` | clear/op-type form on newer H6602/H6604 |

Mask bits are **LSB-first**: bit 0 = first segment, bit 7 = segment 7, then the next mask
byte. Unused high bits are written as zero. The mask width depends on the family: 1 byte
(up to 8 segments), 2 bytes (16), 3 bytes (24), 4 bytes (32), 5 bytes (40), up to 10
bytes (80) for legacy bulb strings.

Kelvin endianness is **not universal**: H6079/H6020 and some H60B1 variants use big-endian
`kHi kLo`; most other `0x15` families use little-endian `kLo kHi`. The exact source
class is cited in the per-family table below.

## 3. Legacy `0x0B` / `0x0D`

- `0B R G B maskLo maskHi ...` — older RGB + bitmask color, used by H6104, tvlightv2,
  rgbiclight V1, bulb strings (up to 80 bits = 10 mask bytes).
- `0D R G B kLo kHi R2 G2 B2` — single-group color/CT with no per-segment mask, used by
  H7040 and some car/home lights.
- `14 R G B CT_H CT_L R2 G2 B2 00 mask` — older straight-floor-lamp color with a mask.

## 4. Group/zonal reads and realtime pushes

| Command | Layout | Meaning |
|---|---|---|
| `0xAA/0xA5` | request `[groupIndex]`; reply `[idx][brightness][R][G][B] ×4` | read bulb/string color groups (17 valid bytes) |
| `0xA3/0x41` | `41 <musicEffect> <count> <R G B> ×count` | realtime segment colors, multi-packet |
| `0x33/0x83` | `83 R G B` | mic/realtime segment color |
| `0x33/0xAE` | `01 <4|6> v0 v1 v2 v3 [v4 v5]` | relative/segment brightness (4- or 6-segment model) |

## 5. Per-family segment capabilities

| Split / family | Segments | Color / mask | Per-segment brightness | Notes |
|---|---:|---|---|---|
| `h6079` H6079/H607C/H16B0 | 13/14/17 | `15 01` RGB + BE kelvin + temp RGB + 16-bit mask | `15 03 B0..Bn` (≤15) | group read `AA A5` |
| `h6079` H6020/H1741 | 8 | `15 01` RGB + BE kelvin + mask (7 bytes written, only m0 effective) | `15 03` | see h6079 split §4 |
| `rgbiclight` V1 / H6104 | 15 | `0B R G B m0 m1` | — | legacy 15-bit mask |
| `rgbiclight` V2/V3 | 6/7/8/15 | `15 01` RGB + LE kelvin + temp RGB + mask | `15 02` group, `15 03` raw RGB list | V2 brightness mask |
| `tvlightv2` | 15 | `0B` mask2; `15 01` mask0+mask8 | `15 02` / `15 03` | 12-byte form |
| `tvlightv3/v4` | 12 | `15 01` mask0/1 | `15 02` brightness, `15 03` raw RGB | 17-byte buffer |
| `h604a` | 24 | `15 01` mask2/3 | `15 02` | 24 bulbs, 14-bulb groups |
| `h6047` | 10/12/22/24 | `15 01` selected-segment mask; `15 02` group mask | group brightness | multi-frame `A3 V1` |
| `h6061` | 20/21/23/25/40/140 | `15 01` RGB + mask | `15 03` max 14 values/packet | 40-bit declared |
| `h6062` | 33 | `15 01` 5-byte mask | `15 03` 14 brightness bytes | H610A/B compact V2/V3 |
| `h6099` H605B/H605C | 24/14 | `15 01` mask2/3 | `15 02` | op-type 0..7 |
| `h6099` H6601/H6603 | 24 | `15 01` mask3 | `15 02` | 24-segment |
| `h6099` H6602/H6604 | 14 | `15 01` mask2, `15 00` clear | `15 02 bri mask2`, `15 03 group bri`, `15 04 group RGB` | op-type 0..7 |
| `h6099` H6608 | 30 | `15 01` mask3 | `15 02` | 30 segments |
| `h6099` H6099/H6097 | 14/24 | `15 01` mask2/3 | `15 02`, `15 03`, `15 04` | H6097 24 |
| `h61d3` | 32 | `15 01` mask4 | `15 02` brightness + mask | lighting-recognition family |
| `h6840` H6609 | 2/3-byte mask | `15 <opType>` | per-group brightness/RGB | opTypes 0,1,2,3,6,7 |
| `h7050` | 4/6-byte mask | `15 01` RGB + CT + mask | `15 03 bri0..briN` (0–100) | `15 02` color index |
| `h705a` | up to 40 | `15 01` 5-byte mask | `15 02` + group brightness | |
| `h7075` | up to 32 | `15 01` mask4 | `15 03` 14 brightness bytes | group RGB `15 04` |
| `h70b1` H70DX | 10 | `15 01` mask2 | `15 02` / `15 03` | H70B1/B2 use `0D` |
| `fanlight` H1310/H1370 | 9/14 | `15 01` 32-bit mask | group/per-segment RGB | color ring |
| `hollowlamp` | 3/7/8 | `0B`/`14`/`15` | `15 02` / `15 03` | straight floor lamp |
| `outdoorlight` H7040 | 1 group | `0D R G B CT R2 G2 B2` | — | no mask |
| `outdoorlight` H7056 | 8 | `15 01` mask0..3 | `15 02`, `15 03` | |
| `outdoorlight` H7080 | 4/8/6 | `15 01` mask0 | `15 02`, `15 03` raw | by goodsType |
| `outdoorlight` H7086 | 4 | `15 01` mask0..3 | `15 02` | |
| `pfdv1` H7001/H7023 | 24 | `08 m0 m1 m2 R G B 00` | — | 24-bit mask |
| `pfdv1` H7024 | 24 | `0B R G B m0 m1 m2 00` | — | RGB first |
| `h3a5x` | 32 | `15 01` 32-bit mask | `15 02`, `15 03` | graffiti pages/layers |
| `h60ax` | 14 groups | `15 <op>` | op 0 brightness, op 6 14-byte brightness group | op 7 4×RGB |
| `h601ef` | groups | `15 04 segIdx R G B ×4`, `15 05 count RGB...` | per-color piece | multi `A3/6E` |

## 6. Readback and segment metadata

- `0xAA/0x40` — IC / segment count and style (`ReadSegInfoController`, h3a5x) or IC count.
- `0xAA/0x41` — IC segment number (`IcSegmentNumController`).
- `0xAA/0xA5` — bulb/string color groups: `[idx][brightness][R][G][B] ×4`.
- `0xAA/0x05` — mode readback; `[0]` = sub-mode (`15` for extended color).
- `0xEE/0x40` — notify after segment/IC setting on some families.

## 7. Encoding rules and caveats

- Mask bits are **little-endian bit order** (bit 0 = segment 0); mask bytes are written
  low-to-high.
- A `15 02` packet sets **one brightness** for all segments in the mask. A `15 03` packet
  carries a **value per segment** (usually 14 values per packet, clamped to the physical
  count).
- `15 03` is overloaded: on tvlight/outdoor H7056/H7080 it is a **raw RGB list**, not
  brightness. Check the family table above.
- Long per-segment arrays are split across multiple `0xA3` V1 frames; the final frame
  carries the `0x05/0x15` mode frame. Chunk sizes differ per family.
- Masks wider than the physical segment count are zero-padded; some older firmware only
  honors the first mask byte (e.g. H6020/H1741).
- Kelvin byte order varies (BE for h6079/h6020; LE for most others). Always use the
  family's `SubModeColor*` class.
- `15 04` sets group/zone colors (4 RGB per packet), not per-LED colors. `15 01` with a
  mask is the per-segment color form.

## 8. Where the raw rows are

- Every layout above is in `EFFECTS.md` under the family name.
- The write/read commands and source paths are in `COMMANDS.md` and the per-split
  `splits/split_pact_*.md`.
- The canonical source classes are the family `ble/SubModeColor*.java`,
  `ble/Mode*.java`, `ble/ColorStrip*.java`, and base `SubMode4Color` / `Bytes` /
  `ColorModeControllerConfig`.
