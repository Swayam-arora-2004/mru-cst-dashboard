"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  BrainCircuit, 
  Sparkles, 
  GraduationCap,
  Calendar,
  Award,
  Edit3,
  Clock,
  FileCheck,
  Upload,
  Download,
  X,
  AlertCircle,
  FolderOpen,
  Filter,
  FileText,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Spinner,
  Badge,
  Label,
  Input
} from "@/components/ui";
import { 
  coursesApi, 
  studentsApi, 
  activitiesApi, 
  evaluationsApi, 
  notificationsApi, // Add this
  generalApi, // Correct API
  Student, 
  Course, 
  Activity, 
  Evaluation, 
  Department,
  Class
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getSpecializations } from "@/lib/specializations";

export default function SubmissionsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState<string | null>(null); 
  
  // Academic Filter State
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedYear, setSelectedYear] = useState("1");
  const [selectedSemester, setSelectedSemester] = useState("1");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>("");
  const [debouncedSpecialization, setDebouncedSpecialization] = useState<string>("");
  const [classes, setClasses] = useState<Class[]>([]);
  const [specializations, setSpecializations] = useState<string[]>([]);

  // Selection State
  const [courseId, setCourseId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce Specialization
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSpecialization(selectedSpecialization);
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedSpecialization]);

  // Scoring State
  const [editingEval, setEditingEval] = useState<string | null>(null); 
  const [editForm, setEditForm] = useState<{ marks: number; grade: string }>({
    marks: 0,
    grade: ''
  });

  // Result state
  const [recentEvaluation, setRecentEvaluation] = useState<Evaluation | null>(null);
  const [activityEvaluations, setActivityEvaluations] = useState<Record<string, Evaluation>>({});

  // View State
  const [mode, setMode] = useState<"assignment" | "document">("assignment");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive">("active");
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");
  const bulkFileRef = useRef<HTMLInputElement>(null);

  // 1. Initial Data Fetch
  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const [deptRes, classRes, academicRes] = await Promise.all([
          generalApi.getDepartments(),
          generalApi.getClasses(),
          generalApi.getAcademicInfo()
        ]);
        if (deptRes.success) setDepartments(deptRes.data!);
        if (classRes.success) setClasses(classRes.data!);
        if (academicRes.success && academicRes.data) {
          setSpecializations(academicRes.data.specializations || []);
        }
      } catch (err) {
        toast.error("Failed to load department filters.");
      }
    };
    fetchBaseData();
  }, []);

  const fetchEvaluations = async () => {
    if (!activityId) return;
    try {
      const res = await evaluationsApi.getForActivity(activityId);
      if (res.success && res.data) {
        const evalGroups: Record<string, Evaluation[]> = {};
        res.data.forEach(e => {
          if (!evalGroups[e.student_id]) evalGroups[e.student_id] = [];
          evalGroups[e.student_id].push(e);
        });
        setActivityEvaluations(evalGroups);
      }
    } catch (err) {
      console.error("Failed to load evaluations:", err);
    }
  };

  // 2. Filter-driven data updates & Background Polling
  useEffect(() => {
    const fetchCourses = async () => {
      if (!debouncedSpecialization) {
        setCourses([]);
        setCourseId("");
        return;
      }
      try {
        const res = await coursesApi.getAll({
          department_id: selectedDepartment,
          year: parseInt(selectedYear),
          semester: parseInt(selectedSemester),
          specialization: debouncedSpecialization || undefined
        });
        if (res.success) {
          setCourses(res.data || []);
          if (res.data?.length && !courseId) setCourseId(res.data[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCourses();
  }, [selectedDepartment, selectedYear, selectedSemester, debouncedSpecialization]);

  useEffect(() => {
    fetchEvaluations();
    
    // 🕵️ BACKGROUND POLLING: 
    // If we're on the Submissions Page, refresh every 10s to see background grading progress
    const pollInterval = setInterval(() => {
      fetchEvaluations();
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [activityId]);
  
  // Clear course selection when switching modes to prevent lingering filters
  useEffect(() => {
    if (mode === 'document') {
      setCourseId("");
    }
  }, [mode]);

  useEffect(() => {
    const fetchFilteredActivities = async () => {
      if (!debouncedSpecialization) {
        setActivities([]);
        setActivityId("");
        return;
      }
      try {
        const res = await activitiesApi.getAll({
          course_id: mode === 'assignment' ? (courseId || undefined) : undefined,
          year: selectedYear,
          semester: selectedSemester,
          class_id: selectedClass || undefined,
          specialization: debouncedSpecialization || undefined,
          type: mode
        });
        if (res.success) {
          setActivities(res.data || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchFilteredActivities();
  }, [mode, courseId, selectedYear, selectedSemester, selectedClass, debouncedSpecialization]);

  // 🔔 [NOTIFICATION DIAGNOSTICS]
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js')
        .then(async (registration) => {
          console.log('SW Registered:', registration.scope);
          
          // Check for existing permission
          if (Notification.permission === 'default') {
             const permission = await Notification.requestPermission();
             if (permission !== 'granted') return;
          }

          try {
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: 'BF7X_R5G6nU6uNoD0ZqVp8r7uK6Y-g3B8p9k2n' // Sample VAPID
            });
            await notificationsApi.subscribe(subscription);
          } catch (e) {
            console.warn('Push subscription failed:', e);
          }
        });
    }
  }, []);

  useEffect(() => {
    const fetchStudents = async () => {
      const isFilterComplete = selectedDepartment && selectedYear && selectedSemester && selectedClass && debouncedSpecialization;
      if (!isFilterComplete) {
        setStudents([]);
        return;
      }
      setIsLoading(true);
      try {
        const res = await studentsApi.getAll({
          department_id: selectedDepartment,
          year: parseInt(selectedYear),
          semester: parseInt(selectedSemester),
          class_id: selectedClass,
          specialization: debouncedSpecialization || undefined,
          limit: 100 // Boosted limit to show full roster of 37+ students
        });
        if (res.success) setStudents(res.data || []);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
  }, [selectedDepartment, selectedYear, selectedSemester, selectedClass, debouncedSpecialization]);

  useEffect(() => {
    if (activityId) {
      fetchActivityEvaluations(activityId);
    } else {
      setActivityEvaluations({});
    }
  }, [activityId]);

  const [activityEvaluations, setActivityEvaluations] = useState<Record<string, Evaluation[]>>({});
...
  const fetchActivityEvaluations = async (id: string) => {
    try {
      const res = await evaluationsApi.getForActivity(id);
      if (res.success && res.data) {
        // Group evaluations by Student ID (History/Portfolio Support)
        const evalGroups: Record<string, Evaluation[]> = {};
        res.data.forEach(e => {
          if (!evalGroups[e.student_id]) evalGroups[e.student_id] = [];
          evalGroups[e.student_id].push(e);
        });
        setActivityEvaluations(evalGroups);
      }
    } catch (err) {
      console.error("Failed to fetch activity evaluations:", err);
    }
  };

  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      const isCorrectType = a.type === mode;
      if (!isCorrectType) return false;
      
      if (a.year && a.year !== parseInt(selectedYear)) return false;
      if (a.semester && a.semester !== parseInt(selectedSemester)) return false;
      if (a.class_id && a.class_id !== selectedClass) return false;
      if (a.specialization && 
          debouncedSpecialization !== "General" && 
          a.specialization !== "General" && 
          a.specialization !== debouncedSpecialization) return false;

      if (mode === 'assignment' && courseId && a.course_id !== courseId) return false;
      
      if (!a.due_date) return statusFilter === 'active';
      const isPast = new Date(a.due_date) < new Date();
      return statusFilter === 'active' ? !isPast : isPast;
    });
  }, [activities, mode, selectedYear, selectedSemester, selectedClass, debouncedSpecialization, courseId, statusFilter]);

  const currentActivity = useMemo(() => {
    return filteredActivities.find(a => a.id === activityId) || filteredActivities[0];
  }, [filteredActivities, activityId]);

  useEffect(() => {
    if (filteredActivities.length > 0) {
      setActivityId(filteredActivities[0].id);
    } else {
      setActivityId("");
    }
  }, [mode, statusFilter, filteredActivities.length]);

  const handleRetryAI = async (evaluationId: string, studentId: string) => {
    setIsEvaluating(studentId);
    try {
      const res = await evaluationsApi.retry!(evaluationId);
      if (res.success && res.data) {
        setActivityEvaluations(prev => ({
          ...prev,
          [studentId]: res.data!
        }));
        toast.success(res.message || "AI re-evaluation completed.");
      }
    } catch (err: any) {
      toast.error(err.message || "AI retry failed.");
    } finally {
      setIsEvaluating(null);
    }
  };

  const handleFileUpload = async (studentId: string, file: File) => {
    if (!activityId || !currentActivity) {
      toast.error("Please select an activity first.");
      return;
    }

    if (!file) {
      toast.error("Please select a file to upload.");
      return;
    }

    setIsEvaluating(studentId);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("student_id", studentId);
    formData.append("activity_id", activityId);
    formData.append("type", mode);

    try {
      const res = await evaluationsApi.evaluate(formData);
      if (res.success) {
        const isPending = res.data?.grade === 'AI_PENDING';
        if (isPending) {
          toast.warning("Submission Archived", { description: "File saved, but AI is currently at capacity. Please grade manually." });
        } else {
          const successMsg = res.message || (mode === 'assignment' ? "AI Grading Complete" : "Submission Recorded");
          toast.success(successMsg);
        }
        if (res.data) {
          setRecentEvaluation(res.data);
          setActivityEvaluations(prev => {
            const studentEvals = prev[studentId] || [];
            return { ...prev, [studentId]: [res.data!, ...studentEvals] };
          });
        }
      } else {
        throw res;
      }
    } catch (err: any) {
      // 🔍 Comprehensive Diagnostic Logging
      const isApiError = err?.name === 'ApiError';
      const status = err.status || 500;
      const errorMsg = err.error || err.message || "Submission pipeline failed";
      const details = err.details || (isApiError ? err.message : null) || "No detailed logs available";
      const hint = err.hint || "";
      const code = err.code || "";

      console.error("Submission Failure Diagnostic:", {
        status,
        error: errorMsg,
        details,
        hint,
        code
      });

      toast.error(errorMsg, { 
        description: `${details}${hint ? `\nHint: ${hint}` : ""}${code ? ` (Code: ${code})` : ""}`,
        duration: 12000 
      });
    } finally {
      setIsEvaluating(null);
    }
  };

  const deleteSubmission = async (evaluationId: string, studentId: string) => {
    if (!confirm("Are you sure you want to delete this submission?")) return;
    try {
      const res = await evaluationsApi.delete(evaluationId);
      if (res.success) {
        toast.success("Submission deleted successfully");
        setActivityEvaluations(prev => {
          const next = { ...prev };
          delete next[studentId];
          return next;
        });
        if (recentEvaluation?.id === evaluationId) setRecentEvaluation(null);
      }
    } catch (err) {
      toast.error("Failed to delete submission");
    }
  };

  const handleBulkUpload = async (files: FileList) => {
    if (!activityId || !currentActivity) return;
    setIsBulkUploading(true);
    const filesArray = Array.from(files);
    let matchedCount = 0;

    // Filter files that match a student
    const tasks = filesArray.map(file => {
      const roll = file.name.split('.')[0];
      const student = students.find(s => s.roll_number === roll);
      return student ? { studentId: student.id, file } : null;
    }).filter(t => t !== null) as { studentId: string, file: File }[];

    // Process in batches of 5 — Much faster now because backend returns immediately
    const batchSize = 5;
    const batchCount = Math.ceil(tasks.length / batchSize);
    
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      
      toast.info(`Uploading Batch ${Math.floor(i / batchSize) + 1} of ${batchCount}...`, {
        description: `Archiving submissions for ${batch.length} students.`,
      });

      // We wait for the ARCHIVE (Step 1) to finish, but NOT the AI.
      await Promise.all(batch.map(t => handleFileUpload(t.studentId, t.file)));
      matchedCount += batch.length;
    }

    setIsBulkUploading(false);
    toast.success(`Bulk processing complete: ${matchedCount} matched.`);
  };

  const handleUpdateDeadline = async () => {
    if (!activityId || !newDeadline) return;
    try {
      const isoDate = new Date(newDeadline).toISOString();
      const res = await activitiesApi.update(activityId, { due_date: isoDate });
      if (res.success) {
        toast.success("Deadline updated successfully.");
        // Refresh local activity state
        setActivities(prev => prev.map(a => a.id === activityId ? { ...a, due_date: isoDate } : a));
        setIsEditingDeadline(false);
      } else {
        toast.error(res.error || "Update failed.");
      }
    } catch (err) {
      toast.error("Invalid date format.");
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.roll_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <Header
        title="Submissions Matrix"
        description="Dual-track grading for academic assignments and administrative compliance."
      />

      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Filter Sidebar */}
          <div className="xl:col-span-4 space-y-6">
            <Card className="border-border/50 shadow-none hover:border-blue-500/20 transition-all">
              <CardHeader className="pb-6 border-b border-border/10">
                <CardTitle className="text-lg flex flex-col gap-4 font-bold text-foreground">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-blue-600" /> Activity Filters
                    </div>
                    <div className="flex bg-secondary/50 p-1 rounded-xl">
                      <button onClick={() => setMode('assignment')} className={cn("px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all", mode === 'assignment' ? "bg-blue-600 text-white" : "text-muted-foreground")}>Assgn</button>
                      <button onClick={() => setMode('document')} className={cn("px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all", mode === 'document' ? "bg-emerald-600 text-white" : "text-muted-foreground")}>Doc</button>
                    </div>
                  </div>
                  
                  {/* Active/Inactive Toggle - Restored */}
                  <div className="grid grid-cols-2 p-1 bg-secondary/30 rounded-xl">
                    <button 
                      onClick={() => setStatusFilter('active')} 
                      className={cn("flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase rounded-lg transition-all", 
                        statusFilter === 'active' ? "bg-card text-blue-600 shadow-sm" : "text-muted-foreground")}
                    >
                      <Sparkles className="w-3 h-3" /> Active
                    </button>
                    <button 
                      onClick={() => setStatusFilter('inactive')} 
                      className={cn("flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase rounded-lg transition-all", 
                        statusFilter === 'inactive' ? "bg-card text-muted-foreground shadow-sm" : "opacity-50")}
                    >
                      <Clock className="w-3 h-3" /> Inactive
                    </button>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-6 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Year</Label>
                    <select className="ui-select" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                      {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Semester</Label>
                    <select className="ui-select" value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}>
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Department</Label>
                  <select className="ui-select" value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)}>
                    <option value="">Select Dept</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Section</Label>
                  <select className="ui-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Specialization</Label>
                    <select 
                      className="ui-select" 
                      value={selectedSpecialization} 
                      onChange={(e) => setSelectedSpecialization(e.target.value)}
                    >
                      <option value="">Select Specialization</option>
                      {getSpecializations(departments.find(d => d.id === selectedDepartment)?.name || '').map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                <hr className="border-border/30" />

                {mode === 'assignment' && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Academic Course</Label>
                    <select className="ui-select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                      <option value="">Select Academic Course</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Topic</Label>
                  <select className="ui-select" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
                    <option value="">Select Topic</option>
                    {filteredActivities.length > 0 ? (
                      filteredActivities.map(a => <option key={a.id} value={a.id}>{a.title}</option>)
                    ) : <option value="">No {statusFilter} {mode}s</option>}
                  </select>
                </div>

                {/* ✨ NEW: Activity Metadata & Download */}
                {currentActivity && (
                  <div className="p-4 bg-secondary/20 rounded-2xl border border-border/50 space-y-4 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 flex-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Due Date & Status</p>
                        {isEditingDeadline ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Input 
                              type="datetime-local" 
                              className="h-8 text-[10px] font-bold" 
                              value={newDeadline}
                              onChange={(e) => setNewDeadline(e.target.value)}
                            />
                            <button onClick={handleUpdateDeadline} className="p-1 bg-blue-600 text-white rounded-md"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setIsEditingDeadline(false)} className="p-1 bg-secondary text-foreground rounded-md"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <p className="text-xs font-bold text-foreground">
                              {currentActivity.due_date ? new Date(currentActivity.due_date).toLocaleString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                                timeZone: 'Asia/Kolkata'
                              }) : 'No deadline'}
                            </p>
                            <button 
                              onClick={() => {
                                setIsEditingDeadline(true);
                                if (currentActivity.due_date) {
                                  // Convert to IST offset string for datetime-local input
                                  const date = new Date(currentActivity.due_date);
                                  const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
                                  setNewDeadline(istDate.toISOString().slice(0, 16));
                                } else {
                                  setNewDeadline("");
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-50 text-blue-600 rounded transition-all"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      {mode === 'assignment' && (
                        <div className="text-right space-y-0.5">
                           <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Max Marks</p>
                           <p className="text-xs font-black text-blue-600">{currentActivity.max_marks || 100}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Roster Area */}
          <div className="xl:col-span-8">
             <Card className="border-border/50 shadow-none min-h-[600px]">
                <CardHeader className="flex flex-col md:flex-row items-center justify-between border-b border-border/10 gap-4">
                  <div>
                    <CardTitle className="text-xl font-black uppercase tracking-tight">Submission Data</CardTitle>
                    <CardDescription>{filteredStudents.length} Students in selected section</CardDescription>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                      onClick={() => bulkFileRef.current?.click()}
                      disabled={isBulkUploading || !activityId || statusFilter === 'inactive'}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800 transition-all hover:bg-blue-600 hover:text-white disabled:opacity-50",
                        isBulkUploading && "animate-pulse"
                      )}
                    >
                      {isBulkUploading ? <Spinner size="sm" /> : <FolderOpen className="w-3.5 h-3.5" />}
                      {isBulkUploading ? "Processing..." : "Bulk Upload Folder"}
                    </button>
                    {/* Hidden Folder Input */}
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={bulkFileRef}
                      onChange={(e) => e.target.files && handleBulkUpload(e.target.files)}
                      {...{ webkitdirectory: "", directory: "" } as any}
                    />
                    
                    <div className="relative flex-1 md:flex-none">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="text" placeholder="Search student..." className="h-10 w-full md:w-64 rounded-xl border border-border bg-secondary/30 pl-10 pr-4 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full">
                       <thead className="bg-secondary/40 text-[10px] uppercase font-black text-muted-foreground">
                          <tr>
                            <th className="px-6 py-5">Identity</th>
                            <th className="px-6 py-5">Status</th>
                            <th className="px-6 py-5 text-right">Action</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-border/30">
                          {filteredStudents.map(student => {
                             const ev = activityEvaluations[student.id];
                             return (
                               <tr key={student.id} className="hover:bg-secondary/20 transition-colors">
                                  <td className="px-6 py-5 flex items-center gap-3">
                                    <Avatar size="sm">
                                      <AvatarImage src={(student as any).profile_image_url} />
                                      <AvatarFallback>{student.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                       <span className="text-sm font-black text-foreground uppercase">{student.name}</span>
                                       <span className="text-[9px] font-bold text-muted-foreground/50">{student.roll_number}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-5">
                                    {(activityEvaluations[student.id]?.length || 0) > 0 ? (() => {
                                      const evList = activityEvaluations[student.id];
                                      // Latest is at the top/index 0
                                      const ev = evList[0];
                                      const hasMultiple = evList.length > 1;

                                      return mode === 'document' ? (
                                        <div className="flex items-center gap-2">
                                          <Badge className="bg-emerald-500 text-white font-black text-[9px] uppercase tracking-widest border-2 border-emerald-200">
                                            {hasMultiple ? `${evList.length} Files` : 'Submitted'}
                                          </Badge>
                                          <span className="text-xs font-black text-emerald-600">✓ Verified</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-2">
                                          {ev.grade === 'AI_PENDING' ? (
                                            <Badge className="bg-amber-500 text-white font-black text-[9px] uppercase tracking-widest">AI Pending</Badge>
                                          ) : ev.source === 'system' ? (
                                            <Badge className="bg-indigo-600 text-white font-black text-[9px] uppercase tracking-widest border-2 border-indigo-200">Estimated</Badge>
                                          ) : (
                                            <Badge className="bg-emerald-500 text-white font-black text-[9px] uppercase tracking-widest">
                                              {hasMultiple ? `Latest: ${ev.grade}` : 'AI Graded'}
                                            </Badge>
                                          )}
                                          <div className="flex flex-col">
                                            <span className="text-xs font-black text-foreground">
                                              {ev.grade === 'AI_PENDING' ? 'Manual Grade Req.' : `Score: ${ev.marks_attained}`}
                                            </span>
                                            {hasMultiple && (
                                              <span className="text-[8px] font-bold text-indigo-600 uppercase">
                                                +{evList.length - 1} More Submissions
                                              </span>
                                            )}
                                          </div>
                                          
                                          {ev.source === 'system' && (
                                            <div className="ml-auto flex items-center gap-1.5">
                                              <button 
                                                onClick={() => handleRetryAI(ev.id, student.id)}
                                                disabled={isEvaluating === student.id}
                                                className="p-1.5 hover:bg-emerald-50 rounded-full text-emerald-600 transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                                                title="Retry AI Evaluation"
                                              >
                                                {isEvaluating === student.id ? (
                                                  <Spinner size="sm" className="text-emerald-600" />
                                                ) : (
                                                  <RefreshCw className="w-3.5 h-3.5" />
                                                )}
                                              </button>
                                              <label 
                                                htmlFor={`re-upload-${student.id}`}
                                                className="p-1.5 hover:bg-indigo-50 rounded-full text-indigo-600 transition-colors cursor-pointer"
                                                title="Manual Re-Upload"
                                              >
                                                <Upload className="w-3.5 h-3.5" />
                                              </label>
                                              <input 
                                                id={`re-upload-${student.id}`}
                                                type="file" 
                                                className="hidden" 
                                                onChange={(e) => e.target.files?.[0] && handleFileUpload(student.id, e.target.files[0])}
                                              />
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })() : (
                                      statusFilter === 'active' ? (
                                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 border-dashed">No Submission</Badge>
                                      ) : (
                                        <div className="flex items-center gap-2 text-rose-500">
                                          <X className="w-3 h-3" />
                                          <span className="text-[10px] font-black uppercase tracking-widest">Missed</span>
                                        </div>
                                      )
                                    )}
                                  </td>
                                  <td className="px-6 py-5 text-right">
                                    {activityEvaluations[student.id]?.length > 0 ? (() => {
                                      const ev = activityEvaluations[student.id][0];
                                      return (
                                        <div className="flex items-center justify-end gap-2">
                                           <a href={ev.file_name} target="_blank" className="p-2 bg-secondary/50 rounded-lg hover:bg-blue-600 hover:text-white transition-all" title="Download Latest Submission"><Download className="w-4 h-4" /></a>
                                           {statusFilter === 'active' && (
                                             <button onClick={() => deleteSubmission(ev.id, student.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all"><X className="w-4 h-4" /></button>
                                           )}
                                        </div>
                                      );
                                    })() : (
                                      statusFilter === 'active' ? (
                                        <label className="text-blue-600 font-black text-[10px] uppercase cursor-pointer hover:underline">
                                           Upload <input type="file" className="hidden" onChange={(e) => e.target.files && handleFileUpload(student.id, e.target.files[0])} />
                                        </label>
                                      ) : (
                                        <span className="text-[9px] font-bold text-muted-foreground/30 uppercase italic">Locked</span>
                                      )
                                    )}
                                  </td>
                               </tr>
                             )
                          })}
                       </tbody>
                    </table>
                </CardContent>
             </Card>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .ui-select {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background-color: white;
          font-size: 14px;
          font-weight: 700;
          appearance: none;
        }
        .dark .ui-select {
          background-color: #1e1e1e;
          border-color: #333;
        }
      `}</style>
    </div>
  );
}
