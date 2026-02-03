# Contributing to Peptide Visual Lab

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (optional, for containerized development)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/peptide-prediction.git
   cd peptide-prediction
   ```

2. **Backend setup**
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env  # Configure as needed
   ```

3. **Frontend setup**
   ```bash
   cd ui
   npm install
   ```

4. **Run the development servers**
   ```bash
   # Terminal 1 - Backend
   cd backend && source .venv/bin/activate
   uvicorn api.main:app --reload

   # Terminal 2 - Frontend
   cd ui && npm run dev
   ```

## Development Workflow

### Branch Naming

- `feature/<description>` - New features
- `fix/<description>` - Bug fixes
- `docs/<description>` - Documentation updates
- `refactor/<description>` - Code refactoring

### Commit Messages

Follow conventional commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(api): add batch prediction endpoint

- Support processing multiple sequences in one request
- Add progress tracking for long-running predictions
```

### Code Style

#### Python (Backend)

- Use `ruff` for linting and formatting
- Follow PEP 8 guidelines
- Add type hints to function signatures

```bash
cd backend
ruff check .        # Lint
ruff format .       # Format
mypy .              # Type check
```

#### TypeScript (Frontend)

- Use ESLint and Prettier
- Follow React best practices

```bash
cd ui
npm run lint        # Lint
npm run format      # Format (if configured)
```

### Testing

Run tests before submitting:

```bash
# All tests
make test

# Backend only
cd backend && pytest tests/ -v

# Frontend build check
cd ui && npm run build
```

### Pre-commit Hooks

Install pre-commit hooks to automatically check code:

```bash
pip install pre-commit
pre-commit install
```

## Pull Request Process

1. **Create a branch** from `main`
2. **Make your changes** with clear commits
3. **Run tests** and ensure they pass
4. **Update documentation** if needed
5. **Submit a PR** with a clear description

### PR Checklist

- [ ] Tests pass (`make test`)
- [ ] Linting passes (`make lint`)
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow conventions
- [ ] PR description explains the changes

## Project Structure

```
peptide-prediction/
├── backend/              # FastAPI Python backend
│   ├── api/              # API routes
│   ├── services/         # Business logic
│   ├── schemas/          # Pydantic models
│   └── tests/            # Python tests
├── ui/                   # React TypeScript frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── lib/          # Utilities
│   │   └── types/        # TypeScript types
│   └── public/           # Static assets
├── docker/               # Docker configuration
└── docs/                 # Documentation
```

## Key Guidelines

### API Changes

- Document new endpoints in code comments
- Update TypeScript types to match backend schemas
- Add tests for new endpoints

### Schema Changes

- Backend schemas are in `backend/schemas/api_models.py`
- Frontend types are in `ui/src/types/peptide.ts`
- Keep these in sync!

### Adding Dependencies

- **Backend**: Add to `requirements.txt`
- **Frontend**: Use `npm install <package>`
- Document why the dependency is needed in your PR

## Questions?

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Use discussions for general questions

## License

By contributing, you agree that your contributions will be licensed under the project's license.
