import sys
import json
import os
import requests
from dotenv import load_dotenv

# Force Windows to handle emojis/modern text
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()

def get_response(user_input):
    api_key = os.getenv("OPENROUTER_API_KEY")
    url = "https://openrouter.ai/api/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "google/gemma-3-27b-it:free",
        "messages": [{"role": "user", "content": user_input}]
    }

    try:
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 200:
            result = response.json()
            return result['choices'][0]['message']['content']
        else:
            return f"Error: {response.status_code} - {response.text}"
    except Exception as e:
        return f"System Error: {str(e)}"

if __name__ == "__main__":
    # Node.js sends data through stdin
    input_data = sys.stdin.read()
    if input_data:
        try:
            json_input = json.loads(input_data)
            user_message = json_input.get("message", "")
            
            # CALL the function (don't forget the parentheses!)
            final_answer = get_response(user_message)
            
            # Print the text result to stdout for Node.js to catch
            print(final_answer, flush=True)
            
        except Exception as e:
            # Errors go to stderr so they don't break the JSON response
            print(f"Python Error: {str(e)}", file=sys.stderr)