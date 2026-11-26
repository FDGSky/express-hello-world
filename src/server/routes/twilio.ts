import { Router, type Request, type Response } from 'express';
import { processIncomingCustomerMessage } from '../services/pipeline.js';

export const twilioRouter = Router();

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Real Twilio SMS Webhook (US A2P 10DLC ready)
 * Configure your Twilio phone number Messaging webhook to:
 *   POST https://<your-render-url>/api/webhooks/twilio/sms
 */
twilioRouter.post('/sms', async (req: Request, res: Response) => {
  try {
    const fromPhone = String(req.body?.From || '+1 (000) 000-0000');
    const toPhone = String(req.body?.To || '');
    const bodyText = String(req.body?.Body || '').trim();

    const realtyPhone = process.env.TWILIO_PHONE_REALESTATE?.trim();
    const orgSlug = realtyPhone && toPhone === realtyPhone ? 'real_estate' : 'cleaning';

    const ticket = await processIncomingCustomerMessage({
      orgSlug,
      customerName: `SMS ${fromPhone}`,
      customerPhone: fromPhone,
      messageText: bodyText || '[Empty SMS]',
      channel: 'twilio_sms',
      files: [],
    });

    res.type('text/xml');
    if (ticket.status === 'auto_sent' && ticket.finalReply) {
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(ticket.finalReply)}</Message></Response>`);
      return;
    }

    // In BAA or escalated mode, hold reply until Boss approves in web/iPhone app
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (err) {
    console.error('[Twilio Webhook] Error:', err);
    res.status(500).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
});
