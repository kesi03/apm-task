"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRuntimeMetrics = sendRuntimeMetrics;
function countActive(source) {
    if (typeof source !== 'function') {
        return 0;
    }
    try {
        const items = source.call(process);
        return Array.isArray(items) ? items.length : 0;
    }
    catch {
        return 0;
    }
}
function sampleEventLoopDelay(windowMs = 300) {
    return new Promise((resolve) => {
        const baselineMs = 1;
        let last = process.hrtime.bigint();
        const samples = [];
        const deadline = Date.now() + windowMs;
        const finish = () => {
            const avg = samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
            resolve(Math.max(0, avg - baselineMs));
        };
        const timer = setTimeout(finish, windowMs);
        if (typeof timer.unref === 'function') {
            timer.unref();
        }
        const tick = () => {
            const now = process.hrtime.bigint();
            const delayMs = Number((now - last) / 1000000n);
            last = now;
            samples.push(delayMs);
            if (Date.now() >= deadline) {
                clearTimeout(timer);
                finish();
            }
            else {
                setImmediate(tick);
            }
        };
        setImmediate(tick);
    });
}
async function sendRuntimeMetrics(agent, options) {
    try {
        const memory = process.memoryUsage();
        const internalProcess = process;
        const eventLoopDelay = await sampleEventLoopDelay();
        await agent.sendMetric({
            name: 'nodejs',
            timestampMs: Date.now(),
            samples: {
                'nodejs.memory.heap.allocated.bytes': memory.heapTotal,
                'nodejs.memory.heap.used.bytes': memory.heapUsed,
                'nodejs.memory.external.bytes': memory.external,
                'nodejs.memory.arrayBuffers.bytes': memory.arrayBuffers ?? 0,
                'nodejs.handles.active': countActive(internalProcess._getActiveHandles),
                'nodejs.requests.active': countActive(internalProcess._getActiveRequests),
                'nodejs.eventloop.delay.avg.ms': eventLoopDelay,
            },
            transaction: options.transaction,
            tags: {
                'metricset.name': 'nodejs',
                ...options.tags,
            },
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`ci-apm-trace: failed to collect/send Node.js runtime metrics: ${message}`);
    }
}
//# sourceMappingURL=runtime-metrics.js.map