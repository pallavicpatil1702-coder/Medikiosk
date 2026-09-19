const fs = require('fs');

const path = './src/lib/i18n.ts';
let content = fs.readFileSync(path, 'utf8');

const translations = {
  en: '"Previous Answers"',
  hi: '"पिछले जवाब"',
  mr: '"मागील उत्तरे"',
  bn: '"আগের উত্তর"',
  ta: '"முந்தைய பதில்கள்"',
  te: '"మునుపటి సమాధానాలు"',
  gu: '"અગાઉના જવાબો"',
  kn: '"ಹಿಂದಿನ ಉತ್ತರಗಳು"',
  ml: '"മുമ്പത്തെ ഉത്തരങ്ങൾ"'
};

const map = {
  '"Conversation": "Conversation",': '    "Previous Answers": "Previous Answers",',
  '"Conversation": "बातचीत",': '    "Previous Answers": "पिछले जवाब",',
  '"Conversation": "संभाषण",': '    "Previous Answers": "मागील उत्तरे",',
  '"Conversation": "কথোপকথন",': '    "Previous Answers": "আগের উত্তর",',
  '"Conversation": "உரையாடல்",': '    "Previous Answers": "முந்தைய பதில்கள்",',
  '"Conversation": "సంభాషణ",': '    "Previous Answers": "మునుపటి సమాధానాలు",',
  '"Conversation": "વાતચીત",': '    "Previous Answers": "અગાઉના જવાબો",',
  '"Conversation": "ಸಂಭಾಷಣೆ",': '    "Previous Answers": "ಹಿಂದಿನ ಉತ್ತರಗಳು",',
  '"Conversation": "സംഭാഷണം",': '    "Previous Answers": "മുമ്പത്തെ ഉത്തരങ്ങൾ",'
};

for (const [findStr, replaceStr] of Object.entries(map)) {
  content = content.replace(findStr, findStr + '\n' + replaceStr);
}

fs.writeFileSync(path, content);
console.log('Done!');
