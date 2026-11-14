import { Box3, Raycaster, Vector2, Vector3 } from 'three';
import { createLeakTracker, frameStats, renderStats, treeRows, countObjects, structureKey, compact, labelFor } from './model.js';

const CSS = `
.orr-dt{position:fixed;right:20px;top:20px;bottom:20px;width:344px;z-index:2147483000;display:flex;flex-direction:column;overflow:hidden;
 background:#fff;color:#121214;border:1px solid #E8E7E3;border-radius:16px;box-shadow:0 16px 48px rgba(18,18,20,.10);
 font:13px/1.35 'Inter Tight',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.orr-dt[hidden]{display:none}
.orr-dt *{box-sizing:border-box}
.orr-dt .h{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid #E8E7E3}
.orr-dt .brand{font:700 16px Urbanist,'Inter Tight',sans-serif;letter-spacing:-.02em}
.orr-dt .badge.lost{color:#fff;background:#D23F45}
.orr-dt .badge{font-size:10px;font-weight:600;letter-spacing:.08em;color:#FF4F1A;background:#FFE9E1;padding:3px 7px;border-radius:999px;text-transform:uppercase}
.orr-dt .hint{margin-left:auto;font-size:12px;color:#8A8A90}
.orr-dt section{padding:14px 16px;border-bottom:1px solid #E8E7E3;display:flex;flex-direction:column;gap:10px}
.orr-dt .eb{font-size:11px;letter-spacing:.1em;color:#8A8A90;font-weight:600;text-transform:uppercase}
.orr-dt .row{display:flex;align-items:baseline;gap:8px}
.orr-dt .big{margin-left:auto;font:700 30px Urbanist,'Inter Tight',sans-serif;letter-spacing:-.02em}
.orr-dt .mute{font-size:12px;color:#5C5C63}
.orr-dt .spark{position:relative;height:56px;display:flex;align-items:flex-end;gap:2px;background:#F6F6F4;border-radius:8px;padding:6px}
.orr-dt .spark i{flex:1;background:#121214;border-radius:1px;min-height:1px}
.orr-dt .spark i.over{background:#FF4F1A}
.orr-dt .budget{position:absolute;left:6px;right:6px;border-top:1px dashed #FF4F1A}
.orr-dt .budget span{position:absolute;right:0;top:-13px;font-size:9px;color:#FF4F1A}
.orr-dt .tiles{display:flex;gap:6px}
.orr-dt .tile{flex:1;display:flex;flex-direction:column;gap:2px;padding:8px 10px;background:#F6F6F4;border-radius:8px}
.orr-dt .tile b{font:700 18px Urbanist,'Inter Tight',sans-serif}
.orr-dt .tile small{font-size:11px;color:#5C5C63}
.orr-dt .tile.warn{background:#FFE9E1}.orr-dt .tile.warn b,.orr-dt .tile.warn small{color:#FF4F1A}
.orr-dt .mem{display:flex;gap:16px;align-items:baseline;font-size:12px;color:#5C5C63}
.orr-dt .mem b{font:700 18px Urbanist,'Inter Tight',sans-serif;color:#121214;margin-right:4px}
.orr-dt .ok{margin-left:auto;color:#13875A}.orr-dt .bad{margin-left:auto;color:#D23F45;font-weight:600}
.orr-dt .tree{flex:1;min-height:80px;overflow:auto;padding:10px 6px 8px 10px;border-bottom:1px solid #E8E7E3;scrollbar-width:thin;scrollbar-color:#D9D8D3 transparent;scrollbar-gutter:stable}
.orr-dt .tree::-webkit-scrollbar{width:10px}
.orr-dt .tree::-webkit-scrollbar-track{background:transparent;margin:6px 0}
.orr-dt .tree::-webkit-scrollbar-thumb{background:#D9D8D3;border-radius:999px;border:3px solid #fff}
.orr-dt .tree::-webkit-scrollbar-thumb:hover{background:#FF4F1A}
.orr-dt .tree .eb{padding:4px 6px 6px}
.orr-dt .node{display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:6px;cursor:pointer;white-space:nowrap}
.orr-dt .node:hover{background:#F6F6F4}
.orr-dt .node.sel{background:#FFE9E1;color:#FF4F1A;font-weight:600}
.orr-dt .node.hid .lbl{opacity:.45}
.orr-dt .tw{width:10px;flex-shrink:0;color:#8A8A90;font-size:10px}
.orr-dt .lbl{overflow:hidden;text-overflow:ellipsis}
.orr-dt .meta{margin-left:auto;font-size:11px;color:#8A8A90;font-weight:400;flex-shrink:0}
.orr-dt .node.sel .meta{color:#FF4F1A}
.orr-dt .insp{padding:14px 16px 16px;display:flex;flex-direction:column;gap:10px}
.orr-dt .insp .ttl{display:flex;align-items:baseline;gap:8px}
.orr-dt .insp .ttl b{font:700 18px Urbanist,'Inter Tight',sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.orr-dt .insp .ttl span{margin-left:auto;font-size:12px;color:#5C5C63;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.orr-dt .vec{display:flex;align-items:center;gap:6px;font-size:12px}
.orr-dt .vec label{width:62px;color:#5C5C63;flex-shrink:0}
.orr-dt .vec input{flex:1;min-width:0;padding:6px 8px;background:#F6F6F4;border:1px solid transparent;border-radius:6px;font:12px 'Inter Tight',system-ui,sans-serif;color:#121214}
.orr-dt .vec input:focus{outline:none;border-color:#FF4F1A;background:#fff}
.orr-dt .btns{display:flex;gap:6px;padding-top:4px}
.orr-dt button{flex:1;padding:8px;border-radius:999px;border:0;background:#F6F6F4;font:500 12px 'Inter Tight',system-ui,sans-serif;color:#121214;cursor:pointer}
.orr-dt button:hover{background:#ECEBE7}
.orr-dt button.dark{background:#121214;color:#fff}
.orr-dt .empty{font-size:12px;color:#8A8A90}
.orr-dt-sel{position:fixed;z-index:2147482999;border:1.5px dashed #FF4F1A;border-radius:6px;pointer-events:none}
.orr-dt-sel span{position:absolute;left:-1px;top:-24px;padding:3px 8px;border-radius:999px;background:#FF4F1A;color:#fff;font:600 11px 'Inter Tight',system-ui,sans-serif;white-space:nowrap}
@media (max-width:640px){.orr-dt{left:12px;right:12px;width:auto;top:auto;height:62vh;bottom:12px}}
`;

