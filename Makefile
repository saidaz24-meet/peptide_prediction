.PHONY: test test-unit lint typecheck fmt ci help smoke-tango contract-check \
        docker-build docker-up docker-down docker-smoke docker-logs docker-clean

# Default target
help:
	@echo "Available targets:"
	@echo ""
	@echo "  Development:"
	@echo "  make test           - Run all tests (fast, deterministic, no network)"
	@echo "  make test-unit      - Run fastest unit tests only"
	@echo "  make lint           - Run linters (Python + TypeScript)"
	@echo "  make typecheck      - Run type checkers (Python + TypeScript)"
	@echo "  make fmt            - Format code (Python + TypeScript)"
	@echo "  make ci             - Run lint + typecheck + test (CI pipeline)"
	@echo "  make smoke-tango    - Verify TANGO binary works end-to-end"
	@echo "  make contract-check - Verify backend↔UI contract sync"
	@echo ""
	@echo "  Docker:"
	@echo "  make docker-build   - Build Docker images"
	@echo "  make docker-up      - Start containers (dev mode)"
	@echo "  make docker-down    - Stop and remove containers"
	@echo "  make docker-smoke   - Run smoke tests inside container"
	@echo "  make docker-logs    - Tail container logs"
	@echo "  make docker-clean   - Remove all PVL containers, images, volumes"

# Test targets
# Uses venv python if available
test:
	@echo "Running Python tests..."
	@cd backend && \
	if [ -f .venv/bin/python ]; then \
		USE_TANGO=0 USE_PSIPRED=0 .venv/bin/python -m pytest tests/ -v --tb=short; \
	else \
		USE_TANGO=0 USE_PSIPRED=0 python3 -m pytest tests/ -v --tb=short; \
	fi

test-unit:
	@echo "Running fast unit tests..."
	@cd backend && \
	if [ -f .venv/bin/python ]; then \
		USE_TANGO=0 USE_PSIPRED=0 .venv/bin/python -m pytest tests/test_api_contracts.py tests/test_uniprot_query_parsing.py tests/test_uniprot_sort.py tests/test_trace_id.py -v --tb=short; \
	else \
		USE_TANGO=0 USE_PSIPRED=0 python3 -m pytest tests/test_api_contracts.py tests/test_uniprot_query_parsing.py tests/test_uniprot_sort.py tests/test_trace_id.py -v --tb=short; \
	fi

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

# TANGO smoke test - verifies TANGO binary works end-to-end
# Uses venv if available, otherwise system python
smoke-tango:
	@cd backend && \
	if [ -f .venv/bin/python ]; then \
		.venv/bin/python scripts/smoke_tango.py; \
	else \
		python3 scripts/smoke_tango.py; \
	fi

# Contract sync check - verifies backend/schemas/api_models.py matches ui/src/types/peptide.ts
contract-check:
	@cd backend && \
	if [ -f .venv/bin/python ]; then \
		.venv/bin/python scripts/check_contract_sync.py; \
	else \
		python3 scripts/check_contract_sync.py; \
	fi

# =============================================================================
# Docker Targets
# =============================================================================

# Build Docker images with BuildKit
docker-build:
	@echo "Building Docker images with BuildKit..."
	DOCKER_BUILDKIT=1 docker compose -f docker/docker-compose.yml build

# Start containers in development mode
docker-up:
	@echo "Starting containers (dev mode)..."
	docker compose -f docker/docker-compose.yml up -d
	@echo ""
	@echo "Services running:"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend:  http://localhost:8000/api/health"
	@echo ""
	@echo "Use 'make docker-logs' to tail logs"

# Stop and remove containers
docker-down:
	@echo "Stopping containers..."
	docker compose -f docker/docker-compose.yml down

# Run smoke tests inside container
docker-smoke:
	@echo "Running smoke tests inside container..."
	@echo ""
	@echo "1. Checking backend health..."
	@docker compose -f docker/docker-compose.yml exec -T backend curl -sf http://localhost:8000/api/health | python3 -m json.tool || (echo "❌ Backend health check failed" && exit 1)
	@echo "✅ Backend healthy"
	@echo ""
	@echo "2. Running API contract tests..."
	@docker compose -f docker/docker-compose.yml exec -T backend python -m pytest tests/test_api_contracts.py -v --tb=short
	@echo ""
	@echo "3. Running trace ID tests..."
	@docker compose -f docker/docker-compose.yml exec -T backend python -m pytest tests/test_trace_id.py -v --tb=short
	@echo ""
	@echo "4. Checking frontend health..."
	@docker compose -f docker/docker-compose.yml exec -T frontend wget -q -O /dev/null http://localhost:80/health || (echo "❌ Frontend health check failed" && exit 1)
	@echo "✅ Frontend healthy"
	@echo ""
	@echo "✅ All smoke tests passed!"

# Tail container logs
docker-logs:
	docker compose -f docker/docker-compose.yml logs -f

# Clean up all PVL Docker resources
docker-clean:
	@echo "Stopping and removing all PVL containers..."
	docker compose -f docker/docker-compose.yml down -v --rmi local
	@echo "Removing dangling images..."
	docker image prune -f
	@echo "✅ Cleanup complete"

# Production targets
docker-prod-up:
	@echo "Starting production containers..."
	docker compose -f docker/docker-compose.prod.yml up -d
	@echo "Production running at http://localhost"

docker-prod-down:
	docker compose -f docker/docker-compose.prod.yml down
