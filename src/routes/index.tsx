import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Scissors, QrCode, Bell, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createShop } from "@/lib/queue.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NextChair — QR walk-in queue for barber shops" },
      { name: "description", content: "Let walk-ins scan, join the line and see their live wait. Run your queue in one tap." },
      { property: "og:title", content: "NextChair — QR walk-in queue for barber shops" },
      { property: "og:description", content: "Scan, join, get called. A zero-friction walk-in queue for barbers." },
    ],
  }),
  component: Index,
});

function Index() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [avg, setAvg] = useState(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await createShop({ data: { name, avgMinutes: avg } });
      localStorage.setItem(`nc-key-${r.slug}`, r.adminKey);
      nav({ to: "/s/$slug/board", params: { slug: r.slug }, search: { key: r.adminKey } });
    } catch {
      setErr("Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="pole h-3" />
      <main className="mx-auto grid max-w-5xl gap-12 px-5 py-12 md:grid-cols-2 md:py-20">
        <section>
          <div className="flex items-center gap-2 text-primary">
            <Scissors className="h-5 w-5" />
            <span className="font-display text-2xl tracking-wide">NextChair</span>
          </div>
          <h1 className="mt-6 font-display text-6xl leading-[0.9] md:text-7xl">
            No more “who’s next?”
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Walk-ins scan your QR code, drop their name, and watch their spot move live. You call them to the chair in one tap.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              [QrCode, "Print a QR code for the counter"],
              [Timer, "Live position & wait time on their phone"],
              [Bell, "“You’re up!” alert when it’s their turn"],
            ].map(([I, t], i) => {
              const Icon = I as typeof QrCode;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{t as string}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <form onSubmit={submit} className="self-start rounded-3xl border bg-card p-7 shadow-sm">
          <h2 className="font-display text-3xl">Open your shop’s queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">Takes 5 seconds. No account needed.</p>
          <label className="mt-6 block text-sm font-semibold">Shop name</label>
          <Input className="mt-2 h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fade Factory" required maxLength={60} />
          <label className="mt-5 block text-sm font-semibold">Average cut time: {avg} min</label>
          <input type="range" min={5} max={60} step={5} value={avg} onChange={(e) => setAvg(+e.target.value)} className="mt-3 w-full accent-primary" />
          {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
          <Button type="submit" disabled={busy || !name.trim()} className="mt-6 h-12 w-full text-base font-semibold">
            {busy ? "Creating…" : "Create queue"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">You’ll get a private barber board link — bookmark it.</p>
        </form>
      </main>
    </div>
  );
}
