import { Link, useNavigate } from "@tanstack/react-router";
import { Scissors, UserRound, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }
  return <header className="border-b bg-background"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
    <Link to="/" className="flex items-center gap-2"><Scissors className="h-6 w-6 text-primary" /><span className="font-display text-3xl">NextChair<span className="text-primary">.</span></span></Link>
    <nav className="flex items-center gap-2">{!loading && (user ? <><Button variant="ghost" asChild><Link to="/account"><UserRound />Mon espace</Link></Button><Button variant="ghost" size="icon" onClick={signOut} aria-label="Se déconnecter" title="Se déconnecter"><LogOut /></Button></> : <><Button variant="ghost" asChild><Link to="/auth">Connexion</Link></Button><Button asChild className="hidden sm:inline-flex"><Link to="/auth" search={{ mode: "signup" }}>Créer un compte</Link></Button></>)}</nav>
  </div></header>;
}