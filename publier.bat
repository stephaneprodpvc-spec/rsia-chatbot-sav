@echo off
cd /d "C:\Users\RESPOP\rsia-chatbot-sav"
echo Envoi des changements vers GitHub...
echo.
git add .
git commit -m "Mise a jour Iko"
git push
echo.
echo ============================================
echo Termine. Regarde les messages ci-dessus.
echo Va ensuite sur Vercel attendre "Ready".
echo ============================================
pause
