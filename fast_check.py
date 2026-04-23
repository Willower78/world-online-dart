# Check integrity of the first 10 images in the train folder
import glob
from PIL import Image
import os

images_path = '/content/drive/MyDrive/dart_dataset/dataset/images/train/*.jpg' # Adjust extension if needed (png, jpeg)
files = glob.glob(images_path)

print(f"Checking {len(files)} files found...")

for i, img_file in enumerate(files[:10]):
    try:
        with Image.open(img_file) as img:
            img.verify()
        print(f"✅ {os.path.basename(img_file)} is valid.")
    except Exception as e:
        print(f"❌ {os.path.basename(img_file)} is corrupt: {e}")
