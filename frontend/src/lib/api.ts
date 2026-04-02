const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: object | FormData;
  headers?: Record<string, string>;
  isFormData?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, headers = {}, isFormData = false } = options;

  let token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // Fallback: Check Zustand's persisted storage if direct token is null
  if (!token && typeof window !== "undefined") {
    const authStorage = localStorage.getItem("auth-storage");
    if (authStorage) {
      try {
        const parsed = JSON.parse(authStorage);
        token = parsed?.state?.token || null;
      } catch (e) {
        console.error("Failed to parse auth-storage", e);
      }
    }
  }

  const requestHeaders: Record<string, string> = {
    ...headers,
  };

  if (token && token !== "undefined" && token !== "null") {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (!isFormData) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const config: RequestInit = {
    method,
    headers: requestHeaders,
    credentials: "include",
  };

  if (body) {
    config.body = isFormData ? (body as FormData) : JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data.error || "Something went wrong");
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "Network error. Please try again.");
  }
}

// Auth endpoints
export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: User; token: string }>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  
  register: (data: RegisterData) =>
    api<{ user: User; token: string }>("/auth/register", {
      method: "POST",
      body: data,
    }),
  
  verify: () => api<{ user: User }>("/auth/verify"),
  
  getProfile: () => api<{ user: User }>("/auth/profile"),
  
  updateProfile: (data: UpdateProfileData) =>
    api<{ user: User }>("/auth/profile", {
      method: "PUT",
      body: data,
    }),
  
  changePassword: (data: ChangePasswordData) =>
    api("/auth/password", {
      method: "PUT",
      body: data,
    }),
  
  getPreferences: () => api<{ preferences: UserPreferences }>("/auth/preferences"),
  
  updatePreferences: (data: Partial<UserPreferences>) =>
    api<{ preferences: UserPreferences }>("/auth/preferences", {
      method: "PUT",
      body: data,
    }),
  
  uploadAvatar: (formData: FormData) =>
    api<{ user: User }>("/auth/avatar", {
      method: "POST",
      body: formData,
      isFormData: true,
    }),
};

// Students endpoints
export const studentsApi = {
  getAll: (params?: StudentFilters) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.search) query.set("search", params.search);
    if (params?.class_id) query.set("class_id", params.class_id);
    if (params?.year) query.set("year", params.year.toString());
    if (params?.semester) query.set("semester", params.semester.toString());
    if (params?.department_id) query.set("department_id", params.department_id);
    if (params?.specialization) query.set("specialization", params.specialization);
    return api<Student[]>(`/students?${query.toString()}`);
  },
  
  getById: (id: string) => api<Student>(`/students/${id}`),
  
  getByRoll: (rollNumber: string) => api<Student>(`/students/roll/${rollNumber}`),
  
  searchByRollNumber: (rollNumber: string) => api<Student>(`/students/roll/${rollNumber}`),
  
  bulkCreate: (students: any[]) => api<{ message: string; data: Student[] }>("/students/bulk", {
    method: "POST",
    body: { students },
  }),

  uploadBulkPhotos: (formData: FormData) => api<{ message: string; results: any }>("/students/bulk-photos", {
    method: "POST",
    body: formData,
    isFormData: true,
  }),

  create: (data: CreateStudentData) =>
    api<Student>("/students", { method: "POST", body: data }),
  
  update: (id: string, data: Partial<CreateStudentData>) =>
    api<Student>(`/students/${id}`, { method: "PUT", body: data }),
  
  delete: (id: string) => api(`/students/${id}`, { method: "DELETE" }),
  
  uploadImage: (id: string, formData: FormData) =>
    api<{ imageUrl: string }>(`/students/${id}/image`, {
      method: "POST",
      body: formData,
      isFormData: true,
    }),
};

