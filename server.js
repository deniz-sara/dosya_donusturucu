const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const converter = require('./services/converter');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.set('trust proxy', 1); // Trust Render's proxy
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Dosya ismindeki Türkçe karakterleri, boşlukları ve özel sembolleri temizle
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
        cb(null, Date.now() + '-' + safeName);
    }
});

const upload = multer({ storage: storage });

// Routes
app.post('/convert', upload.array('files'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No files uploaded.');
    }

    const { targetFormat } = req.body;
    const inputPaths = req.files.map(file => file.path);
    const outputDir = 'public/downloads';

    // Ensure download directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        const result = await converter.convertFiles(inputPaths, targetFormat, outputDir);
        res.json({ success: true, downloadUrl: `/downloads/${path.basename(result)}` });

        // Cleanup uploaded files later
    } catch (error) {
        console.error('Conversion error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Test route to check if server is reachable without file upload
app.get('/ping', (req, res) => {
    res.json({ message: 'Server is alive', cors: 'working' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Global Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        details: err.code || 'UNKNOWN_ERROR'
    });
});
