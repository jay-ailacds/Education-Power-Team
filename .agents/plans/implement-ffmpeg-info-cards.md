# Feature: FFmpeg-Generated Info Cards (Zero Dependencies)

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Replace the `@napi-rs/canvas` slide generation in `slide-gen.ts` with pure FFmpeg-generated info cards using the `gradients` source filter for gradient backgrounds and `drawtext` filters for company name, key statistic, and tagline text. This eliminates the `@napi-rs/canvas` npm dependency entirely. Slide clips are generated directly as MP4 video (no intermediate PNG), with text fade-in/fade-out animations. The slides fill the 68s gap between video duration (112s) and audio duration (180s), so the full voiceover plays without truncation. Every partner gets a slide — no exceptions.

## User Story

As a video producer
I want branded info-card slides generated using only FFmpeg
So that the pipeline has zero additional npm dependencies while still producing professional-looking slides

## Problem Statement

The current `slide-gen.ts` uses `@napi-rs/canvas` to render PNG images, then converts them to video with `ffmpegImageToVideo()` (Ken Burns zoom). This works but introduces a platform-specific native dependency (`@napi-rs/canvas`) that can cause build/install issues. FFmpeg 8.0.1 (already installed) has `gradients` and `drawtext` filters that can generate the same visual output natively — gradient background + multi-layer text — directly as video, with animated text fades.

## Solution Statement

Rewrite `slide-gen.ts` to use a new `ffmpegGenerateSlide()` function (added to `ffmpeg.ts`) that generates slide clips directly via FFmpeg. The function uses:
- `gradients` source filter for diagonal gradient backgrounds
- Multiple `drawtext` filters for title, stat, and tagline text layers
- Alpha fade expressions (`alpha='if(lt(t,F),t/F,if(gt(t,D-F),(D-t)/F,1))'`) for smooth text transitions
- A `drawbox` filter for the accent line

No intermediate PNG files. No new npm dependencies. The rest of the pipeline (types, schema, state, pipeline orchestrator, interleaving, YAML config) is already wired up from the canvas-based implementation and only needs minor adjustments.

## Feature Metadata

**Feature Type**: Refactor (replace canvas with FFmpeg)
**Estimated Complexity**: Medium
**Primary Systems Affected**: `slide-gen.ts` (rewrite), `ffmpeg.ts` (add `ffmpegGenerateSlide`), `types.ts` (minor), `schema.ts` (minor)
**Dependencies**: FFmpeg 8.0+ with `gradients` filter and `drawtext` (libfreetype) — already installed

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `pipeline/src/media/slide-gen.ts` (all, 249 lines) — Current canvas-based implementation. **Rewrite this file**. Keep `extractSlideContents()`, `calculateSlideDurations()`, `DEFAULT_SLIDE_STYLE`, `SlideTimingEntry`, `deriveTitle()`, `firstSentence()` — they are independent of rendering. Replace `renderSlideImage()` call + `ffmpegImageToVideo()` call with single `ffmpegGenerateSlide()` call. Remove `@napi-rs/canvas` import and `GlobalFonts` usage.

- `pipeline/src/media/ffmpeg.ts` (all, 271 lines) — FFmpeg subprocess wrappers. `runCommand()` at line 246 uses `spawn()` (no shell). Must add `ffmpegGenerateSlide()` function. Existing `ffmpegImageToVideo()` (line 211) can be kept for other use cases but is no longer needed by slides.

- `pipeline/src/types.ts` (all, 225 lines) — Already has `SlideStyle`, `SlideConfig`, `SlideContent`, `VideoClipInfo`, `SlideResult`. `SlideStyle` needs minor updates: remove `ken_burns_zoom`, add `fade_duration_sec`. `SlideResult.imageFile` changes to optional (no PNG generated).

- `pipeline/src/config/schema.ts` (all, 138 lines) — Already has `slideStyleSchema`, `slideConfigSchema`. Mirror type changes: remove `ken_burns_zoom`, add `fade_duration_sec`.

