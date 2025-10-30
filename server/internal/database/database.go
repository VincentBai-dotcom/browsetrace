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
	  id         INTEGER PRIMARY KEY,
	  ts_utc     INTEGER NOT NULL,
	  ts_iso     TEXT    NOT NULL,
	  url        TEXT    NOT NULL,
	  title      TEXT,
	  type       TEXT    NOT NULL CHECK (type IN ('navigate','visible_text','click','input','focus')),
	  data_json  TEXT    NOT NULL CHECK (json_valid(data_json)),
	  session_id TEXT,
	  field_id   TEXT
	);
	CREATE INDEX IF NOT EXISTS idx_events_ts   ON events(ts_utc);
	CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
	CREATE INDEX IF NOT EXISTS idx_events_url  ON events(url);

	-- Unique index for input event deduplication (NULLs are allowed for non-input events)
	CREATE UNIQUE INDEX IF NOT EXISTS idx_input_field_session
	ON events(url, field_id, session_id);

	-- Partial index for faster input event queries
	CREATE INDEX IF NOT EXISTS idx_input_lookup
	ON events(session_id, field_id)
	WHERE type = 'input';

	-- Unique index for visible_text event deduplication (one visible_text per url+session)
	CREATE UNIQUE INDEX IF NOT EXISTS idx_visible_text_session
	ON events(url, session_id)
	WHERE type = 'visible_text';
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

	// Prepare statement for regular INSERT (non-input events)
	insertStmt, err := transaction.Prepare(`INSERT INTO events(ts_utc, ts_iso, url, title, type, data_json, session_id, field_id) VALUES(?,?,?,?,?,json(?),?,?)`)
	if err != nil {
		_ = transaction.Rollback()
		return fmt.Errorf("failed to prepare insert statement: %w", err)
	}
	defer insertStmt.Close()

	// Prepare statement for UPSERT (input events)
	upsertInputStmt, err := transaction.Prepare(`
		INSERT INTO events(ts_utc, ts_iso, url, title, type, data_json, session_id, field_id)
		VALUES(?,?,?,?,?,json(?),?,?)
		ON CONFLICT(url, field_id, session_id)
		DO UPDATE SET
			ts_utc = excluded.ts_utc,
			ts_iso = excluded.ts_iso,
			title = excluded.title,
			data_json = excluded.data_json
	`)
	if err != nil {
		_ = transaction.Rollback()
		return fmt.Errorf("failed to prepare input upsert statement: %w", err)
	}
	defer upsertInputStmt.Close()

	// Prepare statement for UPSERT (visible_text events)
	upsertVisibleTextStmt, err := transaction.Prepare(`
		INSERT INTO events(ts_utc, ts_iso, url, title, type, data_json, session_id, field_id)
		VALUES(?,?,?,?,?,json(?),?,?)
		ON CONFLICT(url, session_id) WHERE type = 'visible_text'
		DO UPDATE SET
			ts_utc = excluded.ts_utc,
			ts_iso = excluded.ts_iso,
			title = excluded.title,
			data_json = excluded.data_json
	`)
	if err != nil {
		_ = transaction.Rollback()
		return fmt.Errorf("failed to prepare visible_text upsert statement: %w", err)
	}
	defer upsertVisibleTextStmt.Close()

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

		// Use UPSERT for input and visible_text events, regular INSERT for others
		var stmt *sql.Stmt
		if event.Type == "input" && event.FieldID != nil && event.SessionID != nil {
			stmt = upsertInputStmt
		} else if event.Type == "visible_text" && event.SessionID != nil {
			stmt = upsertVisibleTextStmt
		} else {
			stmt = insertStmt
		}

		if _, err := stmt.Exec(event.TSUTC, event.TSISO, event.URL, event.Title, event.Type, string(jsonData), event.SessionID, event.FieldID); err != nil {
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
	query := "SELECT id, ts_utc, ts_iso, url, title, type, data_json, session_id, field_id FROM events WHERE 1=1"
	args := []any{}

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
			id        int64
			tsUTC     int64
			tsISO     string
			url       string
			title     *string
			typeName  string
			dataJSON  string
			sessionID *string
			fieldID   *string
		)

		if err := rows.Scan(&id, &tsUTC, &tsISO, &url, &title, &typeName, &dataJSON, &sessionID, &fieldID); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		var data map[string]any
		if err := json.Unmarshal([]byte(dataJSON), &data); err != nil {
			return nil, fmt.Errorf("failed to unmarshal event data: %w", err)
		}

		events = append(events, models.Event{
			TSUTC:     tsUTC,
			TSISO:     tsISO,
			URL:       url,
			Title:     title,
			Type:      typeName,
			Data:      data,
			SessionID: sessionID,
			FieldID:   fieldID,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return events, nil
}
