import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: import.meta.env.UPSTASH_REDIS_REST_URL,
    token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
  }),
  limiter: Ratelimit.slidingWindow(3, '1 h'),
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    const email = (body as Record<string, unknown>)?.email;

    if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400 });
    }

    const ip = clientAddress ?? '127.0.0.1';
    const { success } = await ratelimit.limit(ip);

    if (!success) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 });
    }

    // Check if email already on waitlist
    const { data, error } = await resend.contacts.get({email});
    const alreadyJoined = data && !error;
    if (alreadyJoined) {
      return new Response(JSON.stringify({ error: 'already_joined' }), { status: 409 });
    }

    // Add to audience
    await resend.contacts.create({ email, unsubscribed: false });

    const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? 'https://blisp.vercel.app';

    await resend.emails.send({
      from: 'Blisp <noreply@resend.dev>',
      to: email,
      subject: "You're on the Blisp waitlist!",
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're on the Blisp waitlist!</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:36px 40px 28px;">
              <img src="${siteUrl}/logo.png" alt="blisp" width="48" height="48" style="display:block;margin:0 auto 12px;" />
              <span style="font-size:22px;font-weight:700;color:#f5f0e8;letter-spacing:-0.5px;">blisp</span>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="height:1px;background:#2a2a2a;"></td></tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 32px;">
              <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#f5f0e8;line-height:1.2;">
                You're on the list. 🎉
              </h1>
              <p style="margin:0 0 16px;font-size:15px;color:#a0a0a0;line-height:1.7;">
                Thanks for joining the Blisp waitlist. You're one step closer to waking up every morning knowing <em style="color:#f5f0e8;">exactly</em> what to build.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#a0a0a0;line-height:1.7;">
                Here's what Blisp does for you:
              </p>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;">
                    <span style="color:#e05c2d;font-size:15px;margin-right:10px;">🎙️</span>
                    <span style="font-size:14px;color:#c0c0c0;">Voice-dump your ideas anytime</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;">
                    <span style="color:#e05c2d;font-size:15px;margin-right:10px;">🔍</span>
                    <span style="font-size:14px;color:#c0c0c0;">AI researches and structures them overnight</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <span style="color:#e05c2d;font-size:15px;margin-right:10px;">✅</span>
                    <span style="font-size:14px;color:#c0c0c0;">Wake up to a ready-to-execute daily plan</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 28px;font-size:15px;color:#a0a0a0;line-height:1.7;">
                We'll reach out as soon as early access opens. No spam — just one email when it's your turn.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#e05c2d;border-radius:9999px;padding:13px 28px;">
                    <a href="${siteUrl}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:block;">
                      Learn more about Blisp →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr><td style="height:1px;background:#2a2a2a;"></td></tr>
          <tr>
            <td style="padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#555;">
                © ${new Date().getFullYear()} Blisp. All rights reserved.<br />
                You're receiving this because you signed up at <a href="${siteUrl}" style="color:#777;text-decoration:none;">${siteUrl.replace(/^https?:\/\//, '')}</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};