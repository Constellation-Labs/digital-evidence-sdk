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

# Combined targets
install: ts-install py-install

build: ts-build py-build

test: ts-test py-test

lint: ts-lint py-lint

clean:
	rm -rf packages/typescript/dist packages/typescript/coverage
	rm -rf packages/python/dist packages/python/build packages/python/*.egg-info
