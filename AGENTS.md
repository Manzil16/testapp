# AGENTS.md

## Project identity

This repository is **VehicleGrid**, an Expo / React Native app for EV charger discovery, booking, hosting, and platform administration.

The app serves **3 roles**:
- `driver`
- `host`
- `admin`

Each role must feel like a distinct product experience while sharing:
- the same codebase
- the same design language
- the same data layer
- the same routing and auth foundation

This is not a demo-first app. It should behave like a real product with real Firestore-backed flows.

---

## Core working style for this repository

When working in this repo:

1. **Do not do broad repo rewrites unless explicitly asked.**
2. Prefer **targeted root-cause fixes** over cosmetic rewrites.
3. For bug-fix or repair tasks, **inspect only files directly tied to the reported issue first**.
4. Do not reread or refactor unrelated files that are already working.
5. Do not respond with vague summaries like “improved functionality.”
6. A task is not done until:
   - code changes are implemented
   - relevant flows are verified
   - `npm run typecheck` passes
   - `npm run lint` passes, or any remaining lint exceptions are explicitly documented

If a task is a repair pass, treat it as a **surgical execution task**, not a redesign.

---

## Repo priorities

When making decisions, prioritize in this order:

1. **Real functionality**
2. **Correct role behavior**
3. **Correct Firestore-backed data flow**
4. **Stable navigation and routing**
5. **Theme consistency**
6. **Premium UI polish**
7. **Nice-to-have enhancements**

Do not hide broken logic behind pretty UI.

---

## Technology assumptions

This project uses:
- Expo
- React Native
- TypeScript
- Expo Router
- React Navigation
- Firebase Auth
- Firestore
- `react-native-maps`
- `react-native-reanimated`
- `react-native-gesture-handler`

Assume the app should remain compatible with the current repo stack unless explicitly asked to upgrade dependencies.

Do not introduce new UI frameworks or major architectural replacements unless explicitly asked.

---

## Routing and role rules

### Role source of truth
The role source of truth is the authenticated user profile from Firestore / auth context.

Use:
- `useAuth()`
- `profile.role`
- existing route gate logic

Do not invent parallel role state.

### Role UX rule
Each role must see a clearly distinct experience:
- Driver: trip discovery, booking, vehicles, profile
- Host: charger management, booking operations, earnings, profile
- Admin: oversight, verification, trust, data inspection

### Routing rule
When editing routing:
- preserve working auth routes
- preserve route gate behavior
- verify tab-to-screen mapping for each role
- avoid broken tabs, redirect loops, inaccessible tabs, or dead routes

If a tab exists, it must map to a working screen.
If a role should not access a tab, remove or gate it cleanly.

---

## Dev preview / mock fallback rules

This repo contains `dev-preview` functionality. Preserve it.

However:

1. **Never leak preview/mock fallback into normal authenticated app flows.**
2. Preview/mock data must only appear in an explicit dev-preview mode or dedicated preview path.
3. If Firestore returns permission errors in normal app mode:
   - do not silently swap to fake content
   - do not silently replace live state with preview state
   - show proper loading, empty, or permission error state
4. Do not let preview fallback contaminate:
   - normal login
   - dashboard
   - charger discovery
   - bookings
   - trip planner
   - admin verification
   - profile or user state

If you find a repository function that falls back to preview data after a Firestore failure, isolate that fallback behind an explicit preview-only flag.

This is a hard rule.

---

## Firestore data integrity rules

### No undefined writes
Never send `undefined` to Firestore.

Before any write:
- sanitize payloads
- omit optional fields that are not set
- do not pass `undefined` inside nested objects

Applies especially to:
- trips
- bookings
- notifications
- chargers
- reviews
- profile updates
- admin actions

### Real data over fake assumptions
Do not invent data when Firestore query results are missing.
Use:
- empty state
- error state
- retry state

### Consistent status values
Statuses must be consistent across:
- repositories
- hooks
- screens
- filters
- cards
- admin actions

Do not introduce mismatched status names like:
- `pending` vs `requested`
- `pendingVerification` vs `pending_verification`
- `confirmed` vs `approved`

Normalize status handling at the real source of truth and propagate consistently.

