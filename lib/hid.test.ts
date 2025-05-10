import { Hid } from './hid'; // Assuming Hid is exported from hid.ts

describe('Hid Library', () => {
  const defaultProjectName = 'test-project';
  const defaultNamespaceName = 'test-namespace';

  // Mock pckg.name for tests if Hid relies on it directly, 
  // or ensure Hid function takes project name as argument.
  // For this test, we assume Hid takes project name as an argument.

  describe('Hid Function Initialization', () => {
    it('should initialize with project name and default namespace', () => {
      const hidInstance = Hid(defaultProjectName);
      // Check if the instance is created, specific internal checks might be needed if possible
      expect(hidInstance).toBeDefined();
      expect(hidInstance.toHid).toBeInstanceOf(Function);
      expect(hidInstance.fromHid).toBeInstanceOf(Function);
    });

    it('should initialize with project name and custom default namespace', () => {
      const hidInstance = Hid(defaultProjectName, 'custom-ns');
      expect(hidInstance).toBeDefined();
    });

    it('should use NEXT_PUBLIC_HID_NAMESPACE if provided and no custom default namespace', () => {
      process.env.NEXT_PUBLIC_HID_NAMESPACE = 'env-namespace';
      const hidInstance = Hid(defaultProjectName);
      // This test relies on how NEXT_PUBLIC_HID_NAMESPACE is used internally for default namespace
      // For example, by checking a generated full ID:
      expect(hidInstance.toHid({schema: 's', table: 't', id: 'i'}, true)).toBe('env-namespace/test-project/s/t/i');
      delete process.env.NEXT_PUBLIC_HID_NAMESPACE; // Clean up env var
    });

    it("should use 'hasyx' as ultimate fallback namespace if no defaultNamespace and no ENV var", () => {
        delete process.env.NEXT_PUBLIC_HID_NAMESPACE;
        // Test with only project name, relying on fallback for namespace
        const hidInstance = Hid(defaultProjectName);
        expect(hidInstance.toHid({schema: 's', table: 't', id: 'i'}, true)).toBe('hasyx/test-project/s/t/i');
      });

    it('should throw error for invalid project name', () => {
      expect(() => Hid('invalid/project')).toThrow('Project name cannot contain "/"');
      expect(() => Hid('')).toThrow('Empty project name is not allowed');
    });

    it('should throw error for invalid default namespace', () => {
      expect(() => Hid(defaultProjectName, 'invalid/ns')).toThrow('Default namespace cannot contain "/"');
      expect(() => Hid(defaultProjectName, '')).toThrow('Empty default namespace is not allowed');
    });
  });

  describe('toHid Method', () => {
    const hid = Hid(defaultProjectName, defaultNamespaceName);

    it('should create HID with schema, table, id (short form)', () => {
      expect(hid.toHid('public', 'users', '123')).toBe('public/users/123');
    });

    it('should create HID with schema, table, id (object form)', () => {
      expect(hid.toHid({ schema: 'public', table: 'users', id: '123' })).toBe('public/users/123');
    });

    it('should create full HID with schema, table, id when full=true (short form)', () => {
      expect(hid.toHid('public', 'users', '123', true)).toBe('test-namespace/test-project/public/users/123');
    });

    it('should create full HID with schema, table, id when full=true (object form)', () => {
      expect(hid.toHid({ schema: 'public', table: 'users', id: '123' }, true)).toBe('test-namespace/test-project/public/users/123');
    });

    it('should create HID with project, schema, table, id (short form, custom project)', () => {
      expect(hid.toHid('custom-project', 'public', 'users', '123')).toBe('custom-project/public/users/123');
    });

    it('should create HID with project, schema, table, id (object form, custom project)', () => {
      expect(hid.toHid({ project: 'custom-project', schema: 'public', table: 'users', id: '123' })).toBe('custom-project/public/users/123');
    });

    it('should create full HID with project, schema, table, id when full=true (short form, custom project)', () => {
      expect(hid.toHid('custom-project', 'public', 'users', '123', true)).toBe('test-namespace/custom-project/public/users/123');
    });

    it('should create full HID with project, schema, table, id when full=true (object form, custom project)', () => {
      expect(hid.toHid({ project: 'custom-project', schema: 'public', table: 'users', id: '123' }, true)).toBe('test-namespace/custom-project/public/users/123');
    });

    it('should create HID with namespace, project, schema, table, id (short form, custom ns/project)', () => {
      expect(hid.toHid('custom-ns', 'custom-project', 'public', 'users', '123')).toBe('custom-ns/custom-project/public/users/123');
    });

    it('should create HID with namespace, project, schema, table, id (object form, custom ns/project)', () => {
      expect(hid.toHid({ namespace: 'custom-ns', project: 'custom-project', schema: 'public', table: 'users', id: '123' })).toBe('custom-ns/custom-project/public/users/123');
    });

    it('should create full HID with namespace, project, schema, table, id when full=true (short form) - already full', () => {
      expect(hid.toHid('custom-ns', 'custom-project', 'public', 'users', '123', true)).toBe('custom-ns/custom-project/public/users/123');
    });

    it('should create full HID with namespace, project, schema, table, id when full=true (object form) - already full', () => {
      expect(hid.toHid({ namespace: 'custom-ns', project: 'custom-project', schema: 'public', table: 'users', id: '123' }, true)).toBe('custom-ns/custom-project/public/users/123');
    });

    it('should use default namespace and project if only schema, table, id are provided and full=true', () => {
      const hidOnlyProject = Hid(defaultProjectName); // Will use 'hasyx' or env var for namespace
      delete process.env.NEXT_PUBLIC_HID_NAMESPACE;
      expect(hidOnlyProject.toHid({ schema: 's', table: 't', id: 'i' }, true)).toBe('hasyx/test-project/s/t/i');
    });

    it('should use default namespace if project, schema, table, id are provided and full=true', () => {
        const hidOnlyProject = Hid(defaultProjectName); // Will use 'hasyx' or env var for namespace
        delete process.env.NEXT_PUBLIC_HID_NAMESPACE;
        expect(hidOnlyProject.toHid({ project: 'proj',schema: 's', table: 't', id: 'i' }, true)).toBe('hasyx/proj/s/t/i');
      });

    it('should throw error for missing schema, table, or id in object', () => {
      expect(() => hid.toHid({ table: 'users', id: '123' } as any, false)).toThrow('Schema, table, and id must be valid non-empty strings without "/".'); 
    });

    it('should throw error for missing schema, table, or id in short form', () => {
        expect(() => hid.toHid('public', undefined as any, '123')).toThrow('Schema, table, and id must be valid non-empty strings without "/".');
      });

    it('should throw error for invalid segment characters', () => {
      expect(() => hid.toHid('public/schema', 'users', '123')).toThrow('Schema, table, and id must be valid non-empty strings without "/".');
      expect(() => hid.toHid({ schema: 'public', table: 'users', id: '123/456' })).toThrow('Schema, table, and id must be valid non-empty strings without "/".');
    });

    it('should create HID correctly when input project is default but namespace is custom (full=false)', () => {
      expect(hid.toHid({ namespace: 'custom-ns', project: defaultProjectName, schema: 's', table: 't', id: 'id1'}, false)).toBe('custom-ns/test-project/s/t/id1');
    });

    it('should create HID correctly when input namespace is default but project is custom (full=false)', () => {
      expect(hid.toHid({ namespace: defaultNamespaceName, project: 'custom-proj', schema: 's', table: 't', id: 'id2'}, false)).toBe('custom-proj/s/t/id2');
    });

    it('should omit default namespace and project when both match instance defaults (full=false)', () => {
      expect(hid.toHid({ namespace: defaultNamespaceName, project: defaultProjectName, schema: 's', table: 't', id: 'id3'}, false)).toBe('s/t/id3');
    });

    it('should create full HID using instance defaults if only schema, table, id are provided and full=true', () => {
      const localHid = Hid(defaultProjectName, defaultNamespaceName);
      expect(localHid.toHid({ schema: 's', table: 't', id: 'i' }, true)).toBe('test-namespace/test-project/s/t/i');
    });

    it('should use instance default namespace if project is custom, and full=true', () => {
        const localHid = Hid(defaultProjectName, defaultNamespaceName); 
        expect(localHid.toHid({ project: 'custom-proj',schema: 's', table: 't', id: 'i' }, true)).toBe('test-namespace/custom-proj/s/t/i');
      });
  });

  describe('fromHid Method', () => {
    const hid = Hid(defaultProjectName, defaultNamespaceName);

    it('should parse full HID when full=true', () => {
      expect(hid.fromHid('ns/proj/sch/tbl/id1', true)).toEqual({ namespace: 'ns', project: 'proj', schema: 'sch', table: 'tbl', id: 'id1' });
    });

    it('should return null for incorrect part count when full=true', () => {
      expect(hid.fromHid('sch/tbl/id1', true)).toBeNull();
      expect(hid.fromHid('proj/sch/tbl/id1', true)).toBeNull();
      expect(hid.fromHid('ns/proj/sch/tbl/id1/extra', true)).toBeNull();
    });

    it('should parse schema/table/id (default full=false or omitted)', () => {
      expect(hid.fromHid('public/users/1')).toEqual({ schema: 'public', table: 'users', id: '1' });
      expect(hid.fromHid('public/users/1', false)).toEqual({ schema: 'public', table: 'users', id: '1' });
    });

    it('should parse project/schema/table/id (default full=false or omitted)', () => {
      expect(hid.fromHid('proj/public/users/2')).toEqual({ project: 'proj', schema: 'public', table: 'users', id: '2' });
      expect(hid.fromHid('proj/public/users/2', false)).toEqual({ project: 'proj', schema: 'public', table: 'users', id: '2' });
    });

    it('should parse namespace/project/schema/table/id (default full=false or omitted)', () => {
      expect(hid.fromHid('ns/proj/public/users/3')).toEqual({ namespace: 'ns', project: 'proj', schema: 'public', table: 'users', id: '3' });
      expect(hid.fromHid('ns/proj/public/users/3', false)).toEqual({ namespace: 'ns', project: 'proj', schema: 'public', table: 'users', id: '3' });
    });

    it('should return null for invalid HIDs (wrong number of parts for non-full parse)', () => {
      expect(hid.fromHid('a/b')).toBeNull();
      expect(hid.fromHid('a/b/c/d/e/f')).toBeNull();
    });

    it('should return null for empty string or null input', () => {
        expect(hid.fromHid('')).toBeNull();
        expect(hid.fromHid(null as any)).toBeNull(); 
    });
    
    it('should return null if any segment contains invalid characters or is empty', () => {
      expect(hid.fromHid('a//b/c')).toBeNull(); 
      expect(hid.fromHid('a /b/c/d', false)).toBeNull(); 
      expect(hid.fromHid('ns/proj/public/users/in/valid')).toBeNull(); 
      expect(hid.fromHid('ns/proj/public/in/valid/id', false)).toBeNull(); 
      expect(hid.fromHid('valid/seg1/seg2/seg3/inva/lid', true)).toBeNull(); // id invalid
    });

    it('should correctly parse a valid 5-part HID when full=true', () => {
        expect(hid.fromHid('myNamespace/myProject/mySchema/myTable/myId123', true))
          .toEqual({ namespace: 'myNamespace', project: 'myProject', schema: 'mySchema', table: 'myTable', id: 'myId123' });
      });
  });
}); 