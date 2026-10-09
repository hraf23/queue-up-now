import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Scissors, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import photo from "@/assets/barber-shop.jpg";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ mode: s.mode === "signup" ? "signup" : "login" }),
  head: () => ({ meta: [{ title: "Connexion et inscription — NextChair" }, { name: "description", content: "Retrouvez votre salon et votre profil NextChair." }, { property: "og:title", content: "Votre compte — NextChair" }, { property: "og:description", content: "Connectez-vous à votre espace barbier ou client." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AuthPage,
});
function AuthPage() {
  const { mode } = Route.useSearch();
  const signup = mode === "signup";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [forgot, setForgot] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { if (user) navigate({ to: "/account", replace: true }); }, [user, navigate]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setNotice("Si un compte existe, vous recevrez un lien pour réinitialiser votre mot de passe.");
      } else if (signup) {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setNotice("Consultez votre boîte e-mail et confirmez votre adresse pour activer votre compte.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setError(message.includes("Invalid login") ? "Adresse e-mail ou mot de passe incorrect." : message.includes("Email not confirmed") ? "Confirmez votre adresse e-mail avant de vous connecter." : message.includes("already registered") ? "Cette adresse est déjà utilisée. Connectez-vous." : "Impossible de continuer. Vérifiez vos informations ou réessayez dans un instant.");
    } finally { setBusy(false); }
  }
  async function google() {
    setBusy(true); setError("");
    try { const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth` }); if (result.error) throw result.error; }
    catch { setError("La connexion Google a échoué. Réessayez."); }
    finally { setBusy(false); }
  }
  return <><SiteHeader /><main className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:grid-cols-2 md:py-14">
    <section className="hidden md:block"><img src={photo} width={1536} height={1024} alt="Un barbier accueille son client dans son salon" className="aspect-[4/3] w-full rounded-lg object-cover" /><div className="mt-6 flex items-center gap-2 text-primary"><Scissors /><span className="text-sm font-semibold uppercase">Barbiers & clients</span></div><h2 className="mt-3 font-display text-5xl">Le bon fauteuil.<br />Au bon moment.</h2></section>
    <section className="mx-auto w-full max-w-md self-center"><Button variant="ghost" asChild className="mb-6 px-0"><Link to="/"><ArrowLeft />Accueil</Link></Button>
      <h1 className="font-display text-5xl">{forgot ? "Mot de passe oublié ?" : signup ? "Bienvenue chez NextChair" : "Heureux de vous revoir"}</h1>
      <p className="mt-3 text-muted-foreground">{forgot ? "Recevez un lien par e-mail." : signup ? "Votre salon. Votre profil. Votre prochain tour." : "Retrouvez votre salon et vos clients."}</p>
      {!forgot && <><div className="mt-6 grid grid-cols-2 border-b"><Button variant={signup ? "ghost" : "secondary"} onClick={() => {setError("");setNotice("");navigate({ to: "/auth", search: { mode: "login" } });}}>Connexion</Button><Button variant={signup ? "secondary" : "ghost"} onClick={() => {setError("");setNotice("");navigate({ to: "/auth", search: { mode: "signup" } });}}>Inscription</Button></div><Button variant="outline" className="mt-6 h-12 w-full" onClick={google} disabled={busy}>Continuer avec Google</Button><div className="my-5 text-center text-xs text-muted-foreground">ou par e-mail</div></>}
      <form onSubmit={submit} className="space-y-4">
        {signup && !forgot && <div><label htmlFor="display-name" className="mb-2 block text-sm font-semibold">Votre nom</label><Input id="display-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required maxLength={60} className="h-12" /></div>}
        <div><label htmlFor="email" className="mb-2 block text-sm font-semibold">Adresse e-mail</label><Input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required className="h-12" /></div>
        {!forgot && <div><label htmlFor="password" className="mb-2 block text-sm font-semibold">Mot de passe</label><Input id="password" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} value={password} onChange={e => setPassword(e.target.value)} required className="h-12" />{signup && <p className="mt-1 text-xs text-muted-foreground">8 caractères minimum</p>}</div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{notice && <p role="status" className="rounded-md bg-success/10 p-3 text-sm text-foreground"><Mail className="mb-2 h-5 w-5 text-success" />{notice}</p>}
        <Button type="submit" className="h-12 w-full" disabled={busy}>{busy ? "Un instant…" : forgot ? "Envoyer le lien" : signup ? "Créer mon compte" : "Se connecter"}<ArrowRight /></Button>
      </form>
      {!signup && <Button variant="link" className="mt-3 px-0" onClick={() => {setForgot(!forgot);setNotice("");setError("");}}>{forgot ? "Revenir à la connexion" : "Mot de passe oublié ?"}</Button>}
    </section>
  </main></>;
}
