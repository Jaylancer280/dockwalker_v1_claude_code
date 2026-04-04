import { describe, it, expect } from 'vitest';
import { trimHistory } from '@/lib/advisor/llm';

describe('trimHistory', () => {
  it('returns empty array for empty input', () => {
    expect(trimHistory([])).toEqual([]);
  });

  it('keeps all messages when within budget', () => {
    const history = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there' },
    ];
    expect(trimHistory(history)).toEqual(history);
  });

  it('trims oldest messages when over budget', () => {
    // 3000 tokens ≈ 12000 chars. Create messages that exceed budget.
    const oldMsg = { role: 'user' as const, content: 'x'.repeat(10000) }; // ~2500 tokens
    const recentUser = { role: 'user' as const, content: 'Recent question' }; // ~4 tokens
    const recentAssistant = { role: 'assistant' as const, content: 'Recent answer' }; // ~4 tokens

    const result = trimHistory([oldMsg, recentUser, recentAssistant]);
    // oldMsg alone is ~2500 tokens, plus recentUser + recentAssistant ~8 = 2508, within budget
    // But if we add another large message it should be dropped
    expect(result).toHaveLength(3);

    // Now with two large messages — second should be dropped
    const anotherOld = { role: 'assistant' as const, content: 'y'.repeat(10000) }; // ~2500 tokens
    const result2 = trimHistory([anotherOld, oldMsg, recentUser, recentAssistant]);
    // Working backwards: recentAssistant(4) + recentUser(4) + oldMsg(2500) = 2508 < 3000
    // + anotherOld(2500) = 5008 > 3000, so anotherOld is dropped
    expect(result2).toHaveLength(3);
    expect(result2[0]).toBe(oldMsg);
  });

  it('keeps most recent messages, drops oldest', () => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: 'a'.repeat(1000), // ~250 tokens each
    }));
    // 3000 budget / 250 per message = 12 messages fit
    const result = trimHistory(msgs);
    expect(result.length).toBeLessThanOrEqual(12);
    // Last message should be the 20th (most recent)
    expect(result[result.length - 1]).toBe(msgs[msgs.length - 1]);
  });
});
