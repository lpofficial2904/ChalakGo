import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Resolve relative to this module, not aaPanel/PM2's working directory.
config({ path: fileURLToPath(new URL("../.env", import.meta.url)), override: true });
