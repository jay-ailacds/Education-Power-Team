# Feature: Text Overlays / Lower Thirds for Video Composition

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Add timed text overlays (lower thirds) to the video composition step, displaying business names, taglines, and scene titles synchronized with the voiceover. Each of the 14 video clips gets a text overlay identifying the company/topic being discussed, with professional fade-in/fade-out animations and semi-transparent background boxes.

## User Story

As a video producer
I want text overlays showing business names and descriptions on each video segment
So that viewers can identify which company/service is being presented at any moment

## Problem Statement

The current compose step (`video-composer.ts`) performs a bare mux of video + audio with no visual enhancements. The 14 AI-generated video clips play back-to-back with no text identifying which business or topic is being discussed. Viewers have no visual reference for the company names mentioned in the voiceover.

## Solution Statement

Extend the compose step to burn FFmpeg `drawtext` filters into the final video during the existing re-encode pass. Use TTS duration data to calculate per-scene timing, and scene metadata from the YAML config to extract display text. Each scene/segment gets a two-line lower third: line 1 = company/topic name (bold), line 2 = short description. Text fades in/out with a semi-transparent background box.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Medium
**Primary Systems Affected**: `video-composer.ts`, `ffmpeg.ts`, `pipeline.ts`, `types.ts`, `schema.ts`
**Dependencies**: FFmpeg with `drawtext` filter (libfreetype) — already installed via `homebrew-ffmpeg/ffmpeg`

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `pipeline/src/media/video-composer.ts` (all) — Current compose function that needs overlay support. Currently receives only videoFile, audioFile, outputConfig, projectSlug. Must be extended to accept overlay/scene data.

- `pipeline/src/media/ffmpeg.ts` (lines 149-172) — `ffmpegMux()` function that runs the final encode. Must be extended to accept an optional `-vf` filter string for drawtext overlays. Also see the filter chain pattern at lines 114-147 (`ffmpegMixAudio`) for how `filter_complex` is built.

- `pipeline/src/core/pipeline.ts` (lines 164-172) — Where `sceneDurations` map is built from TTS results. This is where timing data exists. Lines 286-313 are the compose step invocation — must pass scene metadata + timing here.

- `pipeline/src/types.ts` (all) — All shared interfaces. `SceneConfig`, `SceneSegment`, `TTSResult`, `OutputConfig` definitions. New `TextOverlayConfig` type goes here.

- `pipeline/src/config/schema.ts` (all) — Zod validation schemas for YAML config. Must add `text_overlays` section.

- `pipeline/src/api/tts.ts` (lines 13-25) — `flattenScenes()` function showing how scenes with segments are flattened to individual jobs. Same flattening logic needed for overlay text extraction.

- `pipeline/src/media/audio-mixer.ts` (lines 28-40) — Shows how gap timing works: silence gaps of `gap_between_scenes_seconds` (0.3s) are inserted between clips.

- `pipeline/projects/education-power-team.yaml` (all) — Current project config. Must add `text_overlays` section and per-scene `overlay_title` / `overlay_subtitle` fields.

### New Files to Create

- `pipeline/src/media/text-overlay.ts` — Text overlay builder: calculates timing from TTS data, generates FFmpeg drawtext filter chain string. Core logic module.

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

## IMPLEMENTATION PLAN

### Phase 1: Foundation — Types, Schema, Config

Add the text overlay configuration types, Zod schema, and YAML config section. This defines what users can configure.

### Phase 2: Core Logic — Timing Calculator + Filter Builder

Create `text-overlay.ts` with:
1. A function to compute per-scene start/end times from TTS durations + gaps
2. A function to extract display text from scene metadata (title + subtitle)
3. A function to build the FFmpeg `-vf` drawtext filter chain string

### Phase 3: Integration — Wire into Pipeline

1. Extend `ffmpegMux()` to accept an optional video filter string
2. Extend `composeVideo()` to accept scene data and build overlays
3. Pass scene metadata + TTS durations from `pipeline.ts` to the compose step

### Phase 4: Configuration — Update YAML

Add `text_overlays` config and per-scene overlay text to the education-power-team YAML.

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `pipeline/src/types.ts` — Add text overlay types

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
  ```
- **ALSO**: Add `text_overlays?: TextOverlayConfig` to `ProjectConfig` interface
- **ALSO**: Add `overlay_title?: string` and `overlay_subtitle?: string` to both `SceneConfig` and `SceneSegment` interfaces
- **VALIDATE**: `npx tsc --noEmit`

### Task 2: UPDATE `pipeline/src/config/schema.ts` — Add Zod schema

- **IMPLEMENT**: Add Zod schemas matching the new types:
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
  }).optional();

  const textOverlaySchema = z.object({
    enabled: z.boolean().default(false),
    style: textOverlayStyleSchema,
  }).optional();
  ```
