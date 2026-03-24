---
description: "Create a polished explainer video with AI voiceover, animations, and background music from React scene components"
---

# Create Video: Animated Explainer with AI Voiceover

Generate a production-ready MP4 video from the React animation scenes with synchronized AI voiceover narration and background music.

## Input

The user provides: optional overrides for any of the following:
- Voiceover script changes
- Voice platform preference (ElevenLabs, Kie.ai, Murf.ai, PlayHT)
- Music style or specific track
- Resolution/framerate preferences
- Duration adjustments
- $ARGUMENTS

If not specified, use the defaults from the project brief and PRD.

## Prerequisites Check

**FFmpeg must be available.** Verify before proceeding:
```bash
ffmpeg -version 2>&1 | head -1
ffprobe -version 2>&1 | head -1
```

If not installed:
- macOS: `brew install ffmpeg`
- Linux: `sudo apt install ffmpeg`

**Node.js and project dependencies must be installed:**
```bash
node -v
ls node_modules/.package-lock.json 2>/dev/null || npm install
```

## Production Pipeline

```
Script Finalize -> Voice Generate -> Animation Sync -> Screen Capture -> Audio Mix -> Video Compose -> Final MP4
```

## Workflow

### Step 1: Verify & Prepare Project

```bash
# Ensure dependencies are installed
cd "$PROJECT_ROOT"
npm install 2>/dev/null

# Create output directories
mkdir -p audio/voiceover audio/music audio/mixed video/raw video/rendered scripts
```

Read the current scene configuration:
- `client/src/components/video/VideoTemplate.tsx` — scene durations
- `client/src/components/video/video_scenes/` — all Scene1-8 components
- `attached_assets/Pasted-Create-a-55-60-second-animated-corporate-explainer-vide_1773047153064.txt` — original brief

### Step 2: Finalize Voiceover Script

Create `scripts/voiceover-script.md` with the finalized script and timing:

```markdown
# Education Power Team — Voiceover Script

| Scene | ID | Duration | Voiceover Text |
|-------|-----|----------|---------------|
| 1 | Hook | 3s | "Planning to build or upgrade an educational institute?" |
| 2 | Vision | 7s | "Every educational institute begins with a vision. But building a future-ready institute today requires much more than infrastructure." |
| 3 | Modern Institute | 6s | "It requires smart classrooms, advanced technology, structured sports development, efficient administration, and future-ready skills." |
| 4 | Introduction | 4s | "Introducing the Education Power Team — a complete 360-degree ecosystem for educational institutes." |
| 5a | Vardhman | 4.5s | "Vardhman Traders builds modern classroom and laboratory infrastructure." |
| 5b | Mega Byte | 4.5s | "Mega Byte Systems delivers advanced IT systems, networking, and digital labs." |
| 5c | Ace Power | 4.5s | "Ace Power ensures reliable power backup for uninterrupted operations." |
| 5d | Athletos | 4.5s | "Athletos Sports Foundation develops structured sports infrastructure and training." |
| 6a | AK Solutions | 3.5s | "A.K. Solutions streamlines administration with ERP and automation." |
| 6b | Root Square | 3.5s | "Root Square LLP manages uniforms and stationery supply systems." |
| 6c | AI-LAC-DS | 3.5s | "AI-LAC-DS empowers institutes with AI skills programs, AI summer camps, and AI-enabled learning platforms." |
| 6d | Asperia | 3.5s | "Asperia Institute provides skill-based training programs for medical students across PAN India." |
| 7 | Global Foresight | 4s | "Global Foresight guides students with career counseling and higher education planning." |
| 8 | Final | 4s | "One powerful ecosystem for building the future of education." |
```

### Step 3: Generate Voiceover Audio

#### Option A: ElevenLabs (Recommended — Best Quality)

1. Go to https://elevenlabs.io/speech-synthesis
2. Select a voice: "Daniel" (professional male) or "Rachel" (professional female)
3. Settings: Stability 0.50, Similarity 0.75, Style 0.30, Speaker Boost ON
4. Generate each scene's text individually
5. Download as MP3 files:
   - `audio/voiceover/scene1-hook.mp3`
   - `audio/voiceover/scene2-vision.mp3`
   - `audio/voiceover/scene3-modern.mp3`
   - `audio/voiceover/scene4-intro.mp3`
   - `audio/voiceover/scene5a-vardhman.mp3`
   - `audio/voiceover/scene5b-megabyte.mp3`
   - `audio/voiceover/scene5c-acepower.mp3`
   - `audio/voiceover/scene5d-athletos.mp3`
   - `audio/voiceover/scene6a-aksolutions.mp3`
   - `audio/voiceover/scene6b-rootsquare.mp3`
   - `audio/voiceover/scene6c-ailacds.mp3`
   - `audio/voiceover/scene6d-asperia.mp3`
   - `audio/voiceover/scene7-foresight.mp3`
   - `audio/voiceover/scene8-final.mp3`

#### Option B: ElevenLabs API (Automated)

