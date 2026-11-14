import type { CSSProperties, ReactNode } from 'react';
import type { Object3D, Intersection } from 'three';
import type { World, WorldConfig, WorldPointerEvent } from 'orreryjs';

export interface OrreryCanvasProps {
	options?: WorldConfig & { renderer?: 'auto' | 'webgl2' | 'webgl' };
	onCreated?: ( world: World ) => void;
	style?: CSSProperties;
	className?: string;
	fallback?: ReactNode;
	children?: ReactNode;
}

export function OrreryCanvas( props: OrreryCanvasProps ): JSX.Element;
export function useWorld(): World;
export function useFrame( fn: ( dt: number, elapsed: number ) => void ): void;
export function useObject<T extends Object3D | null>( object: T, options?: { parent?: Object3D | null; dispose?: boolean } ): T;
export function useEvent( object: Object3D | null, type: WorldPointerEvent, handler: ( hit: Intersection | null ) => void ): void;
export function useLoad<T = any>( url: string | null ): { data: T | null; error: unknown; loading: boolean };
export const WorldContext: import( 'react' ).Context<World | null>;
