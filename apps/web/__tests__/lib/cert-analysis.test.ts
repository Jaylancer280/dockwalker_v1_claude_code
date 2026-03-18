import { describe, it, expect } from 'vitest';
import { buildCertGapContext } from '@/lib/advisor/cert-analysis';
import type { MCAChunk } from '@/lib/advisor/rag';

function makeChunk(content: string): MCAChunk {
  return {
    content,
    source_document: 'MIN 599',
    source_url: null,
    section_title: null,
    similarity: 0.85,
  };
}

describe('buildCertGapContext', () => {
  it('identifies cert gaps when crew is missing mentioned certs', () => {
    const chunks = [
      makeChunk(
        'A Deckhand seeking to progress should hold STCW Proficiency in Survival Craft and a Yacht Rating qualification.',
      ),
    ];

    const result = buildCertGapContext(['STCW Basic Safety'], 'Deckhand', chunks);

    expect(result).toContain('STCW Proficiency in Survival Craft (you have: no)');
    expect(result).toContain('Yacht Rating (you have: no)');
    expect(result).not.toContain('STCW Basic Safety (you have: no)');
    expect(result).toContain('Deckhand');
  });

  it('returns empty string when no MCA chunks provided', () => {
    const result = buildCertGapContext(['STCW Basic Safety'], 'Deckhand', []);
    expect(result).toBe('');
  });

  it('returns empty string when currentRole is empty', () => {
    const chunks = [makeChunk('Requires STCW Basic Safety.')];
    const result = buildCertGapContext(['STCW Basic Safety'], '', chunks);
    expect(result).toBe('');
  });

  it('reports all certs held when crew has all mentioned certs', () => {
    const chunks = [makeChunk('Crew must hold STCW Basic Safety and an ENG1 medical certificate.')];

    const result = buildCertGapContext(['STCW Basic Safety', 'ENG1'], 'Deckhand', chunks);

    expect(result).toContain('You currently hold: STCW Basic Safety, ENG1');
    expect(result).toContain('You appear to hold all certifications');
    expect(result).not.toContain('you have: no');
  });
});
