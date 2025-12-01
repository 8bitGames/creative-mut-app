/**
 * Dependency Manager for MUT Hologram Studio
 * Handles lazy downloading of large dependencies (FFmpeg, Python) on first run
 *
 * This reduces the initial installer size significantly by downloading
 * dependencies only when needed.
 *
 * OPTIMIZATION NOTE (2025-11-28):
 * - FFmpeg essentials build: ~40MB (vs ~120MB full)
 * - Can skip bundling FFmpeg entirely and download on first run
 */

import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';

// Configuration
const FFMPEG_DOWNLOAD_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
const FFMPEG_FALLBACK_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';

export interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  status: 'downloading' | 'extracting' | 'complete' | 'error';
  message?: string;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Get the path where dependencies should be stored
 */
export function getDependencyDir(): string {
  // In production, use userData (persists across updates)
  // In development, use resources folder
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'dependencies');
  } else {
    return path.join(process.cwd(), 'resources');
  }
}

/**
 * Get FFmpeg executable path
 */
export function getFFmpegPath(): string {
  const depDir = getDependencyDir();
  return path.join(depDir, 'ffmpeg', 'ffmpeg.exe');
}

/**
 * Get FFprobe executable path
 */
export function getFFprobePath(): string {
  const depDir = getDependencyDir();
  return path.join(depDir, 'ffmpeg', 'ffprobe.exe');
}

/**
 * Check if FFmpeg is installed
 */
export function isFFmpegInstalled(): boolean {
  return fs.existsSync(getFFmpegPath());
}

/**
 * Check common system locations for FFmpeg
 */
export function findSystemFFmpeg(): string | null {
  const commonPaths = [
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Download a file with progress tracking
 */
function downloadFile(
  url: string,
  destPath: string,
  onProgress?: ProgressCallback
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const request = (url.startsWith('https') ? https : http).get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(destPath);
          downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;

      response.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        if (onProgress && totalSize > 0) {
          onProgress({
            percent: Math.round((downloadedSize / totalSize) * 100),
            transferred: downloadedSize,
            total: totalSize,
            status: 'downloading',
          });
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    request.on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

/**
 * Extract a zip file using PowerShell (built into Windows)
 */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
  const { exec } = await import('child_process');

  return new Promise((resolve, reject) => {
    // Use PowerShell's Expand-Archive
    const cmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;

    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Extraction failed: ${stderr || error.message}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Find ffmpeg.exe in extracted directory (handles nested folders)
 */
function findFFmpegInDir(dir: string): string | null {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && entry.name.toLowerCase() === 'ffmpeg.exe') {
      return fullPath;
    }

    if (entry.isDirectory()) {
      const found = findFFmpegInDir(fullPath);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Download and install FFmpeg
 */
export async function installFFmpeg(onProgress?: ProgressCallback): Promise<string> {
  const depDir = getDependencyDir();
  const ffmpegDir = path.join(depDir, 'ffmpeg');
  const tempDir = path.join(depDir, 'temp');
  const zipPath = path.join(tempDir, 'ffmpeg.zip');

  // Create directories
  fs.mkdirSync(ffmpegDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Download
    onProgress?.({
      percent: 0,
      transferred: 0,
      total: 0,
      status: 'downloading',
      message: 'Downloading FFmpeg essentials...',
    });

    try {
      await downloadFile(FFMPEG_DOWNLOAD_URL, zipPath, onProgress);
    } catch (error) {
      // Try fallback URL
      console.log('Primary FFmpeg URL failed, trying fallback...');
      await downloadFile(FFMPEG_FALLBACK_URL, zipPath, onProgress);
    }

    // Extract
    onProgress?.({
      percent: 100,
      transferred: 0,
      total: 0,
      status: 'extracting',
      message: 'Extracting FFmpeg...',
    });

    const extractDir = path.join(tempDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });
    await extractZip(zipPath, extractDir);

    // Find and copy executables
    const ffmpegExe = findFFmpegInDir(extractDir);
    if (!ffmpegExe) {
      throw new Error('Could not find ffmpeg.exe in downloaded archive');
    }

    const binDir = path.dirname(ffmpegExe);

    // Copy ffmpeg and ffprobe
    fs.copyFileSync(ffmpegExe, path.join(ffmpegDir, 'ffmpeg.exe'));

    const ffprobeExe = path.join(binDir, 'ffprobe.exe');
    if (fs.existsSync(ffprobeExe)) {
      fs.copyFileSync(ffprobeExe, path.join(ffmpegDir, 'ffprobe.exe'));
    }

    // Cleanup temp files
    fs.rmSync(tempDir, { recursive: true, force: true });

    onProgress?.({
      percent: 100,
      transferred: 0,
      total: 0,
      status: 'complete',
      message: 'FFmpeg installed successfully!',
    });

    return getFFmpegPath();
  } catch (error) {
    // Cleanup on error
    fs.rmSync(tempDir, { recursive: true, force: true });

    onProgress?.({
      percent: 0,
      transferred: 0,
      total: 0,
      status: 'error',
      message: `Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });

    throw error;
  }
}

/**
 * Ensure FFmpeg is available, downloading if necessary
 */
export async function ensureFFmpeg(onProgress?: ProgressCallback): Promise<string> {
  // Check if already installed in our dependency dir
  if (isFFmpegInstalled()) {
    return getFFmpegPath();
  }

  // Check bundled location (for fully bundled builds)
  const bundledPath = app.isPackaged
    ? path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe')
    : path.join(process.cwd(), 'resources', 'ffmpeg', 'ffmpeg.exe');

  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // Check system locations
  const systemPath = findSystemFFmpeg();
  if (systemPath) {
    console.log(`Using system FFmpeg: ${systemPath}`);
    return systemPath;
  }

  // Download FFmpeg
  console.log('FFmpeg not found, downloading...');
  return installFFmpeg(onProgress);
}

/**
 * Show a download progress dialog
 */
export async function showFFmpegDownloadDialog(
  parentWindow: BrowserWindow | null
): Promise<string | null> {
  const { dialog } = await import('electron');

  // Check if FFmpeg exists first
  if (isFFmpegInstalled()) {
    return getFFmpegPath();
  }

  const systemPath = findSystemFFmpeg();
  if (systemPath) {
    return systemPath;
  }

  // Ask user if they want to download
  const result = await dialog.showMessageBox(parentWindow || undefined as any, {
    type: 'question',
    buttons: ['Download FFmpeg', 'Cancel'],
    defaultId: 0,
    title: 'FFmpeg Required',
    message: 'FFmpeg is required for video processing',
    detail: 'FFmpeg was not found on your system. Would you like to download it now? (~40MB)',
  });

  if (result.response === 1) {
    return null; // User cancelled
  }

  // Show progress dialog
  // In a real app, you'd show a proper progress UI
  // For now, we'll just download and return
  try {
    return await installFFmpeg((progress) => {
      console.log(`FFmpeg download: ${progress.percent}% - ${progress.message || progress.status}`);
    });
  } catch (error) {
    await dialog.showErrorBox(
      'Download Failed',
      `Failed to download FFmpeg: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return null;
  }
}
