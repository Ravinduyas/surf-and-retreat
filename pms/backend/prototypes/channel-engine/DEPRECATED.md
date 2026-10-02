# Deprecated — not part of Helio

This package is an **early standalone prototype** that was never wired into the
application. It is superseded by `backend/src/services/channels.ts` and
`backend/src/channels/beds24.ts`, which are the live channel integration.

**Nothing imports this package.** Its README contradicts the root README about
which implementation is canonical, which is exactly the trap an audit flagged:
a new contributor reads it, believes it is the channel manager, and changes the
wrong file.

It is kept only because it contains a retry/backoff approach that may be worth
lifting into the live connector. Once that is done — or decided against — delete
the directory.

**Do not add to it, import it, or fix bugs in it.**
