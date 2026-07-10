import React, { useState, useEffect } from 'react';
import { Upload, Film, Trash2, ArrowUp, ArrowDown, Info, Play, FileVideo } from 'lucide-react';
import { VideoFile } from '../types';
import { safeFetchJson } from '../utils';
import ConfirmationModal from './ConfirmationModal';

interface PlaylistProps {
  token: string;
}

export default function PlaylistManager({ token }: PlaylistProps) {
  const [playlist, setPlaylist] = useState<VideoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const fetchPlaylist = async () => {
    try {
      const { data, ok } = await safeFetchJson<VideoFile[]>('/api/playlist', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (ok && data) {
        setPlaylist(data);
      }
    } catch (err) {
      console.error('Failed to fetch playlist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylist();
  }, [token]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    setError('');
    setSuccess('');

    // Check file format
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['mp4', 'mkv', 'mov', 'avi'].includes(ext || '')) {
      setError('Invalid format. Please upload standard video formats (.mp4, .mkv, .mov, .avi).');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('Preparing upload...');

    try {
      const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

      let completedSuccessfully = false;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        setUploadStatus(`Uploading part ${i + 1} of ${totalChunks}...`);
        
        const formData = new FormData();
        formData.append('chunk', chunk, `${file.name}.part_${i}`);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('originalName', file.name);

        const { data, error: fetchErr } = await safeFetchJson<any>('/api/playlist/upload-chunk', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });

        if (fetchErr) {
          throw new Error(fetchErr);
        }

        const percent = Math.round(((i + 1) / totalChunks) * 100);
        setUploadProgress(percent);

        if (data && data.complete) {
          completedSuccessfully = true;
        }
      }

      if (completedSuccessfully) {
        setSuccess(`Uploaded successfully: "${file.name}"`);
        await fetchPlaylist();
      } else {
        throw new Error('Upload completed, but server did not confirm merge');
      }
    } catch (err: any) {
      setError(err.message || 'Error uploading file');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      setUploadStatus('');
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
      const { error: fetchErr } = await safeFetchJson(`/api/playlist/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!fetchErr) {
        setSuccess('Video deleted from playlist');
        await fetchPlaylist();
      } else {
        setError(fetchErr || 'Failed to delete video');
      }
    } catch (err) {
      setError('Network error deleting video');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const updated = [...playlist];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= playlist.length) return;

    // Swap items
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Build ordered list of IDs
    const orderedIds = updated.map(v => v.id);

    try {
      const { error: fetchErr } = await safeFetchJson('/api/playlist/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderedIds })
      });

      if (!fetchErr) {
        setPlaylist(updated);
      } else {
        setError(fetchErr || 'Failed to save reordered playlist');
      }
    } catch (err) {
      setError('Network error updating playlist order');
    }
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Film className="w-6 h-6 text-red-500" />
          Broadcast Video Playlist
        </h1>
        <span className="text-xs text-slate-400 font-medium">
          {playlist.length} Loop Assets
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

      {/* Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          dragActive
            ? 'border-red-500 bg-red-500/5'
            : 'border-slate-800 bg-slate-900 hover:border-slate-700'
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="video-upload"
          className="hidden"
          accept="video/*"
          onChange={handleFileChange}
        />
        <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400">
            {uploading ? (
              <span className="inline-block w-6 h-6 border-2 border-slate-700 border-t-red-500 rounded-full animate-spin"></span>
            ) : (
              <Upload className="w-6 h-6 text-red-500" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {uploading ? (uploadStatus || 'Processing & reading metadata...') : 'Upload MP4 Loop Videos'}
            </p>
            {uploading && uploadProgress !== null ? (
              <div className="w-full max-w-xs mx-auto mt-3">
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="bg-red-500 h-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5 font-medium">{uploadProgress}% uploaded</p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-1">
                Drag & drop your files here, or <span className="text-red-500 font-medium">browse local files</span>
              </p>
            )}
          </div>
        </label>
      </div>

      {/* Playlist Grid / List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-300">Continuous Loop Order</h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="w-4 h-4" />
            <span>Playlist automatically loops indefinitely.</span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <span className="inline-block w-6 h-6 border-2 border-slate-800 border-t-red-500 rounded-full animate-spin"></span>
          </div>
        ) : playlist.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
            <FileVideo className="w-10 h-10 text-slate-700 mb-2 animate-pulse" />
            <p className="font-semibold text-slate-400">Your playlist is empty</p>
            <p className="text-xs text-slate-600 mt-1 max-w-xs">
              Upload MP4 files above to construct your 24/7 looping broadcast schedule.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {playlist.map((video, index) => (
              <div key={video.id} className="p-4 flex items-center justify-between hover:bg-slate-950/40 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                    <Play className="w-4 h-4 text-red-500 fill-red-500/10" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate max-w-md md:max-w-lg">
                      {video.originalname}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-0.5">
                      <span>Duration: {formatDuration(video.duration)}</span>
                      <span>•</span>
                      <span>Size: {formatSize(video.size)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Reorder Arrows */}
                  <div className="flex items-center border border-slate-800/80 rounded-lg p-0.5 bg-slate-950">
                    <button
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 hover:text-white text-slate-500 disabled:text-slate-800 hover:bg-slate-900 rounded transition-colors disabled:hover:bg-transparent cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === playlist.length - 1}
                      className="p-1.5 hover:text-white text-slate-500 disabled:text-slate-800 hover:bg-slate-900 rounded transition-colors disabled:hover:bg-transparent cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(video.id)}
                    className="p-2 border border-slate-800 hover:border-rose-900/30 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                    title="Remove Video"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <ConfirmationModal
        isOpen={deleteTargetId !== null}
        title="Delete Video"
        message="Are you sure you want to delete this video? It will be permanently removed from disk."
        confirmText="Delete"
        isDestructive={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
