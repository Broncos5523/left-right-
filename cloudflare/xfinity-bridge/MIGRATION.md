# MAN CAVE SPORTS BOOK — XFINITY CLOUDflare MIGRATION
Date: November 17, 2026
Status: CODE + OFFLINE SECURITY TESTS PASSED; CLOUDFLARE DEPLOYMENT / LIVE PAIRING NOT COMPLETE

## What exists
The Node/Express service at `server/xfinity_bridge/app.js` previously ran on
`man-cave-xfinity-bridge.onrender.com`. The connected Render account reports
this service **suspended for billing**.

A standalone, dependency-free Cloudflare Worker is now staged at:
- `cloudflare/xfinity-bridge/worker.mjs`
- `cloudflare/xfinity-bridge/wrangler.jsonc`
- `cloudflare/xfinity-bridge/worker.test.mjs`

Worker name (separate from the 28-board Worker): `man-cave-xfinity-bridge`.
The expected workers.dev address **after Cloudflare creates/deploys it** is
`https://man-cave-xfinity-bridge.broncos5523.workers.dev`.
Do not treat this URL as active until the public `/health` endpoint is verified.

No TV commands or real Firebase writes are executed by the test workflow:
`.github/workflows/verify-cloudflare-xfinity-bridge.yml`.
The tests cover legacy Node AES-GCM compatibility, signed Firebase ID-token
validation, all four separate pairings, command requests, rejection of bad tokens,
and safe failure if the original encryption key is missing or mismatched.

## Recovery: do not erase existing pairings
The existing encrypted Xfinity tokens are in the **original Firebase Realtime
Database**, under `private_services/xfinity_remote/{top_left,top_right,center,side}`.
The Cloudflare Worker reads **exactly those same records**. The Worker supports
Node's old v1 encrypted token byte format (IV | GCM tag | ciphertext).

**Preserve `TOKEN_ENCRYPTION_KEY` exactly** from the Render bridge's private
environment settings or a prior secure backup. A newly generated key cannot
decrypt the existing pairing records. If the old key is unavailable, only then
re-pair individual boxes, which replaces their encrypted record. No automatic
database deletion or re-pairing has been triggered.

Do not paste the key, any Firebase service-account JSON, Xfinity arTokens, Firebase
user ID tokens, or pairing codes into ChatGPT, GitHub files, screenshots or issues.

## One-time Cloudflare setup on your iPhone
1. Open https://dash.cloudflare.com/ and select **Workers & Pages**.
2. Create an **independent Worker** named exactly `man-cave-xfinity-bridge`
   using **Import Git repository** / **Connect GitHub**.
3. Choose repository `Broncos5523/left-right-`, branch `main`.
   Set root directory to `cloudflare/xfinity-bridge`.
   Set deploy command to `npx wrangler deploy` (no build step necessary).
   Match the Worker name in `wrangler.jsonc`. Confirm this is not replacing
   the existing `man-cave-28-page` Worker.
4. Under the new Worker's **Settings → Variables and Secrets**, add these
   variables as type **Secret**, with values entered directly in Cloudflare:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: same original Firebase service account
     JSON used by the Render bridge. If unavailable, generate a new *private*
     Firebase Admin service-account key from Firebase Console → Project
     settings → Service accounts.
   - `ADMIN_UIDS`: allowlisted Firebase Auth user UID(s), comma separated,
     as previously used by the Render bridge. See the private pairing setup
     page after signing in for the UID; do not confuse it with an email.
   - `TOKEN_ENCRYPTION_KEY`: EXACT previous 32-byte base64 key from Render,
     not a fresh key if old pairings should continue working.
   Optional plain configuration (Worker already supplies safe defaults):
   - `FIREBASE_DATABASE_URL` =
     `https://man-cave-left-right-default-rtdb.firebaseio.com`
   - `CONTROLLER_ORIGIN` = `https://broncos5523.github.io`
5. Deploy and visit the new `/health` URL. It should return
   `{"ok":true,"service":"man-cave-xfinity-bridge",
   "runtime":"cloudflare-workers","configured":true}`.
   If `configured:false`, one or more required private variables is missing
   or malformed. The health endpoint does not expose any secret value.

If the Cloudflare dashboard doesn't offer Git import for this repo,
keep the existing Worker untouched and use a Cloudflare Worker build connected
to the same repository and folder; **do not paste the Worker source into a
public secret-sharing editor**. The connected GitHub source is the deployable
artifact.

## Behavior and cutover gate
- Existing protected API contracts remain:
  `GET /api/boxes`, `POST /api/pair/start`,
  `POST /api/pair/status`, `POST /api/send`.
- Firebase ID tokens must have a valid Google signature, correct project,
  non-anonymous provider, and UID on the admin allowlist.
- The Worker uses a private Google OAuth service-account access token for RTDB
  reads and writes, short-lived Firebase conditional locks, and no client-side
  access to saved Xfinity secrets.
- Browser origin is restricted to `https://broncos5523.github.io`.
- The original four Xfinity box names are preserved.
- A successful Xfinity HTTP response is not proof the physical TV changed.
- The old Express bridge also hosted separate public sports-info routes
  (`/nfl-local-coverage`, `/nhl-team-leaders`). Those are **not yet
  migrated** to this security-focused Xfinity Worker. Do not retire their
  client consumers or claim a total Render retirement without checking them.

**Do not redirect Controller V46 until after:**
1. Worker `/health` reports configured true.
2. A signed-in controller's `/api/boxes` sees the expected pairings.
3. A single test `Watch ESPN` changes the correct actual box.
4. Confirm source/token refresh and all four boxes behave reliably.
5. Switch only the Xfinity endpoint in a **separate controller version**,
   leaving working V46 and the 28-board Cloudflare player unchanged.

If the Xfinity unofficial API blocks Cloudflare edge egress, report that
as a real blocker and preserve the controller/board setup; do not invent
a success or silently redirect to Render.

## Sources
- Cloudflare Worker secret setup:
  https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Git integration:
  https://developers.cloudflare.com/workers/ci-cd/builds/
- Firebase token validation:
  https://firebase.google.com/docs/auth/admin/verify-id-tokens
- Firebase RTDB service account OAuth:
  https://firebase.google.com/docs/database/rest/auth
