import type {
  AttachmentRecord,
  JurorId,
  JurorVerdict,
  JurorVote,
  Organization,
} from '../../shared/types.js';

interface OpenRouterMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

let dailyAiCalls = 0;
let lastResetDay = new Date().toISOString().slice(0, 10);

export function getAiUsageStats() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastResetDay) {
    dailyAiCalls = 0;
    lastResetDay = today;
  }
  const budget = Number(process.env.DAILY_AI_BUDGET_CALLS || 200);
  return {
    dailyAiCalls,
    dailyAiBudget: budget,
    liveOpenRouter: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
  };
}

const JUROR_CONFIGS: Array<{ id: JurorId; name: string; envKey: string; defaultModel: string }> = [
  { id: 'claude', name: 'Claude (Brand Guardian)', envKey: 'MODEL_JURY_CLAUDE', defaultModel: 'anthropic/claude-3.5-haiku' },
  { id: 'gemini', name: 'Gemini (Context & Vision)', envKey: 'MODEL_JURY_GEMINI', defaultModel: 'google/gemini-2.0-flash-001' },
  { id: 'gpt', name: 'GPT (Tone & Clarity)', envKey: 'MODEL_JURY_GPT', defaultModel: 'openai/gpt-4o-mini' },
  { id: 'deepseek', name: 'DeepSeek (Policy Auditor)', envKey: 'MODEL_JURY_DEEPSEEK', defaultModel: 'deepseek/deepseek-chat' },
];

async function callOpenRouter(
  model: string,
  systemPrompt: string,
  userContent: string | OpenRouterMessageContent[],
  jsonMode = false
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const stats = getAiUsageStats();
  if (!apiKey || stats.dailyAiCalls >= stats.dailyAiBudget) {
    return null;
  }

  dailyAiCalls++;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://mini-office-ai.onrender.com',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'Mini Office AI',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(22000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[OpenRouter] ${model} failed (${res.status}): ${errText.slice(0, 180)}`);
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.warn(`[OpenRouter] ${model} exception:`, (err as Error).message);
    return null;
  }
}

