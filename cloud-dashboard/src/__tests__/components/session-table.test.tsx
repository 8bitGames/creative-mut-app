import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionTable } from '@/components/sessions/session-table';
import type { Session } from '@/lib/db/types';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '10 minutes ago'),
}));

// Mock Phosphor icons
vi.mock('@phosphor-icons/react', () => ({
  DotsThree: () => <span data-testid="dots-icon" />,
  Eye: () => <span data-testid="eye-icon" />,
  Link: () => <span data-testid="link-icon" />,
  Image: () => <span data-testid="image-icon" />,
}));

// Mock clipboard - use defineProperty for readonly properties
const mockWriteText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

const createMockSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  machineId: 'machine-12345678',
  sessionCode: 'ABC123',
  status: 'completed',
  startedAt: new Date(),
  completedAt: new Date(),
  processingTimeMs: 5000,
  frameId: 'frame1',
  photosCount: 4,
  processedVideoUrl: 'https://example.com/video.mp4',
  qrCodeUrl: 'https://example.com/qr.png',
  paymentAmount: 3000,
  paymentStatus: 'success',
  paymentMethod: null,
  paymentTransactionId: null,
  errorCode: null,
  errorMessage: null,
  metadata: {},
  createdAt: new Date(),
  ...overrides,
});

describe('SessionTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty state', () => {
    it('should show empty message when no sessions', () => {
      render(<SessionTable sessions={[]} />);

      expect(screen.getByText('No sessions found')).toBeInTheDocument();
    });
  });

  describe('table rendering', () => {
    it('should render session code', () => {
      const sessions = [createMockSession({ sessionCode: 'XYZ789' })];
      render(<SessionTable sessions={sessions} />);

      expect(screen.getByText('XYZ789')).toBeInTheDocument();
    });

    it('should render status badge', () => {
      const sessions = [createMockSession({ status: 'completed' })];
      render(<SessionTable sessions={sessions} />);

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should render all status types correctly', () => {
      const statuses = ['started', 'capturing', 'processing', 'completed', 'failed', 'cancelled'];

      for (const status of statuses) {
        const sessions = [createMockSession({ status, id: `session-${status}` })];
        const { unmount } = render(<SessionTable sessions={sessions} />);

        const expectedLabel = status.charAt(0).toUpperCase() + status.slice(1);
        // Use getAllByText since "Started" appears in both header and badge
        const elements = screen.getAllByText(expectedLabel);
        expect(elements.length).toBeGreaterThan(0);

        unmount();
      }
    });

    it('should render machine link when showMachine is true', () => {
      const sessions = [createMockSession({ machineId: 'machine-abcd1234' })];
      render(<SessionTable sessions={sessions} showMachine={true} />);

      // The machine ID is truncated, find the link by href
      const machineLink = screen.getByRole('link', { name: /machine-/i });
      expect(machineLink).toHaveAttribute('href', '/machines/machine-abcd1234');
    });

    it('should hide machine column when showMachine is false', () => {
      const sessions = [createMockSession()];
      render(<SessionTable sessions={sessions} showMachine={false} />);

      expect(screen.queryByText('Machine')).not.toBeInTheDocument();
    });

    it('should render frame id', () => {
      const sessions = [createMockSession({ frameId: 'frame2' })];
      render(<SessionTable sessions={sessions} />);

      expect(screen.getByText('frame2')).toBeInTheDocument();
    });

    it('should show dash when frame is null', () => {
      const sessions = [createMockSession({ frameId: null })];
      render(<SessionTable sessions={sessions} />);

      // Table cells with dash for null values
      const dashCells = screen.getAllByText('-');
      expect(dashCells.length).toBeGreaterThan(0);
    });

    it('should render formatted processing time', () => {
      const sessions = [createMockSession({ processingTimeMs: 5500 })];
      render(<SessionTable sessions={sessions} />);

      expect(screen.getByText('5.5s')).toBeInTheDocument();
    });

    it('should show dash when processing time is null', () => {
      const sessions = [createMockSession({ processingTimeMs: null })];
      render(<SessionTable sessions={sessions} />);

      const dashCells = screen.getAllByText('-');
      expect(dashCells.length).toBeGreaterThan(0);
    });

    it('should render relative time', () => {
      const sessions = [createMockSession()];
      render(<SessionTable sessions={sessions} />);

      expect(screen.getByText('10 minutes ago')).toBeInTheDocument();
    });

    it('should render multiple sessions', () => {
      const sessions = [
        createMockSession({ id: 'session-1', sessionCode: 'AAA111' }),
        createMockSession({ id: 'session-2', sessionCode: 'BBB222' }),
        createMockSession({ id: 'session-3', sessionCode: 'CCC333' }),
      ];
      render(<SessionTable sessions={sessions} />);

      expect(screen.getByText('AAA111')).toBeInTheDocument();
      expect(screen.getByText('BBB222')).toBeInTheDocument();
      expect(screen.getByText('CCC333')).toBeInTheDocument();
    });
  });

  describe('table headers', () => {
    it('should render all column headers', () => {
      const sessions = [createMockSession()];
      render(<SessionTable sessions={sessions} />);

      expect(screen.getByText('Session Code')).toBeInTheDocument();
      expect(screen.getByText('Machine')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Frame')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('Started')).toBeInTheDocument();
    });
  });

  describe('actions menu', () => {
    it('should render action button for each row', () => {
      const sessions = [createMockSession()];
      render(<SessionTable sessions={sessions} />);

      expect(screen.getByTestId('dots-icon')).toBeInTheDocument();
    });
  });

  describe('status styling', () => {
    it('should apply correct style for completed status', () => {
      const sessions = [createMockSession({ status: 'completed' })];
      const { container } = render(<SessionTable sessions={sessions} />);

      const badge = container.querySelector('.bg-green-100');
      expect(badge).toBeInTheDocument();
    });

    it('should apply correct style for failed status', () => {
      const sessions = [createMockSession({ status: 'failed' })];
      const { container } = render(<SessionTable sessions={sessions} />);

      const badge = container.querySelector('.bg-red-100');
      expect(badge).toBeInTheDocument();
    });

    it('should apply correct style for processing status', () => {
      const sessions = [createMockSession({ status: 'processing' })];
      const { container } = render(<SessionTable sessions={sessions} />);

      const badge = container.querySelector('.bg-yellow-100');
      expect(badge).toBeInTheDocument();
    });
  });
});
