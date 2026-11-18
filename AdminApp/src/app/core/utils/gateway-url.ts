import { environment } from '../../../environments/environment.development';

/** Builds a pattern matching the Gateway API base URL and any path under it. */
export function buildGatewayUrlPattern(apiUrl: string): RegExp {
  return new RegExp(`^${apiUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/.*)?$`, 'i');
}

/** Base pattern for the configured Gateway. */
const gatewayUrlPattern = buildGatewayUrlPattern(environment.apiUrl);

/** True for URLs served by the Gateway (requests that may carry a bearer token). */
export function isGatewayUrl(url: string): boolean {
  return gatewayUrlPattern.test(url);
}

/**
 * Endpoints that must stay anonymous even though they live behind the Gateway.
 * The sign-in e-mail existence check runs before any token exists.
 */
const ANONYMOUS_GATEWAY_PATHS: readonly string[] = ['/profiles/accounts/exists'];

export function isAnonymousGatewayUrl(url: string): boolean {
  const [path] = url.split('?');
  return ANONYMOUS_GATEWAY_PATHS.some((anonymousPath) => path.endsWith(anonymousPath));
}
