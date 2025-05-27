import { NextRequest, NextResponse } from 'next/server';
import { Hasyx } from 'hasyx/lib/hasyx';
import { createApolloClient } from 'hasyx/lib/apollo';
import { Generator } from 'hasyx/lib/generator';
import schema from '../../../../../public/hasura-schema.json';
import { TBankPaymentProcessor } from 'hasyx/lib/payments/tbank';
import { getServerSession } from 'next-auth';
import authOptions from 'hasyx/lib/next-auth-options';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider_id, customer_key } = await request.json();

    if (!provider_id || !customer_key) {
      return NextResponse.json({ 
        error: 'Missing required fields: provider_id, customer_key' 
      }, { status: 400 });
    }

    // Initialize Hasyx client with user role for security
    const apolloClient = createApolloClient({
      url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
      token: session.accessToken || undefined, // Use user token instead of admin secret
    });
    const hasyx = new Hasyx(apolloClient, Generator(schema));
    hasyx.user = session.user; // Set user context

    // Get provider configuration (using user role - permissions will control access)
    const providers = await hasyx.select({
      table: 'payments_providers',
      where: { id: { _eq: provider_id } },
      returning: ['id', 'type', 'config', 'is_test_mode'],
      role: 'user'
    });

    if (!providers || providers.length === 0) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    const provider = providers[0];

    if (provider.type !== 'tbank') {
      return NextResponse.json({ 
        error: 'Unsupported provider type' 
      }, { status: 400 });
    }

    // Initialize TBank processor
    const processor = new TBankPaymentProcessor({
      providerDBConfig: provider.config,
      appBaseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    });

    // Create add card request using the correct method name and interface
    const addCardResult = await processor.addPaymentMethod({
      userId: session.user.id,
      providerName: 'tbank', // Add missing required field
      type: 'card',
      details: {
        tbankCustomerKey: customer_key,
        tbankCheckType: '3DS',
        tbankReturnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/hasyx/payments?tab=methods&action=card-added`
      }
    });

    if (addCardResult.status === 'failed') {
      return NextResponse.json({ 
        error: addCardResult.detailsForUser?.message || 'Failed to initiate card addition' 
      }, { status: 400 });
    }

    // Create payment method record using hasyx.insert with user role
    // Hasura permissions will ensure user can only create methods for themselves
    const paymentMethod = await hasyx.insert({
      table: 'payments_methods',
      object: {
        provider_id: provider_id,
        external_id: addCardResult.detailsForUser?.requestKey || '',
        type: 'card',
        status: 'pending_verification',
        details: {
          customer_key: customer_key,
          request_key: addCardResult.detailsForUser?.requestKey
        },
        is_recurrent_ready: false,
        recurrent_details: {
          customerKey: customer_key
        }
      },
      returning: ['id'],
      role: 'user' // Use user role - permissions will auto-set user_id
    });

    return NextResponse.json({
      success: true,
      payment_method_id: paymentMethod.id,
      redirect_url: addCardResult.redirectUrl,
      request_key: addCardResult.detailsForUser?.requestKey
    });

  } catch (error: any) {
    console.error('Add card error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
} 