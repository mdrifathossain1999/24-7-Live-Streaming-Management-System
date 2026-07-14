import React, { useEffect, useState } from 'react';
import { Play, Square, Activity, Cpu, HardDrive, RefreshCw, Layers, Terminal, AlertTriangle, CheckCircle, Info, Globe, ToggleLeft, ToggleRight, CheckSquare, Square as SquareIcon } from 'lucide-react';
import { SystemStats, StreamLog, StreamKey } from '../types';
import { safeFetchJson } from '../utils';
import ConfirmationModal from './ConfirmationModal';

interface DashboardProps {
  token: string;
  isApproved?: boolean;
}

export default function Dashboard({ token, isApproved = true }: DashboardProps) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [logs, setLogs] = useState<StreamLog[]>([]);
  const [keys, setKeys] = useState<StreamKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsResult, logsResult, keysResult] = await Promise.all([
          safeFetchJson<SystemStats>('/api/stats', { headers: { Authorization: `Bearer ${token}` } }),
          safeFetchJson<StreamLog[]>('/api/logs', { headers: { Authorization: `Bearer ${token}` } }),
          safeFetchJson<StreamKey[]>('/api/stream-keys', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (statsResult.ok && statsResult.data) {
          setStats(statsResult.data);
        }
        if (logsResult.ok && logsResult.data && Array.isArray(logsResult.data)) {
          setLogs(logsResult.data);
        } else {
          setLogs([]);
        }
        if (keysResult.ok && keysResult.data && Array.isArray(keysResult.data)) {
          setKeys(keysResult.data);
        } else {
          setKeys([]);
        }
      } catch (err) {
        console.error('Failed to poll dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [token, refreshKey]);

  const handleStart = async () => {
    setActionLoading(true);
    setError('');
    try {
      const { data, error: fetchErr } = await safeFetchJson('/api/stream/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fetchErr) {
        setError(fetchErr || 'Failed to start streaming');
      }
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      setError('Network error initiating stream');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setShowStopConfirm(true);
  };

  const confirmStop = async () => {
    setShowStopConfirm(false);
    setActionLoading(true);
    setError('');
    try {
      const { error: fetchErr } = await safeFetchJson('/api/stream/stop', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fetchErr) {
        setError(fetchErr || 'Failed to stop streaming');
      }
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      setError('Network error stopping stream');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkStatusChange = async (enabled: boolean) => {
    if (keys.length === 0) return;
    setBulkLoading(true);
    setError('');
    const ids = keys.map((k) => k.id);
    try {
      const { error: fetchErr } = await safeFetchJson('/api/stream-keys/bulk/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids, enabled }),
      });
      if (fetchErr) {
        setError(fetchErr);
      } else {
        setKeys((prev) =>
          prev.map((k) => ({ ...k, enabled: enabled ? 1 : 0 }))
        );
      }
    } catch (err) {
      setError('Network error during bulk operation');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleToggleSingleKey = async (key: StreamKey) => {
    setError('');
    const nextEnabled = key.enabled === 1 ? 0 : 1;
    try {
      const { error: fetchErr } = await safeFetchJson(`/api/stream-keys/${key.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          platform: key.platform,
          name: key.name,
          rtmpUrl: key.rtmpUrl,
          streamKey: key.streamKey,
          enabled: nextEnabled,
        }),
      });
      if (fetchErr) {
        setError(fetchErr);
      } else {
        setKeys((prev) =>
          prev.map((k) => (k.id === key.id ? { ...k, enabled: nextEnabled } : k))
        );
      }
    } catch (err) {
      setError('Network error toggling target destination');
    }
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />;
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-emerald-300';
      case 'error':
        return 'text-rose-300';
      case 'warn':
        return 'text-amber-300';
      default:
        return 'text-slate-300';
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="inline-block w-8 h-8 border-4 border-slate-800 border-t-red-500 rounded-full animate-spin"></span>
      </div>
    );
  }

  const isStreaming = stats?.isStreaming || false;
  const cpuPercent = stats?.cpu || 0;
  const memoryUsed = stats?.memoryUsed || 0;
  const memoryTotal = stats?.memoryTotal || 1;
  const memoryPercent = Math.round((memoryUsed / memoryTotal) * 100);

  // Active video percentage
  const videoDuration = stats?.activeVideoDuration || 1;
  const videoElapsed = stats?.activeVideoElapsed || 0;
  const videoPercent = Math.min(100, Math.round((videoElapsed / videoDuration) * 100));

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-white font-bold ml-4 cursor-pointer">✕</button>
        </div>
      )}

      {/* Top Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Status Card */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Broadcast Status</h3>
            <div className={`w-3 h-3 rounded-full ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`}></div>
          </div>
          <p className="text-2xl font-bold text-white mb-1">
            {isStreaming ? 'BROADCASTING' : 'IDLE'}
          </p>
          <p className="text-xs text-slate-500">
            {isStreaming ? 'Stream lines online' : 'System standby'}
          </p>
          {isStreaming && (
            <div className="absolute right-3 bottom-3 text-red-500/10">
              <Activity className="w-16 h-16" />
            </div>
          )}
        </div>

        {/* CPU Monitor */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">CPU Utilization</h3>
            <Cpu className="w-5 h-5 text-sky-400" />
          </div>
          <p className="text-2xl font-bold text-white mb-2">{cpuPercent}%</p>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                cpuPercent > 80 ? 'bg-red-500' : cpuPercent > 50 ? 'bg-amber-500' : 'bg-sky-500'
              }`}
              style={{ width: `${cpuPercent}%` }}
            ></div>
          </div>
        </div>

        {/* RAM Monitor */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Memory Allocation</h3>
            <HardDrive className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white mb-2">{memoryPercent}%</p>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
              style={{ width: `${memoryPercent}%` }}
            ></div>
          </div>
          <p className="text-xs text-slate-500 font-mono">
            {memoryUsed} MB / {memoryTotal} MB
          </p>
        </div>

        {/* Active Outputs / Uptime */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Server Uptime</h3>
            <Layers className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white mb-1">
            {stats ? formatUptime(stats.uptime) : '0h 0m 0s'}
          </p>
          <p className="text-xs text-slate-500">
            {stats?.connectedOutputs ? `${stats.connectedOutputs.length} connected streams` : '0 channels active'}
          </p>
        </div>
      </div>

      {/* Primary Video Stream Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stream controller and details */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${isStreaming ? 'bg-red-500 animate-ping' : 'bg-slate-700'}`}></span>
                <h2 className="text-lg font-bold text-white">Continuous Broadcast Deck</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRefreshKey((prev) => prev + 1)}
                  className="p-2 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Force Refresh Status"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* If streaming is active, show video info */}
            {isStreaming && stats?.activeVideo ? (
              <div className="space-y-6 mb-8">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider bg-red-950 text-red-400 px-2.5 py-1 rounded-md">
                    NOW PLAYING LOOP
                  </span>
                  <h4 className="text-xl font-bold text-white mt-3 line-clamp-1">
                    {stats.activeVideo}
                  </h4>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>{formatDuration(videoElapsed)} elapsed</span>
                    <span>{formatDuration(videoDuration)} total</span>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-600 rounded-full transition-all duration-1000"
                      style={{ width: `${videoPercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-44 bg-slate-950 border border-slate-800/50 rounded-xl flex flex-col items-center justify-center text-slate-500 mb-8 p-6 text-center">
                <AlertTriangle className="w-8 h-8 text-slate-600 mb-2 animate-bounce" />
                <p className="font-medium text-slate-400">Stream Broadcast is offline</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Active RTMP pipes are inactive. Click 'Start Stream' to deploy active keys and play the video playlist.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {!isStreaming ? (
              <button
                onClick={handleStart}
                disabled={actionLoading || !isApproved}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 disabled:bg-red-850/30 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-950/10 cursor-pointer text-base"
              >
                <Play className="w-5 h-5 fill-white" />
                Start Live Broadcast
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={actionLoading || !isApproved}
                className="flex-1 py-3.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-rose-500 font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
              >
                <Square className="w-5 h-5 fill-rose-500" />
                Stop Live Broadcast
              </button>
            )}
          </div>
        </div>

        {/* Bulk Broadcast Target Deck */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-red-500" />
                Broadcast Deck Targets
              </h2>
              <span className="text-xs bg-slate-800 text-slate-300 font-semibold px-2 py-0.5 rounded-full font-mono">
                {keys.filter(k => k.enabled === 1).length}/{keys.length} Active
              </span>
            </div>

            {/* Bulk Actions Bar */}
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <button
                onClick={() => handleBulkStatusChange(true)}
                disabled={bulkLoading || keys.length === 0 || !isApproved}
                className="py-2.5 px-3 bg-red-600/15 hover:bg-red-600/25 disabled:opacity-40 disabled:cursor-not-allowed text-red-400 hover:text-red-300 font-semibold text-xs rounded-xl border border-red-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckSquare className="w-4 h-4" />
                Enable All
              </button>
              <button
                onClick={() => handleBulkStatusChange(false)}
                disabled={bulkLoading || keys.length === 0 || !isApproved}
                className="py-2.5 px-3 bg-slate-950 hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed text-slate-400 hover:text-white font-semibold text-xs rounded-xl border border-slate-850 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <SquareIcon className="w-4 h-4" />
                Disable All
              </button>
            </div>

            {/* Targets list */}
            {keys.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-850">
                {keys.map((key) => {
                  const isCurrentlyActive = stats?.connectedOutputs?.includes(key.id) && isStreaming;
                  const isEnabled = key.enabled === 1;

                  return (
                    <div
                      key={key.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        isCurrentlyActive
                          ? 'bg-red-950/20 border-red-900/40 shadow-sm'
                          : isEnabled
                          ? 'bg-slate-950 border-slate-800/85'
                          : 'bg-slate-950/40 border-slate-900/60 opacity-60'
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <button
                          onClick={() => isApproved && handleToggleSingleKey(key)}
                          disabled={!isApproved}
                          className={`text-slate-500 hover:text-white transition-colors shrink-0 ${!isApproved ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                          title={!isApproved ? 'Action Denied: Pending Approval' : (isEnabled ? 'Deactivate destination' : 'Activate destination')}
                        >
                          {isEnabled ? (
                            <ToggleRight className="w-7 h-7 text-red-500" />
                          ) : (
                            <ToggleLeft className="w-7 h-7 text-slate-600" />
                          )}
                        </button>
                        
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white truncate">{key.name}</p>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                              key.platform === 'youtube'
                                ? 'bg-red-950 text-red-400 border border-red-900/30'
                                : key.platform === 'facebook'
                                ? 'bg-blue-950 text-blue-400 border border-blue-900/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700/30'
                            }`}>
                              {key.platform}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5 font-mono max-w-[160px]">
                            {key.rtmpUrl}
                          </p>
                        </div>
                      </div>

                      {/* Connection status dot/badge */}
                      <div className="flex items-center shrink-0 ml-2">
                        {isCurrentlyActive ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-950/50 border border-emerald-900/30 rounded-lg text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live
                          </div>
                        ) : isEnabled ? (
                          <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider px-2 py-1 bg-amber-950/30 border border-amber-900/30 rounded-lg">
                            Ready
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-2 py-1 bg-slate-900/30 border border-slate-800/30 rounded-lg">
                            Idle
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
                <Globe className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                No destinations configured yet.
                <p className="text-xs text-slate-600 mt-1">Please add target servers in Stream Targets tab.</p>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500 p-3 bg-slate-950 border border-slate-800/40 rounded-xl mt-4">
            <p className="font-semibold text-slate-400 mb-1 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-red-500" />
              Dynamic Live Tuning
            </p>
            Toggling destinations above while broadcasting is active will immediately connect or disconnect the output RTMP stream without restarting.
          </div>
        </div>
      </div>

      {/* Stream Logs Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-slate-400" />
          Live Log Console
        </h2>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-64 overflow-y-auto font-mono text-xs space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800">
          {logs.length > 0 ? (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 text-slate-300">
                {getLogIcon(log.type)}
                <span className="text-slate-500 select-none shrink-0">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span className={`leading-relaxed ${getLogColor(log.type)}`}>
                  {log.message}
                </span>
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-slate-600 select-none">
              Console logs are currently empty. Broadcast logs will stream here.
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showStopConfirm}
        title="Stop Broadcast"
        message="Are you sure you want to STOP the live broadcast? This will disconnect all channels."
        confirmText="Stop Broadcast"
        isDestructive={true}
        onConfirm={confirmStop}
        onCancel={() => setShowStopConfirm(false)}
      />
    </div>
  );
}
