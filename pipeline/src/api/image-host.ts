import { createServer, type Server } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { basename, extname } from "node:path";
import { logger } from "../core/logger.ts";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Lightweight HTTP server that serves local image files so Kie.ai can access them.
 * Uses a random port and returns URLs that map to local file paths.
 */
export class ImageHostServer {
  private server: Server | null = null;
  private port = 0;
  private publicUrl = "";
  private files = new Map<string, string>(); // slug -> absolute path

  /**
   * Start the server. If a tunnelUrl is provided (e.g. from ngrok), use that as the base URL.
   * Otherwise, falls back to the machine's public IP or localhost.
   */
  async start(tunnelUrl?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        const slug = req.url?.replace(/^\//, "") || "";
        const filePath = this.files.get(slug);

        if (!filePath || !existsSync(filePath)) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const ext = extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || "application/octet-stream";
        const data = readFileSync(filePath);
        res.writeHead(200, { "Content-Type": mime, "Content-Length": data.length });
        res.end(data);
      });

      this.server.listen(0, "0.0.0.0", () => {
        const addr = this.server!.address();
        if (typeof addr === "object" && addr) {
          this.port = addr.port;
        }
        if (tunnelUrl) {
          this.publicUrl = tunnelUrl.replace(/\/$/, "");
        } else {
          this.publicUrl = `http://localhost:${this.port}`;
        }
        logger.info(`  IMAGE HOST: serving on port ${this.port} (${this.publicUrl})`);
        resolve();
      });

      this.server.on("error", reject);
    });
  }

  /**
   * Register a local file and return its public URL.
   */
  register(localPath: string): string {
    const slug = basename(localPath).replace(/[^a-zA-Z0-9._-]/g, "_");
    this.files.set(slug, localPath);
    return `${this.publicUrl}/${slug}`;
  }

  /**
   * Stop the server.
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  get isRunning(): boolean {
    return this.server !== null;
  }

  get localPort(): number {
    return this.port;
  }

  get baseUrl(): string {
    return this.publicUrl;
  }

  /**
   * Update the public URL (e.g. after setting up a tunnel).
   * Does NOT restart the server — just changes what URLs are returned by register().
   */
  setPublicUrl(url: string): void {
    this.publicUrl = url.replace(/\/$/, "");
    logger.info(`  IMAGE HOST: public URL updated to ${this.publicUrl}`);
  }
}

/**
 * Start a tunnel using cloudflared (Cloudflare Tunnel) to expose local server.
 * Returns the public URL.
 */
export async function startCloudflaredTunnel(localPort: number): Promise<{ url: string; kill: () => void }> {
  const { spawn } = await import("node:child_process");

  return new Promise((resolve, reject) => {
    const proc = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${localPort}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        reject(new Error("cloudflared tunnel timed out after 30s"));
      }
    }, 30000);

    const handleOutput = (data: Buffer) => {
      const text = data.toString();
      // cloudflared prints the URL to stderr
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        logger.info(`  TUNNEL: ${match[0]}`);
        resolve({
          url: match[0],
          kill: () => proc.kill(),
        });
      }
    };

    proc.stdout.on("data", handleOutput);
    proc.stderr.on("data", handleOutput);

    proc.on("error", (err) => {
      clearTimeout(timeout);
      if (!resolved) {
        reject(new Error(`cloudflared not found: ${err.message}. Install with: brew install cloudflared`));
      }
    });

    proc.on("exit", (code) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(new Error(`cloudflared exited with code ${code}`));
      }
    });
  });
}
