# The `0x05` mode container: one command, many modes

The lighting protocols do not use a different opcode for scenes, DIY, music and colour.
They all travel in `cmdType 0x05` as **one tagged envelope**, and the first payload byte
says which mode is inside. The same envelope is used for commands and for read-back
state, so a mode read is decoded by the same dispatcher that serialises a mode write.

## Wire shape

A BLE frame is 20 bytes: `[0]=proType [1]=cmdType [2..18]=payload [19]=BCC`
(see `_REFERENCE.md`). For the mode container:

| Direction | proType | cmdType | payload | Meaning |
|---|---|---|---|---|
| Write | `33` | `05` | `[subMode][body…]` | set the active mode |
| Read request | `AA` | `05` | `01` | query the active mode |
| Read response / notify | `AA` | `05` | `[subMode][body…]` | current mode state |

`cmdType` is always `0x05`; only `proType` distinguishes write from read. Payload byte 0
is the **sub-mode tag** (`subModeCommandType()`), and bytes 1.. are that sub-mode's
schema. There is no separate "get mode state" opcode: a read request and its response
share the same `AA/05` opcode, and only the payload differs (`01` vs `tag…`).

Examples:

```text
scene, effect 0x07EE:     33 05 04 EE 07 ...            (tag 04)
read request:             AA 05 01 00 ...                (fixed payload)
read response:            AA 05 04 EE 07 ...            (tag 04 + effect)
colour/CT, tag 0x15:      33 05 15 01 R G B kH kL ...   (tag 15, subtype 01)
```

The read request is **always `01`**, regardless of which mode is being queried. The
response's tag, not the request, identifies the active mode.

## How the code implements it

The base classes are in
`decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/`.

1. `AbsModeController` fixes the command type and supplies the read query:

   ```java
   // AbsModeController.java:34
   public byte getCommandType() { return (byte) 5; }

   // AbsModeController.java:39
   public byte[] p() { return new byte[]{1}; }

   // AbsModeController.java:55
   public byte[] q() { return this.f55479f.getWriteBytes(); }
   ```

   `p()` is used only by the read frame builder, `q()` only by the write builder.

2. `AbsSingleController` chooses the direction and builds the frame:

   ```java
   // AbsSingleController.java:20 and :25
   public byte[] f() { return BleUtils.generate20Bytes(getProType(), getCommandType(), p()); }
   public byte[] g() { return BleUtils.generate20Bytes(getProType(), getCommandType(), q()); }

   // AbsSingleController.java:30
   public byte getProType() { return isWrite() ? (byte) 51 : (byte) -86; }
   // 51 = 0x33, -86 = 0xAA
   ```

3. `AbsMode` treats byte 0 as the tag and delegates the rest:

   ```java
   // AbsMode.java:17
   public void parse(byte[] validBytes) {
       byte b7 = validBytes[0];
       int length = validBytes.length - 1;
       byte[] bArr = new byte[length];
       System.arraycopy(validBytes, 1, bArr, 0, length);
       parseSubMode(b7, bArr);
   }
   ```

   `parseSubMode(byte subModeType, byte[] subModeValidBytes)` is the family-specific
   dispatcher. `ISubMode.subModeCommandType()` is the tag contract.

4. On a read response, `AbsSingleController.m(value)` copies `value[2..]` into a 17-byte
   buffer and calls `parseValidBytes`, so `validBytes[0]` is the tag. On a write
   acknowledgement it copies `value[3..]` and calls `s(...)`/`r(...)` instead; **the
   write ack is not parsed as mode state**. State is learned from the `AA 05` read
   response (or an equivalent notification), not from the command echo.

5. The constructors make the same class do both jobs:

   ```java
   // AbsModeController.java:12 and :23
   public AbsModeController()        { super(false); ... }  // read
   public AbsModeController(AbsMode) { super(true);  ... }  // write
   ```

   Thus `new ModeController()` polls state and `new ModeController(mode)` sends a mode.
   For example, `h6159/ble/BleReadManager.java` includes `new ModeController()` in the
   normal read-controller list.

