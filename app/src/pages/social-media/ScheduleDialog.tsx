/**
 * Dialog for scheduling a social media post
 */

import { useState, useEffect } from "react";
import { format } from "date-fns";
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
import { Calendar } from "lucide-react";
import type { SocialMediaPost } from "@/lib/api";

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: SocialMediaPost | null;
  onSchedule: (id: string, date: string) => Promise<void>;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  post,
  onSchedule,
}: ScheduleDialogProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (post?.scheduled_date) {
      const d = new Date(post.scheduled_date);
      setDate(format(d, "yyyy-MM-dd"));
      setTime(format(d, "HH:mm"));
    } else {
      // Default to tomorrow at 9am
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(format(tomorrow, "yyyy-MM-dd"));
      setTime("09:00");
    }
  }, [post, open]);

  const handleSchedule = async () => {
    if (!post || !date) return;
    setSaving(true);
    try {
      const scheduledDate = new Date(`${date}T${time}:00`).toISOString();
      await onSchedule(post.id, scheduledDate);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Post
          </DialogTitle>
          <DialogDescription>
            Choose when to post this on {post.platform === "linkedin" ? "LinkedIn" : "Instagram"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Post preview */}
          <div className="p-3 rounded-lg bg-muted text-sm line-clamp-3">
            {post.content_text}
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd")}
            />
          </div>

          {/* Time picker */}
          <div className="space-y-2">
            <Label>Time</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            💡 Tip: Best posting times — LinkedIn: Tue-Thu 8-10am, Instagram: Mon-Fri 11am-1pm
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={!date || saving}>
            {saving ? "Scheduling..." : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
