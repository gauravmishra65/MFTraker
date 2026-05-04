# MF & Share Tracker

A full-stack Indian Share Market & Mutual Fund tracker with portfolio management, watchlists, real-time prices, and stock/fund analysis.

## Tech stack

**Frontend**
- React 18 + TypeScript (Vite)
- Tailwind CSS
- React Router v6, TanStack Query, Zustand, React Hook Form, Zod
- Recharts for charts

**Backend**
- Node.js + Express + TypeScript
- PostgreSQL with Prisma ORM
- Redis (cache + rate-limit + price pub/sub)
- JWT auth, bcrypt, helmet, express-rate-limit
- WebSocket for live prices
- Yahoo Finance via `yahoo-finance2` (no API key required)

**DevOps**
- Docker Compose (Postgres, Redis, server, client)

## Project structure

```
.
├── client/                  # React + Vite frontend
├── server/                  # Express + Prisma backend
├── docker-compose.yml
├── .env.example
└── package.json             # npm workspaces
```

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

- Client: http://localhost:5173
- API:    http://localhost:4000
- Postgres: localhost:5432 (postgres/postgres)
- Redis:    localhost:6379

## Quick start (local, no Docker)

Prereqs: Node 20+, Postgres 15+, Redis 7+.

```bash
# install everything
npm install

# server
cp .env.example server/.env
cd server
npx prisma migrate dev --name init
npm run seed
npm run dev   # http://localhost:4000

# client (new terminal)
cd client
cp .env.example .env
npm run dev   # http://localhost:5173
```

## Test login

After seeding, log in with:
- Email: `demo@tracker.in`
- Password: `Demo@1234`

Or register a new account from `/register`.

## Environment variables

See `.env.example`. Key vars:

| Var | Description | Default |
|---|---|---|
| `DATABASE_URL` | Postgres connection | `postgresql://postgres:postgres@localhost:5432/tracker` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | (set in .env) |
| `JWT_EXPIRES_IN` | Token TTL | `24h` |
| `MARKET_PROVIDER` | `yahoo` \| `alphavantage` \| `twelvedata` | `yahoo` |
| `ALPHA_VANTAGE_KEY` | Optional | — |
| `TWELVE_DATA_KEY` | Optional | — |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth | — |
| `SMTP_*` | Email OTP & alerts | — |

## API

- Health: `GET /api/health`
- Auth: `POST /api/auth/register`, `/login`, `/forgot-password`, `/reset-password`, `/google`
- Stocks: `GET /api/stocks/search?q=`, `/quote/:symbol`, `/history/:symbol`, `/screener`
- MF: `GET /api/mf/search`, `/:id`, `/compare`
- Portfolio: `GET /api/portfolio`, `POST /api/portfolio/transactions`, `GET /api/portfolio/export.csv`, `GET /api/portfolio/report.pdf`
- Watchlist: full CRUD on `/api/watchlists`
- Alerts: `/api/alerts`
- Market: `GET /api/market/indices`, `/movers`, `/status`
- WebSocket: `ws://localhost:4000/ws` (subscribe to symbols, receive ticks)

Full reference at `/api/docs` (Swagger UI) when server is running.

## Database

Prisma schema lives at `server/prisma/schema.prisma`. Tables include:

- `User`, `WatchList`, `WatchListItem`
- `PortfolioTransaction`, `PortfolioHolding`, `Dividend`
- `Alert`, `SearchHistory`
- `Stock`, `MutualFund` (master data, seeded)

Migrate & seed:

```bash
cd server
npx prisma migrate dev --name init
npm run seed
```

After pulling future schema changes, run `npx prisma migrate dev` again to apply new columns (e.g., the investor profile fields on the User model).

Seed loads 20+ Indian stocks and 10+ mutual funds.

## Security

- All `/api/*` routes (except `/api/auth/*` and `/api/health`) require a JWT bearer token.
- Passwords: bcrypt (cost 12), strength validation (8+ chars, upper, number, special).
- Login: rate-limited at 5 attempts / 15 min per IP+email.
- Helmet for security headers; CORS limited to `CLIENT_URL`.
- Input validation with Zod on every route.

## Deployment

- **Backend**: Railway / Render / Fly.io / DigitalOcean App Platform.
- **Frontend**: Vercel / Netlify (set `VITE_API_URL` to your API origin).
- Use managed Postgres + Redis (Railway, Upstash, etc.).

## Pages

`/login`, `/register`, `/forgot-password` — auth.
`/` — dashboard (summary cards, indices, watchlist, recent tx, movers).
`/portfolio` — holdings table, sector pie, add transaction, CSV/PDF export.
`/watchlist` — multiple watchlists, live WS prices.
`/screener` — sector + cap + price filters.
`/stocks/:symbol` — quote, chart with timeframes/SMA, key metrics, shareholding pattern, peers.
`/mf/:id` — fund detail, returns chart, sector pie, top holdings, SIP calculator.
`/mf/compare` — compare up to 3 funds.
`/alerts` — manage price alerts.
`/learn` — glossary + Indian tax rules summary.
`/profile` — update name, phone.

## What's stubbed vs. implemented

Implemented end-to-end: auth (email + JWT), stock & MF search/detail, portfolio CRUD with P&L, multiple watchlists with alerts, indices banner, top movers, stock chart with timeframes, holdings PDF/CSV export, shareholding pattern chart, education page, dark/light theme, mobile drawer nav, WebSocket price stream, Redis cache, Swagger docs, seed data, Jest smoke tests.

Stubbed (interface ready, integration TBD): Google OAuth (set CLIENT_ID/SECRET in `.env`), email OTP delivery (wired via nodemailer — set SMTP_* to enable, otherwise OTPs are logged in dev), 2FA TOTP, push notifications, admin panel, news feed, IPO listings, corporate actions calendar, real shareholding feed (current numbers are deterministic-but-synthetic per symbol).

## License

MIT
