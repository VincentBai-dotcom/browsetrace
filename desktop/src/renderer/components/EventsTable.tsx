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
  Trash2,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from './ui/pagination';

interface EventsTableProps {
  events: Event[];
  totalEvents: number;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onDelete: () => void;
  deleting?: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function EventsTable({
  events,
  totalEvents,
  loading,
  error,
  onRefresh,
  onDelete,
  deleting = false,
  currentPage,
  totalPages,
  onPageChange,
}: EventsTableProps) {
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={loading || deleting}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all browsing events
                      from the database.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Delete All Events
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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

  // Calculate pagination display info
  const startItem = totalEvents === 0 ? 0 : (currentPage - 1) * 50 + 1;
  const endItem = Math.min(currentPage * 50, totalEvents);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Events ({totalEvents.toLocaleString()})</CardTitle>
            <CardDescription>
              {totalEvents === 0
                ? 'No results found'
                : `Showing ${startItem.toLocaleString()} - ${endItem.toLocaleString()} of ${totalEvents.toLocaleString()} results`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={loading || deleting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all{' '}
                    {events.length.toLocaleString()} browsing events from the database.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Delete All Events
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
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
        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
                    className={
                      currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // Show first page, last page, current page, and pages around current
                  const showPage =
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1);

                  if (!showPage) {
                    // Show ellipsis
                    if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }
                    return null;
                  }

                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => onPageChange(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
                    className={
                      currentPage === totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
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
