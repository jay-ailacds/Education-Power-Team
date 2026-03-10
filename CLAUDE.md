# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered video production platform. Takes a YAML project config describing scenes, voice, music, and visual settings, then produces a polished MP4 video with synchronized voiceover, background music, and animated visuals.

Two complementary systems work together:
- **`client/`** — React + Framer Motion animated scene preview (runs in browser via Vite)
- **`pipeline/`** — Node.js CLI that orchestrates the full production pipeline (TTS, music, video, mixing, composition)

The current project (`education-power-team`) is a 60-second explainer video for an educational institute ecosystem in India, but the platform is designed for any video project.

## Repository Structure

```
Education-Power-Team/
├── client/                    # React video scene app (Vite, Tailwind v4, Framer Motion)
│   ├── src/
│   │   ├── App.tsx           # Root — renders VideoTemplate
│   │   ├── components/video/
│   │   │   ├── VideoTemplate.tsx    # Scene sequencing + durations
│   │   │   └── video_scenes/       # 8 self-contained scene components
│   │   └── lib/video/
│   │       ├── hooks.ts      # useVideoPlayer (recording lifecycle), useSceneTimer
│   │       └── animations.ts # Framer Motion transition presets
│   └── index.html            # Google Fonts: DM Sans, JetBrains Mono, Space Grotesk
├── pipeline/                  # Production CLI (see pipeline/CLAUDE.md for details)
│   ├── src/                  # TypeScript source (tsx runtime, no build step)
│   ├── projects/             # YAML project configs
│   └── CLAUDE.md             # Pipeline-specific guidance
├── assets/                    # Source images shared by client and pipeline
├── output/                    # Pipeline outputs, scoped by project slug
│   └── {project-slug}/       # Each project gets its own directory
│       ├── .pipeline-state.json  # Step completion tracking
│       ├── enhanced/             # Enhanced scripts + comparison
│       ├── research/             # Exa.ai research results
│       ├── audio/                # TTS clips, music, mixed audio
│       ├── video/                # Video clips and combined output
│       ├── slides/               # Generated slide images and clips
│       └── {slug}.mp4           # Final output
├── .agents/
│   ├── plans/                # Implementation plans
│   └── guides/               # Setup guides
├── PRD.md                    # Product requirements document
└── vite.config.ts            # Vite config (root-level, serves client/)
```

## Build & Run Commands

```bash
# Client (React preview)
npm run dev:client                    # Vite dev server on port 5000
npm run build                         # Build client to dist/public
npm run check                         # TypeScript check (client + shared)

# Pipeline (see pipeline/CLAUDE.md for full command reference)
cd pipeline
npx tsx src/cli.ts render projects/education-power-team.yaml    # Full pipeline
npx tsx src/cli.ts status projects/education-power-team.yaml    # Check progress
npx tsx src/cli.ts resume projects/education-power-team.yaml    # Resume from last step

# Type checking
npx tsc --noEmit                      # Root tsconfig (client)
cd pipeline && npx tsc --noEmit       # Pipeline tsconfig
```

No test or lint commands are configured for either project.

## Architecture: How Client and Pipeline Relate

The **client** is a browser-based preview/authoring tool. The **pipeline** is the production engine. They share `assets/` images but no code.

```
                    ┌─────────────────────────────────┐
                    │         YAML Config             │
                    │   (scenes, voice, music, etc.)  │
                    └──────────────┬──────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
    ┌─────────▼──────────┐  ┌─────▼──────┐  ┌──────────▼─────────┐
    │  client/ (React)   │  │ Kie.ai API │  │  Local MP4 file    │
    │  react-capture     │  │ AI video   │  │  local-file source │
    │  via Playwright    │  │ generation │  │                    │
    └─────────┬──────────┘  └─────┬──────┘  └──────────┬─────────┘
              │                    │                     │
              └────────────────────┼─────────────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │  pipeline/ (Node.js CLI)        │
                    │  TTS → Music → Mix → Compose    │
                    └──────────────┬──────────────────┘
                                   │
                         ┌─────────▼─────────┐
                         │   Final MP4       │
                         └───────────────────┘
```

### Visual Source Options

The pipeline supports 4 visual sources (configured in YAML `visual.source`):

| Source | Description | Status |
|--------|-------------|--------|
| `image-to-video` | AI-generated clips from images + prompts via Kie.ai | Working |
| `ai-generate` | AI-generated clips from text prompts only | Working |
| `local-file` | Use a pre-recorded MP4 file | Working |
| `react-capture` | Automated Playwright recording of React scenes | Planned (see `.agents/plans/implement-react-capture.md`) |

## Key Design Decisions

- **No LLM API for enhancements**: The `enhance` step loads pre-generated `enhanced-scripts.json` from disk. Enhancements are created by Claude in the active session, NOT by calling Kie.ai's chat API. Only use Kie.ai for TTS, music, and video generation.
- **Per-segment granularity**: Both `video-gen.ts` and the planned `react-capture` flatten scenes with segments into individual clips (14 clips for the current project), enabling selective re-generation of any segment.
- **Config-driven**: All project settings live in YAML files under `pipeline/projects/`. New video projects = new YAML config (see `.agents/guides/new-project-setup.md`).
- **Idempotent pipeline**: Each step is tracked in `.pipeline-state.json`. Steps can be individually rerun with `--force` or the pipeline resumes automatically.
- **Multi-project isolation**: Output is auto-scoped by `project.slug` — each project gets its own directory under `output/{slug}/`. Multiple projects can coexist without overwriting each other.

## Client Conventions

- **Vite config** at repo root: `root: client/`, server on `0.0.0.0:5000`
- **Path aliases**: `@/` → `client/src/`, `@assets/` → `assets/`, `@shared/` → `shared/`
- **Tailwind v4** with CSS-first config (no `tailwind.config.js`)
- **Scene components** are self-contained — they receive NO props and manage their own animations, images, and timing internally
- **Recording hooks**: `useVideoPlayer` calls `window.startRecording()` on mount and `window.stopRecording()` when the video ends. These are consumed by Playwright during react-capture.

## Environment

- **Runtime**: Node.js with ESM (`"type": "module"`)
- **Client**: React 19, Framer Motion, Tailwind v4, Vite 7
- **Pipeline**: TypeScript via `tsx` (no build step), Commander.js CLI
- **Required**: `KIE_API_KEY` in `.env` (for pipeline TTS/music/video)
- **Optional**: `EXA_API_KEY` in `.env` (for pipeline research step)
- **Required external**: FFmpeg 7+ on PATH (for pipeline audio/video processing)

## Reference Documents

- `PRD.md` — Product requirements document
- `pipeline/CLAUDE.md` — Pipeline-specific build commands and architecture details
- `.agents/plans/implement-react-capture.md` — Implementation plan for automated browser recording
- `.agents/guides/new-project-setup.md` — Guide for creating new video projects
