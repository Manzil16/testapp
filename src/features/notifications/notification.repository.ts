import { supabase } from "../../lib/supabase";
import type { AppNotification, CreateNotificationInput } from "./notification.types";

function mapRow(row: Record<string, unknown>): AppNotification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    body: row.body as string,
    type: row.type as AppNotification["type"],
    isRead: row.is_read as boolean,
    metadata: (row.metadata as Record<string, string>) || undefined,
    createdAtIso: row.created_at as string,
  };
}

export async function createNotification(input: CreateNotificationInput): Promise<string> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      is_read: false,
      metadata: (input.metadata as Record<string, string>) ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function listNotificationsByUser(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
  if (error) throw error;
}
