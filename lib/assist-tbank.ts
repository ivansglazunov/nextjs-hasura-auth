import readline from 'readline';
import fs from 'fs-extra';
import path from 'path';
import Debug from './debug';
import { TBankPaymentProcessor } from './payments/tbank'; // Assuming path

const debug = Debug('assist:tbank');

// Helper functions (similar to those in assist.ts)
function createRlInterface() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

async function askYesNo(rl: readline.Interface, question: string, defaultValue: boolean = true): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const prompt = defaultValue ? `${question} [Y/n]: ` : `${question} [y/N]: `;
    debug(`Asking: ${question} (default: ${defaultValue ? 'Y' : 'N'})`);
    rl.question(prompt, (answer) => {
      const normalizedAnswer = answer.trim().toLowerCase();
      let result: boolean;
      if (normalizedAnswer === '') result = defaultValue;
      else if (['y', 'yes'].includes(normalizedAnswer)) result = true;
      else if (['n', 'no'].includes(normalizedAnswer)) result = false;
      else { console.log(`Invalid response. Using default: ${defaultValue ? 'Yes' : 'No'}`); result = defaultValue; }
      resolve(result);
    });
  });
}

async function askForInput(rl: readline.Interface, prompt: string, defaultValue: string = ''): Promise<string> {
  return new Promise<string>((resolve) => {
    const promptText = defaultValue ? `${prompt} [${defaultValue}]: ` : `${prompt}: `;
    debug(`Asking for input: ${prompt} (default: ${defaultValue})`);
    rl.question(promptText, (answer) => {
      const trimmedAnswer = answer.trim();
      resolve(trimmedAnswer === '' ? defaultValue : trimmedAnswer);
    });
  });
}

function parseEnvFile(envPath: string): Record<string, string> {
  const envVars: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return envVars;
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmedLine.substring(0, equalIndex).trim();
          let value = trimmedLine.substring(equalIndex + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
          }
          envVars[key] = value;
        }
      }
    });
  } catch (error) { debug('Error parsing .env file:', error); }
  return envVars;
}

function writeEnvFile(envPath: string, envVars: Record<string, string>): void {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8').split('\n').filter(line => line.trim().startsWith('#') || line.trim() === '').join('\n') + '\n\n' : '# Environment variables for hasyx project\n';
  const existingKeys = Object.keys(parseEnvFile(envPath));
  const newEntries = Object.entries(envVars)
    .filter(([key]) => !existingKeys.includes(key) || parseEnvFile(envPath)[key] !== envVars[key]) // only new or changed
    .map(([key, value]) => `${key}=${value.includes(' ') ? `"${value}"` : value}`)
    .join('\n');
  
  let finalContent = '';
  const currentContentLines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8').split('\n') : [];
  const updatedEnvVars = { ...parseEnvFile(envPath), ...envVars };

  currentContentLines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      finalContent += line + '\n';
      return;
    }
    const keyMatch = trimmedLine.match(/^([^=]+)=/);
    if (keyMatch && keyMatch[1]) {
      const key = keyMatch[1];
      if (updatedEnvVars.hasOwnProperty(key)) {
        finalContent += `${key}=${updatedEnvVars[key].includes(' ') ? `"${updatedEnvVars[key]}"` : updatedEnvVars[key]}\n`;
        delete updatedEnvVars[key]; // Mark as written
      } else {
        // Key was in file but not in updatedEnvVars (e.g. removed by user manually), so preserve it if not meant to be deleted
        // For this script, we only add/update, not delete implicitly.
        finalContent += line + '\n'; 
      }
    }
  });
  // Add any new keys that were not in the original file
  Object.entries(updatedEnvVars).forEach(([key, value]) => {
     if (envVars.hasOwnProperty(key)) { // Only add if it was part of the vars we intended to set now
        finalContent += `${key}=${value.includes(' ') ? `"${value}"` : value}\n`;
     }
  });

  fs.writeFileSync(envPath, finalContent.replace(/\n\n$/, '\n')); // Clean up trailing newlines
  debug(`Updated .env file at ${envPath}`);
}

