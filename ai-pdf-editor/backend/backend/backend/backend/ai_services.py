import os
from openai import OpenAI
import google.generativeai as genai
from dotenv import load_dotenv
import pdf_processor

load_dotenv()

class AIServices:
    def __init__(self):
        # Initialize AI clients
        self.openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        self.gemini_model = genai.GenerativeModel('gemini-pro')
    
    def summarize_pdf(self, pdf_path, max_length=500):
        """Summarize PDF content using AI"""
        try:
            # Extract text from PDF
            text = pdf_processor.extract_text(pdf_path)
            
            if len(text) > 100000:  # Truncate very long documents
                text = text[:100000]
            
            # Use OpenAI for summarization
            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that summarizes documents concisely."},
                    {"role": "user", "content": f"Please summarize the following document in about {max_length} characters:\n\n{text}"}
                ],
                max_tokens=300
            )
            
            summary = response.choices[0].message.content
            return summary
            
        except Exception as e:
            # Fallback to Gemini
            try:
                prompt = f"Summarize this document concisely: {text[:50000]}"
                response = self.gemini_model.generate_content(prompt)
                return response.text
            except Exception as e2:
                return f"Error generating summary: {str(e2)}"
    
    def chat_with_pdf(self, pdf_path, question):
        """Answer questions based on PDF content"""
        try:
            # Extract text from PDF
            text = pdf_processor.extract_text(pdf_path)
            
            if len(text) > 50000:  # Truncate for context limits
                text = text[:50000]
            
            # Use Gemini for Q&A
            prompt = f"Based on the following document, answer this question: {question}\n\nDocument:\n{text}"
            
            response = self.gemini_model.generate_content(prompt)
            return response.text
            
        except Exception as e:
            return f"Error processing your question: {str(e)}"
    
    def extract_key_points(self, pdf_path, num_points=10):
        """Extract key points from PDF"""
        try:
            text = pdf_processor.extract_text(pdf_path)
            
            if len(text) > 50000:
                text = text[:50000]
            
            prompt = f"Extract {num_points} key points from this document:\n\n{text}"
            
            response = self.gemini_model.generate_content(prompt)
            return response.text
            
        except Exception as e:
            return f"Error extracting key points: {str(e)}"
    
    def grammar_check(self, text):
        """Check and correct grammar"""
        try:
            prompt = f"Please check and correct the grammar of this text:\n\n{text}\n\nProvide only the corrected version:"
            
            response = self.gemini_model.generate_content(prompt)
            return response.text
            
        except Exception as e:
            return text  # Return original text if error

# Singleton instance
ai_services = AIServices()

# Convenience functions
summarize_pdf = ai_services.summarize_pdf
chat_with_pdf = ai_services.chat_with_pdf
extract_key_points = ai_services.extract_key_points
grammar_check = ai_services.grammar_check