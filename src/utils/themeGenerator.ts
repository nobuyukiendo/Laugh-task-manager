import { ThemeRoleColors } from '../contexts/ThemeContext';

// Helper: Hex to HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt('0x' + hex[1] + hex[1]);
        g = parseInt('0x' + hex[2] + hex[2]);
        b = parseInt('0x' + hex[3] + hex[3]);
    } else if (hex.length === 7) {
        r = parseInt('0x' + hex[1] + hex[2]);
        g = parseInt('0x' + hex[3] + hex[4]);
        b = parseInt('0x' + hex[5] + hex[6]);
    }
    r /= 255;
    g /= 255;
    b /= 255;
    const cmin = Math.min(r, g, b),
        cmax = Math.max(r, g, b),
        delta = cmax - cmin;
    let h = 0, s = 0, l = 0;

    if (delta === 0) h = 0;
    else if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return { h, s, l };
}

// Helper: HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
        m = l - c / 2,
        r = 0,
        g = 0,
        b = 0;

    if (0 <= h && h < 60) {
        r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
        r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
        r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
        r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
        r = c; g = 0; b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    const toHex = (n: number) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function generateTheme(baseColor: string, _mode: 'light' | 'dark'): ThemeRoleColors {
    const { h, s, l } = hexToHSL(baseColor);

    // User Request: Base Color becomes the BACKGROUND color.
    const bg = baseColor;

    // Determine if base color is "Dark" or "Light" to adjust derivation
    // Note: 'mode' argument is still useful context, but if user picks Black in Light Mode, checking 'l' is better.
    const isDarkBase = l < 50;

    let surface, text, border, inputBg, inputText, buttonBg, buttonText, subText, icon, primary, accent, base;

    if (isDarkBase) {
        // Dark Theme Logic (derived from dark bg)
        surface = hslToHex(h, Math.max(0, s - 5), Math.min(100, l + 10)); // Lighter than BG
        text = hslToHex(h, 10, 95); // High contrast text
        subText = hslToHex(h, 10, 70);
        border = hslToHex(h, 20, Math.min(100, l + 20));
        inputBg = hslToHex(h, 20, Math.min(100, l + 15)); // Slightly lighter than BG
        inputText = text;
        buttonBg = hslToHex(h, 20, Math.min(100, l + 20)); // Button like surface/border
        buttonText = hslToHex(h, 10, 80);
        icon = hslToHex(h, 10, 70);

        // Primary: Saturated version of hue, safe lightness
        primary = hslToHex(h, 80, 60);
        accent = hslToHex((h + 180) % 360, 70, 60);
        base = hslToHex(h, 10, 50);

    } else {
        // Light Theme Logic (derived from light bg)
        // If bg is white/light, surface is usually white too, or slightly distinctive?
        // If bg is generic light, surface is White.
        surface = '#ffffff';

        text = hslToHex(h, 30, 20); // Dark text
        subText = hslToHex(h, 20, 50);
        border = hslToHex(h, 20, Math.max(0, l - 10)); // Darker than BG
        inputBg = '#ffffff'; // Inputs usually white on light
        inputText = text;
        buttonBg = hslToHex(h, 20, Math.max(0, l - 5));
        buttonText = text;
        icon = hslToHex(h, 20, 50);

        primary = hslToHex(h, 80, 50);
        accent = hslToHex((h + 180) % 360, 70, 50);
        base = hslToHex(h, 10, 50);
    }

    // Override if mode implies a specific expectation?
    // User might pick a light color but be in Dark Mode.
    // In that case, we trust the COLOR over the mode setting for generation.

    // Default badge colors derived from background/surface
    const badgeDept = isDarkBase ? surface : '#f1f5f9';
    const badgeWorkType = subText;
    const badgeDetail = isDarkBase ? surface : '#f1f5f9';

    return {
        primary, accent, bg, surface, text, subText, border, inputBg, inputText, buttonBg, buttonText, icon, badgeDept, badgeWorkType, badgeDetail, base
    };
}
