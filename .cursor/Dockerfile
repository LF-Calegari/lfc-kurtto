FROM node:24-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    postgresql-client \
    docker.io \
    docker-compose-plugin \
  && rm -rf /var/lib/apt/lists/*
