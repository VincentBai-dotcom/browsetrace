import type { Event } from '../types/events';

interface EventsTableProps {
  events: Event[];
  loading: boolean;
  error: string | null;
}

export function EventsTable({ events, loading, error }: EventsTableProps) {
  if (loading) {
    return <div style={styles.message}>Loading events...</div>;
  }

  if (error) {
    return <div style={styles.error}>Error: {error}</div>;
  }

  if (events.length === 0) {
    return <div style={styles.message}>No events found</div>;
  }

  const formatTimestamp = (ts_utc: number) => {
    return new Date(ts_utc).toLocaleString();
  };

  const formatData = (data: Record<string, unknown>) => {
    return JSON.stringify(data, null, 2);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>
        Events ({events.length} {events.length === 1 ? 'result' : 'results'})
      </h2>
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Time</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>URL</th>
              <th style={styles.th}>Title</th>
              <th style={styles.th}>Data</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => (
              <tr key={index} style={styles.tr}>
                <td style={styles.td}>{formatTimestamp(event.ts_utc)}</td>
                <td style={styles.td}>
                  <span style={getTypeStyle(event.type)}>{event.type}</span>
                </td>
                <td style={{ ...styles.td, ...styles.urlCell }}>
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.link}
                  >
                    {event.url}
                  </a>
                </td>
                <td style={styles.td}>{event.title || '-'}</td>
                <td style={styles.td}>
                  <details>
                    <summary style={styles.summary}>View data</summary>
                    <pre style={styles.pre}>{formatData(event.data)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getTypeStyle(type: string): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  };

  const colors: Record<string, { bg: string; color: string }> = {
    navigate: { bg: '#e3f2fd', color: '#1976d2' },
    visible_text: { bg: '#f3e5f5', color: '#7b1fa2' },
    click: { bg: '#e8f5e9', color: '#388e3c' },
    input: { bg: '#fff3e0', color: '#f57c00' },
    scroll: { bg: '#fce4ec', color: '#c2185b' },
    focus: { bg: '#e0f2f1', color: '#00796b' },
  };

  const colorScheme = colors[type] || { bg: '#f5f5f5', color: '#000' };

  return {
    ...baseStyle,
    backgroundColor: colorScheme.bg,
    color: colorScheme.color,
  };
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: 'bold',
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #dee2e6',
    fontWeight: '600',
  },
  tr: {
    borderBottom: '1px solid #dee2e6',
  },
  td: {
    padding: '12px',
    verticalAlign: 'top',
  },
  urlCell: {
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  link: {
    color: '#007bff',
    textDecoration: 'none',
  },
  summary: {
    cursor: 'pointer',
    color: '#007bff',
    fontSize: '12px',
  },
  pre: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    fontSize: '11px',
    overflow: 'auto',
    maxHeight: '200px',
  },
  message: {
    padding: '40px',
    textAlign: 'center',
    color: '#6c757d',
    fontSize: '16px',
  },
  error: {
    padding: '20px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '4px',
    border: '1px solid #f5c6cb',
  },
};
