import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Shop = { id: string; slug: string; name: string; avg_cut_minutes: number };
export type Entry = {
  id: string;
  shop_id: string;
  name: string;
  status: string;
  created_at: string;
  called_at: string | null;
  started_at: string | null;
};

export const ACTIVE = ["waiting", "called", "in_chair"];

export async function fetchShop(slug: string): Promise<Shop | null> {
  const { data } = await supabase.from("shops").select("id,slug,name,avg_cut_minutes").eq("slug", slug).maybeSingle();
  return data;
}

export function useLiveQueue(shopId: string) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("queue_entries")
      .select("id,shop_id,name,status,created_at,called_at,started_at")
      .eq("shop_id", shopId)
      .in("status", ACTIVE)
      .order("created_at");
    setEntries(data ?? []);
    setLoaded(true);
  }, [shopId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`q-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `shop_id=eq.${shopId}` }, () => load())
      .subscribe();
    const t = setInterval(load, 30000);
    return () => {
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, [shopId, load]);

  return { entries, loaded, reload: load };
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function mins(ms: number) {
  return Math.max(0, Math.floor(ms / 60000));
}
