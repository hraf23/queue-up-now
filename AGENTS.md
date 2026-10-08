<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Queue writes go through server functions in src/lib/queue.functions.ts using the admin client; browsers only read shops/queue_entries (public SELECT + realtime). Why: no user accounts, so a per-shop admin key (shop_secrets, never readable by clients) gates barber actions.
