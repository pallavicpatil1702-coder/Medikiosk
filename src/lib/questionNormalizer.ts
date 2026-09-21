import { Question } from './types';

export interface NormalizedOption {
  id: string;
  value: string;
  label: string;
  normalizedEnglishText?: string;
}

export type NormalizedQuestionType = 
  | 'yes_no' 
  | 'single' 
  | 'multi_choice' 
  | 'number' 
  | 'scale' 
  | 'duration' 
  | 'free_text';

export interface NormalizedQuestion {
  id: string;
  text: string;
  rawText: Record<string, string> | string;
  type: NormalizedQuestionType;
  options: NormalizedOption[];
  required: boolean;
  branch?: Record<string, string>;
  next?: string;
  red_flag?: boolean;
  example?: string;
  min?: number;
  max?: number;
  step?: number;
}

// Map of canonical Yes/No translations across supported languages
const YES_NO_PRESETS: Record<string, { yes: { label: string; value: string }; no: { label: string; value: string }; notSure: { label: string; value: string } }> = {
  hi: {
    yes: { label: 'हाँ (Haan)', value: 'Haan' },
    no: { label: 'नहीं (Nahin)', value: 'Nahin' },
    notSure: { label: 'पक्का नहीं (Pakka Nahin)', value: 'Pakka Nahin' },
  },
  mr: {
    yes: { label: 'होय (Hoy)', value: 'Hoy' },
    no: { label: 'नाही (Nahi)', value: 'Nahi' },
    notSure: { label: 'खात्री नाही (Khatri Nahi)', value: 'Khatri Nahi' },
  },
  en: {
    yes: { label: 'Yes', value: 'Yes' },
    no: { label: 'No', value: 'No' },
    notSure: { label: 'Not sure', value: 'Not sure' },
  },
  bn: {
    yes: { label: 'হ্যাঁ (Yes)', value: 'Yes' },
    no: { label: 'না (No)', value: 'No' },
    notSure: { label: 'নিশ্চিত নই (Not sure)', value: 'Not sure' },
  },
  ta: {
    yes: { label: 'ஆம் (Yes)', value: 'Yes' },
    no: { label: 'இல்லை (No)', value: 'No' },
    notSure: { label: 'நிச்சயமாக தெரியவில்லை', value: 'Not sure' },
  },
  te: {
    yes: { label: 'అవును (Yes)', value: 'Yes' },
    no: { label: 'కాదు (No)', value: 'No' },
    notSure: { label: 'ఖచ్చితంగా తెలియదు', value: 'Not sure' },
  },
  gu: {
    yes: { label: 'હા (Yes)', value: 'Yes' },
    no: { label: 'ના (No)', value: 'No' },
    notSure: { label: 'ચોક્કસ નથી', value: 'Not sure' },
  },
  kn: {
    yes: { label: 'ಹೌದು (Yes)', value: 'Yes' },
    no: { label: 'ಇಲ್ಲ (No)', value: 'No' },
    notSure: { label: 'ಖಚಿತವಿಲ್ಲ', value: 'Not sure' },
  },
  ml: {
    yes: { label: 'അതെ (Yes)', value: 'Yes' },
    no: { label: 'അല്ല (No)', value: 'No' },
    notSure: { label: 'ഉറപ്പില്ല', value: 'Not sure' },
  },
};

/**
 * Normalizes question text from various schemas into a displayable string
 */
export function extractQuestionText(raw: any, lang: string = 'en'): string {
  if (!raw) return '';
  
  // 1. Direct text property
  const textObj = raw.text ?? raw.question ?? raw.label ?? raw.title ?? raw.prompt ?? raw.questionText;
  
  if (typeof textObj === 'string') {
    return textObj;
  }
  
  if (textObj && typeof textObj === 'object') {
    return textObj[lang] || textObj['en'] || textObj['hi'] || Object.values(textObj)[0] || '';
  }
  
  return '';
}

/**
 * Normalizes question type based on explicit type first, respecting question configs
 */
