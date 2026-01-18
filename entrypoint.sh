#!/bin/bash

/usr/bin/ollama serve &
sleep 2

echo "Preloading models:"
for model in $(ollama list | cut -d' ' -f1 | tail -n+2); do 
    echo "  $model"
    ollama run $model "Hello" &>/dev/null
done
echo "Done"

. /var/venv/ollama-web/bin/activate
cd /app
python app.py
