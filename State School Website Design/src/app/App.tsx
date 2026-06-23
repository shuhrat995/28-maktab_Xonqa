import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import type { ReactNode } from 'react';
import { TranslationProvider } from '@/translations';
import { Layout } from '@/app/components/Layout';
import { Home } from '@/app/pages/Home';
import { About } from '@/app/pages/About';
import { Teachers } from '@/app/pages/Teachers';
import { Students } from '@/app/pages/Students';
import { News } from '@/app/pages/News';
import { Gallery } from '@/app/pages/Gallery';
import { Contact } from '@/app/pages/Contact';
import { Admin } from '@/app/pages/Admin';

const ADMIN_PATHS = ['/admin', '/maktab28-boshqaruv', '/xonqa-28-panel'];

function RootLayout({ children }: { children: ReactNode }) {
  return (
    <Layout>
      {children}
    </Layout>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout><Home /></RootLayout>,
  },
  {
    path: '/about',
    element: <RootLayout><About /></RootLayout>,
  },
  {
    path: '/teachers',
    element: <RootLayout><Teachers /></RootLayout>,
  },
  {
    path: '/students',
    element: <RootLayout><Students /></RootLayout>,
  },
  {
    path: '/news',
    element: <RootLayout><News /></RootLayout>,
  },
  {
    path: '/gallery',
    element: <RootLayout><Gallery /></RootLayout>,
  },
  {
    path: '/contact',
    element: <RootLayout><Contact /></RootLayout>,
  },
  ...ADMIN_PATHS.map(path => ({
    path,
    element: <RootLayout><Admin /></RootLayout>,
  })),
], {
  basename: '/'
});

export default function App() {
  return (
    <TranslationProvider>
      <RouterProvider router={router} />
    </TranslationProvider>
  );
}
