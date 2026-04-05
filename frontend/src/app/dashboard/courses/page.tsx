"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  BookOpen,
  Sparkles,
  Check,
  X,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  coursesApi,
  generalApi,
  Course,
  Department,
  CourseCodeSuggestion,
  ClassInfo,
} from "@/lib/api";
import { debounce } from "@/lib/utils";
import { getSemesterOptions, getYearForSemester } from "@/lib/yearSemesterUtils";
import { getSpecializations } from "@/lib/specializations";

const courseTypeColors: Record<string, "default" | "primary" | "success" | "warning" | "destructive"> = {
  lecture: "primary",
  tutorial: "success",
  lab: "warning",
  mooc: "destructive",
  elective: "default",
};

// Moved outside to prevent focus loss issues
const courseTypes = [
  { value: "lecture", label: "Lecture" },
  { value: "tutorial", label: "Tutorial" },
  { value: "lab", label: "Lab" },
  { value: "mooc", label: "MOOC" },
  { value: "elective", label: "Elective" },
];

interface CourseFormProps {
  formData: any;
  setFormData: (data: any) => void;
  classes: ClassInfo[];
  departments: Department[];
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  onCancel: () => void;
  validateCode: (code: string) => void;
  isValidating: boolean;
  codeValidation: any;
  isSubmitting: boolean;
}

