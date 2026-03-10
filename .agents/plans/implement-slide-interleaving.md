# Feature: Slide-Based Company Introduction Cards Interleaved with Video Clips

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Generate branded company info-card images using `@napi-rs/canvas`, convert them to video clips with a Ken Burns zoom effect, and interleave them with the existing Veo AI video clips. This extends the total video duration to match the audio track (~180s), so the full voiceover plays without truncation. Each company scene gets: (1) a Veo video clip (8s atmosphere), followed by (2) a branded slide clip showing company name, key statistic, and tagline for the remaining seconds of that scene's voiceover.

## User Story

As a video producer
I want branded info-card slides interleaved with AI video clips
So that the video duration matches the voiceover, key statistics are displayed visually, and each company is properly introduced

## Problem Statement

The current pipeline produces 14 Veo video clips (8s each = 112s total) but the mixed audio track is 180s. The compose step uses `-shortest`, truncating 68s of voiceover content — including key statistics like "260 million students", "95% of administrators agree", and company value propositions that viewers never hear or see.

## Solution Statement

Add a new `slides` pipeline step between `video` and `mix_audio`. This step:
1. Calculates per-scene "slide duration" = TTS duration - Veo clip duration (the gap to fill)
2. Generates branded PNG info-cards using `@napi-rs/canvas` (gradient background, company name, key stat, tagline)
3. Converts each PNG to a video clip with FFmpeg `zoompan` (Ken Burns slow zoom) for the calculated duration
4. Interleaves slide clips with Veo clips in scene order (Veo first, then slide)
5. Concatenates all clips into a new `combined.mp4` that matches the audio duration

The text overlay plan (`.agents/plans/implement-text-overlays.md`) is **superseded** by this plan — the slides themselves display company info, eliminating the need for separate drawtext overlays.

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: High
**Primary Systems Affected**: `types.ts`, `schema.ts`, `state.ts`, `pipeline.ts`, `video-gen.ts`, `ffmpeg.ts`, new `slide-gen.ts`
**Dependencies**: `@napi-rs/canvas` (new npm dependency), FFmpeg with `zoompan` filter (already available)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `pipeline/src/types.ts` (all, 174 lines) — All shared interfaces. `ProjectConfig` (line 2), `SceneConfig` (line 86), `SceneSegment` (line 78), `TTSResult` (line 159), `VideoResult` (line 170), `StepOutput` (line 100), `StepName` (line 97). Must add slide types and extend `StepName` union.

- `pipeline/src/config/schema.ts` (all, 110 lines) — Zod schemas. `sceneSchema` (line 84), `sceneSegmentSchema` (line 76), `projectConfigSchema` (line 94). Must add slide config schema and per-scene slide content fields.

- `pipeline/src/core/state.ts` (all, 108 lines) — `STEP_ORDER` array (line 6) determines pipeline step sequence. Must add `"slides"` step. Backfill logic (lines 30-35) auto-adds new steps as `"pending"` to existing state files.

- `pipeline/src/core/pipeline.ts` (all, 374 lines) — Main orchestrator. TTS results restored at lines 151-162. `sceneDurations` map built at lines 164-168. Video step at lines 206-259. Compose step at lines 285-313. Must add slides step between video and mix_audio.

- `pipeline/src/api/video-gen.ts` (all, 258 lines) — `VideoClip` interface (line 9). `generateVideoClips()` returns `VideoResult` with combined file. Must extend to return per-clip data (`clips` array) so slide step knows each clip's duration.

- `pipeline/src/media/ffmpeg.ts` (all, 237 lines) — `ffmpegConcat` (line 37, codec-copy), `ffmpegConcatReencode` (line 56, re-encode with scale/pad/fps normalization). `ffmpegConcat` is used for the final concatenation; `ffmpegConcatReencode` handles mixed resolutions. Must add `ffmpegImageToVideo()` function for Ken Burns effect.

- `pipeline/src/media/audio-mixer.ts` (all, 77 lines) — Shows gap insertion pattern (0.3s silence between TTS clips). Total audio = sum(TTS) + (N-1)*0.3s + music buffer.

- `pipeline/src/media/video-composer.ts` (all, 78 lines) — `composeVideo()` calls `ffmpegMux()` with `-shortest`. Once slide interleaving fills the video to match audio, `-shortest` will no longer truncate content.

- `pipeline/projects/education-power-team.yaml` (all, 209 lines) — Scene structure with segments. Must add `slides` config section and per-scene `slide_title`, `slide_stat`, `slide_tagline` fields.

- `pipeline/src/api/tts.ts` (lines 13-25) — `flattenScenes()` pattern for iterating scenes+segments.

- `video/rendered/enhanced/enhanced-scripts.json` (all, 101 lines) — Contains enhanced voiceover scripts with key statistics for each scene. Source for slide content.

- `video/rendered/.pipeline-state.json` (all, 188 lines) — Current pipeline state with TTS durations per scene.

### New Files to Create

- `pipeline/src/media/slide-gen.ts` — Core module: canvas image generation + Ken Burns video conversion. Contains `generateSlideImage()`, `convertSlideToVideo()`, and `generateAllSlides()`.