// Courses endpoints
export const coursesApi = {
  getAll: (params?: CourseFilters) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.search) query.set("search", params.search);
    if (params?.type) query.set("type", params.type);
    if (params?.department_id) query.set("department_id", params.department_id);
    if (params?.semester) query.set("semester", params.semester.toString());
    if (params?.year) query.set("year", params.year.toString());
    return api<Course[]>(`/courses?${query.toString()}`);
  },
  
  getById: (id: string) => api<Course>(`/courses/${id}`),
  
  getByCode: (code: string) => api<Course>(`/courses/code/${code}`),
  
  getAllCodes: () => api<string[]>("/courses/codes"),
  
  create: (data: CreateCourseData) =>
    api<Course>("/courses", { method: "POST", body: data }),
  
  update: (id: string, data: Partial<CreateCourseData>) =>
    api<Course>(`/courses/${id}`, { method: "PUT", body: data }),
  
  delete: (id: string) => api(`/courses/${id}`, { method: "DELETE" }),
  
  generateCode: (params: CourseCodeParams) =>
    api<CourseCodeSuggestion[]>("/courses/generate-code", {
      method: "POST",
      body: params,
    }),
  
  validateCode: (code: string) =>
    api<CodeValidation>("/courses/validate-code", {
      method: "POST",
      body: { code },
    }),
};

// Face recognition endpoints
export const faceApi = {
  match: (formData: FormData) =>
    api("/face/match", { method: "POST", body: formData, isFormData: true }),
  
  getEncodings: () =>
    api<FaceEncoding[]>("/face/encodings"),
  
  storeEncoding: (studentId: string, encoding: number[]) =>
    api(`/face/encoding/${studentId}`, {
      method: "POST",
      body: { encoding },
    }),
  
  deleteEncoding: (studentId: string) =>
    api(`/face/encoding/${studentId}`, { method: "DELETE" }),
};

// Face recognition API (alias for use in face-recognition page)
export const faceRecognitionApi = {
  getAllEncodings: () =>
    api<Array<{ id: string; name: string; roll_number: string; face_encoding: number[]; profile_image_url: string | null }>>("/face/encodings"),
  
  match: (formData: FormData) =>
    api<{ student: Student; confidence: number; distance: number; scannedStudents: number }>("/face/match", { method: "POST", body: formData, isFormData: true }),
  
  storeEncoding: (studentId: string, encoding: number[]) =>
    api(`/face/encoding/${studentId}`, {
      method: "POST",
      body: { encoding },
    }),

  // Upload an image to auto-encode and save the student's face embedding
  encodeImage: (studentId: string, imageFile: File) => {
    const formData = new FormData();
    formData.append("image", imageFile);
    return api(`/face/encode-image/${studentId}`, { method: "POST", body: formData, isFormData: true });
  },

  deleteEncoding: (studentId: string) =>
    api(`/face/encoding/${studentId}`, { method: "DELETE" }),
};

// ─── Documents API ───────────────────────────────────────────────────────────

export type DocumentType =
  | "lesson_plan"
  | "co_po_mapping"
  | "lab_file"
  | "nba_report"
  | "naac_report"
  | "course_file"
  | "custom";

export interface DocumentSection {
  type: "heading1" | "heading2" | "paragraph" | "table" | "list";
  content: string;
  items?: string[];
  rows?: string[][];
}

export interface GenerateDocumentParams {
  documentType: DocumentType;
  subject?: string;
  subjectCode?: string;
  topic?: string;
  department?: string;
  year?: string;
  semester?: string;
  courseOutcomes?: string;
  programOutcomes?: string;
  customPrompt?: string;
  institution?: string;
  files?: File[];
}

