#!/bin/bash

/usr/bin/ollama serve &
sleep 2

if [[ $(ollama list | grep nomic-embed-text | wc -l) -lt 1 ]]; then
    ollama pull nomic-embed-text
    ollama pull qwen2.5:7b-instruct
fi

. /var/venv/ollama-web/bin/activate
cd /app
python app.py