### Relevant Documentation

- `@napi-rs/canvas` API: `GlobalFonts.registerFromPath()`, `createCanvas()`, `ctx.createLinearGradient()`, `ctx.fillText()`, `canvas.toBuffer('image/png')`
- FFmpeg zoompan filter: `ffmpeg -loop 1 -framerate 30 -i img.png -vf "scale=8000:-1,zoompan=z='..':x='..':y='..':d=N:s=WxH:fps=F" -t T -c:v libx264 output.mp4`

### Patterns to Follow

**Scene flattening** (from `tts.ts` line 13):
```typescript
for (const scene of scenes) {
  if (scene.segments && scene.segments.length > 0) {
    for (const seg of scene.segments) { /* process seg */ }
  } else if (scene.script) { /* process scene */ }
}
```

**FFmpeg function pattern** (from `ffmpeg.ts`):
```typescript
export async function ffmpegSomething(input: string, output: string, options: {...}): Promise<void> {
  const args = ["-y", "-i", input, ...];
  await runCommand("ffmpeg", args);
}
```

**Pipeline step pattern** (from `pipeline.ts`):
```typescript
if (shouldRun("stepName", state, options)) {
  state.markRunning("stepName");
  try {
    const result = await doWork(...);
    state.markCompleted("stepName", { file: result.file, duration_ms: result.duration_ms });
  } catch (err) {
    state.markFailed("stepName", (err as Error).message);
    throw err;
  }
} else if (state.isCompleted("stepName")) {
  // Restore from cache
}
```

**Naming**: camelCase functions/variables, PascalCase types, kebab-case files.
**Errors**: `(err as Error).message`, `logger.warn` non-fatal, `throw` fatal.
**Logger**: `logger.step("TAG", msg)` major, `logger.info()` detail, `logger.debug()` verbose.

---

## CRITICAL TIMING DESIGN

### Current Duration Mismatch

| Component | Duration | Detail |
|-----------|----------|--------|
| 14 Veo clips | **112.0s** | 8.0s each, 1280x720 @ 24fps |
| Mixed audio | **180.3s** | TTS (170.2s) + gaps (3.9s) + music buffer |
| Gap to fill | **~68.3s** | Slide clips fill this |

### Per-Scene Slide Duration Calculation

For each scene: `slide_duration = TTS_duration + gap_after - veo_clip_duration`

The gap (0.3s) is in the audio between scenes. In the video, each scene's visual block must fill: `TTS_duration_for_scene + 0.3s_gap` (except the last scene has no trailing gap). The Veo clip provides 8s of that. The slide fills the rest.

| Scene | TTS (s) | Gap (s) | Scene Total (s) | Veo (s) | Slide (s) |
|-------|---------|---------|-----------------|---------|-----------|
| scene1-hook | 12.8 | 0.3 | 13.1 | 8.0 | **5.1** |
| scene2-vision | 17.4 | 0.3 | 17.7 | 8.0 | **9.7** |
| scene3-modern | 16.3 | 0.3 | 16.6 | 8.0 | **8.6** |
| scene4-intro | 13.7 | 0.3 | 14.0 | 8.0 | **6.0** |
| scene5a-vardhman | 15.1 | 0.3 | 15.4 | 8.0 | **7.4** |
| scene5b-megabyte | 12.2 | 0.3 | 12.5 | 8.0 | **4.5** |
| scene5c-acepower | 8.3 | 0.3 | 8.6 | 8.0 | **0.6** (title-only) |
| scene5d-athletos | 12.7 | 0.3 | 13.0 | 8.0 | **5.0** |
| scene6a-aksolutions | 12.8 | 0.3 | 13.1 | 8.0 | **5.1** |
| scene6b-rootsquare | 11.5 | 0.3 | 11.8 | 8.0 | **3.8** |
| scene6c-ailacds | 16.1 | 0.3 | 16.4 | 8.0 | **8.4** |
| scene6d-asperia | 11.2 | 0.3 | 11.5 | 8.0 | **3.5** |
| scene7-foresight | 10.9 | 0.3 | 11.2 | 8.0 | **3.2** |
| scene8-final | 8.4 | 0.0 | 8.4 | 8.0 | **0.4** (title-only) |
| **TOTALS** | **179.4** | **3.9** | **183.3** | **112.0** | **71.3** |

**Note on short slides**: Every partner gets a slide — no exceptions. For slides under 2.0s (scene5c-acepower at 0.6s and scene8-final at 0.4s), render a **title-only** variant: just the company name on the gradient background, no stat or tagline. This ensures every partner is visually introduced even in tight timing windows.

### Video Clip Sequence (final combined.mp4)

```
[veo-scene1 8s][slide-scene1 5.1s][veo-scene2 8s][slide-scene2 9.7s]...[veo-scene8 8s]
```

Total: ~183.3s (matches audio). With `-shortest` removed or matched, the full voiceover plays.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation — Types, Schema, Dependencies

