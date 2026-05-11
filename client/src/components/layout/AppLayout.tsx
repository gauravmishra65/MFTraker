import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { ChartLine as LineChart, LayoutDashboard, Briefcase, Star, ListFilter as Filter, User as User2, Sun, Moon, LogOut, Bell, BookOpen, Menu, X, CirclePlus as PlusCircle } from "lucide-react";
import GlobalSearch from "@/components/stocks/GlobalSearch";
import IndicesBanner from "@/components/dashboard/IndicesBanner";
import { classNames } from "@/lib/format";

const navItems = [
  { to: "/",            label: "Dashboard",  icon: LayoutDashboard },
  { to: "/portfolio",   label: "Portfolio",  icon: Briefcase },
  { to: "/watchlist",   label: "Watchlist",  icon: Star },
  { to: "/screener",    label: "Screener",   icon: Filter },
  { to: "/stocks/add",  label: "Add Stocks", icon: PlusCircle },
  { to: "/alerts",      label: "Alerts",     icon: Bell },
  { to: "/learn",       label: "Learn",      icon: BookOpen },
  { to: "/profile",     label: "Profile",    icon: User2 },
];

export default function AppLayout() {
  const user  = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggle } = useThemeStore();
  const nav = useNavigate();
  const loc = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [loc.pathname]);

  const Sidebar = (
    <>
      <Link to="/" className="flex items-center gap-2 px-5 h-16 border-b border-slate-200 dark:border-slate-800">
        <LineChart className="w-6 h-6 text-brand-500" />
        <span className="font-semibold tracking-tight">Tracker</span>
      </Link>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === "/"}
            onClick={() => setDrawerOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`
            }
          >
            <it.icon className="w-4 h-4" />
            {it.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={() => { logout(); nav("/login"); }}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="w-60 hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        {Sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-900 flex flex-col shadow-xl">
            <div className="flex justify-end px-3 pt-3">
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            {Sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-3">
          <button
            className="md:hidden p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 max-w-2xl">
            <GlobalSearch />
          </div>
          <button
            onClick={toggle}
            className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <div className={classNames("hidden sm:block text-sm text-slate-500", loc.pathname === "/" && "")}>
            Hi, <span className="font-medium text-slate-700 dark:text-slate-200">{user?.fullName?.split(" ")[0] ?? "Investor"}</span>
          </div>
        </header>
        <IndicesBanner />
        <main className="flex-1 px-4 sm:px-6 py-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
