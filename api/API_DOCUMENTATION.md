# Where-To API Documentation

> **Base URL:** `http://localhost:3000/api`

All endpoints return JSON. Request bodies must be `application/json`.

---

## Data Model Overview

```
Institution
 └── Building (many)
      └── Floor (many)
           └── Seat (many)
```

All entities use **UUID** primary keys and include `createdAt` / `updatedAt` timestamps.

---

## Enums

| Enum | Values |
|------|--------|
| `SeatType` | `TABLE`, `CHAIR`, `SOFA` |
| `SeatStatus` | `AVAILABLE`, `OCCUPIED` |

---

## Institutions

### `POST /api/institutions`

Create a new institution.

**Body:**
```json
{
  "name": "Universitat de Barcelona",
  "address": "Gran Via de les Corts Catalanes, 585"
}
```

**Response:** `201` — the created institution object.

---

### `GET /api/institutions`

List all institutions.

| Query Param | Type | Description |
|-------------|------|-------------|
| `includeTree` | `"true"` | If set, returns the full nested tree: `buildings → floors → seats` |

**Response:** `200`
```json
[
  {
    "id": "uuid",
    "name": "Universitat de Barcelona",
    "address": "Gran Via de les Corts Catalanes, 585",
    "createdAt": "2026-03-14T12:00:00.000Z",
    "updatedAt": "2026-03-14T12:00:00.000Z",
    "buildings": [
      {
        "id": "uuid",
        "name": "Edifici Històric",
        "institutionId": "uuid",
        "floors": [
          {
            "id": "uuid",
            "floorNumber": 0,
            "buildingId": "uuid",
            "seats": [
              {
                "id": "uuid",
                "type": "CHAIR",
                "label": "A-01",
                "status": "AVAILABLE",
                "floorId": "uuid"
              }
            ]
          }
        ]
      }
    ]
  }
]
```

> **Note:** The `buildings` array and its nested data are **only** included when `?includeTree=true`.

---

### `GET /api/institutions/:id`

Get a single institution with its full nested tree.

**Response:** `200` — institution object with `buildings → floors → seats`.

**Errors:** `404` — Institution not found.

---

### `PATCH /api/institutions/:id`

Update institution fields.

**Body** (all fields optional):
```json
{
  "name": "Updated Name"
}
```

**Response:** `200` — the updated institution object.

---

### `DELETE /api/institutions/:id`

Delete an institution and all its nested children (cascading).

**Response:** `200`

---

## Buildings

### `POST /api/buildings`

**Body:**
```json
{
  "name": "Edifici A",
  "institutionId": "uuid-of-the-institution",
  "polygon": [
    { "x": 0, "y": 0 },
    { "x": 120, "y": 0 },
    { "x": 120, "y": 80 },
    { "x": 0, "y": 80 }
  ]
}
```

> `polygon` is optional. If provided, it must contain at least 3 points.

**Response:** `201`

---

### `GET /api/buildings`

| Query Param | Type | Description |
|-------------|------|-------------|
| `institutionId` | UUID | Filter buildings by institution |

**Response:** `200` — array of buildings (includes nested `floors`).

---

### `GET /api/buildings/:id`

**Response:** `200` — building with nested `floors → seats`.

---

### `PATCH /api/buildings/:id`

**Body** (all fields optional):
```json
{
  "name": "New Building Name",
  "polygon": [
    { "x": 0, "y": 0 },
    { "x": 100, "y": 0 },
    { "x": 90, "y": 90 },
    { "x": 0, "y": 80 }
  ]
}
```

**Response:** `200`

---

### `DELETE /api/buildings/:id`

**Response:** `200`

---

## Floors

### `POST /api/floors`

**Body:**
```json
{
  "floorNumber": 2,
  "buildingId": "uuid-of-the-building",
  "blockedAreas": [
    [
      { "x": 10, "y": 10 },
      { "x": 30, "y": 10 },
      { "x": 30, "y": 30 },
      { "x": 10, "y": 30 }
    ],
    [
      { "x": 60, "y": 40 },
      { "x": 80, "y": 40 },
      { "x": 80, "y": 70 },
      { "x": 60, "y": 70 }
    ]
  ]
}
```

> `blockedAreas` is optional. If provided, it must be an array of polygons, and each polygon must contain at least 3 points.

**Response:** `201`

---

### `GET /api/floors`

| Query Param | Type | Description |
|-------------|------|-------------|
| `buildingId` | UUID | Filter floors by building |

**Response:** `200` — array of floors (includes nested `seats`).

---

### `GET /api/floors/:id`

**Response:** `200` — floor with nested `seats`.

---

### `PATCH /api/floors/:id`

**Body** (all fields optional):
```json
{
  "floorNumber": 3,
  "blockedAreas": [
    [
      { "x": 5, "y": 5 },
      { "x": 35, "y": 5 },
      { "x": 35, "y": 25 },
      { "x": 5, "y": 25 }
    ]
  ]
}
```

**Response:** `200`

---

### `DELETE /api/floors/:id`

**Response:** `200`

---

## Seats

### `POST /api/seats`

**Body:**
```json
{
  "type": "CHAIR",
  "label": "A-01",
  "status": "AVAILABLE",
  "x": 18.5,
  "y": 42.25,
  "floorId": "uuid-of-the-floor"
}
```

> `status` is optional and defaults to `AVAILABLE`.
> Coordinates are optional, but when provided they must be sent together (`x` and `y`).

**Response:** `201`

---

### `GET /api/seats`

| Query Param | Type | Description |
|-------------|------|-------------|
| `floorId` | UUID | Filter seats by floor |

**Response:** `200` — array of seats.

---

### `GET /api/seats/:id`

**Response:** `200` — single seat object.

---

### `PATCH /api/seats/:id`

**Body** (all fields optional):
```json
{
  "status": "OCCUPIED",
  "x": 20,
  "y": 40
}
```

**Response:** `200`

---

### `DELETE /api/seats/:id`

**Response:** `200`

---

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 404,
  "message": "Institution with ID \"...\" not found",
  "error": "Not Found"
}
```

### Common errors

| Status | Meaning |
|--------|---------|
| `400` | Validation error — check the `message` array for details |
| `404` | Entity not found |
| `500` | Internal server error |

### Validation error example

```json
{
  "statusCode": 400,
  "message": [
    "name should not be empty",
    "name must be a string"
  ],
  "error": "Bad Request"
}
```

---

## Quick Start

```bash
# 1. Start the database
docker compose up -d

# 2. Install dependencies
cd api && npm install

# 3. Start the dev server
npm run start:dev

# 4. API is live at http://localhost:3000/api
```
