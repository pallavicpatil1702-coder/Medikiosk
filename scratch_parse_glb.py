import struct
import json
import os

filepath = 'C:/Users/Pallavi/Downloads/ai-healthcare-intake-system/public/human.glb'

with open(filepath, 'rb') as f:
    f.read(12)
    chunk_len, = struct.unpack('<I', f.read(4))
    f.read(4)
    json_data = f.read(chunk_len).decode('utf-8')
    gltf = json.loads(json_data)
    
    global_min = [float('inf'), float('inf'), float('inf')]
    global_max = [float('-inf'), float('-inf'), float('-inf')]
    
    for accessor in gltf.get('accessors', []):
        if accessor.get('type') == 'VEC3' and accessor.get('min') and accessor.get('max'):
            amin = accessor['min']
            amax = accessor['max']
            for i in range(3):
                global_min[i] = min(global_min[i], amin[i])
                global_max[i] = max(global_max[i], amax[i])
                
    print(f"Global min: {global_min}")
    print(f"Global max: {global_max}")
