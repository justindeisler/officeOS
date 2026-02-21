import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { TravelRecordsList } from './TravelRecordsList';
import type { TravelRecord } from '@/services/web/travelService';

// ============================================================================
// Mock Data
// ============================================================================

const mockRecords: TravelRecord[] = [
  {
    id: 'tr-1',
    expenseId: 'exp-1',
    tripDate: '2024-03-15',
    returnDate: '2024-03-17',
    destination: 'München',
    purpose: 'Kundengespräch',
    distanceKm: 300,
    vehicleType: 'car',
    kmRate: 0.30,
    mileageAmount: 90,
    absenceHours: 48,
    perDiemRate: 28,
    perDiemAmount: 56,
    mealsProvided: null,
    mealDeductions: null,
    accommodationAmount: 120,
    otherCosts: 15,
    notes: 'Taxi und Parkgebühren',
    totalAmount: 281,
    createdAt: '2024-03-15T10:00:00Z',
  },
  {
    id: 'tr-2',
    expenseId: 'exp-2',
    tripDate: '2024-02-10',
    returnDate: null,
    destination: 'Berlin',
    purpose: 'Messe',
    distanceKm: null,
    vehicleType: 'car',
    kmRate: 0.30,
    mileageAmount: null,
    absenceHours: 12,
    perDiemRate: 14,
    perDiemAmount: 14,
    mealsProvided: { breakfast: false, lunch: false, dinner: false },
    mealDeductions: 0,
    accommodationAmount: null,
    otherCosts: null,
    notes: null,
    totalAmount: 14,
    createdAt: '2024-02-10T10:00:00Z',
  },
  {
    id: 'tr-3',
    expenseId: 'exp-3',
    tripDate: '2024-01-05',
    returnDate: null,
    destination: 'Hamburg',
    purpose: 'Workshop',
    distanceKm: 150,
    vehicleType: 'motorcycle',
    kmRate: 0.20,
    mileageAmount: 30,
    absenceHours: null,
    perDiemRate: null,
    perDiemAmount: null,
    mealsProvided: null,
    mealDeductions: null,
    accommodationAmount: null,
    otherCosts: null,
    notes: null,
    totalAmount: 30,
    createdAt: '2024-01-05T10:00:00Z',
  },
];

