// PDF Editor Variables
let pdfDoc = null;
let currentPage = 1;
let scale = 1.0;
let fileId = null;
let fileName = null;
let totalPages = 0;
let annotations = [];
let undoStack = [];
let redoStack = [];

// DOM Elements
const pdfCanvas = document.getElementById('pdfCanvas');
const annotationLayer = document.getElementById('annotationLayer');
const ctx = pdfCanvas.getContext('2d');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const currentPageSpan = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');
const zoomLevelSpan = document.getElementById('zoomLevel');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const fileNameSpan = document.getElementById('fileName');
const fileStatsSpan = document.getElementById('fileStats');
const downloadBtn = document.getElementById('downloadBtn');
const saveBtn = document.getElementById('saveBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const pagesThumbnails = document.getElementById('pagesThumbnails');

// Initialize PDF Editor
async function initPDFEditor() {
    // Get fileId from URL
    const urlParams = new URLSearchParams(window.location.search);
    fileId = urlParams.get('fileId');
    
    if (!fileId) {
        showToast('No PDF file selected', 'error');
        window.location.href = 'index.html';
        return;
    }
    
    // Load PDF
    await loadPDF(fileId);
    
    // Setup event listeners
    setupEventListeners();
    
    // Update file info
    updateFileInfo();
    
    // Generate thumbnails
    generateThumbnails();
}

// Load PDF File
async function loadPDF(fileId) {
    try {
        showToast('Loading PDF...', 'info');
        
        // In a real implementation, you would load from your backend
        // For demo, we'll use a sample approach
        
        // Load PDF.js
        const loadingTask = pdfjsLib.getDocument(`/api/pdf/${fileId}/pages?page=${currentPage}`);
        pdfDoc = await loadingTask.promise;
        totalPages = pdfDoc.numPages;
        
        // Render first page
        await renderPage(currentPage);
        
        // Update UI
        currentPageSpan.textContent = currentPage;
        totalPagesSpan.textContent = totalPages;
        
        showToast('PDF loaded successfully', 'success');
        
    } catch (error) {
        console.error('Error loading PDF:', error);
        showToast('Error loading PDF: ' + error.message, 'error');
    }
}

// Render PDF Page
async function renderPage(pageNum) {
    try {
        const page = await pdfDoc.getPage(pageNum);
        
        // Calculate viewport
        const viewport = page.getViewport({ scale: scale });
        
        // Set canvas dimensions
        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;
        annotationLayer.style.height = `${viewport.height}px`;
        annotationLayer.style.width = `${viewport.width}px`;
        
        // Render PDF page
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Render existing annotations for this page
        renderAnnotations(pageNum);
        
    } catch (error) {
        console.error('Error rendering page:', error);
    }
}

// Navigation Controls
prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderPage(currentPage);
        currentPageSpan.textContent = currentPage;
        updateActiveThumbnail();
    }
});

nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        renderPage(currentPage);
        currentPageSpan.textContent = currentPage;
        updateActiveThumbnail();
    }
});

// Zoom Controls
zoomInBtn.addEventListener('click', () => {
    if (scale < 3.0) {
        scale += 0.1;
        renderPage(currentPage);
        zoomLevelSpan.textContent = `${Math.round(scale * 100)}%`;
    }
});

zoomOutBtn.addEventListener('click', () => {
    if (scale > 0.5) {
        scale -= 0.1;
        renderPage(currentPage);
        zoomLevelSpan.textContent = `${Math.round(scale * 100)}%`;
    }
});

// Generate Page Thumbnails
async function generateThumbnails() {
    pagesThumbnails.innerHTML = '';
    
    for (let i = 1; i <= Math.min(totalPages, 10); i++) {
        const thumbContainer = document.createElement('div');
        thumbContainer.className = 'thumbnail';
        thumbContainer.dataset.page = i;
        
        if (i === currentPage) {
            thumbContainer.classList.add('active');
        }
        
        // Create thumbnail canvas
        const thumbCanvas = document.createElement('canvas');
        thumbContainer.appendChild(thumbCanvas);
        
        // Add page number
        const pageNum = document.createElement('div');
        pageNum.className = 'thumbnail-page';
        pageNum.textContent = i;
        thumbContainer.appendChild(pageNum);
        
        // Click event
        thumbContainer.addEventListener('click', () => {
            currentPage = i;
            renderPage(currentPage);
            currentPageSpan.textContent = currentPage;
            updateActiveThumbnail();
        });
        
        pagesThumbnails.appendChild(thumbContainer);
        
        // Render thumbnail
        await renderThumbnail(i, thumbCanvas);
    }
}