- `pipeline/src/core/pipeline.ts` (all, 427 lines) — Already has slides step wired up (lines 266-311). **No changes needed** — it calls `generateAllSlides()` which we're rewriting internally.

- `pipeline/src/api/video-gen.ts` (all, 306 lines) — Already has `interleaveClipsWithSlides()`. **No changes needed**.

- `pipeline/src/core/state.ts` — Already has `"slides"` in `STEP_ORDER`. **No changes needed**.

- `pipeline/projects/education-power-team.yaml` — Already has `slides:` config and per-scene `slide_title/stat/tagline`. **No changes needed** (except removing `ken_burns_zoom` if present).

### New Files to Create

None — all changes are to existing files.

### FFmpeg Capabilities (Verified)

FFmpeg 8.0.1 on this machine has:
- `gradients` source filter: `gradients=s=1280x720:d=5:r=24:c0=0x1a1a2eff:c1=0x0f3460ff:speed=0:type=linear`
- `drawtext` filter with libfreetype: font file, fontsize, fontcolor with alpha, x/y positioning, alpha expressions
- `drawbox` filter for accent lines

Test command (verified working):
```bash
ffmpeg -y -f lavfi \
  -i "gradients=s=1280x720:d=3:r=24:c0=0x1a1a2eff:c1=0x0f3460ff:x0=0:y0=0:x1=1280:y1=720:speed=0:type=linear" \
  -vf "drawtext=fontfile=/System/Library/Fonts/Avenir Next.ttc:text='Test Title':fontsize=54:fontcolor=white:x=(w-text_w)/2:y=h*0.40-text_h/2" \
  -c:v libx264 -pix_fmt yuv420p -t 3 /tmp/test-slide.mp4
```
Output: 1280x720, 24fps, 3.0s, h264 — matches Veo clip specs exactly.

### FFmpeg Escaping Rules (Critical)

When building filter strings in Node.js with `spawn()` (no shell):
- **No shell escaping needed** — `spawn()` passes args directly
- **FFmpeg filter escaping IS needed**:
  - Commas in expressions: use `\\,` (e.g., `if(lt(t\\,0.5)\\,t/0.5\\,1)`)
  - Colons in text: use `\\:` (e.g., `text='24/7\\: Always On'`)
  - Percent signs: use `%%`
  - Single quotes in text: use `'\\''` or avoid them
  - Backslashes: use `\\\\`

### Patterns to Follow

**FFmpeg function pattern** (from `ffmpeg.ts`):
```typescript
export async function ffmpegSomething(input: string, output: string, options: {...}): Promise<void> {
  const args = ["-y", ...];
  await runCommand("ffmpeg", args);
}
```

**Slide generation orchestration** (from current `slide-gen.ts`):
```typescript
// Keep this pattern — only change the rendering call
for (const timing of timings) {
  if (timing.slideDurationSec <= 0) continue;
  // Cache check...
  // OLD: renderSlideImage() + ffmpegImageToVideo()
  // NEW: ffmpegGenerateSlide()
}
```

**Naming**: camelCase functions/variables, PascalCase types, kebab-case files.
**Errors**: `(err as Error).message`, `logger.warn` non-fatal, `throw` fatal.
**Logger**: `logger.step("TAG", msg)` major, `logger.info()` detail, `logger.debug()` verbose.

---

## CRITICAL TIMING DESIGN

### Duration Mismatch (unchanged from canvas plan)

| Component | Duration | Detail |
|-----------|----------|--------|
| 14 Veo clips | **112.0s** | 8.0s each, 1280x720 @ 24fps |
| Mixed audio | **180.3s** | TTS (170.2s) + gaps (3.9s) + music buffer |
| Gap to fill | **~68.3s** | Slide clips fill this |

### Per-Scene Slide Duration Table

