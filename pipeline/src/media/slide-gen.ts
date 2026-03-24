import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ffmpegImageToVideo, ffprobe } from "./ffmpeg.ts";
import { logger } from "../core/logger.ts";
import type {
  SceneConfig, SlideStyle, SlideContent, SlideResult,
  VideoClipInfo, TTSResult,
} from "../types.ts";

export const DEFAULT_SLIDE_STYLE: Required<SlideStyle> = {
  canvas_width: 1920,
  canvas_height: 1080,
  background_gradient: ["#1a1a2e", "#16213e", "#0f3460"],
  title_font_size: 64,
  stat_font_size: 48,
  tagline_font_size: 32,
  title_color: "#ffffff",
  stat_color: "#00d4ff",
  tagline_color: "#cccccc",
  accent_line_color: "#00d4ff",
  font_family: "Avenir Next",
  font_path: "/System/Library/Fonts/Avenir Next.ttc",
  min_slide_duration_sec: 2.0,
  ken_burns_zoom: 1.08,
  duration_offset_sec: -1.0,
};

function renderSlideImage(
  content: SlideContent,
  style: Required<SlideStyle>,
  outputPath: string,
  titleOnly?: boolean
): void {
  const canvas = createCanvas(style.canvas_width, style.canvas_height);
  const ctx = canvas.getContext("2d");

  // Draw diagonal gradient background
  const gradient = ctx.createLinearGradient(0, 0, style.canvas_width, style.canvas_height);
  const colors = style.background_gradient;
  for (let i = 0; i < colors.length; i++) {
    gradient.addColorStop(i / (colors.length - 1), colors[i]);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, style.canvas_width, style.canvas_height);

  ctx.textAlign = "center";
  const centerX = style.canvas_width / 2;

  if (titleOnly) {
    // Title-only layout: large centered company name
    const fontSize = Math.round(style.title_font_size * 1.2);
    ctx.font = `bold ${fontSize}px "${style.font_family}"`;
    ctx.fillStyle = style.title_color;
    ctx.fillText(content.title, centerX, style.canvas_height / 2);
  } else {
    // Full layout: title, accent line, stat, tagline
    // Title at ~40% height
    ctx.font = `bold ${style.title_font_size}px "${style.font_family}"`;
    ctx.fillStyle = style.title_color;
    ctx.fillText(content.title, centerX, style.canvas_height * 0.40);

    // Accent line at ~55% height
    const lineY = style.canvas_height * 0.55;
    const lineWidth = style.canvas_width * 0.4;
    ctx.strokeStyle = style.accent_line_color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX - lineWidth / 2, lineY);
    ctx.lineTo(centerX + lineWidth / 2, lineY);
    ctx.stroke();

    // Stat at ~62% height
    if (content.stat) {
      ctx.font = `${style.stat_font_size}px "${style.font_family}"`;
      ctx.fillStyle = style.stat_color;
      ctx.fillText(content.stat, centerX, style.canvas_height * 0.62);
    }

    // Tagline at ~75% height
    if (content.tagline) {
      ctx.font = `${style.tagline_font_size}px "${style.font_family}"`;
      ctx.fillStyle = style.tagline_color;
      ctx.fillText(content.tagline, centerX, style.canvas_height * 0.75);
    }
  }

  writeFileSync(outputPath, canvas.toBuffer("image/png"));
}

export function extractSlideContents(
  scenes: SceneConfig[]
): Array<{ sceneId: string; content: SlideContent }> {
  const results: Array<{ sceneId: string; content: SlideContent }> = [];

  for (const scene of scenes) {
    if (scene.segments && scene.segments.length > 0) {
      for (const seg of scene.segments) {
        if (!seg.slide_title) continue; // Skip segments without explicit slide_title
        const title = seg.slide_title;
        const stat = seg.slide_stat;
        const tagline = seg.slide_tagline || firstSentence(seg.script);
        results.push({ sceneId: seg.id, content: { title, stat, tagline } });
      }
    } else if (scene.script && scene.slide_title) {
      const title = scene.slide_title;
      const stat = scene.slide_stat;
      const tagline = scene.slide_tagline || firstSentence(scene.script);
      results.push({ sceneId: scene.id, content: { title, stat, tagline } });
    }
  }

  return results;
}

function deriveTitle(sceneId: string): string {
  // "scene5a-vardhman" → "Vardhman"
  const parts = sceneId.split("-");
  const name = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.trim().slice(0, 80);
}

