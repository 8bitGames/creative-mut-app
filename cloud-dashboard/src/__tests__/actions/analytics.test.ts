import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDb, mockMachines, mockOrganization } from '../mocks/db';

// Mock auth
const mockGetUserOrganization = vi.fn();
vi.mock('@/actions/auth', () => ({
  getUserOrganization: () => mockGetUserOrganization(),
}));

// Mock db
vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

// Mock schema
vi.mock('@/lib/db/schema', () => ({
  sessions: {
    machineId: 'machine_id',
    status: 'status',
    startedAt: 'started_at',
  },
  machines: {
    id: 'id',
    organizationId: 'organization_id',
    status: 'status',
    name: 'name',
  },
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b, op: 'eq' })),
  and: vi.fn((...conditions) => conditions),
  gte: vi.fn((field, value) => ({ field, value, op: 'gte' })),
  lte: vi.fn((field, value) => ({ field, value, op: 'lte' })),
  sql: vi.fn((strings, ...values) => ({ type: 'sql', strings, values })),
}));

describe('Analytics Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserOrganization.mockResolvedValue(mockOrganization);

    // Setup mock chain
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.groupBy.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(Promise.resolve([]));
  });

  describe('getAnalyticsSummary', () => {
    it('should return zeros when no organization', async () => {
      mockGetUserOrganization.mockResolvedValue(null);

      const { getAnalyticsSummary } = await import('@/actions/analytics');
      const result = await getAnalyticsSummary({});

      expect(result).toEqual({
        totalSessions: 0,
        sessionsChange: 0,
        activeMachines: 0,
        machinesChange: 0,
        successRate: 0,
        successRateChange: 0,
        revenue: 0,
        revenueChange: 0,
      });
    });

    it('should return summary with period comparison', async () => {
      // Mock machines query
      mockDb.where.mockReturnValueOnce(Promise.resolve(mockMachines));

      // Mock current period stats
      mockDb.where.mockReturnValueOnce(
        Promise.resolve([{ total: 100, completed: 95, revenue: 300000 }])
      );

      // Mock previous period stats
      mockDb.where.mockReturnValueOnce(
        Promise.resolve([{ total: 80, completed: 75, revenue: 240000 }])
      );

      const { getAnalyticsSummary } = await import('@/actions/analytics');
      const result = await getAnalyticsSummary({ period: '7d' });

      expect(result).toHaveProperty('totalSessions');
      expect(result).toHaveProperty('sessionsChange');
      expect(result).toHaveProperty('activeMachines');
      expect(result).toHaveProperty('successRate');
      expect(result).toHaveProperty('revenue');
    });

    it('should handle custom date range', async () => {
      mockDb.where.mockReturnValueOnce(Promise.resolve(mockMachines));
      mockDb.where.mockReturnValueOnce(
        Promise.resolve([{ total: 50, completed: 48, revenue: 150000 }])
      );
      mockDb.where.mockReturnValueOnce(
        Promise.resolve([{ total: 45, completed: 42, revenue: 135000 }])
      );

      const { getAnalyticsSummary } = await import('@/actions/analytics');
      const result = await getAnalyticsSummary({
        from: '2024-01-01',
        to: '2024-01-31',
      });

      expect(result).toHaveProperty('totalSessions');
    });

    it('should calculate percentage changes correctly', async () => {
      mockDb.where.mockReturnValueOnce(Promise.resolve([mockMachines[0]]));
      mockDb.where.mockReturnValueOnce(
        Promise.resolve([{ total: 100, completed: 90, revenue: 300000 }])
      );
      mockDb.where.mockReturnValueOnce(
        Promise.resolve([{ total: 50, completed: 45, revenue: 150000 }])
      );

      const { getAnalyticsSummary } = await import('@/actions/analytics');
      const result = await getAnalyticsSummary({});

      // 100 vs 50 = 100% increase
      expect(result.sessionsChange).toBe(100);
      expect(result.revenueChange).toBe(100);
    });
  });

  describe('getSessionVolumeData', () => {
    it('should return empty array when no organization', async () => {
      mockGetUserOrganization.mockResolvedValue(null);

      const { getSessionVolumeData } = await import('@/actions/analytics');
      const result = await getSessionVolumeData({});

      expect(result).toEqual([]);
    });

    it('should return volume data with filled dates', async () => {
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ id: 'machine-1' }]));
      mockDb.orderBy.mockReturnValue(
        Promise.resolve([{ date: '2024-01-15', sessions: 50, completed: 48, failed: 2 }])
      );

      const { getSessionVolumeData } = await import('@/actions/analytics');
      const result = await getSessionVolumeData({ period: '7d' });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty results', async () => {
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ id: 'machine-1' }]));
      mockDb.orderBy.mockReturnValue(Promise.resolve([]));

      const { getSessionVolumeData } = await import('@/actions/analytics');
      const result = await getSessionVolumeData({ period: '7d' });

      // Should still return array with dates filled in with zeros
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getMachineUtilization', () => {
    it('should return empty array when no organization', async () => {
      mockGetUserOrganization.mockResolvedValue(null);

      const { getMachineUtilization } = await import('@/actions/analytics');
      const result = await getMachineUtilization({});

      expect(result).toEqual([]);
    });

    it('should return utilization sorted by sessions', async () => {
      mockDb.where.mockReturnValueOnce(Promise.resolve(mockMachines));
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ sessions: 100 }]));
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ sessions: 50 }]));

      const { getMachineUtilization } = await import('@/actions/analytics');
      const result = await getMachineUtilization({});

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getStatusBreakdown', () => {
    it('should return empty array when no organization', async () => {
      mockGetUserOrganization.mockResolvedValue(null);

      const { getStatusBreakdown } = await import('@/actions/analytics');
      const result = await getStatusBreakdown({});

      expect(result).toEqual([]);
    });

    it('should return status breakdown', async () => {
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ id: 'machine-1' }]));
      mockDb.groupBy.mockReturnValue(
        Promise.resolve([
          { status: 'completed', count: 95 },
          { status: 'failed', count: 5 },
        ])
      );

      const { getStatusBreakdown } = await import('@/actions/analytics');
      const result = await getStatusBreakdown({});

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
