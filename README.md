# Creator Card Service

A Node.js REST microservice for managing creator cards. Built on an existing
project scaffold using Express and MongoDB with soft deletion, slug-based
retrieval, and per-card access controls.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Endpoints](#endpoints)
- [Request and Response Shapes](#request-and-response-shapes)
- [Business Rules](#business-rules)
- [Error Codes](#error-codes)
- [Data Model](#data-model)
- [Slug Generation](#slug-generation)
- [Soft Deletion](#soft-deletion)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Deployment](#deployment)

---

## Overview

The Creator Card Service exposes three public endpoints for creating, retrieving,
and deleting creator cards. Cards can be public or private. Private cards require
an access code on retrieval. Draft cards are not publicly retrievable. All
deletions are soft, meaning the record is retained in the database and the slug
is freed for reuse.

---

## Architecture

The service follows the scaffold conventions established in the project template:

- **Endpoints** are thin Express handlers that pass raw request data to services
- **Services** own all validation and business logic
- **Repository** abstracts all database access through a factory pattern
- **Models** define Mongoose schemas using the template schema helpers
- **Messages** centralise all user-facing error strings
- **Core** provides shared utilities: validator (VSL), error handling, repository
  factory, Mongoose helpers, and the Express server abstraction

No authentication, API keys, or versioned URL prefixes are used. All routes are
mounted at the root.

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/creator-cards` | Create a new creator card |
| GET | `/creator-cards/:slug` | Retrieve a card by slug |
| DELETE | `/creator-cards/:slug` | Soft-delete a card by slug |

---

## Request and Response Shapes

### POST /creator-cards

**Request body**

```json
{
  "title": "George Cooks",
  "description": "Weekly cooking podcast and recipe content.",
  "slug": "george-cooks",
  "creator_reference": "crt_8f2k1m9x4p7w3q5z",
  "links": [
    { "title": "YouTube", "url": "https://youtube.com/@georgecooks" }
  ],
  "service_rates": {
    "currency": "NGN",
    "rates": [
      { "name": "IG Story Post", "description": "One story mention", "amount": 5000000 }
    ]
  },
  "status": "published",
  "access_type": "public"
}
```

Required fields: `title`, `creator_reference`, `status`

Optional fields: `description`, `slug`, `links`, `service_rates`, `access_type`, `access_code`

**Success response — HTTP 200**

```json
{
  "status": "success",
  "message": "Creator Card Created Successfully.",
  "data": {
    "id": "01KVKVGZN0MK2XG41RDW2PYDYT",
    "title": "George Cooks",
    "description": "Weekly cooking podcast and recipe content.",
    "slug": "george-cooks",
    "creator_reference": "crt_8f2k1m9x4p7w3q5z",
    "links": [{ "title": "YouTube", "url": "https://youtube.com/@georgecooks" }],
    "service_rates": { "currency": "NGN", "rates": [...] },
    "status": "published",
    "access_type": "public",
    "access_code": null,
    "created": 1782001810477,
    "updated": 1782001810477,
    "deleted": null
  }
}
```

Notes:
- `access_code` is always present in create responses. It is `null` for public cards
  and the actual code for private cards.
- `deleted` is always `null` on a freshly created card.
- HTTP status is `200`, not `201`.

---

### GET /creator-cards/:slug

**Query parameter (optional):** `access_code`

Example: `GET /creator-cards/vip-rate-card?access_code=A1B2C3`

**Success response — HTTP 200**

```json
{
  "status": "success",
  "message": "Creator Card Retrieved Successfully.",
  "data": {
    "id": "01KVKVH04KS67NW3D4MW75QZMW",
    "title": "VIP Rate Card",
    "slug": "vip-rate-card",
    "creator_reference": "crt_x9y8z7w6v5u4t3s2",
    "status": "published",
    "access_type": "private",
    "created": 1782001810477,
    "updated": 1782001810477,
    "deleted": null
  }
}
```

Notes:
- `access_code` is **never** present in retrieval responses, not even as `null`.
- `_id` is never exposed. The identifier is always serialised as `id`.

---

### DELETE /creator-cards/:slug

**Request body**

```json
{
  "creator_reference": "crt_8f2k1m9x4p7w3q5z"
}
```

`creator_reference` is required and must be exactly 20 characters. The record is
only deleted if the slug and creator_reference both match an active card.

**Success response — HTTP 200**

```json
{
  "status": "success",
  "message": "Creator Card Deleted Successfully.",
  "data": {
    "id": "01KVKVGZN0MK2XG41RDW2PYDYT",
    "slug": "ada-designs-things",
    "access_code": null,
    "deleted": 1782001832930,
    ...
  }
}
```

Notes:
- Response format matches the create response, including `access_code`.
- `deleted` is a Unix epoch millisecond timestamp.
- The slug is freed for reuse after deletion.

---

## Business Rules

### Access control on retrieval

Access rules are enforced in this exact order:

1. No active card found for the slug — `NF01` (HTTP 404)
2. Card is a draft — `NF02` (HTTP 404)
3. Card is private and no `access_code` query param was provided — `AC03` (HTTP 403)
4. Card is private and the provided `access_code` is wrong — `AC04` (HTTP 403)
5. All checks pass — return the card

### Access code rules on creation

- A private card (`access_type: "private"`) must include `access_code` — `AC01`
- A public card must not include `access_code` — `AC05`
- `access_code` must be exactly 6 alphanumeric characters

### Slug uniqueness

- If a client provides a slug that is already taken by an active card, the request
  fails with `SL02`.
- If no slug is provided, one is generated from the title. If the generated slug is
  already taken, a random 6-character suffix is appended and retried automatically.
- Duplicate key errors from MongoDB on insert are caught and translated to `SL02`
  for client-provided slugs, or retried with a suffix for auto-generated slugs.

---

## Error Codes

All error responses follow this shape:

```json
{
  "status": "error",
  "message": "Human-readable description.",
  "code": "SL02"
}
```

| Code | HTTP | Meaning |
|------|------|---------|
| `SL02` | 400 | Duplicate client-provided slug |
| `AC01` | 400 | Private card missing access_code |
| `AC05` | 400 | Public card with access_code set |
| `NF01` | 404 | No active card found for this slug |
| `NF02` | 404 | Card exists but is a draft |
| `AC03` | 403 | Private card, no access_code provided |
| `AC04` | 403 | Private card, wrong access_code |

Validation failures (field type, length, enum, format) return HTTP 400 with the
VSL validation error shape. No custom code is used for these.

---

## Data Model

Collection: `creatorCards`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ULID string | Internal identifier, never exposed in responses |
| `title` | string | 3 to 100 characters, required |
| `description` | string | Max 500 characters, optional |
| `slug` | string | 5 to 50 characters, letters/numbers/hyphens/underscores, unique among active records |
| `creator_reference` | string | Exactly 20 characters, required |
| `links` | array | Each item has `title` (1-100 chars) and `url` (must start with http:// or https://) |
| `service_rates` | object | Has `currency` (NGN, USD, GBP, GHS) and `rates` array |
| `rates[].name` | string | 3 to 100 characters |
| `rates[].description` | string | Max 250 characters |
| `rates[].amount` | integer | Positive integer, minimum 1 |
| `status` | string | `draft` or `published` |
| `access_type` | string | `public` or `private`, defaults to `public` |
| `access_code` | string | Exactly 6 alphanumeric characters, private cards only |
| `created` | number | Unix epoch milliseconds |
| `updated` | number | Unix epoch milliseconds |
| `deleted` | number | `0` internally for active records, serialised as `null` in responses |

Indexes: `slug` is unique among active records. Soft-deleted records have their
slug rewritten to free the value for reuse.

---

## Slug Generation

When no slug is provided:

1. Lowercase the title
2. Replace whitespace with hyphens
3. Remove all characters that are not letters, numbers, hyphens, or underscores
4. If the result is shorter than 5 characters, append a hyphen and a random
   6-character alphanumeric suffix
5. If the result is already taken by an active card, append a suffix and retry

When a slug is provided by the client:

- Must match `[A-Za-z0-9_-]` only
- Must be between 5 and 50 characters
- If already taken, fail with `SL02`. The slug is never modified.

---

## Soft Deletion

Records are never hard-deleted. On delete:

- The `deleted` field is set to the current Unix timestamp in milliseconds
- The `slug` field is rewritten to `&del:<timestamp>-<original-slug>` so the
  original slug is freed and can be reused
- The `updated` field is updated to match the deletion timestamp
- All repository `findOne` calls automatically exclude records where `deleted != 0`

---

## Project Structure

```
app.js                          server setup and route registration
bootstrap.js                    entry point, loads .env
Procfile                        Render/Heroku start command

models/
  creator-card.js               Mongoose schema with ULID _id and paranoid soft delete

repository/
  creator-card/index.js         repository factory wired to CreatorCard model

messages/
  creator-card.js               all user-facing error strings

services/creator-cards/
  create-card.js                create service with VSL validation and business rules
  get-card.js                   retrieval service with ordered access control
  delete-card.js                soft-delete service
  serialize-creator-card.js     serialises DB documents to API response shape
  generate-slug.js              slug generation from title with suffix logic
  throw-creator-card-error.js   maps business error codes to messages
  validators.js                 custom validators for slug, access code, URLs, amounts

endpoints/creator-cards/
  create.js                     POST /creator-cards
  get.js                        GET /creator-cards/:slug
  delete.js                     DELETE /creator-cards/:slug

core/
  errors/                       throwAppError, error code constants, HTTP mappings
  express/                      Express server abstraction, response wrappers
  mongoose/                     DatabaseModel helper, ULID support, paranoid soft delete
  repository-factory/           generic CRUD factory used by all repositories
  validator-vsl/                VSL field validation engine

test/
  creator-card.test.js          22 Mocha/Chai tests covering all assessment cases

scripts/
  seed-cards.js                 seeds 3 sample cards into the database
```

---

## Setup

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```
PORT=8811
MONGODB_URI=<your MongoDB connection string>
PINO_LOG_LEVEL=error
NO_SINGLE_ERRORS=1
TOP_LEVEL_ERROR_MESSAGE=Validation failed.
```

Install dependencies:

```bash
npm install
```

Start the server:

```bash
node bootstrap.js
```

You should see:

```
server started on port 8811
mongodb connected
```

---

## Running Tests

Tests connect to the real database. `MONGODB_URI` must be set in `.env`.

```bash
npm test
```

The suite runs 22 tests covering:

- Full card creation with all fields
- Auto-generated and client-provided slugs
- Private card creation and access code rules
- Draft card non-retrieval
- All error codes: SL02, AC01, AC05, NF01, NF02, AC03, AC04
- Soft delete and post-delete retrieval
- Response shape assertions on every success response
- Slug suffix generation on collision and short titles

---

## Deployment

The service is designed to deploy on Render.

1. Push the repository to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
3. Connect the repository and set:
   - **Build command:** `npm install`
   - **Start command:** `node bootstrap.js`
4. Add environment variables in the Render dashboard (same keys as `.env`)
5. Under MongoDB Atlas **Network Access**, allow connections from `0.0.0.0/0`
   so Render's dynamic IPs are not blocked
6. Once deployed, the base URL is your submission URL

The `Procfile` at the project root (`web: node bootstrap.js`) is also recognised
by Heroku if you prefer that platform.

---

## Live URL

https://your-render-url.onrender.com
