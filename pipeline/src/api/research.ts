import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../core/logger.ts";
import type { SceneConfig } from "../types.ts";

const EXA_BASE_URL = "https://api.exa.ai";

interface ExaSearchResult {
  url: string;
  title: string;
  text?: string;
  highlights?: string[];
  summary?: string;
  publishedDate?: string;
  image?: string;
}

interface ExaResponse {
  requestId: string;
  results: ExaSearchResult[];
  costDollars?: { total: number };
}

export interface ResearchResult {
  sceneId: string;
  query: string;
  findings: ExaSearchResult[];
  enhancedScript?: string;
  enhancedVideoPrompt?: string;
}

export class ExaClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("EXA_API_KEY is required for research");
    this.apiKey = apiKey;
  }

  async search(
    query: string,
    options?: {
      numResults?: number;
      type?: "auto" | "neural" | "fast" | "deep";
      category?: string;
      includeDomains?: string[];
      contents?: {
        text?: boolean | { maxCharacters?: number };
        highlights?: boolean | { maxCharacters?: number };
        summary?: boolean;
      };
    }
  ): Promise<ExaSearchResult[]> {
    const body: Record<string, unknown> = {
      query,
      numResults: options?.numResults ?? 5,
      type: options?.type ?? "auto",
      contents: options?.contents ?? {
        text: { maxCharacters: 2000 },
        highlights: { maxCharacters: 500 },
      },
    };

    if (options?.category) body.category = options.category;
    if (options?.includeDomains) body.includeDomains = options.includeDomains;

    const res = await fetch(`${EXA_BASE_URL}/search`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Exa search failed [${res.status}]: ${errText}`);
    }

    const data = (await res.json()) as ExaResponse;
    logger.debug(
      `Exa search: "${query}" -> ${data.results.length} results (cost: $${data.costDollars?.total?.toFixed(4) ?? "?"}`
    );

    return data.results;
  }

  async deepSearch(
    query: string,
    numResults: number = 3
  ): Promise<ExaSearchResult[]> {
    return this.search(query, {
      numResults,
      type: "deep",
      contents: {
        text: { maxCharacters: 3000 },
        highlights: { maxCharacters: 1000 },
        summary: true,
      },
    });
  }
}

/**
 * Research each scene's topic to gather real-world context, statistics,
 * and insights that can enhance voiceover scripts and video prompts.
 */
export async function researchScenes(
  exaClient: ExaClient,
  scenes: SceneConfig[],
  projectDescription: string,
  outputDir: string
): Promise<ResearchResult[]> {
  const researchDir = join(outputDir, "research");
  mkdirSync(researchDir, { recursive: true });

  logger.step("RESEARCH", `Researching ${scenes.length} scenes via Exa`);

  const results: ResearchResult[] = [];

  for (const scene of scenes) {
    const queries = buildResearchQueries(scene, projectDescription);

    for (const query of queries) {
      try {
        logger.info(`  Searching: "${query}" (${scene.id})`);
        const findings = await exaClient.search(query, {
          numResults: 3,
          type: "auto",
          contents: {
            text: { maxCharacters: 1500 },
            highlights: { maxCharacters: 500 },
            summary: true,
          },
        });

        results.push({
          sceneId: scene.id,
          query,
          findings,
        });
      } catch (err) {
        logger.warn(`  Research failed for "${query}": ${(err as Error).message}`);
      }
    }

    // Also research segments
    if (scene.segments) {
      for (const seg of scene.segments) {
        const segQuery = seg.script;
        try {
          logger.info(`  Searching: "${segQuery.slice(0, 60)}..." (${seg.id})`);
          const findings = await exaClient.search(segQuery, {
            numResults: 2,
            type: "fast",
            contents: {
              highlights: { maxCharacters: 300 },
              summary: true,
            },
          });

          results.push({
            sceneId: seg.id,
            query: segQuery,
            findings,
          });
        } catch (err) {
          logger.warn(`  Research failed for ${seg.id}: ${(err as Error).message}`);
        }
      }
    }
  }

  // Save research results to file
  const reportPath = join(researchDir, "research-report.json");
  writeFileSync(reportPath, JSON.stringify(results, null, 2));

  // Also generate a human-readable summary
  const summaryPath = join(researchDir, "research-summary.md");
  writeFileSync(summaryPath, generateResearchSummary(results));

  logger.step("RESEARCH", `Completed. ${results.length} queries, report saved to ${researchDir}`);
  return results;
}

function buildResearchQueries(scene: SceneConfig, projectDesc: string): string[] {
  const queries: string[] = [];

  if (scene.script) {
    // Use the script text as a semantic search query
    queries.push(scene.script);
  }

  // Add contextual queries based on scene content
  const id = scene.id.toLowerCase();
  if (id.includes("hook") || id.includes("intro")) {
    queries.push(`${projectDesc} market opportunity India education`);
  }
  if (id.includes("modern") || id.includes("tech")) {
    queries.push("smart classroom technology India education 2025");
  }
  if (id.includes("infrastructure")) {
    queries.push("modern educational infrastructure India school college");
  }
  if (id.includes("foresight") || id.includes("career")) {
    queries.push("career counseling higher education India students");
  }

  return queries.slice(0, 2); // Max 2 queries per scene to control costs
}

function generateResearchSummary(results: ResearchResult[]): string {
  let md = "# Research Summary\n\n";
  md += `Generated: ${new Date().toISOString()}\n\n`;

  const byScene = new Map<string, ResearchResult[]>();
  for (const r of results) {
    const existing = byScene.get(r.sceneId) || [];
    existing.push(r);
    byScene.set(r.sceneId, existing);
  }

  for (const [sceneId, sceneResults] of byScene) {
    md += `## ${sceneId}\n\n`;
    for (const r of sceneResults) {
      md += `**Query:** ${r.query.slice(0, 100)}\n\n`;
      for (const f of r.findings) {
        md += `- [${f.title}](${f.url})\n`;
        if (f.summary) md += `  > ${f.summary.slice(0, 200)}\n`;
        if (f.highlights?.length) {
          md += `  > ${f.highlights[0].slice(0, 200)}\n`;
        }
        md += "\n";
      }
    }
    md += "---\n\n";
  }

  return md;
}
