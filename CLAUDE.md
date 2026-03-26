# CLAUDE.md — VehicleGrid EV Charging Marketplace
## Authoritative implementation guide for Claude Code

> This file is the single source of truth for VehicleGrid architecture, UI patterns,
> data models, and business logic. Read it fully before writing any code.
> Every decision documented here was made deliberately — do not deviate without a comment explaining why.

---

## 0. PROJECT IDENTITY

**App:** VehicleGrid — peer-to-peer EV charging marketplace (Airbnb for EV chargers)
**Stack:** Expo Router SDK 54 · Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) · TypeScript strict · React 19 · Zustand · React Query (TanStack v5)
**Root:** `/Users/manzildahal/Desktop/testapp`
**Design language:** Teal `#00BFA5` primary · Syne bold headings · DM Sans body · 8pt spacing grid
**Target:** iOS + Android (Expo Go for dev, EAS Build for production)

---

## 1. CRITICAL ARCHITECTURE DECISIONS

### 1.1 Navigation — NO bottom sheets for detail screens

**Problem:** Charger detail and booking screens were presented as bottom sheets (`presentation: 'modal'`). Each screen stacked on top of the previous one, creating a tower of half-visible cards. Users lost spatial context completely.

**Solution:** Every detail screen is a full-page stack push. Bottom sheets are ONLY used for quick confirmations (< 3 fields) and filter panels.

```typescript
// app/(app)/_layout.tsx — CORRECT configuration
<Stack>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen
    name="chargers/[chargerId]"
    options={{
      headerShown: true,
      headerTitle: '',
      headerTransparent: true,   // hero image bleeds under nav bar
      headerBackTitle: 'Back',
    }}
  />
  <Stack.Screen name="checkout" options={{ title: 'Confirm booking' }} />
  <Stack.Screen name="bookings/[bookingId]" options={{ title: 'Booking details' }} />
  <Stack.Screen name="host/booking/[bookingId]" options={{ title: 'Booking request' }} />
  <Stack.Screen name="payment-success" options={{ title: '', headerBackVisible: false }} />
</Stack>

// NEVER do this:
// presentation: 'modal'        ← creates bottom sheet stack
// presentation: 'transparentModal' ← same problem
```

**Rule for discover.tsx map:** Show a small absolute-positioned preview card at the bottom when a charger pin is selected (NOT a bottom sheet). Card has charger name, price, distance, one CTA. Tapping "View details" calls `router.push('/chargers/' + id)`.

```typescript
// discover.tsx — preview card pattern
{selectedCharger && (
  <View style={styles.previewCard}>  // position: 'absolute', bottom: 90, left: 16, right: 16
    <Text style={styles.previewName}>{selectedCharger.name}</Text>
    <Text style={styles.previewPrice}>${selectedCharger.pricingPerKwh}/kWh · {distance}km</Text>
    <Pressable onPress={() => router.push(`/chargers/${selectedCharger.id}`)}>
      <Text>View details →</Text>
    </Pressable>
  </View>
)}
```

### 1.2 Screen navigation structure

```
Tab navigator (always visible)
├── discover.tsx          → push → chargers/[id].tsx → push → checkout.tsx → push → payment-success.tsx
├── bookings.tsx          → push → bookings/[bookingId].tsx → push → session-history.tsx
├── dashboard.tsx         (no detail push needed, links to above)
├── host-home.tsx
├── host-chargers.tsx     → push → host/charger-form.tsx
├── host-bookings.tsx     → push → host/booking/[bookingId].tsx
├── profile.tsx
└── settings.tsx
```

---

## 2. BOOKING SYSTEM — COMPLETE IMPLEMENTATION

### 2.1 Booking states (exhaustive)

| State | Trigger | Payment action | UI colour |
|---|---|---|---|
| `requested` | Driver submits booking | Stripe auth hold placed | Amber |
| `approved` | Host approves | Hold maintained | Teal |
| `active` | Driver signals `arrived` + grace start | None | Blue |
| `missed` | Grace period lapses with no arrival | Hold released, no refund | Red |
| `completed` | Session ends | Partial capture of actual kWh | Green |
| `cancelled` | Driver or host cancels | Refund per policy | Gray |
| `expired` | 24h passed, host never responded | Hold released | Gray |
| `declined` | Host declines | Hold released immediately | Red |

### 2.2 Database migrations needed

**Migration 00015 — booking session fields:**
```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS grace_expires_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_kwh NUMERIC(8,3);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_amount NUMERIC(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_ended_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_payout_amount NUMERIC(10,2);

-- Grace period trigger: when approved, set grace window = start_time + 15 min
CREATE OR REPLACE FUNCTION set_grace_period()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'requested' THEN
    NEW.grace_expires_at := NEW.start_time + INTERVAL '15 minutes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_grace_period
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION set_grace_period();

-- pg_cron job: mark missed bookings every 5 minutes
SELECT cron.schedule('mark-missed-bookings', '*/5 * * * *', $$
  UPDATE bookings
  SET status = 'missed'
  WHERE status = 'approved'
    AND grace_expires_at < NOW()
    AND arrival_signal NOT IN ('arrived', 'charging');
$$);
```

### 2.3 Booking repository — race condition handling

