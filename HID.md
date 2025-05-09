# Hasyx Identifier (HID) Standard

## Overview

The Hasyx Identifier (HID) is a standardized string format used within the Hasyx ecosystem to uniquely identify resources, typically database records. It provides a structured way to reference entities across different parts of an application, including projects, namespaces, schemas, tables, and individual record IDs.

## Format

An HID is a slash-separated (`/`) string with the following possible structures:

1.  **Short Form (Schema, Table, ID):**
    `schema/table/id`
    *Example:* `public/users/123e4567-e89b-12d3-a456-426614174000`

2.  **Project Context (Project, Schema, Table, ID):**
    `project/schema/table/id`
    *Example:* `my-app/public/posts/abcdef012345`

3.  **Full Form (Namespace, Project, Schema, Table, ID):**
    `namespace/project/schema/table/id`
    *Example:* `company-x/my-app/public/invoices/inv_789xyz`

### Components:

*   **`namespace`**: (Optional) A top-level organizational unit. Often represents a company, organization, or a major product line. Defaults to `hasyx` or the value of the `NEXT_PUBLIC_HID_NAMESPACE` environment variable if set.
*   **`project`**: (Optional) Identifies a specific project or application within a namespace. Defaults to the current project's name (derived from `package.json` usually).
*   **`schema`**: (Required) The database schema name (e.g., `public`, `payments`, `custom_schema`).
*   **`table`**: (Required) The database table name (e.g., `users`, `products`).
*   **`id`**: (Required) The unique identifier of the record within the table (e.g., a UUID, an integer ID, a string ID like `prod_abc123`).

### Segment Rules:

*   Each segment (namespace, project, schema, table, id) must be a non-empty string.
*   Segments must not contain the slash character (`/`) itself.
*   Segments should not have leading or trailing whitespace (they are effectively trimmed).

## `lib/hid.ts` Utility

Hasyx provides a utility module `lib/hid.ts` for working with HIDs. It exports a factory function `Hid()` that returns an instance Methoden zum Parsen und Generieren von HIDs.

### Initialization

```typescript
import { Hid } from 'hasyx/lib/hid'; // Or your project's alias

// Initialize with current project name and optional default namespace
// const pckgName = require('../package.json').name; // Or get project name appropriately
const hidInstance = Hid('my-current-project', 'my-organization');

// If defaultNamespace is omitted, it uses process.env.NEXT_PUBLIC_HID_NAMESPACE or 'hasyx' as fallback.
const anotherHidInstance = Hid('another-project'); 
```

**`Hid(projectName: string, defaultNamespace?: string): HidInstance`**

*   `projectName`: The name of the current project. Used as the default project when generating full HIDs if no project is explicitly provided.
*   `defaultNamespace` (Optional): The default namespace for this instance. If not provided, it falls back to `process.env.NEXT_PUBLIC_HID_NAMESPACE`, and then to `'hasyx'`.

### `HidInstance` Methods

An `HidInstance` object contains the following methods:

#### 1. `fromHid(hidString: string, full?: boolean): HidParts | FullHidParts | null`

Parses an HID string into its constituent parts.

*   **Overloads:**
    *   `fromHid(hid: string, full: true): FullHidParts | null;`
    *   `fromHid(hid: string, full?: false): HidParts | null;`
    *   `fromHid(hid: string): HidParts | null;` (defaults to `full = false` logic)
*   **Parameters:**
    *   `hidString`: The HID string to parse.
    *   `full` (Optional `boolean`): 
        *   If `true`, expects a 5-part HID (`namespace/project/schema/table/id`) and returns `FullHidParts`.
        *   If `false` or omitted, it attempts to parse 3, 4, or 5-part HIDs and returns `HidParts` (which might include namespace and project if they were present).
*   **Returns:** An object containing the parsed parts (`HidParts` or `FullHidParts`) or `null` if the string is not a valid HID or doesn't match the expected structure based on the `full` flag.

    ```typescript
    interface HidParts {
      namespace?: string;
      project?: string;
      schema: string;
      table: string;
      id: string;
    }

    interface FullHidParts extends HidParts {
      namespace: string; // Guaranteed to be present
      project: string;   // Guaranteed to be present
    }
    ```

