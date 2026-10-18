import { and, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  marketingSocialConnections,
  type MarketingSocialConnectionRow,
} from "../../shared/schema.js";
import {
  decryptMarketingAccessToken,
  encryptMarketingAccessToken,
} from "./metaMarketingConnection.js";

const LINKEDIN_PROVIDER = "linkedin";
const DEFAULT_LINKEDIN_VERSION = "202609";

type LinkedInError = {
  message?: string;
  serviceErrorCode?: number;
  status?: number;
};

type LinkedInTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
};

type LinkedInUserInfo = {
  sub?: unknown;
  name?: unknown;
  email?: unknown;
};

type LinkedInAcl = {
  role?: unknown;
  state?: unknown;
  organization?: unknown;
  organizationTarget?: unknown;
  roleAssignee?: unknown;
};

type LinkedInAclsResponse = {
  elements?: LinkedInAcl[];
};

export type LinkedInConnectionSummary = {
  id: string;
  provider: string;
  accountId: string;
  accountName: string;
  organizationUrn: string | null;
  organizationRole: string | null;
  memberUrn: string | null;
  memberName: string | null;
  memberEmail: string | null;
  status: string;
  connectedAt: string;
  updatedAt: string;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function linkedinErrorMessage(payload: LinkedInError, fallback: string) {
  return stringValue(payload.message) || fallback;
}

export function linkedInClientId() {
  return process.env.LINKEDIN_CLIENT_ID?.trim() || process.env.LINKEDIN_APP_ID?.trim() || "";
}

export function linkedInClientSecret() {
  return process.env.LINKEDIN_CLIENT_SECRET?.trim() || process.env.LINKEDIN_APP_SECRET?.trim() || "";
}

function linkedInApiVersion() {
  return process.env.LINKEDIN_API_VERSION?.trim() || DEFAULT_LINKEDIN_VERSION;
}

function linkedInScopes() {
  return (process.env.LINKEDIN_MARKETING_SCOPES?.trim() || "openid profile email r_organization_social w_organization_social")
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function grantedScopeSet(scope: string | null) {
  const scopes = scope?.trim() ? scope.split(/[,\s]+/) : linkedInScopes();
  return new Set(scopes.map((item) => item.trim()).filter(Boolean));
}

function hasOrganizationSocialScopes(scope: string | null) {
  const scopes = grantedScopeSet(scope);
  return scopes.has("r_organization_social") || scopes.has("w_organization_social");
}

export function linkedInOAuthRedirectUri() {
  const configured = process.env.LINKEDIN_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  const origin = process.env.VYVA_PUBLIC_URL?.trim() || process.env.APP_URL?.trim() || "http://localhost:5000";
  return `${origin.replace(/\/$/, "")}/api/admin/marketing/social-publishing/linkedin/callback`;
}

export function linkedInOAuthConfigured() {
  return Boolean(linkedInClientId() && linkedInClientSecret());
}

export function linkedInOAuthUrl(state: string) {
  if (!linkedInOAuthConfigured()) throw new Error("LinkedIn OAuth is not configured on the Admin deployment.");
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", linkedInClientId());
  url.searchParams.set("redirect_uri", linkedInOAuthRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", linkedInScopes().join(" "));
  return url.toString();
}

async function exchangeLinkedInCode(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: linkedInClientId(),
    client_secret: linkedInClientSecret(),
    redirect_uri: linkedInOAuthRedirectUri(),
  });
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => ({})) as LinkedInTokenResponse & LinkedInError;
  if (!response.ok || !stringValue(payload.access_token)) {
    throw new Error(linkedinErrorMessage(payload, `LinkedIn authorization failed with status ${response.status}.`));
  }
  return {
    accessToken: stringValue(payload.access_token)!,
    expiresAt: typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in)
      ? new Date(Date.now() + payload.expires_in * 1000)
      : null,
    scope: stringValue(payload.scope),
  };
}

async function linkedInUserInfo(accessToken: string) {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => ({})) as LinkedInUserInfo & LinkedInError;
  if (!response.ok) {
    return null;
  }
  return payload;
}

async function linkedInRestFetch<T>(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.linkedin.com/rest${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Linkedin-Version": linkedInApiVersion(),
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => ({})) as T & LinkedInError;
  if (!response.ok) {
    throw new Error(linkedinErrorMessage(payload, `LinkedIn request failed with status ${response.status}.`));
  }
  return payload;
}

