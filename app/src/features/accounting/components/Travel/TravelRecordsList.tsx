/**
 * Travel Records List Component (Reisekosten-Übersicht)
 *
 * Table view of all travel expense records with:
 * - Sortable columns
 * - Date range filtering
 * - Search by destination/purpose
 * - Row actions (view, edit, delete)
 */

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  Search,
  Loader2,
  Trash2,
  Pencil,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { cn } from '@/lib/utils';
import type { TravelRecord } from '@/services/web/travelService';
import { VEHICLE_TYPE_LABELS } from '../../api/travel';

// ============================================================================
// Types
// ============================================================================

export interface TravelRecordsListProps {
  /** Travel records data */
  records: TravelRecord[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Called when "New Travel Expense" is clicked */
  onAdd?: () => void;
  /** Called when a record is selected for editing */
  onEdit?: (record: TravelRecord) => void;
  /** Called when a record should be deleted */
  onDelete?: (id: string) => Promise<boolean>;
  /** Additional CSS classes */
  className?: string;
}

type SortField = 'tripDate' | 'destination' | 'totalAmount';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function isRecent(dateStr: string): boolean {
  const date = new Date(dateStr);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return date >= thirtyDaysAgo;
}

// ============================================================================
// Component
// ============================================================================

export function TravelRecordsList({
  records,
  isLoading = false,
  error = null,
  onAdd,
  onEdit,
  onDelete,
  className,
}: TravelRecordsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('tripDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Filtering & Sorting ─────────────────────────────────────────────

  const filteredRecords = useMemo(() => {
    let result = [...records];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.destination.toLowerCase().includes(query) ||
          r.purpose.toLowerCase().includes(query)
      );
    }

    // Date range filter
    if (dateFrom) {
      result = result.filter((r) => r.tripDate >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((r) => r.tripDate <= dateTo);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'tripDate':
          comparison = a.tripDate.localeCompare(b.tripDate);
          break;
        case 'destination':
          comparison = a.destination.localeCompare(b.destination);
          break;
        case 'totalAmount':
          comparison = a.totalAmount - b.totalAmount;
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [records, searchQuery, dateFrom, dateTo, sortField, sortDirection]);

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDirection('desc');
      return field;
    });
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteId || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteId);
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  }, [deleteId, onDelete]);

  const sortIndicator = useCallback(
    (field: SortField) => {
      if (sortField !== field) return '';
      return sortDirection === 'asc' ? ' ↑' : ' ↓';
    },
    [sortField, sortDirection]
  );

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Reisekosten
          </CardTitle>
          {onAdd && (
            <Button onClick={onAdd} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Neue Reisekosten
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ziel oder Zweck suchen…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[140px]"
              aria-label="Datum von"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[140px]"
              aria-label="Datum bis"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Error State */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-4 mb-4 flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Lade Reisekosten…</span>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredRecords.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Keine Reisekosten erfasst</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {searchQuery || dateFrom || dateTo
                ? 'Keine Ergebnisse für die aktuelle Filterung.'
                : 'Erstellen Sie Ihren ersten Reisekostenbeleg.'}
            </p>
            {onAdd && !searchQuery && !dateFrom && !dateTo && (
              <Button onClick={onAdd} variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Reisekosten erfassen
              </Button>
            )}
          </div>
        )}

        {/* Table */}
        {!isLoading && filteredRecords.length > 0 && (
          <div className="overflow-x-auto -mx-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('tripDate')}
                  >
                    Datum{sortIndicator('tripDate')}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('destination')}
                  >
                    Ziel{sortIndicator('destination')}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Zweck</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Fahrtkosten</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Verpflegung</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Übernachtung</TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => handleSort('totalAmount')}
                  >
                    Gesamt{sortIndicator('totalAmount')}
                  </TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow
                    key={record.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50',
                      isRecent(record.tripDate) && 'bg-primary/5'
                    )}
                    onClick={() => onEdit?.(record)}
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatDate(record.tripDate)}
                      {record.returnDate && (
                        <span className="text-muted-foreground text-xs block">
                          bis {formatDate(record.returnDate)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{record.destination}</div>
                      {record.vehicleType && record.distanceKm && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {VEHICLE_TYPE_LABELS[record.vehicleType] || record.vehicleType}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-[200px] truncate text-muted-foreground">
                      {record.purpose}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      {record.mileageAmount ? formatCurrency(record.mileageAmount) : '—'}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      {record.perDiemAmount != null && record.perDiemAmount > 0
                        ? formatCurrency(record.perDiemAmount)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right hidden lg:table-cell">
                      {record.accommodationAmount
                        ? formatCurrency(record.accommodationAmount)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(record.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEdit(record)}
                            title="Bearbeiten"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(record.id)}
                            title="Löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Summary */}
        {!isLoading && filteredRecords.length > 0 && (
          <div className="flex justify-between items-center pt-4 text-sm text-muted-foreground border-t mt-4">
            <span>{filteredRecords.length} Einträge</span>
            <span className="font-medium text-foreground">
              Summe: {formatCurrency(filteredRecords.reduce((sum, r) => sum + r.totalAmount, 0))}
            </span>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Reisekosten löschen?"
        description="Diese Reisekosten und der zugehörige Buchungseintrag werden gelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
        confirmText="Löschen"
        cancelText="Abbrechen"
      />
    </Card>
  );
}

export default TravelRecordsList;
