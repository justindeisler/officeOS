import { useEffect } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { useClientAuthStore } from '../stores/clientAuthStore';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function ClientLayout() {
  const { client, checkAuth, logout } = useClientAuthStore();
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/client/dashboard" className="text-xl font-bold text-gray-900">
                {client.company || 'Client Portal'}
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{client.name}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
