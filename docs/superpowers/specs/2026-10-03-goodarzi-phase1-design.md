# goodarzi.isigpu.local — Phase 1 design

Date: 2026-10-03 · Status: approved in chat, awaiting written-spec review

## 1. Goal

Run the dorjService React frontend (this repo) live on
`https://goodarzi.isigpu.local`. It should use the same real backends, the
same SSO and the same per-user data as `platform.isigpu.local`, without
changing anything on `platform.isigpu.local`.

Phase 1 is done when a real platform user can sign in at
goodarzi.isigpu.local and see every page the frontend already has
populated with **their own real data**. No mock data may be served in
production, and no page may show invented numbers.

### Program context (agreed decomposition)

| Phase | Scope | This spec |
|---|---|---|
| 1 | Deploy on goodarzi + remove mock + wire existing pages to real backends + SSO | **yes** |
| 2 | User-side actions: notebook create/start/stop/delete/resize/logs/YAML/SSH/console, volume create/delete/viewer/autoresize, VM actions + serial/VNC console, backup/restore, mail, cost | no — own spec |
| 3 | Admin panel parity (~120 `/api/admin/*` endpoints) | no — own spec |

Kubeflow Pipelines, Katib, KServe and Tensorboards are out of scope for
every phase because they are not in platform.isigpu.local's menu.

### What the user said vs. what is assumed

- Said: deploy on goodarzi.isigpu.local, test it, and add any platform
  capability the frontend lacks. The phase order 1→2→3 was accepted.
- Assumed (stated in chat, not objected to): Phase 1 covers *read* parity
  for existing pages. Mutating actions belong to Phase 2/3. Any UI control
  whose action is not wired in Phase 1 is either hidden or shown disabled
  with a "به‌زودی" (soon) label. It must never pretend to succeed.

## 2. Current state (as found)

- Stack: React 19 + Vite 8 + Tailwind 4 (Figma Make export), hash
  routing (`#/notebooks`, `#/admin-panel`, …), RTL Persian, Vazirmatn fonts.
- `npm ci && vite build` passes. The bundle is ~345 KB JS and ~69 KB CSS.
- `src/main.tsx` always calls `installMockApi()`. That wraps
  `window.fetch` and answers every `/api/*` and `/admin-panel/api/*`
  request from `src/lib/mock.js`, and returns `{ok:true}` for every
  non-GET request.
- The request paths already match the real backends:
  - `kubeflow-resource-usage` (Flask, `kubeflow` ns, :8000): dashboard-*,
    resource-usage, notebooks, volumes, vms, backups, restores, mail, branding.
  - `kubeflow-admin-panel` (:8000): reached as `/admin-panel/api/*` (rewritten
    to `/api/*`) and `/api/admin/*`.
  - `kubeflow-change-password`: `/api/change-password`.
  - `centraldashboard` backend (catch-all `/`): `/api/workgroup/*`.
- Backends identify the user by the `kubeflow-userid` header. Istio sets
  that header from the Dex JWT after oauth2-proxy ext-authz.

## 3. Architecture

```
browser ──https──> nginx-ingress (goodarzi.isigpu.local, TLS: isigpu-ca-issuer)
                      │  (Host header preserved)
                      ▼
               istio-ingressgateway ── ext-authz ──> oauth2-proxy ──> Dex ──> Keycloak
                      │  kubeflow-gateway, existing host "*" VirtualServices
                      ├── authority=goodarzi.isigpu.local AND
                      │   uri exact "/" "/robots.txt" | prefix "/assets/"
                      │   "/fonts/" "/img/"             ──> dorj-service (nginx, static dist/)
                      ├── /api/resource-usage, /api/notebooks, …   ──> kubeflow-resource-usage
                      ├── /admin-panel/api, /api/admin             ──> kubeflow-admin-panel
                      ├── /api/change-password                     ──> kubeflow-change-password
                      ├── /notebook/*, /dex, /oauth2               ──> (existing, unchanged)
                      └── everything else (catch-all "/")          ──> centraldashboard
```

