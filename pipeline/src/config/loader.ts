import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { projectConfigSchema, type ValidatedConfig } from "./schema.ts";

export function loadConfig(configPath: string): ValidatedConfig {
  const absolutePath = resolve(configPath);
  const raw = readFileSync(absolutePath, "utf-8");

  let parsed: unknown;
  if (absolutePath.endsWith(".json")) {
    parsed = JSON.parse(raw);
  } else {
    parsed = parseYaml(raw);
  }

  const result = projectConfigSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Config validation failed:\n${errors}`);
  }

  return result.data;
}
