import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Regression test for the npx/npm bin invocation path: node_modules/.bin/mcp-pirsch
// is a symlink to dist/index.js. Before the fix, the entry-point guard compared
// process.argv[1] (the symlink path) directly against import.meta.url (the
// already-resolved real path) without resolving symlinks first, so the comparison
// silently failed, main() never ran, and the process exited 0 with zero output —
// exactly the "process exited unexpectedly (code: 0)" failure seen when AutoHub
// spawns this server via `npx -y @verygoodplugins/mcp-pirsch@latest`.

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const distEntry = join(projectRoot, 'dist', 'index.js');

function runViaPath(entryPath: string, flags: string[] = []): Promise<string> {
  return new Promise((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn(process.execPath, [...flags, entryPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PIRSCH_CLIENT_ID: 'test-client-id',
        PIRSCH_CLIENT_SECRET: 'test-client-secret',
      },
    });

    let stderr = '';
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      callback();
    };
    const timer = setTimeout(() => {
      finish(() => reject(new Error(`Timed out waiting for server start. stderr so far: ${stderr}`)));
    }, 8_000);

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.includes('Pirsch MCP server running')) {
        finish(() => resolve(stderr));
      }
    });
    child.on('error', (error) => {
      finish(() => reject(error));
    });
    child.on('exit', (code) => {
      finish(() => reject(new Error(`Server process exited early with code ${code}. stderr: ${stderr}`)));
    });
  });
}

describe('CLI entry-point detection', () => {
  const tempDirs: string[] = [];

  beforeAll(() => {
    execFileSync('npm', ['run', 'build'], { cwd: projectRoot, stdio: 'inherit' });
  });

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('starts the server when invoked directly', async () => {
    await expect(runViaPath(distEntry)).resolves.toContain('Pirsch MCP server running');
  });

  it('starts the server when invoked through a symlinked bin (npm/npx bin shim)', async () => {
    const dir = mkdtempSync(join(projectRoot, '.mcp-pirsch-bin-'));
    tempDirs.push(dir);
    const binPath = join(dir, 'mcp-pirsch');
    symlinkSync(distEntry, binPath);

    await expect(runViaPath(binPath)).resolves.toContain('Pirsch MCP server running');
  });

  it('starts the server through a preserved symlinked main module', async () => {
    // Keep the symlink beside the built entry so relative ESM imports retain
    // the package layout while Node preserves the main-module symlink path.
    const binPath = join(projectRoot, 'dist', '.mcp-pirsch-bin');
    tempDirs.push(binPath);
    symlinkSync(distEntry, binPath);

    await expect(runViaPath(binPath, ['--preserve-symlinks-main'])).resolves.toContain(
      'Pirsch MCP server running'
    );
  });
});
