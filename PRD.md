# PRD: Education Power Team — Animated Explainer Video with Voiceover

## 1. Executive Summary

The Education Power Team project aims to produce a **55–60 second animated corporate explainer video** that introduces the Education Power Team ecosystem — a complete 360° solution for educational institutes in India. The video will present each partner company and their product specialization with professional motion graphics, real imagery, and synchronized voiceover narration.

The project already has a **React + Framer Motion web-based animation** (8 scenes) that serves as the visual storyboard. The next phase involves enhancing these animations, generating professional AI voiceover audio (using platforms like ElevenLabs, Kie.ai, or similar), synchronizing audio with visuals, adding background music, and rendering the final output as an MP4 video file suitable for social media, presentations, and marketing.

**MVP Goal**: Deliver a polished 60-second MP4 video with synchronized voiceover, background music, smooth scene transitions, and professional typography — ready for distribution to school owners, college management, and educational decision makers.

## 2. Mission

**Mission Statement**: Create a compelling, professional video that positions Education Power Team as the go-to 360° partner for educational institutes, clearly communicating each partner's specialization within a cohesive brand narrative.

**Core Principles**:
1. **Professional quality** — Corporate-grade animation and audio that builds trust with decision makers
2. **Clear storytelling** — Each company gets dedicated screen time with its name, specialization, and supporting visuals
3. **Brand consistency** — Navy/blue primary palette, amber accent, Space Grotesk typography throughout
4. **Efficient production** — Leverage existing React animations + AI voice tools to minimize manual effort
5. **Distribution-ready** — Final output optimized for LinkedIn, YouTube, WhatsApp, and live presentations

## 3. Target Users

### Primary Audience (Video Viewers)
- **School owners and founders** — Planning new institutes or upgrading existing ones
- **College management committees** — Looking for infrastructure and technology partners
- **Educational trust decision makers** — Evaluating complete ecosystem solutions
- **Technical comfort**: Moderate — comfortable with presentations and social media video
- **Key needs**: Quick understanding of what Education Power Team offers, credibility signals, clear partner specializations

### Secondary User (Video Creator)
- **Project owner** — Needs to produce the video using available tools with minimal manual video editing
- **Key needs**: Streamlined workflow from existing web animations → final video file

## 4. MVP Scope

### In Scope — Core Functionality
- ✅ Generate professional AI voiceover for all 8 scenes (English, Indian-accented or neutral professional tone)
- ✅ Synchronize voiceover audio timing with existing scene animations
- ✅ Add background music (upbeat corporate/inspirational, royalty-free)
- ✅ Render final video as MP4 (1920x1080, 30fps minimum)
- ✅ Include on-screen text/subtitles synced with voiceover
- ✅ Smooth transitions between all 8 scenes
- ✅ Each partner company clearly introduced with name + specialization overlay

### In Scope — Technical
- ✅ Voiceover script finalization (from existing brief)
- ✅ AI voice generation via ElevenLabs, Kie.ai, or equivalent
- ✅ Audio mixing (voiceover + background music with proper levels)
- ✅ Screen recording or programmatic rendering of React animations
- ✅ Video compositing (visuals + audio tracks)
- ✅ Export in standard formats (MP4 H.264)

### Out of Scope
- ❌ Multiple language versions (Hindi, Tamil, etc.) — future phase
- ❌ Custom hand-drawn character animation
- ❌ Live-action footage capture
- ❌ Interactive web version with audio playback
- ❌ Social media format variants (vertical/square crops) — future phase
- ❌ Custom jingle or original music composition
- ❌ Subtitle files (SRT/VTT) as separate deliverables

## 5. User Stories

1. **As a video creator**, I want to generate natural-sounding voiceover from a script, so that I don't need to hire a voice actor.
   - *Example*: Paste the Scene 1 script "Planning to build or upgrade an educational institute?" into ElevenLabs, select a professional male/female voice, and download the audio clip.

2. **As a video creator**, I want each scene's voiceover timing to match the animation duration, so that visuals and narration stay in sync.
   - *Example*: Scene 2 runs for 7 seconds; the voiceover for Scene 2 should be paced to complete within ~6.5 seconds with natural pauses.

3. **As a video creator**, I want to capture the web animations as high-quality video frames, so that I can compose them into a final video.
   - *Example*: Use browser recording (Puppeteer, ScreenCapture API, or OBS) to capture the React app at 1080p 30fps.

