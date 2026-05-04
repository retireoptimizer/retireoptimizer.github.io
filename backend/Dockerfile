FROM python:3.12-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml .
RUN uv pip install --system --no-cache -e .

COPY src/ src/

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "fireopt.main:app", "--host", "0.0.0.0", "--port", "8000"]
