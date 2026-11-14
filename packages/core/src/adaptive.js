/**
 * A small controller that trades resolution for frame rate. Feed it frame
 * times; it returns a new resolution scale when the average over a window is
 * clearly over budget (step down) or comfortably under it (step back up).
 *
 * Long hitches (tab switches, GC pauses, a throttled background window) are
 * ignored so they never cause a drop on their own.
 *
 * @param {Object} [options]
 * @param {number} [options.budgetMs=16.7] - Target frame time.
 * @param {number} [options.min=0.5] - Lowest scale.
 * @param {number} [options.max=1] - Highest scale.
 * @param {number} [options.step=0.25] - Change per adjustment.
 * @param {number} [options.window=30] - Frames averaged per decision.
 * @param {number} [options.ignoreAboveMs=250] - Frames longer than this are skipped.
 * @return {{feed: function(number): ?number, readonly scale: number, reset: Function}}
 */
function createAdaptiveResolution( options = {} ) {

	const {
		budgetMs = 1000 / 60,
		min = 0.5,
		max = 1,
		step = 0.25,
		window: size = 30,
		ignoreAboveMs = 250
	} = options;

	let scale = max;
	let samples = [];
	let cooldown = 0;   // windows to wait after a drop before trying to raise

	return {

		get scale() { return scale; },

		reset() { scale = max; samples = []; cooldown = 0; },

		/**
		 * @param {number} ms - Duration of the last frame.
		 * @return {?number} The new scale when it changes, otherwise null.
		 */
		feed( ms ) {

			if ( ! ( ms > 0 ) || ms > ignoreAboveMs ) return null;

			samples.push( ms );
			if ( samples.length < size ) return null;

			const avg = samples.reduce( ( a, b ) => a + b, 0 ) / samples.length;
			samples = [];

			// On a vsync-locked display frames never beat the refresh interval,
			// so "on budget" counts as headroom. A cooldown after each drop stops
			// the scale flipping between two levels.
			let next = scale;
			if ( avg > budgetMs * 1.2 ) {

				next = Math.max( min, scale - step );
				cooldown = 3;

			} else if ( cooldown > 0 ) {

				cooldown --;

			} else if ( avg <= budgetMs * 1.05 ) {

				next = Math.min( max, scale + step );

			}

			if ( next === scale ) return null;
			scale = next;
			return scale;

		}

	};

}

export { createAdaptiveResolution };
