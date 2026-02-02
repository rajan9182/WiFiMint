#!/bin/bash

# Helper function to install dependencies
install_dependency() {
    local name=$1
    local install_cmd=$2
    echo -e "\033[1;33m⚠️  $name is missing.\033[0m"
    read -p "Do you want to install $name now? (y/n): " choice
    if [ "$choice" == "y" ]; then
        echo "⏳ Installing $name..."
        eval "$install_cmd"
        if [ $? -eq 0 ]; then
            echo "✅ $name installed successfully."
            return 0
        else
            echo "❌ Failed to install $name. Please install it manually."
            exit 1
        fi
    else
        echo "❌ $name is required. Exiting."
        exit 1
    fi
}

# 0. Requirement Checks & Auto-Installers
echo "Checking System Requirements..."
if ! command -v go >/dev/null 2>&1 && [ ! -f "/usr/local/go/bin/go" ]; then
    install_dependency "Go (Golang)" "wget https://go.dev/dl/go1.22.5.linux-amd64.tar.gz && sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.22.5.linux-amd64.tar.gz && rm go1.22.5.linux-amd64.tar.gz && echo 'export PATH=\$PATH:/usr/local/go/bin' >> ~/.bashrc"
fi
export PATH=$PATH:/usr/local/go/bin

if ! command -v npm >/dev/null 2>&1; then
    install_dependency "Node.js & NPM" "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
fi

command -v arp-scan >/dev/null 2>&1 || install_dependency "arp-scan" "sudo apt update && sudo apt install -y arp-scan"
command -v arpspoof >/dev/null 2>&1 || install_dependency "arpspoof" "sudo apt update && sudo apt install -y dsniff"
command -v conntrack >/dev/null 2>&1 || install_dependency "conntrack" "sudo apt update && sudo apt install -y conntrack"
command -v fuser >/dev/null 2>&1 || install_dependency "fuser" "sudo apt update && sudo apt install -y psmisc"
command -v arp >/dev/null 2>&1 || install_dependency "net-tools (arp)" "sudo apt update && sudo apt install -y net-tools"
command -v rsync >/dev/null 2>&1 || install_dependency "rsync" "sudo apt update && sudo apt install -y rsync"
command -v iptables >/dev/null 2>&1 || install_dependency "iptables" "sudo apt update && sudo apt install -y iptables"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo bash start.sh)"
  exit
fi

# WiFiMint Branding & ASCII Art
echo -e "\033[1;36m"
echo "  __      __.__ __________.__  _____  .__        __   "
echo " /  \    /  \__|  \_   ___  / /     \ |__| ____ |  |_ "
echo " \   \/\/   /  |  |    \  \/ /  \ /  \|  |/    \|  |_\\"
echo "  \        /|  |  |     \___/    Y    \  |   |  \   __\\"
echo "   \__/\  / |__|__|______  /\____|__  /__|___|  /__|  "
echo "        \/               \/         \/        \/      "
echo -e "\033[0m"
echo -e "\033[1;33mDesigned and Developed by Rajan Goswami\033[0m"
echo "--------------------------------------------------------"
echo "🌐 Welcome to WiFiMint Central Control System"
echo "--------------------------------------------------------"
echo "✅ All requirements met."
echo ""

# Operating Modes
echo "Operating Modes:"
echo "A) Hotspot Mode: Turn ON Wi-Fi Hotspot in Settings. Clients connect there."
echo "B) LAN Mode: Stay connected to your Wi-Fi. System will scan the network."
echo ""
echo "Press Enter to start WiFiMint..."
read

# Cleanup Function
cleanup() {
    echo ""
    echo "Stopping WiFiMint..."
    sudo fuser -k 8080/tcp 53/udp 53/tcp 5353/udp 5353/tcp > /dev/null 2>&1
    sudo systemctl start avahi-daemon.service avahi-daemon.socket > /dev/null 2>&1
    sudo systemctl start systemd-resolved > /dev/null 2>&1
    sudo pkill arpspoof
    echo "System Stopped."
    exit
}
trap cleanup SIGINT SIGTERM

# 1. Build Frontend
echo "📦 Building WiFiMint UI..."
FRONTEND_TMP="/tmp/wifi-control-frontend"
mkdir -p $FRONTEND_TMP
rsync -a --exclude 'node_modules' --exclude 'dist' frontend/ $FRONTEND_TMP/
cd $FRONTEND_TMP
if [ ! -d "node_modules" ]; then
    echo "⏳ Installing dependencies..."
    npm install >/dev/null 2>&1
fi
echo "⚡ Compiling assets..."
npm run build >/dev/null 2>&1
mkdir -p /media/rajangoswami/0E99-EFD2/Internet/frontend/dist
cp -r dist/* /media/rajangoswami/0E99-EFD2/Internet/frontend/dist/
cd /media/rajangoswami/0E99-EFD2/Internet
echo "✅ UI Build Complete."

# 2. Cleanup & Build Backend
echo "🧹 Cleaning ports..."
sudo fuser -k 8080/tcp 53/udp 53/tcp 5353/udp 5353/tcp > /dev/null 2>&1
sudo systemctl stop avahi-daemon.socket avahi-daemon.service > /dev/null 2>&1

echo "⚙️  Preparing Engine..."
mkdir -p /tmp/wifi-control-system
cd backend
go build -o /tmp/wifi-control-system/server main.go
cd ..
echo "✅ Engine Ready."

# 3. Detect Network
echo "📡 Detecting Network..."
HOTSPOT_IFACE=$(ip route show default | awk '{print $5}' | head -n 1)
[ -z "$HOTSPOT_IFACE" ] && HOTSPOT_IFACE=$(ip -o addr show | grep -v "127.0.0.1" | awk '{print $2}' | grep -E '^w' | head -n 1)
HOTSPOT_IP=$(ip -o -4 addr show $HOTSPOT_IFACE | awk '{print $4}' | cut -d/ -f1 | head -n 1)

export ROUTER_IP=${HOTSPOT_IP:-"192.168.1.1"}
export HOTSPOT_INTERFACE=$HOTSPOT_IFACE

echo "🚀 Starting WiFiMint Services..."
echo "-----------------------------------------------"
echo "✅ Admin Portal: http://$ROUTER_IP:8080/admin"
echo "-----------------------------------------------"

# Run Backend
sudo -E ROUTER_IP=$ROUTER_IP HOTSPOT_INTERFACE=$HOTSPOT_INTERFACE /tmp/wifi-control-system/server

echo "Press Enter to exit..."
read
