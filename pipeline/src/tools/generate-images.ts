/**
 * One-off script to generate replacement images for scenes that trigger Veo safety filters.
 * Uses Kie.ai's nano-banana-2 model via the generic createTask/pollUntilDone pattern.
 *
 * Usage: npx tsx src/tools/generate-images.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { KieClient } from "../api/kie-client.ts";
import { logger } from "../core/logger.ts";

loadEnv({ path: resolve(import.meta.dirname, "../../../.env") });
loadEnv();

const apiKey = process.env.KIE_API_KEY;
if (!apiKey) throw new Error("KIE_API_KEY not set");

const client = new KieClient(apiKey);

const IMAGES_TO_GENERATE = [
  {
    name: "smart_classroom_safe",
    prompt:
      "A modern smart classroom interior with digital smartboards, empty desks and chairs arranged neatly, bright natural lighting through large windows, potted plants, no people visible. Clean professional educational environment in India. Photorealistic, 4K quality.",
    outputPath: resolve(import.meta.dirname, "../../../attached_assets/smart_classroom_safe.png"),
  },
  {
    name: "root_square_supplies",
    prompt:
      "A bright organized supply distribution center with neat rows of school uniforms on display racks, stationery items on labeled shelves, cardboard boxes being sorted on conveyor belt. Professional warehouse lighting, no people visible. Clean logistics environment. Photorealistic, 4K quality.",
    outputPath: resolve(import.meta.dirname, "../../../attached_assets/root_square_supplies.png"),
  },
  {
    name: "ai_learning_platform",
    prompt:
      "A futuristic AI technology lab with multiple laptop screens showing neural network visualizations and code, a large wall-mounted display showing an AI learning platform dashboard, blue ambient LED lighting, modern furniture. No people visible. Clean tech environment. Photorealistic, 4K quality.",
    outputPath: resolve(import.meta.dirname, "../../../attached_assets/ai_learning_platform.png"),
  },
];

async function main() {
  for (const img of IMAGES_TO_GENERATE) {
    logger.step("IMAGE", `Generating: ${img.name}`);

    const taskId = await client.createTask({
      model: "nano-banana-2",
      input: {
        prompt: img.prompt,
        aspect_ratio: "16:9",
        resolution: "2K",
        output_format: "png",
      },
    });

    logger.info(`  Task: ${taskId}`);

    const result = await client.pollUntilDone(taskId, {
      timeoutMs: 5 * 60 * 1000,
      initialDelayMs: 5000,
    });

    if (!result?.resultJson) {
      logger.error(`  No resultJson for ${img.name}`);
      continue;
    }

    const data = JSON.parse(result.resultJson);
    // nano-banana-2 returns URLs in various possible fields
    const imageUrl =
      data.images?.[0]?.url ||
      data.resultUrls?.[0] ||
      data.output?.url ||
      data.url ||
      (typeof data === "string" ? data : null);

    if (!imageUrl) {
      logger.error(`  No image URL found in result: ${result.resultJson}`);
      continue;
    }

    logger.info(`  Downloading: ${imageUrl}`);
    await client.downloadFile(imageUrl, img.outputPath);
    logger.step("IMAGE", `Saved: ${img.outputPath}`);
  }

  logger.step("DONE", "All replacement images generated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
