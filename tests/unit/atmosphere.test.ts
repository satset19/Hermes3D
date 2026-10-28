import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  OFFICE_ENVIRONMENT_HDR,
  SceneAtmosphere,
  ScenePostFx,
} from "@/features/retro-office/systems/atmosphere";
import type { GraphicsQualityConfig } from "@/features/retro-office/core/graphicsQuality";
import * as THREE from "three";

// Mock Three.js / R3F hooks and components to allow unit testing
vi.mock("@react-three/fiber", () => ({
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({
    camera: new THREE.PerspectiveCamera(),
    gl: {},
  })),
}));

vi.mock("@react-three/drei", () => ({
  Environment: () => React.createElement("div", { "data-testid": "environment" }),
}));

let capturedDofProps: any = null;

vi.mock("@react-three/postprocessing", () => ({
  EffectComposer: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "effect-composer" }, children),
  Bloom: () => React.createElement("div", { "data-testid": "bloom" }),
  DepthOfField: (props: any) => {
    capturedDofProps = props;
    return React.createElement("div", {
      "data-testid": "depth-of-field",
      "data-bokeh-scale": props.bokehScale,
      "data-focus-distance": props.focusDistance,
      "data-focus-range": props.focusRange,
    });
  },
  N8AO: () => React.createElement("div", { "data-testid": "n8ao" }),
  SMAA: () => React.createElement("div", { "data-testid": "smaa" }),
  ToneMapping: () => React.createElement("div", { "data-testid": "tone-mapping" }),
  Vignette: () => React.createElement("div", { "data-testid": "vignette" }),
}));

const mockConfig: GraphicsQualityConfig = {
  shadowMapSize: 2048,
  maxDpr: 1.5,
  aoQuality: "low",
  bloom: true,
  ambientOcclusion: true,
  smaa: true,
  postProcessing: true,
  followDepthOfField: true,
};

describe("atmosphere system", () => {
  it("exports OFFICE_ENVIRONMENT_HDR correctly", () => {
    expect(OFFICE_ENVIRONMENT_HDR).toBe("/office-assets/env/office_env_1k.hdr");
  });

  it("exports SceneAtmosphere and ScenePostFx as functions", () => {
    expect(typeof SceneAtmosphere).toBe("function");
    expect(typeof ScenePostFx).toBe("function");
  });

  it("ScenePostFx keeps DepthOfField mounted and changes bokehScale based on followActive", () => {
    const focusPointRef = { current: new THREE.Vector3(0, 0, 0) };

    // When followActive is false: bokehScale should be 0
    const { unmount } = render(
      React.createElement(ScenePostFx, {
        config: mockConfig,
        followActive: false,
        followFocusPointRef: focusPointRef,
      })
    );
    expect(capturedDofProps).toBeDefined();
    expect(capturedDofProps.bokehScale).toBe(0);
    expect(capturedDofProps.focusDistance).toBe(2.2);
    expect(capturedDofProps.focusRange).toBe(1.6);
    unmount();

    // When followActive is true: bokehScale should be 4
    render(
      React.createElement(ScenePostFx, {
        config: mockConfig,
        followActive: true,
        followFocusPointRef: focusPointRef,
      })
    );
    expect(capturedDofProps.bokehScale).toBe(4);
    expect(capturedDofProps.focusDistance).toBe(2.2);
    expect(capturedDofProps.focusRange).toBe(1.6);
  });

  it("SceneAtmosphere renders lawn without receiveShadow and includes ParkTreesInstanced and DustMotes", () => {
    let atmosphereTree: any = null;
    function TestWrapper() {
      atmosphereTree = SceneAtmosphere({
        config: mockConfig,
        remoteOfficeEnabled: true,
      });
      return atmosphereTree;
    }

    render(React.createElement(TestWrapper));
    expect(atmosphereTree).toBeDefined();

    const children = React.Children.toArray(atmosphereTree.props.children) as any[];

    // Find the lawn mesh (child containing circleGeometry args [420, 48])
    const lawnMesh = children.find(
      (child) =>
        child.type === "mesh" &&
        child.props.children?.some?.(
          (c: any) =>
            c.type === "circleGeometry" && c.props.args?.[0] === 420
        )
    );
    expect(lawnMesh).toBeDefined();
    expect(lawnMesh.props.receiveShadow).toBeUndefined();

    // Apron mesh should have receiveShadow
    const apronMesh = children.find(
      (child) =>
        child.type === "mesh" &&
        child.props.children?.some?.(
          (c: any) => c.type === "planeGeometry"
        )
    );
    expect(apronMesh).toBeDefined();
    expect(apronMesh.props.receiveShadow).toBe(true);

    // ParkTreesInstanced should be present with 18 trees
    const treesComponent = children.find(
      (child) => child.type?.name === "ParkTreesInstanced"
    );
    expect(treesComponent).toBeDefined();
    expect(treesComponent.props.trees).toHaveLength(18);

    // DustMotes component should be present
    const dustMotesComponent = children.find(
      (child) => child.type?.name === "DustMotes"
    );
    expect(dustMotesComponent).toBeDefined();
  });
});
