import { writeFileSync } from "node:fs";
import { logger } from "../core/logger.ts";
import type { KieTaskResponse, KieTaskStatus } from "../types.ts";

interface SunoTrack {
  id: string;
  audioUrl: string;
  streamAudioUrl?: string;
  imageUrl?: string;
  prompt?: string;
  modelName?: string;
  title: string;
  tags?: string;
  createTime?: string;
  duration: number;
}

interface SunoTaskData {
  taskId: string;
  status: string;
  response?: { taskId: string; sunoData: SunoTrack[] };
  errorCode?: number;
  errorMessage?: string;
}

export interface SunoMusicResult {
  audioUrl: string;
  title: string;
  duration: number;
}

interface VeoTaskData {
  taskId: string;
  paramJson?: string;
  completeTime?: number;
  response?: {
    taskId: string;
    resultUrls: string[] | null;
    originUrls: string[] | null;
    resolution?: string;
  };
  successFlag: number; // 0=generating, 1=success, 2=failed, 3=generation failed
  errorCode?: number | null;
  errorMessage?: string | null;
  createTime?: number;
  fallbackFlag?: boolean;
}

export interface VeoVideoResult {
  videoUrl: string;
  resolution?: string;
}

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

  async pollMusicUntilDone(taskId: string, opts?: PollOptions): Promise<SunoMusicResult> {
    const o = { ...DEFAULT_POLL, ...opts };
    const startTime = Date.now();
    let delay = o.initialDelayMs;

    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed > o.timeoutMs) {
        throw new Error(`Music task ${taskId} timed out after ${Math.round(o.timeoutMs / 1000)}s`);
      }

      await sleep(delay);

      const url = `${BASE_URL}/generate/record-info?taskId=${encodeURIComponent(taskId)}`;
      const res = await fetch(url, { headers: this.headers() });
      const json = await res.json() as { code: number; msg: string; data: SunoTaskData | null };

      if (json.code !== 200 || !json.data) {
        logger.warn(`Music poll error for ${taskId}: [${json.code}] ${json.msg}`);
        delay = Math.min(delay * o.backoffMultiplier, o.maxDelayMs);
        continue;
      }

      const { status } = json.data;
      logger.debug(`Music task ${taskId}: status=${status}`);

      if (status === "SUCCESS") {
        const tracks = json.data.response?.sunoData || [];
        if (tracks.length === 0) {
          throw new Error(`Music task ${taskId}: SUCCESS but no tracks returned`);
        }
        return {
          audioUrl: tracks[0].audioUrl,
          title: tracks[0].title,
          duration: tracks[0].duration,
        };
      }
      if (status === "CREATE_TASK_FAILED" || status === "GENERATE_AUDIO_FAILED" || status === "SENSITIVE_WORD_ERROR") {
        throw new Error(
          `Music task ${taskId} failed: ${json.data.errorMessage || status}`
        );
      }

      // PENDING, TEXT_SUCCESS, FIRST_SUCCESS — still processing
      delay = Math.min(delay * o.backoffMultiplier, o.maxDelayMs);
    }
  }

  async pollVideoUntilDone(taskId: string, opts?: PollOptions): Promise<VeoVideoResult> {
    const o = { ...DEFAULT_POLL, ...opts };
    const startTime = Date.now();
    let delay = o.initialDelayMs;

    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed > o.timeoutMs) {
        throw new Error(`Video task ${taskId} timed out after ${Math.round(o.timeoutMs / 1000)}s`);
      }

      await sleep(delay);

      const url = `${BASE_URL}/veo/record-info?taskId=${encodeURIComponent(taskId)}`;
      const res = await fetch(url, { headers: this.headers() });
      const json = await res.json() as { code: number; msg: string; data: VeoTaskData | null };

      if (json.code !== 200 || !json.data) {
        logger.warn(`Video poll error for ${taskId}: [${json.code}] ${json.msg}`);
        delay = Math.min(delay * o.backoffMultiplier, o.maxDelayMs);
        continue;
      }

      const { successFlag } = json.data;
      logger.debug(`Video task ${taskId}: successFlag=${successFlag}`);

      if (successFlag === 1) {
        const resultUrls = json.data.response?.resultUrls || [];
        if (resultUrls.length === 0) {
          throw new Error(`Video task ${taskId}: SUCCESS but no resultUrls returned`);
        }
        return {
          videoUrl: resultUrls[0],
          resolution: json.data.response?.resolution,
        };
      }
      if (successFlag === 2 || successFlag === 3) {
        throw new Error(
          `Video task ${taskId} failed (flag=${successFlag}): ${json.data.errorMessage || "unknown"}`
        );
      }

      // successFlag === 0 — still generating
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
