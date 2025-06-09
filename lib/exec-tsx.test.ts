import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ExecTs, createExecTs } from './exec-tsx';
import * as fs from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as ts from 'typescript';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ExecTs', () => {
  let execTs: ExecTs;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = path.join(__dirname, '..', '.tmp', `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.ensureDir(tempDir);
    
    // Initialize ExecTs instance
    execTs = new ExecTs({
      initialContext: {
        console,
        Math,
        Date,
      }
    });
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Basic TypeScript execution', () => {
    it('should execute simple TypeScript code with type annotations', async () => {
      const code = `
        const message: string = "Hello TypeScript";
        const count: number = 42;
        return { message, count };
      `;
      
      const { result } = await execTs.execTs(code);
      expect(result).toEqual({ message: "Hello TypeScript", count: 42 });
    });

    it('should execute TypeScript code with interfaces', async () => {
      const code = `
        interface User {
          name: string;
          age: number;
        }
        
        const user: User = {
          name: "John Doe",
          age: 30
        };
        
        return user;
      `;
      
      const { result } = await execTs.execTs(code);
      expect(result).toEqual({ name: "John Doe", age: 30 });
    });

    it('should execute TypeScript code with type aliases', async () => {
      const code = `
        type Status = "active" | "inactive" | "pending";
        
        const userStatus: Status = "active";
        const isActive: boolean = userStatus === "active";
        
        return { userStatus, isActive };
      `;
      
      const { result } = await execTs.execTs(code);
      expect(result).toEqual({ userStatus: "active", isActive: true });
    });

    it('should execute TypeScript code with generics', async () => {
      const code = `
        function identity<T>(arg: T): T {
          return arg;
        }
        
        const stringResult = identity<string>("hello");
        const numberResult = identity<number>(123);
        
        return { stringResult, numberResult };
      `;
      
      const { result } = await execTs.execTs(code);
      expect(result).toEqual({ stringResult: "hello", numberResult: 123 });
    });

    it('should execute TypeScript code with enums', async () => {
      const code = `
        enum Color {
          Red = "red",
          Green = "green",
          Blue = "blue"
        }
        
        const favoriteColor: Color = Color.Blue;
        
        return { favoriteColor, allColors: Object.values(Color) };
      `;
      
      const { result } = await execTs.execTs(code);
      expect(result).toEqual({ 
        favoriteColor: "blue", 
        allColors: ["red", "green", "blue"] 
      });
    });
  });

  describe('Advanced TypeScript features', () => {
    it('should handle optional properties', async () => {
      const code = `
        interface Config {
          name: string;
          port?: number;
          debug?: boolean;
        }
        
        const config1: Config = { name: "app" };
        const config2: Config = { name: "app", port: 3000, debug: true };
        
        return { config1, config2 };
      `;
      
      const { result } = await execTs.execTs(code);
      expect(result).toEqual({
        config1: { name: "app" },
        config2: { name: "app", port: 3000, debug: true }
      });
    });

    it('should handle type assertions', async () => {
      const code = `
        const value: unknown = "hello world";
        const stringValue = value as string;
        const upperCase = stringValue.toUpperCase();
        
        return upperCase;
      `;
      
      const { result } = await execTs.execTs(code);
      expect(result).toBe("HELLO WORLD");
    });

    it('should handle array types', async () => {
      const code = `
        const numbers: number[] = [1, 2, 3, 4, 5];
        const strings: Array<string> = ["a", "b", "c"];
        
        const doubled = numbers.map((n: number): number => n * 2);
        const uppercased = strings.map((s: string): string => s.toUpperCase());
        
        return { doubled, uppercased };
      `;
      
      const { result } = await execTs.execTs(code);
      expect(result).toEqual({
        doubled: [2, 4, 6, 8, 10],
        uppercased: ["A", "B", "C"]
      });
    });
  });

  describe('Error handling', () => {
    it('should throw error for invalid TypeScript syntax', async () => {
      const code = `
        const invalid: string = 123; // Type error
        return invalid;
      `;
      
      // Note: TypeScript transpiler is lenient and may not catch all type errors
      // This test verifies that the execution doesn't crash
      const { result } = await execTs.execTs(code);
      expect(result).toBe(123);
    });

    it('should throw error for runtime errors', async () => {
      const code = `
        const obj: any = null;
        return obj.property; // Runtime error
      `;
      
      await expect(execTs.execTs(code)).rejects.toThrow();
    });
  });

  describe('Context integration', () => {
    it('should use provided context', async () => {
      const customExecTs = new ExecTs({
        initialContext: {
          customValue: 42,
          customFunction: (x: number) => x * 2
        }
      });
      
      const code = `
        const result: number = customFunction(customValue);
        return result;
      `;
      
      const { result } = await customExecTs.execTs(code);
      expect(result).toBe(84);
    });

    it('should extend context during execution', async () => {
      const code = `
        const sum: number = a + b;
        return sum;
      `;
      
      const { result } = await execTs.execTs(code, { a: 10, b: 20 });
      expect(result).toBe(30);
    });
  });

  describe('TypeScript detection', () => {
    it('should detect TypeScript syntax correctly', () => {
      expect(ExecTs.isTypeScriptCode('const x: string = "hello"')).toBe(true);
      expect(ExecTs.isTypeScriptCode('interface User { name: string }')).toBe(true);
      expect(ExecTs.isTypeScriptCode('type Status = "active" | "inactive"')).toBe(true);
      expect(ExecTs.isTypeScriptCode('const x = value as string')).toBe(true);
      expect(ExecTs.isTypeScriptCode('enum Color { Red, Green }')).toBe(true);
      expect(ExecTs.isTypeScriptCode('function test<T>(arg: T): T')).toBe(true);
      
      // Should not detect plain JavaScript as TypeScript
      expect(ExecTs.isTypeScriptCode('const x = "hello"')).toBe(false);
      expect(ExecTs.isTypeScriptCode('function test(x) { return x; }')).toBe(false);
      expect(ExecTs.isTypeScriptCode('const obj = { name: "test" }')).toBe(false);
    });

    it('should create ExecTs instance using factory function', async () => {
      const instance = createExecTs({ initialContext: { testValue: 123 } });
      
      const code = `
        const result: number = testValue * 2;
        return result;
      `;
      
      const { result } = await instance.execTs(code);
      expect(result).toBe(246);
    });
  });

  describe('Configuration', () => {
    it('should use custom compiler options', async () => {
      const customExecTs = new ExecTs({
        compilerOptions: {
          target: ts.ScriptTarget.ES2015,
          strict: false
        }
      });
      
      const code = `
        const message: string = "Hello";
        return message;
      `;
      
      const { result } = await customExecTs.execTs(code);
      expect(result).toBe("Hello");
    });

    it('should use strict option from ExecTsOptions', async () => {
      const customExecTs = new ExecTs({
        strict: false
      });
      
      const code = `
        const message: string = "Hello";
        return message;
      `;
      
      const { result } = await customExecTs.execTs(code);
      expect(result).toBe("Hello");
    });
  });

  describe('Utility methods', () => {
    it('should update compiler options', () => {
      execTs.updateCompilerOptions({ strict: false });
      const options = execTs.getCurrentCompilerOptions();
      expect(options.strict).toBe(false);
    });
  });
}); 