const CourseForm = ({
  formData,
  setFormData,
  classes,
  departments,
  onSubmit,
  submitLabel,
  onCancel,
  validateCode,
  isValidating,
  codeValidation,
  isSubmitting,
}: CourseFormProps) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div className="relative">
      <Input
        label="Course Code"
        placeholder="e.g., CSH422B-T"
        value={formData.code}
        onChange={(e) => {
          const value = e.target.value.toUpperCase();
          setFormData((prev: any) => ({ ...prev, code: value }));
          validateCode(value);
        }}
        required
      />
      {isValidating && (
        <div className="absolute right-3 top-9">
          <Spinner size="sm" />
        </div>
      )}
      {codeValidation && (
        <div className="mt-2 flex items-start gap-2">
          {codeValidation.isDuplicate ? (
            <>
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm text-red-500">This code is already in use</p>
                {codeValidation.suggestions.length > 0 && (
                  <div className="mt-1">
                    <p className="text-xs text-muted-foreground">Try these alternatives:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {codeValidation.suggestions.map((s: string) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setFormData((prev: any) => ({ ...prev, code: s }))
                          }
                          className="px-2 py-0.5 text-xs bg-muted rounded-md hover:bg-muted/80 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : codeValidation.isValid ? (
            <>
              <Check className="h-4 w-4 text-emerald-500 mt-0.5" />
              <p className="text-sm text-emerald-500">Code is available</p>
            </>
          ) : (
            <>
              <X className="h-4 w-4 text-amber-500 mt-0.5" />
              <p className="text-sm text-amber-500">Invalid code format</p>
            </>
          )}
        </div>
      )}
    </div>
    <Input
      label="Course Name"
      placeholder="e.g., Virtualization - Containers/Cloud"
      value={formData.name}
      onChange={(e) => setFormData((prev: any) => ({ ...prev, name: e.target.value }))}
      required
    />
    <div className="grid grid-cols-2 gap-4">
      <Select
        label="Type"
        placeholder="Select type"
        options={courseTypes}
        value={formData.type}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData((prev: any) => ({ ...prev, type: e.target.value }))}
        required
      />
      <Input
        type="number"
        label="Credits"
        placeholder="3"
        min="1"
        max="6"
        value={formData.credits}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setFormData((prev: any) => ({ ...prev, credits: e.target.value }))
        }
        required
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Select
        label="Year"
        placeholder="Select year"
        options={[
          { value: "1", label: "1st Year" },
          { value: "2", label: "2nd Year" },
          { value: "3", label: "3rd Year" },
          { value: "4", label: "4th Year" },
        ]}
        value={formData.year}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          setFormData((prev: any) => ({ ...prev, year: e.target.value }))
        }
        required
      />
      <Select
        label="Specialization"
        placeholder="Select specialization"
        options={[
          { value: "", label: "None" },
          ...getSpecializations(departments.find(d => d.id === formData.department_id)?.name || '').map(s => ({ value: s, label: s }))
        ]}
        value={formData.specialization || ""}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData((prev: any) => ({ ...prev, specialization: e.target.value }))}
      />
    </div>
    <div className="grid grid-cols-1 gap-4">
      <Select
        label="Department"
        placeholder="Select department"
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
        value={formData.department_id}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          setFormData((prev: any) => ({ ...prev, department_id: e.target.value }))
        }
        required
      />
    </div>
    <div className="grid grid-cols-1 gap-4">
      <Select
        label="Semester"
        placeholder="Select semester"
        options={Array.from({ length: 12 }, (_, i) => ({
          value: (i + 1).toString(),
          label: `Semester ${i + 1}`,
        }))}
        value={formData.semester}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          setFormData((prev: any) => ({ ...prev, semester: e.target.value }))
        }
        required
      />
    </div>
    <div className="flex justify-end gap-3 pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        isLoading={isSubmitting}
        disabled={codeValidation?.isDuplicate}
      >
        {submitLabel}
      </Button>
    </div>
  </form>
);

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    credits: "3",
    type: "",
    department_id: "",
    semester: "",
    year: "",
    specialization: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Code generation
  const [generateParams, setGenerateParams] = useState({
    department: "",
    type: "",
    semester: "",
    year: "",
    specialization: "",
  });
  const [suggestions, setSuggestions] = useState<CourseCodeSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [codeValidation, setCodeValidation] = useState<{
    isValid: boolean;
    isDuplicate: boolean;
    suggestions: string[];
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Fetch courses
  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await coursesApi.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        type: selectedType || undefined,
        department_id: selectedDepartment || undefined,
      });

      if (response.success && response.data) {
        setCourses(response.data);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      }
    } catch (error) {
      toast.error("Failed to fetch courses");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, search, selectedType, selectedDepartment]);

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearch(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300),
    []
  );

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    generalApi.getDepartments().then((res) => {
      if (res.success && res.data) setDepartments(res.data);
    });
    generalApi.getClasses().then((res) => {
      if (res.success && res.data) setClasses(res.data);
    });
  }, []);

  // Validate course code
  const validateCode = useCallback(
    debounce(async (code: string) => {
      if (!code || code.length < 3) {
        setCodeValidation(null);
        return;
      }

      setIsValidating(true);
      try {
        const response = await coursesApi.validateCode(code);
        if (response.success && response.data) {
          setCodeValidation(response.data);
        }
      } catch (error) {
        console.error("Validation error:", error);
      } finally {
        setIsValidating(false);
      }
    }, 500),
    []
  );

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validation
    if (!formData.code || !formData.name || !formData.type || !formData.department_id || !formData.semester || !formData.year) {
      toast.error("Please fill in all required fields including Year, Semester and Department");
      setIsSubmitting(false);
      return;
    }

    const semester = parseInt(formData.semester);
    const year = parseInt(formData.year);
    const credits = parseInt(formData.credits);

    if (isNaN(semester) || isNaN(year) || isNaN(credits)) {
      toast.error("Year, Semester, and Credits must be valid numbers");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await coursesApi.create({
        code: formData.code.toUpperCase(),
        name: formData.name,
        credits,
        type: formData.type as Course["type"],
        department_id: formData.department_id,
        semester,
        year,
        specialization: formData.specialization || (null as any),
      });

      if (response.success) {
        toast.success("Course added successfully");
        setIsAddModalOpen(false);
        resetForm();
        fetchCourses();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add course");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setIsSubmitting(true);

    // Validation
    if (!formData.code || !formData.name || !formData.type || !formData.department_id || !formData.semester || !formData.year) {
      toast.error("Please fill in all required fields including Year, Semester and Department");
      setIsSubmitting(false);
      return;
    }

    const semester = parseInt(formData.semester);
    const year = parseInt(formData.year);
    const credits = parseInt(formData.credits);

    if (isNaN(semester) || isNaN(year) || isNaN(credits)) {
      toast.error("Year, Semester, and Credits must be valid numbers");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await coursesApi.update(selectedCourse.id, {
        code: formData.code.toUpperCase(),
        name: formData.name,
        credits,
        type: formData.type as Course["type"],
        department_id: formData.department_id,
        semester,
        year,
        specialization: formData.specialization || (null as any),
      });

      if (response.success) {
        toast.success("Course updated successfully");
        setIsEditModalOpen(false);
        resetForm();
        fetchCourses();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update course");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!selectedCourse) return;
    setIsSubmitting(true);

    try {
      const response = await coursesApi.delete(selectedCourse.id);
      if (response.success) {
        toast.success("Course deleted successfully");
        setIsDeleteModalOpen(false);
        setSelectedCourse(null);
        fetchCourses();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete course");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!generateParams.department || !generateParams.type || !generateParams.semester) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsGenerating(true);
    try {
      const dept = departments.find((d) => d.id === generateParams.department);
      const response = await coursesApi.generateCode({
        department: dept?.code || "",
        type: generateParams.type as Course["type"],
        semester: parseInt(generateParams.semester),
        year: generateParams.year ? parseInt(generateParams.year) : undefined,
        specialization: generateParams.specialization || undefined,
      });

      if (response.success && response.data) {
        setSuggestions(response.data);
      }
    } catch (error) {
      toast.error("Failed to generate course codes");
    } finally {
      setIsGenerating(false);
    }
  };

  const selectSuggestion = (suggestion: CourseCodeSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      code: suggestion.code,
      type: generateParams.type,
      department_id: generateParams.department,
      semester: generateParams.semester,
    }));
    setIsGenerateModalOpen(false);
    setIsAddModalOpen(true);
    setSuggestions([]);
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      credits: "3",
      type: "",
      department_id: "",
      semester: "",
      year: "",
      specialization: "",
    });
    setSelectedCourse(null);
    setCodeValidation(null);
  };

  const openEditModal = (course: Course) => {
    setSelectedCourse(course);
    setFormData({
      code: course.code,
      name: course.name,
      credits: course.credits.toString(),
      type: course.type,
      department_id: course.department_id,
      semester: course.semester.toString(),
      year: course.year?.toString() || "",
      specialization: course.specialization || "",
    });
    setIsEditModalOpen(true);
  };

