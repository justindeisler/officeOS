import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Timer } from "@/components/time/Timer";
import { TimeEntryForm } from "@/components/time/TimeEntryForm";
import { DailyTimeline } from "@/components/time/DailyTimeline";
import { WeeklySummary } from "@/components/time/WeeklySummary";

export function TimePage() {
  const [showManualEntry, setShowManualEntry] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Time Tracking</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Track time spent on tasks and projects.
          </p>
        </div>
        <Button onClick={() => setShowManualEntry(true)} variant="outline" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Main Content */}
        <div className="space-y-6">
          <Tabs defaultValue="daily" className="w-full">
            <TabsList>
              <TabsTrigger value="daily">Daily Log</TabsTrigger>
              <TabsTrigger value="weekly">Weekly Summary</TabsTrigger>
            </TabsList>
            <TabsContent value="daily" className="mt-4">
              <DailyTimeline />
            </TabsContent>
            <TabsContent value="weekly" className="mt-4">
              <WeeklySummary />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - Timer */}
        <div className="space-y-4">
          <Timer />
        </div>
      </div>

      {/* Manual Entry Dialog */}
      <TimeEntryForm
        open={showManualEntry}
        onOpenChange={setShowManualEntry}
      />
    </div>
  );
}
