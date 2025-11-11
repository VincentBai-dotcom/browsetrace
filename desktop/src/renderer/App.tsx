import { useState, useEffect } from 'react';
import './index.css';
import { EventFilter } from './components/EventFilter';
import { EventsTable } from './components/EventsTable';
import { getEvents, deleteAllEvents } from '../services/api';
import type { Event, EventFilter as EventFilterType } from '../types/events';
import { Activity, Database, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from './components/ui/alert';

const PAGE_SIZE = 50; // Events per page

function App() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<EventFilterType>({ limit: 1000 });
  const [currentPage, setCurrentPage] = useState(1);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fetchEvents = async (filter: EventFilterType) => {
    setLoading(true);
    setError(null);
    const startTime = Date.now();
    try {
      const result = await getEvents(filter);
      // Minimum loading time of 200ms for smooth UX
      const elapsed = Date.now() - startTime;
      const minimumDelay = 200;
      if (elapsed < minimumDelay) {
        await new Promise((resolve) => setTimeout(resolve, minimumDelay - elapsed));
      }
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
    setCurrentPage(1); // Reset to first page on filter change
    fetchEvents(filter);
  };

  const handleRefresh = () => {
    setCurrentPage(1); // Reset to first page on refresh
    fetchEvents(currentFilter);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteAllEvents();
      setNotification({
        type: 'success',
        message: `Deleted ${result.deleted_count.toLocaleString()} events successfully`,
      });
      // Auto-hide notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
      // Refresh the events list
      await fetchEvents(currentFilter);
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete events',
      });
      // Auto-hide notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setDeleting(false);
    }
  };

  // Load events on mount
  useEffect(() => {
    fetchEvents(currentFilter);
  }, []);

  // Calculate pagination
  const totalPages = Math.ceil(events.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedEvents = events.slice(startIndex, endIndex);

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
        {notification && (
          <Alert
            variant={notification.type === 'error' ? 'destructive' : 'default'}
            className="flex items-center gap-2"
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>{notification.message}</AlertDescription>
          </Alert>
        )}
        <EventFilter onFilterChange={handleFilterChange} />
        <EventsTable
          events={paginatedEvents}
          totalEvents={events.length}
          loading={loading}
          error={error}
          onRefresh={handleRefresh}
          onDelete={handleDelete}
          deleting={deleting}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </main>
    </div>
  );
}

export default App;
