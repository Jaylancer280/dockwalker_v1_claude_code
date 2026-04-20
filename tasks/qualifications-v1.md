# V1 Qualifications — Curated Pill List

> Source: `tasks/qualifications.md` (full Yotspot export).
> Decisions: Deck / Engineering / Interior / Galley kept in full. Everything else stripped or trimmed. "Basic" category introduced at the top so greenies don't have to sift. "Updated Proficiency in X" variants collapsed into a single pill per cert — revalidation tracked via expiry date on the profile.

**Total pills: ~250** (current seed has 17)
**Category order is UX order — first in list = first rendered.**

## Picker structure (drill-down vs flat)

Big categories get a second-level drill-down. Small categories stay flat (forcing a sub-tap through 3 options to reach 7 pills is worse UX than scrolling).

| Category                  | Sub-categories                                                                                                      | Shape      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------- |
| Basic (23)                | —                                                                                                                   | flat       |
| Deck / Bridge (70)        | Master/Skipper CoCs (23) · Specialised Deck (14) · Deck Modules & Oral Preps (29) · RYA Powerboat & Nav (20)        | drill-down |
| Engineering (50)          | Core (12) · ETO (4) · Modules & Short Courses (33)                                                                  | drill-down |
| Interior (66)             | G.U.E.S.T CoCs (4) · G.U.E.S.T Modules (13) · Wine & Spirits (15, WSET + G.U.E.S.T W&S) · Specialised Interior (34) | drill-down |
| Galley (16)               | —                                                                                                                   | flat       |
| Watersports & Diving (17) | —                                                                                                                   | flat       |
| Helideck (4)              | —                                                                                                                   | flat       |
| Other (3)                 | —                                                                                                                   | flat       |

### Picker UX

- **Fuzzy search bar on top** — always visible. Typing 2+ chars matches across ALL categories and bypasses drill-down. "AEC" finds the Engineering module directly, no matter which sub-bucket it lives in.
- **Drill-down below search** — collapsible accordion. Basic expanded by default; all others collapsed. Big categories open to sub-category list, then pill grid.
- **Selected pills shown above the picker** — each with × to remove.
- **Single shared component** used on every surface where certs are selected:
  - Onboarding (`app/onboarding/_components/profile-step.tsx`)
  - Profile edit (`app/(app)/profile/page.tsx`)
  - Daywork post (`app/(app)/daywork/post/_components/`)
  - Permanent post (`permanent-post-form.tsx`)
  - Discovery filters (`discover/_components/daywork-browse.tsx`)

Admin canonical page is the exception (`admin/canonical/page.tsx`) — full CRUD table, not a picker; it's where the canonical list is maintained.

---

## 1. Basic (~23 pills)

Pulled from _Entry Level_ + _STCW Modules_. This is the "everyone who works on a yacht" bucket. Greenie starts and stops here.

- STCW 95 (STCW 2010)
- ENG1 Medical Certificate
- ENG1 Medical Certificate (with Limitation/Restrictions)
- Proficiency in Security Awareness (A-VI/6)
- Proficiency in Designated Security Duties (A-VI/6-2)
- Personal Survival Techniques (A-VI/1-1)
- Fire Prevention & Fire Fighting (A-VI/1-2)
- Elementary First Aid (A-VI/1-3)
- Personal Safety & Social Responsibilities (A-VI/1-4)
- Proficiency in Survival Craft & Rescue Boats (PSCRB) (A-VI/2 1-4)
- Fast Rescue Boat (FRB) Training
- Advanced Fire Fighting (A-VI/3)
- Proficiency in Medical First Aid (A-VI/4 1-3)
- Proficiency in Medical Care
- HELM (Operational)
- HELM (Management)
- GMDSS Restricted Operators Certificate (ROC)
- GMDSS General Operators Certificate (GOC)
- GMDSS Long Range Certificate (LRC)
- Electronic Chart Display (ECDIS)
- Helicopter Underwater Escape Training (HUET)
- Entry Into Enclosed Spaces
- Ship Security Officer (SSO) (A-VI/5)

**Dropped from source:**
CRB Check, Driver's License (wrong dropdown), Polar Waters Basic/Advanced (niche for V1).

---

## 2. Deck / Bridge (~70 pills)

### Master / Skipper (23)