| Scene | TTS (s) | Gap (s) | Scene Total (s) | Veo (s) | Slide (s) | Layout |
|-------|---------|---------|-----------------|---------|-----------|--------|
| scene1-hook | 12.8 | 0.3 | 13.1 | 8.0 | **5.1** | full |
| scene2-vision | 17.4 | 0.3 | 17.7 | 8.0 | **9.7** | full |
| scene3-modern | 16.3 | 0.3 | 16.6 | 8.0 | **8.6** | full |
| scene4-intro | 13.7 | 0.3 | 14.0 | 8.0 | **6.0** | full |
| scene5a-vardhman | 15.1 | 0.3 | 15.4 | 8.0 | **7.4** | full |
| scene5b-megabyte | 12.2 | 0.3 | 12.5 | 8.0 | **4.5** | full |
| scene5c-acepower | 8.3 | 0.3 | 8.6 | 8.0 | **0.6** | title-only |
| scene5d-athletos | 12.7 | 0.3 | 13.0 | 8.0 | **5.0** | full |
| scene6a-aksolutions | 12.8 | 0.3 | 13.1 | 8.0 | **5.1** | full |
| scene6b-rootsquare | 11.5 | 0.3 | 11.8 | 8.0 | **3.8** | full |
| scene6c-ailacds | 16.1 | 0.3 | 16.4 | 8.0 | **8.4** | full |
| scene6d-asperia | 11.2 | 0.3 | 11.5 | 8.0 | **3.5** | full |
| scene7-foresight | 10.9 | 0.3 | 11.2 | 8.0 | **3.2** | full |
| scene8-final | 8.4 | 0.0 | 8.4 | 8.0 | **0.4** | title-only |
| **TOTALS** | **179.4** | **3.9** | **183.3** | **112.0** | **71.3** | |

Short slides (under 2.0s): scene5c-acepower (0.6s) and scene8-final (0.4s) use **title-only** layout.

---

## IMPLEMENTATION PLAN

### Phase 1: Type & Schema Updates (minor)

Remove `ken_burns_zoom` from `SlideStyle`, add `fade_duration_sec`. Make `SlideResult.imageFile` optional. Update Zod schema to match.

### Phase 2: FFmpeg Slide Generator

Add `ffmpegGenerateSlide()` to `ffmpeg.ts` — builds gradient background + drawtext filters, outputs MP4 directly.

### Phase 3: Rewrite slide-gen.ts

Remove `@napi-rs/canvas` dependency. Replace `renderSlideImage()` + `ffmpegImageToVideo()` with `ffmpegGenerateSlide()`. Keep all timing/content extraction logic unchanged.

### Phase 4: Cleanup

Remove `@napi-rs/canvas` from `package.json`. Remove `ffmpegImageToVideo()` if no longer used elsewhere.

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `pipeline/src/types.ts` — Adjust SlideStyle for FFmpeg approach

- **IMPLEMENT**: In `SlideStyle` interface (line 131):
  - Remove `ken_burns_zoom?: number;` (line 145)
  - Add `fade_duration_sec?: number;` — controls text fade-in/out duration. Default: 0.4
  - Make `imageFile` optional in `SlideResult` (line 167): change to `imageFile?: string;`
- **PATTERN**: Follow existing optional field pattern with `?`
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 2: UPDATE `pipeline/src/config/schema.ts` — Mirror type changes

- **IMPLEMENT**: In `slideStyleSchema` (line 100):
  - Remove `ken_burns_zoom` line (line 114)
  - Add: `fade_duration_sec: z.number().min(0).max(2).default(0.4),`
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 3: UPDATE `pipeline/src/media/ffmpeg.ts` — Add `ffmpegGenerateSlide()`

This is the core new function. It generates a slide clip directly from FFmpeg filters — no intermediate image.

- **IMPLEMENT**: Add these helper types and functions after `ffmpegConvertWebm()` (after line 209), before `ffmpegImageToVideo()`:

