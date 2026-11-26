import crypto from 'node:crypto';
import type {
  AttachmentRecord,
  SecurityCheckDetail,
  SecurityScanRecord,
  SecurityVerdict,
} from '../../shared/types.js';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.vbe', '.js', '.jse',
  '.ps1', '.psm1', '.msi', '.msp', '.dll', '.sys', '.sh', '.bash', '.apk', '.dmg',
  '.pkg', '.jar', '.hta', '.iso', '.lnk', '.reg', '.docm', '.xlsm', '.pptm',
]);

const SUSPICIOUS_TLDS = new Set([
  '.ru', '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.zip', '.mov', '.click', '.work',
]);

const URL_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rb.gy', 'cutt.ly',
]);

const EICAR_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export interface UploadedFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface SecurityGuardOutput {
  overallVerdict: SecurityVerdict;
  attachments: AttachmentRecord[];
  scans: SecurityScanRecord[];
  extractedFileNotes: string[];
}

function detectMagicType(buf: Buffer): { type: string; isExecutable: boolean; isImage: boolean; isPdf: boolean } {
  if (buf.length >= 4) {
    // Windows PE executable (MZ)
    if (buf[0] === 0x4d && buf[1] === 0x5a) {
      return { type: 'application/x-dosexec (Windows PE)', isExecutable: true, isImage: false, isPdf: false };
    }
    // Linux ELF
    if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) {
      return { type: 'application/x-elf (Linux Binary)', isExecutable: true, isImage: false, isPdf: false };
    }
    // PNG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return { type: 'image/png', isExecutable: false, isImage: true, isPdf: false };
    }
    // JPEG
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return { type: 'image/jpeg', isExecutable: false, isImage: true, isPdf: false };
    }
    // GIF
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
      return { type: 'image/gif', isExecutable: false, isImage: true, isPdf: false };
    }
    // WEBP (RIFF....WEBP)
    if (
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { type: 'image/webp', isExecutable: false, isImage: true, isPdf: false };
    }
    // PDF (%PDF)
    if (buf.subarray(0, 4).toString('ascii') === '%PDF') {
      return { type: 'application/pdf', isExecutable: false, isImage: false, isPdf: true };
    }
    // ZIP / DOCX / XLSX
    if (buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05)) {
      return { type: 'application/zip-or-office', isExecutable: false, isImage: false, isPdf: false };
    }
  }

  // Check if script text
  const head = buf.subarray(0, 256).toString('utf-8').trimStart();
  if (
    head.startsWith('#!') ||
    /<script[\s>]/i.test(head) ||
    /powershell\s+-/i.test(head)
  ) {
    return { type: 'text/x-script (Embedded Script)', isExecutable: true, isImage: false, isPdf: false };
  }

  return { type: 'text/plain', isExecutable: false, isImage: false, isPdf: false };
}

function extractUrls(text: string): string[] {
  const regex = /(?:https?:\/\/|www\.)[^\s<>"')]+/gi;
  const matches = text.match(regex) ?? [];
  return [...new Set(matches.map((u) => (u.startsWith('http') ? u : `https://${u}`)))];
}

async function checkVirusTotalHash(sha256: string): Promise<SecurityCheckDetail> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
  if (!apiKey) {
    return {
      engine: 'VirusTotal v3 (File Hash)',
      status: 'skipped',
      detail: 'VIRUSTOTAL_API_KEY not configured (local magic-byte + EICAR shield active).',
    };
  }
  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
      headers: { 'x-apikey': apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) {
      return {
        engine: 'VirusTotal v3 (File Hash)',
        status: 'pass',
        detail: 'Hash not flagged in VirusTotal malware database.',
      };
    }
    if (!res.ok) {
      return {
        engine: 'VirusTotal v3 (File Hash)',
        status: 'warn',
        detail: `VirusTotal returned HTTP ${res.status}.`,
      };
    }
    const data = (await res.json()) as {
      data?: { attributes?: { last_analysis_stats?: { malicious?: number; suspicious?: number } } };
    };
    const stats = data.data?.attributes?.last_analysis_stats;
    const malicious = stats?.malicious ?? 0;
    const suspicious = stats?.suspicious ?? 0;
    if (malicious > 0) {
      return {
        engine: 'VirusTotal v3 (File Hash)',
        status: 'fail',
        detail: `BLOCKED: ${malicious} antivirus engines flagged this file hash as malicious.`,
      };
    }
    if (suspicious > 0) {
      return {
        engine: 'VirusTotal v3 (File Hash)',
        status: 'warn',
        detail: `${suspicious} engines marked this file as suspicious.`,
      };
    }
    return {
      engine: 'VirusTotal v3 (File Hash)',
      status: 'pass',
      detail: 'Clean across VirusTotal AV engines (0 detections).',
    };
  } catch (err) {
    return {
      engine: 'VirusTotal v3 (File Hash)',
      status: 'warn',
      detail: `VirusTotal timeout/error: ${(err as Error).message}`,
    };
  }
}