Add types for slide configuration, extend `StepName` with `"slides"`, add Zod schema, install `@napi-rs/canvas`.

### Phase 2: Video Step Update — Return Per-Clip Data

Extend `generateVideoClips()` to return per-clip durations (needed by slides step for timing calculation).

### Phase 3: Core Slide Generation

Create `slide-gen.ts` with canvas rendering (branded gradient cards) and FFmpeg Ken Burns conversion.

### Phase 4: Pipeline Integration

Add `slides` step to pipeline orchestrator. Interleave slide clips with Veo clips. Update concatenation to produce duration-matched video.

### Phase 5: Configuration

Add slide config + per-scene content to YAML.

---

## STEP-BY-STEP TASKS

### Task 1: Install `@napi-rs/canvas`

- **RUN**: `cd pipeline && npm install @napi-rs/canvas`
- **VALIDATE**: `node -e "const { createCanvas } = require('@napi-rs/canvas'); console.log('OK');"` or equivalent ESM check
- **GOTCHA**: `@napi-rs/canvas` ships prebuilt binaries for macOS arm64. No system deps needed.

### Task 2: UPDATE `pipeline/src/types.ts` — Add slide types and extend StepName

- **IMPLEMENT**: Add these interfaces at the end of the file (before `KieTaskResponse`):
  ```typescript
  export interface SlideStyle {
    canvas_width?: number;        // Default: 1920
    canvas_height?: number;       // Default: 1080
    background_gradient?: string[]; // Default: ["#1a1a2e", "#16213e", "#0f3460"]
    title_font_size?: number;     // Default: 64
    stat_font_size?: number;      // Default: 48
    tagline_font_size?: number;   // Default: 32
    title_color?: string;         // Default: "#ffffff"
    stat_color?: string;          // Default: "#00d4ff"
    tagline_color?: string;       // Default: "#cccccc"
    accent_line_color?: string;   // Default: "#00d4ff"
    font_family?: string;         // Default: "Avenir Next"
    font_path?: string;           // Default: "/System/Library/Fonts/Avenir Next.ttc"
    min_slide_duration_sec?: number; // Slides shorter than this use title-only layout. Default: 2.0
    ken_burns_zoom?: number;      // Zoom factor (1.0 = no zoom). Default: 1.08
  }

  export interface SlideConfig {
    enabled: boolean;
    style?: SlideStyle;
  }

  export interface SlideContent {
    title: string;        // Company name or topic
    stat?: string;        // Key statistic (e.g., "260 million students")
    tagline?: string;     // Short value proposition
  }

  export interface VideoClipInfo {
    sceneId: string;
    file: string;
    duration_ms: number;
  }

  export interface SlideResult {
    sceneId: string;
    imageFile: string;    // Generated PNG
    videoFile: string;    // Ken Burns MP4
    duration_ms: number;
  }
  ```
- **ALSO**: Extend `StepName` (line 97) to include `"slides"`:
  ```typescript
  export type StepName = "research" | "enhance" | "tts" | "music" | "video" | "slides" | "mix_audio" | "compose" | "verify";
  ```
- **ALSO**: Add `slides?: SlideConfig` to `ProjectConfig` (line 2, after `audio_mix`)
- **ALSO**: Add `slide_title?: string`, `slide_stat?: string`, `slide_tagline?: string` to both `SceneConfig` (line 86) and `SceneSegment` (line 78)
- **ALSO**: Extend `StepOutput` (line 100) to support clips and slides data:
  ```typescript
  export interface StepOutput {
    file?: string;
    files?: Record<string, { file: string; duration_ms: number }>;
    clips?: VideoClipInfo[];
    duration_ms?: number;
  }
  ```
- **ALSO**: Extend `VideoResult` (line 170) to include clips:
  ```typescript
  export interface VideoResult {
    file: string;
    duration_ms: number;
    clips?: VideoClipInfo[];
  }
  ```
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 3: UPDATE `pipeline/src/config/schema.ts` — Add slide Zod schema

- **IMPLEMENT**: Add these schemas BEFORE `projectConfigSchema` (before line 94):
  ```typescript
  const slideStyleSchema = z.object({
    canvas_width: z.number().default(1920),
    canvas_height: z.number().default(1080),
    background_gradient: z.array(z.string()).default(["#1a1a2e", "#16213e", "#0f3460"]),
    title_font_size: z.number().default(64),
    stat_font_size: z.number().default(48),
    tagline_font_size: z.number().default(32),
    title_color: z.string().default("#ffffff"),
    stat_color: z.string().default("#00d4ff"),
    tagline_color: z.string().default("#cccccc"),
    accent_line_color: z.string().default("#00d4ff"),
    font_family: z.string().default("Avenir Next"),
    font_path: z.string().default("/System/Library/Fonts/Avenir Next.ttc"),
    min_slide_duration_sec: z.number().default(2.0),
    ken_burns_zoom: z.number().min(1.0).max(1.3).default(1.08),
  });

  const slideConfigSchema = z.object({
    enabled: z.boolean().default(false),
    style: slideStyleSchema.optional(),
  });
  ```
