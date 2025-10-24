package models

type Event struct {
	TSUTC     int64          `json:"ts_utc"`
	TSISO     string         `json:"ts_iso"`
	URL       string         `json:"url"`
	Title     *string        `json:"title"`      // nullable
	Type      string         `json:"type"`       // navigate|visible_text|click|input|focus
	Data      map[string]any `json:"data"`       // arbitrary JSON
	SessionID *string        `json:"session_id"` // nullable, set for all events
	FieldID   *string        `json:"field_id"`   // nullable, only for input events
}

type Batch struct {
	Events []Event `json:"events"`
}