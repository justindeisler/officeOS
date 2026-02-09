/**
 * Posting Calendar — shows scheduled/published posts on a weekly/monthly grid
 */

import { useState, useMemo } from "react";
import {
  format,
  startOfWeek,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Linkedin,
  Instagram,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SocialMediaPost } from "@/lib/api";

type ViewMode = "week" | "month";

interface PostingCalendarProps {
  posts: SocialMediaPost[];
  onPostClick: (post: SocialMediaPost) => void;
}

export function PostingCalendar({ posts, onPostClick }: PostingCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Map posts to dates
  const postsByDate = useMemo(() => {
    const map = new Map<string, SocialMediaPost[]>();
    for (const post of posts) {
      const dateStr = post.scheduled_date || post.published_date || post.created_at;
      if (!dateStr) continue;
      const key = format(parseISO(dateStr), "yyyy-MM-dd");
      const existing = map.get(key) || [];
      existing.push(post);
      map.set(key, existing);
    }
    return map;
  }, [posts]);

  // Get days to display
  const days = useMemo(() => {
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      // Always show 6 rows (42 days) for consistent height
      return eachDayOfInterval({ start: calStart, end: addDays(calStart, 41) }).filter(
        (d) => isSameMonth(d, currentDate) || d < monthStart || d > monthEnd
      );
    }
  }, [viewMode, currentDate]);

  const navigate = (direction: number) => {
    if (viewMode === "week") {
      setCurrentDate((d) => (direction > 0 ? addWeeks(d, 1) : subWeeks(d, 1)));
    } else {
      setCurrentDate((d) => (direction > 0 ? addMonths(d, 1) : subMonths(d, 1)));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="space-y-4">
      {/* Calendar controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">
            {viewMode === "week"
              ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")}`
              : format(currentDate, "MMMM yyyy")}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
          <div className="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-r-none h-8", viewMode === "week" && "bg-muted")}
              onClick={() => setViewMode("week")}
            >
              Week
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-l-none h-8", viewMode === "month" && "bg-muted")}
              onClick={() => setViewMode("month")}
            >
              Month
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDate.get(key) || [];
          const inCurrentMonth = isSameMonth(day, currentDate);

          return (
            <div
              key={key}
              className={cn(
                "bg-background min-h-[80px] p-1.5 transition-colors",
                viewMode === "week" && "min-h-[120px]",
                !inCurrentMonth && viewMode === "month" && "opacity-40",
                isToday(day) && "bg-primary/5"
              )}
            >
              <div className={cn(
                "text-xs font-medium mb-1",
                isToday(day) ? "text-primary" : "text-muted-foreground"
              )}>
                {isToday(day) ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px]">
                    {format(day, "d")}
                  </span>
                ) : (
                  format(day, "d")
                )}
              </div>
              <div className="space-y-0.5">
                {dayPosts.slice(0, 3).map((post) => (
                  <button
                    key={post.id}
                    onClick={() => onPostClick(post)}
                    className={cn(
                      "w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight truncate transition-colors",
                      post.platform === "linkedin"
                        ? "bg-[#0077B5]/10 text-[#0077B5] hover:bg-[#0077B5]/20"
                        : "bg-pink-500/10 text-pink-600 hover:bg-pink-500/20",
                      post.status === "published" && "opacity-60 line-through"
                    )}
                  >
                    {post.platform === "linkedin" ? "🔗" : "📸"}{" "}
                    {post.content_text.slice(0, 30)}
                  </button>
                ))}
                {dayPosts.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{dayPosts.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#0077B5]/20" />
          <span>LinkedIn</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-pink-500/20" />
          <span>Instagram</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-muted opacity-60" />
          <span>Published</span>
        </div>
      </div>
    </div>
  );
}
