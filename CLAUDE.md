# sit-ciit-dashboard

## Resumen

Centro de control web de SIT-CIIT: mapa en vivo del corredor Salina
Cruz–Coatzacoalcos (Línea Z), gráficas de telemetría, eventos, comandos y
bitácora. React + Vite + TypeScript, `react-leaflet` (teselas OSM),
Recharts, `socket.io-client`, React Router.

Repos hermanos: `sit-ciit-infra` (contrato, datos de la Línea Z),
`sit-ciit-backend` (API + WebSocket que consume este dashboard).

## Restricciones del proyecto (aplican a todo SIT-CIIT)

- **Prohibido simular datos.** Todo lo que se grafica viene del backend,
  que a su vez solo acepta datos reales de sensores (celulares Android) y
  de APIs públicas reales (Open-Meteo, OpenCelliD, OSM). No agregar datos
  de ejemplo hardcodeados fuera de tests.
- Nada de predicción de ETA con ML — el cálculo es simple: distancia
  restante sobre la Línea Z / velocidad promedio reciente.

## Contrato

- Fuente de verdad: `sit-ciit-infra/contracts/`. Copia local en
  `src/contract/contract.ts` (no editar ahí, correr
  `sit-ciit-infra/scripts/sync-contract.sh`).
- El dashboard consume el contrato indirectamente (vía la API/WebSocket
  del backend, no MQTT directo), pero los tipos de eventos/comandos son
  los mismos — usarlos para tipar las respuestas del backend en vez de
  redefinir tipos ad hoc.

## Vistas y qué mostrar en cada una

Ver tabla completa en `sit-ciit-infra/docs/demo-script.md`. Resumen:

- **Mapa**: trazado real de la Línea Z (GeoJSON de `sit-ciit-infra`),
  posición en vivo por unidad, capa de antenas OpenCelliD, clima Open-Meteo.
- **Unidad**: gráficas en vivo (aceleración, luz, velocidad), primary vs.
  backup, fuente activa, tamaño de cola, último heartbeat.
- **Eventos**: severidad, confirmación, marca visual de eventos tardíos
  (diferencia entre `ts` del dispositivo y `received_at` del servidor).
- **Comandos**: formulario + tabla `sent → delivered → executed/rejected`
  con tiempos.
- **Bitácora**: quién mandó qué y cuándo.
- **Login**: oculta acciones no permitidas según el rol
  (`control_center` vs. `operator`).

## Comandos útiles

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Cosas a NO hacer

- No poner un modo "demo" con datos inventados cuando el backend no
  responde — mostrar el estado vacío/error real en vez de simular datos.
- No implementar el cálculo de ETA con nada más que
  distancia/velocidad promedio — explícitamente fuera de alcance usar ML.
