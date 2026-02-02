#!/bin/bash
SRC="/media/rajangoswami/0E99-EFD2/Internet/frontend/dist"
DEST_DIR="/media/rajangoswami/0E99-EFD2/Internet/backend/frontend"

echo "Waiting for frontend build to finish..."
while [ ! -d "$SRC" ]; do
  sleep 10
done

echo "Frontend build detected. Installing to backend..."
mkdir -p "$DEST_DIR"
# Remove existing dist to avoid nesting (e.g. dist/dist)
rm -rf "$DEST_DIR/dist"
cp -r "$SRC" "$DEST_DIR/dist"
echo "Frontend deployed successfully."
