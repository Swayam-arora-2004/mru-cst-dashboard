-- MRU Dashboard Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  year INTEGER NOT NULL CHECK (year >= 1 AND year <= 6),
  semester INTEGER NOT NULL CHECK (semester >= 1 AND semester <= 12),
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  specialization VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  designation VARCHAR(100) DEFAULT 'Teacher',
  specialization VARCHAR(255),
  profile_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES teachers(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  weekly_report BOOLEAN DEFAULT true,
  theme VARCHAR(20) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roll_number VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  year INTEGER NOT NULL CHECK (year >= 1 AND year <= 6),
  semester INTEGER NOT NULL CHECK (semester >= 1 AND semester <= 12),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  specialization VARCHAR(255),
  face_encoding JSONB,
  profile_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  credits INTEGER DEFAULT 3,
  type VARCHAR(50) NOT NULL CHECK (type IN ('lecture', 'tutorial', 'lab', 'mooc', 'elective')),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  semester INTEGER NOT NULL CHECK (semester >= 1 AND semester <= 12),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Student-Course enrollment (many-to-many)
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  grade VARCHAR(5),
  status VARCHAR(20) DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'completed', 'dropped')),
  UNIQUE(student_id, course_id)
);

-- Teacher-Course assignment (many-to-many)
CREATE TABLE IF NOT EXISTS course_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  academic_year VARCHAR(20),
  semester INTEGER,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(teacher_id, course_id, class_id, academic_year, semester)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_students_roll ON students(roll_number);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_department ON students(department_id);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_year ON students(year);
CREATE INDEX IF NOT EXISTS idx_students_year_semester ON students(year, semester);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_courses_department ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_courses_type ON courses(type);
CREATE INDEX IF NOT EXISTS idx_courses_semester ON courses(semester);
CREATE INDEX IF NOT EXISTS idx_courses_active ON courses(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_classes_department ON classes(department_id);
CREATE INDEX IF NOT EXISTS idx_classes_year ON classes(year);
CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);
CREATE INDEX IF NOT EXISTS idx_teachers_department ON teachers(department_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_course_assignments_teacher ON course_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_course_assignments_course ON course_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_assignments_class ON course_assignments(class_id);

-- Enable Row Level Security (RLS)
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow service role full access)
CREATE POLICY "Allow service role full access" ON departments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON user_preferences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON enrollments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON course_assignments FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for images bucket
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'images');

CREATE POLICY "Service role upload access" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'images');

CREATE POLICY "Service role delete access" ON storage.objects
FOR DELETE USING (bucket_id = 'images');

-- Insert sample departments
INSERT INTO departments (code, name) VALUES
  ('CSE', 'Computer Science and Engineering'),
  ('CSH', 'Computer Science and Engineering (Specialization)'),
  ('ECE', 'Electronics and Communication Engineering'),
  ('ECH', 'Electronics and Communication Engineering (Specialization)'),
  ('MEH', 'Mechanical Engineering'),
  ('EEE', 'Electronic and Electrical Engineering'),
  ('EEH', 'Electronic and Electrical Engineering (Specialization)'),
  ('ECS', 'Environmental & Computer Science'),
  ('CSS', 'Computer Science & Sustainability'),
  ('EDH', 'Education & Humanities')
ON CONFLICT (code) DO NOTHING;

-- Insert sample classes
INSERT INTO classes (name, year, semester, department_id, specialization)
SELECT 
  'B.Tech CSE FSD Year 4',
  4,
  8,
  id,
  'Full Stack Development'
FROM departments WHERE code = 'CSH'
ON CONFLICT DO NOTHING;

INSERT INTO classes (name, year, semester, department_id, specialization)
SELECT 
  'B.Tech CSE AIML Year 4',
  4,
  8,
  id,
  'Artificial Intelligence & Machine Learning'
FROM departments WHERE code = 'CSH'
ON CONFLICT DO NOTHING;

INSERT INTO classes (name, year, semester, department_id, specialization)
SELECT 
  'B.Tech Robotics & AI Year 4',
  4,
  8,
  id,
  'Robotics & Artificial Intelligence'
FROM departments WHERE code = 'CSE'
ON CONFLICT DO NOTHING;

-- Insert sample courses based on your datesheet
INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'CSH422B-T', 'Virtualization - Containers/Cloud', 'tutorial', id, 7, 3
FROM departments WHERE code = 'CSH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'CSH420B-T', 'Malware Analysis and Reverse Engineering', 'tutorial', id, 7, 3
FROM departments WHERE code = 'CSH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'EDH422', 'Biology', 'elective', id, 7, 2
FROM departments WHERE code = 'EDH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'ECS306B', 'E-Waste Management', 'lecture', id, 6, 3
FROM departments WHERE code = 'ECS'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'CSS325B', 'Green Computing', 'lecture', id, 6, 3
FROM departments WHERE code = 'CSS'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'CSH234', 'Environmental Ethics and Sustainable Development', 'lecture', id, 4, 3
FROM departments WHERE code = 'CSH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'MOOC-24O-CSH-307', 'Getting Started with Competitive Programming', 'mooc', id, 7, 2
FROM departments WHERE code = 'CSH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'MOOC-24O-CSH-301', 'Introduction to Machine Learning', 'mooc', id, 7, 2
FROM departments WHERE code = 'CSH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'ECH432B-T', 'Wireless Sensor Network', 'tutorial', id, 7, 3
FROM departments WHERE code = 'ECH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'MEH403B-T', 'Operation Research by Optimizing Technique', 'tutorial', id, 7, 3
FROM departments WHERE code = 'MEH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'ECH338B-T', 'Control System', 'tutorial', id, 6, 3
FROM departments WHERE code = 'ECH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'MEH412B', 'Theory of Machine & Machine Design', 'lecture', id, 7, 4
FROM departments WHERE code = 'MEH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'CSS401', 'Robot Operating System', 'lecture', id, 7, 3
FROM departments WHERE code = 'CSS'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'CSH410B-T', 'Convolutional Neural Network for Visual Recognition', 'tutorial', id, 7, 3
FROM departments WHERE code = 'CSH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (code, name, type, department_id, semester, credits)
SELECT 'ECH437B-T', 'Wireless Communication for RPA', 'tutorial', id, 7, 3
FROM departments WHERE code = 'ECH'
ON CONFLICT (code) DO NOTHING;
