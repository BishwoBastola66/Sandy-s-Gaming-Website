import { Metadata } from 'next';
import { ContactFormClient } from './ContactFormClient';
import { Mail, Clock, MessageSquare, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contact & 24/7 Support',
  description:
    "Send an inquiry to Sandy's Gaming for account assistance, gaming platform questions, or 24/7 customer support. No login required.",
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: "Contact & 24/7 Support | Sandy's Gaming",
    description:
      "Send an inquiry to Sandy's Gaming for account assistance, gaming platform questions, or 24/7 customer support.",
    url: '/contact',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Contact & 24/7 Support | Sandy's Gaming",
    description:
      "Send an inquiry to Sandy's Gaming for account assistance, gaming platform questions, or 24/7 customer support.",
  },
};

export default function ContactPage() {
  return (
    <div className="w-full max-w-[1720px] mx-auto px-4 py-12 sm:px-8 lg:px-12 xl:px-16">
      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3.5 py-1 text-xs font-semibold text-[var(--brand-primary)] mb-3">
          <Mail className="h-3.5 w-3.5" />
          <span>Guest Inquiry Desk</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-4xl">
          Get in Touch with Our Team
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
          Have a question about our high-performance setups, events, or reservations? Submit your inquiry below. No account or login required.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Public Contact Form (7 cols) */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl glass-elevated p-6 sm:p-8">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">
              Send a Message
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mb-6">
              Fill out the form below. All fields marked with an asterisk (<span className="text-[var(--brand-primary)]">*</span>) are required.
            </p>

            <ContactFormClient />
          </div>
        </div>

        {/* Right Column: Support Context & Live Chat Upsell (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Authenticated Chat Notice */}
          <div className="rounded-3xl glass-elevated p-6 relative overflow-hidden">
            <div
              className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--brand-primary)]/[0.08] blur-2xl rounded-full pointer-events-none"
              aria-hidden="true"
            />
            <div className="relative z-10 flex items-start gap-3.5">
              <div className="rounded-xl bg-[var(--brand-primary)] p-2.5 text-white shrink-0 mt-0.5 shadow-[0_0_16px_rgba(215,25,50,0.35)]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Looking for Real-Time Support?
                </h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                  Active customer account holders can access our dedicated Live Chat portal
                  for real-time instant messaging with support staff.
                </p>
                <div className="mt-3">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                  >
                    <span>Sign in for Live Chat</span>
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Response Expectations */}
          <div className="rounded-3xl glass-elevated p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Support Information
            </h3>

            <div className="space-y-3.5 text-xs text-[var(--text-secondary)]">
              <div className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-[var(--brand-primary)] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[var(--text-primary)]">Response Time:</span>{' '}
                  Our staff reviews incoming inquiries during operational hours and responds via email within 24 hours.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[var(--text-primary)]">Privacy Protected:</span>{' '}
                  Guest contact inquiries are strictly private and accessible only to authorized staff.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
