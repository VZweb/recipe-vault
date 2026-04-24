import { useLayoutEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  BookOpen,
  ChefHat,
  Egg,
  Home,
  Layers,
  LogOut,
  Package,
  Search,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";

function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/recipes", icon: BookOpen, label: "Recipes" },
  { to: "/suggestions", icon: ChefHat, label: "Cook" },
  { to: "/pantry", icon: Package, label: "Pantry" },
  { to: "/ingredients", icon: Egg, label: "Ingredients" },
  { to: "/organize", icon: Layers, label: "Organize" },
];

export function AppLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      {/* Top header */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-brand-700">
            <ChefHat size={24} />
            <span className="font-heading text-lg">Recipe Vault</span>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex flex-1 items-center justify-center gap-1 min-w-0">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            <span className="max-w-[140px] truncate text-xs text-stone-500" title={user?.email ?? ""}>
              {user?.email}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="!px-2"
              onClick={() => void signOut()}
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </Button>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="!px-2"
              onClick={() => void signOut()}
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </Button>
            <NavLink
              to="/recipes?search=true"
              className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
              aria-label="Search"
            >
              <Search size={20} />
            </NavLink>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-16 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-stone-200 bg-white md:hidden">
        <div className="flex items-center justify-around">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "text-brand-600"
                    : "text-stone-400 hover:text-stone-600"
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
