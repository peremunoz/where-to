# Next Steps (Post-Hackathon)

This document tracks improvements that are intentionally deferred so the hackathon build stays focused on delivery speed.

## 1. SSE Filtering (Planned)

Current status:
- SSE stream is implemented and working at `GET /api/events/stream`.
- All subscribers currently receive all `db-change` events.

Planned improvement:
- Support query params to reduce event traffic per client.

Proposed filters:
- `entity`: `institution | building | floor | seat`
- `action`: `created | updated | deleted`
- `institutionId`: UUID
- `buildingId`: UUID
- `floorId`: UUID

Frontend usage target:
```javascript
const source = new EventSource(
  'http://localhost:3000/api/events/stream?entity=floor&buildingId=<building-uuid>'
);
```

## 2. Authentication and Authorization

Planned improvement:
- Add auth module (JWT or session-based).
- Protect write endpoints first (`POST`, `PATCH`, `DELETE`).
- Add role-based authorization if needed (`admin`, `editor`, `viewer`).

## 3. E2E Test Coverage

Planned improvement:
- Add smoke e2e tests for institutions, buildings, floors, and seats.
- Include geometry validation scenarios.
- Include floor capacity + building `totalCapacity` validation.

## 4. Production Hardening

Planned improvement:
- Replace `synchronize: true` with migrations.
- Add request logging/correlation IDs.
- Add rate limiting and improved observability.

## Suggested Priority

1. Authentication and authorization
2. E2E tests for core flows
3. SSE filtering
4. Production hardening
