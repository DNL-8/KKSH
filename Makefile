SHELL := /bin/bash

.PHONY: install dev dev-api dev-client build lint format test test-backend e2e check docker-build

install:
	python -m pip install -r backend/requirements.txt -r backend/requirements-dev.txt
	pnpm install

dev:
	pnpm dev:all

dev-api:
	pnpm dev:api

dev-client:
	pnpm dev:client

build:
	pnpm build

docker-build:
	docker build -f Dockerfile .

format:
	cd backend && black .

lint:
	cd backend && ruff check . && black --check . && mypy app
	pnpm lint:frontend
	pnpm typecheck

test-backend:
	cd backend && pytest -q

e2e:
	pnpm e2e

check:
	pnpm check

test: test-backend