FROM python:3.13-slim

WORKDIR /app

RUN sed -i \
    -e 's|http://deb.debian.org/debian|https://mirrors.aliyun.com/debian|g' \
    -e 's|http://deb.debian.org/debian-security|https://mirrors.aliyun.com/debian-security|g' \
    /etc/apt/sources.list.d/debian.sources

COPY backend/requirements.txt ./backend-requirements.txt
COPY crawler/requirements.txt ./crawler-requirements.txt
RUN pip install --no-cache-dir \
    -i https://mirrors.aliyun.com/pypi/simple/ \
    --trusted-host mirrors.aliyun.com \
    -r backend-requirements.txt \
    -r crawler-requirements.txt
RUN python -m playwright install --with-deps chromium

COPY backend/app ./app
COPY crawler ./crawler

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
