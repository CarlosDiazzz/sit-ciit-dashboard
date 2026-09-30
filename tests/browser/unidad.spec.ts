import { test, expect } from "@playwright/test";

test("unidad: una fuente, búsqueda, mapa y selección sin mezclar lecturas", async ({
  page,
}) => {
  const now = new Date().toISOString();
  const nodeA = "11111111-1111-4111-8111-111111111111";
  const nodeB = "22222222-2222-4222-8222-222222222222";
  await page.route("**/units", (route) =>
    route.fulfill({
      json: [
        {
          id: "unit",
          unitCode: "unidad-prueba",
          label: "Carga de prueba",
          activeNodeId: nodeA,
          cargoCategory: "general",
          nodes: [
            {
              id: nodeA,
              nodeCode: "nodo-A",
              role: "primary",
              isOnline: true,
              lastHeartbeatAt: now,
              batteryPct: 81,
              pendingOutbox: 0, capabilities: ["gps", "accelerometer"],
            },
            {
              id: nodeB,
              nodeCode: "nodo-B",
              role: "backup",
              isOnline: false,
              lastHeartbeatAt: now,
              batteryPct: 23,
              pendingOutbox: 12, capabilities: ["gps"],
            },
          ],
        },
      ],
    }),
  );
  await page.route("**/risk-rules", (r) => r.fulfill({ json: [] }));
  await page.route("**/node-history?*", (route) => {
    const id = new URL(route.request().url()).searchParams.get("nodeId");
    return route.fulfill({
      json: {
        items:
          id === nodeA
            ? [
                {
                  id: "sample",
                  nodeCode: "nodo-A",
                  role: "primary",
                  seq: 1,
                  ts: now,
                  receivedAt: now,
                  accelX: 0,
                  accelY: 0,
                  accelZ: 1,
                  gyroX: 0,
                  gyroY: 0,
                  gyroZ: 0,
                  gpsLat: 0,
                  gpsLon: 0,
                  gpsSpeedMs: 0,
                },
              ]
            : [],
        hasMore: false,
        nextCursor: null,
      },
    });
  });
  await page.route("**/node-history/connectivity?*", (route) => {
    const id = new URL(route.request().url()).searchParams.get("nodeId");
    return route.fulfill({
      json: {
        items:
          id === nodeA
            ? [
                {
                  id: "lost",
                  kind: "signal_lost",
                  ts: now,
                  gpsLat: 0,
                  gpsLon: 0,
                  positionTs: now,
                },
                {
                  id: "back",
                  kind: "signal_recovered",
                  ts: now,
                  gpsLat: 0.01,
                  gpsLon: 0.01,
                  positionTs: now,
                },
                {
                  id: "missing",
                  kind: "signal_lost",
                  ts: now,
                  gpsLat: null,
                  gpsLon: null,
                  positionTs: null,
                },
              ]
            : [],
        hasMore: false,
      },
    });
  });
  await page.goto("/login");
  await page
    .getByLabel("Correo", { exact: true })
    .fill("admin@browser.invalid");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión", exact: true }),
  ).toBeVisible();
  await page.goto("/unidad");
  await expect(
    page.getByRole("heading", { name: "Monitoreo de nodo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "nodo-A", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "nodo-B", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Aceleración", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Pérdidas: 2", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Recuperaciones: 1", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Sin ubicación GPS: 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".connectivity-map .leaflet-interactive"),
  ).toHaveCount(2);
  await page.locator(".connectivity-map .leaflet-interactive").first().click();
  await expect(page.locator(".leaflet-popup")).toContainText("Señal perdida");
  await page.getByLabel("Buscar nodo o unidad").fill("nodo-B");
  await page.getByLabel("Nodo seleccionado").selectOption("nodo-B");
  await expect(
    page.getByRole("heading", { name: "nodo-B", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "nodo-A", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Aceleración", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Sin interrupciones registradas en este periodo."),
  ).toBeVisible();
  await expect(
    page.getByText("Sin muestras del nodo seleccionado", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".connectivity-map")).toHaveCount(0);
});
