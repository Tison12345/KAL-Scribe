import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infrastructure/database/schema/*.schema.ts",
  out: "./src/infrastructure/database/migrations",
});
