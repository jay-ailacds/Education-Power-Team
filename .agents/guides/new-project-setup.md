# New Video Project Setup Guide

How to create a new video project using the pipeline. The pipeline is project-agnostic — each video project provides its own config, assets, and (optionally) React scene components.

## Quick Start

```bash
# 1. Create project config
cp pipeline/projects/education-power-team.yaml pipeline/projects/my-project.yaml

# 2. Edit config with your scenes, voice, music, and visual settings
# 3. Run the pipeline
cd pipeline
npx tsx src/cli.ts render projects/my-project.yaml --dry-run   # Validate first
npx tsx src/cli.ts render projects/my-project.yaml             # Full run
```

## Project Structure

A new project needs at minimum a YAML config file. Depending on the visual source, you may also need a React client app or local video files.

```
Education-Power-Team/
├── pipeline/
│   └── projects/
│       └── my-project.yaml          ← Required: project config
├── my-project-assets/               ← Optional: images for image-to-video
├── my-project-client/               ← Optional: React app for react-capture
│   ├── src/
│   │   ├── components/video/
│   │   │   ├── VideoTemplate.tsx
│   │   │   └── video_scenes/
│   │   │       ├── Scene1.tsx
│   │   │       ├── Scene2.tsx
│   │   │       └── ...
│   │   ├── lib/video/hooks.ts       ← Reuse from client/src/lib/video/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── index.html
└── my-project-output/               ← Auto-created by pipeline
    ├── tts/
    ├── music/
    ├── video/
    │   ├── clips/                   ← Per-segment cached clips
    │   └── raw/
    └── .pipeline-state.json
```

## YAML Config Reference

### Minimal Config

```yaml
project:
  name: "My Project"
  slug: my-project
  description: "Short description for research context"

scenes:
  - id: scene1-intro
    title: "Introduction"
    script: "Welcome to our product demonstration."
    video_prompt: "Professional office environment, modern design."

  - id: scene2-features
    title: "Key Features"
    script: "Here are the three features that set us apart."
    video_prompt: "Split-screen showing product features."

  - id: scene3-closing
    title: "Call to Action"
    script: "Get started today."
    video_prompt: "Company logo with contact information."

voice:
  provider: elevenlabs
  voice_id: pNInz6obpgDQGcFmaJgB    # ElevenLabs voice ID
  model: eleven_multilingual_v2

music:
  provider: suno
  prompt: "Corporate upbeat background music, professional, modern"
  mode: instrumental

audio_mix:
  voiceover_volume_db: 0
  music_volume_db: -18
  gap_between_scenes_seconds: 0.5

visual:
  source: image-to-video              # See "Visual Source Options" below

output:
  directory: ../my-project-output
  resolution:
    width: 1920
    height: 1080
  fps: 24
  format: mp4
```

### Scenes with Segments

For scenes that contain multiple sub-sections (e.g., a carousel of services):

```yaml
scenes:
  - id: scene1-intro
    title: "Introduction"
    script: "Welcome."
    video_prompt: "Opening shot."

  - id: scene2-services
    title: "Our Services"
    # No top-level script — segments provide individual scripts
    segments:
      - id: scene2a-consulting
        script: "We offer strategic consulting."
        video_prompt: "Consultant at whiteboard."
      - id: scene2b-development
        script: "Custom software development."
        video_prompt: "Developer coding on screen."
      - id: scene2c-support
        script: "24/7 technical support."
        video_prompt: "Support team in action."

  - id: scene3-closing
    title: "Contact Us"
    script: "Reach out today."
    video_prompt: "Contact details on screen."
```

The pipeline flattens segments for TTS and video generation. This config produces **5 clips** (scene1 + 3 segments + scene3), not 3.

## Visual Source Options

### 1. `image-to-video` — AI-generated video from images + prompts

Best for: Projects without custom React animations. Uses Kie.ai (Veo/Runway) to generate video clips from images and text prompts.

```yaml
visual:
  source: image-to-video
  ai_generate:
    provider: veo           # or "runway"
    model: veo3_fast
    aspect_ratio: "16:9"
```

Each scene/segment needs a `video_prompt` and optionally an `image` path pointing to a source image.

**Requirements**: `KIE_API_KEY` in `.env`

