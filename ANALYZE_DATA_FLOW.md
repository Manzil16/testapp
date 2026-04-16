Analyze the complete data flow chain from authentication through repositories to UI:

1. **Auth Integration Audit**
   - Check `features/auth/auth-context.tsx` provides correct user state to all consumers
   - Verify all repository files (*.repository.ts) receive valid auth tokens/user IDs
   - Find any screens in `app/(app)/(tabs)/` or `app/(auth)/` that access user data without checking auth state
   - Identify race conditions where UI renders before auth.service.ts completes

2. **Repository Cross-Dependencies**
   - Map which repositories call other repositories (e.g., booking.repository → charger.repository)
   - Find circular dependencies between features
   - Check if any repository assumes data exists without validating (e.g., user.repository data used in booking.repository)

3. **Critical Null/Undefined Issues**
   - Search ALL .tsx files for direct property access (user.id, charger.location) without optional chaining
   - Find hooks that return undefined during loading but UI doesn't handle it
   - Identify Supabase queries with missing null checks on foreign key relationships

**Output**: List each broken chain showing: File → Assumption → What breaks → Fix needed