import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import SharedExtract from './components/SharedExtract'; // Import the new component

function AppContent() {
  const { user, loading } = useAuth();
  const [shareId, setShareId] = useState<string | null>(null);

  useEffect(() => {
    // Check for ?share=ID in the URL
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('share');
    if (shared) setShareId(shared);
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  // 1. If User clicks a share link
  if (shareId) {
    // They MUST be logged in to verify their email against the allow-list
    if (!user) return <Auth />;

    return <SharedExtract
      imageId={shareId}
      onBack={() => {
        // Clear URL param to go back to dashboard
        window.history.pushState({}, '', '/');
        setShareId(null);
      }}
    />;
  }

  // 2. Normal Flow
  return user ? <Dashboard /> : <Auth />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
