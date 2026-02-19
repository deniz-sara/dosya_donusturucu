document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const targetFormat = document.getElementById('targetFormat');
    const convertBtn = document.getElementById('convertBtn');
    const convertForm = document.getElementById('convertForm');
    const resultDiv = document.getElementById('result');

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
    }

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

            const data = await response.json();

            if (data.success) {
                resultDiv.innerHTML = `<a href="${data.downloadUrl}" class="success-link" download>⬇️ İndir (${targetFormat.value.toUpperCase()})</a>`;
            } else {
                resultDiv.innerHTML = `<p class="error-msg">Hata: ${data.message}</p>`;
            }
        } catch (error) {
            resultDiv.innerHTML = `<p class="error-msg">Sunucu hatası oluştu.</p>`;
            console.error(error);
        } finally {
            convertBtn.disabled = false;
            convertBtn.textContent = 'Dönüştür';
            resultDiv.classList.remove('hidden');
        }
    });
});
