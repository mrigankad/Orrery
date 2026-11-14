import { CanvasTexture, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, SRGBColorSpace, Vector3 } from 'three';
import { toScreen, fadeFor, anchorTransform, worldSphere, anchorPoint, screenRadius } from './math.js';

const CSS = `
.orr-ui{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1;font-family:'Inter Tight',system-ui,sans-serif}
.orr-ui .pin{position:absolute;left:0;top:0;will-change:transform;pointer-events:auto;transition:opacity .15s}
.orr-ui .pin[hidden]{display:none}
.orr-ui .chip{display:flex;flex-direction:column;align-items:center}
.orr-ui .chip span{padding:5px 10px;border-radius:999px;background:#121214;color:#fff;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 4px 14px rgba(18,18,20,.18)}
.orr-ui .chip i{width:1.5px;height:14px;background:#121214}
.orr-ui .card{background:#fff;border:1px solid #E8E7E3;border-radius:14px;box-shadow:0 12px 32px rgba(18,18,20,.12);padding:14px 16px;color:#121214;font-size:13px;line-height:1.45}
.orr-ui .ring{position:absolute;left:0;top:0;border:3px solid #FF4F1A;border-radius:999px;box-shadow:0 0 0 6px rgba(255,79,26,.18);pointer-events:none}
.orr-ui .ring b{position:absolute;left:50%;top:calc(100% + 10px);transform:translateX(-50%);display:flex;gap:8px;padding:6px 10px;border-radius:999px;background:#FF4F1A;color:#fff;font-size:12px;font-weight:600;white-space:nowrap}
.orr-ui .ring b em{font-style:normal;font-weight:400;opacity:.85}
.orr-ui-a11y{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;list-style:none}
`;

const _point = new Vector3();
const _camPos = new Vector3();
const _dir = new Vector3();

/**
 * Adds HTML labels, keyboard access and in-world text to an Orrery World.
 *
 * ```js
 * const ui = createUI( world );
 * ui.pin( planet, 'Juno' );                                  // chip above it
 * ui.pin( sun, cardElement, { anchor: 'right' } );           // any HTML
 * ui.accessible( planet, 'Juno, the fifth planet' );         // Tab + Enter
 * world.add( ui.text( 'orrery', { size: 0.6 } ) );           // text mesh
 * ```
 *
 * Pins and focus targets are dropped automatically when their object leaves
 * the scene.
 *
 * @param {Object} world - An Orrery World.
 * @param {Object} [options]
 * @param {HTMLElement} [options.container] - Defaults to the world's container.
 * @return {Object}
 */
