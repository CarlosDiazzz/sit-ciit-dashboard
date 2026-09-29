# sit-ciit-dashboard

Centro de control web de **SIT-CIIT**. React + Vite + TypeScript,
react-leaflet (mapa), Recharts (gráficas), Socket.IO (tiempo real).

Requiere `sit-ciit-backend` corriendo.

## Setup

```bash
npm install
cp .env.example .env   # ajustar VITE_BACKEND_URL / VITE_SOCKET_URL
npm run dev
```

## Vistas (`src/pages/`)

- **Mapa** — trazado real de la Línea Z, posición en vivo, antenas
  OpenCelliD, clima Open-Meteo.
- **Unidad** — gráficas en vivo, estado primary/backup, fuente activa.
- **Eventos** — historial con severidad y marca de eventos tardíos.
- **Comandos** — envío de comandos y tabla de estados.
- **Bitácora** — auditoría de comandos.
- **Login** — autenticación contra el backend, oculta acciones según rol.

Todas son placeholders en esta fase (Fase 0 — andamiaje); se implementan
en las fases siguientes (ver `CLAUDE.md`).

## Contrato

`src/contract/contract.ts` es una copia sincronizada desde
`sit-ciit-infra/contracts/contract.ts`. No editar aquí directamente — ver
`sit-ciit-infra/scripts/sync-contract.sh`.
