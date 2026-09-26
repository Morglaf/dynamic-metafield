/**
 * Field type ↔ block attribute compatibility.
 */

export const SUPPORTED_BLOCKS = [
	'core/paragraph',
	'core/heading',
	'core/image',
	'core/button',
	'core/rss',
	'core/embed',
];

export const TEXT_TYPES = [
	'text',
	'textarea',
	'wysiwyg',
	'number',
	'range',
	'email',
	'url',
	'password',
	'select',
	'radio',
	'button_group',
	'true_false',
	'date_picker',
	'date_time_picker',
	'time_picker',
	'color_picker',
	'oembed',
	'page_link',
	'post_object',
	'link',
];

export const IMAGE_TYPES = [ 'image', 'file' ];
export const URL_TYPES = [ 'link', 'url', 'page_link', 'post_object', 'text', 'oembed' ];
export const LOOPABLE_TYPES = [ 'repeater', 'flexible_content' ];

/**
 * Whether this block name gets the binding panel.
 *
 * @param {string} blockName Block name.
 * @return {boolean}
 */
export function isSupportedBlock( blockName ) {
	if ( SUPPORTED_BLOCKS.includes( blockName ) ) {
		return true;
	}
	return typeof blockName === 'string' && blockName.startsWith( 'core-embed/' );
}

/**
 * Attributes to bind for a block + field type (single-shot, non-button).
 *
 * @param {string} blockName Block name.
 * @param {string} fieldType SCF type.
 * @return {string[]} Attribute names.
 */
export function attributesForBinding( blockName, fieldType ) {
	if ( blockName === 'core/paragraph' || blockName === 'core/heading' ) {
		return [ 'content' ];
	}
	if ( blockName === 'core/image' ) {
		if ( IMAGE_TYPES.includes( fieldType ) ) {
			return [ 'url', 'id', 'alt' ];
		}
		return [ 'url' ];
	}
	if ( blockName === 'core/rss' ) {
		return [ 'feedURL' ];
	}
	if ( blockName === 'core/embed' || blockName?.startsWith( 'core-embed/' ) ) {
		return [ 'url' ];
	}
	return [];
}

/**
 * Whether a field can feed a button URL / RSS / embed.
 *
 * @param {Object} field Field descriptor.
 * @return {boolean}
 */
export function fieldCanBindButtonUrl( field ) {
	if ( ! field || field.loopable ) {
		return false;
	}
	return URL_TYPES.includes( field.type ) || TEXT_TYPES.includes( field.type );
}

/**
 * Whether a field can feed a button label.
 *
 * @param {Object} field Field descriptor.
 * @return {boolean}
 */
export function fieldCanBindButtonText( field ) {
	if ( ! field || field.loopable ) {
		return false;
	}
	return TEXT_TYPES.includes( field.type );
}

/**
 * Filter fields compatible with a block.
 *
 * @param {Array}  fields    Field list.
 * @param {string} blockName Block name.
 * @return {Array}
 */
export function filterFieldsForBlock( fields, blockName ) {
	if ( blockName === 'core/button' ) {
		return ( fields || [] ).filter(
			( field ) =>
				fieldCanBindButtonUrl( field ) || fieldCanBindButtonText( field )
		);
	}
	if (
		blockName === 'core/rss' ||
		blockName === 'core/embed' ||
		blockName?.startsWith( 'core-embed/' )
	) {
		return ( fields || [] ).filter( fieldCanBindButtonUrl );
	}
	return ( fields || [] ).filter( ( field ) => {
		if ( field.loopable ) {
			return false;
		}
		return attributesForBinding( blockName, field.type ).length > 0;
	} );
}

/**
 * Fields for button URL select.
 *
 * @param {Array} fields Fields.
 * @return {Array}
 */
export function filterFieldsForButtonUrl( fields ) {
	return ( fields || [] ).filter( fieldCanBindButtonUrl );
}

/**
 * Fields for button text select.
 *
 * @param {Array} fields Fields.
 * @return {Array}
 */
export function filterFieldsForButtonText( fields ) {
	return ( fields || [] ).filter( fieldCanBindButtonText );
}

/**
 * Filter loopable fields for the container block.
 *
 * @param {Array} fields Fields.
 * @return {Array}
 */
export function filterLoopableFields( fields ) {
	return ( fields || [] ).filter( ( field ) => field.loopable );
}
