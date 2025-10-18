import { useState } from 'react';
import type { EventType, EventFilter as EventFilterType } from '../types/events';

interface EventFilterProps {
  onFilterChange: (filter: EventFilterType) => void;
}

const EVENT_TYPES: EventType[] = [
  'navigate',
  'visible_text',
  'click',
  'input',
  'scroll',
  'focus',
];

const TIME_PRESETS = [
  { label: 'Last Hour', hours: 1 },
  { label: 'Last 24 Hours', hours: 24 },
  { label: 'Last 7 Days', hours: 24 * 7 },
  { label: 'Last 30 Days', hours: 24 * 30 },
];

export function EventFilter({ onFilterChange }: EventFilterProps) {
  const [selectedType, setSelectedType] = useState<EventType | ''>('');
  const [limit, setLimit] = useState<string>('100');

  const handleTypeChange = (type: EventType | '') => {
    setSelectedType(type);
    onFilterChange({
      type: type || undefined,
      limit: parseInt(limit) || 100,
    });
  };

  const handleLimitChange = (newLimit: string) => {
    setLimit(newLimit);
    onFilterChange({
      type: selectedType || undefined,
      limit: parseInt(newLimit) || 100,
    });
  };

  const handleTimePreset = (hours: number) => {
    const now = Date.now();
    const since = now - hours * 60 * 60 * 1000;
    onFilterChange({
      type: selectedType || undefined,
      since,
      limit: parseInt(limit) || 100,
    });
  };

  const handleClearFilters = () => {
    setSelectedType('');
    setLimit('100');
    onFilterChange({ limit: 100 });
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Filter Events</h2>

      <div style={styles.section}>
        <label style={styles.label}>Event Type:</label>
        <select
          value={selectedType}
          onChange={(e) => handleTypeChange(e.target.value as EventType | '')}
          style={styles.select}
        >
          <option value="">All Types</option>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Time Range:</label>
        <div style={styles.buttonGroup}>
          {TIME_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleTimePreset(preset.hours)}
              style={styles.button}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Limit:</label>
        <input
          type="number"
          value={limit}
          onChange={(e) => handleLimitChange(e.target.value)}
          min="1"
          max="1000"
          style={styles.input}
        />
      </div>

      <button onClick={handleClearFilters} style={styles.clearButton}>
        Clear Filters
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '500',
    fontSize: '14px',
  },
  select: {
    width: '100%',
    padding: '8px',
    fontSize: '14px',
    borderRadius: '4px',
    border: '1px solid #ddd',
  },
  input: {
    width: '100%',
    padding: '8px',
    fontSize: '14px',
    borderRadius: '4px',
    border: '1px solid #ddd',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  button: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  clearButton: {
    padding: '10px 20px',
    fontSize: '14px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    width: '100%',
  },
};
