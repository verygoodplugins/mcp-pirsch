import { describe, it, expect, afterEach } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Regression test for a bug where `npx`/npm bin invocation runs this
// entrypoint through a symlink (node_modules/.bin/mcp-pirsch -> dist/index.js).
// Node resolves symlinks when computing `import.meta.url` for an ES module,
// but `process.argv[1]` keeps the symlink path, so the old
// `import.meta.url === new URL(process.argv[1], 'file://').href` check never
// matched in that scenario. `main()` was silently never called and the
// process exited with code 0 without printing anything.

const here = dirname(fileURLToPath(import.meta.url));
const entrypoint = join(here, 'index.ts');

describe('entrypoint detection through a symlinked bin (npx pattern)', () => {
  let child: ChildProcessWithoutNullStreams | undefined;
  let tempDir: string | undefined;

  afterEach(() => {
    child?.kill();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('starts the server when invoked via a symlinked bin path', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-pirsch-bin-'));
    const binPath = join(tempDir, 'mcp-pirsch');
    symlinkSync(entrypoint, binPath);

    child = spawn(process.execPath, ['--import', 'tsx', binPath], {
      env: {
        ...process.env,
        PIRSCH_CLIENT_ID: 'test-client-id',
        PIRSCH_CLIENT_SECRET: 'test-client-secret',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const capturedChild = child;
    let stderr = '';

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for server start. stderr so far: ${stderr}`));
      }, 8000);

      capturedChild.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        if (stderr.includes('Pirsch MCP server running')) {
          clearTimeout(timer);
          resolve();
        }
      });

      capturedChild.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Server process exited early with code ${code}. stderr: ${stderr}`));
      });
    });

    expect(stderr).toContain('Pirsch MCP server running');
  });
});
