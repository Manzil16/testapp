import { supabase } from "../../lib/supabase";

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
  pageSize?: number;
}

export interface PlatformEvent {
  id: string;
  eventType: string;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  amountCents: number | null;
  kwh: number | null;
  durationMin: number | null;
  imageUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
  } | null;
}

function mapEvent(row: Record<string, unknown>): PlatformEvent {
  const actor = row.actor as Record<string, unknown> | null;
  return {
    id: row.id as string,
    eventType: row.event_type as string,
    actorRole: (row.actor_role as string) || null,
    targetType: (row.target_type as string) || null,
    targetId: row.target_id ? String(row.target_id) : null,
    amountCents: row.amount_cents as number | null,
    kwh: row.kwh != null ? Number(row.kwh) : null,
    durationMin: row.duration_min as number | null,
    imageUrl: (row.image_url as string) || null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: row.created_at as string,
    actor: actor
      ? {
          id: actor.id as string,
          displayName: actor.display_name as string,
          avatarUrl: (actor.avatar_url as string) || null,
          role: actor.role as string,
        }
      : null,
  };
}

export async function searchPlatformEvents(filter: AdminEventFilter) {
  let query = supabase
    .from("platform_events")
    .select(
      `
      id, event_type, actor_role, target_type, target_id,
      amount_cents, kwh, duration_min, image_url, metadata, created_at,
      actor:profiles!actor_user_id(id, display_name, avatar_url, role)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (filter.search) query = query.textSearch("fts_vector", filter.search, { type: "websearch" });
  if (filter.eventTypes?.length) query = query.in("event_type", filter.eventTypes);
  if (filter.targetType) query = query.eq("target_type", filter.targetType);
  if (filter.actorRole) query = query.eq("actor_role", filter.actorRole);
  if (filter.dateFrom) query = query.gte("created_at", filter.dateFrom);
  if (filter.dateTo) query = query.lte("created_at", filter.dateTo);
  if (filter.minAmountCents) query = query.gte("amount_cents", filter.minAmountCents);
  if (filter.maxAmountCents) query = query.lte("amount_cents", filter.maxAmountCents);

  const from = (filter.page ?? 0) * (filter.pageSize ?? 50);
  query = query.range(from, from + (filter.pageSize ?? 50) - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    events: (data as Record<string, unknown>[]).map(mapEvent),
    total: count ?? 0,
  };
}

export interface PlatformStats {
  revenueToday: number;
  activeSessions: number;
  pendingApprovals: number;
  newUsersThisWeek: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [revenueResult, activeResult, pendingResult, usersResult] =
    await Promise.all([
      // Revenue today from payment.captured events
      supabase
        .from("platform_events")
        .select("amount_cents")
        .eq("event_type", "payment.captured")
        .gte("created_at", todayStart.toISOString()),

      // Active sessions
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),

      // Pending charger approvals
      supabase
        .from("chargers")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      // New users this week
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo.toISOString()),
    ]);

  const revenueToday = (revenueResult.data ?? []).reduce(
    (sum, e) => sum + (Number(e.amount_cents) || 0),
    0
  );

  return {
    revenueToday: Math.round(revenueToday) / 100,
    activeSessions: activeResult.count ?? 0,
    pendingApprovals: pendingResult.count ?? 0,
    newUsersThisWeek: usersResult.count ?? 0,
  };
}
