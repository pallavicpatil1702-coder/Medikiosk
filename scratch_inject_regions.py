import re
import os

i18n_path = 'C:/Users/Pallavi/Downloads/ai-healthcare-intake-system/src/lib/i18n.ts'

with open(i18n_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_regions = {
    'neck': {'en': 'Neck', 'hi': 'गर्दन', 'mr': 'मान'},
    'center_head': {'en': 'Center Head', 'hi': 'सिर का मध्य भाग', 'mr': 'डोक्याचा मध्य भाग'},
    'left_head': {'en': 'Left Head', 'hi': 'सिर का बायां भाग', 'mr': 'डोक्याचा डावा भाग'},
    'right_head': {'en': 'Right Head', 'hi': 'सिर का दायां भाग', 'mr': 'डोक्याचा उजवा भाग'},
    'jaw': {'en': 'Jaw', 'hi': 'जबड़ा', 'mr': 'जबडा'},
    'left_jaw': {'en': 'Left Jaw', 'hi': 'बायां जबड़ा', 'mr': 'डावा जबडा'},
    'right_jaw': {'en': 'Right Jaw', 'hi': 'दायां जबड़ा', 'mr': 'उजवा जबडा'},
    'left_neck': {'en': 'Left Neck', 'hi': 'बायां गला', 'mr': 'डावी मान'},
    'right_neck': {'en': 'Right Neck', 'hi': 'दायां गला', 'mr': 'उजवी मान'},
    'center_chest': {'en': 'Center Chest', 'hi': 'छाती का मध्य भाग', 'mr': 'छातीचा मध्य भाग'},
    'left_chest': {'en': 'Left Chest', 'hi': 'बायीं छाती', 'mr': 'डावी छाती'},
    'right_chest': {'en': 'Right Chest', 'hi': 'दायीं छाती', 'mr': 'उजवी छाती'},
    'center_upper_abdomen': {'en': 'Center Upper Abdomen', 'hi': 'ऊपरी पेट (मध्य)', 'mr': 'वरचे पोट (मध्य)'},
    'left_upper_abdomen': {'en': 'Left Upper Abdomen', 'hi': 'बायां ऊपरी पेट', 'mr': 'डावे वरचे पोट'},
    'right_upper_abdomen': {'en': 'Right Upper Abdomen', 'hi': 'दायां ऊपरी पेट', 'mr': 'उजवे वरचे पोट'},
    'center_lower_abdomen': {'en': 'Center Lower Abdomen', 'hi': 'निचला पेट (मध्य)', 'mr': 'खालचे पोट (मध्य)'},
    'left_lower_abdomen': {'en': 'Left Lower Abdomen', 'hi': 'बायां निचला पेट', 'mr': 'डावे खालचे पोट'},
    'right_lower_abdomen': {'en': 'Right Lower Abdomen', 'hi': 'दायां निचला पेट', 'mr': 'उजवे खालचे पोट'},
    'center_pelvis': {'en': 'Center Pelvis', 'hi': 'पेड़ू (मध्य)', 'mr': 'ओटीपोट (मध्य)'},
    'left_pelvis': {'en': 'Left Pelvis', 'hi': 'बायां पेड़ू', 'mr': 'डावे ओटीपोट'},
    'right_pelvis': {'en': 'Right Pelvis', 'hi': 'दायां पेड़ू', 'mr': 'उजवे ओटीपोट'},
    'center_head_back': {'en': 'Back of Head (Center)', 'hi': 'सिर का पिछला हिस्सा (मध्य)', 'mr': 'डोक्याचा मागचा भाग (मध्य)'},
    'left_head_back': {'en': 'Back of Head (Left)', 'hi': 'सिर का पिछला हिस्सा (बायां)', 'mr': 'डोक्याचा मागचा भाग (डावा)'},
    'right_head_back': {'en': 'Back of Head (Right)', 'hi': 'सिर का पिछला हिस्सा (दायां)', 'mr': 'डोक्याचा मागचा भाग (उजवा)'},
    'nape': {'en': 'Nape (Back of Neck)', 'hi': 'गर्दन का पिछला हिस्सा', 'mr': 'मानेचा मागचा भाग'},
    'left_neck_back': {'en': 'Left Back of Neck', 'hi': 'गर्दन का पिछला हिस्सा (बायां)', 'mr': 'मानेचा मागचा भाग (डावा)'},
    'right_neck_back': {'en': 'Right Back of Neck', 'hi': 'गर्दन का पिछला हिस्सा (दायां)', 'mr': 'मानेचा मागचा भाग (उजवा)'},
    'center_upper_back': {'en': 'Center Upper Back', 'hi': 'ऊपरी पीठ (मध्य)', 'mr': 'वरची पाठ (मध्य)'},
    'left_upper_back': {'en': 'Left Upper Back', 'hi': 'बायीं ऊपरी पीठ', 'mr': 'डावी वरची पाठ'},
    'right_upper_back': {'en': 'Right Upper Back', 'hi': 'दायीं ऊपरी पीठ', 'mr': 'उजवी वरची पाठ'},
    'center_middle_back': {'en': 'Center Middle Back', 'hi': 'मध्य पीठ', 'mr': 'मधली पाठ'},
    'left_middle_back': {'en': 'Left Middle Back', 'hi': 'बायीं मध्य पीठ', 'mr': 'डावी मधली पाठ'},
    'right_middle_back': {'en': 'Right Middle Back', 'hi': 'दायीं मध्य पीठ', 'mr': 'उजवी मधली पाठ'},
    'center_lower_back': {'en': 'Center Lower Back', 'hi': 'निचली पीठ (मध्य)', 'mr': 'खालची पाठ (मध्य)'},
    'left_lower_back': {'en': 'Left Lower Back', 'hi': 'बायीं निचली पीठ', 'mr': 'डावी खालची पाठ'},
    'right_lower_back': {'en': 'Right Lower Back', 'hi': 'दायीं निचली पीठ', 'mr': 'उजवी खालची पाठ'},
    'center_pelvis_back': {'en': 'Center Lower Back/Tailbone', 'hi': 'टेलबोन/निचला हिस्सा', 'mr': 'माकडहाड'},
    'left_pelvis_back': {'en': 'Left Lower Back/Glute', 'hi': 'बायां कूल्हा', 'mr': 'डावे नितंब'},
    'right_pelvis_back': {'en': 'Right Lower Back/Glute', 'hi': 'दायां कूल्हा', 'mr': 'उजवे नितंब'}
}

# Add arms/legs translations just in case
arms_legs = {
    'left_shoulder': {'en': 'Left Shoulder', 'hi': 'बायां कंधा', 'mr': 'डावा खांदा'},
    'right_shoulder': {'en': 'Right Shoulder', 'hi': 'दायां कंधा', 'mr': 'उजवा खांदा'},
    'left_upper_arm': {'en': 'Left Upper Arm', 'hi': 'बायां ऊपरी हाथ', 'mr': 'डावा वरचा हात'},
    'right_upper_arm': {'en': 'Right Upper Arm', 'hi': 'दायां ऊपरी हाथ', 'mr': 'उजवा वरचा हात'},
    'left_elbow': {'en': 'Left Elbow', 'hi': 'बायीं कोहनी', 'mr': 'डावा कोपर'},
    'right_elbow': {'en': 'Right Elbow', 'hi': 'दायीं कोहनी', 'mr': 'उजवा कोपर'},
    'left_forearm': {'en': 'Left Forearm', 'hi': 'बायां निचला हाथ', 'mr': 'डावा खालचा हात'},
    'right_forearm': {'en': 'Right Forearm', 'hi': 'दायां निचला हाथ', 'mr': 'उजवा खालचा हात'},
    'left_hand': {'en': 'Left Hand', 'hi': 'बायां हाथ', 'mr': 'डावा हात'},
    'right_hand': {'en': 'Right Hand', 'hi': 'दायां हाथ', 'mr': 'उजवा हात'},
    'left_thigh': {'en': 'Left Thigh', 'hi': 'बायीं जांघ', 'mr': 'डावी मांडी'},
    'right_thigh': {'en': 'Right Thigh', 'hi': 'दायीं जांघ', 'mr': 'उजवी मांडी'},
    'left_knee': {'en': 'Left Knee', 'hi': 'बायां घुटना', 'mr': 'डावा गुडघा'},
    'right_knee': {'en': 'Right Knee', 'hi': 'दायां घुटना', 'mr': 'उजवा गुडघा'},
    'left_lower_leg': {'en': 'Left Lower Leg', 'hi': 'बायां निचला पैर', 'mr': 'डावा खालचा पाय'},
    'right_lower_leg': {'en': 'Right Lower Leg', 'hi': 'दायां निचला पैर', 'mr': 'उजवा खालचा पाय'},
    'left_foot': {'en': 'Left Foot', 'hi': 'बायां पैर', 'mr': 'डावे पाऊल'},
    'right_foot': {'en': 'Right Foot', 'hi': 'दायां पैर', 'mr': 'उजवे पाऊल'}
}
new_regions.update(arms_legs)

def extract_section(content, lang_code):
    pattern = re.compile(rf"\b{lang_code}:\s*{{")
    match = pattern.search(content)
    if not match:
        return None, -1, -1
    
    start_idx = match.end()
    
    # Find the closing brace
    open_braces = 1
    idx = start_idx
    while idx < len(content) and open_braces > 0:
        if content[idx] == '{':
            open_braces += 1
        elif content[idx] == '}':
            open_braces -= 1
        idx += 1
        
    return content[start_idx:idx-1], start_idx, idx-1

for lang in ['en', 'hi', 'mr']:
    section, start, end = extract_section(content, lang)
    if not section:
        continue
    
    # For each key, check if it's in the SECTION, not the whole file
    injected_str = ""
    for key, langs in new_regions.items():
        if f'"{key}":' not in section and f"'{key}':" not in section:
            injected_str += f'\n    "{key}": "{langs[lang]}",'
            
    content = content[:start] + injected_str + content[start:]

with open(i18n_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Translations accurately injected.")