4. **As a video creator**, I want to mix voiceover and background music at proper levels, so that narration is always clearly audible over music.
   - *Example*: Background music at -18dB, voiceover at -6dB, with music ducking during speech.

5. **As a viewer (school owner)**, I want to clearly see each partner company's name and what they do, so that I can understand the ecosystem quickly.
   - *Example*: "Vardhman Traders" appears on screen with "Modern Classroom Infrastructure" while voiceover explains their role.

6. **As a viewer**, I want the video to feel professional and trustworthy, so that I feel confident reaching out to Education Power Team.
   - *Example*: Consistent branding, smooth animations, professional voice, no jarring cuts.

7. **As a video creator**, I want the final video exported as a standard MP4 file, so that I can share it on WhatsApp, LinkedIn, and YouTube.
   - *Example*: `Education-Power-Team-2026.mp4`, 1080p, H.264, ~60 seconds, <50MB.

## 6. Core Architecture & Patterns

### Production Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION PIPELINE                       │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  Script   │───▶│  Voice   │───▶│  Audio   │              │
│  │Finalize   │    │Generation│    │  Files   │              │
│  │  (Text)   │    │(ElevenLabs│   │ (per     │              │
│  │           │    │ /Kie.ai)  │   │  scene)  │              │
│  └──────────┘    └──────────┘    └────┬─────┘              │
│                                       │                     │
│  ┌──────────┐    ┌──────────┐    ┌────▼─────┐    ┌───────┐│
│  │  React   │───▶│  Screen  │───▶│  Video   │───▶│ Final ││
│  │Animation │    │ Capture  │    │Compositing│   │  MP4  ││
│  │  (Vite)  │    │(Puppeteer│    │(FFmpeg)   │   │       ││
│  │          │    │ /OBS)    │    │           │   │       ││
│  └──────────┘    └──────────┘    └────┬─────┘   └───────┘│
│                                       │                     │
│  ┌──────────┐                    ┌────┘                     │
│  │Background│────────────────────┘                          │
│  │  Music   │                                               │
│  │(Royalty  │                                               │
│  │  Free)   │                                               │
│  └──────────┘                                               │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure (Proposed)

```
Education-Power-Team/
├── client/                      # Existing React animation app
│   └── src/
│       ├── components/video/    # Scene components (Scene1-8)
│       └── lib/video/           # Animation utilities & hooks
├── attached_assets/             # Images used in scenes
├── audio/                       # NEW: Audio assets
│   ├── voiceover/               # Per-scene voiceover clips
│   │   ├── scene1-hook.mp3
│   │   ├── scene2-vision.mp3
│   │   ├── scene3-modern-institute.mp3
│   │   ├── scene4-introduction.mp3
│   │   ├── scene5-infrastructure.mp3
│   │   ├── scene6-operations.mp3
│   │   ├── scene7-student-future.mp3
│   │   └── scene8-final.mp3
│   ├── music/                   # Background music track(s)
│   │   └── corporate-upbeat.mp3
│   └── mixed/                   # Final mixed audio
│       └── full-mix.mp3
├── video/                       # NEW: Video output
│   ├── raw/                     # Screen capture output
│   ├── rendered/                # Composited video
│   │   └── education-power-team-final.mp4
│   └── scripts/                 # Automation scripts
│       ├── capture.sh           # Browser capture automation
│       └── compose.sh           # FFmpeg composition script
├── scripts/                     # NEW: Voiceover & pipeline scripts
│   ├── voiceover-script.md      # Final voiceover script with timings
│   └── generate-voiceover.md    # Instructions for AI voice platforms
├── PRD.md
├── package.json
└── vite.config.ts
```

### Key Design Patterns
- **Scene-based composition**: Each scene is an independent React component with self-contained animation timing
- **Timer-driven sequencing**: `useVideoPlayer` hook advances scenes based on configured durations
- **Centralized animation presets**: Shared spring/easing/transition configurations in `lib/video/animations.ts`
- **Asset aliasing**: Vite path aliases (`@assets/`, `@/`) for clean imports

## 7. Features & Deliverables

### Feature 1: Voiceover Script & Generation
**Purpose**: Create natural, professional AI-generated voiceover for all 8 scenes

**Voiceover Script** (finalized from brief):

