export const DEPARTMENT_SPECIALIZATIONS: Record<string, string[]> = {
  'default': ['General'],
  'Computer Science and Engineering (Specialization)': [
    'AI & Machine Learning',
    'Data Science',
    'Cybersecurity',
    'Cloud Computing',
    'Blockchain Technology',
    'General'
  ],
  'Electronics and Communication Engineering (Specialization)': [
    'VLSI Design',
    'Embedded Systems',
    'IoT',
    'Robotics',
    'Artificial Intelligence',
    'General'
  ],
  'Electronic and Electrical Engineering (Specialization)': [
    'Power Electronics',
    'Control Systems',
    'Renewable Energy Systems',
    'VLSI Design',
    'Robotics',
    'Communication Engineering',
    'General'
  ]
};

// Helper to get specializations by ID or Name
export const getSpecializations = (deptIdOrName: string) => {
  if (!deptIdOrName) return DEPARTMENT_SPECIALIZATIONS['default'];

  // 1. Try exact match (most reliable)
  if (DEPARTMENT_SPECIALIZATIONS[deptIdOrName]) {
    return DEPARTMENT_SPECIALIZATIONS[deptIdOrName];
  }

  const normalized = deptIdOrName.toUpperCase();

  // 2. Keyword-based matching for robustness (handling abbreviations or slight variations)
  if (normalized.includes('ELECTRONIC') && normalized.includes('ELECTRICAL')) {
    return DEPARTMENT_SPECIALIZATIONS['Electronic and Electrical Engineering (Specialization)'];
  }
  if (normalized.includes('ELECTRONICS') || normalized.includes('ECE') || normalized.includes('EC')) {
    return DEPARTMENT_SPECIALIZATIONS['Electronics and Communication Engineering (Specialization)'];
  }
  if (normalized.includes('COMPUTER') || normalized.includes('CSE') || normalized.includes('CS')) {
    return DEPARTMENT_SPECIALIZATIONS['Computer Science and Engineering (Specialization)'];
  }

  // 3. Fallback to normalized key check
  const normalizedKey = normalized.replace(/\s+/g, '');
  for (const key of Object.keys(DEPARTMENT_SPECIALIZATIONS)) {
    if (key === 'default') continue;
    const normalizedTarget = key.toUpperCase().replace(/\s+/g, '');
    if (normalizedKey.includes(normalizedTarget) || normalizedTarget.includes(normalizedKey)) {
      return DEPARTMENT_SPECIALIZATIONS[key];
    }
  }

  return DEPARTMENT_SPECIALIZATIONS['default'];
};
