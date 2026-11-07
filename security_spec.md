# Security Specification (`security_spec.md`)

## 1. Data Invariants & Master Source of Truth

1. **Strict Tenant Isolation (`ownerId == request.auth.uid`)**:
   - Every document in `/production_records/{recordId}`, `/saved_scenarios/{scenarioId}`, and `/optimisation_statuses/{statusId}` belongs exclusively to the authenticated user whose `request.auth.uid` matches `ownerId`.
   - No blanket reads (`allow read: if isSignedIn()`) exist anywhere in the ruleset. Every `get` and `list` operation enforces `resource.data.ownerId == request.auth.uid`.
2. **Verified Identity Gate**:
   - All write operations (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **Path Variable Hardening (`isValidId`)**:
   - Document IDs (`{recordId}`, `{scenarioId}`, `{statusId}`) on single-document operations (`get`, `create`, `update`, `delete`) must satisfy `id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`.
4. **Strict Key Allowlisting & Anti-Update-Gap**:
   - Every `create` and `update` must pass the entity validation helper (`isValidProductionRecord`, `isValidSavedScenario`, `isValidOptimisationStatus`), enforcing exact `hasAll` and `hasOnly` key sets, string length bounds, regex patterns, numeric range checks, and server timestamps (`request.time`).
   - Every `update` enforces immutability on `ownerId` and `createdAt`, requires `updatedAt == request.time`, and restricts modified keys via `incoming().diff(existing()).affectedKeys().hasOnly(...)`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Unauthenticated Write)**: Attempting to create a `production_records` document with `request.auth == null`. -> `PERMISSION_DENIED`
2. **Payload 2 (Unverified Email Spoof)**: Attempting to create a `production_records` document where `request.auth.token.email_verified == false`. -> `PERMISSION_DENIED`
3. **Payload 3 (Cross-Tenant Identity Spoofing on Create)**: Authenticated user `user_A` creates a `production_records` document with `ownerId: "user_B"`. -> `PERMISSION_DENIED`
4. **Payload 4 (Shadow/Ghost Field Injection on Create)**: Submitting a valid `production_records` payload plus an undeclared `"isAdmin": true` field. -> `PERMISSION_DENIED`
5. **Payload 5 (Path ID Poisoning)**: Creating `/production_records/invalid$id!with*bad^chars` violating `^[a-zA-Z0-9_\-]+$`. -> `PERMISSION_DENIED`
6. **Payload 6 (String Boundary Overflow / Denial of Wallet)**: Creating a `saved_scenarios` document with a `description` of 2,000 characters (`maxLength` is 500). -> `PERMISSION_DENIED`
7. **Payload 7 (Invalid Enum Injection)**: Creating a `production_records` document with `sector: "Aerospace"` (not in allowed sector enum). -> `PERMISSION_DENIED`
8. **Payload 8 (Client Timestamp Forgery on Create)**: Creating a `saved_scenarios` document with a past or future `createdAt` timestamp instead of `request.time`. -> `PERMISSION_DENIED`
9. **Payload 9 (Immortal Field Mutation on Update)**: Updating an existing `production_records` document by changing `ownerId` or `createdAt`. -> `PERMISSION_DENIED`
10. **Payload 10 (Update-Gap Value Poisoning)**: Updating an allowed field (`unitsProduced`) on `production_records` with a string `"one hundred"` or negative number `-50`. -> `PERMISSION_DENIED`
11. **Payload 11 (Unauthorized Cross-Tenant Read/Get)**: User `user_A` attempting `get` on `/saved_scenarios/scen_1` owned by `user_B`. -> `PERMISSION_DENIED`
12. **Payload 12 (Unconstrained List Scraping)**: User `user_A` attempting `list` on `/production_records` without filtering `where('ownerId', '==', 'user_A')`. -> `PERMISSION_DENIED`

---

## 3. Red Team Audit & Conflict Report

| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning | Validation Helper in Update | Value Poisoning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/production_records/{recordId}` | Blocked (`ownerId == request.auth.uid` & immutable) | Blocked (Action-based `affectedKeys().hasOnly()`) | Blocked (`isValidId(recordId)` & `.size()` limits) | Present (`isValidProductionRecord(incoming())`) | Blocked (Strict `is number` & range bounds) |
| `/saved_scenarios/{scenarioId}` | Blocked (`ownerId == request.auth.uid` & immutable) | Blocked (Action-based `affectedKeys().hasOnly()`) | Blocked (`isValidId(scenarioId)` & `.size()` limits) | Present (`isValidSavedScenario(incoming())`) | Blocked (Strict delta bounds `-50` to `100`) |
| `/optimisation_statuses/{statusId}` | Blocked (`ownerId == request.auth.uid` & immutable) | Blocked (Valid enum transition gate) | Blocked (`isValidId(statusId)` & `.size()` limits) | Present (`isValidOptimisationStatus(incoming())`) | Blocked (Strict enum & `ownerNote.size() <= 400`) |
