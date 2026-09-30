import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("historial: nodo, fechas, valores ausentes, gráficas, páginas y CSV", async ({
  page,
}) => {
  const id = "11111111-1111-4111-8111-111111111111";
  const now = new Date();
  const captured = new Date(now.getTime() - 60000).toISOString();
  const row = {
    id: "22222222-2222-4222-8222-222222222222",
    nodeCode: "nodo-historial",
    role: "primary",
    seq: 7,
    ts: captured,
    receivedAt: now.toISOString(),
    accelX: 0,
    accelY: null,
    accelZ: 1,
    gyroX: null,
    gyroY: null,
    gyroZ: null,
    magX: null,
    magY: null,
    magZ: null,
    lux: 0,
    pressureHpa: null,
    gpsLat: 0,
    gpsLon: 0,
    gpsSpeedMs: 0,
    gpsAccuracyM: 0,
  };
  await page.route("**/node-history/nodes", (route) =>
    route.fulfill({
      json: [
        {
          id,
          nodeCode: "nodo-historial",
          label: "Nodo",
          unitCode: "unidad-historial",
          unitLabel: "Unidad",
          role: "primary",
          active: false,
        },
      ],
    }),
  );
  await page.route("**/node-history?*", (route) => {
    const q = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: {
        items: q.has("cursor")
          ? [
              {
                ...row,
                id: "33333333-3333-4333-8333-333333333333",
                seq: 6,
                accelX: null,
                accelY: null,
                accelZ: null,
              },
            ]
          : [row],
        hasMore: !q.has("cursor"),
        nextCursor: q.has("cursor") ? null : "test-cursor",
        snapshot: now.toISOString(),
        limit: 100,
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
  await page
    .getByRole("link", {
      name: /^Historial de nodos/,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Historial de nodos" }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: /nodo-historial.*Archivado/ }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Consultar historial", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Historial de Acelerómetro" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "0 / — / 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Recepción tardía", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Variable", { exact: true }).selectOption("gyro");
  await expect(
    page.getByText(
      "No se registró esta variable en las lecturas de la página.",
    ),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar página CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("historial-nodo-historial.csv");
  const content = await readFile((await download.path())!, "utf8");
  expect(content).toContain('"0","","1"');
  expect(content).toContain('"nodo-historial"');
  await page.getByRole("button", { name: "Más antiguas" }).click();
  await expect(page.getByText("Página 2", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "6", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Más antiguas" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Más recientes" }).click();
  await expect(page.getByText("Página 1", { exact: true })).toBeVisible();
  await page.getByLabel("Desde", { exact: true }).fill("2026-01-01T00:00");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-03-01T00:00");
  await page.getByRole("button", { name: "Consultar historial" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Consulta periodos de hasta 31 días.",
  );
});
