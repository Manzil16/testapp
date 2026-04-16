Audit role switching, permissions, and dual-role scenarios across the entire app:

1. **Role Context Propagation**
   - Check if `auth-context.tsx` exposes user role (driver/host/admin)
   - Find all screens that show/hide features based on role but don't check role properly
   - Identify tabs in `app/(app)/(tabs)/_layout.tsx` that should be role-gated but aren't
   - List components rendering host features (host-bookings.tsx, host-chargers.tsx) accessible to drivers

2. **Dual Role Flag Implementation**
   - Migration `00010_dual_role_flags.sql` added is_driver/is_host flags
   - Find code still checking single role field instead of flags
   - Verify user can be both host AND driver simultaneously in all UI flows
   - Check if role switching causes auth-context to stale or crash

3. **Cross-Feature Verification Gates**
   - Does `verification-gates.repository.ts` block unverified users from bookings/hosting?
   - Find places where verification status should be checked but isn't
   - Check if `app/verification-required.tsx` is shown before protected actions
   - List Edge functions that don't verify user permissions server-side

**Output**: Matrix showing [Screen/Feature] × [Required Role] × [Current Check] × [Missing Check]