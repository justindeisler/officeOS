import { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Inbox,
  Users,
  FolderKanban,
  Receipt,
  Calculator,
  Settings,
  Zap,
  Menu,
  X,
  TrendingUp,
  TrendingDown,
  Package,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUnprocessedCount } from "@/stores/captureStore";
import { useUserName } from "@/stores/settingsStore";
import { ClaudePanel } from "@/components/claude/ClaudePanel";
import { ClaudeFAB } from "@/components/claude/ClaudeFAB";
import { useClaudePanelOpen, useClaudePanelWidth } from "@/stores/claudeStore";
import { NavItemWithChildren, NavChild } from "./NavItemWithChildren";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  showBadge?: boolean;
  children?: NavChild[];
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Time", href: "/time", icon: Clock },
  { name: "Inbox", href: "/inbox", icon: Inbox, showBadge: true },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  {
    name: "Accounting",
    href: "/accounting",
    icon: Calculator,
    children: [
      { name: "Dashboard", href: "/accounting", icon: LayoutDashboard },
      { name: "Invoices", href: "/accounting/invoices", icon: Receipt },
      { name: "Income", href: "/accounting/income", icon: TrendingUp },
      { name: "Expenses", href: "/accounting/expenses", icon: TrendingDown },
      { name: "Assets", href: "/accounting/assets", icon: Package },
      { name: "Reports", href: "/accounting/reports", icon: FileText },
    ],
  },
];

interface AppLayoutProps {
  onQuickCapture?: () => void;
}

export function AppLayout({ onQuickCapture }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const unprocessedCount = useUnprocessedCount();
  const userName = useUserName();
  const claudePanelOpen = useClaudePanelOpen();
  const claudePanelWidth = useClaudePanelWidth();

  // Close sidebar on navigation (mobile only)
  const handleNavClick = () => {
    setSidebarOpen(false);
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Profile */}
      <div className="flex h-20 items-center gap-3 px-4 border-b">
        <img
          src="/app-icon.png"
          alt="Profile"
          className="h-10 w-10 rounded-full shadow-lg ring-2 ring-primary/20 transition-transform duration-200 hover:scale-105"
        />
        <span className="text-sm font-medium text-sidebar-foreground truncate">
          {userName}
        </span>
      </div>

      {/* Quick Capture Button */}
      <div className="p-4 border-b">
        <Button
          onClick={() => {
            onQuickCapture?.();
            handleNavClick();
          }}
          className="w-full justify-start"
          variant="outline"
        >
          <Zap className="h-4 w-4 mr-2 text-yellow-500" />
          Quick Capture
          <kbd className="ml-auto text-[10px] text-muted-foreground hidden sm:inline">⌘⇧Space</kbd>
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          // Render expandable nav item for items with children
          if (item.children) {
            return (
              <NavItemWithChildren
                key={item.name}
                name={item.name}
                href={item.href}
                icon={item.icon}
                children={item.children}
                onNavigate={handleNavClick}
              />
            );
          }

          // Render standard nav link for items without children
          return (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={handleNavClick}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.name}
              {item.showBadge && unprocessedCount > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {unprocessedCount}
                </Badge>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <NavLink
          to="/settings"
          onClick={handleNavClick}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )
          }
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <img
          src="/app-icon.png"
          alt="Profile"
          className="h-8 w-8 rounded-full shadow-md"
        />
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r bg-sidebar transform transition-transform duration-200 ease-out md:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </Button>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-50 md:w-64 md:border-r md:bg-sidebar md:block">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main
        className="flex-1 pt-14 md:pt-0 md:pl-64 transition-all duration-300 @container"
        style={{
          marginRight: claudePanelOpen ? claudePanelWidth : 0,
        }}
      >
        <div className="h-full p-4 sm:p-6 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Claude Assistant Panel */}
      <ClaudePanel />

      {/* Claude FAB (Floating Action Button) */}
      <ClaudeFAB />
    </div>
  );
}
