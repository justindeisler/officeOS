/**
 * Travel Expenses Page (Reisekosten)
 *
 * Main page for managing travel expenses with:
 * - Summary cards (totals, mileage, destinations)
 * - Travel records list
 * - Wizard dialog for new records
 */

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MapPin, Car, Utensils, Euro } from 'lucide-react';
import { toast } from 'sonner';
import { TravelRecordsList } from '@/features/accounting/components/Travel/TravelRecordsList';
import { TravelExpenseWizard } from '@/features/accounting/components/Travel/TravelExpenseWizard';
import { useTravelRecords } from '@/features/accounting/hooks/useTravelRecords';
import type { CreateTravelRecordInput } from '@/services/web/travelService';

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

// ============================================================================
// Component
// ============================================================================

export function TravelExpensesPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: records, isLoading, error, refetch, createRecord, deleteRecord } = useTravelRecords();

  // ── Summary Stats ─────────────────────────────────────────────────

  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearRecords = records.filter(
      (r) => new Date(r.tripDate).getFullYear() === currentYear
    );

    const totalAmount = yearRecords.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalMileage = yearRecords.reduce(
      (sum, r) => sum + (r.distanceKm || 0),
      0
    );

    // Most frequent destinations
    const destCounts: Record<string, number> = {};
    yearRecords.forEach((r) => {
      destCounts[r.destination] = (destCounts[r.destination] || 0) + 1;
    });
    const topDestinations = Object.entries(destCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([dest]) => dest);

    return {
      totalAmount,
      totalMileage,
      tripCount: yearRecords.length,
      topDestinations,
    };
  }, [records]);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (data: CreateTravelRecordInput) => {
      setIsSubmitting(true);
      try {
        const result = await createRecord(data);
        if (result) {
          toast.success('Reisekosten erfolgreich erstellt');
          setWizardOpen(false);
        } else {
          toast.error('Fehler beim Erstellen der Reisekosten');
        }
      } catch {
        toast.error('Fehler beim Erstellen der Reisekosten');
      } finally {
        setIsSubmitting(false);
      }
    },
    [createRecord]
  );

  const handleDelete = useCallback(
    async (id: string): Promise<boolean> => {
      const success = await deleteRecord(id);
      if (success) {
        toast.success('Reisekosten gelöscht');
      } else {
        toast.error('Fehler beim Löschen');
      }
      return success;
    },
    [deleteRecord]
  );

  const handleEdit = useCallback((_record: unknown) => {
    // For now, just show a toast - could open edit wizard in future
    toast.info('Bearbeitung wird in einer zukünftigen Version verfügbar sein');
  }, []);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reisekosten</h1>
        <p className="text-muted-foreground">
          Fahrtkosten, Verpflegungsmehraufwand und weitere Reisekosten verwalten
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reisekosten {new Date().getFullYear()}</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">{stats.tripCount} Reisen</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gefahrene Kilometer</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('de-DE').format(stats.totalMileage)} km
            </div>
            <p className="text-xs text-muted-foreground">in {new Date().getFullYear()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Häufigste Ziele</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {stats.topDestinations.length > 0
                ? stats.topDestinations.join(', ')
                : '—'}
            </div>
            <p className="text-xs text-muted-foreground">Top-Reiseziele</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ø pro Reise</CardTitle>
            <Utensils className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.tripCount > 0
                ? formatCurrency(stats.totalAmount / stats.tripCount)
                : '—'}
            </div>
            <p className="text-xs text-muted-foreground">Durchschnitt</p>
          </CardContent>
        </Card>
      </div>

      {/* Records List */}
      <TravelRecordsList
        records={records}
        isLoading={isLoading}
        error={error}
        onAdd={() => setWizardOpen(true)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <TravelExpenseWizard
            onSubmit={handleSubmit}
            onCancel={() => setWizardOpen(false)}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TravelExpensesPage;
