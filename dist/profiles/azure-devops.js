"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.azureDevopsProfile = void 0;
const common_1 = require("./common");
function buildUrl() {
    const collectionUri = process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI;
    const project = process.env.SYSTEM_TEAMPROJECT;
    const buildId = process.env.BUILD_BUILDID;
    if (collectionUri && project && buildId) {
        return `${collectionUri.replace(/\/+$/, '')}/${project}/_build/results?buildId=${buildId}`;
    }
    return process.env.BUILD_BUILDURI;
}
exports.azureDevopsProfile = {
    name: 'azure-devops',
    applyEnv(env) {
        const set = (key, value) => {
            if (value) {
                env[key] = value;
            }
        };
        set('CI_PROVIDER', 'azure-devops');
        set('BUILD_ID', process.env.BUILD_BUILDID);
        set('BUILD_NUMBER', process.env.BUILD_BUILDNUMBER);
        set('BUILD_BRANCH', process.env.BUILD_SOURCEBRANCHNAME);
        set('BUILD_COMMIT', process.env.BUILD_SOURCEVERSION);
        set('BUILD_REPO', process.env.BUILD_REPOSITORY_NAME);
        set('BUILD_REF', process.env.BUILD_SOURCEBRANCH);
        set('BUILD_DEFINITION_NAME', process.env.BUILD_DEFINITIONNAME);
        set('JOB_ID', process.env.SYSTEM_JOBID);
        set('JOB_NAME', process.env.SYSTEM_JOBNAME);
        set('JOB_STATUS', process.env.AGENT_JOBSTATUS);
        set('BUILD_REPO_URI', process.env.BUILD_REPOSITORY_URI);
        set('BUILD_URL', buildUrl());
        set('BUILD_REQUESTED_FOR', process.env.BUILD_REQUESTEDFOR);
        set('BUILD_REQUESTED_FOR_ID', process.env.BUILD_REQUESTEDFORID);
        set('BUILD_REQUESTED_FOR_EMAIL', process.env.BUILD_REQUESTEDFOREMAIL);
        set('AGENT_NAME', process.env.AGENT_NAME);
        set('RUNNER_OS', process.env.AGENT_OS);
        set('RUNNER_ARCH', process.env.AGENT_OSARCHITECTURE);
    },
    pipelineName() {
        return process.env.BUILD_DEFINITIONNAME || 'azure-pipelines';
    },
    pipelineTags() {
        const branch = process.env.BUILD_SOURCEBRANCHNAME;
        const commit = process.env.BUILD_SOURCEVERSION;
        const repo = process.env.BUILD_REPOSITORY_NAME;
        return (0, common_1.pickStrings)({
            definition_name: process.env.BUILD_DEFINITIONNAME,
            build_id: process.env.BUILD_BUILDID,
            build_number: process.env.BUILD_BUILDNUMBER,
            branch,
            commit,
            repo,
            ci_provider: 'azure-devops',
            runner_os: process.env.AGENT_OS,
            runner_arch: process.env.AGENT_OSARCHITECTURE,
            'ci.pipeline.id': process.env.BUILD_DEFINITIONID,
            'ci.pipeline.name': process.env.BUILD_DEFINITIONNAME,
            'ci.pipeline.run.id': process.env.BUILD_BUILDID,
            'ci.pipeline.run.number': process.env.BUILD_BUILDNUMBER,
            'ci.pipeline.run.url': buildUrl(),
            'ci.pipeline.run.user': process.env.BUILD_REQUESTEDFOR,
            'ci.pipeline.run.result': process.env.AGENT_JOBSTATUS,
            'ci.pipeline.agent.name': process.env.AGENT_NAME,
            'ci.job.id': process.env.SYSTEM_JOBID,
            'ci.job.name': process.env.SYSTEM_JOBNAME,
            'ci.job.status': process.env.AGENT_JOBSTATUS,
            'ci.step.name': 'CiApmTrace',
            'ci.build.ref': branch,
            'ci.build.commit': commit,
            'ci.build.repo': repo,
            'vcs.repository.url': process.env.BUILD_REPOSITORY_URI,
            'vcs.ref.head.name': process.env.BUILD_SOURCEBRANCH,
            'vcs.commit.id': commit,
        });
    },
    pipelineCustom() {
        return (0, common_1.pickValues)({
            definition_id: process.env.BUILD_DEFINITIONID,
            definition_name: process.env.BUILD_DEFINITIONNAME,
            build_id: process.env.BUILD_BUILDID,
            build_number: process.env.BUILD_BUILDNUMBER,
            build_url: buildUrl(),
            queued_by: process.env.BUILD_QUEUEDBY,
            requested_for: process.env.BUILD_REQUESTEDFOR,
            agent_name: process.env.AGENT_NAME,
            agent_version: process.env.AGENT_VERSION,
            job_id: process.env.SYSTEM_JOBID,
            job_name: process.env.SYSTEM_JOBNAME,
            project: process.env.SYSTEM_TEAMPROJECT,
            collection_uri: process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI,
            repo_uri: process.env.BUILD_REPOSITORY_URI,
        });
    },
};
exports.default = exports.azureDevopsProfile;
//# sourceMappingURL=azure-devops.js.map