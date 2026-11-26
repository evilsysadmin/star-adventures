// Browser-only starting profiles; never import these into product code.
// Select explicitly with test.use({storageState: ...}) at file/describe scope.
// A fresh player begins at captain-controls; existing diagnostics expose
// the legacy explore-right/forward/use controls. Assert the expected entry
// point before attempting deployment, rather than retrying the wrong flow.
export const freshCaptainStorageState = () => ({cookies:[],origins:[]});

// Relative to the frontend working directory, as in playwright.config.ts.
export const legacyDiagnosticsStorageState = './tests/tactical-existing.storageState.json';