// Render Thumbnail
async function renderThumbnail(pageNum, canvas) {
    try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.2 });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const context = canvas.getContext('2d');
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
    } catch (error) {
        console.error('Error rendering thumbnail:', error);
    }
}

// Update Active Thumbnail
function updateActiveThumbnail() {
    document.querySelectorAll('.thumbnail').forEach(thumb => {
        thumb.classList.remove('active');
        if (parseInt(thumb.dataset.page) === currentPage) {
            thumb.classList.add('active');
        }
    });
}

// Tool Selection
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        activateTool(tool);
    });
});

// Activate Tool
function activateTool(tool) {
    // Deactivate all tools
    document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.remove('active');
    });
    
    // Activate selected tool
    event.target.classList.add('active');
    
    // Show/hide tool panels
    document.querySelectorAll('.tool-panel').forEach(panel => {
        panel.classList.add('hidden');
    });
    
    // Show relevant panel
    if (tool === 'text') {
        document.getElementById('textPanel').classList.remove('hidden');
    }
    
    // Setup tool-specific behavior
    setupToolBehavior(tool);
}

// Setup Tool Behavior
function setupToolBehavior(tool) {
    // Clear previous event listeners
    pdfCanvas.removeEventListener('click', handleTextAdd);
    pdfCanvas.removeEventListener('mousedown', startDrawing);
    pdfCanvas.removeEventListener('mousemove', draw);
    pdfCanvas.removeEventListener('mouseup', stopDrawing);
    
    switch(tool) {
        case 'text':
            pdfCanvas.addEventListener('click', handleTextAdd);
            break;
        case 'draw':
            setupDrawing();
            break;
        case 'highlight':
            setupTextSelection();
            break;
    }
}

// Handle Text Addition
function handleTextAdd(event) {
    const rect = pdfCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Show text input at position
    const textInput = document.createElement('textarea');
    textInput.className = 'floating-text-input';
    textInput.style.left = `${x}px`;
    textInput.style.top = `${y}px`;
    textInput.placeholder = 'Enter text...';
    
    annotationLayer.appendChild(textInput);
    textInput.focus();
    
    // Handle text submission
    textInput.addEventListener('blur', () => {
        if (textInput.value.trim()) {
            addAnnotation({
                type: 'text',
                text: textInput.value,
                x: x / scale,
                y: y / scale,
                page: currentPage,
                fontSize: parseInt(document.getElementById('fontSize').value),
                color: document.getElementById('textColor').value
            });
        }
        textInput.remove();
    });
    
    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            textInput.blur();
        }
    });
}

// Add Annotation
function addAnnotation(annotation) {
    annotation.id = Date.now();
    annotation.timestamp = new Date().toISOString();
    annotations.push(annotation);
    
    // Add to undo stack
    undoStack.push({
        action: 'add',
        annotation: annotation
    });
    
    // Clear redo stack
    redoStack = [];
    
    // Update buttons
    updateUndoRedoButtons();
    
    // Render annotation
    renderAnnotation(annotation);
}

// Render Annotations
function renderAnnotations(pageNum) {
    annotationLayer.innerHTML = '';
    
    const pageAnnotations = annotations.filter(a => a.page === pageNum);
    pageAnnotations.forEach(annotation => {
        renderAnnotation(annotation);
    });
}

// Render Single Annotation
function renderAnnotation(annotation) {
    if (annotation.page !== currentPage) return;
    
    switch(annotation.type) {
        case 'text':
            renderTextAnnotation(annotation);
            break;
        case 'highlight':
            renderHighlightAnnotation(annotation);
            break;
        case 'drawing':
            renderDrawingAnnotation(annotation);
            break;
    }
}

// Render Text Annotation
function renderTextAnnotation(annotation) {
    const textElement = document.createElement('div');
    textElement.className = 'annotation-text';
    textElement.textContent = annotation.text;
    textElement.style.left = `${annotation.x * scale}px`;
    textElement.style.top = `${annotation.y * scale}px`;
    textElement.style.color = annotation.color;
    textElement.style.fontSize = `${annotation.fontSize * scale}px`;
    textElement.dataset.annotationId = annotation.id;
    
    // Make draggable
    makeDraggable(textElement, annotation);
    
    annotationLayer.appendChild(textElement);
}