*   **Example:**
    ```typescript
    const parts1 = hidInstance.fromHid('my-org/my-proj/public/users/123', true);
    // { namespace: 'my-org', project: 'my-proj', schema: 'public', table: 'users', id: '123' }

    const parts2 = hidInstance.fromHid('public/posts/abc');
    // { schema: 'public', table: 'posts', id: 'abc' }

    const parts3 = hidInstance.fromHid('other-proj/data/items/xyz');
    // { project: 'other-proj', schema: 'data', table: 'items', id: 'xyz' }
    ```

#### 2. `toHid(...args): string`

Generates an HID string from its components.

*   **Overloads:**
    *   `toHid(options: ToHidOptions, full?: boolean): string;`
    *   `toHid(schema: string, table: string, id: string, full?: boolean): string;`
    *   `toHid(project: string, schema: string, table: string, id: string, full?: boolean): string;`
    *   `toHid(namespace: string, project: string, schema: string, table: string, id: string, full?: boolean): string;`
*   **Parameters:**
    *   Can be an `options` object: `ToHidOptions { schema, table, id, project?, namespace? }`
    *   Or a sequence of string arguments: `(schema, table, id)`, `(project, schema, table, id)`, or `(namespace, project, schema, table, id)`.
    *   An optional final boolean argument `full` (defaults to `false`).
*   **Behavior:**
    *   If `full` is `true`: Always generates a 5-part HID (`namespace/project/schema/table/id`).
        *   If `namespace` is not provided in the input, `instanceDefaultNamespace` (from `Hid` initialization) is used.
        *   If `project` is not provided in the input, `instanceProject` (from `Hid` initialization) is used.
    *   If `full` is `false` (or omitted): Generates the shortest possible valid HID.
        *   If `inputNamespace` is provided and is different from `instanceDefaultNamespace`, it's included.
        *   If `inputProject` is provided and is different from `instanceProject`, it's included.
        *   If a custom `inputNamespace` (different from `instanceDefaultNamespace`) is included, then the `project` part (either `inputProject` or `instanceProject`) will also be included to maintain structure, even if `inputProject` matches `instanceProject` or was undefined.
        *   If both `inputNamespace` and `inputProject` match their respective instance defaults (or are undefined), they are omitted, resulting in `schema/table/id`.
*   **Returns:** The generated HID string.
*   **Throws:** An error if required parts (schema, table, id) are missing or if any segment is invalid.

*   **Example:**
    ```typescript
    // Assuming hidInstance = Hid('my-project', 'my-namespace');

    hidInstance.toHid('public', 'users', '123'); 
    // => "public/users/123"

    hidInstance.toHid('public', 'users', '123', true); 
    // => "my-namespace/my-project/public/users/123"

    hidInstance.toHid({ schema: 'data', table: 'items', id: 'xyz', project: 'other-project' });
    // => "other-project/data/items/xyz"

    hidInstance.toHid({ schema: 'data', table: 'items', id: 'xyz', project: 'other-project' }, true);
    // => "my-namespace/other-project/data/items/xyz"

    hidInstance.toHid({ schema: 'data', table: 'items', id: 'xyz', namespace: 'another-ns', project: 'my-project' });
    // => "another-ns/my-project/data/items/xyz"

    hidInstance.toHid({ schema: 'data', table: 'items', id: 'xyz', namespace: 'my-namespace', project: 'my-project' });
    // => "data/items/xyz" (defaults omitted)
    ```

## Environment Variable: `NEXT_PUBLIC_HID_NAMESPACE`

If the `defaultNamespace` argument is not provided to the `Hid()` factory function, the system will look for the `NEXT_PUBLIC_HID_NAMESPACE` environment variable. If found, its value will be used as the default namespace. This allows for a project-wide default namespace configuration.
If neither `defaultNamespace` argument nor the environment variable is set, `'hasyx'` will be used as the ultimate fallback default namespace.

## Use Cases

*   Uniquely identifying database records in logs, events, or API responses.
*   Creating stable and predictable identifiers for resources that can be parsed programmatically.
*   Linking resources across different microservices or modules if they share the same HID generation/parsing logic and default namespace/project context.
*   As the `subject_hid` in payment transactions or subscriptions to link them to a specific billable item. 