# Firebase Security Specification (TDD) — ADESCOMA

## 1. Data Invariants
- **Socios Collection**:
  - Any user can read/list the partners (`/socios`).
  - Creating a partner requires an authenticated user with a verified email.
  - Updating a partner requires an authenticated user with a verified email.
  - The `createdAt` timestamp is immutable once written.
  - The `status` field must only be "activa" or "suspendida".
  - The `presion` field must be a valid number between 0 and 200 PSI.
  - Geographical coordinates (`latitud` and `longitud`) must be valid numbers (or null) representing real GPS spots: latitud within [-90, 90] and longitud within [-180, 180].

## 2. The "Dirty Dozen" Payloads
These payloads represent attempts to bypass identity, integrity, state, or bounds checks, and must return `PERMISSION_DENIED` on writes:

1. **Unauthenticated Creation**: Try to create a socio document without being authenticated.
2. **Unverified Email Creation**: Logged-in user tries to create a socio but their email is not verified (`email_verified == false`).
3. **Invalid Caudal Status**: Try to create or update a socio with `status: "broken_valve"` (violates enum restriction).
4. **Dangerous High Pressure**: Try to update with `presion: 5000` (violates upper limit of 200 PSI).
5. **Negative Caudal Pressure**: Try to update with `presion: -10` (violates lower limit of 0 PSI).
6. **Impossible Latitud Location**: Try to update with `latitud: 145.23` (violates coordinate range [-90, 90]).
7. **Impossible Longitud Location**: Try to update with `longitud: -289.40` (violates coordinate range [-180, 180]).
8. **Shadow Field Injection**: Try to update/create a socio with an unrequested property like `isAdmin: true` or `overrideBill: true` (violates strict key schema enforcement).
9. **createdAt Spoofing/Mutability**: Try to update the socket with a modified `createdAt` timestamp after it was initially established.
10. **Malicious ID Poisoning**: Try to write to a document whose ID contains non-alphanumeric characters or is over 128 characters long.
11. **Client Timestamp Override**: Try to create a document using a manually set client timestamp (instead of `request.time` server sentinel) for `createdAt`.
12. **Malicious Long String Injection**: Try to insert a payload containing huge string fields (e.g. `nombre` with 1MB data) attempting Denial of Wallet resource exhaustion.

## 3. Test Cases (TDD Blueprint)
We define the test expectations in `/firestore.rules.test.ts` (conceptual testing flow) that ensure all 12 bad payloads are blocked.
All read/list tasks should proceed normally for any guest.
