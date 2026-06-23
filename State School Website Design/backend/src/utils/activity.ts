import { db, getNextId, saveDatabase } from '../config/database.js';

export function logActivity(adminId: number | null, action: string, entity: string, entityId: number | null, message: string) {
  if (!db.activity_logs) db.activity_logs = [];
  db.activity_logs.unshift({
    id: getNextId('activity_logs'),
    admin_id: adminId,
    action,
    entity,
    entity_id: entityId,
    message,
    created_at: new Date().toISOString()
  });
  db.activity_logs = db.activity_logs.slice(0, 250);
}

export function pushNotification(title: string, message: string, type: 'info' | 'success' | 'warning' | 'danger' = 'info') {
  if (!db.notifications) db.notifications = [];
  db.notifications.unshift({
    id: getNextId('notifications'),
    title,
    message,
    type,
    read: false,
    created_at: new Date().toISOString()
  });
  db.notifications = db.notifications.slice(0, 100);
}

export function recordAdminAction(adminId: number | null, action: string, entity: string, entityId: number | null, message: string) {
  logActivity(adminId, action, entity, entityId, message);
  pushNotification('Admin activity', message, 'success');
  saveDatabase();
}
