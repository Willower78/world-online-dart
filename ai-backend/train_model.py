import os
import random
import cv2
import numpy as np
import time
from tqdm import tqdm
import gc
import yaml
from ultralytics import YOLO

# ==========================================
# KONFIGURATION
# ==========================================

# Mappar
BASE_DIR = os.getcwd()
DATASET_DIR = os.path.join(BASE_DIR, "dart_dataset")
MODELS_DIR = os.path.join(BASE_DIR, "models")

# Träningsparametrar
IMG_SIZE = 640          # YOLOv8 gillar 640x640
BATCH_SIZE = 16         # Justera ner om minnet tar slut
EPOCHS = 10             # Öka till 50-100 för en "riktig" modell
IMAGES_PER_CLASS = 100  # Öka till 1000+ för bättre resultat
DARTS_PER_IMG = (1, 3)  # Antal pilar per bild

# Skapa mappar om de inte finns
os.makedirs(MODELS_DIR, exist_ok=True)

# ==========================================
# DEL 1: DATASET GENERATOR (Förenklad)
# ==========================================

def get_class_list():
    # Enkel lista med dart-sektioner
    sectors = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
    classes = []
    for s in sectors:
        classes.append(f"SINGLE_{s}")
        classes.append(f"DOUBLE_{s}")
        classes.append(f"TRIPLE_{s}")
    classes.extend(["BULL_25", "BULL_50", "MISS"])
    return classes

CLASS_NAMES = get_class_list()

def create_dataset_structure():
    print("📁 Creating dataset structure...")
    for split in ["train", "val"]:
        os.makedirs(os.path.join(DATASET_DIR, "images", split), exist_ok=True)
        os.makedirs(os.path.join(DATASET_DIR, "labels", split), exist_ok=True)

def generate_synthetic_image(img_id, split):
    # Skapa en tom vit bild (här skulle man egentligen ladda in en bild på en darttavla)
    img = np.full((IMG_SIZE, IMG_SIZE, 3), 255, dtype=np.uint8)
    
    # Rita en enkel tavla (bara för att ha något att "se")
    center = (IMG_SIZE // 2, IMG_SIZE // 2)
    cv2.circle(img, center, int(IMG_SIZE*0.4), (0,0,0), 2)
    cv2.circle(img, center, int(IMG_SIZE*0.05), (0,0,255), -1) # Bullseye

    labels = []
    num_darts = random.randint(*DARTS_PER_IMG)
    
    for _ in range(num_darts):
        # Slumpa en position
        x = random.randint(0, IMG_SIZE-1)
        y = random.randint(0, IMG_SIZE-1)
        
        # Rita en "pil" (en grön prick)
        cv2.circle(img, (x, y), 5, (0, 255, 0), -1)
        
        # Slumpa en klass (i verkligheten skulle vi räkna ut detta baserat på x,y)
        class_id = random.randint(0, len(CLASS_NAMES) - 1)
        
        # YOLO format: class_id center_x center_y width height (normaliserat 0-1)
        norm_x = x / IMG_SIZE
        norm_y = y / IMG_SIZE
        w = 0.02 # Liten box runt pricken
        h = 0.02
        
        labels.append(f"{class_id} {norm_x} {norm_y} {w} {h}")

    # Spara bild
    filename = f"img_{img_id}.jpg"
    img_path = os.path.join(DATASET_DIR, "images", split, filename)
    cv2.imwrite(img_path, img)
    
    # Spara label
    label_path = os.path.join(DATASET_DIR, "labels", split, filename.replace(".jpg", ".txt"))
    with open(label_path, "w") as f:
        f.write("\n".join(labels))

def create_yaml_file():
    yaml_content = {
        'path': DATASET_DIR,
        'train': 'images/train',
        'val': 'images/val',
        'names': {i: name for i, name in enumerate(CLASS_NAMES)}
    }
    
    yaml_path = os.path.join(DATASET_DIR, "data.yaml")
    with open(yaml_path, 'w') as f:
        yaml.dump(yaml_content, f)
    return yaml_path

# ==========================================
# DEL 2: HUVUDPROGRAM
# ==========================================

if __name__ == "__main__":
    print("🚀 Starting Dart Model Training Script")
    
    # 1. Skapa dataset
    create_dataset_structure()
    
    print(f"🎨 Generating {IMAGES_PER_CLASS} synthetic images per split...")
    # Generera train och val data
    for i in tqdm(range(IMAGES_PER_CLASS)):
        generate_synthetic_image(i, "train")
    
    for i in tqdm(range(int(IMAGES_PER_CLASS * 0.2))): # 20% validation
        generate_synthetic_image(i, "val")
        
    yaml_path = create_yaml_file()
    print(f"✅ Dataset generated at {DATASET_DIR}")
    print(f"📄 Config file: {yaml_path}")

    # 2. Ladda YOLO och träna
    print("\n🏋️ Initializing YOLOv8...")
    # Vi laddar 'yolov8n.pt' (nano) för snabbhet. Byt till 'yolov8m.pt' för bättre precision.
    model = YOLO("yolov8n.pt") 

    print("🔥 Starting training... (This may take a while)")
    try:
        results = model.train(
            data=yaml_path,
            epochs=EPOCHS,
            imgsz=IMG_SIZE,
            batch=BATCH_SIZE,
            project=MODELS_DIR,
            name="dart_model",
            exist_ok=True # Skriv över om mappen finns
        )
        
        print("\n✅ Training Complete!")
        print(f"🏆 The best model is saved at: {os.path.join(MODELS_DIR, 'dart_model', 'weights', 'best.pt')}")
        
        # Flytta modellen till rätt ställe för appen
        final_path = os.path.join(BASE_DIR, "models", "dart_detector.pt")
        # Vi kopierar manuellt eller låter användaren göra det.
        # model.export() kan också användas.
        
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
