import type { DefineComponent, Ref } from 'vue';
import type { Object3D, Intersection } from 'three';
import type { World, WorldConfig, WorldPointerEvent } from '@orreryjs/core';

export const OrreryCanvas: DefineComponent<{ options?: WorldConfig & { renderer?: 'auto' | 'webgl2' | 'webgl' } }>;
export function useWorld(): World;
export function useFrame( fn: ( dt: number, elapsed: number ) => void ): void;
export function useObject<T extends Object3D | null>( object: T | Ref<T>, options?: { parent?: Object3D | Ref<Object3D | null> | null; dispose?: boolean } ): T | Ref<T>;
export function useEvent( object: Object3D | Ref<Object3D | null> | null, type: WorldPointerEvent, handler: ( hit: Intersection | null ) => void ): void;
export function useLoad<T = any>( url: string | null | Ref<string | null> ): { data: T | null; error: unknown; loading: boolean };
