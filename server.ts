import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { exec } from 'child_process';
import { createServer as createViteServer } from 'vite';

import { getDb, logEvent, hashPassword } from './src/server/db';
import { StreamManager } from './src/server/stream-manager';
import { VideoFile, StreamKey, StreamSettings, Schedule } from './src/types';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'streaming-manager-secret-superkey-2026';

// Initialize folders
const videosDir = path.resolve(process.cwd(), 'uploads/videos');
const logosDir = path.resolve(process.cwd(), 'uploads/logos');
fs.mkdirSync(videosDir, { recursive: true });
fs.mkdirSync(logosDir, { recursive: true });

app.use(express.json());

// Serve uploaded assets
app.use('/uploads/videos', express.static(videosDir));
app.use('/uploads/logos', express.static(logosDir));

// Authentication Middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token' });
    }
    try {
      const db = await getDb();
      const user = await db.get('SELECT id, username, approved FROM users WHERE id = ?', [decoded.id]);
      if (!user) {
        return res.status(403).json({ error: 'User account not found' });
      }
      req.user = user;
      next();
    } catch (dbErr) {
      req.user = decoded;
      next();
    }
  });
}

function requireApproved(req: any, res: any, next: any) {
  if (req.user && req.user.approved === 1) {
    next();
  } else {
    res.status(403).json({ error: 'Action Denied: Your account is pending admin approval. You can only view the site.' });
  }
}

// Multer setups
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, videosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'video-' + uniqueSuffix + ext);
  }
});
const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.mp4' || ext === '.mkv' || ext === '.mov' || ext === '.avi') {
      cb(null, true);
    } else {
      cb(new Error('Only standard video formats are allowed (.mp4, .mkv, .mov, .avi)'));
    }
  }
});

const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.resolve(process.cwd(), 'uploads/videos/tmp');
    fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `chunk-${uniqueSuffix}`);
  }
});
const uploadChunk = multer({ storage: chunkStorage });

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'logo-' + uniqueSuffix + ext);
  }
});
const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG or JPEG formats are allowed for logos'));
    }
  }
});

// Helper to calculate video duration using ffmpeg
function getVideoDuration(filepath: string): Promise<number> {
  return new Promise((resolve) => {
    exec(`ffmpeg -i "${filepath}"`, (err, stdout, stderr) => {
      const output = stderr || stdout;
      const match = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const seconds = parseInt(match[3]);
        const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
        resolve(totalSeconds > 0 ? totalSeconds : 300);
      } else {
        resolve(300); // 5 minutes fallback
      }
    });
  });
}

// CPU usage tracking state
let lastCpuMeasure = { active: 0, total: 0 };
function getCpuUsage(): number {
  const cpus = os.cpus();
  let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  const total = user + nice + sys + idle + irq;
  const active = user + nice + sys + irq;
  
  const deltaActive = active - lastCpuMeasure.active;
  const deltaTotal = total - lastCpuMeasure.total;
  
  lastCpuMeasure = { active, total };
  
  if (deltaTotal <= 0) return 5;
  return Math.min(100, Math.max(0, Math.round((deltaActive / deltaTotal) * 100)));
}

// ==========================================
// API ROUTES
// ==========================================

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || user.password !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    await logEvent('success', `User "${username}" logged in successfully`);
    res.json({ token, username: user.username });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const db = await getDb();
    
    const existingUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const hashedPassword = hashPassword(password);
    const result = await db.run('INSERT INTO users (username, password, approved) VALUES (?, ?, 0)', [username, hashedPassword]);

    await logEvent('warn', `Approval Request: New user account registered: "${username}". Awaiting administrator approval.`);
    res.status(201).json({ message: 'Registration successful! Your account is pending admin approval.', username });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Gmail/Google OAuth Login & Registration Handler
