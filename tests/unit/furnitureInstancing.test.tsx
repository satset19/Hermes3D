import { describe, expect, it, vi } from "vitest";
import React, { isValidElement, type ReactElement } from "react";
import * as THREE from "three";
import fs from "fs";
import path from "path";
import { render } from "@testing-library/react";
import {
  FURNITURE_GLB,
  FURNITURE_SCALE,
  FURNITURE_Y_OFFSET,
  buildFurnitureItemMatrix,
  InstancedFurnitureItems,
  InstancedFurnitureItemsModel,
  resolveFurnitureTemplate,
} from "@/features/retro-office/objects/furniture";
import type { FurnitureItem } from "@/features/retro-office/core/types";

// Mock @react-three/drei useGLTF
vi.mock("@react-three/drei", () => {
  const dummyScene = new THREE.Group();
  const mesh1 = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  mesh1.name = "submesh_base";
  mesh1.castShadow = true;
  mesh1.receiveShadow = true;

  const mesh2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 1),
    new THREE.MeshStandardMaterial({ color: 0x228822 }),
  );
  mesh2.name = "submesh_accent";
  mesh2.position.set(0, 0.5, 0);
  mesh2.scale.set(0.5, 0.5, 0.5);
  mesh2.castShadow = true;
  mesh2.receiveShadow = true;

  dummyScene.add(mesh1);
  dummyScene.add(mesh2);

  return {
    useGLTF: Object.assign(
      vi.fn((_url: string) => ({
        scene: dummyScene.clone(true),
      })),
      {
        preload: vi.fn(),
        clear: vi.fn(),
      },
    ),
  };
});

