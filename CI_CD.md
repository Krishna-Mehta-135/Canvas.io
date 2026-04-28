# CI/CD Setup

This document describes the continuous integration and continuous deployment (CI/CD) pipeline for Canvas.io.

## Overview

The CI/CD pipeline runs automatically on:
- **Push** to `main` or `develop` branches
- **Pull requests** targeting `main` or `develop` branches

## Workflows

### 1. CI Workflow (`ci.yml`)

The main CI workflow runs in parallel and includes:

#### Lint Job
- Runs ESLint and other linters across the monorepo
- Ensures code style consistency
- **Fails the build** if linting issues are found

#### Type Check Job
- Runs TypeScript type checking via `turbo run check-types`
- Validates type safety across all packages
- **Fails the build** if type errors are found

#### Test Job
- Executes all tests via `turbo run test`
- Uses Vitest for packages with configured test suites
- Packages without tests display a message but don't fail
- **Fails the build** if any test fails

#### Build Job
- Runs after lint, type check, and test jobs pass (via `needs` dependency)
- Builds the entire monorepo with `turbo run build`
- Ensures the application can be successfully compiled

### 2. Test Coverage Workflow (`test-coverage.yml`)

- Generates coverage reports for all test suites
- Uploads coverage data to Codecov for tracking coverage metrics over time
- Runs on push to main/develop and on pull requests

## Local Commands

You can run the same checks locally before pushing:

```bash
# Run all checks (lint, type check, test)
pnpm run ci

# Run individual checks
pnpm run lint        # Run linter
pnpm run check-types # Type check
pnpm run test        # Run tests
pnpm run test:coverage # Run tests with coverage

# Run build
pnpm run build
```

## Adding Tests to Packages

To add tests to a package that doesn't have them:

1. Install test dependencies (usually Vitest):
   ```bash
   pnpm add -D vitest @vitest/coverage-v8
   ```

2. Update `package.json` with test script:
   ```json
   {
     "scripts": {
       "test": "vitest run",
       "test:watch": "vitest",
       "test:coverage": "vitest run --coverage"
     }
   }
   ```

3. Create test files with `.test.ts` or `.test.tsx` extension

The `turbo.json` `test` task will automatically pick up the new tests.

## Troubleshooting

### Build fails on GitHub but passes locally

Common causes:
- Missing environment variables in CI
- Different Node.js or pnpm versions
- Caching issues

Solutions:
- Check workflow logs on GitHub Actions
- Verify Node version: `node --version` (should be 18+)
- Verify pnpm version: `pnpm --version` (should be 10.30.1)
- Clear caches: `pnpm install --frozen-lockfile`

### Tests fail in CI but pass locally

- Different environment variables
- Test order dependency (tests should be independent)
- Race conditions in async tests

### Coverage upload fails

- Codecov token may be required for private repositories
- Add `CODECOV_TOKEN` to GitHub repository secrets if needed

## GitHub Actions Configuration

All workflows use:
- **Node.js**: 18 (LTS)
- **pnpm**: 10.30.1
- **OS**: ubuntu-latest

To update versions, modify the environment variables in `.github/workflows/*.yml`:
```yaml
env:
  PNPM_VERSION: 10.30.1
  NODE_VERSION: 18
```
