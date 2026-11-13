/** 主內容區是唯一的捲動容器（外殼固定不捲動） */
export const MAIN_SCROLL_ID = 'main-scroll';

export function scrollMainToTop() {
  document.getElementById(MAIN_SCROLL_ID)?.scrollTo({ top: 0 });
}
