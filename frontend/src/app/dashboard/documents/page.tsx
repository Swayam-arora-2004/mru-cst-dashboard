"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Sparkles,
  Upload,
  X,
  Loader2,
  BookOpen,
  ClipboardList,
  FlaskConical,
  Award,
  Building2,
  FolderOpen,
  PenLine,
  AlertCircle,
  ChevronRight,
  FileDown,
  ChevronDown,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  documentsApi,
  coursesApi,
  DocumentSection,
  DocumentType,
  GenerateDocumentParams,
  Course,
} from "@/lib/api";

// ─── Year → Semester mapping ─────────────────────────────────────────────────
const YEAR_SEMESTERS: Record<string, { value: string; label: string }[]> = {
  "1st Year": [
    { value: "1", label: "Semester 1" },
    { value: "2", label: "Semester 2" },
  ],
  "2nd Year": [
    { value: "3", label: "Semester 3" },
    { value: "4", label: "Semester 4" },
  ],
  "3rd Year": [
    { value: "5", label: "Semester 5" },
    { value: "6", label: "Semester 6" },
  ],
  "4th Year": [
    { value: "7", label: "Semester 7" },
    { value: "8", label: "Semester 8" },
  ],
};

// ─── Document Type Config ────────────────────────────────────────────────────
const DOC_TYPES: {
  id: DocumentType;
  label: string;
  icon: typeof FileText;
  description: string;
  color: string;
}[] = [
  {
    id: "lesson_plan",
    label: "Lesson Plan",
    icon: BookOpen,
    description: "Week-by-week teaching schedule with CO mapping",
    color: "blue",
  },
  {
    id: "co_po_mapping",
    label: "CO-PO Mapping",
    icon: ClipboardList,
    description: "Course & Program Outcome correlation matrix",
    color: "purple",
  },
  {
    id: "lab_file",
    label: "Lab File",
    icon: FlaskConical,
    description: "Experiment records with aim, theory, procedure",
    color: "green",
  },
  {
    id: "nba_report",
    label: "NBA Course File",
    icon: Award,
    description: "Full NBA accreditation course documentation",
    color: "amber",
  },
  {
    id: "naac_report",
    label: "NAAC Report",
    icon: Building2,
    description: "NAAC criteria-wise documentation set",
    color: "red",
  },
  {
    id: "course_file",
    label: "Course File",
    icon: FolderOpen,
    description: "Complete course documentation template",
    color: "indigo",
  },
  {
    id: "custom",
    label: "Custom Document",
    icon: PenLine,
    description: "Free-form AI-generated academic content",
    color: "zinc",
  },
];

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
  purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300",
  green: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
  red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
  indigo: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300",
  zinc: "bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300",
};

const ICON_BG: Record<string, string> = {
  blue: "bg-blue-100 dark:bg-blue-900/40 text-blue-600",
  purple: "bg-purple-100 dark:bg-purple-900/40 text-purple-600",
  green: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600",
  amber: "bg-amber-100 dark:bg-amber-900/40 text-amber-600",
  red: "bg-red-100 dark:bg-red-900/40 text-red-600",
  indigo: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600",
  zinc: "bg-zinc-100 dark:bg-zinc-900/40 text-zinc-600",
};

// ─── Course Code Selector ─────────────────────────────────────────────────────
// Fetches all courses from DB, lets user search by name, auto-fills subject+code.
// If multiple courses share the same name, shows all options to pick from.

interface CourseOption {
  id: string;
  name: string;
  code: string;
  type: string;
  semester: number;
  year: number;
  department: string;
}

