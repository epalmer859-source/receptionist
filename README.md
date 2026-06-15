# Aigent OS — Receptionist

The AI receptionist "brain" for same-day field-service businesses: one system
prompt + one tool (`capture_lead`) behind a single endpoint, reusable across web
chat, SMS, and voice. It carries an inbound customer conversation and produces a
structured **Lead** the dispatch dashboard can render.

This is the first build step from the Aigent OS handoff, extracted as a
standalone Next.js project.

## Stack

- **Next.js + TypeScript**
- **Anthropic API** (Claude `claude-opus-4-8`) — the receptionist's reasoning

## The endpoint

```
POST /api/chat
{ "messages": [{ "role": "user" | "assistant", "content": string }], "channel"?: "web" | "sms" | "voice" }
→ { "ok": true, "reply": string, "lead": Lead | null }
```

`reply` is the assistant's text. `lead` is `null` until the receptionist has
gathered enough detail (name + address + a clear problem + urgency); once it
fires `capture_lead`, `lead` is the structured object:

```ts
Lead {
  name; phone; address; lat; lng;          // lat/lng null until geocoded
  channel;                                  // "web" | "sms" | "voice"
  urgency;                                  // "emergency" | "soon" | "flexible"
  status;                                   // "new" | "contacted" | "scheduled"
  callback; summary;
  convo;                                    // [{ who: "ai" | "cust", text }]
  createdAt;
}
```

## Getting started

```bash
npm install
cp .env.example .env.local      # then set ANTHROPIC_API_KEY
npm run dev                     # http://localhost:3000
```

Prove the full flow against the running server:

```bash
npm run test:chat
```

It drives a hardcoded emergency conversation ("upstairs AC quit, 84° inside with
an infant") and asserts the receptionist gathers what it needs and then captures
the lead as `emergency`.

## Configure the tenant

The system prompt is built from `src/config/business.ts` (name, service area,
hours, description). Edit only that file to point the brain at a different
business. The default values describe a fictional demo tenant — replace them
with verified information before going live.

## Layout

```
src/
  config/business.ts        # tenant context for the system prompt
  lib/receptionist.ts       # the brain: system prompt + capture_lead tool + runReceptionist()
  app/api/chat/route.ts     # POST /api/chat
  app/{layout,page}.tsx     # minimal landing page documenting the endpoint
scripts/test-chat.mjs       # end-to-end proof (npm run test:chat)
```

## What's next (not in this repo yet)

Per the handoff build order: persist `Conversation` / `Message` / `Lead` via
Prisma + Postgres, then add the chat widget, then SMS (Twilio webhook → same
route), then voice via a managed bridge. The route returns the captured `Lead`
today so the persistence layer can drop straight in.
