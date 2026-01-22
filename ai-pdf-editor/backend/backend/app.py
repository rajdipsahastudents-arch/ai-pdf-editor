import os
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import json
from werkzeug.utils import secure_filename
import pdf_processor
import ai_services

app = Flask(__name__, static_folder='../frontend')
CORS(app)

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['PROCESSED_FOLDER'] = 'processed'
app.config['ALLOWED_EXTENSIONS'] = {'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'}

# Create directories
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/')
def serve_frontend():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

@app.route('/api/upload', methods=['POST'])
def upload_pdf():
    """Handle PDF upload with drag & drop support"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    original_filename = secure_filename(file.filename)
    file_extension = original_filename.rsplit('.', 1)[1].lower()
    new_filename = f"{file_id}.{file_extension}"
    
    # Save file
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
    file.save(file_path)
    
    # Extract basic metadata
    page_count = pdf_processor.get_page_count(file_path) if file_extension == 'pdf' else 1
    file_size = os.path.getsize(file_path)
    
    return jsonify({
        'success': True,
        'fileId': file_id,
        'filename': original_filename,
        'pageCount': page_count,
        'fileSize': file_size,
        'uploadedAt': datetime.now().isoformat()
    })

@app.route('/api/pdf/<file_id>/pages')
def get_pdf_pages(file_id):
    """Get PDF pages for display in browser"""
    page_num = request.args.get('page', 1, type=int)
    pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{file_id}.pdf")
    
    if not os.path.exists(pdf_path):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        page_data = pdf_processor.get_page_as_image(pdf_path, page_num)
        return jsonify({
            'success': True,
            'page': page_num,
            'data': page_data,
            'totalPages': pdf_processor.get_page_count(pdf_path)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/pdf/<file_id>/edit', methods=['POST'])
def edit_pdf(file_id):
    """Edit PDF content - text modification, annotations, etc."""
    data = request.json
    operation = data.get('operation')
    
    pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{file_id}.pdf")
    output_path = os.path.join(app.config['PROCESSED_FOLDER'], f"{file_id}_edited.pdf")
    
    try:
        if operation == 'add_text':
            pdf_processor.add_text_to_pdf(
                pdf_path, 
                output_path,
                data['text'],
                data.get('page'),
                data.get('x'),
                data.get('y')
            )
        elif operation == 'highlight':
            pdf_processor.highlight_text(
                pdf_path,
                output_path,
                data['page'],
                data['text'],
                data.get('color', '#ffff00')
            )
        elif operation == 'add_image':
            pdf_processor.add_image_to_pdf(
                pdf_path,
                output_path,
                data['imageData'],
                data['page'],
                data.get('x'),
                data.get('y')
            )
        elif operation == 'merge':
            pdf_processor.merge_pdfs(
                [pdf_path] + data['otherFiles'],
                output_path
            )
        elif operation == 'split':
            result_files = pdf_processor.split_pdf(
                pdf_path,
                data['pages']
            )
            return jsonify({
                'success': True,
                'files': result_files
            })
        
        return jsonify({
            'success': True,
            'downloadUrl': f'/api/download/{file_id}_edited.pdf'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/pdf/<file_id>/ai/summarize', methods=['POST'])
def summarize_pdf(file_id):
    """AI-powered PDF summarization"""
    try:
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{file_id}.pdf")
        summary = ai_services.summarize_pdf(pdf_path)
        
        return jsonify({
            'success': True,
            'summary': summary
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/pdf/<file_id>/ai/chat', methods=['POST'])
def chat_with_pdf(file_id):
    """Chat with PDF using AI"""
    data = request.json
    question = data.get('question')
    
    if not question:
        return jsonify({'error': 'Question is required'}), 400
    
    try:
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{file_id}.pdf")
        response = ai_services.chat_with_pdf(pdf_path, question)
        
        return jsonify({
            'success': True,
            'answer': response
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/pdf/<file_id>/convert', methods=['POST'])
def convert_pdf(file_id):
    """Convert PDF to other formats"""
    data = request.json
    target_format = data.get('format')
    
    pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{file_id}.pdf")
    
    try:
        if target_format == 'docx':
            output_path = pdf_processor.convert_to_docx(pdf_path)
        elif target_format == 'excel':
            output_path = pdf_processor.convert_to_excel(pdf_path)
        elif target_format == 'images':
            output_paths = pdf_processor.convert_to_images(pdf_path)
            return jsonify({
                'success': True,
                'files': output_paths
            })
        else:
            return jsonify({'error': 'Unsupported format'}), 400
        
        return jsonify({
            'success': True,
            'downloadUrl': f'/api/download/{os.path.basename(output_path)}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/pdf/<file_id>/compress', methods=['POST'])
def compress_pdf(file_id):
    """Compress PDF file size"""
    try:
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{file_id}.pdf")
        output_path = pdf_processor.compress_pdf(pdf_path)
        
        original_size = os.path.getsize(pdf_path)
        compressed_size = os.path.getsize(output_path)
        reduction = ((original_size - compressed_size) / original_size) * 100
        
        return jsonify({
            'success': True,
            'downloadUrl': f'/api/download/{os.path.basename(output_path)}',
            'originalSize': original_size,
            'compressedSize': compressed_size,
            'reductionPercent': round(reduction, 2)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<filename>')
def download_file(filename):
    """Download processed files"""
    return send_file(
        os.path.join(app.config['PROCESSED_FOLDER'], filename),
        as_attachment=True,
        download_name=filename
    )

if __name__ == '__main__':
    app.run(debug=True, port=5000)