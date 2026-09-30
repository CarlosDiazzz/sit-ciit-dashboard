import { test, expect } from "@playwright/test";
test("gestión completa desde formularios reales, auditoría y portal por empresa", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
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
  const auth = await request.post("http://127.0.0.1:4310/auth/login", {
    data: { email: "admin@browser.invalid", password: "browser-test-password" },
  });
  const { token } = await auth.json();
  const headers = { authorization: `Bearer ${token}` };
  async function create(
    module: string,
    fields: Record<string, string>,
    selects: Record<string, string> = {},
  ) {
    await page.goto(`/gestion/${module}`);
    await page
      .getByRole("button", { name: "Nuevo registro", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Guardar", exact: true }),
    ).toBeEnabled();
    for (const [name, label] of Object.entries(selects))
      await page.getByLabel(name, { exact: true }).selectOption({ label });
    for (const [name, value] of Object.entries(fields))
      await page.getByLabel(name, { exact: true }).fill(value);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(
      page.getByText("Registro guardado.", { exact: true }),
    ).toBeVisible();
  }
  await create("companies", {
    "Código / folio": "browser-company",
    Nombre: "Empresa Navegador",
  });
  await create("monitoring-profiles", {
    "Código / folio": "browser-profile",
    Nombre: "Perfil Navegador",
    "Muestreo (ms)": "1000",
    "Umbral de impacto (g)": "2.5",
  });
  await create(
    "cargo-types",
    { "Código / folio": "browser-cargo", Nombre: "Carga Navegador" },
    { "Perfil de monitoreo": "Perfil Navegador" },
  );
  await create("locations", {
    "Código / folio": "browser-origin",
    Nombre: "Puerto Origen",
    Latitud: "16",
    Longitud: "-95",
  });
  await create(
    "locations",
    {
      "Código / folio": "browser-destination",
      Nombre: "Terminal Destino",
      Latitud: "18",
      Longitud: "-94",
    },
    { Tipo: "Terminal" },
  );
  await create(
    "routes",
    {
      "Código / folio": "browser-route",
      Nombre: "Ruta Navegador",
      "Distancia (km)": "300",
    },
    { Origen: "Puerto Origen", Destino: "Terminal Destino" },
  );
  await create(
    "route-checkpoints",
    { "Orden en el recorrido": "1" },
    { Ruta: "Ruta Navegador", Ubicación: "Puerto Origen" },
  );
  await create(
    "units",
    {
      "Código de unidad": "browser-unit",
      Nombre: "Unidad Navegador",
      "Capacidad (kg)": "1000",
    },
    { "Empresa responsable": "Empresa Navegador" },
  );
  await create(
    "containers",
    {
      "Código / folio": "browser-container",
      Nombre: "Contenedor Navegador",
      "Capacidad (kg)": "500",
    },
    { Propietario: "Empresa Navegador" },
  );
  await create(
    "users",
    {
      Correo: "operator@browser.invalid",
      "Contraseña (mínimo 8 caracteres)": "operator-password",
      Nombre: "Persona",
      Apellidos: "Operadora",
    },
    { Rol: "Operador" },
  );
  await create(
    "users",
    {
      Correo: "tech@browser.invalid",
      "Contraseña (mínimo 8 caracteres)": "technician-password",
      Nombre: "Persona",
      Apellidos: "Técnica",
      Especialidad: "Sensores",
    },
    { Rol: "Técnico" },
  );
  await create(
    "users",
    {
      Correo: "customer@browser.invalid",
      "Contraseña (mínimo 8 caracteres)": "customer-password",
      Nombre: "Persona",
      Apellidos: "Cliente",
    },
    { Rol: "Cliente", Empresa: "Empresa Navegador" },
  );
  const nodeResponse = await request.post("http://127.0.0.1:4310/nodes", {
    headers,
    data: {
      nodeCode: "browser-node",
      unitCode: "browser-unit",
      role: "primary",
    },
  });
  expect(nodeResponse.status()).toBe(201);
  await page.goto("/gestion/nodes");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Nodo Navegador");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByText("Registro guardado.", { exact: true }),
  ).toBeVisible();
  const now = new Date(Date.now() - 3600000).toISOString().slice(0, 16);
  const future = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  await create(
    "shipments",
    {
      "Código / folio": "browser-shipment",
      Nombre: "Envío Navegador",
      "Peso (kg)": "100",
    },
    {
      Cliente: "Empresa Navegador",
      "Tipo de carga": "Carga Navegador",
      Origen: "Puerto Origen",
      Destino: "Terminal Destino",
      Estado: "Listo",
    },
  );
  await create(
    "trips",
    {
      "Código / folio": "browser-trip",
      Nombre: "Viaje Navegador",
      "Salida prevista": now,
      "Llegada prevista": future,
    },
    { Ruta: "Ruta Navegador", Unidad: "Unidad Navegador · browser-unit" },
  );
  await create(
    "trip-shipments",
    {},
    {
      Viaje: "Viaje Navegador",
      Envío: "Envío Navegador",
      Contenedor: "Contenedor Navegador",
    },
  );
  await create(
    "assignments",
    { Inicio: now },
    { Persona: "Persona Operadora", Viaje: "Viaje Navegador" },
  );
  await create(
    "notification-rules",
    { "Código / folio": "browser-notify", Nombre: "Avisos Navegador" },
    { Destinatario: "Prueba Navegador" },
  );
  await create(
    "maintenance",
    {
      "Código / folio": "browser-maintenance",
      Nombre: "Revisión Navegador",
      "Fecha programada": future,
      "Trabajo requerido": "Inspección de sensores",
    },
    {
      Dispositivo: "Nodo Navegador · browser-node",
      Técnico: "Persona Técnica",
    },
  );
  await create(
    "incidents",
    {
      "Código / folio": "browser-incident",
      Nombre: "Incidente Navegador",
      Descripción: "Inspección durante prueba aislada",
    },
    {
      Unidad: "Unidad Navegador · browser-unit",
      Viaje: "Viaje Navegador",
      Responsable: "Persona Operadora",
    },
  );
  await page.getByRole("button", { name: "Detalle", exact: true }).click();
  await page
    .getByLabel("Comentario", { exact: true })
    .fill("Inspección realizada");
  await page
    .getByRole("button", { name: "Agregar comentario", exact: true })
    .click();
  await expect(
    page.getByText("Inspección realizada", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar ventana" }).click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByLabel("Estado", { exact: true })
    .selectOption({ label: "Resuelto" });
  await page
    .getByLabel("Resolución / motivo", { exact: true })
    .fill("Sin daño");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByText("Registro guardado.", { exact: true }),
  ).toBeVisible();
  await page.goto("/gestion/trips");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByLabel("Estado", { exact: true })
    .selectOption({ label: "En tránsito" });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByText("Registro guardado.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByLabel("Estado", { exact: true })
    .selectOption({ label: "Finalizado" });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByText("Registro guardado.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reporte", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Reporte: Viaje Navegador" }),
  ).toBeVisible();
  await expect(page.getByText("Sin datos", { exact: true })).toHaveCount(2);
  await page.goto("/gestion/incidents");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Archivar", exact: true }).click();
  await expect(
    page.getByText("No hay registros para estos filtros."),
  ).toBeVisible();
  await page.getByLabel("Incluir archivados").click();
  await expect(page.getByLabel("Incluir archivados")).toBeChecked();
  await expect(
    page.getByRole("cell", { name: "Archivado", exact: true }),
  ).toBeVisible();
  await page.goto("/auditoria");
  await expect(
    page.getByRole("cell", { name: "Creación", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Avisos Navegador", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await page.goto("/login");
  await page
    .getByLabel("Correo", { exact: true })
    .fill("customer@browser.invalid");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("customer-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/gestion$/);
  await page.getByRole("link", { name: /^Envíos .*Consultar registros$/ }).click();
  await expect(
    page.getByRole("cell", { name: "Envío Navegador", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nuevo registro", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
