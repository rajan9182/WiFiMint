package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Subscription struct {
	ID            int       `json:"id"`
	MacAddress    string    `json:"mac_address"`
	PlanID        int       `json:"plan_id"`
	PlanName      string    `json:"plan_name"`
	StartTime     time.Time `json:"start_time"`
	EndTime       time.Time `json:"end_time"`
	Status        string    `json:"status"`
	Price         float64   `json:"price"`
	PaymentMethod string    `json:"payment_method"`
	AmountPaid    float64   `json:"amount_paid"`
	TransactionID string    `json:"transaction_id"`
	Mobile        string    `json:"mobile"`
}

type SubscriptionsHandler struct {
	DB     *sql.DB
	Router interface {
		AllowMAC(mac string) (string, error)
		BlockMAC(mac string, ip string) (string, error)
		FindIPbyMAC(mac string) (string, error)
		FindMACbyIP(ip string) (string, error)
		GetSystemInfo() map[string]interface{}
	}
}

func (h *SubscriptionsHandler) RequestPlan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MacAddress    string  `json:"mac_address"`
		PlanID        int     `json:"plan_id"`
		Mobile        string  `json:"mobile"`
		PaymentMethod string  `json:"payment_method"`
		AmountPaid    float64 `json:"amount_paid"`
		TransactionID string  `json:"transaction_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Insert as 'pending' with payment details
	_, err := h.DB.Exec(`
		INSERT INTO subscriptions (mac_address, plan_id, status, payment_method, amount_paid, transaction_id) 
		VALUES (?, ?, 'pending', ?, ?, ?)`,
		req.MacAddress, req.PlanID, req.PaymentMethod, req.AmountPaid, req.TransactionID)
	
	if err != nil {
		http.Error(w, fmt.Sprintf("Request failed: %v", err), http.StatusInternalServerError)
		return
	}

	// Update device name to mobile number if it exists
	h.DB.Exec("UPDATE devices SET device_name = ? WHERE mac_address = ?", req.Mobile, req.MacAddress)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Request sent for approval"})
}

func (h *SubscriptionsHandler) ApproveSubscription(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SubscriptionID int `json:"subscription_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// 1. Get Subscription and Plan details
	var mac string
	var durationMins int
	err := h.DB.QueryRow(`
		SELECT s.mac_address, p.duration_minutes 
		FROM subscriptions s 
		JOIN plans p ON s.plan_id = p.id 
		WHERE s.id = ?`, req.SubscriptionID).Scan(&mac, &durationMins)
	
	if err != nil {
		http.Error(w, "Subscription not found", http.StatusNotFound)
		return
	}

	startTime := time.Now()
	endTime := startTime.Add(time.Duration(durationMins) * time.Minute)

	// 2. Activate Subscription
	_, err = h.DB.Exec(`
		UPDATE subscriptions SET 
			start_time = ?, 
			end_time = ?, 
			status = 'active' 
		WHERE id = ?`,
		startTime, endTime, req.SubscriptionID)
	
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 3. Unblock Device
	if h.Router != nil {
		h.Router.AllowMAC(mac)
	}
	h.DB.Exec("UPDATE devices SET status = 'allowed' WHERE mac_address = ?", mac)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Subscription approved and activated"})
}

func (h *SubscriptionsHandler) RejectSubscription(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SubscriptionID int `json:"subscription_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Update status to rejected
	_, err := h.DB.Exec(`UPDATE subscriptions SET status = 'rejected' WHERE id = ?`, req.SubscriptionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Subscription rejected"})
}

func (h *SubscriptionsHandler) GetPendingRequests(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT s.id, s.mac_address, d.device_name, p.name, p.price, p.duration_minutes, 
		       COALESCE(s.payment_method, ''), COALESCE(s.amount_paid, 0), COALESCE(s.transaction_id, '')
		FROM subscriptions s
		JOIN plans p ON s.plan_id = p.id
		JOIN devices d ON s.mac_address = d.mac_address
		WHERE s.status = 'pending'`)
	
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var requests []map[string]interface{}
	for rows.Next() {
		var id, duration int
		var mac, mobile, planName, payMethod, txID string
		var price, amtPaid float64
		if err := rows.Scan(&id, &mac, &mobile, &planName, &price, &duration, &payMethod, &amtPaid, &txID); err != nil {
			fmt.Printf("[API] Error scanning pending request: %v\n", err)
			continue
		}
		requests = append(requests, map[string]interface{}{
			"id":               id,
			"mac_address":      mac,
			"mobile":           mobile,
			"plan_name":        planName,
			"price":            price,
			"duration":         duration,
			"payment_method":   payMethod,
			"amount_paid":      amtPaid,
			"transaction_id":   txID,
		})
	}
	json.NewEncoder(w).Encode(requests)
}

