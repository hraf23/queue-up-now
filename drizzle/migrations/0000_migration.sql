CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  avg_cut_minutes int NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.shop_secrets (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  admin_key text NOT NULL
);
CREATE TABLE public.queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  called_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX ON public.queue_entries(shop_id, status, created_at);
GRANT SELECT ON public.shops TO anon, authenticated;
GRANT SELECT ON public.queue_entries TO anon, authenticated;
GRANT ALL ON public.shops, public.shop_secrets, public.queue_entries TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read shops" ON public.shops FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read queue" ON public.queue_entries FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE public.queue_entries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_entries;