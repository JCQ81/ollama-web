FROM	ollama/ollama:0.14.2

RUN	apt update && apt -y upgrade
RUN     DEBIAN_FRONTEND=noninteractive apt -y install python3 python3-pip python3-venv
RUN     python3 -m venv /var/venv/ollama-web \
        && . /var/venv/ollama-web/bin/activate \
        && pip install flask ollama

COPY    app /app

ADD     entrypoint.sh /entrypoint.sh
RUN     chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
