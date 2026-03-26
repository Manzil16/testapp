# VehicleGrid — 20 Hard Panel Questions

These are the toughest questions your panel might ask, along with potential inconsistencies they may spot. Prepare answers for each.

---

## Pricing & Revenue Model

### 1. Your average rate per kWh ranges from $0.25 to $0.85 AUD. How did you arrive at these figures, and how do they compare to actual commercial charging rates in Australia?
**Why they'll ask:** Australian public DC fast chargers charge ~$0.40–$0.70/kWh (Chargefox, Evie). Your SLOW tier ($0.25–$0.50) undercuts commercial rates significantly — they'll question whether home chargers at 7 kW can even cover the host's electricity cost (~$0.30/kWh retail in NSW). A host charging $0.25/kWh on a slow charger is losing money after electricity costs.

### 2. You take a 20% platform fee. How does this compare to Airbnb (3% host / ~14% guest) or Uber (~25%)? Why would a host list on VehicleGrid at 20%?
**Why they'll ask:** 20% is aggressive for a marketplace with no brand recognition yet. If a host charges $0.55/kWh and pays ~$0.30/kWh for electricity, VehicleGrid takes $0.11/kWh, leaving the host only $0.14/kWh profit. They'll question unit economics.

### 3. The total cost shown to the driver includes the platform fee on top of the kWh price. But the booking repository calculates `totalAmount = pricePerKwh * estimatedKWh` WITHOUT the platform fee, then stores the platform fee separately. So is the total shown to the user actually what gets charged?
**The inconsistency:** In [chargers/[chargerId].tsx](app/(app)/chargers/[chargerId].tsx), the UI calculates `total = price * kWh * (1 + 20%)` — showing the fee-inclusive price. But in [booking.repository.ts](src/features/bookings/booking.repository.ts), `totalAmount = pricePerKwh * estimatedKWh` (fee NOT included), and `platformFee` is stored separately. So when the driver sees "Total: $23.10" on the charger page but the booking stores `total_amount = $19.25`, there's a mismatch. **You should clarify whether `total_amount` in the DB is the driver-facing total or the pre-fee subtotal.**

---

## Payment & Stripe Integration

### 4. When exactly does the driver get charged? The PaymentIntent is created when the HOST approves — but the driver already sees a "Payment Successful" screen at booking time. Explain this flow.
**The inconsistency:** The checkout screen (new) simulates payment at booking time. But in `useHostBookings.ts`, the real Stripe `createPaymentIntent` is called during `approveMutation` — when the host approves. So the driver "pays" in the UI but no real Stripe charge happens until the host approves. Panel will ask: what if the host declines — is the driver refunded? What was even charged?

### 5. Your Stripe edge function creates a PaymentIntent but there are no webhook handlers. How do you confirm the payment actually succeeded? What if the card declines after the intent is created?
**Why they'll ask:** Stripe PaymentIntents require confirmation on the client side (via `stripe.confirmPayment()`), and webhook events (`payment_intent.succeeded`) to verify server-side. Your app has neither — no `@stripe/stripe-react-native` SDK, no webhook endpoint. The payment flow is structurally incomplete.

### 6. There is no refund mechanism in the codebase. Your cancellation policy says "free cancellation up to 2 hours before." How would refunds actually work?
**Why they'll ask:** No `stripe.refunds.create()` call exists anywhere. The `updateBookingStatus` function just changes the status string — it doesn't trigger any Stripe refund. This is a critical gap for a real payment system.

### 7. The checkout screen stores dummy card numbers client-side. In a real Stripe integration, card details never touch your server. How would you implement PCI-compliant card collection?
**Expected answer:** Use `@stripe/stripe-react-native` `CardField` or `PaymentSheet` which tokenizes on Stripe's servers. The current dummy flow is for demo purposes only.

---

## Technical Architecture

### 8. You use Supabase for the backend but have no real-time subscriptions. When a host approves a booking, how does the driver know? They have to pull-to-refresh?
**Why they'll ask:** There's a `NOTIFICATION_REFETCH_INTERVAL: 30_000` (30-second polling), but no Supabase Realtime channels. For a booking app, 30-second delays on status changes feel unacceptable.

