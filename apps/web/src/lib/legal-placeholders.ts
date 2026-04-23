// Strings rendered in /privacy and /terms.
//
// Values below are provisional — they reflect the real Delaware-incorporated
// entity (Nautalink Technologies, Inc.) and operating address as of the last
// update, but the policy wording itself still needs a lawyer pass before the
// pages go public (see BUILD_STATE.md "Deferred Decisions").

export const LEGAL = {
  // Delaware C-corp (registered via Stable). Registered agent is Resident
  // Agents Inc., 8 The Green STE R, Dover DE 19901 — used for service of
  // process only, not surfaced in the public policy.
  companyName: 'Nautalink Technologies, Inc.',

  // Principal place of business (virtual mailing address via Stable), not
  // the registered-agent address. Used on /privacy as "DockWalker is
  // operated by {companyName}, {registeredAddress}".
  registeredAddress: '1111B S Governors Ave #48504, Dover, DE 19904, USA',

  // Governing law clause in /terms — matches state of incorporation.
  jurisdiction: 'Delaware, USA',

  // Both support and DPO point to the monitored admin@nautalink.io inbox
  // — single point of contact pre-launch. Split later if contact volume
  // warrants (or a DPO is separately engaged).
  supportEmail: 'admin@nautalink.io',
  dpoEmail: 'admin@nautalink.io',

  // Supabase project primary region (confirmed in dashboard). Shown on the
  // /privacy "Data transfers" section.
  supabaseRegion: 'EU (Frankfurt)',

  lastUpdated: '2026-04-23',
  appDomain: 'dockwalker.io',
};
