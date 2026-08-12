"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apm = void 0;
exports.initApm = initApm;
const os = __importStar(require("os"));
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
const package_json_1 = __importDefault(require("../package.json"));
function randomId() {
    return (0, crypto_1.randomBytes)(8).toString('hex');
}
function isElasticApiKey(value) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
        return false;
    }
    try {
        const decoded = Buffer.from(value, 'base64').toString('utf8');
        return decoded.includes(':') && !decoded.includes('\uFFFD');
    }
    catch {
        return false;
    }
}
function normalizeServerUrl(value) {
    try {
        const parsed = new URL(value);
        if (/\.ingest\./.test(parsed.hostname) && parsed.hostname.endsWith('.elastic.cloud')) {
            parsed.hostname = parsed.hostname.replace(/\.ingest\./, '.apm.');
            return { url: parsed.toString().replace(/\/+$/, ''), corrected: true };
        }
        return { url: value.replace(/\/+$/, ''), corrected: false };
    }
    catch {
        return { url: value.replace(/\/+$/, ''), corrected: false };
    }
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
        // Filters (kept for parity with upstream agent API; currently stored but not applied)
        this.errorFilters = [];
        this.transactionFilters = [];
        this.spanFilters = [];
        const rawServerUrl = nonEmpty(options.serverUrl ?? process.env.ELASTIC_APM_SERVER_URL);
        let serverUrl;
        if (rawServerUrl) {
            const normalized = normalizeServerUrl(rawServerUrl);
            serverUrl = normalized.url;
            if (normalized.corrected) {
                console.warn(`ci-apm-trace: '${rawServerUrl}' is the Elasticsearch/OTel ingest endpoint, not an APM Server URL; using '${normalized.url}' instead.`);
            }
        }
        this.serverUrl = serverUrl;
        const secretToken = nonEmpty(options.secretToken ?? process.env.ELASTIC_APM_SECRET_TOKEN);
        const apiKey = nonEmpty(options.apiKey ?? process.env.ELASTIC_APM_API_KEY);
        if (apiKey) {
            this.apiKey = apiKey;
        }
        else if (secretToken && isElasticApiKey(secretToken)) {
            this.apiKey = secretToken;
        }
        this.secretToken = this.apiKey ? undefined : secretToken;
        this.serviceName = nonEmpty(options.serviceName ?? process.env.ELASTIC_APM_SERVICE_NAME) ?? 'ci-apm-trace';
        this.serviceVersion = nonEmpty(options.serviceVersion ?? process.env.ELASTIC_APM_SERVICE_VERSION);
        this.serviceNode = nonEmpty(options.serviceNode);
        this.serviceEnvironment = nonEmpty(options.serviceEnvironment ?? process.env.ELASTIC_APM_ENVIRONMENT) ?? 'ci';
        this.agentName = nonEmpty(options.agentName) ?? 'nodejs';
        this.globalLabels = options.globalLabels ?? {};
        this.ephemeralId = randomId();
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
        await this.post(this.serialize(pending));
    }
    async sendSpan(event) {
        const span = {
            id: event.spanId ?? randomId(),
            trace_id: event.traceId,
            parent_id: event.parentId,
            name: event.name,
            type: event.type,
            timestamp: event.startMs * 1000,
            duration: roundMs(event.durationMs ?? 0),
            outcome: event.outcome ?? 'success',
            sample_rate: 1,
        };
        if (event.subtype) {
            span.subtype = event.subtype;
        }
        if (event.action) {
            span.action = event.action;
        }
        if (event.stacktrace) {
            const frames = parseStack(event.stacktrace);
            if (frames.length > 0) {
                span.stacktrace = frames;
            }
        }
        if (event.tags && Object.keys(event.tags).length > 0) {
            span.context = { tags: event.tags };
        }
        await this.post(`${this.metadataLine()}\n${JSON.stringify({ span })}\n`);
    }
    async sendTransaction(event) {
        const transaction = {
            id: event.id,
            trace_id: event.traceId,
            name: event.name,
            type: event.type,
            result: event.result,
            outcome: event.outcome,
            timestamp: event.startMs * 1000,
            duration: roundMs(event.durationMs),
            sampled: true,
            sample_rate: 1,
            span_count: { started: event.spanCount ?? 0 },
        };
        if (event.parentId) {
            transaction.parent_id = event.parentId;
        }
        if (event.session && (event.session.id || event.session.sequence !== undefined)) {
            transaction.session = this.compact({ ...event.session });
        }
        const context = {};
        if (event.tags && Object.keys(event.tags).length > 0) {
            context.tags = event.tags;
        }
        if (event.user) {
            context.user = this.compact({ ...event.user });
        }
        if (event.custom && Object.keys(event.custom).length > 0) {
            context.custom = this.compact({ ...event.custom });
        }
        if (Object.keys(context).length > 0) {
            transaction.context = context;
        }
        await this.post(`${this.metadataLine()}\n${JSON.stringify({ transaction })}\n`);
    }
    async sendError(event) {
        const exception = this.compact({
            message: event.message,
            type: event.type ?? 'Error',
            handled: event.handled ?? true,
            code: event.code,
            module: event.module,
        });
        if (event.stack) {
            const frames = parseStack(event.stack);
            if (frames.length > 0) {
                exception.stacktrace = frames;
            }
        }
        const error = {
            id: (0, crypto_1.randomBytes)(16).toString('hex'),
            timestamp: (event.timestampMs ?? Date.now()) * 1000,
            exception,
        };
        if (event.traceId) {
            error.trace_id = event.traceId;
        }
        if (event.transactionId) {
            error.transaction_id = event.transactionId;
        }
        error.parent_id = event.parentId ?? event.transactionId ?? (event.traceId ? event.traceId : undefined);
        if (error.parent_id === undefined) {
            delete error.parent_id;
        }
        if (event.culprit) {
            error.culprit = event.culprit;
        }
        if (event.transaction) {
            const transaction = this.compact({ ...event.transaction });
            if (Object.keys(transaction).length > 0) {
                error.transaction = transaction;
            }
        }
        const context = {};
        if (event.tags && Object.keys(event.tags).length > 0) {
            context.tags = event.tags;
        }
        if (event.user) {
            context.user = this.compact({ ...event.user });
        }
        if (event.custom && Object.keys(event.custom).length > 0) {
            context.custom = this.compact({ ...event.custom });
        }
        if (Object.keys(context).length > 0) {
            error.context = context;
        }
        await this.post(`${this.metadataLine()}\n${JSON.stringify({ error })}\n`);
    }
    async sendMetric(event) {
        const samples = {};
        for (const [name, sample] of Object.entries(event.samples)) {
            samples[name] = typeof sample === 'number' ? { value: sample } : this.compact({ ...sample });
        }
        const metricset = {
            samples,
            timestamp: (event.timestampMs ?? Date.now()) * 1000,
        };
        if (event.name) {
            metricset.name = event.name;
        }
        if (event.transaction) {
            const transaction = this.compact({ ...event.transaction });
            if (Object.keys(transaction).length > 0) {
                metricset.transaction = transaction;
            }
        }
        if (event.tags && Object.keys(event.tags).length > 0) {
            metricset.tags = event.tags;
        }
        await this.post(`${this.metadataLine()}\n${JSON.stringify({ metricset })}\n`);
    }
    async sendLog(event) {
        const log = this.compact({
            message: event.message,
            '@timestamp': (event.timestampMs ?? Date.now()) * 1000,
            'trace.id': event.traceId,
            'transaction.id': event.transactionId,
            'span.id': event.spanId,
            'log.level': event.level,
            'log.logger': event.logger,
            'event.dataset': event.dataset,
        });
        await this.post(`${this.metadataLine()}\n${JSON.stringify({ log })}\n`);
    }
    async post(payload) {
        if (!this.serverUrl) {
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
            const response = await axios_1.default.post(url, payload, { headers, timeout: 10000 });
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
    metadataLine() {
        const service = this.compact({
            name: this.serviceName,
            version: this.serviceVersion,
            environment: this.serviceEnvironment,
            node: this.serviceNode ? { configured_name: this.serviceNode } : undefined,
            agent: {
                name: this.agentName,
                version: package_json_1.default.version,
                ephemeral_id: this.ephemeralId,
            },
            language: {
                name: 'javascript',
                version: process.versions.node,
            },
            runtime: {
                name: 'node',
                version: process.versions.node,
            },
        });
        const metadata = this.compact({
            service,
            labels: Object.keys(this.globalLabels).length > 0 ? this.globalLabels : undefined,
            system: {
                architecture: process.arch,
                hostname: os.hostname(),
                platform: process.platform,
            },
            process: {
                pid: process.pid,
                title: process.title,
            },
        });
        return JSON.stringify({ metadata });
    }
    compact(obj) {
        const out = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined && value !== null) {
                out[key] = value;
            }
        }
        return out;
    }
    logServerResponse(status, data) {
        if (status === undefined) {
            return;
        }
        const body = data !== undefined && data !== '' ? `: ${JSON.stringify(data)}` : ' (no response body)';
        console.log(`ci-apm-trace: APM server responded with status ${status}${body}`);
    }
    destroy() {
        this.transactions.length = 0;
        this.currentTransaction = null;
    }
    setUserContext(context) {
        if (!this.currentTransaction)
            return false;
        this.currentTransaction.user = { ...context };
        return true;
    }
    setCustomContext(context) {
        if (!this.currentTransaction)
            return false;
        this.currentTransaction.custom = { ...context };
        return true;
    }
    setTransactionName(name) {
        if (!this.currentTransaction)
            return false;
        this.currentTransaction.name = name;
        return true;
    }
    setTransactionOutcome(outcome) {
        if (!this.currentTransaction)
            return false;
        this.currentTransaction.result = outcome;
        return true;
    }
    setSpanOutcome(outcome) {
        if (!this.currentTransaction)
            return false;
        const last = this.currentTransaction.spans[this.currentTransaction.spans.length - 1];
        if (!last)
            return false;
        last.outcome = outcome;
        return true;
    }
    setLabel(key, value) {
        if (!this.currentTransaction)
            return false;
        this.currentTransaction.labels[String(key)] = String(value);
        return true;
    }
    addLabels(labels) {
        if (!this.currentTransaction)
            return false;
        for (const [k, v] of Object.entries(labels)) {
            this.currentTransaction.labels[k] = String(v);
        }
        return true;
    }
    setGlobalLabel(key, value) {
        this.globalLabels[key] = value;
    }
    addErrorFilter(fn) {
        if (typeof fn !== 'function')
            return;
        this.errorFilters.push(fn);
    }
    addTransactionFilter(fn) {
        if (typeof fn !== 'function')
            return;
        this.transactionFilters.push(fn);
    }
    addSpanFilter(fn) {
        if (typeof fn !== 'function')
            return;
        this.spanFilters.push(fn);
    }
    addFilter(fn) {
        this.addErrorFilter(fn);
        this.addTransactionFilter(fn);
        this.addSpanFilter(fn);
    }
    getServiceName() {
        return this.serviceName;
    }
    getServiceVersion() {
        return this.serviceVersion;
    }
    getServiceEnvironment() {
        return this.serviceEnvironment;
    }
    getServiceNodeName() {
        return this.serviceNode;
    }
    serialize(transactions) {
        const lines = [this.metadataLine()];
        for (const t of transactions) {
            for (const span of t.spans) {
                const spanObj = {
                    id: span.id,
                    trace_id: t.traceId,
                    parent_id: t.id,
                    name: span.name,
                    type: span.type,
                    timestamp: span.startMs * 1000,
                    duration: roundMs(span.durationMs),
                    outcome: span.outcome ?? 'success',
                };
                lines.push(JSON.stringify({ span: spanObj }));
            }
            for (const err of t.errors) {
                lines.push(JSON.stringify({
                    error: {
                        id: err.id,
                        trace_id: t.traceId,
                        transaction_id: t.id,
                        parent_id: t.id,
                        timestamp: err.timestampUs,
                        exception: {
                            message: err.message,
                            type: err.type,
                            stacktrace: err.stacktrace,
                        },
                    },
                }));
            }
            const txContext = {};
            if (Object.keys(t.labels).length > 0)
                txContext.tags = t.labels;
            if (t.user)
                txContext.user = this.compact({ ...t.user });
            if (t.custom && Object.keys(t.custom).length > 0)
                txContext.custom = this.compact({ ...t.custom });
            const transactionObj = {
                id: t.id,
                trace_id: t.traceId,
                name: t.name,
                type: t.type,
                result: t.result,
                outcome: t.result === 'failure' ? 'failure' : t.result === 'success' ? 'success' : 'unknown',
                timestamp: t.startMs * 1000,
                duration: roundMs(t.durationMs),
                sampled: true,
                span_count: { started: t.spans.length },
            };
            if (Object.keys(txContext).length > 0)
                transactionObj.context = txContext;
            lines.push(JSON.stringify({ transaction: transactionObj }));
        }
        return `${lines.join('\n')}\n`;
    }
}
let current = new ApmClient();
let started = false;
function initApm(options = {}) {
    current = new ApmClient(options);
    started = true;
    return current;
}
exports.apm = {
    startTransaction: (name, type) => current.startTransaction(name, type),
    startSpan: (name, type) => current.startSpan(name, type),
    captureError: (error) => current.captureError(error),
    flush: () => current.flush(),
    sendSpan: (event) => current.sendSpan(event),
    sendTransaction: (event) => current.sendTransaction(event),
    sendError: (event) => current.sendError(event),
    sendMetric: (event) => current.sendMetric(event),
    sendLog: (event) => current.sendLog(event),
    // parity helpers
    start: (options) => initApm(options),
    destroy: () => {
        if (current.destroy)
            current.destroy();
        started = false;
    },
    isStarted: () => started,
    setUserContext: (ctx) => current.setUserContext ? current.setUserContext(ctx) : false,
    setCustomContext: (ctx) => current.setCustomContext ? current.setCustomContext(ctx) : false,
    setLabel: (k, v) => current.setLabel ? current.setLabel(k, v) : false,
    addLabels: (labels) => current.addLabels ? current.addLabels(labels) : false,
    setTransactionName: (name) => current.setTransactionName ? current.setTransactionName(name) : false,
    setTransactionOutcome: (o) => current.setTransactionOutcome ? current.setTransactionOutcome(o) : false,
    setSpanOutcome: (o) => current.setSpanOutcome ? current.setSpanOutcome(o) : false,
    setGlobalLabel: (k, v) => current.setGlobalLabel ? current.setGlobalLabel(k, v) : undefined,
    addErrorFilter: (fn) => current.addErrorFilter ? current.addErrorFilter(fn) : undefined,
    addTransactionFilter: (fn) => current.addTransactionFilter ? current.addTransactionFilter(fn) : undefined,
    addSpanFilter: (fn) => current.addSpanFilter ? current.addSpanFilter(fn) : undefined,
    addFilter: (fn) => current.addFilter ? current.addFilter(fn) : undefined,
    getServiceName: () => current.getServiceName ? current.getServiceName() : undefined,
    getServiceVersion: () => current.getServiceVersion ? current.getServiceVersion() : undefined,
    getServiceEnvironment: () => current.getServiceEnvironment ? current.getServiceEnvironment() : undefined,
    getServiceNodeName: () => current.getServiceNodeName ? current.getServiceNodeName() : undefined,
};
//# sourceMappingURL=apm.js.map