import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Scissors, Users, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchShop, useLiveQueue, useNow, mins, type Shop } from "@/lib/queue-data";
import { joinQueue, leaveQueue } from "@/lib/queue.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/s/$slug/")({
  loader: async ({ params }) => {
    const shop = await fetchShop(params.slug);
    if (!shop) throw notFound();
    return { shop };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Join the line at ${loaderData.shop.name}` : "Shop not found" },
      { name: "description", content: "Take your turn and watch your spot in line live." },
      { property: "og:title", content: loaderData ? `Join the line at ${loaderData.shop.name}` : "NextChair" },
      { property: "og:description", content: "Take your turn and watch your spot in line live." },
    ],
  }),
  component: ClientPage,
  notFoundComponent: () => <Center>This shop link doesn’t exist.</Center>,
  errorComponent: () => <Center>Couldn’t load this shop. Refresh to try again.</Center>,
});

function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center p-6 text-center text-muted-foreground">{children}</div>;
}

function ClientPage() {
  const { shop } = Route.useLoaderData();
  const storeKey = `nc-entry-${shop.id}`;
  const [entryId, setEntryId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setEntryId(localStorage.getItem(storeKey));
    setReady(true);
  }, [storeKey]);
  const { entries, loaded } = useLiveQueue(shop.id);

  const setEntry = (id: string | null) => {
    if (id) localStorage.setItem(storeKey, id);
    else localStorage.removeItem(storeKey);
    setEntryId(id);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="pole h-2" />
      <header className="mx-auto flex w-full max-w-md items-center gap-2 px-5 pt-6">
        <Scissors className="h-5 w-5 shrink-0 text-primary" />
        <span className="truncate font-display text-2xl tracking-wide">{shop.name}</span>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6">
        {!ready || !loaded ? null : entryId ? (
          <Status shop={shop} entryId={entryId} entries={entries} onClear={() => setEntry(null)} />
        ) : (
          <Join shop={shop} waiting={entries.filter((e) => e.status !== "in_chair").length} onJoined={setEntry} />
        )}
      </main>
    </div>
  );
}

function Join({ shop, waiting, onJoined }: { shop: Shop; waiting: number; onJoined: (id: string) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await joinQueue({ data: { shopId: shop.id, name } });
      onJoined(r.id);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={Users} label="In line" value={String(waiting)} />
        <Stat icon={Clock} label="Est. wait" value={`~${waiting * shop.avg_cut_minutes}m`} />
      </div>
      <form onSubmit={go} className="mt-6 rounded-3xl border bg-card p-6">
        <h1 className="font-display text-4xl leading-none">Take your turn</h1>
        <p className="mt-2 text-sm text-muted-foreground">Just your name — we’ll show you when you’re up.</p>
        <Input autoFocus className="mt-5 h-14 text-lg" placeholder="Name or nickname" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required />
        <Button type="submit" disabled={busy || !name.trim()} className="mt-4 h-14 w-full text-lg font-semibold">
          {busy ? "Joining…" : "Join queue"}
        </Button>
      </form>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary p-4 text-secondary-foreground">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider opacity-70">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 font-display text-4xl">{value}</div>
    </div>
  );
}

function Status({ shop, entryId, entries, onClear }: { shop: Shop; entryId: string; entries: ReturnType<typeof useLiveQueue>["entries"]; onClear: () => void }) {
  const now = useNow();
  const me = entries.find((e) => e.id === entryId);
  const [finalStatus, setFinalStatus] = useState<string | null>(null);
  const [joinedTotal, setJoinedTotal] = useState<number | null>(null);
  const buzzed = useRef(false);

  const waitingLine = useMemo(() => entries.filter((e) => e.status === "waiting"), [entries]);
  const ahead = me ? waitingLine.findIndex((e) => e.id === me.id) : -1;
  const position = ahead + 1;

  useEffect(() => {
    if (me && me.status === "waiting" && joinedTotal === null) setJoinedTotal(Math.max(position, 1));
  }, [me, position, joinedTotal]);

  useEffect(() => {
    if (me) return;
    supabase.from("queue_entries").select("status").eq("id", entryId).maybeSingle().then(({ data }) => setFinalStatus(data?.status ?? "gone"));
  }, [me, entryId]);

  useEffect(() => {
    if (me?.status === "called" && !buzzed.current) {
      buzzed.current = true;
      navigator.vibrate?.([300, 150, 300, 150, 600]);
    }
  }, [me?.status]);

  if (!me) {
    if (!finalStatus) return null;
    const msg =
      finalStatus === "done" ? "Looking sharp! Thanks for coming." : finalStatus === "no_show" ? "You were marked as a no-show." : "You’re no longer in line.";
    return (
      <div className="rounded-3xl border bg-card p-8 text-center">
        <p className="font-display text-4xl">{msg}</p>
        <Button className="mt-6 h-12 w-full" onClick={onClear}>Join again</Button>
      </div>
    );
  }

  async function leave() {
    if (!confirm("Leave the queue?")) return;
    await leaveQueue({ data: { entryId } });
    onClear();
  }

  if (me.status === "called") {
    return (
      <div className="animate-in fade-in zoom-in-95">
        <div className="rounded-3xl bg-primary p-8 text-center text-primary-foreground shadow-xl">
          <div className="mx-auto mb-4 h-3 w-24 animate-pulse rounded-full bg-primary-foreground/60" />
          <p className="text-sm uppercase tracking-[0.2em] opacity-80">{me.name}</p>
          <h1 className="mt-2 font-display text-6xl leading-[0.9]">You’re up!</h1>
          <p className="mt-3 text-lg">Head to the chair now.</p>
          {me.called_at && <p className="mt-6 text-sm opacity-80">Called {mins(now - +new Date(me.called_at))} min ago</p>}
        </div>
        <LeaveBtn onClick={leave} />
      </div>
    );
  }

  if (me.status === "in_chair") {
    return (
      <div className="rounded-3xl bg-success p-8 text-center text-success-foreground">
        <Scissors className="mx-auto h-10 w-10" />
        <h1 className="mt-3 font-display text-5xl">In the chair</h1>
        <p className="mt-2">Enjoy your cut, {me.name}.</p>
      </div>
    );
  }

  const inChair = entries.filter((e) => e.status !== "waiting").length;
  const etaMin = ahead * shop.avg_cut_minutes + (inChair > 0 || ahead > 0 ? Math.round(shop.avg_cut_minutes / 2) : 0);
  const waited = mins(now - +new Date(me.created_at));
  const total = joinedTotal ?? position;
  const progress = total > 0 ? Math.min(100, Math.max(6, ((total - position + 1) / (total + 1)) * 100)) : 100;
  const next = position === 1;

  return (
    <div>
      <div className={`rounded-3xl p-7 text-center ${next ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
        <p className="text-sm uppercase tracking-[0.2em] opacity-70">Hi {me.name}, you’re</p>
        <div className="font-display text-[9rem] leading-none">#{position}</div>
        <p className="text-lg font-semibold">{next ? "You’re next — stay close!" : `${ahead} ${ahead === 1 ? "person" : "people"} ahead of you`}</p>
        <div className="mt-6 h-3 overflow-hidden rounded-full bg-background/20">
          <div className="pole h-full rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Est. wait</div>
          <div className="font-display text-4xl">~{etaMin} min</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Waiting</div>
          <div className="font-display text-4xl">{waited} min</div>
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">Keep this page open — it updates live.</p>
      <LeaveBtn onClick={leave} />
    </div>
  );
}

function LeaveBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" className="mt-6 w-full text-muted-foreground" onClick={onClick}>
      <X className="mr-1 h-4 w-4" /> Leave queue
    </Button>
  );
}
