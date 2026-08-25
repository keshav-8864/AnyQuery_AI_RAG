import os
from dotenv import load_dotenv
import requests

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
response = requests.get(url)
models = response.json().get('models', [])
for m in models:
    if 'embed' in m.get('supportedGenerationMethods', []):
        print(m['name'])
