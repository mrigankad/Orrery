import type { Object3D } from 'three';

export interface Trait<T extends object = Record<string, unknown>> {
	( values?: Partial<T> ): { __trait: Trait<T>; data: T };
	readonly id: number;
	readonly name: string;
	create(): T;
}

export interface NotTerm { not: Trait<any>; }
export function Not( trait: Trait<any> ): NotTerm;

export interface ECS {
	trait<T extends object>( defaults?: T | ( () => T ), name?: string ): Trait<T>;
	add( object: Object3D, ...items: Array<Trait<any> | { __trait: Trait<any>; data: object }> ): Object3D;
	remove( object: Object3D, ...traits: Trait<any>[] ): void;
	has( object: Object3D, trait: Trait<any> ): boolean;
	get<T extends object>( object: Object3D, trait: Trait<T> ): T | undefined;
	query( ...terms: Array<Trait<any> | NotTerm> ): Object3D[];
	each<T extends object>( trait: Trait<T>, ...more: Array<Trait<any> | NotTerm> ): Generator<[ Object3D, T ]>;
	system( fn: ( dt: number, elapsed: number ) => void, options?: { order?: number; name?: string } ): () => void;
	onAdd<T extends object>( trait: Trait<T>, fn: ( object: Object3D, data: T ) => void ): () => void;
	onRemove<T extends object>( trait: Trait<T>, fn: ( object: Object3D, data: T ) => void ): () => void;
	update( dt: number, elapsed?: number ): void;
	sweep(): void;
	readonly size: number;
	readonly timings: Array<{ name: string; ms: number }>;
	dispose(): void;
}

export function createECS( world: { scene: Object3D; onUpdate?( fn: ( dt: number, elapsed: number ) => void ): () => void }, options?: { sweepEvery?: number } ): ECS;