| Scene | Duration | Voiceover Text |
|-------|----------|---------------|
| 1 — Hook | 3s | "Planning to build or upgrade an educational institute?" |
| 2 — Vision | 7s | "Every educational institute begins with a vision. But building a future-ready institute today requires much more than infrastructure." |
| 3 — Modern Institute | 6s | "It requires smart classrooms, advanced technology, structured sports development, efficient administration, and future-ready skills." |
| 4 — Introduction | 4s | "Introducing the Education Power Team — a complete 360° ecosystem for educational institutes." |
| 5 — Infrastructure (4 segments) | 18s | "Vardhman Traders builds modern classroom and laboratory infrastructure." / "Mega Byte Systems delivers advanced IT systems, networking, and digital labs." / "Ace Power ensures reliable power backup for uninterrupted operations." / "Athletos Sports Foundation develops structured sports infrastructure and training." |
| 6 — Operations (4 segments) | 14s | "A.K. Solutions streamlines administration with ERP and automation." / "Root Square LLP manages uniforms and stationery supply systems." / "AI-LAC-DS empowers institutes with AI skills programs, AI summer camps, and AI-enabled learning platforms." / "Asperia Institute provides skill-based training programs for medical students across PAN India." |
| 7 — Student Future | 4s | "Global Foresight guides students with career counseling and higher education planning." |
| 8 — Final | 4s | "One powerful ecosystem for building the future of education." |

**Voice Generation Platforms** (recommended):
- **ElevenLabs** — Best quality, natural prosody, supports voice cloning. Use "Narrative" or "Corporate" voice style.
- **Kie.ai** — Good alternative with video integration capabilities
- **Murf.ai** — Corporate-focused, good Indian English voices
- **PlayHT** — Budget-friendly alternative

**Key Requirements**:
- Voice: Professional, confident, warm (male or female)
- Accent: Neutral English or light Indian English accent
- Pace: ~150 words/minute (natural corporate narration speed)
- Export: High-quality MP3 or WAV (44.1kHz, 16-bit minimum)

### Feature 2: Animation Timing Sync
**Purpose**: Ensure voiceover audio aligns precisely with visual scene transitions

**Approach**:
- Adjust `SCENE_DURATIONS` in `VideoTemplate.tsx` to match actual voiceover clip lengths
- Adjust internal step timers within each scene to match voiceover pacing
- Add small buffer (0.3–0.5s) at scene transitions for breathing room

### Feature 3: Screen Capture & Recording
**Purpose**: Capture the React animation at high quality for video composition

**Options** (ranked by recommendation):
1. **Puppeteer + ScreenCapture API** — Programmatic, repeatable, headless
2. **OBS Studio** — Manual but high quality, good for one-off recording
3. **Built-in `startRecording`/`stopRecording`** — Already wired in `useVideoPlayer` hook (MediaRecorder API)
4. **Remotion** — If migrating to a programmatic video framework (higher effort)

### Feature 4: Audio Mixing & Video Composition
**Purpose**: Combine visual capture, voiceover, and background music into final MP4

**Tools**:
- **FFmpeg** — Primary tool for audio mixing and video compositing
- Command pipeline: merge voiceover clips → overlay on background music → mux with video

**Audio Levels**:
- Voiceover: -6 dB (primary)
- Background music: -18 dB (ambient), duck to -24 dB during speech
- Fade in: 1s at start
- Fade out: 2s at end

### Feature 5: Final Output
**Purpose**: Deliver distribution-ready video file

**Specifications**:
- Resolution: 1920x1080 (16:9)
- Frame rate: 30fps
- Codec: H.264 (MP4 container)
- Audio: AAC 192kbps stereo
- Duration: 55–60 seconds
- File size target: <50MB
- Filename: `Education-Power-Team-2026.mp4`

## 8. Technology Stack

### Existing (Animation Layer)
- **React 19.2** — UI framework
- **Framer Motion 12.x** — Primary animation engine
- **Vite 7.1** — Dev server and build tool
- **Tailwind CSS 4.1** — Styling
- **TypeScript 5.6** — Type safety

### New (Production Pipeline)
| Category | Tool | Purpose |
|----------|------|---------|
| Voice Generation | ElevenLabs / Kie.ai / Murf.ai | AI voiceover narration |
| Screen Capture | OBS Studio / Puppeteer | Record web animations |
| Audio Mixing | FFmpeg / Audacity | Mix voiceover + music |
| Video Compositing | FFmpeg | Mux audio + video, encode |
| Background Music | Pixabay / Artlist / Epidemic Sound | Royalty-free corporate music |

### Optional / Future
- **Remotion** — Programmatic React video rendering (avoids screen capture)
- **Whisper** — Auto-generate subtitle files from voiceover
- **After Effects / DaVinci Resolve** — Manual polish if needed

