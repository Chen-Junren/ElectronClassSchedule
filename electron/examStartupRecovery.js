async function resolvePendingExamOnStartup({ examManager, dialog, logger }) {
    if (!examManager || !dialog || typeof dialog.showMessageBox !== 'function') {
        throw new TypeError('Startup recovery requires an exam manager and dialog');
    }

    const pending = examManager.getPersistedActiveSession();
    if (!pending || !['running', 'paused'].includes(pending.status)) return false;

    const isPaused = pending.status === 'paused';
    try {
        const choice = await dialog.showMessageBox({
            type: 'question',
            title: '上次的考试尚未结束',
            message: '检测到一场尚未结束的考试：' + pending.title,
            detail: isPaused
                ? '上次关闭前计时处于暂停状态。恢复后仍保持暂停；也可以结束并将本场记为中断。'
                : '恢复后将按真实经过的时间重新计算剩余时间；也可以结束并将本场记为中断。',
            buttons: ['恢复考试', '结束并记录中断'],
            defaultId: 0,
            cancelId: 0,
            noLink: true
        });
        if (choice.response === 1) {
            examManager.interruptForRestart();
        } else {
            examManager.resumeAfterRestart();
        }
    } catch (error) {
        if (logger && typeof logger.error === 'function') {
            logger.error('exam.startup_recovery_prompt_failed', error);
        }
        examManager.resumeAfterRestart();
    }
    return true;
}

module.exports = { resolvePendingExamOnStartup };
