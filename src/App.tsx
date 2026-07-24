import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LayoutDashboard, Film, Key, Calendar, Settings, LogOut, Radio, Cloud, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase';

import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PlaylistManager from './components/PlaylistManager';
import StreamKeysManager from './components/StreamKeysManager';
import ScheduleManager from './components/ScheduleManager';
import SettingsManager from './components/SettingsManager';
import { safeFetchJson } from './utils';
import {
  findBackupFile,
  createBackupFile,
  getBackupContent,
  updateBackupContent,
  fetchLocalData,
  restoreLocalData,
  GoogleDriveAuthError
} from './lib/driveSync';

function parseErrorMessage(message: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = message.match(urlRegex);
  if (matches && matches.length > 0) {
    const url = matches[0];
    const textBefore = message.split(url)[0];
    const textAfter = message.split(url)[1];
    return { hasUrl: true, url, textBefore, textAfter };
  }
  return { hasUrl: false, url: '', textBefore: message, textAfter: '' };
}

type Tab = 'dashboard' | 'playlist' | 'destinations' | 'schedule' | 'settings';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('streaming_token'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('streaming_username'));
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isApproved, setIsApproved] = useState<boolean>(true);

  // Google Drive background auto-sync states
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'checking' | 'restoring' | 'synced' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [driveEmail, setDriveEmail] = useState<string | null>(localStorage.getItem('google_user_email'));

  useEffect(() => {
    if (!token) return;
    const checkApproval = async () => {
      try {
        const { data } = await safeFetchJson<{ approved: number }>('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (data) {
          setIsApproved(data.approved === 1);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };
    checkApproval();
    // Poll every 8 seconds to check if they get approved while viewing the site
    const interval = setInterval(checkApproval, 8000);
    return () => clearInterval(interval);
  }, [token]);

  // Google Drive background auto-sync effect
  useEffect(() => {
    const driveToken = localStorage.getItem('google_drive_access_token');
    if (!driveToken || !token) {
      setSyncStatus('idle');
      return;
    }

    let isSubscribed = true;
    let syncInterval: NodeJS.Timeout | null = null;
    let localDataString = '';

    const runInitialSync = async () => {
      try {
        setSyncStatus('checking');
        setSyncMessage('Connecting Google Drive...');

        // 1. Find or create the backup file in Google Drive
        let fileId = await findBackupFile(driveToken);
        if (!fileId) {
          setSyncMessage('Initializing auto-save file...');
          fileId = await createBackupFile(driveToken);
        }

        if (!isSubscribed) return;
        setDriveFileId(fileId);

        // 2. Fetch current local configurations
        const local = await fetchLocalData(token);
        const hasLocalKeys = local.streamKeys.length > 0;
        const hasLocalSchedules = local.schedules.length > 0;

        // 3. Try to fetch cloud content from Google Drive
        const backup = await getBackupContent(driveToken, fileId);

        if (!isSubscribed) return;

        // 4. If Google Drive contains a backup, and local is empty, perform auto-restore!
        if (backup && (backup.streamKeys.length > 0 || backup.schedules.length > 0) && !hasLocalKeys && !hasLocalSchedules) {
          setSyncStatus('restoring');
          setSyncMessage('Restoring backup from Google Drive...');
          const restored = await restoreLocalData(token, backup);
          if (restored) {
            setSyncStatus('synced');
            setSyncMessage('Configurations restored from Drive!');
            
            // Re-fetch restored local data string so we don't immediately overwrite it
            const freshLocal = await fetchLocalData(token);
            localDataString = JSON.stringify({
              settings: freshLocal.settings,
              streamKeys: freshLocal.streamKeys.map(k => ({ platform: k.platform, name: k.name, rtmpUrl: k.rtmpUrl, streamKey: k.streamKey, enabled: k.enabled })),
              schedules: freshLocal.schedules.map(s => ({ videoId: s.videoId, videoTitle: s.videoTitle, streamKeyId: s.streamKeyId, streamKeyName: s.streamKeyName, scheduledTime: s.scheduledTime, status: s.status }))
            });

            // Refresh tab to show restored data
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            setSyncStatus('error');
            setSyncMessage('Failed to restore from Google Drive');
          }
        } else {
          // Otherwise, we perform auto-backup right now
          setSyncStatus('synced');
          setSyncMessage('Auto-saved to Google Drive');
          
          // Generate local baseline representation
          const baselineData = {
            settings: local.settings,
            streamKeys: local.streamKeys.map(k => ({ platform: k.platform, name: k.name, rtmpUrl: k.rtmpUrl, streamKey: k.streamKey, enabled: k.enabled })),
            schedules: local.schedules.map(s => ({ videoId: s.videoId, videoTitle: s.videoTitle, streamKeyId: s.streamKeyId, streamKeyName: s.streamKeyName, scheduledTime: s.scheduledTime, status: s.status }))
          };
          localDataString = JSON.stringify(baselineData);

          // Update Drive immediately to keep it safe
          await updateBackupContent(driveToken, fileId, {
            settings: local.settings,
            streamKeys: baselineData.streamKeys,
            schedules: baselineData.schedules,
            updatedAt: new Date().toISOString()
          });
        }

        // 5. Start background auto-save loop
        syncInterval = setInterval(async () => {
          try {
            const currentToken = localStorage.getItem('google_drive_access_token');
            if (!currentToken) return;

            const currentLocal = await fetchLocalData(token);
            const currentPayload = {
              settings: currentLocal.settings,
              streamKeys: currentLocal.streamKeys.map(k => ({ platform: k.platform, name: k.name, rtmpUrl: k.rtmpUrl, streamKey: k.streamKey, enabled: k.enabled })),
              schedules: currentLocal.schedules.map(s => ({ videoId: s.videoId, videoTitle: s.videoTitle, streamKeyId: s.streamKeyId, streamKeyName: s.streamKeyName, scheduledTime: s.scheduledTime, status: s.status }))
            };
            const currentString = JSON.stringify(currentPayload);

            if (currentString !== localDataString && fileId) {
              setSyncStatus('checking');
              setSyncMessage('Auto-saving changes...');
              const updated = await updateBackupContent(currentToken, fileId, {
                settings: currentLocal.settings,
                streamKeys: currentPayload.streamKeys,
                schedules: currentPayload.schedules,
                updatedAt: new Date().toISOString()
              });
              if (updated) {
                localDataString = currentString;
                setSyncStatus('synced');
                setSyncMessage('Auto-saved to Google Drive');
              } else {
                setSyncStatus('error');
                setSyncMessage('Failed to auto-save');
              }
            }
          } catch (loopErr: any) {
            const isAuthErr = loopErr instanceof GoogleDriveAuthError ||
              loopErr?.name === 'GoogleDriveAuthError' ||
              (typeof loopErr === 'object' && loopErr !== null && (
                (loopErr.message && (
                  loopErr.message.includes('invalid authentication credentials') ||
                  loopErr.message.includes('OAuth 2') ||
                  loopErr.message.includes('UNAUTHENTICATED')
                )) ||
                (loopErr.error && (
                  loopErr.error.includes('invalid authentication credentials') ||
                  loopErr.error.includes('OAuth 2') ||
                  loopErr.error.includes('UNAUTHENTICATED')
                ))
              ));

            if (isAuthErr) {
              console.warn('Google Drive token expired during auto-sync loop. Clearing stale token.');
              localStorage.removeItem('google_drive_access_token');
              setSyncStatus('error');
              setSyncMessage('Google Drive session expired. Click Reconnect to sign in.');
              if (syncInterval) clearInterval(syncInterval);
            } else {
              console.error('Auto-sync loop error:', loopErr);
            }
          }
        }, 12000); // Check every 12 seconds

      } catch (err: any) {
        const isAuthErr = err instanceof GoogleDriveAuthError ||
          err?.name === 'GoogleDriveAuthError' ||
          (typeof err === 'object' && err !== null && (
            (err.message && (
              err.message.includes('invalid authentication credentials') ||
              err.message.includes('OAuth 2') ||
              err.message.includes('UNAUTHENTICATED')
            )) ||
            (err.error && (
              err.error.includes('invalid authentication credentials') ||
              err.error.includes('OAuth 2') ||
              err.error.includes('UNAUTHENTICATED')
            ))
          ));

        if (isAuthErr) {
          console.warn('Google Drive access token expired or invalid. Clearing stale token.');
          localStorage.removeItem('google_drive_access_token');
          setSyncStatus('error');
          setSyncMessage('Google Drive session expired. Click Reconnect to sign in.');
        } else {
          const errorDetails = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
          console.error('Google Drive sync initialization error:', err, errorDetails);
          setSyncStatus('error');
          setSyncMessage(`Drive Sync error: ${errorDetails}`);
        }
      }
    };

    runInitialSync();

    return () => {
      isSubscribed = false;
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [token]);

  const [isReconnectingDrive, setIsReconnectingDrive] = useState(false);

  const handleReconnectGoogleDrive = async () => {
    setIsReconnectingDrive(true);
    try {
      setSyncStatus('checking');
      setSyncMessage('Connecting Google Drive...');
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential && credential.accessToken) {
        localStorage.setItem('google_drive_access_token', credential.accessToken);
      }
      if (result.user?.email) {
        localStorage.setItem('google_user_email', result.user.email);
        setDriveEmail(result.user.email);
      }
      setSyncStatus('idle');
      setSyncMessage('Google Drive reconnected successfully');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: any) {
      console.error('Drive reconnect failed:', err);
      setSyncStatus('error');
      setSyncMessage(`Re-connect failed: ${err.message || 'Cancelled'}`);
    } finally {
      setIsReconnectingDrive(false);
    }
  };

  const handleLoginSuccess = (userToken: string, userNm: string) => {
    localStorage.setItem('streaming_token', userToken);
    localStorage.setItem('streaming_username', userNm);
    setToken(userToken);
    setUsername(userNm);
    setDriveEmail(localStorage.getItem('google_user_email'));
  };

  const handleLogout = () => {
    localStorage.removeItem('streaming_token');
    localStorage.removeItem('streaming_username');
    localStorage.removeItem('google_drive_access_token');
    localStorage.removeItem('google_user_email');
    setToken(null);
    setUsername(null);
    setDriveEmail(null);
    setDriveFileId(null);
    setSyncStatus('idle');
    setSyncMessage('');
    setActiveTab('dashboard');
  };

  // If token is missing, force render the Login view
  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'playlist':
        return <PlaylistManager token={token} isApproved={isApproved} />;
      case 'destinations':
        return <StreamKeysManager token={token} isApproved={isApproved} />;
      case 'schedule':
        return <ScheduleManager token={token} isApproved={isApproved} />;
      case 'settings':
        return <SettingsManager token={token} isApproved={isApproved} username={username} />;
      default:
        return <Dashboard token={token} isApproved={isApproved} />;
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

        <div>
          {/* Google Drive Auto-Sync Status HUD */}
          {(localStorage.getItem('google_drive_access_token') || driveEmail || syncStatus === 'error') && (() => {
            const parsed = parseErrorMessage(syncMessage);
            const isAuthError = !localStorage.getItem('google_drive_access_token') ||
              syncMessage.toLowerCase().includes('expired') ||
              syncMessage.toLowerCase().includes('re-connect') ||
              syncMessage.toLowerCase().includes('credential') ||
              syncMessage.toLowerCase().includes('oauth');
            return (
              <div className={`mx-4 mb-3 p-3 border rounded-xl flex flex-col gap-2 transition-all duration-200 ${
                syncStatus === 'error'
                  ? 'bg-rose-950/40 border-rose-900/50'
                  : 'bg-slate-950/60 border-slate-800/85'
              }`}>
                <div className="flex items-start gap-2.5">
                  <div className="shrink-0 mt-1">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        syncStatus === 'synced' ? 'bg-emerald-400' :
                        syncStatus === 'error' ? 'bg-rose-400' : 'bg-amber-400'
                      }`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                        syncStatus === 'synced' ? 'bg-emerald-500' :
                        syncStatus === 'error' ? 'bg-rose-500' : 'bg-amber-500'
                      }`}></span>
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Cloud className={`w-3.5 h-3.5 shrink-0 ${syncStatus === 'error' ? 'text-rose-400' : 'text-blue-400'}`} />
                      Drive Auto-Sync
                    </p>

                    {syncStatus === 'error' ? (
                      <div className="mt-1.5 text-xs text-rose-200 leading-normal font-medium space-y-2">
                        {parsed.hasUrl ? (
                          <>
                            <p className="text-[11px] text-rose-200/90 leading-relaxed">
                              {parsed.textBefore.trim()}
                            </p>
                            <a
                              href={parsed.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 w-full px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] uppercase tracking-wide transition-colors shadow-sm cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Enable Drive API
                            </a>
                            {parsed.textAfter && (
                              <p className="text-[10px] text-rose-300/70 leading-normal">
                                {parsed.textAfter.trim()}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-[11px] leading-relaxed">{syncMessage}</p>
                        )}

                        {isAuthError && (
                          <button
                            onClick={handleReconnectGoogleDrive}
                            disabled={isReconnectingDrive}
                            className="inline-flex items-center justify-center gap-1.5 w-full px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-[10px] uppercase tracking-wide transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isReconnectingDrive ? 'animate-spin' : ''}`} />
                            Reconnect Google Drive
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-200 mt-0.5 truncate leading-tight font-medium" title={syncMessage}>
                        {syncMessage || 'Connected'}
                      </p>
                    )}

                    {driveEmail && (
                      <p className="text-[10px] text-slate-500 truncate mt-1.5 leading-none">
                        {driveEmail}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

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
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          {!isApproved && (
            <div className="mb-6 p-4 bg-amber-950/40 border border-amber-900/40 rounded-2xl flex items-start gap-3.5 shadow-lg shadow-amber-950/10">
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5.5 h-5.5 text-amber-500 animate-pulse" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-400">Account Pending Admin Approval</h4>
                <p className="text-xs text-amber-200/85 mt-0.5 leading-relaxed">
                  Your registration was successful, but your account is awaiting administrator approval. 
                  You are in **View-Only Mode**: you can browse the site and watch system state, but you cannot edit playlists, control live streams, or modify settings.
                </p>
              </div>
            </div>
          )}
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
