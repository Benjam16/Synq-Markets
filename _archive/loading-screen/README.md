# Loading screen (archived)

This folder contains the loading screen that was removed from the platform. Everything is kept here so it can be re-enabled or reused later.

## Contents

- **PortalLoader.tsx** — Full loader component (Verbose Boot → Grid Reconstruction → Market Heartbeat for authenticated users). Depends on `framer-motion`, `@solana/wallet-adapter-react`.
- **globals-loader-snippet.css** — CRT flicker keyframes used by the boot stage. This was removed from `app/globals.css`; add it back if you restore the loader.
- **LOADING_SCREEN_IDEAS.md** — Notes and future ideas for the loader.

## How to restore

1. Copy `PortalLoader.tsx` into `app/components/PortalLoader.tsx`.
2. In `app/layout.tsx`, import `PortalLoader` and wrap the app content with `<PortalLoader>{...}</PortalLoader>` (inside `ClientWalletProvidersWrapper`).
3. Add the contents of `globals-loader-snippet.css` to `app/globals.css` (for the `.portal-crt-flicker` class used in the boot stage).