```typescript
// ─── Slide generation via FFmpeg filters ───

export interface SlideTextLayer {
  text: string;
  fontFile: string;
  fontSize: number;
  fontColor: string;    // hex like "#ffffff"
  yPosition: string;    // FFmpeg expression like "h*0.40-text_h/2"
  bold?: boolean;
}

export interface SlideGenerateOptions {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  gradientColors: [string, string]; // Two hex colors for diagonal gradient
  textLayers: SlideTextLayer[];
  accentLine?: {
    color: string;      // hex
    yPosition: number;  // fraction 0-1 (e.g., 0.55)
    widthFraction: number; // fraction of video width (e.g., 0.4)
    thickness: number;  // pixels
  };
  fadeDurationSec: number; // text fade-in/out duration
}

function hexToFfmpegColor(hex: string): string {
  // "#1a1a2e" → "0x1a1a2eff" (with full alpha)
  const clean = hex.replace("#", "");
  return `0x${clean}ff`;
}

function escapeDrawtext(text: string): string {
  // Escape special characters for FFmpeg drawtext filter
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\u2019")  // Replace single quotes with unicode right quote
    .replace(/%/g, "%%");
}

function fadeAlphaExpr(fadeSec: number, totalSec: number): string {
  // Returns FFmpeg expression: fade in over fadeSec, hold, fade out over fadeSec
  // if(lt(t,F),t/F,if(gt(t,D-F),(D-t)/F,1))
  if (fadeSec <= 0 || totalSec <= fadeSec * 2) return "1"; // No fade for very short clips
  const F = fadeSec.toFixed(2);
  const D = totalSec.toFixed(2);
  return `if(lt(t\\,${F})\\,t/${F}\\,if(gt(t\\,${D}-${F})\\,(${D}-t)/${F}\\,1))`;
}

export async function ffmpegGenerateSlide(
  outputFile: string,
  options: SlideGenerateOptions
): Promise<void> {
  const { durationSec, width, height, fps, gradientColors, textLayers, accentLine, fadeDurationSec } = options;

  const c0 = hexToFfmpegColor(gradientColors[0]);
  const c1 = hexToFfmpegColor(gradientColors[1]);

  // Build the gradients source
  const gradientInput = `gradients=s=${width}x${height}:d=${durationSec}:r=${fps}:c0=${c0}:c1=${c1}:x0=0:y0=0:x1=${width}:y1=${height}:speed=0:type=linear`;

  // Build video filter chain
  const filters: string[] = [];

  // Accent line (drawbox)
  if (accentLine) {
    const boxY = Math.round(height * accentLine.yPosition);
    const boxW = Math.round(width * accentLine.widthFraction);
    const boxX = Math.round((width - boxW) / 2);
    const boxColor = hexToFfmpegColor(accentLine.color);
    filters.push(`drawbox=x=${boxX}:y=${boxY}:w=${boxW}:h=${accentLine.thickness}:color=${boxColor}:t=fill`);
  }

  // Text layers with fade
  const alphaExpr = fadeAlphaExpr(fadeDurationSec, durationSec);
  for (const layer of textLayers) {
    const escaped = escapeDrawtext(layer.text);
    const color = layer.fontColor.replace("#", "");
    // Use alpha expression for fade effect
    const fontColorWithAlpha = `fontcolor_expr=0x${color}%{eif\\:clip(255*${alphaExpr}\\,0\\,255)\\:x\\:2}`;
    const dt = [
      `drawtext=fontfile='${layer.fontFile}'`,
      `text='${escaped}'`,
      `fontsize=${layer.fontSize}`,
      fontColorWithAlpha,
      `x=(w-text_w)/2`,
      `y=${layer.yPosition}`,
    ].join(":");
    filters.push(dt);
  }

  const vf = filters.length > 0 ? filters.join(",") : undefined;

  const args = [
    "-y",
    "-f", "lavfi",
    "-i", gradientInput,
  ];

  if (vf) {
    args.push("-vf", vf);
  }

  args.push(
    "-c:v", "libx264",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-t", String(durationSec),
    outputFile
  );

  await runCommand("ffmpeg", args);
}
```

