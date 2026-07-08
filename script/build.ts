import { build as viteBuild } from "vite";
import { rm } from "node:fs/promises";

// Client-only build. Data lives in Supabase; there's no Node server to bundle.
async function buildAll() {
  await rm("dist", { recursive: true, force: true });
  console.log("building client...");
  await viteBuild();
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