```typescript
// src/features/bookings/booking.repository.ts
export type BookingCreateResult =
  | { success: true; bookingId: string }
  | { conflict: true }       // slot taken by someone else
  | { unverified: true }     // driver not cleared to book
  | { error: string };

export async function createBookingRequest(
  input: CreateBookingInput
): Promise<BookingCreateResult> {
  // Gate 1: driver must be verified
  const gate = await getVerificationGate(input.driverUserId);
  if (!gate.driver_cleared) {
    return { unverified: true };
  }

  try {
    const { data, error } = await supabase.rpc('create_booking_safe', {
      p_charger_id:    input.chargerId,
      p_driver_id:     input.driverUserId,
      p_host_id:       input.hostUserId,
      p_start_time:    input.startTimeIso,
      p_end_time:      input.endTimeIso,
      p_estimated_kwh: input.estimatedKWh,
      p_subtotal:      input.subtotalAmount,
      p_fee:           input.platformFee,
      p_total:         input.totalAmount,
    });

    if (error?.code === '23P01') return { conflict: true }; // exclusion constraint
    if (error) return { error: error.message };
    return { success: true, bookingId: data };
  } catch (e: any) {
    return { error: e.message };
  }
}
```

### 2.4 Refund policy matrix (enforced in stripe-reconcile-payment edge function)

| Scenario | Timing | Refund % |
|---|---|---|
| Driver cancels | > 2hr before start | 100% |
| Driver cancels | < 2hr before start | 50% |
| Driver misses (grace lapsed) | — | 0% |
| Host cancels after approval | Any | 100% |
| Charger fails mid-session | After session start | Proportional remaining kWh |
| Driver ends session early | After session start | Proportional remaining kWh |
| Host declines request | Before approval | 100% |

### 2.5 Energy calculation — kWh estimation

This runs live in `checkout.tsx` as users adjust target battery percentage.

```typescript
// src/utils/energyCalculator.ts
export function calculateBookingEnergy(params: {
  batteryCapacityKwh: number;
  currentBatteryPercent: number;
  targetBatteryPercent: number;
  chargerPowerKw: number;
  chargingEfficiency?: number;  // default 0.90 (AC), 0.95 (DC)
}): {
  estimatedKwh: number;       // wall delivery — what gets billed
  estimatedHours: number;     // drives end_time calculation
  estimatedCost: number;      // subtotal before platform fee
} {
  const efficiency = params.chargingEfficiency ?? 0.90;
  const delta = (params.targetBatteryPercent - params.currentBatteryPercent) / 100;
  const neededInBattery = delta * params.batteryCapacityKwh;
  const estimatedKwh = neededInBattery / efficiency;
  const estimatedHours = estimatedKwh / params.chargerPowerKw;

  return {
    estimatedKwh:   Math.round(estimatedKwh * 10) / 10,
    estimatedHours,
    estimatedCost:  Math.round(estimatedKwh * params.pricingPerKwh * 100) / 100,
  };
}

// Why efficiency matters:
// A 90% efficient charger loses 10% as heat in cable + onboard charger.
// If car needs 47.25 kWh, wall delivers 52.5 kWh — driver is billed for wall figure.
// AC charger: 88–92% efficient. DC fast charger: 93–97% efficient.
```

`endTimeIso` = `startTime + estimatedHours`. Both update live in checkout as sliders move.

---

## 3. PAYMENT SYSTEM — COMPLETE FLOW

### 3.1 Authorize-then-reconcile model

```
Driver submits booking
  → stripe-create-payment: PaymentIntent with capture_method: 'manual' (auth hold only)
  → booking status: 'requested'

Host approves
  → booking status: 'approved'
  → Hold maintained, NOT captured yet

Session ends (driver signals 'departed' OR host marks complete)
  → stripe-reconcile-payment: Partial capture of ACTUAL kWh * price
  → If actual < estimated: Stripe captures less, difference auto-released
  → booking: actual_kwh, actual_amount, host_payout_amount updated
  → booking status: 'completed'

Host declines
  → stripe-cancel-payment: Hold released immediately
  → booking status: 'declined'
```

### 3.2 New edge function needed: stripe-reconcile-payment

```typescript
// supabase/functions/stripe-reconcile-payment/index.ts
Deno.serve(async (req) => {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { bookingId, actualKwh } = await req.json();
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, charger:chargers(pricing_per_kwh)')
    .eq('id', bookingId)
    .single();

  const actualSubtotal   = actualKwh * booking.charger.pricing_per_kwh;
  const platformFee      = actualSubtotal * 0.10;
  const actualTotal      = actualSubtotal + platformFee;
  const hostPayout       = actualSubtotal * 0.90;

  await stripe.paymentIntents.capture(booking.stripe_payment_intent_id, {
    amount_to_capture: Math.round(actualTotal * 100),
  });

  await supabase.from('bookings').update({
    actual_kwh:          actualKwh,
    actual_amount:       actualTotal,
    host_payout_amount:  hostPayout,
    status:              'completed',
    session_ended_at:    new Date().toISOString(),
  }).eq('id', bookingId);

  // Write to platform_events
  await supabase.from('platform_events').insert({
    event_type:   'payment.captured',
    actor_role:   'system',
    target_type:  'booking',
    target_id:    bookingId,
    amount_cents: Math.round(actualTotal * 100),
    kwh:          actualKwh,
    metadata: {
      booking_id: bookingId,
      driver_id:  booking.driver_id,
      host_id:    booking.host_id,
      actual_kwh: actualKwh,
      actual_amount: actualTotal,
      host_payout: hostPayout,
    }
  });

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
```

