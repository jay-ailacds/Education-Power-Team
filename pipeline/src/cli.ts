#!/usr/bin/env npx tsx
import { Command } from "commander";
import { runPipeline, showStatus } from "./core/pipeline.ts";
import { setLogLevel } from "./core/logger.ts";
import type { StepName } from "./types.ts";

const program = new Command();

program
  .name("vidpipe")
  .description("Automated video production pipeline using Kie.ai APIs")
  .version("1.0.0");

program
  .command("render")
  .description("Run full production pipeline end-to-end")
  .argument("<config>", "Path to project config file (YAML or JSON)")
  .option("--force", "Reset state and rerun all steps", false)
  .option("--dry-run", "Validate config and show plan without executing", false)
  .option("--verbose", "Enable debug logging", false)
  .action(async (configPath: string, opts) => {
    if (opts.verbose) setLogLevel("debug");
    try {
      await runPipeline(configPath, {
        force: opts.force,
        dryRun: opts.dryRun,
      });
    } catch (err) {
      console.error(`\nPipeline failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("research")
  .description("Run deep research on scene topics via Exa")
  .argument("<config>", "Path to project config file")
  .option("--force", "Rerun even if cached", false)
  .option("--verbose", "Enable debug logging", false)
  .action(async (configPath: string, opts) => {
    if (opts.verbose) setLogLevel("debug");
    try {
      await runPipeline(configPath, {
        force: opts.force,
        steps: ["research"] as StepName[],
      });
    } catch (err) {
      console.error(`\nResearch failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("enhance")
  .description("Enhance scripts using research findings + LLM")
  .argument("<config>", "Path to project config file")
  .option("--force", "Re-enhance even if cached", false)
  .option("--verbose", "Enable debug logging", false)
  .action(async (configPath: string, opts) => {
    if (opts.verbose) setLogLevel("debug");
    try {
      await runPipeline(configPath, {
        force: opts.force,
        steps: ["research", "enhance"] as StepName[],
      });
    } catch (err) {
      console.error(`\nEnhancement failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("tts")
  .description("Generate voiceover audio only")
  .argument("<config>", "Path to project config file")
  .option("--force", "Regenerate even if cached", false)
  .option("--verbose", "Enable debug logging", false)
  .action(async (configPath: string, opts) => {
    if (opts.verbose) setLogLevel("debug");
    try {
      await runPipeline(configPath, {
        force: opts.force,
        steps: ["tts"] as StepName[],
      });
    } catch (err) {
      console.error(`\nTTS failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("music")
  .description("Generate background music only")
  .argument("<config>", "Path to project config file")
  .option("--force", "Regenerate even if cached", false)
  .option("--verbose", "Enable debug logging", false)
  .action(async (configPath: string, opts) => {
    if (opts.verbose) setLogLevel("debug");
    try {
      await runPipeline(configPath, {
        force: opts.force,
        steps: ["music"] as StepName[],
      });
    } catch (err) {
      console.error(`\nMusic generation failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("video")
  .description("Generate or capture video only")
  .argument("<config>", "Path to project config file")
  .option("--force", "Regenerate even if cached", false)
  .option("--verbose", "Enable debug logging", false)
  .action(async (configPath: string, opts) => {
    if (opts.verbose) setLogLevel("debug");
    try {
      await runPipeline(configPath, {
        force: opts.force,
        steps: ["video"] as StepName[],
      });
    } catch (err) {
      console.error(`\nVideo generation failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("mix")
  .description("Mix voiceover + music audio")
  .argument("<config>", "Path to project config file")
  .option("--force", "Regenerate even if cached", false)
  .option("--verbose", "Enable debug logging", false)
  .action(async (configPath: string, opts) => {
    if (opts.verbose) setLogLevel("debug");
    try {
      await runPipeline(configPath, {
        force: opts.force,
        steps: ["mix_audio"] as StepName[],
      });
    } catch (err) {
      console.error(`\nAudio mixing failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("compose")
  .description("Compose final video (mux video + audio)")
  .argument("<config>", "Path to project config file")
  .option("--force", "Regenerate even if cached", false)
  .option("--verbose", "Enable debug logging", false)
  .action(async (configPath: string, opts) => {
    if (opts.verbose) setLogLevel("debug");
    try {
      await runPipeline(configPath, {
        force: opts.force,
        steps: ["compose"] as StepName[],
      });
    } catch (err) {
      console.error(`\nComposition failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("capture")
  .description("Capture React app animations as video via Playwright (per-segment)")
  .argument("<config>", "Path to project config file")
  .option("--force", "Recapture all segments even if cached", false)
  .option("--verbose", "Enable debug logging", false)
  .action(async (configPath: string, opts) => {
    if (opts.verbose) setLogLevel("debug");
    try {
      await runPipeline(configPath, {
        force: opts.force,
        steps: ["video"] as StepName[],
      });
    } catch (err) {
      console.error(`\nCapture failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Show pipeline status for a project")
  .argument("<config>", "Path to project config file")
  .action(async (configPath: string) => {
    try {
      await showStatus(configPath);
    } catch (err) {
      console.error(`\nStatus check failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("resume")
  .description("Resume pipeline from last successful step")
  .argument("<config>", "Path to project config file")
  .option("--verbose", "Enable debug logging", false)
  .action(async (configPath: string, opts) => {
    if (opts.verbose) setLogLevel("debug");
    try {
      await runPipeline(configPath, {}); // Auto-skips completed steps
    } catch (err) {
      console.error(`\nResume failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