function organizationIdFromEnv() {
  const configured = process.env.LINKEDIN_ORGANIZATION_URN?.trim()
    || process.env.LINKEDIN_ORGANIZATION_ID?.trim()
    || process.env.LINKEDIN_COMPANY_ID?.trim()
    || "";
  if (!configured) return null;
  return configured.startsWith("urn:li:organization:")
    ? configured
    : `urn:li:organization:${configured}`;
}

function preferredOrganizationName(organizationUrn: string) {
  return process.env.LINKEDIN_ORGANIZATION_NAME?.trim()
    || process.env.LINKEDIN_COMPANY_NAME?.trim()
    || `LinkedIn organization ${organizationUrn.replace("urn:li:organization:", "")}`;
}

function preferredMemberAccountName(userInfo: LinkedInUserInfo | null) {
  return stringValue(userInfo?.name)
    || stringValue(userInfo?.email)
    || process.env.LINKEDIN_ORGANIZATION_NAME?.trim()
    || "LinkedIn member";
}

function publishRoles() {
  return new Set(["ADMINISTRATOR", "CONTENT_ADMIN", "DIRECT_SPONSORED_CONTENT_POSTER"]);
}

async function authorizedOrganizations(accessToken: string) {
  const payload = await linkedInRestFetch<LinkedInAclsResponse>("/organizationAcls", accessToken, {
    q: "roleAssignee",
    state: "APPROVED",
    count: "100",
  });
  const requestedOrganization = organizationIdFromEnv();
  const roles = publishRoles();
  return (Array.isArray(payload.elements) ? payload.elements : [])
    .map((item) => ({
      organizationUrn: stringValue(item.organization) || stringValue(item.organizationTarget),
      role: stringValue(item.role),
      memberUrn: stringValue(item.roleAssignee),
    }))
    .filter((item) => item.organizationUrn && item.role && roles.has(item.role))
    .filter((item) => !requestedOrganization || item.organizationUrn === requestedOrganization);
}

export async function connectLinkedInFromAuthorizationCode(input: { code: string; connectedBy: string }) {
  const exchanged = await exchangeLinkedInCode(input.code);
  const userInfo = await linkedInUserInfo(exchanged.accessToken);
  const organizations = hasOrganizationSocialScopes(exchanged.scope)
    ? await authorizedOrganizations(exchanged.accessToken)
    : [];
  if (!organizations.length) {
    if (hasOrganizationSocialScopes(exchanged.scope)) {
      throw new Error("LinkedIn connected, but no approved VYVA company-page publishing role was found. Confirm the LinkedIn app has organization social scopes and the signed-in member can post for the VYVA Page.");
    }
    const now = new Date();
    const memberName = stringValue(userInfo?.name);
    const memberEmail = stringValue(userInfo?.email);
    const memberSub = stringValue(userInfo?.sub) || input.connectedBy;
    const accountId = `linkedin-member:${memberSub}`;
    const [row] = await db.insert(marketingSocialConnections).values({
      provider: LINKEDIN_PROVIDER,
      external_account_id: accountId,
      external_account_name: preferredMemberAccountName(userInfo),
      access_token_encrypted: encryptMarketingAccessToken(exchanged.accessToken),
      token_expires_at: exchanged.expiresAt,
      status: "connected",
      metadata: {
        apiVersion: linkedInApiVersion(),
        scope: exchanged.scope,
        connectionLevel: "member_share_only",
        organizationUrn: null,
        organizationRole: null,
        memberUrn: null,
        memberSub,
        memberName,
        memberEmail,
      },
      connected_by: input.connectedBy,
      updated_at: now,
    }).onConflictDoUpdate({
      target: [marketingSocialConnections.provider, marketingSocialConnections.external_account_id],
      set: {
        external_account_name: preferredMemberAccountName(userInfo),
        access_token_encrypted: encryptMarketingAccessToken(exchanged.accessToken),
        token_expires_at: exchanged.expiresAt,
        status: "connected",
        metadata: {
          apiVersion: linkedInApiVersion(),
          scope: exchanged.scope,
          connectionLevel: "member_share_only",
          organizationUrn: null,
          organizationRole: null,
          memberUrn: null,
          memberSub,
          memberName,
          memberEmail,
        },
        connected_by: input.connectedBy,
        updated_at: now,
      },
    }).returning();
    return row ? [serializeLinkedInConnection(row)] : [];
  }

  const now = new Date();
  const memberName = stringValue(userInfo?.name);
  const memberEmail = stringValue(userInfo?.email);
  const saved: LinkedInConnectionSummary[] = [];
  for (const organization of organizations) {
    const organizationUrn = organization.organizationUrn!;
    const [row] = await db.insert(marketingSocialConnections).values({
      provider: LINKEDIN_PROVIDER,
      external_account_id: organizationUrn,
      external_account_name: preferredOrganizationName(organizationUrn),
      access_token_encrypted: encryptMarketingAccessToken(exchanged.accessToken),
      token_expires_at: exchanged.expiresAt,
      status: "connected",
      metadata: {
        apiVersion: linkedInApiVersion(),
        scope: exchanged.scope,
        organizationUrn,
        organizationRole: organization.role,
        memberUrn: organization.memberUrn,
        memberSub: stringValue(userInfo?.sub),
        memberName,
        memberEmail,
      },
      connected_by: input.connectedBy,
      updated_at: now,
    }).onConflictDoUpdate({
      target: [marketingSocialConnections.provider, marketingSocialConnections.external_account_id],
      set: {
        external_account_name: preferredOrganizationName(organizationUrn),
        access_token_encrypted: encryptMarketingAccessToken(exchanged.accessToken),
        token_expires_at: exchanged.expiresAt,
        status: "connected",
        metadata: {
          apiVersion: linkedInApiVersion(),
          scope: exchanged.scope,
          organizationUrn,
          organizationRole: organization.role,
          memberUrn: organization.memberUrn,
          memberSub: stringValue(userInfo?.sub),
          memberName,
          memberEmail,
        },
        connected_by: input.connectedBy,
        updated_at: now,
      },
    }).returning();
    if (row) saved.push(serializeLinkedInConnection(row));
  }
  return saved;
}

