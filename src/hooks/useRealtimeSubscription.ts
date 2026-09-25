import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Subscribe to Supabase Realtime changes on a given table.
 * Calls `onChanged` whenever an INSERT, UPDATE, or DELETE event occurs.
 *
 * Usage:
 *   useRealtimeSubscription('companies', loadCompanies);
 *   useRealtimeSubscription('contacts', loadContacts, { filter: 'company_id=eq.abc' });
 */
export function useRealtimeSubscription(
  table: string,
  onChanged: () => void,
  options?: { filter?: string; event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*' }
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(onChanged);

  // Keep callback ref fresh without re-subscribing
  useEffect(() => {
    callbackRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    const event = options?.event ?? '*';
    const channelName = `realtime:${table}:${options?.filter ?? 'all'}`;

    const filterConfig: Record<string, string> = {
      event,
      schema: 'public',
      table,
    };
    if (options?.filter) {
      filterConfig.filter = options.filter;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        filterConfig,
        () => {
          callbackRef.current();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, options?.filter, options?.event]);
}
