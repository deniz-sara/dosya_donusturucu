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
        'image/png': ['jpg', 'webp'],
        'image/jpeg': ['png', 'webp'],
        'image/webp': ['png', 'jpg'],
        'application/pdf': ['txt', 'docx'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['pdf']
    };

    // Drag and Drop Events
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFileSelect(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFileSelect(fileInput.files);
        }
    });

    function handleFileSelect(files) {
        if (files.length > 1) {
            fileInfo.textContent = `${files.length} dosya seçildi`;
            fileInfo.classList.remove('hidden');

            // Multi-file logic: Only allow PDF merge
            targetFormat.innerHTML = '<option value="pdf" selected>PDF (Birleştir)</option>';
            targetFormat.disabled = false;
            convertBtn.disabled = false;
            return;
        }

        const file = files[0];
        fileInfo.textContent = `Seçilen dosya: ${file.name}`;
        fileInfo.classList.remove('hidden');

        // Populate options based on file type
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

        checkLocalSupport();
    }

    function checkLocalSupport() {
        const isPdfTarget = targetFormat.value === 'pdf';
        let allImages = true;

        for (let i = 0; i < fileInput.files.length; i++) {
            if (!fileInput.files[i].type.startsWith('image/')) {
                allImages = false;
                break;
            }
        }

        if (allImages && isPdfTarget && fileInput.files.length > 0) {
            localConvertBtn.classList.remove('hidden');
            localConvertBtn.disabled = false;
        } else {
            localConvertBtn.classList.add('hidden');
            localConvertBtn.disabled = true;
        }
    }

    targetFormat.addEventListener('change', checkLocalSupport);

    convertForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();

        if (fileInput.files.length === 0) {
            alert('Lütfen dosya seçin.');
            return;
        }

        // Add all files to formData
        // Note: The backend expects 'files' as the field name for array uploads
        for (let i = 0; i < fileInput.files.length; i++) {
            formData.append('files', fileInput.files[i]);
        }

        formData.append('targetFormat', targetFormat.value);

        convertBtn.disabled = true;
        convertBtn.textContent = 'Dönüştürülüyor...';
        resultDiv.classList.add('hidden');
        resultDiv.innerHTML = '';

        try {
            const response = await fetch('/convert', {
                method: 'POST',
                body: formData
            });

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

    localConvertBtn.addEventListener('click', async () => {
        if (fileInput.files.length === 0) {
            alert('Lütfen dosya seçin.');
            return;
        }

        localConvertBtn.disabled = true;
        localConvertBtn.textContent = 'Tarayıcıda Dönüştürülüyor...';
        convertBtn.disabled = true;
        resultDiv.classList.add('hidden');
        resultDiv.innerHTML = '';

        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'px',
                format: 'a4'
            });

            // A4 size in px (at 72 dpi) is roughly 595 x 842. We'll use jsPDF's internal sizing
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            for (let i = 0; i < fileInput.files.length; i++) {
                const file = fileInput.files[i];
                const imgData = await readFileAsDataURL(file);

                const imgProps = await getImageProperties(imgData);

                // Calculate scale to fit within page while maintaining aspect ratio
                const scale = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);

                const width = imgProps.width * scale;
                const height = imgProps.height * scale;

                // Center the image
                const x = (pdfWidth - width) / 2;
                const y = (pdfHeight - height) / 2;

                if (i > 0) {
                    pdf.addPage();
                }

                pdf.addImage(imgData, file.type === 'image/png' ? 'PNG' : 'JPEG', x, y, width, height);
            }

            const safeName = fileInput.files.length === 1 ? fileInput.files[0].name.split('.')[0] : 'birlestirilmis-gorseller';
            pdf.save(`${safeName}.pdf`);

            resultDiv.innerHTML = `<p class="success-msg">Tarayıcı içi dönüşüm başarılı! İndirme başladı.</p>`;
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

    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Dosya okunamadı'));
            reader.readAsDataURL(file);
        });
    }

    function getImageProperties(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.onerror = () => reject(new Error('Görsel özellikleri okunamadı'));
            img.src = dataUrl;
        });
    }
});