func (h *SubscriptionsHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	var totalRevenue float64
	var activeUsers int
	var totalPlans int
	var blockedDevices int
	var totalDevices int
	var pendingRequests int

	// Revenue now uses amount_paid if available, otherwise price from plan
	h.DB.QueryRow(`
		SELECT SUM(COALESCE(s.amount_paid, p.price, 0)) 
		FROM subscriptions s 
		LEFT JOIN plans p ON s.plan_id = p.id 
		WHERE s.status IN ('active', 'expired')`).Scan(&totalRevenue)
	
	h.DB.QueryRow("SELECT COUNT(*) FROM subscriptions WHERE status = 'active'").Scan(&activeUsers)
	h.DB.QueryRow("SELECT COUNT(*) FROM plans").Scan(&totalPlans)
	h.DB.QueryRow("SELECT COUNT(*) FROM devices WHERE status = 'blocked'").Scan(&blockedDevices)
	h.DB.QueryRow("SELECT COUNT(*) FROM devices").Scan(&totalDevices)
	h.DB.QueryRow("SELECT COUNT(*) FROM subscriptions WHERE status = 'pending'").Scan(&pendingRequests)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_revenue":    totalRevenue,
		"active_users":     activeUsers,
		"total_plans":      totalPlans,
		"blocked_devices":  blockedDevices,
		"total_devices":    totalDevices,
		"pending_requests": pendingRequests,
	})
}

