import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Development only: the public tunnel address (`make start` / `make tunnel`),
 * so the phone QR code follows a reopened tunnel without restarting the app.
 * Reads .tunnel.url and checks the tunnel process is still running.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const root = process.cwd();
  try {
    const [url, pid] = await Promise.all([
      readFile(path.join(root, ".tunnel.url"), "utf8"),
      readFile(path.join(root, ".tunnel.pid"), "utf8"),
    ]);
    const alive = (() => {
      try {
        process.kill(Number(pid.trim()), 0);
        return true;
      } catch {
        return false;
      }
    })();
    const clean = url.trim();
    if (!alive || !/^https:\/\/[a-z0-9.-]+$/i.test(clean)) return Response.json({ url: null });
    return Response.json({ url: clean });
  } catch {
    return Response.json({ url: null });
  }
}
