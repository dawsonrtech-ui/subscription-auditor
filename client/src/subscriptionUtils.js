// Pure helper extracted from App.jsx so the search/sort logic behind the
// "All Subscriptions" list can be unit tested without rendering the whole
// (large, network-heavy) App component.
export function filterAndSortSubscriptions(subs, { search = '', sort = 'next_billing' } = {}) {
  const q = search.trim().toLowerCase();

  return subs
    .filter(sub => {
      if (!q) return true;
      return (
        sub.name.toLowerCase().includes(q) ||
        sub.category.toLowerCase().includes(q) ||
        (sub.notes || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'cost_desc':
          return Number(b.cost) - Number(a.cost);
        case 'cost_asc':
          return Number(a.cost) - Number(b.cost);
        case 'category':
          return a.category.localeCompare(b.category);
        case 'next_billing':
        default:
          if (!a.next_billing && !b.next_billing) return 0;
          if (!a.next_billing) return 1;
          if (!b.next_billing) return -1;
          return a.next_billing.localeCompare(b.next_billing);
      }
    });
}