- **GOTCHA**: FFmpeg filter escaping is the trickiest part. The `escapeDrawtext()` function handles text-level escaping. The `fadeAlphaExpr()` uses `\\,` to escape commas within the expression (commas are FFmpeg's filter separator). The `fontcolor_expr` approach allows animated alpha without a separate `alpha` parameter.
- **GOTCHA**: `gradients` filter requires FFmpeg 8.0+. Verify with `ffmpeg -filters 2>&1 | grep gradients`.
- **GOTCHA**: If `fontcolor_expr` with `%{eif}` proves unreliable, fall back to static `fontcolor` (no fade) — the slides still work, just without the polish.
- **ALTERNATIVE APPROACH**: If `fontcolor_expr` with eif expressions is too complex or fragile, use a simpler approach: static fontcolor (no fade animation). The gradient background + text is already visually effective without fades. Start with the simple approach and add fades later if desired.
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 4: REWRITE `pipeline/src/media/slide-gen.ts` — Replace canvas with FFmpeg

- **IMPLEMENT**: Complete rewrite. Keep these unchanged:
  - `DEFAULT_SLIDE_STYLE` (update to remove `ken_burns_zoom`, add `fade_duration_sec: 0.4`)
  - `extractSlideContents()` (lines 90-112)
  - `deriveTitle()` (lines 114-119)
  - `firstSentence()` (lines 121-124)
  - `SlideTimingEntry` interface (lines 126-132)
  - `calculateSlideDurations()` (lines 134-166)
  - `generateAllSlides()` signature (keep same interface)

  **Replace**:
  - Remove `import { createCanvas, GlobalFonts } from "@napi-rs/canvas";`
  - Remove `import { writeFileSync, ... }` (keep `mkdirSync`, `existsSync` from "node:fs")
  - Remove `import { ffmpegImageToVideo, ffprobe }` → change to `import { ffmpegGenerateSlide, ffprobe } from "./ffmpeg.ts";`
  - Remove `renderSlideImage()` function entirely
  - Remove `GlobalFonts.registerFromPath()` call in `generateAllSlides()`

  **In `generateAllSlides()` loop**, replace the render+convert calls with:
  ```typescript
  // Build text layers based on content and layout
  const textLayers: SlideTextLayer[] = [];

  if (timing.titleOnly) {
    // Title-only: large centered company name
    textLayers.push({
      text: content.title,
      fontFile: style.font_path,
      fontSize: Math.round(style.title_font_size * 1.2),
      fontColor: style.title_color,
      yPosition: "h*0.50-text_h/2",
    });
  } else {
    // Full layout: title + optional stat + optional tagline
    textLayers.push({
      text: content.title,
      fontFile: style.font_path,
      fontSize: style.title_font_size,
      fontColor: style.title_color,
      yPosition: "h*0.40-text_h/2",
    });
    if (content.stat) {
      textLayers.push({
        text: content.stat,
        fontFile: style.font_path,
        fontSize: style.stat_font_size,
        fontColor: style.stat_color,
        yPosition: "h*0.62-text_h/2",
      });
    }
    if (content.tagline) {
      textLayers.push({
        text: content.tagline,
        fontFile: style.font_path,
        fontSize: style.tagline_font_size,
        fontColor: style.tagline_color,
        yPosition: "h*0.75-text_h/2",
      });
    }
  }

  // Accent line (only for full layout)
  const accentLine = timing.titleOnly ? undefined : {
    color: style.accent_line_color,
    yPosition: 0.55,
    widthFraction: 0.4,
    thickness: 4,
  };

  // Pick two gradient colors (first and last from the array)
  const gradientColors: [string, string] = [
    style.background_gradient[0] || "#1a1a2e",
    style.background_gradient[style.background_gradient.length - 1] || "#0f3460",
  ];

  await ffmpegGenerateSlide(videoPath, {
    durationSec: timing.slideDurationSec,
    width: 1280,
    height: 720,
    fps: 24,
    gradientColors,
    textLayers,
    accentLine,
    fadeDurationSec: style.fade_duration_sec ?? 0.4,
  });
  ```

  Also update the results push — `imageFile` is now optional, set to `undefined`:
  ```typescript
  results.push({
    sceneId: timing.sceneId,
    videoFile: videoPath,
    duration_ms: Math.round(probe.duration * 1000),
  });
  ```

  Remove `imageDir` creation since no PNGs are generated. Keep `clipDir`.

- **IMPORTS**:
  ```typescript
  import { mkdirSync, existsSync } from "node:fs";
  import { join } from "node:path";
  import { ffmpegGenerateSlide, ffprobe, type SlideTextLayer } from "./ffmpeg.ts";
  import { logger } from "../core/logger.ts";
  import type {
    SceneConfig, SlideStyle, SlideContent, SlideResult,
    VideoClipInfo, TTSResult,
  } from "../types.ts";
  ```

- **GOTCHA**: The `ffmpegGenerateSlide` uses the `gradients` filter which only accepts TWO colors (c0 and c1). The YAML config has 3 gradient colors. Use first and last for the diagonal gradient. If a 3-stop gradient is important in the future, the middle color can be approximated by overlaying a semi-transparent drawbox or ignored.
- **GOTCHA**: Font path must be valid. The default (`/System/Library/Fonts/Avenir Next.ttc`) is macOS-specific. For cross-platform, add a font existence check and fall back to a system default.
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 5: REMOVE `@napi-rs/canvas` dependency

- **RUN**: `cd pipeline && npm uninstall @napi-rs/canvas`
- **VALIDATE**: `cd pipeline && npx tsc --noEmit` (ensure no remaining imports)
- **GOTCHA**: If `@napi-rs/canvas` isn't installed yet (plan wasn't executed), this is a no-op — just verify it's not in `package.json`.

