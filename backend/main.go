package main

import (
	"fmt"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/mux"
	"github.com/user/wifi-control-system/internal/api"
	"github.com/user/wifi-control-system/internal/auth" // New Import
	"github.com/user/wifi-control-system/internal/db"
	"github.com/user/wifi-control-system/internal/dns"
	"github.com/user/wifi-control-system/internal/router"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	fmt.Println("-----------------------------------------------")
	fmt.Println("🚀 WiFiMint Backend Engine Started")
	fmt.Println("Designed & Developed by Rajan Goswami")
	fmt.Println("-----------------------------------------------")

	// 1. Initialize Database (SQLite)
	store, err := db.InitDB("wifi.db?_parse_time=true")
	if err != nil {
		log.Fatalf("Database initialization failed: %v", err)
	}
	// Create tables and default admin
	if err := store.CreateTables(); err != nil {
		log.Fatalf("Failed to create tables: %v", err)
	}
	
	// Ensure default admin exists
	hash, _ := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
	store.EnsureAdminExists("admin", string(hash))

	// 2. Initialize Router Client (Local Mode)
	hotspotInterface := os.Getenv("HOTSPOT_INTERFACE")
	if hotspotInterface == "" { hotspotInterface = "wlp0s20f3" } // Default wireless interface

	routerClient := router.NewRouterClient(hotspotInterface)
	// We don't fail hard here if not root, just warn, because we might test logic.
	if err := routerClient.Connect(); err != nil {
		// The branding logs were previously here, but have been moved to the start of main.
		// This block now remains for potential future error handling specific to routerClient.Connect().
	}
	
	// Setup Signal Handling for Cleanup
	// TODO: Implement proper graceful shutdown

	// 3. Start DNS Server (Captive Portal)
	laptopIP := os.Getenv("ROUTER_IP")
	if laptopIP == "" { 
		laptopIP = "192.168.1.1" 
		log.Println("Warning: ROUTER_IP not set. DNS Redirection might point to wrong IP.")
	}

	// Setup Captive Portal (iptables)
	if err := routerClient.SetupCaptivePortal(laptopIP); err != nil {
		log.Printf("Captive Portal Setup Error: %v\n", err)
	}
	defer routerClient.Cleanup()

	dnsServer := dns.NewDNSServer(laptopIP)
	go func() {
		if err := dnsServer.Start(); err != nil {
			log.Printf("DNS Server Error: %v\n", err)
		}
	}()
	defer dnsServer.Stop()

	// 4. Initialize Services
	authService := auth.NewAuthService(store.DB)
	authHandler := &api.AuthHandler{Router: routerClient} 
	plansHandler := &api.PlansHandler{DB: store.DB}
	subsHandler := &api.SubscriptionsHandler{DB: store.DB, Router: routerClient}
	
	// Start Subscription Expiry Monitor
	monitor := &api.SubscriptionMonitor{DB: store.DB, Router: routerClient}
	monitor.Start()
	monitor.SyncAllowedDevices()

	r := mux.NewRouter()

	// Public API Routes
	r.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Wi-Fi Control System is running! DB Status: Connected")
	}).Methods("GET")
	
	// Admin Auth
	r.HandleFunc("/api/admin/login", authService.Login).Methods("POST")

	// Protected Admin Routes
	adminRouter := r.PathPrefix("/api/admin").Subrouter()
	adminRouter.Use(authService.Middleware)
	adminRouter.HandleFunc("/dashboard", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"message": "Welcome Admin!"})
	}).Methods("GET")
	
	// Plans Management
	adminRouter.HandleFunc("/plans", plansHandler.GetPlans).Methods("GET")
	adminRouter.HandleFunc("/plans", plansHandler.CreatePlan).Methods("POST")
	adminRouter.HandleFunc("/plans/{id}", plansHandler.DeletePlan).Methods("DELETE")
	
	// Subscriptions Management
	adminRouter.HandleFunc("/subscriptions", subsHandler.GetActiveSubscriptions).Methods("GET")
	adminRouter.HandleFunc("/all-subscriptions", subsHandler.GetAllSubscriptions).Methods("GET")
	adminRouter.HandleFunc("/assign-plan", subsHandler.AssignPlan).Methods("POST")
	adminRouter.HandleFunc("/revoke-subscription", subsHandler.RevokeSubscription).Methods("POST")
	adminRouter.HandleFunc("/pending-requests", subsHandler.GetPendingRequests).Methods("GET")
	adminRouter.HandleFunc("/approve-subscription", subsHandler.ApproveSubscription).Methods("POST")
	adminRouter.HandleFunc("/reject-subscription", subsHandler.RejectSubscription).Methods("POST")
	adminRouter.HandleFunc("/stats", subsHandler.GetStats).Methods("GET")
	adminRouter.HandleFunc("/revenue-stats", subsHandler.GetRevenueStats).Methods("GET")
	adminRouter.HandleFunc("/system-status", subsHandler.GetSystemStatus).Methods("GET")
	adminRouter.HandleFunc("/change-password", authService.ChangePassword).Methods("POST")
	adminRouter.HandleFunc("/flush-data", subsHandler.FlushData).Methods("POST")

	// Customer Base Management
	adminRouter.HandleFunc("/customers", func(w http.ResponseWriter, r *http.Request) {
		devices, err := store.GetAllDevices()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(devices)
	}).Methods("GET")

	adminRouter.HandleFunc("/customers/{mac}/name", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		mac := vars["mac"]
		var req struct { Name string `json:"name"` }
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := store.UpdateDeviceName(mac, req.Name); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"message": "Name updated"})
	}).Methods("PUT")

	// Device Scanning Endpoint
	r.HandleFunc("/api/devices", func(w http.ResponseWriter, r *http.Request) {
		devices, err := routerClient.GetConnectedDevices()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(devices)
	}).Methods("GET")

	// Block Device Endpoint
	r.HandleFunc("/api/block", func(w http.ResponseWriter, r *http.Request) {
		var req struct { 
			Mac string `json:"mac"`
			IP  string `json:"ip"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		
		fmt.Printf("API: Blocking MAC %s (IP: %s)\n", req.Mac, req.IP)
		msg, err := routerClient.BlockMAC(req.Mac, req.IP)
		if err != nil {
			log.Printf("BlockMAC Failed: %v\n", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// Sync with DB
		store.DB.Exec("UPDATE devices SET status = 'blocked' WHERE mac_address = ?", req.Mac)
		json.NewEncoder(w).Encode(map[string]string{"message": msg})
	}).Methods("POST")

	// Unblock Device Endpoint
	r.HandleFunc("/api/unblock", func(w http.ResponseWriter, r *http.Request) {
		var req struct { Mac string `json:"mac"` }
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		
		fmt.Printf("[API] REQUEST: Unblock MAC %s\n", req.Mac)
		msg, err := routerClient.AllowMAC(req.Mac)
		if err != nil {
			log.Printf("AllowMAC Failed: %v\n", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// Sync with DB
		store.DB.Exec("UPDATE devices SET status = 'allowed' WHERE mac_address = ?", req.Mac)
		json.NewEncoder(w).Encode(map[string]string{"message": msg})
	}).Methods("POST")
	
	// Legacy Client Login (Captive Portal)
	r.HandleFunc("/api/auth/login", authHandler.Login).Methods("POST")
	r.HandleFunc("/api/auth/logout", authHandler.Logout).Methods("POST")
	
	// Public Plans and Request Flow
	r.HandleFunc("/api/public/plans", plansHandler.GetPlans).Methods("GET")
	r.HandleFunc("/api/auth/request-plan", subsHandler.RequestPlan).Methods("POST")
	r.HandleFunc("/api/auth/status", subsHandler.CheckStatus).Methods("GET")
	r.HandleFunc("/api/auth/whoami", subsHandler.WhoAmI).Methods("GET")

	// Static Frontend Files (SPA Support)
	// We detect the correct path whether run from root or from backend folder
	frontendDist := "frontend/dist"
	if _, err := os.Stat(frontendDist); os.IsNotExist(err) {
		frontendDist = "../frontend/dist"
	}
	
	fmt.Printf("Serving frontend from: %s\n", frontendDist)
	spaHandler := http.FileServer(http.Dir(frontendDist))
	r.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		path := r.URL.Path

		// Normalize host (remove port 8080 if present for easier matching)
		cleanHost := host
		if strings.Contains(host, ":") {
			cleanHost = strings.Split(host, ":")[0]
		}

		// 1. ALLOWED PATHS (Never redirect these if requested from a trusted host)
		isPortalPath := path == "/login" || path == "/" || path == "/admin" || strings.HasPrefix(path, "/admin/")
		isApiReq := strings.HasPrefix(path, "/api")
		isStaticAsset := strings.HasPrefix(path, "/assets/") || strings.HasPrefix(path, "/static/") || 
						  path == "/favicon.ico" || path == "/payment.jpeg" ||
						  strings.HasSuffix(path, ".js") || strings.HasSuffix(path, ".css") || 
						  strings.HasSuffix(path, ".png") || strings.HasSuffix(path, ".jpg") ||
						  strings.HasSuffix(path, ".json")

		// 2. TRUSTED HOSTS (The laptop itself)
		isTrustedHost := cleanHost == laptopIP || cleanHost == "localhost" || cleanHost == "127.0.0.1"

		// 3. CAPTIVE PORTAL PROBES (Always catch these)
		isProbe := strings.Contains(path, "generate_204") || 
				   strings.Contains(path, "connectivity") || 
				   strings.Contains(path, "hotspot-detect") ||
				   strings.Contains(path, "ncsi") ||
				   strings.Contains(path, "success.txt") ||
				   strings.Contains(path, "kindle-wifi") ||
				   strings.Contains(path, "wifiredirect")

		// SERVE LOGIC:
		if isTrustedHost && (isPortalPath || isApiReq || isStaticAsset) {
			if isApiReq { return } // Let mux handle API

			filePath := frontendDist + path
			if path == "/" || path == "/login" {
				filePath = frontendDist + "/index.html"
			}
			
			if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
				spaHandler.ServeHTTP(w, r)
				return
			}
			
			if !isStaticAsset {
				// Fallback for SPA routing
				http.ServeFile(w, r, frontendDist+"/index.html")
				return
			}
			
			http.NotFound(w, r)
			return
		}

		// REDIRECT LOGIC:
		// If it's a probe OR it's an untrusted host, send to /login
		fmt.Printf("[PORTAL] Redirecting %s (%s) -> http://%s:8080/login\n", host, path, laptopIP)
		portalURL := fmt.Sprintf("http://%s:8080/login", laptopIP)
		
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
		w.Header().Set("X-Captive-Portal", "true") // Helps some mobile OSs
		
		http.Redirect(w, r, portalURL, http.StatusFound)
	})

	port := ":8080"
	fmt.Printf("Server starting on port %s...\n", port)
	log.Fatal(http.ListenAndServe(port, r))
}
