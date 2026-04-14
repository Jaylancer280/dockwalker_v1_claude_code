/**
 * Wipe all rows from mca_document_chunks.
 * Run before a full re-ingest when source_document names have changed.
 *
 * Usage: npx tsx scripts/wipe-mca-chunks.ts --production
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const isProduction = process.argv.includes('--production');
const envFile = isProduction ? '.env.production.local' : '.env.local';

config({ path: resolve(__dirname, `../apps/web/${envFile}`) });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(`Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${envFile}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  if (isProduction) {
    console.log('\n\u26a0  PRODUCTION MODE \u2014 wiping mca_document_chunks table.');
    console.log(`   Target: ${SUPABASE_URL}`);
    for (let i = 3; i > 0; i--) {
      process.stdout.write(`   Starting in ${i}... (Ctrl+C to abort)\r`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log('   Starting now.                              ');
  }

  const { count: before } = await supabase
    .from('mca_document_chunks')
    .select('*', { count: 'exact', head: true });
  console.log(`Rows before: ${before ?? 0}`);

  const { error } = await supabase
    .from('mca_document_chunks')
    .delete()
    .not('id', 'is', null);

  if (error) {
    console.error(`Delete failed: ${error.message}`);
    process.exit(1);
  }

  const { count: after } = await supabase
    .from('mca_document_chunks')
    .select('*', { count: 'exact', head: true });
  console.log(`Rows after:  ${after ?? 0}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
