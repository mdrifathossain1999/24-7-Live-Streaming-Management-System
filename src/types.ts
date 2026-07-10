export interface User {
  id: number;
  username: string;
}

export interface StreamKey {
  id: number;
  platform: 'facebook' | 'youtube' | 'custom';
  name: string;
  rtmpUrl: string;
  streamKey: string;
  enabled: number; // 0 or 1
}

export interface VideoFile {
  id: number;
  filename: string;
  originalname: string;
  filepath: string;
  size: number;
  duration: number; // in seconds
  orderIndex: number;
  createdAt: string;
}

export interface StreamSettings {
  id: number;
  loopPlaylist: number; // 0 or 1
  logoPath: string | null;
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  textOverlay: string | null;
  textPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  textColor: string; // hex or name
  textSize: number;
  resolution: '1080p' | '720p' | '480p';
  videoBitrate: string; // e.g., '3000k'
  audioBitrate: string; // e.g., '128k'
  aspectRatio: '16:9' | '9:16';
  scaleMode: 'fit' | 'crop' | 'stretch';
}

export interface Schedule {
  id: number;
  videoId: number;
  videoTitle: string;
  streamKeyId: number;
  streamKeyName: string;
  scheduledTime: string; // ISO String
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface StreamLog {
  id: number;
  timestamp: string;
  type: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface SystemStats {
  cpu: number;
  memoryUsed: number;
  memoryTotal: number;
  uptime: number; // in seconds
  ffmpegRunning: boolean;
  activeVideo: string | null;
  activeVideoDuration: number | null;
  activeVideoElapsed: number | null;
}
