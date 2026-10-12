# Weather Now

Weather Now is a local weather and heat-risk dashboard. Visitors sign in with their **email or mobile number** using a one-time code, then see live node monitoring, a city heatmap, forecasts and heat-risk alerts (generated demo data).

## Project layout

| Folder | What it is |
| --- | --- |
| `frontend/web-app` | Website (React 19, Vite 7, Tailwind 4) on `http://localhost:5173` |
| `backend/api-server` | API (Express 5) on `http://localhost:8080` |
| `shared/lib` | API schemas and the generated React client |

## Run on Windows (VS Code terminal)

Needs Node.js 22 or 24 and pnpm 10.16+ (`npm install -g pnpm`).

```powershell
pnpm install
pnpm dev
```

The dev launcher automatically picks free ports when 5173/8080 are already taken, and it updates the frontend proxy to match. Open the local URL shown in the terminal (for example, `http://localhost:5173`). Stop with `Ctrl+C`. Or double-click `start.bat`.

No `.env` file is needed to run locally.

Two terminals instead: `pnpm dev:api` and `pnpm dev:web`. Health check: `http://localhost:8080/api/healthz` (or the selected free API port if something else is already listening).

## Sign-in

1. Choose **Email** or **Mobile**, type it in, press **Send code**.
2. Type the 6-digit code (valid 5 minutes, 5 tries, one new code every 30 seconds).
3. First time with an email or number creates the account; the same email or number always returns to the same account.

**Demo mode (default locally).** With no email or SMS service connected, nothing is actually sent. The code appears on the login page and in the API terminal so you can test everything offline.

**Real emails and texts.** Copy `backend/api-server/.env.example` to `backend/api-server/.env` and fill in:

- Email: `RESEND_API_KEY` and `EMAIL_FROM` ([Resend](https://resend.com))
- SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` ([Twilio](https://twilio.com))

Restart `pnpm dev` afterwards. `.env` is never committed or shipped in the zip; keep your own copy. When deploying for real, set `NODE_ENV=production` and a long `AUTH_SECRET`; production never falls back to demo mode and serves cookies over HTTPS only.

Accounts are stored in `backend/api-server/data/users.json` (git-ignored). Sessions last 7 days in a secure `httpOnly` cookie, and codes are stored only as hashes in memory.

All dashboard API routes need a signed-in user. Open routes: `/api/healthz`, `/api/auth/*`, and `POST /api/sensor-data` (so sensor devices can post readings).

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/request-otp` | Send a code to an email or mobile number |
| POST | `/api/auth/verify-otp` | Check the code and sign in |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Sign out |

## Live weather (real data)

The dashboard now shows **real weather** for every monitored location from [Open-Meteo](https://open-meteo.com) (no key needed). The server refreshes it every 15 minutes and the header shows **LIVE DATA** instead of **DEMO MODE**.

- Measured by the weather model: air temperature, humidity, wind, sunshine.
- **Estimated by the app:** radiant temperature, WBGT and heat index (calculated from the measured values), and the 60-minute outlook (interpolated from the hourly forecast).
- Real sensor readings posted to `POST /api/sensor-data` still win: a node that receives device data keeps using it.
- If Open-Meteo cannot be reached, the last values stay on screen. To go back to generated demo values set `LIVE_WEATHER=off`.
- Open-Meteo's free service is for non-commercial use; check their terms before a commercial launch.
- Risk levels only have MODERATE, HIGH and EXTREME, so a cool day still shows MODERATE.
- The "Run heatwave demo" and network-failure buttons are hidden in live mode. Worker actions (fan, rest break) are still simulated.

## Explore (any place, any day)

Open **Explore** in the menu. Search a city, area or landmark, or press **Use my location** (your browser asks permission; this needs HTTPS or localhost). Then pick a date and an hour.

- Dates: any day from 1940 up to 15 days ahead. Recent days and the future come from Open-Meteo's forecast service; older days come from its historical archive.
- Shows temperature, feels-like, humidity, wind, rain, sunshine, and estimated WBGT and heat index for every hour.
- Needs the signed-in session like the rest of the dashboard. API routes: `GET /api/places/search?q=` and `GET /api/explore?lat=&lon=&date=YYYY-MM-DD`.
- Results are cached on the server (10 minutes for recent/future days, 6 hours for older days).

## Switching from demo to real mode

1. Copy `backend/api-server/.env.example` to `backend/api-server/.env` (skip if you already did), then paste your keys:
   - SMS codes: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (for example `+15551234567`)
   - Email codes: `RESEND_API_KEY`, `EMAIL_FROM`
   No quotes, no spaces around `=`. Keep this file private.
2. Stop the server (`Ctrl+C`) and run `pnpm dev` again. The "Demo mode" box on the login page disappears once a service is connected. You can connect only email, only SMS, or both; a channel without keys still uses demo mode.
3. Real sensor readings: devices post to `POST /api/sensor-data` (see the API reference page in the site). The `nodeId` must match an existing node. Nodes that receive a reading switch from `DEMO` to `EDGE_DEVICE`.
4. Going live on the internet: set `NODE_ENV=production` and `AUTH_SECRET` (32+ random characters), serve the site over HTTPS, and use a host that keeps files on disk between restarts (accounts are stored in `backend/api-server/data/users.json`). Production never falls back to demo codes.

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | API and website together |
| `pnpm typecheck` | TypeScript check |
| `pnpm build` | Typecheck, then build both |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate the API client after editing `openapi.yaml` |

## Troubleshooting

- **`pnpm` not recognized:** install Node.js, run `npm install -g pnpm`, reopen the terminal.
- **"Running scripts is disabled" in PowerShell:** run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.
- **Login says it could not reach the server:** the API is not running. Start `pnpm dev:api`.
- **Port in use (5173 or 8080):** the website uses `WEB_PORT` (default 5173) and the API uses `PORT` (default 8080). If you move the API, tell the website where it went with `API_PORT`. Example: `$env:PORT=8090; $env:API_PORT=8090; $env:WEB_PORT=5180; pnpm dev`, then open `http://localhost:5180`.
- **Node version error:** run `node -v`. It must be 20.19 or newer (22 or 24 recommended).
- **Signed out after every restart:** that only happens if `data/` is deleted.


## Places in India

The dashboard, heatmap and node list cover the 8 original sites plus every state and union territory capital and other large cities (about 65 places, see `backend/api-server/src/lib/india-places.ts`; add a line there to add more). The **Explore** page searches any town, village, area or PIN code in India (tick *Search outside India too* for the rest of the world).
