import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../database.json');

// Database structure
interface Database {
  admins: Admin[];
  content: Content[];
  offline_queue: QueueItem[];
  settings: Setting[];
  teachers: Teacher[];
  students: Student[];
  activity_logs: ActivityLog[];
  notifications: NotificationItem[];
  devices: Device[];
  login_history: LoginHistory[];
  section_content: SectionContent[];
  staff: Staff[];
}

interface SectionContent {
  id: number;
  page: string;
  section: string;
  key: string;
  value: string;
  updated_at: string;
}

interface Staff {
  id: number;
  name: string;
  position: string;
  description: string;
  image_url: string | null;
  image_path: string | null;
  image_folder?: string | null;
  image_name?: string | null;
  order_num: number;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
}

interface Admin {
  id: number;
  username: string;
  password_hash: string;
  secret_key: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

interface Device {
  id: number;
  admin_id: number;
  fingerprint: string;
  device_name: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  last_active: string;
  is_active: boolean;
}

interface Content {
  id: number;
  title: string;
  title_uzb?: string;
  title_ru?: string;
  title_en?: string;
  description: string | null;
  description_uzb?: string;
  description_ru?: string;
  description_en?: string;
  content_text: string | null;
  content_text_uzb?: string;
  content_text_ru?: string;
  content_text_en?: string;
  image_url: string | null;
  image_path: string | null;
  image_folder?: string | null;
  image_name?: string | null;
  media_type?: 'image' | 'video';
  video_url?: string | null;
  slug?: string;
  views?: number;
  album?: string | null;
  category: string;
  is_published: boolean;
  publish_date: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

interface Teacher {
  id: number;
  name: string;
  name_uzb?: string;
  name_ru?: string;
  name_en?: string;
  subject: string;
  subject_uzb?: string;
  subject_ru?: string;
  subject_en?: string;
  bio: string | null;
  bio_uzb?: string;
  bio_ru?: string;
  bio_en?: string;
  image_url: string | null;
  image_path: string | null;
  image_folder?: string | null;
  image_name?: string | null;
  experience_years: number;
  phone?: string | null;
  social_links?: Record<string, string>;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

interface Student {
  id: number;
  name: string;
  grade: string;
  class_name: string;
  group?: string | null;
  date_of_birth: string;
  parent_name: string;
  parent_phone: string;
  image_url?: string | null;
  image_folder?: string | null;
  image_name?: string | null;
  achievements?: string[];
  certificates?: string[];
  attendance?: AttendanceRecord[];
  is_active?: boolean;
  created_at?: string;
  updated_at: string;
}

interface AttendanceRecord {
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  note?: string;
}

interface ActivityLog {
  id: number;
  admin_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  message: string;
  created_at: string;
}

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  read: boolean;
  created_at: string;
}

interface QueueItem {
  id: number;
  action: string;
  payload: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

interface Setting {
  id: number;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

interface LoginHistory {
  id: number;
  admin_id: number;
  username: string;
  ip_address: string;
  user_agent: string;
  device_name: string;
  success: boolean;
  login_time: string;
  logout_time: string | null;
}

let db: Database = {
  admins: [],
  content: [],
  offline_queue: [],
  settings: [],
  teachers: [],
  students: [],
  activity_logs: [],
  notifications: [],
  devices: [],
  login_history: [],
  section_content: [],
  staff: []
};

let nextIds = {
  admins: 1,
  content: 1,
  offline_queue: 1,
  settings: 1,
  teachers: 1,
  students: 1,
  activity_logs: 1,
  notifications: 1,
  devices: 1,
  login_history: 1,
  section_content: 1,
  staff: 1
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      db = { ...db, ...parsed.db };
      nextIds = { ...nextIds, ...parsed.nextIds };
      normalizeDatabase();
    } else {
      initializeDatabase();
    }
  } catch (error) {
    console.error('Error loading database, creating new:', error);
    initializeDatabase();
  }
}

function normalizeDatabase() {
  db.admins ||= [];
  db.content ||= [];
  db.offline_queue ||= [];
  db.settings ||= [];
  db.teachers ||= [];
  db.students ||= [];
  db.activity_logs ||= [];
  db.notifications ||= [];
  db.devices ||= [];
  db.login_history ||= [];
  db.section_content ||= [];
  db.staff ||= [];

  const tables = Object.keys(nextIds) as Array<keyof typeof nextIds>;
  tables.forEach((table) => {
    const rows = (db as any)[table] || [];
    const maxId = Array.isArray(rows) ? rows.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) : 0;
    nextIds[table] = Math.max(nextIds[table] || 1, maxId + 1);
  });
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify({ db, nextIds }, null, 2));
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

function initializeDatabase() {
  db = {
    admins: [],
    content: [],
    offline_queue: [],
    settings: [
      { id: 1, key: 'site_name', value: 'State School Website', description: 'Website name', updated_at: new Date().toISOString() },
      { id: 2, key: 'site_description', value: 'Official State School Website', description: 'Website description', updated_at: new Date().toISOString() },
      { id: 3, key: 'maintenance_mode', value: 'false', description: 'Enable/disable maintenance mode', updated_at: new Date().toISOString() },
      { id: 4, key: 'allow_registration', value: 'false', description: 'Allow new admin registration', updated_at: new Date().toISOString() }
    ],
    teachers: [],
    students: [],
    activity_logs: [],
    notifications: [],
    devices: [],
    login_history: [],
    section_content: [],
    staff: []
  };
  nextIds = {
    admins: 1,
    content: 1,
    offline_queue: 1,
    settings: 5,
    teachers: 1,
    students: 1,
    activity_logs: 1,
    notifications: 1,
    devices: 1,
    login_history: 1,
    section_content: 1,
    staff: 1
  };
  saveDatabase();
}

// Query helpers
function getNextId(table: keyof typeof nextIds): number {
  return nextIds[table]++;
}

function findByQuery(table: keyof Database, query: Record<string, any>): any[] {
  const items = db[table];
  if (!query || Object.keys(query).length === 0) {
    return items;
  }
  
  return items.filter(item => {
    return Object.entries(query).every(([key, value]) => {
      if (value === undefined || value === null || value === '') return true;
      return (item as any)[key] === value;
    });
  });
}

// Export database functions
export {
  db,
  loadDatabase,
  saveDatabase,
  getNextId,
  findByQuery,
  DB_PATH
};

export type { Admin, Content, QueueItem, Setting, Staff };
