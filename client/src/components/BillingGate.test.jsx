import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BillingGate from './BillingGate';

describe('BillingGate', () => {
  it('renders children with no gate when billing status is still loading (null)', () => {
    render(<BillingGate billing={null} onStartCheckout={vi.fn()}><p>App content</p></BillingGate>);
    expect(screen.getByText('App content')).toBeInTheDocument();
  });

  it('renders children with no gate when billing is not configured on this deployment', () => {
    render(
      <BillingGate billing={{ configured: false, active: false, status: 'none', trial_ends_at: null }} onStartCheckout={vi.fn()}>
        <p>App content</p>
      </BillingGate>
    );
    expect(screen.getByText('App content')).toBeInTheDocument();
  });

  it('renders children plus a trial countdown banner while trialing', () => {
    const trialEndsAt = new Date(Date.now() + 5 * 86400000).toISOString();
    render(
      <BillingGate billing={{ configured: true, active: true, status: 'trialing', trial_ends_at: trialEndsAt }} onStartCheckout={vi.fn()}>
        <p>App content</p>
      </BillingGate>
    );
    expect(screen.getByText('App content')).toBeInTheDocument();
    expect(screen.getByText('5 days left in your free trial')).toBeInTheDocument();
  });

  it('renders children with no banner when status is active (paid, not trialing)', () => {
    render(
      <BillingGate billing={{ configured: true, active: true, status: 'active', trial_ends_at: null }} onStartCheckout={vi.fn()}>
        <p>App content</p>
      </BillingGate>
    );
    expect(screen.getByText('App content')).toBeInTheDocument();
    expect(screen.queryByText(/left in your free trial/)).not.toBeInTheDocument();
  });

  it('shows the "Start Free Trial" paywall for a brand new user', () => {
    render(
      <BillingGate billing={{ configured: true, active: false, status: 'none', trial_ends_at: null }} onStartCheckout={vi.fn()}>
        <p>App content</p>
      </BillingGate>
    );
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
    expect(screen.getByText('Start your free trial')).toBeInTheDocument();
    expect(screen.getByText('Start Free Trial')).toBeInTheDocument();
  });

  it('shows the "Resubscribe" paywall for a user whose subscription lapsed', () => {
    render(
      <BillingGate billing={{ configured: true, active: false, status: 'canceled', trial_ends_at: null }} onStartCheckout={vi.fn()}>
        <p>App content</p>
      </BillingGate>
    );
    expect(screen.getByText('Your subscription has ended')).toBeInTheDocument();
    expect(screen.getByText('Resubscribe')).toBeInTheDocument();
  });

  it('calls onStartCheckout when the paywall button is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const onStartCheckout = vi.fn();
    render(
      <BillingGate billing={{ configured: true, active: false, status: 'none', trial_ends_at: null }} onStartCheckout={onStartCheckout}>
        <p>App content</p>
      </BillingGate>
    );
    await user.click(screen.getByText('Start Free Trial'));
    expect(onStartCheckout).toHaveBeenCalled();
  });

  it('shows a redirecting state and disables the button while billingLoading is true', () => {
    render(
      <BillingGate billing={{ configured: true, active: false, status: 'none', trial_ends_at: null }} billingLoading onStartCheckout={vi.fn()}>
        <p>App content</p>
      </BillingGate>
    );
    expect(screen.getByText('Redirecting...')).toBeDisabled();
  });
});
