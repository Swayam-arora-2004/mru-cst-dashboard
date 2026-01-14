/**
 * Utility functions for year-semester synchronization
 * Year 1 = Semesters 1, 2
 * Year 2 = Semesters 3, 4
 * Year 3 = Semesters 5, 6
 * Year 4 = Semesters 7, 8
 */

export const getSemestersForYear = (year: number | string): number[] => {
  const yearNum = typeof year === 'string' ? parseInt(year) : year;
  if (!yearNum || yearNum < 1 || yearNum > 4) return [];
  
  const startSemester = (yearNum - 1) * 2 + 1;
  return [startSemester, startSemester + 1];
};

export const getYearForSemester = (semester: number | string): number => {
  const semNum = typeof semester === 'string' ? parseInt(semester) : semester;
  if (!semNum || semNum < 1 || semNum > 8) return 0;
  
  return Math.ceil(semNum / 2);
};

export const getSemesterOptions = (year?: number | string) => {
  if (!year) {
    // Return all semesters if no year selected
    return Array.from({ length: 8 }, (_, i) => ({
      value: (i + 1).toString(),
      label: `Semester ${i + 1}`,
    }));
  }
  
  const semesters = getSemestersForYear(year);
  return semesters.map((sem) => ({
    value: sem.toString(),
    label: `Semester ${sem}`,
  }));
};

export const getYearOptions = (semester?: number | string) => {
  const baseOptions = [
    { value: "1", label: "1st Year" },
    { value: "2", label: "2nd Year" },
    { value: "3", label: "3rd Year" },
    { value: "4", label: "4th Year" },
  ];
  
  if (!semester) {
    return baseOptions;
  }
  
  const year = getYearForSemester(semester);
  if (!year) return baseOptions;
  
  return baseOptions.filter((opt) => parseInt(opt.value) === year);
};
