# Man Cave Xfinity Bridge — experimental

This Node.js service is separate from all working TV board pages. It talks to the Xfinity Web Remote's unofficial cloud API based on the independently developed source at https://github.com/JeffSteinbok/hass-xfinityremote .

## Features
- Firebase UID allowlist authorization, rejecting anonymous viewers.
- Independent EasyPair sessions for Top Left, Top Right, Center, Side.
- Xfinity arTokens encrypted with AES-256-GCM before persistence in Firebase Realtime Database.
- On-demand token refresh (after 35 minutes) and simple command throttling.
- Command types: text, channel digits, common remote keys.
- No tokens, service credentials, or encryption key exposed to frontend JavaScript.

## Render configuration
- Repository: https://github.com/Broncos5523/left-right-
- Runtime: Node
- Region: ideally Virginia (US east).
- Build command: cd server/xfinity_bridge && npm install --omit=dev
- Start command: cd server/xfinity_bridge && npm start
- Health endpoint: /health
- Plan: Free for proof of concept, if available. Free instances may sleep.

Set the following only in Render private environment settings, never in the GitHub repo or ChatGPT:
- FIREBASE_SERVICE_ACCOUNT_JSON: Full Firebase Admin service account JSON from the man-cave-left-right project, stored as a private Render environment variable.
- FIREBASE_DATABASE_URL: https://man-cave-left-right-default-rtdb.firebaseio.com
- ADMIN_UIDS: the Firebase user UID (not an email), visible on the private setup page after signing in.
- TOKEN_ENCRYPTION_KEY: randomly generated, base64-encoded 32-byte key. Preserve in secure backup. Losing or changing it requires re-pairing all boxes.
- CONTROLLER_ORIGIN: https://broncos5523.github.io

## API
- GET /health — public status with no account information
- GET /api/boxes — authorized; paired statuses only
- POST /api/pair/start with {box:'Center'} — starts a 3-minute seven-digit EasyPair session
- POST /api/pair/status with {box:'Center'} — pending, paired, expired
- POST /api/send with {box:'Center',kind:'text',value:'Watch ESPN'} — sends Xfinity text command
- POST /api/send with {box:'Center',kind:'channel',value:'702'} — sends number keypresses
- POST /api/send with {box:'Center',kind:'key',value:'guide'} — remote button

## Security notes
The Firebase Realtime Database node private_services/xfinity_remote should be protected by strict database rules that allow only server/admin access. Do not inadvertently modify or break existing screens/left, screens/right, or screens/third rules. Even with AES-GCM encryption, overly broad write access could let clients delete encrypted remote pairing records.

Do not share Xfinity arTokens (JWT strings), account IDs, private keys, or secret environment values in chats, screenshots, or GitHub issues. All remote API calls are unofficial and subject to change. Xfinity HTTP acceptance is not independent proof of TV playback.

Token refresh occurs when the next command is sent after 35 minutes. Server memory pairing sessions will reset if Render sleeps, restarts, or redeploys; the stored encrypted box tokens persist.

## Test sequence
1. Deploy to a confirmed Render workspace with securely configured environment variables.
2. Visit https://broncos5523.github.io/left-right-/xfinity-pairing-v13.html and sign in to the existing Firebase account.
3. Verify the server health and list boxes.
4. Select Center and press Start EasyPair. Say Easy Pair into its Xfinity voice remote and enter the displayed seven-digit code on that TV.
5. Once paired, press Watch ESPN on the setup page. Confirm the Center box actually changes channel.
6. Only after verified success, pair the three other boxes and wire direct tune into a future Game Wall version.
