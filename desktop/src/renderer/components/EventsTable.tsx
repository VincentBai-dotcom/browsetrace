import type { Event, EventType } from 'src/types/events';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Navigation,
  MousePointer,
  Type,
  Focus,
  Eye,
  ExternalLink,
  AlertCircle,
  FileSearch,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { Button } from './ui/button';

interface EventsTableProps {
  events: Event[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function EventsTable({ events, loading, error, onRefresh }: EventsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>Loading event data...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Events (0)</CardTitle>
              <CardDescription>No results found</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileSearch className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No events found</p>
          <p className="text-sm text-muted-foreground/70">Try adjusting your filters</p>
        </CardContent>
      </Card>
    );
  }

  const formatTimestamp = (ts_utc: number) => {
    const date = new Date(ts_utc);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
    };
  };

  const formatData = (data: Record<string, unknown>) => {
    return JSON.stringify(data, null, 2);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Events ({events.length.toLocaleString()})</CardTitle>
            <CardDescription>
              {events.length === 1 ? '1 result found' : `${events.length} results found`}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[160px]">Timestamp</TableHead>
                <TableHead className="w-[120px]">Type</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="w-[200px]">Title</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event, index) => {
                const timestamp = formatTimestamp(event.ts_utc);
                const isExpanded = expandedRows.has(index);
                return (
                  <Fragment key={index}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRow(index)}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">{timestamp.date}</span>
                          <span className="font-medium">{timestamp.time}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <EventTypeBadge type={event.type} />
                      </TableCell>
                      <TableCell className="max-w-[400px]">
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline truncate group"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="truncate">{event.url}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </TableCell>
                      <TableCell className="truncate">
                        {event.title || (
                          <span className="text-muted-foreground italic">No title</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30">
                          <div className="p-4 space-y-2">
                            <h4 className="text-sm font-semibold mb-2">Event Data</h4>
                            <pre className="bg-card p-4 rounded-lg text-xs overflow-auto max-h-[300px] border">
                              {formatData(event.data)}
                            </pre>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function EventTypeBadge({ type }: { type: EventType }) {
  const getTypeConfig = (type: EventType) => {
    const configs: Record<
      EventType,
      { icon: React.ReactNode; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
    > = {
      navigate: { icon: <Navigation className="h-3 w-3" />, variant: 'default' },
      visible_text: { icon: <Eye className="h-3 w-3" />, variant: 'secondary' },
      click: { icon: <MousePointer className="h-3 w-3" />, variant: 'outline' },
      input: { icon: <Type className="h-3 w-3" />, variant: 'default' },
      focus: { icon: <Focus className="h-3 w-3" />, variant: 'outline' },
    };

    return configs[type] || { icon: null, variant: 'secondary' as const };
  };

  const config = getTypeConfig(type);

  return (
    <Badge variant={config.variant} className="gap-1 font-mono text-xs">
      {config.icon}
      {type}
    </Badge>
  );
}
