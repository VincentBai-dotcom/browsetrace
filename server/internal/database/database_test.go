package database

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/vincentbai/browsetrace-server/internal/models"
)

func setupTestDB(t *testing.T) (*Database, func()) {
	t.Helper()

	// Create temporary directory for test database
	tmpDir, err := os.MkdirTemp("", "browsetrace-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "test.db")
	db, err := NewDatabase(dbPath)
	if err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("Failed to create test database: %v", err)
	}

	// Return cleanup function
	cleanup := func() {
		db.Close()
		os.RemoveAll(tmpDir)
	}

	return db, cleanup
}

func TestNewDatabase(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	if db == nil {
		t.Fatal("Expected non-nil database")
	}
	if db.db == nil {
		t.Fatal("Expected non-nil sql.DB")
	}
}

func TestValidateEvent(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	tests := []struct {
		name      string
		event     models.Event
		wantError bool
	}{
		{
			name: "valid navigate event",
			event: models.Event{
				TSUTC: 1234567890,
				TSISO: "2009-02-13T23:31:30Z",
				URL:   "https://example.com",
				Type:  "navigate",
				Data:  map[string]any{},
			},
			wantError: false,
		},
		{
			name: "empty URL",
			event: models.Event{
				TSUTC: 1234567890,
				TSISO: "2009-02-13T23:31:30Z",
				URL:   "",
				Type:  "navigate",
				Data:  map[string]any{},
			},
			wantError: true,
		},
		{
			name: "empty type",
			event: models.Event{
				TSUTC: 1234567890,
				TSISO: "2009-02-13T23:31:30Z",
				URL:   "https://example.com",
				Type:  "",
				Data:  map[string]any{},
			},
			wantError: true,
		},
		{
			name: "invalid event type",
			event: models.Event{
				TSUTC: 1234567890,
				TSISO: "2009-02-13T23:31:30Z",
				URL:   "https://example.com",
				Type:  "invalid_type",
				Data:  map[string]any{},
			},
			wantError: true,
		},
		{
			name: "zero timestamp",
			event: models.Event{
				TSUTC: 0,
				TSISO: "2009-02-13T23:31:30Z",
				URL:   "https://example.com",
				Type:  "navigate",
				Data:  map[string]any{},
			},
			wantError: true,
		},
		{
			name: "negative timestamp",
			event: models.Event{
				TSUTC: -1,
				TSISO: "2009-02-13T23:31:30Z",
				URL:   "https://example.com",
				Type:  "navigate",
				Data:  map[string]any{},
			},
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := db.ValidateEvent(tt.event)
			if (err != nil) != tt.wantError {
				t.Errorf("ValidateEvent() error = %v, wantError %v", err, tt.wantError)
			}
		})
	}
}

func TestInsertEvents(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	title := "Test Page"
	events := []models.Event{
		{
			TSUTC: 1234567890,
			TSISO: "2009-02-13T23:31:30Z",
			URL:   "https://example.com",
			Title: &title,
			Type:  "navigate",
			Data:  map[string]any{"referrer": "https://google.com"},
		},
		{
			TSUTC: 1234567891,
			TSISO: "2009-02-13T23:31:31Z",
			URL:   "https://example.com/page2",
			Title: nil,
			Type:  "click",
			Data:  map[string]any{"x": 100, "y": 200},
		},
	}

	err := db.InsertEvents(events)
	if err != nil {
		t.Fatalf("Failed to insert events: %v", err)
	}

	// Verify events were inserted
	var count int
	err = db.db.QueryRow("SELECT COUNT(*) FROM events").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query count: %v", err)
	}

	if count != len(events) {
		t.Errorf("Expected %d events, got %d", len(events), count)
	}
}

func TestInsertEventsInvalidEvent(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	events := []models.Event{
		{
			TSUTC: 1234567890,
			TSISO: "2009-02-13T23:31:30Z",
			URL:   "", // Invalid: empty URL
			Type:  "navigate",
			Data:  map[string]any{},
		},
	}

	err := db.InsertEvents(events)
	if err == nil {
		t.Fatal("Expected error for invalid event, got nil")
	}

	// Verify transaction was rolled back
	var count int
	err = db.db.QueryRow("SELECT COUNT(*) FROM events").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query count: %v", err)
	}

	if count != 0 {
		t.Errorf("Expected 0 events after rollback, got %d", count)
	}
}

