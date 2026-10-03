# goodarzi.isigpu.local Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the dorjService React frontend live on `https://goodarzi.isigpu.local`, behind platform.isigpu.local's real SSO, with every existing page showing the signed-in user's real data and no mock data in production.

**Architecture:**
- nginx-ingress for `goodarzi.isigpu.local` sends traffic to the existing `istio-ingressgateway`.
- A new Istio VirtualService routes only `/`, `/index.html`, `/robots.txt`, `/assets/`, `/fonts/` and `/img/` (when the authority is goodarzi) to a new static nginx pod.
- Every `/api/*`, `/notebook/*`, `/dex` and `/oauth2` route stays on the existing host-`*` VirtualServices, so auth and data use the real platform chain unchanged.
- The shared oauth2-proxy switches to absolute per-host callback URLs (spec §3 rev 2), so SSO works on a second host.
- The frontend gains a small HTTP core with explicit errors, pure adapters from real backend JSON to the props the pages already use, and a session hook. Mock code runs only in `vite dev`.

**Tech Stack:** React 19, Vite 8, Node 22 (`node --test` for unit tests, no new unit-test dependency), Playwright 1.55.1 with system Chrome (`channel: "chrome"`) for e2e, `nginx:stable-alpine`, `node:20-alpine` (v20.20.2), Istio 1.28, oauth2-proxy v7.13.0, Dex, bash scripts styled after `k8s-deploy/scripts/132-deploy-dorj-site.sh`.

**Spec:** `docs/superpowers/specs/2026-10-03-goodarzi-phase1-design.md` (rev 2). Read it before starting.

## Global Constraints

- platform.isigpu.local must keep working throughout. The only shared objects changed are the oauth2-proxy ConfigMaps and the Dex ConfigMap (Task 2). Each change gets a timestamped backup and a `--rollback`.
- No mock data in production. `dist/` must not contain the marker string `__DORJ_MOCK_API__`.
- Never show invented numbers or names. Remove every hard-coded `godarzi`, `?? 5`, `?? 13`, `?? 6`, `?? 8`, `?? 9`, `?? 10` and `?? 32` fallback. Unknown values render as `—`.
- Mutating actions not wired in Phase 1 render disabled with the title `به‌زودی`. Only mail "seen", change password and logout are wired.
- Persian UI copy, RTL. Code identifiers and comments are in English.
- Git, in `/workdir/dorjService`: work on branch `goodarzi-phase1`. Commit at the end of every task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Tag `goodarzi-p1-<slug>` after each verified feature. **Never `git push`.**
- Git, in `/workdir/k8s-deploy`: commit the scripts, `k8s/*.tmpl` and `config.env.example`. `config.env`, `backups/` and `k8s/*.rendered.yml` are git-ignored, so never force-add them. After the final task, tag the next `v1.9xx.0` after `git tag --sort=-creatordate | head -1`.
- All kubectl calls go through `/workdir/k8s-deploy/inventory/mycluster/artifacts/kubectl.sh` (or `kc()` inside scripts).
- Live HTTP probes use `curl -sk --noproxy '*' --resolve <host>:443:172.16.50.202`.
- Playwright runs with proxy env vars unset and `ignoreHTTPSErrors: true`. It resolves `goodarzi.isigpu.local` via `--host-resolver-rules=MAP goodarzi.isigpu.local 172.16.50.202` until DNS exists.
- E2E credentials come only from the env vars `E2E_USER`, `E2E_PASS`, `E2E_ADMIN_USER` and `E2E_ADMIN_PASS`, which the user supplies. Never write them to files.

## Review Focus

1. **A session expires while a page is open.** The next `/api/*` call gets 401 (oauth2-proxy `api_routes` include `/api/`). Expected: one reload that re-runs login, never a reload loop. Test: `tests/http.test.js` "401 reloads at most once per 10 s".
2. **A user without a Profile** (backend raises `NamespaceResolutionError`, so 403 `{error}` on every resource-usage endpoint). Expected: a clear Persian error note, not empty tables pretending to be data. Test: `tests/http.test.js` "403 returns error with backend message", plus the ErrorNote render in Task 5.
3. **Absolute platform URLs in the data** (`notebook.url`, `volume.viewer_url` = `https://platform.isigpu.local/...`). Expected: links stay on goodarzi. Test: `tests/workloads.test.js` "relativeUrl strips platform host".
4. **Gaps in Prometheus series** (`[t, null]` points from `_range_points`). Expected: charts don't crash and don't plot null as zero. Test: `tests/metrics.test.js` "seriesValues keeps nulls out".
5. **The VirtualService shadowing other routes on either host**, which would break `/api` on goodarzi or `/` on platform. Expected: platform `/` still serves centraldashboard, and goodarzi `/api/*` still reaches the backends. Test: the Task 10 route-order check on the gateway's config_dump, plus the Task 11 e2e assertions on both hosts.

---

## File map

`/workdir/dorjService` (frontend):

| Path | Responsibility |
|---|---|
| `src/lib/http.js` (new) | Pure HTTP core: `getJson`, `send`, TTL cache, `invalidate`, error shape, 401 reload guard. No React. |
| `src/lib/api.js` (rewrite) | React-facing wrappers `api`, `apiPost`, `useApi`, built on http.js |
| `src/lib/adapters/workloads.js` (new) | notebooks, volumes, VMs, backups → page props; `relativeUrl` |
| `src/lib/adapters/metrics.js` (new) | usage-history points → numbers; cost → chart series |
| `src/lib/adapters/mail.js` (new) | mail page + message body |
| `src/lib/session.js` (new) | `useSession()`: email, namespace, isAdmin |
| `src/lib/soon.js` (new) | `SOON` title constant + `soonProps` |
| `src/components/ErrorNote.jsx` + `.css` (new) | Persian error banner for `{status,message}` |
| `src/lib/mock.js` (modify) | add the `__DORJ_MOCK_API__` marker |
| `src/main.tsx` (modify) | mock only when `import.meta.env.DEV` |
| `src/App.jsx`, `src/pages/Login.*` | remove the login route/page |
| pages and components listed per task | wiring |
| `tests/*.test.js` (new) | `node --test` unit tests |
| `scripts/check-dist.mjs` (new) | build gate |
| `Dockerfile`, `.dockerignore`, `deploy/nginx.conf` (new) | image |
| `e2e/playwright.config.js`, `e2e/*.spec.js` (new) | live e2e |

`/workdir/k8s-deploy` (infra):

| Path | Responsibility |
|---|---|
| `scripts/134-sso-absolute-redirect.sh` (new) | canary / apply / verify / rollback of the shared-SSO change |
| `scripts/135-deploy-dorj-service.sh` (new) | build, push, apply, route check, smoke |
| `k8s/dorj-service-manifest.yml.tmpl` (new) | ns, deploy, svc, VS, AuthorizationPolicy, ingress |
| `config.env.example` + `config.env` | `DORJ_SERVICE_*` vars |

---

### Task 1: E2E harness and platform-login baseline

The SSO change (Task 2) touches the shared login, so a real-login regression test must exist and pass against the **current** platform before anything changes.

**Files:**
- Modify: `/workdir/dorjService/package.json`
- Create: `/workdir/dorjService/e2e/playwright.config.js`
- Create: `/workdir/dorjService/e2e/login.js`
- Create: `/workdir/dorjService/e2e/platform-regression.spec.js`
- Modify: `/workdir/dorjService/.gitignore`

**Interfaces:**
- Produces: `login(page, baseURL, user, pass)` in `e2e/login.js`. It completes the Keycloak form and resolves after the browser is back on `baseURL`. Tasks 2 and 11 use it.

- [ ] **Step 1: Ask the user for credentials.** Ask in Finglish for a normal test user and an admin user. They export `E2E_USER`, `E2E_PASS`, `E2E_ADMIN_USER` and `E2E_ADMIN_PASS` in the session with `! export ...`. Don't continue Task 1 without them.

- [ ] **Step 2: Add Playwright and scripts to `package.json`.**

```bash
cd /workdir/dorjService && npm install --save-dev --save-exact @playwright/test@1.55.1
```

Then set `"scripts"` to:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "format": "oxfmt",
  "test": "node --test tests/",
  "check-dist": "node scripts/check-dist.mjs",
  "e2e": "playwright test -c e2e/playwright.config.js"
}
```

- [ ] **Step 3: Write `e2e/playwright.config.js`.**

```js
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    ignoreHTTPSErrors: true,
    locale: 'fa-IR',
    launchOptions: {
      args: ['--host-resolver-rules=MAP goodarzi.isigpu.local 172.16.50.202, MAP platform.isigpu.local 172.16.50.202, MAP identity.isigpu.local 172.16.50.202'],
    },
  },
})
```

- [ ] **Step 4: Write `e2e/login.js`.**

```js
import { expect } from '@playwright/test'

