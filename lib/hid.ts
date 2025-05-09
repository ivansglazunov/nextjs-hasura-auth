import pckg from '../package.json';

const DEFAULT_NAMESPACE = 'hasyx';
const DEFAULT_PROJECT = pckg.name || 'unknown_project';
const SEPARATOR = '/';

export interface HidParts {
  namespace?: string;
  project?: string;
  schema: string;
  table: string;
  id: string;
}

export interface FullHidParts extends HidParts {
  namespace: string;
  project: string;
}

function isValidSegment(segment: string): boolean {
  return typeof segment === 'string' && segment.trim() === segment && segment.length > 0 && !segment.includes(SEPARATOR);
}

export interface HidInstance {
  toHid: (...args: any[]) => string;
  fromHid: (hid: string, full?: boolean) => HidParts | FullHidParts | null;
}

export function Hid(projectName: string, defaultNamespace?: string): HidInstance {
  // Обработка краевых случаев конструктора
  if (defaultNamespace === '') {
    throw new Error('Empty default namespace is not allowed');
  }

  if (projectName === '') {
    throw new Error('Empty project name is not allowed');
  }

  if (projectName.includes('/')) {
    throw new Error('Project name cannot contain "/"');
  }

  if (defaultNamespace && defaultNamespace.includes('/')) {
    throw new Error('Default namespace cannot contain "/"');
  }

  // Сохранение данных экземпляра
  const instanceProject = projectName;
  const instanceDefaultNamespace = defaultNamespace || process.env.NEXT_PUBLIC_HID_NAMESPACE || DEFAULT_NAMESPACE;
  
  // Определение fromHid
  function fromHid(hid: string, full: true): FullHidParts | null;
  function fromHid(hid: string, full?: false): HidParts | null;
  function fromHid(hid: string): HidParts | null;

  function fromHid(hid: string, full?: boolean): HidParts | FullHidParts | null {
    // Основная логика
    if (!hid || typeof hid !== 'string') {
      return null;
    }

    const parts = hid.split(SEPARATOR);

    if (full === true) {
      if (parts.length !== 5) return null;
      const [namespace, project, schema, table, id] = parts;
      if (!isValidSegment(namespace) || !isValidSegment(project) || !isValidSegment(schema) || !isValidSegment(table) || !isValidSegment(id)) return null;
      return { namespace, project, schema, table, id };
    }

    if (parts.length === 3) {
      const [schema, table, id] = parts;
      if (!isValidSegment(schema) || !isValidSegment(table) || !isValidSegment(id)) return null;
      return { schema, table, id };
    } else if (parts.length === 4) {
      const [project, schema, table, id] = parts;
      if (!isValidSegment(project) || !isValidSegment(schema) || !isValidSegment(table) || !isValidSegment(id)) return null;
      return { project, schema, table, id };
    } else if (parts.length === 5) {
      const [namespace, project, schema, table, id] = parts;
      if (!isValidSegment(namespace) || !isValidSegment(project) || !isValidSegment(schema) || !isValidSegment(table) || !isValidSegment(id)) return null;
      return { namespace, project, schema, table, id };
    }
    return null;
  }

  // Определение ToHidOptions
  interface ToHidOptions {
    schema: string;
    table: string;
    id: string;
    project?: string;
    namespace?: string;
  }

  // Определение toHid
  function toHid(options: ToHidOptions, full?: boolean): string;
  function toHid(schema: string, table: string, id: string, full?: boolean): string;
  function toHid(project: string, schema: string, table: string, id: string, full?: boolean): string;
  function toHid(namespace: string, project: string, schema: string, table: string, id: string, full?: boolean): string;

  function toHid(...args: any[]): string {
    // Основная логика
    let options: ToHidOptions;
    let generateFull = false;

    const lastArg = args[args.length - 1];
    let actualArgs = args;

    if (typeof lastArg === 'boolean') {
      generateFull = lastArg;
      actualArgs = args.slice(0, -1);
    }

    if (actualArgs.length === 1 && typeof actualArgs[0] === 'object') {
      options = actualArgs[0] as ToHidOptions;
    } else if (actualArgs.length === 3 && actualArgs.every(arg => typeof arg === 'string')) {
      options = { schema: actualArgs[0], table: actualArgs[1], id: actualArgs[2] };
    } else if (actualArgs.length === 4 && actualArgs.every(arg => typeof arg === 'string')) {
      options = { project: actualArgs[0], schema: actualArgs[1], table: actualArgs[2], id: actualArgs[3] };
    } else if (actualArgs.length === 5 && actualArgs.every(arg => typeof arg === 'string')) {
      options = { namespace: actualArgs[0], project: actualArgs[1], schema: actualArgs[2], table: actualArgs[3], id: actualArgs[4] };
    } else {
      throw new Error(
        'Invalid arguments for toHid. Expected (options, full?), (schema, table, id, full?), (project, schema, table, id, full?), or (namespace, project, schema, table, id, full?).'
      );
    }

    const { schema, table, id } = options;
    const inputProject = options.project;
    const inputNamespace = options.namespace;

    if (!isValidSegment(schema) || !isValidSegment(table) || !isValidSegment(id)) {
      throw new Error('Schema, table, and id must be valid non-empty strings without "/".');
    }
    if (inputProject !== undefined && !isValidSegment(inputProject)) {
      throw new Error('Project must be a valid non-empty string without "/".');
    }
    if (inputNamespace !== undefined && !isValidSegment(inputNamespace)) {
      throw new Error('Namespace must be a valid non-empty string without "/".');
    }

    const parts: string[] = [];

    if (generateFull) {
      // В полном режиме всегда добавляем namespace и project
      parts.push(inputNamespace || instanceDefaultNamespace);
      parts.push(inputProject || instanceProject);
    } else {
      // В сокращенном режиме применяем логику опускания дефолтных значений
      if (inputNamespace !== undefined && inputNamespace !== instanceDefaultNamespace) {
        parts.push(inputNamespace);
      }
      
      if (inputProject !== undefined && inputProject !== instanceProject) {
        parts.push(inputProject);
      }
    }

    parts.push(schema);
    parts.push(table);
    parts.push(id);

    return parts.join(SEPARATOR);
  }

  // Возвращаем интерфейс
  return { toHid, fromHid };
}