function CourseSelector({
  onSelect,
  semester,
}: {
  onSelect: (course: CourseOption) => void;
  semester: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Fetch all courses once on mount
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await coursesApi.getAll({ limit: 200 });
        if (res.success && res.data) {
          setCourses(
            res.data.map((c: Course) => ({
              id: c.id,
              name: c.name,
              code: c.code,
              type: c.type,
              semester: c.semester,
              year: c.year,
              department: c.departments?.name || ""
            }))
          );
        }
      } catch {
        // fail silently — user can type manually
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Filter: match query in name or code; prefer semester match if semester chosen
  const filtered = courses
    .filter((c) => {
      const q = query.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      // bubble up semester-matching courses
      const semNum = parseInt(semester) || 0;
      if (semNum) {
        if (a.semester === semNum && b.semester !== semNum) return -1;
        if (b.semester === semNum && a.semester !== semNum) return 1;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, 30);

  const handleSelect = (c: CourseOption) => {
    onSelect(c);
    setSelectedLabel(`${c.name} (${c.code})`);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    onSelect({ id: "", name: "", code: "", type: "", semester: 0, year: 0, department: "" });
    setSelectedLabel("");
    setQuery("");
  };

  return (
    <div ref={ref} className="relative">
      <label className="text-sm font-medium text-foreground block mb-1">
        Subject <span className="text-muted-foreground font-normal">(select from courses DB)</span>
      </label>

      {selectedLabel ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary bg-primary/5 text-sm">
          <Check className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="flex-1 font-medium truncate">{selectedLabel}</span>
          <button
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-input bg-background cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setOpen(true)}
        >
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder={loading ? "Loading courses..." : "Search by course name or code..."}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      )}

      <AnimatePresence>
        {open && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden"
          >
            <div className="max-h-56 overflow-y-auto">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-center justify-between gap-3 border-b border-border/50 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.code} · Sem {c.semester} · {c.type}
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                    {c.code}
                  </span>
                </button>
              ))}
            </div>
            {filtered.length === 30 && (
              <p className="text-xs text-muted-foreground text-center py-2 bg-muted/30">
                Showing top 30 — type to narrow results
              </p>
            )}
          </motion.div>
        )}
        {open && !loading && query.length > 0 && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-lg p-3 text-sm text-muted-foreground text-center"
          >
            No courses found for "{query}"
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Document Preview Renderer ────────────────────────────────────────────────

function DocumentPreview({ sections }: { sections: DocumentSection[] }) {
  return (
    <div className="prose max-w-none font-serif text-foreground">
      {sections.map((section, i) => {
        switch (section.type) {
          case "heading1":
            return (
              <h1 key={i} className="text-[14pt] font-bold text-center mt-6 mb-4 leading-loose border-b pb-2">
                {section.content}
              </h1>
            );
          case "heading2":
            return (
              <h2 key={i} className="text-[12pt] font-bold mt-5 mb-3 leading-[1.5]">
                {section.content}
              </h2>
            );
          case "paragraph":
            return (
              <p key={i} className="text-[12pt] mb-2 leading-relaxed">
                {section.content}
              </p>
            );
          case "list":
            return (
              <ul key={i} className="list-disc pl-6 mb-4 space-y-1">
                {(section.items || []).map((item, j) => (
                  <li key={j} className="text-[12pt]">{item}</li>
                ))}
              </ul>
            );
          case "table": {
            if (!section.rows?.length) return null;
            const [header, ...rows] = section.rows;
            return (
              <div key={i} className="overflow-x-auto mb-6">
                <table className="w-full border-collapse text-[11pt]">
                  <thead>
                    <tr className="bg-zinc-800 dark:bg-zinc-700">
                      {header.map((h, j) => (
                        <th key={j} className="border border-zinc-400 px-3 py-2 text-white font-bold text-center">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-muted/50" : ""}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="border border-border px-3 py-2 text-center">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [generatedSections, setGeneratedSections] = useState<DocumentSection[] | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Omit<GenerateDocumentParams, "documentType" | "files">>({
    subject: "",
    subjectCode: "",
    topic: "",
    department: "",
    year: "",
    semester: "",
    courseOutcomes: "",
    programOutcomes: "",
    customPrompt: "",
    institution: "Manav Rachna University, Faridabad",
  });

  const setField = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // When year changes, reset semester (since valid options change)
  const handleYearChange = (year: string) => {
    setForm((prev) => ({ ...prev, year, semester: "" }));
  };

  // When a course is selected from the DB dropdown — stable reference to prevent re-renders
  const handleCourseSelect = useCallback((course: CourseOption) => {
    const yearLabel = course.year ? `${course.year}${course.year === 1 ? "st" : course.year === 2 ? "nd" : course.year === 3 ? "rd" : "th"} Year` : "";
    setForm((prev) => ({ 
      ...prev, 
      subject: course.name, 
      subjectCode: course.code,
      year: yearLabel,
      semester: course.semester ? course.semester.toString() : "",
      department: course.department || prev.department
    }));
  }, []);

  const semesterOptions = form.year
    ? [{ value: "", label: "Select Semester" }, ...YEAR_SEMESTERS[form.year]]
    : [{ value: "", label: "Select Year First" }];

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles((prev) => [...prev, ...files].slice(0, 10));
    e.target.value = "";
  };

  const removeFile = (i: number) =>
    setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleGenerate = async () => {
    if (!selectedType) {
      toast.error("Please select a document type first");
      return;
    }

    setIsGenerating(true);
    setGeneratedSections(null);

    try {
      const result = await documentsApi.generate({
        documentType: selectedType,
        ...form,
        files: uploadedFiles,
      });

      if (result.success && result.data) {
        setGeneratedSections(result.data.sections);
        setDocumentTitle(result.data.title);
        toast.success(`Document generated! ${result.data.sections.length} sections created.`);
      } else {
        toast.error(result.error || "Generation failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Document generation failed: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!generatedSections) return;
    setIsDownloadingDocx(true);
    try {
      await documentsApi.downloadDocx(generatedSections, documentTitle);
      toast.success("DOCX downloaded!");
    } catch {
      toast.error("Failed to download DOCX");
    } finally {
      setIsDownloadingDocx(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!generatedSections) return;
    setIsDownloadingPdf(true);
    try {
      await documentsApi.downloadPdf(generatedSections, documentTitle);
      toast.success("PDF downloaded!");
    } catch {
      toast.error("Failed to download PDF");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const selectedConfig = DOC_TYPES.find((d) => d.id === selectedType);

  return (
    <div className="min-h-screen">
      <Header
        title="Document Generator"
        description="AI-powered academic document creation — lesson plans, CO-PO mapping, NBA/NAAC reports"
      />

      <div className="p-6 lg:p-8 space-y-8">

        {/* Step 1 — Document Type Selection */}
        <div>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">1</span>
            Select Document Type
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {DOC_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <motion.button
                  key={type.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedType(type.id); setGeneratedSections(null); }}
                  className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? `${COLOR_MAP[type.color]} border-current shadow-md`
                      : "border-border hover:border-primary/40 bg-card"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="docTypeSelected"
                      className="absolute inset-0 rounded-xl ring-2 ring-primary/30"
                    />
                  )}
                  <div className={`inline-flex p-2 rounded-lg mb-2 ${ICON_BG[type.color]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{type.description}</p>
                </motion.button>
              );
            })}
          </div>
        </div>

        {selectedType && (
          <motion.div
            key={selectedType}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              {/* Step 2 — Form */}
              <div className="space-y-6">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">2</span>
                  Document Details
                </p>

                <Card>
                  <CardContent className="p-5 space-y-4">

                    {/* Course selector — fetches from DB, auto-fills subject + code */}
                    <CourseSelector
                      onSelect={handleCourseSelect}
                      semester={form.semester ?? ""}
                    />

                    {/* Show selected subject & code as read-only pills, editable if needed */}
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        id="doc-subject"
                        label="Subject Name"
                        placeholder="Auto-filled from selection"
                        value={form.subject}
                        onChange={(e) => setField("subject", e.target.value)}
                      />
                      <Input
                        id="doc-subject-code"
                        label="Course Code"
                        placeholder="Auto-filled from selection"
                        value={form.subjectCode}
                        onChange={(e) => setField("subjectCode", e.target.value)}
                      />
                    </div>

                    <Input
                      id="doc-topic"
                      label="Topic / Focus Area"
                      placeholder="e.g. Trees, Sorting Algorithms, Unit 3"
                      value={form.topic}
                      onChange={(e) => setField("topic", e.target.value)}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <Input
                        id="doc-department"
                        label="Department"
                        placeholder="CSE"
                        value={form.department}
                        onChange={(e) => setField("department", e.target.value)}
                      />
                      {/* Year dropdown */}
                      <Select
                        id="doc-year"
                        label="Year"
                        options={[
                          { value: "", label: "Select Year" },
                          { value: "1st Year", label: "1st Year" },
                          { value: "2nd Year", label: "2nd Year" },
                          { value: "3rd Year", label: "3rd Year" },
                          { value: "4th Year", label: "4th Year" },
                        ]}
                        value={form.year}
                        onChange={(e) => handleYearChange(e.target.value)}
                      />
                      {/* Semester dropdown — options depend on selected year */}
                      <Select
                        id="doc-semester"
                        label="Semester"
                        options={semesterOptions}
                        value={form.semester}
                        onChange={(e) => setField("semester", e.target.value)}
                        disabled={!form.year}
                      />
                    </div>

                    {(selectedType === "co_po_mapping" || selectedType === "nba_report" || selectedType === "naac_report") && (
                      <>
                        <div>
                          <label htmlFor="doc-cos" className="text-sm font-medium text-foreground block mb-1">
                            Course Outcomes (COs)
                          </label>
                          <textarea
                            id="doc-cos"
                            className="w-full min-h-[90px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                            placeholder={"CO1: Understand basic data structures\nCO2: Apply sorting algorithms\nCO3: Analyze algorithm complexity"}
                            value={form.courseOutcomes}
                            onChange={(e) => setField("courseOutcomes", e.target.value)}
                          />
                        </div>
                        <div>
                          <label htmlFor="doc-pos" className="text-sm font-medium text-foreground block mb-1">
                            Program Outcomes (POs)
                          </label>
                          <textarea
                            id="doc-pos"
                            className="w-full min-h-[70px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                            placeholder={"PO1: Engineering Knowledge\nPO2: Problem Analysis\nPO3: Design/Development of Solutions"}
                            value={form.programOutcomes}
                            onChange={(e) => setField("programOutcomes", e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label htmlFor="doc-custom-prompt" className="text-sm font-medium text-foreground block mb-1">
                        {selectedType === "custom" ? "Your Prompt / Instructions *" : "Additional Instructions"}
                      </label>
                      <textarea
                        id="doc-custom-prompt"
                        className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        placeholder={
                          selectedType === "custom"
                            ? "Describe exactly what document you want. E.g. Generate a viva question bank for Data Structures covering unit 3..."
                            : "Any specific requirements, topics to emphasize, or extra context..."
                        }
                        value={form.customPrompt}
                        onChange={(e) => setField("customPrompt", e.target.value)}
                      />
                    </div>

                    <Input
                      id="doc-institution"
                      label="Institution Name"
                      value={form.institution}
                      onChange={(e) => setField("institution", e.target.value)}
                    />
                  </CardContent>
                </Card>

                {/* File Upload */}
                <div>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">3</span>
                    Upload Course Materials <span className="normal-case font-normal">(optional — gives AI context)</span>
                  </p>

                  <Card>
                    <CardContent className="p-4">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm font-medium">Drop your course files here</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PDFs, DOCX, PPT, Images — up to 10 files, 15MB each
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.docx,.pptx,.ppt,.jpg,.jpeg,.png,.gif,.webp,.txt"
                          onChange={handleFileAdd}
                          className="hidden"
                        />
                      </div>

                      {uploadedFiles.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {uploadedFiles.map((file, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2 text-sm min-w-0">
                                <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                <span className="truncate font-medium">{file.name}</span>
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {(file.size / 1024).toFixed(0)}KB
                                </span>
                              </div>
                              <button
                                onClick={() => removeFile(i)}
                                className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors ml-2"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  size="lg"
                  className="w-full h-14 text-base"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Generating with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Generate Document
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>

                {isGenerating && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                      <span>AI is reading your materials and generating the document. This may take 15–30 seconds...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 4 — Preview + Download */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">4</span>
                  Preview & Download
                </p>

                <AnimatePresence>
                  {generatedSections ? (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      {/* Download Buttons */}
                      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                        <CardContent className="p-4">
                          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Document ready — {generatedSections.length} sections generated
                          </p>
                          <div className="flex gap-3">
                            <Button
                              onClick={handleDownloadDocx}
                              isLoading={isDownloadingDocx}
                              className="flex-1"
                              variant="outline"
                            >
                              <FileDown className="h-4 w-4" />
                              Download DOCX
                            </Button>
                            <Button
                              onClick={handleDownloadPdf}
                              isLoading={isDownloadingPdf}
                              className="flex-1"
                            >
                              <FileDown className="h-4 w-4" />
                              Download PDF
                            </Button>
                          </div>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2">
                            DOCX: 14pt bold headings · 12pt bold subheadings · 12pt body · Times New Roman · A4
                          </p>
                        </CardContent>
                      </Card>

                      {/* Preview Panel */}
                      <Card>
                        <CardHeader className="pb-2 flex-row items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Document Preview
                          </CardTitle>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md font-mono">
                            {documentTitle}
                          </span>
                        </CardHeader>
                        <CardContent className="p-4 max-h-[70vh] overflow-y-auto border-t">
                          <DocumentPreview sections={generatedSections} />
                        </CardContent>
                      </Card>
                    </motion.div>
                  ) : (
                    <Card className="h-[500px] flex items-center justify-center border-dashed">
                      <div className="text-center p-8">
                        <div className="p-4 rounded-full bg-muted mx-auto w-fit mb-4">
                          {selectedConfig ? (
                            <selectedConfig.icon className="h-8 w-8 text-muted-foreground" />
                          ) : (
                            <FileText className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <h3 className="font-medium text-foreground mb-1">
                          {selectedConfig ? `${selectedConfig.label} Preview` : "Preview"}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-xs">
                          Fill in the details on the left and click "Generate Document" to see your AI-created content here
                        </p>
                        {uploadedFiles.length > 0 && (
                          <div className="mt-4 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {uploadedFiles.length} file{uploadedFiles.length > 1 ? "s" : ""} uploaded as AI context
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
        )}

        {!selectedType && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 mb-4">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">AI Document Generator</h3>
            <p className="text-muted-foreground max-w-md">
              Select a document type above to get started. Upload your course materials as context and let Gemini AI generate perfectly formatted academic documents in seconds.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center mt-4 text-xs text-muted-foreground">
              {["Lesson Plans", "CO-PO Mapping", "Lab Files", "NBA Course Files", "NAAC Reports"].map((t) => (
                <span key={t} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
