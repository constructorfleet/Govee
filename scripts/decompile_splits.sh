#!/bin/zsh
cd /Users/tglenn/src/govee
export JAVA_OPTS="-Xmx8g"
for f in apkm/split_*.apk; do
  n=$(basename "$f" .apk)
  if unzip -l "$f" | grep -q '\.dex'; then
    echo "=== $n $(date +%T)"
    jadx -d "decompiled/jadx-splits/$n" --no-res -j 4 "$f" > "decompiled/jadx-splits/$n.log" 2>&1
    echo "exit=$? $n"
  fi
done
echo ALLDONE
