import { cli, Strategy } from '@jackwener/opencli/registry';
import { enterCourse, getTabIframeUrl, sleep } from './utils.js';
import fs from 'fs';

cli({
    site: 'chaoxing',
    name: 'chaoxing-scrape',
    access: 'read',
    description: 'Scrape official answers from Chaoxing homework review page',
    domain: 'mooc2-ans.chaoxing.com',
    strategy: Strategy.COOKIE,
    args: [],
    columns: ['task', 'score', 'totalQ', 'correctAnswersCount'],
    func: async (page) => {
        const configFile = fs.existsSync('config.json') ? 'config.json' : 'config.example.json';
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        const mcCourse = config.course;
        await enterCourse(page, mcCourse);
        await sleep(2000);

        const tasks = config.tasks || [];

        const allOfficialAnswers = {};
        const results = [];

        for (const t of tasks) {
            console.log(`Checking ${t.name}...`);
            const targetUrl = t.viewUrl || t.url;
            if (!targetUrl) {
                console.warn(`[Warning] No viewUrl specified for ${t.name}, skipping.`);
                continue;
            }
            await page.goto(targetUrl);
            await sleep(3000);

            const scraped = await page.evaluate(() => {
                const scoreMatch = document.body.innerText.match(/(\d+(\.\d+)?)\s*分/);
                const currentScore = scoreMatch ? scoreMatch[1] : '未知';

                const qBlocks = Array.from(document.querySelectorAll('.questionLi'));
                const list = [];

                for (let i = 0; i < qBlocks.length; i++) {
                    const qb = qBlocks[i];
                    const h3 = qb.querySelector('h3.mark_name');
                    const stem = h3 ? h3.innerText.replace(/\s+/g, ' ').trim() : '';

                    const numMatch = stem.match(/(\d+)\./);
                    const qNum = numMatch ? parseInt(numMatch[1]) : (i + 1);

                    // Extract my answer and correct answer
                    // In Chaoxing: .stem_answer, .mark_key, .my_answer, .right_answer
                    const text = qb.innerText;
                    const myAnsMatch = text.match(/我的答案[:：]\s*([^\n\r]+)/);
                    const rightAnsMatch = text.match(/正确答案[:：]\s*([^\n\r]+)/);
                    const analysisMatch = text.match(/答案解析[:：]\s*([^\n\r]+)/);

                    list.push({
                        num: qNum,
                        stem,
                        myAnswer: myAnsMatch ? myAnsMatch[1].trim() : '',
                        correctAnswer: rightAnsMatch ? rightAnsMatch[1].trim() : '',
                        analysis: analysisMatch ? analysisMatch[1].trim() : ''
                    });
                }

                // Check redo button
                const allLinks = Array.from(document.querySelectorAll('a, button, span'));
                const redoBtn = allLinks.find(a => (a.innerText || '').includes('重做'));
                const redoHref = redoBtn ? (redoBtn.href || redoBtn.getAttribute('onclick')) : null;

                return {
                    score: currentScore,
                    total: qBlocks.length,
                    canRedo: !!redoBtn,
                    redoAction: redoHref,
                    list
                };
            });

            allOfficialAnswers[t.name] = scraped;
            results.push({
                task: t.name,
                score: scraped.score,
                totalQ: scraped.total,
                correctAnswersCount: scraped.list.filter(q => !!q.correctAnswer).length
            });
        }

        const outputFile = process.env.OUTPUT_FILE || 'official_view_answers.json';
        fs.writeFileSync(outputFile, JSON.stringify(allOfficialAnswers, null, 2), 'utf8');
        console.log(`[Success] Answers saved to: ${outputFile}`);
        return results;
    }
});
