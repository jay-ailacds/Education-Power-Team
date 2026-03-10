import { z } from "zod";

const resolutionSchema = z.object({
  width: z.number().min(640).max(3840).default(1920),
  height: z.number().min(360).max(2160).default(1080),
});

const outputSchema = z.object({
  directory: z.string().default("../video/rendered"),
  resolution: resolutionSchema.default({ width: 1920, height: 1080 }),
  fps: z.number().min(24).max(60).default(30),
  codec: z.string().default("h264"),
  audio_bitrate: z.string().default("192k"),
  crf: z.number().min(0).max(51).default(18),
  max_file_size_mb: z.number().optional(),
});

const voiceSchema = z.object({
  provider: z.literal("elevenlabs").default("elevenlabs"),
  model: z.string().default("elevenlabs/text-to-speech-multilingual-v2"),
  voice_id: z.string().default("Rachel"),
  settings: z
    .object({
      stability: z.number().min(0).max(1).default(0.5),
      similarity_boost: z.number().min(0).max(1).default(0.75),
      style: z.number().min(0).max(1).default(0.3),
      speed: z.number().min(0.7).max(1.2).default(1.0),
    })
    .default({}),
});

const musicSchema = z.object({
  provider: z.enum(["suno", "local"]).default("suno"),
  mode: z.enum(["instrumental", "custom"]).default("instrumental"),
  style: z.string().optional(),
  title: z.string().optional(),
  version: z.string().default("V4"),
  local_file: z.string().optional(),
  negative_tags: z.string().optional(),
});

const visualSchema = z.object({
  source: z
    .enum(["react-capture", "ai-generate", "local-file", "image-to-video"])
    .default("image-to-video"),
  react_capture: z
    .object({
      dev_server_url: z.string().url().default("http://localhost:5000"),
      startup_command: z.string().default("npm run dev:client"),
      viewport: resolutionSchema.default({ width: 1920, height: 1080 }),
      hide_cursor: z.boolean().default(true),
      recording_timeout_ms: z.number().default(120000),
      wait_after_load_ms: z.number().default(1000),
      per_segment: z.boolean().default(true),
    })
    .optional(),
  ai_generate: z
    .object({
      provider: z.enum(["veo", "runway"]).default("veo"),
      model: z.string().optional(),
      aspect_ratio: z.string().default("16:9"),
    })
    .optional(),
  local_file: z.string().optional(),
});

const audioMixSchema = z.object({
  voiceover_volume_db: z.number().default(-6),
  music_volume_db: z.number().default(-18),
  music_duck_db: z.number().default(-24),
  fade_in_seconds: z.number().default(1.0),
  fade_out_seconds: z.number().default(2.0),
  gap_between_scenes_seconds: z.number().default(0.3),
});

const sceneSegmentSchema = z.object({
  id: z.string(),
  script: z.string(),
  duration_hint_ms: z.number().min(500).default(4000),
  image: z.string().optional(),
  video_prompt: z.string().optional(),
  slide_title: z.string().optional(),
  slide_stat: z.string().optional(),
  slide_tagline: z.string().optional(),
});

const sceneSchema = z.object({
  id: z.string(),
  duration_hint_ms: z.number().min(500).default(4000),
  script: z.string().optional(),
  image: z.string().optional(),
  video_prompt: z.string().optional(),
  transition: z.string().optional(),
  segments: z.array(sceneSegmentSchema).optional(),
  slide_title: z.string().optional(),
  slide_stat: z.string().optional(),
  slide_tagline: z.string().optional(),
});

const slideStyleSchema = z.object({
  canvas_width: z.number().default(1920),
  canvas_height: z.number().default(1080),
  background_gradient: z.array(z.string()).default(["#1a1a2e", "#16213e", "#0f3460"]),
  title_font_size: z.number().default(64),
  stat_font_size: z.number().default(48),
  tagline_font_size: z.number().default(32),
  title_color: z.string().default("#ffffff"),
  stat_color: z.string().default("#00d4ff"),
  tagline_color: z.string().default("#cccccc"),
  accent_line_color: z.string().default("#00d4ff"),
  font_family: z.string().default("Avenir Next"),
  font_path: z.string().default("/System/Library/Fonts/Avenir Next.ttc"),
  min_slide_duration_sec: z.number().default(2.0),
  ken_burns_zoom: z.number().min(1.0).max(1.3).default(1.08),
  duration_offset_sec: z.number().min(-5).max(0).default(-1.0),
});

const slideConfigSchema = z.object({
  enabled: z.boolean().default(false),
  style: slideStyleSchema.optional(),
});

export const projectConfigSchema = z.object({
  version: z.string().default("1.0"),
  project: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string().optional(),
  }),
  output: outputSchema.default({}),
  voice: voiceSchema.default({}),
  music: musicSchema.default({}),
  visual: visualSchema.default({}),
  audio_mix: audioMixSchema.default({}),
  slides: slideConfigSchema.optional(),
  scenes: z.array(sceneSchema).min(1),
});

export type ValidatedConfig = z.infer<typeof projectConfigSchema>;
