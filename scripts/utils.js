/**
 * 通用超星学习通会话与 DOM 交互工具函数库
 */

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 初始化并验证学习通基础会话
 */
export async function initSession(page) {
    await page.goto('https://mooc1.chaoxing.com/visit/interaction', { waitUntil: 'domcontentloaded' });
    await sleep(2000);
}

/**
 * 经由 stucoursemiddle 中间页平滑进入指定课程，写入必要的 enc 与 Session Cookie
 */
export async function enterCourse(page, course) {
    const { courseId, classId, cpi = '' } = course;
    const middleUrl = `https://mooc1.chaoxing.com/visit/stucoursemiddle?courseid=${courseId}&clazzid=${classId}&cpi=${cpi}&ismooc2=1&v=2`;
    console.log(`[Session] Entering course middle page: ${course.title || courseId}...`);
    await page.goto(middleUrl, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
}

/**
 * 获取用户当前学期的所有课程列表
 */
export async function getCourses(page) {
    return await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.course, .course-item, .ulDiv li, a[href*="courseId"]'));
        const courseMap = new Map();

        for (const item of items) {
            const link = item.querySelector('a[href*="courseId"]') || (item.tagName === 'A' ? item : null);
            if (!link) continue;

            const href = link.href || '';
            const matchCourse = href.match(/courseId=(\d+)/i) || href.match(/courseid=(\d+)/i);
            const matchClass = href.match(/classId=(\d+)/i) || href.match(/clazzid=(\d+)/i);
            const matchCpi = href.match(/cpi=(\d+)/i);

            if (matchCourse) {
                const courseId = matchCourse[1];
                const classId = matchClass ? matchClass[1] : '';
                const cpi = matchCpi ? matchCpi[1] : '';
                const titleEl = item.querySelector('.course-name, .title, h3, h4, p') || link;
                const title = (titleEl.innerText || '').trim();

                if (courseId && !courseMap.has(courseId)) {
                    courseMap.set(courseId, { courseId, classId, cpi, title });
                }
            }
        }
        return Array.from(courseMap.values());
    });
}

/**
 * 在课程首页中获取特定 Tab（如“作业”、“章节”）的内嵌 iframe URL
 */
export async function getTabIframeUrl(page, tabName) {
    return await page.evaluate((name) => {
        const tabs = Array.from(document.querySelectorAll('a, li, .nav li, .leftNav li'));
        const target = tabs.find(t => (t.innerText || '').includes(name));
        if (!target) return null;

        const link = target.tagName === 'A' ? target : target.querySelector('a');
        if (!link) return null;

        return link.getAttribute('data') || link.getAttribute('href') || null;
    }, tabName);
}