func TestAllEventTypes(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	eventTypes := []string{"navigate", "visible_text", "click", "input", "focus"}

	for _, eventType := range eventTypes {
		t.Run(eventType, func(t *testing.T) {
			events := []models.Event{
				{
					TSUTC: 1234567890,
					TSISO: "2009-02-13T23:31:30Z",
					URL:   "https://example.com",
					Type:  eventType,
					Data:  map[string]any{},
				},
			}

			err := db.InsertEvents(events)
			if err != nil {
				t.Errorf("Failed to insert %s event: %v", eventType, err)
			}
		})
	}

	// Verify all events were inserted
	var count int
	err := db.db.QueryRow("SELECT COUNT(*) FROM events").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query count: %v", err)
	}

	if count != len(eventTypes) {
		t.Errorf("Expected %d events, got %d", len(eventTypes), count)
	}
}

func TestInsertEventsWithComplexData(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	events := []models.Event{
		{
			TSUTC: 1234567890,
			TSISO: "2009-02-13T23:31:30Z",
			URL:   "https://example.com",
			Type:  "input",
			Data: map[string]any{
				"field": "email",
				"value": "test@example.com",
				"nested": map[string]any{
					"foo": "bar",
					"baz": 123,
				},
			},
		},
	}

	err := db.InsertEvents(events)
	if err != nil {
		t.Fatalf("Failed to insert event with complex data: %v", err)
	}

	// Verify data was stored as valid JSON
	var dataJSON string
	err = db.db.QueryRow("SELECT data_json FROM events WHERE id = 1").Scan(&dataJSON)
	if err != nil {
		t.Fatalf("Failed to query data_json: %v", err)
	}

	if dataJSON == "" {
		t.Error("Expected non-empty data_json")
	}
}

func TestDatabaseClose(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	err := db.Close()
	if err != nil {
		t.Errorf("Failed to close database: %v", err)
	}
}

func TestGetEventsNoFilter(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Insert test events
	title1 := "Page 1"
	title2 := "Page 2"
	events := []models.Event{
		{
			TSUTC: 1000000000000,
			TSISO: "2001-09-09T01:46:40Z",
			URL:   "https://example.com/1",
			Title: &title1,
			Type:  "navigate",
			Data:  map[string]any{"foo": "bar"},
		},
		{
			TSUTC: 2000000000000,
			TSISO: "2033-05-18T03:33:20Z",
			URL:   "https://example.com/2",
			Title: &title2,
			Type:  "click",
			Data:  map[string]any{"x": 100},
		},
		{
			TSUTC: 3000000000000,
			TSISO: "2065-01-24T05:20:00Z",
			URL:   "https://example.com/3",
			Title: nil,
			Type:  "focus",
			Data:  map[string]any{"element": "input"},
		},
	}

	if err := db.InsertEvents(events); err != nil {
		t.Fatalf("Failed to insert test events: %v", err)
	}

	// Get all events
	filter := EventFilter{Limit: 100}
	results, err := db.GetEvents(filter)
	if err != nil {
		t.Fatalf("GetEvents failed: %v", err)
	}

	if len(results) != 3 {
		t.Errorf("Expected 3 events, got %d", len(results))
	}

	// Should be in descending order (newest first)
	if len(results) >= 2 && results[0].TSUTC < results[1].TSUTC {
		t.Error("Events are not in descending order by timestamp")
	}
}

func TestGetEventsByType(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Insert events of different types
	events := []models.Event{
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
	}

	if err := db.InsertEvents(events); err != nil {
		t.Fatalf("Failed to insert test events: %v", err)
	}

	// Get only click events
	clickType := "click"
	filter := EventFilter{
		EventType: &clickType,
		Limit:     100,
	}
	results, err := db.GetEvents(filter)
	if err != nil {
		t.Fatalf("GetEvents failed: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 click events, got %d", len(results))
	}

	for _, event := range results {
		if event.Type != "click" {
			t.Errorf("Expected only click events, got %s", event.Type)
		}
	}
}

