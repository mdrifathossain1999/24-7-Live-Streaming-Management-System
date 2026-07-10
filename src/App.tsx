import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LayoutDashboard, Film, Key, Calendar, Settings, LogOut, Radio } from 'lucide-react';

import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PlaylistManager from './components/PlaylistManager';
import StreamKeysManager from './components/StreamKeysManager';
import ScheduleManager from './components/ScheduleManager';
import SettingsManager from './components/SettingsManager';

type Tab = 'dashboard' | 'playlist' | 'destinations' | 'schedule' | 'settings';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('streaming_token'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('streaming_username'));
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const handleLoginSuccess = (userToken: string, userNm: string) => {
    localStorage.setItem('streaming_token', userToken);
    localStorage.setItem('streaming_username', userNm);
    setToken(userToken);
    setUsername(userNm);
  };

  const handleLogout = () => {
    localStorage.removeItem('streaming_token');
    localStorage.removeItem('streaming_username');
    setToken(null);
    setUsername(null);
    setActiveTab('dashboard');
  };

  // If token is missing, force render the Login view
  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'playlist':
        return <PlaylistManager token={token} />;
      case 'destinations':
        return <StreamKeysManager token={token} />;
      case 'schedule':
        return <ScheduleManager token={token} />;
      case 'settings':
        return <SettingsManager token={token} />;
      default:
        return <Dashboard token={token} />;
    }
  };

  const sidebarItems = [
    { id: 'dashboard', label: 'Broadcast Desk', icon: LayoutDashboard },
    { id: 'playlist', label: 'Video Playlist', icon: Film },
    { id: 'destinations', label: 'Stream Targets', icon: Key },
    { id: 'schedule', label: 'Stream Schedule', icon: Calendar },
    { id: 'settings', label: 'Profile Settings', icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar navigation */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 shrink-0 flex flex-col justify-between">
        <div>
          {/* Logo Brand banner */}
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600/10 border border-red-500/30 rounded-xl flex items-center justify-center">
              <Radio className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wider uppercase">Streamer 24/7</h2>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide">Live Stream Controller</span>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="p-4 space-y-1.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-red-600 text-white shadow-lg shadow-red-950/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile / Logout card */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-2 bg-slate-950/20">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Operator</p>
            <p className="text-sm font-bold text-white truncate">{username || 'admin'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-xl transition-all cursor-pointer shrink-0"
            title="Secure Logout"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {renderActiveTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

    </div>
  );
}