## State model

`AbsMode` has exactly **one** `subMode` field (`ISubMode subMode`). Every parse replaces
it with a new sub-mode object. Modes are therefore mutually exclusive states, not
additive flags: a device is in scenes *or* DIY *or* music *or* colour, and the tag says
which.

This is the pattern in one sentence:

> `0x05` is a discriminated union: `[tag][variant body]`, with the same tag used for the
> write command and for the read-back state, and a constant `01` read query.

## Sub-mode tags seen across families

| Tag | Meaning | Families verified |
|---|---|---|
| `0x04` | scene / effect selector | h6079, h60b0, hollowlamp |
| `0x0A` | new DIY selector | h6079, h60b0, hollowlamp |
| `0x0D` | colour + colour temperature | h60b0, hollowlamp |
| `0x0E` | legacy music | hollowlamp |
| `0x0F` | music V2 | hollowlamp |
| `0x13` | music V3 | h6079, h60b0, hollowlamp |
| `0x15` | segmented colour V2 (nested subtypes) | h6071, h6079, h60b1 |

The tag vocabulary is shared but not absolute: colour uses `0x0D` in some families and
`0x15` in others, and older music uses `0x0E`/`0x0F`. The *envelope* is the invariant;
the tag set is per family.

`0x15` is itself a nested discriminator: its body byte 0 selects the colour operation
(`01` RGB/CT/mask, `02` brightness on the masked segments, `03` per-segment brightness,
`04` group colour, and family-specific extras). See `SEGMENT-CONTROL.md` for that inner
schema.

## Scope and exceptions

- The pattern describes the **lighting mode controller** (`AbsModeController` /
  `AbsMode`). Other families reuse `cmdType 0x05` for unrelated state — for example
  `split_pact_h7130` gear and `split_pact_h7172` ice size — so "opcode `0x05`" alone is
  not proof of a lighting mode. Trace the controller class before applying the tag table.
- Some effect/segment operations use multi-packet paths (`0xA3`/`0xA5`, `ptReal`
  streams). Those carry pixel or layer data, not a single `0x05` mode frame, and are
  documented separately.
- A write may be split across packets for long payloads; the final packet still carries
  the `33 05 [tag]…` mode frame.

## Payload-notation caveat

This document counts payload bytes **after** `proType` and `cmdType`, matching the code
(`q()` returns the sub-mode bytes only). The `Payload` column in `COMMANDS.md` starts one
byte earlier, at the command type: brightness is shown as `04 <level>` and a mode row as:

```text
scene:  payload "05 04 <effLo> <effHi> <speed>"
```

The leading `05` there is the command type, not a second sub-mode byte. The actual frame
is `33 05 04 …`, not `33 05 05 04 …`. `EFFECTS.md` already uses the tag-first form
(`04 <effLo> <effHi>`). If you replay a captured frame, strip the first byte from the
`COMMANDS.md` payload before comparing it with `q()` or with the bytes after
`proType`/`cmdType`.

## Reproducing the evidence

```bash
# tag contract and dispatch
grep -n "subModeCommandType\|parseSubMode" \
  decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/AbsMode.java

# fixed read query and command type
grep -n "getCommandType\|return new byte\[\]{1}\|getWriteBytes" \
  decompiled/jadx-base-7.7.10/sources/com/govee/base2light/ble/controller/AbsModeController.java

# a concrete family dispatcher and its tags
grep -n "parseSubMode\|b2 ==" decompiled/jadx-splits/split_pact_h6079/sources/com/govee/h6079/ble/Mode.java
grep -rn "subModeCommandType" decompiled/jadx-splits/split_pact_h6079/sources/com/govee/h6079/ble/SubMode*.java

# read polling includes a mode controller
grep -n "ModeController" decompiled/jadx-splits/split_pact_rgblight/sources/com/govee/h6159/ble/BleReadManager.java
```
