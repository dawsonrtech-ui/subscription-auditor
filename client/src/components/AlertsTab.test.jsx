import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AlertsTab from './AlertsTab';

function baseProps(overrides = {}) {
  return {
    notifyDays: 3,
    setNotifyDays: vi.fn(),
    onUpdateNotifyDays: vi.fn(),
    onPreview: vi.fn(),
    onSend: vi.fn(),
    notifySending: false,
    notifyPreview: null,
    ...overrides,
  };
}

describe('AlertsTab', () => {
  it('renders without a preview loaded yet', () => {
    render(<AlertsTab {...baseProps()} />);
    expect(screen.getByText('3 days')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('renders upcoming and annual preview lists', () => {
    const notifyPreview = {
      upcoming: [{ id: 1, name: 'Netflix', cost: 15.99, next_billing: '2026-08-10' }],
      annual: [{ id: 2, name: 'Domain Renewal', cost: 12 }],
    };
    render(<AlertsTab {...baseProps({ notifyPreview })} />);
    expect(screen.getByText('$15.99 — 2026-08-10')).toBeInTheDocument();
    expect(screen.getByText('$12.00/yr')).toBeInTheDocument();
  });

  it('regression: does not crash when preview costs are strings (Postgres NUMERIC)', () => {
    const notifyPreview = {
      upcoming: [{ id: 1, name: 'Netflix', cost: '15.99', next_billing: '2026-08-10' }],
      annual: [{ id: 2, name: 'Domain Renewal', cost: '12.00' }],
    };
    expect(() => render(<AlertsTab {...baseProps({ notifyPreview })} />)).not.toThrow();
    expect(screen.getByText('$15.99 — 2026-08-10')).toBeInTheDocument();
    expect(screen.getByText('$12.00/yr')).toBeInTheDocument();
  });

  it('shows an all-caught-up message when there are no upcoming renewals', () => {
    render(<AlertsTab {...baseProps({ notifyPreview: { upcoming: [], annual: [] } })} />);
    expect(screen.getByText('All caught up!')).toBeInTheDocument();
    expect(screen.getByText('No annual subscriptions tracked.')).toBeInTheDocument();
  });
});
