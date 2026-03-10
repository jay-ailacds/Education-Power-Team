import { mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { KieClient } from "./kie-client.ts";
import { ImageHostServer, startCloudflaredTunnel } from "./image-host.ts";
import { ffprobe, ffmpegConcat } from "../media/ffmpeg.ts";
import { logger } from "../core/logger.ts";
import type { SceneConfig, VisualConfig, VideoResult } from "../types.ts";

interface VideoClip {
  sceneId: string;
  file: string;
  duration_ms: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
  const model = visualConfig.ai_generate?.model || "veo3_fast";

  logger.step("VIDEO", `Generating video clips via ${provider}`);

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

  // Check if any jobs need local images hosted
  const hasLocalImages = videoJobs.some(
    (j) => j.image && !j.image.startsWith("http://") && !j.image.startsWith("https://")
  );

  // Set up image hosting if needed
  const imageHost = new ImageHostServer();
  let tunnelKill: (() => void) | null = null;
  let tunnelReady = false;

  if (hasLocalImages) {
    logger.info("  Setting up image hosting for local files...");
    await imageHost.start();

    try {
      const port = imageHost.localPort;
      if (port) {
        const tunnel = await startCloudflaredTunnel(port);
        tunnelKill = tunnel.kill;
        imageHost.setPublicUrl(tunnel.url);

        // Give the tunnel a few seconds to stabilize
        logger.info("  Waiting for tunnel to stabilize...");
        await sleep(5000);

        // Verify tunnel works
        const firstImage = videoJobs.find(j => j.image && !j.image.startsWith("http"));
        if (firstImage?.image) {
          const testUrl = imageHost.register(resolve(firstImage.image));
          logger.info(`  Verifying tunnel: ${testUrl}`);
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const testRes = await fetch(testUrl);
              if (testRes.ok) {
                const bytes = (await testRes.arrayBuffer()).byteLength;
                logger.info(`  Tunnel verified: ${bytes} bytes fetched OK`);
                tunnelReady = true;
                break;
              }
              logger.warn(`  Tunnel verify attempt ${attempt}: HTTP ${testRes.status}`);
            } catch {
              logger.warn(`  Tunnel verify attempt ${attempt}: fetch failed`);
            }
            if (attempt < 3) await sleep(3000);
          }
        }
      }
    } catch (err) {
      logger.warn(`  Tunnel setup failed: ${(err as Error).message}`);
    }

    if (!tunnelReady) {
      logger.warn("  Tunnel not available — using TEXT_2_VIDEO mode (no reference images)");
    }
  }

  try {
    const clips: VideoClip[] = [];

    for (const job of videoJobs) {
      // Skip if clip already exists (partial resume)
      const clipFile = join(videoDir, `${job.id}.mp4`);
      if (existsSync(clipFile)) {
        try {
          const probe = await ffprobe(clipFile);
          if (probe.duration > 0) {
            logger.info(`  Cached: ${job.id} (${Math.round(probe.duration)}s)`);
            clips.push({
              sceneId: job.id,
              file: clipFile,
              duration_ms: Math.round(probe.duration * 1000),
            });
            continue;
          }
        } catch {
          // Corrupt file, regenerate
        }
      }

      logger.info(`  Generating: ${job.id}`);

      const payload: Record<string, unknown> = {
        prompt: job.prompt,
        aspect_ratio: aspectRatio,
      };

      // Determine if we can use image-to-video or must fall back to text-to-video
      let useImage = false;
      if (job.image && tunnelReady) {
        let imageUrl: string;
        if (job.image.startsWith("http://") || job.image.startsWith("https://")) {
          imageUrl = job.image;
          useImage = true;
        } else {
          const absPath = resolve(job.image);
          if (existsSync(absPath)) {
            imageUrl = imageHost.register(absPath);
            useImage = true;
          }
        }
        if (useImage) {
          if (provider === "veo") {
            payload.imageUrls = [imageUrl!];
            payload.generationType = "REFERENCE_2_VIDEO";
            payload.model = model;
          } else {
            payload.imageUrl = imageUrl!;
            payload.duration = 5;
            payload.quality = "720p";
          }
        }
      }

      if (!useImage) {
        if (provider === "veo") {
          payload.generationType = "TEXT_2_VIDEO";
          payload.model = model;
        } else {
          payload.duration = 5;
          payload.quality = "720p";
          payload.aspectRatio = aspectRatio;
        }
      }

      try {
        const taskId = await client.generateVideo(provider, payload);
        logger.info(`    Task: ${taskId} (${payload.generationType})`);

        let videoUrl: string;

        if (provider === "veo") {
          const result = await client.pollVideoUntilDone(taskId, {
            timeoutMs: 15 * 60 * 1000,
            initialDelayMs: 30000,
          });
          videoUrl = result.videoUrl;
        } else {
          const result = await client.pollUntilDone(taskId, {
            timeoutMs: 15 * 60 * 1000,
            initialDelayMs: 10000,
          });
          if (!result?.resultJson) {
            throw new Error(`Video task ${taskId}: no resultJson`);
          }
          const resultData = JSON.parse(result.resultJson);
          videoUrl =
            resultData.resultUrls?.[0] ||
            resultData.video_url ||
            resultData.url;
          if (!videoUrl) {
            throw new Error(`Video task ${taskId}: no video URL in ${result.resultJson}`);
          }
        }

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
  } finally {
    if (imageHost.isRunning) await imageHost.stop();
    if (tunnelKill) tunnelKill();
  }
}
