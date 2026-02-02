package router

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

type Device struct {
	IP        string `json:"ip"`
	MAC       string `json:"mac"`
	Name      string `json:"name"`
	IsBlocked bool   `json:"is_blocked"`
}

type BlockInfo struct {
	Cmds []*exec.Cmd
	IP   string
}

type RouterClient struct {
	Interface     string
	ActiveAttacks map[string]BlockInfo
	GatewayIP     string
	GatewayMAC    string
	HostIP        string
	HostMAC       string
	lock          sync.Mutex
}

func NewRouterClient(iface string) *RouterClient {
	return &RouterClient{
		Interface:     iface,
		ActiveAttacks: make(map[string]BlockInfo),
	}
}

func (c *RouterClient) Connect() error {
	requiredTools := []string{"arp-scan", "arpspoof", "iptables"}
	for _, tool := range requiredTools {
		if _, err := exec.LookPath(tool); err != nil {
			return fmt.Errorf("required tool not found: %s", tool)
		}
	}

	if c.GatewayIP == "" {
		cmd := exec.Command("sh", "-c", fmt.Sprintf("ip route show dev %s | grep default | awk '{print $3}'", c.Interface))
		output, err := cmd.Output()
		if err == nil && len(output) > 0 {
			c.GatewayIP = strings.TrimSpace(string(output))
			fmt.Printf("[INIT] Auto-detected Real Gateway IP: %s on %s\n", c.GatewayIP, c.Interface)
			
			// Detect Gateway MAC early
			arpOut, _ := exec.Command("sh", "-c", fmt.Sprintf("arping -c 1 -I %s %s && arp -n %s | grep %s | awk '{print $3}'", c.Interface, c.GatewayIP, c.GatewayIP, c.GatewayIP)).Output()
			c.GatewayMAC = strings.ToLower(strings.TrimSpace(string(arpOut)))
			if c.GatewayMAC != "" {
				fmt.Printf("[INIT] Gateway MAC Detected: %s\n", c.GatewayMAC)
			}
		}
	}

	// Detect Host IP and MAC
	cmdIP := exec.Command("sh", "-c", fmt.Sprintf("ip -o -4 addr show %s | awk '{print $4}' | cut -d/ -f1", c.Interface))
	outIP, _ := cmdIP.Output()
	c.HostIP = strings.TrimSpace(string(outIP))

	cmdMAC := exec.Command("sh", "-c", fmt.Sprintf("cat /sys/class/net/%s/address", c.Interface))
	outMAC, _ := cmdMAC.Output()
	c.HostMAC = strings.ToLower(strings.TrimSpace(string(outMAC)))

	fmt.Printf("[INIT] Host Personal Info: IP=%s MAC=%s\n", c.HostIP, c.HostMAC)

	exec.Command("sysctl", "-w", "net.ipv4.ip_forward=1").Run()

	fmt.Printf("RouterClient Ready: Interface=%s, Gateway=%s, Tools Verified.\n", c.Interface, c.GatewayIP)
	return nil
}

func (c *RouterClient) ExecuteCommand(command string) (string, error) {
	cmd := exec.Command("sh", "-c", command)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to run command: %v, output: %s", err, string(output))
	}
	return string(output), nil
}

func (c *RouterClient) GetConnectedDevices() ([]Device, error) {
	cmd := exec.Command("arp-scan", "-l", "-I", c.Interface)
	output, err := cmd.Output()
	var isFallback bool
	var lines []string
	if err != nil {
		fmt.Printf("[ROUTER] Warning: arp-scan failed (%v). Falling back to /proc/net/arp\n", err)
		data, err := os.ReadFile("/proc/net/arp")
		if err != nil {
			return nil, fmt.Errorf("scan failed and fallback failed: %v", err)
		}
		lines = strings.Split(string(data), "\n")
		isFallback = true
	} else {
		lines = strings.Split(string(output), "\n")
	}

	var devices []Device
	
	c.lock.Lock()
	defer c.lock.Unlock()

	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) >= 2 {
			ip := fields[0]
			mac := ""
			name := "Unknown"

			if isFallback {
				// /proc/net/arp: IP, HW, Flags, MAC, Mask, Device
				if len(fields) >= 4 {
					mac = strings.ToLower(fields[3])
				}
			} else {
				// arp-scan: IP, MAC, Name
				mac = strings.ToLower(fields[1])
				if len(fields) > 2 {
					name = strings.Join(fields[2:], " ")
				}
			}

			if strings.Count(ip, ".") == 3 && strings.Count(mac, ":") == 5 {
				_, blocked := c.ActiveAttacks[mac]
				
				devices = append(devices, Device{
					IP:        ip,
					MAC:       mac,
					Name:      name,
					IsBlocked: blocked,
				})
			}
		}
	}
	return devices, nil
}

func (c *RouterClient) FindIPbyMAC(mac string) (string, error) {
	cmd := exec.Command("arp", "-n")
	output, err := cmd.Output()
	if err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			if strings.Contains(strings.ToLower(line), strings.ToLower(mac)) {
				fields := strings.Fields(line)
				if len(fields) > 0 {
					return fields[0], nil
				}
			}
		}
	}
	return "", fmt.Errorf("MAC %s not found in ARP cache", mac)
}

