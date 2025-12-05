import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield,
  Upload,
  Download,
  FolderLock,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import Embed from './Embed';
import Extract from './Extract';
import Vault from './Vault';

type Tab = 'embed' | 'extract' | 'vault';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('embed');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <nav className="bg-slate-800/80 backdrop-blur-xl border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-xl">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">StegoVault</h1>
                <p className="text-xs text-slate-400">Zero-knowledge privacy</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <span className="text-sm text-slate-400">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-400 hover:text-white"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-slate-700">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-slate-400 px-4">{user?.email}</span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-4 py-2 text-white hover:bg-slate-700 rounded-lg transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('embed')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === 'embed'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Upload className="w-5 h-5" />
            Embed Files
          </button>
          <button
            onClick={() => setActiveTab('extract')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === 'extract'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Download className="w-5 h-5" />
            Extract Files
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === 'vault'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <FolderLock className="w-5 h-5" />
            My Vault
          </button>
        </div>

        <div className="animate-fade-in">
          {activeTab === 'embed' && <Embed />}
          {activeTab === 'extract' && <Extract />}
          {activeTab === 'vault' && <Vault />}
        </div>
      </div>
    </div>
  );
}