func TestGetEventsByTimeRange(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Insert events at different times
	events := []models.Event{
		{
			TSUTC: 1000000000000, // ~2001
			TSISO: "2001-09-09T01:46:40Z",
			URL:   "https://example.com",
			Type:  "navigate",
			Data:  map[string]any{},
		},
		{
			TSUTC: 2000000000000, // ~2033
			TSISO: "2033-05-18T03:33:20Z",
			URL:   "https://example.com",
			Type:  "click",
			Data:  map[string]any{},
		},
		{
			TSUTC: 3000000000000, // ~2065
			TSISO: "2065-01-24T05:20:00Z",
			URL:   "https://example.com",
			Type:  "focus",
			Data:  map[string]any{},
		},
	}

	if err := db.InsertEvents(events); err != nil {
		t.Fatalf("Failed to insert test events: %v", err)
	}

	// Get events after timestamp 1500000000000
	since := int64(1500000000000)
	filter := EventFilter{
		SinceUTC: &since,
		Limit:    100,
	}
	results, err := db.GetEvents(filter)
	if err != nil {
		t.Fatalf("GetEvents failed: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 events after timestamp, got %d", len(results))
	}

	for _, event := range results {
		if event.TSUTC < since {
			t.Errorf("Event timestamp %d is before since %d", event.TSUTC, since)
		}
	}
}

func TestGetEventsLast24Hours(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	now := int64(1729180800000) // Example: Oct 17, 2024
	yesterday := now - 86400000  // 24 hours ago
	twoDaysAgo := now - 172800000

	// Insert events from different time periods
	events := []models.Event{
		{
			TSUTC: twoDaysAgo,
			TSISO: "2024-10-15T12:00:00Z",
			URL:   "https://example.com",
			Type:  "navigate",
			Data:  map[string]any{},
		},
		{
			TSUTC: yesterday + 3600000, // 23 hours ago
			TSISO: "2024-10-16T13:00:00Z",
			URL:   "https://example.com",
			Type:  "click",
			Data:  map[string]any{},
		},
		{
			TSUTC: now - 1000, // Just now
			TSISO: "2024-10-17T12:00:00Z",
			URL:   "https://example.com",
			Type:  "focus",
			Data:  map[string]any{},
		},
	}

	if err := db.InsertEvents(events); err != nil {
		t.Fatalf("Failed to insert test events: %v", err)
	}

	// Get events from last 24 hours
	filter := EventFilter{
		SinceUTC: &yesterday,
		Limit:    100,
	}
	results, err := db.GetEvents(filter)
	if err != nil {
		t.Fatalf("GetEvents failed: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 events in last 24 hours, got %d", len(results))
	}
}

func TestGetEventsWithLimit(t *testing.T) {
	db, cleanup := setupTestDB(t)
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

	if err := db.InsertEvents(events); err != nil {
		t.Fatalf("Failed to insert test events: %v", err)
	}

	// Get only 3 events
	filter := EventFilter{Limit: 3}
	results, err := db.GetEvents(filter)
	if err != nil {
		t.Fatalf("GetEvents failed: %v", err)
	}

	if len(results) != 3 {
		t.Errorf("Expected 3 events with limit, got %d", len(results))
	}
}

func TestGetEventsCombinedFilters(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Insert various events
	events := []models.Event{
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
	}

	if err := db.InsertEvents(events); err != nil {
		t.Fatalf("Failed to insert test events: %v", err)
	}

	// Get click events after timestamp 1500000000000 with limit 2
	clickType := "click"
	since := int64(1500000000000)
	filter := EventFilter{
		EventType: &clickType,
		SinceUTC:  &since,
		Limit:     2,
	}
	results, err := db.GetEvents(filter)
	if err != nil {
		t.Fatalf("GetEvents failed: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 events with combined filters, got %d", len(results))
	}

	for _, event := range results {
		if event.Type != "click" {
			t.Errorf("Expected only click events, got %s", event.Type)
		}
		if event.TSUTC < since {
			t.Errorf("Event timestamp %d is before since %d", event.TSUTC, since)
		}
	}
}

