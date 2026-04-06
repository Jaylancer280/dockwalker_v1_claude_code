# In-App Voice Call — Permanent Jobs Interview Feature

> **Status:** SPEC COMPLETE — ready for implementation planning when prioritised.
> **Scope:** Voice-only calling within permanent job messaging threads. No video. No recording.
> **Decision date:** 2026-04-05.

---

## Why This Exists

Permanent hiring involves interviews. Currently, to interview a candidate, the employer must:

1. Ask for their phone number in chat
2. Leave DockWalker
3. Call them on WhatsApp/phone
4. Come back to DockWalker to continue the hiring process

Every exit from the platform is a risk — the conversation moves to WhatsApp, the negotiation happens there, and DockWalker becomes a sourcing tool rather than a hiring platform. The interview is the most critical moment in permanent hiring, and it happens outside the app.

An in-app voice call keeps the entire hiring flow — discovery, application, shortlisting, selection, interview, placement confirmation — inside DockWalker. The employer never needs the crew member's phone number. The crew member never needs to share personal contact information.

**This is permanent-only.** Daywork hiring is fast and instinctive — a captain doesn't interview a deckhand for 3 days of work. Permanent hiring is deliberate — a captain absolutely interviews a Chief Stew for a seasonal contract. The feature matches the hiring mode.

---

## User Flow

### Initiating a Call (either party)

1. Employer or crew opens the permanent engagement chat thread (`/messages/[engagementId]`)
2. A **phone icon button** is visible in the chat header (only for permanent engagements — not daywork)
3. Tapping the phone icon initiates the call
4. The caller sees a **"Calling..."** state with the other party's name and avatar
5. The callee sees an **incoming call overlay** with the caller's name, avatar, and Accept/Decline buttons
6. The incoming call overlay appears regardless of which page the callee is on (as long as they're in the app)

### During a Call

- Both parties see a **call bar** at the top of the screen showing: call duration timer, other party's name, mute button, speaker toggle, end call button
- The call bar is minimal — it doesn't take over the screen. Both parties can continue browsing the app (viewing the job spec, checking the crew's profile, reading chat history) while talking
- Chat remains functional during the call — either party can send messages while on the call (useful for sharing links, confirming details in writing)
- Audio only — no video, no screen share

### Ending a Call

- Either party taps "End call"
- A **system message** is automatically inserted into the chat thread: "Voice call — 12m 34s" (with a phone icon). This creates a persistent record that the interview happened, visible to both parties.
- No recording is made. No transcript. The system message is the only trace.

### Missed / Declined Calls

