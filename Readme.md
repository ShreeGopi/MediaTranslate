# Real-Time Video/Audio Translation App

Turn an audio or video file into translated text with a simple browser upload. The app takes your media file, transcribes the speech with Whisper, sends the transcript to LibreTranslate, and shows the translated result on the page. Basically: upload file, pick language, let the machines do their dramatic little dance.

## What This Project Does

This project is a small full-stack translation app built with a Node.js/Express backend and a plain HTML, CSS, and JavaScript frontend.

It supports:

- Uploading audio and video files from the browser
- Transcribing spoken audio into text using Whisper
- Translating the transcript into another language using LibreTranslate
- Fetching available translation languages from a local LibreTranslate server
- Displaying the translated text directly in the web interface
- Handling long transcription jobs with a timeout so the backend does not sit there forever contemplating life

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **File Uploads:** Multer
- **API Requests:** Axios
- **Transcription:** Whisper
- **Translation:** LibreTranslate
- **Other Backend Utilities:** CORS, File System, Child Process

## Project Structure

```text
Real_Time_Translation_app/
├── .github/
│   └── FUNDING.yml
├── backend/
│   └── server.js
├── frontend/
│   └── index.html
├── .gitignore
├── Readme.md
├── package.json
├── package-lock.json
└── whisper
```

### Important Files

- `backend/server.js` - Express server that handles uploads, runs Whisper, calls LibreTranslate, and returns the translated text.
- `frontend/index.html` - Browser interface for uploading files, searching/selecting a language, and viewing results.
- `package.json` - Node.js dependencies for the backend.
- `.gitignore` - Ignores generated/local folders such as `node_modules`, `uploads`, and `TL-backend`.

## How It Works

1. The user opens the web app in a browser.
2. The frontend loads available languages from the backend.
3. The user uploads an audio or video file.
4. The backend saves the file in the uploads folder.
5. Whisper transcribes the uploaded media into a `.txt` file.
6. The backend reads the transcript.
7. The transcript is sent to LibreTranslate.
8. The translated text is returned to the frontend.
9. The user sees the final translated text on screen.

Clean enough. Slightly magical. Still mostly JavaScript.

## Requirements

Before running the project, make sure you have these installed:

- Node.js and npm
- Python 3.11.x recommended
- Whisper installed and available from the command line
- LibreTranslate running locally
- Internet connection for installing dependencies

## Installation

Clone the repository:

```bash
git clone https://github.com/ShreeGopi/Real_Time_Translation_app.git
cd Real_Time_Translation_app
```

Install Node.js dependencies:

```bash
npm install
```

Install Whisper-related Python dependencies:

```bash
pip install torch==2.0.1 numpy==1.24.3 whisper
```

If the `whisper` package above does not work correctly, install Whisper directly from GitHub:

```bash
pip install git+https://github.com/openai/whisper.git
```

## Setting Up LibreTranslate Locally

This app expects LibreTranslate to run at:

```text
http://127.0.0.1:5000
```

Create a local folder for LibreTranslate:

```bash
mkdir TL-backend
cd TL-backend
```

Clone LibreTranslate:

```bash
git clone https://github.com/LibreTranslate/LibreTranslate.git
cd LibreTranslate
```

Install helper tools:

```bash
pip install hatch virtualenv
```

Create and activate a virtual environment:

```bash
virtualenv libretranslate-env
libretranslate-env\Scripts\activate
```

Install LibreTranslate inside the environment:

```bash
hatch run pip install .
```

Start the LibreTranslate server:

```bash
hatch run libretranslate
```

Keep this terminal running. LibreTranslate is the translation engine, so if this terminal is closed, translation will also go on a coffee break.

## Running the App

Open a new terminal from the project root and start the Express backend:

```bash
cd backend
node server.js
```

Then open this URL in your browser:

```text
http://localhost:3000
```

You should now see the upload page.

## Using the App

1. Choose an audio or video file.
2. Search for a target language.
3. Select the language from the dropdown.
4. Click **Upload and Translate**.
5. Wait while Whisper transcribes the file and LibreTranslate translates it.
6. Read the translated text on the page.

Supported files depend on what Whisper can process, but common formats like `.mp3`, `.wav`, and `.mp4` are good starting points.

## API Endpoints

### `POST /upload`

Uploads an audio/video file, transcribes it, translates the transcript, and returns the translated text.

Expected form data:

- `file` - audio or video file
- `language` - target language code, such as `fr`, `es`, or `de`

Example response:

```json
{
  "message": "Transcription and translation completed",
  "translatedText": "Translated text appears here"
}
```

### `GET /languages`

Fetches supported languages from the local LibreTranslate server.

## Error Handling

The backend includes basic handling for:

- Missing file uploads
- Whisper transcription failures
- Translation API failures
- Long transcription jobs that exceed the 2-minute timeout

If something fails, check both terminals:

- Express backend terminal
- LibreTranslate terminal

The answer is usually hiding there, pretending to be a stack trace.

## Notes

- Whisper must be installed correctly and available as a command-line tool.
- LibreTranslate must be running locally before translation will work.
- Uploaded files and generated transcription files are stored in `backend/uploads`.
- `TL-backend` and `uploads` are ignored by Git because they are local/generated folders.
- Python 3.11.x is recommended for smoother compatibility.

## Future Improvements

Some useful next steps for this project:

- Add translated audio output
- Support live audio/video streaming translation
- Allow multiple files to be uploaded at once
- Add progress indicators for long transcription jobs
- Improve frontend styling and mobile layout
- Add stronger file validation and upload limits
- Add tests for backend routes
- Add deployment instructions

## License

This project is open source. The current package metadata uses the ISC license.

## Final Thought

This project is a good example of connecting frontend file uploads, backend processing, AI-powered transcription, and translation APIs into one working flow. It is small, practical, and very resume-friendly, which is always a nice bonus.
