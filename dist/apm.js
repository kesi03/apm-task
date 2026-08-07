"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apm = void 0;
exports.initApm = initApm;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
const package_json_1 = __importDefault(require("../package.json"));
function randomId() {
    return (0, crypto_1.randomBytes)(8).toString('hex');
}
function nonEmpty(value) {
    return value && value.trim() ? value.trim() : undefined;
}
function roundMs(ms) {
    return Math.round(ms * 1000) / 1000;
}
function parseStack(stack) {
    const frames = [];
    for (const rawLine of stack.split('\n')) {
        const match = /^at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/.exec(rawLine.trim());
        if (!match) {
            continue;
        }
        const [, fn, file, lineNo, colNo] = match;
        frames.push({
            filename: file,
            ...(fn && fn !== '<anonymous>' ? { function: fn } : {}),
            lineno: parseInt(lineNo, 10),
            colno: parseInt(colNo, 10),
        });
    }
    return frames;
}
class ApmClient {
    constructor(options = {}) {
        this.transactions = [];
        this.currentTransaction = null;
        this.serverUrl = nonEmpty(options.serverUrl ?? process.env.ELASTIC_APM_SERVER_URL);
        this.secretToken = nonEmpty(options.secretToken ?? process.env.ELASTIC_APM_SECRET_TOKEN);
        this.apiKey = nonEmpty(options.apiKey ?? process.env.ELASTIC_APM_API_KEY);
        this.serviceName = nonEmpty(options.serviceName ?? process.env.ELASTIC_APM_SERVICE_NAME) ?? 'ci-apm-trace';
        const envDebug = (process.env.ELASTIC_APM_DEBUG ?? '').toLowerCase();
        this.debug = Boolean(options.debug ?? (envDebug === 'true' || envDebug === '1'));
    }
    startTransaction(name, type) {
        const transaction = {
            id: randomId(),
            traceId: randomId() + randomId(),
            name,
            type,
            startMs: Date.now(),
            durationMs: 0,
            result: 'unknown',
            labels: {},
            spans: [],
            errors: [],
            ended: false,
        };
        this.transactions.push(transaction);
        this.currentTransaction = transaction;
        return {
            setLabel(label, value) {
                transaction.labels[label] = value;
            },
            end() {
                if (!transaction.ended) {
                    transaction.durationMs = Date.now() - transaction.startMs;
                    transaction.ended = true;
                }
            },
            get result() {
                return transaction.result;
            },
            set result(value) {
                transaction.result = value;
            },
        };
    }
    startSpan(name, type) {
        if (!this.currentTransaction) {
            return null;
        }
        const span = {
            id: randomId(),
            name,
            type,
            startMs: Date.now(),
            durationMs: 0,
        };
        this.currentTransaction.spans.push(span);
        return {
            end() {
                span.durationMs = Date.now() - span.startMs;
            },
        };
    }
    captureError(error) {
        if (!this.currentTransaction) {
            return;
        }
        const frames = error.stack ? parseStack(error.stack) : [];
        this.currentTransaction.errors.push({
            id: (0, crypto_1.randomBytes)(16).toString('hex'),
            timestampUs: Date.now() * 1000,
            message: error.message,
            type: error.name || 'Error',
            ...(frames.length > 0 ? { stacktrace: frames } : {}),
        });
    }
    async flush() {
        if (!this.serverUrl) {
            this.transactions.length = 0;
            this.currentTransaction = null;
            return;
        }
        const pending = this.transactions.splice(0, this.transactions.length);
        this.currentTransaction = null;
        if (pending.length === 0) {
            return;
        }
        const url = `${this.serverUrl.replace(/\/+$/, '')}/intake/v2/events`;
        const headers = {
            'Content-Type': 'application/x-ndjson',
            'User-Agent': `ci-apm-trace/${package_json_1.default.version}`,
        };
        if (this.apiKey) {
            headers['Authorization'] = `ApiKey ${this.apiKey}`;
        }
        else if (this.secretToken) {
            headers['Authorization'] = `Bearer ${this.secretToken}`;
        }
        try {
            const response = await axios_1.default.post(url, this.serialize(pending), { headers, timeout: 10000 });
            if (this.debug) {
                this.logServerResponse(response.status, response.data);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`ci-apm-trace: failed to send traces to ${this.serverUrl}: ${message}`);
            if (this.debug && axios_1.default.isAxiosError(error)) {
                this.logServerResponse(error.response?.status, error.response?.data);
            }
        }
    }
    logServerResponse(status, data) {
        if (status === undefined) {
            return;
        }
        const body = data !== undefined && data !== '' ? `: ${JSON.stringify(data)}` : ' (no response body)';
        console.log(`ci-apm-trace: APM server responded with status ${status}${body}`);
    }
    serialize(transactions) {
        const lines = [
            JSON.stringify({
                metadata: {
                    service: {
                        name: this.serviceName,
                        environment: 'ci',
                        agent: {
                            name: 'ci-apm-trace',
                            version: package_json_1.default.version,
                        },
                    },
                },
            }),
        ];
        for (const t of transactions) {
            for (const span of t.spans) {
                lines.push(JSON.stringify({
                    span: {
                        id: span.id,
                        trace_id: t.traceId,
                        transaction_id: t.id,
                        parent_id: t.id,
                        name: span.name,
                        type: span.type,
                        timestamp: span.startMs * 1000,
                        duration: roundMs(span.durationMs),
                        outcome: 'success',
                    },
                }));
            }
            for (const err of t.errors) {
                lines.push(JSON.stringify({
                    error: {
                        id: err.id,
                        trace_id: t.traceId,
                        transaction_id: t.id,
                        timestamp: err.timestampUs,
                        exception: {
                            message: err.message,
                            type: err.type,
                            stacktrace: err.stacktrace,
                        },
                    },
                }));
            }
            lines.push(JSON.stringify({
                transaction: {
                    id: t.id,
                    trace_id: t.traceId,
                    name: t.name,
                    type: t.type,
                    result: t.result,
                    outcome: t.result === 'failure'
                        ? 'failure'
                        : t.result === 'success'
                            ? 'success'
                            : 'unknown',
                    timestamp: t.startMs * 1000,
                    duration: roundMs(t.durationMs),
                    sampled: true,
                    span_count: { started: t.spans.length },
                    ...(Object.keys(t.labels).length > 0 ? { context: { tags: t.labels } } : {}),
                },
            }));
        }
        return `${lines.join('\n')}\n`;
    }
}
let current = new ApmClient();
function initApm(options = {}) {
    current = new ApmClient(options);
    return current;
}
exports.apm = {
    startTransaction: (name, type) => current.startTransaction(name, type),
    startSpan: (name, type) => current.startSpan(name, type),
    captureError: (error) => current.captureError(error),
    flush: () => current.flush(),
};
//# sourceMappingURL=apm.js.map