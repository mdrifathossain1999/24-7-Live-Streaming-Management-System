import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Edit3, Eye, EyeOff, Save, CheckCircle2, Globe, Radio } from 'lucide-react';
import { StreamKey } from '../types';
import { safeFetchJson } from '../utils';

interface StreamKeysProps {
  token: string;
}

const defaultRtmps = {
  facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
  youtube: 'rtmp://a.rtmp.youtube.com/live2',
  custom: ''
};

export default function StreamKeysManager({ token }: StreamKeysProps) {
  const [keys, setKeys] = useState<StreamKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<'facebook' | 'youtube' | 'custom'>('facebook');
  const [rtmpUrl, setRtmpUrl] = useState(defaultRtmps.facebook);
  const [streamKey, setStreamKey] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Masking states
  const [revealMap, setRevealMap] = useState<Record<number, boolean>>({});

  const fetchKeys = async () => {
    try {
      const { data, ok } = await safeFetchJson<StreamKey[]>('/api/stream-keys', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (ok && data) {
        setKeys(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [token]);

  const handlePlatformChange = (val: 'facebook' | 'youtube' | 'custom') => {
    setPlatform(val);
    setRtmpUrl(defaultRtmps[val]);
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPlatform('facebook');
    setRtmpUrl(defaultRtmps.facebook);
    setStreamKey('');
    setEnabled(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !rtmpUrl || !streamKey) {
      setError('Please fill in all required fields');
      return;
    }

    setError('');
    setSuccess('');

    const payload = { platform, name, rtmpUrl, streamKey, enabled: enabled ? 1 : 0 };
    const method = editingId ? 'PUT' : 'POST';
    const endpoint = editingId ? `/api/stream-keys/${editingId}` : '/api/stream-keys';

    try {
      const { data, error: fetchErr } = await safeFetchJson(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (fetchErr) {
        throw new Error(fetchErr || 'Failed to save stream key');
      }

      setSuccess(editingId ? 'Stream key updated successfully' : 'New stream destination added');
      resetForm();
      await fetchKeys();
    } catch (err: any) {
      setError(err.message || 'Error saving stream key');
    }
  };

  const handleEdit = (key: StreamKey) => {
    setEditingId(key.id);
    setName(key.name);
    setPlatform(key.platform);
    setRtmpUrl(key.rtmpUrl);
    setStreamKey(key.streamKey);
    setEnabled(key.enabled === 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this stream key configuration?')) {
      return;
    }

    try {
      const { error: fetchErr } = await safeFetchJson(`/api/stream-keys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!fetchErr) {
        setSuccess('Stream key removed');
        await fetchKeys();
      } else {
        setError(fetchErr || 'Failed to delete stream key');
      }
    } catch (err) {
      setError('Network error deleting stream key');
    }
  };

  const handleToggleEnable = async (key: StreamKey) => {
    const nextEnabled = key.enabled === 1 ? 0 : 1;
    try {
      const { ok } = await safeFetchJson(`/api/stream-keys/${key.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...key, enabled: nextEnabled })
      });

      if (ok) {
        await fetchKeys();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleReveal = (id: number) => {
    setRevealMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Key className="w-6 h-6 text-red-500" />
          Stream Destinations
        </h1>
        <span className="text-xs text-slate-400 font-medium">
          {keys.length} RTMP Keys Configured
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

      {/* Editor & Add Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2 pb-3 border-b border-slate-800">
          <Plus className="w-5 h-5 text-red-500" />
          {editingId ? 'Edit RTMP Stream Config' : 'Add New RTMP Stream Destination'}
        </h2>

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Channel Name
              </label>
              <input
                type="text"
                placeholder="e.g., My Facebook Fanpage, Main YouTube"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Target Platform
              </label>
              <select
                value={platform}
                onChange={(e) => handlePlatformChange(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 transition-colors cursor-pointer"
              >
                <option value="facebook">Facebook Live (RTMPS)</option>
                <option value="youtube">YouTube Live (RTMP)</option>
                <option value="custom">Custom RTMP Stream Server</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                RTMP Server Endpoint URL
              </label>
              <input
                type="text"
                value={rtmpUrl}
                onChange={(e) => setRtmpUrl(e.target.value)}
                placeholder="rtmp:// or rtmps:// server url"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 transition-colors font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Stream Secret Key
              </label>
              <input
                type="text"
                value={streamKey}
                onChange={(e) => setStreamKey(e.target.value)}
                placeholder="Paste stream key here"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 transition-colors font-mono"
                required
              />
            </div>
          </div>

          <div className="md:col-span-2 flex items-center justify-between pt-3 border-t border-slate-800/60 mt-2">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-red-500 bg-slate-950 border-slate-800 focus:ring-0 cursor-pointer"
              />
              <span className="text-sm font-semibold text-slate-300">Enable destination immediately on start</span>
            </label>

            <div className="flex items-center gap-3">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl text-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/20"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'Update Configuration' : 'Save Destination'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Lists */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-300">Active Broadcasters</h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <span className="inline-block w-6 h-6 border-2 border-slate-800 border-t-red-500 rounded-full animate-spin"></span>
          </div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
            <Radio className="w-10 h-10 text-slate-700 mb-2 animate-pulse" />
            <p className="font-semibold text-slate-400">No stream keys registered</p>
            <p className="text-xs text-slate-600 mt-1 max-w-xs">
              Configure stream targets above to deliver your loop video schedule.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {keys.map((keyItem) => (
              <div key={keyItem.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-950/30 transition-colors">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <h4 className="text-sm font-bold text-white">{keyItem.name}</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                      {keyItem.platform}
                    </span>
                    {keyItem.enabled === 1 ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-950/30 border border-emerald-900/30 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" /> Enabled
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-semibold bg-slate-950 border border-slate-850 px-1.5 py-0.5 rounded">
                        Disabled
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 font-mono text-xs text-slate-500">
                    <p className="truncate max-w-xl">
                      <span className="text-slate-600">RTMP URL:</span> {keyItem.rtmpUrl}
                    </p>
                    <p className="flex items-center gap-2 truncate">
                      <span className="text-slate-600">Stream Key:</span>
                      <span>
                        {revealMap[keyItem.id]
                          ? keyItem.streamKey
                          : '••••••••••••••••••••••••••••••••'}
                      </span>
                      <button
                        onClick={() => toggleReveal(keyItem.id)}
                        className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {revealMap[keyItem.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 justify-end">
                  {/* Enabled Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={keyItem.enabled === 1}
                      onChange={() => handleToggleEnable(keyItem)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:bg-white peer-checked:after:border-white"></div>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(keyItem)}
                      className="p-2 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Edit Destination"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(keyItem.id)}
                      className="p-2 border border-slate-800 hover:border-rose-950 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                      title="Delete Destination"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
