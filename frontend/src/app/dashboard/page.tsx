"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, BookOpen, Building2, GraduationCap, ArrowUpRight, TrendingUp } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { generalApi, DashboardStats } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await generalApi.getStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Students",
      value: stats?.counts.students || 0,
      icon: Users,
      color: "bg-blue-500",
      trend: "+12%",
    },
    {
      title: "Active Courses",
      value: stats?.counts.courses || 0,
      icon: BookOpen,
      color: "bg-emerald-500",
      trend: "+5%",
    },
    {
      title: "Departments",
      value: stats?.counts.departments || 0,
      icon: Building2,
      color: "bg-violet-500",
      trend: "0%",
    },
    {
      title: "Classes",
      value: stats?.counts.classes || 0,
      icon: GraduationCap,
      color: "bg-amber-500",
      trend: "+3%",
    },
  ];

  return (
    <div className="min-h-screen">
      <Header
        title="Dashboard"
        description="Welcome back! Here's what's happening at your university."
      />

      <div className="p-6 lg:p-8 space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card hover className="relative overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {stat.title}
                          </p>
                          <p className="text-3xl font-bold mt-2 text-foreground">
                            {stat.value.toLocaleString()}
                          </p>
                          <div className="flex items-center gap-1 mt-2">
                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                            <span className="text-xs text-emerald-500 font-medium">
                              {stat.trend}
                            </span>
                            <span className="text-xs text-muted-foreground/70">vs last month</span>
                          </div>
                        </div>
                        <div className={`p-3 rounded-xl ${stat.color}`}>
                          <stat.icon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Students */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Recent Students</CardTitle>
                    <a
                      href="/dashboard/students"
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      View all
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats?.recentStudents && stats.recentStudents.length > 0 ? (
                        stats.recentStudents.map((student) => (
                          <div
                            key={student.id}
                            className="flex items-center gap-4 p-3 rounded-xl hover:bg-secondary/50 transition-colors"
                          >
                            <Avatar fallback={student.name} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-card-foreground truncate">
                                {student.name}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {student.roll_number}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground/70">
                              {formatDate(student.created_at)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-4">
                          No students added yet
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Courses */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Recent Courses</CardTitle>
                    <a
                      href="/dashboard/courses"
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      View all
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats?.recentCourses && stats.recentCourses.length > 0 ? (
                        stats.recentCourses.map((course) => (
                          <div
                            key={course.id}
                            className="flex items-center gap-4 p-3 rounded-xl hover:bg-secondary/50 transition-colors"
                          >
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-card-foreground truncate">
                                {course.name}
                              </p>
                              <Badge variant="secondary" className="mt-1">
                                {course.code}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground/70">
                              {formatDate(course.created_at)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-4">
                          No courses added yet
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { title: "Add Student", href: "/dashboard/students?action=add", icon: Users },
                      { title: "Add Course", href: "/dashboard/courses?action=add", icon: BookOpen },
                      { title: "Face Recognition", href: "/dashboard/face-recognition", icon: GraduationCap },
                      { title: "Generate Code", href: "/dashboard/courses?action=generate", icon: Building2 },
                    ].map((action) => (
                      <a
                        key={action.title}
                        href={action.href}
                        className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border hover:bg-secondary/50 hover:border-border/60 transition-all"
                      >
                        <div className="p-3 rounded-xl bg-muted">
                          <action.icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {action.title}
                        </span>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
