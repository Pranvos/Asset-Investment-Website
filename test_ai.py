import os
import requests
from dotenv import load_dotenv

# 1. Load your .env file
load_dotenv()
api_key = os.getenv("OPENROUTER_API_KEY")

def test_connection():
    print("🚀 Starting AI Connectivity Test...")
    
    if not api_key:
        print("❌ ERROR: No API Key found in .env file.")
        return

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000", # Required by some free providers
        "X-Title": "Test Script"
    }
    
    # Use a highly available free model
    data = {
        "model": "google/gemma-3-27b-it:free", 
        "messages": [{"role": "user", "content": "Say 'The AI is alive!'"}]
    }

    try:
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code == 200:
            result = response.json()
            answer = result['choices'][0]['message']['content']
            print(f"✅ SUCCESS! AI Response: {answer}")
        elif response.status_code == 402:
            print("❌ ERROR 402: Credit Limit reached or Privacy settings blocking free models.")
            print("👉 Check: Is your key 'Credit Limit' empty? Is 'Model Training' ON?")
        elif response.status_code == 401:
            print("❌ ERROR 401: Invalid API Key. Check for extra spaces in your .env file.")
        else:
            print(f"❌ ERROR {response.status_code}: {response.text}")

    except Exception as e:
        print(f"⚠️ SYSTEM ERROR: {str(e)}")

if __name__ == "__main__":
    test_connection()