## 9. Security & Configuration

### Configuration
- No API keys needed in the codebase (voice generation done via external platform UIs)
- If automating ElevenLabs via API:
  - Store API key in `.env` (add to `.gitignore`)
  - `ELEVENLABS_API_KEY=sk-...`

### Security Scope
- ✅ In scope: Keep API keys out of git, use `.gitignore` for audio/video assets
- ❌ Out of scope: Authentication, user accounts, server security (no backend)

### Deployment
- Final video is a static asset — no deployment infrastructure needed
- React app can be served via `vite dev` for capture purposes only

## 10. Voiceover Generation Workflow

### Step-by-Step: ElevenLabs

1. **Create account** at elevenlabs.io
2. **Select voice**: Browse "Professional" category → choose a voice with warm, corporate tone
3. **Configure settings**: Stability: 0.5, Similarity: 0.75, Style: 0.3
4. **Generate per-scene**: Paste each scene's script text, generate, download as MP3
5. **Name files**: `scene1-hook.mp3`, `scene2-vision.mp3`, etc.
6. **Review timing**: Ensure each clip fits within the scene duration (trim/regen if needed)

### Step-by-Step: Kie.ai (Alternative)

1. **Upload script** as a complete narration or scene-by-scene
2. **Select avatar/voice** with professional presentation style
3. **Export audio-only** or use their video generation for additional visual elements
4. **Download** and integrate into the pipeline

### FFmpeg Composition Commands

```bash
# 1. Concatenate voiceover clips
ffmpeg -f concat -safe 0 -i voiceover-list.txt -c copy audio/mixed/voiceover-full.mp3

# 2. Mix voiceover with background music (music ducked)
ffmpeg -i audio/mixed/voiceover-full.mp3 -i audio/music/corporate-upbeat.mp3 \
  -filter_complex "[1:a]volume=0.15[music];[0:a][music]amix=inputs=2:duration=first[out]" \
  -map "[out]" audio/mixed/full-mix.mp3

# 3. Mux video + mixed audio
ffmpeg -i video/raw/screen-capture.mp4 -i audio/mixed/full-mix.mp3 \
  -c:v libx264 -crf 18 -preset slow \
  -c:a aac -b:a 192k \
  -shortest \
  video/rendered/education-power-team-final.mp4
```

## 11. Success Criteria

### MVP Success Definition
A single MP4 video file that can be shared with potential clients and played at meetings.

### Functional Requirements
- ✅ All 8 scenes present with smooth transitions
- ✅ Voiceover narration covers all partner companies by name
- ✅ Each company's specialization is clearly stated (audio + text overlay)
- ✅ Background music plays throughout without overpowering narration
- ✅ Video duration: 55–60 seconds
- ✅ Resolution: 1920x1080 minimum
- ✅ Audio quality: Clear, no artifacts, proper levels

### Quality Indicators
- Professional feel comparable to corporate explainer videos
- Brand colors (navy, blue, amber) consistent throughout
- No visual glitches, frame drops, or audio sync issues
- Text is readable at all times

### Companies Covered (all 9 must appear):
- ✅ Vardhman Traders — Classroom & lab infrastructure
- ✅ Mega Byte Systems — IT systems, networking, digital labs
- ✅ Ace Power — Power backup
- ✅ Athletos Sports Foundation — Sports infrastructure & training
- ✅ A.K. Solutions — ERP & automation
- ✅ Root Square LLP — Uniforms & stationery
- ✅ AI-LAC-DS — AI skills programs & learning platforms
- ✅ Asperia Institute — Medical skill training
- ✅ Global Foresight — Career counseling & higher education

## 12. Implementation Phases

### Phase 1: Script & Voiceover (Day 1)
**Goal**: Finalize script and generate all voiceover audio clips

**Deliverables**:
- ✅ Finalized voiceover script with per-scene timing
- ✅ 8 voiceover audio clips (one per scene, or segmented for Scenes 5 & 6)
- ✅ Voice selection and style locked in
- ✅ Audio clips reviewed for quality, pacing, and pronunciation

**Validation**: Each clip fits its scene duration (±0.5s tolerance)

### Phase 2: Animation Tuning & Capture (Day 1–2)
**Goal**: Adjust animation timings to match voiceover, capture high-quality video

**Deliverables**:
- ✅ `SCENE_DURATIONS` updated to match voiceover clip lengths
- ✅ Internal scene step timers adjusted for sync
- ✅ High-quality screen capture of full animation loop (1080p, 30fps)
- ✅ Visual review: all scenes render correctly, no glitches

