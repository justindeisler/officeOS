import { useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTimerStore } from "@/stores/timerStore";
import type { TimeCategory } from "@/types";

interface TimeEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TimeEntryForm({ open, onOpenChange }: TimeEntryFormProps) {
  const { addManualEntry } = useTimerStore();

  const [category, setCategory] = useState<TimeCategory>("coding");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");
  const [entryMode, setEntryMode] = useState<"range" | "duration">("duration");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let startTimeISO: string;
    let endTimeISO: string | undefined;
    let durationMinutes: number;

    if (entryMode === "range") {
      const startDate = new Date(`${date}T${startTime}:00`);
      const endDate = new Date(`${date}T${endTime}:00`);
      startTimeISO = startDate.toISOString();
      endTimeISO = endDate.toISOString();
      durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
    } else {
      const startDate = new Date(`${date}T09:00:00`);
      startTimeISO = startDate.toISOString();
      durationMinutes = parseInt(hours) * 60 + parseInt(minutes);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
      endTimeISO = endDate.toISOString();
    }

    if (durationMinutes <= 0) return;

    addManualEntry({
      category,
      description: description.trim() || undefined,
      startTime: startTimeISO,
      endTime: endTimeISO,
      durationMinutes,
    });

    // Reset form
    setDescription("");
    setHours("1");
    setMinutes("0");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Time Entry</DialogTitle>
            <DialogDescription>
              Log time manually for work you've completed.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Category */}
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as TimeCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coding">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Coding
                    </div>
                  </SelectItem>
                  <SelectItem value="meetings">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      Meetings
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      Admin
                    </div>
                  </SelectItem>
                  <SelectItem value="planning">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Planning
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-500" />
                      Other
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What did you work on?"
              />
            </div>

            {/* Date */}
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Entry Mode Toggle */}
            <div className="grid gap-2">
              <Label>Entry Method</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={entryMode === "duration" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEntryMode("duration")}
                  className="flex-1"
                >
                  Duration
                </Button>
                <Button
                  type="button"
                  variant={entryMode === "range" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEntryMode("range")}
                  className="flex-1"
                >
                  Time Range
                </Button>
              </div>
            </div>

            {/* Duration or Range inputs */}
            {entryMode === "duration" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="hours">Hours</Label>
                  <Input
                    id="hours"
                    type="number"
                    min="0"
                    max="24"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="minutes">Minutes</Label>
                  <Input
                    id="minutes"
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <Plus className="h-4 w-4 mr-1" />
              Add Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