export const documentsApi = {
  generate: async (params: GenerateDocumentParams): Promise<ApiResponse<{ sections: DocumentSection[]; title: string }>> => {
    const formData = new FormData();
    Object.entries(params).forEach(([key, value]) => {
      if (key !== "files" && value !== undefined && value !== "") {
        formData.append(key, value as string);
      }
    });
    if (params.files?.length) {
      params.files.forEach((f) => formData.append("files", f));
    }
    return api<{ sections: DocumentSection[]; title: string }>("/documents/generate", {
      method: "POST",
      body: formData,
      isFormData: true,
    });
  },

  downloadDocx: async (sections: DocumentSection[], title: string): Promise<void> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_URL}/documents/download/docx`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ sections, title }),
    });
    if (!res.ok) throw new Error("Failed to generate DOCX");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  },

  downloadPdf: async (sections: DocumentSection[], title: string): Promise<void> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_URL}/documents/download/pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ sections, title }),
    });
    if (!res.ok) throw new Error("Failed to generate PDF");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// General endpoints
export const generalApi = {
  getDepartments: () => api<Department[]>("/departments"),
  
  createDepartment: (data: { code: string; name: string }) =>
    api<Department>("/departments", { method: "POST", body: data }),
  
  getClasses: (params?: ClassFilters) => {
    const query = new URLSearchParams();
    if (params?.department_id) query.set("department_id", params.department_id);
    if (params?.year) query.set("year", params.year.toString());
    if (params?.semester) query.set("semester", params.semester.toString());
    return api<ClassInfo[]>(`/classes?${query.toString()}`);
  },
  
  createClass: (data: CreateClassData) =>
    api<ClassInfo>("/classes", { method: "POST", body: data }),
  
  getAcademicInfo: () =>
    api<AcademicInfo>("/academic-info"),
  
  getStats: () => api<DashboardStats>("/stats"),
  
  getSystemInfo: () => api<SystemInfo>("/system-info"),
};

// Types
export interface User {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  designation: string;
  department_id?: string;
  phone?: string;
  specialization?: string;
  profile_image_url?: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  department_id?: string;
  designation?: string;
  specialization?: string;
}

export interface UpdateProfileData {
  name?: string;
  phone?: string;
  designation?: string;
  department_id?: string;
  status?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyReport: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface Student {
  id: string;
  roll_number: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  class_id: string;
  year: number;
  semester: number;
  department_id: string;
  specialization?: string;
  face_encoding?: number[];
  profile_image_url?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  classes?: ClassInfo;
  departments?: Department;
}

export interface StudentFilters {
  page?: number;
  limit?: number;
  search?: string;
  class_id?: string;
  year?: number;
  semester?: number;
  department_id?: string;
  specialization?: string;
}

export interface CreateStudentData {
  roll_number: string;
  name: string;
  email: string;
  phone?: string;
  class_id: string;
  year: number;
  semester: number;
  department_id: string;
  specialization?: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  description?: string;
  credits: number;
  type: "lecture" | "tutorial" | "lab" | "mooc" | "elective";
  department_id: string;
  semester: number;
  year: number;
  class_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  departments?: Department;
}

export interface CourseFilters {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  department_id?: string;
  semester?: number;
  year?: number;
}

export interface CreateCourseData {
  code: string;
  name: string;
  description?: string;
  credits?: number;
  type: "lecture" | "tutorial" | "lab" | "mooc" | "elective";
  department_id: string;
  semester: number;
  year: number;
  class_id?: string;
}

export interface CourseCodeParams {
  department: string;
  type: "lecture" | "tutorial" | "lab" | "mooc" | "elective";
  semester: number;
  year?: number;
  specialization?: string;
}

export interface CourseCodeSuggestion {
  code: string;
  explanation: string;
  isUnique: boolean;
}

export interface CodeValidation {
  isValid: boolean;
  isDuplicate: boolean;
  suggestions: string[];
}

export interface Department {
  id: string;
  code: string;
  name: string;
  created_at: string;
}

export interface Class {
  id: string;
  name: string;
  year: number;
  semester: number;
  department_id: string;
  specialization?: string;
  created_at: string;
  departments?: Department;
}

// Alias for Class to use in components
export type ClassInfo = Class;

export interface ClassFilters {
  department_id?: string;
  year?: number;
  semester?: number;
}

export interface CreateClassData {
  name: string;
  year: number;
  semester: number;
  department_id: string;
  specialization?: string;
}

export interface AcademicInfo {
  years: number[];
  semesters: number[];
  specializations: string[];
}

export interface DashboardStats {
  counts: {
    students: number;
    courses: number;
    departments: number;
    classes: number;
  };
  recentStudents: Array<{
    id: string;
    name: string;
    roll_number: string;
    profile_image_url?: string;
    created_at: string;
  }>;
  recentCourses: Array<{
    id: string;
    code: string;
    name: string;
    created_at: string;
  }>;
}

export interface FaceEncoding {
  id: string;
  name: string;
  roll_number: string;
  face_encoding: number[];
  profile_image_url?: string;
}

export interface SystemInfo {
  application: {
    version: string;
    environment: string;
    frontend: {
      framework: string;
      version: string;
    };
    database: {
      type: string;
      engine: string;
    };
  };
  services: {
    supabase: {
      name: string;
      description: string;
      connected: boolean;
    };
    gemini: {
      name: string;
      description: string;
      connected: boolean;
    };
  };
  stats: {
    students: number;
    courses: number;
    departments: number;
    classes: number;
  };
}

// ─── Activities Tracker API ───────────────────────────────────────────────────

export interface ActivityRecord {
  id?: string;
  session_id?: string;
  assignment_id?: string;
  task_id?: string;
  student_id: string;
  status: 'present' | 'absent' | 'submitted' | 'missing' | 'late';
  notes?: string;
  marks_attained?: number;
  grade?: string;
  file_url?: string;
  feedback?: string;
  verification_status?: string;
  submitted_at?: string;
  created_at?: string;
}

export interface Activity {
  id: string;
  teacher_id: string;
  course_id: string;
  title: string;
  type: 'attendance' | 'assignment' | 'document';
  date: string;
  created_at: string;
  // Administrative context
  year?: number;
  semester?: number;
  class_id?: string;
  department_id?: string;
  // Specialized fields
  question_file_url?: string;
  max_marks?: number;
  due_date?: string;
  duration?: number;
  time_range?: string;
  description?: string;
  // Included records/submissions
  attendance_records?: ActivityRecord[];
  assignment_submissions?: ActivityRecord[];
  document_submissions?: ActivityRecord[];
}

export interface CreateActivityData {
  course_id: string;
  title: string;
  type: 'attendance' | 'assignment' | 'document';
  date: string;
  records: ActivityRecord[];
  max_marks?: number;
  due_date?: string;
  duration?: number;
  time_range?: string;
}

export const activitiesApi = {
  getAll: (courseId?: string) => {
    const query = courseId ? `?course_id=${courseId}` : '';
    return api<Activity[]>(`/activities${query}`);
  },
  
  create: (data: CreateActivityData | FormData) =>
    api<Activity>("/activities", { 
      method: "POST", 
      body: data,
      isFormData: data instanceof FormData 
    }),
    
  getMonthlyAttendanceStats: () => api<any[]>("/activities/stats/attendance/monthly"),

  getAttendanceHistory: (date: string, courseId?: string, year?: string, semester?: string, classId?: string, timeRange?: string) => {
    const query = new URLSearchParams({ date });
    if (courseId) query.append("course_id", courseId);
    if (year) query.append("year", year);
    if (semester) query.append("semester", semester);
    if (classId) query.append("class_id", classId);
    if (timeRange) query.append("time_range", timeRange);
    return api<any[]>(`/activities/attendance/history?${query.toString()}`);
  },

  update: (id: string, data: Partial<CreateActivityData>) =>
    api<Activity>(`/activities/${id}`, {
      method: "PATCH",
      body: data
    }),

  delete: (id: string) =>
    api<{ success: true }>(`/activities/${id}`, {
      method: "DELETE"
    }),
};

// ─── AI Evaluations API ───────────────────────────────────────────────────

export interface Evaluation {
  id: string;
  student_id: string;
  activity_id: string;
  teacher_id?: string;
  type: 'assignment' | 'document';
  grade: string;
  marks_attained: number | null;
  file_name: string;
  file_url?: string;
  source?: 'ai' | 'system'; 
  created_at: string;
  activities?: { title: string; max_marks?: number };
}

export const evaluationsApi = {
  evaluate: (formData: FormData) =>
    api<Evaluation>("/evaluations/evaluate", { 
      method: "POST", 
      body: formData,
      isFormData: true
    }),

  getForStudent: (studentId: string) =>
    api<Evaluation[]>(`/evaluations/student/${studentId}`),

  getForActivity: (activityId: string) =>
    api<Evaluation[]>(`/evaluations/activity/${activityId}`),

  update: (id: string, data: { grade?: string; marks_attained?: number }) =>
    api<Evaluation>(`/evaluations/${id}`, {
      method: "PATCH",
      body: data
    }),

  delete: (id: string) =>
    api<{ success: true }>(`/evaluations/${id}`, {
      method: "DELETE"
    }),
};
// ─── Notifications API ────────────────────────────────────────────────────────
export const notificationsApi = {
  subscribe: (subscription: any) =>
    api<{ message: string }>("/notifications/subscribe", {
      method: "POST",
      body: { subscription },
    }),

  test: () => api<{ email: any; push: any }>("/notifications/test", { method: "POST" }),
};
