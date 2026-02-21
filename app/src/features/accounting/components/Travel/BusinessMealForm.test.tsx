import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { BusinessMealForm } from './BusinessMealForm';

describe('BusinessMealForm', () => {
  const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the form title', () => {
      render(
        <BusinessMealForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
      // The CardTitle contains just "Bewirtungskosten"
      expect(screen.getByText('Bewirtungskosten')).toBeInTheDocument();
    });

    it('renders the business meal toggle', () => {
      render(
        <BusinessMealForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
      expect(screen.getByText(/als geschäftsessen kennzeichnen/i)).toBeInTheDocument();
    });

    it('shows 70% deductible badge', () => {
      render(
        <BusinessMealForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
      expect(screen.getByText(/70% abzugsfähig/i)).toBeInTheDocument();
    });

    it('shows info box about Bewirtungskosten rules', () => {
      render(
        <BusinessMealForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
      expect(screen.getByText(/§4 Abs\. 5 Nr\. 2 EStG/i)).toBeInTheDocument();
    });

    it('hides participant/purpose/location when not marked as meal', () => {
      render(
        <BusinessMealForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
      expect(screen.queryByLabelText(/teilnehmer/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/geschäftlicher anlass/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/ort/i)).not.toBeInTheDocument();
    });

    it('shows participant/purpose/location when marked as business meal', async () => {
      const { user } = render(
        <BusinessMealForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
      
      // Click the checkbox input directly to toggle business meal
      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      await waitFor(() => {
        // The label "Teilnehmer *" appears for the participant section
        expect(screen.getByText('Teilnehmer *')).toBeInTheDocument();
        expect(screen.getByLabelText(/geschäftlicher anlass/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/ort/i)).toBeInTheDocument();
      });
    });

    it('renders with initial values', () => {
      render(
        <BusinessMealForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isBusinessMeal={true}
          initialParticipants={['Max Mustermann', 'Erika Musterfrau']}
          initialPurpose="Projektbesprechung"
          initialLocation="Restaurant Goldener Hirsch"
        />
      );
      
      expect(screen.getByDisplayValue('Max Mustermann')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Erika Musterfrau')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Projektbesprechung')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Restaurant Goldener Hirsch')).toBeInTheDocument();
    });

    it('renders submit and cancel buttons', () => {
      render(
        <BusinessMealForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
      expect(screen.getByRole('button', { name: /speichern/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /abbrechen/i })).toBeInTheDocument();
    });
  });

  describe('participant management', () => {
    it('can add a participant', async () => {
      const { user } = render(
        <BusinessMealForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isBusinessMeal={true}
        />
      );
      
      const addButton = screen.getByRole('button', { name: /teilnehmer hinzufügen/i });
      await user.click(addButton);

      const inputs = screen.getAllByPlaceholderText(/teilnehmer/i);
      expect(inputs.length).toBe(2);
    });

    it('can remove a participant', async () => {
      const { user } = render(
        <BusinessMealForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isBusinessMeal={true}
          initialParticipants={['Max', 'Erika']}
        />
      );

      const removeButtons = screen.getAllByTitle(/teilnehmer entfernen/i);
      await user.click(removeButtons[0]);

      expect(screen.queryByDisplayValue('Max')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Erika')).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('shows error when submitting business meal without participants', async () => {
      const { user } = render(
        <BusinessMealForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isBusinessMeal={true}
        />
      );

      await user.click(screen.getByRole('button', { name: /speichern/i }));

      await waitFor(() => {
        expect(screen.getByText(/mindestens ein teilnehmer/i)).toBeInTheDocument();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('shows error when submitting business meal without purpose', async () => {
      const { user } = render(
        <BusinessMealForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isBusinessMeal={true}
          initialParticipants={['Max']}
        />
      );

      await user.click(screen.getByRole('button', { name: /speichern/i }));

      await waitFor(() => {
        expect(screen.getByText(/geschäftlicher anlass ist erforderlich/i)).toBeInTheDocument();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('submission', () => {
    it('submits correctly when marking as business meal', async () => {
      const { user } = render(
        <BusinessMealForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isBusinessMeal={true}
          initialParticipants={['Max Mustermann']}
          initialPurpose="Projektbesprechung"
          initialLocation="München"
        />
      );

      await user.click(screen.getByRole('button', { name: /speichern/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          isBusinessMeal: true,
          mealParticipants: ['Max Mustermann'],
          mealPurpose: 'Projektbesprechung',
          mealLocation: 'München',
        });
      });
    });

    it('submits correctly when unmarking as business meal', async () => {
      const { user } = render(
        <BusinessMealForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isBusinessMeal={false}
        />
      );

      await user.click(screen.getByRole('button', { name: /speichern/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          isBusinessMeal: false,
          mealParticipants: [],
          mealPurpose: undefined,
          mealLocation: null,
        });
      });
    });

    it('calls onCancel when cancel button is clicked', async () => {
      const { user } = render(
        <BusinessMealForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
      await user.click(screen.getByRole('button', { name: /abbrechen/i }));
      expect(mockOnCancel).toHaveBeenCalledOnce();
    });

    it('shows loading state during submission', () => {
      render(
        <BusinessMealForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isSubmitting={true}
        />
      );
      expect(screen.getByText(/wird gespeichert/i)).toBeInTheDocument();
    });
  });
});
