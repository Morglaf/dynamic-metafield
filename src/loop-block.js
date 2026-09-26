/**
 * Editor UI for dynamic-metafield/loop container block.
 */
import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	InspectorControls,
	InnerBlocks,
} from '@wordpress/block-editor';
import { PanelBody, SelectControl, TextControl, Spinner } from '@wordpress/components';
import { useEffect, useMemo, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import { filterLoopableFields } from './utils/field-compat';
import {
	resolveEditorEntity,
	buildFieldsQuery,
} from './utils/editor-query';

const settings =
	typeof window !== 'undefined' && window.dmfSettings
		? window.dmfSettings
		: { postId: 0 };

const CONTEXT_OPTIONS = [
	{ label: __( 'Publication (post)', 'dynamic-metafield' ), value: 'post' },
	{ label: __( 'Options SCF', 'dynamic-metafield' ), value: 'option' },
	{ label: __( 'Utilisateur (auteur)', 'dynamic-metafield' ), value: 'user' },
	{ label: __( 'Terme', 'dynamic-metafield' ), value: 'term' },
];

const ALLOWED = [
	'core/paragraph',
	'core/heading',
	'core/image',
	'core/button',
	'core/group',
	'core/columns',
	'core/column',
	'dynamic-metafield/loop',
];

function Edit( { attributes, setAttributes } ) {
	const { field, context, layout, taxonomy, tagName } = attributes;
	const [ fields, setFields ] = useState( [] );
	const [ loading, setLoading ] = useState( false );

	const { postId, postType } = useSelect(
		( select ) => resolveEditorEntity( select, {}, settings ),
		[]
	);

	useEffect( () => {
		let cancelled = false;
		setLoading( true );
		const qs = buildFieldsQuery( {
			scfContext: context || 'post',
			postId,
			postType,
			taxonomy,
		} );
		apiFetch( { path: `/dynamic-metafield/v1/fields?${ qs.toString() }` } )
			.then( ( res ) => {
				if ( ! cancelled ) {
					setFields( res.fields || [] );
				}
			} )
			.catch( () => {
				if ( ! cancelled ) {
					setFields( [] );
				}
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setLoading( false );
				}
			} );
		return () => {
			cancelled = true;
		};
	}, [ context, postId, postType, taxonomy ] );

	const loopables = useMemo(
		() => filterLoopableFields( fields ),
		[ fields ]
	);

	const fieldOptions = useMemo( () => {
		const opts = [
			{
				label: __( '— Choisir un repeater / flexible —', 'dynamic-metafield' ),
				value: '',
			},
		];
		loopables.forEach( ( f ) => {
			opts.push( {
				label: `${ f.label }`,
				value: f.name,
			} );
		} );
		return opts;
	}, [ loopables ] );

	const blockProps = useBlockProps( {
		className: 'wp-block-dynamic-metafield-loop',
	} );

	return (
		<>
			<InspectorControls>
				<PanelBody
					title={ __( 'Boucle SCF', 'dynamic-metafield' ) }
					initialOpen={ true }
				>
					<SelectControl
						label={ __( 'Contexte', 'dynamic-metafield' ) }
						value={ context }
						options={ CONTEXT_OPTIONS }
						onChange={ ( value ) => setAttributes( { context: value } ) }
					/>
					{ context === 'term' && (
						<TextControl
							label={ __( 'Taxonomie', 'dynamic-metafield' ) }
							value={ taxonomy }
							onChange={ ( value ) => setAttributes( { taxonomy: value } ) }
						/>
					) }
					{ loading ? (
						<Spinner />
					) : (
						<SelectControl
							label={ __( 'Champ bouclable', 'dynamic-metafield' ) }
							value={ field }
							options={ fieldOptions }
							onChange={ ( value ) => setAttributes( { field: value } ) }
						/>
					) }
					<TextControl
						label={ __( 'Layout flexible (optionnel)', 'dynamic-metafield' ) }
						value={ layout }
						onChange={ ( value ) => setAttributes( { layout: value } ) }
						help={ __(
							'Si renseigné, seules les lignes de ce layout Flexible Content sont rendues.',
							'dynamic-metafield'
						) }
					/>
					<SelectControl
						label={ __( 'Balise HTML', 'dynamic-metafield' ) }
						value={ tagName || 'div' }
						options={ [
							{ label: 'div', value: 'div' },
							{ label: 'section', value: 'section' },
							{ label: 'ul', value: 'ul' },
							{ label: 'ol', value: 'ol' },
						] }
						onChange={ ( value ) => setAttributes( { tagName: value } ) }
					/>
				</PanelBody>
			</InspectorControls>
			<div { ...blockProps }>
				<p className="dmf-loop__label">
					{ field
						? __( 'Boucle SCF : ', 'dynamic-metafield' ) + field
						: __(
								'Boucle SCF — choisissez un champ Repeater / Flexible',
								'dynamic-metafield'
						  ) }
				</p>
				<InnerBlocks allowedBlocks={ ALLOWED } />
			</div>
		</>
	);
}

export function registerLoopBlock() {
	registerBlockType( 'dynamic-metafield/loop', {
		apiVersion: 3,
		title: __( 'SCF Field Loop', 'dynamic-metafield' ),
		description: __(
			'Boucle sur un Repeater ou Flexible Content SCF.',
			'dynamic-metafield'
		),
		category: 'theme',
		icon: 'update',
		attributes: {
			field: { type: 'string', default: '' },
			context: { type: 'string', default: 'post' },
			layout: { type: 'string', default: '' },
			userId: { type: 'number', default: 0 },
			termId: { type: 'number', default: 0 },
			taxonomy: { type: 'string', default: '' },
			tagName: { type: 'string', default: 'div' },
		},
		supports: {
			html: false,
			align: [ 'wide', 'full' ],
		},
		usesContext: [ 'postId', 'postType', 'termId', 'taxonomy' ],
		edit: Edit,
		save: () => <InnerBlocks.Content />,
	} );
}