export interface SlideTimingEntry {
  sceneId: string;
  slideDurationSec: number;
  veoClipDurationMs: number;
  ttsDurationMs: number;
  titleOnly: boolean;
}

export function calculateSlideDurations(
  ttsResults: TTSResult[],
  videoClips: VideoClipInfo[],
  gapSec: number,
  minSlideDurationSec: number,
  durationOffsetSec: number = -1.0
): SlideTimingEntry[] {
  const clipMap = new Map<string, VideoClipInfo>();
  for (const clip of videoClips) {
    clipMap.set(clip.sceneId, clip);
  }

  const entries: SlideTimingEntry[] = [];

  for (let i = 0; i < ttsResults.length; i++) {
    const tts = ttsResults[i];
    const clip = clipMap.get(tts.sceneId);
    if (!clip) continue;

    const isLast = i === ttsResults.length - 1;
    const sceneTotalSec = (tts.duration_ms / 1000) + (isLast ? 0 : gapSec);
    const rawSlideDuration = sceneTotalSec - (clip.duration_ms / 1000);
    const rawAdjusted = Math.max(0, rawSlideDuration + durationOffsetSec);
    // Clamp to minimum: if a slide is shown at all, give it enough time to be readable
    const slideDurationSec = rawAdjusted > 0 ? Math.max(rawAdjusted, minSlideDurationSec) : 0;

    entries.push({
      sceneId: tts.sceneId,
      slideDurationSec,
      veoClipDurationMs: clip.duration_ms,
      ttsDurationMs: tts.duration_ms,
      titleOnly: false,
    });
  }

  return entries;
}

export async function generateAllSlides(
  scenes: SceneConfig[],
  ttsResults: TTSResult[],
  videoClips: VideoClipInfo[],
  gapSec: number,
  style: Required<SlideStyle>,
  outputDir: string
): Promise<SlideResult[]> {
  const imageDir = join(outputDir, "slides", "images");
  const clipDir = join(outputDir, "slides", "clips");
  mkdirSync(imageDir, { recursive: true });
  mkdirSync(clipDir, { recursive: true });

  // Register font
  if (existsSync(style.font_path)) {
    GlobalFonts.registerFromPath(style.font_path, style.font_family);
  } else {
    logger.warn(`Font not found: ${style.font_path} — using system fallback`);
  }

  const contents = extractSlideContents(scenes);
  const timings = calculateSlideDurations(ttsResults, videoClips, gapSec, style.min_slide_duration_sec, style.duration_offset_sec);

  const contentMap = new Map(contents.map(c => [c.sceneId, c.content]));
  const results: SlideResult[] = [];

  for (const timing of timings) {
    if (timing.slideDurationSec <= 0) continue;

    const content = contentMap.get(timing.sceneId);
    if (!content) continue;

    const imagePath = join(imageDir, `${timing.sceneId}.png`);
    const videoPath = join(clipDir, `${timing.sceneId}.mp4`);

    // Cache check: skip if video clip exists with correct duration
    if (existsSync(videoPath)) {
      try {
        const probe = await ffprobe(videoPath);
        const existingDur = Math.round(probe.duration * 10) / 10;
        const targetDur = Math.round(timing.slideDurationSec * 10) / 10;
        if (Math.abs(existingDur - targetDur) < 0.5) {
          logger.info(`  Cached: ${timing.sceneId} slide (${existingDur}s)`);
          results.push({
            sceneId: timing.sceneId,
            imageFile: imagePath,
            videoFile: videoPath,
            duration_ms: Math.round(probe.duration * 1000),
          });
          continue;
        }
      } catch {
        // Corrupt file, regenerate
      }
    }

    logger.info(`  Rendering: ${timing.sceneId} slide (${timing.slideDurationSec.toFixed(1)}s, ${timing.titleOnly ? "title-only" : "full"})`);

    // Render PNG
    renderSlideImage(content, style, imagePath, timing.titleOnly);

    // Convert to Ken Burns video at 1280x720 @ 24fps to match Veo clips
    await ffmpegImageToVideo(imagePath, videoPath, {
      durationSec: timing.slideDurationSec,
      width: 1280,
      height: 720,
      fps: 24,
      zoom: style.ken_burns_zoom,
    });

    const probe = await ffprobe(videoPath);
    results.push({
      sceneId: timing.sceneId,
      imageFile: imagePath,
      videoFile: videoPath,
      duration_ms: Math.round(probe.duration * 1000),
    });
  }

  logger.step("SLIDES", `Generated ${results.length} slide clips`);
  return results;
}
