# esg-connect

The sign-in and consent page for the ESG Suite's Claude connector (Supabase Auth OAuth 2.1, authorization path `/oauth/consent`),
served by GitHub Pages at https://jds441.github.io/esg-connect/oauth/consent/. The page is generated from `consent_page.ts` in the ESG Dashboard repository.

- `oauth/consent/index.html` - the page. A Content-Security-Policy allows scripts from this origin only and network calls to the
  ESG Supabase project only; the page hides itself and refuses to run inside another site's frame.
- `oauth/consent/consent.js` - the logic, generated from `supabase/functions/esg-mcp-test/consent_page.ts` in the ESG Dashboard repository (its source of truth); only the supabase-js loading differs.
- `oauth/consent/supabase-2.118.0.js` - supabase-js 2.118.0, `dist/umd/supabase.js` from the npm tarball (registry integrity
  checked), sha256 `ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3`, pinned in index.html by SRI.

No secret is held here: only the Supabase project URL and its publishable key, which are public by design.
The password typed into the page never leaves it; only a derived sign-in secret goes to Supabase's password grant.
Changes go through review by the owner only. Do not add collaborators, third-party scripts or analytics.
