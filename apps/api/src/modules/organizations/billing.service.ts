import Stripe from 'stripe';
import { env } from '@/config/env';
import { AppError, ValidationError } from '@/middleware/errorHandler';
import { Organization } from './organization.model';
import type { OrganizationPlan } from '@/types';

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

export async function createCheckoutSession(input: {
    organizationId: string;
    organizationName: string;
    plan: Exclude<OrganizationPlan, 'free'>;
}): Promise<{ checkoutUrl: string; provider: 'stripe'; sessionId: string }> {
    if (!stripe) throw new ValidationError('Stripe is not configured');

    const priceId = input.plan === 'pro' ? env.STRIPE_PRO_PRICE_ID : env.STRIPE_ENTERPRISE_PRICE_ID;
    if (!priceId) throw new ValidationError(`Stripe price ID is missing for ${input.plan}`);

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${env.FRONTEND_URL}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.FRONTEND_URL}/settings?billing=cancelled`,
        client_reference_id: input.organizationId,
        metadata: {
            organizationId: input.organizationId,
            plan: input.plan,
            organizationName: input.organizationName,
        },
    });

    if (!session.url)
        throw new AppError('Stripe did not return a checkout URL', 502, 'STRIPE_CHECKOUT_FAILED');

    return {
        checkoutUrl: session.url,
        provider: 'stripe',
        sessionId: session.id,
    };
}

export async function handleStripeWebhook(rawBody: Buffer, signature?: string): Promise<void> {
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
        throw new ValidationError('Stripe webhook is not configured');
    }
    if (!signature) throw new ValidationError('Stripe signature is required');

    const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const organizationId = session.metadata?.organizationId || session.client_reference_id;
        const plan = session.metadata?.plan as OrganizationPlan | undefined;
        if (!organizationId || !plan) return;

        await Organization.findByIdAndUpdate(organizationId, {
            $set: {
                plan,
                billingCustomerId:
                    typeof session.customer === 'string' ? session.customer : session.customer?.id,
                subscriptionStatus: 'active',
            },
        });
    }

    if (
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
    ) {
        const subscription = event.data.object as any;
        const customerId =
            typeof subscription.customer === 'string'
                ? subscription.customer
                : subscription.customer.id;
        await Organization.findOneAndUpdate(
            { billingCustomerId: customerId },
            {
                $set: {
                    subscriptionStatus:
                        event.type === 'customer.subscription.deleted'
                            ? 'canceled'
                            : mapStripeSubscriptionStatus(subscription.status),
                    currentPeriodEnd: new Date(
                        (subscription.current_period_end ??
                            subscription.items?.data?.[0]?.current_period_end ??
                            Math.floor(Date.now() / 1000)) * 1000
                    ),
                },
            }
        );
    }
}

function mapStripeSubscriptionStatus(status: string) {
    if (status === 'trialing') return 'trialing';
    if (status === 'active') return 'active';
    if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'past_due';
    return 'canceled';
}
