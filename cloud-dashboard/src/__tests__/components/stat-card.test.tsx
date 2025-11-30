import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatCard } from '@/components/analytics/stat-card';

// Mock Phosphor icons from SSR path
vi.mock('@phosphor-icons/react/dist/ssr', () => ({
  TrendUp: () => <span data-testid="trend-up-icon" />,
  TrendDown: () => <span data-testid="trend-down-icon" />,
  Minus: () => <span data-testid="minus-icon" />,
}));

// Mock icon component for tests
const MockIcon = ({ size, className }: { size?: number; className?: string }) => (
  <span data-testid="mock-icon" className={className} data-size={size} />
);

describe('StatCard', () => {
  it('should render title', () => {
    render(<StatCard title="Total Sessions" value="1,234" />);

    expect(screen.getByText('Total Sessions')).toBeInTheDocument();
  });

  it('should render value', () => {
    render(<StatCard title="Total Sessions" value="1,234" />);

    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('should render string value as-is', () => {
    render(<StatCard title="Revenue" value="₩50,000" />);

    expect(screen.getByText('₩50,000')).toBeInTheDocument();
  });

  it('should show positive change with trend up icon', () => {
    render(<StatCard title="Sessions" value="100" change={15} />);

    expect(screen.getByTestId('trend-up-icon')).toBeInTheDocument();
    expect(screen.getByText(/\+15.*%/)).toBeInTheDocument();
  });

  it('should show negative change with trend down icon', () => {
    render(<StatCard title="Sessions" value="100" change={-10} />);

    expect(screen.getByTestId('trend-down-icon')).toBeInTheDocument();
    expect(screen.getByText(/-10.*%/)).toBeInTheDocument();
  });

  it('should show zero change with neutral styling', () => {
    render(<StatCard title="Sessions" value="100" change={0} />);

    // Zero change shows 0% - text may be split across elements
    expect(screen.getByText(/0.*%/)).toBeInTheDocument();
  });

  it('should render custom icon when provided', () => {
    render(<StatCard title="Machines" value="10" icon={MockIcon} />);

    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
  });

  it('should not render icon area when icon not provided', () => {
    render(<StatCard title="Sessions" value="100" />);

    expect(screen.queryByTestId('mock-icon')).not.toBeInTheDocument();
  });

  it('should show default change label', () => {
    render(<StatCard title="Sessions" value="100" change={5} />);

    expect(screen.getByText('vs last period')).toBeInTheDocument();
  });

  it('should show custom change label', () => {
    render(<StatCard title="Sessions" value="100" change={5} changeLabel="vs last week" />);

    expect(screen.getByText('vs last week')).toBeInTheDocument();
  });

  it('should not render change section when change is undefined', () => {
    render(<StatCard title="Sessions" value="100" />);

    expect(screen.queryByText('vs last period')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trend-up-icon')).not.toBeInTheDocument();
  });

  it('should apply green color for positive changes', () => {
    const { container } = render(<StatCard title="Sessions" value="100" change={15} />);

    const changeElement = container.querySelector('.text-green-600');
    expect(changeElement).toBeInTheDocument();
  });

  it('should apply red color for negative changes', () => {
    const { container } = render(<StatCard title="Sessions" value="100" change={-10} />);

    const changeElement = container.querySelector('.text-red-600');
    expect(changeElement).toBeInTheDocument();
  });

  it('should apply gray color for zero change', () => {
    const { container } = render(<StatCard title="Sessions" value="100" change={0} />);

    const changeElement = container.querySelector('.text-gray-500');
    expect(changeElement).toBeInTheDocument();
  });
});
