import { useState, useEffect } from 'react';
import './index.css';
import { EventFilter } from './components/EventFilter';
import { EventsTable } from './components/EventsTable';
import { getEvents } from '../services/api';
import type { Event, EventFilter as EventFilterType } from '../types/events';
import { Activity, Database } from 'lucide-react';

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

  const handleRefresh = () => {
    fetchEvents(currentFilter);
  };

  // Load events on mount
  useEffect(() => {
    fetchEvents(currentFilter);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">BrowseTrace</h1>
              <p className="text-sm text-muted-foreground">Event Visualization & Analytics</p>
            </div>
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="h-4 w-4" />
              <span>{events.length} events</span>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-6 space-y-6">
        <EventFilter onFilterChange={handleFilterChange} />
        <EventsTable events={events} loading={loading} error={error} onRefresh={handleRefresh} />
      </main>
    </div>
  );
}

export default App;
