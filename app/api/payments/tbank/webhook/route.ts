import { NextRequest, NextResponse } from 'next/server';
import { TBankPaymentProcessor, TBankProviderDBConfig } from '@/lib/payments/tbank'; 
import { tbankAppOptions } from '@/app/payments/tbank/options';
import { Hasyx } from 'hasyx'; 
import { createApolloClient } from 'hasyx/lib/apollo'; 
import { Generator } from 'hasyx/lib/generator';
import schema from '@/public/hasura-schema.json';
import Debug from 'hasyx/lib/debug';
import { PaymentStatus, WebhookHandlingResult } from '@/lib/payments/base';

const debug = Debug('api:payments:tbank:webhook');

const HASURA_GRAPHQL_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

let hasyxClient: Hasyx;

if (!HASURA_GRAPHQL_URL || !HASURA_ADMIN_SECRET) {
  const errorMessage = 'Hasura URL or Admin Secret not configured for TBank webhook handler.';
  console.error(errorMessage);
  debug(errorMessage);
  // Optional: throw error to prevent startup if Hasura client is critical and cannot be initialized
} else {
  try {
    const apolloClient = createApolloClient({
      url: HASURA_GRAPHQL_URL, 
      secret: HASURA_ADMIN_SECRET,
    });
    hasyxClient = new Hasyx(apolloClient, Generator(schema as any)); 
    debug('Hasyx client initialized successfully for TBank webhook handler.');
  } catch (e: any) {
    const errorMessage = `Failed to initialize Hasyx client: ${e.message}`;
    console.error(errorMessage, e);
    debug(errorMessage, e);
  }
}

// TBank adapter will be initialized dynamically within the POST handler

