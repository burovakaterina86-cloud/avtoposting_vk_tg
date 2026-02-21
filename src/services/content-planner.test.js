import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getThemeForRun, getThemes } from './content-planner.js';

describe('content-planner', () => {
  it('returns one of four themes', () => {
    const themes = getThemes();
    assert.strictEqual(themes.length, 4);
    const ids = themes.map((t) => t.id);
    assert.ok(ids.includes('automation'));
    assert.ok(ids.includes('makecom'));
    assert.ok(ids.includes('neural'));
    assert.ok(ids.includes('prompts'));
  });

  it('rotates theme by lastThemeIndex', () => {
    const a = getThemeForRun(0);
    const b = getThemeForRun(1);
    const c = getThemeForRun(2);
    const d = getThemeForRun(3);
    assert.notStrictEqual(a.theme.id, b.theme.id);
    assert.notStrictEqual(b.theme.id, c.theme.id);
    assert.notStrictEqual(c.theme.id, d.theme.id);
    assert.strictEqual(getThemeForRun(4).theme.id, a.theme.id);
  });

  it('returns nextIndex for state', () => {
    const { theme, nextIndex } = getThemeForRun(0);
    assert.strictEqual(nextIndex, 1);
    const { nextIndex: ni2 } = getThemeForRun(3);
    assert.strictEqual(ni2, 0);
  });
});