// Drives oauth2-proxy -> Dex -> Keycloak (#username/#password) and waits to land back on baseURL.
export async function login(page, baseURL, user, pass) {
  if (!user || !pass) throw new Error('E2E credentials missing (E2E_USER/E2E_PASS or E2E_ADMIN_USER/E2E_ADMIN_PASS)')
  await page.goto(baseURL + '/')
  await page.locator('#username').waitFor({ timeout: 30_000 })
  await page.locator('#username').fill(user)
  await page.locator('#password').fill(pass)
  await page.locator('#password').press('Enter')
  await page.waitForURL(u => u.origin === new URL(baseURL).origin, { timeout: 45_000 })
  await expect(page).not.toHaveURL(/\/oauth2\/|\/dex\//)
}
```

- [ ] **Step 5: Write `e2e/platform-regression.spec.js`.**

```js
import { test, expect } from '@playwright/test'
import { login } from './login.js'

const PLATFORM = 'https://platform.isigpu.local'

test('platform.isigpu.local: login, home and API still work', async ({ page }) => {
  await login(page, PLATFORM, process.env.E2E_USER, process.env.E2E_PASS)
  const ru = await page.request.get(PLATFORM + '/api/resource-usage')
  expect(ru.status()).toBe(200)
  expect((await ru.json()).namespace).toBeTruthy()
  const nb = await page.request.get(PLATFORM + '/api/notebooks')
  expect(nb.status()).toBe(200)
  // centraldashboard (not dorj-service) must still own "/" on platform
  const home = await page.request.get(PLATFORM + '/')
  expect(home.status()).toBe(200)
  expect(await home.text()).not.toContain('<div id="root"></div>')
})

test('platform.isigpu.local: sign_out clears the session', async ({ page }) => {
  await login(page, PLATFORM, process.env.E2E_USER, process.env.E2E_PASS)
  await page.goto(PLATFORM + '/oauth2/sign_out?rd=%2F')
  const r = await page.request.get(PLATFORM + '/api/resource-usage', { maxRedirects: 0 })
  expect([401, 403]).toContain(r.status())
})
```

- [ ] **Step 6: Ignore e2e artefacts.** Append to `.gitignore`:

```
test-results/
playwright-report/
```

- [ ] **Step 7: Run the baseline.**

Run: `cd /workdir/dorjService && env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy npm run e2e -- platform-regression.spec.js`
Expected: `2 passed`.
- If the sign_out test sees a status other than 401/403, record the real status in the commit message and adjust the assertion to it, because it is a baseline.
- If login fails, stop and tell the user. Don't start Task 2 without a green baseline.

- [ ] **Step 8: Commit.**

```bash
git add package.json package-lock.json e2e/ .gitignore
git commit -m "test(e2e): playwright harness + platform.isigpu.local login baseline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared SSO with absolute per-host callbacks (script 134)

**Files:**
- Create: `/workdir/k8s-deploy/scripts/134-sso-absolute-redirect.sh`
- Modify: `/workdir/k8s-deploy/config.env.example`, `/workdir/k8s-deploy/config.env` (append)

**Interfaces:**
- Consumes: `e2e/platform-regression.spec.js` (Task 1).
- Produces: shared oauth2-proxy emitting `redirect_uri=https://<host>/oauth2/callback`, and Dex accepting `https://platform.isigpu.local/oauth2/callback` and `https://goodarzi.isigpu.local/oauth2/callback` (plus the old `/oauth2/callback`). Task 10 relies on this.

- [ ] **Step 1: Add config vars.** Append to both `config.env.example` and `config.env`:

```bash
# --- dorj-service on goodarzi.isigpu.local (2026-10-03, dorjService phase 1) ---
DORJ_SERVICE_NAMESPACE="dorj-service"
DORJ_SERVICE_HOSTNAME="goodarzi.isigpu.local"
DORJ_SERVICE_TAG="0.1.0"
DORJ_SERVICE_IMAGE="${DEPLOY_NODE_IP}:${REGISTRY_PORT}/dorj-service:${DORJ_SERVICE_TAG}"
DORJ_SERVICE_SRC="/workdir/dorjService"
# Hosts whose absolute https://<host>/oauth2/callback Dex must accept (script 134)
SSO_CALLBACK_HOSTS="${KUBEFLOW_HOSTNAME} goodarzi.isigpu.local"
```

- [ ] **Step 2: Write the script.**

```bash
#!/usr/bin/env bash
# Shared SSO on more than one host (2026-10-03, dorjService phase 1 spec rev 2 §3).
# The kubeflow oauth2-proxy used relative_redirect_url=true + Dex redirectURIs ['/oauth2/callback'];
# Dex finishes on platform's /dex/callback, so a relative callback always lands on platform and a
# login started on any other host fails the CSRF check. This switches oauth2-proxy to absolute
# per-host callbacks (cookie_secure forces https; ext-authz carries no X-Forwarded-Proto) and adds
# each host's absolute callback to the Dex client, keeping the old relative one.
#
#   134-sso-absolute-redirect.sh --canary    prove the new oauth2-proxy config on a throwaway Deployment
#   134-sso-absolute-redirect.sh --apply     backup + patch Dex and oauth2-proxy, restart, verify
#   134-sso-absolute-redirect.sh --verify    probes only
#   134-sso-absolute-redirect.sh --rollback  restore the newest backup, restart
source "$(dirname "${BASH_SOURCE[0]}")/lib-common.sh"
require_cmd curl python3
ARTIFACTS_DIR="${DEPLOY_WORKDIR}/inventory/mycluster/artifacts"
KUBECTL_BIN="${ARTIFACTS_DIR}/kubectl"
KUBECONFIG_FILE="${ARTIFACTS_DIR}/admin.conf"
[[ -x "${KUBECTL_BIN}" ]] || die "kubectl not found at ${KUBECTL_BIN}"
kc() { "${KUBECTL_BIN}" --kubeconfig="${KUBECONFIG_FILE}" "$@"; }
MODE="${1:-}"
O2NS=oauth2-proxy
BK_ROOT="${DEPLOY_WORKDIR}/backups/sso-absolute-redirect"

cfg_cm()    { kc -n "$O2NS" get cm -o name | sed -n 's#^configmap/##p' | grep -E '^oauth2-proxy-[a-z0-9]{10}$' | head -1; }
params_cm() { kc -n "$O2NS" get cm -o name | sed -n 's#^configmap/##p' | grep -E '^oauth2-proxy-parameters-' | head -1; }
client_id() { kc -n "$O2NS" get secret "$(kc -n "$O2NS" get deploy oauth2-proxy -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="OAUTH2_PROXY_CLIENT_ID")].valueFrom.secretKeyRef.name}')" -o jsonpath='{.data.client-id}' | base64 -d; }

new_cfg() {  # stdout: oauth2_proxy.cfg with relative_redirect_url=false
  kc -n "$O2NS" get cm "$(cfg_cm)" -o jsonpath='{.data.oauth2_proxy\.cfg}' \
    | sed -E 's/^relative_redirect_url *= *true/relative_redirect_url = false/'
}

probe_dex() {  # $1 = host whose absolute callback must be accepted -> prints HTTP code
  local cb="https://$1/oauth2/callback"
  curl -sk --noproxy '*' -o /dev/null -w '%{http_code}' --resolve "${KUBEFLOW_HOSTNAME}:443:${KUBE_VIP_SERVICES_ADDRESS}" \
    "https://${KUBEFLOW_HOSTNAME}/dex/auth?client_id=$(client_id)&response_type=code&scope=openid&state=probe134&redirect_uri=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$cb")"
}

probe_start() {  # $1 = host -> prints the Location of an unauthenticated page request
  curl -sk --noproxy '*' -o /dev/null -w '%{redirect_url}' -H 'Accept: text/html' \
    --resolve "$1:443:${KUBE_VIP_SERVICES_ADDRESS}" "https://$1/"
}

verify() {
  local ok=1 host code loc
  for host in ${SSO_CALLBACK_HOSTS}; do
    code="$(probe_dex "$host")"
    log "dex /dex/auth with redirect_uri=https://${host}/oauth2/callback -> ${code}"
    [[ "$code" == 302 || "$code" == 303 || "$code" == 200 ]] || ok=0
  done
  # The goodarzi ingress exists only after script 135; probe /oauth2/start for platform here.
  loc="$(probe_start "${KUBEFLOW_HOSTNAME}")"
  log "platform / (unauthenticated) -> ${loc%%&*}"
  if [[ "$(kc -n "$O2NS" get cm "$(cfg_cm)" -o jsonpath='{.data.oauth2_proxy\.cfg}')" == *"relative_redirect_url = false"* ]]; then
    [[ "$loc" == *"redirect_uri=https%3A%2F%2F${KUBEFLOW_HOSTNAME}%2Foauth2%2Fcallback"* ]] || { warn "platform start lacks its absolute callback"; ok=0; }
  fi
  [[ "$ok" == 1 ]] || die "Dex rejected at least one callback host (expected 302/303/200, 400 = Unregistered redirect_uri)"
  log "verify OK"
}

case "$MODE" in
--canary)
  CFG="$(new_cfg)"
  grep -q '^relative_redirect_url = false' <<<"$CFG" || die "could not flip relative_redirect_url in $(cfg_cm)"
  kc -n "$O2NS" create cm oauth2-proxy-canary-cfg --from-literal=oauth2_proxy.cfg="$CFG" --dry-run=client -o yaml | kc apply -f -
  kc -n "$O2NS" get deploy oauth2-proxy -o json | python3 -c '
import json,sys
d=json.load(sys.stdin)
d["metadata"]={"name":"oauth2-proxy-canary","namespace":"oauth2-proxy","labels":{"app":"oauth2-proxy-canary"}}
s=d["spec"]; s["replicas"]=1
s["selector"]={"matchLabels":{"app":"oauth2-proxy-canary"}}
t=s["template"]; t["metadata"]={"labels":{"app":"oauth2-proxy-canary"},"annotations":{"sidecar.istio.io/inject":"false"}}
for v in t["spec"].get("volumes",[]):
    cm=v.get("configMap")
    if cm and cm["name"].startswith("oauth2-proxy-") and not cm["name"].startswith(("oauth2-proxy-theme","oauth2-proxy-error","oauth2-proxy-parameters")):
        cm["name"]="oauth2-proxy-canary-cfg"
c=t["spec"]["containers"][0]
c["env"]=[e for e in c.get("env",[]) if e["name"]!="OAUTH2_PROXY_COOKIE_SECURE"]+[{"name":"OAUTH2_PROXY_COOKIE_SECURE","value":"true"}]
d.pop("status",None)
print(json.dumps(d))' | kc apply -f -
  kc -n "$O2NS" rollout status deploy/oauth2-proxy-canary --timeout=120s
  kc -n "$O2NS" port-forward deploy/oauth2-proxy-canary 14180:4180 >/dev/null 2>&1 & PF=$!
  sleep 3
  rc=0
  for host in ${SSO_CALLBACK_HOSTS}; do
    loc="$(curl -s --noproxy '*' -o /dev/null -w '%{redirect_url}' -H "Host: ${host}" -H 'Accept: text/html' 'http://127.0.0.1:14180/oauth2/start?rd=%2F')"
    want="redirect_uri=https%3A%2F%2F${host}%2Foauth2%2Fcallback"
    if [[ "$loc" == *"$want"* ]]; then log "canary ${host}: OK"; else warn "canary ${host}: ${loc}"; rc=1; fi
  done
  kill "$PF" 2>/dev/null || true
  kc -n "$O2NS" delete deploy oauth2-proxy-canary --wait=false
  kc -n "$O2NS" delete cm oauth2-proxy-canary-cfg
  [[ "$rc" == 0 ]] || die "canary did not produce absolute per-host callbacks; live config untouched"
  log "canary OK - live config untouched"
  ;;
--apply)
  TS="$(date +%Y%m%d-%H%M%S)"; BK="${BK_ROOT}/${TS}"; mkdir -p "$BK"; chmod 700 "$BK"
  kc -n auth get cm dex -o yaml > "$BK/dex-cm.yaml"
  kc -n "$O2NS" get cm "$(cfg_cm)" -o yaml > "$BK/oauth2-proxy-cfg-cm.yaml"
  kc -n "$O2NS" get cm "$(params_cm)" -o yaml > "$BK/oauth2-proxy-params-cm.yaml"
  log "backup: $BK"
  kc -n auth get cm dex -o jsonpath='{.data.config\.yaml}' | SSO_CALLBACK_HOSTS="${SSO_CALLBACK_HOSTS}" python3 -c '
import os,sys,yaml
c=yaml.safe_load(sys.stdin)
hits=[s for s in c.get("staticClients",[]) if "/oauth2/callback" in (s.get("redirectURIs") or [])]
assert len(hits)==1, "expected exactly one Dex client with /oauth2/callback, got %d" % len(hits)
uris=hits[0]["redirectURIs"]
for h in os.environ["SSO_CALLBACK_HOSTS"].split():
    u="https://%s/oauth2/callback" % h
    if u not in uris: uris.append(u)
open("/dev/stdout","w").write(yaml.safe_dump(c, sort_keys=False))' > "$BK/dex-config.new.yaml"
  kc -n auth create cm dex --from-file=config.yaml="$BK/dex-config.new.yaml" --dry-run=client -o yaml | kc apply -f -
  kc -n "$O2NS" create cm "$(cfg_cm)" --from-literal=oauth2_proxy.cfg="$(new_cfg)" --dry-run=client -o yaml | kc apply -f -
  kc -n "$O2NS" patch cm "$(params_cm)" --type merge -p '{"data":{"FORCE_HTTPS":"true"}}'
  kc -n auth rollout restart deploy/dex
  kc -n auth rollout status deploy/dex --timeout=180s
  kc -n "$O2NS" rollout restart deploy/oauth2-proxy
  kc -n "$O2NS" rollout status deploy/oauth2-proxy --timeout=180s
  verify
  ;;
--verify) verify ;;
--rollback)
  BK="$(ls -1d "${BK_ROOT}"/*/ 2>/dev/null | tail -1)"; [[ -n "$BK" ]] || die "no backup under ${BK_ROOT}"
  for f in dex-cm.yaml oauth2-proxy-cfg-cm.yaml oauth2-proxy-params-cm.yaml; do
    python3 -c 'import sys,yaml;d=yaml.safe_load(open(sys.argv[1]));m=d["metadata"];[m.pop(k,None) for k in ("resourceVersion","uid","creationTimestamp","managedFields")];print(yaml.safe_dump(d))' "$BK/$f" | kc replace -f -
  done
  kc -n auth rollout restart deploy/dex; kc -n auth rollout status deploy/dex --timeout=180s
  kc -n "$O2NS" rollout restart deploy/oauth2-proxy; kc -n "$O2NS" rollout status deploy/oauth2-proxy --timeout=180s
  log "rolled back from $BK"
  ;;
*) die "usage: $0 --canary|--apply|--verify|--rollback" ;;
esac
```

`chmod +x scripts/134-sso-absolute-redirect.sh`

- [ ] **Step 3: Sanity-check the script.**

Run: `bash -n scripts/134-sso-absolute-redirect.sh && shellcheck -S warning scripts/134-sso-absolute-redirect.sh || true`
Expected: no syntax errors. Fix any shellcheck warnings about quoting of variables that hold host names.

- [ ] **Step 4: Run the canary (live config untouched).**

Run: `./scripts/134-sso-absolute-redirect.sh --canary`
Expected: `canary platform.isigpu.local: OK`, `canary goodarzi.isigpu.local: OK`, `canary OK`.
- If the canary prints a relative `redirect_uri=%2Foauth2%2Fcallback`, the v7.13 behaviour assumption in spec §3 is wrong. Stop and report to the user with the printed Location. Do not apply.
- Check that `kc -n oauth2-proxy get deploy` shows no `oauth2-proxy-canary`.

- [ ] **Step 5: Tell the user before the live switch.** Dex and oauth2-proxy restart (~1 min, logins in that window may need a retry). Wait for an explicit "ok" in this conversation, because this is the one shared-auth change.

- [ ] **Step 6: Apply.**

Run: `./scripts/134-sso-absolute-redirect.sh --apply`
Expected: the backup path is printed, both rollouts succeed, the Dex probe returns `302` or `303` for both hosts, and `verify OK` is printed.
If anything fails: `./scripts/134-sso-absolute-redirect.sh --rollback` and stop.

- [ ] **Step 7: Run the real-login regression on platform.**

Run: `cd /workdir/dorjService && env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy npm run e2e -- platform-regression.spec.js`
Expected: `2 passed`. If it fails, run `--rollback` immediately, re-run the spec to confirm the baseline is green again, and report to the user.

- [ ] **Step 8: Commit (k8s-deploy).**

```bash
cd /workdir/k8s-deploy
git add scripts/134-sso-absolute-redirect.sh config.env.example
git status --short   # confirm both staged (multi-pathspec add stages nothing if one is wrong)
git commit -m "feat(sso): absolute per-host oauth2 callbacks for a second platform host (script 134)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: HTTP core with explicit errors, TTL cache and a 401 guard

**Files:**
- Create: `src/lib/http.js`
- Rewrite: `src/lib/api.js`
- Create: `tests/http.test.js`

**Interfaces:**
- Produces:
  - `getJson(path, {ttlMs=30000}) → Promise<{data, error}>`. `error` is `null`, or `{status:number, message:string}`. `status` is 0 for a network error.
  - `send(path, {method='POST', body}) → Promise<{data, error}>`. On success it calls `invalidate()` for the path's collection prefix.
  - `invalidate(prefix='')`
  - `_resetForTests()`
  - `api(path, fallback=null) → Promise<data|fallback>`
  - `apiPost(path, body) → Promise<{data, error}>`
  - `apiSend(path, method, body) → Promise<{data, error}>`
  - `useApi(path, fallback=null, deps=[], adapt=identity) → {data, loading, error, reload}`. When `path` is falsy it does not fetch.

- [ ] **Step 1: Write the failing tests `tests/http.test.js`.**

```js
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

let calls, reloads, store, nowMs
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
globalThis.sessionStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) } }
globalThis.location = { reload: () => { reloads++ } }

