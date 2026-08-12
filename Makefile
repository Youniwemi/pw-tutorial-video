.PHONY: build test e2e video site clean help

help: ## Show available targets
	@grep -E '^[a-z][a-z_-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

build: ## Compile TypeScript + copy styles
	npm run build

test: ## Unit tests (vitest)
	npm test

e2e: build ## Playwright e2e tests (no video)
	npx playwright test

video: build ## Playwright e2e tests with video generation
	TUTORIAL_MODE=true npx playwright test

site: build ## Build the static tutorial gallery site
	npx build-tutorial-site

clean: ## Remove generated artifacts
	rm -rf dist tutorials/output tutorials/videos/tutorial_*.webm tutorial-site-dist test-results
