import { useState } from 'react';
import type { EventType, EventFilter as EventFilterType } from '../types/events';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Badge } from './ui/badge';
import { Filter, X, Clock, Layers } from 'lucide-react';
import { Separator } from './ui/separator';

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
  { label: 'Last Hour', hours: 1, value: '1h' },
  { label: 'Last 24 Hours', hours: 24, value: '24h' },
  { label: 'Last 7 Days', hours: 24 * 7, value: '7d' },
  { label: 'Last 30 Days', hours: 24 * 30, value: '30d' },
];

export function EventFilter({ onFilterChange }: EventFilterProps) {
  const [selectedType, setSelectedType] = useState<EventType | 'all'>('all');
  const [limit, setLimit] = useState<string>('100');
  const [activeTimePreset, setActiveTimePreset] = useState<string | null>(null);

  const handleTypeChange = (type: EventType | 'all') => {
    setSelectedType(type);
    onFilterChange({
      type: type === 'all' ? undefined : type,
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

  const handleTimePreset = (hours: number, value: string) => {
    const now = Date.now();
    const since = now - hours * 60 * 60 * 1000;
    setActiveTimePreset(value);
    onFilterChange({
      type: selectedType || undefined,
      since,
      limit: parseInt(limit) || 100,
    });
  };

  const handleClearFilters = () => {
    setSelectedType('all');
    setLimit('100');
    setActiveTimePreset(null);
    onFilterChange({ limit: 100 });
  };

  const hasActiveFilters = selectedType !== 'all' || activeTimePreset !== null || limit !== '100';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Filter Events</CardTitle>
              <CardDescription>Refine your event search criteria</CardDescription>
            </div>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">Event Type</label>
            </div>
            <Select value={selectedType} onValueChange={(value) => handleTypeChange(value as EventType | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Results Limit</label>
            <Input
              type="number"
              value={limit}
              onChange={(e) => handleLimitChange(e.target.value)}
              min="1"
              max="1000"
              placeholder="100"
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium">Time Range</label>
          </div>
          <div className="flex flex-wrap gap-2">
            {TIME_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant={activeTimePreset === preset.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTimePreset(preset.hours, preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {selectedType !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Type: {selectedType}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => handleTypeChange('all')}
                  />
                </Badge>
              )}
              {activeTimePreset && (
                <Badge variant="secondary" className="gap-1">
                  Time: {TIME_PRESETS.find((p) => p.value === activeTimePreset)?.label}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setActiveTimePreset(null)}
                  />
                </Badge>
              )}
              {limit !== '100' && (
                <Badge variant="secondary" className="gap-1">
                  Limit: {limit}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => handleLimitChange('100')}
                  />
                </Badge>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
