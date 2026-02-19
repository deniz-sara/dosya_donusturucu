const sharp = require('sharp');
const pdfParse = require('pdf-parse').default || require('pdf-parse');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { Document, Packer, Paragraph, TextRun } = require('docx');



async function convertFiles(inputPaths, targetFormat, outputDir) {
    if (inputPaths.length === 0) throw new Error('No files provided');

    // Multi-file to Single PDF case
    if (inputPaths.length > 1) {
        if (targetFormat === 'pdf') {
            return convertImagesToPdf(inputPaths, outputDir);
        } else {
            throw new Error('Only PDF merge is supported for multiple files.');
        }
    }

    // Single file case
    const inputPath = inputPaths[0];
    const filename = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(outputDir, `${filename}.${targetFormat}`);

    // Detect input type
    const ext = path.extname(inputPath).toLowerCase();

    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        return convertImage(inputPath, targetFormat, outputPath);
    } else if (ext === '.pdf' && targetFormat === 'txt') {
        return convertPdfToText(inputPath, outputPath);
    } else if (ext === '.pdf' && targetFormat === 'docx') {
        return convertPdfToDocx(inputPath, outputPath);
    } else if (ext === '.docx' && targetFormat === 'pdf') {
        return convertDocxToPdf(inputPath, outputPath);
    } else {
        throw new Error(`Conversion from ${ext} to ${targetFormat} is not supported yet.`);
    }
}

async function convertImage(inputPath, format, outputPath) {
    try {
        const image = sharp(inputPath);

        switch (format) {
            case 'jpg':
            case 'jpeg':
                await image.jpeg().toFile(outputPath);
                break;
            case 'png':
                await image.png().toFile(outputPath);
                break;
            case 'webp':
                await image.webp().toFile(outputPath);
                break;
            default:
                throw new Error('Unsupported image format: ' + format);
        }
        return outputPath;
    } catch (error) {
        throw error;
    }
}

async function convertPdfToText(inputPath, outputPath) {
    const dataBuffer = fs.readFileSync(inputPath);
    try {
        const data = await pdfParse(dataBuffer);
        fs.writeFileSync(outputPath, data.text);
        return outputPath;
    } catch (error) {
        throw error;
    }
}

async function convertPdfToDocx(inputPath, outputPath) {
    const dataBuffer = fs.readFileSync(inputPath);
    try {
        const data = await pdfParse(dataBuffer);

        const paragraphs = data.text.split('\n').map(line => {
            return new Paragraph({
                children: [new TextRun(line || " ")]
            });
        });

        const doc = new Document({
            sections: [{
                properties: {},
                children: paragraphs
            }]
        });

        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(outputPath, buffer);

        return outputPath;
    } catch (error) {
        throw error;
    }
}

async function convertDocxToPdf(inputPath, outputPath) {
    const puppeteer = require('puppeteer');

    // Convert DOCX to HTML
    const result = await mammoth.convertToHtml({ path: inputPath });
    const html = `
        <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
                </style>
            </head>
            <body>
                ${result.value}
            </body>
        </html>
    `;

    // Convert HTML to PDF using Puppeteer
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: outputPath, format: 'A4', margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' } });
    await browser.close();

    return outputPath;
}

async function convertImagesToPdf(inputPaths, outputDir) {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ autoFirstPage: false });
    const outputName = `merged-${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, outputName);
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    for (const imgPath of inputPaths) {
        const img = doc.openImage(imgPath);
        doc.addPage({ size: [img.width, img.height] });
        doc.image(imgPath, 0, 0);
    }

    doc.end();

    return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
    });
}

module.exports = { convertFiles };