func (h *SubscriptionsHandler) AssignPlan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MacAddress string `json:"mac_address"`
		PlanID     int    `json:"plan_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// 1. Get Plan details
	var durationMins int
	err := h.DB.QueryRow("SELECT duration_minutes FROM plans WHERE id = ?", req.PlanID).Scan(&durationMins)
	if err != nil {
		http.Error(w, "Plan not found", http.StatusNotFound)
		return
	}

	startTime := time.Now()
	endTime := startTime.Add(time.Duration(durationMins) * time.Minute)

	// 2. Insert Subscription
	_, err = h.DB.Exec(`
		INSERT INTO subscriptions (mac_address, plan_id, start_time, end_time, status) 
		VALUES (?, ?, ?, ?, 'active')`,
		req.MacAddress, req.PlanID, startTime, endTime)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to assign plan: %v", err), http.StatusInternalServerError)
		return
	}

	// 3. Inform Router and update Device status
	if h.Router != nil {
		fmt.Printf("[API] AssignPlan: Allowing MAC %s\n", req.MacAddress)
		h.Router.AllowMAC(req.MacAddress)
	}
	
	// Update device status in database to 'allowed'
	_, err = h.DB.Exec("UPDATE devices SET status = 'allowed' WHERE mac_address = ?", req.MacAddress)
	if err != nil {
		fmt.Printf("Warning: Failed to update device status in DB: %v\n", err)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Plan assigned successfully"})
}

func (h *SubscriptionsHandler) GetActiveSubscriptions(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT s.id, s.mac_address, s.plan_id, p.name, s.start_time, s.end_time, s.status, p.price 
		FROM subscriptions s
		JOIN plans p ON s.plan_id = p.id
		WHERE s.status = 'active' AND s.end_time > ?`, time.Now())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var subs []Subscription
	for rows.Next() {
		var s Subscription
		var start, end sql.NullTime
		if err := rows.Scan(&s.ID, &s.MacAddress, &s.PlanID, &s.PlanName, &start, &end, &s.Status, &s.Price); err != nil {
			continue
		}
		if start.Valid { s.StartTime = start.Time }
		if end.Valid { s.EndTime = end.Time }
		subs = append(subs, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(subs)
}

func (h *SubscriptionsHandler) GetRevenueStats(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT date(start_time), SUM(COALESCE(p.price, 0))
		FROM subscriptions s
		LEFT JOIN plans p ON s.plan_id = p.id
		WHERE s.status IN ('active', 'expired', 'pending')
		AND start_time IS NOT NULL
		AND start_time >= date('now', '-7 days')
		GROUP BY date(start_time)
		ORDER BY date(start_time) ASC`)
	
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var stats []map[string]interface{}
	for rows.Next() {
		var d string
		var total float64
		rows.Scan(&d, &total)
		stats = append(stats, map[string]interface{}{
			"date":  d,
			"total": total,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
func (h *SubscriptionsHandler) CheckStatus(w http.ResponseWriter, r *http.Request) {
	mac := r.URL.Query().Get("mac")
	if mac == "" {
		http.Error(w, "MAC address is required", http.StatusBadRequest)
		return
	}

	var status string
	err := h.DB.QueryRow(`
		SELECT status 
		FROM subscriptions 
		WHERE mac_address = ? 
		AND (status = 'active' OR status = 'pending' OR status = 'rejected')
		ORDER BY CASE WHEN status = 'active' THEN 1 WHEN status = 'pending' THEN 2 ELSE 3 END ASC, id DESC 
		LIMIT 1`, mac).Scan(&status)

	if err != nil {
		if err == sql.ErrNoRows {
			json.NewEncoder(w).Encode(map[string]string{"status": "none"})
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": status})
}

func (h *SubscriptionsHandler) RevokeSubscription(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SubscriptionID int `json:"subscription_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// 1. Get MAC and status
	var mac, status string
	err := h.DB.QueryRow("SELECT mac_address, status FROM subscriptions WHERE id = ?", req.SubscriptionID).Scan(&mac, &status)
	if err != nil {
		http.Error(w, "Subscription not found", http.StatusNotFound)
		return
	}

	if status != "active" {
		http.Error(w, "Only active subscriptions can be revoked", http.StatusBadRequest)
		return
	}

	// 2. Update status to 'expired' (revoked)
	_, err = h.DB.Exec("UPDATE subscriptions SET status = 'expired' WHERE id = ?", req.SubscriptionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 3. Block Device immediately
	if h.Router != nil {
		// Attempt to find IP for blocking
		ip, _ := h.Router.FindIPbyMAC(mac)
		h.Router.BlockMAC(mac, ip)
	}
	h.DB.Exec("UPDATE devices SET status = 'blocked' WHERE mac_address = ?", mac)

	json.NewEncoder(w).Encode(map[string]string{"message": "Subscription revoked and device blocked"})
}

func (h *SubscriptionsHandler) GetAllSubscriptions(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT s.id, s.mac_address, s.plan_id, COALESCE(p.name, 'Unknown Plan'), 
		       s.start_time, s.end_time, s.status, COALESCE(p.price, 0),
		       COALESCE(s.payment_method, ''), COALESCE(s.amount_paid, 0), COALESCE(s.transaction_id, ''),
		       COALESCE(d.device_name, 'Unknown')
		FROM subscriptions s
		LEFT JOIN plans p ON s.plan_id = p.id
		LEFT JOIN devices d ON s.mac_address = d.mac_address
		ORDER BY s.id DESC`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var subs []Subscription
	for rows.Next() {
		var s Subscription
		var start, end sql.NullTime
		var planName, payMethod, txID, mobile sql.NullString
		var price, amtPaid sql.NullFloat64

		if err := rows.Scan(&s.ID, &s.MacAddress, &s.PlanID, &planName, &start, &end, &s.Status, &price, &payMethod, &amtPaid, &txID, &mobile); err != nil {
			fmt.Printf("[API] Error scanning subscription row %d: %v\n", s.ID, err)
			continue
		}
		
		s.PlanName = "Unknown Plan"
		if planName.Valid { s.PlanName = planName.String }
		if start.Valid { s.StartTime = start.Time }
		if end.Valid { s.EndTime = end.Time }
		if price.Valid { s.Price = price.Float64 }
		if payMethod.Valid { s.PaymentMethod = payMethod.String }
		if amtPaid.Valid { s.AmountPaid = amtPaid.Float64 }
		if txID.Valid { s.TransactionID = txID.String }
		if mobile.Valid { s.Mobile = mobile.String }

		subs = append(subs, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(subs)
}

func (h *SubscriptionsHandler) WhoAmI(w http.ResponseWriter, r *http.Request) {
	// 1. Get IP from request
	ip := r.Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = r.RemoteAddr
		if lastColon := strings.LastIndex(ip, ":"); lastColon != -1 {
			ip = ip[:lastColon]
		}
	}

	// 2. Look up MAC
	mac := "unknown"
	if h.Router != nil {
		m, err := h.Router.FindMACbyIP(ip)
		if err == nil {
			mac = m
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"ip":  ip,
		"mac": mac,
	})
}

func (h *SubscriptionsHandler) GetSystemStatus(w http.ResponseWriter, r *http.Request) {
	if h.Router == nil {
		http.Error(w, "Router not initialized", http.StatusInternalServerError)
		return
	}
	info := h.Router.GetSystemInfo()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}

func (h *SubscriptionsHandler) FlushData(w http.ResponseWriter, r *http.Request) {
	// Call DB Flush logic (We need to cast/wrap s.DB or just do it here)
	// Since h.DB is *sql.DB, we can't call DBStore methods unless we have the store.
	// We'll just execute the queries directly here for simplicity if we don't want to pass DBStore.
	
	// Actually, let's keep it simple and just do it here or in main.
	// For now, raw SQL in handler is fine or better yet, use the DB interface if we had one.
	
	_, err := h.DB.Exec("DELETE FROM subscriptions")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_, err = h.DB.Exec("DELETE FROM devices")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	h.DB.Exec("DELETE FROM sqlite_sequence WHERE name IN ('subscriptions', 'devices')")

	json.NewEncoder(w).Encode(map[string]string{"message": "System data flushed successfully"})
}
