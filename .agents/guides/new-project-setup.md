# New Video Project Setup Guide

How to create a new video project using the pipeline. Each project gets its own config, assets, and isolated output directory.

## Quick Start

```bash
# 1. Copy the template
cp pipeline/projects/_template.yaml pipeline/projects/my-client.yaml

# 2. Create asset directory (if client provided images)
mkdir -p assets/my-client/
# Copy client images into assets/my-client/

# 3. Edit the YAML config with your scenes, scripts, and settings

# 4. Validate config
cd pipeline
npx tsx src/cli.ts render projects/my-client.yaml --dry-run

# 5. Run the full pipeline
npx tsx src/cli.ts render projects/my-client.yaml

# 6. Output lands in output/my-client/my-client.mp4
```

## Project File Layout

```
Education-Power-Team/
├── pipeline/projects/
│   ├── _template.yaml                  ← Copy this to start
│   ├── education-power-team.yaml       ← Existing project
│   └── my-new-client.yaml             ← Your new project
├── assets/
│   ├── campus_ecosystem.png            ← Shared/legacy assets
│   └── my-new-client/                  ← Per-client asset folder
│       ├── logo.png
│       ├── hero-image.png
│       └── product-photos/
├── output/
│   ├── education-power-team/           ← Previous project output (untouched)
│   └── my-new-client/                  ← New project output (auto-created)
│       ├── .pipeline-state.json
│       ├── audio/
│       ├── video/
│       ├── slides/
│       └── my-new-client.mp4           ← Final video
└── client/                             ← React scenes (only for react-capture)
```

## Starting Points by Client Scenario

### Scenario A: Client provides product/service images

Most common case. Client sends photos, logos, or marketing images.

1. Save images to `assets/{client-name}/`
2. Copy `_template.yaml`, set `visual.source: image-to-video`
3. Reference images in each scene's `image:` field
4. Write `video_prompt:` to guide AI on how to animate the image
5. Run pipeline

```yaml
visual:
  source: image-to-video
  ai_generate:
    provider: veo
    model: veo3_fast

scenes:
  - id: scene1
    script: "Voiceover text"
    image: "../../assets/client-name/product-photo.png"
    video_prompt: "Camera slowly zooms into the product, warm lighting..."
```

### Scenario B: Client provides no images (text-only brief)

You only have a script or description. AI generates everything.

1. Copy `_template.yaml`, set `visual.source: ai-generate`
2. Write detailed `video_prompt:` for each scene (this is the only visual input)
3. No `image:` fields needed
4. Run pipeline

```yaml
visual:
  source: ai-generate
  ai_generate:
    provider: veo
    model: veo3_fast

scenes:
  - id: scene1
    script: "Voiceover text"
    video_prompt: >
      Detailed description of what to show. Be specific about
      setting, people, actions, lighting, camera angle.
```

### Scenario C: Client provides an existing video (InVideo, screen recording, etc.)

Client already has a video file and wants voiceover + music added.

1. Save the video to `assets/{client-name}/video.mp4`
2. Copy `_template.yaml`, set `visual.source: local-file`
3. Scenes still define scripts for voiceover, but no `video_prompt` needed
4. Run pipeline — it will add voiceover + music to the existing video

```yaml
visual:
  source: local-file
  local_file: "../../assets/client-name/video.mp4"

scenes:
  - id: scene1
    script: "Voiceover text"
    # No image or video_prompt needed
```

**Note:** With `local-file`, slides are less useful since you can't interleave them with a pre-existing video. Set `slides.enabled: false` unless you want the pipeline to attempt interleaving.

### Scenario D: You build animated React scenes

For custom animated presentations using React + Framer Motion.

1. Create scene components in `client/src/components/video/video_scenes/`
2. Copy `_template.yaml`, set `visual.source: react-capture`
3. Playwright will record each scene from the browser
4. Run pipeline

```yaml
visual:
  source: react-capture
  react_capture:
    dev_server_url: "http://localhost:5000"
    startup_command: "npm run dev:client"
    viewport:
      width: 1920
      height: 1080
    per_segment: true
```

## Writing Effective Scenes

### Scene Structure

Each scene needs at minimum an `id` and `script`. Everything else is optional.

```yaml
- id: scene-name              # Required: unique kebab-case identifier
  script: "Narration text"     # Required: what the voiceover says
  duration_hint_ms: 5000       # Hint for TTS pacing (actual duration from TTS)
  image: "path/to/image.png"   # Optional: reference image for AI video
  video_prompt: "description"  # Optional: what the AI should generate visually
  slide_title: "Title"         # Optional: branded slide (omit = no slide)
  slide_stat: "Statistic"      # Optional: key metric on slide
  slide_tagline: "Tagline"     # Optional: value proposition on slide
  transition: fadeBlur          # Optional: transition effect
```

### Using Segments

For multi-part scenes (partner showcases, feature lists, team introductions):

```yaml
- id: section-name
  duration_hint_ms: 20000
  segments:
    - id: section-partner-a
      script: "Partner A does X."
      duration_hint_ms: 5000
      slide_title: "Partner A"
      slide_stat: "Key stat"
      image: "../../assets/client/partner-a.png"
      video_prompt: "Visual for partner A"

    - id: section-partner-b
      script: "Partner B does Y."
      duration_hint_ms: 5000
      slide_title: "Partner B"
      ...
```

