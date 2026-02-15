import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@/test/utils/render';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';

describe('CurrentTimeIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-07-22T14:30:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders for today', () => {
    const today = new Date('2025-07-22');
    render(
      <CurrentTimeIndicator date={today} workingHoursStart={0} workingHoursEnd={24} />
    );
    expect(screen.getByTestId('current-time-indicator')).toBeInTheDocument();
  });

  it('does not render for non-today dates', () => {
    const notToday = new Date('2025-07-23');
    const { container } = render(
      <CurrentTimeIndicator date={notToday} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('has accessible time label', () => {
    const today = new Date('2025-07-22');
    render(
      <CurrentTimeIndicator date={today} workingHoursStart={0} workingHoursEnd={24} />
    );
    expect(screen.getByLabelText(/Current time: 14:30/)).toBeInTheDocument();
  });

  it('positions based on current time', () => {
    const today = new Date('2025-07-22');
    render(
      <CurrentTimeIndicator date={today} workingHoursStart={0} workingHoursEnd={24} />
    );
    const indicator = screen.getByTestId('current-time-indicator');
    const top = parseFloat(indicator.style.top);
    // 14:30 should be around 60% of 24 hours
    expect(top).toBeGreaterThan(50);
    expect(top).toBeLessThan(70);
  });

  it('adjusts position for working hours range', () => {
    const today = new Date('2025-07-22');
    render(
      <CurrentTimeIndicator date={today} workingHoursStart={8} workingHoursEnd={18} />
    );
    const indicator = screen.getByTestId('current-time-indicator');
    const top = parseFloat(indicator.style.top);
    // 14:30 in 8-18 range: (14.5 - 8) / (18 - 8) = 65%
    expect(top).toBeGreaterThan(60);
    expect(top).toBeLessThan(70);
  });

  it('is non-interactive (pointer-events-none)', () => {
    const today = new Date('2025-07-22');
    render(
      <CurrentTimeIndicator date={today} workingHoursStart={0} workingHoursEnd={24} />
    );
    const indicator = screen.getByTestId('current-time-indicator');
    expect(indicator.className).toContain('pointer-events-none');
  });

  it('includes red dot and line', () => {
    const today = new Date('2025-07-22');
    render(
      <CurrentTimeIndicator date={today} workingHoursStart={0} workingHoursEnd={24} />
    );
    const indicator = screen.getByTestId('current-time-indicator');
    const dot = indicator.querySelector('.bg-red-500.rounded-full');
    const line = indicator.querySelector('.bg-red-500:not(.rounded-full)');
    expect(dot).toBeTruthy();
    expect(line).toBeTruthy();
  });
});
