import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('registry publication follows npm publication and uses OIDC', () => {
  const workflow = readFileSync('.github/workflows/release-please.yml', 'utf8');
  const registryStart = workflow.indexOf('\n  mcp-registry-publish:\n');
  const afterRegistryStart = workflow.slice(registryStart + 1);
  const nextJobOffset = afterRegistryStart.search(/\n  [a-z][\w-]*:\n/);
  const registryJob = nextJobOffset === -1 ? afterRegistryStart : afterRegistryStart.slice(0, nextJobOffset);

  assert.ok(registryStart >= 0, 'expected an mcp-registry-publish job');
  assert.match(registryJob, /needs: \[release-please, npm-publish\]/);
  assert.match(registryJob, /id-token: write/);
  assert.match(registryJob, /mcp-publisher login github-oidc/);
  assert.doesNotMatch(registryJob, /continue-on-error/);
});
test('CI publishes the organization-required test check after both Node versions pass', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

  assert.match(workflow, /\n  test-node:\n/);
  assert.match(workflow, /\n  test:\n    name: test\n    needs: test-node\n    if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow, /needs\.test-node\.result/);
  assert.match(workflow, /'success'/);
});
