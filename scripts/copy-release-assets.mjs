import { cp, mkdir } from "node:fs/promises";

await mkdir("dist/evidence", { recursive: true });
await cp("evidence/fourth-app-integration.json", "dist/evidence/fourth-app-integration.json");
