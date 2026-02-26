/**
 * 安全な数式パーサ
 * 対応: 数値リテラル・変数(A/B/C...)・四則演算(+,-,*,/)・括弧・単項マイナス
 * new Function は使用しない
 *
 * 文法 (BNF):
 *   expr   → term (('+' | '-') term)*
 *   term   → factor (('*' | '/') factor)*
 *   factor → '(' expr ')' | '-' factor | NUMBER | VARIABLE
 */

type TokenType = 'NUMBER' | 'VAR' | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'LPAREN' | 'RPAREN' | 'EOF';

interface Token {
    type: TokenType;
    value: string;
}

function tokenize(expr: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const src = expr.replace(/\s+/g, '');

    while (i < src.length) {
        const ch = src[i];

        // 数値（整数・小数どちらも対応）
        if (/[0-9.]/.test(ch)) {
            let num = '';
            let dotSeen = false;
            while (i < src.length && (/[0-9]/.test(src[i]) || (src[i] === '.' && !dotSeen))) {
                if (src[i] === '.') dotSeen = true;
                num += src[i++];
            }
            tokens.push({ type: 'NUMBER', value: num });
            continue;
        }

        // 変数（大文字アルファベット）
        if (/[A-Z]/.test(ch)) {
            tokens.push({ type: 'VAR', value: ch });
            i++;
            continue;
        }

        switch (ch) {
            case '+': tokens.push({ type: 'PLUS', value: '+' }); i++; break;
            case '-': tokens.push({ type: 'MINUS', value: '-' }); i++; break;
            case '*': tokens.push({ type: 'STAR', value: '*' }); i++; break;
            case '/': tokens.push({ type: 'SLASH', value: '/' }); i++; break;
            case '(': tokens.push({ type: 'LPAREN', value: '(' }); i++; break;
            case ')': tokens.push({ type: 'RPAREN', value: ')' }); i++; break;
            default:
                throw new Error(`不正な文字: '${ch}'`);
        }
    }

    tokens.push({ type: 'EOF', value: '' });
    return tokens;
}

class Parser {
    private tokens: Token[];
    private pos = 0;
    private variables: Record<string, number>;

    constructor(tokens: Token[], variables: Record<string, number>) {
        this.tokens = tokens;
        this.variables = variables;
    }

    private peek(): Token {
        return this.tokens[this.pos];
    }

    private consume(type: TokenType): Token {
        const tok = this.tokens[this.pos];
        if (tok.type !== type) {
            throw new Error(`期待するトークン: ${type}, 実際: ${tok.type}`);
        }
        this.pos++;
        return tok;
    }

    /** expr → term (('+' | '-') term)* */
    expr(): number {
        let left = this.term();
        while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
            const op = this.peek().type;
            this.pos++;
            const right = this.term();
            left = op === 'PLUS' ? left + right : left - right;
        }
        return left;
    }

    /** term → factor (('*' | '/') factor)* */
    private term(): number {
        let left = this.factor();
        while (this.peek().type === 'STAR' || this.peek().type === 'SLASH') {
            const op = this.peek().type;
            this.pos++;
            const right = this.factor();
            if (op === 'SLASH') {
                left = left / right; // 0除算は呼び出し元でInfinityチェック
            } else {
                left = left * right;
            }
        }
        return left;
    }

    /** factor → '(' expr ')' | '-' factor | NUMBER | VARIABLE */
    private factor(): number {
        const tok = this.peek();

        if (tok.type === 'LPAREN') {
            this.consume('LPAREN');
            const val = this.expr();
            this.consume('RPAREN');
            return val;
        }

        // 単項マイナス
        if (tok.type === 'MINUS') {
            this.pos++;
            return -this.factor();
        }

        if (tok.type === 'NUMBER') {
            this.pos++;
            return parseFloat(tok.value);
        }

        if (tok.type === 'VAR') {
            this.pos++;
            const val = this.variables[tok.value];
            if (val === undefined) {
                throw new Error(`未定義変数: ${tok.value}`);
            }
            return val;
        }

        throw new Error(`予期しないトークン: ${tok.type} ("${tok.value}")`);
    }
}

export type FormulaResult =
    | { ok: true; result: number }
    | { ok: false; error: string };

/**
 * 式を安全に評価する
 * @param expression 式文字列 例: "B/A*100"
 * @param variables  変数マップ 例: { A: 1000, B: 100 }
 */
export function evaluateFormula(
    expression: string,
    variables: Record<string, number>
): FormulaResult {
    if (!expression.trim()) {
        return { ok: false, error: '算出不可（式が空）' };
    }

    try {
        const tokens = tokenize(expression);
        const parser = new Parser(tokens, variables);
        const result = parser.expr();

        // EOFまで消費されたか確認
        if (parser['peek']().type !== 'EOF') {
            return { ok: false, error: '算出不可（式の構文エラー）' };
        }

        if (!isFinite(result)) {
            return { ok: false, error: '算出不可（分母が0）' };
        }
        if (isNaN(result)) {
            return { ok: false, error: '算出不可（計算結果が不正）' };
        }

        return { ok: true, result };
    } catch (e: any) {
        const msg: string = e?.message || '不明なエラー';
        if (msg.includes('未定義変数')) {
            return { ok: false, error: `算出不可（${msg}）` };
        }
        return { ok: false, error: `算出不可（式の構文エラー）` };
    }
}
