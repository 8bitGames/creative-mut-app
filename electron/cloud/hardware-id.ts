import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import * as os from 'os';

const execAsync = promisify(exec);

interface HardwareInfo {
  os: string;
  osVersion: string;
  hostname: string;
  cpu: string;
  cpuCores: number;
  ramTotal: number;  // MB
  platform: string;
  arch: string;
}

async function getWindowsUUID(): Promise<string> {
  try {
    const { stdout } = await execAsync('wmic csproduct get uuid');
    const lines = stdout.trim().split('\n');
    return lines[1]?.trim() || '';
  } catch {
    return '';
  }
}

async function getWindowsCpuId(): Promise<string> {
  try {
    const { stdout } = await execAsync('wmic cpu get processorid');
    const lines = stdout.trim().split('\n');
    return lines[1]?.trim() || '';
  } catch {
    return '';
  }
}

async function getWindowsDiskSerial(): Promise<string> {
  try {
    const { stdout } = await execAsync('wmic diskdrive get serialnumber');
    const lines = stdout.trim().split('\n');
    return lines[1]?.trim() || '';
  } catch {
    return '';
  }
}

async function getMacAddress(): Promise<string> {
  try {
    const networkInterfaces = os.networkInterfaces();

    // Find first non-internal interface with MAC
    for (const [, interfaces] of Object.entries(networkInterfaces)) {
      if (!interfaces) continue;
      for (const iface of interfaces) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          return iface.mac;
        }
      }
    }
    return '';
  } catch {
    return '';
  }
}

async function getMacOsUUID(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      "ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/ { split($0, a, \"\\\"\"); print a[4] }'"
    );
    return stdout.trim();
  } catch {
    return '';
  }
}

export async function generateHardwareId(): Promise<string> {
  const platform = os.platform();
  let components: string[] = [];

  if (platform === 'win32') {
    // Windows
    const [uuid, cpuId, diskSerial, mac] = await Promise.all([
      getWindowsUUID(),
      getWindowsCpuId(),
      getWindowsDiskSerial(),
      getMacAddress(),
    ]);
    components = [uuid, cpuId, diskSerial, mac];
  } else if (platform === 'darwin') {
    // macOS (for development)
    const [uuid, mac] = await Promise.all([
      getMacOsUUID(),
      getMacAddress(),
    ]);
    components = [uuid, mac];
  } else {
    // Linux fallback
    const mac = await getMacAddress();
    components = [os.hostname(), mac];
  }

  // Filter empty and create hash
  const fingerprint = components.filter(Boolean).join('|');

  if (!fingerprint) {
    // Fallback: use hostname + random component
    const fallback = `${os.hostname()}-${Date.now()}`;
    return createHash('sha256').update(fallback).digest('hex').substring(0, 32);
  }

  return createHash('sha256').update(fingerprint).digest('hex').substring(0, 32);
}

export async function getHardwareInfo(): Promise<HardwareInfo> {
  const cpus = os.cpus();

  return {
    os: os.platform() === 'win32' ? 'Windows' : os.platform() === 'darwin' ? 'macOS' : 'Linux',
    osVersion: os.release(),
    hostname: os.hostname(),
    cpu: cpus[0]?.model || 'Unknown',
    cpuCores: cpus.length,
    ramTotal: Math.round(os.totalmem() / 1024 / 1024),
    platform: os.platform(),
    arch: os.arch(),
  };
}

// Cache the hardware ID after first generation
let cachedHardwareId: string | null = null;

export async function getHardwareId(): Promise<string> {
  if (cachedHardwareId) {
    return cachedHardwareId;
  }

  cachedHardwareId = await generateHardwareId();
  return cachedHardwareId;
}