- **ALSO**: Add to `projectConfigSchema` (line 94), after `audio_mix`:
  ```typescript
  slides: slideConfigSchema.optional(),
  ```
- **ALSO**: Add to `sceneSegmentSchema` (line 76) and `sceneSchema` (line 84):
  ```typescript
  slide_title: z.string().optional(),
  slide_stat: z.string().optional(),
  slide_tagline: z.string().optional(),
  ```
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 4: UPDATE `pipeline/src/core/state.ts` — Add "slides" to STEP_ORDER

- **IMPLEMENT**: Change line 6:
  ```typescript
  const STEP_ORDER: StepName[] = ["research", "enhance", "tts", "music", "video", "slides", "mix_audio", "compose", "verify"];
  ```
  The backfill logic (lines 30-35) will automatically add `"slides"` as `"pending"` to existing state files.
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 5: UPDATE `pipeline/src/api/video-gen.ts` — Return per-clip data

- **IMPLEMENT**:
  - Add `VideoClipInfo` to the import from `../types.ts` (line 7)
  - Change the return statement (line 252) to include clips:
    ```typescript
    return {
      file: outputFile,
      duration_ms: Math.round(probe.duration * 1000),
      clips: clips.map(c => ({ sceneId: c.sceneId, file: c.file, duration_ms: c.duration_ms })),
    };
    ```
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 6: UPDATE `pipeline/src/media/ffmpeg.ts` — Add ffmpegImageToVideo (Ken Burns)

- **IMPLEMENT**: Add this new function after `ffmpegConvertWebm` (after line 209):
  ```typescript
  export async function ffmpegImageToVideo(
    imagePath: string,
    outputFile: string,
    options: {
      durationSec: number;
      width: number;
      height: number;
      fps: number;
      zoom?: number; // 1.0 = no zoom, 1.08 = 8% zoom-in. Default: 1.08
    }
  ): Promise<void> {
    const { durationSec, width, height, fps, zoom = 1.08 } = options;
    const totalFrames = Math.ceil(durationSec * fps);
    const zoomIncrement = (zoom - 1.0) / totalFrames;

    // Scale source image large for smooth zoompan, then apply Ken Burns
    const vf = [
      `scale=8000:-1`,
      `zoompan=z='min(1.0+${zoomIncrement}*on\\,${zoom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`,
    ].join(",");

    await runCommand("ffmpeg", [
      "-y",
      "-loop", "1",
      "-framerate", String(fps),
      "-i", imagePath,
      "-vf", vf,
      "-t", String(durationSec),
      "-c:v", "libx264",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputFile,
    ]);
  }
  ```
- **GOTCHA**: The backslash before the comma in `zoompan` expression (`\\,`) is needed because the comma is the FFmpeg filter separator. Within a single filter's parameters, commas in expressions must be escaped.
- **GOTCHA**: `scale=8000:-1` upscales the source PNG to 8000px wide first, giving zoompan enough pixels for smooth animation. Without this, zoom on a 1920px source produces visible pixelation.
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 7: CREATE `pipeline/src/media/slide-gen.ts` — Core slide generation module

- **IMPLEMENT**: This is the main new module. Three responsibilities:

**Part A: Canvas image rendering**
```typescript
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ffmpegImageToVideo, ffprobe } from "./ffmpeg.ts";
import { logger } from "../core/logger.ts";
import type {
  SceneConfig, SlideStyle, SlideContent, SlideResult,
  VideoClipInfo, TTSResult,
} from "../types.ts";

// Default style values (must match Zod defaults in schema.ts)
const DEFAULT_STYLE: Required<SlideStyle> = {
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
};

function renderSlideImage(
  content: SlideContent,
  style: Required<SlideStyle>,
  outputPath: string,
  titleOnly?: boolean
): void
```
- Create canvas at `style.canvas_width x style.canvas_height`
- Draw diagonal linear gradient background (top-left to bottom-right using `style.background_gradient` colors)
- **If `titleOnly` is true**: render only the company name, centered vertically and horizontally, using a larger font size (`style.title_font_size * 1.2`). No accent line, stat, or tagline. This is for short slides (< 2s) where only the name needs to register.
- **If `titleOnly` is false (default / full layout)**:
  - Draw a thin horizontal accent line (~4px, `style.accent_line_color`) at roughly y=55% of height
  - Draw title text (`content.title`) centered horizontally, positioned at ~40% height, using `style.title_font_size`, bold weight, `style.title_color`
  - If `content.stat` exists: draw stat text below accent line at ~62% height, using `style.stat_font_size`, `style.stat_color`
  - If `content.tagline` exists: draw tagline text at ~75% height, using `style.tagline_font_size`, `style.tagline_color`
- Register font: `GlobalFonts.registerFromPath(style.font_path, style.font_family)` — call once before rendering
- Export as PNG: `writeFileSync(outputPath, canvas.toBuffer("image/png"))`
- Use `ctx.textAlign = "center"` and `x = canvas.width / 2` for centered text

**Part B: Slide content extraction**
```typescript
export function extractSlideContents(
  scenes: SceneConfig[]
): Array<{ sceneId: string; content: SlideContent }>
```
- Flatten scenes using the same pattern as `tts.ts` `flattenScenes()`
- For each scene/segment:
  - `title`: Use `slide_title` if set, otherwise derive from scene id (e.g., "scene5a-vardhman" → "Vardhman Traders" — strip prefix, capitalize)
  - `stat`: Use `slide_stat` if set, otherwise omit
  - `tagline`: Use `slide_tagline` if set, otherwise use first sentence of `script`
- Return array of `{ sceneId, content: { title, stat?, tagline? } }`

**Part C: Calculate slide durations**
```typescript
export interface SlideTimingEntry {
  sceneId: string;
  slideDurationSec: number; // How long the slide clip needs to be
  veoClipDurationMs: number;
  ttsDurationMs: number;
  titleOnly: boolean;       // true if slide is too short for full layout
}