export async function generateSupportDraft(params: {
  org: Organization;
  otherOrg: Organization;
  customerMessage: string;
  attachments: AttachmentRecord[];
  extractedFileNotes: string[];
  bossInstruction?: string;
}): Promise<{ draft: string; extractedFacts: string; simulated: boolean }> {
  const { org, customerMessage, attachments, extractedFileNotes, bossInstruction } = params;
  const supportModel = process.env.MODEL_SUPPORT_AGENT || 'openai/gpt-4o-mini';

  const systemPrompt = `You are the Reception & Customer Support AI for ${org.name} (${org.tagline}).
Always respond in polished American English using USD ($), EST (UTC-5), and US date format (MM/DD/YYYY).
Keep replies concise (2-4 sentences, SMS-friendly).
Brand Guidelines: ${org.brandGuidelines}
Official Pricing & Services: ${org.pricingCatalog}
Available EST Calendar Slots: ${org.calendarSlots}
STRICT FORBIDDEN TOPICS (Never discuss or quote): ${org.forbiddenTopics}
${bossInstruction ? `\nMANDATORY BOSS INSTRUCTION: ${bossInstruction}` : ''}`;

  const contentParts: OpenRouterMessageContent[] = [
    {
      type: 'text',
      text: `Customer SMS: "${customerMessage}"\n${
        extractedFileNotes.length > 0 ? `Verified Attachments:\n${extractedFileNotes.join('\n')}` : ''
      }\nDraft a helpful, brand-aligned SMS reply.`,
    },
  ];

  // Attach verified images for multimodal vision models
  for (const att of attachments) {
    if (att.verdict !== 'blocked' && att.previewDataUrl) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: att.previewDataUrl },
      });
    }
  }

  const liveReply = await callOpenRouter(supportModel, systemPrompt, contentParts, false);
  if (liveReply) {
    return {
      draft: liveReply,
      extractedFacts: `${org.name} KB verified • Slots: ${org.calendarSlots.split(',')[0]}`,
      simulated: false,
    };
  }

  // Smart deterministic fallback when OPENROUTER_API_KEY is not configured yet
  const lower = customerMessage.toLowerCase();
  const hasAttachment = attachments.length > 0;
  const hasImage = attachments.some((a) => a.detectedType.startsWith('image/'));
  const firstSlot = org.calendarSlots.split(',')[0]?.trim() || 'Friday 10:00 AM EST';

  let draft = '';
  if (org.slug === 'cleaning') {
    const wantsCrossBiz = /(condo|brickell|real estate|villa|townhouse|mortgage|house for sale)/i.test(lower);
    const wantsBigDiscount = /(50%|40%|30%|25%|free|half off)/i.test(lower);

    if (wantsCrossBiz || wantsBigDiscount) {
      draft = `Hi! Thank you for texting BrightNest Pro Cleaning. We exclusively handle eco-friendly residential & commercial cleaning—our 3BR/2BA Deep Clean is $185 USD (first-time clients may receive up to 10% off max). We have an opening ${firstSlot}; would you like us to reserve that spot?`;
    } else if (hasImage) {
      draft = `Thanks for sending the photo! Based on the room details you shared with BrightNest Pro Cleaning, we recommend our Deep Clean 3BR/2BA package at $185 USD (eco-friendly EPA-certified supplies included). Our next available slot is ${firstSlot}—shall we lock that in?`;
    } else if (hasAttachment) {
      draft = `Thanks for sharing your file with BrightNest Pro Cleaning! We reviewed your details and can accommodate your service with our Standard Clean ($115 USD) or Deep Clean ($185 USD). Would ${firstSlot} work for our insured crew?`;
    } else if (/move|office|commercial/i.test(lower)) {
      draft = `Hi from BrightNest Pro Cleaning! Our Move-In/Move-Out Full Clean is $260 USD and our Commercial Office Refresh is $195 USD, backed by our 24-hour satisfaction guarantee. We can send a crew ${firstSlot}—would you like to book?`;
    } else {
      draft = `Hi! Thanks for reaching out to BrightNest Pro Cleaning. Our Standard 2BR/1BA Clean is $115 USD and our 3BR/2BA Deep Clean is $185 USD (all eco-friendly supplies included). We have availability ${firstSlot}—would you like us to hold that slot?`;
    }
  } else {
    const wantsCrossBiz = /(clean|maid|housekeeping|mop|janitor|deep clean)/i.test(lower);
    const wantsBigDiscount = /(discount|25%|20%|50%|cheaper|drop the price)/i.test(lower);

    if (wantsCrossBiz || wantsBigDiscount) {
      draft = `Hello from Keystone Crest Realty! We specialize exclusively in South Florida real estate. Official MLS listing prices (such as our Brickell Bay 2BR Condo at $485,000 USD) are firm over SMS, and formal offers must be submitted in writing. Would you like to schedule a private tour ${firstSlot}?`;
    } else if (hasAttachment) {
      draft = `Thank you for sending your document/photo to Keystone Crest Realty! Our advisor has logged your attachment for review alongside our active listings (Brickell 2BR Condo at $485,000 USD, Doral Townhouse at $535,000 USD). Shall we confirm a private tour ${firstSlot}?`;
    } else if (/coral gables|villa|pool|4br/i.test(lower)) {
      draft = `Welcome to Keystone Crest Realty! Our Coral Gables 4BR/3BA Pool Home is currently listed at $895,000 USD and is move-in ready. We have a private viewing available ${firstSlot}—would you like to reserve it?`;
    } else {
      draft = `Welcome to Keystone Crest Realty! Our Brickell Bay 2BR/2BA Condo is listed at $485,000 USD (20% HOA down payment required) and our Doral 3BR Townhouse is $535,000 USD. We can arrange a private tour ${firstSlot}—does that time work for you?`;
    }
  }

  if (bossInstruction) {
    draft = `${draft} (Updated per Boss note: ${bossInstruction})`;
  }

  return {
    draft,
    extractedFacts: `${org.name} isolated catalog loaded • Next EST slot: ${firstSlot}`,
    simulated: true,
  };
}