- **ALSO**: Add `text_overlays: textOverlaySchema` to the main config schema
- **ALSO**: Add `overlay_title: z.string().optional()` and `overlay_subtitle: z.string().optional()` to both scene and segment schemas
- **PATTERN**: Follow existing schema patterns in the file (look at how `react_capture` schema was added)
- **VALIDATE**: `npx tsc --noEmit`

### Task 3: CREATE `pipeline/src/media/text-overlay.ts` — Core overlay logic

- **IMPLEMENT**: Three main functions:

**Function 1: `computeSceneTimeline()`**
```typescript
export interface SceneTimingEntry {
  sceneId: string;
  startSec: number;
  endSec: number;
  durationMs: number;
}

export function computeSceneTimeline(
  ttsResults: TTSResult[],
  gapSec: number
): SceneTimingEntry[]
```
- Iterate through TTS results in order
- First scene starts at 0
- Each subsequent scene starts at previous end + gapSec
- Scene end = start + (duration_ms / 1000)
- Return array of `{sceneId, startSec, endSec, durationMs}`

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
- For each scene in timeline, find matching overlay text
- Generate a drawtext filter string for the title line:
  - `drawtext=text='TITLE':fontfile='FONT':fontsize=44:fontcolor=white:box=1:boxcolor=0x1a1a2e@0.75:boxborderw=14:x=60:y=h*0.82:alpha='FADE_EXPR':enable='between(t,START,END)'`
- If subtitle exists, add a second drawtext filter with smaller font, positioned below title:
  - Same pattern but `fontsize=28`, `fontcolor=0xcccccc`, `y=h*0.82+TITLE_HEIGHT+MARGIN`
- Chain all filters with commas
- **IMPORTANT**: Escape special characters in text: single quotes (`'` → `'\\''`), colons (`:` → `\\:`), backslashes
- Title text should appear 0.5s after scene starts (give voiceover a moment to begin)
- Title text should disappear 0.3s before scene ends (clean transition)

**Helper: `fadeAlphaExpr()`**
```typescript
function fadeAlphaExpr(startSec: number, endSec: number, fadeIn: number, fadeOut: number): string
```
- Returns FFmpeg alpha expression: ramps 0→1 over fadeIn seconds, holds at 1, ramps 1→0 over fadeOut seconds
- Expression: `if(lt(t,FI_START),0,if(lt(t,FI_END),(t-FI_START)/FI_DUR,if(lt(t,FO_START),1,if(lt(t,FO_END),(FO_END-t)/FO_DUR,0))))`

**Default font file**: `/System/Library/Fonts/Avenir Next.ttc` (clean professional font, available on all macOS)

- **IMPORTS**: `TTSResult`, `SceneConfig`, `SceneOverlayText`, `TextOverlayStyle` from `../types.ts`
- **GOTCHA**: FFmpeg drawtext text value must escape single quotes, colons, and backslashes. Use a helper function for this.
- **GOTCHA**: When timeline and overlayTexts arrays don't match (e.g., a scene has no overlay text), skip that scene's overlay gracefully.
- **VALIDATE**: `npx tsc --noEmit`

### Task 4: UPDATE `pipeline/src/media/ffmpeg.ts` — Extend ffmpegMux

- **IMPLEMENT**: Add optional `videoFilter` parameter to `ffmpegMux()`:
  ```typescript
  export async function ffmpegMux(
    videoFile: string,
    audioFile: string,
    outputFile: string,
    options?: { crf?: number; codec?: string; videoFilter?: string }
  ): Promise<void> {
    const crf = options?.crf ?? 18;
    const args = ["-y", "-i", videoFile, "-i", audioFile];

    if (options?.videoFilter) {
      args.push("-vf", options.videoFilter);
    }

    args.push(
      "-c:v", "libx264",
      "-crf", String(crf),
      "-preset", "slow",
      "-c:a", "aac",
      "-b:a", "192k",
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-shortest",
      "-movflags", "+faststart",
      outputFile
    );

    await runCommand("ffmpeg", args);
  }
  ```
- **PATTERN**: Existing `ffmpegMux()` at line 149. Minimal change — just add the optional `-vf` arg insertion.
- **GOTCHA**: The `-vf` flag must come BEFORE the codec args (`-c:v`) in the argument array.
- **VALIDATE**: `npx tsc --noEmit`

### Task 5: UPDATE `pipeline/src/media/video-composer.ts` — Add overlay support