Each segment gets its own voiceover clip, video clip, and branded slide.

### Slide Tips

- Set `slide_title` only on scenes where you want a branded card
- Omit `slide_title` on opening hooks and closing scenes to let the video play through
- Keep `slide_stat` short (under 40 characters)
- `slide_tagline` appears smaller — use for the value proposition
- Customize brand colors in `slides.style.background_gradient` and `stat_color`
- Adjust `duration_offset_sec` if slides feel too long/short vs voiceover (-0.3 is a good default)

## Pipeline Steps

The pipeline runs these steps in order. Each is cached — re-runs skip completed steps.

```
research  → Optional deep research via Exa.ai (needs EXA_API_KEY)
enhance   → Apply Claude-enhanced scripts (pre-generated, loaded from disk)
tts       → Generate voiceover clips via ElevenLabs
music     → Generate background music via Suno (or use local file)
video     → Generate video clips (Veo, Runway, local file, or react-capture)
slides    → Generate branded info-card slides + interleave with video
mix_audio → Concatenate voiceovers with gaps, mix with music
compose   → Mux final video + audio into output MP4
```

### Useful Commands

```bash
cd pipeline

# Full pipeline
npx tsx src/cli.ts render projects/my-client.yaml

# Check progress
npx tsx src/cli.ts status projects/my-client.yaml

# Resume from where it stopped
npx tsx src/cli.ts resume projects/my-client.yaml

# Force re-run everything
npx tsx src/cli.ts render projects/my-client.yaml --force

# Dry run (validate config only)
npx tsx src/cli.ts render projects/my-client.yaml --dry-run
```

### Re-running Individual Steps

To re-run a specific step (e.g., regenerate slides after changing content):

1. Edit `output/{slug}/.pipeline-state.json`
2. Set the step's `status` to `"pending"` (and any downstream steps too)
3. Run `npx tsx src/cli.ts resume projects/{slug}.yaml`

Common re-run patterns:
- Changed slide content → reset `slides` + `compose`
- Changed scripts → reset `tts` + `slides` + `mix_audio` + `compose`
- Changed music style → reset `music` + `mix_audio` + `compose`
- Changed video prompts → reset `video` + `slides` + `compose`

## Voice Options

ElevenLabs voices available via Kie.ai:

| Voice ID | Style |
|----------|-------|
| Daniel | British male, professional, warm |
| Rachel | American female, clear, conversational |
| Adam | American male, deep, authoritative |
| Emily | British female, friendly, energetic |
| Sam | American male, casual, young |

Adjust `settings.speed` (0.7-1.2) and `settings.stability` (0-1) to fine-tune delivery.

## Music Options

### AI-generated (Suno)

```yaml
music:
  provider: suno
  mode: instrumental
  style: "Corporate upbeat inspirational"    # Be descriptive
  negative_tags: "Heavy Metal, Aggressive"   # What to avoid
```

### Local file

```yaml
music:
  provider: local
  local_file: "../../assets/client-name/background.mp3"
```

## Outputs Produced

| File | Location | Description |
|------|----------|-------------|
| Final video | `output/{slug}/{slug}.mp4` | Complete video with voiceover, music, visuals, slides |
| Voiceover clips | `output/{slug}/audio/voiceover/*.mp3` | Individual per-scene narration |
| Mixed audio | `output/{slug}/audio/mixed/final-mix.mp3` | Full voiceover + music track |
| Music | `output/{slug}/audio/music/background.mp3` | AI-generated background music |
| Video clips | `output/{slug}/video/clips/*.mp4` | Per-scene AI video clips |
| Combined video | `output/{slug}/video/raw/combined.mp4` | All clips interleaved (no audio) |
| Slide images | `output/{slug}/slides/images/*.png` | Branded info-card PNGs |
| Slide clips | `output/{slug}/slides/clips/*.mp4` | Ken Burns animated slide videos |
| Research | `output/{slug}/research/*.json` | Exa.ai research results (if enabled) |
| Enhanced scripts | `output/{slug}/enhanced/*.json` | Claude-improved voiceover scripts |
| Pipeline state | `output/{slug}/.pipeline-state.json` | Step completion tracking |

All per-scene files use the scene/segment `id` as filename, making them easy to identify and selectively regenerate.

## Environment Setup

Required in `.env` (project root):
```
KIE_API_KEY=your_kie_api_key           # Required: TTS, music, video generation
EXA_API_KEY=your_exa_api_key           # Optional: deep research step
```

Required on system:
- Node.js 18+
- FFmpeg 7+ on PATH

## Checklist for New Projects

- [ ] Copy `_template.yaml` → `pipeline/projects/{slug}.yaml`
- [ ] Set unique `project.slug` (determines output directory)
- [ ] Create `assets/{client}/` and add client images (if any)
- [ ] Write scene scripts (voiceover text)
- [ ] Add video prompts (for AI video generation)
- [ ] Add slide content (title, stat, tagline per scene)
- [ ] Customize brand colors in `slides.style` (gradient, accent color)
- [ ] Choose voice (`voice.voice_id`)
- [ ] Set music style (`music.style`)
- [ ] Dry run to validate: `npx tsx src/cli.ts render projects/{slug}.yaml --dry-run`
- [ ] Full run: `npx tsx src/cli.ts render projects/{slug}.yaml`
- [ ] Review output at `output/{slug}/{slug}.mp4`