describe('TravelRecordsList', () => {
  const mockOnAdd = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the header', () => {
      render(
        <TravelRecordsList
          records={mockRecords}
          onAdd={mockOnAdd}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );
      // The CardTitle contains "Reisekosten"
      expect(screen.getByText('Reisekosten')).toBeInTheDocument();
    });

    it('renders the "New Travel Expense" button', () => {
      render(
        <TravelRecordsList
          records={mockRecords}
          onAdd={mockOnAdd}
        />
      );
      expect(screen.getByRole('button', { name: /neue reisekosten/i })).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(<TravelRecordsList records={mockRecords} />);
      expect(screen.getByPlaceholderText(/ziel oder zweck suchen/i)).toBeInTheDocument();
    });

    it('renders date filter inputs', () => {
      render(<TravelRecordsList records={mockRecords} />);
      expect(screen.getByLabelText(/datum von/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/datum bis/i)).toBeInTheDocument();
    });

    it('renders table with all records', () => {
      render(<TravelRecordsList records={mockRecords} />);
      expect(screen.getByText('München')).toBeInTheDocument();
      expect(screen.getByText('Berlin')).toBeInTheDocument();
      expect(screen.getByText('Hamburg')).toBeInTheDocument();
    });

    it('displays total amount for each record', () => {
      render(<TravelRecordsList records={mockRecords} />);
      expect(screen.getByText(/281,00/)).toBeInTheDocument();
      // 14,00 and 30,00 appear in both detail columns and total column
      expect(screen.getAllByText(/14,00/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/30,00/).length).toBeGreaterThanOrEqual(1);
    });

    it('shows mileage amount when present', () => {
      render(<TravelRecordsList records={mockRecords} />);
      expect(screen.getByText(/90,00/)).toBeInTheDocument();
    });

    it('shows return date for multi-day trips', () => {
      render(<TravelRecordsList records={mockRecords} />);
      expect(screen.getByText(/17\.03\.2024/)).toBeInTheDocument();
    });

    it('shows summary with count and total', () => {
      render(<TravelRecordsList records={mockRecords} />);
      expect(screen.getByText(/3 einträge/i)).toBeInTheDocument();
      expect(screen.getByText(/325,00/)).toBeInTheDocument(); // 281 + 14 + 30
    });
  });

  describe('empty state', () => {
    it('shows empty state when no records', () => {
      render(<TravelRecordsList records={[]} onAdd={mockOnAdd} />);
      expect(screen.getByText(/keine reisekosten erfasst/i)).toBeInTheDocument();
    });

    it('shows CTA button in empty state', () => {
      render(<TravelRecordsList records={[]} onAdd={mockOnAdd} />);
      expect(screen.getByRole('button', { name: /reisekosten erfassen/i })).toBeInTheDocument();
    });

    it('shows different message when filtering yields no results', async () => {
      const { user } = render(
        <TravelRecordsList records={mockRecords} />
      );
      const searchInput = screen.getByPlaceholderText(/ziel oder zweck suchen/i);
      await user.type(searchInput, 'Nichtexistent');
      await waitFor(() => {
        expect(screen.getByText(/keine ergebnisse/i)).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('shows loading spinner when isLoading', () => {
      render(<TravelRecordsList records={[]} isLoading={true} />);
      expect(screen.getByText(/lade reisekosten/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message', () => {
      render(
        <TravelRecordsList
          records={[]}
          error="Fehler beim Laden"
        />
      );
      expect(screen.getByText(/fehler beim laden/i)).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('filters by search query on destination', async () => {
      const { user } = render(
        <TravelRecordsList records={mockRecords} />
      );
      const searchInput = screen.getByPlaceholderText(/ziel oder zweck suchen/i);
      await user.type(searchInput, 'München');

      await waitFor(() => {
        expect(screen.getByText('München')).toBeInTheDocument();
        expect(screen.queryByText('Berlin')).not.toBeInTheDocument();
        expect(screen.queryByText('Hamburg')).not.toBeInTheDocument();
      });
    });

    it('filters by search query on purpose', async () => {
      const { user } = render(
        <TravelRecordsList records={mockRecords} />
      );
      const searchInput = screen.getByPlaceholderText(/ziel oder zweck suchen/i);
      await user.type(searchInput, 'Messe');

      await waitFor(() => {
        expect(screen.getByText('Berlin')).toBeInTheDocument();
        expect(screen.queryByText('München')).not.toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls onAdd when "New" button is clicked', async () => {
      const { user } = render(
        <TravelRecordsList
          records={mockRecords}
          onAdd={mockOnAdd}
        />
      );
      await user.click(screen.getByRole('button', { name: /neue reisekosten/i }));
      expect(mockOnAdd).toHaveBeenCalledOnce();
    });

    it('calls onEdit when edit button is clicked', async () => {
      const { user } = render(
        <TravelRecordsList
          records={mockRecords}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );
      const editButtons = screen.getAllByTitle(/bearbeiten/i);
      await user.click(editButtons[0]);
      expect(mockOnEdit).toHaveBeenCalledWith(mockRecords[0]);
    });

    it('shows delete confirmation dialog', async () => {
      const { user } = render(
        <TravelRecordsList
          records={mockRecords}
          onDelete={mockOnDelete}
        />
      );
      const deleteButtons = screen.getAllByTitle(/löschen/i);
      await user.click(deleteButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/reisekosten löschen\?/i)).toBeInTheDocument();
      });
    });
  });

  describe('sorting', () => {
    it('sorts by date descending by default', () => {
      render(<TravelRecordsList records={mockRecords} />);
      const rows = screen.getAllByRole('row');
      // Header row + 3 data rows. First data row should be most recent (München - March)
      expect(rows[1]).toHaveTextContent('München');
    });
  });
});