func (c *RouterClient) FindMACbyIP(ip string) (string, error) {
	cmd := exec.Command("arp", "-n", ip)
	output, err := cmd.Output()
	if err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			if strings.Contains(line, ip) {
				fields := strings.Fields(line)
				if len(fields) >= 3 {
					return strings.ToLower(fields[2]), nil
				}
			}
		}
	}
	return "", fmt.Errorf("IP %s not found in ARP cache", ip)
}

// RestoreARP sends gratuitous ARP packets for a longer duration to force client gateway update
func (c *RouterClient) RestoreARP(mac string, ip string) {
	fmt.Printf("[ROUTER] Starting intensive ARP restoration for %s (%s)\n", ip, mac)
	for i := 0; i < 45; i++ {
		// Send packets to both sides to fix the ARP table
		// 1. Tell the Client (ip) that Gateway (GatewayIP) is at REAL MAC (we use -r for arpspoof cleanup)
		exec.Command("arpspoof", "-i", c.Interface, "-t", ip, c.GatewayIP, "-r").Run()
		// 2. Tell the Gateway (GatewayIP) that Client (ip) is at REAL MAC
		exec.Command("arpspoof", "-i", c.Interface, "-t", c.GatewayIP, ip, "-r").Run()
		
		time.Sleep(1 * time.Second)
	}
}

// AllowMAC stops the ARP spoofing attack and allows internet
func (c *RouterClient) AllowMAC(mac string) (string, error) {
	mac = strings.ToLower(mac)
	c.lock.Lock()
	defer c.lock.Unlock()

	// 1. Ensure Redirection bypass - remove and re-insert at top
	for {
		if _, err := c.ExecuteCommand(fmt.Sprintf("iptables -t nat -D WIFIMINT_REDIRECT -m mac --mac-source %s -j RETURN", mac)); err != nil {
			break
		}
	}
	c.ExecuteCommand(fmt.Sprintf("iptables -t nat -I WIFIMINT_REDIRECT -m mac --mac-source %s -j RETURN", mac))

	ip, err := c.FindIPbyMAC(mac)
	if err == nil {
		// 2. Aggressively remove EVERY instance of FORWARD drop rules
		for {
			if _, err := c.ExecuteCommand(fmt.Sprintf("iptables -D FORWARD -s %s -j DROP", ip)); err != nil {
				break
			}
		}
		for {
			if _, err := c.ExecuteCommand(fmt.Sprintf("iptables -D FORWARD -d %s -j DROP", ip)); err != nil {
				break
			}
		}
		
		exec.Command("conntrack", "-D", "-s", ip).Run()
		go c.RestoreARP(mac, ip)
	}

	if info, exists := c.ActiveAttacks[mac]; exists {
		fmt.Printf("[UNBLOCK] Stopping active attack process for %s\n", info.IP)
		for _, cmd := range info.Cmds {
			if cmd != nil && cmd.Process != nil {
				cmd.Process.Signal(os.Interrupt)
			}
		}
		delete(c.ActiveAttacks, mac)
		return "Device Unblocked", nil
	}
	return "Device Access Allowed", nil
}

func (c *RouterClient) BlockMAC(mac string, targetIP string) (string, error) {
	mac = strings.ToLower(mac)
	c.lock.Lock()
	defer c.lock.Unlock()

	// 1. Remove from Redirection bypass list
	c.ExecuteCommand(fmt.Sprintf("iptables -t nat -D WIFIMINT_REDIRECT -m mac --mac-source %s -j RETURN", mac))

	if _, exists := c.ActiveAttacks[mac]; exists {
		return "Already blocking this device", nil
	}

	if targetIP == "" {
		ip, err := c.FindIPbyMAC(mac)
		if err != nil {
			return "", fmt.Errorf("could not find IP for MAC %s: %v", mac, err)
		}
		targetIP = ip
	}

	// GATEWAY & HOST PROTECTION: Never block the router, gateway or host machine
	// We check for HostIP, HostMAC, GatewayIP, and common local addresses.
	if (targetIP != "" && (targetIP == c.GatewayIP || targetIP == "127.0.0.1" || targetIP == c.HostIP || targetIP == "0.0.0.0")) || 
	   (mac != "" && (mac == c.HostMAC || mac == "ff:ff:ff:ff:ff:ff" || (c.GatewayMAC != "" && mac == c.GatewayMAC))) {
		fmt.Printf("[ROUTER] SECURITY BYPASS: Target is Host/Gateway/Broadcast (%s / %s). Block REJECTED.\n", targetIP, mac)
		return "Skipping block for Gateway/Host/Self/Broadcast", nil
	}

	gatewayIP := c.GatewayIP
	if gatewayIP == "" {
		parts := strings.Split(targetIP, ".")
		if len(parts) == 4 {
			gatewayIP = fmt.Sprintf("%s.%s.%s.1", parts[0], parts[1], parts[2])
		} else {
			return "", fmt.Errorf("invalid target IP format and no gateway config")
		}
	}

	fmt.Printf("[BLOCK] Starting Dual ARP Block: Target=%s Gateway=%s\n", targetIP, gatewayIP)
	cmd1 := exec.Command("arpspoof", "-i", c.Interface, "-t", targetIP, gatewayIP)
	cmd2 := exec.Command("arpspoof", "-i", c.Interface, "-t", gatewayIP, targetIP)
	
	if err := cmd1.Start(); err != nil {
		return "", fmt.Errorf("failed to start arpspoof 1: %v", err)
	}
	if err := cmd2.Start(); err != nil {
		cmd1.Process.Kill()
		return "", fmt.Errorf("failed to start arpspoof 2: %v", err)
	}

	// Add high-priority iptables forward drop
	c.ExecuteCommand(fmt.Sprintf("iptables -I FORWARD -s %s -j DROP", targetIP))
	c.ExecuteCommand(fmt.Sprintf("iptables -I FORWARD -d %s -j DROP", targetIP))

	c.ActiveAttacks[mac] = BlockInfo{
		Cmds: []*exec.Cmd{cmd1, cmd2},
		IP:   targetIP,
	}
	
	return fmt.Sprintf("Blocking started for %s (%s)", targetIP, mac), nil
}

