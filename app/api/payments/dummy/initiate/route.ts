import { NextResponse } from 'next/server';
import { DummyPaymentProcessor } from '@/lib/payments/dummy';
import { PaymentDetailsArgs } from '@/lib/payments/base';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from "next-auth/next"
import authOptions from "@/app/options"
import { Hasura } from '@/lib/hasura'; // Для записи в БД
import Debug from '@/lib/debug';

const debug = Debug('api:payments:dummy:initiate');
const processor = new DummyPaymentProcessor({ baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000' });

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

    const paymentId = uuidv4(); // Генерируем наш внутренний ID платежа
    paymentIdForErrorHandling = paymentId; // Сохраняем для возможной обработки ошибок
    const userId = session.user.id;

    // 1. Создаем запись о платеже в нашей БД со статусом 'pending_initiation'
    const hasura = new Hasura({
        url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
        secret: process.env.HASURA_ADMIN_SECRET!
    }); 
    const createPaymentArgs = {
        id: paymentId,
        user_id: userId,
        provider_name: processor.providerName,
        amount: amount,
        currency: currency,
        status: 'pending_initiation',
        object_hid: objectHid,
        description: description || `Payment for ${objectHid}`,
        initiated_at: new Date().toISOString(),
        payment_method_id: paymentMethodId || null,
        metadata: metadata || null,
    };
    debug('Creating payment record in DB:', createPaymentArgs);
    await hasura.v1({
        type: 'insert',
        args: {
            table: 'payments',
            objects: [createPaymentArgs]
        }
    });

    // 2. Инициируем платеж через процессор
    const paymentArgs: PaymentDetailsArgs = {
      amount,
      currency,
      objectHid,
      userId,
      paymentId, // Передаем наш ID
      description: description || `Payment for ${objectHid}`,
      returnUrl: returnUrl || process.env.NEXT_PUBLIC_MAIN_URL || '/',
      paymentMethodId,
      metadata
    };

    const result = await processor.initiatePayment(paymentArgs);

    // 3. Обновляем статус платежа в БД (если нужно, например, external_payment_id)
    if (result.externalPaymentId || result.status !== 'pending_initiation') {
        await hasura.v1({
            type: 'update',
            args: {
                table: 'payments',
                where: { id: { _eq: paymentId } },
                _set: {
                    status: result.status,
                    external_payment_id: result.externalPaymentId,
                    provider_response_details: result.providerResponse
                }
            }
        });
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to initiate dummy payment';
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
                        error_message: `Initiation failed: ${errorMessage}`
                    }
                }
            });
        } catch (dbError) {
            debug('[DUMMY_INITIATE_DB_ERROR_ON_FAIL]', dbError);
        }
    }
    return NextResponse.json({ error: errorMessage, paymentId: paymentIdForErrorHandling }, { status: 500 });
  }
} 