function metadataFor(row: MarketingSocialConnectionRow) {
  return recordValue(row.metadata);
}

export function serializeLinkedInConnection(row: MarketingSocialConnectionRow): LinkedInConnectionSummary {
  const metadata = metadataFor(row);
  return {
    id: row.id,
    provider: row.provider,
    accountId: row.external_account_id,
    accountName: row.external_account_name,
    organizationUrn: stringValue(metadata.organizationUrn),
    organizationRole: stringValue(metadata.organizationRole),
    memberUrn: stringValue(metadata.memberUrn),
    memberName: stringValue(metadata.memberName),
    memberEmail: stringValue(metadata.memberEmail),
    status: row.status,
    connectedAt: row.connected_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listLinkedInConnections() {
  try {
    const rows = await db.select()
      .from(marketingSocialConnections)
      .where(and(eq(marketingSocialConnections.provider, LINKEDIN_PROVIDER), eq(marketingSocialConnections.status, "connected")))
      .orderBy(desc(marketingSocialConnections.updated_at))
      .limit(50);
    return rows.map(serializeLinkedInConnection);
  } catch (error) {
    if (String(error).includes('relation "marketing_social_connections" does not exist')) return [];
    throw error;
  }
}

export async function verifyLinkedInConnection(connectionId?: string) {
  const rows = await db.select()
    .from(marketingSocialConnections)
    .where(and(
      eq(marketingSocialConnections.provider, LINKEDIN_PROVIDER),
      ...(connectionId ? [eq(marketingSocialConnections.id, connectionId)] : []),
      eq(marketingSocialConnections.status, "connected"),
    ))
    .orderBy(desc(marketingSocialConnections.updated_at))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("No connected LinkedIn organization was found.");
  const accessToken = decryptMarketingAccessToken(row.access_token_encrypted);
  const connection = serializeLinkedInConnection(row);
  if (!connection.organizationUrn) {
    const userInfo = await linkedInUserInfo(accessToken);
    if (!stringValue(userInfo?.sub)) {
      throw new Error("LinkedIn token is invalid or no longer has approved member access.");
    }
    return {
      connection,
      verifiedOrganizationUrn: null,
      verifiedOrganizationName: connection.accountName,
      checkedAt: new Date().toISOString(),
    };
  }
  const organizations = await authorizedOrganizations(accessToken);
  const verified = organizations.some((item) => item.organizationUrn === connection.organizationUrn);
  if (!verified) {
    throw new Error("LinkedIn token is valid, but it no longer has an approved publishing role for this organization.");
  }
  return {
    connection,
    verifiedOrganizationUrn: connection.organizationUrn,
    verifiedOrganizationName: connection.accountName,
    checkedAt: new Date().toISOString(),
  };
}
