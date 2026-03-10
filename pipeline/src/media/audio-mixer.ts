import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  generateSilence,
  ffmpegConcat,
  ffmpegMixAudio,
  ffmpegTrimAudio,
  ffprobe,
} from "./ffmpeg.ts";
import { logger } from "../core/logger.ts";
import type { AudioMixConfig, TTSResult, MusicResult } from "../types.ts";

export interface MixedAudioResult {
  file: string;
  duration_ms: number;
}

export async function mixAudio(
  ttsResults: TTSResult[],
  musicResult: MusicResult,
  mixConfig: AudioMixConfig,
  outputDir: string
): Promise<MixedAudioResult> {
  const mixDir = join(outputDir, "audio", "mixed");
  mkdirSync(mixDir, { recursive: true });

  // Step 1: Create silence gap
  const gapFile = join(mixDir, "silence-gap.mp3");
  await generateSilence(mixConfig.gap_between_scenes_seconds, gapFile);

  // Step 2: Build interleaved file list (clip, gap, clip, gap, ...)
  logger.step("MIX", `Concatenating ${ttsResults.length} voiceover clips with gaps`);
  const fileList: string[] = [];
  for (let i = 0; i < ttsResults.length; i++) {
    fileList.push(ttsResults[i].file);
    if (i < ttsResults.length - 1) {
      fileList.push(gapFile);
    }
  }

  // Step 3: Concatenate voiceover clips
  const voFullFile = join(mixDir, "voiceover-full.mp3");
  await ffmpegConcat(fileList, voFullFile);

  const voPprobe = await ffprobe(voFullFile);
  const totalDurationSec = voPprobe.duration;
  logger.info(`  Combined voiceover: ${totalDurationSec.toFixed(1)}s`);

  // Step 4: Trim background music to match voiceover duration (+ small buffer)
  const trimmedMusicFile = join(mixDir, "music-trimmed.mp3");
  const musicDuration = totalDurationSec + 2; // 2s extra for fade out
  await ffmpegTrimAudio(musicResult.file, trimmedMusicFile, musicDuration, mixConfig.fade_out_seconds);

  // Step 5: Mix voiceover + music
  logger.step("MIX", "Mixing voiceover with background music");
  const musicVolume = dbToLinear(mixConfig.music_volume_db);
  const finalMixFile = join(mixDir, "final-mix.mp3");
  await ffmpegMixAudio(voFullFile, trimmedMusicFile, finalMixFile, {
    musicVolume,
    fadeInSec: mixConfig.fade_in_seconds,
    fadeOutSec: mixConfig.fade_out_seconds,
    totalDurationSec: totalDurationSec + 1,
  });

  const probe = await ffprobe(finalMixFile);
  logger.step("MIX", `Final audio mix: ${probe.duration.toFixed(1)}s`);

  return {
    file: finalMixFile,
    duration_ms: Math.round(probe.duration * 1000),
  };
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}
