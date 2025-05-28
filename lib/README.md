# Hasyx Library Structure

This library is organized into client-safe and server-only modules to prevent Node.js dependencies from being bundled in the browser.

## Import Structure

### Client-Safe Imports
Use the main entry point for client-side code:

```typescript
import { useHasyx, useQuery, HasyxProvider } from 'hasyx';
```

This includes:
- Apollo GraphQL client utilities
- Authentication hooks and providers
- React hooks and components
- UI utilities
- PWA components
- All client-safe utilities

### Server-Only Imports
Use the server entry point for server-side code (API routes, server components):

```typescript
import { Exec, ExecTs, Terminal, OpenRouter } from 'hasyx/lib/server';
```

This includes everything from the client-safe imports plus:
- `Exec` - JavaScript code execution
- `ExecTs` - TypeScript code execution  
- `Terminal` - Terminal/PTY functionality
- `OpenRouter` - AI API client with code execution

## Files

- `lib/index.ts` - Client-safe exports (can be used in browser)
- `lib/server.ts` - All exports including server-only modules
- Individual module files for specific functionality

## Migration Guide

If you were previously importing server-only modules from the main entry point:

```typescript
// Before
import { Exec, Terminal } from 'hasyx';

// After  
import { Exec, Terminal } from 'hasyx/lib/server';
```

Client-safe imports remain unchanged:

```typescript
// Still works
import { useHasyx, useQuery } from 'hasyx';
``` 