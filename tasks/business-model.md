# DockWalker Business Model & Unit Economics

> **Created:** 2026-04-05. Update when pricing, costs, or infrastructure changes.
> **Purpose:** Financial model for planning, investor conversations, and operational decisions.

---

## Revenue Streams

| Stream                         | Price                                   | Target                                                                 |
| ------------------------------ | --------------------------------------- | ---------------------------------------------------------------------- |
| **Crew Pro**                   | €4.99/month                             | Crew who want Docky AI personalised advice + invitation visibility     |
| **Employer/Agent Pro**         | €14.99/month                            | Employers/agents who need unlimited templates + expanded shortlist cap |
| **Annual billing** (Release 4) | €39.99/year crew, €119.99/year employer | Retention + cash flow + lower Stripe fee %                             |

No other revenue streams at launch. No placement fees, no commission, no advertising, no data sales.

---

## Fixed Infrastructure Costs

These costs exist regardless of user count:

| Service                 | Plan          | Monthly Cost      | What it covers                                                                           |
| ----------------------- | ------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| **Supabase**            | Pro           | $25-75            | Database, auth, storage, realtime. $25 base + compute upgrade for production ~$50 extra. |
| **Vercel**              | Pro           | $20               | Hosting, serverless functions, edge network. Per seat (solo = $20).                      |
| **Resend**              | Free → Pro    | $0-20             | Transactional email. Free up to 3,000/month. $20/month for 50,000.                       |
| **Sentry**              | Free          | $0                | Error tracking. Free tier covers early stage.                                            |
| **Domain + DNS**        | —             | ~$2               | Annual amortised.                                                                        |
| **OpenAI** (embeddings) | Pay-as-you-go | ~$0               | Only runs during corpus ingestion (one-off). $0.02/1M tokens. Negligible.                |
|                         |               | **$47-117/month** |                                                                                          |

**Breakeven at fixed costs only: 10-24 Crew Pro subscribers** (before variable costs).

---

## Variable Costs Per Action

| Action                    | Service              | Cost Per Unit      | Notes                                                                                                           |
| ------------------------- | -------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| **Docky message**         | Anthropic Haiku 4.5  | **~$0.003-0.01**   | ~500-1500 input tokens + ~300 output. Haiku at $1/$5 per MTok. Prompt caching (Stage 187) cuts input cost ~90%. |
| **WhatsApp notification** | Twilio + Meta        | **~$0.01-0.03**    | $0.005 Twilio platform fee + Meta utility template fee. Varies by region.                                       |
| **Email notification**    | Resend               | **$0-0.0004**      | Free up to 3,000/month. Then ~$0.40 per 1,000.                                                                  |
| **Voice call (TURN)**     | Twilio NTS           | **~$0.0004/min**   | Only ~20% of calls need TURN relay. 80% are free (STUN). Average 15min call needing TURN = $0.006.              |
| **Stripe transaction**    | Stripe               | **1.5% + €0.25**   | EEA cards. Effective rate: ~6.5% on €4.99, ~3.2% on €14.99, ~2.1% on €39.99 annual.                             |
| **Document storage**      | Supabase Storage     | **~$0**            | 48h ephemeral. Steady state is a few GB. Within Supabase Pro included limits.                                   |
| **Push notification**     | Expo Push / Web Push | **$0**             | Free.                                                                                                           |
| **Supabase Realtime**     | Supabase             | **$0 incremental** | Included in Pro plan. Chat + call signaling.                                                                    |

### Cost per subscriber per month (estimated)

| Subscriber type                   | Docky | WhatsApp                 | Stripe | Other | Total variable cost | Revenue | Margin            |
| --------------------------------- | ----- | ------------------------ | ------ | ----- | ------------------- | ------- | ----------------- |
| **Free crew** (10 messages)       | $0.05 | $0.30 (10 notifications) | $0     | —     | **~$0.35**          | $0      | -$0.35            |
| **Crew Pro** (50 messages avg)    | $0.25 | $0.60 (20 notifications) | $0.32  | —     | **~$1.17**          | €4.99   | **~€3.82 (77%)**  |
| **Employer/Agent Pro** (no Docky) | $0    | $0.90 (30 notifications) | $0.47  | —     | **~$1.37**          | €14.99  | **~€13.62 (91%)** |

Free users cost ~$0.35/month to serve. That's the cost of acquisition — each free user is a potential conversion.

---

## Scenario Projections

### Scenario 1: Early Traction (Month 3-6, single port)

| Metric                         | Value                                   |
| ------------------------------ | --------------------------------------- |
| Total users                    | 500 (400 crew, 80 employers, 20 agents) |
| Crew Pro subscribers           | 40 (10% conversion)                     |
| Employer/Agent Pro subscribers | 15 (15% conversion)                     |
| Monthly Docky messages         | ~5,500                                  |
| Monthly WhatsApp notifications | ~3,000                                  |
| Monthly voice calls            | ~30                                     |

