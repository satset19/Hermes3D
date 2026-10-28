import { describe, expect, it } from 'vitest';
import React, { isValidElement, type ReactElement } from 'react';
import { render } from '@testing-library/react';
import {
  KeyboardModel,
  MouseModel,
  MugModel,
  TrashCanModel,
  PrimitiveKeyboardModel,
  PrimitiveMouseModel,
  PrimitiveMugModel,
  PrimitiveTrashCanModel,
} from '@/features/retro-office/objects/primitives';
import type { FurnitureItem } from '@/features/retro-office/core/types';

describe('Retro office micro-props shadow optimization (Task 1.4)', () => {
  const dummyItem: FurnitureItem = {
    _uid: 'test-item',
    type: 'item',
    x: 100,
    y: 100,
  };

  function captureComponentElement(
    component: (props: any) => ReactElement | null,
    props: any
  ): ReactElement {
    let captured: ReactElement | null = null;
    function Wrapper() {
      captured = component(props);
      return null;
    }
    render(React.createElement(Wrapper));
    if (!captured) {
      throw new Error('Component failed to render element');
    }
    return captured;
  }

  function collectMeshes(node: unknown): ReactElement[] {
    const meshes: ReactElement[] = [];
    function traverse(child: unknown) {
      if (!isValidElement(child)) return;
      if (child.type === 'mesh') {
        meshes.push(child as ReactElement);
      }
      const props = child.props as { children?: unknown } | undefined;
      if (props?.children) {
        React.Children.forEach(props.children, traverse);
      }
    }
    traverse(node);
    return meshes;
  }

  it('exports primitive aliases matching model components', () => {
    expect(PrimitiveKeyboardModel).toBe(KeyboardModel);
    expect(PrimitiveMouseModel).toBe(MouseModel);
    expect(PrimitiveMugModel).toBe(MugModel);
    expect(PrimitiveTrashCanModel).toBe(TrashCanModel);
  });

  it('ensures KeyboardModel has receiveShadow and no castShadow on any mesh', () => {
    const el = captureComponentElement(KeyboardModel, { item: dummyItem });
    const meshes = collectMeshes(el);
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) {
      const props = mesh.props as { castShadow?: boolean; receiveShadow?: boolean };
      expect(props.castShadow).toBeFalsy();
      expect(props.receiveShadow).toBe(true);
    }
  });

  it('ensures MouseModel has receiveShadow and no castShadow on any mesh', () => {
    const el = captureComponentElement(MouseModel, { item: dummyItem });
    const meshes = collectMeshes(el);
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) {
      const props = mesh.props as { castShadow?: boolean; receiveShadow?: boolean };
      expect(props.castShadow).toBeFalsy();
      expect(props.receiveShadow).toBe(true);
    }
  });

  it('ensures MugModel has receiveShadow and no castShadow on any mesh', () => {
    const el = captureComponentElement(MugModel, { item: dummyItem });
    const meshes = collectMeshes(el);
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) {
      const props = mesh.props as { castShadow?: boolean; receiveShadow?: boolean };
      expect(props.castShadow).toBeFalsy();
      expect(props.receiveShadow).toBe(true);
    }
  });

  it('ensures TrashCanModel has receiveShadow and no castShadow on any mesh', () => {
    const el = captureComponentElement(TrashCanModel, { item: dummyItem });
    const meshes = collectMeshes(el);
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) {
      const props = mesh.props as { castShadow?: boolean; receiveShadow?: boolean };
      expect(props.castShadow).toBeFalsy();
      expect(props.receiveShadow).toBe(true);
    }
  });
});
