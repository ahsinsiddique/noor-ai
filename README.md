# Quran AI Tutor — v3

A React Native (Expo) Quran-learning app with multi-provider AI, voice chat,
and sect-aware scholarly prompts. Runs on a Next.js backend with Supabase
for auth + data.

## Architecture

```
┌──────────────────────────┐       ┌──────────────────────────┐
│  Expo app                │       │  Next.js API (apps/web)  │
│  artifacts/quran-ai-tutor│◀──────│  App Router route        │
│                          │       │  handlers                │
│  - Supabase Auth direct  │       │                          │
│  - Bearer token on every │       │  - Validates Supabase    │
│    /api/* request        │       │    JWT per request       │
│                          │       │  - Calls OpenAI / xAI    │
│                          │       │  - Whisper transcription │
└──────────────────────────┘       └──────────┬───────────────┘
                                              │
                                   ┌──────────▼───────────────┐
                                   │  Supabase                │
                                   │  - auth.users            │
                                   │  - public.profiles       │
                                   │  - public.sessions       │
                                   │  - public.session_messages│
                                   │  - RLS per-user          │
                                   └──────────────────────────┘
```

- **Auth:** Supabase Auth (email/password). Mobile client uses the Supabase
  JS SDK directly — no proxy via Next.js. Session JWT is persisted in
  `AsyncStorage` on native, in-memory on web.
- **API calls:** Mobile client sends `Authorization: Bearer <supabase-jwt>`
  on every `/api/*` request. Next.js validates the JWT and does all DB
  work through a user-scoped Supabase client so Row Level Security enforces
  data isolation.
- **Streaming:** Chat uses SSE. Next.js returns a `ReadableStream`; Expo
  consumes it via `expo/fetch`.
- **Voice:** Whisper transcription runs through OpenAI regardless of chat
  provider (Grok has no STT endpoint).

## Repo layout

```
quranai/
├── apps/
│   └── web/                       Next.js 15 backend (API only)
│       ├── app/api/…              Route handlers
│       ├── lib/ai/                Provider routing + prompt builders
│       └── lib/supabase/          Server + admin clients, auth helper
├── artifacts/
│   └── quran-ai-tutor/            Expo / React Native app
│       ├── app/                   expo-router screens
│       ├── contexts/              Auth, Session, Model, Sect, Madhhab…
│       ├── services/apiClient.ts  Central fetch wrapper (Bearer injection)
│       ├── services/aiService.ts  Chat / summary / explain / transcribe
│       └── lib/supabase.ts        Supabase client for mobile
├── supabase/
│   └── migrations/
│       └── 0001_init.sql          Schema + RLS policies
└── pnpm-workspace.yaml
```

## First-time setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com/) → New project.
2. Once it's up, open **SQL Editor** and paste the entire contents of
   `supabase/migrations/0001_init.sql`. Run it. This creates `profiles`,
   `sessions`, `session_messages`, the `handle_new_user` trigger, and
   RLS policies.
3. In **Authentication → Providers**, make sure **Email** is enabled.
   For smoother local dev, turn off "Confirm email" under
   **Authentication → Sign In / Providers → Email** — otherwise every
   signup requires clicking a confirmation link. Turn it back on before
   production.
4. From **Project Settings → API**, copy three values:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` *(never expose to client)*

### 2. Backend (`apps/web/`)

```bash
cd apps/web
cp .env.example .env
# Fill in:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   OPENAI_API_KEY
#   XAI_API_KEY          # optional; only needed if users pick Grok
pnpm install
pnpm dev                  # listens on http://localhost:3000
```

Sanity-check: `curl http://localhost:3000/api/health` → `{ ok: true, … }`.

### 3. Mobile app (`artifacts/quran-ai-tutor/`)

```bash
cd artifacts/quran-ai-tutor
cp .env.example .env
# Fill in:
#   EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000   (for local dev)
#   EXPO_PUBLIC_SUPABASE_URL=https://…supabase.co
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
pnpm install
pnpm start               # Expo dev server; scan QR with Expo Go
```

