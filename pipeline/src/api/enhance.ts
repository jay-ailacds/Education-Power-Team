import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../core/logger.ts";
import type { SceneConfig, ProjectConfig } from "../types.ts";
import type { ResearchResult } from "./research.ts";

const KIE_CHAT_URL = "https://api.kie.ai/claude-sonnet-4-5/v1/chat/completions";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
}

interface EnhancedScene {
  id: string;
  original_script: string;
  enhanced_script: string;
  original_video_prompt?: string;
  enhanced_video_prompt?: string;
}

export interface EnhancementResult {
  scenes: EnhancedScene[];
  file: string;
}

async function chatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  maxRetries = 3
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(KIE_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        stream: false,
        include_thoughts: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (attempt < maxRetries) {
        logger.debug(`  Chat API HTTP ${res.status}, retrying (${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw new Error(`Chat completion failed [${res.status}]: ${errText}`);
    }

    const data = (await res.json()) as Record<string, unknown>;

    // Kie.ai sometimes returns HTTP 200 with error body
    if (data.code && data.code !== 200) {
      if (attempt < maxRetries) {
        logger.debug(`  Chat API error ${data.code}, retrying (${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw new Error(`Chat API error [${data.code}]: ${data.msg || "unknown"}`);
    }

    const typedData = data as unknown as ChatResponse;
    const content = typedData.choices?.[0]?.message?.content || "";
    if (!content) {
      if (attempt < maxRetries) {
        logger.debug(`  Chat API empty response, retrying (${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw new Error(`Chat API returned empty content: ${JSON.stringify(data).slice(0, 300)}`);
    }
    return content;
  }
  throw new Error("Chat completion exhausted all retries");
}

function buildResearchContext(
  sceneId: string,
  researchResults: ResearchResult[]
): string {
  const relevant = researchResults.filter((r) => r.sceneId === sceneId);
  if (relevant.length === 0) return "";

  const parts: string[] = [];
  for (const r of relevant) {
    for (const f of r.findings) {
      if (f.summary) parts.push(`- ${f.summary}`);
      else if (f.highlights?.length) parts.push(`- ${f.highlights[0]}`);
      else if (f.title) parts.push(`- ${f.title} (${f.url})`);
    }
  }

  return parts.length > 0
    ? `\nResearch findings:\n${parts.join("\n")}\n`
    : "";
}

function collectAllScripts(
  scenes: SceneConfig[]
): Array<{ id: string; script: string; videoPrompt?: string }> {
  const items: Array<{ id: string; script: string; videoPrompt?: string }> = [];
  for (const scene of scenes) {
    if (scene.segments) {
      for (const seg of scene.segments) {
        items.push({
          id: seg.id,
          script: seg.script,
          videoPrompt: seg.video_prompt,
        });
      }
    } else if (scene.script) {
      items.push({
        id: scene.id,
        script: scene.script,
        videoPrompt: scene.video_prompt,
      });
    }
  }
  return items;
}

/**
 * Enhance all scene scripts and video prompts using research findings + LLM.
 * Sends batched requests to keep API calls minimal.
 */
export async function enhanceScripts(
  apiKey: string,
  config: ProjectConfig,
  researchResults: ResearchResult[],
  outputDir: string
): Promise<EnhancementResult> {
  const enhanceDir = join(outputDir, "enhanced");
  mkdirSync(enhanceDir, { recursive: true });

  const allScripts = collectAllScripts(config.scenes);
  logger.step("ENHANCE", `Enhancing ${allScripts.length} scripts with research context`);

  const enhanced: EnhancedScene[] = [];

  // Process in batches of 2 to avoid rate limits (Kie.ai returns 500 on concurrent overload)
  const batchSize = 2;
  for (let i = 0; i < allScripts.length; i += batchSize) {
    const batch = allScripts.slice(i, i + batchSize);

    const promises = batch.map(async (item) => {
      const context = buildResearchContext(item.id, researchResults);
      logger.debug(`  Research context for ${item.id}: ${context.length > 0 ? `${context.length} chars` : "NONE"}`);

      // Enhance the voiceover script
      const enhancedScript = await enhanceVoiceoverScript(
        apiKey,
        item.script,
        context,
        config.project.name,
        config.project.description || ""
      );

      // Enhance the video prompt if present
      let enhancedVideoPrompt: string | undefined;
      if (item.videoPrompt) {
        enhancedVideoPrompt = await enhanceVideoPrompt(
          apiKey,
          item.videoPrompt,
          item.script,
          context
        );
      }

      logger.info(`  Enhanced: ${item.id}`);

      return {
        id: item.id,
        original_script: item.script,
        enhanced_script: enhancedScript,
        original_video_prompt: item.videoPrompt,
        enhanced_video_prompt: enhancedVideoPrompt,
      };
    });

    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status === "fulfilled") {
        enhanced.push(r.value);
      } else {
        logger.warn(`  Enhancement failed: ${r.reason}`);
      }
    }

    // Delay between batches to avoid rate limits
    if (i + batchSize < allScripts.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Save enhanced scripts
  const outputFile = join(enhanceDir, "enhanced-scripts.json");
  writeFileSync(outputFile, JSON.stringify(enhanced, null, 2));

  // Also save a human-readable comparison
  const comparisonFile = join(enhanceDir, "script-comparison.md");
  writeFileSync(comparisonFile, generateComparison(enhanced));

  logger.step(
    "ENHANCE",
    `${enhanced.length}/${allScripts.length} scripts enhanced. Saved to ${enhanceDir}`
  );

  return { scenes: enhanced, file: outputFile };
}

async function enhanceVoiceoverScript(
  apiKey: string,
  originalScript: string,
  researchContext: string,
  projectName: string,
  projectDescription: string
): Promise<string> {
  const origWords = originalScript.split(/\s+/).length;
  // Short scripts (under 15 words) need more room to add a meaningful fact
  const lengthGuidance = origWords < 15
    ? `You may add up to ${Math.max(8, Math.round(origWords * 0.6))} extra words to fit in a compelling detail. Keep it concise.`
    : `Keep within 20% of the original word count (${origWords} words).`;

  const systemPrompt = `You are a professional corporate video scriptwriter. Your job is to enhance voiceover scripts for a corporate explainer video.

Rules:
- ${lengthGuidance}
- Keep the SAME core message and company names exactly as written
- Weave in one specific fact, statistic, or compelling detail from the research context
- If research mentions numbers (e.g. "1.5 million schools", "200+ institutes"), USE them
- Maintain a professional, warm, confident corporate tone
- The script must sound natural when spoken aloud
- Do NOT add greetings, transitions, or filler phrases
- The enhanced version MUST be different from the original — add real value
- NEVER return the original script unchanged. You MUST incorporate at least one research finding
- Return ONLY the enhanced script text, nothing else

Project: ${projectName}
${projectDescription ? `Description: ${projectDescription}` : ""}`;

  const userPrompt = `Original voiceover script:
"${originalScript}"
${researchContext}
Enhance this script. Return only the enhanced text.`;

  try {
    const result = await chatCompletion(apiKey, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    logger.debug(`  Raw LLM script response: "${result.slice(0, 300)}"`);

    // Clean up: remove quotes, extra whitespace
    const cleaned = result
      .replace(/^["']|["']$/g, "")
      .replace(/\n+/g, " ")
      .trim();

    // Sanity check: reject if wildly different in length
    const newWords = cleaned.split(/\s+/).length;
    // Short scripts get more headroom (up to 2.5x), longer ones are tighter (up to 1.5x)
    const maxMultiplier = origWords < 15 ? 2.5 : 1.5;
    if (newWords > origWords * maxMultiplier || newWords < origWords * 0.4 || cleaned.length < 10) {
      logger.warn(`  Script enhancement produced unexpected length (${newWords} vs ${origWords} words), using original`);
      return originalScript;
    }

    // Reject if LLM returned the exact same text
    if (cleaned === originalScript.trim()) {
      logger.warn(`  LLM returned identical text for "${originalScript.slice(0, 40)}...", retrying would be needed`);
      return originalScript;
    }

    return cleaned;
  } catch (err) {
    logger.warn(`  Script enhancement LLM call failed: ${(err as Error).message}`);
    return originalScript; // Fallback to original
  }
}

async function enhanceVideoPrompt(
  apiKey: string,
  originalPrompt: string,
  script: string,
  researchContext: string
): Promise<string> {
  const systemPrompt = `You are a video generation prompt engineer. You write detailed visual descriptions for AI video generation models (like Veo 3.1).

Rules:
- Keep the same scene concept and setting
- Add specific visual details: lighting, camera movement, colors, composition
- Include details about Indian educational environment (students, classrooms, campuses)
- Keep it under 200 words
- Focus on cinematic quality: camera angles, depth of field, motion
- Return ONLY the enhanced prompt, nothing else`;

  const userPrompt = `Original video prompt:
"${originalPrompt}"

Voiceover for this scene: "${script}"
${researchContext}
Enhance this video generation prompt. Return only the enhanced text.`;

  try {
    const result = await chatCompletion(apiKey, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const cleaned = result
      .replace(/^["']|["']$/g, "")
      .trim();

    if (cleaned.length < 20) return originalPrompt;
    return cleaned;
  } catch (err) {
    logger.warn(`  Video prompt enhancement failed: ${(err as Error).message}`);
    return originalPrompt;
  }
}

function generateComparison(enhanced: EnhancedScene[]): string {
  let md = "# Script Enhancement Comparison\n\n";
  md += `Generated: ${new Date().toISOString()}\n\n`;

  for (const scene of enhanced) {
    md += `## ${scene.id}\n\n`;
    md += `**Original:**\n> ${scene.original_script}\n\n`;
    md += `**Enhanced:**\n> ${scene.enhanced_script}\n\n`;

    if (scene.original_video_prompt && scene.enhanced_video_prompt) {
      md += `**Video Prompt (Original):**\n> ${scene.original_video_prompt}\n\n`;
      md += `**Video Prompt (Enhanced):**\n> ${scene.enhanced_video_prompt}\n\n`;
    }

    md += "---\n\n";
  }

  return md;
}

/**
 * Load cached enhanced scripts from a previous run.
 */
export function loadEnhancedScripts(outputDir: string): EnhancedScene[] | null {
  const file = join(outputDir, "enhanced", "enhanced-scripts.json");
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, "utf-8");
  return JSON.parse(raw) as EnhancedScene[];
}

/**
 * Apply enhanced scripts back to the config's scenes (mutates in place).
 */
export function applyEnhancements(
  scenes: SceneConfig[],
  enhanced: EnhancedScene[]
): void {
  const lookup = new Map(enhanced.map((e) => [e.id, e]));

  for (const scene of scenes) {
    if (scene.segments) {
      for (const seg of scene.segments) {
        const e = lookup.get(seg.id);
        if (e) {
          seg.script = e.enhanced_script;
          if (e.enhanced_video_prompt) seg.video_prompt = e.enhanced_video_prompt;
        }
      }
    } else {
      const e = lookup.get(scene.id);
      if (e) {
        scene.script = e.enhanced_script;
        if (e.enhanced_video_prompt) scene.video_prompt = e.enhanced_video_prompt;
      }
    }
  }
}
