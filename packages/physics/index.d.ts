import type { Object3D, Vector3 } from 'three';

type Vec3 = [ number, number, number ] | { x: number; y: number; z: number };

export interface BodyOptions {
	type?: 'dynamic' | 'fixed' | 'kinematic';
	shape?: 'auto' | 'ball' | 'cuboid' | 'capsule' | 'convex' | 'trimesh';
	mass?: number;
	density?: number;
	restitution?: number;
	friction?: number;
	ccd?: boolean;
	sensor?: boolean;
	linearDamping?: number;
	angularDamping?: number;
}

export interface Physics {
	RAPIER: any;
	world: any;
	readonly size: number;
	paused: boolean;
	add( object: Object3D, options?: BodyOptions ): any;
	remove( object: Object3D ): boolean;
	has( object: Object3D ): boolean;
	body( object: Object3D ): any;
	step( dt?: number ): number;
	applyImpulse( object: Object3D, impulse: Vec3 ): void;
	setVelocity( object: Object3D, velocity: Vec3 ): void;
	velocity( object: Object3D ): Vector3;
	teleport( object: Object3D, position: Vec3 ): void;
	onCollision( object: Object3D, fn: ( other: Object3D, started: boolean ) => void ): () => void;
	raycast( origin: Vec3, direction: Vec3, maxDistance?: number ): { object: Object3D | null; distance: number; point: Vector3 } | null;
	dispose(): void;
}

export function addPhysics( world: { scene: Object3D; onUpdate( fn: ( dt: number ) => void ): () => void }, options?: { gravity?: [ number, number, number ]; timestep?: number; maxSubsteps?: number; autoStep?: boolean } ): Promise<Physics>;
export function initRapier(): Promise<void>;
export function autoShape( geometry: unknown, type: string ): 'ball' | 'cuboid' | 'capsule' | 'trimesh' | 'convex';
