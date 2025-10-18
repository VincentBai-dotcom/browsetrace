package server

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/vincentbai/browsetrace-server/internal/database"
	"github.com/vincentbai/browsetrace-server/internal/models"
)

type Server struct {
	db      *database.Database
	address string
	server  *http.Server
}

func NewServer(db *database.Database, address string) *Server {
	return &Server{
		db:      db,
		address: address,
	}
}

func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	w.Write([]byte("ok"))
}

func (s *Server) handleEvents(w http.ResponseWriter, req *http.Request) {
	switch req.Method {
	case http.MethodPost:
		s.handlePostEvents(w, req)
	case http.MethodGet:
		s.handleGetEvents(w, req)
	default:
		http.Error(w, "GET or POST only", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handlePostEvents(w http.ResponseWriter, req *http.Request) {
	var batch models.Batch
	if err := json.NewDecoder(req.Body).Decode(&batch); err != nil {
		http.Error(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}
	if len(batch.Events) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err := s.db.InsertEvents(batch.Events); err != nil {
		log.Printf("Database error: %v", err)
		http.Error(w, "Failed to store events", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent) // success, no body
}

func (s *Server) handleGetEvents(w http.ResponseWriter, req *http.Request) {
	query := req.URL.Query()
	filter := database.EventFilter{
		Limit: 100, // default limit
	}

	if typeParam := query.Get("type"); typeParam != "" {
		filter.EventType = &typeParam
	}

	if sinceParam := query.Get("since"); sinceParam != "" {
		since, err := strconv.ParseInt(sinceParam, 10, 64)
		if err != nil {
			http.Error(w, "Invalid 'since' parameter: must be Unix timestamp in milliseconds", http.StatusBadRequest)
			return
		}
		filter.SinceUTC = &since
	}

	if untilParam := query.Get("until"); untilParam != "" {
		until, err := strconv.ParseInt(untilParam, 10, 64)
		if err != nil {
			http.Error(w, "Invalid 'until' parameter: must be Unix timestamp in milliseconds", http.StatusBadRequest)
			return
		}
		filter.UntilUTC = &until
	}

	if limitParam := query.Get("limit"); limitParam != "" {
		limit, err := strconv.Atoi(limitParam)
		if err != nil || limit <= 0 {
			http.Error(w, "Invalid 'limit' parameter: must be positive integer", http.StatusBadRequest)
			return
		}
		filter.Limit = limit
	}

	events, err := s.db.GetEvents(filter)
	if err != nil {
		log.Printf("Database error: %v", err)
		http.Error(w, "Failed to retrieve events", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	response := models.Batch{Events: events}
	if events == nil {
		response.Events = []models.Event{}
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("JSON encoding error: %v", err)
	}
}

func (s *Server) setupRoutes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealthz)
	mux.HandleFunc("/events", s.handleEvents)
	return mux
}

func (s *Server) Start() error {
	mux := s.setupRoutes()
	s.server = &http.Server{
		Addr:         s.address,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	// Graceful shutdown
	shutdownChannel := make(chan os.Signal, 1)
	signal.Notify(shutdownChannel, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("BrowserTrace agent listening on %s", s.address)
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Server failed to start:", err)
		}
	}()

	<-shutdownChannel
	log.Println("Shutting down server...")

	shutdownContext, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := s.server.Shutdown(shutdownContext); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited")
	return nil
}
