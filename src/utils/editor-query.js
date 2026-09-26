/**
 * Resolve safe REST query params from the block editor / site editor.
 * FSE template IDs are strings like "theme//single-cpt" and must NOT be sent as post_id.
 */

/**
 * Keep only a positive numeric post ID (reject template string IDs).
 *
 * @param {*} value Raw id.
 * @return {number}
 */
export function normalizePostId( value ) {
	if ( typeof value === 'number' && Number.isFinite( value ) && value > 0 ) {
		return Math.floor( value );
	}
	if ( typeof value === 'string' && /^\d+$/.test( value.trim() ) ) {
		const n = parseInt( value.trim(), 10 );
		return n > 0 ? n : 0;
	}
	return 0;
}

/**
 * Infer post type from a template slug (single-{post_type}, etc.).
 *
 * @param {string} slug Template slug or "theme//slug".
 * @return {string}
 */
export function postTypeFromTemplateSlug( slug ) {
	if ( ! slug || typeof slug !== 'string' ) {
		return '';
	}
	const bare = slug.includes( '//' ) ? slug.split( '//' ).pop() : slug;
	if ( ! bare ) {
		return '';
	}
	if ( bare === 'single' || bare === 'singular' || bare === 'home' || bare === 'index' ) {
		return 'post';
	}
	if ( bare === 'page' || bare === 'front-page' ) {
		return 'page';
	}
	if ( bare.startsWith( 'page-' ) ) {
		return 'page';
	}
	if ( bare.startsWith( 'single-' ) ) {
		// single-{post_type} or single-{post_type}-{name} — return the longest
		// registered match when available; otherwise everything after "single-".
		const rest = bare.slice( 'single-'.length );
		if ( typeof window !== 'undefined' && window.wp?.data?.select ) {
			const types = window.wp.data.select( 'core' )?.getPostTypes?.( {
				per_page: -1,
			} );
			if ( Array.isArray( types ) && types.length ) {
				const names = types
					.map( ( t ) => t?.slug )
					.filter( Boolean )
					.sort( ( a, b ) => b.length - a.length );
				for ( const name of names ) {
					if ( rest === name || rest.startsWith( name + '-' ) ) {
						return name;
					}
				}
			}
		}
		return rest;
	}
	return '';
}

/**
 * Build { postId, postType } for REST field listing.
 *
 * @param {Object} select      wp.data select.
 * @param {Object} blockContext Block context from props.
 * @param {Object} settings     Plugin localized settings.
 * @return {{ postId: number, postType: string }}
 */
export function resolveEditorEntity( select, blockContext = {}, settings = {} ) {
	const ctx = blockContext || {};
	let postId = normalizePostId( ctx.postId );
	let postType = typeof ctx.postType === 'string' ? ctx.postType : '';

	const editor = select( 'core/editor' );
	const editSite = select( 'core/edit-site' );

	if ( ! postId ) {
		postId = normalizePostId( editor?.getCurrentPostId?.() );
	}
	if ( ! postId ) {
		postId = normalizePostId( settings.postId );
	}

	const editedType =
		editor?.getCurrentPostType?.() ||
		editSite?.getEditedPostType?.() ||
		'';

	if (
		! postType ||
		postType === 'wp_template' ||
		postType === 'wp_template_part'
	) {
		if (
			editedType &&
			editedType !== 'wp_template' &&
			editedType !== 'wp_template_part'
		) {
			postType = editedType;
		} else {
			const slug =
				editor?.getEditedPostAttribute?.( 'slug' ) ||
				( typeof editSite?.getEditedPostId?.() === 'string'
					? editSite.getEditedPostId()
					: '' ) ||
				'';
			const inferred = postTypeFromTemplateSlug( slug );
			if ( inferred ) {
				postType = inferred;
			}
		}
	}

	if ( postType === 'wp_template' || postType === 'wp_template_part' ) {
		postType = '';
	}

	return { postId, postType };
}

/**
 * URLSearchParams for /fields or /values.
 *
 * @param {Object} options
 * @return {URLSearchParams}
 */
export function buildFieldsQuery( {
	scfContext = 'post',
	postId = 0,
	postType = '',
	taxonomy = '',
	userId = 0,
	termId = 0,
} = {} ) {
	const qs = new URLSearchParams( {
		scf_context: scfContext === 'options' ? 'option' : scfContext,
	} );
	const id = normalizePostId( postId );
	if ( id > 0 ) {
		qs.set( 'post_id', String( id ) );
	}
	if ( postType ) {
		qs.set( 'post_type', postType );
	}
	if ( taxonomy ) {
		qs.set( 'taxonomy', taxonomy );
	}
	const uid = normalizePostId( userId );
	if ( uid > 0 ) {
		qs.set( 'user_id', String( uid ) );
	}
	const tid = normalizePostId( termId );
	if ( tid > 0 ) {
		qs.set( 'term_id', String( tid ) );
	}
	return qs;
}
