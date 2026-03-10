import { mkdirSync, statSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ffmpegMux, ffprobe } from "./ffmpeg.ts";
import { logger } from "../core/logger.ts";
import type { OutputConfig } from "../types.ts";

export interface ComposedVideoResult {
  file: string;
  duration_ms: number;
  file_size_mb: number;
}

export async function composeVideo(
  videoFile: string,
  audioFile: string,
  outputDir: string,
  outputConfig: OutputConfig,
  projectSlug: string
): Promise<ComposedVideoResult> {
  const outDir = outputDir;
  mkdirSync(outDir, { recursive: true });

  const outputFile = join(outDir, `${projectSlug}.mp4`);

  logger.step("COMPOSE", "Muxing video + audio into final MP4");
  logger.info(`  Video: ${videoFile}`);
  logger.info(`  Audio: ${audioFile}`);

  await ffmpegMux(videoFile, audioFile, outputFile, {
    crf: outputConfig.crf,
    codec: outputConfig.codec,
  });

  // Verify output
  const probe = await ffprobe(outputFile);
  const stats = statSync(outputFile);
  const fileSizeMb = stats.size / (1024 * 1024);

  logger.step("COMPOSE", `Final video: ${outputFile}`);
  logger.info(`  Duration: ${probe.duration.toFixed(1)}s`);
  logger.info(`  Resolution: ${probe.width}x${probe.height}`);
  logger.info(`  File size: ${fileSizeMb.toFixed(1)} MB`);

  // Check file size constraint
  if (outputConfig.max_file_size_mb && fileSizeMb > outputConfig.max_file_size_mb) {
    logger.warn(
      `File size ${fileSizeMb.toFixed(1)}MB exceeds ${outputConfig.max_file_size_mb}MB limit. ` +
      `Consider increasing CRF or reducing resolution.`
    );
  }

  return {
    file: outputFile,
    duration_ms: Math.round(probe.duration * 1000),
    file_size_mb: Math.round(fileSizeMb * 10) / 10,
  };
}

/**
 * For projects that already have a rendered video (e.g. screen capture),
 * just use that directly as the video source.
 */
export async function useLocalVideo(
  localPath: string,
  outputDir: string
): Promise<{ file: string; duration_ms: number }> {
  const absPath = resolve(localPath);
  const destDir = join(outputDir, "video", "raw");
  mkdirSync(destDir, { recursive: true });

  const destFile = join(destDir, "source.mp4");
  copyFileSync(absPath, destFile);

  const probe = await ffprobe(destFile);
  logger.info(`  Local video: ${probe.duration.toFixed(1)}s, ${probe.width}x${probe.height}`);

  return { file: destFile, duration_ms: Math.round(probe.duration * 1000) };
}
