'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/actions/auth';
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  TrendingUp,
  BarChart2,
  Truck,
  History,
  LogOut,
} from 'lucide-react';
import { useT } from './LanguageProvider';
import LanguageToggle from './LanguageToggle';

function isActive(href: string, pathname: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
}

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useT();

  const links = [
    { href: '/',              label: t('nav.orderReview'),   icon: ClipboardList,   exact: true },
    { href: '/dashboard',     label: t('nav.dashboard'),     icon: LayoutDashboard, exact: false },
    { href: '/sales',         label: t('nav.salesEntry'),    icon: TrendingUp,      exact: true },
    { href: '/sales/report',  label: t('nav.salesReport'),   icon: BarChart2,       exact: false },
    { href: '/products',      label: t('nav.products'),      icon: Package,         exact: false },
    { href: '/incoming',      label: t('nav.incomingStock'), icon: Truck,           exact: false },
    { href: '/history',       label: t('nav.orderHistory'),  icon: History,         exact: false },
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-white border-r border-slate-200 fixed top-0 left-0 z-20">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">OA</span>
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800 leading-tight">Order Assist</p>
              <p className="text-xs text-slate-400 leading-tight">発注アシスト</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {links.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, pathname, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-green-700 text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Language + Logout */}
        <div className="p-2 border-t border-slate-100 space-y-0.5">
          <LanguageToggle />
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 w-full transition-colors"
            >
              <LogOut size={16} className="shrink-0" />
              {t('nav.logout')}
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex md:hidden flex-col bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-700 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">OA</span>
            </div>
            <span className="font-bold text-sm text-slate-800">Order Assist</span>
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <form action={logout}>
              <button
                type="submit"
                className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 hover:bg-slate-100 rounded-md transition-colors"
              >
                {t('nav.logout')}
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-0.5 text-sm overflow-x-auto px-3 pb-2 scrollbar-none">
          {links.map(({ href, label, exact }) => {
            const active = isActive(href, pathname, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md whitespace-nowrap shrink-0 transition-colors text-sm ${
                  active
                    ? 'bg-green-50 text-green-700 font-semibold'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
