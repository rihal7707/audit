import dns from 'node:dns/promises';
import net from 'node:net';
import { normalizeUserWebsiteInput } from '@/lib/validation/url-normalize';

export { normalizeUserWebsiteInput };

export class UrlGuardError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'UrlGuardError';
    this.code = code;
  }
}

export interface UrlGuardOptions {
  /**
   * Test-only escape hatch for local fixture servers.
   * Strictly inert unless process.env.NODE_ENV === 'test'.
   */
  allowLocalTestFixture?: boolean;
  /**
   * Optional DNS lookup function override for deterministic unit testing.
   */
  dnsLookup?: (
    hostname: string,
  ) => Promise<Array<{ address: string; family: 4 | 6 }>>;
}

export interface StaticUrlValidationResult {
  normalizedUrl: string;
  protocol: 'http:' | 'https:';
  hostname: string;
  port: string;
  isIpLiteral: boolean;
  origin: string;
  registrableDomain: string;
}

export interface ValidatedUrlResult extends StaticUrlValidationResult {
  pinnedIp: string;
  pinnedFamily: 4 | 6;
  resolvedAddresses: Array<{ address: string; family: 4 | 6 }>;
}

const BLOCKED_HOSTNAMES = new Set<string>([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'instance-data',
]);

const BLOCKED_SUFFIXES = [
  '.local',
  '.localhost',
  '.internal',
  '.lan',
  '.home.arpa',
  '.localdomain',
] as const;

const MULTI_LABEL_PUBLIC_SUFFIXES = new Set<string>([
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'me.uk',
  'com.au',
  'net.au',
  'org.au',
  'edu.au',
  'co.nz',
  'org.nz',
  'co.za',
  'com.br',
  'com.sg',
  'com.my',
  'co.in',
  'co.jp',
  'ne.jp',
  'or.jp',
  'com.mx',
  'com.ae',
]);

// Re-exported from @/lib/validation/url-normalize

export function getRegistrableDomain(hostname: string): string {
  const clean = hostname.toLowerCase().replace(/\.+$/, '');
  if (net.isIP(clean) !== 0) return clean;
  const parts = clean.split('.').filter(Boolean);
  if (parts.length <= 2) return clean;
  const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  if (MULTI_LABEL_PUBLIC_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return `${parts[parts.length - 3]}.${lastTwo}`;
  }
  return lastTwo;
}

function isTestEscapeHatchActive(options?: UrlGuardOptions): boolean {
  return process.env.NODE_ENV === 'test' && options?.allowLocalTestFixture === true;
}

function isLocalFixtureTarget(hostOrIp: string): boolean {
  const clean = hostOrIp.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  return clean === '127.0.0.1' || clean === '::1' || clean === 'localhost' || clean.endsWith('.test');
}

function isNonStandardNumericHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/\.+$/, '');
  if (!host || host.startsWith('[')) return false;

  // Single integer decimal or hex (e.g. 2130706433 or 0x7f000001)
  if (/^(0x[0-9a-f]+|0[0-7]*|[1-9][0-9]*)$/.test(host)) {
    return true;
  }

  // Dotted parts where all parts look numeric (catches octal 0177.0.0.1, hex 0x7f.0.0.1, shortened 127.1)
  const parts = host.split('.');
  if (parts.length >= 2 && parts.length <= 4) {
    const allNumericLike = parts.every((p) => /^(0x[0-9a-f]+|0[0-7]*|[0-9]+)$/i.test(p));
    if (allNumericLike) {
      // Standard dotted decimal has 4 parts with no leading zeroes (except '0') and each <= 255
      const isCanonicalIpv4 =
        parts.length === 4 &&
        parts.every((p) => /^(0|[1-9][0-9]{0,2})$/.test(p) && Number(p) <= 255);
      if (!isCanonicalIpv4) {
        return true;
      }
    }
  }

  return false;
}

function parseIpv4ToUint32(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^(0|[1-9][0-9]{0,2})$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    result = ((result << 8) | n) >>> 0;
  }
  return result;
}

