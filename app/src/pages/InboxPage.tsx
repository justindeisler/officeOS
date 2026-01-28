import { useState } from "react";
import { Inbox, Zap, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CaptureCard } from "@/components/capture/CaptureCard";
import { QuickCaptureDialog } from "@/components/capture/QuickCaptureDialog";
import { ProcessCaptureDialog } from "@/components/capture/ProcessCaptureDialog";
import {
  useUnprocessedCaptures,
  useProcessedCaptures,
} from "@/stores/captureStore";
import type { Capture } from "@/types";

export function InboxPage() {
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [processingCapture, setProcessingCapture] = useState<Capture | null>(null);

  const unprocessedCaptures = useUnprocessedCaptures();
  const processedCaptures = useProcessedCaptures();

  const handleProcess = (capture: Capture) => {
    setProcessingCapture(capture);
    setProcessDialogOpen(true);
  };

  const handleCloseProcess = () => {
    setProcessDialogOpen(false);
    setProcessingCapture(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Inbox</h1>
        </div>
        <Button onClick={() => setCaptureDialogOpen(true)} className="w-full sm:w-auto">
          <Zap className="h-4 w-4 mr-2" />
          Quick Capture
        </Button>
      </div>

      <Tabs defaultValue="unprocessed" className="w-full">
        <TabsList>
          <TabsTrigger value="unprocessed" className="gap-2">
            <Inbox className="h-4 w-4" />
            Inbox
            {unprocessedCaptures.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {unprocessedCaptures.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="processed" className="gap-2">
            <Archive className="h-4 w-4" />
            Processed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unprocessed" className="mt-4">
          {unprocessedCaptures.length === 0 ? (
            <div className="rounded-lg border bg-card p-12 text-center">
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Inbox zero!</h3>
              <p className="text-muted-foreground text-sm mb-4">
                All captures have been processed. Nice work!
              </p>
              <Button onClick={() => setCaptureDialogOpen(true)}>
                <Zap className="h-4 w-4 mr-2" />
                Capture Something
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {unprocessedCaptures.map((capture) => (
                <CaptureCard
                  key={capture.id}
                  capture={capture}
                  onProcess={handleProcess}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="processed" className="mt-4">
          {processedCaptures.length === 0 ? (
            <div className="rounded-lg border bg-card p-12 text-center">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No processed captures</h3>
              <p className="text-muted-foreground text-sm">
                Processed captures will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {processedCaptures.map((capture) => (
                <CaptureCard
                  key={capture.id}
                  capture={capture}
                  onProcess={handleProcess}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <QuickCaptureDialog
        open={captureDialogOpen}
        onOpenChange={setCaptureDialogOpen}
      />

      <ProcessCaptureDialog
        open={processDialogOpen}
        onOpenChange={setProcessDialogOpen}
        capture={processingCapture}
        onClose={handleCloseProcess}
      />
    </div>
  );
}
