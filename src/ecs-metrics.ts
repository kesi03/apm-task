import * as os from 'os'
import * as si from 'systeminformation'
import { ApmAgent } from './apm'

export const ECS_VERSION = '8.11.0'

export interface FilesystemEntry {
  mount_point: string
  total: number
  used: number
  available: number
  used_pct: number
}

export interface EcsMetricsRecord {
  '@timestamp': string
  'ecs.version': string
  'event.kind': string
  'event.category': string
  'event.type': string
  'metricset.name': string
  'service.name': string
  'service.version': string
  'agent.name': string
  'host.name': string
  'host.architecture': string
  'host.os.name': string
  'host.os.version': string
  'system.cpu.cores': number
  'system.cpu.total.pct': number
  'system.cpu.total.norm.pct': number
  'system.process.cpu.total.norm.pct': number
  'system.cpu.user.pct': number
  'system.cpu.system.pct': number
  'system.memory.total': number
  'system.memory.actual.free': number
  'system.memory.actual.used': number
  'system.memory.used.pct': number
  'system.filesystem': FilesystemEntry[]
}

export async function buildEcsMetricsRecord(
  serviceName: string,
  serviceVersion = '1.0.0'
): Promise<EcsMetricsRecord> {
  const timestamp = new Date().toISOString()

  const cpu = await si.cpu()
  const cpuLoad = await si.currentLoad()
  const mem = await si.mem()
  const disks = await si.fsSize()
  const osInfo = await si.osInfo()

  const processCpuUsage = process.cpuUsage()
  const cpuCores = Math.max(cpu.cores, 1)
  const uptimeSec = process.uptime()
  const processCpuTotalNormPct =
    uptimeSec > 0
      ? Math.min(((processCpuUsage.user + processCpuUsage.system) / 1e6) / (uptimeSec * cpuCores), 1)
      : 0
  const systemCpuTotalNormPct = cpuLoad.currentLoad / 100

  return {
    '@timestamp': timestamp,
    'ecs.version': ECS_VERSION,

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
      const total = disk.size
      const used = disk.used
      return {
        mount_point: disk.mount,
        total,
        used,
        available: disk.available,
        used_pct: total > 0 ? used / total : 0,
      }
    }),
  }
}

export interface EcsMetricsOptions {
  serviceName: string
  serviceVersion?: string
  transaction?: { name?: string; type?: string }
  tags?: Record<string, string>
}

export async function sendEcsMetrics(agent: ApmAgent, options: EcsMetricsOptions): Promise<void> {
  try {
    const record = await buildEcsMetricsRecord(options.serviceName, options.serviceVersion)

    const baseTags: Record<string, string> = {
      'metricset.name': 'system',
      ...options.tags,
    }

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
    })

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
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`ci-apm-trace: failed to collect/send ECS system metrics: ${message}`)
  }
}
