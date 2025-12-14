import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Upload, Download, FolderLock, LogOut, Menu, X, Wrench, MessageSquare } from 'lucide-react';
import UnifiedEmbed from './UnifiedEmbed';
import UnifiedExtract from './UnifiedExtract';
import Vault from './Vault';
import Tools from './Tools';
import ThemeToggle from './ThemeToggle';
import Chat from './Chat';

type Tab = 'embed' | 'extract' | 'vault' | 'tools' | 'chat';

// FIX: Define full class strings explicitly so Tailwind doesn't purge them
const TAB_VARIANTS = {
  blue: {
    active: 'bg-white dark:bg-blue-600 border-blue-200 dark:border-blue-500 text-blue-600 dark:text-white shadow-blue-500/10',
    inactive: 'hover:text-blue-500 dark:hover:text-blue-400'
  },
  emerald: {
    active: 'bg-white dark:bg-emerald-600 border-emerald-200 dark:border-emerald-500 text-emerald-600 dark:text-white shadow-emerald-500/10',
    inactive: 'hover:text-emerald-500 dark:hover:text-emerald-400'
  },
  violet: {
    active: 'bg-white dark:bg-violet-600 border-violet-200 dark:border-violet-500 text-violet-600 dark:text-white shadow-violet-500/10',
    inactive: 'hover:text-violet-500 dark:hover:text-violet-400'
  },
  amber: {
    active: 'bg-white dark:bg-amber-600 border-amber-200 dark:border-amber-500 text-amber-600 dark:text-white shadow-amber-500/10',
    inactive: 'hover:text-amber-500 dark:hover:text-amber-400'
  },
  pink: {
    active: 'bg-white dark:bg-pink-600 border-pink-200 dark:border-pink-500 text-pink-600 dark:text-white shadow-pink-500/10',
    inactive: 'hover:text-pink-500 dark:hover:text-pink-400'
  }
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('embed');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try { await signOut(); } catch (err) { console.error('Error signing out:', err); }
  };

  // Improved TabButton using the lookup object
  const TabButton = ({ id, icon: Icon, label, color }: { id: Tab; icon: any; label: string; color: keyof typeof TAB_VARIANTS }) => {
    const style = TAB_VARIANTS[color];
    const isActive = activeTab === id;

    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 ease-out whitespace-nowrap border ${isActive
          ? `${style.active} shadow-xl`
          : `bg-white/40 dark:bg-slate-800/40 border-transparent text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:scale-105 ${style.inactive}`
          }`}
      >
        <Icon className={`w-5 h-5 ${isActive ? '' : 'opacity-70'}`} />
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen transition-colors duration-300
      bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-indigo-50 to-purple-50
      dark:bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] dark:from-slate-900 dark:via-slate-900 dark:to-slate-950"
    >

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 transition-all duration-300 border-b
        bg-white/70 backdrop-blur-2xl border-indigo-100/50 
        dark:bg-slate-900/80 dark:border-slate-800"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl shadow-lg transition-transform hover:scale-105
                bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/20"
              >
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
                  StegoVault
                </h1>
                <p className="text-xs font-medium text-indigo-500 dark:text-blue-400">
                  Zero-Knowledge Privacy
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <ThemeToggle />

              <div className="text-right">
                <p className="text-sm font-medium text-slate-700 dark:text-white">{user?.email?.split('@')[0]}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Premium Account</p>
              </div>

              <button onClick={handleSignOut} className="flex items-center gap-2 px-4 py-2 bg-slate-200/50 hover:bg-red-50 hover:text-red-600 dark:bg-slate-700/50 dark:hover:bg-red-900/20 dark:hover:text-red-400 text-slate-600 dark:text-slate-300 rounded-lg transition-all border border-transparent hover:border-red-200 dark:hover:border-red-500/30">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Tab Navigation */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide md:justify-center p-1">
          <TabButton id="embed" icon={Upload} label="Hide Files" color="blue" />
          <TabButton id="extract" icon={Download} label="Extract Files" color="emerald" />
          <TabButton id="vault" icon={FolderLock} label="My Vault" color="violet" />
          <TabButton id="tools" icon={Wrench} label="Tools" color="amber" />
          <TabButton id="chat" icon={MessageSquare} label="Messages" color="pink" />
        </div>

        <div className="animate-fade-in">
          {activeTab === 'embed' && <UnifiedEmbed />}
          {activeTab === 'extract' && <UnifiedExtract />}
          {activeTab === 'vault' && <Vault />}
          {activeTab === 'tools' && <Tools />}
          {activeTab === 'chat' && <Chat />}
        </div>
      </main>
    </div>
  );
}