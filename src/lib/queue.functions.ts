import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "shop"
  );
}

export const createShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ name: z.string().trim().min(1).max(60), avgMinutes: z.number().int().min(5).max(120) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const slug = `${slugify(data.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: shop, error } = await db
      .from("shops")
      .insert({ name: data.name, slug, avg_cut_minutes: data.avgMinutes, owner_id: context.userId })
      .select()
      .single();
    if (error || !shop) throw new Error("Impossible de créer le salon");
    const adminKey = crypto.randomUUID().replace(/-/g, "");
    const { error: e2 } = await db.from("shop_secrets").insert({ shop_id: shop.id, admin_key: adminKey });
    if (e2) throw new Error("Impossible de créer le salon");
    return { slug, adminKey };
  });

export const joinQueue = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ shopId: z.string().uuid(), name: z.string().trim().min(1).max(30) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("queue_entries")
      .insert({ shop_id: data.shopId, name: data.name })
      .select("id")
      .single();
    if (error || !row) throw new Error("Impossible de rejoindre la file");
    return { id: row.id };
  });

export const leaveQueue = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ entryId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    await db
      .from("queue_entries")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.entryId)
      .in("status", ["waiting", "called"]);
    return { ok: true };
  });

const ACTIONS = {
  call: { status: "called", field: "called_at" },
  start: { status: "in_chair", field: "started_at" },
  done: { status: "done", field: "finished_at" },
  noshow: { status: "no_show", field: "finished_at" },
} as const;

export const verifyKey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ shopId: z.string().uuid(), key: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: s } = await db.from("shop_secrets").select("admin_key").eq("shop_id", data.shopId).maybeSingle();
    return { ok: !!s && s.admin_key === data.key };
  });

export const barberAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        shopId: z.string().uuid(),
        key: z.string().min(10),
        entryId: z.string().uuid(),
        action: z.enum(["call", "start", "done", "noshow"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: s } = await db.from("shop_secrets").select("admin_key").eq("shop_id", data.shopId).maybeSingle();
    if (!s || s.admin_key !== data.key) throw new Error("Accès non autorisé");
    const a = ACTIONS[data.action];
    const { error } = await db
      .from("queue_entries")
      .update({ status: a.status, [a.field]: new Date().toISOString() })
      .eq("id", data.entryId)
      .eq("shop_id", data.shopId);
    if (error) throw new Error("La mise à jour a échoué");
    return { ok: true };
  });

export const getAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profile, shops] = await Promise.all([
      context.supabase.from("profiles").select("display_name,avatar_url").eq("id", context.userId).single(),
      context.supabase.from("shops").select("id,slug,name,avg_cut_minutes").eq("owner_id", context.userId).order("created_at", { ascending: false }),
    ]);
    if (profile.error || shops.error) throw new Error("Impossible de charger votre espace");
    return { profile: profile.data, shops: shops.data ?? [] };
  });

export const openOwnedBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ shopId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: shop } = await context.supabase.from("shops").select("id,slug").eq("id", data.shopId).eq("owner_id", context.userId).maybeSingle();
    if (!shop) throw new Error("Accès non autorisé");
    const db = await admin();
    const { data: secret } = await db.from("shop_secrets").select("admin_key").eq("shop_id", shop.id).single();
    if (!secret) throw new Error("Impossible d’ouvrir le salon");
    return { slug: shop.slug, key: secret.admin_key };
  });
