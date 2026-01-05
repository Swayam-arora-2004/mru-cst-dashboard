const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

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

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const requestHeaders: Record<string, string> = {
    ...headers,
  };

  if (token) {
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
    if (params?.department_id) query.set("department_id", params.department_id);
    return api<Student[]>(`/students?${query.toString()}`);
  },
  
  getById: (id: string) => api<Student>(`/students/${id}`),
  
  getByRoll: (rollNumber: string) => api<Student>(`/students/roll/${rollNumber}`),
  
  searchByRollNumber: (rollNumber: string) => api<Student>(`/students/roll/${rollNumber}`),
  
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
    api<Array<{ student_id: string; encoding: number[] }>>("/face/encodings"),
  
  match: (formData: FormData) =>
    api("/face/match", { method: "POST", body: formData, isFormData: true }),
  
  storeEncoding: (studentId: string, encoding: number[]) =>
    api(`/face/encoding/${studentId}`, {
      method: "POST",
      body: { encoding },
    }),
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
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  department_id?: string;
  designation?: string;
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
  department_id?: string;
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
}

export interface CreateCourseData {
  code: string;
  name: string;
  description?: string;
  credits?: number;
  type: "lecture" | "tutorial" | "lab" | "mooc" | "elective";
  department_id: string;
  semester: number;
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
