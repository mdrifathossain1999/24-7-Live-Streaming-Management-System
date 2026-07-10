import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getDb, logEvent } from './db';
import { VideoFile, StreamKey, StreamSettings } from '../types';

function getSystemFont(): string | null {
  const fontPaths = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/liberation/LiberationSans-Regular.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    'C:\\Windows\\Fonts\\arial.ttf'
  ];
  for (const f of fontPaths) {
    if (fs.existsSync(f)) {
      return f;
    }
  }
  return null;
}

export class StreamManager {
  private static instance: StreamManager | null = null;

  public isStreaming = false;
  public activeVideo: VideoFile | null = null;
  public activeVideoStartedAt: number | null = null;
  public elapsedSeconds = 0;

  private processes = new Map<number, ChildProcess>();
  private reconnectTimers = new Map<number, NodeJS.Timeout>();
  private monitorInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start background monitor for schedules
    this.startSchedulerMonitor();
  }

  public static getInstance(): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager();
    }
    return StreamManager.instance;
  }

  public getStats() {
    return {
      ffmpegRunning: this.processes.size > 0,
      isStreaming: this.isStreaming,
      activeVideo: this.activeVideo ? this.activeVideo.originalname : null,
      activeVideoDuration: this.activeVideo ? this.activeVideo.duration : null,
      activeVideoElapsed: this.activeVideo ? this.elapsedSeconds : null,
      connectedOutputs: Array.from(this.processes.keys())
    };
  }

  public async startStreaming() {
    if (this.isStreaming) {
      await logEvent('warn', 'Streaming is already running.');
      return;
    }

    const db = await getDb();
    const playlist = await db.all<VideoFile[]>('SELECT * FROM playlist ORDER BY orderIndex ASC');
    if (playlist.length === 0) {
      await logEvent('error', 'Cannot start streaming. The playlist is empty. Please upload MP4 videos first.');
      return;
    }

    const enabledKeys = await db.all<StreamKey[]>('SELECT * FROM stream_keys WHERE enabled = 1');
    if (enabledKeys.length === 0) {
      await logEvent('error', 'Cannot start streaming. No stream destinations (Facebook, YouTube, etc.) are enabled.');
      return;
    }

    this.isStreaming = true;
    this.elapsedSeconds = 0;
    await logEvent('info', `Starting 24/7 stream broadcast. Active destinations: ${enabledKeys.map(k => `${k.name} (${k.platform})`).join(', ')}`);

    // Start with the first video in the playlist
    await this.playVideo(playlist[0], 0);

    // Setup monitor interval
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.monitorInterval = setInterval(async () => {
      if (!this.isStreaming || !this.activeVideo) return;

      this.elapsedSeconds++;

      // Check if current video finished
      if (this.elapsedSeconds >= this.activeVideo.duration) {
        await logEvent('info', `Finished playing video: "${this.activeVideo.originalname}". Moving to next video...`);
        await this.playNextVideo();
      }
    }, 1000);
  }

  private async playVideo(video: VideoFile, seekSeconds = 0) {
    this.activeVideo = video;
    this.activeVideoStartedAt = Date.now() - (seekSeconds * 1000);
    this.elapsedSeconds = seekSeconds;

    // Clear old processes safely
    this.stopAllFFmpegProcesses();

    const db = await getDb();
    const settings = await db.get<StreamSettings>('SELECT * FROM settings LIMIT 1');
    const enabledKeys = await db.all<StreamKey[]>('SELECT * FROM stream_keys WHERE enabled = 1');

    if (!settings) {
      await logEvent('error', 'Streaming settings not found in database.');
      this.stopStreaming();
      return;
    }

    if (enabledKeys.length === 0) {
      await logEvent('warn', 'No active stream keys enabled. Pausing broadcast.');
      this.stopStreaming();
      return;
    }

    await logEvent('success', `Now streaming: "${video.originalname}" (${video.duration}s)`);

    for (const key of enabledKeys) {
      this.spawnFFmpegForKey(video, key, settings, seekSeconds);
    }
  }

  private async playNextVideo() {
    const db = await getDb();
    const playlist = await db.all<VideoFile[]>('SELECT * FROM playlist ORDER BY orderIndex ASC');
    const settings = await db.get<StreamSettings>('SELECT * FROM settings LIMIT 1');

    if (playlist.length === 0) {
      await logEvent('error', 'Playlist is empty. Stopping streaming loop.');
      this.stopStreaming();
      return;
    }

    if (!this.activeVideo) {
      await this.playVideo(playlist[0], 0);
      return;
    }

    // Find current index
    const currentIndex = playlist.findIndex(v => v.id === this.activeVideo?.id);
    let nextIndex = currentIndex + 1;

    if (nextIndex >= playlist.length) {
      if (settings?.loopPlaylist === 1) {
        nextIndex = 0;
        await logEvent('info', 'Reached the end of the playlist. Looping back to the first video.');
      } else {
        await logEvent('info', 'Playlist completed. Loop settings disabled. Stopping live stream.');
        this.stopStreaming();
        return;
      }
    }

    await this.playVideo(playlist[nextIndex], 0);
  }

  private spawnFFmpegForKey(video: VideoFile, key: StreamKey, settings: StreamSettings, seekSeconds = 0) {
    const rtmpDestination = `${key.rtmpUrl}/${key.streamKey}`;
    const videoPath = path.resolve(video.filepath);

    if (!fs.existsSync(videoPath)) {
      logEvent('error', `Video file does not exist on disk: ${videoPath}`);
      return;
    }

    // Clear reconnect timer if any
    const existingTimer = this.reconnectTimers.get(key.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.reconnectTimers.delete(key.id);
    }

    // Build FFmpeg arguments
    const args: string[] = [];

    // Seeking if needed
    if (seekSeconds > 0) {
      args.push('-ss', seekSeconds.toString());
    }

    // Input file (read at native frame rate to keep timing synchronized)
    args.push('-re');
    args.push('-i', videoPath);

    // Overlay image input if configured
    let hasLogo = false;
    let logoPathResolved = '';
    if (settings.logoPath) {
      logoPathResolved = path.resolve(settings.logoPath);
      if (fs.existsSync(logoPathResolved)) {
        args.push('-i', logoPathResolved);
        hasLogo = true;
      }
    }

    // Resolution scaling calculation
    let targetWidth = 1280;
    let targetHeight = 720;
    const isPortrait = settings.aspectRatio === '9:16';

    if (settings.resolution === '1080p') {
      targetWidth = isPortrait ? 1080 : 1920;
      targetHeight = isPortrait ? 1920 : 1080;
    } else if (settings.resolution === '480p') {
      targetWidth = isPortrait ? 480 : 854;
      targetHeight = isPortrait ? 854 : 480;
    } else { // 720p
      targetWidth = isPortrait ? 720 : 1280;
      targetHeight = isPortrait ? 1280 : 720;
    }

    const scaleMode = settings.scaleMode || 'fit';
    let resScale_filter = '';

    if (scaleMode === 'crop') {
      // Crop to fill targetWidth x targetHeight (force aspect ratio increase, then crop)
      resScale_filter = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}`;
    } else if (scaleMode === 'stretch') {
      // Simple scaling to targetWidth x targetHeight
      resScale_filter = `scale=${targetWidth}:${targetHeight}`;
    } else { // 'fit' (default)
      // Letterbox / Pillarbox centering using scale and pad
      resScale_filter = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2`;
    }

    // Video filter logic combining scaling and overlays
    let filterString = '';
    const logoPos = settings.logoPosition;
    const textPos = settings.textPosition;
    const text = settings.textOverlay;

    let x_logo = 'main_w-overlay_w-15';
    let y_logo = '15';
    if (logoPos === 'top-left') { x_logo = '15'; y_logo = '15'; }
    else if (logoPos === 'bottom-left') { x_logo = '15'; y_logo = 'main_h-overlay_h-15'; }
    else if (logoPos === 'bottom-right') { x_logo = 'main_w-overlay_w-15'; y_logo = 'main_h-overlay_h-15'; }

    let x_text = '25';
    let y_text = 'h-text_h-25';
    if (textPos === 'top-left') { x_text = '25'; y_text = '25'; }
    else if (textPos === 'top-right') { x_text = 'w-text_w-25'; y_text = '25'; }
    else if (textPos === 'bottom-right') { x_text = 'w-text_w-25'; y_text = 'h-text_h-25'; }

    const fontPath = getSystemFont();
    const fontOption = fontPath ? `:fontfile='${fontPath}'` : '';
    const cleanText = text ? text.replace(/'/g, "'\\''") : '';

    if (hasLogo && text) {
      // Scale video first, then apply logo and text overlays on top of the scaled stream
      filterString = `[0:v]${resScale_filter}[scaled];[scaled][1:v]overlay=${x_logo}[ovr];[ovr]drawtext=text='${cleanText}':fontcolor=${settings.textColor}:fontsize=${settings.textSize}:x=${x_text}:y=${y_text}${fontOption}`;
    } else if (hasLogo) {
      filterString = `[0:v]${resScale_filter}[scaled];[scaled][1:v]overlay=${x_logo}`;
    } else if (text) {
      filterString = `[0:v]${resScale_filter}[scaled];[scaled]drawtext=text='${cleanText}':fontcolor=${settings.textColor}:fontsize=${settings.textSize}:x=${x_text}:y=${y_text}${fontOption}`;
    } else {
      filterString = resScale_filter;
    }

    args.push('-vf', filterString);

    // Encoding parameters optimized for general streaming (e.g. Facebook RTMPS and YouTube RTMP)
    args.push('-c:v', 'libx264');
    args.push('-preset', 'ultrafast');
    args.push('-tune', 'zerolatency');
    args.push('-b:v', settings.videoBitrate);
    args.push('-maxrate', settings.videoBitrate);
    // Buffering allocation
    const bitrateInt = parseInt(settings.videoBitrate) || 2500;
    args.push('-bufsize', `${bitrateInt * 2}k`);

    // Force exact 2-second keyframe intervals and standard pixel format required by Facebook and YouTube
    args.push('-r', '30'); // Constant framerate: 30 FPS
    args.push('-g', '60'); // GOP: 60 frames (exactly 2 seconds at 30 FPS)
    args.push('-keyint_min', '60');
    args.push('-sc_threshold', '0'); // Disable scene-change detection to enforce rigid 2-second keyframes
    args.push('-pix_fmt', 'yuv420p'); // Force standard web-compatible pixel format
    args.push('-vsync', '1'); // Force constant framerate sync

    // Audio parameters optimized for Facebook (stereo standard)
    args.push('-c:a', 'aac');
    args.push('-b:a', settings.audioBitrate);
    args.push('-ar', '44100');
    args.push('-ac', '2'); // Force stereo to prevent Facebook ingestion drops

    // Output settings with flvflags to prevent non-seekable live stream metadata errors
    args.push('-f', 'flv');
    args.push('-flvflags', 'no_duration_filesize');
    args.push(rtmpDestination);

    logEvent('info', `Spawning FFmpeg for "${key.name}" (${key.platform}). Destination: ${key.rtmpUrl}`);

    try {
      const proc = spawn('ffmpeg', args, { windowsHide: true });
      this.processes.set(key.id, proc);

      proc.stdout.on('data', (data) => {
        // FFmpeg usually logs to stderr, but log stdout just in case
        console.log(`[FFmpeg-${key.name} stdout]`, data.toString());
      });

      proc.stderr.on('data', (data) => {
        const line = data.toString();
        // Console debug stream status info if needed
        if (line.includes('Error') || line.includes('failed') || line.includes('Host not found')) {
          console.error(`[FFmpeg-${key.name} Error]`, line.trim());
        }
      });

      proc.on('close', async (code) => {
        this.processes.delete(key.id);
        await logEvent('warn', `FFmpeg process for "${key.name}" closed with exit code ${code}`);

        if (this.isStreaming) {
          // Check if this stream key is still enabled
          const activeDb = await getDb();
          const currentKey = await activeDb.get<StreamKey>('SELECT * FROM stream_keys WHERE id = ?', [key.id]);
          
          if (currentKey && currentKey.enabled === 1) {
            await logEvent('warn', `Unexpected disconnect on "${key.name}". Initiating automatic reconnect in 5 seconds...`);
            
            const reconnectTimer = setTimeout(() => {
              if (this.isStreaming && this.activeVideo) {
                const currentElapsed = Math.floor((Date.now() - (this.activeVideoStartedAt || Date.now())) / 1000);
                this.spawnFFmpegForKey(this.activeVideo, key, settings, Math.max(0, currentElapsed));
              }
            }, 5000);

            this.reconnectTimers.set(key.id, reconnectTimer);
          }
        }
      });

      proc.on('error', async (err) => {
        await logEvent('error', `Failed to start FFmpeg for "${key.name}": ${err.message}. Please verify FFmpeg is installed.`);
      });

    } catch (e: any) {
      logEvent('error', `Exception spawning FFmpeg: ${e.message}`);
    }
  }

  public async syncStreamKey(keyId: number, start: boolean) {
    // If we enable/disable a stream key while streaming is running, dynamic sync!
    if (!this.isStreaming) return;

    const db = await getDb();
    const key = await db.get<StreamKey>('SELECT * FROM stream_keys WHERE id = ?', [keyId]);
    const settings = await db.get<StreamSettings>('SELECT * FROM settings LIMIT 1');

    if (!key || !settings || !this.activeVideo) return;

    if (start && key.enabled === 1) {
      if (this.processes.has(keyId)) return; // Already running
      const elapsed = Math.floor((Date.now() - (this.activeVideoStartedAt || Date.now())) / 1000);
      await logEvent('info', `Synchronizing and starting live stream for newly enabled key "${key.name}" at elapsed offset: ${elapsed}s`);
      this.spawnFFmpegForKey(this.activeVideo, key, settings, Math.max(0, elapsed));
    } else {
      // Stop it
      const proc = this.processes.get(keyId);
      if (proc) {
        await logEvent('info', `Stopping live stream for disabled key "${key.name}"`);
        proc.kill('SIGINT');
        this.processes.delete(keyId);
      }
      const timer = this.reconnectTimers.get(keyId);
      if (timer) {
        clearTimeout(timer);
        this.reconnectTimers.delete(keyId);
      }
    }
  }

  public stopStreaming() {
    if (!this.isStreaming) return;

    this.isStreaming = false;
    this.activeVideo = null;
    this.activeVideoStartedAt = null;
    this.elapsedSeconds = 0;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    this.stopAllFFmpegProcesses();
    logEvent('warn', 'Live streaming broadcast has been stopped.');
  }

  private stopAllFFmpegProcesses() {
    // Kill processes
    for (const [id, proc] of this.processes.entries()) {
      try {
        proc.kill('SIGKILL');
      } catch (e) {}
    }
    this.processes.clear();

    // Clear reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
  }

  // Scheduler Background Runner
  private startSchedulerMonitor() {
    // Poll every 30 seconds for pending schedules
    setInterval(async () => {
      try {
        const db = await getDb();
        const now = new Date();
        const schedules = await db.all('SELECT * FROM schedules WHERE status = "pending"');

        for (const sched of schedules) {
          const schedTime = new Date(sched.scheduledTime);
          if (schedTime <= now) {
            await logEvent('info', `Schedule trigger hit: Starting scheduled stream for video ID ${sched.videoId} to stream key ID ${sched.streamKeyId}`);
            
            // 1. Enable ONLY this stream key, or make sure it's enabled
            await db.run('UPDATE stream_keys SET enabled = 0'); // disable all first for scheduled target
            await db.run('UPDATE stream_keys SET enabled = 1 WHERE id = ?', [sched.streamKeyId]);
            
            // 2. Clear current playlist order to put this video first, or just start streaming directly
            const video = await db.get<VideoFile>('SELECT * FROM playlist WHERE id = ?', [sched.videoId]);
            if (!video) {
              await db.run('UPDATE schedules SET status = "failed" WHERE id = ?', [sched.id]);
              await logEvent('error', `Scheduled stream failed: Video file with ID ${sched.videoId} not found`);
              continue;
            }

            // 3. Start streaming
            if (this.isStreaming) {
              this.stopStreaming();
            }

            // Reorder playlist to make this video first
            const playlist = await db.all<VideoFile[]>('SELECT * FROM playlist ORDER BY orderIndex ASC');
            if (playlist.length > 0) {
              // Swap orders to put this video first
              let index = 0;
              await db.run('UPDATE playlist SET orderIndex = 0 WHERE id = ?', [video.id]);
              for (const v of playlist) {
                if (v.id !== video.id) {
                  index++;
                  await db.run('UPDATE playlist SET orderIndex = ? WHERE id = ?', [index, v.id]);
                }
              }
            }

            await db.run('UPDATE schedules SET status = "running" WHERE id = ?', [sched.id]);
            await this.startStreaming();
            await db.run('UPDATE schedules SET status = "completed" WHERE id = ?', [sched.id]);
          }
        }
      } catch (e: any) {
        console.error('Scheduler monitor error:', e.message);
      }
    }, 15000);
  }
}
