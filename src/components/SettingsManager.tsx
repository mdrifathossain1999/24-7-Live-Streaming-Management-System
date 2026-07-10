import React, { useState, useEffect } from 'react';
import { Settings, Shield, Sliders, Type, Image, Save, Lock, Trash2, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { StreamSettings } from '../types';
import { safeFetchJson } from '../utils';

interface SettingsProps {
  token: string;
}

export default function SettingsManager({ token }: SettingsProps) {
  const [settings, setSettings] = useState<StreamSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Status indicators
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  // Form states - Settings
  const [loopPlaylist, setLoopPlaylist] = useState(true);
  const [logoPosition, setLogoPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-right');
  const [textOverlay, setTextOverlay] = useState('');
  const [textPosition, setTextPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-left');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(24);
  const [resolution, setResolution] = useState<'1080p' | '720p' | '480p'>('720p');
  const [videoBitrate, setVideoBitrate] = useState('2500k');
  const [audioBitrate, setAudioBitrate] = useState('128k');

  // Form states - Passwords
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchSettings = async () => {
    try {
      const { data, ok } = await safeFetchJson<StreamSettings>('/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (ok && data) {
        setSettings(data);
        
        // Initialize form fields
        setLoopPlaylist(data.loopPlaylist === 1);
        setLogoPosition(data.logoPosition);
        setTextOverlay(data.textOverlay || '');
        setTextPosition(data.textPosition);
        setTextColor(data.textColor);
        setTextSize(data.textSize);
        setResolution(data.resolution);
        setVideoBitrate(data.videoBitrate);
        setAudioBitrate(data.audioBitrate);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const { data, error: fetchErr } = await safeFetchJson<StreamSettings>('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          loopPlaylist,
          logoPosition,
          textOverlay: textOverlay.trim() || null,
          textPosition,
          textColor,
          textSize,
          resolution,
          videoBitrate,
          audioBitrate
        })
      });

      if (fetchErr || !data) throw new Error(fetchErr || 'Failed to save settings');

      setSuccess('Streaming profile updated successfully');
      setSettings(data);
    } catch (err: any) {
      setError(err.message || 'Error updating settings');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    setError('');
    setSuccess('');
    setLogoUploading(true);

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const { data, error: fetchErr } = await safeFetchJson<{ logoPath: string }>('/api/settings/logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (fetchErr || !data) throw new Error(fetchErr || 'Failed to upload logo overlay');

      setSuccess('Overlay logo uploaded successfully');
      setSettings(prev => prev ? { ...prev, logoPath: data.logoPath } : null);
    } catch (err: any) {
      setError(err.message || 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('Are you sure you want to remove the logo overlay?')) return;
    setError('');
    setSuccess('');

    try {
      const { error: fetchErr } = await safeFetchJson('/api/settings/logo', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!fetchErr) {
        setSuccess('Overlay logo removed');
        setSettings(prev => prev ? { ...prev, logoPath: null } : null);
      } else {
        setError(fetchErr || 'Failed to delete logo overlay');
      }
    } catch (err) {
      setError('Failed to delete logo overlay');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    try {
      const { error: fetchErr } = await safeFetchJson('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });

      if (fetchErr) throw new Error(fetchErr || 'Password update failed');

      setPasswordSuccess('Password changed successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Error updating password');
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <span className="inline-block w-6 h-6 border-2 border-slate-800 border-t-red-500 rounded-full animate-spin"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-red-500" />
          Settings Panel
        </h1>
        <span className="text-xs text-slate-400 font-medium">
          Manage system configurations
        </span>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-sm text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Settings forms */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            {/* Loop & Stream profile */}
            <div>
              <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                <Sliders className="w-4.5 h-4.5 text-red-500" />
                Continuous Stream Profile
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Target Resolution
                  </label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="1080p">1080p Full HD (1920x1080)</option>
                    <option value="720p">720p HD (1280x720)</option>
                    <option value="480p">480p SD (854x480)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Video Transcode Bitrate
                  </label>
                  <select
                    value={videoBitrate}
                    onChange={(e) => setVideoBitrate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="4000k">4000 kbps (High Quality)</option>
                    <option value="3000k">3000 kbps (Standard 1080p)</option>
                    <option value="2500k">2500 kbps (Standard 720p)</option>
                    <option value="1500k">1500 kbps (Economy)</option>
                    <option value="800k">800 kbps (Low Bandwidth)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Audio Encoding Bitrate
                  </label>
                  <select
                    value={audioBitrate}
                    onChange={(e) => setAudioBitrate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="192k">192 kbps (Hi-Fi)</option>
                    <option value="128k">128 kbps (Standard AAC)</option>
                    <option value="96k">96 kbps (Economy)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={loopPlaylist}
                      onChange={(e) => setLoopPlaylist(e.target.checked)}
                      className="w-4 h-4 rounded text-red-500 bg-slate-950 border-slate-800 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-300 block">Loop Playlist Assets</span>
                      <span className="text-xs text-slate-500">Automatically repeat from start when playlist ends</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Logo Overlay */}
            <div>
              <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                <Image className="w-4.5 h-4.5 text-red-500" />
                Logo Watermark Overlay
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {settings?.logoPath ? (
                      <div className="relative group w-16 h-16 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex items-center justify-center p-2">
                        <img
                          src={`/${settings.logoPath}`}
                          alt="Logo Overlay"
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-800 bg-slate-950/40 flex items-center justify-center text-slate-600 font-bold text-xs">
                        NO LOGO
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-semibold text-white">Logo File</p>
                      <p className="text-xs text-slate-500 mt-0.5">PNG formats with transparent backgrounds work best</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="logo-upload"
                      className="hidden"
                      accept="image/png, image/jpeg"
                      onChange={handleLogoUpload}
                    />
                    <label
                      htmlFor="logo-upload"
                      className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-350 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1"
                    >
                      {logoUploading ? 'Uploading...' : <><Upload className="w-3.5 h-3.5" /> Upload Image</>}
                    </label>

                    {settings?.logoPath && (
                      <button
                        type="button"
                        onClick={handleDeleteLogo}
                        className="px-3.5 py-1.5 border border-slate-800 hover:border-rose-950 hover:bg-rose-950/15 text-slate-400 hover:text-rose-400 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Logo Watermark Position
                  </label>
                  <select
                    value={logoPosition}
                    onChange={(e) => setLogoPosition(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="top-left">Top Left Corner</option>
                    <option value="top-right">Top Right Corner</option>
                    <option value="bottom-left">Bottom Left Corner</option>
                    <option value="bottom-right">Bottom Right Corner</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Text Overlay */}
            <div>
              <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                <Type className="w-4.5 h-4.5 text-red-500" />
                Text Banner Overlay
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Banner Content
                  </label>
                  <input
                    type="text"
                    value={textOverlay}
                    onChange={(e) => setTextOverlay(e.target.value)}
                    placeholder="Enter ticker, credit text or alert banners"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Text Banner Position
                  </label>
                  <select
                    value={textPosition}
                    onChange={(e) => setTextPosition(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="top-left">Top Left Corner</option>
                    <option value="top-right">Top Right Corner</option>
                    <option value="bottom-left">Bottom Left Corner</option>
                    <option value="bottom-right">Bottom Right Corner</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Font Color (Hex)
                    </label>
                    <div className="relative">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="absolute inset-y-1.5 left-2 w-7 h-7 bg-transparent border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-full pl-11 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Font Size (px)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={80}
                      value={textSize}
                      onChange={(e) => setTextSize(parseInt(e.target.value) || 24)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex justify-end pt-3 border-t border-slate-800/60">
              <button
                type="submit"
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl text-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/20"
              >
                <Save className="w-4 h-4" />
                Save Broadcast Profile
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Block */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit">
          <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2 pb-3 border-b border-slate-800">
            <Shield className="w-4.5 h-4.5 text-red-500" />
            Security Credentials
          </h2>

          {passwordError && (
            <div className="mb-4 p-3.5 bg-red-950/30 border border-red-900/40 rounded-xl text-xs text-red-400">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="mb-4 p-3.5 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-xs text-emerald-400">
              {passwordSuccess}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                New Secure Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Verify new password"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 font-mono"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white font-medium rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <Lock className="w-3.5 h-3.5" />
              Update Credentials
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
