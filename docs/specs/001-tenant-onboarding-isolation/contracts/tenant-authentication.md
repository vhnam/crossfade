# Contract: Tenant Request Authentication

Applies to every tenant-facing endpoint added by this feature and every feature
that depends on it (handoff requests, session queries, etc.). Defines how a
tenant identifies itself (FR-004, FR-005, FR-006) and how isolation is enforced
(FR-008).

## Header

```
Authorization: Bearer cf_live_<api-key>
```

- Required on every tenant-facing request. No alternative means of specifying
  tenant identity (query param, body field) is accepted — FR-006.

## Resolution behavior

1. Missing header → `401 Unauthorized`, no tenant resolved, no data touched.
2. Header present but key doesn't match any tenant's stored hash →
   `401 Unauthorized`.
3. Header matches a tenant, but that tenant's `status` is `suspended` →
   `403 Forbidden` (request authenticated but rejected — FR-009). No data
   created or exposed.
4. Header matches an `active` tenant → request proceeds, resolved `tenantId` is
   attached to the request context and used to scope every downstream data
   access (FR-008). Exactly one tenant is ever resolved per request (FR-004).

## Isolation guarantee surfaced to contract consumers

Every tenant-facing endpoint's response is implicitly filtered to the resolved
`tenantId`. There is no request shape, on any tenant-facing endpoint, that
accepts another tenant's identifier as a parameter — attempting to reference
another tenant's resource by ID returns `404 Not Found` (indistinguishable from
"doesn't exist") rather than `403`, so existence of other tenants' resources is
never confirmable (FR-008).

## Example error responses

```json
// 401 - missing or invalid key
{ "statusCode": 401, "message": "Invalid or missing API credential" }
```

```json
// 403 - suspended tenant
{ "statusCode": 403, "message": "Tenant is suspended" }
```