### 3.3 Fee structure (AppConfig must match DB config)

```
Driver pays:  actual_kwh × price_per_kwh = subtotal
              subtotal × 1.10 = total (10% platform fee added)

Host receives: subtotal × 0.90 (10% platform fee deducted from host side)

Example: 31.6 kWh @ $0.55/kWh
  subtotal      = $17.38
  driver pays   = $19.12  (subtotal + 10%)
  host receives = $15.64  (subtotal - 10%)
  platform gets = $3.48   (10% from each side)
```

---

## 4. VERIFICATION SYSTEM — DIGITAL-ONLY

### 4.1 Migration 00016 — verification gates table

```sql
CREATE TABLE verification_gates (
  user_id                UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_verified         BOOLEAN DEFAULT FALSE,
  phone_verified         BOOLEAN DEFAULT FALSE,
  payment_method_added   BOOLEAN DEFAULT FALSE,
  id_verified            BOOLEAN DEFAULT FALSE,
  id_document_url        TEXT,      -- Supabase private bucket URL
  stripe_onboarded       BOOLEAN DEFAULT FALSE,
  stripe_identity_session_id TEXT,  -- from Stripe Identity if used
  -- Computed clearance flags
  driver_cleared BOOLEAN GENERATED ALWAYS AS (
    email_verified AND phone_verified AND payment_method_added
  ) STORED,
  host_cleared BOOLEAN GENERATED ALWAYS AS (
    email_verified AND phone_verified AND id_verified AND stripe_onboarded
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Verification methods per gate

| Gate | Who | Method | Implementation |
|---|---|---|---|
| Email verified | All | Magic link on signup | Supabase auth: `auth.users.email_confirmed_at` |
| Phone verified | All | OTP | Twilio Verify API → store `phone_verified = true` |
| Payment on file | Drivers | Card check | Stripe Setup Intent → `payment_method_added = true` |
| ID verified | Hosts | Document check | Stripe Identity OR admin manual review of uploaded doc |
| Stripe onboarded | Hosts | Bank + tax info | Existing `stripe-connect-onboard` → check `charges_enabled = true` |
| Address geocode | Chargers | Auto-check | Nominatim: entered address vs GPS must be within 500m |
| Minimum photos | Chargers | Client gate | 2+ photos required before submit button activates |
| Price in bounds | Chargers | DB constraint | `CHECK (price_per_kwh >= 0.20 AND price_per_kwh <= 2.50)` |

### 4.3 Gate enforcement in code

```typescript
// Pattern used in booking.repository.ts, charger.repository.ts
async function getVerificationGate(userId: string) {
  const { data } = await supabase
    .from('verification_gates')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

// In createBookingRequest:
const gate = await getVerificationGate(driverUserId);
if (!gate?.driver_cleared) {
  throw new VerificationRequiredError({
    emailVerified:    gate?.email_verified ?? false,
    phoneVerified:    gate?.phone_verified ?? false,
    paymentAdded:     gate?.payment_method_added ?? false,
  });
}

// In upsertCharger (host):
const gate = await getVerificationGate(hostUserId);
if (!gate?.host_cleared) {
  throw new VerificationRequiredError({
    idVerified:       gate?.id_verified ?? false,
    stripeOnboarded:  gate?.stripe_onboarded ?? false,
  });
}
```

### 4.4 Phone OTP flow (Twilio Verify)

```typescript
// supabase/functions/send-phone-otp/index.ts
// POST { phone: '+61412345678', userId: 'uuid' }
// → Twilio sends 6-digit OTP, 10-minute expiry

// supabase/functions/verify-phone-otp/index.ts
// POST { phone: '+61412345678', code: '123456', userId: 'uuid' }
// → On success: UPDATE verification_gates SET phone_verified = true WHERE user_id = userId
```

---

## 5. CHARGER DETAIL PAGE — SCROLL ARCHITECTURE

### 5.1 Section order (each section answers a user question)

```
1. Hero image (full-width, headerTransparent bleeds under nav)
   → answers: "is this the right place?"

2. Stat row: rating / total sessions / avg session time
   → answers: "can I trust this charger?"

3. Availability timeline (today's slots — teal=free, red=booked, gray=past)
   → answers: "is it free when I need it?"
   → DATA: SELECT start_time, end_time FROM bookings
           WHERE charger_id = $1 AND status IN ('approved','active')
           AND start_time::date = CURRENT_DATE
   → Refetch interval: 30 seconds (React Query refetchInterval)

4. Charger specs (connector type, max kW, cable length, access type)
   → answers: "will it work with my car?"

5. Amenities (nearby cafe, WiFi, covered parking — from charger.amenities array)
   → answers: "what do I do while waiting?"

6. Host profile (avatar, name, host since, sessions, rating, bio snippet)
   → answers: "who am I dealing with?"

7. Reviews (latest 3, with star rating + comment)
   → answers: "have others had a good experience?"

8. Sticky bottom bar (price + Book CTA — always visible during scroll)
   → never scrolls away
```

### 5.2 Sticky CTA implementation

```typescript
// chargers/[chargerId].tsx
<View style={styles.container}>
  <ScrollView>
    {/* all sections */}
  </ScrollView>
  {/* Sticky — NOT inside ScrollView */}
  <View style={styles.stickyBar}>
    <View>
      <Text style={styles.priceBig}>${charger.pricingPerKwh}<Text style={styles.priceUnit}>/kWh</Text></Text>
      <Text style={styles.priceSub}>+10% platform fee</Text>
    </View>
    <PrimaryCTA
      label="Book this charger"
      onPress={() => router.push({ pathname: '/checkout', params: { chargerId: charger.id } })}
      disabled={!profile?.isDriver || !!activeBooking}
    />
  </View>
</View>

// styles
stickyBar: {
  position: 'absolute',
  bottom: 0, left: 0, right: 0,
  paddingHorizontal: Spacing.lg,
  paddingVertical: Spacing.md,
  paddingBottom: insets.bottom + Spacing.md,
  backgroundColor: Colors.surface,
  borderTopWidth: 0.5,
  borderTopColor: Colors.border,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
}
```

### 5.3 Charger along route — route recommender

```typescript
// src/utils/chargerRecommender.ts — improved scoring
export function rankChargersAlongRoute(
  route: { polyline: string; distanceKm: number },
  chargers: Charger[],
  vehicle: Vehicle,
  currentBatteryPercent: number,
): RouteChargerCandidate[] {
  const routePoints = decodePolyline(route.polyline);

  return chargers
    .map(charger => {
      const snapped      = nearestPointOnRoute(routePoints, charger);
      const detourKm     = haversineDistance(snapped, charger) * 2;
      const detourPct    = (detourKm / route.distanceKm) * 100;
      if (detourPct > 15) return null;  // hard cutoff: >15% detour = skip

      // Weighted score (0–100)
      const detourScore  = Math.max(0, 100 - detourPct * 5);       // weight 0.40
      const priceScore   = Math.max(0, 100 - charger.pricingPerKwh * 80); // weight 0.30
      const powerScore   = Math.min(100, charger.maxPowerKw * 1.5);       // weight 0.20
      const availScore   = charger.status === 'approved' ? 100 : 0;       // weight 0.10

      const score = detourScore*0.4 + priceScore*0.3 + powerScore*0.2 + availScore*0.1;
      return { charger, detourKm, detourPct, score };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score) as RouteChargerCandidate[];
}
```

---

## 6. BOOKING STATUS SCREEN — FULL REDESIGN

### 6.1 This screen must feel like Uber ride tracking

File: `app/(app)/bookings/[bookingId].tsx`

**DO NOT** keep this as a button. It is a full tracking page.

### 6.2 Screen sections by booking state

```typescript
// State: 'requested'
// - Header: amber · "Waiting for host"
// - Countdown: time until booking expires (24h from creation)
// - Timeline: Requested [active] → Awaiting approval → Session start → Complete
// - Charger card: name, address, specs, map pin
// - CTA: Cancel (full refund available)

// State: 'approved'
// - Header: teal · "Booking confirmed"
// - Countdown: time until session starts (live seconds timer)
// - Grace period note: "15 min grace period after start time"
// - Timeline: Requested [done] → Approved [done] → Session start [active] → Complete
// - Charger card + Get Directions button
// - Cost breakdown: estimated kWh, rate, subtotal, fee, auth hold total
// - Footer note: "Final charge based on actual kWh used"
// - CTAs: Get directions / Cancel

// State: 'active'
// - Header: amber · "Charging in progress" + live pulse dot
// - Live readout: "18.4 kWh delivered so far · ~$10.12"
// - Timeline: all done up to Charging [active]
// - Running cost card (updates via Supabase Realtime on arrival_signal changes)
// - CTAs: Report issue / End session early
// - "You'll only be charged for actual kWh used"

// State: 'completed'
// - Header: green · "All done!"
// - Final receipt: actual kWh, actual amount, savings vs estimate
// - "Your card was charged $X.XX for Y kWh"
// - Released amount shown: "$Z.ZZ released back vs original hold"
// - CTAs: Leave a review / Book again

// State: 'missed' | 'expired' | 'declined'
// - Header: red · clear explanation of what happened
// - What was charged (0 for missed/expired, 0 for declined)
// - Rebook button: opens discover with same charger pre-selected
```

### 6.3 Realtime subscription for live updates

```typescript
// src/hooks/useBookingRealtime.ts — already exists, extend it
useEffect(() => {
  const channel = supabase
    .channel(`booking:${bookingId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'bookings',
      filter: `id=eq.${bookingId}`,
    }, (payload) => {
      queryClient.setQueryData(['booking', bookingId], payload.new);
      // Trigger local notification if status changed to 'approved'
      if (payload.new.status === 'approved' && payload.old.status === 'requested') {
        scheduleLocalNotification('Your booking was approved!', 'Head to the charger — session starts soon.');
      }
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [bookingId]);
```

### 6.4 Countdown timer component

```typescript
// src/components/ui/CountdownTimer.tsx
export function CountdownTimer({ targetIso }: { targetIso: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, differenceInSeconds(new Date(targetIso), new Date())));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;

  return (
    <Text style={styles.timer}>
      {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </Text>
  );
}
```

---

## 7. ADMIN SYSTEM — PLATFORM-WIDE EVENT LOG

### 7.1 This is the most important screen in the app after booking

The admin panel is a search engine over every event that has ever occurred in VehicleGrid. When an admin types "manzil", they see every booking he made, every payment, every review, every status change — all in one unified feed.

### 7.2 Migration 00018 — platform_events table

```sql
CREATE TABLE platform_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL,
  -- Event type taxonomy:
  -- booking.requested, booking.approved, booking.declined, booking.cancelled,
  -- booking.missed, booking.expired, booking.completed
  -- payment.authorized, payment.captured, payment.refunded, payment.cancelled
  -- session.started, session.ended
  -- charger.submitted, charger.approved, charger.rejected
  -- user.signed_up, user.verified_phone, user.verified_id, user.stripe_onboarded
  -- user.suspended, user.restored
  -- image.uploaded, image.flagged
  -- review.submitted, review.deleted
  -- admin.action (for all admin-initiated events)

  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role    TEXT,  -- 'driver' | 'host' | 'admin' | 'system'

  target_type   TEXT,  -- 'booking' | 'charger' | 'user' | 'payment' | 'image' | 'review'
  target_id     UUID,

  -- Denormalised metric snapshot (for fast admin queries without joins)
  amount_cents  INTEGER,
  kwh           NUMERIC(8,3),
  duration_min  INTEGER,
  image_url     TEXT,

  -- Full context for detail view
  metadata      JSONB DEFAULT '{}',
  -- Required metadata keys by event_type — see Section 7.4

  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX pe_event_type_idx ON platform_events(event_type);
CREATE INDEX pe_actor_idx      ON platform_events(actor_user_id);
CREATE INDEX pe_target_idx     ON platform_events(target_type, target_id);
CREATE INDEX pe_created_at_idx ON platform_events(created_at DESC);
CREATE INDEX pe_amount_idx     ON platform_events(amount_cents) WHERE amount_cents IS NOT NULL;
CREATE INDEX pe_metadata_gin   ON platform_events USING GIN(metadata);

-- Full-text search index across names and event type
ALTER TABLE platform_events ADD COLUMN fts_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(metadata->>'driver_name','') || ' ' ||
      COALESCE(metadata->>'host_name','') || ' ' ||
      COALESCE(metadata->>'charger_name','') || ' ' ||
      COALESCE(event_type,'') || ' ' ||
      COALESCE(metadata->>'email','') || ' ' ||
      COALESCE(target_id::text,'')
    )
  ) STORED;

CREATE INDEX pe_fts ON platform_events USING GIN(fts_vector);
```

### 7.3 Trigger to auto-write booking events

```sql
CREATE OR REPLACE FUNCTION log_booking_event()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_name  TEXT;
  v_host_name    TEXT;
  v_charger_name TEXT;
  v_charger_addr TEXT;
BEGIN
  SELECT display_name INTO v_driver_name  FROM profiles WHERE id = NEW.driver_id;
  SELECT display_name INTO v_host_name    FROM profiles WHERE id = NEW.host_id;
  SELECT name, address INTO v_charger_name, v_charger_addr FROM chargers WHERE id = NEW.charger_id;

  INSERT INTO platform_events (
    event_type, actor_role, target_type, target_id,
    amount_cents, kwh, duration_min, metadata
  ) VALUES (
    'booking.' || NEW.status,
    CASE
      WHEN NEW.status IN ('requested','cancelled') THEN 'driver'
      WHEN NEW.status IN ('approved','declined')   THEN 'host'
      ELSE 'system'
    END,
    'booking',
    NEW.id,
    ROUND(COALESCE(NEW.actual_amount, NEW.total_amount, 0) * 100)::INTEGER,
    COALESCE(NEW.actual_kwh, NEW.estimated_kwh),
    EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::INTEGER / 60,
    jsonb_build_object(
      'booking_id',            NEW.id,
      'driver_id',             NEW.driver_id,
      'driver_name',           v_driver_name,
      'host_id',               NEW.host_id,
      'host_name',             v_host_name,
      'charger_id',            NEW.charger_id,
      'charger_name',          v_charger_name,
      'charger_address',       v_charger_addr,
      'status_from',           OLD.status,
      'status_to',             NEW.status,
      'start_time',            NEW.start_time,
      'end_time',              NEW.end_time,
      'estimated_kwh',         NEW.estimated_kwh,
      'actual_kwh',            NEW.actual_kwh,
      'stripe_payment_intent', NEW.stripe_payment_intent_id,
      'cancellation_reason',   NEW.cancellation_reason,
      'host_payout',           NEW.host_payout_amount
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_event_logger
AFTER UPDATE OF status ON bookings
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION log_booking_event();

-- Also create equivalent triggers for:
-- charger status changes → log_charger_event()
-- image uploads → log_image_event()  (called from imageService.ts after upload)
-- user verification changes → log_user_event()
```

### 7.4 Required metadata keys by event type

```typescript
// src/features/admin/event-metadata.types.ts

type BookingEventMeta = {
  booking_id: string;
  driver_id: string;         driver_name: string;
  host_id: string;           host_name: string;
  charger_id: string;        charger_name: string;   charger_address: string;
  start_time: string;        end_time: string;
  estimated_kwh: number;     actual_kwh?: number;
  status_from: string;       status_to: string;
  stripe_payment_intent?: string;
  cancellation_reason?: string;
  host_payout?: number;
};

type ChargerEventMeta = {
  charger_id: string;    charger_name: string;
  host_id: string;       host_name: string;
  address: string;       suburb: string;
  max_power_kw: number;  connector_types: string[];
  price_per_kwh: number; image_urls: string[];
  verification_score?: number;
  rubric?: { photos: number; specs: number; location: number; access: number; pricing: number };
  rejection_reason?: string;
  reviewed_by_admin_id?: string;
};

type UserEventMeta = {
  user_id: string;  display_name: string;  email: string;  role: string;
  verification_gate: {
    email_verified: boolean;  phone_verified: boolean;
    payment_added: boolean;   id_verified?: boolean;  stripe_onboarded?: boolean;
  };
  suspension_reason?: string;
};

type ImageEventMeta = {
  charger_id: string;  host_id: string;
  image_url: string;   image_size_bytes: number;  dimensions: string;
};
```

### 7.5 Admin repository

```typescript
// src/features/admin/admin.repository.ts

export interface AdminEventFilter {
  search?: string;
  eventTypes?: string[];
  targetType?: string;
  actorRole?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmountCents?: number;
  maxAmountCents?: number;
  page?: number;
  pageSize?: number;   // default 50
}

export async function searchPlatformEvents(filter: AdminEventFilter) {
  let query = supabase
    .from('platform_events')
    .select(`
      id, event_type, actor_role, target_type, target_id,
      amount_cents, kwh, duration_min, image_url, metadata, created_at,
      actor:profiles!actor_user_id(id, display_name, avatar_url, role)
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filter.search)         query = query.textSearch('fts_vector', filter.search, { type: 'websearch' });
  if (filter.eventTypes?.length) query = query.in('event_type', filter.eventTypes);
  if (filter.targetType)     query = query.eq('target_type', filter.targetType);
  if (filter.actorRole)      query = query.eq('actor_role', filter.actorRole);
  if (filter.dateFrom)       query = query.gte('created_at', filter.dateFrom);
  if (filter.dateTo)         query = query.lte('created_at', filter.dateTo);
  if (filter.minAmountCents) query = query.gte('amount_cents', filter.minAmountCents);
  if (filter.maxAmountCents) query = query.lte('amount_cents', filter.maxAmountCents);

  const from = (filter.page ?? 0) * (filter.pageSize ?? 50);
  query = query.range(from, from + (filter.pageSize ?? 50) - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { events: data, total: count ?? 0 };
}

// Full entity history — called when admin taps a user anywhere in the log
export async function getUserFullHistory(userId: string) {
  const [profile, asDriver, asHost, chargers, reviews, events] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('bookings').select('*, charger:chargers(name,address)').eq('driver_id', userId).order('created_at', { ascending: false }),
    supabase.from('bookings').select('*, driver:profiles!driver_id(display_name)').eq('host_id', userId).order('created_at', { ascending: false }),
    supabase.from('chargers').select('*, images, status, verification_score').eq('host_id', userId),
    supabase.from('reviews').select('*, charger:chargers(name)').eq('driver_user_id', userId),
    supabase.from('platform_events').select('*').eq('actor_user_id', userId).order('created_at', { ascending: false }).limit(100),
  ]);

  const completedBookings = asDriver.data?.filter(b => b.status === 'completed') ?? [];
  const totalSpent = completedBookings.reduce((s, b) => s + (b.actual_amount ?? b.total_amount ?? 0), 0);
  const totalKwh   = completedBookings.reduce((s, b) => s + (b.actual_kwh ?? b.estimated_kwh ?? 0), 0);

  return {
    profile:        profile.data,
    bookingsDriver: asDriver.data ?? [],
    bookingsHost:   asHost.data ?? [],
    chargers:       chargers.data ?? [],
    reviews:        reviews.data ?? [],
    recentEvents:   events.data ?? [],
    lifetime: { totalSpent, totalKwh, sessionCount: completedBookings.length },
  };
}
```

### 7.6 Admin tab structure — what each screen actually does

**`admin-overview.tsx`** — unified event log (primary admin screen)
- Renders all `platform_events` via `searchPlatformEvents()`
- Full-text search bar across names, charger, event type, email, booking ID
- Filter chips: All · Needs action · Payments · Cancellations · New chargers · Completed sessions
- Dropdowns: event type / actor role / date range
- Each row expands to show full `metadata` JSON rendered as key-value pairs + action buttons
- Stat row at top: revenue today / active sessions / pending approvals / new users (7d)
- Uses `getPlatformStats(since)` RPC for stat row

**`admin-verify.tsx`** — charger approval queue
- Filters: `WHERE event_type = 'charger.submitted'` AND charger status = 'pending'
- Shows charger photos inline using `getDetailImageUrl()`
- Rubric scoring form embedded (5 dimensions, 0–20 each, total /100)
- Approve / Reject buttons write to `chargers` table AND `platform_events`
- Score ≥ 85 → approved. Score < 45 → rejected. 45–85 → admin notes required

**`admin-trust.tsx`** — user trust & disputes
- Three sections:
  1. Repeat cancellers: `SELECT driver_id, COUNT(*) FROM bookings WHERE status='cancelled' GROUP BY driver_id HAVING COUNT(*) > 2`
  2. Slow hosts: `average_response_minutes > 120`
  3. Disputed sessions: `WHERE cancellation_reason IS NOT NULL AND status = 'cancelled'`
- Actions: Suspend user / View full history / Send warning

**`admin-settings.tsx`** — platform config (reads/writes `platform_config` table, NOT AppConfig)
- Editable fields: platform_fee_percent, host_fee_percent, booking_expiry_hours, grace_period_minutes, free_cancel_hours, charger_approved_score, charger_rejected_score

### 7.7 Migration 00019 — platform_config table

```sql
CREATE TABLE platform_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES profiles(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_config VALUES
  ('platform_fee_percent',    '10',  'Fee added to driver total',           NULL, NOW()),
  ('host_fee_percent',        '10',  'Fee deducted from host payout',       NULL, NOW()),
  ('booking_expiry_hours',    '24',  'Hours before unreplied booking expires', NULL, NOW()),
  ('grace_period_minutes',    '15',  'Minutes after start before no-show',  NULL, NOW()),
  ('free_cancel_hours',       '2',   'Hours before start for full refund',  NULL, NOW()),
  ('charger_approved_score',  '85',  'Minimum rubric score for approval',   NULL, NOW()),
  ('charger_rejected_score',  '45',  'Max score before auto-rejection',     NULL, NOW());

-- RLS: only admins can update
CREATE POLICY "Admins only" ON platform_config
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
```

---

## 8. MISSING FEATURES — MUST BUILD

### 8.1 Push notification stack (currently missing entirely)

```typescript
// Add to auth-context.tsx on successful login:
const token = await Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig?.extra?.eas?.projectId });
await supabase.from('profiles').update({ expo_push_token: token.data }).eq('id', user.id);

// Add column: ALTER TABLE profiles ADD COLUMN expo_push_token TEXT;

// Edge function helper (call from booking event triggers):
async function sendPushNotification(userId: string, title: string, body: string, data?: object) {
  const { data: profile } = await supabase.from('profiles').select('expo_push_token').eq('id', userId).single();
  if (!profile?.expo_push_token) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: profile.expo_push_token, title, body, data }),
  });
}

