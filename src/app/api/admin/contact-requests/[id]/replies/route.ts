import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getEmailAdapter } from '@/lib/email/adapter';
import { generateInquiryReplyEmail } from '@/lib/email/template';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';
import { z } from 'zod';

const createReplySchema = z.object({
  body: z.string().trim().min(2, 'Reply message cannot be empty').max(5000),
  idempotencyKey: z.string().trim().max(100).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { errorResponse, profile } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  try {
    const json = await request.json();
    const parsed = createReplySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid reply' }, { status: 400 });
    }

    const { body, idempotencyKey } = parsed.data;
    const adminClient = await createAdminClient();

    // 1. Fetch and authorize target inquiry
    const { data: inquiry, error: inqError } = await adminClient
      .from('contact_inquiries')
      .select('id, name, email, phone, message, status, created_at')
      .eq('id', id)
      .single();

    if (inqError || !inquiry) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    // 2. Idempotency Guard: Prevent duplicate submissions
    if (idempotencyKey) {
      try {
        const { data: existingReply } = await adminClient
          .from('contact_inquiry_replies')
          .select('*')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();

        if (existingReply) {
          return NextResponse.json({
            success: true,
            message: 'Idempotent request: Reply already recorded previously.',
            reply: existingReply,
            isDuplicate: true,
          });
        }
      } catch {
        // Fallback duplicate check if idempotency_key column not in DB yet
        const { data: recentReplies } = await adminClient
          .from('contact_inquiry_replies')
          .select('*')
          .eq('inquiry_id', id)
          .eq('body', body)
          .order('created_at', { ascending: false })
          .limit(1);

        if (recentReplies && recentReplies.length > 0) {
          const timeDiff = Date.now() - new Date(recentReplies[0].created_at).getTime();
          if (timeDiff < 30000) {
            return NextResponse.json({
              success: true,
              message: 'Duplicate detected within 30s. Previous reply returned.',
              reply: recentReplies[0],
              isDuplicate: true,
            });
          }
        }
      }
    }

    // 3. Initialize email adapter
    const emailAdapter = getEmailAdapter();
    const template = generateInquiryReplyEmail({
      recipientName: inquiry.name,
      inquiryDate: new Date(inquiry.created_at).toLocaleDateString(),
      originalMessage: inquiry.message,
      responseBody: body,
      staffName: profile.display_name || 'Support Staff',
    });

    // 4. Dispatch through email adapter
    const sendResult = await emailAdapter.send({
      to: inquiry.email,
      toName: inquiry.name,
      subject: template.subject,
      html: template.html,
      text: template.text,
      replyTo: process.env.EMAIL_FROM_ADDRESS || 'support@sandygamings.com',
      idempotencyKey,
    });

    // 5. Determine delivery status
    // Maps provider statuses ('accepted', 'queued') to 'sent' if older DB constraint applies
    let dbStatus: import('@/types/database').EmailDeliveryStatus = sendResult.status;
    const sentAt = sendResult.success ? new Date().toISOString() : null;

    // Resilient insert: Try with full columns first, gracefully fallback if migration 10 not yet applied
    let reply = null;

    const basePayload = {
      inquiry_id: id,
      admin_id: profile.id,
      body,
      provider_message_id: sendResult.providerMessageId || null,
      last_delivery_error: sendResult.error || null,
      sent_at: sentAt,
    };

    // Attempt 1: Full payload with new migration columns
    const fullRes = await adminClient
      .from('contact_inquiry_replies')
      .insert({
        ...basePayload,
        email_delivery_status: dbStatus,
        idempotency_key: idempotencyKey || null,
        retry_count: 0,
        last_attempted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (!fullRes.error && fullRes.data) {
      reply = fullRes.data;
    } else {
      // Fallback: If status check constraint failed, map accepted/queued -> sent
      if (['accepted', 'queued'].includes(dbStatus)) {
        dbStatus = 'sent';
      }

      // Attempt 2: Insert with baseline columns
      const fallbackRes = await adminClient
        .from('contact_inquiry_replies')
        .insert({
          ...basePayload,
          email_delivery_status: dbStatus as 'pending' | 'sent' | 'failed',
        })
        .select()
        .single();

      if (fallbackRes.error || !fallbackRes.data) {
        return NextResponse.json(
          { error: sanitizeErrorMessage(fallbackRes.error, 'Failed to save reply record.') },
          { status: 500 }
        );
      }
      reply = fallbackRes.data;
    }

    // 6. Update inquiry status to 'replied'
    await adminClient
      .from('contact_inquiries')
      .update({
        status: 'replied',
        replied_at: new Date().toISOString(),
      })
      .eq('id', id);

    // 7. Record structured audit event
    await adminClient.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'INQUIRY_REPLIED',
      target_type: 'contact_inquiry',
      target_id: id,
      metadata: {
        replyId: reply.id,
        deliveryStatus: sendResult.status,
        provider: sendResult.provider,
        providerMessageId: sendResult.providerMessageId,
        isConfigured: sendResult.isConfigured,
      },
    });

    return NextResponse.json({
      success: sendResult.success || !sendResult.isConfigured,
      isConfigured: sendResult.isConfigured,
      provider: sendResult.provider,
      status: sendResult.status,
      message: sendResult.isConfigured
        ? sendResult.success
          ? `Response dispatched successfully via ${sendResult.provider}.`
          : `Dispatch failed via ${sendResult.provider}: ${sendResult.error}`
        : 'Draft saved. Email provider is unconfigured in server environment.',
      error: sendResult.error,
      reply,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Unable to dispatch reply right now.') },
      { status: 500 }
    );
  }
}
