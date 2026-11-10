import { cli, Strategy } from '@jackwener/opencli/registry';
import { enterCourse, sleep } from './utils.js';
import fs from 'fs';

cli({
    site: 'chaoxing',
    name: 'chaoxing-redo',
    access: 'write',
    description: 'Automated high-score redo workflow with official key injection and anti-toggle state protection',
    domain: 'mooc2-ans.chaoxing.com',
    strategy: Strategy.COOKIE,
    args: [],
    columns: ['task', 'oldScore', 'newScore', 'details'],
    func: async (page) => {
        const configFile = fs.existsSync('config.json') ? 'config.json' : 'config.example.json';
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        const mcCourse = config.course;
        await enterCourse(page, mcCourse);
        await sleep(2000);

        const answersFile = process.env.ANSWERS_FILE || (fs.existsSync('official_view_answers.json') ? 'official_view_answers.json' : 'official_answers.json');
        const officialData = fs.existsSync(answersFile) ? JSON.parse(fs.readFileSync(answersFile, 'utf8')) : {};

        const tasks = config.tasks || [];

        const results = [];

        for (const t of tasks) {
            console.log(`\n========================================`);
            console.log(`Starting perfect redo for: ${t.name}...`);
            const taskData = officialData[t.name] || {};
            const answersList = taskData.list || [];
            const oldScore = taskData.score || '未知';

            // 1. View page & authorize redo
            await page.goto(t.viewUrl);
            await sleep(2500);

            console.log(`Authorizing redo for ${t.name}...`);
            await page.evaluate(async () => {
                return new Promise((resolve) => {
                    $.ajax({
                        type: "get",
                        url: _HOST_CP2_ + "/work/phone/redo",
                        dataType: "json",
                        data: { courseId, classId, cpi, workId, workAnswerId: answerId },
                        success: function(data) { resolve(data); },
                        error: function(err) { resolve({ error: err }); }
                    });
                });
            });
            await sleep(1500);

            // 2. Navigate to dowork
            console.log(`Navigating to dowork for ${t.name}...`);
            await page.goto(t.doworkUrl);
            await sleep(4000);

            // 3. Perfect filling
            const fillStats = await page.evaluate(async (answers) => {
                const qBlocks = Array.from(document.querySelectorAll('.questionLi'));
                let filled = 0;

                for (let i = 0; i < qBlocks.length; i++) {
                    const qb = qBlocks[i];
                    const h3 = qb.querySelector('h3.mark_name');
                    const h3Text = h3 ? h3.innerText : '';
                    const numMatch = h3Text.match(/(\d+)\./);
                    const qNum = numMatch ? parseInt(numMatch[1]) : (i + 1);

                    const item = answers.find(a => a.num === qNum) || answers[i];
                    if (!item) continue;

                    const ansStr = (item.correctAnswer || '').trim();

                    if (h3Text.includes('单选题')) {
                        const targetLetter = ansStr.match(/[A-H]/i)?.[0]?.toUpperCase();
                        if (targetLetter) {
                            const bgs = Array.from(qb.querySelectorAll('.answerBg'));
                            for (const bg of bgs) {
                                const span = bg.querySelector('.num_option, span');
                                const data = span ? span.getAttribute('data') : '';
                                const text = span ? span.innerText.trim() : '';
                                const isTarget = (data === targetLetter || text === targetLetter);
                                const isChecked = span ? span.classList.contains('check_answer') : false;

                                if (isTarget && !isChecked) bg.click();
                                else if (!isTarget && isChecked) bg.click();
                            }
                            filled++;
                        }
                    } else if (h3Text.includes('判断题')) {
                        const isCorrect = /(正确|对|true|^A$)/i.test(ansStr);
                        const targetData = isCorrect ? 'true' : 'false';
                        const targetLetter = isCorrect ? 'A' : 'B';
                        const bgs = Array.from(qb.querySelectorAll('.answerBg'));
                        for (const bg of bgs) {
                            const span = bg.querySelector('.num_option, span');
                            const data = span ? span.getAttribute('data') : '';
                            const text = span ? span.innerText.trim() : '';
                            const isTarget = (data === targetData || data === targetLetter || text === targetLetter);
                            const isChecked = span ? span.classList.contains('check_answer') : false;

                            if (isTarget && !isChecked) bg.click();
                            else if (!isTarget && isChecked) bg.click();
                        }
                        filled++;
                    } else if (h3Text.includes('多选题')) {
                        const letters = (ansStr.match(/[A-H]/gi) || []).map(l => l.toUpperCase());
                        const bgs = Array.from(qb.querySelectorAll('.answerBg'));
                        for (const bg of bgs) {
                            const span = bg.querySelector('.num_option_dx, .num_option, span');
                            const data = span ? span.getAttribute('data') : '';
                            const text = span ? span.innerText.trim() : '';
                            const letter = data || text;
                            const shouldBeChecked = letters.includes(letter);
                            const isChecked = span ? (span.classList.contains('check_answer_dx') || span.classList.contains('check_answer') || bg.getAttribute('aria-checked') === 'true') : false;

                            if (shouldBeChecked && !isChecked) bg.click();
                            else if (!shouldBeChecked && isChecked) bg.click();
                        }
                        filled++;
                    } else if (h3Text.includes('填空题')) {
                        // Extract clean parts removing "(1)", "(2)"
                        let cleanParts = ansStr.replace(/\(\d+\)/g, '###').split('###').map(s => s.trim()).filter(Boolean);
                        if (cleanParts.length === 0) {
                            cleanParts = ansStr.split(/[,，、;；\n\t]+/).map(s => s.trim()).filter(Boolean);
                        }
                        const textareas = Array.from(qb.querySelectorAll('textarea[name^="answerEditor"], textarea'));
                        for (let idx = 0; idx < textareas.length; idx++) {
                            const ta = textareas[idx];
                            const val = cleanParts[idx] !== undefined ? cleanParts[idx] : (cleanParts[0] || ansStr);
                            ta.value = val;
                            ta.dispatchEvent(new Event('input', { bubbles: true }));
                            ta.dispatchEvent(new Event('change', { bubbles: true }));

                            // UEditor
                            try {
                                if (window.UE && typeof window.UE.getEditor === 'function') {
                                    const ed = window.UE.getEditor(ta.id);
                                    if (ed) ed.setContent(val);
                                }
                            } catch(e) {}

                            // Iframe
                            try {
                                const iframes = qb.querySelectorAll('iframe');
                                if (iframes[idx] && iframes[idx].contentDocument && iframes[idx].contentDocument.body) {
                                    iframes[idx].contentDocument.body.innerHTML = `<p>${val}</p>`;
                                }
                            } catch(e) {}
                        }
                        filled++;
                    }
                }

                // Save work
                try {
                    if (typeof window.saveWork === 'function') window.saveWork();
                } catch (e) {}

                return { total: qBlocks.length, filled };
            }, answersList);

            console.log(`Fill completed for ${t.name}: ${fillStats.filled}/${fillStats.total}`);
            await sleep(3500);

            // 4. Submit
            await page.evaluate(() => {
                const btn = document.querySelector('.completeBtn, a[onclick*="submitValidate"]');
                if (btn) btn.click();
                else if (typeof window.submitValidate === 'function') window.submitValidate();
            });
            await sleep(2500);

            // 5. Confirm
            await page.evaluate(() => {
                const popBtns = Array.from(document.querySelectorAll('.layui-layer-btn0, .workPop .btnSubmit, a.popSure, .popBtn .sure, .popBtn .btnSubmit, a.btnSubmit, a.sure'));
                for (const b of popBtns) {
                    if (b.offsetParent !== null) {
                        b.click();
                        break;
                    }
                }
                if (typeof window.submitCheckTimes === 'function') window.submitCheckTimes();
            });
            await sleep(6000);

            // 6. View new score
            await page.goto(t.viewUrl);
            await sleep(3000);

            const newScore = await page.evaluate(() => {
                const m = document.body.innerText.match(/(\d+(\.\d+)?)\s*分/);
                return m ? m[1] : '未知';
            });

            console.log(`${t.name} Old: ${oldScore} -> New Score: ${newScore}`);
            results.push({
                task: t.name,
                oldScore: String(oldScore),
                newScore: String(newScore),
                details: `Filled ${fillStats.filled}/${fillStats.total}, Score: ${newScore}/100`
            });
        }

        return results;
    }
});
