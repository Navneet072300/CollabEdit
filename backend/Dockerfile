FROM python:3.12-slim

WORKDIR /app

# Install all language runtimes in one layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build tools (C / C++)
    gcc g++ make \
    # PostgreSQL client libs
    libpq-dev \
    # Go
    golang-go \
    # Java (JDK for javac + java)
    default-jdk \
    # Ruby
    ruby \
    # Rust
    rustc \
    # SQLite (for SQL execution)
    sqlite3 \
    # Mono C# compiler + runtime
    mono-mcs mono-runtime \
    # curl for Node.js setup
    curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
