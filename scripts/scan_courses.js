import { cli, Strategy } from '@jackwener/opencli/registry';
import { initSession, getCourses, enterCourse, getTabIframeUrl, sleep } from './utils.js';

cli({
    site: 'chaoxing',
    name: 'chaoxing-scan',
    access: 'read',
    description: 'Scan active semester courses and inspect pending assignments',
    domain: 'mooc2-ans.chaoxing.com',
    strategy: Strategy.COOKIE,
    args: [],
    columns: ['course', 'activeWorksCount', 'details'],
    func: async (page) => {
        await initSession(page);
        const allCourses = await getCourses(page);
        // Only inspect current semester courses (first 12)
        const targetCourses = allCourses.slice(0, 12);

        const results = [];

        for (const c of targetCourses) {
            console.log(`\n========================================`);
            console.log(`Checking: ${c.title} (ID: ${c.courseId}, Clazz: ${c.classId})`);
            await enterCourse(page, c);
            await sleep(1500);

            const iframeUrl = await getTabIframeUrl(page, '作业');
            if (!iframeUrl) {
                console.log(`No 作业 tab for ${c.title}`);
                continue;
            }

            await page.goto(iframeUrl);
            await sleep(2500);

            const workData = await page.evaluate(() => {
                const list = document.querySelectorAll('.ulDiv li, .bottomList li, .con-work li, ul li');
                const parsed = [];
                for (const li of list) {
                    const text = (li.innerText || '').replace(/\s+/g, ' ').trim();
                    if (!text || text.includes('没有作业') || text.length < 3) continue;
                    if (text === '全部' || text === '已完成' || text === '未完成') continue;

                    const titleEl = li.querySelector('.title, .bt, p.fl, a, dt');
                    const statusEl = li.querySelector('.status, .state, span.fr, .time, .colorRed, .green');
                    const linkEl = li.querySelector('a[href*="task"], a[href*="work"]');
                    const title = titleEl ? titleEl.innerText.trim() : text;
                    const status = statusEl ? statusEl.innerText.trim() : '';

                    // Check onclick or data
                    const onclick = li.getAttribute('onclick') || (linkEl ? linkEl.getAttribute('onclick') : '');
                    const href = linkEl ? linkEl.href : '';

                    parsed.push({
                        title,
                        status,
                        text,
                        href,
                        onclick
                    });
                }

                return {
                    url: window.location.href,
                    bodyText: document.body.innerText.slice(0, 500),
                    items: parsed
                };
            });

            console.log(`Course ${c.title} has ${workData.items.length} works`);
            results.push({
                course: `${c.title} (${c.courseId})`,
                activeWorksCount: workData.items.length,
                details: JSON.stringify({ course: c, workData })
            });
        }

        return results;
    }
});
