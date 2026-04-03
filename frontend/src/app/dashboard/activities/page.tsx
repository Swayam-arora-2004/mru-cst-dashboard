"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  Save,
  Clock,
  Users,
  AlertCircle,
  Search,
  FileUp,
  Award,
  Calendar,
  ChevronRight
} from "lucide-react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Spinner,
  Badge,
  Label,
  Input
} from "@/components/ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  studentsApi,
  coursesApi,
  generalApi,
  activitiesApi,
  Student,
  Course,
  ActivityRecord,
  Department,
  ClassInfo,
} from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { getSpecializations } from "@/lib/specializations";

const TIME_SLOTS = [
  { label: "09:00 AM - 10:00 AM", start: "09:00", end: "10:00" },
  { label: "10:00 AM - 11:00 AM", start: "10:00", end: "11:00" },
  { label: "11:00 AM - 12:00 PM", start: "11:00", end: "12:00" },
  { label: "12:00 PM - 01:00 PM", start: "12:00", end: "13:00" },
  { label: "01:30 PM - 02:30 PM", start: "13:30", end: "14:30" },
  { label: "02:30 PM - 03:30 PM", start: "14:30", end: "15:30" },
  { label: "03:30 PM - 04:30 PM", start: "15:30", end: "16:30" },
  { label: "Custom Range", start: "custom", end: "custom" },
];


