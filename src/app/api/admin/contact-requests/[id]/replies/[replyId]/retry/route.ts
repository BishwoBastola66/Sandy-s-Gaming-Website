import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getEmailAdapter } from '@/lib/email/adapter';
import { generateInquiryReplyEmail } from '@/lib/email/template';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

interface RouteParams {
  params: Promise<{ id: string; replyId: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id, replyId } = await params;
  const { errorResponse, profile } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  const adminClient = await createAdminClient();

  // 1. Fetch target inquiry
  const { data: inquiry, error: inqError } = await adminClient
    .from('contact_inquiries')
    .select('id, name, email, phone, message, status, created_at')
    .eq('id', id)
    .single();

  if (inqError || !inquiry) {
    return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
  }

  // 2. Fetch target reply
  const { data: reply, error: replyError } = await adminClient
    .from('contact_inquiry_replies')
    .select('*')
    .eq('id', replyId)
    .eq('inquiry_id', id)
    .single();

  if (replyError || !reply) {
    return NextResponse.json({ error: 'Reply record not found' }, { status: 404 });
  }

  // 3. Safeguard: Prevent re-sending already accepted/sent emails (Duplicate prevention)
  if (['accepted', 'sent', 'delivered'].includes(reply.email_delivery_status)) {
    return NextResponse.json(
      {
        error: `Email has already been accepted/sent by provider (Status: ${reply.email_delivery_status}). Retries are disabled to prevent duplicate customer emails.`,
      },
      { status: 400 }
    );
  }

  // 4. Rate-limit / throttle retries (max 5 retries)
  const currentRetryCount = reply.retry_count ?? 0;
  if (currentRetryCount >= 5) {
    return NextResponse.json(
      {
        error: 'Maximum retry limit (5 attempts) exceeded for this reply. Please check your provider configuration or compose a new response.',
      },
      { status: 429 }
    );
  }

  try {
    const emailAdapter = getEmailAdapter();
    const template = generateInquiryReplyEmail({
      recipientName: inquiry.name,
      inquiryDate: new Date(inquiry.created_at).toLocaleDateString(),
      originalMessage: inquiry.message,
      responseBody: reply.body,
      staffName: profile.display_name || 'Support Staff',
    });

    const retryIdempotencyKey = `retry_${reply.id}_${currentRetryCount + 1}`;

    const sendResult = await emailAdapter.send({
      to: inquiry.email,
      toName: inquiry.name,
      subject: template.subject,
      html: template.html,
      text: template.text,
      replyTo: process.env.EMAIL_FROM_ADDRESS || 'support@sandygamings.com',
      idempotencyKey: retryIdempotencyKey,
    });

    const newSentAt = sendResult.success ? new Date().toISOString() : reply.sent_at;
    let newDeliveryStatus: import('@/types/database').EmailDeliveryStatus = sendResult.status;

    // Resilient update: Try with full columns first, gracefully fallback if migration 10 not yet applied
    let updatedReply = null;

    const fullUpdates = {
      email_delivery_status: newDeliveryStatus,
      provider_message_id: sendResult.providerMessageId || reply.provider_message_id,
      last_delivery_error: sendResult.error || null,
      retry_count: currentRetryCount + 1,
      last_attempted_at: new Date().toISOString(),
      sent_at: newSentAt,
    };

    const fullRes = await adminClient
      .from('contact_inquiry_replies')
      .update(fullUpdates)
      .eq('id', replyId)
      .select()
      .single();

    if (!fullRes.error && fullRes.data) {
      updatedReply = fullRes.data;
    } else {
      if (['accepted', 'queued'].includes(newDeliveryStatus)) {
        newDeliveryStatus = 'sent';
      }

      const fallbackRes = await adminClient
        .from('contact_inquiry_replies')
        .update({
          email_delivery_status: newDeliveryStatus as 'pending' | 'sent' | 'failed',
          provider_message_id: sendResult.providerMessageId || reply.provider_message_id,
          last_delivery_error: sendResult.error || null,
          sent_at: newSentAt,
        })
        .eq('id', replyId)
        .select()
        .single();

      if (fallbackRes.error || !fallbackRes.data) {
        return NextResponse.json(
          { error: sanitizeErrorMessage(fallbackRes.error, 'Failed to update reply record.') },
          { status: 500 }
        );
      }
      updatedReply = fallbackRes.data;
    }

    // 5. Record retry audit event
    await adminClient.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'INQUIRY_REPLY_RETRIED',
      target_type: 'contact_inquiry_reply',
      target_id: replyId,
      metadata: {
        inquiryId: id,
        attemptNumber: currentRetryCount + 1,
        deliveryStatus: sendResult.status,
        provider: sendResult.provider,
        providerMessageId: sendResult.providerMessageId,
      },
    });

    return NextResponse.json({
      success: sendResult.success,
      isConfigured: sendResult.isConfigured,
      provider: sendResult.provider,
      status: sendResult.status,
      message: sendResult.isConfigured
        ? sendResult.success
          ? `Retry successful! Email accepted by ${sendResult.provider}.`
          : `Retry failed via ${sendResult.provider}: ${sendResult.error}`
        : 'Provider unconfigured in server environment.',
      error: sendResult.error,
      reply: updatedReply,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Unable to retry email dispatch right now.') },
      { status: 500 }
    );
  }
}
