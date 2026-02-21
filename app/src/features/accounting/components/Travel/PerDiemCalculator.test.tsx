import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { PerDiemCalculator } from './PerDiemCalculator';

describe('PerDiemCalculator', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders absence hours input', () => {
      render(<PerDiemCalculator onChange={mockOnChange} />);
      expect(screen.getByLabelText(/abwesenheitsstunden/i)).toBeInTheDocument();
    });

    it('renders meal checkboxes', () => {
      render(<PerDiemCalculator onChange={mockOnChange} />);
      expect(screen.getByLabelText(/frühstück/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/mittagessen/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/abendessen/i)).toBeInTheDocument();
    });

    it('renders as standalone card by default', () => {
      render(<PerDiemCalculator onChange={mockOnChange} />);
      expect(screen.getByText(/verpflegungsmehraufwand-rechner/i)).toBeInTheDocument();
    });

    it('renders without card wrapper when standalone=false', () => {
      render(<PerDiemCalculator onChange={mockOnChange} standalone={false} />);
      expect(screen.queryByText(/verpflegungsmehraufwand-rechner/i)).not.toBeInTheDocument();
    });

    it('shows deduction amounts next to checkboxes', () => {
      render(<PerDiemCalculator onChange={mockOnChange} />);
      expect(screen.getByText(/-5,60\s*€/i)).toBeInTheDocument();
      // Both lunch and dinner show -11.20
      const deductions = screen.getAllByText(/-11,20\s*€/i);
      expect(deductions.length).toBe(2);
    });

    it('renders with initial hours', () => {
      render(<PerDiemCalculator initialHours={10} onChange={mockOnChange} />);
      const input = screen.getByLabelText(/abwesenheitsstunden/i) as HTMLInputElement;
      expect(input.value).toBe('10');
    });

    it('renders with initial meals', () => {
      render(
        <PerDiemCalculator
          initialMeals={{ breakfast: true, lunch: false, dinner: false }}
          onChange={mockOnChange}
        />
      );
      const breakfast = screen.getByLabelText(/frühstück/i) as HTMLInputElement;
      expect(breakfast).toBeChecked();
    });
  });

  describe('rate calculation', () => {
    it('shows no rate for under 8 hours', async () => {
      render(<PerDiemCalculator initialHours={5} onChange={mockOnChange} />);
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({ rate: 0, grossAmount: 0, netAmount: 0 })
        );
      });
    });

    it('shows €14 rate for 8-24 hours', async () => {
      render(<PerDiemCalculator initialHours={10} onChange={mockOnChange} />);
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({ rate: 14, grossAmount: 14 })
        );
      });
    });

    it('shows €28 rate for 24+ hours', async () => {
      render(<PerDiemCalculator initialHours={24} onChange={mockOnChange} />);
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({ rate: 28, grossAmount: 28 })
        );
      });
    });

    it('calculates net amount with no deductions', async () => {
      render(<PerDiemCalculator initialHours={10} onChange={mockOnChange} />);
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({ netAmount: 14, mealDeductions: 0 })
        );
      });
    });

    it('applies breakfast deduction of €5.60', async () => {
      render(
        <PerDiemCalculator
          initialHours={24}
          initialMeals={{ breakfast: true, lunch: false, dinner: false }}
          onChange={mockOnChange}
        />
      );
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            grossAmount: 28,
            mealDeductions: 5.60,
            netAmount: 22.40,
          })
        );
      });
    });

    it('applies lunch deduction of €11.20', async () => {
      render(
        <PerDiemCalculator
          initialHours={24}
          initialMeals={{ breakfast: false, lunch: true, dinner: false }}
          onChange={mockOnChange}
        />
      );
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            grossAmount: 28,
            mealDeductions: 11.20,
            netAmount: 16.80,
          })
        );
      });
    });

    it('applies dinner deduction of €11.20', async () => {
      render(
        <PerDiemCalculator
          initialHours={24}
          initialMeals={{ breakfast: false, lunch: false, dinner: true }}
          onChange={mockOnChange}
        />
      );
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            grossAmount: 28,
            mealDeductions: 11.20,
            netAmount: 16.80,
          })
        );
      });
    });

    it('applies all meal deductions combined', async () => {
      render(
        <PerDiemCalculator
          initialHours={24}
          initialMeals={{ breakfast: true, lunch: true, dinner: true }}
          onChange={mockOnChange}
        />
      );
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            grossAmount: 28,
            mealDeductions: 28.00,
            netAmount: 0,
          })
        );
      });
    });

    it('net amount cannot go below 0', async () => {
      // Short absence with all meals = should be 0, not negative
      render(
        <PerDiemCalculator
          initialHours={10}
          initialMeals={{ breakfast: true, lunch: true, dinner: true }}
          onChange={mockOnChange}
        />
      );
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({ netAmount: 0 })
        );
      });
    });
  });

  describe('interaction', () => {
    it('updates calculation when hours change', async () => {
      const { user } = render(<PerDiemCalculator onChange={mockOnChange} />);
      const input = screen.getByLabelText(/abwesenheitsstunden/i);
      await user.clear(input);
      await user.type(input, '12');
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({ absenceHours: 12, rate: 14 })
        );
      });
    });

    it('updates calculation when meal checkbox toggled', async () => {
      const { user } = render(
        <PerDiemCalculator initialHours={24} onChange={mockOnChange} />
      );
      const breakfast = screen.getByLabelText(/frühstück/i);
      await user.click(breakfast);
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            mealsProvided: expect.objectContaining({ breakfast: true }),
            mealDeductions: 5.60,
          })
        );
      });
    });

    it('shows info tooltip when clicking info button', async () => {
      const { user } = render(<PerDiemCalculator onChange={mockOnChange} />);
      const infoButton = screen.getByLabelText(/information/i);
      await user.click(infoButton);
      expect(screen.getByText(/§9 Abs\. 4a EStG/i)).toBeInTheDocument();
    });
  });

  describe('result display', () => {
    it('shows result breakdown when hours > 0', async () => {
      render(<PerDiemCalculator initialHours={10} onChange={mockOnChange} />);
      await waitFor(() => {
        expect(screen.getByText(/brutto-pauschale/i)).toBeInTheDocument();
      });
      // The result section shows "Verpflegungsmehraufwand" (exact match without -Rechner)
      expect(screen.getByText('Verpflegungsmehraufwand')).toBeInTheDocument();
    });

    it('shows copy button in result', () => {
      render(<PerDiemCalculator initialHours={10} onChange={mockOnChange} />);
      expect(screen.getByTitle(/ergebnis kopieren/i)).toBeInTheDocument();
    });
  });
});
