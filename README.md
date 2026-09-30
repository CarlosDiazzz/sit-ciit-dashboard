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

**Unidad** ya tiene gráfica en vivo (Recharts + Socket.IO): aceleración
x/y/z y magnitud, filtro por `unitId`, vista de tabla alternativa, estado
de conexión del socket y último heartbeat por nodo de la unidad. Las
demás vistas siguen siendo placeholders — se implementan en las fases
siguientes (ver `CLAUDE.md`).

## Contrato

`src/contract/contract.ts` es una copia sincronizada desde
`sit-ciit-infra/contracts/contract.ts`. No editar aquí directamente — ver
`sit-ciit-infra/scripts/sync-contract.sh`.

## Historial por nodo

La vista **Historial de nodos** (`/historial-nodos`) consulta lecturas persistidas
por dispositivo, incluyendo nodos archivados. Filtra por fechas locales (hasta
31 días por consulta), muestra gráficas por variable, tabla paginada y descarga
CSV de la página visible. Las horas de captura y recepción se muestran por
separado; valores ausentes se conservan como tales. También se accede desde el
botón Historial de cada nodo. El backend exige los permisos de unidad vigentes.

Prueba específica de interfaz: `npm run test:ui -- tests/browser/history.spec.ts`.
