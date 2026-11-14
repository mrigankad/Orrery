import type { Object3D } from 'three';

export interface DevtoolsOptions {
	/** Start visible. Default `true`. */
	open?: boolean;
	/** Toggle key. Default backtick. */
	key?: string;
	budgets?: { frameMs?: number; drawCalls?: number; triangles?: number };
	/** Bars in the frame graph. Default 48. */
	samples?: number;
	container?: HTMLElement;
}

export interface Devtools {
	el: HTMLElement;
	readonly selected: Object3D | null;
	select( object: Object3D | null ): void;
	toggle( force?: boolean ): void;
	refresh(): void;
	dispose(): void;
}

export function mountDevtools( world: unknown, options?: DevtoolsOptions ): Devtools;

export function frameStats( samples: number[], budgetMs?: number ): { fps: number; avgMs: number; worstMs: number; slow: number };
export function renderStats( renderer: unknown ): { drawCalls: number; triangles: number; geometries: number; textures: number };
export function sceneGeometries( scene: Object3D ): number;
export function orphanGeometries( scene: Object3D, renderer: unknown, allowance?: number ): number;
export function compact( n: number ): string;
