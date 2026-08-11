"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jenkinsProfile = void 0;
const common_1 = require("./common");
function repoName(gitUrl) {
    if (!gitUrl) {
        return undefined;
    }
    const match = gitUrl.replace(/\/+$/, '').match(/([^/]+)\.git$/);
    return match ? match[1] : gitUrl.split('/').pop();
}
exports.jenkinsProfile = {
    name: 'jenkins',
    applyEnv(env) {
        const set = (key, value) => {
            if (value) {
                env[key] = value;
            }
        };
        set('CI_PROVIDER', 'jenkins');
        set('BUILD_ID', process.env.BUILD_ID);
        set('BUILD_NUMBER', process.env.BUILD_NUMBER);
        set('BUILD_BRANCH', process.env.GIT_BRANCH || process.env.BRANCH_NAME);
        set('BUILD_COMMIT', process.env.GIT_COMMIT);
        set('BUILD_REPO', repoName(process.env.GIT_URL));
        set('BUILD_REF', process.env.GIT_BRANCH);
        set('BUILD_DEFINITION_NAME', process.env.JOB_NAME);
        set('BUILD_URL', process.env.BUILD_URL);
        set('BUILD_REPO_URI', process.env.GIT_URL);
        set('JOB_ID', process.env.BUILD_ID);
        set('JOB_NAME', process.env.JOB_NAME);
        set('BUILD_REQUESTED_FOR', process.env.CHANGE_AUTHOR);
        set('AGENT_NAME', process.env.NODE_NAME);
    },
    pipelineName() {
        return process.env.JOB_NAME || 'jenkins';
    },
    pipelineTags() {
        const branch = process.env.GIT_BRANCH || process.env.BRANCH_NAME;
        const commit = process.env.GIT_COMMIT;
        const repo = repoName(process.env.GIT_URL);
        return (0, common_1.pickStrings)({
            definition_name: process.env.JOB_NAME,
            build_id: process.env.BUILD_ID,
            build_number: process.env.BUILD_NUMBER,
            branch,
            commit,
            repo,
            ci_provider: 'jenkins',
            'ci.pipeline.id': process.env.BUILD_ID,
            'ci.pipeline.name': process.env.JOB_NAME,
            'ci.pipeline.run.id': process.env.BUILD_ID,
            'ci.pipeline.run.number': process.env.BUILD_NUMBER,
            'ci.pipeline.run.url': process.env.BUILD_URL,
            'ci.pipeline.run.user': process.env.CHANGE_AUTHOR,
            'ci.pipeline.agent.name': process.env.NODE_NAME,
            'ci.job.id': process.env.BUILD_ID,
            'ci.job.name': process.env.JOB_NAME,
            'ci.step.name': 'ci-apm-trace',
            'ci.build.ref': branch,
            'ci.build.commit': commit,
            'ci.build.repo': repo,
            'vcs.repository.url': process.env.GIT_URL,
            'vcs.ref.head.name': process.env.GIT_BRANCH,
            'vcs.commit.id': commit,
        });
    },
    pipelineCustom() {
        return (0, common_1.pickValues)({
            provider: 'jenkins',
            definition_name: process.env.JOB_NAME,
            job_base_name: process.env.JOB_BASE_NAME,
            build_id: process.env.BUILD_ID,
            build_number: process.env.BUILD_NUMBER,
            build_tag: process.env.BUILD_TAG,
            build_url: process.env.BUILD_URL,
            requested_for: process.env.CHANGE_AUTHOR,
            agent_name: process.env.NODE_NAME,
            agent_labels: process.env.NODE_LABELS,
            workspace: process.env.WORKSPACE,
            executor_number: process.env.EXECUTOR_NUMBER,
            git_url: process.env.GIT_URL,
            git_branch: process.env.GIT_BRANCH,
            git_commit: process.env.GIT_COMMIT,
            git_previous_commit: process.env.GIT_PREVIOUS_COMMIT,
            change_id: process.env.CHANGE_ID,
            change_url: process.env.CHANGE_URL,
            change_target: process.env.CHANGE_TARGET,
            change_title: process.env.CHANGE_TITLE,
            change_author: process.env.CHANGE_AUTHOR,
            change_author_email: process.env.CHANGE_AUTHOR_EMAIL,
            jenkins_url: process.env.JENKINS_URL,
        });
    },
};
exports.default = exports.jenkinsProfile;
//# sourceMappingURL=jenkins.js.map