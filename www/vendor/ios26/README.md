# Community iOS design tokens

Adapted from [ios26-design-system](https://github.com/seunghan91/ios26-design-system),
commit `e7e9249f2831dd7c52a9e04ff67f06fee4caeaad`, `packages/svelte/tokens.css`.
MIT license retained alongside the subset. Only typography and palette tokens are
reused, scoped to the clock and stocks widgets. Widget rendering is our own code.
This is not an official Apple package; no Apple fonts or proprietary assets ship.

Stocks use Yahoo Finance's public chart endpoint through the home service, with
a five-minute cache, per-symbol failure handling, and timestamps. Availability
and delays depend on the upstream provider; no real-time data guarantee is made.
Watchlists and widget layout remain in browser storage, not in this repository.