```bash
# Requires ELEVENLABS_API_KEY in environment
# Generate a single clip:
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/VOICE_ID" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Planning to build or upgrade an educational institute?",
    "model_id": "eleven_multilingual_v2",
    "voice_settings": { "stability": 0.5, "similarity_boost": 0.75, "style": 0.3 }
  }' \
  --output audio/voiceover/scene1-hook.mp3
```

#### Option C: Kie.ai

1. Go to kie.ai, create a project
2. Paste full script, select corporate/professional voice
3. Export audio per scene or as a single track
4. Split into per-scene clips if needed using FFmpeg:
   ```bash
   ffmpeg -i full-voiceover.mp3 -ss 0 -t 3 audio/voiceover/scene1-hook.mp3
   ffmpeg -i full-voiceover.mp3 -ss 3 -t 7 audio/voiceover/scene2-vision.mp3
   # ... etc
   ```

#### Option D: Murf.ai / PlayHT

Similar web UI workflow — generate, download, name files per convention above.

### Step 4: Measure Voiceover Durations & Sync Animations

After generating all voiceover clips, measure their actual durations:

```bash
for f in audio/voiceover/*.mp3; do
  duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  echo "$(basename $f): ${duration}s"
done
```

Then update `SCENE_DURATIONS` in `client/src/components/video/VideoTemplate.tsx` to match:

```typescript
const SCENE_DURATIONS = {
  scene1: <scene1_duration_ms + 500>,  // Add 500ms buffer per scene
  scene2: <scene2_duration_ms + 500>,
  scene3: <scene3_duration_ms + 500>,
  scene4: <scene4_duration_ms + 500>,
  scene5: <scene5a + scene5b + scene5c + scene5d + 500>,
  scene6: <scene6a + scene6b + scene6c + scene6d + 500>,
  scene7: <scene7_duration_ms + 500>,
  scene8: <scene8_duration_ms + 500>,
};
```

Also update internal `setTimeout` timers within Scene5 and Scene6 components to match the per-company voiceover clip durations (so each company card transition syncs with narration).

### Step 5: Select Background Music

Download a royalty-free corporate/upbeat track:

**Recommended Sources (free for commercial use):**
- Pixabay Music: https://pixabay.com/music/ — search "corporate inspirational"
- YouTube Audio Library: https://studio.youtube.com/channel/UC/music (free with attribution)
- Mixkit: https://mixkit.co/free-stock-music/ — search "corporate"

Save to: `audio/music/background.mp3`

Trim to match video duration:
```bash
TOTAL_DURATION=60  # adjust to actual total
ffmpeg -i audio/music/background.mp3 -t $TOTAL_DURATION -af "afade=t=in:d=1,afade=t=out:st=$((TOTAL_DURATION-2)):d=2" audio/music/background-trimmed.mp3
```

### Step 6: Concatenate Voiceover Clips

Create a concat list file:
```bash
cat > audio/voiceover/concat-list.txt << 'EOF'
file 'scene1-hook.mp3'
file 'scene2-vision.mp3'
file 'scene3-modern.mp3'
file 'scene4-intro.mp3'
file 'scene5a-vardhman.mp3'
file 'scene5b-megabyte.mp3'
file 'scene5c-acepower.mp3'
file 'scene5d-athletos.mp3'
file 'scene6a-aksolutions.mp3'
file 'scene6b-rootsquare.mp3'
file 'scene6c-ailacds.mp3'
file 'scene6d-asperia.mp3'
file 'scene7-foresight.mp3'
file 'scene8-final.mp3'
EOF

# Add silence gaps between scenes (0.3s each)
# First, create a 0.3s silence file
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 0.3 -q:a 9 -acodec libmp3lame audio/voiceover/silence.mp3

# Build concat list with gaps
python3 -c "
import os
scenes = [
  'scene1-hook', 'scene2-vision', 'scene3-modern', 'scene4-intro',
  'scene5a-vardhman', 'scene5b-megabyte', 'scene5c-acepower', 'scene5d-athletos',
  'scene6a-aksolutions', 'scene6b-rootsquare', 'scene6c-ailacds', 'scene6d-asperia',
  'scene7-foresight', 'scene8-final'
]
with open('audio/voiceover/concat-with-gaps.txt', 'w') as f:
    for i, s in enumerate(scenes):
        f.write(f\"file '{s}.mp3'\n\")
        if i < len(scenes) - 1:
            f.write(f\"file 'silence.mp3'\n\")
"

# Concatenate
ffmpeg -f concat -safe 0 -i audio/voiceover/concat-with-gaps.txt -c copy audio/mixed/voiceover-full.mp3
```

### Step 7: Mix Audio Tracks

```bash
# Mix voiceover (primary) with background music (ducked)
ffmpeg -i audio/mixed/voiceover-full.mp3 -i audio/music/background-trimmed.mp3 \
  -filter_complex "\
    [0:a]volume=1.0[voice];\
    [1:a]volume=0.12[music];\
    [voice][music]amix=inputs=2:duration=first:dropout_transition=2[out]" \
  -map "[out]" -ac 2 -ar 44100 -b:a 192k \
  audio/mixed/final-mix.mp3
```