function inIpv4Cidr(ipNum: number, base: string, prefixLen: number): boolean {
  const baseNum = parseIpv4ToUint32(base);
  if (baseNum === null) return false;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

export function isPrivateOrReservedIpv4(ip: string): boolean {
  const num = parseIpv4ToUint32(ip);
  if (num === null) return true;
  return (
    inIpv4Cidr(num, '0.0.0.0', 8) || // Unspecified / "this" network
    inIpv4Cidr(num, '10.0.0.0', 8) || // RFC1918
    inIpv4Cidr(num, '100.64.0.0', 10) || // CGNAT RFC6598 (includes 100.100.100.200)
    inIpv4Cidr(num, '127.0.0.0', 8) || // Loopback
    inIpv4Cidr(num, '169.254.0.0', 16) || // Link-local & cloud metadata
    inIpv4Cidr(num, '172.16.0.0', 12) || // RFC1918
    inIpv4Cidr(num, '192.0.0.0', 24) || // IETF protocol assignments
    inIpv4Cidr(num, '192.0.2.0', 24) || // TEST-NET-1
    inIpv4Cidr(num, '192.88.99.0', 24) || // 6to4 relay anycast
    inIpv4Cidr(num, '192.168.0.0', 16) || // RFC1918
    inIpv4Cidr(num, '198.18.0.0', 15) || // Benchmarking
    inIpv4Cidr(num, '198.51.100.0', 24) || // TEST-NET-2
    inIpv4Cidr(num, '203.0.113.0', 24) || // TEST-NET-3
    inIpv4Cidr(num, '224.0.0.0', 4) || // Multicast
    inIpv4Cidr(num, '240.0.0.0', 4) // Reserved / Broadcast
  );
}

function expandIpv6ToHextets(rawIp: string): number[] | null {
  let ip = rawIp.trim().toLowerCase();
  if (ip.startsWith('[') && ip.endsWith(']')) {
    ip = ip.slice(1, -1);
  }
  const zoneIdx = ip.indexOf('%');
  if (zoneIdx !== -1) {
    ip = ip.slice(0, zoneIdx);
  }

  // Handle embedded dotted IPv4 tail if present
  const lastColon = ip.lastIndexOf(':');
  if (lastColon !== -1 && ip.slice(lastColon + 1).includes('.')) {
    const v4Part = ip.slice(lastColon + 1);
    const v4Num = parseIpv4ToUint32(v4Part);
    if (v4Num === null) return null;
    const hi = ((v4Num >>> 16) & 0xffff).toString(16);
    const lo = (v4Num & 0xffff).toString(16);
    ip = `${ip.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const doubleColonParts = ip.split('::');
  if (doubleColonParts.length > 2) return null;

  let head: string[] = [];
  let tail: string[] = [];

  if (doubleColonParts.length === 2) {
    head = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
    tail = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
    const missing = 8 - (head.length + tail.length);
    if (missing < 1) return null;
    const expanded = [...head, ...Array(missing).fill('0'), ...tail];
    return parseHextetArray(expanded);
  }

  const parts = ip.split(':');
  if (parts.length !== 8) return null;
  return parseHextetArray(parts);
}

function parseHextetArray(parts: string[]): number[] | null {
  if (parts.length !== 8) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^[0-9a-f]{1,4}$/i.test(p)) return null;
    out.push(parseInt(p, 16));
  }
  return out;
}

export function isPrivateOrReservedIpv6(ip: string): boolean {
  const hextets = expandIpv6ToHextets(ip);
  if (!hextets) return true;

  const h0 = hextets[0] ?? 0;
  const h1 = hextets[1] ?? 0;
  const h2 = hextets[2] ?? 0;
  const h3 = hextets[3] ?? 0;
  const h4 = hextets[4] ?? 0;
  const h5 = hextets[5] ?? 0;
  const h6 = hextets[6] ?? 0;
  const h7 = hextets[7] ?? 0;

  const allZeroPrefix5 = h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0;

  // ::/128 (unspecified) and ::1/128 (loopback)
  if (allZeroPrefix5 && h5 === 0 && h6 === 0 && (h7 === 0 || h7 === 1)) {
    return true;
  }

  // Reject all IPv4-compatible (::/96) and IPv4-mapped (::ffff:0:0/96) literals
  if (allZeroPrefix5 && (h5 === 0 || h5 === 0xffff)) {
    return true;
  }

  // Reject ::ffff:0:0:0/96 (IPv4-translated)
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0xffff && h5 === 0) {
    return true;
  }

  // fc00::/7 (Unique local addresses, includes fd00::/8)
  if ((h0 & 0xfe00) === 0xfc00) {
    return true;
  }

  // fe80::/10 (Link-local) and fec0::/10 (Site-local deprecated)
  if ((h0 & 0xffc0) === 0xfe80 || (h0 & 0xffc0) === 0xfec0) {
    return true;
  }

  // ff00::/8 (Multicast)
  if ((h0 & 0xff00) === 0xff00) {
    return true;
  }

  // 2001:db8::/32 (Documentation)
  if (h0 === 0x2001 && h1 === 0x0db8) {
    return true;
  }

  // 100::/64 (Discard-only)
  if (h0 === 0x0100 && h1 === 0 && h2 === 0 && h3 === 0) {
    return true;
  }

  // 64:ff9b::/96 and 64:ff9b:1::/48 (NAT64)
  if (h0 === 0x0064 && h1 === 0xff9b && (h2 === 0 || h2 === 1)) {
    return true;
  }

  // 2002::/16 (6to4 embedding IPv4 in h1, h2)
  if (h0 === 0x2002) {
    const v4 = `${(h1 >> 8) & 0xff}.${h1 & 0xff}.${(h2 >> 8) & 0xff}.${h2 & 0xff}`;
    if (isPrivateOrReservedIpv4(v4)) return true;
  }

  // Teredo 2001:0000::/32
  if (h0 === 0x2001 && h1 === 0x0000) {
    return true;
  }

  return false;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, '').split('%')[0] ?? '';
  const family = net.isIP(clean);
  if (family === 4) return isPrivateOrReservedIpv4(clean);
  if (family === 6) return isPrivateOrReservedIpv6(clean);
  return true;
}

function extractRawAuthorityHost(rawUrl: string): string {
  const afterScheme = rawUrl.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
  const authority = afterScheme.split(/[/?#]/)[0] ?? '';
  if (authority.includes('@')) {
    throw new UrlGuardError('EMBEDDED_CREDENTIALS', 'URLs with embedded credentials are not allowed.');
  }
  if (authority.startsWith('[')) {
    const endBracket = authority.indexOf(']');
    if (endBracket === -1) return authority;
    return authority.slice(0, endBracket + 1);
  }
  const colonIdx = authority.indexOf(':');
  return colonIdx === -1 ? authority : authority.slice(0, colonIdx);
}

export function validateUrlStatic(
  rawUrl: string,
  options?: UrlGuardOptions,
): StaticUrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new UrlGuardError('EMPTY_URL', 'Please enter a website URL.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new UrlGuardError('INVALID_URL', 'Please enter a valid http or https website URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UrlGuardError('INVALID_PROTOCOL', 'Only http and https URLs are supported.');
  }

  if (parsed.username !== '' || parsed.password !== '') {
    throw new UrlGuardError('EMBEDDED_CREDENTIALS', 'URLs with embedded credentials are not allowed.');
  }

  const rawHost = extractRawAuthorityHost(trimmed);
  const escapeActive = isTestEscapeHatchActive(options);

  if (!escapeActive && parsed.port !== '' && parsed.port !== '80' && parsed.port !== '443') {
    throw new UrlGuardError('INVALID_PORT', 'Only standard web ports (80 and 443) are allowed.');
  }

  if (!escapeActive && isNonStandardNumericHost(rawHost)) {
    throw new UrlGuardError('NUMERIC_HOST_BLOCKED', 'Non-standard numeric IP hostnames are not allowed.');
  }

  // Strip fragment and normalize hostname trailing dot
  parsed.hash = '';
  const cleanHostname = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  if (!cleanHostname) {
    throw new UrlGuardError('INVALID_HOST', 'Website hostname is missing.');
  }

  // Update hostname without trailing dot
  parsed.hostname = cleanHostname;

  if (!escapeActive || !isLocalFixtureTarget(cleanHostname)) {
    if (BLOCKED_HOSTNAMES.has(cleanHostname)) {
      throw new UrlGuardError('BLOCKED_HOST', 'This hostname cannot be inspected.');
    }
    for (const suffix of BLOCKED_SUFFIXES) {
      if (cleanHostname.endsWith(suffix)) {
        throw new UrlGuardError('BLOCKED_HOST_SUFFIX', 'Internal or local network hostnames are not allowed.');
      }
    }
  }

  const rawUnbracketed = cleanHostname.replace(/^\[|\]$/g, '');
  const ipFamily = net.isIP(rawUnbracketed);
  const isIpLiteral = ipFamily !== 0;

  if (isIpLiteral) {
    if ((!escapeActive || !isLocalFixtureTarget(rawUnbracketed)) && isPrivateOrReservedIp(rawUnbracketed)) {
      throw new UrlGuardError('PRIVATE_IP_BLOCKED', 'Private, loopback, or reserved IP addresses are not allowed.');
    }
  } else if ((!escapeActive || !isLocalFixtureTarget(cleanHostname)) && !cleanHostname.includes('.')) {
    throw new UrlGuardError('SINGLE_LABEL_HOST', 'Single-label hostnames are not allowed.');
  }

  const origin = parsed.origin;
  const normalizedUrl = parsed.toString();

  return {
    normalizedUrl,
    protocol: parsed.protocol,
    hostname: cleanHostname,
    port: parsed.port,
    isIpLiteral,
    origin,
    registrableDomain: getRegistrableDomain(cleanHostname),
  };
}

export async function validateUrlWithDns(
  rawUrl: string,
  options?: UrlGuardOptions,
): Promise<ValidatedUrlResult> {
  const staticResult = validateUrlStatic(rawUrl, options);
  const escapeActive = isTestEscapeHatchActive(options);
  const rawHost = staticResult.hostname.replace(/^\[|\]$/g, '');

  if (staticResult.isIpLiteral) {
    const family = net.isIP(rawHost) as 4 | 6;
    if ((!escapeActive || !isLocalFixtureTarget(rawHost)) && isPrivateOrReservedIp(rawHost)) {
      throw new UrlGuardError('PRIVATE_IP_BLOCKED', 'Private or reserved IP addresses are not allowed.');
    }
    return {
      ...staticResult,
      pinnedIp: rawHost,
      pinnedFamily: family,
      resolvedAddresses: [{ address: rawHost, family }],
    };
  }

  const lookupFn =
    options?.dnsLookup ??
    (async (hostname: string) => {
      const records = await dns.lookup(hostname, { all: true, verbatim: true });
      return records.map((r) => ({
        address: r.address,
        family: (r.family === 6 ? 6 : 4) as 4 | 6,
      }));
    });

  let records: Array<{ address: string; family: 4 | 6 }>;
  try {
    records = await lookupFn(staticResult.hostname);
  } catch {
    throw new UrlGuardError('DNS_RESOLUTION_FAILED', 'Could not resolve the website domain name.');
  }

  if (!records || records.length === 0) {
    throw new UrlGuardError('DNS_RESOLUTION_FAILED', 'No DNS records found for this hostname.');
  }

  if (!escapeActive || !isLocalFixtureTarget(staticResult.hostname)) {
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        throw new UrlGuardError(
          'DNS_RESOLVED_PRIVATE_IP',
          'Domain resolved to a private or reserved network address.',
        );
      }
    }
  } else {
    for (const rec of records) {
      if (!isLocalFixtureTarget(rec.address) && isPrivateOrReservedIp(rec.address)) {
        throw new UrlGuardError(
          'DNS_RESOLVED_PRIVATE_IP',
          'Domain resolved to a private or reserved network address.',
        );
      }
    }
  }

  const preferred = records.find((r) => r.family === 4) ?? records[0]!;
  return {
    ...staticResult,
    pinnedIp: preferred.address,
    pinnedFamily: preferred.family,
    resolvedAddresses: records,
  };
}
