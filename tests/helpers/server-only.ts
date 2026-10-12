// Vitest stub for Next.js's bundled "server-only" marker. Next resolves this
// package at build time; Node module resolution (used by vitest) does not, so
// tests alias it here. The marker is a no-op for unit tests.
export {}