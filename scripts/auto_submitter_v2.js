import { cli, Strategy } from '@jackwener/opencli/registry';
import fs from 'fs';

cli({
    site: 'chaoxing',
    name: 'chaoxing-submit',
    access: 'write',
    description: 'Universal homework auto-submitter with state-aware anti-toggle guards and UEditor sync',
    domain: 'mooc2-ans.chaoxing.com',
    strategy: Strategy.COOKIE,
    args: [],
    columns: ['task', 'status', 'filledCount', 'totalCount', 'msg'],
    func: async (page) => {
        const configFile = fs.existsSync('config.json') ? 'config.json' : 'config.example.json';
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        const taskAnswersFile = process.env.ANSWERS_FILE || (fs.existsSync('task_answers.json') ? 'task_answers.json' : 'official_view_answers.json');
        const taskAnswers = fs.existsSync(taskAnswersFile) ? JSON.parse(fs.readFileSync(taskAnswersFile, 'utf-8')) : {};
        const tasks = config.tasks || [];

        const results = [];

        for (const t of tasks) {
            console.log(`\n========================================`);
            console.log(`Starting ${t.name}...`);
            const answersList = taskAnswers[t.name] || [];
            const targetUrl = t.url || t.doworkUrl || t.viewUrl;
            if (!targetUrl) {
                console.warn(`[Warning] No URL specified for ${t.name}, skipping.`);
                continue;
            }
            await page.goto(targetUrl);
            await page.wait(3);

            // Step 1: Fill form
            const fillRes = await page.evaluate(async (answers) => {
                const qBlocks = Array.from(document.querySelectorAll('.questionLi'));
                if (qBlocks.length === 0) {
                    return {
                        alreadySubmitted: true,
                        total: 0,
                        filled: 0,
                        body: document.body.innerText.slice(0, 300)
                    };
                }

                let filled = 0;
                const errLog = [];

                for (let i = 0; i < qBlocks.length; i++) {
                    const qb = qBlocks[i];
                    const h3 = qb.querySelector('h3.mark_name');
                    const h3Text = h3 ? h3.innerText : '';
                    
                    const numMatch = h3Text.match(/(\d+)\./);
                    const qNum = numMatch ? parseInt(numMatch[1]) : (i + 1);
                    
                    const ansItem = answers.find(a => a.num === qNum) || answers[i];
                    if (!ansItem) continue;

                    const ansStr = (ansItem.answer || '').trim();

                    try {
                        if (h3Text.includes('单选题')) {
                            const letterMatch = ansStr.match(/^[A-H]/i);
                            if (letterMatch) {
                                const targetLetter = letterMatch[0].toUpperCase();
                                let span = qb.querySelector(`.answerBg span[data="${targetLetter}"]`);
                                if (!span) {
                                    const spans = Array.from(qb.querySelectorAll('.answerBg span'));
                                    span = spans.find(s => s.innerText.trim() === targetLetter);
                                }
                                const bg = span ? span.closest('.answerBg') : null;
                                if (bg) {
                                    bg.click();
                                    filled++;
                                }
                            }
                        } else if (h3Text.includes('判断题')) {
                            const isCorrect = /(正确|对|true|^A$)/i.test(ansStr);
                            const targetData = isCorrect ? 'true' : 'false';
                            const targetLetter = isCorrect ? 'A' : 'B';
                            let span = qb.querySelector(`.answerBg span[data="${targetData}"]`);
                            if (!span) {
                                span = qb.querySelector(`.answerBg span[data="${targetLetter}"]`);
                            }
                            if (!span) {
                                const spans = Array.from(qb.querySelectorAll('.answerBg span'));
                                span = spans.find(s => s.innerText.trim() === targetLetter);
                            }
                            const bg = span ? span.closest('.answerBg') : null;
                            if (bg) {
                                bg.click();
                                filled++;
                            }
                        } else if (h3Text.includes('多选题')) {
                            const letters = ansStr.match(/[A-H]/gi) || [];
                            const unique = [...new Set(letters.map(l => l.toUpperCase()))];
                            for (const l of unique) {
                                let span = qb.querySelector(`.answerBg span[data="${l}"]`);
                                if (!span) {
                                    const spans = Array.from(qb.querySelectorAll('.answerBg span'));
                                    span = spans.find(s => s.innerText.trim() === l);
                                }
                                const bg = span ? span.closest('.answerBg') : null;
                                if (bg) {
                                    // Check if already checked
                                    const isChecked = bg.classList.contains('check_answer') || 
                                                      bg.classList.contains('check_answer_DX') ||
                                                      bg.getAttribute('aria-checked') === 'true';
                                    if (!isChecked) {
                                        bg.click();
                                    }
                                }
                            }
                            if (unique.length > 0) filled++;
                        } else if (h3Text.includes('填空题')) {
                            const textareas = Array.from(qb.querySelectorAll('textarea[name^="answerEditor"]'));
                            const parts = ansStr.split(/[,，、;；\n\t]+/).map(s => s.trim()).filter(Boolean);
                            for (let idx = 0; idx < textareas.length; idx++) {
                                const ta = textareas[idx];
                                const val = parts[idx] !== undefined ? parts[idx] : (parts[0] || ansStr);
                                ta.value = val;
                                ta.dispatchEvent(new Event('input', { bubbles: true }));
                                ta.dispatchEvent(new Event('change', { bubbles: true }));
                                ta.dispatchEvent(new Event('blur', { bubbles: true }));
                            }
                            if (textareas.length > 0) filled++;
                        }
                    } catch(e) {
                        errLog.push(`Q${qNum}: ${e.message}`);
                    }
                }

                // Call saveWork
                try {
                    if (typeof window.saveWork === 'function') {
                        window.saveWork();
                    }
                } catch(e) {}

                return {
                    alreadySubmitted: false,
                    total: qBlocks.length,
                    filled: filled,
                    errLog
                };
            }, answersList);

            console.log(`Filled ${t.name}: ${fillRes.filled}/${fillRes.total}`);
            await page.wait(3);

            if (fillRes.alreadySubmitted) {
                results.push({
                    task: t.name,
                    status: "ALREADY_SUBMITTED",
                    filledCount: 0,
                    totalCount: 0,
                    msg: "Task was already submitted or viewed"
                });
                continue;
            }

            // Step 2: Trigger submission
            const submitRes = await page.evaluate(async () => {
                let status = "attempting_submit";
                try {
                    if (typeof window.ready2Submit === 'function') {
                        window.ready2Submit();
                    } else if (typeof window.submitCheckTimes === 'function') {
                        window.submitCheckTimes();
                    } else if (typeof window.submitWork === 'function') {
                        window.submitWork();
                    } else {
                        const subBtn = document.querySelector('.completeBtn, a[onclick*="ready2Submit"], a[onclick*="submit"]');
                        if (subBtn) subBtn.click();
                    }
                } catch(e) {
                    status = "error_triggering: " + e.message;
                }
                return { status };
            });

            await page.wait(2);

            // Step 3: Handle confirmation popup if visible
            const confirmRes = await page.evaluate(async () => {
                let confirmed = false;
                const popBtns = Array.from(document.querySelectorAll('.layui-layer-btn0, .workPop .btnSubmit, a.popSure, .popBtn .sure, .popBtn .btnSubmit, a.btnSubmit'));
                for (const btn of popBtns) {
                    if (btn.offsetParent !== null) { // visible
                        btn.click();
                        confirmed = true;
                        break;
                    }
                }
                // If not confirmed via popup button, execute submitCheckTimes or submitWork directly
                if (!confirmed) {
                    if (typeof window.submitCheckTimes === 'function') {
                        window.submitCheckTimes();
                        confirmed = true;
                    } else if (typeof window.submitWork === 'function') {
                        window.submitWork();
                        confirmed = true;
                    }
                }
                return { confirmed };
            });

            console.log(`Confirmation triggered for ${t.name}: ${confirmRes.confirmed}`);
            await page.wait(4);

            results.push({
                task: t.name,
                status: "SUBMITTED",
                filledCount: fillRes.filled,
                totalCount: fillRes.total,
                msg: `Successfully submitted (${fillRes.filled}/${fillRes.total} filled)`
            });
        }

        return results;
    }
});
