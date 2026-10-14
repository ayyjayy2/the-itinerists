/** What a multi-select filter button reads: "All", "Food", "Food, Drink", then "Food + 2" (#482). */
export function filterSummary(selected: readonly string[]): string {
  if (!selected.length) return 'All';
  if (selected.length <= 2) return selected.join(', ');
  return `${selected[0]} + ${selected.length - 1}`;
}
