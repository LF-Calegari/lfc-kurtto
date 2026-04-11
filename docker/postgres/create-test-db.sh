#!/usr/bin/env bash
# Cria o banco `kurtto_test` na primeira inicialização do volume (initdb).
# O banco principal continua vindo de POSTGRES_DB (ex.: kurtto).
set -euo pipefail
if psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -tc \
  "SELECT 1 FROM pg_database WHERE datname = 'kurtto_test'" | grep -q 1; then
  echo "create-test-db: kurtto_test already exists"
else
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -c "CREATE DATABASE kurtto_test;"
  echo "create-test-db: created kurtto_test"
fi
