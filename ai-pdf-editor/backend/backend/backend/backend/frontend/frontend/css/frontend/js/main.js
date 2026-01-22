// DOM Elements
const themeToggle = document.getElementById('themeToggle');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const uploadTrigger = document.getElementById('uploadTrigger');
const toast = document.getElementById('toast');
const toastClose = document.querySelector('.toast-close');
const uploadModal = document.getElementById('uploadModal');
const modalClose = document.querySelector('.modal-close');
const uploadProgress = document.getElementById('uploadProgress');
const progressText = document.getElementById('progressText');

// Theme Toggle
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.className = savedTheme + '-theme';
    
    const icon = themeToggle.querySelector('i');
    icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-theme');
    
    if (isDark) {
        document.body.className = 'light-theme';
        localStorage.setItem('theme', 'light');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        document.body.className = 'dark-theme';
        localStorage.setItem('theme', 'dark');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
});

// File Upload Handling
uploadTrigger.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary-color)';
    dropZone.style.backgroundColor = 'var(--bg-tertiary)';
});

dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.backgroundColor = 'var(--bg-secondary)';
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.backgroundColor = 'var(--bg-secondary)';
    
    if (e.dataTransfer.files.length) {
        handleFileUpload(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFileUpload(e.target.files[0]);
    }
});

// File Upload Function
async function handleFileUpload(file) {
    if (!file) return;
    
    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 
                       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                       'image/jpeg', 'image/jpg', 'image/png'];
    
    if (!validTypes.includes(file.type)) {
        showToast('Please upload a valid file (PDF, Word, or Image)', 'error');
        return;
    }
    
    // Validate file size (100MB)
    if (file.size > 100 * 1024 * 1024) {
        showToast('File size must be less than 100MB', 'error');
        return;
    }
    
    // Show upload modal
    uploadModal.classList.add('show');
    
    // Create FormData
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        // Upload file
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('File uploaded successfully!', 'success');
            
            // Redirect to editor after 2 seconds
            setTimeout(() => {
                window.location.href = `editor.html?fileId=${data.fileId}`;
            }, 2000);
        } else {
            showToast(data.error || 'Upload failed', 'error');
        }
    } catch (error) {
        showToast('Upload failed: ' + error.message, 'error');
    } finally {
        // Hide modal after 2 seconds
        setTimeout(() => {
            uploadModal.classList.remove('show');
            uploadProgress.style.width = '0%';
            progressText.textContent = '0% uploaded';
        }, 2000);
    }
    
    // Simulate upload progress (in real app, use actual progress events)
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        uploadProgress.style.width = `${progress}%`;
        progressText.textContent = `${progress}% uploaded`;
        
        if (progress >= 100) {
            clearInterval(interval);
        }
    }, 200);
}

// Toast Notification System
function showToast(message, type = 'success') {
    const toastIcon = toast.querySelector('i');
    const toastMessage = toast.querySelector('.toast-message');
    
    // Set icon based on type
    switch(type) {
        case 'success':
            toastIcon.className = 'fas fa-check-circle';
            toastIcon.style.color = 'var(--success-color)';
            toast.style.borderLeftColor = 'var(--success-color)';
            break;
        case 'error':
            toastIcon.className = 'fas fa-exclamation-circle';
            toastIcon.style.color = 'var(--error-color)';
            toast.style.borderLeftColor = 'var(--error-color)';
            break;
        case 'warning':
            toastIcon.className = 'fas fa-exclamation-triangle';
            toastIcon.style.color = 'var(--warning-color)';
            toast.style.borderLeftColor = 'var(--warning-color)';
            break;
    }
    
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

toastClose.addEventListener('click', () => {
    toast.classList.remove('show');
});

// Modal Close
modalClose.addEventListener('click', () => {
    uploadModal.classList.remove('show');
});

// Close modal when clicking outside
uploadModal.addEventListener('click', (e) => {
    if (e.target === uploadModal) {
        uploadModal.classList.remove('show');
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    
    // Check for fileId in URL (for direct editor access)
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('fileId');
    
    if (fileId && window.location.pathname.includes('editor.html')) {
        // Load the PDF in editor
        loadPDFInEditor(fileId);
    }
});

// Mobile Menu Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navMenu = document.querySelector('.nav-menu');
const navActions = document.querySelector('.nav-actions');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        const isMenuVisible = navMenu.style.display === 'flex';
        
        if (isMenuVisible) {
            navMenu.style.display = 'none';
            navActions.style.display = 'none';
        } else {
            navMenu.style.display = 'flex';
            navActions.style.display = 'flex';
            navMenu.style.flexDirection = 'column';
            navMenu.style.position = 'absolute';
            navMenu.style.top = '100%';
            navMenu.style.left = '0';
            navMenu.style.right = '0';
            navMenu.style.backgroundColor = 'var(--bg-color)';
            navMenu.style.padding = '1rem';
            navMenu.style.boxShadow = 'var(--shadow-lg)';
        }
    });
}