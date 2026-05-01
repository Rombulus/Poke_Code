import sys

file_path = sys.argv[1]

try:
    import PyPDF2
    with open(file_path, 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        print(text)
        sys.exit(0)
except ImportError:
    pass

try:
    import fitz # PyMuPDF
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
    print(text)
    sys.exit(0)
except ImportError:
    pass

print("FAILED_TO_READ_PDF")
sys.exit(1)
