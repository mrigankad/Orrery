import type { Mesh, Object3D, PerspectiveCamera, Sphere, Vector3 } from 'three';

export type Anchor = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface PinOptions {
	anchor?: Anchor;
	gap?: number;
	offset?: [ number, number, number ];
	fade?: { near?: number; far: number };
	occlude?: boolean;
	className?: string;
}

export interface Pin { object: Object3D; el: HTMLElement; setText( text: string ): void; remove(): void; }
export interface FocusTarget { object: Object3D; button: HTMLButtonElement; label: string; remove(): void; }

export interface TextOptions { size?: number; color?: string; background?: string | null; font?: string; pixelsPerUnit?: number; padding?: number; }

export interface UI {
	pin( object: Object3D, content: string | HTMLElement, options?: PinOptions ): Pin;
	accessible( object: Object3D, label: string, options?: { description?: string } ): FocusTarget;
	text( value: string, options?: TextOptions ): Mesh & { userData: { text: string; setText( text: string ): void } };
	readonly layer: HTMLElement;
	readonly pins: Pin[];
	readonly focusable: Object3D[];
	dispose(): void;
}

export function createUI( world: unknown, options?: { container?: HTMLElement; label?: string } ): UI;
export function toScreen( point: Vector3, camera: PerspectiveCamera, width: number, height: number ): { x: number; y: number; depth: number; visible: boolean };
export function fadeFor( distance: number, near?: number, far?: number ): number;
export function anchorTransform( anchor: Anchor, gap?: number ): string;
export function worldSphere( object: Object3D, target?: Sphere ): Sphere;
export function anchorPoint( object: Object3D, anchor: Anchor, camera: PerspectiveCamera, target?: Vector3 ): Vector3;
export function screenRadius( sphere: Sphere, camera: PerspectiveCamera, height: number ): number;
