var diffDOM = (function() {
	function objToNode(objNode, insideSvg, options) {
		var node;
		if (objNode.nodeName === '#text') {
			node = options.document.createTextNode(objNode.data);

		} else if (objNode.nodeName === '#comment') {
			node = options.document.createComment(objNode.data);
		} else {
			if (insideSvg) {
				node = options.document.createElementNS('http://www.w3.org/2000/svg', objNode.nodeName);
			} else if (objNode.nodeName.toLowerCase() === 'svg') {
				node = options.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				insideSvg = true;
			} else {
				node = options.document.createElement(objNode.nodeName);
			}
			if (objNode.attributes) {
				Object.entries(objNode.attributes).forEach(function (ref) {
					var key = ref[0];
					var value = ref[1];

					return node.setAttribute(key, value);
				});
			}
			if (objNode.childNodes) {
				objNode.childNodes.forEach(function (childNode) { return node.appendChild(objToNode(childNode, insideSvg, options)); });
			}
			if (options.valueDiffing) {
				if (objNode.value) {
					node.value = objNode.value;
				}
				if (objNode.checked) {
					node.checked = objNode.checked;
				}
				if (objNode.selected) {
					node.selected = objNode.selected;
				}
			}
		}
		return node
	}

// ===== Apply a diff =====

	function getFromRoute(node, route) {
		route = route.slice();
		while (route.length > 0) {
			if (!node.childNodes) {
				return false
			}
			var c = route.splice(0, 1)[0];
			node = node.childNodes[c];
		}
		return node
	}

	function applyDiff(
		tree,
		diff,
		options // {preDiffApply, postDiffApply, textDiff, valueDiffing, _const}
	) {
		var node = getFromRoute(tree, diff[options._const.route]);
		var newNode;
		var reference;
		var route;
		var nodeArray;
		var c;

		// pre-diff hook
		var info = {
			diff: diff,
			node: node
		};

		if (options.preDiffApply(info)) {
			return true
		}

		switch (diff[options._const.action]) {
			case options._const.addAttribute:
				if (!node || !node.setAttribute) {
					return false
				}
				node.setAttribute(diff[options._const.name], diff[options._const.value]);
				break
			case options._const.modifyAttribute:
				if (!node || !node.setAttribute) {
					return false
				}
				node.setAttribute(diff[options._const.name], diff[options._const.newValue]);
				if (node.nodeName === 'INPUT' && diff[options._const.name] === 'value') {
					node.value = diff[options._const.newValue];
				}
				break
			case options._const.removeAttribute:
				if (!node || !node.removeAttribute) {
					return false
				}
				node.removeAttribute(diff[options._const.name]);
				break
			case options._const.modifyTextElement:
				if (!node || node.nodeType !== 3) {
					return false
				}
				options.textDiff(node, node.data, diff[options._const.oldValue], diff[options._const.newValue]);
				break
			case options._const.modifyValue:
				if (!node || typeof node.value === 'undefined') {
					return false
				}
				node.value = diff[options._const.newValue];
				break
			case options._const.modifyComment:
				if (!node || typeof node.data === 'undefined') {
					return false
				}
				options.textDiff(node, node.data, diff[options._const.oldValue], diff[options._const.newValue]);
				break
			case options._const.modifyChecked:
				if (!node || typeof node.checked === 'undefined') {
					return false
				}
				node.checked = diff[options._const.newValue];
				break
			case options._const.modifySelected:
				if (!node || typeof node.selected === 'undefined') {
					return false
				}
				node.selected = diff[options._const.newValue];
				break
			case options._const.replaceElement:
				node.parentNode.replaceChild(
					objToNode(
						diff[options._const.newValue],
						node.namespaceURI === 'http://www.w3.org/2000/svg',
						options
					),
					node
				);
				break
			case options._const.relocateGroup:
				nodeArray = Array.apply(void 0, new Array(diff.groupLength)).map(function () { return node.removeChild(node.childNodes[diff[options._const.from]]); });
				nodeArray.forEach(function (childNode, index) {
					if (index === 0) {
						reference = node.childNodes[diff[options._const.to]];
					}
					node.insertBefore(childNode, reference || null);
				});
				break
			case options._const.removeElement:
				node.parentNode.removeChild(node);
				break
			case options._const.addElement:
				route = diff[options._const.route].slice();
				c = route.splice(route.length - 1, 1)[0];
				node = getFromRoute(tree, route);
				node.insertBefore(
					objToNode(
						diff[options._const.element],
						node.namespaceURI === 'http://www.w3.org/2000/svg',
						options
					),
					node.childNodes[c] || null
				);
				break
			case options._const.removeTextElement:
				if (!node || node.nodeType !== 3) {
					return false
				}
				node.parentNode.removeChild(node);
				break
			case options._const.addTextElement:
				route = diff[options._const.route].slice();
				c = route.splice(route.length - 1, 1)[0];
				newNode = options.document.createTextNode(diff[options._const.value]);
				node = getFromRoute(tree, route);
				if (!node || !node.childNodes) {
					return false
				}
				node.insertBefore(newNode, node.childNodes[c] || null);
				break
			default:
				console.log('unknown action');
		}

		// if a new node was created, we might be interested in its
		// post diff hook
		info.newNode = newNode;
		options.postDiffApply(info);

		return true
	}

	function applyDOM(tree, diffs, options) {
		return diffs.every(function (diff) { return applyDiff(tree, diff, options); })
	}

// ===== Undo a diff =====

	function swap(obj, p1, p2) {
		var tmp = obj[p1];
		obj[p1] = obj[p2];
		obj[p2] = tmp;
	}

	function undoDiff(
		tree,
		diff,
		options // {preDiffApply, postDiffApply, textDiff, valueDiffing, _const}
	) {

		switch (diff[options._const.action]) {
			case options._const.addAttribute:
				diff[options._const.action] = options._const.removeAttribute;
				applyDiff(tree, diff, options);
				break
			case options._const.modifyAttribute:
				swap(diff, options._const.oldValue, options._const.newValue);
				applyDiff(tree, diff, options);
				break
			case options._const.removeAttribute:
				diff[options._const.action] = options._const.addAttribute;
				applyDiff(tree, diff, options);
				break
			case options._const.modifyTextElement:
				swap(diff, options._const.oldValue, options._const.newValue);
				applyDiff(tree, diff, options);
				break
			case options._const.modifyValue:
				swap(diff, options._const.oldValue, options._const.newValue);
				applyDiff(tree, diff, options);
				break
			case options._const.modifyComment:
				swap(diff, options._const.oldValue, options._const.newValue);
				applyDiff(tree, diff, options);
				break
			case options._const.modifyChecked:
				swap(diff, options._const.oldValue, options._const.newValue);
				applyDiff(tree, diff, options);
				break
			case options._const.modifySelected:
				swap(diff, options._const.oldValue, options._const.newValue);
				applyDiff(tree, diff, options);
				break
			case options._const.replaceElement:
				swap(diff, options._const.oldValue, options._const.newValue);
				applyDiff(tree, diff, options);
				break
			case options._const.relocateGroup:
				swap(diff, options._const.from, options._const.to);
				applyDiff(tree, diff, options);
				break
			case options._const.removeElement:
				diff[options._const.action] = options._const.addElement;
				applyDiff(tree, diff, options);
				break
			case options._const.addElement:
				diff[options._const.action] = options._const.removeElement;
				applyDiff(tree, diff, options);
				break
			case options._const.removeTextElement:
				diff[options._const.action] = options._const.addTextElement;
				applyDiff(tree, diff, options);
				break
			case options._const.addTextElement:
				diff[options._const.action] = options._const.removeTextElement;
				applyDiff(tree, diff, options);
				break
			default:
				console.log('unknown action');
		}

	}

	function undoDOM(tree, diffs, options) {
		if (!diffs.length) {
			diffs = [diffs];
		}
		diffs = diffs.slice();
		diffs.reverse();
		diffs.forEach(function (diff) {
			undoDiff(tree, diff, options);
		});
	}

	var Diff = function Diff(options) {
		var this$1 = this;
		if ( options === void 0 ) options = {};

		Object.entries(options).forEach(function (ref) {
			var key = ref[0];
			var value = ref[1];

			return this$1[key] = value;
		});
	};

	Diff.prototype.toString = function toString () {
		return JSON.stringify(this)
	};

	Diff.prototype.setValue = function setValue (aKey, aValue) {
		this[aKey] = aValue;
		return this
	};

	function elementDescriptors(el) {
		var output = [];
		output.push(el.nodeName);
		if (el.nodeName !== '#text' && el.nodeName !== '#comment') {
			if (el.attributes) {
				if (el.attributes['class']) {
					output.push(((el.nodeName) + "." + (el.attributes['class'].replace(/ /g, '.'))));
				}
				if (el.attributes.id) {
					output.push(((el.nodeName) + "#" + (el.attributes.id)));
				}
			}

		}
		return output
	}

	function findUniqueDescriptors(li) {
		var uniqueDescriptors = {};
		var duplicateDescriptors = {};

		li.forEach(function (node) {
			elementDescriptors(node).forEach(function (descriptor) {
				var inUnique = descriptor in uniqueDescriptors;
				var inDupes = descriptor in duplicateDescriptors;
				if (!inUnique && !inDupes) {
					uniqueDescriptors[descriptor] = true;
				} else if (inUnique) {
					delete uniqueDescriptors[descriptor];
					duplicateDescriptors[descriptor] = true;
				}
			});
		});

		return uniqueDescriptors
	}

	function uniqueInBoth(l1, l2) {
		var l1Unique = findUniqueDescriptors(l1);
		var l2Unique = findUniqueDescriptors(l2);
		var inBoth = {};

		Object.keys(l1Unique).forEach(function (key) {
			if (l2Unique[key]) {
				inBoth[key] = true;
			}
		});

		return inBoth
	}

	function removeDone(tree) {
		delete tree.outerDone;
		delete tree.innerDone;
		delete tree.valueDone;
		if (tree.childNodes) {
			return tree.childNodes.every(removeDone)
		} else {
			return true
		}
	}

	function isEqual(e1, e2) {
		if (!['nodeName', 'value', 'checked', 'selected', 'data'].every(function (element) {
			if (e1[element] !== e2[element]) {
				return false
			}
			return true
		})) {
			return false
		}

		if (Boolean(e1.attributes) !== Boolean(e2.attributes)) {
			return false
		}

		if (Boolean(e1.childNodes) !== Boolean(e2.childNodes)) {
			return false
		}
		if (e1.attributes) {
			var e1Attributes = Object.keys(e1.attributes);
			var e2Attributes = Object.keys(e2.attributes);

			if (e1Attributes.length !== e2Attributes.length) {
				return false
			}
			if (!e1Attributes.every(function (attribute) {
				if (e1.attributes[attribute] !== e2.attributes[attribute]) {
					return false
				}
				return true
			})) {
				return false
			}
		}
		if (e1.childNodes) {
			if (e1.childNodes.length !== e2.childNodes.length) {
				return false
			}
			if (!e1.childNodes.every(function (childNode, index) { return isEqual(childNode, e2.childNodes[index]); })) {

				return false
			}

		}

		return true
	}


	function roughlyEqual(e1, e2, uniqueDescriptors, sameSiblings, preventRecursion) {

		if (!e1 || !e2) {
			return false
		}

		if (e1.nodeName !== e2.nodeName) {
			return false
		}

		if (e1.nodeName === '#text') {
			// Note that we initially don't care what the text content of a node is,
			// the mere fact that it's the same tag and "has text" means it's roughly
			// equal, and then we can find out the true text difference later.
			return preventRecursion ? true : e1.data === e2.data
		}


		if (e1.nodeName in uniqueDescriptors) {
			return true
		}

		if (e1.attributes && e2.attributes) {

			if (e1.attributes.id) {
				if (e1.attributes.id !== e2.attributes.id) {
					return false
				} else {
					var idDescriptor = (e1.nodeName) + "#" + (e1.attributes.id);
					if (idDescriptor in uniqueDescriptors) {
						return true
					}
				}
			}
			if (e1.attributes['class'] && e1.attributes['class'] === e2.attributes['class']) {
				var classDescriptor = (e1.nodeName) + "." + (e1.attributes['class'].replace(/ /g, '.'));
				if (classDescriptor in uniqueDescriptors) {
					return true
				}
			}
		}

		if (sameSiblings) {
			return true
		}

		var nodeList1 = e1.childNodes ? e1.childNodes.slice().reverse() : [];
		var nodeList2 = e2.childNodes ? e2.childNodes.slice().reverse() : [];

		if (nodeList1.length !== nodeList2.length) {
			return false
		}

		if (preventRecursion) {
			return nodeList1.every(function (element, index) { return element.nodeName === nodeList2[index].nodeName; })
		} else {
			// note: we only allow one level of recursion at any depth. If 'preventRecursion'
			// was not set, we must explicitly force it to true for child iterations.
			var childUniqueDescriptors = uniqueInBoth(nodeList1, nodeList2);
			return nodeList1.every(function (element, index) { return roughlyEqual(element, nodeList2[index], childUniqueDescriptors, true, true); })
		}
	}


	function cloneObj(obj) { //  TODO: Do we really need to clone here? Is it not enough to just return the original object?
		return JSON.parse(JSON.stringify(obj))
	}
	/**
	 * based on https://en.wikibooks.org/wiki/Algorithm_implementation/Strings/Longest_common_substring#JavaScript
	 */
	function findCommonSubsets(c1, c2, marked1, marked2) {
		var lcsSize = 0;
		var index = [];
		var c1Length = c1.length;
		var c2Length = c2.length;

		var // set up the matching table
			matches = Array.apply(void 0, new Array(c1Length + 1)).map(function () { return []; });

		var uniqueDescriptors = uniqueInBoth(c1, c2);

		var // If all of the elements are the same tag, id and class, then we can
			// consider them roughly the same even if they have a different number of
			// children. This will reduce removing and re-adding similar elements.
			subsetsSame = c1Length === c2Length;

		if (subsetsSame) {

			c1.some(function (element, i) {
				var c1Desc = elementDescriptors(element);
				var c2Desc = elementDescriptors(c2[i]);
				if (c1Desc.length !== c2Desc.length) {
					subsetsSame = false;
					return true
				}
				c1Desc.some(function (description, i) {
					if (description !== c2Desc[i]) {
						subsetsSame = false;
						return true
					}
				});
				if (!subsetsSame) {
					return true
				}
			});
		}

		// fill the matches with distance values
		for (var c1Index = 0; c1Index < c1Length; c1Index++) {
			var c1Element = c1[c1Index];
			for (var c2Index = 0; c2Index < c2Length; c2Index++) {
				var c2Element = c2[c2Index];
				if (!marked1[c1Index] && !marked2[c2Index] && roughlyEqual(c1Element, c2Element, uniqueDescriptors, subsetsSame)) {
					matches[c1Index + 1][c2Index + 1] = (matches[c1Index][c2Index] ? matches[c1Index][c2Index] + 1 : 1);
					if (matches[c1Index + 1][c2Index + 1] >= lcsSize) {
						lcsSize = matches[c1Index + 1][c2Index + 1];
						index = [c1Index + 1, c2Index + 1];
					}
				} else {
					matches[c1Index + 1][c2Index + 1] = 0;
				}
			}
		}

		if (lcsSize === 0) {
			return false
		}

		return {
			oldValue: index[0] - lcsSize,
			newValue: index[1] - lcsSize,
			length: lcsSize
		}
	}

	/**
	 * This should really be a predefined function in Array...
	 */
	function makeArray(n, v) {
		return Array.apply(void 0, new Array(n)).map(function () { return v; })
	}

	/**
	 * Generate arrays that indicate which node belongs to which subset,
	 * or whether it's actually an orphan node, existing in only one
	 * of the two trees, rather than somewhere in both.
	 *
	 * So if t1 = <img><canvas><br>, t2 = <canvas><br><img>.
	 * The longest subset is "<canvas><br>" (length 2), so it will group 0.
	 * The second longest is "<img>" (length 1), so it will be group 1.
	 * gaps1 will therefore be [1,0,0] and gaps2 [0,0,1].
	 *
	 * If an element is not part of any group, it will stay being 'true', which
	 * is the initial value. For example:
	 * t1 = <img><p></p><br><canvas>, t2 = <b></b><br><canvas><img>
	 *
	 * The "<p></p>" and "<b></b>" do only show up in one of the two and will
	 * therefore be marked by "true". The remaining parts are parts of the
	 * groups 0 and 1:
	 * gaps1 = [1, true, 0, 0], gaps2 = [true, 0, 0, 1]
	 *
	 */
	function getGapInformation(t1, t2, stable) {
		var gaps1 = t1.childNodes ? makeArray(t1.childNodes.length, true) : [];
		var gaps2 = t2.childNodes ? makeArray(t2.childNodes.length, true) : [];
		var group = 0;

		// give elements from the same subset the same group number
		stable.forEach(function (subset) {
			var endOld = subset.oldValue + subset.length;
			var endNew = subset.newValue + subset.length;

			for (var j = subset.oldValue; j < endOld; j += 1) {
				gaps1[j] = group;
			}
			for (var j$1 = subset.newValue; j$1 < endNew; j$1 += 1) {
				gaps2[j$1] = group;
			}
			group += 1;
		});

		return {
			gaps1: gaps1,
			gaps2: gaps2
		}
	}

	/**
	 * Find all matching subsets, based on immediate child differences only.
	 */
	function markSubTrees(oldTree, newTree) {
		// note: the child lists are views, and so update as we update old/newTree
		var oldChildren = oldTree.childNodes ? oldTree.childNodes : [];

		var newChildren = newTree.childNodes ? newTree.childNodes : [];
		var marked1 = makeArray(oldChildren.length, false);
		var marked2 = makeArray(newChildren.length, false);
		var subsets = [];
		var subset = true;

		var returnIndex = function() {
			return arguments[1]
		};

		var markBoth = function (i) {
			marked1[subset.oldValue + i] = true;
			marked2[subset.newValue + i] = true;
		};

		while (subset) {
			subset = findCommonSubsets(oldChildren, newChildren, marked1, marked2);
			if (subset) {
				subsets.push(subset);
				var subsetArray = Array.apply(void 0, new Array(subset.length)).map(returnIndex);
				subsetArray.forEach(function (item) { return markBoth(item); });
			}
		}

		oldTree.subsets = subsets;
		oldTree.subsetsAge = 100;
		return subsets
	}

	var DiffTracker = function DiffTracker() {
		this.list = [];
	};

	DiffTracker.prototype.add = function add (diffs) {
		var ref;

		(ref = this.list).push.apply(ref, diffs);
	};
	DiffTracker.prototype.forEach = function forEach (fn) {
		this.list.forEach(function (li) { return fn(li); });
	};

// ===== Apply a virtual diff =====

	function getFromVirtualRoute(tree, route) {
		var node = tree;
		var parentNode;
		var nodeIndex;

		route = route.slice();
		while (route.length > 0) {
			if (!node.childNodes) {
				return false
			}
			nodeIndex = route.splice(0, 1)[0];
			parentNode = node;
			node = node.childNodes[nodeIndex];
		}
		return {
			node: node,
			parentNode: parentNode,
			nodeIndex: nodeIndex
		}
	}

	function applyVirtualDiff(
		tree,
		diff,
		options // {preVirtualDiffApply, postVirtualDiffApply, _const}
	) {
		var routeInfo = getFromVirtualRoute(tree, diff[options._const.route]);
		var node = routeInfo.node;
		var parentNode = routeInfo.parentNode;
		var nodeIndex = routeInfo.nodeIndex;
		var newSubsets = [];

		// pre-diff hook
		var info = {
			diff: diff,
			node: node
		};

		if (options.preVirtualDiffApply(info)) {
			return true
		}

		var newNode;
		var nodeArray;
		var route;
		var c;
		switch (diff[options._const.action]) {
			case options._const.addAttribute:
				if (!node.attributes) {
					node.attributes = {};
				}

				node.attributes[diff[options._const.name]] = diff[options._const.value];

				if (diff[options._const.name] === 'checked') {
					node.checked = true;
				} else if (diff[options._const.name] === 'selected') {
					node.selected = true;
				} else if (node.nodeName === 'INPUT' && diff[options._const.name] === 'value') {
					node.value = diff[options._const.value];
				}

				break
			case options._const.modifyAttribute:
				node.attributes[diff[options._const.name]] = diff[options._const.newValue];
				break
			case options._const.removeAttribute:

				delete node.attributes[diff[options._const.name]];

				if (Object.keys(node.attributes).length === 0) {
					delete node.attributes;
				}

				if (diff[options._const.name] === 'checked') {
					node.checked = false;
				} else if (diff[options._const.name] === 'selected') {
					delete node.selected;
				} else if (node.nodeName === 'INPUT' && diff[options._const.name] === 'value') {
					delete node.value;
				}

				break
			case options._const.modifyTextElement:
				node.data = diff[options._const.newValue];
				break
			case options._const.modifyValue:
				node.value = diff[options._const.newValue];
				break
			case options._const.modifyComment:
				node.data = diff[options._const.newValue];
				break
			case options._const.modifyChecked:
				node.checked = diff[options._const.newValue];
				break
			case options._const.modifySelected:
				node.selected = diff[options._const.newValue];
				break
			case options._const.replaceElement:
				newNode = cloneObj(diff[options._const.newValue]);
				newNode.outerDone = true;
				newNode.innerDone = true;
				newNode.valueDone = true;
				parentNode.childNodes[nodeIndex] = newNode;
				break
			case options._const.relocateGroup:
				nodeArray = node.childNodes.splice(diff[options._const.from], diff.groupLength).reverse();
				nodeArray.forEach(function (movedNode) { return node.childNodes.splice(diff[options._const.to], 0, movedNode); });
				if (node.subsets) {
					node.subsets.forEach(function (map) {
						if (diff[options._const.from] < diff[options._const.to] && map.oldValue <= diff[options._const.to] && map.oldValue > diff[options._const.from]) {
							map.oldValue -= diff.groupLength;
							var splitLength = map.oldValue + map.length - diff[options._const.to];
							if (splitLength > 0) {
								// new insertion splits map.
								newSubsets.push({
									oldValue: diff[options._const.to] + diff.groupLength,
									newValue: map.newValue + map.length - splitLength,
									length: splitLength
								});
								map.length -= splitLength;
							}
						} else if (diff[options._const.from] > diff[options._const.to] && map.oldValue > diff[options._const.to] && map.oldValue < diff[options._const.from]) {
							map.oldValue += diff.groupLength;
							var splitLength$1 = map.oldValue + map.length - diff[options._const.to];
							if (splitLength$1 > 0) {
								// new insertion splits map.
								newSubsets.push({
									oldValue: diff[options._const.to] + diff.groupLength,
									newValue: map.newValue + map.length - splitLength$1,
									length: splitLength$1
								});
								map.length -= splitLength$1;
							}
						} else if (map.oldValue === diff[options._const.from]) {
							map.oldValue = diff[options._const.to];
						}
					});
				}

				break
			case options._const.removeElement:
				parentNode.childNodes.splice(nodeIndex, 1);
				if (parentNode.subsets) {
					parentNode.subsets.forEach(function (map) {
						if (map.oldValue > nodeIndex) {
							map.oldValue -= 1;
						} else if (map.oldValue === nodeIndex) {
							map.delete = true;
						} else if (map.oldValue < nodeIndex && (map.oldValue + map.length) > nodeIndex) {
							if (map.oldValue + map.length - 1 === nodeIndex) {
								map.length--;
							} else {
								newSubsets.push({
									newValue: map.newValue + nodeIndex - map.oldValue,
									oldValue: nodeIndex,
									length: map.length - nodeIndex + map.oldValue - 1
								});
								map.length = nodeIndex - map.oldValue;
							}
						}
					});
				}
				node = parentNode;
				break
			case options._const.addElement:
				route = diff[options._const.route].slice();
				c = route.splice(route.length - 1, 1)[0];
				node = getFromVirtualRoute(tree, route).node;
				newNode = cloneObj(diff[options._const.element]);
				newNode.outerDone = true;
				newNode.innerDone = true;
				newNode.valueDone = true;

				if (!node.childNodes) {
					node.childNodes = [];
				}

				if (c >= node.childNodes.length) {
					node.childNodes.push(newNode);
				} else {
					node.childNodes.splice(c, 0, newNode);
				}
				if (node.subsets) {
					node.subsets.forEach(function (map) {
						if (map.oldValue >= c) {
							map.oldValue += 1;
						} else if (map.oldValue < c && (map.oldValue + map.length) > c) {
							var splitLength = map.oldValue + map.length - c;
							newSubsets.push({
								newValue: map.newValue + map.length - splitLength,
								oldValue: c + 1,
								length: splitLength
							});
							map.length -= splitLength;
						}
					});
				}
				break
			case options._const.removeTextElement:
				parentNode.childNodes.splice(nodeIndex, 1);
				if (parentNode.nodeName === 'TEXTAREA') {
					delete parentNode.value;
				}
				if (parentNode.subsets) {
					parentNode.subsets.forEach(function (map) {
						if (map.oldValue > nodeIndex) {
							map.oldValue -= 1;
						} else if (map.oldValue === nodeIndex) {
							map.delete = true;
						} else if (map.oldValue < nodeIndex && (map.oldValue + map.length) > nodeIndex) {
							if (map.oldValue + map.length - 1 === nodeIndex) {
								map.length--;
							} else {
								newSubsets.push({
									newValue: map.newValue + nodeIndex - map.oldValue,
									oldValue: nodeIndex,
									length: map.length - nodeIndex + map.oldValue - 1
								});
								map.length = nodeIndex - map.oldValue;
							}
						}
					});
				}
				node = parentNode;
				break
			case options._const.addTextElement:
				route = diff[options._const.route].slice();
				c = route.splice(route.length - 1, 1)[0];
				newNode = {};
				newNode.nodeName = '#text';
				newNode.data = diff[options._const.value];
				node = getFromVirtualRoute(tree, route).node;
				if (!node.childNodes) {
					node.childNodes = [];
				}

				if (c >= node.childNodes.length) {
					node.childNodes.push(newNode);
				} else {
					node.childNodes.splice(c, 0, newNode);
				}
				if (node.nodeName === 'TEXTAREA') {
					node.value = diff[options._const.newValue];
				}
				if (node.subsets) {
					node.subsets.forEach(function (map) {
						if (map.oldValue >= c) {
							map.oldValue += 1;
						}
						if (map.oldValue < c && (map.oldValue + map.length) > c) {
							var splitLength = map.oldValue + map.length - c;
							newSubsets.push({
								newValue: map.newValue + map.length - splitLength,
								oldValue: c + 1,
								length: splitLength
							});
							map.length -= splitLength;
						}
					});
				}
				break
			default:
				console.log('unknown action');
		}

		if (node.subsets) {
			node.subsets = node.subsets.filter(function (map) { return !map.delete && map.oldValue !== map.newValue; });
			if (newSubsets.length) {
				node.subsets = node.subsets.concat(newSubsets);
			}
		}

		// capture newNode for the callback
		info.newNode = newNode;
		options.postVirtualDiffApply(info);

		return
	}

	function applyVirtual(tree, diffs, options) {
		diffs.forEach(function (diff) {
			applyVirtualDiff(tree, diff, options);
		});
		return true
	}

	function nodeToObj(aNode, options) {
		if ( options === void 0 ) options = {};

		var objNode = {};
		objNode.nodeName = aNode.nodeName;
		if (objNode.nodeName === '#text' || objNode.nodeName === '#comment') {
			objNode.data = aNode.data;
		} else {
			if (aNode.attributes && aNode.attributes.length > 0) {
				objNode.attributes = {};
				var nodeArray = Array.prototype.slice.call(aNode.attributes);
				nodeArray.forEach(function (attribute) { return objNode.attributes[attribute.name] = attribute.value; });
			}
			if (objNode.nodeName === 'TEXTAREA') {
				objNode.value = aNode.value;
			} else if (aNode.childNodes && aNode.childNodes.length > 0) {
				objNode.childNodes = [];
				var nodeArray$1 = Array.prototype.slice.call(aNode.childNodes);
				nodeArray$1.forEach(function (childNode) { return objNode.childNodes.push(nodeToObj(childNode, options)); });
			}
			if (options.valueDiffing) {
				if (aNode.checked !== undefined && aNode.type && ['radio', 'checkbox'].includes(aNode.type.toLowerCase())) {
					objNode.checked = aNode.checked;
				} else if (aNode.value !== undefined) {
					objNode.value = aNode.value;
				}
				if (aNode.selected !== undefined) {
					objNode.selected = aNode.selected;
				}
			}
		}
		return objNode
	}

// from html-parse-stringify (MIT)

	var tagRE = /<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/g;
// re-used obj for quick lookups of components
	var empty = Object.create ? Object.create(null) : {};
	var attrRE = /\s([^'"/\s><]+?)[\s/>]|([^\s=]+)=\s?(".*?"|'.*?')/g;


	function unescape(string) {
		return string.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
			.replace(/&amp;/g, '&')
	}

// create optimized lookup object for
// void elements as listed here:
// http://www.w3.org/html/wg/drafts/html/master/syntax.html#void-elements
	var lookup = {
		area: true,
		base: true,
		br: true,
		col: true,
		embed: true,
		hr: true,
		img: true,
		input: true,
		keygen: true,
		link: true,
		menuItem: true,
		meta: true,
		param: true,
		source: true,
		track: true,
		wbr: true
	};


	function parseTag(tag) {
		var res = {
			nodeName: '',
			attributes: {}
		};

		var tagMatch = tag.match(/<\/?([^\s]+?)[/\s>]/);
		if (tagMatch) {
			res.nodeName = tagMatch[1].toUpperCase();
			if (lookup[tagMatch[1].toLowerCase()] || tag.charAt(tag.length - 2) === '/') {
				res.voidElement = true;
			}

			// handle comment tag
			if (res.nodeName.startsWith('!--')) {
				var endIndex = tag.indexOf('-->');
				return {
					type: 'comment',
					data: endIndex !== -1 ? tag.slice(4, endIndex) : ''
				}
			}
		}

		var reg = new RegExp(attrRE);
		var result = null;
		var done = false;
		while (!done) {
			result = reg.exec(tag);

			if (result === null) {
				done = true;
			} else if (result[0].trim()) {
				if (result[1]) {
					var attr = result[1].trim();
					var arr = [attr, ""];

					if (attr.indexOf("=") > -1) { arr = attr.split("="); }

					res.attributes[arr[0]] = arr[1];
					reg.lastIndex--;
				} else if (result[2]) { res.attributes[result[2]] = result[3].trim().substring(1, result[3].length - 1); }
			}
		}

		return res
	}

	function parse(
		html,
		options
	) {
		if ( options === void 0 ) options = {components: empty};

		var result = [];
		var current;
		var level = -1;
		var arr = [];
		var inComponent = false;

		html.replace(tagRE, function (tag, index) {
			if (inComponent) {
				if (tag !== (("</" + (current.nodeName) + ">"))) {
					return
				} else {
					inComponent = false;
				}
			}
			var isOpen = tag.charAt(1) !== '/';
			var isComment = tag.startsWith('<!--');
			var start = index + tag.length;
			var nextChar = html.charAt(start);
			var parent;

			if (isComment) {
				var comment = parseTag(tag);

				// if we're at root, push new base node
				if (level < 0) {
					result.push(comment);
					return result
				}
				parent = arr[level];
				if (parent) {
					if (!parent.childNodes) {
						parent.childNodes = [];
					}
					parent.childNodes.push(comment);
				}

				return result
			}

			if (isOpen) {
				current = parseTag(tag);
				level++;
				if (current.type === 'tag' && options.components[current.nodeName]) {
					current.type = 'component';
					inComponent = true;
				}

				if (!current.voidElement && !inComponent && nextChar && nextChar !== '<') {
					if (!current.childNodes) {
						current.childNodes = [];
					}
					current.childNodes.push({
						nodeName: '#text',
						data: unescape(html.slice(start, html.indexOf('<', start)))
					});
				}

				// if we're at root, push new base node
				if (level === 0) {
					result.push(current);
				}

				parent = arr[level - 1];

				if (parent) {
					if (!parent.childNodes) {
						parent.childNodes = [];
					}
					parent.childNodes.push(current);
				}

				arr[level] = current;
			}

			if (!isOpen || current.voidElement) {
				level--;
				if (!inComponent && nextChar !== '<' && nextChar) {
					// trailing text node
					// if we're at the root, push a base text node. otherwise add as
					// a child to the current node.
					parent = level === -1 ? result : arr[level].childNodes || [];

					// calculate correct end of the data slice in case there's
					// no tag after the text node.
					var end = html.indexOf('<', start);
					var data = unescape(html.slice(start, end === -1 ? undefined : end));
					parent.push({
						nodeName: '#text',
						data: data
					});
				}
			}
		});

		return result[0]
	}

	function cleanObj(obj) {
		delete obj.voidElement;
		if (obj.childNodes) {
			obj.childNodes.forEach(function (child) { return cleanObj(child); });
		}
		return obj
	}

	function stringToObj(string) {
		return cleanObj(parse(string))
	}

// ===== Create a diff =====

	var DiffFinder = function DiffFinder(t1Node, t2Node, options) {
		this.options = options;
		this.t1 = (t1Node instanceof HTMLElement) ? nodeToObj(t1Node, this.options) : (typeof t1Node === 'string') ? stringToObj(t1Node, this.options) : JSON.parse(JSON.stringify(t1Node));
		this.t2 = (t2Node instanceof HTMLElement) ? nodeToObj(t2Node, this.options) : (typeof t2Node === 'string') ? stringToObj(t2Node, this.options) : JSON.parse(JSON.stringify(t2Node));
		this.diffcount = 0;
		this.foundAll = false;
		if (this.debug) {
			this.t1Orig = nodeToObj(t1Node, this.options);
			this.t2Orig = nodeToObj(t2Node, this.options);
		}

		this.tracker = new DiffTracker();
	};

	DiffFinder.prototype.init = function init () {
		return this.findDiffs(this.t1, this.t2)
	};

	DiffFinder.prototype.findDiffs = function findDiffs (t1, t2) {
		var diffs;
		do {
			if (this.options.debug) {
				this.diffcount += 1;
				if (this.diffcount > this.options.diffcap) {
					window.diffError = [this.t1Orig, this.t2Orig];
					throw new Error(("surpassed diffcap:" + (JSON.stringify(this.t1Orig)) + " -> " + (JSON.stringify(this.t2Orig))))
				}
			}
			diffs = this.findNextDiff(t1, t2, []);

			if (diffs.length === 0) {
				// Last check if the elements really are the same now.
				// If not, remove all info about being done and start over.
				// Sometimes a node can be marked as done, but the creation of subsequent diffs means that it has to be changed again.
				if (!isEqual(t1, t2)) {
					if (this.foundAll) {
						console.error('Could not find remaining diffs!');
					} else {
						this.foundAll = true;
						removeDone(t1);
						diffs = this.findNextDiff(t1, t2, []);
					}
				}
			}
			if (diffs.length > 0) {
				this.foundAll = false;
				this.tracker.add(diffs);
				applyVirtual(t1, diffs, this.options);
			}
		} while (diffs.length > 0)

		return this.tracker.list
	};

	DiffFinder.prototype.findNextDiff = function findNextDiff (t1, t2, route) {
		var diffs;
		var fdiffs;

		if (this.options.maxDepth && route.length > this.options.maxDepth) {
			return []
		}
		// outer differences?
		if (!t1.outerDone) {
			diffs = this.findOuterDiff(t1, t2, route);
			if (this.options.filterOuterDiff) {
				fdiffs = this.options.filterOuterDiff(t1, t2, diffs);
				if (fdiffs) { diffs = fdiffs; }
			}
			if (diffs.length > 0) {
				t1.outerDone = true;
				return diffs
			} else {
				t1.outerDone = true;
			}
		}
		// inner differences?
		if (!t1.innerDone) {
			diffs = this.findInnerDiff(t1, t2, route);
			if (diffs.length > 0) {
				return diffs
			} else {
				t1.innerDone = true;
			}
		}

		if (this.options.valueDiffing && !t1.valueDone) {
			// value differences?
			diffs = this.findValueDiff(t1, t2, route);

			if (diffs.length > 0) {
				t1.valueDone = true;
				return diffs
			} else {
				t1.valueDone = true;
			}
		}

		// no differences
		return []
	};

	DiffFinder.prototype.findOuterDiff = function findOuterDiff (t1, t2, route) {
		var diffs = [];
		var attr;
		var attr1;
		var attr2;
		var attrLength;
		var pos;
		var i;
		if (t1.nodeName !== t2.nodeName) {
			if (!route.length) {
				throw new Error('Top level nodes have to be of the same kind.')
			}
			return [new Diff()
				.setValue(this.options._const.action, this.options._const.replaceElement)
				.setValue(this.options._const.oldValue, cloneObj(t1))
				.setValue(this.options._const.newValue, cloneObj(t2))
				.setValue(this.options._const.route, route)
			]
		}
		if (route.length && this.options.maxNodeDiffCount < Math.abs((t1.childNodes || []).length - (t2.childNodes || []).length)) {
			return [new Diff()
				.setValue(this.options._const.action, this.options._const.replaceElement)
				.setValue(this.options._const.oldValue, cloneObj(t1))
				.setValue(this.options._const.newValue, cloneObj(t2))
				.setValue(this.options._const.route, route)
			]
		}

		if (t1.data !== t2.data) {
			// Comment or text node.
			if (t1.nodeName === '#text') {
				return [new Diff()
					.setValue(this.options._const.action, this.options._const.modifyTextElement)
					.setValue(this.options._const.route, route)
					.setValue(this.options._const.oldValue, t1.data)
					.setValue(this.options._const.newValue, t2.data)
				]
			} else {
				return [new Diff()
					.setValue(this.options._const.action, this.options._const.modifyComment)
					.setValue(this.options._const.route, route)
					.setValue(this.options._const.oldValue, t1.data)
					.setValue(this.options._const.newValue, t2.data)
				]
			}

		}

		attr1 = t1.attributes ? Object.keys(t1.attributes).sort() : [];
		attr2 = t2.attributes ? Object.keys(t2.attributes).sort() : [];

		attrLength = attr1.length;
		for (i = 0; i < attrLength; i++) {
			attr = attr1[i];
			pos = attr2.indexOf(attr);
			if (pos === -1) {
				diffs.push(new Diff()
					.setValue(this.options._const.action, this.options._const.removeAttribute)
					.setValue(this.options._const.route, route)
					.setValue(this.options._const.name, attr)
					.setValue(this.options._const.value, t1.attributes[attr])
				);
			} else {
				attr2.splice(pos, 1);
				if (t1.attributes[attr] !== t2.attributes[attr]) {
					diffs.push(new Diff()
						.setValue(this.options._const.action, this.options._const.modifyAttribute)
						.setValue(this.options._const.route, route)
						.setValue(this.options._const.name, attr)
						.setValue(this.options._const.oldValue, t1.attributes[attr])
						.setValue(this.options._const.newValue, t2.attributes[attr])
					);
				}
			}
		}

		attrLength = attr2.length;
		for (i = 0; i < attrLength; i++) {
			attr = attr2[i];
			diffs.push(new Diff()
				.setValue(this.options._const.action, this.options._const.addAttribute)
				.setValue(this.options._const.route, route)
				.setValue(this.options._const.name, attr)
				.setValue(this.options._const.value, t2.attributes[attr])
			);
		}

		return diffs
	};

	DiffFinder.prototype.findInnerDiff = function findInnerDiff (t1, t2, route) {
		var t1ChildNodes = t1.childNodes ? t1.childNodes.slice() : [];
		var t2ChildNodes = t2.childNodes ? t2.childNodes.slice() : [];
		var last = Math.max(t1ChildNodes.length, t2ChildNodes.length);
		var childNodesLengthDifference = Math.abs(t1ChildNodes.length - t2ChildNodes.length);
		var diffs = [];
		var index = 0;
		if (!this.options.maxChildCount || last < this.options.maxChildCount) {
			var cachedSubtrees = t1.subsets && t1.subsetsAge--;
			var subtrees = cachedSubtrees ? t1.subsets : (t1.childNodes && t2.childNodes) ? markSubTrees(t1, t2) : [];
			if (subtrees.length > 0) {
				/* One or more groups have been identified among the childnodes of t1
				 * and t2.
				 */
				diffs = this.attemptGroupRelocation(t1, t2, subtrees, route, cachedSubtrees);
				if (diffs.length > 0) {
					return diffs
				}
			}
		}


		/* 0 or 1 groups of similar child nodes have been found
		 * for t1 and t2. 1 If there is 1, it could be a sign that the
		 * contents are the same. When the number of groups is below 2,
		 * t1 and t2 are made to have the same length and each of the
		 * pairs of child nodes are diffed.
		 */

		for (var i = 0; i < last; i += 1) {
			var e1 = t1ChildNodes[i];
			var e2 = t2ChildNodes[i];

			if (childNodesLengthDifference) {
				/* t1 and t2 have different amounts of childNodes. Add
				 * and remove as necessary to obtain the same length */
				if (e1 && !e2) {
					if (e1.nodeName === '#text') {
						diffs.push(new Diff()
							.setValue(this.options._const.action, this.options._const.removeTextElement)
							.setValue(this.options._const.route, route.concat(index))
							.setValue(this.options._const.value, e1.data)
						);
						index -= 1;
					} else {
						diffs.push(new Diff()
							.setValue(this.options._const.action, this.options._const.removeElement)
							.setValue(this.options._const.route, route.concat(index))
							.setValue(this.options._const.element, cloneObj(e1))
						);
						index -= 1;
					}

				} else if (e2 && !e1) {
					if (e2.nodeName === '#text') {
						diffs.push(new Diff()
							.setValue(this.options._const.action, this.options._const.addTextElement)
							.setValue(this.options._const.route, route.concat(index))
							.setValue(this.options._const.value, e2.data)
						);
					} else {
						diffs.push(new Diff()
							.setValue(this.options._const.action, this.options._const.addElement)
							.setValue(this.options._const.route, route.concat(index))
							.setValue(this.options._const.element, cloneObj(e2))
						);
					}
				}
			}
			/* We are now guaranteed that childNodes e1 and e2 exist,
			 * and that they can be diffed.
			 */
			/* Diffs in child nodes should not affect the parent node,
			 * so we let these diffs be submitted together with other
			 * diffs.
			 */

			if (e1 && e2) {
				if (!this.options.maxChildCount || last < this.options.maxChildCount) {
					diffs = diffs.concat(this.findNextDiff(e1, e2, route.concat(index)));
				} else if (!isEqual(e1, e2)) {
					if (t1ChildNodes.length > t2ChildNodes.length) {
						if (e1.nodeName === '#text') {
							diffs.push(new Diff()
								.setValue(this.options._const.action, this.options._const.removeTextElement)
								.setValue(this.options._const.route, route.concat(index))
								.setValue(this.options._const.value, e1.data)
							);
						} else {
							diffs.push(
								new Diff()
									.setValue(this.options._const.action, this.options._const.removeElement)
									.setValue(this.options._const.element, cloneObj(e1))
									.setValue(this.options._const.route, route.concat(index))
							);
						}
						t1ChildNodes.splice(i, 1);
						i -= 1;
						index -= 1;

						childNodesLengthDifference -= 1;
					} else if (t1ChildNodes.length < t2ChildNodes.length) {
						diffs = diffs.concat([
							new Diff()
								.setValue(this.options._const.action, this.options._const.addElement)
								.setValue(this.options._const.element, cloneObj(e2))
								.setValue(this.options._const.route, route.concat(index))
						]);
						t1ChildNodes.splice(i, 0, {});
						childNodesLengthDifference -= 1;
					} else {
						diffs = diffs.concat([
							new Diff()
								.setValue(this.options._const.action, this.options._const.replaceElement)
								.setValue(this.options._const.oldValue, cloneObj(e1))
								.setValue(this.options._const.newValue, cloneObj(e2))
								.setValue(this.options._const.route, route.concat(index))
						]);
					}

				}

			}
			index += 1;

		}
		t1.innerDone = true;
		return diffs
	};

	DiffFinder.prototype.attemptGroupRelocation = function attemptGroupRelocation (t1, t2, subtrees, route, cachedSubtrees) {
		/* Either t1.childNodes and t2.childNodes have the same length, or
		 * there are at least two groups of similar elements can be found.
		 * attempts are made at equalizing t1 with t2. First all initial
		 * elements with no group affiliation (gaps=true) are removed (if
		 * only in t1) or added (if only in t2). Then the creation of a group
		 * relocation diff is attempted.
		 */
		var gapInformation = getGapInformation(t1, t2, subtrees);
		var gaps1 = gapInformation.gaps1;
		var gaps2 = gapInformation.gaps2;
		var shortest = Math.min(gaps1.length, gaps2.length);
		var destinationDifferent;
		var toGroup;
		var group;
		var node;
		var similarNode;
		var testI;
		var diffs = [];

		for (var index2 = 0, index1 = 0; index2 < shortest; index1 += 1, index2 += 1) {
			if (cachedSubtrees && (gaps1[index2] === true || gaps2[index2] === true)) ; else if (gaps1[index2] === true) {
				node = t1.childNodes[index1];
				if (node.nodeName === '#text') {
					if (t2.childNodes[index2].nodeName === '#text') {
						if (node.data !== t2.childNodes[index2].data) {
							testI = index1;
							while (t1.childNodes.length > testI + 1 && t1.childNodes[testI + 1].nodeName === '#text') {
								testI += 1;
								if (t2.childNodes[index2].data === t1.childNodes[testI].data) {
									similarNode = true;
									break
								}
							}
							if (!similarNode) {
								diffs.push(new Diff()
									.setValue(this.options._const.action, this.options._const.modifyTextElement)
									.setValue(this.options._const.route, route.concat(index2))
									.setValue(this.options._const.oldValue, node.data)
									.setValue(this.options._const.newValue, t2.childNodes[index2].data)
								);
								return diffs
							}
						}
					} else {
						diffs.push(new Diff()
							.setValue(this.options._const.action, this.options._const.removeTextElement)
							.setValue(this.options._const.route, route.concat(index2))
							.setValue(this.options._const.value, node.data)
						);
						gaps1.splice(index2, 1);
						shortest = Math.min(gaps1.length, gaps2.length);
						index2 -= 1;
					}
				} else {
					diffs.push(new Diff()
						.setValue(this.options._const.action, this.options._const.removeElement)
						.setValue(this.options._const.route, route.concat(index2))
						.setValue(this.options._const.element, cloneObj(node))
					);
					gaps1.splice(index2, 1);
					shortest = Math.min(gaps1.length, gaps2.length);
					index2 -= 1;
				}

			} else if (gaps2[index2] === true) {
				node = t2.childNodes[index2];
				if (node.nodeName === '#text') {
					diffs.push(new Diff()
						.setValue(this.options._const.action, this.options._const.addTextElement)
						.setValue(this.options._const.route, route.concat(index2))
						.setValue(this.options._const.value, node.data)
					);
					gaps1.splice(index2, 0, true);
					shortest = Math.min(gaps1.length, gaps2.length);
					index1 -= 1;
				} else {
					diffs.push(new Diff()
						.setValue(this.options._const.action, this.options._const.addElement)
						.setValue(this.options._const.route, route.concat(index2))
						.setValue(this.options._const.element, cloneObj(node))
					);
					gaps1.splice(index2, 0, true);
					shortest = Math.min(gaps1.length, gaps2.length);
					index1 -= 1;
				}

			} else if (gaps1[index2] !== gaps2[index2]) {
				if (diffs.length > 0) {
					return diffs
				}
				// group relocation
				group = subtrees[gaps1[index2]];
				toGroup = Math.min(group.newValue, (t1.childNodes.length - group.length));
				if (toGroup !== group.oldValue) {
					// Check whether destination nodes are different than originating ones.
					destinationDifferent = false;
					for (var j = 0; j < group.length; j += 1) {
						if (!roughlyEqual(t1.childNodes[toGroup + j], t1.childNodes[group.oldValue + j], [], false, true)) {
							destinationDifferent = true;
						}
					}
					if (destinationDifferent) {
						return [new Diff()
							.setValue(this.options._const.action, this.options._const.relocateGroup)
							.setValue('groupLength', group.length)
							.setValue(this.options._const.from, group.oldValue)
							.setValue(this.options._const.to, toGroup)
							.setValue(this.options._const.route, route)
						]
					}
				}
			}
		}
		return diffs
	};

	DiffFinder.prototype.findValueDiff = function findValueDiff (t1, t2, route) {
		// Differences of value. Only useful if the value/selection/checked value
		// differs from what is represented in the DOM. For example in the case
		// of filled out forms, etc.
		var diffs = [];

		if (t1.selected !== t2.selected) {
			diffs.push(new Diff()
				.setValue(this.options._const.action, this.options._const.modifySelected)
				.setValue(this.options._const.oldValue, t1.selected)
				.setValue(this.options._const.newValue, t2.selected)
				.setValue(this.options._const.route, route)
			);
		}

		if ((t1.value || t2.value) && t1.value !== t2.value && t1.nodeName !== 'OPTION') {
			diffs.push(new Diff()
				.setValue(this.options._const.action, this.options._const.modifyValue)
				.setValue(this.options._const.oldValue, t1.value || "")
				.setValue(this.options._const.newValue, t2.value || "")
				.setValue(this.options._const.route, route)
			);
		}
		if (t1.checked !== t2.checked) {
			diffs.push(new Diff()
				.setValue(this.options._const.action, this.options._const.modifyChecked)
				.setValue(this.options._const.oldValue, t1.checked)
				.setValue(this.options._const.newValue, t2.checked)
				.setValue(this.options._const.route, route)
			);
		}

		return diffs
	};

	var DEFAULT_OPTIONS = {
		debug: false,
		diffcap: 10, // Limit for how many diffs are accepting when debugging. Inactive when debug is false.
		maxDepth: false, // False or a numeral. If set to a numeral, limits the level of depth that the the diff mechanism looks for differences. If false, goes through the entire tree.
		maxChildCount: 50, // False or a numeral. If set to a numeral, only does a simplified form of diffing of contents so that the number of diffs cannot be higher than the number of child nodes.
		valueDiffing: true, // Whether to take into consideration the values of forms that differ from auto assigned values (when a user fills out a form).
		// syntax: textDiff: function (node, currentValue, expectedValue, newValue)
		textDiff: function textDiff(node, currentValue, expectedValue, newValue) {
			node.data = newValue;
			return
		},
		// empty functions were benchmarked as running faster than both
		// `f && f()` and `if (f) { f(); }`
		preVirtualDiffApply: function preVirtualDiffApply() {},
		postVirtualDiffApply: function postVirtualDiffApply() {},
		preDiffApply: function preDiffApply() {},
		postDiffApply: function postDiffApply() {},
		filterOuterDiff: null,
		compress: false, // Whether to work with compressed diffs
		_const: false, // object with strings for every change types to be used in diffs.
		document: window && window.document ? window.document : false
	};


	var DiffDOM = function DiffDOM(options) {
		var this$1 = this;
		if ( options === void 0 ) options = {};


		this.options = options;
		// IE11 doesn't have Object.assign and buble doesn't translate object spreaders
		// by default, so this is the safest way of doing it currently.
		Object.entries(DEFAULT_OPTIONS).forEach(function (ref) {
			var key = ref[0];
			var value = ref[1];

			if (!Object.prototype.hasOwnProperty.call(this$1.options, key)) {
				this$1.options[key] = value;
			}
		});

		if (!this.options._const) {
			var varNames = ["addAttribute", "modifyAttribute", "removeAttribute",
				"modifyTextElement", "relocateGroup", "removeElement", "addElement",
				"removeTextElement", "addTextElement", "replaceElement", "modifyValue",
				"modifyChecked", "modifySelected", "modifyComment", "action", "route",
				"oldValue", "newValue", "element", "group", "from", "to", "name",
				"value", "data", "attributes", "nodeName", "childNodes", "checked",
				"selected"
			];
			this.options._const = {};
			if (this.options.compress) {
				varNames.forEach(function (varName, index) { return this$1.options._const[varName] = index; });
			} else {
				varNames.forEach(function (varName) { return this$1.options._const[varName] = varName; });
			}
		}

		this.DiffFinder = DiffFinder;

	};

	DiffDOM.prototype.apply = function apply (tree, diffs) {
		return applyDOM(tree, diffs, this.options)
	};

	DiffDOM.prototype.undo = function undo (tree, diffs) {
		return undoDOM(tree, diffs, this.options)
	};

	DiffDOM.prototype.diff = function diff (t1Node, t2Node) {
		var finder = new this.DiffFinder(t1Node, t2Node, this.options);
		return finder.init()
	};

	/**
	 * Use TraceLogger to figure out function calls inside
	 * JS objects by wrapping an object with a TraceLogger
	 * instance.
	 *
	 * Pretty-prints the call trace (using unicode box code)
	 * when tracelogger.toString() is called.
	 */

	/**
	 * Wrap an object by calling new TraceLogger(obj)
	 *
	 * If you're familiar with Python decorators, this
	 * does roughly the same thing, adding pre/post
	 * call hook logging calls so that you can see
	 * what's going on.
	 */
	var TraceLogger = function TraceLogger(obj) {
		var this$1 = this;
		if ( obj === void 0 ) obj = {};

		this.pad = "│   ";
		this.padding = "";
		this.tick = 1;
		this.messages = [];
		var wrapkey = function (obj, key) {
			// trace this function
			var oldfn = obj[key];
			obj[key] = function () {
				var args = [], len = arguments.length;
				while ( len-- ) args[ len ] = arguments[ len ];

				this$1.fin(key, Array.prototype.slice.call(args));
				var result = oldfn.apply(obj, args);
				this$1.fout(key, result);
				return result
			};
		};
		// can't use Object.keys for prototype walking
		for (var key in obj) {
			if (typeof obj[key] === "function") {
				wrapkey(obj, key);
			}
		}
		this.log("┌ TRACELOG START");
	};
// called when entering a function
	TraceLogger.prototype.fin = function fin (fn, args) {
		this.padding += this.pad;
		this.log(("├─> entering " + fn), args);
	};
// called when exiting a function
	TraceLogger.prototype.fout = function fout (fn, result) {
		this.log("│<──┘ generated return value", result);
		this.padding = this.padding.substring(0, this.padding.length - this.pad.length);
	};
// log message formatting
	TraceLogger.prototype.format = function format (s, tick) {
		var nf = function(t) {
			t = "" + t;
			while (t.length < 4) {
				t = "0" + t;
			}
			return t
		};
		return ((nf(tick)) + "> " + (this.padding) + s)
	};
// log a trace message
	TraceLogger.prototype.log = function log () {
		var s = Array.prototype.slice.call(arguments);
		var stringCollapse = function(v) {
			if (!v) {
				return "<falsey>"
			}
			if (typeof v === "string") {
				return v
			}
			if (v instanceof HTMLElement) {
				return v.outerHTML || "<empty>"
			}
			if (v instanceof Array) {
				return ("[" + (v.map(stringCollapse).join(",")) + "]")
			}
			return v.toString() || v.valueOf() || "<unknown>"
		};
		s = s.map(stringCollapse).join(", ");
		this.messages.push(this.format(s, this.tick++));
	};
// turn the log into a structured string with
// unicode box codes to make it a sensible trace.
	TraceLogger.prototype.toString = function toString () {
		var cap = "×   ";
		var terminator = "└───";
		while (terminator.length <= this.padding.length + this.pad.length) {
			terminator += cap;
		}
		var _ = this.padding;
		this.padding = "";
		terminator = this.format(terminator, this.tick);
		this.padding = _;
		return ((this.messages.join("\n")) + "\n" + terminator)
	};

	return {
		DiffDOM: DiffDOM,
		TraceLogger: TraceLogger,
		nodeToObj: nodeToObj,
		stringToObj: stringToObj
	};
})();


var diffDOM=function(e){"use strict";function t(e,o,n){var s;return"#text"===e.nodeName?s=n.document.createTextNode(e.data):"#comment"===e.nodeName?s=n.document.createComment(e.data):(o?s=n.document.createElementNS("http://www.w3.org/2000/svg",e.nodeName):"svg"===e.nodeName.toLowerCase()?(s=n.document.createElementNS("http://www.w3.org/2000/svg","svg"),o=!0):s=n.document.createElement(e.nodeName),e.attributes&&Object.entries(e.attributes).forEach((function(e){var t=e[0],o=e[1];return s.setAttribute(t,o)})),e.childNodes&&e.childNodes.forEach((function(e){return s.appendChild(t(e,o,n))})),n.valueDiffing&&(e.value&&(s.value=e.value),e.checked&&(s.checked=e.checked),e.selected&&(s.selected=e.selected))),s}function o(e,t){for(t=t.slice();t.length>0;){if(!e.childNodes)return!1;var o=t.splice(0,1)[0];e=e.childNodes[o]}return e}function n(e,n,s){var i,a,l,c,r=o(e,n[s._const.route]),u={diff:n,node:r};if(s.preDiffApply(u))return!0;switch(n[s._const.action]){case s._const.addAttribute:if(!r||!r.setAttribute)return!1;r.setAttribute(n[s._const.name],n[s._const.value]);break;case s._const.modifyAttribute:if(!r||!r.setAttribute)return!1;r.setAttribute(n[s._const.name],n[s._const.newValue]),"INPUT"===r.nodeName&&"value"===n[s._const.name]&&(r.value=n[s._const.newValue]);break;case s._const.removeAttribute:if(!r||!r.removeAttribute)return!1;r.removeAttribute(n[s._const.name]);break;case s._const.modifyTextElement:if(!r||3!==r.nodeType)return!1;s.textDiff(r,r.data,n[s._const.oldValue],n[s._const.newValue]);break;case s._const.modifyValue:if(!r||void 0===r.value)return!1;r.value=n[s._const.newValue];break;case s._const.modifyComment:if(!r||void 0===r.data)return!1;s.textDiff(r,r.data,n[s._const.oldValue],n[s._const.newValue]);break;case s._const.modifyChecked:if(!r||void 0===r.checked)return!1;r.checked=n[s._const.newValue];break;case s._const.modifySelected:if(!r||void 0===r.selected)return!1;r.selected=n[s._const.newValue];break;case s._const.replaceElement:r.parentNode.replaceChild(t(n[s._const.newValue],"http://www.w3.org/2000/svg"===r.namespaceURI,s),r);break;case s._const.relocateGroup:Array.apply(void 0,new Array(n.groupLength)).map((function(){return r.removeChild(r.childNodes[n[s._const.from]])})).forEach((function(e,t){0===t&&(a=r.childNodes[n[s._const.to]]),r.insertBefore(e,a||null)}));break;case s._const.removeElement:r.parentNode.removeChild(r);break;case s._const.addElement:c=(l=n[s._const.route].slice()).splice(l.length-1,1)[0],(r=o(e,l)).insertBefore(t(n[s._const.element],"http://www.w3.org/2000/svg"===r.namespaceURI,s),r.childNodes[c]||null);break;case s._const.removeTextElement:if(!r||3!==r.nodeType)return!1;r.parentNode.removeChild(r);break;case s._const.addTextElement:if(c=(l=n[s._const.route].slice()).splice(l.length-1,1)[0],i=s.document.createTextNode(n[s._const.value]),!(r=o(e,l))||!r.childNodes)return!1;r.insertBefore(i,r.childNodes[c]||null);break;default:console.log("unknown action")}return u.newNode=i,s.postDiffApply(u),!0}function s(e,t,o){var n=e[t];e[t]=e[o],e[o]=n}function i(e,t,o){t.length||(t=[t]),(t=t.slice()).reverse(),t.forEach((function(t){!function(e,t,o){switch(t[o._const.action]){case o._const.addAttribute:t[o._const.action]=o._const.removeAttribute,n(e,t,o);break;case o._const.modifyAttribute:s(t,o._const.oldValue,o._const.newValue),n(e,t,o);break;case o._const.removeAttribute:t[o._const.action]=o._const.addAttribute,n(e,t,o);break;case o._const.modifyTextElement:case o._const.modifyValue:case o._const.modifyComment:case o._const.modifyChecked:case o._const.modifySelected:case o._const.replaceElement:s(t,o._const.oldValue,o._const.newValue),n(e,t,o);break;case o._const.relocateGroup:s(t,o._const.from,o._const.to),n(e,t,o);break;case o._const.removeElement:t[o._const.action]=o._const.addElement,n(e,t,o);break;case o._const.addElement:t[o._const.action]=o._const.removeElement,n(e,t,o);break;case o._const.removeTextElement:t[o._const.action]=o._const.addTextElement,n(e,t,o);break;case o._const.addTextElement:t[o._const.action]=o._const.removeTextElement,n(e,t,o);break;default:console.log("unknown action")}}(e,t,o)}))}var a=function(e){var t=this;void 0===e&&(e={}),Object.entries(e).forEach((function(e){var o=e[0],n=e[1];return t[o]=n}))};function l(e){var t=[];return t.push(e.nodeName),"#text"!==e.nodeName&&"#comment"!==e.nodeName&&e.attributes&&(e.attributes.class&&t.push(e.nodeName+"."+e.attributes.class.replace(/ /g,".")),e.attributes.id&&t.push(e.nodeName+"#"+e.attributes.id)),t}function c(e){var t={},o={};return e.forEach((function(e){l(e).forEach((function(e){var n=e in t;n||e in o?n&&(delete t[e],o[e]=!0):t[e]=!0}))})),t}function r(e,t){var o=c(e),n=c(t),s={};return Object.keys(o).forEach((function(e){n[e]&&(s[e]=!0)})),s}function u(e){return delete e.outerDone,delete e.innerDone,delete e.valueDone,!e.childNodes||e.childNodes.every(u)}function d(e,t){if(!["nodeName","value","checked","selected","data"].every((function(o){return e[o]===t[o]})))return!1;if(Boolean(e.attributes)!==Boolean(t.attributes))return!1;if(Boolean(e.childNodes)!==Boolean(t.childNodes))return!1;if(e.attributes){var o=Object.keys(e.attributes),n=Object.keys(t.attributes);if(o.length!==n.length)return!1;if(!o.every((function(o){return e.attributes[o]===t.attributes[o]})))return!1}if(e.childNodes){if(e.childNodes.length!==t.childNodes.length)return!1;if(!e.childNodes.every((function(e,o){return d(e,t.childNodes[o])})))return!1}return!0}function h(e,t,o,n,s){if(!e||!t)return!1;if(e.nodeName!==t.nodeName)return!1;if("#text"===e.nodeName)return!!s||e.data===t.data;if(e.nodeName in o)return!0;if(e.attributes&&t.attributes){if(e.attributes.id){if(e.attributes.id!==t.attributes.id)return!1;if(e.nodeName+"#"+e.attributes.id in o)return!0}if(e.attributes.class&&e.attributes.class===t.attributes.class)if(e.nodeName+"."+e.attributes.class.replace(/ /g,".")in o)return!0}if(n)return!0;var i=e.childNodes?e.childNodes.slice().reverse():[],a=t.childNodes?t.childNodes.slice().reverse():[];if(i.length!==a.length)return!1;if(s)return i.every((function(e,t){return e.nodeName===a[t].nodeName}));var l=r(i,a);return i.every((function(e,t){return h(e,a[t],l,!0,!0)}))}function f(e){return JSON.parse(JSON.stringify(e))}function p(e,t,o,n){var s=0,i=[],a=e.length,c=t.length,u=Array.apply(void 0,new Array(a+1)).map((function(){return[]})),d=r(e,t),f=a===c;f&&e.some((function(e,o){var n=l(e),s=l(t[o]);return n.length!==s.length?(f=!1,!0):(n.some((function(e,t){if(e!==s[t])return f=!1,!0})),!f||void 0)}));for(var p=0;p<a;p++)for(var m=e[p],_=0;_<c;_++){var V=t[_];o[p]||n[_]||!h(m,V,d,f)?u[p+1][_+1]=0:(u[p+1][_+1]=u[p][_]?u[p][_]+1:1,u[p+1][_+1]>=s&&(s=u[p+1][_+1],i=[p+1,_+1]))}return 0!==s&&{oldValue:i[0]-s,newValue:i[1]-s,length:s}}function m(e,t){return Array.apply(void 0,new Array(e)).map((function(){return t}))}a.prototype.toString=function(){return JSON.stringify(this)},a.prototype.setValue=function(e,t){return this[e]=t,this};var _=function(){this.list=[]};function V(e,t){var o,n,s=e;for(t=t.slice();t.length>0;){if(!s.childNodes)return!1;n=t.splice(0,1)[0],o=s,s=s.childNodes[n]}return{node:s,parentNode:o,nodeIndex:n}}function g(e,t,o){return t.forEach((function(t){!function(e,t,o){var n,s,i,a=V(e,t[o._const.route]),l=a.node,c=a.parentNode,r=a.nodeIndex,u=[],d={diff:t,node:l};if(o.preVirtualDiffApply(d))return!0;switch(t[o._const.action]){case o._const.addAttribute:l.attributes||(l.attributes={}),l.attributes[t[o._const.name]]=t[o._const.value],"checked"===t[o._const.name]?l.checked=!0:"selected"===t[o._const.name]?l.selected=!0:"INPUT"===l.nodeName&&"value"===t[o._const.name]&&(l.value=t[o._const.value]);break;case o._const.modifyAttribute:l.attributes[t[o._const.name]]=t[o._const.newValue];break;case o._const.removeAttribute:delete l.attributes[t[o._const.name]],0===Object.keys(l.attributes).length&&delete l.attributes,"checked"===t[o._const.name]?l.checked=!1:"selected"===t[o._const.name]?delete l.selected:"INPUT"===l.nodeName&&"value"===t[o._const.name]&&delete l.value;break;case o._const.modifyTextElement:l.data=t[o._const.newValue];break;case o._const.modifyValue:l.value=t[o._const.newValue];break;case o._const.modifyComment:l.data=t[o._const.newValue];break;case o._const.modifyChecked:l.checked=t[o._const.newValue];break;case o._const.modifySelected:l.selected=t[o._const.newValue];break;case o._const.replaceElement:(n=f(t[o._const.newValue])).outerDone=!0,n.innerDone=!0,n.valueDone=!0,c.childNodes[r]=n;break;case o._const.relocateGroup:l.childNodes.splice(t[o._const.from],t.groupLength).reverse().forEach((function(e){return l.childNodes.splice(t[o._const.to],0,e)})),l.subsets&&l.subsets.forEach((function(e){if(t[o._const.from]<t[o._const.to]&&e.oldValue<=t[o._const.to]&&e.oldValue>t[o._const.from]){e.oldValue-=t.groupLength;var n=e.oldValue+e.length-t[o._const.to];n>0&&(u.push({oldValue:t[o._const.to]+t.groupLength,newValue:e.newValue+e.length-n,length:n}),e.length-=n)}else if(t[o._const.from]>t[o._const.to]&&e.oldValue>t[o._const.to]&&e.oldValue<t[o._const.from]){e.oldValue+=t.groupLength;var s=e.oldValue+e.length-t[o._const.to];s>0&&(u.push({oldValue:t[o._const.to]+t.groupLength,newValue:e.newValue+e.length-s,length:s}),e.length-=s)}else e.oldValue===t[o._const.from]&&(e.oldValue=t[o._const.to])}));break;case o._const.removeElement:c.childNodes.splice(r,1),c.subsets&&c.subsets.forEach((function(e){e.oldValue>r?e.oldValue-=1:e.oldValue===r?e.delete=!0:e.oldValue<r&&e.oldValue+e.length>r&&(e.oldValue+e.length-1===r?e.length--:(u.push({newValue:e.newValue+r-e.oldValue,oldValue:r,length:e.length-r+e.oldValue-1}),e.length=r-e.oldValue))})),l=c;break;case o._const.addElement:s=t[o._const.route].slice(),i=s.splice(s.length-1,1)[0],l=V(e,s).node,(n=f(t[o._const.element])).outerDone=!0,n.innerDone=!0,n.valueDone=!0,l.childNodes||(l.childNodes=[]),i>=l.childNodes.length?l.childNodes.push(n):l.childNodes.splice(i,0,n),l.subsets&&l.subsets.forEach((function(e){if(e.oldValue>=i)e.oldValue+=1;else if(e.oldValue<i&&e.oldValue+e.length>i){var t=e.oldValue+e.length-i;u.push({newValue:e.newValue+e.length-t,oldValue:i+1,length:t}),e.length-=t}}));break;case o._const.removeTextElement:c.childNodes.splice(r,1),"TEXTAREA"===c.nodeName&&delete c.value,c.subsets&&c.subsets.forEach((function(e){e.oldValue>r?e.oldValue-=1:e.oldValue===r?e.delete=!0:e.oldValue<r&&e.oldValue+e.length>r&&(e.oldValue+e.length-1===r?e.length--:(u.push({newValue:e.newValue+r-e.oldValue,oldValue:r,length:e.length-r+e.oldValue-1}),e.length=r-e.oldValue))})),l=c;break;case o._const.addTextElement:s=t[o._const.route].slice(),i=s.splice(s.length-1,1)[0],(n={}).nodeName="#text",n.data=t[o._const.value],(l=V(e,s).node).childNodes||(l.childNodes=[]),i>=l.childNodes.length?l.childNodes.push(n):l.childNodes.splice(i,0,n),"TEXTAREA"===l.nodeName&&(l.value=t[o._const.newValue]),l.subsets&&l.subsets.forEach((function(e){if(e.oldValue>=i&&(e.oldValue+=1),e.oldValue<i&&e.oldValue+e.length>i){var t=e.oldValue+e.length-i;u.push({newValue:e.newValue+e.length-t,oldValue:i+1,length:t}),e.length-=t}}));break;default:console.log("unknown action")}l.subsets&&(l.subsets=l.subsets.filter((function(e){return!e.delete&&e.oldValue!==e.newValue})),u.length&&(l.subsets=l.subsets.concat(u))),d.newNode=n,o.postVirtualDiffApply(d)}(e,t,o)})),!0}function v(e,t){void 0===t&&(t={});var o={};if(o.nodeName=e.nodeName,"#text"===o.nodeName||"#comment"===o.nodeName)o.data=e.data;else{if(e.attributes&&e.attributes.length>0)o.attributes={},Array.prototype.slice.call(e.attributes).forEach((function(e){return o.attributes[e.name]=e.value}));if("TEXTAREA"===o.nodeName)o.value=e.value;else if(e.childNodes&&e.childNodes.length>0){o.childNodes=[],Array.prototype.slice.call(e.childNodes).forEach((function(e){return o.childNodes.push(v(e,t))}))}t.valueDiffing&&(void 0!==e.checked&&e.type&&["radio","checkbox"].includes(e.type.toLowerCase())?o.checked=e.checked:void 0!==e.value&&(o.value=e.value),void 0!==e.selected&&(o.selected=e.selected))}return o}_.prototype.add=function(e){var t;(t=this.list).push.apply(t,e)},_.prototype.forEach=function(e){this.list.forEach((function(t){return e(t)}))};var N=/<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/g,b=Object.create?Object.create(null):{},w=/\s([^'"/\s><]+?)[\s/>]|([^\s=]+)=\s?(".*?"|'.*?')/g;function y(e){return e.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&")}var E={area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,menuItem:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0};function k(e){var t={nodeName:"",attributes:{}},o=e.match(/<\/?([^\s]+?)[/\s>]/);if(o&&(t.nodeName=o[1].toUpperCase(),(E[o[1].toLowerCase()]||"/"===e.charAt(e.length-2))&&(t.voidElement=!0),t.nodeName.startsWith("!--"))){var n=e.indexOf("--\x3e");return{type:"comment",data:-1!==n?e.slice(4,n):""}}for(var s=new RegExp(w),i=null,a=!1;!a;)if(null===(i=s.exec(e)))a=!0;else if(i[0].trim())if(i[1]){var l=i[1].trim(),c=[l,""];l.indexOf("=")>-1&&(c=l.split("=")),t.attributes[c[0]]=c[1],s.lastIndex--}else i[2]&&(t.attributes[i[2]]=i[3].trim().substring(1,i[3].length-1));return t}function x(e){return function e(t){return delete t.voidElement,t.childNodes&&t.childNodes.forEach((function(t){return e(t)})),t}(function(e,t){void 0===t&&(t={components:b});var o,n=[],s=-1,i=[],a=!1;return e.replace(N,(function(l,c){if(a){if(l!=="</"+o.nodeName+">")return;a=!1}var r,u="/"!==l.charAt(1),d=l.startsWith("\x3c!--"),h=c+l.length,f=e.charAt(h);if(d){var p=k(l);return s<0?(n.push(p),n):((r=i[s])&&(r.childNodes||(r.childNodes=[]),r.childNodes.push(p)),n)}if(u&&(o=k(l),s++,"tag"===o.type&&t.components[o.nodeName]&&(o.type="component",a=!0),o.voidElement||a||!f||"<"===f||(o.childNodes||(o.childNodes=[]),o.childNodes.push({nodeName:"#text",data:y(e.slice(h,e.indexOf("<",h)))})),0===s&&n.push(o),(r=i[s-1])&&(r.childNodes||(r.childNodes=[]),r.childNodes.push(o)),i[s]=o),(!u||o.voidElement)&&(s--,!a&&"<"!==f&&f)){r=-1===s?n:i[s].childNodes||[];var m=e.indexOf("<",h),_=y(e.slice(h,-1===m?void 0:m));r.push({nodeName:"#text",data:_})}})),n[0]}(e))}var A=function(e,t,o){this.options=o,this.t1=e instanceof HTMLElement?v(e,this.options):"string"==typeof e?x(e,this.options):JSON.parse(JSON.stringify(e)),this.t2=t instanceof HTMLElement?v(t,this.options):"string"==typeof t?x(t,this.options):JSON.parse(JSON.stringify(t)),this.diffcount=0,this.foundAll=!1,this.debug&&(this.t1Orig=v(e,this.options),this.t2Orig=v(t,this.options)),this.tracker=new _};A.prototype.init=function(){return this.findDiffs(this.t1,this.t2)},A.prototype.findDiffs=function(e,t){var o;do{if(this.options.debug&&(this.diffcount+=1,this.diffcount>this.options.diffcap))throw window.diffError=[this.t1Orig,this.t2Orig],new Error("surpassed diffcap:"+JSON.stringify(this.t1Orig)+" -> "+JSON.stringify(this.t2Orig));0===(o=this.findNextDiff(e,t,[])).length&&(d(e,t)||(this.foundAll?console.error("Could not find remaining diffs!"):(this.foundAll=!0,u(e),o=this.findNextDiff(e,t,[])))),o.length>0&&(this.foundAll=!1,this.tracker.add(o),g(e,o,this.options))}while(o.length>0);return this.tracker.list},A.prototype.findNextDiff=function(e,t,o){var n,s;if(this.options.maxDepth&&o.length>this.options.maxDepth)return[];if(!e.outerDone){if(n=this.findOuterDiff(e,t,o),this.options.filterOuterDiff&&(s=this.options.filterOuterDiff(e,t,n))&&(n=s),n.length>0)return e.outerDone=!0,n;e.outerDone=!0}if(!e.innerDone){if((n=this.findInnerDiff(e,t,o)).length>0)return n;e.innerDone=!0}if(this.options.valueDiffing&&!e.valueDone){if((n=this.findValueDiff(e,t,o)).length>0)return e.valueDone=!0,n;e.valueDone=!0}return[]},A.prototype.findOuterDiff=function(e,t,o){var n,s,i,l,c,r,u=[];if(e.nodeName!==t.nodeName){if(!o.length)throw new Error("Top level nodes have to be of the same kind.");return[(new a).setValue(this.options._const.action,this.options._const.replaceElement).setValue(this.options._const.oldValue,f(e)).setValue(this.options._const.newValue,f(t)).setValue(this.options._const.route,o)]}if(o.length&&this.options.maxNodeDiffCount<Math.abs((e.childNodes||[]).length-(t.childNodes||[]).length))return[(new a).setValue(this.options._const.action,this.options._const.replaceElement).setValue(this.options._const.oldValue,f(e)).setValue(this.options._const.newValue,f(t)).setValue(this.options._const.route,o)];if(e.data!==t.data)return"#text"===e.nodeName?[(new a).setValue(this.options._const.action,this.options._const.modifyTextElement).setValue(this.options._const.route,o).setValue(this.options._const.oldValue,e.data).setValue(this.options._const.newValue,t.data)]:[(new a).setValue(this.options._const.action,this.options._const.modifyComment).setValue(this.options._const.route,o).setValue(this.options._const.oldValue,e.data).setValue(this.options._const.newValue,t.data)];for(s=e.attributes?Object.keys(e.attributes).sort():[],i=t.attributes?Object.keys(t.attributes).sort():[],l=s.length,r=0;r<l;r++)n=s[r],-1===(c=i.indexOf(n))?u.push((new a).setValue(this.options._const.action,this.options._const.removeAttribute).setValue(this.options._const.route,o).setValue(this.options._const.name,n).setValue(this.options._const.value,e.attributes[n])):(i.splice(c,1),e.attributes[n]!==t.attributes[n]&&u.push((new a).setValue(this.options._const.action,this.options._const.modifyAttribute).setValue(this.options._const.route,o).setValue(this.options._const.name,n).setValue(this.options._const.oldValue,e.attributes[n]).setValue(this.options._const.newValue,t.attributes[n])));for(l=i.length,r=0;r<l;r++)n=i[r],u.push((new a).setValue(this.options._const.action,this.options._const.addAttribute).setValue(this.options._const.route,o).setValue(this.options._const.name,n).setValue(this.options._const.value,t.attributes[n]));return u},A.prototype.findInnerDiff=function(e,t,o){var n=e.childNodes?e.childNodes.slice():[],s=t.childNodes?t.childNodes.slice():[],i=Math.max(n.length,s.length),l=Math.abs(n.length-s.length),c=[],r=0;if(!this.options.maxChildCount||i<this.options.maxChildCount){var u=e.subsets&&e.subsetsAge--,h=u?e.subsets:e.childNodes&&t.childNodes?function(e,t){for(var o=e.childNodes?e.childNodes:[],n=t.childNodes?t.childNodes:[],s=m(o.length,!1),i=m(n.length,!1),a=[],l=!0,c=function(){return arguments[1]};l;){if(l=p(o,n,s,i))a.push(l),Array.apply(void 0,new Array(l.length)).map(c).forEach((function(e){return t=e,s[l.oldValue+t]=!0,void(i[l.newValue+t]=!0);var t}))}return e.subsets=a,e.subsetsAge=100,a}(e,t):[];if(h.length>0&&(c=this.attemptGroupRelocation(e,t,h,o,u)).length>0)return c}for(var _=0;_<i;_+=1){var V=n[_],g=s[_];l&&(V&&!g?"#text"===V.nodeName?(c.push((new a).setValue(this.options._const.action,this.options._const.removeTextElement).setValue(this.options._const.route,o.concat(r)).setValue(this.options._const.value,V.data)),r-=1):(c.push((new a).setValue(this.options._const.action,this.options._const.removeElement).setValue(this.options._const.route,o.concat(r)).setValue(this.options._const.element,f(V))),r-=1):g&&!V&&("#text"===g.nodeName?c.push((new a).setValue(this.options._const.action,this.options._const.addTextElement).setValue(this.options._const.route,o.concat(r)).setValue(this.options._const.value,g.data)):c.push((new a).setValue(this.options._const.action,this.options._const.addElement).setValue(this.options._const.route,o.concat(r)).setValue(this.options._const.element,f(g))))),V&&g&&(!this.options.maxChildCount||i<this.options.maxChildCount?c=c.concat(this.findNextDiff(V,g,o.concat(r))):d(V,g)||(n.length>s.length?("#text"===V.nodeName?c.push((new a).setValue(this.options._const.action,this.options._const.removeTextElement).setValue(this.options._const.route,o.concat(r)).setValue(this.options._const.value,V.data)):c.push((new a).setValue(this.options._const.action,this.options._const.removeElement).setValue(this.options._const.element,f(V)).setValue(this.options._const.route,o.concat(r))),n.splice(_,1),_-=1,r-=1,l-=1):n.length<s.length?(c=c.concat([(new a).setValue(this.options._const.action,this.options._const.addElement).setValue(this.options._const.element,f(g)).setValue(this.options._const.route,o.concat(r))]),n.splice(_,0,{}),l-=1):c=c.concat([(new a).setValue(this.options._const.action,this.options._const.replaceElement).setValue(this.options._const.oldValue,f(V)).setValue(this.options._const.newValue,f(g)).setValue(this.options._const.route,o.concat(r))]))),r+=1}return e.innerDone=!0,c},A.prototype.attemptGroupRelocation=function(e,t,o,n,s){for(var i,l,c,r,u,d,p=function(e,t,o){var n=e.childNodes?m(e.childNodes.length,!0):[],s=t.childNodes?m(t.childNodes.length,!0):[],i=0;return o.forEach((function(e){for(var t=e.oldValue+e.length,o=e.newValue+e.length,a=e.oldValue;a<t;a+=1)n[a]=i;for(var l=e.newValue;l<o;l+=1)s[l]=i;i+=1})),{gaps1:n,gaps2:s}}(e,t,o),_=p.gaps1,V=p.gaps2,g=Math.min(_.length,V.length),v=[],N=0,b=0;N<g;b+=1,N+=1)if(!s||!0!==_[N]&&!0!==V[N]){if(!0===_[N])if("#text"===(r=e.childNodes[b]).nodeName)if("#text"===t.childNodes[N].nodeName){if(r.data!==t.childNodes[N].data){for(d=b;e.childNodes.length>d+1&&"#text"===e.childNodes[d+1].nodeName;)if(d+=1,t.childNodes[N].data===e.childNodes[d].data){u=!0;break}if(!u)return v.push((new a).setValue(this.options._const.action,this.options._const.modifyTextElement).setValue(this.options._const.route,n.concat(N)).setValue(this.options._const.oldValue,r.data).setValue(this.options._const.newValue,t.childNodes[N].data)),v}}else v.push((new a).setValue(this.options._const.action,this.options._const.removeTextElement).setValue(this.options._const.route,n.concat(N)).setValue(this.options._const.value,r.data)),_.splice(N,1),g=Math.min(_.length,V.length),N-=1;else v.push((new a).setValue(this.options._const.action,this.options._const.removeElement).setValue(this.options._const.route,n.concat(N)).setValue(this.options._const.element,f(r))),_.splice(N,1),g=Math.min(_.length,V.length),N-=1;else if(!0===V[N])"#text"===(r=t.childNodes[N]).nodeName?(v.push((new a).setValue(this.options._const.action,this.options._const.addTextElement).setValue(this.options._const.route,n.concat(N)).setValue(this.options._const.value,r.data)),_.splice(N,0,!0),g=Math.min(_.length,V.length),b-=1):(v.push((new a).setValue(this.options._const.action,this.options._const.addElement).setValue(this.options._const.route,n.concat(N)).setValue(this.options._const.element,f(r))),_.splice(N,0,!0),g=Math.min(_.length,V.length),b-=1);else if(_[N]!==V[N]){if(v.length>0)return v;if(c=o[_[N]],(l=Math.min(c.newValue,e.childNodes.length-c.length))!==c.oldValue){i=!1;for(var w=0;w<c.length;w+=1)h(e.childNodes[l+w],e.childNodes[c.oldValue+w],[],!1,!0)||(i=!0);if(i)return[(new a).setValue(this.options._const.action,this.options._const.relocateGroup).setValue("groupLength",c.length).setValue(this.options._const.from,c.oldValue).setValue(this.options._const.to,l).setValue(this.options._const.route,n)]}}}else;return v},A.prototype.findValueDiff=function(e,t,o){var n=[];return e.selected!==t.selected&&n.push((new a).setValue(this.options._const.action,this.options._const.modifySelected).setValue(this.options._const.oldValue,e.selected).setValue(this.options._const.newValue,t.selected).setValue(this.options._const.route,o)),(e.value||t.value)&&e.value!==t.value&&"OPTION"!==e.nodeName&&n.push((new a).setValue(this.options._const.action,this.options._const.modifyValue).setValue(this.options._const.oldValue,e.value||"").setValue(this.options._const.newValue,t.value||"").setValue(this.options._const.route,o)),e.checked!==t.checked&&n.push((new a).setValue(this.options._const.action,this.options._const.modifyChecked).setValue(this.options._const.oldValue,e.checked).setValue(this.options._const.newValue,t.checked).setValue(this.options._const.route,o)),n};var D={debug:!1,diffcap:10,maxDepth:!1,maxChildCount:50,valueDiffing:!0,textDiff:function(e,t,o,n){e.data=n},preVirtualDiffApply:function(){},postVirtualDiffApply:function(){},preDiffApply:function(){},postDiffApply:function(){},filterOuterDiff:null,compress:!1,_const:!1,document:!(!window||!window.document)&&window.document},O=function(e){var t=this;if(void 0===e&&(e={}),this.options=e,Object.entries(D).forEach((function(e){var o=e[0],n=e[1];Object.prototype.hasOwnProperty.call(t.options,o)||(t.options[o]=n)})),!this.options._const){var o=["addAttribute","modifyAttribute","removeAttribute","modifyTextElement","relocateGroup","removeElement","addElement","removeTextElement","addTextElement","replaceElement","modifyValue","modifyChecked","modifySelected","modifyComment","action","route","oldValue","newValue","element","group","from","to","name","value","data","attributes","nodeName","childNodes","checked","selected"];this.options._const={},this.options.compress?o.forEach((function(e,o){return t.options._const[e]=o})):o.forEach((function(e){return t.options._const[e]=e}))}this.DiffFinder=A};O.prototype.apply=function(e,t){return function(e,t,o){return t.every((function(t){return n(e,t,o)}))}(e,t,this.options)},O.prototype.undo=function(e,t){return i(e,t,this.options)},O.prototype.diff=function(e,t){return new this.DiffFinder(e,t,this.options).init()};var T=function(e){var t=this;void 0===e&&(e={}),this.pad="│   ",this.padding="",this.tick=1,this.messages=[];var o=function(e,o){var n=e[o];e[o]=function(){for(var s=[],i=arguments.length;i--;)s[i]=arguments[i];t.fin(o,Array.prototype.slice.call(s));var a=n.apply(e,s);return t.fout(o,a),a}};for(var n in e)"function"==typeof e[n]&&o(e,n);this.log("┌ TRACELOG START")};return T.prototype.fin=function(e,t){this.padding+=this.pad,this.log("├─> entering "+e,t)},T.prototype.fout=function(e,t){this.log("│<──┘ generated return value",t),this.padding=this.padding.substring(0,this.padding.length-this.pad.length)},T.prototype.format=function(e,t){return function(e){for(e=""+e;e.length<4;)e="0"+e;return e}(t)+"> "+this.padding+e},T.prototype.log=function(){var e=Array.prototype.slice.call(arguments),t=function(e){return e?"string"==typeof e?e:e instanceof HTMLElement?e.outerHTML||"<empty>":e instanceof Array?"["+e.map(t).join(",")+"]":e.toString()||e.valueOf()||"<unknown>":"<falsey>"};e=e.map(t).join(", "),this.messages.push(this.format(e,this.tick++))},T.prototype.toString=function(){for(var e="└───";e.length<=this.padding.length+this.pad.length;)e+="×   ";var t=this.padding;return this.padding="",e=this.format(e,this.tick),this.padding=t,this.messages.join("\n")+"\n"+e},e.DiffDOM=O,e.TraceLogger=T,e.nodeToObj=v,e.stringToObj=x,e}({});

/* Polyfill EventEmitter. */
if ('undefined' === typeof EventEmitter) {
    var EventEmitter = function () {
        this.events = {};
    };

    EventEmitter.prototype.on = function (event, listener) {
        if (typeof this.events[event] !== 'object') {
            this.events[event] = [];
        }

        this.events[event].push(listener);
    };

    EventEmitter.prototype.removeListener = function (event, listener) {
        var idx;

        if (typeof this.events[event] === 'object') {
            idx = indexOf(this.events[event], listener);

            if (idx > -1) {
                this.events[event].splice(idx, 1);
            }
        }
    };
    EventEmitter.prototype.emit = function (event) {
        var i, listeners, length, args = [].slice.call(arguments, 1);

        if (typeof this.events[event] === 'object') {
            listeners = this.events[event].slice();
            length = listeners.length;

            for (i = 0; i < length; i++) {
                listeners[i].apply(this, args);
            }
        }
    };

    EventEmitter.prototype.once = function (event, listener) {
        this.on(event, function g() {
            this.removeListener(event, g);
            listener.apply(this, arguments);
        });
    };

    EventEmitter.prototype.off = function (event) {
        if (typeof this.events[event] === 'object') {
            delete this.events[event]
        }
    };
}

DEV_SYNC.eventbus = new EventEmitter();
function ready(fn) {
  if (document.readyState !== 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

function debounce(func, timeout = 0) {
    let timer;
    return (...args) => {
        const next = () => func(...args);
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(next, timeout);
    };
}

function uniqid() {
    var n = Math.floor(Math.random() * 11);
    var k = Math.floor(Math.random() * 1000000);
    return String.fromCharCode(n) + k;
}

(function () {
	const log = DEV_SYNC.debug ? console.log : () => {};
	// using a shared worker allows to bypass browser limitations to 6 connections
	const worker = new SharedWorker(DEV_SYNC.worker);
	
	worker.port.start();
	worker.port.onmessage = function(event) {
		log('Message', event.data);
		if ('error' === event.data.type) {
			console.warn('Dev sync server connection error. Start or restart the server and reload the page if needed.');
			return;
		}
		if ('message' !== event.data.type) {
			return;
		}
		const json = JSON.parse(event.data.msg);
		// ignore temp files
		if (-1 !== json.path.indexOf('~')) {
			log('ignored')
			return;
		}
		DEV_SYNC.eventbus.emit('message', json);
	}
	
	// initialize the worker, localhost does not seem to work in sse url in worker, figure out why
	worker.port.postMessage(DEV_SYNC.stream);
})();



(function () {
    const log = DEV_SYNC.debug ? console.log : () => {};
    let initial_stylesheets = []
    let refresh_list = new Map()

    // remove host and params
    function sanitizeHref(href) {
        href = href.replace(window.location.origin, '')
        href = href.split('?')[0]
        return href
    }

    function getStyle(href) {
        for (let s of document.styleSheets) {
            if (s.href && href === sanitizeHref(s.href)) {
                return s
            }
        }
    }

    function deleteStyle (href) {
        s = getStyle(href) && s.remove()
    }

    function updateStyle (href) {
        s = getStyle(href)
        // console.log('UPDATE', s)
        if (s) {
            s.ownerNode.href = href + '?v=' + uniqid()
        }
        // recreate it if it was initially on the page
        else if (-1 !== initial_stylesheets.indexOf(href)) {
            let link = document.createElement('link')
            link.href = href
            link.rel = 'stylesheet'
            document.head.appendChild(link)
        }
        else {
            log('stylesheet detected, but not loaded')
        }
    }

    function refresh () {
        log('REFRESHING STYLESHEETS', refresh_list)
        refresh_list.forEach((t, href) => {
            console.log(t, href)
            t === 'REMOVE' ? deleteStyle(href) : updateStyle(href)
            refresh_list.delete(href)
        })
    }

    ready(function() {
        for (let s of document.styleSheets) {
            s.href && initial_stylesheets.push(sanitizeHref(s.href))
        }
        const debounced_refresh = debounce(refresh, 250)
        DEV_SYNC.eventbus.on('message', function (m) {
            if (m.ext === '.css') {
                refresh_list.set(m.path, m.type)
                debounced_refresh()
            }
        })

    });
})();

(function() {

    let selectors = []
    let dd = new diffDOM.DiffDOM()

    // abort controller
    let controller = null

    const refresh = debounce(() => {
        controller && controller.abort();
        controller = new AbortController();
        var signal = controller.signal;

        fetch(window.location.href, {signal}).then(response => {
            controller = null;
            response.text().then(diff)
        })
        .catch(e => {
            // console.error('Error refreshing page.', e)
            controller = null;
        })

    });

    const diff = debounce(newHtml => {

        // get dom objects from html
        const parser = new DOMParser();
        // const oldDom = parser.parseFromString(get_current_html(), "text/html");
        const newDom = parser.parseFromString(newHtml, "text/html");

        selectors.map(selector => {
            const oldEl = document.querySelector(selector);
            const newEl = newDom.querySelector(selector);
            if (oldEl && newEl) {
                const d = dd.diff(oldEl, newEl);
                dd.apply(oldEl, d);
            }
        });
    })

    ready(function() {
        // const debounced_refresh = debounce(refresh, 250)
        DEV_SYNC.eventbus.on('message', function (m) {
            if (m.type === 'CHMOD') {
                return;
            }
            selectors = m.html.selectors;
            if (m.html.extensions.includes(m.ext)) {
                refresh();
            }
        })
    });
})();

// a vanilla js version of the jquery dom outline lib
// https://github.com/andrewchilds/jQuery.DomOutline/blob/a6cc870e24882a04f48219e4bed513e489f6d8fc/javascript.dom-outline-1.0.js
var DomOutline = function (options) {
    options = options || {};

    var pub = {};
    var self = {
        opts: {
            namespace: options.namespace || 'DomOutline',
            borderWidth: options.borderWidth || 2,
            onClick: options.onClick || false,
            filter: options.filter || false,
            dontStop: !options.stopOnClick || false
        },
        keyCodes: {
            BACKSPACE: 8,
            ESC: 27,
            DELETE: 46
        },
        active: false,
        initialized: false,
        elements: {}
    };

    function writeStylesheet(css) {
        var element = document.createElement('style');
        element.type = 'text/css';
        document.getElementsByTagName('head')[0].appendChild(element);

        if (element.styleSheet) {
            element.styleSheet.cssText = css; // IE
        } else {
            element.innerHTML = css; // Non-IE
        }
    }

    function initStylesheet() {
        if (self.initialized !== true) {
            var css = '' +
                '.' + self.opts.namespace + ' {' +
                '    background: #09c;' +
                '    position: absolute;' +
                '    z-index: 1000000;' +
                '}' +
                '.' + self.opts.namespace + '_label {' +
                '    background: #09c;' +
                '    border-radius: 2px;' +
                '    color: #fff;' +
                '    font: bold 12px/12px Helvetica, sans-serif;' +
                '    padding: 4px 6px;' +
                '    position: absolute;' +
                '    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);' +
                '    z-index: 1000001;' +
                '}';

            writeStylesheet(css);
            self.initialized = true;
        }
    }

    function createOutlineElements() {
        var divLabel = document.createElement('div');
        divLabel.classList.add(self.opts.namespace + '_label');

        var divTop = document.createElement('div');
        divTop.classList.add(self.opts.namespace);

        var divBottom = document.createElement('div');
        divBottom.classList.add(self.opts.namespace);

        var divLeft = document.createElement('div');
        divLeft.classList.add(self.opts.namespace);

        var divRight = document.createElement('div');
        divRight.classList.add(self.opts.namespace);

        var el = document.querySelector('body');

        self.elements.label = el.appendChild(divLabel);
        self.elements.top = el.appendChild(divTop);
        self.elements.bottom = el.appendChild(divBottom);
        self.elements.left = el.appendChild(divLeft);
        self.elements.right = el.appendChild(divRight);
    }

    function removeOutlineElements() {
        [].forEach.call(self.elements, function (name, element) {
            element.remove();
        });
    }

    function compileLabelText(element, width, height) {
        var label = element.tagName.toLowerCase();
        if (element.id) {
            label += '#' + element.id;
        }
        if (element.className) {
            label += ('.' + element.className.trim().replace(/ /g, '.')).replace(/\.\.+/g, '.');
        }
        return label + ' (' + Math.round(width) + 'x' + Math.round(height) + ')';
    }

    function getScrollTop(e) {
        if (!self.elements.window) {
            self.elements.window = window;
        }

        scrollTop = (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;

        return scrollTop;
    }

    function updateOutlinePosition(e) {
        if (e.target.className.indexOf(self.opts.namespace) !== -1) {
            return;
        }
        if (self.opts.filter) {
            if (!e.target.tagName === self.opts.filter) {
                return;
            }
        }
        pub.element = e.target;

        var b = self.opts.borderWidth;
        var scroll_top = getScrollTop(e);
        var pos = pub.element.getBoundingClientRect();
        var top = pos.top + scroll_top;

        var label_text = compileLabelText(pub.element, pos.width, pos.height);
        var label_top = Math.max(0, top - 20 - b, scroll_top) + 'px';
        var label_left = Math.max(0, pos.left - b) + 'px';

        // self.elements.label.css({ top: label_top, left: label_left }).text(label_text);
        self.elements.label.style.top = label_top;
        self.elements.label.style.left = label_left;
        self.elements.label.textContent = label_text

        // self.elements.top.css({ top: Math.max(0, top - b), left: pos.left - b, width: pos.width + b, height: b });
        self.elements.top.style.top = Math.max(0, top - b) + 'px';
        self.elements.top.style.left = (pos.left - b) + 'px';
        self.elements.top.style.width = (pos.width + b) + 'px';
        self.elements.top.style.height = b + 'px';

        // self.elements.bottom.css({ top: top + pos.height, left: pos.left - b, width: pos.width + b, height: b });
        self.elements.bottom.style.top = (top + pos.height) + 'px';
        self.elements.bottom.style.left = (pos.left - b) + 'px';
        self.elements.bottom.style.width = (pos.width + b) + 'px';
        self.elements.bottom.style.height = b + 'px';

        // self.elements.left.css({ top: top - b, left: Math.max(0, pos.left - b), width: b, height: pos.height + b });
        self.elements.left.style.top = (top - b) + 'px';
        self.elements.left.style.left = Math.max(0, pos.left - b) + 'px';
        self.elements.left.style.width = b + 'px';
        self.elements.left.style.height = (pos.height + b) + 'px';

        // self.elements.right.css({ top: top - b, left: pos.left + pos.width, width: b, height: pos.height + (b * 2) });
        self.elements.right.style.top = (top - b) + 'px';
        self.elements.right.style.left = (pos.left + pos.width) + 'px';
        self.elements.right.style.width = b + 'px';
        self.elements.right.style.height = (pos.height + (b * 2)) + 'px';
    }

    function stopOnEscape(e) {
        if (e.keyCode === self.keyCodes.ESC || e.keyCode === self.keyCodes.BACKSPACE || e.keyCode === self.keyCodes.DELETE) {
            pub.stop();
        }

        return false;
    }

    function clickHandler(e) {
        if (!self.opts.dontStop) pub.stop();

        self.opts.onClick.call(pub.element, e);

        return false;
    }

    function filterOption(e) {
        if (self.opts.filter) {
            if (!e.target.tagName === self.opts.filter) {
                return false;
            }
        }
        clickHandler.call(this, e);
    }

    pub.start = function () {
        initStylesheet();
        if (self.active !== true) {
            self.active = true;
            createOutlineElements();
            var body = document.querySelector('body')
            body.addEventListener('mousemove', updateOutlinePosition);
            body.addEventListener('keyup', stopOnEscape);
            if (self.opts.onClick) {
                setTimeout(function () {
                    body.addEventListener('click', filterOption);
                }, 50);
            }
        }
    };

    pub.stop = function () {
        self.active = false;
        removeOutlineElements();
        var body = document.querySelector('body')
        body.removeEventListener('mousemove', updateOutlinePosition);
        body.removeEventListener('keyup', stopOnEscape);
        body.removeEventListener('click', filterOption);
    };

    return pub;
};
