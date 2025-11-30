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
  machines: {
    organizationId: 'organization_id',
    status: 'status',
    name: 'name',
    lastHeartbeat: 'last_heartbeat',
    id: 'id',
  },
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b, op: 'eq' })),
  and: vi.fn((...conditions) => conditions),
  like: vi.fn((field, pattern) => ({ field, pattern, op: 'like' })),
  desc: vi.fn((field) => ({ field, order: 'desc' })),
}));

describe('Machine Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserOrganization.mockResolvedValue(mockOrganization);

    // Setup mock chain for getMachines
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(Promise.resolve(mockMachines));
  });

  describe('getMachines', () => {
    it('should return empty array when no organization', async () => {
      mockGetUserOrganization.mockResolvedValue(null);

      // Import here to use fresh mocks
      const { getMachines } = await import('@/actions/machines');
      const result = await getMachines();

      expect(result).toEqual([]);
    });

    it('should return machines for organization', async () => {
      const { getMachines } = await import('@/actions/machines');
      const result = await getMachines();

      expect(result).toEqual(mockMachines);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      const { getMachines } = await import('@/actions/machines');
      await getMachines({ status: 'online' });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should filter by search query', async () => {
      const { getMachines } = await import('@/actions/machines');
      await getMachines({ q: 'Seoul' });

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('getMachine', () => {
    beforeEach(() => {
      mockDb.limit.mockReturnValue(Promise.resolve([mockMachines[0]]));
    });

    it('should return null when no organization', async () => {
      mockGetUserOrganization.mockResolvedValue(null);

      const { getMachine } = await import('@/actions/machines');
      const result = await getMachine('machine-1');

      expect(result).toBeNull();
    });

    it('should return machine by id', async () => {
      const { getMachine } = await import('@/actions/machines');
      const result = await getMachine('machine-1');

      expect(result).toEqual(mockMachines[0]);
    });

    it('should return null when machine not found', async () => {
      mockDb.limit.mockReturnValue(Promise.resolve([]));

      const { getMachine } = await import('@/actions/machines');
      const result = await getMachine('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('registerMachine', () => {
    beforeEach(() => {
      mockDb.insert.mockReturnValue(mockDb);
      mockDb.values.mockReturnValue(mockDb);
      mockDb.returning.mockReturnValue(Promise.resolve([mockMachines[0]]));
    });

    it('should throw when no organization', async () => {
      mockGetUserOrganization.mockResolvedValue(null);

      const { registerMachine } = await import('@/actions/machines');

      await expect(registerMachine({ hardwareId: 'hw-123', name: 'New Machine' })).rejects.toThrow(
        'Unauthorized'
      );
    });

    it('should create and return new machine', async () => {
      const { registerMachine } = await import('@/actions/machines');
      const result = await registerMachine({
        hardwareId: 'hw-123',
        name: 'New Machine',
      });

      expect(result).toEqual(mockMachines[0]);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('updateMachine', () => {
    beforeEach(() => {
      mockDb.update.mockReturnValue(mockDb);
      mockDb.set.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.returning.mockReturnValue(Promise.resolve([{ ...mockMachines[0], name: 'Updated' }]));
    });

    it('should throw when no organization', async () => {
      mockGetUserOrganization.mockResolvedValue(null);

      const { updateMachine } = await import('@/actions/machines');

      await expect(updateMachine('machine-1', { name: 'Updated' })).rejects.toThrow('Unauthorized');
    });

    it('should update and return machine', async () => {
      const { updateMachine } = await import('@/actions/machines');
      const result = await updateMachine('machine-1', { name: 'Updated' });

      expect(result).toHaveProperty('name', 'Updated');
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('deleteMachine', () => {
    beforeEach(() => {
      mockDb.delete.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(Promise.resolve(undefined));
    });

    it('should throw when no organization', async () => {
      mockGetUserOrganization.mockResolvedValue(null);

      const { deleteMachine } = await import('@/actions/machines');

      await expect(deleteMachine('machine-1')).rejects.toThrow('Unauthorized');
    });

    it('should delete machine', async () => {
      const { deleteMachine } = await import('@/actions/machines');
      await deleteMachine('machine-1');

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
