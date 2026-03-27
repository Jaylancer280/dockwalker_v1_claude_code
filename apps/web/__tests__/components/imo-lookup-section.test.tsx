import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ImoLookupSection } from '@/components/vessels/imo-lookup-section';

vi.mock('@/lib/safe-fetch', () => ({
  safeFetch: vi.fn(),
}));

import { safeFetch } from '@/lib/safe-fetch';
const mockSafeFetch = vi.mocked(safeFetch);

const baseProps = {
  imoNumber: '',
  setImoNumber: vi.fn(),
  useExisting: false,
  setUseExisting: vi.fn(),
  existingVesselId: '',
  setExistingVesselId: vi.fn(),
  vesselName: '',
  setVesselName: vi.fn(),
  vesselType: 'motor' as const,
  setVesselType: vi.fn(),
  loaMeters: '',
  setLoaMeters: vi.fn(),
};

describe('ImoLookupSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders IMO input and lookup button', () => {
    render(<ImoLookupSection {...baseProps} />);

    expect(screen.getByPlaceholderText('4-7 digits')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('lookup button is disabled when IMO has fewer than 4 digits', () => {
    render(<ImoLookupSection {...baseProps} imoNumber="123" />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('lookup button is enabled when IMO has 4+ digits', () => {
    render(<ImoLookupSection {...baseProps} imoNumber="1234" />);

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
  });

  it('strips non-digit characters from IMO input', () => {
    const setImoNumber = vi.fn();
    render(<ImoLookupSection {...baseProps} setImoNumber={setImoNumber} />);

    const input = screen.getByPlaceholderText('4-7 digits');
    fireEvent.change(input, { target: { value: '12abc34' } });

    expect(setImoNumber).toHaveBeenCalledWith('1234');
  });

  it('truncates IMO input to 7 digits', () => {
    const setImoNumber = vi.fn();
    render(<ImoLookupSection {...baseProps} setImoNumber={setImoNumber} />);

    const input = screen.getByPlaceholderText('4-7 digits');
    fireEvent.change(input, { target: { value: '12345678' } });

    expect(setImoNumber).toHaveBeenCalledWith('1234567');
  });

  it('exact lookup (7 digits) populates vessel fields when found', async () => {
    const setVesselName = vi.fn();
    const setLoaMeters = vi.fn();
    const setVesselType = vi.fn();
    const setExistingVesselId = vi.fn();
    const setUseExisting = vi.fn();

    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      data: {
        found: true,
        vessel: { name: 'Test Yacht', loa_meters: 45, vessel_type: 'motor', id: 'v1' },
      },
      status: 200,
    } as ReturnType<typeof safeFetch> extends Promise<infer T> ? T : never);

    render(
      <ImoLookupSection
        {...baseProps}
        imoNumber="1234567"
        setVesselName={setVesselName}
        setLoaMeters={setLoaMeters}
        setVesselType={setVesselType}
        setExistingVesselId={setExistingVesselId}
        setUseExisting={setUseExisting}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(setVesselName).toHaveBeenCalledWith('Test Yacht');
      expect(setLoaMeters).toHaveBeenCalledWith('45');
      expect(setVesselType).toHaveBeenCalledWith('motor');
      expect(setExistingVesselId).toHaveBeenCalledWith('v1');
      expect(setUseExisting).toHaveBeenCalledWith(true);
    });
  });

  it('exact lookup shows "Not found" when vessel not in DB', async () => {
    const setUseExisting = vi.fn();

    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      data: { found: false },
      status: 200,
    } as ReturnType<typeof safeFetch> extends Promise<infer T> ? T : never);

    render(
      <ImoLookupSection
        {...baseProps}
        imoNumber="9999999"
        setUseExisting={setUseExisting}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
      expect(setUseExisting).toHaveBeenCalledWith(false);
    });
  });

  it('shows found vessel card when useExisting is true', () => {
    render(
      <ImoLookupSection
        {...baseProps}
        useExisting={true}
        vesselName="Ocean Dream"
        vesselType="sail"
        loaMeters="55"
        imoNumber="1234567"
      />,
    );

    expect(screen.getByText('S/Y Ocean Dream')).toBeInTheDocument();
    expect(screen.getByText(/55m/)).toBeInTheDocument();
    expect(screen.getByText('Enter manually')).toBeInTheDocument();
  });

  it('Enter manually button clears useExisting state', () => {
    const setUseExisting = vi.fn();
    const setExistingVesselId = vi.fn();

    render(
      <ImoLookupSection
        {...baseProps}
        useExisting={true}
        vesselName="Ocean Dream"
        vesselType="motor"
        loaMeters="55"
        imoNumber="1234567"
        setUseExisting={setUseExisting}
        setExistingVesselId={setExistingVesselId}
      />,
    );

    fireEvent.click(screen.getByText('Enter manually'));

    expect(setUseExisting).toHaveBeenCalledWith(false);
    expect(setExistingVesselId).toHaveBeenCalledWith('');
  });
});
