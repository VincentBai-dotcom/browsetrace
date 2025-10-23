package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/vincentbai/browsetrace-server/internal/database"
	"github.com/vincentbai/browsetrace-server/internal/models"
)

func setupTestServer(t *testing.T) (*Server, func()) {
	t.Helper()

	// Create temporary database
	tmpDir, err := os.MkdirTemp("", "browsetrace-server-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "test.db")
	db, err := database.NewDatabase(dbPath)
	if err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("Failed to create test database: %v", err)
	}

	server := NewServer(db, "127.0.0.1:0") // Port 0 for testing

	cleanup := func() {
		db.Close()
		os.RemoveAll(tmpDir)
	}

	return server, cleanup
}

func TestNewServer(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	if server == nil {
		t.Fatal("Expected non-nil server")
	}
	if server.db == nil {
		t.Fatal("Expected non-nil database")
	}
	if server.address != "127.0.0.1:0" {
		t.Errorf("Expected address 127.0.0.1:0, got %s", server.address)
	}
}

func TestHandleHealthz(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	w := httptest.NewRecorder()

	server.handleHealthz(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	body := w.Body.String()
	if body != "ok" {
		t.Errorf("Expected body 'ok', got %s", body)
	}
}

func TestHandleEventsSuccess(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	title := "Test Page"
	batch := models.Batch{
		Events: []models.Event{
			{
				TSUTC: 1234567890,
				TSISO: "2009-02-13T23:31:30Z",
				URL:   "https://example.com",
				Title: &title,
				Type:  "navigate",
				Data:  map[string]any{"referrer": "https://google.com"},
			},
		},
	}

	jsonData, _ := json.Marshal(batch)
	req := httptest.NewRequest(http.MethodPost, "/events", bytes.NewReader(jsonData))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.handleEvents(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("Expected status 204, got %d", resp.StatusCode)
	}
}

func TestHandleEventsMethodNotAllowed(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// PUT is not allowed
	req := httptest.NewRequest(http.MethodPut, "/events", nil)
	w := httptest.NewRecorder()

	server.handleEvents(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", resp.StatusCode)
	}
}

func TestHandleEventsInvalidJSON(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	invalidJSON := []byte(`{"events": [invalid json]}`)
	req := httptest.NewRequest(http.MethodPost, "/events", bytes.NewReader(invalidJSON))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.handleEvents(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", resp.StatusCode)
	}
}

func TestHandleEventsEmptyBatch(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	batch := models.Batch{Events: []models.Event{}}
	jsonData, _ := json.Marshal(batch)
	req := httptest.NewRequest(http.MethodPost, "/events", bytes.NewReader(jsonData))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.handleEvents(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("Expected status 204, got %d", resp.StatusCode)
	}
}

func TestHandleEventsInvalidEvent(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	batch := models.Batch{
		Events: []models.Event{
			{
				TSUTC: 1234567890,
				TSISO: "2009-02-13T23:31:30Z",
				URL:   "", // Invalid: empty URL
				Type:  "navigate",
				Data:  map[string]any{},
			},
		},
	}

	jsonData, _ := json.Marshal(batch)
	req := httptest.NewRequest(http.MethodPost, "/events", bytes.NewReader(jsonData))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.handleEvents(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", resp.StatusCode)
	}
}

func TestHandleEventsMultipleEvents(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	title1 := "Page 1"
	title2 := "Page 2"
	batch := models.Batch{
		Events: []models.Event{
			{
				TSUTC: 1234567890,
				TSISO: "2009-02-13T23:31:30Z",
				URL:   "https://example.com",
				Title: &title1,
				Type:  "navigate",
				Data:  map[string]any{},
			},
			{
				TSUTC: 1234567891,
				TSISO: "2009-02-13T23:31:31Z",
				URL:   "https://example.com/page2",
				Title: &title2,
				Type:  "click",
				Data:  map[string]any{"x": 100, "y": 200},
			},
			{
				TSUTC: 1234567892,
				TSISO: "2009-02-13T23:31:32Z",
				URL:   "https://example.com/page3",
				Title: nil,
				Type:  "focus",
				Data:  map[string]any{"element": "input"},
			},
		},
	}

	jsonData, _ := json.Marshal(batch)
	req := httptest.NewRequest(http.MethodPost, "/events", bytes.NewReader(jsonData))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.handleEvents(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("Expected status 204, got %d", resp.StatusCode)
	}
}

func TestSetupRoutes(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	mux := server.setupRoutes()
	if mux == nil {
		t.Fatal("Expected non-nil ServeMux")
	}

	// Test that routes are registered
	tests := []struct {
		path   string
		method string
		status int
	}{
		{"/healthz", http.MethodGet, http.StatusOK},
		{"/events", http.MethodGet, http.StatusOK}, // Now GET is allowed
		{"/events", http.MethodPost, http.StatusNoContent},
	}

	for _, tt := range tests {
		t.Run(tt.path+"_"+tt.method, func(t *testing.T) {
			var req *http.Request
			if tt.method == http.MethodPost {
				// Empty batch for POST
				batch := models.Batch{Events: []models.Event{}}
				jsonData, _ := json.Marshal(batch)
				req = httptest.NewRequest(tt.method, tt.path, bytes.NewReader(jsonData))
			} else {
				req = httptest.NewRequest(tt.method, tt.path, nil)
			}
			w := httptest.NewRecorder()

			mux.ServeHTTP(w, req)

			if w.Code != tt.status {
				t.Errorf("Expected status %d for %s %s, got %d", tt.status, tt.method, tt.path, w.Code)
			}
		})
	}
}

func TestHandleEventsContentType(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	title := "Test"
	batch := models.Batch{
		Events: []models.Event{
			{
				TSUTC: 1234567890,
				TSISO: "2009-02-13T23:31:30Z",
				URL:   "https://example.com",
				Title: &title,
				Type:  "navigate",
				Data:  map[string]any{},
			},
		},
	}

	jsonData, _ := json.Marshal(batch)
	req := httptest.NewRequest(http.MethodPost, "/events", bytes.NewReader(jsonData))
	// Not setting Content-Type header to test robustness
	w := httptest.NewRecorder()

	server.handleEvents(w, req)

	resp := w.Result()
	// Should still work without Content-Type
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("Expected status 204, got %d", resp.StatusCode)
	}
}

