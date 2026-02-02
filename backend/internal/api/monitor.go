package api

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/user/wifi-control-system/internal/router"
)

type Router interface {
	GetConnectedDevices() ([]router.Device, error)
	BlockMAC(mac string, ip string) (string, error)
	AllowMAC(mac string) (string, error)
}

type SubscriptionMonitor struct {
	DB     *sql.DB
	Router Router
}

func (m *SubscriptionMonitor) Start() {
	fmt.Println("[MONITOR] Subscription Expiry Monitor Started.")
	// Run every 3 seconds for fast detection
	ticker := time.NewTicker(3 * time.Second)
	go func() {
		for range ticker.C {
			m.CheckExpirations()
			m.AutoSyncDevices()
		}
	}()
}

// SyncAllowedDevices restores firewall bypass rules for currently active subscriptions
func (m *SubscriptionMonitor) SyncAllowedDevices() {
	fmt.Println("[MONITOR] Syncing Allowed Devices to Router...")
	rows, err := m.DB.Query(`
		SELECT mac_address 
		FROM subscriptions 
		WHERE status = 'active' AND end_time > ?`, time.Now())
	if err != nil {
		log.Printf("[MONITOR] Sync failed: %v\n", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var mac string
		if err := rows.Scan(&mac); err == nil {
			// Using type assertion to call AllowMAC if the router supports it
			if r, ok := m.Router.(*router.RouterClient); ok {
				r.AllowMAC(mac)
			}
		}
	}
}

func (m *SubscriptionMonitor) AutoSyncDevices() {
	if m.Router == nil {
		return
	}

	// 1. Scan network for current devices
	devices, err := m.Router.GetConnectedDevices()
	if err != nil {
		log.Printf("[MONITOR] Scan failed: %v\n", err)
		return
	}

	// Host Protection: Detect host info from router if possible
	hostIP := ""
	hostMAC := ""
	if r, ok := m.Router.(*router.RouterClient); ok {
		hostIP = r.HostIP
		hostMAC = r.HostMAC
	}

	// 2. Sync with DB
	for _, d := range devices {
		// Host Protection: NEVER process or block the host machine
		if (hostIP != "" && d.IP == hostIP) || (hostMAC != "" && d.MAC == hostMAC) {
			continue
		}

		// Only insert if not exists, to preserve status
		var exists int
		m.DB.QueryRow("SELECT COUNT(*) FROM devices WHERE mac_address = ?", d.MAC).Scan(&exists)
		if exists == 0 {
			fmt.Printf("[MONITOR] New Device Detected: %s (%s). Storing as blocked.\n", d.MAC, d.IP)
			_, err = m.DB.Exec(`
				INSERT INTO devices (mac_address, ip_address, device_name, status)
				VALUES (?, ?, ?, 'blocked')`,
				d.MAC, d.IP, d.Name)
			if err != nil {
				log.Printf("[MONITOR] Failed to store new device: %v\n", err)
			}
		} else {
			// Update IP if it changed
			m.DB.Exec("UPDATE devices SET ip_address = ?, last_seen = CURRENT_TIMESTAMP WHERE mac_address = ?", d.IP, d.MAC)
		}

		// REINFORCE: If device is marked as 'blocked' in DB, ensure it's blocked in Router
		var status string
		m.DB.QueryRow("SELECT status FROM devices WHERE mac_address = ?", d.MAC).Scan(&status)
		if status == "blocked" {
			m.Router.BlockMAC(d.MAC, d.IP)
		}
	}
}

// Removed ReinforceBlocking as separate long-loop function to avoid heavy locking

func (m *SubscriptionMonitor) CheckExpirations() {
	// Query for active subscriptions that have passed their end time
	rows, err := m.DB.Query(`
		SELECT id, mac_address 
		FROM subscriptions 
		WHERE status = 'active' AND end_time < ?`, time.Now())
	
	if err != nil {
		log.Printf("[MONITOR] Error querying expirations: %v\n", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var subID int
		var mac string
		if err := rows.Scan(&subID, &mac); err != nil {
			continue
		}

		// Host Protection: NEVER block the host laptop
		hostMAC := ""
		if r, ok := m.Router.(*router.RouterClient); ok {
			hostMAC = r.HostMAC
		}
		if hostMAC != "" && mac == hostMAC {
			fmt.Printf("[MONITOR] Host protection: Skipping expiry block for host MAC %s\n", mac)
			// Still mark as expired in DB but don't call router block
			m.DB.Exec("UPDATE subscriptions SET status = 'expired' WHERE id = ?", subID)
			continue
		}

		// Try to find IP in database first
		var ip string
		m.DB.QueryRow("SELECT ip_address FROM devices WHERE mac_address = ?", mac).Scan(&ip)

		fmt.Printf("[MONITOR] Subscription %d expired for MAC %s (IP: %s). Blocking device...\n", subID, mac, ip)
		
		// 1. Call Router to block the MAC
		if m.Router != nil {
			_, err := m.Router.BlockMAC(mac, ip) // Passing IP prevents hang
			if err != nil {
				log.Printf("[MONITOR] Failed to block expired device %s: %v\n", mac, err)
			}
		}

		// 2. Update status to 'expired'
		_, err = m.DB.Exec("UPDATE subscriptions SET status = 'expired' WHERE id = ?", subID)
		if err != nil {
			log.Printf("[MONITOR] Failed to update subscription %d to expired: %v\n", subID, err)
		}

		// 3. Update device status in devices table
		_, err = m.DB.Exec("UPDATE devices SET status = 'blocked' WHERE mac_address = ?", mac)
		if err != nil {
			log.Printf("[MONITOR] Failed to update device status for MAC %s: %v\n", mac, err)
		}
	}
}