Review the mixed audio:
```bash
ffplay audio/mixed/final-mix.mp3
```

### Step 8: Capture Animation Video

#### Option A: OBS Studio (Recommended for quality)

1. Start the dev server: `npm run dev:client`
2. Open browser at http://localhost:5000 (fullscreen, 1920x1080)
3. In OBS: Window Capture, set output to 1920x1080, 30fps, CRF 18
4. Start recording, wait for full animation loop to complete
5. Stop recording, save to `video/raw/screen-capture.mp4`

#### Option B: Puppeteer (Automated)

Create `scripts/capture.mjs`:
```javascript
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: false,
  args: ['--window-size=1920,1080', '--start-fullscreen']
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

// Start screen recording via Chrome DevTools Protocol
const client = await page.createCDPSession();
await client.send('Page.startScreencast', {
  format: 'png',
  maxWidth: 1920,
  maxHeight: 1080,
  everyNthFrame: 1
});

await page.goto('http://localhost:5000');

// Wait for total video duration + buffer
const TOTAL_DURATION_MS = 62000;
await new Promise(r => setTimeout(r, TOTAL_DURATION_MS));

await browser.close();
```

#### Option C: Browser MediaRecorder (Built-in)

The existing `useVideoPlayer` hook already calls `window.startRecording()` on mount. Implement it:

```typescript
// Add to client/src/lib/video/recorder.ts
export function setupRecorder() {
  const canvas = document.querySelector('canvas');
  // Or capture the entire page:
  window.startRecording = async () => {
    const stream = document.documentElement.captureStream?.(30)
      ?? (await navigator.mediaDevices.getDisplayMedia({ video: true }));
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 8_000_000
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'education-power-team-raw.webm';
      a.click();
    };
    recorder.start();
    window.stopRecording = () => recorder.stop();
  };
}
```

Then convert WebM to MP4:
```bash
ffmpeg -i education-power-team-raw.webm -c:v libx264 -crf 18 -preset slow video/raw/screen-capture.mp4
```

### Step 9: Compose Final Video

```bash
# Mux video + mixed audio into final MP4
ffmpeg -i video/raw/screen-capture.mp4 -i audio/mixed/final-mix.mp3 \
  -c:v libx264 -crf 18 -preset slow \
  -c:a aac -b:a 192k \
  -map 0:v:0 -map 1:a:0 \
  -shortest \
  -movflags +faststart \
  video/rendered/education-power-team-final.mp4
```

### Step 10: Quality Verification

```bash
# Check output specs
ffprobe -v error -show_entries format=duration,size,bit_rate -show_entries stream=codec_name,width,height,r_frame_rate -of json video/rendered/education-power-team-final.mp4

# Play for review
ffplay video/rendered/education-power-team-final.mp4
```

## Quality Checklist (Non-Negotiable)

- [ ] All 8 scenes present with smooth transitions
- [ ] All 9 partner companies mentioned by name in voiceover
- [ ] Each company's specialization clearly stated (voice + on-screen text)
- [ ] Voiceover synced with visual scene transitions (no drift >0.5s)
- [ ] Background music audible but never overpowers narration
- [ ] No audio clipping, pops, or artifacts
- [ ] Video resolution: 1920x1080 minimum
- [ ] Duration: 55-65 seconds
- [ ] No visual glitches, frame drops, or blank frames
- [ ] Brand colors consistent (navy #1E3A8A, blue #3B82F6, amber #F59E0B)
- [ ] Final file plays on: macOS QuickTime, VLC, WhatsApp, YouTube upload

## Partner Companies Reference

| Company | Specialization | Scene |
|---------|---------------|-------|
| Vardhman Traders | Classroom & lab infrastructure | 5 |
| Mega Byte Systems | IT systems, networking, digital labs | 5 |
| Ace Power | Power backup solutions | 5 |
| Athletos Sports Foundation | Sports infrastructure & training | 5 |
| A.K. Solutions | ERP & admin automation | 6 |
| Root Square LLP | Uniforms & stationery supply | 6 |
| AI-LAC-DS | AI skills, summer camps, learning platforms | 6 |
| Asperia Institute | Medical skill training (PAN India) | 6 |
| Global Foresight | Career counseling & higher education | 7 |

## Troubleshooting

- **Voiceover too fast/slow for scene**: Regenerate with adjusted pacing, or adjust `SCENE_DURATIONS` to match
- **Audio/video out of sync**: Ensure voiceover concatenation gaps match scene transition buffers
- **FFmpeg "no such filter"**: Update FFmpeg: `brew upgrade ffmpeg`
- **Screen capture has cursor**: Hide cursor via CSS `* { cursor: none !important; }` before recording
- **File too large for WhatsApp (>64MB)**: Re-encode with higher CRF: `ffmpeg -i input.mp4 -crf 28 -preset slow output.mp4`
- **Music too loud/quiet**: Adjust `volume=0.12` in Step 7 (lower = quieter music)
- **WebM to MP4 quality loss**: Use CRF 15-18 for near-lossless conversion