// When to send:
// booking.approved    → notify driver
// booking.declined    → notify driver
// booking.requested   → notify host
// session.ended       → notify host (with payout amount)
// charger.approved    → notify host
// payment.captured    → notify driver (with final amount)
```

### 8.2 Discover screen — list mode (currently map-only)

```typescript
// discover.tsx — add toggle between map and list
const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

// List mode: FlatList of ChargerCardPremium components
// Sorted by distance using useUserLocation hook
// FilterChipRow: connector type (CCS2 / Type2 / CHAdeMO) + power (any / 22kW+ / 50kW+)
// Drives adoption in new areas where map has no context
```

### 8.3 Host response time tracking

```typescript
// When host approves/declines booking, calculate response time:
// response_minutes = EXTRACT(EPOCH FROM (NOW() - booking.created_at)) / 60

// Store rolling average:
// ALTER TABLE profiles ADD COLUMN avg_response_minutes INTEGER;

// After each host action:
UPDATE profiles
SET avg_response_minutes = (
  SELECT AVG(EXTRACT(EPOCH FROM (b.updated_at - b.created_at))/60)::INTEGER
  FROM bookings b
  WHERE b.host_id = $hostId AND b.status IN ('approved','declined')
  AND b.updated_at > NOW() - INTERVAL '30 days'
)
WHERE id = $hostId;

