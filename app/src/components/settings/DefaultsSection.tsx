import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Area } from "@/types";

interface DefaultsSectionProps {
  defaultArea: Area;
  defaultCurrency: string;
  onSetDefaultArea: (area: Area) => void;
  onSetDefaultCurrency: (currency: string) => void;
}

export function DefaultsSection({
  defaultArea,
  defaultCurrency,
  onSetDefaultArea,
  onSetDefaultCurrency,
}: DefaultsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Defaults</CardTitle>
        <CardDescription>
          Set default values for new items.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Default Area</Label>
            <Select
              value={defaultArea}
              onValueChange={(v) => onSetDefaultArea(v as Area)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wellfy">Wellfy</SelectItem>
                <SelectItem value="freelance">Freelance</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Default Currency</Label>
            <Select
              value={defaultCurrency}
              onValueChange={onSetDefaultCurrency}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="CHF">CHF</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
