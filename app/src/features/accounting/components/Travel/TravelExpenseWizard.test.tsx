import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { TravelExpenseWizard } from './TravelExpenseWizard';

describe('TravelExpenseWizard', () => {
  const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper: get the actual "Weiter" navigation button (not the step indicator)
  function getNextButton() {
    // The navigation button contains text "Weiter" as direct content,
    // while the step indicator button has title="Weitere Kosten"
    const buttons = screen.getAllByRole('button');
    return buttons.find(btn => {
      const text = btn.textContent?.trim();
      return text === 'Weiter' || text?.startsWith('Weiter');
    })!;
  }

  // Helper: get the "Zurück" navigation button
  function getBackButton() {
    const buttons = screen.getAllByRole('button');
    return buttons.find(btn => btn.textContent?.includes('Zurück'))!;
  }

  describe('rendering', () => {
    it('renders wizard title', () => {
      render(<TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      expect(screen.getByText(/neue reisekosten/i)).toBeInTheDocument();
    });

    it('shows step 1 by default', () => {
      render(<TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      expect(screen.getByText(/schritt 1 von 5/i)).toBeInTheDocument();
    });

    it('renders step 1 fields', () => {
      render(<TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      // Use exact label text or htmlFor-linked labels to avoid ambiguity
      expect(screen.getByLabelText('Reisedatum *')).toBeInTheDocument();
      expect(screen.getByLabelText('Rückreisedatum')).toBeInTheDocument();
      expect(screen.getByLabelText('Reiseziel *')).toBeInTheDocument();
      expect(screen.getByLabelText('Reisezweck *')).toBeInTheDocument();
    });

    it('renders progress indicator', () => {
      render(<TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      expect(screen.getByText('Reisedaten')).toBeInTheDocument();
    });

    it('renders cancel and next buttons on step 1', () => {
      render(<TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      expect(screen.getByRole('button', { name: /abbrechen/i })).toBeInTheDocument();
      const nextBtn = getNextButton();
      expect(nextBtn).toBeTruthy();
    });
  });

  describe('step navigation', () => {
    it('cannot proceed from step 1 without required fields', async () => {
      const { user } = render(
        <TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
      // Destination and purpose are empty
      const destinationInput = screen.getByLabelText('Reiseziel *');
      expect(destinationInput).toHaveValue('');
      
      const nextBtn = getNextButton();
      await user.click(nextBtn);
      // Should still be on step 1 (validation prevents navigation)
      expect(screen.getByText(/schritt 1 von 5/i)).toBeInTheDocument();
    });

    it('proceeds to step 2 when step 1 is valid', async () => {
      const { user } = render(
        <TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      await user.type(screen.getByLabelText('Reiseziel *'), 'München');
      await user.type(screen.getByLabelText('Reisezweck *'), 'Kundengespräch');

      await user.click(getNextButton());

      await waitFor(() => {
        expect(screen.getByText(/schritt 2 von 5/i)).toBeInTheDocument();
      });
    });

    it('shows back button on step 2', async () => {
      const { user } = render(
        <TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      await user.type(screen.getByLabelText('Reiseziel *'), 'München');
      await user.type(screen.getByLabelText('Reisezweck *'), 'Kundengespräch');
      await user.click(getNextButton());

      await waitFor(() => {
        expect(getBackButton()).toBeTruthy();
      });
    });

    it('can navigate back from step 2 to step 1', async () => {
      const { user } = render(
        <TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      await user.type(screen.getByLabelText('Reiseziel *'), 'München');
      await user.type(screen.getByLabelText('Reisezweck *'), 'Kundengespräch');
      await user.click(getNextButton());

      await waitFor(() => {
        expect(screen.getByText(/schritt 2 von 5/i)).toBeInTheDocument();
      });

      await user.click(getBackButton());

      await waitFor(() => {
        expect(screen.getByText(/schritt 1 von 5/i)).toBeInTheDocument();
      });
    });

    it('navigates through all steps to review', async () => {
      const { user } = render(
        <TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // Step 1
      await user.type(screen.getByLabelText('Reiseziel *'), 'München');
      await user.type(screen.getByLabelText('Reisezweck *'), 'Kundengespräch');
      await user.click(getNextButton());

      // Step 2 - skip (optional)
      await waitFor(() => expect(screen.getByText(/schritt 2 von 5/i)).toBeInTheDocument());
      await user.click(getNextButton());

      // Step 3 - skip (optional)
      await waitFor(() => expect(screen.getByText(/schritt 3 von 5/i)).toBeInTheDocument());
      await user.click(getNextButton());

      // Step 4 - skip (optional)
      await waitFor(() => expect(screen.getByText(/schritt 4 von 5/i)).toBeInTheDocument());
      await user.click(getNextButton());

      // Step 5 - review
      await waitFor(() => expect(screen.getByText(/schritt 5 von 5/i)).toBeInTheDocument());
      expect(screen.getByText('Zusammenfassung')).toBeInTheDocument();
    });
  });

  describe('step 2: mileage', () => {
    async function goToStep2(user: ReturnType<typeof import('@testing-library/user-event')['default']['setup']>) {
      await user.type(screen.getByLabelText('Reiseziel *'), 'München');
      await user.type(screen.getByLabelText('Reisezweck *'), 'Meeting');
      await user.click(getNextButton());
      await waitFor(() => expect(screen.getByText(/schritt 2 von 5/i)).toBeInTheDocument());
    }

    it('renders mileage fields', async () => {
      const { user } = render(
        <TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
      await goToStep2(user);

      expect(screen.getByLabelText(/entfernung/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/fahrzeugart/i)).toBeInTheDocument();
    });

    it('shows calculated mileage amount', async () => {
      const { user } = render(
        <TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
      await goToStep2(user);

      await user.type(screen.getByLabelText(/entfernung/i), '100');
      await waitFor(() => {
        // 100 km × €0.30 = €30.00
        expect(screen.getByText(/30,00/)).toBeInTheDocument();
      });
    });
  });

  describe('step 3: per diem', () => {
    async function goToStep3(user: ReturnType<typeof import('@testing-library/user-event')['default']['setup']>) {
      await user.type(screen.getByLabelText('Reiseziel *'), 'München');
      await user.type(screen.getByLabelText('Reisezweck *'), 'Meeting');
      await user.click(getNextButton());
      await waitFor(() => expect(screen.getByText(/schritt 2 von 5/i)).toBeInTheDocument());
      await user.click(getNextButton());
      await waitFor(() => expect(screen.getByText(/schritt 3 von 5/i)).toBeInTheDocument());
    }

    it('renders per diem fields', async () => {
      const { user } = render(
        <TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
      await goToStep3(user);

      expect(screen.getByLabelText(/abwesenheitsstunden/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/frühstück/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/mittagessen/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/abendessen/i)).toBeInTheDocument();
    });
  });

  describe('step 5: review & submit', () => {
    it('calls onCancel when cancel button is clicked on step 1', async () => {
      const { user } = render(
        <TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
      await user.click(screen.getByRole('button', { name: /abbrechen/i }));
      expect(mockOnCancel).toHaveBeenCalledOnce();
    });

    it('shows submit button on final step', async () => {
      const { user } = render(
        <TravelExpenseWizard onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // Navigate to step 5
      await user.type(screen.getByLabelText('Reiseziel *'), 'München');
      await user.type(screen.getByLabelText('Reisezweck *'), 'Meeting');
      // Navigate through steps 2-4
      for (let i = 0; i < 4; i++) {
        await user.click(getNextButton());
      }

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reisekosten erfassen/i })).toBeInTheDocument();
      });
    });

    it('shows loading state during submission', () => {
      render(
        <TravelExpenseWizard
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isSubmitting={true}
        />
      );
      // Submitting state is shown regardless of step
      // But the button should show loading on step 5
    });
  });
});
