---
description: "Generate AI voiceover script and audio files for the Education Power Team video scenes"
---

# Generate Voiceover for Video Scenes

Generate the voiceover script, create platform-ready text for AI voice generation, and prepare audio files for video composition.

## Input

$ARGUMENTS — Optional: voice platform preference, voice gender, script modifications.

Defaults: ElevenLabs, professional neutral voice, original brief script.

## Workflow

### Step 1: Read Current Scene Structure

Read `client/src/components/video/VideoTemplate.tsx` to get current scene durations.
Read `attached_assets/Pasted-Create-a-55-60-second-animated-corporate-explainer-vide_1773047153064.txt` for the original script brief.

### Step 2: Generate Script File

Create `scripts/voiceover-script.md` with:
- Per-scene voiceover text
- Target duration for each clip
- Pronunciation notes (e.g., "AI-LAC-DS" = "A.I. lack D.S.", "PAN India" = "pan India")
- Pacing instructions

### Step 3: Create Platform-Ready Text Blocks

Create `scripts/elevenlabs-prompts.md` with copy-paste ready text blocks for each scene, including SSML tags or natural pause markers where needed:

```
Scene 1 (target: 3s):
"Planning to build or upgrade an educational institute?"

Scene 2 (target: 7s):
"Every educational institute begins with a vision... But building a future-ready institute today, requires much more than infrastructure."
```

Add natural pause markers (commas, ellipses) to control pacing.

### Step 4: Provide Generation Instructions

Output clear step-by-step instructions for the chosen platform with:
- Recommended voice selection
- Settings/parameters
- File naming convention: `audio/voiceover/scene{N}-{label}.mp3`
- How to verify clip durations match target

### Step 5: Post-Generation — Measure & Report

After user generates audio files, measure durations:
```bash
mkdir -p audio/voiceover
for f in audio/voiceover/scene*.mp3; do
  duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null)
  echo "$(basename $f): ${duration}s"
done
```

Report any clips that need regeneration (too long/short for their scene).

### Step 6: Update Scene Timings

Update `SCENE_DURATIONS` in `VideoTemplate.tsx` to match actual voiceover durations + 500ms buffer per scene. Update internal step timers in Scene5.tsx and Scene6.tsx to match per-company clip lengths.

## File Naming Convention

```
audio/voiceover/
  scene1-hook.mp3
  scene2-vision.mp3
  scene3-modern.mp3
  scene4-intro.mp3
  scene5a-vardhman.mp3
  scene5b-megabyte.mp3
  scene5c-acepower.mp3
  scene5d-athletos.mp3
  scene6a-aksolutions.mp3
  scene6b-rootsquare.mp3
  scene6c-ailacds.mp3
  scene6d-asperia.mp3
  scene7-foresight.mp3
  scene8-final.mp3
```
