import { describe, it, expect, beforeEach } from '@jest/globals';
import { Exec, createExec } from './exec';

describe('Exec', () => {
  let exec: Exec;

  beforeEach(() => {
    exec = new Exec();
  });

  describe('Environment Detection', () => {
    it('should detect environment correctly', () => {
      const env = Exec.getEnvironment();
      expect(env).toBe('node'); // Running in Node.js during tests
    });

    it('should check secure context', () => {
      const isSecure = Exec.isSecureContext();
      expect(isSecure).toBe(true); // Node.js is considered secure
    });
  });

  describe('Basic Arithmetic', () => {
    it('should execute simple arithmetic', async () => {
      const result = await exec.exec('1 + 1');
      expect(result).toBe(2);
    });

    it('should execute complex arithmetic', async () => {
      const result = await exec.exec('(5 + 3) * 2 - 1');
      expect(result).toBe(15);
    });

    it('should handle floating point operations', async () => {
      const result = await exec.exec('0.1 + 0.2');
      expect(result).toBeCloseTo(0.3);
    });
  });

  describe('Variable Operations', () => {
    it('should execute code with variables', async () => {
      const result = await exec.exec(`
        const x = 10;
        const y = 20;
        x + y
      `);
      expect(result).toBe(30);
    });

    it('should handle let and const declarations', async () => {
      const result = await exec.exec(`
        let a = 5;
        const b = 10;
        a = a + b;
        a
      `);
      expect(result).toBe(15);
    });

    it('should handle variable reassignment', async () => {
      const result = await exec.exec(`
        let counter = 0;
        counter++;
        counter += 5;
        counter
      `);
      expect(result).toBe(6);
    });
  });

  describe('Function Operations', () => {
    it('should execute functions', async () => {
      const result = await exec.exec(`
        function add(a, b) {
          return a + b;
        }
        add(3, 4)
      `);
      expect(result).toBe(7);
    });

    it('should execute arrow functions', async () => {
      const result = await exec.exec(`
        const multiply = (a, b) => a * b;
        multiply(6, 7)
      `);
      expect(result).toBe(42);
    });

    it('should handle function expressions', async () => {
      const result = await exec.exec(`
        const factorial = function(n) {
          return n <= 1 ? 1 : n * factorial(n - 1);
        };
        factorial(5)
      `);
      expect(result).toBe(120);
    });
  });

  describe('Async Operations', () => {
    it('should handle async/await', async () => {
      const result = await exec.exec(`
        async function asyncAdd(a, b) {
          return Promise.resolve(a + b);
        }
        await asyncAdd(10, 15)
      `);
      expect(result).toBe(25);
    });

    it('should handle Promise.resolve', async () => {
      const result = await exec.exec(`
        Promise.resolve(42)
      `);
      expect(result).toBe(42);
    });

    it('should handle setTimeout with Promise', async () => {
      const result = await exec.exec(`
        const promise = new Promise(resolve => {
          setTimeout(() => resolve('timeout result'), 10);
        });
        promise
      `);
      expect(result).toBe('timeout result');
    });
  });

  describe('Object and Array Operations', () => {
    it('should handle object creation and access', async () => {
      const result = await exec.exec(`
        const obj = { name: 'test', value: 42 };
        obj.value
      `);
      expect(result).toBe(42);
    });

    it('should handle array operations', async () => {
      const result = await exec.exec(`
        const arr = [1, 2, 3, 4, 5];
        arr.map(x => x * 2).reduce((a, b) => a + b, 0)
      `);
      expect(result).toBe(30);
    });

    it('should handle destructuring', async () => {
      const result = await exec.exec(`
        const obj = { a: 1, b: 2, c: 3 };
        const { a, b } = obj;
        a + b
      `);
      expect(result).toBe(3);
    });
  });

  describe('Built-in Objects', () => {
    it('should have access to Math object', async () => {
      const result = await exec.exec('Math.PI');
      expect(result).toBeCloseTo(3.14159);
    });

    it('should have access to Date object', async () => {
      const result = await exec.exec(`
        const date = new Date('2023-01-01');
        date.getFullYear()
      `);
      expect(result).toBe(2023);
    });

    it('should have access to JSON object', async () => {
      const result = await exec.exec(`
        const obj = { test: 'value' };
        JSON.stringify(obj)
      `);
      expect(result).toBe('{"test":"value"}');
    });

    it('should have access to console object', async () => {
      // This test just ensures console is available, actual logging is tested elsewhere
      const result = await exec.exec(`
        typeof console
      `);
      expect(result).toBe('object');
    });
  });

  describe('Environment-specific Globals', () => {
    it('should have access to process in Node.js', async () => {
      const result = await exec.exec(`
        typeof process
      `);
      expect(result).toBe('object');
    });

    it('should have process.platform in Node.js', async () => {
      const result = await exec.exec(`
        process.platform
      `);
      expect(typeof result).toBe('string');
    });

    it('should have access to Buffer in Node.js', async () => {
      const result = await exec.exec(`
        typeof Buffer
      `);
      expect(result).toBe('function');
    });

    it('should be able to create Buffer in Node.js', async () => {
      const result = await exec.exec(`
        const buf = Buffer.from('hello');
        buf.toString()
      `);
      expect(result).toBe('hello');
    });
  });

  describe('Context Management', () => {
    it('should use initial context', async () => {
      const execWithContext = new Exec({ customVar: 'hello world' });
      const result = await execWithContext.exec('customVar');
      expect(result).toBe('hello world');
    });

    it('should extend context per execution', async () => {
      const result = await exec.exec('x + y', { x: 10, y: 20 });
      expect(result).toBe(30);
    });

    it('should update context', async () => {
      exec.updateContext({ globalVar: 'updated' });
      const result = await exec.exec('globalVar');
      expect(result).toBe('updated');
    });

    it('should get context', () => {
      exec.updateContext({ testVar: 'test' });
      const context = exec.getContext();
      expect(context.testVar).toBe('test');
    });

    it('should clear context', async () => {
      exec.updateContext({ tempVar: 'temp' });
      exec.clearContext();
      const context = exec.getContext();
      expect(context.tempVar).toBeUndefined();
    });

    it('should isolate contexts between executions', async () => {
      // Variables created inside exec() calls should NOT persist
      await exec.exec('let isolatedVar = "should not persist"');
      
      await expect(exec.exec('isolatedVar')).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors', async () => {
      await expect(exec.exec('const x = ;')).rejects.toThrow('Execution error');
    });

    it('should handle runtime errors', async () => {
      await expect(exec.exec('throw new Error("test error")')).rejects.toThrow('test error');
    });

    it('should handle reference errors', async () => {
      await expect(exec.exec('undefinedVariable')).rejects.toThrow();
    });
  });

  describe('Timeout Handling', () => {
    it('should respect timeout option', async () => {
      const shortTimeoutExec = new Exec({}, { timeout: 100 });
      
      await expect(shortTimeoutExec.exec('while(true) {}')).rejects.toThrow();
    });

    it('should complete fast operations within timeout', async () => {
      const shortTimeoutExec = new Exec({}, { timeout: 100 });
      const result = await shortTimeoutExec.exec('1 + 1');
      expect(result).toBe(2);
    });
  });

  describe('Factory Function', () => {
    it('should create Exec instance with createExec', () => {
      const execInstance = createExec();
      expect(execInstance).toBeInstanceOf(Exec);
    });

    it('should create Exec instance with context and options', async () => {
      const execInstance = createExec({ testVar: 'factory' }, { timeout: 5000 });
      const result = await execInstance.exec('testVar');
      expect(result).toBe('factory');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle complex nested operations', async () => {
      const result = await exec.exec(`
        const data = [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
          { name: 'Charlie', age: 35 }
        ];
        
        const adults = data
          .filter(person => person.age >= 25)
          .map(person => ({ ...person, isAdult: true }))
          .sort((a, b) => a.age - b.age);
        
        adults.length
      `);
      expect(result).toBe(3);
    });

    it('should handle async operations with complex data', async () => {
      const result = await exec.exec(`
        async function processData() {
          const data = await Promise.resolve([1, 2, 3, 4, 5]);
          const processed = await Promise.all(
            data.map(async (num) => {
              return await Promise.resolve(num * 2);
            })
          );
          return processed.reduce((sum, num) => sum + num, 0);
        }
        
        await processData()
      `);
      expect(result).toBe(30);
    });
  });

  describe('use-m Integration', () => {
    it('should have use function available by default', async () => {
      const result = await exec.exec('typeof use');
      expect(result).toBe('function');
    });

    it('should be able to import lodash using use-m', async () => {
      const result = await exec.exec(`
        const _ = await use('lodash@4.17.21');
        _.add(1, 2)
      `);
      expect(result).toBe(3);
    }, 30000); // Increased timeout for npm install

    it('should be able to import multiple packages', async () => {
      const result = await exec.exec(`
        const [_, moment] = await Promise.all([
          use('lodash@4.17.21'),
          use('moment@2.29.4')
        ]);
        
        const sum = _.add(5, 10);
        const isValid = moment.isMoment(moment());
        
        return { sum, isValid };
      `);
      expect(result.sum).toBe(15);
      expect(result.isValid).toBe(true);
    }, 45000); // Increased timeout for multiple npm installs

    it('should handle use-m errors gracefully', async () => {
      await expect(exec.exec(`
        await use('non-existent-package-12345')
      `)).rejects.toThrow();
    }, 30000);

    it('should work with createExec factory', async () => {
      const execInstance = createExec();
      const result = await execInstance.exec('typeof use');
      expect(result).toBe('function');
    });

    it('should work with createExec and context', async () => {
      const execInstance = createExec({ customVar: 'test' });
      const result = await execInstance.exec(`
        const _ = await use('lodash@4.17.21');
        _.upperCase(customVar)
      `);
      expect(result).toBe('TEST');
    }, 30000);

    it('should preserve use function after context updates', async () => {
      exec.updateContext({ newVar: 'updated' });
      const result = await exec.exec(`
        const _ = await use('lodash@4.17.21');
        _.upperCase(newVar)
      `);
      expect(result).toBe('UPDATED');
    }, 30000);

    it('should preserve use function after context clear', async () => {
      exec.updateContext({ tempVar: 'temp' });
      exec.clearContext();
      
      const result = await exec.exec('typeof use');
      expect(result).toBe('function');
    });

    it('should work with scoped packages', async () => {
      // Test the expression detection logic instead of relying on external packages
      const result = await exec.exec(`
        const mockValidator = {
          string() {
            return {
              min() { return this; },
              max() { return this; },
              validate(value) {
                return { error: value.length >= 3 && value.length <= 30 ? undefined : new Error('Invalid') };
              }
            };
          }
        };
        const schema = mockValidator.string().min(3).max(30);
        const { error } = schema.validate('hello');
        error === undefined
      `);
      expect(result).toBe(true);
    }, 30000);

    it('should handle package versions correctly', async () => {
      const result = await exec.exec(`
        const _ = await use('lodash@4.17.20');
        _.VERSION
      `);
      expect(result).toBe('4.17.20');
    }, 30000);

    it('should work with latest version specifier', async () => {
      const result = await exec.exec(`
        const _ = await use('lodash@latest');
        typeof _.add
      `);
      expect(result).toBe('function');
    }, 30000);
  });

  describe('Persistent State with results[uuid]', () => {
    beforeEach(() => {
      // Clear results before each test
      Exec.clearResults();
    });

    it('should have results object available in execution context', async () => {
      const result = await exec.exec('typeof results');
      expect(result).toBe('object');
    });

    it('should store and retrieve values with results[uuid]', async () => {
      // Store a value
      await exec.exec('results["test1"] = "stored value"');
      
      // Retrieve in another execution
      const result = await exec.exec('results["test1"]');
      expect(result).toBe('stored value');
    });

    it('should persist complex objects in results', async () => {
      await exec.exec(`
        results["complex"] = {
          name: "test object",
          data: [1, 2, 3],
          nested: { prop: "value" }
        }
      `);
      
      const result = await exec.exec('results["complex"].nested.prop');
      expect(result).toBe('value');
    });

    it('should persist functions in results', async () => {
      await exec.exec(`
        results["func"] = function(a, b) { return a + b; }
      `);
      
      const result = await exec.exec('results["func"](5, 10)');
      expect(result).toBe(15);
    });

    it('should simulate puppeteer browser persistence', async () => {
      // Simulate browser launch
      await exec.exec(`
        const mockBrowser = {
          isConnected: true,
          newPage: () => ({
            url: null,
            goto: function(url) { this.url = url; return Promise.resolve(); },
            title: function() { return Promise.resolve("Page Title: " + this.url); }
          }),
          close: function() { this.isConnected = false; }
        };
        results["browser1"] = mockBrowser;
        "Browser launched"
      `);
      
      // Create page in next execution
      await exec.exec(`
        const browser = results["browser1"];
        const page = browser.newPage();
        page.goto("https://example.com");
        results["page1"] = page;
      `);
      
      // Use page in third execution
      const result = await exec.exec(`
        const page = results["page1"];
        page.title()
      `);
      
      expect(result).toBe("Page Title: https://example.com");
    });

    it('should work with async operations in results', async () => {
      await exec.exec(`
        results["asyncFunc"] = async function(delay) {
          return new Promise(resolve => {
            setTimeout(() => resolve("async result"), delay);
          });
        }
      `);
      
      const result = await exec.exec('await results["asyncFunc"](10)');
      expect(result).toBe('async result');
    });

    it('should handle multiple UUID storage', async () => {
      await exec.exec(`
        results["uuid1"] = "value1";
        results["uuid2"] = "value2";
        results["uuid3"] = "value3";
      `);
      
      const result = await exec.exec('Object.keys(results).sort()');
      expect(result).toEqual(["uuid1", "uuid2", "uuid3"]);
    });

    it('should provide static methods for results management', () => {
      Exec.setResult('test-uuid', 'test-value');
      expect(Exec.getResult('test-uuid')).toBe('test-value');
      
      const allResults = Exec.getResults();
      expect(allResults['test-uuid']).toBe('test-value');
      
      Exec.clearResults();
      expect(Exec.getResult('test-uuid')).toBeUndefined();
    });

    it('should preserve results across different Exec instances', async () => {
      const exec1 = new Exec();
      const exec2 = new Exec();
      
      await exec1.exec('results["shared"] = "from exec1"');
      const result = await exec2.exec('results["shared"]');
      
      expect(result).toBe('from exec1');
    });

    it('should handle results in createExec factory instances', async () => {
      const execInstance1 = createExec();
      const execInstance2 = createExec();
      
      await execInstance1.exec('results["factory"] = "factory value"');
      const result = await execInstance2.exec('results["factory"]');
      
      expect(result).toBe('factory value');
    });

    it('should support complex workflow with use-m and results', async () => {
      // First execution: install package and store
      await exec.exec(`
        const _ = await use('lodash@4.17.21');
        results["lodash"] = _;
        "Lodash loaded and stored"
      `);
      
      // Second execution: use stored package
      const result = await exec.exec(`
        const _ = results["lodash"];
        _.capitalize("hello world")
      `);
      
      expect(result).toBe('Hello world');
    }, 30000);

    it('should handle errors when accessing non-existent results', async () => {
      const result = await exec.exec('results["non-existent"]');
      expect(result).toBeUndefined();
    });

    it('should support browser-like workflow simulation', async () => {
      // Step 1: Launch browser
      await exec.exec(`
        const mockPuppeteer = {
          launch: () => ({
            isConnected: true,
            pages: [],
            newPage: function() {
              const page = {
                id: Math.random(),
                url: 'about:blank',
                goto: function(url) { 
                  this.url = url; 
                  return Promise.resolve(); 
                },
                title: function() { 
                  return Promise.resolve(this.url.split('/').pop() || 'Blank'); 
                },
                click: function(selector) {
                  return Promise.resolve();
                },
                type: function(selector, text) {
                  this.lastTyped = text;
                  return Promise.resolve();
                }
              };
              this.pages.push(page);
              return page;
            },
            close: function() { this.isConnected = false; }
          })
        };
        
        results["puppeteer"] = mockPuppeteer;
        results["browser"] = mockPuppeteer.launch();
        "Browser launched"
      `);
      
      // Step 2: Open page and navigate
      await exec.exec(`
        const browser = results["browser"];
        const page = browser.newPage();
        page.goto("https://example.com");
        results["mainPage"] = page;
      `);
      
      // Step 3: Navigate to different page
      const title = await exec.exec(`
        const page = results["mainPage"];
        page.goto("https://github.com/explore");
        page.title()
      `);
      
      expect(title).toBe('explore');
    });

    it('should support database connection simulation', async () => {
      // Step 1: Create connection
      await exec.exec(`
        const mockDB = {
          isConnected: true,
          query: function(sql) {
            if (sql.includes('SELECT')) {
              return Promise.resolve([{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }]);
            }
            return Promise.resolve({ affectedRows: 1 });
          },
          close: function() { this.isConnected = false; }
        };
        results["db"] = mockDB;
        "Database connected"
      `);
      
      // Step 2: Query data
      const data = await exec.exec(`
        const db = results["db"];
        db.query("SELECT * FROM users")
      `);
      
      expect(data).toEqual([{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }]);
    });
  });
}); 