function createUI( world, options = {} ) {

	const container = options.container ?? world.container ?? world.renderer.domElement.parentElement ?? document.body;

	if ( ! document.getElementById( 'orr-ui-style' ) ) {

		const style = document.createElement( 'style' );
		style.id = 'orr-ui-style';
		style.textContent = CSS;
		document.head.appendChild( style );

	}

	if ( getComputedStyle( container ).position === 'static' ) container.style.position = 'relative';

	const layer = document.createElement( 'div' );
	layer.className = 'orr-ui';
	container.appendChild( layer );

	const list = document.createElement( 'ul' );
	list.className = 'orr-ui-a11y';
	list.setAttribute( 'aria-label', options.label ?? '3D scene objects' );
	container.appendChild( list );

	const ring = document.createElement( 'div' );
	ring.className = 'ring';
	ring.hidden = true;
	ring.innerHTML = '<b><span></span><em></em></b>';
	layer.appendChild( ring );

	const pins = new Set();
	const targets = new Map();          // Object3D -> { button, label }
	let focused = null;
	let frame = 0;

	const raycaster = new Raycaster();

	const isAttached = ( object ) => {

		let n = object;
		while ( n.parent ) n = n.parent;
		return n === world.scene;

	};

	const isSelfOrChild = ( hit, object ) => {

		for ( let n = hit; n; n = n.parent ) if ( n === object ) return true;
		return false;

	};

	// ---- pins -----------------------------------------------------------------

	function pin( object, content, opts = {} ) {

		const {
			anchor = 'top',
			gap = 4,
			offset = null,
			fade = null,
			occlude = false,
			className = ''
		} = opts;

		const el = document.createElement( 'div' );
		el.className = `pin ${ className }`.trim();

		if ( typeof content === 'string' ) {

			const chip = document.createElement( 'div' );
			chip.className = 'chip';
			const label = document.createElement( 'span' );
			label.textContent = content;
			chip.append( ...( anchor === 'bottom' ? [ document.createElement( 'i' ), label ] : [ label, document.createElement( 'i' ) ] ) );
			if ( anchor === 'left' || anchor === 'right' || anchor === 'center' ) chip.querySelector( 'i' ).remove();
			el.appendChild( chip );

		} else {

			if ( ! content.className ) content.className = 'card';
			el.appendChild( content );

		}

		layer.appendChild( el );

		const entry = {
			object, el, anchor, gap, offset, fade, occlude, occluded: false,
			setText( text ) { const span = el.querySelector( '.chip span' ); if ( span ) span.textContent = text; },
			remove() { el.remove(); pins.delete( entry ); }
		};

		pins.add( entry );
		place( entry );
		return entry;

	}

	function place( entry ) {

		const rect = world.renderer.domElement.getBoundingClientRect();
		const host = container.getBoundingClientRect();

		anchorPoint( entry.object, entry.anchor, world.camera, _point );
		if ( entry.offset ) _point.add( _dir.fromArray( entry.offset ) );

		const s = toScreen( _point, world.camera, rect.width, rect.height );
		if ( ! s.visible ) { entry.el.hidden = true; return; }

		entry.el.hidden = false;
		const x = s.x + rect.left - host.left;
		const y = s.y + rect.top - host.top;
		entry.el.style.transform = `translate(${ x }px, ${ y }px) ${ anchorTransform( entry.anchor, entry.gap ) }`;
		// Nearer labels draw on top of farther ones.
		entry.el.style.zIndex = String( Math.round( ( 1 - s.depth ) * 100000 ) );

		world.camera.getWorldPosition( _camPos );
		let opacity = entry.fade ? fadeFor( _camPos.distanceTo( _point ), entry.fade.near ?? 0, entry.fade.far ) : 1;

		// Occlusion test every few frames: is something else in front of it?
		if ( entry.occlude && frame % 4 === 0 ) {

			const target = worldSphere( entry.object ).center;
			_dir.subVectors( target, _camPos ).normalize();
			raycaster.set( _camPos, _dir );
			const hit = raycaster.intersectObjects( world.scene.children, true ).find( ( h ) => h.object.visible && h.object.isMesh );
			entry.occluded = !! hit && ! isSelfOrChild( hit.object, entry.object ) && hit.distance < _camPos.distanceTo( target ) - worldSphere( entry.object ).radius;

		}

		if ( entry.occlude && entry.occluded ) opacity *= 0.25;
		entry.el.style.opacity = String( opacity );
		entry.el.style.pointerEvents = opacity < 0.05 ? 'none' : '';

	}

	// ---- keyboard access --------------------------------------------------------

	function accessible( object, label, opts = {} ) {

		if ( targets.has( object ) ) {

			targets.get( object ).button.textContent = label;
			return targets.get( object );

		}

		const li = document.createElement( 'li' );
		const button = document.createElement( 'button' );
		button.type = 'button';
		button.textContent = label;
		if ( opts.description ) button.setAttribute( 'aria-description', opts.description );
		li.appendChild( button );
		list.appendChild( li );

		button.addEventListener( 'focus', () => { focused = object; showRing(); } );
		button.addEventListener( 'blur', () => { if ( focused === object ) { focused = null; ring.hidden = true; } } );
		button.addEventListener( 'click', () => world.emit?.( object, 'click', null ) );
		button.addEventListener( 'keydown', ( e ) => { if ( e.key === 'Escape' ) button.blur(); } );

		const entry = {
			object, button, label,
			remove() { li.remove(); targets.delete( object ); if ( focused === object ) { focused = null; ring.hidden = true; } }
		};

		targets.set( object, entry );
		return entry;

	}

	function showRing() {

		if ( ! focused ) { ring.hidden = true; return; }

		const rect = world.renderer.domElement.getBoundingClientRect();
		const host = container.getBoundingClientRect();
		const sphere = worldSphere( focused );
		const s = toScreen( sphere.center, world.camera, rect.width, rect.height );
		if ( ! s.visible ) { ring.hidden = true; return; }

		const r = Math.max( 14, screenRadius( sphere, world.camera, rect.height ) + 8 );
		ring.hidden = false;
		ring.style.width = ring.style.height = `${ r * 2 }px`;
		ring.style.transform = `translate(${ s.x + rect.left - host.left - r }px, ${ s.y + rect.top - host.top - r }px)`;
		ring.querySelector( 'span' ).textContent = targets.get( focused )?.label ?? '';
		ring.querySelector( 'em' ).textContent = world.hasListener?.( focused, 'click' ) ? 'Enter to select' : '';

	}

	// ---- text in the world ------------------------------------------------------

	function text( value, opts = {} ) {

		const {
			size = 0.5,
			color = '#121214',
			background = null,
			font = '700 {px}px Urbanist, "Inter Tight", system-ui, sans-serif',
			pixelsPerUnit = 256,
			padding = 0.15
		} = opts;

		const canvas = document.createElement( 'canvas' );
		const ctx = canvas.getContext( '2d' );
		const texture = new CanvasTexture( canvas );
		texture.colorSpace = SRGBColorSpace;
		texture.anisotropy = 4;

		const material = new MeshBasicMaterial( { map: texture, transparent: true, side: DoubleSide, toneMapped: false, depthWrite: false } );
		const mesh = new Mesh( new PlaneGeometry( 1, 1 ), material );
		mesh.name = `Text: ${ value }`;

		const draw = () => {

			const px = Math.round( size * pixelsPerUnit );
			const fontSpec = font.replace( '{px}', px );
			ctx.font = fontSpec;
			const width = Math.ceil( ctx.measureText( mesh.userData.text ).width + padding * 2 * pixelsPerUnit );
			const height = Math.ceil( px * 1.3 + padding * 2 * pixelsPerUnit );

			canvas.width = width;
			canvas.height = height;
			ctx.font = fontSpec;
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'center';
			if ( background ) { ctx.fillStyle = background; ctx.beginPath(); ctx.roundRect( 0, 0, width, height, height / 2 ); ctx.fill(); }
			ctx.fillStyle = color;
			ctx.fillText( mesh.userData.text, width / 2, height / 2 + px * 0.04 );

			texture.dispose();
			texture.image = canvas;
			texture.needsUpdate = true;
			mesh.scale.set( width / pixelsPerUnit, height / pixelsPerUnit, 1 );

		};

		mesh.userData.text = String( value );
		mesh.userData.setText = ( next ) => { mesh.userData.text = String( next ); mesh.name = `Text: ${ next }`; draw(); };
		draw();

		// Redraw once web fonts are ready so the first frame isn't a fallback face.
		document.fonts?.load( font.replace( '{px}', '64' ) ).then( draw, () => {} );

		return mesh;

	}

	// ---- loop -------------------------------------------------------------------

	const offUpdate = world.onUpdate( () => {

		frame ++;
		for ( const entry of [ ...pins ] ) {

			if ( ! isAttached( entry.object ) ) { entry.remove(); continue; }
			place( entry );

		}

		for ( const entry of [ ...targets.values() ] ) if ( ! isAttached( entry.object ) ) entry.remove();
		if ( focused ) showRing();

	} );

	return {

		pin,
		accessible,
		text,
		layer,
		get pins() { return [ ...pins ]; },
		get focusable() { return [ ...targets.keys() ]; },

		dispose() {

			offUpdate?.();
			for ( const entry of [ ...pins ] ) entry.remove();
			for ( const entry of [ ...targets.values() ] ) entry.remove();
			layer.remove();
			list.remove();

		}

	};

}

export { createUI };
export { toScreen, fadeFor, anchorTransform, worldSphere, anchorPoint, screenRadius } from './math.js';
