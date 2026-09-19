import re
import os

i18n_path = 'C:/Users/Pallavi/Downloads/ai-healthcare-intake-system/src/lib/i18n.ts'

with open(i18n_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_terms = {
    'Affected Areas:': {'en': 'Affected Areas:', 'hi': 'प्रभावित क्षेत्र:', 'mr': 'प्रभावित भाग:'}
}

def extract_section(content, lang_code):
    pattern = re.compile(rf"\b{lang_code}:\s*{{")
    match = pattern.search(content)
    if not match: return None, -1, -1
    start_idx = match.end()
    open_braces = 1
    idx = start_idx
    while idx < len(content) and open_braces > 0:
        if content[idx] == '{': open_braces += 1
        elif content[idx] == '}': open_braces -= 1
        idx += 1
    return content[start_idx:idx-1], start_idx, idx-1

for lang in ['en', 'hi', 'mr']:
    section, start, end = extract_section(content, lang)
    if not section: continue
    injected_str = ""
    for key, langs in new_terms.items():
        if f'"{key}":' not in section and f"'{key}':" not in section:
            injected_str += f'\n    "{key}": "{langs[lang]}",'
    content = content[:start] + injected_str + content[start:]

with open(i18n_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Terms injected.")
