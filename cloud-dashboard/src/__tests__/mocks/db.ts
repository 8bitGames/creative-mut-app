import { vi } from 'vitest';

// Mock organization data
export const mockOrganization = {
  id: 'org-123',
  name: 'Test Organization',
  slug: 'test-org',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock machine data
export const mockMachines = [
  {
    id: 'machine-1',
    organizationId: 'org-123',
    hardwareId: 'hw-001',
    name: 'Booth Seoul 1',
    status: 'online',
    locationId: null,
    lastHeartbeat: new Date(),
    appVersion: '1.0.0',
    osVersion: 'Windows 11',
    peripheralStatus: {
      camera: { status: 'ok' },
      printer: { status: 'ok' },
      payment: { status: 'warning' },
    },
    hardwareInfo: { temperature: 45 },
    networkInfo: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'machine-2',
    organizationId: 'org-123',
    hardwareId: 'hw-002',
    name: 'Booth Busan 1',
    status: 'offline',
    locationId: null,
    lastHeartbeat: new Date(Date.now() - 3600000),
    appVersion: '1.0.0',
    osVersion: 'Windows 11',
    peripheralStatus: null,
    hardwareInfo: null,
    networkInfo: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Mock session data
export const mockSessions = [
  {
    id: 'session-1',
    machineId: 'machine-1',
    sessionCode: 'ABC123',
    status: 'completed',
    startedAt: new Date(),
    completedAt: new Date(),
    processingTimeMs: 5000,
    paymentAmount: 3000,
    paymentStatus: 'success',
    frameSelected: 'frame1',
    photosCount: 4,
    outputVideoUrl: 'https://example.com/video.mp4',
    outputQrUrl: 'https://example.com/qr.png',
    createdAt: new Date(),
  },
  {
    id: 'session-2',
    machineId: 'machine-1',
    sessionCode: 'DEF456',
    status: 'failed',
    startedAt: new Date(),
    completedAt: new Date(),
    processingTimeMs: null,
    paymentAmount: null,
    paymentStatus: null,
    frameSelected: 'frame2',
    photosCount: 2,
    outputVideoUrl: null,
    outputQrUrl: null,
    errorCode: 'CAMERA_ERROR',
    errorMessage: 'Camera connection lost',
    createdAt: new Date(),
  },
];

// Mock alert data
export const mockAlerts = [
  {
    id: 'alert-1',
    machineId: 'machine-1',
    severity: 'critical',
    type: 'hardware',
    title: 'Camera Disconnected',
    message: 'Camera connection was lost during session',
    acknowledged: false,
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolved: false,
    resolvedAt: null,
    metadata: {},
    createdAt: new Date(),
  },
  {
    id: 'alert-2',
    machineId: 'machine-1',
    severity: 'warning',
    type: 'system',
    title: 'Low Disk Space',
    message: 'Disk usage above 80%',
    acknowledged: true,
    acknowledgedAt: new Date(),
    acknowledgedBy: 'test-user-id-123',
    resolved: false,
    resolvedAt: null,
    metadata: { diskUsage: 85 },
    createdAt: new Date(),
  },
];

// Mock drizzle db
export const mockDb = {
  select: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  innerJoin: vi.fn(() => mockDb),
  orderBy: vi.fn(() => mockDb),
  limit: vi.fn(() => mockDb),
  offset: vi.fn(() => mockDb),
  groupBy: vi.fn(() => mockDb),
  insert: vi.fn(() => mockDb),
  values: vi.fn(() => mockDb),
  returning: vi.fn(() => Promise.resolve([mockMachines[0]])),
  update: vi.fn(() => mockDb),
  set: vi.fn(() => mockDb),
  delete: vi.fn(() => mockDb),
  query: {
    organizationMembers: {
      findFirst: vi.fn().mockResolvedValue({
        organization: mockOrganization,
      }),
    },
  },
};

// Mock db module
vi.mock('@/lib/db', () => ({
  db: mockDb,
}));