export function normalizeQuestionType(rawType?: string, hasOptions: boolean = false): NormalizedQuestionType {
  const t = (rawType || '').toLowerCase().trim();
  
  if (t === 'yes_no' || t === 'yesno' || t === 'yes-no' || t === 'boolean' || t === 'yes_no_na') {
    return 'yes_no';
  }
  
  if (t === 'single' || t === 'single_choice' || t === 'choice' || t === 'radio' || t === 'select') {
    return 'single';
  }
  
  if (t === 'multi_choice' || t === 'multiple_choice' || t === 'checkbox' || t === 'open-choice') {
    return 'multi_choice';
  }
  
  if (t === 'number' || t === 'numeric' || t === 'integer' || t === 'decimal' || t === 'quantity') {
    return 'number';
  }
  
  if (t === 'scale' || t === 'rating' || t === 'range' || t === 'slider') {
    return 'scale';
  }
  
  if (t === 'duration') {
    return 'duration';
  }
  
  if (t === 'free_text' || t === 'text' || t === 'string' || t === 'open_ended') {
    return 'free_text';
  }
  
  // If type wasn't explicitly matched:
  if (hasOptions) {
    return 'single';
  }
  
  return 'free_text';
}

/**
 * Normalizes raw options from any supported schema (string[], object[], FHIR answerOption, etc.)
 */
export function normalizeRawOptions(rawOptions: any[], lang: string = 'en'): NormalizedOption[] {
  if (!Array.isArray(rawOptions)) return [];
  
  return rawOptions.map((opt, index) => {
    // 1. Plain string option
    if (typeof opt === 'string') {
      const trimmed = opt.trim();
      return {
        id: trimmed || `opt_${index}`,
        value: trimmed,
        label: trimmed,
        normalizedEnglishText: trimmed,
      };
    }
    
    // 2. Object-based option
    if (opt && typeof opt === 'object') {
      // FHIR answerOption format: { valueString: "..." } or { valueCoding: { code: "...", display: "..." } }
      if (opt.valueCoding) {
        const val = opt.valueCoding.code || opt.valueCoding.display || `opt_${index}`;
        const lbl = opt.valueCoding.display || opt.valueCoding.code || val;
        return {
          id: String(val),
          value: String(val),
          label: String(lbl),
          normalizedEnglishText: String(lbl),
        };
      }
      
      if (opt.valueString) {
        return {
          id: String(opt.valueString),
          value: String(opt.valueString),
          label: String(opt.valueString),
          normalizedEnglishText: String(opt.valueString),
        };
      }
      
      // Standard object: { label, value } or { text, id } or { name, code }
      const rawLabel = opt.label ?? opt.text ?? opt.display ?? opt.title ?? opt.name ?? opt.value;
      let labelStr = '';
      if (typeof rawLabel === 'object' && rawLabel !== null) {
        labelStr = rawLabel[lang] || rawLabel['en'] || Object.values(rawLabel)[0] || '';
      } else {
        labelStr = String(rawLabel ?? '');
      }
      
      const rawValue = opt.value ?? opt.id ?? opt.code ?? opt.key ?? labelStr ?? `opt_${index}`;
      const valueStr = String(rawValue);
      const englishText = typeof rawLabel === 'object' && rawLabel !== null && rawLabel['en']
        ? String(rawLabel['en'])
        : (opt.normalizedEnglishText || labelStr || valueStr);
        
      return {
        id: opt.id ? String(opt.id) : valueStr,
        value: valueStr,
        label: labelStr || valueStr,
        normalizedEnglishText: englishText,
      };
    }
    
    const strVal = String(opt);
    return {
      id: strVal,
      value: strVal,
      label: strVal,
      normalizedEnglishText: strVal,
    };
  });
}

/**
 * Generate standard Yes/No options for a given language or context.
 * In Hindi or Hinglish context, defaults to "Haan", "Nahin", "Pakka Nahin".
 */
