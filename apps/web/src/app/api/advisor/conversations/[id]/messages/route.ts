import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { searchMcaDocs } from '@/lib/advisor/rag';
import { askDocky } from '@/lib/advisor/llm';

/**
 * POST /api/advisor/conversations/[id]/messages
 * Sends a message in an advisor conversation and gets an AI response.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const { user, person, supabase, serviceClient } = guard.value;

    if (person.current_hat !== 'crew') {
      return NextResponse.json({ error: 'Crew hat required' }, { status: 403 });
    }

    // Validate ownership
    const { data: conv } = await supabase
      .from('advisor_conversations')
      .select('id, person_id')
      .eq('id', id)
      .single();

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    if (conv.person_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    // Fetch conversation history before saving user message
    const { data: historyRows } = await supabase
      .from('advisor_messages')
      .select('role, content')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(10);

    const history = (historyRows ?? []) as Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;

    // Save user message
    const { error: insertErr } = await serviceClient
      .from('advisor_messages')
      .insert({ conversation_id: id, role: 'user', content })
      .select('id')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // RAG search
    const chunks = await searchMcaDocs(content, serviceClient);

    // LLM call
    let response;
    try {
      response = await askDocky(content, chunks, history);
    } catch {
      return NextResponse.json(
        { error: 'Docky is temporarily unavailable. Please try again.' },
        { status: 503 },
      );
    }

    // Save assistant message
    const { data: assistantMsg, error: assistantErr } = await serviceClient
      .from('advisor_messages')
      .insert({
        conversation_id: id,
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        model_used: response.model,
        input_tokens: response.inputTokens,
        output_tokens: response.outputTokens,
      })
      .select('id, content, sources, created_at')
      .single();

    if (assistantErr) {
      return NextResponse.json({ error: assistantErr.message }, { status: 500 });
    }

    // Update conversation title + updated_at
    const isFirstMessage = history.length === 0;
    const updateFields: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };
    if (isFirstMessage) {
      updateFields.title = content.slice(0, 60);
    }
    await serviceClient.from('advisor_conversations').update(updateFields).eq('id', id);

    return NextResponse.json({
      id: assistantMsg.id,
      role: 'assistant',
      content: response.answer,
      sources: response.sources,
      created_at: assistantMsg.created_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/advisor/conversations/[id]/messages
 * Returns all messages in an advisor conversation.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const { user, person, supabase } = guard.value;

    if (person.current_hat !== 'crew') {
      return NextResponse.json({ error: 'Crew hat required' }, { status: 403 });
    }

    // Validate ownership
    const { data: conv } = await supabase
      .from('advisor_conversations')
      .select('id, person_id')
      .eq('id', id)
      .single();

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    if (conv.person_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('advisor_messages')
      .select('id, role, content, sources, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