export function calculateSlideDurations(
  ttsResults: TTSResult[],
  videoClips: VideoClipInfo[],
  gapSec: number,
  minSlideDurationSec: number
): SlideTimingEntry[]
```
- For each TTS result (in order), find matching video clip by `sceneId`
- Calculate: `sceneTotalSec = (ttsDurationMs / 1000) + gapSec` (last scene: no gap)
- `slideDurationSec = sceneTotalSec - (veoClipDurationMs / 1000)`
- If `slideDurationSec <= 0`, set to 0 (no slide needed — Veo clip fills the scene)
- If `slideDurationSec > 0 but < minSlideDurationSec`, mark as `titleOnly: true` — the slide still renders but shows only the company name (no stat or tagline) for readability in the short time
- Every partner gets a slide. No scene is skipped.
- Return array with timing data including `titleOnly` flag

**Part D: Main orchestrator**
```typescript
export async function generateAllSlides(
  scenes: SceneConfig[],
  ttsResults: TTSResult[],
  videoClips: VideoClipInfo[],
  gapSec: number,
  style: Required<SlideStyle>,
  outputDir: string
): Promise<SlideResult[]>
```
- Create output dirs: `{outputDir}/slides/images/` and `{outputDir}/slides/clips/`
- Call `extractSlideContents(scenes)`
- Call `calculateSlideDurations(ttsResults, videoClips, gapSec, style.min_slide_duration_sec)`
- Register font once: `GlobalFonts.registerFromPath(style.font_path, style.font_family)`
- For each scene with `slideDurationSec > 0`:
  - **Cache check**: if `slides/clips/{sceneId}.mp4` exists and has correct duration, skip
  - Call `renderSlideImage(content, style, imagePath)` → PNG
  - Call `ffmpegImageToVideo(imagePath, videoPath, { durationSec, width: 1280, height: 720, fps: 24, zoom: style.ken_burns_zoom })` → MP4
    - Note: render canvas at 1920x1080 for quality, but output video at **1280x720 @ 24fps** to match Veo clips (avoids re-encoding during concat)
  - Probe result for actual duration
  - Push to results array
- Return `SlideResult[]`

- **IMPORTS**: As shown above
- **GOTCHA**: `@napi-rs/canvas` font registration must happen before any `ctx.font = ...` calls. Register once in `generateAllSlides()`.
- **GOTCHA**: Ken Burns output resolution (1280x720 @ 24fps) must match Veo clips exactly so `ffmpegConcat` (codec-copy) works without re-encoding.
- **GOTCHA**: For scenes where the slide is very short (e.g., scene5c at 0.6s, scene8 at 0.4s), still generate a slide but use the `titleOnly` layout — just the company name, no stat/tagline. Every partner gets a slide, no exceptions.
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 8: UPDATE `pipeline/src/api/video-gen.ts` — Interleave slides with Veo clips

- **IMPLEMENT**: Add a new exported function to handle the interleaving:
  ```typescript
  export async function interleaveClipsWithSlides(
    videoClips: VideoClipInfo[],
    slideResults: SlideResult[],
    outputDir: string
  ): Promise<VideoResult>
  ```
  - Build ordered file list: for each scene (in order), add Veo clip file, then slide clip file (if exists)
  - Create slide lookup: `Map<sceneId, SlideResult>`
  - Call `ffmpegConcat(orderedFiles, outputFile)` — codec-copy concat (all clips are same resolution/fps/codec)
  - Probe combined file for total duration
  - Return `{ file: outputFile, duration_ms, clips: allClipsInOrder }`
  - Output file: `{outputDir}/video/raw/combined.mp4` (overwrites the Veo-only combined file)

- **GOTCHA**: `ffmpegConcat` does codec-copy, which requires all inputs to have identical codec, resolution, fps. Since slide clips are generated at 1280x720 @ 24fps h264 (matching Veo), this works. If any mismatch occurs, fall back to `ffmpegConcatReencode`.
- **GOTCHA**: The combined file must be ordered exactly as the audio: scene1 visuals, scene2 visuals, ..., scene14 visuals. The audio mixer concatenates TTS in the same scene order with 0.3s gaps.
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 9: UPDATE `pipeline/src/core/pipeline.ts` — Add slides step and wire everything

- **IMPLEMENT**: This is the largest integration task. Multiple changes:

**9a: Imports** (top of file):
- Add: `import { generateAllSlides } from "../media/slide-gen.ts";`
- Add: `import { interleaveClipsWithSlides } from "../api/video-gen.ts";`
- Add `VideoClipInfo, SlideResult` to the types import

**9b: Video step — store per-clip data** (lines 206-259):
- Add `let videoClips: VideoClipInfo[] = [];` near line 204
- In the `image-to-video` / `ai-generate` branch (lines 220-231), capture clips:
  ```typescript
  const result = await generateVideoClips(client, config.visual, config.scenes, sceneDurations, outputDir);
  videoFile = result.file;
  videoClips = result.clips || [];
  state.markCompleted("video", { file: result.file, duration_ms: result.duration_ms, clips: result.clips });
  ```
- In the cache restoration branch (lines 256-259):
  ```typescript
  videoFile = state.get("video").outputs?.file || "";
  videoClips = state.get("video").outputs?.clips || [];
  ```

**9c: New slides step** (insert between video step and mix_audio step, around line 260):
```typescript
// ─── Step 3.5: Generate slides (interleave with video clips) ───
let slideResults: SlideResult[] = [];

