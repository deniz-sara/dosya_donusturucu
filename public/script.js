document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const targetFormat = document.getElementById('targetFormat');
    const convertBtn = document.getElementById('convertBtn');
    const convertForm = document.getElementById('convertForm');
    const resultDiv = document.getElementById('result');
    const localConvertBtn = document.getElementById('localConvertBtn');

    const formatOptions = {
        'image/png': ['jpg', 'webp', 'pdf'],
        'image/jpeg': ['png', 'webp', 'pdf'],
        'image/webp': ['png', 'jpg', 'pdf'],
        'application/pdf': ['txt', 'docx'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['pdf']
    };

    // Drag and Drop Events
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) handleFileSelect(fileInput.files);
    });

    function handleFileSelect(files) {
        if (files.length > 1) {
            fileInfo.textContent = `${files.length} dosya seçildi`;
            fileInfo.classList.remove('hidden');
            targetFormat.innerHTML = '<option value="pdf" selected>PDF (Birleştir)</option>';
            targetFormat.disabled = false;
            convertBtn.disabled = false;
            showLocalBtn(true);
            return;
        }

        const file = files[0];
        fileInfo.textContent = `Seçilen dosya: ${file.name}`;
        fileInfo.classList.remove('hidden');

        targetFormat.innerHTML = '<option value="" disabled selected>Format seçin</option>';
        const availableFormats = formatOptions[file.type];

        if (availableFormats) {
            availableFormats.forEach(fmt => {
                const option = document.createElement('option');
                option.value = fmt;
                option.textContent = fmt.toUpperCase();
                targetFormat.appendChild(option);
            });
            targetFormat.disabled = false;
            convertBtn.disabled = false;
        } else {
            const option = document.createElement('option');
            option.textContent = 'Desteklenmeyen dosya türü';
            targetFormat.appendChild(option);
            targetFormat.disabled = true;
            convertBtn.disabled = true;
        }

        showLocalBtn(false); // hide until format selected
    }

    function showLocalBtn(show) {
        if (show) {
            localConvertBtn.classList.remove('hidden');
            localConvertBtn.disabled = false;
        } else {
            localConvertBtn.classList.add('hidden');
            localConvertBtn.disabled = true;
        }
    }

    targetFormat.addEventListener('change', () => {
        if (targetFormat.value && fileInput.files.length > 0) {
            showLocalBtn(true);
        }
    });

    // =====================
    // SERVER CONVERSION
    // =====================
    convertForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (fileInput.files.length === 0) { alert('Lütfen dosya seçin.'); return; }

        const formData = new FormData();
        for (let i = 0; i < fileInput.files.length; i++) {
            formData.append('files', fileInput.files[i]);
        }
        formData.append('targetFormat', targetFormat.value);

        convertBtn.disabled = true;
        convertBtn.textContent = 'Dönüştürülüyor...';
        resultDiv.classList.add('hidden');
        resultDiv.innerHTML = '';

        try {
            const response = await fetch('/convert', { method: 'POST', body: formData });
            let data;
            const textResponse = await response.text();
            try {
                data = JSON.parse(textResponse);
            } catch (jsonErr) {
                throw new Error(`Sunucu Hatası (${response.status}): ${textResponse.substring(0, 150)}...`);
            }
            if (data.success) {
                resultDiv.innerHTML = `<a href="${data.downloadUrl}" class="success-link" download>⬇️ İndir (${targetFormat.value.toUpperCase()})</a>`;
            } else {
                resultDiv.innerHTML = `<p class="error-msg">Hata: ${data.message}</p>`;
            }
        } catch (error) {
            resultDiv.innerHTML = `<p class="error-msg">Dönüşüm başarısız: ${error.message}</p>`;
            console.error(error);
        } finally {
            convertBtn.disabled = false;
            convertBtn.textContent = 'Dönüştür';
            resultDiv.classList.remove('hidden');
        }
    });

    // =====================
    // LOCAL (VPN) CONVERSION
    // =====================
    localConvertBtn.addEventListener('click', async () => {
        if (fileInput.files.length === 0) { alert('Lütfen dosya seçin.'); return; }

        const fmt = targetFormat.value;
        const file = fileInput.files[0];
        const files = fileInput.files;

        localConvertBtn.disabled = true;
        localConvertBtn.textContent = 'Tarayıcıda Dönüştürülüyor...';
        convertBtn.disabled = true;
        resultDiv.classList.add('hidden');
        resultDiv.innerHTML = '';

        try {
            // Determine which local conversion to run
            const isImage = (f) => f.type.startsWith('image/');
            const isPdf = (f) => f.type === 'application/pdf';
            const isDocx = (f) => f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

            if (isImage(file) && fmt === 'pdf') {
                await localImagesToPdf(files);
            } else if (isImage(file) && ['jpg', 'jpeg', 'png', 'webp'].includes(fmt)) {
                await localImageToImage(file, fmt);
            } else if (isPdf(file) && fmt === 'txt') {
                await localPdfToTxt(file);
            } else if (isPdf(file) && fmt === 'docx') {
                await localPdfToDocx(file);
            } else if (isDocx(file) && fmt === 'pdf') {
                await localDocxToPdf(file);
            } else {
                throw new Error('Bu dönüşüm türü şu an tarayıcıda desteklenmiyor.');
            }

            resultDiv.innerHTML = `<p class="success-msg">✅ Tarayıcı içi dönüşüm başarılı! İndirme başladı.</p>`;
        } catch (error) {
            resultDiv.innerHTML = `<p class="error-msg">Tarayıcı dönüşüm hatası: ${error.message}</p>`;
            console.error(error);
        } finally {
            localConvertBtn.disabled = false;
            localConvertBtn.textContent = 'Tarayıcıda Dönüştür (VPN Uyumlu)';
            convertBtn.disabled = false;
            resultDiv.classList.remove('hidden');
        }
    });

    // =====================
    // LOCAL CONVERSION HELPERS
    // =====================

    // Image(s) → PDF
    async function localImagesToPdf(files) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        for (let i = 0; i < files.length; i++) {
            const imgData = await readFileAsDataURL(files[i]);
            const imgProps = await getImageDimensions(imgData);
            const scale = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
            const width = imgProps.width * scale;
            const height = imgProps.height * scale;
            const x = (pdfWidth - width) / 2;
            const y = (pdfHeight - height) / 2;
            if (i > 0) pdf.addPage();
            const imgType = files[i].type === 'image/png' ? 'PNG' : 'JPEG';
            pdf.addImage(imgData, imgType, x, y, width, height);
        }
        const name = files.length === 1 ? files[0].name.split('.')[0] : 'birlesmis';
        pdf.save(`${name}.pdf`);
    }

    // Image → Image (format conversion via Canvas)
    async function localImageToImage(file, fmt) {
        const imgData = await readFileAsDataURL(file);
        const img = await loadImage(imgData);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (fmt === 'jpg' || fmt === 'jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        const mimeType = fmt === 'png' ? 'image/png' : fmt === 'webp' ? 'image/webp' : 'image/jpeg';
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${file.name.split('.')[0]}.${fmt}`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, mimeType, 0.95);
    }

    // PDF → TXT
    async function localPdfToTxt(file) {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `--- Sayfa ${i} ---\n${pageText}\n\n`;
        }
        downloadText(fullText, `${file.name.split('.')[0]}.txt`);
    }

    // PDF → DOCX
    async function localPdfToDocx(file) {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + '\n\n';
        }

        const { Document, Packer, Paragraph, TextRun } = window.docx;
        const paragraphs = fullText.split('\n').map(line =>
            new Paragraph({ children: [new TextRun(line || ' ')] })
        );
        const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
        const blob = await Packer.toBlob(doc);
        downloadBlob(blob, `${file.name.split('.')[0]}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }

    // DOCX → PDF
    async function localDocxToPdf(file) {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = `<html><head><style>body{font-family:Arial,sans-serif;line-height:1.6;padding:20px;}</style></head><body>${result.value}</body></html>`;

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
        await new Promise((resolve, reject) => {
            pdf.html(html, {
                callback: (doc) => { doc.save(`${file.name.split('.')[0]}.pdf`); resolve(); },
                x: 15, y: 15, width: 560, windowWidth: 800
            });
        });
    }

    // =====================
    // UTILITY FUNCTIONS
    // =====================
    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Dosya okunamadı'));
            reader.readAsDataURL(file);
        });
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Dosya okunamadı'));
            reader.readAsArrayBuffer(file);
        });
    }

    function getImageDimensions(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.onerror = () => reject(new Error('Görsel boyutları okunamadı'));
            img.src = dataUrl;
        });
    }

    function loadImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Görsel yüklenemedi'));
            img.src = dataUrl;
        });
    }

    function downloadText(text, filename) {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, filename, 'text/plain');
    }

    function downloadBlob(blob, filename, mimeType) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
});
