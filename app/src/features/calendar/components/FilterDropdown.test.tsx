import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/render';
import { FilterDropdown } from './FilterDropdown';
import { DEFAULT_FILTERS } from '../types';
import type { CalendarFilters } from '../types';

const defaultProps = {
  filters: { ...DEFAULT_FILTERS },
  onFilterChange: vi.fn(),
};

describe('FilterDropdown', () => {
  it('renders filter button', () => {
    render(<FilterDropdown {...defaultProps} />);
    expect(screen.getByLabelText('Filter events')).toBeInTheDocument();
  });

  it('shows Filter text on desktop', () => {
    render(<FilterDropdown {...defaultProps} />);
    expect(screen.getByText('Filter')).toBeInTheDocument();
  });

  describe('closed state', () => {
    it('does not show dropdown', () => {
      render(<FilterDropdown {...defaultProps} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not show filter count with default filters', () => {
      render(<FilterDropdown {...defaultProps} />);
      // No badge should be visible
      const btn = screen.getByLabelText('Filter events');
      expect(btn.className).not.toContain('border-primary');
    });
  });

  describe('open state', () => {
    it('opens dropdown when clicked', async () => {
      const { user } = render(<FilterDropdown {...defaultProps} />);
      await user.click(screen.getByLabelText('Filter events'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows source options', async () => {
      const { user } = render(<FilterDropdown {...defaultProps} />);
      await user.click(screen.getByLabelText('Filter events'));
      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('Time Entries')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Invoices')).toBeInTheDocument();
      expect(screen.getByText('Social Posts')).toBeInTheDocument();
      expect(screen.getByText('Automations')).toBeInTheDocument();
      expect(screen.getByText('Agent Activity')).toBeInTheDocument();
    });

    it('shows completed toggle', async () => {
      const { user } = render(<FilterDropdown {...defaultProps} />);
      await user.click(screen.getByLabelText('Filter events'));
      expect(screen.getByText('Show completed')).toBeInTheDocument();
    });

    it('closes when backdrop clicked', async () => {
      const { user } = render(<FilterDropdown {...defaultProps} />);
      await user.click(screen.getByLabelText('Filter events'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.click(screen.getByTestId('filter-backdrop'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('source toggling', () => {
    it('calls onFilterChange when source unchecked', async () => {
      const onChange = vi.fn();
      const { user } = render(
        <FilterDropdown filters={DEFAULT_FILTERS} onFilterChange={onChange} />
      );
      await user.click(screen.getByLabelText('Filter events'));

      // Find the Tasks checkbox and uncheck it
      const tasksCheckbox = screen.getByLabelText('Tasks') as HTMLInputElement;
      expect(tasksCheckbox).toBeInTheDocument();
    });

    it('all sources are checked by default', async () => {
      const { user } = render(<FilterDropdown {...defaultProps} />);
      await user.click(screen.getByLabelText('Filter events'));

      const checkboxes = screen.getAllByRole('checkbox');
      // All source checkboxes + completed checkbox should be checked
      checkboxes.forEach(cb => {
        expect(cb).toBeChecked();
      });
    });
  });

  describe('active filter indicator', () => {
    it('shows badge when sources are filtered', () => {
      const filteredFilters: CalendarFilters = {
        ...DEFAULT_FILTERS,
        sources: ['task', 'time_entry'], // Only 2 of 9
      };
      render(<FilterDropdown filters={filteredFilters} onFilterChange={vi.fn()} />);
      const btn = screen.getByLabelText('Filter events');
      expect(btn.className).toContain('border-primary');
    });

    it('shows badge when completed is hidden', () => {
      const filteredFilters: CalendarFilters = {
        ...DEFAULT_FILTERS,
        showCompleted: false,
      };
      render(<FilterDropdown filters={filteredFilters} onFilterChange={vi.fn()} />);
      const btn = screen.getByLabelText('Filter events');
      expect(btn.className).toContain('border-primary');
    });
  });

  it('has aria-expanded attribute', async () => {
    const { user } = render(<FilterDropdown {...defaultProps} />);
    const btn = screen.getByLabelText('Filter events');
    expect(btn).toHaveAttribute('aria-expanded', 'false');

    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });
});
