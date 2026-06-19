# SerVentas CRM — Frontend

Plataforma comercial multi-área para Serfunorte Los Olivos (Cúcuta).
Reemplaza el manejo en Excel; centraliza Prenecesidad, Previsión Empresariales (B2B), PAP (puerta a puerta) y Servicio al Cliente.

## Stack

- Vue 3 + Composition API + `<script setup>`
- Vite 7
- Pinia 3
- Vue Router (history mode, base `/crm/`)
- Axios con interceptores (refresh token automático)
- Tailwind 3 + `@tailwindcss/forms` (paleta SerVentas custom)
- Fuentes DM Serif Display + DM Sans

## Backend

Consume `http://localhost:3020/api/sv` (módulo `mantix-backend/src/sv/`).
Para producción ver `vite.config.js` y `.env.production` con `VITE_API_URL`.

## Scripts

```bash
npm install
npm run dev       # http://localhost:5174/crm/
npm run build     # genera dist/
npm run preview
```

## Credenciales iniciales (seed Fase 0)

- `admin@serfunorte.com` / `serventas2026` — Super Admin
- `admin.prenec@serfunorte.com` / `serventas2026` — Admin Prenecesidad
- `carmen.contreras@serfunorte.com` / `serventas2026` — Asesora Prenecesidad
- ... ver `mantix-backend/src/sv/migrations/999_seed.sql`
