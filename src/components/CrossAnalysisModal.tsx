import React, { useState, useMemo } from 'react';
import { Card, Button, Input } from './ui';
import {
    X, Calculator, ChevronRight, Save, Plus, Trash2,
    BookOpen, Layers, Edit3, Search, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useMaster } from '../contexts/MasterContext';
import { CrossFormulaVariable } from '../db';
import { evaluateFormula } from '../utils/formulaParser';
import { FORMULA_TEMPLATES, FORMULA_TEMPLATE_CATEGORIES, FormulaTemplate } from '../utils/crossFormulaTemplates';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { format } from 'date-fns';

// ─── 型 ───────────────────────────────────────────────────────────────────────

export interface AvailableMetric {
    name: string;
    unit: string;
    total: number;
    source: 'task' | 'daily' | 'time';
    timeframe: 'current' | 'previous' | string;
}

interface CrossAnalysisModalProps {
    availableMetrics: AvailableMetric[];
    period: 'day' | 'week' | 'month';
    onClose: () => void;
    onInsertToReport: (text: string) => void;
}

type TabId = 'master' | 'template' | 'custom';

// ─── 計算結果パネル ─────────────────────────────────────────────────────────────

interface ResultPanelProps {
    formulaName: string;
    resultUnit: string;
    expression: string;
    variables: CrossFormulaVariable[];
    availableMetrics: AvailableMetric[];
    period: 'day' | 'week' | 'month';
    onInsertToReport: (text: string) => void;
}

