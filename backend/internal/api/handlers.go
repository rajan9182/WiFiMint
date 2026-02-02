package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"github.com/user/wifi-control-system/internal/router"
)

type AuthHandler struct {
	Router *router.RouterClient
}

type LoginRequest struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	MacAddress string `json:"mac_address"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// 1. Validate User (Dummy check for now)
	if req.Username == "admin" && req.Password == "password" {
		// 2. Success - Tell router to allow MAC
		fmt.Printf("[API] Login SUCCESS: Allowing MAC %s\n", req.MacAddress)
		output, err := h.Router.AllowMAC(req.MacAddress)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to allow user on router: %v", err), http.StatusInternalServerError)
			return
		}

		fmt.Printf("Router Output: %s\n", output)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "Login successful, internet access granted"})
	} else {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
	}
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	mac := r.URL.Query().Get("mac")
	if mac == "" {
		http.Error(w, "MAC address required", http.StatusBadRequest)
		return
	}

	output, err := h.Router.BlockMAC(mac, "")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to block user on router: %v", err), http.StatusInternalServerError)
		return
	}

	fmt.Printf("Router Output: %s\n", output)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Logout successful, access revoked"})
}
