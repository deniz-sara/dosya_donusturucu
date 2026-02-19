const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const converter = require('./services/converter');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.static('public'));

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
