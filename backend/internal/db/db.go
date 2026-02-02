package db

import (
	"database/sql"
	"fmt"
	
	_ "github.com/mattn/go-sqlite3"
)

type DBStore struct {
	DB *sql.DB
}

func InitDB(dbPath string) (*DBStore, error) {
	// 1. Initialize SQLite with WAL mode for concurrency
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite: %v", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping sqlite: %v", err)
	}

	// Enable WAL Mode (Crucial for preventing "database is locked" errors)
	if _, err := db.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		fmt.Printf("Warning: Failed to enable WAL mode: %v\n", err)
	} else {
		fmt.Println("SQLite WAL Mode enabled.")
	}

	return &DBStore{
		DB: db,
	}, nil
}

func (s *DBStore) CreateTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			role TEXT DEFAULT 'user', -- 'admin' or 'user'
			status TEXT DEFAULT 'active',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS devices (
			mac_address TEXT PRIMARY KEY,
			user_id INTEGER,
			device_name TEXT,
			ip_address TEXT,
			status TEXT DEFAULT 'blocked', -- 'blocked', 'allowed'
			last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(user_id) REFERENCES users(id)
		);`,
		`CREATE TABLE IF NOT EXISTS plans (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			duration_minutes INTEGER NOT NULL,
			price REAL NOT NULL,
			data_limit_mb INTEGER DEFAULT 0
		);`,
		`CREATE TABLE IF NOT EXISTS subscriptions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			mac_address TEXT NOT NULL,
			plan_id INTEGER,
			start_time DATETIME,
			end_time DATETIME,
			status TEXT DEFAULT 'pending', -- 'pending', 'active', 'expired', 'rejected'
			payment_method TEXT,
			amount_paid REAL,
			transaction_id TEXT,
			FOREIGN KEY(mac_address) REFERENCES devices(mac_address),
			FOREIGN KEY(plan_id) REFERENCES plans(id)
		);`,
	}

	for _, q := range queries {
		if _, err := s.DB.Exec(q); err != nil {
			return fmt.Errorf("failed to execute schema: %v", err)
		}
	}

	// Migrations: Add new columns to existing subscriptions table if they don't exist
	s.DB.Exec("ALTER TABLE subscriptions ADD COLUMN payment_method TEXT;")
	s.DB.Exec("ALTER TABLE subscriptions ADD COLUMN amount_paid REAL;")
	s.DB.Exec("ALTER TABLE subscriptions ADD COLUMN transaction_id TEXT;")
	
	return nil
}

// EnsureAdminExists ensures a default admin user exists
func (s *DBStore) EnsureAdminExists(username, hashedPassword string) {
	var count int
	s.DB.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", username).Scan(&count)
	if count == 0 {
		_, err := s.DB.Exec("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')", username, hashedPassword)
		if err != nil {
			fmt.Printf("Failed to create default admin: %v\n", err)
		} else {
			fmt.Printf("Created default admin user: %s\n", username)
		}
	}
}

// UpsertDevice inserts or updates a device record
func (s *DBStore) UpsertDevice(mac, ip, name, status string) error {
	_, err := s.DB.Exec(`
		INSERT INTO devices (mac_address, ip_address, device_name, status, last_seen)
		VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(mac_address) DO UPDATE SET
			ip_address = excluded.ip_address,
			last_seen = CURRENT_TIMESTAMP`,
		mac, ip, name, status)
	return err
}

// GetAllDevices returns all devices from the database
func (s *DBStore) GetAllDevices() ([]map[string]interface{}, error) {
	rows, err := s.DB.Query("SELECT mac_address, device_name, ip_address, status, last_seen FROM devices ORDER BY last_seen DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []map[string]interface{}
	for rows.Next() {
		var mac, name, ip, status, lastSeen string
		if err := rows.Scan(&mac, &name, &ip, &status, &lastSeen); err != nil {
			continue
		}
		devices = append(devices, map[string]interface{}{
			"mac":       mac,
			"name":      name,
			"ip":        ip,
			"status":    status,
			"last_seen": lastSeen,
		})
	}
	return devices, nil
}

// UpdateDeviceName allows editing device labels
func (s *DBStore) UpdateDeviceName(mac, name string) error {
	_, err := s.DB.Exec("UPDATE devices SET device_name = ? WHERE mac_address = ?", name, mac)
	return err
}

// FlushData clears activity data (subscriptions and devices) but keeps users and plans
func (s *DBStore) FlushData() error {
	// 1. Clear subscriptions
	if _, err := s.DB.Exec("DELETE FROM subscriptions"); err != nil {
		return err
	}
	// 2. Clear devices
	if _, err := s.DB.Exec("DELETE FROM devices"); err != nil {
		return err
	}
	// 3. Reset internal counters if needed
	s.DB.Exec("DELETE FROM sqlite_sequence WHERE name IN ('subscriptions', 'devices')")
	return nil
}

// UpdateAdminPassword changes the password for the specified admin user
func (s *DBStore) UpdateAdminPassword(username, newHashedPassword string) error {
	_, err := s.DB.Exec("UPDATE users SET password_hash = ? WHERE username = ? AND role = 'admin'", newHashedPassword, username)
	return err
}
