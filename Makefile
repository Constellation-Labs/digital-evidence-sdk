.PHONY: install build test lint clean

PYTHON_VENV := packages/python/.venv
PYTHON := $(PYTHON_VENV)/bin/python3
PIP := $(PYTHON_VENV)/bin/pip

# TypeScript
ts-install:
	cd packages/typescript && npm install

ts-build:
	cd packages/typescript && npm run build

ts-test:
	cd packages/typescript && npm test

ts-lint:
	cd packages/typescript && npm run lint

# TypeScript x402
ts-x402-install:
	cd packages/typescript-x402 && npm install

ts-x402-build:
	cd packages/typescript-x402 && npm run build

ts-x402-test:
	cd packages/typescript-x402 && npm test

ts-x402-lint:
	cd packages/typescript-x402 && npm run lint

# Python
py-venv:
	python3 -m venv $(PYTHON_VENV)

py-install: py-venv
	cd packages/python && ../$(PIP) install -e ".[dev]"

py-build:
	$(PYTHON) -m build packages/python

py-test:
	cd packages/python && $(CURDIR)/$(PYTHON_VENV)/bin/pytest

py-lint:
	cd packages/python && $(CURDIR)/$(PYTHON_VENV)/bin/ruff check src tests

# Python x402
py-x402-install: py-venv
	cd packages/python-x402 && ../$(PIP) install -e ".[dev]"

py-x402-test:
	cd packages/python-x402 && $(CURDIR)/$(PYTHON_VENV)/bin/pytest

py-x402-lint:
	cd packages/python-x402 && $(CURDIR)/$(PYTHON_VENV)/bin/ruff check src tests

# Combined targets
install: ts-install ts-x402-install py-install py-x402-install

build: ts-build ts-x402-build py-build

test: ts-test ts-x402-test py-test py-x402-test

lint: ts-lint ts-x402-lint py-lint py-x402-lint

clean:
	rm -rf packages/typescript/dist packages/typescript/coverage
	rm -rf packages/typescript-x402/dist packages/typescript-x402/coverage
	rm -rf packages/python/dist packages/python/build packages/python/*.egg-info
	rm -rf packages/python-x402/dist packages/python-x402/build packages/python-x402/*.egg-info