**Validation**: Playback of raw capture matches voiceover timing when overlaid manually

### Phase 3: Audio Mixing & Composition (Day 2)
**Goal**: Mix audio tracks and compose final video

**Deliverables**:
- ✅ Background music selected (royalty-free, corporate upbeat)
- ✅ Voiceover clips concatenated with proper gaps
- ✅ Mixed audio track (voiceover + music, proper levels)
- ✅ Final MP4 composed with FFmpeg (video + mixed audio)
- ✅ Quality check: full playback review

**Validation**: Final video plays correctly on multiple devices/players

### Phase 4: Polish & Delivery (Day 2–3)
**Goal**: Final review, adjustments, and delivery

**Deliverables**:
- ✅ Any timing or audio level adjustments
- ✅ Final MP4 exported with optimal compression
- ✅ Test playback on mobile (WhatsApp), desktop, and web (YouTube/LinkedIn)
- ✅ Video file delivered and backed up

**Validation**: Stakeholder approval, video plays correctly across platforms

## 13. Future Considerations

### Post-MVP Enhancements
- **Multi-language versions**: Hindi, Tamil, Telugu voiceovers for regional reach
- **Social media cuts**: Vertical (9:16) for Instagram Reels/YouTube Shorts, square (1:1) for LinkedIn
- **Subtitle files**: SRT/VTT for accessibility and silent autoplay
- **Extended version**: 90–120 second version with deeper company profiles
- **Remotion migration**: Move from screen-capture to programmatic rendering for repeatable, pixel-perfect output

### Integration Opportunities
- **Kie.ai video generation**: Use their platform to generate additional visual elements or talking-head segments
- **Website embedding**: Host video on landing page with CTA
- **CRM integration**: Embed in email sequences to educational institute leads
- **QR code**: Physical brochure → video link

### Advanced Features
- Interactive video (clickable company segments)
- Personalized videos per prospect (dynamic company name insertion)
- Analytics-tracked video hosting (Wistia, Vidyard)

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **AI voice sounds robotic or unnatural** | High — undermines professional credibility | Test multiple voices on ElevenLabs; use manual adjustments (stability/similarity sliders); consider Murf.ai which has corporate-tuned Indian voices |
| **Voiceover timing doesn't match animation** | High — jarring viewer experience | Generate voiceover first, then adjust `SCENE_DURATIONS` to match audio lengths; add 0.3s buffers between scenes |
| **Screen capture quality issues** (frame drops, blur) | Medium — unprofessional output | Use OBS Studio with hardware encoding; ensure no other heavy processes during capture; consider Puppeteer for deterministic rendering |
| **Background music licensing issues** | Medium — legal risk for commercial use | Use explicitly royalty-free sources (Pixabay, YouTube Audio Library); verify commercial use license before download |
| **Scene 5 & 6 are too dense** (4 companies each in limited time) | Medium — information overload | Ensure each company gets minimum 3 seconds; consider extending these scenes slightly; use clear text overlays as visual anchors |

## 15. Appendix

### Partner Companies Reference

| Company | Domain | Scene |
|---------|--------|-------|
| Vardhman Traders | Classroom & laboratory infrastructure | 5 |
| Mega Byte Systems | IT systems, networking, digital labs | 5 |
| Ace Power | Power backup solutions | 5 |
| Athletos Sports Foundation | Sports infrastructure & training | 5 |
| A.K. Solutions | ERP & administrative automation | 6 |
| Root Square LLP | Uniforms & stationery supply | 6 |
| AI-LAC-DS | AI skills, summer camps, learning platforms | 6 |
| Asperia Institute | Medical skill training (PAN India) | 6 |
| Global Foresight | Career counseling & higher education | 7 |

### Existing Assets
- **Images**: 18 images in `attached_assets/` (campuses, labs, classrooms, students)
- **Video brief**: 2 text files in `attached_assets/` with full script and visual guidelines
- **Existing video**: `Skill-Medical-AI-Mar-9-14-52-21.mp4` (reference/sample)
- **React app**: 8 scene components with full animation in `client/src/components/video/`

### Brand Guidelines
- **Primary**: #1E3A8A (Navy)
- **Secondary**: #3B82F6 (Blue)
- **Accent**: #F59E0B (Amber)
- **Display font**: Space Grotesk
- **Body font**: DM Sans
- **Tone**: Professional, confident, forward-looking
