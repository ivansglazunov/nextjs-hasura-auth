import { NextRequest, NextResponse } from 'next/server';
import { TBankPaymentProcessor } from '@/lib/payments/tbank'; 
import { TBankProcessorOptions, defaultTBankOptions } from '@/lib/payments/tbank/options';
import { Hasyx } from 'hasyx'; 
import { createApolloClient } from 'hasyx/lib/apollo'; 
import { Generator } from 'hasyx/lib/generator';
import schema from '@/public/hasura-schema.json'; // Corrected path to schema
import Debug from 'hasyx/lib/debug';
import { PaymentStatus, WebhookHandlingResult } from '@/lib/payments/base';

const debug = Debug('api:payments:tbank:webhook');

const HASURA_GRAPHQL_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const TBANK_TERMINAL_KEY = process.env.TBANK_TERMINAL_KEY;
const TBANK_SECRET_KEY = process.env.TBANK_SECRET_KEY;
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

let tbankAdapter: TBankPaymentProcessor;
let hasyxClient: Hasyx;

// Initialize Hasyx client
if (!HASURA_GRAPHQL_URL || !HASURA_ADMIN_SECRET) {
  const errorMessage = 'Hasura URL or Admin Secret not configured for TBank webhook handler.';
  console.error(errorMessage);
  debug(errorMessage);
} else {
  try {
    const apolloClient = createApolloClient({
      url: HASURA_GRAPHQL_URL, 
      secret: HASURA_ADMIN_SECRET,
    });
    // The schema import might be typed as `any` or a specific JSON type by TypeScript depending on tsconfig
    // Generator expects a certain structure, ensure your schema.json matches that, or cast if necessary.
    hasyxClient = new Hasyx(apolloClient, Generator(schema as any)); 
  } catch (e: any) {
    const errorMessage = `Failed to initialize Hasyx client: ${e.message}`;
    console.error(errorMessage, e);
    debug(errorMessage, e);
  }
}

// Initialize TBank adapter
if (!TBANK_TERMINAL_KEY || !TBANK_SECRET_KEY) {
  const errorMessage = 'TBank Terminal Key or Secret Key not configured.';
  console.error(errorMessage);
  debug(errorMessage);
} else {
  try {
    const tbankProcessorConfig = {
      terminalKey: TBANK_TERMINAL_KEY,
      secretKey: TBANK_SECRET_KEY,
      appBaseUrl: APP_BASE_URL,
      options: defaultTBankOptions, 
    };
    tbankAdapter = new TBankPaymentProcessor(tbankProcessorConfig);
  } catch (e: any) {
    const errorMessage = `Failed to initialize TBank adapter: ${e.message}`;
    console.error(errorMessage, e);
    debug(errorMessage, e);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  debug('Received TBank webhook POST request');

  if (!tbankAdapter || !hasyxClient) {
    const errorMessage = 'TBank adapter or Hasyx client not initialized due to missing configuration or init error.';
    debug(errorMessage);
    return NextResponse.json({ error: 'Server configuration error', details: errorMessage }, { status: 500 });
  }

  try {
    const rawBody = await request.text();
    debug('Raw webhook body:', rawBody);
    
    // Create a dummy Request object as it's expected by the interface but not used in tbank.ts handleWebhook
    const dummyRequest = new Request(request.url, { method: request.method, headers: request.headers });
    const result: WebhookHandlingResult = await tbankAdapter.handleWebhook(dummyRequest, rawBody);
    debug('Webhook processing result:', result);

    if (result.processed && result.paymentId) {
      const paymentUpdateData: any = {
        status: result.newPaymentStatus,
        provider_response_details: result.providerResponse, 
      };
      if (result.externalPaymentId) {
        paymentUpdateData.external_payment_id = result.externalPaymentId;
      }
      if (result.newPaymentStatus === PaymentStatus.SUCCEEDED) {
        paymentUpdateData.paid_at = new Date().toISOString();
      }

      try {
        debug(`Attempting to update payment ${result.paymentId} in Hasura with data:`, paymentUpdateData);
        await hasyxClient.update({
          table: 'payments',
          where: { id: { _eq: result.paymentId } }, 
          _set: paymentUpdateData,
          returning: ['id'], 
          role: 'admin', 
        });
        debug(`Payment ${result.paymentId} updated successfully in Hasura.`);
      } catch (hasuraError: any) {
        debug(`Error updating payment ${result.paymentId} in Hasura:`, hasuraError.message, hasuraError.graphQLErrors);
        // Log and continue, TBank should still get an OK if core processing was fine.
      }

      if (result.subscriptionId && result.newSubscriptionStatus) {
         try {
            const subscriptionUpdateData: any = { status: result.newSubscriptionStatus };
            debug(`Attempting to update subscription ${result.subscriptionId} in Hasura with data:`, subscriptionUpdateData);
            await hasyxClient.update({
                table: 'subscriptions',
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

    // Respond to TBank
    const responseMessage = result.messageToProvider || (result.processed ? "OK" : "ERROR");
    const responseStatus = result.processed ? 200 : 400; // Or 500 if it was an internal error before processing
    debug(`Responding to TBank with status ${responseStatus} and message: ${responseMessage}`);
    return new NextResponse(responseMessage, { status: responseStatus });

  } catch (error: any) {
    debug('Critical error in TBank webhook POST handler:', error.message, error.stack);
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