// Setup Drawing
function setupDrawing() {
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let paths = [];
    let currentPath = [];
    
    pdfCanvas.addEventListener('mousedown', startDrawing);
    pdfCanvas.addEventListener('mousemove', draw);
    pdfCanvas.addEventListener('mouseup', stopDrawing);
    
    function startDrawing(e) {
        isDrawing = true;
        const rect = pdfCanvas.getBoundingClientRect();
        [lastX, lastY] = [e.clientX - rect.left, e.clientY - rect.top];
        currentPath = [];
        currentPath.push([lastX / scale, lastY / scale]);
    }
    
    function draw(e) {
        if (!isDrawing) return;
        
        const rect = pdfCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        
        // Draw on canvas
        ctx.beginPath();
        ctx.moveTo(lastX * scale, lastY * scale);
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.strokeStyle = document.getElementById('textColor').value;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Store point
        currentPath.push([x, y]);
        
        [lastX, lastY] = [x, y];
    }
    
    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        
        if (currentPath.length > 1) {
            addAnnotation({
                type: 'drawing',
                path: currentPath,
                page: currentPage,
                color: document.getElementById('textColor').value,
                lineWidth: 2
            });
        }
    }
}

// Setup Text Selection for Highlighting
function setupTextSelection() {
    const overlay = document.getElementById('textSelectionOverlay');
    overlay.style.display = 'block';
    
    // Text selection logic would go here
    // This is a simplified version
}

// Make Annotation Draggable
function makeDraggable(element, annotation) {
    let isDragging = false;
    let offsetX, offsetY;
    
    element.addEventListener('mousedown', startDrag);
    
    function startDrag(e) {
        isDragging = true;
        const rect = element.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        
        e.preventDefault();
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        const rect = annotationLayer.getBoundingClientRect();
        const x = e.clientX - rect.left - offsetX;
        const y = e.clientY - rect.top - offsetY;
        
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        
        // Update annotation position
        annotation.x = x / scale;
        annotation.y = y / scale;
    }
    
    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
        
        // Save to undo stack
        undoStack.push({
            action: 'move',
            annotation: { ...annotation }
        });
    }
}

// Undo/Redo Functions
undoBtn.addEventListener('click', () => {
    if (undoStack.length === 0) return;
    
    const lastAction = undoStack.pop();
    redoStack.push(lastAction);
    
    // Handle undo action
    switch(lastAction.action) {
        case 'add':
            annotations = annotations.filter(a => a.id !== lastAction.annotation.id);
            break;
        case 'delete':
            annotations.push(lastAction.annotation);
            break;
        case 'move':
            // Find and restore original position
            const index = annotations.findIndex(a => a.id === lastAction.annotation.id);
            if (index !== -1) {
                annotations[index] = lastAction.annotation;
            }
            break;
    }
    
    renderPage(currentPage);
    updateUndoRedoButtons();
});

redoBtn.addEventListener('click', () => {
    if (redoStack.length === 0) return;
    
    const lastAction = redoStack.pop();
    undoStack.push(lastAction);
    
    // Handle redo action
    switch(lastAction.action) {
        case 'add':
            annotations.push(lastAction.annotation);
            break;
        case 'delete':
            annotations = annotations.filter(a => a.id !== lastAction.annotation.id);
            break;
        case 'move':
            // Find and update position
            const index = annotations.findIndex(a => a.id === lastAction.annotation.id);
            if (index !== -1) {
                annotations[index] = lastAction.annotation;
            }
            break;
    }
    
    renderPage(currentPage);
    updateUndoRedoButtons();
});

// Update Undo/Redo Buttons
function updateUndoRedoButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
}