export async function runFourModelJury(params: {
  org: Organization;
  otherOrg: Organization;
  customerMessage: string;
  draftReply: string;
  hasAttachments: boolean;
}): Promise<JurorVerdict[]> {
  const { org, otherOrg, customerMessage, draftReply, hasAttachments } = params;

  const systemPrompt = `You are a strict AI Compliance & Coherence Juror auditing an outgoing SMS draft for ${org.name}.
Evaluate TWO dimensions (0-100 each):
1. brandScore: Does the draft strictly follow ${org.name}'s Brand Guidelines, USD pricing, EST timezone, and NEVER leak forbidden topics from ${otherOrg.name} (${org.forbiddenTopics})?
2. contextScore: Does the draft accurately and directly answer the customer's SMS message and attachments?

Return STRICT JSON only:
{
  "brandScore": number,
  "contextScore": number,
  "vote": "approve" | "revise" | "escalate",
  "reasoning": "1 crisp sentence explaining your verdict",
  "suggestedFix": "optional improved reply if vote is revise, else empty string"
}`;

  const userPrompt = `Company: ${org.name}
Brand Guidelines: ${org.brandGuidelines}
Official Pricing: ${org.pricingCatalog}
Forbidden Cross-Business Info: ${otherOrg.pricingCatalog}
Customer SMS: "${customerMessage}" ${hasAttachments ? '(Included verified file/image attachment)' : ''}
Proposed Draft Reply: "${draftReply}"`;

  const verdicts = await Promise.all(
    JUROR_CONFIGS.map(async (juror, idx): Promise<JurorVerdict> => {
      const modelId = process.env[juror.envKey] || juror.defaultModel;
      const raw = await callOpenRouter(modelId, systemPrompt, userPrompt, true);

      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            brandScore?: number;
            contextScore?: number;
            vote?: JurorVote;
            reasoning?: string;
            suggestedFix?: string;
          };
          const brandScore = Math.max(0, Math.min(100, Math.round(parsed.brandScore ?? 85)));
          const contextScore = Math.max(0, Math.min(100, Math.round(parsed.contextScore ?? 85)));
          const overallScore = Math.round((brandScore + contextScore) / 2);
          const vote: JurorVote =
            parsed.vote === 'approve' || parsed.vote === 'revise' || parsed.vote === 'escalate'
              ? parsed.vote
              : overallScore >= org.minJuryScore
                ? 'approve'
                : 'escalate';

          return {
            jurorId: juror.id,
            jurorName: juror.name,
            modelId,
            brandScore,
            contextScore,
            overallScore,
            vote,
            reasoning: parsed.reasoning || 'Audited against company guidelines and chat context.',
            suggestedFix: parsed.suggestedFix || undefined,
            simulated: false,
          };
        } catch {
          // Fall through to deterministic evaluator if model returned malformed JSON
        }
      }

      // Smart Simulation Fallback (realistic per-model variance & policy checks)
      const lowerMsg = customerMessage.toLowerCase();
      const lowerDraft = draftReply.toLowerCase();
      const sensitiveHit = org.sensitiveKeywords.some((kw) => lowerMsg.includes(kw.toLowerCase()));
      const hasDollar = lowerDraft.includes('$');
      const mentionsBrand = lowerDraft.includes(org.name.split(' ')[0].toLowerCase());

      // Slight deterministic variance per juror so the 4 models feel genuinely distinct
      const offsets = [2, 0, -1, -3];
      let brandScore = (mentionsBrand ? 91 : 78) + offsets[idx];
      let contextScore = (hasDollar || draftReply.length > 50 ? 90 : 76) + offsets[(idx + 1) % 4];

      if (sensitiveHit) {
        brandScore -= 12;
        contextScore -= 8;
      }

      brandScore = Math.max(40, Math.min(99, brandScore));
      contextScore = Math.max(40, Math.min(99, contextScore));
      const overallScore = Math.round((brandScore + contextScore) / 2);

      let vote: JurorVote = 'approve';
      let reasoning = '';

      if (sensitiveHit && (juror.id === 'deepseek' || juror.id === 'claude')) {
        vote = 'escalate';
        reasoning =
          juror.id === 'claude'
            ? `Brand tone is compliant, but customer requested a sensitive/policy-restricted item; recommend Boss sign-off.`
            : `Policy trigger detected in customer request; escalating to Regional Boss to confirm terms.`;
      } else if (overallScore < org.minJuryScore) {
        vote = 'escalate';
        reasoning = `Consensus score (${overallScore}/100) is below the ${org.minJuryScore} threshold; Boss review required.`;
      } else {
        const notes: Record<JurorId, string> = {
          claude: `Maintains ${org.name} voice, USD pricing, and strict tenant isolation.`,
          gemini: hasAttachments
            ? 'Properly incorporates verified attachment context and EST scheduling.'
            : 'Context matches customer inquiry and EST calendar availability.',
          gpt: 'Clear, polite, SMS-length response with zero ambiguity.',
          deepseek: 'Zero cross-company leakage; discount and policy constraints respected.',
        };
        reasoning = notes[juror.id];
      }

      return {
        jurorId: juror.id,
        jurorName: juror.name,
        modelId: `${modelId} (Sim)`,
        brandScore,
        contextScore,
        overallScore,
        vote,
        reasoning,
        simulated: true,
      };
    })
  );

  return verdicts;
}
