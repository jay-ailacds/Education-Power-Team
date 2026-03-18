import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { KieClient } from "./kie-client.ts";
import { ffprobe } from "../media/ffmpeg.ts";
import { logger } from "../core/logger.ts";
import type { VoiceConfig, SceneConfig, TTSResult } from "../types.ts";

interface TTSJob {
  sceneId: string;
  script: string;
}

function flattenScenes(scenes: SceneConfig[]): TTSJob[] {
  const jobs: TTSJob[] = [];
  for (const scene of scenes) {
    if (scene.segments && scene.segments.length > 0) {
      for (const seg of scene.segments) {
        jobs.push({ sceneId: seg.id, script: seg.script });
      }
    } else if (scene.script) {
      jobs.push({ sceneId: scene.id, script: scene.script });
    }
  }
  return jobs;
}

export async function generateVoiceovers(
  client: KieClient,
  voiceConfig: VoiceConfig,
  scenes: SceneConfig[],
  outputDir: string
): Promise<TTSResult[]> {
  const voDir = join(outputDir, "audio", "voiceover");
  mkdirSync(voDir, { recursive: true });

  const jobs = flattenScenes(scenes);
  logger.step("TTS", `Generating ${jobs.length} voiceover clips via ElevenLabs`);

  // Launch all TTS tasks in parallel (skip cached files)
  const taskPromises = jobs.map(async (job) => {
    const outputFile = join(voDir, `${job.sceneId}.mp3`);

    // Per-file cache: skip if MP3 already exists
    if (existsSync(outputFile)) {
      try {
        const probe = await ffprobe(outputFile);
        const durationMs = Math.round(probe.duration * 1000);
        logger.info(`  Cached: ${job.sceneId} (${durationMs}ms)`);
        return { sceneId: job.sceneId, file: outputFile, duration_ms: durationMs };
      } catch {
        // Corrupt file, regenerate
      }
    }

    logger.info(`  Submitting TTS: ${job.sceneId}`);

    const taskId = await client.createTask({
      model: voiceConfig.model,
      input: {
        text: job.script,
        voice: voiceConfig.voice_id,
        stability: voiceConfig.settings.stability,
        similarity_boost: voiceConfig.settings.similarity_boost,
        style: voiceConfig.settings.style,
        speed: voiceConfig.settings.speed,
        language_code: "en",
      },
    });

    logger.info(`  Task created: ${job.sceneId} -> ${taskId}`);

    // Poll for completion
    const result = await client.pollUntilDone(taskId, { timeoutMs: 5 * 60 * 1000 });
    if (!result?.resultJson) {
      throw new Error(`TTS task ${taskId} completed but no resultJson`);
    }

    // Parse result URLs
    const resultData = JSON.parse(result.resultJson);
    const audioUrl =
      resultData.resultUrls?.[0] ||
      resultData.audio_url ||
      resultData.url ||
      (Array.isArray(resultData) ? resultData[0] : null);

    if (!audioUrl) {
      throw new Error(`TTS task ${taskId}: could not find audio URL in result: ${result.resultJson}`);
    }

    // Download audio file
    await client.downloadFile(audioUrl, outputFile);

    // Probe duration
    const probe = await ffprobe(outputFile);
    const durationMs = Math.round(probe.duration * 1000);

    logger.info(`  Completed: ${job.sceneId} (${durationMs}ms)`);

    return { sceneId: job.sceneId, file: outputFile, duration_ms: durationMs };
  });

  const results = await Promise.allSettled(taskPromises);
  const ttsResults: TTSResult[] = [];
  const errors: string[] = [];

  for (const r of results) {
    if (r.status === "fulfilled") {
      ttsResults.push(r.value);
    } else {
      errors.push(r.reason?.message || String(r.reason));
    }
  }

  if (errors.length > 0) {
    logger.error(`${errors.length} TTS jobs failed:`);
    errors.forEach((e) => logger.error(`  - ${e}`));
    if (ttsResults.length === 0) {
      throw new Error("All TTS jobs failed");
    }
    logger.warn(`Continuing with ${ttsResults.length}/${jobs.length} successful clips`);
  }

  logger.step("TTS", `Generated ${ttsResults.length} voiceover clips`);
  return ttsResults;
}
