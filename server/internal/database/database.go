package database

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/vincentbai/browsetrace-server/internal/models"
	_ "modernc.org/sqlite" // CGO-free SQLite
)

type Database struct {
	db              *sql.DB
	validEventTypes map[string]bool
}

func NewDatabase(databasePath string) (*Database, error) {
	// WAL + busy timeout to avoid "database is locked"
	db, err := sql.Open("sqlite", databasePath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := createTables(db); err != nil {
		db.Close()
		return nil, err
	}

	return &Database{
		db: db,
		validEventTypes: map[string]bool{
			"navigate":     true,
			"visible_text": true,
			"click":        true,
			"input":        true,
			"focus":        true,
		},
	}, nil
}

func createTables(db *sql.DB) error {
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS events(
	  id        INTEGER PRIMARY KEY,
	  ts_utc    INTEGER NOT NULL,
	  ts_iso    TEXT    NOT NULL,
	  url       TEXT    NOT NULL,
	  title     TEXT,
	  type      TEXT    NOT NULL CHECK (type IN ('navigate','visible_text','click','input','focus')),
	  data_json TEXT    NOT NULL CHECK (json_valid(data_json))
	);
	CREATE INDEX IF NOT EXISTS idx_events_ts   ON events(ts_utc);
	CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
	CREATE INDEX IF NOT EXISTS idx_events_url  ON events(url);
	`)
	if err != nil {
		return fmt.Errorf("failed to create database tables: %w", err)
	}
	return nil
}

func (d *Database) Close() error {
	return d.db.Close()
}

func (d *Database) ValidateEvent(event models.Event) error {
	if event.URL == "" {
		return fmt.Errorf("URL cannot be empty")
	}
	if event.Type == "" {
		return fmt.Errorf("Type cannot be empty")
	}
	if !d.validEventTypes[event.Type] {
		return fmt.Errorf("invalid event type: %s", event.Type)
	}
	if event.TSUTC <= 0 {
		return fmt.Errorf("timestamp must be positive")
	}
	return nil
}

func (d *Database) InsertEvents(events []models.Event) error {
	transaction, err := d.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	statement, err := transaction.Prepare(`INSERT INTO events(ts_utc, ts_iso, url, title, type, data_json) VALUES(?,?,?,?,?,json(?))`)
	if err != nil {
		_ = transaction.Rollback()
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer statement.Close()

	for _, event := range events {
		if err := d.ValidateEvent(event); err != nil {
			_ = transaction.Rollback()
			return fmt.Errorf("invalid event: %w", err)
		}

		jsonData, err := json.Marshal(event.Data)
		if err != nil {
			_ = transaction.Rollback()
			return fmt.Errorf("failed to marshal event data: %w", err)
		}
		if _, err := statement.Exec(event.TSUTC, event.TSISO, event.URL, event.Title, event.Type, string(jsonData)); err != nil {
			_ = transaction.Rollback()
			return fmt.Errorf("failed to execute statement: %w", err)
		}
	}
	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

type EventFilter struct {
	EventType *string
	SinceUTC  *int64
	UntilUTC  *int64
	Limit     int
}

func (d *Database) GetEvents(filter EventFilter) ([]models.Event, error) {
	query := "SELECT id, ts_utc, ts_iso, url, title, type, data_json FROM events WHERE 1=1"
	args := []interface{}{}

	if filter.EventType != nil {
		if !d.validEventTypes[*filter.EventType] {
			return nil, fmt.Errorf("invalid event type: %s", *filter.EventType)
		}
		query += " AND type = ?"
		args = append(args, *filter.EventType)
	}

	if filter.SinceUTC != nil {
		query += " AND ts_utc >= ?"
		args = append(args, *filter.SinceUTC)
	}

	if filter.UntilUTC != nil {
		query += " AND ts_utc <= ?"
		args = append(args, *filter.UntilUTC)
	}

	query += " ORDER BY ts_utc DESC"

	if filter.Limit > 0 {
		query += " LIMIT ?"
		args = append(args, filter.Limit)
	}

	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	var events []models.Event
	for rows.Next() {
		var (
			id       int64
			tsUTC    int64
			tsISO    string
			url      string
			title    *string
			typeName string
			dataJSON string
		)

		if err := rows.Scan(&id, &tsUTC, &tsISO, &url, &title, &typeName, &dataJSON); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		var data map[string]any
		if err := json.Unmarshal([]byte(dataJSON), &data); err != nil {
			return nil, fmt.Errorf("failed to unmarshal event data: %w", err)
		}

		events = append(events, models.Event{
			TSUTC: tsUTC,
			TSISO: tsISO,
			URL:   url,
			Title: title,
			Type:  typeName,
			Data:  data,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return events, nil
}