- **IMPLEMENT**: Extend `composeVideo()` signature and logic:
  ```typescript
  export interface ComposeOptions {
    scenes?: SceneConfig[];
    ttsResults?: TTSResult[];
    gapSec?: number;
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
  1. Check if `composeOpts?.textOverlays?.enabled` is true AND `composeOpts.scenes` and `composeOpts.ttsResults` are provided
  2. If yes: call `computeSceneTimeline()`, `extractOverlayTexts()`, `buildDrawtextFilter()`
  3. Pass the resulting filter string to `ffmpegMux()` via `options.videoFilter`
  4. Log: `logger.info("  Text overlays: 14 drawtext filters applied")`
- If overlays not enabled, `ffmpegMux` is called without videoFilter (existing behavior unchanged)
- **IMPORTS**: Import from `./text-overlay.ts`
- **VALIDATE**: `npx tsc --noEmit`

### Task 6: UPDATE `pipeline/src/core/pipeline.ts` — Pass data to compose

- **IMPLEMENT**: At the compose step (around line 292), pass scene data and TTS results:
  ```typescript
  const result = await composeVideo(
    videoFile,
    mixedAudioFile,
    config.output,
    config.project.slug,
    {
      scenes: config.scenes,
      ttsResults,
      gapSec: config.audio_mix.gap_between_scenes_seconds,
      textOverlays: config.text_overlays,
    }
  );
  ```
- **PATTERN**: Mirror the existing function call at line 292-297, just add the extra parameter
- **IMPORTS**: Add `ComposeOptions` import from `../media/video-composer.ts` if needed
- **VALIDATE**: `npx tsc --noEmit`

### Task 7: UPDATE `pipeline/projects/education-power-team.yaml` — Add overlay config

- **IMPLEMENT**: Add `text_overlays` section after `audio_mix`:
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
- **ALSO**: Add `overlay_title` and `overlay_subtitle` to each scene/segment:
  ```yaml
  # Scene 1
  overlay_title: "Education Power Team"
  overlay_subtitle: "Planning your educational institute?"

  # Scene 2
  overlay_title: "The Vision"
  overlay_subtitle: "Building future-ready institutes"

  # Scene 3
  overlay_title: "Modern Requirements"
  overlay_subtitle: "Smart classrooms, technology, sports & administration"

  # Scene 4
  overlay_title: "Education Power Team"
  overlay_subtitle: "A complete 360-degree ecosystem"

  # Scene 5a
  overlay_title: "Vardhman Traders"
  overlay_subtitle: "Classroom & laboratory infrastructure"

  # Scene 5b
  overlay_title: "Mega Byte Systems"
  overlay_subtitle: "IT systems, networking & digital labs"

  # Scene 5c
  overlay_title: "Ace Power"
  overlay_subtitle: "Reliable power backup solutions"

  # Scene 5d
  overlay_title: "Athletos Sports Foundation"
  overlay_subtitle: "Sports infrastructure & training"

  # Scene 6a
  overlay_title: "A.K. Solutions"
  overlay_subtitle: "ERP & administration automation"

  # Scene 6b
  overlay_title: "Root Square LLP"
  overlay_subtitle: "Uniforms & stationery supply"

  # Scene 6c
  overlay_title: "AI-LA-CDS"
  overlay_subtitle: "AI skills programs & learning platforms"

  # Scene 6d
  overlay_title: "Asperia Institute"
  overlay_subtitle: "Skill-based medical training"

  # Scene 7
  overlay_title: "Global Foresight"
  overlay_subtitle: "Career counseling & higher education"

  # Scene 8
  overlay_title: "Education Power Team"
  overlay_subtitle: "One powerful ecosystem for education"
  ```
- **VALIDATE**: `npx tsx src/cli.ts render projects/education-power-team.yaml --dry-run`

### Task 8: Test — Re-run compose step with overlays

- **IMPLEMENT**: Reset the compose step in `.pipeline-state.json` (set `compose.status` to `"pending"`)
- **RUN**: `npx tsx src/cli.ts resume projects/education-power-team.yaml --verbose`
- The pipeline should skip research/enhance/tts/music/video/mix_audio (all cached) and only re-run compose
- **VALIDATE**:
  - Output video should be at `/Users/jayakkumarkrishnasamy/Projects/video/rendered/education-power-team.mp4`
  - Use `ffprobe` to verify duration and resolution
  - Visually inspect: text should appear on each scene, fading in/out
  - Check that text timing aligns with voiceover (first text appears ~0.5s in)

---

## TESTING STRATEGY

No test framework is configured for this project. Validation is done via:

### Functional Tests
1. **Dry run** — `npx tsx src/cli.ts render projects/education-power-team.yaml --dry-run` should not error
2. **TypeScript** — `npx tsc --noEmit` must pass with zero errors
3. **Compose run** — Reset compose step and run pipeline; verify output video has text overlays

### Edge Cases
- Scene with no `overlay_title` — should be skipped gracefully (no overlay for that scene)
- Scene with title but no subtitle — should render single-line overlay
- Very long title text — should not overflow video width (consider truncation or smaller font)
- `text_overlays.enabled: false` — should produce identical output to current (no overlays)
- Special characters in text (colons, quotes, ampersands) — must be escaped for FFmpeg

---

## VALIDATION COMMANDS

### Level 1: Syntax & Types
```bash
cd pipeline && npx tsc --noEmit
```
**Expected**: Exit code 0, no errors

### Level 2: Config Validation
```bash
cd pipeline && npx tsx src/cli.ts render projects/education-power-team.yaml --dry-run
```
**Expected**: Prints pipeline plan without errors, validates YAML config

### Level 3: Full Pipeline Test
```bash
# Reset only the compose step, then resume
cd pipeline && npx tsx src/cli.ts resume projects/education-power-team.yaml --verbose
```
**Expected**: Only compose step runs (all others cached). Output video has text overlays.

### Level 4: Visual Verification
```bash
# Check output video exists and has expected properties
ffprobe -v error -show_entries format=duration -show_entries stream=width,height -of json /Users/jayakkumarkrishnasamy/Projects/video/rendered/education-power-team.mp4
```
**Expected**: Duration ~112s, resolution 1280x720 (or 1920x1080 if upscaled)

---

## ACCEPTANCE CRITERIA

- [ ] `text_overlays` config section added to YAML schema and validated by Zod
- [ ] Per-scene `overlay_title` / `overlay_subtitle` fields supported in YAML
- [ ] Text overlays appear on video at correct times matching voiceover
- [ ] Title (line 1) and subtitle (line 2) render as two-line lower third
- [ ] Text fades in over 0.5s and fades out over 0.5s
- [ ] Semi-transparent background box behind text for readability
- [ ] `text_overlays.enabled: false` produces same output as before (backward compatible)
- [ ] All 14 scenes have appropriate overlay text
- [ ] Special characters in text (colons, quotes) don't break FFmpeg
- [ ] TypeScript compiles with zero errors
- [ ] Pipeline dry run succeeds

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order (1-8)
- [ ] `npx tsc --noEmit` passes
- [ ] `npx tsx src/cli.ts render projects/education-power-team.yaml --dry-run` passes
- [ ] Compose step re-run produces video with text overlays
- [ ] Text timing matches voiceover
- [ ] Backward compatible when `text_overlays.enabled: false`

---

## NOTES

### Design Decisions

1. **drawtext over pre-rendered images**: FFmpeg drawtext is simpler, faster, and doesn't require Node.js canvas dependencies. The reinstalled FFmpeg now has libfreetype support.

2. **Burn text during compose (not separate step)**: The compose step already re-encodes the video with libx264. Adding `-vf drawtext` to the same encode pass is essentially free — no extra decode/encode cycle.

3. **Per-scene overlay_title/overlay_subtitle in YAML**: Explicit text is better than auto-deriving from scene IDs. Gives full control over what's displayed. Falls back to auto-derivation if not set.

4. **Font choice**: Avenir Next (macOS system font) is clean and professional. For cross-platform, bundle a TTF file instead. Font file path is configurable.

5. **Timing calculation**: Uses TTS durations (the actual voiceover length) + configured gap time to determine exactly when each text overlay appears/disappears. Title appears 0.5s after scene start (slight delay after voiceover begins), disappears 0.3s before scene end.

### FFmpeg drawtext Escaping Rules
- Single quotes in text: replace `'` with `'\\''`
- Colons in text: replace `:` with `\\:`
- Backslashes: replace `\` with `\\\\`
- Since we use Node.js `spawn()` (not shell exec), we don't need shell escaping — only FFmpeg filter escaping

### Timing Reference (from TTS data)

| Scene | Duration | Cumulative Start | Overlay Title |
|-------|----------|-----------------|---------------|
| scene1-hook | 12.8s | 0.0s | Education Power Team |
| scene2-vision | 17.4s | 13.1s | The Vision |
| scene3-modern | 16.3s | 30.8s | Modern Requirements |
| scene4-intro | 13.7s | 47.4s | Education Power Team |
| scene5a-vardhman | 15.1s | 61.4s | Vardhman Traders |
| scene5b-megabyte | 12.2s | 76.8s | Mega Byte Systems |
| scene5c-acepower | 8.3s | 89.3s | Ace Power |
| scene5d-athletos | 12.7s | 97.9s | Athletos Sports Foundation |
| scene6a-aksolutions | 12.8s | 110.9s | A.K. Solutions |
| scene6b-rootsquare | 11.5s | 124.0s | Root Square LLP |
| scene6c-ailacds | 16.1s | 135.8s | AI-LA-CDS |
| scene6d-asperia | 11.2s | 152.2s | Asperia Institute |
| scene7-foresight | 10.9s | 163.7s | Global Foresight |
| scene8-final | 8.4s | 174.9s | Education Power Team |

Gap between scenes: 0.3s
