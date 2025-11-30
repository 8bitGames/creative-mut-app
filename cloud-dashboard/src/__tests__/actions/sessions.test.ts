import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDb, mockOrganization, mockSessions } from '../mocks/db';

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
    sessionCode: 'session_code',
    startedAt: 'started_at',
    id: 'id',
  },
  machines: {
    id: 'id',
    organizationId: 'organization_id',
  },
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b, op: 'eq' })),
  and: vi.fn((...conditions) => conditions),
  or: vi.fn((...conditions) => conditions),
  like: vi.fn((field, pattern) => ({ field, pattern, op: 'like' })),
  desc: vi.fn((field) => ({ field, order: 'desc' })),
  gte: vi.fn((field, value) => ({ field, value, op: 'gte' })),
  lte: vi.fn((field, value) => ({ field, value, op: 'lte' })),
  sql: vi.fn((strings, ...values) => ({ type: 'sql', strings, values })),
}));

describe('Session Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserOrganization.mockResolvedValue(mockOrganization);

    // Setup mock chain
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.innerJoin.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(mockDb);
    mockDb.limit.mockReturnValue(mockDb);
    mockDb.offset.mockReturnValue(Promise.resolve(mockSessions));
    mockDb.groupBy.mockReturnValue(Promise.resolve([]));
  });

  describe('getSessions', () => {
    it('should return empty when no organization', async () => {
      mockGetUserOrganization.mockResolvedValue(null);

      const { getSessions } = await import('@/actions/sessions');
      const result = await getSessions();

      expect(result).toEqual({ sessions: [], total: 0 });
    });

    it('should return sessions for organization machines', async () => {
      // Mock machines query
      const machinesQuery = Promise.resolve([{ id: 'machine-1' }]);
      mockDb.where.mockReturnValueOnce(machinesQuery);

      // Mock count query
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ count: 10 }]));

      // Mock sessions query
      mockDb.offset.mockReturnValue(Promise.resolve(mockSessions));

      const { getSessions } = await import('@/actions/sessions');
      const result = await getSessions();

      expect(result).toHaveProperty('sessions');
      expect(result).toHaveProperty('total');
    });

    it('should handle pagination with cursor', async () => {
      // Mock machines query
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ id: 'machine-1' }]));

      // Mock count query
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ count: 50 }]));

      // Mock sessions query with extra item for hasMore
      mockDb.offset.mockReturnValue(Promise.resolve([...mockSessions, mockSessions[0]]));

      const { getSessions } = await import('@/actions/sessions');
      const result = await getSessions({ cursor: '20', limit: 2 });

      expect(result).toHaveProperty('nextCursor');
      expect(result).toHaveProperty('prevCursor');
    });

    it('should filter by status', async () => {
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ id: 'machine-1' }]));
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ count: 5 }]));
      mockDb.offset.mockReturnValue(Promise.resolve(mockSessions));

      const { getSessions } = await import('@/actions/sessions');
      await getSessions({ status: 'completed' });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should filter by date range', async () => {
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ id: 'machine-1' }]));
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ count: 3 }]));
      mockDb.offset.mockReturnValue(Promise.resolve(mockSessions));

      const { getSessions } = await import('@/actions/sessions');
      await getSessions({
        from: '2024-01-01',
        to: '2024-01-31',
      });

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    it('should return null when no organization', async () => {
      mockGetUserOrganization.mockResolvedValue(null);

      const { getSession } = await import('@/actions/sessions');
      const result = await getSession('session-1');

      expect(result).toBeNull();
    });

    it('should return session by id', async () => {
      mockDb.limit.mockReturnValue(Promise.resolve([{ sessions: mockSessions[0] }]));

      const { getSession } = await import('@/actions/sessions');
      const result = await getSession('session-1');

      expect(result).toEqual(mockSessions[0]);
    });

    it('should return null when session not found', async () => {
      mockDb.limit.mockReturnValue(Promise.resolve([]));

      const { getSession } = await import('@/actions/sessions');
      const result = await getSession('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getSessionStats', () => {
    it('should return null when no organization', async () => {
      mockGetUserOrganization.mockResolvedValue(null);

      const { getSessionStats } = await import('@/actions/sessions');
      const result = await getSessionStats();

      expect(result).toBeNull();
    });

    it('should return stats for all machines', async () => {
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ id: 'machine-1' }]));
      mockDb.where.mockReturnValueOnce(
        Promise.resolve([{ count: 100, completed: 95, failed: 5, avgProcessingTime: 5000 }])
      );
      mockDb.where.mockReturnValueOnce(Promise.resolve([{ total: 1000, totalCompleted: 950 }]));

      const { getSessionStats } = await import('@/actions/sessions');
      const result = await getSessionStats();

      expect(result).toHaveProperty('today');
      expect(result).toHaveProperty('allTime');
    });

    it('should filter by machine id', async () => {
      mockDb.where.mockReturnValue(
        Promise.resolve([{ count: 50, completed: 48, failed: 2, avgProcessingTime: 4500 }])
      );

      const { getSessionStats } = await import('@/actions/sessions');
      const result = await getSessionStats('machine-1');

      expect(result).toHaveProperty('today');
    });
  });
});