func (c *RouterClient) SetSpeedLimit(ip string, rateMbps int) (string, error) {
	cmd := fmt.Sprintf("tc qdisc add dev %s handle 1: root htb default 11 && tc class add dev %s parent 1: classid 1:1 htb rate %dmbit", c.Interface, c.Interface, rateMbps)
	return c.ExecuteCommand(cmd)
}

func (c *RouterClient) SetupCaptivePortal(laptopIP string) error {
	fmt.Printf("Initialising Dynamic Redirection Chain...\n")

	c.ExecuteCommand("iptables -t nat -N WIFIMINT_REDIRECT")
	c.ExecuteCommand("iptables -t nat -F WIFIMINT_REDIRECT")
	
	// Redirect DNS (UDP & TCP) to our local server on :5353
	c.ExecuteCommand(fmt.Sprintf("iptables -t nat -A WIFIMINT_REDIRECT -p udp --dport 53 -j REDIRECT --to-ports 5353"))
	c.ExecuteCommand(fmt.Sprintf("iptables -t nat -A WIFIMINT_REDIRECT -p tcp --dport 53 -j REDIRECT --to-ports 5353"))

	// Redirect HTTP to our backend on :8080
	c.ExecuteCommand(fmt.Sprintf("iptables -t nat -A WIFIMINT_REDIRECT -p tcp --dport 80 -j REDIRECT --to-ports 8080"))

	// Ensure Host Machine always has internet - high priority bypass at the VERY START
	if c.HostIP != "" {
		c.ExecuteCommand(fmt.Sprintf("iptables -t nat -I WIFIMINT_REDIRECT 1 -s %s -j RETURN", c.HostIP))
	}
	if c.HostMAC != "" {
		c.ExecuteCommand(fmt.Sprintf("iptables -t nat -I WIFIMINT_REDIRECT 1 -m mac --mac-source %s -j RETURN", c.HostMAC))
	}

	// Force clear and re-add hook to ensure it's at the top of PREROUTING
	// We use -I with index 1 to ensure it's the absolute first rule hit
	c.ExecuteCommand(fmt.Sprintf("iptables -t nat -D PREROUTING -i %s -j WIFIMINT_REDIRECT", c.Interface))
	c.ExecuteCommand(fmt.Sprintf("iptables -t nat -I PREROUTING 1 -i %s -j WIFIMINT_REDIRECT", c.Interface))
	
	c.ExecuteCommand("echo 1 > /proc/sys/net/ipv4/ip_forward")
	
	// Ensure masquerade is present
	c.ExecuteCommand(fmt.Sprintf("iptables -t nat -D POSTROUTING -o %s -j MASQUERADE", c.Interface))
	c.ExecuteCommand(fmt.Sprintf("iptables -t nat -A POSTROUTING -o %s -j MASQUERADE", c.Interface))

	return nil
}

func (c *RouterClient) GetSystemInfo() map[string]interface{} {
	return map[string]interface{}{
		"interface":  c.Interface,
		"gateway_ip": c.GatewayIP,
		"host_ip":    c.HostIP,
		"host_mac":   c.HostMAC,
	}
}

func (c *RouterClient) Cleanup() {
	fmt.Println("Cleaning up...")
	c.ExecuteCommand(fmt.Sprintf("iptables -t nat -D PREROUTING -i %s -j WIFIMINT_REDIRECT", c.Interface))
	c.ExecuteCommand("iptables -t nat -F WIFIMINT_REDIRECT")
	c.ExecuteCommand("iptables -t nat -X WIFIMINT_REDIRECT")
	
	c.lock.Lock()
	for mac, info := range c.ActiveAttacks {
		for _, cmd := range info.Cmds {
			if cmd != nil && cmd.Process != nil {
				cmd.Process.Signal(os.Interrupt)
			}
		}
		delete(c.ActiveAttacks, mac)
	}
	c.lock.Unlock()
}