export function getStandardYesNoOptions(lang: string = 'en', questionText: string = ''): NormalizedOption[] {
  // Check if the question text is Roman Hindi / Hinglish e.g. "Kya aapko..."
  const isHinglish = /\b(kya|aapko|hoti|hai|hain|dard|bukhar|ulti)\b/i.test(questionText);
  const effectiveLang = (isHinglish && lang === 'en') ? 'hi' : (YES_NO_PRESETS[lang] ? lang : 'en');
  const preset = YES_NO_PRESETS[effectiveLang] || YES_NO_PRESETS['en'];
  
  return [
    {
      id: 'yes',
      value: preset.yes.value,
      label: preset.yes.label,
      normalizedEnglishText: 'Yes',
    },
    {
      id: 'no',
      value: preset.no.value,
      label: preset.no.label,
      normalizedEnglishText: 'No',
    },
    {
      id: 'not_sure',
      value: preset.notSure.value,
      label: preset.notSure.label,
      normalizedEnglishText: 'Not sure',
    },
  ];
}

/**
 * Main normalization function that takes any question object and produces a consistent NormalizedQuestion
 */
export function normalizeQuestion(raw: any, lang: string = 'en'): NormalizedQuestion {
  if (!raw) {
    return {
      id: 'Q_EMPTY',
      text: '',
      rawText: '',
      type: 'free_text',
      options: [],
      required: false,
    };
  }

  const id = String(raw.id || raw.questionId || raw.linkId || raw.key || raw.code || 'Q_UNKNOWN');
  const text = extractQuestionText(raw, lang);
  const rawText = raw.text ?? raw.question ?? text;
  
  // Extract raw options from any supported property
  const rawOptionsList = raw.options || raw.choices || raw.answerOption || raw.answers || raw.items || raw.values;
  const hasConfiguredOptions = Array.isArray(rawOptionsList) && rawOptionsList.length > 0;
  
  // Normalize type
  const type = normalizeQuestionType(raw.type, hasConfiguredOptions);
  
  // Determine normalized options
  let options: NormalizedOption[] = [];
  
  if (hasConfiguredOptions) {
    // Preserves and normalizes configured options
    options = normalizeRawOptions(rawOptionsList, lang);
  } else if (type === 'yes_no') {
    // Generates localized Yes/No options (Haan/Nahin/Pakka Nahin for Hindi/Hinglish)
    options = getStandardYesNoOptions(lang, text);
  } else if (type === 'scale') {
    // Generates 0-10 rating scale
    options = Array.from({ length: 11 }, (_, i) => ({
      id: String(i),
      value: String(i),
      label: i === 0 ? '0 (None)' : i === 10 ? '10 (Worst)' : String(i),
      normalizedEnglishText: String(i),
    }));
  }
  
  return {
    id,
    text,
    rawText,
    type,
    options,
    required: Boolean(raw.required),
    branch: raw.branch,
    next: raw.next,
    red_flag: raw.red_flag,
    example: raw.example,
    min: raw.min,
    max: raw.max,
    step: raw.step,
  };
}

/**
 * Helper to normalize a recorded answer into standard English for clinical branching and handoff
 */
export function mapAnswerToNormalizedEnglish(answerValue: string, options?: NormalizedOption[]): string {
  if (!answerValue) return '';
  const trimmed = answerValue.trim();
  const lower = trimmed.toLowerCase();

  // 1. If options exist, check if option provides normalizedEnglishText
  if (options && options.length > 0) {
    const matched = options.find(o => 
      o.value.toLowerCase() === lower || 
      o.id.toLowerCase() === lower || 
      o.label.toLowerCase() === lower
    );
    if (matched?.normalizedEnglishText) {
      return matched.normalizedEnglishText;
    }
  }

  // 2. Deterministic Yes/No mapping for Indian languages
  if (lower.includes('pakka') || lower.includes('not sure') || lower.includes('खात्री') || lower.includes('khatri') || lower.includes('पक्का')) {
    return 'Not sure';
  }
  if (
    lower === 'haan' || lower === 'हाँ' || lower === 'होय' || lower === 'hoy' || lower === 'yes' || lower === 'true' ||
    lower.includes('haan') || lower.includes('हाँ') || lower.includes('होय') || lower.includes('hoy')
  ) {
    return 'Yes';
  }
  if (
    lower === 'nahin' || lower === 'नहीं' || lower === 'नाही' || lower === 'nahi' || lower === 'no' || lower === 'false' ||
    lower.includes('nahin') || lower.includes('नहीं') || lower.includes('नाही') || lower.includes('nahi')
  ) {
    return 'No';
  }

  return trimmed;
}