### Task 6: UPDATE `pipeline/projects/education-power-team.yaml` — Remove ken_burns_zoom if present

- **IMPLEMENT**: In the `slides.style` section, remove `ken_burns_zoom: 1.08` if present. Optionally add `fade_duration_sec: 0.4`.
- **VALIDATE**: `cd pipeline && npx tsx src/cli.ts status projects/education-power-team.yaml`

### Task 7: UPDATE `pipeline/src/media/slide-gen.ts` DEFAULT_SLIDE_STYLE — Sync with type changes

- **IMPLEMENT**: In `DEFAULT_SLIDE_STYLE` constant:
  - Remove `ken_burns_zoom: 1.08`
  - Add `fade_duration_sec: 0.4`
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

### Task 8: Test — Verify FFmpeg slide generation works

- **IMPLEMENT**:
  1. Reset `slides` and `compose` steps in `.pipeline-state.json` to `"pending"`:
     ```bash
     cd /Users/jayakkumarkrishnasamy/Projects/Education-Power-Team && node -e "
     const fs = require('fs');
     const state = JSON.parse(fs.readFileSync('video/rendered/.pipeline-state.json', 'utf-8'));
     state.steps.slides = { status: 'pending' };
     state.steps.compose = { status: 'pending' };
     fs.writeFileSync('video/rendered/.pipeline-state.json', JSON.stringify(state, null, 2));
     console.log('Reset slides, compose to pending');
     "
     ```
  2. Run: `cd pipeline && npx tsx src/cli.ts resume projects/education-power-team.yaml --verbose`
  3. The pipeline should:
     - Skip research/enhance/tts/music/video (cached)
     - Run slides (generate 14 slide MP4 clips via FFmpeg)
     - Re-run compose (mux interleaved video + audio)