const ResultPanel: React.FC<ResultPanelProps> = ({
    formulaName, resultUnit, expression, variables, availableMetrics, period, onInsertToReport
}) => {
    // 変数マップを構築
    const varMap = useMemo<Record<string, number>>(() => {
        const m: Record<string, number> = {};
        variables.forEach(v => {
            if (!v.metricName) return;
            const hasTimeframe = v.metricName.includes('|');
            const timeframe = hasTimeframe ? v.metricName.split('|')[0] : 'current';
            const name = hasTimeframe ? v.metricName.split('|')[1] : v.metricName;

            const metric = availableMetrics.find(am => am.name === name && am.timeframe === timeframe);
            if (metric !== undefined) {
                m[v.varId] = metric.total;
            }
        });
        return m;
    }, [variables, availableMetrics]);

    // 未割り当て変数
    const unassigned = variables.filter(v => varMap[v.varId] === undefined);

    // 計算実行
    const calcResult = useMemo(() => {
        if (!expression.trim()) return { ok: false, error: '算出不可（式が空）' } as const;
        if (unassigned.length > 0) {
            return { ok: false, error: `算出不可（${unassigned.map(v => `変数 ${v.varId} (${v.label || v.varId}) が未割り当て`).join('、')}）` } as const;
        }
        return evaluateFormula(expression, varMap);
    }, [expression, varMap, unassigned]);

    const formatResult = (n: number): string => {
        if (Number.isInteger(n)) return n.toLocaleString();
        return parseFloat(n.toFixed(4)).toLocaleString();
    };

    const buildDefaultInsertText = (): string => {
        if (!calcResult.ok) return '';
        const varParts = variables.map(v => {
            const hasTimeframe = v.metricName?.includes('|');
            const timeframe = hasTimeframe ? v.metricName.split('|')[0] : 'current';
            const timeframeLabel = timeframe === 'previous' ? '【前期】' : timeframe === 'custom' ? '【カスタム】' : '';
            return `${timeframeLabel}${v.label || v.varId} ${varMap[v.varId]?.toLocaleString()}`;
        }).join(' / ');
        return `[クロス分析]\n${formulaName || '無題'}：${formatResult(calcResult.result)}${resultUnit}（${varParts}）`;
    };

    const [previewText, setPreviewText] = useState('');

    React.useEffect(() => {
        setPreviewText(buildDefaultInsertText());
    }, [calcResult, formulaName, resultUnit, variables, varMap]);

    return (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-border space-y-3">
            {/* 計算結果 */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{formulaName || '（無題）'}</p>
                    {calcResult.ok ? (
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-black text-cyan-500 tabular-nums">
                                {formatResult(calcResult.result)}
                            </span>
                            <span className="text-sm text-slate-400">{resultUnit}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-amber-500">
                            <AlertCircle size={16} />
                            <span className="text-sm font-medium">{calcResult.error}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 使用メトリクス一覧 */}
            <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">使用メトリクス</p>
                {variables.map(v => {
                    const val = varMap[v.varId];
                    const hasTimeframe = v.metricName?.includes('|');
                    const timeframe = hasTimeframe ? v.metricName.split('|')[0] : 'current';
                    const name = hasTimeframe ? v.metricName.split('|')[1] : v.metricName;
                    const metric = availableMetrics.find(am => am.name === name && am.timeframe === timeframe);
                    const timeframeLabel = timeframe === 'previous' ? '【前期】' : timeframe.startsWith('custom') ? '【カスタム】' : '';
                    const displayLabel = v.label || name;

                    return (
                        <div key={v.varId} className="flex items-center justify-between text-xs bg-white/60 dark:bg-slate-800/60 rounded-lg px-3 py-1.5 border border-border">
                            <span className="font-mono font-bold text-slate-500 w-5">{v.varId}</span>
                            <span className="flex-1 text-main-text mx-2">{timeframeLabel}{displayLabel}</span>
                            {val !== undefined ? (
                                <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                                    {val.toLocaleString()} <span className="text-slate-400 font-normal">{metric?.unit || ''}</span>
                                </span>
                            ) : (
                                <span className="text-amber-500 text-[10px]">未割り当て</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 式の簡易表示 */}
            <div className="text-[10px] text-slate-400 font-mono bg-white/40 dark:bg-slate-900/40 rounded px-2 py-1 border border-border">
                {expression || '—'}
            </div>

            {/* 挿入プレビューと実行 */}
            {calcResult.ok && period === 'week' && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">挿入テキストのプレビュー</p>
                    <textarea
                        className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-main-text focus:outline-none focus:ring-1 focus:ring-cyan-500 min-h-[60px]"
                        value={previewText}
                        onChange={e => setPreviewText(e.target.value)}
                    />
                    <div className="flex justify-end mt-2">
                        <Button
                            onClick={() => onInsertToReport(previewText)}
                            className="gap-1.5 text-xs px-3 py-1.5 h-auto bg-cyan-600 hover:bg-cyan-700 text-white"
                        >
                            <Plus size={12} />
                            挿入する
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── 変数割り当てUI ─────────────────────────────────────────────────────────────

interface VarAssignRowProps {
    variable: { varId: string; label: string };
    metricName: string;
    availableMetrics: AvailableMetric[];
    onChange: (varId: string, metricName: string) => void;
}

const VarAssignRow: React.FC<VarAssignRowProps> = ({ variable, metricName, availableMetrics, onChange }) => {
    const currentMetrics = availableMetrics.filter(am => am.timeframe === 'current');
    const previousMetrics = availableMetrics.filter(am => am.timeframe === 'previous');

    const customTimeframes = Array.from(new Set(availableMetrics.filter(am => am.timeframe.startsWith('custom-')).map(am => am.timeframe)));

    return (
        <div className="flex items-center gap-2">
            <span className="w-6 text-center font-mono font-black text-cyan-500 text-sm">{variable.varId}</span>
            <span className="min-w-[6rem] text-xs text-slate-600 dark:text-slate-400" title={variable.label}>{variable.label}</span>
            <select
                className="flex-[2] w-0 text-xs rounded-lg border border-border bg-surface text-main-text px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                value={metricName}
                onChange={e => onChange(variable.varId, e.target.value)}
            >
                <option value="">(未選択)</option>
                <optgroup label="当期間（Current）">
                    {currentMetrics.map(am => (
                        <option key={`current|${am.name}`} value={`current|${am.name}`}>
                            {am.name}（{am.total.toLocaleString()}{am.unit}）
                            {am.source === 'daily' ? ' [日次]' : am.source === 'time' ? ' [作業時間]' : ''}
                        </option>
                    ))}
                </optgroup>
                <optgroup label="前期間（Previous）">
                    {previousMetrics.map(am => (
                        <option key={`previous|${am.name}`} value={`previous|${am.name}`}>
                            {am.name}（{am.total.toLocaleString()}{am.unit}）
                            {am.source === 'daily' ? ' [日次]' : am.source === 'time' ? ' [作業時間]' : ''}
                        </option>
                    ))}
                </optgroup>
                {customTimeframes.map((tf, idx) => {
                    const cMetrics = availableMetrics.filter(am => am.timeframe === tf);
                    if (cMetrics.length === 0) return null;
                    return (
                        <optgroup key={tf} label={`カスタム期間 ${idx + 1}`}>
                            {cMetrics.map(am => (
                                <option key={`${tf}|${am.name}`} value={`${tf}|${am.name}`}>
                                    {am.name}（{am.total.toLocaleString()}{am.unit}）
                                    {am.source === 'daily' ? ' [日次]' : am.source === 'time' ? ' [作業時間]' : ''}
                                </option>
                            ))}
                        </optgroup>
                    );
                })}
            </select>
        </div>
    );
};

// ─── タブ: マスタから選択 ────────────────────────────────────────────────────────

const MasterTab: React.FC<{
    availableMetrics: AvailableMetric[];
    period: 'day' | 'week' | 'month';
    onInsertToReport: (text: string) => void;
}> = ({ availableMetrics, period, onInsertToReport }) => {
    const { crossFormulas, deleteCrossFormula } = useMaster();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    // 変数割り当て（formulaId -> varId -> metricName）
    const [assignments, setAssignments] = useState<Record<string, Record<string, string>>>({});

    const selected = crossFormulas.find(f => f.id === selectedId);

    const getAssignment = (varId: string): string => {
        if (!selectedId) return '';
        return assignments[selectedId]?.[varId] || '';
    };
    const setAssignment = (varId: string, metricName: string) => {
        if (!selectedId) return;
        setAssignments(prev => ({
            ...prev,
            [selectedId]: { ...prev[selectedId], [varId]: metricName }
        }));
    };

    // 式評価用に変数マップ構築
    const resolvedVariables: CrossFormulaVariable[] = selected
        ? selected.variables.map(v => ({
            ...v,
            metricName: getAssignment(v.varId) || v.metricName
        }))
        : [];

    if (crossFormulas.length === 0) {
        return (
            <div className="py-12 text-center text-slate-400">
                <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">保存済みの計算式マスタがありません</p>
                <p className="text-xs mt-1">「テンプレートから作成」または「自由式で作成」で保存してください</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* 式一覧 */}
            <div className="space-y-1.5">
                {crossFormulas.map(f => (
                    <div
                        key={f.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedId === f.id
                            ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-900/20'
                            : 'border-border bg-surface hover:border-cyan-300'
                            }`}
                        onClick={() => setSelectedId(f.id)}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            {selectedId === f.id && <CheckCircle2 size={14} className="text-cyan-500 shrink-0" />}
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-main-text truncate">{f.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{f.expression} → {f.resultUnit}</p>
                            </div>
                        </div>
                        <button
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                            onClick={e => { e.stopPropagation(); deleteCrossFormula(f.id); if (selectedId === f.id) setSelectedId(null); }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* 選択中の式: 変数割り当て + 結果 */}
            {selected && (
                <div className="space-y-2 pt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">変数を割り当て</p>
                    {selected.variables.map(v => (
                        <VarAssignRow
                            key={v.varId}
                            variable={v}
                            metricName={getAssignment(v.varId) || v.metricName}
                            availableMetrics={availableMetrics}
                            onChange={setAssignment}
                        />
                    ))}
                    <ResultPanel
                        formulaName={selected.name}
                        resultUnit={selected.resultUnit}
                        expression={selected.expression}
                        variables={resolvedVariables}
                        availableMetrics={availableMetrics}
                        period={period}
                        onInsertToReport={onInsertToReport}
                    />
                </div>
            )}
        </div>
    );
};

// ─── タブ: テンプレートから作成 ───────────────────────────────────────────────────

const TemplateTab: React.FC<{
    availableMetrics: AvailableMetric[];
    period: 'day' | 'week' | 'month';
    onInsertToReport: (text: string) => void;
}> = ({ availableMetrics, period, onInsertToReport }) => {
    const { addCrossFormula } = useMaster();
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<FormulaTemplate | null>(null);

    // テンプレート選択後の状態
    const [formulaName, setFormulaName] = useState('');
    const [resultUnit, setResultUnit] = useState('');
    const [varAssignments, setVarAssignments] = useState<Record<string, string>>({});
    const [saved, setSaved] = useState(false);

    const filtered = useMemo(() => {
        return FORMULA_TEMPLATES.filter(t => {
            const matchCat = !categoryFilter || t.category === categoryFilter;
            const matchSearch = !search ||
                t.name.includes(search) ||
                t.description.includes(search) ||
                t.category.includes(search);
            return matchCat && matchSearch;
        });
    }, [search, categoryFilter]);

    const selectTemplate = (t: FormulaTemplate) => {
        setSelectedTemplate(t);
        setFormulaName(t.name);
        setResultUnit(t.defaultUnit);
        setVarAssignments({});
        setSaved(false);
    };

    const getAssignment = (varId: string): string => varAssignments[varId] || '';
    const setAssignment = (varId: string, metricName: string) => {
        setVarAssignments(prev => ({ ...prev, [varId]: metricName }));
    };

    const handleSave = async () => {
        if (!selectedTemplate) return;
        if (!formulaName.trim()) { alert('計算式名を入力してください'); return; }
        if (!resultUnit.trim()) { alert('結果単位を入力してください'); return; }

        const variables: CrossFormulaVariable[] = selectedTemplate.variables.map(v => ({
            varId: v.varId,
            label: v.label,
            metricName: getAssignment(v.varId),
        }));

        await addCrossFormula({
            name: formulaName.trim(),
            resultUnit: resultUnit.trim(),
            expression: selectedTemplate.expression,
            variables,
        });
        setSaved(true);
    };

    const resolvedVariables: CrossFormulaVariable[] = selectedTemplate
        ? selectedTemplate.variables.map(v => ({
            varId: v.varId,
            label: v.label,
            metricName: getAssignment(v.varId),
        }))
        : [];

    if (!selectedTemplate) {
        return (
            <div className="space-y-3">
                {/* 検索 */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-main-text focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            placeholder="テンプレートを検索..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="text-xs rounded-lg border border-border bg-surface text-main-text px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                    >
                        <option value="">全カテゴリ</option>
                        {FORMULA_TEMPLATE_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                {/* テンプレート一覧 */}
                <div className="space-y-1.5">
                    {filtered.map(t => (
                        <button
                            key={t.id}
                            className="w-full text-left p-3 rounded-xl border border-border bg-surface hover:border-cyan-400 hover:bg-cyan-50/30 dark:hover:bg-cyan-900/10 transition-all"
                            onClick={() => selectTemplate(t)}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-main-text">{t.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{t.category}</span>
                                    <ChevronRight size={14} className="text-slate-400" />
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{t.description}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-1">{t.expression} → {t.defaultUnit}</p>
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <p className="text-center text-xs text-slate-400 py-8">テンプレートが見つかりません</p>
                    )}
                </div>
            </div>
        );
    }

    // テンプレート選択後
    return (
        <div className="space-y-4">
            <button
                className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                onClick={() => setSelectedTemplate(null)}
            >
                ← テンプレート一覧に戻る
            </button>

            <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl border border-cyan-200 dark:border-cyan-800">
                <p className="text-xs font-bold text-cyan-700 dark:text-cyan-300">{selectedTemplate.name}</p>
                <p className="text-[11px] text-cyan-600/80 dark:text-cyan-400/80 mt-0.5">{selectedTemplate.description}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-1">{selectedTemplate.expression}</p>
            </div>

            {/* 計算式名・単位 */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 mb-1">計算式名 *</p>
                    <Input value={formulaName} onChange={e => setFormulaName(e.target.value)} placeholder="例: CTR" className="text-sm" />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-slate-400 mb-1">結果単位 *</p>
                    <Input value={resultUnit} onChange={e => setResultUnit(e.target.value)} placeholder="例: ％" className="text-sm" />
                </div>
            </div>

            {/* 変数割り当て */}
            <div>
                <p className="text-[10px] font-bold text-slate-400 mb-2">変数にメトリクスを割り当て</p>
                <div className="space-y-2">
                    {selectedTemplate.variables.map(v => (
                        <VarAssignRow
                            key={v.varId}
                            variable={v}
                            metricName={getAssignment(v.varId)}
                            availableMetrics={availableMetrics}
                            onChange={setAssignment}
                        />
                    ))}
                </div>
            </div>

            <ResultPanel
                formulaName={formulaName || selectedTemplate.name}
                resultUnit={resultUnit}
                expression={selectedTemplate.expression}
                variables={resolvedVariables}
                availableMetrics={availableMetrics}
                period={period}
                onInsertToReport={onInsertToReport}
            />

            <Button
                onClick={handleSave}
                disabled={saved}
                className="w-full gap-2"
                variant={saved ? 'ghost' : 'primary'}
            >
                {saved ? (
                    <><CheckCircle2 size={14} className="text-green-500" />マスタに保存済み</>
                ) : (
                    <><Save size={14} />計算式マスタに保存</>
                )}
            </Button>
        </div>
    );
};

// ─── タブ: 自由式で作成 ─────────────────────────────────────────────────────────

const AVAILABLE_VARS = ['A', 'B', 'C', 'D', 'E', 'F'];

const CustomTab: React.FC<{
    availableMetrics: AvailableMetric[];
    period: 'day' | 'week' | 'month';
    onInsertToReport: (text: string) => void;
}> = ({ availableMetrics, period, onInsertToReport }) => {
    const { addCrossFormula } = useMaster();
    const [formulaName, setFormulaName] = useState('');
    const [resultUnit, setResultUnit] = useState('');
    const [expression, setExpression] = useState('');
    const [variables, setVariables] = useState<CrossFormulaVariable[]>([
        { varId: 'A', label: '', metricName: '' },
        { varId: 'B', label: '', metricName: '' },
    ]);
    const [saved, setSaved] = useState(false);

    const addVariable = () => {
        const usedIds = new Set(variables.map(v => v.varId));
        const next = AVAILABLE_VARS.find(id => !usedIds.has(id));
        if (!next) return;
        setVariables(prev => [...prev, { varId: next, label: '', metricName: '' }]);
    };

    const removeVariable = (varId: string) => {
        setVariables(prev => prev.filter(v => v.varId !== varId));
    };

    const updateVariable = (varId: string, field: 'label' | 'metricName', value: string) => {
        setVariables(prev => prev.map(v => v.varId === varId ? { ...v, [field]: value } : v));
    };

    const insertToExpr = (text: string) => {
        setExpression(prev => prev + text);
    };

    const handleSave = async () => {
        if (!formulaName.trim()) { alert('計算式名を入力してください'); return; }
        if (!resultUnit.trim()) { alert('結果単位を入力してください'); return; }
        if (!expression.trim()) { alert('計算式を入力してください'); return; }

        await addCrossFormula({
            name: formulaName.trim(),
            resultUnit: resultUnit.trim(),
            expression: expression.trim(),
            variables,
        });
        setSaved(true);
    };

    return (
        <div className="space-y-4">
            {/* 計算式名・単位 */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 mb-1">計算式名 *</p>
                    <Input value={formulaName} onChange={e => { setFormulaName(e.target.value); setSaved(false); }} placeholder="例: 独自指標" className="text-sm" />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-slate-400 mb-1">結果単位 *</p>
                    <Input value={resultUnit} onChange={e => { setResultUnit(e.target.value); setSaved(false); }} placeholder="例: ／時間" className="text-sm" />
                </div>
            </div>

            {/* 変数設定 */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-slate-400">変数（最大6個）</p>
                    {variables.length < AVAILABLE_VARS.length && (
                        <button className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1" onClick={addVariable}>
                            <Plus size={12} /> 変数を追加
                        </button>
                    )}
                </div>
                <div className="space-y-2">
                    {variables.map(v => (
                        <div key={v.varId} className="flex items-center gap-2">
                            <span className="w-6 text-center font-mono font-black text-cyan-500 text-sm">{v.varId}</span>
                            <Input
                                className="text-xs flex-1"
                                placeholder="表示名（例: クリック数）"
                                value={v.label}
                                onChange={e => { updateVariable(v.varId, 'label', e.target.value); setSaved(false); }}
                            />
                            <select
                                className="flex-1 text-xs rounded-lg border border-border bg-surface text-main-text px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                value={v.metricName}
                                onChange={e => { updateVariable(v.varId, 'metricName', e.target.value); setSaved(false); }}
                            >
                                <option value="">(未選択)</option>
                                {availableMetrics.map(am => (
                                    <option key={am.name} value={am.name}>
                                        {am.name}（{am.total.toLocaleString()} {am.unit}）
                                        {am.source === 'daily' ? ' [日次]' : am.source === 'time' ? ' [作業時間]' : ''}
                                    </option>
                                ))}
                            </select>
                            {variables.length > 1 && (
                                <button className="p-1 text-slate-400 hover:text-rose-500 transition-colors" onClick={() => removeVariable(v.varId)}>
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* 計算式入力 */}
            <div>
                <p className="text-[10px] font-bold text-slate-400 mb-1">計算式 *</p>
                <div className="relative">
                    <Input
                        className="text-sm font-mono pr-24"
                        placeholder="例: B/A*100"
                        value={expression}
                        onChange={e => { setExpression(e.target.value); setSaved(false); }}
                    />
                </div>
                {/* クイック挿入ボタン */}
                <div className="flex flex-wrap gap-1 mt-2">
                    {variables.map(v => (
                        <button key={v.varId} onClick={() => insertToExpr(v.varId)}
                            className="px-2 py-0.5 text-xs font-mono bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded hover:bg-cyan-200 dark:hover:bg-cyan-900/50 transition-colors">
                            {v.varId}
                        </button>
                    ))}
                    {['+', '-', '*', '/', '(', ')', '100', '60', '1000'].map(op => (
                        <button key={op} onClick={() => insertToExpr(op)}
                            className="px-2 py-0.5 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            {op}
                        </button>
                    ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">使用可能: 変数(A～F)、+、-、*、/、( )、数値定数</p>
            </div>

            <ResultPanel
                formulaName={formulaName}
                resultUnit={resultUnit}
                expression={expression}
                variables={variables}
                availableMetrics={availableMetrics}
                period={period}
                onInsertToReport={onInsertToReport}
            />

            <Button
                onClick={handleSave}
                disabled={saved}
                className="w-full gap-2"
                variant={saved ? 'ghost' : 'primary'}
            >
                {saved ? (
                    <><CheckCircle2 size={14} className="text-green-500" />マスタに保存済み</>
                ) : (
                    <><Save size={14} />計算式マスタに保存</>
                )}
            </Button>
        </div>
    );
};

// ─── メインモーダル ────────────────────────────────────────────────────────────

export const CrossAnalysisModal: React.FC<CrossAnalysisModalProps> = ({
    availableMetrics, period, onClose, onInsertToReport
}) => {
    const [tab, setTab] = useState<TabId>('master');
    const [customPeriods, setCustomPeriods] = useState<{ id: string; start: string; end: string }[]>([]);

    const customMetricsData = useLiveQuery(async () => {
        if (customPeriods.length === 0) return [];
        return Promise.all(customPeriods.map(async (cp, idx) => {
            const logs = await db.workLogs.where('dateKey').between(cp.start, cp.end, true, true).toArray();
            const daily = await db.dailyMetrics.where('dateKey').between(cp.start, cp.end, true, true).toArray();
            return { id: cp.id, index: idx + 1, logs, daily };
        }));
    }, [customPeriods]) || [];

    const customMetrics = useMemo(() => {
        if (customMetricsData.length === 0) return [];
        const result: AvailableMetric[] = [];

        customMetricsData.forEach(data => {
            const cMetricGroups: Record<string, { total: number; unit: string; totalDurationSec: number }> = {};
            data.logs.forEach(l => {
                if (l.metrics) {
                    l.metrics.forEach(m => {
                        const key = `${m.name}|${m.unit}`;
                        if (!cMetricGroups[key]) cMetricGroups[key] = { total: 0, unit: m.unit, totalDurationSec: 0 };
                        cMetricGroups[key].total += m.value;
                        cMetricGroups[key].totalDurationSec += (l.durationSec || 0);
                    });
                }
            });

            const timeframeId = `custom-${data.id}`;

            Object.entries(cMetricGroups).forEach(([key, group]) => {
                const [name] = key.split('|');
                result.push({ name, unit: group.unit, total: group.total, source: 'task', timeframe: timeframeId });
                if (group.totalDurationSec > 0) {
                    result.push({
                        name: `${name} の作業時間`,
                        unit: '分',
                        total: Math.round(group.totalDurationSec / 60),
                        source: 'time',
                        timeframe: timeframeId
                    });
                }
            });

            if (data.daily.length > 0) {
                const cDailyMap: Record<string, { total: number; unit: string }> = {};
                data.daily.forEach(dm => {
                    dm.entries.forEach(e => {
                        const key = `${e.name}|${e.unit}`;
                        if (!cDailyMap[key]) cDailyMap[key] = { total: 0, unit: e.unit };
                        cDailyMap[key].total += e.value;
                    });
                });
                Object.entries(cDailyMap).forEach(([key, v]) => {
                    const name = key.split('|')[0];
                    if (!result.find(r => r.name === name && r.source === 'task' && r.timeframe === timeframeId)) {
                        result.push({ name, unit: v.unit, total: v.total, source: 'daily', timeframe: timeframeId });
                    }
                });
            }
        });

        return result;
    }, [customMetricsData]);

    const allMetrics = useMemo(() => [...availableMetrics, ...customMetrics], [availableMetrics, customMetrics]);

    const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
        { id: 'master', label: 'マスタから選択', icon: <BookOpen size={14} /> },
        { id: 'template', label: 'テンプレートから', icon: <Layers size={14} /> },
        { id: 'custom', label: '自由式で作成', icon: <Edit3 size={14} /> },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Calculator size={20} className="text-cyan-500" />
                        <div>
                            <h2 className="text-base font-bold text-main-text">メトリクスクロス分析</h2>
                            <p className="text-[11px] text-slate-500">
                                集計メトリクス {availableMetrics.length}件 から計算
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}><X size={18} /></Button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border px-5 gap-0">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${tab === t.id
                                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                                : 'border-transparent text-slate-500 hover:text-main-text'
                                }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Custom Period Config */}
                <div className="px-5 py-3 border-b border-border bg-slate-50/30 dark:bg-slate-900/10 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            カスタム期間
                        </span>
                        <Button
                            variant="ghost" size="sm"
                            className="h-7 text-xs px-2 gap-1 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30"
                            onClick={() => {
                                const today = format(new Date(), 'yyyy-MM-dd');
                                setCustomPeriods([...customPeriods, { id: Date.now().toString(), start: today, end: today }]);
                            }}
                        >
                            <Plus size={14} /> カスタム期間を追加
                        </Button>
                    </div>
                    {customPeriods.length > 0 && (
                        <div className="flex flex-col gap-2">
                            {customPeriods.map((cp, idx) => (
                                <div key={cp.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-border shadow-sm">
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">カスタム {idx + 1}</span>
                                    <input
                                        type="date"
                                        className="w-[115px] bg-transparent text-xs font-mono outline-none text-main-text"
                                        value={cp.start}
                                        onChange={e => {
                                            const newVal = [...customPeriods];
                                            newVal[idx].start = e.target.value;
                                            setCustomPeriods(newVal);
                                        }}
                                    />
                                    <span className="text-slate-400 text-xs">〜</span>
                                    <input
                                        type="date"
                                        className="w-[115px] bg-transparent text-xs font-mono outline-none text-main-text"
                                        value={cp.end}
                                        onChange={e => {
                                            const newVal = [...customPeriods];
                                            newVal[idx].end = e.target.value;
                                            setCustomPeriods(newVal);
                                        }}
                                    />
                                    <button
                                        title="削除"
                                        className="ml-auto p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                                        onClick={() => setCustomPeriods(customPeriods.filter(p => p.id !== cp.id))}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {tab === 'master' && (
                        <MasterTab
                            availableMetrics={allMetrics}
                            period={period}
                            onInsertToReport={onInsertToReport}
                        />
                    )}
                    {tab === 'template' && (
                        <TemplateTab
                            availableMetrics={allMetrics}
                            period={period}
                            onInsertToReport={onInsertToReport}
                        />
                    )}
                    {tab === 'custom' && (
                        <CustomTab
                            availableMetrics={allMetrics}
                            period={period}
                            onInsertToReport={onInsertToReport}
                        />
                    )}
                </div>

                <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/20">
                    <Button className="w-full" variant="ghost" onClick={onClose}>閉じる</Button>
                </div>
            </Card>
        </div>
    );
};