const http = await import('../src/lib/http.js')

beforeEach(() => {
  calls = []; reloads = 0; store = {}; nowMs = 1_000_000
  http._resetForTests({ now: () => nowMs })
})
const stubFetch = (...responses) => {
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return responses.shift() }
}

test('200 returns data and no error', async () => {
  stubFetch(resp(200, { a: 1 }))
  assert.deepEqual(await http.getJson('/api/x'), { data: { a: 1 }, error: null })
})

test('403 returns error with backend message', async () => {
  stubFetch(resp(403, { error: 'no Profile found with owner u@x' }))
  const r = await http.getJson('/api/notebooks')
  assert.equal(r.data, null)
  assert.deepEqual(r.error, { status: 403, message: 'no Profile found with owner u@x' })
})

test('network failure is status 0', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  const r = await http.getJson('/api/x')
  assert.equal(r.error.status, 0)
})

test('401 reloads at most once per 10 s', async () => {
  stubFetch(resp(401, {}), resp(401, {}), resp(401, {}))
  await http.getJson('/api/a'); await http.getJson('/api/b')
  assert.equal(reloads, 1)
  nowMs += 10_001
  await http.getJson('/api/c')
  assert.equal(reloads, 2)
})

test('cache hits within TTL, refetches after TTL', async () => {
  stubFetch(resp(200, 1), resp(200, 2))
  assert.equal((await http.getJson('/api/v')).data, 1)
  assert.equal((await http.getJson('/api/v')).data, 1)
  assert.equal(calls.length, 1)
  nowMs += 30_001
  assert.equal((await http.getJson('/api/v')).data, 2)
})

test('errors are not cached', async () => {
  stubFetch(resp(500, { error: 'boom' }), resp(200, 'ok'))
  await http.getJson('/api/e')
  assert.equal((await http.getJson('/api/e')).data, 'ok')
})

test('send posts JSON and invalidates the collection prefix', async () => {
  stubFetch(resp(200, { items: [1] }), resp(200, { ok: true }), resp(200, { items: [1, 2] }))
  await http.getJson('/api/mail/messages?folder=INBOX')
  const r = await http.send('/api/mail/seen', { body: { folder: 'INBOX', uid: 3 } })
  assert.deepEqual(r, { data: { ok: true }, error: null })
  assert.equal(calls[1].init.method, 'POST')
  assert.equal(calls[1].init.headers['Content-Type'], 'application/json')
  assert.equal(calls[1].init.body, JSON.stringify({ folder: 'INBOX', uid: 3 }))
  assert.deepEqual((await http.getJson('/api/mail/messages?folder=INBOX')).data, { items: [1, 2] })
})
```

- [ ] **Step 2: Run them to verify they fail.**

Run: `cd /workdir/dorjService && npm test`
Expected: FAIL with `Cannot find module .../src/lib/http.js`.

- [ ] **Step 3: Implement `src/lib/http.js`.**

```js
// Pure HTTP core (no React). Real backends sit behind oauth2-proxy: an expired session answers
// /api/* with 401 (api_routes), so we reload once to re-run the login redirect.
const RELOAD_KEY = 'dorj.http.last401Reload'
const RELOAD_GAP_MS = 10_000
let cache = new Map()
let now = () => Date.now()

export function _resetForTests(opts = {}) {
  cache = new Map()
  now = opts.now || (() => Date.now())
}

export function invalidate(prefix = '') {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k)
}

function onUnauthorized() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (now() - last < RELOAD_GAP_MS) return
    sessionStorage.setItem(RELOAD_KEY, String(now()))
  } catch {
    // storage blocked: still reload once per page life
    if (onUnauthorized.done) return
    onUnauthorized.done = true
  }
  location.reload()
}

async function request(path, init) {
  let r
  try {
    r = await fetch(path, { credentials: 'same-origin', ...init, headers: { Accept: 'application/json', ...(init?.headers || {}) } })
  } catch (e) {
    return { data: null, error: { status: 0, message: String(e?.message || e) } }
  }
  let body = null
  try { body = await r.json() } catch { body = null }
  if (r.ok) return { data: body, error: null }
  if (r.status === 401) onUnauthorized()
  const message = (body && typeof body === 'object' && (body.error || body.message)) || `HTTP ${r.status}`
  return { data: null, error: { status: r.status, message: String(message) } }
}

export async function getJson(path, { ttlMs = 30_000 } = {}) {
  const hit = cache.get(path)
  if (hit && now() - hit.at < ttlMs) return hit.result
  const result = await request(path, { method: 'GET' })
  if (!result.error) cache.set(path, { at: now(), result })
  return result
}

// "/api/mail/seen" -> "/api/mail", "/admin-panel/api/admin/users/x" -> "/admin-panel/api/admin/users"
function collectionPrefix(path) {
  const p = path.split('?')[0].split('/').filter(Boolean)
  return '/' + p.slice(0, Math.max(2, p.length - 1)).join('/')
}

export async function send(path, { method = 'POST', body } = {}) {
  const result = await request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!result.error) invalidate(collectionPrefix(path))
  return result
}
```

- [ ] **Step 4: Rewrite `src/lib/api.js`.**

```js
import React from 'react'
import { getJson, send, invalidate } from './http.js'

export { invalidate }

export async function api(path, fallback = null) {
  const { data, error } = await getJson(path)
  return error ? fallback : data
}

export function apiPost(path, body) {
  return send(path, { method: 'POST', body })
}

export function apiSend(path, method, body) {
  return send(path, { method, body })
}

const identity = x => x

export function useApi(path, fallback = null, deps = [], adapt = identity) {
  const [state, setState] = React.useState({ data: fallback, loading: !!path, error: null })
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    if (!path) { setState({ data: fallback, loading: false, error: null }); return }
    let alive = true
    setState(s => ({ ...s, loading: true }))
    getJson(path).then(({ data, error }) => {
      if (!alive) return
      setState({ data: error ? fallback : adapt(data), loading: false, error })
    })
    return () => { alive = false }
  }, [path, tick, ...deps])
  const reload = React.useCallback(() => { invalidate(path || ''); setTick(t => t + 1) }, [path])
  return { ...state, reload }
}
```

- [ ] **Step 5: Run the tests.**

Run: `npm test`
Expected: `# pass 7`, `# fail 0`.

- [ ] **Step 6: Build still passes.**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✓ built in`.

- [ ] **Step 7: Commit and tag.**

```bash
git add src/lib/http.js src/lib/api.js tests/http.test.js
git commit -m "feat(api): http core with explicit errors, TTL cache, 401 re-login guard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git tag goodarzi-p1-http-core
```

---

### Task 4: Mock only in dev, build gate, container image

**Files:**
- Modify: `src/lib/mock.js:1-5`, `src/main.tsx`
- Create: `scripts/check-dist.mjs`, `Dockerfile`, `.dockerignore`, `deploy/nginx.conf`

**Interfaces:**
- Produces: image build context at the repo root. `docker build` produces an nginx image listening on **8080** as uid 101. Task 10 uses it.

- [ ] **Step 1: Write the failing build gate `scripts/check-dist.mjs`.**

```js
// Fails if production output contains mock code or is missing the app shell.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MARKER = '__DORJ_MOCK_API__'
const files = []
const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p) } }
walk('dist')
const bad = files.filter(f => /\.(js|html)$/.test(f) && readFileSync(f, 'utf8').includes(MARKER))
if (bad.length) { console.error('mock code in production build:', bad.join(', ')); process.exit(1) }
if (!readFileSync('dist/index.html', 'utf8').includes('id="root"')) { console.error('dist/index.html has no #root'); process.exit(1) }
console.log(`check-dist OK (${files.length} files, no mock)`)
```

- [ ] **Step 2: Add the marker to `src/lib/mock.js`.** Insert right after the header comment (line 3):

```js
export const MOCK_MARKER = '__DORJ_MOCK_API__' // scripts/check-dist.mjs fails the build if this ships
```

and make `installMockApi` reference it so it survives tree-shaking in dev:

```js
export function installMockApi() {
  window[MOCK_MARKER] = true
  const real = window.fetch.bind(window)
```

(The rest of the function stays unchanged.)

- [ ] **Step 3: Run the gate on the current build to see it fail.**

Run: `npx vite build >/dev/null 2>&1; npm run check-dist`
Expected: FAIL, `mock code in production build: dist/assets/index-….js`.

- [ ] **Step 4: Gate the mock in `src/main.tsx`.** Replace the whole file:

```tsx
import { createRoot } from 'react-dom/client'
import { PrefsProvider } from './lib/prefs.jsx'
import App from './App.jsx'
import './styles/tokens.css'
import './styles/pages.css'

// Design-time mock API only under `vite dev`; production talks to the real backends.
const ready: Promise<unknown> = import.meta.env.DEV
  ? import('./lib/mock.js').then(m => m.installMockApi())
  : Promise.resolve()

ready.then(() => {
  createRoot(document.getElementById('root')!).render(
    <PrefsProvider>
      <App />
    </PrefsProvider>
  )
})
```

- [ ] **Step 5: Build and gate.**

Run: `npx vite build 2>&1 | tail -3 && npm run check-dist`
Expected: `check-dist OK (… files, no mock)`.

- [ ] **Step 6: Write `deploy/nginx.conf`.**

```nginx
worker_processes 1;
pid /tmp/nginx.pid;
events { worker_connections 1024; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  client_body_temp_path /tmp/client_temp;
  proxy_temp_path /tmp/proxy_temp;
  fastcgi_temp_path /tmp/fastcgi_temp;
  uwsgi_temp_path /tmp/uwsgi_temp;
  scgi_temp_path /tmp/scgi_temp;
  access_log /dev/stdout;
  error_log /dev/stderr warn;
  server_tokens off;
  sendfile on;
  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;
  server {
    listen 8080;
    root /usr/share/nginx/html;
    location = /healthz { access_log off; return 200 "ok\n"; }
    location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; try_files $uri =404; }
    location /fonts/  { add_header Cache-Control "public, max-age=604800"; try_files $uri =404; }
    location /img/    { add_header Cache-Control "public, max-age=604800"; try_files $uri =404; }
    location = / { add_header Cache-Control "no-cache"; try_files /index.html =404; }
    location = /index.html { add_header Cache-Control "no-cache"; }
    location / { try_files $uri =404; }
  }
}
```

- [ ] **Step 7: Write `Dockerfile` and `.dockerignore`.**

```dockerfile
# goodarzi.isigpu.local (docs/superpowers/specs/2026-10-03-goodarzi-phase1-design.md)
FROM node:20-alpine AS build
ARG NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --registry "${NPM_CONFIG_REGISTRY}"
COPY . .
RUN npm test && npm run build && npm run check-dist

FROM nginx:stable-alpine
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /src/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
```

`.dockerignore`:

```
node_modules
dist
.git
test-results
playwright-report
e2e
docs
```

- [ ] **Step 8: Build and smoke-run locally.**

```bash
docker build --build-arg HTTP_PROXY= --build-arg HTTPS_PROXY= \
  --build-arg NPM_CONFIG_REGISTRY="http://172.16.50.89:8083/repository/npm-proxy/" -t dorj-service:dev .
