const express = require('express');
require('dotenv').config();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile, spawnSync } = require('child_process');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;
const libreTranslateUrl = process.env.LIBRETRANSLATE_URL || 'https://127.0.0.1:5000';
const isWindows = process.platform === 'win32';
const localWhisperExecutable = path.join(__dirname, '..', 'venv', 'Scripts', isWindows ? 'whisper.exe' : 'whisper');
const whisperCommand = process.env.WHISPER_COMMAND || (
    fs.existsSync(localWhisperExecutable) ? localWhisperExecutable : 'whisper'
);
const whisperModel = process.env.WHISPER_MODEL || 'base';
const ffmpegCommand = resolveFfmpegCommand();

function resolveFfmpegCommand() {
    if (process.env.FFMPEG_PATH) {
        return process.env.FFMPEG_PATH;
    }

    try {
        const ffmpegStaticPath = require('ffmpeg-static');
        if (ffmpegStaticPath && fs.existsSync(ffmpegStaticPath)) {
            return ffmpegStaticPath;
        }
    } catch {
        // Fall back to PATH lookup below.
    }

    return 'ffmpeg';
}

// Enable CORS
app.use(cors());

// Middleware to parse JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'media-translate-ai',
        libreTranslateUrl
    });
});

// Multer setup for handling file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        // Ensure the uploads folder exists, create it if not
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname); // Generate unique filename
    }
});

const upload = multer({ storage: storage });

function isPathLike(command) {
    return path.isAbsolute(command) || command.includes('/') || command.includes('\\');
}

function commandExists(command) {
    if (isPathLike(command)) {
        return fs.existsSync(command);
    }

    const lookupCommand = isWindows ? 'where' : 'which';
    const result = spawnSync(lookupCommand, [command], { stdio: 'ignore' });
    return result.status === 0;
}

function getTranscriptionPrerequisiteError() {
    if (!commandExists(whisperCommand)) {
        return `Whisper executable was not found. Expected "${whisperCommand}".`;
    }

    if (!commandExists(ffmpegCommand)) {
        return 'FFmpeg was not found. Install ffmpeg and make sure it is available on PATH before uploading media.';
    }

    return null;
}

function buildTranscriptionEnv() {
    const extraPaths = [];

    if (isPathLike(whisperCommand)) {
        extraPaths.push(path.dirname(whisperCommand));
    }

    if (isPathLike(ffmpegCommand)) {
        extraPaths.push(path.dirname(ffmpegCommand));
    }

    return {
        ...process.env,
        PATH: [...extraPaths, process.env.PATH || ''].filter(Boolean).join(path.delimiter),
        PYTHONIOENCODING: 'utf-8'
    };
}

function getProcessErrorDetail(output) {
    const lines = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    return lines.at(-1);
}

// Route to handle file uploads and start transcription process
app.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    const filePath = file?.path;

    if (!file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    console.log('Processing uploaded file:', file.originalname);

    const prerequisiteError = getTranscriptionPrerequisiteError();
    if (prerequisiteError) {
        console.error(prerequisiteError);
        return res.status(500).json({ message: prerequisiteError });
    }

    // Start the transcription process using Whisper
    const transcriptionProcess = execFile(
        whisperCommand,
        [filePath, '--language', 'en', '--model', whisperModel, '--output_dir', path.dirname(filePath)],
        {
            env: buildTranscriptionEnv(),
            windowsHide: true
        }
    );
    let transcriptionOutput = '';
    let transcriptionError = '';
    let didTimeout = false;

    transcriptionProcess.stdout?.on('data', (data) => {
        transcriptionOutput += data.toString();
    });

    transcriptionProcess.stderr?.on('data', (data) => {
        transcriptionError += data.toString();
    });

    // Set a timeout to handle hanging processes
    const timeout = setTimeout(() => {
        didTimeout = true;
        transcriptionProcess.kill(); // Kill the process if it takes too long
        return res.status(500).json({ message: 'Transcription process timed out.' });
    }, 2 * 60 * 1000); // 2 minutes timeout

    transcriptionProcess.on('close', async (code) => {
        clearTimeout(timeout); // Clear timeout once process ends

        if (didTimeout) {
            return;
        }

        console.log(`Transcription process exited with code ${code}`);
        
        if (code !== 0) {
            const detail = getProcessErrorDetail(transcriptionError || transcriptionOutput);
            console.error('Whisper failed:', transcriptionError || transcriptionOutput);
            return res.status(500).json({
                message: detail || 'Error in transcription process.'
            });
        }

        console.log('Whisper transcription completed successfully.');

        // Whisper generates a file with the same base name but with `.txt` extension
        const transcriptionFile = filePath.replace(path.extname(filePath), '.txt');

        try {
            // Read the transcribed text from the generated .txt file
            const transcribedText = fs.readFileSync(transcriptionFile, 'utf8');

            // Get the target language from form data (default to French if not provided)
            const targetLanguage = req.body.language || 'fr';
            console.log('Transcribed Text:', transcribedText);  // Log the transcribed text
            console.log('Target Language:', targetLanguage);  // Log the target language

            console.log('Starting translation via LibreTranslate...');

            // Translate the transcribed text using the local server
            const translatedText = await translateText(transcribedText, targetLanguage);

            console.log('LibreTranslate completed successfully.');

            // Send response with translated text
            return res.json({ message: 'Transcription and translation completed', translatedText });
        } catch (error) {
            console.error('Error during transcription or translation:', error.message);
            return res.status(500).json({ message: 'Failed to complete the process.' });
        }
    });

    transcriptionProcess.on('error', (error) => {
        clearTimeout(timeout);

        if (didTimeout) {
            return;
        }

        console.error('Error in transcription process:', error);
        return res.status(500).json({ message: error.message || 'Error in transcription process.' });
    });
});

// Function to translate text using local LibreTranslate API
async function translateText(text, targetLanguage) {
    try {
        console.log('Text to translate:', text);  // Log the text to be translated
        console.log('Target Language for translation:', targetLanguage);  // Log the target language

        const response = await axios.post(`${libreTranslateUrl}/translate`, {
            q: text,
            target: targetLanguage,
            source: 'auto'  // Auto-detect source language
        });

        return response.data.translatedText;
    } catch (error) {
        console.error('Error translating text with LibreTranslate:', error.message);
        throw new Error('Translation failed');
    }
}

app.get('/languages', async (req, res) => {
    try {
        const response = await axios.get(`${libreTranslateUrl}/languages`);
        return res.json(response.data);
    } catch (error) {
        console.error('Error fetching languages:', error.message);
        return res.status(500).json({ message: 'Failed to fetch languages' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
