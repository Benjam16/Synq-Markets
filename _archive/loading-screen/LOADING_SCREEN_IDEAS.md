# Loading Screen — Ideas & What’s Implemented

## Currently implemented (PortalLoader) — archived

- **Real loading states** — Progress and status text reflect actual work: “Loading markets…” → “Loading feed…” → “Almost ready…” based on `/api/markets/trending` and `/api/terminal/feed` prefetches.
- **Minimum / maximum time** — Loader shows at least ~1.8s (no flash), and auto-finishes by ~5s even if the network is slow.
- **Rotating tips** — Short product tips cycle every ~3.2s (e.g. “Connect Phantom or Solflare to start trading”, “Polymarket and Kalshi in one terminal”).
- **Return visits** — `sessionStorage` still skips the loader on repeat visits.
- **Accessibility** — Status and progress use `aria-live` so screen readers get updates; decorative SVG has `aria-hidden`.

---

## Ideas you could add later

1. **Skeleton preview**  
   In the last ~0.5s before transition, show a very light skeleton of the real layout (nav bar + hero block) so the transition to the real page feels seamless.

2. **“Taking longer than usual”**  
   If loading exceeds e.g. 4s, show a short message like “Taking longer than usual…” and keep or emphasize the Skip button.

3. **Reduced motion**  
   Respect `prefers-reduced-motion` and use a simple fade + progress bar (no starfield, rings, or warp) for users who prefer less motion.

4. **Error-aware messaging**  
   If prefetches fail (e.g. 5xx), still complete the loader but optionally set a flag so the first screen can show a soft “Some data is still loading” or retry.

5. **Short “Welcome back” for return visits**  
   Instead of skipping entirely, show a 0.5s splash with just the logo and “Welcome back” when `sessionStorage` indicates a returning user.

6. **Progress segments**  
   Show 3 segments (Markets | Feed | Ready) and fill each as that step completes, so progress feels more like real steps than a single bar.

7. **Themed or seasonal copy**  
   Rotate tips or status lines (e.g. around product launches or events) without changing the loader logic.

8. **Optional sound**  
   Very subtle “ready” sound when the loader finishes (with a user preference or off by default).

9. **Analytics**  
   Log loader duration to tune min/max times and copy.

10. **A/B test variants**  
    Try minimal vs. current “portal” style and measure bounce or engagement to pick a default.

Implementing any of these would be a small change on top of the current `PortalLoader` behavior.
