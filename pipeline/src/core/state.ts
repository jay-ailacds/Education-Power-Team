import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import type { PipelineState, StepName, StepState, StepOutput } from "../types.ts";

const STEP_ORDER: StepName[] = ["research", "enhance", "tts", "music", "video", "mix_audio", "compose", "verify"];

function defaultSteps(): Record<StepName, StepState> {
  const steps: Record<string, StepState> = {};
  for (const s of STEP_ORDER) {
    steps[s] = { status: "pending" };
  }
  return steps as Record<StepName, StepState>;
}

export class PipelineStateManager {
  private statePath: string;
  private state: PipelineState;

  constructor(workDir: string, configContent: string, projectSlug: string) {
    mkdirSync(workDir, { recursive: true });
    this.statePath = join(workDir, ".pipeline-state.json");

    const configHash = createHash("sha256").update(configContent).digest("hex").slice(0, 16);

    if (existsSync(this.statePath)) {
      const raw = readFileSync(this.statePath, "utf-8");
      this.state = JSON.parse(raw);

      // Backfill any new steps that don't exist in saved state
      for (const step of STEP_ORDER) {
        if (!this.state.steps[step]) {
          this.state.steps[step] = { status: "pending" };
        }
      }

      if (this.state.config_hash !== configHash) {
        this.state.config_hash = configHash;
      }
      this.save();
    } else {
      this.state = {
        config_hash: configHash,
        started_at: new Date().toISOString(),
        project_slug: projectSlug,
        steps: defaultSteps(),
      };
      this.save();
    }
  }

  get(step: StepName): StepState {
    return this.state.steps[step];
  }

  isCompleted(step: StepName): boolean {
    return this.state.steps[step].status === "completed";
  }

  markRunning(step: StepName): void {
    this.state.steps[step] = {
      status: "running",
      started_at: new Date().toISOString(),
    };
    this.save();
  }

  markCompleted(step: StepName, outputs?: StepOutput): void {
    this.state.steps[step] = {
      ...this.state.steps[step],
      status: "completed",
      completed_at: new Date().toISOString(),
      outputs,
    };
    this.save();
  }

  markFailed(step: StepName, error: string): void {
    this.state.steps[step] = {
      ...this.state.steps[step],
      status: "failed",
      failed_at: new Date().toISOString(),
      error,
    };
    this.save();
  }

  resetStep(step: StepName): void {
    this.state.steps[step] = { status: "pending" };
    this.save();
  }

  resetAll(): void {
    this.state.steps = defaultSteps();
    this.state.started_at = new Date().toISOString();
    this.save();
  }

  getAll(): PipelineState {
    return this.state;
  }

  private save(): void {
    mkdirSync(dirname(this.statePath), { recursive: true });
    writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
  }
}
