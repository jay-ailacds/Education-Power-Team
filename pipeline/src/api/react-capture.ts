import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { logger } from "../core/logger.ts";
import { ffmpegConvertWebm, ffmpegConcatReencode, ffprobe } from "../media/ffmpeg.ts";
import type { VisualConfig, SceneConfig, VideoResult } from "../types.ts";

interface CaptureJob {
  id: string;
  sceneNumber: number; // 1-based React component number (1-8)
  segment?: number;    // 1-based segment within scene
}

function buildCaptureJobs(scenes: SceneConfig[], perSegment: boolean): CaptureJob[] {
  const jobs: CaptureJob[] = [];
  let sceneNumber = 1;

  for (const scene of scenes) {
    if (perSegment && scene.segments && scene.segments.length > 0) {
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

async function isServerRunning(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function startDevServer(
  command: string,
  url: string,
  cwd: string
): Promise<ChildProcess | null> {
  // Check if server is already running
  if (await isServerRunning(url)) {
    logger.info("  Vite dev server already running — reusing");
    return null;
  }

  logger.info(`  Starting dev server: ${command}`);
  const [cmd, ...args] = command.split(" ");
  const proc = spawn(cmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  proc.stderr?.on("data", (chunk) => {
    const msg = chunk.toString().trim();
    if (msg) logger.debug(`  [vite] ${msg}`);
  });

  // Poll until server responds
  const maxWait = 30000;
  const pollInterval = 500;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    if (await isServerRunning(url)) {
      logger.info("  Dev server ready");
      return proc;
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  proc.kill();
  throw new Error(`Dev server failed to start within ${maxWait / 1000}s`);
}

async function captureClip(
  browser: import("playwright").Browser,
  devServerUrl: string,
  job: CaptureJob,
  outputPath: string,
  config: NonNullable<VisualConfig["react_capture"]>,
  tempDir: string
): Promise<string> {
  const context = await browser.newContext({
    viewport: { width: config.viewport.width, height: config.viewport.height },
    recordVideo: {
      dir: tempDir,
      size: { width: config.viewport.width, height: config.viewport.height },
    },
  });

  const page = await context.newPage();

  // Set up recording coordination BEFORE navigation
  let resolveStop: () => void;
  const stopPromise = new Promise<void>((resolve) => {
    resolveStop = resolve;
  });

  await page.exposeFunction("startRecording", async () => {
    logger.debug(`    startRecording() called for ${job.id}`);
  });

  await page.exposeFunction("stopRecording", () => {
    logger.debug(`    stopRecording() called for ${job.id}`);
    resolveStop();
  });

  // Build URL
  let url = `${devServerUrl}?scene=${job.sceneNumber}`;
  if (job.segment) {
    url += `&segment=${job.segment}`;
  }

  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);

  // Wait for initial render
  await new Promise((r) => setTimeout(r, config.wait_after_load_ms));

  // Wait for animation to complete (stopRecording signal) or timeout
  await Promise.race([
    stopPromise,
    new Promise<void>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Capture timeout for ${job.id} after ${config.recording_timeout_ms}ms`)),
        config.recording_timeout_ms
      )
    ),
  ]);

  // Small buffer after stop signal for final frames
  await new Promise((r) => setTimeout(r, 300));

  // Close page to finalize video
  await page.close();

  // Get the recorded video path
  const video = page.video();
  if (!video) {
    await context.close();
    throw new Error(`No video recorded for ${job.id}`);
  }

  const webmPath = await video.path();
  await context.close();

  // Convert WebM to MP4
  await ffmpegConvertWebm(webmPath, outputPath);

  // Clean up WebM
  try {
    rmSync(webmPath);
  } catch {
    // Ignore cleanup errors
  }

  return outputPath;
}

export async function captureReactVideo(
  visualConfig: VisualConfig,
  scenes: SceneConfig[],
  outputDir: string,
  projectRoot: string
): Promise<VideoResult> {
  const config = visualConfig.react_capture ?? {
    dev_server_url: "http://localhost:5000",
    startup_command: "npm run dev:client",
    viewport: { width: 1920, height: 1080 },
    hide_cursor: true,
    recording_timeout_ms: 120000,
    wait_after_load_ms: 1000,
    per_segment: true,
  };

  const clipsDir = join(outputDir, "video", "clips");
  const rawDir = join(outputDir, "video", "raw");
  const tempDir = join(outputDir, "video", "temp-webm");
  mkdirSync(clipsDir, { recursive: true });
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(tempDir, { recursive: true });

  const jobs = buildCaptureJobs(scenes, config.per_segment);

  logger.step("CAPTURE", `React capture: ${jobs.length} clips (per_segment=${config.per_segment})`);

  // Start Vite dev server
  let devServer: ChildProcess | null = null;

  try {
    devServer = await startDevServer(
      config.startup_command,
      config.dev_server_url,
      projectRoot
    );

    // Launch Playwright browser
    const headed = process.env.REACT_CAPTURE_HEADED === "1";
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: !headed,
    });

    logger.info(`  Browser launched (headless=${!headed})`);

    const clipPaths: string[] = [];

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const clipPath = join(clipsDir, `${job.id}.mp4`);

      // Cache check: skip if clip already exists
      if (existsSync(clipPath)) {
        logger.info(`  Cached: ${job.id} — skipping`);
        clipPaths.push(clipPath);
        continue;
      }

      logger.info(`  Capturing: ${job.id} (scene${job.sceneNumber}${job.segment ? "/seg" + job.segment : ""})`);

      await captureClip(browser, config.dev_server_url, job, clipPath, config, tempDir);
      clipPaths.push(clipPath);

      logger.progress(i + 1, jobs.length, job.id);

      // Small delay between captures for cleanup
      if (i < jobs.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    await browser.close();

    // Concatenate all clips
    logger.info(`  Concatenating ${clipPaths.length} clips...`);
    const outputFile = join(rawDir, "combined.mp4");
    await ffmpegConcatReencode(clipPaths, outputFile, {
      width: config.viewport.width,
      height: config.viewport.height,
    });

    const probe = await ffprobe(outputFile);
    logger.step("CAPTURE", `Combined: ${Math.round(probe.duration)}s from ${clipPaths.length} clips`);

    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true });
    } catch {
      // Ignore
    }

    return { file: outputFile, duration_ms: Math.round(probe.duration * 1000) };
  } finally {
    // Kill dev server if we spawned it
    if (devServer) {
      logger.info("  Stopping dev server...");
      devServer.kill();
    }
  }
}
