import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { KieClient } from "./kie-client.ts";
import { ffprobe, ffmpegConcat } from "../media/ffmpeg.ts";
import { logger } from "../core/logger.ts";
import type { SceneConfig, VisualConfig, VideoResult } from "../types.ts";

interface VideoClip {
  sceneId: string;
  file: string;
  duration_ms: number;
}

/**
 * Upload a local image to a temporary hosting service or encode as data URI.
 * For Kie.ai, images must be publicly accessible URLs.
 * This function returns the image path — in production you'd upload to S3/Cloudinary.
 */
async function resolveImageUrl(imagePath: string): Promise<string> {
  const absPath = resolve(imagePath);
  if (!existsSync(absPath)) {
    throw new Error(`Image not found: ${absPath}`);
  }

  // If it's already a URL, return as-is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // For local files, we need to host them temporarily.
  // Option 1: Use a file upload service (imgbb, cloudinary, etc.)
  // Option 2: Base64 encode (not supported by all APIs)
  // For now, log a warning — user should provide hosted URLs or set up a local server
  logger.warn(
    `Local image: ${imagePath} — Kie.ai requires public URLs. ` +
    `Start a local server or upload to a hosting service.`
  );

  return imagePath;
}

export async function generateVideoClips(
  client: KieClient,
  visualConfig: VisualConfig,
  scenes: SceneConfig[],
  sceneDurations: Record<string, number>,
  outputDir: string
): Promise<VideoResult> {
  const videoDir = join(outputDir, "video", "clips");
  const rawDir = join(outputDir, "video", "raw");
  mkdirSync(videoDir, { recursive: true });
  mkdirSync(rawDir, { recursive: true });

  const provider = visualConfig.ai_generate?.provider || "veo";
  const aspectRatio = visualConfig.ai_generate?.aspect_ratio || "16:9";

  logger.step("VIDEO", `Generating video clips via ${provider} (image-to-video)`);

  // Collect all scenes/segments that need video generation
  const videoJobs: Array<{
    id: string;
    prompt: string;
    image?: string;
    durationHint: number;
  }> = [];

  for (const scene of scenes) {
    if (scene.segments && scene.segments.length > 0) {
      for (const seg of scene.segments) {
        videoJobs.push({
          id: seg.id,
          prompt: seg.video_prompt || seg.script,
          image: seg.image,
          durationHint: sceneDurations[seg.id] || seg.duration_hint_ms,
        });
      }
    } else {
      videoJobs.push({
        id: scene.id,
        prompt: scene.video_prompt || scene.script || scene.id,
        image: scene.image,
        durationHint: sceneDurations[scene.id] || scene.duration_hint_ms,
      });
    }
  }

  logger.info(`  ${videoJobs.length} video clips to generate`);

  // Generate clips (sequential to respect rate limits for video generation)
  const clips: VideoClip[] = [];

  for (const job of videoJobs) {
    logger.info(`  Generating: ${job.id}`);

    const payload: Record<string, unknown> = {
      prompt: job.prompt,
      aspect_ratio: aspectRatio,
    };

    if (job.image) {
      const imageUrl = await resolveImageUrl(job.image);
      if (provider === "veo") {
        payload.imageUrls = [imageUrl];
        payload.generationType = "REFERENCE_2_VIDEO";
        payload.model = visualConfig.ai_generate?.model || "veo3_fast";
      } else {
        payload.imageUrl = imageUrl;
        payload.duration = 5; // Runway supports 5 or 10
        payload.quality = "720p";
      }
    } else {
      if (provider === "veo") {
        payload.generationType = "TEXT_2_VIDEO";
        payload.model = visualConfig.ai_generate?.model || "veo3_fast";
      } else {
        payload.duration = 5;
        payload.quality = "720p";
        payload.aspectRatio = aspectRatio;
      }
    }

    try {
      const taskId = await client.generateVideo(provider, payload);
      logger.info(`    Task: ${taskId}`);

      const result = await client.pollUntilDone(taskId, {
        timeoutMs: 15 * 60 * 1000,
        initialDelayMs: 10000,
      });

      if (!result?.resultJson) {
        throw new Error(`Video task ${taskId}: no resultJson`);
      }

      const resultData = JSON.parse(result.resultJson);
      const videoUrl =
        resultData.resultUrls?.[0] ||
        resultData.video_url ||
        resultData.url ||
        (Array.isArray(resultData.resultUrls)
          ? JSON.parse(resultData.resultUrls)?.[0]
          : null);

      if (!videoUrl) {
        throw new Error(`Video task ${taskId}: no video URL in ${result.resultJson}`);
      }

      const clipFile = join(videoDir, `${job.id}.mp4`);
      await client.downloadFile(videoUrl, clipFile);

      const probe = await ffprobe(clipFile);
      clips.push({
        sceneId: job.id,
        file: clipFile,
        duration_ms: Math.round(probe.duration * 1000),
      });

      logger.info(`    Done: ${job.id} (${Math.round(probe.duration)}s)`);
    } catch (err) {
      logger.error(`    Failed: ${job.id} — ${(err as Error).message}`);
      // Continue with remaining clips
    }
  }

  if (clips.length === 0) {
    throw new Error("No video clips were generated successfully");
  }

  // Concatenate all clips into a single video
  logger.info(`  Concatenating ${clips.length} clips...`);
  const outputFile = join(rawDir, "combined.mp4");
  await ffmpegConcat(
    clips.map((c) => c.file),
    outputFile
  );

  const probe = await ffprobe(outputFile);
  logger.step("VIDEO", `Combined video: ${Math.round(probe.duration)}s from ${clips.length} clips`);

  return { file: outputFile, duration_ms: Math.round(probe.duration * 1000) };
}