The new VirtualService is not a catch-all, because it carries an `authority`
match. Istio orders it ahead of centraldashboard's catch-all `/`. It
matches only static-asset paths, so it never shadows any `/api`,
`/notebook` or `/ws` route on either host.

Why this approach: it reuses the existing auth chain unchanged. The first
fplatform attempt failed on three RBAC bugs, and all three came from a
hand-built auth replica drifting from the real one. Rejected alternatives:

- (B) A host-specific VirtualService with copied routes. It would lose
  per-notebook VirtualServices created later.
- (C) The pod's own nginx proxying `/api`. The HTML would be served
  unauthenticated, and there would be a second auth path.

### Prerequisite to verify first (plan task 0)

Before any frontend wiring, confirm that oauth2-proxy and Dex complete a
login on the new host. oauth2-proxy uses `relative_redirect_url = true`
and sets no cookie domain, so the cookie is per-host. The Dex static client
used by oauth2-proxy needs `https://goodarzi.isigpu.local/oauth2/callback`
added to its `redirectURIs`. That change only adds an entry. If login
cannot be made to work on the new host without changing platform's auth
behaviour, stop and return to the user.

## 4. Frontend changes

### 4.1 Mock gating
- `installMockApi()` runs only when `import.meta.env.DEV` is set, or when
  the URL carries `?mock=1` *and* the build is a dev build.
- The production bundle must not contain the mock module. A test checks
  `dist/` for a mock-only marker string.

### 4.2 API layer
- `src/lib/api.js` keeps the signatures `api()`, `apiPost()` and `useApi()`,
  and gains a typed error result:
  - `401`: `location.reload()`, once per 10 s (guarded in `sessionStorage`
    inside try/catch), so oauth2-proxy re-runs login.
  - `403` / `404` / `5xx` / network error: `{ data: null, error: {status, message} }`.
    `useApi` exposes `error`.
- The GET cache gets a TTL (30 s) and an `invalidate(prefix)` helper. That
  way a page re-visit shows fresh data.
- Per-endpoint adapters live in `src/lib/adapters/<area>.js`. They map the
  real JSON shape (taken from `kubeflow-resource-usage/server.py`,
  `kubeflow-admin-panel/server.py` and centraldashboard sources) to the
  props each page already uses. Each adapter is a pure function with
  unit tests.

### 4.3 Identity, namespace, session
- Current user and namespaces come from `/api/workgroup/env-info`
  (centraldashboard). The namespace selector lists that user's namespaces.
  The selected namespace is stored per viewer in `localStorage` (try/catch)
  and passed as `?ns=` where the backend accepts it.
- Admin visibility: the "پنل مدیریت" menu item and `#/admin-panel` render
  only if `/api/admin/whoami` reports admin. Otherwise the route shows a
  403 message.
- Logout goes to `/oauth2/sign_out`, using the same redirect chain that
  platform.isigpu.local uses today, so the Keycloak session also ends.
- Change password posts to the real `/api/change-password`, with the
  backend's validation errors shown inline.
- The `#/login` page and its route are removed, because Keycloak owns login.

### 4.4 Pages — Phase 1 data wiring

| Page | Endpoints (GET unless noted) |
|---|---|
| Header / shell | `/api/branding`, `/api/resource-usage`, env-info, whoami |
| Dashboard | `/api/dashboard-summary`, `/api/dashboard-usage-history`, `/api/dashboard-cost`, `/api/notebooks` (recent) |
| Notebooks | `/api/notebooks`, `/api/notebooks/options` |
| Volumes | `/api/volumes`, `/api/volumes/quota`, `/api/backups`, `/api/restores` |
| VMs | `/api/vms/enabled`, `/api/vms` |
| Usage | `/api/resource-usage`, `/api/dashboard-usage-history`, `/api/dashboard-cost` |
| Mail | `/api/mail/folders`, `/api/mail/messages`, `/api/mail/message`; POST `/api/mail/seen` |
| Admin (read-only lists) | `/admin-panel/api/admin/{profiles,users,groups,models,gpu-passthrough,sla-nodes,whoami}` |
| Help | static, text kept |

