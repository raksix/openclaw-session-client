"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import type { User } from "@/types";

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { user: currentUser } = useAuthStore();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "user" as "admin" | "user",
    canCreateSession: true,
    canDeleteSession: true,
    canManageUsers: false,
    assignedSessions: [] as string[],
  });
  const [allSessions, setAllSessions] = useState<
    Array<{ _id: string; name: string }>
  >([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user
        const userRes = await fetch(`/api/users/${userId}`);
        if (!userRes.ok) {
          throw new Error("User not found");
        }
        const userData = await userRes.json();
        setUser(userData);

        // Fetch all sessions for assignment
        const sessionsRes = await fetch("/api/sessions");
        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json();
          setAllSessions(sessionsData);
        }

        // Set form data
        setFormData({
          username: userData.username,
          email: userData.email,
          password: "",
          role: userData.role,
          canCreateSession: userData.permissions?.canCreateSession ?? true,
          canDeleteSession: userData.permissions?.canDeleteSession ?? true,
          canManageUsers: userData.permissions?.canManageUsers ?? false,
          assignedSessions: userData.permissions?.assignedSessions ?? [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const payload: Record<string, unknown> = {
        username: formData.username,
        email: formData.email,
        role: formData.role,
        permissions: {
          canCreateSession: formData.canCreateSession,
          canDeleteSession: formData.canDeleteSession,
          canManageUsers: formData.canManageUsers,
          assignedSessions: formData.assignedSessions,
        },
      };

      // Only include password if it's been changed
      if (formData.password) {
        payload.password = formData.password;
      }

      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update user");
      }

      router.push("/admin/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSession = (sessionId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedSessions: prev.assignedSessions.includes(sessionId)
        ? prev.assignedSessions.filter((id) => id !== sessionId)
        : [...prev.assignedSessions, sessionId],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">User not found</p>
        <Button variant="link" onClick={() => router.push("/admin/users")}>
          Back to Users
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Edit User</h2>
        <p className="text-sm text-muted-foreground">
          Update user information and permissions
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>User Information</CardTitle>
          <CardDescription>Basic account details</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                New Password{" "}
                <span className="text-muted-foreground font-normal">
                  (leave blank to keep current)
                </span>
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Enter new password"
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    role: value as "admin" | "user",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <CardDescription>Configure user access rights</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Can Create Sessions</Label>
              <p className="text-xs text-muted-foreground">
                User can create new OpenClaw sessions
              </p>
            </div>
            <Switch
              checked={formData.canCreateSession}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, canCreateSession: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Can Delete Sessions</Label>
              <p className="text-xs text-muted-foreground">
                User can delete their own sessions
              </p>
            </div>
            <Switch
              checked={formData.canDeleteSession}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, canDeleteSession: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Can Manage Users</Label>
              <p className="text-xs text-muted-foreground">
                User can manage other users (admins only)
              </p>
            </div>
            <Switch
              checked={formData.canManageUsers}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, canManageUsers: checked })
              }
              disabled={formData.role === "admin"}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Assigned Sessions</CardTitle>
          <CardDescription>
            Select which sessions this user can access. Leave empty for all
            sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sessions available
            </p>
          ) : (
            <div className="space-y-2">
              {allSessions.map((session) => (
                <div
                  key={session._id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                  onClick={() => toggleSession(session._id)}
                >
                  <input
                    type="checkbox"
                    checked={formData.assignedSessions.includes(session._id)}
                    onChange={() => toggleSession(session._id)}
                    className="rounded border-input"
                  />
                  <span className="text-sm">{session.name}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/admin/users")}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