docker run -d --rm --name dorj-service-smoke -p 18080:8080 dorj-service:dev
sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/          # 200
curl -s http://127.0.0.1:18080/ | grep -c 'id="root"'                       # 1
curl -sI http://127.0.0.1:18080/assets/$(ls dist/assets | grep '\.js$' | head -1) | grep -i cache-control   # immutable
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/nope        # 404
docker stop dorj-service-smoke
```

Expected: `200`, `1`, `immutable`, `404`. If the Nexus npm proxy fails, retry without `--build-arg NPM_CONFIG_REGISTRY` (the deploy node reached npmjs directly during exploration) and note which path worked in the commit message.

- [ ] **Step 9: Commit and tag.**

```bash
git add src/lib/mock.js src/main.tsx scripts/check-dist.mjs Dockerfile .dockerignore deploy/nginx.conf
git commit -m "build: mock API only under vite dev, dist gate, nginx image (8080, non-root)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git tag goodarzi-p1-image
```

---

### Task 5: Workload adapters plus the Notebooks, Volumes, VMs and search pages

**Files:**
- Create: `src/lib/adapters/workloads.js`, `src/lib/soon.js`, `src/components/ErrorNote.jsx`, `src/components/ErrorNote.css`, `tests/workloads.test.js`
- Modify: `src/pages/Notebooks.jsx`, `src/pages/Volumes.jsx`, `src/components/SearchModal.jsx`

**Interfaces:**
- Consumes: `useApi(path, fallback, deps, adapt)` (Task 3).
- Produces:
  - `relativeUrl(u)`
  - `adaptNotebooks(raw) → [{name, status, image, created_at, url, in_use_by:'', phase_message}]`. `status` is one of `Running|Stopped|Pending|Error|Stopping|Terminating`.
  - `adaptVolumes(raw) → [{...raw, viewer_url}]`
  - `adaptVms(raw) → [{name, status, cpu, memory, ip, created_at, console_available}]`
  - `adaptBackups(raw) → [{name, created_at, size, phase}]`
  - `SOON = 'به‌زودی'`, `soonProps = {disabled:true, title:SOON, 'aria-disabled':true}`
  - `<ErrorNote error={{status,message}} />`

- [ ] **Step 1: Write the failing tests `tests/workloads.test.js`.**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { relativeUrl, adaptNotebooks, adaptVolumes, adaptVms, adaptBackups } from '../src/lib/adapters/workloads.js'

test('relativeUrl strips platform host', () => {
  assert.equal(relativeUrl('https://platform.isigpu.local/notebook/ns/nb/'), '/notebook/ns/nb/')
  assert.equal(relativeUrl('https://platform.isigpu.local/pvcviewers/ns/v/?x=1'), '/pvcviewers/ns/v/?x=1')
  assert.equal(relativeUrl(null), null)
  assert.equal(relativeUrl('/already/relative'), '/already/relative')
})

test('notebook phases map to UI statuses', () => {
  const nb = (phase, stopped = false) => ({ name: 'a', image: 'r/x:1', phase, stopped, phase_message: 'm', created_at: 't', url: 'https://platform.isigpu.local/notebook/n/a/' })
  const s = raw => adaptNotebooks([raw])[0].status
  assert.equal(s(nb('ready')), 'Running')
  assert.equal(s(nb('stopped', true)), 'Stopped')
  assert.equal(s(nb('waiting')), 'Pending')
  assert.equal(s(nb('waiting', true)), 'Stopping')
  assert.equal(s(nb('warning')), 'Error')
  assert.equal(s(nb('terminating')), 'Terminating')
  const out = adaptNotebooks([nb('ready')])[0]
  assert.equal(out.url, '/notebook/n/a/')
  assert.equal(out.in_use_by, '')
  assert.equal(out.phase_message, 'm')
})

test('adaptNotebooks tolerates non-array', () => {
  assert.deepEqual(adaptNotebooks({ error: 'x' }), [])
})

test('volumes keep fields and get a relative viewer url', () => {
  const v = adaptVolumes([{ name: 'w', size: '20Gi', status: 'Bound', viewer_url: 'https://platform.isigpu.local/pvcviewers/n/w/', used_gib: 3 }])[0]
  assert.equal(v.viewer_url, '/pvcviewers/n/w/')
  assert.equal(v.used_gib, 3)
  assert.equal(adaptVolumes([{ name: 'x', viewer_url: null }])[0].viewer_url, '')
})

test('vms map phase/cpu/memory/ip', () => {
  const v = adaptVms([{ name: 'vm1', phase: 'Running', cpu_cores: 4, memory_request: '8Gi', ip_address: '10.0.0.5', created_at: 't', console_available: true }])[0]
  assert.deepEqual(v, { name: 'vm1', status: 'Running', cpu: 4, memory: '8Gi', ip: '10.0.0.5', created_at: 't', console_available: true })
})

test('backups render size from size_gib', () => {
  assert.deepEqual(adaptBackups([{ name: 'b', created_at: '2026-10-01T00:00:00Z', size_gib: 1.5, phase: 'Completed' }]),
    [{ name: 'b', created_at: '2026-10-01T00:00:00Z', size: '1.5 GiB', phase: 'Completed' }])
  assert.equal(adaptBackups([{ name: 'b', size_gib: null }])[0].size, '—')
})
```

- [ ] **Step 2: Run them to verify they fail.**

Run: `npm test`
Expected: FAIL, `Cannot find module …/adapters/workloads.js`.

- [ ] **Step 3: Implement `src/lib/adapters/workloads.js`.**

```js
// Real kubeflow-resource-usage JSON -> the props the existing pages render.
// Backend URLs are built from KUBEFLOW_HOSTNAME (platform.isigpu.local); their routes are
// host "*" on the gateway, so a host-relative path keeps the user on goodarzi.
export function relativeUrl(u) {
  if (!u) return u ?? null
  try { const x = new URL(u, 'https://placeholder.invalid'); return x.pathname + x.search + x.hash } catch { return u }
}

const list = raw => (Array.isArray(raw) ? raw : [])

function notebookStatus(n) {
  switch (n.phase) {
    case 'ready': return 'Running'
    case 'stopped': return 'Stopped'
    case 'waiting': return n.stopped ? 'Stopping' : 'Pending'
    case 'terminating': return 'Terminating'
    case 'warning': return 'Error'
    default: return n.stopped ? 'Stopped' : 'Pending'
  }
}

export const adaptNotebooks = raw => list(raw).map(n => ({
  name: n.name,
  status: notebookStatus(n),
  image: n.image || '',
  created_at: n.created_at,
  url: relativeUrl(n.url),
  in_use_by: '',
  phase_message: n.phase_message || '',
}))

export const adaptVolumes = raw => list(raw).map(v => ({ ...v, viewer_url: relativeUrl(v.viewer_url) || '' }))

export const adaptVms = raw => list(raw).map(v => ({
  name: v.name,
  status: v.phase || 'Unknown',
  cpu: v.cpu_cores ?? null,
  memory: v.memory_request ?? null,
  ip: v.ip_address ?? null,
  created_at: v.created_at,
  console_available: !!v.console_available,
}))

export const adaptBackups = raw => list(raw).map(b => ({
  name: b.name,
  created_at: b.created_at,
  size: b.size_gib == null ? '—' : `${b.size_gib} GiB`,
  phase: b.phase,
}))
```

- [ ] **Step 4: Run the tests.**

Run: `npm test`
Expected: all pass (7 http + 6 workloads).

- [ ] **Step 5: Create `src/lib/soon.js`.**

```js
// Phase 1 is read-only parity; mutating actions arrive in Phase 2/3.
export const SOON = 'به‌زودی'
export const soonProps = { disabled: true, title: SOON, 'aria-disabled': true }
```

- [ ] **Step 6: Create `src/components/ErrorNote.jsx` and `ErrorNote.css`.**

```jsx
import './ErrorNote.css'

const TEXT = {
  0: 'ارتباط با سرور برقرار نشد.',
  403: 'دسترسی به این بخش برای حساب شما فعال نیست.',
  404: 'موردی یافت نشد.',
}

export default function ErrorNote({ error }) {
  if (!error) return null
  const text = TEXT[error.status] || 'خطا در دریافت اطلاعات از سرور.'
  return (
    <div className="err-note" role="alert">
      <b>{text}</b>
      {error.message && <span className="err-note-detail" dir="auto">{error.message}</span>}
    </div>
  )
}
```

```css
.err-note { display: flex; flex-direction: column; gap: 4px; margin: 12px 0; padding: 12px 16px;
  border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 13px; }
.err-note-detail { color: #7f1d1d; opacity: .8; font-size: 12px; overflow-wrap: anywhere; }
```

- [ ] **Step 7: Wire `src/pages/Notebooks.jsx`.**
  - Add imports: `import { adaptNotebooks } from '../lib/adapters/workloads.js'`, `import { soonProps } from '../lib/soon.js'` and `import ErrorNote from '../components/ErrorNote.jsx'`.
  - Replace line 312, `const { data, loading } = useApi('/api/notebooks', null)`, with:

```jsx
  const { data, loading, error } = useApi('/api/notebooks', null, [], adaptNotebooks)
```

  - Replace `const isLoading = loading || data === null` with `const isLoading = loading && !error`.
  - Change the empty-state condition `{!isLoading && raw.length === 0 && (` to `{!isLoading && !error && raw.length === 0 && (`.
  - Right after the `{/* search bar */}` block, insert `<ErrorNote error={error} />`.
  - Add `Stopping` and `Terminating` to `StatusBadge`'s `MAP`:

```jsx
    Stopping:    { cls: 'pending', label: 'در حال توقف' },
    Terminating: { cls: 'pending', label: 'در حال حذف' },
```

  - Show `phase_message` as the badge title. Change `<td><StatusBadge status={n.status} /></td>` to `<td title={n.phase_message}><StatusBadge status={n.status} /></td>`.
  - Disable the Phase-2 actions:
    - Add `{...soonProps}` to both "نوت‌بوک جدید" / "ساخت اولین نوت‌بوک" buttons and remove their `onClick`.
    - On the delete button, replace `disabled={!!inUse}`, `onClick` and `title` with `{...soonProps}`.
    - Change `useState(() => window.location.hash.includes('?new=1'))` to `useState(false)`, because the dashboard quick link must not open a create form that can't submit.
  - Leave the "open" link as is (`href={n.url || '#'}`). It now carries the relative `/notebook/...` URL.

- [ ] **Step 8: Wire `src/pages/Volumes.jsx`.**
  - Add the same three imports, with `adaptVolumes, adaptVms` from workloads.
  - Volumes page:
    - Line 161 becomes `const { data, loading, error } = useApi('/api/volumes', null, [], adaptVolumes)`.
    - Line 162 becomes `const { data: q, error: qErr } = useApi('/api/volumes/quota')`.
    - `const storageRem = q?.quota?.storage_remaining_gib ?? 9` becomes `const storageRem = q?.quota?.storage_remaining_gib ?? null`. Wherever `storageRem` is rendered, render `storageRem ?? '—'`. Find those spots with `grep -n storageRem src/pages/Volumes.jsx`.
    - In `browse`, use `if (v.viewer_url)` in place of `if (v.viewer_url && v.viewer_url !== '#')`. Open the viewer in the same origin with `window.open(v.viewer_url, '_blank', 'noopener')`.
    - Disable create, delete and autoresize with `{...soonProps}`. `grep -nE "setOpen\(true\)|handleDelete|autoresize" src/pages/Volumes.jsx` lists every trigger. Remove each trigger's `onClick` and spread `soonProps`.
    - Insert `<ErrorNote error={error || qErr} />` above the table, and gate the empty state on `!error`.
  - VMs page (`export function Vms`, around line 455):
    - Change it to `const { data, loading, error } = useApi('/api/vms', null, [], adaptVms)`.
    - Insert `<ErrorNote error={error} />` after the existing `en?.enabled === false` notice.
    - The start/stop/restart/delete buttons, found with `grep -n "vm.status === 'Running'" src/pages/Volumes.jsx`, get `{...soonProps}` and lose their `onClick`.
    - Add `Starting`, `Stopping`, `Stopped`, `Paused`, `Migrating` and `Unknown` to `VmStatusBadge`'s map if they're missing. Each label is Persian, its class is `pending` (or `stopped` for `Stopped`/`Paused`). KubeVirt `printableStatus` values reach `phase`.

- [ ] **Step 9: Wire `src/components/SearchModal.jsx`.** Change lines 27-28 to:

```jsx
  const { data: notebooks } = useApi('/api/notebooks', [], [], adaptNotebooks)
  const { data: volumes } = useApi('/api/volumes', [], [], adaptVolumes)
```

and import both adapters.

- [ ] **Step 10: Verify in dev against the mock.** The mock has the old shape, so update `src/lib/mock.js` to return the **real** shapes for `/api/notebooks`, `/api/volumes`, `/api/vms` and `/api/backups`. The dev preview must keep exercising the adapters. Use the same field names the tests use: `phase`, `stopped`, `url`, `phase_message`, `cpu_cores`, `memory_request`, `ip_address`, `size_gib`.

Then run: `npm test && npx vite build 2>&1 | tail -1 && npm run check-dist`
Expected: tests pass, `✓ built`, and `check-dist OK`.
Then run `npx vite --port 5173` and open `#/notebooks`, `#/volumes` and `#/vms` in Chrome. The tables render with statuses, and the create/delete buttons are disabled with tooltip `به‌زودی`. Stop vite.

- [ ] **Step 11: Commit and tag.**

