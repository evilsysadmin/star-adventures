import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const buildId = randomUUID();
const repoRoot = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), {
    name: 'build-version',
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ version: buildId }));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: buildId }) });
    },
  }],
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), repoRoot] },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
