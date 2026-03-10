# Feature: Text Overlays / Lower Thirds for Video Composition

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Add timed text overlays (lower thirds) to the video composition step, displaying business names, taglines, and scene titles synchronized with the video timeline. Each of the 14 video clips gets a text overlay identifying the company/topic being discussed, with professional fade-in/fade-out animations and semi-transparent background boxes.

## User Story

As a video producer
I want text overlays showing business names and descriptions on each video segment
So that viewers can identify which company/service is being presented at any moment

## Problem Statement

The current compose step (`video-composer.ts`) performs a bare mux of video + audio with no visual enhancements. The 14 AI-generated video clips play back-to-back with no text identifying which business or topic is being discussed. Viewers have no visual reference for the company names mentioned in the voiceover.

## Solution Statement

Extend the compose step to burn FFmpeg `drawtext` filters into the final video during the existing re-encode pass. Use **per-clip video durations** (stored in `.pipeline-state.json` during the video step) to calculate per-scene timing, and scene metadata from the YAML config to extract display text. Each scene/segment gets a two-line lower third: line 1 = company/topic name (bold), line 2 = short description. Text fades in/out with a semi-transparent background box.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Medium
**Primary Systems Affected**: `video-gen.ts`, `video-composer.ts`, `ffmpeg.ts`, `pipeline.ts`, `types.ts`, `schema.ts`
**Dependencies**: FFmpeg with `drawtext` filter (libfreetype) — already installed via `homebrew-ffmpeg/ffmpeg`

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `pipeline/src/media/video-composer.ts` (all) — Current compose function that needs overlay support. Currently receives only videoFile, audioFile, outputConfig, projectSlug. Must be extended to accept overlay/scene data.

- `pipeline/src/media/ffmpeg.ts` (lines 149-172) — `ffmpegMux()` function that runs the final encode. Must be extended to accept an optional `-vf` filter string for drawtext overlays. Also see the filter chain pattern at lines 114-147 (`ffmpegMixAudio`) for how `filter_complex` is built.

- `pipeline/src/core/pipeline.ts` (lines 286-313) — Compose step invocation. Must pass scene metadata + video clip durations here. Lines 206-259 are the video step — must be updated to store per-clip durations in pipeline state.

- `pipeline/src/api/video-gen.ts` (lines 9-13, 224-252) — `VideoClip` interface already has `sceneId` + `duration_ms` per clip, but `generateVideoClips()` only returns the combined `VideoResult`. Must be extended to also return per-clip data.

- `pipeline/src/types.ts` (all) — All shared interfaces. `SceneConfig`, `SceneSegment`, `TTSResult`, `OutputConfig`, `VideoResult`, `StepOutput` definitions. New `TextOverlayConfig` and `VideoClipInfo` types go here.

- `pipeline/src/config/schema.ts` (all) — Zod validation schemas for YAML config. Must add `text_overlays` section.

- `pipeline/src/config/loader.ts` (all) — `loadConfig()` returns `ValidatedConfig` (Zod-inferred type). The `ProjectConfig` interface in types.ts must stay in sync.

- `pipeline/src/api/tts.ts` (lines 13-25) — `flattenScenes()` function showing how scenes with segments are flattened to individual jobs. Same flattening logic needed for overlay text extraction.

- `pipeline/src/core/state.ts` (all) — `PipelineStateManager` persists step status/outputs to JSON. `StepOutput` type determines what can be stored. Must support per-clip video data.

- `pipeline/projects/education-power-team.yaml` (all) — Current project config. Must add `text_overlays` section and per-scene `overlay_title` / `overlay_subtitle` fields.

### New Files to Create

- `pipeline/src/media/text-overlay.ts` — Text overlay builder: calculates timing from video clip durations, generates FFmpeg drawtext filter chain string. Core logic module.

### Relevant Documentation

- FFmpeg drawtext filter: `ffmpeg -h filter=drawtext` (local)
  - Key params: `text`, `fontfile`, `fontsize`, `fontcolor`, `x`, `y`, `box`, `boxcolor`, `boxborderw`, `alpha`, `enable`
  - Why: Core filter for rendering text on video frames