### 9. Your booking expiry is handled client-side in `mapRow()` — if `Date.now() > expires_at`, you change the status to "cancelled" in-memory but never update the database. What happens when the host opens the booking?
**The inconsistency:** In [booking.repository.ts:10-14](src/features/bookings/booking.repository.ts#L10-L14), expired bookings are only visually cancelled on the driver's device. The host still sees them as "requested" and could approve an expired booking. There's no server-side cron or database trigger to actually expire bookings.

### 10. The `estimated_kwh` is a user-input field defaulting to 35 kWh. There's no validation against the vehicle's battery capacity. A driver with a 40 kWh Leaf could request 200 kWh. How do you handle this?
**Why they'll ask:** The `InputField` for kWh only enforces `Math.max(5, ...)` as a minimum. No maximum based on the driver's registered vehicle battery. No cross-validation exists.

### 11. Row Level Security policies allow `driver_id = auth.uid() OR host_id = auth.uid()` to update bookings. This means a driver could update their own booking status to "completed" without the host's consent. Is this a security concern?
**Why they'll ask:** The RLS policy on bookings for UPDATE is `driver_id = auth.uid() or host_id = auth.uid()` — it doesn't restrict WHICH columns or status transitions each party can make.

---

## Business Logic & UX

### 12. A host can set a charger to "always available" with no availability window. But there's no mechanism to prevent double-bookings on the same charger at the same time. How do you handle scheduling conflicts?
**Why they'll ask:** The `createBookingRequest` function doesn't check for overlapping bookings on the same charger. Two drivers could book the same 2–3 PM slot.

### 13. Your trip planner uses OSRM for routing but recommends chargers along the route. How do you determine which chargers are "along the route" vs. out of the way? What's the detour threshold?
**Why they'll ask:** The trip planner stores `recommended_charger_id` but the logic for choosing it is unclear. Panel will probe whether it's nearest-to-route, cheapest, or random.

### 14. The app supports three roles: Driver, Host, and Admin. Can a user be both a Driver and a Host? The schema uses a single `role` column with a CHECK constraint allowing only one value.
**The inconsistency:** `role text not null default 'driver' check (role in ('driver', 'host', 'admin'))` — this is a single-value field. In real-world peer-to-peer charging, many hosts are also drivers. The current schema doesn't support dual roles.

### 15. Your verification system assigns a numeric score (0–100) to chargers, with thresholds at 85 (verified) and 45 (flagged). But who assigns these scores? The admin UI lets admins approve/reject, but how does a score of 92 vs. 86 get determined?
**Why they'll ask:** In `AppConfig.VERIFICATION`, `approvedScore: 92` and `reinstateScore: 86` are hardcoded. When an admin approves a charger, it gets exactly 92 — there's no rubric or variable scoring. The "score" is really just a boolean with extra steps.

---

## Scalability & Production Readiness

### 16. All charger listings are fetched with `.select("*")` and no pagination in the discover screen. What happens with 10,000 chargers? How does your map handle that density?
**Why they'll ask:** The `listAllChargers` function fetches everything. With `react-native-maps`, rendering thousands of markers will freeze the UI. There's no clustering, viewport-based querying, or PostGIS spatial queries.

### 17. You use `expo-image-picker` for charger photos with a max width of 1200px. Images are stored in Supabase Storage. What's the cost implication of 10,000 chargers with 6 photos each at full resolution?
**Why they'll ask:** 60,000 images x ~500KB average = ~30GB storage. Supabase free tier gives 1GB. There's no CDN, no thumbnail generation, no progressive loading strategy.

### 18. Your admin queries use `ADMIN_QUERY_LIMIT: 250` and `ADMIN_MAX_PROFILES: 300`. What happens when the platform has 5,000 users? The admin can't see most of them.
**Why they'll ask:** The admin overview, trust, and verify screens all have hard limits. There's no search, filtering by date range, or server-side pagination for admin views.

---

## Data Integrity & Edge Cases

### 19. The `price_per_kwh` column is `numeric(6,4)` allowing values up to 99.9999. There's no CHECK constraint for reasonable pricing. Could a host accidentally set $99/kWh? What about $0.00/kWh (free charging)?
**Why they'll ask:** The charger form has `minPricePerKwh: 0.2` in the app config but no DB-level constraint. A direct API call or bug could insert any price. Free chargers ($0) would break the platform fee calculation.

### 20. Your `on delete cascade` on bookings means if a host deletes their profile, ALL their charger data AND all driver bookings on those chargers are permanently deleted. A driver loses their booking history. Is this acceptable?
**Why they'll ask:** The cascade chain is: `profiles -> chargers -> bookings -> reviews`. One host account deletion wipes out potentially hundreds of driver booking records and reviews. In a real financial system, this violates data retention requirements. Booking and payment records should be preserved even if the host leaves.

---

## Summary of Key Inconsistencies to Address

| # | Issue | Location |
|---|-------|----------|
| 1 | `total_amount` in DB excludes platform fee, but UI shows fee-inclusive total | `booking.repository.ts` vs `[chargerId].tsx` |
| 2 | Payment UI happens at booking time, but real Stripe charge happens at host approval | `checkout.tsx` vs `useHostBookings.ts` |
| 3 | No webhook handlers for payment confirmation | Missing entirely |
| 4 | Booking expiry is client-side only | `booking.repository.ts:10-14` |
| 5 | No double-booking prevention | `booking.repository.ts:createBookingRequest` |
| 6 | Single role per user (can't be both driver and host) | `profiles` table schema |
| 7 | No refund mechanism despite cancellation policy | Missing entirely |
| 8 | No RLS column-level restrictions on booking updates | `00001_initial_schema.sql:222-223` |
