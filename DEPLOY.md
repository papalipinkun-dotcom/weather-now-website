# Put Weather Now online (no terminal needed)

1. **GitHub**: create a free account, make a new repository, then use "Add file > Upload files" and drag in everything from this folder (`.env` is not included, which is correct).
2. **Render**: sign up at render.com with GitHub, choose **New + > Blueprint**, pick your repository, and click Apply. It reads `render.yaml`, builds, and gives you a link like `https://weather-now.onrender.com`.
3. **Sign-in codes**: in Render open the service > **Environment** and fill in the keys you have, then save (it redeploys):
   - Email codes: `RESEND_API_KEY`, `EMAIL_FROM`
   - SMS codes: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
4. Open the link on your phone and sign in.

Notes
- Live weather is on by default and needs no key. Set `LIVE_WEATHER=off` in Render's Environment to use demo values.
- Production never shows demo codes. A channel with no keys will say it could not send the code.
- Free Render services sleep after 15 minutes without visits (first load is slow) and forget accounts when they restart. A paid plan with a disk keeps them: set `DATA_DIR` to the disk's mount path.
- Resend only sends to any address once you verify your own domain. Twilio trial accounts only text numbers you verified, and Indian numbers need extra sender registration (DLT).

## Run on your computer without typing commands
In VS Code press **Ctrl+Shift+P**, type **Tasks: Run Task**, run **Install dependencies** once, then **Start Weather Now (frontend + backend)**. Open http://localhost:5173. Or double-click `start.bat`.

## If Render says "Failed"
Open the service > **Logs**, copy the last red lines, and ask for help with that text.
