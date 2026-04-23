import os
import base64
import cv2
import numpy as np
import math
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

PORT = int(os.environ.get("PORT", 5001))
MODEL_PATH = os.environ.get("YOLO_MODEL_PATH", "models/dart_detector.pt")

# Standard Dartboard Order (Clockwise from Top)
SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

# Geometry Config (Normalized relative to board radius)
# These ratios define where the rings are relative to the board's radius
R_BULL_INNER = 0.05
R_BULL_OUTER = 0.12
R_TRIPLE_INNER = 0.55
R_TRIPLE_OUTER = 0.62
R_DOUBLE_INNER = 0.93
R_DOUBLE_OUTER = 1.0

# Assumed Board Size in Image (0-1 coordinates)
# We assume the board is centered (0.5, 0.5) and takes up 90% of the shortest dimension
# You might want to calibrate this later or adjust these values
BOARD_CENTER_X = 0.5
BOARD_CENTER_Y = 0.5
BOARD_RADIUS = 0.45 

model = None

def get_score_from_coords(x, y):
    """
    Calculates score based on normalized (0-1) coordinates x, y.
    Assumes board center is at (BOARD_CENTER_X, BOARD_CENTER_Y).
    """
    dx = x - BOARD_CENTER_X
    dy = y - BOARD_CENTER_Y
    
    # Distance from center
    distance = math.sqrt(dx*dx + dy*dy)
    norm_dist = distance / BOARD_RADIUS
    
    # Angle in degrees (-180 to 180)
    # atan2(dy, dx). Note: In images Y increases downwards.
    # Logic: 
    # Top (-90 deg) is (0, -1). atan2(-1, 0) = -90.
    # Right (0 deg) is (1, 0). atan2(0, 1) = 0.
    # Bottom (90 deg) is (0, 1). atan2(1, 0) = 90.
    # Left (180 deg) is (-1, 0). atan2(0, -1) = 180.
    angle = math.degrees(math.atan2(dy, dx))
    
    multiplier = 1
    base_score = 0
    segment_type = "MISS"
    
    # Check Rings
    if norm_dist > R_DOUBLE_OUTER:
        return 0, "MISS", "miss"
    
    if norm_dist <= R_BULL_OUTER:
        if norm_dist <= R_BULL_INNER:
            return 50, "BULL_50", "bull_50"
        else:
            return 25, "BULL_25", "bull_25"
            
    if norm_dist >= R_DOUBLE_INNER and norm_dist <= R_DOUBLE_OUTER:
        multiplier = 2
        segment_type = "DOUBLE"
    elif norm_dist >= R_TRIPLE_INNER and norm_dist <= R_TRIPLE_OUTER:
        multiplier = 3
        segment_type = "TRIPLE"
    else:
        multiplier = 1
        segment_type = "SINGLE"

    # Calculate Sector
    # Formula: index = round((angle + 90) / 18)
    # Explanation:
    # Top is -90. We want index 0 (Sector 20). (-90 + 90) / 18 = 0.
    # Right is 0. We want index 5 (Sector 6). (0 + 90) / 18 = 5.
    index = round((angle + 90) / 18)
    
    # Handle wrap-around (e.g., -100 degrees or 200 degrees)
    index = index % 20 
    
    base_score = SECTORS[index]
    total_score = base_score * multiplier
    
    segment_name = f"{segment_type}_{base_score}"
    
    return total_score, segment_name, segment_name.lower()

@app.route("/detect", methods=["POST"])
def detect_dart():
    global model
    if model is None:
        return jsonify({"error": "Model is not loaded"}), 500

    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify({"error": "No image data"}), 400

    try:
        # Decode the base64 image string
        if "," in data['image']:
            header, encoded_data = data['image'].split(',', 1)
        else:
            encoded_data = data['image']
            
        image_data = base64.b64decode(encoded_data)
        npimg = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({"error": "Failed to decode image"}), 400

        # Run YOLO inference
        results = model(img, verbose=False)
        result = results[0]

        if len(result.boxes) == 0:
            return jsonify({"detection": "MISS", "score": 0, "segment": "miss"})

        # Get best detection (highest confidence)
        best_box = result.boxes[0] 
        for box in result.boxes:
            if box.conf[0] > best_box.conf[0]:
                best_box = box
        
        # Get coordinates (normalized 0-1)
        # xywhn returns [x_center, y_center, width, height]
        x, y, w, h = best_box.xywhn[0]
        
        # Calculate score using geometry
        score, name, segment = get_score_from_coords(float(x), float(y))
        
        return jsonify({
            "detection": name,
            "score": score,
            "confidence": float(best_box.conf[0]),
            "segment": segment,
            "x": float(x),
            "y": float(y)
        })

    except Exception as e:
        print(f"Error during detection: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("--- AI Dart Detection Server (Geometry Based) ---")
    
    # Fallback to check if best.pt exists if dart_detector.pt doesn't
    if not os.path.exists(MODEL_PATH) and os.path.exists("models/best.pt"):
        print(f"⚠️ '{MODEL_PATH}' not found. Falling back to 'models/best.pt'")
        MODEL_PATH = "models/best.pt"
        
    try:
        model = YOLO(MODEL_PATH)
        print(f"✅ Model loaded from {MODEL_PATH}")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        print("Please ensure 'dart_detector.pt' or 'best.pt' is in ai-backend/models/")

    app.run(host="0.0.0.0", port=PORT, debug=False)
