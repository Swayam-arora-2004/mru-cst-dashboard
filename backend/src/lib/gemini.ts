import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import logger from './logger';
import { CourseCodeParams } from '../types';

let genAI: GoogleGenerativeAI | null = null;

const getGenAI = (): GoogleGenerativeAI => {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return genAI;
};

export interface CourseCodeSuggestion {
  code: string;
  explanation: string;
  isUnique: boolean;
}

export const generateCourseCodeSuggestions = async (
  params: CourseCodeParams,
  existingCodes: string[]
): Promise<CourseCodeSuggestion[]> => {
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const typePrefix = {
      lecture: '',
      tutorial: 'T',
      lab: 'L',
      mooc: 'MOOC',
      elective: 'E',
    };

    const prompt = `You are a university course code generator. Generate 5 unique course codes based on these parameters:
    
    Department: ${params.department}
    Type: ${params.type} (${typePrefix[params.type] ? `suffix: -${typePrefix[params.type]}` : 'no suffix'})
    Semester: ${params.semester}
    Year: ${params.year || 'Not specified'}
    Specialization: ${params.specialization || 'Not specified'}
    
    Existing codes to avoid: ${existingCodes.join(', ')}
    
    Course code format examples from university:
    - CSH422B-T (Tutorial)
    - ECH432B-T (Tutorial)
    - MEH403B-T (Tutorial)
    - ECS306B (Lecture)
    - CSS325B (Lecture)
    - MOOC-24O-CSH-307 (MOOC course)
    - EDH422 (Elective)
    
    Rules:
    1. Department code should be 2-3 letters
    2. Course number should be 3 digits
    3. Add appropriate suffix based on type
    4. For MOOC, use format: MOOC-YYO-DEPT-NUM
    5. Avoid all existing codes listed above
    
    Return ONLY a JSON array with exactly 5 objects, each containing:
    - "code": the generated course code
    - "explanation": brief explanation of the code structure
    
    Example response:
    [{"code": "CSH425B", "explanation": "CSH: Computer Science, 425: Course number, B: Batch indicator"}, ...]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const suggestions: { code: string; explanation: string }[] = JSON.parse(jsonMatch[0]);
    
    return suggestions.map((s) => ({
      ...s,
      isUnique: !existingCodes.includes(s.code),
    }));
  } catch (error) {
    console.error('Gemini API Error:', error);
    // Fallback to basic code generation
    return generateFallbackCodes(params, existingCodes);
  }
};

const generateFallbackCodes = (
  params: CourseCodeParams,
  existingCodes: string[]
): CourseCodeSuggestion[] => {
  const deptCode = params.department.substring(0, 3).toUpperCase();
  const typeMap: Record<string, string> = {
    lecture: '',
    tutorial: '-T',
    lab: '-L',
    mooc: '',
    elective: '',
  };

  const suggestions: CourseCodeSuggestion[] = [];
  let baseNum = params.semester * 100 + 1;

  for (let i = 0; i < 5; i++) {
    let code: string;
    
    if (params.type === 'mooc') {
      const year = new Date().getFullYear().toString().slice(-2);
      code = `MOOC-${year}O-${deptCode}-${baseNum + i}`;
    } else {
      code = `${deptCode}${baseNum + i}B${typeMap[params.type]}`;
    }

    const isUnique = !existingCodes.includes(code);
    
    suggestions.push({
      code,
      explanation: `Auto-generated code for ${params.type} in ${params.department}`,
      isUnique,
    });
  }

  return suggestions;
};

export const validateCourseCode = async (
  code: string,
  existingCodes: string[]
): Promise<{ isValid: boolean; isDuplicate: boolean; suggestions: string[] }> => {
  const isDuplicate = existingCodes.includes(code);
  
  // Basic validation rules
  const isValid = /^[A-Z]{2,4}[0-9]{3}[A-Z]?(-[A-Z])?$|^MOOC-[0-9]{2}O-[A-Z]{2,4}-[0-9]{3}$/.test(code);

  let suggestions: string[] = [];
  
  if (isDuplicate || !isValid) {
    try {
      const ai = getGenAI();
      const model = ai.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = `The course code "${code}" is ${isDuplicate ? 'already in use' : 'invalid'}. 
      Suggest 3 alternative valid course codes similar to this one.
      Existing codes to avoid: ${existingCodes.slice(0, 20).join(', ')}
      Return only a JSON array of 3 strings with the suggested codes.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    }
  }

  return { isValid, isDuplicate, suggestions };
};