|                                  | Monthly        |
| -------------------------------- | -------------- |
| **Revenue**                      |                |
| Crew Pro (40 x €4.99)            | €199.60        |
| Employer/Agent Pro (15 x €14.99) | €224.85        |
| **Gross revenue**                | **€424.45**    |
|                                  |                |
| **Costs**                        |                |
| Fixed infrastructure             | ~€90           |
| Anthropic (5,500 msgs x $0.005)  | ~€25           |
| Twilio WhatsApp (3,000 x $0.015) | ~€45           |
| Twilio TURN                      | ~€1            |
| Stripe fees (~5% effective)      | ~€21           |
| **Total costs**                  | **~€182**      |
|                                  |                |
| **Net profit**                   | **€242/month** |
| **Margin**                       | **57%**        |
| **Annual run rate**              | **~€2,900**    |

### Scenario 2: Moderate Growth (Month 12, 3 ports)

| Metric                         | Value                                         |
| ------------------------------ | --------------------------------------------- |
| Total users                    | 3,000 (2,400 crew, 450 employers, 150 agents) |
| Crew Pro subscribers           | 300 (12.5% conversion)                        |
| Employer/Agent Pro subscribers | 90 (15% conversion)                           |
| Monthly Docky messages         | ~38,000                                       |
| Monthly WhatsApp notifications | ~20,000                                       |
| Monthly voice calls            | ~200                                          |

|                                   | Monthly          |
| --------------------------------- | ---------------- |
| **Revenue**                       |                  |
| Crew Pro (300 x €4.99)            | €1,497           |
| Employer/Agent Pro (90 x €14.99)  | €1,349           |
| **Gross revenue**                 | **€2,846**       |
|                                   |                  |
| **Costs**                         |                  |
| Fixed infrastructure              | ~€150            |
| Anthropic (38,000 msgs x $0.005)  | ~€190            |
| Twilio WhatsApp (20,000 x $0.015) | ~€300            |
| Twilio TURN                       | ~€5              |
| Resend (Pro plan)                 | ~€20             |
| Stripe fees (~4% effective)       | ~€114            |
| **Total costs**                   | **~€779**        |
|                                   |                  |
| **Net profit**                    | **€2,067/month** |
| **Margin**                        | **73%**          |
| **Annual run rate**               | **~€24,800**     |

### Scenario 3: Strong Product-Market Fit (Month 24, 5+ ports)

| Metric                         | Value                                               |
| ------------------------------ | --------------------------------------------------- |
| Total users                    | 15,000 (12,000 crew, 2,000 employers, 1,000 agents) |
| Crew Pro subscribers           | 1,800 (15% conversion)                              |
| Employer/Agent Pro subscribers | 600 (20% conversion — agents convert heavily)       |
| Monthly Docky messages         | ~180,000                                            |
| Monthly WhatsApp notifications | ~100,000                                            |
| Monthly voice calls            | ~1,000                                              |

|                                      | Monthly           |
| ------------------------------------ | ----------------- |
| **Revenue**                          |                   |
| Crew Pro (1,800 x €4.99)             | €8,982            |
| Employer/Agent Pro (600 x €14.99)    | €8,994            |
| **Gross revenue**                    | **€17,976**       |
|                                      |                   |
| **Costs**                            |                   |
| Fixed infrastructure (Supabase Team) | ~€400             |
| Anthropic (180,000 msgs x $0.005)    | ~€900             |
| Twilio WhatsApp (100,000 x $0.015)   | ~€1,500           |
| Twilio TURN                          | ~€25              |
| Resend (Scale plan)                  | ~€90              |
| Stripe fees (~3.5% effective)        | ~€629             |
| **Total costs**                      | **~€3,544**       |
|                                      |                   |
| **Net profit**                       | **€14,432/month** |
| **Margin**                           | **80%**           |
| **Annual run rate**                  | **~€173,000**     |

---

## Key Financial Insights

### 1. Profitable from day one

The fixed cost floor is ~€90/month. At €4.99/month, 18 paying crew covers infrastructure. At 500 users with 10% conversion, the platform is already net positive. There is no "burn period" — the unit economics work from the first subscribers.

### 2. Margin improves with scale

At 500 users: 57%. At 3,000: 73%. At 15,000: 80%. Fixed costs become irrelevant at scale. Variable costs grow linearly but each unit is tiny ($0.005 per Docky message, $0.015 per WhatsApp notification).

### 3. Biggest cost centres by scale

| Scale             | #1 Cost              | #2 Cost   | #3 Cost              |
| ----------------- | -------------------- | --------- | -------------------- |
| Early (500 users) | Fixed infrastructure | WhatsApp  | Anthropic            |
| Moderate (3,000)  | WhatsApp             | Anthropic | Fixed infrastructure |
| Strong (15,000)   | WhatsApp             | Anthropic | Stripe fees          |

