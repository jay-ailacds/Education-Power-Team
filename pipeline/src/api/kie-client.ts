import { writeFileSync } from "node:fs";
import { logger } from "../core/logger.ts";
import type { KieTaskResponse, KieTaskStatus } from "../types.ts";

const BASE_URL = "https://api.kie.ai/api/v1";

export interface PollOptions {
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  timeoutMs?: number;
}

const DEFAULT_POLL: Required<PollOptions> = {
  initialDelayMs: 3000,
  maxDelayMs: 30000,
  backoffMultiplier: 1.5,
  timeoutMs: 10 * 60 * 1000, // 10 minutes
};

export class KieClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("KIE_API_KEY is required");
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async createTask(payload: Record<string, unknown>): Promise<string> {
    const res = await this.post(`${BASE_URL}/jobs/createTask`, payload);
    const json = (await res.json()) as KieTaskResponse;
    if (json.code !== 200 || !json.data) {
      throw new Error(`createTask failed: [${json.code}] ${json.msg}`);
    }
    return json.data.taskId;
  }

  async generateMusic(payload: Record<string, unknown>): Promise<string> {
    const res = await this.post(`${BASE_URL}/generate`, payload);
    const json = (await res.json()) as KieTaskResponse;
    if (json.code !== 200 || !json.data) {
      throw new Error(`generateMusic failed: [${json.code}] ${json.msg}`);
    }
    return json.data.taskId;
  }

  async generateVideo(
    provider: "veo" | "runway",
    payload: Record<string, unknown>
  ): Promise<string> {
    const endpoint =
      provider === "veo" ? `${BASE_URL}/veo/generate` : `${BASE_URL}/runway/generate`;
    const res = await this.post(endpoint, payload);
    const json = (await res.json()) as KieTaskResponse;
    if (json.code !== 200 || !json.data) {
      throw new Error(`generateVideo (${provider}) failed: [${json.code}] ${json.msg}`);
    }
    return json.data.taskId;
  }

  async pollUntilDone(taskId: string, opts?: PollOptions): Promise<KieTaskStatus["data"]> {
    const o = { ...DEFAULT_POLL, ...opts };
    const startTime = Date.now();
    let delay = o.initialDelayMs;

    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed > o.timeoutMs) {
        throw new Error(`Task ${taskId} timed out after ${Math.round(o.timeoutMs / 1000)}s`);
      }

      await sleep(delay);

      const url = `${BASE_URL}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;
      const res = await fetch(url, { headers: this.headers() });
      const json = (await res.json()) as KieTaskStatus;

      if (json.code !== 200 || !json.data) {
        logger.warn(`Poll error for ${taskId}: [${json.code}] ${json.msg}`);
        delay = Math.min(delay * o.backoffMultiplier, o.maxDelayMs);
        continue;
      }

      const { state, progress } = json.data;
      logger.debug(`Task ${taskId}: state=${state} progress=${progress}`);

      if (state === "success") {
        return json.data;
      }
      if (state === "fail") {
        throw new Error(
          `Task ${taskId} failed: ${json.data.failMsg || json.data.failCode || "unknown"}`
        );
      }

      // Still processing
      delay = Math.min(delay * o.backoffMultiplier, o.maxDelayMs);
    }
  }

  async downloadFile(url: string, outputPath: string): Promise<void> {
    logger.debug(`Downloading ${url} -> ${outputPath}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(outputPath, buffer);
    logger.debug(`Downloaded ${buffer.length} bytes to ${outputPath}`);
  }

  private async post(url: string, body: Record<string, unknown>): Promise<Response> {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(body),
        });

        if (res.status >= 500 && attempt < maxRetries) {
          logger.warn(`Server error ${res.status}, retrying (${attempt}/${maxRetries})...`);
          await sleep(2000 * attempt);
          continue;
        }

        return res;
      } catch (err) {
        if (attempt < maxRetries) {
          logger.warn(`Network error, retrying (${attempt}/${maxRetries})...`);
          await sleep(3000 * attempt);
          continue;
        }
        throw err;
      }
    }
    throw new Error("Unreachable");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
