import { spawn, exec } from "child_process";
import net from "net";

export interface TestServer {
  port: number;
  url: string;
  stop: () => Promise<void>;
}

/**
 * Helper to find an available TCP port dynamically
 */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Programmatically spawn the server process on a specified port
 */
export async function startTestServer(port: number): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === "win32";

    // Use shell: true to prevent spawn EINVAL on Windows, but use taskkill on stop to kill the process tree
    const child = spawn("npx", ["tsx", "server.ts"], {
      env: {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: "test",
      },
      shell: true,
    });

    let resolved = false;

    child.stdout?.on("data", (data) => {
      const output = data.toString();
      // Resolve once the server signals that it's running
      if (output.includes("Server running") || output.includes("localhost:") || output.includes("listening")) {
        if (!resolved) {
          resolved = true;
          resolve({
            port,
            url: `http://localhost:${port}`,
            stop: () => {
              return new Promise<void>((resolveClose) => {
                child.on("exit", () => {
                  resolveClose();
                });

                if (isWin && child.pid) {
                  // Kill the entire process tree on Windows to avoid orphaned node processes
                  exec(`taskkill /pid ${child.pid} /T /F`, () => {
                    resolveClose();
                  });
                } else {
                  child.kill("SIGKILL");
                  resolveClose();
                }
              });
            },
          });
        }
      }
    });

    child.stderr?.on("data", (data) => {
      console.warn(`[Server Stderr]: ${data.toString()}`);
    });

    child.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    // Timeout safety (20 seconds)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (isWin && child.pid) {
          exec(`taskkill /pid ${child.pid} /T /F`);
        } else {
          child.kill("SIGKILL");
        }
        reject(new Error("Server startup timed out after 20000ms"));
      }
    }, 20000);
  });
}
