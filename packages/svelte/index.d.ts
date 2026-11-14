import type { Object3D, Intersection } from 'three';
import type { World, WorldConfig, WorldPointerEvent } from '@orreryjs/core';

export interface OrreryActionParams { options?: WorldConfig & { renderer?: 'auto' | 'webgl2' | 'webgl' }; onCreated?: ( world: World ) => void; }
export function orrery( node: HTMLElement, params?: OrreryActionParams ): { update( params?: OrreryActionParams ): void; destroy(): void };
export function track( world: World, object: Object3D, options?: { parent?: Object3D | null; dispose?: boolean } ): () => void;
export function frame( world: World, fn: ( dt: number, elapsed: number ) => void ): () => void;
export function listen( world: World, object: Object3D, type: WorldPointerEvent, handler: ( hit: Intersection | null ) => void ): () => void;
export function load<T = any>( world: World, url: string, onDone: ( data: T ) => void, onError?: ( error: unknown ) => void ): () => void;