describe("Furniture instancing and model mapping (furniture.tsx)", () => {
  const projectRoot = path.resolve(__dirname, "../../");

  describe("FURNITURE_GLB mapping for plant, computer, and couch", () => {
    it("maps 'plant', 'computer', and 'couch' to their respective GLB files", () => {
      expect(FURNITURE_GLB.plant).toBe(
        "/office-assets/models/furniture/pottedPlant.glb",
      );
      expect(FURNITURE_GLB.computer).toBe(
        "/office-assets/models/furniture/computerScreen.glb",
      );
      expect(FURNITURE_GLB.couch).toBe(
        "/office-assets/models/furniture/loungeSofa.glb",
      );
    });

    it("verifies that pottedPlant.glb, computerScreen.glb, and loungeSofa.glb exist in public assets", () => {
      const plantPath = path.join(
        projectRoot,
        "public/office-assets/models/furniture/pottedPlant.glb",
      );
      const computerPath = path.join(
        projectRoot,
        "public/office-assets/models/furniture/computerScreen.glb",
      );
      const couchPath = path.join(
        projectRoot,
        "public/office-assets/models/furniture/loungeSofa.glb",
      );

      expect(fs.existsSync(plantPath)).toBe(true);
      expect(fs.existsSync(computerPath)).toBe(true);
      expect(fs.existsSync(couchPath)).toBe(true);
    });
  });

  describe("InstancedFurnitureItemsModel alias", () => {
    it("exports InstancedFurnitureItemsModel as an alias to InstancedFurnitureItems", () => {
      expect(InstancedFurnitureItemsModel).toBe(InstancedFurnitureItems);
    });
  });

  describe("buildFurnitureItemMatrix transform calculations", () => {
    it("calculates correct instance transform for 'plant'", () => {
      const item: FurnitureItem = {
        _uid: "plant-1",
        type: "plant",
        x: 100,
        y: 200,
        facing: 90,
      };

      const matrix = buildFurnitureItemMatrix(item, "plant");
      expect(matrix).toBeInstanceOf(THREE.Matrix4);

      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(pos, quat, scale);

      // Verify scale corresponds to FURNITURE_SCALE.plant ([1.2, 1.8, 1.2])
      const expectedScale = FURNITURE_SCALE.plant;
      expect(scale.x).toBeCloseTo(expectedScale[0], 4);
      expect(scale.y).toBeCloseTo(expectedScale[1], 4);
      expect(scale.z).toBeCloseTo(expectedScale[2], 4);

      // Verify Y position is 0 (no offset for plant)
      expect(pos.y).toBeCloseTo(0, 4);
    });

    it("calculates correct instance transform for 'computer' including yOffset and elevation", () => {
      const item: FurnitureItem = {
        _uid: "computer-1",
        type: "computer",
        x: 50,
        y: 80,
        elevation: 0.2,
      };

      const matrix = buildFurnitureItemMatrix(item, "computer");
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(pos, quat, scale);

      // Verify computer Y offset (0.61 + 0.2 elevation)
      const expectedY = (FURNITURE_Y_OFFSET.computer ?? 0.61) + 0.2;
      expect(pos.y).toBeCloseTo(expectedY, 4);

      // Verify scale
      const expectedScale = FURNITURE_SCALE.computer;
      expect(scale.x).toBeCloseTo(expectedScale[0], 4);
      expect(scale.y).toBeCloseTo(expectedScale[1], 4);
      expect(scale.z).toBeCloseTo(expectedScale[2], 4);
    });

    it("calculates correct base rotation for 'couch'", () => {
      const item: FurnitureItem = {
        _uid: "couch-1",
        type: "couch",
        x: 120,
        y: 150,
        facing: 0,
      };

      const matrix = buildFurnitureItemMatrix(item, "couch");
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(pos, quat, scale);

      // Couch has Math.PI base rotation in FURNITURE_ROTATION
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
      expect(forward.z).toBeCloseTo(-1, 4);

      const expectedScale = FURNITURE_SCALE.couch;
      expect(scale.x).toBeCloseTo(expectedScale[0], 4);
      expect(scale.y).toBeCloseTo(expectedScale[1], 4);
      expect(scale.z).toBeCloseTo(expectedScale[2], 4);
    });
  });

  describe("Submesh extraction and template resolution", () => {
    it("preserves submesh relative transforms in template traverse", () => {
      const scene = new THREE.Group();
      const baseMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x555555 }),
      );
      baseMesh.name = "pot";
      const foliage = new THREE.Mesh(
        new THREE.SphereGeometry(1),
        new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
      );
      foliage.name = "foliage";
      foliage.position.set(0.1, 0.8, -0.2);
      foliage.scale.set(0.6, 0.6, 0.6);

      scene.add(baseMesh);
      scene.add(foliage);

      const template = resolveFurnitureTemplate({
        glbPath: "/office-assets/models/furniture/pottedPlant.glb",
        itemColor: undefined,
        itemType: "plant",
        scene,
      });

      template.updateMatrixWorld(true);
      const meshes: THREE.Mesh[] = [];
      template.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) meshes.push(c as THREE.Mesh);
      });

      expect(meshes.length).toBe(2);
      const foliageMesh = meshes.find((m) => m.name === "foliage");
      expect(foliageMesh).toBeDefined();
      expect(foliageMesh!.position.y).toBeCloseTo(0.8, 4);
      expect(foliageMesh!.scale.x).toBeCloseTo(0.6, 4);
    });
  });

  describe("InstancedFurnitureItems component and event handling", () => {
    function renderHookedElement(
      component: (props: any) => ReactElement | null,
      props: any,
    ): ReactElement | null {
      let captured: ReactElement | null = null;
      function Wrapper() {
        captured = component(props);
        return null;
      }
      render(React.createElement(Wrapper));
      return captured;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function collectInstancedMeshes(node: unknown): ReactElement<any>[] {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meshes: ReactElement<any>[] = [];
      function traverse(child: unknown) {
        if (!isValidElement(child)) return;
        if (child.type === "instancedMesh") {
          meshes.push(child);
        }
        const props = child.props as { children?: unknown } | undefined;
        if (props?.children) {
          React.Children.forEach(props.children, traverse);
        }
      }
      traverse(node);
      return meshes;
    }

    it("renders instanced meshes for each submesh and binds event handlers", () => {
      const items: FurnitureItem[] = [
        { _uid: "plant_1", type: "plant", x: 10, y: 20 },
        { _uid: "plant_2", type: "plant", x: 30, y: 40 },
      ];

      const onClick = vi.fn();
      const onPointerOver = vi.fn();
      const onPointerOut = vi.fn();
      const onPointerDown = vi.fn();

      const element = renderHookedElement(InstancedFurnitureItems, {
        itemType: "plant",
        items,
        onClick,
        onPointerOver,
        onPointerOut,
        onPointerDown,
      });

      const instancedMeshes = collectInstancedMeshes(element);
      // Dummy scene has 2 submeshes -> 2 instancedMesh elements
      expect(instancedMeshes.length).toBe(2);

      const firstMesh = instancedMeshes[0]!;
      expect(firstMesh.props.args[2]).toBe(2); // items.length
      expect(firstMesh.props.castShadow).toBe(true);
      expect(firstMesh.props.receiveShadow).toBe(true);

      // Verify event handlers are attached
      expect(firstMesh.props.onClick).toBeDefined();
      expect(firstMesh.props.onPointerOver).toBeDefined();
      expect(firstMesh.props.onPointerOut).toBeDefined();
      expect(firstMesh.props.onPointerDown).toBeDefined();
      expect(firstMesh.props.onPointerMove).toBeDefined();

      // Trigger click on instance 1 (plant_2)
      const fakeClickEvent = {
        instanceId: 1,
        stopPropagation: vi.fn(),
      };
      firstMesh.props.onClick(fakeClickEvent);
      expect(fakeClickEvent.stopPropagation).toHaveBeenCalled();
      expect(onClick).toHaveBeenCalledWith("plant_2");

      // Trigger pointer down on instance 0 (plant_1)
      const fakePointerDownEvent = {
        instanceId: 0,
        stopPropagation: vi.fn(),
      };
      firstMesh.props.onPointerDown(fakePointerDownEvent);
      expect(fakePointerDownEvent.stopPropagation).toHaveBeenCalled();
      expect(onPointerDown).toHaveBeenCalledWith("plant_1");

      // Trigger pointer over on instance 0 (plant_1)
      const fakePointerOverEvent = {
        instanceId: 0,
        stopPropagation: vi.fn(),
      };
      firstMesh.props.onPointerOver(fakePointerOverEvent);
      expect(fakePointerOverEvent.stopPropagation).toHaveBeenCalled();
      expect(onPointerOver).toHaveBeenCalledWith("plant_1");

      // Trigger pointer move to instance 1 (plant_2)
      const fakePointerMoveEvent = {
        instanceId: 1,
        stopPropagation: vi.fn(),
      };
      firstMesh.props.onPointerMove(fakePointerMoveEvent);
      expect(fakePointerMoveEvent.stopPropagation).toHaveBeenCalled();
      expect(onPointerOver).toHaveBeenCalledWith("plant_2");

      // Trigger pointer out
      const fakePointerOutEvent = {
        stopPropagation: vi.fn(),
      };
      firstMesh.props.onPointerOut(fakePointerOutEvent);
      expect(fakePointerOutEvent.stopPropagation).toHaveBeenCalled();
      expect(onPointerOut).toHaveBeenCalled();
    });

    it("returns null when items array is empty", () => {
      const element = renderHookedElement(InstancedFurnitureItems, {
        itemType: "couch",
        items: [],
      });
      expect(element).toBeNull();
    });

    it("supports automatic itemType resolution from items if itemType is not provided", () => {
      const items: FurnitureItem[] = [
        { _uid: "couch_1", type: "couch", x: 50, y: 60 },
      ];

      const element = renderHookedElement(InstancedFurnitureItems, {
        items,
      });

      const instancedMeshes = collectInstancedMeshes(element);
      expect(instancedMeshes.length).toBeGreaterThan(0);
    });
  });
});
