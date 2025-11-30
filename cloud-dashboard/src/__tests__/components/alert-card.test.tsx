import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertCard } from '@/components/alerts/alert-card';
import type { Alert } from '@/lib/db/types';

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '5 minutes ago'),
}));

// Mock Phosphor icons
vi.mock('@phosphor-icons/react', () => ({
  Warning: ({ className }: { className?: string }) => (
    <span data-testid="warning-icon" className={className} />
  ),
  WarningCircle: ({ className }: { className?: string }) => (
    <span data-testid="warning-circle-icon" className={className} />
  ),
  Info: ({ className }: { className?: string }) => (
    <span data-testid="info-icon" className={className} />
  ),
  XCircle: ({ className }: { className?: string }) => (
    <span data-testid="x-circle-icon" className={className} />
  ),
  Check: () => <span data-testid="check-icon" />,
  CheckCircle: () => <span data-testid="check-circle-icon" />,
}));

// Mock alert actions
const mockAcknowledgeAlert = vi.fn();
const mockResolveAlert = vi.fn();
vi.mock('@/actions/alerts', () => ({
  acknowledgeAlert: (...args: unknown[]) => mockAcknowledgeAlert(...args),
  resolveAlert: (...args: unknown[]) => mockResolveAlert(...args),
}));

const createMockAlert = (overrides: Partial<Alert> = {}): Alert => ({
  id: 'alert-1',
  machineId: 'machine-1',
  severity: 'warning',
  type: 'system',
  title: 'Test Alert',
  message: 'This is a test alert message',
  acknowledged: false,
  acknowledgedAt: null,
  acknowledgedBy: null,
  resolved: false,
  resolvedAt: null,
  metadata: {},
  createdAt: new Date(),
  ...overrides,
});

describe('AlertCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render alert title', () => {
      const alert = createMockAlert({ title: 'Camera Disconnected' });
      render(<AlertCard alert={alert} />);

      expect(screen.getByText('Camera Disconnected')).toBeInTheDocument();
    });

    it('should render alert message', () => {
      const alert = createMockAlert({ message: 'Connection lost to camera' });
      render(<AlertCard alert={alert} />);

      expect(screen.getByText('Connection lost to camera')).toBeInTheDocument();
    });

    it('should render alert type', () => {
      const alert = createMockAlert({ type: 'hardware' });
      render(<AlertCard alert={alert} />);

      expect(screen.getByText('Type: hardware')).toBeInTheDocument();
    });

    it('should render relative time', () => {
      const alert = createMockAlert();
      render(<AlertCard alert={alert} />);

      expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
    });

    it('should not render message when null', () => {
      const alert = createMockAlert({ message: null });
      render(<AlertCard alert={alert} />);

      expect(screen.queryByText('Connection lost')).not.toBeInTheDocument();
    });
  });

  describe('severity display', () => {
    it('should display info severity with info icon', () => {
      const alert = createMockAlert({ severity: 'info' });
      render(<AlertCard alert={alert} />);

      expect(screen.getByTestId('info-icon')).toBeInTheDocument();
      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('should display warning severity', () => {
      const alert = createMockAlert({ severity: 'warning' });
      render(<AlertCard alert={alert} />);

      expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('should display error severity', () => {
      const alert = createMockAlert({ severity: 'error' });
      render(<AlertCard alert={alert} />);

      expect(screen.getByTestId('warning-circle-icon')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('should display critical severity', () => {
      const alert = createMockAlert({ severity: 'critical' });
      render(<AlertCard alert={alert} />);

      expect(screen.getByTestId('x-circle-icon')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('should show Acknowledge button for unacknowledged alerts', () => {
      const alert = createMockAlert({ acknowledged: false, resolved: false });
      render(<AlertCard alert={alert} />);

      expect(screen.getByText('Acknowledge')).toBeInTheDocument();
    });

    it('should hide Acknowledge button for acknowledged alerts', () => {
      const alert = createMockAlert({ acknowledged: true, resolved: false });
      render(<AlertCard alert={alert} />);

      expect(screen.queryByText('Acknowledge')).not.toBeInTheDocument();
    });

    it('should show Resolve button for unresolved alerts', () => {
      const alert = createMockAlert({ resolved: false });
      render(<AlertCard alert={alert} />);

      expect(screen.getByText('Resolve')).toBeInTheDocument();
    });

    it('should hide action buttons for resolved alerts', () => {
      const alert = createMockAlert({ resolved: true });
      render(<AlertCard alert={alert} />);

      expect(screen.queryByText('Acknowledge')).not.toBeInTheDocument();
      expect(screen.queryByText('Resolve')).not.toBeInTheDocument();
    });

    it('should show Resolved badge for resolved alerts', () => {
      const alert = createMockAlert({ resolved: true });
      render(<AlertCard alert={alert} />);

      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call acknowledgeAlert when Acknowledge is clicked', async () => {
      const user = userEvent.setup();
      const alert = createMockAlert({ id: 'alert-123', acknowledged: false });
      render(<AlertCard alert={alert} />);

      await user.click(screen.getByText('Acknowledge'));

      expect(mockAcknowledgeAlert).toHaveBeenCalledWith('alert-123');
    });

    it('should call resolveAlert when Resolve is clicked', async () => {
      const user = userEvent.setup();
      const alert = createMockAlert({ id: 'alert-456', resolved: false });
      render(<AlertCard alert={alert} />);

      await user.click(screen.getByText('Resolve'));

      expect(mockResolveAlert).toHaveBeenCalledWith('alert-456');
    });
  });

  describe('styling', () => {
    it('should apply opacity to resolved alerts', () => {
      const alert = createMockAlert({ resolved: true });
      const { container } = render(<AlertCard alert={alert} />);

      const card = container.querySelector('.opacity-60');
      expect(card).toBeInTheDocument();
    });

    it('should not apply opacity to active alerts', () => {
      const alert = createMockAlert({ resolved: false });
      const { container } = render(<AlertCard alert={alert} />);

      const card = container.querySelector('.opacity-60');
      expect(card).not.toBeInTheDocument();
    });
  });
});
