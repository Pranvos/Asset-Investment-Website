require('dotenv').config(); 
const express = require('express');
const { spawn, execSync, exec } = require('child_process');
const path = require('path');
const https = require('https');

const app = express();

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- HELPERS ---

// Automatically find if we should use 'python', 'python3', or 'py'
function detectPython() {
    const candidates = ['python', 'python3', 'py'];
    for (const cmd of candidates) {
        try {
            execSync(`${cmd} --version`, { stdio: 'ignore' });
            return cmd;
        } catch (e) {}
    }
    return null;
}

// Convert Alpha Vantage time format to readable ISO
function convertAVTime(avTime) {
    if (!avTime) return new Date().toISOString();
    const year = avTime.substring(0, 4);
    const month = avTime.substring(4, 6);
    const day = avTime.substring(6, 8);
    const hour = avTime.substring(9, 11);
    const minute = avTime.substring(11, 13);
    const second = avTime.substring(13, 15);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`; 
}

// --- ROUTES ---

// 1. Page Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'homepage.html')));
app.get('/quiz.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'quiz.html')));
app.get('/chatbot.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chatbot.html')));
app.get('/index.html', (req, res) => res.redirect('/quiz.html'));

// 2. News API (Alpha Vantage Logic)
app.get('/api/news', (req, res) => {
    const apiKey = process.env.ALPHAVANTAGE_KEY || 'YOUR_AV_API_KEY_HERE'; 
    const limit = req.query.limit || '8';
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=financial_markets&limit=${limit}&apikey=${apiKey}`;

    https.get(url, (apiRes) => {
        let body = '';
        apiRes.on('data', (chunk) => body += chunk);
        apiRes.on('end', () => {
            try {
                const rawJson = JSON.parse(body);
                if (!rawJson.feed) return res.status(502).json({ error: 'No feed found' });

                const articles = rawJson.feed.map(item => ({
                    title: item.title,
                    url: item.url,
                    source: { name: item.source || 'Alpha Vantage' }, 
                    publishedAt: convertAVTime(item.time_published), 
                    description: item.summary
                }));
                res.json({ articles });
            } catch (err) {
                res.status(502).json({ error: 'Error parsing news' });
            }
        });
    }).on('error', () => res.status(502).json({ error: 'News fetch failed' }));
});

// 3. AI Chatbot Route (The logic we just fixed)
app.post('/chat', (req, res) => {
    const { message } = req.body;
    const pythonExecutable = detectPython();

    const child = spawn(pythonExecutable, ['-u', 'chatbot.py'], {
        env: { 
            ...process.env,
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1'
        } 
    });

    let stdout = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    
    child.stdin.write(JSON.stringify({ message }) + '\n');
    child.stdin.end();

    child.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
            res.json({ reply: stdout.trim() });
        } else {
            res.status(500).json({ error: "AI failed to respond." });
        }
    });
});

// 4. Quiz Route
app.post('/run-quiz', (req, res) => {
    const userAnswers = req.body.answers;
    const pythonExecutable = detectPython();
    const pythonScript = path.join(__dirname, 'quiz.py');

    const child = spawn(pythonExecutable, [pythonScript]);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('close', (code) => {
        if (code !== 0) return res.status(500).send(stderr || "Quiz failed");
        res.send(stdout);
    });

    child.stdin.write(JSON.stringify(userAnswers) + '\n');
    child.stdin.end();
});

// --- START SERVER ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Stack Capital running: http://localhost:${PORT}`);
    // Auto-open browser
    const start = process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open';
    exec(`${start} http://localhost:${PORT}`);
});