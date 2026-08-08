export function applyGitHubEnv(env: NodeJS.ProcessEnv): void {
  const set = (key: string, value: string | undefined): void => {
    if (value) {
      env[key] = value
    }
  }

  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com'
  const repo = process.env.GITHUB_REPOSITORY

  set('CI_PROVIDER', 'github-actions')
  set('BUILD_ID', process.env.GITHUB_RUN_ID)
  set('BUILD_NUMBER', process.env.GITHUB_RUN_NUMBER)
  set('BUILD_BRANCH', process.env.GITHUB_REF_NAME)
  set('BUILD_COMMIT', process.env.GITHUB_SHA)
  set('BUILD_REPO', repo)
  set('BUILD_REF', process.env.GITHUB_REF_NAME)
  set('BUILD_DEFINITION_NAME', process.env.GITHUB_WORKFLOW)
  set('JOB_ID', process.env.GITHUB_JOB)
  set('JOB_NAME', process.env.GITHUB_JOB)
  set('BUILD_REPO_URI', repo ? `${serverUrl}/${repo}` : undefined)
  set('BUILD_URL', repo && process.env.GITHUB_RUN_ID ? `${serverUrl}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined)
}
