import yaml
import os

# Sökvägen till filen på din lokala G:-disk
# Ändra denna om filen ligger någon annanstans
file_path = r"G:\Min enhet\dart_dataset\dataset\data.yaml"

if os.path.exists(file_path):
    print(f"Hittade filen: {file_path}")
    
    with open(file_path, 'r') as f:
        data = yaml.safe_load(f)
        
    print(f"Nuvarande 'path' i filen: {data.get('path')}")
    
    # Vi ändrar 'path' till det som Google Colab förväntar sig.
    # När du sedan öppnar den i Colab kommer den peka rätt.
    colab_path = "/content/drive/MyDrive/dart_dataset/dataset"
    data['path'] = colab_path
    
    with open(file_path, 'w') as f:
        yaml.dump(data, f)
        
    print(f"Uppdaterade 'path' till: {colab_path}")
    print("Klart! Nu kan du köra träningen i Colab igen.")

else:
    print(f"Kunde INTE hitta filen på: {file_path}")
    print("Kontrollera att Google Drive är igång och att sökvägen stämmer.")