### 2. `ai-generate` — AI-generated video from text prompts only

Same as `image-to-video` but without source images. Pure text-to-video generation.

```yaml
visual:
  source: ai-generate
  ai_generate:
    provider: veo
    model: veo3_fast
    aspect_ratio: "16:9"
```

**Requirements**: `KIE_API_KEY` in `.env`

### 3. `local-file` — Pre-recorded video file

Best for: Using existing footage, screen recordings, or externally produced video.

```yaml
visual:
  source: local-file
  local_file: ../path/to/my-video.mp4
```

**Requirements**: An MP4 file on disk

### 4. `react-capture` — Automated browser recording of React animations

Best for: Custom animated scenes built with React + Framer Motion. The pipeline launches a browser, records each scene/segment individually, and concatenates the clips.

```yaml
visual:
  source: react-capture
  react_capture:
    dev_server_url: "http://localhost:5000"
    startup_command: "npm run dev:client"
    viewport:
      width: 1920
      height: 1080
    hide_cursor: true
    per_segment: true               # true = 1 clip per segment, false = 1 clip per scene
    recording_timeout_ms: 120000
    wait_after_load_ms: 1000
```

**Requirements**: Playwright + Chromium, a React client app (see below)

## Building a React Client for `react-capture`

### Contract

The pipeline's react-capture module expects the React app to satisfy this contract:

| Requirement | Details |
|-------------|---------|
| **URL params** | `?scene=N` renders scene N in isolation (1-based). `?scene=N&segment=M` renders segment M of scene N. No params = full video. |
| **Recording hooks** | App uses `useVideoPlayer` hook which calls `window.startRecording()` on mount and `window.stopRecording()` when the scene/segment finishes. |
| **Duration exports** | `VideoTemplate.tsx` exports `SCENE_DURATIONS` (scene key → ms) and `SEGMENT_DURATIONS` (scene number → segment number → ms). |
| **Self-contained scenes** | Each scene component manages its own animations, images, and timing internally. |
| **No audio** | The React app is silent — audio comes from the pipeline's TTS and music steps. |

### Reusable Code

Copy these files from the reference project — they are project-agnostic:

```
client/src/lib/video/hooks.ts       → useVideoPlayer, useSceneTimer hooks
client/src/lib/video/animations.ts  → Framer Motion transition presets
client/src/lib/video/index.ts       → Barrel export
```

### App.tsx Pattern

```typescript
import VideoTemplate, { SCENE_DURATIONS, SEGMENT_DURATIONS } from "./components/video/VideoTemplate";
import { useVideoPlayer } from "./lib/video/hooks";
// Import your scene components
import { Scene1, Scene2, Scene3 } from "./components/video/video_scenes";

const SCENE_COMPONENTS = [Scene1, Scene2, Scene3];

function App() {
  const params = new URLSearchParams(window.location.search);
  const sceneParam = params.get("scene");
  const segmentParam = params.get("segment");

  if (sceneParam) {
    const sceneIndex = parseInt(sceneParam, 10) - 1;
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
  const sceneNumber = index + 1;

  let duration: number;
  if (segment && SEGMENT_DURATIONS[sceneNumber]?.[segment]) {
    duration = SEGMENT_DURATIONS[sceneNumber][segment];
  } else {
    duration = Object.values(SCENE_DURATIONS)[index];
  }

  const durationKey = segment ? `${sceneKeys[index]}_seg${segment}` : sceneKeys[index];

  useVideoPlayer({
    durations: { [durationKey]: duration },
    loop: false,
  });

  // Only pass segment prop to components that support it
  const sceneProps = segment && SEGMENT_DURATIONS[sceneNumber] ? { segment } : {};

  return (
    <div className="w-full h-screen overflow-hidden bg-black">
      <SceneComponent {...sceneProps} />
    </div>
  );
}
```

### Scene Component with Segments

If your scene has internal sub-sections (carousel, tabs, sequential cards), add segment isolation:

```typescript
interface MySceneProps {
  segment?: number; // 1-based
}

export function MyScene({ segment }: MySceneProps) {
  const items = [
    { name: "Service A", image: imgA },
    { name: "Service B", image: imgB },
    { name: "Service C", image: imgC },
  ];

  const [activeIdx, setActiveIdx] = useState(segment ? segment - 1 : 0);

  useEffect(() => {
    if (segment) return; // Don't cycle when capturing a single segment
    const interval = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % items.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [segment]);

  return (
    <div>
      {items.map((item, idx) =>
        activeIdx === idx && <Card key={idx} item={item} />
      )}
    </div>
  );
}
```

### VideoTemplate Pattern

```typescript
export const SCENE_DURATIONS = {
  scene1: 5000,
  scene2: 12000,  // Has 3 segments × 4s each
  scene3: 4000,
};

export const SEGMENT_DURATIONS: Record<number, Record<number, number>> = {
  2: { 1: 4000, 2: 4000, 3: 4000 },  // Scene2's 3 segments
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  return (
    <AnimatePresence mode="popLayout">
      {currentScene === 0 && <Scene1 key="s1" />}
      {currentScene === 1 && <Scene2 key="s2" />}
      {currentScene === 2 && <Scene3 key="s3" />}
    </AnimatePresence>
  );
}
```

## Pipeline Steps

The pipeline runs these steps in order. Each is idempotent and cached:

```
research → enhance → tts → music → video → mix_audio → compose → verify
```

| Step | What it does | Can skip? |
|------|-------------|-----------|
| **research** | Exa.ai deep search for scene context | Yes (no `EXA_API_KEY`) |
| **enhance** | Loads pre-generated enhanced scripts from `enhanced-scripts.json` | Yes (uses originals) |
| **tts** | ElevenLabs voiceover via Kie.ai | No |
| **music** | Suno background music via Kie.ai | No |
| **video** | Visual source (AI, local, or react-capture) | No |
| **mix_audio** | Combines TTS + music at configured dB levels | No |
| **compose** | Muxes video + mixed audio into final MP4 | No |
| **verify** | Output validation | Not yet implemented |

### Running Individual Steps

```bash
npx tsx src/cli.ts research projects/my-project.yaml
npx tsx src/cli.ts tts projects/my-project.yaml
npx tsx src/cli.ts video projects/my-project.yaml
npx tsx src/cli.ts capture projects/my-project.yaml    # react-capture only
npx tsx src/cli.ts status projects/my-project.yaml      # Check progress
npx tsx src/cli.ts resume projects/my-project.yaml      # Resume from last step
```

### Re-running a Step

```bash
npx tsx src/cli.ts tts projects/my-project.yaml --force  # Re-generate all TTS
```

For react-capture, you can selectively re-record by deleting individual clip files:

```bash
rm my-project-output/video/clips/scene2b-development.mp4
npx tsx src/cli.ts capture projects/my-project.yaml      # Only re-captures scene2b
```

## Enhancement Workflow

Enhanced scripts are NOT generated by the pipeline — they are created in a Claude session:

1. Run research: `npx tsx src/cli.ts research projects/my-project.yaml`
2. Open the research report: `my-project-output/research/research-report.json`
3. Ask Claude to enhance your scripts using the research findings
4. Claude writes `my-project-output/enhanced/enhanced-scripts.json`
5. Resume pipeline: `npx tsx src/cli.ts resume projects/my-project.yaml`

The enhance step loads the pre-generated file — it does not call any LLM API.

## Environment Variables

```bash
# Required for TTS, music, and AI video generation
KIE_API_KEY=your_kie_api_key

# Optional for research step
EXA_API_KEY=your_exa_api_key
```

Place in `.env` at project root or pipeline directory.

## Checklist for a New Project

- [ ] Create YAML config under `pipeline/projects/`
- [ ] Define scenes (with segments if needed)
- [ ] Set voice provider and voice ID
- [ ] Set music prompt and mode
- [ ] Choose visual source and configure it
- [ ] Set output directory and resolution
- [ ] Add source images to an assets directory (if using `image-to-video`)
- [ ] Build React client app (if using `react-capture`)
  - [ ] Create scene components
  - [ ] Add `?scene=N&segment=M` URL param support
  - [ ] Export `SCENE_DURATIONS` and `SEGMENT_DURATIONS`
  - [ ] Verify isolated scene rendering in browser
- [ ] Add `KIE_API_KEY` to `.env`
- [ ] Run `--dry-run` to validate config
- [ ] Run full pipeline