```bash
git add src/lib/adapters/workloads.js src/lib/soon.js src/components/ErrorNote.* tests/workloads.test.js \
  src/pages/Notebooks.jsx src/pages/Volumes.jsx src/components/SearchModal.jsx src/lib/mock.js
git status --short
git commit -m "feat(workloads): real notebooks/volumes/VMs data, relative URLs, Phase-2 actions disabled

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git tag goodarzi-p1-workloads
```

---

### Task 6: Metrics adapters plus the Dashboard, Usage and Resources widget

**Files:**
- Create: `src/lib/adapters/metrics.js`, `tests/metrics.test.js`
- Modify: `src/pages/Dashboard.jsx`, `src/pages/Usage.jsx`, `src/components/ResourcesWidget.jsx`

**Interfaces:**
- Consumes: `adaptNotebooks` (Task 5), `useApi` (Task 3), `ErrorNote` (Task 5).
- Produces:
  - `seriesValues(points) → number[]`. Points are `[[t, v|null], …]`. Nulls are dropped, and a plain `number[]` passes through.
  - `adaptUsageHistory(raw) → {cpu_cores:number[], memory_gib:number[], storage_gib:number[], gpu_util_pct:number[]}`
  - `adaptCost(raw) → {daily:number[], labels:string[], byPod:[{pod, irr, usd}]}`

- [ ] **Step 1: Write the failing tests `tests/metrics.test.js`.**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seriesValues, adaptUsageHistory, adaptCost } from '../src/lib/adapters/metrics.js'

test('seriesValues keeps nulls out', () => {
  assert.deepEqual(seriesValues([[1, 0.5], [2, null], [3, 2]]), [0.5, 2])
  assert.deepEqual(seriesValues([1, 2]), [1, 2])
  assert.deepEqual(seriesValues(undefined), [])
})

test('usage history maps every series', () => {
  const h = adaptUsageHistory({ cpu_cores: [[1, 1]], memory_gib: [[1, 2]], storage_gib: [[1, 3]], gpu_util_pct: [] })
  assert.deepEqual(h, { cpu_cores: [1], memory_gib: [2], storage_gib: [3], gpu_util_pct: [] })
})

test('cost prefers irr, falls back to usd, sorts pods by cost', () => {
  const c = adaptCost({ daily: [{ date: '2026-10-01', usd: 1, irr: 1000 }, { date: '2026-10-02', usd: 2, irr: null }],
    by_pod: [{ pod: 'a', usd: 1, irr: 10 }, { pod: 'b', usd: 3, irr: 30 }] })
  assert.deepEqual(c.labels, ['2026-10-01', '2026-10-02'])
  assert.deepEqual(c.daily, [1000, null])
  assert.equal(c.unit, 'irr')
  assert.deepEqual(c.byPod.map(p => p.pod), ['b', 'a'])
  assert.equal(adaptCost({ daily: [{ date: 'd', usd: 2, irr: null }], by_pod: [] }).unit, 'usd')
  assert.deepEqual(adaptCost(null), { daily: [], labels: [], byPod: [], unit: 'irr' })
})
```

- [ ] **Step 2: Run and see the failure.**

Run: `npm test`
Expected: FAIL, `Cannot find module …/adapters/metrics.js`.

- [ ] **Step 3: Implement `src/lib/adapters/metrics.js`.**

```js
// /api/dashboard-usage-history returns Prometheus range points [[unixTs, value|null], ...].
export function seriesValues(points) {
  if (!Array.isArray(points)) return []
  return points
    .map(p => (Array.isArray(p) ? p[1] : p))
    .filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)))
    .map(Number)
}

export const adaptUsageHistory = raw => ({
  cpu_cores: seriesValues(raw?.cpu_cores),
  memory_gib: seriesValues(raw?.memory_gib),
  storage_gib: seriesValues(raw?.storage_gib),
  gpu_util_pct: seriesValues(raw?.gpu_util_pct),
})

// /api/dashboard-cost: {daily:[{date,usd,irr}], by_pod:[{pod,usd,irr}]}. irr is null when no FX rate.
export function adaptCost(raw) {
  const daily = Array.isArray(raw?.daily) ? raw.daily : []
  const unit = daily.some(d => d.irr != null) || daily.length === 0 ? 'irr' : 'usd'
  return {
    unit,
    labels: daily.map(d => d.date),
    daily: daily.map(d => d[unit] ?? null),
    byPod: (Array.isArray(raw?.by_pod) ? raw.by_pod : []).slice().sort((a, b) => (b.usd || 0) - (a.usd || 0)),
  }
}
```

- [ ] **Step 4: Run the tests.**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Wire `src/pages/Dashboard.jsx`.**
  - Imports: `adaptUsageHistory, adaptCost` from metrics, `adaptNotebooks` from workloads, `ErrorNote`, and `{ fmt }` from format. `fmt` is already exported from `src/lib/format.js`.
  - Data hooks:

```jsx
  const { data: sum, error: sumErr } = useApi('/api/dashboard-summary')
  const { data: usage } = useApi('/api/dashboard-usage-history', null, [], adaptUsageHistory)
  const { data: cost } = useApi('/api/dashboard-cost', null, [], adaptCost)
  const { data: nbs } = useApi('/api/notebooks', [], [], adaptNotebooks)
  const { data: ru } = useApi('/api/resource-usage')
  const recent = (nbs || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 5)
