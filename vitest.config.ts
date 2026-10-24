import { defineConfig } from "vitest/config";
import path from "node:path";

// Test setup for Quiet Hours.
//
// Tests live next to the code they test, named *.test.ts.
// Run them with `npm test`, or everything at once with `npm run verify`.
//
// The Supabase values below are placeholders so modules that import the
// Supabase client can load. Tests never talk to a real database.
// Run every test in US Eastern time, where Caroline and many users live.
// Date bugs that only show up in the evening (when local and UTC dates
// differ) can't hide behind a server's UTC clock this way.
// (Set TZ yourself to run them somewhere else, e.g. TZ=Australia/Sydney.)
process.env.TZ ??= "America/New_York";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    include: ["client/src/**/*.test.ts", "client/src/**/*.test.tsx"],
    environment: "node",
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-placeholder-key",
    },
  },
});
