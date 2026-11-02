import { Link, Outlet } from "react-router-dom";
import { Compass, LogOut, Plus, Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Badge, Button } from "./ui";

export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 text-lg font-extrabold text-brand-800">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"><Compass className="h-5 w-5" /></span>
      Wayfare
    </Link>
  );
}

export default function Layout() {
  const { user, health, signOut } = useAuth();
  const ai = health?.ai && health.ai !== "offline-template";

  return (
    <div className="min-h-screen">
      <header className="screen-only sticky top-0 z-20 border-b border-sand-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Brand />
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline-flex">
              <Badge
                tone={ai ? "brand" : "amber"}
                icon={Sparkles}
                title={ai ? `Plans are written by ${health.ai}` : "No API key set: plans come from the built-in template planner"}
              >
                {ai ? "AI planner" : "Template planner"}
              </Badge>
            </span>
            <Link to="/new"><Button icon={Plus}>New trip</Button></Link>
            {user?.demo ? (
              <Badge>Demo mode</Badge>
            ) : (
              <Button variant="ghost" icon={LogOut} onClick={signOut} aria-label="Sign out">
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
