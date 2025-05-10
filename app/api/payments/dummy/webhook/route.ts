import { NextResponse } from 'next/server';
import { DummyPaymentProcessor } from '@/lib/payments/dummy';
import { Hasura } from '@/lib/hasura';
import Debug from '@/lib/debug';

const debug = Debug('api:payments:dummy:webhook');
const processor = new DummyPaymentProcessor({ baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000' });

// Dummy webhook обрабатывает GET запросы, так как мы симулируем редирект на него
export async function GET(request: Request) {
  debug('Dummy webhook received request:', request.url);
  let paymentIdForErrorHandling: string | undefined;

  try {
    // Вызываем обработчик вебхука из процессора
    // Для GET запроса в Request нет body в привычном понимании, поэтому rawBody можно передать как пустую строку
    // или извлечь query string, если бы процессор ожидал этого.
    // Но наш DummyPaymentProcessor.handleWebhook парсит URL из самого request.url
    const result = await processor.handleWebhook(request, ''); 

    paymentIdForErrorHandling = result.paymentId; // Сохраняем для логирования ошибки в БД

    if (!result.processed) {
      debug('Dummy webhook processing failed by processor:', result.error);
      // Можно попытаться обновить статус платежа на ошибку, если известен paymentId
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

    // Если вебхук успешно обработан, обновляем запись в нашей БД
    if (result.paymentId && result.newPaymentStatus) {
      const hasura = new Hasura({
        url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
        secret: process.env.HASURA_ADMIN_SECRET!
      });

      const updateSet: any = {
        status: result.newPaymentStatus,
        provider_response_details: { webhook_result: result } // Логируем результат вебхука
      };

      if (result.newPaymentStatus === 'succeeded') {
        updateSet.paid_at = new Date().toISOString();
      }
      if (result.error) { // Если процессор вернул ошибку, но обработал (processed: true)
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
      
      // TODO: Если это часть подписки, возможно, нужно обновить и статус подписки
      if (result.subscriptionId && result.newSubscriptionStatus) {
        debug(`Updating subscription ${result.subscriptionId} to status ${result.newSubscriptionStatus}`);
        // ...логика обновления подписки...
      }

      // В реальном приложении здесь может быть редирект на страницу успеха/неудачи
      // return NextResponse.redirect(new URL('/payment-status?payment_id=' + result.paymentId, request.url));
      return NextResponse.json({ 
        message: `Payment ${result.paymentId} status updated to ${result.newPaymentStatus}.`, 
        details: result 
      });
    } else {
      debug('Webhook processed, but no paymentId or newPaymentStatus provided by processor.');
      // Это странная ситуация, но лучше вернуть OK, если процессор сказал, что обработал
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