```

  - Replace the hard-coded `<header className="panel-notice">هیچ نوت‌بوکی در Namespace ⁦godarzi⁩ وجود ندارد</header>` with:

```jsx
              {recent.length === 0 ? (
                <header className="panel-notice">هیچ نوت‌بوکی در Namespace ⁦{ru?.namespace || '—'}⁩ وجود ندارد</header>
              ) : (
                <ul className="dash-recent">
                  {recent.map(n => (
                    <li key={n.name}>
                      <a href="#/notebooks"><bdi dir="ltr">{n.name}</bdi></a>
                      <span className="vl-muted">{fmt.date(n.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
```

and add to `src/styles/pages.css`:

```css
.dash-recent { list-style: none; margin: 0; padding: 4px 16px 12px; display: flex; flex-direction: column; gap: 8px; }
.dash-recent li { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
```

  - Tiles: replace every fallback string (`'۰'`, `'۰.۰'`, `'۱'`, `rial(0)`) with `'—'`. Monthly cost becomes `value={sum?.monthly_cost?.amount_irr != null ? rial(sum.monthly_cost.amount_irr) : '—'}`.
  - The usage chart keeps `(usage?.[col.key] || []).slice(-6)`. The data is now numbers.
  - The cost chart becomes:

```jsx
              <Chart series={[{ color: '#E8A317', data: cost?.daily || [] }]} xLabels={cost?.labels} height={190} unit={cost?.unit === 'usd' ? '$' : 'ریال'} />
```

    Check Chart's prop names with `grep -n "export default function Chart" -A3 src/components/Chart.jsx`. If it doesn't accept `xLabels` as a prop, drop that prop rather than changing Chart.
  - Insert `<ErrorNote error={sumErr} />` as the first child of `.dash-view`.
  - The quick links to `?new=1` stay as navigation links. Task 5 made the target pages ignore `?new=1`.

- [ ] **Step 6: Wire `src/pages/Usage.jsx`.**
  - Change line 48 to `const { data: hist } = useApi('/api/dashboard-usage-history', null, [], adaptUsageHistory)`.
  - Change line 47 to `const { data: u, error } = useApi('/api/resource-usage')`, and render `<ErrorNote error={error} />` at the top of the page body.
  - Line 64: `u.gpu.util_pct.toFixed(1)` stays guarded by the existing `!= null` check.
  - Line 103 reads `backup_cost`. The real `resource-usage` emits `backup_cost` only when a backup price is configured, so the existing `?? '—'` is already correct.

- [ ] **Step 7: Wire `src/components/ResourcesWidget.jsx`.** Replace the quota rows array with real values only:

```jsx
          {[
            ['CPU', qq.cpu_remaining_cores, ru?.cpu?.requested_cores, 'هسته'],
            ['RAM', qq.memory_remaining_gib, ru?.memory?.requested_gib, 'GiB'],
            ['ذخیره‌سازی', qq.storage_remaining_gib, ru?.storage?.capacity_gib, 'GiB'],
          ].map(([l, rem, total, unit]) => (
            <div key={l} className="rw-quota-row">
              <span className="rw-quota-label">{l}</span>
              <span className="rw-quota-val">{rem ?? '—'} / {total ?? '—'} {unit}</span>
            </div>
          ))}
```

Also change the cost fallback `const cost = ru?.cost?.irr ?? 0` to `const cost = ru?.cost?.irr ?? null`. Render `{cost == null ? '—' : Number(cost).toLocaleString('en-US')}`.

- [ ] **Step 8: Verify.** Make the mock's `/api/dashboard-usage-history` return `[[t, v], …]` pairs and add a `/api/dashboard-cost` entry in the real shape.

Run: `npm test && npx vite build 2>&1 | tail -1 && npm run check-dist`
Expected: tests pass and `check-dist OK`.
Then confirm `grep -nE "\?\? (5|8|9|10|13|32)\b|godarzi" src/components/*.jsx src/pages/*.jsx` prints nothing.

- [ ] **Step 9: Commit and tag.**

```bash
git add src/lib/adapters/metrics.js tests/metrics.test.js src/pages/Dashboard.jsx src/pages/Usage.jsx \
  src/components/ResourcesWidget.jsx src/styles/pages.css src/lib/mock.js
git status --short
git commit -m "feat(metrics): real usage history, 30-day cost, recent notebooks; no invented fallbacks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git tag goodarzi-p1-metrics
```

---

### Task 7: Session (identity, namespace, admin), user menu, logout, password, login page removal

**Files:**
- Create: `src/lib/session.js`, `tests/session.test.js`
- Modify: `src/components/UserWidget.jsx`, `src/components/NsSelector.jsx`, `src/components/AppShell.jsx`, `src/pages/admin/AdminPanel.jsx`, `src/App.jsx`
- Delete: `src/pages/Login.jsx`, `src/pages/Login.css`

**Interfaces:**
- Consumes: `getJson` and `send` (Task 3), `adaptBackups` (Task 5).
- Produces:
  - `loadSession() → Promise<{email, namespace, isAdmin, error}>`
  - `useSession() → {email, namespace, isAdmin, loading, error}`, with a module-level memo so all components share one load.
  - `initialsOf(email) → string`
  - `changePassword(currentPassword, newPassword) → Promise<{ok:boolean, message:string}>`
  - `LOGOUT_URL = '/oauth2/sign_out?rd=%2F'`

- [ ] **Step 1: Write the failing tests `tests/session.test.js`.**

```js
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const routes = {}
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} }
globalThis.location = { reload: () => {} }
globalThis.fetch = async (url, init) => {
  const r = routes[`${init?.method || 'GET'} ${url}`]
  if (!r) throw new Error('unexpected ' + url)
  return { ok: r[0] < 300, status: r[0], json: async () => r[1] }
}
const http = await import('../src/lib/http.js')
const { loadSession, initialsOf, changePassword, LOGOUT_URL } = await import('../src/lib/session.js')

beforeEach(() => { http._resetForTests(); for (const k of Object.keys(routes)) delete routes[k] })

test('admin user', async () => {
  routes['GET /api/change-password/whoami'] = [200, { email: 'a@isigpu.local', displayName: 'a@isigpu.local' }]
  routes['GET /api/resource-usage'] = [200, { namespace: 'ns-a' }]
  routes['GET /admin-panel/api/admin/whoami'] = [200, { email: 'a@isigpu.local', role: 'platform-admin' }]
  assert.deepEqual(await loadSession(), { email: 'a@isigpu.local', namespace: 'ns-a', isAdmin: true, error: null })
})

test('non-admin gets 403 from whoami -> isAdmin false, no error', async () => {
  routes['GET /api/change-password/whoami'] = [200, { email: 'u@isigpu.local' }]
  routes['GET /api/resource-usage'] = [200, { namespace: 'ns-u' }]
  routes['GET /admin-panel/api/admin/whoami'] = [403, { error: 'not admin' }]
  const s = await loadSession()
  assert.equal(s.isAdmin, false)
  assert.equal(s.error, null)
})

test('user without a Profile surfaces the namespace error', async () => {
  routes['GET /api/change-password/whoami'] = [200, { email: 'n@isigpu.local' }]
  routes['GET /api/resource-usage'] = [403, { error: 'no Profile found with owner n@isigpu.local' }]
  routes['GET /admin-panel/api/admin/whoami'] = [403, { error: 'x' }]
  const s = await loadSession()
  assert.equal(s.namespace, null)
  assert.equal(s.error.status, 403)
})

test('initials', () => {
  assert.equal(initialsOf('godarzi@isigpu.local'), 'GO')
  assert.equal(initialsOf(''), '?')
})

test('changePassword sends the backend contract and reports its message', async () => {
  let sent
  globalThis.fetch = async (url, init) => { sent = { url, init }; return { ok: false, status: 400, json: async () => ({ error: 'Invalid current password' }) } }
  const r = await changePassword('old', 'new')
  assert.equal(sent.url, '/api/change-password')
  assert.deepEqual(JSON.parse(sent.init.body), { currentPassword: 'old', newPassword: 'new' })
  assert.deepEqual(r, { ok: false, message: 'Invalid current password' })
  assert.equal(LOGOUT_URL, '/oauth2/sign_out?rd=%2F')
})
```

- [ ] **Step 2: Run and see the failure.**

Run: `npm test`
Expected: FAIL, `Cannot find module …/session.js`.

- [ ] **Step 3: Implement `src/lib/session.js`.**

```js
import React from 'react'
import { getJson, send } from './http.js'

// Identity comes from the real backends; the namespace is whatever Profile the user owns
// (kubeflow-resource-usage resolve_namespace()), there is no ?ns= switch server-side.
export const LOGOUT_URL = '/oauth2/sign_out?rd=%2F'

export async function loadSession() {
  const [who, ru, adm] = await Promise.all([
    getJson('/api/change-password/whoami'),
    getJson('/api/resource-usage'),
    getJson('/admin-panel/api/admin/whoami'),
  ])
  return {
    email: who.data?.email || null,
    namespace: ru.data?.namespace || null,
    isAdmin: !adm.error && !!adm.data?.email,
    error: who.error || ru.error || null,
  }
}

export function initialsOf(email) {
  const s = (email || '').split('@')[0].replace(/[^A-Za-z؀-ۿ]/g, '')
  return s ? s.slice(0, 2).toUpperCase() : '?'
}

export async function changePassword(currentPassword, newPassword) {
  const { data, error } = await send('/api/change-password', { body: { currentPassword, newPassword } })
  if (error) return { ok: false, message: error.message }
  return { ok: data?.status === 'ok', message: data?.status === 'ok' ? '' : 'پاسخ نامعتبر از سرور' }
}

let memo = null
export function useSession() {
  const [s, setS] = React.useState({ email: null, namespace: null, isAdmin: false, loading: true, error: null })
  React.useEffect(() => {
    let alive = true
    memo = memo || loadSession()
    memo.then(v => { if (alive) setS({ ...v, loading: false }) })
    return () => { alive = false }
  }, [])
  return s
}
```

- [ ] **Step 4: Run the tests.**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Wire `src/components/UserWidget.jsx`.**
  - Delete the `USERNAME`, `EMAIL` and `INITIALS` constants.
  - Add imports: `import { useSession, initialsOf, changePassword, LOGOUT_URL } from '../lib/session.js'` and `import { adaptBackups } from '../lib/adapters/workloads.js'`.
  - At the top of the component:

```jsx
  const { email, isAdmin } = useSession()
  const username = email ? email.split('@')[0] : '—'
  const initials = initialsOf(email)
  const [pwErr, setPwErr] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
```

  - Replace `{USERNAME}` with `{username}`, `{EMAIL}` with `{email || '—'}`, and `{INITIALS}` with `{initials}`. In the header the email is Latin text, so wrap it in `<bdi dir="ltr">`.
  - Change the backups hook to `const { data: backups } = useApi('/api/backups', [], [], adaptBackups)`.
  - `logout` becomes `const logout = () => { window.location.href = LOGOUT_URL }`.
  - `savePw` becomes:

```jsx
  const savePw = async () => {
    setPwBusy(true); setPwErr('')
    const r = await changePassword(cur, n1)
    setPwBusy(false)
    if (!r.ok) { setPwErr(r.message || 'تغییر گذرواژه ناموفق بود.'); return }
    setPw(false); setCur(''); setN1(''); setN2('')
  }
```

  - In the password modal, add `{pwErr && <p className="uw-error" role="alert" dir="auto">{pwErr}</p>}` above the actions. The save button becomes `disabled={pwBusy || !cur || !n1 || n1 !== n2}`. Add `.uw-error { color:#b91c1c; font-size:12.5px; margin:8px 0 0; }` to `UserWidget.css`.
  - Wrap the "پنل ادمین" `<a>` in `{isAdmin && (…)}`.

- [ ] **Step 6: Wire `src/components/NsSelector.jsx`.** Replace the component body with a read-only namespace display. The backend has a single namespace, so there's no dropdown.

```jsx
import Icon from './Icon.jsx'
import { useApi } from '../lib/api.js'
import { useSession } from '../lib/session.js'
import './NsSelector.css'

export default function NsSelector({ admin }) {
  const { namespace } = useSession()
  const { data: opts } = useApi('/api/notebooks/options')
  const quota = opts?.quota || {}
  return (
    <div className="ns-root">
      <div className="ns-btn" title="Namespace شما">
        <span className="ns-avatar"><Icon name="person" size={16} color="#0a3b71" /></span>
        <div className="ns-btn-body">
          <span className="ns-name"><bdi dir="ltr">{namespace || '—'}</bdi></span>
          <span className="ns-role">مالک</span>
        </div>
      </div>
      {!admin && (
        <div className="ns-quota-strip">
          <span className="ns-quota-item" title="هسته CPU باقی‌مانده">
            <span className="ns-quota-dot cpu" /><span>{quota.cpu_remaining_cores ?? '—'} هسته</span>
          </span>
          <span className="ns-quota-sep" />
          <span className="ns-quota-item" title="حافظه RAM باقی‌مانده">
            <span className="ns-quota-dot mem" /><span>{quota.memory_remaining_gib ?? '—'} GiB</span>
          </span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Session error and real branding in `src/components/AppShell.jsx`.**
  - Import `useSession` and `ErrorNote`, and add `const { error: sessionError } = useSession()` in the component. Render `<ErrorNote error={sessionError} />` as the first child of `<main className="main">`. A user without a Profile then sees why every page is empty.
  - `src/lib/branding.js` defines `useBranding()`, but nothing calls it today. Platform's admin "ظاهر پلتفرم" settings must apply here too. Real `/api/branding` returns `{display_name, primary_color, favicon_data_uri, logo_data_uri}`; the mock's `platform_name` key does not exist.
    - In `branding.js`, after the `primary_color` block, add:

```js
      if (cached.display_name) document.title = cached.display_name
      if (cached.favicon_data_uri) {
        const link = document.querySelector('link[rel="icon"]')
        if (link) link.href = cached.favicon_data_uri
      }
```

    - Call `useBranding()` at the top of `AppShell`.
    - In `src/components/Logo.jsx`, if `useBranding().logo_data_uri` is set, render `<img src={logo_data_uri} alt={display_name || 'logo'} />` in place of the bundled logo. Read the file first and keep its existing size classes.
    - Change the mock's `/api/branding` to `{ display_name: 'دُرج', primary_color: '#12dec6', favicon_data_uri: '', logo_data_uri: '' }`.
    - Add `src/lib/branding.js src/components/Logo.jsx` to this task's `git add`.

- [ ] **Step 8: Gate `src/pages/admin/AdminPanel.jsx`.** Import `useSession`. At the top of the default component:

```jsx
  const { isAdmin, loading } = useSession()
  if (!loading && !isAdmin) {
    return (
      <AppShell active="">
        <div className="paper-card section" style={{ margin: 24, padding: 24 }}>
          <h2>دسترسی ندارید</h2>
          <p>پنل مدیریت فقط برای مدیران پلتفرم در دسترس است.</p>
          <a href="#/">بازگشت به خانه</a>
        </div>
      </AppShell>
    )
  }
```

Keep React's hook-order rule: put this check **after** every hook call in the component.

- [ ] **Step 9: Remove the login page.** In `src/App.jsx`, delete `import Login from './pages/Login.jsx'` and `case 'login': return <Login />`. Then run `git rm src/pages/Login.jsx src/pages/Login.css`. Check `grep -rn "Login\b\|#/login" src` and remove any leftover links. The `Help.jsx` text about logging in stays.

- [ ] **Step 10: Verify.** Add `/api/change-password/whoami` and `/admin-panel/api/admin/whoami` entries to the mock DB, so dev renders as admin.

Run: `npm test && npx vite build 2>&1 | tail -1 && npm run check-dist && ! grep -rn "godarzi" src --include=*.jsx`
Expected: tests pass, `check-dist OK`, and no `godarzi` hard-codes.

- [ ] **Step 11: Commit and tag.**

```bash
git add -A src/lib/session.js tests/session.test.js src/components/UserWidget.jsx src/components/UserWidget.css \
  src/components/NsSelector.jsx src/components/AppShell.jsx src/pages/admin/AdminPanel.jsx src/App.jsx src/pages/Login.jsx src/pages/Login.css src/lib/mock.js \
  src/lib/branding.js src/components/Logo.jsx
git status --short
git commit -m "feat(session): real identity/namespace/admin, sign-out, change-password contract; drop mock login page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git tag goodarzi-p1-session
```

---

### Task 8: Mail with server paging, real message bodies and "seen"

**Files:**
- Create: `src/lib/adapters/mail.js`, `tests/mail.test.js`
- Modify: `src/pages/Mail.jsx`

**Interfaces:**
- Consumes: `useApi` and `apiPost` (Task 3), `getJson` (Task 3).
- Produces:
  - `mailListPath(folder, page0, q) → string`
  - `adaptMailPage(raw) → {messages, totalPages, page, address}`
  - `messagePath(folder, uid) → string`
  - `adaptMailBody(raw) → {text, html, attachments}`

- [ ] **Step 1: Write the failing tests `tests/mail.test.js`.**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mailListPath, adaptMailPage, messagePath, adaptMailBody } from '../src/lib/adapters/mail.js'

test('list path is 1-based and encodes folder and query', () => {
  assert.equal(mailListPath('INBOX', 0, ''), '/api/mail/messages?folder=INBOX&page=1')
  assert.equal(mailListPath('Sent Items', 2, 'gpu hi'), '/api/mail/messages?folder=Sent%20Items&page=3&q=gpu%20hi')
})

test('page adapter', () => {
  const p = adaptMailPage({ address: 'u@x', page: 2, total_pages: 5, messages: [{ uid: 9, seen: false, from: 'A <a@x>', subject: 's', date: 'd' }] })
  assert.equal(p.totalPages, 5)
  assert.equal(p.page, 2)
  assert.equal(p.messages[0].uid, 9)
  assert.deepEqual(adaptMailPage(null), { messages: [], totalPages: 1, page: 1, address: '' })
})

test('message path and body', () => {
  assert.equal(messagePath('INBOX', 9), '/api/mail/message?folder=INBOX&uid=9')
  assert.deepEqual(adaptMailBody({ body_text: 't', body_html: '<p>h</p>', attachments: [{ index: 0 }] }), { text: 't', html: '<p>h</p>', attachments: [{ index: 0 }] })
  assert.deepEqual(adaptMailBody(null), { text: '', html: '', attachments: [] })
})
```

- [ ] **Step 2: Run and see the failure.**

Run: `npm test`
Expected: FAIL, missing module.

- [ ] **Step 3: Implement `src/lib/adapters/mail.js`.**

```js
// /api/mail/messages pages server-side (30 per page, 1-based, optional q).
export function mailListPath(folder, page0, q) {
  let p = `/api/mail/messages?folder=${encodeURIComponent(folder)}&page=${page0 + 1}`
  if (q) p += `&q=${encodeURIComponent(q)}`
  return p
}

export const adaptMailPage = raw => ({
  messages: Array.isArray(raw?.messages) ? raw.messages : [],
  totalPages: raw?.total_pages || 1,
  page: raw?.page || 1,
  address: raw?.address || '',
})

export const messagePath = (folder, uid) => `/api/mail/message?folder=${encodeURIComponent(folder)}&uid=${uid}`

export const adaptMailBody = raw => ({
  text: raw?.body_text || '',
  html: raw?.body_html || '',
  attachments: Array.isArray(raw?.attachments) ? raw.attachments : [],
})
```

- [ ] **Step 4: Run the tests.**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Wire `src/pages/Mail.jsx`.**
  - Imports: the four adapter functions, `ErrorNote`, `useApi` and `apiPost` (already imported).
  - Replace lines 52-58 (the folder and messages hooks, `all`, `per`, `pages` and `msgs`) with:

```jsx
  const { data: fd, error: fdErr } = useApi('/api/mail/folders', null, [ver])
  const { data: md, error: mdErr } = useApi(mailListPath(folder, page, query.trim()), null, [ver], adaptMailPage)
  const folders = fd?.folders || []
  const msgs = md?.messages || []
  const pages = md?.totalPages || 1
  const { data: body, loading: bodyLoading } = useApi(msg ? messagePath(folder, msg.uid) : null, null, [], adaptMailBody)
```

  - Use `msgs` everywhere the old code used `msgs`/`all`. The search input's `onChange` must also `setPage(0)`.
  - Render `<ErrorNote error={fdErr || mdErr} />` above the list. The backend answers 502 when the user has no mailbox, so the note explains instead of showing an empty inbox.
  - `openMsg` keeps the `apiPost('/api/mail/seen', …)` call. After it, call `setVer(v => v + 1)` only if the call returned no `error`:

```jsx
  const openMsg = async m => {
    setMsg(m)
    if (!m.seen) {
      const r = await apiPost('/api/mail/seen', { folder, uid: m.uid })
      if (!r.error) setVer(v => v + 1)
    }
  }
```

  - Replace the modal body `{msg.body || 'متن این پیام …'}` with:

```jsx
              {bodyLoading ? 'در حال بارگذاری…'
                : body?.text ? <div style={{ whiteSpace: 'pre-wrap' }} dir="auto">{body.text}</div>
                : body?.html ? <iframe title="mail" sandbox="" srcDoc={body.html} style={{ width: '100%', minHeight: 320, border: 0 }} />
                : 'این پیام متنی ندارد.'}
              {body?.attachments?.length > 0 && (
                <ul className="ml-attachments">
                  {body.attachments.map(a => (
                    <li key={a.index}>
                      <a href={`/api/mail/attachment?folder=${encodeURIComponent(folder)}&uid=${msg.uid}&index=${a.index}`}>
                        <bdi dir="ltr">{a.filename}</bdi>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
```

    The backend already sanitizes `body_html` (`_mail_sanitize_html`), and `sandbox=""` blocks scripts as a second layer. Attachment download is a GET of an existing backend route, so it's read access, not a Phase-2 mutation.
  - The mail address header (`fd?.address`) is unchanged and real.

- [ ] **Step 6: Verify.** Update the mock: messages in the real shape with paging fields, plus `/api/mail/message` returning `{body_text, body_html, attachments}`. Make `resolve()` in `mock.js` handle the `/api/mail/message?` prefix.

Run: `npm test && npx vite build 2>&1 | tail -1 && npm run check-dist`
Expected: all green.

- [ ] **Step 7: Commit and tag.**

```bash
git add src/lib/adapters/mail.js tests/mail.test.js src/pages/Mail.jsx src/lib/mock.js
git status --short
git commit -m "feat(mail): server paging + search, real message bodies (sandboxed html), attachments, seen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git tag goodarzi-p1-mail
```

---

### Task 9: Read-only admin lists; Phase-3 tabs marked "soon"

**Files:**
- Modify: `src/pages/admin/Profiles.jsx`, `Users.jsx`, `Groups.jsx`, `ModelsAdmin.jsx`, `Gpu.jsx`, `Misc.jsx`

**Interfaces:**
- Consumes: `useApi` (Task 3), `ErrorNote` and `soonProps`/`SOON` (Task 5).
- Produces: nothing new.

These pages already read the real field names, which source reading confirmed:
- users: `username`, `email`, `enabled`, `federated`, `pending_approval`, `is_platform_admin`
- groups: `id`, `name`, `member_count`, `access`
- models: `id`, `display_name`, `engine`, `gpu_required`, `node`, `status`, `litellm_alias`
- profiles: `name`, `owner`, `created_at`, `tier`, `resource_quota.hard`
- sla-nodes: `name`, `reserved_for`, `cpu_capacity_cores`, `memory_capacity_gib`, `gpu_summary`, `pod_count`
- gpu-passthrough: `gpus[].{node,bdf,model,current_driver,in_sync}`, `capacity_summary`, `capital_report`, `cost_by_department.rows`, `gpu_workload_usage`

So this task only adds error display and disables writes.

- [ ] **Step 1: Write the check that fails today.**

Run: `grep -nE "apiPost|apiSend" src/pages/admin/*.jsx`
Expected now: `Profiles.jsx:38` posts the profile edit. After this task the command prints nothing.

- [ ] **Step 2: Error notes.** In each of `Profiles.jsx` (both `Profiles` and `SlaNodes`), `Users.jsx`, `Groups.jsx`, `ModelsAdmin.jsx` and `Gpu.jsx`:
  - Destructure `error` from `useApi` (for example `const { data, error } = useApi('/admin-panel/api/admin/users', [])`).
  - Render `<ErrorNote error={error} />` as the first element of the returned JSX.

- [ ] **Step 3: Disable the writes.**
  - In `Profiles.jsx`, delete the `apiPost` import and the `save` body that posts. Every edit/save/approve button gets `{...soonProps}` and loses its `onClick`.
  - Do the same for every `<button` in `Users.jsx`, `Groups.jsx`, `ModelsAdmin.jsx` and `Gpu.jsx` that opens an edit dialog or performs an action. `grep -n "<button" src/pages/admin/*.jsx` lists them.
  - Pagination, tab and filter buttons stay enabled, because they don't write.

- [ ] **Step 4: Phase-3 placeholders.** In `Misc.jsx`, each exported tab (`NotebookOptions`, `Branding`, `Settings`, `AccessMatrix`, `Broadcast`, `LlmIssue`, `Assistant`, `Security`, `Monitoring`) must show no fabricated data. Replace each component's body with:

```jsx
  return <SoonPanel title={TITLE} />
```

where `TITLE` is the tab's label from `AdminPanel.jsx` `SECTIONS`:

| Component | `TITLE` |
|---|---|
| `NotebookOptions` | `'تنظیمات نوت‌بوک'` |
| `Branding` | `'ظاهر پلتفرم'` |
| `Settings` | `'تنظیمات'` |
| `AccessMatrix` | `'دسترسی‌ها'` |
| `Broadcast` | `'ارسال گروهی ایمیل'` |
| `LlmIssue` | `'درخواست‌ها'` |
| `Assistant` | `'دستیار هوشمند'` |
| `Security` | `'امنیت'` |
| `Monitoring` | `'مانیتورینگ'` |

and add to the top of `Misc.jsx`:

```jsx
import { SOON } from '../../lib/soon.js'

function SoonPanel({ title }) {
  return (
    <div className="paper-card section" style={{ padding: 24 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p>این بخش در فاز بعدی به سرویس واقعی متصل می‌شود — {SOON}.</p>
      <p><a href="https://platform.isigpu.local/admin-panel/" target="_blank" rel="noopener">فعلاً از پنل مدیریت پلتفرم استفاده کنید ↗</a></p>
    </div>
  )
}
```

Before replacing them, check whether any of these components already calls `useApi` with a real endpoint: `grep -n useApi src/pages/admin/Misc.jsx`. If one does, keep it read-only, apply Step 2 to it, and don't replace it.

- [ ] **Step 5: Verify.**

Run: `! grep -nE "apiPost|apiSend" src/pages/admin/*.jsx && npm test && npx vite build 2>&1 | tail -1 && npm run check-dist`
Expected: no matches, tests pass, `check-dist OK`.

- [ ] **Step 6: Commit and tag.**

```bash
git add src/pages/admin/
git commit -m "feat(admin): read-only real lists with error states; Phase-3 tabs marked soon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git tag goodarzi-p1-admin-ro
```

---

### Task 10: Deploy to the cluster (script 135 and manifest)

**Files:**
- Create: `/workdir/k8s-deploy/k8s/dorj-service-manifest.yml.tmpl`
- Create: `/workdir/k8s-deploy/scripts/135-deploy-dorj-service.sh`

**Interfaces:**
- Consumes: the image build context from Task 4, the `DORJ_SERVICE_*` vars from Task 2, and the absolute SSO callbacks from Task 2.
- Produces: a live `https://goodarzi.isigpu.local`.

- [ ] **Step 1: Write the manifest template.**

```yaml
# goodarzi.isigpu.local - dorjService frontend (docs: dorjService/docs/superpowers/specs/2026-10-03-goodarzi-phase1-design.md)
apiVersion: v1
kind: Namespace
metadata:
  name: ${DORJ_SERVICE_NAMESPACE}
  labels:
    istio-injection: enabled
    pod-security.kubernetes.io/enforce: restricted
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dorj-service
  namespace: ${DORJ_SERVICE_NAMESPACE}
  labels: {app: dorj-service}
spec:
  replicas: 1
  selector: {matchLabels: {app: dorj-service}}
  template:
    metadata:
      labels: {app: dorj-service}
    spec:
      securityContext: {runAsNonRoot: true, runAsUser: 101, runAsGroup: 101, seccompProfile: {type: RuntimeDefault}}
      containers:
        - name: web
          image: ${DORJ_SERVICE_IMAGE}
          imagePullPolicy: IfNotPresent
          ports: [{containerPort: 8080, name: http}]
          readinessProbe: {httpGet: {path: /healthz, port: 8080}, periodSeconds: 10}
          livenessProbe: {httpGet: {path: /healthz, port: 8080}, initialDelaySeconds: 5, periodSeconds: 30}
          resources:
            requests: {cpu: 20m, memory: 32Mi}
            limits: {cpu: 200m, memory: 128Mi}
          securityContext: {allowPrivilegeEscalation: false, capabilities: {drop: ["ALL"]}}
---
apiVersion: v1
kind: Service
metadata:
  name: dorj-service
  namespace: ${DORJ_SERVICE_NAMESPACE}
spec:
  selector: {app: dorj-service}
  ports: [{name: http, port: 80, targetPort: 8080}]
---
# Only static assets for this authority; every /api, /notebook, /dex, /oauth2 route stays on the
# existing host-"*" VirtualServices so auth + data follow platform's real chain.
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: dorj-service
  namespace: ${DORJ_SERVICE_NAMESPACE}
spec:
  gateways: [kubeflow/kubeflow-gateway]
  hosts: ["*"]
  http:
    - name: dorj-service-static
      match:
        - {authority: {exact: ${DORJ_SERVICE_HOSTNAME}}, uri: {exact: /}}
        - {authority: {exact: ${DORJ_SERVICE_HOSTNAME}}, uri: {exact: /index.html}}
        - {authority: {exact: ${DORJ_SERVICE_HOSTNAME}}, uri: {exact: /robots.txt}}
        - {authority: {exact: ${DORJ_SERVICE_HOSTNAME}}, uri: {prefix: /assets/}}
        - {authority: {exact: ${DORJ_SERVICE_HOSTNAME}}, uri: {prefix: /fonts/}}
        - {authority: {exact: ${DORJ_SERVICE_HOSTNAME}}, uri: {prefix: /img/}}
      route:
        - destination: {host: dorj-service.${DORJ_SERVICE_NAMESPACE}.svc.cluster.local, port: {number: 80}}
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: dorj-service
  namespace: ${DORJ_SERVICE_NAMESPACE}
spec:
  action: ALLOW
  selector: {matchLabels: {app: dorj-service}}
  rules:
    - from: [{source: {principals: ["cluster.local/ns/istio-system/sa/istio-ingressgateway-service-account"]}}]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: goodarzi
  namespace: istio-system
  annotations:
    cert-manager.io/cluster-issuer: isigpu-ca-issuer
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "180"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "180"
spec:
  ingressClassName: nginx
  tls: [{hosts: ["${DORJ_SERVICE_HOSTNAME}"], secretName: goodarzi-tls}]
  rules:
    - host: ${DORJ_SERVICE_HOSTNAME}
      http:
        paths:
          - {path: /, pathType: Prefix, backend: {service: {name: istio-ingressgateway, port: {number: 80}}}}
```

The kubelet probes reach `/healthz` directly through Istio's probe rewrite (the sidecar rewrites HTTP probes by default), so the AuthorizationPolicy doesn't block them.

- [ ] **Step 2: Write `scripts/135-deploy-dorj-service.sh`.**

```bash
#!/usr/bin/env bash
# Deploys goodarzi.isigpu.local (2026-10-03): the dorjService React frontend
# (/workdir/dorjService, docs/superpowers/specs/2026-10-03-goodarzi-phase1-design.md).
#   1. builds + pushes dorj-service:${DORJ_SERVICE_TAG} unless already in the registry (--rebuild forces)
#   2. applies k8s/dorj-service-manifest.yml.tmpl (ns, deploy, svc, VS, AuthorizationPolicy, ingress)
#   3. checks the gateway route order: goodarzi static route before centraldashboard's catch-all
#   4. smoke: goodarzi / and /api/resource-usage go through SSO; platform / still goes to Dex too
# Needs script 134 (--apply) first: SSO must issue absolute per-host callbacks.
#   135-deploy-dorj-service.sh [--rebuild] | --rollback
source "$(dirname "${BASH_SOURCE[0]}")/lib-common.sh"
require_cmd docker envsubst curl python3
ARTIFACTS_DIR="${DEPLOY_WORKDIR}/inventory/mycluster/artifacts"
KUBECTL_BIN="${ARTIFACTS_DIR}/kubectl"
KUBECONFIG_FILE="${ARTIFACTS_DIR}/admin.conf"
[[ -x "${KUBECTL_BIN}" ]] || die "kubectl not found at ${KUBECTL_BIN}"
kc() { "${KUBECTL_BIN}" --kubeconfig="${KUBECONFIG_FILE}" "$@"; }
OUT="${DEPLOY_WORKDIR}/k8s/dorj-service-manifest.rendered.yml"
export DORJ_SERVICE_NAMESPACE DORJ_SERVICE_HOSTNAME DORJ_SERVICE_IMAGE
render() { envsubst '${DORJ_SERVICE_NAMESPACE} ${DORJ_SERVICE_HOSTNAME} ${DORJ_SERVICE_IMAGE}' \
  < "${DEPLOY_WORKDIR}/k8s/dorj-service-manifest.yml.tmpl" > "${OUT}"; }

if [[ "${1:-}" == "--rollback" ]]; then
  render; kc delete -f "${OUT}" --ignore-not-found --wait=false
  log "dorj-service removed (namespace, VS, AuthorizationPolicy, ingress goodarzi). platform.isigpu.local untouched."
  exit 0
fi
REBUILD=0; [[ "${1:-}" == "--rebuild" ]] && REBUILD=1

# --- 1. image ---------------------------------------------------------------------
[[ -f "${DORJ_SERVICE_SRC}/Dockerfile" ]] || die "no Dockerfile in ${DORJ_SERVICE_SRC}"
if [[ "${REBUILD}" == 1 ]] || ! curl -sf "http://${DEPLOY_NODE_IP}:${REGISTRY_PORT}/v2/dorj-service/manifests/${DORJ_SERVICE_TAG}" \
     -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' >/dev/null; then
  log "Building ${DORJ_SERVICE_IMAGE} from ${DORJ_SERVICE_SRC} ($(git -C "${DORJ_SERVICE_SRC}" describe --always --dirty))..."
  docker build --build-arg HTTP_PROXY= --build-arg HTTPS_PROXY= \
    --build-arg NPM_CONFIG_REGISTRY="http://${DEPLOY_NODE_IP}:${NEXUS_PORT}/repository/npm-proxy/" \
    -t "${DORJ_SERVICE_IMAGE}" "${DORJ_SERVICE_SRC}"
  docker push "${DORJ_SERVICE_IMAGE}"
else
  log "${DORJ_SERVICE_IMAGE} already in the registry (--rebuild to force)."
fi

# --- 2. manifest ------------------------------------------------------------------
render; kc apply -f "${OUT}"
kc -n "${DORJ_SERVICE_NAMESPACE}" rollout status deploy/dorj-service --timeout=180s
kc -n istio-system wait --for=condition=Ready certificate/goodarzi-tls --timeout=120s 2>/dev/null \
  || warn "certificate goodarzi-tls not Ready yet (check cert-manager)"

# --- 3. route order on the gateway -------------------------------------------------
sleep 5
kc -n istio-system exec deploy/istio-ingressgateway -c istio-proxy -- \
  pilot-agent request GET 'config_dump?resource=dynamic_route_configs' > "${DEPLOY_WORKDIR}/backups/gw-routes-135.json"
python3 - "${DEPLOY_WORKDIR}/backups/gw-routes-135.json" "${DORJ_SERVICE_HOSTNAME}" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); host=sys.argv[2]
for rc in d["configs"]:
    cfg=rc.get("route_config",{})
    for vh in cfg.get("virtual_hosts",[]):
        if "*" not in vh.get("domains",[]): continue
        names=[]
        for r in vh["routes"]:
            m=r.get("match",{}); hdr=[h.get("name") for h in m.get("headers",[])]
            dest=(r.get("route",{}).get("cluster") or "")
            names.append((m.get("path") or m.get("prefix") or m.get("safe_regex",{}).get("regex"), ":authority" in hdr, dest))
        mine=[i for i,(p,a,dst) in enumerate(names) if a and "dorj-service" in dst]
        catch=[i for i,(p,a,dst) in enumerate(names) if p=="/" and not a and "centraldashboard" in dst]
        if mine and catch:
            print("dorj-service routes at", mine, "centraldashboard catch-all at", catch)
            sys.exit(0 if max(mine) < min(catch) else 3)
print("could not find both routes in", cfg.get("name","?")); sys.exit(4)
PY
rc=$?; [[ $rc == 0 ]] || die "gateway route order check failed (rc=$rc) - inspect backups/gw-routes-135.json; '--rollback' to remove"

# --- 4. smoke -----------------------------------------------------------------------
probe() { curl -sk --noproxy '*' -o /dev/null -w '%{http_code} %{redirect_url}' -H 'Accept: text/html' \
  --resolve "$1:443:${KUBE_VIP_SERVICES_ADDRESS}" "https://$1$2"; }
g_home="$(probe "${DORJ_SERVICE_HOSTNAME}" /)"
g_api="$(curl -sk --noproxy '*' -o /dev/null -w '%{http_code}' --resolve "${DORJ_SERVICE_HOSTNAME}:443:${KUBE_VIP_SERVICES_ADDRESS}" "https://${DORJ_SERVICE_HOSTNAME}/api/resource-usage")"
p_home="$(probe "${KUBEFLOW_HOSTNAME}" /)"
log "goodarzi / -> ${g_home%%&*}"; log "goodarzi /api/resource-usage -> ${g_api}"; log "platform / -> ${p_home%%&*}"
[[ "${g_home}" == 302*"/dex/auth"*"redirect_uri=https%3A%2F%2F${DORJ_SERVICE_HOSTNAME}%2Foauth2%2Fcallback"* ]] \
  || die "goodarzi / must redirect to Dex with its own absolute callback"
[[ "${g_api}" == 401 ]] || die "goodarzi /api/* must answer 401 unauthenticated (oauth2-proxy api_routes)"
[[ "${p_home}" == 302*"/dex/auth"* ]] || die "platform / must still redirect to Dex"
log "135-deploy-dorj-service.sh complete: https://${DORJ_SERVICE_HOSTNAME}/  DNS: ${DORJ_SERVICE_HOSTNAME} -> ${KUBE_VIP_SERVICES_ADDRESS}"
```

`chmod +x scripts/135-deploy-dorj-service.sh`

- [ ] **Step 3: Syntax-check the script.**

Run: `bash -n scripts/135-deploy-dorj-service.sh && shellcheck -S warning scripts/135-deploy-dorj-service.sh || true`
Expected: no syntax errors.

- [ ] **Step 4: Run it.**

Run: `cd /workdir/k8s-deploy && ./scripts/135-deploy-dorj-service.sh`
Expected:
- the rollout succeeds
- `dorj-service routes at [...] centraldashboard catch-all at [...]`, with mine < catch
- `goodarzi / -> 302 https://goodarzi.isigpu.local/dex/auth?...`
- `goodarzi /api/resource-usage -> 401`
- `platform / -> 302 .../dex/auth...`

Failure modes:
- **Route order** (rc=3): Istio did not place the authority-matched VS first. Run `--rollback`, then report to the user. Moving the static routes into a host-specific VS is spec option B and needs a new decision.
- **Pod not Ready under `restricted` PSA**: `kc -n dorj-service describe pod` shows the sidecar init container being rejected. The kubeflow ns runs restricted with sidecars, so the cluster uses istio-cni; compare `kc get ns kubeflow -o yaml` labels/annotations and copy any missing label.

- [ ] **Step 5: Commit (k8s-deploy).**

```bash
cd /workdir/k8s-deploy
git add k8s/dorj-service-manifest.yml.tmpl scripts/135-deploy-dorj-service.sh
git status --short
git commit -m "feat(dorj-service): goodarzi.isigpu.local - static VS on kubeflow-gateway, script 135

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Live e2e on goodarzi, platform regression, release

**Files:**
- Create: `/workdir/dorjService/e2e/goodarzi.spec.js`
- Modify: memory (`/home/admin/.claude/projects/-workdir/memory/project_goodarzi_dorjservice_2026-10-03.md`)

**Interfaces:**
- Consumes: `login()` (Task 1) and the live deploy (Task 10).

- [ ] **Step 1: Write `e2e/goodarzi.spec.js`.**

```js
import { test, expect } from '@playwright/test'
import { login } from './login.js'

const G = 'https://goodarzi.isigpu.local'
const ROUTES = ['', 'notebooks', 'volumes', 'vms', 'usage', 'mail', 'help']

function trackApi(page) {
  const seen = []
  page.on('response', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/admin-panel/api/')) seen.push({ path: u.pathname, status: r.status() }) })
  return seen
}

test('user: every page loads real data from goodarzi', async ({ page }) => {
  const seen = trackApi(page)
  await login(page, G, process.env.E2E_USER, process.env.E2E_PASS)
  // the SPA shell (not centraldashboard) is served on goodarzi
  await expect(page.locator('#root')).toBeAttached()
  const ns = (await (await page.request.get(G + '/api/resource-usage')).json()).namespace
  expect(ns).toBeTruthy()
  for (const r of ROUTES) {
    await page.goto(`${G}/#/${r}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.app-layout')).toBeVisible()
  }
  await page.goto(`${G}/#/`)
  await expect(page.locator('.ns-name')).toContainText(ns)
  const fiveXX = seen.filter(s => s.status >= 500 && !s.path.startsWith('/api/mail'))
  expect(fiveXX, JSON.stringify(fiveXX)).toEqual([])
  expect(seen.some(s => s.path === '/api/notebooks' && s.status === 200)).toBe(true)
  expect(await page.evaluate(() => window.__DORJ_MOCK_API__ === true)).toBe(false)
  // non-admin: no admin link, admin route shows the 403 card
  await page.locator('.uw-trigger').click()
  const adminLinks = await page.locator('a[href="#/admin-panel"]').count()
  const isAdmin = (await page.request.get(G + '/admin-panel/api/admin/whoami')).status() === 200
  expect(adminLinks > 0).toBe(isAdmin)
})

test('user: notebook links stay on goodarzi', async ({ page }) => {
  await login(page, G, process.env.E2E_USER, process.env.E2E_PASS)
  await page.goto(`${G}/#/notebooks`)
  await page.waitForLoadState('networkidle')
  for (const href of await page.locator('a.nb-action-btn').evaluateAll(as => as.map(a => a.getAttribute('href')))) {
    expect(href.startsWith('https://platform.isigpu.local')).toBe(false)
  }
})

test('admin: admin panel lists load', async ({ page }) => {
  const seen = trackApi(page)
  await login(page, G, process.env.E2E_ADMIN_USER, process.env.E2E_ADMIN_PASS)
  await page.goto(`${G}/#/admin-panel`)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.admin-layout')).toBeVisible()
  expect(seen.some(s => s.path === '/admin-panel/api/admin/profiles' && s.status === 200)).toBe(true)
})

test('logout ends the goodarzi session', async ({ page }) => {
  await login(page, G, process.env.E2E_USER, process.env.E2E_PASS)
  await page.locator('.uw-trigger').click()
  await page.locator('.uw-item.danger').click()
  await page.waitForLoadState('networkidle')
  const r = await page.request.get(G + '/api/resource-usage', { maxRedirects: 0 })
  expect([401, 403]).toContain(r.status())
})
```

If a selector (`.uw-trigger`, `.uw-item.danger`, `.ns-name`, `.admin-layout`, `.app-layout`, `a.nb-action-btn`) no longer exists after Tasks 5-9, check it with `grep -rn "<selector-class>" src` and update the spec to the real class. Don't change the UI just to fit the test.

- [ ] **Step 2: Run goodarzi e2e and the platform regression.**

Run: `cd /workdir/dorjService && env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy npm run e2e`
Expected: `6 passed` (4 goodarzi + 2 platform).
On any failure, use superpowers:systematic-debugging. A failure in the platform spec is P0: run `135 --rollback` and `134 --rollback` first, then debug.

- [ ] **Step 3: Visual check.** Take screenshots of `#/`, `#/notebooks`, `#/volumes`, `#/mail` and `#/admin-panel` with the admin user into `test-results/` (`await page.screenshot({ path: 'test-results/<name>.png', fullPage: true })` in a throwaway spec run, which is not committed). Read the images and confirm:
- RTL layout intact
- no `godarzi` placeholder
- no `NaN` or `undefined`
- disabled buttons show `به‌زودی` on hover

- [ ] **Step 4: Commit and tag (frontend).**

```bash
cd /workdir/dorjService
git add e2e/goodarzi.spec.js
git commit -m "test(e2e): goodarzi.isigpu.local user/admin/logout flows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git tag goodarzi-p1-live
```

- [ ] **Step 5: Tag k8s-deploy.** Run `cd /workdir/k8s-deploy && git tag --sort=-creatordate | head -1`. Tag the next minor (e.g. `v1.955.0`) with `git tag -a v1.955.0 -m "goodarzi.isigpu.local phase 1 (scripts 134, 135)"`.

- [ ] **Step 6: Update memory.** Rewrite `project_goodarzi_dorjservice_2026-10-03.md` with:
  - live status, image tag and scripts 134/135
  - the SSO change and its rollback
  - "Phase 2 next"

Update its line in `MEMORY.md`.

- [ ] **Step 7: Report to the user (Finglish, table).** Report:
  - what is live
  - test results with counts
  - that DNS for `goodarzi.isigpu.local → 172.16.50.202` must be added on their DNS server. Script 132's dorj.isigpu.local followed the same manual step.
  - that nothing was pushed to GitHub
  - a short list of Phase 2 items now visible as `به‌زودی`
