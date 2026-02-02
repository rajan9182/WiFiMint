#!/bin/bash
set -e

INSTALL_DIR="$HOME/.local_deps"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Install Go
if [ ! -d "go" ]; then
    echo "Downloading Go..."
    curl -L -o go.tar.gz https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
    echo "Extracting Go..."
    tar -xzf go.tar.gz
    rm go.tar.gz
else
    echo "Go already installed."
fi

# Install Node
if [ ! -d "node-v20.11.0-linux-x64" ]; then
    echo "Downloading Node.js..."
    curl -L -o node.tar.xz https://nodejs.org/dist/v20.11.0/node-v20.11.0-linux-x64.tar.xz
    echo "Extracting Node.js..."
    tar -xf node.tar.xz
    rm node.tar.xz
else
    echo "Node.js already installed."
fi

echo "Installation complete."
echo "Add the following to your path:"
echo "export PATH=$INSTALL_DIR/go/bin:$INSTALL_DIR/node-v20.11.0-linux-x64/bin:\$PATH"