// Display on charger detail: "Usually responds within 2 hours"
```

### 8.4 Empty state screens (currently blank)

Every empty state must prompt the next action:

```typescript
// bookings.tsx — no bookings yet
<EmptyStateCard
  title="No bookings yet"
  subtitle="Find a charger near you to get started"
  action={{ label: "Discover chargers", onPress: () => router.push('/(tabs)/discover') }}
/>

// host-bookings.tsx — no pending requests
<EmptyStateCard
  title="No pending requests"
  subtitle="Your charger will appear here when drivers request bookings"
  action={{ label: "View my chargers", onPress: () => router.push('/(tabs)/host-chargers') }}
/>
```

### 8.5 Cancellation reason capture (currently missing)

```typescript
// When driver cancels a booking, show a reason selector before confirming:
const CANCEL_REASONS = [
  'Changed plans',
  'Found a closer charger',
  'Vehicle issue',
  'Host not responding',
  'Other',
];

// Write to: bookings.cancellation_reason
// This populates admin-trust.tsx dispute section
```

---

## 9. DATABASE SCHEMA — FULL COLUMN LIST

### profiles
```
id (uuid PK) · email · display_name · role · is_driver · is_host · is_admin
phone · avatar_url · preferred_reserve_percent · stripe_account_id
expo_push_token (ADD) · avg_response_minutes (ADD)
deleted_at · created_at · updated_at
```

### bookings
```
id · charger_id (FK SET NULL) · driver_id (FK SET NULL) · host_id (FK SET NULL)
start_time · end_time · estimated_kwh · actual_kwh (ADD)
subtotal_amount · total_amount · platform_fee
actual_amount (ADD) · host_payout_amount (ADD)
status · arrival_signal · expires_at · grace_expires_at (ADD)
session_started_at (ADD) · session_ended_at (ADD)
stripe_payment_intent_id · payment_status · cancellation_reason (ADD)
cancelled_at · created_at · updated_at
```

### chargers
```
id · host_id (FK) · name · address · suburb · state · lat · lng
max_power_kw · price_per_kwh · connectors (jsonb) · amenities (text[])
images (text[]) · status · verification_score
rubric_photos · rubric_specs · rubric_location · rubric_access · rubric_pricing
availability_note · availability_window (jsonb)
deleted_at · location_point (geometry) · created_at · updated_at
```

### New tables (add in order)
```
verification_gates    — Migration 00016
platform_events       — Migration 00018
platform_config       — Migration 00019
```

---

## 10. CODING RULES — NON-NEGOTIABLE

```
1. Import ALL components from @/src/components barrel — never raw RN primitives in screens
2. NO inline styles — StyleSheet.create() with theme tokens only
3. Screens delegate ALL logic to hooks in src/hooks/
4. Repository pattern: types in *.types.ts, DB access in *.repository.ts only
5. DB columns: snake_case. TypeScript: camelCase. Never mix.
6. Images: getThumbnailUrl() in lists, getDetailImageUrl() in detail views
7. Role checks: profile.isAdmin / profile.isHost / profile.isDriver (boolean flags)
8. Every repository function that writes data also writes to platform_events
9. Every empty state has an action that leads somewhere useful
10. Every booking status change must trigger a push notification to affected party
11. Admin actions must be idempotent — double-tapping approve does nothing harmful
12. All amounts stored in database as NUMERIC (dollars), never integers. Stripe calls use cents.
13. All timestamps stored as TIMESTAMPTZ in UTC. Display in local time using date-fns-tz.
14. React Query keys: ['entity', id] for single items, ['entities', filter] for lists
15. useRefresh hook for pull-to-refresh on every list screen
```

---

## 11. COMPONENT HIERARCHY REFERENCE

```
src/components/
├── cards/
│   ├── ChargerCardPremium    — discover list + route recommender
│   ├── BookingCard           — bookings list (driver + host)
│   ├── ActiveBookingHero     — dashboard when session is active
│   ├── EarningsCard          — host home weekly earnings
│   └── StatCard              — admin overview metrics
├── forms/
│   ├── InputField            — all text inputs
│   └── DateTimeInput         — booking time selection
├── layout/
│   ├── ScreenContainer       — SafeArea + scroll + keyboard
│   ├── SectionTitle          — section headers
│   └── StickyActionBar       — bottom CTAs on detail pages
├── ui/
│   ├── PrimaryCTA            — main action button (teal fill)
│   ├── SecondaryButton       — outlined secondary action
│   ├── FilterChip / FilterChipRow — discover filters
│   ├── ChargerStatusBadge    — pending/approved/rejected pill
│   ├── BookingTimeline       — the Uber-style status tracker
│   ├── CountdownTimer        — live HH:MM:SS (ADD THIS)
│   ├── AvailabilityBar       — today's slot visualiser (ADD THIS)
│   ├── EmptyStateCard        — empty screen prompt
│   └── LoadingSkeleton       — skeleton loaders for all card types
```

---

## 12. ENVIRONMENT & RUNNING

```bash
# Dev
npm start          # Expo Go via QR

