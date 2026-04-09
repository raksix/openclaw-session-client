"use client";

import { useEffect, useState } from "react";
import { Users, FolderOpen, Activity, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Stats {
  totalUsers: number;
  totalSessions: number;
  activeSessions: number;
  recentActivity: Array<{
    _id: string;
    action: string;
    user: string;
    timestamp: Date;
  }>;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalSessions: 0,
    activeSessions: 0,
    recentActivity: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, sessionsRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/sessions"),
        ]);

        if (usersRes.ok && sessionsRes.ok) {
          const users = await usersRes.json();
          const sessions = await sessionsRes.json();
          setStats({
            totalUsers: users.length,
            totalSessions: sessions.length,
            activeSessions: sessions.filter(
              (s: { status: string }) => s.status === "online"
            ).length,
            recentActivity: [],
          });
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      description: "Registered accounts",
      icon: Users,
    },
    {
      title: "Total Sessions",
      value: stats.totalSessions,
      description: "All time",
      icon: FolderOpen,
    },
    {
      title: "Active Sessions",
      value: stats.activeSessions,
      description: "Currently online",
      icon: Activity,
    },
    {
      title: "Growth",
      value: "+12%",
      description: "This month",
      icon: TrendingUp,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Overview of your OpenClaw Session Manager
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                ) : (
                  <div className="text-2xl font-bold">{stat.value}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest actions in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : stats.recentActivity.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No recent activity
            </p>
          ) : (
            <div className="space-y-4">
              {stats.recentActivity.map((activity) => (
                <div
                  key={activity._id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">
                      by {activity.user}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
