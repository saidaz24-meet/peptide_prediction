.PHONY: test test-unit lint typecheck fmt ci help

# Default target
help:
	@echo "Available targets:"
	@echo "  make test       - Run all tests (fast, deterministic, no network)"
	@echo "  make test-unit  - Run fastest unit tests only"
	@echo "  make lint       - Run linters (Python + TypeScript)"
	@echo "  make typecheck  - Run type checkers (Python + TypeScript)"
	@echo "  make fmt        - Format code (Python + TypeScript)"
	@echo "  make ci         - Run lint + typecheck + test (CI pipeline)"

# Test targets
test:
	@echo "Running Python tests..."
	cd backend && USE_TANGO=0 USE_PSIPRED=0 python -m pytest tests/ -v --tb=short

test-unit:
	@echo "Running fast unit tests..."
	cd backend && USE_TANGO=0 USE_PSIPRED=0 python -m pytest tests/test_api_contracts.py tests/test_uniprot_query_parsing.py tests/test_uniprot_sort.py tests/test_trace_id.py -v --tb=short

# Lint targets
lint:
	@echo "Linting Python code..."
	@cd backend && ruff check .
	@echo "Linting TypeScript code..."
	@cd ui && npm run lint

# Type check targets
typecheck:
	@echo "Type checking Python code..."
	@cd backend && mypy . --ignore-missing-imports --no-strict-optional || (echo "⚠️  mypy errors found (install with: pip install mypy)" && exit 1)
	@echo "Type checking TypeScript code..."
	@cd ui && npx tsc --noEmit

# Format targets
fmt:
	@echo "Formatting Python code..."
	cd backend && ruff format .
	@echo "Formatting TypeScript code..."
	cd ui && npx prettier --write "src/**/*.{ts,tsx}" || echo "Prettier not installed, skipping"

# CI pipeline
ci: lint typecheck test
	@echo "✅ CI checks passed"

