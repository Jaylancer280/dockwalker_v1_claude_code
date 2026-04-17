import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { searchMcaDocs } from '@/lib/advisor/rag';
import { streamDocky } from '@/lib/advisor/llm';
import { buildCrewContext } from '@/lib/advisor/crew-context';
import { buildCertGapContext } from '@/lib/advisor/cert-analysis';
import { requireSubscription } from '@/lib/require-subscription';

const THREAD_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

/**
 * POST /api/advisor/thread/messages
 * Send a message in the user's current thread and get an AI response.
 * Auto-creates a thread if none exists or the current one is expired.
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase, serviceClient } = guard.value;

    if (person.current_hat !== 'crew') {
      return NextResponse.json({ error: 'Crew hat required' }, { status: 403 });
    }

    // Validate content
    const body = await request.json().catch(() => ({}));
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!content || content.length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    if (content.length > 500) {
      return NextResponse.json(
        { error: 'content must be 500 characters or less' },
        { status: 400 },
      );
    }

    // Find or create active thread
    let threadId: string;

    const { data: existing } = await supabase
      .from('advisor_conversations')
      .select('id, created_at')
      .eq('person_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      const age = Date.now() - new Date(existing.created_at).getTime();
      if (age > THREAD_TTL_MS) {
        // Expired — delete and create fresh
        await serviceClient
          .from('advisor_conversations')
          .delete()
          .eq('id', existing.id)
          .eq('person_id', user.id);

        const { data: newThread, error: createErr } = await serviceClient
          .from('advisor_conversations')
          .insert({ person_id: user.id })
          .select('id')
          .single();

        if (createErr || !newThread) {
          return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
        }
        threadId = newThread.id;
      } else {
        threadId = existing.id;
      }
    } else {
      // No thread exists — create one
      const { data: newThread, error: createErr } = await serviceClient
        .from('advisor_conversations')
        .insert({ person_id: user.id })
        .select('id')
        .single();

      if (createErr || !newThread) {
        return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
      }
      threadId = newThread.id;
    }

    // Fetch conversation history
    const { data: historyRows } = await supabase
      .from('advisor_messages')
      .select('role, content')
      .eq('conversation_id', threadId)
      .order('created_at', { ascending: true });

    const history = (historyRows ?? []) as Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;

    // Subscription + usage check (before saving user message)
    const subResult = await requireSubscription(supabase, user.id, 'crew_pro');
    const isPro = subResult.ok;
    const usageLimit = isPro ? 500 : 10;
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Read-only usage check — do NOT increment yet (increment after successful response)
    const { data: usageRow } = await serviceClient
      .from('advisor_usage')
      .select('question_count')
      .eq('person_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle();

    if (usageRow && usageRow.question_count >= usageLimit) {
      return NextResponse.json(
        { error: 'limit_reached', used: usageLimit, limit: usageLimit, upgrade_url: '/billing' },
        { status: 402 },
      );
    }

    // Save user message (after usage check passes — survives LLM failure)
    const { error: insertErr } = await serviceClient
      .from('advisor_messages')
      .insert({ conversation_id: threadId, role: 'user', content })
      .select('id')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Crew context (Pro only) + RAG search in parallel
    const [crewCtx, chunks] = await Promise.all([
      isPro
        ? buildCrewContext(user.id, supabase)
        : Promise.resolve({ markdown: '', certNames: [] as string[], roleName: '' }),
      searchMcaDocs(content, serviceClient),
    ]);

    // Cert gap analysis (only meaningful when crew context exists)
    const certGap = isPro ? buildCertGapContext(crewCtx.certNames, crewCtx.roleName, chunks) : '';
    const fullCrewContext = [crewCtx.markdown, certGap].filter(Boolean).join('\n\n');
    console.info('Crew context length:', fullCrewContext.length, 'Chunks:', chunks.length);

    // Streaming LLM call
    const llmStartTime = Date.now();
    let streamResult;
    try {
      streamResult = streamDocky(content, chunks, history, fullCrewContext || undefined);
    } catch (err) {
      console.error('Docky streamDocky() error:', err);
      return NextResponse.json(
        { error: 'Docky is temporarily unavailable. Please try again.' },
        { status: 503 },
      );
    }

    const { stream, completion } = streamResult;

    // Save assistant message + interaction log after stream completes (background)
    const isFirstMessage = history.length === 0;
    const REFUSAL_MARKER = "I'm only able to help with maritime";
    completion
      .then(async (result) => {
        const latencyMs = Date.now() - llmStartTime;
        const sources = chunks.map((c) => ({
          document: c.source_document,
          section: c.section_title,
          url: c.source_url,
          relevance: c.similarity,
        }));

        await serviceClient.from('advisor_messages').insert({
          conversation_id: threadId,
          role: 'assistant',
          content: result.text,
          sources,
          model_used: result.model,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
        });

        const updateFields: Record<string, string> = {
          updated_at: new Date().toISOString(),
        };
        if (isFirstMessage) {
          updateFields.title = content.slice(0, 60);
        }
        await serviceClient.from('advisor_conversations').update(updateFields).eq('id', threadId);

        // Increment usage AFTER successful response (not before LLM call)
        await serviceClient.rpc('increment_advisor_usage', {
          p_person_id: user.id,
          p_month: currentMonth,
          p_limit: usageLimit,
        });

        // Interaction log (fire-and-forget)
        const wasRefused = result.text.includes(REFUSAL_MARKER);
        await serviceClient.from('docky_interactions').insert({
          person_id: user.id,
          query: content,
          response_summary: result.text.slice(0, 200),
          chunks_used:
            chunks.length > 0
              ? chunks.map((c) => ({ doc: c.source_document, section: c.section_title }))
              : null,
          was_refused: wasRefused,
          refusal_reason: wasRefused ? 'off_topic' : null,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          latency_ms: latencyMs,
        });
      })
      .catch(() => {
        // Stream error — do NOT save partial assistant message (per spec)
      });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
