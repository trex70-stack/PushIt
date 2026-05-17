import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Bell, Monitor, LayoutTemplate, Key, LogOut, Sun, Moon, SlidersHorizontal, Menu, X } from "lucide-react";
import { useMe, useLogout } from "../../hooks/useAuth.js";
import { useDarkMode } from "../../hooks/useDarkMode.js";
import { cn } from "../../lib/utils.js";

const navItems = [
  { to: "/", label: "Nachrichten", icon: Bell, end: true },
  { to: "/devices", label: "Geräte", icon: Monitor },
  { to: "/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/api-keys", label: "API-Keys", icon: Key, adminOnly: true },
];

function ThemeToggle() {
  const { theme, setTheme } = useDarkMode();

  const options: { value: "light" | "dark" | "system"; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: "Hell" },
    { value: "dark", icon: Moon, label: "Dunkel" },
    { value: "system", icon: SlidersHorizontal, label: "System" },
  ];

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            theme === value
              ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}

export function AppLayout() {
  const { data: user } = useMe();
  const logout = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNavItems = navItems.filter(
    ({ adminOnly }) => !adminOnly || user?.role === "admin"
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">

      {/* ── Desktop-Sidebar ── */}
      <aside className="hidden md:flex w-56 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xl font-semibold tracking-tight">PushIt</span>
          <ThemeToggle />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNavItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500 truncate">{user?.email}</div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <LogOut size={16} />
            Abmelden
          </button>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-lg font-semibold">PushIt</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── Mobile Drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-20 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-white dark:bg-gray-800 flex flex-col pt-14 shadow-xl">
            <nav className="flex-1 px-3 py-4 space-y-1">
              {visibleNavItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="px-3 py-1 text-xs text-gray-400 truncate">{user?.email}</div>
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <LogOut size={16} />
                Abmelden
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Hauptinhalt ── */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
