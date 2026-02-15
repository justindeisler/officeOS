import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/render';
import { CalendarToolbar } from './CalendarToolbar';
import type { CalendarViewMode } from '../types';

const defaultProps = {
  selectedDate: new Date('2025-07-22'),
  viewMode: 'month' as CalendarViewMode,
  weekStartsOn: 1 as const,
  onViewModeChange: vi.fn(),
  onNavigateForward: vi.fn(),
  onNavigateBackward: vi.fn(),
  onGoToToday: vi.fn(),
};

describe('CalendarToolbar', () => {
  it('renders as a toolbar', () => {
    render(<CalendarToolbar {...defaultProps} />);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<CalendarToolbar {...defaultProps} />);
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', 'Calendar navigation');
  });

  describe('date header', () => {
    it('shows month and year in month view', () => {
      render(<CalendarToolbar {...defaultProps} />);
      expect(screen.getByText('July 2025')).toBeInTheDocument();
    });

    it('shows date range in week view', () => {
      render(<CalendarToolbar {...defaultProps} viewMode="week" />);
      // Should show a date range like "Jul 21 – 27, 2025"
      expect(screen.getByText(/Jul.*2025/)).toBeInTheDocument();
    });

    it('shows full date in day view', () => {
      render(<CalendarToolbar {...defaultProps} viewMode="day" />);
      expect(screen.getByText(/Tuesday, July 22, 2025/)).toBeInTheDocument();
    });

    it('shows date range in agenda view', () => {
      render(<CalendarToolbar {...defaultProps} viewMode="agenda" />);
      expect(screen.getByText(/Jul 22.*Aug 4, 2025/)).toBeInTheDocument();
    });

    it('has aria-live for screen readers', () => {
      render(<CalendarToolbar {...defaultProps} />);
      const header = screen.getByText('July 2025');
      expect(header).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('navigation buttons', () => {
    it('has a Today button', () => {
      render(<CalendarToolbar {...defaultProps} />);
      expect(screen.getByLabelText('Go to today')).toBeInTheDocument();
    });

    it('calls onGoToToday when Today clicked', async () => {
      const onGoToToday = vi.fn();
      const { user } = render(<CalendarToolbar {...defaultProps} onGoToToday={onGoToToday} />);
      await user.click(screen.getByLabelText('Go to today'));
      expect(onGoToToday).toHaveBeenCalled();
    });

    it('has Previous button', () => {
      render(<CalendarToolbar {...defaultProps} />);
      expect(screen.getByLabelText('Previous')).toBeInTheDocument();
    });

    it('calls onNavigateBackward when Previous clicked', async () => {
      const onNav = vi.fn();
      const { user } = render(<CalendarToolbar {...defaultProps} onNavigateBackward={onNav} />);
      await user.click(screen.getByLabelText('Previous'));
      expect(onNav).toHaveBeenCalled();
    });

    it('has Next button', () => {
      render(<CalendarToolbar {...defaultProps} />);
      expect(screen.getByLabelText('Next')).toBeInTheDocument();
    });

    it('calls onNavigateForward when Next clicked', async () => {
      const onNav = vi.fn();
      const { user } = render(<CalendarToolbar {...defaultProps} onNavigateForward={onNav} />);
      await user.click(screen.getByLabelText('Next'));
      expect(onNav).toHaveBeenCalled();
    });
  });

  describe('view mode selector', () => {
    it('renders as a tablist', () => {
      render(<CalendarToolbar {...defaultProps} />);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('shows all view mode options', () => {
      render(<CalendarToolbar {...defaultProps} />);
      expect(screen.getByRole('tab', { name: /Month/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Week/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Day/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Agenda/ })).toBeInTheDocument();
    });

    it('marks active view as selected', () => {
      render(<CalendarToolbar {...defaultProps} viewMode="month" />);
      expect(screen.getByRole('tab', { name: /Month/ })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: /Week/ })).toHaveAttribute('aria-selected', 'false');
    });

    it('calls onViewModeChange when tab clicked', async () => {
      const onChange = vi.fn();
      const { user } = render(<CalendarToolbar {...defaultProps} onViewModeChange={onChange} />);
      await user.click(screen.getByRole('tab', { name: /Week/ }));
      expect(onChange).toHaveBeenCalledWith('week');
    });

    it('highlights active view with primary color', () => {
      render(<CalendarToolbar {...defaultProps} viewMode="week" />);
      const weekTab = screen.getByRole('tab', { name: /Week/ });
      expect(weekTab.className).toContain('bg-primary');
    });

    it('styles inactive views with muted color', () => {
      render(<CalendarToolbar {...defaultProps} viewMode="month" />);
      const weekTab = screen.getByRole('tab', { name: /Week/ });
      expect(weekTab.className).toContain('text-muted-foreground');
    });
  });
});
