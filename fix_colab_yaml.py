import yaml
import os

# Sökvägen till din data.yaml
yaml_path = '/content/drive/MyDrive/dart_dataset/dataset/data.yaml'

if os.path.exists(yaml_path):
    with open(yaml_path, 'r') as f:
        data = yaml.safe_load(f)
    
    print(f"Old path: {data.get('path', 'Not set')}")
    
    # Sätt rätt sökväg för Colab
    data['path'] = '/content/drive/MyDrive/dart_dataset/dataset'
    
    with open(yaml_path, 'w') as f:
        yaml.dump(data, f)
        
    print(f"New path set to: {data['path']}")
    print("Success! Now try training again.")
else:
    print(f"Error: Could not find file at {yaml_path}")
