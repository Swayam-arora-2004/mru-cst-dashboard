"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, Eye, Users, Camera, Upload, X, ImagePlus, Info } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { studentsApi, generalApi, faceRecognitionApi, Student, Department, Class } from "@/lib/api";
import { debounce, formatDate } from "@/lib/utils";
import { API_CONFIG } from "@/lib/constants";
import { getSemesterOptions, getYearForSemester } from "@/lib/yearSemesterUtils";
import * as faceapi from '@vladmandic/face-api';

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
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSpecialization, setSelectedSpecialization] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBulkPhotoModalOpen, setIsBulkPhotoModalOpen] = useState(false);
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
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [bulkPhotoFiles, setBulkPhotoFiles] = useState<File[]>([]);
  const [bulkPhotoResults, setBulkPhotoResults] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  
  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        semester: selectedSemester ? parseInt(selectedSemester) : undefined,
        class_id: selectedClass || undefined,
        specialization: selectedSpecialization || undefined,
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
  }, [pagination.page, pagination.limit, search, selectedDepartment, selectedYear, selectedSemester, selectedClass, selectedSpecialization]);

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

    const loadFaceModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setModelsLoaded(true);
      } catch (e) {
        console.error("Failed to load browser face models:", e);
      }
    };
    loadFaceModels();
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Step 1: Create the student
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

      if (response.success && response.data) {
        const studentId = response.data.id;
        
        // Step 2: Upload image if selected
        if (selectedImage) {
          const formDataImg = new FormData();
          formDataImg.append("image", selectedImage);
          
          if (modelsLoaded) {
            try {
              const img = await faceapi.bufferToImage(selectedImage);
              const detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
                                      .withFaceLandmarks()
                                      .withFaceDescriptor();
              if (detection) {
                formDataImg.append("face_encoding", JSON.stringify(Array.from(detection.descriptor)));
              } else {
                toast.warning("Warning: No clear face detected in the photo. AI scanning will be disabled for this student unless you provide a clear photo.");
              }
            } catch (err) {
              console.error("Failed native face encoding:", err);
            }
          }
          
          try {
            await studentsApi.uploadImage(studentId, formDataImg);
          } catch (imgError) {
            console.error("Image upload error:", imgError);
            toast.error("Student created but image upload failed");
          }
        }
        
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
        // Upload new image if selected
        if (selectedImage) {
          const formDataImg = new FormData();
          formDataImg.append("image", selectedImage);
          
          if (modelsLoaded) {
            try {
              const img = await faceapi.bufferToImage(selectedImage);
              const detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
                                      .withFaceLandmarks()
                                      .withFaceDescriptor();
              if (detection) {
                formDataImg.append("face_encoding", JSON.stringify(Array.from(detection.descriptor)));
              } else {
                toast.warning("Warning: No clear face detected in the photo. AI scanning will be disabled for this student unless you provide a clear photo.");
              }
            } catch (err) {
              console.error("Failed native face encoding:", err);
            }
          }
          
          try {
            await studentsApi.uploadImage(selectedStudent.id, formDataImg);
          } catch (imgError) {
            console.error("Image upload error:", imgError);
            toast.error("Student updated but image upload failed");
          }
        }
        
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
    setSelectedImage(null);
    setImagePreview(null);
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Define column mapping (flexible naming)
        const mappedData = data.map((row: any) => {
          // Helper to find value regardless of case or common variations
          const find = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k => 
              keys.some(searchKey => k.trim().toLowerCase() === searchKey.toLowerCase())
            );
            return foundKey ? row[foundKey] : '';
          };

          return {
            name: find(['Name', 'Full Name']),
            class_name: find(['Class', 'Section']),
            roll_number: find(['Roll number', 'Roll Number', 'rollnumber', 'Roll No', 'Roll No.', 'Roll_No']),
            email: find(['Email', 'email', 'Email ID', 'Email_ID', 'Email ID']),
            phone: find(['Phone no', 'Phone No', 'phone', 'Phone Number', 'Phone']),
            year: find(['Year', 'year', 'Batch']),
            semester: find(['Semester', 'semester', 'Sem']),
            department_name: find(['Department', 'department', 'Dept', 'Dept.'])
          };
        }).filter(s => s.roll_number && s.name); // Filter out empty rows

        setBulkData(mappedData.filter(d => d.name || d.roll_number));
      } catch (err) {
        toast.error("Failed to parse Excel file");
      }
    };
    reader.readAsBinaryString(file);
  };

  const processBulkUpload = async () => {
    if (bulkData.length === 0) return;
    setIsSubmitting(true);
    try {
      const response = await studentsApi.bulkCreate(bulkData);
      if (response.success) {
        toast.success(response.message || `Successfully imported ${bulkData.length} students`);
        setIsBulkModalOpen(false);
        setBulkData([]);
        fetchStudents();
      }
    } catch (err: any) {
      toast.error(err.message || "Bulk import failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkPhotoUpload = async () => {
    if (bulkPhotoFiles.length === 0) return;
    setIsUploadingPhotos(true);
    setBulkPhotoResults(null);
    try {
      const formData = new FormData();
      bulkPhotoFiles.forEach(file => {
        formData.append("photos", file);
      });
      
      const response = await studentsApi.uploadBulkPhotos(formData);
      if (response.success) {
        setBulkPhotoResults((response as any).results);
        toast.success(response.message);
        fetchStudents();
      }
    } catch (err: any) {
      toast.error(err.message || "Photo upload failed");
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
    // Set existing image as preview if available
    if (student.profile_image_url) {
      setImagePreview(student.profile_image_url);
    }
    setIsEditModalOpen(true);
  };

  // Reusable form JSX renderer
  const renderStudentForm = (onSubmit: (e: React.FormEvent) => void, submitLabel: string) => (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Profile Image Upload */}
      <div className="flex flex-col items-center gap-4 p-4 border border-dashed border-border rounded-xl bg-muted/50">
        <div className="relative">
          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-zinc-800 shadow-lg"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="text-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {imagePreview ? "Change Photo" : "Upload Photo"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <p className="text-xs text-muted-foreground mt-2">
            JPG, PNG up to 5MB. Face will be auto-encoded.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Roll Number"
          placeholder="e.g., 2021CSE001"
          value={formData.roll_number}
          onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
          required
        />
        <Input
          label="Full Name"
          placeholder="e.g., John Doe"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          type="email"
          label="Email"
          placeholder="student@university.edu"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
        <Input
          type="tel"
          label="Phone"
          placeholder="+91 98765 43210"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>
      <Select
        label="Department"
        placeholder="Select department"
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
        value={formData.department_id}
        onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
        required
      />
      <Select
        label="Class"
        placeholder="Select class"
        options={classes.map((c) => ({ value: c.id, label: c.name }))}
        value={formData.class_id}
        onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
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
          onChange={(e) => {
            const newYear = e.target.value;
            setFormData({ ...formData, year: newYear, semester: "" });
          }}
          required
        />
        <Select
          label="Semester"
          placeholder="Select semester"
          options={getSemesterOptions(formData.year)}
          value={formData.semester}
          onChange={(e) => {
            const newSemester = e.target.value;
            const correspondingYear = getYearForSemester(newSemester).toString();
            setFormData({ ...formData, semester: newSemester, year: correspondingYear });
          }}
          required
          // hint={formData.year ? `Year ${formData.year} semesters only` : "Select year first"}
        />
      </div>
      <Input
        label="Specialization (Optional)"
        placeholder="e.g., Full Stack Development"
        value={formData.specialization}
        onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsBulkModalOpen(true)}>
              <Upload className="h-4 w-4" />
              Import Roster (Excel)
            </Button>
            <Button variant="outline" onClick={() => setIsBulkPhotoModalOpen(true)}>
              <Camera className="h-4 w-4" />
              Upload Photos
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Student
            </Button>
          </div>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by name, roll number, or email..."
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
                    <Select
                      label="Semester"
                      placeholder="All semesters"
                      options={[
                        { value: "", label: "All semesters" },
                        { value: "1", label: "Semester 1" },
                        { value: "2", label: "Semester 2" },
                        { value: "3", label: "Semester 3" },
                        { value: "4", label: "Semester 4" },
                        { value: "5", label: "Semester 5" },
                        { value: "6", label: "Semester 6" },
                        { value: "7", label: "Semester 7" },
                        { value: "8", label: "Semester 8" },
                      ]}
                      value={selectedSemester}
                      onChange={(e) => {
                        setSelectedSemester(e.target.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                    />
                    <Select
                      label="Class"
                      placeholder="All classes"
                      options={[
                        { value: "", label: "All classes" },
                        ...classes.map(c => ({ value: c.id, label: c.name }))
                      ]}
                      value={selectedClass}
                      onChange={(e) => {
                        setSelectedClass(e.target.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                    />
                    <Input
                      label="Specialization"
                      placeholder="e.g. AI-ML, Cloud"
                      value={selectedSpecialization}
                      onChange={(e) => {
                        setSelectedSpecialization(e.target.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                    />
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelectedDepartment("");
                          setSelectedYear("");
                          setSelectedSemester("");
                          setSelectedClass("");
                          setSelectedSpecialization("");
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
                        <Avatar size="lg">
                          <AvatarImage src={student.profile_image_url} alt={student.name} />
                          <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground truncate">
                            {student.name}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
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
                          <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
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
        {renderStudentForm(handleAddStudent, "Add Student")}
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
        {renderStudentForm(handleEditStudent, "Save Changes")}
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
              <Avatar size="xl">
                <AvatarImage src={selectedStudent.profile_image_url} alt={selectedStudent.name} />
                <AvatarFallback>{selectedStudent.name.charAt(0)}</AvatarFallback>
              </Avatar>
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
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => {
          setIsBulkModalOpen(false);
          setBulkData([]);
        }}
        title="Bulk Import Students"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-xl flex gap-3 text-sm">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-blue-900 dark:text-blue-200">Import Guidelines</p>
              <ul className="list-disc list-inside text-blue-800/80 dark:text-blue-300/80 space-y-1">
                <li><strong>Class Mapping</strong>: Short names like "A" are auto-mapped to "Section A".</li>
                <li><strong>Student Photos</strong>: Embedded images in Excel cells cannot be imported. Please use public <strong>URL links</strong> in the Photo column.</li>
              </ul>
            </div>
          </div>

          <div className="p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center space-y-4">
            <Upload className="h-10 w-10 text-zinc-400 mx-auto" />
            <div>
              <p className="font-medium">Upload Excel File</p>
              <p className="text-sm text-muted-foreground">Select your .xlsx file (8 columns)</p>
            </div>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleBulkFileChange}
              className="max-w-xs mx-auto"
            />
          </div>

          {bulkData.length > 0 && (
            <div className="space-y-4">
              <div className="max-h-60 overflow-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Roll No</th>
                      <th className="px-3 py-2">Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkData.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="px-3 py-2 truncate max-w-[100px]">{row.name}</td>
                        <td className="px-3 py-2 font-mono">{row.roll_number}</td>
                        <td className="px-3 py-2">{row.class_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Showing first 10 of {bulkData.length} records...
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setBulkData([])}>Clear</Button>
                <Button onClick={processBulkUpload} isLoading={isSubmitting}>
                  Import {bulkData.length} Students
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={isBulkPhotoModalOpen}
        onClose={() => {
          setIsBulkPhotoModalOpen(false);
          setBulkPhotoFiles([]);
          setBulkPhotoResults(null);
        }}
        title="Upload Student Photos"
      >
        <div className="space-y-4">
          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 p-4 rounded-xl flex gap-3 text-sm">
            <Info className="h-5 w-5 text-zinc-600 dark:text-zinc-400 shrink-0" />
            <div className="space-y-1 text-zinc-600 dark:text-zinc-400">
              <p className="font-medium text-zinc-900 dark:text-zinc-200">How to Bulk Upload Photos</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Name your files as <strong>ROLLNUMBER.jpg</strong> (e.g. 2K22CSUN01001.jpg)</li>
                <li>Photos will be automatically matched and AI-registered</li>
              </ul>
            </div>
          </div>

          {!bulkPhotoResults && (
            <div className="p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center space-y-4">
              <Camera className="h-10 w-10 text-zinc-400 mx-auto" />
              <div>
                <p className="font-medium">Select Photos</p>
                <p className="text-sm text-muted-foreground">Multiple JPG/PNG/WEBP files</p>
              </div>
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setBulkPhotoFiles(files);
                }}
                className="max-w-xs mx-auto"
              />
              {bulkPhotoFiles.length > 0 && (
                <div className="pt-4 flex flex-col gap-2">
                  <p className="text-sm font-medium">{bulkPhotoFiles.length} photos selected</p>
                  <Button 
                    onClick={handleBulkPhotoUpload} 
                    isLoading={isUploadingPhotos}
                    className="w-full"
                  >
                    Start Upload & AI Processing
                  </Button>
                </div>
              )}
            </div>
          )}

          {bulkPhotoResults && (
            <div className="space-y-4">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800 text-sm">
                <p className="font-medium mb-2">Import Results</p>
                <div className="flex gap-4">
                  <div className="flex-1 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md">
                    <p className="text-xl font-bold">{bulkPhotoResults.successCount}</p>
                    <p className="text-xs">Successfully matched</p>
                  </div>
                  <div className="flex-1 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
                    <p className="text-xl font-bold">{bulkPhotoResults.failCount}</p>
                    <p className="text-xs">Failed / Not Found</p>
                  </div>
                </div>
              </div>
              
              {bulkPhotoResults.errors.length > 0 && (
                <div className="max-h-40 overflow-auto border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-[10px] space-y-1 font-mono">
                  {bulkPhotoResults.errors.map((err: string, i: number) => (
                    <div key={i} className="text-red-500">{err}</div>
                  ))}
                </div>
              )}

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setBulkPhotoFiles([]);
                  setBulkPhotoResults(null);
                }}
              >
                Reset for new batch
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