async function checkVirusTotalUrl(url: string): Promise<SecurityCheckDetail> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
  if (!apiKey) {
    return {
      engine: 'VirusTotal v3 (URL)',
      status: 'skipped',
      detail: 'VIRUSTOTAL_API_KEY not configured (URLhaus + heuristic shield active).',
    };
  }
  try {
    const urlId = Buffer.from(url).toString('base64url');
    const res = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { 'x-apikey': apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) {
      return {
        engine: 'VirusTotal v3 (URL)',
        status: 'pass',
        detail: 'URL not listed in VirusTotal threat feed.',
      };
    }
    if (!res.ok) {
      return {
        engine: 'VirusTotal v3 (URL)',
        status: 'warn',
        detail: `VirusTotal URL lookup HTTP ${res.status}.`,
      };
    }
    const data = (await res.json()) as {
      data?: { attributes?: { last_analysis_stats?: { malicious?: number; suspicious?: number } } };
    };
    const malicious = data.data?.attributes?.last_analysis_stats?.malicious ?? 0;
    const suspicious = data.data?.attributes?.last_analysis_stats?.suspicious ?? 0;
    if (malicious > 0) {
      return {
        engine: 'VirusTotal v3 (URL)',
        status: 'fail',
        detail: `BLOCKED: ${malicious} security vendors flagged URL as malicious/phishing.`,
      };
    }
    if (suspicious > 0) {
      return {
        engine: 'VirusTotal v3 (URL)',
        status: 'warn',
        detail: `${suspicious} vendors marked URL as suspicious.`,
      };
    }
    return {
      engine: 'VirusTotal v3 (URL)',
      status: 'pass',
      detail: 'URL verified clean by VirusTotal.',
    };
  } catch (err) {
    return {
      engine: 'VirusTotal v3 (URL)',
      status: 'warn',
      detail: `VirusTotal URL check error: ${(err as Error).message}`,
    };
  }
}

async function checkUrlhaus(url: string): Promise<SecurityCheckDetail> {
  try {
    const body = new URLSearchParams({ url });
    const res = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) {
      return {
        engine: 'URLhaus (abuse.ch)',
        status: 'skipped',
        detail: `URLhaus API unavailable (HTTP ${res.status}).`,
      };
    }
    const data = (await res.json()) as { query_status?: string; threat?: string };
    if (data.query_status === 'ok') {
      return {
        engine: 'URLhaus (abuse.ch)',
        status: 'fail',
        detail: `BLOCKED: Listed in active malware feed (${data.threat ?? 'malware_download'}).`,
      };
    }
    return {
      engine: 'URLhaus (abuse.ch)',
      status: 'pass',
      detail: 'Not listed in active URLhaus malware feed.',
    };
  } catch {
    return {
      engine: 'URLhaus (abuse.ch)',
      status: 'skipped',
      detail: 'URLhaus check skipped (network timeout).',
    };
  }
}

