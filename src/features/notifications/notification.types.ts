export type NotificationType = "booking" | "verification" | "trip" | "system";

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  isRead: boolean;
  metadata?: Record<string, string>;
  createdAtIso: string;
}

export interface CreateNotificationInput {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  metadata?: Record<string, string>;
}
