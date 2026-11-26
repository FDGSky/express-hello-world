import type { Organization, ChatMessage, AuditLogEntry } from '../../shared/types.js';

export const SEED_ORGANIZATIONS: Organization[] = [
  {
    id: 'org_cleaning_01',
    slug: 'cleaning',
    name: 'BrightNest Pro Cleaning',
    industry: 'cleaning',
    tagline: 'Eco-Friendly Residential & Commercial Cleaning • Greater Miami & Orlando, FL',
    phoneNumber: '+1 (305) 555-0148',
    accentColor: '#38bdf8',
    brandGuidelines:
      'Tone: Warm, punctual, transparent, and upbeat. Always emphasize eco-friendly EPA-certified supplies, insured staff, and 24-hour satisfaction guarantee. Use USD ($), EST (UTC-5), and US date format (MM/DD/YYYY). Never promise unauthorized discounts above 10% or discuss Real Estate properties.',
    pricingCatalog:
      'Standard 2BR/1BA Clean = $115 USD | Deep Clean 3BR/2BA = $185 USD (includes eco-supplies, baseboards & inside oven) | Move-In/Move-Out Full Clean = $260 USD | Commercial Office Refresh = $195 USD. Strict Policy: Maximum promo discount is 10% for first-time clients only.',
    calendarSlots:
      'Friday 10:00 AM EST (Crew #2), Saturday 9:00 AM EST (Crew #1), Monday 2:00 PM EST (Crew #3)',
    forbiddenTopics:
      'Real estate listings, condos, mortgages, HOA down payments, home sales, or discounts greater than 10%.',
    approvalMode: 'baa',
    minJuryScore: 80,
    sensitiveKeywords: ['discount', 'refund', 'damage', 'complaint', 'free', 'lawsuit', 'cancel', '50%', '30%', '25%'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'org_realestate_01',
    slug: 'real_estate',
    name: 'Keystone Crest Realty',
    industry: 'real_estate',
    tagline: 'Boutique Residential & Investment Real Estate • South Florida (EST)',
    phoneNumber: '+1 (305) 555-0192',
    accentColor: '#a78bfa',
    brandGuidelines:
      'Tone: Consultative, polished, trustworthy, and Fair Housing compliant. Always quote official MLS figures in USD ($), schedule tours in EST (UTC-5) with US date format (MM/DD/YYYY), and remind clients that formal offers require written agreement. Never negotiate price drops over SMS or discuss cleaning services.',
    pricingCatalog:
      'Brickell Bay 2BR/2BA Condo = $485,000 USD (20% down required by HOA) | Coral Gables 4BR/3BA Pool Home = $895,000 USD (Move-in ready) | Doral 3BR/2.5BA Modern Townhouse = $535,000 USD. Strict Policy: Listing prices are firm over SMS (0% discount via text); formal offers must be submitted in writing.',
    calendarSlots:
      'Tomorrow 4:00 PM EST (Advisor Laura), Thursday 11:00 AM EST (Advisor Marco), Saturday 3:00 PM EST (Advisor Sofia)',
    forbiddenTopics:
      'House cleaning packages, maid services, janitorial pricing, or verbal price discounts over SMS.',
    approvalMode: 'auto_pilot',
    minJuryScore: 82,
    sensitiveKeywords: ['discount', 'contract', 'escrow', 'earnest', 'deposit', 'complaint', 'commission', 'offer', 'legal', '20%', '25%'],
    createdAt: new Date().toISOString(),
  },
];

export const SEED_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_seed_clean_1',
    organizationId: 'org_cleaning_01',
    orgSlug: 'cleaning',
    sender: 'agent',
    text: 'Hi! Welcome to BrightNest Pro Cleaning (+1 305-555-0148). Text us your home size, send photos of any room, or ask for our EST availability!',
    badge: 'BrightNest Pro Cleaning • Official SMS',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'msg_seed_realty_1',
    organizationId: 'org_realestate_01',
    orgSlug: 'real_estate',
    sender: 'agent',
    text: 'Welcome to Keystone Crest Realty (+1 305-555-0192). Ask about our active South Florida listings, send floorplans or pre-approval docs, or book an EST private tour.',
    badge: 'Keystone Crest Realty • Official SMS',
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
];

export const SEED_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit_seed_1',
    organizationId: null,
    ticketCode: null,
    actor: 'System HQ',
    action: 'OFFICE_BOOT',
    detail: 'Mini Office AI initialized with 2 isolated businesses (BrightNest Pro Cleaning & Keystone Crest Realty), Security Desk, and 4-LLM Jury.',
    level: 'success',
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
];
