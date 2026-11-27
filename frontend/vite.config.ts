import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const requestedBuildId = String(process.env.VITE_BUILD_SHA ?? '').trim().toLowerCase();
if (requestedBuildId && !/^[a-f0-9]{40}$/.test(requestedBuildId)) {
  throw new Error('VITE_BUILD_SHA must be the exact 40-character source commit SHA');
}
const buildId = requestedBuildId || randomBytes(20).toString('hex');
const repoRoot = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), {
    name: 'build-version',
    configureServer(server) {
      server.middlewares.use('/release.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ build: buildId }));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify({ build: buildId }) });
    },
  }],
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), repoRoot] },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