function inspectUrlHeuristics(rawUrl: string): SecurityCheckDetail[] {
  const checks: SecurityCheckDetail[] = [];
  if (/^(javascript|data|vbscript|file):/i.test(rawUrl)) {
    checks.push({
      engine: 'Protocol Guard',
      status: 'fail',
      detail: 'Blocked dangerous URI scheme.',
    });
    return checks;
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();

    // Private/SSRF IP check
    if (
      host === 'localhost' ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
    ) {
      checks.push({
        engine: 'SSRF / Raw-IP Filter',
        status: 'fail',
        detail: `Blocked raw IP or internal host (${host}).`,
      });
    } else {
      checks.push({
        engine: 'SSRF / Raw-IP Filter',
        status: 'pass',
        detail: `Public hostname verified (${host}).`,
      });
    }

    // Punycode / Homograph spoofing
    if (host.includes('xn--')) {
      checks.push({
        engine: 'Homograph / Punycode Detector',
        status: 'fail',
        detail: 'Blocked internationalized punycode domain (high phishing risk).',
      });
    }

    // Phishing / malware keywords in demo URLs
    const lowerFull = rawUrl.toLowerCase();
    if (
      /(free-crypto|verify-bank|login-update|malware|phish|trojan|evil|payload|\.exe(\?|$)|\.scr(\?|$)|\.bat(\?|$))/i.test(
        lowerFull
      )
    ) {
      checks.push({
        engine: 'Phishing & Payload Heuristics',
        status: 'fail',
        detail: 'Detected high-risk phishing or executable download pattern in URL.',
      });
    } else if (URL_SHORTENERS.has(host) || [...SUSPICIOUS_TLDS].some((tld) => host.endsWith(tld))) {
      checks.push({
        engine: 'Domain Reputation Heuristics',
        status: 'warn',
        detail: `URL uses a shortener or high-risk TLD (${host}) — requires Boss review.`,
      });
    } else {
      checks.push({
        engine: 'Phishing & Payload Heuristics',
        status: 'pass',
        detail: 'No phishing, credential harvesting, or executable download patterns found.',
      });
    }
  } catch {
    checks.push({
      engine: 'URL Parser',
      status: 'warn',
      detail: 'Malformed URL detected.',
    });
  }

  return checks;
}

function summarizeVerdict(checks: SecurityCheckDetail[]): { verdict: SecurityVerdict; riskScore: number } {
  const fails = checks.filter((c) => c.status === 'fail').length;
  const warns = checks.filter((c) => c.status === 'warn').length;
  if (fails > 0) {
    return { verdict: 'blocked', riskScore: Math.min(100, 75 + fails * 15) };
  }
  if (warns > 0) {
    return { verdict: 'warning', riskScore: Math.min(70, 35 + warns * 15) };
  }
  return { verdict: 'safe', riskScore: 5 };
}

