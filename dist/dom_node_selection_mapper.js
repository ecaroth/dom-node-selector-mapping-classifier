/* Version 1.0.0 dom-node-selection-mapper (https://github.com/ecaroth/dom-node-selection-mapper), Authored by Evan Carothers (https://github.com/ecaroth) */

(function( module ){
	"use strict";

	var cssesc = (function() {
	//BASED OFF https://github.com/mathiasbynens/cssesc
	/* jshint ignore:start */

	/*--------------------------------------------------------------------------*/

	var object = {};
	var hasOwnProperty = object.hasOwnProperty;
	var merge = function(options, defaults) {
		if (!options) {
			return defaults;
		}
		var key;
		var result = {};
		for (key in defaults) {
			// `if (defaults.hasOwnProperty(key) { … }` is not needed here, since
			// only recognized option names are used
			result[key] = hasOwnProperty.call(options, key)
				? options[key]
				: defaults[key];
		}
		return result;
	};

	/*--------------------------------------------------------------------------*/

	var regexAnySingleEscape = /[ -,\./;-@\[-\^`\{-~]/;
	var regexSingleEscape = /[ !#-&\(-,\./;-@\[\]\^`\{-~]/;
	var regexAlwaysEscape = /['"\\]/;
	var regexExcessiveSpaces = /(^|\\+)?(\\[A-F0-9]{1,6})\x20(?![a-fA-F0-9\x20])/g;

	// https://mathiasbynens.be/notes/css-escapes#css
	var cssesc = function(string, options) {

		// Handle options
		options = merge(options, cssesc.options);
		if (options.quotes != 'single' && options.quotes != 'double') {
			options.quotes = 'single';
		}
		var quote = options.quotes == 'double' ? '"' : '\'';
		var isIdentifier = options.isIdentifier;

		var firstChar = string.charAt(0);
		var output = '';
		var counter = 0;
		var length = string.length;
		var value;
		var character;
		var codePoint;
		var extra; // used for potential low surrogates

		while (counter < length) {
			character = string.charAt(counter++);
			codePoint = character.charCodeAt();
			// if it’s not a printable ASCII character
			if (codePoint < 0x20 || codePoint > 0x7E) {
				if (codePoint >= 0xD800 && codePoint <= 0xDBFF && counter < length) {
					// high surrogate, and there is a next character
					extra = string.charCodeAt(counter++);
					if ((extra & 0xFC00) == 0xDC00) { // next character is low surrogate
						codePoint = ((codePoint & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000;
					} else {
						// unmatched surrogate; only append this code unit, in case the next
						// code unit is the high surrogate of a surrogate pair
						counter--;
					}
				}
				value = '\\' + codePoint.toString(16).toUpperCase() + ' ';
			} else {
				if (options.escapeEverything) {
					if (regexAnySingleEscape.test(character)) {
						value = '\\' + character;
					} else {
						value = '\\' + codePoint.toString(16).toUpperCase() + ' ';
					}
				// `:` can be escaped as `\:`, but that fails in IE < 8
				} else if (/[\t\n\f\r\x0B:]/.test(character)) {
					if (!isIdentifier && character == ':') {
						value = character;
					} else {
						value = '\\' + codePoint.toString(16).toUpperCase() + ' ';
					}
				} else if (
					character == '\\' ||
					(
						!isIdentifier &&
						(
							(character == '"' && quote == character) ||
							(character == '\'' && quote == character)
						)
					) ||
					(isIdentifier && regexSingleEscape.test(character))
				) {
					value = '\\' + character;
				} else {
					value = character;
				}
			}
			output += value;
		}

		if (isIdentifier) {
			if (/^_/.test(output)) {
				// Prevent IE6 from ignoring the rule altogether (in case this is for an
				// identifier used as a selector)
				output = '\\_' + output.slice(1);
			} else if (/^-[-\d]/.test(output)) {
				output = '\\-' + output.slice(1);
			} else if (/\d/.test(firstChar)) {
				output = '\\3' + firstChar + ' ' + output.slice(1);
			}
		}

		// Remove spaces after `\HEX` escapes that are not followed by a hex digit,
		// since they’re redundant. Note that this is only possible if the escape
		// sequence isn’t preceded by an odd number of backslashes.
		output = output.replace(regexExcessiveSpaces, function($0, $1, $2) {
			if ($1 && $1.length % 2) {
				// it’s not safe to remove the space, so don’t
				return $0;
			}
			// strip the space
			return ($1 || '') + $2;
		});

		if (!isIdentifier && options.wrap) {
			return quote + output + quote;
		}
		return output;
	};

	// Expose default options (so they can be overridden globally)
	cssesc.options = {
		'escapeEverything': false,
		'isIdentifier': false,
		'quotes': 'single',
		'wrap': false
	};

	cssesc.version = '0.1.0';

	/*--------------------------------------------------------------------------*/

	return cssesc;
	/* jshint ignore:end */
})();


	var tools = {
		css_selector_escape: function( val, as_identifier ){
			return cssesc( val, {
			  'isIdentifier': as_identifier,
			  'quotes': 'double'
			});
		},
		build_selector_str: function( chain, loose_match ){
	//build a selector string based on chained result data

	function _sel_from_stack( parts ){
		return parts.slice().reverse().join(" ").replace(/\\/g, "\\");
	}

	function _test_for_child_collision( parts, c_data, node ){

		var match_sel = _sel_from_stack( parts );

		var el_matches =  Array.from( node.parentNode.querySelectorAll( match_sel ) );
		if( el_matches.length === 1 ) return false; //no nth-child needed

		//check siblings of type to find the nth-of-type match for this element
		var siblings = node.parentNode.children,
			node_type_iter = 0,
			match_ind = false;
		for(var i=0; i<siblings.length; i++){
			var _node = siblings[i];
			if(_node.tagName !== node.tagName) continue;
			node_type_iter++;
			if(_node===node){
				match_ind = node_type_iter;
				break;
			}
		}
		return match_ind;
	}

	function _test_for_uniqueness_with_node_type( parts ){
		var match_sel = _sel_from_stack( parts );
		var el_matches = Array.from( document.querySelectorAll( match_sel ) );
		return el_matches.length === 1;
	}

	function _build_selector_from_chain( chain, check_for_node_collission ){
		var parts = [],
			used_last = false,
			last_was_node_match = false;			

		for(var i=0, len=chain.length; i<len; i++){
			var c = chain[i],
				sel = "";

			var this_used_node_match = false;

			sel += c.node.tagName;
			//then comes any attribute selectors
			c.matches.forEach(function(match){
				var comparator = loose_match ? '*=' : (match[0]==='class' ? '~=' : '=');
				//creates attribute based selector w/ case insensitive matching
				sel += '[' + match[0] + comparator + '"' + tools.css_selector_escape(match[1],false) + '"]';
				
			});

			//if we are doing a loose match and there are no matches, see if we can use the nodeType from the node 
			//to see if the element is uniquely identified on the page. If so, stop building the selection chain
			if(check_for_node_collission){

				if(loose_match && c.matches.length===0){
					//check to see if direct parent match will satisfy for loose match
					if(used_last){
						var temp_node_sel = sel + ' >';
						if( _test_for_uniqueness_with_node_type( parts.concat([temp_node_sel]) ) ){
							//was unique with general parent match, should be good for loose match
							parts.push( temp_node_sel );
							break;
						}
					}
					//check to see if general (non-parent match) will satisfy for loose match
					if( _test_for_uniqueness_with_node_type( parts.concat([sel]) ) ){
						//was unique with specific parent match, should be good for loose match
						parts.push( sel );
						break;
					}
				}

				//now, check against nth-child collision

				var temp_sel = sel;
				if(used_last) temp_sel += ' >'; //temporary sel for testing
				var nth_child = _test_for_child_collision( parts.concat([temp_sel]), c, c.node );
				if(nth_child){
					sel += ':nth-of-type('+nth_child+')';
					this_used_node_match = true;
				}
			}

			if(c.matches.length===0 && i!==0 && !last_was_node_match && !this_used_node_match){
				used_last = false;
				continue;
			}

			last_was_node_match = this_used_node_match;

			//check for immediate child match
			if(used_last) sel += ' >';

			used_last = true;

			parts.push( sel );
		}
		return _sel_from_stack(parts);
	}

	return _build_selector_from_chain(chain, true);
}
	};

	//define confidence levels
	var CONFIDENCE = {
			'low': 	1,
			'med': 	2,
			'high': 3
		},
		NodeMatcher = function( matches, loose_match ){
	//takes in a set of possible classifier matches, a (bool) perform loose match, and returns an object that exposes 1 function 
	//named 'input'. Input takes in a DOM node (which is current node in parent traversal), classifies, and returs
	//a data object in the format:
	//{ node: (DOM Node) node from input,
	//  matches: (array) of attribute matches in the format [attr,match_value],
	//  confidence: (int) confidence value from CONFIDENCE, indicating how confident we are in the match }


	if( typeof matches === 'string' ) matches = [matches]; //cast to array if string match is passed in
	matches = matches.map(function(v){ return v.toLowerCase(); }); //convert to lowercase for matching

	//attribute confidence for match - high confidence means start of selector string
	var ATTR_CONFIDENCE = {
		'id': 			CONFIDENCE.high,
		'name': 		CONFIDENCE.high,
		'class': 		CONFIDENCE.med,
		'value': 		CONFIDENCE.med,
		'title': 		CONFIDENCE.low,
		'placeholder': 	CONFIDENCE.low
	};

	function _input( node ){
		//main function to pass input node to for matching
		_LOG("---Matcher iteration node",node);

		var attr_matches = [],
			confidence = 0;

		for(var attr in ATTR_CONFIDENCE){
			//iterate through each possible attribute for classifier matching and see if there is a match

			var attr_val = node.getAttribute(attr);
			if(!attr_val) continue; //no matching attribute on the node

			var check_vals = [attr_val.trim()];

			//we have to split class names by spaces, but everything else is a straight match against atribute value
			if(attr==='class'){
				check_vals = check_vals[0].replace(/  +/g, ' ').split(/\s+/g);
			}

			_LOG("Matcher check vals",check_vals);

			check_vals.forEach(function(check){
				matches.forEach(function(match){
					//see if check matches for this attribute check value and determine current confidence
					var ind = check.toLowerCase().indexOf(match);
					if( ind !== -1 ){
						var css_attr_val = check;
						if(loose_match){
							//fix case for loose match - if check val was 'City_1', but check was 'city',
							//set the match value to be 'City' (preserving case and allowing loose match)
							css_attr_val = check.substr(ind, match.length ); 
						}
						attr_matches.push( [attr, css_attr_val] );
						confidence = Math.max( confidence, ATTR_CONFIDENCE[attr] );
					}
				});
			});

			_LOG("Attribute selector matches",attr_matches);

			//filter attr_matches to only include highest confidence attributes for brevity
			for( var i=attr_matches.length-1; i>=0; i-- ){
				if( ATTR_CONFIDENCE[attr_matches[i][0]] < confidence ){
					attr_matches.splice( i, 1 );
				}
			}
			_LOG("Attr selectors after stripping for confidence",attr_matches);
		}

		return {
			node: node,
			confidence: confidence,
			matches: attr_matches
		};

	}

	//expose input function
	return{
		input: _input
	};
}; //instantiated in _matcher.js

	//define main object w/ available globally accessible params/functions
	var main = {
		debug: false,					//can be set directly to true/false
		mapNode: function( match_node, classifier_matches, loose_match, parent_node ){
	//function to handle node mapping (returns selector string or false if invalid / unable to map)
	//match_node = DOM node to map
	//classifier_matches = string or array of strings that can be used for classification/mapping
	//loose_match = do we want to perform a loose or an exact match?
	
	if(!match_node || !classifier_matches) return false;

	//if parent_node is not supplied, or if global window is supplied, select body
	if(!parent_node || parent_node.self===parent_node) parent_node = document.body;

	if( ["#document","HTML"].indexOf(parent_node.nodeName) !== -1 || parent_node.self===parent_node){
		//passed in document or HTML as parentNode - select body element
		parent_node = parent_node.querySelector('body')[0];
	}

	//see if an iframe window was passed in as the parent, and if so try and select the document content
	if( parent_node.nodeName === 'IFRAME' ){
		var iframe_doc = (parent_node.contentWindow || parent_node.contentDocument);
		if (iframe_doc.document) iframe_doc = iframe_doc.document;
		parent_node = iframe_doc.querySelector('body');
	}

	_LOG("Parent node:", parent_node);
	_LOG("Mapping node:", match_node);
	_LOG("With classifiers:", classifier_matches);
	var matcher = NodeMatcher( classifier_matches, loose_match ); //create matcher object with classifiers

	//iterate over current node and parents until we can build a selector with a relative high confidence
	var node = match_node,		//current node to match while traversing
		selector_chain = [],	//chain of selector data as it's pulled from matcher during parent traversal
		confident = false;		//boolean has matcher returned a high confidence match yet that would allow us from stopping traversal?
	
	while( !confident ){
		if( node===parent_node ) break;
		
		var c_data = matcher.input( node ); //get current node info from matcher
		selector_chain.push( c_data );

		//if we have reached a high level of confidence from matcher, stop matching if we're doing a loose match
		//else keep going for exact match since we don't want to match multiple so continue traversal
		if( selector_chain[ selector_chain.length-1 ].confidence===CONFIDENCE.high && !loose_match ) break;

		node = node.parentNode;
	}

	_LOG("Final selector chain:",selector_chain);

	var selector_str = tools.build_selector_str( selector_chain, loose_match );

	_LOG("Final selector string:",selector_str);

	return selector_str;

} 			//main mapping function
	};
	
	//logging function (used when main.debug===true)
	function _LOG( str, val ){
		if(!main.debug) return;
		console.log("DOM-SEL>> "+str,val);
	}

	module.DOMNodeSelectionMapper = main;

})( (typeof exports !== 'undefined') ? exports : window );