Rules:
- If a UI element has no backing field in the real response, remove it.
  If it belongs to Phase 2/3, show it disabled with "به‌زودی". Never fake it.
- Empty real data (no notebooks, no mailbox, VMs disabled) gets a proper
  empty state.
- Every mutating button that is not wired is disabled with "به‌زودی". The
  only exceptions in Phase 1 are mail "seen", change password and logout,
  which are wired.

## 5. Deployment (k8s-deploy repo)

New script `scripts/1NN-deploy-dorj-service.sh`, styled after script 132.
It is idempotent and has `--rollback`.

1. Build: `npm ci && npm run build`, then `Dockerfile` (`nginx:alpine` +
   `dist/` + an nginx.conf with SPA fallback and long cache for `/assets/`
   and `no-cache` for `index.html`). The image is pushed to the local
   registry as `dorj-service:<DORJ_SERVICE_TAG>` (starting at `0.1.0`).
2. Namespace `dorj-service`, labelled `istio-injection=enabled`.
   Deployment (1 replica, non-root, readiness `/`), Service :80.
3. Istio:
   - A VirtualService in `dorj-service` on `kubeflow/kubeflow-gateway`,
     hosts `["*"]`, routes as in §3.
   - An AuthorizationPolicy that lets the gateway's SA reach the pod. It
     follows the existing per-app pattern, because `global-deny-all` is in
     force.
4. Ingress `istio-system/goodarzi` on host `goodarzi.isigpu.local` →
   `istio-ingressgateway:80`, with TLS by cert-manager `isigpu-ca-issuer`
   and the same timeouts and force-ssl as the `kubeflow` ingress.
5. Add the Dex redirect URI (§3).
6. DNS: add `goodarzi.isigpu.local → 172.16.50.202` wherever the other
   `*.isigpu.local` names are defined (find the mechanism in the plan;
   do not guess).
7. Rollback: delete the 4 objects plus the namespace, and remove the Dex
   redirect URI. platform.isigpu.local is untouched throughout.

Air-gap note: the image build follows the existing build path. If npm or
the base image needs the VPN tunnel, use it the way the other app builds do.

## 6. Testing

- **Unit (Vitest, new devDependency)**: every adapter against fixtures
  that copy the backend's return shape, plus a fixture for each error
  state. Also `api.js` 401/403/5xx handling and the cache TTL/invalidate.
- **Build gate**: `npm run build` succeeds, and `dist/` contains no mock
  marker.
- **Live e2e (Playwright, run from the deploy node)**, using a test user
  whose credentials the user provides:
  - Log in on goodarzi.isigpu.local.
  - Visit every route.
  - Assert every `/api/*` response is real (status 200, not served by the mock).
  - Assert the namespace shown equals the user's namespace.
  - Log out and assert that a protected route redirects to login.
  - Repeat with an admin user for `#/admin-panel`.
- **Regression**: after deploy, platform.isigpu.local still logs in and
  its home page, notebooks and volumes load. This covers both a smoke
  curl and a short Playwright pass.
- No success claim without the command output (verification-before-completion).

## 7. Git & release

- Frontend: branch `goodarzi-phase1` in `/workdir/dorjService`. Commit and
  tag each verified feature (`goodarzi-p1-*`). Do **not** push to the GitHub
  origin (owned by mohammadMoazam5833) unless the user asks.
- Deploy script and manifests: committed to `/workdir/k8s-deploy` with the
  usual `VERSION` bump and tag. A memory note goes in after go-live.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Dex/oauth2-proxy won't accept the new host | Task 0 proves login first; stop and ask if it needs auth-behaviour changes |
| Istio VS ordering differs from expectation | Verify with `istioctl proxy-config routes` on the gateway before enabling DNS; check that platform routes are unchanged |
| Real response shapes differ from the mock | Adapters plus unit fixtures taken from backend source; e2e catches the rest |
| Features in UI with no backend | Hidden or "به‌زودی", per §4.4 rules |
| Users mistake goodarzi for production | It is a separate hostname; platform.isigpu.local stays primary |
