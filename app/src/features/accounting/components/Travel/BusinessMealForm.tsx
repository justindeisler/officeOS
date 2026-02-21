/**
 * Business Meal Form Component (Bewirtungskosten)
 *
 * Form for updating an expense to include business meal details.
 * Implements German tax rules for Bewirtungskosten (§4 Abs. 5 Nr. 2 EStG):
 * - 70% deductible for business meals
 * - Must record: participants, purpose, location
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X, Utensils, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BusinessMealInput } from '@/services/web/travelService';
import { BUSINESS_MEAL_DEDUCTIBLE_PERCENT } from '../../api/travel';

// ============================================================================
// Types
// ============================================================================

export interface BusinessMealFormProps {
  /** Current expense ID */
  expenseId?: string;
  /** Whether this is already marked as a business meal */
  isBusinessMeal?: boolean;
  /** Initial participant list */
  initialParticipants?: string[];
  /** Initial purpose */
  initialPurpose?: string;
  /** Initial location */
  initialLocation?: string;
  /** Called when the form is submitted */
  onSubmit: (data: BusinessMealInput) => Promise<void>;
  /** Called when the form is cancelled */
  onCancel?: () => void;
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function BusinessMealForm({
  isBusinessMeal = false,
  initialParticipants = [],
  initialPurpose = '',
  initialLocation = '',
  onSubmit,
  onCancel,
  isSubmitting = false,
  className,
}: BusinessMealFormProps) {
  const [participants, setParticipants] = useState<string[]>(
    initialParticipants.length > 0 ? initialParticipants : ['']
  );
  const [purpose, setPurpose] = useState(initialPurpose);
  const [location, setLocation] = useState(initialLocation);
  const [markAsMeal, setMarkAsMeal] = useState(isBusinessMeal);
  const [errors, setErrors] = useState<string[]>([]);

  // ── Handlers ──────────────────────────────────────────────────────

  const addParticipant = useCallback(() => {
    setParticipants(prev => [...prev, '']);
  }, []);

  const removeParticipant = useCallback((index: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateParticipant = useCallback((index: number, value: string) => {
    setParticipants(prev => prev.map((p, i) => (i === index ? value : p)));
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: string[] = [];

    if (markAsMeal) {
      const validParticipants = participants.filter(p => p.trim());
      if (validParticipants.length === 0) {
        newErrors.push('Mindestens ein Teilnehmer ist erforderlich');
      }
      if (!purpose.trim()) {
        newErrors.push('Geschäftlicher Anlass ist erforderlich');
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [markAsMeal, participants, purpose]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!validate()) return;

    const data: BusinessMealInput = {
      isBusinessMeal: markAsMeal,
      mealParticipants: markAsMeal
        ? participants.filter(p => p.trim()).map(p => p.trim())
        : [],
      mealPurpose: markAsMeal ? purpose.trim() : undefined,
      mealLocation: markAsMeal ? (location.trim() || null) : null,
    };

    await onSubmit(data);
  }, [markAsMeal, participants, purpose, location, validate, onSubmit]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Utensils className="h-5 w-5" />
          Bewirtungskosten
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={markAsMeal}
                onChange={(e) => setMarkAsMeal(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium">Als Geschäftsessen kennzeichnen</span>
            </label>
            <Badge variant="secondary">{BUSINESS_MEAL_DEDUCTIBLE_PERCENT}% abzugsfähig</Badge>
          </div>

          {/* Info Box */}
          <div className="rounded-md bg-muted p-3 text-sm flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium">Bewirtungskosten (§4 Abs. 5 Nr. 2 EStG)</p>
              <p className="text-muted-foreground mt-1">
                Aufwendungen für die Bewirtung von Geschäftspartnern sind zu{' '}
                {BUSINESS_MEAL_DEDUCTIBLE_PERCENT}% als Betriebsausgabe abzugsfähig.
                Es müssen Teilnehmer, Anlass und Ort dokumentiert werden.
              </p>
            </div>
          </div>

          {markAsMeal && (
            <>
              {/* Participants */}
              <div className="space-y-2">
                <Label>Teilnehmer *</Label>
                {participants.map((participant, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={participant}
                      onChange={(e) => updateParticipant(index, e.target.value)}
                      placeholder={`Teilnehmer ${index + 1}`}
                    />
                    {participants.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 flex-shrink-0"
                        onClick={() => removeParticipant(index)}
                        title="Teilnehmer entfernen"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addParticipant}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Teilnehmer hinzufügen
                </Button>
              </div>

              {/* Purpose */}
              <div className="space-y-2">
                <Label htmlFor="meal-purpose">Geschäftlicher Anlass *</Label>
                <Input
                  id="meal-purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="z.B. Projektbesprechung, Vertragsverhandlung"
                  required
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="meal-location">Ort / Restaurant</Label>
                <Input
                  id="meal-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="z.B. Restaurant Zum Goldenen Hirsch, München"
                />
              </div>
            </>
          )}

          {/* Validation Errors */}
          {errors.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <ul className="list-disc list-inside space-y-1">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Abbrechen
              </Button>
            )}
            <Button type="button" disabled={isSubmitting} onClick={() => handleSubmit()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wird gespeichert…
                </>
              ) : (
                'Speichern'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default BusinessMealForm;
