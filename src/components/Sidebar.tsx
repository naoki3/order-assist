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
  Layers,
  Settings2,
} from 'lucide-react';
import { useT } from './LanguageProvider';
import LanguageToggle from './LanguageToggle';
import type { LucideIcon } from 'lucide-react';

type SubItem = { href: string; label: string; exact: boolean };
type NavGroup = { type: 'group'; key: string; label: string; icon: LucideIcon; items: SubItem[] };
type NavLink = { type: 'link'; href: string; label: string; icon: LucideIcon; exact: boolean };
type NavItem = NavGroup | NavLink;

function matchesPath(href: string, pathname: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
}

function groupIsActive(group: NavGroup, pathname: string) {
  return group.items.some((item) => matchesPath(item.href, pathname, item.exact));
}

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useT();

  const navItems: NavItem[] = [
    { type: 'link', href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, exact: false },
    { type: 'link', href: '/incoming', label: t('nav.incomingStock'), icon: Truck, exact: false },
    {
      type: 'group', key: 'inventory', label: t('nav.inventoryGroup'), icon: Package,
      items: [
        { href: '/inventory', label: t('nav.inventory'), exact: true },
        { href: '/inventory/adjust', label: t('nav.inventoryAdjust'), exact: false },
      ],
    },
    {
      type: 'group', key: 'orders', label: t('nav.ordersGroup'), icon: ClipboardList,
      items: [
        { href: '/', label: t('nav.orderReview'), exact: true },
        { href: '/history', label: t('nav.orderHistory'), exact: false },
      ],
    },
    {
      type: 'group', key: 'sales', label: t('nav.salesGroup'), icon: TrendingUp,
      items: [
        { href: '/sales/report', label: t('nav.salesReport'), exact: false },
        { href: '/sales', label: t('nav.salesEntry'), exact: true },
      ],
    },
  ];

  // For mobile: find the active group (if any)
  const activeGroup = navItems.find(
    (item): item is NavGroup => item.type === 'group' && groupIsActive(item, pathname)
  ) ?? null;

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
          {navItems.map((item) => {
            if (item.type === 'link') {
              const active = matchesPath(item.href, pathname, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-green-700 text-white font-medium'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  {item.label}
                </Link>
              );
            }

            const Icon = item.icon;
            const active = groupIsActive(item, pathname);
            return (
              <div key={item.key} className="space-y-0.5">
                <div
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                    active ? 'text-green-800' : 'text-slate-500'
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  {item.label}
                </div>
                <div className="ml-4 space-y-0.5">
                  {item.items.map((sub) => {
                    const subActive = matchesPath(sub.href, pathname, sub.exact);
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={`flex items-center gap-2 pl-5 pr-3 py-1.5 rounded-lg text-sm transition-colors border-l-2 ${
                          subActive
                            ? 'border-green-700 bg-green-50 text-green-700 font-medium'
                            : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
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
            <LanguageToggle compact />
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

        {/* Mobile primary nav */}
        <nav className="flex gap-0.5 text-sm overflow-x-auto px-3 pb-2 scrollbar-none">
          {navItems.map((item) => {
            if (item.type === 'link') {
              const active = matchesPath(item.href, pathname, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md whitespace-nowrap shrink-0 transition-colors text-sm ${
                    active
                      ? 'bg-green-50 text-green-700 font-semibold'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {item.label}
                </Link>
              );
            }

            const active = groupIsActive(item, pathname);
            // Link group label to first sub-item
            return (
              <Link
                key={item.key}
                href={item.items[0].href}
                className={`px-3 py-1.5 rounded-md whitespace-nowrap shrink-0 transition-colors text-sm ${
                  active
                    ? 'bg-green-50 text-green-700 font-semibold'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile sub-nav (shown when inside a group) */}
        {activeGroup && (
          <nav className="flex gap-0.5 text-xs overflow-x-auto px-3 pb-2 scrollbar-none border-t border-slate-100 pt-1.5">
            {activeGroup.items.map((sub) => {
              const subActive = matchesPath(sub.href, pathname, sub.exact);
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={`px-3 py-1 rounded-md whitespace-nowrap shrink-0 transition-colors ${
                    subActive
                      ? 'bg-green-700 text-white font-semibold'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {sub.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
    </>
  );
}
