import React, { useEffect, useState } from 'react';
import { Play, Square, Activity, Cpu, HardDrive, RefreshCw, Layers, Terminal, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { SystemStats, StreamLog } from '../types';
import { safeFetchJson } from '../utils';

interface DashboardProps {
  token: string;
}

export default function Dashboard({ token }: DashboardProps) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [logs, setLogs] = useState<StreamLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsResult, logsResult] = await Promise.all([
          safeFetchJson<SystemStats>('/api/stats', { headers: { Authorization: `Bearer ${token}` } }),
          safeFetchJson<StreamLog[]>('/api/logs', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (statsResult.ok && statsResult.data) {
          setStats(statsResult.data);
        }
        if (logsResult.ok && logsResult.data) {
          setLogs(logsResult.data);
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
    try {
      const { data, error: fetchErr } = await safeFetchJson('/api/stream/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fetchErr) {
        alert(fetchErr || 'Failed to start streaming');
      }
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      alert('Network error initiating stream');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!confirm('Are you sure you want to STOP the live broadcast? This will disconnect all channels.')) {
      return;
    }
    setActionLoading(true);
    try {
      await safeFetchJson('/api/stream/stop', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      alert('Network error stopping stream');
    } finally {
      setActionLoading(false);
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
                disabled={actionLoading}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 disabled:bg-red-800/40 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-950/10 cursor-pointer text-base"
              >
                <Play className="w-5 h-5 fill-white" />
                Start Live Broadcast
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={actionLoading}
                className="flex-1 py-3.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:bg-slate-900/50 text-rose-500 font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
              >
                <Square className="w-5 h-5 fill-rose-500" />
                Stop Live Broadcast
              </button>
            )}
          </div>
        </div>

        {/* Channels Monitor */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-4 pb-4 border-b border-slate-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-red-500" />
              Dynamic Outputs
            </h2>

            {stats?.connectedOutputs && stats.connectedOutputs.length > 0 ? (
              <div className="space-y-4">
                {stats.connectedOutputs.map((outputId) => (
                  <div key={outputId} className="p-3.5 bg-slate-950 border border-slate-800/60 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Channel Key #{outputId}</p>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">Status: Pipe connected</p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-sm">
                No active RTMP processes running.
              </div>
            )}
          </div>

          <div className="text-xs text-slate-400 p-3 bg-slate-950 border border-slate-800/40 rounded-xl mt-4">
            <p className="font-semibold text-white mb-1">Auto Reconnect System</p>
            When started, any socket or pipe errors will be caught instantly and reconnected within 5 seconds automatically.
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
    </div>
  );
}
