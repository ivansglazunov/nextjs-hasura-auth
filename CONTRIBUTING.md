# Contributing to Hasyx

First off, thank you for considering contributing to Hasyx! 🎉 We welcome any help, from fixing bugs to adding new features.

## Development Setup

If you want to contribute to the Hasyx package itself (not just use it in your project), follow these steps:

1.  **Fork the repository** on GitHub.
2.  **Clone your fork locally:**
    ```bash
    git clone <your-fork-url>
    cd hasyx
    ```
3.  **Install dependencies:**
    We recommend using `npm ci` for consistent installs based on `package-lock.json`.
    ```bash
    npm ci
    ```
4.  **Create a new branch** for your changes:
    ```bash
    git checkout -b feat/your-feature-name
    # or
    git checkout -b fix/your-bug-fix
    ```
5.  **Make your changes.**

## Running Tests

Ensure your changes don't break existing functionality by running the test suite:

```bash
npm test
```

Please add tests for any new features or bug fixes.

## Making Changes & Adding Files

When adding new files or directories to the `hasyx` package codebase, please remember to check and potentially update the following configuration files to ensure they are correctly included/excluded/compiled/copied:

1.  **`.npmignore`**: Controls which files are **included** in the final published npm package. Make sure your new source files are *excluded* if necessary (e.g., `.ts` files outside `app/`), and compiled files (`.js`, `.d.ts` in `dist/`) are *included*. Check the `files` array in `package.json` first, as it takes precedence.
2.  **`.gitignore`**: Controls which files are tracked by Git. Ensure generated files (like compiled code in `dist/` or `.js`/`.d.ts` files next to source) are *ignored*.
3.  **`tsconfig.lib.json`**: The `include` array determines which TypeScript files are compiled into the `dist` directory. Make sure your new `.ts`/`.tsx` source files are covered by the patterns here.
4.  **`lib/cli.ts`**: If you add files that should be copied or created when a user runs `npx hasyx init`, update the `filesToCreateOrReplace` or `filesToCreateIfNotExists` objects within the `init` command action.

## Submitting a Pull Request

1.  Push your changes to your fork:
    ```bash
    git push origin feat/your-feature-name
    ```
2.  Open a **Pull Request** from your fork's branch to the `main` branch of the original `hasyx` repository.
3.  Provide a clear description of your changes in the Pull Request.
4.  We'll review your contribution as soon as possible!

Thank you again for your contribution! 🙏 