### Patterns to Follow

**FFmpeg filter chain pattern** (from `ffmpeg.ts` lines 114-147):
```typescript
// Multiple filters separated by ";" for filter_complex, or "," for -vf chain
await runCommand("ffmpeg", [
  "-y",
  "-i", inputFile,
  "-vf", filterString,  // comma-separated drawtext filters
  "-c:v", "libx264",
  // ... rest of encode args
]);
```

**Scene flattening pattern** (from `tts.ts`):
```typescript
for (const scene of scenes) {
  if (scene.segments && scene.segments.length > 0) {
    for (const seg of scene.segments) {
      jobs.push({ sceneId: seg.id, script: seg.script });
    }
  } else if (scene.script) {
    jobs.push({ sceneId: scene.id, script: scene.script });
  }
}
```

**Naming conventions**: camelCase for functions/variables, PascalCase for types/interfaces, kebab-case for file names.

**Error handling**: try/catch with `(err as Error).message`, logger.warn for non-fatal, throw for fatal.

**Logger usage**: `logger.step("TAG", message)` for major steps, `logger.info()` for details, `logger.debug()` for verbose.

---

## CRITICAL DESIGN DECISION: Video Timeline vs Audio Timeline

**Problem**: The plan must use **video clip durations** for overlay timing, NOT TTS durations. Here's why:

| Source | Per-scene duration | Total |
|--------|-------------------|-------|
| TTS voiceovers | 8.3s to 17.4s each | ~183s (with 0.3s gaps) |
| Veo video clips | 8.0s each (uniform) | 112s |
| Final output (`-shortest`) | N/A | 112s |

The compose step uses `-shortest`, so the output video is 112s (bounded by video length). Text overlays are rendered on video frames, so they **must** be timed to the video timeline.

**Solution (Option B)**: Store per-clip video durations in `.pipeline-state.json` during the video step. Pass these to the compose step for timeline calculation.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation — Types, Schema, Config

Add the text overlay configuration types, Zod schema, video clip info type, and extend `StepOutput` to support per-clip data.

### Phase 2: Video Step Update — Store Per-Clip Durations

Extend `generateVideoClips()` to return per-clip data. Update pipeline.ts video step to store clip durations in state.

### Phase 3: Core Logic — Timing Calculator + Filter Builder

Create `text-overlay.ts` with:
1. A function to compute per-scene start/end times from **video clip durations** (not TTS)
2. A function to extract display text from scene metadata (title + subtitle)
3. A function to build the FFmpeg `-vf` drawtext filter chain string

### Phase 4: Integration — Wire into Pipeline

1. Extend `ffmpegMux()` to accept an optional video filter string
2. Extend `composeVideo()` to accept scene data and build overlays
3. Pass scene metadata + video clip durations from `pipeline.ts` to the compose step

### Phase 5: Configuration — Update YAML

Add `text_overlays` config and per-scene overlay text to the education-power-team YAML.

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `pipeline/src/types.ts` — Add text overlay and video clip types

- **IMPLEMENT**: Add these interfaces:
  ```typescript
  export interface TextOverlayStyle {
    font_file?: string;          // Path to .ttf/.ttc font file
    title_font_size?: number;    // Default: 44
    subtitle_font_size?: number; // Default: 28
    font_color?: string;         // Default: "white"
    subtitle_color?: string;     // Default: "0xcccccc"
    box_color?: string;          // Default: "0x1a1a2e@0.75"
    box_padding?: number;        // Default: 14
    position_x?: number;         // Left margin in px. Default: 60
    position_y?: string;         // FFmpeg y expression. Default: "h*0.82"
    fade_in_sec?: number;        // Default: 0.5
    fade_out_sec?: number;       // Default: 0.5
    margin_bottom?: number;      // Gap between title and subtitle. Default: 8
  }

  export interface TextOverlayConfig {
    enabled: boolean;
    style?: TextOverlayStyle;
  }

  export interface SceneOverlayText {
    sceneId: string;
    title: string;       // Company/topic name (line 1)
    subtitle?: string;   // Description (line 2)
  }

  export interface VideoClipInfo {
    sceneId: string;
    file: string;
    duration_ms: number;
  }
  ```
