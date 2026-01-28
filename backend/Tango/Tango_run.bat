#!/bin/bash
set -euo pipefail
BIN="$(dirname "$0")/bin/tango"
if [ ! -x "$BIN" ]; then echo "[TANGO] tango binary missing at $BIN"; exit 1; fi
"$BIN" P0DI90 nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="ADDKNPLEECFCEDDDYCEG" > "P0DI90.txt"
"$BIN" C0HK44 nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="VNWKKILGKIIKVVK" > "C0HK44.txt"
"$BIN" P0C005 nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="GLLKRIKTLL" > "P0C005.txt"
"$BIN" A0A0C5B5G6 nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="MRWQEMGYIFYPRKLR" > "A0A0C5B5G6.txt"
"$BIN" P50983 nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="IVRRGCCSDPRCAWRCG" > "P50983.txt"
"$BIN" P0DJG7 nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="VIGGVECDINEHRFL" > "P0DJG7.txt"
"$BIN" P0DL39 nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="SCCARNPACRHNHPCV" > "P0DL39.txt"
"$BIN" P56917 nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="FLPLIGRVLSGIL" > "P56917.txt"
"$BIN" C0HMA1 nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="MEMALMVAQTRKGKSVV" > "C0HMA1.txt"
"$BIN" P0DQM9 nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="GFRSPCPPFC" > "P0DQM9.txt"
"$BIN" P69208 nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="QPPGGSKVILF" > "P69208.txt"
"$BIN" P0DJH3 nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="DVVSPPVCGN" > "P0DJH3.txt"
