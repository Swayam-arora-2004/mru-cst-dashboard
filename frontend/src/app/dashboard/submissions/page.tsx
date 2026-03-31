"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileUp, 
  Search, 
  Users, 
  BrainCircuit, 
  CheckCircle2, 
  Sparkles, 
  GraduationCap,
  Calendar,
  Award,
  Edit3,
  Save,
  Clock,
  ChevronRight,
  FileCheck,
  Upload
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
  Student, 
  Course, 
  Activity, 
  Evaluation 
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SubmissionsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState<string | null>(null); 
  
  // Scoring State
  const [editingEval, setEditingEval] = useState<string | null>(null); 
  const [editForm, setEditForm] = useState<{ marks: number; grade: string }>({
    marks: 0,
    grade: ''
  });

  // Filter state
  const [courseId, setCourseId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Result state
  const [recentEvaluation, setRecentEvaluation] = useState<Evaluation | null>(null);
  const [activityEvaluations, setActivityEvaluations] = useState<Record<string, Evaluation>>({});

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (courseId) {
      fetchActivities(courseId);
    }
  }, [courseId]);

  useEffect(() => {
    if (activityId) {
      fetchActivityEvaluations(activityId);
    } else {
      setActivityEvaluations({});
    }
  }, [activityId]);

  const fetchActivityEvaluations = async (id: string) => {
    try {
      const res = await evaluationsApi.getForActivity(id);
      if (res.success && res.data) {
        const evalMap: Record<string, Evaluation> = {};
        res.data.forEach(e => {
          evalMap[e.student_id] = e;
        });
        setActivityEvaluations(evalMap);
      }
    } catch (err) {
      console.error("Failed to fetch activity evaluations:", err);
    }
  };

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [coursesRes, studentsRes] = await Promise.all([
        coursesApi.getAll({ limit: 50 }),
        studentsApi.getAll({ limit: 100 })
      ]);

      if (coursesRes.success) {
        setCourses(coursesRes.data || []);
        if (coursesRes.data && coursesRes.data.length > 0) setCourseId(coursesRes.data[0].id);
      }
      if (studentsRes.success) setStudents(studentsRes.data || []);
    } catch (err) {
      toast.error("Failed to load submission rosters.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivities = async (id: string) => {
    try {
      const res = await activitiesApi.getAll(id);
      if (res.success) {
        const submissionActivities = (res.data || []).filter(a => a.type !== 'attendance');
        setActivities(submissionActivities);
        if (submissionActivities.length > 0) setActivityId(submissionActivities[0].id);
        else setActivityId("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const currentActivity = activities.find(a => a.id === activityId);

  const handleFileUpload = async (studentId: string, file: File) => {
    if (!activityId) {
      toast.error("Please select an assignment topic first.");
      return;
    }

    if (!currentActivity) return;

    setIsEvaluating(studentId);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("student_id", studentId);
    formData.append("activity_id", activityId);
    formData.append("type", currentActivity.type === 'assignment' ? 'assignment' : 'document');

    const loadingToast = toast.loading("AI context processing started...", {
      description: "Gemini is analyzing multimodal compliance.",
    });

    try {
      const res = await evaluationsApi.evaluate(formData);
      if (res.success && res.data) {
        toast.dismiss(loadingToast);
        toast.success("AI Grading Complete", {
          description: `Score: ${res.data.marks_attained} / ${currentActivity.max_marks || 100}`,
        });
        setRecentEvaluation(res.data);
        setActivityEvaluations(prev => ({
          ...prev,
          [studentId]: res.data!
        }));
      } else {
        throw new Error(res.error || "Evaluation failed");
      }
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error("AI Pipeline Error", {
        description: err.message || "Failed to process multimodal input.",
      });
    } finally {
      setIsEvaluating(null);
    }
  };

  const startManualEdit = (evaluation: Evaluation) => {
    setEditingEval(evaluation.id);
    setEditForm({
      marks: evaluation.marks_attained || 0,
      grade: evaluation.grade
    });
  };

  const saveManualEdit = async () => {
    if (!editingEval) return;
    try {
      const res = await evaluationsApi.update(editingEval, {
        marks_attained: editForm.marks,
        grade: editForm.grade
      });
      if (res.success) {
        toast.success("Evaluation updated successfully.");
        if (recentEvaluation?.id === editingEval) {
          setRecentEvaluation(res.data!);
        }
        setActivityEvaluations(prev => {
           const studentId = Object.keys(prev).find(key => prev[key].id === editingEval);
           if (studentId) {
             return { ...prev, [studentId]: res.data! };
           }
           return prev;
        });
        setEditingEval(null);
      }
    } catch (err) {
      toast.error("Failed to update evaluation manually.");
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.roll_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <Header
        title="Submissions & Compliance"
        description="Unified grading desk for assignments and document verification."
      />

      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* Control Tower */}
            <div className="xl:col-span-4 space-y-6">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <Card className="border-border/50 hover:border-blue-500/20 transition-all shadow-none">
                  <CardHeader className="pb-6">
                    <CardTitle className="text-lg flex items-center gap-2 font-bold text-foreground">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <GraduationCap className="w-4 h-4 text-blue-600" />
                      </div>
                      Grading Desk
                    </CardTitle>
                    <CardDescription>Target course and specific assignment</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Select Target Course</Label>
                       <select 
                        className="w-full h-10 px-3 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value)}
                      >
                        {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Assignment Topic</Label>
                       <select 
                        className="w-full h-10 px-3 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                        value={activityId}
                        onChange={(e) => setActivityId(e.target.value)}
                      >
                        {activities.length > 0 ? (
                          activities.map(a => <option key={a.id} value={a.id}>{a.title}</option>)
                        ) : (
                          <option value="">No assignments found</option>
                        )}
                      </select>
                    </div>

                    {currentActivity && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }} 
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-[10px] font-black text-muted-foreground tracking-widest">SUBMISSION DEADLINE</span>
                          </div>
                          {currentActivity.due_date && (
                            <Badge variant="outline" className="bg-background text-[10px] border-border text-foreground font-bold">
                              {new Date(currentActivity.due_date).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>

                        {currentActivity.type !== 'document' && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Award className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-[10px] font-black text-muted-foreground tracking-widest">MAX POSSIBLE SCORE</span>
                            </div>
                            <Badge className="bg-blue-600 text-white text-[10px] font-black px-2 tracking-tighter">
                              {currentActivity.max_marks || 100} PTS
                            </Badge>
                          </div>
                        )}

                        {currentActivity.question_file_url && (
                          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 bg-emerald-100/50 dark:bg-emerald-900/10 rounded-lg border border-emerald-200/50">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Calibration Context Active</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </CardContent>
                </Card>

                <AnimatePresence>
                  {recentEvaluation && (
                    <motion.div 
                      key={recentEvaluation.id}
                      initial={{ opacity: 0, y: 20 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="mt-6"
                    >
                      <Card className="bg-slate-900 border-none shadow-xl shadow-blue-950/20 text-white overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                          <BrainCircuit className="w-32 h-32 text-blue-400" />
                        </div>
                        <CardHeader className="pb-4 relative z-10 border-b border-white/5">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" /> 
                              <span className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em]">Latest AI Output</span>
                            </div>
                            <Badge className="bg-blue-500 text-white font-black px-3 py-1 rounded-full uppercase text-[10px] tracking-widest">
                              GRADE {recentEvaluation.grade}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6 relative z-10">
                          <div className="flex items-baseline gap-2">
                             <span className="text-6xl font-black text-white tracking-tighter">{recentEvaluation.marks_attained}</span>
                             {currentActivity?.type !== 'document' && (
                               <span className="text-2xl text-blue-300 font-bold opacity-60">/ {currentActivity?.max_marks || 100}</span>
                             )}
                          </div>



                          {editingEval !== recentEvaluation.id ? (
                            <button 
                              onClick={() => startManualEdit(recentEvaluation)}
                              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/10 hover:bg-blue-600 transition-all text-xs font-black uppercase tracking-widest border border-white/10 hover:border-blue-500"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Manual Overwrite
                            </button>
                          ) : (
                            <div className="space-y-4 pt-4 border-t border-white/10">
                               <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest">New Score</Label>
                                    <Input 
                                      type="number" 
                                      className="bg-white/5 border-white/10 text-white h-10 font-black text-lg" 
                                      value={editForm.marks}
                                      onChange={(e) => setEditForm({...editForm, marks: parseInt(e.target.value) || 0})}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest">New Grade</Label>
                                    <Input 
                                      className="bg-white/5 border-white/10 text-white h-10 font-bold text-lg text-center" 
                                      value={editForm.grade}
                                      onChange={(e) => setEditForm({...editForm, grade: e.target.value})}
                                    />
                                  </div>
                               </div>

                               <div className="flex gap-3">
                                  <button onClick={() => setEditingEval(null)} className="flex-1 py-3 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Cancel</button>
                                  <button onClick={saveManualEdit} className="flex-[2] py-3 rounded-xl bg-blue-600 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/40">Apply Override</button>
                               </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Submissions Matrix */}
            <div className="xl:col-span-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="border-border/50 shadow-none overflow-hidden flex flex-col min-h-[600px] hover:border-blue-500/20 transition-all">
                  <CardHeader className="bg-card border-b border-border/50 pb-6 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2 font-black text-foreground uppercase tracking-tight">
                         <FileCheck className="w-5 h-5 text-blue-600" />
                         Submission Roster Matrix
                      </CardTitle>
                      <CardDescription>Upload student artifacts to trigger AI quantitative grading sequence</CardDescription>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search student or roll number..."
                        className="h-10 w-64 rounded-xl border border-border bg-secondary/30 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-card transition-all placeholder:text-muted-foreground/60"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-0 flex-1 bg-card">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-secondary/40 text-[10px] uppercase font-black tracking-[0.15em] text-muted-foreground border-b border-border/30">
                          <tr>
                            <th className="px-6 py-5">Student Identity</th>
                            <th className="px-6 py-5">Roll Authority</th>
                            <th className="px-6 py-5">AI Diagnostic</th>
                            <th className="px-6 py-5 text-right">Action Gateway</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {filteredStudents.map((student) => {
                            const studentEval = activityEvaluations[student.id];
                            const isSelected = recentEvaluation?.student_id === student.id;

                            return (
                              <tr 
                                key={student.id} 
                                onClick={() => studentEval && setRecentEvaluation(studentEval)}
                                className={cn(
                                  "border-b border-border/30 transition-colors group cursor-pointer",
                                  isSelected ? "bg-blue-600/10 border-blue-600/30" : "hover:bg-secondary/20"
                                )}
                              >
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-3">
                                    <Avatar size="sm" className="bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                                      <AvatarImage src={(student as any).profile_image_url} alt={student.name} />
                                      <AvatarFallback className="text-[10px] uppercase font-black">{student.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                      <span className="text-sm font-black text-foreground group-hover:text-blue-500 transition-colors">{student.name}</span>
                                      <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">{student.email}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <Badge variant="secondary" className="bg-secondary text-muted-foreground border-none font-mono font-black text-[10px] uppercase tracking-wider px-2">
                                    {student.roll_number}
                                  </Badge>
                                </td>
                                <td className="px-6 py-5">
                                  {studentEval ? (
                                    <div className="flex items-center gap-3">
                                      <div className="flex flex-col">
                                        <div className="flex items-baseline gap-1">
                                          <span className="text-sm font-black text-foreground">{studentEval.marks_attained}</span>
                                          {currentActivity?.type !== 'document' && (
                                            <span className="text-[10px] font-bold text-muted-foreground/50">/{currentActivity?.max_marks || 100}</span>
                                          )}
                                        </div>

                                      </div>
                                      <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-none font-black text-[10px]">
                                        {studentEval.grade}
                                      </Badge>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">No Data</span>
                                  )}
                                </td>
                                <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                                  <label className={cn(
                                    "relative inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer transition-all active:scale-95",
                                    isEvaluating === student.id ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                                  )}>
                                    {isEvaluating === student.id ? (
                                      <>
                                        <Spinner size="sm" className="text-blue-400" />
                                        Process...
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="w-3 h-3" />
                                        Upload
                                      </>
                                    )}
                                    <input 
                                      type="file" 
                                      className="hidden" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(student.id, file);
                                      }}
                                      disabled={!!isEvaluating}
                                    />
                                  </label>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
