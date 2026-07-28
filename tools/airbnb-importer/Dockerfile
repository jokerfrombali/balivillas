FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    BALIVILLAS_WORKSPACE=/workspace \
    BALIVILLAS_IMPORTS_DIR=/workspace/imports \
    PORT=8090
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
EXPOSE 8090
CMD ["python", "app.py"]