- **ALSO**: Add `text_overlays?: TextOverlayConfig` to `ProjectConfig` interface (line 15, after `audio_mix`)
- **ALSO**: Add `overlay_title?: string` and `overlay_subtitle?: string` to both `SceneConfig` (line 86) and `SceneSegment` (line 78) interfaces
- **ALSO**: Extend `StepOutput` (line 100) to include optional `clips` field:
  ```typescript
  export interface StepOutput {
    file?: string;
    files?: Record<string, { file: string; duration_ms: number }>;
    clips?: VideoClipInfo[];  // Per-clip data for video step
    duration_ms?: number;
  }
  ```
- **ALSO**: Extend `VideoResult` (line 170) to include optional clips:
  ```typescript
  export interface VideoResult {
    file: string;
    duration_ms: number;
    clips?: VideoClipInfo[];
  }
  ```
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 2: UPDATE `pipeline/src/config/schema.ts` — Add Zod schema

- **IMPLEMENT**: Add Zod schemas matching the new types, BEFORE the `projectConfigSchema` definition (before line 94):
  ```typescript
  const textOverlayStyleSchema = z.object({
    font_file: z.string().optional(),
    title_font_size: z.number().default(44),
    subtitle_font_size: z.number().default(28),
    font_color: z.string().default("white"),
    subtitle_color: z.string().default("0xcccccc"),
    box_color: z.string().default("0x1a1a2e@0.75"),
    box_padding: z.number().default(14),
    position_x: z.number().default(60),
    position_y: z.string().default("h*0.82"),
    fade_in_sec: z.number().default(0.5),
    fade_out_sec: z.number().default(0.5),
    margin_bottom: z.number().default(8),
  });

  const textOverlaySchema = z.object({
    enabled: z.boolean().default(false),
    style: textOverlayStyleSchema.optional(),
  });
  ```
- **ALSO**: Add `text_overlays: textOverlaySchema.optional()` to the `projectConfigSchema` (line 94), after `audio_mix`
- **ALSO**: Add `overlay_title: z.string().optional()` and `overlay_subtitle: z.string().optional()` to both `sceneSegmentSchema` (line 76) and `sceneSchema` (line 84)
- **PATTERN**: Follow existing schema patterns (look at how `react_capture` inside `visualSchema` uses `.optional()`)
- **GOTCHA**: `ValidatedConfig` (line 109) is auto-inferred from Zod. Ensure the `ProjectConfig` interface in types.ts matches the Zod schema structure for `text_overlays`. They must be kept in sync manually.
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 3: UPDATE `pipeline/src/api/video-gen.ts` — Return per-clip data

- **IMPLEMENT**: Change the return type and value of `generateVideoClips()`:
  - Import `VideoClipInfo` from `../types.ts` (line 7)
  - Change the return statement (line 252) from:
    ```typescript
    return { file: outputFile, duration_ms: Math.round(probe.duration * 1000) };
    ```
    to:
    ```typescript
    return {
      file: outputFile,
      duration_ms: Math.round(probe.duration * 1000),
      clips: clips.map(c => ({ sceneId: c.sceneId, file: c.file, duration_ms: c.duration_ms })),
    };
    ```
  - The internal `VideoClip` interface (line 9) already has the same shape as `VideoClipInfo`, so the mapping is direct.
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 4: UPDATE `pipeline/src/core/pipeline.ts` — Store clip durations in state

- **IMPLEMENT**: In the video step (lines 206-259), store per-clip data in the state output:
  - Change the `state.markCompleted("video", ...)` calls (lines 212, 228, 243) to include clips data where available.
  - For `image-to-video` / `ai-generate` (line 220-231):
    ```typescript
    const result = await generateVideoClips(
      client,
      config.visual,
      config.scenes,
      sceneDurations,
      outputDir
    );
    videoFile = result.file;
    videoClips = result.clips || [];
    state.markCompleted("video", {
      file: result.file,
      duration_ms: result.duration_ms,
      clips: result.clips,
    });
    ```
  - Add `let videoClips: VideoClipInfo[] = [];` near line 204 (alongside `let videoFile = "";`)
  - When restoring from cached state (lines 256-259), also restore clips:
    ```typescript
    } else if (state.isCompleted("video")) {
      videoFile = state.get("video").outputs?.file || "";
      videoClips = state.get("video").outputs?.clips || [];
      logger.info("  VIDEO: using cached results");
    }
    ```
  - Import `VideoClipInfo` from `../types.ts`