export default function ActivitiesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { isAuthenticated, isHydrated } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");

  // Form State
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"attendance" | "assignment" | "document">("attendance");
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [maxMarks, setMaxMarks] = useState<number>(100);
  const [dueDate, setDueDate] = useState("");
  const [duration, setDuration] = useState<number>(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [selectedSlot, setSelectedSlot] = useState(TIME_SLOTS[0].label);
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [specialization, setSpecialization] = useState("");

  // Admin Tracking State (for Documents)
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  // Checklist State Map: student_id -> status boolean (true = present/submitted)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  // Recent Activities Ledger
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);


  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      fetchBaseData();
    }
  }, [isHydrated, isAuthenticated]);


  const fetchBaseData = async () => {
    setIsLoading(true);
    try {
      const deptsRes = await generalApi.getDepartments();
      if (deptsRes.success && deptsRes.data) {
        setDepartments(deptsRes.data);
      }
    } catch (err: any) {
      console.error("Fetch base data error:", err);
      toast.error(`Loading error: ${err.message || "Failed to load tracking data."}`);
    } finally {
      setIsLoading(false);
    }
  };


  // 1. Fetch Classes when Department/Year/Semester changes
  // Reset semester if year changes and current semester becomes invalid
  useEffect(() => {
    if (selectedYear) {
      const yearInt = parseInt(selectedYear);
      const minSem = (yearInt * 2) - 1;
      const maxSem = yearInt * 2;
      const currentSemInt = parseInt(selectedSemester);
      
      if (selectedSemester && (currentSemInt < minSem || currentSemInt > maxSem)) {
        setSelectedSemester("");
      }
    }
  }, [selectedYear]);

  // 1. Fetch Classes (Universal) on component mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await generalApi.getClasses({});
        if (res.success && res.data) {
          const sortedClasses = [...res.data].sort((a, b) => a.name.localeCompare(b.name));
          setClasses(sortedClasses);
          
          // Auto-select first class if none selected and data exists
          if (sortedClasses.length > 0 && !selectedClass) {
            setSelectedClass(sortedClasses[0].id);
          }
        }
      } catch (err) {
        console.error("Fetch classes error:", err);
      }
    };

    fetchClasses();
  }, []); // Run once on mount to establish the universal class list // Re-run to ensure virtual IDs stay relevant to current selection context if needed

  // 2. Fetch Courses when Department/Semester/Year changes
  useEffect(() => {
    const fetchCourses = async () => {
      if (!selectedDepartment || !selectedSemester || !selectedYear) {
        setCourses([]);
        setCourseId("");
        return;
      }

      try {
        const res = await coursesApi.getAll({
          department_id: selectedDepartment,
          year: parseInt(selectedYear),
          semester: parseInt(selectedSemester),
          specialization: specialization || undefined,
          limit: 100
        });
        if (res.success && res.data) {
          setCourses(res.data);
          if (res.data.length > 0 && !courseId) {
            setCourseId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error("Fetch courses error:", err);
      }
    };

    fetchCourses();
  }, [selectedDepartment, selectedSemester, selectedYear, specialization]);

  // 3. Fetch Students when all filters are complete (Only for Attendance)
  const isFilterComplete = !!(selectedDepartment && selectedYear && selectedSemester && selectedClass && specialization);
  const isSubmissionReady = isFilterComplete && (type === 'document' || courseId);

  useEffect(() => {
    const fetchStudents = async () => {
      // Fetch students when academic period and class are set, regardless of course selection
      if (!isFilterComplete || type !== 'attendance') {
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
          specialization: specialization || undefined,
          limit: 100
        });

        if (res.success && res.data) {
          setStudents(res.data);
          const initMap: Record<string, boolean> = {};
          res.data.forEach(s => {
            initMap[s.id] = true;
          });
          setChecklist(initMap);
        }
      } catch (err) {
        console.error("Fetch students error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudents();
  }, [isFilterComplete, type, selectedDepartment, selectedYear, selectedSemester, selectedClass, specialization]);

  useEffect(() => {
    const course = courses.find((c: any) => c.id === courseId);
    if (course) {
      if (course.type === 'lecture') setDuration(1);
      else if (course.type === 'lab') setDuration(2);
    }
  }, [courseId, courses]);

  const toggleStudent = (id: string) => {
    setChecklist((prev: any) => ({ ...prev, [id]: !prev[id] }));
  };


  const handleSave = async () => {

    // Only require manual title for assignments and documents
    if (type !== 'attendance' && !title) {
      toast.error("Please enter a title for this activity.");
      return;
    }

    if (!courseId && type !== 'document') {
      toast.error("Please select a target course.");
      return;
    }

    if (type === 'document' && (!selectedDepartment || !selectedClass)) {
      toast.error("Please select department and class for this document.");
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", type === 'attendance' ? `Attendance - ${date}` : title);
      formData.append("type", type);
      formData.append("date", date);
      formData.append("department_id", selectedDepartment);
      formData.append("year", selectedYear);
      formData.append("semester", selectedSemester);
      formData.append("class_id", selectedClass);
      formData.append("specialization", specialization);

      if (type !== 'document') {
        formData.append("course_id", courseId);
      }

      if (type === 'attendance') {
        const records: ActivityRecord[] = students.map(s => ({
          student_id: s.id,
          status: checklist[s.id] ? 'present' : 'absent'
        }));
        formData.append("records", JSON.stringify(records));
        formData.append("time_range", `${startTime} - ${endTime}`);
      } else {
        // Assignments and Documents no longer pre-populate the roster
        formData.append("records", JSON.stringify([]));
      }

      if (type === 'assignment') {
        formData.append("max_marks", maxMarks.toString());
      }

      if (type !== 'attendance' && dueDate) {
        // Convert local datetime-local string to ISO UTC for database consistency
        try {
          const isoDate = new Date(dueDate).toISOString();
          formData.append("due_date", isoDate);
        } catch (e) {
          formData.append("due_date", dueDate);
        }
      }

      if (questionFile) {
        formData.append("questionFile", questionFile);
      }

      const res = await activitiesApi.create(formData);
      if (res.success) {
        toast.success("Activity records saved safely!");
        setTitle("");
        setQuestionFile(null);
      } else {
        toast.error(res.error || "Failed to commit records to database.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred during commit.");
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-update administrative metadata when a course is selected
  // (Optional: keep this for convenience if course changes first)
  useEffect(() => {
    if (courseId && courses.length > 0) {
      const course = courses.find(c => c.id === courseId);
      if (course) {
        if (course.department_id && !selectedDepartment) setSelectedDepartment(course.department_id);
        if (course.semester && !selectedSemester) setSelectedSemester(course.semester.toString());
      }
    }
  }, [courseId, courses, selectedDepartment, selectedSemester]);

  const filteredStudents = students.filter(s => {
    // Basic search filtering
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Class filtering for Attendance (and as a baseline for other types if roster is shown)
    if (selectedClass && s.class_id !== selectedClass) return false;

    return true;
  });

  const getStatusColors = () => {
    if (type === 'attendance') return {
      true: 'Present',
      false: 'Absent',
      trueColor: 'text-black bg-emerald-400 border-emerald-500 shadow-sm shadow-emerald-400/20',
      falseColor: 'text-white bg-red-600 border-red-700 shadow-sm shadow-red-600/20'
    };
    if (type === 'assignment') return {
      true: 'Submitted',
      false: 'Missing',
      trueColor: 'text-black bg-blue-400 border-blue-500 shadow-sm shadow-blue-400/20',
      falseColor: 'text-white bg-zinc-600 border-zinc-700 shadow-sm shadow-zinc-600/20'
    };
    return {
      true: 'Verified',
      false: 'Pending',
      trueColor: 'text-black bg-amber-400 border-amber-500 shadow-sm shadow-amber-400/20',
      falseColor: 'text-white bg-zinc-600 border-zinc-700 shadow-sm shadow-zinc-600/20'
    };
  };
  const labels = getStatusColors();

  if (isLoading) return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>;

  return (
    <div className="min-h-screen">
      <Header
        title="Activities Tracker"
        description="Unified interface for mapping attendance, assignments, and document compliance."
      />

      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        <div className={`grid grid-cols-1 ${type === 'attendance' ? 'lg:grid-cols-12' : 'max-w-3xl mx-auto'} gap-8`}>

          {/* Configuration Sidebar */}
          <div className={type === 'attendance' ? 'lg:col-span-4' : 'w-full'}>
            <Card className="border-border/50 hover:border-blue-500/20 transition-all shadow-none h-fit lg:sticky lg:top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2 font-bold">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  Activity Setup
                </CardTitle>
                <CardDescription>Target course and specific log metadata</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">

                <div className="space-y-4">
                  <div className="p-3 bg-secondary/30 rounded-xl space-y-3 border border-border/50">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Department</Label>
                          <select
                            className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-bold"
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                          >
                            <option value="">Select Department</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Year</Label>
                          <select
                            className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-bold text-center"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                          >
                            <option value="">Year</option>
                            {[1, 2, 3, 4].map(y => <option key={y} value={y.toString()}>{y}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Semester</Label>
                          <select
                            className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-bold text-center"
                            value={selectedSemester}
                            onChange={(e) => setSelectedSemester(e.target.value)}
                            disabled={!selectedYear}
                          >
                            <option value="">Sem</option>
                            {selectedYear ? (
                              <>
                                <option value={(parseInt(selectedYear) * 2 - 1).toString()}>
                                  {(parseInt(selectedYear) * 2 - 1)}
                                </option>
                                <option value={(parseInt(selectedYear) * 2).toString()}>
                                  {(parseInt(selectedYear) * 2)}
                                </option>
                              </>
                            ) : (
                              [1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s.toString()}>{s}</option>)
                            )}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Section/Class</Label>
                        <select
                          className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-bold"
                          value={selectedClass}
                          onChange={(e) => setSelectedClass(e.target.value)}
                        >
                          <option value="">Select Class/Section</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Specialization</Label>
                        <select
                          className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-bold"
                          value={specialization}
                          onChange={(e) => setSpecialization(e.target.value)}
                        >
                          <option value="">Select Specialization</option>
                          {getSpecializations(departments.find(d => d.id === selectedDepartment)?.name || '').map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      {type !== 'document' && (
                        <div className="space-y-2 pt-2 border-t border-border/10">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Target Course</Label>
                          <select
                            className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-bold"
                            value={courseId}
                            onChange={(e) => setCourseId(e.target.value)}
                          >
                            <option value="">Select Course</option>
                            {courses.map(c => {
                              const matchesSpec = !specialization || specialization === 'General' || c.specialization === specialization;
                              return matchesSpec ? <option key={c.id} value={c.id}>{c.code} - {c.name}</option> : null;
                            })}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {type !== 'attendance' && (
                    <div className="space-y-2 px-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                        {type === 'assignment' ? 'Assignment Descriptor' : 'Document Title'}
                      </Label>
                      <Input
                        placeholder={type === 'assignment' ? "e.g. Unit 2 Quiz" : "e.g. Lab Manual Submission"}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="border-border/50 h-11 font-medium bg-card"
                      />
                    </div>
                  )}

                  <div className="p-1 border-t border-border/10 pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-secondary-foreground/60 tracking-widest">Activity Parameters</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {['attendance', 'assignment', 'document'].map((t) => (
                          <button
                            key={t}
                            onClick={() => setType(t as any)}
                            className={`py-2 px-1 text-[10px] font-black rounded-lg border transition-all truncate capitalize ${type === t
                                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20'
                                : 'bg-card border-border text-muted-foreground hover:border-blue-300'
                              }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Log Date</Label>
                        <div className="relative group">
                          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 group-focus-within:text-blue-600 transition-colors pointer-events-none z-10" />
                          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-border/50 pl-11 text-xs h-11 font-bold bg-card shadow-sm hover:border-blue-500/30 transition-all" />
                        </div>
                      </div>

                      {type === 'attendance' && (
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Attendance Time Slot</Label>
                          <div className="space-y-3">
                            <select
                              className="flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-bold shadow-sm"
                              value={selectedSlot}
                              onChange={(e) => {
                                setSelectedSlot(e.target.value);
                                const slot = TIME_SLOTS.find(s => s.label === e.target.value);
                                if (slot && slot.start !== 'custom') {
                                  setStartTime(slot.start);
                                  setEndTime(slot.end);
                                }
                              }}
                            >
                              {TIME_SLOTS.map(slot => (
                                <option key={slot.label} value={slot.label}>{slot.label}</option>
                              ))}
                            </select>

                            {selectedSlot === "Custom Range" && (
                              <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-2 gap-2"
                              >
                                <div className="relative group">
                                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-500 transition-colors pointer-events-none z-10" />
                                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="border-border/50 pl-9 pr-2 text-[10px] h-9 font-bold bg-card shadow-sm w-full" />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-blue-600">START</span>
                                </div>
                                <div className="relative group">
                                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-500 transition-colors pointer-events-none z-10" />
                                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="border-border/50 pl-9 pr-2 text-[10px] h-9 font-bold bg-card shadow-sm w-full" />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-blue-600">END</span>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {type !== 'attendance' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="space-y-4 pt-4 border-t border-border/10 overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Due Date & Time</Label>
                        <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border-border/50 h-10 font-bold bg-card text-xs" />
                      </div>
                      {type === 'assignment' && (
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Max Marks</Label>
                          <Input type="number" value={maxMarks} onChange={(e) => setMaxMarks(parseInt(e.target.value))} className="border-border/50 h-10 font-bold bg-card" />
                        </div>
                      )}
                    </div>

                    {type === 'assignment' && (
                      <div className="p-4 rounded-xl border border-dashed border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-900/10 space-y-3">
                        <Label className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                          <FileUp className="w-4 h-4" /> AI Evaluation Context
                        </Label>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          Upload the question paper or assignment instructions to calibrate Gemini's grading logic.
                        </p>
                        <input
                          type="file"
                          className="w-full text-[10px] file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-black cursor-pointer shadow-sm transition-all"
                          onChange={(e) => setQuestionFile(e.target.files?.[0] || null)}
                        />
                        {questionFile && (
                          <Badge variant="secondary" className="bg-white dark:bg-zinc-800 text-[10px] font-medium border-blue-100 text-blue-600">
                            Context: {questionFile.name}
                          </Badge>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </CardContent>
              <CardFooter className="bg-secondary/20 rounded-b-xl border-t border-border/50 pt-6">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !isSubmissionReady}
                  className="group w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-black text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-blue-600/10 disabled:opacity-50"
                >
                  {isSaving ? <Spinner size="sm" /> : <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                  {isSaving ? "Synchronizing Matrix..." : "Commit Tracking Changes"}
                </button>
              </CardFooter>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className={type === 'attendance' ? 'lg:col-span-8 space-y-8' : 'hidden'}>
            <Card className="border-border/50 shadow-none overflow-hidden flex flex-col min-h-[600px] hover:border-blue-500/20 transition-all">
              <CardHeader className="bg-card border-b border-border/50 pb-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2 font-black text-foreground uppercase tracking-tight">
                    <Users className="w-5 h-5 text-blue-500" />
                    Student Roster Matrix
                  </CardTitle>
                  <CardDescription>
                    {isFilterComplete ? `${filteredStudents.length} Students tracked in this recording cycle` : "Select all administrative filters to initialize the roster"}
                  </CardDescription>
                </div>
                {isFilterComplete && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by name, roll..."
                      className="h-10 w-64 rounded-xl border border-border bg-secondary/30 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-card transition-all placeholder:text-muted-foreground/60"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-0 flex-1 bg-card">
                {!isFilterComplete ? (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                      <div className="relative p-8 bg-blue-100 dark:bg-blue-900/30 rounded-3xl border-2 border-blue-200 dark:border-blue-800 shadow-xl">
                        <Users className="w-16 h-16 text-blue-600 animate-pulse" />
                      </div>
                    </div>
                    <div className="max-w-xs space-y-2">
                      <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Sync Pending</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Configure your activity parameters on the left to initialize the roster for this period.
                      </p>
                    </div>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground italic">
                    No students found matching these specifics.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-y-auto max-h-[700px]">
                    {filteredStudents.map((student) => {
                      const isPresent = checklist[student.id];
                      return (
                        <motion.div
                          key={student.id}
                          layout
                          onClick={() => toggleStudent(student.id)}
                          className={cn(
                            "group relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                            isPresent 
                              ? "bg-emerald-50/50 border-emerald-200 shadow-sm" 
                              : "bg-card border-border hover:border-blue-300"
                          )}
                        >
                          <Avatar className="h-12 w-12 border-2 border-white dark:border-zinc-800 shadow-sm">
                            <AvatarImage src={student.profile_image_url} alt={student.name} />
                            <AvatarFallback className="font-bold bg-blue-100 text-blue-700">
                              {student.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm text-foreground uppercase truncate tracking-tight">{student.name}</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{student.roll_number}</p>
                          </div>
                          <Badge 
                            className={cn(
                              "text-[10px] font-black uppercase tracking-widest px-3 py-1 border transition-all",
                              isPresent ? labels.trueColor : labels.falseColor
                            )}
                          >
                            {isPresent ? labels.true : labels.false}
                          </Badge>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

    </div>
  );
}