// Moved outside to prevent focus loss issues
const courseTypes = [
  { value: "lecture", label: "Lecture" },
  { value: "tutorial", label: "Tutorial" },
  { value: "lab", label: "Lab" },
  { value: "mooc", label: "MOOC" },
  { value: "elective", label: "Elective" },
];

  return (
    <div className="min-h-screen">
      <Header
        title="Courses"
        description="Manage course codes and information"
        action={
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setIsGenerateModalOpen(true)} className="flex-1 sm:flex-initial">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Generate Code</span>
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)} className="flex-1 sm:flex-initial">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Course</span>
            </Button>
          </div>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by name or code..."
              leftIcon={<Search className="h-4 w-4" />}
              onChange={(e) => debouncedSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "bg-muted" : ""}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Filter Options */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Select
                      label="Type"
                      placeholder="All types"
                      options={[{ value: "", label: "All types" }, ...courseTypes]}
                      value={selectedType}
                      onChange={(e) => {
                        setSelectedType(e.target.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                    />
                    <Select
                      label="Department"
                      placeholder="All departments"
                      options={[
                        { value: "", label: "All departments" },
                        ...departments.map((d) => ({ value: d.id, label: d.name })),
                      ]}
                      value={selectedDepartment}
                      onChange={(e) => {
                        setSelectedDepartment(e.target.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                    />
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelectedType("");
                          setSelectedDepartment("");
                          setSearch("");
                          setPagination((prev) => ({ ...prev, page: 1 }));
                        }}
                      >
                        Clear filters
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Courses List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner size="lg" />
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6 text-zinc-400" />}
            title="No courses found"
            description="Get started by adding your first course or generate a code"
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsGenerateModalOpen(true)}>
                  <Sparkles className="h-4 w-4" />
                  Generate Code
                </Button>
                <Button onClick={() => setIsAddModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Course
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((course, index) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card hover className="group">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={courseTypeColors[course.type]}>
                              {course.type.charAt(0).toUpperCase() + course.type.slice(1)}
                            </Badge>
                            <Badge variant="outline">{course.credits} credits</Badge>
                          </div>
                          <h3 className="font-semibold text-lg text-foreground mb-1">
                            {course.code}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {course.name}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-2">
                            Semester {course.semester} • {course.departments?.code || "N/A"}
                          </p>
                        </div>
                        <div className="relative">
                          <button className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          <div className="absolute right-0 top-full mt-1 w-36 py-1 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            <button
                              onClick={() => openEditModal(course)}
                              className="w-full px-4 py-2 text-sm text-left text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCourse(course);
                                setIsDeleteModalOpen(true);
                              }}
                              className="w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-zinc-500">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} courses
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Course Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForm();
        }}
        title="Add New Course"
        description="Enter the course information below"
        size="lg"
      >
        <CourseForm 
          formData={formData}
          setFormData={setFormData}
          classes={classes}
          departments={departments}
          onSubmit={handleAddCourse} 
          submitLabel="Add Course" 
          onCancel={() => {
            setIsAddModalOpen(false);
            resetForm();
          }}
          validateCode={validateCode}
          isValidating={isValidating}
          codeValidation={codeValidation}
          isSubmitting={isSubmitting}
        />
      </Modal>

      {/* Edit Course Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          resetForm();
        }}
        title="Edit Course"
        description="Update the course information"
        size="lg"
      >
        <CourseForm 
          formData={formData}
          setFormData={setFormData}
          classes={classes}
          departments={departments}
          onSubmit={handleEditCourse} 
          submitLabel="Save Changes" 
          onCancel={() => {
            setIsEditModalOpen(false);
            resetForm();
          }}
          validateCode={validateCode}
          isValidating={isValidating}
          codeValidation={codeValidation}
          isSubmitting={isSubmitting}
        />
      </Modal>

      {/* Generate Code Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => {
          setIsGenerateModalOpen(false);
          setSuggestions([]);
          setGenerateParams({
            department: "",
            type: "",
            semester: "",
            year: "",
            specialization: "",
          });
        }}
        title="Generate Course Code"
        description="Use AI to generate unique course codes based on your parameters"
        size="lg"
      >
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-linear-to-r from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 border border-violet-100 dark:border-violet-800">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-violet-500 mt-0.5" />
              <div>
                <p className="font-medium text-violet-900 dark:text-violet-100">
                  AI-Powered Code Generation
                </p>
                <p className="text-sm text-violet-700 dark:text-violet-300 mt-1">
                  Our AI will analyze existing codes and suggest unique, compliant course
                  codes based on your university's naming conventions.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Select
              label="Department"
              placeholder="Select department"
              options={departments.map((d) => ({ value: d.id, label: `${d.code} - ${d.name}` }))}
              value={generateParams.department}
              onChange={(e) =>
                setGenerateParams((prev) => ({ ...prev, department: e.target.value }))
              }
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Course Type"
                placeholder="Select type"
                options={courseTypes}
                value={generateParams.type}
                onChange={(e) =>
                  setGenerateParams((prev) => ({ ...prev, type: e.target.value }))
                }
                required
              />
              <Select
                label="Semester"
                placeholder="Select semester"
                options={getSemesterOptions(generateParams.year)}
                value={generateParams.semester}
                onChange={(e) => {
                  const newSemester = e.target.value;
                  const correspondingYear = getYearForSemester(newSemester).toString();
                  setGenerateParams((prev) => ({ ...prev, semester: newSemester, year: correspondingYear }));
                }}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Year (Optional)"
                placeholder="Select year"
                options={[
                  { value: "", label: "Not specified" },
                  { value: "1", label: "1st Year" },
                  { value: "2", label: "2nd Year" },
                  { value: "3", label: "3rd Year" },
                  { value: "4", label: "4th Year" },
                ]}
                value={generateParams.year}
                onChange={(e) => {
                  const newYear = e.target.value;
                  setGenerateParams((prev) => ({ ...prev, year: newYear, semester: "" }));
                }}
              />
              <Select
                label="Specialization"
                placeholder="Select specialization"
                options={getSpecializations(departments.find(d => d.id === generateParams.department)?.name || '').map(s => ({ value: s, label: s }))}
                value={generateParams.specialization}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGenerateParams({ ...generateParams, specialization: e.target.value })}
              />
            </div>

            <Button
              onClick={handleGenerateCode}
              className="w-full"
              isLoading={isGenerating}
              disabled={
                !generateParams.department ||
                !generateParams.type ||
                !generateParams.semester
              }
            >
              <Sparkles className="h-4 w-4" />
              Generate Suggestions
            </Button>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Suggested Codes
              </h4>
              <div className="space-y-2">
                {suggestions.map((suggestion, i) => (
                  <motion.div
                    key={suggestion.code}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                        {suggestion.code}
                      </span>
                      {suggestion.isUnique ? (
                        <Badge variant="success">Available</Badge>
                      ) : (
                        <Badge variant="destructive">In Use</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 max-w-xs truncate">
                        {suggestion.explanation}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectSuggestion(suggestion)}
                        disabled={!suggestion.isUnique}
                      >
                        Use
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedCourse(null);
        }}
        title="Delete Course"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-zinc-600 dark:text-zinc-400">
            Are you sure you want to delete{" "}
            <strong>
              {selectedCourse?.code} - {selectedCourse?.name}
            </strong>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedCourse(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCourse}
              isLoading={isSubmitting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
