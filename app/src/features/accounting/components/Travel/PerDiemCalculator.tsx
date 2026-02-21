/**
 * Per Diem Calculator Component (Verpflegungsmehraufwand-Rechner)
 *
 * Standalone calculator for German per diem allowances.
 * Can be used in the travel expense wizard or independently.
 *
 * German tax rules (2024):
 * - Less than 8h: €0
 * - 8-24h: €14/day
 * - 24h+: €28/day
 * - Meal deductions: Frühstück -€5.60, Mittagessen -€11.20, Abendessen -€11.20
 */

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePerDiemCalculator } from '../../hooks/useTravelRecords';
import type { MealsProvided } from '@/services/web/travelService';
import {
  PER_DIEM_RATE_SHORT,
  PER_DIEM_RATE_FULL,
  MEAL_DEDUCTION_BREAKFAST,
  MEAL_DEDUCTION_LUNCH,
  MEAL_DEDUCTION_DINNER,
} from '../../api/travel';

// ============================================================================
// Types
// ============================================================================

export interface PerDiemCalculatorProps {
  /** Initial absence hours */
  initialHours?: number;
  /** Initial meals provided state */
  initialMeals?: MealsProvided;
  /** Called when calculation changes */
  onChange?: (result: {
    absenceHours: number;
    rate: number;
    grossAmount: number;
    mealDeductions: number;
    netAmount: number;
    mealsProvided: MealsProvided;
  }) => void;
  /** Whether to show as standalone card or inline */
  standalone?: boolean;
  /** Additional CSS classes */
  className?: string;
}

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

export function PerDiemCalculator({
  initialHours = 0,
  initialMeals,
  onChange,
  standalone = true,
  className,
}: PerDiemCalculatorProps) {
  const [absenceHours, setAbsenceHours] = useState(initialHours);
  const [mealsProvided, setMealsProvided] = useState<MealsProvided>(
    initialMeals || { breakfast: false, lunch: false, dinner: false }
  );
  const [showTooltip, setShowTooltip] = useState(false);
  const [copied, setCopied] = useState(false);

  const { calculate, result } = usePerDiemCalculator();

  // Recalculate when inputs change
  useEffect(() => {
    const res = calculate(absenceHours, mealsProvided);
    onChange?.({
      absenceHours,
      rate: res.rate,
      grossAmount: res.grossAmount,
      mealDeductions: res.mealDeductions,
      netAmount: res.netAmount,
      mealsProvided,
    });
  }, [absenceHours, mealsProvided, calculate, onChange]);

  const handleMealChange = useCallback((meal: keyof MealsProvided, checked: boolean) => {
    setMealsProvided(prev => ({ ...prev, [meal]: checked }));
  }, []);

  const handleCopyResult = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(`Verpflegungsmehraufwand: ${formatCurrency(result.netAmount)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const content = (
    <div className={cn('space-y-4', className)}>
      {/* Absence Hours Input */}
      <div className="space-y-2">
        <Label htmlFor="absence-hours">Abwesenheitsstunden</Label>
        <Input
          id="absence-hours"
          type="number"
          min={0}
          max={720}
          step={0.5}
          value={absenceHours || ''}
          onChange={(e) => setAbsenceHours(Number(e.target.value) || 0)}
          placeholder="z.B. 10"
        />
        {/* Rate display */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {absenceHours < 8 && (
            <span>Keine Pauschale (unter 8 Stunden)</span>
          )}
          {absenceHours >= 8 && absenceHours < 24 && (
            <Badge variant="secondary">8–24h = {formatCurrency(PER_DIEM_RATE_SHORT)}</Badge>
          )}
          {absenceHours >= 24 && (
            <Badge variant="secondary">24h+ = {formatCurrency(PER_DIEM_RATE_FULL)}</Badge>
          )}
        </div>
      </div>

      {/* Meals Provided Checkboxes */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label>Gestellte Mahlzeiten</Label>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowTooltip(!showTooltip)}
            aria-label="Information zu Verpflegungsmehraufwand"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>

        {showTooltip && (
          <div className="rounded-md bg-muted p-3 text-sm space-y-1" role="tooltip">
            <p className="font-medium">Verpflegungsmehraufwand (§9 Abs. 4a EStG)</p>
            <p>Bei Abwesenheit von 8–24h: {formatCurrency(PER_DIEM_RATE_SHORT)}/Tag</p>
            <p>Bei Abwesenheit von 24h+: {formatCurrency(PER_DIEM_RATE_FULL)}/Tag</p>
            <p className="text-muted-foreground mt-2">
              Werden Mahlzeiten durch den Arbeitgeber oder Dritte gestellt,
              werden diese vom Pauschalbetrag abgezogen.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="meal-breakfast"
                checked={mealsProvided.breakfast}
                onCheckedChange={(checked) => handleMealChange('breakfast', !!checked)}
              />
              <Label htmlFor="meal-breakfast" className="text-sm font-normal cursor-pointer">
                Frühstück
              </Label>
            </div>
            <span className="text-sm text-muted-foreground">
              -{formatCurrency(MEAL_DEDUCTION_BREAKFAST)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="meal-lunch"
                checked={mealsProvided.lunch}
                onCheckedChange={(checked) => handleMealChange('lunch', !!checked)}
              />
              <Label htmlFor="meal-lunch" className="text-sm font-normal cursor-pointer">
                Mittagessen
              </Label>
            </div>
            <span className="text-sm text-muted-foreground">
              -{formatCurrency(MEAL_DEDUCTION_LUNCH)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="meal-dinner"
                checked={mealsProvided.dinner}
                onCheckedChange={(checked) => handleMealChange('dinner', !!checked)}
              />
              <Label htmlFor="meal-dinner" className="text-sm font-normal cursor-pointer">
                Abendessen
              </Label>
            </div>
            <span className="text-sm text-muted-foreground">
              -{formatCurrency(MEAL_DEDUCTION_DINNER)}
            </span>
          </div>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div className="rounded-md border bg-card p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Brutto-Pauschale</span>
            <span>{formatCurrency(result.grossAmount)}</span>
          </div>
          {result.mealDeductions > 0 && (
            <div className="flex justify-between text-sm text-destructive">
              <span>Abzüge Mahlzeiten</span>
              <span>-{formatCurrency(result.mealDeductions)}</span>
            </div>
          )}
          <div className="border-t pt-2 flex justify-between items-center font-medium">
            <span>Verpflegungsmehraufwand</span>
            <div className="flex items-center gap-2">
              <span className="text-lg">{formatCurrency(result.netAmount)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopyResult}
                title="Ergebnis kopieren"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {copied && (
            <p className="text-xs text-muted-foreground text-right">Kopiert!</p>
          )}
        </div>
      )}
    </div>
  );

  if (!standalone) {
    return content;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Verpflegungsmehraufwand-Rechner</CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}

export default PerDiemCalculator;
