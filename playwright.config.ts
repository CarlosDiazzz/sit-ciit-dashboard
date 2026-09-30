import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:4311",
    headless: true,
    timezoneId: "UTC",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm exec -- tsx tests/serve-management.ts",
      cwd: "../sit-ciit-backend",
      url: "http://127.0.0.1:4310/health",
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4311 --strictPort",
      url: "http://127.0.0.1:4311",
      env: {
        VITE_BACKEND_URL: "http://127.0.0.1:4310",
        VITE_SOCKET_URL: "http://127.0.0.1:4310",
      },
      reuseExistingServer: false,
    },
  ],
});
