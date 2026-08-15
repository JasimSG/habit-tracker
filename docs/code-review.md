# Part 2 — Code Review

## Overall assessment

The sample demonstrates the intended feature shape, but I would request changes before merging. The highest-risk issues are SQL injection, hard-coded production credentials, broken asynchronous control flow in the dashboard endpoint, and an API/frontend contract mismatch around `email`. There are also React state/effect issues, missing validation/authorization, unsafe error exposure, and a race condition around duplicate daily logs.

## Findings

### P0 — Hard-coded database credentials

**Location:** `server.ts` database pool configuration.

The code contains a production host, root username, and password in source code. This is a credential leak and makes environment-specific deployment unsafe.

**Fix:** Read credentials from environment variables or a secret manager. Rotate the exposed credential immediately if it is real.

---

### P0 — SQL injection in multiple queries

**Location:** `/api/dashboard` and `/api/logs` queries.

Values such as `userId`, `habitId`, and `value` are interpolated into SQL strings. A malicious request can alter the query and potentially read or modify data.

**Fix:** Use parameterized queries/prepared statements:

```ts
db.execute('SELECT * FROM habits WHERE user_id = ?', [userId]);
```

Also validate types and ranges before querying.

---

### P0 — Dashboard `forEach(async ...)` is not awaited

**Location:** `/api/dashboard`.

`forEach` does not wait for the async callback. The response can be sent before any logs have been added to `result`, and errors inside the callback are not handled by the route's normal error flow.

**Fix:** Prefer one SQL query with a join, or use `Promise.all` with `map` if separate queries are genuinely required. A single query is preferable here because it avoids N+1 database calls.

---

### P1 — POST `/api/logs` has an API contract mismatch

**Location:** backend reads `email`, frontend does not send it.

The backend destructures `email` and logs it, while the frontend sends only `userId`, `habitId`, and `value`. More importantly, the server should not trust an email supplied by a client for identity or audit logging.

**Fix:** Remove `email` from this request contract and obtain identity from authenticated server-side context.

---

### P1 — Insert query is not awaited

**Location:** `db.query(...)` inside `/api/logs`.

The response is returned immediately after starting the insert. The insert can fail after the API has already reported success.

**Fix:** `await` the insert and return success only after it completes. Ideally wrap the read/check/write flow in a transaction and enforce a unique database constraint.

---

### P1 — Duplicate daily logging has a race condition

**Location:** existing-log check followed by insert.

Two concurrent requests can both observe no existing row and then both insert.

**Fix:** Add a database unique constraint such as `(user_id, habit_id, log_date)` and handle duplicate-key errors. A transaction can complement the constraint, but the database constraint is the final guarantee.

---

### P1 — Internal stack traces are exposed to clients

**Location:** error middleware.

`err.stack` can expose SQL details, filesystem paths, implementation details, and other sensitive information.

**Fix:** Log the detailed error server-side and return a stable generic error response to the client. Use a request ID for correlation.

---

### P1 — Missing authorization boundary

**Location:** endpoints accept arbitrary `userId` values.

A caller can request another user's dashboard or attempt to create/log data for another user.

**Fix:** Authenticate the caller and derive the user ID from the authenticated principal. Check ownership on habit operations.

---

### P1 — React effect for fetching data has no dependency array

**Location:** `HabitDashboard.tsx` first `useEffect`.

Without a dependency array, the effect runs after every render, causing repeated requests and potentially an endless render/request loop.

**Fix:** For an initial load, use `useEffect(() => { ... }, [userId])`, and handle loading/error states.

---

### P1 — Search effect has incomplete dependencies

**Location:** second `useEffect`.

The filtering effect depends on both `habits` and `search`, but only `search` is listed. New API data can leave `filtered` stale.

**Fix:** `}, [habits, search]);` or derive `filtered` with `useMemo` instead of storing derived state.

---

### P1 — React state is mutated directly

**Location:** `const updated = habits; updated.find(...).logs.push(...); setHabits(updated);`

`updated` points to the existing state array and the nested logs array is mutated in place. React may not detect the change as a new state value, and this makes rendering behavior harder to reason about.

**Fix:** Create new array/object references, or simply reload/merge the server response after a successful POST.

---

### P2 — Array index used as React key

**Location:** `filtered.map((habit, index) => <div key={index}>...)`.

Indexes are unstable keys when the filtered list changes and can cause incorrect component reuse.

**Fix:** Use `key={habit.id}`.

---

### P2 — Date calculation uses UTC serialization for a calendar-day feature

**Location:** `toISOString().slice(0, 10)`.

A user's local calendar date can differ from UTC around midnight, causing streak/completion calculations to shift by a day.

**Fix:** Define the application's timezone semantics explicitly and calculate calendar dates in that timezone. For a production system, store the user's IANA timezone.

---

### P2 — `SELECT *` makes the API/database coupling broader than necessary

**Location:** habit and log queries.

Returning every column increases coupling and can accidentally expose fields added later.

**Fix:** Select the exact fields needed by the API.

---

### P2 — Request validation is missing

**Location:** all routes.

The API assumes query/body values have the expected type and shape.

**Fix:** Validate IDs as positive integers, habit names and log values with length limits, and reject malformed requests with HTTP 400.

---

## Suggested merge plan

1. Rotate/remove the exposed credentials and move secrets to environment/secret management.
2. Parameterize every SQL query.
3. Fix dashboard async flow, preferably with a single join query.
4. Remove client-supplied identity fields and add authentication/authorization.
5. Await writes and enforce the daily uniqueness constraint at the database layer.
6. Fix React effect dependencies and state mutation.
7. Add tests around dashboard data, duplicate logging, authorization, and date boundaries.

The sample is small enough that I would prefer fixing these fundamentals before adding more UI features.