- **ALSO**: Pass `videoClips` to the compose step (Task 6 handles the compose call update)
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 5: CREATE `pipeline/src/media/text-overlay.ts` — Core overlay logic

- **IMPLEMENT**: Three main functions:

**Function 1: `computeSceneTimeline()`**
```typescript
import type { VideoClipInfo, SceneConfig, SceneOverlayText, TextOverlayStyle } from "../types.ts";
import { logger } from "../core/logger.ts";

export interface SceneTimingEntry {
  sceneId: string;
  startSec: number;
  endSec: number;
  durationMs: number;
}

export function computeSceneTimeline(
  videoClips: VideoClipInfo[]
): SceneTimingEntry[]
```
- Iterate through video clips in order
- First clip starts at 0
- Each subsequent clip starts at previous clip's end (no gaps — video clips are concatenated directly via `ffmpegConcat` with no silence insertion)
- Clip end = start + (duration_ms / 1000)
- Return array of `{sceneId, startSec, endSec, durationMs}`

**IMPORTANT**: Unlike the audio track (which has 0.3s gaps between voiceovers), the video track is a direct concatenation of clips with NO gaps. The timing calculation must NOT add gap seconds.

**Function 2: `extractOverlayTexts()`**
```typescript
export function extractOverlayTexts(
  scenes: SceneConfig[]
): SceneOverlayText[]
```
- Flatten scenes (same pattern as tts.ts flattenScenes)
- For each scene/segment: use `overlay_title` if set, otherwise derive from `id` (e.g., "scene5a-vardhman" → "Vardhman Traders")
- Use `overlay_subtitle` if set, otherwise use first sentence of `script`
- Return array of `{sceneId, title, subtitle}`

**Function 3: `buildDrawtextFilter()`**
```typescript
export function buildDrawtextFilter(
  timeline: SceneTimingEntry[],
  overlayTexts: SceneOverlayText[],
  style: Required<TextOverlayStyle>
): string
```
- For each scene in timeline, find matching overlay text by sceneId
- Generate a drawtext filter string for the title line:
  - `drawtext=text='TITLE':fontfile='FONT':fontsize=44:fontcolor=white:box=1:boxcolor=0x1a1a2e@0.75:boxborderw=14:x=60:y=h*0.82:alpha='FADE_EXPR':enable='between(t,START,END)'`
- If subtitle exists, add a second drawtext filter with smaller font, positioned below title:
  - Same pattern but `fontsize=28`, `fontcolor=0xcccccc`, `y=h*0.82+TITLE_HEIGHT+MARGIN`
  - For subtitle y-position, use: `y=(h*0.82)+{title_font_size}+{margin_bottom}`
