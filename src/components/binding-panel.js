/**
 * Inspector panel: bind SCF fields to supported core blocks.
 */
import { __ } from '@wordpress/i18n';
import { InspectorControls } from '@wordpress/block-editor';
import {
	PanelBody,
	SelectControl,
	ToggleControl,
	Spinner,
	Button,
	Notice,
	TextControl,
	RangeControl,
} from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useEffect, useMemo, useState } from '@wordpress/element';
import { createHigherOrderComponent } from '@wordpress/compose';
import { addFilter } from '@wordpress/hooks';
import apiFetch from '@wordpress/api-fetch';
import {
	isSupportedBlock,
	filterFieldsForBlock,
	filterFieldsForButtonUrl,
	filterFieldsForButtonText,
	attributesForBinding,
} from '../utils/field-compat';
import {
	resolveEditorEntity,
	buildFieldsQuery,
} from '../utils/editor-query';

const settings =
	typeof window !== 'undefined' && window.dmfSettings
		? window.dmfSettings
		: { source: 'dynamic-metafield/scf', postId: 0 };

const OUR_SOURCES = [
	settings.source || 'dynamic-metafield/scf',
	'dynamic-metafield/scf',
	'dai-dmf/scf',
];

/**
 * @param {string} source
 * @return {boolean}
 */
function isOurSource( source ) {
	return OUR_SOURCES.includes( source );
}

const CONTEXT_OPTIONS = [
	{ label: __( 'Publication (post)', 'dynamic-metafield' ), value: 'post' },
	{ label: __( 'Options SCF', 'dynamic-metafield' ), value: 'option' },
	{ label: __( 'Utilisateur (auteur)', 'dynamic-metafield' ), value: 'user' },
	{ label: __( 'Terme', 'dynamic-metafield' ), value: 'term' },
];

const EMPTY_OPTION = {
	label: __( '— Aucune liaison —', 'dynamic-metafield' ),
	value: '',
};

/**
 * @param {Array} fields
 * @return {Array}
 */
function toOptions( fields ) {
	return [
		EMPTY_OPTION,
		...( fields || [] ).map( ( field ) => ( {
			label: `${ field.label } [${ field.type }]`,
			value: field.name,
		} ) ),
	];
}

/**
 * @param {Object} field
 * @param {string} scfContext
 * @param {string} taxonomy
 * @param {string} before
 * @param {string} after
 * @return {Object}
 */
function bindingArgs( field, scfContext, taxonomy, before = '', after = '' ) {
	const args = {
		key: field.name,
		context: scfContext,
		relative: !! field.relative,
	};
	if ( scfContext === 'term' && taxonomy ) {
		args.taxonomy = taxonomy;
	}
	if ( before ) {
		args.before = before;
	}
	if ( after ) {
		args.after = after;
	}
	return args;
}

/**
 * @param {Function} setAttributes
 * @param {Object}   attributes
 * @param {Object}   patch
 * @param {boolean}  hideIfEmpty
 * @param {boolean}  clearOurs
 */
function writeBindings(
	setAttributes,
	attributes,
	patch,
	hideIfEmpty,
	clearOurs = false
) {
	const prevMeta = attributes.metadata || {};
	const prevBindings = { ...( prevMeta.bindings || {} ) };

	if ( clearOurs ) {
		Object.keys( prevBindings ).forEach( ( attr ) => {
			if ( prevBindings[ attr ]?.source && isOurSource(prevBindings[ attr ].source) ) {
				delete prevBindings[ attr ];
			}
		} );
	} else if ( patch ) {
		Object.entries( patch ).forEach( ( [ attr, binding ] ) => {
			if ( ! binding ) {
				delete prevBindings[ attr ];
			} else {
				prevBindings[ attr ] = binding;
			}
		} );
	}

	const metadata = {
		...prevMeta,
		dmf: {
			...( prevMeta.dmf || {} ),
			hideIfEmpty: !! hideIfEmpty,
		},
	};

	if ( Object.keys( prevBindings ).length ) {
		metadata.bindings = prevBindings;
	} else {
		delete metadata.bindings;
	}

	setAttributes( {
		metadata: Object.keys( metadata ).length ? metadata : undefined,
	} );
}

