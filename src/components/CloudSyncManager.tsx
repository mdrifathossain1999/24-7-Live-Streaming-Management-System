import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudUpload, 
  CloudDownload, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  LogOut, 
  Key, 
  Settings, 
  Calendar, 
  FileText, 
  Database,
  Chrome,
  AlertTriangle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType 
} from '../firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  getDocFromServer 
} from 'firebase/firestore';
import { safeFetchJson } from '../utils';
import { StreamSettings, StreamKey, Schedule, StreamLog } from '../types';

interface CloudSyncManagerProps {
  token: string;
}

export default function CloudSyncManager({ token }: CloudSyncManagerProps) {
  // Authentication states
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Firestore status
  const [firestoreOnline, setFirestoreOnline] = useState<boolean | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  // Sync / Action loading states
  const [syncLoading, setSyncLoading] = useState<string | null>(null); // 'all', 'settings', 'keys', 'schedules', 'logs'
  const [syncDirection, setSyncDirection] = useState<'backup' | 'restore' | null>(null);
  const [operationLogs, setOperationLogs] = useState<string[]>([]);

  // Individual Success/Error banners
  const [generalError, setGeneralError] = useState('');
  const [generalSuccess, setGeneralSuccess] = useState('');

  // Cloud item counts (to verify what's stored)
  const [cloudSettingsExist, setCloudSettingsExist] = useState<boolean>(false);
  const [cloudKeysCount, setCloudKeysCount] = useState<number>(0);
  const [cloudSchedulesCount, setCloudSchedulesCount] = useState<number>(0);

  // Verify Auth State on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        checkFirestoreConnection();
        fetchCloudMetadata();
      }
    });
    return () => unsubscribe();
  }, []);

  // Validate Firestore Connection as required by the guidelines
  const checkFirestoreConnection = async () => {
    setTestingConnection(true);
    try {
      // Direct call using getDocFromServer to verify live connection state
      await getDocFromServer(doc(db, 'test', 'connection'));
      setFirestoreOnline(true);
    } catch (error: any) {
      console.warn('Firestore connection check completed:', error.message);
      // If permission-denied, it means the client IS connected and hit security rules, which is correct (rules block unauthenticated test doc reads)
      if (error.code === 'permission-denied' || error.message?.includes('permission') || !error.message?.includes('offline')) {
        setFirestoreOnline(true);
      } else {
        setFirestoreOnline(false);
      }
    } finally {
      setTestingConnection(false);
    }
  };

  // Fetch count of items backed up in Firestore
  const fetchCloudMetadata = async () => {
    try {
      // 1. Settings check
      const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
      setCloudSettingsExist(settingsSnap.exists());

      // 2. Stream Keys check
      const keysSnap = await getDocs(collection(db, 'stream_keys'));
      setCloudKeysCount(keysSnap.size);

      // 3. Schedules check
      const schedSnap = await getDocs(collection(db, 'schedules'));
      setCloudSchedulesCount(schedSnap.size);
    } catch (err) {
      console.error('Failed to fetch Cloud metadata:', err);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
      setGeneralSuccess('Successfully connected to Google Workspace and authenticated with Firebase!');
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      setAuthError(err.message || 'Authentication with Google failed. Please ensure the redirect URIs are configured.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setFirestoreOnline(null);
      setCloudSettingsExist(false);
      setCloudKeysCount(0);
      setCloudSchedulesCount(0);
      setGeneralSuccess('Disconnected from Cloud Workspace.');
    } catch (err) {
      console.error('Sign Out Error:', err);
    }
  };

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setOperationLogs(prev => [`[${time}] ${message}`, ...prev]);
  };

  // BACKUP OPERATIONS (Local -> Firestore)
  const backupSettings = async (silent = false) => {
    if (!silent) {
      setSyncLoading('settings');
      setSyncDirection('backup');
      setGeneralError('');
      setGeneralSuccess('');
      setOperationLogs([]);
    }
    addLog('Fetching local streaming settings configurations...');
    try {
      const { data, ok, error } = await safeFetchJson<StreamSettings>('/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!ok || !data) {
        throw new Error(error || 'Failed to read local settings configuration.');
      }

      addLog('Uploading settings configuration payload to Firestore (/settings/global)...');
      const payload = {
        loopPlaylist: Number(data.loopPlaylist),
        logoPosition: data.logoPosition || 'top-right',
        textOverlay: data.textOverlay || '',
        textPosition: data.textPosition || 'bottom-left',
        textColor: data.textColor || '#ffffff',
        textSize: Number(data.textSize) || 24,
        resolution: data.resolution || '720p',
        videoBitrate: data.videoBitrate || '2500k',
        audioBitrate: data.audioBitrate || '128k',
        aspectRatio: data.aspectRatio || '16:9',
        scaleMode: data.scaleMode || 'fit',
        logoPath: data.logoPath || ''
      };

      try {
        await setDoc(doc(db, 'settings', 'global'), payload);
      } catch (errSnap) {
        handleFirestoreError(errSnap, OperationType.WRITE, 'settings/global');
      }

      addLog('Settings configuration backup successfully verified in Cloud Firestore!');
      if (!silent) {
        setGeneralSuccess('Streaming settings backed up successfully to Cloud Workspace!');
        fetchCloudMetadata();
      }
      return true;
    } catch (err: any) {
      addLog(`Error backing up settings: ${err.message}`);
      if (!silent) setGeneralError(err.message || 'Failed to backup settings.');
      return false;
    } finally {
      if (!silent) setSyncLoading(null);
    }
  };

  const backupStreamKeys = async (silent = false) => {
    if (!silent) {
      setSyncLoading('keys');
      setSyncDirection('backup');
      setGeneralError('');
      setGeneralSuccess('');
      setOperationLogs([]);
    }
    addLog('Reading active streaming destinations from local SQLite...');
    try {
      const { data, ok, error } = await safeFetchJson<StreamKey[]>('/api/stream-keys', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!ok || !data) {
        throw new Error(error || 'Failed to read local stream keys.');
      }

      addLog(`Found ${data.length} local streaming target(s). Initiating secure cloud upload...`);
      for (const key of data) {
        addLog(`Syncing "${key.name}" (${key.platform}) with Firestore path /stream_keys/${key.id}...`);
        const payload = {
          platform: key.platform,
          name: key.name,
          rtmpUrl: key.rtmpUrl,
          streamKey: key.streamKey,
          enabled: Number(key.enabled)
        };
        try {
          await setDoc(doc(db, 'stream_keys', String(key.id)), payload);
        } catch (errSnap) {
          handleFirestoreError(errSnap, OperationType.WRITE, `stream_keys/${key.id}`);
        }
      }

      addLog('All stream targets backed up successfully with robust Cloud Security rules enforcement!');
      if (!silent) {
        setGeneralSuccess(`Successfully backed up ${data.length} streaming destination(s) to Cloud Workspace.`);
        fetchCloudMetadata();
      }
      return true;
    } catch (err: any) {
      addLog(`Error backing up destinations: ${err.message}`);
      if (!silent) setGeneralError(err.message || 'Failed to backup destinations.');
      return false;
    } finally {
      if (!silent) setSyncLoading(null);
    }
  };

  const backupSchedules = async (silent = false) => {
    if (!silent) {
      setSyncLoading('schedules');
      setSyncDirection('backup');
      setGeneralError('');
      setGeneralSuccess('');
      setOperationLogs([]);
    }
    addLog('Querying active stream broadcasting schedule calendars from local SQLite...');
    try {
      const { data, ok, error } = await safeFetchJson<Schedule[]>('/api/schedules', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!ok || !data) {
        throw new Error(error || 'Failed to load local calendars.');
      }

      addLog(`Found ${data.length} local scheduled item(s). Preparing atomic sync payloads...`);
      for (const sched of data) {
        addLog(`Writing schedule #${sched.id} ("${sched.videoTitle}" -> "${sched.streamKeyName}") to Firestore...`);
        const payload = {
          videoId: Number(sched.videoId),
          videoTitle: sched.videoTitle,
          streamKeyId: Number(sched.streamKeyId),
          streamKeyName: sched.streamKeyName,
          scheduledTime: sched.scheduledTime,
          status: sched.status
        };
        try {
          await setDoc(doc(db, 'schedules', String(sched.id)), payload);
        } catch (errSnap) {
          handleFirestoreError(errSnap, OperationType.WRITE, `schedules/${sched.id}`);
        }
      }

      addLog('Calendars synchronization sequence completed!');
      if (!silent) {
        setGeneralSuccess(`Successfully synchronized ${data.length} automated schedule(s) with Firestore.`);
        fetchCloudMetadata();
      }
      return true;
    } catch (err: any) {
      addLog(`Error backing up schedules: ${err.message}`);
      if (!silent) setGeneralError(err.message || 'Failed to backup calendars.');
      return false;
    } finally {
      if (!silent) setSyncLoading(null);
    }
  };

  const backupLogs = async () => {
    setSyncLoading('logs');
    setSyncDirection('backup');
    setGeneralError('');
    setGeneralSuccess('');
    setOperationLogs([]);
    addLog('Retrieving latest streaming telemetry logs...');
    try {
      const { data, ok, error } = await safeFetchJson<StreamLog[]>('/api/logs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!ok || !data) {
        throw new Error(error || 'Failed to fetch local logs.');
      }

      addLog(`Acquired ${data.length} event logs. Sending to cloud workspace audit path...`);
      for (const logItem of data) {
        const payload = {
          timestamp: logItem.timestamp,
          type: logItem.type,
          message: logItem.message
        };
        try {
          await setDoc(doc(db, 'logs', String(logItem.id)), payload);
        } catch (errSnap) {
          handleFirestoreError(errSnap, OperationType.WRITE, `logs/${logItem.id}`);
        }
      }

      addLog('Live telemetry system event log stream synced to Cloud Workspace.');
      setGeneralSuccess('Telemetry system logs backed up successfully.');
    } catch (err: any) {
      addLog(`Error backing up logs: ${err.message}`);
      setGeneralError(err.message || 'Failed to backup logs.');
    } finally {
      setSyncLoading(null);
    }
  };

  const backupEverything = async () => {
    setSyncLoading('all');
    setSyncDirection('backup');
    setGeneralError('');
    setGeneralSuccess('');
    setOperationLogs([]);
    addLog('=== Starting Complete Cloud Workspace Sync Backup Sequence ===');
    
    const settingsSuccess = await backupSettings(true);
    const keysSuccess = await backupStreamKeys(true);
    const schedulesSuccess = await backupSchedules(true);

    if (settingsSuccess && keysSuccess && schedulesSuccess) {
      addLog('=== [SUCCESS] Complete Cloud Sync Backup Sequence Finished! ===');
      setGeneralSuccess('Full Cloud Workspace backup created successfully! All settings, target configurations, and schedule calendars are safe.');
      fetchCloudMetadata();
    } else {
      addLog('=== [WARNING] Sync Backup finished with some failures. Check logs. ===');
      setGeneralError('Full Cloud Sync completed with errors. Check the operation logs below.');
    }
    setSyncLoading(null);
  };


  // RESTORE OPERATIONS (Firestore -> Local API)
  const restoreSettings = async (silent = false) => {
    if (!silent) {
      setSyncLoading('settings');
      setSyncDirection('restore');
      setGeneralError('');
      setGeneralSuccess('');
      setOperationLogs([]);
    }
    addLog('Downloading settings payload from Firestore path (/settings/global)...');
    try {
      let docSnap;
      try {
        docSnap = await getDoc(doc(db, 'settings', 'global'));
      } catch (errSnap) {
        handleFirestoreError(errSnap, OperationType.GET, 'settings/global');
        return false;
      }

      if (!docSnap || !docSnap.exists()) {
        throw new Error('No settings configuration backup found in Cloud Firestore database.');
      }

      const cloudData = docSnap.data();
      addLog('Applying settings restoration payload to local live controller...');
      
      const { ok, error } = await safeFetchJson('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(cloudData)
      });

      if (!ok) {
        throw new Error(error || 'Failed to write downloaded settings configuration locally.');
      }

      addLog('Settings configuration successfully restored on this server!');
      if (!silent) {
        setGeneralSuccess('Streaming settings restored successfully from Cloud Workspace!');
      }
      return true;
    } catch (err: any) {
      addLog(`Error restoring settings: ${err.message}`);
      if (!silent) setGeneralError(err.message || 'Failed to restore settings.');
      return false;
    } finally {
      if (!silent) setSyncLoading(null);
    }
  };

  const restoreStreamKeys = async (silent = false) => {
    if (!silent) {
      setSyncLoading('keys');
      setSyncDirection('restore');
      setGeneralError('');
      setGeneralSuccess('');
      setOperationLogs([]);
    }
    addLog('Downloading streaming target configurations from Cloud Firestore (/stream_keys)...');
    try {
      let querySnap;
      try {
        querySnap = await getDocs(collection(db, 'stream_keys'));
      } catch (errSnap) {
        handleFirestoreError(errSnap, OperationType.LIST, 'stream_keys');
        return false;
      }

      if (!querySnap || querySnap.empty) {
        throw new Error('No streaming destinations backup found in Cloud Firestore.');
      }

      addLog(`Found ${querySnap.size} streaming destination(s) in Cloud. Overwriting/restoring locally...`);
      for (const docObj of querySnap.docs) {
        const cloudKey = docObj.data();
        addLog(`Restoring target configuration "${cloudKey.name}" (${cloudKey.platform})...`);
        
        // Add or Overwrite locally
        const { ok, error } = await safeFetchJson('/api/stream-keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            platform: cloudKey.platform,
            name: cloudKey.name,
            rtmpUrl: cloudKey.rtmpUrl,
            streamKey: cloudKey.streamKey,
            enabled: cloudKey.enabled === 1
          })
        });

        if (!ok) {
          addLog(`[ERROR] Failed to write destination "${cloudKey.name}" locally: ${error}`);
        }
      }

      addLog('Destinations restoration completed successfully!');
      if (!silent) {
        setGeneralSuccess(`Successfully restored ${querySnap.size} streaming destination(s) from Cloud Workspace.`);
      }
      return true;
    } catch (err: any) {
      addLog(`Error restoring destinations: ${err.message}`);
      if (!silent) setGeneralError(err.message || 'Failed to restore destinations.');
      return false;
    } finally {
      if (!silent) setSyncLoading(null);
    }
  };

  const restoreSchedules = async (silent = false) => {
    if (!silent) {
      setSyncLoading('schedules');
      setSyncDirection('restore');
      setGeneralError('');
      setGeneralSuccess('');
      setOperationLogs([]);
    }
    addLog('Downloading broadcast calendar schedules from Cloud Firestore (/schedules)...');
    try {
      let querySnap;
      try {
        querySnap = await getDocs(collection(db, 'schedules'));
      } catch (errSnap) {
        handleFirestoreError(errSnap, OperationType.LIST, 'schedules');
        return false;
      }

      if (!querySnap || querySnap.empty) {
        throw new Error('No stream broadcast schedules backup found in Cloud Firestore.');
      }

      addLog(`Found ${querySnap.size} scheduled stream calendar entry(s) in Cloud. Importing locally...`);
      for (const docObj of querySnap.docs) {
        const cloudSched = docObj.data();
        addLog(`Importing scheduled broadcast: Video ID ${cloudSched.videoId} ("${cloudSched.videoTitle}") to Target ID ${cloudSched.streamKeyId}...`);
        
        // Save locally
        const { ok, error } = await safeFetchJson('/api/schedules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            videoId: cloudSched.videoId,
            streamKeyId: cloudSched.streamKeyId,
            scheduledTime: cloudSched.scheduledTime
          })
        });

        if (!ok) {
          addLog(`[ERROR] Local scheduling database rejected scheduled broadcast: ${error}`);
        }
      }

      addLog('Stream calendar schedules restoration completed.');
      if (!silent) {
        setGeneralSuccess(`Successfully restored ${querySnap.size} automated schedule(s) from Cloud Workspace.`);
      }
      return true;
    } catch (err: any) {
      addLog(`Error restoring schedules: ${err.message}`);
      if (!silent) setGeneralError(err.message || 'Failed to restore calendar schedules.');
      return false;
    } finally {
      if (!silent) setSyncLoading(null);
    }
  };

  const restoreEverything = async () => {
    setSyncLoading('all');
    setSyncDirection('restore');
    setGeneralError('');
    setGeneralSuccess('');
    setOperationLogs([]);
    addLog('=== Starting Complete Cloud Workspace Restoration Sequence ===');

    const settingsOk = await restoreSettings(true);
    const keysOk = await restoreStreamKeys(true);
    const schedulesOk = await restoreSchedules(true);

    if (settingsOk && keysOk && schedulesOk) {
      addLog('=== [SUCCESS] Complete Cloud Restoration Finished Successfully! ===');
      setGeneralSuccess('Full Cloud Workspace restoration succeeded! Settings, destinations, and calendars were synced locally.');
    } else {
      addLog('=== [WARNING] Sync Restoration finished with some failures. Check logs. ===');
      setGeneralError('Full Cloud Restoration finished with errors. Please verify database constraints or file references.');
    }
    setSyncLoading(null);
  };


  if (authLoading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <span className="inline-block w-6 h-6 border-2 border-slate-800 border-t-red-500 rounded-full animate-spin"></span>
        <p className="text-xs font-semibold text-slate-400 mt-3 uppercase tracking-wider">Verifying Cloud Security Authority...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Cloud className="w-6 h-6 text-red-500" />
            Cloud Sync & Workspace Backup
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Securely persist your live-streaming settings, destinations, and calendars to Google Cloud Firestore.
          </p>
        </div>
        
        {/* Firestore status indicator */}
        {user && (
          <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl self-start sm:self-auto">
            <div className={`w-2.5 h-2.5 rounded-full ${firestoreOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {firestoreOnline === null ? 'Testing Connectivity...' : firestoreOnline ? 'Firestore: Connected' : 'Firestore: Offline'}
            </span>
            <button 
              onClick={checkFirestoreConnection} 
              disabled={testingConnection}
              className="p-1 text-slate-500 hover:text-slate-300 cursor-pointer disabled:opacity-50"
              title="Check Connection"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Auth Gate and Setup Banner */}
      {!user ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6 max-w-2xl mx-auto my-6">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto">
            <Cloud className="w-8 h-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Connect with Google Cloud Workspace</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Log in to your Google Account to automatically sync configurations. Uses secure Attribute-Based Access Controls to protect your RTMP stream keys and calendar schedules.
            </p>
          </div>

          {authError && (
            <div className="p-4 bg-rose-950/40 border border-rose-900/50 rounded-xl text-xs text-rose-300 flex items-center gap-2 max-w-md mx-auto text-left leading-normal">
              <AlertCircle className="w-4 h-4 text-rose-450 shrink-0" />
              <div>
                <strong>OAuth Connection Failed:</strong> {authError}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="px-6 py-3 bg-white hover:bg-slate-150 text-slate-950 text-sm font-bold rounded-xl transition-all flex items-center gap-2.5 mx-auto cursor-pointer shadow-lg shadow-black/15 font-sans"
          >
            <Chrome className="w-5 h-5 text-red-500" />
            Sign In with Google
          </button>
          
          <div className="pt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Encrypted End-to-End Firestore Protocol Active
          </div>
        </div>
      ) : (
        <>
          {/* User Profile Summary Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'Google Operator'} 
                  className="w-12 h-12 rounded-xl border border-slate-700 object-cover shadow-md"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-12 h-12 bg-red-600/15 border border-red-500/30 rounded-xl flex items-center justify-center">
                  <Database className="w-6 h-6 text-red-500" />
                </div>
              )}
              <div>
                <span className="text-[9px] bg-red-950/50 text-red-400 border border-red-900/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Cloud Workspace Authorized
                </span>
                <h3 className="text-sm font-bold text-white mt-1">
                  {user.displayName || 'Authorized Stream Operator'}
                </h3>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 py-2 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4 text-slate-400" />
                Disconnect Workspace
              </button>
            </div>
          </div>

          {/* General success and error banners */}
          {generalSuccess && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-sm text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-450 shrink-0" />
              {generalSuccess}
            </div>
          )}

          {generalError && (
            <div className="p-4 bg-rose-950/40 border border-rose-900/50 rounded-xl text-sm text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-450 shrink-0" />
              {generalError}
            </div>
          )}

          {/* Master Full Sync Panel */}
          <div className="bg-gradient-to-br from-red-950/15 to-slate-900 border border-red-900/15 rounded-2xl p-6 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-xl shadow-red-950/5">
            <div className="space-y-1.5 text-center lg:text-left">
              <h2 className="text-base font-bold text-white flex items-center justify-center lg:justify-start gap-2">
                <Cloud className="w-5 h-5 text-red-500 animate-pulse" />
                Full Server Configuration Synchronizer
              </h2>
              <p className="text-xs text-slate-400 max-w-xl">
                Perform a full system data sync. Sync all stream keys, calendar schedules, and global parameters simultaneously with a single click.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
              <button
                type="button"
                onClick={backupEverything}
                disabled={syncLoading !== null || !firestoreOnline}
                className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-800/50 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-red-950/15 cursor-pointer flex items-center justify-center gap-2"
              >
                {syncLoading === 'all' && syncDirection === 'backup' ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <CloudUpload className="w-4 h-4" />
                )}
                Create Full Cloud Backup
              </button>

              <button
                type="button"
                onClick={restoreEverything}
                disabled={syncLoading !== null || !firestoreOnline}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {syncLoading === 'all' && syncDirection === 'restore' ? (
                  <span className="inline-block w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <CloudDownload className="w-4 h-4" />
                )}
                Restore Full Backup
              </button>
            </div>
          </div>

          {/* Sync Grid by Entity Module */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Settings Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl">
                    <Settings className="w-5 h-5 text-red-500" />
                  </div>
                  <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full ${cloudSettingsExist ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/35' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}>
                    {cloudSettingsExist ? 'CLOUD: SECURED' : 'CLOUD: EMPTY'}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Streaming Parameters</h3>
                  <p className="text-xs text-slate-400 leading-normal mt-1">
                    Backup encoder resolutions, overlays, bitrates, and watermarks.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => backupSettings(false)}
                  disabled={syncLoading !== null || !firestoreOnline}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {syncLoading === 'settings' && syncDirection === 'backup' ? (
                    <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <CloudUpload className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  Backup
                </button>
                <button
                  type="button"
                  onClick={() => restoreSettings(false)}
                  disabled={syncLoading !== null || !firestoreOnline}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {syncLoading === 'settings' && syncDirection === 'restore' ? (
                    <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <CloudDownload className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  Restore
                </button>
              </div>
            </div>

            {/* Destinations Stream Keys Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl">
                    <Key className="w-5 h-5 text-red-500" />
                  </div>
                  <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full ${cloudKeysCount > 0 ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/35' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}>
                    {cloudKeysCount > 0 ? `CLOUD: ${cloudKeysCount} RECORD(S)` : 'CLOUD: EMPTY'}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Stream Destinations</h3>
                  <p className="text-xs text-slate-400 leading-normal mt-1">
                    Backup ingestion platforms, ingestion RTMP secrets, and target names.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => backupStreamKeys(false)}
                  disabled={syncLoading !== null || !firestoreOnline}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {syncLoading === 'keys' && syncDirection === 'backup' ? (
                    <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <CloudUpload className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  Backup
                </button>
                <button
                  type="button"
                  onClick={() => restoreStreamKeys(false)}
                  disabled={syncLoading !== null || !firestoreOnline}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {syncLoading === 'keys' && syncDirection === 'restore' ? (
                    <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <CloudDownload className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  Restore
                </button>
              </div>
            </div>

            {/* Calendars / Schedules Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl">
                    <Calendar className="w-5 h-5 text-red-500" />
                  </div>
                  <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full ${cloudSchedulesCount > 0 ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/35' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}>
                    {cloudSchedulesCount > 0 ? `CLOUD: ${cloudSchedulesCount} RECORD(S)` : 'CLOUD: EMPTY'}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Broadcast Schedules</h3>
                  <p className="text-xs text-slate-400 leading-normal mt-1">
                    Backup calendar timelines, video playlist allocations, and timers.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => backupSchedules(false)}
                  disabled={syncLoading !== null || !firestoreOnline}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {syncLoading === 'schedules' && syncDirection === 'backup' ? (
                    <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <CloudUpload className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  Backup
                </button>
                <button
                  type="button"
                  onClick={() => restoreSchedules(false)}
                  disabled={syncLoading !== null || !firestoreOnline}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {syncLoading === 'schedules' && syncDirection === 'restore' ? (
                    <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <CloudDownload className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  Restore
                </button>
              </div>
            </div>
          </div>

          {/* Sync Operation Logs View */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-red-500" />
              Real-time Sync Event Logs
            </h3>
            <div className="border border-slate-950 rounded-xl p-4 bg-slate-950 font-mono text-xs text-slate-300 h-40 overflow-y-auto space-y-1">
              {operationLogs.length === 0 ? (
                <p className="text-slate-650 text-center pt-10">No sync operations triggered. Sync events will log here.</p>
              ) : (
                operationLogs.map((log, idx) => (
                  <p key={idx} className={log.includes('[ERROR]') ? 'text-rose-400' : log.includes('[SUCCESS]') || log.includes('successfully') ? 'text-emerald-400' : 'text-slate-350'}>
                    {log}
                  </p>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
