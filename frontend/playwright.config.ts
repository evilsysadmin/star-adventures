import { defineConfig, devices } from '@playwright/test';
import {legacyDiagnosticsStorageState} from './tests/fixtures/browserStartProfiles';

export default defineConfig({
  testDir: './tests',
  // Browser tests are .spec.ts; .test.mjs files use Node's independent runner.
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // Most browser specs exercise an explicitly selected diagnostics view.
    // Product default remains the playable mission for an unconfigured player.
    storageState: legacyDiagnosticsStorageState,
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : undefined,
  },
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  reporter: [['list']],
});
