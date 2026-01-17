/**
 * Generates a high-entropy cryptographically strong random string as a code verifier.
 * @see https://datatracker.ietf.org/doc/html/rfc7636#section-4.1
 */
export const generateCodeVerifier = (): string => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return base64UrlEncode(array);
};

/**
 * Generates a code challenge from a code verifier using SHA-256.
 * @see https://datatracker.ietf.org/doc/html/rfc7636#section-4.2
 */
export const generateCodeChallenge = async (verifier: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(hash));
};

/**
 * Encodes a Uint8Array into a Base64URL string (no padding, url-safe).
 */
const base64UrlEncode = (array: Uint8Array): string => {
    const base64 = btoa(String.fromCharCode(...array));
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};
