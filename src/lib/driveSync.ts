import { safeFetchJson } from '../utils';
import { StreamSettings, StreamKey, Schedule } from '../types';

export interface BackupData {
  settings: Partial<StreamSettings> | null;
  streamKeys: Omit<StreamKey, 'id'>[];
  schedules: Omit<Schedule, 'id'>[];
  updatedAt: string;
}

const BACKUP_FILENAME = 'streammanager_247_backup.json';

// Find backup file on user's Google Drive
export async function findBackupFile(accessToken: string): Promise<string | null> {
  const query = encodeURIComponent(`name = '${BACKUP_FILENAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;
  
  const res = await safeFetchJson<{ files: { id: string; name: string }[] }>(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (res.ok && res.data && res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }
  return null;
}

// Create a new backup file metadata on user's Google Drive
export async function createBackupFile(accessToken: string): Promise<string> {
  const url = 'https://www.googleapis.com/drive/v3/files';
  const res = await safeFetchJson<{ id: string }>(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: BACKUP_FILENAME,
      mimeType: 'application/json'
    })
  });

  if (res.ok && res.data && res.data.id) {
    return res.data.id;
  }
  throw new Error(res.error || 'Failed to create backup file in Google Drive');
}

// Fetch backup file content from Google Drive
export async function getBackupContent(accessToken: string, fileId: string): Promise<BackupData | null> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await safeFetchJson<BackupData>(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (res.ok && res.data) {
    return res.data;
  }
  return null;
}

// Update backup file content in Google Drive
export async function updateBackupContent(accessToken: string, fileId: string, data: BackupData): Promise<boolean> {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  const res = await safeFetchJson(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  return res.ok;
}

// Fetch all local config data from the backend
export async function fetchLocalData(token: string): Promise<{
  settings: StreamSettings | null;
  streamKeys: StreamKey[];
  schedules: Schedule[];
}> {
  const [settingsRes, keysRes, schedulesRes] = await Promise.all([
    safeFetchJson<StreamSettings>('/api/settings', { headers: { Authorization: `Bearer ${token}` } }),
    safeFetchJson<StreamKey[]>('/api/stream-keys', { headers: { Authorization: `Bearer ${token}` } }),
    safeFetchJson<Schedule[]>('/api/schedules', { headers: { Authorization: `Bearer ${token}` } })
  ]);

  return {
    settings: settingsRes.ok ? settingsRes.data : null,
    streamKeys: keysRes.ok && Array.isArray(keysRes.data) ? keysRes.data : [],
    schedules: schedulesRes.ok && Array.isArray(schedulesRes.data) ? schedulesRes.data : []
  };
}

// Restore data into the local SQLite backend
export async function restoreLocalData(token: string, data: BackupData): Promise<boolean> {
  let success = false;

  // 1. Restore settings
  if (data.settings) {
    const res = await safeFetchJson('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data.settings)
    });
    if (res.ok) success = true;
  }

  // 2. Restore keys
  if (data.streamKeys && Array.isArray(data.streamKeys)) {
    // Delete existing stream keys first to avoid duplicates
    const currentKeysRes = await safeFetchJson<StreamKey[]>('/api/stream-keys', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (currentKeysRes.ok && Array.isArray(currentKeysRes.data)) {
      for (const key of currentKeysRes.data) {
        await safeFetchJson(`/api/stream-keys/${key.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    }

    // Add back the backed up keys
    for (const key of data.streamKeys) {
      await safeFetchJson('/api/stream-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          platform: key.platform,
          name: key.name,
          rtmpUrl: key.rtmpUrl,
          streamKey: key.streamKey,
          enabled: key.enabled === 1
        })
      });
    }
    success = true;
  }

  // 3. Restore schedules
  if (data.schedules && Array.isArray(data.schedules)) {
    // Delete existing schedules first
    const currentSchedulesRes = await safeFetchJson<Schedule[]>('/api/schedules', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (currentSchedulesRes.ok && Array.isArray(currentSchedulesRes.data)) {
      for (const sched of currentSchedulesRes.data) {
        await safeFetchJson(`/api/schedules/${sched.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    }

    // Add back the schedules
    for (const s of data.schedules) {
      await safeFetchJson('/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          videoId: s.videoId,
          streamKeyId: s.streamKeyId,
          scheduledTime: s.scheduledTime
        })
      });
    }
    success = true;
  }

  return success;
}
