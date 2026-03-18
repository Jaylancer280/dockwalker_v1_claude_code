import type { MCAChunk } from './rag';

/**
 * Analyses MCA chunk content against a crew member's current certifications
 * to identify potential gaps. Returns a text block for LLM prompt injection.
 */
export function buildCertGapContext(
  currentCertNames: string[],
  currentRole: string,
  mcaChunks: MCAChunk[],
): string {
  if (mcaChunks.length === 0 || !currentRole) return '';

  // Known cert names to scan for in MCA content
  const knownCerts = [
    'STCW Basic Safety',
    'STCW Proficiency in Survival Craft',
    'Proficiency in Survival Craft',
    'ENG1',
    'Yacht Rating',
    'Boatmaster',
    'Officer of the Watch',
    'OOW',
    'Master 200GT',
    'Master 500GT',
    'Master 3000GT',
    'Chief Mate',
    'AEC',
    'Advanced Fire Fighting',
    'Medical First Aid',
    'Medical Care',
    'GMDSS',
    'SRC',
    'LRC',
    'Personal Safety and Social Responsibility',
    'PSR',
    'HELM',
    'Ship Security Officer',
    'SSO',
    'PSCRB',
    'Powerboat Level 2',
    'Yachtmaster Coastal',
    'Yachtmaster Offshore',
  ];

  // Scan MCA chunks for cert references
  const combinedText = mcaChunks.map((c) => c.content).join(' ');
  const mentionedCerts = knownCerts.filter((cert) =>
    combinedText.toLowerCase().includes(cert.toLowerCase()),
  );

  if (mentionedCerts.length === 0) return '';

  const currentLower = new Set(currentCertNames.map((n) => n.toLowerCase()));
  const gapLines: string[] = [];
  const heldLines: string[] = [];

  for (const cert of mentionedCerts) {
    if (currentLower.has(cert.toLowerCase())) {
      heldLines.push(cert);
    } else {
      gapLines.push(cert);
    }
  }

  const parts: string[] = [];
  parts.push(`Based on MCA guidance, a ${currentRole} seeking to progress typically needs:`);

  if (gapLines.length > 0) {
    parts.push(gapLines.map((c) => `${c} (you have: no)`).join(', '));
  }

  if (heldLines.length > 0) {
    parts.push(`You currently hold: ${heldLines.join(', ')}.`);
  }

  if (gapLines.length === 0) {
    parts.push('You appear to hold all certifications mentioned in the relevant MCA guidance.');
  }

  return parts.join(' ');
}
