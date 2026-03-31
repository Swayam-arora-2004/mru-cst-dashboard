"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar as CalendarIcon, 
  Search, 
  Users, 
  CheckCircle, 
  XCircle, 
  Filter,
  ArrowLeft,
  ChevronRight,
  Clock
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Spinner,
  Badge,
  Label,
  Input
} from "@/components/ui";
import { toast } from "sonner";
import { 
  activitiesApi, 
  coursesApi,
  Course
} from "@/lib/api";
import Link from "next/link";

export default function AttendanceHistoryPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [selectedDate, selectedCourseId]);

  const fetchInitialData = async () => {
    try {
      const coursesRes = await coursesApi.getAll({ limit: 50 });
      if (coursesRes.success && coursesRes.data) {
        setCourses(coursesRes.data);
      }
    } catch (err) {
      console.error("Failed to load courses:", err);
    }
  };

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await activitiesApi.getAttendanceHistory(
        selectedDate, 
        selectedCourseId === "all" ? undefined : selectedCourseId
      );
      if (res.success && res.data) {
        setSessions(res.data);
      }
    } catch (err) {
      toast.error("Failed to load attendance history.");
    } finally {
      setIsLoading(false);
    }
  };

  // Flatten sessions into a searchable student list for the selected date
  const allRecords = useMemo(() => {
    const flatRecords: any[] = [];
    sessions.forEach(session => {
      if (session.attendance_records) {
        session.attendance_records.forEach((record: any) => {
          flatRecords.push({
            ...record,
            courseName: session.courses?.name,
            courseCode: session.courses?.code,
            timeRange: session.time_range,
            studentName: record.students?.name,
            studentRoll: record.students?.roll_number,
            studentAvatar: record.students?.profile_image_url
          });
        });
      }
    });
    return flatRecords;
  }, [sessions]);

  const filteredRecords = allRecords.filter(r => 
    r.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.studentRoll?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = useMemo(() => {
    const present = allRecords.filter(r => r.status === 'present').length;
    const absent = allRecords.filter(r => r.status === 'absent').length;
    const total = allRecords.length;
    return { present, absent, total, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
  }, [allRecords]);

  return (
    <div className="min-h-screen pb-20">
      <Header
        title="Attendance Ledger"
        description="Review student presence and absence logs by date and course."
      />

      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        
        {/* Top Control Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-4 lg:col-span-3">
             <div className="relative group">
                <CalendarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 z-10" />
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-11 h-12 font-bold border-border/50 bg-card rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500/10 transition-all"
                />
             </div>
          </div>
          
          <div className="md:col-span-4 lg:col-span-4">
             <div className="relative group">
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 z-10" />
                <select 
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full pl-11 pr-4 h-12 rounded-xl border border-border/50 bg-card text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all appearance-none"
                >
                  <option value="all">All Active Courses</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.code} - {course.name}
                    </option>
                  ))}
                </select>
             </div>
          </div>

          <div className="md:col-span-4 lg:col-span-5">
             <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by Name or Roll Number..."
                  className="h-12 w-full rounded-xl border border-border/50 bg-card pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
          </div>
        </div>

        {/* Dynamic Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           {[
             { label: 'Present Students', value: stats.present, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
             { label: 'Absent Students', value: stats.absent, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
             { label: 'Avg Presence', value: `${stats.percentage}%`, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
             { label: 'Total Logs', value: stats.total, icon: Clock, color: 'text-purple-500', bg: 'bg-purple-500/10' }
           ].map((stat, i) => (
             <Card key={i} className="border-border/40 shadow-none hover:border-blue-500/20 transition-all overflow-hidden group">
               <CardContent className="p-4 flex items-center justify-between">
                 <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{stat.label}</p>
                   <p className="text-2xl font-black mt-0.5">{stat.value}</p>
                 </div>
                 <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                   <stat.icon className="w-5 h-5" />
                 </div>
               </CardContent>
             </Card>
           ))}
        </div>

        {/* Ledger Grid */}
        <div>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Spinner size="lg" />
              <p className="text-xs text-muted-foreground mt-4 font-bold uppercase tracking-widest">Querying History Matrix...</p>
            </div>
          ) : filteredRecords.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredRecords.map((record, idx) => (
                  <motion.div
                    key={`${record.id}-${idx}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.02 }}
                  >
                    <Card className={`border-border/40 shadow-none hover:shadow-lg hover:shadow-blue-500/5 transition-all h-full ${record.status === 'absent' ? 'border-red-500/20 bg-red-50/10' : ''}`}>
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-white dark:border-zinc-800 shadow-sm">
                              <AvatarImage src={record.studentAvatar} />
                              <AvatarFallback className="bg-blue-100 text-blue-700 font-black text-xs uppercase">
                                {record.studentName?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                               <p className="font-bold text-sm leading-tight">{record.studentName}</p>
                               <p className="text-[10px] font-mono font-black text-muted-foreground uppercase">{record.studentRoll}</p>
                            </div>
                          </div>
                          <Badge 
                            className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter border-none ${
                              record.status === 'present' 
                                ? 'bg-emerald-500 text-white' 
                                : 'bg-red-600 text-white'
                            }`}
                          >
                            {record.status}
                          </Badge>
                        </div>

                        <div className="mt-auto pt-4 border-t border-border/10">
                           <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                 <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Course Context</p>
                                 <p className="text-[11px] font-bold text-foreground truncate max-w-[150px]">
                                   {record.courseCode} - {record.courseName}
                                 </p>
                              </div>
                              <div className="text-right">
                                 <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest leading-none">Time Range</p>
                                 <p className="text-[10px] font-bold mt-0.5">{record.timeRange || '--:--'}</p>
                              </div>
                           </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
               <div className="p-6 bg-secondary/30 rounded-full mb-6">
                 <CalendarIcon className="w-12 h-12 text-muted-foreground opacity-20" />
               </div>
               <h3 className="text-xl font-black uppercase tracking-tight text-foreground">No Logs Detected</h3>
               <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                 We couldn't find any attendance logs for the selected date and filters.
                 Try picking another date or check your course settings.
               </p>
               <Link href="/dashboard/activities">
                 <button className="mt-8 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-black transition-all flex items-center gap-2">
                   <Users className="w-4 h-4" /> Log New Attendance
                 </button>
               </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
