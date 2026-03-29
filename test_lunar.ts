import { isFullMoon, isNewMoon } from './src/lib/lunarUtils.ts';

const mar3 = new Date("2026-03-03T00:00:00");
const mar19 = new Date("2026-03-19T00:00:00");

console.log("March 3rd Full Moon:", isFullMoon(mar3));
console.log("March 19th New Moon:", isNewMoon(mar19));