- **VALIDATE**:
  - Check `slides/clips/` has 14 MP4 files (no partner skipped)
  - No `slides/images/` directory needed (no PNGs)
  - Verify each slide clip matches Veo specs:
    ```bash
    ffprobe -v error -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of json \
      /Users/jayakkumarkrishnasamy/Projects/Education-Power-Team/video/rendered/slides/clips/scene5a-vardhman.mp4
    ```
    Expected: 1280x720 @ 24fps, ~7.4s
  - Verify combined video duration:
    ```bash
    ffprobe -v error -show_entries format=duration -of csv=p=0 \
      /Users/jayakkumarkrishnasamy/Projects/Education-Power-Team/video/rendered/video/raw/combined.mp4
    ```
    Expected: ~183s (not 112s)
  - Verify final output: duration ~180s, full voiceover audible
  - Visually inspect: gradient background with centered text, text fades in/out

### Task 9: Cleanup — Remove unused ffmpegImageToVideo if no longer needed

- **IMPLEMENT**: Check if `ffmpegImageToVideo()` (ffmpeg.ts line 211) is imported/used anywhere else:
  ```bash
  grep -r "ffmpegImageToVideo" pipeline/src/
  ```
  If only referenced in old slide-gen.ts (which we rewrote), remove it from `ffmpeg.ts`.
- **VALIDATE**: `cd pipeline && npx tsc --noEmit`

---

## TESTING STRATEGY

No test framework configured. Validation via:

### Functional Tests
1. **TypeScript**: `cd pipeline && npx tsc --noEmit` — zero errors
2. **Config load**: `cd pipeline && npx tsx src/cli.ts status projects/education-power-team.yaml` — no errors
3. **Single slide**: Generate one slide clip and verify with ffprobe (correct duration, 1280x720, 24fps, h264)
4. **All slides**: Full slides step generates 14 clips (12 full + 2 title-only)
5. **Interleaving**: Combined video duration matches audio (~183s)
6. **Full pipeline**: Compose step produces final video matching audio duration

### Edge Cases
- Scene with no `slide_title` — should use auto-derived title from scene ID
- Scene with title but no stat — renders title + tagline only
- Very short slide (0.4s, 0.6s) — title-only layout, minimal/no fade
- `slides.enabled: false` — same output as before (backward compatible)
- `slides` section absent from YAML — defaults to disabled
- Special characters in text (colons, apostrophes) — properly escaped for drawtext
- Font file not found — should fail with clear error

---

## VALIDATION COMMANDS

### Level 1: Syntax & Types
```bash
cd pipeline && npx tsc --noEmit
```
**Expected**: Exit 0, no errors

### Level 2: FFmpeg Capability Check
```bash
ffmpeg -filters 2>&1 | grep gradients
ffmpeg -filters 2>&1 | grep drawtext
```
**Expected**: Both filters listed

### Level 3: Config
```bash
cd pipeline && npx tsx src/cli.ts status projects/education-power-team.yaml
```
**Expected**: Shows all steps including `slides`

### Level 4: Pipeline Run
```bash
cd pipeline && npx tsx src/cli.ts resume projects/education-power-team.yaml --verbose
```
**Expected**: Slides step generates 14 clips, interleaves, produces ~183s combined video

### Level 5: Slide Clip Verification
```bash
for f in /Users/jayakkumarkrishnasamy/Projects/Education-Power-Team/video/rendered/slides/clips/*.mp4; do
  name=$(basename "$f" .mp4)
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  res=$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$f" | head -1)
  echo "$name: ${dur}s ${res}"
done
```
**Expected**: 14 clips, each 1280x720, durations matching timing table

### Level 6: No Canvas Dependency
```bash
cd pipeline && grep -r "napi-rs/canvas" src/ package.json
```
**Expected**: No matches

---

## ACCEPTANCE CRITERIA