- If the callee declines: caller sees "Call declined". No system message (the call didn't happen).
- If the callee doesn't answer within 30 seconds: caller sees "No answer". No system message.
- If the callee is offline (no active browser session): caller sees "Unavailable — try again later". No system message.
- Push notification for incoming calls is deferred (requires native app). The call only works when both parties have the app open in a browser tab.

---

## Technical Architecture

### Signaling: Supabase Realtime

The app already uses Supabase Realtime for chat messages (Stage 104). Call signaling (offer, answer, ICE candidates, hangup) uses the same infrastructure — a Realtime channel per engagement.

**Channel:** `call:{engagementId}`

**Signaling messages:**

```typescript
// Caller → Callee
{ type: 'call:offer', from: personId, sdp: RTCSessionDescription }
{ type: 'call:ice', from: personId, candidate: RTCIceCandidate }
{ type: 'call:hangup', from: personId }

// Callee → Caller
{ type: 'call:answer', from: personId, sdp: RTCSessionDescription }
{ type: 'call:ice', from: personId, candidate: RTCIceCandidate }
{ type: 'call:decline', from: personId }
{ type: 'call:hangup', from: personId }
```

No new API routes needed for signaling — Realtime handles peer-to-peer message passing. The signaling data is ephemeral (not stored in the database).

### Media: WebRTC (Browser-Native)

Voice media flows peer-to-peer via WebRTC. No media server. No third-party SDK. The browser's built-in `RTCPeerConnection` API handles:

- Audio capture (microphone)
- Codec negotiation (Opus)
- Encryption (DTLS-SRTP — mandatory in WebRTC, all audio is encrypted end-to-end)
- NAT traversal (via ICE candidates + STUN/TURN servers)

**STUN/TURN servers:**

- **STUN:** Use Google's free public STUN servers (`stun:stun.l.google.com:19302`) for NAT traversal in most cases. STUN is free and handles ~80% of network configurations.
- **TURN:** For users behind symmetric NATs or restrictive firewalls (corporate networks, some mobile carriers), a TURN relay server is needed. Options:
  - **Twilio Network Traversal Service** — pay-per-use, ~$0.0004/min, reliable. Requires `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` env vars.
  - **Metered TURN** — similar pricing, simpler API.
  - **Self-hosted coturn** — free, but requires infrastructure management.
  - **Recommendation:** Use Twilio NTS. The cost is negligible (a 30-minute interview costs ~$0.012). The API is a single REST call to get time-limited TURN credentials.

**TURN credential endpoint:**

A new API route `GET /api/calls/turn-credentials` returns ephemeral TURN credentials (valid ~5 minutes). Called by the client before establishing the WebRTC connection.

```typescript
// apps/web/src/app/api/calls/turn-credentials/route.ts
// Auth required — only engagement participants can get credentials
// Calls Twilio API to generate time-limited TURN credentials
// Returns: { iceServers: [{ urls, username, credential }] }
```

### Call State: Client-Side Only

Call state (ringing, connected, duration, muted) lives entirely in the client. No database table for calls. No server-side call state. The only server interaction is:

1. **Signaling** — via Supabase Realtime (ephemeral)
2. **TURN credentials** — one API call at connection time
3. **System message** — one `MESSAGE.SENT` event appended when the call ends (records duration)

This keeps the architecture simple. There's no "calls" table, no call history API, no call state projection. The chat thread IS the call history — each completed call appears as a system message.

### Incoming Call Detection: Presence + Broadcast

For the callee to see the incoming call overlay, they must be listening. Two mechanisms:

1. **If callee is on the chat page for this engagement:** Already subscribed to the Realtime channel. Receives the `call:offer` directly.
2. **If callee is on a different page in the app:** A global Realtime subscription (in the app layout) listens on a personal presence channel `calls:{personId}`. The caller sends a lightweight "ring" signal to this channel before the full WebRTC offer. The callee's app shows the incoming call overlay from any page.

The global listener is lightweight — it only subscribes to one channel per user session and only processes "ring" events. It doesn't carry WebRTC signaling; it just triggers the incoming call UI, which then subscribes to the engagement-specific channel for the full handshake.

---

## Components

### 1. TURN Credentials API Route

**Path:** `apps/web/src/app/api/calls/turn-credentials/route.ts`
**Method:** GET
**Auth:** Required — must be a participant in at least one active permanent engagement

Returns ICE server configuration including STUN and TURN (if Twilio configured). If `TWILIO_ACCOUNT_SID` is not set, returns STUN-only (works for most users, fails gracefully for restrictive networks).

### 2. Call Manager Hook

**Path:** `apps/web/src/hooks/use-voice-call.ts`

Core hook managing the full call lifecycle:

```typescript
interface UseVoiceCallReturn {
  // State
  callState: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
  duration: number; // seconds, updates every second while connected
  isMuted: boolean;
  isSpeaker: boolean; // future: audio output routing
  remoteName: string | null; // other party's display name
  remoteAvatar: string | null;

  // Actions
  startCall: (engagementId: string) => Promise<void>;
  acceptCall: () => void;
  declineCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
}
```

Internally:

- Creates `RTCPeerConnection` with ICE servers from the credentials endpoint
- Captures microphone via `navigator.mediaDevices.getUserMedia({ audio: true })`
- Exchanges SDP offer/answer via Supabase Realtime
- Handles ICE candidate trickle
- Manages call timeout (30s ring, auto-hangup if no answer)
- Cleans up media tracks and connection on hangup/unmount

### 3. Incoming Call Listener

**Path:** `apps/web/src/components/incoming-call-listener.tsx`

Mounted in the app layout (always active when authenticated). Subscribes to `calls:{personId}` Realtime channel.

On receiving a ring event:

- Fetches caller name + avatar from the event payload
- Renders the incoming call overlay (full-screen semi-transparent backdrop with caller info + Accept/Decline)
- Plays a ringtone audio (subtle, professional — not a phone ring)
- Accept navigates to the chat page and initiates the WebRTC answer
- Decline sends `call:decline` signal
- Auto-dismiss after 30s (missed call)

### 4. Call Bar Component

**Path:** `apps/web/src/components/call-bar.tsx`

Sticky bar at the top of the screen during an active call:

```
[Phone icon] Calling with Sophie Laurent    02:34    [Mute] [End Call]
```

- Fixed position, above all other content (z-index above sidebar, below modals)
- Minimal height (~48px)
- Green accent when connected, pulsing when ringing
- Duration counter updates every second
- Mute button toggles local audio track
- End call button triggers hangup

### 5. Chat Header Call Button

**Modification to:** `apps/web/src/components/chat-header.tsx`

Add a phone icon button to the chat header, **only when:**

- The engagement has a `permanent_posting_id` (not daywork)
- The engagement status is `active` (not completed, cancelled, or closed)
- Not already in a call

The button is a simple icon — no label, no badge. Tapping it calls `startCall(engagementId)`.

### 6. System Message on Call End

When a call ends (either party hangs up, connected duration > 0):

- POST to `/api/messages/[engagementId]` with `is_system: true`
- Message body: `Voice call — ${formatDuration(duration)}`
- This appears in the chat thread like other system messages (acceptance, work started, etc.)
- If the call was declined or missed (never connected), no system message is sent

---

## Permanent-Only Gate

The call button only appears for permanent engagements. The check is simple:

```typescript
// In chat header
const isPermanent = context?.permanent_posting_id != null;
const canCall = isPermanent && context?.status === 'active';
```

No server-side gate needed — the call is peer-to-peer. The signaling channel is engagement-scoped, so only the two participants can connect. The gate is purely UI: the button doesn't render for daywork.

**Why not daywork?**

- Daywork is fast. The employer accepted you, you show up Monday. There's nothing to interview about.
- Daywork engagements are short (1-14 days). The overhead of a voice call exceeds the complexity of the arrangement.
- If daywork calling is needed later, the architecture supports it — remove the `isPermanent` check. But don't ship it until there's demand.

---

## What It Is NOT

- **NOT video calling.** Voice only. Video adds camera permissions, bandwidth requirements, UI complexity (video tiles, camera toggle, screen share), and privacy concerns (crew on a dock in the sun don't want to be on camera). Voice is enough for an interview. Video is a future enhancement if demand exists.

- **NOT call recording.** No audio is recorded, stored, or transcribed. The only record is the system message in the chat thread ("Voice call — 12m 34s"). Recording introduces legal complexity (consent laws vary by jurisdiction — two-party consent in many EU countries where superyachts operate), storage costs, and privacy concerns. If recording is ever added, it must be explicitly opt-in by both parties with clear legal disclosure.

- **NOT a phone bridge.** This does not call actual phone numbers. It's a browser-to-browser WebRTC call. Both parties must have the DockWalker web app open. There is no PSTN integration, no dial-in number, no voicemail.

- **NOT a conference call.** One-to-one only. The call is between the two engagement participants. No third-party can join. No group calls. If an employer wants their captain to join the interview, the captain needs their own DockWalker account and their own engagement with the crew member (or they sit next to the employer and share a speaker — the real-world solution).

- **NOT a replacement for messaging.** The call supplements chat, it doesn't replace it. Important details discussed on the call should be confirmed in writing via chat. The system message ("Voice call — 12m 34s") serves as a timestamp anchor — "as discussed on our call at 14:30..."

- **NOT available offline or via push.** The callee must have the app open in a browser tab to receive the call. If they're offline, the caller sees "Unavailable." Push-triggered incoming calls require a native app with background execution (VoIP push on iOS, FCM high-priority on Android) — this is deferred until the mobile app ships.

---

## Browser Compatibility

WebRTC voice calling works in all modern browsers:

- Chrome/Edge: Full support
- Firefox: Full support
- Safari (macOS + iOS): Full support since Safari 14.1. iOS Safari has WebRTC quirks (audio session handling, autoplay restrictions) — test explicitly.
- Samsung Internet: Full support

**Microphone permissions:** The browser will prompt for microphone access on the first call. If denied, show a clear error: "Microphone access is required for voice calls. Check your browser settings." Do not request microphone permission preemptively — only when the user initiates or accepts a call.

---

## Dependencies

| Dependency              | Purpose                             | Cost                      | Required?                    |
| ----------------------- | ----------------------------------- | ------------------------- | ---------------------------- |
| Supabase Realtime       | Signaling (already integrated)      | Included in Supabase plan | Yes                          |
| Browser WebRTC API      | Audio media                         | Free (browser-native)     | Yes                          |
| Google STUN servers     | NAT traversal (80% of cases)        | Free                      | Yes                          |
| Twilio NTS (or similar) | TURN relay for restrictive networks | ~$0.0004/min              | Recommended but not blocking |

**No new npm packages required.** WebRTC is browser-native. Supabase Realtime is already installed. The only potential addition is the Twilio REST client for TURN credential generation — or a simple `fetch` to their API.

---

## Environment Setup

### Twilio Account Setup

1. Sign up at [twilio.com](https://www.twilio.com)
2. From the Twilio Console dashboard, copy:
   - **Account SID** (starts with `AC`)
   - **Auth Token** (shown once, regeneratable)
3. No need to buy a phone number — DockWalker uses Network Traversal Service only, not voice/SMS
4. NTS is enabled by default on all Twilio accounts — no product activation step needed

### Vercel Environment Variables

Add to Vercel Dashboard → Project → Settings → Environment Variables:

| Variable             | Value    | Where to find it                                          |
| -------------------- | -------- | --------------------------------------------------------- |
| `TWILIO_ACCOUNT_SID` | `AC...`  | Twilio Console → Dashboard → Account SID                  |
| `TWILIO_AUTH_TOKEN`  | (hidden) | Twilio Console → Dashboard → Auth Token (click to reveal) |

These are only needed in **Production** and **Preview** environments. Development can run without them (STUN-only fallback).

### Local Development

No Twilio credentials needed locally. The TURN credentials endpoint returns STUN-only config when `TWILIO_ACCOUNT_SID` is not set. Calls work on localhost (same network = no NAT traversal needed). To test TURN locally, add the Twilio env vars to `.env.local`.

### Codebase

The TURN credentials endpoint (`/api/calls/turn-credentials`) calls the Twilio NTS API directly via `fetch` — no Twilio SDK needed:

```
POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Tokens.json
Authorization: Basic base64({AccountSid}:{AuthToken})
```

Returns time-limited ICE server credentials (TTL ~5 minutes). The endpoint wraps this and returns the `iceServers` array to the client.

---

## Edge Cases

**Both parties call simultaneously:**
Resolve by comparing person IDs — lower UUID is the "polite" peer (accepts the other's offer, discards their own). Standard WebRTC "glare" resolution.

**Network drop during call:**
WebRTC's ICE restart mechanism handles brief disconnections. If the connection is lost for >10 seconds, show "Reconnecting..." to both parties. If lost for >30 seconds, end the call automatically with a system message "Voice call ended — connection lost — {duration}".

**Browser tab backgrounded:**
Most browsers throttle background tabs. Audio should continue (browsers exempt audio-playing tabs from aggressive throttling), but test this explicitly on Safari iOS which is most aggressive about background suspension. If audio drops when the tab is backgrounded, show a warning: "Keep DockWalker in the foreground during calls."

**Multiple browser tabs:**
If the user has DockWalker open in multiple tabs, only one should handle the call. The incoming call listener should use a `BroadcastChannel` or `localStorage` event to coordinate — first tab to accept wins, other tabs dismiss the overlay.

**Call during another call:**
Don't support this. If a user is already in a call and receives another, show "Busy — already in a call" to the second caller. One call at a time per user.

---

## Subscription Gating

Voice calling is **not gated behind a subscription** at launch. It's part of the permanent engagement experience for all users. Rationale:

- The call happens after selection — the employer has already committed to this crew member. Gating the interview behind a paywall after the employer made their choice is hostile UX.
- The cost is near-zero (peer-to-peer audio, minimal TURN relay usage).
- The value to the platform is high — every call that happens inside DockWalker is a call that doesn't happen on WhatsApp.

If voice calling needs to be monetised later (e.g., call duration limits, call recording as a premium feature), the architecture supports it — add a `requireSubscription` check in the TURN credentials endpoint.

---

## Implementation Checklist

**API:**

- [ ] `GET /api/calls/turn-credentials/route.ts` — auth required, returns ICE server config (STUN + optional TURN via Twilio NTS)

**Hooks:**

- [ ] `apps/web/src/hooks/use-voice-call.ts` — full call lifecycle (RTCPeerConnection, getUserMedia, Realtime signaling, mute, duration timer, cleanup)

**Components:**

- [ ] `apps/web/src/components/incoming-call-listener.tsx` — global listener in app layout, incoming call overlay with accept/decline
- [ ] `apps/web/src/components/call-bar.tsx` — sticky top bar during active call (timer, mute, end)
- [ ] `apps/web/src/components/share-job-button.tsx` — (unrelated, but listed in same session's spec)
- [ ] Modify `apps/web/src/components/chat-header.tsx` — add phone icon button for permanent engagements only

**Realtime:**

- [ ] Subscribe to `calls:{personId}` channel in app layout (ring detection)
- [ ] Subscribe to `call:{engagementId}` channel in chat page (full signaling)

**System message:**

- [ ] On call end (duration > 0), POST system message to chat: "Voice call — {duration}"

**Chat page:**

- [ ] Integrate `useVoiceCall` hook
- [ ] Show call bar when call active
- [ ] Disable call button during active call

**Testing:**

- [ ] Test on Chrome, Firefox, Safari (macOS), Safari (iOS)
- [ ] Test with STUN-only (no TURN configured)
- [ ] Test tab backgrounding on iOS Safari
- [ ] Test simultaneous call initiation (glare resolution)
- [ ] Test network drop recovery
