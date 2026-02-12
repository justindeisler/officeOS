import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Inbox,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useUnprocessedCount } from "@/stores/captureStore";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Time", href: "/time", icon: Clock },
  { name: "Inbox", href: "/inbox", icon: Inbox, showBadge: true },
  { name: "James", href: "/james-brain", icon: Bot },
];

export function BottomNav() {
  const unprocessedCount = useUnprocessedCount();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors relative",
                "min-h-[44px]", // Ensure 44px touch target
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                  {item.showBadge && unprocessedCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-4 min-w-4 p-0 flex items-center justify-center text-[10px]"
                    >
                      {unprocessedCount > 9 ? "9+" : unprocessedCount}
                    </Badge>
                  )}
                </div>
                <span className="text-[10px]">{item.name}</span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
