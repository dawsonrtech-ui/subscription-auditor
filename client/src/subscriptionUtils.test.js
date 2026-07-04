import { describe, it, expect } from 'vitest';
import { filterAndSortSubscriptions } from './subscriptionUtils';

const subs = [
  { id: 1, name: 'Netflix', category: 'Streaming', cost: 15.99, next_billing: '2026-08-10', notes: '' },
  { id: 2, name: 'Spotify', category: 'Streaming', cost: 10.99, next_billing: '2026-07-05', notes: 'Family plan' },
  { id: 3, name: 'GitHub', category: 'SaaS', cost: 4, next_billing: null, notes: '' },
  { id: 4, name: 'Adobe CC', category: 'Software', cost: 54.99, next_billing: '2026-09-01', notes: 'shared with team' },
];

describe('filterAndSortSubscriptions', () => {
  it('returns all subscriptions when there is no search term', () => {
    const result = filterAndSortSubscriptions(subs, { search: '', sort: 'name' });
    expect(result).toHaveLength(4);
  });

  it('filters case-insensitively by name', () => {
    const result = filterAndSortSubscriptions(subs, { search: 'netflix' });
    expect(result.map(s => s.name)).toEqual(['Netflix']);
  });

  it('filters by category', () => {
    const result = filterAndSortSubscriptions(subs, { search: 'streaming' });
    expect(result.map(s => s.name).sort()).toEqual(['Netflix', 'Spotify']);
  });

  it('filters by notes', () => {
    const result = filterAndSortSubscriptions(subs, { search: 'family' });
    expect(result.map(s => s.name)).toEqual(['Spotify']);
  });

  it('treats a subscription with no notes as searchable without throwing', () => {
    expect(() => filterAndSortSubscriptions(subs, { search: 'zzz-no-match' })).not.toThrow();
    expect(filterAndSortSubscriptions(subs, { search: 'zzz-no-match' })).toHaveLength(0);
  });

  it('sorts by name A-Z', () => {
    const result = filterAndSortSubscriptions(subs, { sort: 'name' });
    expect(result.map(s => s.name)).toEqual(['Adobe CC', 'GitHub', 'Netflix', 'Spotify']);
  });

  it('sorts by cost, high to low', () => {
    const result = filterAndSortSubscriptions(subs, { sort: 'cost_desc' });
    expect(result.map(s => s.name)).toEqual(['Adobe CC', 'Netflix', 'Spotify', 'GitHub']);
  });

  it('sorts by cost, low to high', () => {
    const result = filterAndSortSubscriptions(subs, { sort: 'cost_asc' });
    expect(result.map(s => s.name)).toEqual(['GitHub', 'Spotify', 'Netflix', 'Adobe CC']);
  });

  it('sorts by cost correctly even when cost is a string (Postgres NUMERIC)', () => {
    const stringCostSubs = subs.map(s => ({ ...s, cost: String(s.cost) }));
    const result = filterAndSortSubscriptions(stringCostSubs, { sort: 'cost_desc' });
    expect(result.map(s => s.name)).toEqual(['Adobe CC', 'Netflix', 'Spotify', 'GitHub']);
  });

  it('sorts by category', () => {
    const result = filterAndSortSubscriptions(subs, { sort: 'category' });
    expect(result.map(s => s.category)).toEqual(['SaaS', 'Software', 'Streaming', 'Streaming']);
  });

  it('sorts by next_billing ascending, pushing subs with no date to the end', () => {
    const result = filterAndSortSubscriptions(subs, { sort: 'next_billing' });
    expect(result.map(s => s.name)).toEqual(['Spotify', 'Netflix', 'Adobe CC', 'GitHub']);
  });

  it('defaults to next_billing sort for an unrecognized sort key', () => {
    const result = filterAndSortSubscriptions(subs, { sort: 'not-a-real-option' });
    expect(result.map(s => s.name)).toEqual(['Spotify', 'Netflix', 'Adobe CC', 'GitHub']);
  });

  it('combines search and sort together', () => {
    const result = filterAndSortSubscriptions(subs, { search: 'streaming', sort: 'cost_asc' });
    expect(result.map(s => s.name)).toEqual(['Spotify', 'Netflix']);
  });

  it('does not mutate the original array', () => {
    const original = [...subs];
    filterAndSortSubscriptions(subs, { sort: 'name' });
    expect(subs).toEqual(original);
  });
});