const BACKEND_LABEL = { webgpu: 'WebGPU', webgl2: 'WebGL 2', webgl: 'WebGL', unknown: 'GPU' };
const DEG = 180 / Math.PI;

/** Wraps an angle in degrees into (-180, 180]. */
const wrapDegrees = ( d ) => { const w = ( ( d + 180 ) % 360 + 360 ) % 360 - 180; return w === - 180 ? 180 : w; };

/**
 * Mounts the Orrery devtools panel on a World: a frame graph with budgets,
 * GPU memory with orphaned-geometry detection, a live scene tree, and an
 * inspector for the selected object. Alt+click in the scene selects an object.
 *
 * ```js
 * import { mountDevtools } from '@orreryjs/devtools';
 * const devtools = mountDevtools( world );   // press ` to toggle
 * ```
 *
 * @param {Object} world - An Orrery World (or any SceneApp-like object).
 * @param {Object} [options]
 * @param {boolean} [options.open=true] - Start visible.
 * @param {string} [options.key='`'] - Toggle key.
 * @param {{frameMs?: number, drawCalls?: number, triangles?: number}} [options.budgets]
 * @param {number} [options.samples=48] - Bars in the frame graph.
 * @return {{el: HTMLElement, select: Function, toggle: Function, refresh: Function, readonly selected: ?Object, dispose: Function}}
 */
