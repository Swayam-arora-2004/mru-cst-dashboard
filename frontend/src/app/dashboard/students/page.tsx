"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, Eye, Users } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { studentsApi, generalApi, Student, Department, Class } from "@/lib/api";
import { debounce, formatDate } from "@/lib/utils";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    roll_number: "",
    name: "",
    email: "",
    phone: "",
    class_id: "",
    year: "",
    semester: "",
    department_id: "",
    specialization: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch students
  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await studentsApi.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        department_id: selectedDepartment || undefined,
        year: selectedYear ? parseInt(selectedYear) : undefined,
      });

      if (response.success && response.data) {
        setStudents(response.data);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      }
    } catch (error) {
      toast.error("Failed to fetch students");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, search, selectedDepartment, selectedYear]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearch(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300),
    []
  );

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    // Fetch departments and classes
    generalApi.getDepartments().then((res) => {
      if (res.success && res.data) setDepartments(res.data);
    });
    generalApi.getClasses({}).then((res) => {
      if (res.success && res.data) setClasses(res.data);
    });
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await studentsApi.create({
        roll_number: formData.roll_number,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        class_id: formData.class_id,
        year: parseInt(formData.year),
        semester: parseInt(formData.semester),
        department_id: formData.department_id,
        specialization: formData.specialization || undefined,
      });

      if (response.success) {
        toast.success("Student added successfully");
        setIsAddModalOpen(false);
        resetForm();
        fetchStudents();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add student");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setIsSubmitting(true);

    try {
      const response = await studentsApi.update(selectedStudent.id, {
        roll_number: formData.roll_number,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        class_id: formData.class_id,
        year: parseInt(formData.year),
        semester: parseInt(formData.semester),
        department_id: formData.department_id,
        specialization: formData.specialization || undefined,
      });

      if (response.success) {
        toast.success("Student updated successfully");
        setIsEditModalOpen(false);
        resetForm();
        fetchStudents();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update student");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;
    setIsSubmitting(true);

    try {
      const response = await studentsApi.delete(selectedStudent.id);
      if (response.success) {
        toast.success("Student deleted successfully");
        setIsDeleteModalOpen(false);
        setSelectedStudent(null);
        fetchStudents();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete student");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      roll_number: "",
      name: "",
      email: "",
      phone: "",
      class_id: "",
      year: "",
      semester: "",
      department_id: "",
      specialization: "",
    });
    setSelectedStudent(null);
  };

  const openEditModal = (student: Student) => {
    setSelectedStudent(student);
    setFormData({
      roll_number: student.roll_number,
      name: student.name,
      email: student.email,
      phone: student.phone || "",
      class_id: student.class_id,
      year: student.year.toString(),
      semester: student.semester.toString(),
      department_id: student.department_id,
      specialization: student.specialization || "",
    });
    setIsEditModalOpen(true);
  };

  const StudentForm = ({ onSubmit, submitLabel }: { onSubmit: (e: React.FormEvent) => void; submitLabel: string }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Roll Number"
          placeholder="e.g., 2021CSE001"
          value={formData.roll_number}
          onChange={(e) => setFormData((prev) => ({ ...prev, roll_number: e.target.value }))}
          required
        />
        <Input
          label="Full Name"
          placeholder="e.g., John Doe"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          type="email"
          label="Email"
          placeholder="student@university.edu"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          required
        />
        <Input
          type="tel"
          label="Phone"
          placeholder="+91 98765 43210"
          value={formData.phone}
          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
        />
      </div>
      <Select
        label="Department"
        placeholder="Select department"
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
        value={formData.department_id}
        onChange={(e) => setFormData((prev) => ({ ...prev, department_id: e.target.value }))}
        required
      />
      <Select
        label="Class"
        placeholder="Select class"
        options={classes.map((c) => ({ value: c.id, label: c.name }))}
        value={formData.class_id}
        onChange={(e) => setFormData((prev) => ({ ...prev, class_id: e.target.value }))}
        required
      />
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
          onChange={(e) => setFormData((prev) => ({ ...prev, year: e.target.value }))}
          required
        />
        <Select
          label="Semester"
          placeholder="Select semester"
          options={Array.from({ length: 8 }, (_, i) => ({
            value: (i + 1).toString(),
            label: `Semester ${i + 1}`,
          }))}
          value={formData.semester}
          onChange={(e) => setFormData((prev) => ({ ...prev, semester: e.target.value }))}
          required
        />
      </div>
      <Input
        label="Specialization (Optional)"
        placeholder="e.g., Full Stack Development"
        value={formData.specialization}
        onChange={(e) => setFormData((prev) => ({ ...prev, specialization: e.target.value }))}
      />
      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
            resetForm();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="min-h-screen">
      <Header
        title="Students"
        description="Manage student records and information"
        action={
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Student
          </Button>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by name, roll number, or email..."
              icon={<Search className="h-4 w-4" />}
              onChange={(e) => debouncedSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "bg-zinc-100 dark:bg-zinc-800" : ""}
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
                    <Select
                      label="Year"
                      placeholder="All years"
                      options={[
                        { value: "", label: "All years" },
                        { value: "1", label: "1st Year" },
                        { value: "2", label: "2nd Year" },
                        { value: "3", label: "3rd Year" },
                        { value: "4", label: "4th Year" },
                      ]}
                      value={selectedYear}
                      onChange={(e) => {
                        setSelectedYear(e.target.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                    />
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelectedDepartment("");
                          setSelectedYear("");
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

        {/* Students List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner size="lg" />
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6 text-zinc-400" />}
            title="No students found"
            description="Get started by adding your first student"
            action={
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Student
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((student, index) => (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card hover className="group">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Avatar
                          src={student.profile_image_url}
                          fallback={student.name}
                          size="lg"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-zinc-900 dark:text-white truncate">
                            {student.name}
                          </h3>
                          <p className="text-sm text-zinc-500 truncate">
                            {student.roll_number}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="secondary">
                              Year {student.year}
                            </Badge>
                            <Badge variant="outline">
                              Sem {student.semester}
                            </Badge>
                          </div>
                        </div>
                        <div className="relative">
                          <button className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          <div className="absolute right-0 top-full mt-1 w-40 py-1 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            <button
                              onClick={() => {
                                setSelectedStudent(student);
                                setIsViewModalOpen(true);
                              }}
                              className="w-full px-4 py-2 text-sm text-left text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View Details
                            </button>
                            <button
                              onClick={() => openEditModal(student)}
                              className="w-full px-4 py-2 text-sm text-left text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setSelectedStudent(student);
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
                  {pagination.total} students
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

      {/* Add Student Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForm();
        }}
        title="Add New Student"
        description="Enter the student's information below"
        size="lg"
      >
        <StudentForm onSubmit={handleAddStudent} submitLabel="Add Student" />
      </Modal>

      {/* Edit Student Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          resetForm();
        }}
        title="Edit Student"
        description="Update the student's information"
        size="lg"
      >
        <StudentForm onSubmit={handleEditStudent} submitLabel="Save Changes" />
      </Modal>

      {/* View Student Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedStudent(null);
        }}
        title="Student Details"
        size="md"
      >
        {selectedStudent && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar
                src={selectedStudent.profile_image_url}
                fallback={selectedStudent.name}
                size="xl"
              />
              <div>
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">
                  {selectedStudent.name}
                </h3>
                <p className="text-zinc-500">{selectedStudent.roll_number}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-500">Email</p>
                <p className="font-medium text-zinc-900 dark:text-white">
                  {selectedStudent.email}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Phone</p>
                <p className="font-medium text-zinc-900 dark:text-white">
                  {selectedStudent.phone || "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Year / Semester</p>
                <p className="font-medium text-zinc-900 dark:text-white">
                  Year {selectedStudent.year} / Sem {selectedStudent.semester}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Department</p>
                <p className="font-medium text-zinc-900 dark:text-white">
                  {selectedStudent.departments?.name || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Class</p>
                <p className="font-medium text-zinc-900 dark:text-white">
                  {selectedStudent.classes?.name || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Specialization</p>
                <p className="font-medium text-zinc-900 dark:text-white">
                  {selectedStudent.specialization || "None"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Face Data</p>
                <Badge variant={selectedStudent.face_encoding ? "success" : "secondary"}>
                  {selectedStudent.face_encoding ? "Registered" : "Not registered"}
                </Badge>
              </div>
              <div>
                <p className="text-zinc-500">Added</p>
                <p className="font-medium text-zinc-900 dark:text-white">
                  {formatDate(selectedStudent.created_at)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedStudent(null);
        }}
        title="Delete Student"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-zinc-600 dark:text-zinc-400">
            Are you sure you want to delete <strong>{selectedStudent?.name}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedStudent(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteStudent}
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