func TestGetEventsInvalidType(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	invalidType := "invalid_type"
	filter := EventFilter{
		EventType: &invalidType,
		Limit:     100,
	}
	_, err := db.GetEvents(filter)
	if err == nil {
		t.Error("Expected error for invalid event type, got nil")
	}
}

func TestGetEventsEmptyResult(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Don't insert any events
	filter := EventFilter{Limit: 100}
	results, err := db.GetEvents(filter)
	if err != nil {
		t.Fatalf("GetEvents failed: %v", err)
	}

	if len(results) != 0 {
		t.Errorf("Expected 0 events, got %d", len(results))
	}
}

func TestInputEventUpsert(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	sessionID := "test-session-123"
	fieldID := "#email"
	url := "https://example.com"

	// Insert first input event
	events1 := []models.Event{
		{
			TSUTC:     1000000000000,
			TSISO:     "2001-09-09T01:46:40Z",
			URL:       url,
			Type:      "input",
			Data:      map[string]any{"selector": "#email", "value": "john"},
			SessionID: &sessionID,
			FieldID:   &fieldID,
		},
	}

	if err := db.InsertEvents(events1); err != nil {
		t.Fatalf("Failed to insert first input event: %v", err)
	}

	// Insert second input event with same url, field_id, session_id (should UPSERT)
	events2 := []models.Event{
		{
			TSUTC:     2000000000000,
			TSISO:     "2033-05-18T03:33:20Z",
			URL:       url,
			Type:      "input",
			Data:      map[string]any{"selector": "#email", "value": "john@example.com"},
			SessionID: &sessionID,
			FieldID:   &fieldID,
		},
	}

	if err := db.InsertEvents(events2); err != nil {
		t.Fatalf("Failed to upsert input event: %v", err)
	}

	// Verify only one event exists (upserted)
	var count int
	err := db.db.QueryRow("SELECT COUNT(*) FROM events WHERE type = 'input'").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query count: %v", err)
	}

	if count != 1 {
		t.Errorf("Expected 1 input event after upsert, got %d", count)
	}

	// Verify the value was updated
	var dataJSON string
	var tsUTC int64
	err = db.db.QueryRow("SELECT data_json, ts_utc FROM events WHERE type = 'input'").Scan(&dataJSON, &tsUTC)
	if err != nil {
		t.Fatalf("Failed to query event: %v", err)
	}

	// Should have the newer timestamp and value
	if tsUTC != 2000000000000 {
		t.Errorf("Expected timestamp 2000000000000, got %d", tsUTC)
	}

	// Check if the value was updated
	if dataJSON == "" {
		t.Error("Expected non-empty data_json")
	}
}

func TestInputEventUpsertDifferentURLs(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	sessionID := "test-session-123"
	fieldID := "#email"

	// Insert input events with same field_id and session_id but different URLs
	events := []models.Event{
		{
			TSUTC:     1000000000000,
			TSISO:     "2001-09-09T01:46:40Z",
			URL:       "https://example.com/page1",
			Type:      "input",
			Data:      map[string]any{"selector": "#email", "value": "user1@example.com"},
			SessionID: &sessionID,
			FieldID:   &fieldID,
		},
		{
			TSUTC:     2000000000000,
			TSISO:     "2033-05-18T03:33:20Z",
			URL:       "https://example.com/page2",
			Type:      "input",
			Data:      map[string]any{"selector": "#email", "value": "user2@example.com"},
			SessionID: &sessionID,
			FieldID:   &fieldID,
		},
	}

	if err := db.InsertEvents(events); err != nil {
		t.Fatalf("Failed to insert input events: %v", err)
	}

	// Verify both events exist (different URLs)
	var count int
	err := db.db.QueryRow("SELECT COUNT(*) FROM events WHERE type = 'input'").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query count: %v", err)
	}

	if count != 2 {
		t.Errorf("Expected 2 input events with different URLs, got %d", count)
	}
}

