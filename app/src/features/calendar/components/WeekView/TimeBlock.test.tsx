import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/render';
import { TimeBlock } from './TimeBlock';
import type { CalendarEvent } from '../../types';

const baseEvent: CalendarEvent = {
  id: 'time-1',
  sourceId: 'te-1',
  source: 'time_entry',
  type: 'time_block',
  title: 'Coding Session',
  startDate: '2025-07-22T09:00:00Z',
  endDate: '2025-07-22T11:30:00Z',
  isAllDay: false,
  durationMinutes: 150,
  color: 'bg-emerald-500',
  icon: 'Clock',
};

const shortEvent: CalendarEvent = {
  ...baseEvent,
  id: 'short-1',
  title: 'Quick Check',
  durationMinutes: 15,
  endDate: '2025-07-22T09:15:00Z',
};

const runningEvent: CalendarEvent = {
  ...baseEvent,
  id: 'running-1',
  title: 'Active Timer',
  isRunning: true,
};

const completedEvent: CalendarEvent = {
  ...baseEvent,
  id: 'completed-1',
  title: 'Done Task',
  isCompleted: true,
};

describe('TimeBlock', () => {
  it('renders as a button', () => {
    render(<TimeBlock event={baseEvent} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows event title', () => {
    render(<TimeBlock event={baseEvent} />);
    expect(screen.getByText('Coding Session')).toBeInTheDocument();
  });

  it('has title attribute', () => {
    render(<TimeBlock event={baseEvent} />);
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Coding Session');
  });

  it('has accessible label with time info', () => {
    render(<TimeBlock event={baseEvent} />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Coding Session')
    );
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const { user } = render(<TimeBlock event={baseEvent} onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(baseEvent);
  });

  it('applies absolute positioning', () => {
    render(<TimeBlock event={baseEvent} />);
    const btn = screen.getByRole('button');
    expect(btn.style.top).toBeTruthy();
    expect(btn.style.height).toBeTruthy();
  });

  it('uses source-specific colors', () => {
    render(<TimeBlock event={baseEvent} />);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-emerald-500/10');
    expect(btn.className).toContain('border-emerald-500');
  });

  it('shows time range for events >= 30 minutes', () => {
    render(<TimeBlock event={baseEvent} />);
    // Should show time range text
    expect(screen.getByText(/09:00/)).toBeInTheDocument();
  });

  it('shows duration for events >= 45 minutes', () => {
    render(<TimeBlock event={baseEvent} />);
    expect(screen.getByText('2h 30m')).toBeInTheDocument();
  });

  it('does not show time range for very short events', () => {
    render(<TimeBlock event={shortEvent} />);
    expect(screen.queryByText(/–/)).not.toBeInTheDocument();
  });

  it('applies opacity for completed events', () => {
    render(<TimeBlock event={completedEvent} />);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('opacity-50');
  });

  it('applies pulse animation for running events', () => {
    render(<TimeBlock event={runningEvent} />);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('animate-pulse');
  });

  it('adjusts width for overlapping events', () => {
    render(<TimeBlock event={baseEvent} columnIndex={0} totalColumns={2} />);
    const btn = screen.getByRole('button');
    expect(btn.style.width).toBe('50%');
    expect(btn.style.left).toBe('0%');
  });

  it('offsets position for second column', () => {
    render(<TimeBlock event={baseEvent} columnIndex={1} totalColumns={2} />);
    const btn = screen.getByRole('button');
    expect(btn.style.left).toBe('50%');
  });

  it('uses full width for single event', () => {
    render(<TimeBlock event={baseEvent} columnIndex={0} totalColumns={1} />);
    const btn = screen.getByRole('button');
    expect(btn.style.width).toBe('100%');
  });

  it('respects working hours for positioning', () => {
    const { rerender } = render(
      <TimeBlock event={baseEvent} workingHoursStart={0} workingHoursEnd={24} />
    );
    const btn1 = screen.getByRole('button');
    const top1 = parseFloat(btn1.style.top);

    rerender(
      <TimeBlock event={baseEvent} workingHoursStart={8} workingHoursEnd={18} />
    );
    const btn2 = screen.getByRole('button');
    const top2 = parseFloat(btn2.style.top);

    // Position should be different with different working hours
    expect(top1).not.toBe(top2);
  });
});
