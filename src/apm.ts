import apm from 'elastic-apm-node'

export interface ApmInitOptions {
  serverUrl?: string
  secretToken?: string
  serviceName?: string
}

export function initApm(options: ApmInitOptions = {}): typeof apm {
  const serverUrl = options.serverUrl ?? process.env.ELASTIC_APM_SERVER_URL
  const secretToken = options.secretToken ?? process.env.ELASTIC_APM_SECRET_TOKEN
  const serviceName = options.serviceName ?? process.env.ELASTIC_APM_SERVICE_NAME ?? 'ci-apm-trace'

  if (serverUrl) {
    process.env.ELASTIC_APM_SERVER_URL = serverUrl
  }
  if (secretToken) {
    process.env.ELASTIC_APM_SECRET_TOKEN = secretToken
  }
  process.env.ELASTIC_APM_SERVICE_NAME = serviceName
  process.env.ELASTIC_APM_ENVIRONMENT = 'ci'

  apm.start({
    serviceName,
    environment: 'ci',
    ...(serverUrl ? { serverUrl } : {}),
    ...(secretToken ? { secretToken } : {}),
  })

  return apm
}
