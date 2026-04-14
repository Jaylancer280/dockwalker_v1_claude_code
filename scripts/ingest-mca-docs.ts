/**
 * MCA Corpus Ingestion Script
 *
 * Populates the `mca_document_chunks` table with chunked + embedded MCA PDFs.
 * Run with: npx tsx scripts/ingest-mca-docs.ts
 * Production: npx tsx scripts/ingest-mca-docs.ts --production
 *
 * Prerequisites:
 * - OPENAI_API_KEY in .env.local (or .env.production.local for --production)
 * - SUPABASE_SERVICE_ROLE_KEY in .env.local (or .env.production.local)
 * - NEXT_PUBLIC_SUPABASE_URL in .env.local (or .env.production.local)
 * - PDF files in corpus/mca/
 */

import { config } from 'dotenv';
import { resolve, basename } from 'path';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const isProduction = process.argv.includes('--production');
const envFile = isProduction ? '.env.production.local' : '.env.local';

config({ path: resolve(__dirname, `../apps/web/${envFile}`) });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(`Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${envFile}`);
  process.exit(1);
}
if (!OPENAI_KEY) {
  console.error('Missing OPENAI_API_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_KEY });

const CORPUS_DIR = resolve(__dirname, '../corpus/mca');
const SOURCE_URLS_PATH = resolve(CORPUS_DIR, 'source-urls.json');
const CHUNK_TARGET_TOKENS = 450;
const CHUNK_MAX_TOKENS = 500;
const OVERLAP_TOKENS = 50;
const EMBEDDING_BATCH_SIZE = 20;
const EMBEDDING_DELAY_MS = 100;

// Section header patterns
const SECTION_HEADER_RE = /^(?:(?:SECTION|ANNEX|APPENDIX|PART|CHAPTER)\s+\w+|(?:\d+\.)+\d*\s+[A-Z]|[A-Z][A-Z\s]{5,}$)/m;

interface Chunk {
  content: string;
  section_title: string | null;
  page_number: number | null;
  chunk_index: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function deriveDocumentName(filename: string): string {
  return basename(filename, '.pdf')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split text into chunks using section-based strategy.
 */
function chunkText(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  // Split by section headers
  const sections: Array<{ title: string | null; content: string }> = [];
  const lines = text.split('\n');
  let currentTitle: string | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    if (SECTION_HEADER_RE.test(line.trim()) && line.trim().length > 3) {
      if (currentContent.length > 0) {
        sections.push({ title: currentTitle, content: currentContent.join('\n') });
      }
      currentTitle = line.trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0) {
    sections.push({ title: currentTitle, content: currentContent.join('\n') });
  }

  let previousTail = '';

  for (const section of sections) {
    const sectionText = section.content.trim();
    if (!sectionText) continue;

    const sectionTokens = estimateTokens(sectionText);

    if (sectionTokens <= CHUNK_MAX_TOKENS) {
      const content = previousTail ? previousTail + '\n' + sectionText : sectionText;
      chunks.push({
        content,
        section_title: section.title,
        page_number: null,
        chunk_index: chunkIndex++,
      });
      previousTail = sectionText.slice(-OVERLAP_TOKENS * 4);
    } else {
      // Sub-split at paragraph boundaries
      const paragraphs = sectionText.split(/\n\s*\n/);
      let buffer = previousTail;

      for (const para of paragraphs) {
        const paraText = para.trim();
        if (!paraText) continue;

        if (estimateTokens(buffer + '\n\n' + paraText) > CHUNK_MAX_TOKENS) {
          if (buffer.trim()) {
            chunks.push({
              content: buffer.trim(),
              section_title: section.title,
              page_number: null,
              chunk_index: chunkIndex++,
            });
            previousTail = buffer.trim().slice(-OVERLAP_TOKENS * 4);
          }

          // If single paragraph exceeds budget, split at sentences
          if (estimateTokens(paraText) > CHUNK_MAX_TOKENS) {
            const sentences = paraText.split(/(?<=[.!?])\s+/);
            buffer = previousTail;
            for (const sentence of sentences) {
              if (estimateTokens(buffer + ' ' + sentence) > CHUNK_MAX_TOKENS) {
                if (buffer.trim()) {
                  chunks.push({
                    content: buffer.trim(),
                    section_title: section.title,
                    page_number: null,
                    chunk_index: chunkIndex++,
                  });
                  previousTail = buffer.trim().slice(-OVERLAP_TOKENS * 4);
                }
                buffer = previousTail + ' ' + sentence;
              } else {
                buffer = buffer ? buffer + ' ' + sentence : sentence;
              }
            }
          } else {
            buffer = previousTail + '\n\n' + paraText;
          }
        } else {
          buffer = buffer ? buffer + '\n\n' + paraText : paraText;
        }
      }

      if (buffer.trim()) {
        chunks.push({
          content: buffer.trim(),
          section_title: section.title,
          page_number: null,
          chunk_index: chunkIndex++,
        });
        previousTail = buffer.trim().slice(-OVERLAP_TOKENS * 4);
      }
    }
  }

  return chunks;
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    });
    results.push(...response.data.map((d) => d.embedding));

    if (i + EMBEDDING_BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, EMBEDDING_DELAY_MS));
    }
  }

  return results;
}

