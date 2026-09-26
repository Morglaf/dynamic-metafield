<?php
/**
 * Block Bindings source registration.
 *
 * @package DynamicMetafield
 */

namespace DynamicMetafield;

defined( 'ABSPATH' ) || exit;

/**
 * Registers dynamic-metafield/scf bindings source + extra bindable attributes.
 */
class Bindings_Source {

	/**
	 * Register on init.
	 */
	public static function register() {
		add_action( 'init', array( __CLASS__, 'register_source' ) );
		add_filter( 'block_bindings_supported_attributes', array( __CLASS__, 'supported_attributes' ), 10, 2 );
	}

	/**
	 * Allow bindings on RSS feedURL and Embed url (incl. YouTube).
	 *
	 * @param string[] $attributes Supported attributes.
	 * @param string   $block_type Block name.
	 * @return string[]
	 */
	public static function supported_attributes( $attributes, $block_type ) {
		if ( 'core/rss' === $block_type ) {
			$attributes[] = 'feedURL';
		}
		if ( 'core/embed' === $block_type || 0 === strpos( (string) $block_type, 'core-embed/' ) ) {
			$attributes[] = 'url';
		}
		return array_values( array_unique( $attributes ) );
	}

	/**
	 * register_block_bindings_source.
	 */
	public static function register_source() {
		if ( ! function_exists( 'register_block_bindings_source' ) ) {
			return;
		}

		register_block_bindings_source(
			DMF_SOURCE,
			array(
				'label'              => __( 'Secure Custom Fields', 'dynamic-metafield' ),
				'get_value_callback' => array( __CLASS__, 'get_value' ),
				'uses_context'       => array( 'postId', 'postType' ),
			)
		);

		// Keep legacy source so existing content with dai-dmf/scf still resolves.
		if ( DMF_SOURCE_LEGACY !== DMF_SOURCE ) {
			register_block_bindings_source(
				DMF_SOURCE_LEGACY,
				array(
					'label'              => __( 'Secure Custom Fields (legacy)', 'dynamic-metafield' ),
					'get_value_callback' => array( __CLASS__, 'get_value' ),
					'uses_context'       => array( 'postId', 'postType' ),
				)
			);
		}
	}

	/**
	 * Bindings callback.
	 *
	 * @param array     $source_args    Source args.
	 * @param \WP_Block $block_instance Block.
	 * @param string    $attribute_name Attribute.
	 * @return mixed
	 */
	public static function get_value( $source_args, $block_instance, $attribute_name ) {
		$context = is_array( $block_instance->context ) ? $block_instance->context : array();
		return Field_Resolver::resolve_bound_value( $source_args, $context, $attribute_name );
	}
}
