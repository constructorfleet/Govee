#!/usr/bin/env python3
"""Merge the per-split protocol extracts into consolidated index/catalog files."""
import csv
import glob
import json
import os
from collections import Counter, OrderedDict

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
SPLITS = os.path.join(ROOT, "splits")


def load_all():
    out = []
    for path in sorted(glob.glob(os.path.join(DATA, "split_*.json"))):
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
        d["_file"] = os.path.basename(path)
        out.append(d)
    return out


def flatten(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return value.replace("\n", " ").strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def norm_transports(raw):
    ts = []
    for t in raw or []:
        t = str(t).lower().strip()
        if t in ("ble+iot", "ble_iot", "ble/iot"):
            ts.extend(["ble", "iot"])
        elif t == "ble-broadcast":
            ts.append("ble-broadcast")
        elif t in ("wifi/mqtt", "mqtt"):
            ts.append("wifi/mqtt")
        else:
            ts.append(t)
    return sorted(set(ts))


def split_title(d):
    md = os.path.join(SPLITS, (d.get("split") or d["_file"][:-5]) + ".md")
    title = ""
    if os.path.exists(md):
        with open(md, encoding="utf-8") as fh:
            title = fh.readline().lstrip("# ").strip()
    return title


def main():
    splits = load_all()
    splits.sort(key=lambda d: d.get("split", ""))

    devices = []
    commands = []
    effects = []
    readings = []
    status_properties = []

    for d in splits:
        spl = d.get("split") or d["_file"][:-5]
        fam = "; ".join(d.get("families") or [])
        for s in d.get("skus") or []:
            pact = s.get("pact") or {}
            devices.append(OrderedDict([
                ("split", spl),
                ("sku", s.get("sku", "")),
                ("family", s.get("family", "")),
                ("transports", "|".join(norm_transports(s.get("transports")))),
                ("pact_type", pact.get("type")),
                ("pact_code", pact.get("code")),
                ("goods_type", s.get("goods_type", "")),
                ("notes", s.get("notes", "")),
            ]))

        ble = d.get("ble") or {}
        for c in ble.get("commands") or []:
            commands.append(OrderedDict([
                ("split", spl),
                ("families", fam),
                ("transport", "ble"),
                ("name", c.get("name", "")),
                ("op", c.get("op", "")),
                ("payload", c.get("payload", "")),
                ("layout", c.get("layout", "")),
                ("response", c.get("response", "")),
                ("source", c.get("source", "")),
                ("notes", c.get("notes", "")),
            ]))
        for c in ble.get("notifications") or []:
            commands.append(OrderedDict([
                ("split", spl),
                ("families", fam),
                ("transport", "ble-notify"),
                ("name", c.get("name", "")),
                ("op", c.get("op", "")),
                ("payload", c.get("payload", "")),
                ("layout", c.get("layout", "")),
                ("response", c.get("response", "")),
                ("source", c.get("source", "")),
                ("notes", c.get("notes", "")),
            ]))
            readings.append(OrderedDict([
                ("split", spl),
                ("transport", "ble-notify"),
                ("name", c.get("name", "")),
                ("op", c.get("op", "")),
                ("layout", c.get("layout", "")),
                ("source", c.get("source", "")),
            ]))

        iot = d.get("iot") or {}
        for c in iot.get("commands") or []:
            data = c.get("data", c.get("fields", ""))
            commands.append(OrderedDict([
                ("split", spl),
                ("families", fam),
                ("transport", "iot"),
                ("name", c.get("cmd", c.get("name", ""))),
                ("op", c.get("cmd", "")),
                ("payload", flatten(data)),
                ("layout", flatten(data)),
                ("response", c.get("response", "")),
                ("source", c.get("source", "")),
                ("notes", c.get("example", "")),
            ]))
        status = iot.get("status")
        if status:
            if isinstance(status, dict):
                fields = status.get("fields", status)
            else:
                fields = status
            readings.append(OrderedDict([
                ("split", spl),
                ("transport", "iot-status"),
                ("name", "status"),
                ("op", "status"),
                ("layout", flatten(fields)),
                ("source", status.get("source", "") if isinstance(status, dict) else ""),
            ]))

        for e in d.get("dynamic_effects") or []:
            effects.append(OrderedDict([
                ("split", spl),
                ("name", e.get("name", "")),
                ("submode", e.get("submode", "")),
                ("payload", e.get("payload", "")),
                ("attributes", flatten(e.get("attributes", e.get("details", "")))),
                ("source", e.get("source", "")),
            ]))

        for p in d.get("status_properties") or []:
            status_properties.append(OrderedDict([
                ("split", spl),
                ("property", p.get("property", p.get("name", ""))),
                ("kind", p.get("kind", "")),
                ("meaning", p.get("meaning", "")),
                ("carrier", flatten(p.get("carrier", ""))),
                ("source", p.get("source", "")),
            ]))

    merged = OrderedDict([
        ("meta", OrderedDict([
            ("generated_from", "decompiled/jadx-splits (Govee Home 7.7.21 split modules) + decompiled/jadx-base-7.7.10"),
            ("split_modules_with_devices", len(splits)),
            ("sku_rows", len(devices)),
            ("ble_command_rows", sum(1 for c in commands if c["transport"] == "ble")),
            ("ble_notification_rows", sum(1 for c in commands if c["transport"] == "ble-notify")),
            ("iot_command_rows", sum(1 for c in commands if c["transport"] == "iot")),
            ("dynamic_effect_rows", len(effects)),
            ("status_property_rows", len(status_properties)),
        ])),
        ("transports", dict(Counter(t for dev in devices for t in dev["transports"].split("|") if t))),
        ("splits", [
            OrderedDict([
                ("split", d.get("split")),
                ("title", split_title(d)),
                ("families", d.get("families") or []),
                ("sku_count", len(d.get("skus") or [])),
                ("ble_commands", len((d.get("ble") or {}).get("commands") or [])),
                ("ble_notifications", len((d.get("ble") or {}).get("notifications") or [])),
                ("iot_commands", len((d.get("iot") or {}).get("commands") or [])),
                ("dynamic_effects", len(d.get("dynamic_effects") or [])),
                ("other_protocols", d.get("other_protocols") or []),
                ("notes", d.get("notes", "")),
            ]) for d in splits
        ]),
        ("devices", devices),
        ("commands", commands),
        ("effects", effects),
        ("readings", readings),
        ("status_properties", status_properties),
    ])

    with open(os.path.join(DATA, "ALL.json"), "w", encoding="utf-8") as fh:
        json.dump(merged, fh, ensure_ascii=False, indent=1)
        fh.write("\n")

    def write_csv(name, rows, fields):
        path = os.path.join(ROOT, name)
        with open(path, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
            w.writeheader()
            for r in rows:
                w.writerow({k: flatten(r.get(k)) for k in fields})

    write_csv("devices.csv", devices,
              ["split", "sku", "family", "transports", "pact_type", "pact_code", "goods_type", "notes"])
    write_csv("commands.csv", commands,
              ["split", "families", "transport", "name", "op", "payload", "layout", "response", "source", "notes"])
    write_csv("effects.csv", effects,
              ["split", "name", "submode", "payload", "attributes", "source"])
    write_csv("readings.csv", readings,
              ["split", "transport", "name", "op", "layout", "source"])
    write_csv("status-properties.csv", status_properties,
              ["split", "property", "kind", "meaning", "carrier", "source"])

    print(json.dumps(merged["meta"], indent=2))
    print("transports:", merged["transports"])
    print("wrote data/ALL.json, devices.csv, commands.csv, effects.csv, readings.csv, "
          "status-properties.csv")


if __name__ == "__main__":
    main()