WhatsApp notifications are the dominant variable cost. This is the trade-off for not having a native app. When the native app ships, WhatsApp costs drop as active users shift to free push notifications. WhatsApp becomes the channel for inactive/re-engagement users only.

### 4. Anthropic costs are controllable

Docky uses Haiku 4.5 ($1/$5 per MTok) — the cheapest Claude model. With prompt caching (already built, Stage 187), input costs drop ~90%. At 180,000 messages/month, Anthropic costs ~€900. If costs become a concern:

- Reduce MCA context chunks from 5 to 3 (smaller system block, fewer tokens)
- Shorten history window (already capped at 3,000 tokens)
- Cache frequent MCA queries (same question = same embedding = same chunks)
- Batch API for non-realtime analysis (50% discount)

### 5. Stripe's effective rate drops with higher prices

| Transaction             | Stripe fee | Effective % |
| ----------------------- | ---------- | ----------- |
| €4.99 monthly crew      | €0.32      | 6.5%        |
| €14.99 monthly employer | €0.47      | 3.2%        |
| €39.99 annual crew      | €0.85      | 2.1%        |
| €119.99 annual employer | €2.05      | 1.7%        |

Annual billing dramatically improves unit economics on the crew tier. At €4.99/month, Stripe takes €3.84/year in fees. At €39.99/year, Stripe takes €0.85. That's €3/year saved per annual crew subscriber — which is 5% of their annual revenue.

### 6. The employer tier has room to grow

€14.99/month with 91% margin means the employer tier is underpriced relative to the market. Competitors charge €895-€5,495 for similar access. Once the platform has a proven crew database (Scenario 2+), increasing employer pricing to €29.99 or €49.99/month is justified. Grandfathering early subscribers at €14.99 rewards loyalty and creates word-of-mouth.

At €29.99/month with 600 employer subscribers: €17,994/month employer revenue alone = €216K/year.

### 7. Free users are cheap to serve

A free crew member who doesn't use Docky costs near $0/month (occasional WhatsApp notifications). A free crew member using 10 Docky messages costs ~$0.35/month. The free tier is genuinely free to operate — there's no pressure to convert everyone, and every free user adds to the crew pool that makes the platform valuable to employers.

---

## Revenue Levers (in order of impact)

| Lever                                                       | Impact                                | When                                    |
| ----------------------------------------------------------- | ------------------------------------- | --------------------------------------- |
| **More users** (cold start → traction)                      | 10x revenue                           | Months 1-12                             |
| **Annual billing** (33% discount, lower Stripe %)           | +15% effective revenue per subscriber | Release 4                               |
| **Employer price increase** (€14.99 → €29.99+)              | +50-100% employer revenue             | Once crew database proven (Scenario 2+) |
| **Native app** (reduce WhatsApp costs)                      | -30-50% WhatsApp spend                | When mobile unblocks                    |
| **New features** (candidate match view, Docky job matching) | Justifies price increases             | Post-traction                           |

---

## Competitor Pricing Reference

| Platform                 | Crew Price                   | Employer Price                        | Model                   |
| ------------------------ | ---------------------------- | ------------------------------------- | ----------------------- |
| **DockWalker**           | €4.99/month                  | €14.99/month                          | Subscription (freemium) |
| **CrewHQ**               | £10/month (~€12) or £30/year | Business tier (not public)            | Subscription            |
| **Yotspot**              | Free                         | £1,495-2,495/3-12mo (~€125-210/month) | Subscription            |
| **Yachtee**              | Free (Yachtee+ exists)       | £895-5,495/3-12mo (~€75-460/month)    | Subscription            |
| **YaCrew**               | Free                         | $20-635 (CV credits)                  | Pay-per-use             |
| **Meridian**             | Free                         | Free (DirectHire)                     | Free + services         |
| **Traditional agencies** | Free (ILO convention)        | 8-25% of salary per placement         | Commission              |

DockWalker is the cheapest crew subscription on the market with the strongest feature set (AI advisor is unique). DockWalker's employer tier is 10-30x cheaper than Yotspot/Yachtee — deliberately low for launch, with significant headroom for increases once value is proven.

---

## Cost Monitoring Checklist

Track monthly to catch cost surprises early:

- [ ] Anthropic API spend (Haiku token usage — check for unexpected spikes from prompt changes)
- [ ] Twilio WhatsApp message count (should correlate with active users, not runaway notifications)
- [ ] Twilio TURN minutes (should be ~20% of voice call minutes — if higher, investigate NAT issues)
- [ ] Supabase usage (database size, storage, bandwidth — watch for approaching tier limits)
- [ ] Stripe fee total (should be ~3.5-6.5% of gross revenue — if higher, check for failed charge retries)
- [ ] Resend email count (compare to WhatsApp — if email is growing while WhatsApp is flat, users aren't connecting WhatsApp)
