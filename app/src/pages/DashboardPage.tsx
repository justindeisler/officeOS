import { format } from "date-fns";
import { TodayFocus } from "@/components/dashboard/TodayFocus";
import { TimeTrackedWidget } from "@/components/dashboard/TimeTrackedWidget";
import { ActiveProjectsWidget } from "@/components/dashboard/ActiveProjectsWidget";
import { RevenueWidget } from "@/components/dashboard/RevenueWidget";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  const today = new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{getGreeting()}</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {format(today, "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Main Grid - uses container queries for responsive layout */}
      <div className="grid gap-6 @lg:grid-cols-3">
        {/* Left Column - Focus & Deadlines */}
        <div className="@lg:col-span-2 space-y-6">
          <TodayFocus />
          <UpcomingDeadlines />
        </div>

        {/* Right Column - Stats */}
        <div className="space-y-6">
          <TimeTrackedWidget />
          <ActiveProjectsWidget />
          <RevenueWidget />
        </div>
      </div>
    </div>
  );
}
