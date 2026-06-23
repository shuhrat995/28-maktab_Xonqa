import { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  Bell,
  BookOpen,
  Contact,
  FileText,
  GalleryHorizontalEnd,
  GraduationCap,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Save,
  Search,
  Shield,
  Sun,
  Trash2,
  Upload,
  Users
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/app/config';

const API_URL = API_BASE_URL;

type AdminTab = 'dashboard' | 'home' | 'about' | 'staff' | 'teachers' | 'students' | 'news' | 'gallery' | 'contact' | 'footer' | 'logs' | 'security';

type ContentItem = {
  id: number;
  title: string;
  description?: string;
  content_text?: string;
  category: string;
  image_url?: string;
  video_url?: string;
  media_type?: 'image' | 'video';
  slug?: string;
  views?: number;
  album?: string;
  is_published: boolean;
  publish_date?: string;
};

type Teacher = {
  id: number;
  name: string;
  subject: string;
  bio?: string;
  image_url?: string;
  experience_years: number;
  phone?: string;
  social_links?: Record<string, string>;
  is_active: boolean;
};

type Student = {
  id: number;
  name: string;
  grade: string;
  class_name: string;
  group?: string;
  parent_name?: string;
  parent_phone?: string;
  achievements?: string[];
  certificates?: string[];
  attendance?: Array<{ date: string; status: string; note?: string }>;
  image_url?: string;
};

type StaffMember = {
  id: number;
  name: string;
  position: string;
  description?: string;
  image_url?: string;
  order_num: number;
  is_active?: boolean;
};

const emptyContent = {
  title: '',
  description: '',
  content_text: '',
  category: 'news',
  slug: '',
  publish_date: '',
  album: '',
  video_url: '',
  media_type: 'image',
  is_published: true
};

const pageSchemas = {
  home: {
    hero: ['title', 'subtitle', 'banner_image', 'primary_button', 'secondary_button', 'intro_video'],
    stats: ['students_num', 'students_label', 'teachers_num', 'teachers_label', 'grades_num', 'grades_label', 'years_num', 'years_label'],
    achievements: ['card1_value', 'card1_label', 'card2_value', 'card2_label', 'card3_value', 'card3_label', 'card4_value', 'card4_label'],
    announcements: ['main'],
    cta: ['title', 'desc']
  },
  about: {
    hero: ['title', 'subtitle'],
    history: ['title', 'desc1', 'desc2', 'desc3', 'image_url'],
    mission: ['title', 'desc'],
    vision: ['title', 'desc'],
    certificates: ['items'],
    media: ['video_url']
  },
  contact: {
    hero: ['title', 'subtitle'],
    info: ['phone', 'email', 'telegram', 'address', 'map', 'hours']
  },
  footer: {
    info: ['desc', 'address', 'phone', 'email', 'hours', 'facebook', 'instagram', 'youtube', 'telegram']
  },
  students: {
    hero: ['title', 'subtitle'],
    classes: ['items_json'],
    activities: ['group_image', 'sports_image', 'events_image'],
    achievements: ['card1_value', 'card1_label', 'card2_value', 'card2_label', 'card3_value', 'card3_label', 'card4_value', 'card4_label']
  }
} as const;

export function Admin() {
  const [token, setToken] = useState('');
  const [deviceId, setDeviceId] = useState(() => sessionStorage.getItem('adminDeviceId') || '');
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<Record<string, number>>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [pageContent, setPageContent] = useState<Record<string, any>>({});
  const [teacherForm, setTeacherForm] = useState<any>({ name: '', subject: '', experience_years: 0, phone: '', bio: '', social_links: '', is_active: true });
  const [studentForm, setStudentForm] = useState<any>({ name: '', grade: '', class_name: '', group: '', parent_name: '', parent_phone: '', achievements: '', certificates: '' });
  const [staffForm, setStaffForm] = useState<any>({ name: '', position: '', description: '', order_num: 1, is_active: true });
  const [contentForm, setContentForm] = useState<any>(emptyContent);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [secretKey, setSecretKey] = useState('');
  const [editing, setEditing] = useState<{ type: string; id: number } | null>(null);

  const isAuthenticated = Boolean(token);
  const visibleContent = useMemo(() => {
    const term = search.toLowerCase();
    return content.filter(item => {
      const typeMatch = activeTab === 'news' ? item.category === 'news' : activeTab === 'gallery' ? item.category === 'gallery' : true;
      return typeMatch && `${item.title} ${item.description || ''} ${item.category}`.toLowerCase().includes(term);
    });
  }, [activeTab, content, search]);

  const visibleTeachers = teachers.filter(item => `${item.name} ${item.subject}`.toLowerCase().includes(search.toLowerCase()));
  const visibleStudents = students.filter(item => `${item.name} ${item.grade} ${item.class_name} ${item.group || ''}`.toLowerCase().includes(search.toLowerCase()));
  const visibleStaff = staff.filter(item => `${item.name} ${item.position} ${item.description || ''}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (token) loadAll();
  }, [token]);

  async function checkSession() {
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        credentials: 'include',
        headers: deviceId ? { 'X-Device-Id': deviceId } : {}
      });
      if (!res.ok) throw new Error('No active session');
      setToken('cookie-session');
    } catch {
      clearSession();
    }
  }

  function clearSession() {
    sessionStorage.removeItem('adminDeviceId');
    setToken('');
    setDeviceId('');
  }

  async function api(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(deviceId ? { 'X-Device-Id': deviceId } : {}),
        ...(options.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) {
      clearSession();
      throw new Error('Session expired or invalid. Please login again.');
    }
    if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText} (${path})`);
    return data;
  }

  async function loadAll() {
    try {
      const [statsRes, teachersRes, studentsRes, staffRes, contentRes, sectionsRes, logsRes, notificationsRes] = await Promise.allSettled([
        api('/admin/stats'),
        api('/teachers?limit=200'),
        api('/students?limit=200'),
        api('/staff'),
        api('/content?limit=300'),
        api('/sections'),
        api('/admin/activity'),
        api('/admin/notifications')
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.stats || {});
      if (teachersRes.status === 'fulfilled') setTeachers(teachersRes.value.teachers || []);
      if (studentsRes.status === 'fulfilled') setStudents(studentsRes.value.students || []);
      if (staffRes.status === 'fulfilled') setStaff(staffRes.value.staff || []);
      if (contentRes.status === 'fulfilled') setContent(contentRes.value.content || []);
      if (sectionsRes.status === 'fulfilled') setPageContent(sectionsRes.value.content || {});
      if (logsRes.status === 'fulfilled') setLogs(logsRes.value.logs || []);
      if (notificationsRes.status === 'fulfilled') setNotifications(notificationsRes.value.notifications || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load admin data');
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      if (data.device?.id) {
        const nextDeviceId = String(data.device.id);
        sessionStorage.setItem('adminDeviceId', nextDeviceId);
        setDeviceId(nextDeviceId);
      }
      setToken('cookie-session');
      toast.success('Welcome back');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function savePage(page: 'home' | 'about' | 'contact' | 'students' | 'footer') {
    await api(`/sections/${page}`, { method: 'PUT', body: JSON.stringify(pageContent[page] || {}) });
    toast.success(`${page} page updated`);
    loadAll();
  }

  async function saveTeacher(e: FormEvent) {
    e.preventDefault();
    const form = toFormData(teacherForm, ['image']);
    const path = editing?.type === 'teacher' ? `/teachers/${editing.id}` : '/teachers';
    await api(path, { method: editing?.type === 'teacher' ? 'PUT' : 'POST', body: form });
    setTeacherForm({ name: '', subject: '', experience_years: 0, phone: '', bio: '', social_links: '', is_active: true });
    setEditing(null);
    toast.success('Teacher saved');
    loadAll();
  }

  async function saveStudent(e: FormEvent) {
    e.preventDefault();
    const form = toFormData(studentForm, ['image']);
    const path = editing?.type === 'student' ? `/students/${editing.id}` : '/students';
    await api(path, { method: editing?.type === 'student' ? 'PUT' : 'POST', body: form });
    setStudentForm({ name: '', grade: '', class_name: '', group: '', parent_name: '', parent_phone: '', achievements: '', certificates: '' });
    setEditing(null);
    toast.success('Student saved');
    loadAll();
  }

  async function saveStaff(e: FormEvent) {
    e.preventDefault();
    const form = toFormData(staffForm, ['image']);
    const path = editing?.type === 'staff' ? `/staff/${editing.id}` : '/staff';
    await api(path, { method: editing?.type === 'staff' ? 'PUT' : 'POST', body: form });
    setStaffForm({ name: '', position: '', description: '', order_num: (staff.length || 0) + 1, is_active: true });
    setEditing(null);
    toast.success('Administration member saved');
    loadAll();
  }

  async function saveContent(e: FormEvent) {
    e.preventDefault();
    const payload = { ...contentForm, category: activeTab === 'gallery' ? 'gallery' : 'news' };
    const form = toFormData(payload, ['image']);
    const path = editing?.type === 'content' ? `/content/${editing.id}` : '/content';
    await api(path, { method: editing?.type === 'content' ? 'PUT' : 'POST', body: form });
    setContentForm({ ...emptyContent, category: activeTab === 'gallery' ? 'gallery' : 'news' });
    setEditing(null);
    toast.success(activeTab === 'gallery' ? 'Media saved' : 'News saved');
    loadAll();
  }

  async function deleteItem(path: string) {
    await api(path, { method: 'DELETE' });
    toast.success('Deleted');
    loadAll();
  }

  async function publishItem(id: number) {
    await api(`/content/${id}/publish`, { method: 'PATCH' });
    toast.success('Published');
    loadAll();
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwordForm)
    });
    setPasswordForm({ currentPassword: '', newPassword: '' });
    toast.success('Password changed');
  }

  async function updateSecretKey(e: FormEvent) {
    e.preventDefault();
    await api('/auth/set-secret-key', {
      method: 'POST',
      body: JSON.stringify({ secretKey })
    });
    setSecretKey('');
    toast.success('Secret key updated');
  }

  async function logout() {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: deviceId ? { 'X-Device-Id': deviceId } : {}
      });
    } catch {}
    clearSession();
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <motion.form initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleLogin} className="w-full max-w-md rounded-lg border border-white/10 bg-white p-8 shadow-2xl">
          <Shield className="size-12 text-cyan-600 mb-5" />
          <h1 className="text-2xl font-bold text-slate-950">Admin Login</h1>
          <p className="text-sm text-slate-500 mb-6">Protected educational center control panel</p>
          <input className="admin-input" placeholder="Username" value={loginData.username} onChange={e => setLoginData({ ...loginData, username: e.target.value })} />
          <input className="admin-input mt-3" type="password" placeholder="Password" value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })} />
          <Button className="w-full mt-5 bg-cyan-700 hover:bg-cyan-800">Login</Button>
        </motion.form>
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-cyan-700 text-white"><Shield className="size-5" /></div>
              <div>
                <h1 className="font-bold">Admin Panel</h1>
                <p className="text-xs text-slate-500">Education Center CMS</p>
              </div>
            </div>
          </div>
          <nav className="p-3 space-y-1">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${activeTab === item.id ? 'bg-cyan-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                <item.icon className="size-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="lg:pl-72">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 lg:px-8">
              <div>
                <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Control Center</p>
                <h2 className="text-xl font-bold capitalize">{activeTab}</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative hidden sm:block">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="h-10 w-64 rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
                </div>
                <button onClick={() => setDarkMode(!darkMode)} className="admin-icon-button">{darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
                <button onClick={logout} className="admin-icon-button"><LogOut className="size-4" /></button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden">
              {navItems.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`shrink-0 rounded-md px-3 py-2 text-xs ${activeTab === item.id ? 'bg-cyan-700 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>{item.label}</button>
              ))}
            </div>
          </header>

          <main className="p-4 lg:p-8">
            {activeTab === 'dashboard' && <Dashboard stats={stats} notifications={notifications} />}
            {activeTab === 'home' && <PageEditor page="home" data={pageContent} setData={setPageContent} onSave={savePage} />}
            {activeTab === 'about' && <PageEditor page="about" data={pageContent} setData={setPageContent} onSave={savePage} />}
            {activeTab === 'staff' && (
              <CrudLayout title="Administration" onSubmit={saveStaff} form={<StaffForm form={staffForm} setForm={setStaffForm} />} list={<StaffList staff={visibleStaff} edit={(s) => { setEditing({ type: 'staff', id: s.id }); setStaffForm({ ...s }); }} remove={(id) => deleteItem(`/staff/${id}`)} />} />
            )}
            {activeTab === 'contact' && <PageEditor page="contact" data={pageContent} setData={setPageContent} onSave={savePage} />}
            {activeTab === 'footer' && <PageEditor page="footer" data={pageContent} setData={setPageContent} onSave={savePage} />}
            {activeTab === 'teachers' && (
              <CrudLayout title="Teachers" onSubmit={saveTeacher} form={<TeacherForm form={teacherForm} setForm={setTeacherForm} />} list={<TeacherList teachers={visibleTeachers} edit={(t) => { setEditing({ type: 'teacher', id: t.id }); setTeacherForm({ ...t, social_links: JSON.stringify(t.social_links || {}) }); }} remove={(id) => deleteItem(`/teachers/${id}`)} />} />
            )}
            {activeTab === 'students' && (
              <div className="space-y-6">
                <PageEditor page="students" data={pageContent} setData={setPageContent} onSave={() => savePage('students' as any)} />
                <CrudLayout title="Students" onSubmit={saveStudent} form={<StudentForm form={studentForm} setForm={setStudentForm} />} list={<StudentList students={visibleStudents} edit={(s) => { setEditing({ type: 'student', id: s.id }); setStudentForm({ ...s, achievements: (s.achievements || []).join(', '), certificates: (s.certificates || []).join(', ') }); }} remove={(id) => deleteItem(`/students/${id}`)} mark={(id) => api(`/students/${id}/attendance`, { method: 'PATCH', body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), status: 'present' }) }).then(loadAll)} />} />
              </div>
            )}
            {(activeTab === 'news' || activeTab === 'gallery') && (
              <CrudLayout title={activeTab === 'news' ? 'News' : 'Gallery'} onSubmit={saveContent} form={<ContentForm form={contentForm} setForm={setContentForm} gallery={activeTab === 'gallery'} />} list={<ContentList items={visibleContent} edit={(item) => { setEditing({ type: 'content', id: item.id }); setContentForm({ ...emptyContent, ...item }); }} remove={(id) => deleteItem(`/content/${id}`)} publish={publishItem} />} />
            )}
            {activeTab === 'security' && (
              <SecurityPanel
                passwordForm={passwordForm}
                setPasswordForm={setPasswordForm}
                secretKey={secretKey}
                setSecretKey={setSecretKey}
                onChangePassword={changePassword}
                onUpdateSecretKey={updateSecretKey}
              />
            )}
            {activeTab === 'logs' && <Logs logs={logs} notifications={notifications} />}
          </main>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ stats, notifications }: { stats: Record<string, number>; notifications: any[] }) {
  const cards = [
    ['Teachers', stats.teachers || 0, GraduationCap],
    ['Students', stats.students || 0, Users],
    ['Administration', stats.staff || 0, Shield],
    ['News', stats.news || 0, FileText],
    ['Gallery', stats.gallery || 0, GalleryHorizontalEnd],
    ['Published', stats.published || 0, BookOpen],
    ['Drafts', stats.drafts || 0, Pencil],
    ['Views', stats.views || 0, Activity]
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon]: any) => (
          <div key={label} className="admin-card">
            <Icon className="size-5 text-cyan-700 dark:text-cyan-300" />
            <p className="mt-4 text-sm text-slate-500">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className="admin-card">
        <h3 className="font-bold mb-3">Real-time Notifications</h3>
        <div className="space-y-2">
          {notifications.slice(0, 6).map(item => <p key={item.id} className={notificationClass(item)}>{item.message}</p>)}
          {!notifications.length && <p className="text-sm text-slate-500">No notifications yet.</p>}
        </div>
      </div>
    </div>
  );
}

function PageEditor({ page, data, setData, onSave }: any) {
  const schema = pageSchemas[page as keyof typeof pageSchemas];
  const pageData = data[page] || {};
  const classRows = getClassRows(pageData?.classes?.items_json);

  function setPageField(section: string, key: string, value: string) {
    setData((prev: any) => ({
      ...prev,
      [page]: {
        ...(prev[page] || {}),
        [section]: {
          ...((prev[page] || {})[section] || {}),
          [key]: value
        }
      }
    }));
  }

  function updateClassRow(grade: number, field: 'students' | 'classesCount', value: string) {
    const next = classRows.map((row) => row.grade === grade ? { ...row, [field]: Number(value || 0) } : row);
    setPageField('classes', 'items_json', JSON.stringify(next));
  }

  return (
    <div className="space-y-5">
      {Object.entries(schema).map(([section, keys]) => (
        <div key={section} className="admin-card">
          <h3 className="font-bold capitalize mb-4">{section}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {(keys as readonly string[]).map(key => (
              <div key={key} className={section === 'classes' && key === 'items_json' ? 'md:col-span-2' : ''}>
                {page === 'students' && section === 'classes' && key === 'items_json' ? (
                  <div className="rounded-md border border-slate-700 p-3">
                    <div className="mb-3 text-sm text-slate-400">1-11 sinf bo'yicha sonlarni kiriting</div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {classRows.map((row) => (
                        <div key={row.grade} className="rounded-md border border-slate-700 p-3">
                          <p className="mb-2 font-semibold">{row.grade}-sinf</p>
                          <label className="mb-2 block text-xs text-slate-400">O'quvchi soni</label>
                          <input type="number" min={0} className="admin-input mb-2" value={row.students} onChange={(e) => updateClassRow(row.grade, 'students', e.target.value)} />
                          <label className="mb-2 block text-xs text-slate-400">Sinf soni</label>
                          <input type="number" min={0} className="admin-input" value={row.classesCount} onChange={(e) => updateClassRow(row.grade, 'classesCount', e.target.value)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-500 capitalize">{key.replaceAll('_', ' ')}</span>
                    {isUrlField(key) ? (
                      <input
                        type="url"
                        className="admin-input"
                        value={pageData[section]?.[key] || ''}
                        onChange={(e) => setPageField(section, key, e.target.value)}
                        placeholder="https://..."
                      />
                    ) : (
                      <textarea
                        rows={key.includes('desc') || key === 'main' ? 4 : 2}
                        className="admin-input min-h-0"
                        value={pageData[section]?.[key] || ''}
                        onChange={(e) => setPageField(section, key, e.target.value)}
                      />
                    )}
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button onClick={() => onSave(page)} className="bg-cyan-700 hover:bg-cyan-800"><Save className="mr-2 size-4" />Save Page</Button>
    </div>
  );
}

function isUrlField(key: string) {
  return key.includes('image') || key.includes('video') || key === 'map' || key === 'facebook' || key === 'instagram' || key === 'youtube' || key === 'telegram';
}

function getClassRows(raw: string | undefined) {
  const fallback = Array.from({ length: 11 }, (_, i) => ({ grade: i + 1, students: 0, classesCount: 0 }));
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const byGrade = new Map<number, { grade: number; students: number; classesCount: number }>();
    for (const item of parsed) {
      const grade = Number(item?.grade);
      if (!Number.isFinite(grade) || grade < 1 || grade > 11) continue;
      byGrade.set(grade, {
        grade,
        students: Number(item?.students || 0),
        classesCount: Number(item?.classesCount || item?.classes || 0)
      });
    }
    return fallback.map((row) => byGrade.get(row.grade) || row);
  } catch {
    return fallback;
  }
}

function CrudLayout({ title, form, list, onSubmit }: any) {
  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <form onSubmit={onSubmit} className="admin-card h-fit space-y-3">
        <h3 className="font-bold flex items-center gap-2"><Plus className="size-4" /> {title} Editor</h3>
        {form}
        <Button className="w-full bg-cyan-700 hover:bg-cyan-800"><Save className="mr-2 size-4" />Save</Button>
      </form>
      <div className="admin-card">{list}</div>
    </div>
  );
}

function TeacherForm({ form, setForm }: any) {
  return <FormFields form={form} setForm={setForm} fields={['name', 'subject', 'experience_years', 'phone', 'bio', 'social_links']} file />;
}

function StudentForm({ form, setForm }: any) {
  return <FormFields form={form} setForm={setForm} fields={['name', 'grade', 'class_name', 'group', 'parent_name', 'parent_phone', 'achievements', 'certificates']} file />;
}

function StaffForm({ form, setForm }: any) {
  return (
    <>
      <FormFields form={form} setForm={setForm} fields={['name', 'position', 'description', 'order_num']} file />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
        Active on About page
      </label>
    </>
  );
}

function ContentForm({ form, setForm, gallery }: any) {
  return (
    <>
      <FormFields form={form} setForm={setForm} fields={gallery ? ['title', 'description', 'album', 'video_url'] : ['title', 'description', 'content_text', 'slug', 'publish_date']} file />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} /> Published</label>
      {gallery && <select className="admin-input" value={form.media_type} onChange={e => setForm({ ...form, media_type: e.target.value })}><option value="image">Image</option><option value="video">Video</option></select>}
    </>
  );
}

function FormFields({ form, setForm, fields, file }: any) {
  return (
    <>
      {fields.map((field: string) => (
        <label key={field} className="block text-sm">
          <span className="mb-1 block text-slate-500 capitalize">{field.replaceAll('_', ' ')}</span>
          {field.includes('bio') || field.includes('content') || field.includes('description') ? (
            <textarea className="admin-input min-h-24" value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })} />
          ) : (
            <input className="admin-input" value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })} />
          )}
        </label>
      ))}
      {file && <label className="block text-sm"><span className="mb-1 flex items-center gap-1 text-slate-500"><Upload className="size-4" /> Upload media</span><input className="admin-input" type="file" onChange={e => setForm({ ...form, image: e.target.files?.[0] })} /></label>}
    </>
  );
}

function ContentList({ items, edit, remove, publish }: any) {
  return <DataList items={items} render={(item: ContentItem) => <><span className="font-semibold">{item.title}</span><span className="text-xs text-slate-500">{item.category} | {item.views || 0} views | {item.is_published ? 'Published' : 'Draft'}</span></>} edit={edit} remove={remove} extra={(item: ContentItem) => !item.is_published && <button onClick={() => publish(item.id)} className="admin-icon-button"><Upload className="size-4" /></button>} />;
}

function TeacherList({ teachers, edit, remove }: any) {
  return <DataList items={teachers} render={(item: Teacher) => <><span className="font-semibold">{item.name}</span><span className="text-xs text-slate-500">{item.subject} | {item.experience_years} years | {item.phone}</span></>} edit={edit} remove={remove} />;
}

function StudentList({ students, edit, remove, mark }: any) {
  return <DataList items={students} render={(item: Student) => <><span className="font-semibold">{item.name}</span><span className="text-xs text-slate-500">{item.grade} {item.class_name} | {item.group || 'No group'} | Attendance: {item.attendance?.length || 0}</span></>} edit={edit} remove={remove} extra={(item: Student) => <button onClick={() => mark(item.id)} className="admin-icon-button"><Activity className="size-4" /></button>} />;
}

function StaffList({ staff, edit, remove }: any) {
  return <DataList items={staff} render={(item: StaffMember) => <><span className="font-semibold">{item.order_num}. {item.name}</span><span className="text-xs text-slate-500">{item.position} | {item.is_active === false ? 'Hidden' : 'Active'}</span><span className="text-xs text-slate-400 line-clamp-1">{item.description}</span></>} edit={edit} remove={remove} />;
}

function DataList({ items, render, edit, remove, extra }: any) {
  return (
    <div className="space-y-2">
      {items.map((item: any) => (
        <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
          <div className="min-w-0 flex flex-col">{render(item)}</div>
          <div className="flex shrink-0 gap-2">
            {extra?.(item)}
            <button onClick={() => edit(item)} className="admin-icon-button"><Pencil className="size-4" /></button>
            <button onClick={() => remove(item.id)} className="admin-icon-button text-red-600"><Trash2 className="size-4" /></button>
          </div>
        </div>
      ))}
      {!items.length && <p className="text-sm text-slate-500">No records found.</p>}
    </div>
  );
}

function Logs({ logs, notifications }: any) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="admin-card"><h3 className="font-bold mb-3">Activity Logs</h3><DataFeed items={logs} /></div>
      <div className="admin-card"><h3 className="font-bold mb-3">Notifications</h3><DataFeed items={notifications} /></div>
    </div>
  );
}

function DataFeed({ items }: any) {
  return <div className="space-y-2">{items.map((item: any) => <div key={item.id} className={notificationClass(item)}><p>{item.message}</p><p className="text-xs opacity-70">{new Date(item.created_at).toLocaleString()}</p></div>)}</div>;
}

function notificationClass(item: any) {
  return item?.type === 'danger'
    ? 'rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
    : 'rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-800';
}

function getPasswordChecks(password: string) {
  return [
    ['At least 8 characters', password.length >= 8],
    ['Uppercase letter', /[A-Z]/.test(password)],
    ['Lowercase letter', /[a-z]/.test(password)],
    ['Number', /[0-9]/.test(password)],
    ['Special character', /[!@#$%^&*(),.?":{}|<>]/.test(password)]
  ] as const;
}

function SecurityPanel({ passwordForm, setPasswordForm, secretKey, setSecretKey, onChangePassword, onUpdateSecretKey }: any) {
  const checks = getPasswordChecks(passwordForm.newPassword || '');
  const strongCount = checks.filter(([, passed]) => passed).length;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <form onSubmit={onChangePassword} className="admin-card space-y-4">
        <h3 className="font-bold flex items-center gap-2"><KeyRound className="size-4" /> Password Security</h3>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Current password</span>
          <input className="admin-input" type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">New password</span>
          <input className="admin-input" type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
        </label>
        <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700">
          <div className="mb-2 flex items-center justify-between">
            <span>Password strength</span>
            <span className={strongCount === checks.length ? 'text-green-600' : 'text-amber-600'}>{strongCount}/{checks.length}</span>
          </div>
          <div className="grid gap-1">
            {checks.map(([label, passed]) => (
              <span key={label} className={passed ? 'text-green-600' : 'text-slate-500'}>{passed ? 'OK' : 'NO'} - {label}</span>
            ))}
          </div>
        </div>
        <Button className="bg-cyan-700 hover:bg-cyan-800"><Save className="mr-2 size-4" />Change Password</Button>
      </form>

      <form onSubmit={onUpdateSecretKey} className="admin-card h-fit space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Shield className="size-4" /> Secret Key</h3>
        <p className="text-sm text-slate-500">Used for secure password recovery. Minimum 16 characters.</p>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">New secret key</span>
          <input className="admin-input" type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
        </label>
        <Button className="bg-cyan-700 hover:bg-cyan-800"><Save className="mr-2 size-4" />Update Secret Key</Button>
      </form>
    </div>
  );
}

function toFormData(source: Record<string, any>, fileKeys: string[]) {
  const form = new FormData();
  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (fileKeys.includes(key)) form.append('image', value);
    else if (typeof value === 'object') form.append(key, JSON.stringify(value));
    else form.append(key, String(value));
  });
  return form;
}

const navItems: Array<{ id: AdminTab; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'home', label: 'Home Page', icon: Home },
  { id: 'about', label: 'About Us', icon: BookOpen },
  { id: 'staff', label: 'Administration', icon: Shield },
  { id: 'teachers', label: 'Teachers', icon: GraduationCap },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'news', label: 'News', icon: FileText },
  { id: 'gallery', label: 'Gallery', icon: GalleryHorizontalEnd },
  { id: 'contact', label: 'Contact', icon: Contact },
  { id: 'footer', label: 'Footer', icon: BookOpen },
  { id: 'security', label: 'Security', icon: KeyRound },
  { id: 'logs', label: 'Logs', icon: Bell }
];
