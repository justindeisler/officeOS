import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AboutSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>About</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Personal Assistant Dashboard v0.1.0
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Built with Tauri, React, and TypeScript
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Data stored in: ~/Library/Application Support/com.personal-assistant.app/
        </p>
      </CardContent>
    </Card>
  );
}
