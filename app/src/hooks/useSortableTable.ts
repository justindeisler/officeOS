import { useState, useMemo, useCallback } from "react";

type SortDirection = "asc" | "desc";

interface UseSortableTableOptions<T, F extends string> {
  data: T[];
  defaultField: F;
  defaultDirection?: SortDirection;
  /** Map sort field → comparator fn. Return negative / 0 / positive (ascending order). */
  comparators: Record<F, (a: T, b: T) => number>;
  /** Max items to show when collapsed. Pass 0 or Infinity to disable collapsing. */
  pageSize?: number;
}

export function useSortableTable<T, F extends string>({
  data,
  defaultField,
  defaultDirection = "desc",
  comparators,
  pageSize = 10,
}: UseSortableTableOptions<T, F>) {
  const [sortField, setSortField] = useState<F>(defaultField);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);
  const [expanded, setExpanded] = useState(false);

  const toggleSort = useCallback(
    (field: F) => {
      if (sortField === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField],
  );

  const sorted = useMemo(() => {
    const comparator = comparators[sortField];
    if (!comparator) return data;
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...data].sort((a, b) => dir * comparator(a, b));
  }, [data, sortField, sortDirection, comparators]);

  const displayed = pageSize > 0 && !expanded ? sorted.slice(0, pageSize) : sorted;
  const canExpand = pageSize > 0 && sorted.length > pageSize;

  return {
    sortField,
    sortDirection,
    toggleSort,
    sorted,
    displayed,
    expanded,
    setExpanded,
    canExpand,
    totalCount: sorted.length,
  };
}
