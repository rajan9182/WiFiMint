package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"github.com/gorilla/mux"
)

type Plan struct {
	ID              int     `json:"id"`
	Name            string  `json:"name"`
	DurationMinutes int     `json:"duration_minutes"`
	Price           float64 `json:"price"`
	DataLimitMB     int     `json:"data_limit_mb"`
}

type PlansHandler struct {
	DB *sql.DB
}

func (h *PlansHandler) CreatePlan(w http.ResponseWriter, r *http.Request) {
	var p Plan
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := h.DB.Exec("INSERT INTO plans (name, duration_minutes, price, data_limit_mb) VALUES (?, ?, ?, ?)",
		p.Name, p.DurationMinutes, p.Price, p.DataLimitMB)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()
	p.ID = int(id)
	json.NewEncoder(w).Encode(p)
}

func (h *PlansHandler) GetPlans(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query("SELECT id, name, duration_minutes, price, data_limit_mb FROM plans")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var plans []Plan
	for rows.Next() {
		var p Plan
		if err := rows.Scan(&p.ID, &p.Name, &p.DurationMinutes, &p.Price, &p.DataLimitMB); err != nil {
			continue
		}
		plans = append(plans, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plans)
}

func (h *PlansHandler) DeletePlan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	_, err := h.DB.Exec("DELETE FROM plans WHERE id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Plan deleted"})
}
