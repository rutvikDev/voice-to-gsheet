# 🎙️ Voice to Google Sheets

A modern, high-accuracy speech-to-text web application that transcribes your voice in real time and automatically records entries into your Google Sheet. Built for seamless deployment to **Render**.

---

## ✨ Key Features

- **Microphone Integration Inside Text Field**: Sleek mic icon embedded directly on the right side of the text box.
- **Real-Time Speech Recognition**: Powered by the browser's native **Web Speech API** (`webkitSpeechRecognition`), delivering instantaneous, continuous transcription with zero extra API keys.
- **100% Accuracy Guarantee**:
  - Live interim transcription as you speak
  - Language dialect selection (English US, UK, India, Hindi, Spanish, French, German, Japanese)
  - Full manual editing and proofreading before submission
- **One-Click Google Sheet Sync**: Formatted timestamp, transcript text, and language metadata appended instantly to Google Sheets.
- **Two Seamless Google Sheet Integration Methods**:
  1. **Google Apps Script Webhook** (Recommended, zero-setup, takes 2 minutes)
  2. **Google Cloud Service Account** (Enterprise Google Sheets API v4)
  3. **Demo Mode** fallback (test the full UI locally without any keys configured)
- **Ready for Render Deployment**: Includes `render.yaml`, production environment setup, and zero build tool complexity.
- **Rich Aesthetics**: Glassmorphism dark mode, animated sound-wave equalizer, pulsing mic aura, and pleasant synthesized audio feedback tones (Web Audio API).

---

## 🚀 Quick Start (Local Run)

### 1. Install dependencies:
```bash
npm install
```

### 2. Start the application:
```bash
npm start
```
Open your browser at **`http://localhost:3000`**.

---

## 📊 Connecting to Your Google Sheet

Choose either **Method A** (easiest) or **Method B**.

### Method A: Google Apps Script Webhook (Fastest - 2 Minutes) ⚡

1. Open [sheets.new](https://sheets.new) to create a new Google Sheet.
2. In the top menu, go to **Extensions** > **Apps Script**.
3. Delete any default code and paste the code from [google-apps-script.js](google-apps-script.js).
4. Click the blue **Deploy** button (top right) > **New deployment**.
5. Select type: **Web app** (click the gear icon ⚙️ next to "Select type").
6. Set:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone` *(Crucial so your web app can send data!)*
7. Click **Deploy**, click "Authorize access", and copy the **Web app URL** (`https://script.google.com/macros/s/.../exec`).
8. Create a `.env` file in the project root:
   ```env
   PORT=3000
   GOOGLE_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```

---

### Method B: Google Cloud Service Account (Google Sheets API v4) 🛡️

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and enable the **Google Sheets API**.
3. Go to **APIs & Services** > **Credentials** > **Create Credentials** > **Service Account**.
4. Create a JSON key for this service account and download it.
5. Open your Google Sheet, click **Share**, and share it with the service account email (ends with `...@...iam.gserviceaccount.com`) as **Editor**.
6. Copy the Spreadsheet ID from the URL (`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`).
7. In your `.env` file:
   ```env
   PORT=3000
   GOOGLE_SHEET_ID=your_spreadsheet_id_here
   GOOGLE_SHEET_NAME=Sheet1
   GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
   ```

---

## ☁️ How to Deploy to Render

### Step 1: Push Code to GitHub
```bash
git init
git add .
git commit -m "Initial commit of Voice to Google Sheets app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### Step 2: Create Web Service on Render
1. Log in to [dashboard.render.com](https://dashboard.render.com/).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository.
4. Configure the service settings:
   - **Name**: `voice-to-gsheet` (or your choice)
   - **Region**: Closest to you (e.g. Oregon, Frankfurt, Singapore)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

### Step 3: Add Environment Variables in Render
In the **Environment** section of your Render Web Service dashboard, add:

#### If using Apps Script (Method A):
- `GOOGLE_SHEET_WEBHOOK_URL`: your script URL

#### If using Service Account (Method B):
- `GOOGLE_SHEET_ID`: your spreadsheet ID
- `GOOGLE_SHEET_NAME`: `Sheet1`
- `GOOGLE_CLIENT_EMAIL`: your service account email
- `GOOGLE_PRIVATE_KEY`: your private key string (with quotes)

### Step 4: Click "Deploy Web Service"
Render will build and deploy your application. You will get a live HTTPS URL (e.g., `https://voice-to-gsheet.onrender.com`).
> **Note**: Modern browsers require an **HTTPS** connection to access the microphone, which Render provides automatically with free SSL certificates!

---

## 🎯 How Accuracy is Handled (100% Accuracy Guarantee)

1. **Browser Native Speech Recognition**: Uses Google's and Apple's neural acoustic speech models directly from the client.
2. **Dialect Matching**: Switch dialects (e.g., US English vs. Indian English vs. Hindi) to match speech patterns and accents.
3. **Interim Transcription + Visual Feedback**: Words stream live into the text box as spoken, showing instantaneous recognition.
4. **Editable Text Area**: The user can review, edit, append, or clear before clicking "Submit", ensuring **100% accuracy** of every row written to the Google Sheet.

---

## 📁 Project Structure

```
├── public/
│   ├── index.html        # Clean, accessible semantic interface
│   ├── style.css         # Glassmorphic dark styling & animations
│   └── app.js            # Web Speech API + audio feedback logic
├── server.js             # Express server with Google Sheets API & Webhook
├── google-apps-script.js # 1-minute ready-to-paste Google Sheets webhook
├── render.yaml           # Render Infrastructure Blueprint
├── .env.example          # Environment variables template
├── package.json          # Dependencies & scripts
└── README.md             # Complete documentation
```
