import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SalaryEntry } from '@/types/salary';

const sortEntries = (entries: SalaryEntry[]) =>
  [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.sort_order - b.sort_order);

const buildEmptyEntry = (userId: string, periodId: string, entryDate: string, sortOrder: number, isActive: boolean = false): Omit<SalaryEntry, 'id'> => ({
  user_id: userId,
  period_id: periodId,
  entry_date: entryDate,
  sort_order: sortOrder,
  is_day_off: !isActive,
  off_percent: 0,
  note: null,
  clock_in: null,
  clock_out: null,
  total_hours: null,
  allowance_rate_override: null,
  base_daily_wage: 0,
  allowance_amount: 0,
  extra_wage: 0,
  total_daily_wage: 0,
});

export type SalaryEditorMode = 'admin' | 'employee';

export interface UseSalaryEntriesOptions {
  editorMode?: SalaryEditorMode;
  enableRealtime?: boolean;
  /** For Type A: auto-seed working entries for each special day in the rates table */
  seedAllDays?: boolean;
  /** Whether employee edits should wait for admin review or be auto-approved */
  employeeReviewMode?: 'pending' | 'auto';
}

export function useSalaryEntries(
  userId: string | null,
  periodId: string | null,
  options: UseSalaryEntriesOptions = {}
) {
  const {
    editorMode = 'admin',
    enableRealtime = false,
    seedAllDays = false,
    employeeReviewMode = 'pending',
  } = options;
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<Map<string, Partial<SalaryEntry>>>(new Map());
  const currentUidRef = useRef<string | null>(null);
  // Mirror of entries state so async flushUpdates can inspect the latest
  // row shape without having to dep on `entries` (which would churn the
  // debounced callback identity).
  const entriesRef = useRef<SalaryEntry[]>([]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      currentUidRef.current = data.user?.id || null;
    });
  }, []);

  // Build audit-trail fields we attach to every write.
  //
  // An employee edit normally flags the row as pending admin review. But
  // a pure day-off toggle (no clock times) carries no payroll risk and
  // should be auto-approved so admins aren't buried under a wall of
  // yellow flags for days that were simply marked off. Pass the final
  // merged row state so this helper can decide.
  const buildAuditFields = useCallback((
    effectiveRow?: Partial<SalaryEntry>
  ): Partial<SalaryEntry> => {
    const uid = currentUidRef.current;
    if (editorMode === 'employee') {
      const isOffDayNoTimes =
        effectiveRow?.is_day_off === true &&
        !effectiveRow?.clock_in &&
        !effectiveRow?.clock_out;
      const shouldAutoApprove =
        employeeReviewMode === 'auto' || isOffDayNoTimes;
      return {
        submitted_by: uid,
        // Type B employee edits are auto-approved, and pure day-off rows
        // stay auto-approved across all employee modes.
        is_admin_reviewed: shouldAutoApprove,
        last_employee_edit_at: new Date().toISOString(),
      };
    }
    // Admin edit: mark reviewed so any pending flag clears.
    return {
      is_admin_reviewed: true,
    };
  }, [editorMode, employeeReviewMode]);

  useEffect(() => {
    if (!userId || !periodId) { setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('salary_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('period_id', periodId)
        .order('entry_date', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) console.error('Failed to fetch salary entries:', error);
      let loaded = (data || []) as SalaryEntry[];

      // Type A: seed missing special days (don't delete or modify existing entries)
      if (seedAllDays && periodId) {
        const existingDates = new Set(loaded.map(e => e.entry_date));

        // Fetch special day rates for this period
        const { data: ratesData } = await supabase
          .from('special_day_rates')
          .select('special_date, rate_percent')
          .eq('period_id', periodId);

        const specialDates = new Set(
          (ratesData || [])
            .filter((r: { special_date: string; rate_percent: number }) => r.rate_percent > 0)
            .map((r: { special_date: string }) => r.special_date)
        );

        // Seed missing special days
        const toSeed = [...specialDates].filter(d => !existingDates.has(d));
        if (toSeed.length > 0) {
          const rows = toSeed.map(dateStr =>
            buildEmptyEntry(userId, periodId, dateStr, 0, true)
          );
          const { data: inserted, error: insertErr } = await supabase
            .from('salary_entries')
            .insert(rows)
            .select();
          if (!insertErr && inserted) {
            loaded = sortEntries([...loaded, ...(inserted as SalaryEntry[])]);
          }
        }
      }

      setEntries(sortEntries(loaded));
      setLoading(false);
    };

    fetch();
  }, [userId, periodId, seedAllDays]);

  // Optional realtime subscription — merges remote changes into local state.
  useEffect(() => {
    if (!enableRealtime || !userId || !periodId) return;

    const channel = supabase
      .channel(`salary_entries:${userId}:${periodId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'salary_entries',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = (payload.new || payload.old) as SalaryEntry | undefined;
          if (!row || row.period_id !== periodId) return;

          setEntries(prev => {
            if (payload.eventType === 'DELETE') {
              return prev.filter(e => e.id !== (payload.old as SalaryEntry).id);
            }
            const incoming = payload.new as SalaryEntry;
            // First match by id — handles UPDATE events and INSERT
            // echoes for rows we already have locally.
            let idx = prev.findIndex(e => e.id === incoming.id);
            // Fallback for the optimistic path: `updateEntry` appends an
            // id-less row to local state when the user starts editing a
            // brand-new (entry_date, sort_order). Once the upsert lands
            // server-side and broadcasts back, the row carries its
            // generated id — we have to MERGE it onto the optimistic
            // placeholder, not append a second copy. Without this every
            // optimistic-then-saved row ended up duplicated in state,
            // which doubled chixuan's saved total when computeTotal
            // iterated `entries`.
            if (idx < 0) {
              idx = prev.findIndex(e =>
                !e.id &&
                e.entry_date === incoming.entry_date &&
                e.sort_order === incoming.sort_order,
              );
            }
            if (idx < 0) return sortEntries([...prev, incoming]);
            // Preserve any locally pending (dirty) fields for this row.
            const dirtyKey = `${incoming.entry_date}|${incoming.sort_order}`;
            const dirty = pendingUpdatesRef.current.get(dirtyKey) || {};
            const merged = { ...prev[idx], ...incoming, ...dirty };
            const copy = [...prev];
            copy[idx] = merged;
            return sortEntries(copy);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [enableRealtime, userId, periodId]);

  const flushUpdates = useCallback(async () => {
    const updates = new Map(pendingUpdatesRef.current);
    pendingUpdatesRef.current.clear();
    if (updates.size === 0) return;

    setIsSaving(true);
    for (const [key, upd] of updates.entries()) {
      const [entryDate, sortOrderStr] = key.split('|');
      const sortOrder = parseInt(sortOrderStr);

      // Find current row state so buildAuditFields can judge the effective
      // post-merge shape (e.g. pure day-off toggle → auto-approve).
      const existingRow = entriesRef.current.find(
        e => e.entry_date === entryDate && e.sort_order === sortOrder
      );
      const effectiveRow = { ...(existingRow || {}), ...upd };
      const audit = buildAuditFields(effectiveRow);

      const { data, error } = await supabase
        .from('salary_entries')
        .upsert(
          {
            user_id: userId!,
            period_id: periodId!,
            entry_date: entryDate,
            sort_order: sortOrder,
            ...upd,
            ...audit,
          },
          { onConflict: 'user_id,period_id,entry_date,sort_order' }
        )
        .select()
        .single();
      if (error) {
        console.error('Failed to save entry:', error);
        continue;
      }
      // Belt-and-braces against the duplicate-row bug: if our local
      // state still has an id-less optimistic placeholder for this
      // (entry_date, sort_order) — i.e. the realtime echo hasn't
      // landed yet — stamp the server-generated id onto it now so a
      // late realtime INSERT can find it by id and merge instead of
      // appending a duplicate.
      if (data) {
        const saved = data as SalaryEntry;
        setEntries(prev => {
          const idx = prev.findIndex(e =>
            !e.id &&
            e.entry_date === entryDate &&
            e.sort_order === sortOrder,
          );
          if (idx < 0) return prev;
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...saved };
          return copy;
        });
      }
    }
    setIsSaving(false);
  }, [userId, periodId, buildAuditFields]);

  const updateEntry = useCallback((
    entryDate: string,
    sortOrder: number,
    updates: Partial<SalaryEntry>
  ) => {
    // Optimistic local update
    setEntries(prev => {
      const idx = prev.findIndex(e => e.entry_date === entryDate && e.sort_order === sortOrder);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...updates };
        return copy;
      }
      // New entry
      return sortEntries([...prev, {
        ...buildEmptyEntry(userId!, periodId!, entryDate, sortOrder),
        ...updates,
      }]);
    });

    // Queue for debounced save
    const key = `${entryDate}|${sortOrder}`;
    const existing = pendingUpdatesRef.current.get(key) || {};
    pendingUpdatesRef.current.set(key, { ...existing, ...updates });

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushUpdates, 1500);
  }, [userId, periodId, flushUpdates]);

  // Flush pending updates on unmount or when userId/periodId changes
  const flushRef = useRef(flushUpdates);
  useEffect(() => { flushRef.current = flushUpdates; }, [flushUpdates]);
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // Fire-and-forget flush of any pending writes
      flushRef.current();
    };
  }, [userId, periodId]);

  const insertWithAudit = useCallback(async (base: Omit<SalaryEntry, 'id'>) => {
    const audit = buildAuditFields(base);
    return supabase
      .from('salary_entries')
      .insert({ ...base, ...audit })
      .select()
      .single();
  }, [buildAuditFields]);

  const addDuplicateRow = useCallback(async (entryDate: string) => {
    if (!userId || !periodId) return;
    const existing = entries.filter(e => e.entry_date === entryDate);
    const maxSort = existing.reduce((max, e) => Math.max(max, e.sort_order), 0);
    const newEntry = buildEmptyEntry(userId, periodId, entryDate, maxSort + 1, true); // active by default for extra rows

    const { data, error } = await insertWithAudit(newEntry);
    if (error) { console.error('Failed to add duplicate row:', error); return; }
    if (data) {
      setEntries(prev => sortEntries([...prev, data as SalaryEntry]));
    }
  }, [userId, periodId, entries, insertWithAudit]);

  const addRowAtDate = useCallback(async (entryDate: string) => {
    if (!userId || !periodId) return;
    const existing = entries.filter(e => e.entry_date === entryDate);
    const nextSortOrder = existing.length === 0
      ? 0
      : existing.reduce((max, e) => Math.max(max, e.sort_order), 0) + 1;
    const newEntry = buildEmptyEntry(userId, periodId, entryDate, nextSortOrder, false); // inactive by default

    const { data, error } = await insertWithAudit(newEntry);
    if (error) { console.error('Failed to add row at date:', error); return; }
    if (data) {
      setEntries(prev => sortEntries([...prev, data as SalaryEntry]));
    }
  }, [userId, periodId, entries, insertWithAudit]);

  const moveEntryToDate = useCallback(async (id: string, currentEntryDate: string, currentSortOrder: number, nextEntryDate: string) => {
    if (!userId || !periodId || currentEntryDate === nextEntryDate) return;

    const targetEntries = entries.filter(e => e.entry_date === nextEntryDate && e.id !== id);
    const nextSortOrder = targetEntries.length === 0
      ? 0
      : targetEntries.reduce((max, e) => Math.max(max, e.sort_order), 0) + 1;

    setEntries(prev => sortEntries(prev.map(entry =>
      entry.id === id
        ? { ...entry, entry_date: nextEntryDate, sort_order: nextSortOrder }
        : entry
    )));

    pendingUpdatesRef.current.delete(`${currentEntryDate}|${currentSortOrder}`);

    const movedRow = entriesRef.current.find(e => e.id === id);
    const audit = buildAuditFields(movedRow ? { ...movedRow, entry_date: nextEntryDate, sort_order: nextSortOrder } : undefined);
    const { error } = await supabase
      .from('salary_entries')
      .update({ entry_date: nextEntryDate, sort_order: nextSortOrder, ...audit })
      .eq('id', id);
    if (error) console.error('Failed to move entry to another date:', error);
  }, [userId, periodId, entries, buildAuditFields]);

  const removeEntry = useCallback(async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    const { error } = await supabase.from('salary_entries').delete().eq('id', id);
    if (error) console.error('Failed to remove entry:', error);
  }, []);

  const acceptEntry = useCallback(async (id: string) => {
    // Admin one-click accept — flip reviewed flag.
    setEntries(prev => prev.map(e => e.id === id ? { ...e, is_admin_reviewed: true } : e));
    const { error } = await supabase
      .from('salary_entries')
      .update({ is_admin_reviewed: true })
      .eq('id', id);
    if (error) console.error('Failed to accept entry:', error);
  }, []);

  return {
    entries,
    loading,
    updateEntry,
    addDuplicateRow,
    addRowAtDate,
    moveEntryToDate,
    removeEntry,
    acceptEntry,
    isSaving,
  };
}
