export function requiresBodyMap(chiefComplaint: string, selectedComplaints: string[] = []): boolean {
  // 1. Structured complaints check first (Primary source of truth)
  if (selectedComplaints && selectedComplaints.length > 0) {
    const triggerSelections = [
      'Pain', 'Headache', 'Stomach problem', 'Injury',
      'chest_pain', 'headache', 'abdominal_pain', 'back_pain', 'joint_pain'
    ];
    
    if (selectedComplaints.some(c => triggerSelections.includes(c))) {
      return true;
    }
  }

  // 2. Fallback to free-text analysis
  if (!chiefComplaint || chiefComplaint.trim() === '') {
    return false;
  }
  
  const lowerComplaint = chiefComplaint.toLowerCase();

  // Basic negation patterns
  const negations = [
    'no pain', 'not pain', 'don\'t have pain', 'dont have pain', 'pain free',
    'दर्द नहीं', 'nahi', 'vedna nahi', 'dukh nahi', 'no ache',
    'వ్యథ లేదు', 'నొప్పి లేదు', 'வலி இல்லை', 'ನೋವು ಇಲ್ಲ', 'വേദനയില്ല',
    'વ્યથા નથી', 'કોઈ દુખાવો નથી', 'ব্যথা নেই'
  ];

  if (negations.some(neg => lowerComplaint.includes(neg))) {
    return false;
  }

  // Multilingual keywords for physical discomfort / pain
  const triggerKeywords = [
    // English
    'pain', 'ache', 'injury', 'hurt', 'swelling', 'discomfort', 'stomach', 'chest', 'back', 'joint', 'cramp', 'sore', 'fracture', 'heavy', 'tightness',
    // Hindi
    'दर्द', 'पीड़ा', 'चोट', 'सूजन', 'पेट', 'छाती', 'पीठ', 'कमर', 'भारीपन',
    // Marathi
    'दुखत', 'वेदना', 'सूज', 'दुखापत', 'पोट', 'छाती', 'पाठ', 'अंगदुखी', 'जडपणा',
    // Bengali
    'ব্যথা', 'চোট', 'ফোলা', 'পেট', 'বুক', 'পিঠ',
    // Tamil
    'வலி', 'காயம்', 'வீக்கம்', 'வயிறு', 'நெஞ்சு', 'முதுகு',
    // Telugu
    'నొప్పి', 'గాయం', 'వాపు', 'కడుపు', 'ఛాతీ', 'వీపు',
    // Gujarati
    'દુખાવો', 'ઈજા', 'સોજો', 'પેટ', 'છાતી', 'પીઠ',
    // Kannada
    'ನೋವು', 'ಗಾಯ', 'ಊತ', 'ಹೊಟ್ಟೆ', 'ಎದೆ', 'ಬೆನ್ನು',
    // Malayalam
    'വേദന', 'പരിക്ക്', 'വീക്കം', 'വയറ്', 'നെഞ്ച്', 'പുറം'
  ];

  if (triggerKeywords.some(kw => lowerComplaint.includes(kw))) {
    return true;
  }

  return false;
}