func TestInputEventUpsertDifferentSessions(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	session1 := "session-1"
	session2 := "session-2"
	fieldID := "#email"
	url := "https://example.com"

	// Insert input events with same URL and field_id but different sessions
	events := []models.Event{
		{
			TSUTC:     1000000000000,
			TSISO:     "2001-09-09T01:46:40Z",
			URL:       url,
			Type:      "input",
			Data:      map[string]any{"selector": "#email", "value": "session1@example.com"},
			SessionID: &session1,
			FieldID:   &fieldID,
		},
		{
			TSUTC:     2000000000000,
			TSISO:     "2033-05-18T03:33:20Z",
			URL:       url,
			Type:      "input",
			Data:      map[string]any{"selector": "#email", "value": "session2@example.com"},
			SessionID: &session2,
			FieldID:   &fieldID,
		},
	}

	if err := db.InsertEvents(events); err != nil {
		t.Fatalf("Failed to insert input events: %v", err)
	}

	// Verify both events exist (different sessions)
	var count int
	err := db.db.QueryRow("SELECT COUNT(*) FROM events WHERE type = 'input'").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query count: %v", err)
	}

	if count != 2 {
		t.Errorf("Expected 2 input events with different sessions, got %d", count)
	}
}

func TestNonInputEventsNotAffectedByUpsert(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	sessionID := "test-session-123"
	url := "https://example.com"

	// Insert multiple click events with same session and URL (should NOT upsert)
	events := []models.Event{
		{
			TSUTC:     1000000000000,
			TSISO:     "2001-09-09T01:46:40Z",
			URL:       url,
			Type:      "click",
			Data:      map[string]any{"x": 100, "y": 200},
			SessionID: &sessionID,
		},
		{
			TSUTC:     2000000000000,
			TSISO:     "2033-05-18T03:33:20Z",
			URL:       url,
			Type:      "click",
			Data:      map[string]any{"x": 150, "y": 250},
			SessionID: &sessionID,
		},
	}

	if err := db.InsertEvents(events); err != nil {
		t.Fatalf("Failed to insert click events: %v", err)
	}

	// Verify both click events exist (no upsert for non-input events)
	var count int
	err := db.db.QueryRow("SELECT COUNT(*) FROM events WHERE type = 'click'").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query count: %v", err)
	}

	if count != 2 {
		t.Errorf("Expected 2 click events (no upsert), got %d", count)
	}
}

func TestInputEventUpsertMultipleUpdates(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	sessionID := "test-session-123"
	fieldID := "#search"
	url := "https://example.com"

	// Simulate user typing incrementally (like "h", "he", "hel", "hell", "hello")
	values := []string{"h", "he", "hel", "hell", "hello"}

	for i, value := range values {
		events := []models.Event{
			{
				TSUTC:     int64(1000000000000 + i*1000),
				TSISO:     "2001-09-09T01:46:40Z",
				URL:       url,
				Type:      "input",
				Data:      map[string]any{"selector": "#search", "value": value},
				SessionID: &sessionID,
				FieldID:   &fieldID,
			},
		}

		if err := db.InsertEvents(events); err != nil {
			t.Fatalf("Failed to insert/update input event %d: %v", i, err)
		}
	}

	// Verify only one event exists with the final value
	var count int
	err := db.db.QueryRow("SELECT COUNT(*) FROM events WHERE type = 'input'").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query count: %v", err)
	}

	if count != 1 {
		t.Errorf("Expected 1 input event after multiple upserts, got %d", count)
	}

	// Verify it has the final timestamp
	var tsUTC int64
	err = db.db.QueryRow("SELECT ts_utc FROM events WHERE type = 'input'").Scan(&tsUTC)
	if err != nil {
		t.Fatalf("Failed to query timestamp: %v", err)
	}

	expectedTS := int64(1000000000000 + 4*1000) // Last timestamp
	if tsUTC != expectedTS {
		t.Errorf("Expected final timestamp %d, got %d", expectedTS, tsUTC)
	}
}