/**
 * @param {Object} bindings
 * @param {string} attribute
 * @return {string}
 */
function keyForAttribute( bindings, attribute ) {
	const binding = bindings?.[ attribute ];
	if ( binding?.source && isOurSource(binding.source) ) {
		return binding.args?.key || '';
	}
	return '';
}

/**
 * First of our bindings (for shared affixes on simple blocks).
 *
 * @param {Object} bindings
 * @return {Object|null}
 */
function firstOurBinding( bindings ) {
	return (
		Object.values( bindings || {} ).find(
			( b ) => b?.source && isOurSource(b.source)
		) || null
	);
}

/**
 * Affix fields UI.
 *
 * @param {Object} props
 */
function AffixControls( { before, after, onBefore, onAfter, help } ) {
	return (
		<>
			<TextControl
				label={ __( 'Avant (préfixe)', 'dynamic-metafield' ) }
				value={ before }
				onChange={ onBefore }
				placeholder="https://"
			/>
			<TextControl
				label={ __( 'Après (suffixe)', 'dynamic-metafield' ) }
				value={ after }
				onChange={ onAfter }
				placeholder="/releases.atom"
				help={
					help ||
					__(
						'Ajouté autour de la valeur du champ, ex. https:// + champ + /releases.atom',
						'dynamic-metafield'
					)
				}
			/>
		</>
	);
}

/**
 * Native RSS / Atom display options (kept available when feedURL is bound).
 *
 * @param {Object} props
 */
function RssSettingsPanel( { attributes, setAttributes } ) {
	const {
		itemsToShow = 5,
		displayAuthor = false,
		displayDate = false,
		displayExcerpt = false,
		excerptLength = 55,
		openInNewTab = false,
		blockLayout = 'list',
		columns = 2,
	} = attributes || {};

	return (
		<PanelBody
			title={ __( 'Options du flux RSS / Atom', 'dynamic-metafield' ) }
			initialOpen={ true }
		>
			<RangeControl
				label={ __( "Nombre d'éléments", 'dynamic-metafield' ) }
				value={ itemsToShow }
				onChange={ ( value ) =>
					setAttributes( { itemsToShow: value } )
				}
				min={ 1 }
				max={ 20 }
			/>
			<ToggleControl
				label={ __( "Afficher l'auteur ou l'autrice", 'dynamic-metafield' ) }
				checked={ !! displayAuthor }
				onChange={ ( value ) =>
					setAttributes( { displayAuthor: value } )
				}
			/>
			<ToggleControl
				label={ __( 'Afficher la date', 'dynamic-metafield' ) }
				checked={ !! displayDate }
				onChange={ ( value ) => setAttributes( { displayDate: value } ) }
			/>
			<ToggleControl
				label={ __( "Afficher l'extrait", 'dynamic-metafield' ) }
				checked={ !! displayExcerpt }
				onChange={ ( value ) =>
					setAttributes( { displayExcerpt: value } )
				}
			/>
			{ displayExcerpt && (
				<RangeControl
					label={ __( "Longueur de l'extrait", 'dynamic-metafield' ) }
					value={ excerptLength }
					onChange={ ( value ) =>
						setAttributes( { excerptLength: value } )
					}
					min={ 1 }
					max={ 100 }
				/>
			) }
			<ToggleControl
				label={ __(
					'Ouvrir les liens dans un nouvel onglet',
					'dynamic-metafield'
				) }
				checked={ !! openInNewTab }
				onChange={ ( value ) =>
					setAttributes( { openInNewTab: value } )
				}
			/>
			<SelectControl
				label={ __( 'Mise en page', 'dynamic-metafield' ) }
				value={ blockLayout }
				options={ [
					{
						label: __( 'Liste', 'dynamic-metafield' ),
						value: 'list',
					},
					{
						label: __( 'Grille', 'dynamic-metafield' ),
						value: 'grid',
					},
				] }
				onChange={ ( value ) =>
					setAttributes( { blockLayout: value } )
				}
			/>
			{ blockLayout === 'grid' && (
				<RangeControl
					label={ __( 'Colonnes', 'dynamic-metafield' ) }
					value={ columns }
					onChange={ ( value ) => setAttributes( { columns: value } ) }
					min={ 2 }
					max={ 6 }
				/>
			) }
		</PanelBody>
	);
}

