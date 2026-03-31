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
import { 
  coursesApi, 
  studentsApi, 
  activitiesApi, 
  Student, 
  Course, 
  ActivityRecord,
} from "@/lib/api";


export default function ActivitiesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
  const [questionFile, setQuestionFile] = useState<File | null>(null);

  // Checklist State Map: student_id -> status boolean (true = present/submitted)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchBaseData();
  }, []);

  const fetchBaseData = async () => {
    setIsLoading(true);
    try {
      const [studentsRes, coursesRes] = await Promise.all([
        studentsApi.getAll({ limit: 100 }),
        coursesApi.getAll({ limit: 50 })
      ]);

      if (coursesRes.success && coursesRes.data) {
        setCourses(coursesRes.data);
        if (coursesRes.data.length > 0) {
          setCourseId(coursesRes.data[0].id);
        }
      }

      if (studentsRes.success && studentsRes.data) {
        setStudents(studentsRes.data);
        const initMap: Record<string, boolean> = {};
        studentsRes.data.forEach(s => {
          initMap[s.id] = true;
        });
        setChecklist(initMap);
      }
    } catch (err) {
      toast.error("Failed to load tracking data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      if (course.type === 'lecture') setDuration(1);
      else if (course.type === 'lab') setDuration(2);
    }
  }, [courseId, courses]);

  const toggleStudent = (id: string) => {
    setChecklist(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async () => {
    // Only require manual title for assignments and documents
    if (type !== 'attendance' && !title) {
      toast.error("Please enter a title for this activity.");
      return;
    }

    if (!courseId) {
      toast.error("Please select a target course.");
      return;
    }

    setIsSaving(true);
    try {
      const records: ActivityRecord[] = students.map(s => ({
        student_id: s.id,
        status: checklist[s.id] 
          ? (type === 'attendance' ? 'present' : 'submitted') 
          : (type === 'attendance' ? 'absent' : 'missing')
      }));

      const formData = new FormData();
      formData.append("title", type === 'attendance' ? `Attendance - ${date}` : title);
      formData.append("type", type);
      formData.append("course_id", courseId);
      formData.append("date", date);
      
      if (type === 'attendance') {
        formData.append("time_range", `${startTime} - ${endTime}`);
      } else {
        // Only append duration for non-attendance if it's still needed, 
        // but user asked to remove it from assignment and document.
        // So we effectively don't send it for those.
      }

      formData.append("records", JSON.stringify(records));
      
      if (type === 'assignment') {
        formData.append("max_marks", maxMarks.toString());
        if (dueDate) formData.append("due_date", dueDate);
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

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.roll_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Configuration Sidebar */}
          <div className="lg:col-span-4 space-y-6">
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
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Select Target Course</Label>
                       <select 
                        className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-bold"
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value)}
                      >
                        {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {type !== 'attendance' && (
                    <div className="space-y-2 px-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Assignment Descriptor</Label>
                      <Input 
                        placeholder="e.g. Unit 2 Quiz" 
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
                              className={`py-2 px-1 text-[10px] font-black rounded-lg border transition-all truncate capitalize ${
                                type === t 
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
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Attendance Time Range</Label>
                            <div className="space-y-2">
                              <div className="relative group">
                                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 group-focus-within:text-blue-600 transition-colors pointer-events-none z-10" />
                                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="border-border/50 pl-11 pr-16 text-xs h-11 font-bold bg-card shadow-sm hover:border-blue-500/30 transition-all w-full" />
                                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800 pointer-events-none">START</span>
                              </div>
                              <div className="relative group">
                                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 group-focus-within:text-blue-600 transition-colors pointer-events-none z-10" />
                                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="border-border/50 pl-11 pr-16 text-xs h-11 font-bold bg-card shadow-sm hover:border-blue-500/30 transition-all w-full" />
                                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800 pointer-events-none">END</span>
                              </div>
                            </div>
                          </div>
                        )}
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {type === 'assignment' && (
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Max Marks</Label>
                      <Input 
                        type="number" 
                        value={maxMarks} 
                        onChange={(e) => setMaxMarks(parseInt(e.target.value) || 0)}
                        className="border-border/50" 
                      />
                    </div>
                  )}
                </div>

                {type !== 'attendance' && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: 'auto', opacity: 1 }}
                    className="space-y-4 pt-4 border-t border-border/50"
                  >
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> Submission Deadline
                      </Label>
                      <div className="relative group">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 group-focus-within:text-blue-600 transition-colors pointer-events-none z-10" />
                        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border-border/50 pl-11 text-xs h-11 font-bold bg-card shadow-sm hover:border-blue-500/30 transition-all" />
                      </div>
                    </div>

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
                  </motion.div>
                )}

              </CardContent>
              <CardFooter className="bg-secondary/20 rounded-b-xl border-t border-border/50 pt-6">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="group w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-black text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-blue-600/10 disabled:opacity-50"
                >
                  {isSaving ? <Spinner size="sm" /> : <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                  {isSaving ? "Synchronizing Matrix..." : "Commit Tracking Changes"}
                </button>
              </CardFooter>
            </Card>
          </div>

          {/* Roster Area */}
          <div className="lg:col-span-8">
            <Card className="border-border/50 shadow-none overflow-hidden flex flex-col min-h-[600px] hover:border-blue-500/20 transition-all">
              <CardHeader className="bg-card border-b border-border/50 pb-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2 font-black text-foreground uppercase tracking-tight">
                    <Users className="w-5 h-5 text-blue-500" /> 
                    Student Roster Matrix
                  </CardTitle>
                  <CardDescription>
                    {filteredStudents.length} Students tracked in this recording cycle
                  </CardDescription>
                </div>
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
              </CardHeader>
              
              <CardContent className="p-0 flex-1 bg-card">
                <div className="grid grid-cols-1 divide-y divide-border/30">
                  <AnimatePresence mode="popLayout">
                    {filteredStudents.map((student, idx) => {
                      const isException = !checklist[student.id];
                      return (
                        <motion.div 
                          key={student.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.01 }}
                          className={`flex items-center justify-between p-4 px-6 transition-all group cursor-pointer ${isException ? 'bg-secondary/30' : 'hover:bg-secondary/20'}`}
                          onClick={() => toggleStudent(student.id)}
                        >
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <Avatar size="lg" className="border-2 border-white dark:border-zinc-800 shadow-sm bg-secondary overflow-hidden">
                                <AvatarImage src={(student as any).profile_image_url || undefined} />
                                <AvatarFallback className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-black">
                                  {student.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm transition-all ${!isException ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}>
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            </div>
                            <div>
                              <p className="font-bold text-foreground group-hover:text-blue-600 transition-colors">{student.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono font-black border-none text-muted-foreground uppercase opacity-80">
                                  {student.roll_number}
                                </Badge>
                                {(student as any).specialization && (
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-40">{(student as any).specialization}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                              !isException 
                                ? labels.trueColor 
                                : labels.falseColor + ' opacity-50'
                            }`}>
                              {!isException ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                              {!isException ? labels.true : labels.false}
                            </div>
                            <ChevronRight className={`w-4 h-4 transition-all ${!isException ? 'text-muted-foreground/20 opacity-0 group-hover:opacity-100' : 'text-muted-foreground/40'}`} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {filteredStudents.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
                    <div className="p-5 bg-secondary rounded-full mb-4">
                      <Search className="w-8 h-8" />
                    </div>
                    <p className="font-black uppercase tracking-widest text-xs">No Matrix Matches</p>
                    <p className="text-[10px] mt-1 font-bold">Try adjusting your filters or query</p>
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
