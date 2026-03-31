-- 1. Add specialization to teachers table
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS specialization VARCHAR(255);

-- 2. Update existing department names to match the requested format
UPDATE departments 
SET name = 'Computer Science and Engineering' 
WHERE code = 'CSE';

UPDATE departments 
SET name = 'Computer Science and Engineering (Specialization)' 
WHERE code = 'CSH';

UPDATE departments 
SET name = 'Electronics and Communication Engineering' 
WHERE code = 'ECE';

UPDATE departments 
SET name = 'Electronics and Communication Engineering (Specialization)' 
WHERE code = 'ECH';

-- Mechanical Engineering (MEH) already matches the requested format.

-- 3. Insert new Electronic and Electrical Engineering departments
INSERT INTO departments (code, name) VALUES
  ('EEE', 'Electronic and Electrical Engineering'),
  ('EEH', 'Electronic and Electrical Engineering (Specialization)')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
