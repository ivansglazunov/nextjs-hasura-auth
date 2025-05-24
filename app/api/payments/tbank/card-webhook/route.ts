import { NextRequest, NextResponse } from 'next/server';
import { TBankPaymentProcessor, TBankCardInfo, TBankProviderDBConfig } from '@/lib/payments/tbank';
import { tbankAppOptions } from '@/app/payments/tbank/options';
import { Hasyx } from 'hasyx';
import { createApolloClient } from 'hasyx/lib/apollo';
import { Generator } from 'hasyx/lib/generator';
import schema from '@/public/hasura-schema.json';
import Debug from 'hasyx/lib/debug';
import { PaymentMethodStatus } from '@/lib/payments/base';

const debug = Debug('api:payments:tbank:card-webhook');

const HASURA_GRAPHQL_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

let hasyxClient: Hasyx;

if (!HASURA_GRAPHQL_URL || !HASURA_ADMIN_SECRET) {
  console.error('Hasura URL or Admin Secret not configured for TBank card webhook handler.');
} else {
  try {
    const apolloClient = createApolloClient({
      url: HASURA_GRAPHQL_URL,
      secret: HASURA_ADMIN_SECRET,
    });
    hasyxClient = new Hasyx(apolloClient, Generator(schema as any));
  } catch (e:any) { debug('Error initializing Hasyx client for card webhook', e.message); }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  debug('Received TBank card webhook POST request');

  if (!hasyxClient) {
    debug('Hasyx client not initialized for card webhook.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const rawBody = await request.text();
    const payload = Object.fromEntries(new URLSearchParams(rawBody)); // TBank usually sends x-www-form-urlencoded
    debug('Card webhook raw payload:', payload);

    const terminalKeyFromPayload = payload.TerminalKey as string;
    if (!terminalKeyFromPayload) {
      debug('TerminalKey missing in TBank card webhook payload.');
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
      appBaseUrl: APP_BASE_URL,
      options: tbankAppOptions,
    });

    const customerKey = payload.CustomerKey as string;
    const requestKey = payload.RequestKey as string; // From AddCard init, TBank includes this in notifications
    const tbankCardStatus = payload.Status as string; // Status of the card operation, e.g., 'A' (Active), 'R' (Rejected)
    const cardIdFromPayload = payload.CardId as string; // CardId might be in the webhook itself
    const success = payload.Success === 'true'; // TBank often sends boolean as string

    if (!success || tbankCardStatus !== 'A') {
      debug(`Card operation not successful or status not Active. Status: ${tbankCardStatus}, Success: ${payload.Success}. RequestKey: ${requestKey}`);
      // TODO: Potentially update an internal record for this attempt as failed/rejected.
      return new NextResponse("OK", { status: 200 }); // Acknowledge receipt even if not successful card add
    }

    if (!customerKey) {
      debug('CustomerKey missing in card webhook payload.');
      return new NextResponse("ERROR", { status: 400 });
    }
    
    // At this point, the card is likely successfully added or 3DS passed.
    // We should fetch the card list to get the definitive CardId and RebillId.
    const cards = await tbankAdapter.getCardList(customerKey);
    let newCardInfo: TBankCardInfo | null | undefined = null;

    if (cards && cards.length > 0) {
      if (cardIdFromPayload) {
        newCardInfo = cards.find(card => card.CardId === cardIdFromPayload && card.Status === 'A');
      } else {
        // If CardId not in payload, try to find the newest active card, or one matching RequestKey if possible (TBank doesn't usually link RequestKey to GetCardList directly).
        // This part is heuristic. A robust solution might involve temporarily storing RequestKey with UserID/CustomerKey 
        // and then matching on CustomerKey and finding the most recent card. 
        // For simplicity, let's pick the first active card if multiple exist and no cardIdFromPayload.
        // This should be refined based on how you manage multiple cards and identify the newly added one.
        newCardInfo = cards.filter(card => card.Status === 'A').sort((a,b) => b.CardId.localeCompare(a.CardId))[0]; // Simplistic: newest by ID
        debug('CardId not in webhook, heuristically picked card:', newCardInfo);
      }
    }

    if (newCardInfo == null) {
      debug(`Could not find a suitable active card object for CustomerKey ${customerKey} via GetCardList after webhook. Webhook CardId: ${cardIdFromPayload}`);
      return new NextResponse("OK", { status: 200 });
    }

    if (!newCardInfo.CardId) {
        debug(`Card object found for CustomerKey ${customerKey}, but it is missing a CardId. This should not happen if newCardInfo is a valid TBankCardInfo. Webhook CardId: ${cardIdFromPayload}`);
        return new NextResponse("OK", { status: 200 });
    }

    // Retrieve the user ID associated with this customerKey from existing payment methods or operations
    // Since we don't have a mapping table, we'll try to find existing records for this customer
    let internalUserId: string | null = null;
    
    // Try to find existing payment method with this customer key in metadata
    const existingMethods = await hasyxClient.select({
        table: 'payments_methods',
        where: {
            provider_id: { _eq: providerResult.id },
            type: { _eq: 'card' },
            recurrent_details: { _contains: { customerKey: customerKey } }
        },
        limit: 1,
        returning: ['user_id']
    });

    if (existingMethods && existingMethods.length > 0) {
        internalUserId = existingMethods[0].user_id;
    } else {
        // Try to find from operations metadata
        const existingOperations = await hasyxClient.select({
            table: 'payments_operations',
            where: {
                provider_id: { _eq: providerResult.id },
                metadata: { _contains: { customerKey: customerKey } }
            },
            limit: 1,
            returning: ['user_id']
        });
        
        if (existingOperations && existingOperations.length > 0) {
            internalUserId = existingOperations[0].user_id;
        }
    }
    
    // If no mapping found, we'll acknowledge but not process 
    if (!internalUserId) {
        debug('Could not determine internalUserId for card webhook processing. CustomerKey:', customerKey);
        debug('This likely means the card was added through external means or the addPaymentMethod flow was not completed through our system');
        return new NextResponse("OK", { status: 200 }); // Acknowledge, but log warning
    }

    const paymentMethodData = {
      user_id: internalUserId,
      provider_id: providerResult.id,
      external_id: newCardInfo.CardId,
      type: 'card',
      details: {
        pan_masked: newCardInfo.Pan,
        exp_date: newCardInfo.ExpDate,
        card_type: newCardInfo.CardType, // TBank provides numeric card types
      },
      is_default: newCardInfo.IsDefault || false, // Or manage default logic separately
      is_recurrent_ready: !!newCardInfo.RebillId, // True if RebillId is present
      recurrent_details: newCardInfo.RebillId ? { rebillId: newCardInfo.RebillId } : null,
      expires_at: newCardInfo.ExpDate ? `20${newCardInfo.ExpDate.substring(2)}/${newCardInfo.ExpDate.substring(0,2)}/01` : undefined, // MMYY to YYYY/MM/01 - rough estimate, better to store MMYY
      status: PaymentMethodStatus.ACTIVE,
    };

    try {
      // Upsert logic: Update if exists (e.g. card details changed), or insert if new.
      debug('Attempting to save payment method to Hasura:', paymentMethodData);
      await hasyxClient.insert({
        table: 'payments_methods',
        object: paymentMethodData,
        returning: ['id'],
        role: 'admin', // Or a backend role with insert permissions to payment_methods
        // on_conflict: { constraint: 'payment_methods_user_id_provider_id_external_id_type_key', update_columns: ['details', 'is_default', 'is_recurrent_ready', 'recurrent_details', 'expires_at', 'status'] }
      });
      debug(`Payment method for CardId ${newCardInfo.CardId} saved successfully for user ${internalUserId}.`);
    } catch (hasuraError: any) {
      debug(`Error saving payment method for CardId ${newCardInfo.CardId} in Hasura:`, hasuraError.message, hasuraError.graphQLErrors);
      // Log and continue. The card is added in TBank, but internal DB sync failed.
    }

    return new NextResponse("OK", { status: 200 });

  } catch (error: any) {
    debug('Critical error in TBank card webhook POST handler:', error.message, error.stack);
    return new NextResponse("ERROR", { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  debug('OPTIONS /api/payments/tbank/card-webhook');
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
} 