- [ ] `@napi-rs/canvas` removed from dependencies (or never added)
- [ ] `slides` step generates video clips using only FFmpeg (no intermediate PNGs)
- [ ] All 14 slide clips generated (12 full layout + 2 title-only, no partner skipped)
- [ ] Slide clips are 1280x720 @ 24fps h264 (matching Veo clips for codec-copy concat)
- [ ] Gradient background with centered text is visually acceptable
- [ ] Combined video duration matches audio (~183s, not 112s)
- [ ] Full voiceover is audible in final output (no truncation)
- [ ] `slides.enabled: false` produces same output as before (backward compatible)
- [ ] Special characters in text (colons, apostrophes) render correctly
- [ ] Slide caching works (re-run skips existing clips)
- [ ] TypeScript compiles with zero errors
- [ ] No new npm dependencies added

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order (1-9)
- [ ] `cd pipeline && npx tsc --noEmit` passes
- [ ] `cd pipeline && npx tsx src/cli.ts status projects/education-power-team.yaml` passes
- [ ] `grep -r "napi-rs/canvas" pipeline/` returns nothing
- [ ] Combined video ~183s (was 112s)
- [ ] Final output ~180s with full audio
- [ ] All 14 slide clips generated (no partner skipped)
- [ ] Backward compatible when disabled

---

## NOTES

### Design Decisions

1. **FFmpeg-only vs canvas**: The `gradients` source filter + `drawtext` produces the same visual output as canvas rendering but eliminates a platform-specific native dependency. The trade-off is slightly less control over text layout (no multi-line wrapping, no precise kerning) and more complex escaping logic. For the current use case (short text lines, centered layout), FFmpeg is sufficient.

2. **`gradients` filter (2 colors) vs 3-stop gradient**: The YAML config specifies 3 gradient colors but `gradients` only supports 2 endpoints. We use the first and last colors for the diagonal gradient. The middle color is visually approximated. This is acceptable for branded slides.

3. **Text fade via `fontcolor_expr`**: The `fontcolor_expr` approach embeds alpha animation directly in the color expression. This is more reliable than a separate `alpha` filter parameter which applies to the entire frame. However, if the `%{eif}` expression syntax proves problematic, fall back to static colors (no animation) — the slides are still effective.

4. **No intermediate PNG**: Generating video directly from FFmpeg source filters is faster than render-PNG-then-convert. One FFmpeg process per slide instead of two (canvas+ffmpeg). Also eliminates disk I/O for temporary PNGs.

5. **Title-only for short slides**: scene5c-acepower (0.6s) and scene8-final (0.4s) use a simpler layout with just the company name in a larger font. For these ultra-short durations, text fade is disabled (the `fadeAlphaExpr` returns "1" when duration < 2 * fadeDuration). Every partner gets a slide.

6. **Escaping strategy**: FFmpeg filter escaping is the most error-prone part. The `escapeDrawtext()` function handles the common cases. If a text value contains truly exotic characters, the worst case is a rendering glitch (not a crash), since `spawn()` prevents shell injection.

### Slide Visual Design (same as canvas plan)

```
+---------------------------------------------------+
|                                                     |  Gradient background
|                                                     |  #1a1a2e -> #0f3460
|           Vardhman Traders                          |  (diagonal)
|                                                     |
|    -----------------------------------------        |  Accent line (#00d4ff)
|                                                     |
|       95% agree facilities boost                    |  Stat text (#00d4ff)
|            performance                              |
|                                                     |
|      Classroom & laboratory                         |  Tagline (#cccccc)
|          infrastructure                             |
|                                                     |
+---------------------------------------------------+
```

### Confidence Score: 8/10

Higher than the canvas plan (7/10) because:
- Zero new dependencies (no install/build issues)
- FFmpeg `gradients` + `drawtext` verified working on this machine
- Pipeline integration already wired (types, schema, state, pipeline.ts, video-gen.ts)
- Only 2 files need significant changes (ffmpeg.ts + slide-gen.ts)

Risks:
- `fontcolor_expr` with `%{eif}` may not work in all FFmpeg builds → fallback: static colors
- Complex text escaping edge cases (rare characters in company names)
- `gradients` filter only available in FFmpeg 8.0+ (machine has 8.0.1, verified)
