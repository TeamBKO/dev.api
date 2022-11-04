"use strict";
const User = require("$models/Users");
const { chromium } = require("playwright");
const { faker } = require("@faker-js/faker");

(async function () {
  try {
    /** GRAB A BUNCH OF USERS */
    const users = await User.query().where("active", true).limit(100);
    const browser = await chromium.launch();

    const promises = users.map(async (user) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      const weaponsChoices = [0, 1, 2];
      const chosenWeapon =
        weaponChoices[faker.number.random({ min: 0, max: 2 })];

      await page.goto("http://localhost:3000");
      await page.waitForLoadState();
      await page.locator("#authenticate").click();
      await page.locator("text=Email").fill(user.email);
      await page.locator("text=Password").fill(process.env.TEST_PASSWORD);
      await page.locator("text=Login").click();

      const tab = await page.waitForSelector('[data-tab-name="rosters"]');

      await tab.click();
      await page.waitForNavigation();
      await page.locator('[data-button-id="albion-online"]').click();
      await page.waitForSelector('[data-dialog-name="albion-online"]');

      await page.locator("#question_1").fill(user.username);
      await page.locator("#question_2").fill(user.username);
    });
    await Promise.all(promises);
    await browser.close();
  } catch (err) {}
})();
