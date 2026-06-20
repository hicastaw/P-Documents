import type { Server } from "socket.io";
import * as notificationModel from "../models/notification.model";
import { emitNotification } from "../sockets/notification.socket";

export async function listNotifications(userId: string) {
  const notifications = await notificationModel.listNotificationsByUser(userId);
  const unreadCount = notifications.filter((r: any) => !r.read).length;
  return { notifications, unreadCount };
}

export async function markRead(id: string, userId: string) {
  await notificationModel.markNotificationRead(id, userId);
}

export async function markAllRead(userId: string) {
  await notificationModel.markAllNotificationsRead(userId);
}

/**
 * Shared helper: persist a notification and, if an io instance is given,
 * push it to the recipient in real time over the `notify:<userId>` channel.
 */
export async function createNotification(opts: {
  userId: string;
  type: string;
  title: string;
  body: string;
  refId: string;
  io?: Server;
}) {
  const { userId, type, title, body, refId, io } = opts;
  await notificationModel.insertNotification({ userId, type, title, body, refId });
  emitNotification(io, userId, { type, title, refId });
}
