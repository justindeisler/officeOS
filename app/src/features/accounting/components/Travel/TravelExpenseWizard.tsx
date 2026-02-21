/**
 * Travel Expense Wizard (Reisekosten-Assistent)
 *
 * Multi-step wizard for creating travel expense records.
 * Supports mileage, per diem, accommodation, and other costs.
 *
 * Steps:
 * 1. Trip Details (date, destination, purpose)
 * 2. Mileage (optional)
 * 3. Per Diem (optional)
 * 4. Other Costs (optional)
 * 5. Review & Submit
 */

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ChevronLeft, ChevronRight, Check, MapPin, Car, Utensils, Hotel, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMileageCalculator, usePerDiemCalculator } from '../../hooks/useTravelRecords';
import type { MealsProvided, VehicleType, CreateTravelRecordInput } from '@/services/web/travelService';
import {
  MILEAGE_RATES,
  VEHICLE_TYPE_LABELS,
  PER_DIEM_RATE_SHORT,
  PER_DIEM_RATE_FULL,
  MEAL_DEDUCTION_BREAKFAST,
  MEAL_DEDUCTION_LUNCH,
  MEAL_DEDUCTION_DINNER,
} from '../../api/travel';

// ============================================================================
// Types
// ============================================================================

export interface TravelExpenseWizardProps {
  /** Called when the wizard is submitted successfully */
  onSubmit: (data: CreateTravelRecordInput) => Promise<void>;
  /** Called when the wizard is cancelled */
  onCancel: () => void;
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface WizardState {
  // Step 1: Trip Details
  tripDate: string;
  returnDate: string;
  destination: string;
  purpose: string;
  // Step 2: Mileage
  distanceKm: string;
  vehicleType: VehicleType;
  // Step 3: Per Diem
  absenceHours: string;
  mealsProvided: MealsProvided;
  // Step 4: Other Costs
  accommodationAmount: string;
  otherCosts: string;
  notes: string;
}

interface StepValidation {
  valid: boolean;
  errors: string[];
}

const TOTAL_STEPS = 5;

const STEP_ICONS = [MapPin, Car, Utensils, Hotel, FileText];
const STEP_LABELS = ['Reisedaten', 'Fahrtkosten', 'Verpflegung', 'Weitere Kosten', 'Zusammenfassung'];

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

// ============================================================================
// Component
// ============================================================================

export function TravelExpenseWizard({
  onSubmit,
  onCancel,
  isSubmitting = false,
  className,
}: TravelExpenseWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<WizardState>({
    tripDate: new Date().toISOString().split('T')[0],
    returnDate: '',
    destination: '',
    purpose: '',
    distanceKm: '',
    vehicleType: 'car',
    absenceHours: '',
    mealsProvided: { breakfast: false, lunch: false, dinner: false },
    accommodationAmount: '',
    otherCosts: '',
    notes: '',
  });

  const { calculate: calcMileage } = useMileageCalculator();
  const { calculate: calcPerDiem } = usePerDiemCalculator();

  // ── Computed Values ───────────────────────────────────────────────

  const mileageResult = useMemo(() => {
    const km = Number(state.distanceKm) || 0;
    if (km <= 0) return null;
    return calcMileage(km, state.vehicleType);
  }, [state.distanceKm, state.vehicleType, calcMileage]);

  const perDiemResult = useMemo(() => {
    const hours = Number(state.absenceHours) || 0;
    if (hours <= 0) return null;
    return calcPerDiem(hours, state.mealsProvided);
  }, [state.absenceHours, state.mealsProvided, calcPerDiem]);

  const accommodationValue = Number(state.accommodationAmount) || 0;
  const otherCostsValue = Number(state.otherCosts) || 0;

  const totalAmount = useMemo(() => {
    let total = 0;
    if (mileageResult) total += mileageResult.amount;
    if (perDiemResult) total += perDiemResult.netAmount;
    total += accommodationValue;
    total += otherCostsValue;
    return Math.round(total * 100) / 100;
  }, [mileageResult, perDiemResult, accommodationValue, otherCostsValue]);

  // ── Validation ────────────────────────────────────────────────────

  const validateStep = useCallback((step: number): StepValidation => {
    const errors: string[] = [];

    switch (step) {
      case 1:
        if (!state.tripDate) errors.push('Reisedatum ist erforderlich');
        if (!state.destination.trim()) errors.push('Reiseziel ist erforderlich');
        if (!state.purpose.trim()) errors.push('Reisezweck ist erforderlich');
        if (state.returnDate && state.returnDate < state.tripDate) {
          errors.push('Rückreisedatum muss nach dem Reisedatum liegen');
        }
        break;
      case 2:
        // Mileage is optional, but if entered must be valid
        if (state.distanceKm && Number(state.distanceKm) < 0) {
          errors.push('Entfernung kann nicht negativ sein');
        }
        break;
      case 3:
        // Per diem is optional
        if (state.absenceHours && Number(state.absenceHours) < 0) {
          errors.push('Abwesenheitsstunden können nicht negativ sein');
        }
        break;
      case 4:
        // Other costs are optional
        if (state.accommodationAmount && Number(state.accommodationAmount) < 0) {
          errors.push('Übernachtungskosten können nicht negativ sein');
        }
        if (state.otherCosts && Number(state.otherCosts) < 0) {
          errors.push('Sonstige Kosten können nicht negativ sein');
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }, [state]);

  const currentValidation = useMemo(() => validateStep(currentStep), [validateStep, currentStep]);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS && currentValidation.valid) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, currentValidation.valid]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleSubmit = useCallback(async () => {
    const data: CreateTravelRecordInput = {
      tripDate: state.tripDate,
      returnDate: state.returnDate || null,
      destination: state.destination.trim(),
      purpose: state.purpose.trim(),
      distanceKm: state.distanceKm ? Number(state.distanceKm) : null,
      vehicleType: state.vehicleType,
      absenceHours: state.absenceHours ? Number(state.absenceHours) : null,
      mealsProvided: state.mealsProvided,
      accommodationAmount: state.accommodationAmount ? Number(state.accommodationAmount) : null,
      otherCosts: state.otherCosts ? Number(state.otherCosts) : null,
      notes: state.notes.trim() || null,
    };
    await onSubmit(data);
  }, [state, onSubmit]);

  const updateState = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Step Renderers ────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="trip-date">Reisedatum *</Label>
        <Input
          id="trip-date"
          type="date"
          value={state.tripDate}
          onChange={(e) => updateState('tripDate', e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="return-date">Rückreisedatum</Label>
        <Input
          id="return-date"
          type="date"
          value={state.returnDate}
          onChange={(e) => updateState('returnDate', e.target.value)}
          min={state.tripDate}
        />
        <p className="text-xs text-muted-foreground">Optional, für mehrtägige Reisen</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="destination">Reiseziel *</Label>
        <Input
          id="destination"
          value={state.destination}
          onChange={(e) => updateState('destination', e.target.value)}
          placeholder="z.B. München, Berlin"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="purpose">Reisezweck *</Label>
        <Textarea
          id="purpose"
          value={state.purpose}
          onChange={(e) => updateState('purpose', e.target.value)}
          placeholder="z.B. Kundengespräch, Messe, Workshop"
          rows={3}
          required
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="distance-km">Entfernung (km)</Label>
        <Input
          id="distance-km"
          type="number"
          min={0}
          step={0.1}
          value={state.distanceKm}
          onChange={(e) => updateState('distanceKm', e.target.value)}
          placeholder="z.B. 150"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vehicle-type">Fahrzeugart</Label>
        <Select
          value={state.vehicleType}
          onValueChange={(v) => updateState('vehicleType', v as VehicleType)}
        >
          <SelectTrigger id="vehicle-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label} ({formatCurrency(MILEAGE_RATES[value])}/km)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Live Calculation */}
      {mileageResult && mileageResult.amount > 0 && (
        <div className="rounded-md border bg-card p-4">
          <div className="flex justify-between text-sm">
            <span>{mileageResult.distanceKm} km × {formatCurrency(mileageResult.kmRate)}</span>
            <span className="font-medium">{formatCurrency(mileageResult.amount)}</span>
          </div>
        </div>
      )}

      {!state.distanceKm && (
        <p className="text-sm text-muted-foreground">
          Optional – Überspringen wenn keine Fahrtkosten anfallen.
        </p>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="absence-hours">Abwesenheitsstunden</Label>
        <Input
          id="absence-hours"
          type="number"
          min={0}
          max={720}
          step={0.5}
          value={state.absenceHours}
          onChange={(e) => updateState('absenceHours', e.target.value)}
          placeholder="z.B. 10"
        />
        {/* Rate display */}
        <div className="text-sm text-muted-foreground">
          {(!state.absenceHours || Number(state.absenceHours) < 8) && (
            <span>Ab 8 Stunden Abwesenheit: {formatCurrency(PER_DIEM_RATE_SHORT)}</span>
          )}
          {state.absenceHours && Number(state.absenceHours) >= 8 && Number(state.absenceHours) < 24 && (
            <Badge variant="secondary">8–24h = {formatCurrency(PER_DIEM_RATE_SHORT)}</Badge>
          )}
          {state.absenceHours && Number(state.absenceHours) >= 24 && (
            <Badge variant="secondary">24h+ = {formatCurrency(PER_DIEM_RATE_FULL)}</Badge>
          )}
        </div>
      </div>

      {/* Meals Provided */}
      <div className="space-y-3">
        <Label>Gestellte Mahlzeiten</Label>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="wiz-breakfast"
                checked={state.mealsProvided.breakfast}
                onCheckedChange={(c) => updateState('mealsProvided', { ...state.mealsProvided, breakfast: !!c })}
              />
              <Label htmlFor="wiz-breakfast" className="text-sm font-normal cursor-pointer">Frühstück</Label>
            </div>
            <span className="text-sm text-muted-foreground">-{formatCurrency(MEAL_DEDUCTION_BREAKFAST)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="wiz-lunch"
                checked={state.mealsProvided.lunch}
                onCheckedChange={(c) => updateState('mealsProvided', { ...state.mealsProvided, lunch: !!c })}
              />
              <Label htmlFor="wiz-lunch" className="text-sm font-normal cursor-pointer">Mittagessen</Label>
            </div>
            <span className="text-sm text-muted-foreground">-{formatCurrency(MEAL_DEDUCTION_LUNCH)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="wiz-dinner"
                checked={state.mealsProvided.dinner}
                onCheckedChange={(c) => updateState('mealsProvided', { ...state.mealsProvided, dinner: !!c })}
              />
              <Label htmlFor="wiz-dinner" className="text-sm font-normal cursor-pointer">Abendessen</Label>
            </div>
            <span className="text-sm text-muted-foreground">-{formatCurrency(MEAL_DEDUCTION_DINNER)}</span>
          </div>
        </div>
      </div>

      {/* Live Calculation */}
      {perDiemResult && perDiemResult.grossAmount > 0 && (
        <div className="rounded-md border bg-card p-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Brutto</span>
            <span>{formatCurrency(perDiemResult.grossAmount)}</span>
          </div>
          {perDiemResult.mealDeductions > 0 && (
            <div className="flex justify-between text-sm text-destructive">
              <span>Abzüge</span>
              <span>-{formatCurrency(perDiemResult.mealDeductions)}</span>
            </div>
          )}
          <div className="border-t pt-1 flex justify-between font-medium">
            <span>Netto</span>
            <span>{formatCurrency(perDiemResult.netAmount)}</span>
          </div>
        </div>
      )}

      {!state.absenceHours && (
        <p className="text-sm text-muted-foreground">
          Optional – Überspringen wenn kein Verpflegungsmehraufwand anfällt.
        </p>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="accommodation">Übernachtungskosten (€)</Label>
        <Input
          id="accommodation"
          type="number"
          min={0}
          step={0.01}
          value={state.accommodationAmount}
          onChange={(e) => updateState('accommodationAmount', e.target.value)}
          placeholder="z.B. 89.00"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="other-costs">Sonstige Kosten (€)</Label>
        <Input
          id="other-costs"
          type="number"
          min={0}
          step={0.01}
          value={state.otherCosts}
          onChange={(e) => updateState('otherCosts', e.target.value)}
          placeholder="z.B. 15.00"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Anmerkungen</Label>
        <Textarea
          id="notes"
          value={state.notes}
          onChange={(e) => updateState('notes', e.target.value)}
          placeholder="z.B. Parkgebühren, Taxi"
          rows={3}
        />
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-4">
      {/* Trip Details */}
      <div className="rounded-md border p-4 space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Reisedaten
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Datum</span>
          <span>{formatDate(state.tripDate)}{state.returnDate ? ` – ${formatDate(state.returnDate)}` : ''}</span>
          <span className="text-muted-foreground">Ziel</span>
          <span>{state.destination}</span>
          <span className="text-muted-foreground">Zweck</span>
          <span>{state.purpose}</span>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="rounded-md border p-4 space-y-2">
        <h4 className="font-medium">Kostenübersicht</h4>

        {mileageResult && mileageResult.amount > 0 && (
          <div className="flex justify-between text-sm">
            <span>Fahrtkosten: {mileageResult.distanceKm} km × {formatCurrency(mileageResult.kmRate)}</span>
            <span>{formatCurrency(mileageResult.amount)}</span>
          </div>
        )}

        {perDiemResult && perDiemResult.grossAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span>
              Verpflegung: {formatCurrency(perDiemResult.grossAmount)}
              {perDiemResult.mealDeductions > 0 ? ` - ${formatCurrency(perDiemResult.mealDeductions)} Abzüge` : ''}
            </span>
            <span>{formatCurrency(perDiemResult.netAmount)}</span>
          </div>
        )}

        {accommodationValue > 0 && (
          <div className="flex justify-between text-sm">
            <span>Übernachtung</span>
            <span>{formatCurrency(accommodationValue)}</span>
          </div>
        )}

        {otherCostsValue > 0 && (
          <div className="flex justify-between text-sm">
            <span>Sonstige Kosten</span>
            <span>{formatCurrency(otherCostsValue)}</span>
          </div>
        )}

        {totalAmount === 0 && (
          <p className="text-sm text-muted-foreground">Keine Kosten eingetragen.</p>
        )}

        <div className="border-t pt-2 flex justify-between items-center">
          <span className="font-bold text-lg">Gesamt</span>
          <span className="font-bold text-xl">{formatCurrency(totalAmount)}</span>
        </div>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Card className={cn('w-full max-w-2xl mx-auto', className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Neue Reisekosten</span>
          <span className="text-sm font-normal text-muted-foreground">
            Schritt {currentStep} von {TOTAL_STEPS}
          </span>
        </CardTitle>

        {/* Progress Indicator */}
        <div className="flex items-center gap-1 pt-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const step = i + 1;
            const StepIcon = STEP_ICONS[i];
            const isComplete = step < currentStep;
            const isCurrent = step === currentStep;
            return (
              <div key={step} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => {
                    // Allow navigating to completed or current steps
                    if (step <= currentStep) setCurrentStep(step);
                  }}
                  className={cn(
                    'flex items-center justify-center rounded-full h-8 w-8 text-xs transition-colors',
                    isComplete && 'bg-primary text-primary-foreground',
                    isCurrent && 'bg-primary/20 text-primary border-2 border-primary',
                    !isComplete && !isCurrent && 'bg-muted text-muted-foreground'
                  )}
                  title={STEP_LABELS[i]}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                </button>
                {i < TOTAL_STEPS - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-1',
                      step < currentStep ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Title */}
        <p className="text-sm text-muted-foreground pt-1">{STEP_LABELS[currentStep - 1]}</p>
      </CardHeader>

      <CardContent className="min-h-[300px]">
        {/* Validation Errors */}
        {currentValidation.errors.length > 0 && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <ul className="list-disc list-inside space-y-1">
              {currentValidation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
      </CardContent>

      <CardFooter className="flex justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={currentStep === 1 ? onCancel : handleBack}
        >
          {currentStep === 1 ? (
            'Abbrechen'
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Zurück
            </>
          )}
        </Button>

        {currentStep < TOTAL_STEPS ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={!currentValidation.valid}
          >
            Weiter
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || totalAmount === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Wird gespeichert…
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Reisekosten erfassen
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default TravelExpenseWizard;
