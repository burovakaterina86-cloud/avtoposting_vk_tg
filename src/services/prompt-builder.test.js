import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildImagePrompt } from './prompt-builder.js';

describe('prompt-builder', () => {
  it('appends mandatory suffix with eyes/lips, retouching, photorealism', () => {
    const out = buildImagePrompt('Professional headshot in an office');
    assert.ok(out.includes('Sharp focus on eyes and lips'));
    assert.ok(out.includes('Natural skin retouching'));
    assert.ok(out.includes('Photorealistic style'));
    assert.ok(out.includes('Professional headshot in an office'));
  });

  it('returns topic and suffix separated by period', () => {
    const out = buildImagePrompt('Test topic');
    assert.strictEqual(out.slice(0, 'Test topic. '.length), 'Test topic. ');
  });

  it('handles empty topic with only suffix', () => {
    const out = buildImagePrompt('');
    assert.ok(out.includes('Sharp focus on eyes and lips'));
    assert.ok(!out.startsWith('.'));
  });
});
