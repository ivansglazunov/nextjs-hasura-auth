import { NextRequest, NextResponse } from 'next/server';
import { Hasura } from 'hasyx/lib/hasura';
import { TBankPaymentProcessor } from 'hasyx/lib/payments/tbank';
import Debug from 'hasyx/lib/debug';

const debug = Debug('api:payments:tbank:init');

export async function POST(request: NextRequest) {
  try {
    const { operation_id, provider_id } = await request.json();
    
    if (!operation_id || !provider_id) {
      return NextResponse.json(
        { error: 'Missing operation_id or provider_id' },
        { status: 400 }
      );
    }

    const hasura = new Hasura({
      url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
      secret: process.env.HASURA_ADMIN_SECRET!,
    });

    // Get payment operation details using v1 API
    const operationQuery = `
      query GetOperation($id: uuid!) {
        payments_operations(where: { id: { _eq: $id } }) {
          id
          amount
          currency
          description
          user_id
        }
      }
    `;

    const operationResult = await hasura.client.post('/v1/graphql', {
      query: operationQuery,
      variables: { id: operation_id },
    });

    if (!operationResult.data?.data?.payments_operations || operationResult.data.data.payments_operations.length === 0) {
      return NextResponse.json(
        { error: 'Payment operation not found' },
        { status: 404 }
      );
    }

    const operation = operationResult.data.data.payments_operations[0];

    // Get provider configuration using v1 API
    const providerQuery = `
      query GetProvider($id: uuid!) {
        payments_providers(where: { id: { _eq: $id } }) {
          id
          name
          type
          config
          is_test_mode
        }
      }
    `;

    const providerResult = await hasura.client.post('/v1/graphql', {
      query: providerQuery,
      variables: { id: provider_id },
    });

    if (!providerResult.data?.data?.payments_providers || providerResult.data.data.payments_providers.length === 0) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    const provider = providerResult.data.data.payments_providers[0];

    if (provider.type !== 'tbank') {
      return NextResponse.json(
        { error: 'Provider is not TBank' },
        { status: 400 }
      );
    }

    // Initialize TBank processor
    const tbank = new TBankPaymentProcessor({
      providerDBConfig: provider.config,
      appBaseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    });

    // Create payment with TBank
    const paymentResult = await tbank.initiatePayment({
      paymentId: operation.id,
      amount: operation.amount,
      currency: operation.currency,
      description: operation.description || 'Payment',
      objectHid: operation.id,
      userId: operation.user_id,
    });

    if (paymentResult.errorMessage) {
      debug('TBank payment initialization failed:', paymentResult);
      
      // Update operation status using mutation
      const updateFailedMutation = `
        mutation UpdateOperation($id: uuid!, $data: payments_operations_set_input!) {
          update_payments_operations(where: { id: { _eq: $id } }, _set: $data) {
            affected_rows
          }
        }
      `;

      await hasura.client.post('/v1/graphql', {
        query: updateFailedMutation,
        variables: {
          id: operation_id,
          data: {
            status: 'failed',
            error_message: paymentResult.errorMessage,
            provider_response_details: paymentResult.providerResponse,
            updated_at: Date.now(),
          },
        },
      });

      return NextResponse.json(
        { error: paymentResult.errorMessage },
        { status: 400 }
      );
    }

    // Update operation with TBank payment details
    const updateSuccessMutation = `
      mutation UpdateOperation($id: uuid!, $data: payments_operations_set_input!) {
        update_payments_operations(where: { id: { _eq: $id } }, _set: $data) {
          affected_rows
        }
      }
    `;

    await hasura.client.post('/v1/graphql', {
      query: updateSuccessMutation,
      variables: {
        id: operation_id,
        data: {
          external_operation_id: paymentResult.externalPaymentId,
          status: paymentResult.status === 'pending_user_action' ? 'pending_user_action' : 'pending_confirmation',
          provider_response_details: paymentResult.providerResponse,
          updated_at: Date.now(),
        },
      },
    });

    debug('Payment initialized successfully:', paymentResult);

    return NextResponse.json({
      success: true,
      payment_id: paymentResult.externalPaymentId,
      payment_url: paymentResult.redirectUrl,
      operation_id: operation_id,
    });

  } catch (error) {
    debug('Error initializing payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 