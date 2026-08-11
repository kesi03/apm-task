"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLifecycle = createLifecycle;
const apm_1 = require("./apm");
function createLifecycle(agent = apm_1.apm) {
    let transaction = null;
    let currentSpan = null;
    function endStep() {
        if (currentSpan) {
            currentSpan.end();
            currentSpan = null;
        }
    }
    function setLabels(labels) {
        if (!transaction) {
            return;
        }
        if (labels.buildId) {
            transaction.setLabel('build_id', labels.buildId);
        }
        if (labels.buildNumber) {
            transaction.setLabel('build_number', labels.buildNumber);
        }
        if (labels.branch) {
            transaction.setLabel('branch', labels.branch);
        }
        if (labels.commit) {
            transaction.setLabel('commit', labels.commit);
        }
        if (labels.repo) {
            transaction.setLabel('repo', labels.repo);
        }
        if (labels.ciProvider) {
            transaction.setLabel('ci_provider', labels.ciProvider);
        }
        if (labels.runnerOs) {
            transaction.setLabel('runner_os', labels.runnerOs);
        }
        if (labels.runnerArch) {
            transaction.setLabel('runner_arch', labels.runnerArch);
        }
    }
    return {
        startPipeline(name, labels = {}) {
            endStep();
            const traceName = labels.buildId ? `${name}-${labels.buildId}` : name;
            transaction = agent.startTransaction(traceName, 'pipeline');
            setLabels(labels);
        },
        addStep(name) {
            endStep();
            if (transaction) {
                currentSpan = agent.startSpan(name, 'step') ?? null;
            }
        },
        async endPipelineSuccess() {
            endStep();
            if (transaction) {
                transaction.result = 'success';
                transaction.end();
            }
            transaction = null;
            await agent.flush();
        },
        async endPipelineFailure(error) {
            endStep();
            if (transaction) {
                agent.captureError(error);
                transaction.result = 'failure';
                transaction.end();
            }
            transaction = null;
            await agent.flush();
        },
    };
}
//# sourceMappingURL=lifecycle.js.map