func TestHandleGetEventsEmpty(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/events", nil)
	w := httptest.NewRecorder()

	server.handleEvents(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var batch models.Batch
	if err := json.NewDecoder(resp.Body).Decode(&batch); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(batch.Events) != 0 {
		t.Errorf("Expected 0 events, got %d", len(batch.Events))
	}
}

func TestHandleGetEventsWithData(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// Insert test events
	title := "Test Page"
	insertBatch := models.Batch{
		Events: []models.Event{
			{
				TSUTC: 1000000000000,
				TSISO: "2001-09-09T01:46:40Z",
				URL:   "https://example.com",
				Title: &title,
				Type:  "navigate",
				Data:  map[string]any{"foo": "bar"},
			},
			{
				TSUTC: 2000000000000,
				TSISO: "2033-05-18T03:33:20Z",
				URL:   "https://example.com",
				Type:  "click",
				Data:  map[string]any{"x": 100},
			},
		},
	}

	jsonData, _ := json.Marshal(insertBatch)
	postReq := httptest.NewRequest(http.MethodPost, "/events", bytes.NewReader(jsonData))
	postW := httptest.NewRecorder()
	server.handleEvents(postW, postReq)

	// Now GET the events
	getReq := httptest.NewRequest(http.MethodGet, "/events", nil)
	getW := httptest.NewRecorder()
	server.handleEvents(getW, getReq)

	resp := getW.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var batch models.Batch
	if err := json.NewDecoder(resp.Body).Decode(&batch); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(batch.Events) != 2 {
		t.Errorf("Expected 2 events, got %d", len(batch.Events))
	}

	// Verify events are in descending order
	if batch.Events[0].TSUTC < batch.Events[1].TSUTC {
		t.Error("Events should be in descending order")
	}
}

func TestHandleGetEventsByType(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// Insert events of different types
	insertBatch := models.Batch{
		Events: []models.Event{
			{
				TSUTC: 1000000000000,
				TSISO: "2001-09-09T01:46:40Z",
				URL:   "https://example.com",
				Type:  "navigate",
				Data:  map[string]any{},
			},
			{
				TSUTC: 2000000000000,
				TSISO: "2033-05-18T03:33:20Z",
				URL:   "https://example.com",
				Type:  "click",
				Data:  map[string]any{},
			},
			{
				TSUTC: 3000000000000,
				TSISO: "2065-01-24T05:20:00Z",
				URL:   "https://example.com",
				Type:  "click",
				Data:  map[string]any{},
			},
		},
	}

	jsonData, _ := json.Marshal(insertBatch)
	postReq := httptest.NewRequest(http.MethodPost, "/events", bytes.NewReader(jsonData))
	postW := httptest.NewRecorder()
	server.handleEvents(postW, postReq)

	// Get only click events
	getReq := httptest.NewRequest(http.MethodGet, "/events?type=click", nil)
	getW := httptest.NewRecorder()
	server.handleEvents(getW, getReq)

	resp := getW.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var batch models.Batch
	if err := json.NewDecoder(resp.Body).Decode(&batch); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(batch.Events) != 2 {
		t.Errorf("Expected 2 click events, got %d", len(batch.Events))
	}

	for _, event := range batch.Events {
		if event.Type != "click" {
			t.Errorf("Expected only click events, got %s", event.Type)
		}
	}
}

func TestHandleGetEventsBySince(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// Insert events at different times
	insertBatch := models.Batch{
		Events: []models.Event{
			{
				TSUTC: 1000000000000,
				TSISO: "2001-09-09T01:46:40Z",
				URL:   "https://example.com",
				Type:  "navigate",
				Data:  map[string]any{},
			},
			{
				TSUTC: 2000000000000,
				TSISO: "2033-05-18T03:33:20Z",
				URL:   "https://example.com",
				Type:  "click",
				Data:  map[string]any{},
			},
			{
				TSUTC: 3000000000000,
				TSISO: "2065-01-24T05:20:00Z",
				URL:   "https://example.com",
				Type:  "focus",
				Data:  map[string]any{},
			},
		},
	}

	jsonData, _ := json.Marshal(insertBatch)
	postReq := httptest.NewRequest(http.MethodPost, "/events", bytes.NewReader(jsonData))
	postW := httptest.NewRecorder()
	server.handleEvents(postW, postReq)

	// Get events after 1500000000000
	getReq := httptest.NewRequest(http.MethodGet, "/events?since=1500000000000", nil)
	getW := httptest.NewRecorder()
	server.handleEvents(getW, getReq)

	resp := getW.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var batch models.Batch
	if err := json.NewDecoder(resp.Body).Decode(&batch); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(batch.Events) != 2 {
		t.Errorf("Expected 2 events after timestamp, got %d", len(batch.Events))
	}

	for _, event := range batch.Events {
		if event.TSUTC < 1500000000000 {
			t.Errorf("Event timestamp %d is before since 1500000000000", event.TSUTC)
		}
	}
}

func TestHandleGetEventsWithLimit(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// Insert 5 events
	events := []models.Event{}
	for i := 0; i < 5; i++ {
		events = append(events, models.Event{
			TSUTC: int64(1000000000000 + i*1000),
			TSISO: "2001-09-09T01:46:40Z",
			URL:   "https://example.com",
			Type:  "navigate",
			Data:  map[string]any{},
		})
	}
	insertBatch := models.Batch{Events: events}

	jsonData, _ := json.Marshal(insertBatch)
	postReq := httptest.NewRequest(http.MethodPost, "/events", bytes.NewReader(jsonData))
	postW := httptest.NewRecorder()
	server.handleEvents(postW, postReq)

	// Get only 3 events
	getReq := httptest.NewRequest(http.MethodGet, "/events?limit=3", nil)
	getW := httptest.NewRecorder()
	server.handleEvents(getW, getReq)

	resp := getW.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var batch models.Batch
	if err := json.NewDecoder(resp.Body).Decode(&batch); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(batch.Events) != 3 {
		t.Errorf("Expected 3 events with limit, got %d", len(batch.Events))
	}
}

func TestHandleGetEventsInvalidSince(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/events?since=invalid", nil)
	w := httptest.NewRecorder()
	server.handleEvents(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for invalid since, got %d", resp.StatusCode)
	}
}

func TestHandleGetEventsInvalidLimit(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/events?limit=invalid", nil)
	w := httptest.NewRecorder()
	server.handleEvents(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for invalid limit, got %d", resp.StatusCode)
	}
}

func TestHandleGetEventsNegativeLimit(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/events?limit=-1", nil)
	w := httptest.NewRecorder()
	server.handleEvents(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for negative limit, got %d", resp.StatusCode)
	}
}

func TestHandleGetEventsCombinedFilters(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// Insert various events
	insertBatch := models.Batch{
		Events: []models.Event{
			{
				TSUTC: 1000000000000,
				TSISO: "2001-09-09T01:46:40Z",
				URL:   "https://example.com",
				Type:  "navigate",
				Data:  map[string]any{},
			},
			{
				TSUTC: 2000000000000,
				TSISO: "2033-05-18T03:33:20Z",
				URL:   "https://example.com",
				Type:  "click",
				Data:  map[string]any{},
			},
			{
				TSUTC: 2500000000000,
				TSISO: "2049-03-11T17:06:40Z",
				URL:   "https://example.com",
				Type:  "click",
				Data:  map[string]any{},
			},
			{
				TSUTC: 3000000000000,
				TSISO: "2065-01-24T05:20:00Z",
				URL:   "https://example.com",
				Type:  "click",
				Data:  map[string]any{},
			},
		},
	}

	jsonData, _ := json.Marshal(insertBatch)
	postReq := httptest.NewRequest(http.MethodPost, "/events", bytes.NewReader(jsonData))
	postW := httptest.NewRecorder()
	server.handleEvents(postW, postReq)

	// Get click events after 1500000000000 with limit 2
	getReq := httptest.NewRequest(http.MethodGet, "/events?type=click&since=1500000000000&limit=2", nil)
	getW := httptest.NewRecorder()
	server.handleEvents(getW, getReq)

	resp := getW.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var batch models.Batch
	if err := json.NewDecoder(resp.Body).Decode(&batch); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(batch.Events) != 2 {
		t.Errorf("Expected 2 events with combined filters, got %d", len(batch.Events))
	}

	for _, event := range batch.Events {
		if event.Type != "click" {
			t.Errorf("Expected only click events, got %s", event.Type)
		}
		if event.TSUTC < 1500000000000 {
			t.Errorf("Event timestamp %d is before since 1500000000000", event.TSUTC)
		}
	}
}
