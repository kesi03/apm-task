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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ECS_VERSION = void 0;
exports.buildEcsMetricsRecord = buildEcsMetricsRecord;
exports.sendEcsMetrics = sendEcsMetrics;
const os = __importStar(require("os"));
const si = __importStar(require("systeminformation"));
exports.ECS_VERSION = '8.11.0';
async function buildEcsMetricsRecord(serviceName, serviceVersion = '1.0.0') {
    const timestamp = new Date().toISOString();
    const cpu = await si.cpu();
    const cpuLoad = await si.currentLoad();
    const mem = await si.mem();
    const disks = await si.fsSize();
    const osInfo = await si.osInfo();
    const processCpuUsage = process.cpuUsage();
    const cpuCores = Math.max(cpu.cores, 1);
    const uptimeSec = process.uptime();
    const processCpuTotalNormPct = uptimeSec > 0
        ? Math.min(((processCpuUsage.user + processCpuUsage.system) / 1e6) / (uptimeSec * cpuCores), 1)
        : 0;
    const systemCpuTotalNormPct = cpuLoad.currentLoad / 100;
    return {
        '@timestamp': timestamp,
        'ecs.version': exports.ECS_VERSION,
        'event.kind': 'metric',
        'event.category': 'metric',
        'event.type': 'measurement',
        'metricset.name': 'system',
        'service.name': serviceName,
        'service.version': serviceVersion,
        'agent.name': 'nodejs',
        'host.name': os.hostname(),
        'host.architecture': os.arch(),
        'host.os.name': osInfo.distro,
        'host.os.version': osInfo.release,
        'system.cpu.cores': cpu.cores,
        'system.cpu.total.pct': systemCpuTotalNormPct,
        'system.cpu.total.norm.pct': systemCpuTotalNormPct,
        'system.process.cpu.total.norm.pct': processCpuTotalNormPct,
        'system.cpu.user.pct': cpuLoad.currentLoadUser / 100,
        'system.cpu.system.pct': cpuLoad.currentLoadSystem / 100,
        'system.memory.total': mem.total,
        'system.memory.actual.free': mem.free,
        'system.memory.actual.used': mem.used,
        'system.memory.used.pct': mem.total > 0 ? mem.used / mem.total : 0,
        'system.filesystem': disks.map((disk) => {
            const total = disk.size;
            const used = disk.used;
            return {
                mount_point: disk.mount,
                total,
                used,
                available: disk.available,
                used_pct: total > 0 ? used / total : 0,
            };
        }),
    };
}
async function sendEcsMetrics(agent, options) {
    try {
        const record = await buildEcsMetricsRecord(options.serviceName, options.serviceVersion);
        const baseTags = {
            'metricset.name': 'system',
            ...options.tags,
        };
        await agent.sendMetric({
            name: 'system',
            samples: {
                'system.cpu.cores': record['system.cpu.cores'],
                'system.cpu.total.pct': record['system.cpu.total.pct'],
                'system.cpu.total.norm.pct': record['system.cpu.total.norm.pct'],
                'system.process.cpu.total.norm.pct': record['system.process.cpu.total.norm.pct'],
                'system.cpu.user.pct': record['system.cpu.user.pct'],
                'system.cpu.system.pct': record['system.cpu.system.pct'],
                'system.memory.total': record['system.memory.total'],
                'system.memory.actual.free': record['system.memory.actual.free'],
                'system.memory.actual.used': record['system.memory.actual.used'],
                'system.memory.used.pct': record['system.memory.used.pct'],
            },
            transaction: options.transaction,
            tags: {
                ...baseTags,
                'host.name': record['host.name'],
                'host.architecture': record['host.architecture'],
                'host.os.name': record['host.os.name'],
                'host.os.version': record['host.os.version'],
                'service.name': record['service.name'],
                'service.version': record['service.version'],
                'agent.name': record['agent.name'],
            },
        });
        for (const fs of record['system.filesystem']) {
            await agent.sendMetric({
                name: 'system',
                samples: {
                    'system.filesystem.total': fs.total,
                    'system.filesystem.used': fs.used,
                    'system.filesystem.available': fs.available,
                    'system.filesystem.used.pct': fs.used_pct,
                },
                transaction: options.transaction,
                tags: {
                    ...baseTags,
                    'system.filesystem.mount_point': fs.mount_point,
                },
            });
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`ci-apm-trace: failed to collect/send ECS system metrics: ${message}`);
    }
}
//# sourceMappingURL=ecs-metrics.js.map