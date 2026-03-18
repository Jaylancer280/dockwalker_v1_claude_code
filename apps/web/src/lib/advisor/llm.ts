import { getAnthropicClient } from './anthropic';
import type { MCAChunk } from './rag';

const BASE_SYSTEM_PROMPT = `You are Docky, a maritime career advisor built into DockWalker — the superyacht industry's daywork hiring app. You specialise in MCA certifications, career progression, and training requirements for yacht crew.

Rules:
- If MCA documentation is provided in context, cite specific documents (e.g. 'According to MIN 599...'). If no MCA context is provided, answer from your general maritime knowledge but note that your answer should be verified against official MCA publications.
- If you are not confident in your answer, say so honestly.
- Keep answers concise but thorough. Use bullet points for lists.
- End each response with: 'Always verify with your flag state authority or an approved training centre.'
- Never provide advice about IMO convention text.
- Never diagnose medical conditions (for ENG1 questions, direct to an approved ENG1 doctor).
- Be encouraging, especially to green crew entering the industry.`;

const PERSONALISATION_BLOCK = `

You have access to this crew member's profile and work history. Use it to:
- Reference their specific certifications when identifying gaps
- Account for their experience level and vessel size exposure
- Consider their location when suggesting training centres
- Tailor career path advice to their current role and progression

Be encouraging but honest. Never reveal salary data. Never compare to specific other crew members. Never make promises about job outcomes.`;

function buildSystemPrompt(hasCrewContext: boolean): string {
  return hasCrewContext ? BASE_SYSTEM_PROMPT + PERSONALISATION_BLOCK : BASE_SYSTEM_PROMPT;
}

export interface DockyResponse {
  answer: string;
  sources: Array<{
    document: string;
    section: string | null;
    url: string | null;
    relevance: number;
  }>;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export async function askDocky(
  question: string,
  mcaContext: MCAChunk[],
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  crewContext?: string,
): Promise<DockyResponse> {
  const client = getAnthropicClient();
  if (!client) throw new Error('Anthropic not configured');

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  if (crewContext) {
    messages.push({ role: 'user', content: `[CREW PROFILE]\n${crewContext}` });
    messages.push({
      role: 'assistant',
      content: 'I have your profile context. How can I help you today?',
    });
  }

  if (mcaContext.length > 0) {
    const mcaBlock = mcaContext
      .map(
        (c) =>
          `[Source: ${c.source_document}${c.section_title ? ` — ${c.section_title}` : ''}]\n${c.content}`,
      )
      .join('\n\n');
    messages.push({ role: 'user', content: `[MCA DOCUMENTATION]\n${mcaBlock}` });
    messages.push({
      role: 'assistant',
      content: 'I have the relevant MCA documentation. What would you like to know?',
    });
  }

  if (conversationHistory && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-10);
    messages.push(...recent);
  }

  messages.push({ role: 'user', content: question });

  const model = process.env.DOCKY_MODEL ?? 'claude-haiku-4-5-20251001';

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: buildSystemPrompt(!!crewContext),
    messages,
  });

  const answer = response.content[0].type === 'text' ? response.content[0].text : '';

  const sources = mcaContext.map((c) => ({
    document: c.source_document,
    section: c.section_title,
    url: c.source_url,
    relevance: c.similarity,
  }));

  return {
    answer,
    sources,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model,
  };
}
