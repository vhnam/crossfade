# Contract Addendum: Handoff-Intake Bounded Response Time

Extends 002's
[`contracts/handoff-intake-api.md`](../../002-handoff-intake/contracts/handoff-intake-api.md)
(`POST /handoffs`) with the failure-mode guarantee this feature adds (FR-001,
FR-002, FR-005).

## Guarantee

Every call to `POST /handoffs` either returns a response (any status code —
`201`, `200`, `400`, `401`, etc., per 002's contract) or fails with
`503 Service Unavailable` **within 5 seconds** of the request being received. No
response ever takes longer than 5 seconds, and no request is left to hang past
that point.

## New Response

- `503 Service Unavailable` — the handler did not complete within the 5-second
  bound (e.g. downstream dependency, such as the database, is slow or
  unreachable):
  ```json
  { "statusCode": 503, "message": "Handoff intake did not complete in time" }
  ```

## Integration Guidance for Tenants (FR-002)

Tenants integrating `POST /handoffs` SHOULD set their own client-side HTTP
timeout to a value at or slightly above 5 seconds (e.g. 6-7 seconds to account
for network latency), and treat _any_ failure — timeout, `503`, connection
refused, or unexpected error — as "live chat isn't available for this
interaction right now," continuing their own core flow unaffected. Crossfade
never requires a tenant to retry on the tenant's behalf (out of scope, per spec)
— a subsequent handoff attempt for the same interaction is safe (002's FR-004
duplicate-handling still applies) but is entirely the tenant's own choice.

## Recovery (FR-004)

No separate "recovery" signal exists — a request made after Crossfade becomes
healthy again is a normal request, authenticated the same way (001) as before
the outage, and succeeds without any prior failure affecting it. There is no
circuit-breaker state a tenant needs to reset.
