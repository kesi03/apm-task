"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubActionProfile = void 0;
const common_1 = require("./common");
exports.githubActionProfile = {
    name: 'github-action',
    applyEnv(env) {
        const set = (key, value) => {
            if (value) {
                env[key] = value;
            }
        };
        const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
        const repo = process.env.GITHUB_REPOSITORY;
        set('CI_PROVIDER', 'github-action');
        set('BUILD_ID', process.env.GITHUB_RUN_ID);
        set('BUILD_NUMBER', process.env.GITHUB_RUN_NUMBER);
        set('BUILD_BRANCH', process.env.GITHUB_REF_NAME);
        set('BUILD_COMMIT', process.env.GITHUB_SHA);
        set('BUILD_REPO', repo);
        set('BUILD_REF', process.env.GITHUB_REF_NAME);
        set('BUILD_DEFINITION_NAME', process.env.GITHUB_WORKFLOW);
        set('JOB_ID', process.env.GITHUB_JOB);
        set('JOB_NAME', process.env.GITHUB_JOB);
        set('BUILD_REPO_URI', repo ? `${serverUrl}/${repo}` : undefined);
        set('BUILD_URL', repo && process.env.GITHUB_RUN_ID ? `${serverUrl}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined);
        set('BUILD_REQUESTED_FOR', process.env.GITHUB_ACTOR);
        set('BUILD_REQUESTED_FOR_ID', process.env.GITHUB_ACTOR_ID);
        set('BUILD_REQUESTED_FOR_EMAIL', process.env.GITHUB_ACTOR_EMAIL);
        set('AGENT_NAME', process.env.RUNNER_NAME);
    },
    pipelineName() {
        return process.env.GITHUB_WORKFLOW || 'github-action';
    },
    pipelineTags() {
        const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
        const repo = process.env.GITHUB_REPOSITORY;
        const branch = process.env.GITHUB_REF_NAME;
        const commit = process.env.GITHUB_SHA;
        return (0, common_1.pickStrings)({
            definition_name: process.env.GITHUB_WORKFLOW,
            build_id: process.env.GITHUB_RUN_ID,
            build_number: process.env.GITHUB_RUN_NUMBER,
            branch,
            commit,
            repo,
            ci_provider: 'github-action',
            runner_os: process.env.RUNNER_OS,
            runner_arch: process.env.RUNNER_ARCH,
            'ci.pipeline.id': process.env.GITHUB_RUN_ID,
            'ci.pipeline.name': process.env.GITHUB_WORKFLOW,
            'ci.pipeline.run.id': process.env.GITHUB_RUN_ID,
            'ci.pipeline.run.number': process.env.GITHUB_RUN_NUMBER,
            'ci.pipeline.run.url': repo && process.env.GITHUB_RUN_ID ? `${serverUrl}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined,
            'ci.pipeline.run.user': process.env.GITHUB_ACTOR,
            'ci.pipeline.run.result': process.env.JOB_STATUS,
            'ci.pipeline.agent.name': process.env.RUNNER_NAME,
            'ci.job.id': process.env.GITHUB_JOB,
            'ci.job.name': process.env.GITHUB_JOB,
            'ci.job.status': process.env.JOB_STATUS,
            'ci.step.name': 'ci-apm-trace',
            'ci.build.ref': branch,
            'ci.build.commit': commit,
            'ci.build.repo': repo,
            'vcs.repository.url': repo ? `${serverUrl}/${repo}` : undefined,
            'vcs.ref.head.name': process.env.GITHUB_REF_NAME,
            'vcs.commit.id': commit,
        });
    },
    pipelineCustom() {
        const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
        const repo = process.env.GITHUB_REPOSITORY;
        const runId = process.env.GITHUB_RUN_ID;
        return (0, common_1.pickValues)({
            provider: 'github-action',
            workflow: process.env.GITHUB_WORKFLOW,
            workflow_ref: process.env.GITHUB_WORKFLOW_REF,
            definition_name: process.env.GITHUB_WORKFLOW,
            build_id: runId,
            build_number: process.env.GITHUB_RUN_NUMBER,
            build_url: repo && runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : undefined,
            run_attempt: process.env.GITHUB_RUN_ATTEMPT ? Number(process.env.GITHUB_RUN_ATTEMPT) : undefined,
            event: process.env.GITHUB_EVENT_NAME,
            ref: process.env.GITHUB_REF,
            branch: process.env.GITHUB_REF_NAME,
            commit: process.env.GITHUB_SHA,
            repo,
            repo_url: repo ? `${serverUrl}/${repo}` : undefined,
            requested_for: process.env.GITHUB_ACTOR,
            actor_id: process.env.GITHUB_ACTOR_ID,
            actor_email: process.env.GITHUB_ACTOR_EMAIL,
            job_id: process.env.GITHUB_JOB,
            job_name: process.env.GITHUB_JOB,
            agent_name: process.env.RUNNER_NAME,
            runner_os: process.env.RUNNER_OS,
            runner_arch: process.env.RUNNER_ARCH,
            server_url: process.env.GITHUB_SERVER_URL,
            api_url: process.env.GITHUB_API_URL,
        });
    },
};
exports.default = exports.githubActionProfile;
//# sourceMappingURL=github-action.js.map