# Response to the product & technology strategy

**Strategy dated:** 9 August 2026 · **Assessed:** 9 August 2026

## The verdict

The document is sound, well-researched, and its central thesis is correct: Helio's
advantage is a correct core, and the right move is to turn that into a platform rather
than race incumbents on module count. The four market shifts are accurately drawn, and
the sequencing rule — *"do not build the platform on top of the unfixed audit issues"* —
is the single most valuable sentence in it.

Four things are worth pushing back on or sharpening before executing.

---

## 1 · Payments cannot be NOW. C2 makes it dangerous.

The strategy puts embedded payments (Theme C) in the **NOW** horizon, alongside the
audit fixes. Its own sequencing rule says otherwise, and the specifics are worse than the
general principle suggests.

Integrating Stripe or Adyen means storing PSP credentials. Today, channel credentials
live in `channels.settings` as clear-text JSON, and `GET /api/channels` returns that blob
whole to anything holding `channels.read` — which is **seven of the eight roles**. A
payment integration built on the same pattern would put live payment keys behind a
read-only staff account.

**Payments must come after C2, not beside it.** That is not caution; it is the difference
between a contained defect and a card-processing incident. The correct NOW order is:

1. **C2** — strip credentials from responses, encrypt secrets at rest
2. **H6** — request timeouts (a hung socket currently stalls all distribution, silently)
3. **H8** — front-end error boundary
4. **Observability** — you cannot operate payments blind
5. **CI** — see §3
6. *then* payments

## 2 · CI belongs in NOW, not NEXT

The document lists a test and delivery pipeline under **NEXT**. I would move it up.

Helio has 20 verification suites and roughly 600 checks. **Every one of them runs only
when somebody remembers to run it.** That was survivable while the surface was small and
one person was working on it. It stops being survivable the moment payments, a public API
or a second contributor arrives.

It is also cheap — the suites already exist and already exit non-zero. Wiring them to run
on every push is hours, not weeks, and it protects everything else in the roadmap. The
audit's H7 is the argument: a broken feature sat behind a green test for months. Automation
would not have caught that one (the test itself was wrong), but it is exactly the kind of
regression CI *does* catch once the test is right.

## 3 · One claim I am treating as the source's, not as fact

*"Only 1 of 13 PMS platforms yet ships an AI/agent (MCP) interface."* That is cited to a
2026 scorecard and I have not verified it independently. The strategic conclusion holds
either way — an agent-legible API over a correct data model is worth building on its own
merits — but the "almost nobody has done this" framing should not be repeated as fact in
anything customer-facing until it is checked.

## 4 · Where the document undersells what already exists

**Resilience — requeue is done.** The strategy lists "a requeue path for failed pushes"
as outstanding. It was built as part of the audit's H3 fix: a rejected push now counts an
attempt and stays queued rather than being marked sent. Timeouts and idempotency keys
remain.

**Hostel depth — bed configuration landed.** A room type can now state what is physically
in it, with sleeping capacity derived from the beds rather than duplicated as a second
number. That strengthens the wedge the strategy identifies. The remaining depth items are
correctly named: visual bed assignment, gender rules enforced at booking, and the
group-bed workflow. They are already scoped in
[docs/rooms-and-dorms.md](docs/rooms-and-dorms.md) as I4.

**Honest failure states are enforced, not aspirational.** Worth stating plainly because it
is the differentiator the strategy wants to market: no-show reporting, guest messaging and
the ARI push all check the envelope *and* the per-item result, and none of them will claim
a success they did not get.

---

## What I agree with without reservation

- **Correctness as the position.** "The PMS that never lies about your numbers" is a real
  promise and a hard one to copy. Every feature added must keep earning it.
- **Dorms as first-class.** Under-served, growing, and genuinely hard — most hotel systems
  bolt it on badly. RevPAB alongside RevPAR is a good credibility signal.
- **The AI lane.** Agents are only as good as the data model beneath them. A clean,
  integer-precise ledger is exactly the substrate that makes an agent trustworthy instead
  of plausible. This is the right differentiator to chase.
- **Recommendations a human approves.** Pricing suggestions that a person confirms match
  the honesty ethos and are the right first shape for anything AI-driven.

---

## Revised NOW list — progress

| # | Item | Status |
|---|---|---|
| 1 | Audit Wave 1 — isolation, tax, channel push, privilege | done |
| 2 | **C2** — credentials stripped from responses, encrypted at rest | done |
| 3 | **H6** — Beds24 request timeouts + guards that cannot jam | done |
| 4 | **H8** — front-end error boundary | done |
| 5 | CI — 21 suites, both typechecks and the build on every push | done |
| 6 | Codebase hygiene — dead `channel-engine` quarantined | done |
| 7 | Observability — structured logs, readiness probe, alerting | next |
| 8 | Embedded payments (Theme C) | unblocked |

**21 suites pass.** Payments is now safe to build: PSP credentials will go through
`lib/secrets.ts` rather than into a clear-text blob that seven roles can read.

Everything in NEXT and LATER stands as written.
