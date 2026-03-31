"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, BookOpen, ArrowUpRight, FileWarning, Clock, AlertCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";
import { generalApi, studentsApi, coursesApi, activitiesApi, DashboardStats, Student, Course } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Custom Card States
  const [myStudents, setMyStudents] = useState<Student[]>([]);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [semesterFilter, setSemesterFilter] = useState<string>("1");
  const [attendanceStats, setAttendanceStats] = useState<any[]>([]);

  // Removed attendanceMock code


  const pendingDocsMock = [
    { id: 1, title: "Week 4 Lesson Plan", course: "Data Structures", type: "Lesson Plan", urgent: true },
    { id: 2, title: "Lab Experiment Manual 3", course: "Operating Systems", type: "Lab File", urgent: false },
    { id: 3, title: "CO-PO Mapping Update", course: "Computer Networks", type: "Mapping", urgent: false },
  ];

  useEffect(() => {
    fetchDashboardData();
  }, [semesterFilter]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, studentsRes, coursesRes, attendanceRes] = await Promise.all([
        generalApi.getStats(),
        studentsApi.getAll({ limit: 100 }),
        coursesApi.getAll({ limit: 10 }),
        activitiesApi.getMonthlyAttendanceStats()
      ]);
      
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
      
      if (studentsRes.success && studentsRes.data) {
        setMyStudents(studentsRes.data.filter((s: Student) => s.semester.toString() === semesterFilter));
      }

      if (coursesRes.success && coursesRes.data) {
        setMyCourses(coursesRes.data);
      }

      if (attendanceRes.success && attendanceRes.data) {
        setAttendanceStats(attendanceRes.data);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card 1: My Students */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="h-full flex flex-col hover:border-blue-500/30 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-500" /> My Students
                      </CardTitle>
                      <CardDescription>Students currently enrolled in your classes</CardDescription>
                    </div>
                    <Select 
                      value={semesterFilter} 
                      onChange={(e) => setSemesterFilter(e.target.value)}
                      className="w-[140px] h-9"
                      options={[1, 2, 3, 4, 5, 6, 7, 8].map(sem => ({
                        value: sem.toString(),
                        label: `Semester ${sem}`
                      }))}
                    />
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-4 mt-2">
                      {myStudents.length > 0 ? (
                        myStudents.slice(0, 5).map(student => (
                          <div key={student.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={student.profile_image_url || undefined} alt={student.name} />
                              <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-bold">
                                {student.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{student.name}</p>
                              <p className="text-xs text-muted-foreground">{student.roll_number}</p>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0 bg-background">
                              {student.departments?.code || "CST"}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                          <Users className="h-8 w-8 mb-2 opacity-20" />
                          <p className="text-sm">No students found for this semester.</p>
                        </div>
                      )}
                      {myStudents.length > 5 && (
                        <a href="/dashboard/students" className="block text-center text-xs font-medium text-blue-500 hover:text-blue-600 pt-2">
                          View all {myStudents.length} students
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Card 2: My Active Courses */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="h-full flex flex-col hover:border-emerald-500/30 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-emerald-500" /> My Active Courses
                    </CardTitle>
                    <CardDescription>Detailed overview of courses you manage</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-4 mt-2">
                      {myCourses.length > 0 ? (
                        myCourses.slice(0, 4).map(course => (
                          <div key={course.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                                <BookOpen className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate text-foreground">{course.name}</p>
                                <p className="text-xs text-muted-foreground">{course.code}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                          <BookOpen className="h-8 w-8 mb-2 opacity-20" />
                          <p className="text-sm">No active courses available.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Card 3: Attendance Snapshot */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="h-full hover:border-purple-500/30 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-purple-500" /> Attendance Snapshot
                    </CardTitle>
                    <CardDescription>This week's presence vs. absence per course</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-5 mt-4">
                      {attendanceStats.length > 0 ? (
                        attendanceStats.map(record => {
                          const total = record.present + record.absent;
                          const presentPercent = Math.round((record.present / total) * 100);
                          return (
                            <div key={record.id} className="space-y-2">
                              <div className="flex justify-between items-center text-sm">
                                <span className="font-medium flex items-center gap-1.5 cursor-pointer hover:underline decoration-muted-foreground/30">
                                  {record.course}
                                  {record.alert && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                                </span>
                                <span className="text-muted-foreground text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">
                                  {presentPercent}%
                                </span>
                              </div>
                              <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden flex">
                                <div 
                                  className={`h-full ${record.alert ? 'bg-destructive' : 'bg-purple-500'} transition-all`}
                                  style={{ width: `${presentPercent}%` }}
                                />
                                <div 
                                  className="h-full bg-muted-foreground/20 transition-all"
                                  style={{ width: `${100 - presentPercent}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{record.present} Present</span>
                                <span className={record.alert ? "text-destructive font-medium" : ""}>
                                  {record.absent} Absent
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                          <Clock className="h-8 w-8 mb-2 opacity-20" />
                          <p className="text-sm">No attendance logged this month.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Removed Pending Documents component as requested */}

              {/* Card 5: Recent Students (Kept as requested) */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="lg:col-span-3 md:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Recent Students Focus</CardTitle>
                      <CardDescription>Confirming your latent admissions to the system</CardDescription>
                    </div>
                    <a href="/dashboard/students" className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                      View all <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {stats?.recentStudents && stats.recentStudents.length > 0 ? (
                        stats.recentStudents.slice(0, 6).map((student) => (
                          <div key={student.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors border border-transparent hover:border-border/50">
                            <Avatar className="h-10 w-10 border border-border/50">
                              <AvatarImage src={student.profile_image_url || undefined} alt={student.name} />
                              <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold">
                                {student.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">
                                {student.name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                {student.roll_number}
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-[10px] bg-secondary/50">
                              {new Date(student.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-8 text-center text-muted-foreground">
                          No recent students added.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
