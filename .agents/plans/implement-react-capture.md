# Feature: React Capture — Per-Segment Automated Browser Recording for Video Pipeline

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files.

## Feature Description

Implement the `react-capture` visual source option in the video pipeline with **per-segment granularity**. This automates recording of individual React/Framer Motion animated scenes from `client/` using Playwright's built-in video capture. Each segment is captured as a separate MP4 clip — producing **14 individual clips** (matching `video-gen.ts`'s output) — enabling per-segment caching, selective re-recording, and segment-level editing.

Currently `react-capture` throws an error — this plan makes it fully functional with segment-level capture.

## User Story

As a video producer using the pipeline
I want the pipeline to automatically capture each React scene segment as an individual video clip
So that I can edit a single segment in Replit, re-capture just that segment, and regenerate the video without re-recording all 60 seconds

## Problem Statement

The pipeline has four visual source options but `react-capture` is unimplemented — it throws an error directing users to manually screen-record and use `local-file` instead. This breaks the automation goal. Additionally, capturing at the scene level (8 clips) would still force re-recording entire multi-segment scenes (e.g., Scene5's 18s carousel of 4 services) when only one segment changes.

## Solution Statement

1. **Client-side**: Add `?scene=N` and `?segment=M` query parameters to the React app so it renders a single scene or segment in isolation
2. **Scene5 & Scene6**: Add segment isolation mode — when `?segment=M` is provided, render only that one service/operation instead of the full carousel/sequence
3. **Pipeline-side**: Use Playwright to capture each segment individually as separate WebM files, convert each to MP4, cache per-segment, and concatenate — exactly like `video-gen.ts` does for AI clips (14 clips total)
4. **Coordination**: Use the existing `window.startRecording`/`window.stopRecording` hooks already in `client/src/lib/video/hooks.ts`

## Feature Metadata

**Feature Type**: New Capability (completing a stubbed-out feature with segment-level enhancement)
**Estimated Complexity**: Medium-High
**Primary Systems Affected**: `client/src/App.tsx` (scene/segment isolation), `client/src/components/video/video_scenes/Scene5.tsx` & `Scene6.tsx` (segment isolation), `pipeline/src/api/` (new capture module), `pipeline/src/core/pipeline.ts` (integration), `pipeline/src/media/ffmpeg.ts` (WebM converter)
**Dependencies**: Playwright (new), Chromium browser binary

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

**Pipeline side:**
- `pipeline/src/api/video-gen.ts` (full file) — **Critical pattern**: flattens scenes with segments into individual jobs (14 total), saves to `video/clips/`, concatenates into `combined.mp4`. React-capture MUST mirror this exact flow
- `pipeline/src/core/pipeline.ts` (lines 207-250) — Video step handler; lines 222-227 are the `react-capture` error block to replace
- `pipeline/src/types.ts` (lines 40-60) — `VisualConfig` type with existing `react_capture` field definition
- `pipeline/src/config/schema.ts` (lines 46-53) — Zod schema for `react_capture` config block (already exists with defaults)
- `pipeline/src/media/ffmpeg.ts` (full file) — FFmpeg wrappers; `ffmpegConcat` and `ffmpegConcatReencode` show clip concatenation patterns
- `pipeline/src/media/video-composer.ts` (lines 1-77) — How video files flow to final composition (expects MP4)
- `pipeline/src/core/logger.ts` (lines 1-44) — Logging pattern to follow
- `pipeline/package.json` — Current dependencies

**Client side:**
- `client/src/App.tsx` — Root component; currently just renders `<VideoTemplate />`. Needs modification for scene/segment isolation
- `client/src/components/video/VideoTemplate.tsx` — Scene durations object `SCENE_DURATIONS` and scene rendering via `useVideoPlayer` hook
- `client/src/lib/video/hooks.ts` (lines 5-9, 42, 55) — **Critical**: `window.startRecording?.()` on mount (line 42), `window.stopRecording?.()` when last scene finishes (line 55). The hook receives `durations` as a prop and uses `Object.keys(durations)` for scene keys and `Object.values(durations)` for timing
- `client/src/components/video/video_scenes/index.ts` — Scene component exports
- `client/src/components/video/video_scenes/Scene1.tsx` — Simple scene (3s, 3 internal steps). Receives NO props — self-contained
- `client/src/components/video/video_scenes/Scene5.tsx` — Complex scene (18s, internal carousel cycling 4 services every 4s). Self-contained. **Must add segment isolation mode**
- `client/src/components/video/video_scenes/Scene6.tsx` — Complex scene (14s, sequential cards appearing at 500ms, 3500ms, 7000ms, 10500ms). Self-contained. **Must add segment isolation mode**
- `client/index.html` (lines 18-20) — Google Fonts loaded via `<link>` tags (DM Sans, JetBrains Mono, Space Grotesk)
- `vite.config.ts` (lines 40-43) — Vite config: root is `client/`, server on `0.0.0.0` port 5000
- `client/src/main.tsx` — Entry point; simple React DOM setup, no router currently

### New Files to Create

- `pipeline/src/api/react-capture.ts` — Core Playwright per-segment recording module (~250 lines)

### Existing Files to Modify

- `client/src/App.tsx` — Add `?scene=N&segment=M` query parameter handling to render single scene or segment in isolation
- `client/src/components/video/VideoTemplate.tsx` — Export `SCENE_DURATIONS` so App.tsx can create a single-scene/segment duration map
- `client/src/components/video/video_scenes/Scene5.tsx` — Add `segment` prop for isolated segment rendering
- `client/src/components/video/video_scenes/Scene6.tsx` — Add `segment` prop for isolated segment rendering
- `pipeline/src/core/pipeline.ts` — Replace error block with react-capture integration (lines 222-227)
- `pipeline/src/media/ffmpeg.ts` — Add `ffmpegConvertWebm()` function (~20 lines)
- `pipeline/src/types.ts` — Extend `VisualConfig.react_capture` type with new optional fields
- `pipeline/src/config/schema.ts` — Add new fields to react_capture Zod schema
- `pipeline/src/cli.ts` — Add `capture` command
- `pipeline/projects/education-power-team.yaml` — Add commented-out react-capture config example
- `pipeline/package.json` — Add playwright dependency

### Patterns to Follow

**Per-segment clip generation + concatenation** (from `video-gen.ts`):
This is the most important pattern. `video-gen.ts` flattens scenes with segments into 14 individual jobs:
```typescript
for (const scene of scenes) {
  if (scene.segments && scene.segments.length > 0) {
    for (const seg of scene.segments) {
      videoJobs.push({ id: seg.id, prompt: seg.video_prompt || seg.script, ... });
    }
  } else {
    videoJobs.push({ id: scene.id, ... });
  }
}
```
Output structure:
```
video/clips/scene1-hook.mp4
video/clips/scene2-vision.mp4
video/clips/scene3-modern.mp4
video/clips/scene4-intro.mp4
video/clips/scene5a-vardhman.mp4       ← segment, not full Scene5
video/clips/scene5b-megabyte.mp4       ← segment
video/clips/scene5c-acepower.mp4       ← segment
video/clips/scene5d-athletos.mp4       ← segment
video/clips/scene6a-aksolutions.mp4    ← segment
video/clips/scene6b-rootsquare.mp4     ← segment
video/clips/scene6c-ailacds.mp4        ← segment
video/clips/scene6d-asperia.mp4        ← segment
video/clips/scene7-foresight.mp4
video/clips/scene8-final.mp4
→ video/combined.mp4
```

**Subprocess spawning** (from `ffmpeg.ts` lines 191-216):
```typescript
function runCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    // ... collect stderr, handle exit code
  });
}
```

**Video result return type** (from `video-gen.ts`):
```typescript
return { file: outputPath, duration_ms: Math.round(probe.duration * 1000) };
```

**Dynamic import for optional deps**:
```typescript
const { chromium } = await import("playwright");
```

---

## IMPLEMENTATION PLAN

### Phase 1: Client-Side Scene & Segment Isolation

Modify the React app to support rendering a single scene via `?scene=N` or a single segment via `?scene=N&segment=M`. Scene5 and Scene6 gain segment isolation mode.

### Phase 2: Foundation (Dependencies & Utilities)

Add Playwright dependency and the WebM-to-MP4 FFmpeg utility.

### Phase 3: Core Per-Segment Capture

Create `react-capture.ts` — the Playwright module that starts Vite, captures each segment individually, converts to MP4, caches per-segment, and concatenates.

### Phase 4: Pipeline Integration

Wire react-capture into the pipeline orchestrator and CLI.

### Phase 5: Validation

Test per-segment capture, selective re-recording, and full pipeline flow.

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE VideoTemplate.tsx — export SCENE_DURATIONS and add segment durations

**File**: `client/src/components/video/VideoTemplate.tsx`

- **IMPLEMENT**: Export the `SCENE_DURATIONS` constant and add a `SEGMENT_DURATIONS` map for per-segment capture timing:
  ```typescript
  export const SCENE_DURATIONS = {
    scene1: 3000,
    scene2: 7000,
    scene3: 6000,
    scene4: 4000,
    scene5: 18000,
    scene6: 14000,
    scene7: 4000,
    scene8: 4000,
  };

  // Per-segment durations for isolated capture
  // Scene5: carousel cycles 4 services × 4.5s each = 18s total
  // Scene6: 4 operations appearing sequentially over 14s
  export const SEGMENT_DURATIONS: Record<number, Record<number, number>> = {
    5: { 1: 4500, 2: 4500, 3: 4500, 4: 4500 },  // Scene5's 4 services
    6: { 1: 3500, 2: 3500, 3: 3500, 4: 3500 },  // Scene6's 4 operations
  };
  ```
- **GOTCHA**: `SCENE_DURATIONS` is currently a `const` inside the file — just add `export`. `SEGMENT_DURATIONS` is new.
- **VALIDATE**: Verify client still builds: `cd .. && npx vite build --config vite.config.ts`

---

### Task 2: UPDATE Scene5.tsx — add segment isolation mode

**File**: `client/src/components/video/video_scenes/Scene5.tsx`

- **IMPLEMENT**: Add an optional `segment` prop. When provided, render only that one service (no carousel cycling):

```typescript
interface Scene5Props {
  segment?: number; // 1-based: 1=Vardhman, 2=MegaByte, 3=AcePower, 4=Athletos
}

export function Scene5({ segment }: Scene5Props) {
  const [activeIdx, setActiveIdx] = useState(segment ? segment - 1 : 0);

  useEffect(() => {
    // If rendering a single segment, don't cycle
    if (segment) return;

    const interval = setInterval(() => {
      setActiveIdx(prev => (prev < 3 ? prev + 1 : 0));
    }, 4000);

    return () => clearInterval(interval);
  }, [segment]);

  // Rest of JSX stays the same — it already renders based on activeIdx
  // ...
}
```

- **PATTERN**: Minimal change — only the state initialization and useEffect guard change. The JSX rendering logic stays identical since it already uses `activeIdx` to show one service at a time.
- **GOTCHA**: `segment` is 1-based (matching URL param `?segment=1`) but `activeIdx` is 0-based. Convert: `segment - 1`.
- **GOTCHA**: When `segment` is provided, skip the `setInterval` entirely — just show the one service statically with its entrance animation.
- **VALIDATE**: Navigate to `http://localhost:5000?scene=5&segment=2` — should show only "Mega Byte Systems" without cycling

---

### Task 3: UPDATE Scene6.tsx — add segment isolation mode

**File**: `client/src/components/video/video_scenes/Scene6.tsx`

- **IMPLEMENT**: Add an optional `segment` prop. When provided, skip the timed sequence and show only that one operation immediately:

```typescript
interface Scene6Props {
  segment?: number; // 1-based: 1=AK Solutions, 2=Root Square, 3=AI-LA-CDS, 4=Asperia
}

export function Scene6({ segment }: Scene6Props) {
  const [step, setStep] = useState(segment ? segment : 0);

  useEffect(() => {
    // If rendering a single segment, don't advance
    if (segment) return;

    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 3500),
      setTimeout(() => setStep(3), 7000),
      setTimeout(() => setStep(4), 10500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [segment]);

  // Rest of JSX stays the same — it already renders based on step
  // ...
}
```

- **PATTERN**: Same approach as Scene5. When `segment` is provided, initial state is set directly (Scene6 uses 1-based `step`, so `segment` maps directly). Skip all timeouts.
- **GOTCHA**: Scene6's `step` is already 1-based (operations show when `step === idx + 1`), so `segment` maps directly without conversion.
- **VALIDATE**: Navigate to `http://localhost:5000?scene=6&segment=3` — should show only "AI-LA-CDS" immediately without waiting

---

### Task 4: UPDATE App.tsx — add ?scene=N&segment=M query parameter support

**File**: `client/src/App.tsx`

- **IMPLEMENT**: Parse URL query params and render either the full VideoTemplate, a single isolated scene, or a single isolated segment:

```typescript
import VideoTemplate, { SCENE_DURATIONS, SEGMENT_DURATIONS } from "./components/video/VideoTemplate";
import { useVideoPlayer } from "./lib/video/hooks";
import { Scene1, Scene2, Scene3, Scene4, Scene5, Scene6, Scene7, Scene8 } from "./components/video/video_scenes";

const SCENE_COMPONENTS = [Scene1, Scene2, Scene3, Scene4, Scene5, Scene6, Scene7, Scene8];

function App() {
  const params = new URLSearchParams(window.location.search);
  const sceneParam = params.get("scene");
  const segmentParam = params.get("segment");

  if (sceneParam) {
    const sceneIndex = parseInt(sceneParam, 10) - 1; // 1-based to 0-based
    if (sceneIndex >= 0 && sceneIndex < SCENE_COMPONENTS.length) {
      const segmentNum = segmentParam ? parseInt(segmentParam, 10) : undefined;
      return <IsolatedScene index={sceneIndex} segment={segmentNum} />;
    }
  }

  return <VideoTemplate />;
}

function IsolatedScene({ index, segment }: { index: number; segment?: number }) {
  const SceneComponent = SCENE_COMPONENTS[index];
  const sceneKeys = Object.keys(SCENE_DURATIONS);
  const sceneKey = sceneKeys[index];
  const sceneNumber = index + 1; // 1-based

  // Determine duration: use segment duration if capturing a segment, else full scene duration
  let duration: number;
  if (segment && SEGMENT_DURATIONS[sceneNumber]?.[segment]) {
    duration = SEGMENT_DURATIONS[sceneNumber][segment];
  } else {
    duration = Object.values(SCENE_DURATIONS)[index];
  }

  // Create a single-scene durations map for the hook
  const durationKey = segment ? `${sceneKey}_seg${segment}` : sceneKey;
  const singleDurations = { [durationKey]: duration };

  const { hasEnded } = useVideoPlayer({
    durations: singleDurations,
    loop: false,
  });

  // Only Scene5 and Scene6 accept the segment prop
  const sceneProps = (sceneNumber === 5 || sceneNumber === 6) && segment
    ? { segment }
    : {};

  return (
    <div className="w-full h-screen overflow-hidden bg-black">
      <SceneComponent {...sceneProps} />
    </div>
  );
}

export default App;
```

- **PATTERN**: Uses the existing `useVideoPlayer` hook with a single-entry durations map. The hook already calls `window.startRecording?.()` on mount and `window.stopRecording?.()` when the (only) scene finishes.
- **GOTCHA**: Scene components other than Scene5/Scene6 accept NO props — only pass `segment` to components that support it.
- **GOTCHA**: The `useVideoPlayer` hook uses `Object.keys(durations)` and `Object.values(durations)` — passing a single-entry map makes it treat the scene as a complete 1-scene video.
- **GOTCHA**: Set `loop: false` so `window.stopRecording()` fires after the scene completes instead of looping.
- **VALIDATE**: Run Vite dev server, navigate to:
  - `http://localhost:5000?scene=1` → Scene1 only (3s)
  - `http://localhost:5000?scene=5&segment=2` → Only "Mega Byte Systems" (4.5s)
  - `http://localhost:5000?scene=6&segment=3` → Only "AI-LA-CDS" (3.5s)
  - `http://localhost:5000` → Full 8-scene video (existing behavior)

---

### Task 5: ADD playwright dependency

**File**: `pipeline/package.json`

- **IMPLEMENT**: Add `"playwright": "^1.52.0"` to `dependencies` (not devDependencies — it runs at pipeline execution time)
- **GOTCHA**: Only Chromium browser is needed. After `npm install`, run `npx playwright install chromium`
- **VALIDATE**: `cd pipeline && npm install && npx playwright install chromium`

---

### Task 6: ADD `ffmpegConvertWebm` to ffmpeg.ts

**File**: `pipeline/src/media/ffmpeg.ts`

- **IMPLEMENT**: Add a function to convert WebM (VP8, from Playwright) to MP4 (H.264):

```typescript
export async function ffmpegConvertWebm(
  inputFile: string,
  outputFile: string,
  options?: { fps?: number }
): Promise<void> {
  const args = ["-y", "-i", inputFile];
  if (options?.fps) {
    args.push("-r", String(options.fps));
  }
  args.push(
    "-c:v", "libx264",
    "-crf", "18",
    "-preset", "fast",
    "-an",
    "-movflags", "+faststart",
    outputFile
  );
  await runCommand("ffmpeg", args);
}
```

- **PATTERN**: Mirror `ffmpegConcatReencode` which also uses `runCommand` with `-c:v libx264`
- **GOTCHA**: Use `-an` flag (no audio) since the React app is silent; audio comes from TTS/music steps
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 7: UPDATE config schema and types for react_capture fields

**File 1**: `pipeline/src/config/schema.ts` (lines 46-53)

- **IMPLEMENT**: Add new optional fields to the existing `react_capture` Zod object:

```typescript
react_capture: z.object({
  dev_server_url: z.string().url().default("http://localhost:5000"),
  startup_command: z.string().default("npm run dev:client"),
  viewport: resolutionSchema.default({ width: 1920, height: 1080 }),
  hide_cursor: z.boolean().default(true),
  recording_timeout_ms: z.number().default(120000),
  wait_after_load_ms: z.number().default(1000),
  per_segment: z.boolean().default(true),
}).optional(),
```

**File 2**: `pipeline/src/types.ts` (lines 52-57)

- **IMPLEMENT**: Extend the `react_capture` type:

```typescript
react_capture?: {
  dev_server_url: string;
  startup_command: string;
  viewport: { width: number; height: number };
  hide_cursor: boolean;
  recording_timeout_ms: number;
  wait_after_load_ms: number;
  per_segment: boolean;
};
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 8: CREATE react-capture.ts — per-segment recording module

**File**: `pipeline/src/api/react-capture.ts`

This is the core implementation. It captures each segment individually, matching how `video-gen.ts` generates per-segment AI clips.

- **EXPORTS**:
```typescript
export async function captureReactVideo(
  visualConfig: VisualConfig,
  scenes: SceneConfig[],
  outputDir: string,
  projectRoot: string
): Promise<VideoResult>
```

- **IMPORTS**:
```typescript
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { logger } from "../core/logger.ts";
import { ffmpegConvertWebm, ffmpegConcat, ffprobe } from "../media/ffmpeg.ts";
import type { VisualConfig, SceneConfig, VideoResult } from "../types.ts";
```

- **INTERNAL FLOW**:

#### 8a: Capture job flattening (mirrors video-gen.ts)

```typescript
interface CaptureJob {
  id: string;         // e.g. "scene5a-vardhman"
  sceneNumber: number; // 1-based React component number (1-8)
  segment?: number;    // 1-based segment within scene (undefined for non-segmented scenes)
}

function buildCaptureJobs(scenes: SceneConfig[]): CaptureJob[] {
  const jobs: CaptureJob[] = [];
  let sceneNumber = 1;

  for (const scene of scenes) {
    if (scene.segments && scene.segments.length > 0) {
      let segIdx = 1;
      for (const seg of scene.segments) {
        jobs.push({
          id: seg.id,
          sceneNumber,
          segment: segIdx,
        });
        segIdx++;
      }
    } else {
      jobs.push({
        id: scene.id,
        sceneNumber,
      });
    }
    sceneNumber++;
  }

  return jobs;
}
```

This produces 14 capture jobs for the education-power-team config:
```
{ id: "scene1-hook",        sceneNumber: 1 }
{ id: "scene2-vision",      sceneNumber: 2 }
{ id: "scene3-modern",      sceneNumber: 3 }
{ id: "scene4-intro",       sceneNumber: 4 }
{ id: "scene5a-vardhman",   sceneNumber: 5, segment: 1 }
{ id: "scene5b-megabyte",   sceneNumber: 5, segment: 2 }
{ id: "scene5c-acepower",   sceneNumber: 5, segment: 3 }
{ id: "scene5d-athletos",   sceneNumber: 5, segment: 4 }
{ id: "scene6a-aksolutions", sceneNumber: 6, segment: 1 }
{ id: "scene6b-rootsquare", sceneNumber: 6, segment: 2 }
{ id: "scene6c-ailacds",    sceneNumber: 6, segment: 3 }
{ id: "scene6d-asperia",    sceneNumber: 6, segment: 4 }
{ id: "scene7-foresight",   sceneNumber: 7 }
{ id: "scene8-final",       sceneNumber: 8 }
```

#### 8b: Start Vite dev server

```typescript
async function startDevServer(command: string, url: string, cwd: string): Promise<ChildProcess | null>
```

- Before spawning, try `fetch(url)` — if it responds, return `null` (reuse existing server)
- Spawn the command with `cwd: projectRoot`, e.g. `npm run dev:client`
- Poll the URL with `fetch()` every 500ms, 30s timeout
- Return the `ChildProcess` for cleanup

#### 8c: Capture a single scene/segment

```typescript
async function captureClip(
  browser: Browser,
  devServerUrl: string,
  job: CaptureJob,
  outputPath: string,
  config: VisualConfig["react_capture"]
): Promise<string>
```

- Create a new `BrowserContext` with `recordVideo: { dir: tempDir, size: viewport }`
- Create a new `Page`
- Expose `startRecording` and `stopRecording` functions BEFORE navigation
- `stopRecording` resolves a promise that signals the animation has completed
- Build URL: `${devServerUrl}?scene=${job.sceneNumber}` + (job.segment ? `&segment=${job.segment}` : "")
- Navigate to the URL
- Wait for `document.fonts.ready`
- Wait `wait_after_load_ms`
- Race the stopRecording promise against `recording_timeout_ms`
- Close page → get WebM path from `page.video()?.path()`
- Close context
- Convert WebM to MP4: `ffmpegConvertWebm(webmPath, outputPath)`
- Return `outputPath`

#### 8d: Main flow — iterate capture jobs and concatenate

```typescript
export async function captureReactVideo(...)
```

1. Start Vite dev server
2. Launch Playwright Chromium (headless by default, `REACT_CAPTURE_HEADED=1` for debugging)
3. Create `video/clips/` directory in outputDir
4. Build capture jobs via `buildCaptureJobs(scenes)` — produces 14 jobs
5. For each job:
   - Determine the MP4 output path: `video/clips/${job.id}.mp4`
   - **Cache check**: If `${job.id}.mp4` already exists and `--force` was not used, skip capture
   - Call `captureClip()` for the job
   - Log: `logger.info("  Captured: ${job.id} (scene${job.sceneNumber}${job.segment ? '/seg' + job.segment : ''})")`
   - Add a small delay between captures (500ms) to let Playwright clean up
6. Collect all clip paths in order
7. Concatenate all per-segment MP4s into `video/raw/combined.mp4` using existing `ffmpegConcat` or `ffmpegConcatReencode`
8. Close browser
9. Kill Vite server (in `finally` block, only if we spawned it)
10. Return `{ file: combinedPath, duration_ms }`

- **GOTCHA**: `page.exposeFunction` must be called BEFORE `page.goto()` — React calls `window.startRecording()` on mount
- **GOTCHA**: `page.video()?.path()` returns the WebM path only AFTER `page.close()`
- **GOTCHA**: Each capture needs its own `BrowserContext` (not just a new page) because `recordVideo` is set at context creation
- **GOTCHA**: The `sceneNumber` in capture jobs is the 1-based React component index (1-8). The `segment` is the 1-based sub-index within that component. The URL becomes `?scene=5&segment=2` for "scene5b-megabyte"
- **GOTCHA**: Scene components that DON'T have segments (Scene1-4, Scene7, Scene8) get `?scene=N` only — no segment param
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 9: UPDATE pipeline.ts — integrate react-capture into video step

**File**: `pipeline/src/core/pipeline.ts` (lines 222-227)

- **IMPLEMENT**: Replace the error-throwing `else` block:

```typescript
} else if (config.visual.source === "react-capture") {
  const { captureReactVideo } = await import("../api/react-capture.ts");
  const projectRoot = resolve(dirname(configPath), "..");
  const result = await captureReactVideo(
    config.visual,
    config.scenes,
    outputDir,
    projectRoot
  );
  videoFile = result.file;
  state.markCompleted("video", {
    file: result.file,
    duration_ms: result.duration_ms,
  });
```

- **PATTERN**: Mirror `useLocalVideo` handling at lines 213-219
- **GOTCHA**: Pass `config.scenes` so the capture module knows scene IDs, segment structure, and can build 14 capture jobs. The `configPath` is relative to pipeline dir; `projectRoot` resolves to the Education-Power-Team root (one level up)
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 10: ADD `capture` command to CLI

**File**: `pipeline/src/cli.ts`

- **IMPLEMENT**: Add a `capture` command:

```typescript
program
  .command("capture")
  .description("Capture React app animations as video via Playwright (per-segment)")
  .argument("<config>", "Path to project config file")
  .option("--force", "Recapture all segments even if cached", false)
  .option("--verbose", "Enable debug logging", false)
  .action(async (configPath: string, opts) => {
    if (opts.verbose) setLogLevel("debug");
    try {
      await runPipeline(configPath, {
        force: opts.force,
        steps: ["video"] as StepName[],
      });
    } catch (err) {
      console.error(`\nCapture failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });
```

- **PATTERN**: Mirror the `video` command structure
- **VALIDATE**: `npx tsx src/cli.ts capture --help`

---

### Task 11: UPDATE example YAML config

**File**: `pipeline/projects/education-power-team.yaml` (lines 37-42)

- **IMPLEMENT**: Add commented-out react-capture config:

```yaml
visual:
  source: image-to-video  # Options: image-to-video, ai-generate, local-file, react-capture
  # react_capture:
  #   dev_server_url: "http://localhost:5000"
  #   startup_command: "npm run dev:client"
  #   viewport:
  #     width: 1920
  #     height: 1080
  #   hide_cursor: true
  #   per_segment: true            # Capture each segment individually (14 clips vs 8)
  #   recording_timeout_ms: 120000
  ai_generate:
    provider: veo
    model: veo3_fast
    aspect_ratio: "16:9"
```

- **VALIDATE**: `npx tsx src/cli.ts render projects/education-power-team.yaml --dry-run`

---

### Task 12: HANDLE edge cases and robustness

**File**: `pipeline/src/api/react-capture.ts`

After the core implementation works, add robustness:

- **Port reuse**: Before spawning Vite, try `fetch(devServerUrl)`. If it responds, skip spawning and set a flag to NOT kill the server in cleanup
- **Font loading**: After `page.goto()`, call `await page.evaluate(() => document.fonts.ready)` to ensure Google Fonts (DM Sans, JetBrains Mono, Space Grotesk from `client/index.html`) load before recording
- **Headed mode**: Check `process.env.REACT_CAPTURE_HEADED === "1"` for non-headless debugging
- **Per-segment cache**: Before capturing a job, check if `video/clips/${job.id}.mp4` exists. If so, skip capture. This enables selective re-recording: delete one clip file and re-run
- **Cleanup on failure**: In `finally` block, always kill the Vite server process (if we spawned it). Don't delete raw WebM files on conversion failure (useful for debugging)
- **Fallback to per-scene**: If `per_segment: false` in config, capture 8 clips (one per React component) instead of 14. Build jobs without segment splitting. This is a simple flag in `buildCaptureJobs()`.
- **VALIDATE**: Run capture with Vite already running on port 5000 — should reuse existing server

---

## TESTING STRATEGY

### Integration Tests (Manual)

No automated test framework is configured. Testing is manual CLI-based:

1. **Single-scene isolation test** (client-side):
   ```bash
   # Start Vite, then navigate to:
   # http://localhost:5000?scene=1         → should show only Scene1 (3s), then stop
   # http://localhost:5000?scene=5         → should show full Scene5 carousel (18s), then stop
   # http://localhost:5000?scene=5&segment=2 → should show only "Mega Byte Systems" (4.5s), then stop
   # http://localhost:5000?scene=6&segment=3 → should show only "AI-LA-CDS" (3.5s), then stop
   # http://localhost:5000                 → should show full 8-scene video (existing behavior)
   ```

2. **Per-segment capture test**:
   ```bash
   npx tsx src/cli.ts capture projects/education-power-team.yaml --verbose --force
   ```
   Verify: 14 individual MP4s in `video/rendered/video/clips/`, plus `combined.mp4` in `video/rendered/video/raw/`

3. **Selective re-recording test**:
   ```bash
   # Delete one segment clip
   rm video/rendered/video/clips/scene5b-megabyte.mp4
   # Re-run WITHOUT --force — should only re-capture scene5b
   npx tsx src/cli.ts capture projects/education-power-team.yaml --verbose
   ```

4. **Full pipeline test**:
   ```bash
   npx tsx src/cli.ts render projects/education-power-team.yaml --force --verbose
   ```
   Verify: Final composed video includes React-captured visuals with voiceover and music

5. **Resume test**: Kill pipeline mid-capture, re-run without `--force` — should resume from video step and use already-captured clips

### Edge Cases

- Run with Vite already on port 5000 (should reuse, not spawn a second server)
- Run with no `react_capture` block in YAML (should use all defaults)
- Navigate to `?scene=99` (should fall back to full VideoTemplate)
- Navigate to `?scene=1&segment=2` (Scene1 has no segments — should ignore segment param)
- Run with `REACT_CAPTURE_HEADED=1` (should open visible browser window)
- Run and Ctrl+C midway (should kill Vite server and cleanup)
- Run with `per_segment: false` (should produce 8 clips, not 14)

---

## VALIDATION COMMANDS

### Level 1: Type Check

```bash
cd pipeline && npx tsc --noEmit
```

**Expected**: Exit code 0, no errors

### Level 2: Client Build

```bash
cd .. && npx vite build --config vite.config.ts
```

**Expected**: Client builds without errors (verifies App.tsx, Scene5, Scene6 changes)

### Level 3: Dry Run

```bash
cd pipeline && npx tsx src/cli.ts render projects/education-power-team.yaml --dry-run
```

**Expected**: Shows pipeline plan without errors

### Level 4: Single Segment Test (Browser)

```bash
# Start Vite, then in browser navigate to:
# http://localhost:5000?scene=5&segment=2  → "Mega Byte Systems" only (4.5s)
# http://localhost:5000?scene=6&segment=1  → "A.K. Solutions" only (3.5s)
```

### Level 5: Per-Segment Capture Test

```bash
npx tsx src/cli.ts capture projects/education-power-team.yaml --verbose --force
```

**Expected**:
- Vite server starts (or reuses existing)
- 14 segments captured individually
- Each WebM converted to MP4
- All clips concatenated into `combined.mp4`

### Level 6: Output Verification

```bash
# Verify individual clips (should be 14)
for f in video/rendered/video/clips/*.mp4; do
  echo "$f: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")s"
done

# Verify combined
ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of json video/rendered/video/raw/combined.mp4
```

**Expected**: 14 individual clips, combined ~60s total, 1920x1080, H.264

---

## ACCEPTANCE CRITERIA

- [ ] `?scene=N` URL parameter renders a single scene in isolation in the React app
- [ ] `?scene=N&segment=M` URL parameter renders a single segment in isolation (Scene5, Scene6)
- [ ] Full app (`http://localhost:5000`) still works as before (no regression)
- [ ] Scene5 with `segment` prop renders only the specified service (no carousel cycling)
- [ ] Scene6 with `segment` prop renders only the specified operation (no timed sequence)
- [ ] `react-capture` source captures each segment as a separate MP4 clip (14 clips for education-power-team)
- [ ] Per-segment clips are cached in `video/clips/` — only changed segments are re-captured
- [ ] All clips are concatenated into `combined.mp4`
- [ ] Vite dev server is started automatically and cleaned up after capture
- [ ] If Vite is already running, it reuses the existing server
- [ ] Config defaults work without specifying `react_capture` block
- [ ] `per_segment: false` falls back to per-scene capture (8 clips)
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `--dry-run` still works without Playwright installed
- [ ] Pipeline state tracks video step correctly (completed with file path and duration)
- [ ] Captured video flows through mix_audio and compose steps correctly
- [ ] Deleting a single segment clip file and re-running only re-captures that segment

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order (1 through 12)
- [ ] Type check passes: `npx tsc --noEmit`
- [ ] Client builds: `npx vite build`
- [ ] `?scene=N` works in browser
- [ ] `?scene=N&segment=M` works in browser for Scene5/Scene6
- [ ] Per-segment capture works: `npx tsx src/cli.ts capture ... --verbose`
- [ ] 14 clips produced (not 8)
- [ ] Selective re-recording works (delete one clip, re-run)
- [ ] Full pipeline works with `source: react-capture`
- [ ] Vite server cleanup verified (no orphan processes)
- [ ] All acceptance criteria met

---

## NOTES

### Key Change from Previous Plan: Scene-Level → Segment-Level Capture

The previous plan captured 8 clips (one per React component). This updated plan captures **14 clips** (one per segment), matching `video-gen.ts`'s output granularity. This gives the pipeline more control:

| Approach | Clips | Granularity | Re-record scope |
|----------|-------|-------------|-----------------|
| Previous (per-scene) | 8 | Scene component | Re-record all 4 services in Scene5 to change 1 |
| Current (per-segment) | 14 | Individual segment | Re-record only "Mega Byte Systems" |

### Client-Side Changes Required

Scene5 and Scene6 are the only components with internal sub-animations (carousel and sequential cards). All other scenes (1-4, 7, 8) are single-animation components and need no modification — they just get `?scene=N` with no segment param.

| Scene Component | Segments | URL Pattern |
|----------------|----------|-------------|
| Scene1 | none | `?scene=1` |
| Scene2 | none | `?scene=2` |
| Scene3 | none | `?scene=3` |
| Scene4 | none | `?scene=4` |
| Scene5 | 4 (Vardhman, MegaByte, AcePower, Athletos) | `?scene=5&segment=1` through `&segment=4` |
| Scene6 | 4 (AK Solutions, Root Square, AI-LA-CDS, Asperia) | `?scene=6&segment=1` through `&segment=4` |
| Scene7 | none | `?scene=7` |
| Scene8 | none | `?scene=8` |

### Recording Hooks Already Exist

The React client at `client/src/lib/video/hooks.ts` already calls:
- `window.startRecording?.()` on component mount (line 42)
- `window.stopRecording?.()` when the last scene finishes (line 55)

For segment capture, we pass a single-entry durations map to `useVideoPlayer`, making it treat each segment as a complete 1-scene video. The hook automatically calls `stopRecording` when the (only) scene finishes — perfect for per-segment capture.

### Segment Duration Calculation

From the React source code:
- **Scene5**: Carousel cycles every 4s per service. For isolated segment capture, each segment runs for ~4.5s (4s display + 0.5s entrance animation). Total: 4 × 4.5s = 18s.
- **Scene6**: Operations appear at 500ms, 3500ms, 7000ms, 10500ms. Each operation is shown for ~3.5s. For isolated segment capture, each segment runs for ~3.5s. Total: 4 × 3.5s = 14s.

### Per-Segment Caching Strategy

Each segment's clip is saved as `video/clips/{segmentId}.mp4`. Before capturing, check if the file exists:
- If it exists and `--force` is NOT set → skip capture, reuse cached clip
- If it doesn't exist or `--force` IS set → capture and save

This means you can:
1. Edit the "Mega Byte Systems" card in Scene5.tsx
2. Delete `video/clips/scene5b-megabyte.mp4`
3. Re-run capture → only scene5b is re-recorded
4. Re-run compose → new video with updated Mega Byte segment

### Why Dynamic Import for Playwright

Using `await import("playwright")` instead of a static import ensures:
1. Playwright is only loaded when `source: react-capture` is selected
2. Projects using `image-to-video` or `local-file` don't need Playwright installed
3. `--dry-run` works without Playwright

### WebM vs MP4

Playwright's CDP screencast outputs WebM (VP8). The pipeline expects MP4 (H.264). The `ffmpegConvertWebm` utility bridges this gap. Conversion is fast since it's just a codec transcode.

### Total Duration from 14 Clips

| Clip | Duration |
|------|----------|
| scene1-hook | 3,000ms |
| scene2-vision | 7,000ms |
| scene3-modern | 6,000ms |
| scene4-intro | 4,000ms |
| scene5a-vardhman | 4,500ms |
| scene5b-megabyte | 4,500ms |
| scene5c-acepower | 4,500ms |
| scene5d-athletos | 4,500ms |
| scene6a-aksolutions | 3,500ms |
| scene6b-rootsquare | 3,500ms |
| scene6c-ailacds | 3,500ms |
| scene6d-asperia | 3,500ms |
| scene7-foresight | 4,000ms |
| scene8-final | 4,000ms |
| **Total** | **60,000ms** |

### Dependency Order

```
Task 1 (export SCENE_DURATIONS + add SEGMENT_DURATIONS)
  → Task 2-3 (Scene5 + Scene6 segment isolation — parallel)
  → Task 4 (App.tsx scene/segment routing)
  → Task 5 (playwright dep)
  → Task 6 (ffmpeg converter)
  → Task 7 (schema + types)
  → Task 8 (core react-capture module — depends on 1-7)
  → Task 9 (pipeline integration — depends on 8)
  → Task 10 (CLI command — depends on 9)
  → Task 11 (YAML example — depends on 7)
  → Task 12 (edge cases — depends on 8)
```
