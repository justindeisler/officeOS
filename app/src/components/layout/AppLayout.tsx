import { useState, useMemo } from "react";
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
  LogOut,
  Folder,
  Brain,
  Bot,
  Lightbulb,
  BarChart3,
  DollarSign,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUnprocessedCount } from "@/stores/captureStore";
import { useUserName } from "@/stores/settingsStore";
import { useAuthStore } from "@/stores/authStore";
import { useActiveProjects } from "@/stores/projectStore";
import { NavItemWithChildren, NavChild } from "./NavItemWithChildren";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  showBadge?: boolean;
  children?: NavChild[];
}

// Base navigation items (Projects is dynamically generated with active projects)
const baseNavigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Time", href: "/time", icon: Clock },
  { name: "Inbox", href: "/inbox", icon: Inbox, showBadge: true },
  { name: "Clients", href: "/clients", icon: Users },
  // Projects nav item is added dynamically below
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
  { name: "Social Media", href: "/social-media", icon: Share2 },
  { name: "PRD Creator", href: "/prd", icon: FileText },
  { 
    name: "James", 
    href: "/james-brain", 
    icon: Bot,
    children: [
      { name: "Overview", href: "/james-brain", icon: LayoutDashboard },
      { name: "Suggestions", href: "/james-brain/suggestions", icon: Lightbulb },
      { name: "Tasks", href: "/james-brain/tasks", icon: CheckSquare },
      { name: "Automations", href: "/james-brain/automations", icon: Clock },
      { name: "Activity Log", href: "/james-brain/activity", icon: Zap },
      { name: "Token Usage", href: "/james-brain/usage", icon: BarChart3 },
      { name: "API Costs", href: "/james-brain/api-costs", icon: DollarSign },
      { name: "Second Brain", href: "/second-brain", icon: Brain },
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
  const logout = useAuthStore((state) => state.logout);
  const activeProjects = useActiveProjects();

  // Build navigation with dynamic project children
  const navigation = useMemo(() => {
    // Create project nav item with active projects as children
    const projectChildren: NavChild[] = [
      { name: "All Projects", href: "/projects", icon: FolderKanban },
      ...activeProjects.slice(0, 10).map((project) => ({
        name: project.name.length > 20 ? `${project.name.slice(0, 20)}...` : project.name,
        href: `/projects/${project.id}`,
        icon: Folder,
      })),
    ];

    const projectNavItem: NavItem = {
      name: "Projects",
      href: "/projects",
      icon: FolderKanban,
      children: projectChildren,
    };

    // Insert Projects nav item at the correct position (after Clients)
    const clientsIndex = baseNavigation.findIndex((item) => item.name === "Clients");
    const navItems = [...baseNavigation];
    navItems.splice(clientsIndex + 1, 0, projectNavItem);

    return navItems;
  }, [activeProjects]);

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
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
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
      <div className="border-t p-4 space-y-1">
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
        <button
          onClick={() => {
            handleNavClick();
            logout();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-sidebar-foreground/70 hover:bg-red-500/10 hover:text-red-500"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
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
        <span 
          className="text-3xl text-primary"
          style={{ fontFamily: "'Sacramento', cursive" }}
        >
          personal assistant
        </span>
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
      <main className="flex-1 pt-14 md:pt-0 md:pl-64 transition-all duration-300 @container">
        <div className="h-full p-4 sm:p-6 md:p-8">
          <Outlet />
        </div>
      </main>

    </div>
  );
}