export async function runSecurityGuard(
  ticketId: string,
  messageText: string,
  files: UploadedFileInput[]
): Promise<SecurityGuardOutput> {
  const scans: SecurityScanRecord[] = [];
  const attachments: AttachmentRecord[] = [];
  const extractedFileNotes: string[] = [];
  let overallVerdict: SecurityVerdict = 'safe';

  // 1. Check message text for EICAR or embedded XSS/injection attempts
  const msgChecks: SecurityCheckDetail[] = [];
  if (messageText.includes(EICAR_SIGNATURE)) {
    msgChecks.push({
      engine: 'EICAR Antivirus Signature',
      status: 'fail',
      detail: 'BLOCKED: Standard EICAR antivirus test payload detected in message!',
    });
  } else if (/<script[\s>]|javascript:|onerror\s*=/i.test(messageText)) {
    msgChecks.push({
      engine: 'XSS / Script Injection Shield',
      status: 'fail',
      detail: 'BLOCKED: Embedded script / XSS payload detected in message.',
    });
  } else {
    msgChecks.push({
      engine: 'Message Payload Shield',
      status: 'pass',
      detail: 'No script injection or malicious text signatures detected.',
    });
  }

  const msgSummary = summarizeVerdict(msgChecks);
  scans.push({
    id: `scan_msg_${crypto.randomUUID().slice(0, 8)}`,
    ticketId,
    targetType: 'message',
    targetValue: messageText.slice(0, 120),
    verdict: msgSummary.verdict,
    riskScore: msgSummary.riskScore,
    checks: msgChecks,
    scannedAt: new Date().toISOString(),
  });
  if (msgSummary.verdict === 'blocked') overallVerdict = 'blocked';

  // 2. Scan all URLs found in message
  const urls = extractUrls(messageText);
  for (const url of urls) {
    const heuristics = inspectUrlHeuristics(url);
    const [urlhaus, vtUrl] = await Promise.all([checkUrlhaus(url), checkVirusTotalUrl(url)]);
    const allChecks = [...heuristics, urlhaus, vtUrl];
    const summary = summarizeVerdict(allChecks);

    scans.push({
      id: `scan_url_${crypto.randomUUID().slice(0, 8)}`,
      ticketId,
      targetType: 'url',
      targetValue: url,
      verdict: summary.verdict,
      riskScore: summary.riskScore,
      checks: allChecks,
      scannedAt: new Date().toISOString(),
    });

    if (summary.verdict === 'blocked') overallVerdict = 'blocked';
    else if (summary.verdict === 'warning' && overallVerdict !== 'blocked') overallVerdict = 'warning';
  }

  // 3. Scan every uploaded file
  for (const file of files) {
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const ext = file.originalname.includes('.')
      ? file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase()
      : '';
    const magic = detectMagicType(file.buffer);
    const checks: SecurityCheckDetail[] = [];

    // Size limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      checks.push({
        engine: 'Size & Zip-Bomb Limit',
        status: 'fail',
        detail: `File exceeds 10 MB limit (${(file.size / 1024 / 1024).toFixed(2)} MB).`,
      });
    } else {
      checks.push({
        engine: 'Size & Zip-Bomb Limit',
        status: 'pass',
        detail: `Size OK (${(file.size / 1024).toFixed(1)} KB).`,
      });
    }

    // Extension & Magic-byte spoofing check
    if (DANGEROUS_EXTENSIONS.has(ext) || magic.isExecutable) {
      checks.push({
        engine: 'Magic-Byte & Extension Inspector',
        status: 'fail',
        detail: `BLOCKED: Executable/script detected (ext: ${ext || 'none'}, magic: ${magic.type}).`,
      });
    } else if (file.mimetype.startsWith('image/') && !magic.isImage) {
      checks.push({
        engine: 'Magic-Byte & Extension Inspector',
        status: 'fail',
        detail: `BLOCKED: Spoofed image file! Claimed ${file.mimetype}, actual header is ${magic.type}.`,
      });
    } else {
      checks.push({
        engine: 'Magic-Byte & Extension Inspector',
        status: 'pass',
        detail: `Verified header (${magic.type}) matches safe file policy.`,
      });
    }

    // EICAR test check inside file
    const textSample = file.buffer.subarray(0, 4096).toString('utf-8');
    if (textSample.includes(EICAR_SIGNATURE)) {
      checks.push({
        engine: 'EICAR Antivirus Signature',
        status: 'fail',
        detail: 'BLOCKED: EICAR antivirus test signature detected inside attachment!',
      });
    }

    // VirusTotal hash lookup
    const vtFile = await checkVirusTotalHash(sha256);
    checks.push(vtFile);

    const summary = summarizeVerdict(checks);
    scans.push({
      id: `scan_file_${crypto.randomUUID().slice(0, 8)}`,
      ticketId,
      targetType: 'file',
      targetValue: `${file.originalname} (${sha256.slice(0, 12)}...)`,
      verdict: summary.verdict,
      riskScore: summary.riskScore,
      checks,
      scannedAt: new Date().toISOString(),
    });

    let previewDataUrl: string | undefined;
    if (summary.verdict !== 'blocked' && magic.isImage && file.size <= 2 * 1024 * 1024) {
      previewDataUrl = `data:${magic.type};base64,${file.buffer.toString('base64')}`;
      extractedFileNotes.push(`[Safe Image Attached: ${file.originalname}, ${magic.type}, ${(file.size / 1024).toFixed(1)} KB]`);
    } else if (summary.verdict !== 'blocked') {
      const snippet = magic.isPdf
        ? `[Safe PDF Document Attached: ${file.originalname}, ${(file.size / 1024).toFixed(1)} KB]`
        : `[Safe File Attached: ${file.originalname}] Content excerpt: ${textSample.slice(0, 400).replace(/\s+/g, ' ')}`;
      extractedFileNotes.push(snippet);
    }

    attachments.push({
      id: `att_${crypto.randomUUID().slice(0, 8)}`,
      filename: file.originalname,
      mimeType: file.mimetype,
      detectedType: magic.type,
      sizeBytes: file.size,
      sha256,
      previewDataUrl,
      verdict: summary.verdict,
      summary: checks.find((c) => c.status === 'fail')?.detail ?? checks[1]?.detail ?? 'Verified clean',
    });

    if (summary.verdict === 'blocked') overallVerdict = 'blocked';
    else if (summary.verdict === 'warning' && overallVerdict !== 'blocked') overallVerdict = 'warning';
  }

  return { overallVerdict, attachments, scans, extractedFileNotes };
}