### Listener behavior
When using Firestore listeners:
- set up clean subscriptions
- clean up on unmount
- do not let stale listeners overwrite fresh state
- do not let optimistic state flicker and then disappear because a later listener returns conflicting or filtered data

If a record appears briefly and vanishes, inspect:
- filters
- status transitions
- listener overwrite logic
- permission/fallback interactions

---

## Repair-pass routing for file reading

For **repair tasks**, do not do a whole-app audit first.

### Read order
1. read the screen or route where the bug appears
2. read the hook used by that screen
3. read the repository/service used by that hook
4. read types/status definitions only if necessary
5. stop expanding once the root cause is identified

### Avoid
- reading unrelated components for style only
- rereading all theme or auth files unless directly needed
- rewriting screens that already work

### Good behavior
If the issue is:
- bookings disappearing → inspect booking screen, booking hook, booking repository, status definitions
- admin verification auto-approving → inspect admin verification screen/hook, charger save flow, charger status update path
- trip save crash → inspect trip hook/repository/write payload only
- wrong preview data → inspect repository fallback logic and preview toggle path only

Stay focused.

---

## UI and design rules

### Canonical design reference
`sign-in` and `sign-up` screens are the canonical quality reference for the app.

When building or repairing screens:
- match their polish level
- match spacing rhythm
- match card treatment
- match hierarchy
- match interaction quality
- match premium feel

Do not downgrade those screens.
Do not create a separate visual language.

### Theme usage
Use project theme tokens wherever they exist:
- `Colors`
- `Typography`
- `Spacing`
- `Radius`
- `Shadows`
- animation/theme helpers already defined in the repo

Avoid:
- hardcoded hex values
- raw font stacks
- random spacing numbers where tokens exist

If a touched file still contains obvious hardcoded visual values and there is a theme token available, replace it.

### Scope rule for polish
For repair passes:
- only polish screens/files you are already touching for the bug fix
- do not launch a whole-app beauty pass unless explicitly asked

### Screen-state rule
Every production screen should support, where applicable:
- loading state
- empty state
- error state
- populated state

Do not let permission-denied appear as “empty” unless that is explicitly intended and labeled.

---

## Booking rules

### Availability enforcement
A driver must only be able to book a charger **within the host-defined availability window**.

This must be enforced in both:
- UI flow
- write / repository / service layer

Do not rely only on frontend visuals.

### Charger detail booking UX
The charger detail / booking flow should:
- clearly show allowed booking windows
- prevent obviously invalid times where possible
- reject invalid submissions with a clear reason
- use proper date/time input components, not raw ISO text inputs

### Booking lifecycle
Bookings must persist visibly in the correct state and segment.

When fixing booking behavior, validate:
- driver creation status
- host segment filters
- admin visibility if relevant
- status transitions
- no flicker/disappear behavior

---

## Trip planner rules

Trip planner must function as a real workflow, not a placeholder.

Expected flow:
1. select origin
2. select destination
3. geocode accurately enough for intended region
4. calculate route
5. estimate battery usage
6. determine feasibility
7. recommend charger if needed
8. save trip successfully
9. never crash on missing optional data

### Search behavior
When working on geocoding:
- improve precision
- bias toward intended operating region if current service supports it
- keep selected result stable after selection
- avoid re-fuzzing a confirmed selection unnecessarily

### Vehicle defaults
If a user has a saved vehicle or reserve preference:
- use those values as defaults
- do not ignore them in favor of random placeholders

---

## Admin rules

Admin screens are not decorative dashboards.

They must operate on **real database-backed data**.

### Overview cards
If an overview card exists for:
- users
- chargers
- bookings
- revenue

it should open a meaningful real-data inspection path if the feature is implemented.

### Revenue
Do not use fake revenue placeholders if actual booking data exists.
Compute revenue from the current booking model.

### Verification
Admin verification actions must be explicit.
A pending charger must not auto-verify without an admin-triggered action.

### Trust
Trust / watchlist / suspended items must reflect actual charger status and action paths.

---

## Component and hook usage rules

### Hooks
Prefer extracting business logic into hooks if the screen is becoming overloaded.

But for repair passes:
- do not create new hooks unless needed for clarity or reuse
- prefer fixing the broken existing hook first

### Components
Reuse existing shared components where appropriate.
Do not duplicate components just to make one screen work quickly.