function mountDevtools( world, options = {} ) {

	const {
		open = true,
		key = '`',
		budgets: b = {},
		samples: sampleCount = 48,
		container = document.body
	} = options;

	const budgets = { frameMs: b.frameMs ?? 1000 / 60, drawCalls: b.drawCalls ?? 200, triangles: b.triangles ?? 1e6 };

	if ( ! document.getElementById( 'orr-dt-style' ) ) {

		const style = document.createElement( 'style' );
		style.id = 'orr-dt-style';
		style.textContent = CSS;
		document.head.appendChild( style );

	}

	const el = document.createElement( 'aside' );
	el.className = 'orr-dt';
	el.setAttribute( 'aria-label', 'Orrery devtools' );
	el.hidden = ! open;
	el.innerHTML = `
		<div class="h"><svg width="18" height="18" viewBox="0 0 220 220" fill="none" aria-hidden="true"><circle cx="110" cy="110" r="96" stroke="#121214" stroke-width="20"/><circle cx="110" cy="110" r="34" fill="#FF4F1A"/></svg>
			<div class="brand">devtools</div><div class="badge" data-r="backend"></div><div class="hint">${ key === '`' ? '`' : key } to hide</div></div>
		<section>
			<div class="row"><div class="eb">Frame</div><div class="big" data-r="fps">0</div><div class="mute" data-r="ms">fps</div></div>
			<div class="spark" data-r="spark"><div class="budget" data-r="budget"><span>${ budgets.frameMs.toFixed( 1 ) } ms</span></div></div>
			<div class="tiles">
				<div class="tile" data-r="callsTile"><b data-r="calls">0</b><small>draw calls / ${ compact( budgets.drawCalls ) }</small></div>
				<div class="tile" data-r="trisTile"><b data-r="tris">0</b><small>triangles / ${ compact( budgets.triangles ) }</small></div>
				<div class="tile" data-r="slowTile"><b data-r="slow">0</b><small>slow frames</small></div>
			</div>
		</section>
		<section><div class="eb">GPU memory</div>
			<div class="mem"><div><b data-r="geo">0</b>geometries</div><div><b data-r="tex">0</b>textures</div><div data-r="leak" class="ok">no leaks</div></div>
		</section>
		<div class="tree" data-r="tree"></div>
		<div class="insp" data-r="insp"></div>`;
	container.appendChild( el );

	const $ = ( name ) => el.querySelector( `[data-r="${ name }"]` );
	const spark = $( 'spark' );
	const bars = [];
	for ( let i = 0; i < sampleCount; i ++ ) {

		const bar = document.createElement( 'i' );
		spark.appendChild( bar );
		bars.push( bar );

	}

	// Graph scale: the budget line sits at 60% of the graph height.
	const graphMax = budgets.frameMs / 0.6;
	$( 'budget' ).style.bottom = `${ 6 + ( 44 * 0.6 ) }px`;
	$( 'backend' ).textContent = BACKEND_LABEL[ world.backend ?? 'unknown' ] ?? 'GPU';
	const offLost = world.onGpuLost?.( ( info ) => {

		const badge = $( 'backend' );
		badge.textContent = info.recovering ? 'GPU lost · recovering' : 'GPU lost';
		badge.classList.add( 'lost' );
		badge.title = `${ info.reason }${ info.message ? ': ' + info.message : '' }`;

	} );

	const outline = document.createElement( 'div' );
	outline.className = 'orr-dt-sel';
	outline.hidden = true;
	outline.innerHTML = '<span></span>';
	container.appendChild( outline );

	const frames = [];
	const expanded = new Set();
	let selected = null;
	let lastTreeKey = '';
	const leakTracker = createLeakTracker();
	let frameNo = 0;
	let hudTimer = 0;

	// ---- frame sampling ---------------------------------------------------

	let last = performance.now();
	const offUpdate = world.onUpdate( () => {

		const now = performance.now();
		frames.push( now - last );
		last = now;
		if ( frames.length > sampleCount ) frames.shift();
		frameNo ++;
		if ( selected ) placeOutline();

	} );

	// ---- HUD ----------------------------------------------------------------

	function refreshHud() {

		const f = frameStats( frames, budgets.frameMs );
		const r = renderStats( world.renderer );

		$( 'fps' ).textContent = f.fps;
		const scale = world.resolutionScale ?? 1;
		$( 'ms' ).textContent = `fps · ${ f.avgMs.toFixed( 1 ) } ms${ world.adaptive ? ` · res ${ Math.round( scale * 100 ) }%` : '' }`;
		$( 'calls' ).textContent = r.drawCalls;
		$( 'tris' ).textContent = compact( r.triangles );
		$( 'slow' ).textContent = f.slow;
		$( 'callsTile' ).classList.toggle( 'warn', r.drawCalls > budgets.drawCalls );
		$( 'trisTile' ).classList.toggle( 'warn', r.triangles > budgets.triangles );
		$( 'slowTile' ).classList.toggle( 'warn', f.slow > 0 );

		const offset = sampleCount - frames.length;
		bars.forEach( ( bar, i ) => {

			const ms = frames[ i - offset ];
			bar.style.height = ms === undefined ? '1px' : `${ Math.min( 44, Math.max( 1, ( ms / graphMax ) * 44 ) ) }px`;
			bar.classList.toggle( 'over', ms !== undefined && ms > budgets.frameMs * 1.5 );

		} );

		$( 'geo' ).textContent = r.geometries;
		$( 'tex' ).textContent = r.textures;

		// Geometries held by the renderer but used outside the scene (PMREM,
		// fullscreen quads) form a baseline taken once the first frames settle.
		const orphans = leakTracker.update( world.scene, performance.now() ).length;
		const leak = $( 'leak' );
		leak.className = orphans > 0 ? 'bad' : 'ok';
		leak.textContent = orphans > 0 ? `${ orphans } not in scene` : 'no leaks';
		leak.title = orphans > 0 ? `${ orphans } geometr${ orphans > 1 ? 'ies' : 'y' } left the scene without dispose(). Use world.remove(obj), or call geometry.dispose().` : '';

		refreshTree();
		if ( selected && document.activeElement?.closest?.( '.orr-dt .insp' ) == null ) refreshInspector();

	}

	// ---- tree ---------------------------------------------------------------

	const eventCount = ( object ) => {

		const byType = world._handlers?.get?.( object );
		if ( ! byType ) return 0;
		return Object.values( byType ).reduce( ( n, set ) => n + set.size, 0 );

	};

	function refreshTree( force = false ) {

		const key = structureKey( world.scene ) + '|' + ( selected?.id ?? '' ) + '|' + [ ...expanded ].join( ',' );
		if ( ! force && key === lastTreeKey ) return;
		lastTreeKey = key;

		if ( selected && ! isAttached( selected ) ) select( null );

		const tree = $( 'tree' );
		const scroll = tree.scrollTop;
		tree.innerHTML = `<div class="eb">Scene · ${ countObjects( world.scene ) } objects</div>`;

		for ( const row of treeRows( world.scene, expanded, eventCount ) ) {

			const node = document.createElement( 'div' );
			node.className = 'node' + ( row.object === selected ? ' sel' : '' ) + ( row.object.visible ? '' : ' hid' );
			node.style.paddingLeft = `${ 6 + row.depth * 16 }px`;
			const inst = row.object.isInstancedMesh ? `Instanced ×${ row.object.count }` : null;
			const meta = inst ?? ( row.events ? `${ row.type } · ${ row.events } event${ row.events > 1 ? 's' : '' }` : ( row.childCount && ! row.open ? `${ row.type } · ${ row.childCount }` : row.type ) );
			node.innerHTML = `<span class="tw">${ row.childCount ? ( row.open ? '▾' : '▸' ) : '' }</span><span class="lbl"></span><span class="meta"></span>`;
			node.querySelector( '.lbl' ).textContent = row.label;
			node.querySelector( '.meta' ).textContent = meta;
			node.onclick = ( e ) => {

				if ( row.childCount && row.depth > 0 && ( e.target.classList.contains( 'tw' ) || row.object === selected ) ) {

					expanded.has( row.object.uuid ) ? expanded.delete( row.object.uuid ) : expanded.add( row.object.uuid );
					refreshTree();
					return;

				}

				select( row.object );

			};
			tree.appendChild( node );

		}

		tree.scrollTop = scroll;

	}

	// ---- inspector ----------------------------------------------------------

	function refreshInspector() {

		const insp = $( 'insp' );

		if ( ! selected ) {

			insp.innerHTML = '<div class="empty">Select an object in the tree, or Alt+click it in the scene.</div>';
			return;

		}

		const o = selected;
		const geo = o.geometry?.type;
		const mat = Array.isArray( o.material ) ? `${ o.material.length } materials` : o.material?.type;
		const fmt = ( v ) => ( Math.abs( v ) < 1e-4 ? 0 : v ).toFixed( 2 );

		if ( insp.dataset.uuid !== o.uuid ) {

			insp.dataset.uuid = o.uuid;
			insp.innerHTML = `<div class="ttl"><b></b><span></span></div>
				${ [ 'position', 'rotation', 'scale' ].map( ( p ) => `<div class="vec" data-p="${ p }"><label>${ p }${ p === 'rotation' ? '°' : '' }</label>${ [ 'x', 'y', 'z' ].map( ( a ) => `<input type="number" step="${ p === 'rotation' ? 1 : 0.1 }" data-a="${ a }" aria-label="${ p } ${ a }">` ).join( '' ) }</div>` ).join( '' ) }
				<div class="btns"><button data-act="vis"></button><button data-act="log">Log to console</button><button class="dark" data-act="remove">Remove</button></div>`;

			insp.querySelectorAll( '.vec input' ).forEach( ( input ) => {

				input.addEventListener( 'input', () => {

					const p = input.parentElement.dataset.p;
					const v = parseFloat( input.value );
					if ( Number.isNaN( v ) ) return;
					selected[ p ][ input.dataset.a ] = p === 'rotation' ? v / DEG : v;

				} );

			} );

			insp.querySelector( '[data-act="vis"]' ).onclick = () => { selected.visible = ! selected.visible; refreshInspector(); refreshTree(); };
			insp.querySelector( '[data-act="log"]' ).onclick = () => { window.$orrery = selected; console.log( '[orrery] $orrery =', selected ); };
			insp.querySelector( '[data-act="remove"]' ).onclick = () => {

				const target = selected;
				select( null );
				if ( typeof world.remove === 'function' ) world.remove( target ); else target.parent?.remove( target );
				refreshTree( true );

			};

		}

		insp.querySelector( '.ttl b' ).textContent = labelFor( o );
		insp.querySelector( '.ttl span' ).textContent = [ geo, mat ].filter( Boolean ).join( ' · ' ) || o.type;
		insp.querySelector( '[data-act="vis"]' ).textContent = o.visible ? 'Hide' : 'Show';

		for ( const p of [ 'position', 'rotation', 'scale' ] ) {

			for ( const a of [ 'x', 'y', 'z' ] ) {

				const input = insp.querySelector( `[data-p="${ p }"] [data-a="${ a }"]` );
				if ( document.activeElement !== input ) input.value = fmt( p === 'rotation' ? wrapDegrees( o[ p ][ a ] * DEG ) : o[ p ][ a ] );

			}

		}

	}

	// ---- selection ----------------------------------------------------------

	function isAttached( object ) {

		let n = object;
		while ( n.parent ) n = n.parent;
		return n === world.scene;

	}

	function select( object ) {

		selected = object ?? null;

		if ( selected ) {

			// Open every ancestor so the row is visible.
			for ( let p = selected.parent; p && p !== world.scene; p = p.parent ) expanded.add( p.uuid );

		}

		outline.hidden = ! selected;
		if ( selected ) outline.querySelector( 'span' ).textContent = labelFor( selected );
		$( 'insp' ).dataset.uuid = '';
		refreshInspector();
		refreshTree();
		if ( selected ) placeOutline();

	}

	const box = new Box3();
	const corner = new Vector3();

	function placeOutline() {

		if ( ! selected || el.hidden ) { outline.hidden = true; return; }

		box.setFromObject( selected );
		if ( box.isEmpty() ) { outline.hidden = true; return; }

		const rect = world.renderer.domElement.getBoundingClientRect();
		let minX = Infinity, minY = Infinity, maxX = - Infinity, maxY = - Infinity, behind = true;

		for ( let i = 0; i < 8; i ++ ) {

			corner.set( i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z ).project( world.camera );
			if ( corner.z < 1 ) behind = false;
			const x = rect.left + ( corner.x + 1 ) / 2 * rect.width;
			const y = rect.top + ( 1 - corner.y ) / 2 * rect.height;
			minX = Math.min( minX, x ); maxX = Math.max( maxX, x );
			minY = Math.min( minY, y ); maxY = Math.max( maxY, y );

		}

		const pad = 6;
		minX = Math.max( minX - pad, rect.left ); minY = Math.max( minY - pad, rect.top );
		maxX = Math.min( maxX + pad, rect.right ); maxY = Math.min( maxY + pad, rect.bottom );
		outline.hidden = behind || maxX <= minX || maxY <= minY;
		Object.assign( outline.style, {
			left: `${ minX }px`, top: `${ minY }px`,
			width: `${ maxX - minX }px`, height: `${ maxY - minY }px`
		} );

	}

	// ---- alt+click picking --------------------------------------------------

	const raycaster = new Raycaster();
	const ndc = new Vector2();

	const onCanvasClick = ( event ) => {

		if ( ! event.altKey || el.hidden ) return;
		const rect = world.renderer.domElement.getBoundingClientRect();
		ndc.set( ( event.clientX - rect.left ) / rect.width * 2 - 1, - ( event.clientY - rect.top ) / rect.height * 2 + 1 );
		raycaster.setFromCamera( ndc, world.camera );
		const hit = raycaster.intersectObjects( world.scene.children, true ).find( ( h ) => h.object.visible && h.object.isMesh );
		select( hit ? hit.object : null );
		event.stopImmediatePropagation();

	};

	world.renderer.domElement.addEventListener( 'click', onCanvasClick, true );
	const offRenderer = world.onRendererChange?.( ( next, prev ) => {

		prev.domElement.removeEventListener( 'click', onCanvasClick, true );
		next.domElement.addEventListener( 'click', onCanvasClick, true );
		const badge = $( 'backend' );
		badge.classList.remove( 'lost' );
		badge.textContent = `${ BACKEND_LABEL[ world.backend ] ?? 'GPU' } · recovered`;

	} );

	// ---- toggle -------------------------------------------------------------

	function toggle( force ) {

		el.hidden = force === undefined ? ! el.hidden : ! force;
		if ( el.hidden ) outline.hidden = true; else placeOutline();

	}

	const onKey = ( event ) => {

		if ( event.key !== key || event.target.closest?.( 'input, textarea, [contenteditable="true"]' ) ) return;
		toggle();

	};

	window.addEventListener( 'keydown', onKey );
	hudTimer = setInterval( () => { if ( ! el.hidden ) refreshHud(); }, 250 );
	refreshHud();
	refreshInspector();

	return {

		el,
		select,
		toggle,
		refresh: () => { refreshTree( true ); refreshHud(); },
		get selected() { return selected; },

		dispose() {

			clearInterval( hudTimer );
			offUpdate?.();
			offLost?.();
			offRenderer?.();
			window.removeEventListener( 'keydown', onKey );
			world.renderer.domElement.removeEventListener( 'click', onCanvasClick, true );
			el.remove();
			outline.remove();

		}

	};

}

export { mountDevtools };
export * from './model.js';