**Important:** for local dev, `EXPO_PUBLIC_API_URL` needs to be your
machine's LAN IP (`ipconfig getifaddr en0` on macOS), not `localhost` —
`localhost` inside the iOS simulator works, but on a physical device
in Expo Go it resolves to the device itself. A LAN IP works everywhere.

## Endpoint inventory

All `/api/*` routes live in `apps/web/app/api/` and return JSON (chat is SSE).

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/health` | GET | – | liveness ping |
| `/api/profile` | GET, PATCH | ✓ | read/update the signed-in user's profile |
| `/api/quran/chat` | POST | ✓ | SSE streaming chat (lesson or guardian mode) |
| `/api/quran/transcribe` | POST | ✓ | multipart audio → text (Whisper) |
| `/api/quran/surahs` | GET | – | list of 114 surahs (cached 24h) |
| `/api/quran/ayah/:surah/:number` | GET | – | single ayah + translation |
| `/api/quran/summarize` | POST | ✓ | session summary (non-streaming) |
| `/api/quran/explain` | POST | ✓ | quiz answer explanation |
| `/api/sessions` | GET, POST | ✓ | list / create study sessions |
| `/api/sessions/:id` | PATCH | ✓ | update summary/score |
| `/api/sessions/:id/messages` | GET, POST | ✓ | list / append messages |

Signup/login happen client-side via the Supabase SDK; they are **not**
routes on this backend.

## Deploy

### Backend

Vercel is the path of least resistance (Next.js is their native runtime):

```bash
cd apps/web
vercel
```

Add the env vars in the Vercel dashboard (**Settings → Environment
Variables**). For `OPENAI_API_KEY`, `XAI_API_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`, pick the "Sensitive" option so they're
encrypted at rest.

Any Node.js host works too — the route handlers use `runtime = "nodejs"`
and have no Vercel-specific dependencies. Streaming requires the host to
support `ReadableStream` response bodies; Render, Fly, and Railway all do.

### Mobile

Standard Expo EAS build:

```bash
cd artifacts/quran-ai-tutor
pnpm dlx eas-cli build --platform all
```

Make sure the production `EXPO_PUBLIC_API_URL` points at the deployed
Next.js URL (not the LAN dev server).

## What changed vs. the previous backend

The original Replit + Express + Drizzle stack was removed entirely. In
particular:

- `artifacts/api-server/` (Express) → replaced by `apps/web/` (Next.js).
- `lib/db/` (Drizzle) → replaced by direct Supabase queries with RLS.
- `lib/integrations-openai-ai-server/` → replaced by the plain `openai`
  SDK inside `apps/web/lib/ai/providers.ts`.
- `lib/api-client-react/` → replaced by the much smaller
  `artifacts/quran-ai-tutor/services/apiClient.ts`.
- JWT auth via `bcryptjs` + custom middleware → replaced by Supabase Auth.
- User IDs migrated from `int` to `uuid` everywhere.

## Known caveats

- **Email confirmation off by default.** I mentioned this in setup, but
  worth calling out: if you enable email confirmation in Supabase, new
  users can't sign in until they click the verification link. The app's
  `signup()` surfaces a clear error in that case, but the UX is still
  worse than a seamless first login. Decide consciously before enabling
  in production.
- **Whisper depends on OpenAI.** A user who picks Grok still hits OpenAI
  for voice transcription. If that's a dealbreaker, swap in a different
  STT provider inside `apps/web/app/api/quran/transcribe/route.ts`.
- **No refresh token rotation handled in the mobile client.** Supabase's
  SDK auto-refreshes the JWT in the background (`autoRefreshToken: true`),
  and `apiFetch()` re-reads the token before every request, so in practice
  this is invisible. But if you see 401s after a long idle, that's the
  first thing to check.
- **Sect prompts are a sensitive area.** They're respectful and
  safety-railed (no fatwas, defer to human scholars), but get a scholar
  from each tradition to review `apps/web/lib/ai/prompts.ts` before
  shipping to real users.
