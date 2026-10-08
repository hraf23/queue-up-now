import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Scissors, Printer, Megaphone, Play, Check, UserX, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchShop, useLiveQueue, useNow, mins, type Entry } from "@/lib/queue-data";
import { barberAction, verifyKey } from "@/lib/queue.functions";

export const Route = createFileRoute("/s/$slug/board")({
  validateSearch: (s: Record<string, unknown>) => ({ key: typeof s.key === "string" ? s.key : undefined }),
  loader: async ({ params }) => {
    const shop = await fetchShop(params.slug);
    if (!shop) throw notFound();
    return { shop };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Barber board — ${loaderData.shop.name}` : "Barber board" },
      { name: "description", content: "Manage your walk-in queue live." },
      { property: "og:title", content: "Barber board — NextChair" },
      { property: "og:description", content: "Manage your walk-in queue live." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Board,
  notFoundComponent: () => <div className="p-10 text-center">Shop not found.</div>,
  errorComponent: () => <div className="p-10 text-center">Couldn’t load board.</div>,
});

function Board() {
  const { shop } = Route.useLoaderData();
  const search = Route.useSearch();
  const [key, setKey] = useState<string | null>(null);
  const [auth, setAuth] = useState<"checking" | "ok" | "no">("checking");

  useEffect(() => {
    const k = search.key ?? localStorage.getItem(`nc-key-${shop.slug}`);
    if (!k) return setAuth("no");
    verifyKey({ data: { shopId: shop.id, key: k } }).then((r) => {
      if (r.ok) {
        localStorage.setItem(`nc-key-${shop.slug}`, k);
        setKey(k);
        setAuth("ok");
      } else setAuth("no");
    });
  }, [search.key, shop]);

  if (auth === "checking") return null;
  if (auth === "no" || !key)
    return <div className="grid min-h-screen place-items-center p-6 text-center text-muted-foreground">This board needs the private link you got when creating the shop.</div>;
  return <BoardInner shopId={shop.id} shopName={shop.name} slug={shop.slug} avg={shop.avg_cut_minutes} adminKey={key} />;
}

function BoardInner({ shopId, shopName, slug, avg, adminKey }: { shopId: string; shopName: string; slug: string; avg: number; adminKey: string }) {
  const { entries, reload } = useLiveQueue(shopId);
  const now = useNow(15000);
  const [joinUrl, setJoinUrl] = useState("");
  const [boardUrl, setBoardUrl] = useState("");
  useEffect(() => {
    setJoinUrl(`${window.location.origin}/s/${slug}`);
    setBoardUrl(`${window.location.origin}/s/${slug}/board?key=${adminKey}`);
  }, [slug, adminKey]);

  const act = async (entryId: string, action: "call" | "start" | "done" | "noshow") => {
    await barberAction({ data: { shopId, key: adminKey, entryId, action } });
    reload();
  };

  const chair = entries.filter((e) => e.status === "in_chair");
  const called = entries.filter((e) => e.status === "called");
  const waiting = entries.filter((e) => e.status === "waiting");

  return (
    <div className="min-h-screen">
      <div className="pole h-2 print:hidden" />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_320px]">
        <main className="min-w-0 print:hidden">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Scissors className="h-5 w-5 shrink-0 text-primary" />
              <h1 className="truncate font-display text-3xl tracking-wide">{shopName}</h1>
            </div>
            <div className="rounded-full bg-secondary px-4 py-1.5 text-sm font-semibold text-secondary-foreground">
              {waiting.length} waiting · ~{waiting.length * avg}m
            </div>
          </header>

          <Section title="In the chair">
            {chair.length === 0 && <Empty>Chair is free</Empty>}
            {chair.map((e) => (
              <Row key={e.id} e={e} sub={`Started ${mins(now - +new Date(e.started_at ?? e.created_at))}m ago`} tone="success">
                <Button size="lg" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => act(e.id, "done")}>
                  <Check className="mr-1 h-4 w-4" /> Done
                </Button>
              </Row>
            ))}
          </Section>

          {called.length > 0 && (
            <Section title="Called — heading over">
              {called.map((e) => (
                <Row key={e.id} e={e} sub={`Called ${mins(now - +new Date(e.called_at ?? e.created_at))}m ago`} tone="accent">
                  <Button size="lg" onClick={() => act(e.id, "start")}>
                    <Play className="mr-1 h-4 w-4" /> Start cut
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => act(e.id, "noshow")}>
                    <UserX className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only sm:ml-1">No-show</span>
                  </Button>
                </Row>
              ))}
            </Section>
          )}

          <Section title="Waiting">
            {waiting.length === 0 && <Empty>No one in line. Point walk-ins to the QR code.</Empty>}
            {waiting.map((e, i) => (
              <Row key={e.id} e={e} idx={i + 1} sub={`Waiting ${mins(now - +new Date(e.created_at))}m`}>
                <Button size="lg" variant={i === 0 ? "default" : "secondary"} onClick={() => act(e.id, "call")}>
                  <Megaphone className="mr-1 h-4 w-4" /> Call
                </Button>
                <Button size="lg" variant="ghost" onClick={() => act(e.id, "noshow")} aria-label="No-show">
                  <UserX className="h-4 w-4" />
                </Button>
              </Row>
            ))}
          </Section>
        </main>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl border bg-card p-6 text-center print:border-0">
            <p className="font-display text-3xl">Scan to join the line</p>
            <p className="text-sm text-muted-foreground">{shopName}</p>
            <div className="mx-auto mt-4 w-fit rounded-2xl bg-card p-3">
              {joinUrl && <QRCodeSVG value={joinUrl} size={220} marginSize={1} />}
            </div>
            <p className="mt-3 break-all text-xs text-muted-foreground">{joinUrl}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-1 h-4 w-4" /> Print
              </Button>
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(joinUrl)}>
                <Copy className="mr-1 h-4 w-4" /> Copy link
              </Button>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-muted p-4 text-xs text-muted-foreground print:hidden">
            <p className="font-semibold text-foreground">Private board link — keep it safe</p>
            <button className="mt-1 break-all text-left underline" onClick={() => navigator.clipboard.writeText(boardUrl)}>
              {boardUrl}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">{children}</div>;
}
function Row({ e, sub, idx, tone, children }: { e: Entry; sub: string; idx?: number; tone?: "success" | "accent"; children: React.ReactNode }) {
  const ring = tone === "success" ? "border-success" : tone === "accent" ? "border-accent" : "";
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border-2 bg-card p-3 ${ring}`}>
      <div className="flex min-w-0 items-center gap-3">
        {idx !== undefined && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary font-display text-xl text-secondary-foreground">{idx}</span>
        )}
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{e.name}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </div>
  );
}
