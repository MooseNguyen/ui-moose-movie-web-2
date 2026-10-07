import { act, type RenderResult } from '@testing-library/react';
import {
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { AppLocale } from '@/i18n/routing';
import { renderWithIntl } from './render';

type AnyProps = { children?: ReactNode };
type AsyncComponent = (props: AnyProps) => Promise<ReactNode>;

const isAsyncComponent = (type: unknown): type is AsyncComponent =>
  typeof type === 'function' && type.constructor.name === 'AsyncFunction';

/**
 * A minimal stand-in for the RSC renderer: awaits every async Server
 * Component found through `children`, the way Next resolves them on the
 * server, so a page tree can be rendered with Testing Library. A rejection
 * propagates and fails the test, like a thrown Server Component error fails
 * Next's prerender (no error boundary is involved). Async components passed through other props (e.g. `fallback`) or rendered
 * by sync components are not resolved.
 */
async function resolveTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveTree));
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<AnyProps>;
  if (isAsyncComponent(element.type)) {
    const resolved = await resolveTree(await element.type(element.props));
    return <Fragment key={element.key}>{resolved}</Fragment>;
  }

  if (element.props.children === undefined) return element;
  const children = await resolveTree(element.props.children);
  return cloneElement(
    element,
    undefined,
    ...(Array.isArray(children) ? children : [children])
  );
}

export async function renderServerTree(
  tree: ReactNode,
  locale: AppLocale = 'en'
): Promise<RenderResult> {
  const resolved = await resolveTree(tree);
  let result!: RenderResult;
  await act(async () => {
    result = renderWithIntl(<>{resolved}</>, locale);
  });
  return result;
}
