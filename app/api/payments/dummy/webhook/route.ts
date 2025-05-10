import { NextResponse } from 'next/server';
import { DummyPaymentProcessor } from '@/lib/payments/dummy';
import { Hasura } from '@/lib/hasura';
import Debug from '@/lib/debug';

const debug = Debug('api:payments:dummy:webhook');
const processor = new DummyPaymentProcessor(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');

// Dummy webhook handles GET requests as we simulate a redirect to it
export async function GET(request: Request) {
  debug('Dummy webhook received request:', request.url);
  let paymentIdForErrorHandling: string | undefined;

  try {
    // Call the webhook handler from the processor
    // For a GET request, Request doesn't have a body in the usual sense, so rawBody can be passed as an empty string
    // or the query string could be extracted if the processor expected it.
    // But our DummyPaymentProcessor.handleWebhook parses the URL from request.url itself
    const result = await processor.handleWebhook(request, '');

    paymentIdForErrorHandling = result.paymentId; // Save for logging the error in the DB

    if (!result.processed) {
      debug('Dummy webhook processing failed by processor:', result.error);
      // Attempt to update the payment status to error if paymentId is known
      if (result.paymentId && result.error) {
        const hasura = new Hasura({
          url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
          secret: process.env.HASURA_ADMIN_SECRET!
        });
        await hasura.v1({
          type: 'update',
          args: {
            table: 'payments',
            where: { id: { _eq: result.paymentId } },
            _set: {
              status: 'failed',
              error_message: `Webhook processing error: ${result.error}`,
              provider_response_details: { webhook_result: result }
            }
          }
        });
      }
      return NextResponse.json({ error: result.error || 'Webhook not processed' }, { status: 400 });
    }

    // If the webhook was processed successfully, update the record in our DB
    if (result.paymentId && result.newPaymentStatus) {
      const hasura = new Hasura({
        url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
        secret: process.env.HASURA_ADMIN_SECRET!
      });

      const updateSet: any = {
        status: result.newPaymentStatus,
        provider_response_details: { webhook_result: result } // Log the webhook result
      };

      if (result.newPaymentStatus === 'succeeded') {
        updateSet.paid_at = new Date().toISOString();
      }
      if (result.error) { // If the processor returned an error but processed (processed: true)
        updateSet.error_message = result.error;
      }

      debug(`Updating payment ${result.paymentId} to status ${result.newPaymentStatus}`);
      await hasura.v1({
        type: 'update',
        args: {
          table: 'payments',
          where: { id: { _eq: result.paymentId } },
          _set: updateSet
        }
      });

      // TODO: If this is part of a subscription, perhaps the subscription status also needs to be updated
      if (result.subscriptionId && result.newSubscriptionStatus) {
        debug(`Updating subscription ${result.subscriptionId} to status ${result.newSubscriptionStatus}`);
        // ...subscription update logic...
      }

      // In a real application, there might be a redirect to a success/failure page here
      // return NextResponse.redirect(new URL('/payment-status?payment_id=' + result.paymentId, request.url));
      return NextResponse.json({
        message: `Payment ${result.paymentId} status updated to ${result.newPaymentStatus}.`,
        details: result
      });
    } else {
      debug('Webhook processed, but no paymentId or newPaymentStatus provided by processor.');
      // This is a strange situation, but it's better to return OK if the processor said it handled it
      return NextResponse.json({ message: 'Webhook processed by dummy, but no specific action taken.', details: result });
    }

  } catch (error) {
    debug('[DUMMY_WEBHOOK_ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process dummy webhook';
    if (paymentIdForErrorHandling) {
      try {
        const hasura = new Hasura({
          url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
          secret: process.env.HASURA_ADMIN_SECRET!
        });
        await hasura.v1({
          type: 'update',
          args: {
            table: 'payments',
            where: { id: { _eq: paymentIdForErrorHandling } },
            _set: {
              status: 'failed',
              error_message: `Webhook handling exception: ${errorMessage}`
            }
          }
        });
      } catch (dbError) {
        debug('[DUMMY_WEBHOOK_DB_ERROR_ON_FAIL]', dbError);
      }
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 