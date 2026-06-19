import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ContractDetailsInput } from '@/components/contract-details-input';

describe('ContractDetailsInput', () => {
  afterEach(cleanup);

  it('renders contract type dropdown with all 6 types', () => {
    render(
      <ContractDetailsInput
        contractType=""
        onContractTypeChange={vi.fn()}
        contractDetails=""
        onContractDetailsChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Contract type')).toBeInTheDocument();
  });

  it('shows rotation pills when contractType is rotational', () => {
    render(
      <ContractDetailsInput
        contractType="rotational"
        onContractTypeChange={vi.fn()}
        contractDetails=""
        onContractDetailsChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Rotation pattern')).toBeInTheDocument();
    expect(screen.getByText('2:2')).toBeInTheDocument();
    expect(screen.getByText('3:3')).toBeInTheDocument();
    expect(screen.getByText('10:10')).toBeInTheDocument();
  });

  it('rotation pill click sets contract details', () => {
    const onChange = vi.fn();
    render(
      <ContractDetailsInput
        contractType="rotational"
        onContractTypeChange={vi.fn()}
        contractDetails=""
        onContractDetailsChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText('3:1'));
    expect(onChange).toHaveBeenCalledWith('3:1 months');
  });

  it('shows days leave input when contractType is permanent', () => {
    render(
      <ContractDetailsInput
        contractType="permanent"
        onContractTypeChange={vi.fn()}
        contractDetails=""
        onContractDetailsChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Days leave per year')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('28')).toBeInTheDocument();
  });

  it('shows season period input when contractType is seasonal', () => {
    render(
      <ContractDetailsInput
        contractType="seasonal"
        onContractTypeChange={vi.fn()}
        contractDetails=""
        onContractDetailsChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Season period')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/march/i)).toBeInTheDocument();
  });

  it('shows nothing extra for crossing/delivery/temporary types', () => {
    render(
      <ContractDetailsInput
        contractType="crossing"
        onContractTypeChange={vi.fn()}
        contractDetails=""
        onContractDetailsChange={vi.fn()}
      />,
    );

    expect(screen.queryByText('Rotation pattern')).not.toBeInTheDocument();
    expect(screen.queryByText('Days leave per year')).not.toBeInTheDocument();
    expect(screen.queryByText('Season period')).not.toBeInTheDocument();
  });
});
