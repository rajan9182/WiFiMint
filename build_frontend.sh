#!/bin/bash

# Configuration
SOURCE_DIR=$(pwd)/frontend
TEMP_DIR=$HOME/.wifi-build-temp
DIST_DIR=$SOURCE_DIR/dist

echo "=== Off-Drive Frontend Build System ==="
echo "Source: $SOURCE_DIR"
echo "Temp:   $TEMP_DIR"

# 1. Clean and Setup Temp Directory
echo "[1/5] Setting up temporary build environment..."
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR
cp -r $SOURCE_DIR/* $TEMP_DIR/
cp $SOURCE_DIR/.gitignore $TEMP_DIR/ 2>/dev/null || true

# 2. Install Dependencies (Safe on Home Drive)
echo "[2/5] Installing dependencies in $TEMP_DIR..."
cd $TEMP_DIR
npm install

# 3. Build Project
echo "[3/5] Building React Project..."
npm run build

# 4. Copy Artifacts Back
echo "[4/5] Moving build artifacts back to source..."
rm -rf $DIST_DIR
mkdir -p $DIST_DIR
cp -r $TEMP_DIR/dist/* $DIST_DIR/

# 5. Cleanup
echo "[5/5] Cleanup..."
# rm -rf $TEMP_DIR # Optional: Keep for caching if needed
echo "✅ Build Successful! Assets active in $DIST_DIR"
