import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Clock, CheckCircle2, AlertTriangle, PlayCircle, Loader } from 'lucide-react';
import { Schedule, VideoFile, StreamKey } from '../types';
import { safeFetchJson } from '../utils';
import ConfirmationModal from './ConfirmationModal';

interface ScheduleProps {
  token: string;
  isApproved?: boolean;
}

export default function ScheduleManager({ token, isApproved = true }: ScheduleProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [keys, setKeys] = useState<StreamKey[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [selectedVideo, setSelectedVideo] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [schedResult, videosResult, keysResult] = await Promise.all([
        safeFetchJson<Schedule[]>('/api/schedules', { headers: { Authorization: `Bearer ${token}` } }),
        safeFetchJson<VideoFile[]>('/api/playlist', { headers: { Authorization: `Bearer ${token}` } }),
        safeFetchJson<StreamKey[]>('/api/stream-keys', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (schedResult.ok && schedResult.data && Array.isArray(schedResult.data)) {
        setSchedules(schedResult.data);
      } else {
        setSchedules([]);
      }

      if (videosResult.ok && videosResult.data && Array.isArray(videosResult.data)) {
        setVideos(videosResult.data);
        if (videosResult.data.length > 0) setSelectedVideo(videosResult.data[0].id.toString());
      } else {
        setVideos([]);
      }

      if (keysResult.ok && keysResult.data && Array.isArray(keysResult.data)) {
        setKeys(keysResult.data);
        if (keysResult.data.length > 0) setSelectedKey(keysResult.data[0].id.toString());
      } else {
        setKeys([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideo || !selectedKey || !dateTime) {
      setError('Please fill in all fields to register a schedule');
      return;
    }

    setError('');
    setSuccess('');

    try {
      const { data, error: fetchErr } = await safeFetchJson('/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          videoId: parseInt(selectedVideo),
          streamKeyId: parseInt(selectedKey),
          scheduledTime: new Date(dateTime).toISOString()
        })
      });

      if (fetchErr) {
        throw new Error(fetchErr || 'Failed to create schedule');
      }

      setSuccess('Scheduled broadcast registered successfully');
      setDateTime('');
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Error scheduling broadcast');
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (deleteTargetId === null) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);

    try {
      const { error: fetchErr } = await safeFetchJson(`/api/schedules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!fetchErr) {
        setSuccess('Schedule cancelled successfully');
        await fetchData();
      } else {
        setError(fetchErr || 'Failed to cancel schedule');
      }
    } catch (err) {
      setError('Network error cancelling schedule');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        );
      case 'running':
        return (
          <span className="flex items-center gap-1.5 text-[10px] text-red-400 font-semibold bg-red-950/40 border border-red-900/30 px-2 py-0.5 rounded-full animate-pulse">
            <Loader className="w-3.5 h-3.5 animate-spin" /> Live Now
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-[10px] text-rose-400 font-semibold bg-rose-950/40 border border-rose-900/30 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold bg-amber-950/40 border border-amber-900/30 px-2 py-0.5 rounded-full">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Calendar className="w-6 h-6 text-red-500" />
          Scheduled Live Broadcasts
        </h1>
        <span className="text-xs text-slate-400 font-medium">
          {schedules.length} Schedules Registered
        </span>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-sm text-emerald-300">
          {success}
        </div>
      )}

      {/* Scheduler Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2 pb-3 border-b border-slate-800">
          <Plus className="w-5 h-5 text-red-500" />
          Create Scheduled Stream
        </h2>

        {videos.length === 0 || keys.length === 0 ? (
          <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl text-sm text-slate-400 text-center leading-relaxed">
            You must have at least one <span className="text-white font-semibold">video uploaded</span> and one <span className="text-white font-semibold">stream destination configured</span> to schedule future broadcasts.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Select Video
              </label>
              <select
                value={selectedVideo}
                onChange={(e) => setSelectedVideo(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 transition-colors cursor-pointer"
              >
                {videos.map(v => (
                  <option key={v.id} value={v.id}>{v.originalname}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Select Stream Destination
              </label>
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 transition-colors cursor-pointer"
              >
                {keys.map(k => (
                  <option key={k.id} value={k.id}>{k.name} ({k.platform})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Schedule Time (Local)
              </label>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 transition-colors cursor-pointer font-mono"
                required
              />
            </div>

            <div className="md:col-span-3 flex justify-end pt-3 border-t border-slate-800/60">
              <button
                type="submit"
                disabled={!isApproved}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-800/40 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/20"
              >
                <Calendar className="w-4 h-4" />
                Schedule Broadcast Launch
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Schedules List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-300">Registered Schedules</h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <span className="inline-block w-6 h-6 border-2 border-slate-800 border-t-red-500 rounded-full animate-spin"></span>
          </div>
        ) : schedules.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
            <Calendar className="w-10 h-10 text-slate-700 mb-2 animate-pulse" />
            <p className="font-semibold text-slate-400">No schedules registered</p>
            <p className="text-xs text-slate-600 mt-1 max-w-xs">
              Schedules will start and stop live streaming at your desired target timestamps automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {schedules.map((sched) => (
              <div key={sched.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-950/30 transition-colors">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <h4 className="text-sm font-bold text-white truncate max-w-sm">{sched.videoTitle}</h4>
                    {getStatusBadge(sched.status)}
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 font-mono text-xs text-slate-500">
                    <p>
                      <span className="text-slate-600">Target Key:</span> {sched.streamKeyName}
                    </p>
                    <p className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {new Date(sched.scheduledTime).toLocaleString()}
                    </p>
                  </div>
                </div>

                {sched.status === 'pending' && (
                  <div className="shrink-0 flex justify-end">
                    <button
                      onClick={() => handleDelete(sched.id)}
                      disabled={!isApproved}
                      className="p-2 border border-slate-800 hover:border-rose-950 hover:bg-rose-950/20 disabled:opacity-40 disabled:cursor-not-allowed text-slate-400 hover:text-rose-400 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                      title={!isApproved ? 'Action Denied' : 'Cancel Schedule'}
                    >
                      <Trash2 className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={deleteTargetId !== null}
        title="Cancel Scheduled Stream"
        message="Are you sure you want to cancel this scheduled live stream?"
        confirmText="Cancel Stream"
        isDestructive={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
