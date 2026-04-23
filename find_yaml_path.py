import os

# Vi använder dubbla backslash för att undvika problem
start_dir = "G:\\Min enhet"

print("Letar efter data.yaml...")

for root, dirs, files in os.walk(start_dir):
    if "data.yaml" in files:
        full_path = os.path.join(root, "data.yaml")
        
        print("--------------------------------")
        print("HITTADE FILEN:")
        print(full_path)
        
        # Ersätt text manuellt utan krångliga tecken
        colab_path = full_path.replace("G:\\Min enhet", "/content/drive/MyDrive")
        colab_path = colab_path.replace("\\", "/")
        
        print("--------------------------------")
        print("I COLAB SKA DET VARA:")
        print(colab_path)
        print("--------------------------------")

print("Klart.")
