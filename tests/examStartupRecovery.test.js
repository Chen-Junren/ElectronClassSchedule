const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePendingExamOnStartup } = require('../electron/examStartupRecovery');

function setup({ pending = null, response = 0, dialogError = null } = {}) {
    const calls = { prompts: [], resumed: 0, interrupted: 0, errors: [] };
    const examManager = {
        getPersistedActiveSession: () => pending,
        resumeAfterRestart: () => { calls.resumed += 1; },
        interruptForRestart: () => { calls.interrupted += 1; }
    };
    const dialog = {
        showMessageBox: async options => {
            calls.prompts.push(options);
            if (dialogError) throw dialogError;
            return { response };
        }
    };
    const logger = { error: (...args) => calls.errors.push(args) };
    return { calls, examManager, dialog, logger };
}

test('startup recovery does nothing when there is no pending session', async () => {
    const deps = setup();
    assert.equal(await resolvePendingExamOnStartup(deps), false);
    assert.equal(deps.calls.prompts.length, 0);
    assert.equal(deps.calls.resumed, 0);
    assert.equal(deps.calls.interrupted, 0);
});

test('startup recovery does not prompt for a finished session', async () => {
    const deps = setup({ pending: { title: '数学周测', status: 'finished' } });
    assert.equal(await resolvePendingExamOnStartup(deps), false);
    assert.equal(deps.calls.prompts.length, 0);
});

test('choosing resume continues a running exam and explains wall-clock recovery', async () => {
    const deps = setup({
        pending: { title: '数学周测', status: 'running' },
        response: 0
    });
    assert.equal(await resolvePendingExamOnStartup(deps), true);
    assert.equal(deps.calls.resumed, 1);
    assert.equal(deps.calls.interrupted, 0);
    assert.deepEqual(deps.calls.prompts[0].buttons, ['恢复考试', '结束并记录中断']);
    assert.match(deps.calls.prompts[0].detail, /真实经过的时间/);
});

test('choosing resume preserves a paused session and explains paused recovery', async () => {
    const deps = setup({
        pending: { title: '英语', status: 'paused' },
        response: 0
    });
    await resolvePendingExamOnStartup(deps);
    assert.equal(deps.calls.resumed, 1);
    assert.match(deps.calls.prompts[0].detail, /仍保持暂停/);
});

test('choosing interruption records the session as interrupted', async () => {
    const deps = setup({
        pending: { title: '物理', status: 'running' },
        response: 1
    });
    await resolvePendingExamOnStartup(deps);
    assert.equal(deps.calls.interrupted, 1);
    assert.equal(deps.calls.resumed, 0);
});

test('dialog errors are logged and safely fall back to resuming the exam', async () => {
    const error = new Error('dialog unavailable');
    const deps = setup({
        pending: { title: '化学', status: 'running' },
        dialogError: error
    });
    await resolvePendingExamOnStartup(deps);
    assert.equal(deps.calls.resumed, 1);
    assert.equal(deps.calls.interrupted, 0);
    assert.equal(deps.calls.errors.length, 1);
    assert.equal(deps.calls.errors[0][0], 'exam.startup_recovery_prompt_failed');
    assert.equal(deps.calls.errors[0][1], error);
});
