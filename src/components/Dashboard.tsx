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
  Wrench // New Icon
} from 'lucide-react';
import Embed from './Embed';
import Extract from './Extract';
import Vault from './Vault';
import Tools from './Tools'; // Import Tools

type Tab = 'embed' | 'extract' | 'vault' | 'tools';

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

  // Helper for tab buttons
  const TabButton = ({ id, icon: Icon, label }: { id: Tab; icon: any; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab === id
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
          : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
        }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );

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

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-4">
              <span className="text-sm text-slate-400">{user?.email}</span>
              <button onClick={handleSignOut} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-slate-400 hover:text-white">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <TabButton id="embed" icon={Upload} label="Embed Files" />
          <TabButton id="extract" icon={Download} label="Extract Files" />
          <TabButton id="vault" icon={FolderLock} label="My Vault" />
          {/* New Tools Tab */}
          <button
            onClick={() => setActiveTab('tools')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab === 'tools'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
          >
            <Wrench className="w-5 h-5" />
            Tools
          </button>
        </div>

        <div className="animate-fade-in">
          {activeTab === 'embed' && <Embed />}
          {activeTab === 'extract' && <Extract />}
          {activeTab === 'vault' && <Vault />}
          {activeTab === 'tools' && <Tools />}
        </div>
      </div>
    </div>
  );
}