// Пример использования (не часть библиотечного кода, для иллюстрации)
/*
const specificHid = Hid('myCoolProject', 'myCompany');

const id1 = specificHid.toHid('public', 'users', '123'); 
// myCompany/myCoolProject/public/users/123 (if NEXT_PUBLIC_HID_NAMESPACE is not set or is 'myCompany')
// OR myCoolProject/public/users/123 (if NEXT_PUBLIC_HID_NAMESPACE is not 'myCompany' and defaultNamespace was not 'myCompany') - needs refinement

const id2 = specificHid.toHid('public', 'users', '123', true);
// myCompany/myCoolProject/public/users/123

const id3 = specificHid.toHid({schema: 'public', table: 'posts', id: 'xyz'});
// Similar logic as id1

const parsed1 = specificHid.fromHid(id1);
// { namespace: 'myCompany', project: 'myCoolProject', schema: 'public', table: 'users', id: '123' }

const parsed2 = specificHid.fromHid('public/items/456');
// { schema: 'public', table: 'items', id: '456' }

const genericHid = Hid('anotherProject'); // Uses process.env.NEXT_PUBLIC_HID_NAMESPACE or 'hasyx' for namespace

const id4 = genericHid.toHid('data', 'entries', '789', true);
// <DEFAULT_NAMESPACE_USED>/anotherProject/data/entries/789

*/

// Также экспортируем из lib/index.ts
// Необходимо будет добавить export const Hid = ... в lib/index.ts (или default export)
// и потом export * from './hid'; 
// и потом export * from './hid'; 