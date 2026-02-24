import { MetricEntry } from '../db';

export const validateMetrics = (metricsList: MetricEntry[]) => {
    const validMetrics: MetricEntry[] = [];
    for (const m of metricsList) {
        const hasName = m.name.trim().length > 0;
        const hasValue = m.value !== 0; // Value is entered (non-zero)
        const hasUnit = m.unit.trim().length > 0;

        if (!hasName && !hasValue && !hasUnit) {
            continue; // Skip completely empty
        }

        if (hasName && hasValue && hasUnit) {
            validMetrics.push(m);
            continue;
        }

        // Partial
        const missing = [];
        if (!hasName) missing.push('名前');
        if (!hasValue) missing.push('数値');
        if (!hasUnit) missing.push('単位');
        return { error: `メトリクス「${m.name || '(未名)'}」の{${missing.join('}{')}}が未入力です。`, validMetrics: [] };
    }
    return { error: null, validMetrics };
};