async function main() {
  console.log('MCA Corpus Ingestion Script');
  console.log('==========================\n');

  // Load source URLs if available
  let sourceUrls: Record<string, string> = {};
  if (existsSync(SOURCE_URLS_PATH)) {
    sourceUrls = JSON.parse(readFileSync(SOURCE_URLS_PATH, 'utf-8'));
    console.log(`Loaded ${Object.keys(sourceUrls).length} source URLs\n`);
  }

  // Find PDFs
  const pdfFiles = readdirSync(CORPUS_DIR).filter((f) => f.endsWith('.pdf'));
  if (pdfFiles.length === 0) {
    console.error('No PDF files found in corpus/mca/');
    process.exit(1);
  }
  console.log(`Found ${pdfFiles.length} PDF files\n`);

  let totalChunks = 0;
  let totalTokens = 0;
  let failures = 0;

  // Dynamic import for pdf-parse (ESM compatibility)
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;

  for (const file of pdfFiles) {
    const docName = deriveDocumentName(file);
    const sourceUrl = sourceUrls[docName] ?? null;

    try {
      // Read and parse PDF
      const pdfBuffer = readFileSync(resolve(CORPUS_DIR, file));
      const pdf = await pdfParse(pdfBuffer);
      const text = pdf.text;

      if (!text || text.trim().length < 50) {
        console.log(`[${docName}] Skipped — too little text (${text?.length ?? 0} chars)`);
        continue;
      }

      // Chunk
      const chunks = chunkText(text);
      if (chunks.length === 0) {
        console.log(`[${docName}] Skipped — no chunks produced`);
        continue;
      }

      // Generate embeddings
      const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

      // Delete existing chunks for this document (idempotent re-ingestion)
      await supabase
        .from('mca_document_chunks')
        .delete()
        .eq('source_document', docName);

      // Insert
      const rows = chunks.map((chunk, i) => ({
        content: chunk.content,
        embedding: JSON.stringify(embeddings[i]),
        source_document: docName,
        source_url: sourceUrl,
        page_number: chunk.page_number,
        section_title: chunk.section_title,
        chunk_index: chunk.chunk_index,
      }));

      const { error } = await supabase
        .from('mca_document_chunks')
        .insert(rows);

      if (error) {
        console.error(`[${docName}] Insert failed: ${error.message}`);
        failures++;
        continue;
      }

      const docTokens = chunks.reduce((sum, c) => sum + estimateTokens(c.content), 0);
      totalChunks += chunks.length;
      totalTokens += docTokens;
      console.log(`[${docName}] ${chunks.length} chunks extracted, ${chunks.length} embeddings generated, ${chunks.length} rows inserted (~${docTokens} tokens)`);
    } catch (err) {
      console.error(`[${docName}] Failed: ${err instanceof Error ? err.message : err}`);
      failures++;
    }
  }

  // Summary
  console.log('\n==========================');
  console.log('Summary:');
  console.log(`  Documents processed: ${pdfFiles.length}`);
  console.log(`  Total chunks: ${totalChunks}`);
  console.log(`  Total tokens (est): ${totalTokens}`);
  console.log(`  Failures: ${failures}`);

  // Count rows in DB
  const { count } = await supabase
    .from('mca_document_chunks')
    .select('*', { count: 'exact', head: true });
  console.log(`  Rows in mca_document_chunks: ${count}`);

  // Smoke test
  if (totalChunks > 0) {
    console.log('\nSmoke test: embedding "What STCW certificates do I need?"...');
    try {
      const testEmbedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'What STCW certificates do I need?',
      });
      const { data: matches, error: matchErr } = await supabase.rpc('match_mca_documents', {
        query_embedding: JSON.stringify(testEmbedding.data[0].embedding),
        match_count: 3,
        match_threshold: 0.5,
      });
      if (matchErr) {
        console.error(`Smoke test RPC failed: ${matchErr.message}`);
      } else if (matches && matches.length > 0) {
        console.log(`  Found ${matches.length} matches (best similarity: ${matches[0].similarity.toFixed(3)})`);
        if (matches[0].similarity > 0.7) {
          console.log('  PASS — similarity > 0.7');
          console.log('\n  Set DOCKY_CORPUS_READY=true in apps/web/.env.local to enable RAG search.');
        } else {
          console.log('  WARN — best match similarity below 0.7 threshold');
        }
      } else {
        console.log('  No matches found — corpus may not have relevant STCW content');
      }
    } catch (err) {
      console.error(`Smoke test failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}

async function start() {
  if (isProduction) {
    console.log('\n\u26a0  PRODUCTION MODE \u2014 writing to live database.');
    console.log(`   Target: ${SUPABASE_URL}`);
    for (let i = 3; i > 0; i--) {
      process.stdout.write(`   Starting in ${i}... (Ctrl+C to abort)\r`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log('   Starting now.                              ');
  }
  await main();
}

start().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
