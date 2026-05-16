import { NavLink, Outlet } from "react-router-dom";
import { Bell, Monitor, LayoutTemplate, Key, LogOut } from "lucide-react";
import { useMe, useLogout } from "../../hooks/useAuth.js";
import { cn } from "../../lib/utils.js";

const navItems = [
  { to: "/", label: "Nachrichten", icon: Bell, end: true },
  { to: "/devices", label: "Geräte", icon: Monitor },
  { to: "/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/api-keys", label: "API-Keys", icon: Key, adminOnly: true },
];

export function AppLayout() {
  const { data: user } = useMe();
  const logout = useLogout();

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      <aside className="w-56 flex flex-col bg-white border-r border-gray-200">
        <div className="px-6 py-5 border-b border-gray-200">
          <span className="text-xl font-semibold tracking-tight">PushIt</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end, adminOnly }) => {
            if (adminOnly && user?.role !== "admin") return null;
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-violet-50 text-violet-700"
                      : "text-gray-600 hover:bg-gray-100"
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-gray-200">
          <div className="px-3 py-2 text-xs text-gray-400 truncate">{user?.email}</div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <LogOut size={16} />
            Abmelden
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
