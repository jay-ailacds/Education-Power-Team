import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { logger } from "../core/logger.ts";

export interface ProbeResult {
  duration: number;
  width?: number;
  height?: number;
  codec?: string;
  sample_rate?: number;
}

export async function ffprobe(filePath: string): Promise<ProbeResult> {
  const args = [
    "-v", "error",
    "-show_entries", "format=duration",
    "-show_entries", "stream=width,height,codec_name,sample_rate",
    "-of", "json",
    filePath,
  ];

  const output = await runCommand("ffprobe", args);
  const data = JSON.parse(output);

  const stream = data.streams?.[0] || {};
  const format = data.format || {};

  return {
    duration: parseFloat(format.duration || "0"),
    width: stream.width,
    height: stream.height,
    codec: stream.codec_name,
    sample_rate: stream.sample_rate ? parseInt(stream.sample_rate) : undefined,
  };
}

export async function ffmpegConcat(
  inputFiles: string[],
  outputFile: string
): Promise<void> {
  // Create a concat list file
  const listContent = inputFiles.map((f) => `file '${f}'`).join("\n");
  const listFile = outputFile + ".concat.txt";
  writeFileSync(listFile, listContent);

  await runCommand("ffmpeg", [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listFile,
    "-c", "copy",
    outputFile,
  ]);
}

export async function ffmpegConcatReencode(
  inputFiles: string[],
  outputFile: string,
  options?: { width?: number; height?: number; fps?: number }
): Promise<void> {
  // Re-encode all clips to same format before concatenating
  const listContent = inputFiles.map((f) => `file '${f}'`).join("\n");
  const listFile = outputFile + ".concat.txt";
  writeFileSync(listFile, listContent);

  const vfParts: string[] = [];
  if (options?.width && options?.height) {
    vfParts.push(`scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease`);
    vfParts.push(`pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2`);
  }
  if (options?.fps) {
    vfParts.push(`fps=${options.fps}`);
  }

  const args = [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listFile,
  ];

  if (vfParts.length > 0) {
    args.push("-vf", vfParts.join(","));
  }

  args.push(
    "-c:v", "libx264",
    "-crf", "18",
    "-preset", "fast",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    outputFile
  );

  await runCommand("ffmpeg", args);
}

export async function generateSilence(
  durationSec: number,
  outputFile: string
): Promise<void> {
  await runCommand("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", `anullsrc=r=44100:cl=stereo`,
    "-t", String(durationSec),
    "-c:a", "libmp3lame",
    "-q:a", "9",
    outputFile,
  ]);
}

export async function ffmpegMixAudio(
  voiceoverFile: string,
  musicFile: string,
  outputFile: string,
  options: {
    musicVolume: number; // 0-1 scale
    fadeInSec: number;
    fadeOutSec: number;
    totalDurationSec: number;
  }
): Promise<void> {
  const { musicVolume, fadeInSec, fadeOutSec, totalDurationSec } = options;

  await runCommand("ffmpeg", [
    "-y",
    "-i", voiceoverFile,
    "-i", musicFile,
    "-filter_complex",
    [
      `[0:a]aformat=sample_rates=44100:channel_layouts=stereo[voice]`,
      `[1:a]aformat=sample_rates=44100:channel_layouts=stereo,` +
        `volume=${musicVolume},` +
        `afade=t=in:d=${fadeInSec},` +
        `afade=t=out:st=${Math.max(0, totalDurationSec - fadeOutSec)}:d=${fadeOutSec}` +
        `[music]`,
      `[voice][music]amix=inputs=2:duration=first:dropout_transition=2[out]`,
    ].join(";"),
    "-map", "[out]",
    "-ac", "2",
    "-ar", "44100",
    "-b:a", "192k",
    outputFile,
  ]);
}

export async function ffmpegMux(
  videoFile: string,
  audioFile: string,
  outputFile: string,
  options?: { crf?: number; codec?: string }
): Promise<void> {
  const crf = options?.crf ?? 18;

  await runCommand("ffmpeg", [
    "-y",
    "-i", videoFile,
    "-i", audioFile,
    "-c:v", "libx264",
    "-crf", String(crf),
    "-preset", "slow",
    "-c:a", "aac",
    "-b:a", "192k",
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-movflags", "+faststart",
    outputFile,
  ]);
}

export async function ffmpegTrimAudio(
  inputFile: string,
  outputFile: string,
  durationSec: number,
  fadeOutSec: number = 2
): Promise<void> {
  await runCommand("ffmpeg", [
    "-y",
    "-stream_loop", "-1",   // Loop music if shorter than target duration
    "-i", inputFile,
    "-t", String(durationSec),
    "-af", `afade=t=out:st=${Math.max(0, durationSec - fadeOutSec)}:d=${fadeOutSec}`,
    "-c:a", "libmp3lame",
    "-q:a", "2",
    outputFile,
  ]);
}

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

export async function ffmpegImageToVideo(
  imagePath: string,
  outputFile: string,
  options: {
    durationSec: number;
    width: number;
    height: number;
    fps: number;
    zoom?: number;
  }
): Promise<void> {
  const { durationSec, width, height, fps, zoom = 1.08 } = options;
  const totalFrames = Math.ceil(durationSec * fps);
  const zoomIncrement = (zoom - 1.0) / totalFrames;

  const vf = [
    `scale=8000:-1`,
    `zoompan=z='min(1.0+${zoomIncrement}*on\\,${zoom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`,
  ].join(",");

  await runCommand("ffmpeg", [
    "-y",
    "-loop", "1",
    "-framerate", String(fps),
    "-i", imagePath,
    "-vf", vf,
    "-t", String(durationSec),
    "-c:v", "libx264",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputFile,
  ]);
}

function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    logger.debug(`${cmd} ${args.join(" ")}`);

    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => (stdout += chunk));
    proc.stderr.on("data", (chunk) => (stderr += chunk));

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn ${cmd}: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(`${cmd} exited with code ${code}\n${stderr.slice(-500)}`)
        );
      } else {
        resolve(stdout);
      }
    });
  });
}