export async function POST(request: NextRequest): Promise<NextResponse> {
  debug('Received TBank webhook POST request');

  if (!hasyxClient) {
    const errorMessage = 'Hasyx client not initialized. Cannot process TBank webhook.';
    debug(errorMessage);
    return NextResponse.json({ error: 'Server configuration error', details: errorMessage }, { status: 500 });
  }

  let payload: any;
  try {
    const rawBody = await request.text();
    debug('Raw webhook body:', rawBody);
    
    if (typeof rawBody === 'string') {
        payload = Object.fromEntries(new URLSearchParams(rawBody));
    } else {
        debug('Invalid rawBody type for TBank webhook');
        return new NextResponse("ERROR: Invalid body format", { status: 400 });
    }
    debug('Parsed TBank webhook payload:', payload);

    const terminalKeyFromPayload = payload.TerminalKey as string;
    if (!terminalKeyFromPayload) {
      debug('TerminalKey missing in TBank webhook payload.');
      return new NextResponse("ERROR: TerminalKey missing", { status: 400 });
    }

    // Fetch provider configuration from DB using TerminalKey
    debug(`Fetching TBank provider config for TerminalKey: ${terminalKeyFromPayload}`);
    const providers = await hasyxClient.select({
        table: 'payments_providers',
        where: {
            type: { _eq: 'tbank' },
            config: { _contains: { terminal_key: terminalKeyFromPayload } },
            is_active: { _eq: true }
        },
        limit: 1,
        returning: ['id', 'config', 'is_test_mode', 'default_return_url', 'default_webhook_url', 'default_card_webhook_url']
    });

    if (!providers || providers.length === 0 || !providers[0].config) {
      debug(`No active TBank provider configuration found for TerminalKey: ${terminalKeyFromPayload}`);
      return new NextResponse("ERROR: Provider configuration not found", { status: 400 });
    }

    const providerResult = providers[0];
    const providerDBConfig = providerResult.config as TBankProviderDBConfig;
    // Augment with other fields from providerResult
    providerDBConfig.is_test_mode = providerResult.is_test_mode;
    providerDBConfig.default_return_url = providerResult.default_return_url;
    providerDBConfig.default_webhook_url = providerResult.default_webhook_url;
    providerDBConfig.default_card_webhook_url = providerResult.default_card_webhook_url;

    if (!providerDBConfig.secret_key) {
        debug(`Secret key missing in fetched TBank provider config for TerminalKey: ${terminalKeyFromPayload}`);
        return new NextResponse("ERROR: Provider secret key misconfiguration", { status: 500 });
    }

    // Dynamically initialize TBank adapter
    const tbankAdapter = new TBankPaymentProcessor({
      providerDBConfig: providerDBConfig,
      appBaseUrl: APP_BASE_URL, // General app base URL as fallback
      options: tbankAppOptions, // Global/app-specific TBank options
    });
    debug('TBank adapter dynamically initialized for webhook processing.');

    // Pass the payload directly instead of parsing it again
    const result: WebhookHandlingResult = await tbankAdapter.handleWebhook(
      request, // Pass the request object
      rawBody  // Pass the raw body as received
    );
    debug('Webhook processing result from adapter:', result);

    if (result.processed && result.paymentId) {
      const paymentUpdateData: any = {
        status: result.newPaymentStatus,
        provider_response_details: result.providerResponse, 
      };
      if (result.externalPaymentId) {
        paymentUpdateData.external_operation_id = result.externalPaymentId; // Changed to external_operation_id
      }
      if (result.newPaymentStatus === PaymentStatus.SUCCEEDED) {
        paymentUpdateData.paid_at = new Date().toISOString();
      }

      try {
        debug(`Attempting to update operation (payment) ${result.paymentId} in Hasura with data:`, paymentUpdateData);
        await hasyxClient.update({
          table: 'payments_operations', 
          where: { id: { _eq: result.paymentId } }, 
          _set: paymentUpdateData,
          returning: ['id'], 
          role: 'admin', 
        });
        debug(`Operation (payment) ${result.paymentId} updated successfully in Hasura.`);
      } catch (hasuraError: any) {
        debug(`Error updating operation (payment) ${result.paymentId} in Hasura:`, hasuraError.message, hasuraError.graphQLErrors);
      }

      if (result.subscriptionId && result.newSubscriptionStatus) {
         try {
            const subscriptionUpdateData: any = { status: result.newSubscriptionStatus };
            // If subscription becomes active, set current_period_start/end based on webhook data if available
            // This part depends on what TBank webhook provides for recurrent payments/subscriptions
            // For now, just updating status.
            debug(`Attempting to update subscription ${result.subscriptionId} in Hasura with data:`, subscriptionUpdateData);
            await hasyxClient.update({
                table: 'payments_subscriptions',
                where: { id: { _eq: result.subscriptionId } }, 
                _set: subscriptionUpdateData,
                returning: ['id'],
                role: 'admin',
            });
            debug(`Subscription ${result.subscriptionId} updated successfully in Hasura.`);
         } catch (hasuraError: any) {
            debug(`Error updating subscription ${result.subscriptionId} in Hasura:`, hasuraError.message, hasuraError.graphQLErrors);
         }
      }

    } else if (!result.processed) {
      debug('Webhook processing failed by adapter:', result.error);
    }

    const responseMessage = result.messageToProvider || (result.processed ? "OK" : "ERROR");
    const responseStatus = result.processed ? 200 : (result.error === 'Webhook token mismatch' || result.error === 'Webhook TerminalKey mismatch with processor instance.' ? 400 : 500);
    debug(`Responding to TBank with status ${responseStatus} and message: ${responseMessage}`);
    return new NextResponse(responseMessage, { status: responseStatus });

  } catch (error: any) {
    debug('Critical error in TBank webhook POST handler:', error.message, error.stack);
    // Avoid leaking detailed error messages to TBank unless it's a specific format they expect
    let internalPaymentIdAttempt = payload?.OrderId; // Try to get OrderId if payload parsing was successful
    debug(`Webhook processing failed critically. OrderId (if available): ${internalPaymentIdAttempt}. Error:`, error);
    return new NextResponse("ERROR", { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  debug('OPTIONS /api/payments/tbank/webhook');
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', '*'); 
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
} 