/**
 * @param {Object} props
 */
function BindingPanel( {
	name,
	attributes,
	setAttributes,
	context: blockContext,
} ) {
	const isButton = name === 'core/button';
	const isUrlBlock =
		name === 'core/rss' ||
		name === 'core/embed' ||
		name?.startsWith( 'core-embed/' );

	const [ scfContext, setScfContext ] = useState( 'post' );
	const [ fields, setFields ] = useState( [] );
	const [ loading, setLoading ] = useState( false );
	const [ error, setError ] = useState( '' );
	const [ taxonomy, setTaxonomy ] = useState( '' );
	const [ before, setBefore ] = useState( '' );
	const [ after, setAfter ] = useState( '' );
	const [ urlBefore, setUrlBefore ] = useState( '' );
	const [ urlAfter, setUrlAfter ] = useState( '' );

	const { postId, postType } = useSelect(
		( select ) => resolveEditorEntity( select, blockContext, settings ),
		[ blockContext ]
	);

	const bindings = attributes?.metadata?.bindings || {};
	const hideIfEmpty = !!( attributes?.metadata?.dmf?.hideIfEmpty || attributes?.metadata?.daiDmf?.hideIfEmpty );

	const currentKey = useMemo( () => {
		const first = firstOurBinding( bindings );
		return first?.args?.key || '';
	}, [ bindings ] );

	const urlKey = useMemo(
		() => keyForAttribute( bindings, 'url' ),
		[ bindings ]
	);
	const textKey = useMemo(
		() => keyForAttribute( bindings, 'text' ),
		[ bindings ]
	);

	const currentContext = useMemo( () => {
		const first = firstOurBinding( bindings );
		return first?.args?.context || scfContext;
	}, [ bindings, scfContext ] );

	const hasOurBinding = useMemo(
		() =>
			Object.values( bindings ).some(
				( b ) => b?.source && isOurSource(b.source)
			),
		[ bindings ]
	);

	// Sync affix local state from existing bindings.
	useEffect( () => {
		if ( isButton ) {
			const urlBinding = bindings.url;
			if ( urlBinding?.source && isOurSource( urlBinding.source ) ) {
				setUrlBefore( urlBinding.args?.before || '' );
				setUrlAfter( urlBinding.args?.after || '' );
			}
			return;
		}
		const first = firstOurBinding( bindings );
		if ( first ) {
			setBefore( first.args?.before || '' );
			setAfter( first.args?.after || '' );
		}
	}, [ bindings, isButton ] );

	useEffect( () => {
		let cancelled = false;
		setLoading( true );
		setError( '' );
		const qs = buildFieldsQuery( {
			scfContext,
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
			.catch( ( err ) => {
				if ( ! cancelled ) {
					setFields( [] );
					setError(
						err?.message ||
							__(
								'Impossible de charger les champs SCF.',
								'dynamic-metafield'
							)
					);
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
	}, [ scfContext, postId, postType, taxonomy ] );

	const compatible = useMemo(
		() => filterFieldsForBlock( fields, name ),
		[ fields, name ]
	);
	const urlFields = useMemo(
		() => filterFieldsForButtonUrl( fields ),
		[ fields ]
	);
	const textFields = useMemo(
		() => filterFieldsForButtonText( fields ),
		[ fields ]
	);

	const clearBinding = () => {
		writeBindings( setAttributes, attributes, null, hideIfEmpty, true );
		setBefore( '' );
		setAfter( '' );
		setUrlBefore( '' );
		setUrlAfter( '' );
	};

	/**
	 * Patch before/after on existing bindings (and keep keys).
	 *
	 * @param {string} scope 'all' | 'url'
	 * @param {string} nextBefore
	 * @param {string} nextAfter
	 */
	const persistAffixes = ( scope, nextBefore, nextAfter ) => {
		const prevBindings = { ...( attributes.metadata?.bindings || {} ) };
		let changed = false;

		Object.keys( prevBindings ).forEach( ( attr ) => {
			const binding = prevBindings[ attr ];
			if ( !binding?.source || !isOurSource(binding.source) ) {
				return;
			}
			if ( scope === 'url' && attr !== 'url' && attr !== 'linkTarget' ) {
				return;
			}
			const args = { ...( binding.args || {} ) };
			if ( nextBefore ) {
				args.before = nextBefore;
			} else {
				delete args.before;
			}
			if ( nextAfter ) {
				args.after = nextAfter;
			} else {
				delete args.after;
			}
			prevBindings[ attr ] = { ...binding, args };
			changed = true;
		} );

		if ( ! changed ) {
			return;
		}

		setAttributes( {
			metadata: {
				...( attributes.metadata || {} ),
				bindings: prevBindings,
				dmf: {
					...( attributes.metadata?.dmf || {} ),
					hideIfEmpty,
				},
			},
		} );
	};

	const applyAttributeBinding = (
		attribute,
		fieldName,
		pool,
		extraAttrs = [],
		affixBefore = '',
		affixAfter = ''
	) => {
		if ( ! fieldName ) {
			const patch = { [ attribute ]: null };
			extraAttrs.forEach( ( a ) => {
				patch[ a ] = null;
			} );
			writeBindings( setAttributes, attributes, patch, hideIfEmpty );
			return;
		}
		const field = pool.find( ( f ) => f.name === fieldName );
		if ( ! field ) {
			return;
		}
		const args = bindingArgs(
			field,
			scfContext,
			taxonomy,
			affixBefore,
			affixAfter
		);
		const patch = {
			[ attribute ]: {
				source: settings.source,
				args,
			},
		};
		extraAttrs.forEach( ( a ) => {
			patch[ a ] = {
				source: settings.source,
				args,
			};
		} );
		writeBindings( setAttributes, attributes, patch, hideIfEmpty );
	};

	const applyBinding = ( fieldName ) => {
		if ( ! fieldName ) {
			clearBinding();
			return;
		}
		const field = compatible.find( ( f ) => f.name === fieldName );
		if ( ! field ) {
			return;
		}
		const attrs = attributesForBinding( name, field.type );
		if ( ! attrs.length ) {
			return;
		}

		const prevBindings = { ...( attributes.metadata?.bindings || {} ) };
		Object.keys( prevBindings ).forEach( ( attr ) => {
			if ( prevBindings[ attr ]?.source && isOurSource(prevBindings[ attr ].source) ) {
				delete prevBindings[ attr ];
			}
		} );

		const args = bindingArgs(
			field,
			scfContext,
			taxonomy,
			before,
			after
		);
		const next = {};
		attrs.forEach( ( attr ) => {
			next[ attr ] = {
				source: settings.source,
				args,
			};
		} );

		setAttributes( {
			metadata: {
				...( attributes.metadata || {} ),
				bindings: {
					...prevBindings,
					...next,
				},
				dmf: {
					...( attributes.metadata?.dmf || {} ),
					hideIfEmpty,
				},
			},
		} );
	};

	const setHideIfEmpty = ( value ) => {
		writeBindings( setAttributes, attributes, null, value, false );
	};

	return (
		<InspectorControls>
			<PanelBody
				title={ __( 'Liaison SCF', 'dynamic-metafield' ) }
				initialOpen={ true }
			>
				{ error && (
					<Notice status="error" isDismissible={ false }>
						{ error }
					</Notice>
				) }
				<SelectControl
					label={ __( 'Contexte', 'dynamic-metafield' ) }
					value={ currentContext }
					options={ CONTEXT_OPTIONS }
					onChange={ setScfContext }
				/>
				{ scfContext === 'term' && (
					<SelectControl
						label={ __( 'Taxonomie', 'dynamic-metafield' ) }
						value={ taxonomy }
						options={ [
							{
								label: __( '— Choisir —', 'dynamic-metafield' ),
								value: '',
							},
							{ label: 'category', value: 'category' },
							{ label: 'post_tag', value: 'post_tag' },
						] }
						onChange={ setTaxonomy }
					/>
				) }
				{ loading ? (
					<Spinner />
				) : isButton ? (
					<>
						<SelectControl
							label={ __( 'Lien du bouton (URL)', 'dynamic-metafield' ) }
							value={ urlKey }
							options={ toOptions( urlFields ) }
							onChange={ ( value ) =>
								applyAttributeBinding(
									'url',
									value,
									urlFields,
									[ 'linkTarget' ],
									urlBefore,
									urlAfter
								)
							}
						/>
						{ ( urlKey || urlBefore || urlAfter ) && (
							<AffixControls
								before={ urlBefore }
								after={ urlAfter }
								onBefore={ ( v ) => {
									setUrlBefore( v );
									persistAffixes( 'url', v, urlAfter );
								} }
								onAfter={ ( v ) => {
									setUrlAfter( v );
									persistAffixes( 'url', urlBefore, v );
								} }
								help={ __(
									'Ex. avant=https:// et après=/releases.atom pour un chemin GitHub.',
									'dynamic-metafield'
								) }
							/>
						) }
						<SelectControl
							label={ __( 'Libellé du bouton', 'dynamic-metafield' ) }
							value={ textKey }
							options={ toOptions( textFields ) }
							onChange={ ( value ) =>
								applyAttributeBinding( 'text', value, textFields )
							}
						/>
					</>
				) : (
					<>
						<SelectControl
							label={
								isUrlBlock
									? name === 'core/rss'
										? __( 'Champ URL du flux RSS', 'dynamic-metafield' )
										: __( 'Champ URL (embed / YouTube)', 'dynamic-metafield' )
									: __( 'Champ SCF', 'dynamic-metafield' )
							}
							value={ currentKey }
							options={ toOptions( compatible ) }
							onChange={ applyBinding }
							help={
								compatible.length
									? undefined
									: __(
											'Aucun champ compatible pour ce bloc.',
											'dynamic-metafield'
									  )
							}
						/>
						{ ( currentKey || before || after ) && (
							<AffixControls
								before={ before }
								after={ after }
								onBefore={ ( v ) => {
									setBefore( v );
									persistAffixes( 'all', v, after );
								} }
								onAfter={ ( v ) => {
									setAfter( v );
									persistAffixes( 'all', before, v );
								} }
							/>
						) }
					</>
				) }
				<ToggleControl
					label={ __( 'Masquer si vide', 'dynamic-metafield' ) }
					checked={ hideIfEmpty }
					onChange={ setHideIfEmpty }
					help={
						isButton
							? __(
									'Masque le bouton si le lien lié est vide, ou si seul le libellé est lié et vide.',
									'dynamic-metafield'
							  )
							: __(
									'N’affiche pas le bloc si la valeur du champ (avant préfixe/suffixe) est vide.',
									'dynamic-metafield'
							  )
					}
				/>
				{ hasOurBinding && (
					<Button
						variant="secondary"
						isDestructive
						onClick={ clearBinding }
					>
						{ __( 'Supprimer la liaison', 'dynamic-metafield' ) }
					</Button>
				) }
			</PanelBody>
			{ name === 'core/rss' && (
				<RssSettingsPanel
					attributes={ attributes }
					setAttributes={ setAttributes }
				/>
			) }
		</InspectorControls>
	);
}

const withBindingPanel = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		if ( ! isSupportedBlock( props.name ) ) {
			return <BlockEdit { ...props } />;
		}
		return (
			<>
				<BlockEdit { ...props } />
				<BindingPanel { ...props } />
			</>
		);
	};
}, 'withdmfBindingPanel' );

addFilter(
	'editor.BlockEdit',
	'dynamic-metafield/with-binding-panel',
	withBindingPanel
);
