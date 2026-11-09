import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { contactFormSchema } from '@/lib/validation/contact';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // 1. IP extraction & Anti-Spam Rate Limiting (5 requests per 60 seconds per IP)
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  const rateCheck = checkRateLimit(`contact:${ip}`, 5, 60 * 1000);
  if (!rateCheck.success) {
    const retrySec = Math.ceil((rateCheck.reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: `Too many submissions. Please wait ${retrySec} seconds before trying again.` },
      {
        status: 429,
        headers: {
          'Retry-After': String(retrySec),
          'X-RateLimit-Limit': String(rateCheck.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateCheck.reset),
        },
      }
    );
  }

  try {
    const body = await request.json();

    // 2. Anti-spam honeypot check: If the hidden honeypot field is populated, silently reject
    if (body.honeypot && body.honeypot.length > 0) {
      return NextResponse.json(
        { error: 'Submission rejected by anti-spam verification.' },
        { status: 400 }
      );
    }

    // 3. Strict schema validation & field normalization
    const parsed = contactFormSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'Invalid form submission';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { name, email, phone, message } = parsed.data;

    // 4. Save to contact_inquiries table
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const hasValidServiceKey = Boolean(
      serviceRoleKey &&
      !serviceRoleKey.startsWith('your-') &&
      serviceRoleKey.length > 50
    );

    let createdId: string | undefined = undefined;

    if (hasValidServiceKey) {
      const adminClient = await createAdminClient();
      const { data: inquiry, error: insertError } = await adminClient
        .from('contact_inquiries')
        .insert({
          name: name || null,
          email,
          phone,
          message,
          status: 'new', // Always initialized to 'new'
        })
        .select('id, created_at')
        .single();

      if (insertError || !inquiry) {
        console.error('Failed to insert contact inquiry with adminClient:', insertError);
        return NextResponse.json(
          { error: 'Unable to submit your inquiry right now. Please try again shortly.' },
          { status: 500 }
        );
      }
      createdId = inquiry.id;
    } else {
      const serverClient = await createClient();
      const { error: insertError } = await serverClient
        .from('contact_inquiries')
        .insert({
          name: name || null,
          email,
          phone,
          message,
          status: 'new',
        });

      if (insertError) {
        console.error('Failed to insert contact inquiry with serverClient:', insertError);
        return NextResponse.json(
          { error: 'Unable to submit your inquiry right now. Please try again shortly.' },
          { status: 500 }
        );
      }
    }

    // 5. Success response (No auth user, no conversation, no message created)
    return NextResponse.json(
      {
        success: true,
        message: 'Your inquiry has been received. Our team will review your message and reply via email.',
        inquiryId: createdId,
      },
      {
        status: 201,
        headers: {
          'X-RateLimit-Limit': String(rateCheck.limit),
          'X-RateLimit-Remaining': String(rateCheck.remaining),
        },
      }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Invalid request payload.') },
      { status: 400 }
    );
  }
}
