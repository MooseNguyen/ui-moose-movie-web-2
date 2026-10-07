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

function Throw({ error }: { error: unknown }): never {
  throw error;
}

const isAsyncComponent = (type: unknown): type is AsyncComponent =>
  typeof type === 'function' && type.constructor.name === 'AsyncFunction';

/**
 * A minimal stand-in for the RSC renderer: awaits every async Server
 * Component found through `children`, the way Next resolves them on the
 * server. A rejected component becomes a child that throws during render, so
 * the nearest client ErrorBoundary catches it like it would in the browser.
 * Async components passed through other props (e.g. `fallback`) or rendered
 * by sync components are not resolved.
 */
async function resolveTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveTree));
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<AnyProps>;
  if (isAsyncComponent(element.type)) {
    let resolved: ReactNode;
    try {
      resolved = await resolveTree(await element.type(element.props));
    } catch (error) {
      resolved = <Throw error={error} />;
    }
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