# Required env vars (.env.local)
EXPO_PUBLIC_SUPABASE_URL=https://oadagevadtstbjyhnopm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Apply all migrations (run in Supabase SQL Editor)
supabase/migrations/APPLY_ALL_NEW_MIGRATIONS.sql

# New migrations to apply first:
# 00015 — booking session fields + grace trigger
# 00016 — verification_gates table
# 00017 — admin_audit_log (from previous session)
# 00018 — platform_events table + booking trigger
# 00019 — platform_config table

# Edge functions to deploy:
supabase functions deploy stripe-reconcile-payment
supabase functions deploy send-phone-otp
supabase functions deploy verify-phone-otp
```

---

## 13. PRIORITY EXECUTION ORDER FOR CLAUDE CODE

Execute in this exact order. Each step unblocks the next.

```
Step 1  Apply migrations 00015–00019 (schema foundation)
Step 2  Add platform_events booking trigger (all status changes now logged)
Step 3  Build stripe-reconcile-payment edge function (actual kWh billing)
Step 4  Build verification_gates repository + gate checks in booking + charger repos
Step 5  Redesign app/(app)/_layout.tsx — remove modal presentations
Step 6  Build bookings/[bookingId].tsx — full status tracking page with timeline + countdown
Step 7  Redesign chargers/[chargerId].tsx — full scroll page with all 7 sections + sticky CTA
Step 8  Build admin-overview.tsx — platform_events search with filters + expand rows
Step 9  Build admin-verify.tsx — charger approval with rubric form + inline photos
Step 10 Add expo_push_token to profiles + push notification helper
Step 11 Add list mode to discover.tsx
Step 12 Add CountdownTimer + AvailabilityBar components
Step 13 Fill all empty states with action prompts
Step 14 Add cancellation reason capture flow
Step 15 Add host avg_response_minutes tracking
```

---

*Generated from full architecture discussion. Last updated: 2026-03.*
*Claude Code: execute steps sequentially. Do not skip steps — each one has downstream dependencies.*