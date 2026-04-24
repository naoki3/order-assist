'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/actions/auth';

const links = [
  { href: '/', label: 'Order Review' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/sales', label: 'Sales Entry' },
  { href: '/products', label: 'Products' },
  { href: '/incoming', label: 'Incoming Stock' },
  { href: '/history', label: 'Order History' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">OA</span>
            </div>
            <span className="font-bold text-sm text-slate-800 tracking-tight">Order Assist</span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors font-medium"
            >
              Logout
            </button>
          </form>
        </div>
        <nav className="flex gap-0.5 text-sm overflow-x-auto px-3 pb-2 scrollbar-none">
          {links.map(({ href, label }) => {
            const isActive =
              href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md whitespace-nowrap shrink-0 transition-colors text-sm ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
