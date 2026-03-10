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
  });

  logger.info(`  Music task created: ${taskId}`);

  // Poll — music generation can take longer
  const result = await client.pollUntilDone(taskId, {
    timeoutMs: 15 * 60 * 1000,
    initialDelayMs: 5000,
  });

  if (!result?.resultJson) {
    throw new Error(`Music task ${taskId} completed but no resultJson`);
  }

  const resultData = JSON.parse(result.resultJson);
  // Suno returns an array of tracks
  let audioUrl: string | null = null;

  if (Array.isArray(resultData)) {
    audioUrl = resultData[0]?.audio_url || resultData[0]?.url;
  } else if (resultData.data && Array.isArray(resultData.data)) {
    audioUrl = resultData.data[0]?.audio_url;
  } else {
    audioUrl = resultData.audio_url || resultData.resultUrls?.[0] || resultData.url;
  }

  if (!audioUrl) {
    throw new Error(`Music task: could not find audio URL in: ${result.resultJson}`);
  }

  await client.downloadFile(audioUrl, outputFile);
  const probe = await ffprobe(outputFile);

  logger.step("MUSIC", `Generated music: ${Math.round(probe.duration)}s`);
  return { file: outputFile, duration_ms: Math.round(probe.duration * 1000) };
}
