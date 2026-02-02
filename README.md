# WiFiMint - Professional Managed Network Control System

![WiFiMint Dashboard Preview](assets/dashboard2.png)

**WiFiMint** is a premium, state-of-the-art Wi-Fi vending platform designed for ISPs, hotels, and public hotspots. It provides a seamless captive portal experience, automated network management, and a high-fidelity admin dashboard.

---

## ✨ Key Features

### 🖥️ Cyber-Premium Dashboards
- **Admin Control Center**: Built with Electron & React, featuring a glassmorphism UI for monitoring real-time traffic, revenue, and connected devices.
- **Client Portal**: A "Cyber-Premium" login page for users to discover plans, scan QR codes for payment, and gain instant internet access.

### 📡 Advanced Network Control
- **Dynamic Captive Portal**: Automatic redirection (DNS Hijacking) for unauthorized users.
- **Smart Blocking**: High-speed ARP spoofing and `iptables` rules to isolate untrusted clients.
- **Expiry Monitor**: Real-time subscription monitoring that automatically blocks users as soon as their time expires.

### 💰 Vending & Monetization
- **Flexible Plans**: Admins can create custom plans (minutes-based access).
- **Payment Verification**: Manual QR-code based payment request and admin approval workflow.
- **Stat Insights**: Detailed revenue tracking and user growth analytics.

### 🛠️ One-Click Experience
- **Auto-Installer**: `start.sh` automatically checks and installs all system dependencies (Go, Node.js, Arpspoof, etc.).
- **Zero Configuration**: Detects network interfaces and sets up the gateway automatically.

---

## 🚀 Tech Stack

- **Backend**: [Go (Golang)](https://go.dev/) - High-performance networking logic & API.
- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/) - Modern, responsive web interfaces.
- **Desktop**: [Electron](https://www.electronjs.org/) - Cross-platform admin GUI.
- **Database**: [SQLite](https://www.sqlite.org/) - Lightweight, persistent storage.
- **Networking**: `iptables`, `dsniff` (arpspoof), `conntrack`, `dns`.

---

## 📦 Installation & Setup

Ensure you are on a Linux system (Ubuntu/Debian recommended).

1. **Clone the Repository**
   ```bash
   git clone https://github.com/rajan9182/WiFiMint.git
   cd wifimint
   ```

2. **Launch WiFiMint**
   Simply run the auto-installer/launcher:
   ```bash
   sudo bash start.sh
   ```
   *The script will automatically install missing dependencies, build the frontend, and start the services.*

3. **Access the Dashboards**
   - **Admin Portal**: `http://localhost:8080/admin` (or via the Electron GUI)
   - **User Portal**: `http://<your-ip>:8080/login`

---

## 🗺️ Operating Modes

- **Hotspot Mode**: System acts as an Access Point. Clients connect directly to the Wi-Fi.
- **LAN Mode**: System scans the local network and intercepts connectivity (ARP poisoning).

---

## 👨‍💻 Author

**Designed & Developed by [Rajan Goswami](https://github.com/rajan9182)**
*Ultra-Fast Managed Wi-Fi Control Solutions.*

---

## ⚖️ License
This project is licensed under the MIT License - see the LICENSE file for details.