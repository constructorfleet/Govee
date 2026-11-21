import sys, re, subprocess, zipfile, io, os, glob
from curl_cffi import requests
ver = sys.argv[1]                      # e.g. 7.7.10
idx = int(sys.argv[2]) if len(sys.argv)>2 else 0
base = "https://www.apkmirror.com"
s = requests.Session(impersonate="chrome")
verpage = f"{base}/apk/govee/govee-home/govee-home-{ver.replace('.','-')}-release/"
r = s.get(verpage, timeout=60)
x = r.content.decode("utf-8","replace")
links = re.findall(r'href="(/apk/govee/govee-home/govee-home-%s[^"]*android-apk-download/)"' % ver.replace('.','-'), x)
links = list(dict.fromkeys(links))
print("variants:", links)
if not links:
    print("NO DOWNLOAD LINK"); sys.exit(1)
dlpage = base + links[idx]
r = s.get(dlpage, timeout=60, headers={"Referer": verpage})
x = r.content.decode("utf-8","replace")
m = re.search(r'href="([^"]*android-apk-download/download/\?key=[0-9a-f]+)"', x)
if not m:
    print("NO KEY LINK"); sys.exit(1)
r = s.get(base+m.group(1), timeout=60, headers={"Referer": dlpage})
x = r.content.decode("utf-8","replace")
m2 = re.search(r'download\.php\?id=\d+&key=[0-9a-f]+', x)
if not m2:
    print("NO download.php"); sys.exit(1)
r2 = s.get(base+"/wp-content/themes/APKMirror/"+m2.group(0), timeout=120, headers={"Referer": dlpage})
url = r2.url
size = r2.headers.get("content-length")
name = url.split("/")[-1].split("?")[0]
print("file:", name, size)
out = f"probe_{ver}.apkm"
subprocess.run(["curl","-sS","-L","-o",out,url], check=True)
with zipfile.ZipFile(out) as z:
    basename = [n for n in z.namelist() if n=="base.apk"][0]
    data = z.read(basename)
open(f"/tmp/base_{ver}.apk","wb").write(data)
with zipfile.ZipFile(io.BytesIO(data)) as b:
    dexes = [n for n in b.namelist() if re.fullmatch(r"classes\d*\.dex", n)]
    print("dex count:", len(dexes), "total dex bytes:", sum(b.getinfo(n).file_size for n in dexes))
    c0 = b.read("classes.dex")
import struct
fs = struct.unpack_from("<I", c0, 0x20)[0]
sids = struct.unpack_from("<I", c0, 0x38)[0]
cds = struct.unpack_from("<I", c0, 0x60)[0]
print(f"classes.dex: len={len(c0)} file_size_hdr={fs} string_ids={sids} class_defs={cds} version={c0[4:8].hex()}")
