# `docs/archive/`

Specs and guides for work that was built and then deleted, kept as historical
reference. The intent is to preserve architectural thinking even when the
code it produced has been removed.

## Contents

- **`mobile-web-split-spec.md`** — architecture spec for the native mobile
  app (`apps/mobile/`). Built across Stages 163–173 then deleted on
  2026-04-29. See the spec's archive header for deletion rationale.
- **`testflight-tester-guide.md`** — installation guide for the (now
  non-existent) TestFlight build. Archived alongside the mobile delete.

## Adding to this directory

When archiving a spec or guide:

1. `git mv` the file from its original location into `docs/archive/`.
2. Add an `> ARCHIVED YYYY-MM-DD.` block at the top with one paragraph on
   what shipped, what was deleted, and why. The original content stays
   below.
3. Update this README with a one-line entry pointing at the file.

The point is that a future contributor (human or agent) reading the repo
can find the design thinking behind anything that's been removed, without
the active codebase carrying the framing-debt of "deferred / in-progress"
labels.
