# Infrastructure Setup Plan for `npx hasyx infra`

## Overview
The `infra` command will automate the setup of infrastructure for a Next.js project with Hasura GraphQL, Vercel deployment, and GitHub actions integration.

## Local Development and Testing

### Local Testing Without Publishing
- [ ] Configure `npm link` for local development
  - [ ] Run `npm link` in the hasyx package directory
  - [ ] Use `npx hasyx infra` in any test directory to test local version
- [ ] Alternative testing approaches:
  - [ ] Direct execution: `node /path/to/hasyx/lib/cli.js infra`
  - [ ] Using `yalc` for more reliable local publishing

### Infrastructure Cleanup (`uninfra` command)
- [x] Create the `uninfra` command to remove created infrastructure
  - [x] Parse .env file to get infrastructure details
  - [x] Get GitHub repository information from package.json
  - [x] Delete GitHub repository
  - [x] Delete Vercel project
  - [x] Delete Hasura project (show manual instructions for now)
  - [x] Add confirmation prompt for safety
  - [x] Support skipping individual services

## Project Initialization
- [ ] Check if package.json exists
  - [ ] If not, run interactive `npm init` with user input
  - [ ] Implementation: Use `spawn.sync('npm', ['init'])` with `stdio: 'inherit'`
- [ ] Check if repository field is set in package.json
  - [ ] If not, prompt user for repository URL
  - [ ] Implementation: Parse GitHub owner/repo format for later API calls
- [ ] Check if .env file exists
  - [ ] If not, create it
  - [ ] If exists, parse and preserve existing variables

## Authentication Helpers
- [ ] Create helper functions for GitHub authentication
  - [ ] Implement GitHub CLI detection (`gh auth status`)
  - [ ] Implement Personal Access Token prompt/storage
  - [ ] Implement device code flow if needed
- [ ] Create helper functions for Vercel authentication
  - [ ] Implement Vercel CLI detection
  - [ ] Implement token-based authentication
- [ ] Create helper functions for Hasura authentication
  - [ ] Implement token-based authentication
  - [ ] Implement project creation and configuration

## Environment Variables Management
- [ ] Create helper function to update .env file (preserving comments and formatting)
- [ ] Generate secure random strings for secrets
  - [ ] Implementation: Use `crypto.randomBytes(32).toString('hex')`
- [ ] Handle required variables with defaults:
  ```
  TEST_TOKEN=random
  NEXTAUTH_SECRET=random
  NEXT_PUBLIC_WS=1 (locally)
  NODE_ENV=development (locally)
  ```
- [ ] Handle variables with user prompts:
  ```
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  YANDEX_CLIENT_ID
  YANDEX_CLIENT_SECRET
  RESEND_API_KEY
  ```

## GitHub Integration
- [ ] Research: Best approach for GitHub API integration
  - [ ] GitHub CLI (`gh`) if installed - simplest approach
  - [ ] `@octokit/rest` package for direct API interaction
  - [ ] `@octokit/auth-*` for authentication methods
- [ ] Implementation tasks:
  - [ ] Get repository details (owner, name) from package.json or prompt
  - [ ] Check repository existence
  - [ ] Set repository secrets via API
  - [ ] Validate GitHub Pages setup

## Vercel Integration
- [ ] Research: Best approach for Vercel API integration
  - [ ] Vercel CLI (`vercel`) if installed
  - [ ] Vercel API via `@vercel/client` or direct HTTP
- [ ] Implementation tasks:
  - [ ] Authenticate with Vercel account
  - [ ] Create new project with repository
  - [ ] Set project environment variables
  - [ ] Get deployment URL for NEXT_PUBLIC_MAIN_URL

## Hasura Integration
- [ ] Research: Best approach for Hasura Cloud API integration
  - [ ] Hasura CLI for project creation
  - [ ] Hasura Cloud API via direct HTTP
- [ ] Implementation tasks:
  - [ ] Create new Hasura project
  - [ ] Configure HASURA_GRAPHQL_UNAUTHORIZED_ROLE
  - [ ] Get endpoint and admin secret for env variables

## Command Implementation
- [x] Create new infra.ts module in lib directory
- [x] Add command to CLI:
  ```typescript
  program
    .command('infra')
    .description('Setup infrastructure for Next.js, Hasura, Vercel, and GitHub.')
    .action(async () => {
      // Implementation with proper step progression
    });
  ```
- [x] Create new uninfra.ts module in lib directory
- [x] Add uninfra command to CLI
- [ ] Implement main workflow with progress tracking
- [ ] Add proper error handling and resumability

## Additional Features
- [x] Add `--skip-github` flag for skipping GitHub integration
- [x] Add `--skip-vercel` flag for skipping Vercel integration
- [x] Add `--skip-hasura` flag for skipping Hasura integration
- [x] Add `--debug` flag for verbose logging
- [ ] Save progress to allow resuming partial setup

## Research Questions

### GitHub API Authentication
- [ ] How to best authenticate with GitHub API?
  - GitHub CLI (`gh`) is preferred if installed
  - Personal Access Token requires secure user input
  - OAuth device flow requires app registration
- [ ] How to securely manage GitHub tokens?
  - Store temporarily in memory only
  - Consider leveraging OS keychain

### Vercel API Authentication
- [ ] How to best authenticate with Vercel API?
  - Vercel CLI (`vercel`) is preferred if installed
  - Vercel tokens can be created via web UI
- [ ] How to link GitHub repository to Vercel project?
  - API endpoint for project creation with repository link

### Hasura Cloud API
- [ ] How to create and configure Hasura projects programmatically?
  - Cloud API or CLI approach
  - Required permissions and tokens
- [ ] How to configure unauthorized role?
  - Environment variable vs. metadata approach

## Next Steps
- [x] Create basic infra.ts implementation
- [x] Create uninfra.ts implementation
- [ ] Add interactive prompting for repository and other settings
- [ ] Implement GitHub repository creation and setup
- [ ] Implement Vercel project creation and setup
- [ ] Implement Hasura project creation and setup
- [ ] Add comprehensive documentation and examples
- [ ] Create thorough testing procedures
