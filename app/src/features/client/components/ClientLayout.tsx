import { useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useClientAuthStore } from '../stores/clientAuthStore';
import { Button } from '@/components/ui/button';
import { CheckSquare, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function ClientLayout() {
  const { client, checkAuth, logout } = useClientAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = () => {
    logout();
    navigate('/client/login');
  };

  if (!client) {
    return null; // Loading or not authenticated
  }

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const navItems = [
    { label: 'Tasks', icon: CheckSquare, href: '/client/dashboard' },
  ];

  const isActive = (href: string) => location.pathname === href;

  const SidebarContent = () => (
    <>
      {/* Profile section */}
      <div className="flex items-center gap-3 p-4 border-b">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
          {getInitials(client.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{client.company || 'Client Portal'}</p>
          <p className="text-xs text-muted-foreground truncate">{client.name}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 p-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t mt-auto">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
            {getInitials(client.name)}
          </div>
          <span className="font-medium text-sm">{client.company || 'Client Portal'}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-card border-r">
        <SidebarContent />
      </div>

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="p-6 lg:p-8 bg-background min-h-screen">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
