import { useState, useCallback } from "react";

/**
 * Manages a Set<string> of selected IDs with toggle, select-all, and clear.
 */
export function useSelectionSet() {
  const [active, setActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((allIds: string[]) => {
    setSelectedIds((prev) =>
      prev.size === allIds.length ? new Set() : new Set(allIds)
    );
  }, []);

  const enter = useCallback(() => {
    setActive(true);
    setSelectedIds(new Set());
  }, []);

  const exit = useCallback(() => {
    setActive(false);
    setSelectedIds(new Set());
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return { active, selectedIds, toggle, selectAll, enter, exit, clear };
}