- RYA Start Yachting
- RYA Competent Crew
- RYA Day Skipper Theory
- RYA Day Skipper
- RYA Coastal Skipper
- RYA Yachtmaster Coastal Skipper
- MCA Navigational Watch Rating (NWR) Certificate
- MCA Yacht Rating Certificate
- MCA Able Seafarer Deck Certificate
- RYA Coastal Skipper/Yachtmaster Offshore Theory
- RYA Yachtmaster Offshore
- RYA Yachtmaster Ocean Theory
- RYA Yachtmaster Ocean
- MCA Master <200gt / OOW <500gt / USCG Master <200gt
- MCA CoC Master Workboats <500gt / USCG Master <500gt
- MCA CoC Officer of the Watch <3000gt
- MCA CoC Chief Mate <3000gt
- MCA CoC Master <500gt / Class 5
- MCA CoC Master <3000gt / Class 4 / USCG Master <1600gt
- RMI II/2 Certificate of Competency Master Yachts (Unlimited)
- Reg II/1 CoC Officer of the Watch (Unlimited)
- Reg II/2 CoC Chief Mate (Unlimited) / Master <3000gt / USCG Chief Mate (Unlimited)
- Reg II/2 CoC Master (Unlimited) / Class 1 / USCG Master (Unlimited)

### Specialised Deck (14)

- IYT Master of Yachts Coastal / Mate 200 Tons (Power or Sail)
- IYT Master of Yachts Limited (Power or Sail)
- IYT Master of Yachts Unlimited
- IYT Small Powerboat and Rib Master (MCA Approved)
- IYT Superyacht Deck Crew Course
- IYT Marine Communications (VHF-SRC)
- Dynamic Positioning Induction Course
- Dynamic Positioning Simulator (Advanced) Course
- Lithium-Ion Battery Safety Awareness
- Professional Carpentry Course / Diploma
- Professional Painting Course (e.g. Pinmar)
- Qualified Photographer
- Qualified Videographer
- Qualified Drone Pilot (Operator)

**Dropped:** ASD-ATD Tug Handling (commercial tug, not yacht-relevant).

### RYA / MCA Deck Modules (29)

- MCA Training Record Book (TRB)
- MCA Signals Certificate
- MCA/MNTB Small Ships Navigation & Radar
- Navigation & Radar (OOW Yachts)
- General Ship Knowledge (OOW Yachts)
- Seamanship & Meteorology (Master Yachts)
- Celestial Navigation (Master Yachts)
- Stability (Master Yachts)
- Business & Law (Master Yachts)
- Navigation, Radar and ARPA (Master Yachts)
- Navigation Aids, Equipment and Simulator Training — Operational (NAEST-O)
- Navigation Aids, Equipment and Simulator Training — Management (NAEST-M)
- Deck Cadet Foundation Degree Programme
- Deck Cadet Higher National Diploma Programme
- Deck Cadet Higher National Certificate Programme
- Officer of the Watch (HNC/SQA/Exam Route)
- Chief Mate (Post Foundation Degree Route)
- Chief Mate (Post HND Examination Route)
- Chief Mate & Master (SQA Examination Route)
- Yachtmaster Coastal — 5 Day Prep/Exam
- Yachtmaster Offshore — 5 Day Prep/Exam
- Yachtmaster Ocean — Oral Preparation
- MCA Master <200gt / OOW <500gt — Oral Preparation
- MCA CoC OOW <3000gt — Oral Prep
- MCA CoC Master <500gt / Class 5 — Oral Preparation
- MCA CoC Master <3000gt / Class 4 — Oral Preparation
- MCA CoC OOW (Unlimited) — Oral Prep
- MCA CoC Chief Mate (Unlimited) — Oral Preparation
- MCA CoC Master (Unlimited) / Class 1 — Oral Prep

### RYA (Powerboat / Nav / Safety — 20)

- ICC International Certificate of Competence
- RYA Powerboat Level 1
- RYA Powerboat Level 2
- RYA Intermediate Powerboat
- RYA Advanced Powerboat
- RYA Safety Boat
- RYA Tender Operator Course
- RYA Personal Watercraft Proficiency (PWC)
- BWSF Ski Boat Driver Award
- CEVNI Waterways Test / Assessment
- RYA Start Motor Cruising
- RYA Helmsman's Course
- RYA Advanced Pilotage
- RYA Essential Navigation & Seamanship
- RYA VHF Marine Radio (SRC)
- RYA Radar
- RYA Sea Survival
- RYA Offshore Safety (ISAF)
- RYA First Aid
- RYA Professional Practices & Responsibilities

**Dropped (~30 items):** full RYA dinghy/keelboat/multihull L1-3 ladders, spinnaker/performance/racing tiers, windsurfing ladder, inland waterways, safeguarding. All recreational — not a hiring signal on a superyacht.

---

## 3. Engineering (~50 pills)

