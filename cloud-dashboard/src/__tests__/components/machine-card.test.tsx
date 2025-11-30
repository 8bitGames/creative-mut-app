import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MachineCard } from '@/components/machines/machine-card';
import type { Machine } from '@/lib/db/types';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock Phosphor icons
vi.mock('@phosphor-icons/react', () => ({
  Camera: ({ className }: { className?: string }) => (
    <span data-testid="camera-icon" className={className} />
  ),
  Printer: ({ className }: { className?: string }) => (
    <span data-testid="printer-icon" className={className} />
  ),
  CreditCard: ({ className }: { className?: string }) => (
    <span data-testid="card-icon" className={className} />
  ),
  Thermometer: () => <span data-testid="temp-icon" />,
  Gear: () => <span data-testid="gear-icon" />,
}));

const createMockMachine = (overrides: Partial<Machine> = {}): Machine => ({
  id: 'test-machine-1',
  organizationId: 'org-1',
  hardwareId: 'hw-001',
  name: 'Test Booth',
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
  ...overrides,
});

describe('MachineCard', () => {
  it('should render machine name', () => {
    const machine = createMockMachine({ name: 'Seoul Booth 1' });
    render(<MachineCard machine={machine} />);

    expect(screen.getByText('Seoul Booth 1')).toBeInTheDocument();
  });

  it('should render "Unnamed Machine" when name is null', () => {
    const machine = createMockMachine({ name: null });
    render(<MachineCard machine={machine} />);

    expect(screen.getByText('Unnamed Machine')).toBeInTheDocument();
  });

  it('should display online status with green badge', () => {
    const machine = createMockMachine({ status: 'online' });
    render(<MachineCard machine={machine} />);

    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('should display offline status', () => {
    const machine = createMockMachine({ status: 'offline' });
    render(<MachineCard machine={machine} />);

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('should display error status', () => {
    const machine = createMockMachine({ status: 'error' });
    render(<MachineCard machine={machine} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('should display busy status', () => {
    const machine = createMockMachine({ status: 'busy' });
    render(<MachineCard machine={machine} />);

    expect(screen.getByText('Busy')).toBeInTheDocument();
  });

  it('should display maintenance status', () => {
    const machine = createMockMachine({ status: 'maintenance' });
    render(<MachineCard machine={machine} />);

    expect(screen.getByText('Maintenance')).toBeInTheDocument();
  });

  it('should render peripheral icons', () => {
    const machine = createMockMachine();
    render(<MachineCard machine={machine} />);

    expect(screen.getByTestId('camera-icon')).toBeInTheDocument();
    expect(screen.getByTestId('printer-icon')).toBeInTheDocument();
    expect(screen.getByTestId('card-icon')).toBeInTheDocument();
  });

  it('should display temperature when available', () => {
    const machine = createMockMachine({
      hardwareInfo: { temperature: 42 },
    });
    render(<MachineCard machine={machine} />);

    expect(screen.getByText('42C')).toBeInTheDocument();
  });

  it('should not display temperature when not available', () => {
    const machine = createMockMachine({
      hardwareInfo: null,
    });
    render(<MachineCard machine={machine} />);

    expect(screen.queryByTestId('temp-icon')).not.toBeInTheDocument();
  });

  it('should render Details link with correct href', () => {
    const machine = createMockMachine({ id: 'machine-123' });
    render(<MachineCard machine={machine} />);

    const detailsLink = screen.getByText('Details').closest('a');
    expect(detailsLink).toHaveAttribute('href', '/machines/machine-123');
  });

  it('should render Settings link', () => {
    const machine = createMockMachine({ id: 'machine-123' });
    render(<MachineCard machine={machine} />);

    const settingsLink = screen.getByTestId('gear-icon').closest('a');
    expect(settingsLink).toHaveAttribute('href', '/machines/machine-123/settings');
  });

  it('should display session stats placeholder', () => {
    const machine = createMockMachine();
    render(<MachineCard machine={machine} />);

    expect(screen.getByText('Today:')).toBeInTheDocument();
    expect(screen.getByText('Revenue:')).toBeInTheDocument();
  });

  it('should handle null peripheral status', () => {
    const machine = createMockMachine({
      peripheralStatus: null,
    });

    // Should not throw
    expect(() => render(<MachineCard machine={machine} />)).not.toThrow();
  });
});
