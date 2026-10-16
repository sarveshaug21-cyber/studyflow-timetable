import { chromium } from 'playwright';

async function verifyTimetable() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    const loadSampleButton = page.getByRole('button', { name: 'Load Sample Timetable' });
    if (await loadSampleButton.isVisible()) {
      await loadSampleButton.click();
    }

    const lesson = page.locator('[role="button"][aria-label*=", 09:00 -"]').first();
    await lesson.waitFor({ state: 'visible' });

    const measurement = await page.evaluate(() => {
      const lessonElement = document.querySelector('[role="button"][aria-label*=", 09:00 -"]');
      const timeSlot = document.querySelector('[role="gridcell"] [data-time="09:00"]');
      const dayColumn = timeSlot?.closest('[role="gridcell"]');
      const timeBody = dayColumn?.children[1];
      const grid = document.querySelector('[data-timetable-grid]');
      const header = document.querySelector('header');
      const toolbar = header?.nextElementSibling;

      if (!lessonElement || !timeSlot || !dayColumn || !timeBody || !grid || !header || !toolbar) {
        throw new Error('Could not find the lesson, matching grid row, or layout containers.');
      }

      const top = (element) => element.getBoundingClientRect().top;
      return {
        headerTop: top(header),
        toolbarTop: top(toolbar),
        gridTop: top(grid),
        dayColumnTop: top(dayColumn),
        timeBodyTop: top(timeBody),
        gridLineTop: top(timeSlot),
        lessonTop: top(lessonElement),
      };
    });

    const difference = Math.abs(measurement.lessonTop - measurement.gridLineTop);
    console.table({ ...measurement, difference });
    if (difference > 2) {
      throw new Error(`09:00 lesson is misaligned with its grid row by ${difference}px.`);
    }
  } finally {
    await browser.close();
  }
}

verifyTimetable().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});