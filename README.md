# World Online Dart

Detta projekt är en full-stack online dart-applikation som använder en React-frontend, Node.js-backend och en Python AI-tjänst för automatisk poängdetektering via webbkamera.

## Arkitektur

Applikationen består av tre huvuddelar:

1.  **`client/` - Frontend:** En React Single Page Application (SPA) som utgör användargränssnittet.
2.  **`server/` - Backend:** En Node.js/Express-server som hanterar spellogik, användarkonton, betalningar (Stripe) och realtidskommunikation via Socket.IO.
3.  **`ai-backend/` - AI-tjänst:** En Python/Flask-tjänst som använder en YOLO-modell för att analysera videoströmmar, upptäcka pilar och skicka tillbaka resultat till Node.js-servern.

## Förutsättningar

Innan du börjar, se till att du har följande programvara installerad:

*   [Node.js och npm](https://nodejs.org/)
*   [Python och pip](https://www.python.org/)
*   [MongoDB](https://www.mongodb.com/try/download/community) (eller en moln-baserad instans som MongoDB Atlas)

## Installation

Klona först projektet och installera sedan beroendena för varje del.

```bash
# Klona projektet
git clone <din-repository-url>
cd world-online-dart
```

### 1. Backend Server

```bash
# Gå till server-mappen
cd server

# Installera beroenden
npm install
```

### 2. Frontend Klient

```bash
# Gå till client-mappen från roten
cd client

# Installera beroenden
npm install
```

### 3. AI-tjänst

```bash
# Gå till ai-backend-mappen från roten
cd ai-backend

# Installera Python-beroenden
pip install -r requirements.txt
```

## Konfiguration

Applikationen kräver miljövariabler för att fungera korrekt. Skapa `.env`-filer i `server`- och `ai-backend`-mapparna.

### 1. Server (`server/.env`)

Skapa en fil med namnet `.env` i `server/`-mappen med följande innehåll:

```
# MongoDB Anslutningssträng
MONGO_URI=mongodb://localhost:27017/world-online-dart

# JSON Web Token Secret
JWT_SECRET=din_hemliga_nyckel_här

# Stripe Secret Key (valfritt, för betalningar)
STRIPE_SECRET_KEY=din_stripe_nyckel_här
```

### 2. AI-tjänst (`ai-backend/.env`)

Skapa en fil med namnet `.env` i `ai-backend/`-mappen. De flesta värden har standardinställningar som fungerar för lokal utveckling, men du kan anpassa dem här.

```
# URL till Node.js-servern
NODE_SERVER_URL=http://localhost:5000

# Port för AI-tjänsten
AI_PORT=5001

# Sökväg till tränad YOLO-modell
# Standard är './models/dart_detector.pt'
YOLO_MODEL_PATH=./models/your_model.pt
```

## Kör Applikationen

Starta de olika delarna i följande ordning.

### 1. Starta Backend Server

Öppna en terminal, gå till `server/`-mappen och kör:

```bash
npm start
```

Servern startar som standard på `http://localhost:5000`.

### 2. Starta AI-tjänsten

Öppna en **ny** terminal, gå till `ai-backend/`-mappen och kör:

```bash
python ai_dart_detection.py
```

AI-tjänsten startar som standard på `http://localhost:5001` och ansluter automatiskt till backend-servern.

### 3. Starta Frontend Klienten

Öppna en tredje terminal, gå till `client/`-mappen och kör:

```bash
npm start
```

Applikationen öppnas automatiskt i din webbläsare på `http://localhost:3000`.
