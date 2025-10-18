import { useState, useEffect } from 'react';
import './index.css';
import { EventFilter } from '../components/EventFilter';
import { EventsTable } from '../components/EventsTable';
import { getEvents } from '../services/api';
import type { Event, EventFilter as EventFilterType } from '../types/events';

function App() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<EventFilterType>({ limit: 100 });

  const fetchEvents = async (filter: EventFilterType) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getEvents(filter);
      setEvents(result.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filter: EventFilterType) => {
    setCurrentFilter(filter);
    fetchEvents(filter);
  };

  // Load events on mount
  useEffect(() => {
    fetchEvents(currentFilter);
  }, []);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.title}>BrowserTrace Event Visualizer</h1>
      </header>
      <main style={styles.main}>
        <EventFilter onFilterChange={handleFilterChange} />
        <EventsTable events={events} loading={loading} error={error} />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#f0f2f5',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: '20px 40px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
  },
  main: {
    padding: '20px 40px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
};

export default App;