// Save Changes
saveBtn.addEventListener('click', async () => {
    try {
        showToast('Saving changes...', 'info');
        
        // Prepare edit data
        const editData = {
            operation: 'save',
            annotations: annotations,
            fileId: fileId
        };
        
        // Send to backend
        const response = await fetch(`/api/pdf/${fileId}/edit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(editData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Changes saved successfully!', 'success');
            // Clear undo/redo stacks
            undoStack = [];
            redoStack = [];
            updateUndoRedoButtons();
        } else {
            showToast('Error saving changes: ' + data.error, 'error');
        }
        
    } catch (error) {
        showToast('Error saving changes: ' + error.message, 'error');
    }
});

// Download Edited PDF
downloadBtn.addEventListener('click', async () => {
    try {
        showToast('Preparing download...', 'info');
        
        // First save changes
        await saveBtn.click();
        
        // Then download
        const response = await fetch(`/api/pdf/${fileId}/edit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                operation: 'download',
                fileId: fileId
            })
        });
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_${fileName}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast('Download started!', 'success');
        
    } catch (error) {
        showToast('Error downloading: ' + error.message, 'error');
    }
});

// Update File Info
function updateFileInfo() {
    // In a real app, fetch from backend
    fileNameSpan.textContent = fileName || 'document.pdf';
    fileStatsSpan.textContent = `${totalPages} pages • Loading size...`;
}

// Setup Event Listeners
function setupEventListeners() {
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        const sidebar = document.getElementById('editorSidebar');
        sidebar.classList.toggle('collapsed');
    });
    
    // AI Tools
    document.getElementById('summarizeBtn').addEventListener('click', summarizePDF);
    document.getElementById('chatBtn').addEventListener('click', () => {
        window.location.href = `chat-pdf.html?fileId=${fileId}`;
    });
    document.getElementById('extractBtn').addEventListener('click', extractKeyPoints);
    document.getElementById('grammarBtn').addEventListener('click', grammarCheck);
    
    // PDF Tools
    document.getElementById('mergeBtn').addEventListener('click', showMergeModal);
    document.getElementById('splitBtn').addEventListener('click', showSplitModal);
    document.getElementById('compressBtn').addEventListener('click', compressPDF);
    document.getElementById('convertBtn').addEventListener('click', showConvertModal);
    
    // Text Editor
    document.getElementById('addTextBtn').addEventListener('click', () => {
        const text = document.getElementById('textEditor').value;
        if (text.trim()) {
            addAnnotation({
                type: 'text',
                text: text,
                x: 100,
                y: 100,
                page: currentPage,
                fontSize: parseInt(document.getElementById('fontSize').value),
                color: document.getElementById('textColor').value
            });
            document.getElementById('textEditor').value = '';
        }
    });
    
    // Generate Summary
    document.getElementById('generateSummaryBtn').addEventListener('click', summarizePDF);
}

// AI Functions
async function summarizePDF() {
    try {
        showToast('Generating summary...', 'info');
        
        const response = await fetch(`/api/pdf/${fileId}/ai/summarize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('summaryContent').textContent = data.summary;
            showToast('Summary generated!', 'success');
        } else {
            showToast('Error generating summary: ' + data.error, 'error');
        }
        
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function extractKeyPoints() {
    try {
        showToast('Extracting key points...', 'info');
        
        const response = await fetch(`/api/pdf/${fileId}/ai/extract`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Show in a modal or panel
            showKeyPointsModal(data.keyPoints);
            showToast('Key points extracted!', 'success');
        } else {
            showToast('Error extracting key points: ' + data.error, 'error');
        }
        
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function grammarCheck() {
    // Get selected text
    const selectedText = window.getSelection().toString();
    
    if (!selectedText.trim()) {
        showToast('Please select some text first', 'warning');
        return;
    }
    
    try {
        showToast('Checking grammar...', 'info');
        
        const response = await fetch(`/api/pdf/${fileId}/ai/grammar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: selectedText
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Show corrected text
            showGrammarModal(selectedText, data.correctedText);
            showToast('Grammar check complete!', 'success');
        } else {
            showToast('Error checking grammar: ' + data.error, 'error');
        }
        
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// PDF Tools Functions
function showMergeModal() {
    document.getElementById('mergeModal').classList.add('show');
}

function showConvertModal() {
    document.getElementById('convertModal').classList.add('show');
}

async function compressPDF() {
    try {
        showToast('Compressing PDF...', 'info');
        
        const response = await fetch(`/api/pdf/${fileId}/compress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`PDF compressed! Size reduced by ${data.reductionPercent}%`, 'success');
            
            // Offer download
            if (confirm(`Compression reduced size by ${data.reductionPercent}%. Download now?`)) {
                window.location.href = data.downloadUrl;
            }
        } else {
            showToast('Error compressing PDF: ' + data.error, 'error');
        }
        
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initPDFEditor);