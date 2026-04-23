@echo off
echo Installing all dependencies...

echo Installing Backend dependencies...
cd server
call npm install
cd ..

echo Installing Client dependencies...
cd client
echo (Using --legacy-peer-deps to ensure compatibility)
call npm install --legacy-peer-deps
cd ..

echo Installing AI dependencies...
cd ai-backend
pip install -r requirements.txt
cd ..

echo Done! You can now run start_app.bat
pause