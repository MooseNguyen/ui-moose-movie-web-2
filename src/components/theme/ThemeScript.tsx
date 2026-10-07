import { THEME_SCRIPT } from './theme-script';

// Server component on purpose: React 19 warns when a client component renders
// a <script> tag.
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
