const express = require('express');
const { spawn, execSync } = require('child_process');
const path = require('path');
const https = require('https');


const app = express();

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve homepage as the default landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'homepage.html'));
});


app.get('/quiz.html', (req, res) => {
    console.log('Serving /quiz.html');
    res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
});

app.get('/chatbot.html', (req, res) => {
    console.log('Serving /chatbot.html');
    res.sendFile(path.join(__dirname, 'public', 'chatbot.html'));
});


app.get('/index.html', (req, res) => {
    console.log('Redirecting /index.html to /quiz.html');
    res.redirect('/quiz.html');
});

// Helper function to convert Alpha Vantage time_published (YYYYMMDDTHHMMSS) to ISO format
function convertAVTime(avTime) {
    if (!avTime) return new Date().toISOString();
    const year = avTime.substring(0, 4);
    const month = avTime.substring(4, 6);
    const day = avTime.substring(6, 8);
    const time = avTime.substring(9, 15);
    const hour = time.substring(0, 2);
    const minute = time.substring(2, 4);
    const second = time.substring(4, 6);


    return `${year}-${month}-${day}T${hour}:${minute}:${second}`; 
}

app.get('/api/news', (req, res) => {
    const apiKey = process.env.ALPHAVANTAGE_KEY || 'YOUR_AV_API_KEY_HERE'; // 
    const limit = req.query.limit || '8';
    
    // Alpha Vantage Market News and Sentiment API
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=financial_markets&limit=${limit}&apikey=${apiKey}`;

    https.get(url, (apiRes) => {
        let body = '';
        apiRes.on('data', (chunk) => body += chunk);
        apiRes.on('end', () => {
            try {
                const rawJson = JSON.parse(body);


                if (!rawJson.feed) {
                    const errorMessage = rawJson['Error Message'] || 'Invalid response from Alpha Vantage';
                    console.error('Alpha Vantage Error:', rawJson);
                    return res.status(502).json({ error: errorMessage });
                }


                const articles = rawJson.feed.map(item => ({
                    title: item.title,
                    url: item.url,
                    source: { name: item.source || 'Alpha Vantage' }, 
                    publishedAt: convertAVTime(item.time_published), 
                    description: item.summary,
                    content: item.summary 
                }));

                res.json({ articles: articles });

            } catch (err) {
                console.error('Error parsing Alpha Vantage response', err);
                res.status(502).json({ error: 'Bad response from news provider' });
            }
        });
    }).on('error', (err) => {
        console.error('Error fetching news:', err);
        res.status(502).json({ error: 'Error fetching news' });
    });
});

function detectPython() {
    const candidates = ['python', 'python3', 'py'];
    for (const cmd of candidates) {
        try {
            execSync(`${cmd} --version`, { stdio: 'ignore' });
            return cmd;
        } catch (e) {
        }
    }
    return null;
}

app.post('/run-quiz', (req, res) => {
    const userAnswers = req.body.answers;

    if (!userAnswers || userAnswers.length !== 5) {
        return res.status(400).send("Invalid input: Please provide 5 quiz answers.");
    }

    console.log("Received answers:", userAnswers);

    const pythonExecutable = detectPython();
    if (!pythonExecutable) {
        console.error('Python executable not found on PATH. Tried: python, python3, py');
        return res.status(500).send('FATAL Error: Python executable not found. Please install Python or add it to PATH.');
    }

    const pythonScript = path.join(__dirname, 'quiz.py');
    const inputData = JSON.stringify(userAnswers);

    const child = spawn(pythonExecutable, [pythonScript], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        return res.status(500).send(`Failed to start Python process: ${err.message}`);
    });

    child.on('close', (code) => {
        if (code !== 0 || stderr) {
            console.error('Python script error (code', code, '):', stderr);
            const message = stderr || `Python script exited with code ${code}`;
            return res.status(500).send(`Python Script Execution Error:\n${message}\n\nCaptured Output: ${stdout}`);
        }

        // Success
        return res.send(stdout);
    });

    // Write input and close stdin
    child.stdin.write(inputData + '\n');
    child.stdin.end();
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));