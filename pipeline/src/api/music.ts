import { mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { KieClient } from "./kie-client.ts";
import { ffprobe } from "../media/ffmpeg.ts";
import { logger } from "../core/logger.ts";
import type { MusicConfig, MusicResult } from "../types.ts";

export async function generateMusic(
  client: KieClient,
  musicConfig: MusicConfig,
  totalDurationMs: number,
  outputDir: string
): Promise<MusicResult> {
  const musicDir = join(outputDir, "audio", "music");
  mkdirSync(musicDir, { recursive: true });
  const outputFile = join(musicDir, "background.mp3");

  // If using a local file, just copy it
  if (musicConfig.provider === "local" && musicConfig.local_file) {
    logger.step("MUSIC", "Using local music file");
    const src = resolve(musicConfig.local_file);
    copyFileSync(src, outputFile);
    const probe = await ffprobe(outputFile);
    return { file: outputFile, duration_ms: Math.round(probe.duration * 1000) };
  }

  logger.step("MUSIC", "Generating background music via Suno");

  const totalSec = Math.ceil(totalDurationMs / 1000);
  const prompt = musicConfig.style
    ? `${musicConfig.style}, ${totalSec} seconds long`
    : `Corporate upbeat inspirational background music, ${totalSec} seconds long`;

  const taskId = await client.generateMusic({
    prompt,
    customMode: true,
    instrumental: musicConfig.mode === "instrumental",
    model: musicConfig.version || "V4",
    style: musicConfig.style || "Corporate Inspirational Upbeat",
    title: musicConfig.title || "Background Music",
    negativeTags: musicConfig.negative_tags || "Heavy Metal, Harsh, Aggressive",
    callBackUrl: "https://example.com/noop",
  });

  logger.info(`  Music task created: ${taskId}`);

  // Poll using Suno-specific endpoint
  const result = await client.pollMusicUntilDone(taskId, {
    timeoutMs: 15 * 60 * 1000,
    initialDelayMs: 5000,
  });

  logger.info(`  Music ready: "${result.title}" (${Math.round(result.duration)}s)`);

  await client.downloadFile(result.audioUrl, outputFile);
  const probe = await ffprobe(outputFile);

  logger.step("MUSIC", `Generated music: ${Math.round(probe.duration)}s`);
  return { file: outputFile, duration_ms: Math.round(probe.duration * 1000) };
}