### New abstractions
Only create new abstractions when:
- they clearly reduce duplication
- they match existing architecture
- they do not create one-off complexity

---

## Logging and debug rules

Do not leave noisy logs in production code.

Allowed:
- useful debug logging under `__DEV__`
- temporary debugging during a task, removed before completion

Avoid:
- repeated repository warnings caused by fake fallback logic
- silent catches that hide important failures
- raw console spam in screens

---

## Editing rules

### Preserve what is already good
Do not rewrite working files just because you are nearby.
Do not restyle good screens during a bug-fix task unless the touched area is visibly broken.

### Minimal necessary changes
Prefer the smallest change that correctly fixes the root cause.

### No fake shortcuts
Do not “fix” broken Firestore behavior by replacing it with static arrays or fake local data in normal app mode.

### No hidden regressions
When changing a shared repository or hook, consider all affected roles.

---

## Verification workflow

For meaningful changes, run:
- `npm run typecheck`
- `npm run lint`

If a task affects routing, bookings, trip planner, or admin flows, verify behavior logically and/or through runtime checks.

### Minimum role verification expectations

#### Driver
- login works
- dashboard uses real state, not preview fallback
- bookings tab opens
- explore works without fake data pollution
- booking respects availability
- trip save does not crash

#### Host
- login works
- charger creation works
- charger remains pending until admin action
- incoming bookings remain visible in correct segment
- host actions affect booking state consistently

#### Admin
- login works
- pending verification remains pending until manual approval/rejection
- overview reads real data
- verification/trust actions reflect real status changes

---

## Output expectations for Codex tasks in this repo

When finishing a non-trivial task, report:
1. files inspected
2. files changed
3. root cause
4. exact fix applied
5. commands run
6. remaining limitations or follow-ups

Do not end with vague claims like:
- “improved functionality”
- “enhanced UI”
- “optimized performance”

Be concrete.

---

## Preferred behavior when context is large

If the task is large or the session has a lot of context:

1. do not continue drifting across the whole repo
2. summarize completed vs remaining work
3. continue from current repo state
4. focus only on the next unresolved issue set
5. preserve previous good work

If you are unsure what remains, inspect changed files and produce a compact gap analysis before further edits.

---

## Directory guidance

### `app/`
Treat files here as route and screen entrypoints.
Prefer keeping them presentation-focused where possible.
Do not overload route files with deep repository logic if an existing hook or service is more appropriate.

### `src/hooks/`
Hooks should own subscription logic, derived state, and screen-specific orchestration where appropriate.
They must:
- clean up listeners
- expose meaningful loading/error/data state
- avoid leaking preview fallback into normal mode

### `src/features/`
This is the core business/data layer.
Repository/service fixes here are often the correct place for:
- Firestore write sanitization
- status normalization
- permission/fallback behavior
- listener/query correctness

Do not patch over repository bugs only in screen code if the real problem is here.

### `src/components/`
Use shared components consistently.
Do not create near-duplicates unless explicitly justified.

---

## Hard rules

These are hard rules for this repo:

1. Do not leak `DEV_PREVIEW` fallback into normal authenticated app mode.
2. Do not auto-verify chargers without explicit admin action.
3. Do not allow bookings outside host availability.
4. Do not send `undefined` values to Firestore.
5. Do not leave broken tabs/routes accessible.
6. Do not treat a task as complete without verification.
7. Do not do broad rewrites when a focused repair is requested.

---

## If asked to do a repair pass

When the user asks for fixes after a rebuild, interpret that as:

- inspect only affected files first
- identify root causes
- implement targeted fixes
- verify affected flows
- avoid whole-app rework

This is the default repair-pass mode for VehicleGrid.

---

## If asked to do a rebuild pass

If the user explicitly requests a broad rebuild:
- preserve good auth screens as the visual reference
- preserve existing architecture where sound
- still avoid unnecessary rewrites of stable code
- implement in phases
- verify after each phase

---

## Final principle

This repository should move toward a **real, role-aware, Firestore-backed product**, not a polished prototype with fake data or broken flows.

When forced to choose, prefer:
- truth over appearance
- root-cause fixes over surface work
- stable real data over preview convenience
- clear scoped execution over big wandering edits