### Core Engineering (12)

- RYA Diesel Engine Course
- MCA Approved Engine Course (AEC 1 & 2) Certificate
- MCA Engine Watch Rating Certificate
- MCA Marine Engine Operator License (Y)
- RIII/3 Y4 Chief Engineer (<200gt <1500kW) / EOOW III/1 (SV) (<3000gt <9000kW)
- 2nd Engineer III/2 (SV) (<3000gt <9000kW)
- RIII/3 Y3 Chief Engineer (<500gt <3000kW) / Chief Engineer (SV) (<500gt 3000kW)
- RIII/2 Y2 Chief Engineer (<3000gt <3000kW) / Chief Engineer (SV) (<3000gt <9000kW)
- RIII/2 Y1 Chief Engineer (<3000gt <9000kW) / Chief Engineer (SV) (<3000gt <9000kW)
- RIII/1 Engineer Officer of the Watch (Unlimited)
- RIII/2 2nd Engineer (Unlimited)
- RIII/2 Chief Engineer (Unlimited) / Class 1

### ETO (4)

- Electro-Technical Trainee (ETT)
- RIII/7 Electro-Technical Rating (ETR)
- RIII/6 Electro-Technical Officer (ETO)
- RIII/6 Electro-Technical Officer (ETO) (Unlimited)

### Engineering Modules & Short Courses (33)

- Training Record Book (MNTB/OTRB)
- MCA Approved Engine Course (AEC 1)
- MCA Approved Engine Course (AEC 2)
- Workshop Skills Training
- Chief Engineer (SV) Marine Diesel Engineering
- Chief Engineer (SV) Auxiliary Equipment (Part 1)
- Chief Engineer (SV) Operational Procedures, Basic Hotel Services and Ship Construction
- Chief Engineer (SV) Statutory & Operational Requirements
- Chief Engineer (SV) Auxiliary Equipment (Part 2)
- Chief Engineer (SV) Applied Marine Engineering
- Chief Engineer (SV) General Engineering Science I
- Chief Engineer (SV) General Engineering Science II
- MTU 2000 Series — Approved Operator Course
- MTU 4000 Series — Approved Operator Course
- MTU 8000 Series — Approved Operator Course
- MTU Series — Electronics Course
- Caterpillar Series — Approved Operator Course
- RIII/1 EOOW — Foundation Degree
- RIII/1 EOOW — Higher National Diploma
- RIII/1 EOOW — Higher National Certificate
- RIII/1 EOOW — Specialised Route
- RIII/1 EOOW — IAMI Exam Route
- RIII/6 METO — MNTB Workshop Skills Training
- RIII/1 EOOW — High Voltage (Operational)
- RIII/1 METO — Foundation Degree Programme
- RIII/1 EOOW — MNTB Workshop Skills Training
- RIII/2 2nd Engineer — Engineering Knowledge (G & M)
- RIII/2 2nd Engineer — Engineering Knowledge (G & S)
- RIII/2 2nd Engineer — High Voltage (Management)
- RIII/2 Chief Eng — Engineering Knowledge (G & M)
- RIII/2 Chief Eng — Engineering Knowledge (G & S)
- RIII/1 EOOW — Oral Preparation
- RIII/2 2nd Engineer — Oral Preparation
- RIII/2 Chief Eng — Oral Preparation
- RIII/7 Marine Electro-Technical Rating (Unlimited)

---

## 4. Interior (~66 pills)

### G.U.E.S.T Core (4)

- G.U.E.S.T I Introduction CoC Yacht Junior Steward(ess)
- G.U.E.S.T II Advanced CoC Yacht Senior Steward(ess)
- G.U.E.S.T III Management CoC Yacht Chief Steward(ess)
- G.U.E.S.T IV Purser CoC Yacht Chief Steward(ess)

### G.U.E.S.T Interior / Galley Modules (13)

- G.U.E.S.T Yacht Interior Introduction (unit 01)
- G.U.E.S.T Yacht Interior Basic Food Service (unit 02)
- G.U.E.S.T Yacht Interior Administration and HR (unit 04)
- G.U.E.S.T Advanced Food & Beverage Service (unit 05)
- G.U.E.S.T Cigar Service (unit 06)
- G.U.E.S.T Advanced Laundry Service (unit 07)
- G.U.E.S.T Advanced Housekeeping (unit 08)
- G.U.E.S.T Advanced Valet Services (unit 09)
- G.U.E.S.T Floristry and Plant Maintenance (unit 10)
- G.U.E.S.T Barista and Hot Beverages (unit 11)
- G.U.E.S.T Advanced Interior & Destination Management (unit 16)
- G.U.E.S.T / IAMI Foundation Leadership (unit 17)
- G.U.E.S.T Purser Programme (units 18-21)
- G.U.E.S.T / IAMI Advanced Leadership (unit 22)

