import { NextResponse } from 'next/server';
import { DummyPaymentProcessor } from '@/lib/payments/dummy';
import { PaymentDetailsArgs } from '@/lib/payments/base';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from "next-auth/next"
import authOptions from "@/app/options"
import { Hasura } from '@/lib/hasura'; // For writing to the DB
import Debug from '@/lib/debug';

const debug = Debug('api:payments:dummy:initiate');
const processor = new DummyPaymentProcessor(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let paymentIdForErrorHandling: string | null = null;

  try {
    const body = await request.json();
    const { amount, currency, objectHid, description, returnUrl, paymentMethodId, metadata } = body;

    if (typeof amount !== 'number' || !currency || !objectHid) {
      return NextResponse.json({ error: 'Missing required fields: amount, currency, objectHid' }, { status: 400 });
    }

    const paymentId = uuidv4(); // Generate our internal payment ID
    paymentIdForErrorHandling = paymentId; // Save for possible error handling
    const userId = session.user.id;

    // 1. Create a payment record in our DB with status 'pending_initiation'
    const hasura = new Hasura({
      url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
      secret: process.env.HASURA_ADMIN_SECRET!,
    });

    const initialDbRecord = {
      id: paymentId,
      user_id: userId,
      provider_name: processor.providerName,
      amount,
      currency,
      status: 'pending_initiation',
      description: description || `Payment for ${objectHid}`,
      object_hid: objectHid,
      initiated_at: new Date().toISOString(),
      // provider_request_details: { amount, currency, description, objectHid } // Log initial request details
    };
    debug('Attempting to insert initial payment record:', initialDbRecord);
    await hasura.v1({
      type: 'insert_one_payments', // Assuming your Hasura insert mutation is named this way
      args: {
        object: initialDbRecord
      }
    });
    debug('Initial payment record inserted successfully.');

    // 2. Initiate payment through the processor
    const paymentArgs: PaymentDetailsArgs = {
      amount,
      currency,
      description: description || `Payment for ${objectHid}`,
      objectHid,
      userId,
      paymentId, // Pass our ID
      // paymentMethodId, // if applicable
      // customerId, // if applicable
    };

    const result = await processor.initiatePayment(paymentArgs);
    debug('Payment initiation result from processor:', result);

    // 3. Update the payment status in the DB (if necessary, e.g., external_payment_id)
    if (result.externalPaymentId || result.status !== 'pending_initiation') {
      const updatePayload: any = { status: result.status };
      if (result.externalPaymentId) {
        updatePayload.external_payment_id = result.externalPaymentId;
      }
      // Optionally log provider_response_details from result if it contains useful info
      // updatePayload.provider_response_details = result.providerResponseDetails; 

      debug('Updating payment record with external ID and new status:', updatePayload);
      await hasura.v1({
        type: 'update_payments_by_pk', // Assuming your Hasura update mutation is named this way
        args: {
          pk_columns: { id: paymentId },
          _set: updatePayload
        }
      });
      debug('Payment record updated successfully.');
    }

    if (result.redirectUrl) {
      return NextResponse.json({ redirectUrl: result.redirectUrl, paymentId: result.paymentId });
    } else if (result.sdkData) {
      return NextResponse.json({ sdkData: result.sdkData, paymentId: result.paymentId });
    } else if (result.errorMessage) {
      return NextResponse.json({ error: result.errorMessage, paymentId: result.paymentId }, { status: 400 });
    } else {
        return NextResponse.json(result);
    }

  } catch (error) {
    debug('[DUMMY_INITIATE_ERROR]', error);
    paymentIdForErrorHandling = 'db_log_error_failed'; // Last resort error ID
    // Fallback logging if DB log fails or isn't called
    debug('Critical error during payment initiation, and DB log may have failed:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    // await logPaymentError('initiate_payment_general_error', error.message, paymentIdForErrorHandling, undefined, { body });
    return NextResponse.json({ error: "Failed to initiate payment", details: errorMessage }, { status: 500 });
  }
} 