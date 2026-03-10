// Shared types for the video production pipeline

export interface ProjectConfig {
  version: string;
  project: {
    name: string;
    slug: string;
    description?: string;
  };
  output: OutputConfig;
  voice: VoiceConfig;
  music: MusicConfig;
  visual: VisualConfig;
  audio_mix: AudioMixConfig;
  slides?: SlideConfig;
  scenes: SceneConfig[];
}

export interface OutputConfig {
  directory: string;
  resolution: { width: number; height: number };
  fps: number;
  codec: string;
  audio_bitrate: string;
  crf: number;
  max_file_size_mb?: number;
}

export interface VoiceConfig {
  provider: "elevenlabs";
  model: string;
  voice_id: string;
  settings: {
    stability: number;
    similarity_boost: number;
    style: number;
    speed: number;
  };
}

export interface MusicConfig {
  provider: "suno" | "local";
  mode?: "instrumental" | "custom";
  style?: string;
  title?: string;
  version?: string;
  local_file?: string;
  negative_tags?: string;
}

export interface VisualConfig {
  source: "react-capture" | "ai-generate" | "local-file" | "image-to-video";
  react_capture?: {
    dev_server_url: string;
    startup_command: string;
    viewport: { width: number; height: number };
    hide_cursor: boolean;
    recording_timeout_ms: number;
    wait_after_load_ms: number;
    per_segment: boolean;
  };
  ai_generate?: {
    provider: "veo" | "runway";
    model?: string;
    aspect_ratio?: string;
  };
  local_file?: string;
}

export interface AudioMixConfig {
  voiceover_volume_db: number;
  music_volume_db: number;
  music_duck_db: number;
  fade_in_seconds: number;
  fade_out_seconds: number;
  gap_between_scenes_seconds: number;
}

export interface SceneSegment {
  id: string;
  script: string;
  duration_hint_ms: number;
  image?: string;
  video_prompt?: string;
  slide_title?: string;
  slide_stat?: string;
  slide_tagline?: string;
}

export interface SceneConfig {
  id: string;
  duration_hint_ms: number;
  script?: string;
  image?: string;
  video_prompt?: string;
  transition?: string;
  segments?: SceneSegment[];
  slide_title?: string;
  slide_stat?: string;
  slide_tagline?: string;
}

// Pipeline state types
export type StepName = "research" | "enhance" | "tts" | "music" | "video" | "slides" | "mix_audio" | "compose" | "verify";
export type StepStatus = "pending" | "running" | "completed" | "failed";

export interface StepOutput {
  file?: string;
  files?: Record<string, { file: string; duration_ms: number }>;
  clips?: VideoClipInfo[];
  duration_ms?: number;
}

export interface StepState {
  status: StepStatus;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  error?: string;
  outputs?: StepOutput;
}

export interface PipelineState {
  config_hash: string;
  started_at: string;
  project_slug: string;
  steps: Record<StepName, StepState>;
}

// Slide generation types
export interface SlideStyle {
  canvas_width?: number;
  canvas_height?: number;
  background_gradient?: string[];
  title_font_size?: number;
  stat_font_size?: number;
  tagline_font_size?: number;
  title_color?: string;
  stat_color?: string;
  tagline_color?: string;
  accent_line_color?: string;
  font_family?: string;
  font_path?: string;
  min_slide_duration_sec?: number;
  ken_burns_zoom?: number;
  duration_offset_sec?: number;  // Trim each slide duration (negative = shorter). Default: -1.0
}

export interface SlideConfig {
  enabled: boolean;
  style?: SlideStyle;
}

export interface SlideContent {
  title: string;
  stat?: string;
  tagline?: string;
}

export interface VideoClipInfo {
  sceneId: string;
  file: string;
  duration_ms: number;
}

export interface SlideResult {
  sceneId: string;
  imageFile: string;
  videoFile: string;
  duration_ms: number;
}

// Kie.ai API types
export interface KieTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    recordId?: string;
  } | null;
}

export interface KieTaskStatus {
  code: number;
  msg: string;
  data: {
    taskId: string;
    model: string;
    state: "waiting" | "queuing" | "generating" | "success" | "fail";
    param: string;
    resultJson: string;
    failCode: string;
    failMsg: string;
    costTime: number;
    completeTime: number;
    createTime: number;
    updateTime: number;
    progress: number;
  } | null;
}

export interface KieVideoResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  } | null;
}

export interface TTSResult {
  sceneId: string;
  file: string;
  duration_ms: number;
}

export interface MusicResult {
  file: string;
  duration_ms: number;
}

export interface VideoResult {
  file: string;
  duration_ms: number;
  clips?: VideoClipInfo[];
}