### G.U.E.S.T Wine & Spirits (5)

- G.U.E.S.T Basic Wine Bartending & Mixology
- G.U.E.S.T Advanced Wine Appreciation 1 (unit 12)
- G.U.E.S.T Advanced Wine Appreciation 2 (unit 13)
- G.U.E.S.T Advanced Bartending and Mixology 1 (unit 14)
- G.U.E.S.T Advanced Bartending and Mixology 2 (unit 15)

### WSET (10)

- WSET Award in Wines Level 1
- WSET Award in Wines Level 2
- WSET Award in Wines Level 3
- WSET Diploma in Wines Level 4
- WSET Award in Spirits Level 1
- WSET Award in Spirits Level 2
- WSET Award in Spirits Level 3
- WSET Award in Sake Level 1
- WSET Award in Sake Level 2
- Master Sommelier

### Specialised Interior (34)

- Superyacht Induction (Operations) Course
- Superyacht Interior Course
- Introduction to International Safety Management (ISM)
- Crisis Management & Human Behaviour
- Crowd Management on Passenger Ships
- Leadership & Management Course
- Purser Course (inc accountancy, budgeting)
- Certified Accountant
- Hotel Management (Operations) Course
- Hospitality Course (hotel, estates, resorts & luxury yachts)
- Etiquette Protocol / Hospitality Training
- Formal Butler & Valet Training
- Silver Service Course
- Barista & Hot Beverages Course
- Cocktails & Mixology Course
- Certified Sommelier Course
- Qualified Private Tutor / Governess
- Qualified Nanny
- Early Childhood Development Studies
- Child Care & Early Years Course
- Intensive Floristry Course
- Hairdressing Diploma / Course
- Beautician / Nail Technician
- Registered Doctor
- Registered Paramedic
- Registered Nurse
- Professional Superyacht Hospitality (International Yacht Training)
- Yacht Interior Service (YIS) — Level 1 (Bluewater Training)
- Yacht Interior Service (YIS) — Level 2 (Bluewater Training)
- Interior Excellence (TCA)
- Pure Service Excellence (TCA)
- Introductory Relaxing Massage Course (Bluewater Training)

---

## 5. Galley (~16 pills)

### Culinary (6)

- Culinary Certificate(s)
- Certificate in Professional Cookery & Culinary Arts (1-6 mths)
- Intermediate Culinary Diploma (6 mths+)
- Professional Culinary Diploma (6 mths - 2 years+)
- Professional Culinary Degree / Master's (1-2 years+)
- Apprenticeship / Culinary School (2-5+ years)

### Worldchefs / PYA (3)

- WorldChefs / PYA Certified Professional Chef / Chef de Partie (Yacht Chef Award Level 1)
- WorldChefs / PYA Certified Sous Chef (Yacht Chef Award Level 2)
- WorldChefs / PYA Certified Chef de Cuisine (Yacht Chef Award Level 3)

### Food Hygiene (7)

- Food Hygiene (HABC Level 2)
- Food Hygiene (HABC Level 3)
- UKHSE Management of Food Safety in Catering
- Award Food Safety in Catering
- Award Supervising Food Safety in Catering
- Managing Food Safety in Catering
- Ship's Cook Certificate

**Deferred to V1.1:** the 198-item _Specialised Culinary / Cookery Courses_ list (cuisines, techniques, dietary specialisms). Source file marked "Let me know if you'd like the full list" — we don't have it. Chefs without specialty pills aren't blocked from hiring; they use experience entries. Revisit if chefs complain.

---

## 6. Watersports & Diving (~17 pills)

### PADI (7)

- PADI Open Water
- PADI Advanced Open Water
- PADI Rescue Diver (Emergency First Response)
- PADI Master Scuba Diver
- PADI Instructor Development Course (IDC)
- PADI Divemaster
- PADI Master Instructor

### Instructor (10)

- Train the Trainer (IMO)
- Watersports Instructor
- Waterski / Wakeboard Instructor
- Kitesurfing Instructor
- Efoil Instructor
- Surfing Instructor
- Yoga / Pilates Instructor
- Fitness Instructor (PT)
- Fishing Specialist
- Lifeguard

**Dropped (~50 items):** entire _Specialised Diving Courses_ list (Tec, CCR, Cavern, Ice Diver, etc.), RYA instructor sub-category ladders. Niche. Crew with these list them in free-text experience.

