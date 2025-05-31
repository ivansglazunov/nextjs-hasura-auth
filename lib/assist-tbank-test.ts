import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { askForInput, parseEnvFile, writeEnvFile } from './assist-common';
import Debug from './debug';

const debug = Debug('assist:tbank-test');

/**
 * Configure T-Bank test environment for integration testing
 */
export async function configureTBankTest(rl: readline.Interface, envPath: string): Promise<Record<string, string>> {
  console.log('\n🏦 Configuring T-Bank Test Environment...');
  debug('Starting T-Bank test configuration');

  let envVars = parseEnvFile(envPath);

  // Check if already configured
  if (envVars.TBANK_TEST_TERMINAL_KEY && 
      envVars.TBANK_TEST_SECRET_KEY && 
      envVars.TBANK_TEST_SUCCESS_CARD_NUMBER &&
      envVars.TBANK_TEST_SUCCESS_CARD_EXP &&
      envVars.TBANK_TEST_SUCCESS_CARD_CVC &&
      envVars.TBANK_TEST_FAIL_CARD_NUMBER &&
      envVars.TBANK_TEST_FAIL_CARD_EXP &&
      envVars.TBANK_TEST_FAIL_CARD_CVC) {
    console.log('✅ T-Bank test environment is already configured');
    return envVars;
  }

  console.log('\n🔧 T-Bank test environment needs configuration for integration testing');
  console.log('This will configure test terminal credentials and test card data');

  // Get T-Bank test terminal credentials
  const terminalKey = envVars.TBANK_TEST_TERMINAL_KEY || await askForInput(
    rl,
    'Enter T-Bank Test Terminal Key (from T-Bank test merchant account):'
  );

  const secretKey = envVars.TBANK_TEST_SECRET_KEY || await askForInput(
    rl,
    'Enter T-Bank Test Secret Key (from T-Bank test merchant account):'
  );

  console.log('\n💳 Test Card Configuration');
  console.log('Configure test cards for successful and failed payment scenarios');

  // Success card data
  const successCardNumber = envVars.TBANK_TEST_SUCCESS_CARD_NUMBER || await askForInput(
    rl,
    'Enter test card number for SUCCESSFUL payments (e.g., 4300000000000777):',
    '4300000000000777'
  );

  const successCardExp = envVars.TBANK_TEST_SUCCESS_CARD_EXP || await askForInput(
    rl,
    'Enter expiry date for success card (MM/YY format, e.g., 12/25):',
    '12/25'
  );

  const successCardCvc = envVars.TBANK_TEST_SUCCESS_CARD_CVC || await askForInput(
    rl,
    'Enter CVC for success card (e.g., 123):',
    '123'
  );

  // Failure card data
  const failCardNumber = envVars.TBANK_TEST_FAIL_CARD_NUMBER || await askForInput(
    rl,
    'Enter test card number for FAILED payments (e.g., 4300000000000002):',
    '4300000000000002'
  );

  const failCardExp = envVars.TBANK_TEST_FAIL_CARD_EXP || await askForInput(
    rl,
    'Enter expiry date for fail card (MM/YY format, e.g., 12/25):',
    '12/25'
  );

  const failCardCvc = envVars.TBANK_TEST_FAIL_CARD_CVC || await askForInput(
    rl,
    'Enter CVC for fail card (e.g., 456):',
    '456'
  );

  // Update environment variables
  const updates: Record<string, string> = {
    ...envVars,
    TBANK_TEST_TERMINAL_KEY: terminalKey,
    TBANK_TEST_SECRET_KEY: secretKey,
    TBANK_TEST_SUCCESS_CARD_NUMBER: successCardNumber,
    TBANK_TEST_SUCCESS_CARD_EXP: successCardExp,
    TBANK_TEST_SUCCESS_CARD_CVC: successCardCvc,
    TBANK_TEST_FAIL_CARD_NUMBER: failCardNumber,
    TBANK_TEST_FAIL_CARD_EXP: failCardExp,
    TBANK_TEST_FAIL_CARD_CVC: failCardCvc
  };

  // Also add OpenRouter API key if not set (needed for AI)
  if (!envVars.OPENROUTER_API_KEY) {
    const openRouterKey = await askForInput(
      rl,
      'Enter OpenRouter API Key (needed for AI automation in tests):'
    );
    updates.OPENROUTER_API_KEY = openRouterKey;
  }

  writeEnvFile(envPath, updates);
  envVars = updates;

  console.log('✅ T-Bank test environment configured successfully');
  console.log('\n📋 Configured variables:');
  console.log(`- TBANK_TEST_TERMINAL_KEY: ${terminalKey.substring(0, 8)}...`);
  console.log(`- TBANK_TEST_SECRET_KEY: ${secretKey.substring(0, 8)}...`);
  console.log(`- Success Card: ${successCardNumber} (exp: ${successCardExp})`);
  console.log(`- Fail Card: ${failCardNumber} (exp: ${failCardExp})`);

  debug('T-Bank test configuration completed');
  return envVars;
}

/**
 * Check if T-Bank test environment is available
 */
export function isTBankTestAvailable(): boolean {
  const requiredVars = [
    'TBANK_TEST_TERMINAL_KEY',
    'TBANK_TEST_SECRET_KEY',
    'TBANK_TEST_SUCCESS_CARD_NUMBER',
    'TBANK_TEST_SUCCESS_CARD_EXP',
    'TBANK_TEST_SUCCESS_CARD_CVC',
    'TBANK_TEST_FAIL_CARD_NUMBER',
    'TBANK_TEST_FAIL_CARD_EXP',
    'TBANK_TEST_FAIL_CARD_CVC',
    'OPENROUTER_API_KEY'
  ];

  return requiredVars.every(varName => !!process.env[varName]);
}

/**
 * Get T-Bank test configuration
 */
export function getTBankTestConfig() {
  if (!isTBankTestAvailable()) {
    throw new Error('T-Bank test environment is not configured. Run assist T-Bank test setup first.');
  }

  return {
    terminalKey: process.env.TBANK_TEST_TERMINAL_KEY!,
    secretKey: process.env.TBANK_TEST_SECRET_KEY!,
    successCard: {
      number: process.env.TBANK_TEST_SUCCESS_CARD_NUMBER!,
      exp: process.env.TBANK_TEST_SUCCESS_CARD_EXP!,
      cvc: process.env.TBANK_TEST_SUCCESS_CARD_CVC!
    },
    failCard: {
      number: process.env.TBANK_TEST_FAIL_CARD_NUMBER!,
      exp: process.env.TBANK_TEST_FAIL_CARD_EXP!,
      cvc: process.env.TBANK_TEST_FAIL_CARD_CVC!
    },
    openRouterApiKey: process.env.OPENROUTER_API_KEY!
  };
} 