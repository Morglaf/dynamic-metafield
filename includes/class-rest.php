<?php
/**
 * REST API for field lists and values.
 *
 * @package DynamicMetafield
 */

namespace DynamicMetafield;

defined( 'ABSPATH' ) || exit;

/**
 * REST routes under dynamic-metafield/v1.
 */
class Rest {

	const NAMESPACE = 'dynamic-metafield/v1';

	/**
	 * Register routes.
	 */
	public static function register() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/**
	 * Routes.
	 */
	public static function register_routes() {
		register_rest_route(
			self::NAMESPACE,
			'/fields',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_fields' ),
				'permission_callback' => array( __CLASS__, 'can_edit' ),
				'args'                => self::context_args(),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/values',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_values' ),
				'permission_callback' => array( __CLASS__, 'can_edit' ),
				'args'                => self::context_args(),
			)
		);
	}

	/**
	 * Shared context query args.
	 *
	 * @return array<string, mixed>
	 */
	private static function context_args() {
		// NOTE: never name a param "context" — it collides with WP REST global context (view|edit|embed).
		// post_id / user_id / term_id are sanitized loosely: FSE template IDs are strings and must not 400.
		return array(
			'scf_context' => array(
				'type'    => 'string',
				'default' => 'post',
				'enum'    => array( 'post', 'option', 'options', 'user', 'term' ),
			),
			'post_id'     => array(
				'required'          => false,
				'default'           => 0,
				'sanitize_callback' => array( __CLASS__, 'sanitize_id_param' ),
			),
			'post_type'   => array(
				'type'    => 'string',
				'default' => '',
			),
			'user_id'     => array(
				'required'          => false,
				'default'           => 0,
				'sanitize_callback' => array( __CLASS__, 'sanitize_id_param' ),
			),
			'term_id'     => array(
				'required'          => false,
				'default'           => 0,
				'sanitize_callback' => array( __CLASS__, 'sanitize_id_param' ),
			),
			'taxonomy'    => array(
				'type'    => 'string',
				'default' => '',
			),
		);
	}

	/**
	 * Accept numeric IDs only; coerce template string IDs to 0.
	 *
	 * @param mixed $value Raw request value.
	 * @return int
	 */
	public static function sanitize_id_param( $value ) {
		if ( is_numeric( $value ) ) {
			return absint( $value );
		}
		return 0;
	}

	/**
	 * Permission: edit posts.
	 *
	 * @return bool
	 */
	public static function can_edit() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Normalize request into resolver args.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return array{0:string,1:array<string,mixed>}
	 */
	private static function parse_request( $request ) {
		$context = (string) $request->get_param( 'scf_context' );
		if ( '' === $context ) {
			$context = (string) $request->get_param( 'context' );
		}
		if ( 'options' === $context ) {
			$context = 'option';
		}
		if ( ! in_array( $context, array( 'post', 'option', 'user', 'term' ), true ) ) {
			$context = 'post';
		}
		$args = array(
			'postId'   => (int) $request->get_param( 'post_id' ),
			'postType' => (string) $request->get_param( 'post_type' ),
			'userId'   => (int) $request->get_param( 'user_id' ),
			'termId'   => (int) $request->get_param( 'term_id' ),
			'taxonomy' => (string) $request->get_param( 'taxonomy' ),
		);
		return array( $context, $args );
	}

	/**
	 * GET /fields.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public static function get_fields( $request ) {
		list( $context, $args ) = self::parse_request( $request );
		$fields = Field_Resolver::list_fields( $context, $args );
		return rest_ensure_response( array( 'fields' => $fields ) );
	}

	/**
	 * GET /values.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public static function get_values( $request ) {
		list( $context, $args ) = self::parse_request( $request );
		$values = Field_Resolver::list_values( $context, $args );
		return rest_ensure_response( array( 'values' => $values ) );
	}
}
