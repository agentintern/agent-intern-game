import { describe, expect, it } from 'vitest';
import { readMessage } from '../src/ui/inbox';

const source = 'agent-intern-site';

describe('messages from the page', () => {
  it('accepts the two shapes, including an empty hall', () => {
    expect(readMessage({ source, type: 'daily', day: 12 })).toEqual({ type: 'daily', day: 12 });
    const bosses = [{ task: 'ADD A CAT', by: 'A HOLDER' }];
    expect(readMessage({ source, type: 'hall', bosses })).toEqual({ type: 'hall', bosses });
    expect(readMessage({ source, type: 'hall', bosses: [] })).toEqual({ type: 'hall', bosses: [] });
  });

  it('ignores junk shapes', () => {
    const junk: unknown[] = [
      undefined, null, 7, 'daily', [], [{ source, type: 'daily', day: 1 }], {},
      { type: 'daily', day: 1 }, { source: 'someone-else', type: 'daily', day: 1 }, { source, type: 'reset', day: 1 },
      { source, type: 'daily', day: 1, extra: true },
      ...['12', 0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1e12].map((day) => ({ source, type: 'daily', day })),
      { source, type: 'hall', bosses: 'many' },
      { source, type: 'hall', bosses: { task: 'A', by: 'B' } },
      ...[null, { task: 'A' }, { task: 'A', by: 2 }, { task: '   ', by: 'B' }, { task: 'A', by: 'B', url: 'x' }]
        .map((entry) => ({ source, type: 'hall', bosses: [{ task: 'OK', by: 'OK' }, entry] })),
    ];
    for (const message of junk) expect(readMessage(message)).toBeNull();
  });

  it('caps strings and the list, and flattens whitespace', () => {
    const long = 'X'.repeat(5000);
    const bosses = Array.from({ length: 500 }, () => ({ task: long, by: long }));
    const message = readMessage({ source, type: 'hall', bosses });
    if (message?.type !== 'hall') throw new Error('expected a hall message');
    expect(message.bosses).toHaveLength(40);
    expect(message.bosses[0]?.task).toHaveLength(60);
    expect(message.bosses[0]?.by).toHaveLength(24);
    expect(readMessage({ source, type: 'hall', bosses: [{ task: ' A\n\tB ', by: 'C' }] }))
      .toEqual({ type: 'hall', bosses: [{ task: 'A B', by: 'C' }] });
  });
});
