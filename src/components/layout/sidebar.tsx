"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search, Settings, Users, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { formatRelativeTime } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { sessions, setActiveSession, activeSession, setSessions } = useSessionStore();
  const { sidebarCollapsed } = useUIStore();
  const { user } = useAuthStore();

  useEffect(() => {
    // Fetch sessions on mount
    const fetchSessions = async () => {
      try {
        const res = await fetch("/api/sessions");
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
        }
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      }
    };
    fetchSessions();
  }, [setSessions]);

  const isAdmin = user?.role === "admin";

  return (
    <aside
      className={cn(
        "fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-[280px] border-r bg-card flex flex-col transition-transform duration-200 z-40",
        sidebarCollapsed && "hidden lg:flex"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Sessions</h2>
          {user?.permissions?.canCreateSession && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Session</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No sessions yet</p>
              {user?.permissions?.canCreateSession && (
                <Button variant="link" className="mt-2 text-primary">
                  Create your first session
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <button
                  key={session._id}
                  onClick={() => setActiveSession(session)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors",
                    activeSession?._id === session._id
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className="flex-shrink-0">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        session.status === "online" && "bg-green-500",
                        session.status === "idle" && "bg-yellow-500",
                        session.status === "offline" && "bg-gray-500",
                        session.status === "error" && "bg-red-500"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {session.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatRelativeTime(session.lastActivityAt)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/sessions">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>All Sessions</TooltipContent>
          </Tooltip>

          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/admin/users">
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Users className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Admin Panel</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/settings">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