- Chain all filters with commas (`,` separator for `-vf` chain)
- **IMPORTANT**: Escape special characters in text AND font paths for FFmpeg drawtext:
  - Single quotes in text: replace `'` with `'\''` (FFmpeg escaping)
  - Colons in text: replace `:` with `\:` (FFmpeg filter escaping)
  - Backslashes: replace `\` with `\\`
  - Font path with spaces (e.g., `/System/Library/Fonts/Avenir Next.ttc`): the `fontfile` value uses single quotes in the filter string which handles spaces, but colons in the path must still be escaped
- Title text should appear 0.5s after scene starts (give voiceover a moment to begin)
- Title text should disappear 0.3s before scene ends (clean transition)

**Helper: `fadeAlphaExpr()`**
```typescript
function fadeAlphaExpr(startSec: number, endSec: number, fadeIn: number, fadeOut: number): string
```
- Returns FFmpeg alpha expression: ramps 0→1 over fadeIn seconds, holds at 1, ramps 1→0 over fadeOut seconds
- Expression: `if(lt(t,FI_START),0,if(lt(t,FI_END),(t-FI_START)/FI_DUR,if(lt(t,FO_START),1,if(lt(t,FO_END),(FO_END-t)/FO_DUR,0))))`
- Where: FI_START = startSec+0.5, FI_END = FI_START+fadeIn, FO_END = endSec-0.3, FO_START = FO_END-fadeOut

**Helper: `escapeDrawtext()`**
```typescript
function escapeDrawtext(text: string): string
```
- Escapes text for FFmpeg drawtext filter: backslashes, single quotes, colons

**Default font file**: `/System/Library/Fonts/Avenir Next.ttc` (clean professional font, available on all macOS)

- **IMPORTS**: `VideoClipInfo`, `SceneConfig`, `SceneOverlayText`, `TextOverlayStyle` from `../types.ts`
- **GOTCHA**: FFmpeg drawtext text value must escape single quotes, colons, and backslashes. Use the `escapeDrawtext` helper.
- **GOTCHA**: Font file path `/System/Library/Fonts/Avenir Next.ttc` contains a space. When building the filter string, wrap in single quotes: `fontfile='/System/Library/Fonts/Avenir Next.ttc'`. Colons in font paths also need escaping.
- **GOTCHA**: When timeline and overlayTexts arrays don't match (e.g., a scene has no overlay text), skip that scene's overlay gracefully with a `logger.warn()`.
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 6: UPDATE `pipeline/src/media/ffmpeg.ts` — Extend ffmpegMux

- **IMPLEMENT**: Add optional `videoFilter` parameter to `ffmpegMux()` (line 149):
  - Change the `options` type from `{ crf?: number; codec?: string }` to `{ crf?: number; codec?: string; videoFilter?: string }`
  - Insert the `-vf` args **after** the input args and **before** the codec args:
    ```typescript
    const args = ["-y", "-i", videoFile, "-i", audioFile];

    if (options?.videoFilter) {
      args.push("-vf", options.videoFilter);
    }

    args.push(
      "-c:v", "libx264",
      // ... rest unchanged
    );
    ```
- **PATTERN**: Existing `ffmpegMux()` at line 149. Minimal change — just add the optional `-vf` arg insertion.
- **GOTCHA**: The `-vf` flag must come BEFORE the codec args (`-c:v`) in the argument array. FFmpeg processes args left-to-right.
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 7: UPDATE `pipeline/src/media/video-composer.ts` — Add overlay support

- **IMPLEMENT**: Extend `composeVideo()` signature and logic:
  ```typescript
  import type { OutputConfig, SceneConfig, TextOverlayConfig, VideoClipInfo, TextOverlayStyle } from "../types.ts";
  import { computeSceneTimeline, extractOverlayTexts, buildDrawtextFilter } from "./text-overlay.ts";

  export interface ComposeOptions {
    scenes?: SceneConfig[];
    videoClips?: VideoClipInfo[];
    textOverlays?: TextOverlayConfig;
  }

  export async function composeVideo(
    videoFile: string,
    audioFile: string,
    outputConfig: OutputConfig,
    projectSlug: string,
    composeOpts?: ComposeOptions
  ): Promise<ComposedVideoResult>
  ```
- Inside the function, before calling `ffmpegMux`:
  1. Check if `composeOpts?.textOverlays?.enabled` is true AND `composeOpts.videoClips` and `composeOpts.scenes` are provided
  2. If yes:
     - Call `computeSceneTimeline(composeOpts.videoClips)` — note: NO gap parameter (video has no gaps)
     - Call `extractOverlayTexts(composeOpts.scenes)`
     - Merge provided style with defaults:
       ```typescript
       const defaultStyle: Required<TextOverlayStyle> = {
         font_file: "/System/Library/Fonts/Avenir Next.ttc",
         title_font_size: 44,
         subtitle_font_size: 28,
         font_color: "white",
         subtitle_color: "0xcccccc",
         box_color: "0x1a1a2e@0.75",
         box_padding: 14,
         position_x: 60,
         position_y: "h*0.82",
         fade_in_sec: 0.5,
         fade_out_sec: 0.5,
         margin_bottom: 8,
       };
       const style = { ...defaultStyle, ...composeOpts.textOverlays.style };
       ```
     - Call `buildDrawtextFilter(timeline, overlayTexts, style)`
     - Pass the resulting filter string to `ffmpegMux()` via `options.videoFilter`
     - Log: `logger.info(\`  Text overlays: ${timeline.length} drawtext filters applied\`)`
  3. If overlays not enabled, `ffmpegMux` is called without videoFilter (existing behavior unchanged)
- **IMPORTS**: Import from `./text-overlay.ts` and `../types.ts`
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 8: UPDATE `pipeline/src/core/pipeline.ts` — Pass video clip data to compose

- **IMPLEMENT**: At the compose step (around line 292), pass video clip durations:
  ```typescript
  const result = await composeVideo(
    videoFile,
    mixedAudioFile,
    config.output,
    config.project.slug,
    {
      scenes: config.scenes,
      videoClips: videoClips,
      textOverlays: config.text_overlays,
    }
  );
  ```
- **PATTERN**: Mirror the existing function call at line 292-297, just add the extra parameter
- **GOTCHA**: `config.text_overlays` comes from the Zod-validated config. The `ProjectConfig` interface must have `text_overlays?: TextOverlayConfig` (Task 1) and the Zod schema must have the matching schema (Task 2). The `ValidatedConfig` type is auto-inferred from Zod. Since `pipeline.ts` imports `ProjectConfig` for typing, ensure both are consistent.
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 9: UPDATE `pipeline/projects/education-power-team.yaml` — Add overlay config

- **IMPLEMENT**: Add `text_overlays` section after `audio_mix` (after line 59):
  ```yaml
  text_overlays:
    enabled: true
    style:
      font_file: "/System/Library/Fonts/Avenir Next.ttc"
      title_font_size: 44
      subtitle_font_size: 28
      font_color: "white"
      subtitle_color: "0xcccccc"
      box_color: "0x1a1a2e@0.75"
      box_padding: 14
      position_x: 60
      position_y: "h*0.82"
      fade_in_sec: 0.5
      fade_out_sec: 0.5
  ```
- **ALSO**: Add `overlay_title` and `overlay_subtitle` to each scene/segment. Place them right after the `id:` or `script:` field of each scene/segment:

  | Scene ID | overlay_title | overlay_subtitle |
  |----------|---------------|------------------|
  | scene1-hook | Education Power Team | Planning your educational institute? |
  | scene2-vision | The Vision | Building future-ready institutes |
  | scene3-modern | Modern Requirements | Smart classrooms, technology, sports & administration |
  | scene4-intro | Education Power Team | A complete 360-degree ecosystem |
  | scene5a-vardhman | Vardhman Traders | Classroom & laboratory infrastructure |
  | scene5b-megabyte | Mega Byte Systems | IT systems, networking & digital labs |
  | scene5c-acepower | Ace Power | Reliable power backup solutions |
  | scene5d-athletos | Athletos Sports Foundation | Sports infrastructure & training |
  | scene6a-aksolutions | A.K. Solutions | ERP & administration automation |
  | scene6b-rootsquare | Root Square LLP | Uniforms & stationery supply |
  | scene6c-ailacds | AI-LA-CDS | AI skills programs & learning platforms |
  | scene6d-asperia | Asperia Institute | Skill-based medical training |
  | scene7-foresight | Global Foresight | Career counseling & higher education |
  | scene8-final | Education Power Team | One powerful ecosystem for education |

- **VALIDATE**: `cd pipeline && npx tsx src/cli.ts status projects/education-power-team.yaml` (validates config loads)

### Task 10: Test — Re-run video step (for clip data) and compose step with overlays

- **IMPLEMENT**:
  1. Reset ONLY the `video` and `compose` steps in `.pipeline-state.json`:
     - Set `video.status` to `"pending"` (so clip durations get stored in state)
     - Set `compose.status` to `"pending"`
  2. **BUT** — the video step would regenerate all clips (expensive). Instead, since clips are cached on disk, the video step's caching logic will skip regeneration and just re-probe/re-concat. Verify this by checking that `video-gen.ts` checks `existsSync(clipFile)` before generating.
- **RUN**: `cd pipeline && npx tsx src/cli.ts resume projects/education-power-team.yaml --verbose`
- The pipeline should skip research/enhance/tts/music (cached), re-run video (to store clip data), skip mix_audio (cached), and re-run compose (with overlays)
- **VALIDATE**:
  - Output video should be at the path specified in pipeline state compose output
  - Use `ffprobe` to verify duration and resolution
  - Visually inspect: text should appear on each scene, fading in/out
  - Check that text timing aligns with video clip transitions (each clip is 8s, so overlays at 0s, 8s, 16s, etc.)
  - Verify `.pipeline-state.json` now has `clips` array in the video step output

---

## TESTING STRATEGY

No test framework is configured for this project. Validation is done via:

### Functional Tests
1. **TypeScript** — `cd pipeline && npx tsc --noEmit` must pass with zero errors
2. **Config load** — `cd pipeline && npx tsx src/cli.ts status projects/education-power-team.yaml` should not error
3. **Compose run** — Reset video+compose steps and run pipeline; verify output video has text overlays

### Edge Cases
- Scene with no `overlay_title` — should be skipped gracefully (no overlay for that scene)
- Scene with title but no subtitle — should render single-line overlay
- Very long title text — should not overflow video width (consider truncation or smaller font)
- `text_overlays.enabled: false` — should produce identical output to current (no overlays)
- Special characters in text (colons, quotes, ampersands) — must be escaped for FFmpeg
  - Specifically: "A.K. Solutions" has a period (safe), "AI-LA-CDS" has hyphens (safe)
- `text_overlays` section absent from YAML — should default to `enabled: false` via Zod `.optional()`
- Font file path with spaces — `/System/Library/Fonts/Avenir Next.ttc` must work

---

## VALIDATION COMMANDS

### Level 1: Syntax & Types
```bash
cd pipeline && npx tsc --noEmit
```
**Expected**: Exit code 0, no errors

### Level 2: Config Validation
```bash
cd pipeline && npx tsx src/cli.ts status projects/education-power-team.yaml
```
**Expected**: Prints pipeline status without errors, validates YAML config loads

### Level 3: Pipeline Test
```bash
# Reset video + compose steps, then resume (video clips are cached on disk, so re-run is fast)
cd pipeline && npx tsx src/cli.ts resume projects/education-power-team.yaml --verbose
```
**Expected**: Video step re-runs (probes cached clips, stores clip data), compose step runs with overlays. Other steps cached.

### Level 4: Visual Verification
```bash
# Check output video exists and has expected properties
ffprobe -v error -show_entries format=duration -show_entries stream=width,height -of json "$(cat /Users/jayakkumarkrishnasamy/Projects/Education-Power-Team/video/rendered/.pipeline-state.json | python3 -c 'import sys,json; print(json.load(sys.stdin)["steps"]["compose"]["outputs"]["file"])')"
```
**Expected**: Duration ~112s, resolution 1280x720

### Level 5: Clip Data Verification
```bash
# Verify per-clip data stored in pipeline state
python3 -c "
import json
state = json.load(open('/Users/jayakkumarkrishnasamy/Projects/Education-Power-Team/video/rendered/.pipeline-state.json'))
clips = state['steps']['video']['outputs'].get('clips', [])
print(f'Clips stored: {len(clips)}')
for c in clips:
    print(f'  {c[\"sceneId\"]}: {c[\"duration_ms\"]}ms')
"
```
**Expected**: 14 clips, each with sceneId and duration_ms (8000ms each)

---

## ACCEPTANCE CRITERIA

- [ ] `text_overlays` config section added to YAML schema and validated by Zod
- [ ] Per-scene `overlay_title` / `overlay_subtitle` fields supported in YAML
- [ ] Per-clip video durations stored in `.pipeline-state.json` during video step
- [ ] Text overlays appear on video at correct times matching **video clip boundaries** (not TTS durations)
- [ ] Title (line 1) and subtitle (line 2) render as two-line lower third
- [ ] Text fades in over 0.5s and fades out over 0.5s
- [ ] Semi-transparent background box behind text for readability
- [ ] `text_overlays.enabled: false` produces same output as before (backward compatible)
- [ ] Missing `text_overlays` section in YAML defaults to disabled (backward compatible)
- [ ] All 14 scenes have appropriate overlay text
- [ ] Special characters in text (colons, quotes) don't break FFmpeg
- [ ] Font path with spaces works correctly
- [ ] TypeScript compiles with zero errors
- [ ] Pipeline config loads without errors

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order (1-10)
- [ ] `cd pipeline && npx tsc --noEmit` passes
- [ ] `cd pipeline && npx tsx src/cli.ts status projects/education-power-team.yaml` passes
- [ ] Pipeline state has `clips` array in video step output
- [ ] Compose step re-run produces video with text overlays
- [ ] Text timing matches video clip transitions (0s, 8s, 16s, 24s, ...)
- [ ] Backward compatible when `text_overlays.enabled: false`
- [ ] Backward compatible when `text_overlays` section missing

---

## NOTES

### Design Decisions

1. **drawtext over pre-rendered images**: FFmpeg drawtext is simpler, faster, and doesn't require Node.js canvas dependencies. The reinstalled FFmpeg now has libfreetype support.

2. **Burn text during compose (not separate step)**: The compose step already re-encodes the video with libx264. Adding `-vf drawtext` to the same encode pass is essentially free — no extra decode/encode cycle.

3. **Per-scene overlay_title/overlay_subtitle in YAML**: Explicit text is better than auto-deriving from scene IDs. Gives full control over what's displayed. Falls back to auto-derivation if not set.

4. **Font choice**: Avenir Next (macOS system font) is clean and professional. For cross-platform, bundle a TTF file instead. Font file path is configurable.

5. **Video-based timing (Option B)**: Uses actual video clip durations stored in pipeline state, NOT TTS durations. This is critical because Veo clips are 8s each (112s total) while TTS audio is ~183s total. The `-shortest` flag truncates to video length, so overlay timing must match video frames.

6. **No gaps in video timeline**: Unlike the audio track (which inserts 0.3s silence between voiceover clips), the video track is a direct `ffmpegConcat` with no gaps. The `computeSceneTimeline()` function must NOT add gap seconds between clips.

### FFmpeg drawtext Escaping Rules
- Single quotes in text: replace `'` with `'\''`
- Colons in text: replace `:` with `\:`
- Backslashes: replace `\` with `\\`
- Since we use Node.js `spawn()` (not shell exec), we don't need shell escaping — only FFmpeg filter escaping
- Font file path with spaces: wrap in single quotes within the filter string

### Corrected Timing Reference (from video clip durations)

| Scene | Clip Duration | Video Start | Video End | Overlay Title |
|-------|--------------|-------------|-----------|---------------|
| scene1-hook | 8.0s | 0.0s | 8.0s | Education Power Team |
| scene2-vision | 8.0s | 8.0s | 16.0s | The Vision |
| scene3-modern | 8.0s | 16.0s | 24.0s | Modern Requirements |
| scene4-intro | 8.0s | 24.0s | 32.0s | Education Power Team |
| scene5a-vardhman | 8.0s | 32.0s | 40.0s | Vardhman Traders |
| scene5b-megabyte | 8.0s | 40.0s | 48.0s | Mega Byte Systems |
| scene5c-acepower | 8.0s | 48.0s | 56.0s | Ace Power |
| scene5d-athletos | 8.0s | 56.0s | 64.0s | Athletos Sports Foundation |
| scene6a-aksolutions | 8.0s | 64.0s | 72.0s | A.K. Solutions |
| scene6b-rootsquare | 8.0s | 72.0s | 80.0s | Root Square LLP |
| scene6c-ailacds | 8.0s | 80.0s | 88.0s | AI-LA-CDS |
| scene6d-asperia | 8.0s | 88.0s | 96.0s | Asperia Institute |
| scene7-foresight | 8.0s | 96.0s | 104.0s | Global Foresight |
| scene8-final | 8.0s | 104.0s | 112.0s | Education Power Team |

Total video duration: 112.0s (14 clips x 8.0s each, no gaps)