if (shouldRun("slides", state, options)) {
  if (config.slides?.enabled && videoClips.length > 0 && ttsResults.length > 0) {
    state.markRunning("slides");
    try {
      const slideStyle = { ...DEFAULT_SLIDE_STYLE, ...config.slides.style };
      slideResults = await generateAllSlides(
        config.scenes,
        ttsResults,
        videoClips,
        config.audio_mix.gap_between_scenes_seconds,
        slideStyle as Required<SlideStyle>,
        outputDir
      );

      // Interleave slides with Veo clips → new combined.mp4
      if (slideResults.length > 0) {
        const combined = await interleaveClipsWithSlides(videoClips, slideResults, outputDir);
        videoFile = combined.file; // Update videoFile for compose step
        state.markCompleted("slides", {
          file: combined.file,
          duration_ms: combined.duration_ms,
          clips: combined.clips,
        });
        logger.step("SLIDES", `Interleaved ${slideResults.length} slides → ${Math.round(combined.duration_ms / 1000)}s video`);
      } else {
        state.markCompleted("slides");
        logger.info("  SLIDES: no slides needed (all scenes filled by Veo clips)");
      }
    } catch (err) {
      state.markFailed("slides", (err as Error).message);
      throw err;
    }
  } else {
    logger.info("  SLIDES: disabled or missing data");
    state.markCompleted("slides");
  }
} else if (state.isCompleted("slides")) {
  const slidesOutput = state.get("slides").outputs;
  if (slidesOutput?.file) {
    videoFile = slidesOutput.file; // Use interleaved video
  }
  logger.info("  SLIDES: using cached results");
}
```

**9d: Import DEFAULT_SLIDE_STYLE** — Define at top of pipeline.ts or import from slide-gen.ts. Import the `DEFAULT_STYLE` from `slide-gen.ts` and alias it.

- **GOTCHA**: The `videoFile` variable must be updated after slide interleaving so the compose step uses the interleaved video (not the Veo-only combined video).
- **GOTCHA**: When slides are cached, restore `videoFile` from the slides step output (not the video step output).
- **GOTCHA**: `SlideStyle` import needed for the spread. Add to types import.
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 10: UPDATE `pipeline/projects/education-power-team.yaml` — Add slide config and content

- **IMPLEMENT**: Add `slides` section after `audio_mix` (after line 59):
  ```yaml
  slides:
    enabled: true
    style:
      canvas_width: 1920
      canvas_height: 1080
      background_gradient:
        - "#1a1a2e"
        - "#16213e"
        - "#0f3460"
      title_font_size: 64
      stat_font_size: 48
      tagline_font_size: 32
      title_color: "#ffffff"
      stat_color: "#00d4ff"
      tagline_color: "#cccccc"
      accent_line_color: "#00d4ff"
      font_family: "Avenir Next"
      font_path: "/System/Library/Fonts/Avenir Next.ttc"
      min_slide_duration_sec: 1.5
      ken_burns_zoom: 1.08
  ```

- **ALSO**: Add `slide_title`, `slide_stat`, `slide_tagline` to each scene/segment:

  | Scene ID | slide_title | slide_stat | slide_tagline |
  |----------|-------------|------------|---------------|
  | scene1-hook | Education Power Team | 260 million students across India | Building the future of education |
  | scene2-vision | The Vision | National Education Policy 2020 | More than bricks and mortar |
  | scene3-modern | Modern Requirements | 4,000+ schools with smart classrooms | Future-ready skills for today's students |
  | scene4-intro | Education Power Team | Complete 360-degree ecosystem | From infrastructure to innovation |
  | scene5a-vardhman | Vardhman Traders | 95% agree facilities boost performance | Classroom & laboratory infrastructure |
  | scene5b-megabyte | Mega Byte Systems | Powering digital classrooms | IT systems, networking & digital labs |
  | scene5c-acepower | Ace Power | 24/7 power backup | Learning never stops |
  | scene5d-athletos | Athletos Sports Foundation | AI-enabled coaching | Grassroots to national-level excellence |
  | scene6a-aksolutions | A.K. Solutions | Near-perfect accuracy | ERP & administration automation |
  | scene6b-rootsquare | Root Square LLP | Equipped from day one | Uniforms & stationery supply |
  | scene6c-ailacds | AI-LA-CDS | AI fluency is essential | AI skills programs & learning platforms |
  | scene6d-asperia | Asperia Institute | PAN India reach | Skill-based medical training |
  | scene7-foresight | Global Foresight | Universities & careers worldwide | Career counseling & higher education |
  | scene8-final | Education Power Team | Eight specialized partners | Building the future of education |

  Place these fields alongside existing scene fields (after `script:` or `image:`).

- **VALIDATE**: `cd pipeline && npx tsx src/cli.ts status projects/education-power-team.yaml`

### Task 11: Test — Run slides step end-to-end

- **IMPLEMENT**:
  1. Reset `video`, `slides`, and `compose` steps in `.pipeline-state.json` to `"pending"`
     - `video` needs re-run to store per-clip data
     - `slides` is the new step
     - `compose` must re-run with the interleaved video
  2. Run: `cd pipeline && npx tsx src/cli.ts resume projects/education-power-team.yaml --verbose`
  3. The pipeline should:
     - Skip research/enhance/tts/music (cached)
     - Re-run video (probes cached clips, stores clip data, fast)
     - Run slides (generate ~12 PNG images + Ken Burns MP4 clips, interleave)
     - Skip mix_audio (cached)
     - Re-run compose (mux interleaved video + audio)

- **VALIDATE**:
  - Check `slides/images/` has 14 PNG files (one per scene, no partner skipped)
  - Check `slides/clips/` has 14 MP4 files matching scene IDs
  - Verify each slide clip: `ffprobe -v error -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of json slides/clips/scene5a-vardhman.mp4` → 1280x720 @ 24fps, ~7.4s
  - Verify combined video: `ffprobe -v error -show_entries format=duration -of csv=p=0 video/raw/combined.mp4` → ~183s (not 112s)
  - Verify final output: duration ~180s, full voiceover audible
  - Visually inspect: Veo clip plays, then branded slide appears with company name/stat/tagline, then next Veo clip
  - Check `.pipeline-state.json` has `slides` step completed with clip data

---

## TESTING STRATEGY

No test framework configured. Validation via:

### Functional Tests
1. **TypeScript**: `cd pipeline && npx tsc --noEmit` — zero errors
2. **Config load**: `cd pipeline && npx tsx src/cli.ts status projects/education-power-team.yaml` — no errors
3. **Slide generation**: Individual PNG files render correctly
4. **Ken Burns conversion**: Individual MP4 clips have correct duration, resolution, fps
5. **Interleaving**: Combined video has correct total duration (~183s)
6. **Full pipeline**: Compose step produces final video matching audio duration

### Edge Cases
- Scene with no `slide_title` — should use auto-derived title from scene ID
- Scene with title but no stat — should render title + tagline only (no stat line)
- Scene where slide duration < min_slide_duration_sec (2.0s) — use title-only layout (larger centered company name, no stat/tagline)
- `slides.enabled: false` — should produce same output as before (112s video, truncated)
- `slides` section absent from YAML — defaults to disabled, backward compatible
- Very long title text — should truncate or reduce font size
- Font file not found — should fail with clear error message

---

## VALIDATION COMMANDS

### Level 1: Syntax & Types
```bash
cd pipeline && npx tsc --noEmit
```
**Expected**: Exit 0, no errors

### Level 2: Config
```bash
cd pipeline && npx tsx src/cli.ts status projects/education-power-team.yaml
```
**Expected**: Shows all steps including new `slides` step

### Level 3: Pipeline Run
```bash
cd pipeline && npx tsx src/cli.ts resume projects/education-power-team.yaml --verbose
```
**Expected**: Slides step generates images + clips, interleaves, produces ~183s combined video

### Level 4: Duration Verification
```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 /Users/jayakkumarkrishnasamy/Projects/Education-Power-Team/video/rendered/video/raw/combined.mp4
```
**Expected**: ~183 seconds (was 112 seconds before)

### Level 5: Slide Clip Verification
```bash
for f in /Users/jayakkumarkrishnasamy/Projects/Education-Power-Team/video/rendered/slides/clips/*.mp4; do
  name=$(basename "$f" .mp4)
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  res=$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$f" | head -1)
  echo "$name: ${dur}s ${res}"
done
```
**Expected**: 14 clips (all partners), each 1280x720, durations matching the timing table

### Level 6: Final Output Check
```bash
ffprobe -v error -show_entries format=duration -show_entries stream=width,height -of json "$(python3 -c "import json; print(json.load(open('/Users/jayakkumarkrishnasamy/Projects/Education-Power-Team/video/rendered/.pipeline-state.json'))['steps']['compose']['outputs']['file'])")"
```
**Expected**: Duration ~180s, 1280x720

---

## ACCEPTANCE CRITERIA

- [ ] `@napi-rs/canvas` installed and working
- [ ] `slides` step added to pipeline with full state management
- [ ] All 14 branded info-card PNGs generated (12 full layout + 2 title-only)
- [ ] Ken Burns MP4 clips generated from PNGs at 1280x720 @ 24fps
- [ ] Slide clips interleaved with Veo clips in correct scene order
- [ ] Combined video duration matches audio duration (~180s, not 112s)
- [ ] Full voiceover is audible in final output (no truncation)
- [ ] `slides.enabled: false` produces same output as before (backward compatible)
- [ ] Missing `slides` config defaults to disabled (backward compatible)
- [ ] Slide caching works (re-run skips existing clips)
- [ ] Per-clip video data stored in pipeline state
- [ ] TypeScript compiles with zero errors
- [ ] Pipeline config loads without errors

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order (1-11)
- [ ] `cd pipeline && npx tsc --noEmit` passes
- [ ] `cd pipeline && npx tsx src/cli.ts status projects/education-power-team.yaml` passes
- [ ] Combined video ~183s (was 112s)
- [ ] Final output ~180s with full audio
- [ ] All 14 slide clips generated and cached (no partner skipped)
- [ ] Backward compatible when disabled
- [ ] Pipeline state tracks slides step

---

## NOTES

### Design Decisions

1. **`@napi-rs/canvas` over alternatives**: Zero system dependencies (no Cairo/Pango), fastest benchmarks (~14ms per image), full Canvas 2D API, system font access. Runner-up was satori+resvg-js but it requires bundled font files.

2. **Separate "slides" pipeline step** (not inline in video step): Cleaner separation of concerns. Slides depend on both TTS results (for duration calculation) and video clips (for per-clip durations). A separate step between `video` and `mix_audio` has access to both.

3. **Ken Burns zoom** (not static image): A slight 8% zoom-in over the slide duration adds visual movement, preventing the "slideshow feel" of static images. The `zoompan` filter is computationally cheap and well-supported.

4. **1280x720 @ 24fps slide clips**: Must match Veo clip specs exactly so `ffmpegConcat` (codec-copy) works. Re-encoding 14+12=26 clips would add minutes to the pipeline. Canvas renders at 1920x1080 for quality, then FFmpeg downscales during Ken Burns conversion.

5. **Title-only slides for short durations**: scene5c-acepower (0.6s) and scene8-final (0.4s) have very short slide windows. Instead of skipping these partners, they get a **title-only** slide — just the company name in large centered text on the gradient background. Every partner in the Education Power Team is visually introduced, no exceptions. The `min_slide_duration_sec` (2.0s) threshold determines which slides use the simplified title-only layout vs the full layout with stat and tagline.

6. **Supersedes text overlay plan**: The slides display company names, stats, and taglines more prominently than drawtext overlays could. The `.agents/plans/implement-text-overlays.md` plan is no longer needed as a separate feature. If light overlay text is also desired on Veo clips (not just slides), that can be added later as a smaller enhancement.

### Slide Visual Design

```
┌─────────────────────────────────────────────────┐
│                                                   │
│     ╔═══════════════════════════════════════╗     │  Gradient background
│     ║                                       ║     │  #1a1a2e → #16213e → #0f3460
│     ║         Vardhman Traders              ║     │  (diagonal)
│     ║                                       ║     │
│     ║  ─────────────────────────────────    ║     │  Accent line (#00d4ff)
│     ║                                       ║     │
│     ║    95% agree facilities boost         ║     │  Stat text (#00d4ff)
│     ║         performance                   ║     │
│     ║                                       ║     │
│     ║   Classroom & laboratory              ║     │  Tagline (#cccccc)
│     ║       infrastructure                  ║     │
│     ╚═══════════════════════════════════════╝     │
│                                                   │
└─────────────────────────────────────────────────┘
```

### Video Sequence Diagram (Final Output)

```
Time  0s    8s   13.1s  21.1s  30.8s  38.8s  47.4s  55.4s
      │ Veo │Slide│ Veo  │Slide │ Veo  │Slide │ Veo  │Slide │...
      │ s1  │ s1  │  s2  │  s2  │  s3  │  s3  │  s4  │  s4  │
      └─────┴─────┴──────┴──────┴──────┴──────┴──────┴──────┘
                                                        ...continues to ~183s
```

### Confidence Score: 7/10

Risks:
- FFmpeg `zoompan` filter can be slow for longer clips (~10s per clip) — total ~2 minutes for 12 slides
- Canvas font rendering quality needs visual verification (may need font weight/style tuning)
- Codec-copy concat requires exact format match between Veo and slide clips — if h264 profiles differ, may need `ffmpegConcatReencode` fallback
- The timing calculation assumes Veo clips are exactly 8.0s; if future clips vary, the math still works but slides may be very short or unnecessary
