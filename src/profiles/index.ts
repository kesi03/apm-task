import azureDevopsProfile from './azure-devops'
import dockerProfile from './docker'
import githubActionProfile from './github-action'
import jenkinsProfile from './jenkins'
import k8sProfile from './k8s'
import npmProfile from './npm'
import taskProfile from './task'
import teamCityProfile from './team-city'
import { PipelineProfile } from './types'

export const profiles: Record<string, PipelineProfile> = {
  [npmProfile.name]: npmProfile,
  [githubActionProfile.name]: githubActionProfile,
  [azureDevopsProfile.name]: azureDevopsProfile,
  [teamCityProfile.name]: teamCityProfile,
  [jenkinsProfile.name]: jenkinsProfile,
  [dockerProfile.name]: dockerProfile,
  [k8sProfile.name]: k8sProfile,
  [taskProfile.name]: taskProfile,
}

export function getProfile(platform: string | undefined): PipelineProfile {
  if (platform && profiles[platform]) {
    return profiles[platform]
  }
  return npmProfile
}
