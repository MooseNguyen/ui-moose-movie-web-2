export const THEME_STORAGE_KEY = 'theme';
export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'dark';

/**
 * Inline script run before first paint so the page never flashes the wrong
 * theme. Built only from the constants above (no user input). It must stay
 * self-contained: it is serialized into the HTML and runs outside React.
 */
export const THEME_SCRIPT = `(function(){try{var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}if(t!=="light"&&t!=="dark")t=${JSON.stringify(DEFAULT_THEME)};var r=document.documentElement;r.classList.remove("dark","light");r.classList.add(t);r.style.colorScheme=t}catch(e){}})();`;
