import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubscriptionsList from './SubscriptionsList';

const baseSubs = [
  { id: 1, name: 'Netflix', category: 'Streaming', cost: 15.99, billing_cycle: 'monthly', next_billing: '2026-08-10', status: 'active', notes: '' },
  { id: 2, name: 'Spotify', category: 'Streaming', cost: 10.99, billing_cycle: 'monthly', next_billing: '2026-07-05', status: 'active', notes: 'Family plan' },
  { id: 3, name: 'Adobe CC', category: 'Software', cost: 54.99, billing_cycle: 'yearly', next_billing: '2026-09-01', status: 'cancelled', notes: '' },
];

function setup(overrides = {}) {
  const props = {
    subs: baseSubs,
    search: '',
    sort: 'next_billing',
    onSearchChange: vi.fn(),
    onSortChange: vi.fn(),
    onToggleStatus: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<SubscriptionsList {...props} />);
  return props;
}

describe('SubscriptionsList', () => {
  it('shows an empty state when there are no subscriptions', () => {
    setup({ subs: [] });
    expect(screen.getByText('No subscriptions yet.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search subscriptions')).not.toBeInTheDocument();
  });

  it('renders every subscription with its formatted cost', () => {
    setup();
    expect(screen.getByText('Netflix')).toBeInTheDocument();
    expect(screen.getByText('$15.99')).toBeInTheDocument();
    expect(screen.getByText('$10.99')).toBeInTheDocument();
    expect(screen.getByText('$54.99')).toBeInTheDocument();
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
  });

  it('regression: renders correctly when cost comes back as a string (Postgres NUMERIC)', () => {
    // This is exactly the shape that caused a TypeError crash before cost
    // values were normalized: sub.cost.toFixed is not a function.
    const stringCostSubs = baseSubs.map(s => ({ ...s, cost: String(s.cost) }));
    expect(() => setup({ subs: stringCostSubs })).not.toThrow();
    expect(screen.getByText('$15.99')).toBeInTheDocument();
  });

  it('shows a "no matches" message when the search filters everything out', () => {
    setup({ search: 'zzz-nonexistent' });
    expect(screen.getByText('No subscriptions match "zzz-nonexistent".')).toBeInTheDocument();
  });

  it('calls onSearchChange as the user types', async () => {
    const user = userEvent.setup();
    const { onSearchChange } = setup();

    await user.type(screen.getByLabelText('Search subscriptions'), 'net');

    expect(onSearchChange).toHaveBeenCalled();
    expect(onSearchChange.mock.calls.map(c => c[0]).join('')).toBe('net');
  });

  it('calls onSortChange when a new sort option is selected', async () => {
    const user = userEvent.setup();
    const { onSortChange } = setup();

    await user.selectOptions(screen.getByLabelText('Sort subscriptions'), 'cost_desc');

    expect(onSortChange).toHaveBeenCalledWith('cost_desc');
  });

  it('calls onToggleStatus with the subscription when Cancel/Reactivate is clicked', async () => {
    const user = userEvent.setup();
    const { onToggleStatus } = setup();

    const netflixRow = screen.getByText('Netflix').closest('div.flex.items-center.justify-between');
    await user.click(within(netflixRow).getByText('Cancel'));

    expect(onToggleStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: 'Netflix' }));
  });

  it('calls onDelete with the subscription id when the remove button is clicked', async () => {
    const user = userEvent.setup();
    const { onDelete } = setup();

    const spotifyRow = screen.getByText('Spotify').closest('div.flex.items-center.justify-between');
    await user.click(within(spotifyRow).getByText('✕'));

    expect(onDelete).toHaveBeenCalledWith(2);
  });

  it('shows "Reactivate" for a cancelled subscription instead of "Cancel"', () => {
    setup();
    const adobeRow = screen.getByText('Adobe CC').closest('div.flex.items-center.justify-between');
    expect(within(adobeRow).getByText('Reactivate')).toBeInTheDocument();
  });

  it('shows an Annual badge for yearly subscriptions only', () => {
    setup();
    const adobeRow = screen.getByText('Adobe CC').closest('div.flex.items-center.justify-between');
    const netflixRow = screen.getByText('Netflix').closest('div.flex.items-center.justify-between');
    expect(within(adobeRow).getByText('Annual')).toBeInTheDocument();
    expect(within(netflixRow).queryByText('Annual')).not.toBeInTheDocument();
  });
});