app.post('/api/auth/google', async (req, res) => {
  const { email, uid, displayName } = req.body;
  if (!email || !uid) {
    return res.status(400).json({ error: 'Email and Google UID are required' });
  }

  try {
    const db = await getDb();
    let user = await db.get('SELECT * FROM users WHERE username = ?', [email]);

    if (!user) {
      // Auto-register Gmail user if they don't already have an account
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = hashPassword(randomPassword);
      const result = await db.run('INSERT INTO users (username, password, approved) VALUES (?, ?, 0)', [email, hashedPassword]);
      const userId = result.lastID;

      user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
      await logEvent('warn', `Approval Request: New user "${email}" (${displayName}) registered automatically via Google Auth. Awaiting administrator approval.`);
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    await logEvent('success', `User "${email}" logged in successfully via Google Auth`);
    res.json({ token, username: user.username });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req: any, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    approved: req.user.approved
  });
});

// Admin User Directory and License Keys APIs
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const users = await db.all('SELECT id, username, approved FROM users ORDER BY id ASC');
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, requireApproved, async (req: any, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const userToDelete = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userToDelete.username === 'admin' || userToDelete.username === 'diamondvaiteam@gmail.com') {
      return res.status(400).json({ error: 'Super Admin accounts cannot be deleted' });
    }

    if (userToDelete.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own currently logged-in account' });
    }

    await db.run('DELETE FROM users WHERE id = ?', [id]);
    await logEvent('warn', `Deleted operator account: "${userToDelete.username}"`);
    res.json({ message: `User "${userToDelete.username}" deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:id/approve', authenticateToken, requireApproved, async (req: any, res) => {
  const { id } = req.params;
  const { approved } = req.body; // should be 0 or 1
  if (approved !== 0 && approved !== 1) {
    return res.status(400).json({ error: 'approved value must be 0 or 1' });
  }

  try {
    const db = await getDb();
    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.username === 'admin' || targetUser.username === 'diamondvaiteam@gmail.com') {
      return res.status(400).json({ error: 'Super Admin approval status cannot be modified' });
    }

    await db.run('UPDATE users SET approved = ? WHERE id = ?', [approved, id]);
    const action = approved === 1 ? 'approved' : 'disapproved';
    await logEvent('info', `Admin changed user "${targetUser.username}" status to ${action}`);
    res.json({ message: `User "${targetUser.username}" ${action} successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/license-keys', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const keys = await db.all('SELECT * FROM license_keys ORDER BY id DESC');
    res.json(keys);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/license-keys/generate', authenticateToken, requireApproved, async (req, res) => {
  try {
    const db = await getDb();
    // Generate a random-like pattern key
    const prefix = 'STREAM';
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const year = new Date().getFullYear();
    const newKey = `${prefix}-${randomHex}-${year}`;

    const now = new Date().toISOString();
    await db.run('INSERT INTO license_keys (key, usedBy, createdAt) VALUES (?, ?, ?)', [newKey, null, now]);
    await logEvent('info', `Generated new license key: "${newKey}"`);
    
    const keys = await db.all('SELECT * FROM license_keys ORDER BY id DESC');
    res.status(201).json(keys);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/change-password', authenticateToken, requireApproved, async (req: any, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old password and new password are required' });
  }

  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user || user.password !== hashPassword(oldPassword)) {
      return res.status(400).json({ error: 'Incorrect old password' });
    }

    await db.run('UPDATE users SET password = ? WHERE id = ?', [hashPassword(newPassword), req.user.id]);
    await logEvent('success', `User "${user.username}" successfully changed password`);
    res.json({ message: 'Password changed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stream Keys Routes
app.get('/api/stream-keys', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const keys = await db.all('SELECT * FROM stream_keys');
    res.json(keys);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stream-keys', authenticateToken, requireApproved, async (req, res) => {
  const { platform, name, rtmpUrl, streamKey, enabled } = req.body;
  if (!platform || !name || !rtmpUrl || !streamKey) {
    return res.status(400).json({ error: 'All fields (platform, name, rtmpUrl, streamKey) are required' });
  }

  try {
    const db = await getDb();
    const result = await db.run(
      'INSERT INTO stream_keys (platform, name, rtmpUrl, streamKey, enabled) VALUES (?, ?, ?, ?, ?)',
      [platform, name, rtmpUrl, streamKey, enabled ? 1 : 0]
    );
    const newKey = await db.get('SELECT * FROM stream_keys WHERE id = ?', [result.lastID]);
    await logEvent('info', `Added new stream destination: "${name}" (${platform})`);
    res.status(201).json(newKey);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/stream-keys/bulk/status', authenticateToken, requireApproved, async (req, res) => {
  const { ids, enabled } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids must be an array of numbers' });
  }

  try {
    const db = await getDb();
    const enabledVal = enabled ? 1 : 0;
    
    for (const id of ids) {
      await db.run('UPDATE stream_keys SET enabled = ? WHERE id = ?', [enabledVal, id]);
      await StreamManager.getInstance().syncStreamKey(id, enabled);
    }

    await logEvent('info', `Bulk updated ${ids.length} stream destinations to ${enabled ? 'ENABLED' : 'DISABLED'}`);
    res.json({ message: 'Bulk status updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/stream-keys/:id', authenticateToken, requireApproved, async (req, res) => {
  const { id } = req.params;
  const { platform, name, rtmpUrl, streamKey, enabled } = req.body;

  try {
    const db = await getDb();
    await db.run(
      'UPDATE stream_keys SET platform = ?, name = ?, rtmpUrl = ?, streamKey = ?, enabled = ? WHERE id = ?',
      [platform, name, rtmpUrl, streamKey, enabled ? 1 : 0, id]
    );

    // Sync stream dynamically if streaming is active
    await StreamManager.getInstance().syncStreamKey(parseInt(id), enabled ? true : false);

    const updatedKey = await db.get('SELECT * FROM stream_keys WHERE id = ?', [id]);
    await logEvent('info', `Updated stream destination: "${name}"`);
    res.json(updatedKey);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/stream-keys/:id', authenticateToken, requireApproved, async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const key = await db.get<StreamKey>('SELECT * FROM stream_keys WHERE id = ?', [id]);
    if (!key) return res.status(404).json({ error: 'Stream key not found' });

    // Ensure stopped in streamer
    await StreamManager.getInstance().syncStreamKey(parseInt(id), false);

    await db.run('DELETE FROM stream_keys WHERE id = ?', [id]);
    await logEvent('warn', `Deleted stream destination: "${key.name}"`);
    res.json({ message: 'Stream key deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Playlist Routes
app.get('/api/playlist', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const playlist = await db.all('SELECT * FROM playlist ORDER BY orderIndex ASC');
    res.json(playlist);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/playlist/upload', authenticateToken, requireApproved, uploadVideo.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  try {
    const relativePath = `uploads/videos/${req.file.filename}`;
    const duration = await getVideoDuration(req.file.path);
    const db = await getDb();
    
    // Get max order index
    const maxOrderResult = await db.get('SELECT MAX(orderIndex) as maxIndex FROM playlist');
    const orderIndex = (maxOrderResult && (maxOrderResult as any).maxIndex !== null)
      ? (maxOrderResult as any).maxIndex + 1
      : 0;

    const result = await db.run(
      `INSERT INTO playlist (filename, originalname, filepath, size, duration, orderIndex, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.file.filename, req.file.originalname, relativePath, req.file.size, duration, orderIndex, new Date().toISOString()]
    );

    const newVideo = await db.get('SELECT * FROM playlist WHERE id = ?', [result.lastID]);
    await logEvent('success', `Uploaded video playlist file: "${req.file.originalname}" (${Math.round(duration)}s)`);
    res.status(201).json(newVideo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/playlist/upload-chunk', authenticateToken, requireApproved, uploadChunk.single('chunk'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No chunk file provided' });
  }

  const { uploadId, chunkIndex, totalChunks, originalName } = req.body;
  if (!uploadId || chunkIndex === undefined || !totalChunks || !originalName) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Missing chunk metadata' });
  }

  try {
    const chunkDir = path.resolve(process.cwd(), `uploads/videos/tmp-${uploadId}`);
    fs.mkdirSync(chunkDir, { recursive: true });

    const targetPath = path.join(chunkDir, `chunk-${chunkIndex}`);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    fs.renameSync(req.file.path, targetPath);

    const totalChunksCount = parseInt(totalChunks);
    const chunkIndexNum = parseInt(chunkIndex);

    // Check if all chunks have been received
    let allChunksReceived = true;
    const chunkFiles: string[] = [];
    for (let i = 0; i < totalChunksCount; i++) {
      const p = path.join(chunkDir, `chunk-${i}`);
      if (!fs.existsSync(p)) {
        allChunksReceived = false;
        break;
      }
      chunkFiles.push(p);
    }

    if (allChunksReceived) {
      // Assemble the final file
      const ext = path.extname(originalName).toLowerCase();
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const finalFileName = 'video-' + uniqueSuffix + ext;
      const finalFilePath = path.join(videosDir, finalFileName);

      const writeStream = fs.createWriteStream(finalFilePath);

      // Append chunks sequentially
      for (const chunkPath of chunkFiles) {
        const data = fs.readFileSync(chunkPath);
        writeStream.write(data);
      }
      writeStream.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', (err) => reject(err));
      });

      // Cleanup chunks directory
      fs.rmSync(chunkDir, { recursive: true, force: true });

      // Add to database
      const relativePath = `uploads/videos/${finalFileName}`;
      const duration = await getVideoDuration(finalFilePath);
      const db = await getDb();
      
      const fileStats = fs.statSync(finalFilePath);
      const finalSize = fileStats.size;

      const maxOrderResult = await db.get('SELECT MAX(orderIndex) as maxIndex FROM playlist');
      const orderIndex = (maxOrderResult && (maxOrderResult as any).maxIndex !== null)
        ? (maxOrderResult as any).maxIndex + 1
        : 0;

      const result = await db.run(
        `INSERT INTO playlist (filename, originalname, filepath, size, duration, orderIndex, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [finalFileName, originalName, relativePath, finalSize, duration, orderIndex, new Date().toISOString()]
      );

      const newVideo = await db.get('SELECT * FROM playlist WHERE id = ?', [result.lastID]);
      await logEvent('success', `Uploaded video playlist file (chunked): "${originalName}" (${Math.round(duration)}s)`);
      return res.json({ complete: true, video: newVideo });
    }

    res.json({ complete: false, receivedChunk: chunkIndexNum });
  } catch (err: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Error handling chunk upload:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/playlist/reorder', authenticateToken, requireApproved, async (req, res) => {
  const { orderedIds } = req.body; // array of IDs
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: 'orderedIds must be an array of video IDs' });
  }

  try {
    const db = await getDb();
    for (let i = 0; i < orderedIds.length; i++) {
      await db.run('UPDATE playlist SET orderIndex = ? WHERE id = ?', [i, orderedIds[i]]);
    }
    await logEvent('info', 'Reordered video playlist items');
    res.json({ message: 'Playlist reordered successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/playlist/:id', authenticateToken, requireApproved, async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const video = await db.get<VideoFile>('SELECT * FROM playlist WHERE id = ?', [id]);
    if (!video) return res.status(404).json({ error: 'Video file not found' });

    // Delete physical file safely
    const fullPath = path.resolve(video.filepath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await db.run('DELETE FROM playlist WHERE id = ?', [id]);
    await logEvent('warn', `Deleted playlist video file: "${video.originalname}"`);
    res.json({ message: 'Video deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stream Controls
app.get('/api/stream/status', authenticateToken, (req, res) => {
  res.json(StreamManager.getInstance().getStats());
});

app.post('/api/stream/start', authenticateToken, requireApproved, async (req, res) => {
  try {
    await StreamManager.getInstance().startStreaming();
    res.json({ message: 'Streaming started successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stream/stop', authenticateToken, requireApproved, (req, res) => {
  try {
    StreamManager.getInstance().stopStreaming();
    res.json({ message: 'Streaming stopped successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Settings Routes
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const settings = await db.get('SELECT * FROM settings LIMIT 1');
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', authenticateToken, requireApproved, async (req, res) => {
  const {
    loopPlaylist, logoPosition, textOverlay, textPosition, textColor, textSize, resolution, videoBitrate, audioBitrate, aspectRatio, scaleMode
  } = req.body;

  try {
    const db = await getDb();
    await db.run(`
      UPDATE settings SET 
        loopPlaylist = ?, logoPosition = ?, textOverlay = ?, textPosition = ?, textColor = ?, textSize = ?, resolution = ?, videoBitrate = ?, audioBitrate = ?, aspectRatio = ?, scaleMode = ?
      WHERE id = 1
    `, [
      loopPlaylist ? 1 : 0, logoPosition, textOverlay, textPosition, textColor, parseInt(textSize) || 24, resolution, videoBitrate, audioBitrate, aspectRatio || '16:9', scaleMode || 'fit'
    ]);

    await logEvent('info', 'Updated streaming settings configuration');
    const updatedSettings = await db.get('SELECT * FROM settings LIMIT 1');
    res.json(updatedSettings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/logo', authenticateToken, requireApproved, uploadLogo.single('logo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No logo file provided' });
  }

  try {
    const db = await getDb();
    const settings = await db.get<StreamSettings>('SELECT * FROM settings LIMIT 1');
    
    // Delete old logo file if exists
    if (settings && settings.logoPath) {
      const oldPath = path.resolve(settings.logoPath);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const relativePath = `uploads/logos/${req.file.filename}`;
    await db.run('UPDATE settings SET logoPath = ? WHERE id = 1', [relativePath]);
    await logEvent('success', `Uploaded overlay logo file: "${req.file.originalname}"`);
    res.json({ logoPath: relativePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/settings/logo', authenticateToken, requireApproved, async (req, res) => {
  try {
    const db = await getDb();
    const settings = await db.get<StreamSettings>('SELECT * FROM settings LIMIT 1');
    if (settings && settings.logoPath) {
      const fullPath = path.resolve(settings.logoPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    await db.run('UPDATE settings SET logoPath = NULL WHERE id = 1');
    await logEvent('warn', 'Deleted overlay logo file');
    res.json({ logoPath: null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Schedules Routes
app.get('/api/schedules', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const schedules = await db.all('SELECT * FROM schedules ORDER BY scheduledTime ASC');
    res.json(schedules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/schedules', authenticateToken, requireApproved, async (req, res) => {
  const { videoId, streamKeyId, scheduledTime } = req.body;
  if (!videoId || !streamKeyId || !scheduledTime) {
    return res.status(400).json({ error: 'All fields (videoId, streamKeyId, scheduledTime) are required' });
  }

  try {
    const db = await getDb();
    const video = await db.get<VideoFile>('SELECT * FROM playlist WHERE id = ?', [videoId]);
    const streamKey = await db.get<StreamKey>('SELECT * FROM stream_keys WHERE id = ?', [streamKeyId]);

    if (!video) return res.status(400).json({ error: 'Video file does not exist' });
    if (!streamKey) return res.status(400).json({ error: 'Stream key does not exist' });

    const result = await db.run(
      'INSERT INTO schedules (videoId, videoTitle, streamKeyId, streamKeyName, scheduledTime, status) VALUES (?, ?, ?, ?, ?, ?)',
      [videoId, video.originalname, streamKeyId, streamKey.name, scheduledTime, 'pending']
    );

    const newSched = await db.get('SELECT * FROM schedules WHERE id = ?', [result.lastID]);
    await logEvent('info', `Scheduled future stream of "${video.originalname}" to "${streamKey.name}" at ${scheduledTime}`);
    res.status(201).json(newSched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/schedules/:id', authenticateToken, requireApproved, async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const sched = await db.get('SELECT * FROM schedules WHERE id = ?', [id]);
    if (!sched) return res.status(404).json({ error: 'Schedule entry not found' });

    await db.run('DELETE FROM schedules WHERE id = ?', [id]);
    await logEvent('warn', `Cancelled scheduled stream of "${(sched as any).videoTitle}"`);
    res.json({ message: 'Schedule cancelled successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Logs API
app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const logs = await db.all('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100');
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// System Stats Monitor API
app.get('/api/stats', authenticateToken, (req, res) => {
  try {
    const cpu = getCpuUsage();
    const memoryTotal = Math.round(os.totalmem() / (1024 * 1024));
    const memoryUsed = Math.round((os.totalmem() - os.freemem()) / (1024 * 1024));
    const uptime = Math.round(os.uptime());
    
    const streamStats = StreamManager.getInstance().getStats();

    res.json({
      cpu,
      memoryUsed,
      memoryTotal,
      uptime,
      ...streamStats
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// VITE OR STATIC SERVING MIDDLEWARE
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on port ${PORT}`);
    try {
      // Warm up the database and verify seeds on boot
      await getDb();
      await logEvent('success', 'Streaming Management Server booted up on Port 3000');
    } catch (err) {
      console.error('Database connection failed on boot:', err);
    }
  });
}

startServer();
