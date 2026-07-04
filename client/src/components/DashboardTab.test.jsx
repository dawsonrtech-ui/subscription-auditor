import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardTab from './DashboardTab';

const emptyProps = {
  summary: null,
  subs: [],
  projection: null,
  costHistory: [],
  priceCompares: [],
};

const summary = {
  count: 3,
  monthly: 42.5,
  upcoming: [{ id: 1, name: 'Netflix', cost: 15.99, next_billing: '2026-08-10' }],
  byCategory: { Streaming: 25.98, SaaS: 16.52 },
  total: 42.5,
  budgetVsActual: { Streaming: { budget: 30, actual: 25.98 } },
  cancelledCount: 1,
  cancelledMonthly: 9.99,
  cancelled: [{ id: 9, name: 'Old Gym', cost: 9.99, billing_cycle: 'monthly' }],
};

const subs = [
  { id: 1, name: 'Netflix', category: 'Streaming', cost: 15.99, billing_cycle: 'monthly', status: 'active', next_billing: '2026-08-10' },
  { id: 2, name: 'Spotify', category: 'Streaming', cost: 9.99, billing_cycle: 'monthly', status: 'active', next_billing: '2026-07-15' },
];

describe('DashboardTab', () => {
  it('renders sensible defaults with no data at all', () => {
    expect(() => render(<DashboardTab {...emptyProps} />)).not.toThrow();
    expect(screen.getByText('Active Subs')).toBeInTheDocument();
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
  });

  it('renders summary numbers and upcoming renewals', () => {
    render(<DashboardTab {...emptyProps} summary={summary} subs={subs} />);
    expect(screen.getByText('Active Subs').nextSibling).toHaveTextContent('3');
    expect(screen.getByText('$42.50')).toBeInTheDocument();
    expect(screen.getByText('Upcoming Renewals')).toBeInTheDocument();
    expect(screen.getByText('$15.99 — 2026-08-10')).toBeInTheDocument();
  });

  it('regression: does not crash when upcoming/cancelled costs are strings (Postgres NUMERIC)', () => {
    const stringSummary = {
      ...summary,
      upcoming: summary.upcoming.map(s => ({ ...s, cost: String(s.cost) })),
      cancelled: summary.cancelled.map(s => ({ ...s, cost: String(s.cost) })),
    };
    const stringSubs = subs.map(s => ({ ...s, cost: String(s.cost) }));

    expect(() => render(<DashboardTab {...emptyProps} summary={stringSummary} subs={stringSubs} />)).not.toThrow();
    expect(screen.getByText('$15.99 — 2026-08-10')).toBeInTheDocument();
    expect(screen.getByText('Top 5 Most Expensive')).toBeInTheDocument();
  });

  it('shows the Top 5 Most Expensive list sorted by cost, active subs only', () => {
    const mixedSubs = [
      ...subs,
      { id: 3, name: 'Cancelled Thing', category: 'Other', cost: 999, billing_cycle: 'monthly', status: 'cancelled', next_billing: null },
    ];
    render(<DashboardTab {...emptyProps} subs={mixedSubs} />);
    expect(screen.queryByText('Cancelled Thing')).not.toBeInTheDocument();
    expect(screen.getByText('Netflix')).toBeInTheDocument();
  });

  it('shows the Cancelled Subs section only when there are cancelled subscriptions', () => {
    const { rerender } = render(<DashboardTab {...emptyProps} />);
    expect(screen.queryByText('Cancelled Subs')).not.toBeInTheDocument();

    rerender(<DashboardTab {...emptyProps} summary={summary} subs={subs} />);
    expect(screen.getByText('Cancelled Subs')).toBeInTheDocument();
    expect(screen.getByText('Old Gym')).toBeInTheDocument();
  });
});