---

## 7. Helideck (4 pills)

- MCA Large Yacht Helideck Procedures & Emergency Response
- MCA Large Yacht Helideck Fire Fighting
- Helicopter Landing Officer (HLO)
- Helicopter Landing Assistant (HLA)

**Dropped:** MCA Helicopter Refuelling, Helideck Team Safety, Aviation Awareness for Non-Helideck Crew, CAA ROCC — all components the 4 above already imply or are too niche.

---

## 8. Other (3 pills)

- Washdown Course
- Tender Operations Course
- Exterior Polishing Course

---

## Stripped entirely from source

- **Specialised Submarine Courses** (5 items) — niche
- **Specialised Satellite Communications Courses** (6 items) — ETO-adjacent, covered by ETO pills
- **Specialised Cyber Security Courses** (5 items) — niche shore-side
- **Specialised Audio-Visual Courses** (11 items) — ETO-adjacent
- **Specialised IT/Networking Courses** (8 items) — ETO-adjacent
- **Specialised Security Courses** (13 items) — SSO already in Basic
- **Helicopter Qualifications** (3 items — PPL/CPL(H)/Heli Mechanic) — yacht crew rarely hold these; pilots are usually contracted separately
- **Mental Health & Wellbeing** (5 items) — not a hiring signal
- **Education** (8 items — GCSE → PhD) — **wrong dropdown**; belongs in a separate `education_level` profile field
- **Estate Management / PA / Office** (12 items) — shore-side
- **Private Driver / Chauffeur** (4 items) — niche role
- **Admin & Clerical NVQs** (4 items) — shore-side
- **CMI Management** (7 items) — shore-side
- **Yacht Design / Build / Refit** (3 items) — shore-side
- **Project Management** (20 items) — shore-side
- **Sales / Marketing / HR / Finance** (~25 items) — shore-side
- **MTA Diplomas** (34 items) — shore-side / management
- **General Maritime** (15 items — DPA, surveyors, salvage) — shore-side

---

## Implementation notes

1. **One pill per cert — Updated/revalidation variants collapsed.** No "Updated Proficiency in X" duplicates. Revalidation is an expiry-date concern, not a separate qualification. **Expiry tracking itself is deferred to V1.1** — current profile schema stores certs as `certification_ids uuid[]` with no per-cert date metadata. Adding `issued_at` / `expires_at` requires either a linking table (`profile_certifications`) or a JSONB column. Out of scope for this phase.

2. **Category schema change.** Current `certifications` table: `id, name, category, sort_order`. Add `subcategory text null` column. `category` values become: `basic`, `deck_bridge`, `engineering`, `interior`, `galley`, `watersports`, `helideck`, `other`. `subcategory` populated only for the three drill-down categories; null for flat ones.

3. **Canonical data strategy.** The 17 existing canonical rows have IDs referenced by `profile_state.certification_ids` and `daywork_postings.required_certification_ids`. Do NOT delete those IDs — remap them by renaming the rows to their closest V1 match (e.g. existing "STCW Basic Safety Training" → rename to "STCW 95 (STCW 2010)" keeping same UUID). New certs get fresh UUIDs. This preserves all FK-by-value references on existing profiles and postings.

4. **Education as separate field** — not part of this migration. Add `education_level` enum to profiles table as a separate V1.1 scope item when needed.

5. **Fuzzy search implementation** — case- and punctuation-insensitive substring match on `name`. Before comparing, normalise both the query and each pill name: lowercase, strip periods/hyphens/parentheses/extra whitespace. So typing "guest" matches "G.U.E.S.T I Introduction…", typing "stcw95" matches "STCW 95 (STCW 2010)", typing "aec1" matches "MCA Approved Engine Course (AEC 1)". No external library for V1. Upgrade to Fuse.js in V1.1 only if match quality complaints surface.

6. **Canonical-only selection — no free text.** Every cert FK must point at a real `certifications.id`. The picker returns IDs; there is no "Other, please specify" free-text field anywhere (onboarding, profile edit, posting forms, filter UI). If a crew member has a cert not in the canonical list, they leave it out and add detail in the free-form `bio` / experience entries instead. Missing certs surface as a V1.1 admin workflow (add via `/admin/canonical`), not a user-facing request queue. Parallel rule to the locations spec (`tasks/marina-locations-prompt.md`).

7. **Mobile deferred** — Expo app (`apps/mobile/`) is blocked. Do not include mobile changes in this phase. Mobile will consume the updated canonical list when unblocked.
