import { describe, it, expect, afterEach } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { mkdtempSync, symlinkSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';

// Regression test for the npx/npm bin invocation path: node_modules/.bin/mcp-pirsch
// is a symlink to dist/index.js. Before the fix, the entry-point guard compared
// process.argv[1] (the symlink path) directly against import.meta.url (the
// already-resolved real path) without resolving symlinks first, so the comparison
// silently failed, main() never ran, and the process exited 0 with zero output —
// exactly the "process exited unexpectedly (code: 0)" failure seen when AutoHub
// spawns this server via `npx -y @verygoodplugins/mcp-pirsch@latest`.

const distEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

function runViaPath(entryPath: string): Promise<{ stderr: string; exited: boolean }> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(process.execPath, [entryPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PIRSCH_CLIENT_ID: 'test-client-id',
        PIRSCH_CLIENT_SECRET: 'test-client-secret',
      },
    });

    let stderr = '';
    let exited = false;

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', () => {
      exited = true;
    });

    setTimeout(() => {
      if (!exited) {
        child.kill();
      }
      resolve({ stderr, exited });
    }, 1000);
  });
}

describe('CLI entry-point detection', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('starts the server when invoked directly (dist/index.js exists)', () => {
    expect(existsSync(distEntry)).toBe(true);
  });

  it('starts the server when invoked directly via node dist/index.js', async () => {
    const { stderr, exited } = await runViaPath(distEntry);
    expect(stderr).toContain('Pirsch MCP server running');
    expect(exited).toBe(false);
  });

  it('starts the server when invoked through a symlinked bin (npm/npx bin shim)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-pirsch-bin-'));
    tempDirs.push(dir);
    const binPath = join(dir, 'mcp-pirsch');
    symlinkSync(distEntry, binPath);

    const { stderr, exited } = await runViaPath(binPath);
    expect(stderr).toContain('Pirsch MCP server running');
    expect(exited).toBe(false);
  });
});