async function configureTBank(rl: readline.Interface, envPath: string) {
  console.log('\n🏦 Configuring TBank Payment Processor...');
  let envVars = parseEnvFile(envPath);
  let updated = false;

  const setupTBank = await askYesNo(rl, 'Do you want to configure TBank payment gateway settings?', true);
  if (!setupTBank) {
    console.log('Skipping TBank configuration.');
    return;
  }

  console.log('\n--- Production Keys ---');
  const prodTerminalKey = await askForInput(rl, 'Enter your PRODUCTION TBank TerminalKey', envVars.TBANK_PROD_TERMINAL_KEY || '');
  const prodSecretKey = await askForInput(rl, 'Enter your PRODUCTION TBank SecretKey', envVars.TBANK_PROD_SECRET_KEY || '');
  if (prodTerminalKey && prodSecretKey) {
    envVars.TBANK_PROD_TERMINAL_KEY = prodTerminalKey;
    envVars.TBANK_PROD_SECRET_KEY = prodSecretKey;
    updated = true;
  }

  console.log('\n--- Test Keys ---');
  const testTerminalKey = await askForInput(rl, 'Enter your TEST TBank TerminalKey', envVars.TBANK_TEST_TERMINAL_KEY || '');
  const testSecretKey = await askForInput(rl, 'Enter your TEST TBank SecretKey', envVars.TBANK_TEST_SECRET_KEY || '');
  if (testTerminalKey && testSecretKey) {
    envVars.TBANK_TEST_TERMINAL_KEY = testTerminalKey;
    envVars.TBANK_TEST_SECRET_KEY = testSecretKey;
    updated = true;
  }

  if ( (prodTerminalKey && prodSecretKey) || (testTerminalKey && testSecretKey) ) {
      const useTest = await askYesNo(rl, 'Do you want to use TEST keys by default for development?', 
                                 envVars.TBANK_USE_TEST_MODE === '1'
                                );
    envVars.TBANK_USE_TEST_MODE = useTest ? '1' : '0';
    updated = true;
    console.log(`TBank will use ${useTest ? 'TEST' : 'PRODUCTION'} keys based on TBANK_USE_TEST_MODE=${envVars.TBANK_USE_TEST_MODE}`);
  } else {
    console.log('⚠️ No TBank keys were provided. Skipping mode selection.');
  }
  
  const defaultReturnUrl = envVars.NEXT_PUBLIC_APP_URL ? `${envVars.NEXT_PUBLIC_APP_URL}/payments/callback/tbank` : '';
  const tbankReturnUrl = await askForInput(rl, 'Enter TBank default Return URL for payments', envVars.TBANK_DEFAULT_RETURN_URL || defaultReturnUrl);
  if (tbankReturnUrl) {
    envVars.TBANK_DEFAULT_RETURN_URL = tbankReturnUrl;
    updated = true;
  }

  const defaultWebhookUrl = envVars.NEXT_PUBLIC_APP_URL ? `${envVars.NEXT_PUBLIC_APP_URL}/api/payments/tbank/webhook` : '';
  const tbankWebhookUrl = await askForInput(rl, 'Enter TBank default Webhook URL', envVars.TBANK_DEFAULT_WEBHOOK_URL || defaultWebhookUrl);
  if (tbankWebhookUrl) {
    envVars.TBANK_DEFAULT_WEBHOOK_URL = tbankWebhookUrl;
    updated = true;
  }
  
  const defaultCardWebhookUrl = envVars.NEXT_PUBLIC_APP_URL ? `${envVars.NEXT_PUBLIC_APP_URL}/api/payments/tbank/card-webhook` : '';
  const tbankCardWebhookUrl = await askForInput(rl, 'Enter TBank default Card Webhook URL', envVars.TBANK_DEFAULT_CARD_WEBHOOK_URL || defaultCardWebhookUrl);
  if (tbankCardWebhookUrl) {
    envVars.TBANK_DEFAULT_CARD_WEBHOOK_URL = tbankCardWebhookUrl;
    updated = true;
  }


  if (updated) {
    writeEnvFile(envPath, envVars);
    console.log('✅ TBank configuration saved to .env file.');
  } else {
    console.log('No changes made to TBank configuration.');
  }
}

async function calibrateTBank(rl: readline.Interface, envPath: string) {
  console.log('\n⚙️ Calibrating TBank Integration...');
  const envVars = parseEnvFile(envPath);
  const useTestMode = envVars.TBANK_USE_TEST_MODE === '1';

  const terminalKey = useTestMode ? envVars.TBANK_TEST_TERMINAL_KEY : envVars.TBANK_PROD_TERMINAL_KEY;
  const secretKey = useTestMode ? envVars.TBANK_TEST_SECRET_KEY : envVars.TBANK_PROD_SECRET_KEY;
  const appBaseUrl = envVars.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!terminalKey || !secretKey) {
    console.error('❌ TBank TerminalKey or SecretKey not configured for the selected mode. Skipping calibration.');
    return;
  }

  const tbankProcessor = new TBankPaymentProcessor({
    terminalKey,
    secretKey,
    useTestMode,
    appBaseUrl,
  });

  const runCalibration = await askYesNo(rl, 'Do you want to run a test payment initiation to calibrate TBank?', true);
  if (!runCalibration) {
    console.log('Skipping TBank calibration test.');
    return;
  }

  const testAmount = parseFloat(await askForInput(rl, 'Enter a small amount for the test payment (e.g., 1.00 RUB)', '1.00'));
  const testOrderId = `test_cal_${Date.now()}`;

  console.log(`Attempting to initiate a test payment of ${testAmount} RUB with OrderID ${testOrderId}...`);
  try {
    const result = await tbankProcessor.initiatePayment({
      paymentId: testOrderId,
      amount: testAmount,
      currency: 'RUB',
      description: 'TBank Calibration Test',
      userId: 'calibration-user',
      returnUrl: envVars.TBANK_DEFAULT_RETURN_URL || `${appBaseUrl}/payment-callback/tbank-calibration`,
      // metadata: { some_data: 'test' } // Add if needed
    });

    if (result.redirectUrl) {
      console.log('✅ Test payment initiated successfully!');
      console.log(`🔗 Redirect URL: ${result.redirectUrl}`);
      console.log(`🆔 External Payment ID (TBank PaymentId): ${result.externalPaymentId}`);
      console.log('Please open the Redirect URL in your browser to complete the test payment on TBank page.');
      console.log('After completing or canceling the payment, check your TBank merchant dashboard and webhook logs.');
    } else {
      console.error('❌ Failed to initiate test payment.');
      if (result.errorMessage) console.error(`   Error: ${result.errorMessage}`);
      if (result.providerResponse) console.error('   Provider Response:', result.providerResponse);
    }
  } catch (error: any) {
    console.error('❌ Error during TBank calibration test payment:', error.message);
  }
}

export async function assistTbank() {
  const rl = createRlInterface();
  const projectRoot = process.cwd(); // Assuming script is run from project root
  const envPath = path.join(projectRoot, '.env');

  try {
    await configureTBank(rl, envPath);
    await calibrateTBank(rl, envPath);
    console.log('\n✨ TBank assistance finished.');
  } catch (error) {
    console.error('❌ Error during TBank assistance:', error);
    debug('Error in assistTbank:', error);
  } finally {
    rl.close();
  }
}

// Allow direct execution for testing this module
if (require.main === module) {
  assistTbank();
} 