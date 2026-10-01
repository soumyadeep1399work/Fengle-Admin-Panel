# Fengle Admin Panel

React + TypeScript SPA (Vite) for Fengle operations: orders, restaurants
(onboarding is admin-only), riders and settlement, the shared catalog,
customers, and campaign audience export.

## Run

```
npm install
npm run dev        # http://localhost:5180/
npm run build      # outputs dist/ (served at the root of https://admin.fengle.in)
```

`VITE_API_URL` in `.env` picks the backend (see `.env.example`). It
defaults to the live server. To use a local backend, put
`VITE_API_URL=http://localhost:4000/api/v1` in `.env.local`.

## Logins

Admin accounts are created only with `fengle-backend/scripts/create-admin.js`.
There is no signup.

Local dev DB test admin (local XAMPP `food_delivery` only, never the live server):
`admin@local.test` / `choose-your-own-password`

## Backend dependency

Most screens use the `/admin/*` endpoints requested from the backend session
on 2026-09-27. Until a route is live, its screen shows a "needs a backend
endpoint" notice instead of failing.
