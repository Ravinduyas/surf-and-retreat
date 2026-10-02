# Response to the independent technical audit

**Audit date:** 9 August 2026 · **Wave 1 completed:** 9 August 2026

An independent audit found 2 Critical, 8 High, 13 Medium and 8 Low findings. This
records what was verified, what was fixed, and what deliberately was not.

**Every Wave 1 finding was confirmed in source before being fixed.** Four turned out
to be broader than reported.

---

## Wave 1 — done

| # | Finding | Fix | Proof |
|---|---|---|---|
| **C1** | `x-property-id` trusted with no membership check | Header validated against membership; role re-resolved for the target property; permission re-checked | `verify:isolation` |
| **H1** | Flat tax charged once per night instead of once per stay | Posted once per reservation, enforced by looking for the existing line | `verify:tax` |
| **H2** | `compound_on` never read | Honoured when set; NULL keeps today's behaviour exactly | `verify:tax` |
| **H3** | ARI push recorded rejected rooms as success | One shared envelope-and-per-item check across all four write paths | `verify:channelpush` |
| **H4** | Manager could self-promote to admin | All three paths closed: grant, self-promotion, reset link | `verify:isolation` |
| **H7** | Airbnb messaging dead on a code mismatch | `AIR` added; the test now asserts against the catalogue | `verify:messaging` |

**20 suites pass.** Frontend typechecks under strict mode and builds clean.

---

## What was broader than reported

**C1 was two defects, not one.** The missing membership check was the reported half.
The other: `resolveSession` resolves a user's role for the *session's* property, and
the header swap changed the property while keeping that role — so a manager at one
property stayed a manager at another where they were housekeeping. Both are fixed, and
the permission gate now re-runs for the role that actually applies.

A third, adjacent problem surfaced while fixing it: `permissionsFor` fell back to the
`readonly` grant set for any role it did not recognise. A typo in a role column handed
out read access to reservations, folios and channel settings instead of denying. It now
returns nothing.

**H4 had three independent routes to admin**, not one, and the role write touched
`user_properties` as well as `users` — so an escalation survived the per-property role
override that would otherwise have contained it.

**H1 has a smaller sibling.** Percentage taxes are computed per night rather than on the
stay total, so quote and folio can differ by rounding even now that the flat-fee bug is
gone. `verify:tax` asserts the two totals match and currently passes; if a property's tax
configuration ever makes that drift material, the check will catch it before a guest does.

**H7 is the one that reflects on us.** The feature had a passing test. That test asserted
`channelCarriesMessages('AIRBNB')` — the implementation's own constant — rather than the
code the channel catalogue actually issues (`AIR`). It agreed with the bug. The
assertions are now driven by the catalogue, plus a guard that every messaging OTA is
reachable by the code the UI creates it with, so this class of drift fails loudly.

**The lesson is general:** a test that quotes the implementation back to itself proves
nothing. The same review found `'HWD'` asserted against a catalogue that issues `'HW'`.
Both are corrected.

---

## Decisions taken

**The unassigned-user fallback now depends on installation size.** A user with no
`user_properties` rows previously saw every property — deliberate convenience for
single-property installs, and the reason a membership check alone would not have closed
C1. That convenience now applies **only while exactly one property exists**. Nothing
changes for a single-property installation today, and the hole shuts by itself the moment
a second property is created.

**`compound_on` defaults to the old behaviour.** NULL means "compound on everything
earlier in `sort_order`", which is what every existing property is configured around.
Only a tax that explicitly names its base gets the new path. Changing how tax is computed
under a live property would have been its own billing incident.

**A rejected push now stays in the queue.** Previously the queue row was marked `sent`
regardless, so a rejected change was dropped and never retried. It now counts an attempt
and stays queued, failing only after five.

---

## Not done — and why

Wave 2 and Wave 3 were out of scope for this pass by agreement. Two things deserve to be
called out rather than buried:

**C2 is Critical and still open.** Seven of eight roles can read the Beds24 refresh token
from `GET /api/channels`, and it is stored in clear text — so it is also in every backup.
C1 was fixed first because it made C2 reachable *across properties*; on its own C2 still
hands a read-only staff account full control of the property's OTA distribution. **This
should be the next work, not much later.**

**H8 — no error boundary.** One render error white-screens the whole app. For an all-day
front-desk tool that is a genuine operational risk, and it is a small fix.

Remaining: H5 (MFA brute force), H6 (no Beds24 timeouts — a hung socket stops all channel
sync silently), M1–M13, L1–L8.

---

## Where the audit was right about our own claims

The audit noted that our 240 passing checks "verify the features the team set out to
build — they do not cover the gaps *between* features, security boundaries, or edge
cases." That is accurate and worth keeping in view. Three of the six Wave 1 defects lived
in exactly those gaps, and one of them had a green test sitting on top of it.

The new suites are written against boundaries rather than features: `isolation-check`
runs the real server and forges the header over HTTP, because unit-testing the helpers
would have passed both before and after the fix.
