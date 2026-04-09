"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal, Trash2, Power, PowerOff, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { Session } from "@/types";

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [users, setUsers] = useState<Array<{ _id: string; username: string }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [sessionToModify, setSessionToModify] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sessionsRes, usersRes] = await Promise.all([
          fetch("/api/sessions"),
          fetch("/api/users"),
        ]);

        if (sessionsRes.ok) {
          setSessions(await sessionsRes.json());
        }
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData.map((u: { _id: string; username: string }) => ({ _id: u._id, username: u.username })));
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredSessions = sessions.filter(
    (session) =>
      session.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteSession = async () => {
    if (!sessionToModify) return;

    try {
      const res = await fetch(`/api/sessions/${sessionToModify._id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSessions((prev) =>
          prev.filter((s) => s._id !== sessionToModify._id)
        );
        setDeleteDialogOpen(false);
        setSessionToModify(null);
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const getStatusBadge = (status: Session["status"]) => {
    switch (status) {
      case "online":
        return <Badge variant="success">Online</Badge>;
      case "idle":
        return <Badge variant="warning">Idle</Badge>;
      case "offline":
        return <Badge variant="secondary">Offline</Badge>;
      case "error":
        return <Badge variant="error">Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">All Sessions</h2>
          <p className="text-sm text-muted-foreground">
            View and manage all OpenClaw sessions
          </p>
        </div>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? "No sessions found" : "No sessions yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSessions.map((session) => (
            <Card key={session._id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      {session.name}
                    </CardTitle>
                    <CardDescription>
                      {formatRelativeTime(session.lastActivityAt)}
                    </CardDescription>
                  </div>
                  {getStatusBadge(session.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {session.ownerId ? "Assigned" : "Unassigned"}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setSessionToModify(session);
                          setAssignDialogOpen(true);
                        }}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Assign User
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{sessionToModify?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSession}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Session</DialogTitle>
            <DialogDescription>
              Assign &quot;{sessionToModify?.name}&quot; to a user
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user._id} value={user._id}>
                    {user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => setAssignDialogOpen(false)}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
